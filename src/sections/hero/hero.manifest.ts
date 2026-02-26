/**
 * Manifest sekcji Hero — Konstytucja: typ, assety HOT/WARM/COLD, warmup, geometryMutable.
 * Typ B: ticker/Lottie/canvas (pełny silnik będzie dorzucony z animacjami).
 */
export const HERO_MANIFEST = {
  slug: "hero",
  type: "B" as const,
  requires: ["scrollRuntime", "gsap"],
  warmup: [] as const,
  assets: [
    { kind: "img", src: "/hero-poster.webp", priority: "HOT" as const, critical: true },
  ] as const,
  refreshSignals: ["assets-loaded", "fonts-ready"] as const,
  geometryMutable: false,
  scrollTriggersCount: 0,
  dciProps: ["headline", "sub", "tier"] as const,
  timelineContract: null as string | null,
  specialNotes: "Pierwsza sekcja. Silnik animacji (trail, Lottie, marquee) do dodania w kolejnych iteracjach.",
  evidence: {
    pipelineComplete: true,
    auditComplete: false,
    reactTransformComplete: true,
    criticalBlockers: 0,
    platformGuards: 0,
  },
} as const;
