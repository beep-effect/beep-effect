/**
 * Schema-first quality issue index for yeet feedback packets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Order } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { optionalProp } from "../../../internal/cli/OptionRecord.js";
import { PackageQualityReport, QualityIssueIndex } from "../Yeet.schemas.js";
import type { QualityIssue } from "../Yeet.schemas.js";

export {
  PackageQualityReport,
  QualityIssue,
  QualityIssueAttribution,
  QualityIssueCategory,
  QualityIssueConfidence,
  QualityIssueIndex,
  QualityIssueRouting,
  QualityIssueSeverity,
} from "../Yeet.schemas.js";
export { knownSubLaneRemediationFromOutput } from "./IssueClassification.js";
export { qualityIssuesFromStepResult } from "./IssueParser.js";

const issueOrder: Order.Order<QualityIssue> = Order.combine(
  Order.mapInput(Order.String, (issue: QualityIssue) => issue.packageName ?? ""),
  Order.combine(
    Order.mapInput(Order.String, (issue: QualityIssue) => issue.category),
    Order.mapInput(Order.String, (issue: QualityIssue) => issue.id)
  )
);

const packageReportOrder: Order.Order<PackageQualityReport> = Order.mapInput(
  Order.String,
  (report: PackageQualityReport) => report.packageName
);

const issuePackageName = (issue: QualityIssue): string => issue.packageName ?? "@beep/root";
const issuePackagePath = (issue: QualityIssue): O.Option<string> => O.fromUndefinedOr(issue.packagePath);
const packageKey = (issue: QualityIssue): string => `${issuePackageName(issue)}\u0000${issue.packagePath ?? ""}`;

const packageReportForKey = (issues: ReadonlyArray<QualityIssue>, key: string): PackageQualityReport => {
  const packageIssues = pipe(
    issues,
    A.filter((issue) => packageKey(issue) === key),
    A.sort(issueOrder)
  );
  const firstIssue = A.head(packageIssues);
  const packageName = pipe(
    firstIssue,
    O.map(issuePackageName),
    O.getOrElse(() => "@beep/root")
  );
  const packagePath = pipe(firstIssue, O.flatMap(issuePackagePath));
  return PackageQualityReport.make({
    packageName,
    issueCount: A.length(packageIssues),
    blockingCount: A.length(A.filter(packageIssues, (issue) => issue.blocking)),
    issues: packageIssues,
    ...optionalProp("packagePath", packagePath),
  });
};

/**
 * Build a schema-first issue index from normalized issues.
 *
 * @param issues - Issues discovered during a yeet run.
 * @returns Stable issue index with package grouping.
 * @example
 * ```ts
 * import { buildQualityIssueIndex } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(buildQualityIssueIndex([]).schemaVersion)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const buildQualityIssueIndex = (issues: ReadonlyArray<QualityIssue>): QualityIssueIndex => {
  const sortedIssues = A.sort(issues, issueOrder);
  const packageKeys = pipe(sortedIssues, A.map(packageKey), A.dedupe, A.sort(Order.String));
  const packages = pipe(
    packageKeys,
    A.map((key) => packageReportForKey(sortedIssues, key)),
    A.sort(packageReportOrder)
  );
  const rawOutputRefs = pipe(
    sortedIssues,
    A.map((issue) => issue.rawOutputRef),
    A.filter(P.isNotUndefined),
    A.dedupe,
    A.sort(Order.String)
  );
  return QualityIssueIndex.make({
    schemaVersion: "yeet-quality-issue-index/v1",
    issues: sortedIssues,
    packages,
    rawOutputRefs,
  });
};
