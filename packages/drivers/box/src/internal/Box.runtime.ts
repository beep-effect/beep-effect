import { A, P, Struct } from "@beep/utils";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxError } from "../Box.errors.ts";
import type { Exit } from "effect";
import type { BoxMethodName } from "../_generated/Box.models.gen.ts";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!P.isObject(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

// The Box SDK deserializers materialize absent response fields as
// present-but-undefined keys (e.g. `nextMarker: undefined` on the final
// marker-paginated page), which exact-optional schema keys reject. JSON has no
// `undefined`, so dropping those keys before decoding restores wire semantics.
//
// Copy-on-write: a branch with nothing to prune is returned by identity, so an
// unchanged listing costs a traversal and no allocation. Keys are written with
// `defineProperty` because plain assignment of an own `__proto__` key invokes
// the legacy prototype setter — mutating the normalized object's prototype and
// dropping the field rather than copying it.
//
// Only plain objects and arrays are rebuilt; streams, buffers, and every other
// non-plain value pass through untouched, so recursion stays confined to
// JSON-shaped SDK payloads, which cannot be cyclic.
const pruneUndefined = (value: unknown): unknown => {
  if (A.isArray(value)) {
    const pruned = A.map(value, pruneUndefined);
    return A.every(pruned, (entry, index) => entry === value[index]) ? value : pruned;
  }
  if (isPlainObject(value)) {
    const entries = Struct.entries(value);
    const kept = A.filter(entries, ([, entry]) => entry !== undefined);
    const prunedEntries = A.map(kept, ([key, entry]) => [key, pruneUndefined(entry)] as const);
    if (kept.length === entries.length && A.every(prunedEntries, ([key, entry]) => entry === value[key])) {
      return value;
    }
    const pruned: Record<string, unknown> = {};
    for (const [key, entry] of prunedEntries) {
      Object.defineProperty(pruned, key, { configurable: true, enumerable: true, value: entry, writable: true });
    }
    return pruned;
  }
  return value;
};

/**
 * Decode a Box driver boundary value into a typed request or response model.
 *
 * Response values are normalized first: SDK-materialized
 * present-but-undefined keys are pruned so exact-optional schema keys decode
 * the same payload the Box API actually sent.
 *
 * @category utilities
 * @since 0.0.0
 */
export const decodeWith: {
  (
    value: unknown,
    options: {
      readonly method: BoxMethodName;
      readonly reason: "request encoding" | "response decoding";
    }
  ): <A>(schema: S.ConstraintDecoder<A>) => Effect.Effect<A, BoxError>;
  <A>(
    schema: S.ConstraintDecoder<A>,
    value: unknown,
    options: {
      readonly method: BoxMethodName;
      readonly reason: "request encoding" | "response decoding";
    }
  ): Effect.Effect<A, BoxError>;
} = dual(
  3,
  <A>(
    schema: S.ConstraintDecoder<A>,
    value: unknown,
    options: {
      readonly method: BoxMethodName;
      readonly reason: "request encoding" | "response decoding";
    }
  ): Effect.Effect<A, BoxError> =>
    S.decodeUnknownEffect(schema)(options.reason === "response decoding" ? pruneUndefined(value) : value).pipe(
      Effect.mapError((cause) =>
        BoxError.fromReason(options.reason, {
          cause,
          method: options.method,
        })
      )
    )
);

/**
 * Decode `payload` against `payloadSchema`, then run `use` with an
 * `AbortController` scoped to the call's lifetime, invoking `release` when
 * the call completes. Shared acquire/decode/use skeleton for every SDK call
 * shape (JSON, byte stream) that needs a cancellable in-flight request.
 *
 * @category utilities
 * @since 0.0.0
 */
export const acquireSdkCallController = <Payload, Out>(spec: {
  readonly methodName: BoxMethodName;
  readonly payloadSchema: S.ConstraintDecoder<Payload>;
  readonly payload: unknown;
  readonly use: (decoded: Payload, controller: AbortController) => Effect.Effect<Out, BoxError>;
  readonly release: (controller: AbortController, exit: Exit.Exit<Out, BoxError>) => Effect.Effect<void>;
}): Effect.Effect<Out, BoxError> =>
  Effect.acquireUseRelease(
    Effect.sync(() => new AbortController()),
    (controller) =>
      decodeWith(spec.payloadSchema, spec.payload, {
        method: spec.methodName,
        reason: "request encoding",
      }).pipe(Effect.flatMap((decoded) => spec.use(decoded, controller))),
    spec.release
  );

/**
 * Build sanitized Box driver diagnostics for debug logging.
 *
 * @category utilities
 * @since 0.0.0
 */
export const diagnosticsFor: {
  (error: BoxError, event: string): Readonly<Record<string, unknown>>;
  (event: string): (error: BoxError) => Readonly<Record<string, unknown>>;
} = dual(
  2,
  (error: BoxError, event: string): Readonly<Record<string, unknown>> => ({
    event,
    method: O.getOrUndefined(error.method),
    provider: "box",
    reason: error.reason,
    sdkVersion: error.sdkVersion,
    status: O.getOrUndefined(error.status),
  })
);

/**
 * Log a sanitized Box driver failure event.
 *
 * @category utilities
 * @since 0.0.0
 */
export const logDriverFailure =
  (event: string) =>
  (error: BoxError): Effect.Effect<void> =>
    Effect.logDebug(diagnosticsFor(error, event));
