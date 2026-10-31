import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { MemoryFileSystem } from "@beep/memfs";
import { WorkspacePatternReadFailureKind, WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { Yaml } from "@beep/yaml";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const json = S.fromJsonString(S.Json);
const jsonEntries = S.Array(S.Json).pipe(Arbitrary.schema);
// Physical YAML files are UTF-8; lone UTF-16 surrogates cannot survive that boundary.
const stringEntries = S.Array(S.String).pipe(
  Arbitrary.schema,
  Arbitrary.filter((entries) => A.every(entries, (entry) => entry.isWellFormed()))
);

it.effect.prop(
  "WorkspacePatternReadFailureKind decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(WorkspacePatternReadFailureKind)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(WorkspacePatternReadFailureKind)(value);
      const decoded = yield* S.decodeEffect(WorkspacePatternReadFailureKind)(encoded);
      assert.isTrue(S.toEquivalence(WorkspacePatternReadFailureKind)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(WorkspacePatternReadFailureKind)(decoded), encoded);
    }),
  runs
);

it.effect.prop(
  "pattern extraction is idempotent and faithful through canonical document serialization",
  [jsonEntries],
  ([entries]) =>
    Effect.gen(function* () {
      const expected = A.filter(entries, P.isString);
      assertSome(WorkspacePatterns.stringsOf(entries), expected);
      assertSome(WorkspacePatterns.stringsOf(expected), expected);
      const pnpm = WorkspacePatterns.fromPnpmWorkspace({ packages: entries });
      const manifest = WorkspacePatterns.fromManifest({ workspaces: { packages: entries } });
      assert.deepStrictEqual(pnpm, expected);
      assert.deepStrictEqual(manifest, expected);
      assert.deepStrictEqual(
        WorkspacePatterns.fromPnpmWorkspace(
          yield* S.decodeEffect(json)(yield* S.encodeEffect(json)({ packages: pnpm }))
        ),
        pnpm
      );
      assert.deepStrictEqual(
        WorkspacePatterns.fromManifest(
          yield* S.decodeEffect(json)(yield* S.encodeEffect(json)({ workspaces: manifest }))
        ),
        manifest
      );
      assert.deepStrictEqual(WorkspacePatterns.fromPnpmWorkspace({ packages: pnpm }), pnpm);
      assert.deepStrictEqual(WorkspacePatterns.fromManifest({ workspaces: manifest }), manifest);
    }),
  runs
);

it.layer(Path.layer, { timeout: "30 seconds" })("readPatterns fidelity", (it) => {
  it.effect.prop(
    "readPatterns preserves YAML patterns, gives them precedence, and falls back to JSON for an empty list",
    [stringEntries, stringEntries],
    ([patterns, fallback]) =>
      Effect.gen(function* () {
        const yaml = yield* Yaml.stringify({ packages: patterns });
        const manifest = yield* S.encodeEffect(json)({ workspaces: { packages: fallback } });
        const handle = yield* MemoryFileSystem.makeHandle({
          "/repo/pnpm-workspace.yaml": yaml,
          "/repo/package.json": manifest,
        });
        const parsed = yield* WorkspacePatterns.read("/repo").pipe(
          Effect.provideService(FileSystem.FileSystem, handle.fileSystem)
        );
        assert.deepStrictEqual(parsed, patterns.length > 0 ? patterns : fallback);
        const normalized = yield* Yaml.stringify({ packages: parsed });
        yield* handle.fileSystem.writeFileString("/repo/pnpm-workspace.yaml", normalized);
        assert.deepStrictEqual(
          yield* WorkspacePatterns.read("/repo").pipe(Effect.provideService(FileSystem.FileSystem, handle.fileSystem)),
          parsed
        );
        assert.strictEqual(
          yield* Yaml.stringify({ packages: WorkspacePatterns.fromPnpmWorkspace(yield* Yaml.parse(normalized)) }),
          normalized
        );
      }),
    runs
  );
});
