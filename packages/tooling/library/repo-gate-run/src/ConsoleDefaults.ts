/**
 * The repo commands the console names: the fix command of a folded cause.
 * Type-only imports keep this leaf free of the report model, so the slim
 * package-check probe can share its build command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Str from "effect/String";
import type { FoldFixes } from "@beep/gate-report/CauseFold";

/**
 * The subject of a run over the whole workspace rather than one package.
 *
 * **Example** (Read the workspace subject)
 *
 * ```ts
 * import { WORKSPACE_SUBJECT } from "@beep/repo-gate-run/ConsoleDefaults";
 *
 * console.log(WORKSPACE_SUBJECT); // workspace
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WORKSPACE_SUBJECT = "workspace";

const isDirectory = (subject: string): boolean => !Str.startsWith("@")(subject) && Str.includes("/")(subject);

const filterOf = (subject: string): string => (isDirectory(subject) ? `./${subject}` : subject);

/**
 * The command that builds the declarations a package's check reads: its
 * upstream build closure, or every package for a workspace run.
 *
 * **Details**
 *
 * A subject that is a package directory rather than a package name (a run
 * whose name was not known) is filtered as a path, `--filter=./<dir>^...`,
 * which selects the same closure as the package name does: Turbo reads a
 * filter as a path only when it starts with `./`.
 *
 * **Example** (Name the fix for a package and for a directory)
 *
 * ```ts
 * import { buildClosureCommand } from "@beep/repo-gate-run/ConsoleDefaults";
 *
 * console.log(buildClosureCommand("@beep/glob")); // bun x turbo run build --filter=@beep/glob^...
 * console.log(buildClosureCommand("packages/glob")); // bun x turbo run build --filter=./packages/glob^...
 * ```
 *
 * @param subject - the run's subject: a package name, a package directory or the workspace
 * @returns the turbo command that builds the declarations the subject's check reads
 * @category utilities
 * @since 0.0.0
 */
export const buildClosureCommand = (subject: string): string =>
  subject === WORKSPACE_SUBJECT ? "bun x turbo run build" : `bun x turbo run build --filter=${filterOf(subject)}^...`;

/**
 * The fix commands of the folding table for a run's subject: TS6305 is fixed
 * by building the subject's upstream declarations.
 *
 * **Example** (Read the TS6305 fix)
 *
 * ```ts
 * import { foldFixesFor } from "@beep/repo-gate-run/ConsoleDefaults";
 *
 * console.log(foldFixesFor("@beep/glob").TS6305); // bun x turbo run build --filter=@beep/glob^...
 * ```
 *
 * @param subject - the run's subject: a package name, a package directory or the workspace
 * @returns the fix command of each folded code, TS6305 today
 * @category utilities
 * @since 0.0.0
 */
export const foldFixesFor = (subject: string): FoldFixes => ({ TS6305: buildClosureCommand(subject) });
