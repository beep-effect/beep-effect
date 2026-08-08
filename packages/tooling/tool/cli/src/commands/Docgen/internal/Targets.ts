/**
 * Target selection and quality-source helpers for Docgen commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { verifyDocgenProofManifest } from "@beep/repo-docgen/ProofManifest";
import { DomainError } from "@beep/repo-utils";
import { A, Text } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, flow } from "effect";
import { dual } from "effect/Function";
import { analyzeDocgenQuality, resolveDocgenQualityTargets } from "./Quality.ts";
import { decodeDocgenQualityReportForWorkerEval, qualityWorkerEvalSourcePacketLimit } from "./QualityWorkerEval.ts";
import {
  assertNoOrphanDocgenConfigPaths,
  discoverDocgenWorkspacePackages,
  resolveDocgenWorkspacePackage,
} from "./Workspace.ts";

/**
 * Resolve generation targets from the optional CLI package selector.
 *
 * **Example** (Resolve all generate targets)
 *
 * ```ts
 * import { resolveGenerateTargets } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveGenerateTargets(O.none()).pipe(Effect.map((targets) => targets.length))
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param selector - Optional package selector supplied by `--package` or `--filter`.
 * @returns Configured docgen package targets, or a typed failure for missing config.
 * @category queries
 * @since 0.0.0
 */
export const resolveGenerateTargets = Effect.fn("Docgen.resolveGenerateTargets")(function* (
  selector: O.Option<string>
) {
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

/**
 * Resolve analysis targets from the optional CLI package selector.
 *
 * **Example** (Resolve all analyze targets)
 *
 * ```ts
 * import { resolveAnalyzeTargets } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveAnalyzeTargets(O.none()).pipe(Effect.map((targets) => targets.length))
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param selector - Optional package selector supplied by `--package`.
 * @returns Package targets eligible for metadata analysis.
 * @category queries
 * @since 0.0.0
 */
export const resolveAnalyzeTargets = Effect.fn("Docgen.resolveAnalyzeTargets")(function* (selector: O.Option<string>) {
  yield* assertNoOrphanDocgenConfigPaths();

  if (O.isSome(selector)) {
    return [yield* resolveDocgenWorkspacePackage(selector.value)] as const;
  }

  return yield* discoverDocgenWorkspacePackages().pipe(Effect.map(A.filter((pkg) => pkg.hasDocgenConfig)));
});

/**
 * Combine the legacy `--filter` selector with the canonical `--package` flag.
 *
 * **Example** (Combine matching package selectors)
 *
 * ```ts
 * import { resolvePackageSelector } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolvePackageSelector(O.some("@beep/schema"), O.some("@beep/schema"))
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param packageSelector - Optional package selector.
 * @param filterSelector - Optional compatibility selector.
 * @returns The selected package option after conflict validation.
 * @category queries
 * @since 0.0.0
 */
export const resolvePackageSelector = Effect.fn("Docgen.resolvePackageSelector")(function* (
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

/**
 * Parse the optional comma-separated `--include` flag.
 *
 * **Example** (Parse comma-separated include flag)
 *
 * ```ts
 * import { includePatternsFromFlag } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 * import * as O from "effect/Option"
 *
 * console.log(includePatternsFromFlag(O.some("src/index.ts, src/foo.ts")).length)
 * ```
 *
 * @param include - Optional raw include flag value.
 * @returns Trimmed include glob patterns in flag order.
 * @category parsing
 * @since 0.0.0
 */
export const includePatternsFromFlag: (include: O.Option<string>) => ReadonlyArray<string> = flow(
  O.map(Text.splitCommaSeparatedTrimmed),
  O.getOrElse(A.empty<string>)
);

/**
 * Decide whether a quality report should fail `docgen quality --check`.
 *
 * **Example** (Detect blocking quality findings)
 *
 * ```ts
 * import { qualityReportHasBlockingFindings } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 *
 * const blocking = qualityReportHasBlockingFindings({
 *   summary: { failures: 0, warnings: 1 },
 *   packages: [{ status: "completed" }]
 * })
 * console.log(blocking) // example value
 * ```
 *
 * @param report - Quality report shape containing summary counts and package status values.
 * @returns `true` when failures, warnings, or incomplete package statuses are present.
 * @category validation
 * @since 0.0.0
 */
export const qualityReportHasBlockingFindings = (report: {
  readonly summary: { readonly failures: number; readonly warnings: number };
  readonly packages: ReadonlyArray<{ readonly status: string }>;
}): boolean =>
  report.summary.failures > 0 ||
  report.summary.warnings > 0 ||
  A.some(report.packages, (pkg) => pkg.status !== "completed");

/**
 * Verify package-local docgen proof manifests for check reuse.
 *
 * **Example** (Verify empty proof targets)
 *
 * ```ts
 * import { verifyDocgenCheckProofManifests } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 * import { Effect } from "effect"
 *
 * const program = verifyDocgenCheckProofManifests([])
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param targets - Package targets with names and absolute package paths.
 * @returns Proof-manifest verification results in target order.
 * @category validation
 * @since 0.0.0
 */
export const verifyDocgenCheckProofManifests = Effect.fn("Docgen.verifyDocgenCheckProofManifests")(function* (
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

/**
 * Check whether a target has a current proof-manifest verification.
 *
 * **Example** (Match current proof manifest)
 *
 * ```ts
 * import { targetHasCurrentDocgenProofManifest } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 *
 * const current = targetHasCurrentDocgenProofManifest(
 *   [{ packagePath: "/repo/packages/a", status: "current" }],
 *   { absolutePath: "/repo/packages/a" }
 * )
 * const currentDataLast = targetHasCurrentDocgenProofManifest({ absolutePath: "/repo/packages/a" })([
 *   { packagePath: "/repo/packages/a", status: "current" }
 * ])
 * console.log(current) // example value
 * console.log(currentDataLast) // example value
 * ```
 *
 * @param verifications - Manifest verification rows.
 * @param target - Package target to match by absolute package path.
 * @returns `true` when the target has a current proof manifest.
 * @category validation
 * @since 0.0.0
 */
export const targetHasCurrentDocgenProofManifest: {
  (
    verifications: ReadonlyArray<{ readonly packagePath: string; readonly status: string }>,
    target: { readonly absolutePath: string }
  ): boolean;
  (target: {
    readonly absolutePath: string;
  }): (verifications: ReadonlyArray<{ readonly packagePath: string; readonly status: string }>) => boolean;
} = dual(
  2,
  (
    verifications: ReadonlyArray<{ readonly packagePath: string; readonly status: string }>,
    target: { readonly absolutePath: string }
  ): boolean =>
    A.some(
      verifications,
      (verification) => verification.packagePath === target.absolutePath && verification.status === "current"
    )
);

/**
 * Resolve the quality report source for worker evaluation commands.
 *
 * **Example** (Resolve all-source quality report)
 *
 * ```ts
 * import { resolveQualityWorkerEvalSource } from "@beep/repo-cli/commands/Docgen/internal/Targets"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveQualityWorkerEvalSource({
 *   all: true,
 *   input: O.none(),
 *   packageSelector: O.none(),
 *   packetLimit: 1
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param options - Mutually exclusive input, package, or all-source options.
 * @returns A decoded or freshly generated quality report plus source metadata.
 * @category validation
 * @since 0.0.0
 */
export const resolveQualityWorkerEvalSource = Effect.fn("Docgen.resolveQualityWorkerEvalSource")(function* ({
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
