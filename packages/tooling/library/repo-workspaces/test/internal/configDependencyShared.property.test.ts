import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { MemoryFileSystem } from "@beep/memfs";
import {
  ManifestVersion,
  manifestVersion,
  messageOf,
  sideLabel,
} from "@beep/repo-workspaces/internal/configDependencyShared";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "ManifestVersion decode(encode(x)) equals x and never fails",
  [Arbitrary.schema(ManifestVersion)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ManifestVersion)(value);
      const decoded = yield* S.decodeEffect(ManifestVersion)(encoded);
      assert.isTrue(S.toEquivalence(ManifestVersion)(decoded, value));
      const value1 = yield* S.encodeEffect(ManifestVersion)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
it.effect.prop(
  "message formatting preserves error text and is idempotent",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.sync(() => {
      assert.strictEqual(messageOf(new Error(text)), text);
      assert.strictEqual(messageOf(messageOf(new Error(text))), text);
    }),
  runs
);
it.effect.prop(
  "ref labels preserve the supplied ref verbatim",
  [Arbitrary.schema(S.String)],
  ([ref]) =>
    Effect.sync(() => {
      const label = sideLabel({ ref });
      assert.strictEqual(label, `ref ${ref}`);
      assert.strictEqual(sideLabel({ ref: Str.slice(4)(label) }), label);
    }),
  runs
);

it.layer(Layer.merge(MemoryFileSystem.layer, Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "manifest parsing is faithful to JSON serialization and its normalized manifest state",
    [Arbitrary.schema(S.Json)],
    ([document]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped({ prefix: "workspaces-manifest-prop-" });
        const json = S.fromJsonString(S.Json);
        const text = yield* S.encodeEffect(json)(document);
        yield* fs.writeFileString(path.join(dir, "package.json"), text);
        const first = yield* manifestVersion("config", dir);
        const expected =
          P.isObject(document) && P.isString(document.version) && document.version !== ""
            ? ManifestVersion.cases.version.make({ version: document.version })
            : ManifestVersion.cases.unversioned.make({});
        assert.deepStrictEqual(first, expected);
        const canonical = first._tag === "version" ? { version: first.version } : {};
        const canonicalText = yield* S.encodeEffect(json)(canonical);
        yield* fs.writeFileString(path.join(dir, "package.json"), canonicalText);
        const second = yield* manifestVersion("config", dir);
        assert.deepStrictEqual(second, first);
        const value2 = yield* S.encodeEffect(json)(second._tag === "version" ? { version: second.version } : {});
        assert.strictEqual(value2, canonicalText);
      }),
    runs
  );
});
