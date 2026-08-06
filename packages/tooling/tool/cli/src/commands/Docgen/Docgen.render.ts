/**
 * Markdown and JSON rendering for Docgen analysis reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Console, Effect, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { encodeCommandJson, renderPrettyCommandJson } from "../../internal/cli/Json.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import type { Path } from "effect";
import type {
  DocgenAggregateResult,
  DocgenExportAnalysis,
  DocgenGenerationResult,
  DocgenPackageAnalysis,
} from "./Docgen.schemas.ts";

const encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const normalizeSlashes = Str.replace(/\\/g, "/");
const hasAnalysisIssue = (analysis: DocgenExportAnalysis): boolean =>
  analysis.missingTags.length > 0 || analysis.categoryIssues.length > 0;
const jsonText = (value: unknown): string => pipe(encodeJsonResult(value), Result.getOrThrow, renderPrettyCommandJson);

/**
 * Encode command payloads as stable pretty JSON.
 *
 * @example
 * ```ts
 * import { renderDocgenJson } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = renderDocgenJson({ ok: true })
 * console.log(program) // example value
 * ```
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
 * @example
 * ```ts
 * import { defaultAnalysisPath } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const path = { join: (...parts: ReadonlyArray<string>) => parts.join("/") }
 * console.log(defaultAnalysisPath("/repo/pkg", true, path))
 * console.log(defaultAnalysisPath(true, path)("/repo/pkg"))
 * ```
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
 * @example
 * ```ts
 * import { defaultQualityPath } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const path = { join: (...parts: ReadonlyArray<string>) => parts.join("/") }
 * console.log(defaultQualityPath("/repo/pkg", false, path))
 * console.log(defaultQualityPath(false, path)("/repo/pkg"))
 * ```
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
 * @example
 * ```ts
 * import { logGenerationResults } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = logGenerationResults([])
 * console.log(program) // example value
 * ```
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
 * @example
 * ```ts
 * import { logAggregateResults } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = logAggregateResults([])
 * console.log(program) // example value
 * ```
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
 * @example
 * ```ts
 * import { printDocgenIndex } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const program = printDocgenIndex
 * console.log(program) // example value
 * ```
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
 * @example
 * ```ts
 * import { generateDocsIndexContent } from "@beep/repo-cli/commands/Docgen/Docgen.render"
 *
 * const content = generateDocsIndexContent("@beep/repo-cli", {
 *   outputPath: "tooling/tool/cli",
 *   order: 2
 * })
 * console.log(content.includes("permalink: /docs/tooling/tool/cli"))
 * ```
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

/**
 * Render the Markdown JSDoc analysis report for one package.
 *
 * @param analysis - Package analysis document.
 * @param fixMode - Whether to render checklist-oriented remediation content.
 * @returns Markdown report content.
 * @example
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
 * @category formatting
 * @since 0.0.0
 */
