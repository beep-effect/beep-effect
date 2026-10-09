import { assert, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { ScriptedSpawner } from "../../../effected/commands/index.ts";

const fs = process.getBuiltinModule("node:fs/promises");
const sync = process.getBuiltinModule("node:fs");
const path = process.getBuiltinModule("node:path");
// Spies retain the real runtime filesystem. The production rung deliberately
// reads the host pnpm store even when its caller provides an Effect memfs.
const read = vi.spyOn(fs, "readFile");
const copy = vi.spyOn(fs, "copyFile");
const remove = vi.spyOn(fs, "rm");
const subject = await import("../../../effected/workspaces/internal/configDependencyFetch.ts");
const sri = `sha512-${"A".repeat(86)}==`;
const root = () => Effect.acquireRelease(Effect.promise(() => fs.mkdtemp("/tmp/workspaces-v6-fetch-")), (dir) => Effect.promise(() => fs.rm(dir, { recursive: true, force: true })));
const request = (root: string) => ({ root, name: "config", version: "1.0.0", spec: `1.0.0+${sri}`, stores: [], side: {}, locks: Effect.as(Effect.void, undefined) });

it.effect("invalid inline integrity fails before consulting locks", () => Effect.gen(function* () {
  const failure = yield* Effect.flip(subject.expectedIntegrity({ ...request("/unused"), spec: "1.0.0+not-sri" }));
  assert.strictEqual(failure.reason, "integrityUnavailable");
  assert.include(failure.message, "not an SRI hash");
  assert.deepStrictEqual(subject.registrySettingsOf({ registry: 2, registries: { ok: "url", bad: 2 } }), { registries: { ok: "url" } });
  assert.deepStrictEqual(subject.fetchArgs([])("/scratch"), ["install", "--frozen-lockfile", "--dir", "/scratch"]);
}));

const spawner = ScriptedSpawner.make((_command, args) => {
  const scratch = args[args.indexOf("--dir") + 1] ?? "";
  const target = path.join(scratch, "store", "links", "config", "1.0.0", "hash", "node_modules", "config");
  sync.mkdirSync(target, { recursive: true });
  sync.writeFileSync(path.join(target, "package.json"), JSON.stringify({ version: "1.0.0" }));
  const linked = path.join(scratch, "node_modules", ".pnpm-config", "config");
  sync.mkdirSync(path.dirname(linked), { recursive: true });
  sync.symlinkSync(target, linked);
  return {};
});
it.layer(spawner.layer, { timeout: "30 seconds" })((it) => {
  it.effect("fetches the exact store version using the workspace registry settings", () => Effect.gen(function* () {
    const dir = yield* root();
    yield* Effect.promise(() => fs.writeFile(path.join(dir, "pnpm-workspace.yaml"), 'registry: "https://example.test"\nregistries:\n  "@a": "https://scope.test"\n'));
    const resolved = yield* subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(dir));
    assert.include(resolved, "/links/config/1.0.0/");
    assert.isFalse(sync.existsSync(resolved));
  }));
  it.effect("workspace read failures retain the cause and do not spawn", () => Effect.gen(function* () {
    const dir = yield* root();
    const cause = new Error("workspace read IO failure");
    read.mockRejectedValueOnce(cause);
    const count = spawner.spawns.length;
    const failure = yield* Effect.flip(subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(dir)));
    assert.strictEqual(failure.cause, cause);
    assert.include(failure.message, "reading the workspace pnpm-workspace.yaml failed");
    assert.strictEqual(spawner.spawns.length, count);
  }));
  it.effect("malformed workspace YAML refuses to select a registry", () => Effect.gen(function* () {
    const dir = yield* root();
    yield* Effect.promise(() => fs.writeFile(path.join(dir, "pnpm-workspace.yaml"), "registry: ["));
    const failure = yield* Effect.flip(subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(dir)));
    assert.include(failure.message, "reading the workspace pnpm-workspace.yaml failed");
    assert.instanceOf(failure.cause, Error);
  }));
  it.effect("a non-absence npmrc copy failure fails closed", () => Effect.gen(function* () {
    const dir = yield* root();
    const cause = new Error("copy IO failure");
    copy.mockRejectedValueOnce(cause);
    const failure = yield* Effect.flip(subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(dir)));
    assert.strictEqual(failure.cause, cause);
    assert.include(failure.message, "writing the scratch workspace failed");
  }));
  it.effect("cleanup failure does not mask a verified result", () => Effect.gen(function* () {
    const dir = yield* root();
    remove.mockRejectedValueOnce(new Error("cleanup failure"));
    const resolved = yield* subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(dir));
    assert.include(resolved, "/links/config/1.0.0/");
    const scratch = spawner.spawns.at(-1)?.args[3] ?? "";
    assert.isTrue(sync.existsSync(scratch));
    yield* Effect.promise(() => fs.rm(scratch, { recursive: true, force: true }));
  }));
});

const badManifest = ScriptedSpawner.make((_command, args) => {
  const scratch = args[3] ?? "";
  const target = path.join(scratch, "store", "links", "config", "1.0.0", "hash", "node_modules", "config");
  sync.mkdirSync(target, { recursive: true });
  sync.writeFileSync(path.join(target, "package.json"), "{");
  const link = path.join(scratch, "node_modules", ".pnpm-config", "config");
  sync.mkdirSync(path.dirname(link), { recursive: true });
  sync.symlinkSync(target, link);
  return {};
});
it.layer(badManifest.layer, { timeout: "30 seconds" })((it) => {
  it.effect("invalid fetched manifest JSON fails with the manifest cause", () => Effect.gen(function* () {
    const failure = yield* Effect.flip(subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(yield* root())));
    assert.include(failure.message, "unreadable package.json");
    assert.instanceOf(failure.cause, Error);
  }));
});
const noVersion = ScriptedSpawner.make((_command, args) => {
  const scratch = args[3] ?? "";
  const target = path.join(scratch, "unversioned");
  sync.mkdirSync(target);
  sync.writeFileSync(path.join(target, "package.json"), "{}");
  const link = path.join(scratch, "node_modules", ".pnpm-config", "config");
  sync.mkdirSync(path.dirname(link), { recursive: true });
  sync.symlinkSync(target, link);
  return {};
});
it.layer(noVersion.layer, { timeout: "30 seconds" })((it) => {
  it.effect("a fetched unversioned copy is refused", () => Effect.gen(function* () {
    const failure = yield* Effect.flip(subject.makeFetchConfigDependency(yield* ChildProcessSpawner.ChildProcessSpawner)(request(yield* root())));
    assert.include(failure.message, "no version");
  }));
});
