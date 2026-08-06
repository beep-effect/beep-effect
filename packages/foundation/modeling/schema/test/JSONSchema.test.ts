import {
  AbsoluteUriString,
  AnchorName,
  CanonicalKeyword,
  Document,
  ExtensionKey,
  ExtensionsBag,
  IdUriReferenceString,
  isCanonicalKeyword,
  Node,
  NodeCodec,
  NonNegativeCount,
  PositiveNumber,
  RegexPatternString,
  resolveDocumentRef,
  resolveLocalRef,
  resolveNodeRef,
  SubSchema,
  TypeName,
  TypeNameList,
  Types,
  UriReferenceString,
} from "@beep/schema/JSONSchema";
import { assertSchemaArbitraryDecodesToSelf, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { FastCheck as fc } from "effect/testing";

const decodeNode = S.decodeUnknownEffect(NodeCodec);
const encodeNode = S.encodeEffect(NodeCodec);
const decodeDocument = S.decodeUnknownEffect(Document);
const encodeDocument = S.encodeEffect(Document);
const decodeNodeResult = S.decodeUnknownResult(NodeCodec);
const encodeNodeResult = S.encodeResult(NodeCodec);
const decodeDocumentResult = S.decodeUnknownResult(Document);
const encodeDocumentResult = S.encodeResult(Document);
const decodeSubSchemaResult = S.decodeUnknownResult(SubSchema);
const encodeSubSchemaResult = S.encodeResult(SubSchema);
const decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(S.Unknown));
const encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const isAbsoluteUriString = S.is(AbsoluteUriString);
const isIdUriReferenceString = S.is(IdUriReferenceString);
const isUriReferenceString = S.is(UriReferenceString);

const NodeArbitrary = S.toArbitrary(Node);
const SubSchemaArbitrary = S.toArbitrary(SubSchema);
const DocumentArbitrary = S.toArbitrary(Document);
const nodeEquivalence = S.toEquivalence(Node);
const subSchemaEquivalence = S.toEquivalence(SubSchema);
const documentEquivalence = S.toEquivalence(Document);

const nodeRoundTrips = (node: Node.Type): boolean =>
  Result.match(Result.flatMap(encodeNodeResult(node), decodeNodeResult), {
    onFailure: () => false,
    onSuccess: (decoded) => nodeEquivalence(decoded, node),
  });

const subSchemaRoundTrips = (schema: SubSchema.Type): boolean =>
  Result.match(Result.flatMap(encodeSubSchemaResult(schema), decodeSubSchemaResult), {
    onFailure: () => false,
    onSuccess: (decoded) => subSchemaEquivalence(decoded, schema),
  });

const documentRoundTrips = (document: Document.Type): boolean =>
  Result.match(Result.flatMap(encodeDocumentResult(document), decodeDocumentResult), {
    onFailure: () => false,
    onSuccess: (decoded) => documentEquivalence(decoded, document),
  });

const nodeJsonRoundTrips = (node: Node.Type): boolean =>
  Result.match(
    Result.flatMap(
      Result.flatMap(Result.flatMap(encodeNodeResult(node), encodeJsonResult), decodeJsonResult),
      decodeNodeResult
    ),
    {
      onFailure: () => false,
      onSuccess: (decoded) => nodeEquivalence(decoded, node),
    }
  );

