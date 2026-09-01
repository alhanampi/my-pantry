import Groq from 'groq-sdk'

// Own client instance — deliberately not shared with services/groq.ts, whose
// module-scoped Groq client/cache is narrowly scoped to translateRecipeContent's
// fail-soft-to-English philosophy. Chat needs to surface real errors to the
// user instead of silently falling back, so it gets its own client and its
// own error handling.
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

// Same model as services/groq.ts — see the comment there for why
// (llama-3.x chat models were decommissioned on Groq's free tier).
const MODEL = 'openai/gpt-oss-120b'

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', es: 'Spanish' }

export class ChatConfigError extends Error {
  constructor() {
    super('GROQ_API_KEY is not configured')
    this.name = 'ChatConfigError'
  }
}

export class ChatQuotaError extends Error {
  constructor() {
    super('Groq quota exceeded')
    this.name = 'ChatQuotaError'
  }
}

function mapGroqError(err: unknown): Error {
  const status = (err as { status?: number } | undefined)?.status
  if (status === 401 || status === 403) return new ChatConfigError()
  if (status === 429) return new ChatQuotaError()
  return err instanceof Error ? err : new Error('Groq request failed')
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildSystemPrompt(
  language: string,
  dietaryRestrictions: string[],
  servings: number,
  nearbyStoresSummary?: string,
): string {
  const langName = LANGUAGE_NAMES[language] ?? 'English'
  const restrictionsText =
    dietaryRestrictions.length > 0 ? dietaryRestrictions.join(', ') : 'none specified'

  return [
    'You are a practical, encouraging home-cooking assistant helping the user figure out what to ' +
      "cook with what they have on hand, given their real-world constraints. Respond ONLY in " +
      `${langName}, in plain conversational text — no JSON, no markdown code fences.`,
    `The user has already specified up front: dietary restrictions = [${restrictionsText}], ` +
      `desired servings = ${servings}. These are already known — never ask for them again, just use them.`,
    'ASSUME the user already has basic pantry staples on hand — cooking oil, salt, pepper, common dried ' +
      'spices/herbs, sugar, flour, water — unless they say otherwise. Never ask about these; only ask ' +
      'about the actual main ingredients/proteins/produce they have or need.',
    'BE BRIEF. Every reply should be 2-4 short sentences of plain prose, no bullet lists, no numbered ' +
      'lists, no markdown formatting of any kind, no long explanations. Ask EXACTLY ONE question per ' +
      'reply — never two, never a numbered "1. ... 2. ..." pair of questions in the same message. If ' +
      'you catch yourself about to write "1." and "2.", stop and pick only the single most useful one ' +
      'to ask right now; save the rest for a later reply.',
    'Move fast toward a suggestion: across the whole conversation, ask at most 2-3 clarifying questions ' +
      'total (covering, as needed, what main ingredients they have and how much time they have — skip ' +
      "any of these the user already answered unprompted). As soon as you've asked around 2-3 things, " +
      "stop asking and tell the user they're ready to tap \"suggest a recipe\" — do not keep " +
      'interrogating them past that point even if some details stay vague; make reasonable assumptions ' +
      'instead.',
    'When estimating how long the whole thing will take, be PESSIMISTIC: round up, assume a home-cook ' +
      'pace (not a professional kitchen), and account for setup and cleanup time, not just active ' +
      'cooking time.',
    'If it seems relevant, ask (as one of your 2-3 total questions, not an extra one) whether the user ' +
      'plans to visit a nearby store for anything missing and, if so, roughly how many blocks/cuadras ' +
      'away it is. Once you know that, silently add walking time to your estimate at about 2-3 minutes ' +
      'per block, DOUBLED for the round trip (there and back) — this is YOUR internal arithmetic only. ' +
      'NEVER show the user the calculation, the per-block rate, or the multiplier (e.g. never say ' +
      'something like "2-3 min per block x2" or list out distances/times per store) — just state the ' +
      'final total time naturally, the way a person would ("con la vuelta al negocio, calculá alrededor ' +
      'de 40 minutos en total"). Skip asking about this entirely if the user already has everything or ' +
      'is not going out — do not ask just to ask.',
    nearbyStoresSummary
      ? `Nearby stores the user could walk to (from the app's own location lookup, not from the user): ` +
        `${nearbyStoresSummary}. This is background info for you only — if something is missing, mention ` +
        'AT MOST ONE relevant nearby option by name in passing (e.g. "hay un Carrefour cerca"), never a ' +
        'list of all of them with their individual distances.'
      : '',
    'You never propose a full recipe yourself — the user taps a separate "suggest a recipe" action in ' +
      'the app for concrete recipe options with photos once ready. Your job is only to gather the ' +
      'minimum needed (main ingredients, time, and — only if relevant — store distance) as briefly as ' +
      'possible, then point them to that action.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface StreamChatReplyParams {
  history: ChatHistoryMessage[]
  language: string
  dietaryRestrictions: string[]
  servings: number
  nearbyStoresSummary?: string
  onToken: (token: string) => void
}

/**
 * Streams a chat completion, invoking onToken for each text delta and
 * returning the full accumulated reply once the stream ends. Throws
 * ChatConfigError/ChatQuotaError/generic Error on failure — unlike
 * translateRecipeContent, callers here need to report real errors.
 */
export async function streamChatReply(params: StreamChatReplyParams): Promise<string> {
  if (!groq) throw new ChatConfigError()

  const system = buildSystemPrompt(
    params.language,
    params.dietaryRestrictions,
    params.servings,
    params.nearbyStoresSummary,
  )

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      // Backstop for the "be brief" system-prompt instruction, not just a
      // context-window limit — keeps a verbose model from rambling even if
      // it ignores the prompt.
      max_tokens: 300,
      stream: true,
      messages: [{ role: 'system', content: system }, ...params.history],
    })

    let full = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        full += delta
        params.onToken(delta)
      }
    }
    return full
  } catch (err) {
    throw mapGroqError(err)
  }
}

