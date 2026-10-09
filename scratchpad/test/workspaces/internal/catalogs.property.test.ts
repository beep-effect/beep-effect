import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { catalogNameOf, normalize, rangeOf } from "../../../effected/workspaces/internal/catalogs.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("normalizing catalogs is idempotent and JSON round trips preserve normalized entries", [Arbitrary.schema(S.Json)], ([raw]) => Effect.gen(function* () {
  const clean = normalize(raw);
  assert.deepStrictEqual(normalize(clean), clean);
  const codec = S.fromJsonString(S.Unknown);
  assert.deepStrictEqual(normalize(yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(clean))), clean);
}), runs);
it.effect.prop("catalog protocol parsing preserves names and resolves their exact declared ranges", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([name, version]) => Effect.sync(() => {
  const spec = `catalog:${name}`;
  const parsed = catalogNameOf(spec);
  assert.strictEqual(parsed, name.trim() === "" ? "default" : name.trim());
  assert.strictEqual(catalogNameOf(`catalog:${parsed}`), parsed);
  const catalogs = { [parsed ?? "default"]: { pkg: version } };
  const result = rangeOf(catalogs, "pkg", spec);
  if (version.startsWith("catalog:") || version.startsWith("file:") || version.startsWith("link:")) assert.isObject(result);
  else assert.strictEqual(result, version);
}), runs);
