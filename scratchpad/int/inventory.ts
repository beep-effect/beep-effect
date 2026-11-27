/**
 * The stored record of a listing: which posts a traversal found, how far it
 * got, why it stopped and which of their files are on disk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { dual, pipe } from "effect/Function"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import {
  type CollectionLocator,
  CollectionLocatorFromUrl,
  Cursor,
  MapFailure,
  MappedItem,
  type Page,
  type PostLocator
} from "./locator.ts"

const $I = $ScratchpadId.create("int/inventory")

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("Count", { description: "A whole number that is never negative." })
)

declare namespace Count {
  export type Encoded = number;
}

const counted = (description: string) =>
  Count.pipe(
    S.annotateKey({ description }),
    S.withDecodingDefaultTypeKey(Effect.succeed(0)),
    S.withConstructorDefault(Effect.succeed(0))
  )

const flagged = (description: string) =>
  S.Boolean.pipe(
    S.annotateKey({ description }),
    S.withDecodingDefaultTypeKey(Effect.succeed(false)),
    S.withConstructorDefault(Effect.succeed(false))
  )

/**
 * **Details**
 *
 * `ordinal` is the position of the media in its post, counted from zero in
 * the order the site shows the gallery, so a post of three pictures is fully
 * saved once ordinals 0, 1 and 2 are recorded.
 *
 * **Example** (Record a saved picture)
 *
 * ```ts import.meta.vitest name="Record a saved picture"
 * import { SavedFile } from "@beep/scratchpad/int/inventory"
 * import * as DateTime from "effect/DateTime"
 *
 * const file = SavedFile.make({
 *   ordinal: 0,
 *   path: "/media/redgifs/example/calmclip_0.mp4",
 *   bytes: 2048,
 *   savedAt: DateTime.makeUnsafe(0),
 * })
 * file.bytes // => 2048
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SavedFile extends S.Opaque<SavedFile, { readonly brand: unique symbol }>()(
  S.Struct({
    ordinal: Count.pipe(S.annotateKey({ description: "Position of the media in its post, from zero." })),
    path: S.NonEmptyString.pipe(S.annotateKey({ description: "Where the file was written." })),
    bytes: Count.pipe(S.annotateKey({ description: "Size of the file as written." })),
    savedAt: S.DateTimeUtcFromMillis.pipe(S.annotateKey({ description: "Instant the file was complete." }))
  }).pipe($I.annoteSchema("SavedFile", { description: "One media file of a post that is on disk." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SavedFile {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly ordinal: Count.Encoded;
    readonly path: string;
    readonly bytes: Count.Encoded;
    readonly savedAt: number;
  }
}

/**
 * **Example** (Count what is left to fetch)
 *
 * ```ts import.meta.vitest name="Count what is left to fetch"
 * import { Entry } from "@beep/scratchpad/int/inventory"
 * import { Locator, MappedItem, PostLocator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 *
 * const source = PostLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * )
 * const entry = Entry.make({ item: MappedItem.make({ source, images: 3, locked: 1 }) })
 * Entry.pending(entry) // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Entry extends S.Opaque<Entry, { readonly brand: unique symbol }>()(
  S.Struct({
    item: MappedItem,
    files: S.Array(SavedFile).pipe(
      S.annotateKey({ description: "Files of the post that are on disk." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    )
  }).pipe($I.annoteSchema("Entry", { description: "One mapped post and the files saved from it." }))
) {
  static readonly pending = ({ item, files }: Entry): number =>
    Num.max(0, MappedItem.fetchable(item) - A.length(files))
}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Entry {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly item: MappedItem.Encoded;
    readonly files?: ReadonlyArray<SavedFile.Encoded>;
  }
}

/**
 * **Example** (Name why a run stopped early)
 *
 * ```ts import.meta.vitest name="Name why a run stopped early"
 * import { Halt } from "@beep/scratchpad/int/inventory"
 *
 * Halt.is.idle("idle") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Halt = LiteralKit(["stopped", "idle", "deadline"]).pipe(
  $I.annoteSchema("Halt", {
    description:
      "Why a run ended while the site still had more: someone stopped it, the site went quiet, or the run used up its time."
  })
)

/**
 * @category type-level
 * @since 0.0.0
 */
