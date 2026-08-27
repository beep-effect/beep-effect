// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProviderCandidate, ProviderRecording } from "@/domain/Bundle";
import { buildNormalizedFixtures } from "@/domain/Normalize";
import { IsoTimestamp, OntologyClassName } from "@/domain/Ontology";
import { buildProjectionSnapshot, makeProjectionLayer, ProjectionInput } from "@/domain/Projections";
import { buildReferenceData } from "@/domain/ReferenceData";
import { replayOffline } from "@/domain/Replay";
import { evaluateRules } from "@/domain/Rules";
import { FrozenFixtureManifest } from "@/fixtures/FixtureManifest";
import fixtureManifestJson from "@/fixtures/fixture-manifest.json";
import { buildFixtureArtifacts } from "@/fixtures/Sources";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideBunCrypto = provideScopedLayer(BunCrypto.layer);

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
      const rebuild = () =>
        buildProjectionSnapshot(input).pipe(provideScopedLayer(makeProjectionLayer({ duckDbPath: ":memory:" })));
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
    "replays the same bundle identity with provider and network unavailable",
    Effect.fnUntraced(function* () {
      const recording = ProviderRecording.make({
        candidates: [ProviderCandidate.make({ label: "project", text: "North Loop Canopy" })],
        documentId: "lejeune-test-recording",
        model: "test-only-recording",
        provider: "anthropic",
        recordedAt: IsoTimestamp.make("2026-08-27T00:00:00.000Z"),
        responseSha256: Sha256Hex.make("d22f6f638090bce28d8e968c2bfa88d4c7e67c8505ba3d3f10f8bce29d7c12eb"),
      });
      const rebuild = () =>
        replayOffline(recording).pipe(
          provideScopedLayer(Layer.merge(BunCrypto.layer, makeProjectionLayer({ duckDbPath: ":memory:" })))
        );
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
