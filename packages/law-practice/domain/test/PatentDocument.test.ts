import {
  inspectPatentClaimDependencies,
  normalizePatentApplicationDocument,
  PatentApplicationDocument,
  PatentApplicationSection,
  PatentApplicationSectionRole,
  PatentApplicationSections,
  PatentClaim,
  PatentClaims,
} from "@beep/law-practice-domain/values/PatentDocument";
import { Md } from "@beep/md";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const patentFixture = Md.make([
  Md.h1("TITLE OF THE INVENTION"),
  Md.p("Optical sensor alert system"),
  Md.h1("CROSS-REFERENCE TO RELATED APPLICATIONS"),
  Md.p("Not applicable."),
  Md.h1("STATEMENT REGARDING FEDERALLY SPONSORED RESEARCH OR DEVELOPMENT"),
  Md.p("Not applicable."),
  Md.h1("NAMES OF THE PARTIES TO A JOINT RESEARCH AGREEMENT"),
  Md.p("Not applicable."),
  Md.h1("INCORPORATION BY REFERENCE"),
  Md.p("Not applicable."),
  Md.h1("STATEMENT REGARDING PRIOR DISCLOSURES BY THE INVENTOR OR A JOINT INVENTOR"),
  Md.p("Not applicable."),
  Md.h1("BACKGROUND OF THE INVENTION"),
  Md.p("Optical sensors may detect changes in ambient light."),
  Md.h1("BRIEF SUMMARY OF THE INVENTION"),
  Md.p("A processor emits an alert in response to an optical sensor."),
  Md.h1("BRIEF DESCRIPTION OF THE DRAWINGS"),
  Md.p("Figure 1 depicts the sensor system."),
  Md.h1("DETAILED DESCRIPTION OF THE INVENTION"),
  Md.p("The optical sensor communicates with the processor."),
  Md.h2("Example implementation"),
  Md.p("The processor may emit an audible alert."),
  Md.h1("CLAIMS"),
  Md.p("1. A sensor system comprising an optical sensor and a processor."),
  Md.p("2. The sensor system of claim 1, wherein the optical sensor detects light."),
  Md.p("3. The sensor system of claim 2, wherein the processor emits an alert."),
  Md.h1("ABSTRACT"),
  Md.p("An optical sensor alert system is disclosed."),
  Md.h1("SEQUENCE LISTING"),
  Md.p("Not applicable."),
]);

const independentClaim = (claimNumber: number) =>
  PatentClaim.cases.independent.make({
    body: "a sensor",
    claimNumber: PosInt.make(claimNumber),
    claimText: "A system comprising a sensor.",
    preamble: "A system",
    transition: "comprising",
  });

const dependentClaim = (claimNumber: number, parentClaimNumber: number) =>
  PatentClaim.cases.dependent.make({
    body: "the sensor is optical",
    claimNumber: PosInt.make(claimNumber),
    claimReferences: [PosInt.make(parentClaimNumber)],
    claimText: `The system of claim ${parentClaimNumber}, wherein the sensor is optical.`,
    preamble: `The system of claim ${parentClaimNumber},`,
    transition: "wherein",
  });

