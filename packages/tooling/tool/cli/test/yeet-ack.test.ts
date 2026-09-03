import {
  readYeetAckState,
  renderYeetAckResolution,
  writeYeetAckReceipt,
  YEET_ACK_SCHEMA_VERSION,
  YeetAckEnvironmentOnlyResolution,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetAckReceiptJson,
  YeetAckThreadResolution,
  YeetAckWaiveResolution,
  YeetAckWontfixResolution,
  yeetInboxAckPath,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const AT = "2026-08-17T00:00:00Z";

const fixReceipt = (id: string): YeetAckReceipt =>
  YeetAckReceipt.make({
    ackedAt: AT,
    id,
    resolution: YeetAckFixResolution.make({ sha: "2817f286d3" }),
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

describe("renderYeetAckResolution", () => {
  it("phrases every closing move", () => {
    expect(renderYeetAckResolution(YeetAckFixResolution.make({ sha: "2817f28" }))).toBe("fix-sha 2817f28");
    expect(renderYeetAckResolution(YeetAckEnvironmentOnlyResolution.make({ reason: "stale upstream dist" }))).toBe(
      "environment-only: stale upstream dist"
    );
    expect(renderYeetAckResolution(YeetAckWontfixResolution.make({ reason: "flaky infra lane" }))).toBe(
      "wontfix: flaky infra lane"
    );
    expect(renderYeetAckResolution(YeetAckThreadResolution.make({ url: "https://example.test/t/1" }))).toBe(
      "thread https://example.test/t/1"
    );
    expect(
      renderYeetAckResolution(
        YeetAckWaiveResolution.make({
          actor: "operator",
          expiresAt: "2099-01-01T00:00:00Z",
          reason: "hosted dependency unavailable",
          shard: "Security",
        })
      )
    ).toBe("waive Security by operator until 2099-01-01T00:00:00Z: hosted dependency unavailable");
  });
});

describe("YeetAckReceiptJson", () => {
  it.effect("round-trips a receipt through the codec", () =>
    Effect.gen(function* () {
      const receipt = fixReceipt("coverage-abc123");
      const encoded = yield* YeetAckReceiptJson.encode(receipt);
      const decoded = yield* YeetAckReceiptJson.decode(encoded);

      expect(decoded.schemaVersion).toBe(YEET_ACK_SCHEMA_VERSION);
      expect(decoded.id).toBe("coverage-abc123");
      expect(decoded.resolution).toStrictEqual(receipt.resolution);
    })
  );

  it.effect("decodes a receipt written before environment-only was added", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetAckReceiptJson.decode(
        '{"schemaVersion":"yeet-ack/v1","id":"coverage-old123","resolution":{"kind":"wontfix","reason":"legacy infrastructure incident"},"ackedAt":"2026-08-17T00:00:00Z"}'
      );

      expect(decoded.schemaVersion).toBe(YEET_ACK_SCHEMA_VERSION);
      expect(decoded.id).toBe("coverage-old123");
      expect(decoded.resolution).toStrictEqual(
        YeetAckWontfixResolution.make({ reason: "legacy infrastructure incident" })
      );
    })
  );

  it("rejects garbage instead of decaying to a partial receipt", () => {
    expect(O.isNone(YeetAckReceiptJson.decodeOption("not json"))).toBe(true);
    expect(O.isNone(YeetAckReceiptJson.decodeOption('{"id":"x"}'))).toBe(true);
  });
});

describe("readYeetAckState", () => {
  it.live("reports a missing receipt as unacked", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const state = yield* readYeetAckState(root, "coverage-abc123");

        expect(state.acked).toBe(false);
        expect(state.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("reports a written receipt as acked with its decoded content", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* writeYeetAckReceipt(root, fixReceipt("coverage-abc123"));

        const state = yield* readYeetAckState(root, "coverage-abc123");

        expect(state.acked).toBe(true);
        expect(state.receipt?.resolution).toStrictEqual(YeetAckFixResolution.make({ sha: "2817f286d3" }));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("keeps an unexpired waiver acked and re-arms an expired waiver", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const receipt = (expiresAt: string) =>
          YeetAckReceipt.make({
            ackedAt: AT,
            id: "coverage-abc123",
            resolution: YeetAckWaiveResolution.make({
              actor: "operator",
              expiresAt,
              reason: "temporary exception",
              shard: "Coverage",
            }),
          });

        yield* writeYeetAckReceipt(root, receipt("2099-01-01T00:00:00Z"));
        expect((yield* readYeetAckState(root, "coverage-abc123")).acked).toBe(true);

        yield* writeYeetAckReceipt(root, receipt("2000-01-01T00:00:00Z"));
        expect((yield* readYeetAckState(root, "coverage-abc123")).acked).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("keeps an unreadable receipt acked while dropping its content", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ackPath = yield* yeetInboxAckPath(root, "coverage-abc123");
        yield* fs.makeDirectory(`${root}/.beep/inbox/acks`, { recursive: true });
        yield* fs.writeFileString(ackPath, "corrupted receipt");

        const state = yield* readYeetAckState(root, "coverage-abc123");

        // Existence is the acknowledgment; corruption must not re-arm a denial.
        expect(state.acked).toBe(true);
        expect(state.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("keeps a receipt that exists but cannot be read as a file acked", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // A directory squatting on the receipt path: it exists, but reading it
        // as a file fails — the ack must survive the read failure.
        yield* fs.makeDirectory(yield* yeetInboxAckPath(root, "coverage-abc123"), { recursive: true });

        const state = yield* readYeetAckState(root, "coverage-abc123");

        expect(state.acked).toBe(true);
        expect(state.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a symlinked receipt file instead of accepting its content", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideRoot = `${root}/outside`;
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox/acks`, { recursive: true });
        yield* fs.makeDirectory(outsideRoot);
        const id = "coverage-abc123";
        const outsideAck = `${outsideRoot}/${id}`;
        yield* fs.writeFileString(outsideAck, `${yield* YeetAckReceiptJson.encode(fixReceipt(id))}\n`);
        yield* fs.symlink(outsideAck, yield* yeetInboxAckPath(repoRoot, id));

        const state = yield* readYeetAckState(repoRoot, id);

        expect(state.acked).toBe(false);
        expect(state.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a symlinked acks parent instead of accepting its receipt", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideAcks = `${root}/outside-acks`;
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox`, { recursive: true });
        yield* fs.makeDirectory(outsideAcks);
        const id = "coverage-abc123";
        yield* fs.writeFileString(`${outsideAcks}/${id}`, `${yield* YeetAckReceiptJson.encode(fixReceipt(id))}\n`);
        yield* fs.symlink(outsideAcks, `${repoRoot}/.beep/inbox/acks`);

        const state = yield* readYeetAckState(repoRoot, id);

        expect(state.acked).toBe(false);
        expect(state.receipt).toBeNull();
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});

describe("writeYeetAckReceipt", () => {
  it.live("creates the acks directory and writes a decodable receipt at the returned path", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const receipt = fixReceipt("coverage-abc123");

        const written = yield* writeYeetAckReceipt(root, receipt);

        expect(written).toBe(`${root}/.beep/inbox/acks/coverage-abc123`);
        const decoded = yield* YeetAckReceiptJson.decode(Str.trim(yield* fs.readFileString(written)));
        expect(decoded.id).toBe("coverage-abc123");
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("overwrites a prior receipt so the last resolution stands", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            ackedAt: AT,
            id: "coverage-abc123",
            resolution: YeetAckWontfixResolution.make({ reason: "premature" }),
          })
        );
        yield* writeYeetAckReceipt(root, fixReceipt("coverage-abc123"));

        const state = yield* readYeetAckState(root, "coverage-abc123");

        expect(state.receipt?.resolution).toStrictEqual(YeetAckFixResolution.make({ sha: "2817f286d3" }));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("fails with a typed error when the acks location is unusable", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // A file squatting on the acks directory path makes mkdir fail.
        yield* fs.makeDirectory(`${root}/.beep/inbox`, { recursive: true });
        yield* fs.writeFileString(`${root}/.beep/inbox/acks`, "squatter");

        const failure = yield* Effect.flip(writeYeetAckReceipt(root, fixReceipt("coverage-abc123")));

        expect(failure.message).toContain("acks");
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a symlinked receipt target without overwriting its destination", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideRoot = `${root}/outside`;
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox/acks`, { recursive: true });
        yield* fs.makeDirectory(outsideRoot);
        const id = "coverage-abc123";
        const outsideAck = `${outsideRoot}/${id}`;
        const sentinel = "outside target must stay unchanged\n";
        yield* fs.writeFileString(outsideAck, sentinel);
        yield* fs.symlink(outsideAck, yield* yeetInboxAckPath(repoRoot, id));

        const failure = yield* writeYeetAckReceipt(repoRoot, fixReceipt(id)).pipe(Effect.flip);

        expect(failure._tag).toBe("YeetCommandError");
        expect(yield* fs.readFileString(outsideAck)).toBe(sentinel);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a symlinked acks parent without writing through it", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideAcks = `${root}/outside-acks`;
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox`, { recursive: true });
        yield* fs.makeDirectory(outsideAcks);
        const id = "coverage-abc123";
        const outsideAck = `${outsideAcks}/${id}`;
        const sentinel = "outside parent must stay unchanged\n";
        yield* fs.writeFileString(outsideAck, sentinel);
        yield* fs.symlink(outsideAcks, `${repoRoot}/.beep/inbox/acks`);

        const failure = yield* writeYeetAckReceipt(repoRoot, fixReceipt(id)).pipe(Effect.flip);

        expect(failure._tag).toBe("YeetCommandError");
        expect(yield* fs.readFileString(outsideAck)).toBe(sentinel);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
