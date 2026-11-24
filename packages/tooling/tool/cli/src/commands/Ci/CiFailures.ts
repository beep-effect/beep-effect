/**
 * `beep ci failures --run <id> | --pr <n>`: each failed job's verdict and
 * failures, one command away (decision `agent-surface`).
 *
 * **Details**
 *
 * The run's jobs are read as a gate report by the CI-job adapter. A failed job
 * whose task-outcome artifact carries readable gate reports prints those
 * reports' agent consoles, and no log is fetched. Any other failed job's log
 * is read through the merge loop's log route (`readYeetFailedJobLog`): its
 * failing region prints within core's agent budget, verdict first and last,
 * and the log is saved under `.beep/gates/run/` with the run's record, named
 * by path and size and labelled with what it holds: the failing steps
 * `--log-failed` returned, or the whole job log. A log whose failing step
 * cannot be bounded prints one line with the saved path. Every GitHub request
 * is REST through `GitHubClient`, so the budget ledger records it; none is
 * GraphQL.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { RecordPaths } from "@beep/gate-report/ConsoleDocument";
import { GateRecord } from "@beep/gate-report/GateRecord";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { RecordTarget, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { agentBudget, ConsoleRequest, ConsoleSettings, makeGateConsole } from "@beep/repo-gate-run/GateConsole";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { constant, dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { GithubClientRequest, layerGithubClientFor, layerGithubRepoFor } from "../../internal/github/index.ts";
import { YEET_GH_LOGIN_IDENTITY } from "../Yeet/internal/GhOps.ts";
import { readYeetFailedJobLog, YeetJobLogRead } from "../Yeet/internal/MonitorLoop.ts";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { downloadFeedArtifact, FeedArtifact, FeedArtifactRef } from "./CiFeedArtifact.ts";
import {
  CI_RUN_GATE,
  CiRunGateInput,
  CiRunJob,
  CiRunView,
  CiWorkflowRun,
  CiWorkflowRunsPage,
  ciJobIsRed,
  ciRunGateReport,
} from "./CiJobAdapter.ts";
import { taskOutcomeArtifactPrefix } from "./CiTaskOutcomes.ts";
import type { CliReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Ci/CiFailures");

/**
 * The most task-outcome artifacts one run's failed jobs download to find
 * their gate reports.
 *
 * **Example** (Cap the downloads)
 *
 * ```ts
 * import { FAILED_JOB_ARTIFACT_DOWNLOADS_MAX } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FAILED_JOB_ARTIFACT_DOWNLOADS_MAX) // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FAILED_JOB_ARTIFACT_DOWNLOADS_MAX = 8;

/**
 * **Example** (Target a run)
 *
 * ```ts
 * import { CiFailuresTarget } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiFailuresTarget.cases.RunTarget.make({ runId: 9 })._tag) // "RunTarget"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiFailuresTarget = S.TaggedUnion({
  RunTarget: { runId: S.Int },
  PullTarget: { number: S.Int },
}).pipe(
  $I.annoteSchema("CiFailuresTarget", {
    description: "One workflow run, or a pull request whose head's newest runs are read.",
  })
);

/**
 * Type of {@link CiFailuresTarget}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiFailuresTarget = typeof CiFailuresTarget.Type;

const PullHead = S.Struct({ head: S.Struct({ sha: S.String }) });
const decodeRunJobs = S.decodeUnknownEffect(S.Array(CiRunJob));
const decodeRunArtifacts = S.decodeUnknownEffect(S.Array(FeedArtifactRef));

type Github = GitHubClient | Repo;

const FAILED_RUN_CONCLUSIONS = ["failure", "timed_out"];

const newestFirst = Order.flip(Order.mapInput(Order.String, (run: CiWorkflowRun) => run.created_at));

const headRunsWorthReading = (runs: ReadonlyArray<CiWorkflowRun>): ReadonlyArray<CiWorkflowRun> =>
  pipe(
    A.sort(runs, newestFirst),
    A.dedupeWith((left, right) => left.workflow_id === right.workflow_id),
    A.filter(
      (run) =>
        O.exists(run.conclusion, (conclusion) => A.contains(FAILED_RUN_CONCLUSIONS, conclusion)) ||
        run.status !== "completed"
    )
  );

const targetRuns = Effect.fn("CiFailures.targetRuns")(function* (target: CiFailuresTarget) {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  return yield* CiFailuresTarget.match(target, {
    RunTarget: ({ runId }) =>
      client
        .requestDecoded(
          "GET /repos/{owner}/{repo}/actions/runs/{run_id}",
          { owner, repo, run_id: runId },
          CiWorkflowRun
        )
        .pipe(Effect.map(flow(CiWorkflowRun.make, A.of))),
    PullTarget: ({ number }) =>
      client
        .requestDecoded("GET /repos/{owner}/{repo}/pulls/{pull_number}", { owner, repo, pull_number: number }, PullHead)
        .pipe(
          Effect.flatMap((pull) =>
            client.requestDecoded(
              "GET /repos/{owner}/{repo}/actions/runs",
              { owner, repo, head_sha: pull.head.sha, per_page: 100 },
              CiWorkflowRunsPage
            )
          ),
          Effect.map((page) => headRunsWorthReading(A.map(page.workflow_runs, (run) => CiWorkflowRun.make(run))))
        ),
  }).pipe(CiCommandError.mapError("Failed to read the target's workflow runs."));
});

const runView = (run: CiWorkflowRun): CiRunView =>
  CiRunView.make({
    id: run.id,
    attempt: run.run_attempt ?? 1,
    workflow: run.name ?? `workflow ${run.workflow_id}`,
    headSha: run.head_sha,
    branch: O.flatMap(O.fromNullishOr(run.head_branch), O.liftPredicate(Str.isNonEmpty)),
    createdAt: run.created_at,
  });

const runJobs = Effect.fn("CiFailures.runJobs")(function* (runId: number) {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  return yield* client
    .paginate("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", { owner, repo, run_id: runId })
    .pipe(Effect.flatMap(decodeRunJobs), CiCommandError.mapError(`Failed to read run ${runId}'s jobs.`));
});

const runArtifacts = Effect.fn("CiFailures.runArtifacts")(function* (runId: number) {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  return yield* client
    .paginate("GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", { owner, repo, run_id: runId })
    .pipe(Effect.flatMap(decodeRunArtifacts), CiCommandError.mapError(`Failed to list run ${runId}'s artifacts.`));
});

const tokens = (text: string): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.filter(Str.split(Str.toLowerCase(text), /[^a-z0-9]+/u), Str.isNonEmpty));

const overlap = (left: HashSet.HashSet<string>, right: HashSet.HashSet<string>): number =>
  HashSet.size(HashSet.intersection(left, right));

const recordJoins = (feed: FeedArtifact, job: CiRunJob): boolean =>
  feed.record.job === job.name || Str.startsWith(`${feed.record.job} / `)(job.name);

/**
 * **Example** (Nothing to rank)
 *
 * ```ts
 * import { FeedArtifactRanking } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(FeedArtifactRanking.make({ prefix: "task-outcomes-9-1-", artifacts: [], jobs: [] }).prefix)
 * // "task-outcomes-9-1-"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FeedArtifactRanking extends S.Opaque<FeedArtifactRanking, { readonly brand: unique symbol }>()(
  S.Struct({ prefix: S.String, artifacts: S.Array(FeedArtifactRef), jobs: S.Array(CiRunJob) }).pipe(
    $I.annoteSchema("FeedArtifactRanking", {
      description: "A run attempt's artifact prefix, its artifacts and its failed jobs, to rank for download.",
    })
  )
) {}

/**
 * Rank a run's task-outcome artifacts for its failed jobs: those sharing a
 * word with a failed job's name, most shared first, at most
 * {@link FAILED_JOB_ARTIFACT_DOWNLOADS_MAX}.
 *
 * **Details**
 *
 * An artifact's `<job>-<partition>` key is the workflow's job id, not the
 * name GitHub lists, so the key only orders the downloads: a job is joined to
 * an artifact by the job its record names.
 *
 * **Example** (Rank one artifact)
 *
 * ```ts
 * import { CiRunJob, FeedArtifactRanking, FeedArtifactRef, rankFeedArtifacts } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = CiRunJob.make({ id: 7, name: "Test Unit (unit-a)", status: "completed", conclusion: O.some("failure"), steps: O.none() })
 * const artifact = FeedArtifactRef.make({ id: 1, name: "task-outcomes-9-1-test-unit-shard-unit-a", expired: false, size_in_bytes: 9 })
 * console.log(rankFeedArtifacts(FeedArtifactRanking.make({ prefix: "task-outcomes-9-1-", artifacts: [artifact], jobs: [job] })).length) // 1
 * ```
 *
 * @param input - The run attempt's artifact prefix, its artifacts and its failed jobs.
 * @returns The artifacts to download, in order.
 * @category utilities
 * @since 0.0.0
 */
