/**
 * ThreadStore server layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { CuidState } from "@beep/schema/Cuid";
import { DateTimes } from "@beep/utils/DateTime";
import * as ThreadStoreServer from "@beep/workspace-use-cases/server";
import { Effect, Layer } from "effect";
import { makeDrizzleThreadStore, makeInMemoryThreadStore } from "./ThreadStore.repo.ts";

const ThreadStore = ThreadStoreServer.Thread.ThreadStore;
const CuidStateLive = Layer.effect(
  CuidState,
  CuidState.make("node").pipe(
    Effect.tapError((cause) =>
      Effect.logDebug("Workspace ThreadStore failed to initialize public id generation").pipe(
        Effect.annotateLogs({ cause })
      )
    ),
    Effect.mapError(() =>
      ThreadStoreServer.Thread.ThreadStoreUnavailable.make({
        reason: "initialize public id generator failed",
      })
    )
  )
).pipe(Layer.provide(DateTimes.Default));

/**
 * In-memory ThreadStore layer for fast workspace proofs, requiring host crypto
 * while providing the canonical CUID state internally.
 *
 * @example
 * ```ts
 * import { ThreadStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Thread"
 *
 * console.log(ThreadStoreInMemoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ThreadStoreInMemoryLayer = Layer.effect(ThreadStore, makeInMemoryThreadStore()).pipe(
  Layer.provide(CuidStateLive)
);

/**
 * Drizzle-backed ThreadStore layer requiring a {@link @beep/postgres#PostgresDrizzle}
 * database and host crypto while providing the canonical CUID state internally.
 *
 * @example
 * ```ts
 * import { ThreadStoreDrizzleLayer } from "@beep/workspace-server/aggregates/Thread"
 *
 * console.log(ThreadStoreDrizzleLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ThreadStoreDrizzleLayer = Layer.effect(ThreadStore, makeDrizzleThreadStore()).pipe(
  Layer.provide(CuidStateLive)
);

/**
 * Default ThreadStore layer (in-memory) for normal slice tests.
 *
 * @example
 * ```ts
 * import { ThreadStoreLive } from "@beep/workspace-server/aggregates/Thread"
 *
 * console.log(ThreadStoreLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ThreadStoreLive = ThreadStoreInMemoryLayer;
