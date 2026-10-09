import { assert, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";

const fs = process.getBuiltinModule("node:fs/promises");
const path = process.getBuiltinModule("node:path");
const os = process.getBuiltinModule("node:os");
vi.spyOn(os, "homedir").mockReturnValue("/tmp/workspaces-v6-no-home");
const subject = await import("../../../effected/workspaces/internal/configDependencyResolution.ts");
const root = () => Effect.acquireRelease(Effect.promise(() => fs.mkdtemp("/tmp/workspaces-v6-resolution-")), (dir) => Effect.promise(() => fs.rm(dir, { recursive: true, force: true })));

it.effect("an empty supplied map diagnoses that no keys are known", () => Effect.gen(function* () {
  const failure = yield* Effect.flip(subject.lookupPnpmfiles({ config: "1.0.0" })({}));
  assert.include(failure.message, "hooks");
  assert.instanceOf(failure.cause, Error);
  assert.include(failure.cause instanceof Error ? failure.cause.message : "", "known: none");
}));
it.effect("malformed and unusable modules YAML contributes no store", () => Effect.gen(function* () {
  const dir = yield* root();
  yield* Effect.promise(() => fs.mkdir(path.join(dir, "node_modules"), { recursive: true }));
  for (const text of ["storeDir: [", "null", "storeDir: 42", 'storeDir: ""']) {
    yield* Effect.promise(() => fs.writeFile(path.join(dir, "node_modules", ".modules.yaml"), text));
    const failure = yield* Effect.flip(subject.resolvePnpmfiles({ config: "1.0.0" }, { fetch: () => Effect.fail({ reason: "integrityMismatch", message: "pins disagree" }) })(dir));
    assert.strictEqual(failure.reason, "integrityMismatch");
    assert.include(failure.cause instanceof Error ? failure.cause.message : "", "pins disagree");
    assert.notInclude(failure.cause instanceof Error ? failure.cause.message : "", "pnpm add --config");
  }
}));
it.effect("a dangling config symlink is absence during best-effort store discovery", () => Effect.gen(function* () {
  const dir = yield* root();
  const base = path.join(dir, "node_modules", ".pnpm-config");
  yield* Effect.promise(() => fs.mkdir(base, { recursive: true }));
  yield* Effect.promise(() => fs.symlink(path.join(dir, "missing"), path.join(base, "stale")));
  const failure = yield* Effect.flip(subject.resolvePnpmfiles(dir, { config: "1.0.0" }));
  assert.strictEqual(failure.reason, "notInstalled");
}));
it.effect("a fetched directory resolves its optional pnpmfile", () => Effect.gen(function* () {
  const dir = yield* root();
  const result = yield* subject.resolvePnpmfiles(dir, { config: "1.0.0" }, { fetch: () => Effect.succeed(dir) });
  assert.deepStrictEqual(result, [{ name: "config", version: "1.0.0", source: "fetched", path: undefined }]);
}));
it.effect("environment store roots are expanded and empty values are ignored on both platforms", () => Effect.gen(function* () {
  const dir = yield* root();
  const originalPlatform = process.platform;
  yield* Effect.acquireRelease(Effect.sync(() => {
    vi.stubEnv("PNPM_HOME", undefined);
    vi.stubEnv("XDG_DATA_HOME", undefined);
    vi.stubEnv("LOCALAPPDATA", undefined);
  }), () => Effect.sync(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(process, "platform", { value: originalPlatform });
  }));
  for (const platform of ["linux", "win32"]) {
    Object.defineProperty(process, "platform", { value: platform });
    for (const value of [undefined, "", dir]) {
      vi.stubEnv("PNPM_HOME", value);
      vi.stubEnv("XDG_DATA_HOME", value);
      vi.stubEnv("LOCALAPPDATA", value);
      yield* Effect.promise(() => fs.mkdir(path.join(dir, "store", "v11"), { recursive: true }));
      yield* Effect.promise(() => fs.mkdir(path.join(dir, "pnpm", "store", "v10"), { recursive: true }));
      const failure = yield* Effect.flip(subject.resolvePnpmfiles(dir, { config: "1.0.0" }));
      assert.strictEqual(failure.reason, "notInstalled");
      const message = failure.cause instanceof Error ? failure.cause.message : "";
      assert.include(message, value === dir ? "searched " : "no pnpm store directory could be located");
    }
  }
}));
