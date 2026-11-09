/**
 * Measured Test Unit timings of one green hosted run, read from its job logs.
 *
 * **Details**
 *
 * The per-file durations a sharded partition is packed from, and the per-package Vitest walls a
 * bin is weighed by, are both printed by Vitest's default reporter inside each `Test Unit (<id>)`
 * job log. No Actions API carries them, so the live source lists the run's jobs over REST and reads
 * each shard's log through `gh api`, while {@link parseHostedTestUnitLog} turns the text into
 * schema-backed rows. Tests substitute the service with parsed fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { OutputBound, runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";
import { CiLanePartitionId } from "./CiLanePartitions.ts";
import { CiPartitionFileTiming, CiPartitionPackageTiming, CiPartitionRunTimings } from "./CiPartitions.schemas.ts";
import { ghApiJson } from "./LaneTimings.ts";
import type { GitHubClient } from "@beep/github/GitHubClient";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Ci/CiPartitions.service");

/**
 * File and package timings read from one hosted Test Unit job log.
 *
 * @category models
 * @since 0.0.0
 */
export interface ParsedHostedTestUnitLog {
  readonly files: ReadonlyArray<CiPartitionFileTiming>;
  readonly packages: ReadonlyArray<CiPartitionPackageTiming>;
}

/**
 * Contract of a Test Unit timing source.
 *
 * @category models
 * @since 0.0.0
 */
export interface CiPartitionTimingSourceShape {
  /** Collect every Test Unit shard's per-file and per-package measurements for one run. */
  readonly collect: (runId: number) => Effect.Effect<CiPartitionRunTimings, CiCommandError>;
}

/**
 * Service tag for the Test Unit timing source.
 *
 * **Example** (Access the source)
 *
 * ```ts
 * import { CiPartitionTimingSource } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.service(CiPartitionTimingSource)))
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export class CiPartitionTimingSource extends Context.Service<CiPartitionTimingSource, CiPartitionTimingSourceShape>()(
  $I`CiPartitionTimingSource`
) {}

const decorationPattern = /\u001b\[[0-9;]*m|\^\[\[[0-9;]*m/gu;
const timestampPrefixPattern = /^(?:[^\t\n]*\t[^\t\n]*\t)?\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/u;
const fileLinePattern = /^\s*[✓×✗❯]\s+(?:(?!test\/)\S+\s+)?(test\/\S+\.test\.tsx?)\s+\([^)]*\)\s*(\d+)ms\s*$/u;
const durationPattern = /^\s*Duration\s+([\d.]+)s\b/u;
const reportPattern = /JSON report written to \S*?\/((?:packages|apps|tools|infra)\/\S+?)\/coverage\//u;
const jobNamePattern = /^Test Unit \((.+)\)$/u;

// One log line with reporter colours and the Actions timestamp (or `gh run view` prefix) removed.
const logLineContent = (line: string): string =>
  pipe(line, Str.replace(timestampPrefixPattern, ""), Str.replaceAll(decorationPattern, ""));

/**
 * Parse one hosted `Test Unit (<partition>)` job log into file and package timings.
 *
 * **Details**
 *
 * Accepts the raw REST log (`<timestamp> <text>`) and the `gh run view --log` form
 * (`<job>\t<step>\t<timestamp> <text>`); ANSI colours and GitHub's literal `^[[` renderings are
 * stripped. A file row is Vitest's `✓ [project] test/x.test.ts (n tests) NNNNms` line; a package
 * row is a `Duration NNNs` summary followed by the `JSON report written to .../coverage/...`
 * line the coverage producer's JSON reporter prints, which names the package directory.
 *
 * **Example** (Parse one shard log)
 *
 * ```ts
 * import { parseHostedTestUnitLog } from "@beep/repo-cli/commands/Ci"
 *
 * const parsed = parseHostedTestUnitLog(
 *   "repo-cli-4",
 *   "2026-11-09T04:10:04.2142655Z  ✓  shared  test/ci-runner-security.test.ts (57 tests) 46041ms\n"
 * )
 * console.log(parsed.files[0]?.milliseconds) // 46041
 * ```
 *
 * @param partitionId - The partition whose log this is.
 * @param text - The complete job log.
 * @returns Every file and package timing the log carries, in log order.
 * @category parsers
 * @since 0.0.0
 */
export const parseHostedTestUnitLog: {
  (partitionId: CiLanePartitionId, text: string): ParsedHostedTestUnitLog;
  (text: string): (partitionId: CiLanePartitionId) => ParsedHostedTestUnitLog;
} = dual(2, (partitionId: CiLanePartitionId, text: string): ParsedHostedTestUnitLog => {
  const lines = A.map(Str.split(/\r?\n/u)(text), logLineContent);
  const files = A.getSomes(
    A.map(lines, (line) =>
      pipe(
        Str.match(fileLinePattern)(line),
        O.map((match) =>
          CiPartitionFileTiming.make({
            partitionId,
            file: match[1] ?? "",
            milliseconds: Number(match[2]),
          })
        )
      )
    )
  );
  const packages = A.getSomes(
    A.map(lines, (line, index) =>
      pipe(
        Str.match(durationPattern)(line),
        O.flatMap((duration) =>
          pipe(
            A.findFirst(A.drop(lines, index + 1), (candidate) => O.isSome(Str.match(reportPattern)(candidate))),
            O.flatMap(Str.match(reportPattern)),
            O.map((report) =>
              CiPartitionPackageTiming.make({
                partitionId,
                packagePath: report[1] ?? "",
                seconds: Number(duration[1]),
              })
            )
          )
        )
      )
    )
  );
  return { files, packages };
});

