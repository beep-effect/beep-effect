// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ImmutableDemoBundle,
  NormalizedFixture,
  PROVIDER_RECORDING_SOURCE_TEXT,
  ProjectionSnapshot,
  ProviderRecording,
  ProviderRecordingFromJsonString,
  RuleResult,
  verifyProviderRecording,
} from "@/domain/Bundle";
import { buildNormalizedFixtures } from "@/domain/Normalize";
import { IsoDate, IsoTimestamp, OntologyClassName, ProductVariant } from "@/domain/Ontology";
import {
  buildProjectionSnapshot,
  makeProjectionLayer,
  ProjectionInput,
  ProjectionLayerOptions,
} from "@/domain/Projections";
import { buildReferenceData } from "@/domain/ReferenceData";
import { replayOffline } from "@/domain/Replay";
import { evaluateRules } from "@/domain/Rules";
import { FrozenFixtureManifest } from "@/fixtures/FixtureManifest";
import fixtureManifestJson from "@/fixtures/fixture-manifest.json";
import providerRecordingJson from "@/fixtures/provider-recording.json?raw";
import { buildFixtureArtifacts } from "@/fixtures/Sources";

const provideBunCrypto = provideScopedLayer(BunCrypto.layer);
const makeInMemoryProjectionLayer = () => makeProjectionLayer(ProjectionLayerOptions.make({ duckDbPath: ":memory:" }));

describe("LeJeune deterministic fixture bundle", () => {
  it.effect(
    "generates exactly four stable synthetic source records across the two authorized layouts",
    Effect.fnUntraced(function* () {
      const [first, second] = yield* Effect.all([buildFixtureArtifacts, buildFixtureArtifacts], {
        concurrency: 1,
      }).pipe(provideBunCrypto);
      const manifest = yield* S.decodeUnknownEffect(FrozenFixtureManifest)(fixtureManifestJson);

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

      expect(OntologyClassName.Options).toEqual([
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

      const fixtureSourceCardinality: unknown = { ...fixture, sources: A.take(fixture.sources, 1) };
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
      const bundleFixtureCardinality: unknown = { ...bundle, fixtures: A.take(bundle.fixtures, 1) };
      const bundleRuleCardinality: unknown = { ...bundle, rules: A.take(bundle.rules, 1) };
      const projectionClassVocabulary: unknown = {
        ...bundle.projection,
        ontologyClasses: ["BogusClass", ...A.drop(bundle.projection.ontologyClasses, 1)],
      };

      const corruptions: ReadonlyArray<readonly [string, Effect.Effect<unknown, S.SchemaError>]> = [
        ["fixture-source-cardinality", S.decodeUnknownEffect(NormalizedFixture)(fixtureSourceCardinality)],
        ["fixture-dangling-source", S.decodeUnknownEffect(NormalizedFixture)(fixtureDanglingSource)],
        ["fixture-value-drift", S.decodeUnknownEffect(NormalizedFixture)(fixtureValueDrift)],
        ["fixture-referential-drift", S.decodeUnknownEffect(NormalizedFixture)(fixtureReferentialDrift)],
        ["rule-human-stop", S.decodeUnknownEffect(RuleResult)(ruleHumanStop)],
        ["manifest-source-cardinality", S.decodeUnknownEffect(FrozenFixtureManifest)(manifestSourceCardinality)],
        ["bundle-fixture-cardinality", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleFixtureCardinality)],
        ["bundle-rule-cardinality", S.decodeUnknownEffect(ImmutableDemoBundle)(bundleRuleCardinality)],
        ["projection-class-vocabulary", S.decodeUnknownEffect(ProjectionSnapshot)(projectionClassVocabulary)],
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
      expect(A.map(verified.candidates, (candidate) => candidate.label)).toEqual([
        "project",
        "delivery_date",
        "finish",
      ]);

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

      const groundingFailure = yield* Effect.flip(
        verifyProviderRecording(recording, "SYNTHETIC unrelated source").pipe(provideBunCrypto)
      );
      expect(groundingFailure._tag).toBe("ProviderRecordingIntegrityError");
      expect(groundingFailure.issue).toBe("source-grounding");
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
