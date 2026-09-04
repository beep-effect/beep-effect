/**
 * Telemetry-v2 session-lease and tombstone-reconciliation contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
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

const withJsonEffectStatics = <Schema extends S.Top>(schema: Schema) =>
  SchemaUtils.withStatics(schema, (self) => ({
    decodeJsonEffect: S.decodeUnknownEffect(S.fromJsonString(self)),
    encodeJsonEffect: S.encodeUnknownEffect(S.fromJsonString(self)),
  }));

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
export class SessionLeaseOpenWait extends S.Class<SessionLeaseOpenWait>($I`SessionLeaseOpenWait`)(
  {
    waitId: Sha256Hex,
    openedAt: S.DateTimeUtcFromString,
    reason: WaitReason,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("SessionLeaseOpenWait", {
    description: "Hash-identified pending wait that suppresses lease-expiry tombstoning.",
  })
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
export class SessionLease extends S.Class<SessionLease>($I`SessionLease`)(
  S.Struct({
    schemaVersion: S.Literal(sessionLeaseSchemaVersion),
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    instrumentClass: InstrumentClass,
    startedAt: S.DateTimeUtcFromString,
    lastObservedAt: S.DateTimeUtcFromString,
    lastEventDigest: Sha256Hex,
    openWaits: S.Array(SessionLeaseOpenWait),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).check(
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
  ),
  $I.annote("SessionLease", {
    description: "Content-free active-session liveness projection renewed by telemetry hook observations.",
  })
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

class SessionLeaseStarted extends S.Class<SessionLeaseStarted>($I`SessionLeaseStarted`)(
  {
    event: S.tag(SessionLeaseEventKind.Enum["session-start"]),
    ...sessionLeaseEventFields,
    sourceKind: AiMetricsTranscriptSource,
    instrumentClass: InstrumentClass,
  },
  $I.annote("SessionLeaseStarted", {
    description: "First liveness observation that creates an active session lease.",
  })
) {}

class SessionLeaseActivity extends S.Class<SessionLeaseActivity>($I`SessionLeaseActivity`)(
  {
    event: S.tag(SessionLeaseEventKind.Enum.activity),
    ...sessionLeaseEventFields,
  },
  $I.annote("SessionLeaseActivity", {
    description: "Content-free hook activity that renews an existing session lease.",
  })
) {}

class SessionLeaseWaitOpened extends S.Class<SessionLeaseWaitOpened>($I`SessionLeaseWaitOpened`)(
  S.Struct({
    event: S.tag(SessionLeaseEventKind.Enum["wait-opened"]),
    ...sessionLeaseEventFields,
    wait: SessionLeaseOpenWait,
  }).check(
    S.makeFilter((input) => DateTime.toEpochMillis(input.observedAt) === DateTime.toEpochMillis(input.wait.openedAt), {
      identifier: "SessionLeaseWaitOpenedTimeInvariant",
      title: "Session-lease wait-opened time invariant",
      description: "Requires the wait-open timestamp to equal its PermissionRequest observation timestamp.",
      message: "Expected wait.openedAt to equal observedAt",
    })
  ),
  $I.annote("SessionLeaseWaitOpened", {
    description: "Strictly attributed PermissionRequest observation that opens a pending wait.",
  })
) {}

class SessionLeaseWaitClosed extends S.Class<SessionLeaseWaitClosed>($I`SessionLeaseWaitClosed`)(
  {
    event: S.tag(SessionLeaseEventKind.Enum["wait-closed"]),
    ...sessionLeaseEventFields,
    waitId: Sha256Hex,
  },
  $I.annote("SessionLeaseWaitClosed", {
    description: "Exact-ID terminal decision observation that closes at most one pending wait.",
  })
) {}

class SessionLeaseEnded extends S.Class<SessionLeaseEnded>($I`SessionLeaseEnded`)(
  {
    event: S.tag(SessionLeaseEventKind.Enum["session-end"]),
    ...sessionLeaseEventFields,
  },
  $I.annote("SessionLeaseEnded", {
    description: "Observed harness terminal event that retires an active lease.",
  })
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
  }),
  withJsonEffectStatics
);

/**
 * Decoded telemetry-v2 session-lease event.
 *
 * @see {@link SessionLeaseEvent} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type SessionLeaseEvent = typeof SessionLeaseEvent.Type;

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

class ActiveSessionLeaseTransition extends S.Class<ActiveSessionLeaseTransition>($I`ActiveSessionLeaseTransition`)(
  {
    status: S.tag(SessionLeaseTransitionStatus.Enum.active),
    outcome: SessionLeaseActiveOutcome,
    lease: SessionLease,
  },
  $I.annote("ActiveSessionLeaseTransition", {
    description: "Accepted lease transition that leaves the session active.",
  })
) {}

class EndedSessionLeaseTransition extends S.Class<EndedSessionLeaseTransition>($I`EndedSessionLeaseTransition`)(
  {
    status: S.tag(SessionLeaseTransitionStatus.Enum.ended),
    finalLease: SessionLease,
    endedAt: S.DateTimeUtcFromString,
    terminalEventDigest: Sha256Hex,
  },
  $I.annote("EndedSessionLeaseTransition", {
    description: "Observed session end carrying the final lease for flight-record composition.",
  })
) {}

class QuarantinedSessionLeaseTransition extends S.Class<QuarantinedSessionLeaseTransition>(
  $I`QuarantinedSessionLeaseTransition`
)(
  {
    status: S.tag(SessionLeaseTransitionStatus.Enum.quarantined),
    sessionId: Sha256Hex,
    eventDigest: Sha256Hex,
    reason: SessionLeaseTransitionFailure,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("QuarantinedSessionLeaseTransition", {
    description: "Content-free refusal of a lease transition whose identity or ordering cannot be trusted.",
  })
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
  }),
  withJsonEffectStatics
);

/**
 * Decoded session-lease transition result.
 *
 * @see {@link SessionLeaseTransition} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type SessionLeaseTransition = typeof SessionLeaseTransition.Type;

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
    Match.discriminatorsExhaustive("event")({
      activity: (activity) =>
        ActiveSessionLeaseTransition.make({
          outcome: SessionLeaseActiveOutcome.Enum.renewed,
          lease: renewLease(lease, activity, lease.openWaits),
        }),
      "wait-opened": (opened) => {
        const duplicate = A.some(lease.openWaits, (wait) => wait.waitId === opened.wait.waitId);
        const openWaits = duplicate ? lease.openWaits : A.append(lease.openWaits, opened.wait);
        return ActiveSessionLeaseTransition.make({
          outcome: duplicate
            ? SessionLeaseActiveOutcome.Enum["wait-open-duplicate"]
            : SessionLeaseActiveOutcome.Enum["wait-opened"],
          lease: renewLease(lease, opened, openWaits),
        });
      },
      "wait-closed": (closed) => {
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
      },
      "session-end": (ended) => {
        const finalLease = renewLease(lease, ended, lease.openWaits);
        return EndedSessionLeaseTransition.make({
          finalLease,
          endedAt: ended.observedAt,
          terminalEventDigest: ended.eventDigest,
        });
      },
    })
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
export class SessionLeaseExpiryCandidate extends S.Class<SessionLeaseExpiryCandidate>($I`SessionLeaseExpiryCandidate`)(
  S.Struct({
    schemaVersion: S.Literal(sessionLeaseExpiryCandidateSchemaVersion),
    lease: SessionLease,
    leaseDigest: Sha256Hex,
    evaluatedAt: S.DateTimeUtcFromString,
    ttlMs: PosInt,
    idleMs: NonNegativeInt,
  }).check(
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
  ),
  $I.annote("SessionLeaseExpiryCandidate", {
    description: "Expired active lease that still requires source and pending-wait reconciliation.",
  })
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
export class SessionLeaseReconciliationEvidence extends S.Class<SessionLeaseReconciliationEvidence>(
  $I`SessionLeaseReconciliationEvidence`
)(
  S.Struct({
    sessionId: Sha256Hex,
    sourceLastObservedAt: S.DateTimeUtcFromString,
    sourceEvidenceDigest: Sha256Hex,
    sourceOpenWaitIds: S.Array(Sha256Hex),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  }).check(
    S.makeFilter((input) => A.length(A.dedupe(input.sourceOpenWaitIds)) === A.length(input.sourceOpenWaitIds), {
      identifier: "SessionLeaseReconciliationEvidenceWaitIdentityInvariant",
      title: "Session-lease reconciliation-evidence wait identity invariant",
      description: "Requires every source-observed open wait digest to appear at most once.",
      message: "Expected every sourceOpenWaitId to be unique",
    })
  ),
  $I.annote("SessionLeaseReconciliationEvidence", {
    description: "Content-addressed transcript or hook-ledger evidence used to confirm a tombstone candidate.",
  })
) {}

const ReconstructedEvidenceTier = LiteralKit([
  EvidenceTier.Enum.reconstructed,
  EvidenceTier.Enum.heuristic,
  EvidenceTier.Enum.unknown,
]);

const atMostReconstructedEvidenceTier = (tiers: ReadonlyArray<EvidenceTier>) =>
  EvidenceTier.$match({
    observed: EvidenceTier.thunk.reconstructed,
    derived: EvidenceTier.thunk.reconstructed,
    reconstructed: EvidenceTier.thunk.reconstructed,
    heuristic: EvidenceTier.thunk.heuristic,
    unknown: EvidenceTier.thunk.unknown,
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
export class SessionLeaseTombstone extends S.Class<SessionLeaseTombstone>($I`SessionLeaseTombstone`)(
  {
    schemaVersion: S.Literal(sessionLeaseTombstoneSchemaVersion),
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    lastObservedAt: S.DateTimeUtcFromString,
    tombstonedAt: S.DateTimeUtcFromString,
    terminalOutcome: S.Literal(TerminalOutcome.Enum.unknown),
    leaseDigest: Sha256Hex,
    sourceEvidenceDigest: Sha256Hex,
    evidenceTier: ReconstructedEvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("SessionLeaseTombstone", {
    description: "Content-free reconstructed terminal marker with an explicitly unknown semantic outcome.",
  })
) {}

const SessionLeaseReconciliationStatus = LiteralKit(["deferred", "tombstoned"]);
const SessionLeaseReconciliationDeferral = LiteralKit([
  "lease-missing",
  "lease-renewed",
  "evidence-session-mismatch",
  "later-source-activity",
  "open-wait",
]);

class DeferredSessionLeaseReconciliation extends S.Class<DeferredSessionLeaseReconciliation>(
  $I`DeferredSessionLeaseReconciliation`
)(
  {
    status: S.tag(SessionLeaseReconciliationStatus.Enum.deferred),
    sessionId: Sha256Hex,
    leaseDigest: Sha256Hex,
    reason: SessionLeaseReconciliationDeferral,
  },
  $I.annote("DeferredSessionLeaseReconciliation", {
    description: "Content-free refusal to synthesize a tombstone while any required gate is unresolved.",
  })
) {}

class TombstonedSessionLeaseReconciliation extends S.Class<TombstonedSessionLeaseReconciliation>(
  $I`TombstonedSessionLeaseReconciliation`
)(
  {
    status: S.tag(SessionLeaseReconciliationStatus.Enum.tombstoned),
    tombstone: SessionLeaseTombstone,
  },
  $I.annote("TombstonedSessionLeaseReconciliation", {
    description: "Reconstructed terminal marker produced after lease and source evidence agree.",
  })
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
  }),
  withJsonEffectStatics
);

/**
 * Decoded expired-lease reconciliation result.
 *
 * @see {@link SessionLeaseReconciliation} for the runtime tagged union.
 * @category models
 * @since 0.0.0
 */
export type SessionLeaseReconciliation = typeof SessionLeaseReconciliation.Type;

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
