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
import { EntityInput } from "@beep/law-practice-use-cases/test";
import { assertSchemaArbitraryDecodesToSelf, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeEntityInputSync = S.decodeSync(EntityInput);
const decodeUnknownIrToLawShapeResult = S.decodeUnknownResult(IrToLawShape);
const encodeEntityInputSync = S.encodeSync(EntityInput);
const encodeIrToLawExtractionErrorSync = S.encodeSync(IrToLawExtractionError);
const encodeOfficeActionReviewErrorSync = S.encodeSync(OfficeActionReviewError);

const assertSchemaEncodeDecodeRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => equivalent(decode(encode(value)), value)),
    fcRuns(options?.numRuns ?? 50)
  );
};

describe("@beep/law-practice-use-cases schema parity", () => {
  it("round-trips schema-derived values through their source schemas", () => {
    assertSchemaArbitraryDecodesToSelf(OfficeActionExtractionLabel, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(IrToLawExtractionErrorReason, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(OfficeActionReviewInput, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(EntityInput, { numRuns: 25 });
    assertSchemaArbitraryDecodesToSelf(PracticeKgCandidateClaimToolRow, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PracticeKgDocumentToolRow, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PracticeKgEmailToolRow, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PracticeKgFamilyToolRow, { numRuns: 10 });
    assertSchemaArbitraryDecodesToSelf(PracticeKgGraphToolRow, { numRuns: 10 });
    assertSchemaEncodeDecodeRoundTrip(IrToLawExtractionError, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(OfficeActionReviewError, { numRuns: 10 });
  });

  it("composes the nine-tool practice KG surface with a typed claims not-loaded branch", () => {
    const notLoaded = PracticeKgCandidateClaimsNotLoadedResult.make({
      available: false,
      bundle_version: "fixture-1",
      epistemic_status: "candidate-unreviewed",
      reason: "claims batch not yet loaded",
    });

    expect(Object.keys(PracticeKgToolkit.tools)).toHaveLength(9);
    expect(PracticeKgCandidateClaimsResult.is(notLoaded)).toBe(true);
  });

  it("preserves the IrToLawExtractionError encoded wire shape", () => {
    const missing = IrToLawExtractionError.fromReason("required-extraction-missing", {
      label: "claim",
      message: "Missing claim extraction.",
    });
    const unaligned = IrToLawExtractionError.fromReason("required-extraction-unaligned", {
      alignmentStatus: "unaligned",
      label: "distinction",
      message: "The distinction could not be grounded.",
    });

    expect(O.isNone(missing.alignmentStatus)).toBe(true);
    expect(encodeIrToLawExtractionErrorSync(missing)).toStrictEqual({
      _tag: "IrToLawExtractionError",
      label: "claim",
      message: "Missing claim extraction.",
      reason: "required-extraction-missing",
    });
    expect(encodeIrToLawExtractionErrorSync(unaligned)).toStrictEqual({
      _tag: "IrToLawExtractionError",
      alignmentStatus: "unaligned",
      label: "distinction",
      message: "The distinction could not be grounded.",
      reason: "required-extraction-unaligned",
    });
  });

  it("preserves the spike EntityInput encoded audit envelope", () => {
    const decoded = decodeEntityInputSync({
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

    expect(encodeEntityInputSync(decoded)).toStrictEqual({
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
  });

  it("uses OfficeActionReviewError codec statics for boundary error guards", () => {
    const error = IrToLawExtractionError.fromReason("required-extraction-unaligned", {
      alignmentStatus: "unaligned",
      label: "distinction",
      message: "The distinction could not be grounded.",
    });

    const encoded = encodeOfficeActionReviewErrorSync(error);

    expect(OfficeActionReviewError.is(error)).toBe(true);
    expect(O.isSome(OfficeActionReviewError.decodeUnknownOption(encoded))).toBe(true);
  });

  // `toLaw` is a declared schema whose guard is the only thing standing between
  // the port and a non-callable value, so both branches are asserted here.
  it("accepts only a callable toLaw port", () => {
    expect(Result.isSuccess(decodeUnknownIrToLawShapeResult({ toLaw: () => Effect.void }))).toBe(true);
    expect(Result.isFailure(decodeUnknownIrToLawShapeResult({ toLaw: "not-a-function" }))).toBe(true);
  });
});
