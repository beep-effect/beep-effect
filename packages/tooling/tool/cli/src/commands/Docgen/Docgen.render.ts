/**
 * Markdown and JSON rendering for Docgen analysis reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, Str } from "@beep/utils";
import { Console, Effect, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { encodeCommandJson, renderPrettyCommandJson } from "../../internal/cli/Json.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import type { Path } from "effect";
import type {
  DocgenAggregateResult,
  DocgenExportAnalysis,
  DocgenGenerationResult,
  DocgenPackageAnalysis,
} from "./Docgen.schemas.ts";

const encodeJsonResult = UnknownFromJsonString.encodeUnknownResult;
const normalizeSlashes = Str.replace(/\\/g, "/");
const hasAnalysisIssue = (analysis: DocgenExportAnalysis): boolean =>
  analysis.missingTags.length > 0 || analysis.categoryIssues.length > 0;
const jsonText = (value: unknown): string => pipe(encodeJsonResult(value), Result.getOrThrow, renderPrettyCommandJson);

/**
 * Encode command payloads as stable pretty JSON.
 *
 * **Example** (Encode stable pretty JSON)
 *
 * ```ts
 * import { renderDocgenJson } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = renderDocgenJson({ ok: true })
 * console.log(program) // example value
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderDocgenJson: (value: unknown) => Effect.Effect<string, DomainError> = Effect.fn(function* (value) {
  const encoded = yield* encodeCommandJson(value).pipe(
    Effect.mapError(DomainError.newCause("Failed to encode docgen JSON output."))
  );
  return renderPrettyCommandJson(encoded);
});

/**
 * Default destination for package JSDoc analysis reports.
 *
 * **Example** (Build default analysis path)
 *
 * ```ts
 * import { defaultAnalysisPath } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const path = { join: (...parts: ReadonlyArray<string>) => parts.join("/") }
 * console.log(defaultAnalysisPath("/repo/pkg", true, path))
 * console.log(defaultAnalysisPath(true, path)("/repo/pkg"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const defaultAnalysisPath: {
  (packagePath: string, json: boolean, path: Pick<Path.Path, "join">): string;
  (json: boolean, path: Pick<Path.Path, "join">): (packagePath: string) => string;
} = dual(3, (packagePath: string, json: boolean, path: Pick<Path.Path, "join">): string =>
  path.join(packagePath, json ? "JSDOC_ANALYSIS.json" : "JSDOC_ANALYSIS.md")
);

/**
 * Default destination for package JSDoc quality reports.
 *
 * **Example** (Build default quality path)
 *
 * ```ts
 * import { defaultQualityPath } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const path = { join: (...parts: ReadonlyArray<string>) => parts.join("/") }
 * console.log(defaultQualityPath("/repo/pkg", false, path))
 * console.log(defaultQualityPath(false, path)("/repo/pkg"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const defaultQualityPath: {
  (packagePath: string, json: boolean, path: Pick<Path.Path, "join">): string;
  (json: boolean, path: Pick<Path.Path, "join">): (packagePath: string) => string;
} = dual(3, (packagePath: string, json: boolean, path: Pick<Path.Path, "join">): string =>
  path.join(packagePath, json ? "JSDOC_QUALITY.json" : "JSDOC_QUALITY.md")
);

/**
 * Print package generation results and return the failure count.
 *
 * **Example** (Log empty generation results)
 *
 * ```ts
 * import { logGenerationResults } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = logGenerationResults([])
 * console.log(program) // example value
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const logGenerationResults = Effect.fn(function* (results: ReadonlyArray<DocgenGenerationResult>) {
  const failures = A.filter(results, (result) => !result.success);
  const successes = A.filter(results, (result) => result.success);

  for (const result of successes) {
    const suffix = result.moduleCount === undefined ? "" : ` (${result.moduleCount} module file(s))`;
    yield* Console.log(`docgen: generated ${result.packagePath}${suffix}`);
  }

  for (const result of failures) {
    yield* Console.error(`docgen: failed ${result.packagePath}: ${result.error ?? "unknown error"}`);
    if (result.output !== undefined && Str.trim(result.output).length > 0) {
      yield* Console.error(result.output);
    }
  }

  return failures.length;
});

/**
 * Print package docs aggregation results.
 *
 * **Example** (Log empty aggregate results)
 *
 * ```ts
 * import { logAggregateResults } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = logAggregateResults([])
 * console.log(program) // example value
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const logAggregateResults = Effect.fn(function* (results: ReadonlyArray<DocgenAggregateResult>) {
  if (results.length === 0) {
    yield* Console.log("docgen: no generated package docs found to aggregate");
    return;
  }

  for (const result of results) {
    yield* Console.log(`docgen: aggregated ${result.packagePath} -> docs/generated/${result.docsOutputPath}`);
  }
});

/**
 * Print the Docgen command index message.
 *
 * **Example** (Print Docgen index message)
 *
 * ```ts
 * import { printDocgenIndex } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = printDocgenIndex
 * console.log(program) // example value
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const printDocgenIndex = printLines([
  'Run "bun run beep docgen --help" to see the available docgen commands and flags.',
]);

const formatChecklistItem = (analysis: DocgenExportAnalysis): string =>
  A.join(
    [
      `- [ ] \`${analysis.filePath}:${analysis.line}\` - **${analysis.name}** (${analysis.kind})`,
      `  - Missing: ${A.join(analysis.missingTags, ", ") || "none"}`,
      ...(analysis.categoryIssues.length === 0
        ? A.empty()
        : [`  - Category issues: ${A.join(analysis.categoryIssues, "; ")}`]),
      ...(analysis.presentTags.length === 0 ? A.empty() : [`  - Has: ${A.join(analysis.presentTags, ", ")}`]),
      ...(analysis.context === undefined ? A.empty() : [`  - Context: ${analysis.context}`]),
    ],
    "\n"
  );

type DocsIndexContentOptions = {
  readonly outputPath: string;
  readonly order: number;
};

/**
 * Render the aggregate docs index page for one package.
 *
 * **Example** (Render package docs index)
 *
 * ```ts
 * import { generateDocsIndexContent } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const content = generateDocsIndexContent("@beep/repo-cli", {
 *   outputPath: "tooling/tool/cli",
 *   order: 2
 * })
 * console.log(content.includes("permalink: /docs/tooling/tool/cli"))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const generateDocsIndexContent: {
  (packageName: string, options: DocsIndexContentOptions): string;
  (options: DocsIndexContentOptions): (packageName: string) => string;
} = dual(
  2,
  (packageName: string, { order, outputPath }: DocsIndexContentOptions): string => `---
title: "${packageName}"
has_children: true
permalink: /docs/${normalizeSlashes(outputPath)}
nav_order: ${order}
---
`
);

const analysisReportHeader = (analysis: DocgenPackageAnalysis): ReadonlyArray<string> => [
  `# JSDoc Analysis Report: ${analysis.packageName}`,
  "",
  `> **Generated**: ${analysis.timestamp}`,
  `> **Package**: ${analysis.packagePath}`,
  `> **Status**: ${analysis.summary.missingDocumentation} export(s) need documentation`,
  "",
  "## What To Fix",
  "",
  "Public exports should include the repo-required JSDoc tags and canonical category values:",
  "",
  "1. `@category`",
  "2. `@example`",
  "3. `@since`",
  "",
  "Re-run the analysis after edits:",
  "",
  "```bash",
  `bun run beep docgen analyze -p ${analysis.packagePath}`,
  "```",
  "",
];

const checklistPrioritySection = (
  title: string,
  entries: ReadonlyArray<DocgenExportAnalysis>
): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(entries)
    ? A.empty()
    : [`### ${title}`, "", ...A.flatMap(entries, (entry) => [formatChecklistItem(entry), ""])];

const fixChecklistSections = (issues: ReadonlyArray<DocgenExportAnalysis>): ReadonlyArray<string> => {
  if (A.isReadonlyArrayEmpty(issues)) {
    return ["## Fix Checklist", "", "All public exports are fully documented.", ""];
  }

  return [
    "## Fix Checklist",
    "",
    ...checklistPrioritySection(
      "High Priority",
      A.filter(issues, (entry) => entry.priority === "high")
    ),
    ...checklistPrioritySection(
      "Medium Priority",
      A.filter(issues, (entry) => entry.priority === "medium")
    ),
    ...checklistPrioritySection(
      "Low Priority",
      A.filter(issues, (entry) => entry.priority === "low")
    ),
  ];
};

const analysisFindingSection = (entry: DocgenExportAnalysis): ReadonlyArray<string> => [
  `### ${entry.name}`,
  "",
  `- Location: \`${entry.filePath}:${entry.line}\``,
  `- Kind: ${entry.kind}`,
  `- Missing: ${A.join(entry.missingTags, ", ")}`,
  ...(entry.categoryIssues.length > 0 ? [`- Category issues: ${A.join(entry.categoryIssues, "; ")}`] : []),
  ...(entry.presentTags.length > 0 ? [`- Present: ${A.join(entry.presentTags, ", ")}`] : []),
  ...(P.isNotUndefined(entry.context) ? [`- Context: ${entry.context}`] : []),
  "",
];

const findingSections = (issues: ReadonlyArray<DocgenExportAnalysis>): ReadonlyArray<string> => [
  "## Findings",
  "",
  ...(A.isReadonlyArrayEmpty(issues)
    ? ["All public exports are fully documented.", ""]
    : A.flatMap(issues, analysisFindingSection)),
];

const analysisSummarySection = (analysis: DocgenPackageAnalysis): ReadonlyArray<string> => [
  "## Summary",
  "",
  "| Metric | Count |",
  "|--------|-------|",
  `| Total Exports | ${analysis.summary.totalExports} |`,
  `| Fully Documented | ${analysis.summary.fullyDocumented} |`,
  `| Missing Documentation | ${analysis.summary.missingDocumentation} |`,
  `| Missing @category | ${analysis.summary.missingCategory} |`,
  `| Invalid @category | ${analysis.summary.invalidCategory} |`,
  `| Missing @example | ${analysis.summary.missingExample} |`,
  `| Missing @since | ${analysis.summary.missingSince} |`,
  "",
];

/**
 * Render the Markdown JSDoc analysis report for one package.
 *
 * **Example** (Render analysis Markdown report)
 *
 * ```ts
 * import { generateAnalysisReport } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 * import {
 *   DocgenAnalysisSummary,
 *   DocgenPackageAnalysis
 * } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * const analysis = DocgenPackageAnalysis.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   timestamp: "2026-05-12T00:00:00.000Z",
 *   exports: [],
 *   summary: DocgenAnalysisSummary.make({
 *     totalExports: 0,
 *     fullyDocumented: 0,
 *     missingDocumentation: 0,
 *     missingCategory: 0,
 *     invalidCategory: 0,
 *     missingExample: 0,
 *     missingSince: 0
 *   })
 * })
 * console.log(generateAnalysisReport(analysis, false).startsWith("# JSDoc Analysis Report"))
 * ```
 *
 * @param analysis - Package analysis document.
 * @param fixMode - Whether to render checklist-oriented remediation content.
 * @returns Markdown report content.
 * @category formatting
 * @since 0.0.0
 */