export const rankFeedArtifacts = ({ prefix, artifacts, jobs }: FeedArtifactRanking): ReadonlyArray<FeedArtifactRef> => {
  const jobTokens = A.map(jobs, (job) => tokens(job.name));
  const scored = A.map(
    A.filter(artifacts, (artifact) => Str.startsWith(prefix)(artifact.name) && !artifact.expired),
    (artifact) => {
      const key = tokens(Str.slice(prefix.length)(artifact.name));
      return { artifact, score: A.reduce(jobTokens, 0, (best, words) => Math.max(best, overlap(key, words))) };
    }
  );
  return pipe(
    A.filter(scored, ({ score }) => score > 0),
    A.sort(Order.flip(Order.mapInput(Order.Number, ({ score }: { readonly score: number }) => score))),
    A.map(({ artifact }) => artifact),
    A.take(FAILED_JOB_ARTIFACT_DOWNLOADS_MAX)
  );
};

const feedsForJobs = Effect.fn("CiFailures.feedsForJobs")(function* (run: CiRunView, jobs: ReadonlyArray<CiRunJob>) {
  const artifacts = yield* runArtifacts(run.id).pipe(Effect.orElseSucceed(A.empty<FeedArtifactRef>));
  const ranked = rankFeedArtifacts(
    FeedArtifactRanking.make({ prefix: taskOutcomeArtifactPrefix(run.id, run.attempt), artifacts, jobs })
  );
  return yield* Effect.reduce(ranked, A.empty<FeedArtifact>, (feeds, artifact) =>
    A.every(jobs, (job) => A.some(feeds, (feed) => recordJoins(feed, job)))
      ? Effect.succeed(feeds)
      : downloadFeedArtifact(artifact, () => true).pipe(
          Effect.map((feed) => A.append(feeds, feed)),
          Effect.orElseSucceed(() => feeds)
        )
  );
});

