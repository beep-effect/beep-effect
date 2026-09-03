/**
 * Schema-first contracts for the P1 sequence-break notification instrument.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, NonNegNum, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Number as Num, Order } from "effect";
import * as S from "effect/Schema";
import { HookPulseAgentKind, HookPulseWaitReason } from "./hook-pulse.ts";

const $I = $RepoAiMetricsId.create("sequence-break");

/**
 * Resolves the shared sequence-break state root beneath an agent-evidence root.
 *
 * **Example** (Locate sequence-break state)
 *
 * ```ts
 * import { sequenceBreakRoot } from "@beep/repo-ai-metrics"
 *
 * console.log(sequenceBreakRoot("/var/lib/beep/agent-evidence"))
 * // /var/lib/beep/agent-evidence/sequence-break
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sequenceBreakRoot = (evidenceRoot: string): string => `${evidenceRoot}/sequence-break`;

/**
 * Resolves the append-only notification-event directory below sequence-break state.
 *
 * **Example** (Locate delivery evidence)
 *
 * ```ts
 * import { sequenceBreakNotificationLedgerDir } from "@beep/repo-ai-metrics"
 *
 * console.log(sequenceBreakNotificationLedgerDir("/var/lib/beep/agent-evidence/sequence-break"))
 * // /var/lib/beep/agent-evidence/sequence-break/notification-events
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sequenceBreakNotificationLedgerDir = (root: string): string => `${root}/notification-events`;

/**
 * Resolves the serialized damping-state directory below sequence-break state.
 *
 * **Example** (Locate storm-damping claims)
 *
 * ```ts
 * import { sequenceBreakDampingDir } from "@beep/repo-ai-metrics"
 *
 * console.log(sequenceBreakDampingDir("/var/lib/beep/agent-evidence/sequence-break"))
 * // /var/lib/beep/agent-evidence/sequence-break/damping
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sequenceBreakDampingDir = (root: string): string => `${root}/damping`;

/**
 * Version discriminator carried by every sequence-break notification row.
 *
 * **Example** (Read the current version)
 *
 * ```ts
 * import { SequenceBreakNotificationSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakNotificationSchemaVersion.Enum["sequence-break-notification/v1"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakNotificationSchemaVersion = LiteralKit(["sequence-break-notification/v1"]).annotate(
  $I.annote("SequenceBreakNotificationSchemaVersion", {
    description: "Version identifiers accepted by the sequence-break notification ledger.",
  })
);

/**
 * Decoded version carried by a sequence-break notification row.
 *
 * @see {@link SequenceBreakNotificationSchemaVersion} for the runtime schema and supported version.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakNotificationSchemaVersion = typeof SequenceBreakNotificationSchemaVersion.Type;

/**
 * Version discriminator carried by every serialized storm-damping claim.
 *
 * **Example** (Read the current damping version)
 *
 * ```ts
 * import { SequenceBreakDampingSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakDampingSchemaVersion.Enum["sequence-break-damping/v1"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakDampingSchemaVersion = LiteralKit(["sequence-break-damping/v1"]).annotate(
  $I.annote("SequenceBreakDampingSchemaVersion", {
    description: "Version identifiers accepted by the sequence-break storm-damping state.",
  })
);

/**
 * Decoded version carried by serialized storm-damping state.
 *
 * @see {@link SequenceBreakDampingSchemaVersion} for the runtime schema and supported version.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakDampingSchemaVersion = typeof SequenceBreakDampingSchemaVersion.Type;

/**
 * Human-wait population addressed by a sequence-break notification.
 *
 * **Details**
 *
 * `human-input` separates `AskUserQuestion` from other tool permissions without
 * retaining the question or any tool arguments. That split is the measured P1
 * intervention population.
 *
 * **Example** (Select the measured target)
 *
 * ```ts
 * import { SequenceBreakTarget } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakTarget.Enum["human-input"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakTarget = LiteralKit(["human-input", "plan-approval", "tool-permission"]).annotate(
  $I.annote("SequenceBreakTarget", {
    description: "Content-free wait populations that the sequence-break notifier can address.",
  })
);

/**
 * Decoded notification target population.
 *
 * @see {@link SequenceBreakTarget} for the runtime schema and target domain.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakTarget = typeof SequenceBreakTarget.Type;

/**
 * Time-based rung reached by one open wait bracket.
 *
 * **Example** (Select the urgent rung)
 *
 * ```ts
 * import { SequenceBreakNotificationStage } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakNotificationStage.Enum.urgent)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakNotificationStage = LiteralKit(["initial", "reminder", "urgent"]).annotate(
  $I.annote("SequenceBreakNotificationStage", {
    description: "Escalation stages emitted while a human-wait bracket remains open.",
  })
);

/**
 * Decoded escalation stage.
 *
 * @see {@link SequenceBreakNotificationStage} for the runtime schema and escalation stages.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakNotificationStage = typeof SequenceBreakNotificationStage.Type;

/**
 * Delivery channel attempted for one escalation stage.
 *
 * **Example** (Select desktop delivery)
 *
 * ```ts
 * import { SequenceBreakNotificationTransport } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakNotificationTransport.Enum.desktop)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakNotificationTransport = LiteralKit(["desktop", "ntfy"]).annotate(
  $I.annote("SequenceBreakNotificationTransport", {
    description: "Bounded delivery transports used by the sequence-break notifier.",
  })
);

/**
 * Decoded sequence-break delivery transport.
 *
 * @see {@link SequenceBreakNotificationTransport} for the runtime schema and delivery channels.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakNotificationTransport = typeof SequenceBreakNotificationTransport.Type;

/**
 * Content-free reason why a delivery was not attempted.
 *
 * **Example** (Classify absent runtime configuration)
 *
 * ```ts
 * import { SequenceBreakDeliverySkipReason } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakDeliverySkipReason.Enum["transport-unconfigured"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakDeliverySkipReason = LiteralKit([
  "transport-unconfigured",
  "storm-damped",
  "circuit-open",
  "bracket-resolved",
  "bracket-unattributed",
  "coordination-unavailable",
  "instrument-disarmed",
]).annotate(
  $I.annote("SequenceBreakDeliverySkipReason", {
    description: "Bounded reasons a sequence-break notification transport was deliberately skipped.",
  })
);

/**
 * Decoded reason for skipping a delivery attempt.
 *
 * @see {@link SequenceBreakDeliverySkipReason} for the runtime schema and bounded reasons.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakDeliverySkipReason = typeof SequenceBreakDeliverySkipReason.Type;

/**
 * Content-free reason why an attempted delivery failed.
 *
 * **Example** (Classify a missing transport command)
 *
 * ```ts
 * import { SequenceBreakDeliveryFailureReason } from "@beep/repo-ai-metrics"
 *
 * console.log(SequenceBreakDeliveryFailureReason.Enum["command-unavailable"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakDeliveryFailureReason = LiteralKit([
  "command-unavailable",
  "command-failed",
  "timeout",
  "unknown",
]).annotate(
  $I.annote("SequenceBreakDeliveryFailureReason", {
    description: "Bounded failure reasons that retain no transport response or command content.",
  })
);

/**
 * Decoded reason for a failed delivery attempt.
 *
 * @see {@link SequenceBreakDeliveryFailureReason} for the runtime schema and bounded reasons.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakDeliveryFailureReason = typeof SequenceBreakDeliveryFailureReason.Type;

class SequenceBreakDeliverySent extends S.Class<SequenceBreakDeliverySent>($I`SequenceBreakDeliverySent`)(
  { status: S.tag("sent") },
  $I.annote("SequenceBreakDeliverySent", {
    description: "A notification transport accepted the content-free delivery request.",
  })
) {}

class SequenceBreakDeliverySkipped extends S.Class<SequenceBreakDeliverySkipped>($I`SequenceBreakDeliverySkipped`)(
  {
    status: S.tag("skipped"),
    reason: SequenceBreakDeliverySkipReason,
  },
  $I.annote("SequenceBreakDeliverySkipped", {
    description: "A notification transport was deliberately skipped for a bounded operational reason.",
  })
) {}

class SequenceBreakDeliveryFailed extends S.Class<SequenceBreakDeliveryFailed>($I`SequenceBreakDeliveryFailed`)(
  {
    status: S.tag("failed"),
    reason: SequenceBreakDeliveryFailureReason,
  },
  $I.annote("SequenceBreakDeliveryFailed", {
    description: "A notification transport failed without retaining response or command content.",
  })
) {}

/**
 * Outcome of one delivery attempt, with reasons available only when applicable.
 *
 * **Example** (Decode a skipped delivery)
 *
 * ```ts
 * import { SequenceBreakDeliveryOutcome } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(SequenceBreakDeliveryOutcome)({
 *   status: "skipped",
 *   reason: "transport-unconfigured"
 * })
 * console.log(decoded._tag) // "Success"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SequenceBreakDeliveryOutcome = S.Union([
  SequenceBreakDeliverySent,
  SequenceBreakDeliverySkipped,
  SequenceBreakDeliveryFailed,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("SequenceBreakDeliveryOutcome", {
    description: "Tagged delivery result that cannot attach a failure or skip reason to a successful send.",
  })
);

/**
 * Decoded result of one sequence-break delivery attempt.
 *
 * @see {@link SequenceBreakDeliveryOutcome} for the runtime schema and tagged result cases.
 * @category type-level
 * @since 0.0.0
 */
