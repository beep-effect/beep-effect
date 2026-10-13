import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { AppliedSeed, applyRoot, normalizeAbsolute, SeedRootError } from "../../../effected/memfs/internal/seed.ts";
import { MemoryFileSystem } from "../../../effected/memfs/MemoryFileSystem.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("seed root errors round-trip without changing their structural payload", [Arbitrary.schema(SeedRootError)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(SeedRootError)(value);
    const decoded = yield* S.decodeEffect(SeedRootError)(encoded);
    assert.deepStrictEqual(decoded, value);
  }), runs);

it.effect.prop("applied seeds round-trip with a required root key", [Arbitrary.schema(AppliedSeed)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(AppliedSeed)(value);
    const decoded = yield* S.decodeEffect(AppliedSeed)(encoded);
    assert.deepStrictEqual(decoded, value);
    assert.isTrue(S.is(AppliedSeed)(decoded));
  }), runs);

it.effect("seed root error contracts require both string fields", () => Effect.sync(() => {
  const isError = S.is(SeedRootError);
  assert.isTrue(isError({ description: "", subject: "" }));
  assert.isTrue(isError({ description: "invalid root", subject: "repo" }));
  assert.isFalse(isError({ description: "invalid root" }));
  assert.isFalse(isError({ subject: "repo" }));
  assert.isFalse(isError({ description: 1, subject: "repo" }));
  assert.isFalse(isError({ description: "invalid root", subject: undefined }));
}));

it.effect("applied seed contracts require seed and root while accepting undefined root", () => Effect.sync(() => {
  const isApplied = S.is(AppliedSeed);
  assert.isTrue(isApplied({ seed: {}, root: undefined }));
  assert.isTrue(isApplied({ seed: { "/hello.txt": "hello" }, root: "/repo" }));
  // Schema ownership preserves the string domain; applyRoot owns path validation.
  assert.isTrue(isApplied({ seed: {}, root: "relative" }));
  assert.isTrue(isApplied({ seed: {}, root: "" }));
  assert.isFalse(isApplied({ seed: {} }));
  assert.isFalse(isApplied({ root: undefined }));
  assert.isFalse(isApplied({ seed: { file: 1 }, root: undefined }));
  assert.isFalse(isApplied({ seed: {}, root: null }));
  assert.isFalse(isApplied({ seed: {}, root: 1 }));
}));

it.effect("applyRoot without a root retains seed identity and the explicit root key in both forms", () => Effect.sync(() => {
  const seed = { "/absolute.txt": "absolute", "relative.txt": "relative" };
  for (const applied of [applyRoot(seed, undefined), applyRoot(undefined)(seed)]) {
    assertSuccess(applied, { seed, root: undefined });
    assert.strictEqual(applied.success.seed, seed);
    assert.isTrue(S.is(AppliedSeed)(applied.success));
  }
}));

it.effect("applyRoot normalizes the join base and keys while retaining entry references", () => Effect.sync(() => {
  const bytes = new Uint8Array([1, 2, 3]);
  const directory = MemoryFileSystem.directory({ mode: 0o755 });
  const file = MemoryFileSystem.file("payload", { mode: 0o644, mtime: 1000 });
  const link = MemoryFileSystem.symlink("../file.txt");
  const seed = { "": directory, "../extra/bytes": bytes, "a/../file.txt": file, "link": link };
  const expected = { seed: { "/ws/repo": directory, "/ws/extra/bytes": bytes, "/ws/repo/file.txt": file, "/ws/repo/link": link }, root: "/ws/repo" };
  for (const applied of [applyRoot(seed, "/ws//repo/./"), applyRoot("/ws//repo/./")(seed)]) {
    assertSuccess(applied, expected);
    assert.notStrictEqual(applied.success.seed, seed);
    assert.strictEqual(applied.success.seed["/ws/repo"], directory);
    assert.strictEqual(applied.success.seed["/ws/extra/bytes"], bytes);
    assert.strictEqual(applied.success.seed["/ws/repo/file.txt"], file);
    assert.strictEqual(applied.success.seed["/ws/repo/link"], link);
    assert.isTrue(S.is(AppliedSeed)(applied.success));
  }
}));

it.effect("applyRoot rejects relative roots with the exact failure payload in both forms", () => Effect.sync(() => {
  for (const root of ["", ".", "repo"]) {
    const expected = { description: `root must be absolute, got "${root}"`, subject: root };
    for (const applied of [applyRoot({}, root), applyRoot(root)({})]) {
      assertFailure(applied, expected);
      assert.isTrue(S.is(SeedRootError)(applied.failure));
    }
  }
}));

it.effect("applyRoot rejects absolute keys and reports the original unnormalized root", () => Effect.sync(() => {
  const root = "/ws//repo/./";
  const seed = { "relative.txt": "valid first", "/absolute.txt": "invalid" };
  const expected = { description: 'seed key "/absolute.txt" is absolute but a root "/ws//repo/./" was given', subject: "/absolute.txt" };
  for (const applied of [applyRoot(seed, root), applyRoot(root)(seed)]) {
    assertFailure(applied, expected);
    assert.isTrue(S.is(SeedRootError)(applied.failure));
  }
  assert.deepStrictEqual(seed, { "relative.txt": "valid first", "/absolute.txt": "invalid" });
}));

it.layer(Path.layer, { timeout: "5 seconds" })((it) => {
  it.effect.prop("lexical formatting is idempotent, agrees with POSIX normalization and preserves the resolved file", [Arbitrary.schema(S.Literals(["a", "b", "", ".", ".."]).pipe(S.Array))], ([value]) =>
    Effect.gen(function* () {
      const posix = yield* Path.Path;
      const input = `/root/${A.join(value, "/")}/leaf`;
      const path = normalizeAbsolute(input);
      assert.strictEqual(path, posix.normalize(input));
      assert.strictEqual(normalizeAbsolute(path), path);
      const handle = yield* MemoryFileSystem.makeHandle({ [path]: "payload" });
      assert.strictEqual(handle.volume.text(input), "payload");
      assert.strictEqual(handle.volume.text(normalizeAbsolute(path)), "payload");
    }), runs);
});
