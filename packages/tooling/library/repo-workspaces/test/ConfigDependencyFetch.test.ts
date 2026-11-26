import { ScriptedSpawner } from "@beep/commands";
import { MemoryFileSystem } from "@beep/memfs";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { ConfigDependencyHooks } from "@beep/repo-workspaces";
import { storeDirArgument } from "@beep/repo-workspaces/internal/configDependencyFetch";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeProcess } from "./support/fakeProcess.ts";
import type { FakeProcess, ProcessAction } from "./support/fakeProcess.ts";

const NAME = "cfg-fetch-guard";
const SRI = `sha512-${Str.repeat(86)("C")}==`;
const SPEC = `1.0.0+${SRI}`;
const ROOT = "/repo";
const STORE = "/store/v11";

const seed = {
  [`${ROOT}/node_modules/.modules.yaml`]: `"storeDir": ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(STORE), identity)}\n`,
  [STORE]: MemoryFileSystem.directory(),
};

const optionOf = (args: ReadonlyArray<string>, flag: string): string => args[args.indexOf(flag) + 1] ?? "";

const linkScratchPnpmConfigAt =
  (target: string, version: string): ProcessAction =>
  (_command, args) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(target, { recursive: true });
      yield* fs.writeFileString(path.join(target, "package.json"), `{"name":"${NAME}","version":"${version}"}`);
      const link = path.join(optionOf(args, "--dir"), "node_modules", ".pnpm-config", NAME);
      yield* fs.makeDirectory(path.dirname(link), { recursive: true });
      yield* fs.symlink(target, link);
    });

const hooksOver = (fake: FakeProcess) =>
  ConfigDependencyHooks.layerSubprocess.pipe(
    Layer.provide(fake.layer),
    Layer.provideMerge(Layer.merge(MemoryFileSystem.layerWith(seed), Path.layer))
  );

const failureWith = Effect.fn("failureWith")(function* (fake: FakeProcess) {
  const hooks = yield* ConfigDependencyHooks;
  const error = yield* Effect.flip(hooks.inject(ROOT, { [NAME]: SPEC }, {}));
  assert.instanceOf(error, CatalogAssemblyError);
  assert.strictEqual(error.path, NAME);
  assert.isTrue(
    A.every(fake.scripted.spawns, (spawn) => spawn.command === "pnpm"),
    "nothing was replayed: the only spawns are pnpm's"
  );
  return error;
});

describe("the fetch rung refuses what it cannot verify, over a scripted pnpm writing into the one memfs volume the ladder reads (#842 end to end: integration/ConfigDependencyFetch.int.test.ts)", () => {
  {
    const rewrite: ProcessAction = Effect.fn("rewrite")(function* (command, args) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.writeFileString(path.join(optionOf(args, "--dir"), "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n");
      const outsideTheStoreSoNoLaterTestFindsIt = `/rewritten/${NAME}`;
      yield* linkScratchPnpmConfigAt(outsideTheStoreSoNoLaterTestFindsIt, "1.0.0")(command, args);
    });
    const fake = fakeProcess({ act: rewrite });
    it.layer(hooksOver(fake), { timeout: "30 seconds" })((it) => {
      it.effect("a pnpm that rewrites the pinned lockfile is not trusted, even on a zero exit", () =>
        Effect.gen(function* () {
          const error = yield* failureWith(fake);
          assert.strictEqual(error.reason, "fetchFailed");
          assert.include(error.message, "rewrote the integrity-pinned scratch lockfile");
          assert.strictEqual(fake.scripted.spawns.length, 1);
        })
      );
    });
  }

  {
    const fake = fakeProcess({ act: linkScratchPnpmConfigAt(`/elsewhere/${NAME}`, "1.0.0") });
    it.layer(hooksOver(fake), { timeout: "30 seconds" })((it) => {
      it.effect("a link that is not a store copy of the declared version is not used", () =>
        Effect.gen(function* () {
          const error = yield* failureWith(fake);
          assert.strictEqual(error.reason, "fetchFailed");
          assert.include(error.message, "not a store copy of that version");
        })
      );
    });
  }

  {
    const fake = fakeProcess({ act: () => Effect.void, reply: (command) => ScriptedSpawner.notFound(command) });
    it.layer(hooksOver(fake), { timeout: "30 seconds" })((it) => {
      it.effect("pnpm missing from PATH fails fetchFailed with the remediation", () =>
        Effect.gen(function* () {
          const error = yield* failureWith(fake);
          assert.strictEqual(error.reason, "fetchFailed");
          assert.include(error.message, `pnpm add --config ${NAME}@1.0.0`);
          assert.instanceOf(error.cause, Error);
          assert.isDefined(error.cause.cause, "the spawn failure stays on the cause chain beneath the diagnosis");
        })
      );
    });
  }

  {
    const fake = fakeProcess({ act: () => Effect.void });
    it.layer(hooksOver(fake), { timeout: "30 seconds" })((it) => {
      it.effect(
        "an unreadable declaring-side lockfile fails every missing dependency integrityUnavailable, before any spawn",
        () =>
          Effect.gen(function* () {
            const second = `${NAME}-second`;
            const hooks = yield* ConfigDependencyHooks;
            const error = yield* Effect.flip(
              hooks.inject(ROOT, { [NAME]: SPEC, [second]: SPEC }, {}, undefined, {
                lockfile: "a: [",
                ref: "broken",
              })
            );
            assert.instanceOf(error, CatalogAssemblyError);
            assert.strictEqual(error.reason, "integrityUnavailable");
            assert.include([NAME, second], error.path);
            assert.include(
              error.message,
              `config dependency ${error.path}@1.0.0 must be fetched`,
              "mapped per dependency: the message names the dependency that failed"
            );
            assert.include(error.message, "the pnpm-lock.yaml of ref broken cannot be read");
            assert.strictEqual(fake.scripted.spawns.length, 0);
          })
      );
    });
  }

  {
    let scratch = "";
    let pinned = "";
    const capture: ProcessAction = Effect.fn("capture")(function* (_command, args) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      scratch = optionOf(args, "--dir");
      pinned = yield* fs.readFileString(path.join(scratch, "pnpm-lock.yaml"));
    });
    const fake = fakeProcess({ act: capture, reply: () => ({ exit: 1, stderr: "ERR_PNPM_TARBALL_INTEGRITY" }) });
    it.layer(hooksOver(fake), { timeout: "30 seconds" })((it) => {
      it.effect("the scratch lockfile pins the declared integrity, and the scratch workspace is removed", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* failureWith(fake);
          assert.include(pinned, `"${NAME}@1.0.0":\n    resolution: {integrity: "${SRI}"}`);
          const exists1 = yield* fs.exists(scratch);
          assert.isFalse(exists1);
        })
      );
    });
  }
});

describe("storeDirArgument", () => {
  it("hands pnpm the parent of a versioned store directory, since pnpm appends it", () => {
    assertSome(storeDirArgument(["/s/store/v11", "/other/v10"]), "/s/store");
  });

  it("passes an unversioned directory through", () => {
    assertSome(storeDirArgument(["/s/custom"]), "/s/custom");
  });

  it("omits the flag when no store was discovered", () => {
    assertNone(storeDirArgument([]));
  });
});
