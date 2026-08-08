/**
 * Schema models shared by the Docgen command group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Match, Order } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Docgen/Docgen.schemas");

/**
 * Options for resolving a workspace package selector.
 *
 * **Example** (Make resolve options)
 *
 * ```ts
 * import { ResolveDocgenWorkspacePackageOptions } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * const options = ResolveDocgenWorkspacePackageOptions.make({ rootDir: "/repo" })
 * console.log(options.rootDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolveDocgenWorkspacePackageOptions extends S.Class<ResolveDocgenWorkspacePackageOptions>(
  $I`ResolveDocgenWorkspacePackageOptions`
)(
  {
    rootDir: S.optionalKey(S.String),
  },
  $I.annote("ResolveDocgenWorkspacePackageOptions", {
    description: "Resolved workspace package options for docgen",
  })
) {}

/**
 * Workspace docgen status derived from config and generated output presence.
 *
 * **Example** (Check status membership)
 *
 * ```ts
 * import { DocgenPackageStatus } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * console.log(DocgenPackageStatus.is["configured-and-generated"]("configured-and-generated"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenPackageStatus = LiteralKit([
  "configured-and-generated",
  "configured-not-generated",
  "not-configured",
]).pipe(
  $I.annoteSchema("DocgenPackageStatus", {
    description: "Workspace docgen status derived from config and generated output presence.",
  })
);
/**
 * Workspace docgen status derived from config and generated output presence.
 *
 * **Example** (Assign status type)
 *
 * ```ts
 * import type { DocgenPackageStatus } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const status: DocgenPackageStatus = "configured-not-generated"
 * console.log(status) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenPackageStatus = typeof DocgenPackageStatus.Type;

const DocgenJsonObject = S.Json.pipe(
  $I.annoteSchema("DocgenJsonObject", {
    description: "Generic JSON object payload used for docgen compiler option blocks.",
  })
);

/**
 * Parsed `docgen.json` document used by the command suite.
 *
 * **Example** (Make config document)
 *
 * ```ts
 * import { DocgenConfigDocument } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const config = DocgenConfigDocument.make({
 *   srcDir: "src",
 *   outDir: "docs",
 *   include: ["src/index.ts"]
 * })
 * console.log(config.srcDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenConfigDocument extends S.Class<DocgenConfigDocument>($I`DocgenConfigDocument`)(
  {
    $schema: S.optionalKey(S.String),
    projectHomepage: S.optionalKey(S.String),
    srcLink: S.optionalKey(S.String),
    srcDir: S.String.pipe(SchemaUtils.withKeyDefaults("src")),
    outDir: S.optionalKey(S.String),
    theme: S.optionalKey(S.String),
    enableSearch: S.optionalKey(S.Boolean),
    enforceDescriptions: S.optionalKey(S.Boolean),
    enforceExamples: S.optionalKey(S.Boolean),
    enforceVersion: S.optionalKey(S.Boolean),
    tscExecutable: S.optionalKey(S.String),
    runExamples: S.optionalKey(S.Boolean),
    include: S.String.pipe(S.Array, S.optionalKey),
    exclude: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    parseCompilerOptions: S.optionalKey(S.Union([S.String, DocgenJsonObject])),
    examplesCompilerOptions: S.optionalKey(S.Union([S.String, DocgenJsonObject])),
  },
  $I.annote("DocgenConfigDocument", {
    description: "Parsed docgen.json document used by the command suite.",
  })
) {}

/**
 * Workspace package metadata used by docgen commands.
 *
 * **Example** (Make workspace package)
 *
 * ```ts
 * import { DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const pkg = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 * console.log(pkg.docsOutputPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenWorkspacePackage extends S.Class<DocgenWorkspacePackage>($I`DocgenWorkspacePackage`)(
  {
    name: S.String,
    relativePath: S.String,
    absolutePath: S.String,
    docsOutputPath: S.String,
    hasDocgenConfig: S.Boolean,
    hasGeneratedDocs: S.Boolean,
    status: DocgenPackageStatus,
  },
  $I.annote("DocgenWorkspacePackage", {
    description: "Workspace package metadata used by docgen commands.",
  })
) {}

/**
 * Issue priority used by analysis findings.
 *
 * **Example** (Check priority membership)
 *
 * ```ts
 * import { DocgenIssuePriority } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * console.log(DocgenIssuePriority.is.high("high"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenIssuePriority = LiteralKit(["high", "medium", "low"]).pipe(
  $I.annoteSchema("DocgenIssuePriority", {
    description: "Issue priority used by analysis findings.",
  })
);
/**
 * Issue priority used by analysis findings.
 *
 * **Example** (Assign priority type)
 *
 * ```ts
 * import type { DocgenIssuePriority } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const priority: DocgenIssuePriority = "medium"
 * console.log(priority) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenIssuePriority = typeof DocgenIssuePriority.Type;

/**
 * Export kind surfaced by analysis.
 *
 * **Example** (Check export kind)
 *
 * ```ts
 * import { DocgenExportKind } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * console.log(DocgenExportKind.is["module-fileoverview"]("module-fileoverview"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenExportKind = LiteralKit([
  "function",
  "const",
  "type",
  "interface",
  "class",
  "namespace",
  "enum",
  "re-export",
  "module-fileoverview",
]).pipe(
  $I.annoteSchema("DocgenExportKind", {
    description: "Export kind surfaced by analysis.",
  })
);
/**
 * Export kind surfaced by analysis.
 *
 * **Example** (Assign export kind)
 *
 * ```ts
 * import type { DocgenExportKind } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const kind: DocgenExportKind = "class"
 * console.log(kind) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenExportKind = typeof DocgenExportKind.Type;

/**
 * Analysis finding for a single export or module-level doc requirement.
 *
 * **Example** (Make export analysis)
 *
 * ```ts
 * import { DocgenExportAnalysis } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const finding = DocgenExportAnalysis.make({
 *   name: "docgenCommand",
 *   kind: "const",
 *   filePath: "src/commands/Docgen/Docgen.command.ts",
 *   line: 1172,
 *   presentTags: ["@category", "@example", "@since"],
 *   missingTags: [],
 *   categoryValues: ["cli-commands"],
 *   categoryIssues: [],
 *   hasJsDoc: true,
 *   priority: "low",
 *   declarationSource: "export const docgenCommand = Command.make(...)"
 * })
 * console.log(finding.priority)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenExportAnalysis extends S.Class<DocgenExportAnalysis>($I`DocgenExportAnalysis`)(
  {
    name: S.String,
    kind: DocgenExportKind,
    filePath: S.String,
    line: S.Finite,
    presentTags: S.Array(S.String),
    missingTags: S.Array(S.String),
    categoryValues: S.Array(S.String),
    categoryIssues: S.Array(S.String),
    hasJsDoc: S.Boolean,
    context: S.optionalKey(S.String),
    priority: DocgenIssuePriority,
    declarationSource: S.String,
  },
  $I.annote("DocgenExportAnalysis", {
    description: "Analysis finding for a single export or module-level doc requirement.",
  })
) {}

/**
 * Summary counts for a package analysis run.
 *
 * **Example** (Make analysis summary)
 *
 * ```ts
 * import { DocgenAnalysisSummary } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const summary = DocgenAnalysisSummary.make({
 *   totalExports: 12,
 *   fullyDocumented: 10,
 *   missingDocumentation: 2,
 *   missingCategory: 0,
 *   invalidCategory: 0,
 *   missingExample: 2,
 *   missingSince: 0
 * })
 * console.log(summary.missingDocumentation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenAnalysisSummary extends S.Class<DocgenAnalysisSummary>($I`DocgenAnalysisSummary`)(
  {
    totalExports: S.Finite,
    fullyDocumented: S.Finite,
    missingDocumentation: S.Finite,
    missingCategory: S.Finite,
    invalidCategory: S.Finite,
    missingExample: S.Finite,
    missingSince: S.Finite,
  },
  $I.annote("DocgenAnalysisSummary", {
    description: "Summary counts for a package analysis run.",
  })
) {}

/**
 * Package-level analysis document written by `docgen analyze`.
 *
 * **Example** (Make package analysis)
 *
 * ```ts
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
 * console.log(analysis.packageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenPackageAnalysis extends S.Class<DocgenPackageAnalysis>($I`DocgenPackageAnalysis`)(
  {
    packageName: S.String,
    packagePath: S.String,
    timestamp: S.String,
    exports: S.Array(DocgenExportAnalysis),
    summary: DocgenAnalysisSummary,
  },
  $I.annote("DocgenPackageAnalysis", {
    description: "Package-level analysis document written by docgen analyze.",
  })
) {}

/**
 * Per-package docgen generation result.
 *
 * **Example** (Make generation result)
 *
 * ```ts
 * import { DocgenGenerationResult } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const result = DocgenGenerationResult.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   success: true,
 *   moduleCount: 42
 * })
 * console.log(result.moduleCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenGenerationResult extends S.Class<DocgenGenerationResult>($I`DocgenGenerationResult`)(
  {
    packageName: S.String,
    packagePath: S.String,
    success: S.Boolean,
    moduleCount: S.optionalKey(S.Finite),
    error: S.optionalKey(S.String),
    output: S.optionalKey(S.String),
  },
  $I.annote("DocgenGenerationResult", {
    description: "Per-package docgen generation result.",
  })
) {}

/**
 * Per-package generated documentation aggregation result.
 *
 * **Example** (Make aggregate result)
 *
 * ```ts
 * import { DocgenAggregateResult } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * const result = DocgenAggregateResult.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   fileCount: 12
 * })
 * console.log(result.fileCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenAggregateResult extends S.Class<DocgenAggregateResult>($I`DocgenAggregateResult`)(
  {
    packageName: S.String,
    packagePath: S.String,
    docsOutputPath: S.String,
    fileCount: S.Finite,
  },
  $I.annote("DocgenAggregateResult", {
    description: "Per-package aggregated docs result.",
  })
) {}

/**
 * Runtime guard for workspace package values.
 *
 * **Example** (Guard workspace package)
 *
 * ```ts
 * import { DocgenWorkspacePackage, isDocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 *
 * const pkg = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 *
 * console.log(isDocgenWorkspacePackage(pkg))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isDocgenWorkspacePackage = S.is(DocgenWorkspacePackage);

/**
 * Stable ordering by workspace-relative package path.
 *
 * **Example** (Sort by relative path)
 *
 * ```ts
 * import { byRelativePathAscending, DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * import * as A from "effect/Array"
 *
 * const packages = [
 *   DocgenWorkspacePackage.make({ name: "b", relativePath: "packages/b", absolutePath: "/repo/packages/b", docsOutputPath: "b", hasDocgenConfig: true, hasGeneratedDocs: false, status: "configured-not-generated" }),
 *   DocgenWorkspacePackage.make({ name: "a", relativePath: "packages/a", absolutePath: "/repo/packages/a", docsOutputPath: "a", hasDocgenConfig: true, hasGeneratedDocs: false, status: "configured-not-generated" })
 * ]
 * console.log(A.sort(packages, byRelativePathAscending)[0]?.relativePath)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byRelativePathAscending: Order.Order<DocgenWorkspacePackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenWorkspacePackage) => pkg.relativePath
);

/**
 * Stable ordering by generated documentation output path.
 *
 * **Example** (Sort by docs path)
 *
 * ```ts
 * import { byDocsOutputPathAscending, DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * import * as A from "effect/Array"
 *
 * const packages = [
 *   DocgenWorkspacePackage.make({ name: "z", relativePath: "packages/z", absolutePath: "/repo/packages/z", docsOutputPath: "z", hasDocgenConfig: true, hasGeneratedDocs: true, status: "configured-and-generated" }),
 *   DocgenWorkspacePackage.make({ name: "a", relativePath: "packages/a", absolutePath: "/repo/packages/a", docsOutputPath: "a", hasDocgenConfig: true, hasGeneratedDocs: true, status: "configured-and-generated" })
 * ]
 * console.log(A.sort(packages, byDocsOutputPathAscending)[0]?.docsOutputPath)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byDocsOutputPathAscending: Order.Order<DocgenWorkspacePackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenWorkspacePackage) => pkg.docsOutputPath
);

/**
 * Stable ordering for analysis findings by priority and source location.
 *
 * **Example** (Sort findings by priority)
 *
 * ```ts
 * import { byIssueAscending, DocgenExportAnalysis } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * import * as A from "effect/Array"
 *
 * const findings = [
 *   DocgenExportAnalysis.make({ name: "b", kind: "const", filePath: "b.ts", line: 1, presentTags: [], missingTags: ["@example"], categoryValues: [], categoryIssues: [], hasJsDoc: true, priority: "medium", declarationSource: "export const b = 1" }),
 *   DocgenExportAnalysis.make({ name: "a", kind: "const", filePath: "a.ts", line: 1, presentTags: [], missingTags: ["@since"], categoryValues: [], categoryIssues: [], hasJsDoc: false, priority: "high", declarationSource: "export const a = 1" })
 * ]
 * console.log(A.sort(findings, byIssueAscending)[0]?.name)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byIssueAscending: Order.Order<DocgenExportAnalysis> = Order.mapInput(
  Order.String,
  (analysis: DocgenExportAnalysis) =>
    `${Match.value(analysis.priority).pipe(
      Match.when("high", () => "0"),
      Match.when("medium", () => "1"),
      Match.orElse(() => "2")
    )}:${analysis.filePath}:${analysis.line}:${analysis.name}`
);
