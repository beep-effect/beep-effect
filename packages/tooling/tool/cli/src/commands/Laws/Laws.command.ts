/**
 * Effect governance command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Text } from "@beep/utils";
import { Console, Effect } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { AllowlistCheckOptions, reportAllowlistCheckSummary, runAllowlistCheck } from "./AllowlistCheck.ts";
import { DualArityRulesOptions, runDualArityRules } from "./DualArity.ts";
import { EffectFnRulesOptions, runEffectFnRules } from "./EffectFn.ts";
import { EffectImportRulesOptions, runEffectImportRules } from "./EffectImports.ts";
import { NoNativeRuntimeRulesOptions, runNoNativeRuntimeRules } from "./NoNativeRuntime.ts";
import { runTerseEffectRules, TerseEffectRulesOptions } from "./TerseEffect.ts";

const $I = $RepoCliId.create("commands/Laws/Laws.command");

/**
 * CLI options for effect import governance command.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category models
 * @since 0.0.0
 */
class EffectImportsCommandOptions extends S.Class<EffectImportsCommandOptions>($I`EffectImportsCommandOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    check: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    exclude: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  },
  $I.annote("EffectImportsCommandOptions", {
    description: "CLI options for effect import governance command.",
  })
) {}

/**
 * CLI options for terse Effect style command.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category models
 * @since 0.0.0
 */
class TerseEffectCommandOptions extends S.Class<TerseEffectCommandOptions>($I`TerseEffectCommandOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    check: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    exclude: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  },
  $I.annote("TerseEffectCommandOptions", {
    description: "CLI options for terse Effect style command.",
  })
) {}

/**
 * CLI options for public API dual-arity command.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category models
 * @since 0.0.0
 */
