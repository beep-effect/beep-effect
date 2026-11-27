/**
 * Inline oxlint rule fixture sources.
 *
 * Each oxlint rule carries a list of `invalid` cases (each expected to produce `count`
 * findings) and `valid` cases (expected to be silent). Sources are inline strings — not
 * on-disk fixtures — so the intentional violations never get linted/parsed by Biome, tsc,
 * or the repo's own lint lanes; the harness writes each to a temp file before running oxlint.
 *
 * A case may set `filename` when the rule's behavior depends on the path: the
 * `*.test.ts` gate of `no-manual-effect-runtime-in-tests`, and the host-process reference
 * file exemption of `no-global-process-runtime`, and the production/host gates
 * of `no-direct-process-io`.
 */

import * as A from "effect/Array";
import type { OxlintRule } from "./oxlint-harness.ts";

type OxlintCase = {
  readonly scenario?: string;
  readonly source: string;
  readonly count: number;
  readonly filename?: string;
  readonly fixedSource?: string;
  readonly supportingFiles?: ReadonlyArray<readonly [path: string, source: string]>;
};

export type OxlintRuleSources = {
  readonly invalid: ReadonlyArray<OxlintCase>;
  readonly valid: ReadonlyArray<OxlintCase>;
};

const lines = (...parts: ReadonlyArray<string>): string => A.join(parts, "\n");

const HOST_PROCESS_SUFFIX_MATCHED_PATH = "packages/foundation/modeling/utils/src/HostProcess.ts";

