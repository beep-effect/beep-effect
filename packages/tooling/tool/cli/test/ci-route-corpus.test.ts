import * as NodeZlib from "node:zlib";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { fcRuns } from "@beep/fc-runs";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
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
  makeRouteGithubRunner,
  ROUTE_CORPUS_FILE,
  ROUTE_CORPUS_LIST_CAP,
  ROUTE_CORPUS_RECEIPT_FILE,
  RouteCorpusLive,
  RouteGhRateLimited,
} from "@beep/repo-cli/commands/Ci/RouteCorpus";
import { GithubTransportFetch, layerGithubRest } from "@beep/repo-cli/test/SharedInternals";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertInclude, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { completionFetch } from "./support/CompletionFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus";

const decodeListedIds = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.Struct({ databaseId: S.Int }))));
const decodeViewedJobs = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ jobs: S.Array(S.Struct({ name: S.String })) }))
);
const FIXTURES = new URL("./fixtures/ci-route/corpus/", import.meta.url);
const PR_RUN = 18890000101;
const MAIN_RUN = 18890000102;
const RERUN = 18890000105;
const HEAVY_RUN = 18890000201;
const DAY2_RUN = 18890000107;
const DAY3_RUN = 18890000108;
const PR_HEAD = "a1e7f3c5b9d2e4f6a8c0b1d3e5f7a9c2b4d6e8f0";
const MAIN_HEAD = "b2f8c4d6e8a0b1c3d5e7f9a2b4c6d8e0f1a3b5c7";
const LIST_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headBranch,headSha,attempt";
const VIEW_FIELDS = "databaseId,workflowName,event,status,conclusion,createdAt,headBranch,headSha,attempt,jobs";

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

const viewedRunIds = (calls: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  pipe(
    calls,
    A.filter((call) => call[2] === "view"),
    A.flatMap((call) => O.toArray(A.get(call, 3))),
    A.sort(Order.String)
  );

const listCalls = (calls: ReadonlyArray<ReadonlyArray<string>>): number =>
  A.length(A.filter(calls, (call) => call[2] === "list"));

const listedDays = (calls: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  pipe(
    calls,
    A.filter((call) => call[2] === "list"),
    A.flatMap((call) => O.toArray(A.get(call, 6))),
    A.dedupe
  );

const rateLimitPayload = (reset: string): string =>
  `{"resources":{"core":{"limit":5000,"remaining":0,"reset":${DateTime.makeUnsafe(reset).pipe(DateTime.toEpochMillis) / 1000}}}}`;

const refused = (command: string) =>
  RouteGhRateLimited.make({ command, output: "HTTP 403: API rate limit exceeded for user ID 1." });

const syntheticList = (runId: number): string =>
  `[{"attempt":1,"databaseId":${runId},"event":"pull_request","headBranch":"feat/checkpoint","status":"completed"}]`;

const syntheticView = (runId: number, day: string): string =>
  `{"attempt":1,"conclusion":"success","createdAt":"${day}T08:00:00Z","databaseId":${runId},"event":"pull_request","status":"completed","headBranch":"feat/checkpoint","headSha":"f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9","jobs":[],"workflowName":"Check"}`;

// The recorded days plus two synthetic ones: 2026-10-29 holds DAY2_RUN, and
// 2026-10-30 holds DAY3_RUN, whose view GitHub refuses while `refuseDay3` holds.
// Synthetic answers are recorded like the fixture runner's.
const syntheticKey = (args: ReadonlyArray<string>): string =>
  args[0] === "api" ? "api" : args[1] === "list" ? `list ${args[3]} ${args[5]}` : `view ${args[2]}`;

const syntheticAnswers = (
  refuseDay3: boolean,
  reset: string
): Record<string, Effect.Effect<string, RouteGhRateLimited>> => ({
  api: Effect.succeed(rateLimitPayload(reset)),
  "list Check 2026-10-29": Effect.succeed(syntheticList(DAY2_RUN)),
  "list Check 2026-10-30": Effect.succeed(syntheticList(DAY3_RUN)),
  [`view ${DAY2_RUN}`]: Effect.succeed(syntheticView(DAY2_RUN, "2026-10-29")),
  [`view ${DAY3_RUN}`]: refuseDay3
    ? Effect.fail(refused(`gh run view ${DAY3_RUN}`))
    : Effect.succeed(syntheticView(DAY3_RUN, "2026-10-30")),
});

const syntheticAnswer = (
  args: ReadonlyArray<string>,
  refuseDay3: boolean,
  reset: string
): O.Option<Effect.Effect<string, RouteGhRateLimited>> =>
  R.get(syntheticAnswers(refuseDay3, reset), syntheticKey(args));

const extendedRunner =
  (calls: Calls, runGh: RouteGhRunner, refuseDay3: boolean, reset: string): RouteGhRunner =>
  (args, cwd) =>
    O.match(syntheticAnswer(args, refuseDay3, reset), {
      onNone: () => runGh(args, cwd),
      onSome: (answer) => Ref.update(calls, A.append([cwd, ...args])).pipe(Effect.andThen(answer)),
    });

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
  const digest = yield* Digest.Digest;
  return Hex.encode(yield* digest.digest(Digest.sha256, bytes));
});

