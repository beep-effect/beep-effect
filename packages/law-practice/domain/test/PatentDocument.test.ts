import {
  inspectPatentClaimDependencies,
  normalizePatentApplicationDocument,
  PatentApplicationSection,
  PatentApplicationSectionRole,
  PatentApplicationSections,
  PatentClaim,
  PatentClaims,
} from "@beep/law-practice-domain/values/PatentDocument";
import { Md } from "@beep/md";
import { PosInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

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

  it("rejects duplicate and out-of-order application sections", () => {
    const title = PatentApplicationSection.make({
      content: "Sensor system",
      heading: "TITLE OF THE INVENTION",
      role: "title-of-invention",
    });
    const background = PatentApplicationSection.make({
      content: "Sensor background",
      heading: "BACKGROUND",
      role: "background",
    });
    const rejectedOrder = S.decodeResult(PatentApplicationSections)([background, title]);
    const rejectedDuplicate = S.decodeResult(PatentApplicationSections)([title, title]);

    expect(Result.isFailure(rejectedOrder)).toBe(true);
    expect(Result.isFailure(rejectedDuplicate)).toBe(true);
  });

  it("reports missing, forward, self, and cyclic dependency defects", () => {
    const claims = [dependentClaim(1, 2), dependentClaim(2, 1)];
    const issueKinds = A.map(inspectPatentClaimDependencies(claims), ({ kind }) => kind);

    expect(issueKinds).toContain("forward-reference");
    expect(issueKinds).toContain("cycle");
    expect(S.is(PatentClaims)(claims)).toBe(false);
    expect(
      A.map(inspectPatentClaimDependencies([independentClaim(1), dependentClaim(2, 9)]), ({ kind }) => kind)
    ).toContain("missing-parent");
    expect(A.map(inspectPatentClaimDependencies([dependentClaim(1, 1)]), ({ kind }) => kind)).toContain(
      "self-reference"
    );
  });

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
