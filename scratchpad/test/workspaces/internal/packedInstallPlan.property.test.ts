import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertDefined, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { binTargetOf, consumerFiles, fileOverridesOf, overridePath, readPackedManifest, scrubEnv, unresolvedSpecifiers, versionOf } from "../../../effected/workspaces/internal/packedInstallPlan.ts";

const ConsumerDocument = S.Struct({ dependencies: S.Record(S.String, S.String) });

const runs = { arbitrary: fcRuns(100) };
const Version = S.Struct({ major: S.Int.check(S.isBetween({ minimum: 0, maximum: 1000 })), minor: S.Int.check(S.isBetween({ minimum: 0, maximum: 1000 })), patch: S.Int.check(S.isBetween({ minimum: 0, maximum: 1000 })) });
const Specifier = S.Literals(["workspace:*", "catalog:", "catalog:peers", "link:../local", "file:./local.tgz", "file:/absolute.tgz", "^1.2.3", "latest"]);
const Manifest = S.Struct({ name: S.String, dependencies: S.Record(S.String, Specifier), optionalDependencies: S.Record(S.String, Specifier), peerDependencies: S.Record(S.String, Specifier), bin: S.Record(S.String, S.String) });
const json = S.fromJsonString(S.Json);
const prettyJson = S.fromJsonString(S.Json, { space: 2 });
const pathsArbitrary = S.Array(S.String).pipe(Arbitrary.schema);

it.effect.prop("version parsing is idempotent and preserves the final concrete version through rendering", [Arbitrary.schema(Version), Arbitrary.schema(Version)], ([first, last]) => Effect.sync(() => {
  const previous = `${first.major}.${first.minor}.${first.patch}`;
  const expected = `${last.major}.${last.minor}.${last.patch}`;
  const parsed = versionOf(`startup\r\nv${previous}\r\nv${expected}\r\nfinished\r\n`);
  assert.strictEqual(parsed, expected);
  assert.strictEqual(versionOf(expected), expected);
  assert.strictEqual(versionOf(`v${parsed}\n`), parsed);
}), runs);

it.effect.prop("packed manifest parsing and bin lookup preserve serialized runtime facts and a canonical parse is idempotent", [Arbitrary.schema(Manifest)], ([manifest]) => Effect.gen(function* () {
  const text = yield* S.encodeEffect(json)(manifest);
  const parsed = Result.getOrThrow(readPackedManifest(text));
  assert.strictEqual(parsed.name, manifest.name);
  assert.deepStrictEqual(parsed.bins, R.keys(manifest.bin));
  const expected = A.flatMap(["dependencies", "optionalDependencies", "peerDependencies"] as const, (field) =>
    A.flatMap(R.toEntries(manifest[field]), ([name, spec]) =>
      ["workspace:*", "catalog:", "catalog:peers", "link:../local", "file:./local.tgz"].includes(spec) ? [`${field}.${name}: ${spec}`] : []));
  assert.deepStrictEqual(parsed.unresolved, expected);
  assertSuccess(unresolvedSpecifiers(text), expected);
  const reparsedText = yield* S.encodeEffect(json)(yield* S.decodeEffect(json)(text));
  assertSuccess(readPackedManifest(reparsedText), parsed);
  assertSuccess(unresolvedSpecifiers(reparsedText), expected);
  for (const [name, target] of R.toEntries(manifest.bin)) {
    assert.strictEqual(binTargetOf(text, name), target);
    assert.strictEqual(binTargetOf(reparsedText, name), target);
  }
  // Rehydrate only the facts the parser returns, discarding resolved specs and bin targets.
  const name = parsed.name;
  assertDefined(name);
  const runtimeMaps = R.fromEntries(A.map(["dependencies", "optionalDependencies", "peerDependencies"] as const, (field) => {
    const entries = A.filter(parsed.unresolved, (entry) => entry.startsWith(`${field}.`));
    const dependencies = R.fromEntries(A.map(entries, (entry) => {
      const separator = entry.lastIndexOf(": ");
      return [entry.slice(field.length + 1, separator), entry.slice(separator + 2)] as const;
    }));
    return [field, dependencies] as const;
  }));
  const canonical = { name, bin: R.fromEntries(A.map(parsed.bins, (bin) => [bin, "bin.js"] as const)), ...runtimeMaps };
  const normalized = yield* S.encodeEffect(json)(canonical);
  assertSuccess(readPackedManifest(normalized), parsed);
  assert.strictEqual(yield* S.encodeEffect(json)(yield* S.decodeEffect(json)(normalized)), normalized);
}), runs);

it.effect.prop("file overrides preserve bare package paths and rewrapping the parsed map is idempotent", [pathsArbitrary], ([paths]) => Effect.gen(function* () {
  const expected = R.fromEntries(A.map(paths, (path, index) => [`@scope/pkg${index}`, path] as const));
  const document = { overrides: R.map(expected, (path) => `file:${path}`) };
  const parsed = fileOverridesOf(document);
  assert.deepStrictEqual(parsed, expected);
  assert.deepStrictEqual(fileOverridesOf({ overrides: R.map(parsed, (path) => `file:${path}`) }), parsed);
  assert.deepStrictEqual(fileOverridesOf(yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(document))), parsed);
}), runs);

it.effect.prop("override normalization preserves paths and is idempotent on absolute tarball paths", [Arbitrary.schema(S.String)], ([suffix]) => Effect.sync(() => {
  const path = `/packs/${suffix}`;
  const normalized = overridePath(`file:${path}`);
  assert.strictEqual(normalized, path);
  assert.strictEqual(overridePath(normalized), normalized);
  assert.strictEqual(overridePath(`file:${normalized}`), normalized);
}), runs);

it.effect.prop("consumer formatting is deterministic and faithful to exact packed specs for every manager", [Arbitrary.schema(S.Literals(["npm", "pnpm", "yarn", "bun"])), Arbitrary.schema(S.String), Arbitrary.schema(Version)], ([manager, tarball, version]) => Effect.gen(function* () {
  const input = { manager, version: `${version.major}.${version.minor}.${version.patch}`, carrier: { name: "carrier", tarball }, overrides: { member: tarball }, dependencies: { member: "^1", carrier: "^9", external: "^2" } };
  const files = consumerFiles(input);
  assert.deepStrictEqual(consumerFiles(input), files);
  for (const file of files) {
    if (file.file === "package.json") {
      const document = yield* S.decodeUnknownEffect(ConsumerDocument)(yield* S.decodeEffect(json)(file.content));
      assert.deepStrictEqual(document.dependencies, { carrier: `file:${tarball}`, member: `file:${tarball}`, external: "^2" });
      assert.strictEqual(`${yield* S.encodeEffect(prettyJson)(yield* S.decodeEffect(json)(file.content))}\n`, file.content);
    }
  }
}), runs);

it.effect.prop("environment scrubbing is idempotent and retains ordinary user context", [Arbitrary.schema(S.String)], ([value]) => Effect.sync(() => {
  const clean = scrubEnv({ HOME: value, GITHUB_ACTIONS: value, CI: value, npm_config_user_agent: value, YARN_NODE_LINKER: value, absent: undefined });
  assert.deepStrictEqual(clean, { HOME: value, GITHUB_ACTIONS: value });
  assert.deepStrictEqual(scrubEnv(clean), clean);
}), runs);
