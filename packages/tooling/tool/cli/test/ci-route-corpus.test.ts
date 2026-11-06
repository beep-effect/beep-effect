import * as NodeZlib from "node:zlib";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
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
  RouteGhRateLimited,
} from "@beep/repo-cli/commands/Ci/RouteCorpus";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertInclude, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
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
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { RouteGhRunner } from "@beep/repo-cli/commands/Ci/RouteCorpus";

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

const fixtureText = Effect.fn("RouteCorpusTest.fixtureText")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fromFileUrl1 = yield* path.fromFileUrl(FIXTURES);
  return yield* fs.readFileString(path.join(fromFileUrl1, name));
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
  const digest2 = yield* digest.digest(Digest.sha256, bytes);
  return Hex.encode(digest2);
});

const gunzip = (bytes: Uint8Array): string => new TextDecoder().decode(NodeZlib.gunzipSync(bytes));

const ndjsonRuns = (bytes: Uint8Array) =>
  Effect.forEach(A.filter(Str.split(gunzip(bytes), "\n"), Str.isNonEmpty), (line) => decodeRun(line));

const pinnedCorpusPath = Effect.fn("RouteCorpusTest.pinnedCorpusPath")(function* (outDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const readFileString3 = yield* fs.readFileString(path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE));
  const receipt = yield* decodeReceipt(readFileString3);
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
  const pinnedCorpusPath4 = yield* pinnedCorpusPath(outDir);
  yield* fs.writeFile(pinnedCorpusPath4, bytes);
  const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
  const readFileString5 = yield* fs.readFileString(receiptPath);
  const receipt = yield* decodeReceipt(readFileString5);
  const repinned = RouteCorpusReceipt.make({ ...receipt, runs: runs(receipt), sha256: yield* sha256Hex(bytes) });
  const encodedReceipt = yield* encodeReceipt(repinned);
  yield* fs.writeFileString(receiptPath, encodedReceipt);
});

const captureLive = (spawner: ScriptedSpawner, options: RouteCorpusCaptureOptions) =>
  Effect.gen(function* () {
    const corpus = yield* RouteCorpus;
    return yield* corpus.capture(options);
  }).pipe(provideScopedLayer(RouteCorpusLive), provideSpawner(spawner));

// Retries and rate-limit waits sleep on the test clock. The capture does real
// I/O between its sleeps, so keep advancing the clock until it has finished.
const untilDone = Effect.fn("RouteCorpusTest.untilDone")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const fiber = yield* Effect.forkChild(effect);
  yield* TestClock.adjust("1 second").pipe(Effect.repeat({ until: () => fiber.pollUnsafe() !== undefined }));
  return yield* Fiber.join(fiber);
});

