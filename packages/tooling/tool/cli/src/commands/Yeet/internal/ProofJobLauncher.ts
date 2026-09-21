/**
 * Contract of the detached proof job launcher (time-to-certainty B5,
 * rulings 35–40). The service owns one checkout's job records, starts jobs as
 * transient systemd user services, and finalizes them from `ExecStopPost`.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { UUID } from "@beep/schema/String";
import { ConfigProvider, Console, Context, Crypto, DateTime, Duration, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../../internal/cli/EnvConfig.ts";
import { readContainedFileStringNoFollow, writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { acquireJournalFileLock, releaseJournalFileLock } from "../../../internal/repo-run/AdmissionJournal.ts";
import {
  appendProofJobAttemptTerminated,
  attemptJournalPathForCheckout,
} from "../../../internal/repo-run/AttemptTerminationJournal.ts";
import { processIdentityStatus, processStartIdentityForPid } from "../../../internal/repo-run/ProcessIdentity.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/RepoRun.executor.ts";
import { detectRunScopeSupport } from "../../../internal/repo-run/RunScope.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { writeYeetAckReceipt, YeetAckObservedResolution, YeetAckReceipt } from "./Ack.ts";
import { appendYeetInboxRowOnce, YeetProofJobFinishedRow, yeetProofJobRowId } from "./Inbox.ts";
import {
  forwardedProofJobEnvironment,
  isDeniedProofJobEnvName,
  isSettledProofJob,
  isTerminalProofJobPhase,
  needsProofJobPublication,
  PROOF_JOB_RETENTION_BUDGET,
  PROOF_JOB_SLICE,
  ProofJobCancelOutcome,
  ProofJobCommandEnd,
  ProofJobFinalization,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobRunner,
  ProofJobSystemdResult,
  ProofJobUnit,
  proofJobOutcomeForExit,
  proofJobRowSeverityFor,
  proofJobSystemdRunArguments,
  proofJobUnitName,
  stripProofJobSubmitFlags,
  terminationReasonForServiceResult,
  YeetProofJobCapsule,
} from "./ProofJob.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RunScopeSupport } from "../../../internal/repo-run/RunScope.schemas.ts";
import type { ProofJobOutcome, ProofJobSubmission, ProofJobWaitOptions } from "./ProofJob.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofJobLauncher");
// A record transition holds its lock for one read-modify-write of a small JSON file; inbox and
// journal publication happen after the lock is released. A contender retries 200 times at the
// journal helper's 25 ms pause (about 5 s) before failing with a retryable "stayed busy" error, so a
// brief stall never loses a transition: the caller reruns cancel, finalize, or the bookkeeping.
const PROOF_JOB_LOCK_RETRY_ATTEMPTS = 200;
const decodeUUIDOption = S.decodeOption(UUID);
const decodeUUID = S.decodeEffect(UUID);

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
 * - The CLI writes `finished` through `markFinished`; finalization writes
 *   `terminated` and the systemd stamp, including launch-failure and missing-finalizer recovery.
 * - A job is settled when terminated or stamped; wait, prune, and inbox publication
 *   share that definition. Reads recover unstamped finished records with an unknown stamp.
 * - Each transition uses a per-record file mutex for consistency, not an admission lock.
 * - Cancel saves its request under that mutex before asking systemd to stop the unit.
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
    return yield* O.match(O.fromUndefinedOr(node), {
      onNone: constant(Effect.succeed(A.empty<readonly [string, string]>())),
      onSome: (loaded) => collectNode(name, segments, loaded),
    });
  });
  const collectNode = Effect.fnUntraced(function* (
    name: string,
    segments: ReadonlyArray<string>,
    node: ConfigProvider.Node
  ): Effect.fn.Return<ReadonlyArray<readonly [string, string]>, YeetCommandError> {
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
  const withRecordLock = Effect.fn("ProofJob.withRecordLock")(function* <Value, Error, Requirements>(
    operation: Effect.Effect<Value, Error, Requirements>,
    id: UUID
  ) {
    const lockPath = path.join(jobsRoot, `${id}.lock`);
    yield* readContainedFileStringNoFollow(repoRoot, lockPath).pipe(
      Effect.provide(context),
      Effect.mapError(guardError)
    );
    yield* fs.makeDirectory(jobsRoot, { recursive: true }).pipe(Effect.mapError(guardError));
    const start = yield* processStartIdentityForPid(process.pid).pipe(Effect.provide(context));
    const nonce = yield* crypto.randomUUIDv4.pipe(Effect.mapError(guardError));
    const token = `${process.pid}:${O.getOrElse(start, constant("unknown"))}:${nonce}`;
    return yield* Effect.acquireUseRelease(
      acquireJournalFileLock(lockPath, token, PROOF_JOB_LOCK_RETRY_ATTEMPTS).pipe(
        Effect.provide(context),
        Effect.flatMap((owned) =>
          owned ? Effect.void : Effect.fail(YeetCommandError.make({ message: `Proof job ${id} stayed busy.` }))
        )
      ),
      () => operation,
      () => releaseJournalFileLock(lockPath, token).pipe(Effect.provide(context))
    );
  });
  const command = Effect.fn("ProofJob.command")(function* (exe: string, args: ReadonlyArray<string>) {
    const PATH = yield* configStringOption("PATH");
    return yield* runRepoCommandCapture(
      exe,
      args,
      repoRoot,
      O.getOrUndefined(O.map(PATH, (value) => ({ PATH: value })))
    ).pipe(Effect.provide(context), Effect.mapError(YeetCommandError.new("Proof job command failed.")));
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
        constant("unknown")
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
  const finalizeLocked = Effect.fn("ProofJob.finalizeLocked")(function* (
    id: UUID,
    systemd: ProofJobSystemdResult,
    reason?: "finalizer-missing" | "job-start-failed"
  ) {
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
          : O.some(
              O.isSome(previous.cancelRequestedAt)
                ? "cancelled"
                : (reason ?? terminationReasonForServiceResult(systemd.serviceResult, false))
            ),
    });
    yield* save(record);
    return ProofJobFinalization.make({
      record,
      duplicate,
      inboxRowId: O.some(yeetProofJobRowId(record)),
      attemptTerminated: false,
    });
  });
  const markPublishedLocked = Effect.fn("ProofJob.markPublishedLocked")(function* (id: UUID) {
    const record = yield* requireRecord(id);
    if (O.isSome(record.publishedAt)) return record;
    return yield* save(ProofJobRecord.make({ ...record, publishedAt: O.some(yield* now) }));
  });
  // Publication is idempotent (the inbox row is appended once by id; the journal row only when
  // the attempt has no terminal row), so it always runs, and `publishedAt` is stamped afterwards
  // under the lock: a crash between the stamp and the publish leaves a settled record without
  // `publishedAt`, which the next finalize, read, list, or wait republishes.
  const publishAndMark = Effect.fn("ProofJob.publishAndMark")(function* (record: ProofJobRecord) {
    const published = yield* publish(record);
    const marked = yield* withRecordLock(markPublishedLocked(record.jobId), record.jobId);
    return { published, record: marked };
  });
  // The stamp is decided and saved under the record lock; the inbox row and journal row are
  // published after release so contenders never wait on journal or inbox I/O.
  const finalizeAndPublish = Effect.fn("ProofJob.finalizeAndPublish")(function* (
    id: UUID,
    systemd: ProofJobSystemdResult,
    reason?: "finalizer-missing" | "job-start-failed"
  ) {
    const stamped = yield* withRecordLock(finalizeLocked(id, systemd, reason), id);
    const { published, record } = yield* publishAndMark(stamped.record);
    return ProofJobFinalization.make({
      record,
      duplicate: stamped.duplicate,
      inboxRowId: O.some(published.id),
      attemptTerminated: published.attemptTerminated,
    });
  });
  const finalize = Effect.fn("ProofJob.finalize")((id: UUID, systemd: ProofJobSystemdResult) =>
    finalizeAndPublish(id, systemd)
  );
  const readLocked = Effect.fn("ProofJob.readLocked")(function* (id: UUID) {
    const loaded = yield* rawRead(id);
    if (O.isNone(loaded) || isSettledProofJob(loaded.value)) {
      return { loaded, reconciled: O.filter(loaded, needsProofJobPublication) };
    }
    const record = loaded.value;
    const shown = yield* command("systemctl", [
      "--user",
      "show",
      record.unit.unitName,
      "-p",
      "LoadState",
      "--value",
    ]).pipe(Effect.option);
    if (!O.exists(shown, (result) => Str.trim(result.output) === "not-found"))
      return { loaded, reconciled: O.none<ProofJobRecord>() };
    // Without a runner, fence the submitter to avoid racing the initial systemd-run call.
    const owner = O.getOrElse(record.runner, () => record.submitter);
    const status = yield* processIdentityStatus({
      pid: owner.pid,
      procStart: O.getOrElse(owner.procStart, () => ""),
    }).pipe(Effect.provide(context));
    if (status !== "dead") return { loaded, reconciled: O.none<ProofJobRecord>() };
    const stamped = yield* finalizeLocked(
      id,
      ProofJobSystemdResult.make({
        serviceResult: "unknown",
        invocationId: record.unit.invocationId,
        finalizedAt: yield* now,
      }),
      "finalizer-missing"
    );
    return { loaded: O.some(stamped.record), reconciled: O.some(stamped.record) };
  }, withRecordLock);
  const read = Effect.fn("ProofJob.read")(function* (id: UUID) {
    const outcome = yield* readLocked(id);
    return yield* O.match(outcome.reconciled, {
      onNone: constant(Effect.succeed(outcome.loaded)),
      onSome: (record) => publishAndMark(record).pipe(Effect.map((marked) => O.some(marked.record))),
    });
  });
  const loadList = Effect.fn("ProofJob.list")(function* () {
    yield* readContainedFileStringNoFollow(repoRoot, path.join(jobsRoot, ".guard")).pipe(
      Effect.provide(context),
      Effect.mapError(guardError)
    );
    if (!(yield* fs.exists(jobsRoot).pipe(Effect.mapError(guardError)))) return A.empty<ProofJobRecord>();
    const entries = yield* fs.readDirectory(jobsRoot).pipe(Effect.mapError(guardError));
    const ids = A.getSomes(
      A.map(A.filter(entries, Str.endsWith(".json")), (entry) => decodeUUIDOption(Str.slice(0, -5)(entry)))
    );
    const records = A.getSomes(yield* Effect.forEach(ids, read, { concurrency: 1 }));
    return A.sortWith(records, (record) => record.submittedAt, Order.flip(Order.String));
  });
  const list = loadList();
  const prune = Effect.fn("ProofJob.prune")(function* (keepTerminal: number) {
    const stale = A.drop(A.filter(yield* list, isSettledProofJob), Math.max(0, keepTerminal));
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
      const jobId = yield* decodeUUID(yield* crypto.randomUUIDv4.pipe(Effect.mapError(guardError))).pipe(
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
        yield* finalizeAndPublish(
          jobId,
          ProofJobSystemdResult.make({ serviceResult: "unknown", finalizedAt: yield* now }),
          "job-start-failed"
        );
        return yield* YeetCommandError.make({
          message:
            launched._tag === "Failure" ? launched.failure.message : `systemd-run failed: ${launched.success.output}`,
        });
      }
      return record;
    }),
    markRunning: Effect.fn("ProofJob.markRunning")(function* (id: UUID, runner: ProofJobRunner) {
      const record = yield* requireRecord(id);
      if (isTerminalProofJobPhase(record.phase) || isSettledProofJob(record)) return record;
      const invocationId = yield* configStringOption("INVOCATION_ID");
      return yield* save(
        ProofJobRecord.make({
          ...record,
          phase: "running",
          runner: O.some(runner),
          unit: ProofJobUnit.make({ ...record.unit, invocationId }),
        })
      );
    }, withRecordLock),
    markFinished: Effect.fn("ProofJob.markFinished")(function* (id: UUID, outcome: ProofJobOutcome) {
      const record = yield* requireRecord(id);
      if (isTerminalProofJobPhase(record.phase) || isSettledProofJob(record)) return record;
      return yield* save(ProofJobRecord.make({ ...record, phase: "finished", outcome: O.some(outcome) }));
    }, withRecordLock),
    cancel: Effect.fn("ProofJob.cancel")(function* (id: UUID) {
      const requested = yield* withRecordLock(
        Effect.gen(function* () {
          const record = yield* requireRecord(id);
          if (isTerminalProofJobPhase(record.phase) || isSettledProofJob(record)) return O.none<ProofJobRecord>();
          return O.some(yield* save(ProofJobRecord.make({ ...record, cancelRequestedAt: O.some(yield* now) })));
        }),
        id
      );
      if (O.isNone(requested)) return ProofJobCancelOutcome.Enum["already-terminal"];
      const record = requested.value;
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
          if (isSettledProofJob(record)) {
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

/**
 * Apply one bookkeeping transition to the detached proof job this process runs inside.
 *
 * **Details**
 *
 * The job id comes from `BEEP_YEET_JOB_ID`, which only the job's unit sets, so
 * outside a job this does nothing. A bookkeeping failure is logged and never
 * fails the command: the command's own result stays authoritative, and the
 * finalizer still settles the record.
 *
 * **Example** (Build a no-op transition)
 *
 * ```ts
 * import { updateProofJobBookkeeping } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = updateProofJobBookkeeping("/repo", () => Effect.void)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - The checkout that owns the job record.
 * @param update - The transition to apply to the job.
 * @returns Nothing; a failed transition is reported on stderr.
 * @category services
 * @since 0.0.0
 */
