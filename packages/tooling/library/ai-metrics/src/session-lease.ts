/**
 * Telemetry-v2 session-lease and tombstone-reconciliation contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { constant, dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PosInt } from "./internal/PosInt.ts";
import { AiMetricsTranscriptSource } from "./models.ts";
import {
  combineOipTaints,
  EvidenceTier,
  InstrumentClass,
  OipTaint,
  TerminalOutcome,
  WaitReason,
  weakestEvidenceTier,
} from "./telemetry-v2.ts";

const $I = $RepoAiMetricsId.create("session-lease");
const sessionLeaseSchemaVersion = "telemetry-v2/session-lease/v1";
const sessionLeaseExpiryCandidateSchemaVersion = "telemetry-v2/session-lease-expiry-candidate/v1";
const sessionLeaseTombstoneSchemaVersion = "telemetry-v2/session-lease-tombstone/v1";

/**
 * Strictly attributed wait that keeps a live session from being tombstoned.
 *
 * **Details**
 *
 * The identifier is computed by the emitter from a matched hook attempt. A
 * close event must repeat this exact digest; neither the reducer nor the later
 * reconciler searches for a convenient neighboring wait.
 *
 * **Example** (Decode a content-free pending wait)
 *
 * ```ts
 * import { SessionLeaseOpenWait } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const wait = S.decodeUnknownSync(SessionLeaseOpenWait)({
 *   waitId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   openedAt: "2026-09-03T12:00:00.000Z",
 *   reason: "tool-permission",
 *   evidenceTier: "derived",
 *   oipTaint: "clear"
 * })
 * console.log(wait.reason) // "tool-permission"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseOpenWait extends S.Opaque<SessionLeaseOpenWait, { readonly brand: unique symbol }>()(
  S.Struct({
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("SessionLeaseOpenWait", {
      description: "Hash-identified pending wait that suppresses lease-expiry tombstoning.",
    })
  )
) {}

const hasUniqueWaitIds = (waits: ReadonlyArray<SessionLeaseOpenWait>): boolean =>
  A.length(A.dedupe(A.map(waits, (wait) => wait.waitId))) === A.length(waits);

/**
 * Mutable liveness projection for one telemetry-v2 session.
 *
 * **Details**
 *
 * Only active sessions have lease files. Every accepted hook observation moves
 * `lastObservedAt` and `lastEventDigest`; pending waits remain explicit and
 * block tombstone synthesis even after the ordinary TTL elapses.
 *
 * **Example** (Inspect the wire version)
 *
 * ```ts
 * import { SessionLease } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLease.fields.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLease extends S.Opaque<SessionLease, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(sessionLeaseSchemaVersion),
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    instrumentClass: InstrumentClass,
    startedAt: S.DateTimeUtcFromString,
    lastObservedAt: S.DateTimeUtcFromString,
    lastEventDigest: Sha256Hex,
    openWaits: S.Array(SessionLeaseOpenWait),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  })
    .check(
      S.makeFilterGroup(
        [
          S.makeFilter(
            (input) => DateTime.toEpochMillis(input.startedAt) <= DateTime.toEpochMillis(input.lastObservedAt),
            {
              identifier: "SessionLeaseTimeInvariant",
              title: "Session-lease time invariant",
              description: "Requires the latest observation to be at or after session start.",
              message: "Expected lastObservedAt to be at or after startedAt",
            }
          ),
          S.makeFilter((input) => hasUniqueWaitIds(input.openWaits), {
            identifier: "SessionLeaseWaitIdentityInvariant",
            title: "Session-lease wait identity invariant",
            description: "Requires every pending wait digest to appear at most once.",
            message: "Expected every open waitId to be unique",
          }),
          S.makeFilter(
            (input) =>
              input.evidenceTier ===
              weakestEvidenceTier([input.evidenceTier, ...A.map(input.openWaits, (wait) => wait.evidenceTier)]),
            {
              identifier: "SessionLeaseEvidenceTierInvariant",
              title: "Session-lease evidence-tier invariant",
              description: "Prevents a lease from outranking any pending-wait evidence it carries.",
              message: "Expected lease evidenceTier to be no stronger than every pending wait tier",
            }
          ),
          S.makeFilter(
            (input) =>
              input.oipTaint === combineOipTaints([input.oipTaint, ...A.map(input.openWaits, (wait) => wait.oipTaint)]),
            {
              identifier: "SessionLeaseOipTaintInvariant",
              title: "Session-lease OIP taint invariant",
              description: "Prevents a lease from weakening the most restrictive pending-wait taint.",
              message: "Expected lease oipTaint to preserve every pending wait taint",
            }
          ),
        ],
        {
          identifier: "SessionLeaseInvariants",
          title: "Session-lease invariants",
          description: "Checks chronological, identity, evidence-tier, and OIP-taint consistency.",
        }
      )
    )
    .pipe(
      $I.annoteSchema("SessionLease", {
        description: "Content-free active-session liveness projection renewed by telemetry hook observations.",
      })
    )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(SessionLease);
  static readonly encodeEffect = S.encodeUnknownEffect(SessionLease);
  static readonly decodeResult = S.decodeUnknownResult(SessionLease);
  static readonly encodeResult = S.encodeResult(SessionLease);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(SessionLease));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(SessionLease));
}

const sessionLeaseEventFields = {
  sessionId: Sha256Hex,
  observedAt: S.DateTimeUtcFromString,
  eventDigest: Sha256Hex,
  evidenceTier: EvidenceTier,
  oipTaint: OipTaint,
};

const SessionLeaseEventKind = LiteralKit(["session-start", "activity", "wait-opened", "wait-closed", "session-end"]);

/**
 * **Example** (Open a lease from SessionStart)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SessionLeaseStarted, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 *
 * console.log(first.status) // => "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseStarted extends S.Opaque<SessionLeaseStarted, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.tag(SessionLeaseEventKind.Enum["session-start"]),
    ...sessionLeaseEventFields,
    sourceKind: AiMetricsTranscriptSource,
    instrumentClass: InstrumentClass,
  }).pipe(
    $I.annoteSchema("SessionLeaseStarted", {
      description: "First liveness observation that creates an active session lease.",
    })
  )
) {}

/**
 * **Example** (Renew a lease on hook activity)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SessionLeaseActivity, SessionLeaseStarted, SessionLeaseTransition, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 * const activity = S.decodeUnknownSync(SessionLeaseActivity)({
 *   event: "activity",
 *   sessionId,
 *   observedAt: "2026-10-14T09:05:00.000Z",
 *   eventDigest: "c".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear"
 * })
 *
 * if (SessionLeaseTransition.guards.active(first)) {
 *   const renewed = transitionSessionLease(O.some(first.lease), activity)
 *   console.log(SessionLeaseTransition.guards.active(renewed) && renewed.outcome) // => "renewed"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseActivity extends S.Opaque<SessionLeaseActivity, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.tag(SessionLeaseEventKind.Enum.activity),
    ...sessionLeaseEventFields,
  }).pipe(
    $I.annoteSchema("SessionLeaseActivity", {
      description: "Content-free hook activity that renews an existing session lease.",
    })
  )
) {}

/**
 * **Details**
 *
 * The wait-open timestamp must equal the PermissionRequest observation timestamp.
 *
 * **Example** (Open a pending permission wait on the lease)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SessionLeaseStarted, SessionLeaseTransition, SessionLeaseWaitOpened, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 * const opened = S.decodeUnknownSync(SessionLeaseWaitOpened)({
 *   event: "wait-opened",
 *   sessionId,
 *   observedAt: "2026-10-14T09:10:00.000Z",
 *   eventDigest: "d".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   wait: { waitId: "e".repeat(64), openedAt: "2026-10-14T09:10:00.000Z", reason: "tool-permission", evidenceTier: "observed", oipTaint: "clear" }
 * })
 *
 * if (SessionLeaseTransition.guards.active(first)) {
 *   const next = transitionSessionLease(O.some(first.lease), opened)
 *   console.log(SessionLeaseTransition.guards.active(next) && next.lease.openWaits.length) // => 1
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseWaitOpened extends S.Opaque<SessionLeaseWaitOpened, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.tag(SessionLeaseEventKind.Enum["wait-opened"]),
    ...sessionLeaseEventFields,
    wait: SessionLeaseOpenWait,
  })
    .check(
      S.makeFilter(
        (input) => DateTime.toEpochMillis(input.observedAt) === DateTime.toEpochMillis(input.wait.openedAt),
        {
          identifier: "SessionLeaseWaitOpenedTimeInvariant",
          title: "Session-lease wait-opened time invariant",
          description: "Requires the wait-open timestamp to equal its PermissionRequest observation timestamp.",
          message: "Expected wait.openedAt to equal observedAt",
        }
      )
    )
    .pipe(
      $I.annoteSchema("SessionLeaseWaitOpened", {
        description: "Strictly attributed PermissionRequest observation that opens a pending wait.",
      })
    )
) {}

/**
 * **Example** (Ignore a close for a wait the lease never opened)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SessionLeaseStarted, SessionLeaseTransition, SessionLeaseWaitClosed, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 * const closed = S.decodeUnknownSync(SessionLeaseWaitClosed)({
 *   event: "wait-closed",
 *   sessionId,
 *   observedAt: "2026-10-14T09:12:00.000Z",
 *   eventDigest: "f".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   waitId: "9".repeat(64)
 * })
 *
 * if (SessionLeaseTransition.guards.active(first)) {
 *   const next = transitionSessionLease(O.some(first.lease), closed)
 *   console.log(SessionLeaseTransition.guards.active(next) && next.outcome) // => "wait-close-unmatched"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseWaitClosed extends S.Opaque<SessionLeaseWaitClosed, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.tag(SessionLeaseEventKind.Enum["wait-closed"]),
    ...sessionLeaseEventFields,
    waitId: Sha256Hex,
  }).pipe(
    $I.annoteSchema("SessionLeaseWaitClosed", {
      description: "Exact-ID terminal decision observation that closes at most one pending wait.",
    })
  )
) {}

/**
 * **Example** (Retire a lease on the harness end event)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SessionLeaseEnded, SessionLeaseStarted, SessionLeaseTransition, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 * const ended = S.decodeUnknownSync(SessionLeaseEnded)({
 *   event: "session-end",
 *   sessionId,
 *   observedAt: "2026-10-14T10:00:00.000Z",
 *   eventDigest: "0".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear"
 * })
 *
 * if (SessionLeaseTransition.guards.active(first)) {
 *   console.log(transitionSessionLease(O.some(first.lease), ended).status) // => "ended"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseEnded extends S.Opaque<SessionLeaseEnded, { readonly brand: unique symbol }>()(
  S.Struct({
    event: S.tag(SessionLeaseEventKind.Enum["session-end"]),
    ...sessionLeaseEventFields,
  }).pipe(
    $I.annoteSchema("SessionLeaseEnded", {
      description: "Observed harness terminal event that retires an active lease.",
    })
  )
) {}

/**
 * Content-free liveness event accepted by the session-lease reducer.
 *
 * **Details**
 *
 * Emitters perform strict hook-attempt attribution and pass only digests into
 * this contract. The reducer therefore cannot match on prompt, command, tool
 * arguments, tool results, paths, or free-form terminal content.
 *
 * **Example** (Recognize a renewal event)
 *
 * ```ts
 * import { SessionLeaseEvent } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SessionLeaseEvent)({ event: "activity" })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionLeaseEvent = S.Union([
  SessionLeaseStarted,
  SessionLeaseActivity,
  SessionLeaseWaitOpened,
  SessionLeaseWaitClosed,
  SessionLeaseEnded,
]).pipe(
  S.toTaggedUnion("event"),
  $I.annoteSchema("SessionLeaseEvent", {
    description: "Start, renewal, exact wait transition, or terminal event for one active-session lease.",
  })
);

/**
 * Decoded telemetry-v2 session-lease event.
 *
 * @see {@link SessionLeaseEvent} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type SessionLeaseEvent = typeof SessionLeaseEvent.Type;

/**
 * SessionLeaseEvent encoded as one JSON string, the line format the telemetry-v2 store
 * appends and reads back.
 *
 * **Example** (Round-trip a session-lease event line)
 *
 * ```ts
 * import { SessionLeaseEventJson } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(SessionLeaseEventJson)
 * console.log(typeof decode) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionLeaseEventJson = S.fromJsonString(SessionLeaseEvent);

const SessionLeaseActiveOutcome = LiteralKit([
  "started",
  "renewed",
  "wait-opened",
  "wait-open-duplicate",
  "wait-closed",
  "wait-close-unmatched",
]);
const SessionLeaseTransitionStatus = LiteralKit(["active", "ended", "quarantined"]);
const SessionLeaseTransitionFailure = LiteralKit([
  "duplicate-start",
  "missing-lease",
  "session-mismatch",
  "time-regression",
]);

/**
 * **Example** (Read the fresh lease from a start transition)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ActiveSessionLeaseTransition, SessionLeaseStarted, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 *
 * if (S.is(ActiveSessionLeaseTransition)(first)) {
 *   console.log(first.outcome) // => "started"
 *   console.log(first.lease.openWaits.length) // => 0
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActiveSessionLeaseTransition extends S.Opaque<
  ActiveSessionLeaseTransition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(SessionLeaseTransitionStatus.Enum.active),
    outcome: SessionLeaseActiveOutcome,
    lease: SessionLease,
  }).pipe(
    $I.annoteSchema("ActiveSessionLeaseTransition", {
      description: "Accepted lease transition that leaves the session active.",
    })
  )
) {}

/**
 * **Example** (Hand the final lease to flight-record composition)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EndedSessionLeaseTransition, SessionLeaseEnded, SessionLeaseStarted, SessionLeaseTransition, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const sessionId = "a".repeat(64)
 * const started = S.decodeUnknownSync(SessionLeaseStarted)({
 *   event: "session-start",
 *   sessionId,
 *   observedAt: "2026-10-14T09:00:00.000Z",
 *   eventDigest: "b".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear",
 *   sourceKind: "claude",
 *   instrumentClass: "production"
 * })
 * const first = transitionSessionLease(O.none(), started)
 * const ended = S.decodeUnknownSync(SessionLeaseEnded)({
 *   event: "session-end",
 *   sessionId,
 *   observedAt: "2026-10-14T10:00:00.000Z",
 *   eventDigest: "0".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear"
 * })
 *
 * if (SessionLeaseTransition.guards.active(first)) {
 *   const last = transitionSessionLease(O.some(first.lease), ended)
 *   if (S.is(EndedSessionLeaseTransition)(last)) {
 *     console.log(last.terminalEventDigest === ended.eventDigest) // => true
 *   }
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EndedSessionLeaseTransition extends S.Opaque<
  EndedSessionLeaseTransition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(SessionLeaseTransitionStatus.Enum.ended),
    finalLease: SessionLease,
    endedAt: S.DateTimeUtcFromString,
    terminalEventDigest: Sha256Hex,
  }).pipe(
    $I.annoteSchema("EndedSessionLeaseTransition", {
      description: "Observed session end carrying the final lease for flight-record composition.",
    })
  )
) {}

/**
 * **Example** (Quarantine activity that arrives before SessionStart)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { QuarantinedSessionLeaseTransition, SessionLeaseActivity, transitionSessionLease } from "@beep/repo-ai-metrics/session-lease"
 *
 * const activity = S.decodeUnknownSync(SessionLeaseActivity)({
 *   event: "activity",
 *   sessionId: "a".repeat(64),
 *   observedAt: "2026-10-14T09:05:00.000Z",
 *   eventDigest: "c".repeat(64),
 *   evidenceTier: "observed",
 *   oipTaint: "clear"
 * })
 * const result = transitionSessionLease(O.none(), activity)
 *
 * if (S.is(QuarantinedSessionLeaseTransition)(result)) {
 *   console.log(result.reason) // => "missing-lease"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuarantinedSessionLeaseTransition extends S.Opaque<
  QuarantinedSessionLeaseTransition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(SessionLeaseTransitionStatus.Enum.quarantined),
    sessionId: Sha256Hex,
    eventDigest: Sha256Hex,
    reason: SessionLeaseTransitionFailure,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("QuarantinedSessionLeaseTransition", {
      description: "Content-free refusal of a lease transition whose identity or ordering cannot be trusted.",
    })
  )
) {}

/**
 * Result of applying one event to an optional active session lease.
 *
 * **Example** (Distinguish an active projection from a terminal one)
 *
 * ```ts
 * import { SessionLeaseTransition } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseTransition.members.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionLeaseTransition = S.Union([
  ActiveSessionLeaseTransition,
  EndedSessionLeaseTransition,
  QuarantinedSessionLeaseTransition,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("SessionLeaseTransition", {
    description: "Active, ended, or content-free quarantined session-lease transition.",
  })
);

/**
 * Decoded session-lease transition result.
 *
 * @see {@link SessionLeaseTransition} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type SessionLeaseTransition = typeof SessionLeaseTransition.Type;

/**
 * SessionLeaseTransition encoded as one JSON string, the line format the telemetry-v2 store
 * appends and reads back.
 *
 * **Example** (Round-trip a session-lease transition line)
 *
 * ```ts
 * import { SessionLeaseTransitionJson } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(SessionLeaseTransitionJson)
 * console.log(typeof decode) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionLeaseTransitionJson = S.fromJsonString(SessionLeaseTransition);

const quarantineTransition = (
  event: SessionLeaseEvent,
  reason: typeof SessionLeaseTransitionFailure.Type
): SessionLeaseTransition =>
  QuarantinedSessionLeaseTransition.make({
    sessionId: event.sessionId,
    eventDigest: event.eventDigest,
    reason,
    evidenceTier: event.evidenceTier,
    oipTaint: event.oipTaint,
  });

const renewLease = (
  lease: SessionLease,
  event: Exclude<SessionLeaseEvent, { readonly event: "session-start" }>,
  openWaits: ReadonlyArray<SessionLeaseOpenWait>
): SessionLease =>
  SessionLease.make({
    ...lease,
    lastObservedAt: event.observedAt,
    lastEventDigest: event.eventDigest,
    openWaits,
    evidenceTier: weakestEvidenceTier([
      lease.evidenceTier,
      event.evidenceTier,
      ...A.map(openWaits, (wait) => wait.evidenceTier),
    ]),
    oipTaint: combineOipTaints([lease.oipTaint, event.oipTaint, ...A.map(openWaits, (wait) => wait.oipTaint)]),
  });

const transitionExistingLease = (
  lease: SessionLease,
  event: Exclude<SessionLeaseEvent, { readonly event: "session-start" }>
): SessionLeaseTransition => {
  if (lease.sessionId !== event.sessionId) {
    return quarantineTransition(event, SessionLeaseTransitionFailure.Enum["session-mismatch"]);
  }
  if (DateTime.toEpochMillis(event.observedAt) < DateTime.toEpochMillis(lease.lastObservedAt)) {
    return quarantineTransition(event, SessionLeaseTransitionFailure.Enum["time-regression"]);
  }

  return Match.value(event).pipe(
    Match.discriminator("event")("activity", (activity) =>
      ActiveSessionLeaseTransition.make({
        outcome: SessionLeaseActiveOutcome.Enum.renewed,
        lease: renewLease(lease, activity, lease.openWaits),
      })
    ),
    Match.discriminator("event")("wait-opened", (opened) => {
      const duplicate = A.some(lease.openWaits, (wait) => wait.waitId === opened.wait.waitId);
      const openWaits = duplicate ? lease.openWaits : A.append(lease.openWaits, opened.wait);
      return ActiveSessionLeaseTransition.make({
        outcome: duplicate
          ? SessionLeaseActiveOutcome.Enum["wait-open-duplicate"]
          : SessionLeaseActiveOutcome.Enum["wait-opened"],
        lease: renewLease(lease, opened, openWaits),
      });
    }),
    Match.discriminator("event")("wait-closed", (closed) => {
      const matched = A.some(lease.openWaits, (wait) => wait.waitId === closed.waitId);
      return ActiveSessionLeaseTransition.make({
        outcome: matched
          ? SessionLeaseActiveOutcome.Enum["wait-closed"]
          : SessionLeaseActiveOutcome.Enum["wait-close-unmatched"],
        lease: renewLease(
          lease,
          closed,
          A.filter(lease.openWaits, (wait) => wait.waitId !== closed.waitId)
        ),
      });
    }),
    Match.discriminator("event")("session-end", (ended) => {
      const finalLease = renewLease(lease, ended, lease.openWaits);
      return EndedSessionLeaseTransition.make({
        finalLease,
        endedAt: ended.observedAt,
        terminalEventDigest: ended.eventDigest,
      });
    }),
    Match.exhaustive
  );
};

/**
 * Apply one strict liveness event to an optional active session lease.
 *
 * **Details**
 *
 * A missing start, identity disagreement, or backwards event is quarantined.
 * An unmatched wait close still renews liveness but leaves every pending wait
 * untouched. This makes the safe failure mode a delayed tombstone rather than
 * a fabricated closure.
 *
 * **Example** (Refuse activity without SessionStart)
 *
 * ```ts
 * import { SessionLeaseEvent, transitionSessionLease } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(SessionLeaseEvent)({
 *   event: "activity",
 *   sessionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   observedAt: "2026-09-03T12:00:00.000Z",
 *   eventDigest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
 *   evidenceTier: "derived",
 *   oipTaint: "clear"
 * })
 * console.log(transitionSessionLease(O.none(), event).status) // "quarantined"
 * ```
 *
 * @param current - Current active lease, or `None` before SessionStart.
 * @param event - Strictly attributed, content-free liveness event.
 * @returns Active, ended, or quarantined transition evidence.
 * @category utilities
 * @since 0.0.0
 */
