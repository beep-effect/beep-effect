/**
 * Proofs for the pluggable NLP backend contract: capability detection, the
 * failure constructors, and the schema-decodability of each tagged error.
 *
 * Effect v4 + `@effect/vitest` coverage for backend design.
 * Errors are `TaggedErrorClass` instances, so they round-trip through schema
 * decode/encode like any other `@beep/schema` model.
 */

import * as Backend from "@beep/nlp-processing/Backend/NLPBackend";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equals(decode(encode(value)), value)).toBe(true);
    }),
    { numRuns: 50 }
  );
};

const capabilities: Backend.BackendCapabilities = {
  tokenization: true,
  sentencization: true,
  posTagging: true,
  lemmatization: false,
  ner: true,
  dependencyParsing: false,
  relationExtraction: false,
  coreferenceResolution: false,
  constituencyParsing: false,
};

describe("BackendCapabilities", () => {
  it("supportsCapability reads a single flag", () => {
    const stub: Backend.NLPBackendShape = {
      name: "stub",
      capabilities,
      tokenize: () => Effect.succeed([]),
      sentencize: () => Effect.succeed([]),
      posTag: () => Effect.succeed([]),
      lemmatize: () => Effect.succeed([]),
      extractEntities: () => Effect.succeed([]),
      parseDependencies: () => Effect.succeed([]),
      extractRelations: () => Effect.succeed([]),
    };
    expect(Backend.supportsCapability(stub, "tokenization")).toBe(true);
    expect(Backend.supportsCapability("tokenization")(stub)).toBe(true);
    expect(Backend.supportsCapability(stub, "lemmatization")).toBe(false);
  });

  it("getSupportedCapabilities lists only enabled flags", () => {
    const stub: Backend.NLPBackendShape = {
      name: "stub",
      capabilities,
      tokenize: () => Effect.succeed([]),
      sentencize: () => Effect.succeed([]),
      posTag: () => Effect.succeed([]),
      lemmatize: () => Effect.succeed([]),
      extractEntities: () => Effect.succeed([]),
      parseDependencies: () => Effect.succeed([]),
      extractRelations: () => Effect.succeed([]),
    };
    const supported = Backend.getSupportedCapabilities(stub);
    expect(supported).toContain("tokenization");
    expect(supported).toContain("ner");
    expect(supported).not.toContain("lemmatization");
    expect(supported).not.toContain("dependencyParsing");
  });
});

describe("Failure constructors", () => {
  it("notSupported carries backend + operation with a default message", () => {
    const err = Backend.notSupported("wink", "parseDependencies");
    expect(err._tag).toBe("BackendNotSupported");
    expect(err.backend).toBe("wink");
    expect(err.operation).toBe("parseDependencies");
    expect(err.message).toContain("parseDependencies");
  });

  it("notSupported honors an explicit message", () => {
    const err = Backend.notSupported("wink", "extractRelations", "lite model has no RE");
    expect(err.message).toBe("lite model has no RE");
  });

  it("initError records the backend and retains the cause", () => {
    const cause = new Error("boom");
    const err = Backend.initError("spacy", cause);
    expect(err._tag).toBe("BackendInitError");
    expect(err.backend).toBe("spacy");
    expect(err.message).toContain("spacy");
    expect(err.cause).toBe(cause);
  });

  it("operationError records the operation and retains the cause", () => {
    const cause = new Error("nope");
    const err = Backend.operationError("corenlp", "posTag", cause);
    expect(err._tag).toBe("BackendOperationError");
    expect(err.operation).toBe("posTag");
    expect(err.message).toContain("posTag");
    expect(err.cause).toBe(cause);
  });
});

describe("Tagged errors are schema-decodable", () => {
  it("round-trips schema-derived backend not-supported errors", () => {
    assertSchemaRoundTrip(Backend.BackendNotSupported);
  });

  it("recognizes constructed backend errors through the union statics", () => {
    expect(Backend.NLPBackendError.is(Backend.notSupported("wink", "posTag"))).toBe(true);
    expect(Backend.NLPBackendError.is(Backend.initError("wink", new Error("boom")))).toBe(true);
    expect(Backend.NLPBackendError.is(Backend.operationError("wink", "posTag", new Error("boom")))).toBe(true);
  });

  it.effect(
    "BackendNotSupported round-trips through encode/decode",
    Effect.fnUntraced(function* () {
      const err = Backend.notSupported("wink", "posTag");
      const encoded = yield* S.encodeEffect(Backend.BackendNotSupported)(err);
      const decoded = yield* S.decodeUnknownEffect(Backend.BackendNotSupported)(encoded);
      expect(decoded.backend).toBe("wink");
      expect(decoded.operation).toBe("posTag");
    })
  );
});
