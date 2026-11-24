/**
 * Schema-first contracts for the machine-wide agent command circuit breaker.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Num from "effect/Number";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { PosInt } from "./internal/PosInt.ts";

const $I = $RepoAiMetricsId.create("circuit-breaker");

/**
 * Resolves the shared circuit-breaker state beneath an agent-evidence root.
 *
 * **Example** (Locate breaker state)
 *
 * ```ts
 * import { circuitBreakerRoot } from "@beep/repo-ai-metrics"
 *
 * console.log(circuitBreakerRoot("/var/lib/beep/agent-evidence"))
 * // /var/lib/beep/agent-evidence/circuit-breaker
 * ```
 *
 * @param evidenceRoot - Root directory shared by content-free agent evidence.
 * @returns The circuit-breaker state root beneath the supplied evidence root.
 * @category utilities
 * @since 0.0.0
 */
export const circuitBreakerRoot = (evidenceRoot: string): string => `${evidenceRoot}/circuit-breaker`;

/**
 * Resolves the append-only circuit-breaker event directory.
 *
 * **Example** (Locate breaker evidence)
 *
 * ```ts
 * import { circuitBreakerEventLedgerDir } from "@beep/repo-ai-metrics"
 *
 * console.log(circuitBreakerEventLedgerDir("/var/lib/beep/agent-evidence/circuit-breaker"))
 * // /var/lib/beep/agent-evidence/circuit-breaker/events
 * ```
 *
 * @param root - Circuit-breaker state root returned by {@link circuitBreakerRoot}.
 * @returns The directory containing append-only circuit-breaker event rows.
 * @category utilities
 * @since 0.0.0
 */
export const circuitBreakerEventLedgerDir = (root: string): string => `${root}/events`;

/**
 * Resolves the directory holding one atomic open-state document per probe.
 *
 * **Example** (Locate open breaker state)
 *
 * ```ts
 * import { circuitBreakerOpenStateDir } from "@beep/repo-ai-metrics"
 *
 * console.log(circuitBreakerOpenStateDir("/var/lib/beep/agent-evidence/circuit-breaker"))
 * // /var/lib/beep/agent-evidence/circuit-breaker/open
 * ```
 *
 * @param root - Circuit-breaker state root returned by {@link circuitBreakerRoot}.
 * @returns The directory containing one atomic open-state document per probe.
 * @category utilities
 * @since 0.0.0
 */
export const circuitBreakerOpenStateDir = (root: string): string => `${root}/open`;