class DualArityCommandOptions extends S.Class<DualArityCommandOptions>($I`DualArityCommandOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    check: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    exclude: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  },
  $I.annote("DualArityCommandOptions", {
    description: "CLI options for public API dual-arity command.",
  })
) {}

/**
 * CLI options for the Effect.fn supplemental law.
 *
 * @example
 * ```ts
 * console.log("EffectFnCommandOptions")
 * ```
 * @category models
 * @since 0.0.0
 */
class EffectFnCommandOptions extends S.Class<EffectFnCommandOptions>($I`EffectFnCommandOptions`)(
  {
    check: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    exclude: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  },
  $I.annote("EffectFnCommandOptions", {
    description: "CLI options for the Effect.fn supplemental law.",
  })
) {}

/**
 * CLI options for native runtime parity checks.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category models
 * @since 0.0.0
 */
class NoNativeRuntimeCommandOptions extends S.Class<NoNativeRuntimeCommandOptions>($I`NoNativeRuntimeCommandOptions`)(
  {
    check: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    exclude: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  },
  $I.annote("NoNativeRuntimeCommandOptions", {
    description: "CLI options for native runtime parity checks.",
  })
) {}

const parseExcludePaths = (excludeValue: string): ReadonlyArray<string> =>
  Text.splitCommaSeparatedTrimmed(excludeValue);

const logTerseEffectFileGroup = Effect.fn("Laws.logTerseEffectFileGroup")(function* (
  label: string,
  files: ReadonlyArray<string>,
  findings: ReadonlyArray<string>
) {
  yield* Console.log(`[effect-governance-terse-effect] ${label}_files=${files.length}`);
  for (const filePath of files) {
    yield* Console.log(`[effect-governance-terse-effect] ${label}: ${filePath}`);
  }
  for (const finding of findings) {
    yield* Console.log(`[effect-governance-terse-effect] ${label}_finding: ${finding}`);
  }
});

/**
 * CLI command for effect import style migration/check.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const lawsEffectImportsCommand = Command.make(
  "effect-imports",
  {
    write: Flag.boolean("write").pipe(Flag.withDescription("Persist import rewrites to disk")),
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when any rewrite is required")),
    exclude: Flag.string("exclude").pipe(
      Flag.withDescription("Comma-separated list of file paths to exclude"),
      Flag.withDefault("")
    ),
  },
  Effect.fn(function* ({ write, check, exclude }) {
    const options = EffectImportsCommandOptions.make({ write, check, exclude });
    const summary = yield* runEffectImportRules(
      EffectImportRulesOptions.make({
        write: options.write,
        strictCheck: options.check,
        excludePaths: parseExcludePaths(options.exclude),
      })
    );

    const mode = options.write ? "write" : "dry-run";
    yield* Console.log(`[effect-governance-imports] mode=${mode}`);
    yield* Console.log(`[effect-governance-imports] touched_files=${summary.touchedFiles}`);
    yield* Console.log(`[effect-governance-imports] alias_renamed=${summary.aliasRenamed}`);
    yield* Console.log(`[effect-governance-imports] stable_converted=${summary.stableConverted}`);

    if (!options.write) {
      yield* Console.log("[effect-governance-imports] Run with --write to persist changes.");
    }

    for (const filePath of summary.changedFiles) {
      yield* Console.log(filePath);
    }

    if (summary.strictFailure) {
      return yield* failWithReportedExit("effect-governance-imports: check failed.");
    }
  })
).pipe(Command.withDescription("Check or rewrite Effect import style rules"));

/**
 * CLI command for terse Effect style migration/check.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const lawsTerseEffectCommand = Command.make(
  "terse-effect",
  {
    write: Flag.boolean("write").pipe(Flag.withDescription("Persist terse Effect rewrites to disk")),
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when terse Effect rewrites are required")),
    exclude: Flag.string("exclude").pipe(
      Flag.withDescription("Comma-separated list of file paths to exclude"),
      Flag.withDefault("")
    ),
  },
  Effect.fn(function* ({ write, check, exclude }) {
    const options = TerseEffectCommandOptions.make({ write, check, exclude });
    const summary = yield* runTerseEffectRules(
      TerseEffectRulesOptions.make({
        write: options.write,
        strictCheck: options.check,
        excludePaths: parseExcludePaths(options.exclude),
      })
    );

    const mode = options.write ? "write" : "dry-run";
    yield* Console.log(`[effect-governance-terse-effect] mode=${mode}`);
    yield* Console.log(`[effect-governance-terse-effect] touched_files=${summary.touchedFiles}`);
    yield* Console.log(`[effect-governance-terse-effect] helper_refs_simplified=${summary.helpersSimplified}`);
    yield* Console.log(`[effect-governance-terse-effect] thunk_helpers_simplified=${summary.thunkHelpersSimplified}`);
    yield* Console.log(`[effect-governance-terse-effect] flow_candidates_detected=${summary.flowCandidatesDetected}`);
    yield* Console.log(
      `[effect-governance-terse-effect] option_object_compaction_candidates_detected=${summary.optionObjectCompactionCandidatesDetected}`
    );
    yield* Console.log(
      `[effect-governance-terse-effect] conditional_optional_object_spread_candidates_detected=${summary.conditionalOptionalObjectSpreadCandidatesDetected}`
    );
    yield* Console.log(
      `[effect-governance-terse-effect] nested_option_match_candidates_detected=${summary.nestedOptionMatchCandidatesDetected}`
    );
    yield* Console.log(
      `[effect-governance-terse-effect] nested_bool_match_candidates_detected=${summary.nestedBoolMatchCandidatesDetected}`
    );
    yield* Console.log(
      `[effect-governance-terse-effect] dual_overload_candidates_detected=${summary.dualOverloadCandidatesDetected}`
    );

    yield* logTerseEffectFileGroup("blocking", summary.blockingFiles, summary.blockingFindings);
    yield* logTerseEffectFileGroup("rewritable", summary.rewritableFiles, summary.rewritableFindings);
    yield* logTerseEffectFileGroup("informational", summary.informationalFiles, summary.informationalFindings);

    if (!options.write && summary.rewritableFiles.length > 0) {
      yield* Console.log("[effect-governance-terse-effect] Run with --write to persist rewritable helper changes.");
    }

    if (summary.blockingFiles.length > summary.rewritableFiles.length) {
      yield* Console.log("[effect-governance-terse-effect] Manual terse-effect candidates remain after safe rewrites.");
    }

    if (summary.strictFailure) {
      return yield* failWithReportedExit("effect-governance-terse-effect: check failed.");
    }
  })
).pipe(Command.withDescription("Check or rewrite terse Effect helper wrappers"));

/**
 * CLI command for public helper dual-arity enforcement.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const lawsDualArityCommand = Command.make(
  "dual-arity",
  {
    write: Flag.boolean("write").pipe(Flag.withDescription("Refresh standards/dual-arity.inventory.jsonc")),
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when the dual-arity inventory is stale or enforced")),
    exclude: Flag.string("exclude").pipe(
      Flag.withDescription("Comma-separated list of file paths to exclude"),
      Flag.withDefault("")
    ),
  },
  Effect.fn(function* ({ write, check, exclude }) {
    const options = DualArityCommandOptions.make({ write, check, exclude });
    const summary = yield* runDualArityRules(
      DualArityRulesOptions.make({
        write: options.write,
        strictCheck: options.check,
        excludePaths: parseExcludePaths(options.exclude),
      })
    );

    if (summary.strictFailure) {
      return yield* failWithReportedExit("effect-governance-dual-arity: check failed.");
    }
  })
).pipe(Command.withDescription("Check or refresh public helper dual-arity inventory"));

/**
 * CLI command for the Effect.fn supplemental law.
 *
 * @example
 * ```ts
 * console.log("lawsEffectFnCommand")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const lawsEffectFnCommand = Command.make(
  "effect-fn",
  {
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when reusable functions directly return Effect.gen")),
    exclude: Flag.string("exclude").pipe(
      Flag.withDescription("Comma-separated list of file paths to exclude"),
      Flag.withDefault("")
    ),
  },
  Effect.fn(function* ({ check, exclude }) {
    const options = EffectFnCommandOptions.make({ check, exclude });
    const summary = yield* runEffectFnRules(
      EffectFnRulesOptions.make({
        strictCheck: options.check,
        excludePaths: parseExcludePaths(options.exclude),
      })
    );

    yield* Console.log(`[effect-governance-effect-fn] mode=${options.check ? "check" : "report"}`);
    yield* Console.log(`[effect-governance-effect-fn] scanned_files=${summary.scannedFiles}`);
    yield* Console.log(`[effect-governance-effect-fn] touched_files=${summary.touchedFiles}`);
    yield* Console.log(`[effect-governance-effect-fn] violations=${summary.violationCount}`);

    for (const diagnostic of summary.diagnostics) {
      yield* Console.log(
        `- ${diagnostic.file}:${diagnostic.line}:${diagnostic.column} [${diagnostic.ruleId}] ${diagnostic.message}`
      );
    }

    if (summary.strictFailure) {
      return yield* failWithReportedExit("effect-governance-effect-fn: check failed.");
    }
  })
).pipe(Command.withDescription("Check reusable Effect.gen-returning functions use Effect.fn or Effect.fnUntraced"));

/**
 * CLI command for repo-local native runtime governance checks.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const lawsNativeRuntimeCommand = Command.make(
  "native-runtime",
  {
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when hotspot-scope native-runtime violations remain")),
    exclude: Flag.string("exclude").pipe(
      Flag.withDescription("Comma-separated list of file paths to exclude"),
      Flag.withDefault("")
    ),
  },
  Effect.fn(function* ({ check, exclude }) {
    const options = NoNativeRuntimeCommandOptions.make({ check, exclude });
    const summary = yield* runNoNativeRuntimeRules(
      NoNativeRuntimeRulesOptions.make({
        strictCheck: options.check,
        excludePaths: parseExcludePaths(options.exclude),
      })
    );

    yield* Console.log(`[effect-governance-native-runtime] mode=${options.check ? "check" : "report"}`);
    yield* Console.log(`[effect-governance-native-runtime] scanned_files=${summary.scannedFiles}`);
    yield* Console.log(`[effect-governance-native-runtime] touched_files=${summary.touchedFiles}`);
    yield* Console.log(`[effect-governance-native-runtime] warnings=${summary.warningCount}`);
    yield* Console.log(`[effect-governance-native-runtime] errors=${summary.errorCount}`);
    yield* Console.log(`[effect-governance-native-runtime] allowlisted=${summary.allowlistedCount}`);
    yield* Console.log(
      `[effect-governance-native-runtime] unused_allowlist_entries=${summary.unusedAllowlistEntries.length}`
    );

    for (const diagnostic of summary.diagnostics) {
      yield* Console.log(
        `- [${diagnostic.severity}] ${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`
      );
    }

    if (summary.strictFailure) {
      return yield* failWithReportedExit("effect-governance-native-runtime: check failed.");
    }
  })
).pipe(Command.withDescription("Run repo-local no-native-runtime parity checks"));

/**
 * CLI command for validating Effect governance allowlist integrity.
 *
 * @example
 * ```ts
 * console.log("docgen metadata")
 * ```
 * @category utilities
 * @since 0.0.0
 */
const lawsAllowlistCheckCommand = Command.make(
  "allowlist-check",
  {},
  Effect.fn(function* () {
    const summary = yield* runAllowlistCheck(
      AllowlistCheckOptions.make({
        cwd: process.cwd(),
      })
    );

    yield* reportAllowlistCheckSummary(summary);

    if (!summary.ok) {
      return yield* failWithReportedExit("effect-governance-allowlist-check: check failed.");
    }
  })
).pipe(Command.withDescription("Validate the Effect governance allowlist document"));

/**
 * Laws command group.
 *
 * @example
 * ```ts
 * console.log("lawsCommand")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const lawsCommand = Command.make("laws", {}, () =>
  printLines([
    "Effect governance commands:",
    "- bun run beep laws effect-imports --check",
    "- bun run beep laws effect-imports --write",
    "- bun run beep laws native-runtime --check",
    "- bun run beep laws dual-arity --check",
    "- bun run beep laws dual-arity --write",
    "- bun run beep laws effect-fn --check",
    "- bun run beep laws terse-effect --check",
    "- bun run beep laws terse-effect --write",
    "- bun run beep laws allowlist-check",
  ])
).pipe(
  Command.withDescription("Effect governance validation and migration commands"),
  Command.withSubcommands([
    lawsEffectImportsCommand,
    lawsNativeRuntimeCommand,
    lawsDualArityCommand,
    lawsEffectFnCommand,
    lawsTerseEffectCommand,
    lawsAllowlistCheckCommand,
  ])
) as Command.Command<"laws", {}, {}, never, never>;