export const transitionSessionLease: {
  (event: SessionLeaseEvent): (current: O.Option<SessionLease>) => SessionLeaseTransition;
  (current: O.Option<SessionLease>, event: SessionLeaseEvent): SessionLeaseTransition;
} = dual(
  2,
  (current: O.Option<SessionLease>, event: SessionLeaseEvent): SessionLeaseTransition =>
    O.match(current, {
      onNone: () =>
        SessionLeaseEvent.match({
          "session-start": (started) =>
            ActiveSessionLeaseTransition.make({
              outcome: SessionLeaseActiveOutcome.Enum.started,
              lease: SessionLease.make({
                schemaVersion: sessionLeaseSchemaVersion,
                sessionId: started.sessionId,
                sourceKind: started.sourceKind,
                instrumentClass: started.instrumentClass,
                startedAt: started.observedAt,
                lastObservedAt: started.observedAt,
                lastEventDigest: started.eventDigest,
                openWaits: [],
                evidenceTier: started.evidenceTier,
                oipTaint: started.oipTaint,
              }),
            }),
          activity: (activity) => quarantineTransition(activity, SessionLeaseTransitionFailure.Enum["missing-lease"]),
          "wait-opened": (opened) => quarantineTransition(opened, SessionLeaseTransitionFailure.Enum["missing-lease"]),
          "wait-closed": (closed) => quarantineTransition(closed, SessionLeaseTransitionFailure.Enum["missing-lease"]),
          "session-end": (ended) => quarantineTransition(ended, SessionLeaseTransitionFailure.Enum["missing-lease"]),
        })(event),
      onSome: (lease) =>
        SessionLeaseEvent.match({
          "session-start": (started) =>
            quarantineTransition(started, SessionLeaseTransitionFailure.Enum["duplicate-start"]),
          activity: (activity) => transitionExistingLease(lease, activity),
          "wait-opened": (opened) => transitionExistingLease(lease, opened),
          "wait-closed": (closed) => transitionExistingLease(lease, closed),
          "session-end": (ended) => transitionExistingLease(lease, ended),
        })(event),
    })
);

