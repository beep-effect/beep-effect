import {
  appendYeetInboxRow,
  appendYeetInboxRowOnce,
  describeYeetInboxRow,
  renderYeetInboxRowLine,
  YEET_INBOX_SCHEMA_VERSION,
  YeetBaseDriftCapsule,
  YeetBaseDriftRow,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxRowJson,
  YeetLocalShardFailedRow,
  YeetLocalShardFailureCapsule,
  YeetReviewThreadCapsule,
  YeetReviewThreadRow,
  YeetSiblingCollisionCapsule,
  YeetSiblingCollisionRow,
  yeetBaseDriftRowId,
  yeetInboxAckPath,
  yeetInboxExpectedRowId,
  yeetInboxPaths,
  yeetInboxRowId,
  yeetLocalShardFailedRowId,
  yeetReviewThreadRowId,
  yeetSiblingCollisionRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Str from "effect/String";

const AT = "2026-08-17T00:00:00Z";

const capsule = (overrides: Partial<Parameters<typeof YeetFailureCapsule.make>[0]> = {}): YeetFailureCapsule =>
  YeetFailureCapsule.make({
    bucket: "fail",
    headSha: "abc123def456",
    lane: "Check / Coverage",
    link: "https://github.com/beep/beep/actions/runs/1/job/2",
    observedAt: AT,
    prNumber: 751,
    state: "FAILURE",
    workflow: "Check",
    ...overrides,
  });

const row = (subject: YeetFailureCapsule, severity: "P0" | "P1" = "P0"): YeetCheckFailedRow =>
  YeetCheckFailedRow.make({
    capsule: subject,
    checkout: "/repo",
    id: yeetInboxRowId(subject),
    severity,
    ts: AT,
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

describe("yeetInboxRowId", () => {
  it("is deterministic over the same failure and doubles as a safe filename", () => {
    const first = yeetInboxRowId(capsule());
    const second = yeetInboxRowId(capsule());

    expect(first).toBe(second);
    // The id names the ack receipt file, so it must never need escaping.
    expect(/^[A-Za-z0-9._-]+$/u.test(first)).toBe(true);
  });

  it("distinguishes head, lane, and pull request", () => {
    const base = yeetInboxRowId(capsule());

    expect(yeetInboxRowId(capsule({ headSha: "fff999" }))).not.toBe(base);
    expect(yeetInboxRowId(capsule({ lane: "Check / Lint" }))).not.toBe(base);
    expect(yeetInboxRowId(capsule({ prNumber: 99 }))).not.toBe(base);
  });

  it("keeps two lanes distinct even when they sanitize identically", () => {
    // Both sanitize to "Check___Coverage"-ish segments; the digest suffix is
    // what keeps their receipts from colliding.
    const spaced = yeetInboxRowId(capsule({ lane: "Check / Coverage" }));
    const starred = yeetInboxRowId(capsule({ lane: "Check * Coverage" }));

    expect(spaced).not.toBe(starred);
  });

  it("identifies and describes every inbox row variant", () => {
    const siblingCapsule = YeetSiblingCollisionCapsule.make({
      contendedPaths: ["b.ts", "a.ts"],
      ownerCheckout: "/fleet/a",
      siblingCheckout: "/fleet/b",
    });
    const reviewCapsule = YeetReviewThreadCapsule.make({
      headSha: "abc123def456",
      link: null,
      prNumber: 751,
      threadId: "PRRT_abc",
    });
    const driftCapsule = YeetBaseDriftCapsule.make({
      base: "origin/main",
      headSha: "abc123def456",
      prNumber: 751,
    });
    const localCapsule = YeetLocalShardFailureCapsule.make({
      command: "bun run check",
      exitCode: 1,
      headSha: "abc123def456",
      shard: "Check",
    });
    const rows = [
      YeetSiblingCollisionRow.make({
        capsule: siblingCapsule,
        checkout: "/fleet/a",
        id: yeetSiblingCollisionRowId(siblingCapsule),
        severity: "P0",
        ts: AT,
      }),
      YeetReviewThreadRow.make({
        capsule: reviewCapsule,
        checkout: "/repo",
        id: yeetReviewThreadRowId(reviewCapsule),
        severity: "P1",
        ts: AT,
      }),
      YeetBaseDriftRow.make({
        capsule: driftCapsule,
        checkout: "/repo",
        id: yeetBaseDriftRowId(driftCapsule),
        severity: "P2",
        ts: AT,
      }),
      YeetLocalShardFailedRow.make({
        capsule: localCapsule,
        checkout: "/repo",
        id: yeetLocalShardFailedRowId(localCapsule),
        severity: "P0",
        ts: AT,
      }),
    ];

    expect(yeetSiblingCollisionRowId(siblingCapsule)).toBe(
      yeetSiblingCollisionRowId(
        YeetSiblingCollisionCapsule.make({ ...siblingCapsule, contendedPaths: ["a.ts", "b.ts"] })
      )
    );
    expect(A.map(rows, yeetInboxExpectedRowId)).toStrictEqual(A.map(rows, (subject) => subject.id));
    expect(A.map(rows, describeYeetInboxRow)).toStrictEqual([
      "sibling collision with /fleet/b (2 path(s))",
      "review thread PRRT_abc (pr #751 @ abc123d)",
      "base drift from origin/main (pr #751 @ abc123d)",
      "local shard Check exited 1 @ abc123d",
    ]);
  });
});

describe("yeetInboxPaths", () => {
  it.effect("resolves the inbox layout under the checkout", () =>
    Effect.gen(function* () {
      const paths = yield* yeetInboxPaths("/repo");

      expect(paths.dir).toBe("/repo/.beep/inbox");
      expect(paths.activePath).toBe("/repo/.beep/inbox/active.ndjson");
      expect(paths.failuresPath).toBe("/repo/.beep/inbox/failures.ndjson");
      expect(paths.acksDir).toBe("/repo/.beep/inbox/acks");
    }).pipe(provideScopedLayer(NodePath.layer))
  );

  it.effect("resolves a row's ack receipt under the acks directory", () =>
    Effect.gen(function* () {
      const ackPath = yield* yeetInboxAckPath("/repo", "coverage-abc123");

      expect(ackPath).toBe("/repo/.beep/inbox/acks/coverage-abc123");
    }).pipe(provideScopedLayer(NodePath.layer))
  );
});

describe("renderYeetInboxRowLine", () => {
  it.effect("renders one single-line JSON document that round-trips through the codec", () =>
    Effect.gen(function* () {
      const subject = row(capsule());
      const line = yield* renderYeetInboxRowLine(subject);

      expect(Str.includes("\n")(line)).toBe(false);
      const decoded = yield* YeetInboxRowJson.decode(line);
      expect(decoded.kind).toBe("check-failed");
      expect(decoded.schemaVersion).toBe(YEET_INBOX_SCHEMA_VERSION);
      expect(decoded.capsule).toStrictEqual(subject.capsule);
    })
  );

  it("rejects garbage instead of decaying to a partial row", () => {
    expect(O.isNone(YeetInboxRowJson.decodeOption("not json"))).toBe(true);
    expect(O.isNone(YeetInboxRowJson.decodeOption('{"kind":"check-failed"}'))).toBe(true);
  });
});

describe("appendYeetInboxRow", () => {
  it.live("creates the inbox on first use and appends whole decodable lines", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const first = row(capsule());
        const second = row(capsule({ lane: "Check / Lint" }));

        yield* appendYeetInboxRow(root, first);
        yield* appendYeetInboxRow(root, second);

        const paths = yield* yeetInboxPaths(root);
        const text = yield* fs.readFileString(paths.failuresPath);
        const lines = A.filter(Str.split(text, "\n"), Str.isNonEmpty);
        expect(A.length(lines)).toBe(2);

        const decoded = yield* Effect.forEach(lines, (line) => YeetInboxRowJson.decode(line));
        expect(
          A.getSomes(
            A.map(decoded, (entry) => (entry.kind === "check-failed" ? O.some(entry.capsule.lane) : O.none<string>()))
          )
        ).toEqual(["Check / Coverage", "Check / Lint"]);

        const activeText = yield* fs.readFileString(paths.activePath);
        const activeRows = yield* Effect.forEach(A.filter(Str.split(activeText, "\n"), Str.isNonEmpty), (line) =>
          YeetInboxRowJson.decode(line)
        );
        expect(A.map(activeRows, (entry) => entry.id)).toEqual(expect.arrayContaining([first.id, second.id]));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("appends a row once and reports a duplicate without rewriting it", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        expect(yield* appendYeetInboxRowOnce(root, subject)).toBe(true);
        expect(yield* appendYeetInboxRowOnce(root, subject)).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("falls back to history when active-index version inspection fails", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(appendYeetInboxRowOnce("/repo", row(capsule())));
      expect(failure._tag).toBe("YeetCommandError");
    }).pipe(
      provideScopedLayer(
        Layer.mergeAll(
          NodePath.layer,
          FileSystem.layerNoop({
            exists: (path) =>
              Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  module: "InboxTest",
                  method: "exists",
                  pathOrDescriptor: path,
                })
              ),
          })
        )
      )
    )
  );

  it.live("fails closed and cleans temporary state when the active index is symlinked", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const paths = yield* yeetInboxPaths(root);
        yield* fs.makeDirectory(paths.dir, { recursive: true });
        yield* fs.writeFileString(paths.failuresPath, "");
        yield* fs.symlink(paths.failuresPath, paths.activePath);

        const failure = yield* Effect.flip(appendYeetInboxRow(root, row(capsule())));

        expect(failure.message).toContain("Failed to update the active inbox index");
        const names = yield* fs.readDirectory(paths.dir);
        expect(A.some(names, Str.startsWith(".active-row-"))).toBe(false);
        expect(A.some(names, Str.startsWith(".active-index-"))).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("keeps every unresolved P0 while bounding lower-severity history", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const paths = yield* yeetInboxPaths(root);
        yield* fs.makeDirectory(paths.dir, { recursive: true });
        const protectedP0 = row(capsule({ lane: "Check / Protected P0" }));
        const historical = [
          protectedP0,
          ...A.makeBy(3_000, (index) => row(capsule({ lane: `Check / Historical ${index}` }), "P1")),
        ];
        const lines = yield* Effect.forEach(historical, renderYeetInboxRowLine);
        yield* fs.writeFileString(paths.failuresPath, `${A.join(lines, "\n")}\n`);
        yield* fs.writeFileString(paths.activePath, `${lines.at(-1) ?? ""}\n`);

        const current = row(capsule({ lane: "Check / Current" }));
        yield* appendYeetInboxRow(root, current);

        const activeText = yield* fs.readFileString(paths.activePath);
        const activeLines = A.filter(Str.split(activeText, "\n"), Str.isNonEmpty);
        expect(activeLines).toHaveLength(2_048);
        expect(A.some(activeLines, Str.includes(current.id))).toBe(true);
        expect(A.some(activeLines, Str.includes(protectedP0.id))).toBe(true);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("appends after another writer wins the missing-inbox create race", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const first = row(capsule());
        const second = row(capsule({ lane: "Check / Lint" }));
        const firstLine = yield* renderYeetInboxRowLine(first);
        const paths = yield* yeetInboxPaths(root);
        let raceInjected = false;
        const racingFileSystem = FileSystem.FileSystem.of({
          ...fs,
          writeFileString: Effect.fn("FileSystem.FileSystem.writeFileString")((target, contents, options) => {
            if (!raceInjected && Eq.equals(target, paths.failuresPath) && options?.flag === "ax") {
              raceInjected = true;
              return Effect.gen(function* () {
                yield* fs.writeFileString(target, `${firstLine}\n`, { flag: "ax" });
                return yield* fs.writeFileString(target, contents, options);
              });
            }
            return fs.writeFileString(target, contents, options);
          }),
        });

        yield* appendYeetInboxRow(root, second).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem));

        expect(raceInjected).toBe(true);
        const text = yield* fs.readFileString(paths.failuresPath);
        const lines = A.filter(Str.split(text, "\n"), Str.isNonEmpty);
        expect(A.length(lines)).toBe(2);

        const decoded = yield* Effect.forEach(lines, (line) => YeetInboxRowJson.decode(line));
        expect(
          A.getSomes(
            A.map(decoded, (entry) => (entry.kind === "check-failed" ? O.some(entry.capsule.lane) : O.none<string>()))
          )
        ).toEqual(["Check / Coverage", "Check / Lint"]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("fails with a typed error when the inbox location is unusable", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // A file squatting on the inbox directory path makes mkdir fail.
        yield* fs.makeDirectory(`${root}/.beep`, { recursive: true });
        yield* fs.writeFileString(`${root}/.beep/inbox`, "squatter");

        const failure = yield* Effect.flip(appendYeetInboxRow(root, row(capsule())));
        expect(failure.message).toContain("inbox");
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a symlinked failures file without appending to its destination", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideRoot = `${root}/outside`;
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox`, { recursive: true });
        yield* fs.makeDirectory(outsideRoot);
        const outsideFailures = `${outsideRoot}/failures.ndjson`;
        const sentinel = "outside target must stay unchanged\n";
        yield* fs.writeFileString(outsideFailures, sentinel);
        const paths = yield* yeetInboxPaths(repoRoot);
        yield* fs.symlink(outsideFailures, paths.failuresPath);

        const failure = yield* appendYeetInboxRow(repoRoot, row(capsule())).pipe(Effect.flip);

        expect(failure._tag).toBe("YeetCommandError");
        expect(yield* fs.readFileString(outsideFailures)).toBe(sentinel);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a symlinked inbox parent without appending through it", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideInbox = `${root}/outside-inbox`;
        yield* fs.makeDirectory(`${repoRoot}/.beep`, { recursive: true });
        yield* fs.makeDirectory(outsideInbox);
        const outsideFailures = `${outsideInbox}/failures.ndjson`;
        const sentinel = "outside parent must stay unchanged\n";
        yield* fs.writeFileString(outsideFailures, sentinel);
        yield* fs.symlink(outsideInbox, `${repoRoot}/.beep/inbox`);

        const failure = yield* appendYeetInboxRow(repoRoot, row(capsule())).pipe(Effect.flip);

        expect(failure._tag).toBe("YeetCommandError");
        expect(yield* fs.readFileString(outsideFailures)).toBe(sentinel);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
