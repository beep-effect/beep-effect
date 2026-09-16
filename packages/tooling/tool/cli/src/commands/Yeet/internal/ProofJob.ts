/**
 * Detached durable proof jobs (time-to-certainty B5, rulings 35–40).
 *
 * A proof an agent submits with `--detach` runs as a transient systemd user
 * service under `agent-runs.slice`, outlives the submitter, and leaves one
 * durable record per job under `.beep/yeet/jobs/`. The finalizer that systemd
 * runs after the job's main process ends (`ExecStopPost`) stamps the systemd
 * result triple, journals abnormal deaths, and reports through the inbox.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Effect } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetRunMode } from "./Planner.ts";
import { YeetOutcome } from "./Verdict.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofJob");

/**
 * Schema version carried by every proof job record.
 *
 * **Example** (Pin the version when writing a record)
 *
 * ```ts
 * import { PROOF_JOB_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_SCHEMA_VERSION) // "yeet-proof-job/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_SCHEMA_VERSION = "yeet-proof-job/v1";

/**
 * Prefix of every transient job unit; the job id follows it.
 *
 * **Example** (Read the prefix)
 *
 * ```ts
 * import { PROOF_JOB_UNIT_PREFIX } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_UNIT_PREFIX) // "beep-proof-"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_UNIT_PREFIX = "beep-proof-";

/**
 * Slice every job unit is started in (ruling 35). A missing installed slice is
 * acceptable: the user manager creates a transient one with default accounting.
 *
 * **Example** (Read the slice name)
 *
 * ```ts
 * import { PROOF_JOB_SLICE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_SLICE) // "agent-runs.slice"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_SLICE = "agent-runs.slice";

/**
 * Seconds systemd waits after `SIGTERM` before `SIGKILL` when a job is stopped,
 * long enough for the job's CLI to write its interrupted attempt row.
 *
 * **Example** (Read the stop timeout)
 *
 * ```ts
 * import { PROOF_JOB_STOP_TIMEOUT_SECONDS } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_STOP_TIMEOUT_SECONDS) // 60
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_STOP_TIMEOUT_SECONDS = 60;

/**
 * Number of terminal job records (and their logs) retained per checkout
 * (ruling 36). Pruning runs at submit.
 *
 * **Example** (Read the retention budget)
 *
 * ```ts
 * import { PROOF_JOB_RETENTION_BUDGET } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_RETENTION_BUDGET) // 50
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_RETENTION_BUDGET = 50;

/**
 * Environment variable names the launcher sets on the job unit and the job's
 * CLI reads to know it is a job (ruling 39).
 *
 * **Example** (Name the job id variable)
 *
 * ```ts
 * import { PROOF_JOB_ENV } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_ENV.jobId) // "BEEP_YEET_JOB_ID"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_ENV = {
  jobId: "BEEP_YEET_JOB_ID",
  jobUnit: "BEEP_YEET_JOB_UNIT",
  jobLog: "BEEP_YEET_JOB_LOG",
} as const;

/**
 * Exact environment variable names forwarded from the submitter to the job
 * unit (ruling 39). Values are never recorded anywhere.
 *
 * **Example** (PATH is forwarded)
 *
 * ```ts
 * import { PROOF_JOB_FORWARDED_ENV_NAMES } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_FORWARDED_ENV_NAMES.includes("PATH")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_FORWARDED_ENV_NAMES: ReadonlyArray<string> = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TMPDIR",
  "SSH_AUTH_SOCK",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "NODE_OPTIONS",
  "GIT_SSH_COMMAND",
  "GIT_CONFIG_GLOBAL",
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
];

/**
 * Environment variable name prefixes forwarded to the job unit (ruling 39),
 * subject to {@link isDeniedProofJobEnvName}.
 *
 * **Example** (BEEP_ variables are forwarded)
 *
 * ```ts
 * import { PROOF_JOB_FORWARDED_ENV_PREFIXES } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_FORWARDED_ENV_PREFIXES) // [ "BEEP_", "TURBO_" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_FORWARDED_ENV_PREFIXES: ReadonlyArray<string> = ["BEEP_", "TURBO_"];

/**
 * Environment variables fixed on every job unit regardless of the submitter's
 * environment: a dumb terminal and no ANSI color so the job log stays plain.
 *
 * **Example** (The job log is uncolored)
 *
 * ```ts
 * import { PROOF_JOB_FIXED_ENV } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_FIXED_ENV.NO_COLOR) // "1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_FIXED_ENV = {
  TERM: "dumb",
  NO_COLOR: "1",
} as const;

/**
 * Flags consumed by `--detach` submission and stripped from the replayed argv
 * (ruling 35). `--job-max-runtime` takes a value in both spellings.
 *
 * **Example** (Both submit-only flags)
 *
 * ```ts
 * import { PROOF_JOB_SUBMIT_ONLY_FLAGS } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_JOB_SUBMIT_ONLY_FLAGS) // [ "--detach", "--job-max-runtime" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_JOB_SUBMIT_ONLY_FLAGS: ReadonlyArray<string> = ["--detach", "--job-max-runtime"];

const DeniedEnvName = S.String.check(S.isPattern(/^(?:OP_)|TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL/iu)).pipe(
  $I.annoteSchema("DeniedEnvName", {
    description: "Credential-shaped environment variable names never forwarded to proof jobs.",
  })
);

/**
 * Decide whether an environment variable name must never reach a job unit
 * (ruling 39): every `OP_*` name and any name naming a token, secret, key,
 * password, or credential, even under a forwarded prefix.
 *
 * **Example** (A TURBO token is denied, a BEEP switch is not)
 *
 * ```ts
 * import { isDeniedProofJobEnvName } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isDeniedProofJobEnvName("TURBO_TOKEN")) // true
 * console.log(isDeniedProofJobEnvName("BEEP_RUN_SCOPES")) // false
 * ```
 *
 * @param name - Environment variable name.
 * @returns Whether the name is denied.
 * @category environment
 * @since 0.0.0
 */
