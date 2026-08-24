import {
  appendYeetInboxRow,
  renderYeetInboxRowLine,
  YEET_INBOX_SCHEMA_VERSION,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxRowJson,
  yeetInboxAckPath,
  yeetInboxPaths,
  yeetInboxRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
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

const row = (subject: YeetFailureCapsule): YeetCheckFailedRow =>
  YeetCheckFailedRow.make({
    capsule: subject,
    checkout: "/repo",
    id: yeetInboxRowId(subject),
    severity: "P0",
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
});

describe("yeetInboxPaths", () => {
  it.effect("resolves the inbox layout under the checkout", () =>
    Effect.gen(function* () {
      const paths = yield* yeetInboxPaths("/repo");

      expect(paths.dir).toBe("/repo/.beep/inbox");
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
        expect(A.map(decoded, (entry) => entry.capsule.lane)).toEqual(["Check / Coverage", "Check / Lint"]);
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
        expect(A.map(decoded, (entry) => entry.capsule.lane)).toEqual(["Check / Coverage", "Check / Lint"]);
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
