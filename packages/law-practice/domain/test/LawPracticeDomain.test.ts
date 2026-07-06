import {
  ApplicationNumber,
  Claim,
  Distinction,
  KindCode,
  LegalClientStatus,
  LegalContactRole,
  Matter,
  MatterType,
  OfficeAction,
  OfficeCode,
  PatentAssetStatus,
  PatentDocumentTriplet,
  PatentNumber,
  PriorArtReference,
  Rejection,
} from "@beep/law-practice-domain";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("@beep/law-practice-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(LegalClientStatus.is.active_client("active_client")).toBe(true);
    expect(LegalContactRole.is.founder("founder")).toBe(true);
    expect(MatterType.is.patent_application("patent_application")).toBe(true);
    expect(PatentAssetStatus.is.pre_filing("pre_filing")).toBe(true);
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

  it("wires Matter to the law-practice BaseEntity identity", () => {
    expect(Matter.definition.entityId).toBe(LawPractice.MatterId);
    expect(Matter.definition.entityId.tableName).toBe("law_practice_matter");
    expect(Matter.definition.entityId.entityType).toBe("LawPracticeMatter");
    expect(Matter.definition.persisted.id.storageKind).toBe("entityId");
    expect(Matter.definition.persisted.matterType.storageKind).toBe("literal");
  });

  it("decodes and constructs a Matter row", () => {
    const decoded = S.decodeUnknownSync(Matter)({
      ...baseEntityFixtureInput("LawPracticeMatter", 5),
      displayName: "Patent Application",
      fixtureKey: "matter.patent",
      legalClientFixtureKey: "legal-client.acme",
      matterType: "patent_application",
    });
    const constructed = Matter.make(decoded);

    expect(decoded).toBeInstanceOf(Matter);
    expect(constructed).toBeInstanceOf(Matter);
    expect(constructed.entityType).toBe("LawPracticeMatter");
    expect(constructed.matterType).toBe("patent_application");
    expect(constructed.legalClientFixtureKey).toBe("legal-client.acme");
  });

  it("decodes an OfficeAction row", () => {
    const decoded = S.decodeUnknownSync(OfficeAction)({
      ...baseEntityFixtureInput("LawPracticeOfficeAction", 10),
      applicationNumber: "16/123,456",
      fixtureKey: "office-action.first",
      matterFixtureKey: "matter.patent",
      patentAssetFixtureKey: "patent-asset.widget",
    });

    expect(decoded).toBeInstanceOf(OfficeAction);
    expect(decoded.entityType).toBe("LawPracticeOfficeAction");
    expect(decoded.matterFixtureKey).toBe("matter.patent");
  });

  it("decodes a Claim row", () => {
    const decoded = S.decodeUnknownSync(Claim)({
      ...baseEntityFixtureInput("LawPracticeClaim", 11),
      claimNumber: 1,
      fixtureKey: "claim.1",
      independent: true,
      patentAssetFixtureKey: "patent-asset.widget",
      text: "A widget comprising a hinge.",
    });

    expect(decoded).toBeInstanceOf(Claim);
    expect(decoded.claimNumber).toBe(1);
    expect(decoded.independent).toBe(true);
  });

  it("decodes a PriorArtReference row", () => {
    const decoded = S.decodeUnknownSync(PriorArtReference)({
      ...baseEntityFixtureInput("LawPracticePriorArtReference", 12),
      documentNumber: "US 9,999,999 B2",
      fixtureKey: "prior-art.smith",
      officeActionFixtureKey: "office-action.first",
      title: "Foldable Widget",
    });

    expect(decoded).toBeInstanceOf(PriorArtReference);
    expect(decoded.documentNumber).toBe("US 9,999,999 B2");
  });

  it("decodes a Rejection row with a §102 anticipation ground", () => {
    const decoded = S.decodeUnknownSync(Rejection)({
      ...baseEntityFixtureInput("LawPracticeRejection", 13),
      claimFixtureKey: "claim.1",
      fixtureKey: "rejection-one-zero-two",
      ground: { referenceFixtureKey: "prior-art.smith", statute: "102" },
      officeActionFixtureKey: "office-action.first",
    });

    expect(decoded).toBeInstanceOf(Rejection);
    expect(decoded.ground.statute).toBe("102");
  });

  it("decodes a Distinction row anchored to the source text", () => {
    const decoded = S.decodeUnknownSync(Distinction)({
      ...baseEntityFixtureInput("LawPracticeDistinction", 14),
      anchor: { endChar: 14, quote: "a claimed fact", startChar: 0 },
      claimFixtureKey: "claim.1",
      detail: { kind: "missing_limitation", limitation: "a hinge coupling the lid to the base" },
      fixtureKey: "distinction.hinge",
      lifecycleState: "candidate",
      rejectionFixtureKey: "rejection-one-zero-two",
    });

    expect(decoded).toBeInstanceOf(Distinction);
    expect(decoded.lifecycleState).toBe("candidate");
    expect(decoded.anchor.quote).toBe("a claimed fact");
  });
});
