import { ExtractionCandidate, parseModelOutput } from "@beep/langextract/Extraction";
import { Position } from "@beep/text/OffsetUnit";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import {
  RelationPreviewManifest,
  RelationPreviewOptions,
  replayRelationHandoff,
  runRelationPreview,
} from "@/canary/RelationPreview";
import { CorpusManifest, CorpusPaperId, ManifestDecodeFailed } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import { F1Catalog, F1Index } from "@/fixtures/F1";
import * as ExtractorLive from "@/layers/ExtractorLive";
import { LabConfigLive } from "@/runtime/Config";
import { contentDigestSync, sha256TextSync } from "@/schema/Digest";
import { DocumentUnavailable } from "@/schema/Errors";
import { ModelIdentity } from "@/schema/Model";
import { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";
import { DocumentSource } from "@/services/DocumentSource";
import { Parser } from "@/services/Parser";
import indexFixture from "../fixtures/f1/index.json";
import manifestFixture from "../fixtures/w1.manifest.json";

// @vitest-environment node

import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import {
  GroundedExtraction,
  LangExtractDiagnostics,
  LangExtractError,
  LangExtractResult,
} from "@beep/langextract/Extraction";
import { handoff, startExtraction } from "@beep/langextract/Handoff";
import { buildPrompt, LangExtractService } from "@beep/langextract/Service";
import { notSupported } from "@beep/nlp-processing/Backend/NLPBackend";
import { EntityNode } from "@beep/nlp-processing/Graph/Schema";
import { NLPService } from "@beep/nlp-processing/NLPService";
import { Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { SourceTextExtractor, TextAnchor } from "@beep/text";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/text/VerifiedTextAnchor";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Struct from "effect/Struct";
import { F1FixtureId } from "@/fixtures/F1";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { HostedExtractorLive, PatternExtractorLive } from "@/layers/ExtractorLive";
import { ActiveModelIdentityLive } from "@/layers/LanguageModelLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import {
  ClaimBody,
  EvidenceBatch,
  ExtractOutcome,
  FrozenRelationPredicate,
  RelationExtractionCandidate,
} from "@/schema/Evidence";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { Chunk, makeChunkId, ParseOutcome } from "@/schema/Text";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";

const decodeRelationExtractionCandidateResult = S.decodeResult(RelationExtractionCandidate);

import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect, vi } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import { constant, pipe } from "effect/Function";
import * as Str from "effect/String";
import { HostedExtractor, PatternExtractor } from "@/services/Extractor";

const documentId = DocumentId.make(Str.repeat(64)("1"));
const document = SourceDocument.make({
  acquired: ProvenanceEventId.make(Str.repeat(64)("2")),
  bytes: S.Natural.make(1),
  id: documentId,
  mediaType: "text/markdown",
  origin: Origin.cases.Fixture.make({
    declared: FixtureDeclaration.make({ degradedKind: O.none(), expectation: "parses" }),
    fixtureId: F1FixtureId.make("md-structure"),
    kind: "Fixture",
    relativePath: "documents/md-structure.md",
  }),
  sha256: documentId,
});

const model = ModelIdentity.make({
  artifactHash: Sha256Hex.make(Str.repeat(64)("3")),
  name: "stub-extractor-20260826",
  provider: "anthropic",
  revision: "stub-extractor-20260826",
  taskType: "extraction",
});

const canonicalizerLayer = CanonicalizerLive.pipe(Layer.provide(BunCrypto.layer));
const chunkerLayer = ChunkerLive.pipe(Layer.provide(canonicalizerLayer), Layer.provide(BunCrypto.layer));
const baseLayer = Layer.mergeAll(BunCrypto.layer, canonicalizerLayer, chunkerLayer);
const makeCanonical = Effect.fn("ExtractorTest.makeCanonical")(function* (text: string) {
  const canonicalizer = yield* Canonicalizer;
  const chunker = yield* Chunker;
  const parsed = ParseOutcome.cases.Parsed.make({
    document: document.id,
    extractor: SourceTextExtractor.make({ name: "extractor-test", version: "0.0.0" }),
    outcome: "Parsed",
    text,
  });
  const canonical = yield* canonicalizer.identify(document, parsed);
  return { canonical, chunks: yield* chunker.chunk(canonical) };
});

const grounded = (
  label: string,
  text: string,
  start: number,
  attributes: O.Option<Record<string, string>> = O.none()
) =>
  GroundedExtraction.cases.match_exact.make({
    alignmentStatus: "match_exact",
    attributes,
    confidence: O.none(),
    label,
    anchor: TextAnchor.make({
      endChar: S.Natural.make(start + text.length),
      quote: text,
      startChar: S.Natural.make(start),
    }),
    text,
  });

