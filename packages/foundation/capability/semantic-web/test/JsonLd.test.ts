import { JsonLdContextServiceLive } from "@beep/semantic-web/adapters/jsonld-context";
import { JsonLdDocumentServiceLive } from "@beep/semantic-web/adapters/jsonld-document";
import { JsonLdStreamParseServiceLive } from "@beep/semantic-web/adapters/jsonld-stream-parse";
import { JsonLdStreamSerializeServiceLive } from "@beep/semantic-web/adapters/jsonld-stream-serialize";
import { JsonLdContext, JsonLdDocument, JsonLdFrame, JsonLdLiteralValue } from "@beep/semantic-web/jsonld";
import { Dataset } from "@beep/semantic-web/rdf";
import {
  CompactJsonLdIriRequest,
  ExpandJsonLdTermRequest,
  JsonLdContextError,
  JsonLdContextService,
  MergeJsonLdContextsRequest,
  NormalizeJsonLdContextRequest,
} from "@beep/semantic-web/services/jsonld-context";
import {
  CompactJsonLdDocumentRequest,
  ExpandJsonLdDocumentRequest,
  FrameJsonLdDocumentRequest,
  JsonLdDocumentError,
  JsonLdDocumentLoaderPolicy,
  JsonLdDocumentService,
  JsonLdFromRdfRequest,
  JsonLdToRdfRequest,
  NormalizeJsonLdDocumentRequest,
} from "@beep/semantic-web/services/jsonld-document";
import {
  JsonLdStreamParseInput,
  JsonLdStreamParseRequest,
  JsonLdStreamParseService,
} from "@beep/semantic-web/services/jsonld-stream-parse";
import {
  JsonLdStreamSerializeRequest,
  JsonLdStreamSerializeService,
} from "@beep/semantic-web/services/jsonld-stream-serialize";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const decodeUnknownSync = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownSync(schema);

const isJsonLdLiteralValue = S.is(JsonLdLiteralValue);
const JsonLdContextArbitrary = S.toArbitrary(JsonLdContext);
const JsonLdFrameArbitrary = S.toArbitrary(JsonLdFrame);
const JsonLdLiteralValueArbitrary = S.toArbitrary(JsonLdLiteralValue);

const rawContext = {
  "@base": "https://example.com/",
  "@vocab": "https://schema.org/",
  terms: {
    homepage: { "@id": "https://schema.org/url" },
    name: "https://schema.org/name",
    Person: "https://schema.org/Person",
  },
} as const;

const rawDocument = {
  "@context": rawContext,
  "@graph": [
    {
      "@id": "https://example.com/people/alice",
      "@type": ["https://schema.org/Person"],
      properties: {
        "https://schema.org/name": [{ "@value": "Alice" }],
        "https://schema.org/url": [{ "@id": "https://example.com/alice" }],
      },
    },
  ],
} as const;

const rawCompactedContext = {
  terms: {
    birthDate: "https://schema.org/birthDate",
    dateType: "https://example.com/types/Date",
    Person: "https://schema.org/Person",
    person: "https://example.com/people/",
  },
} as const;

const rawTypedLiteralDocument = {
  "@context": rawCompactedContext,
  "@graph": [
    {
      "@id": "https://example.com/people/alice",
      "@type": ["https://schema.org/Person"],
      properties: {
        "https://schema.org/birthDate": [{ "@type": "https://example.com/types/Date", "@value": "2026-03-08" }],
      },
    },
  ],
} as const;

const rawBlankNodeContext = {
  terms: {
    knows: "https://schema.org/knows",
    name: "https://schema.org/name",
    Person: "https://schema.org/Person",
  },
} as const;

const rawBlankNodeDocument = {
  "@context": rawBlankNodeContext,
  "@graph": [
    {
      "@id": "_:alice",
      "@type": ["https://schema.org/Person"],
      properties: {
        "https://schema.org/knows": [{ "@id": "_:bob" }],
        "https://schema.org/name": [{ "@value": "Alice" }],
      },
    },
    {
      "@id": "_:bob",
      properties: {
        "https://schema.org/name": [{ "@value": "Bob" }],
      },
    },
    {
      properties: {
        "https://schema.org/name": [{ "@value": "Anonymous" }],
      },
    },
  ],
} as const;

