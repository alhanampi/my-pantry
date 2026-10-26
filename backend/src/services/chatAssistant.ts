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

// Spoonacular's complexSearch `cuisine` param only matches its own fixed
// vocabulary (case-insensitive, but still exact otherwise) — kept in sync
// with src/utils/recipeFilterOptions.ts's CUISINE_OPTIONS (frontend and
// backend are separate packages with no shared module between them, so this
// is a genuine duplicated copy, not a single source of truth — exported
// here so chatAssistant.test.ts can at least pin its exact contents and
// catch an accidental edit on this side; a change to the frontend list
// still needs a human to mirror it here on purpose). Giving the model free
// rein here let it emit things like "Arabic" for a conversation about "cena
// árabe", which silently matches nothing and used to cascade all the way
// down to an unrelated random result (see extractSearchCriteria below).
export const SPOONACULAR_CUISINES = [
  'African', 'American', 'British', 'Cajun', 'Caribbean', 'Chinese', 'Eastern European', 'European',
  'French', 'German', 'Greek', 'Indian', 'Irish', 'Italian', 'Japanese', 'Jewish', 'Korean',
  'Latin American', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Nordic', 'Southern', 'Spanish',
  'Thai', 'Vietnamese',
]

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

export type UnitSystem = 'metric' | 'imperial'

// The account's own choice always wins; when they've never explicitly
// touched it (unitSystem is null — see the User.unitSystem Prisma comment),
// resolve from the conversation's language: Spanish defaults to metric,
// everything else to imperial. Mirrored on the frontend (useUnitSystem.ts) —
// keep both in sync if this rule ever changes.
export function resolveUnitSystem(explicit: string | null | undefined, language: string): UnitSystem {
  if (explicit === 'metric' || explicit === 'imperial') return explicit
  return language.startsWith('es') ? 'metric' : 'imperial'
}

function buildSystemPrompt(
  language: string,
  dietaryRestrictions: string[],
  servings: number,
  unitSystem: UnitSystem,
  nearbyStoresSummary?: string,
  pantrySummary?: string,
): string {
  const langName = LANGUAGE_NAMES[language] ?? 'English'

  return [
    'You are a warm, friendly, encouraging home-cooking assistant helping the user figure out what to ' +
      "cook with what they have on hand, given their real-world constraints. Respond ONLY in " +
      `${langName}, in plain conversational text — no JSON, no markdown code fences.`,
    'Sound like a warm, upbeat friend who happens to love cooking — not a formal customer-service bot. ' +
      'Use a natural, encouraging tone, and sprinkle in the occasional food/kitchen emoji (🍳🥘😋👩‍🍳🧑‍🍳🥕) ' +
      'where it feels natural — a light touch (roughly one per reply, sometimes none), never more than two, ' +
      'never one on every single sentence.',
    dietaryRestrictions.length > 0
      ? `The user has stated these dietary restrictions: ${dietaryRestrictions.join(', ')}. Never ask ` +
        'about these — just honor them.'
      : '',
    `Default assumption: ${servings} serving(s), unless the conversation itself says otherwise (e.g. ` +
      '"para 4", "somos 3 comiendo") — if so, use that instead. This default was never actually chosen ' +
      "by the user (there's no upfront form anymore), so don't treat it as confirmed information; just " +
      "use it quietly unless the dish or the user's own words suggest a different headcount.",
    'ASSUME the user already has basic pantry staples on hand — cooking oil, salt, pepper, common dried ' +
      'spices/herbs, sugar, flour, water — unless they say otherwise. Never ask about these; only ask ' +
      'about the actual main ingredients/proteins/produce they have or need.',
    pantrySummary
      ? `The user's actual pantry right now (from the app's own inventory, not something they typed) ` +
        `contains: ${pantrySummary}. Ground your suggestions and questions in this — prefer proposing ` +
        'dishes that use these items, and never ask whether they have something that is already listed ' +
        'here. Treat it as a helpful hint, not a hard constraint: the user can still want something else.'
      : '',
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
      'away it is. Once you know that, silently add about 5 minutes per block to your time estimate — ' +
      'that single number already covers the round trip, so do not multiply or double it again. This is ' +
      'YOUR internal arithmetic only: NEVER show the user the calculation, the per-block rate, or list ' +
      'out distances/times per store — just state the final total time naturally, the way a person ' +
      'would ("con la vuelta al negocio, calculá alrededor de 40 minutos en total"). Skip asking about ' +
      'this entirely if the user already has everything or is not going out — do not ask just to ask.',
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
    `The user prefers the ${unitSystem} measurement system. If you ever mention a quantity yourself ` +
      `(e.g. suggesting how much of something to use), use ${unitSystem === 'metric' ? 'grams/ml/°C' : 'oz/cups/°F'} ` +
      'rather than the other system.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export interface StreamChatReplyParams {
  history: ChatHistoryMessage[]
  language: string
  dietaryRestrictions: string[]
  servings: number
  unitSystem: UnitSystem
  nearbyStoresSummary?: string
  pantrySummary?: string
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
    params.unitSystem,
    params.nearbyStoresSummary,
    params.pantrySummary,
  )

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      // gpt-oss-120b does hidden reasoning by default (Groq's own default is
      // 'medium') that eats into max_tokens before any visible reply text —
      // on a longer/more complex turn this could exhaust the whole budget
      // during reasoning and leave zero tokens for the actual answer,
      // producing a silently empty (not failed) response. 'low' keeps that
      // overhead small for this low-stakes, conversational use case.
      reasoning_effort: 'low',
      // Backstop for the "be brief" system-prompt instruction, not just a
      // context-window limit — keeps a verbose model from rambling even if
      // it ignores the prompt. Headroom raised alongside reasoning_effort
      // above, as a safety margin against the same reasoning-exhaustion
      // failure mode even at 'low' effort.
      max_tokens: 600,
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
  geoHint?: string,
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
            `"cuisine" MUST be exactly one of this fixed list (omit it entirely if nothing fits, even if ` +
            `the conversation mentions a cuisine/region — never invent a value outside this list): ` +
            `${SPOONACULAR_CUISINES.join(', ')}. ` +
            'Map demonyms/regions/dish origins that are not themselves in the list to the closest entry ' +
            'in it — for example "árabe"/"Arabic"/"Lebanese"/"Syrian"/"Egyptian" all map to "Middle ' +
            'Eastern"; "tex-mex" maps to "Mexican"; "cantonese"/"szechuan" map to "Chinese". Prefer this ' +
            "kind of inference over omitting cuisine, as long as there's a real, confident match. " +
            'includeIngredients should be a comma-separated list of ingredient names the user said they ' +
            'have (also pick these up from mentions in your own prior assistant replies in this history, ' +
            'not just the user turns). maxReadyTime is in minutes, only include it if the user gave a ' +
            'real time constraint. ' +
            (geoHint
              ? `${geoHint} Only use this to pick "cuisine" when the conversation itself gives no cuisine ` +
                'preference — an explicit preference from the user always wins over the location guess. '
              : '') +
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

const MAX_INGREDIENT_SUGGESTIONS = 6

/**
 * Reads the conversation and suggests ingredient names the user hasn't
 * already said they have, but would plausibly need for whatever dish is
 * being discussed — shown as tap-to-insert pills next to the composer.
 * Unlike extractSearchCriteria, this is user-facing copy, not a Spoonacular
 * query term, so it stays in the conversation's own language instead of
 * being translated to English. Deliberately conservative: an empty list is
 * the correct, expected answer whenever nothing concrete is being cooked
 * yet, rather than forcing a guess that has nothing to do with the chat.
 */
export async function suggestPossibleIngredients(
  history: ChatHistoryMessage[],
  language: string,
): Promise<string[]> {
  if (!groq) throw new ChatConfigError()

  const langName = LANGUAGE_NAMES[language] ?? 'English'

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 150,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Read the following cooking-assistant conversation and suggest up to ' +
            `${MAX_INGREDIENT_SUGGESTIONS} short ingredient names the user would plausibly still need for ` +
            "whatever dish/direction is being discussed, that they haven't already said they have. " +
            `Respond ONLY in ${langName} (the suggestions are shown to the user as tappable UI labels, ` +
            'not sent to any external API — do not translate them to English). Respond ONLY with a JSON ' +
            'object of the shape { "ingredients": string[] }. If there is no concrete dish/direction yet, ' +
            "or the conversation's last turn isn't about gathering ingredients, return an empty array — " +
            'never invent generic suggestions with no real connection to the conversation.',
        },
        ...history,
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) return []

    const parsed = JSON.parse(raw) as { ingredients?: unknown }
    if (!Array.isArray(parsed.ingredients)) return []

    const seen = new Set<string>()
    const result: string[] = []
    for (const entry of parsed.ingredients) {
      if (typeof entry !== 'string') continue
      const trimmed = entry.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(trimmed)
      if (result.length >= MAX_INGREDIENT_SUGGESTIONS) break
    }
    return result
  } catch (err) {
    throw mapGroqError(err)
  }
}

