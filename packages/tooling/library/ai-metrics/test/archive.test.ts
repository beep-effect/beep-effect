import {
  AiMetricsEncryptedRawArchiveEnvelope,
  decryptEncryptedRawArchiveEnvelope,
} from "@beep/repo-ai-metrics/archive";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeArchiveEnvelope = AiMetricsEncryptedRawArchiveEnvelope.decodeUnknownResultFromJsonString;
const encodeArchiveEnvelope = AiMetricsEncryptedRawArchiveEnvelope.encodeUnknownResultFromJsonString;
const decodeUnknownJson = S.decodeUnknownResult(S.UnknownFromJsonString);
const encodeUnknownJson = S.encodeUnknownResult(S.UnknownFromJsonString);
const ArchiveEnvelopeArbitrary = S.toArbitrary(AiMetricsEncryptedRawArchiveEnvelope)(fc);

const currentEncoderFixture =
  '{"algorithm":"AES-256-GCM","archiveObjectId":"raw-2222222222222222222222222222222222222222222222222222222222222222","ciphertextBase64":"AAAAAAAAAAAAAAAAAAAAAA==","encryptedAtEpochMillis":1717000000000,"nonceBase64":"AAAAAAAAAAAAAAAA","plaintextContentHash":"0000000000000000000000000000000000000000000000000000000000000000","sourceKind":"codex","sourcePathHash":"1111111111111111111111111111111111111111111111111111111111111111"}';

describe("AI metrics encrypted raw archive envelope", () => {
  it("preserves the current persisted JSON envelope shape", () => {
    const decoded = Result.getOrThrow(decodeArchiveEnvelope(currentEncoderFixture));

    expect(Result.getOrThrow(encodeArchiveEnvelope(decoded))).toBe(currentEncoderFixture);
  });

  it("round-trips schema-derived envelopes", () =>
    fc.assert(
      fc.property(ArchiveEnvelopeArbitrary, (envelope) => {
        const encoded = Result.getOrThrow(encodeArchiveEnvelope(envelope));
        const decoded = Result.getOrThrow(decodeArchiveEnvelope(encoded));
        expect(Result.getOrThrow(encodeArchiveEnvelope(decoded))).toBe(encoded);
      }),
      fcRuns(25)
    ));

  it("rejects malformed cryptographic encodings and identities", () => {
    const fixture = Result.getOrThrow(decodeUnknownJson(currentEncoderFixture));
    const decodeFixture = (override: Record<string, unknown>) =>
      decodeArchiveEnvelope(Result.getOrThrow(encodeUnknownJson({ ...fixture, ...override })));

    expect(Result.isFailure(decodeFixture({ algorithm: "AES-128-GCM" }))).toBe(true);
    expect(Result.isFailure(decodeFixture({ archiveObjectId: "raw-not-a-sha256" }))).toBe(true);
    expect(Result.isFailure(decodeFixture({ ciphertextBase64: "not base64" }))).toBe(true);
    expect(Result.isFailure(decodeFixture({ nonceBase64: "AAAA" }))).toBe(true);
    expect(Result.isFailure(decodeFixture({ plaintextContentHash: "content-hash" }))).toBe(true);
    expect(Result.isFailure(decodeFixture({ sourcePathHash: "source-hash" }))).toBe(true);
  });

  it.effect("rejects malformed and wrong-length keys before decryption", () =>
    Effect.gen(function* () {
      const envelope = Result.getOrThrow(decodeArchiveEnvelope(currentEncoderFixture));

      for (const key of ["not base64", "AAAAAAAAAAAAAAAA"]) {
        const failure = yield* Effect.flip(
          decryptEncryptedRawArchiveEnvelope({ envelope, rawArchiveKey: Redacted.make(key) })
        );
        expect(failure.message).toContain("valid base64 and decode to exactly 32 bytes");
      }
    })
  );
});
