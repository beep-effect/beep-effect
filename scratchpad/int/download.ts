/**
 * Saves the media of mapped posts to disk and records each file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as HttpClient from "effect/http/HttpClient"
import * as Layer from "effect/Layer"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import * as S from "effect/Schema"
import * as Stream from "effect/Stream"
import { fetchable, handleOf, type Media, type Post, type Rendition } from "./content.ts"
import { Entry, Inventory, SavedFile } from "./inventory.ts"
import { Library } from "./library.ts"
import {
  type CollectionLocator,
  type MapFailure,
  type PostLocator,
  PostLocatorFromUrl,
  Unavailable
} from "./locator.ts"
import { posts, type Readers } from "./reader.ts"
import type { StoreFailed } from "./store.ts"

const $I = $ScratchpadId.create("int/download")

/**
 * **Example** (Report a file that would not save)
 *
 * ```ts import.meta.vitest name="Report a file that would not save"
 * import { DownloadFailed } from "@beep/scratchpad/int/download"
 * import { Locator, PostLocator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 *
 * const post = PostLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * )
 * const outcome = Effect.fail(DownloadFailed.make({ post, detail: "disk full" })).pipe(
 *   Effect.catchTag("DownloadFailed", ({ detail }) => Effect.succeed(detail))
 * )
 * Effect.runSync(outcome) // => "disk full"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DownloadFailed extends S.TaggedError<DownloadFailed, { readonly brand: unique symbol }>(
  $I`DownloadFailed`
)(
  "DownloadFailed",
  { post: PostLocatorFromUrl, detail: S.String },
  $I.annoteError<DownloadFailed>("DownloadFailed", {
    description: "A media file of a post could not be fetched or written."
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DownloadFailed {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "DownloadFailed";
    readonly post: PostLocatorFromUrl.Encoded;
    readonly detail: string;
  }
}

const widest = Order.mapInput(Order.flip(Num.Order), ({ width }: Rendition) => O.getOrElse(width, () => 0))

const best = (media: Media) => A.head(A.sort(fetchable(media), widest))

/**
 * Saves the media of mapped posts.
 *
 * **Details**
 *
 * A post is read again before its files are fetched, because the addresses
 * a paid site signs stop working within hours; nothing an inventory stores
 * can be used to download later. Each file is written beside its final
 * name and renamed once complete, then recorded in the inventory, so an
 * interrupted download leaves no file that looks finished. `post` saves one
 * post and `pending` every post of a listing that still lacks files, one at
 * a time.
 *
 * **Example** (Save everything a listing still lacks)
 *
 * ```ts import.meta.vitest name="Save everything a listing still lacks"
 * import { Downloads } from "@beep/scratchpad/int/download"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * const saved = Downloads.use((downloads) => downloads.pending(source))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Downloads extends Context.Service<
  Downloads,
  {
    readonly post: (
      source: CollectionLocator,
      post: PostLocator
    ) => Effect.Effect<ReadonlyArray<SavedFile>, DownloadFailed | MapFailure | StoreFailed>;
    readonly pending: (
      source: CollectionLocator
    ) => Effect.Effect<ReadonlyArray<SavedFile>, DownloadFailed | MapFailure | StoreFailed>;
  }
>()($I`Downloads`) {
  static readonly layer = (
    root: string
  ): Layer.Layer<Downloads, never, Library | Readers | HttpClient.HttpClient | FileSystem.FileSystem | Path.Path> =>
    Layer.effect(
      Downloads,
      Effect.gen(function* () {
        const library = yield* Library
        const readers = yield* Effect.context<Readers>()
        const client = yield* HttpClient.HttpClient
        const http = HttpClient.filterStatusOk(client)
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const save = Effect.fn("Downloads.save")(function* (found: Post, ordinal: number, { url }: Rendition) {
          const directory = path.join(root, found.source.platform, O.getOrElse(handleOf(found.author), () => "unknown"))
          const name = `${O.getOrElse(found.id, () => "post")}_${ordinal}${path.extname(url.pathname)}`
          const target = path.join(directory, name)
          const written = yield* Ref.make(0)
          const referer = yield* S.encodeEffect(PostLocatorFromUrl)(found.source)
          yield* fs.makeDirectory(directory, { recursive: true })
          const response = yield* http.get(url, { headers: { referer } })
          yield* response.stream.pipe(
            Stream.tap((chunk) => Ref.update(written, Num.sum(chunk.length))),
            Stream.run(fs.sink(`${target}.part`))
          )
          yield* fs.rename(`${target}.part`, target)
          const bytes = yield* Ref.get(written)
          const savedAt = yield* DateTime.now
          return SavedFile.make({ ordinal, path: target, bytes, savedAt })
        })

        const post = Effect.fn("Downloads.post")(function* (source: CollectionLocator, locator: PostLocator) {
          const read = yield* posts(locator).pipe(Stream.runHead, Effect.provide(readers))
          const found = yield* Effect.mapError(Effect.fromOption(read), () =>
            Unavailable.make({ platform: locator.platform, reason: "missing" })
          )
          const wanted = A.getSomes(
            A.map(found.media, (media, ordinal) => O.map(best(media), (rendition) => [ordinal, rendition] as const))
          )
          return yield* Effect.forEach(
            wanted,
            ([ordinal, rendition]) =>
              save(found, ordinal, rendition).pipe(
                Effect.mapError(({ message }) => DownloadFailed.make({ post: locator, detail: message })),
                Effect.tap((file) => library.record(source, locator, file))
              ),
            { concurrency: 1 }
          )
        })

        return {
          post,
          pending: Effect.fn("Downloads.pending")(function* (source: CollectionLocator) {
            const inventory = yield* library.get(source)
            const saved = yield* Effect.forEach(
              Inventory.pending(inventory),
              ({ item }: Entry) => post(source, item.source),
              { concurrency: 1 }
            )
            return A.flatten(saved)
          })
        }
      })
    )
}
