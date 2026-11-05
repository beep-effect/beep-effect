import {
  reconcileExpiredSessionLease,
  SessionLease,
  SessionLeaseEvent,
  SessionLeaseExpiryCandidate,
  SessionLeaseReconciliationEvidence,
  SessionLeaseReconciliationJson,
  transitionSessionLease,
} from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SessionLeaseReconciliation, SessionLeaseTransition } from "@beep/repo-ai-metrics";

const decodeSessionLeaseExpiryCandidateResult = S.decodeResult(SessionLeaseExpiryCandidate);
const decodeEvent = S.decodeUnknownEffect(SessionLeaseEvent);
const encodeEvent = S.encodeUnknownEffect(SessionLeaseEvent);
const decodeCandidate = S.decodeUnknownEffect(SessionLeaseExpiryCandidate);
const encodeCandidate = S.encodeUnknownEffect(SessionLeaseExpiryCandidate);
const decodeEvidence = S.decodeUnknownEffect(SessionLeaseReconciliationEvidence);
const encodeCandidateJson = S.encodeUnknownEffect(S.fromJsonString(SessionLeaseExpiryCandidate));
const encodeEvidenceJson = S.encodeUnknownEffect(S.fromJsonString(SessionLeaseReconciliationEvidence));

const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const hashC = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const hashD = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const hashE = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const hashF = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const leaseEquivalent = S.toEquivalence(SessionLease);
const eventEquivalent = S.toEquivalence(SessionLeaseEvent);

const startEvent = decodeEvent({
  event: "session-start",
  sessionId: hashA,
  observedAt: "2026-09-03T12:00:00.000Z",
  eventDigest: hashB,
  evidenceTier: "derived",
  oipTaint: "clear",
  sourceKind: "codex",
  instrumentClass: "production",
});

const activeLease = (transition: SessionLeaseTransition): SessionLease => {
  expect(transition.status).toBe("active");
  if (transition.status !== "active") throw new Error("Expected active session lease transition");
  return transition.lease;
};

const startedLease = Effect.fnUntraced(function* () {
  const argument = O.none();
  const startEvent1 = yield* startEvent;
  return activeLease(transitionSessionLease(argument, startEvent1));
});

const activityEvent = (observedAt = "2026-09-03T12:01:00.000Z", eventDigest = hashC, sessionId = hashA) =>
  decodeEvent({
    event: "activity",
    sessionId,
    observedAt,
    eventDigest,
    evidenceTier: "observed",
    oipTaint: "unknown",
  });

const openWaitEvent = decodeEvent({
  event: "wait-opened",
  sessionId: hashA,
  observedAt: "2026-09-03T12:02:00.000Z",
  eventDigest: hashD,
  evidenceTier: "derived",
  oipTaint: "clear",
  wait: {
    waitId: hashE,
    openedAt: "2026-09-03T12:02:00.000Z",
    reason: "tool-permission",
    evidenceTier: "derived",
    oipTaint: "clear",
  },
});

const candidateFrom = Effect.fnUntraced(function* (lease: SessionLease, leaseDigest = hashF) {
  const encodedLease = yield* SessionLease.encodeEffect(lease);
  return yield* decodeCandidate({
    schemaVersion: "telemetry-v2/session-lease-expiry-candidate/v1",
    lease: encodedLease,
    leaseDigest,
    evaluatedAt: "2026-09-03T12:11:00.000Z",
    ttlMs: 600_000,
    idleMs: 600_000,
  });
});

const reconciliationEvidence = (overrides: Record<string, unknown> = {}) =>
  decodeEvidence({
    sessionId: hashA,
    sourceLastObservedAt: "2026-09-03T12:01:00.000Z",
    sourceEvidenceDigest: hashD,
    sourceOpenWaitIds: [],
    evidenceTier: "derived",
    oipTaint: "clear",
    ...overrides,
  });

const reconciliationStatus = (result: SessionLeaseReconciliation) => result.status;

