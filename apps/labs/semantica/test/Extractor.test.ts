// @vitest-environment node

import {
  GroundedExtraction,
  LangExtractDiagnostics,
  LangExtractError,
  LangExtractResult,
} from "@beep/langextract/Extraction";
import { LangExtractService } from "@beep/langextract/Service";
import { DocumentId as NlpDocumentId } from "@beep/nlp/Core";
import { EntityNode } from "@beep/nlp/Graph/Schema";
import { Contract } from "@beep/nlp/Handoff";
import { NLPService } from "@beep/nlp-processing/NLPService";
import { SourceTextExtractor } from "@beep/provenance";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { F1FixtureId } from "@/fixtures/F1";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { HostedExtractorLive, PatternExtractorLive } from "@/layers/ExtractorLive";
import { ActiveModelIdentityLive, AnthropicExtractionModelIdentity } from "@/layers/LanguageModelLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { ClaimBody, FrozenRelationPredicate, RelationExtractionCandidate } from "@/schema/Evidence";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { ParseOutcome } from "@/schema/Text";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";

const decodeRelationExtractionCandidateResult = S.decodeResult(RelationExtractionCandidate);

import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import { HostedExtractor, PatternExtractor } from "@/services/Extractor";

const documentId = DocumentId.make("1".repeat(64));
const document = SourceDocument.make({
  acquired: ProvenanceEventId.make("2".repeat(64)),
  bytes: NonNegativeInt.make(1),
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

const model = Effect.runSync(
  AnthropicExtractionModelIdentity({
    artifactHash: Sha256Hex.make("3".repeat(64)),
    model: "stub-extractor-20260826",
  })
);

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
    matchedText: text,
    span: Contract.Span.make({
      end: NonNegativeInt.make(start + text.length),
      start: NonNegativeInt.make(start),
    }),
    text,
  });

const langExtractLayer = (extractions: ReadonlyArray<GroundedExtraction>) =>
  Layer.succeed(
    LangExtractService,
    LangExtractService.of({
      extract: Effect.fn("LangExtractService.stub")(function* (request) {
        const provenance = Contract.Provenance.make({
          generatedBy: "extractor-test",
          source: request.documentId,
          timestamp: 0,
        });
        return LangExtractResult.make({
          annotatedDocument: Contract.AnnotatedDocument.make({
            chunks: [],
            entities: [],
            mentions: [],
            provenance,
            relations: [],
            version: "nlp-ir/1.1",
          }),
          diagnostics: LangExtractDiagnostics.make({
            alignedCount: NonNegativeInt.make(A.length(extractions)),
            candidateCount: NonNegativeInt.make(A.length(extractions)),
            promptChars: NonNegativeInt.make(request.text.length),
            unalignedCount: NonNegativeInt.make(0),
          }),
          documentId: NlpDocumentId.make(request.documentId),
          extractions,
          text: request.text,
        });
      }),
    })
  );

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
    const text = "Ada wrote notes.";
    const extractions = [grounded("person", "Ada", 0, O.some({ cluster: "person-ada" }))];
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
    const text = "Ada wrote notes. Ada selected Engine.";
    const relationStart = text.lastIndexOf("Ada");
    const engineStart = text.indexOf("Engine");
    const extractions = [
      grounded(
        "relation",
        "Ada selected Engine.",
        relationStart,
        O.some({
          object: "Engine",
          predicate: "selected",
          subject: "Ada",
        })
      ),
    ];
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
          expect(
            O.map(relation, (claim) =>
              ClaimBody.match(claim.body, {
                Entity: () => O.none(),
                Relation: (body) => O.some([body.subject, body.object]),
                Structure: () => O.none(),
              })
            )
          ).toEqual(
            O.all([O.map(subject, (claim) => claim.id), O.map(object, (claim) => claim.id)]).pipe(O.map(O.some))
          );
          expect(outcome.batch.degraded).toEqual([]);
        })
      );
    });
  }

  {
    const text = "Ada wrote notes. Ada selected Engine.";
    const secondAda = text.lastIndexOf("Ada");
    const engine = text.indexOf("Engine");
    const extractions = [
      grounded("person", "Ada", secondAda),
      grounded("method", "Engine", engine),
      grounded(
        "relation",
        "Ada selected Engine.",
        secondAda,
        O.some({ object: "Engine", predicate: "selected", subject: "Ada" })
      ),
    ];
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
    const text = "Ada praised Engine.";
    const extractions = [
      grounded("person", "Ada", 0),
      grounded("method", "Engine", text.indexOf("Engine")),
      grounded("relation", text, 0, O.some({ object: "Engine", predicate: "praised", subject: "Missing" })),
    ];
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
    const text = "Ada selected Engine.";
    const extractions = [grounded("relation", text, 0, O.some({ object: "Engine", subject: "Ada" }))];
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
    const text = "Ada selected Engine.";
    const extraction = GroundedExtraction.cases.match_fuzzy.make({
      alignmentStatus: "match_fuzzy",
      attributes: O.some({ object: "Engine", predicate: "selected", subject: "Ada" }),
      confidence: O.none(),
      label: "relation",
      matchedText: text,
      span: Contract.Span.make({ end: NonNegativeInt.make(text.length), start: NonNegativeInt.make(0) }),
      text,
    });
    it.layer(Layer.merge(baseLayer, hostedLayer([extraction])), { timeout: "30 seconds" })((it) => {
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
  {
    const nlp = Layer.succeed(
      NLPService,
      NLPService.of({
        extractEntities: Effect.fn("NLPService.extractEntities")(() =>
          Effect.succeed([
            EntityNode.make({
              entityType: "PERSON",
              span: { end: 5, start: 0 },
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
