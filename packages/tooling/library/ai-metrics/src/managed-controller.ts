/**
 * Content-free evidence from an owned managed canary invocation, never native LLM usage.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { nativeTraceWire, otlpStringAttribute } from "./internal/native-trace-wire.ts";
import { hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("managed-controller");
const positiveNanos = S.String.check(S.isPattern(/^[1-9][0-9]{0,19}$/)).pipe(
  $I.annoteSchema("PositiveControllerNanos", {
    description: "Positive bounded decimal nanoseconds, never a serialized monotonic clock origin.",
  })
);

/**
 * Exact safe evidence captured around one claimed real canary invocation.
 *
 * **Example** (Inspect the producer schema)
 * ```ts
 * import { ManagedControllerObservation } from "@beep/repo-ai-metrics/managed-controller"
 * console.log(typeof ManagedControllerObservation.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ManagedControllerObservation extends S.Opaque<
  ManagedControllerObservation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("managed-controller-observation/v1"),
    launchId: Sha256Hex,
    launchRouteId: Sha256Hex,
    processInstanceId: Sha256Hex,
    sourceSessionId: Sha256Hex,
    evidenceId: Sha256Hex,
    startTimeUnixNano: positiveNanos,
    endTimeUnixNano: positiveNanos,
    elapsedNanos: positiveNanos,
    outcome: S.tag("completed"),
    response: S.tag("exact-constant-matched"),
  })
    .check(
      S.makeFilter(
        (value) =>
          BigInt(value.endTimeUnixNano) <= 18_446_744_073_709_551_615n &&
          BigInt(value.endTimeUnixNano) >= BigInt(value.startTimeUnixNano) &&
          BigInt(value.elapsedNanos) <= 120_000_000_000n,
        {
          identifier: "ManagedControllerInterval",
          title: "Bounded measured controller interval",
          description: "Ordered wall times and at most120seconds of measured monotonic elapsed time.",
        }
      )
    )
    .pipe(
      $I.annoteSchema("ManagedControllerObservation", {
        description:
          "Controller interval joined to original claim/process/session evidence; no native model or usage claim.",
      })
    )
) {}

/**
 * Safe adapter failure without source identifiers or underlying causes.
 * **Example** (Inspect a fixed failure)
 * ```ts
 * import { ManagedControllerError } from "@beep/repo-ai-metrics/managed-controller"
 * console.log(ManagedControllerError.make({ reason: "encoding" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ManagedControllerError extends S.TaggedError<ManagedControllerError, { readonly brand: unique symbol }>(
  $I`ManagedControllerError`
)(
  "ManagedControllerError",
  { reason: S.Literals(["evidence", "encoding"]) },
  $I.annote("ManagedControllerError", { description: "Content-free observed-controller refusal." })
) {}

/**
 * Deterministic one-event identity for one independently claimed invocation.
 * **Example** (Inspect the identity constructor)
 * ```ts
 * import { ManagedControllerTraceIdentity } from "@beep/repo-ai-metrics/managed-controller"
 * console.log(typeof ManagedControllerTraceIdentity.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ManagedControllerTraceIdentity extends S.Opaque<
  ManagedControllerTraceIdentity,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    traceId: S.String.check(S.isPattern(/^[0-9a-f]{32}$/)),
    spanId: S.String.check(S.isPattern(/^[0-9a-f]{16}$/)),
  }).pipe(
    $I.annoteSchema("ManagedControllerTraceIdentity", {
      description: "Versioned, claim-scoped OTLP identity independent of payload retries.",
    })
  )
) {}
/**
 * Derive one stable span per launch; changed payloads conflict instead of minting another event.
 * **Example** (Build an identity effect)
 * ```ts
 * import { managedControllerTraceIdentity } from "@beep/repo-ai-metrics/managed-controller"
 * console.log(typeof managedControllerTraceIdentity)
 * ```
 * @param launchId - Original independent claim identity.
 * @returns The domain-separated trace and span identifiers.
 * @category identifiers
 * @since 0.0.0
 */
export const managedControllerTraceIdentity = Effect.fn("AiMetrics.managedControllerTraceIdentity")(function* (
  launchId: Sha256Hex
) {
  return ManagedControllerTraceIdentity.make({
    traceId: Str.slice(0, 32)(yield* hashPublicTextSha256(`managed-controller-trace/v1:${launchId}`)),
    spanId: Str.slice(0, 16)(yield* hashPublicTextSha256(`managed-controller-canary/v1:${launchId}`)),
  });
});

/**
 * Encode one validated controller observation as OTLP for the bounded local intake.
 *
 * **Details**
 *
 * The server must independently select the managed-controller route policy.
 * Trace/span identities are domain separated from native harness identities.
 * The already salted session binding is explicitly marked, never hashed again.
 *
 * **Example** (Build an encoding effect)
 * ```ts
 * import { encodeManagedControllerObservation } from "@beep/repo-ai-metrics/managed-controller"
 * console.log(typeof encodeManagedControllerObservation)
 * ```
 * @param observation - Metadata captured during this exact claimed invocation.
 * @returns Immutable OTLP bytes; not an intake acknowledgment or backend receipt.
 * @category encoding
 * @since 0.0.0
 */
export const encodeManagedControllerObservation = Effect.fn("AiMetrics.encodeManagedControllerObservation")(function* (
  observation: ManagedControllerObservation
) {
  const checked = yield* S.decodeEffect(ManagedControllerObservation)(observation).pipe(
    Effect.mapError(() => ManagedControllerError.make({ reason: "evidence" }))
  );
  const { traceId, spanId } = yield* managedControllerTraceIdentity(checked.launchId);
  const trace = yield* Effect.fromResult(Hex.decode(traceId));
  const span = yield* Effect.fromResult(Hex.decode(spanId));
  return yield* Effect.try({
    try: () =>
      nativeTraceWire
        .encode({
          resourceSpans: [
            {
              scopeSpans: [
                {
                  spans: [
                    {
                      traceId: trace,
                      spanId: span,
                      name: "managed.controller.canary",
                      startTimeUnixNano: checked.startTimeUnixNano,
                      endTimeUnixNano: checked.endTimeUnixNano,
                      status: { code: 1 },
                      attributes: [
                        otlpStringAttribute("openinference.span.kind", "AGENT"),
                        otlpStringAttribute("beep.managed.launch_id", checked.launchId),
                        otlpStringAttribute("beep.managed.launch_route_id", checked.launchRouteId),
                        otlpStringAttribute("beep.managed.process_instance_id", checked.processInstanceId),
                        otlpStringAttribute("beep.managed.session_hash", checked.sourceSessionId),
                        otlpStringAttribute("beep.managed.evidence_id", checked.evidenceId),
                        otlpStringAttribute("beep.managed.elapsed_nanos", checked.elapsedNanos),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        })
        .finish(),
    catch: () => ManagedControllerError.make({ reason: "encoding" }),
  });
});