describe("telemetry-v2 session leases", () => {
  it.effect.prop(
    "round-trips schema-generated leases and liveness events",
    [Arbitrary.schema(SessionLease), Arbitrary.schema(SessionLeaseEvent)],
    Effect.fnUntraced(function* ([lease, event]) {
      const encodedEffect = yield* SessionLease.encodeEffect(lease);
      const roundTrippedLease = yield* SessionLease.decodeEffect(encodedEffect);

      const encodedEvent = yield* encodeEvent(event);
      const roundTrippedEvent = yield* decodeEvent(encodedEvent);

      pipe(leaseEquivalent(lease, roundTrippedLease), assertTrue);

      pipe(eventEquivalent(event, roundTrippedEvent), assertTrue);
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("creates a lease only from SessionStart and renews on ordinary activity", () =>
    Effect.gen(function* () {
      const argument1 = O.none();
      const startEvent2 = yield* startEvent;
      const started = transitionSessionLease(argument1, startEvent2);
      const lease = activeLease(started);
      const argument2 = O.some(lease);
      const activityEvent3 = yield* activityEvent();
      const renewed = transitionSessionLease(argument2, activityEvent3);
      const renewedLease = activeLease(renewed);

      expect(started.status === "active" && started.outcome).toBe("started");
      expect(renewed.status === "active" && renewed.outcome).toBe("renewed");
      expect(renewedLease.lastEventDigest).toBe(hashC);
      expect(renewedLease.evidenceTier).toBe("derived");
      expect(renewedLease.oipTaint).toBe("unknown");
    })
  );

  it.effect("quarantines missing, duplicate, and backwards transitions", () =>
    Effect.gen(function* () {
      const argument3 = O.none();
      const activityEvent4 = yield* activityEvent();
      const missing = transitionSessionLease(argument3, activityEvent4);
      const argument4 = O.none();
      const openWaitEvent5 = yield* openWaitEvent;
      const missingOpen = transitionSessionLease(argument4, openWaitEvent5);
      const argument5 = O.none();
      const decodedEvent = yield* decodeEvent({
        event: "wait-closed",
        sessionId: hashA,
        observedAt: "2026-09-03T12:03:00.000Z",
        eventDigest: hashF,
        waitId: hashE,
        evidenceTier: "derived",
        oipTaint: "clear",
      });
      const missingClose = transitionSessionLease(argument5, decodedEvent);
      const argument6 = O.none();
      const decodedEvent6 = yield* decodeEvent({
        event: "session-end",
        sessionId: hashA,
        observedAt: "2026-09-03T12:05:00.000Z",
        eventDigest: hashF,
        evidenceTier: "derived",
        oipTaint: "clear",
      });
      const missingEnd = transitionSessionLease(argument6, decodedEvent6);
      const lease = yield* startedLease();
      const argument7 = O.some(lease);
      const startEvent7 = yield* startEvent;
      const duplicate = transitionSessionLease(argument7, startEvent7);
      const argument8 = O.some(lease);
      const activityEvent8 = yield* activityEvent("2026-09-03T11:59:59.000Z", hashD);
      const backwards = transitionSessionLease(argument8, activityEvent8);
      const argument9 = O.some(lease);
      const activityEvent9 = yield* activityEvent("2026-09-03T12:01:00.000Z", hashC, hashB);
      const mismatched = transitionSessionLease(argument9, activityEvent9);

      expect(missing.status === "quarantined" && missing.reason).toBe("missing-lease");
      expect(missingOpen.status === "quarantined" && missingOpen.reason).toBe("missing-lease");
      expect(missingClose.status === "quarantined" && missingClose.reason).toBe("missing-lease");
      expect(missingEnd.status === "quarantined" && missingEnd.reason).toBe("missing-lease");
      expect(duplicate.status === "quarantined" && duplicate.reason).toBe("duplicate-start");
      expect(backwards.status === "quarantined" && backwards.reason).toBe("time-regression");
      expect(mismatched.status === "quarantined" && mismatched.reason).toBe("session-mismatch");
    })
  );

  it.effect("closes only the exact pending wait and keeps an unmatched close open", () =>
    Effect.gen(function* () {
      const startedLease1 = yield* startedLease();
      const argument10 = O.some(startedLease1);
      const openWaitEvent10 = yield* openWaitEvent;
      const opened = transitionSessionLease(argument10, openWaitEvent10);
      const openedLease = activeLease(opened);
      const argument11 = O.some(openedLease);
      const openWaitEvent11 = yield* openWaitEvent;
      const duplicate = transitionSessionLease(argument11, openWaitEvent11);
      const duplicateLease = activeLease(duplicate);
      const argument12 = O.some(duplicateLease);
      const decodedEvent12 = yield* decodeEvent({
        event: "wait-closed",
        sessionId: hashA,
        observedAt: "2026-09-03T12:03:00.000Z",
        eventDigest: hashF,
        waitId: hashB,
        evidenceTier: "derived",
        oipTaint: "clear",
      });
      const unmatched = transitionSessionLease(argument12, decodedEvent12);
      const unmatchedLease = activeLease(unmatched);
      const argument13 = O.some(unmatchedLease);
      const decodedEvent13 = yield* decodeEvent({
        event: "wait-closed",
        sessionId: hashA,
        observedAt: "2026-09-03T12:04:00.000Z",
        eventDigest: hashC,
        waitId: hashE,
        evidenceTier: "derived",
        oipTaint: "clear",
      });
      const matched = transitionSessionLease(argument13, decodedEvent13);

      expect(opened.status === "active" && opened.outcome).toBe("wait-opened");
      expect(duplicate.status === "active" && duplicate.outcome).toBe("wait-open-duplicate");
      expect(duplicateLease.openWaits).toHaveLength(1);
      expect(unmatched.status === "active" && unmatched.outcome).toBe("wait-close-unmatched");
      expect(unmatchedLease.openWaits).toHaveLength(1);
      expect(matched.status === "active" && matched.outcome).toBe("wait-closed");
      expect(activeLease(matched).openWaits).toHaveLength(0);
    })
  );

  it.effect("carries pending waits into the observed terminal result for honest tombstoning", () =>
    Effect.gen(function* () {
      const startedLease2 = yield* startedLease();
      const argument14 = O.some(startedLease2);
      const openWaitEvent14 = yield* openWaitEvent;
      const openedLease = activeLease(transitionSessionLease(argument14, openWaitEvent14));
      const argument15 = O.some(openedLease);
      const decodedEvent15 = yield* decodeEvent({
        event: "session-end",
        sessionId: hashA,
        observedAt: "2026-09-03T12:05:00.000Z",
        eventDigest: hashF,
        evidenceTier: "derived",
        oipTaint: "clear",
      });
      const ended = transitionSessionLease(argument15, decodedEvent15);

      expect(ended.status).toBe("ended");
      if (ended.status !== "ended") throw new Error("Expected ended session lease transition");
      expect(ended.finalLease.openWaits).toHaveLength(1);
      expect(ended.terminalEventDigest).toBe(hashF);
    })
  );

  it.effect("requires expiry candidates to encode the exact elapsed idle interval", () =>
    Effect.gen(function* () {
      const startedLease3 = yield* startedLease();
      const argument16 = O.some(startedLease3);
      const activityEvent16 = yield* activityEvent();
      const lease = activeLease(transitionSessionLease(argument16, activityEvent16));
      const candidate = yield* candidateFrom(lease);
      const encoded = yield* encodeCandidate(candidate);
      const invalid = {
        ...encoded,
        idleMs: 599_999,
      };

      expect(candidate.idleMs).toBe(600_000);
      expect(decodeSessionLeaseExpiryCandidateResult(invalid)._tag).toBe("Failure");
    })
  );

  it.effect("defers tombstones for a missing or renewed live lease", () =>
    Effect.gen(function* () {
      const startedLease4 = yield* startedLease();
      const argument17 = O.some(startedLease4);
      const activityEvent17 = yield* activityEvent();
      const lease = activeLease(transitionSessionLease(argument17, activityEvent17));
      const candidate = yield* candidateFrom(lease);
      const evidence = yield* reconciliationEvidence();

      expect(reconciliationStatus(reconcileExpiredSessionLease(candidate, O.none(), evidence))).toBe("deferred");
      const renewed = reconcileExpiredSessionLease(candidate, O.some((yield* startEvent).sessionId), evidence);
      expect(renewed.status === "deferred" && renewed.reason).toBe("lease-renewed");
    })
  );

  it.effect("defers tombstones for identity disagreement, later activity, or an open wait", () =>
    Effect.gen(function* () {
      const startedLease5 = yield* startedLease();
      const argument18 = O.some(startedLease5);
      const activityEvent18 = yield* activityEvent();
      const lease = activeLease(transitionSessionLease(argument18, activityEvent18));
      const candidate = yield* candidateFrom(lease);
      const argument19 = O.some(candidate.leaseDigest);
      const reconciliationEvidence19 = yield* reconciliationEvidence({ sessionId: hashB });
      const mismatch = reconcileExpiredSessionLease(candidate, argument19, reconciliationEvidence19);
      const argument20 = O.some(candidate.leaseDigest);
      const reconciliationEvidence20 = yield* reconciliationEvidence({
        sourceLastObservedAt: "2026-09-03T12:01:00.001Z",
      });
      const later = reconcileExpiredSessionLease(candidate, argument20, reconciliationEvidence20);
      const argument21 = O.some(candidate.leaseDigest);
      const reconciliationEvidence21 = yield* reconciliationEvidence({ sourceOpenWaitIds: [hashE] });
      const sourceOpen = reconcileExpiredSessionLease(candidate, argument21, reconciliationEvidence21);
      const startedLease6 = yield* startedLease();
      const argument22 = O.some(startedLease6);
      const openWaitEvent22 = yield* openWaitEvent;
      const leaseOpen = activeLease(transitionSessionLease(argument22, openWaitEvent22));
      const encodedLeaseOpen = yield* SessionLease.encodeEffect(leaseOpen);
      const leaseOpenCandidate = yield* decodeCandidate({
        schemaVersion: "telemetry-v2/session-lease-expiry-candidate/v1",
        lease: encodedLeaseOpen,
        leaseDigest: hashF,
        evaluatedAt: "2026-09-03T12:12:00.000Z",
        ttlMs: 600_000,
        idleMs: 600_000,
      });
      const argument23 = O.some(leaseOpenCandidate.leaseDigest);
      const reconciliationEvidence23 = yield* reconciliationEvidence();
      const open = reconcileExpiredSessionLease(leaseOpenCandidate, argument23, reconciliationEvidence23);

      expect(mismatch.status === "deferred" && mismatch.reason).toBe("evidence-session-mismatch");
      expect(later.status === "deferred" && later.reason).toBe("later-source-activity");
      expect(sourceOpen.status === "deferred" && sourceOpen.reason).toBe("open-wait");
      expect(open.status === "deferred" && open.reason).toBe("open-wait");
    })
  );

  it.effect("tombstones only after every veto clears and never guesses a semantic outcome", () =>
    Effect.gen(function* () {
      const startedLease7 = yield* startedLease();
      const argument24 = O.some(startedLease7);
      const activityEvent24 = yield* activityEvent();
      const lease = activeLease(transitionSessionLease(argument24, activityEvent24));
      const candidate = yield* candidateFrom(lease);
      const argument25 = O.some(candidate.leaseDigest);
      const reconciliationEvidence25 = yield* reconciliationEvidence();
      const result = reconcileExpiredSessionLease(candidate, argument25, reconciliationEvidence25);

      expect(result.status).toBe("tombstoned");
      if (result.status !== "tombstoned") throw new Error("Expected tombstoned reconciliation");
      expect(result.tombstone.terminalOutcome).toBe("unknown");
      expect(result.tombstone.evidenceTier).toBe("reconstructed");
    })
  );

  it.effect("keeps lease and reconciliation wire keys free of content-bearing fields", () =>
    Effect.gen(function* () {
      const startedLease8 = yield* startedLease();
      const argument26 = O.some(startedLease8);
      const activityEvent26 = yield* activityEvent();
      const lease = activeLease(transitionSessionLease(argument26, activityEvent26));
      const candidate = yield* candidateFrom(lease);
      const evidence = yield* reconciliationEvidence();
      const result = reconcileExpiredSessionLease(candidate, O.some(candidate.leaseDigest), evidence);
      const encoded = A.join(
        [
          yield* encodeCandidateJson(candidate),
          yield* encodeEvidenceJson(evidence),
          yield* S.encodeUnknownEffect(SessionLeaseReconciliationJson)(result),
        ],
        "\n"
      );

      for (const forbidden of [
        "prompt",
        "command",
        "toolArgument",
        "toolInput",
        "toolResult",
        "toolResponse",
        "transcriptPath",
        "cwd",
        "content",
        "message",
      ]) {
        expect(encoded).not.toContain(`"${forbidden}"`);
      }
    })
  );
});
