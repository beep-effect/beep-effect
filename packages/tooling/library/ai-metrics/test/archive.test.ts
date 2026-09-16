import {
  AiMetricsEncryptedRawArchiveEnvelope,
  decryptEncryptedRawArchiveEnvelope,
  writeEncryptedRawArchiveObject,
} from "@beep/repo-ai-metrics/archive";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Encoding, FileSystem, Redacted, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const ArchiveEnvelopeFromJsonString = S.fromJsonString(AiMetricsEncryptedRawArchiveEnvelope);
const decodeArchiveEnvelope = S.decodeUnknownResult(ArchiveEnvelopeFromJsonString);
const encodeArchiveEnvelope = S.encodeUnknownResult(ArchiveEnvelopeFromJsonString);
const JsonRecord = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeUnknownJson = S.decodeUnknownResult(JsonRecord);
const encodeUnknownJson = S.encodeUnknownResult(JsonRecord);
const ArchiveEnvelopeArbitrary = Arbitrary.schema(AiMetricsEncryptedRawArchiveEnvelope);

const currentEncoderFixture =
  '{"algorithm":"AES-256-GCM","archiveObjectId":"raw-2222222222222222222222222222222222222222222222222222222222222222","ciphertextBase64":"AAAAAAAAAAAAAAAAAAAAAA==","encryptedAtEpochMillis":1717000000000,"nonceBase64":"AAAAAAAAAAAAAAAA","plaintextContentHash":"0000000000000000000000000000000000000000000000000000000000000000","sourceKind":"codex","sourcePathHash":"1111111111111111111111111111111111111111111111111111111111111111"}';

describe("AI metrics encrypted raw archive envelope", () => {
  it("preserves the current persisted JSON envelope shape", () => {
    const decoded = Result.getOrThrow(decodeArchiveEnvelope(currentEncoderFixture));

    expect(Result.getOrThrow(encodeArchiveEnvelope(decoded))).toBe(currentEncoderFixture);
  });

  it("accepts ciphertext larger than the regex backtracking limit", () => {
    const bytes = new Uint8Array(12 * 1024 * 1024);
    const fixture = Result.getOrThrow(decodeUnknownJson(currentEncoderFixture));
    const encoded = Result.getOrThrow(
      encodeUnknownJson({ ...fixture, ciphertextBase64: Encoding.encodeBase64(bytes) })
    );
    const decoded = Result.getOrThrow(decodeArchiveEnvelope(encoded));
    const recovered = Result.getOrThrow(Encoding.decodeBase64(decoded.ciphertextBase64));
    expect(Buffer.compare(Buffer.from(recovered), Buffer.from(bytes))).toBe(0);
  });

  it("still rejects corrupted large ciphertext", () => {
    const ciphertext = Encoding.encodeBase64(new Uint8Array(12 * 1024 * 1024));
    const middle = ciphertext.length / 2;
    const fixture = Result.getOrThrow(decodeUnknownJson(currentEncoderFixture));
    const encoded = Result.getOrThrow(
      encodeUnknownJson({
        ...fixture,
        ciphertextBase64: `${Str.slice(0, middle)(ciphertext)}!${Str.slice(middle + 1)(ciphertext)}`,
      })
    );
    expect(Result.isFailure(decodeArchiveEnvelope(encoded))).toBe(true);
  });

  it.effect(
    "writes and decrypts a large raw archive object",
    Effect.fn(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const rawArchiveDir = yield* fs.makeTempDirectoryScoped({ prefix: "ai-metrics-large-archive-" });
        const content = Str.repeat(8 * 1024 * 1024)("x");
        const rawArchiveKey = Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
        const object = yield* writeEncryptedRawArchiveObject({
          content,
          hashSalt: O.some("fixture-salt"),
          rawArchiveDir,
          rawArchiveKey,
          sourceKind: "codex",
          sourcePath: "large-session.jsonl",
        });
        expect(yield* fs.exists(object.archivePath)).toBe(true);
        const envelope = Result.getOrThrow(decodeArchiveEnvelope(yield* fs.readFileString(object.archivePath)));
        expect(yield* decryptEncryptedRawArchiveEnvelope({ envelope, rawArchiveKey })).toBe(content);
      },
      Effect.scoped,
      provideScopedLayer(NodeServices.layer)
    )
  );

  it.effect(
    "reports envelope construction failures as typed archive errors",
    Effect.fn(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const rawArchiveDir = yield* fs.makeTempDirectoryScoped({ prefix: "ai-metrics-invalid-envelope-" });
        yield* TestClock.setTime(-1);
        const failure = yield* Effect.flip(
          writeEncryptedRawArchiveObject({
            content: "fixture",
            hashSalt: O.some("fixture-salt"),
            rawArchiveDir,
            rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
            sourceKind: "codex",
            sourcePath: "session.jsonl",
          })
        );
        expect(failure._tag).toBe("AiMetricsArchiveError");
        expect(failure.message).toBe("Failed to validate raw archive envelope.");
      },
      Effect.scoped,
      provideScopedLayer(NodeServices.layer)
    )
  );

  it("round-trips schema-derived envelopes", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([ArchiveEnvelopeArbitrary]),
          ([envelope]) => {
            const encoded = Result.getOrThrow(encodeArchiveEnvelope(envelope));
            const decoded = Result.getOrThrow(decodeArchiveEnvelope(encoded));
            expect(Result.getOrThrow(encodeArchiveEnvelope(decoded))).toBe(encoded);

            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed"));

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
          decryptEncryptedRawArchiveEnvelope({
            envelope,
            rawArchiveKey: Redacted.make(key),
          })
        );
        expect(failure.message).toContain("valid base64 and decode to exactly 32 bytes");
      }
    })
  );
});
