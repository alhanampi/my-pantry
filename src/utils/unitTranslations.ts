// Spoonacular's ingredient measures (unitShort/unitLong) are always in
// English, unlike ingredient names/instructions which already get
// translated via Groq (translateRecipeContent). Units are a small, closed,
// bounded vocabulary — not worth an AI call (and its latency/cost) for the
// same handful of words every time, so this is a plain static lookup
// instead. Keys are lowercased for case-insensitive matching; anything not
// in the table (or any language other than Spanish) passes through
// unchanged rather than breaking.
const EN_TO_ES: Record<string, string> = {
  g: 'g',
  gram: 'gramo',
  grams: 'gramos',
  kg: 'kg',
  kilogram: 'kilogramo',
  kilograms: 'kilogramos',
  ml: 'ml',
  milliliter: 'mililitro',
  milliliters: 'mililitros',
  l: 'l',
  liter: 'litro',
  liters: 'litros',
  oz: 'oz',
  ounce: 'onza',
  ounces: 'onzas',
  lb: 'lb',
  lbs: 'lb',
  pound: 'libra',
  pounds: 'libras',
  cup: 'taza',
  cups: 'tazas',
  tsp: 'cdta',
  tsps: 'cdtas',
  teaspoon: 'cucharadita',
  teaspoons: 'cucharaditas',
  tbsp: 'cda',
  tbsps: 'cdas',
  tablespoon: 'cucharada',
  tablespoons: 'cucharadas',
  clove: 'diente',
  cloves: 'dientes',
  serving: 'porción',
  servings: 'porciones',
  pinch: 'pizca',
  pinches: 'pizcas',
  slice: 'rodaja',
  slices: 'rodajas',
  can: 'lata',
  cans: 'latas',
  piece: 'pieza',
  pieces: 'piezas',
  package: 'paquete',
  packages: 'paquetes',
  stick: 'barra',
  sticks: 'barras',
  sprig: 'ramita',
  sprigs: 'ramitas',
  whole: 'entero',
  small: 'pequeño',
  medium: 'mediano',
  large: 'grande',
}

export function translateUnit(unit: string, language: string): string {
  if (!language.startsWith('es')) return unit
  return EN_TO_ES[unit.trim().toLowerCase()] ?? unit
}
