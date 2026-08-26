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
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";
import { F1FixtureId } from "@/fixtures/F1";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { HostedExtractorLive, PatternExtractorLive } from "@/layers/ExtractorLive";
import { ActiveModelIdentityLive, AnthropicExtractionModelIdentity } from "@/layers/LanguageModelLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { ClaimBody } from "@/schema/Evidence";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { ParseOutcome } from "@/schema/Text";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";
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

const canonicalizerLayer = CanonicalizerLive.pipe(Layer.provide(BunServices.layer));
const chunkerLayer = ChunkerLive.pipe(Layer.provide(canonicalizerLayer), Layer.provide(BunServices.layer));
const baseLayer = Layer.mergeAll(BunServices.layer, canonicalizerLayer, chunkerLayer);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
  it("preserves hosted coreference cluster assignments on entity claims", () => {
    const text = "Ada wrote notes.";
    const extractions = [grounded("person", "Ada", 0, O.some({ cluster: "person-ada" }))];

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(baseLayer, hostedLayer(extractions)))(
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
            expect(cluster).toEqual(O.some("person-ada"));
          }
        })
      )
    );
  });

  it("resolves NFC-equal relation endpoints to the nearest preceding entity", () => {
    const decomposed = "Cafe\u0301";
    const text = `${decomposed} met Engine. Ada praised it.`;
    const relationStart = text.indexOf("Ada");
    const extractions = [
      grounded("organization", decomposed, 0),
      grounded("method", "Engine", text.indexOf("Engine")),
      grounded(
        "relation",
        "Ada praised it.",
        relationStart,
        O.some({
          object: "Engine",
          predicate: "praised",
          subject: "Café",
        })
      ),
    ];

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(baseLayer, hostedLayer(extractions)))(
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
          const nearestSubject = A.findFirst(
            entities,
            (claim) => claim.body.startChar === 0 && claim.body.kind === "Entity"
          );
          expect(
            O.map(relation, (claim) =>
              ClaimBody.match(claim.body, {
                Entity: () => O.none(),
                Relation: (body) => O.some(body.subject),
                Structure: () => O.none(),
              })
            )
          ).toEqual(O.map(nearestSubject, (claim) => O.some(claim.id)));
          expect(outcome.batch.degraded).toEqual([]);
        })
      )
    );
  });

  it("retains an unresolved relation as a degraded claim", () => {
    const text = "Ada praised Engine.";
    const extractions = [
      grounded("person", "Ada", 0),
      grounded("method", "Engine", text.indexOf("Engine")),
      grounded("relation", text, 0, O.some({ object: "Engine", predicate: "praised", subject: "Missing" })),
    ];

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(baseLayer, hostedLayer(extractions)))(
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical(text);
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome.outcome).toBe("Extracted");
          if (outcome.outcome === "Extracted") {
            expect(outcome.batch.degraded).toMatchObject([{ kind: "relation-unresolved" }]);
            expect(A.some(outcome.batch.claims, (claim) => claim.body.kind === "Relation")).toBe(false);
          }
        })
      )
    );
  });

  it.each([
    ["model-generation-failed", "provider-unavailable"],
    ["model-output-parse-failed", "model-output-invalid"],
  ] as const)("maps %s to a %s outcome value", (reason, expectedKind) =>
    Effect.runPromise(
      provideScopedLayer(Layer.merge(baseLayer, hostedFailureLayer(reason)))(
        Effect.gen(function* () {
          const { canonical, chunks } = yield* makeCanonical("Ada wrote a method.");
          const extractor = yield* HostedExtractor;
          const outcome = yield* extractor.extract(canonical, chunks);

          expect(outcome).toMatchObject({ kind: expectedKind, lane: "hosted", outcome: "Degraded" });
        })
      )
    )
  );
});

describe("C0 pattern extractor", () => {
  it("turns an absent or width-mismatched Wink span into fabricated-span", () => {
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

    return Effect.runPromise(
      provideScopedLayer(Layer.merge(baseLayer, pattern))(
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
      )
    );
  });
});
