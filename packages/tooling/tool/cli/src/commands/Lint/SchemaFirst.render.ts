/**
 * Rendering and logging helpers for schema-first lint results.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Console, Effect, flow, identity } from "effect";
import * as O from "effect/Option";
import { renderTruncatedLines } from "../../internal/artifacts/index.ts";
import { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import {
  renderSchemaFirstPolicyFindingLine,
  SchemaFirstPolicyFinding,
} from "../../internal/quality/SchemaFirstPolicyFinding.ts";
import { missingEntryRemediation } from "./internal/SchemaFirstPolicy.ts";
import { SchemaFirstInventoryPath, SchemaFirstLintSummary } from "./Lint.schemas.ts";
import type {
  LiteralKitConstAssertionViolation,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryEntry,
  SchemaFirstLintOptions,
  SchemaFirstParityFindings,
  SchemaFirstParityRuleSummary,
} from "./Lint.schemas.ts";

const renderPolicyFindingLine = renderSchemaFirstPolicyFindingLine;

/**
 * Classified schema-first lint findings shared by the scan and render stages.
 *
 * **Details**
 *
 * The scan stage classifies inventory entries into per-rule advisory buckets
 * plus the missing/stale/candidate sets, and the render stage consumes the
 * same shape to emit operator lines and summary counters. Keeping the single
 * definition here (the upstream module of the two) avoids drift between the
 * classification and its rendering.
 *
 * @category models
 * @since 0.0.0
 */
export type SchemaFirstLintFindings = {
  readonly missingEntries: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly staleEntries: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly enforcedCandidates: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly boundaryCodecAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly defaultsAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly staticApiAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly equivalenceAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly precisionAuditAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly arbitraryTestsAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly numericDomainAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly fnSchemaAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly normalizationAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly nullReturnAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly getsomesStructAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly activeAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly parity: SchemaFirstParityFindings;
  readonly policyExemptCount: number;
};

const inventoryEntryFinding = (
  entry: SchemaFirstInventoryEntry,
  message: string,
  remediation: string
): SchemaFirstPolicyFinding =>
  SchemaFirstPolicyFinding.make({
    category: "schema-first-policy",
    ruleId: entry.ruleId ?? "schema-first-inventory",
    severity: entry.status === "advisory" ? "warning" : "error",
    file: entry.file,
    symbol: entry.symbol,
    message,
    remediation,
    ...optionalProp("line", O.fromUndefinedOr(entry.line)),
  });

const literalKitConstAssertionFinding = (violation: LiteralKitConstAssertionViolation): SchemaFirstPolicyFinding =>
  SchemaFirstPolicyFinding.make({
    category: "schema-first-policy",
    ruleId: "literal-kit-const-assertion",
    severity: "error",
    file: violation.file,
    line: violation.line,
    symbol: "LiteralKit",
    message: "Inline LiteralKit array arguments do not need as const.",
    remediation: "Remove the redundant as const assertion; LiteralKit already uses const type parameters.",
  });

const logPolicyFinding = Effect.fn("logPolicyFinding")(function* (finding: SchemaFirstPolicyFinding) {
  yield* Console.error(yield* renderPolicyFindingLine(finding));
});

const makeSchemaFirstLintSummary = (input: {
  readonly liveDocument: SchemaFirstInventoryDocument;
  readonly mergedDocument: SchemaFirstInventoryDocument;
  readonly literalKitConstAssertionViolations: ReadonlyArray<LiteralKitConstAssertionViolation>;
  readonly findings: SchemaFirstLintFindings;
  readonly options: SchemaFirstLintOptions;
}): SchemaFirstLintSummary =>
  SchemaFirstLintSummary.make({
    liveEntries: input.liveDocument.entries.length,
    trackedEntries: input.mergedDocument.entries.length,
    missingEntries: input.findings.missingEntries.length,
    staleEntries: input.findings.staleEntries.length,
    enforcedCandidates: input.findings.enforcedCandidates.length,
    literalKitConstAssertions: input.literalKitConstAssertionViolations.length,
    boundaryCodecAdvisories: input.findings.boundaryCodecAdvisories.length,
    defaultsAdvisories: input.findings.defaultsAdvisories.length,
    staticApiAdvisories: input.findings.staticApiAdvisories.length,
    equivalenceAdvisories: input.findings.equivalenceAdvisories.length,
    precisionAuditAdvisories: input.findings.precisionAuditAdvisories.length,
    arbitraryTestsAdvisories: input.findings.arbitraryTestsAdvisories.length,
    numericDomainAdvisories: input.findings.numericDomainAdvisories.length,
    fnSchemaAdvisories: input.findings.fnSchemaAdvisories.length,
    normalizationAdvisories: input.findings.normalizationAdvisories.length,
    nullReturnAdvisories: input.findings.nullReturnAdvisories.length,
    getsomesStructAdvisories: input.findings.getsomesStructAdvisories.length,
    parityRules: input.findings.parity.rules,
    crispeningPolicyExempt: input.findings.policyExemptCount,
    wroteInventory: input.options.write,
  });

