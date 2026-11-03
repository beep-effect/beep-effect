// Frozen at 8602b24203: observation helpers and replayed wire decoders only.
// Imports rebased; runGitOutput and its private callees inlined because W7 retires that runner.

import { formatCommandLine, repoRunOutputBound, runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  GoalRuleEnforcement,
  GoalRuleEvaluationResult,
  GoalRuleSuiteResult,
} from "../../../../packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts";
import { GhBranchRule } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Settle.ts";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { ghOutput } from "../../../../packages/tooling/tool/cli/src/internal/github/index.ts";
import type { RunCapturedOptions } from "@beep/repo-cli-kit/process/StepExec";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

class GoalCompletionIo extends Context.Service<
  GoalCompletionIo,
  {
    readonly git: (root: string, args: ReadonlyArray<string>) => Effect.Effect<string, YeetCommandError>;
    readonly github: (root: string, args: ReadonlyArray<string>) => Effect.Effect<string, YeetCommandError>;
  }
>()("frozen-w7b/GoalCompletionIo") {}
const gitAdapter = {
  onSpawnFailure: (command: string) => (_cause: unknown) => YeetCommandError.make({ message: `Cannot run ${command}` }),
  onNonZeroExit: ({ commandLine }: { readonly commandLine: string }) =>
    YeetCommandError.make({ message: `${commandLine} failed` }),
  onTruncated: O.none<(command: string) => YeetCommandError>(),
};

/**
 * Runs one read-only git command through the provided port, or the repository git adapter.
 *
 * **Example** (Inspect the git reader)
 *
 * ```ts
 * import { readGoalCompletionGit } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletionGit)
 * ```
 *
 * @category queries
 * @since 0.0.0
 *
 * Import repoint only: StepExec/JsonCodec moved to `@beep/repo-cli-kit` (#2669, beep-cli-composition W3).
 */
export const readGoalCompletionGit = Effect.fn("Goals.Completion.git")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const io = yield* Effect.serviceOption(GoalCompletionIo);
  return yield* O.isSome(io) ? io.value.git(root, args) : runGitOutput(root, args, gitAdapter);
});

/**
 * Runs one read-only GitHub request through the provided port, or the `gh` adapter.
 *
 * **Example** (Inspect the GitHub reader)
 *
 * ```ts
 * import { readGoalCompletionGithub } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletionGithub)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletionGithub = Effect.fn("Goals.Completion.github")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const io = yield* Effect.serviceOption(GoalCompletionIo);
  return yield* O.isSome(io)
    ? io.value.github(root, args)
    : ghOutput({
        cwd: root,
        args,
        label: "goal completion GitHub observation",
        onFailure: (failure) => YeetCommandError.make({ message: `${failure.label}: ${failure._tag}` }),
      });
});

/**
 * Reads one GitHub request and decodes its JSON body; a decode failure is a typed read failure.
 *
 * **Example** (Inspect the JSON reader)
 *
 * ```ts
 * import { readGoalCompletionJson } from "@beep/repo-cli/commands/Goals/CompletionEvidence"
 * console.log(typeof readGoalCompletionJson)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCompletionJson = Effect.fn("Goals.Completion.readJson")(function* <
  Sch extends S.Codec<unknown, unknown>,
>(root: string, args: ReadonlyArray<string>, schema: Sch) {
  const text = yield* readGoalCompletionGithub(root, args);
  return yield* JsonStringCodec(schema)
    .decode(text)
    .pipe(Effect.mapError(() => YeetCommandError.make({ message: "Invalid goal completion GitHub payload" })));
});

const RulesetListEntry = S.Struct({
  id: S.Int,
  source_type: S.String,
  created_at: S.optionalKey(S.DateTimeUtcFromString),
});
export const RulesetList = RulesetListEntry.pipe(S.Array, S.Array);
export const RulesetHistory = S.Struct({ version_id: S.Int, updated_at: S.DateTimeUtcFromString }).pipe(
  S.Array,
  S.Array
);
export const RulesetVersion = S.Struct({
  state: S.Struct({
    enforcement: S.String,
    target: S.String,
    conditions: S.Struct({ ref_name: S.Struct({ include: S.Array(S.String), exclude: S.Array(S.String) }) }),
    rules: S.Array(GhBranchRule),
  }),
});
export const RuleSuiteList = S.Struct({ id: S.Int, ref: S.String, after_sha: S.String }).pipe(S.Array, S.Array);
const RuleEvaluation = S.Struct({
  rule_source: S.Struct({
    type: S.NonEmptyString,
    id: S.OptionFromOptionalNullOr(S.Int),
    name: S.OptionFromOptionalNullOr(S.String),
  }),
  enforcement: GoalRuleEnforcement,
  result: GoalRuleEvaluationResult,
  rule_type: S.NonEmptyString,
});
export const RuleSuite = S.Struct({
  id: S.Int,
  ref: S.NonEmptyString,
  after_sha: S.NonEmptyString,
  pushed_at: S.DateTimeUtcFromString,
  result: GoalRuleSuiteResult,
  rule_evaluations: S.Array(RuleEvaluation),
});

type GitCaptureOutcome = {
  readonly exitCode: number;
  readonly parsed: string;
  readonly failureOutput: string;
  readonly truncated: boolean;
};

const runGitCaptured = <E>(
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  capture: Omit<RunCapturedOptions, "command" | "args">
): Effect.Effect<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> => {
  const commandLine = formatCommandLine("git", args);
  return runCaptured({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.output,
          failureOutput: captured.output,
          truncated: captured.truncated,
        },
        commandLine,
        adapter
      )
    )
  );
};

const failFromOutcome = <E>(
  outcome: GitCaptureOutcome,
  commandLine: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E> => {
  if (outcome.exitCode !== 0) {
    return Effect.fail(
      adapter.onNonZeroExit({ commandLine, exitCode: outcome.exitCode, output: outcome.failureOutput })
    );
  }
  return O.match(adapter.onTruncated, {
    onNone: () => Effect.succeed(outcome.parsed),
    onSome: (toError) => (outcome.truncated ? Effect.fail(toError(commandLine)) : Effect.succeed(outcome.parsed)),
  });
};

export const runGitOutput = Effect.fn("GitExec.runGitOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitCaptured(args, adapter, {
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  });
});
