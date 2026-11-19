/**
 * The repo commands the console names: the fix command of a folded cause.
 * Type-only imports keep this leaf free of the report model, so the slim
 * package-check probe can share its build command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
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

/**
 * The command that builds the declarations a package's check reads: its
 * upstream build closure, or every package for a workspace run.
 *
 * **Example** (Name the fix for one package)
 *
 * ```ts
 * import { buildClosureCommand } from "@beep/repo-gate-run/ConsoleDefaults";
 *
 * console.log(buildClosureCommand("@beep/glob")); // bun x turbo run build --filter=@beep/glob^...
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const buildClosureCommand = (subject: string): string =>
  subject === WORKSPACE_SUBJECT ? "bun x turbo run build" : `bun x turbo run build --filter=${subject}^...`;

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
 * @category utilities
 * @since 0.0.0
 */
export const foldFixesFor = (subject: string): FoldFixes => ({ TS6305: buildClosureCommand(subject) });
