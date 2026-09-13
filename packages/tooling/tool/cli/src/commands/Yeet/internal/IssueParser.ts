/**
 * Step-output parsers for Yeet quality issue extraction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Order } from "effect";
import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { optionalProp } from "../../../internal/cli/OptionRecord.ts";
import { decodeSchemaFirstPolicyFindingLine } from "../../../internal/quality/SchemaFirstPolicyFinding.ts";
import { commandTextForStep, TurboWorkspacePackage, turboTaskForStep } from "../../../internal/repo-run/index.ts";
import { QualityIssue } from "../Yeet.schemas.ts";
import { firstRedLaneRun, laneRunLabels } from "./InnerLaneReports.ts";
import {
  categoryForLabel,
  categoryForStep,
  knownSubLaneHintForLaneRun,
  knownSubLaneHintFromOutput,
  routeForCategory,
} from "./IssueClassification.ts";
import type {
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  TurboPlanTask,
} from "../../../internal/repo-run/index.ts";
import type { QualityTaskLaneRun } from "../../Quality/Quality.schemas.ts";
import type { QualityIssueCategory, QualityIssueSeverity } from "../Yeet.schemas.ts";

const MAX_RAW_EXCERPT_CHARS = 4 * 1024;
const ansiPattern = /\u001b\[[0-9;]*m/gu;
const tsDiagnosticPattern =
  /^(?<file>[^:\n]+):(?<line>\d+):(?<column>\d+)(?:\s+-)?\s+(?<severity>error|warning)\s+TS(?<code>\d+):\s+(?<message>.+)$/u;
const stripAnsi = Str.replace(ansiPattern, "");
const normalizeOutput = flow(stripAnsi, Str.trim);
const lineText = flow(Str.trim, normalizeOutput);
const nonEmptyLines = flow(Str.split(/\r?\n/u), A.map(lineText), A.filter(Str.isNonEmpty));
const filterArgPrefix = "--filter=";

const truncateExcerpt = (value: string): string =>
  Str.length(value) <= MAX_RAW_EXCERPT_CHARS
    ? value
    : `${Str.slice(0, MAX_RAW_EXCERPT_CHARS)(value)}\n[yeet] excerpt truncated`;

const severityForLine = (severity: string): QualityIssueSeverity => (severity === "warning" ? "warning" : "error");
const lineIndicatesEffectDiagnostic = (line: string): boolean =>
  Str.includes(" effect(")(line) || Str.includes("effectFn")(line) || Str.includes("@effect")(line);

const optionalNumberFromString = (value: string | undefined): O.Option<number> =>
  pipe(
    O.fromUndefinedOr(value),
    O.flatMap((text) => {
      const parsed = globalThis.Number.parseInt(text, 10);
      return globalThis.Number.isNaN(parsed) ? O.none<number>() : O.some(parsed);
    })
  );

const optionalStringFromStep = (value: string | undefined): O.Option<string> =>
  pipe(O.fromUndefinedOr(value), O.filter(Str.isNonEmpty));
const packageNameFromFilterArg: (arg: string) => O.Option<string> = flow(
  O.liftPredicate(Str.startsWith(filterArgPrefix)),
  O.map(Str.replace(filterArgPrefix, "")),
  O.filter(Str.isNonEmpty)
);

const filteredPackageNamesForStep = (step: RepoPlanStep): ReadonlyArray<string> =>
  pipe(step.args, A.map(packageNameFromFilterArg), A.getSomes, A.dedupe, A.sort(Order.String));

const turboWorkspacePackageFromTask = (task: TurboPlanTask): O.Option<TurboWorkspacePackage> =>
  pipe(
    O.all({
      name: optionalStringFromStep(task.packageName),
      path: optionalStringFromStep(task.packagePath),
    }),
    O.filter(({ name }) => !Str.Equivalence(name, "//")),
    O.map(({ name, path }) => TurboWorkspacePackage.make({ name, path }))
  );

const workspacePackagesForContext = (context: RepoRunContext): ReadonlyArray<TurboWorkspacePackage> => {
  const packageCatalog = context.turbo.packages ?? A.empty<TurboWorkspacePackage>();
  const taskPackages = pipe(context.turbo.tasks, A.map(turboWorkspacePackageFromTask), A.getSomes);

  return pipe(
    [...packageCatalog, ...taskPackages],
    A.dedupeWith((left, right) => Str.Equivalence(left.name, right.name) && Str.Equivalence(left.path, right.path)),
    A.sort(Order.mapInput(Order.String, (pkg: TurboWorkspacePackage) => pkg.name))
  );
};

const packagePathForPackageName = (context: RepoRunContext, packageName: string): O.Option<string> =>
  pipe(
    workspacePackagesForContext(context),
    A.findFirst((pkg) => Str.Equivalence(pkg.name, packageName)),
    O.map((pkg) => pkg.path)
  );

const turboTaskForPackageName = (
  context: RepoRunContext,
  step: RepoPlanStep,
  packageName: string
): O.Option<TurboPlanTask> => {
  const stepTask = optionalStringFromStep(step.task);
  return A.findFirst(
    context.turbo.tasks,
    (task) =>
      Str.Equivalence(task.packageName ?? "", packageName) &&
      pipe(
        stepTask,
        O.match({
          onNone: () => true,
          onSome: (taskName) =>
            O.exists(optionalStringFromStep(task.task), (taskValue) => Str.Equivalence(taskValue, taskName)) ||
            Str.Equivalence(task.taskId, taskName),
        })
      )
  );
};

const packageNameForFile = (context: RepoRunContext, file: string): O.Option<string> =>
  pipe(
    workspacePackagesForContext(context),
    A.filter((pkg) => Str.Equivalence(file, pkg.path) || Str.startsWith(`${pkg.path}/`)(file)),
    A.sort(Order.mapInput(Order.Number, (pkg: TurboWorkspacePackage) => -Str.length(pkg.path))),
    A.head,
    O.map((pkg) => pkg.name)
  );

const issueIdPathIdentity = (packageName: O.Option<string>, file: O.Option<string>): O.Option<string> =>
  pipe(
    file,
    O.orElse(() =>
      pipe(
        packageName,
        O.map((name) => `package:${name}`)
      )
    ),
    O.filter(Str.isNonEmpty)
  );

const issueId = (
  step: RepoPlanStep,
  category: QualityIssueCategory,
  message: string,
  packageName: O.Option<string>,
  file: O.Option<string>,
  line: O.Option<number>
): string =>
  A.join(
    [
      step.id,
      category,
      pipe(
        issueIdPathIdentity(packageName, file),
        O.getOrElse(() => "repo")
      ),
      pipe(
        line,
        O.map((value) => `${value}`),
        O.getOrElse(() => "0")
      ),
      Str.slice(0, 96)(message),
    ],
    "::"
  );

const issueBase = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult,
  category: QualityIssueCategory,
  message: string,
  inferredPackageName: O.Option<string> = O.none()
) => {
  const packageName = pipe(
    optionalStringFromStep(step.packageName),
    O.orElse(() => inferredPackageName)
  );
  const packagePath = pipe(
    optionalStringFromStep(step.packagePath),
    O.orElse(() =>
      pipe(
        packageName,
        O.flatMap((name) => packagePathForPackageName(context, name))
      )
    )
  );
  const turboTask = pipe(
    packageName,
    O.flatMap((name) => turboTaskForPackageName(context, step, name)),
    O.orElse(() => (step.scope === "repo" ? O.none() : turboTaskForStep(context, step)))
  );
  return {
    category,
    blocking: true,
    confidence: "partial" as const,
    message,
    tool: step.task ?? step.label,
    parser: "yeet/raw-plus-known/v1",
    evidence: A.empty<string>(),
    routing: [...routeForCategory(category)],
    ...optionalProp("packageName", packageName),
    ...optionalProp("packagePath", packagePath),
    ...optionalProp("task", optionalStringFromStep(step.task)),
    ...optionalProp("label", O.some(step.label)),
    ...optionalProp("command", O.some(commandTextForStep(step))),
    ...optionalProp("cwd", O.some(step.cwd)),
    ...optionalProp("exitCode", O.some(result.exitCode)),
    ...optionalProp("rawOutputRef", O.fromUndefinedOr(result.rawOutputRef)),
    ...optionalProp("rawExcerpt", pipe(O.fromUndefinedOr(result.output), O.map(truncateExcerpt))),
    ...optionalProp("truncated", O.fromUndefinedOr(result.truncated)),
    ...optionalProp(
      "turboTaskId",
      pipe(
        turboTask,
        O.map((task) => task.taskId)
      )
    ),
    ...optionalProp(
      "turboHash",
      pipe(
        turboTask,
        O.flatMap((task) => O.fromUndefinedOr(task.hash))
      )
    ),
    ...optionalProp(
      "cacheState",
      pipe(
        turboTask,
        O.flatMap((task) => O.fromUndefinedOr(task.cacheStatus))
      )
    ),
  };
};

const diagnosticIssueFromLine = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult,
  line: string
): O.Option<QualityIssue> => {
  const match = tsDiagnosticPattern.exec(line);
  if (match?.groups === undefined) {
    return O.none();
  }

  const file = O.fromUndefinedOr(match.groups.file);
  const startLine = optionalNumberFromString(match.groups.line);
  const startColumn = optionalNumberFromString(match.groups.column);
  const message = match.groups.message ?? line;
  const category: QualityIssueCategory = lineIndicatesEffectDiagnostic(line) ? "effect-tsgo-policy" : "typecheck";
  const inferredPackageName = pipe(
    file,
    O.flatMap((path) => packageNameForFile(context, path))
  );

  return O.some(
    QualityIssue.make({
      ...issueBase(context, step, result, category, message, inferredPackageName),
      id: issueId(step, category, message, inferredPackageName, file, startLine),
      severity: severityForLine(match.groups.severity ?? "error"),
      confidence: "structured",
      evidence: [line],
      ...optionalProp("file", file),
      ...optionalProp("line", startLine),
      ...optionalProp("column", startColumn),
    })
  );
};

const schemaFirstPolicyFindingSeverity = (
  severity: "warn" | "warning" | "error" | undefined
): O.Option<QualityIssueSeverity> => (severity === "warning" || severity === "error" ? O.some(severity) : O.none());

const schemaFirstPolicyIssueFromLine = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult,
  line: string
): O.Option<QualityIssue> =>
  pipe(
    decodeSchemaFirstPolicyFindingLine(line),
    O.flatMap((finding) =>
      pipe(
        O.all({
          remediation: O.fromUndefinedOr(finding.remediation),
          severity: schemaFirstPolicyFindingSeverity(finding.severity),
        }),
        O.map(({ remediation, severity }) => ({ finding, remediation, severity }))
      )
    ),
    O.map(({ finding, remediation, severity }) => {
      const file = O.some(finding.file);
      const startLine = O.fromUndefinedOr(finding.line);
      const inferredPackageName = pipe(
        file,
        O.flatMap((path) => packageNameForFile(context, path))
      );
      return QualityIssue.make({
        ...issueBase(context, step, result, "schema-first-policy", finding.message, inferredPackageName),
        id: issueId(
          step,
          "schema-first-policy",
          `${finding.ruleId}: ${finding.message}`,
          inferredPackageName,
          file,
          startLine
        ),
        subCategory: finding.ruleId,
        severity,
        confidence: "structured",
        evidence: [line],
        remediation,
        file: finding.file,
        ...optionalProp("line", startLine),
        ...optionalProp("symbol", O.fromUndefinedOr(finding.symbol)),
      });
    })
  );

type StepFailureAttribution = {
  readonly category: QualityIssueCategory;
  readonly message: string;
  readonly subCategory: O.Option<string>;
  readonly remediation: O.Option<string>;
};

// The lane-run record names the red lane precisely, so the packet issue
// follows it the same way the verdict's `repairCommand` does: the red lane's
// catalog hint by id, else a marker inside its own output segment, else the
// lane itself (its id, label, and recorded launch command). Scanning the whole
// wrapper output for markers is only the fallback when the record names no red
// lane, because a passing sibling's marker (`security:osv-scan`,
// `changeset-status`) sits in the same log as the real failure and used to win
// the hint.
const stepFailureAttribution = (
  step: RepoPlanStep,
  result: RepoStepRunResult,
  laneRuns: ReadonlyArray<QualityTaskLaneRun>
): StepFailureAttribution => {
  const redLane = firstRedLaneRun(laneRuns);
  const hint = O.match(redLane, {
    onNone: () => knownSubLaneHintFromOutput(result.output),
    onSome: (lane) => knownSubLaneHintForLaneRun(lane, laneRunLabels(laneRuns), result.output),
  });
  const failedIn = pipe(
    O.map(hint, (value) => value.subCategory),
    O.orElse(() => O.map(redLane, (lane) => lane.label))
  );
  return {
    category: pipe(
      O.map(hint, (value) => value.category),
      O.orElse(() => O.flatMap(redLane, (lane) => categoryForLabel(lane.label))),
      O.getOrElse(() => categoryForStep(step))
    ),
    message: O.match(failedIn, {
      onNone: () => `${step.label} failed with exit code ${result.exitCode}.`,
      onSome: (name) => `${step.label} failed in ${name} with exit code ${result.exitCode}.`,
    }),
    subCategory: pipe(
      O.map(hint, (value) => value.subCategory),
      O.orElse(() => O.map(redLane, (lane) => lane.id))
    ),
    remediation: pipe(
      O.map(hint, (value) => value.remediation),
      O.orElse(() => O.flatMap(redLane, (lane) => lane.commandText))
    ),
  };
};

const fallbackIssueFromResult = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult,
  attribution: StepFailureAttribution,
  inferredPackageName: O.Option<string> = O.none()
): QualityIssue =>
  QualityIssue.make({
    ...issueBase(context, step, result, attribution.category, attribution.message, inferredPackageName),
    id: issueId(step, attribution.category, attribution.message, inferredPackageName, O.none(), O.none()),
    severity: "error",
    confidence: "raw",
    ...optionalProp("subCategory", attribution.subCategory),
    ...optionalProp("remediation", attribution.remediation),
  });

const fallbackIssuesFromResult = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult,
  laneRuns: ReadonlyArray<QualityTaskLaneRun>
): ReadonlyArray<QualityIssue> => {
  const packageNames = filteredPackageNamesForStep(step);
  const attribution = stepFailureAttribution(step, result, laneRuns);
  return A.isReadonlyArrayNonEmpty(packageNames)
    ? pipe(
        packageNames,
        A.map((packageName) => fallbackIssueFromResult(context, step, result, attribution, O.some(packageName)))
      )
    : [fallbackIssueFromResult(context, step, result, attribution)];
};

/**
 * Convert a failed step result into quality issues.
 *
 * **Example** (Failed step quality issues)
 *
 * ```ts
 * import { qualityIssuesFromStepResult, RepoPlanStep, RepoRunContext, RepoStepRunResult, TurboPlanSnapshot } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "repo-cli-yeet",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] })
 * })
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: "/repo",
 *   id: "feedback:check",
 *   label: "feedback:check",
 *   mutability: "readonly",
 *   phase: "feedback",
 *   resume: "never",
 *   scope: "repo"
 * })
 * const result = RepoStepRunResult.make({ commandText: "bun run check", exitCode: 1, output: "check failed", stepId: step.id })
 * console.log(qualityIssuesFromStepResult(context, step, result))
 * ```
 *
 * **Details**
 *
 * `laneRuns` are the inner lanes the step recorded in the durable
 * `quality-task-lane-run/v1` report. When the step failed without a structured
 * finding, the raw issue's sub-category, category, message, and remediation
 * follow the first red recorded lane; the whole-output marker scan runs only
 * when the record names no red lane.
 *
 * @param context - Shared run context.
 * @param step - Planned step that produced the result.
 * @param result - Captured step result.
 * @param laneRuns - Inner lanes the step recorded, in record order; empty for
 * steps that emit no lane-run report.
 * @returns Structured or raw issues; successful results produce no issues.
 * @category parsing
 * @since 0.0.0
 */