export type SequenceBreakDeliveryOutcome = typeof SequenceBreakDeliveryOutcome.Type;

const waitReasonForTarget = SequenceBreakTarget.$match({
  "human-input": HookPulseWaitReason.thunk["tool-permission"],
  "plan-approval": HookPulseWaitReason.thunk["plan-approval"],
  "tool-permission": HookPulseWaitReason.thunk["tool-permission"],
});
const areHookPulseWaitReasonsEquivalent = S.toEquivalence(HookPulseWaitReason);
const isGreaterThanOrEqualToNumber = Order.isGreaterThanOrEqualTo(Num.Order);

/**
 * Atomic storm-damping claim shared by every clone and worktree.
 *
 * **Details**
 *
 * The state deliberately identifies only a pseudonymous session, bounded wait
 * target, notifier revision, and lease interval. A file lock protects the
 * compare-and-replace operation performed by the shell worker; the expiry
 * invariant prevents malformed state from extending or reversing the claim.
 *
 * **Example** (Claim a human-input notification window)
 *
 * ```ts
 * import { SequenceBreakDampingV1 } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const claim = S.decodeUnknownSync(SequenceBreakDampingV1)({
 *   schemaVersion: "sequence-break-damping/v1",
 *   sessionId: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
 *   target: "human-input",
 *   notifierRev: "desktop-ntfy-1",
 *   claimedEpochMs: 1_788_444_000_000,
 *   expiresEpochMs: 1_788_444_900_000
 * })
 * console.log(claim.target) // "human-input"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SequenceBreakDampingV1 extends S.Class<SequenceBreakDampingV1>($I`SequenceBreakDampingV1`)(
  S.Struct({
    schemaVersion: SequenceBreakDampingSchemaVersion,
    sessionId: Sha256Hex,
    target: SequenceBreakTarget,
    notifierRev: S.NonEmptyString,
    claimedEpochMs: NonNegativeInt,
    expiresEpochMs: NonNegativeInt,
  }).check(
    S.makeFilter((input) => isGreaterThanOrEqualToNumber(input.expiresEpochMs, input.claimedEpochMs), {
      identifier: "SequenceBreakDampingIntervalInvariant",
      title: "Sequence-break damping interval invariant",
      description: "Requires the damping expiry to be at or after the instant the claim was created.",
      message: "Expected expiresEpochMs to be greater than or equal to claimedEpochMs",
    })
  ),
  $I.annote("SequenceBreakDampingV1", {
    description: "Content-free shared claim that damps duplicate sequence-break notifications.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(SequenceBreakDampingV1);
  static readonly encodeEffect = S.encodeUnknownEffect(SequenceBreakDampingV1);
  static readonly decodeResult = S.decodeUnknownResult(SequenceBreakDampingV1);
  static readonly encodeResult = S.encodeResult(SequenceBreakDampingV1);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(SequenceBreakDampingV1));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(SequenceBreakDampingV1));
  static readonly decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(SequenceBreakDampingV1));
  static readonly encodeJsonResult = S.encodeResult(S.fromJsonString(SequenceBreakDampingV1));
}

/**
 * Privacy-safe evidence for one sequence-break delivery decision.
 *
 * **Details**
 *
 * The schema has no prompt, command, tool-argument, tool-result, message, path,
 * response, or free-form error field. The notifier can therefore attest what it
 * tried without turning its operational ledger into a second content store.
 *
 * **Example** (Record an unconfigured phone transport)
 *
 * ```ts
 * import { SequenceBreakNotificationV1 } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(SequenceBreakNotificationV1)({
 *   schemaVersion: "sequence-break-notification/v1",
 *   ts: "2026-09-03T12:00:00.000Z",
 *   requestTs: "2026-09-03T11:59:59.000Z",
 *   sessionId: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
 *   agentKind: "claude-code",
 *   notifierRev: "desktop-ntfy-1",
 *   target: "human-input",
 *   waitReason: "tool-permission",
 *   stage: "initial",
 *   ageMs: 1000,
 *   transport: "ntfy",
 *   delivery: { status: "skipped", reason: "transport-unconfigured" }
 * })
 * console.log(row.target) // "human-input"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SequenceBreakNotificationV1 extends S.Class<SequenceBreakNotificationV1>($I`SequenceBreakNotificationV1`)(
  S.Struct({
    schemaVersion: SequenceBreakNotificationSchemaVersion,
    ts: S.DateTimeUtcFromString,
    requestTs: S.DateTimeUtcFromString,
    sessionId: Sha256Hex,
    agentKind: HookPulseAgentKind,
    notifierRev: S.NonEmptyString,
    target: SequenceBreakTarget,
    waitReason: HookPulseWaitReason,
    stage: SequenceBreakNotificationStage,
    ageMs: NonNegNum,
    evidenceTier: S.Literal("derived").pipe(SchemaUtils.withConstantDefault("derived")),
    transport: SequenceBreakNotificationTransport,
    delivery: SequenceBreakDeliveryOutcome,
  }).check(
    S.makeFilter((input) => areHookPulseWaitReasonsEquivalent(input.waitReason, waitReasonForTarget(input.target)), {
      identifier: "SequenceBreakTargetWaitReasonInvariant",
      title: "Sequence-break target and wait-reason invariant",
      description: "Requires every notification target to retain the hook-pulse wait reason from which it derives.",
      message: "Expected waitReason to agree with the content-free sequence-break target",
    })
  ),
  $I.annote("SequenceBreakNotificationV1", {
    description: "Privacy-safe delivery evidence for one time-based sequence-break notification stage.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(SequenceBreakNotificationV1);
  static readonly encodeEffect = S.encodeUnknownEffect(SequenceBreakNotificationV1);
  static readonly decodeResult = S.decodeUnknownResult(SequenceBreakNotificationV1);
  static readonly encodeResult = S.encodeResult(SequenceBreakNotificationV1);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(SequenceBreakNotificationV1));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(SequenceBreakNotificationV1));
  static readonly decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(SequenceBreakNotificationV1));
  static readonly encodeJsonResult = S.encodeResult(S.fromJsonString(SequenceBreakNotificationV1));
}