export type Halt = typeof Halt.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Halt {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Halt.Encoded;
}

const StandingState = LiteralKit(["unmapped", "mapping", "complete", "partial", "failed"]).pipe(
  $I.annoteSchema("StandingState", { description: "Where a listing's record stands." })
)

class Unmapped extends S.Opaque<Unmapped, { readonly brand: unique symbol }>()(
  S.Struct({ state: S.tag("unmapped") }).pipe(
    $I.annoteSchema("Unmapped", { description: "No run has read the listing." })
  )
) {}

declare namespace Unmapped {
  export interface Encoded {
    readonly state: "unmapped";
  }
}

class Mapping extends S.Opaque<Mapping, { readonly brand: unique symbol }>()(
  S.Struct({
    state: S.tag("mapping"),
    startedAt: S.DateTimeUtcFromMillis,
    resumed: flagged("Whether the run continues an earlier one from its cursor."),
    placed: counted("Entries at the front of the record this run has put in listing order.")
  }).pipe($I.annoteSchema("Mapping", { description: "A run is reading the listing now." }))
) {}

declare namespace Mapping {
  export interface Encoded {
    readonly state: "mapping";
    readonly startedAt: number;
    readonly resumed?: boolean;
    readonly placed?: Count.Encoded;
  }
}

class Complete extends S.Opaque<Complete, { readonly brand: unique symbol }>()(
  S.Struct({
    state: S.tag("complete"),
    finishedAt: S.DateTimeUtcFromMillis,
    caughtUp: flagged("Whether the run ended on posts it already knew and not on the end of the listing.")
  }).pipe($I.annoteSchema("Complete", { description: "The record holds every post the listing shows." }))
) {}

declare namespace Complete {
  export interface Encoded {
    readonly state: "complete";
    readonly finishedAt: number;
    readonly caughtUp?: boolean;
  }
}

class Partial extends S.Opaque<Partial, { readonly brand: unique symbol }>()(
  S.Struct({ state: S.tag("partial"), finishedAt: S.DateTimeUtcFromMillis, halt: Halt }).pipe(
    $I.annoteSchema("Partial", { description: "A run ended while the site still had more to list." })
  )
) {}

declare namespace Partial {
  export interface Encoded {
    readonly state: "partial";
    readonly finishedAt: number;
    readonly halt: Halt.Encoded;
  }
}

class Failed extends S.Opaque<Failed, { readonly brand: unique symbol }>()(
  S.Struct({ state: S.tag("failed"), finishedAt: S.DateTimeUtcFromMillis, failure: MapFailure }).pipe(
    $I.annoteSchema("Failed", { description: "The site or the mapper ended the run, and `failure` says how." })
  )
) {}

declare namespace Failed {
  export interface Encoded {
    readonly state: "failed";
    readonly finishedAt: number;
    readonly failure: MapFailure.Encoded;
  }
}

/**
 * **Details**
 *
 * A run that fails keeps its failure as a value, so a reader branches on
 * `failure._tag` where it would otherwise have parsed a message. What the run
 * had stored before it failed stays in the record.
 *
 * **Example** (Branch on where a record stands)
 *
 * ```ts import.meta.vitest name="Branch on where a record stands"
 * import { Standing } from "@beep/scratchpad/int/inventory"
 * import { AuthRequired } from "@beep/scratchpad/int/locator"
 * import * as DateTime from "effect/DateTime"
 *
 * const standing = Standing.cases.failed.make({
 *   finishedAt: DateTime.makeUnsafe(0),
 *   failure: AuthRequired.make({ platform: "onlyfans" }),
 * })
 * const next = Standing.matchOrElse(standing, {
 *   failed: ({ failure }) => failure._tag,
 * }, () => "nothing to do")
 * next // => "AuthRequired"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Standing = StandingState.mapMembers(() => Tuple.make(Unmapped, Mapping, Complete, Partial, Failed)).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("Standing", {
    description: "Where a listing's record stands and how its last run ended, discriminated by `state`."
  })
)

/**
 * @category type-level
 * @since 0.0.0
 */
export type Standing = typeof Standing.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Standing {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = Unmapped.Encoded | Mapping.Encoded | Complete.Encoded | Partial.Encoded | Failed.Encoded;
}

const unmapped = Effect.sync(() => Standing.cases.unmapped.make({}))

