import Groq from 'groq-sdk'

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

// ROADMAP v1.5 suggests "Llama 3.x". `llama-3.3-70b-versatile` is Groq's current
// production model at the time this was written; if it's deprecated by the time
// this runs, swap for whichever model is active in the Groq console/docs — the
// translation prompt below is model-agnostic (plain JSON-mode chat completion).
const MODEL = 'llama-3.3-70b-versatile'

// Module-scoped cache. In a serverless deployment (Vercel) each function
// instance gets its own memory, so this cache is weak/per-instance — accepted
// limitation (documented in the plan), not a bug.
const cache = new Map<string, TranslatedRecipeContent>()

export interface RecipeContentToTranslate {
  id: number
  title: string
  ingredientNames: string[]
  instructionSteps: string[]
}

export interface TranslatedRecipeContent {
  title: string
  ingredientNames: string[]
  instructionSteps: string[]
}

function cacheKey(id: number, lang: string): string {
  return `${id}:${lang}`
}

function englishFallback(recipe: RecipeContentToTranslate): TranslatedRecipeContent {
  return {
    title: recipe.title,
    ingredientNames: recipe.ingredientNames,
    instructionSteps: recipe.instructionSteps,
  }
}

/**
 * Translates a recipe's rendered content (title, ingredient names, instruction
 * steps) to `targetLang` using Groq. Never throws — any failure (missing key,
 * network error, malformed/misaligned response) falls back to the original
 * English content so the request never breaks because of translation.
 */
export async function translateRecipeContent(
  recipe: RecipeContentToTranslate,
  targetLang: string,
): Promise<TranslatedRecipeContent> {
  if (targetLang === 'en') return englishFallback(recipe)

  const key = cacheKey(recipe.id, targetLang)
  const cached = cache.get(key)
  if (cached) return cached

  if (!groq) return englishFallback(recipe)

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a precise recipe translator. Translate the given recipe content into the requested ' +
            'target language. Respond ONLY with a JSON object of the shape ' +
            '{ "title": string, "ingredientNames": string[], "instructionSteps": string[] }. ' +
            'The ingredientNames and instructionSteps arrays MUST have exactly the same length and order ' +
            'as the input arrays — translate each entry in place, do not add, remove, merge, or reorder items.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            targetLang,
            title: recipe.title,
            ingredientNames: recipe.ingredientNames,
            instructionSteps: recipe.instructionSteps,
          }),
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) return englishFallback(recipe)

    const parsed = JSON.parse(raw) as Partial<TranslatedRecipeContent>

    const translated: TranslatedRecipeContent = {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : recipe.title,
      ingredientNames:
        Array.isArray(parsed.ingredientNames) &&
        parsed.ingredientNames.length === recipe.ingredientNames.length
          ? parsed.ingredientNames
          : recipe.ingredientNames,
      instructionSteps:
        Array.isArray(parsed.instructionSteps) &&
        parsed.instructionSteps.length === recipe.instructionSteps.length
          ? parsed.instructionSteps
          : recipe.instructionSteps,
    }

    cache.set(key, translated)
    return translated
  } catch {
    return englishFallback(recipe)
  }
}
