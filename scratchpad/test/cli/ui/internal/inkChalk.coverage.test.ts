import { assert, it, vi } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { inkChalk, resolveInkEntry } from "../../../../effected/cli/ui/internal/inkChalk.ts";
import { MemoryFileSystem } from "../../../../effected/memfs/index.ts";

it.effect("a supplied ESM resolver preserves its entry path", () => Effect.sync(() => {
  const requested: Array<string> = [];
  assert.strictEqual(resolveInkEntry((specifier) => {
    requested.push(specifier);
    return "file:///sandbox/ink/index.js";
  }), "/sandbox/ink/index.js");
  assert.deepStrictEqual(requested, ["ink"]);
}));

it.layer(MemoryFileSystem.layer, { timeout: "10 seconds" })("missing chalk realpath", (it) => {
  it.effect("resolution failure in the provided memory filesystem returns None", () => Effect.gen(function* () {
    assertNone(yield* inkChalk());
  }));
});

it.effect("a provided realPath self-interruption propagates instead of returning None", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle();
  const exit = yield* Effect.exit(inkChalk().pipe(Effect.provideService(FileSystem.FileSystem, {
    ...handle.fileSystem,
    realPath: () => Effect.interrupt,
  })));
  assert.isTrue(Exit.hasInterrupts(exit));
}));

it.effect("a resolved module without a numeric chalk level returns None", () => Effect.gen(function* () {
  const fs = yield* MemoryFileSystem.makeHandle();
  const reactPath = resolveInkEntry(() => import.meta.resolve("react"));
  assertNone(yield* inkChalk().pipe(Effect.provideService(FileSystem.FileSystem, {
    ...fs.fileSystem,
    realPath: () => Effect.succeed(reactPath),
  })));
}));

for (const [name, value] of [
  ["missing default", undefined],
  ["nonnumeric level", { level: "none" }],
] as const) {
  it.effect(`rejects a resolved chalk module with ${name}`, () => Effect.gen(function* () {
    const handle = yield* MemoryFileSystem.makeHandle();
    const entry = resolveInkEntry(() => import.meta.resolve("react"));
    vi.doMock(entry, () => ({ default: value }));
    try {
      assertNone(yield* inkChalk().pipe(Effect.provideService(FileSystem.FileSystem, {
        ...handle.fileSystem,
        realPath: () => Effect.succeed(entry),
      })));
    } finally {
      vi.doUnmock(entry);
    }
  }));
}

it.effect("a runtime without import.meta.resolve uses CommonJS resolution", () => Effect.gen(function* () {
  vi.resetModules();
  const predicate = yield* Effect.promise(() => import("effect/Predicate"));
  let checks = 0;
  vi.doMock("effect/Predicate", () => ({ ...predicate, isFunction: () => { checks++; return false; } }));
  try {
    const fallback = yield* Effect.promise(() => import("../../../../effected/cli/ui/internal/inkChalk.ts"));
    assert.match(fallback.resolveInkEntry(), /[\\/]ink[\\/]build[\\/]index\.js$/);
    assert.strictEqual(checks, 1);
  } finally {
    vi.doUnmock("effect/Predicate");
  }
}));
