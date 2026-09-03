import {
  reconcileExpiredSessionLease,
  SessionLease,
  SessionLeaseEvent,
  SessionLeaseExpiryCandidate,
  SessionLeaseReconciliationEvidence,
  transitionSessionLease,
} from "@beep/repo-ai-metrics";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { SessionLeaseReconciliation, SessionLeaseTransition } from "@beep/repo-ai-metrics";

const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const hashC = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const hashD = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const hashE = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const hashF = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const decodeEvent = S.decodeUnknownSync(SessionLeaseEvent);
const decodeCandidate = S.decodeUnknownSync(SessionLeaseExpiryCandidate);
const decodeEvidence = S.decodeUnknownSync(SessionLeaseReconciliationEvidence);
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

const startedLease = (): SessionLease => activeLease(transitionSessionLease(O.none(), startEvent));

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

const candidateFrom = (lease: SessionLease, leaseDigest = hashF) =>
  decodeCandidate({
    schemaVersion: "telemetry-v2/session-lease-expiry-candidate/v1",
    lease: S.encodeSync(SessionLease)(lease),
    leaseDigest,
    evaluatedAt: "2026-09-03T12:11:00.000Z",
    ttlMs: 600_000,
    idleMs: 600_000,
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
  it("round-trips schema-generated leases and liveness events", () => {
    fc.assert(
      fc.property(S.toArbitrary(SessionLease)(fc), S.toArbitrary(SessionLeaseEvent)(fc), (lease, event) => {
        const roundTrippedLease = S.decodeSync(SessionLease)(S.encodeSync(SessionLease)(lease));
        const roundTrippedEvent = S.decodeSync(SessionLeaseEvent)(S.encodeSync(SessionLeaseEvent)(event));
        expect(leaseEquivalent(lease, roundTrippedLease)).toBe(true);
        expect(eventEquivalent(event, roundTrippedEvent)).toBe(true);
      }),
      fcRuns(25)
    );
  });

  it("creates a lease only from SessionStart and renews on ordinary activity", () => {
    const started = transitionSessionLease(O.none(), startEvent);
    const lease = activeLease(started);
    const renewed = transitionSessionLease(O.some(lease), activityEvent());
    const renewedLease = activeLease(renewed);

    expect(started.status === "active" && started.outcome).toBe("started");
    expect(renewed.status === "active" && renewed.outcome).toBe("renewed");
    expect(renewedLease.lastEventDigest).toBe(hashC);
    expect(renewedLease.evidenceTier).toBe("derived");
    expect(renewedLease.oipTaint).toBe("unknown");
  });

  it("quarantines missing, duplicate, and backwards transitions", () => {
    const missing = transitionSessionLease(O.none(), activityEvent());
    const missingOpen = transitionSessionLease(O.none(), openWaitEvent);
    const missingClose = transitionSessionLease(
      O.none(),
      decodeEvent({
        event: "wait-closed",
        sessionId: hashA,
        observedAt: "2026-09-03T12:03:00.000Z",
        eventDigest: hashF,
        waitId: hashE,
        evidenceTier: "derived",
        oipTaint: "clear",
      })
    );
    const missingEnd = transitionSessionLease(
      O.none(),
      decodeEvent({
        event: "session-end",
        sessionId: hashA,
        observedAt: "2026-09-03T12:05:00.000Z",
        eventDigest: hashF,
        evidenceTier: "derived",
        oipTaint: "clear",
      })
    );
    const lease = startedLease();
    const duplicate = transitionSessionLease(O.some(lease), startEvent);
    const backwards = transitionSessionLease(O.some(lease), activityEvent("2026-09-03T11:59:59.000Z", hashD));
    const mismatched = transitionSessionLease(O.some(lease), activityEvent("2026-09-03T12:01:00.000Z", hashC, hashB));

    expect(missing.status === "quarantined" && missing.reason).toBe("missing-lease");
    expect(missingOpen.status === "quarantined" && missingOpen.reason).toBe("missing-lease");
    expect(missingClose.status === "quarantined" && missingClose.reason).toBe("missing-lease");
    expect(missingEnd.status === "quarantined" && missingEnd.reason).toBe("missing-lease");
    expect(duplicate.status === "quarantined" && duplicate.reason).toBe("duplicate-start");
    expect(backwards.status === "quarantined" && backwards.reason).toBe("time-regression");
    expect(mismatched.status === "quarantined" && mismatched.reason).toBe("session-mismatch");
  });

  it("closes only the exact pending wait and keeps an unmatched close open", () => {
    const opened = transitionSessionLease(O.some(startedLease()), openWaitEvent);
    const openedLease = activeLease(opened);
    const duplicate = transitionSessionLease(O.some(openedLease), openWaitEvent);
    const duplicateLease = activeLease(duplicate);
    const unmatched = transitionSessionLease(
      O.some(duplicateLease),
      decodeEvent({
        event: "wait-closed",
        sessionId: hashA,
        observedAt: "2026-09-03T12:03:00.000Z",
        eventDigest: hashF,
        waitId: hashB,
        evidenceTier: "derived",
        oipTaint: "clear",
      })
    );
    const unmatchedLease = activeLease(unmatched);
    const matched = transitionSessionLease(
      O.some(unmatchedLease),
      decodeEvent({
        event: "wait-closed",
        sessionId: hashA,
        observedAt: "2026-09-03T12:04:00.000Z",
        eventDigest: hashC,
        waitId: hashE,
        evidenceTier: "derived",
        oipTaint: "clear",
      })
    );

    expect(opened.status === "active" && opened.outcome).toBe("wait-opened");
    expect(duplicate.status === "active" && duplicate.outcome).toBe("wait-open-duplicate");
    expect(duplicateLease.openWaits).toHaveLength(1);
    expect(unmatched.status === "active" && unmatched.outcome).toBe("wait-close-unmatched");
    expect(unmatchedLease.openWaits).toHaveLength(1);
    expect(matched.status === "active" && matched.outcome).toBe("wait-closed");
    expect(activeLease(matched).openWaits).toHaveLength(0);
  });

  it("carries pending waits into the observed terminal result for honest tombstoning", () => {
    const openedLease = activeLease(transitionSessionLease(O.some(startedLease()), openWaitEvent));
    const ended = transitionSessionLease(
      O.some(openedLease),
      decodeEvent({
        event: "session-end",
        sessionId: hashA,
        observedAt: "2026-09-03T12:05:00.000Z",
        eventDigest: hashF,
        evidenceTier: "derived",
        oipTaint: "clear",
      })
    );

    expect(ended.status).toBe("ended");
    if (ended.status !== "ended") throw new Error("Expected ended session lease transition");
    expect(ended.finalLease.openWaits).toHaveLength(1);
    expect(ended.terminalEventDigest).toBe(hashF);
  });

  it("requires expiry candidates to encode the exact elapsed idle interval", () => {
    const lease = activeLease(transitionSessionLease(O.some(startedLease()), activityEvent()));
    const candidate = candidateFrom(lease);
    const invalid = {
      ...S.encodeSync(SessionLeaseExpiryCandidate)(candidate),
      idleMs: 599_999,
    };

    expect(candidate.idleMs).toBe(600_000);
    expect(S.decodeResult(SessionLeaseExpiryCandidate)(invalid)._tag).toBe("Failure");
  });

  it("defers tombstones for a missing or renewed live lease", () => {
    const lease = activeLease(transitionSessionLease(O.some(startedLease()), activityEvent()));
    const candidate = candidateFrom(lease);
    const evidence = reconciliationEvidence();

    expect(reconciliationStatus(reconcileExpiredSessionLease(candidate, O.none(), evidence))).toBe("deferred");
    const renewed = reconcileExpiredSessionLease(candidate, O.some(startEvent.sessionId), evidence);
    expect(renewed.status === "deferred" && renewed.reason).toBe("lease-renewed");
  });

  it("defers tombstones for identity disagreement, later activity, or an open wait", () => {
    const lease = activeLease(transitionSessionLease(O.some(startedLease()), activityEvent()));
    const candidate = candidateFrom(lease);
    const mismatch = reconcileExpiredSessionLease(
      candidate,
      O.some(candidate.leaseDigest),
      reconciliationEvidence({ sessionId: hashB })
    );
    const later = reconcileExpiredSessionLease(
      candidate,
      O.some(candidate.leaseDigest),
      reconciliationEvidence({ sourceLastObservedAt: "2026-09-03T12:01:00.001Z" })
    );
    const sourceOpen = reconcileExpiredSessionLease(
      candidate,
      O.some(candidate.leaseDigest),
      reconciliationEvidence({ sourceOpenWaitIds: [hashE] })
    );
    const leaseOpen = activeLease(transitionSessionLease(O.some(startedLease()), openWaitEvent));
    const leaseOpenCandidate = decodeCandidate({
      schemaVersion: "telemetry-v2/session-lease-expiry-candidate/v1",
      lease: S.encodeSync(SessionLease)(leaseOpen),
      leaseDigest: hashF,
      evaluatedAt: "2026-09-03T12:12:00.000Z",
      ttlMs: 600_000,
      idleMs: 600_000,
    });
    const open = reconcileExpiredSessionLease(
      leaseOpenCandidate,
      O.some(leaseOpenCandidate.leaseDigest),
      reconciliationEvidence()
    );

    expect(mismatch.status === "deferred" && mismatch.reason).toBe("evidence-session-mismatch");
    expect(later.status === "deferred" && later.reason).toBe("later-source-activity");
    expect(sourceOpen.status === "deferred" && sourceOpen.reason).toBe("open-wait");
    expect(open.status === "deferred" && open.reason).toBe("open-wait");
  });

  it("tombstones only after every veto clears and never guesses a semantic outcome", () => {
    const lease = activeLease(transitionSessionLease(O.some(startedLease()), activityEvent()));
    const candidate = candidateFrom(lease);
    const result = reconcileExpiredSessionLease(candidate, O.some(candidate.leaseDigest), reconciliationEvidence());

    expect(result.status).toBe("tombstoned");
    if (result.status !== "tombstoned") throw new Error("Expected tombstoned reconciliation");
    expect(result.tombstone.terminalOutcome).toBe("unknown");
    expect(result.tombstone.evidenceTier).toBe("reconstructed");
  });

  it("keeps lease and reconciliation wire keys free of content-bearing fields", () => {
    const lease = activeLease(transitionSessionLease(O.some(startedLease()), activityEvent()));
    const candidate = candidateFrom(lease);
    const result = reconcileExpiredSessionLease(candidate, O.some(candidate.leaseDigest), reconciliationEvidence());
    const encoded = JSON.stringify({
      candidate: S.encodeSync(SessionLeaseExpiryCandidate)(candidate),
      result: S.encodeSync(SessionLeaseReconciliationEvidence)(reconciliationEvidence()),
      reconciliation: result,
    });

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
  });
});
