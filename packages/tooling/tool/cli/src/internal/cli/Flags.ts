/**
 * Shared flag helpers and argument coercions for repo-cli command adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, flow, P, Str, Text } from "@beep/utils";
import { Config } from "effect";
import { Flag } from "effect/unstable/cli";

/**
 * `--json` flag with a caller-supplied description.
 *
 * **When to use**
 *
 * Use when a command's JSON output needs wording specific to what it emits.
 * Commands that just want the standard flag should reach for {@link jsonFlag}
 * instead of re-describing it.
 *
 * **Details**
 *
 * The description is the text that appears beside `--json` in generated `--help`
 * output; the flag name and boolean type are fixed, so every command's JSON
 * switch is spelled the same way regardless of how it is described.
 *
 * **Example** (Describing the JSON output of one command)
 *
 * ```ts
 * import { jsonFlagWith } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = jsonFlagWith("Emit the doctor report as JSON")
 *
 * console.log(flag.kind) // "flag"
 * console.log(flag._tag) // "Single"
 * ```
 *
 * @see {@link jsonFlag} for the shared flag most commands should use.
 * @category flags
 * @since 0.0.0
 */
export const jsonFlagWith = (description: string) =>
  Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription(description));

/**
 * Standard `--json` flag used by commands that support machine-readable output.
 *
 * **Details**
 *
 * A shared value rather than a factory, so every command that opts into JSON
 * output presents identical help text. That uniformity is the point: `--json`
 * means the same thing everywhere in the CLI.
 *
 * **Example** (Adding the standard JSON switch to a command)
 *
 * ```ts
 * import { jsonFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(jsonFlag.kind) // "flag"
 * console.log(jsonFlag._tag) // "Single"
 * ```
 *
 * @see {@link jsonFlagWith} for a command that needs its own wording.
 * @category flags
 * @since 0.0.0
 */
export const jsonFlag = jsonFlagWith("Emit machine-readable JSON output");

