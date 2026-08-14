/**
 * Codex agent helper commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Effect, Stream } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";
import { printLines } from "../../internal/cli/Printer.ts";
import { CodexCommandError } from "./Codex.errors.ts";
import { findingsCommand } from "./Findings.command.ts";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

const textEncoder = new TextEncoder();

const defaultInitiativeSummary =
  "Infer the initiative being closed from the current branch, git status, and changed surface.";

const qualityReviewPrompt = (initiativeSummary: string): string => `Use $quality-review-fix-loop.

Initiative summary:
${initiativeSummary}

Start by inspecting the current git state and changed surface. Follow the
repo-local skill exactly. Do not push, open a PR, reply to GitHub review
threads, or publish anything unless the user explicitly requested that in the
initiative summary.
`;

/**
 * Launch Codex with the repo-local quality review fix loop prompt.
 *
 * **Example** (Closing the current initiative)
 *
 * ```ts
 * import { runCodexQualityReviewFixLoop } from "@beep/repo-cli/commands/Codex"
 *
 * const program = runCodexQualityReviewFixLoop(["close", "current", "initiative"])
 *
 * console.log(typeof program) // "object"
 * ```
 *
 * @param summaryParts - Optional initiative summary words.
 * @returns Effect that runs `codex exec`.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodexQualityReviewFixLoop = Effect.fn("Codex.runCodexQualityReviewFixLoop")(function* (
  summaryParts: ReadonlyArray<string>
): Effect.fn.Return<void, CodexCommandError, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
  const repoRoot = yield* findRepoRoot().pipe(CodexCommandError.mapError("Failed to locate repository root."));
  const initiativeSummary = A.isReadonlyArrayEmpty(summaryParts) ? defaultInitiativeSummary : A.join(summaryParts, " ");
  const prompt = qualityReviewPrompt(initiativeSummary);
  const exitCode = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("codex", ["exec", "--cd", repoRoot, "-"], {
        cwd: repoRoot,
        stdin: Stream.make(textEncoder.encode(prompt)),
        stdout: "inherit",
        stderr: "inherit",
      });

      return yield* handle.exitCode;
    })
  ).pipe(CodexCommandError.mapError("Failed to spawn codex quality-review-fix-loop."));

  if (exitCode !== 0) {
    return yield* CodexCommandError.make({
      message: `codex quality-review-fix-loop failed with exit code ${exitCode}.`,
      exitCode,
    });
  }
});

const qualityReviewFixLoopCommand = Command.make(
  "quality-review-fix-loop",
  {
    summary: Argument.string("summary").pipe(Argument.variadic),
  },
  ({ summary }) => runCodexQualityReviewFixLoop(summary as ReadonlyArray<string>)
).pipe(Command.withDescription("Run Codex with the repo quality-review-fix-loop skill"));

/**
 * Codex helper command group.
 *
 * **Example** (Reading the command name)
 *
 * ```ts
 * import { codexCommand } from "@beep/repo-cli/commands/Codex"
 *
 * console.log(codexCommand.name) // "codex"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const codexCommand = Command.make("codex", {}, () =>
  printLines([
    "Codex commands:",
    "- bun run beep codex quality-review-fix-loop",
    "- bun run beep codex findings ingest --from <export.csv>",
    "- bun run beep codex findings ingest --refresh --from <full-export.csv>",
  ])
).pipe(
  Command.withDescription("Codex agent helper commands"),
  Command.withSubcommands([qualityReviewFixLoopCommand, findingsCommand])
);
