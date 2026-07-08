import { IrToLawExtractionError, IrToLawExtractionErrorReason } from "@beep/law-practice-use-cases/IrToLaw";
import {
  OfficeActionExtractionLabel,
  OfficeActionReviewError,
  OfficeActionReviewInput,
} from "@beep/law-practice-use-cases/OfficeActionReview";
import { EntityInput } from "@beep/law-practice-use-cases/test";
import { assertSchemaArbitraryDecodesToSelf, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaEncodeDecodeRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema);
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
    assertSchemaEncodeDecodeRoundTrip(IrToLawExtractionError, { numRuns: 25 });
    assertSchemaEncodeDecodeRoundTrip(OfficeActionReviewError, { numRuns: 10 });
  });

  it("preserves the IrToLawExtractionError encoded wire shape", () => {
    const encode = S.encodeSync(IrToLawExtractionError);
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
    expect(encode(missing)).toStrictEqual({
      _tag: "IrToLawExtractionError",
      label: "claim",
      message: "Missing claim extraction.",
      reason: "required-extraction-missing",
    });
    expect(encode(unaligned)).toStrictEqual({
      _tag: "IrToLawExtractionError",
      alignmentStatus: "unaligned",
      label: "distinction",
      message: "The distinction could not be grounded.",
      reason: "required-extraction-unaligned",
    });
  });

  it("preserves the spike EntityInput encoded audit envelope", () => {
    const decoded = S.decodeUnknownSync(EntityInput)({
      createdAt: 1,
      createdByPrincipal: { component: "Runtime", kind: "System" },
      entityType: "LawPracticeClaim",
      id: 2,
      orgId: 1,
      rowVersion: 1,
      schemaVersion: "0.0.0",
      source: "System",
      updatedAt: 3,
      updatedByPrincipal: { component: "Runtime", kind: "System" },
    });

    expect(S.encodeSync(EntityInput)(decoded)).toStrictEqual({
      createdAt: 1,
      createdByPrincipal: {
        component: "Runtime",
        kind: "System",
      },
      entityType: "LawPracticeClaim",
      id: 2,
      orgId: 1,
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

    const encoded = S.encodeSync(OfficeActionReviewError)(error);

    expect(OfficeActionReviewError.is(error)).toBe(true);
    expect(O.isSome(OfficeActionReviewError.decodeOption(encoded))).toBe(true);
  });
});