const langExtractLayer = (extractions: ReadonlyArray<GroundedExtraction>) =>
  Layer.effect(
    LangExtractService,
    Effect.gen(function* () {
      const digest = yield* Digest.Digest;
      return LangExtractService.of({
        extract: Effect.fn("LangExtractService.stub")(
          function* (request) {
            const verified = yield* verifySourceTextIdentity(
              VerifySourceTextIdentityInput.make({
                source: request.source,
                expectedSource: request.source,
                sourceText: request.text,
              })
            ).pipe(Effect.orDie);
            const prompt = yield* buildPrompt(request);
            const activity = yield* startExtraction({ source: request.source, prompt, started: 0 }).pipe(
              Effect.provideService(Model.ProviderName, "test"),
              Effect.provideService(Model.ModelName, "stub-model"),
              Effect.orDie
            );
            const extractionHandoff = yield* handoff({
              targets: request.targets,
              candidates: extractions,
              verified,
              activity,
              at: DateTime.makeUnsafe(0),
            });
            return LangExtractResult.make({
              handoff: extractionHandoff,
              diagnostics: LangExtractDiagnostics.make({
                alignedCount: S.Natural.make(A.length(extractions)),
                candidateCount: S.Natural.make(A.length(extractions)),
                promptChars: S.Natural.make(request.text.length),
                unalignedCount: S.Natural.make(0),
              }),
            });
          },
          Effect.provideService(Digest.Digest, digest)
        ),
      });
    })
  ).pipe(Layer.provide(BunCrypto.layer));

const hostedLayer = (extractions: ReadonlyArray<GroundedExtraction>) =>
  HostedExtractorLive.pipe(
    Layer.provide(langExtractLayer(extractions)),
    Layer.provide(ActiveModelIdentityLive(model)),
    Layer.provide(canonicalizerLayer)
  );

const hostedFailureLayer = (reason: "model-generation-failed" | "model-output-parse-failed") =>
  HostedExtractorLive.pipe(
    Layer.provide(
      Layer.succeed(
        LangExtractService,
        LangExtractService.of({
          extract: Effect.fn("LangExtractService.stubFailure")(() =>
            Effect.fail(LangExtractError.fromReason(reason, { message: "stub extraction failure" }))
          ),
        })
      )
    ),
    Layer.provide(ActiveModelIdentityLive(model)),
    Layer.provide(canonicalizerLayer)
  );

const hostedCase = (
  name: string,
  text: string,
  extractionsOf: (text: string) => ReadonlyArray<GroundedExtraction>
) => ({ extractions: extractionsOf(text), name, text });

const firstStartOf = (surface: string, text: string) => O.getOrElse(constant(-1))(Str.indexOf(surface)(text));
const lastStartOf = (surface: string, text: string) => O.getOrElse(constant(-1))(Str.lastIndexOf(surface)(text));
const relationAttributes = O.some({ object: "Engine", predicate: "selected", subject: "Ada" });

const clusterCase = hostedCase("coreference cluster", "Ada wrote notes.", () => [
  GroundedExtraction.cases.match_exact.make({
    ...grounded("person", "Ada", 0, O.some({ cluster: "person-ada" })),
    confidence: UnitInterval.makeOption(1),
  }),
]);

const synthesizedEndpointsCase = hostedCase(
  "synthesized relation endpoints",
  "Ada wrote notes. Ada selected Engine.",
  (text) => [grounded("relation", "Ada selected Engine.", lastStartOf("Ada", text), relationAttributes)]
);

const reusedEndpointsCase = hostedCase("reused relation endpoints", "Ada wrote notes. Ada selected Engine.", (text) => [
  grounded("person", "Ada", lastStartOf("Ada", text)),
  grounded("method", "Engine", firstStartOf("Engine", text)),
  grounded("relation", "Ada selected Engine.", lastStartOf("Ada", text), relationAttributes),
]);

const unresolvedRelationCase = hostedCase("unresolved relation", "Ada praised Engine.", (text) => [
  grounded("person", "Ada", 0),
  grounded("method", "Engine", firstStartOf("Engine", text)),
  grounded("relation", text, 0, O.some({ object: "Engine", predicate: "praised", subject: "Missing" })),
]);

const malformedRelationCase = hostedCase("malformed relation contract", "Ada selected Engine.", (text) => [
  grounded("relation", text, 0, O.some({ object: "Engine", subject: "Ada" })),
]);

const fuzzyRelationCase = hostedCase("fuzzy relation evidence", "Ada selected Engine.", (text) => [
  GroundedExtraction.cases.match_fuzzy.make({
    alignmentStatus: "match_fuzzy",
    attributes: relationAttributes,
    confidence: O.none(),
    label: "relation",
    anchor: TextAnchor.make({ endChar: S.Natural.make(text.length), quote: text, startChar: S.Natural.make(0) }),
    text,
  }),
]);