describe("JSONSchema", { concurrent: false, timeout: 300_000 }, () => {
  describe("NodeCodec decoding", () => {
    it.effect(
      "decodes canonical keywords into Option fields and preserves unknown keys",
      Effect.fnUntraced(function* () {
        const node = yield* decodeNode({
          type: "object",
          properties: { name: { type: "string", minLength: 1 } },
          required: ["name"],
          "x-vendor": { hint: true },
          markdownDescription: "**doc**",
        });
        expect(O.getOrThrow(node.type)).toBe("object");
        expect(O.getOrThrow(node.required)).toEqual(["name"]);
        expect(node.extensions).toEqual({ "x-vendor": { hint: true }, markdownDescription: "**doc**" });
        const properties = O.getOrThrow(node.properties);
        const name = properties.name;
        expect(Node.is(name)).toBe(true);
        if (Node.is(name)) {
          expect(O.getOrThrow(name.minLength)).toBe(1);
        }
      })
    );

    it.effect(
      "accepts boolean schemas at every subschema position",
      Effect.fnUntraced(function* () {
        const node = yield* decodeNode({
          items: false,
          additionalProperties: true,
          propertyNames: false,
          contains: true,
          not: false,
          unevaluatedItems: true,
          unevaluatedProperties: false,
          $defs: { Anything: true, Nothing: false },
          properties: { open: true },
        });
        expect(O.getOrThrow(node.items)).toBe(false);
        expect(O.getOrThrow(node.additionalProperties)).toBe(true);
        expect(O.getOrThrow(node.$defs)).toEqual({ Anything: true, Nothing: false });
      })
    );

    it.effect(
      "keeps $ref siblings, per draft-2020-12",
      Effect.fnUntraced(function* () {
        const node = yield* decodeNode({
          $ref: "#/$defs/User",
          description: "documented reference",
          deprecated: true,
        });
        expect(O.getOrThrow(node.$ref)).toBe("#/$defs/User");
        expect(O.getOrThrow(node.deprecated)).toBe(true);
      })
    );

    it.effect(
      "rejects spec-MUST violations",
      Effect.fnUntraced(function* () {
        const rejects = (input: unknown) => Effect.map(Effect.exit(decodeNode(input)), (exit) => Exit.isFailure(exit));
        expect(yield* rejects({ multipleOf: 0 })).toBe(true);
        expect(yield* rejects({ multipleOf: -2 })).toBe(true);
        expect(yield* rejects({ maxLength: -1 })).toBe(true);
        expect(yield* rejects({ minItems: 1.5 })).toBe(true);
        expect(yield* rejects({ allOf: [] })).toBe(true);
        expect(yield* rejects({ prefixItems: [] })).toBe(true);
        expect(yield* rejects({ $anchor: "9starts-with-digit" })).toBe(true);
        expect(yield* rejects({ pattern: "[unclosed" })).toBe(true);
        expect(yield* rejects({ patternProperties: { "[bad": true } })).toBe(true);
        expect(yield* rejects({ $ref: "has whitespace" })).toBe(true);
        expect(yield* rejects({ $ref: "http://[bad" })).toBe(true);
        expect(yield* rejects({ $ref: "1:foo" })).toBe(true);
        expect(yield* rejects({ $ref: "a[b" })).toBe(true);
        expect(yield* rejects({ $ref: "?q=[x]" })).toBe(true);
        expect(yield* rejects({ $ref: "#foo#bar" })).toBe(true);
        expect(yield* rejects({ $dynamicRef: "%" })).toBe(true);
        expect(yield* rejects({ $id: "#fragment" })).toBe(true);
        expect(yield* rejects({ $id: "https://example.com/schema#fragment" })).toBe(true);
        expect(yield* rejects({ $id: "http://[bad" })).toBe(true);
        expect(yield* rejects({ $id: "schema[1].json" })).toBe(true);
        expect(yield* rejects({ $id: "#" })).toBe(false);
        expect(yield* rejects({ $id: "schema.json" })).toBe(false);
        expect(yield* rejects({ $id: "https://example.com/schema" })).toBe(false);
        expect(yield* rejects({ $ref: "other.json#/$defs/T" })).toBe(false);
        expect(yield* rejects({ $ref: "foo:bar" })).toBe(false);
        expect(yield* rejects({ $ref: "//[::1]/schema" })).toBe(false);
        expect(yield* rejects({ $ref: "//[::]/" })).toBe(false);
        expect(yield* rejects({ $ref: "//user:pass@example.com:8080/a:b" })).toBe(false);
        expect(yield* rejects({ $ref: "?q=x/y?z" })).toBe(false);
        expect(yield* rejects({ $ref: "//[::gg]/" })).toBe(true);
        expect(yield* rejects({ $ref: "//[::1:]/" })).toBe(true);
        expect(yield* rejects({ $ref: "//[0000:a::ffff:1:a:]/" })).toBe(true);
        expect(yield* rejects({ $ref: "//host:not-a-port/" })).toBe(true);
        expect(yield* rejects({ $ref: "//user@@host/" })).toBe(true);
        expect(yield* rejects({ $ref: "relative%ZZ" })).toBe(true);
        expect(yield* rejects({ $schema: "meta/schema" })).toBe(true);
        expect(yield* rejects({ $schema: "http://[bad" })).toBe(true);
        expect(yield* rejects({ $schema: "https://example.com/[x]" })).toBe(true);
        expect(yield* rejects({ $schema: "HTTPS://JSON-SCHEMA.ORG/draft/2020-12/schema" })).toBe(true);
        expect(yield* rejects({ $schema: "https://json-schema.org/draft/2020-12/%73chema" })).toBe(true);
        expect(yield* rejects({ $schema: "foo://example.com/a/../schema" })).toBe(true);
        expect(yield* rejects({ $schema: "https://json-schema.org/draft/2020-12/schema" })).toBe(false);
        expect(yield* rejects({ $schema: "foo://[v1.a]/" })).toBe(false);
        expect(yield* rejects({ $schema: "foo://" })).toBe(false);
        expect(yield* rejects({ $vocabulary: { relative: true } })).toBe(true);
        expect(yield* rejects({ $vocabulary: { "foo://EXAMPLE.com/path": true } })).toBe(true);
        expect(yield* rejects({ $vocabulary: { "foo://example.com/path": true } })).toBe(false);
        expect(
          yield* rejects({
            $vocabulary: { "https://json-schema.org/draft/2020-12/vocab/%63ore": true },
          })
        ).toBe(true);
        expect(
          yield* rejects({
            $vocabulary: { "https://json-schema.org/draft/2020-12/vocab/core": true },
          })
        ).toBe(false);
        expect(yield* rejects({ required: ["a", "a"] })).toBe(true);
        expect(yield* rejects({ dependentRequired: { a: ["b", "b"] } })).toBe(true);
        expect(yield* rejects({ type: [] })).toBe(true);
        expect(yield* rejects({ type: ["string", "string"] })).toBe(true);
        expect(yield* rejects({ type: "function" })).toBe(true);
        expect(yield* rejects({ exclusiveMinimum: "1" })).toBe(true);
        expect(yield* rejects({ uniqueItems: "yes" })).toBe(true);
        expect(yield* rejects(null)).toBe(true);
        expect(yield* rejects([])).toBe(true);
        expect(yield* rejects("schema")).toBe(true);
      })
    );

    it("rejects construction when extensions shadow canonical keywords", () => {
      expect(() => Node.make({ extensions: { type: "smuggled" } })).toThrow();
    });

    it("ExtensionKey rejects canonical keywords and accepts extension names", () => {
      expect(O.isNone(S.decodeUnknownOption(ExtensionKey)("type"))).toBe(true);
      expect(O.isSome(S.decodeUnknownOption(ExtensionKey)("x-vendor"))).toBe(true);
    });

    it.effect(
      "preserves a hostile __proto__ wire key without prototype pollution",
      Effect.fnUntraced(function* () {
        const wire: unknown = yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(
          '{"__proto__": {"polluted": 1}, "x-a": 2}'
        );
        const node = yield* decodeNode(wire);
        expect(Object.getOwnPropertyDescriptor(node.extensions, "__proto__")?.value).toEqual({ polluted: 1 });
        expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
        const back = yield* encodeNode(node);
        expect(Object.getOwnPropertyDescriptor(back, "__proto__")?.value).toEqual({ polluted: 1 });
        expect(Object.keys(back).sort()).toEqual(["__proto__", "x-a"]);
        expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
      })
    );
  });

  describe("wire round-trips", () => {
    it.effect(
      "restores hand-written documents exactly",
      Effect.fnUntraced(function* () {
        const wires: ReadonlyArray<Record<string, unknown>> = [
          { type: "object", properties: { a: { type: "string" } }, required: ["a"], "x-k": 1 },
          { items: false, prefixItems: [{ type: "number" }], minItems: 1 },
          { if: { type: "string" }, then: { minLength: 1 }, else: { not: {} } },
          { extensions: { nested: true }, type: "null" },
          { $defs: { A: true }, $ref: "#/$defs/A", $comment: "self-contained" },
          { enum: [1, "two", null, { three: [3] }], const: { deep: [true] } },
          { pattern: "\\p" },
          {},
        ];
        for (const wire of wires) {
          const decoded = yield* decodeNode(wire);
          expect(yield* encodeNode(decoded)).toEqual(wire);
        }
      })
    );

    it.effect(
      "defaults make() to empty options and an empty extensions bag",
      Effect.fnUntraced(function* () {
        const node = Node.make({});
        expect(O.isNone(node.type)).toBe(true);
        expect(O.isNone(node.$ref)).toBe(true);
        expect(node.extensions).toEqual({});
        expect(yield* encodeNode(node)).toEqual({});
      })
    );

    it("property: encode then decode returns an equivalent node", () => {
      fc.assert(fc.property(NodeArbitrary, nodeRoundTrips), fcRuns(100));
    });

    it("property: SubSchema round-trips booleans and nodes", () => {
      fc.assert(fc.property(SubSchemaArbitrary, subSchemaRoundTrips), fcRuns(100));
    });

    it("property: Document round-trips through its envelope", () => {
      fc.assert(fc.property(DocumentArbitrary, documentRoundTrips), fcRuns(50));
    });

    it("property: nodes survive a JSON string boundary", () => {
      fc.assert(fc.property(NodeArbitrary, nodeJsonRoundTrips), fcRuns(100));
    });
  });

  describe("validity of generated documents", () => {
    type EncodedDoc = Record<string, unknown>;

    const COUNT_KEYWORDS: ReadonlyArray<string> = [
      "maxContains",
      "maxItems",
      "maxLength",
      "maxProperties",
      "minContains",
      "minItems",
      "minLength",
      "minProperties",
    ];
    const APPLICATOR_LIST_KEYWORDS: ReadonlyArray<string> = ["allOf", "anyOf", "oneOf", "prefixItems"];
    const SUBSCHEMA_RECORD_KEYWORDS: ReadonlyArray<string> = [
      "$defs",
      "dependentSchemas",
      "patternProperties",
      "properties",
    ];
    const SUBSCHEMA_SINGLE_KEYWORDS: ReadonlyArray<string> = [
      "additionalProperties",
      "contains",
      "contentSchema",
      "else",
      "if",
      "items",
      "not",
      "propertyNames",
      "then",
      "unevaluatedItems",
      "unevaluatedProperties",
    ];

    const compilesAsRegex = (source: string): boolean => {
      try {
        new RegExp(source);
        return true;
      } catch {
        return false;
      }
    };

    const isUniqueStringArray = (entries: unknown): boolean =>
      Array.isArray(entries) &&
      entries.every((entry) => typeof entry === "string") &&
      new Set(entries).size === entries.length;

    const isAbsentOrCount = (input: unknown): boolean =>
      input === undefined || (typeof input === "number" && Number.isInteger(input) && input >= 0);

    const numericKeywordsValid = (doc: EncodedDoc): boolean =>
      (doc.multipleOf === undefined || (typeof doc.multipleOf === "number" && doc.multipleOf > 0)) &&
      COUNT_KEYWORDS.every((key) => isAbsentOrCount(doc[key]));

    const applicatorArraysValid = (doc: EncodedDoc): boolean =>
      APPLICATOR_LIST_KEYWORDS.every(
        (key) => doc[key] === undefined || (Array.isArray(doc[key]) && (doc[key] as Array<unknown>).length > 0)
      );

    const patternKeywordsValid = (doc: EncodedDoc): boolean =>
      (doc.pattern === undefined || (typeof doc.pattern === "string" && compilesAsRegex(doc.pattern))) &&
      (doc.patternProperties === undefined || Object.keys(doc.patternProperties as EncodedDoc).every(compilesAsRegex));

    const requiredKeywordsValid = (doc: EncodedDoc): boolean =>
      (doc.required === undefined || isUniqueStringArray(doc.required)) &&
      (doc.dependentRequired === undefined ||
        Object.values(doc.dependentRequired as EncodedDoc).every(isUniqueStringArray));

    const typeKeywordValid = (doc: EncodedDoc): boolean =>
      doc.type === undefined ||
      typeof doc.type === "string" ||
      (Array.isArray(doc.type) && doc.type.length > 0 && isUniqueStringArray(doc.type));

    const anchorGrammarValid = (doc: EncodedDoc): boolean =>
      ["$anchor", "$dynamicAnchor"].every(
        (key) => doc[key] === undefined || /^[A-Za-z_][-A-Za-z0-9._]*$/.test(doc[key] as string)
      );

    const referenceGrammarValid = (doc: EncodedDoc): boolean =>
      ["$ref", "$dynamicRef"].every((key) => doc[key] === undefined || isUriReferenceString(doc[key])) &&
      (doc.$id === undefined || isIdUriReferenceString(doc.$id)) &&
      (doc.$schema === undefined || isAbsoluteUriString(doc.$schema)) &&
      (doc.$vocabulary === undefined || Object.keys(doc.$vocabulary as EncodedDoc).every(isAbsoluteUriString));

    const isAbsentOrSubschemaRecord = (input: unknown): boolean =>
      input === undefined || Object.values(input as EncodedDoc).every((entry) => isValidEncodedSchema(entry));

    const isAbsentOrSubschemaList = (input: unknown): boolean =>
      input === undefined || (input as Array<unknown>).every((entry) => isValidEncodedSchema(entry));

    const isAbsentOrSubschema = (input: unknown): boolean => input === undefined || isValidEncodedSchema(input);

    const subschemaPositionsValid = (doc: EncodedDoc): boolean =>
      SUBSCHEMA_RECORD_KEYWORDS.every((key) => isAbsentOrSubschemaRecord(doc[key])) &&
      APPLICATOR_LIST_KEYWORDS.every((key) => isAbsentOrSubschemaList(doc[key])) &&
      SUBSCHEMA_SINGLE_KEYWORDS.every((key) => isAbsentOrSubschema(doc[key]));

    const documentChecks: ReadonlyArray<(doc: EncodedDoc) => boolean> = [
      (doc) => !("extensions" in doc),
      numericKeywordsValid,
      applicatorArraysValid,
      patternKeywordsValid,
      requiredKeywordsValid,
      typeKeywordValid,
      anchorGrammarValid,
      referenceGrammarValid,
      subschemaPositionsValid,
    ];

    const isValidEncodedSchema = (value: unknown): boolean => {
      if (typeof value === "boolean") {
        return true;
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
      }
      const doc = value as EncodedDoc;
      return documentChecks.every((check) => check(doc));
    };

    it("property: every generated node encodes to a valid draft-2020-12 document", () => {
      fc.assert(
        fc.property(NodeArbitrary, (node) =>
          Result.match(encodeNodeResult(node), {
            onFailure: () => false,
            onSuccess: isValidEncodedSchema,
          })
        ),
        fcRuns(100)
      );
    });

    it("property: leaf schemas generate values that decode to themselves", () => {
      for (const leaf of [
        AbsoluteUriString,
        AnchorName,
        ExtensionKey,
        ExtensionsBag,
        IdUriReferenceString,
        NonNegativeCount,
        PositiveNumber,
        RegexPatternString,
        TypeName,
        TypeNameList,
        Types,
        UriReferenceString,
      ]) {
        assertSchemaArbitraryDecodesToSelf(leaf, { numRuns: 50 });
      }
    });
  });

  describe("effect generator interop", () => {
    const Tree = S.Struct({
      value: S.String,
      children: S.Array(S.suspend((): S.Codec<TreeType, TreeEncoded> => Tree)),
    }).annotate({ identifier: "Tree" });
    interface TreeType {
      readonly children: ReadonlyArray<TreeType>;
      readonly value: string;
    }
    interface TreeEncoded {
      readonly children: ReadonlyArray<TreeEncoded>;
      readonly value: string;
    }

    const battery: ReadonlyArray<S.Top> = [
      S.Struct({
        name: S.String.check(S.isMinLength(1)),
        age: S.Int,
        email: S.optionalKey(S.String),
        role: S.Literals(["admin", "user"]),
        score: S.Finite.check(S.isBetween({ minimum: 0, maximum: 100 })),
        tags: S.Array(S.String).check(S.isUnique()),
      }),
      S.Tuple([S.String, S.Finite]),
      S.Record(S.String, S.Finite),
      S.Record(S.String.check(S.isPattern(/^[a-z]+$/)), S.Finite),
      S.NullOr(S.String),
      S.Union([S.String, S.Finite, S.Null]),
      S.String.check(S.isPattern(/^[a-z]+$/)),
      S.String.annotate({ contentMediaType: "text/markdown" }),
      S.Null,
      S.Array(S.Struct({ id: S.Int })),
      Tree,
    ];

    it.effect(
      "round-trips S.toJsonSchemaDocument output for a representative battery",
      Effect.fnUntraced(function* () {
        for (const schema of battery) {
          const document = S.toJsonSchemaDocument(schema);
          const decoded = yield* decodeDocument(document);
          expect(yield* encodeDocument(decoded)).toEqual({
            dialect: document.dialect,
            schema: document.schema,
            definitions: document.definitions,
          });
        }
      })
    );

    it.effect(
      "decodes generator output for recursive schemas into resolvable references",
      Effect.fnUntraced(function* () {
        const document = yield* Tree.pipe(S.toJsonSchemaDocument, decodeDocument);
        const root = resolveDocumentRef(document);
        expect(O.isSome(root)).toBe(true);
      })
    );
  });

  describe("resolvers", () => {
    it("resolveLocalRef handles hits, escapes, and misses", () => {
      const defs = {
        User: { kind: "user" },
        "a b": { kind: "space" },
        "a/b": { kind: "slash" },
        café: { kind: "utf8" },
        "til~de": { kind: "tilde" },
        "100%": { kind: "percent" },
      };
      expect(O.getOrThrow(resolveLocalRef("#/$defs/User", defs))).toEqual({ kind: "user" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/a%20b", defs))).toEqual({ kind: "space" });
      expect(O.getOrThrow(resolveLocalRef("#/%24defs/a%20b", defs))).toEqual({ kind: "space" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/a~1b", defs))).toEqual({ kind: "slash" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/caf%C3%A9", defs))).toEqual({ kind: "utf8" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/til~0de", defs))).toEqual({ kind: "tilde" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/100%25", defs))).toEqual({ kind: "percent" });
      expect(O.isNone(resolveLocalRef("#/$defs/Missing", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/definitions/User", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/a/b", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/a%2Fb", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/bad~2escape", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/%", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("https://example.com/schema.json", defs))).toBe(true);
    });

    it.effect(
      "resolveNodeRef follows a node's own $ref into its sibling $defs",
      Effect.fnUntraced(function* () {
        const hit = yield* decodeNode({ $ref: "#/$defs/User", $defs: { User: { type: "object" } } });
        const target = O.getOrThrow(resolveNodeRef(hit));
        expect(typeof target === "boolean" ? target : O.getOrThrow(target.type)).toBe("object");
        expect(O.isNone(resolveNodeRef(yield* decodeNode({ $ref: "#/$defs/User" })))).toBe(true);
        expect(O.isNone(resolveNodeRef(yield* decodeNode({ $defs: { User: {} } })))).toBe(true);
      })
    );

    it.effect(
      "resolveDocumentRef resolves the top-level reference",
      Effect.fnUntraced(function* () {
        const document = yield* decodeDocument({
          dialect: "draft-2020-12",
          schema: { $ref: "#/$defs/User" },
          definitions: { User: { type: "object" } },
        });
        expect(O.isSome(resolveDocumentRef(document))).toBe(true);
        const bare = yield* decodeDocument({
          dialect: "draft-2020-12",
          schema: { type: "null" },
          definitions: {},
        });
        expect(O.isNone(resolveDocumentRef(bare))).toBe(true);
      })
    );
  });

  describe("vocabulary drift guard", () => {
    it("Node's fields are exactly the canonical keywords plus extensions", () => {
      const fieldKeys = Struct.keys(Node.fields).filter((key) => key !== "extensions");
      expect([...fieldKeys].sort()).toEqual([...CanonicalKeyword.Options].sort());
      expect(fieldKeys.every(isCanonicalKeyword)).toBe(true);
    });
  });
});
