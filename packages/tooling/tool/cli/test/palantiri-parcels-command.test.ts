import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  AccountHeadroomSource,
  HostPressureSource,
  InboxRowInput,
  LaneCheckoutInput,
  LaneRedsInput,
  LaneRedsSource,
  ParcelEnvelope,
  ParcelItem,
  ParcelReadOptions,
  parcelSpecs,
  SessionCursor,
  SessionCursorJson,
  SinceLastCheckSource,
  SourceFailed,
} from "@beep/palantiri";
import {
  inboxRowInput,
  layerPalantiriRuntime,
  makeHostPressureSource,
  makeLaneRedsSource,
  makeSinceLastCheckSource,
  printParcel,
  proofJobInput,
  renderParcelSpec,
} from "@beep/repo-cli/test/Palantiri";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import { layerSessionLedgerMemory, SessionLedger, SessionLedgerRow } from "@beep/repo-cli/test/Session";
import {
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSubmitter,
  ProofJobUnit,
  PrRepository,
  YeetAckState,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetInboxEntry,
  YeetInboxRowJson,
  YeetPrCommentCapsule,
  YeetPrCommentRow,
  yeetInboxRowId,
} from "@beep/repo-cli/test/Yeet";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SessionCheckoutFacts } from "@beep/repo-cli/test/Session";

const encodeInboxRowInputJson = S.encodeEffect(S.fromJsonString(InboxRowInput));
const encodeParcelEnvelopeJson = S.encodeEffect(S.fromJsonString(ParcelEnvelope));
const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output = A.empty<string>();
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(
          output,
          A.map(values, (value) => `${value}`)
        );
      },
    })
  );
  return A.join(output, "\n");
});

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const noFiles = Layer.mergeAll(FileSystem.layerNoop({}), Path.layer);

const offline = (parcel: "account-headroom" | "lane-reds" | "host-pressure" | "since-last-check") =>
  Effect.fail(SourceFailed.make({ parcel, detail: "not wired in this test" }));

const offlineSources = Layer.mergeAll(
  Layer.succeed(AccountHeadroomSource, { snapshot: offline("account-headroom") }),
  Layer.succeed(LaneRedsSource, { snapshot: offline("lane-reds") }),
  Layer.succeed(HostPressureSource, { snapshot: offline("host-pressure") }),
  Layer.succeed(SinceLastCheckSource, {
    read: Effect.fn("SinceLastCheckSource.stub.read")(() => offline("since-last-check")),
    advance: Effect.fn("SinceLastCheckSource.stub.advance")(() => offline("since-last-check")),
  })
);

const runtimeWith = <ROut, E>(source: Layer.Layer<ROut, E>) =>
  layerPalantiriRuntime(Layer.merge(offlineSources, source), Layer.empty).pipe(Layer.provide(noFiles));

// Files stay virtual and no process runs: every service a live source needs,
// named explicitly.
const platform = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    MemoryFileSystem.layer,
    Path.layer,
    NodeCrypto.layer,
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.die("no process execution in this test"))
    )
  )
);

const decodeEnvelope = S.decodeEffect(S.fromJsonString(ParcelEnvelope));

const expectClean = (json: string) => {
  expect(pipe(json, Str.includes("@"))).toBe(false);
  expect(pipe(json, Str.includes("/home/"))).toBe(false);
  expect(pipe(json, Str.includes("/tmp/"))).toBe(false);
};

const reasonOf = (envelope: ParcelEnvelope): string =>
  envelope.freshness._tag === "Unknown" ? envelope.freshness.reason : "fresh";

const facts = (checkout: string, lane: string): Effect.Effect<SessionCheckoutFacts> =>
  Effect.succeed({ repository, clone: checkout, checkout, lane, branch: `feat/${lane}` });

const ledgerRow = (checkout: string, lane: string, recordedAt: DateTime.Utc, sessionId: O.Option<string>) =>
  SessionLedgerRow.make({
    schemaVersion: "session-ledger/v1",
    repository,
    clone: checkout,
    checkout,
    lane,
    branch: `feat/${lane}`,
    state: "open",
    next: `continue ${lane}; ping someone@example.com`,
    summary: O.none(),
    pr: O.none(),
    harness: "claude-code",
    sessionId,
    recordedAt,
  });

