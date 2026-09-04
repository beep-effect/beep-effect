import {
  HookPulseLeaseProjectionInput,
  HookPulseV1,
  projectHookPulseLease,
  requireAbsoluteAiMetricsDataRoot,
  SessionLease,
  SessionLeaseStore,
} from "@beep/repo-ai-metrics";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import type { HookPulseEvent, HookPulseV1 as HookPulseV1Type, SessionLeaseStoreShape } from "@beep/repo-ai-metrics";

const sessionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const cwd = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const pulse = (hookEvent: HookPulseEvent, ts: string) =>
  HookPulseV1.decodeEffect({
    schemaVersion: "hook-pulse/v1",
    ts,
    sessionId,
    agentKind: "claude-code",
    hookEvent,
    cwd,
    notifierRev: "desktop-ntfy-1",
    instrumentClass: "production",
    evidenceTier: "derived",
    waitReason: "none",
  });

const requireRows = (rows: ReadonlyArray<HookPulseV1Type>) =>
  A.match(rows, {
    onEmpty: () => Effect.die("Expected non-empty hook-pulse rows."),
    onNonEmpty: Effect.succeed,
  });

const projection = Effect.fnUntraced(function* (events: ReadonlyArray<readonly [HookPulseEvent, string]>) {
  const rows = yield* Effect.forEach(events, ([hookEvent, ts]) => pulse(hookEvent, ts), { concurrency: 1 });
  return yield* projectHookPulseLease(
    HookPulseLeaseProjectionInput.make({ rows: yield* requireRows(rows), oipTaint: "clear" })
  );
});

const withTempStore = Effect.fnUntraced(function* <A2, E, R>(
  use: (dataRoot: string, store: SessionLeaseStoreShape) => Effect.Effect<A2, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const dataRoot = yield* fs.makeTempDirectoryScoped({ prefix: "beep-session-lease-projection-store-" });
  const absoluteDataRoot = yield* requireAbsoluteAiMetricsDataRoot(dataRoot);
  const context = yield* Layer.build(SessionLeaseStore.layer(absoluteDataRoot));
  return yield* use(dataRoot, Context.get(context, SessionLeaseStore));
});

layer(NodeServices.layer)("session-lease hook projection store", (it) => {
  it.effect("persists a complete projection before advancing and retiring its active lease", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${sessionId}.json`);
          const activeProjection = yield* projection([
            ["SessionStart", "2026-09-03T12:00:00.000Z"],
            ["Stop", "2026-09-03T12:01:00.000Z"],
          ]);
          const active = yield* store.replaceProjection(activeProjection);

          expect(active.projection.status).toBe("accepted");
          expect(active.transitions).toHaveLength(2);
          expect(active.transitionReceipts).toHaveLength(2);
          expect(yield* fs.exists(path.join(dataRoot, active.projectionReceipt.relativePath))).toBe(true);
          expect(yield* fs.exists(activePath)).toBe(true);
          expect((yield* SessionLease.decodeJsonEffect(yield* fs.readFileString(activePath))).openWaits).toHaveLength(
            0
          );

          const endedProjection = yield* projection([
            ["SessionStart", "2026-09-03T12:00:00.000Z"],
            ["Stop", "2026-09-03T12:01:00.000Z"],
            ["SessionEnd", "2026-09-03T12:02:00.000Z"],
          ]);
          const ended = yield* store.replaceProjection(endedProjection);

          expect(ended.transitions).toHaveLength(3);
          expect(ended.transitions[2]?.status).toBe("ended");
          expect(yield* fs.exists(activePath)).toBe(false);
          expect(ended.transitionReceipts[0]?.relativePath).toBe(active.transitionReceipts[0]?.relativePath);
        })
      )
    )
  );

  it.effect("durably quarantines an incomplete history without disturbing its last accepted pointer", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const activePath = path.join(dataRoot, "telemetry-v2/session-leases/active", `${sessionId}.json`);
          yield* store.replaceProjection(
            yield* projection([
              ["SessionStart", "2026-09-03T12:00:00.000Z"],
              ["Stop", "2026-09-03T12:01:00.000Z"],
            ])
          );
          const quarantined = yield* store.replaceProjection(yield* projection([["Stop", "2026-09-03T12:02:00.000Z"]]));

          expect(quarantined.projection.status).toBe("quarantined");
          expect(quarantined.transitions).toEqual([]);
          expect(quarantined.transitionReceipts).toEqual([]);
          expect(yield* fs.exists(path.join(dataRoot, quarantined.projectionReceipt.relativePath))).toBe(true);
          expect(yield* fs.exists(activePath)).toBe(true);
        })
      )
    )
  );
});
