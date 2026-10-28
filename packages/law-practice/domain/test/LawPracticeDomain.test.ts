import {
  ApplicationNumber,
  CandorDisposition,
  Citation,
  CitingApplicationIdentity,
  Claim,
  ClaimNumber,
  Distinction,
  DistinctionDetail,
  extractPatentFigures,
  extractPatentNumber,
  FullCitation,
  getKindCodeExplanation,
  getPatentDisplay,
  getStatusFromKindCode,
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
  OfficeAction,
  OfficeCode,
  PatentAsset,
  PatentAssetStatus,
  PatentCitationEvent,
  PatentDocumentTriplet,
  PatentNumber,
  PriorArtReference,
  parsePatentSections,
  Rejection,
  RejectionGround,
  ShortFormCitation,
  WipoSt13OfficeCode,
} from "@beep/law-practice-domain";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const decodeCitingApplicationIdentityOption = S.decodeOption(CitingApplicationIdentity);
const decodeUnknownCitingApplicationIdentityOption = S.decodeUnknownOption(CitingApplicationIdentity);
const decodeUnknownClaim = S.decodeUnknownEffect(Claim);
const decodeUnknownDistinction = S.decodeUnknownEffect(Distinction);
const decodeUnknownLegalClient = S.decodeUnknownEffect(LegalClient);
const decodeUnknownLegalContact = S.decodeUnknownEffect(LegalContact);
const decodeUnknownMatter = S.decodeUnknownEffect(Matter);
const decodeUnknownOfficeAction = S.decodeUnknownEffect(OfficeAction);
const decodeUnknownPatentAsset = S.decodeUnknownEffect(PatentAsset);
const decodeUnknownPriorArtReference = S.decodeUnknownEffect(PriorArtReference);
const decodeUnknownRejection = S.decodeUnknownEffect(Rejection);
const encodeClaim = S.encodeEffect(Claim);
const encodeDistinction = S.encodeEffect(Distinction);
const encodeLegalClient = S.encodeEffect(LegalClient);
const encodeLegalContact = S.encodeEffect(LegalContact);
const encodeMatter = S.encodeEffect(Matter);
const encodeOfficeAction = S.encodeEffect(OfficeAction);
const encodePatentAsset = S.encodeEffect(PatentAsset);
const encodePriorArtReference = S.encodeEffect(PriorArtReference);
const encodeRejection = S.encodeEffect(Rejection);
const isApplicationNumber = S.is(ApplicationNumber);
const isClaimNumber = S.is(ClaimNumber);
const isKindCode = S.is(KindCode);
const isLawPracticeFixtureKey = S.is(LawPracticeFixtureKey);
const isLawPracticeText = S.is(LawPracticeText);
const isOfficeCode = S.is(OfficeCode);
const isPatentDocumentTriplet = S.is(PatentDocumentTriplet);
const isPatentNumber = S.is(PatentNumber);
const isWipoSt13OfficeCode = S.is(WipoSt13OfficeCode);

const assertSchemaEncodedRoundTrip = Effect.fn("DomainTest.assertSchemaEncodedRoundTrip")(function* <
  Schema extends S.Codec<unknown>,
>(schema: Schema, value: Schema["Type"], label: string) {
  const decoded = yield* S.decodeUnknownEffect(schema)(yield* S.encodeEffect(schema)(value));
  expect(S.toEquivalence(schema)(decoded, value), label).toBe(true);
});
const assertSchemaDecodesToSelf = Effect.fn("DomainTest.assertSchemaDecodesToSelf")(function* <
  Schema extends S.Codec<unknown>,
>(schema: Schema, value: Schema["Type"], label: string) {
  const decoded = yield* S.decodeUnknownEffect(schema)(value);
  expect(S.is(schema)(value) && S.toEquivalence(schema)(decoded, value), label).toBe(true);
});

