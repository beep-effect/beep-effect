/**
 * Schema-first contracts for the machine-wide agent command circuit breaker.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Number as Num, Order } from "effect";
import * as S from "effect/Schema";

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
export const CircuitBreakerProbe = LiteralKit(["op", "gh", "network"]).annotate(
  $I.annote("CircuitBreakerProbe", {
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
export const CircuitBreakerCaller = LiteralKit(["claude-code", "codex-cli", "hook", "operator"]).annotate(
  $I.annote("CircuitBreakerCaller", {
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
export const CircuitBreakerEventSchemaVersion = LiteralKit(["circuit-breaker-event/v1"]).annotate(
  $I.annote("CircuitBreakerEventSchemaVersion", {
    description: "Version identifiers accepted by the circuit-breaker event ledger.",
  })
);

/**
 * Decoded circuit-breaker event version.
 *
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
export const CircuitBreakerOpenStateSchemaVersion = LiteralKit(["circuit-breaker-open/v1"]).annotate(
  $I.annote("CircuitBreakerOpenStateSchemaVersion", {
    description: "Version identifiers accepted by atomic circuit-breaker open state.",
  })
);

/**
 * Decoded circuit-breaker open-state version.
 *
 * @see {@link CircuitBreakerOpenStateSchemaVersion} for the runtime schema and supported version.
 * @category type-level
 * @since 0.0.0
 */
export type CircuitBreakerOpenStateSchemaVersion = typeof CircuitBreakerOpenStateSchemaVersion.Type;

class CircuitBreakerProbeSucceeded extends S.Class<CircuitBreakerProbeSucceeded>($I`CircuitBreakerProbeSucceeded`)(
  { status: S.tag("probe-succeeded") },
  $I.annote("CircuitBreakerProbeSucceeded", {
    description: "The guarded external probe completed successfully.",
  })
) {}

class CircuitBreakerTripped extends S.Class<CircuitBreakerTripped>($I`CircuitBreakerTripped`)(
  {
    status: S.tag("tripped"),
    exitCode: PosInt,
    retryAfterEpochMs: NonNegativeInt,
  },
  $I.annote("CircuitBreakerTripped", {
    description: "A failed external probe atomically opened the machine-wide breaker.",
  })
) {}

class CircuitBreakerRetrySkipped extends S.Class<CircuitBreakerRetrySkipped>($I`CircuitBreakerRetrySkipped`)(
  {
    status: S.tag("retry-skipped"),
    retryAfterEpochMs: NonNegativeInt,
  },
  $I.annote("CircuitBreakerRetrySkipped", {
    description: "An identical retry was skipped while the machine-wide breaker remained open.",
  })
) {}

class CircuitBreakerCoordinationSkipped extends S.Class<CircuitBreakerCoordinationSkipped>(
  $I`CircuitBreakerCoordinationSkipped`
)(
  { status: S.tag("coordination-skipped") },
  $I.annote("CircuitBreakerCoordinationSkipped", {
    description: "A probe was skipped because another process held the machine-wide coordination lock.",
  })
) {}

class CircuitBreakerReset extends S.Class<CircuitBreakerReset>($I`CircuitBreakerReset`)(
  { status: S.tag("reset") },
  $I.annote("CircuitBreakerReset", {
    description: "An operator explicitly closed one breaker state.",
  })
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
export class CircuitBreakerEventV1 extends S.Class<CircuitBreakerEventV1>($I`CircuitBreakerEventV1`)(
  {
    schemaVersion: CircuitBreakerEventSchemaVersion,
    ts: S.DateTimeUtcFromString,
    probe: CircuitBreakerProbe,
    caller: CircuitBreakerCaller,
    breakerRev: S.NonEmptyString,
    evidenceTier: S.Literal("derived").pipe(SchemaUtils.withConstantDefault("derived")),
    outcome: CircuitBreakerOutcome,
  },
  $I.annote("CircuitBreakerEventV1", {
    description: "Content-free append-only evidence for one circuit-breaker decision.",
  })
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
export class CircuitBreakerOpenStateV1 extends S.Class<CircuitBreakerOpenStateV1>($I`CircuitBreakerOpenStateV1`)(
  S.Struct({
    schemaVersion: CircuitBreakerOpenStateSchemaVersion,
    probe: CircuitBreakerProbe,
    breakerRev: S.NonEmptyString,
    trippedEpochMs: NonNegativeInt,
    retryAfterEpochMs: NonNegativeInt,
    exitCode: PosInt,
  }).check(
    S.makeFilter((input) => isGreaterThanOrEqualToNumber(input.retryAfterEpochMs, input.trippedEpochMs), {
      identifier: "CircuitBreakerOpenIntervalInvariant",
      title: "Circuit-breaker open interval invariant",
      description: "Requires a breaker retry instant at or after the failure that opened it.",
      message: "Expected retryAfterEpochMs to be greater than or equal to trippedEpochMs",
    })
  ),
  $I.annote("CircuitBreakerOpenStateV1", {
    description: "Content-free atomic open state shared by every clone and worktree on one machine.",
  })
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
