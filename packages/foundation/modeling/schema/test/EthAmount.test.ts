import { EthAmount } from "@beep/schema/EthAmount";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { BigDecimal, Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownEthAmountEffect = S.decodeUnknownEffect(EthAmount);
const encodeEthAmountEffect = S.encodeEffect(EthAmount);

describe("EthAmount", () => {
  it.effect(
    "decodes non-negative ETH JSON numbers into BigDecimal",
    Effect.fnUntraced(function* () {
      const amount = yield* decodeUnknownEthAmountEffect(7.220045);

      expect(BigDecimal.format(amount)).toBe("7.220045");
    })
  );

  it.effect(
    "encodes decoded ETH amounts back to JSON numbers",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeEthAmountEffect(yield* decodeUnknownEthAmountEffect(24));

      expect(encoded).toBe(24);
    })
  );

  it.effect(
    "rejects negative ETH amounts",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(decodeUnknownEthAmountEffect(-0.000001));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "EthAmount must be greater than or equal to 0"
        );
      }
    })
  );
});