const logSchemaFirstSummary = Effect.fn("logSchemaFirstSummary")(function* (summary: SchemaFirstLintSummary) {
  yield* Console.log(`[schema-first] live_entries=${summary.liveEntries}`);
  yield* Console.log(`[schema-first] tracked_entries=${summary.trackedEntries}`);
  yield* Console.log(`[schema-first] missing_entries=${summary.missingEntries}`);
  yield* Console.log(`[schema-first] stale_entries=${summary.staleEntries}`);
  yield* Console.log(`[schema-first] enforced_candidates=${summary.enforcedCandidates}`);
  yield* Console.log(`[schema-first] literal_kit_const_assertions=${summary.literalKitConstAssertions}`);
  yield* Console.log(`[schema-first] sfv4_boundary_codec_advisories=${summary.boundaryCodecAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_defaults_advisories=${summary.defaultsAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_static_api_advisories=${summary.staticApiAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_equivalence_advisories=${summary.equivalenceAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_precision_audit_advisories=${summary.precisionAuditAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_arbitrary_tests_advisories=${summary.arbitraryTestsAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_numeric_domain_advisories=${summary.numericDomainAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_fn_schema_advisories=${summary.fnSchemaAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_normalization_advisories=${summary.normalizationAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_null_return_advisories=${summary.nullReturnAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_getsomes_struct_advisories=${summary.getsomesStructAdvisories}`);
  yield* Effect.forEach(summary.parityRules, flow(renderParityRuleSummaryLine, Console.log), { discard: true });
  yield* Console.log(`[schema-first] crispening_policy_exempt=${summary.crispeningPolicyExempt}`);
  if (summary.wroteInventory) {
    yield* Console.log(`[schema-first] wrote ${SchemaFirstInventoryPath}`);
  }
});

const logMissingEntries = Effect.fn("logMissingEntries")(function* (entries: ReadonlyArray<SchemaFirstInventoryEntry>) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] untracked live findings:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}] ${entry.reason}`);
      yield* logPolicyFinding(inventoryEntryFinding(entry, entry.reason, missingEntryRemediation(entry)));
    }
  }
});

const logStaleEntries = Effect.fn("logStaleEntries")(function* (entries: ReadonlyArray<SchemaFirstInventoryEntry>) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] stale inventory entries:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}]`);
      yield* logPolicyFinding(
        inventoryEntryFinding(
          entry,
          "Stale schema-first inventory entry is no longer present in the live scan.",
          "Run bun run beep lint schema-first --write after confirming the source removal or rename."
        )
      );
    }
  }
});

const logEnforcedCandidates = Effect.fn("logEnforcedCandidates")(function* (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] repo still contains candidate findings:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}] ${entry.reason}`);
      yield* logPolicyFinding(
        inventoryEntryFinding(
          entry,
          entry.reason,
          "Model the exported data with an annotated schema or record a justified exception in standards/schema-first.inventory.jsonc."
        )
      );
    }
  }
});

const logLiteralKitConstAssertionViolations = Effect.fn("logLiteralKitConstAssertionViolations")(function* (
  violations: ReadonlyArray<LiteralKitConstAssertionViolation>
) {
  if (violations.length > 0) {
    yield* Console.error("[schema-first] redundant LiteralKit const assertions:");
    for (const violation of violations) {
      yield* Console.error(
        `- ${violation.file}:${violation.line} arg${violation.argument} [literal-kit-const-assertion] Inline LiteralKit array arguments do not need as const.`
      );
      yield* logPolicyFinding(literalKitConstAssertionFinding(violation));
    }
  }
});

const logActiveAdvisories = Effect.fn("logActiveAdvisories")(function* (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] repo still contains advisory findings:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}] ${entry.reason}`);
      yield* logPolicyFinding(
        inventoryEntryFinding(
          entry,
          entry.reason,
          "Resolve the schema-first advisory or move the entry to exception with a documented reason."
        )
      );
    }
  }
});

