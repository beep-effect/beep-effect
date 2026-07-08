/**
 * Markdown packet renderer for yeet package quality reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Md } from "@beep/md";
import { Order } from "effect";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { RenderError } from "@beep/md";
import type { Document } from "@beep/md/Md.model";
import type { Markdown } from "@beep/schema";
import type * as Result from "effect/Result";
import type { PackageQualityReport, QualityIssue, QualityIssueCategory } from "./Yeet.schemas.js";

const issueCategoryOrder: Order.Order<QualityIssueCategory> = Order.String;
const issueFileOrder: Order.Order<string> = Order.String;

const issueLocation = (issue: QualityIssue): string =>
  pipe(
    O.fromUndefinedOr(issue.file),
    O.map((file) => {
      const line = issue.line === undefined ? "" : `:${issue.line}`;
      const column = issue.column === undefined ? "" : `:${issue.column}`;
      return `${file}${line}${column}`;
    }),
    O.getOrElse(() => issue.packagePath ?? issue.packageName ?? "repo")
  );

const issueCommand = (issue: QualityIssue): O.Option<string> =>
  pipe(O.fromUndefinedOr(issue.command), O.filter(Str.isNonEmpty));

const categorySummary = (issues: ReadonlyArray<QualityIssue>, category: QualityIssueCategory): string => {
  const categoryIssues = A.filter(issues, (issue) => issue.category === category);
  const severities = pipe(
    categoryIssues,
    A.map((issue) => issue.severity),
    A.dedupe,
    A.sort(Order.String),
    A.join(", ")
  );
  return `${category}: ${A.length(categoryIssues)} issue(s), severity ${severities}`;
};

const categoryBlocks = (issues: ReadonlyArray<QualityIssue>) =>
  pipe(
    issues,
    A.map((issue) => issue.category),
    A.dedupe,
    A.sort(issueCategoryOrder),
    A.flatMap((category) => {
      const categoryIssues = A.filter(issues, (issue) => issue.category === category);
      const topFiles = pipe(categoryIssues, A.map(issueLocation), A.dedupe, A.sort(issueFileOrder), A.take(8));
      return [
        Md.h3(category),
        Md.ul([
          categorySummary(issues, category),
          `Top files: ${A.isReadonlyArrayEmpty(topFiles) ? "(none)" : A.join(topFiles, ", ")}`,
          `Suggested route: ${pipe(
            categoryIssues,
            A.flatMap((issue) => issue.routing),
            A.map((route) => route.skill),
            A.dedupe,
            A.sort(Order.String),
            A.join(", ")
          )}`,
        ]),
      ];
    })
  );

const repairPaths: (issues: ReadonlyArray<QualityIssue>) => ReadonlyArray<string> = flow(
  A.map((issue) => issue.remediation ?? `Fix ${issue.category} from ${issueLocation(issue)}`),
  A.dedupe,
  A.sort(Order.String),
  A.take(10)
);

const routingLines: (issues: ReadonlyArray<QualityIssue>) => ReadonlyArray<string> = flow(
  A.flatMap((issue) => A.map(issue.routing, (route) => `${route.skill}: ${route.reason}`)),
  A.dedupe,
  A.sort(Order.String)
);

const affectedFileLines: (issues: ReadonlyArray<QualityIssue>) => ReadonlyArray<string> = flow(
  A.map((issue) => `${issueLocation(issue)} (${issue.category}, ${issue.id})`),
  A.dedupe,
  A.sort(Order.String)
);

const verificationCommands: (issues: ReadonlyArray<QualityIssue>) => ReadonlyArray<string> = flow(
  A.map(issueCommand),
  A.getSomes,
  A.dedupe,
  A.sort(Order.String)
);

const noIssueBlocks = [
  Md.h2("Status"),
  Md.p("No issues were captured for this package."),
  Md.h2("Verification"),
  Md.pre("bun run beep quality github-checks quality", { language: "bash" }),
] as const;

/**
 * Build a Markdown AST document for one package quality report.
 *
 * @param report - Package-grouped quality issue report.
 * @returns Markdown document AST.
 * @example
 * ```ts
 * import { PackageQualityReport, renderPackageQualityPacketDocument } from "@beep/repo-cli/test/Yeet"
 *
 * const report = PackageQualityReport.make({ blockingCount: 0, issueCount: 0, issues: [], packageName: "@beep/repo-cli" })
 * console.log(renderPackageQualityPacketDocument(report))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderPackageQualityPacketDocument = (report: PackageQualityReport): Document => {
  const issueSummary = [
    `Package: ${report.packageName}`,
    `Path: ${report.packagePath ?? "(repo)"}`,
    `Issues: ${report.issueCount}`,
    `Blocking: ${report.blockingCount}`,
  ];

  if (A.isReadonlyArrayEmpty(report.issues)) {
    return Md.make([
      Md.h1(`Yeet Quality Packet: ${report.packageName}`),
      Md.h2("Summary"),
      Md.ul(issueSummary),
      ...noIssueBlocks,
    ]);
  }

  const commands = verificationCommands(report.issues);
  return Md.make([
    Md.h1(`Yeet Quality Packet: ${report.packageName}`),
    Md.h2("Summary"),
    Md.ul(issueSummary),
    Md.h2("Issue Categories"),
    ...categoryBlocks(report.issues),
    Md.h2("Suggested First Repair Paths"),
    Md.ol(repairPaths(report.issues)),
    Md.h2("Specialist Routing"),
    Md.ul(routingLines(report.issues)),
    Md.h2("Affected Files"),
    Md.ul(affectedFileLines(report.issues)),
    Md.h2("Verification"),
    Md.pre(A.join(A.isReadonlyArrayEmpty(commands) ? ["bun run beep quality github-checks quality"] : commands, "\n"), {
      language: "bash",
    }),
  ]);
};

/**
 * Render one package quality packet as Markdown.
 *
 * @param report - Package-grouped quality issue report.
 * @returns Rendered Markdown, or render adapter failure.
 * @example
 * ```ts
 * import { PackageQualityReport, renderPackageQualityPacketMarkdown } from "@beep/repo-cli/test/Yeet"
 *
 * const report = PackageQualityReport.make({ blockingCount: 0, issueCount: 0, issues: [], packageName: "@beep/repo-cli" })
 * console.log(renderPackageQualityPacketMarkdown(report))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderPackageQualityPacketMarkdown = (
  report: PackageQualityReport
): Result.Result<Markdown, RenderError> => Md.render(renderPackageQualityPacketDocument(report));