export interface SearchCriteria {
  query?: string
  cuisine?: string
  includeIngredients?: string
  maxReadyTime?: number
}

/**
 * Reads the conversation transcript and extracts Spoonacular-ready search
 * terms. `diet` is deliberately not asked of the model — it's derived
 * deterministically from the conversation's already-known dietaryRestrictions
 * by the caller (mapDietaryRestrictionsToSpoonacularDiet).
 *
 * Always returns *something* actionable — "suggest a recipe" must work with
 * however little the conversation has covered so far (the button is a
 * deliberate "give me options now" action, not gated on a information
 * threshold). Worst case, an empty SearchCriteria still gets 2-3 real
 * recipes back from Spoonacular's own random sort (see spoonacular.ts).
 */
export async function extractSearchCriteria(
  history: ChatHistoryMessage[],
): Promise<SearchCriteria> {
  if (!groq) throw new ChatConfigError()

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Read the following cooking-assistant conversation and extract search terms for a recipe ' +
            'API, doing your best with whatever is there even if the conversation is short or vague. ' +
            'Respond ONLY with a JSON object of the shape ' +
            '{ "query": string, "cuisine": string, "includeIngredients": string, "maxReadyTime": number }. ' +
            "All fields are optional — omit any you can't confidently infer; it's fine to return an " +
            'empty object if truly nothing is inferable, that is a valid answer, not an error. ' +
            'includeIngredients should be a comma-separated list of ingredient names the user said they ' +
            'have. maxReadyTime is in minutes, only include it if the user gave a real time constraint. ' +
            'IMPORTANT: the recipe API only indexes English text, regardless of what language the ' +
            'conversation is in. Always translate query, cuisine, and includeIngredients into English ' +
            'before returning them — e.g. a conversation about "pollo a la plancha" should produce ' +
            'query: "grilled chicken", and "tengo arroz y cebolla" should produce ' +
            'includeIngredients: "rice, onion". Never return these fields in Spanish or any other ' +
            'non-English language.',
        },
        ...history,
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Partial<SearchCriteria>

    const criteria: SearchCriteria = {}
    if (typeof parsed.query === 'string' && parsed.query.trim()) criteria.query = parsed.query.trim()
    if (typeof parsed.cuisine === 'string' && parsed.cuisine.trim()) criteria.cuisine = parsed.cuisine.trim()
    if (typeof parsed.includeIngredients === 'string' && parsed.includeIngredients.trim()) {
      criteria.includeIngredients = parsed.includeIngredients.trim()
    }
    if (typeof parsed.maxReadyTime === 'number' && parsed.maxReadyTime > 0) {
      criteria.maxReadyTime = Math.round(parsed.maxReadyTime)
    }

    return criteria
  } catch (err) {
    throw mapGroqError(err)
  }
}

const SPOONACULAR_DIETS = new Set([
  'vegetarian',
  'vegan',
  'glutenfree',
  'ketogenic',
  'pescetarian',
  'paleo',
  'primal',
  'lowfodmap',
  'whole30',
])

// Predefined dietary-restriction chip values (see DietaryChipPicker) that map
// directly onto Spoonacular's fixed `diet` vocabulary. Free-text custom chips
// never match here and are simply not passed as `diet` — they still reach the
// model via the conversation's stated restrictions in the system prompt.
const CHIP_TO_SPOONACULAR_DIET: Record<string, string> = {
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  glutenFree: 'glutenFree',
  keto: 'ketogenic',
  pescetarian: 'pescetarian',
  paleo: 'paleo',
}

export function mapDietaryRestrictionsToSpoonacularDiet(
  dietaryRestrictions: string[],
): string | undefined {
  for (const restriction of dietaryRestrictions) {
    const mapped = CHIP_TO_SPOONACULAR_DIET[restriction]
    if (mapped && SPOONACULAR_DIETS.has(mapped.toLowerCase())) return mapped
  }
  return undefined
}
