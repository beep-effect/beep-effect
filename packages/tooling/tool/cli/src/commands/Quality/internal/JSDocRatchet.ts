/**
 * JSDoc inventory totals regression-baseline ratchet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { Console, DateTime, Effect, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { formatJsonc, readArtifact, renderTruncatedLines, writeArtifact } from "../../../internal/artifacts/index.js";
import { diffTotals, enforceRatchet } from "../../../internal/ratchet/index.js";
import { QualityScriptCommandError } from "../Quality.errors.js";
import type { FileSystem } from "effect";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocRatchet");

const JSDocRatchetedTotalName = LiteralKit([
  "packagesNeedingRemediation",
  "missingExportExamples",
  "missingExportCategories",
  "missingExportSince",
  "unsafeExampleFindings",
  "schemaAnnotationFindings",
]).pipe(
  $I.annoteSchema("JSDocRatchetedTotalName", {
    description: "JSDoc inventory total names guarded by the A4 fail-on-growth ratchet.",
  })
);

/**
 * Repo-relative path to the generated JSDoc documentation inventory.
 *
 * @example
 * ```ts
 * import { defaultJSDocInventoryPath } from "@beep/repo-cli/test/Quality"
 *
 * const result = defaultJSDocInventoryPath === "standards/jsdoc-documentation.inventory.jsonc"
 * console.log(result) // rendered command output
 * ```
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocInventoryPath = "standards/jsdoc-documentation.inventory.jsonc";

/**
 * Repo-relative path to the committed JSDoc totals regression baseline.
 *
 * @example
 * ```ts
 * import { defaultJSDocTotalsBaselinePath } from "@beep/repo-cli/test/Quality"
 *
 * const result = defaultJSDocTotalsBaselinePath === "standards/jsdoc-totals.regression-baseline.jsonc"
 * console.log(result) // rendered command output
 * ```
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocTotalsBaselinePath = "standards/jsdoc-totals.regression-baseline.jsonc";

/**
 * Full inventory regeneration command recorded in the totals baseline header.
 *
 * @example
 * ```ts
 * import { jsdocInventoryRegenerationCommand } from "@beep/repo-cli/test/Quality"
 *
 * const result = jsdocInventoryRegenerationCommand.includes("jsdoc-inventory")
 * console.log(result) // rendered command output
 * ```
 * @category constants
 * @since 0.0.0
 */
export const jsdocInventoryRegenerationCommand = "bun run beep quality jsdoc-inventory";

/**
 * Totals snapshot refresh command recorded in the baseline header.
 *
 * @example
 * ```ts
 * import { jsdocTotalsSnapshotCommand } from "@beep/repo-cli/test/Quality"
 *
 * const result = jsdocTotalsSnapshotCommand.includes("write-baseline")
 * console.log(result) // rendered command output
 * ```
 * @category constants
 * @since 0.0.0
 */
export const jsdocTotalsSnapshotCommand = "bun run beep quality jsdoc-ratchet --write-baseline";

const JSDocTrackedTotals = S.Record(S.String, S.Finite).pipe(
  $I.annoteSchema("JSDocTrackedTotals", {
    description: "Numeric totals tracked by the JSDoc documentation inventory ratchet.",
  })
);

type JSDocTrackedTotals = typeof JSDocTrackedTotals.Type;

class JSDocInventoryTotalsDocument extends S.Class<JSDocInventoryTotalsDocument>($I`JSDocInventoryTotalsDocument`)(
  {
    totals: JSDocTrackedTotals,
  },
  $I.annote("JSDocInventoryTotalsDocument", {
    description: "Minimal generated JSDoc inventory document shape consumed by the totals ratchet.",
  })
) {}

/**
 * Committed JSDoc totals regression baseline document.
 *
 * @example
 * ```ts
 * import { JSDocTotalsRegressionBaseline } from "@beep/repo-cli/test/Quality"
 *
 * const baseline = JSDocTotalsRegressionBaseline.make({
 *   schema_version: 1,
 *   source_inventory: "standards/jsdoc-documentation.inventory.jsonc",
 *   regeneration_command: "bun run beep quality jsdoc-inventory",
 *   snapshot_command: "bun run beep quality jsdoc-ratchet --write-baseline",
 *   comparison: "fail-on-growth",
 *   generated_at: "2026-07-06T00:00:00.000Z",
 *   tracked_totals: { missingExportExamples: 1 }
 * })
 * console.log(baseline.tracked_totals.missingExportExamples)
 * ```
 * @category models
 * @since 0.0.0
 */
