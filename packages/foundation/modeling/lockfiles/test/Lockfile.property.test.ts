import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { BunExtension } from "@beep/lockfiles/BunExtension";
import { ImporterDependency } from "@beep/lockfiles/ImporterDependency";
import { Lockfile, LockfileFramingError, LockfileParseError } from "@beep/lockfiles/Lockfile";
import { LockfileFormat } from "@beep/lockfiles/LockfileFormat";
import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
import { PnpmExtension } from "@beep/lockfiles/PnpmExtension";
import { DependencySpecifier } from "@beep/npm-spec/DependencySpecifier";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const withSpecifierReclassified = (dependency: ImporterDependency): ImporterDependency =>
  ImporterDependency.make({
    ...dependency,
    specifier: Result.getOrThrowWith(
      S.decodeResult(DependencySpecifier.FromString)(dependency.specifier.raw).pipe(
        Result.orElse(() => S.decodeResult(DependencySpecifier.FromString)("^1.0.0"))
      ),
      (error) => error
    ),
  });

const canonicalImporter = (importer: LockfileImporter): LockfileImporter =>
  LockfileImporter.make({ ...importer, dependencies: A.map(importer.dependencies, withSpecifierReclassified) });

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "Lockfile: values with specifiers reclassified from their raw text round-trip and preserve the model",
  [
    Arbitrary.schema(Lockfile).pipe(
      Arbitrary.map((value) => Lockfile.make({ ...value, importers: A.map(value.importers, canonicalImporter) }))
    ),
  ],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Lockfile)(value);
      const decoded = yield* S.decodeEffect(Lockfile)(encoded);
      assertTrue(
        S.toEquivalence(Lockfile)(decoded, value),
        "schema derivation pairs a specifier tag with an unrelated raw, so the raw is reclassified first"
      );
      const value1 = yield* S.encodeEffect(Lockfile)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "LockfileParseError: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(LockfileParseError)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileParseError)(value);
      const decoded = yield* S.decodeEffect(LockfileParseError)(encoded);
      assertTrue(S.toEquivalence(LockfileParseError)(decoded, value));
      const value2 = yield* S.encodeEffect(LockfileParseError)(decoded);
      assert.deepStrictEqual(value2, encoded);
    }),
  runs
);

it.effect.prop(
  "LockfileFramingError: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(LockfileFramingError)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileFramingError)(value);
      const decoded = yield* S.decodeEffect(LockfileFramingError)(encoded);
      assertTrue(S.toEquivalence(LockfileFramingError)(decoded, value));
      const value3 = yield* S.encodeEffect(LockfileFramingError)(decoded);
      assert.deepStrictEqual(value3, encoded);
    }),
  runs
);

const Version = S.Literals(["1.0.0", "2.3.4", "4.0.0-beta.1"]);
const ParserSample = S.Struct({
  version: Version,
  trusted: S.Array(S.Literals(["effect", "typescript"])),
  override: Version,
});
const JsonText = S.fromJsonString(S.Unknown);

for (const format of LockfileFormat.literals) {
  it.effect.prop(
    `${format}: document rendering is idempotent and reparsing preserves packages and extensions`,
    [Arbitrary.schema(ParserSample)],
    ([sample]) =>
      Effect.gen(function* () {
        const documents = {
          npm: { lockfileVersion: 3, packages: { "node_modules/effect": { version: sample.version } } },
          bun: {
            lockfileVersion: 1,
            workspaces: {},
            packages: { effect: [`effect@${sample.version}`, "", {}] },
            trustedDependencies: sample.trusted,
            overrides: { effect: sample.override },
          },
          pnpm: {
            lockfileVersion: "9.0",
            importers: { ".": {} },
            packages: { [`effect@${sample.version}`]: {} },
            snapshots: { [`effect@${sample.version}`]: {} },
            overrides: { effect: sample.override },
          },
          yarn: {
            __metadata: { version: 8 },
            [`effect@npm:${sample.version}`]: { version: sample.version, resolution: `effect@npm:${sample.version}` },
          },
        };
        const document = documents[format];
        const renderDialect = format === "npm" || format === "bun" ? S.encodeEffect(JsonText) : Yaml.stringify;
        const readDialect = format === "npm" || format === "bun" ? S.decodeEffect(JsonText) : Yaml.parse;
        const text = yield* renderDialect(document);
        const parsed = yield* Lockfile.parse(text, { format });
        const read4 = yield* readDialect(text);
        const canonical = yield* renderDialect(read4);
        const read6 = yield* readDialect(canonical);
        const render5 = yield* renderDialect(read6);
        assert.strictEqual(
          render5,
          canonical,
          "no lockfile formatter exists, so the dialect codec re-renders the raw document"
        );
        const reparsed = yield* Lockfile.parse(canonical, { format });
        assertTrue(
          S.toEquivalence(Lockfile)(reparsed, parsed),
          "the re-rendered dialect document keeps its own framing and reparses to the same model"
        );
        assert.deepStrictEqual(
          A.map(parsed.packagesNamed("effect"), (pkg) => pkg.version),
          [sample.version]
        );
        if (format === "bun") {
          assert.deepStrictEqual(
            parsed.extension,
            BunExtension.make({ trustedDependencies: sample.trusted, overrides: { effect: sample.override } })
          );
        }
        if (format === "pnpm") {
          assert.deepStrictEqual(parsed.extension, PnpmExtension.make({ overrides: { effect: sample.override } }));
        }
      }),
    runs
  );
}
