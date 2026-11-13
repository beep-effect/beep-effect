import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";

/**
 * Where an inbox keeps what it handled: one checkpoint per producer (the
 * last position read) and the keys of the facts it acted on. The inbox owns
 * it; the producer never sees it.
 *
 * @category ports
 * @since 0.0.0
 */
export class InboxStore extends Context.Service<
  InboxStore,
  {
    /** The last position handled for this producer, 0 before the first. */
    readonly checkpoint: (producer: string) => Effect.Effect<number>;
    /** Whether a fact with this inbox key was acted on. */
    readonly seen: (key: string) => Effect.Effect<boolean>;
    /** Record the fact acted on and move the checkpoint, in one write. */
    readonly commit: (producer: string, key: O.Option<string>, seq: number) => Effect.Effect<void>;
  }
>()("Runs/InboxStore") {}

/**
 * The inbox store in memory: a fresh, empty store each time the Layer is
 * built.
 *
 * **Example** (A test's store)
 * ```ts
 * import { MemoryInboxStore } from "@proto/runs-host/Inbox/Inbox.store";
 * import * as Layer from "effect/Layer";
 *
 * const store = Layer.fresh(MemoryInboxStore);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MemoryInboxStore = Layer.effect(
  InboxStore,
  Effect.map(
    Ref.make({ checkpoints: HashMap.empty<string, number>(), seen: HashSet.empty<string>() }),
    (table) => ({
      checkpoint: (producer) =>
        Effect.map(Ref.get(table), ({ checkpoints }) => O.getOrElse(HashMap.get(checkpoints, producer), () => 0)),
      seen: (key) => Effect.map(Ref.get(table), ({ seen }) => HashSet.has(seen, key)),
      commit: (producer, key, seq) =>
        Ref.update(table, ({ checkpoints, seen }) => ({
          checkpoints: HashMap.set(checkpoints, producer, seq),
          seen: O.match(key, { onNone: () => seen, onSome: (handled) => pipe(seen, HashSet.add(handled)) }),
        })),
    }),
  ),
);
