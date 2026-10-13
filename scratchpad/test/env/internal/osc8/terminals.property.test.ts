import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { IdentifyResult, KnownTerminal, lookupTerminal, Osc8Capabilities } from "../../../../effected/env/internal/osc8/terminals.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.strictEqual(S.toEquivalence(schema)(decoded, value), true);
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("terminal schema property floor", () => {
  roundTrips("KnownTerminal decodes every encoded value without failure and preserves it", KnownTerminal);
  roundTrips("Osc8Capabilities decodes every encoded value without failure and preserves it", Osc8Capabilities);
  roundTrips("IdentifyResult decodes every encoded value without failure and preserves it", IdentifyResult);

  it.effect.prop("terminal identification preserves arbitrary version text and first-match precedence", [Arbitrary.schema(S.String)], ([version]) =>
    Effect.sync(() => {
      const match = lookupTerminal({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: version, VTE_VERSION: "5202", TERM: "xterm-kitty" });
      assert.strictEqual(match?.entry.name, "iTerm.app");
      assert.deepStrictEqual(match?.identify, { version, rawIdentifier: "iTerm.app" });
    }), runs);
});
