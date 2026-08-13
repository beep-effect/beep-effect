/**
 * ImagePromptAdapter Service
 *
 * Adapts stored images for LLM multimodal prompts.
 * Converts ImageRef[] to ImageForPrompt[] with base64 encoding,
 * and provides helpers for building @effect/ai Prompt.Part[].
 *
 * @since 2.0.0
 * @module Service/ImagePromptAdapter
 */

import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { PlatformError } from "effect/PlatformError";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import { Prompt } from "effect/unstable/ai";
import type { KeyValueStoreError } from "effect/unstable/persistence/KeyValueStore";
import type { ImageForPrompt, ImageRef } from "../Domain/Model/Image.ts";
import { dual2 } from "../Utils/Dual.ts";
import { ImageBlobStore } from "./ImageBlobStore.ts";
import { StorageServiceLive } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ImagePromptAdapter");

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert Uint8Array to base64 string
 */
const toBase64 = (bytes: Uint8Array): string => {
  // Use Buffer in Node.js/Bun environment
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  // Fallback for browser (though we're primarily server-side)
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Get file extension from media type
 */
const getExtension = (mediaType: string): string => {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[mediaType] ?? "bin";
};

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ImagePromptAdapter service interface
 *
 * Prepares images for LLM multimodal prompts.
 *
 * @since 2.0.0
 * @category Service
 */
export interface ImagePromptAdapterService {
  /**
   * Convert image references to LLM-ready format
   *
   * Loads image bytes from storage and encodes as base64.
   * Skips images that fail to load (logs warning).
   *
   * @param refs - Image references to convert
   * @returns Array of images ready for prompts
   */
  readonly toImageForPrompt: (
    refs: ReadonlyArray<ImageRef>
  ) => Effect.Effect<ReadonlyArray<ImageForPrompt>, PlatformError | KeyValueStoreError | S.SchemaError>;

  /**
   * Convert ImageForPrompt[] to @effect/ai Prompt.FilePart[]
   *
   * Creates FilePart objects suitable for multimodal LLM calls.
   *
   * @param images - Images to convert
   * @returns Array of Prompt.FilePart objects
   */
  readonly toPromptParts: (images: ReadonlyArray<ImageForPrompt>) => ReadonlyArray<Prompt.FilePart>;

  /**
   * Build a complete user message with text and images
   *
   * Combines text content with image FileParts for multimodal prompts.
   *
   * @param text - Text content
   * @param images - Images to include
   * @param imageIntro - Optional intro text before images (default: "Relevant images:")
   * @returns Array of UserMessagePart objects for user message content
   */
  readonly buildUserMessageParts: (
    text: string,
    images: ReadonlyArray<ImageForPrompt>,
    imageIntro?: string
  ) => ReadonlyArray<Prompt.UserMessagePart>;
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImagePromptAdapter service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class ImagePromptAdapter extends Context.Service<ImagePromptAdapter, ImagePromptAdapterService>()(
  $I`ImagePromptAdapter`
) {
  /**
   * Live implementation
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Live = Layer.effect(
    ImagePromptAdapter,
    Effect.gen(function* () {
      const blobStore = yield* ImageBlobStore;

      const toImageForPrompt: ImagePromptAdapterService["toImageForPrompt"] = (refs) =>
        Effect.forEach(
          refs,
          Effect.fn(function* (ref) {
            // Load asset metadata
            const assetOpt = yield* blobStore.getMetadata(ref.assetHash);
            if (O.isNone(assetOpt)) {
              yield* Effect.logWarning(`Image asset not found: ${ref.assetHash}`);
              return O.none<ImageForPrompt>();
            }
            const asset = assetOpt.value;

            // Load bytes
            const bytesOpt = yield* blobStore.getBytes(ref.assetHash);
            if (O.isNone(bytesOpt)) {
              yield* Effect.logWarning(`Image bytes not found: ${ref.assetHash}`);
              return O.none<ImageForPrompt>();
            }

            // Convert to ImageForPrompt
            return O.some<ImageForPrompt>({
              base64: toBase64(bytesOpt.value),
              mediaType: asset.contentType,
              alt: ref.alt,
              caption: ref.caption,
              context: ref.context,
              position: O.some(ref.position),
              assetHash: O.some(ref.assetHash),
            });
          }),
          { concurrency: 5 }
        ).pipe(
          Effect.map(
            flow(
              A.filter(O.isSome),
              A.map((opt) => opt.value)
            )
          )
        );

      const toPromptParts: ImagePromptAdapterService["toPromptParts"] = (images) =>
        images.map((img, index) =>
          Prompt.makePart("file", {
            mediaType: img.mediaType,
            data: img.base64,
            fileName: `image-${img.position ?? index}.${getExtension(img.mediaType)}`,
          })
        );

      const buildUserMessageParts: ImagePromptAdapterService["buildUserMessageParts"] = (
        text,
        images,
        imageIntro = "Relevant images from the document:"
      ) => {
        const parts: Array<Prompt.UserMessagePart> = [Prompt.makePart("text", { text })];

        if (images.length > 0) {
          // Add intro text for images
          parts.push(Prompt.makePart("text", { text: `\n\n${imageIntro}` }));

          // Add image parts with context
          for (const img of images) {
            // Add context/caption as text before image if available
            const imageContext = [img.alt, img.caption, img.context].filter(Boolean).join(" - ");

            if (P.isNotUndefined(imageContext)) {
              parts.push(Prompt.makePart("text", { text: `\n[Image ${img.position ?? 0}: ${imageContext}]` }));
            }

            parts.push(
              Prompt.makePart("file", {
                mediaType: img.mediaType,
                data: img.base64,
                fileName: `image-${img.position ?? 0}.${getExtension(img.mediaType)}`,
              })
            );
          }
        }

        return parts;
      };

      return {
        toImageForPrompt,
        toPromptParts,
        buildUserMessageParts,
      };
    })
  );

  /**
   * Default layer with all dependencies
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default = ImagePromptAdapter.Live.pipe(
    Layer.provide(ImageBlobStore.Live),
    Layer.provide(StorageServiceLive)
  );
}

// =============================================================================
// Standalone Utilities
// =============================================================================

/**
 * Convert ImageForPrompt[] to Prompt.FilePart[] without service dependency
 *
 * Useful for testing or when images are already loaded.
 *
 * @param images - Images to convert
 * @returns Array of Prompt.FilePart objects
 *
 * @since 2.0.0
 * @category Utilities
 */
export const imagesToPromptParts = (images: ReadonlyArray<ImageForPrompt>): ReadonlyArray<Prompt.FilePart> =>
  A.map(images, (img, index) =>
    Prompt.makePart("file", {
      mediaType: img.mediaType,
      data: img.base64,
      fileName: `image-${img.position ?? index}.${getExtension(img.mediaType)}`,
    })
  );

/**
 * Build multimodal user message content with text and images
 *
 * Standalone function for building user message parts.
 *
 * @param text - Text content
 * @param images - Images to include (optional)
 * @returns Array of UserMessagePart objects
 *
 * @since 2.0.0
 * @category Utilities
 */
export const buildMultimodalContent = dual2(
  (text: string, images: ReadonlyArray<ImageForPrompt> | undefined): ReadonlyArray<Prompt.UserMessagePart> => {
    const parts: Array<Prompt.UserMessagePart> = [Prompt.makePart("text", { text })];

    if (P.isNotUndefined(images) && images.length > 0) {
      for (const part of imagesToPromptParts(images)) {
        parts.push(part);
      }
    }

    return parts;
  }
);
