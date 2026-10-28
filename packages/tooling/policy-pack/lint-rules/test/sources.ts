/**
 * Inline rule fixture sources.
 *
 * Each rule has an `invalid` source (expected to trip the rule N times) and a `valid`
 * source (expected to be silent). Keeping these as string constants — rather than
 * on-disk `.ts` fixture files — avoids the intentional violations being linted/parsed by
 * Biome, tsc, and ESLint; the harness writes each source to a temp file before linting.
 */

import * as A from "effect/Array";
import type { RuleName } from "@beep/lint-rules";

export type RuleSource = {
  readonly invalid: string;
  readonly invalidCount: number;
  readonly valid: string;
  readonly messageIncludes: string;
};

export const SOURCES: { readonly [K in RuleName]: RuleSource } = {
  "no-file-url-pathname": {
    invalidCount: 4,
    messageIncludes: "NodeURL.fileURLToPath(new URL(...))",
    invalid: A.join(
      [
        'const a = new URL("./space here.ts", import.meta.url).pathname;',
        "const b = new URL(`./${name}.ts`, import.meta.url).pathname;",
        "const c = new URL(import.meta.url).pathname;",
        'const d = decodeURIComponent(new URL("./100%25.ts", import.meta.url).pathname);',
      ],
      "\n"
    ),
    valid: A.join(
      [
        'const a = NodeURL.fileURLToPath(new URL("./space here.ts", import.meta.url));',
        'const b = new URL("https://example.com/path").pathname;',
        "const c = new URL(request.url, baseUrl).pathname;",
        'const url = new URL("./asset", import.meta.url);',
        'const path = url.protocol === "file:" ? NodeURL.fileURLToPath(url) : url.pathname;',
        'const d = "new URL(./file, import.meta.url).pathname";',
        '// new URL("./file", import.meta.url).pathname',
      ],
      "\n"
    ),
  },
  "no-native-error": {
    invalidCount: 2,
    messageIncludes: "native Error",
    invalid: A.join(["export const boom = () => new Error('nope');", "export const boom2 = () => new Error();"], "\n"),
    valid: "export const ok = () => 'no native error here';",
  },
  "no-bigint-literals": {
    invalidCount: 3,
    messageIncludes: "BigInt literals",
    invalid: A.join(["export const a = 1n;", "export const b = 0xffn;", "export const c = 0b1010n;"], "\n"),
    valid: A.join(["export const a = BigInt(1);", "export const b = BigInt('255');", "export const c = 42;"], "\n"),
  },
  "no-empty-named-blocks": {
    invalidCount: 1,
    messageIncludes: "empty named import",
    invalid: "import {} from './side-effect.ts';",
    valid: A.join(["import { join } from 'node:path';", "export const p = join('a', 'b');"], "\n"),
  },
  "prefer-array-flat-map": {
    invalidCount: 1,
    messageIncludes: ".map(...).flat()",
    invalid: "export const flattened = [[1], [2]].map((x) => x).flat();",
    valid: A.join(
      ["export const flattened = [[1], [2]].flatMap((x) => x);", "export const mapped = [1, 2].map((x) => x + 1);"],
      "\n"
    ),
  },
  "prefer-exact-optional-key": {
    invalidCount: 22,
    messageIncludes: "exact optional keys",
    invalid: A.join(
      [
        "import * as S from 'effect/Schema';",
        "import * as Schema from 'effect/Schema';",
        "import * as Codec from 'effect/Schema';",
        "import type * as Shape from 'effect/Schema';",
        "import { optional } from 'effect/Schema';",
        "import { a, optional as o } from 'effect/Schema';",
        "import type { OptionFromOptional } from 'effect/Schema';",
        "export const Call = S.Struct({ a: S.optional(S.String) });",
        "export const Piped = S.Struct({ b: X.pipe(S.optional) });",
        "const fields = { c: S.optional(S.Number) };",
        "export const Hoisted = S.Struct(fields);",
        "export const Aliased = Schema.Struct({ d: Schema.optional(Schema.String) });",
        "export const Siblings = S.Struct({ e: S.withDecodingDefault(() => 'x')(S.String), f: S.OptionFromOptional(S.Number) });",
        "export const Mapped = S.Struct({ g: S.String }).mapFields(Struct.map(S.optional));",
        "const opt = S.optional;",
        "export type Typed = S.optional<typeof S.String>;",
        "export type Queried = typeof S.optional;",
        "export const Tuple = S.Tuple([S.String, S.optional(S.Number)]);",
        "export const Computed = S['optional'];",
        "export const ArbitraryAlias = Codec.optional(Codec.String);",
        "export const AliasDefault = Codec.withDecodingDefault(() => 'x')(Codec.String);",
        "export const AliasOption = Codec.OptionFromOptional(Codec.String);",
        "export const AliasComputed = Codec['optional'];",
        "export type AliasType = Codec.optional<typeof Codec.String>;",
        "export type TypeOnlyAlias = Shape.optional<Shape.String>;",
        "export { withDecodingDefault } from 'effect/Schema';",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "import { optionalKey as k } from 'effect/Schema';",
        "import { optional as other } from 'effect/Other';",
        "export { optionalKey } from 'effect/Schema';",
        "export const Exact = S.Struct({ a: S.optionalKey(S.String), b: S.optionalKey(S.UndefinedOr(S.Number)) });",
        "export const Keyed = S.Struct({ c: S.withDecodingDefaultKey(() => 'x')(S.String), d: S.OptionFromOptionalKey(S.String) });",
        "export const Flagged = Flag.optional(1);",
        "export const Local = { optional: 1 }.optional;",
        "const S = { optional: (x: number) => x };",
        "export const LocalS = S.optional(1);",
        "const Schema = { OptionFromOptional: (x: number) => x };",
        "export const LocalSchema = Schema.OptionFromOptional(1);",
        "import * as Codec from 'effect/Schema';",
        "export const AliasExact = Codec.optionalKey(Codec.String);",
        "export const AliasExplicit = Codec.optionalKey(Codec.UndefinedOr(Codec.String));",
        "export type Exactly = S.optionalKey<typeof S.String>;",
        "// S.optional(S.String) in a comment",
        "export const InString = 'S.optional(S.String)';",
      ],
      "\n"
    ),
  },
  "prefer-identity-annote-pipe": {
    invalidCount: 11,
    messageIncludes: "identity annotations go through",
    invalid: A.join(
      [
        "export const Single = S.String.annotate($I.annote('Single', { description: 'one line' }));",
        "export const Multi = S.Struct({ a: S.String }).annotate(",
        "  $SchemaId.annote('Multi', {",
        "    description: 'spans lines',",
        "  })",
        ");",
        "export const TypedAnnote = S.Number.annotate($I.annote<number>('TypedAnnote'));",
        "export const TypedAnnotate = S.Number.annotate<number>($I.annote('TypedAnnotate'));",
        "export const CheckAnnotate = S.Number.check(S.isInt().annotate($I.annote('CheckAnnotate')));",
        "export const Chained = S.String.annotate($Pkg.create('internal/x').annote('Chained'));",
        "export const Key = S.Struct({ a: S.String.annotateKey($I.annote('Key.a')) });",
        "export const SuspendKey = S.Struct({ a: S.suspend(() => S.String).annotateKey($I.annote('SuspendKey.a')) });",
        "export class BaseKey extends S.Opaque<BaseKey>()(S.Struct({ a: S.String.annotateKey($I.annote('BaseKey.a')) })) {}",
        "export class Branch extends S.Opaque<Branch>()(",
        "  S.TaggedStruct('Branch', {",
        "    children: S.Array(S.suspend((): S.Codec<Branch> => Branch)).annotateKey(",
        "      $I.annote('Branch.children', { description: 'recursive base' })",
        "    ),",
        "    parent: S.NullOr(S.suspend((): S.Codec<Branch> => Branch)).annotateKey($I.annote('Branch.parent')),",
        "  })",
        ") {}",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "export class Tree extends S.Opaque<Tree>()(",
        "  S.TaggedStruct('Tree', {",
        "    children: $I.annoteKey('Tree.children', { description: 'recursive base' })(",
        "      S.Array(S.suspend((): S.Codec<Tree> => Tree))",
        "    ),",
        "    parent: S.NullOr(S.suspend((): S.Codec<Tree> => Tree)).annotateKey({ description: 'raw object' }),",
        "  })",
        ") {}",
        "export class Model extends S.Class<Model>('Model')({ a: S.String }, $I.annote('Model', { description: 'class' })) {}",
        "export class Boom extends S.TaggedError<Boom>()('Boom', {}, $I.annoteError<Boom>('Boom', { description: 'error' })) {}",
        "export const Checked = S.Number.check(S.isInt($I.annote('Checked')));",
        "export const Piped = S.String.pipe($I.annoteSchema('Piped', { description: 'canonical' }));",
        "export const PipedKey = S.Struct({ a: S.String.pipe($I.annoteKey('PipedKey.a')) });",
        "export const Plain = S.String.annotate({ identifier: 'Plain' });",
        "export const NotComposer = S.String.annotate(I.annote('NotComposer'));",
        "// S.String.annotate($I.annote('InComment'))",
        "export const InString = 'S.String.annotate($I.annote(1))';",
      ],
      "\n"
    ),
  },
  "no-hand-built-identity-annotation": {
    invalidCount: 10,
    messageIncludes: "hand-built",
    invalid: A.join(
      [
        "export const Pattern = S.String.check(S.isPattern(/x/, { identifier: $I`Pattern`, description: 'd' }));",
        "export const Filter = S.makeFilter((n: number) => n > 0, { identifier: $SchemaId`Filter` });",
        "export const Group = S.makeFilterGroup([S.isInt()], { identifier: $I`Group` });",
        "export const Annotated = S.String.annotate({ identifier: $I`Annotated`, title: 't' });",
        "export const Declared = S.declare((u: unknown): u is string => typeof u === 'string', {",
        "  'identifier': $I`Declared`,",
        "});",
        "export const Interpolated = S.Number.check(S.isInt({ identifier: $I`Interpolated.${'x'}` }));",
        "export const Made = S.Number.check(S.isInt({ identifier: $I.make('Made') }));",
        "export const CreatedMade = S.Number.check(S.isInt({ identifier: $I.create(id).make('CreatedMade') }));",
        "export const CreatedTag = S.Number.check(S.isInt({ identifier: $Pkg.create('internal/x')`CreatedTag` }));",
        "export const Broken = S.Number.check(S.isInt({",
        "  identifier: $Pkg",
        "    .create('internal/x')",
        "    .make('Broken'),",
        "}));",
      ],
      "\n"
    ),
    valid: A.join(
      [
        "export const StringId = S.String.annotate({ identifier: 'StringId' });",
        "export const Untagged = S.String.annotate({ identifier: `Untagged` });",
        "export const NotComposer = S.String.annotate({ identifier: I`NotComposer` });",
        "export const OtherKey = S.String.annotate({ title: $I`OtherKey` });",
        "export const OtherMake = S.String.annotate({ identifier: I.make('OtherMake') });",
        "export const SchemaMake = S.String.annotate({ identifier: S.String.make('x') });",
        "export const MadeTitle = S.String.annotate({ title: $I.make('MadeTitle') });",
        "export const CreatedAnnote = S.Number.check(S.isInt($I.create(id).annote('CreatedAnnote')));",
        "export const Piped = S.String.pipe($I.annoteSchema('Piped'));",
        "export const Checked = S.Number.check(S.isInt($I.annote('Checked')));",
        "export const FieldKey = S.Struct({ a: S.String.annotateKey({ description: 'raw key annotation' }) });",
        "const identifier = $I`Shorthand`;",
        "export const Shorthand = S.String.annotate({ identifier });",
        "export const InString = '{ identifier: $I`InString` }';",
      ],
      "\n"
    ),
  },
};
