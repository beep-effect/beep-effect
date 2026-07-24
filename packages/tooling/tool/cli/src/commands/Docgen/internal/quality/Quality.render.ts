/**
 * JSON and Markdown rendering for Docgen quality reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import {
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  encodeCommandJson,
  renderPrettyCommandJson,
} from "../../../../internal/cli/Json.ts";
import type { DocgenQualityReport, DocgenQualityReview, DocgenQualitySubject } from "./Quality.schemas.ts";

const renderJson = Effect.fn("DocgenQuality.renderJson")(function* (value: unknown) {
  const encoded = yield* encodeCommandJson(value).pipe(
    Effect.mapError(DomainError.newCause("Failed to encode quality report JSON."))
  );
  return renderPrettyCommandJson(encoded, { maxLength: DEFAULT_JSON_PRETTY_MAX_LENGTH });
});

/**
 * Renders a quality report as JSON text.
 *
 * @param report - Consolidated quality report to encode.
 * @returns Effect yielding formatted JSON with the quality-report size guard.
 * @effects Encodes the report as formatted JSON and fails with a typed domain error if encoding fails.
 * @example
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { generateQualityJson } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.render"
 * import { analyzeDocgenQuality } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.service"
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect, Layer } from "effect"
 *
 * const RuntimeLayer = Layer.mergeAll(FsUtilsLive).pipe(Layer.provideMerge(BunServices.layer))
 *
 * const program = Effect.gen(function* () {
 *   const report = yield* analyzeDocgenQuality({ scope: "all", scoreMode: "rubric", targets: [] })
 *   const json = yield* generateQualityJson(report)
 *   return json.includes("\"schemaVersion\"")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer))).then(console.log)
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const generateQualityJson = (report: DocgenQualityReport): Effect.Effect<string, DomainError> =>
  renderJson(report);

const markdownSubject = (subject: DocgenQualitySubject, review: DocgenQualityReview): string => {
  const findingLines =
    review.findings.length === 0
      ? ["  - No findings."]
      : A.map(
          review.findings,
          (finding) => `  - ${finding.code} (${finding.tier}, -${finding.scoreImpact}): ${finding.message}`
        );

  return A.join(
    [
      `### ${subject.exportName}`,
      "",
      `- Anchor: \`${subject.sourceAnchor}\``,
      `- Kind: \`${subject.declarationKind}\``,
      `- Score: ${review.score}/10 (${review.tier})`,
      `- Signature: \`${subject.signature}\``,
      "",
      ...findingLines,
    ],
    "\n"
  );
};

/**
 * Renders a quality report as human-readable Markdown.
 *
 * @param report - Consolidated quality report to render.
 * @returns Human-readable Markdown report content.
 * @example
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * import { generateQualityReport } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.render"
 * import { analyzeDocgenQuality } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.service"
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect, Layer } from "effect"
 *
 * const RuntimeLayer = Layer.mergeAll(FsUtilsLive).pipe(Layer.provideMerge(BunServices.layer))
 *
 * const program = Effect.gen(function* () {
 *   const report = yield* analyzeDocgenQuality({ scope: "all", scoreMode: "rubric", targets: [] })
 *   const markdown = generateQualityReport(report)
 *   return markdown.startsWith("# JSDoc Quality Report")
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer))).then(console.log)
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const generateQualityReport = (report: DocgenQualityReport): string => {
  const lines = [
    "# JSDoc Quality Report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Scope: ${report.scope}`,
    `- Scorer: ${report.scorer}`,
    `- Rubric: ${report.rubricVersion}`,
    `- Packages: ${report.summary.packages}`,
    `- Subjects: ${report.summary.subjects}`,
    `- Passing: ${report.summary.passing}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Failures: ${report.summary.failures}`,
    `- Remediation packets: ${report.summary.remediationPackets}`,
    "",
  ];

  for (const pkg of report.packages) {
    A.appendAllInPlace(lines, [
      `## ${pkg.packageName}`,
      "",
      `Path: \`${pkg.packagePath}\``,
      `Status: \`${pkg.status}\``,
      `Duration: ${pkg.durationMs}ms`,
      `Omitted packets: ${pkg.omittedPacketCount}`,
      "",
    ]);

    if (pkg.error !== null) {
      A.appendAllInPlace(lines, [`> ${pkg.error}`, ""]);
    }

    if (pkg.subjects.length === 0) {
      A.appendAllInPlace(lines, ["No exported-symbol JSDoc subjects found.", ""]);
      continue;
    }

    for (const subject of pkg.subjects) {
      const review = A.findFirst(pkg.reviews, (candidate) => candidate.subjectId === subject.stableIdentity);
      if (O.isSome(review)) {
        A.appendAllInPlace(lines, [markdownSubject(subject, review.value), ""]);
      }
    }
  }

  if (report.remediationPackets.length > 0) {
    A.appendAllInPlace(lines, ["## Remediation Packets", ""]);
    for (const packet of report.remediationPackets) {
      A.appendAllInPlace(lines, [
        `- ${packet.id}: ${packet.title}`,
        `  - Subject: \`${packet.subjectId}\``,
        `  - Verify: \`${packet.verificationCommand}\``,
        "",
        "  ```text",
        ...A.map(Str.split(/\r?\n/)(packet.prompt), (line) => `  ${line}`),
        "  ```",
        "",
      ]);
    }
  }

  return `${A.join(lines, "\n")}\n`;
};
