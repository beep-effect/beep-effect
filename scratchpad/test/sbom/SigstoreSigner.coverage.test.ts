import { assert, describe, it, vi } from "@effect/vitest";
import * as Bundle from "@sigstore/bundle";
import type { Signer } from "@sigstore/sign";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { IdentityToken } from "../../effected/sbom/IdentityToken.ts";
import { InTotoStatement } from "../../effected/sbom/InTotoStatement.ts";
import { SigstoreSigner } from "../../effected/sbom/SigstoreSigner.ts";

const statement = InTotoStatement.of({ subject: [], predicateType: "test", predicate: {} });
const successfulSigner: Signer = {
  sign: () => Promise.resolve({ signature: Buffer.from("signature"), key: { $case: "x509Certificate", certificate: "-----BEGIN CERTIFICATE-----\nc3R1Yg==\n-----END CERTIFICATE-----" } }),
};

describe("SigstoreSigner remaining failure paths", () => {
  for (const sample of [
    { cause: { code: "IDENTITY_TOKEN_TEST" }, kind: "identity" },
    { cause: { code: "TSA_TEST" }, kind: "transparencyLog" },
    { cause: { code: "UNRECOGNIZED" }, kind: "bundle" },
    { cause: { code: 42 }, kind: "bundle" },
    { cause: null, kind: "bundle" },
  ]) {
    it.layer(SigstoreSigner.layerWith({ signer: { sign: () => Promise.reject(sample.cause) }, witnesses: [] }).pipe(Layer.provide(IdentityToken.layerTest())), { timeout: "30 seconds" })((it) => {
      it.effect(`attributes ${String(sample.cause?.code)} without guessing`, () => Effect.gen(function* () {
        const error = yield* Effect.flip((yield* SigstoreSigner).sign(statement));
        assert.strictEqual(error.kind, sample.kind);
        assert.strictEqual(error.cause, sample.cause);
        assert.strictEqual(error.message, `Failed to sign the statement (${sample.kind})`);
      }));
    });
  }

  // Fulcio rejects a malformed JWT before certificate requests. This drives
  // the real default adapters and the identity provider without network IO.
  for (const layer of [SigstoreSigner.layer, SigstoreSigner.layerWith({ fulcioBaseUrl: "https://fulcio.example", rekorBaseUrl: "https://rekor.example" })]) {
    it.layer(layer.pipe(Layer.provide(IdentityToken.layerStatic("malformed-jwt"))), { timeout: "30 seconds" })((it) => {
      it.effect("default Fulcio consumes the identity token and rejects it before HTTP", () => Effect.gen(function* () {
        const error = yield* Effect.flip((yield* SigstoreSigner).sign(statement));
        assert.strictEqual(error.kind, "identity");
        assert.strictEqual(error.message, "Failed to sign the statement (identity)");
      }));
    });
  }

  it.layer(SigstoreSigner.layerWith({ signer: successfulSigner, witnesses: [] }).pipe(Layer.provide(IdentityToken.layerTest())), { timeout: "30 seconds" })((it) => {
    it.effect("preserves a failure in bundle serialization after the real builder succeeds", () => Effect.gen(function* () {
      const cause = { operation: "bundleToJSON" };
      const spy = vi.spyOn(Bundle, "bundleToJSON").mockImplementation(() => { throw cause; });
      yield* Effect.acquireUseRelease(
        Effect.succeed(spy),
        () => Effect.gen(function* () {
          const error = yield* Effect.flip((yield* SigstoreSigner).sign(statement));
          assert.strictEqual(error.kind, "bundle");
          assert.strictEqual(error.cause, cause);
        }),
        (mock) => Effect.sync(() => mock.mockRestore()),
      );
    }));
  });

  it.layer(SigstoreSigner.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("the default layer double refuses an unstubbed signature", () => Effect.gen(function* () {
      const signer = yield* SigstoreSigner;
      assert.throws(() => signer.sign(statement), /not stubbed/);
    }));
  });
});