export const isDeniedProofJobEnvName: (name: string) => boolean = S.is(DeniedEnvName);

/**
 * Lifecycle phase of one job record (ruling 36).
 *
 * **Example** (Name the terminal phases)
 *
 * ```ts
 * import { ProofJobPhase } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobPhase.Enum.finished) // "finished"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobPhase = LiteralKit(["submitted", "running", "finished", "terminated"]).pipe(
  $I.annoteSchema("ProofJobPhase", {
    description: "Lifecycle phase of a detached proof job record.",
  })
);

/**
 * Lifecycle phase of one job record.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobPhase } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobPhase.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobPhase = typeof ProofJobPhase.Type;

/**
 * Whether a phase is terminal (`finished` or `terminated`).
 *
 * **Example** (Terminal and non-terminal phases)
 *
 * ```ts
 * import { isTerminalProofJobPhase } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isTerminalProofJobPhase("terminated")) // true
 * console.log(isTerminalProofJobPhase("running")) // false
 * ```
 *
 * @param phase - A job phase.
 * @returns Whether no further transition is possible.
 * @category models
 * @since 0.0.0
 */
export const isTerminalProofJobPhase = (phase: ProofJobPhase): boolean =>
  ProofJobPhase.is.finished(phase) || ProofJobPhase.is.terminated(phase);

