/**
 * Shared flag helpers and argument coercions for repo-cli command adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, flow, P, Str, Text } from "@beep/utils";
import { Flag } from "effect/unstable/cli";

/**
 * `--json` flag with a caller-supplied description.
 *
 * @param description - Help text for the flag.
 * @returns A boolean `--json` flag.
 * @example
 * ```ts
 * import { jsonFlagWith } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = jsonFlagWith("Emit the report as JSON")
 * console.log(flag.kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const jsonFlagWith = (description: string) => Flag.boolean("json").pipe(Flag.withDescription(description));

/**
 * Standard `--json` flag used by commands that support machine-readable output.
 *
 * @example
 * ```ts
 * import { jsonFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(jsonFlag.kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const jsonFlag = jsonFlagWith("Emit machine-readable JSON output");

/**
 * `--package` / `-p` flag selecting a workspace package.
 *
 * @param description - Help text; defaults to the workspace-selector wording.
 * @returns A string `--package` flag with the `p` alias.
 * @example
 * ```ts
 * import { packageFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(packageFlag().kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const packageFlag = (description = "Target a workspace package by name or repo-relative path") =>
  Flag.string("package").pipe(Flag.withAlias("p"), Flag.withDescription(description));

/**
 * `--output` / `-o` flag selecting an output file path.
 *
 * @param description - Help text; defaults to the output-path wording.
 * @returns A string `--output` flag with the `o` alias.
 * @example
 * ```ts
 * import { outputFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(outputFlag().kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const outputFlag = (description = "Write output to a specific file path") =>
  Flag.string("output").pipe(Flag.withAlias("o"), Flag.withDescription(description));

/**
 * `--verbose` flag toggling additional diagnostic output.
 *
 * @param description - Help text; defaults to the diagnostic-output wording.
 * @returns A boolean `--verbose` flag.
 * @example
 * ```ts
 * import { verboseFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(verboseFlag().kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const verboseFlag = (description = "Print additional diagnostic output") =>
  Flag.boolean("verbose").pipe(Flag.withDescription(description));

/**
 * `--dry-run` flag previewing changes without writing.
 *
 * @param description - Help text; defaults to the preview wording.
 * @returns A boolean `--dry-run` flag.
 * @example
 * ```ts
 * import { dryRunFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(dryRunFlag().kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const dryRunFlag = (description = "Preview changes without writing files") =>
  Flag.boolean("dry-run").pipe(Flag.withDescription(description));

/**
 * `--force` flag permitting destructive overwrites.
 *
 * @param description - Help text; defaults to the overwrite wording.
 * @returns A boolean `--force` flag.
 * @example
 * ```ts
 * import { forceFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(forceFlag().kind) // "flag"
 * ```
 * @category flags
 * @since 0.0.0
 */
export const forceFlag = (description = "Overwrite existing output") =>
  Flag.boolean("force").pipe(Flag.withDescription(description));

/**
 * Split a comma-separated flag value, trimming entries and dropping empties.
 *
 * @remarks
 * Re-exports `Text.splitCommaSeparatedTrimmed`, which the fallow-quality and
 * yeet fallow-feedback adapters each open-code as `csvValues`.
 *
 * @example
 * ```ts
 * import { csvValues } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(csvValues(" a , b , , c ")) // ["a", "b", "c"]
 * ```
 * @category coercion
 * @since 0.0.0
 */
export const csvValues: (value: string) => ReadonlyArray<string> = Text.splitCommaSeparatedTrimmed;

/**
 * Split a comma-separated flag value into trimmed, lowercased, non-empty
 * tokens.
 *
 * @example
 * ```ts
 * import { normalizedTokens } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(normalizedTokens(" Renovate , DEPENDABOT ")) // ["renovate", "dependabot"]
 * ```
 * @category coercion
 * @since 0.0.0
 */
export const normalizedTokens: (value: string) => ReadonlyArray<string> = flow(
  Str.split(","),
  A.map(flow(Str.trim, Str.toLowerCase)),
  A.filter(Str.isNonEmpty)
);

/**
 * Keep only the string entries of a variadic argument array.
 *
 * @example
 * ```ts
 * import { variadicStrings } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(variadicStrings(["a", 1, "b", null])) // ["a", "b"]
 * ```
 * @category coercion
 * @since 0.0.0
 */
export const variadicStrings: (values: ReadonlyArray<unknown>) => ReadonlyArray<string> = A.filter(P.isString);