/**
 * TTL-expired lease awaiting independent source reconciliation.
 *
 * **Details**
 *
 * This schema is deliberately not a tombstone. It records only that the active
 * lease exceeded its TTL at one instant; later activity or a pending wait can
 * still veto terminal synthesis.
 *
 * **Example** (Inspect the candidate version)
 *
 * ```ts
 * import { SessionLeaseExpiryCandidate } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseExpiryCandidate.fields.ttlMs)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseExpiryCandidate extends S.Opaque<
  SessionLeaseExpiryCandidate,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag(sessionLeaseExpiryCandidateSchemaVersion),
    lease: SessionLease,
    leaseDigest: Sha256Hex,
    evaluatedAt: S.DateTimeUtcFromString,
    ttlMs: PosInt,
    idleMs: S.Natural,
  })
    .check(
      S.makeFilter(
        (input) => {
          const measuredIdle =
            DateTime.toEpochMillis(input.evaluatedAt) - DateTime.toEpochMillis(input.lease.lastObservedAt);
          return measuredIdle === input.idleMs && input.idleMs >= input.ttlMs;
        },
        {
          identifier: "SessionLeaseExpiryCandidateInvariant",
          title: "Session-lease expiry-candidate invariant",
          description: "Requires an exact non-negative idle duration at least as large as the declared TTL.",
          message: "Expected idleMs to equal evaluatedAt minus lastObservedAt and meet ttlMs",
        }
      )
    )
    .pipe(
      $I.annoteSchema("SessionLeaseExpiryCandidate", {
        description: "Expired active lease that still requires source and pending-wait reconciliation.",
      })
    )
) {}

/**
 * Independent source evidence consulted before an expired lease can tombstone.
 *
 * **Example** (Declare that source replay found no open waits)
 *
 * ```ts
 * import { SessionLeaseReconciliationEvidence } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseReconciliationEvidence.fields.sourceOpenWaitIds)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseReconciliationEvidence extends S.Opaque<
  SessionLeaseReconciliationEvidence,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    sessionId: Sha256Hex,
    sourceLastObservedAt: S.DateTimeUtcFromString,
    sourceEvidenceDigest: Sha256Hex,
    sourceOpenWaitIds: S.Array(Sha256Hex),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  })
    .check(
      S.makeFilter((input) => A.length(A.dedupe(input.sourceOpenWaitIds)) === A.length(input.sourceOpenWaitIds), {
        identifier: "SessionLeaseReconciliationEvidenceWaitIdentityInvariant",
        title: "Session-lease reconciliation-evidence wait identity invariant",
        description: "Requires every source-observed open wait digest to appear at most once.",
        message: "Expected every sourceOpenWaitId to be unique",
      })
    )
    .pipe(
      $I.annoteSchema("SessionLeaseReconciliationEvidence", {
        description: "Content-addressed transcript or hook-ledger evidence used to confirm a tombstone candidate.",
      })
    )
) {}

const ReconstructedEvidenceTier = LiteralKit([
  EvidenceTier.Enum.reconstructed,
  EvidenceTier.Enum.heuristic,
  EvidenceTier.Enum.unknown,
]);

const atMostReconstructedEvidenceTier = (tiers: ReadonlyArray<EvidenceTier>) =>
  EvidenceTier.match({
    observed: constant(EvidenceTier.Enum.reconstructed),
    derived: constant(EvidenceTier.Enum.reconstructed),
    reconstructed: constant(EvidenceTier.Enum.reconstructed),
    heuristic: constant(EvidenceTier.Enum.heuristic),
    unknown: constant(EvidenceTier.Enum.unknown),
  })(weakestEvidenceTier(tiers));

/**
 * Reconstructed terminal evidence produced only after all tombstone vetoes pass.
 *
 * **Example** (Inspect the honest terminal outcome)
 *
 * ```ts
 * import { SessionLeaseTombstone } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseTombstone.fields.terminalOutcome)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseTombstone extends S.Opaque<SessionLeaseTombstone, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(sessionLeaseTombstoneSchemaVersion),
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    lastObservedAt: S.DateTimeUtcFromString,
    tombstonedAt: S.DateTimeUtcFromString,
    terminalOutcome: S.tag(TerminalOutcome.Enum.unknown),
    leaseDigest: Sha256Hex,
    sourceEvidenceDigest: Sha256Hex,
    evidenceTier: ReconstructedEvidenceTier,
    oipTaint: OipTaint,
  }).pipe(
    $I.annoteSchema("SessionLeaseTombstone", {
      description: "Content-free reconstructed terminal marker with an explicitly unknown semantic outcome.",
    })
  )
) {}

const SessionLeaseReconciliationStatus = LiteralKit(["deferred", "tombstoned"]);
const SessionLeaseReconciliationDeferral = LiteralKit([
  "lease-missing",
  "lease-renewed",
  "evidence-session-mismatch",
  "later-source-activity",
  "open-wait",
]);

/**
 * **Example** (Defer a tombstone while a wait is still open)
 *
 * ```ts
 * import { DeferredSessionLeaseReconciliation, SessionLeaseReconciliation } from "@beep/repo-ai-metrics/session-lease"
 * import * as S from "effect/Schema"
 *
 * const deferred = S.decodeUnknownSync(DeferredSessionLeaseReconciliation)({
 *   status: "deferred",
 *   sessionId: "a".repeat(64),
 *   leaseDigest: "1".repeat(64),
 *   reason: "open-wait"
 * })
 *
 * console.log(SessionLeaseReconciliation.guards.deferred(deferred)) // => true
 * console.log(deferred.reason) // => "open-wait"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeferredSessionLeaseReconciliation extends S.Opaque<
  DeferredSessionLeaseReconciliation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(SessionLeaseReconciliationStatus.Enum.deferred),
    sessionId: Sha256Hex,
    leaseDigest: Sha256Hex,
    reason: SessionLeaseReconciliationDeferral,
  }).pipe(
    $I.annoteSchema("DeferredSessionLeaseReconciliation", {
      description: "Content-free refusal to synthesize a tombstone while any required gate is unresolved.",
    })
  )
) {}

/**
 * **Example** (Tombstone an expired lease with an honest unknown outcome)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TombstonedSessionLeaseReconciliation } from "@beep/repo-ai-metrics/session-lease"
 *
 * const reconciliation = S.decodeUnknownSync(TombstonedSessionLeaseReconciliation)({
 *   status: "tombstoned",
 *   tombstone: {
 *     schemaVersion: "telemetry-v2/session-lease-tombstone/v1",
 *     sessionId: "a".repeat(64),
 *     sourceKind: "claude",
 *     lastObservedAt: "2026-10-14T09:05:00.000Z",
 *     tombstonedAt: "2026-10-14T13:05:00.000Z",
 *     terminalOutcome: "unknown",
 *     leaseDigest: "1".repeat(64),
 *     sourceEvidenceDigest: "2".repeat(64),
 *     evidenceTier: "reconstructed",
 *     oipTaint: "clear"
 *   }
 * })
 *
 * console.log(reconciliation.tombstone.terminalOutcome) // => "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TombstonedSessionLeaseReconciliation extends S.Opaque<
  TombstonedSessionLeaseReconciliation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.tag(SessionLeaseReconciliationStatus.Enum.tombstoned),
    tombstone: SessionLeaseTombstone,
  }).pipe(
    $I.annoteSchema("TombstonedSessionLeaseReconciliation", {
      description: "Reconstructed terminal marker produced after lease and source evidence agree.",
    })
  )
) {}

/**
 * Deferred or completed reconciliation of an expired session lease.
 *
 * **Example** (Count the possible outcomes)
 *
 * ```ts
 * import { SessionLeaseReconciliation } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseReconciliation.members.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionLeaseReconciliation = S.Union([
  DeferredSessionLeaseReconciliation,
  TombstonedSessionLeaseReconciliation,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("SessionLeaseReconciliation", {
    description: "Explicit tombstone decision retaining every veto as a bounded deferral reason.",
  })
);

/**
 * Decoded expired-lease reconciliation result.
 *
 * @see {@link SessionLeaseReconciliation} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type SessionLeaseReconciliation = typeof SessionLeaseReconciliation.Type;

/**
 * SessionLeaseReconciliation encoded as one JSON string, the line format the telemetry-v2 store
 * appends and reads back.
 *
 * **Example** (Round-trip a session-lease reconciliation line)
 *
 * ```ts
 * import { SessionLeaseReconciliationJson } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(SessionLeaseReconciliationJson)
 * console.log(typeof decode) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SessionLeaseReconciliationJson = S.fromJsonString(SessionLeaseReconciliation);

const deferReconciliation = (
  candidate: SessionLeaseExpiryCandidate,
  reason: typeof SessionLeaseReconciliationDeferral.Type
): SessionLeaseReconciliation =>
  DeferredSessionLeaseReconciliation.make({
    sessionId: candidate.lease.sessionId,
    leaseDigest: candidate.leaseDigest,
    reason,
  });

/**
 * Reconcile an expired candidate against the current lease and source witness.
 *
 * **Details**
 *
 * The candidate tombstones only when the live lease digest is unchanged, both
 * lease and source evidence contain no open wait, and source replay observes
 * no activity later than the lease. The semantic outcome stays `unknown`;
 * absence of a clean SessionEnd is not evidence of failure or abandonment.
 *
 * **Example** (A removed lease defers instead of fabricating a terminal)
 *
 * ```ts
 * import { reconcileExpiredSessionLease } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * console.log(typeof reconcileExpiredSessionLease) // "function"
 * console.log(O.isNone(O.none())) // true
 * ```
 *
 * @param candidate - TTL-expired lease candidate.
 * @param currentLeaseDigest - Digest reread from the active lease immediately before reconciliation.
 * @param evidence - Independent source evidence for later activity and open waits.
 * @returns A bounded deferral or reconstructed tombstone.
 * @category utilities
 * @since 0.0.0
 */
