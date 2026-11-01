/**
 * Office-action source-text fixtures shared by the law-practice test suites,
 * re-exported from the package's `./test` surface.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { VerifiedSourceText, VerifiedTextAnchorError } from "@beep/provenance/VerifiedTextAnchor";

/**
 * Web Crypto digest and secure-random services for fixture hashing.
 *
 * @internal
 * @since 0.0.0
 */
export const TestCrypto = Layer.mergeAll(Digest.layerWebCrypto, SecureRandom.layerWebCrypto);

/**
 * Builds a verified source-text identity for a fixture text.
 *
 * @internal
 * @since 0.0.0
 */
export const fixtureSource = Effect.fn("OfficeActionFixture.source")(function* (text: string): Effect.fn.Return<
  {
    readonly source: SourceTextIdentity;
    readonly verification: VerifySourceTextIdentityInput;
    readonly verifiedSource: VerifiedSourceText;
  },
  S.SchemaError | VerifiedTextAnchorError,
  Digest.Digest
> {
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
