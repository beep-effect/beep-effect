/**
 * Syntax-only Effect Vitest canon detector command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { runEffectVitestLint } from "./internal/EffectVitestScan.ts";
import { EffectVitestLintOptions } from "./Lint.schemas.ts";

/**
 * Run census, baseline refresh, detector-row emission, or the default membership ratchet.
 *
 * **Example** (Build the detector command runner)
 *
 * ```ts
 * import { lintEffectVitestCommand } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import { Command } from "effect/unstable/cli"
 *
 * const run = Command.run(lintEffectVitestCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintEffectVitestCommand = Command.make(
  "effect-vitest",
  {
    census: Flag.Boolean("census").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Write the authoritative D9 test/support census")
    ),
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Refresh the full-scan detector baseline")
    ),
    rows: Flag.String("rows").pipe(
      Flag.withDescription("Emit schema-validated JSONL rows per owning package"),
      Flag.optional
    ),
  },
  Effect.fn("EffectVitest.command")(function* ({ census, rows, write }) {
    yield* runEffectVitestLint(EffectVitestLintOptions.make({ census, rows, write }));
  })
).pipe(Command.withDescription("Verify canonical @effect/vitest usage with a syntax-only full scan"));

/**
 * Detector implementation exported for focused syntax fixtures.
 *
 * @category parsing
 * @since 0.0.0
 */
export { detectEffectVitestFindings } from "./internal/EffectVitestDetectors.ts";
/**
 * Rule metadata exported for detector and migration tooling.
 *
 * @category policies
 * @since 0.0.0
 */
export { applyEffectVitestPrimitiveGraph, EffectVitestRulePolicies } from "./internal/EffectVitestPolicy.ts";
/**
 * Pinned primitive graph loading and indexing.
 *
 * @category resources
 * @since 0.0.0
 */
export {
  indexEffectVitestPrimitives,
  readEffectVitestPrimitiveGraph,
} from "./internal/EffectVitestPrimitives.ts";
/**
 * Full scan and membership helpers exported for command integration tests.
 *
 * @category use-cases
 * @since 0.0.0
 */
export {
  countEffectVitestSourceLines,
  diffEffectVitestFindings,
  discoverEffectVitestSourcePaths,
  formatEffectVitestIntroducedReport,
  preserveEffectVitestExceptions,
  runEffectVitestLint,
  verifyEffectVitestPin,
} from "./internal/EffectVitestScan.ts";
/**
 * Persistence operations exported for focused artifact verification.
 *
 * @category resources
 * @since 0.0.0
 */
export {
  readEffectVitestInventory,
  writeEffectVitestCensus,
  writeEffectVitestInventory,
  writeEffectVitestRows,
} from "./internal/EffectVitestStore.ts";
/**
 * Syntax provenance helpers exported for focused parser verification.
 *
 * @category parsing
 * @since 0.0.0
 */
export {
  callbackCalls,
  callLabel,
  classifyHarnessCall,
  collectEffectVitestImports,
  compactEvidence,
  createEffectVitestHarnessIndex,
  effectVitestTestCallbacks,
  enclosingLayerBlock,
  enclosingTest,
  isHarnessMethodCall,
  isProvenanceCall,
  isProvenanceExpression,
  isWholeBodyCall,
  resolveEffectVitestBinding,
  rootTestBodyCall,
  sourceFunctionDefinitions,
} from "./internal/EffectVitestSyntax.ts";
/**
 * Syntax provenance model types exported for focused parser verification.
 *
 * @category type-level
 * @since 0.0.0
 */
export type {
  EffectVitestFunctionNode,
  EffectVitestHarnessIndex,
  EffectVitestHarnessMode,
  EffectVitestImports,
} from "./internal/EffectVitestSyntax.ts";
