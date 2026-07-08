/**
 * Graphiti subprocess helpers built on the shared repo CLI process runner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem } from "effect";
import { formatCommandLine, QualityTaskStep, runCaptured, runToExit } from "../../../internal/process/index.js";
import { GraphitiProxyOpsError } from "../Graphiti.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ProxyEnsureConfig } from "../Graphiti.schemas.js";

/**
 * Render a command and argv exactly as the Graphiti progress messages expect.
 *
 * @example
 * ```ts
 * import { commandText } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 *
 * const text = commandText("docker", ["compose", "ps"])
 * console.log(text) // docker compose ps
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const commandText = formatCommandLine;

/**
 * Quote a string for POSIX shell interpolation.
 *
 * @param value - The raw string to wrap in single quotes and escape.
 * @returns The single-quoted, shell-safe form of `value`.
 * @example
 * ```ts
 * import { shellQuote } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 *
 * console.log(shellQuote("it's ok"))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const shellQuote = (value: string): string => `'${Str.replaceAll("'", "'\"'\"'")(value)}'`;

/**
 * Capture a Graphiti subprocess step with combined output trimmed.
 *
 * @param step - The quality task step describing the command, args, and cwd to run.
 * @returns An Effect yielding the step's exit code and its trimmed combined output.
 * @example
 * ```ts
 * import { collectStepOutput } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 * import { QualityTaskStep } from "@beep/repo-cli/internal/process"
 *
 * const result = collectStepOutput(QualityTaskStep.make({ label: "version", command: "docker", args: ["--version"], cwd: "/repo" }))
 * console.log(result.pipe !== undefined)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const collectStepOutput = (step: QualityTaskStep) =>
  runCaptured({
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    source: "all",
    trim: true,
  }).pipe(Effect.map(({ exitCode, output }) => ({ exitCode, output })));

/**
 * Capture a step and convert a nonzero exit into a Graphiti ops error.
 *
 * @param step - The quality task step to run and capture.
 * @returns An Effect yielding the captured output, failing with a
 * `GraphitiProxyOpsError` when the step exits nonzero.
 * @example
 * ```ts
 * import { collectSuccessfulOutput } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 * import { QualityTaskStep } from "@beep/repo-cli/internal/process"
 *
 * const output = collectSuccessfulOutput(QualityTaskStep.make({ label: "which", command: "which", args: ["bun"], cwd: "/repo" }))
 * console.log(output.pipe !== undefined)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const collectSuccessfulOutput = Effect.fn("GraphitiProxyOps.collectSuccessfulOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<string, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectStepOutput(step).pipe(
    GraphitiProxyOpsError.mapError(`Failed to run ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );
  if (result.exitCode !== 0) {
    return yield* GraphitiProxyOpsError.make({
      message: `${step.label} failed with exit code ${result.exitCode}.`,
      command: commandText(step.command, step.args),
      exitCode: result.exitCode,
    });
  }
  return result.output;
});

/**
 * Run a Graphiti subprocess step with inherited stdio.
 *
 * @param step - The quality task step to spawn with inherited stdin/stdout/stderr.
 * @returns An Effect that completes when the step exits zero and fails with a
 * `GraphitiProxyOpsError` on spawn failure or a nonzero exit.
 * @example
 * ```ts
 * import { runInheritedStep } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 * import { QualityTaskStep } from "@beep/repo-cli/internal/process"
 *
 * const program = runInheritedStep(QualityTaskStep.make({ label: "status", command: "systemctl", args: ["--user", "status", "demo"], cwd: "/repo" }))
 * console.log(program.pipe !== undefined)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runInheritedStep = Effect.fn("GraphitiProxyOps.runInheritedStep")(function* (
  step: QualityTaskStep
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[graphiti-proxy] ${step.label}: ${commandText(step.command, step.args)}`);
  const exitCode = yield* runToExit({
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    env: step.env,
    extendEnv: true,
    stdin: "inherit",
    stdio: "inherit",
  }).pipe(
    GraphitiProxyOpsError.mapError(`Failed to spawn ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );

  if (exitCode !== 0) {
    return yield* GraphitiProxyOpsError.make({
      message: `${step.label} failed with exit code ${exitCode}.`,
      command: commandText(step.command, step.args),
      exitCode,
    });
  }
});

/**
 * Probe the ensure-loop health endpoint from its resolved config.
 *
 * @param config - The resolved ensure-loop config supplying the `healthUrl` to probe.
 * @returns An Effect yielding `true` when the proxy health endpoint responds healthy.
 * @example
 * ```ts
 * import { checkProxyHealth } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(checkProxyHealth)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category execution
 * @since 0.0.0
 */
