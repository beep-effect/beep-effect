// FontMetricsSnapshot v1 — the versioned envelope (exploration Q2, first
// rung). Same pattern as the dock kernel's DockSnapshot: an explicit version
// tag so every future migration starts from a known format, plus the engine
// profile that makes per-engine sight honest (the same quirk fences pretext
// keeps in src/measurement.ts). v2 residue (segment kinds, emoji correction,
// font-descriptor normalization) is tracked in the exploration DECISIONS.md.
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FontMetricsSnapshot } from "./FontMetrics.schema.ts";

export const EngineProfile = S.Struct({
  lineFitEpsilon: S.Finite,
  carryCJKAfterClosingQuote: S.Boolean,
  breakKeepAllAfterPunctuation: S.Boolean,
  preferPrefixWidthsForBreakableRuns: S.Boolean,
});

export type EngineProfile = typeof EngineProfile.Type;

export const FontMetricsSnapshotV1 = S.Struct({
  version: S.tag(1),
  metrics: S.Struct({
    ...FontMetricsSnapshot.fields,
    engineProfile: EngineProfile,
  }),
});

export type FontMetricsSnapshotV1 = typeof FontMetricsSnapshotV1.Type;

export const decodeFontMetricsSnapshotV1 = (input: unknown): FontMetricsSnapshotV1 =>
  Effect.runSync(S.decodeUnknownEffect(FontMetricsSnapshotV1)(input));

export const encodeFontMetricsSnapshotV1 = (value: FontMetricsSnapshotV1) =>
  Effect.runSync(S.encodeEffect(FontMetricsSnapshotV1)(value));