const hostedCases = [
  clusterCase,
  synthesizedEndpointsCase,
  reusedEndpointsCase,
  unresolvedRelationCase,
  malformedRelationCase,
  fuzzyRelationCase,
];

class FrozenHostedBatch extends S.Opaque<FrozenHostedBatch, { readonly brand: unique symbol }>()(
  S.Struct({ batch: EvidenceBatch, name: S.NonEmptyString })
) {}

const FrozenHostedBatchesJson = S.fromJsonString(S.Array(FrozenHostedBatch), { space: 2 });
const OpenFields = S.Record(S.String, S.Unknown);
const V1HostedClaim = S.StructWithRest(S.Struct({ confidence: S.Finite }), [OpenFields]);
const FreshHostedClaim = S.StructWithRest(S.Struct({ confidence: ExtractorConfidence }), [OpenFields]);
const V1HostedBatchesJson = S.Struct({
  name: S.String,
  batch: S.StructWithRest(S.Struct({ claims: S.Array(V1HostedClaim) }), [OpenFields]),
}).pipe(S.Array, S.fromJsonString);
const FreshHostedBatchesJson = S.Struct({
  name: S.String,
  batch: S.StructWithRest(S.Struct({ claims: S.Array(FreshHostedClaim) }), [OpenFields]),
}).pipe(S.Array, S.fromJsonString);
const withoutConfidence = <Claim extends { readonly confidence: unknown }>(
  batches: ReadonlyArray<{
    readonly name: string;
    readonly batch: { readonly claims: ReadonlyArray<Claim> } & { readonly [key: string]: unknown };
  }>
) =>
  A.map(batches, ({ name, batch }) => ({
    name,
    batch: { ...batch, claims: A.map(batch.claims, Struct.omit(["confidence"])) },
  }));
const confidencePairs = (v1: typeof V1HostedBatchesJson.Type, fresh: typeof FreshHostedBatchesJson.Type) =>
  A.flatMap(A.zip(v1, fresh), ([old, current]) =>
    A.map(
      A.zip<typeof V1HostedClaim.Type, typeof FreshHostedClaim.Type>(old.batch.claims, current.batch.claims),
      ([oldClaim, freshClaim]) => ({
        name: current.name,
        v1: oldClaim.confidence,
        fresh: freshClaim.confidence,
      })
    )
  );
const hostedPin = ActivityPin.cases.Model.make({ model: model.name, version: model.revision });
const sameSignal = S.toEquivalence(ExtractorConfidence);

const hostedBatch = Effect.fn("ExtractorTest.hostedBatch")(function* (hosted: (typeof hostedCases)[number]) {
  const outcome = yield* provideScopedLayer(Layer.merge(baseLayer, hostedLayer(hosted.extractions)))(
    Effect.gen(function* () {
      const { canonical, chunks } = yield* makeCanonical(hosted.text);
      const extractor = yield* HostedExtractor;
      return yield* extractor.extract(canonical, chunks);
    })
  );
  if (outcome.outcome === "Degraded") {
    return yield* Effect.die(new Error(outcome.detail));
  }
  return FrozenHostedBatch.make({ batch: outcome.batch, name: hosted.name });
});

