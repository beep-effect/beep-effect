import * as NodeZlib from "node:zlib";
import { fcRuns } from "@beep/fc-runs";
import {
  HostedJob,
  HostedRun,
  RouteCorpus,
  RouteCorpusCaptureOptions,
  RouteCorpusReceipt,
  RouteError,
} from "@beep/repo-cli/commands/Ci";
import {
  makeRouteCorpus,
  ROUTE_CORPUS_FILE,
  ROUTE_CORPUS_LIST_CAP,
  ROUTE_CORPUS_RECEIPT_FILE,
  RouteCorpusLive,
} from "@beep/repo-cli/commands/Ci/RouteCorpus";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertInclude, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus";

const FIXTURES = new URL("./fixtures/ci-route/corpus/", import.meta.url);
const PR_RUN = 18890000101;
const MAIN_RUN = 18890000102;
const RERUN = 18890000105;
const HEAVY_RUN = 18890000201;
const PR_HEAD = "a1e7f3c5b9d2e4f6a8c0b1d3e5f7a9c2b4d6e8f0";
const MAIN_HEAD = "b2f8c4d6e8a0b1c3d5e7f9a2b4c6d8e0f1a3b5c7";
const LIST_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headBranch,headSha,attempt";
const VIEW_FIELDS = "databaseId,workflowName,event,conclusion,createdAt,headBranch,headSha,attempt,jobs";

type Calls = Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>;

const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(RouteCorpusReceipt));
const encodeReceipt = S.encodeEffect(S.fromJsonString(RouteCorpusReceipt));
const decodeRun = S.decodeUnknownEffect(S.fromJsonString(HostedRun));

// Answers `gh run list` and `gh run view` from the recorded payloads and records
// every call with its cwd first; a date with no recorded list has no runs.
const fixtureRunner = Effect.fn("RouteCorpusTest.fixtureRunner")(function* (calls: Calls) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* path.fromFileUrl(FIXTURES);
  const runGh: RouteGhRunner = (args, cwd) => {
    const name = args[1] === "list" ? `list.${args[3]}.${args[5]}.json` : `view.${args[2]}.json`;
    const file = path.join(directory, name);
    return Ref.update(calls, A.append([cwd, ...args])).pipe(
      Effect.andThen(fs.exists(file)),
      Effect.flatMap((present) => (present ? fs.readFileString(file) : Effect.succeed("[]"))),
      Effect.mapError(RouteError.mapError("corpus-fetch", `fixture ${name} is unreadable`))
    );
  };
  return runGh;
});

const fixtureText = Effect.fn("RouteCorpusTest.fixtureText")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(yield* path.fromFileUrl(FIXTURES), name));
});

const viewedRunIds = (calls: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  pipe(
    calls,
    A.filter((call) => call[2] === "view"),
    A.flatMap((call) => O.toArray(A.get(call, 3))),
    A.sort(Order.String)
  );

const listCalls = (calls: ReadonlyArray<ReadonlyArray<string>>): number =>
  A.length(A.filter(calls, (call) => call[2] === "list"));

const captureOptions = (
  repoRoot: string,
  window: { readonly since?: string; readonly until?: O.Option<string> } = {}
) =>
  RouteCorpusCaptureOptions.make({
    repoRoot,
    since: window.since ?? "2026-10-27",
    until: window.until ?? O.some("2026-10-28"),
    workflows: ["Check", "Heavy"],
    outDir: "corpus",
  });

const sha256Hex = Effect.fn("RouteCorpusTest.sha256Hex")(function* (bytes: Uint8Array) {
  const crypto = yield* Crypto.Crypto;
  return Hex.encode(yield* crypto.digest("SHA-256", bytes));
});

const gunzip = (bytes: Uint8Array): string => new TextDecoder().decode(NodeZlib.gunzipSync(bytes));

const ndjsonRuns = (bytes: Uint8Array) =>
  Effect.forEach(A.filter(Str.split(gunzip(bytes), "\n"), Str.isNonEmpty), (line) => decodeRun(line));

// Rewrites the corpus to `text` and pins the receipt to the new bytes, so only
// the content (not the digest) is wrong.
const repin = Effect.fn("RouteCorpusTest.repin")(function* (
  outDir: string,
  text: string,
  runs: (receipt: RouteCorpusReceipt) => number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = NodeZlib.gzipSync(new TextEncoder().encode(text));
  yield* fs.writeFile(path.join(outDir, ROUTE_CORPUS_FILE), bytes);
  const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
  const receipt = yield* decodeReceipt(yield* fs.readFileString(receiptPath));
  const repinned = RouteCorpusReceipt.make({ ...receipt, runs: runs(receipt), sha256: yield* sha256Hex(bytes) });
  yield* fs.writeFileString(receiptPath, yield* encodeReceipt(repinned));
});

const handle = (exitCode: number, output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

// A scripted `gh`: records every spawn as [cwd, command, ...args] and answers it.
const scriptedSpawner = (
  spawns: Calls,
  answer: (
    args: ReadonlyArray<string>
  ) => Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>
) =>
  ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
    return Ref.update(spawns, A.append([command.options.cwd ?? "", command.command, ...command.args])).pipe(
      Effect.andThen(answer(command.args))
    );
  });

