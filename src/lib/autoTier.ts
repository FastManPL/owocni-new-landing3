/**
 * F7: autoTier(headline) — czysta funkcja, serverowa.
 * Zwraca 'S' | 'M' | 'L' na podstawie długości nagłówka.
 * Integrator przekazuje tier jako prop do sekcji. Sekcja mapuje tier na CSS.
 */
export type Tier = "S" | "M" | "L";

export function autoTier(headline: string): Tier {
  const len = headline.replace(/\s+/g, " ").trim().length;
  if (len <= 35) return "L";
  if (len <= 75) return "M";
  return "S";
}