it.layer(BunFileSystem.layer, { timeout: 60_000 })("C0 hosted extractor frozen batch", (it) => {
  it.effect(
    "keeps the bytes of the hosted evidence batches over this file's model outputs",
    () =>
      Effect.gen(function* () {
        const batches = yield* Effect.forEach(hostedCases, hostedBatch, { concurrency: 1 });
        const json = yield* S.encodeEffect(FrozenHostedBatchesJson)(batches);
        const fs = yield* FileSystem.FileSystem;
        const v1Path = yield* fs.realPath("test/fixtures/hosted-batch-v1.json");
        const v1Text = yield* fs.readFileString(v1Path);
        const v1 = yield* S.decodeEffect(V1HostedBatchesJson)(v1Text);
        const fresh = yield* S.decodeEffect(FreshHostedBatchesJson)(`${json}\n`);
        expect(withoutConfidence(fresh)).toEqual(withoutConfidence(v1));

        const pairs = confidencePairs(v1, fresh);
        const reportedPairs = A.filter(pairs, (pair) => pair.fresh._tag === "Present");
        const absentPairs = A.filter(pairs, (pair) => pair.fresh._tag === "Absent");
        expect(A.map(reportedPairs, (pair) => pair.name)).toEqual(["coreference cluster"]);
        expect(
          A.every(reportedPairs, (pair) =>
            sameSignal(
              pair.fresh,
              ExtractorConfidence.cases.Present.make({
                value: ReportedConfidence.make({
                  value: Confidence.make(pair.v1),
                  method: "hosted-langextract",
                  producer: O.some(hostedPin),
                }),
              })
            )
          )
        ).toBe(true);
        expect(A.length(absentPairs)).toBe(8);
        expect(
          A.every(
            absentPairs,
            (pair) =>
              pair.v1 === 1 && sameSignal(pair.fresh, ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" }))
          )
        ).toBe(true);
      }),
    { timeout: 60_000 }
  );
});

describe("C0 hosted extractor", () => {
  it("keeps the frozen target vocabulary separate from the legacy-preview relation contract", () => {
    expect(FrozenRelationPredicate.literals).toEqual([
      "affiliated with",
      "authored by",
      "located in",
      "re-evaluates claim due to",
      "selected",
      "shows",
    ]);
    pipe(
      decodeRelationExtractionCandidateResult({
        evidenceQuote: "Ada trained Engine.",
        object: "Engine",
        predicate: "trained",
        subject: "Ada",
      }),
      Result.isSuccess,
      assertTrue
    );
  });

  {
    const { extractions, text } = clusterCase;
    it.layer(Layer.merge(baseLayer, hostedLayer(extractions)), { timeout: "30 seconds" })((it) => {
      it.effect("preserves hosted coreference cluster assignments on entity claims", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            const cluster = A.findFirst(outcome.batch.claims, (claim) => claim.body.kind === "Entity").pipe(
              O.flatMap((claim) =>
                ClaimBody.match(claim.body, {
                  Entity: (body) => body.cluster,
                  Relation: () => O.none(),
                  Structure: () => O.none(),
                })
              )
            );
            assertSome(cluster, "person-ada");
          }
        })
      );
    });
  }

  {
    const { extractions, text } = synthesizedEndpointsCase;
    const relationStart = lastStartOf("Ada", text);
    const engineStart = firstStartOf("Engine", text);
    it.layer(Layer.merge(baseLayer, hostedLayer(extractions)), { timeout: "30 seconds" })((it) => {
      it.effect("anchors repeated endpoint surfaces inside relation evidence and synthesizes same-batch entities", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Degraded") {
            return yield* Effect.die(new Error(outcome.detail));
          }
          const entities = A.filter(outcome.batch.claims, (claim) => claim.body.kind === "Entity");
          const relation = A.findFirst(outcome.batch.claims, (claim) => claim.body.kind === "Relation");
          const subject = A.findFirst(entities, (claim) => claim.body.startChar === relationStart);
          const object = A.findFirst(entities, (claim) => claim.body.startChar === engineStart);
          pipe(relation, O.isSome, assertTrue);
          pipe(subject, O.isSome, assertTrue);
          pipe(object, O.isSome, assertTrue);
          expect(entities).toHaveLength(2);
          deepStrictEqual(
            O.map(relation, (claim) =>
              ClaimBody.match(claim.body, {
                Entity: () => O.none(),
                Relation: (body) => O.some([body.subject, body.object]),
                Structure: () => O.none(),
              })
            ),
            O.all([O.map(subject, (claim) => claim.id), O.map(object, (claim) => claim.id)]).pipe(O.map(O.some))
          );
          expect(outcome.batch.degraded).toEqual([]);
        })
      );
    });
  }

  {
    const { extractions, text } = reusedEndpointsCase;
    const secondAda = lastStartOf("Ada", text);
    it.layer(Layer.merge(baseLayer, hostedLayer(extractions)), { timeout: "30 seconds" })((it) => {
      it.effect("reuses base entity claims already anchored inside the relation evidence", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            expect(A.filter(outcome.batch.claims, (claim) => claim.body.kind === "Relation")).toHaveLength(1);
            expect(A.filter(outcome.batch.claims, (claim) => claim.body.kind === "Entity")).toHaveLength(2);
            assertSome(
              A.findFirst(outcome.batch.claims, (claim) => claim.body.kind === "Entity").pipe(
                O.map((claim) => claim.body.startChar)
              ),
              secondAda
            );
            expect(outcome.batch.degraded).toEqual([]);
          }
        })
      );
    });
  }

  {
    const { extractions, text } = unresolvedRelationCase;
    it.layer(Layer.merge(baseLayer, hostedLayer(extractions)), { timeout: "30 seconds" })((it) => {
      it.effect("retains an unresolved relation as a degraded claim", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            expect(outcome.batch.degraded).toMatchObject([{ kind: "relation-unresolved" }]);
            pipe(
              A.some(outcome.batch.claims, (claim) => claim.body.kind === "Relation"),
              assertFalse
            );
          }
        })
      );
    });
  }

  {
    const { extractions, text } = malformedRelationCase;
    it.layer(Layer.merge(baseLayer, hostedLayer(extractions)), { timeout: "30 seconds" })((it) => {
      it.effect("fails a malformed relation contract as typed model-output degradation", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            expect(outcome.batch.degraded).toMatchObject([{ kind: "model-output-invalid" }]);
            expect(outcome.batch.claims).toEqual([]);
          }
        })
      );
    });
  }

  {
    const { extractions, text } = fuzzyRelationCase;
    it.layer(Layer.merge(baseLayer, hostedLayer(extractions)), { timeout: "30 seconds" })((it) => {
      it.effect("disqualifies fuzzy alignment for relation evidence", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            expect(outcome.batch.degraded).toMatchObject([{ kind: "fabricated-span" }]);
            expect(outcome.batch.claims).toEqual([]);
          }
        })
      );
    });
  }

  it.effect.each([
    ["model-generation-failed", "provider-unavailable"],
    ["model-output-parse-failed", "model-output-invalid"],
  ] as const)("maps %s to a %s outcome value", ([reason, expectedKind]) =>
    provideScopedLayer(Layer.merge(baseLayer, hostedFailureLayer(reason)))(
      Effect.gen(function* () {
        const { canonical, chunks } = yield* makeCanonical("Ada wrote a method.");
        const extractor = yield* HostedExtractor;
        const outcome = yield* extractor.extract(canonical, chunks);

        expect(outcome).toMatchObject({ kind: expectedKind, lane: "hosted", outcome: "Degraded" });
      })
    )
  );
});