/**
 * How one failed job was read: through its uploaded gate reports, or through
 * its log.
 *
 * **Details**
 *
 * A job whose artifact indexes a report that could not be read is read
 * through its log, with that artifact kept as `partial` so its readable
 * reports and the unreadable paths are still shown.
 *
 * **Example** (A job read through its log)
 *
 * ```ts
 * import { CiJobReading, CiRunJob } from "@beep/repo-cli/commands/Ci"
 * import { YeetJobLogRead } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const job = CiRunJob.make({ id: 7, name: "Lint", status: "completed", conclusion: O.some("failure"), steps: O.none() })
 * const reading = CiJobReading.cases.Logged.make({ job, log: YeetJobLogRead.cases.Unreadable.make({}), partial: O.none() })
 * console.log(reading._tag) // "Logged"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiJobReading = S.TaggedUnion({
  Reported: { job: CiRunJob, feed: FeedArtifact },
  Logged: { job: CiRunJob, log: YeetJobLogRead, partial: S.OptionFromOptionalKey(FeedArtifact) },
}).pipe(
  $I.annoteSchema("CiJobReading", {
    description: "A failed job read through its uploaded gate reports, or through its log.",
  })
);

/**
 * Type of {@link CiJobReading}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiJobReading = typeof CiJobReading.Type;

type JobReading = CiJobReading;

const joinedFeed = (feeds: ReadonlyArray<FeedArtifact>, job: CiRunJob): O.Option<FeedArtifact> =>
  A.findFirst(feeds, (feed) => recordJoins(feed, job));

const completelyReported = (feed: FeedArtifact): boolean =>
  A.isReadonlyArrayNonEmpty(feed.reports) && A.isReadonlyArrayEmpty(feed.unreadable);

const partlyReported = (feed: FeedArtifact): boolean => A.isReadonlyArrayNonEmpty(feed.unreadable);

const agentConsole = makeGateConsole(ConsoleSettings.make({ audience: "agent" }));

const consoleLines = (request: ConsoleRequest): A.NonEmptyReadonlyArray<string> =>
  Str.split(agentConsole.render(request).text, "\n");

const rawLogOf: (log: YeetJobLogRead) => O.Option<string> = YeetJobLogRead.match({
  LogFailed: ({ raw }) => O.some(raw),
  EndpointRegion: ({ raw }) => O.some(raw),
  EndpointUnbounded: ({ raw }) => O.some(raw),
  Unreadable: () => O.none(),
});

const regionOf: (log: YeetJobLogRead) => O.Option<string> = YeetJobLogRead.match({
  LogFailed: ({ output }) => O.some(output),
  EndpointRegion: ({ region }) => O.some(region),
  EndpointUnbounded: () => O.none(),
  Unreadable: () => O.none(),
});

const verdictLines = (feed: FeedArtifact): ReadonlyArray<string> =>
  A.map(feed.reports, (found) => A.headNonEmpty(consoleLines(ConsoleRequest.make({ report: found.record.report }))));

const reportVerdicts = (feed: FeedArtifact): string => A.join(verdictLines(feed), "\n");

const detailOf: (reading: JobReading) => O.Option<string> = CiJobReading.match({
  Reported: ({ feed }) => O.some(reportVerdicts(feed)),
  Logged: ({ log }) => regionOf(log),
});

const cutLine = (line: string): string =>
  line.length <= agentBudget.maxLineChars ? line : `${Str.takeLeft(line, agentBudget.maxLineChars - 3)}...`;

/**
 * Keep the tail of a failing region within core's agent budget, every line cut
 * to its line limit, around a frame of `frameChars` characters.
 *
 * **Details**
 *
 * The tail is kept because a failing step's cause sits next to its exit; the
 * lines left out are counted on one leading line that names the saved log.
 * When even that line does not fit beside the frame, no line is returned, so
 * the frame and region together never pass `agentBudget.maxChars`.
 *
 * **Example** (A region that fits)
 *
 * ```ts
 * import { boundFailingRegion } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(boundFailingRegion("boom", 100)) // ["boom"]
 * console.log(boundFailingRegion(100)("boom")) // ["boom"]
 * ```
 *
 * @param region - The failing lines isolated from a job log, oldest first.
 * @param frameChars - Characters the surrounding lines take.
 * @returns The region's lines that fit.
 * @category utilities
 * @since 0.0.0
 */
