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
 * file exemption of `no-global-process-runtime`.
 */
import type { OxlintRule } from "./oxlint-harness.ts";

/** One fixture: a source, its expected finding count, and an optional path override. */
type OxlintCase = {
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

const lines = (...parts: ReadonlyArray<string>): string => parts.join("\n");

/** The repo path the host-process reference exemption keys on (suffix-matched by the rule). */
const HOST_PROCESS_FILE = "packages/foundation/capability/chalk/src/internal/SupportsColor.ts";

export const OXLINT_SOURCES: { readonly [K in OxlintRule]: OxlintRuleSources } = {
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
        fixedSource: `import { App } from "./App.tsx";`,
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
        source: `import value from "./runtime.js";`,
        supportingFiles: [["runtime.js", `export default "runtime";`]],
      },
    ],
  },
  "no-opaque-instance-fields": {
    invalid: [
      // (a) namespace import `* as S from "effect/Schema"` -> S.Opaque, instance field.
      {
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `export class A extends S.Opaque<A>()(S.Struct({})) {`,
          `  bad = 1;`,
          `}`
        ),
      },
      // (b) default import `Schema from "effect/Schema"` -> Schema.Opaque, instance method.
      {
        count: 1,
        source: lines(
          `import Schema from "effect/Schema";`,
          `export class B extends Schema.Opaque<B>()(Schema.Struct({})) {`,
          `  method() { return 1; }`,
          `}`
        ),
      },
      // (c) effect-root namespace `* as Effect from "effect"` -> Effect.Schema.Opaque.
      {
        count: 1,
        source: lines(
          `import * as Effect from "effect";`,
          `export class C extends Effect.Schema.Opaque<C>()(Effect.Schema.Struct({})) {`,
          `  bad = 2;`,
          `}`
        ),
      },
      // (d) named `{ Opaque, Struct }` from "effect/Schema" -> bare Opaque(...).
      {
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
      // `static` members are allowed on a Schema.Opaque class.
      {
        count: 0,
        source: lines(
          `import { Schema } from "effect";`,
          `export class E extends Schema.Opaque<E>()(Schema.Struct({})) {`,
          `  static ok = 1;`,
          `  static make() { return 1; }`,
          `}`
        ),
      },
      // `Opaque` from an unrelated module is not the Schema Opaque -> not flagged.
      {
        count: 0,
        source: lines(
          `import { Opaque } from "./local-opaque";`,
          `export class F extends Opaque<F>()({}) {`,
          `  bad = 1;`,
          `}`
        ),
      },
      // An ordinary class with instance members is untouched.
      {
        count: 0,
        source: lines(`export class G {`, `  value = 1;`, `  run() { return this.value; }`, `}`),
      },
    ],
  },

  "no-inline-schema-compile": {
    invalid: [
      // In-function IIFE: Schema.decodeUnknownSync(M)(x).
      {
        count: 1,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const f = (x: unknown) => Schema.decodeUnknownSync(Model)(x);`
        ),
      },
      // In-function non-IIFE binding: const d = Schema.decodeSync(M).
      {
        count: 1,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const g = () => {`,
          `  const d = Schema.decodeSync(Model);`,
          `  return d;`,
          `};`
        ),
      },
      // Aliased namespace `* as S from "effect/Schema"` -> S.decodeSync binding.
      {
        count: 1,
        source: lines(
          `import * as S from "effect/Schema";`,
          `const Model = S.Struct({});`,
          `export const h = () => S.decodeSync(Model)({});`
        ),
      },
    ],
    valid: [
      // Module-scope compiler call is allowed (the whole point of the rule).
      {
        count: 0,
        source: lines(
          `import { Schema } from "effect";`,
          `const Model = Schema.Struct({});`,
          `export const decode = Schema.decodeSync(Model);`
        ),
      },
      // `Schema` from an unrelated local module is not the effect Schema -> not flagged.
      {
        count: 0,
        source: lines(
          `import { Schema } from "./local-schema";`,
          `export const j = () => Schema.decodeSync(Whatever)({});`
        ),
      },
    ],
  },

  "no-manual-effect-runtime-in-tests": {
    invalid: [
      // Direct Effect.runPromise in a *.test.ts file.
      {
        count: 1,
        filename: "fixture.test.ts",
        source: lines(`import { Effect } from "effect";`, `export const a = Effect.runPromise(program);`),
      },
      // Aliased `{ Effect as E }` -> E.runSync.
      {
        count: 1,
        filename: "alias.test.ts",
        source: lines(`import { Effect as E } from "effect";`, `export const b = E.runSync(program);`),
      },
      // Effect-root namespace `* as Eff from "effect"` -> Eff.Effect.runFork.
      {
        count: 1,
        filename: "namespace.test.ts",
        source: lines(`import * as Eff from "effect";`, `export const c = Eff.Effect.runFork(program);`),
      },
      // ManagedRuntime.make from effect/ManagedRuntime.
      {
        count: 1,
        filename: "managed.test.ts",
        source: lines(
          `import * as ManagedRuntime from "effect/ManagedRuntime";`,
          `export const d = ManagedRuntime.make(layer);`
        ),
      },
    ],
    valid: [
      // The SAME manual runner outside a *.test.ts file is not gated by this rule.
      {
        count: 0,
        filename: "not-a-test.ts",
        source: lines(`import { Effect } from "effect";`, `export const a = Effect.runPromise(program);`),
      },
      // `it.effect(...)` usage in a test file is the sanctioned pattern -> silent.
      {
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
      // Bare global process.platform.
      { count: 1, source: `export const p = process.platform;` },
      // globalThis.process.arch.
      { count: 1, source: `export const a = globalThis.process.arch;` },
      // os.platform() via a node:os namespace import.
      {
        count: 1,
        source: lines(`import * as os from "node:os";`, `export const m = () => os.platform();`),
      },
    ],
    valid: [
      // A `process` parameter shadows the global -> not flagged.
      {
        count: 0,
        source: `export const f = (process: { platform: string }) => process.platform;`,
      },
      // A local `const process` shadows the global -> not flagged.
      {
        count: 0,
        source: lines(`export function g() {`, `  const process = { arch: "x64" };`, `  return process.arch;`, `}`),
      },
      // The host-process reference file is exempt regardless of cwd (suffix-matched path).
      {
        count: 0,
        filename: HOST_PROCESS_FILE,
        source: `export const supports = process.platform;`,
      },
    ],
  },

  "namespace-node-imports": {
    invalid: [
      // Wrong namespace alias for a node: builtin.
      { count: 1, source: `import * as foo from "node:fs";\nexport const x = foo;` },
    ],
    valid: [
      // Canonical alias for the node: builtin.
      { count: 0, source: `import * as NodeFS from "node:fs";\nexport const x = NodeFS;` },
    ],
  },
};