describe("C0 pattern extractor", () => {
  for (const span of [
    Position.makeOption({ unit: "utf16-code-unit", end: 5, start: 0 }),
    O.none<Position>(),
    Position.makeOption({ unit: "unicode-code-point", end: 5, start: 0 }),
  ]) {
    const nlp = Layer.succeed(
      NLPService,
      NLPService.of({
        extractEntities: Effect.fn("NLPService.extractEntities")(() =>
          Effect.succeed([
            EntityNode.make({
              entityType: "PERSON",
              span,
              text: "Absent",
              timestamp: 0,
            }),
          ])
        ),
        extractRelations: Effect.fn("NLPService.extractRelations")(() => Effect.succeed([])),
        getBackend: Effect.die(new Error("unused")),
        processText: Effect.fn("NLPService.processText")(() => Effect.die(new Error("unused"))),
        tagPartsOfSpeech: Effect.fn("NLPService.tagPartsOfSpeech")(() => Effect.succeed([])),
      })
    );
    const pattern = PatternExtractorLive.pipe(Layer.provide(nlp), Layer.provide(canonicalizerLayer));
    it.layer(Layer.merge(baseLayer, pattern), { timeout: "30 seconds" })((it) => {
      it.effect("turns an absent or width-mismatched Wink span into fabricated-span", () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical("Alice writes.");
          const extractor = yield* PatternExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            expect(outcome.batch.claims).toEqual([]);
            expect(outcome.batch.degraded).toMatchObject([{ kind: "fabricated-span" }]);
            expect(outcome.batch.lossy).toEqual(["relations-not-supported", "structure-not-supported"]);
          }
        })
      );
    });
  }
});

const PreviewResponseJson = S.fromJsonString(S.Struct({ extractions: S.Array(ExtractionCandidate) }));
const encodePreviewResponse = S.encodeEffect(PreviewResponseJson);
const PreviewTailArbitrary = Arbitrary.schema(ExtractionCandidate);

describe("relation preview replay cap", () => {
  it.layer(Layer.merge(baseLayer, Digest.layerWebCrypto), { timeout: "30 seconds" })((it) => {
    it.effect.prop(
      "preserves schema-derived parsed candidate fields in the over-cap residual",
      { tail: PreviewTailArbitrary },
      ({ tail }) =>
        Effect.gen(function* () {
          const { canonical } = yield* makeCanonical("Ada knows Bob.");
          const prefix = A.makeBy(256, () => ExtractionCandidate.make({ label: "person", text: "Bob" }));
          const response = yield* encodePreviewResponse({ extractions: A.append(prefix, tail) });
          const parsed = yield* parseModelOutput(response);
          const original = A.getUnsafe(parsed, 256);
          const h = yield* replayRelationHandoff(canonical, response, model);
          expect(h.candidateCount).toBe(257);
          const residual = A.filter(h.residual, (candidate) => candidate.candidate === 256);
          expect(residual).toHaveLength(1);
          const { anchor, ...fields } = A.getUnsafe(residual, 0);
          assertNone(anchor);
          expect(fields).toEqual({
            ...original,
            candidate: 256,
            alignment: "unaligned",
            reason: "over-extraction-cap",
          });
        }),
      { arbitrary: fcRuns(25) }
    );
    it.effect(
      "preserves all 257 parsed candidates and the unattempted tail",
      Effect.fnUntraced(function* () {
        const { canonical } = yield* makeCanonical("Ada knows Bob.");
        const raw = A.makeBy(257, (index) =>
          ExtractionCandidate.make({
            label: index === 256 ? "tail-label" : "person",
            text: "Bob",
            attributes: O.some({ index: `${index}` }),
          })
        );
        const response = yield* encodePreviewResponse({ extractions: raw });
        const h = yield* replayRelationHandoff(canonical, response, model);
        expect(h.candidateCount).toBe(257);
        expect(A.length(A.appendAll(h.readings.pipe(HashMap.toValues, A.flatten), h.residual))).toBe(257);
        const { anchor, ...tail } = A.getUnsafe(h.residual, h.residual.length - 1);
        assertNone(anchor);
        expect(tail).toEqual({
          ...A.getUnsafe(raw, 256),
          candidate: 256,
          reason: "over-extraction-cap",
          alignment: "unaligned",
        });
      })
    );
  });
});

