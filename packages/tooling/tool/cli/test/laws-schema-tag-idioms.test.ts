import {
  formatSchemaTagIdiomFinding,
  isSchemaTagIdiomsMarkdownPath,
  isSchemaTagIdiomsTypeScriptPath,
  scanSchemaTagIdioms,
  scanSchemaTagIdiomsMarkdown,
} from "@beep/repo-cli/test/Laws";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

const HEADER = [
  'import * as S from "effect/Schema"',
  'import * as Effect from "effect/Effect"',
  'import { LiteralKit } from "@beep/schema"',
];

const source = (lines: ReadonlyArray<string>) => A.join(A.appendAll(HEADER, lines), "\n");
const scan = (lines: ReadonlyArray<string>) => scanSchemaTagIdioms("fixture.ts", source(lines));
const rulesOf = (lines: ReadonlyArray<string>) =>
  A.map(scan(lines), (finding) => [finding.rule, finding.suggestion] as const);

const fence = Str.repeat(3)("`");

describe("schema tag idiom law", () => {
  describe("struct-tag rule", () => {
    it.effect("reports a struct that spells its fixed _tag as a literal or S.tag", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'const A1 = S.Struct({ _tag: S.Literal("A1"), value: S.String })',
            'const A2 = S.Struct({ _tag: S.tag("A2").pipe($I.annoteKey("A2._tag", {})) })',
            'const A3 = S.Struct({ ...base, _tag: S.Literal("A3").annotate({ title: "A3" }) })',
          ])
        ).toEqual([
          ["struct-tag", 'S.TaggedStruct("A1", { … })'],
          ["struct-tag", 'S.TaggedStruct("A2", { … })'],
          ["struct-tag", 'S.TaggedStruct("A3", { … })'],
        ]);
      })
    );

    it.effect("resolves the schema namespace and named imports from the file's own imports", () =>
      Effect.sync(() => {
        const findings = scanSchemaTagIdioms(
          "fixture.ts",
          A.join(
            [
              'import * as Schema from "effect/Schema"',
              'import { Literal as L, Struct } from "effect/Schema"',
              'const A = Schema.Struct({ _tag: Schema.Literal("A") })',
              'const B = Struct({ kind: L("b") })',
            ],
            "\n"
          )
        );
        expect(A.map(findings, (finding) => [finding.rule, finding.suggestion])).toEqual([
          ["struct-tag", 'Schema.TaggedStruct("A", { … })'],
          ["single-literal-field", 'kind: S.tag("b")'],
        ]);
      })
    );

    it.effect("ignores a struct when effect/Schema is not imported", () =>
      Effect.sync(() => {
        expect(
          scanSchemaTagIdioms("fixture.ts", 'import * as S from "./S.ts"\nconst A = S.Struct({ _tag: S.Literal("A") })')
        ).toEqual([]);
      })
    );
  });

  describe("fixed _tag reached through a same-file const", () => {
    it.effect("reports struct-tag and class-tag for a const _tag value or a const fields object", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'const TagA = S.Literal("A")',
            'const TagB = S.tag("B")',
            "const A = S.Struct({ _tag: TagA, value: S.String })",
            "const B = S.Struct({ _tag: TagB })",
            'class C extends S.Class<C>("C")({ _tag: TagB }) {}',
            'const errorFields = { _tag: S.Literal("E"), code: S.Number }',
            'class E extends S.Error<E>("E")(errorFields) {}',
            'const structFields = { _tag: S.tag("F") }',
            "const F = S.Struct(structFields)",
          ])
        ).toEqual([
          ["struct-tag", 'S.TaggedStruct("A", { … })'],
          ["struct-tag", 'S.TaggedStruct("B", { … })'],
          ["class-tag", 'S.TaggedClass<Self>(identifier)("B", { … })'],
          ["class-tag", 'S.TaggedError<Self>(identifier)("E", { … })'],
          ["struct-tag", 'S.TaggedStruct("F", { … })'],
        ]);
      })
    );

    it.effect("leaves a _tag identifier that is imported or a parameter", () =>
      Effect.sync(() => {
        expect(
          scan([
            "const Imported = S.Struct({ _tag: ImportedTag })",
            "const fromParameter = (Shadow: Tag) => S.Struct({ _tag: Shadow })",
          ])
        ).toEqual([]);
      })
    );
  });

  describe("class-tag rule", () => {
    it.effect("reports S.Class and S.Error with a fixed _tag, inline or through S.Struct", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'class C1 extends S.Class<C1>("C1")({ _tag: S.Literal("C1"), id: S.String }) {}',
            'class C2 extends S.Class<C2>("C2")(S.Struct({ _tag: S.tag("C2") })) {}',
            'class E1 extends S.Error<E1>("E1")({ _tag: S.Literal("E1") }) {}',
          ])
        ).toEqual([
          ["class-tag", 'S.TaggedClass<Self>(identifier)("C1", { … })'],
          ["class-tag", 'S.TaggedClass<Self>(identifier)("C2", { … })'],
          ["class-tag", 'S.TaggedError<Self>(identifier)("E1", { … })'],
        ]);
      })
    );
  });

  describe("single-literal-field rule", () => {
    it.effect("reports an inline literal field with annotation, mutability and constructor default steps", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            "const F = S.Struct({",
            '  a: S.Literal("a"),',
            '  b: S.Literal(1).pipe($I.annoteKey("F.b", {})),',
            '  c: S.Literal("c").pipe(S.withConstructorDefault(Effect.succeed("c"))),',
            "  d: S.Literal(false).pipe(S.withConstructorDefault(Effect.succeed(false as const))),",
            '  e: S.Literal("e").pipe(S.mutableKey),',
            "})",
          ])
        ).toEqual([
          ["single-literal-field", 'a: S.tag("a")'],
          ["single-literal-field", "b: S.tag(1)…"],
          ["single-literal-field", 'c: S.tag("c")'],
          ["single-literal-field", "d: S.tag(false)"],
          ["single-literal-field", 'e: S.tag("e")…'],
        ]);
      })
    );

    it.effect("accepts a decoding default only beside the matching constructor default", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            "const F = S.Struct({",
            '  v: S.Literal("v1").pipe(S.withDecodingDefaultKey(Effect.succeed("v1")), S.withConstructorDefault(Effect.succeed<"v1">("v1"))),',
            '  w: S.Literal("w").pipe(S.withDecodingDefaultKey(Effect.succeed("w"))),',
            '  x: S.Literal("x").pipe(S.withConstructorDefault(Effect.succeed("y"))),',
            "})",
          ])
        ).toEqual([["single-literal-field", 'v: S.tag("v1")…']]);
      })
    );

    it.effect("reports a _tag literal in fields that have no tagged constructor", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'class X extends Base.extend<X>("X")({ _tag: S.Literal("X") }) {}',
            'const T = S.TaggedStruct("T", { kind: S.Literal("t") })',
            'class E extends S.TaggedError<E>()("E", { code: S.Literal(404) }) {}',
          ])
        ).toEqual([
          ["single-literal-field", '_tag: S.tag("X")'],
          ["single-literal-field", 'kind: S.tag("t")'],
          ["single-literal-field", "code: S.tag(404)"],
        ]);
      })
    );

    it.effect("reports tagged-union cases, spread field consts and mapFields bodies", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'const Kit = LiteralKit(["a", "b"]).toTaggedUnion("kind")({ a: { v: S.Literal(1) }, b: {} })',
            'const Union = S.TaggedUnion({ Placeholder: { name: S.Literal("codegen") } })',
            'const baseFields = { schemaVersion: S.Literal("v1"), id: S.String }',
            "const Row = S.Struct({ ...baseFields, name: S.String })",
            "const Mapped = Row.mapFields((fields) => ({ ...fields, attempt: S.Literal(1) }))",
          ])
        ).toEqual([
          ["single-literal-field", "v: S.tag(1)"],
          ["single-literal-field", 'name: S.tag("codegen")'],
          ["single-literal-field", 'schemaVersion: S.tag("v1")'],
          ["single-literal-field", "attempt: S.tag(1)"],
        ]);
      })
    );

    it.effect("reports a private const used only as field values", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'const Kind = S.Literal("kind")',
            'const Version = S.Literal("v1").pipe($I.annoteSchema("Version", {}))',
            "type Shape = { readonly version: typeof Version }",
            'const A = S.Struct({ kind: Kind, version: Version.annotateKey({ title: "version" }) })',
            "const B = S.Struct({ kind: Kind })",
          ])
        ).toEqual([
          ["single-literal-field", 'const Kind = S.tag("kind")'],
          ["single-literal-field", 'const Version = S.tag("v1")…'],
        ]);
      })
    );

    it.effect("reports JSDoc example fences on their source lines", () =>
      Effect.sync(() => {
        const findings = scan([
          "/** A block without an Effect Schema import. */",
          "/**",
          " * **Example** (Decode)",
          " *",
          ` * ${fence}ts`,
          ' * import * as S from "effect/Schema"',
          " * const Doc = S.Struct({ version: S.Literal(1) })",
          ` * ${fence}`,
          " */",
          "export const demo = 1",
        ]);
        expect(A.map(findings, (finding) => [finding.line, finding.suggestion])).toEqual([[10, "version: S.tag(1)"]]);
      })
    );
  });

  describe("PR #1943 exclusions", () => {
    it.effect("ignores optional keys", () =>
      Effect.sync(() => {
        expect(
          scan([
            "const F = S.Struct({",
            '  a: S.optionalKey(S.Literal("a")),',
            '  b: S.Literal("b").pipe(S.optionalKey),',
            '  c: S.optional(S.Literal("c")),',
            '  _tag: S.optionalKey(S.Literal("F")),',
            "})",
          ])
        ).toEqual([]);
      })
    );

    it.effect("ignores S.tagDefaultOmit and a _tag with a decoding default", () =>
      Effect.sync(() => {
        expect(
          scan([
            'const A = S.Struct({ _tag: S.tagDefaultOmit("A") })',
            'const B = S.Struct({ _tag: S.tag("B").pipe(S.withDecodingDefaultKey(Effect.succeed("B"))) })',
          ])
        ).toEqual([]);
      })
    );

    it.effect("ignores single- and multi-member S.Literals and LiteralKit", () =>
      Effect.sync(() => {
        expect(
          scan([
            "const F = S.Struct({",
            '  a: S.Literals(["a"]),',
            '  b: S.Literals(["b", "c"]),',
            '  c: LiteralKit(["c"]),',
            '  d: LiteralKit(["d", "e"]),',
            '  _tag: S.Literals(["F"]),',
            "})",
          ])
        ).toEqual([]);
      })
    );

    it.effect("ignores brand chains", () =>
      Effect.sync(() => {
        expect(scan(['const F = S.Struct({ id: S.Literal("x").pipe(S.brand("X")) })'])).toEqual([]);
      })
    );

    it.effect("ignores literals behind S.suspend, inline or through a const", () =>
      Effect.sync(() => {
        expect(
          scan([
            'const KindField = S.Literal("k")',
            "const F = S.Struct({ a: S.suspend(() => S.Literal(1)), kind: S.suspend(() => KindField) })",
          ])
        ).toEqual([]);
      })
    );

    it.effect("accepts S.tag for a Class.extend _tag", () =>
      Effect.sync(() => {
        expect(scan(['class X extends Base.extend<X>("X")({ _tag: S.tag("X") }) {}'])).toEqual([]);
      })
    );

    it.effect("ignores a _tag replaced in a mapFields body", () =>
      Effect.sync(() => {
        expect(scan(['const M = Base.mapFields((fields) => ({ ...fields, _tag: S.Literal("M") }))'])).toEqual([]);
      })
    );

    it.effect("ignores exported literals and consts used outside field positions", () =>
      Effect.sync(() => {
        expect(
          scan([
            'export const Version = S.Literal("v1")',
            'const Kind = S.Literal("k")',
            'const Other = S.Literal("o")',
            "const Choice = S.Union([Kind, Other])",
            "const F = S.Struct({ version: Version, kind: Kind, other: Other })",
            "console.log(Other.literal)",
          ])
        ).toEqual([]);
      })
    );

    it.effect("skips generated files and the Markdown history trees", () =>
      Effect.sync(() => {
        expect(isSchemaTagIdiomsTypeScriptPath("packages/acp/src/_generated/schema.gen.ts")).toBe(false);
        expect(isSchemaTagIdiomsTypeScriptPath("_generated/schema.ts")).toBe(false);
        expect(isSchemaTagIdiomsTypeScriptPath("packages/acp/src/Acp.ts")).toBe(true);
        expect(
          A.map(
            ["goals/x/SPEC.md", "explorations/x/MAP.md", "research/x.md", "docs/_generated/x.md", ".patterns/x.md"],
            isSchemaTagIdiomsMarkdownPath
          )
        ).toEqual([false, false, false, false, true]);
      })
    );
  });

  describe("scanner shapes", () => {
    it.effect("binds only value imports of effect/Schema and the effect barrel", () =>
      Effect.sync(() => {
        const findings = scanSchemaTagIdioms(
          "fixture.ts",
          A.join(
            [
              'import "./polyfill.ts"',
              'import Default from "./default.ts"',
              'import type * as SchemaTypes from "effect/Schema"',
              'import * as O from "effect/Option"',
              'import { type Top, Literal } from "effect/Schema"',
              'import { Effect as RootEffect, Option, Schema as RootSchema } from "effect"',
              'import { Struct as LocalStruct } from "./local.ts"',
              'const A = RootSchema.Struct({ kind: RootSchema.Literal("r").pipe(RootSchema.withConstructorDefault(RootEffect.succeed("r"))) })',
              'const B = SchemaTypes.Struct({ kind: SchemaTypes.Literal("t") })',
              'const C = LocalStruct({ kind: Literal("l") })',
            ],
            "\n"
          )
        );
        expect(A.map(findings, (finding) => finding.suggestion)).toEqual(['kind: RootSchema.tag("r")']);
      })
    );

    it.effect("ignores literal calls and defaults that are not one fixed value", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            "const F = S.Struct({",
            '  a: S.Literal("a", "b"),',
            "  b: S.Literal(...parts),",
            '  c: S.Literal("c").pipe(S.withConstructorDefault()),',
            '  d: S.Literal("d").pipe(S.withConstructorDefault(load("d"))),',
            '  e: S.Literal("e").pipe(S.withConstructorDefault(Effect.succeed)),',
            '  f: S.Literal("f").pipe(S.withConstructorDefault(Other.succeed("f"))),',
            '  g: S.Literal("g").pipe(S.withConstructorDefault(Effect.sync(() => "g"))),',
            '  h: S.Literal("h").pipe(S.withConstructorDefault(lib.Effect.succeed("h"))),',
            '  i: S.Literal("i").pipe(transform()),',
            '  j: S.Literal("j").check(isJ),',
            '  [key]: S.Literal("k"),',
            '  "quoted": S.Literal("q"),',
            '  0: S.Literal("zero"),',
            "})",
            "const G = S.Struct(makeFields())",
            "const H = S.Struct()",
          ])
        ).toEqual([
          ["single-literal-field", '[key]: S.tag("k")'],
          ["single-literal-field", '"quoted": S.tag("q")'],
          ["single-literal-field", '0: S.tag("zero")'],
        ]);
      })
    );

    it.effect("reports a struct tag inside non-class wrappers and S.Error, and orders same-line findings", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'class E2 extends S.Error<E2>("E2")(S.Struct({ _tag: S.Literal("E2") })) {}',
            'const O1 = S.Opaque<O1>()(S.Struct({ _tag: S.Literal("O1") }))',
            'const W1 = wrap(S.Struct({ _tag: S.Literal("W1") }))',
            'const C2 = combine(other, S.Struct({ _tag: S.Literal("C2") }))',
            'const Two = S.Struct({ a: S.Literal("a"), b: S.Literal("b") })',
          ])
        ).toEqual([
          ["class-tag", 'S.TaggedError<Self>(identifier)("E2", { … })'],
          ["struct-tag", 'S.TaggedStruct("O1", { … })'],
          ["struct-tag", 'S.TaggedStruct("W1", { … })'],
          ["struct-tag", 'S.TaggedStruct("C2", { … })'],
          ["single-literal-field", 'a: S.tag("a")'],
          ["single-literal-field", 'b: S.tag("b")'],
        ]);
      })
    );

    it.effect("resolves fields consts through identifiers and spreads, but not through shadowing parameters", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'const fields = { kind: S.Literal("shadowed") }',
            "const fromObject = ({ fields }: Args) => S.Struct(fields)",
            "const fromTuple = ([, fields]: Pair) => S.Struct(fields)",
            "const direct = { version: S.Literal(2) }",
            "const D = S.Struct(direct)",
            "const cycleA = { ...cycleB, a: S.String }",
            'const cycleB = { ...cycleA, b: S.Literal("b") }',
            "const Cy = S.Struct(cycleA)",
            "const cases = { B: { w: S.Literal(2) } }",
            "const V = S.TaggedUnion(cases)",
            "const U = S.TaggedUnion({ ...shared, A: { v: S.Literal(1) } })",
            "const X = S.TaggedUnion(makeCases())",
            'const T = S.toTaggedUnion("kind")({ a: { v: S.Literal(3) } })',
            'const Q = registry.make("q")({ kind: S.Literal("q") })',
          ])
        ).toEqual([
          ["single-literal-field", "version: S.tag(2)"],
          ["single-literal-field", 'b: S.tag("b")'],
          ["single-literal-field", "w: S.tag(2)"],
          ["single-literal-field", "v: S.tag(1)"],
        ]);
      })
    );

    it.effect("reads block and function mapFields callbacks", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            "const M1 = Row.mapFields(function (fields) {",
            "  const extra = 1",
            "  return { ...fields, attempt: S.Literal(extra) }",
            "})",
            "const M2 = Row.mapFields((fields) => {",
            "  return",
            "})",
            "const M3 = Row.mapFields(identity)",
          ])
        ).toEqual([["single-literal-field", "attempt: S.tag(extra)"]]);
      })
    );

    it.effect("follows private const references through annotations and shorthand, not export lists", () =>
      Effect.sync(() => {
        expect(
          rulesOf([
            'const KindA = S.Literal("a")',
            'const KindB = S.Literal("b")',
            'const KindC = S.Literal("c")',
            'const TagD = S.Literal("D")',
            'const kindE = S.Literal("e")',
            'const KindF = S.Literal("f")',
            "const A = S.Struct({",
            '  a: KindA.pipe($I.annoteKey("A.a", {})),',
            "  b: KindB.pipe(S.optionalKey),",
            "  c: wrapField(KindC.annotate),",
            "  kindE,",
            "})",
            "const M = Base.mapFields((fields) => ({ ...fields, _tag: TagD }))",
            "const plain = { kind: KindF }",
            'const KindG = S.Literal("g")',
            "const B = S.Struct({ g: KindG })",
            "export { KindG }",
            "console.log(registry.KindA)",
          ])
        ).toEqual([
          ["single-literal-field", 'const KindA = S.tag("a")'],
          ["single-literal-field", 'const kindE = S.tag("e")'],
        ]);
      })
    );

    it.effect("parses .tsx sources and truncates long matches", () =>
      Effect.sync(() => {
        const long = Str.repeat(130)("x");
        const findings = scanSchemaTagIdioms(
          "View.tsx",
          A.join(
            [
              'import * as S from "effect/Schema"',
              `const Props = S.Struct({ kind: S.Literal("${long}") })`,
              "export const View = () => <div />",
            ],
            "\n"
          )
        );
        expect(A.map(findings, (finding) => finding.match.length)).toEqual([120]);
      })
    );
  });

  describe("Markdown fences and report lines", () => {
    it.effect("reports a fenced struct tag on its Markdown line", () =>
      Effect.sync(() => {
        const markdown = A.join(
          [
            "# Title",
            "",
            `${fence}ts`,
            'import * as S from "effect/Schema"',
            'const Demo = S.Struct({ _tag: S.Literal("Demo") })',
            fence,
            "",
            `${fence}ts`,
            'const NoImport = S.Struct({ _tag: S.Literal("NoImport") })',
            fence,
            `${fence}tsx`,
            'import * as S from "effect/Schema"',
            'const View = () => <div kind={S.Struct({ kind: S.Literal("view") })} />',
            fence,
          ],
          "\n"
        );
        const findings = scanSchemaTagIdiomsMarkdown("README.md", markdown);
        expect(A.map(findings, (finding) => [finding.rule, finding.line, finding.column])).toEqual([
          ["struct-tag", 5, 14],
          ["single-literal-field", 13, 42],
        ]);
      })
    );

    it.effect("fails closed on a Markdown text or JSDoc block the parser refuses", () =>
      Effect.sync(() => {
        const deep = `${Str.repeat(300)(">")} ${fence}ts`;
        const markdown = A.join([deep, 'import * as S from "effect/Schema"', fence], "\n");
        expect(
          A.map(scanSchemaTagIdiomsMarkdown("README.md", markdown), (finding) => [finding.rule, finding.line])
        ).toEqual([["unreadable-markdown", 1]]);
        expect(scanSchemaTagIdiomsMarkdown("README.md", A.join([deep, "const a = 1", fence], "\n"))).toEqual([]);

        const jsDoc = A.join(
          ["/**", ` * ${deep}`, ' * import * as S from "effect/Schema"', ` * ${fence}`, " */"],
          "\n"
        );
        expect(A.map(scan([jsDoc, "export const value = 1"]), (finding) => [finding.rule, finding.line])).toEqual([
          ["unreadable-markdown", 4],
        ]);
      })
    );

    it.effect("formats a finding as file:line:col with rule, match and suggestion", () =>
      Effect.sync(() => {
        expect(A.map(scan(['const F = S.Struct({ kind: S.Literal("k") })']), formatSchemaTagIdiomFinding)).toEqual([
          'fixture.ts:4:22  [single-literal-field] kind: S.Literal("k")  →  kind: S.tag("k")',
        ]);
      })
    );
  });
});
