import { Document, DocumentId } from "@beep/nlp/Core/Document";
import { NLPBackend } from "@beep/nlp-processing/Backend/NLPBackend";
import {
  sentences,
  Tokenization,
  tokenCount,
  tokenize,
  tokenizeToDocument,
} from "@beep/nlp-processing/Core/Tokenization";
import {
  extractEntities,
  extractRelations,
  layer,
  make as makeService,
  processText,
  tagPartsOfSpeech,
} from "@beep/nlp-processing/NLPService";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Chunk, Effect, Graph, Layer, MutableHashMap } from "effect";
import * as O from "effect/Option";
import type { Sentence } from "@beep/nlp/Core/Sentence";
import type { Token } from "@beep/nlp/Core/Token";
import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend";

const noTokens: ReadonlyArray<Token> = [];
const noSentences: ReadonlyArray<Sentence> = [];

// The last text each delegated backend operation received, so a test can see that a service
// call reached its backend method instead of only matching the stub's empty result.
const backendCalls = MutableHashMap.empty<string, string>();
const recordBackendCall = (operation: string, text: string): void => {
  MutableHashMap.set(backendCalls, operation, text);
};

const backend: NLPBackendShape = {
  name: "minimal",
  capabilities: {
    constituencyParsing: false,
    coreferenceResolution: false,
    dependencyParsing: false,
    lemmatization: false,
    ner: false,
    posTagging: false,
    relationExtraction: false,
    sentencization: false,
    tokenization: false,
  },
  tokenize: Effect.fn("test.backend.tokenize")(function* (text: string) {
    return text.split(" ");
  }),
  sentencize: Effect.fn("test.backend.sentencize")(function* (text: string) {
    return [text];
  }),
  posTag: Effect.fn("test.backend.posTag")(function* (text: string) {
    recordBackendCall("posTag", text);
    return [];
  }),
  lemmatize: Effect.fn("test.backend.lemmatize")(function* () {
    return [];
  }),
  extractEntities: Effect.fn("test.backend.extractEntities")(function* (text: string) {
    recordBackendCall("extractEntities", text);
    return [];
  }),
  parseDependencies: Effect.fn("test.backend.parseDependencies")(function* () {
    return [];
  }),
  extractRelations: Effect.fn("test.backend.extractRelations")(function* (text: string) {
    recordBackendCall("extractRelations", text);
    return [];
  }),
};

const tokenization = Tokenization.of({
  tokenize: Effect.fn("test.tokenization.tokenize")(function* () {
    return noTokens;
  }),
  sentences: Effect.fn("test.tokenization.sentences")(function* () {
    return noSentences;
  }),
  document: Effect.fn("test.tokenization.document")(function* (text: string) {
    return Document.make({
      id: DocumentId.make("doc-001"),
      sentences: Chunk.empty(),
      sentiment: O.none(),
      text,
      tokens: Chunk.empty(),
    });
  }),
  tokenCount: Effect.fn("test.tokenization.tokenCount")(function* () {
    return 0;
  }),
});

describe("NLPService", () => {
  it.effect(
    "forwards each backend operation through the service made from a backend",
    Effect.fnUntraced(function* () {
      const service = makeService(backend);
      const graph = yield* service.processText("ada lovelace");

      expect((yield* service.getBackend).name).toBe("minimal");
      MutableHashMap.clear(backendCalls);
      expect(yield* service.extractEntities("ada lovelace")).toStrictEqual([]);
      assertSome(MutableHashMap.get(backendCalls, "extractEntities"), "ada lovelace");
      MutableHashMap.clear(backendCalls);
      expect(yield* service.extractRelations("grace hopper")).toStrictEqual([]);
      assertSome(MutableHashMap.get(backendCalls, "extractRelations"), "grace hopper");
      MutableHashMap.clear(backendCalls);
      expect(yield* service.tagPartsOfSpeech("alan turing")).toStrictEqual([]);
      assertSome(MutableHashMap.get(backendCalls, "posTag"), "alan turing");
      expect(MutableHashMap.size(backendCalls)).toBe(1);
      expect(Graph.nodeCount(graph)).toBeGreaterThanOrEqual(2);
    })
  );

  it.layer(layer(Layer.succeed(NLPBackend, backend)), { timeout: "10 seconds" })(
    "service layer over a backend layer",
    (it) => {
      it.effect(
        "reads every operation through the module accessors",
        Effect.fnUntraced(function* () {
          const graph = yield* processText("ada lovelace");

          MutableHashMap.clear(backendCalls);
          expect(yield* extractEntities("ada lovelace")).toStrictEqual([]);
          assertSome(MutableHashMap.get(backendCalls, "extractEntities"), "ada lovelace");
          MutableHashMap.clear(backendCalls);
          expect(yield* extractRelations("grace hopper")).toStrictEqual([]);
          assertSome(MutableHashMap.get(backendCalls, "extractRelations"), "grace hopper");
          MutableHashMap.clear(backendCalls);
          expect(yield* tagPartsOfSpeech("alan turing")).toStrictEqual([]);
          assertSome(MutableHashMap.get(backendCalls, "posTag"), "alan turing");
          expect(MutableHashMap.size(backendCalls)).toBe(1);
          expect(Graph.nodeCount(graph)).toBeGreaterThanOrEqual(2);
        })
      );
    }
  );

  it.layer(Layer.succeed(Tokenization, tokenization), { timeout: "10 seconds" })("tokenization accessors", (it) => {
    it.effect(
      "reads tokenization through the configured service",
      Effect.fnUntraced(function* () {
        const document = yield* tokenizeToDocument("typed effects");

        expect(yield* tokenize("typed effects")).toStrictEqual([]);
        expect(yield* sentences("Effect works.")).toStrictEqual([]);
        expect(yield* tokenCount("typed effects")).toBe(0);
        expect(document.text).toBe("typed effects");
      })
    );
  });
});
