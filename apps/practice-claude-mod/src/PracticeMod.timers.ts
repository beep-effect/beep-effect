/**
 * Append-only raw explicit timer intervals in the plugin's local store.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeClaudeModId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { ModHost } from "./PracticeMod.host.ts";
import { TimerInterval } from "./PracticeMod.values.ts";
import type { ModHostError } from "./PracticeMod.host.ts";

const $I = $PracticeClaudeModId.create("PracticeMod.timers");
const RowsKey = "timer-intervals";
const StoredRows = S.Array(TimerInterval);
const RowLine = S.fromJsonString(TimerInterval);

class TimerStoreUnreadable extends S.TaggedError<TimerStoreUnreadable, { readonly brand: unique symbol }>(
  $I`TimerStoreUnreadable`
)(
  "TimerStoreUnreadable",
  { message: S.String },
  $I.annote("TimerStoreUnreadable", { description: "Timer data could not be decoded; it will not be overwritten." })
) {}
const unreadable = (issue: unknown) => TimerStoreUnreadable.make({ message: String(issue) });
type TimerLogError = TimerStoreUnreadable | ModHostError;

/**
 * Stores explicit intervals and exports one JSON line per interval.
 *
 * **Example** (Export the raw log)
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { TimerLog } from "@/PracticeMod.timers"
 * const program = Effect.flatMap(TimerLog, (log) => log.exportJsonl)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export class TimerLog extends Context.Service<
  TimerLog,
  {
    readonly record: (interval: TimerInterval) => Effect.Effect<void, TimerLogError>;
    readonly exportJsonl: Effect.Effect<string, TimerLogError>;
  }
>()($I`TimerLog`) {}

/**
 * Builds the timer log over the same local host as verdicts.
 *
 * **Example** (Reference the constructor)
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeTimerLog } from "@/PracticeMod.timers"
 * console.log(Effect.isEffect(makeTimerLog)) // true
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeTimerLog = Effect.gen(function* () {
  const host = yield* ModHost;

  // decision: shared-plugin-write-permits
  const writes = yield* Semaphore.make(1);
  const read = Effect.gen(function* () {
    const raw = yield* host.storeGet(RowsKey);
    return raw === undefined
      ? A.empty<TimerInterval>()
      : yield* S.decodeUnknownEffect(StoredRows)(raw).pipe(Effect.mapError(unreadable));
  });
  const recordUnserialized = Effect.fn("TimerLog.record")(function* (interval: TimerInterval) {
    const rows = yield* read;
    const encoded = yield* S.encodeEffect(StoredRows)(A.append(rows, interval)).pipe(Effect.mapError(unreadable));
    yield* host.storeSet(RowsKey, encoded);
  });

  const exportJsonl = Effect.gen(function* () {
    const rows = yield* read;
    const lines = yield* Effect.forEach(rows, (row) => S.encodeEffect(RowLine)(row).pipe(Effect.mapError(unreadable)), {
      concurrency: 1,
    });
    return A.join(lines, "\n") + (lines.length > 0 ? "\n" : "");
  });
  const record = (interval: TimerInterval) => Semaphore.withPermit(writes)(recordUnserialized(interval));
  return TimerLog.of({ record, exportJsonl });
});

/**
 * Provides the append-only timer log from a mod host.
 *
 * **Example** (Reference the layer)
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { timerLogLayer } from "@/PracticeMod.timers"
 * console.log(Layer.isLayer(timerLogLayer)) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const timerLogLayer: Layer.Layer<TimerLog, never, ModHost> = Layer.effect(TimerLog)(makeTimerLog);
