/**
 * ImageExtractor Service
 *
 * Extracts image candidates from Jina reader responses and markdown content.
 * Parses both the structured `image` field and inline markdown images.
 *
 * @since 2.0.0
 * @module Service/ImageExtractor
 */

import { $ScratchpadId } from "@beep/identity";
import { URLStr } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type { JinaContent } from "../Domain/Model/EnrichedContent.ts";
import { ImageCandidate } from "../Domain/Model/Image.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ImageExtractor");

// =============================================================================
// Types
// =============================================================================

/**
 * Input for image extraction - can be JinaContent or raw markdown
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
 * Extracts image candidates from content for downstream fetching and storage.
 *
 * @since 2.0.0
 * @category Service
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
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

/**
 * Normalize image URL (resolve relative URLs, clean up)
 */
const normalizeImageUrl = (imageUrl: string, sourceUrl: string): URLStr | null => {
  try {
    // Handle data URIs - skip them
    if (imageUrl.startsWith("data:")) {
      return null;
    }

    // Handle protocol-relative URLs
    if (imageUrl.startsWith("//")) {
      return URLStr.fromUnknown(`https:${imageUrl}`);
    }

    // Handle absolute URLs
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return URLStr.fromUnknown(imageUrl);
    }

    // Handle relative URLs - resolve against source
    const base = new URL(sourceUrl);
    const resolved = new URL(imageUrl, base);
    return URLStr.fromUnknown(resolved.toString());
  } catch {
    // Invalid URL
    return null;
  }
};

/**
 * Extract images from markdown content
 */
const parseMarkdownImages = (markdown: string, sourceUrl: string, startOrder: number = 1): Array<ImageCandidate> => {
  const candidates: Array<ImageCandidate> = [];
  let order = startOrder;

  // Reset regex lastIndex
  MARKDOWN_IMAGE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_IMAGE_PATTERN.exec(markdown)) !== null) {
    const [, alt, rawUrl, title] = match;
    const normalizedUrl = normalizeImageUrl(rawUrl, sourceUrl);

    if (P.isNotNull(normalizedUrl)) {
      candidates.push(
        ImageCandidate.make({
          sourceUrl: normalizedUrl,
          alt: O.fromNullishOr(alt || undefined),
          caption: O.fromNullishOr(title || undefined),
          role: "inline",
          order: NonNegativeInt.make(order++),
          referrerUrl: URLStr.fromUnknown(sourceUrl),
        })
      );
    }
  }

  return candidates;
};

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImageExtractor service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class ImageExtractor extends Context.Service<ImageExtractor, ImageExtractorService>()($I`ImageExtractor`) {
  /**
   * Live implementation
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Live = Layer.succeed(ImageExtractor, {
    extractFromJina: (content: JinaContent): ReadonlyArray<ImageCandidate> => {
      const candidates: Array<ImageCandidate> = [];

      // 1. Add featured image as hero (if present)
      if (O.isSome(content.image)) {
        const normalizedUrl = normalizeImageUrl(content.image.value, content.url);
        if (P.isNotNull(normalizedUrl)) {
          candidates.push(
            ImageCandidate.make({
              sourceUrl: normalizedUrl,
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
        if (P.isNotNull(normalizedUrl)) {
          candidates.push(
            ImageCandidate.make({
              sourceUrl: normalizedUrl,
              role: "hero",
              order: NonNegativeInt.make(0),
              referrerUrl: URLStr.fromUnknown(input.sourceUrl),
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
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default = ImageExtractor.Live;
}