describe("inboxRowInput", () => {
  it.effect("builds summaries from structured fields only", () =>
    Effect.gen(function* () {
      const comment = YeetPrCommentRow.make({
        id: "pr-comment-1",
        severity: "P1",
        checkout: "/home/someone/repo",
        ts: "2026-10-15T12:00:00.000Z",
        capsule: YeetPrCommentCapsule.make({
          author: "someone@example.com",
          commentId: 1,
          createdAt: "2026-10-15T12:00:00.000Z",
          excerpt: "@someone see /home/someone/notes",
          headSha: "abc123",
          link: "https://github.com/beep-effect/beep-effect/pull/1#issuecomment-1",
          prNumber: 1,
          source: "issue",
        }),
      });
      const input = inboxRowInput(
        YeetInboxEntry.make({ row: comment, ack: YeetAckState.make({ acked: false, receipt: null }), liveness: "live" })
      );
      expect(input.summary).toBe("pull request comment awaiting a reply");
      const json = yield* encodeInboxRowInputJson(input);
      expectClean(json);
    })
  );
});

describe("lane-reds", () => {
  const sampleAt = (now: DateTime.Utc) =>
    LaneRedsInput.make({
      checkouts: [
        LaneCheckoutInput.make({
          lane: "lane-a",
          branch: O.some("feat/lane-a"),
          inboxReadable: true,
          skippedLines: 0,
          rows: [
            InboxRowInput.make({
              kind: "check-failed",
              severity: "P0",
              prNumber: O.some(1817),
              summary: "Check / Coverage failure",
              observedAt: O.some(now),
              acked: false,
              superseded: false,
            }),
          ],
          jobs: O.some([]),
        }),
      ],
    });

  it.layer(runtimeWith(Layer.succeed(LaneRedsSource, { snapshot: Effect.map(DateTime.now, sampleAt) })), {
    timeout: "30 seconds",
  })("over a stub source", (it) => {
    it.effect("prints JSON and text", () =>
      Effect.gen(function* () {
        const json = yield* captureOutput(printParcel("lane-reds", true)).pipe(withEnv({}));
        const envelope = yield* decodeEnvelope(json);
        expect(envelope.freshness._tag).toBe("Fresh");
        expect(A.map(A.filter(envelope.items, ParcelItem.guards.LaneRed), (red) => red.kind)).toEqual(["check-failed"]);
        expectClean(json);
        const text = yield* captureOutput(printParcel("lane-reds", false)).pipe(withEnv({}));
        expect(text).toContain("lane-reds: 1 of 1 red fresh; 1 P0, 0 P1 across 1 lane");
        expect(text).toContain("P0 lane-a #1817  check-failed: Check / Coverage failure");
      })
    );
  });

  it.layer(Layer.merge(platform, layerSessionLedgerMemory), { timeout: "30 seconds" })("over the live source", (it) => {
    it.effect("reads this checkout and the live ledger lanes, skipping retired ones", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-lane-reds-" });
        const current = path.join(root, "lane-a");
        const sibling = path.join(root, "lane-b");
        yield* fs.makeDirectory(current);
        yield* fs.makeDirectory(sibling);
        const now1 = yield* DateTime.now;
        const capsule = YeetFailureCapsule.make({
          bucket: "fail",
          headSha: "abc123",
          lane: "Check / Coverage",
          link: null,
          observedAt: DateTime.formatIso(now1),
          prNumber: 1817,
          state: "FAILURE",
          workflow: null,
        });
        // The inbox's own row codec writes the line `yeet` would append.
        const line = yield* YeetInboxRowJson.encode(
          YeetCheckFailedRow.make({
            capsule,
            checkout: sibling,
            id: yield* yeetInboxRowId(capsule),
            severity: "P0",
            ts: capsule.observedAt,
          })
        );
        yield* fs.makeDirectory(path.join(sibling, ".beep", "inbox"), { recursive: true });
        yield* fs.writeFileString(path.join(sibling, ".beep", "inbox", "failures.ndjson"), `${line}\n`);
        const ledger = yield* SessionLedger;
        const now = yield* DateTime.now;
        yield* ledger.append(ledgerRow(sibling, "lane-b", now, O.none()));
        yield* ledger.append(ledgerRow(path.join(root, "retired"), "retired", now, O.none()));
        const source = yield* makeLaneRedsSource(facts(current, "lane-a"));
        const input = yield* source.snapshot;
        expect(A.map(input.checkouts, (checkout) => checkout.lane)).toEqual(["lane-a", "lane-b"]);
        const reds = A.flatMap(input.checkouts, (checkout) => checkout.rows);
        expect(A.map(reds, (row) => [row.kind, row.summary])).toEqual([["check-failed", "Check / Coverage failure"]]);
      })
    );
  });
});

