/**
 * Rendering and logging helpers for schema-first lint results.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";
import * as O from "effect/Option";
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
  readonly taggedErrorEquivalenceAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly precisionAuditAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly arbitraryTestsAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly numericDomainAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly fnSchemaAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly normalizationAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly nullReturnAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly getsomesStructAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly activeAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
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
    taggedErrorEquivalenceAdvisories: input.findings.taggedErrorEquivalenceAdvisories.length,
    precisionAuditAdvisories: input.findings.precisionAuditAdvisories.length,
    arbitraryTestsAdvisories: input.findings.arbitraryTestsAdvisories.length,
    numericDomainAdvisories: input.findings.numericDomainAdvisories.length,
    fnSchemaAdvisories: input.findings.fnSchemaAdvisories.length,
    normalizationAdvisories: input.findings.normalizationAdvisories.length,
    nullReturnAdvisories: input.findings.nullReturnAdvisories.length,
    getsomesStructAdvisories: input.findings.getsomesStructAdvisories.length,
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
  yield* Console.log(
    `[schema-first] sfv4_tagged_error_equivalence_advisories=${summary.taggedErrorEquivalenceAdvisories}`
  );
  yield* Console.log(`[schema-first] sfv4_precision_audit_advisories=${summary.precisionAuditAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_arbitrary_tests_advisories=${summary.arbitraryTestsAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_numeric_domain_advisories=${summary.numericDomainAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_fn_schema_advisories=${summary.fnSchemaAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_normalization_advisories=${summary.normalizationAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_null_return_advisories=${summary.nullReturnAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_getsomes_struct_advisories=${summary.getsomesStructAdvisories}`);
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
} as const;