export const generateAnalysisReport: {
  (analysis: DocgenPackageAnalysis, fixMode: boolean): string;
  (fixMode: boolean): (analysis: DocgenPackageAnalysis) => string;
} = dual(2, (analysis: DocgenPackageAnalysis, fixMode: boolean): string => {
  const issues = A.filter(analysis.exports, hasAnalysisIssue);
  const high = A.filter(issues, (entry) => entry.priority === "high");
  const medium = A.filter(issues, (entry) => entry.priority === "medium");
  const low = A.filter(issues, (entry) => entry.priority === "low");
  const sections = A.empty<string>();

  A.appendInPlace(sections, `# JSDoc Analysis Report: ${analysis.packageName}`);
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, `> **Generated**: ${analysis.timestamp}`);
  A.appendInPlace(sections, `> **Package**: ${analysis.packagePath}`);
  A.appendInPlace(sections, `> **Status**: ${analysis.summary.missingDocumentation} export(s) need documentation`);
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "## What To Fix");
  A.appendInPlace(sections, "");
  A.appendInPlace(
    sections,
    "Public exports should include the repo-required JSDoc tags and canonical category values:"
  );
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "1. `@category`");
  A.appendInPlace(sections, "2. `@example`");
  A.appendInPlace(sections, "3. `@since`");
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "Re-run the analysis after edits:");
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "```bash");
  A.appendInPlace(sections, `bun run beep docgen analyze -p ${analysis.packagePath}`);
  A.appendInPlace(sections, "```");
  A.appendInPlace(sections, "");

  if (fixMode) {
    A.appendInPlace(sections, "## Fix Checklist");
    A.appendInPlace(sections, "");

    if (A.isReadonlyArrayEmpty(issues)) {
      A.appendInPlace(sections, "All public exports are fully documented.");
      A.appendInPlace(sections, "");
    } else {
      if (A.isReadonlyArrayNonEmpty(high)) {
        A.appendInPlace(sections, "### High Priority");
        A.appendInPlace(sections, "");
        for (const entry of high) {
          A.appendInPlace(sections, formatChecklistItem(entry));
          A.appendInPlace(sections, "");
        }
      }

      if (A.isReadonlyArrayNonEmpty(medium)) {
        A.appendInPlace(sections, "### Medium Priority");
        A.appendInPlace(sections, "");
        for (const entry of medium) {
          A.appendInPlace(sections, formatChecklistItem(entry));
          A.appendInPlace(sections, "");
        }
      }

      if (A.isReadonlyArrayNonEmpty(low)) {
        A.appendInPlace(sections, "### Low Priority");
        A.appendInPlace(sections, "");
        for (const entry of low) {
          A.appendInPlace(sections, formatChecklistItem(entry));
          A.appendInPlace(sections, "");
        }
      }
    }
  } else {
    A.appendInPlace(sections, "## Findings");
    A.appendInPlace(sections, "");

    if (A.isReadonlyArrayEmpty(issues)) {
      A.appendInPlace(sections, "All public exports are fully documented.");
      A.appendInPlace(sections, "");
    } else {
      for (const entry of issues) {
        A.appendInPlace(sections, `### ${entry.name}`);
        A.appendInPlace(sections, "");
        A.appendInPlace(sections, `- Location: \`${entry.filePath}:${entry.line}\``);
        A.appendInPlace(sections, `- Kind: ${entry.kind}`);
        A.appendInPlace(sections, `- Missing: ${A.join(entry.missingTags, ", ")}`);
        if (entry.categoryIssues.length > 0) {
          A.appendInPlace(sections, `- Category issues: ${A.join(entry.categoryIssues, "; ")}`);
        }
        if (entry.presentTags.length > 0) {
          A.appendInPlace(sections, `- Present: ${A.join(entry.presentTags, ", ")}`);
        }
        if (P.isNotUndefined(entry.context)) {
          A.appendInPlace(sections, `- Context: ${entry.context}`);
        }
        A.appendInPlace(sections, "");
      }
    }
  }

  A.appendInPlace(sections, "## Summary");
  A.appendInPlace(sections, "");
  A.appendInPlace(sections, "| Metric | Count |");
  A.appendInPlace(sections, "|--------|-------|");
  A.appendInPlace(sections, `| Total Exports | ${analysis.summary.totalExports} |`);
  A.appendInPlace(sections, `| Fully Documented | ${analysis.summary.fullyDocumented} |`);
  A.appendInPlace(sections, `| Missing Documentation | ${analysis.summary.missingDocumentation} |`);
  A.appendInPlace(sections, `| Missing @category | ${analysis.summary.missingCategory} |`);
  A.appendInPlace(sections, `| Invalid @category | ${analysis.summary.invalidCategory} |`);
  A.appendInPlace(sections, `| Missing @example | ${analysis.summary.missingExample} |`);
  A.appendInPlace(sections, `| Missing @since | ${analysis.summary.missingSince} |`);
  A.appendInPlace(sections, "");

  return A.join(sections, "\n");
});

/**
 * Encode a package analysis document as JSON text.
 *
 * @param analysis - Package analysis document.
 * @returns JSON representation suitable for writing to disk or stdout.
 * @example
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
 * @category serialization
 * @since 0.0.0
 */
export const generateAnalysisJson = (analysis: DocgenPackageAnalysis): string => jsonText(analysis);
