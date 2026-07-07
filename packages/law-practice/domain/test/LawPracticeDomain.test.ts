import {
  ApplicationNumber,
  Claim,
  ClaimNumber,
  Distinction,
  DistinctionDetail,
  KindCode,
  LawPracticeFixtureKey,
  LawPracticeText,
  LegalClient,
  LegalClientStatus,
  LegalContact,
  LegalContactRole,
  Matter,
  MatterType,
  OfficeAction,
  OfficeCode,
  PatentAsset,
  PatentAssetStatus,
  PatentDocumentTriplet,
  PatentNumber,
  PriorArtReference,
  Rejection,
  RejectionGround,
} from "@beep/law-practice-domain";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { assertSchemaArbitraryDecodesToSelf, baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaEncodedRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema, numRuns = 10): void => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => equivalent(decode(encode(value)), value)),
    { numRuns }
  );
};

describe("@beep/law-practice-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(LegalClientStatus.is.active_client("active_client")).toBe(true);
    expect(LegalClientStatus.fromUnknown("active_client")).toBe("active_client");
    expect(LegalClientStatus.decodeOption("active_client")._tag).toBe("Some");
    expect(LegalContactRole.is.founder("founder")).toBe(true);
    expect(LegalContactRole.fromUnknown("founder")).toBe("founder");
    expect(LegalContactRole.decodeOption("founder")._tag).toBe("Some");
    expect(MatterType.is.patent_application("patent_application")).toBe(true);
    expect(MatterType.fromUnknown("patent_application")).toBe("patent_application");
    expect(MatterType.decodeOption("patent_application")._tag).toBe("Some");
    expect(PatentAssetStatus.is.pre_filing("pre_filing")).toBe(true);
    expect(PatentAssetStatus.fromUnknown("pre_filing")).toBe("pre_filing");
    expect(PatentAssetStatus.decodeOption("pre_filing")._tag).toBe("Some");
    expect(RejectionGround.is({ referenceFixtureKey: "prior-art.smith", statute: "102" })).toBe(true);
    expect(DistinctionDetail.is({ kind: "missing_limitation", limitation: "a hinge" })).toBe(true);
  });

  it("validates law-practice entity field schemas", () => {
    expect(S.is(LawPracticeFixtureKey)("claim.1")).toBe(true);
    expect(S.is(LawPracticeFixtureKey)("")).toBe(false);
    expect(S.is(LawPracticeText)("A widget comprising a hinge.")).toBe(true);
    expect(S.is(LawPracticeText)("")).toBe(false);
    expect(S.is(ClaimNumber)(1)).toBe(true);
    expect(S.is(ClaimNumber)(0)).toBe(false);
  });

  it("validates WIPO patent application and publication identifiers", () => {
    expect(S.is(ApplicationNumber)("102014000345678")).toBe(true);
    expect(S.is(ApplicationNumber)("112015012345679")).toBe(true);
    expect(S.is(ApplicationNumber)("912014000345678")).toBe(true);
    expect(S.is(ApplicationNumber)("102014AB0345678")).toBe(true);
    expect(S.is(ApplicationNumber)("202016000004321")).toBe(false);
    expect(S.is(ApplicationNumber)("XX 10 2014 345678")).toBe(false);

    expect(S.is(PatentNumber)("1234567890123")).toBe(true);
    expect(S.is(PatentNumber)("12345678901234")).toBe(false);
    expect(S.is(PatentNumber)("US1234567B2")).toBe(false);

    expect(S.is(PatentDocumentTriplet)("US 7,654,321 B2")).toBe(true);
    expect(S.is(PatentDocumentTriplet)("EP 4,181,262 A1")).toBe(true);
    expect(S.is(PatentDocumentTriplet)("US 7654321 B2")).toBe(false);
    expect(S.is(PatentDocumentTriplet)("AA 7,654,321 B2")).toBe(false);
    expect(S.is(PatentDocumentTriplet)("US 7,654,321 A0")).toBe(false);

    expect(OfficeCode.is.US("US")).toBe(true);
    expect(OfficeCode.is.EP("EP")).toBe(true);
    expect(OfficeCode.is.XX("XX")).toBe(true);
    expect(S.is(OfficeCode)("AA")).toBe(false);

    expect(KindCode.is.A("A")).toBe(true);
    expect(KindCode.is.A1("A1")).toBe(true);
    expect(KindCode.is.B9("B9")).toBe(true);
    expect(S.is(KindCode)("A0")).toBe(false);
  });

  it("covers patent identifiers with schema-derived arbitraries", () => {
    fc.assert(
      fc.property(S.toArbitrary(PatentNumber), (patentNumber) => {
        expect(S.is(PatentNumber)(patentNumber)).toBe(true);
      }),
      { numRuns: 25 }
    );
  });

  it("round-trips schema-owned law-practice invariants through encoded form", () => {
    for (const schema of [
      LawPracticeFixtureKey,
      LawPracticeText,
      ClaimNumber,
      LegalClientStatus,
      LegalContactRole,
      MatterType,
      PatentAssetStatus,
      RejectionGround,
      DistinctionDetail,
    ]) {
      assertSchemaArbitraryDecodesToSelf(schema, { numRuns: 10 });
      assertSchemaEncodedRoundTrips(schema, 10);
    }
  });

  it("round-trips law-practice entity schemas through encoded form", () => {
    for (const schema of [
      LegalClient,
      LegalContact,
      Matter,
      PatentAsset,
      OfficeAction,
      Claim,
      PriorArtReference,
      Rejection,
      Distinction,
    ]) {
      assertSchemaEncodedRoundTrips(schema, 3);
    }
  });

  it("wires Matter to the law-practice BaseEntity identity", () => {
    expect(Matter.definition.entityId).toBe(LawPractice.MatterId);
    expect(Matter.definition.entityId.tableName).toBe("law_practice_matter");
    expect(Matter.definition.entityId.entityType).toBe("LawPracticeMatter");
    expect(Matter.definition.persisted.id.storageKind).toBe("entityId");
    expect(Matter.definition.persisted.matterType.storageKind).toBe("literal");
  });

  it("decodes and constructs a Matter row", () => {
    const input = {
      ...baseEntityFixtureInput("LawPracticeMatter", 5),
      displayName: "Patent Application",
      fixtureKey: "matter.patent",
      legalClientFixtureKey: "legal-client.acme",
      matterType: "patent_application",
    };
    const decoded = S.decodeUnknownSync(Matter)(input);
    const constructed = Matter.make(decoded);

    expect(decoded).toBeInstanceOf(Matter);
    expect(constructed).toBeInstanceOf(Matter);
    expect(constructed.entityType).toBe("LawPracticeMatter");
    expect(constructed.matterType).toBe("patent_application");
    expect(constructed.legalClientFixtureKey).toBe("legal-client.acme");
    expect(S.encodeSync(Matter)(decoded)).toStrictEqual(input);
  });

  it("decodes an OfficeAction row", () => {
    const input = {
      ...baseEntityFixtureInput("LawPracticeOfficeAction", 10),
      applicationNumber: "16/123,456",
      fixtureKey: "office-action.first",
      matterFixtureKey: "matter.patent",
      patentAssetFixtureKey: "patent-asset.widget",
    };
    const decoded = S.decodeUnknownSync(OfficeAction)(input);

    expect(decoded).toBeInstanceOf(OfficeAction);
    expect(decoded.entityType).toBe("LawPracticeOfficeAction");
    expect(decoded.matterFixtureKey).toBe("matter.patent");
    expect(S.encodeSync(OfficeAction)(decoded)).toStrictEqual(input);
  });

  it("decodes a Claim row", () => {
    const input = {
      ...baseEntityFixtureInput("LawPracticeClaim", 11),
      claimNumber: 1,
      fixtureKey: "claim.1",
      independent: true,
      patentAssetFixtureKey: "patent-asset.widget",
      text: "A widget comprising a hinge.",
    };
    const decoded = S.decodeUnknownSync(Claim)(input);

    expect(decoded).toBeInstanceOf(Claim);
    expect(decoded.claimNumber).toBe(1);
    expect(decoded.independent).toBe(true);
    expect(S.encodeSync(Claim)(decoded)).toStrictEqual(input);
  });

  it("decodes a PriorArtReference row", () => {
    const input = {
      ...baseEntityFixtureInput("LawPracticePriorArtReference", 12),
      documentNumber: "US 9,999,999 B2",
      fixtureKey: "prior-art.smith",
      officeActionFixtureKey: "office-action.first",
      title: "Foldable Widget",
    };
    const decoded = S.decodeUnknownSync(PriorArtReference)(input);

    expect(decoded).toBeInstanceOf(PriorArtReference);
    expect(decoded.documentNumber).toBe("US 9,999,999 B2");
    expect(S.encodeSync(PriorArtReference)(decoded)).toStrictEqual(input);
  });

  it("decodes a Rejection row with a §102 anticipation ground", () => {
    const input = {
      ...baseEntityFixtureInput("LawPracticeRejection", 13),
      claimFixtureKey: "claim.1",
      fixtureKey: "rejection-one-zero-two",
      ground: { referenceFixtureKey: "prior-art.smith", statute: "102" },
      officeActionFixtureKey: "office-action.first",
    };
    const decoded = S.decodeUnknownSync(Rejection)(input);

    expect(decoded).toBeInstanceOf(Rejection);
    expect(decoded.ground.statute).toBe("102");
    expect(S.encodeSync(Rejection)(decoded)).toStrictEqual(input);
  });

  it("decodes a Distinction row anchored to the source text", () => {
    const input = {
      ...baseEntityFixtureInput("LawPracticeDistinction", 14),
      anchor: { endChar: 14, quote: "a claimed fact", startChar: 0 },
      claimFixtureKey: "claim.1",
      detail: { kind: "missing_limitation", limitation: "a hinge coupling the lid to the base" },
      fixtureKey: "distinction.hinge",
      lifecycleState: "candidate",
      rejectionFixtureKey: "rejection-one-zero-two",
    };
    const decoded = S.decodeUnknownSync(Distinction)(input);

    expect(decoded).toBeInstanceOf(Distinction);
    expect(decoded.lifecycleState).toBe("candidate");
    expect(decoded.anchor.quote).toBe("a claimed fact");
    expect(S.encodeSync(Distinction)(decoded)).toStrictEqual(input);
  });

  it("keeps untouched entity wire fixtures byte-identical after decode", () => {
    const legalClientInput = {
      ...baseEntityFixtureInput("LawPracticeLegalClient", 20),
      displayName: "Acme Robotics",
      fixtureKey: "legal-client.acme",
      status: "active_client",
    };
    const legalContactInput = {
      ...baseEntityFixtureInput("LawPracticeLegalContact", 21),
      displayName: "Ada Founder",
      fixtureKey: "contact.ada",
      legalClientFixtureKey: "legal-client.acme",
      role: "founder",
    };
    const patentAssetInput = {
      ...baseEntityFixtureInput("LawPracticePatentAsset", 22),
      fixtureKey: "patent-asset.hinge",
      matterFixtureKey: "matter.hinge",
      status: "pre_filing",
      title: "Hinged lid assembly",
    };

    expect(S.encodeSync(LegalClient)(S.decodeUnknownSync(LegalClient)(legalClientInput))).toStrictEqual(
      legalClientInput
    );
    expect(S.encodeSync(LegalContact)(S.decodeUnknownSync(LegalContact)(legalContactInput))).toStrictEqual(
      legalContactInput
    );
    expect(S.encodeSync(PatentAsset)(S.decodeUnknownSync(PatentAsset)(patentAssetInput))).toStrictEqual(
      patentAssetInput
    );
  });
});