const indexed = (entries: ReadonlyArray<Entry>): HashMap.HashMap<PostLocator, Entry> =>
  HashMap.fromIterable(A.map(entries, (entry) => Tuple.make(entry.item.source, entry)))

const holds =
  <V>(index: HashMap.HashMap<PostLocator, V>) =>
  ({ item }: Entry): boolean =>
    HashMap.has(index, item.source)

const refreshed =
  (incoming: HashMap.HashMap<PostLocator, MappedItem>) =>
  (entry: Entry): Entry =>
    pipe(
      HashMap.get(incoming, entry.item.source),
      O.map((item) => Entry.make({ item, files: entry.files })),
      O.getOrElse(() => entry)
    )

const placing = (entries: ReadonlyArray<Entry>, page: Page, run: Mapping): readonly [ReadonlyArray<Entry>, number] => {
  const incoming = HashMap.fromIterable(A.map(page.items, (item) => Tuple.make(item.source, item)))
  const order = A.dedupe(A.map(page.items, ({ source }) => source))
  const [head, rest] = A.splitAt(entries, run.placed)
  const before = indexed(rest)
  const settled = indexed(head)
  const fresh = A.getSomes(
    A.map(order, (source) =>
    HashMap.has(settled, source)
      ? O.none()
      : O.map(HashMap.get(incoming, source), (item) =>
          Entry.make({
            item,
            files: pipe(
              HashMap.get(before, source),
              O.map(({ files }) => files),
              O.getOrElse(() => A.empty<SavedFile>())
            )
          })
        )
    )
  )
  const kept = A.map(head, refreshed(incoming))
  return run.resumed
    ? [
        A.appendAll(A.appendAll(kept, A.map(rest, refreshed(incoming))), A.filter(fresh, (entry) => !holds(before)(entry))),
        run.placed
      ]
    : [
        A.appendAll(A.appendAll(kept, fresh), A.filter(rest, (entry) => !holds(incoming)(entry))),
        run.placed + A.length(fresh)
      ]
}

