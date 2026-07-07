/**
 * Human-first docgen command group.
 *
 * Restores the old subtree command surface in current repo style while
 * keeping generation deterministic and quality review advisory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { verifyDocgenProofManifest } from "@beep/repo-docgen/ProofManifest";
import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { Runpod, RunpodConfigInput } from "@beep/runpod";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Console, Effect, FileSystem, flow, Layer, Match, Path, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import * as jsonc from "jsonc-parser";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { jsonFlag } from "../../internal/cli/Flags.js";
import { printLines } from "../../internal/cli/Printer.js";
import { runDocgenLocal } from "./internal/Local.js";
import {
  aggregateGeneratedDocs,
  analyzePackageDocumentation,
  assertNoOrphanDocgenConfigPaths,
  createDocgenConfigDocument,
  discoverDocgenWorkspacePackages,
  generateAnalysisJson,
  generateAnalysisReport,
  loadDocgenConfigDocument,
  resolveDocgenWorkspacePackage,
  runDocgenForPackage,
} from "./internal/Operations.js";
import {
  analyzeDocgenQuality,
  generateQualityJson,
  generateQualityReport,
  resolveDocgenQualityTargets,
} from "./internal/Quality.js";
import {
  analyzeDocgenQualityWorkerEval,
  decodeDocgenQualityReportForWorkerEval,
  defaultQualityWorkerEvalPacketLimit,
  defaultQualityWorkerEvalReasoningEffort,
  generateQualityWorkerEvalJson,
  qualityWorkerEvalSourcePacketLimit,
} from "./internal/QualityWorkerEval.js";
import {
  defaultQualityWorkerRunpodEvalOtlpBaseUrl,
  defaultQualityWorkerRunpodEvalOtlpProject,
  defaultQualityWorkerRunpodEvalPacketLimit,
  defaultQualityWorkerRunpodEvalReadinessTimeoutMs,
  generateQualityWorkerRunpodEvalJson,
  requiredQualityWorkerRunpodEvalModel,
  runDocgenQualityWorkerRunpodEval,
} from "./internal/QualityWorkerRunpodEval.js";
import type { DocgenAggregateResult, DocgenGenerationResult } from "./internal/Operations.js";

const packageFlag = Flag.string("package").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Target a workspace package by name or repo-relative path"),
  Flag.optional
);
const filterFlag = Flag.string("filter").pipe(
  Flag.withDescription('Compatibility selector for commands like "bun run docgen --filter=@beep/schema"'),
  Flag.optional
);
const requiredPackageFlag = Flag.string("package").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("Target a workspace package by name or repo-relative path")
);
const outputFlag = Flag.string("output").pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Write output to a specific file path"),
  Flag.optional
);
const localBaseFlag = Flag.string("base").pipe(
  Flag.withDefault("origin/main"),
  Flag.withDescription("Git base ref used for local changed-file discovery")
);
const localHeadFlag = Flag.string("head").pipe(
  Flag.withDefault("HEAD"),
  Flag.withDescription("Git head ref used for local changed-file discovery")
);
const inputFlag = Flag.string("input").pipe(
  Flag.withDescription("Read input from a specific file path"),
  Flag.optional
);
const includeFlag = Flag.string("include").pipe(
  Flag.withDescription("Comma-separated package-relative or srcDir-relative file globs to include"),
  Flag.optional
);
const planFlag = Flag.boolean("plan").pipe(Flag.withDescription("Print the local docgen plan without executing it"));
const fullFlag = Flag.boolean("full").pipe(Flag.withDescription("Run the canonical full docgen proof"));
const allFlag = Flag.boolean("all").pipe(Flag.withDescription("Run against every configured docgen package"));
const checkFlag = Flag.boolean("check").pipe(Flag.withDescription("Fail when the command reports failure findings"));
const reuseProofManifestFlag = Flag.boolean("reuse-proof-manifest").pipe(
  Flag.withDescription("Skip docgen metadata analysis for packages with current package-local proof manifests")
);
const changedFilesFlag = Flag.boolean("changed-files").pipe(
  Flag.withDescription("Run against packages touched by working-tree TypeScript changes only")
);
const qualityScoreFlag = Flag.choiceWithValue("score", [
  ["none", "none"],
  ["rubric", "rubric"],
  ["codex", "codex"],
]).pipe(
  Flag.withDefault("rubric"),
  Flag.withDescription(
    "Advisory scoring mode: rubric for deterministic findings, none as a compatibility alias, codex for Codex-ready packets"
  )
);
const packetLimitFlag = Flag.integer("packet-limit").pipe(
  Flag.withDefault(25),
  Flag.withDescription(
    "Maximum number of Codex advisory remediation packets to emit; use 0 to suppress packets; must be zero or greater"
  )
);
const qualityWorkerEvalPacketLimitFlag = Flag.integer("packet-limit").pipe(
  Flag.withDefault(defaultQualityWorkerEvalPacketLimit()),
  Flag.withDescription("Maximum number of remediation packets to send to the worker; must be zero or greater")
);
const qualityWorkerRunpodEvalPacketLimitFlag = Flag.integer("packet-limit").pipe(
  Flag.withDefault(defaultQualityWorkerRunpodEvalPacketLimit()),
  Flag.withDescription("Maximum number of remediation packets to send to the Runpod worker; must be zero or greater")
);
const qualityWorkerEvalProviderFlag = Flag.choiceWithValue("provider", [
  ["codex", "codex"],
  ["ollama", "ollama"],
  ["lmstudio", "lmstudio"],
]).pipe(Flag.withDescription("Codex worker provider to evaluate; choose codex, ollama, or lmstudio"));
const qualityWorkerEvalModelFlag = Flag.string("model").pipe(
  Flag.withDescription("Model id to pass to Codex; required to avoid provider-specific default drift")
);
const qualityWorkerEvalBaseUrlFlag = Flag.string("base-url").pipe(
  Flag.withDescription("Optional OpenAI-compatible base URL passed through to the Codex SDK"),
  Flag.optional
);
const qualityWorkerEvalReasoningEffortFlag = Flag.choiceWithValue("reasoning-effort", [
  ["minimal", "minimal"],
  ["low", "low"],
  ["medium", "medium"],
  ["high", "high"],
  ["xhigh", "xhigh"],
]).pipe(
  Flag.withDescription("Optional Codex reasoning effort; hosted codex defaults to low when omitted"),
  Flag.optional
);
const confirmRunpodEvalFlag = Flag.boolean("confirm-runpod-eval").pipe(
  Flag.withDescription("Acknowledge that quality-worker-eval-runpod creates a billable remote GPU pod")
);
const keepRunpodPodFlag = Flag.boolean("keep-pod").pipe(
  Flag.withDescription("Debug mode: leave the Runpod pod running instead of deleting it after the eval")
);
const allow24GbFallbackFlag = Flag.boolean("allow-24gb-fallback").pipe(
  Flag.withDescription("Allow explicitly verified 24 GiB GPU fallbacks when preferred 48 GiB GPUs are unavailable")
);
const runpodGpuTypeIdsFlag = Flag.string("gpu-type").pipe(
  Flag.withDescription("Comma-separated Runpod GPU type ids; overrides the default 48 GiB preference list"),
  Flag.optional
);
const runpodTemplateIdFlag = Flag.string("template-id").pipe(
  Flag.withDescription(
    "Optional trusted Runpod template id override; otherwise the repo fallback image is used unless public template search is explicitly enabled"
  ),
  Flag.optional
);
const skipRunpodTemplateSearchFlag = Flag.boolean("skip-template-search").pipe(
  Flag.withDescription("Use the repo fallback image instead of searching public Runpod templates")
);
const allowPublicRunpodTemplateSearchFlag = Flag.boolean("allow-public-template-search").pipe(
  Flag.withDescription("Opt into searching public Runpod templates instead of using the repo fallback image")
);
const runpodReadinessTimeoutMsFlag = Flag.integer("readiness-timeout-ms").pipe(
  Flag.withDefault(defaultQualityWorkerRunpodEvalReadinessTimeoutMs()),
  Flag.withDescription("Milliseconds to wait for remote Ollama readiness after pod creation")
);
const qualityWorkerRunpodEvalOtlpFlag = Flag.boolean("otlp").pipe(
  Flag.withDescription("Emit sanitized summary and hashed packet spans to the configured Phoenix OTLP endpoint")
);
const qualityWorkerRunpodEvalOtlpBaseUrlFlag = Flag.string("otlp-base-url").pipe(
  Flag.withDefault(defaultQualityWorkerRunpodEvalOtlpBaseUrl()),
  Flag.withDescription("Phoenix-compatible OTLP collector base URL")
);
const qualityWorkerRunpodEvalOtlpProjectFlag = Flag.string("otlp-project").pipe(
  Flag.withDefault(defaultQualityWorkerRunpodEvalOtlpProject()),
  Flag.withDescription("Phoenix project name carried as openinference.project.name")
);
const verboseFlag = Flag.boolean("verbose").pipe(
  Flag.withAlias("v"),
  Flag.withDescription("Include extra package detail")
);
const cleanFlag = Flag.boolean("clean").pipe(Flag.withDescription("Remove docs/generated before aggregating"));
const forceFlag = Flag.boolean("force").pipe(Flag.withDescription("Overwrite an existing docgen.json file"));
const dryRunFlag = Flag.boolean("dry-run").pipe(Flag.withDescription("Preview output without writing files"));
const fixModeFlag = Flag.boolean("fix-mode").pipe(
  Flag.withDescription("Render the markdown analysis as a checklist rather than a findings report")
);
const validateExamplesFlag = Flag.boolean("validate-examples").pipe(
  Flag.withDescription("Compatibility flag; the repo-local docgen implementation always validates extracted examples")
);
const parallelFlag = Flag.integer("parallel").pipe(
  Flag.withAlias("j"),
  Flag.withDefault(4),
  Flag.withDescription("Maximum number of packages to process concurrently")
);
const localParallelFlag = Flag.integer("parallel").pipe(
  Flag.withAlias("j"),
  Flag.withDefault(1),
  Flag.withDescription("Maximum number of local docgen packages to process concurrently")
);

const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const renderJson: (value: unknown) => Effect.Effect<string, DomainError> = Effect.fn(function* (value) {
  const encoded = yield* encodeJson(value).pipe(
    Effect.mapError(DomainError.newCause("Failed to encode docgen JSON output."))
  );
  const edits = jsonc.format(encoded, undefined, {
    tabSize: 2,
    insertSpaces: true,
  });
  return `${jsonc.applyEdits(encoded, edits)}\n`;
});

const defaultAnalysisPath = (packagePath: string, json: boolean, path: Path.Path): string =>
  path.join(packagePath, json ? "JSDOC_ANALYSIS.json" : "JSDOC_ANALYSIS.md");
const defaultQualityPath = (packagePath: string, json: boolean, path: Path.Path): string =>
  path.join(packagePath, json ? "JSDOC_QUALITY.json" : "JSDOC_QUALITY.md");

const reportDocgenCommandError = Effect.fn(function* (error: { readonly message: string }) {
  yield* Console.error(`docgen: ${error.message}`);
  return yield* failWithReportedExit(`docgen: ${error.message}`);
});

const logGenerationResults = Effect.fn(function* (results: ReadonlyArray<DocgenGenerationResult>) {
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

const logAggregateResults = Effect.fn(function* (results: ReadonlyArray<DocgenAggregateResult>) {
  if (results.length === 0) {
    yield* Console.log("docgen: no generated package docs found to aggregate");
    return;
  }

  for (const result of results) {
    yield* Console.log(`docgen: aggregated ${result.packagePath} -> docs/generated/${result.docsOutputPath}`);
  }
});

const resolveGenerateTargets = Effect.fn("Docgen.resolveGenerateTargets")(function* (selector: O.Option<string>) {
  yield* assertNoOrphanDocgenConfigPaths();

  if (O.isSome(selector)) {
    const target = yield* resolveDocgenWorkspacePackage(selector.value);
    if (!target.hasDocgenConfig) {
      return yield* DomainError.make({
        message: `${target.relativePath} is missing docgen.json. Run "bun run beep docgen init -p ${target.relativePath}" first.`,
      });
    }
    return [target] as const;
  }

  return yield* discoverDocgenWorkspacePackages().pipe(Effect.map(A.filter((pkg) => pkg.hasDocgenConfig)));
});

const resolveAnalyzeTargets = Effect.fn("Docgen.resolveAnalyzeTargets")(function* (selector: O.Option<string>) {
  yield* assertNoOrphanDocgenConfigPaths();

  if (O.isSome(selector)) {
    return [yield* resolveDocgenWorkspacePackage(selector.value)] as const;
  }

  return yield* discoverDocgenWorkspacePackages().pipe(Effect.map(A.filter((pkg) => pkg.hasDocgenConfig)));
});

const resolvePackageSelector = Effect.fn("Docgen.resolvePackageSelector")(function* (
  packageSelector: O.Option<string>,
  filterSelector: O.Option<string>
) {
  if (O.isSome(packageSelector) && O.isSome(filterSelector) && packageSelector.value !== filterSelector.value) {
    return yield* DomainError.make({
      message: `Received conflicting selectors --package=${packageSelector.value} and --filter=${filterSelector.value}.`,
    });
  }

  return O.isSome(packageSelector) ? packageSelector : filterSelector;
});

const splitCommaSeparatedFlag: (value: string) => ReadonlyArray<string> = flow(
  Str.split(","),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty)
);

const includePatternsFromFlag: (include: O.Option<string>) => ReadonlyArray<string> = flow(
  O.map(splitCommaSeparatedFlag),
  O.getOrElse(A.empty<string>)
);

const qualityReportHasBlockingFindings = (report: {
  readonly summary: { readonly failures: number; readonly warnings: number };
  readonly packages: ReadonlyArray<{ readonly status: string }>;
}): boolean =>
  report.summary.failures > 0 ||
  report.summary.warnings > 0 ||
  A.some(report.packages, (pkg) => pkg.status !== "completed");

const verifyDocgenCheckProofManifests = Effect.fn("Docgen.verifyDocgenCheckProofManifests")(function* (
  targets: ReadonlyArray<{ readonly absolutePath: string; readonly name: string; readonly relativePath: string }>
) {
  return yield* Effect.forEach(
    targets,
    (target) =>
      verifyDocgenProofManifest(target.absolutePath, target.name).pipe(
        Effect.mapError(DomainError.newCause(`Failed to verify docgen proof manifest for ${target.relativePath}.`))
      ),
    { concurrency: 4 }
  );
});

const targetHasCurrentDocgenProofManifest = (
  verifications: ReadonlyArray<{ readonly packagePath: string; readonly status: string }>,
  target: { readonly absolutePath: string }
): boolean =>
  A.some(
    verifications,
    (verification) => verification.packagePath === target.absolutePath && verification.status === "current"
  );

const resolveQualityWorkerEvalSource = Effect.fn("Docgen.resolveQualityWorkerEvalSource")(function* ({
  all,
  input,
  packageSelector,
  packetLimit,
}: {
  readonly all: boolean;
  readonly input: O.Option<string>;
  readonly packageSelector: O.Option<string>;
  readonly packetLimit: number;
}) {
  const fs = yield* FileSystem.FileSystem;

  if (O.isSome(input)) {
    return {
      report: yield* fs.readFileString(input.value).pipe(Effect.flatMap(decodeDocgenQualityReportForWorkerEval)),
      scope: "input" as const,
      sourceQualityReport: input.value,
    };
  }

  const { scope, targets } = yield* resolveDocgenQualityTargets({
    all,
    changedFiles: false,
    packageSelector,
  });

  if (targets.length === 0) {
    return yield* DomainError.make({
      message: "No packages selected for docgen quality worker eval.",
    });
  }

  return {
    report: yield* analyzeDocgenQuality({
      packetLimit: qualityWorkerEvalSourcePacketLimit(packetLimit),
      scope,
      scoreMode: "codex",
      targets,
    }),
    scope: scope === "all" ? ("all" as const) : ("package" as const),
    sourceQualityReport: `generated:${scope}`,
  };
});

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
          yield* renderJson({
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

      for (const pkg of packages) {
        yield* printLines([
          ``,
          `${pkg.name}`,
          `  path: ${pkg.relativePath}`,
          `  status: ${pkg.status}`,
          `  aggregate: docs/generated/${pkg.docsOutputPath}`,
        ]);

        if (pkg.hasDocgenConfig) {
          const config = yield* loadDocgenConfigDocument(pkg.absolutePath).pipe(Effect.option);

          if (O.isSome(config)) {
            yield* printLines([
              `  srcDir: ${config.value.srcDir ?? "src"}`,
              `  outDir: ${config.value.outDir ?? "docs"}`,
              `  exclude: ${A.join(config.value.exclude ?? [], ", ") || "none"}`,
            ]);
          }
        }
      }
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
    package: packageFlag,
    filter: filterFlag,
    include: includeFlag,
    validateExamples: validateExamplesFlag,
    parallel: parallelFlag,
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, filter: filterSelector, include, validateExamples, parallel, json }) {
      void validateExamples;
      const selector = yield* resolvePackageSelector(packageSelector, filterSelector);
      const targets = yield* resolveGenerateTargets(selector);
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
        yield* Console.log(yield* renderJson(results));
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
    "Run the repo-local @beep/repo-docgen implementation for one package or every configured package"
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
      const targets = yield* resolveGenerateTargets(selector);
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
    json: jsonFlag,
  },
  Effect.fn(
    function* ({ package: packageSelector, base, head, parallel, plan, full, json }) {
      yield* runDocgenLocal({
        base,
        full,
        head,
        json,
        packageSelector,
        parallel,
        plan,
      });
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Run a bounded local docgen proof for changed package surfaces"));

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
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const targets = yield* resolveAnalyzeTargets(selector);

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
        if (O.isSome(output)) {
          const content = analyses.length === 1 ? generateAnalysisJson(analyses[0]!) : yield* renderJson(analyses);
          yield* fs.writeFileString(output.value, content);
          yield* Console.log(`docgen: wrote ${output.value}`);
          return;
        }

        yield* Console.log(analyses.length === 1 ? generateAnalysisJson(analyses[0]!) : yield* renderJson(analyses));
        return;
      }

      if (O.isSome(selector)) {
        const target = targets[0];
        const analysis = analyses[0];
        if (target === undefined || analysis === undefined) {
          return;
        }
        const report = generateAnalysisReport(analysis, fixMode);
        const destination = O.getOrElse(output, () => defaultAnalysisPath(target.absolutePath, false, path));
        yield* fs.writeFileString(destination, report);
        yield* Console.log(`docgen: wrote ${destination}`);
        return;
      }

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const analysis = analyses[index];
        if (target === undefined || analysis === undefined) {
          continue;
        }

        const destination = defaultAnalysisPath(target.absolutePath, false, path);
        yield* fs.writeFileString(destination, generateAnalysisReport(analysis, fixMode));
        yield* Console.log(`docgen: wrote ${destination}`);
      }
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Analyze JSDoc coverage and write a human-first report"));

const docgenCheckCommand = Command.make(
  "check",
  {
    package: packageFlag,
    parallel: parallelFlag,
    json: jsonFlag,
    reuseProofManifest: reuseProofManifestFlag,
  },
  Effect.fn(
    function* ({ package: selector, parallel, json, reuseProofManifest }) {
      const targets = yield* resolveAnalyzeTargets(selector);

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
          yield* renderJson({
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

      for (const analysis of analyses) {
        const issues = A.filter(
          analysis.exports,
          (entry) => A.isReadonlyArrayNonEmpty(entry.missingTags) || A.isReadonlyArrayNonEmpty(entry.categoryIssues)
        );

        if (issues.length === 0) {
          yield* Console.log(`docgen: OK ${analysis.packagePath}`);
          continue;
        }

        yield* Console.error(
          `docgen: ${analysis.packagePath} has ${analysis.summary.missingDocumentation} export(s) missing docgen metadata`
        );
        for (const issue of issues) {
          const issueText = A.join(
            [
              ...(issue.missingTags.length === 0 ? A.empty() : [`missing ${A.join(issue.missingTags, ", ")}`]),
              ...(issue.categoryIssues.length === 0
                ? A.empty()
                : [`invalid category: ${A.join(issue.categoryIssues, "; ")}`]),
            ],
            "; "
          );

          yield* Console.error(`  ${issue.filePath}:${issue.line} ${issue.name} ${issueText}`);
        }
      }

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
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
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

      if (O.isSome(output)) {
        yield* fs.writeFileString(output.value, content);
        yield* Console.log(`docgen: wrote ${output.value}`);
        if (check && qualityReportHasBlockingFindings(report)) {
          return yield* failWithReportedExit("docgen: quality check found failures.");
        }
        return;
      }

      if (O.isSome(packageSelector) && targets.length === 1) {
        const target = A.head(targets);

        if (O.isNone(target)) {
          return;
        }

        const destination = defaultQualityPath(target.value.absolutePath, json, path);
        yield* fs.writeFileString(destination, content);
        yield* Console.log(`docgen: wrote ${destination}`);
        if (check && qualityReportHasBlockingFindings(report)) {
          return yield* failWithReportedExit("docgen: quality check found failures.");
        }
        return;
      }

      yield* Console.log(content);
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

const docgenQualityWorkerEvalCommand = Command.make(
  "quality-worker-eval",
  {
    package: packageFlag,
    all: allFlag,
    input: inputFlag,
    output: outputFlag,
    provider: qualityWorkerEvalProviderFlag,
    model: qualityWorkerEvalModelFlag,
    baseUrl: qualityWorkerEvalBaseUrlFlag,
    reasoningEffort: qualityWorkerEvalReasoningEffortFlag,
    packetLimit: qualityWorkerEvalPacketLimitFlag,
  },
  Effect.fn(
    function* ({
      package: packageSelector,
      all,
      input,
      output,
      provider,
      model,
      baseUrl,
      reasoningEffort,
      packetLimit,
    }) {
      const fs = yield* FileSystem.FileSystem;
      const sourceCount = (O.isSome(input) ? 1 : 0) + (O.isSome(packageSelector) ? 1 : 0) + (all ? 1 : 0);
      const resolvedReasoningEffort = Match.value(provider).pipe(
        Match.when("codex", () => pipe(reasoningEffort, O.getOrElse(defaultQualityWorkerEvalReasoningEffort))),
        Match.orElse(() => O.getOrUndefined(reasoningEffort))
      );
      const reasoningOptions = pipe(
        O.fromNullishOr(resolvedReasoningEffort),
        O.map((value) => ({ reasoningEffort: value })),
        O.getOrElse(() => ({}))
      );

      if (sourceCount !== 1) {
        return yield* DomainError.make({
          message: "Choose exactly one docgen quality-worker-eval source: --input, --package, or --all.",
        });
      }

      if (packetLimit < 0) {
        return yield* DomainError.make({
          message: "--packet-limit must be zero or greater; use 0 to suppress worker packet turns",
        });
      }

      if (Str.trim(model).length === 0) {
        return yield* DomainError.make({
          message: "--model is required for docgen quality-worker-eval.",
        });
      }

      const source = yield* resolveQualityWorkerEvalSource({
        all,
        input,
        packageSelector,
        packetLimit,
      });
      const baseUrlOptions = pipe(
        baseUrl,
        O.filter(flow(Str.trim, Str.isNonEmpty)),
        O.map((value) => ({ baseUrl: Str.trim(value) })),
        O.getOrElse(R.empty)
      );

      const report = yield* analyzeDocgenQualityWorkerEval({
        ...baseUrlOptions,
        model,
        packetLimit,
        provider,
        ...reasoningOptions,
        report: source.report,
        scope: source.scope,
        sourceQualityReport: source.sourceQualityReport,
      });
      const content = yield* generateQualityWorkerEvalJson(report);

      if (O.isSome(output)) {
        yield* fs.writeFileString(output.value, content);
        yield* Console.log(`docgen: wrote ${output.value}`);
        return;
      }

      yield* Console.log(content);
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(
  Command.withDescription("Run read-only worker evaluation over deterministic docgen quality remediation packets")
);

const docgenQualityWorkerRunpodEvalCommand = Command.make(
  "quality-worker-eval-runpod",
  {
    package: packageFlag,
    all: allFlag,
    input: inputFlag,
    output: outputFlag,
    provider: qualityWorkerEvalProviderFlag,
    model: qualityWorkerEvalModelFlag,
    packetLimit: qualityWorkerRunpodEvalPacketLimitFlag,
    confirmRunpodEval: confirmRunpodEvalFlag,
    keepPod: keepRunpodPodFlag,
    allow24GbFallback: allow24GbFallbackFlag,
    gpuTypeIds: runpodGpuTypeIdsFlag,
    templateId: runpodTemplateIdFlag,
    skipTemplateSearch: skipRunpodTemplateSearchFlag,
    allowPublicTemplateSearch: allowPublicRunpodTemplateSearchFlag,
    readinessTimeoutMs: runpodReadinessTimeoutMsFlag,
    otlp: qualityWorkerRunpodEvalOtlpFlag,
    otlpBaseUrl: qualityWorkerRunpodEvalOtlpBaseUrlFlag,
    otlpProject: qualityWorkerRunpodEvalOtlpProjectFlag,
  },
  Effect.fn(
    function* ({
      package: packageSelector,
      all,
      input,
      output,
      provider,
      model,
      packetLimit,
      confirmRunpodEval,
      keepPod,
      allow24GbFallback,
      gpuTypeIds,
      templateId,
      skipTemplateSearch,
      allowPublicTemplateSearch,
      readinessTimeoutMs,
      otlp,
      otlpBaseUrl,
      otlpProject,
    }) {
      const fs = yield* FileSystem.FileSystem;
      const sourceCount = (O.isSome(input) ? 1 : 0) + (O.isSome(packageSelector) ? 1 : 0) + (all ? 1 : 0);

      if (sourceCount !== 1) {
        return yield* DomainError.newMessage(
          "Choose exactly one docgen quality-worker-eval-runpod source: --input, --package, or --all."
        );
      }

      if (packetLimit < 0) {
        return yield* DomainError.newMessage(
          "--packet-limit must be zero or greater; use 0 to suppress worker packet turns."
        );
      }

      if (readinessTimeoutMs <= 0) {
        return yield* DomainError.newMessage("--readiness-timeout-ms must be greater than zero.");
      }

      if (skipTemplateSearch && allowPublicTemplateSearch) {
        return yield* DomainError.newMessage(
          "Choose at most one template-search mode: --skip-template-search or --allow-public-template-search."
        );
      }

      if (provider !== "ollama") {
        return yield* DomainError.newMessage("docgen quality-worker-eval-runpod v1 only supports --provider ollama.");
      }

      if (model !== requiredQualityWorkerRunpodEvalModel()) {
        return yield* DomainError.newMessage(
          `docgen quality-worker-eval-runpod v1 requires --model ${requiredQualityWorkerRunpodEvalModel()}.`
        );
      }

      if (!confirmRunpodEval) {
        return yield* DomainError.newMessage(
          "docgen quality-worker-eval-runpod creates a billable remote GPU pod; pass --confirm-runpod-eval to continue."
        );
      }

      const source = yield* resolveQualityWorkerEvalSource({
        all,
        input,
        packageSelector,
        packetLimit,
      });
      const resolvedGpuTypeIds = pipe(
        gpuTypeIds,
        O.map(splitCommaSeparatedFlag),
        O.filter((values) => A.length(values) > 0),
        O.getOrUndefined
      );
      const runpodApiKey = yield* Config.redacted("RUNPOD_API_KEY").pipe(
        Effect.mapError(
          DomainError.newCause(
            "RUNPOD_API_KEY is required for docgen quality-worker-eval-runpod. Use RUNPOD_API_KEY=\"$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_RUNPOD_API_KEY')\"."
          )
        )
      );
      const report = yield* runDocgenQualityWorkerRunpodEval({
        allow24GbFallback,
        confirmRunpodEval,
        ...O.getSomesStruct({ gpuTypeIds: O.fromUndefinedOr(resolvedGpuTypeIds) }),
        keepPod,
        model,
        otlpBaseUrl,
        otlpEnabled: otlp,
        otlpProject,
        packetLimit,
        provider,
        readinessTimeoutMs,
        report: source.report,
        scope: source.scope,
        sourceQualityReport: source.sourceQualityReport,
        skipTemplateSearch,
        allowPublicTemplateSearch,
        ...(O.isSome(templateId) ? { templateId: templateId.value } : {}),
      }).pipe((effect) =>
        Effect.scoped(
          Layer.build(Runpod.makeLayer(RunpodConfigInput.make({ apiKey: runpodApiKey }))).pipe(
            Effect.flatMap((context) => effect.pipe(Effect.provide(context)))
          )
        )
      );
      const content = yield* generateQualityWorkerRunpodEvalJson(report);

      if (O.isSome(output)) {
        yield* fs.writeFileString(output.value, content);
        yield* Console.log(`docgen: wrote ${output.value}`);
        return;
      }

      yield* Console.log(content);
    },
    Effect.catchTags({
      DomainError: reportDocgenCommandError,
      NoSuchFileError: reportDocgenCommandError,
    })
  )
).pipe(Command.withDescription("Run read-only JSDoc worker evaluation on an ephemeral Runpod Ollama GPU pod"));

const printDocgenIndex = () =>
  printLines(['Run "bun run beep docgen --help" to see the available docgen commands and flags.']);

/**
 * Human-first docgen command suite.
 *
 * @remarks
 * The `quality` subcommand is advisory/report-only unless `--check` is used;
 * `local` plans from changed files before choosing a scoped or full docgen run.
 * @example
 * ```ts
 * import { docgenCommand } from "@beep/repo-cli/commands/Docgen"
 * import { Command } from "effect/unstable/cli"
 * const runDocgen = Command.runWith(docgenCommand, { version: "0.0.0" })
 * const qualityArgs = ["quality", "-p", "packages/tooling/tool/cli", "--json", "--score", "codex"]
 * const program = runDocgen(qualityArgs)
 * console.log(qualityArgs.join(" "))
 * console.log(program)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const docgenCommand = Command.make("docgen", {}, printDocgenIndex).pipe(
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
    docgenQualityWorkerEvalCommand,
    docgenQualityWorkerRunpodEvalCommand,
  ])
);
