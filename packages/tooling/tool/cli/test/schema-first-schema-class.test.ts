import { SchemaFirstSchemaClass } from "@beep/repo-cli/test/Lint";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { ts } from "ts-morph";

const parse = (lines: ReadonlyArray<string>) =>
  SchemaFirstSchemaClass.scanSourceFile(
    ts.createSourceFile("fixture.ts", A.join(lines, "\n"), ts.ScriptTarget.Latest, true)
  );

const declarationFacts = (lines: ReadonlyArray<string>) =>
  A.map(parse(lines).declarations, (declaration) => ({
    symbol: declaration.symbol,
    kind: declaration.kind,
    brand: declaration.brandState,
  }));

const declaration = (overrides: Partial<typeof SchemaFirstSchemaClass.SchemaClassDeclaration.Type> = {}) =>
  SchemaFirstSchemaClass.SchemaClassDeclaration.make({
    symbol: "Point",
    kind: "Class",
    brandState: "nominal",
    line: 1,
    offset: 0,
    hasInstanceMembers: false,
    hasIdentityTemplate: true,
    hasIdentityAnnotation: true,
    hasInlineSource: true,
    hasDeclarationHooks: false,
    ...overrides,
  });

describe("SchemaFirstSchemaClass.scanSourceFile", () => {
  it("classifies every schema class kind and brand state", () => {
    expect(
      declarationFacts([
        'class A extends S.Class<A>("A")({ a: S.String }) {}',
        'class B extends S.TaggedClass<B, {}>()("B", { b: S.String }) {}',
        'class C extends S.Error<C, { readonly brand: unique symbol }>("C")({ c: S.String }) {}',
        'class D extends S.TaggedError<D, { readonly nominal: unique symbol }>()("D", { d: S.String }) {}',
        "class E extends S.Opaque<E, Brand<Readonly<{ tag: string }>>>()(S.Struct({ e: S.String })) {}",
      ])
    ).toEqual([
      { symbol: "A", kind: "Class", brand: "missing" },
      { symbol: "B", kind: "TaggedClass", brand: "structural" },
      { symbol: "C", kind: "Error", brand: "nominal" },
      { symbol: "D", kind: "TaggedError", brand: "nominal" },
      { symbol: "E", kind: "Opaque", brand: "nominal" },
    ]);
  });

  it("resolves schema namespaces from effect/Schema imports and ignores other heritage", () => {
    expect(
      declarationFacts([
        'import * as Schema from "effect/Schema";',
        'import { Schema as Sch, Effect } from "effect";',
        'import * as Local from "./Schema.ts";',
        'import { Other } from "./other.ts";',
        'import "./side-effect.ts";',
        "class A extends Schema.Class<A>('A')({}) {}",
        "class B extends Sch.Opaque<B>()(Sch.Struct({})) {}",
        "class C extends Local.Class<C>('C')({}) {}",
        "class D extends Z.Class<D>('D')({}) {}",
        "class E extends S.Struct<E>('E')({}) {}",
        "class F extends S.Class {}",
        "class G extends makeBase()() {}",
        "class H extends (S.Class<H>('H'))({}) {}",
        "class I implements Other {}",
        "const J = class extends S.Class<unknown>('J')({}) {};",
      ])
    ).toEqual([
      { symbol: "A", kind: "Class", brand: "missing" },
      { symbol: "B", kind: "Opaque", brand: "missing" },
      { symbol: "C", kind: "Class", brand: "missing" },
      { symbol: "<anonymous>@15", kind: "Class", brand: "missing" },
    ]);
  });

  it("collects .extend roots, base classes, instanceof, new and S.instanceOf targets", () => {
    expect(
      parse([
        "class Child extends Root.extend<Child>('Child')({}) {}",
        "const Derived = Base.extend({});",
        "class Sub extends models.Parent {}",
        "class Mixed extends withMixin(Thing) {}",
        "const isA = value instanceof A;",
        "const isNested = value instanceof ns.Nested;",
        "const made = new B({});",
        "const call = new (factory())();",
        "const schema = S.instanceOf(C);",
        "const empty = S.instanceOf();",
        "const extendRef = Base.extend;",
        "const isWeird = value instanceof (pick());",
      ]).referencedNames
    ).toEqual(["Root", "Base", "Parent", "A", "Nested", "B", "C"]);
  });

  it("reports instance members, identity metadata, inline sources and declaration hooks", () => {
    // [symbol, hasInstanceMembers, hasIdentityTemplate, hasIdentityAnnotation, hasInlineSource, hasDeclarationHooks]
    expect(
      A.map(
        parse([
          "class Plain extends S.Class<Plain>($I`Plain`)({}, $I.annote('Plain', { description: 'x' })) {}",
          "class Behaviour extends S.Class<Behaviour>('Behaviour')({}) { get label() { return 'x' } }",
          "class Statics extends S.Class<Statics>('Statics')({}) { static readonly zero = 0; static { void 0 }; }",
          "class Hooked extends S.Class<Hooked>('Hooked')({}, { toArbitrary: () => undefined }) {}",
          "class TaggedHooked extends S.TaggedClass<TaggedHooked>()('T', {}, { 'toEquivalence': () => undefined }) {}",
          "class ViaAnnote extends S.Class<ViaAnnote>($I`ViaAnnote`)({}, $I.annote('ViaAnnote', { [key]: 1, toCodecArbitrary: () => undefined })) {}",
          "class OpaqueNamed extends S.Opaque<OpaqueNamed>()(Named.fields) {}",
          "class Constructed extends S.Class<Constructed>('Constructed')({}) { constructor() { super({}) } }",
          "class Indexed extends S.Class<Indexed>('Indexed')({}, annotations) { [key: string]: unknown }",
        ]).declarations,
        (declaration) => [
          declaration.symbol,
          declaration.hasInstanceMembers,
          declaration.hasIdentityTemplate,
          declaration.hasIdentityAnnotation,
          declaration.hasInlineSource,
          declaration.hasDeclarationHooks,
        ]
      )
    ).toEqual([
      ["Plain", false, true, true, true, false],
      ["Behaviour", true, false, false, true, false],
      ["Statics", false, false, false, true, false],
      ["Hooked", false, false, false, true, true],
      ["TaggedHooked", false, false, false, true, true],
      ["ViaAnnote", false, true, true, true, true],
      ["OpaqueNamed", false, false, false, false, false],
      ["Constructed", true, false, false, true, false],
      ["Indexed", true, false, false, true, false],
    ]);
  });
});