export class JSDocTotalsRegressionBaseline extends S.Class<JSDocTotalsRegressionBaseline>(
  $I`JSDocTotalsRegressionBaseline`
)(
  {
    schema_version: S.Literal(1),
    source_inventory: S.String,
    regeneration_command: S.String,
    snapshot_command: S.String,
    comparison: S.String,
    generated_at: S.optionalKey(S.String),
    tracked_totals: JSDocTrackedTotals,
  },
  $I.annote("JSDocTotalsRegressionBaseline", {
    description: "Committed JSDoc inventory totals used by the fail-on-growth ratchet.",
  })
) {}

/**
 * Difference for one tracked JSDoc inventory total.
 *
 * @example
 * ```ts
 * import { JSDocTotalDelta } from "@beep/repo-cli/test/Quality"
 *
 * const delta = JSDocTotalDelta.make({
 *   metric: "missingExportExamples",
 *   baseline: 1,
 *   current: 2,
 *   delta: 1
 * })
 * console.log(delta.metric)
 * ```
 * @category models
 * @since 0.0.0
 */
export class JSDocTotalDelta extends S.Class<JSDocTotalDelta>($I`JSDocTotalDelta`)(
  {
    metric: S.String,
    baseline: S.Finite,
    current: S.Finite,
    delta: S.Finite,
  },
  $I.annote("JSDocTotalDelta", {
    description: "Difference for one tracked JSDoc documentation inventory total.",
  })
) {}