export const generateAnalysisReport: {
  (analysis: DocgenPackageAnalysis, fixMode: boolean): string;
  (fixMode: boolean): (analysis: DocgenPackageAnalysis) => string;
} = dual(2, (analysis: DocgenPackageAnalysis, fixMode: boolean): string => {
  const issues = A.filter(analysis.exports, hasAnalysisIssue);
  return A.join(
    [
      ...analysisReportHeader(analysis),
      ...(fixMode ? fixChecklistSections(issues) : findingSections(issues)),
      ...analysisSummarySection(analysis),
    ],
    "\n"
  );
});

/**
 * Encode a package analysis document as JSON text.
 *
 * **Example** (Encode analysis document JSON)
 *
 * ```ts
 * import { generateAnalysisJson } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 * import {
 *   DocgenAnalysisSummary,
 *   DocgenPackageAnalysis
 * } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const analysis = DocgenPackageAnalysis.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   timestamp: "2026-05-12T00:00:00.000Z",
 *   exports: [],
 *   summary: DocgenAnalysisSummary.make({
 *     totalExports: 0,
 *     fullyDocumented: 0,
 *     missingDocumentation: 0,
 *     missingCategory: 0,
 *     invalidCategory: 0,
 *     missingExample: 0,
 *     missingSince: 0
 *   })
 * })
 * const json = generateAnalysisJson(analysis)
 * console.log(json.includes("\"packageName\": \"@beep/repo-cli\""))
 * ```
 *
 * @param analysis - Package analysis document.
 * @returns JSON representation suitable for writing to disk or stdout.
 * @category serialization
 * @since 0.0.0
 */
export const generateAnalysisJson = (analysis: DocgenPackageAnalysis): string => jsonText(analysis);
