import {
  planSchemaParityCodemodFile,
  SchemaParityCodemodFileOutcome,
  schemaDefaultHelpersRule,
} from "@beep/repo-cli/test/Lint";
import { A } from "@beep/utils";
import { assert, describe, it } from "@effect/vitest";
import { Project, ts } from "ts-morph";

const UTILS = "packages/foundation/modeling/schema/src/SchemaUtils";
const FIXTURE_MODULE = "packages/example/src/fixture.ts";
const UTILS_IMPORT = '"../../foundation/modeling/schema/src/SchemaUtils/index.ts"';

// Pre-retirement helper surfaces at the owner module paths: the rule resolves
// helpers by declaration module, so the stubs stand in for @beep/schema.
const CONSTRUCTOR_DEFAULTS_STUB = `export declare const withNoneDefault: <S>(self: S) => S;
export declare const withConstantDefault: <A>(value: A) => <S>(self: S) => S;
`;

const KEY_DEFAULTS_STUB = `export declare const withKeyDefaults: {
  <S extends { readonly Type: unknown }>(value: S["Type"]): (self: S) => S;
  <S extends { readonly Type: unknown }>(self: S, value: S["Type"]): S;
};
export declare function withEmptyArrayDefaults<T>(): <S>(self: S) => S;
export declare function withEmptyArrayDefaults<S>(self: S): S;
`;

const INDEX_STUB = `export * from "./withConstructorDefaults.ts";
export * from "./withKeyDefaults.ts";
`;

const compilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
};

const planFixture = (text: string): SchemaParityCodemodFileOutcome => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions });
  project.createSourceFile(`/repo/${UTILS}/withConstructorDefaults.ts`, CONSTRUCTOR_DEFAULTS_STUB);
  project.createSourceFile(`/repo/${UTILS}/withKeyDefaults.ts`, KEY_DEFAULTS_STUB);
  project.createSourceFile(`/repo/${UTILS}/index.ts`, INDEX_STUB);
  const sourceFile = project.createSourceFile(`/repo/${FIXTURE_MODULE}`, text);
  return planSchemaParityCodemodFile(sourceFile, [schemaDefaultHelpersRule], FIXTURE_MODULE);
};

const plannedText = (outcome: SchemaParityCodemodFileOutcome): string => {
  assert.strictEqual(outcome._tag, "Planned");
  return SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? outcome.nextText : "";
};

const residueReasons = (outcome: SchemaParityCodemodFileOutcome): ReadonlyArray<string> =>
  SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? A.map(outcome.plan.residue, (entry) => entry.reason) : [];

const header = `import { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
`;