export const reconcileExpiredSessionLease: {
  (
    currentLeaseDigest: O.Option<Sha256Hex>,
    evidence: SessionLeaseReconciliationEvidence
  ): (candidate: SessionLeaseExpiryCandidate) => SessionLeaseReconciliation;
  (
    candidate: SessionLeaseExpiryCandidate,
    currentLeaseDigest: O.Option<Sha256Hex>,
    evidence: SessionLeaseReconciliationEvidence
  ): SessionLeaseReconciliation;
} = dual(
  3,
  (
    candidate: SessionLeaseExpiryCandidate,
    currentLeaseDigest: O.Option<Sha256Hex>,
    evidence: SessionLeaseReconciliationEvidence
  ): SessionLeaseReconciliation => {
    if (O.isNone(currentLeaseDigest)) {
      return deferReconciliation(candidate, SessionLeaseReconciliationDeferral.Enum["lease-missing"]);
    }
    if (currentLeaseDigest.value !== candidate.leaseDigest) {
      return deferReconciliation(candidate, SessionLeaseReconciliationDeferral.Enum["lease-renewed"]);
    }
    if (evidence.sessionId !== candidate.lease.sessionId) {
      return deferReconciliation(candidate, SessionLeaseReconciliationDeferral.Enum["evidence-session-mismatch"]);
    }
    if (A.isReadonlyArrayNonEmpty(candidate.lease.openWaits) || A.isReadonlyArrayNonEmpty(evidence.sourceOpenWaitIds)) {
      return deferReconciliation(candidate, SessionLeaseReconciliationDeferral.Enum["open-wait"]);
    }
    if (
      DateTime.toEpochMillis(evidence.sourceLastObservedAt) > DateTime.toEpochMillis(candidate.lease.lastObservedAt)
    ) {
      return deferReconciliation(candidate, SessionLeaseReconciliationDeferral.Enum["later-source-activity"]);
    }

    return TombstonedSessionLeaseReconciliation.make({
      tombstone: SessionLeaseTombstone.make({
        schemaVersion: sessionLeaseTombstoneSchemaVersion,
        sessionId: candidate.lease.sessionId,
        sourceKind: candidate.lease.sourceKind,
        lastObservedAt: candidate.lease.lastObservedAt,
        tombstonedAt: candidate.evaluatedAt,
        terminalOutcome: TerminalOutcome.Enum.unknown,
        leaseDigest: candidate.leaseDigest,
        sourceEvidenceDigest: evidence.sourceEvidenceDigest,
        evidenceTier: atMostReconstructedEvidenceTier([
          EvidenceTier.Enum.reconstructed,
          candidate.lease.evidenceTier,
          evidence.evidenceTier,
        ]),
        oipTaint: combineOipTaints([candidate.lease.oipTaint, evidence.oipTaint]),
      }),
    });
  }
);
