"use server";

import { cache } from "react";
import "server-only";

/**
 * F2: Konfiguracja wariantów DCI — server-only.
 * F3: getVariant(searchParams) deterministyczna, fallback do defaultVariant.
 * F4: Normalizacja: toLowerCase(), trim(), decode.
 */

export interface Variant {
  h1: string;
  sub: string;
  metaTitle: string;
  metaDescription: string;
}

const DEFAULT_VARIANT: Variant = {
  h1: "Dream team do tworzenia porządnych stron w Warszawie.",
  sub: "Z Owocnymi zdobędziesz dokładnie takich klientów, na jakich najbardziej Ci zależy. Dajemy Ci na 100% gwarancji. Wyskocz ponad konkurencję z Warszawy. Wystartuj stronę szybciej i pozwól swojej firmie działać na pełnych obrotach.",
  metaTitle: "Owocni — Strony WWW Warszawa",
  metaDescription: "Profesjonalne strony WWW w Warszawie. 100% gwarancji, 20 lat doświadczenia. Otrzymaj wycenę.",
};

const VARIANTS: Record<string, Variant> = {
  default: DEFAULT_VARIANT,
};

function normalizeKey(value: string | string[] | undefined): string {
  if (value == null) return "default";
  const raw = Array.isArray(value) ? value[0] : value;
  return decodeURIComponent(raw).toLowerCase().trim() || "default";
}

/**
 * F10: React.cache() = request-scoped deduplication (NIE "use cache").
 */
export const getVariant = cache(
  async (searchParams: Promise<Record<string, string | string[] | undefined>>) => {
    const params = await searchParams;
    const key = normalizeKey(params.k ?? params.variant ?? params.ref);
    return VARIANTS[key] ?? DEFAULT_VARIANT;
  }
);