const decodePreviewCorpus = S.decodeUnknownEffect(CorpusManifest);
const decodePreviewFixtures = S.decodeUnknownEffect(F1Index);
const encodePreviewCases = S.encodeEffect(S.fromJsonString(RelationPreviewManifest));
const encodePreviewCache = S.encodeEffect(S.fromJsonString(ProviderCacheEntry));
const previewOptions = RelationPreviewOptions.make({ cases: "cases", manifest: "manifest" });
const replayPreview = Effect.fn("ExtractorTest.replayPreview")(function* (scenario: string) {
  const manifest = yield* decodePreviewCorpus(manifestFixture);
  const fixtures = yield* decodePreviewFixtures(indexFixture);
  const paperId = CorpusPaperId.make("06c93f91ef3d");
  const response =
    scenario === "response-invalid"
      ? "bad response"
      : scenario === "floor"
        ? '{"extractions":[]}'
        : '{"extractions":[{"label":"relation","text":"Ada knows Bob.","attributes":{"subject":"Ada","object":"Bob","predicate":"shows"}}]}';
  const key = ProviderCacheKey.make({
    inputDigest: sha256TextSync("preview-test"),
    model: scenario === "grounding" ? ModelIdentity.make({ ...model, name: "degraded-preview" }) : model,
    requestKind: "generate-text",
    schemaVersion: "provider-cache/v1",
  });
  const cacheKey = Result.getOrThrow(contentDigestSync(ProviderCacheKey)(key));
  const entry = ProviderCacheEntry.make({ key, cacheKey, response, responseDigest: sha256TextSync(response) });
  const cache = yield* encodePreviewCache(entry);
  const cases = yield* encodePreviewCases(
    RelationPreviewManifest.make({
      cases: [{ paperId, cacheDigest: scenario === "cache-key" ? Sha256Hex.make(Str.repeat(64)("0")) : cacheKey }],
    })
  );
  const noop = FileSystem.makeNoop({});
  const fs = FileSystem.makeNoop({
    readFileString: (path) => {
      if (scenario === "cases-unavailable" || (path !== "cases" && scenario === "cache-unavailable"))
        return noop.readFileString(path);
      return Effect.succeed(
        path === "cases"
          ? scenario === "cases-invalid"
            ? "bad json"
            : cases
          : scenario === "cache-invalid"
            ? "bad json"
            : cache
      );
    },
  });
  const selected = SourceDocument.make({
    ...document,
    origin: Origin.cases.W1Paper.make({ corpusId: "synthetic", paperId, relativePath: "synthetic.pdf" }),
  });
  const sourceFailure = DocumentUnavailable.make({ message: "synthetic unavailable" });
  const source = DocumentSource.of({
    list: Effect.fn("DocumentSource.list")(function* () {
      if (scenario === "list") return yield* sourceFailure;
      return scenario === "absent" ? [document] : [document, selected];
    }),
    read: Effect.fn("DocumentSource.read")(function* () {
      if (scenario === "read") return yield* sourceFailure;
      return new Uint8Array();
    }),
  });
  const parser = Parser.of({
    parse: Effect.fn("Parser.parse")(() =>
      Effect.succeed(
        scenario === "parse"
          ? ParseOutcome.cases.Degraded.make({ document: document.id, kind: "truncated", detail: "synthetic degraded" })
          : ParseOutcome.cases.Parsed.make({
              document: document.id,
              text: "Ada knows Bob.",
              extractor: SourceTextExtractor.make({ name: "synthetic", version: "1" }),
            })
      )
    ),
  });
  const builder = CorpusManifestBuilder.of({
    build: Effect.succeed(manifest),
    load: Effect.fn("CorpusManifestBuilder.load")(() => Effect.succeed(manifest)),
    check: Effect.fn("CorpusManifestBuilder.check")(function* () {
      if (scenario === "manifest")
        return yield* ManifestDecodeFailed.make({ message: "synthetic manifest failure", manifestPath: "manifest" });
      return manifest;
    }),
  });
  return yield* runRelationPreview(previewOptions).pipe(
    Effect.provideService(FileSystem.FileSystem, fs),
    Effect.provideService(DocumentSource, source),
    Effect.provideService(Parser, parser),
    Effect.provideService(CorpusManifestBuilder, builder),
    Effect.provideService(F1Catalog, F1Catalog.of({ load: Effect.succeed(fixtures) }))
  );
});