/**
 * **Details**
 *
 * The record is the only thing a run writes, once per page, and it never
 * holds a media URL. Order is the listing's: a run from the top puts what it
 * sees first and leaves older posts behind it, a resumed run appends. A post
 * the site no longer lists stays, with its saved files, because a listing
 * that shrinks is not a reason to forget what was fetched.
 *
 * **Example** (Store a page of a run)
 *
 * ```ts import.meta.vitest name="Store a page of a run"
 * import { Inventory } from "@beep/scratchpad/int/inventory"
 * import {
 *   CollectionLocator, Locator, MappedItem, Page, PostLocator, RedGifsTarget
 * } from "@beep/scratchpad/int/locator"
 * import * as A from "effect/Array"
 * import * as DateTime from "effect/DateTime"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * const clip = PostLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id: "calmclip" }) })
 * )
 * const stored = Inventory.empty(source).pipe(
 *   Inventory.begin(DateTime.makeUnsafe(0), false),
 *   Inventory.absorb(Page.of(MappedItem.make({ source: clip, videos: 1 })))
 * )
 * A.length(stored.entries) // => 1
 * stored.pages // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Inventory extends S.Opaque<Inventory, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CollectionLocatorFromUrl,
    standing: Standing.pipe(
      S.annotateKey({ description: "Where the record stands and how its last run ended." }),
      S.withDecodingDefaultTypeKey(unmapped),
      S.withConstructorDefault(unmapped)
    ),
    entries: S.Array(Entry).pipe(
      S.annotateKey({ description: "Mapped posts in the order the site lists them." }),
      S.withDecodingDefaultTypeKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    cursor: Cursor.pipe(
      S.annotateKey({ description: "Where the next run resumes, when the site handed out a token." }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    pages: counted("Pages the runs of this record have stored.")
  }).pipe($I.annoteSchema("Inventory", { description: "What is known of one listing and of the files saved from it." }))
) {
  static readonly empty = (source: CollectionLocator): Inventory => Inventory.make({ source })

  static readonly known = ({ entries }: Inventory): HashSet.HashSet<PostLocator> =>
    HashSet.fromIterable(A.map(entries, ({ item }) => item.source))

  static readonly pending = ({ entries }: Inventory): ReadonlyArray<Entry> =>
    A.filter(entries, (entry) => Entry.pending(entry) > 0)

  static readonly mapping = ({ standing }: Inventory): boolean => Standing.guards.mapping(standing)

  static readonly begin: {
    (startedAt: DateTime.Utc, resumed: boolean): (self: Inventory) => Inventory;
    (self: Inventory, startedAt: DateTime.Utc, resumed: boolean): Inventory;
  } = dual(
    3,
    (self: Inventory, startedAt: DateTime.Utc, resumed: boolean): Inventory =>
      Inventory.make({
        source: self.source,
        standing: Standing.cases.mapping.make({ startedAt, resumed }),
        entries: self.entries,
        cursor: resumed ? self.cursor : O.none(),
        pages: resumed ? self.pages : 0
      })
  )

  static readonly absorb: {
    (page: Page): (self: Inventory) => Inventory;
    (self: Inventory, page: Page): Inventory;
  } = dual(
    2,
    (self: Inventory, page: Page): Inventory =>
      pipe(
        O.liftPredicate(self.standing, Standing.guards.mapping),
        O.map((run) => {
          const [entries, placed] = placing(self.entries, page, run)
          return Inventory.make({
            source: self.source,
            standing: Standing.cases.mapping.make({ startedAt: run.startedAt, resumed: run.resumed, placed }),
            entries,
            cursor: page.aside ? self.cursor : page.next,
            pages: self.pages + 1
          })
        }),
        O.getOrElse(() => self)
      )
  )

  static readonly settle: {
    (standing: Standing): (self: Inventory) => Inventory;
    (self: Inventory, standing: Standing): Inventory;
  } = dual(
    2,
    (self: Inventory, standing: Standing): Inventory =>
      Inventory.make({
        source: self.source,
        standing,
        entries: self.entries,
        cursor: Standing.guards.complete(standing) ? O.none() : self.cursor,
        pages: self.pages
      })
  )

  static readonly record: {
    (post: PostLocator, file: SavedFile): (self: Inventory) => Inventory;
    (self: Inventory, post: PostLocator, file: SavedFile): Inventory;
  } = dual(
    3,
    (self: Inventory, post: PostLocator, file: SavedFile): Inventory =>
      Inventory.make({
        source: self.source,
        standing: self.standing,
        entries: A.map(self.entries, (entry) =>
          sameSource(entry.item.source, post)
            ? Entry.make({
                item: entry.item,
                files: A.append(
                  A.filter(entry.files, ({ ordinal }) => ordinal !== file.ordinal),
                  file
                )
              })
            : entry
        ),
        cursor: self.cursor,
        pages: self.pages
      })
  )
}

const sameSource = S.toEquivalence(MappedItem.fields.source)

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Inventory {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly source: CollectionLocatorFromUrl.Encoded;
    readonly standing?: Standing.Encoded;
    readonly entries?: ReadonlyArray<Entry.Encoded>;
    readonly cursor?: Cursor.Encoded;
    readonly pages?: Count.Encoded;
  }
}

/**
 * Advances the count of already-known posts a run has met in a row.
 *
 * **Details**
 *
 * A run that only wants what is new stops once this count reaches its
 * threshold. A pinned post and a side-list page leave the count as it was:
 * they are shown out of order, so meeting a known one says nothing about how
 * far down the timeline the run is. A post the record does not hold resets
 * the count.
 *
 * **Example** (Count a run of known posts)
 *
 * ```ts import.meta.vitest name="Count a run of known posts"
 * import { knownRun } from "@beep/scratchpad/int/inventory"
 * import { Locator, MappedItem, Page, PostLocator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import * as HashSet from "effect/HashSet"
 *
 * const post = (id: string) =>
 *   PostLocator.make(Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id }) }))
 * const page = Page.make({
 *   items: [MappedItem.make({ source: post("newclip") }), MappedItem.make({ source: post("calmclip") })],
 * })
 * knownRun(HashSet.make(post("calmclip")))(4, page) // => 1
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const knownRun =
  (known: HashSet.HashSet<PostLocator>) =>
  (run: number, page: Page): number =>
    page.aside
      ? run
      : A.reduce(page.items, run, (count, { pinned, source }) =>
          pinned ? count : HashSet.has(known, source) ? count + 1 : 0
        )
