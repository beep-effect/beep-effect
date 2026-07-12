/**
 * Shared in-memory scaffolding for the Sync entity repository adapters.
 *
 * @remarks
 * The four Sync entity repositories (`SyncItem`, `SyncOperation`, `SyncCursor`,
 * `SyncConflict`) each back their deterministic in-memory adapter with the same
 * `Ref<HashMap>` store, monotonic id counter, live snapshot, and
 * application-write audit stamp. This module owns that scaffolding so the
 * adapters stay behavior-identical without repeating it. It is private to
 * `@beep/documents-server` (not re-exported from any barrel and excluded from
 * docgen).
 *
 * @packageDocumentation
 * @internal
 * @category repositories
 * @since 0.0.0
 */

import { A, N } from "@beep/utils";
import { Effect, HashMap, Order, Ref } from "effect";

/**
 * System-principal audit stamp for rows the repository writes on the
 * application's behalf (there is no acting user for a runtime-initiated sync).
 *
 * @example
 * ```ts
 * import { SYSTEM_PRINCIPAL } from "@beep/documents-server/entities/internal/RepoSupport"
 *
 * console.log(SYSTEM_PRINCIPAL.kind) // "System"
 * ```
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;

/**
 * Next monotonic entity id: one past the maximum id already present, matching
 * the sequence-shaped ids the persisted tables allocate.
 *
 * @example
 * ```ts
 * import { nextEntityId } from "@beep/documents-server/entities/internal/RepoSupport"
 *
 * console.log(nextEntityId([{ id: 1 }, { id: 4 }])) // 5
 * console.log(nextEntityId([])) // 1
 * ```
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const nextEntityId = (rows: ReadonlyArray<{ readonly id: number }>): number =>
  A.reduce(rows, 0, (max, row) => N.max(max, row.id)) + 1;

/**
 * Ascending `Order` over any id-bearing entity, so listings are stable in
 * enqueue/creation order (ascending id equals insertion order in these stores).
 *
 * @example
 * ```ts
 * import { byIdAscending } from "@beep/documents-server/entities/internal/RepoSupport"
 * import * as A from "effect/Array"
 *
 * const sorted = A.sort([{ id: 3 }, { id: 1 }], byIdAscending<{ readonly id: number }>())
 * console.log(A.map(sorted, (row) => row.id)) // [1, 3]
 * ```
 *
 * @typeParam T - the id-bearing entity the resulting order compares
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const byIdAscending = <T extends { readonly id: number }>(): Order.Order<T> =>
  Order.mapInput(Order.Number, (entity: T) => entity.id);

/**
 * Allocate an in-memory entity store from an initial (typically empty) map: a
 * `Ref<HashMap>` keyed by id, an id counter seeded at `1`, and a `snapshot`
 * effect that materializes the current values as an array. The initial map
 * carries the `Id`/`T` types so callers pass `HashMap.empty<Id, T>()`.
 *
 * @example
 * ```ts
 * import { makeEntityStore } from "@beep/documents-server/entities/internal/RepoSupport"
 * import { Effect, HashMap } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const { snapshot } = yield* makeEntityStore(HashMap.empty<number, { readonly id: number }>())
 *   return yield* snapshot
 * })
 * console.log(Effect.runSync(program)) // []
 * ```
 *
 * @typeParam Id - the entity id used as the store's `HashMap` key
 * @typeParam T - the stored entity value
 * @effects Allocates two process-local `Ref` cells; the returned `snapshot`
 * reads the store each time it is run.
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const makeEntityStore = Effect.fn("Documents.RepoSupport.makeEntityStore")(function* <Id, T>(
  initial: HashMap.HashMap<Id, T>
) {
  const store = yield* Ref.make(initial);
  const counter = yield* Ref.make(1);
  const snapshot = Effect.map(Ref.get(store), (values): ReadonlyArray<T> => A.fromIterable(HashMap.values(values)));
  return { counter, snapshot, store };
});