export const boundFailingRegion: {
  (frameChars: number): (region: string) => ReadonlyArray<string>;
  (region: string, frameChars: number): ReadonlyArray<string>;
} = dual(2, (region: string, frameChars: number): ReadonlyArray<string> => {
  const lines = A.map(Str.split(region, "\n"), cutLine);
  const room = agentBudget.maxChars - frameChars;
  const all = tailWithin(lines, room);
  if (all.length === lines.length) {
    return all;
  }
  const kept = tailWithin(lines, room - omissionLine(lines.length).length - 1);
  const omission = omissionLine(lines.length - kept.length);
  return omission.length + 1 <= room ? A.prepend(kept, omission) : A.empty<string>();
});

const omissionLine = (dropped: number): string => `... ${dropped} earlier lines in the saved log`;

const tailWithin = (lines: ReadonlyArray<string>, room: number): ReadonlyArray<string> =>
  A.reduceRight(lines, { lines: A.empty<string>(), chars: 0, full: false }, (state, line) =>
    state.full || state.chars + line.length + 1 > room
      ? { ...state, full: true }
      : { lines: A.prepend(state.lines, line), chars: state.chars + line.length + 1, full: false }
  ).lines;

const savedLogLabel: (log: YeetJobLogRead) => string = YeetJobLogRead.match({
  LogFailed: ({ truncated }) =>
    truncated
      ? "failing steps only (gh run view --log-failed), truncated"
      : "failing steps only (gh run view --log-failed)",
  EndpointRegion: () => "whole job log",
  EndpointUnbounded: () => "whole job log",
  Unreadable: () => "no log",
});