/**
 * systemd's `$SERVICE_RESULT` vocabulary as seen by the finalizer, plus
 * `unknown` for a finalizer that ran without the variable.
 *
 * **Example** (A clean exit)
 *
 * ```ts
 * import { ProofJobServiceResult } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobServiceResult.Enum.success) // "success"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobServiceResult = LiteralKit([
  "success",
  "protocol",
  "timeout",
  "exit-code",
  "signal",
  "core-dump",
  "watchdog",
  "exec-condition",
  "oom-kill",
  "start-limit-hit",
  "resources",
  "unknown",
]).pipe(
  $I.annoteSchema("ProofJobServiceResult", {
    description: "systemd SERVICE_RESULT of a finished job unit, or unknown when the finalizer had none.",
  })
);

/**
 * systemd's `$SERVICE_RESULT` vocabulary.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobServiceResult } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobServiceResult.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobServiceResult = typeof ProofJobServiceResult.Type;

/**
 * systemd's `$EXIT_CODE` vocabulary: how the main process ended.
 *
 * **Example** (A signalled process)
 *
 * ```ts
 * import { ProofJobExitCode } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobExitCode.Enum.killed) // "killed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobExitCode = LiteralKit(["exited", "killed", "dumped"]).pipe(
  $I.annoteSchema("ProofJobExitCode", {
    description: "systemd EXIT_CODE of a job's main process: exited, killed, or dumped.",
  })
);

/**
 * systemd's `$EXIT_CODE` vocabulary.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobExitCode } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobExitCode.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobExitCode = typeof ProofJobExitCode.Type;

/**
 * Why a job ended without a recorded verdict (ruling 38). `signal` and
 * `unrecorded-failure` share the attempt journal's existing reasons; the rest
 * extend it. `finalizer-missing` is assigned by reconciliation, never by the
 * finalizer itself.
 *
 * **Example** (Name the OOM reason)
 *
 * ```ts
 * import { ProofJobTerminationReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobTerminationReason.Enum["oom-killed"]) // "oom-killed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobTerminationReason = LiteralKit([
  "signal",
  "oom-killed",
  "timeout",
  "job-start-failed",
  "unrecorded-failure",
  "cancelled",
  "finalizer-missing",
]).pipe(
  $I.annoteSchema("ProofJobTerminationReason", {
    description: "Why a detached proof job terminated without a recorded verdict.",
  })
);

/**
 * Why a job ended without a recorded verdict.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobTerminationReason } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobTerminationReason.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobTerminationReason = typeof ProofJobTerminationReason.Type;

/**
 * Map systemd's result to the job's termination reason (ruling 38). A
 * recorded cancel request wins over every systemd result.
 *
 * **Example** (OOM kill and cancel)
 *
 * ```ts
 * import { terminationReasonForServiceResult } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(terminationReasonForServiceResult("oom-kill", false)) // "oom-killed"
 * console.log(terminationReasonForServiceResult("signal", true)) // "cancelled"
 * ```
 *
 * @param result - systemd's SERVICE_RESULT.
 * @param cancelRequested - Whether `yeet job cancel` recorded a request before the stop.
 * @returns The abnormal journal reason, with cancellation taking precedence.
 * @category models
 * @since 0.0.0
 */
export const terminationReasonForServiceResult: {
  (cancelRequested: boolean): (result: ProofJobServiceResult) => ProofJobTerminationReason;
  (result: ProofJobServiceResult, cancelRequested: boolean): ProofJobTerminationReason;
} = dual(
  2,
  (result: ProofJobServiceResult, cancelRequested: boolean): ProofJobTerminationReason =>
    cancelRequested
      ? ProofJobTerminationReason.Enum.cancelled
      : ProofJobServiceResult.$match(result, {
          success: () => ProofJobTerminationReason.Enum["unrecorded-failure"],
          "exit-code": () => ProofJobTerminationReason.Enum["unrecorded-failure"],
          unknown: () => ProofJobTerminationReason.Enum["unrecorded-failure"],
          signal: () => ProofJobTerminationReason.Enum.signal,
          "core-dump": () => ProofJobTerminationReason.Enum.signal,
          "oom-kill": () => ProofJobTerminationReason.Enum["oom-killed"],
          timeout: () => ProofJobTerminationReason.Enum.timeout,
          watchdog: () => ProofJobTerminationReason.Enum.timeout,
          protocol: () => ProofJobTerminationReason.Enum["job-start-failed"],
          "exec-condition": () => ProofJobTerminationReason.Enum["job-start-failed"],
          "start-limit-hit": () => ProofJobTerminationReason.Enum["job-start-failed"],
          resources: () => ProofJobTerminationReason.Enum["job-start-failed"],
        })
);

