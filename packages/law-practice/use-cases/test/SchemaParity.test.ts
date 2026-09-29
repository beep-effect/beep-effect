import {
  IrToLawExtractionError,
  IrToLawExtractionErrorReason,
  IrToLawShape,
} from "@beep/law-practice-use-cases/IrToLaw";
import {
  OfficeActionExtractionLabel,
  OfficeActionReviewError,
  OfficeActionReviewInput,
} from "@beep/law-practice-use-cases/OfficeActionReview";
import {
  PracticeKgCandidateClaimsNotLoadedResult,
  PracticeKgCandidateClaimsResult,
  PracticeKgCandidateClaimToolRow,
  PracticeKgDocumentToolRow,
  PracticeKgEmailToolRow,
  PracticeKgFamilyToolRow,
  PracticeKgGraphToolRow,
  PracticeKgToolkit,
} from "@beep/law-practice-use-cases/server";
import { EffectOutput, EntityInput } from "@beep/law-practice-use-cases/test";
import { Fn } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeEntityInput = S.decodeEffect(EntityInput);
const decodeUnknownIrToLawShapeResult = S.decodeUnknownResult(IrToLawShape);
const encodeEntityInput = S.encodeEffect(EntityInput);
const encodeIrToLawExtractionError = S.encodeEffect(IrToLawExtractionError);
const encodeOfficeActionReviewError = S.encodeEffect(OfficeActionReviewError);

const CountOutput = EffectOutput<number, string>();
const isCountOutput = S.is(CountOutput);
const decodeUnknownCountOutput = S.decodeUnknownEffect(CountOutput);
const encodeCountOutput = S.encodeEffect(CountOutput);
const IncrementPort = Fn({ input: S.Finite, output: EffectOutput<number>() });
const increment = IncrementPort.implementSync((count) => Effect.succeed(count + 1));

const assertSchemaEncodeDecodeRoundTrip = Effect.fn("SchemaParityTest.assertSchemaEncodeDecodeRoundTrip")(function* <
  Schema extends S.Codec<unknown>,
>(schema: Schema, value: Schema["Type"]) {
  const decode = S.decodeUnknownEffect(schema);
  const encode = S.encodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  assertTrue(equivalent(yield* decode(yield* encode(value)), value));
});
const assertArbitraryValueDecodesToSelf = Effect.fn("SchemaParityTest.assertArbitraryValueDecodesToSelf")(function* <
  Schema extends S.Codec<unknown>,
>(schema: Schema, value: Schema["Type"]) {
  const decode = S.decodeUnknownEffect(schema);
  const equivalent = S.toEquivalence(schema);
  const isValue = S.is(schema);
  const decoded = yield* decode(value);
  assertTrue(isValue(value) && equivalent(decoded, value));
});

