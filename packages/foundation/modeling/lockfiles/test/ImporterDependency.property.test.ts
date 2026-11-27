import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ImporterDependency } from "@beep/lockfiles/ImporterDependency";
import { DependencySpecifier } from "@beep/npm-spec/DependencySpecifier";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
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

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "ImporterDependency: values with the specifier reclassified from its raw text round-trip and preserve the model",
  [Arbitrary.schema(ImporterDependency).pipe(Arbitrary.map(withSpecifierReclassified))],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ImporterDependency)(value);
      const decoded = yield* S.decodeEffect(ImporterDependency)(encoded);
      assertTrue(
        S.toEquivalence(ImporterDependency)(decoded, value),
        "schema derivation pairs a specifier tag with an unrelated raw, so the raw is reclassified first"
      );
      const value1 = yield* S.encodeEffect(ImporterDependency)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

const EncodedDependency = S.Struct({
  name: S.NonEmptyString,
  specifier: S.Literals([
    "catalog:",
    "catalog: tools",
    "workspace:*",
    "workspace:^1.2.3",
    "^1.0.0",
    "1.2.3",
    "latest",
    "file:../local",
    "npm:lodash@^4.0.0",
    "https://example.com/pkg.tgz",
    "git+https://example.com/repo.git",
  ]),
  version: S.optionalKey(S.String),
  peerSuffix: S.optionalKey(S.String),
  depType: S.Literals(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]),
});

it.effect.prop(
  "specifier fidelity preserves the exact recorded spelling through model serialization",
  [Arbitrary.schema(EncodedDependency)],
  ([encoded]) =>
    Effect.gen(function* () {
      const dependency = yield* S.decodeEffect(ImporterDependency)(encoded);
      const serialized = yield* S.encodeEffect(ImporterDependency)(dependency);
      assert.deepStrictEqual(serialized, encoded);
      const decoded = yield* S.decodeEffect(ImporterDependency)(serialized);
      assertTrue(S.toEquivalence(ImporterDependency)(decoded, dependency));
      const value2 = yield* S.encodeEffect(ImporterDependency)(decoded);
      assert.deepStrictEqual(value2, serialized);
    }),
  runs
);
