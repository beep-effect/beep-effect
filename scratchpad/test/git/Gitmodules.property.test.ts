import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Gitmodules, GitmodulesEntry, GitmodulesDecodeError } from "../../effected/git/Gitmodules.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("Gitmodules property floor", () => {
  roundTrips("GitmodulesEntry", GitmodulesEntry);
  roundTrips("GitmodulesDecodeError", GitmodulesDecodeError);
  roundTrips("Gitmodules", Gitmodules);
  roundTrips("Gitmodules.FromString", Gitmodules.FromString);

  it.effect.prop("canonical formatting is idempotent and parse/stringify preserves typed fields", [Arbitrary.schema(Gitmodules)], ([modules]) => Effect.gen(function* () {
    const text = modules.stringify();
    const parsed = yield* Gitmodules.parse(text);
    assertTrue(S.toEquivalence(Gitmodules)(parsed, modules));
    const formatted = parsed.stringify();
    const reparsed = yield* Gitmodules.parse(formatted);
    assertTrue(S.toEquivalence(Gitmodules)(reparsed, parsed));
    assert.strictEqual(reparsed.stringify(), formatted);
    assert.strictEqual(formatted, text);
    assert.deepStrictEqual(Gitmodules.parseResult(text), Gitmodules.parseResult(formatted));
  }), runs);
});
