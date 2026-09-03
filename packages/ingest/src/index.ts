// @lkb/ingest — T-020. Source adapter seam: source.ts (interface + consent gate), sources/
// (recording, document), registry.ts (detectSource). gap-tracking.ts (T-006) gives
// assertProvidedFirst warnings / join failures / fetch 404s a durable `gaps` doc.
export * from "./source.js";
export * from "./registry.js";
export * from "./gap-tracking.js";

export * from "./sources/recording.js";
export * from "./sources/document.js";
