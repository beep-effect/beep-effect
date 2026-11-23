/**
 * The mod engine (`$`) as an Effect service, so the plugin's logic runs as
 * Effects and tests provide a fake host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeClaudeModId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Engine } from "claude-code";

const $I = $PracticeClaudeModId.create("PracticeMod.host");

/**
 * Which engine call failed.
 *
 * @category schemas
 * @since 0.0.0
 */
const ModHostOperation = LiteralKit(["store-get", "store-set", "session-id", "clock", "matter-lookup"]).pipe(
  $I.annoteSchema("ModHostOperation", { description: "The mod engine call that failed." })
);

/**
 * Type-level union produced by {@link ModHostOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
type ModHostOperation = typeof ModHostOperation.Type;

/**
 * **Example** (Make a host error)
 *
 * ```ts
 * import { ModHostError } from "@/PracticeMod.host"
 *
 * const error = ModHostError.make({ operation: "store-set", message: "EACCES" })
 * console.log(error.operation) // "store-set"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModHostError extends S.TaggedError<ModHostError, { readonly brand: unique symbol }>($I`ModHostError`)(
  "ModHostError",
  {
    operation: ModHostOperation,
    message: S.String,
  },
  $I.annote("ModHostError", { description: "A mod engine call rejected." })
) {}

/**
 * The engine calls the plugin's logic needs.
 *
 * **Example** (Read the session id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { ModHost } from "@/PracticeMod.host"
 *
 * const program = Effect.flatMap(ModHost, (host) => host.sessionId)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModHost extends Context.Service<
  ModHost,
  {
    readonly storeGet: (key: string) => Effect.Effect<unknown, ModHostError>;
    readonly storeSet: (key: string, value: unknown) => Effect.Effect<void, ModHostError>;
    readonly toast: (text: string) => Effect.Effect<void>;
    readonly sessionId: Effect.Effect<string, ModHostError>;
    readonly now: Effect.Effect<DateTime.Utc, ModHostError>;
  }
>()($I`ModHost`) {}

const call = <A>(operation: ModHostOperation, run: () => Promise<A>): Effect.Effect<A, ModHostError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => ModHostError.make({ operation, message: String(cause) }),
  });

/**
 * The live host over one hook's engine interface.
 *
 * **Details**
 *
 * Build it per dispatch: `$` belongs to the hook that received it.
 *
 * **Example** (Reference the constructor)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { makeModHost } from "@/PracticeMod.host"
 *
 * console.log(P.isFunction(makeModHost)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeModHost = ($: Engine): ModHost["Service"] =>
  ModHost.of({
    storeGet: Effect.fn("ModHost.storeGet")((key: string) => call("store-get", () => $.store.get(key))),
    storeSet: Effect.fn("ModHost.storeSet")((key: string, value: unknown) =>
      call("store-set", () => $.store.set(key, value))
    ),
    toast: Effect.fn("ModHost.toast")((text: string) => Effect.sync(() => $.ui.toast(text))),
    sessionId: call("session-id", () => $.session.id()),
    now: Effect.map(
      call("clock", () => $.clock.now()),
      (millis) => DateTime.makeUnsafe(millis)
    ),
  });