/**
 * Translates a list of pantry ingredient names into English so they can be
 * used as Spoonacular `includeIngredients` — Spoonacular only indexes
 * English text, same constraint as extractSearchCriteria above. Unlike
 * groq.ts's translateRecipeContent (which fails soft to English on any
 * error, fine for display copy), this throws on failure: silently returning
 * the original (possibly Spanish) names would make the caller's Spoonacular
 * query quietly return nothing, which is worse than a visible error.
 */
export async function translateIngredientNames(names: string[]): Promise<string[]> {
  if (!groq) throw new ChatConfigError()
  if (names.length === 0) return []

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Translate the following list of grocery/pantry ingredient names into English, preserving ' +
            'their order. If a name is already in English, keep it as-is. Respond ONLY with a JSON ' +
            'object of the shape { "names": string[] }, with exactly as many entries as the input, in ' +
            'the same order.',
        },
        { role: 'user', content: JSON.stringify(names) },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('Empty translation response')

    const parsed = JSON.parse(raw) as { names?: unknown }
    if (!Array.isArray(parsed.names)) throw new Error('Malformed translation response')

    return parsed.names.map((n, i) => (typeof n === 'string' && n.trim() ? n.trim() : names[i]))
  } catch (err) {
    throw mapGroqError(err)
  }
}

/**
 * Translates a single recipe/dish title into English so it can be used as a
 * Spoonacular/Edamam search term — same "recipe API only indexes English
 * text" constraint as translateIngredientNames above, but phrased for a
 * whole dish name (e.g. "Arroz con pollo" → "Chicken and rice") rather than
 * a list of ingredient names, which read oddly through that prompt. Throws
 * on failure like translateIngredientNames — callers that need a best-effort
 * fallback (mealPlanAi.ts's resolveMealImage) catch it themselves and keep
 * the original title rather than aborting the image lookup.
 */
export async function translateDishTitle(title: string): Promise<string> {
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
            'Translate the following recipe/dish name into English, the way it would naturally appear on ' +
            'an English-language recipe site (not a literal word-for-word translation). If it is already ' +
            'in English, return it unchanged. Respond ONLY with a JSON object of the shape { "title": string }.',
        },
        { role: 'user', content: title },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('Empty translation response')

    const parsed = JSON.parse(raw) as { title?: unknown }
    return typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : title
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