/**
 * Inbox severity a job row may carry (ruling 37): `P2` for a green verdict,
 * `P1` for a red verdict or an abnormal termination. Never `P0`.
 *
 * **Example** (The two severities)
 *
 * ```ts
 * import { ProofJobRowSeverity } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobRowSeverity.Enum.P2) // "P2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobRowSeverity = LiteralKit(["P1", "P2"]).pipe(
  $I.annoteSchema("ProofJobRowSeverity", {
    description: "Inbox severity of a proof-job-finished row: P2 green, P1 red or terminated.",
  })
);

/**
 * Inbox severity a job row may carry.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobRowSeverity } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobRowSeverity.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobRowSeverity = typeof ProofJobRowSeverity.Type;

/**
 * Which command observed a job row and acknowledged it (ruling 37).
 *
 * **Example** (Observation through wait)
 *
 * ```ts
 * import { ProofJobObservedVia } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobObservedVia.Enum["job-wait"]) // "job-wait"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobObservedVia = LiteralKit(["job-wait", "job-status", "inbox-ack"]).pipe(
  $I.annoteSchema("ProofJobObservedVia", {
    description: "The command through which a proof-job row was observed and acknowledged.",
  })
);

/**
 * Which command observed a job row.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobObservedVia } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobObservedVia.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobObservedVia = typeof ProofJobObservedVia.Type;

/**
 * Bounded outcome of `yeet job cancel`.
 *
 * **Example** (A stop was requested)
 *
 * ```ts
 * import { ProofJobCancelOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofJobCancelOutcome.Enum["stop-requested"]) // "stop-requested"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofJobCancelOutcome = LiteralKit([
  "stop-requested",
  "already-terminal",
  "unit-absent",
  "stop-failed",
]).pipe(
  $I.annoteSchema("ProofJobCancelOutcome", {
    description:
      "What yeet job cancel did: requested a stop, found the job terminal, found no unit, or failed to stop.",
  })
);

/**
 * Bounded outcome of `yeet job cancel`.
 *
 * **Example** (Inspect the companion domain)
 *
 * ```ts
 * import { ProofJobCancelOutcome } from "@beep/repo-cli/test/Yeet"
 * console.log(ProofJobCancelOutcome.Options.length > 0) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofJobCancelOutcome = typeof ProofJobCancelOutcome.Type;

/**
 * Build the transient unit name for a job id.
 *
 * **Example** (Unit name from a job id)
 *
 * ```ts
 * import { proofJobUnitName } from "@beep/repo-cli/test/Yeet"
 * import { UUID } from "@beep/schema/String"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * console.log(proofJobUnitName(Effect.runSync(S.decodeEffect(UUID)("0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60"))))
 * // "beep-proof-0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.service"
 * ```
 *
 * @param jobId - Stable UUID allocated before starting the transient service.
 * @returns The systemd unit name.
 * @category models
 * @since 0.0.0
 */
export const proofJobUnitName = (jobId: UUID): string => `${PROOF_JOB_UNIT_PREFIX}${jobId}.service`;

export { isProofJobUnitName } from "../../../internal/repo-run/RunScope.schemas.ts";

