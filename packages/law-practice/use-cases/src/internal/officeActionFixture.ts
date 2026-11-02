/**
 * Office-action OCR page fixtures for law-practice tests, re-exported from
 * the package's `./test` surface.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { PageOcrResult } from "@beep/file-processing/PageOcr";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/**
 * Decodes a one-page fixture OCR result carrying the given text.
 *
 * @internal
 * @since 0.0.0
 */
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
