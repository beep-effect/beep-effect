/**
 * Committed fixture set for the LINT-04 S4 parity gate (goals/heavy-pool-diet).
 *
 * Each entry is one in-memory test file. The set leans on the three detector paths #3019 moved
 * onto the per-file identifier index: platform namespace members, binding references and the
 * reassignment check behind opaque platform references; the remaining rows keep the other
 * detectors in the digest.
 */
import * as A from "effect/Array";

const header = A.join(
  [
    'import { Console, Context, Effect as Fx, Exit as X, FileSystem, Layer as L, Option as O, Result as R, Schedule as S } from "effect";',
    'import * as TC from "effect/testing/TestClock";',
    'import * as fc from "effect/testing/FastCheck";',
    'import { beforeEach, expect, it, test, vi } from "@effect/vitest";',
  ],
  "\n"
);

const bunServices = 'import * as Services from "@effect/platform-bun/BunServices";';

// Opaque platform references inside a canonical harness: aliases, runtime globals and reassigned
// mutable bindings (positives), and their pure, shadowed or never-reassigned twins (negatives).
const opaqueReferences: ReadonlyArray<readonly [prelude: string, expression: string]> = [
  ['import { fixtureEffect } from "./fixture.ts"; const fixture = fixtureEffect;', "fixture"],
  ["const api = Bun;", 'Fx.sync(() => api.file("fixture"))'],
  ["const first = process; const second = first;", "Fx.sync(() => second.cwd())"],
  ["let counter = 2; counter--;", "Fx.succeed(counter)"],
  ["let counter = 2; --counter;", "Fx.succeed(counter)"],
  ['let helper = () => 1; helper = () => Bun.file("fixture");', "Fx.sync(helper)"],
  ['var helper = () => 1; helper = () => Bun.file("fixture");', "Fx.sync(helper)"],
  ["let api = {}; api = Bun;", 'Fx.sync(() => api.file("fixture"))'],
  ["let { left, right } = pair; [left, right] = [right, Bun];", "Fx.sync(() => left)"],
  ["let item = 0; for (item of items) consume(item);", "Fx.succeed(item)"],
  ["", 'Fx.sync(() => globalThis.Bun.file("fixture"))'],
  ['const Bun = { file: () => "pure" }; const api = Bun;', "Fx.sync(() => api.file())"],
  ['let unused = () => 1; unused = () => Bun.file("fixture");', "Fx.succeed(1)"],
  ["let helper = () => 1;", "Fx.sync(helper)"],
  ["let counter = 1; const copied = counter + 1;", "Fx.succeed(copied)"],
  ["const first = second; const second = first;", "second"],
];

// Platform namespace and required members (EV010 provenance) plus binding flows into harnesses.
const platformBodies: ReadonlyArray<string> = [
  'import { NodeFileSystem as FS, NodePath } from "@effect/platform-node"; use(FS.layer);',
  'import * as Platform from "@effect/platform-bun"; use(Platform.BunFileSystem.layer);',
  'const { NodeFileSystem: FS, NodePath } = require("@effect/platform-node"); use(FS.layer);',
  'const Platform = require("@effect/platform-bun"); use(Platform.BunFileSystem.layer);',
  'import * as Platform from "@effect/platform-node"; use(Platform["NodeFileSystem"].layer);',
  'import * as Platform from "@effect/platform-node"; it("x", (Platform) => use(Platform.NodeFileSystem.layer));',
  'import { NodeServices } from "@effect/platform-node"; use(NodeServices.layer);',
  'import * as NodeServices from "@effect/platform-node/NodeServices"; const platform = NodeServices.layer; it.layer(platform)("x", it => {});',
  'import * as Platform from "@effect/platform-node"; it.layer(Platform.NodeServices.layer)("x", it => {});',
  'import * as NodeServices from "@effect/platform-node/NodeServices"; it.layer(L.mergeAll(NodeServices.layer, ImportedLive))("x", it => {});',
];

// One representative per remaining detector family.
const otherBodies: ReadonlyArray<string> = [
  'it("x", () => Fx.runSync(program));',
  'it.effect("x", () => Fx.provide(program, L.scoped(Service, acquire)));',
  'const stub = L.succeed(Service, value); it.effect("x", () => Fx.provide(program, stub));',
  'const withRepo = (effect) => Fx.acquireRelease(acquire, release).pipe(Fx.flatMap(() => effect)); it.effect("x", withRepo(program));',
  'it.effect("x", () => Fx.scoped(program));',
  'it("x", () => expect(Fx.result(program)).toBeDefined());',
  'it("x", () => expect(value).toEqual(O.some(1)));',
  'it.effect("x", () => Fx.sleep("1 second"));',
  'import { readFile } from "node:fs/promises"; it("x", () => readFile("fixture"));',
  'it.effect("x", () => Fx.gen(function*(){ let attempts = 0; while (attempts < 3) { attempts += 1; yield* Fx.sleep("1 second"); } }));',
  'it.layer(L.scoped(Service, acquire))("db", (it) => { it.effect("x", () => Fx.void); });',
  'it.effect("method", () => Fx.gen(function* () { const outcome = yield* Fx.result(program); outcome.pipe(R.isFailure, assertTrue); }));',
  'const ctx = Context.make(Service, {}); it.effect("context", () => Fx.provide(program, ctx));',
];

/**
 * The fixture files, as `[repository-relative path, source text]` pairs in a fixed order.
 */
export const effectVitestParityFixtures: ReadonlyArray<readonly [file: string, text: string]> = A.map(
  [
    ...A.map(
      opaqueReferences,
      ([prelude, expression]) =>
        `${bunServices} ${prelude} it.layer(Services.layer)((it) => { it.effect("opaque", () => ${expression}); });`
    ),
    ...platformBodies,
    ...otherBodies,
  ],
  (body, index) => [`packages/example/test/parity-${index}.test.ts`, `${header}\n${body}\n`] as const
);
