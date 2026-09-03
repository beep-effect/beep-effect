import { CommandStdinSource } from "@beep/repo-cli/test/Cli";
import {
  ackYeetInboxRow,
  appendYeetInboxRow,
  appendYeetInboxRowFromText,
  filterYeetInboxEntries,
  loadYeetInboxView,
  parseYeetAckResolution,
  readYeetAckState,
  renderYeetInboxEntryLine,
  renderYeetInboxListOutput,
  renderYeetInboxView,
  runYeetInboxAck,
  runYeetInboxAppend,
  runYeetInboxList,
  writeYeetAckReceipt,
  YeetAckEnvironmentOnlyResolution,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetAckState,
  YeetAckWaiveResolution,
  YeetAckWontfixResolution,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxEntry,
  YeetInboxRowJson,
  YeetInboxView,
  YeetInboxViewJson,
  yeetInboxRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

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

const row = (subject: YeetFailureCapsule, severity: "P0" | "P1" | "P2" = "P0"): YeetCheckFailedRow =>
  YeetCheckFailedRow.make({
    capsule: subject,
    checkout: "/repo",
    id: yeetInboxRowId(subject),
    severity,
    ts: AT,
  });

const entry = (subject: YeetCheckFailedRow, acked = false): YeetInboxEntry =>
  YeetInboxEntry.make({
    ack: YeetAckState.make({ acked, receipt: null }),
    liveness: "live",
    row: subject,
  });

const noResolutionFlags = {
  actor: "",
  environmentOnly: false,
  expiresAt: "",
  fixSha: "",
  reason: "",
  shard: "",
  threadUrl: "",
  waive: false,
  wontfix: false,
};

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const inTempRepo = Effect.fn("inTempRepo")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

describe("filterYeetInboxEntries", () => {
  const p0 = entry(row(capsule()));
  const p1 = entry(row(capsule({ lane: "Check / Lint" }), "P1"));
  const acked = entry(row(capsule({ lane: "Check / Docs" })), true);

  it("keeps everything under the identity filter", () => {
    expect(filterYeetInboxEntries([p0, p1, acked], { severity: "all", unacked: false })).toStrictEqual([p0, p1, acked]);
  });

  it("selects by severity tier and by ack state", () => {
    expect(filterYeetInboxEntries([p0, p1, acked], { severity: "P1", unacked: false })).toStrictEqual([p1]);
    expect(filterYeetInboxEntries([p0, p1, acked], { severity: "all", unacked: true })).toStrictEqual([p0, p1]);
  });

  it("supports the data-last pipeable form", () => {
    expect(pipe([p0, acked], filterYeetInboxEntries({ severity: "P0", unacked: true }))).toStrictEqual([p0]);
  });
});

describe("renderYeetInboxEntryLine", () => {
  it("phrases an unacked live row with its coordinates", () => {
    const line = renderYeetInboxEntryLine(entry(row(capsule())));

    expect(line).toContain("P0 live unacked");
    expect(line).toContain("Check / Coverage");
    expect(line).toContain("pr #754 @ abc123d");
  });

  it("phrases an acked row with its resolution, or names an unreadable receipt", () => {
    const subject = row(capsule());
    const withReceipt = YeetInboxEntry.make({
      ack: YeetAckState.make({
        acked: true,
        receipt: YeetAckReceipt.make({
          ackedAt: AT,
          id: subject.id,
          resolution: YeetAckFixResolution.make({ sha: "2817f28" }),
        }),
      }),
      liveness: "superseded",
      row: subject,
    });

    expect(renderYeetInboxEntryLine(withReceipt)).toContain("superseded acked fix-sha 2817f28");
    expect(renderYeetInboxEntryLine(entry(subject, true))).toContain("acked (unreadable receipt)");
  });
});

describe("renderYeetInboxView", () => {
  it("summarizes counts in the header and lists one line per entry", () => {
    const view = YeetInboxView.make({
      entries: [entry(row(capsule())), entry(row(capsule({ lane: "Check / Lint" })), true)],
      skippedLines: 3,
      unreadable: false,
    });

    const rendered = renderYeetInboxView(view);
    const lines = Str.split(rendered, "\n");

    expect(A.headNonEmpty(lines)).toBe("[yeet] inbox: 2 row(s), 1 unacked, 3 skipped line(s)");
    expect(A.length(lines)).toBe(3);
  });
});

describe("renderYeetInboxView (unreadable)", () => {
  it("flags an unreadable failures file in the header", () => {
    const view = YeetInboxView.make({ entries: [], skippedLines: 0, unreadable: true });

    expect(renderYeetInboxView(view)).toContain("unreadable; inbox state unknown, not empty");
  });
});

describe("renderYeetInboxListOutput", () => {
  const view = () =>
    YeetInboxView.make({
      entries: [entry(row(capsule())), entry(row(capsule({ lane: "Check / Lint" }), "P1"), true)],
      skippedLines: 2,
      unreadable: false,
    });

  it.effect("renders the filtered operator text", () =>
    Effect.gen(function* () {
      const output = yield* renderYeetInboxListOutput(view(), { json: false, severity: "all", unacked: true });
      const lines = Str.split(output, "\n");

      expect(A.headNonEmpty(lines)).toBe("[yeet] inbox: 1 row(s), 1 unacked, 2 skipped line(s)");
      expect(A.length(lines)).toBe(2);
      expect(output).toContain("Check / Coverage");
      expect(output).not.toContain("Check / Lint");
    })
  );

  it.effect("encodes a decodable JSON document carrying only the shown entries", () =>
    Effect.gen(function* () {
      const output = yield* renderYeetInboxListOutput(view(), { json: true, severity: "P1", unacked: false });
      const decoded = yield* YeetInboxViewJson.decode(output);

      expect(decoded.schemaVersion).toBe("yeet-inbox-view/v1");
      expect(
        A.getSomes(
          A.map(decoded.entries, ({ row }) =>
            row.kind === "check-failed" ? O.some(row.capsule.lane) : O.none<string>()
          )
        )
      ).toStrictEqual(["Check / Lint"]);
      expect(decoded.skippedLines).toBe(2);
    })
  );
});

describe("parseYeetAckResolution", () => {
  it.effect("builds each resolution", () =>
    Effect.gen(function* () {
      const fix = yield* parseYeetAckResolution({ ...noResolutionFlags, fixSha: "2817f28" });
      const environmentOnly = yield* parseYeetAckResolution({
        ...noResolutionFlags,
        environmentOnly: true,
        reason: "stale upstream dist",
      });
      const wontfix = yield* parseYeetAckResolution({ ...noResolutionFlags, reason: "flaky", wontfix: true });
      const thread = yield* parseYeetAckResolution({ ...noResolutionFlags, threadUrl: "https://example.test/t/1" });
      const waive = yield* parseYeetAckResolution({
        ...noResolutionFlags,
        actor: "operator",
        expiresAt: "2099-01-01T00:00:00Z",
        reason: "dependency service unavailable",
        shard: "Security",
        waive: true,
      });

      expect(fix.kind).toBe("fix-sha");
      expect(environmentOnly).toStrictEqual(YeetAckEnvironmentOnlyResolution.make({ reason: "stale upstream dist" }));
      expect(wontfix.kind).toBe("wontfix");
      expect(thread.kind).toBe("thread-url");
      expect(waive).toStrictEqual(
        YeetAckWaiveResolution.make({
          actor: "operator",
          expiresAt: "2099-01-01T00:00:00Z",
          reason: "dependency service unavailable",
          shard: "Security",
        })
      );
    })
  );

  it.effect("refuses zero or multiple resolutions", () =>
    Effect.gen(function* () {
      const none = yield* Effect.flip(parseYeetAckResolution(noResolutionFlags));
      const both = yield* Effect.flip(
        parseYeetAckResolution({ ...noResolutionFlags, fixSha: "2817f28", threadUrl: "https://example.test/t/1" })
      );

      expect(none.message).toContain("exactly one");
      expect(both.message).toContain("exactly one");
    })
  );

  it.effect("refuses reasonless environment-only and wontfix resolutions, and a dangling reason", () =>
    Effect.gen(function* () {
      const unexplainedEnvironment = yield* Effect.flip(
        parseYeetAckResolution({ ...noResolutionFlags, environmentOnly: true })
      );
      const unexplained = yield* Effect.flip(parseYeetAckResolution({ ...noResolutionFlags, wontfix: true }));
      const dangling = yield* Effect.flip(parseYeetAckResolution({ ...noResolutionFlags, reason: "flaky" }));

      expect(unexplainedEnvironment.message).toContain("requires --reason");
      expect(unexplained.message).toContain("requires --reason");
      expect(dangling.message).toContain("only applies with --environment-only, --wontfix, or --waive");
    })
  );

  it.live("refuses malformed, expired, and partially attributed waivers", () =>
    Effect.gen(function* () {
      const invalidTimestamp = yield* Effect.flip(
        parseYeetAckResolution({
          ...noResolutionFlags,
          actor: "operator",
          expiresAt: "not-a-timestamp",
          reason: "dependency unavailable",
          shard: "Security",
          waive: true,
        })
      );
      const expired = yield* Effect.flip(
        parseYeetAckResolution({
          ...noResolutionFlags,
          actor: "operator",
          expiresAt: "2000-01-01T00:00:00Z",
          reason: "dependency unavailable",
          shard: "Security",
          waive: true,
        })
      );
      const partial = yield* Effect.flip(
        parseYeetAckResolution({
          ...noResolutionFlags,
          actor: "operator",
          reason: "dependency unavailable",
          waive: true,
        })
      );
      const dangling = yield* Effect.flip(parseYeetAckResolution({ ...noResolutionFlags, actor: "operator" }));

      expect(invalidTimestamp.message).toContain("valid --expires-at");
      expect(expired.message).toContain("future --expires-at");
      expect(partial.message).toContain("requires --actor, --expires-at, and --shard");
      expect(dangling.message).toContain("only apply with --waive");
    })
  );
});

describe("ackYeetInboxRow", () => {
  it.live("writes a decodable receipt for a known row", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        yield* appendYeetInboxRow(root, subject);

        const report = yield* ackYeetInboxRow(root, subject.id, YeetAckFixResolution.make({ sha: "2817f28" }), AT);

        expect(report.replacedPrior).toBe(false);
        expect(report.receipt.id).toBe(subject.id);
        const state = yield* readYeetAckState(root, subject.id);
        expect(state.receipt?.resolution).toStrictEqual(YeetAckFixResolution.make({ sha: "2817f28" }));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("refuses an id the inbox does not contain", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(
          ackYeetInboxRow(root, "missing-row", YeetAckFixResolution.make({ sha: "2817f28" }), AT)
        );

        expect(failure.message).toContain('No inbox row with id "missing-row"');
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("reports when a re-ack replaced a prior receipt", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        yield* appendYeetInboxRow(root, subject);
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            ackedAt: AT,
            id: subject.id,
            resolution: YeetAckWontfixResolution.make({ reason: "premature" }),
          })
        );

        const report = yield* ackYeetInboxRow(root, subject.id, YeetAckFixResolution.make({ sha: "2817f28" }), AT);

        expect(report.replacedPrior).toBe(true);
        const state = yield* readYeetAckState(root, subject.id);
        expect(state.receipt?.resolution).toStrictEqual(YeetAckFixResolution.make({ sha: "2817f28" }));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("re-arms a row after an attributed waiver expires", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        yield* appendYeetInboxRow(root, subject);
        yield* writeYeetAckReceipt(
          root,
          YeetAckReceipt.make({
            ackedAt: "2000-01-01T00:00:00Z",
            id: subject.id,
            resolution: YeetAckWaiveResolution.make({
              actor: "operator",
              expiresAt: "2000-01-01T01:00:00Z",
              reason: "temporary outage",
              shard: "Coverage",
            }),
          })
        );

        // Updating the bounded active index for unrelated evidence must not
        // discard a waived row that will become actionable again.
        yield* appendYeetInboxRow(root, row(capsule({ lane: "Check / Lint" }), "P1"));

        const state = yield* readYeetAckState(root, subject.id);
        expect(state.acked).toBe(false);
        expect(state.receipt?.resolution.kind).toBe("waive");
        const view = yield* loadYeetInboxView(root);
        expect(A.some(view.entries, (candidate) => candidate.row.id === subject.id && !candidate.ack.acked)).toBe(true);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});

describe("appendYeetInboxRowFromText", () => {
  it.live("appends a valid row document to the inbox", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        const text = yield* YeetInboxRowJson.encode(subject);

        const appended = yield* appendYeetInboxRowFromText(root, `${text}\n`);

        expect(appended.id).toBe(subject.id);
        const view = yield* loadYeetInboxView(root);
        expect(A.map(view.entries, (candidate) => candidate.row.id)).toStrictEqual([subject.id]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("refuses a row whose id breaks the deterministic contract", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const forged = YeetCheckFailedRow.make({ ...row(capsule()), id: "forged-id" });
        const text = yield* YeetInboxRowJson.encode(forged);

        const failure = yield* Effect.flip(appendYeetInboxRowFromText(root, text));

        expect(failure.message).toContain("does not match the deterministic id");
        const view = yield* loadYeetInboxView(root);
        expect(view.entries).toStrictEqual([]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("refuses garbage instead of appending it", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(appendYeetInboxRowFromText(root, "not json"));

        expect(failure.message).toContain("Failed to decode the inbox row document");
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});

// The runners resolve the checkout through findRepoRoot from process.cwd, so
// these tests temporarily point cwd at a temp directory carrying a bun.lock
// root marker. Replacing the getter works in both fork and worker-thread pools;
// Node forbids process.chdir inside worker threads.
const inTempCheckout = Effect.fn("inTempCheckout")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  const originalCwd = process.cwd;
  const enter = Effect.gen(function* () {
    const made = yield* fs.makeTempDirectory();
    yield* fs.writeFileString(`${made}/bun.lock`, "");
    yield* Effect.sync(() => {
      process.cwd = () => made;
    });
    return made;
  });
  return yield* Effect.acquireUseRelease(enter, use, (root) =>
    Effect.sync(() => {
      process.cwd = originalCwd;
    }).pipe(Effect.andThen(Effect.ignore(fs.remove(root, { recursive: true }))))
  );
});

const RunnerLayer = Layer.mergeAll(TestConsole.layer, PlatformLayer);

// Inject the stdin source: a real stdin read blocks until EOF and test
// runners hold their workers' stdin open, so runner tests always stub it.
const providedStdin = (text: string) =>
  Effect.provideService(CommandStdinSource, { interactive: () => false, text: () => Promise.resolve(text) });

describe("yeet inbox runners", () => {
  it.live("list prints the resolved checkout's inbox as text and as decodable JSON", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        yield* appendYeetInboxRow(root, row(capsule()));

        yield* runYeetInboxList({ json: false, severity: "all", unacked: false });
        yield* runYeetInboxList({ json: true, severity: "all", unacked: true });

        // The text listing is one multi-line log entry; the JSON document is
        // the second entry.
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(A.length(lines)).toBe(2);
        expect(O.getOrElse(A.head(lines), () => "")).toContain("[yeet] inbox: 1 row(s), 1 unacked, 0 skipped line(s)");
        const decoded = yield* YeetInboxViewJson.decode(O.getOrElse(A.last(lines), () => ""));
        expect(A.length(decoded.entries)).toBe(1);
      })
    ).pipe(provideScopedLayer(RunnerLayer))
  );

  it.live("ack writes the receipt from the resolved checkout and reports a replacement on re-ack", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        yield* appendYeetInboxRow(root, subject);

        yield* runYeetInboxAck({ ...noResolutionFlags, fixSha: "2817f28", id: subject.id });
        const state = yield* readYeetAckState(root, subject.id);
        expect(state.receipt?.resolution).toStrictEqual(YeetAckFixResolution.make({ sha: "2817f28" }));

        yield* runYeetInboxAck({ ...noResolutionFlags, id: subject.id, reason: "actually flaky", wontfix: true });

        const lines = A.map(yield* TestConsole.logLines, String);
        expect(A.some(lines, (line) => Str.includes("acked")(line))).toBe(true);
        expect(A.some(lines, (line) => Str.includes("replaced an existing receipt")(line))).toBe(true);
      })
    ).pipe(provideScopedLayer(RunnerLayer))
  );

  it.live("append reads the row document from stdin and appends it to the resolved checkout", () =>
    inTempCheckout((root) =>
      Effect.gen(function* () {
        const subject = row(capsule());
        const text = yield* YeetInboxRowJson.encode(subject);
        yield* runYeetInboxAppend({ fromStdin: true }).pipe(providedStdin(`${text}\n`));

        const view = yield* loadYeetInboxView(root);
        expect(A.map(view.entries, (candidate) => candidate.row.id)).toStrictEqual([subject.id]);
        const lines = A.map(yield* TestConsole.logLines, String);
        expect(A.some(lines, (line) => Str.includes("appended")(line))).toBe(true);
      })
    ).pipe(provideScopedLayer(RunnerLayer))
  );

  it.live("append refuses to run without --from-stdin before touching the checkout", () =>
    inTempCheckout(() =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(runYeetInboxAppend({ fromStdin: false }));

        expect(failure.message).toBe("yeet inbox append requires --from-stdin.");
      })
    ).pipe(provideScopedLayer(RunnerLayer))
  );
});
