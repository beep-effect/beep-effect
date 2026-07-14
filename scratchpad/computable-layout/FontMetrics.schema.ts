// The metrics cache as a schema value — the "shippable sight" contract from
// explorations/computable-workspace-geometry (open question #2, first draft).
// A FontMetricsSnapshot is measured once in the user's actual engine (impure,
// browser-side) and decoded anywhere; everything downstream of decode is pure
// arithmetic. Deliberately fixture-shaped for now; the real contract grows
// segment kinds, engine profile, and emoji correction when pretext lands.
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

export const FontMetricsSnapshot = S.Struct({
  capturedAt: S.String,
  oracle: S.String,
  engine: S.String,
  platform: S.String,
  font: S.String,
  lineHeight: S.Finite,
  sentence: S.String,
  spaceWidth: S.Finite,
  words: S.Record(S.String, S.Finite),
  domLineCounts: S.Record(S.String, S.Finite),
});

export type FontMetricsSnapshot = typeof FontMetricsSnapshot.Type;

export const decodeFontMetricsSnapshot = (input: unknown): FontMetricsSnapshot =>
  Effect.runSync(S.decodeUnknownEffect(FontMetricsSnapshot)(input));

export const encodeFontMetricsSnapshot = (value: FontMetricsSnapshot) =>
  Effect.runSync(S.encodeEffect(FontMetricsSnapshot)(value));
