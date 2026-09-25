import { EvmAddress } from "@beep/schema/EvmAddress";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownEvmAddressEffect = S.decodeUnknownEffect(EvmAddress);

const evmLowercase = "0x52908400098527886e0f7030069857d2e4169ee7";
const evmChecksummed = "0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE";

describe("EvmAddress", () => {
  it.effect(
    "accepts lowercase and checksummed canonical EVM addresses",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownEvmAddressEffect(evmLowercase)).toBe(evmLowercase);
      expect(yield* decodeUnknownEvmAddressEffect(evmChecksummed)).toBe(evmChecksummed);
    })
  );

  it.effect(
    "rejects malformed or non-EVM addresses",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(decodeUnknownEvmAddressEffect(Str.toUpperCase(evmChecksummed)));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EvmAddress must be a canonical mainnet EVM address"
        );
      }
      const failure2 = yield* Effect.exit(decodeUnknownEvmAddressEffect("52908400098527886e0f7030069857d2e4169ee7"));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EvmAddress must be a canonical mainnet EVM address"
        );
      }
      const failure3 = yield* Effect.exit(decodeUnknownEvmAddressEffect("bc1qqypqxpq9qcrsszg2pvxq6rs0zqg3yyc5fcj4z3"));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EvmAddress must be a canonical mainnet EVM address"
        );
      }
    })
  );
});