/**
 * External dependency class protected by one machine-wide breaker state.
 *
 * **Example** (Select the 1Password lane)
 *
 * ```ts
 * import { CircuitBreakerProbe } from "@beep/repo-ai-metrics"
 *
 * console.log(CircuitBreakerProbe.Enum.op)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitBreakerProbe = LiteralKit(["op", "gh", "network"]).pipe(
  $I.annoteSchema("CircuitBreakerProbe", {
    description: "External dependency classes whose identical retries share breaker state across clones.",
  })
);

/**
 * Decoded dependency class protected by the breaker.
 *
 * @see {@link CircuitBreakerProbe} for the runtime schema and dependency classes.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerProbe = typeof CircuitBreakerProbe.Type;

/**
 * Bounded actor class that consulted or changed shared breaker state.
 *
 * **Example** (Attribute a notifier probe)
 *
 * ```ts
 * import { CircuitBreakerCaller } from "@beep/repo-ai-metrics"
 *
 * console.log(CircuitBreakerCaller.Enum.hook)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitBreakerCaller = LiteralKit(["claude-code", "codex-cli", "hook", "operator"]).pipe(
  $I.annoteSchema("CircuitBreakerCaller", {
    description: "Content-free caller identities admitted by the shared command breaker.",
  })
);

/**
 * Decoded actor class consulting shared breaker state.
 *
 * @see {@link CircuitBreakerCaller} for the runtime schema and caller classes.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerCaller = typeof CircuitBreakerCaller.Type;

/**
 * Version discriminator carried by each circuit-breaker event.
 *
 * **Example** (Read the event version)
 *
 * ```ts
 * import { CircuitBreakerEventSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * console.log(CircuitBreakerEventSchemaVersion.Enum["circuit-breaker-event/v1"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitBreakerEventSchemaVersion = LiteralKit(["circuit-breaker-event/v1"]).pipe(
  $I.annoteSchema("CircuitBreakerEventSchemaVersion", {
    description: "Version identifiers accepted by the circuit-breaker event ledger.",
  })
);

/**
 * @see {@link CircuitBreakerEventSchemaVersion} for the runtime schema and supported version.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerEventSchemaVersion = typeof CircuitBreakerEventSchemaVersion.Type;

/**
 * Version discriminator carried by an open circuit state document.
 *
 * **Example** (Read the open-state version)
 *
 * ```ts
 * import { CircuitBreakerOpenStateSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * console.log(CircuitBreakerOpenStateSchemaVersion.Enum["circuit-breaker-open/v1"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitBreakerOpenStateSchemaVersion = LiteralKit(["circuit-breaker-open/v1"]).pipe(
  $I.annoteSchema("CircuitBreakerOpenStateSchemaVersion", {
    description: "Version identifiers accepted by atomic circuit-breaker open state.",
  })
);

/**
 * @see {@link CircuitBreakerOpenStateSchemaVersion} for the runtime schema and supported version.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerOpenStateSchemaVersion = typeof CircuitBreakerOpenStateSchemaVersion.Type;

/**
 * **Example** (Record a probe that went through)
 *
 * ```ts
 * import { CircuitBreakerOutcome, CircuitBreakerProbeSucceeded } from "@beep/repo-ai-metrics/circuit-breaker"
 *
 * const outcome = CircuitBreakerProbeSucceeded.make({})
 *
 * console.log(outcome.status) // => "probe-succeeded"
 * console.log(CircuitBreakerOutcome.guards["probe-succeeded"](outcome)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerProbeSucceeded extends S.Opaque<
  CircuitBreakerProbeSucceeded,
  { readonly brand: unique symbol }
>()(
  S.Struct({ status: S.tag("probe-succeeded") }).pipe(
    $I.annoteSchema("CircuitBreakerProbeSucceeded", {
      description: "The guarded external probe completed successfully.",
    })
  )
) {}

/**
 * **Example** (Open the breaker after a curl timeout)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CircuitBreakerTripped } from "@beep/repo-ai-metrics/circuit-breaker"
 *
 * const tripped = S.decodeUnknownSync(CircuitBreakerTripped)({
 *   status: "tripped",
 *   exitCode: 28,
 *   retryAfterEpochMs: 1_791_975_600_000
 * })
 *
 * console.log(tripped.exitCode) // => 28
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerTripped extends S.Opaque<CircuitBreakerTripped, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("tripped"),
    exitCode: PosInt,
    retryAfterEpochMs: S.Natural,
  }).pipe(
    $I.annoteSchema("CircuitBreakerTripped", {
      description: "A failed external probe atomically opened the machine-wide breaker.",
    })
  )
) {}

/**
 * **Example** (Skip an identical retry until the cooldown ends)
 *
 * ```ts
 * import { CircuitBreakerOutcome, CircuitBreakerRetrySkipped } from "@beep/repo-ai-metrics/circuit-breaker"
 *
 * const skipped = CircuitBreakerRetrySkipped.make({ retryAfterEpochMs: 1_791_975_600_000 })
 * const retryAt = CircuitBreakerOutcome.match(skipped, {
 *   "probe-succeeded": () => 0,
 *   tripped: (outcome) => outcome.retryAfterEpochMs,
 *   "retry-skipped": (outcome) => outcome.retryAfterEpochMs,
 *   "coordination-skipped": () => 0,
 *   reset: () => 0
 * })
 *
 * console.log(retryAt) // => 1791975600000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerRetrySkipped extends S.Opaque<
  CircuitBreakerRetrySkipped,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag("retry-skipped"),
    retryAfterEpochMs: S.Natural,
  }).pipe(
    $I.annoteSchema("CircuitBreakerRetrySkipped", {
      description: "An identical retry was skipped while the machine-wide breaker remained open.",
    })
  )
) {}

/**
 * **Example** (Back off while another process holds the lock)
 *
 * ```ts
 * import { CircuitBreakerCoordinationSkipped, CircuitBreakerOutcome } from "@beep/repo-ai-metrics/circuit-breaker"
 *
 * const outcome = CircuitBreakerCoordinationSkipped.make({})
 *
 * console.log(CircuitBreakerOutcome.isAnyOf(["retry-skipped", "coordination-skipped"])(outcome)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerCoordinationSkipped extends S.Opaque<
  CircuitBreakerCoordinationSkipped,
  { readonly brand: unique symbol }
>()(
  S.Struct({ status: S.tag("coordination-skipped") }).pipe(
    $I.annoteSchema("CircuitBreakerCoordinationSkipped", {
      description: "A probe was skipped because another process held the machine-wide coordination lock.",
    })
  )
) {}

/**
 * **Example** (Record an operator closing the breaker)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CircuitBreakerEventV1, CircuitBreakerReset } from "@beep/repo-ai-metrics/circuit-breaker"
 *
 * const event = S.decodeUnknownSync(CircuitBreakerEventV1)({
 *   schemaVersion: "circuit-breaker-event/v1",
 *   ts: "2026-10-14T09:30:00.000Z",
 *   probe: "gh",
 *   caller: "operator",
 *   breakerRev: "shared-cooldown-1",
 *   outcome: { status: "reset" }
 * })
 *
 * console.log(S.is(CircuitBreakerReset)(event.outcome)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerReset extends S.Opaque<CircuitBreakerReset, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("reset") }).pipe(
    $I.annoteSchema("CircuitBreakerReset", {
      description: "An operator explicitly closed one breaker state.",
    })
  )
) {}

/**
 * Content-free result of consulting the machine-wide circuit breaker.
 *
 * **Example** (Decode a labeled retry skip)
 *
 * ```ts
 * import { CircuitBreakerOutcome } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(CircuitBreakerOutcome)({
 *   status: "retry-skipped",
 *   retryAfterEpochMs: 1_788_444_900_000
 * })
 * console.log(result._tag) // "Success"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CircuitBreakerOutcome = S.Union([
  CircuitBreakerProbeSucceeded,
  CircuitBreakerTripped,
  CircuitBreakerRetrySkipped,
  CircuitBreakerCoordinationSkipped,
  CircuitBreakerReset,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("CircuitBreakerOutcome", {
    description: "Tagged result that cannot attach command, output, or error content to breaker evidence.",
  })
);

/**
 * Decoded result of consulting shared circuit-breaker state.
 *
 * @see {@link CircuitBreakerOutcome} for the runtime schema and tagged result cases.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerOutcome = typeof CircuitBreakerOutcome.Type;

/**
 * Privacy-safe evidence for one guarded probe decision.
 *
 * **Details**
 *
 * The event records only dependency class, bounded caller, revision, and a
 * tagged operational result. There is no field for the command, arguments,
 * output, error, URL, secret reference, or response body.
 *
 * **Example** (Record an open-circuit retry skip)
 *
 * ```ts
 * import { CircuitBreakerEventV1 } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(CircuitBreakerEventV1)({
 *   schemaVersion: "circuit-breaker-event/v1",
 *   ts: "2026-09-03T12:00:00.000Z",
 *   probe: "op",
 *   caller: "codex-cli",
 *   breakerRev: "shared-cooldown-1",
 *   outcome: { status: "retry-skipped", retryAfterEpochMs: 1_788_444_900_000 }
 * })
 * console.log(event.probe) // "op"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerEventV1 extends S.Opaque<CircuitBreakerEventV1, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: CircuitBreakerEventSchemaVersion,
    ts: S.DateTimeUtcFromString,
    probe: CircuitBreakerProbe,
    caller: CircuitBreakerCaller,
    breakerRev: S.NonEmptyString,
    evidenceTier: S.tag("derived"),
    outcome: CircuitBreakerOutcome,
  }).pipe(
    $I.annoteSchema("CircuitBreakerEventV1", {
      description: "Content-free append-only evidence for one circuit-breaker decision.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(CircuitBreakerEventV1);
  static readonly encodeEffect = S.encodeUnknownEffect(CircuitBreakerEventV1);
  static readonly decodeResult = S.decodeUnknownResult(CircuitBreakerEventV1);
  static readonly encodeResult = S.encodeResult(CircuitBreakerEventV1);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(CircuitBreakerEventV1));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(CircuitBreakerEventV1));
  static readonly decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(CircuitBreakerEventV1));
  static readonly encodeJsonResult = S.encodeResult(S.fromJsonString(CircuitBreakerEventV1));
}

const isGreaterThanOrEqualToNumber = Order.isGreaterThanOrEqualTo(Num.Order);

/**
 * Atomic machine-wide open state for one external dependency class.
 *
 * **Example** (Open the network breaker)
 *
 * ```ts
 * import { CircuitBreakerOpenStateV1 } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const state = S.decodeUnknownSync(CircuitBreakerOpenStateV1)({
 *   schemaVersion: "circuit-breaker-open/v1",
 *   probe: "network",
 *   breakerRev: "shared-cooldown-1",
 *   trippedEpochMs: 1_788_444_000_000,
 *   retryAfterEpochMs: 1_788_444_900_000,
 *   exitCode: 28
 * })
 * console.log(state.probe) // "network"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CircuitBreakerOpenStateV1 extends S.Opaque<CircuitBreakerOpenStateV1, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: CircuitBreakerOpenStateSchemaVersion,
    probe: CircuitBreakerProbe,
    breakerRev: S.NonEmptyString,
    trippedEpochMs: S.Natural,
    retryAfterEpochMs: S.Natural,
    exitCode: PosInt,
  })
    .check(
      S.makeFilter((input) => isGreaterThanOrEqualToNumber(input.retryAfterEpochMs, input.trippedEpochMs), {
        identifier: "CircuitBreakerOpenIntervalInvariant",
        title: "Circuit-breaker open interval invariant",
        description: "Requires a breaker retry instant at or after the failure that opened it.",
        message: "Expected retryAfterEpochMs to be greater than or equal to trippedEpochMs",
      })
    )
    .pipe(
      $I.annoteSchema("CircuitBreakerOpenStateV1", {
        description: "Content-free atomic open state shared by every clone and worktree on one machine.",
      })
    )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(CircuitBreakerOpenStateV1);
  static readonly encodeEffect = S.encodeUnknownEffect(CircuitBreakerOpenStateV1);
  static readonly decodeResult = S.decodeUnknownResult(CircuitBreakerOpenStateV1);
  static readonly encodeResult = S.encodeResult(CircuitBreakerOpenStateV1);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(CircuitBreakerOpenStateV1));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(CircuitBreakerOpenStateV1));
  static readonly decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(CircuitBreakerOpenStateV1));
  static readonly encodeJsonResult = S.encodeResult(S.fromJsonString(CircuitBreakerOpenStateV1));
}
