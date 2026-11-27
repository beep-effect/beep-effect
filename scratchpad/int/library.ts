/**
 * The mapped listings a user keeps: start a run, watch it, stop it, and read
 * what it stored.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import { flow } from "effect/Function"
import * as FiberMap from "effect/FiberMap"
import * as Layer from "effect/Layer"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as PubSub from "effect/PubSub"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as S from "effect/Schema"
import * as Semaphore from "effect/Semaphore"
import * as Stream from "effect/Stream"
import * as Tuple from "effect/Tuple"
import { Halt, Inventory, knownRun, type SavedFile, Standing } from "./inventory.ts"
import {
  type CollectionLocator,
  CollectionLocatorFromUrl,
  type Cursor,
  Locator,
  type MapFailure,
  MapperFailed,
  type Page,
  Platform,
  type PostLocator
} from "./locator.ts"
import { type Mappers, pages } from "./mapper.ts"
import { Inventories, type StoreFailed } from "./store.ts"

const $I = $ScratchpadId.create("int/library")

/**
 * **Details**
 *
 * `fresh` reads the listing from the top to its end. `incremental` reads
 * from the top until it meets posts the record already holds, and counts
 * only when the record is complete: anything less has gaps a short run would
 * leave open. `resume` continues a partial record from its cursor, where the
 * site handed one out. A mode whose condition does not hold runs as `fresh`.
 *
 * **Example** (Pick how much of a listing to read)
 *
 * ```ts import.meta.vitest name="Pick how much of a listing to read"
 * import { MapMode } from "@beep/scratchpad/int/library"
 *
 * MapMode.is.incremental("incremental") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MapMode = LiteralKit(["fresh", "incremental", "resume"]).pipe(
  $I.annoteSchema("MapMode", { description: "How much of a listing a run reads." })
)

/**
 * @category type-level
 * @since 0.0.0
 */
export type MapMode = typeof MapMode.Type;

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MapMode {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MapMode.Encoded;
}

