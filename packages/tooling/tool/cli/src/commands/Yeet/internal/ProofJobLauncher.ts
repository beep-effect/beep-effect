/**
 * Contract of the detached proof job launcher (time-to-certainty B5,
 * rulings 35–40). The service owns one checkout's job records, starts jobs as
 * transient systemd user services, and finalizes them from `ExecStopPost`.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { UUID } from "@beep/schema/String";
import { ConfigProvider, Context, Crypto, DateTime, Duration, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../../internal/cli/EnvConfig.ts";
import { readContainedFileStringNoFollow, writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import {
  appendProofJobAttemptTerminated,
  attemptJournalPathForCheckout,
} from "../../../internal/repo-run/AttemptTerminationJournal.ts";
import { processIdentityStatus } from "../../../internal/repo-run/ProcessIdentity.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/RepoRun.executor.ts";
import { detectRunScopeSupport } from "../../../internal/repo-run/RunScope.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { writeYeetAckReceipt, YeetAckObservedResolution, YeetAckReceipt } from "./Ack.ts";
import { appendYeetInboxRowOnce, YeetProofJobFinishedRow, yeetProofJobRowId } from "./Inbox.ts";
import {
  forwardedProofJobEnvironment,
  isDeniedProofJobEnvName,
  isTerminalProofJobPhase,
  PROOF_JOB_RETENTION_BUDGET,
  PROOF_JOB_SLICE,
  ProofJobCancelOutcome,
  ProofJobFinalization,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSystemdResult,
  ProofJobUnit,
  proofJobRowSeverityFor,
  proofJobSystemdRunArguments,
  proofJobUnitName,
  stripProofJobSubmitFlags,
  terminationReasonForServiceResult,
  YeetProofJobCapsule,
} from "./ProofJob.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RunScopeSupport } from "../../../internal/repo-run/RunScope.schemas.ts";
import type { ProofJobOutcome, ProofJobRunner, ProofJobSubmission, ProofJobWaitOptions } from "./ProofJob.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofJobLauncher");

/**
 * Operations over one checkout's detached proof jobs.
 *
 * **Details**
 *
 * - `support` is the run-scope probe; `submit` refuses (ruling 40) unless it is
 *   `active` and never falls back to an attached run.
 * - `submit` writes the `submitted` record before starting the unit and, when
 *   `systemd-run` exits non-zero, leaves the record `terminated / job-start-failed` and fails with the captured output. It prunes terminal
 *   records beyond the retention budget first.
 * - `markRunning` and `markFinished` are the job's own CLI reporting in
 *   (ruling 36); their failures are logged by the caller, never fatal.
 * - `finalize` is the single writer of the terminal phase, idempotent, and the
 *   only writer of the inbox row and of the finalizer's attempt-terminated
 *   journal row (rulings 36–38).
 * - `read`, `list`, and `wait` reconcile a `submitted`/`running` record whose
 *   unit is gone and whose runner is dead into `terminated / finalizer-missing`.
 * - `cancel` records the request before asking systemd to stop the unit so
 *   the finalizer can name the reason `cancelled`.
 * - `wait` polls until the record is terminal or the timeout elapses, then
 *   acknowledges the job's inbox row as observed (ruling 37).
 *
 * **Example** (Name a launcher operation)
 *
 * ```ts
 * import type { ProofJobLauncherShape } from "@beep/repo-cli/test/Yeet"
 * const operation: keyof ProofJobLauncherShape = "submit"
 * console.log(operation) // "submit"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ProofJobLauncherShape {
  readonly cancel: (jobId: UUID) => Effect.Effect<ProofJobCancelOutcome, YeetCommandError>;
  readonly finalize: (
    jobId: UUID,
    systemd: ProofJobSystemdResult
  ) => Effect.Effect<ProofJobFinalization, YeetCommandError>;
  readonly list: Effect.Effect<ReadonlyArray<ProofJobRecord>, YeetCommandError>;
  readonly markFinished: (jobId: UUID, outcome: ProofJobOutcome) => Effect.Effect<ProofJobRecord, YeetCommandError>;
  readonly markRunning: (jobId: UUID, runner: ProofJobRunner) => Effect.Effect<ProofJobRecord, YeetCommandError>;
  readonly prune: (keepTerminal: number) => Effect.Effect<ReadonlyArray<UUID>, YeetCommandError>;
  readonly read: (jobId: UUID) => Effect.Effect<O.Option<ProofJobRecord>, YeetCommandError>;
  readonly submit: (submission: ProofJobSubmission) => Effect.Effect<ProofJobRecord, YeetCommandError>;
  readonly support: Effect.Effect<RunScopeSupport>;
  readonly wait: (jobId: UUID, options: ProofJobWaitOptions) => Effect.Effect<ProofJobRecord, YeetCommandError>;
}

const proofJobEnvironment = Effect.fn("ProofJob.environment")(function* () {
  const provider = yield* ConfigProvider.ConfigProvider;
  const collect = Effect.fnUntraced(function* (
    segments: ReadonlyArray<string>
  ): Effect.fn.Return<ReadonlyArray<readonly [string, string]>, YeetCommandError> {
    const name = A.join(segments, "_");
    if (isDeniedProofJobEnvName(name)) return [];
    const node = yield* provider
      .load(segments)
      .pipe(Effect.mapError(YeetCommandError.new("Failed to read job environment.")));
    if (node === undefined) return [];
    const own: ReadonlyArray<readonly [string, string]> = node.value === undefined ? [] : [[name, node.value]];
    if (node._tag !== "Record") return own;
    const children = yield* Effect.forEach(A.fromIterable(node.keys), (key) => collect([...segments, key]), {
      concurrency: 1,
    });
    return A.appendAll(own, A.flatten(children));
  });
  return forwardedProofJobEnvironment(R.fromEntries(yield* collect([])));
});

const makeProofJobLauncher = Effect.fn("Yeet.ProofJobLauncher.make")(function* (
  repoRoot: string
): Effect.fn.Return<
  ProofJobLauncherShape,
  never,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const context = yield* Effect.context<FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>();
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const jobsRoot = path.join(repoRoot, ".beep", "yeet", "jobs");
  const fileFor = (id: UUID) => path.join(jobsRoot, `${id}.json`);
  const codec = JsonStringCodec(ProofJobRecord);
  const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const guardError = YeetCommandError.new("Proof job storage operation failed.");
  const save = Effect.fn("ProofJob.save")(function* (record: ProofJobRecord) {
    const json = yield* codec.encode(record);
    yield* writeContainedFileString(repoRoot, fileFor(record.jobId), `${json}\n`).pipe(Effect.provide(context));
    return record;
  }, Effect.mapError(guardError));
  const rawRead = Effect.fn("ProofJob.rawRead")(function* (id: UUID) {
    const read = yield* readContainedFileStringNoFollow(repoRoot, fileFor(id)).pipe(Effect.provide(context));
    if (!read.exists) return O.none<ProofJobRecord>();
    if (O.isNone(read.contents))
      return yield* YeetCommandError.make({ message: "Job record is not a readable regular file." });
    const record = yield* codec.decode(read.contents.value);
    if (
      record.jobId !== id ||
      record.request.checkout !== repoRoot ||
      record.unit.unitName !== proofJobUnitName(id) ||
      record.unit.logPath !== path.join(jobsRoot, `${id}.log`)
    ) {
      return yield* YeetCommandError.make({ message: "Proof job identity or containment mismatch." });
    }
    return O.some(record);
  }, Effect.mapError(guardError));
  const requireRecord = Effect.fn("ProofJob.requireRecord")(function* (id: UUID) {
    const record = yield* rawRead(id);
    if (O.isNone(record)) return yield* YeetCommandError.make({ message: `Unknown proof job ${id}.` });
    return record.value;
  });
  const command = Effect.fn("ProofJob.command")(function* (exe: string, args: ReadonlyArray<string>) {
    const PATH = yield* configStringOption("PATH");
    return yield* runRepoCommandCapture(exe, args, repoRoot, O.isSome(PATH) ? { PATH: PATH.value } : undefined).pipe(
      Effect.provide(context),
      Effect.mapError(YeetCommandError.new("Proof job command failed."))
    );
  });
  const publish = Effect.fn("ProofJob.publishResult")(function* (record: ProofJobRecord) {
    const outcome = record.outcome;
    const capsule = YeetProofJobCapsule.make({
      jobId: record.jobId,
      mode: record.request.mode,
      branch: record.request.branch,
      headSha: record.request.head,
      unitName: record.unit.unitName,
      phase: record.phase,
      serviceResult: O.getOrElse(
        O.map(record.systemd, (result) => result.serviceResult),
        () => "unknown"
      ),
      exitStatus: O.getOrNull(O.flatMap(record.systemd, (result) => result.exitStatus)),
      verdictOutcome: O.getOrNull(O.map(outcome, (result) => result.verdictOutcome)),
      terminationReason: O.getOrNull(record.terminationReason),
      elapsedMs: O.getOrNull(O.flatMap(outcome, (result) => result.elapsedMs)),
      logPath: record.unit.logPath,
    });
    let attemptTerminated = false;
    const attemptId = O.flatMap(record.runner, (runner) => runner.attemptId);
    if (record.phase === "terminated" && O.isSome(attemptId) && O.isSome(record.terminationReason)) {
      const journal = yield* attemptJournalPathForCheckout(repoRoot, record.request.branch).pipe(
        Effect.provide(context)
      );
      attemptTerminated = yield* appendProofJobAttemptTerminated(
        journal,
        attemptId.value,
        record.terminationReason.value
      ).pipe(Effect.provide(context), Effect.mapError(guardError));
    }
    const id = yeetProofJobRowId(capsule);
    yield* appendYeetInboxRowOnce(
      repoRoot,
      YeetProofJobFinishedRow.make({
        capsule,
        id,
        checkout: repoRoot,
        ts: yield* now,
        severity: proofJobRowSeverityFor(
          record.phase,
          O.map(outcome, (value) => value.verdictOutcome)
        ),
      })
    ).pipe(Effect.provide(context));
    return { id, attemptTerminated };
  });
  const finalize = Effect.fn("ProofJob.finalize")(function* (id: UUID, systemd: ProofJobSystemdResult) {
    const previous = yield* requireRecord(id);
    const duplicate = O.isSome(previous.systemd);
    if (duplicate)
      return ProofJobFinalization.make({
        record: previous,
        duplicate: true,
        inboxRowId: O.some(yeetProofJobRowId(previous)),
        attemptTerminated: false,
      });
    const record = ProofJobRecord.make({
      ...previous,
      phase: previous.phase === "finished" ? "finished" : "terminated",
      systemd: O.some(systemd),
      unit: ProofJobUnit.make({ ...previous.unit, invocationId: systemd.invocationId }),
      terminationReason:
        previous.phase === "finished"
          ? O.none()
          : O.some(terminationReasonForServiceResult(systemd.serviceResult, O.isSome(previous.cancelRequestedAt))),
    });
    // Publish idempotent side effects before the stamp so a retry repairs partial finalization.
    const published = yield* publish(record);
    yield* save(record);
    return ProofJobFinalization.make({
      record,
      duplicate,
      inboxRowId: O.some(published.id),
      attemptTerminated: published.attemptTerminated,
    });
  });
  const read = Effect.fn("ProofJob.read")(function* (id: UUID) {
    const loaded = yield* rawRead(id);
    if (O.isNone(loaded) || isTerminalProofJobPhase(loaded.value.phase)) return loaded;
    const record = loaded.value;
    const shown = yield* command("systemctl", [
      "--user",
      "show",
      record.unit.unitName,
      "-p",
      "LoadState",
      "--value",
    ]).pipe(Effect.option);
    if (!O.exists(shown, (result) => Str.trim(result.output) === "not-found")) return loaded;
    // Without a runner, fence the submitter to avoid racing the initial systemd-run call.
    const owner = O.getOrElse(record.runner, () => record.submitter);
    const status = yield* processIdentityStatus({
      pid: owner.pid,
      procStart: O.getOrElse(owner.procStart, () => ""),
    }).pipe(Effect.provide(context));
    if (status !== "dead") return loaded;
    const reconciled = ProofJobRecord.make({
      ...record,
      phase: "terminated",
      terminationReason: O.some("finalizer-missing"),
    });
    yield* publish(reconciled);
    return O.some(yield* save(reconciled));
  });
  const loadList = Effect.fn("ProofJob.list")(function* () {
    yield* readContainedFileStringNoFollow(repoRoot, path.join(jobsRoot, ".guard")).pipe(
      Effect.provide(context),
      Effect.mapError(guardError)
    );
    if (!(yield* fs.exists(jobsRoot).pipe(Effect.mapError(guardError)))) return A.empty<ProofJobRecord>();
    const entries = yield* fs.readDirectory(jobsRoot).pipe(Effect.mapError(guardError));
    const ids = A.getSomes(
      A.map(A.filter(entries, Str.endsWith(".json")), (entry) => S.decodeOption(UUID)(Str.slice(0, -5)(entry)))
    );
    const records = A.getSomes(yield* Effect.forEach(ids, read, { concurrency: 1 }));
    return A.sortWith(records, (record) => record.submittedAt, Order.flip(Order.String));
  });
  const list = loadList();
  const prune = Effect.fn("ProofJob.prune")(function* (keepTerminal: number) {
    const stale = A.drop(
      A.filter(
        yield* list,
        (record) => isTerminalProofJobPhase(record.phase) && (record.phase === "terminated" || O.isSome(record.systemd))
      ),
      Math.max(0, keepTerminal)
    );
    for (const record of stale) {
      for (const file of [record.unit.logPath, fileFor(record.jobId)]) {
        yield* readContainedFileStringNoFollow(repoRoot, file).pipe(
          Effect.provide(context),
          Effect.mapError(guardError)
        );
        yield* fs.remove(file, { force: true }).pipe(Effect.mapError(guardError));
      }
    }
    return A.map(stale, (record) => record.jobId);
  });
  const support = detectRunScopeSupport().pipe(Effect.provide(context));
  return {
    support,
    read,
    list,
    prune,
    finalize,
    submit: Effect.fn("ProofJob.submit")(function* (submission: ProofJobSubmission) {
      if ((yield* support) !== "active")
        return yield* YeetCommandError.make({
          message: "Detached proof jobs require an active systemd user manager; no attached fallback was started.",
        });
      if (submission.request.checkout !== repoRoot)
        return yield* YeetCommandError.make({ message: "Submission checkout does not match launcher root." });
      yield* prune(PROOF_JOB_RETENTION_BUDGET);
      const jobId = yield* S.decodeEffect(UUID)(yield* crypto.randomUUIDv4.pipe(Effect.mapError(guardError))).pipe(
        Effect.mapError(guardError)
      );
      const env = yield* proofJobEnvironment();
      const argv = stripProofJobSubmitFlags(submission.request.argv);
      const record = ProofJobRecord.make({
        jobId,
        submittedAt: yield* now,
        phase: "submitted",
        submitter: submission.submitter,
        request: ProofJobRequest.make({ ...submission.request, argv, forwardedEnvNames: R.keys(env) }),
        unit: ProofJobUnit.make({
          unitName: proofJobUnitName(jobId),
          slice: PROOF_JOB_SLICE,
          description: `beep-yeet-job id=${jobId} mode=${submission.request.mode} checkout=${repoRoot}`,
          logPath: path.join(jobsRoot, `${jobId}.log`),
          execStart: [submission.execPath, submission.entrypoint, "yeet", ...argv],
          execStopPost: [submission.execPath, submission.entrypoint, "yeet", "job", "finalize", jobId],
          maxRuntimeSeconds: submission.maxRuntimeSeconds,
        }),
      });
      yield* save(record);
      yield* writeContainedFileString(repoRoot, record.unit.logPath, "").pipe(
        Effect.provide(context),
        Effect.mapError(guardError)
      );
      const launched = yield* command("systemd-run", proofJobSystemdRunArguments(record, env)).pipe(Effect.result);
      if (launched._tag === "Failure" || launched.success.exitCode !== 0) {
        const failed = ProofJobRecord.make({
          ...record,
          phase: "terminated",
          terminationReason: O.some("job-start-failed"),
          systemd: O.some(ProofJobSystemdResult.make({ serviceResult: "unknown", finalizedAt: yield* now })),
        });
        yield* publish(failed);
        yield* save(failed);
        return yield* YeetCommandError.make({
          message:
            launched._tag === "Failure" ? launched.failure.message : `systemd-run failed: ${launched.success.output}`,
        });
      }
      return record;
    }),
    markRunning: Effect.fn("ProofJob.markRunning")(function* (id: UUID, runner: ProofJobRunner) {
      const record = yield* requireRecord(id);
      if (isTerminalProofJobPhase(record.phase)) return record;
      const invocationId = yield* configStringOption("INVOCATION_ID");
      return yield* save(
        ProofJobRecord.make({
          ...record,
          phase: "running",
          runner: O.some(runner),
          unit: ProofJobUnit.make({ ...record.unit, invocationId }),
        })
      );
    }),
    markFinished: Effect.fn("ProofJob.markFinished")(function* (id: UUID, outcome: ProofJobOutcome) {
      const record = yield* requireRecord(id);
      if (isTerminalProofJobPhase(record.phase)) return record;
      return yield* save(ProofJobRecord.make({ ...record, phase: "finished", outcome: O.some(outcome) }));
    }),
    cancel: Effect.fn("ProofJob.cancel")(function* (id: UUID) {
      const record = yield* requireRecord(id);
      if (isTerminalProofJobPhase(record.phase)) return ProofJobCancelOutcome.Enum["already-terminal"];
      yield* save(ProofJobRecord.make({ ...record, cancelRequestedAt: O.some(yield* now) }));
      const result = yield* command("systemctl", ["--user", "stop", record.unit.unitName]);
      if (result.exitCode === 0) return ProofJobCancelOutcome.Enum["stop-requested"];
      const state = yield* command("systemctl", ["--user", "show", record.unit.unitName, "-p", "LoadState", "--value"]);
      return Str.trim(state.output) === "not-found"
        ? ProofJobCancelOutcome.Enum["unit-absent"]
        : ProofJobCancelOutcome.Enum["stop-failed"];
    }),
    wait: Effect.fn("ProofJob.wait")(function* (id: UUID, options: ProofJobWaitOptions) {
      const pollUntilTerminal = Effect.fnUntraced(function* () {
        while (true) {
          const found = yield* read(id);
          if (O.isNone(found)) return yield* YeetCommandError.make({ message: `Unknown proof job ${id}.` });
          const record = found.value;
          if (isTerminalProofJobPhase(record.phase) && (record.phase === "terminated" || O.isSome(record.systemd))) {
            yield* writeYeetAckReceipt(
              repoRoot,
              YeetAckReceipt.make({
                id: yeetProofJobRowId(record),
                ackedAt: yield* now,
                resolution: YeetAckObservedResolution.make({ via: "job-wait" }),
              })
            ).pipe(Effect.provide(context));
            return record;
          }
          yield* Effect.sleep(Duration.millis(options.pollIntervalMs));
        }
      });
      const poll = pollUntilTerminal();
      return yield* O.isSome(options.timeoutMs)
        ? poll.pipe(
            Effect.timeoutOrElse({
              duration: Duration.millis(options.timeoutMs.value),
              orElse: () => Effect.fail(YeetCommandError.make({ message: `Timed out waiting for proof job ${id}.` })),
            })
          )
        : poll;
    }),
  };
});

/**
 * Context tag for the detached proof job launcher. The live implementation is
 * constructed per checkout root, like the proof ledger, so records, logs, and
 * the inbox all resolve under that checkout's `.beep/yeet`.
 *
 * **Example** (Reference the service tag)
 *
 * ```ts
 * import { ProofJobLauncher } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof ProofJobLauncher) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProofJobLauncher extends Context.Service<ProofJobLauncher, ProofJobLauncherShape>()($I`ProofJobLauncher`, {
  make: makeProofJobLauncher,
}) {}

export {
  appendProofJobAttemptTerminated,
  attemptJournalPathForCheckout,
} from "../../../internal/repo-run/AttemptTerminationJournal.ts";
