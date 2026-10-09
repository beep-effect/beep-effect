import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertTrue, assertSome, assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LockfileFormat, filenameFor, filenamesFor, fromFilename } from "../../effected/lockfiles/LockfileFormat.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("LockfileFormat: encoded values decode without failure and preserve the model", [Arbitrary.schema(LockfileFormat)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(LockfileFormat)(value);
    const decoded = yield* S.decodeEffect(LockfileFormat)(encoded);
    assertTrue(S.toEquivalence(LockfileFormat)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(LockfileFormat)(decoded), encoded);
  }), runs);

it.effect.prop("primary filenames round-trip and alternate filenames remain detection-only", [Arbitrary.schema(LockfileFormat)], ([format]) =>
  Effect.sync(() => {
    assert.strictEqual(filenameFor(format), filenamesFor(format)[0]);
    assertSome(fromFilename(filenameFor(format)), format);
    for (const filename of filenamesFor(format).slice(1)) assertNone(fromFilename(filename));
  }), runs);
