import { makeClaimReview } from "@beep/epistemics/Claim";
import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { EvidencePosition, ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { $EpistemicsId } from "@beep/identity/packages";
import { AbsenceReason } from "@beep/schema/Signal";
import { it } from "@beep/test-runner";
import { TextAnchor } from "@beep/text/TextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const roundTripJson = <Codec extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never }>(
  codec: Codec
) => {
  const json = S.fromJsonString(codec);
  return flow(S.encodeEffect(json), Effect.flatMap(S.decodeEffect(json)));
};

const extractorRoundTrip = roundTripJson(ExtractorConfidence);
const positionRoundTrip = roundTripJson(EvidencePosition);
const extractorEquivalent = S.toEquivalence(ExtractorConfidence);
const anchor = TextAnchor.make({ startChar: S.Natural.make(0), endChar: S.Natural.make(4), quote: "fact" });
const review = makeClaimReview({
  $I: $EpistemicsId.create("test/SignalsAbsent"),
  ids: {
    assertion: S.String.pipe(S.brand("SignalsAbsentAssertionId")),
    activity: S.String.pipe(S.brand("SignalsAbsentActivityId")),
    principal: S.String.pipe(S.brand("SignalsAbsentPrincipalId")),
  },
});
const decodeSignals = S.decodeEffect(review.EvidenceSignals);
const encodeSignals = S.encodeEffect(review.EvidenceSignals);

const reported = (value: number) =>
  ExtractorConfidence.cases.Present.make({
    value: ReportedConfidence.make({ value: Confidence.make(value), method: "synthetic-report", producer: O.none() }),
  });

const numericReading = ExtractorConfidence.match({
  Present: ({ value }) => O.some(value.value),
  Absent: () => O.none<number>(),
});

describe("L4-7 absent signals stay absent", () => {
  it.effect("L4-7 every absence reason survives the extractor, position and review codecs", () =>
    Effect.forEach(
      AbsenceReason.literals,
      Effect.fnUntraced(function* (reason) {
        const absent = ExtractorConfidence.cases.Absent.make({ reason });
        const decoded = yield* extractorRoundTrip(absent);
        expect(decoded).toEqual(absent);
        assertNone(numericReading(decoded));

        const position = EvidencePosition.make({ position: anchor, extractorConfidence: absent });
        const reread = yield* positionRoundTrip(position);
        expect(reread.extractorConfidence).toEqual(absent);

        const wire = { _tag: "Absent", reason } as const;
        const signals = {
          sourceTrust: wire,
          sourceAssertedConfidence: wire,
          extractorConfidence: wire,
          validator: wire,
          reviewer: wire,
        };
        const decodedSignals = yield* decodeSignals(signals);
        expect(
          A.map(
            [
              decodedSignals.sourceTrust,
              decodedSignals.sourceAssertedConfidence,
              decodedSignals.extractorConfidence,
              decodedSignals.validator,
              decodedSignals.reviewer,
            ],
            (field) => (field._tag === "Absent" ? O.some(field.reason) : O.none())
          )
        ).toStrictEqual(A.replicate(O.some(reason), 5));
        const encodedSignals = yield* encodeSignals(decodedSignals);
        expect(encodedSignals).toEqual(signals);
      }),
      { concurrency: 1, discard: true }
    )
  );

  it.effect("L4-7 explicit zero and one stay present with their exact value", () =>
    Effect.forEach(
      [0, 1],
      Effect.fnUntraced(function* (value) {
        const decoded = yield* extractorRoundTrip(reported(value));
        expect(decoded._tag).toBe("Present");
        assertSome(numericReading(decoded), value);
        expect(
          A.some(AbsenceReason.literals, (reason) =>
            extractorEquivalent(decoded, ExtractorConfidence.cases.Absent.make({ reason }))
          )
        ).toBe(false);
      }),
      { concurrency: 1, discard: true }
    )
  );

  it.effect.prop(
    "L4-7 any generated carrier keeps its tag and value across the codec",
    [Arbitrary.schema(ExtractorConfidence)],
    ([signal]) =>
      Effect.gen(function* () {
        const decoded = yield* extractorRoundTrip(signal);
        expect(extractorEquivalent(decoded, signal)).toBe(true);
        strictEqual(decoded._tag, signal._tag);
      })
  );
});
