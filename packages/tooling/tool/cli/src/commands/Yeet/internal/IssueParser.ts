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
import * as Str from "effect/String";
import { optionalProp } from "../../../internal/cli/OptionRecord.ts";
import { decodeSchemaFirstPolicyFindingLine } from "../../../internal/quality/SchemaFirstPolicyFinding.ts";
import { commandTextForStep, TurboWorkspacePackage, turboTaskForStep } from "../../../internal/repo-run/index.ts";
import { QualityIssue } from "../Yeet.schemas.ts";
import { categoryForStep, knownSubLaneHintFromOutput, routeForCategory } from "./IssueClassification.ts";
import type {
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  TurboPlanTask,
} from "../../../internal/repo-run/index.ts";
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

const fallbackIssueFromResult = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult,
  inferredPackageName: O.Option<string> = O.none()
): QualityIssue => {
  const subLaneHint = knownSubLaneHintFromOutput(result.output);
  const category = pipe(
    subLaneHint,
    O.map((hint) => hint.category),
    O.getOrElse(() => categoryForStep(step))
  );
  const message = pipe(
    subLaneHint,
    O.map((hint) => `${step.label} failed in ${hint.subCategory} with exit code ${result.exitCode}.`),
    O.getOrElse(() => `${step.label} failed with exit code ${result.exitCode}.`)
  );
  return QualityIssue.make({
    ...issueBase(context, step, result, category, message, inferredPackageName),
    id: issueId(step, category, message, inferredPackageName, O.none(), O.none()),
    severity: "error",
    confidence: "raw",
    ...optionalProp(
      "subCategory",
      pipe(
        subLaneHint,
        O.map((hint) => hint.subCategory)
      )
    ),
    ...optionalProp(
      "remediation",
      pipe(
        subLaneHint,
        O.map((hint) => hint.remediation)
      )
    ),
  });
};

const fallbackIssuesFromResult = (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult
): ReadonlyArray<QualityIssue> => {
  const packageNames = filteredPackageNamesForStep(step);
  return A.isReadonlyArrayNonEmpty(packageNames)
    ? pipe(
        packageNames,
        A.map((packageName) => fallbackIssueFromResult(context, step, result, O.some(packageName)))
      )
    : [fallbackIssueFromResult(context, step, result)];
};

/**
 * Convert a failed step result into quality issues.
 *
 * @param context - Shared run context.
 * @param step - Planned step that produced the result.
 * @param result - Captured step result.
 * @returns Structured or raw issues; successful results produce no issues.
 * @example
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
 * @category parsing
 * @since 0.0.0
 */
export const qualityIssuesFromStepResult: {
  (context: RepoRunContext, step: RepoPlanStep, result: RepoStepRunResult): ReadonlyArray<QualityIssue>;
  (step: RepoPlanStep, result: RepoStepRunResult): (context: RepoRunContext) => ReadonlyArray<QualityIssue>;
} = dual(3, (context: RepoRunContext, step: RepoPlanStep, result: RepoStepRunResult): ReadonlyArray<QualityIssue> => {
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

  return A.isReadonlyArrayNonEmpty(parsedIssues) ? parsedIssues : fallbackIssuesFromResult(context, step, result);
});
