import {
  AnchorName,
  CanonicalKeyword,
  Document,
  ExtensionKey,
  ExtensionsBag,
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
import { Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { FastCheck as fc } from "effect/testing";

const decodeNode = S.decodeUnknownEffect(NodeCodec);
const decodeNodeSync = S.decodeUnknownSync(NodeCodec);
const encodeNodeSync = S.encodeSync(NodeCodec);
const decodeDocumentSync = S.decodeUnknownSync(Document);
const encodeDocumentSync = S.encodeSync(Document);

const NodeArbitrary = S.toArbitrary(Node);
const SubSchemaArbitrary = S.toArbitrary(SubSchema);
const DocumentArbitrary = S.toArbitrary(Document);
const nodeEquivalence = S.toEquivalence(Node);
const subSchemaEquivalence = S.toEquivalence(SubSchema);
const documentEquivalence = S.toEquivalence(Document);

describe("JSONSchema", () => {
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
        const wire: unknown = JSON.parse('{"__proto__": {"polluted": 1}, "x-a": 2}');
        const node = yield* decodeNode(wire);
        expect(Object.getOwnPropertyDescriptor(node.extensions, "__proto__")?.value).toEqual({ polluted: 1 });
        expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
        const back = encodeNodeSync(node);
        expect(Object.getOwnPropertyDescriptor(back, "__proto__")?.value).toEqual({ polluted: 1 });
        expect(Object.keys(back).sort()).toEqual(["__proto__", "x-a"]);
        expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
      })
    );
  });

  describe("wire round-trips", () => {
    it("restores hand-written documents exactly", () => {
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
        expect(encodeNodeSync(decodeNodeSync(wire))).toEqual(wire);
      }
    });

    it("defaults make() to empty options and an empty extensions bag", () => {
      const node = Node.make({});
      expect(O.isNone(node.type)).toBe(true);
      expect(O.isNone(node.$ref)).toBe(true);
      expect(node.extensions).toEqual({});
      expect(encodeNodeSync(node)).toEqual({});
    });

    it("property: encode then decode returns an equivalent node", () => {
      fc.assert(
        fc.property(NodeArbitrary, (node) => nodeEquivalence(decodeNodeSync(encodeNodeSync(node)), node)),
        fcRuns(100)
      );
    });

    it("property: SubSchema round-trips booleans and nodes", () => {
      const encode = S.encodeSync(SubSchema);
      const decode = S.decodeUnknownSync(SubSchema);
      fc.assert(
        fc.property(SubSchemaArbitrary, (value) => subSchemaEquivalence(decode(encode(value)), value)),
        fcRuns(100)
      );
    });

    it("property: Document round-trips through its envelope", () => {
      fc.assert(
        fc.property(DocumentArbitrary, (document) =>
          documentEquivalence(decodeDocumentSync(encodeDocumentSync(document)), document)
        ),
        fcRuns(50)
      );
    });

    it("property: nodes survive a JSON string boundary", () => {
      fc.assert(
        fc.property(NodeArbitrary, (node) =>
          nodeEquivalence(decodeNodeSync(JSON.parse(JSON.stringify(encodeNodeSync(node)))), node)
        ),
        fcRuns(100)
      );
    });
  });

  describe("validity of generated documents", () => {
    const isValidEncodedSchema = (value: unknown): boolean => {
      if (typeof value === "boolean") {
        return true;
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
      }
      const doc = value as Record<string, unknown>;
      if ("extensions" in doc) {
        return false;
      }
      const compiles = (source: string): boolean => {
        try {
          new RegExp(source);
          return true;
        } catch {
          return false;
        }
      };
      const uniqueStrings = (entries: unknown): boolean =>
        Array.isArray(entries) &&
        entries.every((entry) => typeof entry === "string") &&
        new Set(entries).size === entries.length;
      const checks: ReadonlyArray<boolean> = [
        doc.multipleOf === undefined || (typeof doc.multipleOf === "number" && doc.multipleOf > 0),
        ...[
          "maxContains",
          "maxItems",
          "maxLength",
          "maxProperties",
          "minContains",
          "minItems",
          "minLength",
          "minProperties",
        ].map(
          (key) =>
            doc[key] === undefined ||
            (typeof doc[key] === "number" && Number.isInteger(doc[key]) && (doc[key] as number) >= 0)
        ),
        ...["allOf", "anyOf", "oneOf", "prefixItems"].map(
          (key) => doc[key] === undefined || (Array.isArray(doc[key]) && (doc[key] as Array<unknown>).length > 0)
        ),
        doc.pattern === undefined || (typeof doc.pattern === "string" && compiles(doc.pattern as string)),
        doc.patternProperties === undefined ||
          Object.keys(doc.patternProperties as Record<string, unknown>).every(compiles),
        doc.required === undefined || uniqueStrings(doc.required),
        doc.dependentRequired === undefined ||
          Object.values(doc.dependentRequired as Record<string, unknown>).every(uniqueStrings),
        doc.type === undefined ||
          typeof doc.type === "string" ||
          (Array.isArray(doc.type) && (doc.type as Array<unknown>).length > 0 && uniqueStrings(doc.type)),
        ...["$anchor", "$dynamicAnchor"].map(
          (key) => doc[key] === undefined || /^[A-Za-z_][-A-Za-z0-9._]*$/.test(doc[key] as string)
        ),
        ...["$id", "$ref", "$dynamicRef"].map((key) => doc[key] === undefined || !/\s/.test(doc[key] as string)),
      ];
      if (!checks.every(Boolean)) {
        return false;
      }
      const subschemaAt = (input: unknown): boolean => isValidEncodedSchema(input);
      const recordOfSubschemas = (input: unknown): boolean =>
        input === undefined || Object.values(input as Record<string, unknown>).every(subschemaAt);
      const listOfSubschemas = (input: unknown): boolean =>
        input === undefined || (input as Array<unknown>).every(subschemaAt);
      const single = (input: unknown): boolean => input === undefined || subschemaAt(input);
      return (
        recordOfSubschemas(doc.$defs) &&
        recordOfSubschemas(doc.dependentSchemas) &&
        recordOfSubschemas(doc.patternProperties) &&
        recordOfSubschemas(doc.properties) &&
        listOfSubschemas(doc.allOf) &&
        listOfSubschemas(doc.anyOf) &&
        listOfSubschemas(doc.oneOf) &&
        listOfSubschemas(doc.prefixItems) &&
        single(doc.additionalProperties) &&
        single(doc.contains) &&
        single(doc.contentSchema) &&
        single(doc.else) &&
        single(doc.if) &&
        single(doc.items) &&
        single(doc.not) &&
        single(doc.propertyNames) &&
        single(doc.then) &&
        single(doc.unevaluatedItems) &&
        single(doc.unevaluatedProperties)
      );
    };

    it("property: every generated node encodes to a valid draft-2020-12 document", () => {
      fc.assert(
        fc.property(NodeArbitrary, (node) => isValidEncodedSchema(encodeNodeSync(node))),
        fcRuns(100)
      );
    });

    it("property: leaf schemas generate values that decode to themselves", () => {
      for (const leaf of [
        AnchorName,
        ExtensionKey,
        ExtensionsBag,
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
        score: S.Number.check(S.isBetween({ minimum: 0, maximum: 100 })),
        tags: S.Array(S.String).check(S.isUnique()),
      }),
      S.Tuple([S.String, S.Number]),
      S.Record(S.String, S.Number),
      S.Record(S.String.check(S.isPattern(/^[a-z]+$/)), S.Number),
      S.NullOr(S.String),
      S.Union([S.String, S.Number, S.Null]),
      S.String.check(S.isPattern(/^[a-z]+$/)),
      S.String.annotate({ contentMediaType: "text/markdown" }),
      S.Null,
      S.Array(S.Struct({ id: S.Int })),
      Tree,
    ];

    it("round-trips S.toJsonSchemaDocument output for a representative battery", () => {
      for (const schema of battery) {
        const document = S.toJsonSchemaDocument(schema);
        const decoded = decodeDocumentSync(document);
        expect(encodeDocumentSync(decoded)).toEqual({
          dialect: document.dialect,
          schema: document.schema,
          definitions: document.definitions,
        });
      }
    });

    it("decodes generator output for recursive schemas into resolvable references", () => {
      const document = decodeDocumentSync(S.toJsonSchemaDocument(Tree));
      const root = resolveDocumentRef(document);
      expect(O.isSome(root)).toBe(true);
    });
  });

  describe("resolvers", () => {
    it("resolveLocalRef handles hits, escapes, and misses", () => {
      const defs = { User: { kind: "user" }, "a/b": { kind: "slash" }, "til~de": { kind: "tilde" } };
      expect(O.getOrThrow(resolveLocalRef("#/$defs/User", defs))).toEqual({ kind: "user" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/a~1b", defs))).toEqual({ kind: "slash" });
      expect(O.getOrThrow(resolveLocalRef("#/$defs/til~0de", defs))).toEqual({ kind: "tilde" });
      expect(O.isNone(resolveLocalRef("#/$defs/Missing", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/definitions/User", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/a/b", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("#/$defs/", defs))).toBe(true);
      expect(O.isNone(resolveLocalRef("https://example.com/schema.json", defs))).toBe(true);
    });

    it("resolveNodeRef follows a node's own $ref into its sibling $defs", () => {
      const hit = decodeNodeSync({ $ref: "#/$defs/User", $defs: { User: { type: "object" } } });
      const target = O.getOrThrow(resolveNodeRef(hit));
      expect(typeof target === "boolean" ? target : O.getOrThrow(target.type)).toBe("object");
      expect(O.isNone(resolveNodeRef(decodeNodeSync({ $ref: "#/$defs/User" })))).toBe(true);
      expect(O.isNone(resolveNodeRef(decodeNodeSync({ $defs: { User: {} } })))).toBe(true);
    });

    it("resolveDocumentRef resolves the top-level reference", () => {
      const document = decodeDocumentSync({
        dialect: "draft-2020-12",
        schema: { $ref: "#/$defs/User" },
        definitions: { User: { type: "object" } },
      });
      expect(O.isSome(resolveDocumentRef(document))).toBe(true);
      const bare = decodeDocumentSync({ dialect: "draft-2020-12", schema: { type: "null" }, definitions: {} });
      expect(O.isNone(resolveDocumentRef(bare))).toBe(true);
    });
  });

  describe("vocabulary drift guard", () => {
    it("Node's fields are exactly the canonical keywords plus extensions", () => {
      const fieldKeys = Struct.keys(Node.fields).filter((key) => key !== "extensions");
      expect([...fieldKeys].sort()).toEqual([...CanonicalKeyword.Options].sort());
      expect(fieldKeys.every(isCanonicalKeyword)).toBe(true);
    });
  });
});
