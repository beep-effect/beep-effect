import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
export const TestCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (algorithm, data) =>
      Effect.tryPromise({
        try: () =>
          globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data)).then((buffer) => new Uint8Array(buffer)),
        catch: (cause) =>
          PlatformError.systemError({
            _tag: "Unknown",
            cause,
            description: "Fixture digest failure",
            method: "digest",
            module: "OfficeActionStructureTest",
          }),
      }),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  })
);
export const fixtureSource = Effect.fn("OfficeActionFixture.source")(function* (text: string) {
  const hex = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));
  const digest = SourceTextDigest.make(`sha256:${hex}`);
  const source = SourceTextIdentity.make({
    scopeRef: "matter:fixture",
    sourceRef: "source:fixture",
    locator: PosixPath.make("fixtures/action.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
  const verification = VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText: text });
  const verifiedSource = yield* verifySourceTextIdentity(verification);
  return { source, verification, verifiedSource };
});