const captureLive = (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"], options: RouteCorpusCaptureOptions) =>
  Effect.gen(function* () {
    const corpus = yield* RouteCorpus;
    return yield* corpus.capture(options);
  }).pipe(provideScopedLayer(RouteCorpusLive), Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

// The production runner retries twice with backoff. The capture does real I/O
// between its sleeps, so keep advancing the test clock until it has finished.
const failLive = Effect.fn("RouteCorpusTest.failLive")(function* (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  options: RouteCorpusCaptureOptions
) {
  const fiber = yield* captureLive(spawner, options).pipe(Effect.flip, Effect.forkChild);
  yield* TestClock.adjust("1 second").pipe(Effect.repeat({ until: () => fiber.pollUnsafe() !== undefined }));
  return yield* Fiber.join(fiber);
});

// The corpus stores one encoded HostedRun per line and the receipt as JSON, so
// every value the schemas admit must survive those exact codecs. Compare by
// schema equivalence: JSON writes the generated integer -0 as 0.
const sameRun = S.toEquivalence(HostedRun);
const sameReceipt = S.toEquivalence(RouteCorpusReceipt);
it.effect.prop(
  "generated hosted runs and receipts round-trip through the corpus codecs",
  [Arbitrary.schema(HostedRun), Arbitrary.schema(RouteCorpusReceipt)],
  Effect.fnUntraced(function* ([run, receipt]) {
    const runCodec = S.fromJsonString(HostedRun);
    const line = yield* S.encodeEffect(runCodec)(run);
    const decodedRun = yield* S.decodeEffect(runCodec)(line);
    assertTrue(sameRun(decodedRun, run));
    expect(yield* S.encodeEffect(runCodec)(decodedRun)).toBe(line);

    const receiptCodec = S.fromJsonString(RouteCorpusReceipt);
    const text = yield* S.encodeEffect(receiptCodec)(receipt);
    const decodedReceipt = yield* S.decodeEffect(receiptCodec)(text);
    assertTrue(sameReceipt(decodedReceipt, receipt));
    expect(yield* S.encodeEffect(receiptCodec)(decodedReceipt)).toBe(text);
  }),
  { arbitrary: fcRuns(50) }
);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("route corpus capture and load", (it) => {
  it.effect("captures the selected runs into a pinned gzip and receipt", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const corpus = yield* makeRouteCorpus(yield* fixtureRunner(calls));

      const receipt = yield* corpus.capture(captureOptions(root));

      const bytes = yield* fs.readFile(path.join(root, "corpus", ROUTE_CORPUS_FILE));
      expect(receipt).toEqual(
        RouteCorpusReceipt.make({
          schemaVersion: "route-corpus/v1",
          capturedAt: "1970-01-01T00:00:00.000Z",
          since: "2026-10-27",
          until: "2026-10-28",
          workflows: ["Check", "Heavy"],
          runs: 4,
          heads: 3,
          path: `corpus/${ROUTE_CORPUS_FILE}`,
          sha256: yield* sha256Hex(bytes),
        })
      );
      expect(
        yield* decodeReceipt(yield* fs.readFileString(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE)))
      ).toEqual(receipt);

      // createdAt order; the Check and Heavy runs of one push share a second and sort by run id.
      const runs = yield* ndjsonRuns(bytes);
      expect(A.map(runs, (run) => run.runId)).toEqual([PR_RUN, HEAVY_RUN, MAIN_RUN, RERUN]);
      expect(A.filter(runs, (run) => run.runId === HEAVY_RUN)).toEqual([
        HostedRun.make({
          runId: HEAVY_RUN,
          workflow: "Heavy",
          event: "pull_request",
          headBranch: "feat/route-corpus",
          headSha: PR_HEAD,
          createdAt: "2026-10-27T14:02:11Z",
          conclusion: O.some("success"),
          attempt: 1,
          jobs: [
            HostedJob.make({
              name: "Heavy / Check",
              conclusion: O.some("success"),
              startedAt: O.some("2026-10-27T14:05:03Z"),
              completedAt: O.some("2026-10-27T14:47:58Z"),
            }),
            // gh omitted completedAt for the cancelled job.
            HostedJob.make({
              name: "Heavy / Docgen",
              conclusion: O.some("cancelled"),
              startedAt: O.some("2026-10-27T14:05:04Z"),
            }),
          ],
        }),
      ]);
      expect(A.filter(runs, (run) => run.runId === MAIN_RUN)).toEqual([
        HostedRun.make({
          runId: MAIN_RUN,
          workflow: "Check",
          event: "push",
          headBranch: "main",
          headSha: MAIN_HEAD,
          createdAt: "2026-10-27T15:10:05Z",
          conclusion: O.some("failure"),
          attempt: 1,
          jobs: [
            HostedJob.make({
              name: "Check / Lint",
              conclusion: O.some("failure"),
              startedAt: O.some("2026-10-27T15:10:22Z"),
              completedAt: O.some("2026-10-27T15:24:40Z"),
            }),
            // Go's zero time is gh's spelling of a timestamp that never happened.
            HostedJob.make({ name: "Check / Docgen", conclusion: O.some("cancelled") }),
          ],
        }),
      ]);

      // Only kept runs are viewed: the push to a feature branch, the dispatch and
      // the unfinished pull-request run never are.
      const recorded = yield* Ref.get(calls);
      expect(viewedRunIds(recorded)).toEqual([`${PR_RUN}`, `${MAIN_RUN}`, `${RERUN}`, `${HEAVY_RUN}`]);
      expect(listCalls(recorded)).toBe(4);
      expect(recorded).toContainEqual([
        root,
        "run",
        "list",
        "--workflow",
        "Heavy",
        "--created",
        "2026-10-28",
        "--limit",
        `${ROUTE_CORPUS_LIST_CAP}`,
        "--json",
        LIST_FIELDS,
      ]);
      expect(recorded).toContainEqual([root, "run", "view", `${PR_RUN}`, "--json", VIEW_FIELDS]);
    })
  );

  it.effect("resumes by run id and re-fetches only a run whose attempt moved", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const runGh = yield* fixtureRunner(calls);
      const corpus = yield* makeRouteCorpus(runGh);

      const first = yield* corpus.capture(captureOptions(root));
      yield* Ref.set(calls, []);
      const second = yield* corpus.capture(captureOptions(root));

      expect(viewedRunIds(yield* Ref.get(calls))).toEqual([]);
      expect(listCalls(yield* Ref.get(calls))).toBe(4);
      expect(second).toEqual(first);

      // A re-run keeps its run id and bumps the attempt; that run alone is fetched again.
      const rerun: RouteGhRunner = (args, cwd) =>
        args[3] === "Check" && args[5] === "2026-10-27"
          ? Effect.succeed(
              `[{"attempt":2,"databaseId":${PR_RUN},"event":"pull_request","headBranch":"feat/route-corpus","status":"completed"}]`
            )
          : runGh(args, cwd);
      yield* Ref.set(calls, []);
      const third = yield* (yield* makeRouteCorpus(rerun)).capture(captureOptions(root));
      expect(viewedRunIds(yield* Ref.get(calls))).toEqual([`${PR_RUN}`]);
      expect(third.runs).toBe(4);
    })
  );

  it.effect("fails closed when a date reaches the list cap", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const runGh = yield* fixtureRunner(calls);
      const fullPage = `[${A.join(
        A.makeBy(
          ROUTE_CORPUS_LIST_CAP,
          (index) =>
            `{"attempt":1,"databaseId":${index + 1},"event":"pull_request","headBranch":"feat/x","status":"completed"}`
        ),
        ","
      )}]`;
      const capped: RouteGhRunner = (args, cwd) =>
        args[3] === "Heavy" && args[5] === "2026-10-27" ? Effect.succeed(fullPage) : runGh(args, cwd);

      const error = yield* Effect.flip((yield* makeRouteCorpus(capped)).capture(captureOptions(root)));

      expect(error.reason).toBe("corpus-fetch");
      assertInclude(
        error.message,
        `--workflow Heavy --created 2026-10-27 reached the ${ROUTE_CORPUS_LIST_CAP}-run API cap`
      );
      expect(viewedRunIds(yield* Ref.get(calls))).toEqual([]);
      expect(yield* fs.exists(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE))).toBe(false);
    })
  );

  it.effect("loads a pinned corpus and refuses one whose bytes changed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const corpus = yield* makeRouteCorpus(
        yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
      );
      const receipt = yield* corpus.capture(captureOptions(root));
      const receiptPath = path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE);

      const loaded = yield* corpus.load(receiptPath);
      expect(loaded.receipt).toEqual(receipt);
      expect(A.map(loaded.runs, (run) => run.runId)).toEqual([PR_RUN, HEAVY_RUN, MAIN_RUN, RERUN]);

      const corpusPath = path.join(root, "corpus", ROUTE_CORPUS_FILE);
      const bytes = yield* fs.readFile(corpusPath);
      yield* fs.writeFile(
        corpusPath,
        Uint8Array.from(bytes, (byte, index) => (index === 20 ? byte ^ 0xff : byte))
      );
      const error = yield* Effect.flip(corpus.load(receiptPath));
      expect(error.reason).toBe("corpus-pin");
      assertInclude(error.message, `but its receipt pins ${receipt.sha256}`);
    })
  );

  it.effect("refuses a malformed line, a truncated corpus and a miscounted receipt", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const corpus = yield* makeRouteCorpus(
        yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
      );
      yield* corpus.capture(captureOptions(root));
      const outDir = path.join(root, "corpus");
      const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
      const text = gunzip(yield* fs.readFile(path.join(outDir, ROUTE_CORPUS_FILE)));

      yield* repin(outDir, `${text}{"runId":"not-a-number"}\n`, (receipt) => receipt.runs + 1);
      const malformed = yield* Effect.flip(corpus.load(receiptPath));
      expect(malformed.reason).toBe("corpus-pin");
      assertInclude(malformed.message, "line 5 is not a HostedRun");
      // A resumed capture refuses the same corpus instead of skipping the line.
      const resumed = yield* Effect.flip(corpus.capture(captureOptions(root)));
      expect(resumed.reason).toBe("corpus-pin");
      assertInclude(resumed.message, "line 5 is not a HostedRun");

      yield* repin(outDir, Str.trimEnd(text), (receipt) => receipt.runs);
      const truncated = yield* Effect.flip(corpus.load(receiptPath));
      expect(truncated.reason).toBe("corpus-pin");
      assertInclude(truncated.message, "does not end with a newline");

      yield* repin(outDir, text, () => 99);
      const miscounted = yield* Effect.flip(corpus.load(receiptPath));
      expect(miscounted.reason).toBe("corpus-pin");
      assertInclude(miscounted.message, "holds 4 runs, but its receipt counts 99");
    })
  );

  it.effect("defaults until to today, widens an adjacent window and refuses a gap", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const corpus = yield* makeRouteCorpus(yield* fixtureRunner(calls));
      yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-29T12:00:00Z").pipe(DateTime.toEpochMillis));

      // No runs on 2026-10-29: the corpus is empty but still pinned and loadable.
      const today = yield* corpus.capture(captureOptions(root, { since: "2026-10-29", until: O.none() }));
      expect(today.until).toBe("2026-10-29");
      expect(today.runs).toBe(0);
      expect(today.heads).toBe(0);
      expect((yield* corpus.load(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE))).runs).toEqual([]);

      // 2026-10-27..28 adjoins 2026-10-29: the receipt window grows to cover both.
      const widened = yield* corpus.capture(captureOptions(root));
      expect([widened.since, widened.until, widened.runs]).toEqual(["2026-10-27", "2026-10-29", 4]);

      const gap = yield* Effect.flip(
        corpus.capture(captureOptions(root, { since: "2026-10-31", until: O.some("2026-11-01") }))
      );
      expect(gap.reason).toBe("corpus-fetch");
      assertInclude(gap.message, "leaves a gap beside the captured 2026-10-27..2026-10-29");

      const backwards = yield* Effect.flip(
        corpus.capture(captureOptions(root, { since: "2026-10-28", until: O.some("2026-10-27") }))
      );
      expect(backwards.reason).toBe("corpus-fetch");
      assertInclude(backwards.message, "since 2026-10-28 is after until 2026-10-27");

      const impossible = yield* Effect.flip(corpus.capture(captureOptions(root, { since: "2026-02-30" })));
      expect(impossible.reason).toBe("corpus-fetch");
      assertInclude(impossible.message, `since "2026-02-30" is not a UTC date`);
    })
  );

  it.effect("refuses a view payload for a different run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const runGh = yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]));
      const crossed: RouteGhRunner = (args, cwd) =>
        args[2] === `${PR_RUN}` ? runGh(["run", "view", `${MAIN_RUN}`], cwd) : runGh(args, cwd);

      const error = yield* Effect.flip((yield* makeRouteCorpus(crossed)).capture(captureOptions(root)));

      expect(error.reason).toBe("corpus-fetch");
      assertInclude(error.message, `gh run view ${PR_RUN} answered for run ${MAIN_RUN}`);
    })
  );

  it.effect("runs gh through the repo capture in the capture's repo root", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const spawns = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const list = yield* fixtureText("list.Check.2026-10-28.json");
      const view = yield* fixtureText(`view.${RERUN}.json`);
      const options = RouteCorpusCaptureOptions.make({
        repoRoot: root,
        since: "2026-10-28",
        until: O.some("2026-10-28"),
        workflows: ["Check"],
        outDir: "corpus",
      });

      const receipt = yield* captureLive(
        scriptedSpawner(spawns, (args) => Effect.succeed(handle(0, args[1] === "list" ? list : view))),
        options
      );

      expect([receipt.runs, receipt.heads]).toEqual([1, 1]);
      expect(yield* Ref.get(spawns)).toEqual([
        [
          root,
          "gh",
          "run",
          "list",
          "--workflow",
          "Check",
          "--created",
          "2026-10-28",
          "--limit",
          "1000",
          "--json",
          LIST_FIELDS,
        ],
        [root, "gh", "run", "view", `${RERUN}`, "--json", VIEW_FIELDS],
      ]);
    })
  );

  it.effect("retries a failing gh twice, then fails with the failure in the message", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
      const options = RouteCorpusCaptureOptions.make({
        repoRoot: root,
        since: "2026-10-28",
        until: O.some("2026-10-28"),
        workflows: ["Check"],
        outDir: "corpus",
      });

      const exits = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
      const exited = yield* failLive(
        scriptedSpawner(exits, () => Effect.succeed(handle(1, "HTTP 502: Bad Gateway"))),
        options
      );
      expect(exited.reason).toBe("corpus-fetch");
      assertInclude(exited.message, "exited 1: HTTP 502: Bad Gateway");
      expect(A.length(yield* Ref.get(exits))).toBe(3);

      const truncated = yield* failLive(
        scriptedSpawner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]), () =>
          Effect.succeed(handle(0, Str.repeat(512 * 1024 + 1)("x")))
        ),
        options
      );
      assertInclude(truncated.message, "overflowed the capture bound");

      const missing = yield* failLive(
        scriptedSpawner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]), () =>
          Effect.fail(PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" }))
        ),
        options
      );
      assertInclude(missing.message, "Failed to spawn gh run list");
    })
  );
});