const savedLogText = (readings: ReadonlyArray<JobReading>): O.Option<string> => {
  const sections = A.getSomes(
    A.map(readings, (reading) =>
      reading._tag === "Logged"
        ? O.map(
            rawLogOf(reading.log),
            (raw) => `==> job ${reading.job.name} (${reading.job.id}): ${savedLogLabel(reading.log)}\n${raw}\n`
          )
        : O.none<string>()
    )
  );
  return A.isReadonlyArrayEmpty(sections) ? O.none() : O.some(A.join(sections, ""));
};

type Saved = { readonly record: string; readonly log: O.Option<{ readonly path: string; readonly bytes: number }> };

const jobVerdict = (run: CiRunView, job: CiRunJob, region: string, saved: Saved): string =>
  A.headNonEmpty(
    consoleLines(
      ConsoleRequest.make({
        report: ciRunGateReport(CiRunGateInput.make({ run, jobs: [job], details: HashMap.make([job.id, region]) })),
        paths: O.map(saved.log, (log) =>
          RecordPaths.make({ record: saved.record, log: log.path, logBytes: log.bytes })
        ),
      })
    )
  );

const reportLines = (feed: FeedArtifact): ReadonlyArray<string> =>
  A.flatMap(feed.reports, (found) => consoleLines(ConsoleRequest.make({ report: found.record.report })));

const partialLines = (partial: O.Option<FeedArtifact>): ReadonlyArray<string> =>
  O.match(partial, {
    onNone: A.empty<string>,
    onSome: (feed) => [
      cutLine(
        `reports: artifact ${feed.name} has ${feed.unreadable.length} unreadable: ${A.join(feed.unreadable, ", ")}; log read`
      ),
      ...readableVerdicts(feed),
    ],
  });

const readableVerdicts = (feed: FeedArtifact): ReadonlyArray<string> => {
  const verdicts = A.map(verdictLines(feed), cutLine);
  const all = tailWithin(verdicts, PARTIAL_VERDICT_CHARS_MAX);
  if (all.length === verdicts.length) return all;
  const kept = tailWithin(verdicts, PARTIAL_VERDICT_CHARS_MAX - agentBudget.maxLineChars - 1);
  return A.prepend(kept, `... ${verdicts.length - kept.length} more readable reports in the artifact`);
};

const PARTIAL_VERDICT_CHARS_MAX = agentBudget.maxChars / 4;

const jobSection =
  (run: CiRunView, saved: Saved) =>
  (reading: JobReading): ReadonlyArray<string> => {
    const header = `== job ${reading.job.name} (${reading.job.id}): ${O.getOrElse(reading.job.conclusion, constant(reading.job.status))}`;
    if (reading._tag === "Reported") {
      return [header, `reports: artifact ${reading.feed.name} (no log fetched)`, ...reportLines(reading.feed)];
    }
    const head = [header, ...partialLines(reading.partial)];
    const logLine = O.match(saved.log, {
      onNone: () => "no log saved",
      onSome: (log) => `saved log (${savedLogLabel(reading.log)}): ${log.path} (${log.bytes} bytes)`,
    });
    return YeetJobLogRead.match(reading.log, {
      Unreadable: () => [...head, `${reading.job.name}: no log yet (gh refused and the job log endpoint failed)`],
      EndpointUnbounded: () => [...head, `${reading.job.name}: the failing step could not be bounded; ${logLine}`],
      LogFailed: ({ output }) => framedRegion(head, jobVerdict(run, reading.job, output, saved), output, logLine),
      EndpointRegion: ({ region }) => framedRegion(head, jobVerdict(run, reading.job, region, saved), region, logLine),
    });
  };

