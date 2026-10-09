import { GroundedExtraction } from "@beep/langextract/Extraction";
import {
  DocStructureDocument,
  DocStructureRuleFamily,
  OfficeActionFinalityCandidate,
  OfficeActionRecognizedPair,
  recognizeOfficeActionPair,
  ShortenedStatutoryPeriodCandidate,
} from "@beep/law-practice-domain";
import {
  makeOfficeActionStructure,
  OfficeActionStructureInput,
} from "@beep/law-practice-use-cases/OfficeActionStructure";
import { SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/provenance/VerifiedTextAnchor";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixtureInventory, fixtureOcrPage, fixtureSource, readFixture, TestCrypto } from "./officeActionFixtures.ts";
import type { Fixture } from "./fixtures/office-action-structure/Fixture.schema.ts";

const structure = makeOfficeActionStructure();
const document = DocStructureDocument.make({
  documentId: "fixture",
  sourceVersion: "1",
  modality: "public-form-language",
});

const verifyOracle = (fixture: Fixture, text: string) => {
  if (fixture.evaluationLane === "oracle-upstream") {
    const oracle = recognizeOfficeActionPair(text, fixture.modality);
    expect(oracle.status).toBe(fixture.outcome.status);
    if (oracle.status === "recognized" && fixture.outcome.status === "recognized") {
      expect(oracle.finalityAnchor.quote).toBe(fixture.outcome.finalityQuote);
      expect(oracle.periodAnchor.quote).toBe(fixture.outcome.periodQuote);
    } else if (oracle.status === "abstained" && fixture.outcome.status === "abstained")
      expect(oracle.code).toBe(fixture.outcome.code);
  }
};

const verifyRecognized = Effect.fn("OfficeActionStructureTest.verifyRecognized")(function* (
  fixture: Fixture,
  text: string,
  input: OfficeActionStructureInput,
  outcome: OfficeActionRecognizedPair
) {
  if (fixture.outcome.status !== "recognized") return yield* Effect.die("Expected recognized fixture label");
  const verifiedSource = input.verifiedSource;
  expect(outcome.candidates).toHaveLength(2);
  expect(outcome.candidates[0].finality).toBe(fixture.outcome.finality);
  expect(outcome.candidates[0].anchor.anchor.quote).toBe(fixture.outcome.finalityQuote);
  expect(outcome.candidates[1].anchor.anchor.quote).toBe(fixture.outcome.periodQuote);
  for (const candidate of outcome.candidates) {
    const anchor = candidate.anchor.anchor;
    expect(Str.slice(anchor.startChar, anchor.endChar)(text)).toBe(anchor.quote);
    expect(candidate.source).toEqual(verifiedSource.source);
    expect(candidate.confidence).toBe(0.95);
  }
  const extractions = A.map(outcome.candidates, (candidate) =>
    GroundedExtraction.cases.match_exact.make({
      label: candidate._tag === "OfficeActionFinalityCandidate" ? "action-finality" : "shortened-statutory-period",
      text: candidate.anchor.anchor.quote,
      matchedText: candidate.anchor.anchor.quote,
      span: { start: candidate.anchor.anchor.startChar, end: candidate.anchor.anchor.endChar },
    })
  );
  const adapted = yield* structure.fromExtractions(input, extractions);
  expect(adapted.status).toBe("recognized");
});

it.layer(TestCrypto, { timeout: "10 seconds" })("office-action exact paired extraction", (it) => {
  it.effect("proves complete denominators and closed outcomes through the grounded adapter", () =>
    Effect.gen(function* () {
      const fixtures = yield* fixtureInventory;
      let recognized = 0;
      let closed = 0;
      for (const fixture of fixtures) {
        const text = yield* readFixture(`${fixture.id}.txt`);
        const { verifiedSource } = yield* fixtureSource(text);
        const input = OfficeActionStructureInput.make({
          document: DocStructureDocument.make({ ...document, modality: fixture.modality }),
          verifiedSource,
        });
        verifyOracle(fixture, text);
        const outcome = yield* structure.extract(input);
        expect(outcome.status).toBe(fixture.outcome.status);
        if (outcome.status === "abstained" && fixture.outcome.status === "abstained") {
          expect(outcome.code).toBe(fixture.outcome.code);
          expect("candidates" in outcome).toBe(false);
          closed++;
        } else if (outcome.status === "recognized" && fixture.outcome.status === "recognized") {
          yield* verifyRecognized(fixture, text, input, outcome);
          recognized++;
        }
      }
      expect({ recognized, closed }).toEqual({ recognized: 16, closed: 18 });
    })
  );
  it.effect("keeps malformed and mismatched anchor failures atomic", () =>
    Effect.gen(function* () {
      const text = yield* readFixture("oa-001.txt");
      const { verifiedSource } = yield* fixtureSource(text);
      const input = OfficeActionStructureInput.make({ document, verifiedSource });
      const raw = recognizeOfficeActionPair(text, "public-form-language");
      expect(raw.status).toBe("recognized");
      if (raw.status !== "recognized") return;
      const candidate = (label: string, anchor: typeof raw.finalityAnchor, quote = anchor.quote) =>
        GroundedExtraction.cases.match_exact.make({
          label,
          text: quote,
          matchedText: quote,
          span: { start: anchor.startChar, end: anchor.endChar },
        });
      const period = candidate("shortened-statutory-period", raw.periodAnchor);
      const finality = candidate("action-finality", raw.finalityAnchor);
      expect((yield* structure.fromExtractions(input, [period, period]).pipe(Effect.flip)).reason).toBe(
        "invalid-anchor"
      );
      expect((yield* structure.fromExtractions(input, [finality, finality]).pipe(Effect.flip)).reason).toBe(
        "invalid-anchor"
      );
      const fuzzy = (label: string, anchor: typeof raw.finalityAnchor) =>
        GroundedExtraction.cases.match_fuzzy.make({
          label,
          text: anchor.quote,
          matchedText: anchor.quote,
          span: { start: anchor.startChar, end: anchor.endChar },
        });
      expect(
        yield* structure.fromExtractions(input, [fuzzy("action-finality", raw.finalityAnchor), period])
      ).toMatchObject({ code: "rule-not-covered" });
      expect(
        yield* structure.fromExtractions(input, [finality, fuzzy("shortened-statutory-period", raw.periodAnchor)])
      ).toMatchObject({ code: "rule-not-covered" });
      const invalidPeriod = GroundedExtraction.cases.match_exact.make({
        label: "shortened-statutory-period",
        text: raw.periodAnchor.quote,
        matchedText: raw.periodAnchor.quote,
        span: { start: raw.periodAnchor.startChar, end: raw.periodAnchor.startChar },
      });
      expect((yield* structure.fromExtractions(input, [finality, invalidPeriod]).pipe(Effect.flip)).reason).toBe(
        "invalid-anchor"
      );
      const otherQuote = "A";
      const other = GroundedExtraction.cases.match_exact.make({
        label: "action-finality",
        text: otherQuote,
        matchedText: otherQuote,
        span: {
          start: S.Natural.make(Str.indexOf("A")(text).pipe(O.getOrElse(() => 0))),
          end: S.Natural.make(Str.indexOf("A")(text).pipe(O.getOrElse(() => 0)) + 1),
        },
      });
      expect(yield* structure.fromExtractions(input, [other, period])).toMatchObject({ code: "rule-not-covered" });
      const otherPeriod = GroundedExtraction.cases.match_exact.make({ ...other, label: "shortened-statutory-period" });
      expect(yield* structure.fromExtractions(input, [finality, otherPeriod])).toMatchObject({
        code: "rule-not-covered",
      });

      const encodedFinality = yield* S.encodeEffect(GroundedExtraction.cases.match_exact)(
        candidate("action-finality", raw.finalityAnchor)
      );
      const reversed = yield* S.decodeEffect(GroundedExtraction)({
        ...encodedFinality,
        alignmentStatus: "match_exact",
        span: { start: raw.finalityAnchor.endChar, end: raw.finalityAnchor.startChar },
      }).pipe(Effect.flip);
      expect(reversed._tag).toBe("SchemaError");
      const mismatched = yield* structure
        .fromExtractions(input, [
          candidate("action-finality", raw.finalityAnchor, Str.repeat(Str.length(raw.finalityAnchor.quote))("x")),
          period,
        ])
        .pipe(Effect.flip);
      expect(mismatched.reason).toBe("quote-mismatch");
      const zeroWidth = GroundedExtraction.cases.match_exact.make({
        label: "action-finality",
        text: raw.finalityAnchor.quote,
        matchedText: raw.finalityAnchor.quote,
        span: { start: raw.finalityAnchor.startChar, end: raw.finalityAnchor.startChar },
      });
      const malformed = yield* structure.fromExtractions(input, [zeroWidth, period]).pipe(Effect.flip);
      expect(malformed.reason).toBe("invalid-anchor");
      expect((yield* structure.fromExtractions(input, [period])).status).toBe("abstained");
      expect((yield* structure.fromExtractions(input, [period, period, period])).status).toBe("abstained");
    })
  );
  it.effect("rejects identity and raw digest drift before candidate authority", () =>
    Effect.gen(function* () {
      const text = yield* readFixture("oa-001.txt");
      const original = yield* fixtureSource(text);
      const changed = yield* fixtureSource(`prefix ${text}`);
      const stale = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: original.source,
          source: changed.source,
          sourceText: `prefix ${text}`,
        })
      ).pipe(Effect.flip);
      const digest = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: original.source,
          source: original.source,
          sourceText: `prefix ${text}`,
        })
      ).pipe(Effect.flip);
      expect(stale.reason).toBe("stale-source");
      expect(digest.reason).toBe("stale-source");
      const versioned = SourceTextIdentity.make({
        ...original.source,
        extractor: SourceTextExtractor.make({ ...original.source.extractor, version: "2" }),
      });
      const versionDrift = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({ expectedSource: original.source, source: versioned, sourceText: text })
      ).pipe(Effect.flip);
      expect(versionDrift.reason).toBe("stale-source");
      const differentScope = SourceTextIdentity.make({ ...original.source, scopeRef: "matter:other" });
      const scopeFailure = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: original.source,
          source: differentScope,
          sourceText: text,
        })
      ).pipe(Effect.flip);
      expect(scopeFailure.reason).toBe("cross-scope");
    })
  );
  it.effect("typed OCR lineage overrides a positive declared modality and unknown rule versions close", () =>
    Effect.gen(function* () {
      const text = yield* readFixture("oa-001.txt");
      const { verifiedSource } = yield* fixtureSource(text);
      const page = yield* fixtureOcrPage(text);
      const ocr = yield* structure.extract(
        OfficeActionStructureInput.make({ document, verifiedSource, ocrPages: [page] })
      );
      expect(ocr).toMatchObject({ status: "abstained", code: "low-quality-source" });
      expect(
        yield* structure.fromExtractions(
          OfficeActionStructureInput.make({ document, verifiedSource, ocrPages: [page] }),
          []
        )
      ).toMatchObject({ status: "abstained", code: "low-quality-source" });
      const unknown = yield* structure.extract(
        OfficeActionStructureInput.make({
          document,
          verifiedSource,
          rule: DocStructureRuleFamily.make({ id: "uspto-oa-finality-ssp", version: 2 }),
        })
      );
      expect(unknown).toMatchObject({ status: "abstained", code: "rule-not-covered" });
    })
  );
  it.effect("rejects candidate and pair metadata that disagree with their opaque anchors", () =>
    Effect.gen(function* () {
      const text = yield* readFixture("oa-001.txt");
      const original = yield* fixtureSource(text);
      const changed = yield* fixtureSource(`prefix ${text}`);
      const outcome = yield* structure.extract(
        OfficeActionStructureInput.make({ document, verifiedSource: original.verifiedSource })
      );
      if (outcome.status !== "recognized") return yield* Effect.die("Expected fixture pair.");
      const [first, second] = outcome.candidates;
      expect(() =>
        OfficeActionFinalityCandidate.make({
          schemaVersion: "1",
          source: changed.source,
          document: first.document,
          rule: first.rule,
          confidence: first.confidence,
          anchor: first.anchor,
          finality: first.finality,
        })
      ).toThrow();
      const unrelatedPeriod = ShortenedStatutoryPeriodCandidate.make({
        schemaVersion: "1",
        source: second.source,
        document: DocStructureDocument.make({ ...second.document, documentId: "different" }),
        rule: second.rule,
        confidence: second.confidence,
        anchor: second.anchor,
        months: 3,
      });
      expect(() => OfficeActionRecognizedPair.make({ candidates: [first, unrelatedPeriod] })).toThrow();
    })
  );
});