const runContext = <A, E>(effect: Effect.Effect<A, E, JsonLdContextService>) =>
  Effect.runPromise(effect.pipe(provideScopedLayer(JsonLdContextServiceLive), Effect.orDie));

const runDocument = <A, E>(effect: Effect.Effect<A, E, JsonLdDocumentService>) =>
  Effect.runPromise(effect.pipe(provideScopedLayer(JsonLdDocumentServiceLive), Effect.orDie));

const runStreamParse = <A, E>(effect: Effect.Effect<A, E, JsonLdStreamParseService>) =>
  Effect.runPromise(
    effect.pipe(
      provideScopedLayer(JsonLdStreamParseServiceLive.pipe(Layer.provide(JsonLdDocumentServiceLive))),
      Effect.orDie
    )
  );

const runStreamSerialize = <A, E>(effect: Effect.Effect<A, E, JsonLdStreamSerializeService>) =>
  Effect.runPromise(
    effect.pipe(
      provideScopedLayer(JsonLdStreamSerializeServiceLive.pipe(Layer.provide(JsonLdDocumentServiceLive))),
      Effect.orDie
    )
  );

describe("JSON-LD", () => {
  it("round-trips schema-derived JSON-LD DTOs through boundary encoders", () =>
    fc.assert(
      fc.property(
        JsonLdContextArbitrary,
        JsonLdLiteralValueArbitrary,
        JsonLdFrameArbitrary,
        (context, literalValue, frame) => {
          const encodedContext = Effect.runSync(S.encodeEffect(JsonLdContext)(context));
          const decodedContext = Effect.runSync(S.decodeUnknownEffect(JsonLdContext)(encodedContext));
          const reencodedContext = Effect.runSync(S.encodeEffect(JsonLdContext)(decodedContext));

          const encodedLiteralValue = Effect.runSync(S.encodeEffect(JsonLdLiteralValue)(literalValue));
          const decodedLiteralValue = Effect.runSync(S.decodeUnknownEffect(JsonLdLiteralValue)(encodedLiteralValue));
          const reencodedLiteralValue = Effect.runSync(S.encodeEffect(JsonLdLiteralValue)(decodedLiteralValue));

          const encodedFrame = Effect.runSync(S.encodeEffect(JsonLdFrame)(frame));
          const decodedFrame = Effect.runSync(S.decodeUnknownEffect(JsonLdFrame)(encodedFrame));
          const reencodedFrame = Effect.runSync(S.encodeEffect(JsonLdFrame)(decodedFrame));

          expect(reencodedContext).toEqual(encodedContext);
          expect(reencodedLiteralValue).toEqual(encodedLiteralValue);
          expect(reencodedFrame).toEqual(encodedFrame);
        }
      ),
      fcRuns(25)
    ));

  it("keeps optional JSON-LD service fields absent in encoded wire shapes when omitted", () => {
    const encodedDocumentError = S.encodeSync(JsonLdDocumentError)(
      JsonLdDocumentError.make({
        reason: "loaderPolicyViolation",
        message: "Remote document loading is disabled for this workflow.",
      })
    );
    const encodedContextError = S.encodeSync(JsonLdContextError)(
      JsonLdContextError.make({
        reason: "unknownTerm",
        message: "The term is not present in the active context.",
      })
    );
    const encodedLoaderPolicy = S.encodeSync(JsonLdDocumentLoaderPolicy)(
      JsonLdDocumentLoaderPolicy.make({ allowRemoteDocuments: false })
    );
    const encodedExpandRequest = S.encodeSync(ExpandJsonLdDocumentRequest)(
      ExpandJsonLdDocumentRequest.make({
        document: decodeUnknownSync(JsonLdDocument)(rawDocument),
      })
    );
    const encodedNormalizeRequest = S.encodeSync(NormalizeJsonLdDocumentRequest)(
      decodeUnknownSync(NormalizeJsonLdDocumentRequest)({
        document: rawDocument,
        profile: "bounded-v1",
      })
    );
    const encodedFromRdfRequest = S.encodeSync(JsonLdFromRdfRequest)(
      JsonLdFromRdfRequest.make({
        dataset: decodeUnknownSync(Dataset)({ quads: [] }),
      })
    );
    const encodedSerializeRequest = S.encodeSync(JsonLdStreamSerializeRequest)(
      JsonLdStreamSerializeRequest.make({
        dataset: decodeUnknownSync(Dataset)({ quads: [] }),
      })
    );
    const encodedParseRequest = S.encodeSync(JsonLdStreamParseRequest)(
      JsonLdStreamParseRequest.make({
        input: decodeUnknownSync(JsonLdStreamParseInput)({
          chunks: ['{"@graph":[]}'],
          encoding: "utf-8",
          kind: "text",
        }),
      })
    );

    expect(encodedDocumentError).not.toHaveProperty("subject");
    expect(encodedContextError).not.toHaveProperty("subject");
    expect(encodedLoaderPolicy).not.toHaveProperty("maxRemoteDocuments");
    expect(encodedLoaderPolicy).not.toHaveProperty("baseIri");
    expect(encodedExpandRequest).not.toHaveProperty("loaderPolicy");
    expect(encodedNormalizeRequest).not.toHaveProperty("loaderPolicy");
    expect(encodedFromRdfRequest).not.toHaveProperty("context");
    expect(encodedSerializeRequest).not.toHaveProperty("context");
    expect(encodedSerializeRequest).not.toHaveProperty("maxChunkCharacters");
    expect(encodedParseRequest).not.toHaveProperty("loaderPolicy");
  });

  it("round-trips schema-derived JSON-LD stream serialize requests through encoded shapes", { timeout: 30000 }, () =>
    fc.assert(
      fc.property(S.toArbitrary(JsonLdStreamSerializeRequest), (request) => {
        const encoded = S.encodeSync(JsonLdStreamSerializeRequest)(request);
        const decoded = S.decodeSync(JsonLdStreamSerializeRequest)(encoded);

        expect(S.encodeSync(JsonLdStreamSerializeRequest)(decoded)).toEqual(encoded);
      }),
      fcRuns(5)
    )
  );

  it.effect("normalizes, expands, compacts, and merges bounded contexts", () =>
    Effect.gen(function* () {
      const normalized = yield* Effect.promise(() =>
        Promise.resolve(
          runContext(
            Effect.gen(function* () {
              const service = yield* JsonLdContextService;
              return yield* service.normalize(
                decodeUnknownSync(NormalizeJsonLdContextRequest)({ context: rawContext })
              );
            })
          )
        )
      );

      expect(Object.keys(normalized.terms)).toEqual(["Person", "homepage", "name"]);

      const expanded = yield* Effect.promise(() =>
        Promise.resolve(
          runContext(
            Effect.gen(function* () {
              const service = yield* JsonLdContextService;
              return yield* service.expandTerm(
                decodeUnknownSync(ExpandJsonLdTermRequest)({ context: rawContext, term: "name" })
              );
            })
          )
        )
      );

      expect(expanded.iri).toBe("https://schema.org/name");

      const compacted = yield* Effect.promise(() =>
        Promise.resolve(
          runContext(
            Effect.gen(function* () {
              const service = yield* JsonLdContextService;
              return yield* service.compactIri(
                decodeUnknownSync(CompactJsonLdIriRequest)({ context: rawContext, iri: "https://schema.org/Person" })
              );
            })
          )
        )
      );

      expect(compacted.term).toBe("Person");

      const merged = yield* Effect.promise(() =>
        Promise.resolve(
          runContext(
            Effect.gen(function* () {
              const service = yield* JsonLdContextService;
              return yield* service.merge(
                decodeUnknownSync(MergeJsonLdContextsRequest)({
                  left: rawContext,
                  right: {
                    terms: {
                      description: "https://schema.org/description",
                    },
                  },
                })
              );
            })
          )
        )
      );

      expect(merged.terms.description).toBe("https://schema.org/description");
      expect(O.isSome(merged["@base"])).toBe(true);
    })
  );

  it.effect("compacts, frames, and bridges bounded JSON-LD documents to and from RDF", () =>
    Effect.gen(function* () {
      const compacted = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.compact(
                decodeUnknownSync(CompactJsonLdDocumentRequest)({
                  context: rawContext,
                  document: rawDocument,
                })
              );
            })
          )
        )
      );

      const [compactedNode] = compacted.document["@graph"];
      expect(compactedNode.properties.name).toBeDefined();
      expect(O.isSome(compactedNode["@type"])).toBe(true);
      if (O.isSome(compactedNode["@type"])) {
        expect(compactedNode["@type"].value).toEqual(["Person"]);
      }

      const framed = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.frame(
                FrameJsonLdDocumentRequest.make({
                  document: decodeUnknownSync(JsonLdDocument)(
                    yield* S.encodeEffect(JsonLdDocument)(compacted.document)
                  ),
                  frame: decodeUnknownSync(JsonLdFrame)({
                    "@type": "Person",
                    includeProperties: ["name"],
                  }),
                })
              );
            })
          )
        )
      );

      expect(Object.keys(framed.document["@graph"][0].properties)).toEqual(["name"]);

      const bridged = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.toRdf(decodeUnknownSync(JsonLdToRdfRequest)({ document: rawDocument }));
            })
          )
        )
      );

      expect(bridged.dataset.quads).toHaveLength(3);

      const roundTripped = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.fromRdf(
                JsonLdFromRdfRequest.make({
                  context: O.some(decodeUnknownSync(JsonLdContext)(rawContext)),
                  dataset: bridged.dataset,
                })
              );
            })
          )
        )
      );

      const [roundTripNode] = roundTripped.document["@graph"];
      expect(roundTripNode.properties.name).toBeDefined();
      expect(O.isSome(roundTripNode["@type"])).toBe(true);
    })
  );

  it.effect("compacts node identifiers and typed-literal datatypes with the supplied context", () =>
    Effect.gen(function* () {
      const compacted = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.compact(
                decodeUnknownSync(CompactJsonLdDocumentRequest)({
                  context: rawCompactedContext,
                  document: rawTypedLiteralDocument,
                })
              );
            })
          )
        )
      );

      const [compactedNode] = compacted.document["@graph"];
      expect(compactedNode["@id"]).toEqual(O.some("person:alice"));

      const birthDateValues = compactedNode.properties.birthDate;
      expect(birthDateValues).toBeDefined();
      if (birthDateValues !== undefined) {
        expect(birthDateValues).toHaveLength(1);

        const maybeLiteralValue = pipe(birthDateValues, A.findFirst(isJsonLdLiteralValue));

        expect(O.isSome(maybeLiteralValue)).toBe(true);
        if (O.isSome(maybeLiteralValue) && O.isSome(maybeLiteralValue.value["@type"])) {
          expect(maybeLiteralValue.value["@type"].value).toBe("dateType");
        }
      }

      const bridged = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.toRdf(decodeUnknownSync(JsonLdToRdfRequest)({ document: rawTypedLiteralDocument }));
            })
          )
        )
      );

      const fromRdf = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.fromRdf(
                JsonLdFromRdfRequest.make({
                  context: O.some(decodeUnknownSync(JsonLdContext)(rawCompactedContext)),
                  dataset: bridged.dataset,
                })
              );
            })
          )
        )
      );

      const [roundTrippedNode] = fromRdf.document["@graph"];
      expect(roundTrippedNode["@id"]).toEqual(O.some("person:alice"));

      const roundTrippedBirthDateValues = roundTrippedNode.properties.birthDate;
      expect(roundTrippedBirthDateValues).toBeDefined();
      if (roundTrippedBirthDateValues !== undefined) {
        const maybeRoundTrippedLiteralValue = pipe(roundTrippedBirthDateValues, A.findFirst(isJsonLdLiteralValue));

        expect(O.isSome(maybeRoundTrippedLiteralValue)).toBe(true);
        if (O.isSome(maybeRoundTrippedLiteralValue) && O.isSome(maybeRoundTrippedLiteralValue.value["@type"])) {
          expect(maybeRoundTrippedLiteralValue.value["@type"].value).toBe("dateType");
        }
      }
    })
  );

  it.effect("round-trips blank-node subjects, blank-node object references, and anonymous nodes through RDF", () =>
    Effect.gen(function* () {
      const bridged = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.toRdf(decodeUnknownSync(JsonLdToRdfRequest)({ document: rawBlankNodeDocument }));
            })
          )
        )
      );

      const roundTripped = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.fromRdf(
                JsonLdFromRdfRequest.make({
                  context: O.some(decodeUnknownSync(JsonLdContext)(rawBlankNodeContext)),
                  dataset: bridged.dataset,
                })
              );
            })
          )
        )
      );

      const maybeAliceNode = pipe(
        roundTripped.document["@graph"],
        A.findFirst((node) => O.isSome(node["@id"]) && node["@id"].value === "_:alice")
      );

      expect(O.isSome(maybeAliceNode)).toBe(true);
      if (O.isSome(maybeAliceNode)) {
        expect(maybeAliceNode.value.properties.knows).toEqual([{ "@id": "_:bob" }]);
      }

      const maybeAnonymousNode = pipe(
        roundTripped.document["@graph"],
        A.findFirst(
          (node) =>
            node.properties.name !== undefined &&
            node.properties.name[0] !== undefined &&
            "@value" in node.properties.name[0] &&
            node.properties.name[0]["@value"] === "Anonymous"
        )
      );

      expect(O.isSome(maybeAnonymousNode)).toBe(true);
      if (O.isSome(maybeAnonymousNode)) {
        expect(O.isSome(maybeAnonymousNode.value["@id"])).toBe(true);
      }
    })
  );

  it.effect("expands compacted documents and normalizes bounded document structure", () =>
    Effect.gen(function* () {
      const compacted = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.compact(
                decodeUnknownSync(CompactJsonLdDocumentRequest)({
                  context: rawContext,
                  document: rawDocument,
                })
              );
            })
          )
        )
      );

      const expanded = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.expand(
                decodeUnknownSync(ExpandJsonLdDocumentRequest)({
                  document: yield* S.encodeEffect(JsonLdDocument)(compacted.document),
                  loaderPolicy: {
                    allowRemoteDocuments: false,
                  },
                })
              );
            })
          )
        )
      );

      expect(O.isNone(expanded.document["@context"])).toBe(true);
      expect(Object.keys(expanded.document["@graph"][0].properties)).toEqual([
        "https://schema.org/name",
        "https://schema.org/url",
      ]);

      const normalized = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.normalize(
                decodeUnknownSync(NormalizeJsonLdDocumentRequest)({
                  document: yield* S.encodeEffect(JsonLdDocument)(compacted.document),
                  loaderPolicy: {
                    allowRemoteDocuments: false,
                  },
                  profile: "bounded-v1",
                  safeMode: true,
                })
              );
            })
          )
        )
      );

      expect(Object.keys(normalized.document["@graph"][0].properties)).toEqual(["homepage", "name"]);
    })
  );

  it.effect("rejects safe-mode normalization for anonymous JSON-LD nodes", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.normalize(
                decodeUnknownSync(NormalizeJsonLdDocumentRequest)({
                  document: rawBlankNodeDocument,
                  profile: "bounded-v1",
                  safeMode: true,
                })
              );
            })
          )
        ).rejects.toThrow("Safe-mode normalization requires explicit @id values for every JSON-LD node.")
      )
    )
  );

  it.effect("round-trips bounded streaming parse and serialize seams through buffered fallback mode", () =>
    Effect.gen(function* () {
      const bridged = yield* Effect.promise(() =>
        Promise.resolve(
          runDocument(
            Effect.gen(function* () {
              const service = yield* JsonLdDocumentService;
              return yield* service.toRdf(decodeUnknownSync(JsonLdToRdfRequest)({ document: rawDocument }));
            })
          )
        )
      );

      const serialized = yield* Effect.promise(() =>
        Promise.resolve(
          runStreamSerialize(
            Effect.gen(function* () {
              const service = yield* JsonLdStreamSerializeService;
              return yield* service.serialize(
                decodeUnknownSync(JsonLdStreamSerializeRequest)({
                  context: rawContext,
                  dataset: yield* S.encodeEffect(Dataset)(bridged.dataset),
                  maxChunkCharacters: 32,
                })
              );
            })
          )
        )
      );

      expect(serialized.mode).toBe("buffered-fallback");
      expect(serialized.chunkCount).toBeGreaterThan(1);

      const reparsed = yield* Effect.promise(() =>
        Promise.resolve(
          runStreamParse(
            Effect.gen(function* () {
              const service = yield* JsonLdStreamParseService;
              return yield* service.parse(
                decodeUnknownSync(JsonLdStreamParseRequest)({
                  input: {
                    chunks: serialized.chunks,
                    encoding: "utf-8",
                    kind: "text",
                  },
                  loaderPolicy: {
                    allowRemoteDocuments: false,
                  },
                })
              );
            })
          )
        )
      );

      expect(reparsed.mode).toBe("buffered-fallback");
      expect(reparsed.dataset.quads).toHaveLength(3);
    })
  );
});
