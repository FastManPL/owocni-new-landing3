export const KINETIC_MANIFEST = {
  slug: "kinetic",
  type: "B" as const,
  requires: ["scrollRuntime", "gsap"],
  warmup: [],
  assets: [],
  refreshSignals: [],
  geometryMutable: false,
  scrollTriggersCount: 1,
  dciProps: [],
  specialNotes:
    "Pin+Snap Macro Section — Snap-Lock on touch resize; Final Frame Freeze touch-only; Desktop large resize recovery: remount/reinit; NO fastScrollEnd; Do not attach useGeometryRefresh / geometry signals.",
  evidence: {
    pipelineComplete: false,
    auditComplete: false,
    reactTransformComplete: false,
    criticalBlockers: 0,
    platformGuards: 0,
  },
} as const;

