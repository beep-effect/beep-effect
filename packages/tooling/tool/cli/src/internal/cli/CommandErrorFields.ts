/**
 * Shared schema fields and reporting helper for repo-cli command-suite errors.
 *
 * @remarks
 * The `<Group>CommandError` classes in Worktree, Yeet, Graphiti, Quality, and
 * their siblings all carry the same `message` + optional
 * `command` / `exitCode` / `cause` shape and the same
 * `Runtime.errorExitCode` default. {@link commandErrorFields} lets a group
 * adopt that field set by spread without changing its tag or serialized shape,
 * {@link resolveCommandExitCode} centralises the `exitCode ?? 1` default the
 * override applies, and {@link reportCommandError} reproduces the
 * `Console.error` + {@link failWithReportedExit} recovery each command runs
 * inside `Effect.catchTags`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";
import * as S from "effect/Schema";
import { failWithReportedExit } from "./ExitCodeError.ts";

/**
 * Schema fields shared by repo-cli command-suite error classes.
 *
 * @remarks
 * Spread into a `TaggedErrorClass` field definition to inherit the common
 * `message` + optional `command` / `exitCode` / `cause` shape; add
 * group-specific fields (for example `path` or `file`) alongside the spread.
 *
 * @example
 * ```ts
 * import { $RepoCliId } from "@beep/identity/packages"
 * import { TaggedErrorClass } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { commandErrorFields } from "@beep/repo-cli/internal/cli/CommandErrorFields"
 *
 * const $I = $RepoCliId.create("commands/Example/Example.errors")
 *
 * class ExampleCommandError extends TaggedErrorClass<ExampleCommandError>($I`ExampleCommandError`)(
 *   "ExampleCommandError",
 *   { ...commandErrorFields, path: S.optionalKey(S.String) },
 *   $I.annote("ExampleCommandError", { description: "Example failure." })
 * ) {}
 *
 * console.log(ExampleCommandError.make({ message: "boom" }).message)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const commandErrorFields = {
  message: S.String,
  command: S.optionalKey(S.String),
  exitCode: S.optionalKey(S.Finite),
  cause: S.optionalKey(S.Defect({ includeStack: true })),
};

/**
 * Resolve the process exit code for a command error, defaulting to `1`.
 *
 * @param exitCode - The error's optional `exitCode` field.
 * @returns The provided exit code, or `1` when absent.
 * @example
 * ```ts
 * import { resolveCommandExitCode } from "@beep/repo-cli/internal/cli/CommandErrorFields"
 *
 * console.log(resolveCommandExitCode(2))
 * console.log(resolveCommandExitCode(undefined))
 * ```
 * @category runtime
 * @since 0.0.0
 */
export const resolveCommandExitCode = (exitCode: number | undefined): number => exitCode ?? 1;

/**
 * Build a catch handler that prints a prefixed error line and then fails with a
 * silent reported exit.
 *
 * @remarks
 * Reproduces the `Console.error(\`${prefix}: ${error.message}\`)` +
 * {@link failWithReportedExit} pattern each command runs per tag inside
 * `Effect.catchTags`.
 *
 * @param prefix - The command label prepended to the error message.
 * @returns A handler consuming an error with a `message` field.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { reportCommandError } from "@beep/repo-cli/internal/cli/CommandErrorFields"
 *
 * const handler = reportCommandError("version-sync")
 * console.log(Effect.isEffect(handler({ message: "drift detected" })))
 * ```
 * @category runtime
 * @since 0.0.0
 */
export const reportCommandError = (prefix: string) =>
  Effect.fnUntraced(function* (error: { readonly message: string }) {
    const line = `${prefix}: ${error.message}`;
    yield* Console.error(line);
    return yield* failWithReportedExit(line);
  });