/**
 * **Example** (Wait for a run that is in the way)
 *
 * ```ts import.meta.vitest name="Wait for a run that is in the way"
 * import { Busy } from "@beep/scratchpad/int/library"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * const outcome = Effect.fail(Busy.make({ source })).pipe(
 *   Effect.catchTag("Busy", ({ source }) => Effect.succeed(source.platform))
 * )
 * Effect.runSync(outcome) // => "redgifs"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class Busy extends S.TaggedError<Busy, { readonly brand: unique symbol }>($I`Busy`)(
  "Busy",
  { source: CollectionLocatorFromUrl },
  $I.annoteError<Busy>("Busy", { description: "A run is already reading this listing." })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Busy {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "Busy";
    readonly source: CollectionLocatorFromUrl.Encoded;
  }
}

class Halted extends S.TaggedError<Halted, { readonly brand: unique symbol }>($I`Halted`)(
  "Halted",
  { halt: Halt },
  $I.annoteError<Halted>("Halted", { description: "A run gave up before the listing ended." })
) {}

/**
 * **Details**
 *
 * `caughtUpAfter` is the run of already-known posts that ends an incremental
 * run. `idle` is how long a site may stay silent and `deadline` how long a
 * run may take; passing either leaves the record partial, with what was read.
 *
 * **Example** (Keep the defaults and shorten the deadline)
 *
 * ```ts import.meta.vitest name="Keep the defaults and shorten the deadline"
 * import { Limits } from "@beep/scratchpad/int/library"
 * import * as Duration from "effect/Duration"
 *
 * const limits = Limits.make({ deadline: Duration.minutes(10) })
 * limits.caughtUpAfter // => 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Limits extends S.Opaque<Limits, { readonly brand: unique symbol }>()(
  S.Struct({
    caughtUpAfter: S.Int.check(S.isGreaterThan(0)).pipe(
      S.annotateKey({ description: "Known posts in a row that end an incremental run." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(12)),
      S.withConstructorDefault(Effect.succeed(12))
    ),
    idle: S.DurationFromMillis.pipe(
      S.annotateKey({ description: "Longest silence of a site before a run gives up." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.minutes(8))),
      S.withConstructorDefault(Effect.succeed(Duration.minutes(8)))
    ),
    deadline: S.DurationFromMillis.pipe(
      S.annotateKey({ description: "Longest a run may take." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(Duration.hours(2))),
      S.withConstructorDefault(Effect.succeed(Duration.hours(2)))
    )
  }).pipe($I.annoteSchema("Limits", { description: "When a run stops on its own." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Limits {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly caughtUpAfter?: number;
    readonly idle?: number;
    readonly deadline?: number;
  }
}

const sameSource = S.toEquivalence(Locator)

const recovered = (inventory: Inventory, now: DateTime.Utc): Inventory =>
  Inventory.mapping(inventory)
    ? Inventory.settle(inventory, Standing.cases.partial.make({ finishedAt: now, halt: "stopped" }))
    : inventory

/**
 * The mapped listings a user keeps, and the runs that fill them.
 *
 * **Details**
 *
 * `map` starts a run and returns at once with the record as the run begins;
 * `watch` follows it page by page and ends when the run does. A run belongs
 * to the library and not to its caller, so it survives the caller going
 * away and `stop` can end it from anywhere. One run reads a listing at a
 * time, and one run reads a platform at a time, so a second listing of the
 * same site waits its turn. Every way a run can end is stored as the
 * record's {@link Standing}: nothing is reported only in a log.
 *
 * **Gotchas**
 *
 * A record found in the `mapping` state when it is first loaded belonged to a
 * process that died. It reads as `partial`, stopped, and is not rewritten
 * until something changes it.
 *
 * **Example** (Map a listing and wait for the run)
 *
 * ```ts import.meta.vitest name="Map a listing and wait for the run"
 * import { Library } from "@beep/scratchpad/int/library"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@beep/scratchpad/int/locator"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * const mapped = Effect.gen(function* () {
 *   const library = yield* Library
 *   yield* library.map(source, "fresh")
 *   return yield* Stream.runLast(library.watch(source))
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Library extends Context.Service<
  Library,
  {
    readonly get: (source: CollectionLocator) => Effect.Effect<Inventory, StoreFailed>;
    readonly list: Effect.Effect<ReadonlyArray<Inventory>, StoreFailed>;
    readonly map: (source: CollectionLocator, mode: MapMode) => Effect.Effect<Inventory, Busy | StoreFailed>;
    readonly watch: (source: CollectionLocator) => Stream.Stream<Inventory, StoreFailed>;
    readonly stop: (source: CollectionLocator) => Effect.Effect<Inventory, StoreFailed>;
    readonly forget: (source: CollectionLocator) => Effect.Effect<void, Busy | StoreFailed>;
    readonly record: (
      source: CollectionLocator,
      post: PostLocator,
      file: SavedFile
    ) => Effect.Effect<Inventory, StoreFailed>;
  }
>()($I`Library`) {
  static readonly layer = (limits: Limits = Limits.make({})): Layer.Layer<Library, never, Inventories | Mappers> =>
    Layer.effect(
      Library,
      Effect.gen(function* () {
        const store = yield* Inventories
        const mappers = yield* Effect.context<Mappers>()
        const runs = yield* FiberMap.make<CollectionLocator, void>()
        const changes = yield* PubSub.unbounded<Inventory>()
        const loaded = MutableHashMap.empty<CollectionLocator, Inventory>()
        const turn = Semaphore.makeUnsafe(1)
        const gates = R.map(Platform.Enum, () => Semaphore.makeUnsafe(1))

        const load = Effect.fn("Library.load")(function* (source: CollectionLocator) {
          const held = MutableHashMap.get(loaded, source)
          if (O.isSome(held)) {
            return held.value
          }
          const now = yield* DateTime.now
          const stored = yield* store.get(source)
          const inventory = recovered(
            O.getOrElse(stored, () => Inventory.empty(source)),
            now
          )
          MutableHashMap.set(loaded, source, inventory)
          return inventory
        })

        const commit = Effect.fn("Library.commit")(function* (inventory: Inventory) {
          yield* store.put(inventory)
          MutableHashMap.set(loaded, inventory.source, inventory)
          yield* PubSub.publish(changes, inventory)
          return inventory
        })

        const amend = (source: CollectionLocator, change: (inventory: Inventory) => Inventory) =>
          load(source).pipe(Effect.map(change), Effect.flatMap(commit), Semaphore.withPermit(turn))

        const settle = (source: CollectionLocator, standing: (finishedAt: DateTime.Utc) => Standing) =>
          DateTime.now.pipe(
            Effect.flatMap((finishedAt) => amend(source, Inventory.settle(standing(finishedAt)))),
            Effect.ignore
          )

        const halt = (source: CollectionLocator) =>
          DateTime.now.pipe(
            Effect.flatMap((finishedAt) =>
              amend(source, (inventory) =>
                Inventory.mapping(inventory)
                  ? Inventory.settle(inventory, Standing.cases.partial.make({ finishedAt, halt: "stopped" }))
                  : inventory
              )
            ),
            Effect.ignore
          )

        const idle = Effect.fn("Library.idle")(function* (source: CollectionLocator) {
          const run = yield* FiberMap.get(runs, source)
          yield* O.match(run, { onNone: () => Effect.void, onSome: Fiber.await })
        })

        const drive = Effect.fn("Library.drive")(function* (
          source: CollectionLocator,
          from: O.Option<Cursor>,
          known: O.Option<(run: number, page: Page) => number>
        ) {
          const caughtUp = yield* Ref.make(false)
          const failed = (failure: MapFailure) => (finishedAt: DateTime.Utc) =>
            Standing.cases.failed.make({ finishedAt, failure })
          const broken = (detail: string) => failed(MapperFailed.make({ platform: source.platform, detail }))
          yield* pages(source, from).pipe(
            Stream.mapAccum(
              () => 0,
              (run, page) => {
                const next = O.match(known, { onNone: () => 0, onSome: (advance) => advance(run, page) })
                return Tuple.make(next, A.of(Tuple.make(page, next >= limits.caughtUpAfter)))
              }
            ),
            Stream.takeUntil(([, done]) => done),
            Stream.timeoutOrElse({
              duration: limits.idle,
              orElse: () => Stream.fail(Halted.make({ halt: "idle" }))
            }),
            Stream.runForEach(([page, done]) =>
              amend(source, Inventory.absorb(page)).pipe(Effect.andThen(Ref.set(caughtUp, done)))
            ),
            Effect.timeoutOrElse({
              duration: limits.deadline,
              orElse: () => Effect.fail(Halted.make({ halt: "deadline" }))
            }),
            Semaphore.withPermit(gates[source.platform]),
            Effect.provide(mappers),
            Effect.andThen(Ref.get(caughtUp)),
            Effect.map(
              (ended) => (finishedAt: DateTime.Utc) => Standing.cases.complete.make({ finishedAt, caughtUp: ended })
            ),
            Effect.catchTags({
              Halted:
                ({ halt }) =>
                  Effect.succeed((finishedAt: DateTime.Utc) => Standing.cases.partial.make({ finishedAt, halt })),
              StoreFailed: ({ detail }) => Effect.succeed(broken(detail))
            }),
            Effect.catch(flow(failed, Effect.succeed)),
            Effect.catchCauseIf(P.not(Cause.hasInterruptsOnly), flow(Cause.pretty, broken, Effect.succeed)),
            Effect.flatMap((standing) => settle(source, standing)),
            Effect.onInterrupt(() => halt(source))
          )
        })

        const get = (source: CollectionLocator) => load(source).pipe(Semaphore.withPermit(turn))

        return {
          get,
          list: store.list.pipe(
            Effect.flatMap(Effect.forEach(({ source }) => get(source), { concurrency: 1 })),
            Effect.withSpan("Library.list")
          ),
          map: Effect.fn("Library.map")(
            function* (source: CollectionLocator, mode: MapMode) {
              const current = yield* load(source)
              if (Inventory.mapping(current)) {
                return yield* Busy.make({ source })
              }
              yield* idle(source)
              const resumed = MapMode.is.resume(mode) && Standing.guards.partial(current.standing) && O.isSome(current.cursor)
              const known =
                MapMode.is.incremental(mode) && Standing.guards.complete(current.standing)
                  ? Inventory.known(current).pipe(knownRun, O.some)
                  : O.none()
              const startedAt = yield* DateTime.now
              const begun = yield* commit(Inventory.begin(current, startedAt, resumed))
              yield* FiberMap.run(runs, source, drive(source, resumed ? current.cursor : O.none(), known))
              return begun
            },
            Semaphore.withPermit(turn)
          ),
          watch: (source) =>
            Stream.unwrap(
              Effect.gen(function* () {
                const subscription = yield* PubSub.subscribe(changes)
                const current = yield* get(source)
                return Stream.make(current).pipe(
                  Stream.concat(
                    Stream.fromSubscription(subscription).pipe(
                      Stream.filter((inventory) => sameSource(inventory.source, source))
                    )
                  ),
                  Stream.takeUntil((inventory) => !Inventory.mapping(inventory))
                )
              })
            ),
          stop: Effect.fn("Library.stop")(function* (source: CollectionLocator) {
            const run = yield* FiberMap.get(runs, source)
            yield* O.match(run, { onNone: () => Effect.void, onSome: Fiber.interrupt })
            return yield* get(source)
          }),
          forget: Effect.fn("Library.forget")(
            function* (source: CollectionLocator) {
              const current = yield* load(source)
              if (Inventory.mapping(current)) {
                return yield* Busy.make({ source })
              }
              yield* idle(source)
              yield* store.remove(source)
              MutableHashMap.remove(loaded, source)
            },
            Semaphore.withPermit(turn)
          ),
          record: Effect.fn("Library.record")((source: CollectionLocator, post: PostLocator, file: SavedFile) =>
            amend(source, Inventory.record(post, file))
          )
        }
      })
    )
}
