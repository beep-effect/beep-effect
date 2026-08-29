/**
 * Orchestration for Docgen quality package and repo reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { shellQuote } from "@beep/repo-ai-metrics";
import { A } from "@beep/utils";
import { Duration, Effect, flow, identity, Order, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { errorMessage, timestampIso } from "../../../../internal/cli/Timing.ts";
import { scoreSubject } from "./Quality.rubric.ts";
import {
  bySubjectIdentityAscending,
  DocgenQualityPackageReport,
  DocgenQualityPackageStatus,
  DocgenQualityRemediationPacket,
  DocgenQualityReport,
  DocgenQualitySummary,
  QUALITY_RUBRIC_VERSION,
  QUALITY_SCHEMA_VERSION,
} from "./Quality.schemas.ts";
import {
  budgetDurationMs,
  budgetExceeded,
  collectPackageSubjectCandidates,
  finalizeSubject,
  makeRuntimeBudget,
  packageTimeoutMessage,
  withGeneratedDocSnippets,
} from "./Quality.subjects.ts";
import type { DocgenWorkspacePackage } from "../../Docgen.schemas.ts";
import type {
  DocgenQualityReview,
  DocgenQualityScopeMode,
  DocgenQualityScoreMode,
  DocgenQualitySubject,
} from "./Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Docgen/internal/quality/Quality.service");
const DEFAULT_PACKAGE_TIMEOUT = Duration.seconds(180);
const DEFAULT_REMEDIATION_PACKET_LIMIT = 25;
const qualityErrorMessage = (error: unknown): string => errorMessage(error, "Unknown error");

const summarizeReviews = (
  packages: number,
  subjects: number,
  reviews: ReadonlyArray<DocgenQualityReview>,
  remediationPackets: number
): DocgenQualitySummary =>
  DocgenQualitySummary.make({
    packages,
    subjects,
    passing: A.filter(reviews, (review) => review.tier === "pass").length,
    warnings: A.filter(reviews, (review) => review.tier === "warn").length,
    failures: A.filter(reviews, (review) => review.tier === "fail").length,
    remediationPackets,
  });

const emptyPackageReport = ({
  durationMs,
  error,
  status,
  target,
  timedOut,
}: {
  readonly durationMs: number;
  readonly error: string | null;
  readonly status: DocgenQualityPackageStatus;
  readonly target: DocgenWorkspacePackage;
  readonly timedOut: boolean;
}): DocgenQualityPackageReport =>
  DocgenQualityPackageReport.make({
    packageName: target.name,
    packagePath: target.relativePath,
    status,
    durationMs,
    error,
    timedOut,
    omittedPacketCount: 0,
    subjects: A.empty(),
    reviews: A.empty(),
    summary: summarizeReviews(1, 0, A.empty(), 0),
  });

const remediationPrompt = (subject: DocgenQualitySubject, review: DocgenQualityReview): string =>
  A.join(
    [
      "Improve the JSDoc block for this exported symbol without changing runtime behavior.",
      "",
      `Subject: ${subject.stableIdentity}`,
      `Anchor: ${subject.sourceAnchor}`,
      `Signature: ${subject.signature}`,
      "",
      "Findings:",
      ...A.map(review.findings, (finding) => `- ${finding.code}: ${finding.remediation}`),
      "",
      "Keep @example mandatory. Prefer a realistic TypeScript example with an observable result.",
    ],
    "\n"
  );

const makeRemediationPacket = (
  subject: DocgenQualitySubject,
  review: DocgenQualityReview
): DocgenQualityRemediationPacket =>
  DocgenQualityRemediationPacket.make({
    id: `${subject.contentHash}:jsdoc-quality`,
    subjectId: subject.stableIdentity,
    title: `Improve JSDoc for ${subject.exportName}`,
    prompt: remediationPrompt(subject, review),
    verificationCommand: `bun run beep docgen quality -p ${shellQuote(subject.packagePath)} --json`,
    verificationArgv: ["bun", "run", "beep", "docgen", "quality", "-p", subject.packagePath, "--json"],
  });

class RemediationPacketCandidate extends S.Class<RemediationPacketCandidate>($I`RemediationPacketCandidate`)(
  {
    impact: S.Finite,
    isFail: S.Boolean,
    packagePath: S.String,
    packet: DocgenQualityRemediationPacket,
    subjectId: S.String,
  },
  $I.annote("RemediationPacketCandidate", {
    description: "Candidate for remediation packet generation",
  })
) {}

const packetCandidateOrder: Order.Order<RemediationPacketCandidate> = Order.combine(
  Order.mapInput(Order.Number, (candidate) => (candidate.isFail ? 0 : 1)),
  Order.combine(
    Order.flip(Order.mapInput(Order.Number, (candidate) => candidate.impact)),
    Order.combine(
      Order.mapInput(Order.String, (candidate) => candidate.packagePath),
      Order.mapInput(Order.String, (candidate) => candidate.subjectId)
    )
  )
);

const remediationPacketCandidatesForPackage = (
  pkg: DocgenQualityPackageReport
): ReadonlyArray<RemediationPacketCandidate> =>
  pipe(
    pkg.reviews,
    A.filter((review) => review.tier !== "pass"),
    A.flatMap((review) => {
      const subject = A.findFirst(pkg.subjects, (candidate) => candidate.stableIdentity === review.subjectId);
      return O.isSome(subject)
        ? [
            {
              impact: A.reduce(review.findings, 0, (total, finding) => total + finding.scoreImpact),
              isFail: review.tier === "fail",
              packagePath: pkg.packagePath,
              packet: makeRemediationPacket(subject.value, review),
              subjectId: review.subjectId,
            },
          ]
        : A.empty<RemediationPacketCandidate>();
    })
  );

const countCandidatesForPackage = (
  candidates: ReadonlyArray<RemediationPacketCandidate>,
  packagePath: string
): number => A.filter(candidates, (candidate) => candidate.packagePath === packagePath).length;

const withRemediationPacketCount = (
  pkg: DocgenQualityPackageReport,
  remediationPackets: number,
  omittedPacketCount: number
): DocgenQualityPackageReport =>
  DocgenQualityPackageReport.make({
    ...pkg,
    omittedPacketCount,
    summary: summarizeReviews(1, pkg.subjects.length, pkg.reviews, remediationPackets),
  });

class PackageReportOptions extends S.Class<PackageReportOptions>($I`PackageReportOptions`)(
  {
    durationMs: S.Finite,
    error: S.NullOr(S.String),
    status: DocgenQualityPackageStatus,
    timedOut: S.Boolean,
  },
  $I.annote("PackageReportOptions", {
    description: "Options for generating a package quality report",
  })
) {}

const packageReport = (
  target: DocgenWorkspacePackage,
  subjects: ReadonlyArray<DocgenQualitySubject>,
  options: PackageReportOptions
): DocgenQualityPackageReport => {
  const reviews = A.map(subjects, scoreSubject);
  return DocgenQualityPackageReport.make({
    packageName: target.name,
    packagePath: target.relativePath,
    status: options.status,
    durationMs: options.durationMs,
    error: options.error,
    timedOut: options.timedOut,
    omittedPacketCount: 0,
    subjects,
    reviews,
    summary: summarizeReviews(1, subjects.length, reviews, 0),
  });
};

/**
 * Builds a package-local quality report from ts-morph-enriched subjects.
 *
 * **Example** (Analyze first package quality)
 *
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { analyzePackageQuality } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.service"
 * import { discoverDocgenWorkspacePackages } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect, Layer } from "effect"
 *
 * const RuntimeLayer = Layer.mergeAll(FsUtilsLive).pipe(Layer.provideMerge(BunServices.layer))
 *
 * const program = Effect.gen(function* () {
 *   const packages = yield* discoverDocgenWorkspacePackages()
 *   const target = packages[0]
 *   if (target === undefined) return "no packages"
 *   const report = yield* analyzePackageQuality(target)
 *   return `${report.packageName}: ${report.summary.subjects} subjects`
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer))).then(console.log)
 * ```
 *
 * @effects Reads package docgen configuration and TypeScript source files.
 * @category workflows
 * @since 0.0.0
 */