describe("schema-default-helpers rule", () => {
  it("rewrites point-free withNoneDefault and adds the Effect import when missing", () => {
    const text = `import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export const a = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
import { Effect } from "effect";

export const a = S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone));
`
    );
  });

  it("promotes a type-only Effect import that binds nothing else", () => {
    const text = `import type { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export type Run = Effect.Effect<void>;
export const a = S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault);
export const b = S.OptionFromNullOr(S.Number).pipe(SchemaUtils.withNoneDefault);
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `import { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export type Run = Effect.Effect<void>;
export const a = S.OptionFromNullOr(S.String).pipe(S.withConstructorDefault(Effect.succeedNone));
export const b = S.OptionFromNullOr(S.Number).pipe(S.withConstructorDefault(Effect.succeedNone));
`
    );
  });

  it("promotes Effect out of a shared type-only import and an inline type specifier", () => {
    const shared = `import type { Duration, Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export type Run = Effect.Effect<Duration.Duration>;
export const a = S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault);
`;
    assert.strictEqual(
      plannedText(planFixture(shared)),
      `import { type Duration, Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export type Run = Effect.Effect<Duration.Duration>;
export const a = S.OptionFromNullOr(S.String).pipe(S.withConstructorDefault(Effect.succeedNone));
`
    );
    const inline = `import { type Effect, Option } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export type Run = Effect.Effect<Option.Option<void>>;
export const a = S.OptionFromNullOr(S.String).pipe(SchemaUtils.withNoneDefault);
`;
    assert.strictEqual(
      plannedText(planFixture(inline)),
      `import { Effect, Option } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
export type Run = Effect.Effect<Option.Option<void>>;
export const a = S.OptionFromNullOr(S.String).pipe(S.withConstructorDefault(Effect.succeedNone));
`
    );
  });

  it("rewrites curried withConstantDefault onto the existing Effect import", () => {
    const text = `${header}export const v = S.Literal("v1").pipe(SchemaUtils.withConstantDefault("v1"));\n`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${header}export const v = S.Literal("v1").pipe(S.withConstructorDefault(Effect.succeed("v1")));\n`
    );
  });

  it("splits a literal withKeyDefaults into the two upstream pipe steps", () => {
    const text = `${header}export const k = S.String.pipe(SchemaUtils.withKeyDefaults("fallback"));\n`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${header}export const k = S.String.pipe(S.withConstructorDefault(Effect.succeed("fallback")), S.withDecodingDefaultTypeKey(Effect.succeed("fallback")));\n`
    );
  });

  it("binds a constructed withKeyDefaults default once, above the statement and its JSDoc", () => {
    const text = `${header}/** Doc. */
export const Settings = S.Struct({
  tags: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(["a", "b"])),
});
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${header}const settingsTagsDefault = ["a", "b"];
/** Doc. */
export const Settings = S.Struct({
  tags: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed(settingsTagsDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(settingsTagsDefault))),
});
`
    );
  });

  it("keeps a literal default literal for a literal-typed schema and binds an empty array through A.empty", () => {
    const text = `${header}declare const Policy: {
  readonly Type: "fail" | "replace";
  pipe<B>(f: (self: typeof Policy) => B): B;
};
declare const Tags: { readonly Type: ReadonlyArray<string>; pipe<B>(f: (self: typeof Tags) => B): B };
export const Options = S.Struct({
  policy: Policy.pipe(SchemaUtils.withKeyDefaults("fail")),
  tags: Tags.pipe(SchemaUtils.withKeyDefaults([])),
});
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `import { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
import * as A from "effect/Array";

declare const Policy: {
  readonly Type: "fail" | "replace";
  pipe<B>(f: (self: typeof Policy) => B): B;
};
declare const Tags: { readonly Type: ReadonlyArray<string>; pipe<B>(f: (self: typeof Tags) => B): B };
const optionsTagsDefault = A.empty();
export const Options = S.Struct({
  policy: Policy.pipe(S.withConstructorDefault(Effect.succeed("fail" as const)), S.withDecodingDefaultTypeKey(Effect.succeed("fail" as const))),
  tags: Tags.pipe(S.withConstructorDefault(Effect.succeed(optionsTagsDefault)), S.withDecodingDefaultTypeKey(Effect.succeed(optionsTagsDefault))),
});
`
    );
  });

  it("keeps explicit withConstantDefault type arguments on Effect.succeed", () => {
    const text = `${header}export const v = S.Literal("v1").pipe(SchemaUtils.withConstantDefault<"v1" | "v2">("v1"));\n`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${header}export const v = S.Literal("v1").pipe(S.withConstructorDefault(Effect.succeed<"v1" | "v2">("v1")));\n`
    );
  });

  it("pipes data-first withKeyDefaults calls", () => {
    const text = `${header}export const d = SchemaUtils.withKeyDefaults(S.String, "x");\n`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${header}export const d = S.String.pipe(S.withConstructorDefault(Effect.succeed("x")), S.withDecodingDefaultTypeKey(Effect.succeed("x")));\n`
    );
  });

  it("flattens data-first calls into the surrounding pipes instead of chaining them", () => {
    const text = `${header}export const t = SchemaUtils.withKeyDefaults(S.String.pipe(S.trim), "x").pipe(S.brand("T"));
export const n = SchemaUtils.withNoneDefault(S.OptionFromNullOr(S.String)).pipe(S.annotateKey({}));
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${header}export const t = S.String.pipe(S.trim, S.withConstructorDefault(Effect.succeed("x")), S.withDecodingDefaultTypeKey(Effect.succeed("x")), S.brand("T"));
export const n = S.OptionFromNullOr(S.String).pipe(S.withConstructorDefault(Effect.succeedNone), S.annotateKey({}));
`
    );
  });

  it("binds one empty array for withEmptyArrayDefaults and uses the value-level decoding default", () => {
    const text = `${header}export const List = S.Struct({
  items: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
});
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `import { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from ${UTILS_IMPORT};
import * as A from "effect/Array";

const listItemsDefault = A.empty<string>();
export const List = S.Struct({
  items: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed(listItemsDefault)), S.withDecodingDefaultType(Effect.succeed(listItemsDefault))),
});
`
    );
  });

  it("keeps a constructed default inside a function as residue", () => {
    const text = `${header}export const make = () => S.Struct({ tags: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(["a"])) });\n`;
    const outcome = planFixture(text);
    assert.strictEqual(plannedText(outcome), text);
    assert.deepStrictEqual(residueReasons(outcome), ["constructed-default-inside-function"]);
  });

  it("does not emit Effect where a parameter shadows it", () => {
    const text = `${header}export const make = (Effect: number) => [Effect, S.String.pipe(SchemaUtils.withConstantDefault("v"))];\n`;
    const outcome = planFixture(text);
    assert.strictEqual(plannedText(outcome), text);
    assert.deepStrictEqual(residueReasons(outcome), ["effect-binding-conflict"]);
  });

  it("reports a withKeyDefaults step used outside a pipe", () => {
    const text = `${header}export const step = SchemaUtils.withKeyDefaults("x");\n`;
    assert.deepStrictEqual(residueReasons(planFixture(text)), ["withDecodingDefaultTypeKey-outside-pipe"]);
  });
});
