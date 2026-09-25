import { EthereumValidatorPublicKey } from "@beep/schema/EthereumValidatorPublicKey";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownEthereumValidatorPublicKeyEffect = S.decodeUnknownEffect(EthereumValidatorPublicKey);

const validPublicKey =
  "0x94c4002c93ce4911ae929129e444413f0b05ee5b97e5a99a95b609a0e61318332cfd601fc48e3853bf5a1cdd2be5f572";

describe("EthereumValidatorPublicKey", () => {
  it.effect(
    "accepts canonical lowercase validator public keys",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownEthereumValidatorPublicKeyEffect(validPublicKey)).toBe(validPublicKey);
    })
  );

  it.effect(
    "rejects malformed validator public keys",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(
        decodeUnknownEthereumValidatorPublicKeyEffect(Str.toUpperCase(validPublicKey))
      );
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
        );
      }
      const failure2 = yield* Effect.exit(decodeUnknownEthereumValidatorPublicKeyEffect(`0x${Str.repeat("ab", 47)}`));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
        );
      }
      const failure3 = yield* Effect.exit(decodeUnknownEthereumValidatorPublicKeyEffect(`0x${Str.repeat("ag", 48)}`));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EthereumValidatorPublicKey must be a lowercase 0x-prefixed 48-byte public key"
        );
      }
    })
  );
});
