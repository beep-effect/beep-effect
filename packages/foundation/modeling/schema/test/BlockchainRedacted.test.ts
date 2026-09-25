import { fcRuns } from "@beep/fc-runs";
import { CryptoTxnHashRedacted } from "@beep/schema/CryptoTxnHash";
import { CryptoWalletAddressRedacted } from "@beep/schema/CryptoWalletAddress";
import {
  EthereumValidatorPublicKey,
  EthereumValidatorPublicKeyRedacted,
} from "@beep/schema/EthereumValidatorPublicKey";
import { EvmAddressRedacted } from "@beep/schema/EvmAddress";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const decodeCryptoTxnHashRedactedEffect = S.decodeEffect(CryptoTxnHashRedacted);
const decodeCryptoWalletAddressRedactedEffect = S.decodeEffect(CryptoWalletAddressRedacted);
const decodeEthereumValidatorPublicKeyRedactedEffect = S.decodeEffect(EthereumValidatorPublicKeyRedacted);
const decodeEvmAddressRedactedEffect = S.decodeEffect(EvmAddressRedacted);
const decodeUnknownEthereumValidatorPublicKeyEffect = S.decodeUnknownEffect(EthereumValidatorPublicKey);

const bitcoinAddress = "16L5yRNPTuciSgXGHqYwn9N6NeoKqopAu";
const evmAddress = "0x52908400098527886e0f7030069857d2e4169ee7";
const validatorPublicKey =
  "0x94c4002c93ce4911ae929129e444413f0b05ee5b97e5a99a95b609a0e61318332cfd601fc48e3853bf5a1cdd2be5f572";
const transactionHash = "0xabababababababababababababababababababababababababababababababab";

describe("blockchain redacted schemas", () => {
  it.effect(
    "decode canonical blockchain identifiers into redacted values",
    Effect.fnUntraced(function* () {
      const walletAddress = yield* decodeCryptoWalletAddressRedactedEffect(bitcoinAddress);
      const decodedEvmAddress = yield* decodeEvmAddressRedactedEffect(evmAddress);
      const decodedValidatorPublicKey = yield* decodeEthereumValidatorPublicKeyRedactedEffect(validatorPublicKey);
      const decodedTransactionHash = yield* decodeCryptoTxnHashRedactedEffect(transactionHash);

      expect(String(walletAddress)).toBe("<redacted>");
      expect(String(decodedEvmAddress)).toBe("<redacted>");
      expect(String(decodedValidatorPublicKey)).toBe("<redacted>");
      expect(String(decodedTransactionHash)).toBe("<redacted>");
      expect(Redacted.value(walletAddress)).toBe(bitcoinAddress);
      expect(Redacted.value(decodedEvmAddress)).toBe(evmAddress);
      expect(Redacted.value(decodedValidatorPublicKey)).toBe(validatorPublicKey);
      expect(Redacted.value(decodedTransactionHash)).toBe(transactionHash);
    })
  );
  const validatorPublicKeyArbitrary = Arbitrary.schema(EthereumValidatorPublicKey);

  it.effect.prop(
    "derives valid validator public keys from the source schema and round-trips",
    [validatorPublicKeyArbitrary],
    Effect.fnUntraced(function* ([value]) {
      expect(yield* decodeUnknownEthereumValidatorPublicKeyEffect(value)).toBe(value);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});
