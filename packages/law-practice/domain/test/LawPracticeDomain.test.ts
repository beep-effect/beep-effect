import {
  ApplicationNumber,
  CandorDisposition,
  Citation,
  CitationBase,
  CitationWarning,
  CitingApplicationIdentity,
  Claim,
  ClaimNumber,
  ContextOptions,
  Distinction,
  DistinctionDetail,
  DocketCitation,
  DurableLocatorOptions,
  extractPatentFigures,
  extractPatentNumber,
  FullCaseCitation,
  FullCitation,
  getKindCodeExplanation,
  getPatentDisplay,
  getStatusFromKindCode,
  IdCitation,
  IdsSubmissionFact,
  KindCode,
  LawPracticeFixtureKey,
  LawPracticeText,
  LegalClient,
  LegalClientStatus,
  LegalContact,
  LegalContactRole,
  Matter,
  MatterType,
  NeutralCitation,
  OfficeAction,
  OfficeCode,
  Parenthetical,
  PatentAsset,
  PatentAssetStatus,
  PatentCitationEvent,
  PatentDocumentTriplet,
  PatentNumber,
  PinciteInfo,
  PriorArtReference,
  parsePatentSections,
  RegulationCitation,
  Rejection,
  RejectionGround,
  ResolutionResult,
  ShortFormCaseCitation,
  ShortFormCitation,
  Span,
  StatuteCitation,
  StatutesAtLargeCitation,
  SubsequentHistoryEntry,
  SupraCitation,
  WarningPosition,
  WipoSt13OfficeCode,
} from "@beep/law-practice-domain";
import { NonNegativeInt } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { assertSchemaArbitraryDecodesToSelf, baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaEncodedRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema, numRuns = 10): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => equivalent(decode(encode(value)), value)),
    { numRuns }
  );
};

const span = (end: number) =>
  Span.make({
    cleanStart: NonNegativeInt.make(0),
    cleanEnd: NonNegativeInt.make(end),
    originalStart: NonNegativeInt.make(0),
    originalEnd: NonNegativeInt.make(end),
  });

const citationBaseInput = (text: string) => ({
  text,
  span: span(text.length),
  confidence: 1,
  matchedText: text,
  processTimeMs: 0,
  patternsChecked: NonNegativeInt.make(1),
});

const citationBaseWire = (text: string) => ({
  text,
  span: { cleanStart: 0, cleanEnd: text.length, originalStart: 0, originalEnd: text.length },
  confidence: 1,
  matchedText: text,
  processTimeMs: 0,
  patternsChecked: 1,
});

