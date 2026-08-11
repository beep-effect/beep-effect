/**
 * ImageBlobStore Service
 *
 * Low-level storage operations for image bytes and metadata.
 * Wraps StorageService with image-specific path management.
 *
 * @since 2.0.0
 * @module Service/ImageBlobStore
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, DateTime, Effect, Layer, MutableHashSet, Option, Schema } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type { PlatformError, SystemError } from "effect/PlatformError";
import * as Str from "effect/String";
import type { KeyValueStoreError } from "effect/unstable/persistence/KeyValueStore";
import { ContentHash } from "../Domain/Identity.ts";
import { ImageAsset } from "../Domain/Model/Image.ts";
import { PathLayout } from "../Domain/PathLayout.ts";
import { StorageService, StorageServiceLive } from "./Storage.ts";

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
  readonly putBytes: (hash: string, bytes: Uint8Array) => Effect.Effect<void, KeyValueStoreError>;

  /**
   * Retrieve image bytes by hash
   */
  readonly getBytes: (hash: string) => Effect.Effect<Option.Option<Uint8Array>, KeyValueStoreError>;

  /**
   * Check if image bytes exist
   */
  readonly hasBytes: (hash: string) => Effect.Effect<boolean, KeyValueStoreError>;

  /**
   * Store image metadata JSON
   */
  readonly putMetadata: (asset: ImageAsset) => Effect.Effect<void, KeyValueStoreError | Schema.SchemaError>;

  /**
   * Retrieve image metadata by hash
   */
  readonly getMetadata: (
    hash: string
  ) => Effect.Effect<Option.Option<ImageAsset>, KeyValueStoreError | Schema.SchemaError>;

  /**
   * Store both bytes and metadata atomically
   */
  readonly putBytesWithMetadata: (
    hash: string,
    bytes: Uint8Array,
    contentType: string,
    sourceUrl?: string
  ) => Effect.Effect<ImageAsset, KeyValueStoreError | Schema.SchemaError>;

  /**
   * Delete image bytes and metadata
   */
  readonly delete: (hash: string) => Effect.Effect<void, KeyValueStoreError>;

  /**
   * List all image hashes in storage
   */
  readonly listHashes: Effect.Effect<Array<string>, SystemError | PlatformError>;

  /**
   * Get a signed URL for direct access to image bytes (GCS only)
   * @returns Signed URL or None if not supported
   */
  readonly getSignedUrl: (
    hash: string,
    expiresInSeconds?: number
  ) => Effect.Effect<Option.Option<string>, SystemError | PlatformError>;

  /**
   * Whether this storage backend supports signed URLs
   */
  readonly supportsSignedUrls: boolean;
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
    Effect.gen(function* (): Effect.fn.Return<ImageBlobStoreService, never, StorageService> {
      const storage = yield* StorageService;

      const imagePathHash = (hash: string): ContentHash => ContentHash.fromUnknown(hash);

      return {
        putBytes: (hash: string, bytes: Uint8Array) =>
          storage.set(PathLayout.image.original(imagePathHash(hash)), bytes),

        getBytes: (hash: string) =>
          storage.getUint8Array(PathLayout.image.original(imagePathHash(hash))).pipe(Effect.map(O.fromUndefinedOr)),

        hasBytes: (hash: string) =>
          storage
            .getUint8Array(PathLayout.image.original(imagePathHash(hash)))
            .pipe(Effect.map((bytes) => bytes !== undefined)),

        putMetadata: Effect.fn(function* (asset: ImageAsset) {
          const json = yield* ImageAsset.encodeJsonStringEffect(asset);
          yield* storage.set(PathLayout.image.metadata(imagePathHash(asset.hash)), json);
        }),

        getMetadata: Effect.fn(function* (hash: string) {
          const content = yield* storage.get(PathLayout.image.metadata(imagePathHash(hash)));
          if (content === undefined) return Option.none();

          const asset = yield* ImageAsset.decodeJsonStringEffect(content);
          return Option.some(asset);
        }),

        putBytesWithMetadata: Effect.fn(function* (
          hash: string,
          bytes: Uint8Array,
          contentType: string,
          sourceUrl?: string
        ) {
          // Store bytes first
          const pathHash = imagePathHash(hash);
          yield* storage.set(PathLayout.image.original(pathHash), bytes);

          // Create metadata
          const asset = yield* ImageAsset.decodeUnknownEffect({
            hash,
            contentType,
            sizeBytes: bytes.length,
            storagePath: PathLayout.image.original(pathHash),
            ...(sourceUrl === undefined ? {} : { sourceUrl }),
            createdAt: DateTime.formatIso(yield* DateTime.now),
          });

          // Store metadata
          const json = yield* Schema.encodeEffect(Schema.fromJsonString(ImageAsset, { space: 2 }))(asset);
          yield* storage.set(PathLayout.image.metadata(pathHash), json);

          return asset;
        }),

        delete: (hash: string) =>
          Effect.all(
            [
              storage.remove(PathLayout.image.original(imagePathHash(hash))),
              storage.remove(PathLayout.image.metadata(imagePathHash(hash))),
              storage.remove(PathLayout.image.labels(imagePathHash(hash))),
            ],
            { discard: true }
          ),

        listHashes: Effect.gen(function* () {
          const paths = yield* storage.list("assets/images/");
          const hashes = MutableHashSet.empty<string>();
          for (const path of paths) {
            const match = Str.match(/^assets\/images\/([^/]+)\//)(path);
            if (Option.isSome(match) && match.value[1] !== undefined) {
              MutableHashSet.add(hashes, match.value[1]);
            }
          }
          return A.fromIterable(hashes);
        }),

        getSignedUrl: (hash: string, expiresInSeconds?: number) =>
          storage.getSignedUrl(PathLayout.image.original(imagePathHash(hash)), expiresInSeconds),

        supportsSignedUrls: storage.supportsSignedUrls,
      };
    }).pipe(Effect.withSpan("ImageBlobStore.Live"))
  );

  /**
   * Default layer with StorageService dependency
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default = ImageBlobStore.Live.pipe(Layer.provide(StorageServiceLive));
}