/**
 * What the job runs: the exact words replayed inside the unit (ruling 35).
 *
 * **Example** (A cheap-gates verify)
 *
 * ```ts
 * import { ProofJobRequest } from "@beep/repo-cli/test/Yeet"
 *
 * const request = ProofJobRequest.make({
 *   mode: "verify",
 *   argv: ["verify", "--tier", "cheap-gates"],
 *   checkout: "/repo",
 *   branch: "feat/x",
 *   base: "main",
 *   head: "0123456789abcdef0123456789abcdef01234567",
 *   forwardedEnvNames: ["PATH", "HOME"],
 * })
 * console.log(request.argv.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobRequest extends S.Class<ProofJobRequest>($I`ProofJobRequest`)(
  {
    mode: YeetRunMode,
    argv: S.Array(S.String),
    checkout: S.NonEmptyString,
    branch: S.NonEmptyString,
    base: S.String,
    head: S.NonEmptyString,
    forwardedEnvNames: S.Array(S.String),
  },
  $I.annote("ProofJobRequest", {
    description:
      "The yeet words replayed inside a job unit (submit-only flags removed), the checkout it runs in, its git coordinates, and the names (never values) of forwarded environment variables.",
  })
) {}

/**
 * Who submitted the job. The process-start identity fences pid reuse the same
 * way admission owners are fenced.
 *
 * **Example** (A submitter with an unverifiable start identity)
 *
 * ```ts
 * import { ProofJobSubmitter } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const submitter = ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() })
 * console.log(submitter.pid) // 4242
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobSubmitter extends S.Class<ProofJobSubmitter>($I`ProofJobSubmitter`)(
  {
    pid: S.Int,
    procStart: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    cwd: S.NonEmptyString,
    harness: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ProofJobSubmitter", {
    description: "Pid, process-start identity, working directory, and optional harness name of the submitting process.",
  })
) {}

/**
 * The transient unit systemd runs the job in, recorded exactly as started so
 * the record is an audit of what ran.
 *
 * **Example** (A unit record)
 *
 * ```ts
 * import { ProofJobUnit } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const unit = ProofJobUnit.make({
 *   unitName: "beep-proof-0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.service",
 *   slice: "agent-runs.slice",
 *   description: "beep-yeet-job id=0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60 mode=verify checkout=/repo",
 *   logPath: "/repo/.beep/yeet/jobs/0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.log",
 *   execStart: ["/opt/bun", "/repo/packages/tooling/tool/cli/src/bin.ts", "yeet", "verify"],
 *   execStopPost: ["/opt/bun", "/repo/packages/tooling/tool/cli/src/bin.ts", "yeet", "job", "finalize", "0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60"],
 *   maxRuntimeSeconds: O.none(),
 *   invocationId: O.none(),
 * })
 * console.log(unit.slice) // "agent-runs.slice"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobUnit extends S.Class<ProofJobUnit>($I`ProofJobUnit`)(
  {
    unitName: S.NonEmptyString,
    slice: S.Literal(PROOF_JOB_SLICE),
    description: S.NonEmptyString,
    logPath: S.NonEmptyString,
    execStart: S.Array(S.String),
    execStopPost: S.Array(S.String),
    maxRuntimeSeconds: S.Int.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    invocationId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ProofJobUnit", {
    description:
      "The transient systemd user service a job runs in: unit name, slice, description, log path, the exact ExecStart and ExecStopPost words, optional RuntimeMaxSec, and the invocation id once known.",
  })
) {}

/**
 * Facts the job's own CLI records when it boots inside the unit.
 *
 * **Example** (A runner before its attempt exists)
 *
 * ```ts
 * import { ProofJobRunner } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const runner = ProofJobRunner.make({ pid: 5150, procStart: O.some("proc:123456"), attemptId: O.none(), startedAt: "2026-09-15T00:00:00.000Z" })
 * console.log(runner.pid) // 5150
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobRunner extends S.Class<ProofJobRunner>($I`ProofJobRunner`)(
  {
    pid: S.Int,
    procStart: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    startedAt: S.String,
  },
  $I.annote("ProofJobRunner", {
    description: "Pid, process-start identity, attempt id, and start time of the CLI running inside the job unit.",
  })
) {}

/**
 * What the job's CLI recorded at normal completion, before the finalizer ran.
 *
 * **Example** (A green outcome)
 *
 * ```ts
 * import { ProofJobOutcome } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const outcome = ProofJobOutcome.make({
 *   verdictOutcome: "success",
 *   verdictPath: O.some("/repo/.beep/yeet/runs/feat_x/verdict.json"),
 *   elapsedMs: O.some(120000),
 *   endedAt: "2026-09-15T00:02:00.000Z",
 * })
 * console.log(outcome.verdictOutcome) // "success"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobOutcome extends S.Class<ProofJobOutcome>($I`ProofJobOutcome`)(
  {
    verdictOutcome: YeetOutcome,
    verdictPath: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    elapsedMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    endedAt: S.String,
  },
  $I.annote("ProofJobOutcome", {
    description:
      "The verdict outcome, verdict artifact path, elapsed time, and end time the job's CLI recorded at normal completion.",
  })
) {}

/**
 * The systemd result triple stamped by the finalizer (ruling 36).
 *
 * **Example** (A SIGKILLed job)
 *
 * ```ts
 * import { ProofJobSystemdResult } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const result = ProofJobSystemdResult.make({
 *   serviceResult: "signal",
 *   exitCode: O.some("killed"),
 *   exitStatus: O.some("KILL"),
 *   invocationId: O.none(),
 *   finalizedAt: "2026-09-15T00:03:00.000Z",
 * })
 * console.log(result.serviceResult) // "signal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobSystemdResult extends S.Class<ProofJobSystemdResult>($I`ProofJobSystemdResult`)(
  {
    serviceResult: ProofJobServiceResult,
    exitCode: ProofJobExitCode.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    exitStatus: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    invocationId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    finalizedAt: S.String,
  },
  $I.annote("ProofJobSystemdResult", {
    description:
      "systemd's SERVICE_RESULT, EXIT_CODE, EXIT_STATUS and INVOCATION_ID as read by the finalizer, plus when it ran.",
  })
) {}

/**
 * One durable job record, `.beep/yeet/jobs/<jobId>.json` (ruling 36).
 *
 * **Details**
 *
 * Phase invariants, enforced by the launcher's transitions rather than by the
 * schema: `submitted` carries no runner, outcome, or systemd result; `running`
 * carries a runner; `finished` carries an outcome (its systemd result arrives
 * with the finalizer); `terminated` carries a termination reason and, except
 * for `finalizer-missing`, a systemd result.
 *
 * **Example** (A freshly submitted record)
 *
 * ```ts
 * import { ProofJobRecord, ProofJobRequest, ProofJobSubmitter, ProofJobUnit } from "@beep/repo-cli/test/Yeet"
 * import { UUID } from "@beep/schema/String"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as O from "effect/Option"
 *
 * const jobId = Effect.runSync(S.decodeEffect(UUID)("0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60"))
 * const record = ProofJobRecord.make({
 *   jobId,
 *   phase: "submitted",
 *   submittedAt: "2026-09-15T00:00:00.000Z",
 *   request: ProofJobRequest.make({ mode: "verify", argv: ["verify"], checkout: "/repo", branch: "feat/x", base: "main", head: "0123456789abcdef0123456789abcdef01234567", forwardedEnvNames: ["PATH"] }),
 *   submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
 *   unit: ProofJobUnit.make({ unitName: "beep-proof-0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.service", slice: "agent-runs.slice", description: "beep-yeet-job", logPath: "/repo/.beep/yeet/jobs/0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.log", execStart: ["/opt/bun"], execStopPost: ["/opt/bun"], maxRuntimeSeconds: O.none(), invocationId: O.none() }),
 *   runner: O.none(),
 *   outcome: O.none(),
 *   systemd: O.none(),
 *   terminationReason: O.none(),
 *   cancelRequestedAt: O.none(),
 * })
 * console.log(record.schemaVersion) // "yeet-proof-job/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobRecord extends S.Class<ProofJobRecord>($I`ProofJobRecord`)(
  {
    schemaVersion: S.Literal(PROOF_JOB_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(PROOF_JOB_SCHEMA_VERSION))
    ),
    jobId: UUID,
    phase: ProofJobPhase,
    submittedAt: S.String,
    request: ProofJobRequest,
    submitter: ProofJobSubmitter,
    unit: ProofJobUnit,
    runner: ProofJobRunner.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    outcome: ProofJobOutcome.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    systemd: ProofJobSystemdResult.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    terminationReason: ProofJobTerminationReason.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    cancelRequestedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ProofJobRecord", {
    description:
      "One detached proof job: identity, phase, request, submitter, unit, runner facts, recorded outcome, systemd result, termination reason, and cancel request.",
  })
) {}

/**
 * Decide the inbox severity of a job's row (ruling 37): `P2` only for a
 * `finished` record whose verdict outcome is `success`.
 *
 * **Example** (A terminated job is P1)
 *
 * ```ts
 * import { proofJobRowSeverityFor } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(proofJobRowSeverityFor("terminated", O.none())) // "P1"
 * console.log(proofJobRowSeverityFor("finished", O.some("success"))) // "P2"
 * ```
 *
 * @param phase - The record's terminal phase.
 * @param verdictOutcome - The recorded verdict outcome when the job finished.
 * @returns P2 for a green verdict, otherwise P1.
 * @category models
 * @since 0.0.0
 */
