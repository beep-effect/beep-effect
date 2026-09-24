import {
  appendYeetInboxRow,
  loadYeetInboxView,
  writeYeetAckReceipt,
  YEET_INBOX_VIEW_SCHEMA_VERSION,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetAckReceiptJson,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxObservedRowKind,
  YeetInboxRowJson,
  YeetInboxViewJson,
  YeetPrMergeReadyCapsule,
  YeetPrMergeReadyRow,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  yeetDispatchStatePath,
  yeetInboxAckPath,
  yeetInboxPaths,
  yeetInboxRowId,
  yeetInboxRowIsObserved,
  yeetInboxRowLiveness,
  yeetPrMergeReadyRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

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

const row = Effect.fnUntraced(function* (subject: YeetFailureCapsule) {
  return YeetCheckFailedRow.make({
    capsule: subject,
    checkout: "/repo",
    id: yield* yeetInboxRowId(subject),
    severity: "P0",
    ts: AT,
  });
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

const PlatformLayer = Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer);

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
  layer(BunCrypto.layer)((it) => {
    it.effect("is unknown without a wave record", () =>
      Effect.gen(function* () {
        expect(yeetInboxRowLiveness(yield* row(capsule()), O.none())).toBe("unknown");
      })
    );

    it.effect("is live when the row matches the wave's PR and head", () =>
      Effect.gen(function* () {
        expect(yeetInboxRowLiveness(yield* row(capsule()), O.some(wave()))).toBe("live");
      })
    );

    it.effect("is superseded when the wave moved to another head or PR", () =>
      Effect.gen(function* () {
        expect(yeetInboxRowLiveness(yield* row(capsule()), O.some(wave({ headSha: "fff999" })))).toBe("superseded");
        expect(yeetInboxRowLiveness(yield* row(capsule()), O.some(wave({ prNumber: 99 })))).toBe("superseded");
      })
    );

    it.effect("supports the data-last pipeable form", () =>
      Effect.gen(function* () {
        const subject = yield* row(capsule());
        expect(pipe(subject, yeetInboxRowLiveness(O.some(wave())))).toBe("live");
      })
    );
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
        expect(view.unreadable).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("skips undecodable lines and counts them instead of failing", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* appendYeetInboxRow(root, yield* row(capsule()));
        const paths = yield* yeetInboxPaths(root);
        yield* fs.writeFileString(paths.failuresPath, "garbage line\n", { flag: "a" });
        yield* appendYeetInboxRow(root, yield* row(capsule({ lane: "Check / Lint" })));

        const view = yield* loadYeetInboxView(root);

        expect(A.length(view.entries)).toBe(2);
        expect(view.skippedLines).toBe(1);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("dedupes re-announced ids keeping the first observation", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const first = yield* row(capsule());
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
        const acked = yield* row(capsule());
        const open = yield* row(capsule({ lane: "Check / Lint" }));
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
        const subject = yield* row(capsule());
        yield* appendYeetInboxRow(root, subject);
        yield* fs.makeDirectory(`${root}/.beep/inbox/acks`, { recursive: true });
        yield* fs.writeFileString(yield* yeetInboxAckPath(root, subject.id), "corrupted");

        const view = yield* loadYeetInboxView(root);

        expect(view.entries[0]?.ack.acked).toBe(true);
        expect(view.entries[0]?.ack.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("does not accept a symlinked receipt file as an acknowledgment", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideRoot = `${root}/outside`;
        yield* fs.makeDirectory(repoRoot);
        yield* fs.makeDirectory(outsideRoot);
        const subject = yield* row(capsule());
        yield* appendYeetInboxRow(repoRoot, subject);
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox/acks`);
        const outsideAck = `${outsideRoot}/${subject.id}`;
        const receipt = YeetAckReceipt.make({
          ackedAt: AT,
          id: subject.id,
          resolution: YeetAckFixResolution.make({ sha: "2817f28" }),
        });
        yield* fs.writeFileString(outsideAck, `${yield* YeetAckReceiptJson.encode(receipt)}\n`);
        yield* fs.symlink(outsideAck, yield* yeetInboxAckPath(repoRoot, subject.id));

        const view = yield* loadYeetInboxView(repoRoot);

        expect(view.entries[0]?.ack.acked).toBe(false);
        expect(view.entries[0]?.ack.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("does not accept a receipt beneath a symlinked acks parent", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideAcks = `${root}/outside-acks`;
        yield* fs.makeDirectory(repoRoot);
        yield* fs.makeDirectory(outsideAcks);
        const subject = yield* row(capsule());
        yield* appendYeetInboxRow(repoRoot, subject);
        const receipt = YeetAckReceipt.make({
          ackedAt: AT,
          id: subject.id,
          resolution: YeetAckFixResolution.make({ sha: "2817f28" }),
        });
        yield* fs.writeFileString(`${outsideAcks}/${subject.id}`, `${yield* YeetAckReceiptJson.encode(receipt)}\n`);
        yield* fs.symlink(outsideAcks, `${repoRoot}/.beep/inbox/acks`);

        const view = yield* loadYeetInboxView(repoRoot);

        expect(view.entries[0]?.ack.acked).toBe(false);
        expect(view.entries[0]?.ack.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("joins liveness against the persisted wave record", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const current = yield* row(capsule());
        const stale = yield* row(capsule({ headSha: "fff999" }));
        yield* appendYeetInboxRow(root, current);
        yield* appendYeetInboxRow(root, stale);
        yield* persistWave(root, wave());

        const view = yield* loadYeetInboxView(root);

        expect(A.map(view.entries, (entry) => entry.liveness)).toStrictEqual(["live", "superseded"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("flags an existing-but-unreadable failures file instead of decaying to empty", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const paths = yield* yeetInboxPaths(root);
        // A directory squatting on the failures path: it exists, but reading
        // it as a file fails — the view must say "unknown", not "empty".
        yield* fs.makeDirectory(paths.failuresPath, { recursive: true });

        const view = yield* loadYeetInboxView(root);

        expect(view.unreadable).toBe(true);
        expect(view.entries).toStrictEqual([]);
        expect(view.skippedLines).toBe(0);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("skips and counts rows whose id breaks the deterministic contract", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const kept = yield* row(capsule());
        yield* appendYeetInboxRow(root, kept);
        const forgedSource = yield* row(capsule({ lane: "Check / Lint" }));
        const forged = YeetCheckFailedRow.make({ ...forgedSource, id: "forged-id" });
        const paths = yield* yeetInboxPaths(root);
        const line = yield* YeetInboxRowJson.encode(forged);
        yield* fs.writeFileString(paths.failuresPath, `${line}\n`, { flag: "a" });

        const view = yield* loadYeetInboxView(root);

        expect(A.map(view.entries, (entry) => entry.row.id)).toStrictEqual([kept.id]);
        expect(view.skippedLines).toBe(1);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("treats a file holding only an unterminated line as empty, not garbage", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const paths = yield* yeetInboxPaths(root);
        yield* fs.makeDirectory(paths.dir, { recursive: true });
        // No newline anywhere: the whole file is one in-flight append.
        yield* fs.writeFileString(paths.failuresPath, '{"kind":"check-fail');

        const view = yield* loadYeetInboxView(root);

        expect(view.entries).toStrictEqual([]);
        expect(view.skippedLines).toBe(0);
        expect(view.unreadable).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("ignores an unterminated final line as in-flight instead of counting it as garbage", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* appendYeetInboxRow(root, yield* row(capsule()));
        const paths = yield* yeetInboxPaths(root);
        const partial = yield* YeetInboxRowJson.encode(yield* row(capsule({ lane: "Check / Lint" })));
        // Half of an in-flight append: no trailing newline.
        yield* fs.writeFileString(paths.failuresPath, Str.slice(0, 25)(partial), { flag: "a" });

        const view = yield* loadYeetInboxView(root);

        expect(A.length(view.entries)).toBe(1);
        expect(view.skippedLines).toBe(0);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("round-trips the joined view through its codec", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* appendYeetInboxRow(root, yield* row(capsule()));

        const view = yield* loadYeetInboxView(root);
        const encoded = yield* YeetInboxViewJson.encode(view);
        const decoded = yield* YeetInboxViewJson.decode(encoded);

        expect(decoded).toStrictEqual(view);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});

describe("merge-ready row liveness", () => {
  layer(BunCrypto.layer)((it) => {
    it.effect("is live regardless of the remediation wave: the merge loop supersedes it itself", () =>
      Effect.gen(function* () {
        const subject = YeetPrMergeReadyCapsule.make({
          headSha: "abc123def456",
          prNumber: 751,
          url: null,
          readyAt: AT,
          pushedAt: null,
          settledAt: null,
          closeoutAt: null,
          pushToReadyMs: null,
        });
        const ready = YeetPrMergeReadyRow.make({
          capsule: subject,
          checkout: "/repo",
          id: yield* yeetPrMergeReadyRowId(subject),
          severity: "P1",
          ts: AT,
        });
        expect(yeetInboxRowLiveness(ready, O.none())).toBe("live");
        expect(yeetInboxRowLiveness(ready, O.some(wave({ headSha: "fff999" })))).toBe("live");
      })
    );

    it.effect("shares one observed-kind kit with --observed admission", () =>
      Effect.gen(function* () {
        const subject = YeetPrMergeReadyCapsule.make({
          headSha: "abc123def456",
          prNumber: 751,
          url: null,
          readyAt: AT,
          pushedAt: null,
          settledAt: null,
          closeoutAt: null,
          pushToReadyMs: null,
        });
        const ready = YeetPrMergeReadyRow.make({
          capsule: subject,
          checkout: "/repo",
          id: yield* yeetPrMergeReadyRowId(subject),
          severity: "P1",
          ts: AT,
        });
        const failed = yield* row(capsule());
        expect(YeetInboxObservedRowKind.Options).toStrictEqual(["proof-job-finished", "pr-merge-ready"]);
        expect(yeetInboxRowIsObserved(ready)).toBe(true);
        expect(yeetInboxRowIsObserved(failed)).toBe(false);
        // An observed row is live under a moved wave; a gate row on the same wave is superseded.
        const moved = O.some(wave({ headSha: "fff999" }));
        expect(yeetInboxRowLiveness(ready, moved)).toBe("live");
        expect(yeetInboxRowLiveness(failed, moved)).toBe("superseded");
      })
    );
  });
});
