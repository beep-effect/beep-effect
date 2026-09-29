import { collectYeetStatus, RepoRunContext, YeetStatusSnapshotJson } from "@beep/repo-cli/test/Yeet";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect, it } from "@effect/vitest";
import { Duration, Effect, FileSystem, HashMap, Layer, Path, pipe, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

// W10 (goals/yeet-pr-events): the `--until-ready` poll reads its snapshot
// through collectYeetStatus. Before the collapse the remote half ran five gh
// round-trips back to back (pr view, pr checks, pr checks --required, the
// review-thread GraphQL page, run list); after it, only the view precedes the
// other four, which start together. The subprocess count is unchanged.

const HEAD = "c051bba853c051bba853c051bba853c051bba853";
const link = (job: number) => `https://github.com/beep/beep/actions/runs/77/job/${job}`;

const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/chain",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

const handle = (output: string, exitCode = 0) =>
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

const pullRequestJson = JSON.stringify({
  headRefOid: HEAD,
  id: "PR_chain",
  isDraft: false,
  labels: [{ name: "ready-for-heavy" }],
  mergeable: "MERGEABLE",
  mergeStateStatus: "BLOCKED",
  number: 1311,
  reviewDecision: null,
  state: "OPEN",
  url: "https://github.com/beep/beep/pull/1311",
});

// Two failing checks (one required), one pending, one passing.
const jsdocRatchet = {
  bucket: "fail",
  completedAt: "2026-09-25T18:26:36Z",
  link: link(1),
  name: "Check / JSDoc Ratchet",
  startedAt: "2026-09-25T18:20:01Z",
  state: "FAILURE",
  workflow: "Check",
};
const checksJson = JSON.stringify([
  jsdocRatchet,
  {
    bucket: "fail",
    completedAt: "0001-01-01T00:00:00Z",
    link: "",
    name: "Vercel",
    startedAt: "0001-01-01T00:00:00Z",
    state: "FAILURE",
    workflow: "",
  },
  {
    bucket: "pending",
    completedAt: "0001-01-01T00:00:00Z",
    link: link(2),
    name: "Check / Coverage",
    startedAt: "2026-09-25T18:21:00Z",
    state: "IN_PROGRESS",
    workflow: "Check",
  },
  {
    bucket: "pass",
    completedAt: "2026-09-25T18:15:00Z",
    link: link(3),
    name: "Check / Lint",
    startedAt: "2026-09-25T18:10:00Z",
    state: "SUCCESS",
    workflow: "Check",
  },
]);
const requiredChecksJson = JSON.stringify([
  jsdocRatchet,
  {
    bucket: "pending",
    completedAt: "0001-01-01T00:00:00Z",
    link: link(2),
    name: "Check / Coverage",
    startedAt: "2026-09-25T18:21:00Z",
    state: "IN_PROGRESS",
    workflow: "Check",
  },
]);
const threadsJson = JSON.stringify({
  data: {
    node: {
      author: { login: "author" },
      reviewThreads: {
        nodes: [
          {
            id: "PRRT_chain_1",
            isResolved: false,
            isOutdated: false,
            path: "packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts",
            line: 1317,
            resolvedBy: null,
            comments: {
              nodes: [
                { author: { __typename: "Bot", login: "openclaw" }, body: "**P2** order matters", databaseId: 7 },
              ],
            },
            latest: {
              nodes: [
                { author: { __typename: "Bot", login: "openclaw" }, body: "**P2** order matters", databaseId: 7 },
              ],
            },
          },
        ],
        pageInfo: { endCursor: null, hasNextPage: false },
      },
    },
  },
});
const runsJson = JSON.stringify([
  { databaseId: 77, headSha: HEAD, status: "completed", conclusion: "failure", name: "Check" },
  { databaseId: 76, headSha: "0".repeat(40), status: "completed", conclusion: "success", name: "Check" },
]);

type Invocation = { readonly command: string; readonly args: ReadonlyArray<string> };

interface GhRecorder {
  readonly events: Ref.Ref<ReadonlyArray<string>>;
  readonly inFlight: Ref.Ref<number>;
  readonly invocations: Ref.Ref<ReadonlyArray<Invocation>>;
  readonly maxInFlight: Ref.Ref<number>;
}

const makeRecorder = Effect.gen(function* () {
  return {
    invocations: yield* Ref.make<ReadonlyArray<Invocation>>([]),
    inFlight: yield* Ref.make(0),
    maxInFlight: yield* Ref.make(0),
    events: yield* Ref.make<ReadonlyArray<string>>([]),
  } satisfies GhRecorder;
});

// Canned gh stdout keyed by subcommand, plus `--required` for the filtered census.
const ghAnswers = HashMap.make(
  ["pr view", pullRequestJson],
  ["pr checks", checksJson],
  ["pr checks --required", requiredChecksJson],
  ["api graphql", threadsJson],
  ["run list", runsJson]
);

const ghRoute = (args: ReadonlyArray<string>): string =>
  A.join([...A.take(args, 2), ...A.filter(args, (arg) => arg === "--required")], " ");

const ghAnswer = (args: ReadonlyArray<string>): ReturnType<typeof handle> =>
  handle(O.getOrElse(HashMap.get(ghAnswers, ghRoute(args)), () => "[]"));

// Records every subprocess; each gh call holds a slot for `latency` on the
// live clock, so the recorder's peak shows how many gh calls ran at once.
// `failCensus` makes the thread read exit 1 at once and the unfiltered census
// spawn fail only after `latency`, so the thread failure lands first in time.
const withFakeRunner = (recorder: GhRecorder, latency: Duration.Duration, failCensus = false) =>
  Effect.provideService(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
      const args = command.args;
      const record = Ref.update(recorder.invocations, A.append({ command: command.command, args }));
      if (command.command !== "gh") return record.pipe(Effect.as(handle("")));
      if (failCensus && args[0] === "api") return record.pipe(Effect.as(handle("rate limited", 1)));
      const census = args[1] === "checks" && !A.contains(args, "--required");
      return Effect.gen(function* () {
        yield* record;
        yield* Ref.update(recorder.events, A.append(`start ${A.join(A.take(args, 2), " ")}`));
        const now = yield* Ref.updateAndGet(recorder.inFlight, Num.increment);
        yield* Ref.update(recorder.maxInFlight, Num.max(now));
        // The live clock: the test clock would park the read until adjusted.
        yield* TestClock.withLive(Effect.sleep(latency));
        yield* Ref.update(recorder.inFlight, Num.decrement);
        yield* Ref.update(recorder.events, A.append(`end ${A.join(A.take(args, 2), " ")}`));
        if (failCensus && census) {
          return yield* PlatformError.systemError({
            _tag: "NotFound",
            module: "YeetStatusChainTest",
            method: "spawn",
            pathOrDescriptor: A.join(args, " "),
          });
        }
        return ghAnswer(args);
      });
    })
  );

const FileSystemLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);
const PlatformLayer = Layer.mergeAll(BunCrypto.layer, FileSystemLayer);

const tempRoot = Effect.fn("statusChainTest.tempRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "yeet-status-chain-" });
});

const ghKey = (invocation: Invocation): string =>
  A.join(
    A.filter(invocation.args, (arg) => !Str.startsWith("query=")(arg)),
    " "
  );

// The snapshot collectYeetStatus wrote for this fixture BEFORE the W10 change,
// captured from the sequential implementation with the temp root replaced by
// `<root>`, the run id digest replaced by `<run>`, and createdAt at the
// TestClock epoch.
const PRE_CHANGE_SNAPSHOT_JSON = [
  '{"base":"origin/main","branch":"feature/chain","closeout":{"detail":"no closeout artifact found for ',
  'this branch","path":"<root>/.beep/yeet/runs/feature_chain-<run>/pr-closeout.json","state":"missing"}',
  ',"createdAt":"1970-01-01T00:00:00.000Z","head":"HEAD","nextCommand":"run `bun run beep yeet closeout',
  ' --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0`","r',
  'emote":{"available":true,"checked":true,"detail":"PR #1311 OPEN","checks":[{"name":"Check / JSDoc Ra',
  'tchet","outcome":"fail","required":true,"link":"https://github.com/beep/beep/actions/runs/77/job/1",',
  '"signal":{"bucket":"fail","state":"FAILURE"},"workflow":"Check","startedAt":"2026-09-25T18:20:01Z","',
  'completedAt":"2026-09-25T18:26:36Z"},{"name":"Vercel","outcome":"fail","required":false,"link":null,',
  '"signal":{"bucket":"fail","state":"FAILURE"},"workflow":null},{"name":"Check / Coverage","outcome":"',
  'pending","required":true,"link":"https://github.com/beep/beep/actions/runs/77/job/2","signal":{"buck',
  'et":"pending","state":"IN_PROGRESS"},"workflow":"Check","startedAt":"2026-09-25T18:21:00Z"},{"name":',
  '"Check / Lint","outcome":"pass","required":false,"link":"https://github.com/beep/beep/actions/runs/7',
  '7/job/3","signal":{"bucket":"pass","state":"SUCCESS"},"workflow":"Check","startedAt":"2026-09-25T18:',
  '10:00Z","completedAt":"2026-09-25T18:15:00Z"}],"checkCount":4,"failingCheckCount":2,"isDraft":false,',
  '"labels":["ready-for-heavy"],"mergeStateStatus":"BLOCKED","mergeable":"MERGEABLE","number":1311,"pen',
  'dingCheckCount":1,"requiredCheckCount":2,"failingRequiredCheckCount":1,"pendingRequiredCheckCount":1',
  ',"optionalCheckCount":2,"failingOptionalCheckCount":1,"pendingOptionalCheckCount":0,"unresolvedRevie',
  'wThreadCount":1,"unresolvedReviewThreads":["PRRT_chain_1 (packages/tooling/tool/cli/src/commands/Yee',
  't/internal/Status.ts)"],"unresolvedThreads":[{"threadId":"PRRT_chain_1","author":"openclaw","excerpt',
  '":"P2 order matters","path":"packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts","line":',
  '1317,"commentDatabaseId":7}],"followUpThreadCount":0,"followUpThreads":[],"acknowledgedThreadCount":',
  '0,"acknowledgedThreads":[],"headSha":"c051bba853c051bba853c051bba853c051bba853","rerunFailedCommand"',
  ':"gh run view 77 --json jobs --jq \'.jobs[] | select(.conclusion == \\"failure\\") | [.databaseId, .nam',
  'e] | @tsv\'","rerunFailedDecision":"same-SHA red detected for Check; rerun one job with `gh run rerun',
  ' --job <databaseId>`, never `--failed`","state":"OPEN","url":"https://github.com/beep/beep/pull/1311',
  '"},"runId":"feature_chain-<run>","schemaVersion":"yeet-status/v1","statusPath":"<root>/.beep/yeet/ru',
  'ns/feature_chain-<run>/status.json","verdict":{"detail":"no verdict artifact found for this branch",',
  '"path":"<root>/.beep/yeet/runs/feature_chain-<run>/verdict.json","state":"missing"},"worktree":{"cle',
  'an":true,"staged":0,"unstaged":0,"untracked":0},"mergeReady":{"ready":false,"failing":"closeout-run"',
  ',"criteria":{"prOpen":true,"notDraft":true,"closeoutRun":false,"requiredChecksGreen":false,"threadsR',
  'esolved":false,"mergeable":true,"mergeStateAcceptable":false,"reviewDecisionAcceptable":true}},"stal',
  'eGates":[],"unprovenGates":[{"status":"unproven","gateId":"coverage-regression","detail":"standards/',
  'coverage.regression-baseline.jsonc does not exist"},{"status":"unproven","gateId":"jsdoc-totals-ratc',
  'het","detail":"standards/jsdoc-totals.regression-baseline.jsonc does not exist"},{"status":"unproven',
  '","gateId":"knip-ratchet","detail":"standards/knip.regression-baseline.jsonc does not exist"},{"stat',
  'us":"unproven","gateId":"test-typecheck-blindspot","detail":"standards/test-typecheck.blindspot-base',
  'line.jsonc does not exist"},{"status":"unproven","gateId":"goals-doctor","detail":"goals/goals-docto',
  'r.baseline.jsonc does not exist"},{"status":"unproven","gateId":"jsdoc-documentation-inventory","det',
  'ail":"standards/jsdoc-documentation.inventory.jsonc does not exist"},{"status":"unproven","gateId":"',
  'fallow-health","detail":"standards/fallow.health.regression-baseline.jsonc does not exist"},{"status',
  '":"unproven","gateId":"schema-first-inventory","detail":"standards/schema-first.inventory.jsonc does',
  ' not exist"}]}',
].join("");

