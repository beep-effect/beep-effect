import { MAX_SOURCE_TEXT_LENGTH } from "@beep/langextract/VerifiedSpan";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineEffectivePolicy,
  CitationEngineLimits,
  CitationEngineLimitTightening,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const CitationEngineLimitTighteningType = S.toType(CitationEngineLimitTightening);

const rejects = (value: unknown) =>
  S.decodeUnknownEffect(CitationEngineLimits)(value).pipe(Effect.exit, Effect.map(Exit.isFailure));

describe("schema-owned citation safety budgets", () => {
  it.effect.prop(
    "preserves schema-generated source budgets through the effective limits codec",
    [CitationEngineLimits.fields.sourceUtf16],
    ([sourceUtf16]) =>
      Effect.gen(function* () {
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16 };
        const encoded = yield* S.encodeEffect(CitationEngineLimits)(limits);
        const decoded = yield* S.decodeEffect(CitationEngineLimits)(encoded);
        expect(S.toEquivalence(S.toType(CitationEngineLimits))(decoded, limits)).toBe(true);
        expect(decoded.sourceUtf16).toBeLessThanOrEqual(MAX_SOURCE_TEXT_LENGTH);
      })
  );
  it.effect("decodes explicit fixtures with Duration values and exact millisecond round trips", () =>
    Effect.gen(function* () {
      const policy = yield* defaultCitationEnginePolicy;
      expect(policy.execution).toBe("isolated-process");
      expect(CitationEngineAbsoluteMaxima.sourceUtf16).toBeLessThanOrEqual(MAX_SOURCE_TEXT_LENGTH);
      expect(Duration.isDuration(policy.limits.regexDeadline)).toBe(true);
      expect(Duration.toMillis(policy.limits.regexDeadline)).toBe(250);
      const encoded = yield* S.encodeEffect(CitationEngineEffectivePolicy)(policy);
      const decoded = yield* S.decodeEffect(CitationEngineEffectivePolicy)(encoded);
      expect(S.toEquivalence(S.toType(CitationEngineEffectivePolicy))(policy, decoded)).toBe(true);
      expect(encoded.limits.operationDeadline).toBe(30_000);
      const nanos = Duration.nanos(250_000_000n);
      const nanosPolicy = { ...policy, limits: { ...policy.limits, regexDeadline: nanos } };
      const nanosEncoded = yield* S.encodeUnknownEffect(CitationEngineEffectivePolicy)(nanosPolicy);
      const restored = yield* S.decodeEffect(CitationEngineEffectivePolicy)(nanosEncoded);
      expect(Duration.Equivalence(restored.limits.regexDeadline, nanos)).toBe(true);
    })
  );

  it.effect("accepts every absolute count ceiling and rejects the next integer", () =>
    Effect.gen(function* () {
      const policy = yield* defaultCitationEnginePolicy;
      const encoded = yield* S.encodeEffect(CitationEngineLimits)(policy.limits);
      for (const [key, maximum] of R.toEntries(CitationEngineAbsoluteMaxima)) {
        if (Str.endsWith("Millis")(key)) continue;
        yield* S.decodeEffect(CitationEngineLimits)({ ...encoded, [key]: maximum });
        const aboveMaximum = yield* rejects({ ...encoded, [key]: maximum + 1 });
        expect(aboveMaximum).toBe(true);
        for (const invalid of [0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
          const rejected = yield* rejects({ ...encoded, [key]: invalid });
          expect(rejected).toBe(true);
        }
      }
    })
  );

  it.effect("bounds all eight finite whole-millisecond deadlines in both codec directions", () =>
    Effect.gen(function* () {
      const policy = yield* defaultCitationEnginePolicy;
      const encoded = yield* S.encodeEffect(CitationEngineLimits)(policy.limits);
      const names = [
        "cleanDeadline",
        "extractDeadline",
        "resolveDeadline",
        "annotateDeadline",
        "operationDeadline",
        "regexDeadline",
        "queueDeadline",
        "cleanupDeadline",
      ] as const;
      for (const key of names) {
        const maximum = CitationEngineAbsoluteMaxima[`${key}Millis`];
        const atMaximum = yield* S.decodeEffect(CitationEngineLimits)({ ...encoded, [key]: maximum });
        expect(Duration.toMillis(atMaximum[key])).toBe(maximum);
        for (const invalid of [0, -1, 0.5, maximum + 1, Number.POSITIVE_INFINITY, Number.NaN]) {
          const rejected = yield* rejects({ ...encoded, [key]: invalid });
          expect(rejected).toBe(true);
        }
        for (const invalid of [Duration.infinity, Duration.negativeInfinity, Duration.nanos(1n)]) {
          const result = yield* S.encodeUnknownEffect(CitationEngineLimits)({ ...policy.limits, [key]: invalid }).pipe(
            Effect.exit
          );
          result.pipe(Exit.isFailure, assertTrue);
        }
      }
    })
  );

  it.effect("permits equality and tightening but rejects any request-local increase", () =>
    Effect.gen(function* () {
      const policy = yield* defaultCitationEnginePolicy;
      const guard = S.is(CitationEngineLimitTighteningType);
      expect(guard({ effective: policy, requested: policy.limits })).toBe(true);
      const encoded = yield* S.encodeEffect(CitationEngineLimits)(policy.limits);
      for (const [key, value] of R.toEntries(encoded)) {
        const reduced = yield* S.decodeEffect(CitationEngineLimits)({ ...encoded, [key]: 1 });
        expect(guard({ effective: policy, requested: reduced })).toBe(true);
        const increased = yield* S.decodeEffect(CitationEngineLimits)({ ...encoded, [key]: value + 1 });
        expect(guard({ effective: policy, requested: increased })).toBe(false);
      }
    })
  );

  it.effect("rejects missing budgets and unknown policy versions or execution modes", () =>
    Effect.gen(function* () {
      const policy = yield* defaultCitationEnginePolicy;
      const encoded = yield* S.encodeEffect(CitationEngineEffectivePolicy)(policy);
      for (const value of [
        {},
        { ...encoded, version: "unknown" },
        { ...encoded, execution: "inline-regex" },
        { ...encoded, limits: R.remove(encoded.limits, "sourceUtf16") },
      ]) {
        const result = yield* S.decodeUnknownEffect(CitationEngineEffectivePolicy)(value).pipe(Effect.exit);
        result.pipe(Exit.isFailure, assertTrue);
      }
      expect(A.length(R.keys(encoded.limits))).toBe(29);
    })
  );
});