const linesChars = (lines: ReadonlyArray<string>): number => A.reduce(lines, 0, (sum, line) => sum + line.length + 1);

const framedRegion = (
  head: ReadonlyArray<string>,
  verdict: string,
  region: string,
  logLine: string
): ReadonlyArray<string> => {
  const [cutHead, cutVerdict, cutLogLine] = [A.map(head, cutLine), cutLine(verdict), cutLine(logLine)];
  return [
    ...cutHead,
    cutVerdict,
    ...boundFailingRegion(region, linesChars([...cutHead, cutVerdict, cutLogLine, cutVerdict])),
    cutLogLine,
    cutVerdict,
  ];
};

const readJob = (repoRoot: string, feeds: ReadonlyArray<FeedArtifact>) => (job: CiRunJob) => {
  const joined = joinedFeed(feeds, job);
  return O.match(O.filter(joined, completelyReported), {
    onSome: (
      feed
    ): Effect.Effect<JobReading, never, Github | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> =>
      Effect.succeed(CiJobReading.cases.Reported.make({ job, feed })),
    onNone: () =>
      Effect.map(
        readYeetFailedJobLog(repoRoot, job.id),
        (log): JobReading => CiJobReading.cases.Logged.make({ job, log, partial: O.filter(joined, partlyReported) })
      ),
  });
};

const recordRun = Effect.fn("CiFailures.recordRun")(function* (
  repoRoot: string,
  run: CiRunView,
  jobs: ReadonlyArray<CiRunJob>,
  readings: ReadonlyArray<JobReading>
) {
  const target = RecordTarget.cases.RootTarget.make({ gate: CI_RUN_GATE, runId: `${run.id}-${run.attempt}` });
  const store = yield* GateRecordStore.make(repoRoot);
  const details = A.reduce(readings, HashMap.empty<number, string>(), (map, reading) =>
    O.match(detailOf(reading), { onNone: () => map, onSome: (detail) => HashMap.set(map, reading.job.id, detail) })
  );
  const report = ciRunGateReport(CiRunGateInput.make({ run, jobs, details }));
  const log = yield* O.match(savedLogText(readings), {
    onNone: () => Effect.succeedNone,
    onSome: (text) => Effect.asSome(store.writeLog(target, Stream.make(new TextEncoder().encode(text)))),
  });
  const generatedAt = yield* DateTime.now;
  const record = yield* store.writeRecord(target, GateRecord.make({ generatedAt, report }));
  const saved: Saved = {
    record: record.path,
    log: O.map(log, (written) => ({ path: written.path, bytes: written.bytes })),
  };
  return saved;
});

const failuresOfRun = Effect.fn("CiFailures.failuresOfRun")(function* (repoRoot: string, wire: CiWorkflowRun) {
  const run = runView(wire);
  const jobs = yield* runJobs(run.id);
  const red = A.filter(jobs, ciJobIsRed);
  const heading = `run ${run.id} attempt ${run.attempt} (${run.workflow}) at ${run.headSha}`;
  if (A.isReadonlyArrayEmpty(red)) {
    return [`${heading}: no failed job`];
  }
  const feeds = yield* feedsForJobs(run, red);
  const readings = yield* Effect.forEach(red, readJob(repoRoot, feeds), { concurrency: 1 });
  const saved = yield* recordRun(repoRoot, run, jobs, readings).pipe(
    CiCommandError.mapError(
      `Failed to record run ${run.id} under ${recordLocation(RecordTarget.cases.RootTarget.make({ gate: CI_RUN_GATE, runId: `${run.id}-${run.attempt}` })).record}.`
    )
  );
  return [
    `${heading}: ${red.length} failed ${red.length === 1 ? "job" : "jobs"}; record ${saved.record}`,
    ...A.flatMap(readings, jobSection(run, saved)),
  ];
});