const failLive = (spawner: ScriptedSpawner, options: RouteCorpusCaptureOptions) =>
  captureLive(spawner, options).pipe(Effect.flip, untilDone);

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
    const value6 = yield* S.encodeEffect(runCodec)(decodedRun);
    expect(value6).toBe(line);

    const receiptCodec = S.fromJsonString(RouteCorpusReceipt);
    const text = yield* S.encodeEffect(receiptCodec)(receipt);
    const decodedReceipt = yield* S.decodeEffect(receiptCodec)(text);
    assertTrue(sameReceipt(decodedReceipt, receipt));
    const value7 = yield* S.encodeEffect(receiptCodec)(decodedReceipt);
    expect(value7).toBe(text);
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
        const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const made56 = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner8 = yield* fixtureRunner(made56);
        const corpus = yield* makeRouteCorpus(fixtureRunner8);
        const receipt = yield* corpus.capture(captureOptions(root));
        const outDir = path.join(root, "corpus");
        const pinned = yield* pinnedCorpusPath(outDir);
        const legacyPath = path.join(outDir, ROUTE_CORPUS_FILE);
        yield* fs.copyFile(pinned, legacyPath);
        yield* fs.remove(pinned);
        const legacy = RouteCorpusReceipt.make({ ...receipt, path: `corpus/${ROUTE_CORPUS_FILE}` });
        const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
        const encodedReceipt9 = yield* encodeReceipt(legacy);
        yield* fs.writeFileString(receiptPath, encodedReceipt9);
        expect((yield* corpus.load(receiptPath)).runs).toHaveLength(4);

        const resumed = yield* corpus.capture(captureOptions(root));
        expect(resumed.path).toBe(`corpus/hosted-runs.${resumed.sha256}.ndjson.gz`);
        expect((yield* corpus.load(receiptPath)).runs).toHaveLength(4);
        const exists10 = yield* fs.exists(legacyPath);
        expect(exists10).toBe(true);
      })
    );

    it.effect("keeps the prior checkpoint loadable when switching the receipt fails", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped11 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped11);
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
        const readFileString12 = yield* fs.readFileString(receiptPath);
        expect(readFileString12).toBe(receiptText);
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
        const madeTempDirectoryScoped13 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped13);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const made57 = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner14 = yield* fixtureRunner(made57);
        const corpus = yield* makeRouteCorpus(fixtureRunner14);
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
        const madeTempDirectoryScoped15 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped15);
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
        const madeTempDirectoryScoped16 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped16);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner17 = yield* fixtureRunner(calls);
        const corpus = yield* makeRouteCorpus(fixtureRunner17);
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
        const readFileString18 = yield* fs.readFileString(receiptPath);
        expect(readFileString18).toBe(receipt);
        const got = yield* Ref.get(calls);
        expect(got).toEqual([]);

        yield* fs.remove(corpusPath);
        const missing = yield* Effect.flip(corpus.capture(captureOptions(root)));
        expect(missing.reason).toBe("corpus-pin");
        assertInclude(missing.message, "Failed to read the corpus");
        const readFileString19 = yield* fs.readFileString(receiptPath);
        expect(readFileString19).toBe(receipt);
        const got20 = yield* Ref.get(calls);
        expect(got20).toEqual([]);
      })
    );

    it.effect("removes previously captured runs excluded by a new workflow selection", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped21 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped21);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const made58 = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner22 = yield* fixtureRunner(made58);
        const corpus = yield* makeRouteCorpus(fixtureRunner22);
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
        const madeTempDirectoryScoped23 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped23);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner24 = yield* fixtureRunner(calls);
        const corpus = yield* makeRouteCorpus(fixtureRunner24);

        const receipt = yield* corpus.capture(captureOptions(root));

        const pinnedCorpusPath25 = yield* pinnedCorpusPath(path.join(root, "corpus"));
        const bytes = yield* fs.readFile(pinnedCorpusPath25);
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
        const readFileString59 = yield* fs.readFileString(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE));
        const decodedReceipt26 = yield* decodeReceipt(readFileString59);
        expect(decodedReceipt26).toEqual(receipt);

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
        const madeTempDirectoryScoped27 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped27);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runGh = yield* fixtureRunner(calls);
        const corpus = yield* makeRouteCorpus(runGh);

        const first = yield* corpus.capture(captureOptions(root));
        yield* Ref.set(calls, []);
        const second = yield* corpus.capture(captureOptions(root));

        const got28 = yield* Ref.get(calls);
        expect(viewedRunIds(got28)).toEqual([]);
        const got29 = yield* Ref.get(calls);
        expect(listCalls(got29)).toBe(4);
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
        const got30 = yield* Ref.get(calls);
        expect(viewedRunIds(got30)).toEqual([`${PR_RUN}`]);
        expect(third.runs).toBe(4);
      })
    );

    it.effect("does not pin a run whose view shows a newer, unfinished attempt", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped31 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped31);
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
        const got32 = yield* Ref.get(calls);
        expect(viewedRunIds(got32)).toContain(`${PR_RUN}`);
        expect(resumed.runs).toBe(4);
      })
    );

    it.effect("fails closed when a date reaches the list cap", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped33 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped33);
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
        const got34 = yield* Ref.get(calls);
        expect(viewedRunIds(got34)).toEqual([]);
        const exists35 = yield* fs.exists(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE));
        expect(exists35).toBe(false);
      })
    );

    it.effect("loads a pinned corpus and refuses one whose bytes changed", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped36 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped36);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const made60 = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner37 = yield* fixtureRunner(made60);
        const corpus = yield* makeRouteCorpus(fixtureRunner37);
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
        const madeTempDirectoryScoped38 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped38);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const made61 = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner39 = yield* fixtureRunner(made61);
        const corpus = yield* makeRouteCorpus(fixtureRunner39);
        yield* corpus.capture(captureOptions(root));
        const outDir = path.join(root, "corpus");
        const receiptPath = path.join(outDir, ROUTE_CORPUS_RECEIPT_FILE);
        const pinnedCorpusPath62 = yield* pinnedCorpusPath(outDir);
        const readFile40 = yield* fs.readFile(pinnedCorpusPath62);
        const text = gunzip(readFile40);

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
        const madeTempDirectoryScoped41 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped41);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const calls = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const fixtureRunner42 = yield* fixtureRunner(calls);
        const corpus = yield* makeRouteCorpus(fixtureRunner42);
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
        const got43 = yield* Ref.get(calls);
        expect(listedDays(got43)).toEqual(["2026-10-29"]);

        // The still-open current day is listed again without refetching pinned runs.
        yield* Ref.set(calls, []);
        const unchanged = yield* corpus.capture(captureOptions(root, { since: "2026-10-28", until: O.none() }));
        expect([unchanged.until, unchanged.sha256]).toEqual([continued.until, continued.sha256]);
        const got44 = yield* Ref.get(calls);
        expect(listedDays(got44)).toEqual(["2026-10-29"]);

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
        const madeTempDirectoryScoped45 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped45);
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
        const got46 = yield* Ref.get(calls);
        expect(listedDays(got46)).toEqual(["2026-10-30"]);
        const got47 = yield* Ref.get(calls);
        expect(listCalls(got47)).toBe(2);
        expect(A.map((yield* corpus.load(receiptPath)).runs, (run) => run.runId)).toEqual([RERUN, DAY2_RUN, DAY3_RUN]);
      })
    );

    it.effect("waits once for a reported reset and fails readably when the reset is unknown or refused again", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped48 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped48);
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
        const exists49 = yield* fs.exists(path.join(root, "corpus", ROUTE_CORPUS_RECEIPT_FILE));
        expect(exists49).toBe(false);

        yield* Ref.set(calls, []);
        const waiting = yield* makeRouteCorpus(refusing(rateLimitPayload("2026-10-28T23:00:30Z")));
        const again = yield* waiting.capture(options).pipe(Effect.flip, untilDone);
        expect(again.reason).toBe("corpus-fetch");
        assertInclude(
          again.message,
          `gh run view ${RERUN} hit the GitHub API rate limit again after waiting for the reset; it resets at 2026-10-28T23:00:30.000Z.`
        );
        // One view, one reset lookup, one retry after the wait.
        const got50 = yield* Ref.get(calls);
        expect(viewedRunIds(got50)).toEqual([`${RERUN}`, `${RERUN}`]);
        const got51 = yield* Ref.get(calls);
        expect(A.length(A.filter(got51, (call) => call[1] === "api"))).toBe(1);
      })
    );

    it.effect("refuses a view payload for a different run", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped52 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped52);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const made = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const runGh = yield* fixtureRunner(made);
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
        const madeTempDirectoryScoped53 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped53);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const list = yield* fixtureText("list.Check.2026-10-28.json");
        const view = yield* fixtureText(`view.${RERUN}.json`);
        const options = RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since: "2026-10-28",
          until: O.some("2026-10-28"),
          workflows: ["Check"],
          outDir: "corpus",
        });

        // A scripted `gh`: answers the list and the view, and records every spawn with its cwd.
        const spawner = ScriptedSpawner.make((_command, args) => ({ stdout: args[1] === "list" ? list : view }));
        const receipt = yield* captureLive(spawner, options);

        expect([receipt.runs, receipt.heads]).toEqual([1, 1]);
        expect(A.map(spawner.spawns, (spawn) => [spawn.cwd, spawn.command, ...spawn.args])).toEqual([
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

    it.effect("waits for the rate-limit reset gh reports, then finishes the capture", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped54 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped54);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const list = yield* fixtureText("list.Check.2026-10-28.json");
        const view = yield* fixtureText(`view.${RERUN}.json`);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-28T23:00:00Z").pipe(DateTime.toEpochMillis));
        const options = RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since: "2026-10-28",
          until: O.some("2026-10-28"),
          workflows: ["Check"],
          outDir: "corpus",
        });

        // The first view is refused; the spawn is recorded before the script answers, so it counts itself.
        const spawner: ScriptedSpawner = ScriptedSpawner.make((_command, args) =>
          args[0] === "api"
            ? { stdout: rateLimitPayload("2026-10-28T23:00:30Z") }
            : args[1] === "list"
              ? { stdout: list }
              : A.length(A.filter(spawner.spawns, (spawn) => spawn.args[1] === "view")) === 1
                ? { exit: 1, stdout: "HTTP 403: API rate limit exceeded for user ID 1." }
                : { stdout: view }
        );
        const receipt = yield* untilDone(captureLive(spawner, options));

        expect([receipt.until, receipt.runs]).toEqual(["2026-10-27", 1]);
        // The refused view is not retried by the runner; the corpus waits, then retries it once.
        expect(A.map(spawner.spawns, (spawn) => A.join(A.take([spawn.command, ...spawn.args], 3), " "))).toEqual([
          "gh run list",
          "gh run view",
          "gh api rate_limit",
          "gh run view",
        ]);
      })
    );

    it.effect("retries a failing gh twice, then fails with the failure in the message", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const madeTempDirectoryScoped55 = yield* fs.makeTempDirectoryScoped({ prefix: "beep-route-corpus-" });
        const root = yield* fs.realPath(madeTempDirectoryScoped55);
        yield* TestClock.setTime(DateTime.makeUnsafe("2026-10-31T00:00:00Z").pipe(DateTime.toEpochMillis));
        const options = RouteCorpusCaptureOptions.make({
          repoRoot: root,
          since: "2026-10-28",
          until: O.some("2026-10-28"),
          workflows: ["Check"],
          outDir: "corpus",
        });

        const exits = ScriptedSpawner.make(() => ({ exit: 1, stdout: "HTTP 502: Bad Gateway" }));
        const exited = yield* failLive(exits, options);
        expect(exited.reason).toBe("corpus-fetch");
        assertInclude(exited.message, "exited 1: HTTP 502: Bad Gateway");
        expect(A.length(exits.spawns)).toBe(3);

        const truncated = yield* failLive(
          ScriptedSpawner.make(() => ({ stdout: Str.repeat(512 * 1024 + 1)("x") })),
          options
        );
        assertInclude(truncated.message, "overflowed the capture bound");

        const missing = yield* failLive(
          ScriptedSpawner.make(() =>
            PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" })
          ),
          options
        );
        assertInclude(missing.message, "Failed to spawn gh run list");
      })
    );
  }
);