describe("@beep/law-practice-domain", () => {
  it("handles patent metadata helper defaults and representative values", () => {
    expect(getStatusFromKindCode()).toBe("unknown");
    expect(getStatusFromKindCode({ country: "WO" })).toBe("international");
    expect(getStatusFromKindCode({ country: "US", kindCode: O.some("B2") })).toBe("granted");
    assertNone(getKindCodeExplanation());
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
    assertSuccess(S.decodeResult(LegalClientStatus)("active_client"), "active_client");
    expect(S.decodeOption(LegalClientStatus)("active_client")._tag).toBe("Some");
    expect(LegalContactRole.is.founder("founder")).toBe(true);
    assertSuccess(S.decodeResult(LegalContactRole)("founder"), "founder");
    expect(S.decodeOption(LegalContactRole)("founder")._tag).toBe("Some");
    expect(MatterType.is.patent_application("patent_application")).toBe(true);
    assertSuccess(S.decodeResult(MatterType)("patent_application"), "patent_application");
    expect(S.decodeOption(MatterType)("patent_application")._tag).toBe("Some");
    expect(PatentAssetStatus.is.pre_filing("pre_filing")).toBe(true);
    assertSuccess(S.decodeResult(PatentAssetStatus)("pre_filing"), "pre_filing");
    expect(S.decodeOption(PatentAssetStatus)("pre_filing")._tag).toBe("Some");
    expect(S.is(RejectionGround)({ referenceFixtureKey: "prior-art.smith", statute: "102" })).toBe(true);
    expect(S.is(DistinctionDetail)({ kind: "missing_limitation", limitation: "a hinge" })).toBe(true);
  });

  it("validates law-practice entity field schemas", () => {
    expect(isLawPracticeFixtureKey("claim.1")).toBe(true);
    expect(isLawPracticeFixtureKey("")).toBe(false);
    expect(isLawPracticeText("A widget comprising a hinge.")).toBe(true);
    expect(isLawPracticeText("")).toBe(false);
    expect(isClaimNumber(1)).toBe(true);
    expect(isClaimNumber(0)).toBe(false);
  });

  it("validates WIPO patent application and publication identifiers", () => {
    expect(isApplicationNumber("102014000345678")).toBe(true);
    expect(isApplicationNumber("112015012345679")).toBe(true);
    expect(isApplicationNumber("912014000345678")).toBe(true);
    expect(isApplicationNumber("102014AB0345678")).toBe(true);
    expect(isApplicationNumber("202016000004321")).toBe(false);
    expect(isApplicationNumber("XX 10 2014 345678")).toBe(false);

    expect(isPatentNumber("1234567890123")).toBe(true);
    expect(isPatentNumber("12345678901234")).toBe(false);
    expect(isPatentNumber("US1234567B2")).toBe(false);

    expect(isPatentDocumentTriplet("US 7,654,321 B2")).toBe(true);
    expect(isPatentDocumentTriplet("EP 4,181,262 A1")).toBe(true);
    expect(isPatentDocumentTriplet("US 7654321 B2")).toBe(false);
    expect(isPatentDocumentTriplet("AA 7,654,321 B2")).toBe(false);
    expect(isPatentDocumentTriplet("US 7,654,321 A0")).toBe(false);

    expect(OfficeCode.is.US("US")).toBe(true);
    expect(OfficeCode.is.EP("EP")).toBe(true);
    expect(OfficeCode.is.XX("XX")).toBe(true);
    expect(isOfficeCode("AA")).toBe(false);
    expect(isWipoSt13OfficeCode("EP")).toBe(true);
    expect(isWipoSt13OfficeCode("US")).toBe(false);
    expect(isWipoSt13OfficeCode("XX")).toBe(false);
    expect(WipoSt13OfficeCode.is.EP("EP")).toBe(true);
    expect("US" in WipoSt13OfficeCode.is).toBe(false);
    expect("XX" in WipoSt13OfficeCode.is).toBe(false);
    pipe(
      decodeCitingApplicationIdentityOption({
        applicationNumber: "102014000345678",
        kind: "WipoSt13",
        officeCode: "EP",
      }),
      O.isSome,
      assertTrue
    );
    assertNone(
      decodeUnknownCitingApplicationIdentityOption({
        applicationNumber: "102018000138242",
        kind: "WipoSt13",
        officeCode: "US",
      })
    );
    assertNone(
      decodeUnknownCitingApplicationIdentityOption({
        applicationNumber: "102014000345678",
        kind: "WipoSt13",
      })
    );

    expect(KindCode.is.A("A")).toBe(true);
    expect(KindCode.is.A1("A1")).toBe(true);
    expect(KindCode.is.B9("B9")).toBe(true);
    expect(isKindCode("A0")).toBe(false);
  });

  it.prop(
    "covers patent identifiers with schema-derived arbitraries",
    [PatentNumber],
    ([patentNumber]) => {
      expect(isPatentNumber(patentNumber)).toBe(true);
    },
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips schema-owned law-practice invariants through encoded form",
    {
      LawPracticeFixtureKey: Arbitrary.schema(LawPracticeFixtureKey),
      LawPracticeFixtureKeySelf: Arbitrary.schema(LawPracticeFixtureKey),
      LawPracticeText: Arbitrary.schema(LawPracticeText),
      LawPracticeTextSelf: Arbitrary.schema(LawPracticeText),
      ClaimNumber: Arbitrary.schema(ClaimNumber),
      ClaimNumberSelf: Arbitrary.schema(ClaimNumber),
      LegalClientStatus: Arbitrary.schema(LegalClientStatus),
      LegalClientStatusSelf: Arbitrary.schema(LegalClientStatus),
      LegalContactRole: Arbitrary.schema(LegalContactRole),
      LegalContactRoleSelf: Arbitrary.schema(LegalContactRole),
      MatterType: Arbitrary.schema(MatterType),
      MatterTypeSelf: Arbitrary.schema(MatterType),
      PatentAssetStatus: Arbitrary.schema(PatentAssetStatus),
      PatentAssetStatusSelf: Arbitrary.schema(PatentAssetStatus),
      RejectionGround: Arbitrary.schema(RejectionGround),
      RejectionGroundSelf: Arbitrary.schema(RejectionGround),
      DistinctionDetail: Arbitrary.schema(DistinctionDetail),
      DistinctionDetailSelf: Arbitrary.schema(DistinctionDetail),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaEncodedRoundTrip(
          LawPracticeFixtureKey,
          values.LawPracticeFixtureKey,
          "LawPracticeFixtureKey"
        );
        yield* assertSchemaDecodesToSelf(
          LawPracticeFixtureKey,
          values.LawPracticeFixtureKeySelf,
          "LawPracticeFixtureKey decode to self"
        );
        yield* assertSchemaEncodedRoundTrip(LawPracticeText, values.LawPracticeText, "LawPracticeText");
        yield* assertSchemaDecodesToSelf(LawPracticeText, values.LawPracticeTextSelf, "LawPracticeText decode to self");
        yield* assertSchemaEncodedRoundTrip(ClaimNumber, values.ClaimNumber, "ClaimNumber");
        yield* assertSchemaDecodesToSelf(ClaimNumber, values.ClaimNumberSelf, "ClaimNumber decode to self");
        yield* assertSchemaEncodedRoundTrip(LegalClientStatus, values.LegalClientStatus, "LegalClientStatus");
        yield* assertSchemaDecodesToSelf(
          LegalClientStatus,
          values.LegalClientStatusSelf,
          "LegalClientStatus decode to self"
        );
        yield* assertSchemaEncodedRoundTrip(LegalContactRole, values.LegalContactRole, "LegalContactRole");
        yield* assertSchemaDecodesToSelf(
          LegalContactRole,
          values.LegalContactRoleSelf,
          "LegalContactRole decode to self"
        );
        yield* assertSchemaEncodedRoundTrip(MatterType, values.MatterType, "MatterType");
        yield* assertSchemaDecodesToSelf(MatterType, values.MatterTypeSelf, "MatterType decode to self");
        yield* assertSchemaEncodedRoundTrip(PatentAssetStatus, values.PatentAssetStatus, "PatentAssetStatus");
        yield* assertSchemaDecodesToSelf(
          PatentAssetStatus,
          values.PatentAssetStatusSelf,
          "PatentAssetStatus decode to self"
        );
        yield* assertSchemaEncodedRoundTrip(RejectionGround, values.RejectionGround, "RejectionGround");
        yield* assertSchemaDecodesToSelf(RejectionGround, values.RejectionGroundSelf, "RejectionGround decode to self");
        yield* assertSchemaEncodedRoundTrip(DistinctionDetail, values.DistinctionDetail, "DistinctionDetail");
        yield* assertSchemaDecodesToSelf(
          DistinctionDetail,
          values.DistinctionDetailSelf,
          "DistinctionDetail decode to self"
        );
      }),
    { arbitrary: fcRuns(10) }
  );

  it.effect.prop(
    "round-trips law-practice entity schemas through encoded form",
    {
      LegalClient: Arbitrary.schema(LegalClient),
      LegalContact: Arbitrary.schema(LegalContact),
      Matter: Arbitrary.schema(Matter),
      PatentAsset: Arbitrary.schema(PatentAsset),
      OfficeAction: Arbitrary.schema(OfficeAction),
      Claim: Arbitrary.schema(Claim),
      PriorArtReference: Arbitrary.schema(PriorArtReference),
      Rejection: Arbitrary.schema(Rejection),
      Distinction: Arbitrary.schema(Distinction),
      PatentCitationEvent: Arbitrary.schema(PatentCitationEvent),
      CandorDisposition: Arbitrary.schema(CandorDisposition),
      IdsSubmissionFact: Arbitrary.schema(IdsSubmissionFact),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaEncodedRoundTrip(LegalClient, values.LegalClient, "LegalClient");
        yield* assertSchemaEncodedRoundTrip(LegalContact, values.LegalContact, "LegalContact");
        yield* assertSchemaEncodedRoundTrip(Matter, values.Matter, "Matter");
        yield* assertSchemaEncodedRoundTrip(PatentAsset, values.PatentAsset, "PatentAsset");
        yield* assertSchemaEncodedRoundTrip(OfficeAction, values.OfficeAction, "OfficeAction");
        yield* assertSchemaEncodedRoundTrip(Claim, values.Claim, "Claim");
        yield* assertSchemaEncodedRoundTrip(PriorArtReference, values.PriorArtReference, "PriorArtReference");
        yield* assertSchemaEncodedRoundTrip(Rejection, values.Rejection, "Rejection");
        yield* assertSchemaEncodedRoundTrip(Distinction, values.Distinction, "Distinction");
        yield* assertSchemaEncodedRoundTrip(PatentCitationEvent, values.PatentCitationEvent, "PatentCitationEvent");
        yield* assertSchemaEncodedRoundTrip(CandorDisposition, values.CandorDisposition, "CandorDisposition");
        yield* assertSchemaEncodedRoundTrip(IdsSubmissionFact, values.IdsSubmissionFact, "IdsSubmissionFact");
      }),
    { arbitrary: fcRuns(3) }
  );

  it("keeps the WIPO ST.13 office set equal to every ST.3 office except US and XX", () => {
    // WipoSt13OfficeCode spells its complement out as an explicit pick; this
    // fails when OfficeCode gains a code the pick does not list.
    const expected = HashSet.fromIterable(
      A.filter(OfficeCode.literals, (code) => !OfficeCode.is.US(code) && !OfficeCode.is.XX(code))
    );
    const actual = HashSet.fromIterable(WipoSt13OfficeCode.literals);

    expect(HashSet.size(actual)).toBe(WipoSt13OfficeCode.literals.length);
    assertTrue(Equal.equals(actual, expected));
  });

  it("wires Matter to the law-practice product-entity identity", () => {
    expect(Matter.sql.tableName).toBe(LawPractice.MatterId.tableName);
    expect(LawPractice.MatterId.entityType).toBe("LawPracticeMatter");
    expect(R.keys(Matter.insert.fields)).not.toContain("id");
    expect(R.keys(Matter.insert.fields)).toContain("rowVersion");
    expect(R.keys(Matter.update.fields)).toContain("id");
    expect(R.keys(Matter.update.fields)).toContain("rowVersion");
    expect(R.keys(Matter.jsonCreate.fields)).toEqual([
      "displayName",
      "fixtureKey",
      "legalClientFixtureKey",
      "matterType",
    ]);
    expect(R.keys(Matter.jsonUpdate.fields)).toEqual([
      "rowVersion",
      "displayName",
      "fixtureKey",
      "legalClientFixtureKey",
      "matterType",
    ]);
  });

  it.effect(
    "decodes and constructs a Matter row",
    Effect.fnUntraced(function* () {
      const input = {
        ...productEntityFixtureInput("LawPracticeMatter", 5),
        deletedAt: null,
        deletedByPrincipal: null,
        displayName: "Patent Application",
        fixtureKey: "matter.patent",
        legalClientFixtureKey: "legal-client.acme",
        matterType: "patent_application",
      };
      const decoded = yield* decodeUnknownMatter(input);
      const constructed = Matter.make(decoded);

      expect(decoded).toBeInstanceOf(Matter);
      expect(constructed).toBeInstanceOf(Matter);
      expect(constructed.entityType).toBe("LawPracticeMatter");
      expect(constructed.matterType).toBe("patent_application");
      expect(constructed.legalClientFixtureKey).toBe("legal-client.acme");
      expect(yield* encodeMatter(decoded)).toStrictEqual(input);
    })
  );

  it.effect(
    "decodes an OfficeAction row",
    Effect.fnUntraced(function* () {
      const input = {
        ...productEntityFixtureInput("LawPracticeOfficeAction", 10),
        deletedAt: null,
        deletedByPrincipal: null,
        applicationNumber: "16/123,456",
        fixtureKey: "office-action.first",
        matterFixtureKey: "matter.patent",
        patentAssetFixtureKey: "patent-asset.widget",
      };
      const decoded = yield* decodeUnknownOfficeAction(input);

      expect(decoded).toBeInstanceOf(OfficeAction);
      expect(decoded.entityType).toBe("LawPracticeOfficeAction");
      expect(decoded.matterFixtureKey).toBe("matter.patent");
      expect(yield* encodeOfficeAction(decoded)).toStrictEqual(input);
    })
  );

  it.effect(
    "decodes a Claim row",
    Effect.fnUntraced(function* () {
      const input = {
        ...productEntityFixtureInput("LawPracticeClaim", 11),
        deletedAt: null,
        deletedByPrincipal: null,
        claimNumber: 1,
        fixtureKey: "claim.1",
        independent: true,
        patentAssetFixtureKey: "patent-asset.widget",
        text: "A widget comprising a hinge.",
      };
      const decoded = yield* decodeUnknownClaim(input);

      expect(decoded).toBeInstanceOf(Claim);
      expect(decoded.claimNumber).toBe(1);
      expect(decoded.independent).toBe(true);
      expect(yield* encodeClaim(decoded)).toStrictEqual(input);
    })
  );

  it.effect(
    "decodes a PriorArtReference row",
    Effect.fnUntraced(function* () {
      const input = {
        ...productEntityFixtureInput("LawPracticePriorArtReference", 12),
        deletedAt: null,
        deletedByPrincipal: null,
        documentNumber: "US 9,999,999 B2",
        fixtureKey: "prior-art.smith",
        officeActionFixtureKey: "office-action.first",
        title: "Foldable Widget",
      };
      const decoded = yield* decodeUnknownPriorArtReference(input);

      expect(decoded).toBeInstanceOf(PriorArtReference);
      expect(decoded.documentNumber).toBe("US 9,999,999 B2");
      expect(yield* encodePriorArtReference(decoded)).toStrictEqual(input);
    })
  );

  it.effect(
    "decodes a Rejection row with a §102 anticipation ground",
    Effect.fnUntraced(function* () {
      const input = {
        ...productEntityFixtureInput("LawPracticeRejection", 13),
        deletedAt: null,
        deletedByPrincipal: null,
        claimFixtureKey: "claim.1",
        fixtureKey: "rejection-one-zero-two",
        ground: { referenceFixtureKey: "prior-art.smith", statute: "102" },
        officeActionFixtureKey: "office-action.first",
      };
      const decoded = yield* decodeUnknownRejection(input);

      expect(decoded).toBeInstanceOf(Rejection);
      expect(decoded.ground.statute).toBe("102");
      expect(yield* encodeRejection(decoded)).toStrictEqual(input);
    })
  );

  it.effect(
    "decodes a Distinction row anchored to the source text",
    Effect.fnUntraced(function* () {
      const input = {
        ...productEntityFixtureInput("LawPracticeDistinction", 14),
        deletedAt: null,
        deletedByPrincipal: null,
        anchor: { endChar: 14, quote: "a claimed fact", startChar: 0 },
        claimFixtureKey: "claim.1",
        detail: { kind: "missing_limitation", limitation: "a hinge coupling the lid to the base" },
        fixtureKey: "distinction.hinge",
        lifecycleState: "candidate",
        rejectionFixtureKey: "rejection-one-zero-two",
      };
      const decoded = yield* decodeUnknownDistinction(input);

      expect(decoded).toBeInstanceOf(Distinction);
      expect(decoded.lifecycleState).toBe("candidate");
      expect(decoded.anchor.quote).toBe("a claimed fact");
      expect(yield* encodeDistinction(decoded)).toStrictEqual(input);
    })
  );

  it.effect(
    "keeps untouched entity wire fixtures byte-identical after decode",
    Effect.fnUntraced(function* () {
      const legalClientInput = {
        ...productEntityFixtureInput("LawPracticeLegalClient", 20),
        deletedAt: null,
        deletedByPrincipal: null,
        displayName: "Acme Robotics",
        fixtureKey: "legal-client.acme",
        status: "active_client",
      };
      const legalContactInput = {
        ...productEntityFixtureInput("LawPracticeLegalContact", 21),
        deletedAt: null,
        deletedByPrincipal: null,
        displayName: "Ada Founder",
        fixtureKey: "contact.ada",
        legalClientFixtureKey: "legal-client.acme",
        role: "founder",
      };
      const patentAssetInput = {
        ...productEntityFixtureInput("LawPracticePatentAsset", 22),
        deletedAt: null,
        deletedByPrincipal: null,
        fixtureKey: "patent-asset.hinge",
        matterFixtureKey: "matter.hinge",
        status: "pre_filing",
        title: "Hinged lid assembly",
      };

      expect(yield* encodeLegalClient(yield* decodeUnknownLegalClient(legalClientInput))).toStrictEqual(
        legalClientInput
      );
      expect(yield* encodeLegalContact(yield* decodeUnknownLegalContact(legalContactInput))).toStrictEqual(
        legalContactInput
      );
      expect(yield* encodePatentAsset(yield* decodeUnknownPatentAsset(patentAssetInput))).toStrictEqual(
        patentAssetInput
      );
    })
  );

  it.effect.prop(
    "round-trips the citation unions via schema-derived arbitraries",
    {
      Citation: Arbitrary.schema(Citation),
      FullCitation: Arbitrary.schema(FullCitation),
      ShortFormCitation: Arbitrary.schema(ShortFormCitation),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertSchemaEncodedRoundTrip(Citation, values.Citation, "Citation");
        const encoded: R.ReadonlyRecord<string, unknown> = yield* S.encodeEffect(Citation)(values.Citation);
        for (const field of [
          "id",
          "text",
          "span",
          "matchedText",
          "processTimeMs",
          "patternsChecked",
          "warnings",
          "confidence",
          "footnote",
          "group",
        ]) {
          expect(R.has(encoded, field)).toBe(false);
        }
        yield* assertSchemaEncodedRoundTrip(FullCitation, values.FullCitation, "FullCitation");
        yield* assertSchemaEncodedRoundTrip(ShortFormCitation, values.ShortFormCitation, "ShortFormCitation");
      }),
    { arbitrary: fcRuns(5) }
  );
});
