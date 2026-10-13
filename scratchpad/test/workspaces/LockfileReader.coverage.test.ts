import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { Lockfile } from "../../effected/lockfiles/index.ts";
import { LockfileReader } from "../../effected/workspaces/LockfileReader.ts";
import { Workspaces } from "../../effected/workspaces/Workspaces.ts";
import { platform } from "./fixtures.ts";

describe("LockfileReader coverage", () => {
  it.effect("unstubbed operations defect with the operation name; refresh is harmless", () => Effect.gen(function* () {
    const reader = LockfileReader.makeTest();
    for (const [name, operation] of [["read", Effect.asVoid(reader.read)], ["integrity", Effect.asVoid(reader.integrity)], ["resolvedVersion", Effect.asVoid(reader.resolvedVersion("missing"))]] as const) {
      const exit = yield* Effect.exit(operation);
      if (Exit.isFailure(exit)) assertExitFailure(exit, exit.cause);
      else assert.fail("expected a defect");
      if (Exit.isFailure(exit)) assert.include(Cause.pretty(exit.cause), name);
    }
    yield* reader.refresh;
  }));
  it.effect("a read-only double derives version lookups through its layer", () => Effect.gen(function* () {
    const lockfile = yield* Lockfile.parse('{"lockfileVersion":3,"packages":{}}', { format: "npm" });
    const reader = LockfileReader.makeTest({ read: Effect.succeed(lockfile) });
    assert.deepStrictEqual(yield* reader.read, lockfile);
    assertNone(yield* reader.resolvedVersion("missing"));
    yield* reader.refresh;
  }));

  it.layer(Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(platform({
    "/repo/pnpm-workspace.yaml": "packages: []\n",
    "/repo/pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters:\n  missing: {}\n  empty: {}\n  invalid: {}\n  primitive: {}\n  noname: {}\n",
    "/repo/empty/package.json": "",
    "/repo/invalid/package.json": "{",
    "/repo/primitive/package.json": "null",
    "/repo/noname/package.json": '{"name":""}',
  }))), { timeout: "30 seconds" })((it) => {
    it.effect("unreadable and invalid importer manifests retain importer-path names", () => Effect.gen(function* () {
      const reader = yield* LockfileReader;
      const lockfile = yield* reader.read;
      yield* reader.refresh;
      assert.deepStrictEqual(lockfile.packages.map((pkg) => pkg.name), ["missing", "empty", "invalid", "primitive", "noname"]);
    }));
  });
});

import { LockfileReadError } from "../../effected/workspaces/LockfileReader.ts";
it.effect("read errors identify the format and path", () => Effect.sync(() => {
  assert.strictEqual(LockfileReadError.make({ lockfilePath: "/repo/bun.lock", format: "bun", cause: "denied" }).message,
    "Cannot read bun lockfile at /repo/bun.lock");
}));
