export const BOOK_STATS_MANIFEST = {
  slug: "book-stats",
  type: "B" as const,
  requires: ["scrollRuntime", "gsap"],
  warmup: [] as const,
  assets: [
    { kind: "img", src: "/Ksiazka-Klatki/frame-001.webp", priority: "WARM" as const, critical: false },
  ] as const,
  geometryMutable: false,
  scrollTriggersCount: 1,
  dciProps: [] as const,
  specialNotes:
    "Klatki frame-001.webp … frame-023.webp z /Ksiazka-Klatki. Tylko WEBP (bez AVIF i innych rozmiarów). Pierwsza sekcja wrapowana — kolejna pojawia się pod spodem przy połowie wylotu (do doprecyzowania).",
} as const;