describe("@beep/law-practice-domain", () => {
  it("handles patent metadata helper defaults and representative values", () => {
    expect(getStatusFromKindCode()).toBe("unknown");
    expect(getStatusFromKindCode({ country: "WO" })).toBe("international");
    expect(getStatusFromKindCode({ country: "US", kindCode: O.some("B2") })).toBe("granted");
    expect(O.isNone(getKindCodeExplanation())).toBe(true);
    expect(O.getOrThrow(getKindCodeExplanation({ country: "EP", kindCode: "A1" }))).toContain("European");

    const display = getPatentDisplay({
      metadata: { country: "US", kind_code: "B2", patent_number: "7654321" },
    });
    expect(display.formatted).toBe("US 7,654,321 B2");
    expect(getPatentDisplay().status).toBe("unknown");
    expect(extractPatentFigures()).toEqual([]);
    expect(extractPatentFigures({ imageUrls: { figure1: "https://example.com/patents/figure-1.png" } })).toHaveLength(
      1
    );

    const content = "## Abstract\nA compact tool.\n\n## Claims\n1. A tool.";
    const sections = parsePatentSections({ content, requestedSections: ["abstract", "claims"] });
    expect(O.getOrThrow(sections.abstract)).toContain("A compact tool.");
    expect(O.getOrThrow(sections.claims)).toBe("1. A tool.");
    expect(extractPatentNumber({ content: "**Patent Number:** US 7,654,321 B2" })).toBe("US 7654321 B2");
  });

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
    expect(S.is(WipoSt13OfficeCode)("EP")).toBe(true);
    expect(S.is(WipoSt13OfficeCode)("US")).toBe(false);
    expect(
      O.isSome(
        S.decodeUnknownOption(CitingApplicationIdentity)({
          applicationNumber: "102014000345678",
          kind: "WipoSt13",
          officeCode: "EP",
        })
      )
    ).toBe(true);
    expect(
      O.isNone(
        S.decodeUnknownOption(CitingApplicationIdentity)({
          applicationNumber: "102018000138242",
          kind: "WipoSt13",
          officeCode: "US",
        })
      )
    ).toBe(true);
    expect(
      O.isNone(
        S.decodeUnknownOption(CitingApplicationIdentity)({
          applicationNumber: "102014000345678",
          kind: "WipoSt13",
        })
      )
    ).toBe(true);

    expect(KindCode.is.A("A")).toBe(true);
    expect(KindCode.is.A1("A1")).toBe(true);
    expect(KindCode.is.B9("B9")).toBe(true);
    expect(S.is(KindCode)("A0")).toBe(false);
  });

  it("covers patent identifiers with schema-derived arbitraries", () => {
    fc.assert(
      fc.property(S.toArbitrary(PatentNumber)(fc), (patentNumber) => {
        expect(S.is(PatentNumber)(patentNumber)).toBe(true);
      }),
      fcRuns(25)
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
      PatentCitationEvent,
      CandorDisposition,
      IdsSubmissionFact,
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

  it("constructs citation values with schema-owned definitive defaults", () => {
    const base = CitationBase.make(citationBaseInput("base"));
    const fullCase = FullCaseCitation.make({
      ...citationBaseInput("410 U.S. 113"),
      volume: NonNegativeInt.make(410),
      reporter: "U.S.",
    });
    const id = IdCitation.make(citationBaseInput("Id."));
    const supra = SupraCitation.make(citationBaseInput("Smith, supra"));
    const shortForm = ShortFormCaseCitation.make({
      ...citationBaseInput("410 U.S. at 120"),
      volume: NonNegativeInt.make(410),
      reporter: "U.S.",
    });
    const neutral = NeutralCitation.make({
      ...citationBaseInput("2023 IL 128749"),
      year: NonNegativeInt.make(2023),
      documentNumber: "128749",
    });
    const statute = StatuteCitation.make(citationBaseInput("28 U.S.C. § 1331"));
    const regulation = RegulationCitation.make(citationBaseInput("42 C.F.R. § 405.1"));
    const statutesAtLarge = StatutesAtLargeCitation.make({
      ...citationBaseInput("100 Stat. 3743"),
      volume: NonNegativeInt.make(100),
      page: NonNegativeInt.make(3743),
    });
    const parenthetical = Parenthetical.make({ text: "holding that X requires Y", type: "holding" });
    const pincite = PinciteInfo.make({ isRange: false, raw: "570" });
    const resolution = ResolutionResult.make({ confidence: 1 });
    const context = ContextOptions.make({});
    const locator = DurableLocatorOptions.make({});

    expect(base.warnings).toStrictEqual([]);
    expect(fullCase.unpublished).toBe(false);
    expect(fullCase.hasBlankPage).toBe(false);
    expect(fullCase.parentheticals).toStrictEqual([]);
    expect(fullCase.subsequentHistoryEntries).toStrictEqual([]);
    expect(fullCase.justices).toStrictEqual([]);
    expect(id.pinciteInherited).toBe(false);
    expect(supra.pinciteInherited).toBe(false);
    expect(shortForm.pinciteInherited).toBe(false);
    expect(neutral.unpublished).toBe(false);
    expect(statute.hasEtSeq).toBe(false);
    expect(regulation.hasEtSeq).toBe(false);
    expect(statutesAtLarge.pinciteIsRange).toBe(false);
    expect(parenthetical.citations).toStrictEqual([]);
    expect(pincite.starPage).toBe(false);
    expect(pincite.additionalPincites).toStrictEqual([]);
    expect(resolution.warnings).toStrictEqual([]);
    expect(context.type).toBe("sentence");
    expect(O.isNone(context.maxLength)).toBe(true);
    expect(locator.space).toBe("original");
    expect(locator.fullSpan).toBe(false);
    expect(locator.contextLength).toBe(32);
  });

  it("decodes sparse citation values and materializes definitive defaults when encoded", () => {
    const baseWire = citationBaseWire("citation");
    const base = S.decodeSync(CitationBase)(baseWire);
    const fullCase = S.decodeSync(FullCaseCitation)({
      ...baseWire,
      type: "case",
      volume: 410,
      reporter: "U.S.",
    });
    const id = S.decodeSync(IdCitation)({ ...baseWire, type: "id" });
    const supra = S.decodeSync(SupraCitation)({ ...baseWire, type: "supra" });
    const shortForm = S.decodeSync(ShortFormCaseCitation)({
      ...baseWire,
      type: "shortFormCase",
      volume: 410,
      reporter: "U.S.",
    });
    const neutral = S.decodeSync(NeutralCitation)({
      ...baseWire,
      type: "neutral",
      year: 2023,
      documentNumber: "128749",
    });
    const statute = S.decodeSync(StatuteCitation)({ ...baseWire, type: "statute" });
    const regulation = S.decodeSync(RegulationCitation)({ ...baseWire, type: "regulation" });
    const statutesAtLarge = S.decodeSync(StatutesAtLargeCitation)({
      ...baseWire,
      type: "statutesAtLarge",
      volume: 100,
      page: 3743,
    });
    const parenthetical = S.decodeSync(Parenthetical)({ text: "holding", type: "holding" });
    const pincite = S.decodeSync(PinciteInfo)({ isRange: false, raw: "570" });
    const resolution = S.decodeSync(ResolutionResult)({ confidence: 1 });
    const context = S.decodeSync(ContextOptions)({});
    const locator = S.decodeSync(DurableLocatorOptions)({});

    expect(S.encodeSync(CitationBase)(base).warnings).toStrictEqual([]);
    expect(S.encodeSync(FullCaseCitation)(fullCase)).toMatchObject({
      unpublished: false,
      hasBlankPage: false,
      parentheticals: [],
      subsequentHistoryEntries: [],
      justices: [],
    });
    expect(S.encodeSync(IdCitation)(id).pinciteInherited).toBe(false);
    expect(S.encodeSync(SupraCitation)(supra).pinciteInherited).toBe(false);
    expect(S.encodeSync(ShortFormCaseCitation)(shortForm).pinciteInherited).toBe(false);
    expect(S.encodeSync(NeutralCitation)(neutral).unpublished).toBe(false);
    expect(S.encodeSync(StatuteCitation)(statute).hasEtSeq).toBe(false);
    expect(S.encodeSync(RegulationCitation)(regulation).hasEtSeq).toBe(false);
    expect(S.encodeSync(StatutesAtLargeCitation)(statutesAtLarge).pinciteIsRange).toBe(false);
    expect(S.encodeSync(Parenthetical)(parenthetical).citations).toStrictEqual([]);
    expect(S.encodeSync(PinciteInfo)(pincite)).toMatchObject({
      starPage: false,
      additionalPincites: [],
    });
    expect(S.encodeSync(ResolutionResult)(resolution).warnings).toStrictEqual([]);
    expect(S.encodeSync(ContextOptions)(context).type).toBe("sentence");
    expect(S.encodeSync(DurableLocatorOptions)(locator)).toMatchObject({
      space: "original",
      fullSpan: false,
      contextLength: 32,
    });
  });

  it("preserves explicit nondefault citation values", () => {
    const warning = CitationWarning.make({
      level: "warning",
      message: "Ambiguous reporter",
      position: WarningPosition.make({ start: 0, end: 3 }),
    });
    const childCitation = FullCaseCitation.make({
      ...citationBaseInput("100 F.2d 1"),
      volume: NonNegativeInt.make(100),
      reporter: "F.2d",
    });
    const parenthetical = Parenthetical.make({
      text: "quoting 100 F.2d 1",
      type: "quoting",
      citations: [childCitation],
    });
    const history = SubsequentHistoryEntry.make({
      signal: "affirmed",
      rawSignal: "aff'd",
      signalSpan: span(5),
      order: NonNegativeInt.make(0),
    });
    const extraPincite = PinciteInfo.make({
      page: O.some(NonNegativeInt.make(580)),
      isRange: false,
      raw: "580",
    });

    const base = CitationBase.make({
      ...citationBaseInput("base"),
      warnings: [warning],
    });
    const fullCase = FullCaseCitation.make({
      ...citationBaseInput("410 U.S. ___"),
      volume: NonNegativeInt.make(410),
      reporter: "U.S.",
      unpublished: true,
      hasBlankPage: true,
      parentheticals: [parenthetical],
      subsequentHistoryEntries: [history],
      justices: ["Brennan"],
    });
    const id = IdCitation.make({ ...citationBaseInput("Id."), pinciteInherited: true });
    const supra = SupraCitation.make({ ...citationBaseInput("Smith, supra"), pinciteInherited: true });
    const shortForm = ShortFormCaseCitation.make({
      ...citationBaseInput("410 U.S. at 120"),
      volume: NonNegativeInt.make(410),
      reporter: "U.S.",
      pinciteInherited: true,
    });
    const neutral = NeutralCitation.make({
      ...citationBaseInput("2023 IL 128749-U"),
      year: NonNegativeInt.make(2023),
      documentNumber: "128749",
      unpublished: true,
    });
    const statute = StatuteCitation.make({
      ...citationBaseInput("28 U.S.C. § 1331 et seq."),
      hasEtSeq: true,
    });
    const regulation = RegulationCitation.make({
      ...citationBaseInput("42 C.F.R. § 405.1 et seq."),
      hasEtSeq: true,
    });
    const statutesAtLarge = StatutesAtLargeCitation.make({
      ...citationBaseInput("100 Stat. 3743, 3755-58"),
      volume: NonNegativeInt.make(100),
      page: NonNegativeInt.make(3743),
      pinciteIsRange: true,
    });
    const pincite = PinciteInfo.make({
      isRange: false,
      raw: "*2, 580",
      starPage: true,
      additionalPincites: [extraPincite],
    });
    const resolution = ResolutionResult.make({ confidence: 0.5, warnings: ["Multiple antecedents"] });
    const context = ContextOptions.make({
      type: "paragraph",
      maxLength: O.some(NonNegativeInt.make(1000)),
    });
    const locator = DurableLocatorOptions.make({
      space: "clean",
      fullSpan: true,
      contextLength: NonNegativeInt.make(64),
    });

    expect(base.warnings).toStrictEqual([warning]);
    expect(fullCase.unpublished).toBe(true);
    expect(fullCase.hasBlankPage).toBe(true);
    expect(fullCase.parentheticals).toStrictEqual([parenthetical]);
    expect(fullCase.subsequentHistoryEntries).toStrictEqual([history]);
    expect(fullCase.justices).toStrictEqual(["Brennan"]);
    expect(id.pinciteInherited).toBe(true);
    expect(supra.pinciteInherited).toBe(true);
    expect(shortForm.pinciteInherited).toBe(true);
    expect(neutral.unpublished).toBe(true);
    expect(statute.hasEtSeq).toBe(true);
    expect(regulation.hasEtSeq).toBe(true);
    expect(statutesAtLarge.pinciteIsRange).toBe(true);
    expect(parenthetical.citations).toStrictEqual([childCitation]);
    expect(pincite.starPage).toBe(true);
    expect(pincite.additionalPincites).toStrictEqual([extraPincite]);
    expect(resolution.warnings).toStrictEqual(["Multiple antecedents"]);
    expect(context.type).toBe("paragraph");
    expect(context.maxLength).toStrictEqual(O.some(NonNegativeInt.make(1000)));
    expect(locator.space).toBe("clean");
    expect(locator.fullSpan).toBe(true);
    expect(locator.contextLength).toBe(64);
  });

  it("formats full case citation option values without leaking Option representations", () => {
    const citation = FullCaseCitation.make({
      ...citationBaseInput("Smith v. Jones, 410 U.S. 113, 120 (2d Cir. 2020)"),
      volume: NonNegativeInt.make(410),
      reporter: "U.S.",
      page: O.some(NonNegativeInt.make(113)),
      pincite: O.some(NonNegativeInt.make(120)),
      court: O.some("Second Circuit"),
      normalizedCourt: O.some("2d Cir."),
      year: O.some(NonNegativeInt.make(2020)),
      caseName: O.some("Smith v. Jones"),
    });

    expect(FullCaseCitation.toBlueBook(citation)).toBe("Smith v. Jones, 410 U.S. 113, 120 (2d Cir. 2020)");

    const rawCourtCitation = FullCaseCitation.make({
      ...citationBaseInput("410 U.S. 113 (D. Mass. 2021)"),
      volume: NonNegativeInt.make(410),
      reporter: "U.S.",
      page: O.some(NonNegativeInt.make(113)),
      court: O.some("D. Mass."),
      year: O.some(NonNegativeInt.make(2021)),
    });

    expect(FullCaseCitation.toBlueBook(rawCourtCitation)).toBe("410 U.S. 113 (D. Mass. 2021)");
  });

  it("round-trips leaf citation value schemas through encoded form", () => {
    for (const schema of [StatuteCitation, RegulationCitation, DocketCitation]) {
      assertSchemaEncodedRoundTrips(schema, 10);
    }
  });

  it("round-trips the recursive citation unions via schema-derived arbitraries", () => {
    for (const schema of [Citation, FullCitation, ShortFormCitation]) {
      assertSchemaEncodedRoundTrips(schema, 5);
    }
  });

  it("decodes and re-encodes a mutually-recursive Citation nesting", () => {
    const leaf = (volume: number, reporter: string, text: string) => ({
      type: "case" as const,
      text,
      span: { cleanStart: 0, cleanEnd: text.length, originalStart: 0, originalEnd: text.length },
      confidence: 1,
      matchedText: text,
      processTimeMs: 0,
      patternsChecked: 1,
      volume,
      reporter,
    });

    // case -> parentheticals -> case -> parentheticals -> case (three recursion levels)
    const wire = {
      ...leaf(410, "U.S.", "410 U.S. 113"),
      parentheticals: [
        {
          text: "quoting Doe v. City, 100 F.2d 1 (citing Roe, 200 F.2d 2)",
          type: "quoting",
          citations: [
            {
              ...leaf(100, "F.2d", "100 F.2d 1"),
              parentheticals: [
                { text: "citing Roe, 200 F.2d 2", type: "citing", citations: [leaf(200, "F.2d", "200 F.2d 2")] },
              ],
            },
          ],
        },
      ],
    };

    const decoded = S.decodeUnknownSync(Citation)(wire);
    expect(decoded.type).toBe("case");
    if (decoded.type !== "case") return;

    const level1 = O.getOrThrow(A.head(decoded.parentheticals));
    expect(level1.type).toBe("quoting");
    const child = O.getOrThrow(A.head(level1.citations));
    expect(child.type).toBe("case");
    if (child.type !== "case") return;

    const childParenthetical = O.getOrThrow(A.head(child.parentheticals));
    const grandchild = O.getOrThrow(A.head(childParenthetical.citations));
    expect(grandchild.type).toBe("case");
    if (grandchild.type !== "case") return;
    expect(grandchild.reporter).toBe("F.2d");

    // encode -> decode is identity across the S.suspend recursion knot
    const equivalent = S.toEquivalence(Citation);
    expect(equivalent(S.decodeSync(Citation)(S.encodeSync(Citation)(decoded)), decoded)).toBe(true);
  });
});