export const qualityIssuesFromStepResult: {
  (
    context: RepoRunContext,
    step: RepoPlanStep,
    result: RepoStepRunResult,
    laneRuns?: ReadonlyArray<QualityTaskLaneRun>
  ): ReadonlyArray<QualityIssue>;
  (
    step: RepoPlanStep,
    result: RepoStepRunResult,
    laneRuns?: ReadonlyArray<QualityTaskLaneRun>
  ): (context: RepoRunContext) => ReadonlyArray<QualityIssue>;
} = dual(
  // Both forms accept three arguments, so arity cannot tell them apart: the
  // data-first form is the one whose first argument is the run context.
  (args) => P.hasProperty(args[0], "repoRoot"),
  (
    context: RepoRunContext,
    step: RepoPlanStep,
    result: RepoStepRunResult,
    laneRuns: ReadonlyArray<QualityTaskLaneRun> = A.empty()
  ): ReadonlyArray<QualityIssue> => {
    if (result.exitCode === 0) {
      return A.empty();
    }

    const parsedIssues = pipe(
      result.output ?? "",
      nonEmptyLines,
      A.map((line) =>
        pipe(
          schemaFirstPolicyIssueFromLine(context, step, result, line),
          O.orElse(() => diagnosticIssueFromLine(context, step, result, line))
        )
      ),
      A.getSomes
    );

    return A.isReadonlyArrayNonEmpty(parsedIssues)
      ? parsedIssues
      : fallbackIssuesFromResult(context, step, result, laneRuns);
  }
);