/**
 * Environment variable that carries the AI metrics data root.
 *
 * **Details**
 *
 * Named once here because both the `ai-metrics` and `agent-effectiveness`
 * command groups read the same store, and the string appears in help text as
 * well as in the flag's config fallback.
 *
 * **Example** (Naming the environment rung in help text)
 *
 * ```ts
 * import { aiMetricsDataRootEnvVar } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(aiMetricsDataRootEnvVar) // BEEP_AI_METRICS_DATA_ROOT
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const aiMetricsDataRootEnvVar = "BEEP_AI_METRICS_DATA_ROOT";

/**
 * Optional `--data-root` flag with the AI metrics environment rung beneath it.
 *
 * **Details**
 *
 * Shared by every command group that reads the AI metrics store, so the flag,
 * its environment fallback, and its help text cannot drift apart between
 * groups. Resolution beneath the flag — the XDG default and the deploy-target
 * default — belongs to `resolveAiMetricsDataRoot` in `@beep/repo-ai-metrics`.
 *
 * **Gotchas**
 *
 * The combinator order is load-bearing: `withFallbackConfig` re-fails with the
 * original `MissingOption`, and `optional` must sit outside it to catch that
 * failure. Applying `optional` first would swallow the miss and make the
 * environment rung unreachable while still compiling.
 *
 * **Example** (Wiring the flag into a command)
 *
 * ```ts
 * import { aiMetricsDataRootFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(aiMetricsDataRootFlag.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const aiMetricsDataRootFlag = Flag.string("data-root").pipe(
  Flag.withFallbackConfig(Config.string(aiMetricsDataRootEnvVar)),
  Flag.withDescription(
    `AI metrics data root, or ${aiMetricsDataRootEnvVar}; defaults to \${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`
  ),
  Flag.optional
);

/**
 * Environment-variable name used to override Yeet's workstation state root.
 *
 * **Example** (Build a Yeet state environment)
 *
 * ```ts
 * import { yeetStateRootEnvVar } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const environment = { [yeetStateRootEnvVar]: "/var/lib/beep/yeet" }
 * console.log(environment.BEEP_YEET_STATE_ROOT) // "/var/lib/beep/yeet"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const yeetStateRootEnvVar = "BEEP_YEET_STATE_ROOT";

/**
 * Optional `--state-root` flag with {@link yeetStateRootEnvVar} as its configuration fallback.
 *
 * **Details**
 *
 * An explicit CLI value wins over the environment. When neither is supplied,
 * registry code derives the XDG or home-local default.
 *
 * **Example** (Wire the state-root flag)
 *
 * ```ts
 * import { yeetStateRootFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(yeetStateRootFlag.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const yeetStateRootFlag = Flag.string("state-root").pipe(
  Flag.withFallbackConfig(Config.string(yeetStateRootEnvVar)),
  Flag.withDescription(
    `Yeet state root, or ${yeetStateRootEnvVar}; defaults to \${XDG_STATE_HOME:-$HOME/.local/state}/beep/yeet`
  ),
  Flag.optional
);

/**
 * `--package` / `-p` flag selecting a workspace package.
 *
 * **Details**
 *
 * The flag accepts either a package name or a repo-relative path, which is why
 * the default wording names both — a caller who narrows the description should
 * keep that dual form unless the command genuinely accepts only one.
 *
 * **Gotchas**
 *
 * This is a factory, not a flag. Unlike {@link jsonFlag} it must be called, and
 * calling it twice yields two independent flags rather than a shared one.
 *
 * **Example** (Taking the default wording and overriding it)
 *
 * ```ts
 * import { packageFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const standard = packageFlag()
 * const narrowed = packageFlag("Package whose documentation should be rebuilt")
 *
 * console.log(standard.kind) // "flag"
 * console.log(narrowed.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const packageFlag = (description = "Target a workspace package by name or repo-relative path") =>
  Flag.string("package").pipe(Flag.withAlias("p"), Flag.withDescription(description));

/**
 * `--output` / `-o` flag selecting an output file path.
 *
 * **Details**
 *
 * The flag only carries the path a command was asked to write to. Whether that
 * path is created, overwritten, or refused is the command's decision — pair it
 * with {@link forceFlag} when overwriting an existing file needs consent.
 *
 * **Example** (Naming an output path for a report command)
 *
 * ```ts
 * import { outputFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = outputFlag("Write the generated manifest to this path")
 *
 * console.log(flag.kind) // "flag"
 * ```
 *
 * @see {@link forceFlag} for the companion flag that permits overwriting.
 * @category flags
 * @since 0.0.0
 */
export const outputFlag = (description = "Write output to a specific file path") =>
  Flag.string("output").pipe(Flag.withAlias("o"), Flag.withDescription(description));

/**
 * `--verbose` flag toggling additional diagnostic output.
 *
 * **Details**
 *
 * Verbosity is about how much a command explains itself, not about what it does,
 * so a command's behaviour and exit code should be identical with and without
 * it. Diagnostics belong on stderr so that `--verbose` stays composable with
 * {@link jsonFlag} rather than corrupting machine-readable output.
 *
 * **Example** (Adding diagnostics to a long-running command)
 *
 * ```ts
 * import { verboseFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = verboseFlag("Print each package as it is checked")
 *
 * console.log(flag.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const verboseFlag = (description = "Print additional diagnostic output") =>
  Flag.boolean("verbose").pipe(Flag.withDefault(false), Flag.withDescription(description));

/**
 * `--dry-run` flag previewing changes without writing.
 *
 * **Details**
 *
 * A dry run should do all the work of a real run except the writes, so that what
 * it reports is what a real run would do. A preview that takes a shortcut and
 * reports an intention it never computed is worse than no preview at all.
 *
 * **Gotchas**
 *
 * The flag only carries the operator's intent; nothing here enforces it. Each
 * command is responsible for actually suppressing its own writes, and for
 * defaulting the flag in the direction that makes an unspecified run safe.
 *
 * **Example** (Previewing a destructive command)
 *
 * ```ts
 * import { dryRunFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = dryRunFlag("Report the files that would be rewritten")
 *
 * console.log(flag.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const dryRunFlag = (description = "Preview changes without writing files") =>
  Flag.boolean("dry-run").pipe(Flag.withDefault(false), Flag.withDescription(description));

/**
 * `--force` flag permitting destructive overwrites.
 *
 * **Details**
 *
 * This is the operator's consent to lose existing data, so a command should
 * refuse rather than overwrite when it is absent. Describing what specifically
 * gets destroyed is worth the words — "Overwrite existing output" tells a reader
 * less than naming the file or directory that disappears.
 *
 * **Gotchas**
 *
 * `--force` and {@link dryRunFlag} are independent switches, and a command given
 * both should preview rather than destroy. Deciding that precedence is the
 * command's job; neither flag encodes it.
 *
 * **Example** (Consenting to replace an existing bundle)
 *
 * ```ts
 * import { forceFlag } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const flag = forceFlag("Replace the existing bundle directory if one is present")
 *
 * console.log(flag.kind) // "flag"
 * ```
 *
 * @category flags
 * @since 0.0.0
 */
