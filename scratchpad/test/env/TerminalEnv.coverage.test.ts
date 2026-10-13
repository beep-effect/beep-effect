import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { StreamEnv } from "../../effected/env/TerminalEnv.ts";

describe("StreamEnv full number domain", () => {
  it.effect("retains NaN and both infinities through its codec", () => Effect.gen(function* () {
    for (const columns of [NaN, Infinity, -Infinity]) {
      const value = { isTerminal: true, color: "none" as const, hyperlinks: false, columns: O.some(columns) };
      const decoded = yield* S.decodeEffect(StreamEnv)(yield* S.encodeEffect(StreamEnv)(value));
      assert.deepStrictEqual(decoded, value);
    }
  }));
});
