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
 * **Example** (Custom JSON flag description)
 *
 * ```ts
 * import { jsonFlagWith } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = jsonFlagWith("Emit the report as JSON")
 * console.log(flag.kind) // "flag"
 * ```
 *
 * @param description - Help text for the flag.
 * @returns A boolean `--json` flag.
 * @category flags
 * @since 0.0.0
 */
export const jsonFlagWith = (description: string) => Flag.boolean("json").pipe(Flag.withDescription(description));

/**
 * Standard `--json` flag used by commands that support machine-readable output.
 *
 * **Example** (Standard JSON flag kind)
 *
 * ```ts
 * import { jsonFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(jsonFlag.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const jsonFlag = jsonFlagWith("Emit machine-readable JSON output");

/**
 * `--package` / `-p` flag selecting a workspace package.
 *
 * **Example** (Package flag kind check)
 *
 * ```ts
 * import { packageFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(packageFlag().kind) // "flag"
 * ```
 *
 * @param description - Help text; defaults to the workspace-selector wording.
 * @returns A string `--package` flag with the `p` alias.
 * @category flags
 * @since 0.0.0
 */
export const packageFlag = (description = "Target a workspace package by name or repo-relative path") =>
  Flag.string("package").pipe(Flag.withAlias("p"), Flag.withDescription(description));

/**
 * `--output` / `-o` flag selecting an output file path.
 *
 * **Example** (Output flag kind check)
 *
 * ```ts
 * import { outputFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(outputFlag().kind) // "flag"
 * ```
 *
 * @param description - Help text; defaults to the output-path wording.
 * @returns A string `--output` flag with the `o` alias.
 * @category flags
 * @since 0.0.0
 */
export const outputFlag = (description = "Write output to a specific file path") =>
  Flag.string("output").pipe(Flag.withAlias("o"), Flag.withDescription(description));

/**
 * `--verbose` flag toggling additional diagnostic output.
 *
 * **Example** (Verbose flag kind check)
 *
 * ```ts
 * import { verboseFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(verboseFlag().kind) // "flag"
 * ```
 *
 * @param description - Help text; defaults to the diagnostic-output wording.
 * @returns A boolean `--verbose` flag.
 * @category flags
 * @since 0.0.0
 */
export const verboseFlag = (description = "Print additional diagnostic output") =>
  Flag.boolean("verbose").pipe(Flag.withDescription(description));

/**
 * `--dry-run` flag previewing changes without writing.
 *
 * **Example** (Dry-run flag kind check)
 *
 * ```ts
 * import { dryRunFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(dryRunFlag().kind) // "flag"
 * ```
 *
 * @param description - Help text; defaults to the preview wording.
 * @returns A boolean `--dry-run` flag.
 * @category flags
 * @since 0.0.0
 */
export const dryRunFlag = (description = "Preview changes without writing files") =>
  Flag.boolean("dry-run").pipe(Flag.withDescription(description));

/**
 * `--force` flag permitting destructive overwrites.
 *
 * **Example** (Force flag kind check)
 *
 * ```ts
 * import { forceFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(forceFlag().kind) // "flag"
 * ```
 *
 * @param description - Help text; defaults to the overwrite wording.
 * @returns A boolean `--force` flag.
 * @category flags
 * @since 0.0.0
 */
export const forceFlag = (description = "Overwrite existing output") =>
  Flag.boolean("force").pipe(Flag.withDescription(description));

/**
 * Split a comma-separated flag value, trimming entries and dropping empties.
 *
 * **Details**
 *
 * Re-exports `Text.splitCommaSeparatedTrimmed`, which the fallow-quality and
 * yeet fallow-feedback adapters each open-code as `csvValues`.
 *
 * **Example** (Trim and drop empties)
 *
 * ```ts
 * import { csvValues } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(csvValues(" a , b , , c ")) // ["a", "b", "c"]
 * ```
 *
 * @category coercion
 * @since 0.0.0
 */
export const csvValues: (value: string) => ReadonlyArray<string> = Text.splitCommaSeparatedTrimmed;

/**
 * Split a comma-separated flag value into trimmed, lowercased, non-empty
 * tokens.
 *
 * **Example** (Lowercase trimmed tokens)
 *
 * ```ts
 * import { normalizedTokens } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(normalizedTokens(" Renovate , DEPENDABOT ")) // ["renovate", "dependabot"]
 * ```
 *
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
 * **Example** (Filter string entries only)
 *
 * ```ts
 * import { variadicStrings } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(variadicStrings(["a", 1, "b", null])) // ["a", "b"]
 * ```
 *
 * @category coercion
 * @since 0.0.0
 */
export const variadicStrings: (values: ReadonlyArray<unknown>) => ReadonlyArray<string> = A.filter(P.isString);