export const forceFlag = (description = "Overwrite existing output") =>
  Flag.boolean("force").pipe(Flag.withDefault(false), Flag.withDescription(description));

/**
 * Split a comma-separated flag value, trimming entries and dropping empties.
 *
 * **Details**
 *
 * Names {@link Text.splitCommaSeparatedTrimmed} for CLI adapters, which the
 * fallow-quality and yeet fallow-feedback adapters had each open-coded under
 * this name. Trailing and doubled commas are tolerated rather than rejected,
 * because a shell-assembled list such as `--only "$a,$b"` picks up empty
 * segments whenever one variable is unset.
 *
 * **Gotchas**
 *
 * Entries keep their case. Use {@link normalizedTokens} when the values are
 * matched against a fixed vocabulary rather than passed through.
 *
 * **Example** (Parsing a list that came from an unset shell variable)
 *
 * ```ts
 * import { csvValues } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(csvValues(" a , b , , c ")) // ["a", "b", "c"]
 * console.log(csvValues("")) // []
 * ```
 *
 * @see {@link normalizedTokens} for the case-folding variant.
 * @category coercion
 * @since 0.0.0
 */
export const csvValues: (value: string) => ReadonlyArray<string> = Text.splitCommaSeparatedTrimmed;

/**
 * Split a comma-separated flag value into trimmed, lowercased, non-empty
 * tokens.
 *
 * **When to use**
 *
 * Use when flag values are matched against a fixed vocabulary — bot names, gate
 * names, lane names — so that an operator typing `Renovate` and one typing
 * `renovate` select the same thing.
 *
 * **Details**
 *
 * {@link csvValues} with case folding applied to each entry. Folding happens
 * after trimming, so surrounding whitespace never survives into a comparison.
 *
 * **Gotchas**
 *
 * Lowercasing is unconditional, which makes this wrong for values that are
 * passed through rather than compared — a case-sensitive path or package name
 * loses information here. Reach for {@link csvValues} in that case.
 *
 * **Example** (Normalizing bot names typed with inconsistent case)
 *
 * ```ts
 * import { normalizedTokens } from "@beep/repo-cli/internal/cli/Flags"
 *
 * console.log(normalizedTokens(" Renovate , DEPENDABOT ")) // ["renovate", "dependabot"]
 * console.log(normalizedTokens("renovate,,renovate")) // ["renovate", "renovate"]
 * ```
 *
 * @see {@link csvValues} for the variant that preserves case.
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
 * **Details**
 *
 * Narrows `ReadonlyArray<unknown>` to `ReadonlyArray<string>` by filtering on a
 * type guard, so the result is typed rather than asserted. Variadic positional
 * arguments arrive loosely typed, and this is the boundary where they become
 * strings.
 *
 * **Gotchas**
 *
 * Non-string entries are dropped silently rather than reported, so the result
 * can be shorter than the input and an empty result does not distinguish "no
 * arguments" from "no string arguments". Compare lengths when that difference
 * should be an error.
 *
 * **Example** (Narrowing a mixed variadic argument list)
 *
 * ```ts
 * import { variadicStrings } from "@beep/repo-cli/internal/cli/Flags"
 *
 * const values = variadicStrings(["a", 1, "b", null])
 *
 * console.log(values) // ["a", "b"]
 * console.log(values.length) // 2
 * ```
 *
 * @category coercion
 * @since 0.0.0
 */
export const variadicStrings: (values: ReadonlyArray<unknown>) => ReadonlyArray<string> = A.filter(P.isString);