const gunzip = (bytes: Uint8Array): string => new TextDecoder().decode(NodeZlib.gunzipSync(bytes));

const ndjsonRuns = (bytes: Uint8Array) =>
  Effect.forEach(A.filter(Str.split(gunzip(bytes), "\n"), Str.isNonEmpty), (line) => decodeRun(line));

const pinnedCorpusPath = Effect.fn("RouteCorpusTest.pinnedCorpusPath")(function* (outDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const receipt = yield* decodeReceipt(yield* fs.readFileString(path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE)));
  return path.join(outDir, path.basename(receipt.path));
});

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
  yield* fs.writeFile(yield* pinnedCorpusPath(outDir), bytes);
  const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
  const receipt = yield* decodeReceipt(yield* fs.readFileString(receiptPath));
  const repinned = RouteCorpusReceipt.make({ ...receipt, runs: runs(receipt), sha256: yield* sha256Hex(bytes) });
  yield* fs.writeFileString(receiptPath, yield* encodeReceipt(repinned));
});

const restRunner = (fetch: typeof globalThis.fetch) =>
  makeRouteGithubRunner.pipe(
    provideScopedLayer(
      layerGithubRest.pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            GitHubClient.layerFromToken({ token: Redacted.make("fixture"), fetch, retry: RetryPolicy.none }),
            Repo.layerFromSlug("example/repo")
          )
        )
      )
    )
  );

