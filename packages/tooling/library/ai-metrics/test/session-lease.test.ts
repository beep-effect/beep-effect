import {
  reconcileExpiredSessionLease,
  SessionLease,
  SessionLeaseEvent,
  SessionLeaseExpiryCandidate,
  SessionLeaseReconciliation,
  SessionLeaseReconciliationEvidence,
  transitionSessionLease,
} from "@beep/repo-ai-metrics";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SessionLeaseTransition } from "@beep/repo-ai-metrics";

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
  return activeLease(transitionSessionLease(O.none(), yield* startEvent));
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
  it.effect("round-trips schema-generated leases and liveness events", () =>
    Effect.gen(function* () {
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(SessionLease), Arbitrary.schema(SessionLeaseEvent)]),
        ([lease, event]) =>
          Effect.gen(function* () {
            const roundTrippedLease = yield* SessionLease.decodeEffect(yield* SessionLease.encodeEffect(lease));
            const roundTrippedEvent = yield* decodeEvent(yield* encodeEvent(event));
            expect(leaseEquivalent(lease, roundTrippedLease)).toBe(true);
            expect(eventEquivalent(event, roundTrippedEvent)).toBe(true);

            return true;
          }),
        fcRuns(25)
      );

      expect(result._tag).toBe("Passed");
    })
  );

  it.effect("creates a lease only from SessionStart and renews on ordinary activity", () =>
    Effect.gen(function* () {
      const started = transitionSessionLease(O.none(), yield* startEvent);
      const lease = activeLease(started);
      const renewed = transitionSessionLease(O.some(lease), yield* activityEvent());
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
      const missing = transitionSessionLease(O.none(), yield* activityEvent());
      const missingOpen = transitionSessionLease(O.none(), yield* openWaitEvent);
      const missingClose = transitionSessionLease(
        O.none(),
        yield* decodeEvent({
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
        yield* decodeEvent({
          event: "session-end",
          sessionId: hashA,
          observedAt: "2026-09-03T12:05:00.000Z",
          eventDigest: hashF,
          evidenceTier: "derived",
          oipTaint: "clear",
        })
      );
      const lease = yield* startedLease();
      const duplicate = transitionSessionLease(O.some(lease), yield* startEvent);
      const backwards = transitionSessionLease(O.some(lease), yield* activityEvent("2026-09-03T11:59:59.000Z", hashD));
      const mismatched = transitionSessionLease(
        O.some(lease),
        yield* activityEvent("2026-09-03T12:01:00.000Z", hashC, hashB)
      );

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
      const opened = transitionSessionLease(O.some(yield* startedLease()), yield* openWaitEvent);
      const openedLease = activeLease(opened);
      const duplicate = transitionSessionLease(O.some(openedLease), yield* openWaitEvent);
      const duplicateLease = activeLease(duplicate);
      const unmatched = transitionSessionLease(
        O.some(duplicateLease),
        yield* decodeEvent({
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
        yield* decodeEvent({
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
    })
  );

  it.effect("carries pending waits into the observed terminal result for honest tombstoning", () =>
    Effect.gen(function* () {
      const openedLease = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* openWaitEvent));
      const ended = transitionSessionLease(
        O.some(openedLease),
        yield* decodeEvent({
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
    })
  );

  it.effect("requires expiry candidates to encode the exact elapsed idle interval", () =>
    Effect.gen(function* () {
      const lease = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* activityEvent()));
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
      const lease = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* activityEvent()));
      const candidate = yield* candidateFrom(lease);
      const evidence = yield* reconciliationEvidence();

      expect(reconciliationStatus(reconcileExpiredSessionLease(candidate, O.none(), evidence))).toBe("deferred");
      const renewed = reconcileExpiredSessionLease(candidate, O.some((yield* startEvent).sessionId), evidence);
      expect(renewed.status === "deferred" && renewed.reason).toBe("lease-renewed");
    })
  );

  it.effect("defers tombstones for identity disagreement, later activity, or an open wait", () =>
    Effect.gen(function* () {
      const lease = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* activityEvent()));
      const candidate = yield* candidateFrom(lease);
      const mismatch = reconcileExpiredSessionLease(
        candidate,
        O.some(candidate.leaseDigest),
        yield* reconciliationEvidence({ sessionId: hashB })
      );
      const later = reconcileExpiredSessionLease(
        candidate,
        O.some(candidate.leaseDigest),
        yield* reconciliationEvidence({ sourceLastObservedAt: "2026-09-03T12:01:00.001Z" })
      );
      const sourceOpen = reconcileExpiredSessionLease(
        candidate,
        O.some(candidate.leaseDigest),
        yield* reconciliationEvidence({ sourceOpenWaitIds: [hashE] })
      );
      const leaseOpen = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* openWaitEvent));
      const encodedLeaseOpen = yield* SessionLease.encodeEffect(leaseOpen);
      const leaseOpenCandidate = yield* decodeCandidate({
        schemaVersion: "telemetry-v2/session-lease-expiry-candidate/v1",
        lease: encodedLeaseOpen,
        leaseDigest: hashF,
        evaluatedAt: "2026-09-03T12:12:00.000Z",
        ttlMs: 600_000,
        idleMs: 600_000,
      });
      const open = reconcileExpiredSessionLease(
        leaseOpenCandidate,
        O.some(leaseOpenCandidate.leaseDigest),
        yield* reconciliationEvidence()
      );

      expect(mismatch.status === "deferred" && mismatch.reason).toBe("evidence-session-mismatch");
      expect(later.status === "deferred" && later.reason).toBe("later-source-activity");
      expect(sourceOpen.status === "deferred" && sourceOpen.reason).toBe("open-wait");
      expect(open.status === "deferred" && open.reason).toBe("open-wait");
    })
  );

  it.effect("tombstones only after every veto clears and never guesses a semantic outcome", () =>
    Effect.gen(function* () {
      const lease = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* activityEvent()));
      const candidate = yield* candidateFrom(lease);
      const result = reconcileExpiredSessionLease(
        candidate,
        O.some(candidate.leaseDigest),
        yield* reconciliationEvidence()
      );

      expect(result.status).toBe("tombstoned");
      if (result.status !== "tombstoned") throw new Error("Expected tombstoned reconciliation");
      expect(result.tombstone.terminalOutcome).toBe("unknown");
      expect(result.tombstone.evidenceTier).toBe("reconstructed");
    })
  );

  it.effect("keeps lease and reconciliation wire keys free of content-bearing fields", () =>
    Effect.gen(function* () {
      const lease = activeLease(transitionSessionLease(O.some(yield* startedLease()), yield* activityEvent()));
      const candidate = yield* candidateFrom(lease);
      const evidence = yield* reconciliationEvidence();
      const result = reconcileExpiredSessionLease(candidate, O.some(candidate.leaseDigest), evidence);
      const encoded = [
        yield* encodeCandidateJson(candidate),
        yield* encodeEvidenceJson(evidence),
        yield* SessionLeaseReconciliation.encodeJsonEffect(result),
      ].join("\n");

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
