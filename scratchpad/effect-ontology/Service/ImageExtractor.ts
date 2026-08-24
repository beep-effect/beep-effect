/**
 * ImageExtractor Service
 *
 * **Details**
 *
 * Extracts image candidates from Jina reader responses and markdown content.
 * Parses both the structured `image` field and inline markdown images.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { URLStr } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { JinaContent } from "../Domain/Model/EnrichedContent.ts";
import { ImageCandidate } from "../Domain/Model/Image.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ImageExtractor");

// =============================================================================
// Types
// =============================================================================

/**
 * Input for image extraction - can be JinaContent or raw markdown
 *
 *
 * **Example** (Use the ImageExtractionInput contract)
 *
 * ```ts
 * import type { ImageExtractionInput } from "@effect-ontology/Service/ImageExtractor"
 *
 * const acceptsImageExtractionInput = (_value: ImageExtractionInput): void => undefined
 *
 * console.log(acceptsImageExtractionInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ImageExtractionInput {
  /** The markdown content to parse for inline images */
  readonly content: string;
  /** Featured image URL (from Jina's structured response) */
  readonly featuredImage?: string;
  /** Source URL of the page (for referrer tracking) */
  readonly sourceUrl: string;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ImageExtractor service interface
 *
 * **Details**
 *
 * Extracts image candidates from content for downstream fetching and storage.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ImageExtractorService {
  /**
   * Extract image candidates from Jina content
   *
   * @param content - JinaContent with markdown and optional featured image
   * @returns Array of image candidates (hero + inline)
   */
  readonly extractFromJina: (content: JinaContent) => ReadonlyArray<ImageCandidate>;

  /**
   * Extract image candidates from raw input
   *
   * @param input - Extraction input with content, optional featured image, and source URL
   * @returns Array of image candidates
   */
  readonly extract: (input: ImageExtractionInput) => ReadonlyArray<ImageCandidate>;

  /**
   * Extract inline images from markdown content
   *
   * Parses markdown for `![alt](url)` patterns.
   *
   * @param markdown - Markdown content
   * @param sourceUrl - Source URL for referrer tracking
   * @param startOrder - Starting order number for inline images (default: 1)
   * @returns Array of inline image candidates
   */
  readonly extractFromMarkdown: (
    markdown: string,
    sourceUrl: string,
    startOrder?: number
  ) => ReadonlyArray<ImageCandidate>;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Regex pattern for markdown images: ![alt text](url "optional title")
 * Captures:
 * - Group 1: alt text
 * - Group 2: url
 * - Group 3: optional title (with quotes)
 */
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
const decodeUrlOption = S.decodeOption(URLStr);

/**
 * Normalize image URL (resolve relative URLs, clean up)
 */
const normalizeImageUrl = (imageUrl: string, sourceUrl: string): O.Option<URLStr> => {
  if (Str.startsWith("data:")(imageUrl)) return O.none();
  if (Str.startsWith("//")(imageUrl)) return decodeUrlOption(`https:${imageUrl}`);
  if (Str.startsWith("https://")(imageUrl) || Str.startsWith("https://")(imageUrl)) {
    return decodeUrlOption(imageUrl);
  }
  return O.flatMap(O.fromNullishOr(URL.parse(imageUrl, sourceUrl)), (resolved) => decodeUrlOption(resolved.toString()));
};

/**
 * Extract images from markdown content
 */
const parseMarkdownImages = (markdown: string, sourceUrl: string, startOrder: number = 1): Array<ImageCandidate> => {
  const candidates: Array<ImageCandidate> = [];
  let order = startOrder;

  // Reset regex lastIndex
  MARKDOWN_IMAGE_PATTERN.lastIndex = 0;

  let match = MARKDOWN_IMAGE_PATTERN.exec(markdown);
  while (match !== null) {
    const [, alt, rawUrl, title] = match;
    const normalizedUrl = normalizeImageUrl(rawUrl, sourceUrl);

    const referrerUrl = decodeUrlOption(sourceUrl);
    if (O.isSome(normalizedUrl) && O.isSome(referrerUrl)) {
      candidates.push(
        ImageCandidate.make({
          sourceUrl: normalizedUrl.value,
          alt: O.fromNullishOr(alt || undefined),
          caption: O.fromNullishOr(title || undefined),
          role: "inline",
          order: NonNegativeInt.make(order++),
          referrerUrl: referrerUrl.value,
        })
      );
    }
    match = MARKDOWN_IMAGE_PATTERN.exec(markdown);
  }

  return candidates;
};

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImageExtractor service tag
 *
 * **Example** (Inspect image extractor)
 *
 * ```ts
 * import { ImageExtractor } from "@effect-ontology/Service/ImageExtractor"
 *
 * console.log(ImageExtractor)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ImageExtractor extends Context.Service<ImageExtractor, ImageExtractorService>()($I`ImageExtractor`) {
  /**
   * Live implementation
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly Live = Layer.succeed(ImageExtractor, {
    extractFromJina: (content: JinaContent): ReadonlyArray<ImageCandidate> => {
      const candidates: Array<ImageCandidate> = [];

      // 1. Add featured image as hero (if present)
      if (O.isSome(content.image)) {
        const normalizedUrl = normalizeImageUrl(content.image.value, content.url);
        if (O.isSome(normalizedUrl)) {
          candidates.push(
            ImageCandidate.make({
              sourceUrl: normalizedUrl.value,
              role: "hero",
              order: NonNegativeInt.make(0),
              referrerUrl: content.url,
            })
          );
        }
      }

      // 2. Extract inline images from markdown content
      const inlineImages = parseMarkdownImages(content.content, content.url, 1);
      for (const img of inlineImages) {
        candidates.push(img);
      }

      return candidates;
    },

    extract: (input: ImageExtractionInput): ReadonlyArray<ImageCandidate> => {
      const candidates: Array<ImageCandidate> = [];

      // 1. Add featured image as hero (if present)
      if (P.isNotUndefined(input.featuredImage)) {
        const normalizedUrl = normalizeImageUrl(input.featuredImage, input.sourceUrl);
        const referrerUrl = decodeUrlOption(input.sourceUrl);
        if (O.isSome(normalizedUrl) && O.isSome(referrerUrl)) {
          candidates.push(
            ImageCandidate.make({
              sourceUrl: normalizedUrl.value,
              role: "hero",
              order: NonNegativeInt.make(0),
              referrerUrl: referrerUrl.value,
            })
          );
        }
      }

      // 2. Extract inline images from content
      const inlineImages = parseMarkdownImages(input.content, input.sourceUrl, 1);
      for (const img of inlineImages) {
        candidates.push(img);
      }

      return candidates;
    },

    extractFromMarkdown: (markdown: string, sourceUrl: string, startOrder: number = 1): ReadonlyArray<ImageCandidate> =>
      parseMarkdownImages(markdown, sourceUrl, startOrder),
  });

  /**
   * Default layer (no dependencies)
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly Default = ImageExtractor.Live;
}
