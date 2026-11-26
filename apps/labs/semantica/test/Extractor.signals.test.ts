// @vitest-environment node

import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { GroundedExtraction, LangExtractDiagnostics, LangExtractResult } from "@beep/langextract/Extraction";
import { handoff, startExtraction } from "@beep/langextract/Handoff";
import { buildPrompt, LangExtractService } from "@beep/langextract/Service";
import { EntityNode } from "@beep/nlp-processing/Graph/Schema";
import { NLPService } from "@beep/nlp-processing/NLPService";
import { Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { SourceTextExtractor, TextAnchor } from "@beep/text";
import { Position } from "@beep/text/OffsetUnit";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/text/VerifiedTextAnchor";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Model from "effect/ai/Model";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { F1FixtureId } from "@/fixtures/F1";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { HostedExtractorLive, PATTERN_MODEL_IDENTITY, PatternExtractorLive } from "@/layers/ExtractorLive";
import { ActiveModelIdentityLive } from "@/layers/LanguageModelLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { ParseOutcome } from "@/schema/Text";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";
import { HostedExtractor, PatternExtractor } from "@/services/Extractor";
import type { EvidenceClaim, ExtractOutcome } from "@/schema/Evidence";

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
const text = "Ada wrote notes. Bob read notes. Cy kept notes.";

const makeCanonical = Effect.fn("ExtractorSignalsTest.makeCanonical")(function* () {
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

const grounded = (surface: string, confidence: O.Option<number>) => {
  const start = O.getOrThrow(Str.indexOf(surface)(text));
  return GroundedExtraction.cases.match_exact.make({
    alignmentStatus: "match_exact",
    attributes: O.none(),
    confidence: O.map(confidence, UnitInterval.make),
    label: "person",
    anchor: TextAnchor.make({
      endChar: S.Natural.make(start + Str.length(surface)),
      quote: surface,
      startChar: S.Natural.make(start),
    }),
    text: surface,
  });
};

const langExtractLayer = (extractions: ReadonlyArray<GroundedExtraction>) =>
  Layer.effect(
    LangExtractService,
    Effect.gen(function* () {
      const digest = yield* Digest.Digest;
      return LangExtractService.of({
        extract: Effect.fn("ExtractorSignalsTest.extract")(
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
                promptChars: S.Natural.make(Str.length(request.text)),
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

const entity = (surface: string, confidence: O.Option<number>) => {
  const start = O.getOrThrow(Str.indexOf(surface)(text));
  return EntityNode.make({
    entityType: "PERSON",
    span: Position.makeOption({ unit: "utf16-code-unit", start, end: start + Str.length(surface) }),
    text: surface,
    timestamp: 0,
    ...O.match(confidence, { onNone: () => ({}), onSome: (value) => ({ confidence: value }) }),
  });
};

const patternLayer = (entities: ReadonlyArray<EntityNode>) =>
  PatternExtractorLive.pipe(
    Layer.provide(
      Layer.succeed(
        NLPService,
        NLPService.of({
          extractEntities: Effect.fn("ExtractorSignalsTest.extractEntities")(() => Effect.succeed(entities)),
          extractRelations: Effect.fn("ExtractorSignalsTest.extractRelations")(() => Effect.succeed([])),
          getBackend: Effect.die("unused"),
          processText: Effect.fn("ExtractorSignalsTest.processText")(() => Effect.die("unused")),
          tagPartsOfSpeech: Effect.fn("ExtractorSignalsTest.tagPartsOfSpeech")(() => Effect.succeed([])),
        })
      )
    ),
    Layer.provide(canonicalizerLayer)
  );

const claimsOf = (outcome: ExtractOutcome): ReadonlyArray<EvidenceClaim> =>
  outcome.outcome === "Extracted" ? outcome.batch.claims : [];

const signalOf = (claims: ReadonlyArray<EvidenceClaim>, quote: string): O.Option<ExtractorConfidence> =>
  O.map(
    A.findFirst(claims, (claim) => Str.Equivalence(claim.body.quote, quote)),
    (claim) => claim.confidence
  );

const present = (value: number, method: "hosted-langextract" | "pattern-wink", producer: ActivityPin) =>
  ExtractorConfidence.cases.Present.make({
    value: ReportedConfidence.make({ value: Confidence.make(value), method, producer: O.some(producer) }),
  });

const notAssessed = ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" });
const sameSignal = S.toEquivalence(ExtractorConfidence);
const encodeSignalJson = S.encodeEffect(S.fromJsonString(ExtractorConfidence));

const expectSignal = (actual: O.Option<ExtractorConfidence>, expected: ExtractorConfidence) => {
  expect(O.isSome(actual)).toBe(true);
  expect(O.exists(actual, (signal) => sameSignal(signal, expected))).toBe(true);
};

const hostedReadings = Layer.merge(
  baseLayer,
  hostedLayer([grounded("Ada", O.none()), grounded("Bob", O.some(0)), grounded("Cy", O.some(1))])
);

const patternReadings = Layer.merge(
  baseLayer,
  patternLayer([entity("Ada", O.none()), entity("Bob", O.some(0)), entity("Cy", O.some(1))])
);

it.layer(hostedReadings, { timeout: 60_000 })("Extractor.signals: hosted readings", (it) => {
  it.effect("hosted readings map None to absent and keep explicit 0 and 1 present with producer pin and method", () =>
    Effect.gen(function* () {
      const { canonical, chunks } = yield* makeCanonical();
      const extractor = yield* HostedExtractor;
      const outcome = yield* extractor.extract(canonical, chunks);
      const claims = claimsOf(outcome);
      const pin = ActivityPin.cases.Model.make({ model: model.name, version: model.revision });

      expect(A.length(claims)).toBe(3);
      expectSignal(signalOf(claims, "Ada"), notAssessed);
      expectSignal(signalOf(claims, "Bob"), present(0, "hosted-langextract", pin));
      expectSignal(signalOf(claims, "Cy"), present(1, "hosted-langextract", pin));
    })
  );
});

it.layer(patternReadings, { timeout: 60_000 })("Extractor.signals: pattern readings", (it) => {
  it.effect("pattern output without confidence stays absent while a reported pattern value stays present", () =>
    Effect.gen(function* () {
      const { canonical, chunks } = yield* makeCanonical();
      const extractor = yield* PatternExtractor;
      const outcome = yield* extractor.extract(canonical, chunks);
      const claims = claimsOf(outcome);
      const pin = ActivityPin.cases.Engine.make({
        engine: PATTERN_MODEL_IDENTITY.name,
        edition: PATTERN_MODEL_IDENTITY.revision,
      });

      expect(A.length(claims)).toBe(3);
      expectSignal(signalOf(claims, "Ada"), notAssessed);
      expectSignal(signalOf(claims, "Bob"), present(0, "pattern-wink", pin));
      expectSignal(signalOf(claims, "Cy"), present(1, "pattern-wink", pin));
    })
  );
});

describe("Extractor.signals: emitted claims keep reported confidence honest", () => {
  it.effect("an absent signal encodes without any numeric value", () =>
    Effect.gen(function* () {
      const encoded = yield* encodeSignalJson(notAssessed);
      expect(encoded).toBe('{"_tag":"Absent","reason":"not-assessed"}');
    })
  );
});