describe("host-pressure", () => {
  const CPU =
    "some avg10=2.13 avg60=1.05 avg300=0.48 total=987654321\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n";
  const memoryStats = MemoryStats.of({ availableGib: Effect.succeed(40), totalGib: Effect.succeed(64) });

  // A temporary proc root, optionally with pressure files, read through the
  // live source.
  const procRuntime = (files: ReadonlyArray<readonly [string, string]>) =>
    Layer.unwrap(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const proc = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-proc-" });
        if (A.isReadonlyArrayNonEmpty(files)) {
          yield* fs.makeDirectory(path.join(proc, "pressure"));
        }
        yield* Effect.forEach(files, ([name, text]) => fs.writeFileString(path.join(proc, "pressure", name), text), {
          discard: true,
        });
        const source = yield* makeHostPressureSource({ procRoot: proc, admission: Effect.succeedNone }).pipe(
          Effect.provideService(MemoryStats, memoryStats)
        );
        return runtimeWith(Layer.succeed(HostPressureSource, source));
      })
    ).pipe(Layer.provide(platform));

  it.layer(
    procRuntime([
      ["cpu", CPU],
      ["memory", CPU],
      ["io", "garbage\n"],
    ]),
    { timeout: "30 seconds" }
  )("with pressure files", (it) => {
    it.effect("reads them through the port and serves them", () =>
      Effect.gen(function* () {
        const json = yield* captureOutput(printParcel("host-pressure", true)).pipe(withEnv({}));
        const envelope = yield* decodeEnvelope(json);
        expect(reasonOf(envelope)).toBe("attribution-incomplete");
        expect(envelope.summary).toBe(
          "3 of 4 readings fresh; 1 unreachable (io); cpu 2.1%, memory 2.1% stalled (some, avg10); 40 of 64 GiB available"
        );
        expectClean(json);
      })
    );
  });

  it.layer(procRuntime([]), { timeout: "30 seconds" })("without /proc/pressure", (it) => {
    it.effect("is Unknown{unreachable}", () =>
      Effect.gen(function* () {
        const json = yield* captureOutput(printParcel("host-pressure", true)).pipe(withEnv({}));
        const envelope = yield* decodeEnvelope(json);
        expect(reasonOf(envelope)).toBe("unreachable");
        expect(envelope.summary).toContain("no pressure stall information");
      })
    );
  });
});

describe("app-error-classes", () => {
  it.layer(runtimeWith(Layer.empty), { timeout: "30 seconds" })((it) => {
    it.effect("prints Unknown{no-source} with no items", () =>
      Effect.gen(function* () {
        const json = yield* captureOutput(printParcel("app-error-classes", true)).pipe(withEnv({}));
        const envelope = yield* decodeEnvelope(json);
        expect(reasonOf(envelope)).toBe("no-source");
        expect(envelope.items).toEqual([]);
        expect(envelope.summary).toBe("app error classes unavailable: no telemetry query adapter exists yet");
      })
    );
  });
});

class FixtureRoot extends Context.Service<FixtureRoot, string>()(
  "@beep/repo-cli/test/palantiri-parcels-command.test/FixtureRoot"
) {}