export const proofJobRowSeverityFor: {
  (verdictOutcome: O.Option<typeof YeetOutcome.Type>): (phase: ProofJobPhase) => ProofJobRowSeverity;
  (phase: ProofJobPhase, verdictOutcome: O.Option<typeof YeetOutcome.Type>): ProofJobRowSeverity;
} = dual(
  2,
  (phase: ProofJobPhase, verdictOutcome: O.Option<typeof YeetOutcome.Type>): ProofJobRowSeverity =>
    ProofJobPhase.is.finished(phase) && O.exists(verdictOutcome, YeetOutcome.is.success)
      ? ProofJobRowSeverity.Enum.P2
      : ProofJobRowSeverity.Enum.P1
);

/**
 * Inbox capsule of a `proof-job-finished` row (ruling 37). Nullable rather
 * than optional so harness adapters can read it with plain `jq`.
 *
 * **Example** (A green job's capsule)
 *
 * ```ts
 * import { YeetProofJobCapsule } from "@beep/repo-cli/test/Yeet"
 * import { UUID } from "@beep/schema/String"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const capsule = YeetProofJobCapsule.make({
 *   jobId: Effect.runSync(S.decodeEffect(UUID)("0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60")),
 *   mode: "verify",
 *   branch: "feat/x",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   unitName: "beep-proof-0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.service",
 *   phase: "finished",
 *   serviceResult: "success",
 *   exitStatus: "0",
 *   verdictOutcome: "success",
 *   terminationReason: null,
 *   elapsedMs: 120000,
 *   logPath: "/repo/.beep/yeet/jobs/0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60.log",
 * })
 * console.log(capsule.verdictOutcome) // "success"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetProofJobCapsule extends S.Class<YeetProofJobCapsule>($I`YeetProofJobCapsule`)(
  {
    jobId: UUID,
    mode: YeetRunMode,
    branch: S.NonEmptyString,
    headSha: S.NonEmptyString,
    unitName: S.NonEmptyString,
    phase: ProofJobPhase,
    serviceResult: ProofJobServiceResult,
    exitStatus: S.NullOr(S.String),
    verdictOutcome: S.NullOr(YeetOutcome),
    terminationReason: S.NullOr(ProofJobTerminationReason),
    elapsedMs: S.NullOr(S.Finite),
    logPath: S.NonEmptyString,
  },
  $I.annote("YeetProofJobCapsule", {
    description:
      "One finished or terminated detached proof job as delivered to the checkout inbox: job, unit, systemd result, verdict or termination reason, elapsed time, and log path.",
  })
) {}

/**
 * Everything `submit` needs beyond the checkout: the request, the submitter,
 * the program words to replay, and the optional runtime ceiling.
 *
 * **Example** (A submission with a runtime ceiling)
 *
 * ```ts
 * import { ProofJobRequest, ProofJobSubmission, ProofJobSubmitter } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const submission = ProofJobSubmission.make({
 *   request: ProofJobRequest.make({ mode: "verify", argv: ["verify"], checkout: "/repo", branch: "feat/x", base: "main", head: "0123456789abcdef0123456789abcdef01234567", forwardedEnvNames: ["PATH"] }),
 *   submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
 *   execPath: "/opt/bun",
 *   entrypoint: "/repo/packages/tooling/tool/cli/src/bin.ts",
 *   maxRuntimeSeconds: O.some(3600),
 * })
 * console.log(submission.entrypoint.endsWith("bin.ts")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobSubmission extends S.Class<ProofJobSubmission>($I`ProofJobSubmission`)(
  {
    request: ProofJobRequest,
    submitter: ProofJobSubmitter,
    execPath: S.NonEmptyString,
    entrypoint: S.NonEmptyString,
    maxRuntimeSeconds: S.Int.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ProofJobSubmission", {
    description:
      "Inputs to submit one detached proof job: request, submitter, the bun binary and CLI entrypoint to replay, and an optional RuntimeMaxSec.",
  })
) {}

/**
 * Options of `wait`: an optional overall timeout and the poll interval.
 *
 * **Example** (Wait at most ten minutes)
 *
 * ```ts
 * import { ProofJobWaitOptions } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const options = ProofJobWaitOptions.make({ timeoutMs: O.some(600000) })
 * console.log(options.pollIntervalMs) // 2000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobWaitOptions extends S.Class<ProofJobWaitOptions>($I`ProofJobWaitOptions`)(
  {
    timeoutMs: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pollIntervalMs: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(2000))),
  },
  $I.annote("ProofJobWaitOptions", {
    description: "Optional overall timeout and poll interval for waiting on a detached proof job.",
  })
) {}

/**
 * What `finalize` did (ruling 36): the stamped record, the inbox row id it
 * appended, whether it appended an attempt-terminated journal row, and whether
 * this call found the job already finalized.
 *
 * **Example** (A duplicate finalize appends nothing)
 *
 * ```ts
 * import { ProofJobFinalization } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof ProofJobFinalization.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofJobFinalization extends S.Class<ProofJobFinalization>($I`ProofJobFinalization`)(
  {
    record: ProofJobRecord,
    inboxRowId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    attemptTerminated: S.Boolean,
    duplicate: S.Boolean,
  },
  $I.annote("ProofJobFinalization", {
    description:
      "Result of finalizing a job: the stamped record, the inbox row id, whether a journal row was appended, and whether the call was a duplicate.",
  })
) {}

/**
 * Remove launcher-only flags while preserving all replayed words.
 *
 * **Example** (Strip a runtime ceiling)
 * ```ts
 * import { stripProofJobSubmitFlags } from "@beep/repo-cli/test/Yeet"
 * console.log(stripProofJobSubmitFlags(["verify", "--detach", "--job-max-runtime=1h"])) // ["verify"]
 * ```
 *
 * @param argv - Original words after the yeet command name.
 * @returns Replay words with launch-only flags removed.
 * @category utilities
 * @since 0.0.0
 */
