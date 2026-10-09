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

it.effect.prop("LockfileImporter: encoded values decode without failure and preserve the model", [Arbitrary.schema(LockfileImporter).pipe(Arbitrary.map(canonicalImporter))], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(LockfileImporter)(value);
    const decoded = yield* S.decodeEffect(LockfileImporter)(encoded);
    assertTrue(S.toEquivalence(LockfileImporter)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(LockfileImporter)(decoded), encoded);
  }), runs);