describe("since-last-check", () => {
  // A temporary checkout and state root, two ledger notes, and the live
  // since-last-check source behind the in-process client.
  const sinceRuntime = Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "palantiri-since-" });
      const checkout = path.join(root, "lane-a");
      yield* fs.makeDirectory(checkout);
      const ledger = yield* SessionLedger;
      const now = yield* DateTime.now;
      yield* ledger.append(
        ledgerRow(path.join(root, "lane-b"), "lane-b", DateTime.subtract(now, { minutes: 5 }), O.none())
      );
      yield* ledger.append(ledgerRow(checkout, "lane-a", DateTime.subtract(now, { minutes: 4 }), O.some("session-1")));
      const source = yield* makeSinceLastCheckSource(facts(checkout, "lane-a"));
      return Layer.merge(runtimeWith(Layer.succeed(SinceLastCheckSource, source)), Layer.succeed(FixtureRoot, root));
    })
  ).pipe(Layer.provideMerge(Layer.merge(platform, layerSessionLedgerMemory)));

  it.layer(sinceRuntime, { timeout: "30 seconds" })((it) => {
    it.effect("reads changes, advances the cursor atomically, and needs a session", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* FixtureRoot;
        const now = yield* DateTime.now;
        const read = (session: string | undefined) =>
          captureOutput(
            printParcel("since-last-check", true, ParcelReadOptions.make({ session: O.fromUndefinedOr(session) }))
          ).pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: path.join(root, "state") }), Effect.flatMap(decodeEnvelope));

        const anonymous = yield* read(undefined);
        expect(reasonOf(anonymous)).toBe("attribution-incomplete");

        // session-2 has no cursor and no notes of its own, so every note is new.
        const first = yield* read("session-2");
        expect(A.map(A.filter(first.items, ParcelItem.guards.SessionChange), (change) => change.lane)).toEqual([
          "lane-a",
          "lane-b",
        ]);
        const encodedParcelEnvelopeJson = yield* encodeParcelEnvelopeJson(first);
        expectClean(encodedParcelEnvelopeJson);

        const cursorDir = path.join(root, "state", "cursors", "github.com__beep-effect__beep-effect");
        const cursor = yield* fs
          .readFileString(path.join(cursorDir, "session-2.json"))
          .pipe(Effect.flatMap(S.decodeEffect(SessionCursorJson)));
        expect(DateTime.toEpochMillis(cursor.checkedAt)).toBeGreaterThanOrEqual(
          DateTime.toEpochMillis(DateTime.subtract(now, { minutes: 1 }))
        );
        // The write renamed its temporary file over the cursor; none is left behind.
        const readDirectory2 = yield* fs.readDirectory(cursorDir);
        expect(readDirectory2).toEqual(["session-2.json"]);

        const second = yield* read("session-2");
        expect(second.receipt.total).toBe(0);
        expect(second.summary).toContain("nothing new since");

        // session-1 has no cursor; its own newer note is the baseline, so
        // lane-b's older note is not news.
        const own = yield* read("session-1");
        expect(own.receipt.total).toBe(0);
      })
    );
  });

  it.effect.prop(
    "every cursor round-trips through its JSON codec",
    [Arbitrary.schema(SessionCursor)],
    Effect.fnUntraced(function* ([cursor]) {
      const text = yield* S.encodeEffect(SessionCursorJson)(cursor);
      const back = yield* S.decodeEffect(SessionCursorJson)(text);
      expect(DateTime.toEpochMillis(back.checkedAt)).toBe(DateTime.toEpochMillis(cursor.checkedAt));
    }),
    { arbitrary: fcRuns(24) }
  );
});

describe("beep palantiri parcels", () => {
  it("lists every parcel with its key, bound and sources", () => {
    expect(A.map(parcelSpecs, renderParcelSpec)).toEqual([
      "account-headroom  key=account  bound=300s  sources=accounts-poll, accounts-retained",
      "lane-reds  key=lane  bound=600s  sources=yeet-inbox, proof-jobs",
      "host-pressure  key=host  bound=60s  sources=proc-pressure, proc-meminfo, admission-slots",
      "app-error-classes  key=app  bound=900s  sources=grafana-query",
      "since-last-check  key=session  bound=none (event-sourced)  sources=session-ledger, yeet-inbox, session-cursor",
    ]);
  });
});

const settledJob = (terminationReason: O.Option<"cancelled" | "signal">) =>
  ProofJobRecord.make({
    jobId: "cc5d6bd3-1111-4aaa-8bbb-000000000002",
    phase: "terminated",
    submittedAt: "2026-10-15T10:00:00.000Z",
    request: ProofJobRequest.make({
      mode: "monitor",
      argv: ["monitor"],
      checkout: "/repo",
      branch: "feat/lane",
      base: "origin/main",
      head: Str.repeat(40)("0"),
      forwardedEnvNames: [],
    }),
    submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
    unit: ProofJobUnit.make({
      unitName: "beep-proof-test.service",
      slice: "agent-runs.slice",
      description: "test",
      logPath: "/repo/test.log",
      execStart: ["bun"],
      execStopPost: ["bun"],
      maxRuntimeSeconds: O.none(),
      invocationId: O.none(),
    }),
    runner: O.none(),
    outcome: O.none(),
    systemd: O.none(),
    terminationReason,
    cancelRequestedAt: O.none(),
    prNumber: O.some(1831),
  });

describe("proofJobInput", () => {
  it("drops a job cancelled before its verdict, so it cannot clear an earlier failure", () => {
    assertNone(O.some("cancelled" as const).pipe(settledJob, proofJobInput));
  });

  it("keeps a job that died before its verdict as a failure", () => {
    assertSome(
      O.some("signal" as const).pipe(
        settledJob,
        proofJobInput,
        O.map((job) => job.failed)
      ),
      true
    );
  });
});
