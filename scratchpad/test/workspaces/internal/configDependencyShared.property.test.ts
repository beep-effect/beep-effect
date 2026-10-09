import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import { ManifestVersion, messageOf, sideLabel, manifestVersion } from "../../../effected/workspaces/internal/configDependencyShared.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("ManifestVersion decode(encode(x)) equals x and never fails", [Arbitrary.schema(ManifestVersion)], ([value]) => Effect.gen(function* () {
  const encoded = yield* S.encodeEffect(ManifestVersion)(value);
  const decoded = yield* S.decodeEffect(ManifestVersion)(encoded);
  assert.isTrue(S.toEquivalence(ManifestVersion)(decoded, value));
  assert.deepStrictEqual(yield* S.encodeEffect(ManifestVersion)(decoded), encoded);
}), runs);
it.effect.prop("message formatting preserves error text and is idempotent", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  assert.strictEqual(messageOf(new Error(text)), text);
  assert.strictEqual(messageOf(messageOf(new Error(text))), text);
}), runs);
it.effect.prop("ref labels preserve the supplied ref verbatim", [Arbitrary.schema(S.String)], ([ref]) => Effect.sync(() => {
  const label = sideLabel({ ref });
  assert.strictEqual(label, `ref ${ref}`);
  assert.strictEqual(sideLabel({ ref: label.slice(4) }), label);
}), runs);

const fs = process.getBuiltinModule("node:fs/promises");
const path = process.getBuiltinModule("node:path");
it.effect.prop("manifest parsing is faithful to JSON serialization and its normalized manifest state", [Arbitrary.schema(S.Json)], ([document]) => Effect.gen(function* () {
  const dir = yield* Effect.acquireRelease(Effect.promise(() => fs.mkdtemp("/tmp/workspaces-v6-manifest-prop-")), (dir) => Effect.promise(() => fs.rm(dir, { recursive: true, force: true })));
  const json = S.fromJsonString(S.Json);
  const text = yield* S.encodeEffect(json)(document);
  yield* Effect.promise(() => fs.writeFile(path.join(dir, "package.json"), text));
  const first = yield* manifestVersion("config", dir);
  const expected = P.isObject(document) && P.isString(document.version) && document.version !== "" ? ManifestVersion.cases.version.make({ version: document.version }) : ManifestVersion.cases.unversioned.make({});
  assert.deepStrictEqual(first, expected);
  const canonical = first._tag === "version" ? { version: first.version } : {};
  const canonicalText = yield* S.encodeEffect(json)(canonical);
  yield* Effect.promise(() => fs.writeFile(path.join(dir, "package.json"), canonicalText));
  const second = yield* manifestVersion("config", dir);
  assert.deepStrictEqual(second, first);
  assert.strictEqual(yield* S.encodeEffect(json)(second._tag === "version" ? { version: second.version } : {}), canonicalText);
}), runs);
