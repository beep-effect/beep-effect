/**
 * ImageStore Service
 *
 * High-level image storage orchestration with deduplication and manifest management.
 * Uses ImageBlobStore for low-level storage and manages owner-image relationships.
 *
 * @since 2.0.0
 * @module Service/ImageStore
 */

import type { PlatformError } from "effect/PlatformError"
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import type { ImageAsset, ImageOwnerType, ImageRef } from "../Domain/Model/Image.ts"
import { ImageManifest } from "../Domain/Model/Image.ts"
import { PathLayout } from "../Domain/PathLayout.ts"
import { ImageBlobStore } from "./ImageBlobStore.ts"
import { type GenerationMismatchError, StorageService, StorageServiceLive } from "./Storage.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/ImageStore");

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ImageStore service interface
 *
 * High-level operations for storing, retrieving, and managing images
 * with deduplication and owner manifests.
 *
 * @since 2.0.0
 * @category Service
 */
export interface ImageStoreService {
  /**
   * Store an image, deduplicating by content hash
   *
   * @param hash - Precomputed SHA-256 hash of the image
   * @param bytes - Raw image bytes
   * @param contentType - MIME type
   * @param sourceUrl - Original source URL for provenance
   * @returns The ImageAsset (existing or newly created)
   */
  readonly storeImage: (
    hash: string,
    bytes: Uint8Array,
    contentType: string,
    sourceUrl?: string
  ) => Effect.Effect<ImageAsset, PlatformError>

  /**
   * Get image asset metadata by hash
   */
  readonly getAsset: (hash: string) => Effect.Effect<Option.Option<ImageAsset>, PlatformError>

  /**
   * Get raw image bytes by hash
   */
  readonly getBytes: (hash: string) => Effect.Effect<Option.Option<Uint8Array>, PlatformError>

  /**
   * Add an image reference to an owner's manifest
   * Creates the manifest if it doesn't exist
   *
   * @param ref - The image reference to add
   */
  readonly addImageRef: (ref: ImageRef) => Effect.Effect<void, PlatformError | GenerationMismatchError>

  /**
   * Get all image references for an owner
   */
  readonly listByOwner: (
    ownerType: ImageOwnerType,
    ownerId: string
  ) => Effect.Effect<ReadonlyArray<ImageRef>, PlatformError>

  /**
   * Get the full manifest for an owner
   */
  readonly getManifest: (
    ownerType: ImageOwnerType,
    ownerId: string
  ) => Effect.Effect<Option.Option<ImageManifest>, PlatformError>

  /**
   * Remove an image reference from an owner's manifest
   *
   * @param ownerType - Type of owner
   * @param ownerId - Owner ID
   * @param assetHash - Hash of the image to remove
   */
  readonly removeImageRef: (
    ownerType: ImageOwnerType,
    ownerId: string,
    assetHash: string
  ) => Effect.Effect<void, PlatformError | GenerationMismatchError>

  /**
   * Delete an image asset (bytes and metadata)
   * Note: Does not remove references from owner manifests
   */
  readonly deleteAsset: (hash: string) => Effect.Effect<void, PlatformError>

