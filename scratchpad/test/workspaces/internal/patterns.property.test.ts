import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { Yaml } from "../../../effected/yaml/index.ts";
import { manifestPatternsOf, PatternReadFailureKind, pnpmPatternsOf, readPatterns, stringsOf } from "../../../effected/workspaces/internal/patterns.ts";

const runs = { arbitrary: fcRuns(100) };
const json = S.fromJsonString(S.Json);
const jsonEntries = S.Array(S.Json).pipe(Arbitrary.schema);
// Physical YAML files are UTF-8; lone UTF-16 surrogates cannot survive that boundary.
const stringEntries = S.Array(S.String).pipe(Arbitrary.schema, Arbitrary.filter((entries) => A.every(entries, (entry) => entry.isWellFormed())));

it.effect.prop("PatternReadFailureKind decode(encode(x)) equals x and decoding never fails", [Arbitrary.schema(PatternReadFailureKind)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(PatternReadFailureKind)(value);
  const decoded = yield* S.decodeEffect(PatternReadFailureKind)(encoded);
  assert.isTrue(S.toEquivalence(PatternReadFailureKind)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(PatternReadFailureKind)(decoded), encoded);
}), runs);

it.effect.prop("pattern extraction is idempotent and faithful through canonical document serialization", [jsonEntries], ([entries]) => Effect.gen(function* () {
  const expected = A.filter(entries, P.isString);
  assert.deepStrictEqual(stringsOf(entries), expected);
  assert.deepStrictEqual(stringsOf(expected), expected);
  const pnpm = pnpmPatternsOf({ packages: entries });
  const manifest = manifestPatternsOf({ workspaces: { packages: entries } });
  assert.deepStrictEqual(pnpm, expected);
  assert.deepStrictEqual(manifest, expected);
  assert.deepStrictEqual(pnpmPatternsOf(yield* S.decodeEffect(json)(yield* S.encodeEffect(json)({ packages: pnpm }))), pnpm);
  assert.deepStrictEqual(manifestPatternsOf(yield* S.decodeEffect(json)(yield* S.encodeEffect(json)({ workspaces: manifest }))), manifest);
  assert.deepStrictEqual(pnpmPatternsOf({ packages: pnpm }), pnpm);
  assert.deepStrictEqual(manifestPatternsOf({ workspaces: manifest }), manifest);
}), runs);

it.layer(Path.layer, { timeout: "30 seconds" })("readPatterns fidelity", (it) => {
it.effect.prop("readPatterns preserves YAML patterns, gives them precedence, and falls back to JSON for an empty list", [stringEntries, stringEntries], ([patterns, fallback]) => Effect.gen(function* () {
  const yaml = yield* Yaml.stringify({ packages: patterns });
  const manifest = yield* S.encodeEffect(json)({ workspaces: { packages: fallback } });
  const handle = yield* MemoryFileSystem.makeHandle({ "/repo/pnpm-workspace.yaml": yaml, "/repo/package.json": manifest });
  const parsed = yield* readPatterns("/repo").pipe(Effect.provideService(FileSystem.FileSystem, handle.fileSystem));
  assert.deepStrictEqual(parsed, patterns.length > 0 ? patterns : fallback);
  const normalized = yield* Yaml.stringify({ packages: parsed });
  yield* handle.fileSystem.writeFileString("/repo/pnpm-workspace.yaml", normalized);
  assert.deepStrictEqual(yield* readPatterns("/repo").pipe(Effect.provideService(FileSystem.FileSystem, handle.fileSystem)), parsed);
  assert.strictEqual(yield* Yaml.stringify({ packages: pnpmPatternsOf(yield* Yaml.parse(normalized)) }), normalized);
}), runs);
});
