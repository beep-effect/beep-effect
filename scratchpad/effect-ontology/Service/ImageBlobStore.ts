/**
 * ImageBlobStore Service
 *
 * Low-level storage operations for image bytes and metadata.
 * Wraps StorageService with image-specific path management.
 *
 * @since 2.0.0
 * @module Service/ImageBlobStore
 */

import type { PlatformError, SystemError } from "effect/PlatformError"
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { ImageAsset } from "../Domain/Model/Image.ts"
import { PathLayout } from "../Domain/PathLayout.ts"
import { StorageService, StorageServiceLive } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
const $I = $ScratchpadId.create("effect-ontology/Service/ImageBlobStore");

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ImageBlobStore service interface
 *
 * Low-level image storage operations for bytes and metadata.
 *
 * @since 2.0.0
 * @category Service
 */
export interface ImageBlobStoreService {
  /**
   * Store image bytes at the content-addressed path
   */
  readonly putBytes: (hash: string, bytes: Uint8Array) => Effect.Effect<void, PlatformError>

  /**
   * Retrieve image bytes by hash
   */
  readonly getBytes: (hash: string) => Effect.Effect<Option.Option<Uint8Array>, PlatformError>

  /**
   * Check if image bytes exist
   */
  readonly hasBytes: (hash: string) => Effect.Effect<boolean, PlatformError>

  /**
   * Store image metadata JSON
   */
  readonly putMetadata: (asset: ImageAsset) => Effect.Effect<void, PlatformError>

  /**
   * Retrieve image metadata by hash
   */
  readonly getMetadata: (hash: string) => Effect.Effect<Option.Option<ImageAsset>, PlatformError>

  /**
   * Store both bytes and metadata atomically
   */
  readonly putBytesWithMetadata: (
    hash: string,
    bytes: Uint8Array,
    contentType: string,
    sourceUrl?: string
  ) => Effect.Effect<ImageAsset, PlatformError>

  /**
   * Delete image bytes and metadata
   */
  readonly delete: (hash: string) => Effect.Effect<void, PlatformError>

  /**
   * List all image hashes in storage
   */
  readonly listHashes: () => Effect.Effect<Array<string>, SystemError>

  /**
   * Get a signed URL for direct access to image bytes (GCS only)
   * @returns Signed URL or None if not supported
   */
  readonly getSignedUrl: (
    hash: string,
    expiresInSeconds?: number
  ) => Effect.Effect<Option.Option<string>, SystemError>

  /**
   * Whether this storage backend supports signed URLs
   */
  readonly supportsSignedUrls: boolean
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImageBlobStore service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class ImageBlobStore extends Context.Service<ImageBlobStore, ImageBlobStoreService>()($I`ImageBlobStore`) {
  /**
   * Live implementation using StorageService
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Live = Layer.effect(
    ImageBlobStore,
    Effect.gen(function*() {
      const storage = yield* StorageService

      return {
        putBytes: (hash: string, bytes: Uint8Array) => storage.set(PathLayout.image.original(hash), bytes),

        getBytes: (hash: string) => storage.getUint8Array(PathLayout.image.original(hash)),

        hasBytes: (hash: string) =>
          storage.getUint8Array(PathLayout.image.original(hash)).pipe(
            Effect.map(Option.isSome)
          ),

        putMetadata: (asset: ImageAsset) =>
          Effect.gen(function*() {
            const json = JSON.stringify(Schema.encodeSync(ImageAsset)(asset), null, 2)
            yield* storage.set(PathLayout.image.metadata(asset.hash), json)
          }),

        getMetadata: (hash: string) =>
          Effect.gen(function*() {
            const content = yield* storage.get(PathLayout.image.metadata(hash))
            if ((content === undefined)) return Option.none()

            const parsed = JSON.parse(content)
            const asset = Schema.decodeUnknownSync(ImageAsset)(parsed)
            return Option.some(asset)
          }),

        putBytesWithMetadata: (
          hash: string,
          bytes: Uint8Array,
          contentType: string,
          sourceUrl?: string
        ) =>
          Effect.gen(function*() {
            // Store bytes first
            yield* storage.set(PathLayout.image.original(hash), bytes)

            // Create metadata
            const asset: ImageAsset = {
              hash,
              contentType,
              sizeBytes: bytes.length,
              storagePath: PathLayout.image.original(hash),
              sourceUrl: O.fromNullishOr(sourceUrl),
              createdAt: O.some(DateTime.nowUnsafe())
            }

            // Store metadata
            const json = JSON.stringify(Schema.encodeSync(ImageAsset)(asset), null, 2)
            yield* storage.set(PathLayout.image.metadata(hash), json)

            return asset
          }),

        delete: (hash: string) =>
          Effect.all([
            storage.remove(PathLayout.image.original(hash)),
            storage.remove(PathLayout.image.metadata(hash)),
            storage.remove(PathLayout.image.labels(hash))
          ], { discard: true }),

        listHashes: () =>
          Effect.gen(function*() {
            const paths = yield* storage.list("assets/images/")
            // Extract unique hashes from paths like "assets/images/{hash}/..."
            const hashes = new Set<string>()
            for (const path of paths) {
              const match = path.match(/^assets\/images\/([^/]+)\//)
              if (match) hashes.add(match[1])
            }
            return Array.from(hashes)
          }),

        getSignedUrl: (hash: string, expiresInSeconds?: number) =>
          storage.getSignedUrl(PathLayout.image.original(hash), expiresInSeconds),

        supportsSignedUrls: storage.supportsSignedUrls
      }
    })
  )

  /**
   * Default layer with StorageService dependency
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default = ImageBlobStore.Live.pipe(
    Layer.provide(StorageServiceLive)
  )
}
