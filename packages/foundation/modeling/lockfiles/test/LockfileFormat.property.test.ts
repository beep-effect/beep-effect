import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { filenameFor, filenamesFor, fromFilename, LockfileFormat } from "@beep/lockfiles/LockfileFormat";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "LockfileFormat: encoded values decode without failure and preserve the model",
  [Arbitrary.schema(LockfileFormat)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(LockfileFormat)(value);
      const decoded = yield* S.decodeEffect(LockfileFormat)(encoded);
      assertTrue(S.toEquivalence(LockfileFormat)(decoded, value));
      const value1 = yield* S.encodeEffect(LockfileFormat)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  runs
);

it.effect.prop(
  "primary filenames round-trip and alternate filenames remain detection-only",
  [Arbitrary.schema(LockfileFormat)],
  ([format]) =>
    Effect.sync(() => {
      assert.strictEqual(filenameFor(format), filenamesFor(format)[0]);
      assertSome(fromFilename(filenameFor(format)), format);
      for (const filename of filenamesFor(format).slice(1)) assertNone(fromFilename(filename));
    }),
  runs
);