/**
 * Read the partition id a hosted job name carries, when the table knows it.
 *
 * **Example** (Recognize a shard job)
 *
 * ```ts
 * import { testUnitJobPartition } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(testUnitJobPartition("Test Unit (unit-a)"))) // true
 * console.log(O.isNone(testUnitJobPartition("Lint (lint-a)"))) // true
 * ```
 *
 * @param name - The hosted job name.
 * @returns The partition id, or none for other jobs and retired partition names.
 * @category parsers
 * @since 0.0.0
 */
export const testUnitJobPartition = (name: string): O.Option<CiLanePartitionId> =>
  pipe(
    Str.match(jobNamePattern)(name),
    O.flatMapNullishOr((match) => match[1]),
    O.filter(S.is(CiLanePartitionId))
  );

const WorkflowRunHead = S.Struct({ head_sha: S.String });
const WorkflowJobsPage = S.Struct({
  total_count: S.Finite,
  jobs: S.Array(S.Struct({ id: S.Finite, name: S.String, conclusion: S.NullOr(S.String) })),
});
const decodeRunHead = S.decodeUnknownEffect(WorkflowRunHead);
const decodeJobsPage = S.decodeUnknownEffect(WorkflowJobsPage);
const JOBS_PAGE_SIZE = 100;
// A unit shard log is one to three megabytes of reporter output; keep the whole text.
const jobLogBound = OutputBound.make({ maxChars: 64 * 1024 * 1024, truncatedNotice: "\n[ci] job log truncated" });

const collectJobs = Effect.fn("CiPartitionTimingSource.collectJobs")(function* (runId: number) {
  let page = 1;
  let jobs = A.empty<{ readonly id: number; readonly name: string; readonly conclusion: string | null }>();
  while (true) {
    const decoded = yield* ghApiJson(
      `repos/{owner}/{repo}/actions/runs/${runId}/jobs?filter=latest&per_page=${JOBS_PAGE_SIZE}&page=${page}`
    ).pipe(Effect.flatMap(decodeJobsPage), CiCommandError.mapError(`Cannot decode the jobs of run ${runId}.`));
    jobs = A.appendAll(jobs, decoded.jobs);
    if (A.length(decoded.jobs) < JOBS_PAGE_SIZE || A.length(jobs) >= decoded.total_count) return jobs;
    page += 1;
  }
});

const makeCiPartitionTimingSource = Effect.fn("CiPartitionTimingSource.make")(function* () {
  const context = yield* Effect.context<
    GitHubClient | Repo | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
  >();
  const { owner, repo } = yield* Repo;
  const collect = Effect.fn("CiPartitionTimingSource.collect")(function* (runId: number) {
    const head = yield* ghApiJson(`repos/{owner}/{repo}/actions/runs/${runId}`).pipe(
      Effect.flatMap(decodeRunHead),
      CiCommandError.mapError(`Cannot decode run ${runId}.`)
    );
    const jobs = yield* collectJobs(runId);
    const shards = A.getSomes(
      A.map(jobs, (job) =>
        pipe(
          testUnitJobPartition(job.name),
          O.map((partitionId) => ({ partitionId, id: job.id, conclusion: job.conclusion }))
        )
      )
    );
    if (A.isReadonlyArrayEmpty(shards)) {
      return yield* CiCommandError.make({ message: `Run ${runId} has no Test Unit shard jobs.` });
    }
    // A red shard reports partial timings, so every Test Unit shard must be green; other lanes of
    // the run (Heavy, Doctest) do not change what the unit shards measured.
    const red = A.filter(shards, (shard) => shard.conclusion !== "success");
    if (A.isReadonlyArrayNonEmpty(red)) {
      return yield* CiCommandError.make({
        message: `Run ${runId} has red Test Unit shards (${A.join(
          A.map(red, (shard) => shard.partitionId),
          ", "
        )}); rebalance only from green shards.`,
      });
    }
    const parsed = yield* Effect.forEach(
      shards,
      Effect.fnUntraced(function* (shard) {
        const log = yield* runCaptured({
          command: "gh",
          // Reporter output carries ANSI colours, which `gh api` refuses to print without this flag.
          args: ["api", `repos/${owner}/${repo}/actions/jobs/${shard.id}/logs`, "--allow-escape-sequences"],
          cwd: process.cwd(),
          source: "stdout",
          bound: jobLogBound,
        }).pipe(CiCommandError.mapError(`Cannot read the log of job ${shard.id} (${shard.partitionId}).`));
        if (log.exitCode !== 0 || log.truncated) {
          return yield* CiCommandError.make({
            message: `Reading the log of job ${shard.id} (${shard.partitionId}) failed or exceeded its bound.`,
          });
        }
        return parseHostedTestUnitLog(shard.partitionId, log.output);
      }),
      { concurrency: 4 }
    );
    return CiPartitionRunTimings.make({
      runId,
      headSha: head.head_sha,
      files: A.flatMap(parsed, (entry) => entry.files),
      packages: A.flatMap(parsed, (entry) => entry.packages),
    });
  });
  return CiPartitionTimingSource.of({
    collect: Effect.fn("CiPartitionTimingSource.collectProvided")((runId: number) =>
      collect(runId).pipe(Effect.provideContext(context))
    ),
  });
});

/**
 * The live timing source: run and job metadata over the Ci GitHub client, logs through `gh api`.
 *
 * **Example** (Build the live source)
 *
 * ```ts
 * import { CiPartitionTimingSourceLive } from "@beep/repo-cli/commands/Ci"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(CiPartitionTimingSourceLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiPartitionTimingSourceLive: Layer.Layer<
  CiPartitionTimingSource,
  never,
  GitHubClient | Repo | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> = Layer.effect(CiPartitionTimingSource, makeCiPartitionTimingSource());
