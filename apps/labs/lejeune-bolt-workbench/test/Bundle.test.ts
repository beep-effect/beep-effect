// @vitest-environment node

import { DuckDb } from "@beep/duckdb";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { strToU8 } from "fflate";
import {
  CanonicalNormalizedFixtures,
  ImmutableDemoBundle,
  MutableReviewLedger,
  NormalizedFixture,
  PROVIDER_RECORDING_SOURCE_TEXT,
  ProjectionSnapshot,
  ProviderCandidate,
  ProviderCandidateListFromJsonString,
  ProviderRecording,
  ProviderRecordingFromJsonString,
  RetentionAuthorization,
  RuleResult,
} from "@/domain/Bundle";
import { Approval, ExpertClaim, IsoDate, IsoTimestamp, OntologyClassName, ProductVariant } from "@/domain/Ontology";
import { buildReferenceData } from "@/domain/ReferenceData";
import { FrozenFixtureManifest, FrozenSourceHash } from "@/fixtures/FixtureManifest";
import fixtureManifestJson from "@/fixtures/fixture-manifest.json";
import providerRecordingFixture from "@/fixtures/provider-recording.json";
import { buildFixtureArtifacts } from "@/fixtures/Sources";
import {
  buildProjectionSnapshot,
  makeProjectionLayer,
  ProjectionInput,
  ProjectionLayerOptions,
  verifyDurableProjectionSnapshot,
} from "@/runtime/Projections";
import { buildNormalizedFixtures } from "@/workflows/Normalize";
import { verifyFrozenProviderRecording, verifyProviderRecording } from "@/workflows/ProviderRecording";
import { replayOffline } from "@/workflows/Replay";
import { evaluateRules } from "@/workflows/Rules";
import type {
  IsoDate as IsoDateValue,
  IsoTimestamp as IsoTimestampValue,
  OntologyClassName as OntologyClassNameValue,
} from "@/domain/Ontology";

const provideBunCrypto = provideScopedLayer(BunCrypto.layer);
const makeInMemoryProjectionLayer = () => makeProjectionLayer(ProjectionLayerOptions.make({ duckDbPath: ":memory:" }));
const providerRecordingJson = S.encodeSync(ProviderRecordingFromJsonString)(
  S.decodeUnknownSync(ProviderRecording)(providerRecordingFixture)
);

