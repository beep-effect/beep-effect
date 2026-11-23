import { AbsenceReason, Measurement, makeSignal } from "@beep/schema/Signal";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const NumericSignal = makeSignal(S.Finite);
const NumericSignalJson = S.fromJsonString(NumericSignal);
const MeasurementJson = S.fromJsonString(Measurement);

describe("reasoned signals", () => {
  it.effect.each(AbsenceReason.literals)("L4-7 preserves the absence reason %s without a number", (reason) =>
    Effect.gen(function* () {
      const signal = NumericSignal.cases.Absent.make({ reason });
      const encoded = yield* S.encodeEffect(NumericSignalJson)(signal);
      const decoded = yield* S.decodeEffect(NumericSignalJson)(encoded);
      expect(decoded).toEqual(signal);
      expect(decoded).not.toHaveProperty("value");
    })
  );

  it.effect.each([0, 1])("L4-7 preserves explicit present boundary %s", (value) =>
    Effect.gen(function* () {
      const signal = NumericSignal.cases.Present.make({ value });
      const encoded = yield* S.encodeEffect(NumericSignalJson)(signal);
      const decoded = yield* S.decodeEffect(NumericSignalJson)(encoded);
      expect(decoded).toEqual(signal);
    })
  );

  it.effect.prop(
    "L4-7 typed measurements preserve their case and encoded payload",
    [Arbitrary.schema(Measurement)],
    ([measurement]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(MeasurementJson)(measurement);
        const decoded = yield* S.decodeEffect(MeasurementJson)(encoded);
        const reencoded = yield* S.encodeEffect(MeasurementJson)(decoded);
        expect(reencoded).toBe(encoded);
        expect(decoded._tag).toBe(measurement._tag);
      })
  );

  it.effect("L4-7 retains the three pre-P4 measurement encodings", () =>
    Effect.gen(function* () {
      const similarity = yield* S.decodeEffect(Measurement)({
        _tag: "Similarity",
        value: -1,
        metric: "cosine",
        model: "synthetic/1",
      });
      const probability = yield* S.decodeEffect(Measurement)({
        _tag: "ClassifierProbability",
        value: 0,
        model: "synthetic/1",
        calibrated: false,
      });
      const ordinal = yield* S.decodeEffect(Measurement)({ _tag: "OrdinalJudgment", level: "high" });
      const encodedSimilarity = yield* S.encodeEffect(Measurement)(similarity);
      const encodedProbability = yield* S.encodeEffect(Measurement)(probability);
      const encodedOrdinal = yield* S.encodeEffect(Measurement)(ordinal);
      expect(encodedSimilarity).toEqual({ _tag: "Similarity", value: -1, metric: "cosine", model: "synthetic/1" });
      expect(encodedProbability).toEqual({
        _tag: "ClassifierProbability",
        value: 0,
        model: "synthetic/1",
        calibrated: false,
      });
      expect(encodedOrdinal).toEqual({ _tag: "OrdinalJudgment", level: "high" });
    })
  );
});
