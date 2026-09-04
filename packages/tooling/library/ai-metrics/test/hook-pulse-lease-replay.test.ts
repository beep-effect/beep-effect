import {
  HookPulseLeaseReplayInput,
  HookPulseV1,
  replayHookPulseLeases,
  requireAbsoluteAiMetricsDataRoot,
} from "@beep/repo-ai-metrics";
import { PosInt } from "@beep/schema";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import type { HookPulseEvent } from "@beep/repo-ai-metrics";

const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const hashC = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const pulseLine = Effect.fnUntraced(function* (sessionId: string, hookEvent: HookPulseEvent, ts: string) {
  const pulse = yield* HookPulseV1.decodeEffect({
    schemaVersion: "hook-pulse/v1",
    ts,
    sessionId,
    agentKind: "claude-code",
    hookEvent,
    cwd: hashC,
    notifierRev: "desktop-ntfy-1",
    instrumentClass: "production",
    evidenceTier: "derived",
    waitReason: "none",
  });
  return yield* HookPulseV1.encodeJsonEffect(pulse);
});

layer(NodeServices.layer)("hook-pulse lease replay", (it) => {
  it.effect("enumerates before read, persists every session disposition, and replays idempotently", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-hook-pulse-lease-replay-" });
        const evidenceRoot = path.join(root, "agent-evidence");
        const ledgerRoot = path.join(evidenceRoot, "hook-events");
        const dataRoot = path.join(root, "ai-metrics");
        yield* fs.makeDirectory(ledgerRoot, { recursive: true });
        yield* fs.makeDirectory(dataRoot, { recursive: true });
        yield* fs.writeFileString(
          path.join(ledgerRoot, `hook-pulse-2026-09-03-${hashA}.ndjson`),
          `${yield* pulseLine(hashA, "SessionStart", "2026-09-03T12:00:00.000Z")}\n${yield* pulseLine(
            hashA,
            "Stop",
            "2026-09-03T12:01:00.000Z"
          )}\n`
        );
        yield* fs.writeFileString(
          path.join(ledgerRoot, `hook-pulse-2026-09-03-${hashB}.ndjson`),
          `${yield* pulseLine(hashB, "Stop", "2026-09-03T12:02:00.000Z")}\nnot-json\n`
        );
        const input = HookPulseLeaseReplayInput.make({
          dataRoot: yield* requireAbsoluteAiMetricsDataRoot(dataRoot),
          evaluatedAt: DateTime.makeUnsafe("2026-09-03T12:05:00.000Z"),
          evidenceRoot,
          oipTaint: "unknown",
          ttlMs: PosInt.make(600_000),
        });

        const first = yield* replayHookPulseLeases(input);
        const projectionDir = path.join(dataRoot, "telemetry-v2/hook-pulse-lease-projections");
        const transitionDir = path.join(dataRoot, "telemetry-v2/session-lease-transitions");
        const firstProjectionFiles = yield* fs.readDirectory(projectionDir);
        const firstTransitionFiles = yield* fs.readDirectory(transitionDir);

        expect(first).toMatchObject({
          acceptedSessionCount: 1,
          decodedRowCount: 3,
          deferredTombstoneCount: 0,
          enumeratedFileCount: 2,
          expiryCandidateCount: 0,
          missingReconciliationEvidenceCount: 0,
          openLeaseCount: 1,
          quarantinedSessionCount: 1,
          reconciledCandidateCount: 0,
          rejectedLineCount: 1,
          sessionCount: 2,
          tombstonedSessionCount: 0,
          transitionCount: 2,
        });
        expect(yield* fs.exists(path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`))).toBe(true);
        expect(yield* fs.exists(path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashB}.json`))).toBe(
          false
        );
        expect(A.length(firstProjectionFiles)).toBe(2);
        expect(A.length(firstTransitionFiles)).toBe(2);

        const second = yield* replayHookPulseLeases(input);

        expect(second).toEqual(first);
        expect(yield* fs.readDirectory(projectionDir)).toEqual(firstProjectionFiles);
        expect(yield* fs.readDirectory(transitionDir)).toEqual(firstTransitionFiles);
      })
    )
  );

  it.effect("reconciles stale source evidence into one deterministic tombstone across later scan times", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-hook-pulse-tombstone-replay-" });
        const evidenceRoot = path.join(root, "agent-evidence");
        const ledgerRoot = path.join(evidenceRoot, "hook-events");
        const dataRoot = path.join(root, "ai-metrics");
        yield* fs.makeDirectory(ledgerRoot, { recursive: true });
        yield* fs.makeDirectory(dataRoot, { recursive: true });
        yield* fs.writeFileString(
          path.join(ledgerRoot, `hook-pulse-2026-09-03-${hashA}.ndjson`),
          `${yield* pulseLine(hashA, "SessionStart", "2026-09-03T12:00:00.000Z")}\n${yield* pulseLine(
            hashA,
            "Stop",
            "2026-09-03T12:01:00.000Z"
          )}\n`
        );
        const absoluteDataRoot = yield* requireAbsoluteAiMetricsDataRoot(dataRoot);
        const first = yield* replayHookPulseLeases(
          HookPulseLeaseReplayInput.make({
            dataRoot: absoluteDataRoot,
            evaluatedAt: DateTime.makeUnsafe("2026-09-03T12:11:00.000Z"),
            evidenceRoot,
            oipTaint: "unknown",
            ttlMs: PosInt.make(600_000),
          })
        );
        const reconciliationDir = path.join(dataRoot, "telemetry-v2/session-lease-reconciliations");
        const firstFiles = yield* fs.readDirectory(reconciliationDir);
        const firstReconciliation = yield* fs.readFileString(path.join(reconciliationDir, firstFiles[0] ?? "missing"));

        expect(first).toMatchObject({
          deferredTombstoneCount: 0,
          expiryCandidateCount: 1,
          missingReconciliationEvidenceCount: 0,
          openLeaseCount: 1,
          reconciledCandidateCount: 1,
          tombstonedSessionCount: 1,
        });
        expect(firstReconciliation).toContain('"tombstonedAt":"2026-09-03T12:11:00.000Z"');
        expect(yield* fs.exists(path.join(dataRoot, "telemetry-v2/session-leases/active", `${hashA}.json`))).toBe(
          false
        );

        const second = yield* replayHookPulseLeases(
          HookPulseLeaseReplayInput.make({
            dataRoot: absoluteDataRoot,
            evaluatedAt: DateTime.makeUnsafe("2026-09-04T12:11:00.000Z"),
            evidenceRoot,
            oipTaint: "unknown",
            ttlMs: PosInt.make(600_000),
          })
        );

        expect(second).toEqual(first);
        expect(yield* fs.readDirectory(reconciliationDir)).toEqual(firstFiles);
      })
    )
  );
});