export const analyzePackageQuality = Effect.fn("DocgenQuality.analyzePackageQuality")(function* (
  target: DocgenWorkspacePackage,
  options?: {
    readonly packageTimeout?: Duration.Duration;
  }
) {
  const budget = makeRuntimeBudget(options?.packageTimeout ?? DEFAULT_PACKAGE_TIMEOUT);
  return yield* Effect.gen(function* () {
    const candidateResult = yield* collectPackageSubjectCandidates(target, budget);
    const finalizedSubjects = yield* Effect.forEach(candidateResult.candidates, finalizeSubject);
    const subjects = yield* withGeneratedDocSnippets(
      target,
      pipe(
        finalizedSubjects,
        A.dedupeWith((left, right) => left.stableIdentity === right.stableIdentity),
        A.sort(bySubjectIdentityAscending)
      )
    );
    const timedOut = candidateResult.timedOut || budgetExceeded(budget);
    const status: DocgenQualityPackageStatus = timedOut ? "partial" : candidateResult.status;
    const error = timedOut ? (candidateResult.error ?? packageTimeoutMessage(target, budget)) : candidateResult.error;
    return packageReport(target, subjects, {
      durationMs: budgetDurationMs(budget),
      error,
      status,
      timedOut,
    });
  }).pipe(
    Effect.result,
    Effect.map(
      Result.match({
        onFailure: flow(qualityErrorMessage, (error) =>
          emptyPackageReport({
            durationMs: budgetDurationMs(budget),
            error: error,
            status: "failed",
            target,
            timedOut: false,
          })
        ),
        onSuccess: identity,
      })
    )
  );
});

