/// <reference path="../../use-cases/test/fixtures/office-action-structure/raw.d.ts" />
import { PageOcrResult } from "@beep/file-processing/PageOcr";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";

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

export const fixtureOcrPage = (text: string) => {
  const hex = Str.repeat(64)("a");
  return S.decodeEffect(PageOcrResult)({
    confidence: 0.99,
    engine: { engineId: "fixture", family: "tesseract", version: "1" },
    imageDigest: `sha256:${hex}`,
    operationId: `operation:${hex}`,
    pageNumber: 1,
    sourceArtifactId: `artifact:${hex}`,
    sourceDigest: `sha256:${hex}`,
    text,
    textFormat: "plain-text",
    timing: { recognizeMillis: 1 },
    warnings: ["low-confidence"],
  });
};

export { default as fixtureText } from "../../use-cases/test/fixtures/office-action-structure/oa-001.txt?raw";
