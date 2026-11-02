/**
 * Human-first docgen command group.
 *
 * Restores the old subtree command surface in current repo style while
 * keeping generation deterministic and quality review advisory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { jsonFlag } from "../../internal/cli/Flags.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { reportDocgenCommandError } from "./Docgen.errors.ts";
import {
  defaultAnalysisPath,
  defaultQualityPath,
  generateAnalysisJson,
  generateAnalysisReport,
  logAggregateResults,
  logGenerationResults,
  printDocgenIndex,
  renderDocgenJson,
} from "./Docgen.render.ts";
import { DoctestCliConfig, DoctestReport } from "./Doctest.schemas.ts";
import { DoctestFenceAnalyzer, DoctestFenceRewriter } from "./Doctest.service.ts";
import { DoctestFenceAnalyzerLive, DoctestFenceRewriterLive } from "./internal/Doctest.ts";
import { renderDocgenIssueText, runDocgenLocal } from "./internal/Local.ts";
import {
  aggregateGeneratedDocs,
  analyzePackageDocumentation,
  createDocgenConfigDocument,
  discoverDocgenWorkspacePackages,
  loadDocgenConfigDocument,
  resolveDocgenWorkspacePackage,
  runDocgenForPackage,
} from "./internal/Operations.ts";
import {
  analyzeDocgenQuality,
  generateQualityJson,
  generateQualityReport,
  resolveDocgenQualityTargets,
} from "./internal/Quality.ts";
import {
  includePatternsFromFlag,
  qualityReportHasBlockingFindings,
  resolveAnalyzeTargets,
  resolveGenerateTargets,
  resolvePackageSelector,
  resolvePackageSelectors,
  targetHasCurrentDocgenProofManifest,
  verifyDocgenCheckProofManifests,
} from "./internal/Targets.ts";
import type { MarkPlan } from "./Doctest.schemas.ts";
import type { DocgenPackageAnalysis, DocgenWorkspacePackage } from "./internal/Operations.ts";

const packageFlag = Flag.String("package").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Target a workspace package by name or repo-relative path"),
  Flag.atMost(1),
  Flag.map(A.head)
);
const packagesFlag = Flag.String("package").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Target a workspace package by name or repo-relative path; repeat to target several in order"),
  Flag.atLeast(0)
);
const filterFlag = Flag.String("filter").pipe(
  Flag.withDescription('Compatibility selector for commands like "bun run docgen --filter=@beep/schema"'),
  Flag.optional
);
const requiredPackageFlag = Flag.String("package").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Target a workspace package by name or repo-relative path"),
  Flag.between(1, 1),
  Flag.filterMap(A.head, () => "Expected exactly one --package value")
);
const outputFlag = Flag.String("output").pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Write output to a specific file path"),
  Flag.optional
);
const localBaseFlag = Flag.String("base").pipe(
  Flag.withDefault("origin/main"),
  Flag.withDescription("Git base ref used for local changed-file discovery")
);
const localHeadFlag = Flag.String("head").pipe(
  Flag.withDefault("HEAD"),
  Flag.withDescription("Git head ref used for local changed-file discovery")
);
const includeFlag = Flag.String("include").pipe(
  Flag.withDescription("Comma-separated package-relative or srcDir-relative file globs to include"),
  Flag.optional
);
const doctestWriteFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Apply the verified marker and assertion rewrite plan")
);
const planFlag = Flag.Boolean("plan").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the local docgen plan without executing it")
);
const fullFlag = Flag.Boolean("full").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run the canonical full docgen proof")
);
const allowFullFlag = Flag.Boolean("allow-full").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Execute the canonical full docgen proof automatically when the bounded plan requires it")
);
const allFlag = Flag.Boolean("all").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run against every configured docgen package")
);
const checkFlag = Flag.Boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Fail when the command reports failure findings")
);
const reuseProofManifestFlag = Flag.Boolean("reuse-proof-manifest").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip docgen metadata analysis for packages with current package-local proof manifests")
);
const changedFilesFlag = Flag.Boolean("changed-files").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Run against packages touched by working-tree TypeScript changes only")
);
const qualityScoreFlag = Flag.ChoiceWithValue("score", [
  ["none", "none"],
  ["rubric", "rubric"],
  ["codex", "codex"],
]).pipe(
  Flag.withDefault("rubric"),
  Flag.withDescription(
    "Advisory scoring mode: rubric for deterministic findings, none as a compatibility alias, codex for Codex-ready packets"
  )
);
const packetLimitFlag = Flag.Int("packet-limit").pipe(
  Flag.withDefault(25),
  Flag.withDescription(
    "Maximum number of Codex advisory remediation packets to emit; use 0 to suppress packets; must be zero or greater"
  )
);
const verboseFlag = Flag.Boolean("verbose").pipe(
  Flag.withDefault(false),
  Flag.withAlias("v"),
  Flag.withDescription("Include extra package detail")
);
const cleanFlag = Flag.Boolean("clean").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Remove docs/generated before aggregating")
);
const forceFlag = Flag.Boolean("force").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Overwrite an existing docgen.json file")
);
const dryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Preview output without writing files")
);
const fixModeFlag = Flag.Boolean("fix-mode").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the markdown analysis as a checklist rather than a findings report")
);
const validateExamplesFlag = Flag.Boolean("validate-examples").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Compatibility flag; the repo-local docgen implementation always validates extracted examples")
);
const parallelFlag = Flag.Int("parallel").pipe(
  Flag.withAlias("j"),
  Flag.withDefault(4),
  Flag.withDescription("Maximum number of packages to process concurrently")
);
const docgenConcurrencyConfig = Config.Int("BEEP_DOCGEN_CONCURRENCY").pipe(Config.withDefault(3));
const localParallelFlag = Flag.Int("parallel").pipe(
  Flag.withAlias("j"),
  Flag.optional,
  Flag.withDescription("Maximum number of local docgen packages to process concurrently")
);

const docgenInitCommand = Command.make(
  "init",
  {
    package: requiredPackageFlag,
    dryRun: dryRunFlag,
    force: forceFlag,
  },
  Effect.fn(
    function* ({ package: selector, dryRun, force }) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const target = yield* resolveDocgenWorkspacePackage(selector);
      const configPath = path.join(target.absolutePath, "docgen.json");

      if (target.hasDocgenConfig && !force) {
        yield* Console.error(
          `docgen: ${target.relativePath} already has docgen.json. Re-run with --force to overwrite.`
        );
        return yield* failWithReportedExit(`docgen: ${target.relativePath} already has docgen.json.`);
      }

      const config = yield* createDocgenConfigDocument(target, repoRoot);
      const content = yield* renderBiomeJson(configPath, config);

      if (dryRun) {
        yield* printLines([`--- ${configPath} ---`, content]);
        return;
      }

      yield* fs.writeFileString(configPath, content);
      yield* Console.log(`docgen: wrote ${configPath}`);
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Create or refresh docgen.json for a workspace package"));

const renderVerboseDocgenStatus = Effect.fn("Docgen.renderVerboseStatus")(function* (pkg: DocgenWorkspacePackage) {
  yield* printLines([
    "",
    pkg.name,
    `  path: ${pkg.relativePath}`,
    `  status: ${pkg.status}`,
    `  aggregate: docs/generated/${pkg.docsOutputPath}`,
  ]);
  if (!pkg.hasDocgenConfig) return;
  const config = yield* loadDocgenConfigDocument(pkg.absolutePath).pipe(Effect.option);
  if (O.isSome(config)) {
    yield* printLines([
      `  srcDir: ${config.value.srcDir ?? "src"}`,
      `  outDir: ${config.value.outDir ?? "docs"}`,
      `  exclude: ${A.join(config.value.exclude ?? [], ", ") || "none"}`,
    ]);
  }
});

const docgenStatusCommand = Command.make(
  "status",
  {
    verbose: verboseFlag,
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ verbose, json }) {
      const packages = yield* discoverDocgenWorkspacePackages();
      const configuredAndGenerated = A.filter(packages, (pkg) => pkg.status === "configured-and-generated");
      const configuredNotGenerated = A.filter(packages, (pkg) => pkg.status === "configured-not-generated");
      const notConfigured = A.filter(packages, (pkg) => pkg.status === "not-configured");

      if (json) {
        yield* Console.log(
          yield* renderDocgenJson({
            packages,
            summary: {
              total: packages.length,
              configuredAndGenerated: configuredAndGenerated.length,
              configuredNotGenerated: configuredNotGenerated.length,
              notConfigured: notConfigured.length,
            },
          })
        );
        return;
      }

      yield* printLines([
        "Docgen status:",
        `- configured and generated: ${configuredAndGenerated.length}`,
        `- configured, not generated: ${configuredNotGenerated.length}`,
        `- not configured: ${notConfigured.length}`,
      ]);

      if (!verbose) {
        return;
      }

      yield* Effect.forEach(packages, renderVerboseDocgenStatus, { discard: true });
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Show docgen configuration and generation status across the workspace"));

const docgenGenerateCommand = Command.make(
  "generate",
  {
    package: packagesFlag,
    filter: filterFlag,
    include: includeFlag,
    validateExamples: validateExamplesFlag,
    parallel: parallelFlag,
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, filter: filterSelector, include, validateExamples, parallel, json }) {
      void validateExamples;
      const selectors = yield* resolvePackageSelectors(packageSelector, filterSelector);
      const targets = yield* resolveGenerateTargets(selectors);
      const includePatterns = includePatternsFromFlag(include);

      if (targets.length === 0) {
        yield* Console.log("docgen: no configured packages found");
        return;
      }

      const results = yield* Effect.forEach(
        targets,
        (target) => runDocgenForPackage(target, { include: includePatterns }),
        {
          concurrency: Math.max(1, parallel),
        }
      );

      if (json) {
        yield* Console.log(yield* renderDocgenJson(results));
        if (A.some(results, (result) => !result.success)) {
          return yield* failWithReportedExit("docgen: generation failed for one or more package(s).");
        }
        return;
      }

      const failures = yield* logGenerationResults(results);
      if (failures > 0) {
        return yield* failWithReportedExit("docgen: generation failed for one or more package(s).");
      }
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(
  Command.withDescription(
    "Run the repo-local @beep/repo-docgen implementation for each named package or every configured package"
  )
);

const docgenRunCommand = Command.make(
  "run",
  {
    package: packageFlag,
    filter: filterFlag,
    include: includeFlag,
    validateExamples: validateExamplesFlag,
    parallel: parallelFlag,
    clean: cleanFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, filter: filterSelector, include, validateExamples, parallel, clean }) {
      void validateExamples;
      const selector = yield* resolvePackageSelector(packageSelector, filterSelector);
      const targets = yield* selector.pipe(O.toArray, resolveGenerateTargets);
      const includePatterns = includePatternsFromFlag(include);

      if (targets.length === 0) {
        yield* Console.log("docgen: no configured packages found");
        return;
      }

      const generationResults = yield* Effect.forEach(
        targets,
        (target) => runDocgenForPackage(target, { include: includePatterns }),
        {
          concurrency: Math.max(1, parallel),
        }
      );

      const generationFailures = yield* logGenerationResults(generationResults);

      if (A.some(generationResults, (result) => !result.success)) {
        yield* Console.log("docgen: skipping aggregation because generation failed for one or more package(s)");
        return yield* failWithReportedExit(
          `docgen: generation failed for ${generationFailures} package(s); aggregation was skipped.`
        );
      }

      const aggregateResults = yield* aggregateGeneratedDocs({
        clean,
        ...O.getSomesStruct({
          package: selector,
        }),
      });
      yield* logAggregateResults(aggregateResults);
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(
  Command.withDescription(
    "Run generation and aggregation together using a single package selector so both phases stay in scope"
  )
);

const docgenAggregateCommand = Command.make(
  "aggregate",
  {
    package: packageFlag,
    filter: filterFlag,
    clean: cleanFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, filter: filterSelector, clean }) {
      const selector = yield* resolvePackageSelector(packageSelector, filterSelector);
      const results = yield* aggregateGeneratedDocs({
        clean,
        ...O.getSomesStruct({ package: selector }),
      });
      yield* logAggregateResults(results);
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Copy generated package docs into the ignored root docs/generated layout"));

const docgenLocalCommand = Command.make(
  "local",
  {
    package: packageFlag,
    base: localBaseFlag,
    head: localHeadFlag,
    parallel: localParallelFlag,
    plan: planFlag,
    full: fullFlag,
    allowFull: allowFullFlag,
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, allowFull, base, head, parallel, plan, full, json }) {
      const configuredParallel = yield* docgenConcurrencyConfig;
      yield* runDocgenLocal({
        allowFull,
        base,
        full,
        head,
        json,
        packageSelector,
        parallel: O.getOrElse(parallel, () => configuredParallel),
        plan,
      });
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Run a bounded local docgen proof for changed package surfaces"));

const analysisJsonContent = Effect.fn("Docgen.analysisJsonContent")(function* (
  analyses: ReadonlyArray<DocgenPackageAnalysis>
) {
  const only = A.head(analyses);
  return yield* O.isSome(only) && A.length(analyses) === 1
    ? Effect.succeed(generateAnalysisJson(only.value))
    : renderDocgenJson(analyses);
});

const emitOptionalOutputContent = Effect.fn("Docgen.emitOptionalOutputContent")(function* (
  output: O.Option<string>,
  content: string
) {
  if (O.isNone(output)) {
    yield* Console.log(content);
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(output.value, content);
  yield* Console.log(`docgen: wrote ${output.value}`);
});

const renderAnalysisJson = Effect.fn("Docgen.renderAnalysisJson")(function* (
  analyses: ReadonlyArray<DocgenPackageAnalysis>,
  output: O.Option<string>
) {
  const content = yield* analysisJsonContent(analyses);
  yield* emitOptionalOutputContent(output, content);
});

const writeSelectedAnalysis = Effect.fn("Docgen.writeSelectedAnalysis")(function* (
  target: DocgenWorkspacePackage,
  analysis: DocgenPackageAnalysis,
  output: O.Option<string>,
  fixMode: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destination = O.getOrElse(output, () => defaultAnalysisPath(target.absolutePath, false, path));
  yield* fs.writeFileString(destination, generateAnalysisReport(analysis, fixMode));
  yield* Console.log(`docgen: wrote ${destination}`);
});

const writeAllAnalyses = Effect.fn("Docgen.writeAllAnalyses")(function* (
  targets: ReadonlyArray<DocgenWorkspacePackage>,
  analyses: ReadonlyArray<DocgenPackageAnalysis>,
  fixMode: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(
    A.zip(targets, analyses),
    Effect.fnUntraced(function* ([target, analysis]) {
      const destination = defaultAnalysisPath(target.absolutePath, false, path);
      yield* fs.writeFileString(destination, generateAnalysisReport(analysis, fixMode));
      yield* Console.log(`docgen: wrote ${destination}`);
    }),
    { discard: true }
  );
});

const docgenAnalyzeCommand = Command.make(
  "analyze",
  {
    package: packageFlag,
    output: outputFlag,
    json: jsonFlag,
    fixMode: fixModeFlag,
  },
  Effect.fn(
    function* ({ package: selector, output, json, fixMode }) {
      const targets = yield* selector.pipe(O.toArray, resolveAnalyzeTargets);

      if (targets.length === 0) {
        yield* Console.log("docgen: no packages selected for analysis");
        return;
      }

      if (O.isSome(output) && O.isNone(selector)) {
        yield* Console.error("docgen: --output requires --package so the destination is unambiguous.");
        return yield* failWithReportedExit("docgen: --output requires --package.");
      }

      const analyses = yield* Effect.forEach(targets, analyzePackageDocumentation, {
        concurrency: 4,
      });

      if (json) {
        yield* renderAnalysisJson(analyses, output);
        return;
      }

      if (O.isSome(selector)) {
        const selected = O.all({ target: A.head(targets), analysis: A.head(analyses) });
        if (O.isSome(selected))
          yield* writeSelectedAnalysis(selected.value.target, selected.value.analysis, output, fixMode);
        return;
      }
      yield* writeAllAnalyses(targets, analyses, fixMode);
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Analyze JSDoc coverage and write a human-first report"));

const renderDocgenCheckAnalysis = Effect.fn("Docgen.renderCheckAnalysis")(function* (analysis: DocgenPackageAnalysis) {
  const issues = A.filter(
    analysis.exports,
    (entry) => A.isReadonlyArrayNonEmpty(entry.missingTags) || A.isReadonlyArrayNonEmpty(entry.categoryIssues)
  );
  if (A.isReadonlyArrayEmpty(issues)) {
    yield* Console.log(`docgen: OK ${analysis.packagePath}`);
    return;
  }
  yield* Console.error(
    `docgen: ${analysis.packagePath} has ${analysis.summary.missingDocumentation} export(s) missing docgen metadata`
  );
  yield* Effect.forEach(
    issues,
    (issue) =>
      Console.error(
        `  ${issue.filePath}:${issue.line} ${issue.name} ${renderDocgenIssueText(issue.missingTags, issue.categoryIssues)}`
      ),
    { discard: true }
  );
});

const docgenCheckCommand = Command.make(
  "check",
  {
    package: packagesFlag,
    parallel: parallelFlag,
    json: jsonFlag,
    reuseProofManifest: reuseProofManifestFlag,
  },
  Effect.fn(
    function* ({ package: selectors, parallel, json, reuseProofManifest }) {
      const targets = yield* resolveAnalyzeTargets(selectors);

      if (targets.length === 0) {
        yield* Console.log("docgen: no packages selected for check");
        return;
      }

      const proofManifests = reuseProofManifest ? yield* verifyDocgenCheckProofManifests(targets) : [];
      const analysisTargets = reuseProofManifest
        ? A.filter(targets, (target) => !targetHasCurrentDocgenProofManifest(proofManifests, target))
        : targets;
      const skippedByProofManifest = targets.length - analysisTargets.length;
      const analyses = yield* Effect.forEach(analysisTargets, analyzePackageDocumentation, {
        concurrency: Math.max(1, parallel),
      });
      const failures = A.filter(analyses, (analysis) => analysis.summary.missingDocumentation > 0);

      if (json) {
        yield* Console.log(
          yield* renderDocgenJson({
            analyses,
            proofManifests,
            summary: {
              packages: targets.length,
              analyzedPackages: analyses.length,
              skippedByProofManifest,
              failingPackages: failures.length,
              missingDocumentation: A.reduce(
                failures,
                0,
                (total, analysis) => total + analysis.summary.missingDocumentation
              ),
            },
          })
        );
        if (failures.length > 0) {
          return yield* failWithReportedExit("docgen: check found missing documentation.");
        }
        return;
      }

      if (skippedByProofManifest > 0) {
        yield* Console.log(`docgen: skipped ${skippedByProofManifest} package(s) with current proof manifests`);
      }

      yield* Effect.forEach(analyses, renderDocgenCheckAnalysis, { discard: true });

      if (failures.length > 0) {
        return yield* failWithReportedExit("docgen: check found missing documentation.");
      }
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Fail when package exports are missing required JSDoc/docgen metadata"));

const qualityOutputPath = (
  output: O.Option<string>,
  packageSelector: O.Option<string>,
  targets: ReadonlyArray<DocgenWorkspacePackage>,
  json: boolean,
  path: Path.Path
): O.Option<string> => {
  if (O.isSome(output)) return output;
  if (O.isNone(packageSelector) || A.length(targets) !== 1) return O.none();
  return O.map(A.head(targets), (target) => defaultQualityPath(target.absolutePath, json, path));
};

const emitQualityContent = Effect.fn("Docgen.emitQualityContent")(function* (
  output: O.Option<string>,
  packageSelector: O.Option<string>,
  targets: ReadonlyArray<DocgenWorkspacePackage>,
  json: boolean,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const destination = qualityOutputPath(output, packageSelector, targets, json, path);
  if (O.isNone(destination)) {
    yield* Console.log(content);
    return;
  }
  yield* fs.writeFileString(destination.value, content);
  yield* Console.log(`docgen: wrote ${destination.value}`);
});

const docgenQualityCommand = Command.make(
  "quality",
  {
    package: packageFlag,
    all: allFlag,
    check: checkFlag,
    changedFiles: changedFilesFlag,
    output: outputFlag,
    json: jsonFlag,
    score: qualityScoreFlag,
    packetLimit: packetLimitFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, all, check, changedFiles, output, json, score, packetLimit }) {
      const { scope, targets } = yield* resolveDocgenQualityTargets({
        all,
        changedFiles,
        packageSelector,
      });

      if (targets.length === 0) {
        yield* Console.log("docgen: no packages selected for quality analysis");
        return;
      }

      if (packetLimit < 0) {
        return yield* DomainError.make({
          message: "--packet-limit must be zero or greater; use 0 to suppress packets",
        });
      }

      const report = yield* analyzeDocgenQuality({
        packetLimit,
        scope,
        scoreMode: score,
        targets,
      });
      const content = json ? yield* generateQualityJson(report) : generateQualityReport(report);
      yield* emitQualityContent(output, packageSelector, targets, json, content);
      if (check && qualityReportHasBlockingFindings(report)) {
        return yield* failWithReportedExit("docgen: quality check found failures.");
      }
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(
  Command.withDescription(
    "Produce a report-only exported-symbol JSDoc quality report with bounded advisory remediation packets"
  )
);

const doctestRuntimeLayer = Layer.merge(DoctestFenceAnalyzerLive, DoctestFenceRewriterLive);
const encodeDoctestReport = S.encodeUnknownEffect(DoctestReport);

const doctestPlans = (report: DoctestReport): ReadonlyArray<MarkPlan> =>
  pipe(
    report.findings,
    A.flatMap((finding) => O.match(O.fromUndefinedOr(finding.plan), { onNone: A.empty<MarkPlan>, onSome: A.of })),
    A.dedupeWith(
      (left, right) =>
        left.location.file === right.location.file && left.location.startLine === right.location.startLine
    )
  );

const renderDoctestReport = Effect.fn("Docgen.renderDoctestReport")(function* (report: DoctestReport, json: boolean) {
  if (json) {
    const encoded = yield* encodeDoctestReport(report);
    yield* Console.log(yield* jsonStringifyPretty(encoded));
    return;
  }
  yield* Console.log(
    `doctest: ${report.counts.files} file(s), ${report.counts.fences} fence(s), ` +
      `${report.counts.pure} pure, ${report.counts.impure} impure, ${report.counts.typeOnly} type-only`
  );
  yield* Console.log(
    `doctest: ${report.counts.plannedMarkers} marker(s) and ` +
      `${report.counts.plannedConsoleRewrites} console rewrite(s) planned`
  );
  for (const finding of report.findings) {
    yield* Console.log(`${finding.location.file}:${finding.location.startLine} ${finding.kind}: ${finding.message}`);
  }
});

const reportDoctestError = (error: { readonly message: string }) =>
  Console.error(`docgen doctest: ${error.message}`).pipe(
    Effect.andThen(failWithReportedExit(`docgen doctest: ${error.message}`))
  );

const doctestConfig = (
  write: boolean,
  filter: O.Option<string>,
  include: O.Option<string>,
  json: boolean
): DoctestCliConfig =>
  DoctestCliConfig.make({
    write,
    include: includePatternsFromFlag(include),
    json,
    ...O.getSomesStruct({ filter }),
  });

const docgenDoctestMarkCommand = Command.make(
  "mark",
  {
    write: doctestWriteFlag,
    filter: filterFlag,
    include: includeFlag,
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ write, filter, include, json }) {
      const analyzer = yield* DoctestFenceAnalyzer;
      const rewriter = yield* DoctestFenceRewriter;
      const config = doctestConfig(write, filter, include, json);
      const report = yield* analyzer.analyze(config);
      const changedFiles = yield* write ? rewriter.write(doctestPlans(report)) : rewriter.preview(doctestPlans(report));
      yield* renderDoctestReport(DoctestReport.make({ ...report, changedFiles }), json);
    },
    Effect.catchTags({
      DoctestAnalysisError: reportDoctestError,
      DoctestRewriteError: reportDoctestError,
    })
  )
).pipe(Command.withDescription("Plan or apply canonical runtime markers and safe console assertion rewrites"));

const docgenDoctestVerifyCommand = Command.make(
  "verify",
  {
    filter: filterFlag,
    include: includeFlag,
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ filter, include, json }) {
      const analyzer = yield* DoctestFenceAnalyzer;
      const report = yield* analyzer.analyze(doctestConfig(false, filter, include, json));
      yield* renderDoctestReport(report, json);
      yield* analyzer.validateMarkedAssertions(report);
    },
    Effect.catchTag("DoctestAnalysisError", reportDoctestError)
  )
).pipe(Command.withDescription("Verify runtime marker metadata, purity, and upstream assertion transforms"));

const docgenDoctestCommand = Command.make("doctest", {}).pipe(
  Command.withDescription("Analyze and maintain runnable JSDoc TypeScript fences"),
  Command.withSubcommands([docgenDoctestMarkCommand, docgenDoctestVerifyCommand]),
  Command.provide(doctestRuntimeLayer)
);

/**
 * Human-first docgen command suite.
 *
 * **Details**
 *
 * The `quality` subcommand is advisory/report-only unless `--check` is used;
 * `local` plans from changed files before choosing a scoped or full docgen run.
 *
 * **Example** (Run the docgen command)
 *
 * ```ts
 * import { docgenCommand } from "@beep/repo-cli/commands/Docgen"
 * import * as Command from "effect/cli/Command";
 * const runDocgen = Command.runWith(docgenCommand, { version: "0.0.0" })
 * const qualityArgs = ["quality", "-p", "packages/tooling/tool/cli", "--json", "--score", "codex"]
 * const program = runDocgen(qualityArgs)
 * console.log(qualityArgs.join(" "))
 * console.log(program) // example value
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const docgenCommand = Command.make("docgen", {}, () => printDocgenIndex).pipe(
  Command.withDescription("Documentation generation, analysis, and report-only quality review utilities"),
  Command.withSubcommands([
    docgenStatusCommand,
    docgenInitCommand,
    docgenGenerateCommand,
    docgenRunCommand,
    docgenAggregateCommand,
    docgenLocalCommand,
    docgenAnalyzeCommand,
    docgenCheckCommand,
    docgenQualityCommand,
    docgenDoctestCommand,
  ])
);
