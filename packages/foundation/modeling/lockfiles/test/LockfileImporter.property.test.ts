import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ImporterDependency } from "@beep/lockfiles/ImporterDependency";
import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
import { DependencySpecifier } from "@beep/npm-spec/DependencySpecifier";
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
  "LockfileImporter: values with specifiers reclassified from their raw text round-trip and preserve the model",
  [Arbitrary.schema(LockfileImporter).pipe(Arbitrary.map(canonicalImporter))],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileImporter)(value);
      const decoded = yield* S.decodeEffect(LockfileImporter)(encoded);
      assertTrue(
        S.toEquivalence(LockfileImporter)(decoded, value),
        "schema derivation pairs a specifier tag with an unrelated raw, so the raw is reclassified first"
      );
      const value1 = yield* S.encodeEffect(LockfileImporter)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
