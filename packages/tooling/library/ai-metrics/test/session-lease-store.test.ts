import {
  requireAbsoluteAiMetricsDataRoot,
  SessionLease,
  SessionLeaseEvent,
  SessionLeaseExpiryScanInput,
  SessionLeaseReconciliation,
  SessionLeaseReconciliationEvidence,
  SessionLeaseStore,
  SessionLeaseStoreError,
} from "@beep/repo-ai-metrics";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import type { SessionLeaseExpiryCandidate, SessionLeaseStoreShape } from "@beep/repo-ai-metrics";

const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const hashC = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const hashD = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const hashE = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const decodeEvent = S.decodeEffect(SessionLeaseEvent);
const decodeScanInput = S.decodeEffect(SessionLeaseExpiryScanInput);
const decodeEvidence = S.decodeEffect(SessionLeaseReconciliationEvidence);

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

const activityEvent = decodeEvent({
  event: "activity",
  sessionId: hashA,
  observedAt: "2026-09-03T12:11:00.000Z",
  eventDigest: hashC,
  evidenceTier: "observed",
  oipTaint: "clear",
});

const waitOpenedEvent = decodeEvent({
  event: "wait-opened",
  sessionId: hashA,
  observedAt: "2026-09-03T12:01:00.000Z",
  eventDigest: hashC,
  evidenceTier: "derived",
  oipTaint: "clear",
  wait: {
    waitId: hashE,
    openedAt: "2026-09-03T12:01:00.000Z",
    reason: "tool-permission",
    evidenceTier: "derived",
    oipTaint: "clear",
  },
});

const sessionEndEvent = decodeEvent({
  event: "session-end",
  sessionId: hashA,
  observedAt: "2026-09-03T12:12:00.000Z",
  eventDigest: hashD,
  evidenceTier: "observed",
  oipTaint: "clear",
});

const scanInput = (evaluatedAt: string) => decodeScanInput({ evaluatedAt, ttlMs: 600_000 });

const evidence = (sourceLastObservedAt: string, sourceOpenWaitIds: ReadonlyArray<string> = []) =>
  decodeEvidence({
    sessionId: hashA,
    sourceLastObservedAt,
    sourceEvidenceDigest: hashD,
    sourceOpenWaitIds,
    evidenceTier: "derived",
    oipTaint: "clear",
  });

const requireCandidate = (candidates: ReadonlyArray<SessionLeaseExpiryCandidate>) =>
  O.match(A.head(candidates), {
    onNone: () => Effect.die("Expected one expired session-lease candidate."),
    onSome: Effect.succeed,
  });

const withTempStore = Effect.fnUntraced(function* <A2, E, R>(
  use: (dataRoot: string, store: SessionLeaseStoreShape) => Effect.Effect<A2, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const dataRoot = yield* fs.makeTempDirectoryScoped({ prefix: "beep-session-lease-store-" });
  const absoluteDataRoot = yield* requireAbsoluteAiMetricsDataRoot(dataRoot);
  const context = yield* Layer.build(SessionLeaseStore.layer(absoluteDataRoot));
  return yield* use(dataRoot, Context.get(context, SessionLeaseStore));
});