export const checkProxyHealth = Effect.fn("GraphitiProxyOps.checkProxyHealth")(function* (
  config: ProxyEnsureConfig
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* checkProxyHealthUrl(config.healthUrl);
});

/**
 * Probe an arbitrary Graphiti proxy health URL with curl.
 *
 * @param healthUrl - The health endpoint URL to probe with a 2-second curl timeout.
 * @returns An Effect yielding `true` when curl exits zero, `false` otherwise.
 * @example
 * ```ts
 * import { checkProxyHealthUrl } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 *
 * const healthy = checkProxyHealthUrl("http://127.0.0.1:8123/healthz")
 * console.log(healthy.pipe !== undefined)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const checkProxyHealthUrl = Effect.fn("GraphitiProxyOps.checkProxyHealthUrl")(function* (
  healthUrl: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const exitCode = yield* runToExit({
    command: "curl",
    args: ["-fsS", "-m", "2", healthUrl],
    stdio: "ignore",
  }).pipe(Effect.orElseSucceed(() => 1));

  return exitCode === 0;
});

/**
 * Capture a best-effort subprocess step.
 *
 * @param step - The quality task step to run without failing on error.
 * @returns An Effect yielding the step's exit code and output, falling back to
 * exit code `1` and empty output when the step fails.
 * @example
 * ```ts
 * import { collectOptionalOutput } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 * import { QualityTaskStep } from "@beep/repo-cli/internal/process"
 *
 * const result = collectOptionalOutput(QualityTaskStep.make({ label: "inspect", command: "docker", args: ["inspect", "missing"], cwd: "/repo" }))
 * console.log(result.pipe !== undefined)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const collectOptionalOutput = (step: QualityTaskStep) =>
  collectStepOutput(step).pipe(
    Effect.orElseSucceed(() => ({
      exitCode: 1,
      output: "",
    }))
  );

/**
 * Require a filesystem path to exist for Graphiti preflight checks.
 *
 * @param targetPath - The filesystem path that must exist.
 * @param label - Human-readable label for `targetPath` used in the failure message.
 * @returns An Effect that succeeds when the path exists and fails with a
 * `GraphitiProxyOpsError` when it does not.
 * @example
 * ```ts
 * import { requireExistingPath } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 *
 * const check = requireExistingPath("/tmp", "temporary directory")
 * console.log(check.pipe !== undefined)
 * ```
 * @category assertions
 * @since 0.0.0
 */
export const requireExistingPath = Effect.fn("GraphitiProxyOps.requireExistingPath")(function* (
  targetPath: string,
  label: string
): Effect.fn.Return<void, GraphitiProxyOpsError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(targetPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return yield* GraphitiProxyOpsError.make({
      message: `${label} was not found at ${targetPath}.`,
      exitCode: 1,
    });
  }
});

/**
 * Test whether docker can be invoked from the repo root.
 *
 * @param repoRoot - The repo root directory to use as the working directory for `docker --version`.
 * @returns An Effect yielding `true` when `docker --version` exits zero.
 * @example
 * ```ts
 * import { dockerAvailable } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 *
 * const available = dockerAvailable("/repo")
 * console.log(available.pipe !== undefined)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const dockerAvailable = Effect.fn("GraphitiProxyOps.dockerAvailable")(function* (
  repoRoot: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectOptionalOutput(
    QualityTaskStep.make({
      label: "graphiti-recover:docker-version",
      command: "docker",
      args: ["--version"],
      cwd: repoRoot,
    })
  );
  return result.exitCode === 0;
});

/**
 * Fail when docker is unavailable for restore or verify.
 *
 * @param repoRoot - The repo root directory used to probe docker availability.
 * @returns An Effect that succeeds when docker is available and fails with a
 * `GraphitiProxyOpsError` when it is not.
 * @example
 * ```ts
 * import { dockerRequired } from "@beep/repo-cli/commands/Graphiti/internal/StepExec"
 *
 * const check = dockerRequired("/repo")
 * console.log(check.pipe !== undefined)
 * ```
 * @category assertions
 * @since 0.0.0
 */
export const dockerRequired = Effect.fn("GraphitiProxyOps.dockerRequired")(function* (
  repoRoot: string
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  if (yield* dockerAvailable(repoRoot)) {
    return;
  }
  return yield* GraphitiProxyOpsError.make({
    message: "docker is unavailable; cannot restore or verify the Graphiti stack.",
    exitCode: 1,
  });
});
