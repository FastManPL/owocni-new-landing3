export const BLOK45_MANIFEST = {
  slug: "blok-4-5",
  type: "B" as const,
  geometryMutable: false,
  scrollTriggersCount: 2,
  specialNotes: [
    "Wave wrap must be rendered outside section root.",
    "Use autoAlpha for wave visibility; do not use display:none.",
    "Maintain deterministic z-index handoff: kinetic < wave < blok-4-5 section.",
  ],
} as const;
