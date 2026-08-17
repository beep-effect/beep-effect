import {
  appendYeetInboxRow,
  loadYeetInboxView,
  writeYeetAckReceipt,
  YEET_INBOX_VIEW_SCHEMA_VERSION,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxViewJson,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  yeetDispatchStatePath,
  yeetInboxAckPath,
  yeetInboxPaths,
  yeetInboxRowId,
  yeetInboxRowLiveness,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";

const AT = "2026-08-17T00:00:00Z";

const capsule = (overrides: Partial<Parameters<typeof YeetFailureCapsule.make>[0]> = {}): YeetFailureCapsule =>
  YeetFailureCapsule.make({
    bucket: "fail",
    headSha: "abc123def456",
    lane: "Check / Coverage",
    link: null,
    observedAt: AT,
    prNumber: 754,
    state: "FAILURE",
    workflow: "Check",
    ...overrides,
  });

const row = (subject: YeetFailureCapsule): YeetCheckFailedRow =>
  YeetCheckFailedRow.make({
    capsule: subject,
    checkout: "/repo",
    id: yeetInboxRowId(subject),
    severity: "P0",
    ts: AT,
  });

const wave = (overrides: Partial<Parameters<typeof YeetRemediationWave.make>[0]> = {}): YeetRemediationWave =>
  YeetRemediationWave.make({
    capsuleIds: [],
    headSha: "abc123def456",
    prNumber: 754,
    sessionStartedAt: AT,
    updatedAt: AT,
    ...overrides,
  });

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const inTempRepo = Effect.fn("inTempRepo")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

const persistWave = Effect.fn("persistWave")(function* (root: string, current: YeetRemediationWave) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(root);
  yield* fs.makeDirectory(paths.dir, { recursive: true });
  const json = yield* YeetRemediationWaveJson.encode(current);
  yield* fs.writeFileString(yield* yeetDispatchStatePath(root), `${json}\n`);
});

describe("yeetInboxRowLiveness", () => {
  it("is unknown without a wave record", () => {
    expect(yeetInboxRowLiveness(row(capsule()), O.none())).toBe("unknown");
  });

  it("is live when the row matches the wave's PR and head", () => {
    expect(yeetInboxRowLiveness(row(capsule()), O.some(wave()))).toBe("live");
  });

  it("is superseded when the wave moved to another head or PR", () => {
    expect(yeetInboxRowLiveness(row(capsule()), O.some(wave({ headSha: "fff999" })))).toBe("superseded");
    expect(yeetInboxRowLiveness(row(capsule()), O.some(wave({ prNumber: 99 })))).toBe("superseded");
  });

  it("supports the data-last pipeable form", () => {
    expect(pipe(row(capsule()), yeetInboxRowLiveness(O.some(wave())))).toBe("live");
  });
});

describe("loadYeetInboxView", () => {
  it.live("treats a missing inbox as empty rather than an error", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const view = yield* loadYeetInboxView(root);

        expect(view.schemaVersion).toBe(YEET_INBOX_VIEW_SCHEMA_VERSION);
        expect(view.entries).toStrictEqual([]);
        expect(view.skippedLines).toBe(0);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("skips undecodable lines and counts them instead of failing", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* appendYeetInboxRow(root, row(capsule()));
        const paths = yield* yeetInboxPaths(root);
        yield* fs.writeFileString(paths.failuresPath, "garbage line\n", { flag: "a" });
        yield* appendYeetInboxRow(root, row(capsule({ lane: "Check / Lint" })));

        const view = yield* loadYeetInboxView(root);

        expect(A.length(view.entries)).toBe(2);
        expect(view.skippedLines).toBe(1);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("dedupes re-announced ids keeping the first observation", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const first = row(capsule());
        yield* appendYeetInboxRow(root, first);
        yield* appendYeetInboxRow(root, YeetCheckFailedRow.make({ ...first, ts: "2026-08-17T01:00:00Z" }));

        const view = yield* loadYeetInboxView(root);

        expect(A.length(view.entries)).toBe(1);
        expect(A.map(view.entries, (entry) => entry.row.ts)).toStrictEqual([AT]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("joins each row with its ack state", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const acked = row(capsule());
        const open = row(capsule({ lane: "Check / Lint" }));
        yield* appendYeetInboxRow(root, acked);
        yield* appendYeetInboxRow(root, open);
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            ackedAt: AT,
            id: acked.id,
            resolution: YeetAckFixResolution.make({ sha: "2817f28" }),
          })
        );

        const view = yield* loadYeetInboxView(root);

        expect(A.map(view.entries, (entry) => entry.ack.acked)).toStrictEqual([true, false]);
        expect(view.entries[0]?.ack.receipt?.id).toBe(acked.id);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("keeps a corrupt receipt acked with no decoded content", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const subject = row(capsule());
        yield* appendYeetInboxRow(root, subject);
        yield* fs.makeDirectory(`${root}/.beep/inbox/acks`, { recursive: true });
        yield* fs.writeFileString(yield* yeetInboxAckPath(root, subject.id), "corrupted");

        const view = yield* loadYeetInboxView(root);

        expect(view.entries[0]?.ack.acked).toBe(true);
        expect(view.entries[0]?.ack.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("joins liveness against the persisted wave record", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const current = row(capsule());
        const stale = row(capsule({ headSha: "fff999" }));
        yield* appendYeetInboxRow(root, current);
        yield* appendYeetInboxRow(root, stale);
        yield* persistWave(root, wave());

        const view = yield* loadYeetInboxView(root);

        expect(A.map(view.entries, (entry) => entry.liveness)).toStrictEqual(["live", "superseded"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("round-trips the joined view through its codec", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* appendYeetInboxRow(root, row(capsule()));

        const view = yield* loadYeetInboxView(root);
        const encoded = yield* YeetInboxViewJson.encode(view);
        const decoded = yield* YeetInboxViewJson.decode(encoded);

        expect(decoded).toStrictEqual(view);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
