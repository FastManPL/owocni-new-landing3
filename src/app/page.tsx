import type { Metadata } from "next";
import { getVariant } from "@/config/variants";
import { autoTier } from "@/lib/autoTier";
import { HeroSection } from "@/sections/hero/HeroSection";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const variant = await getVariant(searchParams);
  return {
    title: variant.metaTitle,
    description: variant.metaDescription,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const variant = await getVariant(searchParams);
  const tier = autoTier(variant.h1);

  return (
    <main>
      <HeroSection headline={variant.h1} sub={variant.sub} tier={tier} />
    </main>
  );
}