/**
 * Comparison between current generated inventory totals and the committed baseline.
 *
 * @example
 * ```ts
 * import { JSDocTotalsComparison } from "@beep/repo-cli/test/Quality"
 *
 * const comparison = JSDocTotalsComparison.make({
 *   current_total_count: 1,
 *   baseline_total_count: 1,
 *   increased: [],
 *   decreased: [],
 *   missing_current_metrics: []
 * })
 * console.log(comparison.increased.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class JSDocTotalsComparison extends S.Class<JSDocTotalsComparison>($I`JSDocTotalsComparison`)(
  {
    current_total_count: S.Finite,
    baseline_total_count: S.Finite,
    increased: S.Array(JSDocTotalDelta),
    decreased: S.Array(JSDocTotalDelta),
    missing_current_metrics: S.Array(S.String),
  },
  $I.annote("JSDocTotalsComparison", {
    description: "Comparison between current generated JSDoc inventory totals and the committed baseline.",
  })
) {}

const readCurrentInventoryTotals = Effect.fn("JSDocRatchet.readCurrentInventoryTotals")(function* (
  repoRoot: string,
  inventoryPath: string
): Effect.fn.Return<JSDocTrackedTotals, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const document = yield* readArtifact({
    path: path.resolve(repoRoot, inventoryPath),
    schema: JSDocInventoryTotalsDocument,
    onReadError: (cause) => QualityScriptCommandError.new(cause, `Failed to read ${inventoryPath}.`),
    onDecodeError: (cause) => QualityScriptCommandError.new(cause, `Failed to decode ${inventoryPath}.`),
  });

  return document.totals;
});

const readBaseline = Effect.fn("JSDocRatchet.readBaseline")(function* (
  repoRoot: string,
  baselinePath: string
): Effect.fn.Return<JSDocTotalsRegressionBaseline, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  return yield* readArtifact({
    path: path.resolve(repoRoot, baselinePath),
    schema: JSDocTotalsRegressionBaseline,
    onReadError: (cause) => QualityScriptCommandError.new(cause, `Failed to read ${baselinePath}.`),
    onDecodeError: (cause) => QualityScriptCommandError.new(cause, `Failed to decode ${baselinePath}.`),
  });
});

const compareTotals = (
  currentTotals: JSDocTrackedTotals,
  baselineTotals: JSDocTrackedTotals
): JSDocTotalsComparison => {
  const diff = diffTotals({ current: currentTotals, baseline: baselineTotals });
  const toJSDocDelta = (delta: {
    readonly metric: string;
    readonly baseline: number;
    readonly current: number;
    readonly delta: number;
  }) => JSDocTotalDelta.make(delta);
  return JSDocTotalsComparison.make({
    current_total_count: diff.currentTotalCount,
    baseline_total_count: diff.baselineTotalCount,
    increased: A.map(diff.increased, toJSDocDelta),
    decreased: A.map(diff.decreased, toJSDocDelta),
    missing_current_metrics: diff.missing,
  });
};

const selectRatchetedTotals = (totals: JSDocTrackedTotals): JSDocTrackedTotals =>
  R.fromEntries(
    A.map(JSDocRatchetedTotalName.Options, (metric): readonly [string, number] => [
      metric,
      pipe(
        R.get(totals, metric),
        O.getOrElse(() => 0)
      ),
    ])
  );

const renderIncreaseLine = (delta: JSDocTotalDelta): string =>
  `  - ${delta.metric}: ${delta.current} > ${delta.baseline} (+${delta.delta})`;

const renderDecreaseLine = (delta: JSDocTotalDelta): string =>
  `  - ${delta.metric}: ${delta.current} < ${delta.baseline} (${delta.delta})`;

const renderDeltaLines = (
  deltas: ReadonlyArray<JSDocTotalDelta>,
  render: (delta: JSDocTotalDelta) => string,
  limit: number
): ReadonlyArray<string> => renderTruncatedLines({ items: deltas, render, limit });

const enforceComparison = Effect.fn("JSDocRatchet.enforceComparison")(function* (
  comparison: JSDocTotalsComparison,
  baselinePath: string
): Effect.fn.Return<void, QualityScriptCommandError> {
  return yield* enforceRatchet({
    regressions: [
      {
        present: A.isReadonlyArrayNonEmpty(comparison.missing_current_metrics),
        lines: [
          `[jsdoc-ratchet] generated inventory is missing baseline metric(s) from ${baselinePath}:`,
          ...A.map(comparison.missing_current_metrics, (metric) => `  - ${metric}`),
          `[jsdoc-ratchet] regenerate the inventory with: ${jsdocInventoryRegenerationCommand}`,
        ],
        error: QualityScriptCommandError.make({
          message: "JSDoc inventory totals are missing baseline metrics.",
          command: "bun run beep quality jsdoc-ratchet",
          exitCode: 1,
        }),
      },
      {
        present: A.isReadonlyArrayNonEmpty(comparison.increased),
        lines: [
          `[jsdoc-ratchet] regression: ${A.length(comparison.increased)} tracked total(s) increased versus ${baselinePath}`,
          ...renderDeltaLines(comparison.increased, renderIncreaseLine, 25),
          "[jsdoc-ratchet] fix the added JSDoc findings; this ratchet only tightens on decreases.",
        ],
        error: QualityScriptCommandError.make({
          message: "JSDoc totals regression baseline grew.",
          command: "bun run beep quality jsdoc-ratchet",
          exitCode: 1,
        }),
      },
    ],
    okLine: `[jsdoc-ratchet] ok: tracked=${comparison.baseline_total_count} increased=0 current_totals=${comparison.current_total_count}`,
    tighten: pipe(
      comparison.decreased,
      O.liftPredicate(A.isReadonlyArrayNonEmpty),
      O.map((decreased) => [
        `[jsdoc-ratchet] tighten-baseline: ${A.length(decreased)} tracked total(s) decreased`,
        ...renderDeltaLines(decreased, renderDecreaseLine, 25),
        `[jsdoc-ratchet] regenerate inventory with: ${jsdocInventoryRegenerationCommand}`,
        `[jsdoc-ratchet] then refresh totals with: ${jsdocTotalsSnapshotCommand}`,
      ])
    ),
  });
});

const makeBaseline = Effect.fn("JSDocRatchet.makeBaseline")(function* (
  inventoryPath: string,
  totals: JSDocTrackedTotals
) {
  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

  return JSDocTotalsRegressionBaseline.make({
    schema_version: 1,
    source_inventory: inventoryPath,
    regeneration_command: jsdocInventoryRegenerationCommand,
    snapshot_command: jsdocTotalsSnapshotCommand,
    comparison: "fail-on-growth: generated inventory totals must not exceed this committed baseline",
    generated_at: generatedAt,
    tracked_totals: selectRatchetedTotals(totals),
  });
});

const formatBaseline = Effect.fn("JSDocRatchet.formatBaseline")(function* (
  baseline: JSDocTotalsRegressionBaseline
): Effect.fn.Return<string, QualityScriptCommandError> {
  const jsonc = yield* formatJsonc(baseline).pipe(
    QualityScriptCommandError.mapError("Failed to format JSDoc totals regression baseline.")
  );
  return [
    "// JSDoc totals regression baseline. Do not edit by hand.",
    `// Full inventory regeneration: ${jsdocInventoryRegenerationCommand}`,
    `// Refresh this totals snapshot after regenerating inventory: ${jsdocTotalsSnapshotCommand}`,
    "// Comparison: fail-on-growth for every metric in tracked_totals.",
    jsonc,
  ].join("\n");
});

const writeBaseline = Effect.fn("JSDocRatchet.writeBaseline")(function* (
  repoRoot: string,
  baselinePath: string,
  baseline: JSDocTotalsRegressionBaseline
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const content = yield* formatBaseline(baseline);
  const absolutePath = path.resolve(repoRoot, baselinePath);

  yield* writeArtifact({
    path: absolutePath,
    body: `${content}\n`,
    onError: (cause) => QualityScriptCommandError.new(cause, `Failed to write ${baselinePath}.`),
  });
});

/**
 * Options accepted by {@link runJSDocRatchet}.
 *
 * @example
 * ```ts
 * import type { RunJSDocRatchetOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options: RunJSDocRatchetOptions = {
 *   baselinePath: "standards/jsdoc-totals.regression-baseline.jsonc",
 *   inventoryPath: "standards/jsdoc-documentation.inventory.jsonc",
 *   writeBaseline: false
 * }
 * console.log(options.baselinePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RunJSDocRatchetOptions extends S.Class<RunJSDocRatchetOptions>($I`RunJSDocRatchetOptions`)(
  {
    baselinePath: S.String,
    inventoryPath: S.String,
    writeBaseline: S.Boolean,
  },
  $I.annote("RunJSDocRatchetOptions", {
    description: "Options accepted by runJSDocRatchet: inventory source, baseline location, and write mode.",
  })
) {}

/**
 * Compare generated JSDoc inventory totals against the committed totals baseline.
 *
 * @param options - Inventory path, baseline path, and write mode.
 * @returns Effect that fails when any tracked inventory total grows.
 * @example
 * ```ts
 * import { runJSDocRatchet } from "@beep/repo-cli/test/Quality"
 *
 * const program = runJSDocRatchet({
 *   baselinePath: "standards/jsdoc-totals.regression-baseline.jsonc",
 *   inventoryPath: "standards/jsdoc-documentation.inventory.jsonc",
 *   writeBaseline: false
 * })
 * console.log(program) // example value
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocRatchet = Effect.fn("JSDocRatchet.runJSDocRatchet")(function* ({
  baselinePath,
  inventoryPath,
  writeBaseline: shouldWriteBaseline,
}: RunJSDocRatchetOptions): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const currentTotals = yield* readCurrentInventoryTotals(repoRoot, inventoryPath);

  if (shouldWriteBaseline) {
    const baseline = yield* makeBaseline(inventoryPath, currentTotals);
    yield* writeBaseline(repoRoot, baselinePath, baseline);
    yield* Console.log(
      `[jsdoc-ratchet] wrote ${baselinePath} with ${A.length(R.keys(baseline.tracked_totals))} tracked total(s)`
    );
    return;
  }

  const baseline = yield* readBaseline(repoRoot, baselinePath);
  yield* enforceComparison(compareTotals(currentTotals, baseline.tracked_totals), baselinePath);
});

/**
 * Compare JSDoc inventory totals for focused tests.
 *
 * @example
 * ```ts
 * import { compareJSDocTotalsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const comparison = compareJSDocTotalsForTesting(
 *   { missingExportExamples: 2 },
 *   { missingExportExamples: 1 }
 * )
 * console.log(comparison.increased.length)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const compareJSDocTotalsForTesting = compareTotals;