describe("@beep/law-practice-use-cases schema parity", () => {
  it.effect.prop(
    "round-trips schema-derived values through their source schemas",
    [Arbitrary.schema(OfficeActionExtractionLabel)],
    ([value]) => assertArbitraryValueDecodesToSelf(OfficeActionExtractionLabel, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (IrToLawExtractionErrorReason)",
    [Arbitrary.schema(IrToLawExtractionErrorReason)],
    ([value]) => assertArbitraryValueDecodesToSelf(IrToLawExtractionErrorReason, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (OfficeActionReviewInput)",
    [Arbitrary.schema(OfficeActionReviewInput)],
    ([value]) => assertArbitraryValueDecodesToSelf(OfficeActionReviewInput, value),
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (EntityInput)",
    [Arbitrary.schema(EntityInput)],
    ([value]) => assertArbitraryValueDecodesToSelf(EntityInput, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (PracticeKgCandidateClaimToolRow)",
    [Arbitrary.schema(PracticeKgCandidateClaimToolRow)],
    ([value]) => assertArbitraryValueDecodesToSelf(PracticeKgCandidateClaimToolRow, value),
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (PracticeKgDocumentToolRow)",
    [Arbitrary.schema(PracticeKgDocumentToolRow)],
    ([value]) => assertArbitraryValueDecodesToSelf(PracticeKgDocumentToolRow, value),
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (PracticeKgEmailToolRow)",
    [Arbitrary.schema(PracticeKgEmailToolRow)],
    ([value]) => assertArbitraryValueDecodesToSelf(PracticeKgEmailToolRow, value),
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (PracticeKgFamilyToolRow)",
    [Arbitrary.schema(PracticeKgFamilyToolRow)],
    ([value]) => assertArbitraryValueDecodesToSelf(PracticeKgFamilyToolRow, value),
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (PracticeKgGraphToolRow)",
    [Arbitrary.schema(PracticeKgGraphToolRow)],
    ([value]) => assertArbitraryValueDecodesToSelf(PracticeKgGraphToolRow, value),
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (IrToLawExtractionError)",
    [Arbitrary.schema(IrToLawExtractionError)],
    ([value]) => assertSchemaEncodeDecodeRoundTrip(IrToLawExtractionError, value),
    { arbitrary: fcRuns(25) }
  );
  it.effect.prop(
    "round-trips schema-derived values through their source schemas (OfficeActionReviewError)",
    [Arbitrary.schema(OfficeActionReviewError)],
    ([value]) => assertSchemaEncodeDecodeRoundTrip(OfficeActionReviewError, value),
    { arbitrary: fcRuns(10) }
  );

  it("composes the nine-tool practice KG surface with a typed claims not-loaded branch", () => {
    const notLoaded = PracticeKgCandidateClaimsNotLoadedResult.make({
      available: false,
      bundle_version: "fixture-1",
      epistemic_status: "candidate-unreviewed",
      reason: "claims batch not yet loaded",
    });

    expect(Object.keys(PracticeKgToolkit.tools)).toHaveLength(9);
    pipe(PracticeKgCandidateClaimsResult.is(notLoaded), assertTrue);
  });

  it.effect(
    "preserves the IrToLawExtractionError encoded wire shape",
    Effect.fnUntraced(function* () {
      const missing = IrToLawExtractionError.fromReason("required-extraction-missing", {
        label: "claim",
        message: "Missing claim extraction.",
      });
      const unaligned = IrToLawExtractionError.fromReason("required-extraction-unaligned", {
        alignmentStatus: "unaligned",
        label: "distinction",
        message: "The distinction could not be grounded.",
      });

      assertNone(missing.alignmentStatus);
      expect(yield* encodeIrToLawExtractionError(missing)).toStrictEqual({
        _tag: "IrToLawExtractionError",
        label: "claim",
        message: "Missing claim extraction.",
        reason: "required-extraction-missing",
      });
      expect(yield* encodeIrToLawExtractionError(unaligned)).toStrictEqual({
        _tag: "IrToLawExtractionError",
        alignmentStatus: "unaligned",
        label: "distinction",
        message: "The distinction could not be grounded.",
        reason: "required-extraction-unaligned",
      });
    })
  );

  it.effect(
    "preserves the spike EntityInput encoded audit envelope",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeEntityInput({
        createdAt: 1,
        createdByPrincipal: { component: "Runtime", kind: "System" },
        entityType: "LawPracticeClaim",
        id: 2,
        orgId: 1,
        publicId: "law_practice_claim_a2",
        rowVersion: 1,
        schemaVersion: "0.0.0",
        source: "System",
        updatedAt: 3,
        updatedByPrincipal: { component: "Runtime", kind: "System" },
      });

      expect(yield* encodeEntityInput(decoded)).toStrictEqual({
        createdAt: 1,
        createdByPrincipal: {
          component: "Runtime",
          kind: "System",
        },
        entityType: "LawPracticeClaim",
        id: 2,
        orgId: 1,
        publicId: "law_practice_claim_a2",
        rowVersion: 1,
        schemaVersion: "0.0.0",
        source: "System",
        updatedAt: 3,
        updatedByPrincipal: {
          component: "Runtime",
          kind: "System",
        },
      });
    })
  );

  it.effect(
    "uses OfficeActionReviewError codec statics for boundary error guards",
    Effect.fnUntraced(function* () {
      const error = IrToLawExtractionError.fromReason("required-extraction-unaligned", {
        alignmentStatus: "unaligned",
        label: "distinction",
        message: "The distinction could not be grounded.",
      });

      const encoded = yield* encodeOfficeActionReviewError(error);

      pipe(OfficeActionReviewError.is(error), assertTrue);
      pipe(OfficeActionReviewError.decodeUnknownOption(encoded), O.isSome, assertTrue);
    })
  );

  // `toLaw` is a declared schema whose guard is the only thing standing between
  // the port and a non-callable value, so both branches are asserted here.
  it("accepts only a callable toLaw port", () => {
    pipe(decodeUnknownIrToLawShapeResult({ toLaw: () => Effect.void }), Result.isSuccess, assertTrue);
    pipe(decodeUnknownIrToLawShapeResult({ toLaw: "not-a-function" }), Result.isFailure, assertTrue);
  });

  // Port outputs declare an Effect; the guard checks the runtime value only and
  // never runs it, so a non-effect is the one input it must reject.
  it("accepts only Effect values as a port output", () => {
    Effect.succeed(1).pipe(isCountOutput, assertTrue);
    Effect.fail("unavailable").pipe(isCountOutput, assertTrue);
    expect(isCountOutput(1)).toBe(false);
    expect(isCountOutput(globalThis.Promise.resolve(1))).toBe(false);
    expect(isCountOutput(undefined)).toBe(false);
  });

  it.effect("decodes and encodes a port output by reference", () =>
    Effect.gen(function* () {
      const program = Effect.succeed(1);
      expect(yield* decodeUnknownCountOutput(program)).toBe(program);
      expect(yield* encodeCountOutput(program)).toBe(program);
      const rejected = yield* Effect.exit(decodeUnknownCountOutput("not-an-effect"));
      expect(rejected._tag).toBe("Failure");
    })
  );

  it.effect("validates a port implementation's Effect output", () =>
    Effect.gen(function* () {
      expect(yield* increment(1)).toBe(2);
    })
  );
});
