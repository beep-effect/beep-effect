/**
 * HTTP trace context extraction and injection helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Headers from "effect/unstable/http/Headers";
import * as HttpTraceContext from "effect/unstable/http/HttpTraceContext";
import type * as Tracer from "effect/Tracer";

const isTraceContextDataFirst = (args: IArguments): boolean => args.length >= 2 || Effect.isEffect(args[0]);

/**
 * Extract an incoming parent span from trace headers.
 *
 * **Example** (Extract from traceparent header)
 *
 * ```typescript
 * import { extractTraceContextHeaders } from "@beep/observability/server"
 *
 * const parentSpan = extractTraceContextHeaders({ traceparent: "00-abc-def-01" })
 * console.log(parentSpan)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const extractTraceContextHeaders = (headers?: Headers.Input): O.Option<Tracer.ExternalSpan> =>
  HttpTraceContext.fromHeaders(Headers.fromInput(headers));

/**
 * Inject the current Effect span into outbound trace headers.
 *
 * **Example** (Inject current span headers)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { injectTraceContextHeaders } from "@beep/observability/server"
 *
 * const program = injectTraceContextHeaders().pipe(
 *   Effect.map((headers) => headers)
 * )
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Reads the current span when available and returns headers with W3C trace context fields.
 * @category observability
 * @since 0.0.0
 */
export const injectTraceContextHeaders = Effect.fn("injectTraceContextHeaders")(function* (
  headers?: Headers.Input
): Effect.fn.Return<Headers.Headers> {
  return yield* Effect.currentSpan.pipe(
    Effect.map((span) => Headers.setAll(Headers.fromInput(headers), HttpTraceContext.toHeaders(span))),
    Effect.orElseSucceed(() => Headers.fromInput(headers))
  );
});

/**
 * Apply an incoming parent span, if present, to one effect.
 *
 * **Example** (Apply parent span to effect)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { withIncomingTraceContext } from "@beep/observability/server"
 *
 * const program = withIncomingTraceContext(
 *   Effect.succeed("ok"),
 *   { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ca902c7-00" }
 * )
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Applies an extracted parent span to the wrapped effect when incoming trace headers are present.
 * @category observability
 * @since 0.0.0
 */
const withIncomingTraceContextImpl = Effect.fn("withIncomingTraceContextImpl")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  headers: Headers.Input | undefined
): Effect.fn.Return<A, E, R> {
  return yield* extractTraceContextHeaders(headers).pipe(
    O.match({
      onNone: () => effect,
      onSome: (span) => Effect.withParentSpan(effect, span, { captureStackTrace: false }),
    })
  );
});

/**
 * Runs an Effect with trace context extracted from incoming headers.
 *
 * **Example** (Run effect with headers)
 *
 * ```typescript
 * import { Effect } from "effect"
 * import { withIncomingTraceContext } from "@beep/observability/server"
 *
 * const program = withIncomingTraceContext(
 *   Effect.succeed("ok"),
 *   { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ca902c7-00" }
 * )
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @effects Applies an extracted parent span to the wrapped effect when incoming trace headers are present.
 * @category observability
 * @since 0.0.0
 */
export const withIncomingTraceContext: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, headers: Headers.Input | undefined): Effect.Effect<A, E, R>;
  <A, E, R>(headers: Headers.Input | undefined, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R>;
  (headers: Headers.Input | undefined): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(
  isTraceContextDataFirst,
  Effect.fn("withIncomingTraceContext")(function* <A, E, R>(
    effect: Effect.Effect<A, E, R> | Headers.Input | undefined,
    headers: Headers.Input | Effect.Effect<A, E, R> | undefined
  ): Effect.fn.Return<A, E, R> {
    if (Effect.isEffect(effect) && !Effect.isEffect(headers)) {
      return yield* withIncomingTraceContextImpl(effect, headers);
    }

    if (P.isNotUndefined(effect) && !Effect.isEffect(effect) && Effect.isEffect(headers)) {
      return yield* withIncomingTraceContextImpl(headers, effect);
    }

    if (P.isUndefined(effect) && Effect.isEffect(headers)) {
      return yield* withIncomingTraceContextImpl(headers, undefined);
    }

    return yield* Effect.die("Invalid withIncomingTraceContext arguments");
  })
);