export const updateProofJobBookkeeping = Effect.fn("Yeet.updateProofJobBookkeeping")(
  function* (
    repoRoot: string,
    update: (launcher: ProofJobLauncherShape, id: UUID) => Effect.Effect<unknown, YeetCommandError>
  ) {
    const job = yield* configStringOption("BEEP_YEET_JOB_ID");
    if (O.isNone(job)) return;
    const jobId = yield* decodeUUID(job.value).pipe(Effect.mapError(YeetCommandError.new("Invalid proof job id.")));
    yield* update(yield* ProofJobLauncher.make(repoRoot), jobId);
  },
  Effect.catch((error) => Console.error(`[yeet] job bookkeeping failed: ${error.message}`))
);

/**
 * Run a command so the detached proof job it runs inside records its start and its outcome.
 *
 * **Details**
 *
 * The verify and repair paths record their outcome through the run verdict. The
 * porcelain monitor loops (`--until-ready`, `--until-merged`, `--watch`) write no
 * verdict, so without this the finalizer read a clean `ready` exit as
 * `terminated` and `yeet job wait` exited 2 on a green loop. The wrapper marks
 * the job running with this process's identity, runs the command, and records
 * the outcome {@link proofJobOutcomeForExit} derives from its exit. Outside a job
 * both transitions are no-ops.
 *
 * **Example** (Wrap a command)
 *
 * ```ts
 * import { reportProofJobCommand } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = reportProofJobCommand("/repo", Effect.void)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - The checkout that owns the job record.
 * @param self - The command to run.
 * @returns The command's own result, with the job's running and outcome transitions recorded around it.
 * @category services
 * @since 0.0.0
 */
