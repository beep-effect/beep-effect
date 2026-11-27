/**
 * Where inventories are kept between runs of the program.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as S from "effect/Schema";
import { Inventory } from "./inventory.ts";
import { CollectionLocatorFromUrl } from "./locator.ts";
import type * as O from "effect/Option";
import type { CollectionLocator } from "./locator.ts";

const $I = $SocialMapperId.create("core/store");

/**
 * **Example** (Recover from a store that cannot be read)
 *
 * ```ts import.meta.vitest name="Recover from a store that cannot be read"
 * import { StoreFailed } from "@/core/store"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = Effect.fail(StoreFailed.make({ detail: "disk full" })).pipe(
 *   Effect.catchTag("StoreFailed", ({ detail }) => Effect.succeed(detail))
 * )
 * Effect.runSync(outcome) // => "disk full"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StoreFailed extends S.TaggedError<StoreFailed, { readonly brand: unique symbol }>($I`StoreFailed`)(
  "StoreFailed",
  { detail: S.String },
  $I.annoteError<StoreFailed>("StoreFailed", {
    description: "An inventory could not be read from or written to its store.",
  })
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StoreFailed {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "StoreFailed";
    readonly detail: string;
  }
}

const failed = ({ message }: { readonly message: string }) => StoreFailed.make({ detail: message });

const keyOf = (source: CollectionLocator) => S.encodeEffect(CollectionLocatorFromUrl)(source);

/**
 * Keeps one {@link Inventory} for each listing, under the listing's canonical
 * URL.
 *
 * **Details**
 *
 * The key is the URL a locator prints, so two spellings of one profile share
 * a record and no second identifier scheme exists. {@link Inventories.layer}
 * takes over the whole key-value store it is given: hand it a store, or a
 * prefix of one, that holds nothing else.
 *
 * **Example** (Keep an inventory in memory)
 *
 * ```ts import.meta.vitest name="Keep an inventory in memory"
 * import { Inventory } from "@/core/inventory"
 * import { CollectionLocator, Locator, RedGifsTarget } from "@/core/locator"
 * import { Inventories } from "@/core/store"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as KeyValueStore from "effect/persistence/KeyValueStore"
 *
 * const source = CollectionLocator.make(
 *   Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
 * )
 * const kept = Effect.gen(function* () {
 *   const store = yield* Inventories
 *   yield* store.put(Inventory.empty(source))
 *   return yield* store.list
 * }).pipe(Effect.provide(Inventories.layer.pipe(Layer.provide(KeyValueStore.layerMemory))))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Inventories extends Context.Service<
  Inventories,
  {
    readonly get: (source: CollectionLocator) => Effect.Effect<O.Option<Inventory>, StoreFailed>;
    readonly put: (inventory: Inventory) => Effect.Effect<void, StoreFailed>;
    readonly remove: (source: CollectionLocator) => Effect.Effect<void, StoreFailed>;
    readonly list: Effect.Effect<ReadonlyArray<Inventory>, StoreFailed>;
  }
>()($I`Inventories`) {
  static readonly layer: Layer.Layer<Inventories, never, KeyValueStore.KeyValueStore> = Layer.effect(
    Inventories,
    Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore;
      const records = KeyValueStore.toSchemaStore(kv, Inventory);
      return {
        get: Effect.fn("Inventories.get")(function* (source: CollectionLocator) {
          const key = yield* keyOf(source);
          return yield* records.get(key);
        }, Effect.mapError(failed)),
        put: Effect.fn("Inventories.put")(function* (inventory: Inventory) {
          const key = yield* keyOf(inventory.source);
          yield* records.set(key, inventory);
        }, Effect.mapError(failed)),
        remove: Effect.fn("Inventories.remove")(function* (source: CollectionLocator) {
          const key = yield* keyOf(source);
          yield* records.remove(key);
        }, Effect.mapError(failed)),
        list: records.keys.pipe(
          Effect.flatMap(Effect.forEach((key) => records.get(key), { concurrency: 1 })),
          Effect.mapBoth({ onSuccess: A.getSomes, onFailure: failed }),
          Effect.withSpan("Inventories.list")
        ),
      };
    })
  );
}