export const stripProofJobSubmitFlags = (argv: ReadonlyArray<string>): ReadonlyArray<string> => {
  let words: ReadonlyArray<string> = [];
  let skip = false;
  for (const word of argv) {
    if (skip) {
      skip = false;
      continue;
    }
    if (word === "--job-max-runtime") {
      skip = true;
      continue;
    }
    if (word === "--detach" || Str.startsWith("--job-max-runtime=")(word)) continue;
    words = A.append(words, word);
  }
  return words;
};

/**
 * Forward only approved environment names, removing credential-shaped names.
 *
 * **Example** (Exclude a token)
 * ```ts
 * import { forwardedProofJobEnvironment } from "@beep/repo-cli/test/Yeet"
 * console.log(forwardedProofJobEnvironment({ TURBO_TOKEN: "private", PATH: "/bin" })) // { PATH: "/bin" }
 * ```
 *
 * @param env - Submitter environment before name filtering.
 * @returns Approved names and their values for the transient unit.
 * @category environment
 * @since 0.0.0
 */
export const forwardedProofJobEnvironment = (
  env: Readonly<Record<string, string | undefined>>
): Record<string, string> =>
  R.filter(
    env,
    (value, name): value is string =>
      value !== undefined &&
      !isDeniedProofJobEnvName(name) &&
      (A.contains(PROOF_JOB_FORWARDED_ENV_NAMES, name) ||
        A.some(PROOF_JOB_FORWARDED_ENV_PREFIXES, (prefix) => Str.startsWith(prefix)(name)))
  );

