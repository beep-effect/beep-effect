import { isOnePasswordReference, OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";

const decodeOnePasswordReference = S.decodeUnknownEffect(OnePasswordReference);

const expectDecodeFailure = Effect.fn("OnePasswordReferenceTest.expectDecodeFailure")(function* (input: unknown) {
  const exit = yield* Effect.exit(decodeOnePasswordReference(input));
  assertTrue(Exit.isFailure(exit));
});

describe("OnePasswordReference", () => {
  it.effect(
    "accepts 1Password item field references",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeOnePasswordReference("op://Private/Discord Bot/token");

      assert.strictEqual(decoded, "op://Private/Discord Bot/token");
    })
  );

  it.effect(
    "rejects plaintext-like and incomplete values",
    Effect.fnUntraced(function* () {
      yield* expectDecodeFailure("discord-token-plaintext");
      yield* expectDecodeFailure("op://Private/Discord Bot");
      yield* expectDecodeFailure("op://Private/Discord Bot/");
    })
  );

  it("exposes a schema-derived guard", () => {
    assertTrue(isOnePasswordReference("op://Private/Discord Bot/token"));
    assertFalse(isOnePasswordReference("not-a-reference"));
  });
});
