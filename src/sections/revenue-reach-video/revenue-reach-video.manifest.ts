export const REVENUE_REACH_VIDEO_MANIFEST = {
  slug: "revenue-reach-video",
  type: "A" as const,
  requires: [] as const,
  warmup: [] as const,
  assets: [
    { kind: "video", src: "/assets/banner-konwersja-strony.mp4", priority: "WARM" as const, critical: false },
  ] as const,
  geometryMutable: false,
  scrollTriggersCount: 0,
  dciProps: [] as const,
  specialNotes: "Video pauzowane poza viewport (IO). Pierwsza sekcja pod hero.",
} as const;
