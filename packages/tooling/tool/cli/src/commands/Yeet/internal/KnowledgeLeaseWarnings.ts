/**
 * Knowledge-doctor lease warnings for Yeet's verify step.
 *
 * A passing verification runs `bun run beep knowledge doctor leases --json` and prints one warning per
 * debt lease that is expiring within seven days, expired, or breaking a lease rule. The step never
 * fails the proof: an unreadable lease report is itself one warning line, because the knowledge
 * doctor's own gate owns the blocking decision.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { runCapturedStreams } from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { decodeKnowledgeLeasesReportJson, knowledgeLeaseWarnings } from "../../Knowledge/KnowledgeDoctor.leases.ts";

/**
 * The command the verify step runs to read the lease report.
 *
 * **Example** (Read the command)
 *
 * ```ts
 * import { KNOWLEDGE_LEASES_COMMAND } from "@beep/repo-cli/commands/Yeet/internal/KnowledgeLeaseWarnings"
 *
 * console.log(KNOWLEDGE_LEASES_COMMAND.join(" ")) // "bun run beep knowledge doctor leases --json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_LEASES_COMMAND: ReadonlyArray<string> = [
  "bun",
  "run",
  "beep",
  "knowledge",
  "doctor",
  "leases",
  "--json",
];

const lastLine = flow(Str.split(/\r?\n/u), A.map(Str.trim), A.filter(Str.isNonEmpty), A.last);

/**
 * Turns the lease command's exit code and stdout into the warning lines yeet prints.
 *
 * **Details**
 *
 * The report is the last non-empty stdout line. A non-zero exit or an undecodable report becomes one
 * warning that says the leases could not be read; it never fails the caller.
 *
 * **Example** (An empty lease report warns about nothing)
 *
 * ```ts
 * import { knowledgeLeaseWarningLines } from "@beep/repo-cli/commands/Yeet/internal/KnowledgeLeaseWarnings"
 * import * as Effect from "effect/Effect"
 *
 * const stdout =
 *   '{"schemaVersion":"knowledge-doctor-leases-report/v1","tree":"1111111111111111111111111111111111111111","mergeBase":"2222222222222222222222222222222222222222","now":"2026-10-14T00:00:00.000Z","leases":[]}'
 *
 * console.log(Effect.runSync(knowledgeLeaseWarningLines(0, stdout))) // []
 * ```
 *
 * @param exitCode - Exit code of `knowledge doctor leases --json`.
 * @param stdout - Its standard output.
 * @returns The warning lines, without the `[yeet]` prefix.
 * @category formatting
 * @since 0.0.0
 */
export const knowledgeLeaseWarningLines = Effect.fn("Yeet.knowledgeLeaseWarningLines")(function* (
  exitCode: number,
  stdout: string
) {
  if (exitCode !== 0) {
    return [`knowledge leases could not be read (exit ${exitCode}); run \`bun run beep knowledge doctor leases\`.`];
  }
  const decoded = yield* decodeKnowledgeLeasesReportJson(O.getOrElse(lastLine(stdout), () => "")).pipe(Effect.result);
  return Result.match(decoded, {
    onFailure: () => ["knowledge leases could not be read: the lease report did not decode."],
    onSuccess: knowledgeLeaseWarnings,
  });
});

/**
 * Prints the knowledge-doctor lease warnings for one checkout; never fails.
 *
 * **Example** (Warning is effectful)
 *
 * ```ts
 * import { warnKnowledgeLeases } from "@beep/repo-cli/commands/Yeet/internal/KnowledgeLeaseWarnings"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(warnKnowledgeLeases("/repo"))) // true
 * ```
 *
 * @param repoRoot - Checkout whose leases are read.
 * @returns An effect that logs zero or more `[yeet] warning:` lines.
 * @category use-cases
 * @since 0.0.0
 */
export const warnKnowledgeLeases = Effect.fn("Yeet.warnKnowledgeLeases")(function* (repoRoot: string) {
  const [command = "bun", ...args] = KNOWLEDGE_LEASES_COMMAND;
  const result = yield* runCapturedStreams({ command, args, cwd: repoRoot, extendEnv: true }).pipe(Effect.result);
  const lines = yield* Result.match(result, {
    onFailure: () => Effect.succeed(["knowledge leases could not be read: the lease command did not start."]),
    onSuccess: (captured) => knowledgeLeaseWarningLines(captured.exitCode, captured.stdout),
  });
  yield* Effect.forEach(lines, (line) => Console.error(`[yeet] warning: ${line}`), { discard: true });
});