describe("LeJeune deterministic fixture bundle", () => {
  it("round-trips schema-derived retention authorizations", () => {
    const decode = S.decodeUnknownSync(RetentionAuthorization);
    const encode = S.encodeSync(RetentionAuthorization);
    const equivalent = S.toEquivalence(RetentionAuthorization);
    fc.assert(
      fc.property(S.toArbitrary(RetentionAuthorization)(fc), (value) => equivalent(decode(encode(value)), value)),
      fcRuns(20)
    );
  });

  it.effect(
    "generates exactly four stable synthetic source records across the two authorized layouts",
    Effect.fnUntraced(function* () {
      const [first, second] = yield* Effect.all([buildFixtureArtifacts, buildFixtureArtifacts], {
        concurrency: 1,
      }).pipe(provideBunCrypto);
      const manifest = yield* S.decodeUnknownEffect(FrozenFixtureManifest)(fixtureManifestJson);

      expect(S.is(FrozenSourceHash)(manifest.sources[0])).toBe(true);
      expect(A.map(first.sources, (source) => [source.id, source.sha256])).toEqual([
        ["rfq-a-outlook-body", "ee38c21a1635fa152f1e48914ae2c2ce3761d5ada7f96b8c7c3d5a50e808f3b5"],
        ["rfq-a-xlsx-takeoff", "09c038e5118283ff15382a632ca6c6e9c811ef4e7235128623956f6043b1d4c5"],
        ["rfq-b-prose-email", "bc1144a4fdde67229b9e2178c09c133cdd48a0b8881e5f9b9f0316f4ba91806e"],
        ["rfq-b-pdf-schedule", "bbaa1ae10d94a0680966ed5d1eef8c020b172131d760eb7bc9bc61e8f4831360"],
      ]);
      expect(A.map(second.sources, (source) => source.sha256)).toEqual(A.map(first.sources, (source) => source.sha256));
      expect(A.map(first.sources, (source) => ({ id: source.id, sha256: source.sha256 }))).toEqual(manifest.sources);
      expect(A.map(first.sources, (source) => source.format)).toEqual([
        "outlook-body-table",
        "xlsx-takeoff",
        "prose-email",
        "pdf-text-layer",
      ]);
      expect(A.every(first.sources, (source) => Str.Equivalence(source.syntheticLabel, "SYNTHETIC"))).toBe(true);
    })
  );

  it.effect(
    "grounds every normalized value to an exact source slice and retains both missing fields",
    Effect.fnUntraced(function* () {
      const artifacts = yield* buildFixtureArtifacts.pipe(provideBunCrypto);
      const fixtures = yield* buildNormalizedFixtures(artifacts);
      const manifest = yield* S.decodeUnknownEffect(FrozenFixtureManifest)(fixtureManifestJson);

      expect(fixtures).toEqual(CanonicalNormalizedFixtures);
      expect(A.map(fixtures, (fixture) => fixture.rfq.id)).toEqual(["rfq-a", "rfq-b"]);
      expect(A.map(fixtures, (fixture) => fixture.missingFields[0]?.field)).toEqual([
        "certificationRequirement",
        "domesticOrigin",
      ]);
      for (const fixture of fixtures) {
        for (const field of fixture.extractedFields) {
          const source = A.findFirst(fixture.sources, (candidate) =>
            Str.Equivalence(candidate.id, field.sourceDocumentId)
          );
          expect(O.isSome(source)).toBe(true);
          const sourceText = O.getOrThrow(source);
          expect(Str.slice(field.anchor.startChar, field.anchor.endChar)(sourceText.text)).toBe(field.anchor.quote);
          expect(field.anchor.quote).toBe(field.value);
        }
      }
      expect(A.flatMap(fixtures, (fixture) => fixture.extractedFields)).toEqual(manifest.extractedFields);
      expect(
        A.flatMap(fixtures, (fixture) => A.map(fixture.missingFields, (field) => `${field.rfqId}|${field.field}`))
      ).toEqual(manifest.missingFields);
    })
  );

  it.effect(
    "keeps the ontology at exactly twelve classes and covers each rule's pass and stop case",
    Effect.fnUntraced(function* () {
      const artifacts = yield* buildFixtureArtifacts.pipe(provideBunCrypto);
      const fixtures = yield* buildNormalizedFixtures(artifacts);
      const results = yield* evaluateRules(fixtures);
      const ontologyClasses: ReadonlyArray<OntologyClassNameValue> = OntologyClassName.Options;

      expect(ontologyClasses).toEqual([
        "ProductVariant",
        "Component",
        "Standard",
        "Finish",
        "Tool",
        "SupplierOffer",
        "Project",
        "RFQ",
        "QuoteLine",
        "LotCertificate",
        "Approval",
        "ExpertClaim",
      ]);
      expect([Approval.fields.decision !== undefined, ExpertClaim.fields.reviewStatus !== undefined]).toEqual([
        true,
        true,
      ]);
      expect(A.map(results, (result) => [result.ruleId, result.disposition, result.requiresHuman])).toEqual([
        ["matched-assembly", "pass", false],
        ["matched-assembly", "mismatch", true],
        ["dti-strength-match", "pass", false],
        ["dti-strength-match", "mismatch", true],
        ["a490-hdg-refusal", "pass", false],
        ["a490-hdg-refusal", "refuse", true],
      ]);
      expect(
        A.every(results, (result) => Str.Equivalence(result.source.evidenceAnchor.quote, result.source.evidence))
      ).toBe(true);
      expect(
        A.map(
          A.dedupeWith(results, (left, right) => Str.Equivalence(left.source.id, right.source.id)),
          (result) => [result.source.id, result.source.accessedOn, result.source.url, result.source.researchPath]
        )
      ).toEqual([
        [
          "aisc-matched-assembly",
          "2026-08-25",
          "https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/",
          "explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md",
        ],
        [
          "portland-bolt-astm-f959",
          "2026-08-25",
          "https://www.portlandbolt.com/technical/specifications/astm-f959/",
          "explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md",
        ],
        [
          "fastenal-a490-coating",
          "2026-08-25",
          "https://blueprint.fastenal.com/structural-bolts.html",
          "explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md",
        ],
      ]);

      const [rfqA, rfqB] = fixtures;
      const renamedA490 = NormalizedFixture.make({
        ...rfqB,
        productVariant: ProductVariant.make({ ...rfqB.productVariant, label: "Renamed structural bolt" }),
      });
      const renamedResults = yield* evaluateRules([rfqA, renamedA490]);
      expect(
        O.getOrThrow(A.findFirst(renamedResults, (result) => Str.Equivalence(result.caseId, "rfq-b-a490-hdg-refusal")))
          .disposition
      ).toBe("refuse");

      const encodedRfqA = yield* S.encodeEffect(NormalizedFixture)(rfqA);
      const incompatibleComponents = A.map(encodedRfqA.components, (component) =>
        Str.Equivalence(component.kind, "nut")
          ? { ...component, standardId: "astm-a490-type-1", strengthClass: "490" }
          : component
      );
      const incompatibleAssembly = yield* S.decodeUnknownEffect(NormalizedFixture)({
        ...encodedRfqA,
        components: incompatibleComponents,
      });
      const incompatibleResults = yield* evaluateRules([incompatibleAssembly, rfqB]);
      const incompatibleMatchedResult = O.getOrThrow(
        A.findFirst(incompatibleResults, (result) => Str.Equivalence(result.caseId, "rfq-a-matched-assembly-mismatch"))
      );
      expect([incompatibleMatchedResult.disposition, incompatibleMatchedResult.requiresHuman]).toEqual([
        "mismatch",
        true,
      ]);

      const dtiStandardSwizzleComponents = A.map(encodedRfqA.components, (component) =>
        Str.Equivalence(component.kind, "dti") ? { ...component, standardId: "astm-a563-dh" } : component
      );
      const dtiStandardSwizzle = yield* S.decodeUnknownEffect(NormalizedFixture)({
        ...encodedRfqA,
        components: dtiStandardSwizzleComponents,
      });
      const dtiStandardSwizzleResults = yield* evaluateRules([dtiStandardSwizzle, rfqB]);
      const dtiStandardSwizzleResult = O.getOrThrow(
        A.findFirst(dtiStandardSwizzleResults, (result) =>
          Str.Equivalence(result.caseId, "rfq-a-dti-strength-mismatch")
        )
      );
      expect([dtiStandardSwizzleResult.disposition, dtiStandardSwizzleResult.requiresHuman]).toEqual([
        "mismatch",
        true,
      ]);

      const provenanceFields = A.map(encodedRfqA.extractedFields, (field) =>
        Str.Equivalence(field.name, "product")
          ? { ...field, anchor: { ...field.anchor, quote: "XX assembly" }, value: "XX assembly" }
          : field
      );
      const provenanceSources = A.map(encodedRfqA.sources, (source) =>
        Str.Equivalence(source.id, "rfq-a-xlsx-takeoff")
          ? { ...source, text: Str.replace("TC assembly", "XX assembly")(source.text) }
          : source
      );
      const unprovenAssembly = yield* S.decodeUnknownEffect(NormalizedFixture)({
        ...encodedRfqA,
        extractedFields: provenanceFields,
        sources: provenanceSources,
      });
      const unprovenResults = yield* evaluateRules([unprovenAssembly, rfqB]);
      expect(
        O.getOrThrow(
          A.findFirst(unprovenResults, (result) => Str.Equivalence(result.caseId, "rfq-a-matched-assembly-mismatch"))
        ).disposition
      ).toBe("mismatch");
    })
  );

  it.effect(
    "rebuilds identical query outputs from fresh PGlite, DuckDB, and Oxigraph stores",
    Effect.fnUntraced(function* () {
      const artifacts = yield* buildFixtureArtifacts.pipe(provideBunCrypto);
      const fixtures = yield* buildNormalizedFixtures(artifacts);
      const rules = yield* evaluateRules(fixtures);
      const referenceData = buildReferenceData(fixtures);
      expect(A.every(referenceData.offers, (offer) => Str.Equivalence(offer.recordLabel, "SYNTHETIC"))).toBe(true);
      expect(
        A.every(referenceData.certificates, (certificate) => Str.Equivalence(certificate.recordLabel, "SYNTHETIC"))
      ).toBe(true);
      const input = ProjectionInput.make({
        certificates: referenceData.certificates,
        fixtures,
        offers: referenceData.offers,
        rules,
      });
      const rebuild = () => buildProjectionSnapshot(input).pipe(provideScopedLayer(makeInMemoryProjectionLayer()));
      const first = yield* rebuild();
      const second = yield* rebuild();

      expect(second).toEqual(first);
      expect(first.documentCount).toBe(4);
      expect(first.documentDigests).toHaveLength(4);
      expect(first.ontologyClasses).toEqual([
        "Approval",
        "Component",
        "ExpertClaim",
        "Finish",
        "LotCertificate",
        "ProductVariant",
        "Project",
        "QuoteLine",
        "RFQ",
        "Standard",
        "SupplierOffer",
        "Tool",
      ]);
      expect(first.quoteLines).toEqual(["rfq-a-line-a-1|180", "rfq-b-line-b-1|860"]);
      expect(first.citations).toHaveLength(4);
      expect(first.syntheticRecords).toHaveLength(4);
      expect(first.ruleDispositions).toHaveLength(6);
    })
  );

  it.effect(
    "rejects same-count corpus body corruption even when citations and the A490 result remain unchanged",
    Effect.fnUntraced(function* () {
      const artifacts = yield* buildFixtureArtifacts.pipe(provideBunCrypto);
      const fixtures = yield* buildNormalizedFixtures(artifacts);
      const rules = yield* evaluateRules(fixtures);
      const referenceData = buildReferenceData(fixtures);
      const input = ProjectionInput.make({
        certificates: referenceData.certificates,
        fixtures,
        offers: referenceData.offers,
        rules,
      });

      const failure = yield* Effect.flip(
        Effect.gen(function* () {
          const expected = yield* buildProjectionSnapshot(input);
          const duckdb = yield* DuckDb;
          yield* duckdb.run(
            "UPDATE corpus_documents SET body = body || ' integrity-corruption' WHERE id = 'rfq-a-xlsx-takeoff'"
          );
          return yield* verifyDurableProjectionSnapshot(expected);
        }).pipe(provideScopedLayer(makeInMemoryProjectionLayer()))
      );

      expect(failure._tag).toBe("ProjectionError");
    })
  );

  it.effect(
    "maps a reused projection store failure into the declared projection error",
    Effect.fnUntraced(function* () {
      const artifacts = yield* buildFixtureArtifacts.pipe(provideBunCrypto);
      const fixtures = yield* buildNormalizedFixtures(artifacts);
      const rules = yield* evaluateRules(fixtures);
      const referenceData = buildReferenceData(fixtures);
      const input = ProjectionInput.make({
        certificates: referenceData.certificates,
        fixtures,
        offers: referenceData.offers,
        rules,
      });
      const failure = yield* Effect.flip(
        Effect.gen(function* () {
          yield* buildProjectionSnapshot(input);
          return yield* buildProjectionSnapshot(input);
        }).pipe(provideScopedLayer(makeInMemoryProjectionLayer()))
      );

      expect(failure._tag).toBe("ProjectionError");
    })
  );

  it.effect(
    "rejects impossible semantic dates and timestamps",
    Effect.fnUntraced(function* () {
      const validDate: IsoDateValue = yield* S.decodeEffect(IsoDate)("2026-09-30");
      const validTimestamp: IsoTimestampValue = yield* S.decodeEffect(IsoTimestamp)("2026-08-27T12:00:00.000Z");
      expect([validDate, validTimestamp]).toEqual(["2026-09-30", "2026-08-27T12:00:00.000Z"]);
      const invalidDates = ["2026-99-99", "2026-02-30"] as const;
      for (const value of invalidDates) {
        const failure = yield* Effect.flip(S.decodeEffect(IsoDate)(value));
        expect(failure._tag).toBe("SchemaError");
      }
      const timestampFailure = yield* Effect.flip(S.decodeEffect(IsoTimestamp)("2026-02-30T12:00:00.000Z"));
      expect(timestampFailure._tag).toBe("SchemaError");
    })
  );

  it.effect(
    "rejects table-driven persisted boundary corruption",
    Effect.fnUntraced(function* () {
      const artifacts = yield* buildFixtureArtifacts.pipe(provideBunCrypto);
      const fixtures = yield* buildNormalizedFixtures(artifacts);
      const rules = yield* evaluateRules(fixtures);
      const recording = yield* S.decodeEffect(ProviderRecordingFromJsonString)(providerRecordingJson);
      const replay = yield* replayOffline(recording).pipe(
        provideScopedLayer(Layer.merge(BunCrypto.layer, makeInMemoryProjectionLayer()))
      );
      const fixture = yield* S.encodeEffect(NormalizedFixture)(fixtures[0]);
      const rule = yield* S.encodeEffect(RuleResult)(rules[1]);
      const bundle = yield* S.encodeEffect(ImmutableDemoBundle)(replay.bundle);
      const [firstField, ...remainingFields] = fixture.extractedFields;
      const [firstFixtureSource, secondFixtureSource] = fixture.sources;
      const [firstManifestField, ...remainingManifestFields] = fixtureManifestJson.extractedFields;
      const [firstBundleRule, secondBundleRule, thirdBundleRule, fourthBundleRule, fifthBundleRule, sixthBundleRule] =
        bundle.rules;
      const [firstBundleCertificate, secondBundleCertificate] = bundle.certificates;
      const [firstBundleFinish, secondBundleFinish] = bundle.finishes;
      const [firstBundleFixture, secondBundleFixture] = bundle.fixtures;
      const [firstBundleOffer, secondBundleOffer] = bundle.offers;
      const [firstBundleStandard, ...remainingBundleStandards] = bundle.standards;
      const [firstBundleTool, secondBundleTool] = bundle.tools;
      const recordingPayload = yield* S.encodeEffect(ProviderRecording)(recording);
      const [firstBundleFixtureField, secondBundleFixtureField, ...remainingBundleFixtureFields] =
        firstBundleFixture.extractedFields;
      const [firstBundleFixtureSource, secondBundleFixtureSource] = firstBundleFixture.sources;
      const [firstBundleComponent, secondBundleComponent, thirdBundleComponent, fourthBundleComponent] =
        firstBundleFixture.components;
      const [providerProjectCandidate, providerDeliveryCandidate, providerFinishCandidate] =
        bundle.providerRecording.candidates;

      const fixtureSourceCardinality: unknown = { ...fixture, sources: A.take(fixture.sources, 1) };
      const fixtureDuplicateSourceIdentity: unknown = {
        ...fixture,
        rfq: { ...fixture.rfq, sourceDocumentIds: [firstFixtureSource.id, firstFixtureSource.id] },
        sources: [firstFixtureSource, { ...secondFixtureSource, id: firstFixtureSource.id }],
      };
      const fixtureDanglingSource: unknown = {
        ...fixture,
        extractedFields: [{ ...firstField, sourceDocumentId: "dangling-source" }, ...remainingFields],
      };
      const fixtureValueDrift: unknown = {
        ...fixture,
        extractedFields: [{ ...firstField, value: "corrupted-value" }, ...remainingFields],
      };
      const fixtureReferentialDrift: unknown = {
        ...fixture,
        quoteLine: { ...fixture.quoteLine, productVariantId: "dangling-product" },
      };
      const ruleHumanStop: unknown = { ...rule, requiresHuman: false };
      const manifestSourceCardinality: unknown = {
        ...fixtureManifestJson,
        sources: A.take(fixtureManifestJson.sources, 1),
      };
      const manifestDuplicateSource: unknown = {
        ...fixtureManifestJson,
        sources: [
          fixtureManifestJson.sources[0],
          fixtureManifestJson.sources[0],
          fixtureManifestJson.sources[2],
          fixtureManifestJson.sources[3],
        ],
      };
      const manifestHashDrift: unknown = {
        ...fixtureManifestJson,
        sources: [
          {
            ...fixtureManifestJson.sources[0],
            sha256: "0000000000000000000000000000000000000000000000000000000000000000",
          },
          ...A.drop(fixtureManifestJson.sources, 1),
        ],
      };
      const manifestDanglingExtraction: unknown = {
        ...fixtureManifestJson,
        extractedFields: [{ ...firstManifestField, sourceDocumentId: "dangling-source" }, ...remainingManifestFields],
      };
      const manifestDuplicateExtraction: unknown = {
        ...fixtureManifestJson,
        extractedFields: [firstManifestField, firstManifestField, ...A.drop(remainingManifestFields, 1)],
      };
      const manifestMissingFieldDrift: unknown = {
        ...fixtureManifestJson,
        missingFields: ["rfq-a|domesticOrigin", "rfq-b|certificationRequirement"],
      };
      const manifestSpanDrift: unknown = {
        ...fixtureManifestJson,
        extractedFields: [
          {
            ...firstManifestField,
            anchor: {
              ...firstManifestField.anchor,
              endChar: firstManifestField.anchor.endChar + 1,
              startChar: firstManifestField.anchor.startChar + 1,
            },
          },
          ...remainingManifestFields,
        ],
      };
      const manifestQuoteValueDrift: unknown = {
        ...fixtureManifestJson,
        extractedFields: [
          {
            ...firstManifestField,
            anchor: { ...firstManifestField.anchor, quote: "South Loop Canopy" },
            value: "South Loop Canopy",
          },
          ...remainingManifestFields,
        ],
      };
      const bundleFixtureCardinality: unknown = { ...bundle, fixtures: A.take(bundle.fixtures, 1) };
      const bundleSourceHashDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            sources: [
              {
                ...firstBundleFixtureSource,
                sha256: "0000000000000000000000000000000000000000000000000000000000000000",
              },
              secondBundleFixtureSource,
            ],
          },
          secondBundleFixture,
        ],
      };
      const bundleSourceContentDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            extractedFields: [
              {
                ...firstBundleFixtureField,
                anchor: { ...firstBundleFixtureField.anchor, quote: "South Loop Canopy" },
                value: "South Loop Canopy",
              },
              secondBundleFixtureField,
              ...remainingBundleFixtureFields,
            ],
            project: { ...firstBundleFixture.project, name: "South Loop Canopy" },
            sources: [
              {
                ...firstBundleFixtureSource,
                text: Str.replace("North Loop Canopy", "South Loop Canopy")(firstBundleFixtureSource.text),
              },
              secondBundleFixtureSource,
            ],
          },
          secondBundleFixture,
        ],
      };
      const bundleSourceOrderDrift: unknown = {
        ...bundle,
        fixtures: [
          { ...firstBundleFixture, sources: [secondBundleFixtureSource, firstBundleFixtureSource] },
          secondBundleFixture,
        ],
      };
      const bundleExtractionOrderDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            extractedFields: [secondBundleFixtureField, firstBundleFixtureField, ...remainingBundleFixtureFields],
          },
          secondBundleFixture,
        ],
      };
      const bundleComponentOrderDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            components: [secondBundleComponent, firstBundleComponent, thirdBundleComponent, fourthBundleComponent],
          },
          secondBundleFixture,
        ],
      };
      const bundleMissingFieldSemanticDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            missingFields: [
              {
                ...firstBundleFixture.missingFields[0],
                field: "fabricationApproval",
                question: "RFI: Is fabrication approval required for RFQ A?",
              },
            ],
            rfq: { ...firstBundleFixture.rfq, missingFields: ["fabricationApproval"] },
          },
          secondBundleFixture,
        ],
      };
      const bundleProjectSemanticDrift: unknown = {
        ...bundle,
        fixtures: [
          { ...firstBundleFixture, project: { ...firstBundleFixture.project, name: "Renamed canopy project" } },
          secondBundleFixture,
        ],
      };
      const bundleProductSemanticDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            productVariant: { ...firstBundleFixture.productVariant, label: "Renamed TC assembly" },
          },
          secondBundleFixture,
        ],
      };
      const bundleDtiStrengthDrift: unknown = {
        ...bundle,
        fixtures: [
          {
            ...firstBundleFixture,
            components: [
              firstBundleComponent,
              secondBundleComponent,
              thirdBundleComponent,
              { ...fourthBundleComponent, strengthClass: "490" },
            ],
          },
          secondBundleFixture,
        ],
      };
      const bundleFixtureOrderDrift: unknown = {
        ...bundle,
        fixtures: [secondBundleFixture, firstBundleFixture],
        offers: [
          { ...firstBundleOffer, productVariantId: secondBundleFixture.productVariant.id },
          { ...secondBundleOffer, productVariantId: firstBundleFixture.productVariant.id },
        ],
      };
      const bundleRuleCardinality: unknown = { ...bundle, rules: A.take(bundle.rules, 1) };
      const bundleRuleIdDrift: unknown = {
        ...bundle,
        rules: [
          { ...firstBundleRule, ruleId: "dti-strength-match" },
          secondBundleRule,
          thirdBundleRule,
          fourthBundleRule,
          fifthBundleRule,
          sixthBundleRule,
        ],
      };
      const bundleRuleSourceDrift: unknown = {
        ...bundle,
        rules: [
          { ...firstBundleRule, source: thirdBundleRule.source },
          secondBundleRule,
          thirdBundleRule,
          fourthBundleRule,
          fifthBundleRule,
          sixthBundleRule,
        ],
      };
      const bundleWithFirstRuleSource = (source: unknown): unknown => ({
        ...bundle,
        rules: [
          { ...firstBundleRule, source },
          secondBundleRule,
          thirdBundleRule,
          fourthBundleRule,
          fifthBundleRule,
          sixthBundleRule,
        ],
      });
      const bundleRuleSourceUrlDrift = bundleWithFirstRuleSource({
        ...firstBundleRule.source,
        url: "https://example.com/altered-rule-source",
      });
      const bundleRuleSourceRevisionDrift = bundleWithFirstRuleSource({
        ...firstBundleRule.source,
        revision: "Altered governing revision",
      });
      const bundleRuleSourceEvidenceDrift = bundleWithFirstRuleSource({
        ...firstBundleRule.source,
        evidence: Str.replace("Galvanized", "Fabricated")(firstBundleRule.source.evidence),
        evidenceAnchor: {
          ...firstBundleRule.source.evidenceAnchor,
          quote: Str.replace("Galvanized", "Fabricated")(firstBundleRule.source.evidenceAnchor.quote),
        },
      });
      const bundleRuleSourceTitleDrift = bundleWithFirstRuleSource({
        ...firstBundleRule.source,
        title: "Altered rule source title",
      });
      const bundleRuleSourceResearchPathDrift = bundleWithFirstRuleSource({
        ...firstBundleRule.source,
        researchPath: "explorations/lejeune-bolt-agentic-demo/research/altered.md",
      });
      const bundleRuleDispositionDrift: unknown = {
        ...bundle,
        rules: [
          { ...firstBundleRule, disposition: "mismatch", requiresHuman: true },
          secondBundleRule,
          thirdBundleRule,
          fourthBundleRule,
          fifthBundleRule,
          sixthBundleRule,
        ],
      };
      const bundleRuleOrderDrift: unknown = {
        ...bundle,
        rules: [secondBundleRule, firstBundleRule, thirdBundleRule, fourthBundleRule, fifthBundleRule, sixthBundleRule],
      };
      const bundleRuleFactsDrift: unknown = {
        ...bundle,
        rules: [
          { ...firstBundleRule, matchedFacts: ["Fabricated matched fact"] },
          secondBundleRule,
          thirdBundleRule,
          fourthBundleRule,
          fifthBundleRule,
          sixthBundleRule,
        ],
      };
      const bundleRuleStopReasonDrift: unknown = {
        ...bundle,
        rules: [
          { ...firstBundleRule, stopReason: "Fabricated stop reason." },
          secondBundleRule,
          thirdBundleRule,
          fourthBundleRule,
          fifthBundleRule,
          sixthBundleRule,
        ],
      };
      const bundleStandardSemanticDrift: unknown = {
        ...bundle,
        standards: [{ ...firstBundleStandard, revision: "Corrupted standard revision" }, ...remainingBundleStandards],
      };
      const bundleFinishSemanticDrift: unknown = {
        ...bundle,
        finishes: [
          { ...firstBundleFinish, coatingSpecification: "Corrupted coating specification" },
          secondBundleFinish,
        ],
      };
      const bundleToolSemanticDrift: unknown = {
        ...bundle,
        tools: [{ ...firstBundleTool, operation: "Corrupted installation operation" }, secondBundleTool],
      };
      const bundleOfferSemanticDrift: unknown = {
        ...bundle,
        offers: [{ ...firstBundleOffer, unitPriceCents: 1_900 }, secondBundleOffer],
      };
      const bundleCertificateSemanticDrift: unknown = {
        ...bundle,
        certificates: [{ ...firstBundleCertificate, lotId: "corrupted-synthetic-lot" }, secondBundleCertificate],
      };
      const bundleQuoteProjectionDrift: unknown = {
        ...bundle,
        fixtures: [
          { ...firstBundleFixture, quoteLine: { ...firstBundleFixture.quoteLine, quantity: 181 } },
          secondBundleFixture,
        ],
      };
      const bundleSyntheticProjectionDrift: unknown = {
        ...bundle,
        offers: [{ ...firstBundleOffer, observedAt: "2026-08-27T11:31:00.000Z" }, secondBundleOffer],
      };
      const projectionClassVocabulary: unknown = {
        ...bundle.projection,
        ontologyClasses: ["BogusClass", ...A.drop(bundle.projection.ontologyClasses, 1)],
      };
      const projectionRuleOrderDrift: unknown = {
        ...bundle.projection,
        ruleDispositions: [
          bundle.projection.ruleDispositions[1],
          bundle.projection.ruleDispositions[0],
          ...A.drop(bundle.projection.ruleDispositions, 2),
        ],
      };
      const providerDocumentDrift: unknown = { ...recordingPayload, documentId: "unrelated-document" };
      const bundleProviderMetadataDrift: unknown = {
        ...bundle,
        providerRecording: {
          ...bundle.providerRecording,
          model: "altered-model",
          provider: "xai",
          recordedAt: "2026-08-27T13:25:18.044Z",
        },
      };
      const bundleProviderCandidateOrderDrift: unknown = {
        ...bundle,
        providerRecording: {
          ...bundle.providerRecording,
          candidates: [providerDeliveryCandidate, providerProjectCandidate, providerFinishCandidate],
        },
      };
      const danglingLedgerSubject = {
        approvals: [
          {
            decision: "approve",
            id: "approval-one",
            recordedAt: "2026-08-27T13:00:00.000Z",
            reviewer: "Demo reviewer",
            subjectId: "dangling-subject",
          },
        ],
        claims: [],
        disposition: "delete-or-promote",
        dispositionDate: "2026-09-30",
        schemaVersion: "lejeune-review-ledger/v1",
      };
      const duplicateLedgerIdentity: unknown = {
        ...danglingLedgerSubject,
        approvals: [danglingLedgerSubject.approvals[0], danglingLedgerSubject.approvals[0]],
      };
      const retentionBeforeCutoff = {
        authorization: "promoted",
        authorizedAt: "2026-08-27T12:00:00.000Z",
        decisionReference: "goal/decision",
        newDispositionDate: "2026-09-01",
        owner: "demo operator",
        schemaVersion: "lejeune-retention-authorization/v1",
      };
      const retentionAtCutoff: unknown = { ...retentionBeforeCutoff, newDispositionDate: "2026-09-30" };
      const retentionBeforeAuthorization: unknown = {
        ...retentionBeforeCutoff,
        authorizedAt: "2027-01-02T12:00:00.000Z",
        newDispositionDate: "2027-01-01",
      };

      const corruptions: ReadonlyArray<readonly [string, Effect.Effect<unknown, S.SchemaError>]> = [
        ["fixture-source-cardinality", S.decodeUnknownEffect(NormalizedFixture)(fixtureSourceCardinality)],
        ["fixture-duplicate-source-identity", S.decodeUnknownEffect(NormalizedFixture)(fixtureDuplicateSourceIdentity)],
        ["fixture-dangling-source", S.decodeUnknownEffect(NormalizedFixture)(fixtureDanglingSource)],
        ["fixture-value-drift", S.decodeUnknownEffect(NormalizedFixture)(fixtureValueDrift)],
        ["fixture-referential-drift", S.decodeUnknownEffect(NormalizedFixture)(fixtureReferentialDrift)],
        ["rule-human-stop", S.decodeUnknownEffect(RuleResult)(ruleHumanStop)],
        ["manifest-source-cardinality", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestSourceCardinality)],
        ["manifest-duplicate-source", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestDuplicateSource)],
        ["manifest-hash-drift", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestHashDrift)],
        ["manifest-dangling-extraction", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestDanglingExtraction)],
        ["manifest-duplicate-extraction", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestDuplicateExtraction)],
        ["manifest-missing-field-drift", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestMissingFieldDrift)],
        ["manifest-span-drift", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestSpanDrift)],
        ["manifest-quote-value-drift", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestQuoteValueDrift)],
        ["bundle-fixture-cardinality", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleFixtureCardinality)],
        ["bundle-source-hash-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleSourceHashDrift)],
        ["bundle-source-content-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleSourceContentDrift)],
        ["bundle-source-order-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleSourceOrderDrift)],
        ["bundle-extraction-order-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleExtractionOrderDrift)],
        ["bundle-component-order-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleComponentOrderDrift)],
        [
          "bundle-missing-field-semantic-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleMissingFieldSemanticDrift),
        ],
        ["bundle-project-semantic-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleProjectSemanticDrift)],
        ["bundle-product-semantic-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleProductSemanticDrift)],
        ["bundle-dti-strength-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleDtiStrengthDrift)],
        ["bundle-fixture-order-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleFixtureOrderDrift)],
        ["bundle-rule-cardinality", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleCardinality)],
        ["bundle-rule-id-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleIdDrift)],
        ["bundle-rule-source-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleSourceDrift)],
        ["bundle-rule-source-url-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleSourceUrlDrift)],
        [
          "bundle-rule-source-revision-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleSourceRevisionDrift),
        ],
        [
          "bundle-rule-source-evidence-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleSourceEvidenceDrift),
        ],
        ["bundle-rule-source-title-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleSourceTitleDrift)],
        [
          "bundle-rule-source-research-path-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleSourceResearchPathDrift),
        ],
        ["bundle-rule-disposition-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleDispositionDrift)],
        ["bundle-rule-order-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleOrderDrift)],
        ["bundle-rule-facts-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleFactsDrift)],
        ["bundle-rule-stop-reason-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleStopReasonDrift)],
        ["bundle-standard-semantic-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleStandardSemanticDrift)],
        ["bundle-finish-semantic-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleFinishSemanticDrift)],
        ["bundle-tool-semantic-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleToolSemanticDrift)],
        ["bundle-offer-semantic-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleOfferSemanticDrift)],
        [
          "bundle-certificate-semantic-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleCertificateSemanticDrift),
        ],
        ["bundle-quote-projection-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleQuoteProjectionDrift)],
        [
          "bundle-synthetic-projection-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleSyntheticProjectionDrift),
        ],
        ["projection-class-vocabulary", S.decodeUnknownEffect(ProjectionSnapshot)(projectionClassVocabulary)],
        ["projection-rule-order", S.decodeUnknownEffect(ProjectionSnapshot)(projectionRuleOrderDrift)],
        ["provider-document-drift", S.decodeUnknownEffect(ProviderRecording)(providerDocumentDrift)],
        ["bundle-provider-metadata-drift", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleProviderMetadataDrift)],
        [
          "bundle-provider-candidate-order-drift",
          S.decodeUnknownEffect(ImmutableDemoBundle)(bundleProviderCandidateOrderDrift),
        ],
        ["ledger-dangling-subject", S.decodeUnknownEffect(MutableReviewLedger)(danglingLedgerSubject)],
        ["ledger-duplicate-identity", S.decodeUnknownEffect(MutableReviewLedger)(duplicateLedgerIdentity)],
        ["retention-before-cutoff", S.decodeUnknownEffect(RetentionAuthorization)(retentionBeforeCutoff)],
        ["retention-at-cutoff", S.decodeUnknownEffect(RetentionAuthorization)(retentionAtCutoff)],
        ["retention-before-authorization", S.decodeUnknownEffect(RetentionAuthorization)(retentionBeforeAuthorization)],
      ];

      for (const [name, decode] of corruptions) {
        const failed = yield* decode.pipe(Effect.match({ onFailure: () => true, onSuccess: () => false }));
        expect(failed, name).toBe(true);
      }
    })
  );

  it.effect(
    "verifies the committed provider recording digest and source grounding",
    Effect.fnUntraced(function* () {
      const recording = yield* S.decodeEffect(ProviderRecordingFromJsonString)(providerRecordingJson);
      const verified = yield* verifyProviderRecording(recording, PROVIDER_RECORDING_SOURCE_TEXT).pipe(provideBunCrypto);
      const frozen = yield* verifyFrozenProviderRecording(recording, PROVIDER_RECORDING_SOURCE_TEXT).pipe(
        provideBunCrypto
      );
      expect(A.map(verified.candidates, (candidate) => candidate.label)).toEqual([
        "project",
        "delivery_date",
        "finish",
      ]);
      expect(frozen.recordedAt).toBe("2026-08-27T12:25:18.044Z");

      const digestFailure = yield* Effect.flip(
        verifyProviderRecording(
          ProviderRecording.make({
            ...recording,
            responseSha256: Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000"),
          }),
          PROVIDER_RECORDING_SOURCE_TEXT
        ).pipe(provideBunCrypto)
      );
      expect(digestFailure._tag).toBe("ProviderRecordingIntegrityError");
      expect(digestFailure.issue).toBe("candidate-digest");

      const [projectCandidate, deliveryCandidate, finishCandidate] = recording.candidates;
      const swappedCandidates = yield* S.decodeEffect(
        S.Tuple([ProviderCandidate, ProviderCandidate, ProviderCandidate])
      )([
        { label: projectCandidate.label, text: deliveryCandidate.text },
        { label: deliveryCandidate.label, text: projectCandidate.text },
        finishCandidate,
      ]);
      const swappedCandidateJson = yield* S.encodeEffect(ProviderCandidateListFromJsonString)(swappedCandidates);
      const swappedDigest = yield* S.decodeEffect(Sha256HexFromBytes)(strToU8(swappedCandidateJson)).pipe(
        provideBunCrypto
      );
      const contractFailure = yield* Effect.flip(
        verifyProviderRecording(
          ProviderRecording.make({ ...recording, candidates: swappedCandidates, responseSha256: swappedDigest }),
          PROVIDER_RECORDING_SOURCE_TEXT
        ).pipe(provideBunCrypto)
      );
      expect(contractFailure._tag).toBe("ProviderRecordingIntegrityError");
      expect(contractFailure.issue).toBe("candidate-contract");

      const reorderedCandidates = yield* S.decodeEffect(
        S.Tuple([ProviderCandidate, ProviderCandidate, ProviderCandidate])
      )([deliveryCandidate, projectCandidate, finishCandidate]);
      const reorderedCandidateJson = yield* S.encodeEffect(ProviderCandidateListFromJsonString)(reorderedCandidates);
      const reorderedDigest = yield* S.decodeEffect(Sha256HexFromBytes)(strToU8(reorderedCandidateJson)).pipe(
        provideBunCrypto
      );
      const frozenMutations: ReadonlyArray<readonly [string, ProviderRecording]> = [
        ["provider", ProviderRecording.make({ ...recording, provider: "xai" })],
        ["model", ProviderRecording.make({ ...recording, model: "altered-model" })],
        [
          "recorded-at",
          ProviderRecording.make({
            ...recording,
            recordedAt: IsoTimestamp.make("2026-08-27T13:25:18.044Z"),
          }),
        ],
        [
          "candidate-order",
          ProviderRecording.make({
            ...recording,
            candidates: reorderedCandidates,
            responseSha256: reorderedDigest,
          }),
        ],
      ];
      for (const [name, mutation] of frozenMutations) {
        const failure = yield* Effect.flip(
          verifyFrozenProviderRecording(mutation, PROVIDER_RECORDING_SOURCE_TEXT).pipe(provideBunCrypto)
        );
        expect(failure.issue, name).toBe("frozen-contract");
      }

      const groundingFailure = yield* Effect.flip(
        verifyProviderRecording(recording, "SYNTHETIC unrelated source").pipe(provideBunCrypto)
      );
      expect(groundingFailure._tag).toBe("ProviderRecordingIntegrityError");
      expect(groundingFailure.issue).toBe("source-grounding");

      const canonicalSourceDrift = yield* Effect.flip(
        verifyFrozenProviderRecording(recording, `${PROVIDER_RECORDING_SOURCE_TEXT} altered`).pipe(provideBunCrypto)
      );
      expect(canonicalSourceDrift.issue).toBe("source-grounding");
    })
  );

  it.effect(
    "replays the same bundle identity with provider and network unavailable",
    Effect.fnUntraced(function* () {
      const recording = yield* S.decodeEffect(ProviderRecordingFromJsonString)(providerRecordingJson);
      yield* verifyProviderRecording(recording, PROVIDER_RECORDING_SOURCE_TEXT).pipe(provideBunCrypto);
      const rebuild = () =>
        replayOffline(recording).pipe(provideScopedLayer(Layer.merge(BunCrypto.layer, makeInMemoryProjectionLayer())));
      const first = yield* rebuild();
      const second = yield* rebuild();

      expect(second.bundle).toEqual(first.bundle);
      expect(second.receipt).toEqual(first.receipt);
      expect(first.receipt.bundleIdentity).toBe(second.receipt.bundleIdentity);
      expect(first.receipt.providerAvailable).toBe(false);
      expect(first.receipt.networkAvailable).toBe(false);
      expect(first.mutableLedger).toEqual({
        approvals: [],
        claims: [],
        disposition: "delete-or-promote",
        dispositionDate: "2026-09-30",
        schemaVersion: "lejeune-review-ledger/v1",
      });
    })
  );
});
