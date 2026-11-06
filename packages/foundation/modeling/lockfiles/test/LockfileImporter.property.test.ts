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

// Native schema derivation generates independent specifier tags and raw strings.
// Classify a valid spelling before sampling the enclosing serialization model;
// all other generated fields, optional keys and collections remain unchanged.
const canonicalDependency = (dependency: ImporterDependency): ImporterDependency =>
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
  LockfileImporter.make({ ...importer, dependencies: A.map(importer.dependencies, canonicalDependency) });

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "LockfileImporter: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(LockfileImporter).pipe(Arbitrary.map(canonicalImporter))],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileImporter)(value);
      const decoded = yield* S.decodeEffect(LockfileImporter)(encoded);
      assertTrue(S.toEquivalence(LockfileImporter)(decoded, value));
      const value1 = yield* S.encodeEffect(LockfileImporter)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);