describe("PatentDocument", () => {
  it("round-trips schema-derived patent application sections", () => {
    const arbitrary = S.toArbitrary(PatentApplicationSection)(fc);
    const decode = S.decodeUnknownSync(PatentApplicationSection);
    const encode = S.encodeSync(PatentApplicationSection);
    const equivalent = S.toEquivalence(PatentApplicationSection);

    fc.assert(
      fc.property(arbitrary, (section) => equivalent(decode(encode(section)), section)),
      { numRuns: 20 }
    );
  });

  it.effect(
    "normalizes one Markdown fixture into ordered sections and structured claims",
    Effect.fnUntraced(function* () {
      const document = yield* normalizePatentApplicationDocument(patentFixture);

      expect(A.map(document.sections, ({ role }) => role)).toStrictEqual(PatentApplicationSectionRole.Options);
      expect(document.sections).toHaveLength(13);
      expect(document.claims).toHaveLength(3);
      expect(document.claims[0]).toMatchObject({
        body: "an optical sensor and a processor.",
        claimNumber: 1,
        claimType: "independent",
        preamble: "A sensor system",
        transition: "comprising",
      });
      expect(document.claims[1]).toMatchObject({
        body: "the optical sensor detects light.",
        claimNumber: 2,
        claimReferences: [1],
        claimType: "dependent",
        preamble: "The sensor system of claim 1,",
        transition: "wherein",
      });
      expect(document.sections[9]?.content).toContain("Example implementation");
    })
  );

  it.effect(
    "preserves ordered-list ordinals, multiline bodies, normative headings, ranges, and the actual transition",
    Effect.fnUntraced(function* () {
      const orderedClaims = Md.make([
        Md.h1("TITLE OF THE INVENTION"),
        Md.p("Group membership method"),
        Md.h1("A CLAIM OR CLAIMS"),
        Md.ol([
          "A method for including a user in a group, the method\ncomprising receiving membership data.",
          "The method of claim 1, wherein the membership data is stored.",
          "The method of claim 2, wherein the stored data is encrypted.",
          "The method of claims 1 through 3, wherein an audit record is emitted.",
        ]),
        Md.h1("ABSTRACT OF THE DISCLOSURE"),
        Md.p("A group membership method is disclosed."),
      ]);
      const singularClaim = Md.make([
        Md.h1("TITLE OF THE INVENTION"),
        Md.p("Sensor"),
        Md.h1("CLAIM"),
        Md.p("1. A sensor comprising a detector."),
      ]);

      const document = yield* normalizePatentApplicationDocument(orderedClaims);
      const singularDocument = yield* normalizePatentApplicationDocument(singularClaim);

      expect(document.claims).toHaveLength(4);
      expect(document.claims[0]).toMatchObject({
        body: "receiving membership data.",
        preamble: "A method for including a user in a group, the method",
        transition: "comprising",
      });
      expect(document.claims[3]).toMatchObject({
        claimReferences: [1, 2, 3],
        claimType: "dependent",
      });
      expect(document.sourceText).toContain("1. A method for including a user in a group");
      expect(A.map(document.sections, ({ role }) => role)).toStrictEqual(["title-of-invention", "claims", "abstract"]);
      expect(singularDocument.sections[1]?.role).toBe("claims");
    })
  );

  it("rejects duplicate and out-of-order application sections", () => {
    const title = PatentApplicationSection.make({
      content: "Sensor system",
      heading: "TITLE OF THE INVENTION",
      role: "title-of-invention",
      sourceEnd: NonNegativeInt.make(36),
      sourceStart: NonNegativeInt.make(23),
    });
    const background = PatentApplicationSection.make({
      content: "Sensor background",
      heading: "BACKGROUND",
      role: "background",
      sourceEnd: NonNegativeInt.make(65),
      sourceStart: NonNegativeInt.make(48),
    });
    const rejectedOrder = S.decodeResult(PatentApplicationSections)([background, title]);
    const rejectedDuplicate = S.decodeResult(PatentApplicationSections)([title, title]);

    expect(Result.isFailure(rejectedOrder)).toBe(true);
    expect(Result.isFailure(rejectedDuplicate)).toBe(true);
  });

  it("reports missing, forward, self, and cyclic dependency defects", () => {
    const claims = [dependentClaim(1, 2), dependentClaim(2, 1)];
    const duplicateClaims = [independentClaim(1), independentClaim(1)];
    const nonconsecutiveClaims = [independentClaim(2)];
    const missingParentClaims = [independentClaim(1), dependentClaim(2, 9)];
    const selfReferentialClaims = [dependentClaim(1, 1)];
    const issueKinds = A.map(inspectPatentClaimDependencies(claims), ({ kind }) => kind);

    expect(issueKinds).toContain("forward-reference");
    expect(issueKinds).toContain("cycle");
    expect(S.is(PatentClaims)(claims)).toBe(false);
    expect(A.map(inspectPatentClaimDependencies(missingParentClaims), ({ kind }) => kind)).toContain("missing-parent");
    expect(A.map(inspectPatentClaimDependencies(selfReferentialClaims), ({ kind }) => kind)).toContain(
      "self-reference"
    );
    expect(S.is(PatentClaims)(duplicateClaims)).toBe(false);
    expect(S.is(PatentClaims)(nonconsecutiveClaims)).toBe(false);
    expect(S.is(PatentClaims)(missingParentClaims)).toBe(false);
    expect(S.is(PatentClaims)(selfReferentialClaims)).toBe(false);
  });

  it("rejects documents without a claims section or aligned claim text", () => {
    const title = PatentApplicationSection.make({
      content: "Sensor system",
      heading: "TITLE OF THE INVENTION",
      role: "title-of-invention",
      sourceEnd: NonNegativeInt.make(13),
      sourceStart: NonNegativeInt.make(0),
    });
    const claims = PatentApplicationSection.make({
      content: "1. A system comprising a sensor.",
      heading: "CLAIMS",
      role: "claims",
      sourceEnd: NonNegativeInt.make(40),
      sourceStart: NonNegativeInt.make(7),
    });
    const claim = independentClaim(1);

    expect(
      Result.isFailure(
        S.decodeResult(PatentApplicationDocument)({
          claims: [claim],
          sections: [title],
          sourceText: claim.claimText,
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        S.decodeResult(PatentApplicationDocument)({
          claims: [claim],
          sections: [claims],
          sourceText: "CLAIMS\n1. A different system comprising a detector.",
        })
      )
    ).toBe(true);
  });

  it.effect(
    "covers each fail-closed normalization boundary",
    Effect.fnUntraced(function* () {
      const includingDocument = yield* normalizePatentApplicationDocument(
        Md.make([Md.p(""), Md.h1("CLAIMS"), Md.p("1. A sensor including an optical detector.")])
      );
      expect(includingDocument.claims[0]?.transition).toBe("including");

      const failures = yield* Effect.forEach(
        [
          Md.make([Md.h1("CLAIMS"), Md.p("The applicant claims a sensor.")]),
          Md.make([Md.h1("CLAIMS"), Md.p("1. comprising a sensor.")]),
          Md.make([Md.h1("CLAIMS"), Md.p("1. A sensor comprising")]),
          Md.make([Md.h1("CLAIMS"), Md.p("0. A sensor comprising a detector.")]),
          Md.make([
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
            Md.p("2. The sensor of claims none, wherein the detector is optical."),
          ]),
          Md.make([
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
            Md.p("2. The sensor of claims 3 through 1, wherein the detector is optical."),
          ]),
          Md.make([
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
            Md.p("2. The sensor of claims 1 through 1000000000, wherein the detector is optical."),
          ]),
          Md.make([
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
            Md.p(
              `2. The sensor of ${A.join(
                A.makeBy(1025, () => "claim 1"),
                " "
              )}, wherein the detector is optical.`
            ),
          ]),
          Md.make([
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
            Md.p("2. The sensor of claim 2, wherein the detector is optical."),
          ]),
          Md.make([
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
            Md.p("3. The sensor of claim 1, wherein the detector is optical."),
          ]),
          Md.make([Md.h1("TITLE OF THE INVENTION"), Md.h1("CLAIMS"), Md.p("1. A sensor comprising a detector.")]),
          Md.make([Md.h1("TITLE OF THE INVENTION"), Md.p("Sensor")]),
          Md.make([
            Md.h1("BACKGROUND"),
            Md.p("Sensor background"),
            Md.h1("TITLE OF THE INVENTION"),
            Md.p("Sensor"),
            Md.h1("CLAIMS"),
            Md.p("1. A sensor comprising a detector."),
          ]),
        ],
        (document) => Effect.flip(normalizePatentApplicationDocument(document)),
        { concurrency: 1 }
      );

      expect(A.map(failures, ({ reason }) => reason)).toStrictEqual([
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "invalid-claim",
        "empty-section",
        "missing-claims-section",
        "invalid-document",
      ]);
    })
  );

  it.effect(
    "fails closed on unknown headings and malformed claim transitions",
    Effect.fnUntraced(function* () {
      const unknownHeading = Md.make([Md.h1("APPENDIX"), Md.p("Unrecognized material")]);
      const malformedClaim = Md.make([
        Md.h1("TITLE OF THE INVENTION"),
        Md.p("Sensor system"),
        Md.h1("CLAIMS"),
        Md.p("1. A sensor system uses an optical sensor."),
      ]);

      const unknownExit = yield* Effect.exit(normalizePatentApplicationDocument(unknownHeading));
      const malformedExit = yield* Effect.exit(normalizePatentApplicationDocument(malformedClaim));

      expect(Exit.isFailure(unknownExit)).toBe(true);
      expect(Exit.isFailure(malformedExit)).toBe(true);
    })
  );
});