// Retries and rate-limit waits sleep on the test clock. The capture does real
// I/O between its sleeps, so keep advancing the clock until it has finished.
const untilDone = Effect.fn("RouteCorpusTest.untilDone")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const fiber = yield* Effect.forkChild(effect);
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

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "route corpus capture and load",
  (it) => {
    it.effect("loads and resumes a legacy fixed-filename checkpoint without losing its corpus", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const corpus = yield* makeRouteCorpus(
          yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
        );
        const receipt = yield* corpus.capture(captureOptions(root));
        const outDir = path.join(root, "corpus");
        const pinned = yield* pinnedCorpusPath(outDir);
        const legacyPath = path.join(outDir, ROUTE_CORPUS_FILE);
        yield* fs.copyFile(pinned, legacyPath);
        yield* fs.remove(pinned);
        const legacy = RouteCorpusReceipt.make({ ...receipt, path: `corpus/${ROUTE_CORPUS_FILE}` });
        const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
        yield* fs.writeFileString(receiptPath, yield* encodeReceipt(legacy));
        expect((yield* corpus.load(receiptPath)).runs).toHaveLength(4);

        const resumed = yield* corpus.capture(captureOptions(root));
        expect(resumed.path).toBe(`corpus/hosted-runs.${resumed.sha256}.ndjson.gz`);
        expect((yield* corpus.load(receiptPath)).runs).toHaveLength(4);
        expect(yield* fs.exists(legacyPath)).toBe(true);
      })
    );

    it.effect("keeps the prior checkpoint loadable when switching the receipt fails", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runner = yield* fixtureRunner(calls);
        const corpus = yield* makeRouteCorpus(runner);
        const original = yield* corpus.capture(captureOptions(root, { since: "2026-10-28" }));
        const receiptPath = path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE);
        const receiptText = yield* fs.readFileString(receiptPath);
        const extended = extendedRunner(calls, runner, false, "2026-10-31T14:00:00Z");
        const interrupted = yield* makeRouteCorpus(extended).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (from, to) => fs.rename(to === receiptPath ? path.join(root, "absent-source") : from, to),
          })
        );
        const options = captureOptions(root, { since: "2026-10-28", until: O.some("2026-10-29") });
        const failure = yield* Effect.flip(interrupted.capture(options));
        expect(failure.reason).toBe("corpus-pin");
        expect(yield* fs.readFileString(receiptPath)).toBe(receiptText);
        const prior = yield* corpus.load(receiptPath);
        expect(prior.receipt).toEqual(original);
        expect(A.map(prior.runs, (run) => run.runId)).toEqual([RERUN]);

        const resumed = yield* (yield* makeRouteCorpus(extended)).capture(options);
        expect([resumed.until, resumed.runs]).toEqual(["2026-10-29", 2]);
        expect((yield* corpus.load(receiptPath)).receipt).toEqual(resumed);
        const narrowed = yield* corpus.capture(captureOptions(root, { since: "2026-10-28" }));
        expect([narrowed.until, narrowed.runs]).toEqual(["2026-10-28", 1]);
      })
    );

    it.effect("drops older runs when workflow changes start a later date window", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const corpus = yield* makeRouteCorpus(
          yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
        );
        yield* corpus.capture(captureOptions(root));
        const receipt = yield* corpus.capture(
          RouteCorpusCaptureOptions.make({
            ...captureOptions(root),
            since: "2026-10-28",
            workflows: ["Check"],
          })
        );
        expect([receipt.since, receipt.runs]).toEqual(["2026-10-28", 1]);
        const loaded = yield* corpus.load(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE));
        expect(A.map(loaded.runs, (run) => run.runId)).toEqual([RERUN]);
      })
    );

    it.effect("keeps today and future days open and collects runs created later today", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runner = yield* fixtureRunner(calls);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-29T12:00:00Z").pipe(DateTime.toEpochMillis));
        const options = captureOptions(root, { since: "2026-10-29", until: O.some("2026-10-30") });
        const empty = yield* (yield* makeRouteCorpus(runner)).capture(options);
        expect([empty.until, empty.runs]).toEqual(["2026-10-28", 0]);

        const corpus = yield* makeRouteCorpus(extendedRunner(calls, runner, false, "2026-10-29T14:00:00Z"));
        const later = yield* corpus.capture(captureOptions(root, { since: "2026-10-29", until: O.none() }));
        expect([later.until, later.runs]).toEqual(["2026-10-28", 1]);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-30T00:00:00Z").pipe(DateTime.toEpochMillis));
        const finished = yield* corpus.capture(options);
        expect([finished.until, finished.runs]).toEqual(["2026-10-29", 2]);
      })
    );

    it.effect("refuses missing or changed pinned evidence before resuming or writing a receipt", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const corpus = yield* makeRouteCorpus(yield* fixtureRunner(calls));
        yield* corpus.capture(captureOptions(root));
        const receiptPath = path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE);
        const corpusPath = yield* pinnedCorpusPath(path.join(root, "corpus"));
        const receipt = yield* fs.readFileString(receiptPath);
        const bytes = yield* fs.readFile(corpusPath);
        const text = gunzip(bytes);
        yield* fs.writeFile(corpusPath, NodeZlib.gzipSync(new TextEncoder().encode(`${text}${text}`)));
        yield* Ref.set(calls, []);
        const changed = yield* Effect.flip(corpus.capture(captureOptions(root)));
        assertInclude(changed.message, "but its receipt pins");
        expect(changed.reason).toBe("corpus-pin");
        expect(yield* fs.readFileString(receiptPath)).toBe(receipt);
        expect(yield* Ref.get(calls)).toEqual([]);

        yield* fs.remove(corpusPath);
        const missing = yield* Effect.flip(corpus.capture(captureOptions(root)));
        expect(missing.reason).toBe("corpus-pin");
        assertInclude(missing.message, "Failed to read the corpus");
        expect(yield* fs.readFileString(receiptPath)).toBe(receipt);
        expect(yield* Ref.get(calls)).toEqual([]);
      })
    );

    it.effect("removes previously captured runs excluded by a new workflow selection", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const corpus = yield* makeRouteCorpus(
          yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
        );
        yield* corpus.capture(captureOptions(root));
        const filtered = yield* corpus.capture(
          RouteCorpusCaptureOptions.make({
            ...captureOptions(root),
            workflows: ["Check"],
          })
        );
        const loaded = yield* corpus.load(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE));
        expect(filtered.runs).toBe(3);
        expect(A.map(loaded.runs, (run) => run.runId)).toEqual([PR_RUN, MAIN_RUN, RERUN]);
        assertTrue(A.every(loaded.runs, (run) => run.workflow === "Check"));
      })
    );

    it.effect("captures the selected runs into a pinned gzip and receipt", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const corpus = yield* makeRouteCorpus(yield* fixtureRunner(calls));

        const receipt = yield* corpus.capture(captureOptions(root));

        const bytes = yield* fs.readFile(yield* pinnedCorpusPath(path.join(root, "corpus")));
        expect(receipt).toEqual(
          RouteCorpusReceipt.make({
            schemaVersion: "route-corpus/v1",
            capturedAt: "2026-10-31T00:00:00.000Z",
            since: "2026-10-27",
            // 2026-10-27 still has an unfinished run, so no day is fully captured yet.
            until: "2026-10-26",
            workflows: ["Check", "Heavy"],
            runs: 4,
            heads: 3,
            path: `corpus/hosted-runs.${receipt.sha256}.ndjson.gz`,
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
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
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

    it.effect("does not pin a run whose view shows a newer, unfinished attempt", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runGh = yield* fixtureRunner(calls);
        // A rerun starts between the list (attempt 1 finished) and the view.
        const racing: RouteGhRunner = (args, cwd) =>
          args[1] === "view" && args[2] === `${PR_RUN}`
            ? runGh(args, cwd).pipe(
                Effect.map(Str.replace(/^ {2}"status": "completed"/mu, '  "status": "in_progress"')),
                Effect.map(Str.replace(/^ {2}"attempt": 1/mu, '  "attempt": 2'))
              )
            : runGh(args, cwd);

        const raced = yield* (yield* makeRouteCorpus(racing)).capture(captureOptions(root));
        expect(raced.runs).toBe(3);

        // The day stayed open, so the next capture fetches that run again.
        yield* Ref.set(calls, []);
        const resumed = yield* (yield* makeRouteCorpus(runGh)).capture(captureOptions(root));
        expect(viewedRunIds(yield* Ref.get(calls))).toContain(`${PR_RUN}`);
        expect(resumed.runs).toBe(4);
      })
    );

    it.effect("fails closed when a date reaches the list cap", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
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
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const corpus = yield* makeRouteCorpus(
          yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
        );
        const receipt = yield* corpus.capture(captureOptions(root));
        const receiptPath = path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE);

        const loaded = yield* corpus.load(receiptPath);
        expect(loaded.receipt).toEqual(receipt);
        expect(A.map(loaded.runs, (run) => run.runId)).toEqual([PR_RUN, HEAVY_RUN, MAIN_RUN, RERUN]);

        const corpusPath = yield* pinnedCorpusPath(path.join(root, "corpus"));
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
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const corpus = yield* makeRouteCorpus(
          yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]))
        );
        yield* corpus.capture(captureOptions(root));
        const outDir = path.join(root, "corpus");
        const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
        const text = gunzip(yield* fs.readFile(yield* pinnedCorpusPath(outDir)));

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

    it.effect("defaults until to today, continues after the receipt and refuses a gap", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const corpus = yield* makeRouteCorpus(yield* fixtureRunner(calls));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-29T12:00:00Z").pipe(DateTime.toEpochMillis));

        // No runs on 2026-10-29: the corpus is empty but still pinned and loadable.
        const today = yield* corpus.capture(captureOptions(root, { since: "2026-10-29", until: O.none() }));
        expect([today.since, today.until, today.runs, today.heads]).toEqual(["2026-10-29", "2026-10-28", 0, 0]);
        expect((yield* corpus.load(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE))).runs).toEqual([]);

        // An earlier since starts the window again at that day.
        const backfill = yield* corpus.capture(
          captureOptions(root, { since: "2026-10-28", until: O.some("2026-10-28") })
        );
        expect([backfill.since, backfill.until, backfill.runs]).toEqual(["2026-10-28", "2026-10-28", 1]);

        // The same since continues from the day after the receipt's until.
        yield* Ref.set(calls, []);
        const continued = yield* corpus.capture(captureOptions(root, { since: "2026-10-28", until: O.none() }));
        expect([continued.since, continued.until, continued.runs]).toEqual(["2026-10-28", "2026-10-28", 1]);
        expect(listedDays(yield* Ref.get(calls))).toEqual(["2026-10-29"]);

        // The still-open current day is listed again without refetching pinned runs.
        yield* Ref.set(calls, []);
        const unchanged = yield* corpus.capture(captureOptions(root, { since: "2026-10-28", until: O.none() }));
        expect([unchanged.until, unchanged.sha256]).toEqual([continued.until, continued.sha256]);
        expect(listedDays(yield* Ref.get(calls))).toEqual(["2026-10-29"]);

        const gap = yield* Effect.flip(
          corpus.capture(captureOptions(root, { since: "2026-10-31", until: O.some("2026-11-01") }))
        );
        expect(gap.reason).toBe("corpus-fetch");
        assertInclude(gap.message, "since 2026-10-31 leaves a gap after the captured 2026-10-28..2026-10-28");

        // Another set of workflows starts the window again.
        const checkOnly = yield* corpus.capture(
          RouteCorpusCaptureOptions.make({
            repoRoot: root,
            since: "2026-10-28",
            until: O.some("2026-10-29"),
            workflows: ["Check"],
            outDir: "corpus",
          })
        );
        expect([checkOnly.since, checkOnly.until, checkOnly.workflows]).toEqual([
          "2026-10-28",
          "2026-10-28",
          ["Check"],
        ]);

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

    it.effect("pins every finished day, so a failure on day 3 keeps days 1-2 and a rerun lists only day 3", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runGh = yield* fixtureRunner(calls);
        const options = captureOptions(root, { since: "2026-10-28", until: O.some("2026-10-30") });
        const receiptPath = path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-30T12:00:00Z").pipe(DateTime.toEpochMillis));

        // The reset is two hours away, past the one-hour wait cap: fail at once.
        const failed = yield* Effect.flip(
          (yield* makeRouteCorpus(extendedRunner(calls, runGh, true, "2026-10-30T14:00:00Z"))).capture(options)
        );
        expect(failed.reason).toBe("corpus-fetch");
        assertInclude(
          failed.message,
          `gh run view ${DAY3_RUN} hit the GitHub API rate limit; it resets at 2026-10-30T14:00:00.000Z.`
        );

        const corpus = yield* makeRouteCorpus(extendedRunner(calls, runGh, false, "2026-10-30T14:00:00Z"));
        const pinned = yield* corpus.load(receiptPath);
        expect([pinned.receipt.since, pinned.receipt.until]).toEqual(["2026-10-28", "2026-10-29"]);
        expect(A.map(pinned.runs, (run) => run.runId)).toEqual([RERUN, DAY2_RUN]);

        yield* Ref.set(calls, []);
        const resumed = yield* corpus.capture(options);
        expect([resumed.until, resumed.runs]).toEqual(["2026-10-29", 3]);
        expect(listedDays(yield* Ref.get(calls))).toEqual(["2026-10-30"]);
        expect(listCalls(yield* Ref.get(calls))).toBe(2);
        expect(A.map((yield* corpus.load(receiptPath)).runs, (run) => run.runId)).toEqual([RERUN, DAY2_RUN, DAY3_RUN]);
      })
    );

    it.effect("waits once for a reported reset and fails readably when the reset is unknown or refused again", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runGh = yield* fixtureRunner(calls);
        const options = captureOptions(root, { since: "2026-10-28", until: O.some("2026-10-28") });
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-28T23:00:00Z").pipe(DateTime.toEpochMillis));
        const refusing =
          (rateLimit: string): RouteGhRunner =>
          (args, cwd) =>
            args[0] === "api"
              ? Ref.update(calls, A.append([cwd, ...args])).pipe(Effect.as(rateLimit))
              : args[2] === `${RERUN}`
                ? Ref.update(calls, A.append([cwd, ...args])).pipe(
                    Effect.andThen(Effect.fail(refused(`gh run view ${RERUN}`)))
                  )
                : runGh(args, cwd);

        const unknown = yield* Effect.flip((yield* makeRouteCorpus(refusing("not json"))).capture(options));
        assertInclude(unknown.message, "hit the GitHub API rate limit; gh did not report when it resets.");
        expect(yield* fs.exists(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE))).toBe(false);

        yield* Ref.set(calls, []);
        const waiting = yield* makeRouteCorpus(refusing(rateLimitPayload("2026-10-28T23:00:30Z")));
        const again = yield* waiting.capture(options).pipe(Effect.flip, untilDone);
        expect(again.reason).toBe("corpus-fetch");
        assertInclude(
          again.message,
          `gh run view ${RERUN} hit the GitHub API rate limit again after waiting for the reset; it resets at 2026-10-28T23:00:30.000Z.`
        );
        // One view, one reset lookup, one retry after the wait.
        expect(viewedRunIds(yield* Ref.get(calls))).toEqual([`${RERUN}`, `${RERUN}`]);
        expect(A.length(A.filter(yield* Ref.get(calls), (call) => call[1] === "api"))).toBe(1);
      })
    );

    it.effect("refuses a view payload for a different run", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" }));
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const runGh = yield* fixtureRunner(yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]));
        const crossed: RouteGhRunner = (args, cwd) =>
          args[2] === `${PR_RUN}` ? runGh(["run", "view", `${MAIN_RUN}`], cwd) : runGh(args, cwd);

        const error = yield* Effect.flip((yield* makeRouteCorpus(crossed)).capture(captureOptions(root)));

        expect(error.reason).toBe("corpus-fetch");
        assertInclude(error.message, `gh run view ${PR_RUN} answered for run ${MAIN_RUN}`);
      })
    );

    it.effect("the live corpus uses the gh login and refuses an unavailable login before HTTP", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-live-" });
        const options = RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since: "2026-10-28",
          until: O.some("2026-10-28"),
          workflows: ["check.yml"],
          outDir: "corpus",
        });
        const transport = completionFetch(() => ({ body: { total_count: 0, workflow_runs: [] } }));
        const capture = Effect.flatMap(RouteCorpus, (corpus) => corpus.capture(options));
        const auth = ScriptedSpawner.make((command) => ({
          stdout: command === "gh" ? "fixture-token" : "git@github.com:example/repo.git",
        }));
        const receipt = yield* capture.pipe(
          Effect.provideServiceEffect(
            RouteCorpus,
            RouteCorpusLive.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(RouteCorpus)))
          ),
          Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
          provideSpawner(auth)
        );
        expect(receipt.runs).toBe(0);
        expect(A.filter(auth.spawns, (spawn) => spawn.command === "gh")).toHaveLength(1);
        const before = transport.calls.length;
        const unavailable = ScriptedSpawner.make((command) =>
          command === "gh" ? { exit: 1 } : { stdout: "git@github.com:example/repo.git" }
        );
        const error = yield* Effect.flatMap(RouteCorpus, (corpus) =>
          corpus.capture(RouteCorpusCaptureOptions.make({ ...options, outDir: "refused" }))
        ).pipe(
          Effect.provideServiceEffect(
            RouteCorpus,
            RouteCorpusLive.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(RouteCorpus)))
          ),
          Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
          provideSpawner(unavailable),
          Effect.flip
        );
        expect(error.reason).toBe("corpus-fetch");
        expect(transport.calls.length).toBe(before);
        const malformed = completionFetch(() => ({ body: { total_count: 1, workflow_runs: [{}] } }));
        const invalid = yield* Effect.flatMap(RouteCorpus, (corpus) =>
          corpus.capture(RouteCorpusCaptureOptions.make({ ...options, outDir: "malformed" }))
        ).pipe(
          Effect.provideServiceEffect(
            RouteCorpus,
            RouteCorpusLive.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(RouteCorpus)))
          ),
          Effect.provideService(GithubTransportFetch, O.some(malformed.fetch)),
          provideSpawner(auth),
          Effect.flip,
          untilDone
        );
        expect(invalid.reason).toBe("corpus-fetch");
        expect(invalid.message).toContain("returned an unreadable payload.");
      })
    );
    it.effect("resolves a display name past workflow page one and paginates runs and jobs", () =>
      Effect.gen(function* () {
        const wire = {
          id: 7,
          name: "Check",
          event: "pull_request",
          status: "completed",
          conclusion: "success",
          created_at: "2026-10-28T00:00:00Z",
          head_branch: "feat/demo",
          head_sha: "abc",
          run_attempt: 2,
        };
        // One paginated route per suffix; the run view itself is the fallback.
        const pages: ReadonlyArray<readonly [suffix: string, page: (page2: boolean) => unknown]> = [
          [
            "/workflows",
            (page2) => ({
              total_count: 2,
              workflows: page2
                ? [{ id: 42, name: "Check", path: ".github/workflows/check.yml" }]
                : [{ id: 1, name: "Other", path: ".github/workflows/other.yml" }],
            }),
          ],
          [
            "/jobs",
            (page2) => ({
              total_count: 2,
              jobs: [{ name: page2 ? "Lint" : "Check", conclusion: "success", started_at: null, completed_at: null }],
            }),
          ],
          ["/runs", (page2) => ({ total_count: 2, workflow_runs: [{ ...wire, id: page2 ? 8 : 7 }] })],
        ];
        const transport = completionFetch((url) => {
          const page2 = url.searchParams.get("page") === "2";
          return O.match(
            A.findFirst(pages, ([suffix]) => Str.endsWith(suffix)(url.pathname)),
            {
              onNone: () => ({ body: wire }),
              onSome: ([, page]) => ({ body: page(page2), next: !page2 }),
            }
          );
        });
        const run = yield* restRunner(transport.fetch);
        const listed = yield* run(["run", "list", "--workflow", "Check", "--created", "2026-10-28"], ".");
        const rows = yield* decodeListedIds(listed);
        expect(A.map(rows, (row) => row.databaseId)).toEqual([7, 8]);
        const viewed = yield* run(["run", "view", "7"], ".");
        const view = yield* decodeViewedJobs(viewed);
        expect(A.map(view.jobs, (job) => job.name)).toEqual(["Check", "Lint"]);
        expect(A.some(transport.calls, (url) => Str.includes("/workflows/42/runs")(url.pathname))).toBe(true);
      })
    );
    it.effect("accepts workflow filenames and ids directly; refuses an unresolved display name", () =>
      Effect.gen(function* () {
        const transport = completionFetch((url) => ({
          body: Str.endsWith("/workflows")(url.pathname)
            ? { workflows: [], total_count: 0 }
            : { workflow_runs: [], total_count: 0 },
        }));
        const run = yield* restRunner(transport.fetch);
        for (const workflow of ["42", "check.yml"])
          expect(yield* run(["run", "list", "--workflow", workflow, "--created", "2026-10-28"], ".")).toBe("[]");
        const missing = yield* untilDone(
          run(["run", "list", "--workflow", "Missing", "--created", "2026-10-28"], ".").pipe(Effect.flip)
        );
        expect(missing._tag).toBe("RouteError");
        expect(A.filter(transport.calls, (url) => Str.endsWith("/workflows")(url.pathname)).length).toBe(3);
      })
    );
    it.effect("normalizes nullable run fields and omitted attempts for lists and views", () =>
      Effect.gen(function* () {
        const wire = {
          id: 7,
          name: null,
          event: "push",
          status: null,
          conclusion: null,
          created_at: "2026-10-28T00:00:00Z",
          head_branch: null,
          head_sha: "abc",
        };
        const transport = completionFetch((url) => ({
          body: Str.endsWith("/jobs")(url.pathname)
            ? { total_count: 0, jobs: [] }
            : Str.endsWith("/runs")(url.pathname)
              ? { total_count: 1, workflow_runs: [wire] }
              : wire,
        }));
        const run = yield* restRunner(transport.fetch);
        for (const args of [
          ["run", "list", "--workflow", "check.yml"],
          ["run", "view", "7"],
        ]) {
          const result = yield* run(args, ".");
          expect(result).toContain('"workflowName":""');
          expect(result).toContain('"status":""');
          expect(result).toContain('"headBranch":""');
          expect(result).toContain('"attempt":1');
        }
        const malformed = completionFetch(() => ({ body: { total_count: 1, workflow_runs: [{}] } }));
        const refused = yield* restRunner(malformed.fetch);
        const error = yield* untilDone(refused(["run", "list", "--workflow", "check.yml"], ".").pipe(Effect.flip));
        expect(error.message).toContain("returned an unreadable payload.");
        const missing = yield* untilDone(run(["run", "list"], ".").pipe(Effect.flip));
        expect(missing._tag).toBe("RouteError");
      })
    );

    it.effect("maps REST rate limits, reads the core reset, and retries refused or malformed reads twice", () =>
      Effect.gen(function* () {
        const limited = completionFetch((url) =>
          Str.endsWith("/rate_limit")(url.pathname)
            ? {
                body: {
                  resources: {
                    core: { limit: 5000, remaining: 0, reset: 123 },
                    graphql: { limit: 5000, remaining: 10, reset: 123 },
                  },
                },
              }
            : { status: 429, body: { message: "API rate limit exceeded" } }
        );
        const run = yield* restRunner(limited.fetch);
        const error = yield* run(["run", "view", "7"], ".").pipe(Effect.flip);
        expect(error._tag).toBe("RouteGhRateLimited");
        expect(limited.calls.length).toBe(1);
        expect(yield* run(["api", "rate_limit"], ".")).toContain('"reset":123');
        for (const response of [{ status: 403, body: { message: "Forbidden" } }, { body: { malformed: true } }]) {
          const transport = completionFetch(() => response);
          const refused = yield* restRunner(transport.fetch);
          const failed = yield* untilDone(refused(["run", "view", "7"], ".").pipe(Effect.flip));
          expect(failed._tag).toBe("RouteError");
          expect(transport.calls.length).toBe(3);
        }
      })
    );
  }
);