layer(NodeServices.layer)("session-lease store", (it) => {
  it.effect("persists active leases and scans only the TTL-expired subset", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const started = yield* store.apply(yield* startEvent);
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`);
          const activeLease = yield* SessionLease.decodeJsonEffect(yield* fs.readFileString(activePath));
          const beforeExpiry = yield* store.scanExpired(yield* scanInput("2026-09-03T12:09:59.999Z"));
          const atExpiry = yield* store.scanExpired(yield* scanInput("2026-09-03T12:10:00.000Z"));

          expect(started.transition.status).toBe("active");
          expect(activeLease.sessionId).toBe(hashA);
          expect(beforeExpiry.openLeaseCount).toBe(1);
          expect(beforeExpiry.candidates).toHaveLength(0);
          expect(atExpiry.openLeaseCount).toBe(1);
          expect(atExpiry.candidates).toHaveLength(1);
          expect(atExpiry.candidates[0]?.idleMs).toBe(600_000);
          expect(yield* fs.exists(path.join(dataRoot, started.transitionReceipt.relativePath))).toBe(true);
        })
      )
    )
  );

  it.effect("rechecks the active digest before a source-gated tombstone", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`);
          yield* store.apply(yield* startEvent);
          const staleScan = yield* store.scanExpired(yield* scanInput("2026-09-03T12:10:00.000Z"));
          const staleCandidate = yield* requireCandidate(staleScan.candidates);

          yield* store.apply(yield* activityEvent);
          const deferred = yield* store.reconcile(staleCandidate, yield* evidence("2026-09-03T12:00:00.000Z"));

          expect(deferred.reconciliation.status).toBe("deferred");
          expect(
            deferred.reconciliation.status === "deferred" ? deferred.reconciliation.reason : "unexpected-tombstone"
          ).toBe("lease-renewed");
          expect(yield* fs.exists(activePath)).toBe(true);

          const currentScan = yield* store.scanExpired(yield* scanInput("2026-09-03T12:21:00.000Z"));
          const currentCandidate = yield* requireCandidate(currentScan.candidates);
          const tombstoned = yield* store.reconcile(currentCandidate, yield* evidence("2026-09-03T12:11:00.000Z"));
          const persisted = yield* SessionLeaseReconciliation.decodeJsonEffect(
            yield* fs.readFileString(path.join(dataRoot, tombstoned.reconciliationReceipt.relativePath))
          );

          expect(tombstoned.reconciliation.status).toBe("tombstoned");
          expect(persisted.status).toBe("tombstoned");
          expect(yield* fs.exists(activePath)).toBe(false);
        })
      )
    )
  );

  it.effect("durably defers a tombstone while either witness keeps a wait open", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`);
          yield* store.apply(yield* startEvent);
          yield* store.apply(yield* waitOpenedEvent);
          const scan = yield* store.scanExpired(yield* scanInput("2026-09-03T12:11:00.000Z"));
          const candidate = yield* requireCandidate(scan.candidates);
          const result = yield* store.reconcile(candidate, yield* evidence("2026-09-03T12:01:00.000Z", [hashE]));

          expect(result.reconciliation.status).toBe("deferred");
          expect(
            result.reconciliation.status === "deferred" ? result.reconciliation.reason : "unexpected-tombstone"
          ).toBe("open-wait");
          expect(yield* fs.exists(activePath)).toBe(true);
          expect(yield* fs.exists(path.join(dataRoot, result.reconciliationReceipt.relativePath))).toBe(true);
        })
      )
    )
  );

  it.effect("records quarantined transitions without creating a pointer and retires observed ends", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`);
          const missing = yield* store.apply(yield* activityEvent);

          expect(missing.transition.status).toBe("quarantined");
          expect(yield* fs.exists(activePath)).toBe(false);

          yield* store.apply(yield* startEvent);
          const ended = yield* store.apply(yield* sessionEndEvent);

          expect(ended.transition.status).toBe("ended");
          expect(yield* fs.exists(activePath)).toBe(false);
          expect(yield* fs.exists(path.join(dataRoot, ended.transitionReceipt.relativePath))).toBe(true);
        })
      )
    )
  );

  it.effect("fails loudly on a stale cross-process lock without changing the active pointer", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const lockPath = path.join(dataRoot, "telemetry-v2/session-leases/lease-store.lock");
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`);
          yield* fs.makeDirectory(path.dirname(lockPath), { recursive: true });
          yield* fs.writeFileString(lockPath, "dead-holder\n");

          const failure = yield* Effect.flip(store.apply(yield* startEvent));

          expect(failure).toBeInstanceOf(SessionLeaseStoreError);
          expect(failure.operation).toBe("acquire-lock");
          expect(failure.message).toContain("Timed out waiting");
          expect(yield* fs.exists(activePath)).toBe(false);
        })
      )
    ).pipe(TestClock.withLive)
  );
});
