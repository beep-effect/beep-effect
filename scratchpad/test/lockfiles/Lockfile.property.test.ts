import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { DependencySpecifier } from "../../effected/npm/DependencySpecifier.ts";
import { ImporterDependency } from "../../effected/lockfiles/ImporterDependency.ts";
import { LockfileImporter } from "../../effected/lockfiles/LockfileImporter.ts";
import { Lockfile, LockfileParseError, LockfileFramingError } from "../../effected/lockfiles/Lockfile.ts";
import { LockfileFormat } from "../../effected/lockfiles/LockfileFormat.ts";
import { BunExtension } from "../../effected/lockfiles/BunExtension.ts";
import { PnpmExtension } from "../../effected/lockfiles/PnpmExtension.ts";
import { Yaml } from "../../effected/yaml/Yaml.ts";
// Native schema derivation generates independent specifier tags and raw strings.
// Classify a valid spelling before sampling the enclosing serialization model;
// all other generated fields, optional keys and collections remain unchanged.
const canonicalDependency = (dependency: ImporterDependency): ImporterDependency =>
  ImporterDependency.make({
    ...dependency,
    specifier: Result.getOrThrowWith(S.decodeResult(DependencySpecifier.FromString)(dependency.specifier.raw).pipe(
      Result.orElse(() => S.decodeResult(DependencySpecifier.FromString)("^1.0.0"))), (error) => error),
  });

const canonicalImporter = (importer: LockfileImporter): LockfileImporter =>
  LockfileImporter.make({ ...importer, dependencies: importer.dependencies.map(canonicalDependency) });


const runs = { arbitrary: fcRuns(100) };

it.effect.prop("Lockfile: encoded values decode without failure and preserve the model", [Arbitrary.schema(Lockfile).pipe(Arbitrary.map((value) => Lockfile.make({ ...value, importers: value.importers.map(canonicalImporter) })))], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(Lockfile)(value);
    const decoded = yield* S.decodeEffect(Lockfile)(encoded);
    assertTrue(S.toEquivalence(Lockfile)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(Lockfile)(decoded), encoded);
  }), runs);

it.effect.prop("LockfileParseError: encoded values decode without failure and preserve the model", [Arbitrary.schema(LockfileParseError)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(LockfileParseError)(value);
    const decoded = yield* S.decodeEffect(LockfileParseError)(encoded);
    assertTrue(S.toEquivalence(LockfileParseError)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(LockfileParseError)(decoded), encoded);
  }), runs);

it.effect.prop("LockfileFramingError: encoded values decode without failure and preserve the model", [Arbitrary.schema(LockfileFramingError)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(LockfileFramingError)(value);
    const decoded = yield* S.decodeEffect(LockfileFramingError)(encoded);
    assertTrue(S.toEquivalence(LockfileFramingError)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(LockfileFramingError)(decoded), encoded);
  }), runs);

const Version = S.Literals(["1.0.0", "2.3.4", "4.0.0-beta.1"]);
const ParserSample = S.Struct({ version: Version, trusted: S.Array(S.Literals(["effect", "typescript"])), override: Version });
const JsonText = S.fromJsonString(S.Unknown);

// There is no lockfile formatter API. Re-render the raw dialect document with
// its JSON/YAML codec, then compare the normalized parse models. This preserves
// the format's own framing instead of pretending the unified model is raw input.
for (const format of LockfileFormat.literals) {
  it.effect.prop(`${format}: document rendering is idempotent and reparsing preserves packages and extensions`,
    [Arbitrary.schema(ParserSample)], ([sample]) => Effect.gen(function* () {
      const documents = {
        npm: { lockfileVersion: 3, packages: { "node_modules/effect": { version: sample.version } } },
        bun: { lockfileVersion: 1, workspaces: {}, packages: { effect: [`effect@${sample.version}`, "", {}] }, trustedDependencies: sample.trusted, overrides: { effect: sample.override } },
        pnpm: { lockfileVersion: "9.0", importers: { ".": {} }, packages: { [`effect@${sample.version}`]: {} }, snapshots: { [`effect@${sample.version}`]: {} }, overrides: { effect: sample.override } },
        yarn: { __metadata: { version: 8 }, [`effect@npm:${sample.version}`]: { version: sample.version, resolution: `effect@npm:${sample.version}` } },
      };
      const document = documents[format];
      const render = format === "npm" || format === "bun" ? S.encodeEffect(JsonText) : Yaml.stringify;
      const read = format === "npm" || format === "bun" ? S.decodeEffect(JsonText) : Yaml.parse;
      const text = yield* render(document);
      const parsed = yield* Lockfile.parse(text, { format });
      const canonical = yield* render(yield* read(text));
      assert.strictEqual(yield* render(yield* read(canonical)), canonical);
      const reparsed = yield* Lockfile.parse(canonical, { format });
      assertTrue(S.toEquivalence(Lockfile)(reparsed, parsed));
      assert.deepStrictEqual(parsed.packagesNamed("effect").map((pkg) => pkg.version), [sample.version]);
      if (format === "bun") {
        assert.deepStrictEqual(parsed.extension, BunExtension.make({ trustedDependencies: sample.trusted, overrides: { effect: sample.override } }));
      }
      if (format === "pnpm") {
        assert.deepStrictEqual(parsed.extension, PnpmExtension.make({ overrides: { effect: sample.override } }));
      }
    }), runs);
}