describe("SchemaFirstSchemaClass predicates", () => {
  it("recognises generated headers only in the leading comment block", () => {
    expect(
      SchemaFirstSchemaClass.isGeneratedSourceText("/**\n * GENERATED FILE - do not edit.\n */\nexport {}\n")
    ).toBe(true);
    expect(SchemaFirstSchemaClass.isGeneratedSourceText("// Hand-written module.\nexport {}\n")).toBe(false);
    expect(SchemaFirstSchemaClass.isGeneratedSourceText("export {}\n// @generated\n")).toBe(false);
  });
});

describe("SchemaFirstSchemaClass inventory entries", () => {
  const file = "packages/example/src/Point.ts";
  const owner = "@beep/example";

  it("flags missing and structural brands but not nominal ones", () => {
    assertSome(
      O.map(SchemaFirstSchemaClass.unbrandedEntry(declaration({ brandState: "missing" }), file, owner), (entry) => [
        entry.kind,
        entry.reason,
      ]),
      [
        "unbranded-schema-class",
        "S.Class declaration has no brand type argument; add { readonly brand: unique symbol } (D4).",
      ]
    );
    assertSome(
      O.map(
        SchemaFirstSchemaClass.unbrandedEntry(declaration({ brandState: "structural", kind: "Opaque" }), file, owner),
        (entry) => entry.reason
      ),
      "S.Opaque declaration carries the structural {} brand; use { readonly brand: unique symbol } or record a schema-first exception (D4)."
    );
    assertNone(SchemaFirstSchemaClass.unbrandedEntry(declaration(), file, owner));
  });

  it("flags plain-data classes and keeps classes with a reason to stay classes", () => {
    const none = HashSet.empty<string>();
    const reasonOf = (overrides: Partial<typeof SchemaFirstSchemaClass.SchemaClassDeclaration.Type>, names = none) =>
      O.map(SchemaFirstSchemaClass.plainDataEntry(declaration(overrides), file, owner, names), (entry) => [
        entry.kind,
        entry.symbol,
        entry.reason,
      ]);

    assertSome(reasonOf({}), [
      "plain-data-schema-class",
      "Point",
      "Plain-data S.Class should be a branded S.Opaque over S.Struct (D1).",
    ]);
    assertSome(reasonOf({ kind: "TaggedClass" }), [
      "plain-data-schema-class",
      "Point",
      "Plain-data S.TaggedClass should be a branded S.Opaque over S.TaggedStruct (D1).",
    ]);
    assertNone(reasonOf({ kind: "TaggedError" }));
    assertNone(reasonOf({ kind: "Opaque" }));
    assertNone(reasonOf({ hasInstanceMembers: true }));
    assertNone(reasonOf({ hasDeclarationHooks: true }));
    assertNone(reasonOf({}, HashSet.make("Point")));
  });
});

describe("SchemaFirstSchemaClass.missingIdentityAnnotationOffsets", () => {
  it("parses brand type arguments with nested angle brackets", () => {
    const content = A.join(
      [
        "class A extends S.Class<A, Brand<Readonly<{ readonly tag: string }>>>($I`A`)({ a: S.String }) {}",
        "class B extends S.Opaque<B, { readonly brand: unique symbol }>()(S.Struct({ b: S.String })) {}",
        "class C extends S.Opaque<C>()(Named) {}",
        "class D extends S.Class<D>('D')({ d: S.String }) {}",
        "class E extends S.TaggedClass<E>()('E', { e: S.String }) {}",
        'class F extends S.Class<F, { readonly brand: unique symbol }>($I`F`)({}, $I.annote("F", {})) {}',
      ],
      "\n"
    );
    const offsets = SchemaFirstSchemaClass.missingIdentityAnnotationOffsets("fixture.tsx", content);
    expect(A.map(offsets, (offset) => Str.slice(offset, offset + 8)(content))).toEqual(["S.Class<", "S.Opaque"]);
  });
});