export const OXLINT_SOURCES: {
  readonly [K in Exclude<OxlintRule, import("@beep/lint-rules/oxlint-docs").DocsRuleId>]: OxlintRuleSources;
} = {
  "no-js-extension-imports": {
    invalid: [
      {
        count: 4,
        source: lines(
          `import value from './ProviderInstance.service.js';`,
          `import type { Model } from "../Model.jsx";`,
          `import "./worker.mjs";`,
          `import "./legacy.cjs";`
        ),
        fixedSource: lines(
          `import value from './ProviderInstance.service.ts';`,
          `import type { Model } from "../Model.tsx";`,
          `import "./worker.mts";`,
          `import "./legacy.cts";`
        ),
      },
      {
        count: 1,
        source: `import { App } from "./App.js";`,
        fixedSource: `import { App } from "./App.ts";`,
        supportingFiles: [["App.tsx", `export const App = null;`]],
      },
      {
        count: 2,
        source: lines(`export * from "./all.js";`, `export { value } from '../named.js';`),
        fixedSource: lines(`export * from "./all.ts";`, `export { value } from '../named.ts';`),
      },
      {
        count: 2,
        source: lines(
          `export const load = () => import("./dynamic.js");`,
          `export type Local = import('./types.js').Local;`
        ),
        fixedSource: lines(
          `export const load = () => import("./dynamic.ts");`,
          `export type Local = import('./types.ts').Local;`
        ),
      },
      {
        count: 1,
        source: String.raw`import value from "./mod\u002ejs";`,
        fixedSource: String.raw`import value from "./mod\u002ejs";`,
      },
    ],
    valid: [
      {
        count: 0,
        source: lines(
          `import packageValue from "package/subpath.js";`,
          `import local from "./local.ts";`,
          `import extensionless from "./extensionless";`,
          `export const required = require("./required.js");`,
          "export const computed = import(`./computed.js`);",
          `export const queried = import("./worker.js?raw");`,
          `export const ordinary = "./ordinary.js";`
        ),
      },
      {
        count: 0,
        filename: "fixture.js",
        source: `import value from "./runtime.js";`,
      },
      {
        count: 0,
        source: lines(
          `import value from "./runtime.js";`,
          `import spaced from "./runtime file.js";`,
          `import unicode from "./rüntime.js";`
        ),
        supportingFiles: [
          ["runtime.js", `export default "runtime";`],
          ["runtime file.js", `export default "spaced";`],
          ["rüntime.js", `export default "unicode";`],
        ],
      },
    ],
  },
  "no-opaque-instance-fields": {
    invalid: [
      {
        scenario: '(a) namespace import `* as S from "effect/Schema"` -> S.Opaque, instance field.',
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export class A extends S.Opaque<A>()(S.Struct({})) {`,
          `  bad = 1;`,
          `}`
        ),
      },
      {
        scenario: '(b) default import `Schema from "effect/Schema"` -> Schema.Opaque, instance method.',
        count: 1,
        source: lines(
          `import Schema from "effect/Schema";`,
          `export class B extends Schema.Opaque<B>()(Schema.Struct({})) {`,
          `  method() { return 1; }`,
          `}`
        ),
      },
      {
        scenario: '(c) effect-root namespace `* as Effect from "effect"` -> Effect.Schema.Opaque.',
        count: 1,
        source: lines(
          `import * as Effect from "effect";`,
          `export class C extends Effect.Schema.Opaque<C>()(Effect.Schema.Struct({})) {`,
          `  bad = 2;`,
          `}`
        ),
      },
      {
        scenario: '(d) named `{ Opaque, Struct }` from "effect/Schema" -> bare Opaque(...).',
        count: 1,
        source: lines(
          `import { Opaque, Struct } from "effect/Schema";`,
          `export class D extends Opaque<D>()(Struct({})) {`,
          `  bad = 3;`,
          `}`
        ),
      },
    ],
    valid: [
      {
        scenario: "`static` members are allowed on a Schema.Opaque class.",
        count: 0,
        source: lines(
          `import { Schema } from "effect";`,
          `export class E extends Schema.Opaque<E>()(Schema.Struct({})) {`,
          `  static ok = 1;`,
          `  static make() { return 1; }`,
          `}`
        ),
      },
      {
        scenario: "`Opaque` from an unrelated module is not the Schema Opaque -> not flagged.",
        count: 0,
        source: lines(
          `import { Opaque } from "./local-opaque";`,
          `export class F extends Opaque<F>()({}) {`,
          `  bad = 1;`,
          `}`
        ),
      },
      {
        scenario: "An ordinary class with instance members is untouched.",
        count: 0,
        source: lines(`export class G {`, `  value = 1;`, `  run() { return this.value; }`, `}`),
      },
    ],
  },

  "no-inline-schema-compile": {
    invalid: [
      {
        scenario: "A lowercase module-level schema binding is hoistable; the name's spelling does not matter.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const model = S.Struct({});`,
          `export const h8 = () => S.decodeSync(S.Array(model))([]);`
        ),
      },
      {
        scenario: "A module-level binding declared below its use is still a module binding.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const h9 = () => S.decodeSync(S.Array(later))([]);`,
          `const later = S.Struct({});`
        ),
      },
      {
        scenario: "An imported lowercase schema is a module binding.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `import { model } from "./model";`,
          `export const h10 = () => S.decodeSync(S.Array(model))([]);`
        ),
      },
      {
        scenario: "In-function IIFE over an inline schema: Schema.decodeUnknownSync(Schema.Struct(...))(x).",
        count: 1,
        source: lines(
          `import { Schema } from "effect";`,
          `export const f = (x: unknown) => Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))(x);`
        ),
      },
      {
        scenario: "In-function non-IIFE binding over an inline schema: const d = Schema.decodeSync(Schema.Array(M)).",
        count: 1,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const g = () => {`,
          `  const d = Schema.decodeSync(Schema.Array(Model));`,
          `  return d;`,
          `};`
        ),
      },
      {
        scenario: 'Aliased namespace `* as S from "effect/Schema"` -> S.decodeSync over an inline schema.',
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h = () => S.decodeSync(S.NullOr(Model))(null);`
        ),
      },
      {
        scenario: "Nested schema construction rooted in a static schema is also compiled inline.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h2 = () => S.decodeSync(S.Array(Model))([]);`
        ),
      },
      {
        scenario: "Uncurried assertion adapters over an inline schema build a new AST per call too.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h4 = (input: unknown): void => S.asserts(S.Array(Model), input);`
        ),
      },
      {
        scenario: "Static schema fields nested in an object literal remain hoistable.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h5 = () => S.decodeSync(S.Struct({ value: Model }))({});`
        ),
      },
      {
        scenario: "Static schema entries nested in an array literal remain hoistable.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h6 = () => S.decodeSync(S.Tuple([Model]))([]);`
        ),
      },
      {
        scenario: "Unary numeric literals are static schema arguments.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const h7 = () => S.decodeSync(S.Literal(-1))(-1);`
        ),
      },
      {
        scenario: "A module-level schema refined through `.pipe(...)` in the call is a new AST per call.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Number;`,
          `export const h11 = () => S.decodeSync(Model.pipe(S.check(S.isGreaterThan(0))))(1);`
        ),
      },
      {
        scenario: "`.annotate(...)` on a module-level schema derives a new AST per call too.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h12 = (x: unknown) => S.decodeUnknownSync(Model.annotate({ title: "Model" }))(x);`
        ),
      },
      {
        scenario: "A derived schema nested inside another inline construction is still hoistable.",
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Number;`,
          `export const h13 = () => S.decodeSync(S.Array(Model.check(S.isGreaterThan(0))))([]);`
        ),
      },
    ],
    valid: [
      {
        scenario: "A schema built from a function parameter cannot be hoisted, whatever its name.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const p1 = (rowSchema: S.Schema<unknown>) => S.decodeSync(S.Array(rowSchema))([]);`
        ),
      },
      {
        scenario: "A schema declared inside the function body is local state, not a module binding.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const p2 = (n: number) => {`,
          `  const Local = S.Literal(n);`,
          `  return S.decodeSync(S.Array(Local))([]);`,
          `};`
        ),
      },
      {
        scenario: "`.pipe(...)` over a function parameter cannot be hoisted.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const p3 = (rowSchema: S.Schema<number>) => S.decodeSync(rowSchema.pipe(S.check(S.isGreaterThan(0))))(1);`
        ),
      },
      {
        scenario: "`.pipe(...)` over a body-local schema is local state, not a module binding.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const p4 = (n: number) => {`,
          `  const Local = S.Literal(n);`,
          `  return S.decodeSync(Local.pipe(S.annotate({ title: "Local" })))(n);`,
          `};`
        ),
      },
      {
        scenario: "A module-level pipe taking a body-local argument cannot be hoisted either.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Number;`,
          `export const p5 = (min: number) => S.decodeSync(Model.pipe(S.check(S.isGreaterThan(min))))(min);`
        ),
      },
      {
        scenario: "An argument-free `.pipe()` returns its receiver, so it still hits the parser cache.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Number;`,
          `export const p6 = () => S.decodeSync(Model.pipe())(1);`
        ),
      },
      {
        scenario: "A plain schema reference inside a function hits the per-AST parser cache.",
        count: 0,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const f = (x: unknown) => Schema.decodeUnknownSync(Model)(x);`
        ),
      },
      {
        scenario: "A non-IIFE binding over a plain schema reference compiles once per AST.",
        count: 0,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const g = () => {`,
          `  const d = Schema.decodeSync(Model);`,
          `  return d;`,
          `};`
        ),
      },
      {
        scenario: "A static schema namespace member is a cached AST, not an inline construction.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `import * as Models from "./models";`,
          `export const h3 = () => S.decodeSync(Models.User)({});`
        ),
      },
      {
        scenario: "An uncurried assertion adapter over a plain schema reference also hits the cache.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h4 = (input: unknown): void => S.asserts(Model, input);`
        ),
      },
      {
        scenario: "Module-scope compiler call is allowed (the whole point of the rule).",
        count: 0,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const decode = Schema.decodeSync(Model);`
        ),
      },
      {
        scenario: "`Schema` from an unrelated local module is not the effect Schema -> not flagged.",
        count: 0,
        source: lines(
          `import { Schema } from "./local-schema";`,
          `export const j = () => Schema.decodeSync(Whatever)({});`
        ),
      },
      {
        scenario: "Runtime schema parameters cannot be compiled at module scope.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const decodeRows = (rowSchema: S.Top) => S.decodeSync(S.Array(rowSchema));`
        ),
      },
      {
        scenario: "A nested wrapper around a runtime schema parameter remains dynamic.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const encodedGuard = (shape: S.Top) => S.is(S.toEncoded(shape));`
        ),
      },
      {
        scenario: "Member expressions rooted in runtime values are dynamic schema parameters.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const decodeSection = (input: { schema: S.Top }) => S.decodeSync(input.schema);`
        ),
      },
      {
        scenario: "Runtime schema parameters nested in object literals cannot be hoisted.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const decodeField = (fieldSchema: S.Top) =>`,
          `  S.decodeSync(S.Struct({ value: fieldSchema }));`
        ),
      },
      {
        scenario: "Runtime schema parameters nested in array literals cannot be hoisted.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const decodeTuple = (fieldSchema: S.Top) =>`,
          `  S.decodeSync(S.Tuple([fieldSchema]));`
        ),
      },
      {
        scenario: "Unary runtime values remain parameter-dependent.",
        count: 0,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export const decodeNegated = (value: -1 | 1) =>`,
          `  S.decodeSync(S.Literal(-value));`
        ),
      },
    ],
  },

  "no-manual-effect-runtime-in-tests": {
    invalid: [
      {
        scenario: "Direct Effect.runPromise in a *.test.ts file.",
        count: 1,
        filename: "fixture.test.ts",
        source: lines(`import { Effect } from "effect";`, `export const a = Effect.runPromise(program);`),
      },
      {
        scenario: "Aliased `{ Effect as E }` -> E.runSync.",
        count: 1,
        filename: "alias.test.ts",
        source: lines(`import { Effect as E } from "effect";`, `export const b = E.runSync(program);`),
      },
      {
        scenario: 'Effect-root namespace `* as Eff from "effect"` -> Eff.Effect.runFork.',
        count: 1,
        filename: "namespace.test.ts",
        source: lines(`import * as Eff from "effect";`, `export const c = Eff.Effect.runFork(program);`),
      },
      {
        scenario: "ManagedRuntime.make from effect/ManagedRuntime.",
        count: 1,
        filename: "managed.test.ts",
        source: lines(
          `import * as ManagedRuntime from "effect/ManagedRuntime";`,
          `export const d = ManagedRuntime.make(layer);`
        ),
      },
    ],
    valid: [
      {
        scenario: "The SAME manual runner outside a *.test.ts file is not gated by this rule.",
        count: 0,
        filename: "not-a-test.ts",
        source: lines(`import { Effect } from "effect";`, `export const a = Effect.runPromise(program);`),
      },
      {
        scenario: "`it.effect(...)` usage in a test file is the sanctioned pattern -> silent.",
        count: 0,
        filename: "ok.test.ts",
        source: lines(
          `import { it } from "@effect/vitest";`,
          `import { Effect } from "effect";`,
          `it.effect("works", () => Effect.void);`
        ),
      },
    ],
  },

  "no-global-process-runtime": {
    invalid: [
      { scenario: "Bare global process.platform.", count: 1, source: `export const p = process.platform;` },
      { scenario: "globalThis.process.arch.", count: 1, source: `export const a = globalThis.process.arch;` },
      {
        scenario: "os.platform() via a node:os namespace import.",
        count: 1,
        source: lines(`import * as os from "node:os";`, `export const m = () => os.platform();`),
      },
    ],
    valid: [
      {
        scenario: "A `process` parameter shadows the global -> not flagged.",
        count: 0,
        source: `export const f = (process: { platform: string }) => process.platform;`,
      },
      {
        scenario: "A local `const process` shadows the global -> not flagged.",
        count: 0,
        source: lines(`export function g() {`, `  const process = { arch: "x64" };`, `  return process.arch;`, `}`),
      },
      {
        scenario: "The host-process reference file is exempt regardless of cwd (suffix-matched path).",
        count: 0,
        filename: HOST_PROCESS_SUFFIX_MATCHED_PATH,
        source: `export const supports = process.platform;`,
      },
    ],
  },

  "no-direct-process-io": {
    invalid: [
      {
        count: 7,
        source: lines(
          `process.stdout.write("out");`,
          `globalThis.process["stderr"]["write"]("err");`,
          `process.exit(1);`,
          `process.exitCode = 1;`,
          `process.exitCode++;`,
          `Bun.exit(1);`,
          `Bun.write(Bun.stdout, "out");`
        ),
      },
      {
        count: 1,
        filename: "packages/tooling/tool/cli/src/bin-main.ts",
        source: `process.stderr.write("still forbidden");`,
      },
      {
        count: 1,
        filename: "packages/tooling/tool/docgen/src/bin.ts",
        source: `process.stdout.write("still forbidden");`,
      },
    ],
    valid: [
      {
        count: 0,
        source: lines(
          `process.stdout.isTTY;`,
          `process.kill(process.pid, "SIGKILL");`,
          `Bun.write("output.txt", "data");`,
          `const process = { exit: () => {} }; process.exit();`,
          `const Bun = { exit: () => {} }; Bun.exit();`
        ),
      },
      { count: 0, filename: "packages/demo/test/example.test.ts", source: `process.exit(1);` },
      { count: 0, filename: "packages/demo/src/fixture.js", source: `process.exit(1);` },
      {
        count: 0,
        filename: "apps/professional-desktop/server/IpcStdoutGuard.prelude.ts",
        source: `process.stderr.write("protocol diagnostic");`,
      },
      {
        count: 0,
        filename: "packages/foundation/capability/observability/src/server/ErrorReporting.ts",
        source: `globalThis.process.stderr.write("synchronous reporter");`,
      },
      {
        count: 0,
        filename: "packages/tooling/tool/cli/src/bin-main.ts",
        source: `process.stdout.write("tty reset"); process.exit(0);`,
      },
      {
        count: 0,
        filename: "packages/tooling/tool/docgen/src/bin.ts",
        source: `process.exit(0);`,
      },
    ],
  },

  "namespace-node-imports": {
    invalid: [
      {
        scenario: "Wrong namespace alias for a node: builtin.",
        count: 1,
        source: `import * as foo from "node:fs";\nexport const x = foo;`,
      },
    ],
    valid: [
      {
        scenario: "Canonical alias for the node: builtin.",
        count: 0,
        source: `import * as NodeFS from "node:fs";\nexport const x = NodeFS;`,
      },
    ],
  },
  "no-comments": {
    invalid: [
      { count: 1, source: lines(`// explains the constant`, `export const x = 1;`) },
      { count: 1, source: lines(`/** Local helper. */`, `const helper = () => 1;`, `export const x = helper();`) },
      { count: 1, source: lines(`// eslint-disable-next-line no-console`, `export const x = 1;`) },
      { count: 1, source: lines(`// @ts-ignore`, `export const x: number = "a";`) },
      { count: 1, source: lines(`// Region-confined replacement`, `export const x = 1;`) },
      { count: 1, source: lines(`export const x = 1; // trailing note`) },
      { count: 1, source: lines(`// Copyright is checked by the validator`, `export const x = 1;`) },
      { count: 1, source: lines(`// oxlint-disable-next-line beep/no-comments-- -- x`, `export const x = 1;`) },
    ],
    valid: [
      { count: 0, source: lines(`/** Public. */`, `export const x = 1;`) },
      { count: 0, source: lines(`/** Named later. */`, `const y = 1;`, `export { y };`) },
      { count: 0, source: lines(`const z = 1;`, `export { /** On the specifier. */ z };`) },
      { count: 0, source: lines(`/** Default. */`, `function f() {}`, `export default f;`) },
      { count: 0, source: lines(`/** Wrapped default. */`, `function f() {}`, `export default (f);`) },
      {
        count: 0,
        source: lines(
          `const source = { raw: 1 };`,
          `/** Destructured. */`,
          `const { raw: value } = source;`,
          `export { value };`
        ),
      },
      { count: 0, source: lines(`/**`, ` * Module.`, ` *`, ` * @packageDocumentation`, ` */`, `export const x = 1;`) },
      { count: 0, source: lines(`/// <reference lib="dom" />`, `export const x = 1;`) },
      { count: 0, source: lines(`// SPDX-License-Identifier: MIT`, `export const x = 1;`) },
      {
        count: 0,
        source: lines(`// biome-ignore lint/suspicious/noExplicitAny: fixture input`, `export const x: any = 1;`),
      },
      { count: 0, source: lines(`// @ts-expect-error string is not a number`, `export const x: number = "a";`) },
      { count: 0, source: lines(`// oxlint-disable-next-line no-console -- fixture output`, `export const x = 1;`) },
      { count: 0, source: lines(`// oxlint-disable-next-line no-console-- temporary output`, `export const x = 1;`) },
      { count: 0, source: lines(`export const x = /* @__PURE__ */ Object.freeze({});`) },
      { count: 0, source: lines(`export const o = {`, `  /** Member. */`, `  a: 1,`, `};`) },
      { count: 0, source: lines(`/** @internal */`, `const hidden = 1;`, `export const x = hidden;`) },
      { count: 0, source: lines(`// beep: upstream reads the env here`, `export const x = 1;`) },
      { count: 0, source: lines(`export const s = "// not a comment";`, "export const t = `/* nor this */`;") },
    ],
  },
};
