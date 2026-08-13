/**
 * ImageStore Service
 *
 * High-level image storage orchestration with deduplication and manifest management.
 * Uses ImageBlobStore for low-level storage and manages owner-image relationships.
 *
 * @since 2.0.0
 * @module Service/ImageStore
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, DateTime, Effect, Layer } from "effect";
import * as O from "effect/Option";
import type { PlatformError, SystemError } from "effect/PlatformError";
import * as S from "effect/Schema";
import type { KeyValueStoreError } from "effect/unstable/persistence/KeyValueStore";
import type { ImageAsset, ImageOwnerType, ImageRef } from "../Domain/Model/Image.ts";
import { ImageManifest } from "../Domain/Model/Image.ts";
import { PathLayout, StoragePathSegment } from "../Domain/PathLayout.ts";
import { ImageBlobStore } from "./ImageBlobStore.ts";
import type { GenerationMismatchError } from "./Storage.ts";
import { StorageService, StorageServiceLive } from "./Storage.ts";

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
  ) => Effect.Effect<
    ImageAsset,
    PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError
  >;

  /**
   * Get image asset metadata by hash
   */
  readonly getAsset: (
    hash: string
  ) => Effect.Effect<
    O.Option<ImageAsset>,
    PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError
  >;

  /**
   * Get raw image bytes by hash
   */
  readonly getBytes: (
    hash: string
  ) => Effect.Effect<
    O.Option<Uint8Array>,
    PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError
  >;

  /**
   * Add an image reference to an owner's manifest
   * Creates the manifest if it doesn't exist
   *
   * @param ref - The image reference to add
   */
  readonly addImageRef: (
    ref: ImageRef
  ) => Effect.Effect<void, PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError>;

  /**
   * Get all image references for an owner
   */
  readonly listByOwner: (
    ownerType: ImageOwnerType,
    ownerId: string
  ) => Effect.Effect<ReadonlyArray<ImageRef>, PlatformError | SystemError | S.SchemaError | KeyValueStoreError>;

  /**
   * Get the full manifest for an owner
   */
  readonly getManifest: (
    ownerType: ImageOwnerType,
    ownerId: string
  ) => Effect.Effect<
    O.Option<ImageManifest>,
    PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError
  >;

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
  ) => Effect.Effect<void, PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError>;

  /**
   * Delete an image asset (bytes and metadata)
   * Note: Does not remove references from owner manifests
   */
  readonly deleteAsset: (
    hash: string
  ) => Effect.Effect<void, PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError>;

  /**
   * Get image count for an owner without loading full manifest
   */
  readonly countByOwner: (
    ownerType: ImageOwnerType,
    ownerId: string
  ) => Effect.Effect<
    number,
    PlatformError | S.SchemaError | SystemError | GenerationMismatchError | KeyValueStoreError
  >;
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
    Effect.gen(function* () {
      const blobStore = yield* ImageBlobStore;
      const storage = yield* StorageService;

      /**
       * Load manifest with generation for optimistic locking
       */
      const loadManifestWithGeneration = Effect.fn(function* (ownerType: ImageOwnerType, ownerId: string) {
        const path = PathLayout.image.manifest(ownerType, StoragePathSegment.make(ownerId));
        const result = yield* storage.getWithGeneration(path);

        if (O.isNone(result)) {
          return O.none<{
            manifest: ImageManifest;
            generation: string;
          }>();
        }

        const manifest = yield* ImageManifest.fromUnknownEffect(result.value.content);
        return O.some({ manifest, generation: result.value.generation });
      });

      /**
       * Save manifest with optimistic locking
       */
      const saveManifest = Effect.fn(function* (manifest: ImageManifest, generation: string) {
        const path = PathLayout.image.manifest(manifest.ownerType, StoragePathSegment.make(manifest.ownerId));
        const json = yield* ImageManifest.encodeEffect(manifest);
        yield* storage.setIfGenerationMatch(path, json, generation);
      });

      return {
        storeImage: Effect.fn(function* (hash, bytes, contentType, sourceUrl) {
          const existing = yield* blobStore.getMetadata(hash);
          if (O.isSome(existing)) {
            return existing.value;
          }
          return yield* blobStore.putBytesWithMetadata(hash, bytes, contentType, sourceUrl);
        }),
        getAsset: Effect.fn("ImageStore.getAsset")((hash) => blobStore.getMetadata(hash)),
        getBytes: Effect.fn("ImageStore.getBytes")((hash) => blobStore.getBytes(hash)),
        addImageRef: Effect.fn(function* (ref) {
          const manifestPath = PathLayout.image.manifest(ref.ownerType, StoragePathSegment.make(ref.ownerId));
          const existing = yield* loadManifestWithGeneration(ref.ownerType, ref.ownerId);
          if (O.isSome(existing)) {
            const { generation, manifest } = existing.value;
            const alreadyExists = manifest.images.some(
              (img) => img.assetHash === ref.assetHash && img.position === ref.position
            );
            if (!alreadyExists) {
              const updatedManifest: ImageManifest = {
                ...manifest,
                images: [...manifest.images, ref].sort((a, b) => a.position - b.position),
                totalCount: manifest.totalCount + 1,
                updatedAt: DateTime.nowUnsafe(),
              };
              yield* saveManifest(updatedManifest, generation);
            }
          } else {
            const newManifest: ImageManifest = {
              ownerType: ref.ownerType,
              ownerId: ref.ownerId,
              images: [ref],
              totalCount: 1,
              updatedAt: DateTime.nowUnsafe(),
            };
            const json = yield* S.encodeEffect(S.fromJsonString(ImageManifest, { space: 2 }))(newManifest);
            yield* storage.setIfGenerationMatch(manifestPath, json, "0");
          }
        }),
        listByOwner: Effect.fn(function* (ownerType, ownerId) {
          const result = yield* loadManifestWithGeneration(ownerType, ownerId);
          if (O.isNone(result)) return [];
          return result.value.manifest.images;
        }),
        getManifest: Effect.fn(function* (ownerType, ownerId) {
          const result = yield* loadManifestWithGeneration(ownerType, ownerId);
          if (O.isNone(result)) return O.none();
          return O.some(result.value.manifest);
        }),
        removeImageRef: Effect.fn(function* (ownerType, ownerId, assetHash) {
          const existing = yield* loadManifestWithGeneration(ownerType, ownerId);
          if (O.isNone(existing)) return;
          const { generation, manifest } = existing.value;
          const filtered = manifest.images.filter((img) => img.assetHash !== assetHash);
          if (filtered.length !== manifest.images.length) {
            const updatedManifest: ImageManifest = {
              ...manifest,
              images: filtered,
              totalCount: filtered.length,
              updatedAt: DateTime.nowUnsafe(),
            };
            yield* saveManifest(updatedManifest, generation);
          }
        }),
        deleteAsset: Effect.fn("ImageStore.deleteAsset")((hash) => blobStore.delete(hash)),
        countByOwner: Effect.fn(function* (ownerType, ownerId) {
          const result = yield* loadManifestWithGeneration(ownerType, ownerId);
          if (O.isNone(result)) return 0;
          return result.value.manifest.totalCount;
        }),
      };
    })
  );

  /**
   * Default layer with all dependencies
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default = ImageStore.Live.pipe(Layer.provide(ImageBlobStore.Live), Layer.provide(StorageServiceLive));
}