it.layer(PlatformLayer, { timeout: "30 seconds" })("yeet status chain (W10)", (it) => {
  it.effect("decodes the same snapshot, byte for byte, as the sequential chain did", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const recorder = yield* makeRecorder;
      const snapshot = yield* collectYeetStatus(contextFor(root), true).pipe(withFakeRunner(recorder, Duration.zero));
      const json = pipe(
        yield* YeetStatusSnapshotJson.encode(snapshot),
        Str.replaceAll(root, "<root>"),
        Str.replaceAll(/feature_chain-[0-9a-f]{12}/gu, "feature_chain-<run>")
      );
      expect(json).toBe(PRE_CHANGE_SNAPSHOT_JSON);
      // The fixture's rows: one required red, one optional red, one thread.
      expect(snapshot.remote.failingRequiredCheckCount).toBe(1);
      expect(snapshot.remote.failingOptionalCheckCount).toBe(1);
      expect(snapshot.remote.unresolvedReviewThreadCount).toBe(1);
    })
  );

  // Before W10: 12 subprocesses per poll (7 git + 5 gh), gh peak concurrency 1,
  // five gh round-trips deep. After: the same 12, gh peak 4, two round-trips deep.
  it.effect("spawns the same 12 subprocesses per poll but runs the four post-view gh reads at once", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const recorder = yield* makeRecorder;
      const latency = Duration.millis(150);
      yield* collectYeetStatus(contextFor(root), true).pipe(withFakeRunner(recorder, latency));
      const invocations = yield* Ref.get(recorder.invocations);
      const gh = A.filter(invocations, (invocation) => invocation.command === "gh");
      const peak = yield* Ref.get(recorder.maxInFlight);

      expect(A.length(invocations)).toBe(12);
      expect(A.length(gh)).toBe(5);
      expect(A.length(invocations) - A.length(gh)).toBe(7);
      expect(A.map(A.take(gh, 1), ghKey)).toStrictEqual([
        "pr view --json id,number,url,state,mergeable,mergeStateStatus,isDraft,reviewDecision,headRefOid,labels",
      ]);
      expect(A.sort(A.map(A.drop(gh, 1), ghKey), Order.String)).toStrictEqual([
        "api graphql -f -F id=PR_chain",
        "pr checks --json name,state,bucket,link,workflow,completedAt,startedAt,description",
        "pr checks --required --json name,state,bucket,link,workflow,completedAt,startedAt,description",
        "run list --branch feature/chain --limit 20 --json databaseId,headSha,status,conclusion,name",
      ]);
      // Two round-trips deep: the view starts and ends alone, then the other
      // four all start before any of them ends. The sequential chain
      // alternated start/end five times with a peak of 1.
      const events = yield* Ref.get(recorder.events);
      expect(A.take(events, 2)).toStrictEqual(["start pr view", "end pr view"]);
      expect(A.every(A.take(A.drop(events, 2), 4), Str.startsWith("start "))).toBe(true);
      expect(A.every(A.drop(events, 6), Str.startsWith("end "))).toBe(true);
      expect(peak).toBe(4);
    })
  );

  it.effect("still names the first failing read in the old sequential order", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const recorder = yield* makeRecorder;
      // The census spawn fails and so does the thread read, which fails first
      // in time; the sequential chain reported the census failure, and so
      // must the concurrent one.
      const error = yield* collectYeetStatus(contextFor(root), true).pipe(
        withFakeRunner(recorder, Duration.millis(100), true),
        Effect.flip
      );
      expect(error.message).toBe("Failed to inspect PR checks for yeet status.");
    })
  );
});