/**
 * Builds the consolidated report emitted by the quality command.
 *
 * **Example** (Analyze all packages quality)
 *
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { analyzeDocgenQuality } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.service"
 * import { discoverDocgenWorkspacePackages } from "@beep/repo-cli/commands/Docgen/internal/Operations"
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect, Layer } from "effect"
 *
 * const RuntimeLayer = Layer.mergeAll(FsUtilsLive).pipe(Layer.provideMerge(BunServices.layer))
 *
 * const program = Effect.gen(function* () {
 *   const targets = yield* discoverDocgenWorkspacePackages()
 *   const report = yield* analyzeDocgenQuality({ scope: "all", scoreMode: "rubric", targets })
 *   return `${report.summary.packages} packages reviewed`
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer))).then(console.log)
 * ```
 *
 * @effects Runs package-local JSDoc quality analysis for the provided targets.
 * @category workflows
 * @since 0.0.0
 */
export const analyzeDocgenQuality = Effect.fn("DocgenQuality.analyzeDocgenQuality")(function* ({
  packageTimeout,
  packetLimit,
  scope,
  scoreMode,
  targets,
}: {
  readonly packageTimeout?: Duration.Duration;
  readonly packetLimit?: number;
  readonly scope: DocgenQualityScopeMode;
  readonly scoreMode: DocgenQualityScoreMode;
  readonly targets: ReadonlyArray<DocgenWorkspacePackage>;
}) {
  const packageQualityOptions = packageTimeout === undefined ? {} : { packageTimeout };
  const analyzedPackages = yield* Effect.forEach(
    targets,
    (target) => analyzePackageQuality(target, packageQualityOptions),
    {
      concurrency: 2,
    }
  );
  const packetCap = Math.max(0, packetLimit ?? DEFAULT_REMEDIATION_PACKET_LIMIT);
  const packetCandidates =
    scoreMode === "codex"
      ? pipe(analyzedPackages, A.flatMap(remediationPacketCandidatesForPackage), A.sort(packetCandidateOrder))
      : A.empty<RemediationPacketCandidate>();
  const selectedCandidates = A.take(packetCandidates, packetCap);
  const packages = A.map(analyzedPackages, (pkg) => {
    const selectedCount = countCandidatesForPackage(selectedCandidates, pkg.packagePath);
    const candidateCount = countCandidatesForPackage(packetCandidates, pkg.packagePath);
    return withRemediationPacketCount(pkg, selectedCount, Math.max(0, candidateCount - selectedCount));
  });
  const reviews = pipe(
    packages,
    A.flatMap((pkg) => pkg.reviews)
  );
  const subjects = pipe(
    packages,
    A.flatMap((pkg) => pkg.subjects)
  );
  const remediationPackets = A.map(selectedCandidates, (candidate) => candidate.packet);

  return DocgenQualityReport.make({
    schemaVersion: QUALITY_SCHEMA_VERSION,
    rubricVersion: QUALITY_RUBRIC_VERSION,
    generatedAt: timestampIso(),
    scope,
    scorer: scoreMode === "codex" ? "codex-advisory-packet-v1" : "deterministic-rubric-v1",
    summary: summarizeReviews(packages.length, subjects.length, reviews, remediationPackets.length),
    packages,
    remediationPackets,
  });
});