describe("relation preview boundaries", () => {
  const config = LabConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
  it.layer(Layer.mergeAll(baseLayer, Digest.layerWebCrypto, Path.layer, config), { timeout: "30 seconds" })((it) => {
    it.effect(
      "reports grounded replay counts",
      Effect.fnUntraced(function* () {
        const report = yield* replayPreview("success");
        expect(report.groundedRelations).toBe(1);
        expect(report.cases[0]?.candidateCount).toBe(1);
      })
    );
    it.effect(
      "refuses a typed degradation returned by grounding",
      Effect.fnUntraced(function* () {
        const original = ExtractorLive.groundHostedHandoff;
        const grounding = vi.spyOn(ExtractorLive, "groundHostedHandoff").mockImplementation((...args) =>
          args[4].name === "degraded-preview"
            ? Effect.succeed(
                ExtractOutcome.cases.Degraded.make({
                  document: document.id,
                  lane: "hosted",
                  kind: "model-output-invalid",
                  detail: "synthetic degradation",
                })
              )
            : original(...args)
        );
        try {
          const error = yield* replayPreview("grounding").pipe(Effect.flip);
          expect(error._tag).toBe("RelationPreviewFailed");
          if (error._tag === "RelationPreviewFailed") expect(error.reason).toBe("response-invalid");
        } finally {
          grounding.mockRestore();
        }
      })
    );
    it.effect(
      "refuses unavailable, invalid, ungrounded and degraded replay inputs",
      Effect.fnUntraced(function* () {
        for (const [scenario, reason] of [
          ["cases-unavailable", "manifest-invalid"],
          ["cases-invalid", "manifest-invalid"],
          ["cache-unavailable", "cache-unavailable"],
          ["cache-invalid", "cache-invalid"],
          ["cache-key", "cache-invalid"],
          ["manifest", "manifest-invalid"],
          ["list", "source-unavailable"],
          ["absent", "source-unavailable"],
          ["read", "source-unavailable"],
          ["parse", "parse-degraded"],
          ["response-invalid", "response-invalid"],
          ["floor", "preview-floor-not-met"],
        ] as const) {
          const error = yield* replayPreview(scenario).pipe(Effect.flip);
          expect(error._tag).toBe("RelationPreviewFailed");
          if (error._tag === "RelationPreviewFailed") expect(error.reason).toBe(reason);
        }
      })
    );
  });
});

describe("pattern extractor boundary outcomes", () => {
  for (const scenario of ["default-identity", "failure"]) {
    const nlp = Layer.succeed(
      NLPService,
      NLPService.of({
        extractEntities: Effect.fn("PatternBoundaryTest.extractEntities")(function* () {
          if (scenario === "failure") return yield* notSupported("test", "extractEntities");
          return [
            EntityNode.make({
              entityType: "",
              span: Position.makeOption({ unit: "utf16-code-unit", start: 0, end: 5 }),
              text: "Alice",
              timestamp: 0,
            }),
          ];
        }),
        extractRelations: Effect.fn("PatternBoundaryTest.extractRelations")(() => Effect.succeed([])),
        getBackend: Effect.die("unused"),
        processText: Effect.fn("PatternBoundaryTest.processText")(() => Effect.die("unused")),
        tagPartsOfSpeech: Effect.fn("PatternBoundaryTest.tagPartsOfSpeech")(() => Effect.succeed([])),
      })
    );
    const pattern = PatternExtractorLive.pipe(Layer.provide(nlp), Layer.provide(canonicalizerLayer));
    it.layer(Layer.merge(baseLayer, pattern), { timeout: "30 seconds" })((it) => {
      it.effect(`preserves the ${scenario} boundary outcome`, () =>
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical("Alice writes.");
          const extractor = yield* PatternExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);
          if (scenario === "failure") {
            expect(outcome).toMatchObject({ outcome: "Degraded", kind: "extraction-failed" });
          } else {
            expect(outcome).toMatchObject({
              outcome: "Extracted",
              batch: {
                claims: [
                  {
                    confidence: { _tag: "Absent", reason: "not-assessed" },
                    body: { entityType: "UNKNOWN", quote: "Alice" },
                  },
                ],
              },
            });
          }
        })
      );
    });
  }
});