const quoteSystemdWord = (word: string): string =>
  '"' +
  Str.replace(
    /\n/gu,
    "\\n"
  )(
    Str.replace(
      /\r/gu,
      "\\r"
    )(
      Str.replace(
        /\$/gu,
        "$$$$"
      )(Str.replace(/%/gu, "%%")(Str.replace(/"/gu, '\\"')(Str.replace(/\\/gu, "\\\\")(word))))
    )
  ) +
  '"';

/**
 * Build systemd-run arguments from the durable unit record and allowed environment.
 *
 * **Example** (Reference the argument builder)
 * ```ts
 * import { proofJobSystemdRunArguments } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof proofJobSystemdRunArguments) // "function"
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const proofJobSystemdRunArguments: {
  (env: Readonly<Record<string, string>>): (record: ProofJobRecord) => ReadonlyArray<string>;
  (record: ProofJobRecord, env: Readonly<Record<string, string>>): ReadonlyArray<string>;
} = dual(
  2,
  (record: ProofJobRecord, env: Readonly<Record<string, string>>): ReadonlyArray<string> => [
    "--user",
    `--unit=${record.unit.unitName}`,
    "--collect",
    "--quiet",
    "--service-type=exec",
    "--expand-environment=no",
    `--slice=${record.unit.slice}`,
    `--working-directory=${record.request.checkout}`,
    `--description=${record.unit.description}`,
    ...A.map(
      R.toEntries({
        ...forwardedProofJobEnvironment(env),
        ...PROOF_JOB_FIXED_ENV,
        BEEP_YEET_JOB_ID: record.jobId,
        BEEP_YEET_JOB_UNIT: record.unit.unitName,
        BEEP_YEET_JOB_LOG: record.unit.logPath,
      }),
      ([name, value]) => `--setenv=${name}=${value}`
    ),
    "-p",
    `ExecStopPost=${A.join(A.map(record.unit.execStopPost, quoteSystemdWord), " ")}`,
    "-p",
    `StandardOutput=append:${record.unit.logPath}`,
    "-p",
    `StandardError=append:${record.unit.logPath}`,
    "-p",
    `TimeoutStopSec=${PROOF_JOB_STOP_TIMEOUT_SECONDS}`,
    ...O.getOrElse(
      O.map(record.unit.maxRuntimeSeconds, (seconds) => ["-p", `RuntimeMaxSec=${seconds}`]),
      () => []
    ),
    "--",
    ...record.unit.execStart,
  ]
);
