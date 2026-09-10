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
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeCryptoTxnHashRedactedSync = S.decodeSync(CryptoTxnHashRedacted);
const decodeCryptoWalletAddressRedactedSync = S.decodeSync(CryptoWalletAddressRedacted);
const decodeEthereumValidatorPublicKeyRedactedSync = S.decodeSync(EthereumValidatorPublicKeyRedacted);
const decodeEvmAddressRedactedSync = S.decodeSync(EvmAddressRedacted);
const decodeUnknownEthereumValidatorPublicKeySync = S.decodeUnknownSync(EthereumValidatorPublicKey);

const bitcoinAddress = "16L5yRNPTuciSgXGHqYwn9N6NeoKqopAu";
const evmAddress = "0x52908400098527886e0f7030069857d2e4169ee7";
const validatorPublicKey =
  "0x94c4002c93ce4911ae929129e444413f0b05ee5b97e5a99a95b609a0e61318332cfd601fc48e3853bf5a1cdd2be5f572";
const transactionHash = "0xabababababababababababababababababababababababababababababababab";

describe("blockchain redacted schemas", () => {
  it("decode canonical blockchain identifiers into redacted values", () => {
    const walletAddress = decodeCryptoWalletAddressRedactedSync(bitcoinAddress);
    const decodedEvmAddress = decodeEvmAddressRedactedSync(evmAddress);
    const decodedValidatorPublicKey = decodeEthereumValidatorPublicKeyRedactedSync(validatorPublicKey);
    const decodedTransactionHash = decodeCryptoTxnHashRedactedSync(transactionHash);

    expect(String(walletAddress)).toBe("<redacted>");
    expect(String(decodedEvmAddress)).toBe("<redacted>");
    expect(String(decodedValidatorPublicKey)).toBe("<redacted>");
    expect(String(decodedTransactionHash)).toBe("<redacted>");
    expect(Redacted.value(walletAddress)).toBe(bitcoinAddress);
    expect(Redacted.value(decodedEvmAddress)).toBe(evmAddress);
    expect(Redacted.value(decodedValidatorPublicKey)).toBe(validatorPublicKey);
    expect(Redacted.value(decodedTransactionHash)).toBe(transactionHash);
  });
  const validatorPublicKeyArbitrary = Arbitrary.schema(EthereumValidatorPublicKey);

  it("derives valid validator public keys from the source schema and round-trips", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([validatorPublicKeyArbitrary]),
          ([value]) => {
            expect(decodeUnknownEthereumValidatorPublicKeySync(value)).toBe(value);

            return true;
          },
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });
});