describe("hosted handoff residual and structure projection", () => {
  const text = "Ada selected Engine. Bob trained Engine.";
  const cases = [
    {
      name: "structure depth",
      extractions: [
        grounded("title", "Ada", 0, O.some({ depth: "2" })),
        grounded("section", "Engine", 13, O.some({ depth: "invalid" })),
      ],
      claims: 2,
      degraded: 0,
    },
    { name: "unmapped aligned label", extractions: [grounded("custom", "Ada", 0)], claims: 1, degraded: 0 },
    {
      name: "unaligned non-relation",
      extractions: [
        GroundedExtraction.cases.unaligned.make({
          label: "person",
          text: "Missing",
          attributes: O.none(),
          confidence: O.none(),
        }),
      ],
      claims: 0,
      degraded: 1,
    },
    {
      name: "historical relation and sorted relation readings",
      extractions: [
        grounded("relation", "Ada selected Engine.", 0, relationAttributes),
        grounded(
          "relation",
          "Bob trained Engine.",
          21,
          O.some({ subject: "Bob", object: "Engine", predicate: "trained" })
        ),
      ],
      claims: 6,
      degraded: 0,
    },
    {
      name: "historical malformed relation",
      extractions: [
        grounded(
          "relation",
          "Ada selected Engine.",
          0,
          O.some({ subject: "", object: "Engine", predicate: "trained" })
        ),
      ],
      claims: 0,
      degraded: 1,
    },
    {
      name: "historical missing endpoint",
      extractions: [
        grounded(
          "relation",
          "Ada selected Engine.",
          0,
          O.some({ subject: "Missing", object: "Engine", predicate: "trained" })
        ),
      ],
      claims: 0,
      degraded: 1,
    },
  ];
  for (const testCase of cases) {
    it.effect(testCase.name, () =>
      Effect.gen(function* () {
        const result = yield* hostedBatch({ name: testCase.name, text, extractions: testCase.extractions });
        expect(result.batch.claims).toHaveLength(testCase.claims);
        expect(result.batch.degraded).toHaveLength(testCase.degraded);
        if (testCase.name === "structure depth") {
          expect(A.map(result.batch.claims, (claim) => claim.body)).toMatchObject([
            { kind: "Structure", depth: 2 },
            { kind: "Structure", depth: 0 },
          ]);
        }
      })
    );
  }
});

describe("hosted extractor runtime construction", () => {
  const configured = LabConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
  const languageModel = Model.make(
    "test",
    "construction-only",
    Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: () => Effect.die("construction must not generate"),
        streamText: () => Stream.die("construction must not stream"),
      })
    )
  );
  const runtime = ExtractorLive.HostedLangExtractLive.pipe(
    Layer.provide(languageModel),
    Layer.provide(configured),
    Layer.provide(ActiveModelIdentityLive(model)),
    Layer.provide(canonicalizerLayer),
    Layer.provide(BunCrypto.layer)
  );
  it.layer(Layer.merge(baseLayer, runtime), { timeout: "30 seconds" })((it) => {
    it.effect("builds the configured runtime and deterministic prompt artifact without a provider call", () =>
      Effect.gen(function* () {
        const extractor = yield* HostedExtractor;
        expect(typeof extractor.extract).toBe("function");
        const hash = yield* ExtractorLive.HOSTED_EXTRACTION_ARTIFACT_HASH;
        expect(hash).toHaveLength(64);
      })
    );
  });
});

describe("hosted claim chunk boundary fallback", () => {
  const extractions = [grounded("person", "Ada", 0)];
  it.layer(Layer.merge(baseLayer, langExtractLayer(extractions)), { timeout: "30 seconds" })((it) => {
    it.effect("keeps a claim in the chunk starting its anchor, then the first available chunk", () =>
      Effect.gen(function* () {
        const { canonical, chunks } = yield* makeCanonical("Ada selected Engine.");
        const canonicalizer = yield* Canonicalizer;
        const extractor = yield* LangExtractService;
        const extracted = yield* extractor.extract(ExtractorLive.makeHostedExtractionRequest(canonical));
        for (const start of [0, 4]) {
          const anchor = TextAnchor.make({
            startChar: S.Natural.make(start),
            endChar: S.Natural.make(start + 1),
            quote: Str.slice(start, start + 1)(canonical.text),
          });
          const receipt = yield* canonicalizer.verify(canonical, anchor);
          const source = { ...A.headNonEmpty(chunks), anchor, receipt };
          const id = Result.getOrThrow(makeChunkId(source));
          const chunk = Chunk.make({ ...source, id });
          const outcome = yield* ExtractorLive.groundHostedHandoff(
            canonicalizer,
            canonical,
            [chunk],
            extracted.handoff,
            model,
            O.none()
          );
          expect(outcome).toMatchObject({ outcome: "Extracted", batch: { claims: [{ chunk: id }] } });
        }
      })
    );
  });
});