/**
 * Print each failed job's verdict and failures for a run or a pull request.
 *
 * **Example** (Build the use case)
 *
 * ```ts
 * import { CiFailuresTarget, printCiFailures } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(printCiFailures(".", CiFailuresTarget.cases.RunTarget.make({ runId: 9 })))) // true
 * ```
 *
 * @param repoRoot - The checkout the run's record and logs are saved in.
 * @param target - The run, or the pull request.
 * @returns The printed lines.
 * @category use-cases
 * @since 0.0.0
 */
export const printCiFailures = Effect.fn("CiFailures.print")(function* (
  repoRoot: string,
  target: CiFailuresTarget
): Effect.fn.Return<
  ReadonlyArray<string>,
  CiCommandError,
  Github | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const runs = yield* targetRuns(target);
  const sections = yield* Effect.forEach(runs, (run) => failuresOfRun(repoRoot, run), { concurrency: 1 });
  const lines = A.isReadonlyArrayEmpty(sections)
    ? ["no failed or running workflow run at the pull request's head"]
    : A.flatten(sections);
  yield* Console.log(A.join(lines, "\n"));
  return lines;
});

const exactlyOne = CiCommandError.make({ message: "Pass exactly one of --run <id> and --pr <number>." });

const targetOf = (run: O.Option<number>, pr: O.Option<number>): Effect.Effect<CiFailuresTarget, CiCommandError> =>
  O.match(run, {
    onSome: (runId) =>
      O.isSome(pr) ? Effect.fail(exactlyOne) : Effect.succeed(CiFailuresTarget.cases.RunTarget.make({ runId })),
    onNone: () =>
      O.match(pr, {
        onNone: () => Effect.fail(exactlyOne),
        onSome: (number) => Effect.succeed(CiFailuresTarget.cases.PullTarget.make({ number })),
      }),
  });

/**
 * Run `beep ci failures` for parsed flags: exactly one of `run` and `pr`, and
 * the repository root where the run's record and log are saved.
 *
 * **Example** (Print a run's failures)
 *
 * ```ts
 * import { runCiFailures } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = runCiFailures({ run: O.some(45042229032), pr: O.none(), repoRoot: Effect.succeed(".") })
 * console.log(typeof program) // "object"
 * ```
 *
 * @param flags - The parsed `--run` and `--pr` flags and the repository root.
 * @returns An effect that prints the failures, reporting a refusal as a `[ci]` error line and a failed exit.
 * @category cli-commands
 * @since 0.0.0
 */
export const runCiFailures = <RR>({
  run,
  pr,
  repoRoot,
}: {
  readonly run: O.Option<number>;
  readonly pr: O.Option<number>;
  readonly repoRoot: Effect.Effect<string, CiCommandError, RR>;
}): Effect.Effect<
  void,
  CliReportedExit,
  RR | Github | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.all([targetOf(run, pr), repoRoot], { concurrency: 1 }).pipe(
    Effect.flatMap(([target, root]) => printCiFailures(root, target)),
    Effect.asVoid,
    Effect.catchTag("CiCommandError", reportCiCommandError)
  );

/**
 * `beep ci failures --run <id> | --pr <number>`, speaking as the operator's
 * `gh` login.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciFailuresCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciFailuresCommand) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciFailuresCommand = Command.make(
  "failures",
  {
    run: Flag.Int("run").pipe(Flag.optional, Flag.withDescription("The workflow run id")),
    pr: Flag.Int("pr").pipe(Flag.optional, Flag.withDescription("The pull request whose head's newest runs to read")),
  },
  ({ run, pr }) =>
    runCiFailures({
      run,
      pr,
      repoRoot: findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root.")),
    })
).pipe(
  Command.withDescription(
    "Print each failed job's verdict and failures for a run or a PR: its gate reports, else its failing log region"
  ),
  Command.provide(
    Layer.mergeAll(
      layerGithubClientFor(GithubClientRequest.make({ identity: YEET_GH_LOGIN_IDENTITY, cwd: "." })),
      layerGithubRepoFor(".")
    )
  )
);
