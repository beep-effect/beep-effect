import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { catalogNameOf, normalize, rangeOf } from "@beep/repo-workspaces/internal/catalogs";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "normalizing catalogs is idempotent and JSON round trips preserve normalized entries",
  [Arbitrary.schema(S.Json)],
  ([raw]) =>
    Effect.gen(function* () {
      const clean = normalize(raw);
      assert.deepStrictEqual(normalize(clean), clean);
      const codec = S.fromJsonString(S.Unknown);
      const argument = S.decodeEffect(codec);
      const value1 = yield* S.encodeEffect(codec)(clean);
      const value = yield* argument(value1);
      assert.deepStrictEqual(normalize(value), clean);
    }),
  runs
);
it.effect.prop(
  "catalog protocol parsing preserves names and resolves their exact declared ranges",
  [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
  ([name, version]) =>
    Effect.sync(() => {
      const spec = `catalog:${name}`;
      const parsed = Str.trim(name) === "" ? "default" : Str.trim(name);
      assertSome(catalogNameOf(spec), parsed);
      assertSome(catalogNameOf(`catalog:${parsed}`), parsed);
      const catalogs = { [parsed]: { pkg: version } };
      const result = rangeOf(catalogs, "pkg", spec);
      if (Str.startsWith("catalog:")(version) || Str.startsWith("file:")(version) || Str.startsWith("link:")(version))
        assert.isObject(result);
      else assert.strictEqual(result, version);
    }),
  runs
);