const parityRuleSummaryKey: (ruleId: string) => string = flow(Str.replaceAll("-", "_"), Str.toLowerCase);

const renderParityRuleSummaryLine = (rule: SchemaFirstParityRuleSummary): string =>
  `[schema-first] ${parityRuleSummaryKey(rule.ruleId)}_occurrences=${rule.live} baseline=${rule.baseline} introduced=${rule.introduced} resolved=${rule.resolved}`;

const parityIntroducedFinding = (entry: SchemaFirstInventoryEntry): SchemaFirstPolicyFinding =>
  SchemaFirstPolicyFinding.make({
    category: "schema-first-policy",
    ruleId: entry.ruleId ?? "schema-first-inventory",
    severity: "error",
    file: entry.file,
    symbol: entry.symbol,
    message: entry.reason,
    remediation: missingEntryRemediation(entry),
    ...optionalProp("line", O.fromUndefinedOr(entry.line)),
  });

const parityIntroducedLines = Effect.fn("parityIntroducedLines")(function* (entry: SchemaFirstInventoryEntry) {
  return [
    `- ${entry.file}:${entry.line ?? 0} :: ${entry.symbol} [${entry.ruleId ?? ""}] ${entry.reason}`,
    yield* renderSchemaFirstPolicyFindingLine(parityIntroducedFinding(entry)),
  ];
});

const PARITY_TIGHTEN_LIMIT = 20;

/**
 * Build the parity-ratchet enforcement input: fail on a new occurrence, nudge
 * a tighter backlog for a resolved one.
 *
 * **Details**
 *
 * The floor is membership. An occurrence anchor absent from the committed
 * backlog is a regression that fails the check (not the `--write` run); an
 * anchor the scan no longer finds is resolved and only prints a
 * tighten-baseline nudge, because `--write` shrinks the backlog.
 *
 * @param parity - The classified parity-ratchet findings.
 * @param options - The lint options; `--write` never regresses.
 * @returns The ordered regression checks, ok line, and tighten block for `enforceRatchet`.
 * @category utilities
 * @since 0.0.0
 */
const parityRatchetInput = Effect.fn("parityRatchetInput")(function* (
  parity: SchemaFirstParityFindings,
  options: SchemaFirstLintOptions
) {
  const introducedLines = A.flatten(yield* Effect.forEach(parity.introduced, parityIntroducedLines));
  const resolvedOccurrences = A.flatMap(parity.resolved, (row) =>
    A.map(row.occurrences, (occurrence) => `  - ${row.file} :: ${occurrence} [${row.ruleId}]`)
  );
  return {
    regressions: [
      {
        present: !options.write && A.isReadonlyArrayNonEmpty(parity.introduced),
        lines: [
          `[schema-first] parity ratchet: ${parity.introduced.length} new occurrence(s) outside the committed backlog:`,
          ...introducedLines,
          "[schema-first] Migrate each occurrence to its upstream form; the parity backlog only shrinks. Record an occurrence with `bun run beep lint schema-first --write` only when the backlog must grow, and justify it in review.",
        ],
        error: CliReportedExit.make({
          message: "schema-first: parity ratchet failed on new occurrences.",
          exitCode: 1,
        }),
      },
    ],
    okLine: options.write
      ? `[schema-first] parity backlog written: occurrences=${parity.liveCount} previous_baseline=${parity.baselineCount}`
      : `[schema-first] parity ratchet ok: current=${parity.liveCount} baseline=${parity.baselineCount} introduced=0 resolved=${A.length(resolvedOccurrences)}`,
    tighten: O.liftPredicate(
      [
        `[schema-first] tighten-baseline: ${resolvedOccurrences.length} parity occurrence(s) resolved; run \`bun run beep lint schema-first --write\` to shrink the committed backlog.`,
        ...renderTruncatedLines({ items: resolvedOccurrences, render: identity, limit: PARITY_TIGHTEN_LIMIT }),
      ],
      () => !options.write && A.isReadonlyArrayNonEmpty(resolvedOccurrences)
    ),
  };
});

/**
 * Internal rendering adapter for schema-first lint output.
 *
 * **Example** (Logging SchemaFirstRender)
 *
 * ```ts
 * console.log("SchemaFirstRender")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const SchemaFirstRender = {
  logActiveAdvisories,
  logEnforcedCandidates,
  logLiteralKitConstAssertionViolations,
  logMissingEntries,
  logSchemaFirstSummary,
  logStaleEntries,
  makeSchemaFirstLintSummary,
  parityRatchetInput,
} as const;