  /**
   * Get image count for an owner without loading full manifest
   */
  readonly countByOwner: (
    ownerType: ImageOwnerType,
    ownerId: string
  ) => Effect.Effect<number, PlatformError>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImageStore service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class ImageStore extends Context.Service<ImageStore, ImageStoreService>()($I`ImageStore`) {
  /**
   * Live implementation
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Live = Layer.effect(
    ImageStore,
    Effect.gen(function*() {
      const blobStore = yield* ImageBlobStore
      const storage = yield* StorageService

      /**
       * Load manifest with generation for optimistic locking
       */
      const loadManifestWithGeneration = (ownerType: ImageOwnerType, ownerId: string) =>
        Effect.gen(function*() {
          const path = PathLayout.image.manifest(ownerType, ownerId)
          const result = yield* storage.getWithGeneration(path)

          if (Option.isNone(result)) {
            return Option.none<{ manifest: ImageManifest; generation: string }>()
          }

          const parsed = JSON.parse(result.value.content)
          const manifest = Schema.decodeUnknownSync(ImageManifest)(parsed)
          return Option.some({ manifest, generation: result.value.generation })
        })

      /**
       * Save manifest with optimistic locking
       */
      const saveManifest = (manifest: ImageManifest, generation: string) =>
        Effect.gen(function*() {
          const path = PathLayout.image.manifest(manifest.ownerType, manifest.ownerId)
          const json = JSON.stringify(Schema.encodeSync(ImageManifest)(manifest), null, 2)
          yield* storage.setIfGenerationMatch(path, json, generation)
        })

      return {
        storeImage: (hash, bytes, contentType, sourceUrl) =>
          Effect.gen(function*() {
            // Check if asset already exists (deduplication)
            const existing = yield* blobStore.getMetadata(hash)
            if (Option.isSome(existing)) {
              return existing.value
            }

            // Store new asset
            return yield* blobStore.putBytesWithMetadata(hash, bytes, contentType, sourceUrl)
          }),

        getAsset: (hash) => blobStore.getMetadata(hash),

        getBytes: (hash) => blobStore.getBytes(hash),

        addImageRef: (ref) =>
          Effect.gen(function*() {
            const manifestPath = PathLayout.image.manifest(ref.ownerType, ref.ownerId)

            // Try to load existing manifest
            const existing = yield* loadManifestWithGeneration(ref.ownerType, ref.ownerId)

            if (Option.isSome(existing)) {
              // Update existing manifest
              const { generation, manifest } = existing.value

              // Check if this ref already exists (by assetHash and position)
              const alreadyExists = manifest.images.some(
                (img) => img.assetHash === ref.assetHash && img.position === ref.position
              )

              if (!alreadyExists) {
                const updatedManifest: ImageManifest = {
                  ...manifest,
                  images: [...manifest.images, ref].sort((a, b) => a.position - b.position),
                  totalCount: manifest.totalCount + 1,
                  updatedAt: DateTime.nowUnsafe()
                }
                yield* saveManifest(updatedManifest, generation)
              }
            } else {
              // Create new manifest
              const newManifest: ImageManifest = {
                ownerType: ref.ownerType,
                ownerId: ref.ownerId,
                images: [ref],
                totalCount: 1,
                updatedAt: DateTime.nowUnsafe()
              }
              const json = JSON.stringify(Schema.encodeSync(ImageManifest)(newManifest), null, 2)
              // Use generation "0" for new files
              yield* storage.setIfGenerationMatch(manifestPath, json, "0")
            }
          }),

        listByOwner: (ownerType, ownerId) =>
          Effect.gen(function*() {
            const result = yield* loadManifestWithGeneration(ownerType, ownerId)
            if (Option.isNone(result)) return []
            return result.value.manifest.images
          }),

        getManifest: (ownerType, ownerId) =>
          Effect.gen(function*() {
            const result = yield* loadManifestWithGeneration(ownerType, ownerId)
            if (Option.isNone(result)) return Option.none()
            return Option.some(result.value.manifest)
          }),

        removeImageRef: (ownerType, ownerId, assetHash) =>
          Effect.gen(function*() {
            const existing = yield* loadManifestWithGeneration(ownerType, ownerId)
            if (Option.isNone(existing)) return

            const { generation, manifest } = existing.value
            const filtered = manifest.images.filter((img) => img.assetHash !== assetHash)

            if (filtered.length !== manifest.images.length) {
              const updatedManifest: ImageManifest = {
                ...manifest,
                images: filtered,
                totalCount: filtered.length,
                updatedAt: DateTime.nowUnsafe()
              }
              yield* saveManifest(updatedManifest, generation)
            }
          }),

        deleteAsset: (hash) => blobStore.delete(hash),

        countByOwner: (ownerType, ownerId) =>
          Effect.gen(function*() {
            const result = yield* loadManifestWithGeneration(ownerType, ownerId)
            if (Option.isNone(result)) return 0
            return result.value.manifest.totalCount
          })
      }
    })
  )

  /**
   * Default layer with all dependencies
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default = ImageStore.Live.pipe(
    Layer.provide(ImageBlobStore.Live),
    Layer.provide(StorageServiceLive)
  )
}