export const reportProofJobCommand = Effect.fn("ProofJob.reportCommand")(function* <A, E, R>(
  repoRoot: string,
  self: Effect.Effect<A, E, R>
): Effect.fn.Return<
  A,
  E,
  R | Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const startedAt = yield* DateTime.now;
  const procStart = yield* processStartIdentityForPid(process.pid);
  yield* updateProofJobBookkeeping(repoRoot, (launcher, jobId) =>
    launcher.markRunning(
      jobId,
      ProofJobRunner.make({ pid: process.pid, procStart, startedAt: DateTime.formatIso(startedAt) })
    )
  );
  return yield* self.pipe(
    Effect.onExit(
      Effect.fnUntraced(function* (exit) {
        const endedAt = yield* DateTime.now;
        const outcome = proofJobOutcomeForExit(
          exit,
          ProofJobCommandEnd.make({
            endedAt: DateTime.formatIso(endedAt),
            elapsedMs: DateTime.toEpochMillis(endedAt) - DateTime.toEpochMillis(startedAt),
          })
        );
        if (O.isNone(outcome)) return;
        yield* updateProofJobBookkeeping(repoRoot, (launcher, jobId) => launcher.markFinished(jobId, outcome.value));
      })
    )
  );
});

export {
  appendProofJobAttemptTerminated,
  attemptJournalPathForCheckout,
} from "../../../internal/repo-run/AttemptTerminationJournal.ts";
