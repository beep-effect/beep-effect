import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
export const TestCrypto = Layer.mergeAll(Digest.layerWebCrypto, SecureRandom.layerWebCrypto);
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
