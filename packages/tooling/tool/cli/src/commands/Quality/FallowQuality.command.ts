/**
 * Advisory Fallow quality command wrappers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { Fn, NonNegativeInt } from "@beep/schema";
import { Console, DateTime, Effect, FileSystem, flow, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { parseDocument } from "yaml";
import { runCapturedStreams } from "../../internal/process/index.ts";
import { fallowCiContractDiagnostics } from "./internal/FallowCiContract.ts";
import {
  FallowAttributionKinds,
  FallowEnvelopeStatus,
  FallowFailureEnvelopeStatus,
  FallowFeatureFamily,
  FallowReportBaseResolutionFailed,
  FallowReportEnvelope,
  FallowReportFinding,
  FallowReportInvalidJson,
  FallowReportInvalidReport,
  FallowReportOk,
  FallowReportPayload,
  FallowReportToolFailed,
  FindingAttributionSummary,
  PositiveExitStatus,
  sameAttributionKind,
  sameEnvelopeStatus,
  sameFeatureFamily,
} from "./internal/FallowEnvelope.schema.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { FallowFeature, FindingAttributionKind } from "./internal/FallowEnvelope.schema.ts";

const $I = $RepoCliId.create("commands/Quality/FallowQuality");

const fallowFeatureValues: ReadonlyArray<FallowFeature> = FallowFeatureFamily.Options;
const isFallowFeature = S.is(FallowFeatureFamily);

const commonEnvelopeKeys = [
  "schemaVersion",
  "toolVersion",
  "command",
  "subcommand",
  "baseRef",
  "generatedAt",
  "advisory",
  "dirtyWorktree",
  "reportPath",
  "rawOutputRef",
  "attributionKinds",
  "findingAttributionSummary",
  "status",
  "exitStatus",
];

const okEnvelopeKeys = [...commonEnvelopeKeys, "report"];
const failureEnvelopeKeys = [...commonEnvelopeKeys, "stderrExcerpt"];
const defaultOutDir = ".beep/fallow";
const defaultBaseRef = "origin/main";
const fallbackSourceRef = "standards/fallow.pilot.inventory.jsonc";
// Hard upper bound on how many synthetic findings any single count field may
// expand into. Raw Fallow counts are accepted as `S.Finite` with no upper
// bound, and each count is materialized into one finding object via `A.unfold`.
// Without this cap an attacker-influenced report (or Fallow output) with a huge
// count could force unbounded array allocation and exhaust memory/CPU in the
// invoking CLI or CI runner. The cap fails closed by truncating to a documented
// maximum while still surfacing that the lane has saturated findings.
const maxFindingsPerCount = 10_000;

const decodeJsonText = S.decodeUnknownEffect(S.UnknownFromJsonString);
const encodeFallowEnvelopeJson = S.encodeUnknownEffect(S.fromJsonString(FallowReportEnvelope));
const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeUnknownArrayOption = S.decodeUnknownOption(S.Array(S.Unknown));
const decodeNumberOption = S.decodeUnknownOption(S.Finite);
const decodeStringOption = S.decodeUnknownOption(S.String);
const decodeFallowReportEnvelope = S.decodeUnknownEffect(FallowReportEnvelope);
const decodeFallowReportOkOption = S.decodeUnknownOption(FallowReportOk);
const decodeFallowAttributionKindsOption = S.decodeUnknownOption(FallowAttributionKinds);
const decodeFallowEnvelopeStatusOption = S.decodeUnknownOption(FallowEnvelopeStatus);

const FallowVersionedRawFields = {
  schema_version: S.Finite,
  version: S.String,
  elapsed_ms: S.Finite,
};
class FallowRawAction extends S.Class<FallowRawAction>($I`FallowRawAction`)(
  {
    type: S.String,
    auto_fixable: S.Boolean,
    description: S.String,
  },
  $I.annote("FallowRawAction", {
    description: "Common raw Fallow action shape emitted with actionable findings.",
  })
) {}
class FallowActionIssue extends S.Class<FallowActionIssue>($I`FallowActionIssue`)(
  {
    actions: S.Array(FallowRawAction),
  },
  $I.annote("FallowActionIssue", {
    description: "Raw Fallow issue item that must carry action metadata.",
  })
) {}
const FallowIssueArray = S.Array(FallowActionIssue).pipe(
  $I.annoteSchema("FallowIssueArray", {
    description: "Raw Fallow issue array retained for success-shape validation.",
  })
);
class FallowHealthFinding extends S.Class<FallowHealthFinding>($I`FallowHealthFinding`)(
  {
    path: S.String,
    name: S.String,
    line: S.Finite,
    col: S.Finite,
    cyclomatic: S.Finite,
    cognitive: S.Finite,
    line_count: S.Finite,
    param_count: S.Finite,
    severity: S.String,
    actions: S.Array(FallowRawAction),
  },
  $I.annote("FallowHealthFinding", {
    description: "Raw Fallow health finding shape.",
  })
) {}
class FallowFeatureFlagFinding extends S.Class<FallowFeatureFlagFinding>($I`FallowFeatureFlagFinding`)(
  {
    path: S.String,
    line: S.Finite,
  },
  $I.annote("FallowFeatureFlagFinding", {
    description: "Raw Fallow feature flag finding shape.",
  })
) {}
class FallowSecurityTracePoint extends S.Class<FallowSecurityTracePoint>($I`FallowSecurityTracePoint`)(
  {
    path: S.String,
    line: S.Finite,
    col: S.Finite,
    role: S.String,
  },
  $I.annote("FallowSecurityTracePoint", {
    description: "Raw Fallow security trace point shape.",
  })
) {}
class FallowSecurityFinding extends S.Class<FallowSecurityFinding>($I`FallowSecurityFinding`)(
  {
    kind: S.String,
    category: S.optionalKey(S.String),
    cwe: S.optionalKey(S.Finite),
    path: S.String,
    line: S.Finite,
    col: S.Finite,
    evidence: S.String,
    trace: S.Array(FallowSecurityTracePoint),
    actions: S.Array(FallowRawAction),
  },
  $I.annote("FallowSecurityFinding", {
    description: "Raw Fallow security finding shape.",
  })
) {}
class FallowFixPreviewFinding extends S.Class<FallowFixPreviewFinding>($I`FallowFixPreviewFinding`)(
  {
    type: S.String,
    path: S.optionalKey(S.String),
    file: S.optionalKey(S.String),
    line: S.optionalKey(S.Finite),
  },
  $I.annote("FallowFixPreviewFinding", {
    description: "Raw Fallow fix dry-run item shape.",
  })
) {}
class FallowDeadCodeSummaryRawReport extends S.Class<FallowDeadCodeSummaryRawReport>(
  $I`FallowDeadCodeSummaryRawReport`
)(
  {
    total_issues: S.Finite,
    unused_files: S.Finite,
    unused_exports: S.Finite,
    unused_types: S.Finite,
    unused_dependencies: S.Finite,
    unresolved_imports: S.Finite,
    unlisted_dependencies: S.Finite,
    boundary_violations: S.Finite,
  },
  $I.annote("FallowDeadCodeSummaryRawReport", {
    description: "Raw Fallow dead-code summary counts emitted by dead-code JSON output.",
  })
) {}
class FallowEntryPointsRawReport extends S.Class<FallowEntryPointsRawReport>($I`FallowEntryPointsRawReport`)(
  {
    total: S.Finite,
    sources: S.Record(S.String, S.Finite),
  },
  $I.annote("FallowEntryPointsRawReport", {
    description: "Raw Fallow entry point summary emitted by dead-code JSON output.",
  })
) {}
const FallowAuditRawReport = S.Struct({
  kind: S.Literal("audit"),
  ...FallowVersionedRawFields,
  command: S.Literal("audit"),
  verdict: S.String,
  changed_files_count: S.Finite,
  base_ref: S.String,
  summary: S.Struct({
    dead_code_issues: S.Finite,
    dead_code_has_errors: S.Boolean,
    complexity_findings: S.Finite,
    max_cyclomatic: S.NullOr(S.Finite),
    duplication_clone_groups: S.Finite,
  }),
  attribution: S.Struct({
    gate: S.String,
    dead_code_introduced: S.Finite,
    dead_code_inherited: S.Finite,
    complexity_introduced: S.Finite,
    complexity_inherited: S.Finite,
    duplication_introduced: S.Finite,
    duplication_inherited: S.Finite,
  }),
}).pipe(
  $I.annoteSchema("FallowAuditRawReport", {
    description: "Raw Fallow audit JSON shape accepted by the P1 wrapper.",
  })
);
const FallowDeadCodeRawReport = S.Struct({
  kind: S.Literal("dead-code"),
  ...FallowVersionedRawFields,
  total_issues: S.Finite,
  entry_points: FallowEntryPointsRawReport,
  summary: FallowDeadCodeSummaryRawReport,
  unused_files: FallowIssueArray,
  unused_exports: FallowIssueArray,
  unused_types: FallowIssueArray,
  private_type_leaks: FallowIssueArray,
  unused_dependencies: FallowIssueArray,
  unused_dev_dependencies: FallowIssueArray,
  unused_optional_dependencies: FallowIssueArray,
  unused_enum_members: FallowIssueArray,
  unused_class_members: FallowIssueArray,
  unresolved_imports: FallowIssueArray,
  unlisted_dependencies: FallowIssueArray,
  duplicate_exports: FallowIssueArray,
  type_only_dependencies: FallowIssueArray,
  test_only_dependencies: FallowIssueArray,
  circular_dependencies: FallowIssueArray,
  re_export_cycles: FallowIssueArray,
  boundary_violations: FallowIssueArray,
  stale_suppressions: FallowIssueArray,
  unused_catalog_entries: FallowIssueArray,
  empty_catalog_groups: FallowIssueArray,
  unresolved_catalog_references: FallowIssueArray,
  unused_dependency_overrides: FallowIssueArray,
  misconfigured_dependency_overrides: FallowIssueArray,
}).pipe(
  $I.annoteSchema("FallowDeadCodeRawReport", {
    description: "Raw Fallow dead-code JSON shape accepted by dead-code and boundary lanes.",
  })
);
const FallowHealthRawReport = S.Struct({
  kind: S.Literal("health"),
  ...FallowVersionedRawFields,
  findings: S.Array(FallowHealthFinding),
  summary: S.Struct({
    files_analyzed: S.Finite,
    functions_analyzed: S.Finite,
    functions_above_threshold: S.Finite,
    average_maintainability: S.Finite,
    severity_critical_count: S.Finite,
    severity_high_count: S.Finite,
    severity_moderate_count: S.Finite,
  }),
}).pipe(
  $I.annoteSchema("FallowHealthRawReport", {
    description: "Raw Fallow health JSON shape accepted by the P1 wrapper.",
  })
);
const FallowFlagsRawReport = S.Struct({
  ...FallowVersionedRawFields,
  feature_flags: S.Array(FallowFeatureFlagFinding),
  total_flags: S.Finite,
}).pipe(
  $I.annoteSchema("FallowFlagsRawReport", {
    description: "Raw Fallow flags JSON shape accepted by the P1 wrapper.",
  })
);
class FallowSecurityDetailedRawReport extends S.Class<FallowSecurityDetailedRawReport>(
  $I`FallowSecurityDetailedRawReport`
)(
  {
    kind: S.Literal("security"),
    schema_version: S.Union([S.Finite, S.String]),
    security_findings: S.Array(FallowSecurityFinding),
    unresolved_edge_files: S.Finite,
    unresolved_callee_sites: S.Finite,
  },
  $I.annote("FallowSecurityDetailedRawReport", {
    description: "Detailed raw Fallow security JSON shape accepted by the P1 wrapper.",
  })
) {}
class FallowSecuritySummaryRawReport extends S.Class<FallowSecuritySummaryRawReport>(
  $I`FallowSecuritySummaryRawReport`
)(
  {
    kind: S.Literal("security"),
    schema_version: S.Union([S.Finite, S.String]),
    version: S.String,
    elapsed_ms: S.Finite,

    summary: S.Struct({
      security_findings: S.Finite,
      unresolved_edge_files: S.Finite,
      unresolved_callee_sites: S.Finite,
    }),
  },
  $I.annote("FallowSecuritySummaryRawReport", {
    description: "Summary raw Fallow security JSON shape accepted by the P1 wrapper.",
  })
) {}

/**
 * Legacy Fallow CI upload diagnostic test helper.
 *
 * @category testing
 * @since 0.0.0
 */
export { fallowCiUploadDiagnosticsForTesting } from "./internal/FallowCiContract.ts";

const FallowSecurityRawReport = S.Union([FallowSecurityDetailedRawReport, FallowSecuritySummaryRawReport]).pipe(
  $I.annoteSchema("FallowSecurityRawReport", {
    description: "Raw Fallow security JSON shapes accepted by the P1 wrapper.",
  })
);
class FallowFixPreviewRawReport extends S.Class<FallowFixPreviewRawReport>($I`FallowFixPreviewRawReport`)(
  {
    dry_run: S.Literal(true),
    fixes: S.Array(FallowFixPreviewFinding),
    total_fixed: S.Finite,
    skipped: S.Finite,
    skipped_content_changed: S.Finite,
    skipped_low_confidence_exports: S.Finite,
    skipped_mixed_line_endings: S.Finite,
  },
  $I.annote("FallowFixPreviewRawReport", {
    description: "Raw Fallow fix dry-run JSON shape accepted by the P1 wrapper.",
  })
) {}
const decodeFallowAuditRawReportOption = S.decodeUnknownOption(FallowAuditRawReport);
const decodeFallowDeadCodeRawReportOption = S.decodeUnknownOption(FallowDeadCodeRawReport);
const decodeFallowHealthRawReportOption = S.decodeUnknownOption(FallowHealthRawReport);
const decodeFallowFlagsRawReportOption = S.decodeUnknownOption(FallowFlagsRawReport);
const decodeFallowSecurityRawReportOption = S.decodeUnknownOption(FallowSecurityRawReport);
const decodeFallowFixPreviewRawReportOption = S.decodeUnknownOption(FallowFixPreviewRawReport);

type FallowFinding = FallowReportFinding;
type FallowQualityEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;
type FallowCommandOptions = {
  readonly advisory: boolean;
  readonly base: string;
  readonly check: boolean;
  readonly out: string;
  readonly quiet: boolean;
};
type ProcessResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
  readonly exitCode: number;
};
class FallowAuditDiffFallbackResult extends S.Class<FallowAuditDiffFallbackResult>($I`FallowAuditDiffFallbackResult`)(
  {
    stdout: S.String,
    stderr: S.optionalKey(S.String),
    exitCode: S.Finite,
  },
  $I.annote("FallowAuditDiffFallbackResult", {
    description: "Fallow audit process result fields used to detect sandbox worktree failures.",
  })
) {}
const FallowAuditDiffFallbackPredicate = Fn({
  input: FallowAuditDiffFallbackResult,
  output: S.Boolean,
}).pipe(
  $I.annoteSchema("FallowAuditDiffFallbackPredicate", {
    description: "Function contract for deciding whether Fallow audit needs the diff-scoped fallback.",
  })
);
type ReportPathResolution = {
  readonly absolute: string;
  readonly relative: string;
  readonly rawAbsolute: string;
  readonly rawRelative: string;
};

const commandText = (command: string, args: ReadonlyArray<string>) => A.join([command, ...args], " ");
const csvValues = (value: string): ReadonlyArray<string> =>
  pipe(
    Str.split(value, ","),
    A.map(Str.trim),
    A.filter((item) => item.length > 0)
  );

const normalizePath = Str.replaceAll("\\", "/");
const parserName = (feature: FallowFeature): string => `fallow/${feature}/v1`;
const subCategoryName = (feature: FallowFeature, rule: string): string => `fallow:${feature}:${rule}`;
const slugify: (value: string) => string = flow(
  Str.toLowerCase,
  Str.replace(/[^a-z0-9]+/gu, "-"),
  Str.replace(/^-|-$/gu, "")
);

const unknownRecordProperty = (value: unknown, key: string): O.Option<unknown> =>
  pipe(
    decodeUnknownRecordOption(value),
    O.flatMap((record) => O.fromUndefinedOr(record[key]))
  );

const unknownNumberProperty = (value: unknown, key: string): O.Option<number> =>
  pipe(unknownRecordProperty(value, key), O.flatMap(decodeNumberOption));

const unknownStringProperty = (value: unknown, key: string): O.Option<string> =>
  pipe(unknownRecordProperty(value, key), O.flatMap(decodeStringOption));

const yamlDocumentValue = Effect.fn("FallowQuality.yamlDocumentValue")(function* (
  filePath: string,
  text: string
): Effect.fn.Return<unknown, QualityScriptCommandError> {
  const document = yield* Effect.try({
    try: () => parseDocument(text),
    catch: (cause) =>
      QualityScriptCommandError.make({
        message: `Failed to parse workflow YAML ${filePath}.`,
        cause,
      }),
  });

  if (!A.isReadonlyArrayEmpty(document.errors)) {
    const message = pipe(
      A.head(document.errors),
      O.map((error) => error.message),
      O.getOrElse(() => "YAML parser reported an unknown error.")
    );
    return yield* QualityScriptCommandError.make({
      message: `Invalid workflow YAML ${filePath}: ${message}`,
      exitCode: 1,
    });
  }

  return yield* Effect.try({
    try: () => document.toJSON(),
    catch: (cause) =>
      QualityScriptCommandError.make({
        message: `Failed to read workflow YAML ${filePath}.`,
        cause,
      }),
  });
});

const countFor = (findings: ReadonlyArray<FallowFinding>, attribution: typeof FindingAttributionKind.Type): number =>
  pipe(
    findings,
    A.filter((finding) => sameAttributionKind(finding.attribution, attribution)),
    A.length
  );

const attributionSummary = (findings: ReadonlyArray<FallowFinding>): FindingAttributionSummary =>
  FindingAttributionSummary.make({
    introduced: NonNegativeInt.make(countFor(findings, "introduced")),
    inheritedAdjacent: NonNegativeInt.make(countFor(findings, "inherited-adjacent")),
    notApplicable: NonNegativeInt.make(countFor(findings, "not-applicable")),
  });

const attributionKinds = (findings: ReadonlyArray<FallowFinding>): FallowAttributionKinds => {
  const discovered = pipe(
    findings,
    A.map((finding) => finding.attribution),
    A.dedupe
  );

  return A.isReadonlyArrayNonEmpty(discovered) ? discovered : ["not-applicable"];
};

const attributionKindSetDiagnostics = (
  label: string,
  expected: ReadonlyArray<typeof FindingAttributionKind.Type>,
  actual: ReadonlyArray<typeof FindingAttributionKind.Type>
): ReadonlyArray<string> => {
  const missing = pipe(
    expected,
    A.filter((kind) => !A.some(actual, (actualKind) => sameAttributionKind(kind, actualKind)))
  );
  const extra = pipe(
    actual,
    A.filter((kind) => !A.some(expected, (expectedKind) => sameAttributionKind(kind, expectedKind)))
  );
  return A.isReadonlyArrayEmpty(missing) && A.isReadonlyArrayEmpty(extra)
    ? A.empty()
    : [`${label} mismatch. Missing: ${A.join(missing, ", ") || "none"}. Extra: ${A.join(extra, ", ") || "none"}.`];
};

// Promoted blocking lanes (goals/fallow-quality-enforcement feature matrix):
// dead-code blocks on any finding against its zero baseline; audit blocks only
// on introduced findings under the new-only gate. All other lanes stay advisory.
const promotedBlockingFinding = (feature: FallowFeature, attribution: typeof FindingAttributionKind.Type): boolean =>
  FallowFeatureFamily.$match(feature, {
    audit: () => sameAttributionKind(attribution, "introduced"),
    boundaries: () => false,
    "dead-code": () => true,
    "fix-preview": () => false,
    flags: () => false,
    health: () => false,
    security: () => false,
  });

const auditFinding = (
  rule: string,
  attribution: typeof FindingAttributionKind.Type,
  feature: FallowFeature,
  index?: number
): FallowFinding =>
  FallowReportFinding.make({
    id: `${feature}-${attribution}-${rule}${index === undefined ? "" : `-${index + 1}`}`,
    featureFamily: feature,
    attribution,
    parser: parserName(feature),
    subCategory: subCategoryName(feature, rule),
    blocking: promotedBlockingFinding(feature, attribution),
    sourceRef: fallbackSourceRef,
  });

const auditFindingsForCount = (
  rule: string,
  attribution: typeof FindingAttributionKind.Type,
  count: number
): ReadonlyArray<FallowFinding> =>
  A.unfold(0, (index) =>
    index < rawCountValue(count)
      ? O.some([auditFinding(rule, attribution, "audit", index), index + 1] as const)
      : O.none()
  );

// A duplication clone group is "source-involving" when at least one of its
// instances lives under a package/app `src/` tree. Introduced duplication that
// is confined to test or config files is idiomatic, intentionally-repetitive
// boilerplate that fallow cannot selectively ignore; it is reported advisory
// (inherited-adjacent) rather than blocking, while real source-code duplication
// still blocks. See goals/desktop-chat-surface/history/2026-06-14-fallow-audit-investigation.md.
const AuditDuplicationCloneGroups = S.Struct({
  clone_groups: S.Array(
    S.Struct({
      introduced: S.optionalKey(S.Boolean),
      instances: S.Array(S.Struct({ file: S.String })),
    })
  ),
});
const decodeAuditDuplicationOption = S.decodeUnknownOption(AuditDuplicationCloneGroups);

const cloneGroupTouchesSource = (group: { readonly instances: ReadonlyArray<{ readonly file: string }> }): boolean =>
  A.some(group.instances, (instance) => Str.includes("/src/")(normalizePath(instance.file)));

// Count introduced duplication clone groups confined to test/config files (no
// source involvement). Fail closed: when the clone groups cannot be parsed,
// report none as test-only so real source-code regressions still block.
const introducedTestOnlyDuplicationCount = (document: unknown): number =>
  pipe(
    unknownRecordProperty(document, "duplication"),
    O.flatMap(decodeAuditDuplicationOption),
    O.map((duplication) =>
      A.length(
        A.filter(duplication.clone_groups, (group) => (group.introduced ?? false) && !cloneGroupTouchesSource(group))
      )
    ),
    O.getOrElse(() => 0)
  );

const normalizeAuditFindings = (document: unknown): ReadonlyArray<FallowFinding> => {
  const attribution = pipe(unknownRecordProperty(document, "attribution"), O.getOrUndefined);
  if (attribution === undefined) {
    return A.empty();
  }

  const countOf = (key: string): number =>
    pipe(
      unknownNumberProperty(attribution, key),
      O.getOrElse(() => 0)
    );

  // Split introduced duplication: source-involving groups block; test/config-only
  // groups are advisory (folded into the inherited-adjacent duplication bucket).
  const duplicationIntroduced = countOf("duplication_introduced");
  const duplicationTestOnly = Math.min(duplicationIntroduced, introducedTestOnlyDuplicationCount(document));
  const duplicationSourceIntroduced = duplicationIntroduced - duplicationTestOnly;

  const candidates = [
    ["dead-code", "introduced", countOf("dead_code_introduced")],
    ["dead-code", "inherited-adjacent", countOf("dead_code_inherited")],
    ["complexity", "introduced", countOf("complexity_introduced")],
    ["complexity", "inherited-adjacent", countOf("complexity_inherited")],
    ["duplication", "introduced", duplicationSourceIntroduced],
    ["duplication", "inherited-adjacent", countOf("duplication_inherited") + duplicationTestOnly],
  ] as const;

  return pipe(
    candidates,
    A.flatMap(([rule, attributionKind, count]) => auditFindingsForCount(rule, attributionKind, count))
  );
};

const normalizeSummaryFindings = (feature: FallowFeature, document: unknown): ReadonlyArray<FallowFinding> => {
  const summary = pipe(unknownRecordProperty(document, "summary"), O.getOrUndefined);
  const summaryRecord = decodeUnknownRecordOption(summary);
  if (O.isNone(summaryRecord)) {
    return A.empty();
  }

  return pipe(
    R.keys(summaryRecord.value),
    A.flatMap((key) =>
      key === "total_issues"
        ? A.empty()
        : findingsForCount(
            feature,
            slugify(key),
            pipe(
              unknownNumberProperty(summaryRecord.value, key),
              O.getOrElse(() => 0)
            )
          )
    )
  );
};

const rawCountValue = (count: number): number =>
  Number.isFinite(count) ? Math.min(maxFindingsPerCount, Math.max(0, Math.trunc(count))) : 0;

const notApplicableFinding = (feature: FallowFeature, rule: string, index?: number): FallowFinding =>
  FallowReportFinding.make({
    id: `${feature}-not-applicable-${slugify(rule)}${index === undefined ? "" : `-${index + 1}`}`,
    featureFamily: feature,
    attribution: "not-applicable",
    parser: parserName(feature),
    subCategory: subCategoryName(feature, slugify(rule)),
    blocking: promotedBlockingFinding(feature, "not-applicable"),
    sourceRef: fallbackSourceRef,
  });

const findingsForCount = (feature: FallowFeature, rule: string, count: number): ReadonlyArray<FallowFinding> =>
  A.unfold(0, (index) =>
    index < rawCountValue(count) ? O.some([notApplicableFinding(feature, rule, index), index + 1] as const) : O.none()
  );

const rawArrayCount = (document: unknown, key: string): number =>
  pipe(
    unknownRecordProperty(document, key),
    O.flatMap(decodeUnknownArrayOption),
    O.match({
      onNone: () => 0,
      onSome: A.length,
    })
  );

const rawSecurityFindingCount = (document: unknown): number =>
  pipe(
    unknownRecordProperty(document, "summary"),
    O.flatMap((summary) => unknownNumberProperty(summary, "security_findings")),
    O.getOrElse(() => rawArrayCount(document, "security_findings"))
  );

const rawSummaryIssueCount = (document: unknown): number => {
  const totalIssues = unknownNumberProperty(document, "total_issues");
  if (O.isSome(totalIssues)) {
    return rawCountValue(totalIssues.value);
  }

  const summary = pipe(unknownRecordProperty(document, "summary"), O.getOrUndefined);
  const summaryRecord = decodeUnknownRecordOption(summary);
  if (O.isNone(summaryRecord)) {
    return 0;
  }

  return pipe(
    R.keys(summaryRecord.value),
    A.reduce(0, (total, key) =>
      key === "total_issues"
        ? total
        : total +
          rawCountValue(
            pipe(
              unknownNumberProperty(summaryRecord.value, key),
              O.getOrElse(() => 0)
            )
          )
    )
  );
};

const normalizeArrayFindings = (
  feature: FallowFeature,
  document: unknown,
  key: string,
  rule: string
): ReadonlyArray<FallowFinding> => findingsForCount(feature, rule, rawArrayCount(document, key));

const normalizeFlagsFindings = (document: unknown): ReadonlyArray<FallowFinding> =>
  findingsForCount(
    "flags",
    "feature-flags",
    pipe(
      unknownNumberProperty(document, "total_flags"),
      O.getOrElse(() => rawArrayCount(document, "feature_flags"))
    )
  );

const normalizeFindings = (feature: FallowFeature, document: unknown): ReadonlyArray<FallowFinding> =>
  FallowFeatureFamily.$match(feature, {
    audit: () => normalizeAuditFindings(document),
    boundaries: () => normalizeSummaryFindings(feature, document),
    "dead-code": () => normalizeSummaryFindings(feature, document),
    "fix-preview": () => normalizeArrayFindings(feature, document, "fixes", "fixes"),
    flags: () => normalizeFlagsFindings(document),
    health: () => normalizeArrayFindings(feature, document, "findings", "complexity-findings"),
    security: () => findingsForCount(feature, "security-findings", rawSecurityFindingCount(document)),
  });

// fallow-ignore-next-line code-duplication
const rawFindingCount = (feature: FallowFeature, document: unknown): number =>
  FallowFeatureFamily.$match(feature, {
    audit: () => A.length(normalizeAuditFindings(document)),
    boundaries: () => rawSummaryIssueCount(document),
    "dead-code": () => rawSummaryIssueCount(document),
    "fix-preview": () => rawCountValue(rawArrayCount(document, "fixes")),
    flags: () =>
      rawCountValue(
        pipe(
          unknownNumberProperty(document, "total_flags"),
          O.getOrElse(() => rawArrayCount(document, "feature_flags"))
        )
      ),
    health: () => rawCountValue(rawArrayCount(document, "findings")),
    security: () => rawCountValue(rawSecurityFindingCount(document)),
  });

const extractJsonDocumentText = (output: string): O.Option<string> =>
  pipe(
    Str.match(/\{[\s\S]*\}/u)(output),
    O.flatMap((match) => O.fromUndefinedOr(match[0]))
  );

const normalizeToolVersion = (output: string): string =>
  pipe(
    Str.match(/fallow\s+\d+\.\d+\.\d+/u)(output),
    O.flatMap((match) => O.fromUndefinedOr(match[0])),
    O.getOrElse(() => {
      const trimmed = Str.trim(output);
      return Str.isNonEmpty(trimmed) ? trimmed : "fallow unknown";
    })
  );

const stderrExcerpt = (output: string): string => {
  const trimmed = Str.trim(output);
  return Str.isNonEmpty(trimmed) ? Str.slice(0, 4000)(trimmed) : "fallow emitted no stderr";
};

const combineProcessOutput = (stdout: string, stderr: string): string =>
  pipe([Str.trim(stdout), Str.trim(stderr)], A.filter(Str.isNonEmpty), A.join("\n"));

const formatEpochMillis = (millis: number): string =>
  Number.isFinite(millis) && millis >= 0 ? DateTime.formatIso(DateTime.makeUnsafe(millis)) : "unknown";

const collectProcessOutput = Effect.fn("FallowQuality.collectProcessOutput")(function* (
  repoRoot: string,
  command: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ProcessResult, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runCapturedStreams({
    command,
    args,
    cwd: repoRoot,
    extendEnv: true,
  }).pipe(
    QualityScriptCommandError.mapError(`Failed to run ${commandText(command, args)}.`, {
      command: commandText(command, args),
    })
  );
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    output: combineProcessOutput(result.stdout, result.stderr),
    exitCode: result.exitCode,
  };
});

const collectOptionalOutput = Effect.fn("FallowQuality.collectOptionalOutput")(function* (
  repoRoot: string,
  command: string,
  args: ReadonlyArray<string>,
  fallback: string
): Effect.fn.Return<string, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectProcessOutput(repoRoot, command, args).pipe(Effect.option);
  if (O.isNone(result) || result.value.exitCode !== 0) {
    return fallback;
  }

  const outputText = pipe(
    extractJsonDocumentText(result.value.output),
    O.getOrElse(() => result.value.output)
  );
  const trimmed = Str.trim(outputText);
  return Str.isNonEmpty(trimmed) ? trimmed : fallback;
});

const resolveReportPath = Effect.fn("FallowQuality.resolveReportPath")(function* (
  repoRoot: string,
  out: string,
  feature: FallowFeature
): Effect.fn.Return<ReportPathResolution, never, Path.Path> {
  const path = yield* Path.Path;
  const absolute = path.isAbsolute(out) ? out : path.join(repoRoot, out);
  const relative = normalizePath(path.relative(repoRoot, absolute));
  const rawBasename = pipe(
    path.basename(relative),
    Str.replace(/\.[^.]+$/u, ""),
    O.liftPredicate(Str.isNonEmpty),
    O.getOrElse(() => feature)
  );
  const rawRelative = normalizePath(path.join(path.dirname(relative), "raw", `${rawBasename}.combined.txt`));
  const rawAbsolute = path.join(repoRoot, rawRelative);

  return {
    absolute,
    relative,
    rawAbsolute,
    rawRelative,
  };
});

const fallowArgs = (feature: FallowFeature, base: string, quiet: boolean): ReadonlyArray<string> => {
  const quietArgs = quiet ? ["--quiet"] : [];

  return FallowFeatureFamily.$match(feature, {
    audit: () => [
      "run",
      "fallow",
      "--",
      "audit",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--base",
      base,
      "--gate",
      "new-only",
    ],
    "dead-code": () => [
      "run",
      "fallow",
      "--",
      "dead-code",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--summary",
    ],
    health: () => [
      "run",
      "fallow",
      "--",
      "health",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--report-only",
      "--top",
      "50",
    ],
    boundaries: () => [
      "run",
      "fallow",
      "--",
      "dead-code",
      "--boundary-violations",
      "--config",
      "standards/fallow.boundaries.generated.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--summary",
    ],
    flags: () => [
      "run",
      "fallow",
      "--",
      "flags",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--summary",
      "--top",
      "50",
    ],
    security: () => [
      "run",
      "fallow",
      "--",
      "security",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      ...quietArgs,
      "--summary",
    ],
    "fix-preview": () => ["run", "fallow", "--", "fix", "--dry-run", "--format", "json", "--no-create-config"],
  });
};

/**
 * Build the fallback Fallow audit argv used when base-snapshot worktrees are unavailable.
 *
 * @param base - Base ref passed through to Fallow audit.
 * @param quiet - Whether the fallback should pass Fallow's `--quiet` flag.
 * @param diffPath - Path to the generated diff file consumed by Fallow audit.
 * @returns Ordered Bun argv for the diff-scoped Fallow audit fallback.
 * @example
 * ```ts
 * import { fallowAuditDiffFallbackArgsForTesting } from "@beep/repo-cli/commands/Quality/FallowQuality.command"
 *
 * const args = fallowAuditDiffFallbackArgsForTesting("origin/main", true, "/tmp/audit.diff")
 * console.log(args.includes("--diff-file"), args[args.length - 1])
 * // true all
 * ```
 * @category testing
 * @since 0.0.0
 */
export const fallowAuditDiffFallbackArgsForTesting = (
  base: string,
  quiet: boolean,
  diffPath: string
): ReadonlyArray<string> => [
  "run",
  "fallow",
  "--",
  "audit",
  "--config",
  ".fallowrc.jsonc",
  "--format",
  "json",
  ...(quiet ? ["--quiet"] : []),
  "--base",
  base,
  "--diff-file",
  diffPath,
  "--gate",
  "all",
];

const wrapperArgs = (feature: FallowFeature, options: FallowCommandOptions, out: string): ReadonlyArray<string> => [
  "quality",
  "fallow",
  feature,
  ...(options.advisory ? ["--advisory"] : []),
  "--base",
  options.base,
  ...(options.check ? ["--check"] : []),
  "--out",
  out,
  ...(options.quiet ? ["--quiet"] : []),
];

const renderWrapperCommand = (feature: FallowFeature, options: FallowCommandOptions, out: string): string =>
  commandText("beep", wrapperArgs(feature, options, out));

/**
 * Detect the structured Fallow audit error that should use the diff-scoped fallback.
 *
 * @param result - Captured Fallow audit process result to inspect.
 * @returns `true` when Fallow failed because the base worktree snapshot could not be created.
 * @example
 * ```ts
 * import { fallowAuditNeedsDiffFallbackForTesting } from "@beep/repo-cli/commands/Quality/FallowQuality.command"
 *
 * const worktreeError = fallowAuditNeedsDiffFallbackForTesting({
 *   exitCode: 2,
 *   stdout: JSON.stringify({
 *     error: true,
 *     message: "could not create a temporary worktree for base ref 'origin/main'",
 *     exit_code: 2,
 *   }),
 * })
 * const unrelatedError = fallowAuditNeedsDiffFallbackForTesting({
 *   exitCode: 2,
 *   stdout: JSON.stringify({
 *     error: true,
 *     message: "configuration file was not found",
 *     exit_code: 2,
 *   }),
 * })
 * console.log([worktreeError, unrelatedError])
 * // [true, false]
 * ```
 * @category testing
 * @since 0.0.0
 */
export const fallowAuditNeedsDiffFallbackForTesting = FallowAuditDiffFallbackPredicate.implementSync((result) => {
  if (result.exitCode !== 2) {
    return false;
  }

  return A.some(
    [
      result.stdout,
      pipe(
        result.stderr,
        O.fromUndefinedOr,
        O.getOrElse(() => "")
      ),
    ],
    flow(
      extractJsonDocumentText,
      O.flatMap((jsonText) => Effect.runSync(decodeJsonText(jsonText).pipe(Effect.option))),
      O.flatMap((document) => unknownStringProperty(document, "message")),
      O.exists(Str.includes("could not create a temporary worktree for base ref"))
    )
  );
});

const hasFallowReportShape = (feature: FallowFeature, document: unknown): boolean =>
  FallowFeatureFamily.$match(feature, {
    audit: () => O.isSome(decodeFallowAuditRawReportOption(document)),
    boundaries: () => O.isSome(decodeFallowDeadCodeRawReportOption(document)),
    "dead-code": () => O.isSome(decodeFallowDeadCodeRawReportOption(document)),
    "fix-preview": () => O.isSome(decodeFallowFixPreviewRawReportOption(document)),
    flags: () => O.isSome(decodeFallowFlagsRawReportOption(document)),
    health: () => O.isSome(decodeFallowHealthRawReportOption(document)),
    security: () => O.isSome(decodeFallowSecurityRawReportOption(document)),
  });

const baseEnvelope = (
  feature: FallowFeature,
  options: FallowCommandOptions,
  paths: ReportPathResolution,
  generatedAt: string,
  toolVersion: string,
  dirtyWorktree: boolean,
  findings: ReadonlyArray<FallowFinding>
) => ({
  schemaVersion: "fallow-report-envelope/v1" as const,
  toolVersion,
  command: renderWrapperCommand(feature, options, paths.relative),
  subcommand: feature,
  baseRef: options.base,
  generatedAt,
  advisory: options.advisory,
  dirtyWorktree,
  reportPath: paths.relative,
  rawOutputRef: paths.rawRelative,
  attributionKinds: attributionKinds(findings),
  findingAttributionSummary: attributionSummary(findings),
});

const makeOkEnvelope = (
  feature: FallowFeature,
  options: FallowCommandOptions,
  paths: ReportPathResolution,
  generatedAt: string,
  toolVersion: string,
  dirtyWorktree: boolean,
  exitStatus: number,
  decoded: unknown
): FallowReportOk => {
  const findings = normalizeFindings(feature, decoded);

  return FallowReportOk.make({
    ...baseEnvelope(feature, options, paths, generatedAt, toolVersion, dirtyWorktree, findings),
    status: "ok",
    exitStatus: NonNegativeInt.make(exitStatus),
    report: FallowReportPayload.make({
      findingCount: NonNegativeInt.make(A.length(findings)),
      findings,
    }),
  });
};

const positiveExitStatus = (exitStatus: number): typeof PositiveExitStatus.Type =>
  PositiveExitStatus.make(exitStatus > 0 ? exitStatus : 1);

const makeFailureEnvelope = (
  feature: FallowFeature,
  options: FallowCommandOptions,
  paths: ReportPathResolution,
  generatedAt: string,
  toolVersion: string,
  dirtyWorktree: boolean,
  status: typeof FallowFailureEnvelopeStatus.Type,
  exitStatus: number,
  message: string
): FallowReportToolFailed | FallowReportInvalidJson | FallowReportInvalidReport | FallowReportBaseResolutionFailed => {
  const base = baseEnvelope(feature, options, paths, generatedAt, toolVersion, dirtyWorktree, A.empty());
  return FallowFailureEnvelopeStatus.$match(status, {
    "base-resolution-failed": () =>
      FallowReportBaseResolutionFailed.make({
        ...base,
        status: "base-resolution-failed",
        exitStatus: positiveExitStatus(exitStatus),
        stderrExcerpt: message,
      }),
    "invalid-json": () =>
      FallowReportInvalidJson.make({
        ...base,
        status: "invalid-json",
        exitStatus: NonNegativeInt.make(exitStatus),
        stderrExcerpt: message,
      }),
    "invalid-report": () =>
      FallowReportInvalidReport.make({
        ...base,
        status: "invalid-report",
        exitStatus: NonNegativeInt.make(exitStatus),
        stderrExcerpt: message,
      }),
    "tool-failed": () =>
      FallowReportToolFailed.make({
        ...base,
        status: "tool-failed",
        exitStatus: positiveExitStatus(exitStatus),
        stderrExcerpt: message,
      }),
  });
};

const encodeEnvelope = (envelope: FallowReportEnvelope): Effect.Effect<string, QualityScriptCommandError> =>
  encodeFallowEnvelopeJson(envelope).pipe(
    QualityScriptCommandError.mapError("Failed to encode Fallow report envelope.")
  );

const writeEnvelope = Effect.fn("FallowQuality.writeEnvelope")(function* (
  paths: ReportPathResolution,
  rawOutput: string,
  envelope: FallowReportEnvelope
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const envelopeText = yield* encodeEnvelope(envelope);

  yield* fs
    .makeDirectory(path.dirname(paths.absolute), { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${path.dirname(paths.absolute)}.`));
  yield* fs
    .makeDirectory(path.dirname(paths.rawAbsolute), { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${path.dirname(paths.rawAbsolute)}.`));
  yield* fs
    .writeFileString(paths.rawAbsolute, rawOutput)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${paths.rawAbsolute}.`));
  yield* fs
    .writeFileString(paths.absolute, `${envelopeText}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${paths.absolute}.`));
  yield* Console.log(envelopeText);
});

const dirtyWorktree = Effect.fn("FallowQuality.dirtyWorktree")(function* (
  repoRoot: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectProcessOutput(repoRoot, "git", ["status", "--porcelain"]).pipe(Effect.option);
  return O.isSome(result) && Str.trim(result.value.output).length > 0;
});

const resolveBaseRef = Effect.fn("FallowQuality.resolveBaseRef")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<ProcessResult, never, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* collectProcessOutput(repoRoot, "git", ["rev-parse", "--verify", base]).pipe(
    Effect.orElseSucceed(() => ({
      stdout: "",
      stderr: `unable to resolve base ref ${base}`,
      output: `unable to resolve base ref ${base}`,
      exitCode: 128,
    }))
  );
});

/**
 * Collect the tracked and untracked working-tree diff consumed by the audit fallback.
 *
 * @param repoRoot - Absolute repository root used as the Git working directory.
 * @param base - Base revision for tracked changes.
 * @returns A successful combined binary diff, or the first failed Git process result.
 * @example
 * ```ts
 * import { collectAuditDiffInputForTesting } from "@beep/repo-cli/commands/Quality/FallowQuality.command"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const result = yield* collectAuditDiffInputForTesting(process.cwd(), "origin/main")
 *   return result.exitCode
 * })
 * console.log(Effect.isEffect(program))
 * // true
 * ```
 * @category testing
 * @since 0.0.0
 */
export const collectAuditDiffInputForTesting = Effect.fn("FallowQuality.collectAuditDiffInput")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<ProcessResult, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const trackedDiff = yield* collectProcessOutput(repoRoot, "git", ["diff", "--binary", base, "--", "."]);
  if (trackedDiff.exitCode !== 0) {
    return trackedDiff;
  }

  const untrackedFiles = yield* collectProcessOutput(repoRoot, "git", [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  if (untrackedFiles.exitCode !== 0) {
    return untrackedFiles;
  }

  const paths = pipe(Str.split("\0")(untrackedFiles.stdout), A.filter(Str.isNonEmpty));
  const untrackedDiffs = yield* Effect.forEach(paths, (filePath) =>
    collectProcessOutput(repoRoot, "git", ["diff", "--binary", "--no-index", "--", "/dev/null", filePath])
  );
  const failedDiff = A.findFirst(untrackedDiffs, (result) => result.exitCode !== 0 && result.exitCode !== 1);
  if (O.isSome(failedDiff)) {
    return failedDiff.value;
  }

  const stdout = pipe([trackedDiff.stdout, ...A.map(untrackedDiffs, (result) => result.stdout)], A.join(""));
  return { stdout, stderr: "", output: stdout, exitCode: 0 };
});

const collectAuditDiffFallbackOutput = Effect.fn("FallowQuality.collectAuditDiffFallbackOutput")(function* (
  repoRoot: string,
  options: FallowCommandOptions,
  original: ProcessResult
): Effect.fn.Return<ProcessResult, QualityScriptCommandError, FallowQualityEnvironment> {
  if (!fallowAuditNeedsDiffFallbackForTesting(original)) {
    return original;
  }

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // Managed agent sandboxes can expose `.git` as read-only; `--gate all`
  // keeps the audit diff-scoped while skipping Fallow's base worktree snapshot.
  return yield* Effect.acquireUseRelease(
    fs
      .makeTempDirectory({ prefix: "beep-fallow-audit-diff-" })
      .pipe(QualityScriptCommandError.mapError("Failed to create temporary Fallow audit diff directory.")),
    Effect.fnUntraced(function* (tempDir) {
      const diffPath = path.join(tempDir, "working-tree.diff");
      const diffResult = yield* collectAuditDiffInputForTesting(repoRoot, options.base);
      if (diffResult.exitCode !== 0) {
        return original;
      }

      yield* fs
        .writeFileString(diffPath, diffResult.stdout)
        .pipe(QualityScriptCommandError.mapError(`Failed to write temporary Fallow audit diff ${diffPath}.`));

      return yield* collectProcessOutput(
        repoRoot,
        "bun",
        fallowAuditDiffFallbackArgsForTesting(options.base, options.quiet, diffPath)
      );
    }),
    (tempDir) => fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.ignore)
  );
});

const hasPromotedBlockingFindings = (envelope: FallowReportEnvelope): boolean =>
  pipe(
    decodeFallowReportOkOption(envelope),
    O.match({
      onNone: () => false,
      onSome: (okEnvelope) => A.some(okEnvelope.report.findings, (finding) => finding.blocking),
    })
  );

const shouldFailInvocation = (envelope: FallowReportEnvelope, options: FallowCommandOptions): boolean => {
  if (!sameEnvelopeStatus(envelope.status, "ok")) {
    return options.check || !options.advisory;
  }
  if (options.check) {
    return hasPromotedBlockingFindings(envelope);
  }
  return options.advisory ? false : envelope.exitStatus !== 0;
};

const envelopeFromProcessResult = Effect.fn("FallowQuality.envelopeFromProcessResult")(function* (
  feature: FallowFeature,
  options: FallowCommandOptions,
  paths: ReportPathResolution,
  generatedAt: string,
  toolVersion: string,
  dirty: boolean,
  result: ProcessResult
): Effect.fn.Return<FallowReportEnvelope, never, never> {
  const jsonText = pipe(extractJsonDocumentText(result.stdout), O.getOrUndefined);
  const decoded = P.isUndefined(jsonText) ? O.none() : yield* decodeJsonText(jsonText).pipe(Effect.option);

  return pipe(
    decoded,
    O.match({
      onNone: () =>
        makeFailureEnvelope(
          feature,
          options,
          paths,
          generatedAt,
          toolVersion,
          dirty,
          result.exitCode === 0 ? "invalid-json" : "tool-failed",
          result.exitCode,
          result.exitCode === 0
            ? `fallow emitted output that could not be decoded as JSON: ${stderrExcerpt(result.stderr)}`
            : stderrExcerpt(result.stderr)
        ),
      onSome: (document) =>
        hasFallowReportShape(feature, document)
          ? makeOkEnvelope(feature, options, paths, generatedAt, toolVersion, dirty, result.exitCode, document)
          : makeFailureEnvelope(
              feature,
              options,
              paths,
              generatedAt,
              toolVersion,
              dirty,
              "invalid-report",
              result.exitCode,
              `fallow emitted JSON that did not match the expected ${feature} report shape: ${stderrExcerpt(
                result.stderr
              )}`
            ),
    })
  );
});

const runFallowFeature = Effect.fn("FallowQuality.runFallowFeature")(function* (
  feature: FallowFeature,
  options: FallowCommandOptions
): Effect.fn.Return<void, QualityScriptCommandError, FallowQualityEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const paths = yield* resolveReportPath(repoRoot, options.out, feature);
  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const isDirty = yield* dirtyWorktree(repoRoot);
  const toolVersionOutput = yield* collectOptionalOutput(
    repoRoot,
    "bun",
    ["run", "fallow", "--", "--version"],
    "fallow unknown"
  );
  const toolVersion = normalizeToolVersion(toolVersionOutput);
  const baseResult = yield* resolveBaseRef(repoRoot, options.base);

  if (baseResult.exitCode !== 0) {
    const envelope = makeFailureEnvelope(
      feature,
      options,
      paths,
      generatedAt,
      toolVersion,
      isDirty,
      "base-resolution-failed",
      baseResult.exitCode,
      `unable to resolve base ref ${options.base}: ${stderrExcerpt(baseResult.stderr)}`
    );
    yield* writeEnvelope(paths, baseResult.output, envelope);
    if (shouldFailInvocation(envelope, options)) {
      return yield* QualityScriptCommandError.make({
        message: `Unable to resolve Fallow base ref ${options.base}.`,
        command: `git rev-parse --verify ${options.base}`,
        exitCode: baseResult.exitCode,
      });
    }
    return;
  }

  const args = fallowArgs(feature, options.base, options.quiet);
  const initialResult = yield* collectProcessOutput(repoRoot, "bun", args);
  const result =
    feature === "audit" ? yield* collectAuditDiffFallbackOutput(repoRoot, options, initialResult) : initialResult;
  const envelope = yield* envelopeFromProcessResult(feature, options, paths, generatedAt, toolVersion, isDirty, result);

  yield* writeEnvelope(paths, result.output, envelope);

  if (shouldFailInvocation(envelope, options)) {
    return yield* QualityScriptCommandError.make({
      message: `Fallow ${feature} failed with status ${envelope.status}.`,
      command: commandText("bun", args),
      exitCode: positiveExitStatus(envelope.exitStatus),
    });
  }
});

const readJsonDocument = Effect.fn("FallowQuality.readJsonDocument")(function* (
  filePath: string
): Effect.fn.Return<unknown, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const path = yield* Path.Path;
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  const text = yield* fs
    .readFileString(absolutePath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${absolutePath}.`));

  return yield* decodeJsonText(text).pipe(QualityScriptCommandError.mapError(`Failed to decode ${absolutePath}.`));
});

const requireEnvelopeKeys = (
  document: unknown,
  requiredKeys: ReadonlyArray<string>
): Effect.Effect<void, QualityScriptCommandError> => {
  const record = decodeUnknownRecordOption(document);
  if (O.isNone(record)) {
    return QualityScriptCommandError.make({
      message: "Fallow envelope is not a JSON object.",
      exitCode: 1,
    });
  }

  const missing = pipe(
    requiredKeys,
    A.filter((key) => !R.has(record.value, key))
  );

  if (A.isReadonlyArrayNonEmpty(missing)) {
    return QualityScriptCommandError.make({
      message: `Fallow envelope is missing required key(s): ${A.join(missing, ", ")}`,
      exitCode: 1,
    });
  }

  return Effect.void;
};

const exactEnvelopeKeyDiagnostics = (document: unknown): ReadonlyArray<string> => {
  const record = decodeUnknownRecordOption(document);
  if (O.isNone(record)) {
    return ["Fallow envelope is not a JSON object."];
  }

  const status = pipe(unknownRecordProperty(record.value, "status"), O.flatMap(decodeFallowEnvelopeStatusOption));
  if (O.isNone(status)) {
    return ["Fallow envelope is missing a valid status discriminator."];
  }

  const allowed = sameEnvelopeStatus(status.value, "ok") ? okEnvelopeKeys : failureEnvelopeKeys;
  const keys = R.keys(record.value);
  const missing = pipe(
    allowed,
    A.filter((key) => !A.contains(keys, key))
  );
  const surplus = pipe(
    keys,
    A.filter((key) => !A.contains(allowed, key))
  );

  return A.isReadonlyArrayNonEmpty(missing) || A.isReadonlyArrayNonEmpty(surplus)
    ? [
        `Fallow envelope key mismatch. Missing: ${A.join(missing, ", ") || "none"}. Surplus: ${
          A.join(surplus, ", ") || "none"
        }.`,
      ]
    : A.empty();
};

const reportInvariantDiagnostics = (document: unknown): ReadonlyArray<string> => {
  const status = pipe(unknownRecordProperty(document, "status"), O.flatMap(decodeFallowEnvelopeStatusOption));
  const exitStatus = pipe(
    unknownNumberProperty(document, "exitStatus"),
    O.getOrElse(() => -1)
  );
  const summary = pipe(unknownRecordProperty(document, "findingAttributionSummary"), O.getOrUndefined);
  const introduced = pipe(
    unknownNumberProperty(summary, "introduced"),
    O.getOrElse(() => -1)
  );
  const inheritedAdjacent = pipe(
    unknownNumberProperty(summary, "inheritedAdjacent"),
    O.getOrElse(() => -1)
  );
  const notApplicable = pipe(
    unknownNumberProperty(summary, "notApplicable"),
    O.getOrElse(() => -1)
  );
  const attributionKindsOption = pipe(
    unknownRecordProperty(document, "attributionKinds"),
    O.flatMap(decodeFallowAttributionKindsOption)
  );
  const decodedOk = decodeFallowReportOkOption(document);

  if (O.isSome(decodedOk)) {
    const envelope = decodedOk.value;
    const actualCount = A.length(envelope.report.findings);
    const expectedSummary = attributionSummary(envelope.report.findings);
    const expectedKinds = attributionKinds(envelope.report.findings);
    const diagnostics = [
      ...(envelope.report.findingCount === actualCount
        ? []
        : [
            `Fallow envelope report findingCount ${envelope.report.findingCount} does not match findings length ${actualCount}.`,
          ]),
      ...(envelope.findingAttributionSummary.introduced === expectedSummary.introduced
        ? []
        : [
            `Fallow envelope introduced attribution count ${envelope.findingAttributionSummary.introduced} does not match findings count ${expectedSummary.introduced}.`,
          ]),
      ...(envelope.findingAttributionSummary.inheritedAdjacent === expectedSummary.inheritedAdjacent
        ? []
        : [
            `Fallow envelope inheritedAdjacent attribution count ${envelope.findingAttributionSummary.inheritedAdjacent} does not match findings count ${expectedSummary.inheritedAdjacent}.`,
          ]),
      ...(envelope.findingAttributionSummary.notApplicable === expectedSummary.notApplicable
        ? []
        : [
            `Fallow envelope notApplicable attribution count ${envelope.findingAttributionSummary.notApplicable} does not match findings count ${expectedSummary.notApplicable}.`,
          ]),
      ...attributionKindSetDiagnostics("Fallow envelope attributionKinds", expectedKinds, envelope.attributionKinds),
    ];

    if (A.isReadonlyArrayNonEmpty(diagnostics)) {
      return diagnostics;
    }
  }

  if (O.isSome(status) && !sameEnvelopeStatus(status.value, "ok")) {
    const diagnostics = [
      ...(introduced === 0 ? [] : [`Fallow ${status.value} envelope introduced attribution count must be 0.`]),
      ...(inheritedAdjacent === 0
        ? []
        : [`Fallow ${status.value} envelope inheritedAdjacent attribution count must be 0.`]),
      ...(notApplicable === 0 ? [] : [`Fallow ${status.value} envelope notApplicable attribution count must be 0.`]),
      ...pipe(
        attributionKindsOption,
        O.match({
          onNone: () => ["Fallow failure envelope attributionKinds must decode."],
          onSome: (kinds) =>
            attributionKindSetDiagnostics(
              `Fallow ${status.value} envelope attributionKinds`,
              ["not-applicable"],
              kinds
            ),
        })
      ),
    ];

    if (A.isReadonlyArrayNonEmpty(diagnostics)) {
      return diagnostics;
    }
  }

  if (
    O.isSome(status) &&
    (sameEnvelopeStatus(status.value, "tool-failed") || sameEnvelopeStatus(status.value, "base-resolution-failed")) &&
    exitStatus <= 0
  ) {
    return [`Fallow ${status.value} envelope exitStatus must be positive.`];
  }

  return A.empty();
};

const exactEnvelopeDiagnostics = (document: unknown): ReadonlyArray<string> => [
  ...exactEnvelopeKeyDiagnostics(document),
  ...reportInvariantDiagnostics(document),
];

const FallowReportWireEnvelope = S.Unknown.pipe(
  S.check(
    S.makeFilter((document) => {
      const diagnostics = exactEnvelopeDiagnostics(document);
      return A.isReadonlyArrayEmpty(diagnostics) ? undefined : { path: [], issue: A.join(diagnostics, "\n") };
    })
  ),
  $I.annoteSchema("FallowReportWireEnvelope", {
    description: "Exact wire guard for Fallow report envelopes before downstream quality parsing.",
  })
);
const decodeFallowReportWireEnvelope = S.decodeUnknownEffect(FallowReportWireEnvelope);

const checkExactEnvelopeKeys = (document: unknown): Effect.Effect<void, QualityScriptCommandError> => {
  const diagnostics = exactEnvelopeKeyDiagnostics(document);
  return A.isReadonlyArrayEmpty(diagnostics)
    ? Effect.void
    : QualityScriptCommandError.make({
        message: A.join(diagnostics, "\n"),
        exitCode: 1,
      });
};

const checkReportInvariants = (document: unknown): Effect.Effect<void, QualityScriptCommandError> => {
  const diagnostics = reportInvariantDiagnostics(document);
  return A.isReadonlyArrayEmpty(diagnostics)
    ? Effect.void
    : QualityScriptCommandError.make({
        message: A.join(diagnostics, "\n"),
        exitCode: 1,
      });
};

const checkEnvelopePath = Effect.fn("FallowQuality.checkEnvelopePath")(function* (
  filePath: string,
  requiredKeys: ReadonlyArray<string>,
  expectedSubcommand: string,
  expectedReportPath: string,
  requireRawOutput: boolean
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const document = yield* readJsonDocument(filePath);
  yield* checkExactEnvelopeKeys(document);
  yield* requireEnvelopeKeys(document, requiredKeys);
  yield* decodeFallowReportWireEnvelope(document).pipe(
    QualityScriptCommandError.mapError(`Fallow envelope ${filePath} does not match the report schema.`)
  );
  const envelope = yield* decodeFallowReportEnvelope(document).pipe(
    QualityScriptCommandError.mapError(`Fallow envelope ${filePath} does not match the decoded report schema.`)
  );
  yield* checkReportInvariants(document);
  const normalizedExpectedReportPath = normalizePath(expectedReportPath);
  yield* failWithDiagnostics("fallow envelope-check", [
    ...(Str.isNonEmpty(expectedSubcommand) && envelope.subcommand !== expectedSubcommand
      ? [`${filePath}: expected subcommand ${expectedSubcommand}, got ${envelope.subcommand}`]
      : []),
    ...(Str.isNonEmpty(normalizedExpectedReportPath) && envelope.reportPath !== normalizedExpectedReportPath
      ? [`${filePath}: expected reportPath ${normalizedExpectedReportPath}, got ${envelope.reportPath}`]
      : []),
  ]);
  if (requireRawOutput) {
    const repoRoot = yield* findRepoRoot().pipe(
      QualityScriptCommandError.mapError("Failed to locate repository root.")
    );
    const rawOutputPath = path.isAbsolute(envelope.rawOutputRef)
      ? envelope.rawOutputRef
      : path.join(repoRoot, envelope.rawOutputRef);
    yield* fs
      .stat(rawOutputPath)
      .pipe(QualityScriptCommandError.mapError(`Failed to stat Fallow raw output ${rawOutputPath}.`));
  }
  yield* Console.log(`[fallow] envelope ok: ${filePath}`);
});

const checkPublicDispatchEnvelope = Effect.fn("FallowQuality.checkPublicDispatchEnvelope")(function* (
  feature: FallowFeature,
  options: FallowCommandOptions,
  out: string,
  expectedStatus: typeof FallowEnvelopeStatus.Type,
  probeStartedAtMillis: number
): Effect.fn.Return<void, QualityScriptCommandError, FallowQualityEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const paths = yield* resolveReportPath(repoRoot, out, feature);
  yield* checkEnvelopePath(
    out,
    ["schemaVersion", "status", "command", "exitStatus", "baseRef", "rawOutputRef"],
    feature,
    out,
    true
  );
  const document = yield* readJsonDocument(out);
  const envelope = yield* decodeFallowReportEnvelope(document).pipe(
    QualityScriptCommandError.mapError(`Fallow envelope ${out} does not match the decoded report schema.`)
  );
  const rawOutputPath = path.join(repoRoot, envelope.rawOutputRef);
  const rawStat = yield* fs
    .stat(rawOutputPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to stat Fallow raw output ${rawOutputPath}.`));
  const rawModifiedAtMillis = pipe(
    rawStat.mtime,
    O.map((mtime) => mtime.getTime()),
    O.getOrElse(() => -1)
  );
  const envelopeGeneratedAtMillis = Date.parse(envelope.generatedAt);
  const expectedCommand = renderWrapperCommand(feature, options, paths.relative);
  const rawOutputText = yield* fs.readFileString(rawOutputPath).pipe(Effect.option);
  const rawJsonText = pipe(rawOutputText, O.flatMap(extractJsonDocumentText), O.getOrUndefined);
  const rawDocument = P.isUndefined(rawJsonText) ? O.none() : yield* decodeJsonText(rawJsonText).pipe(Effect.option);
  const decodedOk = decodeFallowReportOkOption(envelope);
  const expectedFindingCount = pipe(
    rawDocument,
    O.map((document) => rawFindingCount(feature, document)),
    O.getOrElse(() => -1)
  );

  yield* failWithDiagnostics("fallow public dispatch envelope", [
    ...(sameFeatureFamily(envelope.subcommand, feature)
      ? []
      : [`${out}: expected subcommand ${feature}, got ${envelope.subcommand}`]),
    ...(envelope.command === expectedCommand
      ? []
      : [`${out}: expected command ${expectedCommand}, got ${envelope.command}`]),
    ...(envelope.advisory === options.advisory
      ? []
      : [`${out}: expected advisory ${String(options.advisory)}, got ${String(envelope.advisory)}`]),
    ...(envelope.baseRef === options.base ? [] : [`${out}: expected baseRef ${options.base}, got ${envelope.baseRef}`]),
    ...(sameEnvelopeStatus(envelope.status, expectedStatus)
      ? []
      : [`${out}: expected status ${expectedStatus}, got ${envelope.status}`]),
    ...(envelope.reportPath === paths.relative
      ? []
      : [`${out}: expected reportPath ${paths.relative}, got ${envelope.reportPath}`]),
    ...(envelope.rawOutputRef === paths.rawRelative
      ? []
      : [`${out}: expected rawOutputRef ${paths.rawRelative}, got ${envelope.rawOutputRef}`]),
    ...(Number.isFinite(envelopeGeneratedAtMillis) && envelopeGeneratedAtMillis >= probeStartedAtMillis
      ? []
      : [
          `${out}: generatedAt ${envelope.generatedAt} is older than public dispatch probe start ${formatEpochMillis(
            probeStartedAtMillis
          )}`,
        ]),
    ...(rawModifiedAtMillis >= probeStartedAtMillis
      ? []
      : [
          `${out}: rawOutputRef mtime ${formatEpochMillis(
            rawModifiedAtMillis
          )} is older than public dispatch probe start ${formatEpochMillis(probeStartedAtMillis)}`,
        ]),
    ...(sameEnvelopeStatus(expectedStatus, "ok") && O.isNone(rawDocument)
      ? [`${out}: expected parseable raw stdout JSON for ok public dispatch probe`]
      : []),
    ...(sameEnvelopeStatus(expectedStatus, "ok") &&
    O.isSome(decodedOk) &&
    decodedOk.value.report.findingCount !== expectedFindingCount
      ? [
          `${out}: expected normalized findingCount ${expectedFindingCount} from raw ${feature} report, got ${decodedOk.value.report.findingCount}`,
        ]
      : []),
  ]);
});

const runPublicDispatchProbe = Effect.fn("FallowQuality.runPublicDispatchProbe")(function* (
  feature: FallowFeature,
  options: FallowCommandOptions,
  expectedExit: number,
  expectedStatus: typeof FallowEnvelopeStatus.Type
): Effect.fn.Return<void, QualityScriptCommandError, FallowQualityEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const paths = yield* resolveReportPath(repoRoot, options.out, feature);
  const args = ["run", "beep", ...wrapperArgs(feature, options, options.out)];
  const probeStartedAtMillis = yield* DateTime.now.pipe(
    Effect.map((dateTime) => DateTime.toDateUtc(dateTime).getTime())
  );

  yield* fs
    .remove(paths.absolute, { force: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to remove stale Fallow envelope ${paths.absolute}.`));
  yield* fs
    .remove(paths.rawAbsolute, { force: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to remove stale Fallow raw output ${paths.rawAbsolute}.`));

  const result = yield* collectProcessOutput(repoRoot, "bun", args);
  if (result.exitCode !== expectedExit) {
    return yield* QualityScriptCommandError.make({
      message: `Public Fallow CLI dispatch exited ${result.exitCode}, expected ${expectedExit}: ${stderrExcerpt(
        result.stderr
      )}`,
      command: commandText("bun", args),
      exitCode: positiveExitStatus(result.exitCode),
    });
  }

  yield* checkPublicDispatchEnvelope(feature, options, options.out, expectedStatus, probeStartedAtMillis);
});

const failWithDiagnostics = (
  label: string,
  diagnostics: ReadonlyArray<string>
): Effect.Effect<void, QualityScriptCommandError> =>
  A.isReadonlyArrayEmpty(diagnostics)
    ? Effect.void
    : QualityScriptCommandError.make({
        message: `${label} failed:\n${A.join(diagnostics, "\n")}`,
        exitCode: 1,
      });

const runSyntheticProcessProbe = Effect.fn("FallowQuality.runSyntheticProcessProbe")(function* (
  feature: FallowFeature,
  options: FallowCommandOptions,
  result: ProcessResult,
  expectedStatus: typeof FallowEnvelopeStatus.Type
): Effect.fn.Return<void, QualityScriptCommandError, FallowQualityEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const paths = yield* resolveReportPath(repoRoot, options.out, feature);
  const probeStartedAtMillis = yield* DateTime.now.pipe(
    Effect.map((dateTime) => DateTime.toDateUtc(dateTime).getTime())
  );
  const generatedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const isDirty = yield* dirtyWorktree(repoRoot);
  const envelope = yield* envelopeFromProcessResult(
    feature,
    options,
    paths,
    generatedAt,
    "fallow contract-probe",
    isDirty,
    result
  );

  yield* fs
    .remove(paths.absolute, { force: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to remove stale Fallow envelope ${paths.absolute}.`));
  yield* fs
    .remove(paths.rawAbsolute, { force: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to remove stale Fallow raw output ${paths.rawAbsolute}.`));
  yield* writeEnvelope(paths, result.output, envelope);
  yield* checkPublicDispatchEnvelope(feature, options, options.out, expectedStatus, probeStartedAtMillis);
});

const emptyDeadCodeIssueArrays = {
  unused_files: [],
  unused_exports: [],
  unused_types: [],
  private_type_leaks: [],
  unused_dependencies: [],
  unused_dev_dependencies: [],
  unused_optional_dependencies: [],
  unused_enum_members: [],
  unused_class_members: [],
  unresolved_imports: [],
  unlisted_dependencies: [],
  duplicate_exports: [],
  type_only_dependencies: [],
  test_only_dependencies: [],
  circular_dependencies: [],
  re_export_cycles: [],
  boundary_violations: [],
  stale_suppressions: [],
  unused_catalog_entries: [],
  empty_catalog_groups: [],
  unresolved_catalog_references: [],
  unused_dependency_overrides: [],
  misconfigured_dependency_overrides: [],
} as const;

const invalidRawReportFixtures: ReadonlyArray<{
  readonly feature: FallowFeature;
  readonly label: string;
  readonly document: unknown;
}> = [
  ...pipe(
    fallowFeatureValues,
    A.map((feature) => ({
      feature,
      label: `${feature} error object`,
      document: {
        error: "simulated fallow failure",
        message: "this shape must not be accepted as a successful report",
      },
    }))
  ),
  {
    feature: "dead-code",
    label: "dead-code loose summary object",
    document: {
      summary: {
        total_issues: 1,
      },
    },
  },
  {
    feature: "dead-code",
    label: "dead-code versioned summary without issue arrays",
    document: {
      kind: "dead-code",
      schema_version: 7,
      version: "2.89.0",
      elapsed_ms: 1,
      total_issues: 1,
      summary: {
        total_issues: 1,
        unused_files: 0,
        unused_exports: 1,
        unused_types: 0,
        unused_dependencies: 0,
        unresolved_imports: 0,
        unlisted_dependencies: 0,
        boundary_violations: 0,
      },
    },
  },
  {
    feature: "dead-code",
    label: "dead-code malformed issue array item",
    document: {
      kind: "dead-code",
      schema_version: 7,
      version: "2.89.0",
      elapsed_ms: 1,
      total_issues: 1,
      entry_points: {
        total: 1,
        sources: {
          manual_entry: 1,
        },
      },
      summary: {
        total_issues: 1,
        unused_files: 0,
        unused_exports: 1,
        unused_types: 0,
        unused_dependencies: 0,
        unresolved_imports: 0,
        unlisted_dependencies: 0,
        boundary_violations: 0,
      },
      ...emptyDeadCodeIssueArrays,
      unused_exports: [{}],
    },
  },
  {
    feature: "boundaries",
    label: "boundaries loose summary object",
    document: {
      summary: {
        boundary_violations: 1,
      },
    },
  },
  {
    feature: "health",
    label: "health malformed finding item",
    document: {
      kind: "health",
      schema_version: 7,
      version: "2.89.0",
      elapsed_ms: 1,
      findings: [{}],
      summary: {
        files_analyzed: 1,
        functions_analyzed: 1,
        functions_above_threshold: 1,
        average_maintainability: 1,
        severity_critical_count: 1,
        severity_high_count: 0,
        severity_moderate_count: 0,
      },
    },
  },
  {
    feature: "flags",
    label: "flags versioned count without feature array",
    document: {
      schema_version: 7,
      version: "2.89.0",
      elapsed_ms: 1,
      total_flags: 1,
    },
  },
  {
    feature: "flags",
    label: "flags malformed feature flag item",
    document: {
      schema_version: 7,
      version: "2.89.0",
      elapsed_ms: 1,
      feature_flags: [{}],
      total_flags: 1,
    },
  },
  {
    feature: "security",
    label: "security malformed finding item",
    document: {
      kind: "security",
      schema_version: "1",
      security_findings: [{}],
      unresolved_edge_files: 0,
      unresolved_callee_sites: 1,
    },
  },
  {
    feature: "fix-preview",
    label: "fix-preview apply-mode report",
    document: {
      dry_run: false,
      fixes: [],
      total_fixed: 0,
      skipped: 0,
      skipped_content_changed: 0,
      skipped_low_confidence_exports: 0,
      skipped_mixed_line_endings: 0,
    },
  },
  {
    feature: "fix-preview",
    label: "fix-preview malformed fix item",
    document: {
      dry_run: true,
      fixes: [{}],
      total_fixed: 0,
      skipped: 0,
      skipped_content_changed: 0,
      skipped_low_confidence_exports: 0,
      skipped_mixed_line_endings: 0,
    },
  },
];

const invalidRawReportShapeDiagnostics = (): ReadonlyArray<string> =>
  pipe(
    invalidRawReportFixtures,
    A.filter((fixture) => hasFallowReportShape(fixture.feature, fixture.document)),
    A.map((fixture) => `${fixture.feature}: invalid raw fixture was accepted as ok report shape: ${fixture.label}`)
  );

const runBoundariesConfigCheck = Effect.fn("FallowQuality.runBoundariesConfigCheck")(function* (
  check: boolean
): Effect.fn.Return<void, QualityScriptCommandError, FallowQualityEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const args = check ? ["run", "fallow:boundaries:check"] : ["run", "fallow:boundaries"];
  const result = yield* collectProcessOutput(repoRoot, "bun", args);
  yield* Console.log(result.output);

  if (result.exitCode !== 0) {
    return yield* QualityScriptCommandError.make({
      message: "Fallow generated boundary config check failed.",
      command: commandText("bun", args),
      exitCode: result.exitCode,
    });
  }
});

const runCommandContractCheck = Effect.fn("FallowQuality.runCommandContractCheck")(function* (
  asserted: string,
  requireEnvelope: boolean,
  outDir: string
): Effect.fn.Return<void, QualityScriptCommandError, FallowQualityEnvironment> {
  const path = yield* Path.Path;
  const assertedValues = csvValues(asserted);
  const missing = pipe(
    fallowFeatureValues,
    A.filter((feature) => !A.contains(assertedValues, feature))
  );
  const unexpected = pipe(
    assertedValues,
    A.filter((feature) => !isFallowFeature(feature))
  );
  yield* failWithDiagnostics("fallow command-contract-check", [
    ...A.map(missing, (feature) => `missing asserted feature: ${feature}`),
    ...A.map(unexpected, (feature) => `unexpected asserted feature: ${feature}`),
  ]);
  yield* failWithDiagnostics("fallow raw report failure-shape fixtures", invalidRawReportShapeDiagnostics());

  if (!requireEnvelope) {
    yield* Console.log("[fallow] command contract ok");
    return;
  }

  yield* Effect.forEach(
    fallowFeatureValues,
    (feature) => {
      const out = path.join(outDir, `${feature}.json`);
      return runPublicDispatchProbe(
        feature,
        {
          advisory: true,
          base: defaultBaseRef,
          check: false,
          out,
          quiet: true,
        },
        0,
        "ok"
      );
    },
    { concurrency: 1 }
  );

  yield* runPublicDispatchProbe(
    "audit",
    {
      advisory: false,
      base: defaultBaseRef,
      check: true,
      out: path.join(outDir, "audit-check.json"),
      quiet: true,
    },
    0,
    "ok"
  );

  yield* runPublicDispatchProbe(
    "boundaries",
    {
      advisory: true,
      base: "refs/heads/definitely-not-real-fallow-base",
      check: true,
      out: path.join(outDir, "boundaries-bad-base-check.json"),
      quiet: true,
    },
    128,
    "base-resolution-failed"
  );
  yield* runSyntheticProcessProbe(
    "health",
    {
      advisory: true,
      base: defaultBaseRef,
      check: false,
      out: path.join(outDir, "health-tool-failed.json"),
      quiet: true,
    },
    {
      stdout: "",
      stderr: "simulated fallow process failure",
      output: "simulated fallow process failure",
      exitCode: 2,
    },
    "tool-failed"
  );
  yield* runSyntheticProcessProbe(
    "dead-code",
    {
      advisory: true,
      base: defaultBaseRef,
      check: false,
      out: path.join(outDir, "dead-code-invalid-json.json"),
      quiet: true,
    },
    {
      stdout: "not-json",
      stderr: "",
      output: "not-json",
      exitCode: 0,
    },
    "invalid-json"
  );
  yield* runSyntheticProcessProbe(
    "flags",
    {
      advisory: true,
      base: defaultBaseRef,
      check: false,
      out: path.join(outDir, "flags-invalid-report.json"),
      quiet: true,
    },
    {
      stdout: '{"error":"simulated malformed Fallow report"}',
      stderr: "",
      output: '{"error":"simulated malformed Fallow report"}',
      exitCode: 0,
    },
    "invalid-report"
  );
  yield* Console.log("[fallow] command contract ok");
});

const runCiContractCheck = Effect.fn("FallowQuality.runCiContractCheck")(function* (
  workflowPath: string,
  expectLanes: string,
  expectBlockingLanes: string,
  expectOutDir: string,
  requireUpload: boolean,
  ifNoFilesFound: string,
  advisory: boolean
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const path = yield* Path.Path;
  const absolutePath = path.isAbsolute(workflowPath) ? workflowPath : path.join(repoRoot, workflowPath);
  const text = yield* fs
    .readFileString(absolutePath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${absolutePath}.`));
  const workflow = yield* yamlDocumentValue(workflowPath, text);
  const diagnostics = fallowCiContractDiagnostics(workflow, {
    expectLanes,
    expectBlockingLanes,
    expectOutDir,
    requireUpload,
    ifNoFilesFound,
    advisory,
  });

  yield* failWithDiagnostics("fallow ci-contract-check", diagnostics);
  yield* Console.log(`[fallow] CI contract ok: ${workflowPath}`);
});

const makeFallowFeatureCommand = (feature: FallowFeature) =>
  Command.make(
    feature,
    {
      advisory: Flag.boolean("advisory").pipe(Flag.withDescription("Exit zero while preserving Fallow exit status")),
      base: Flag.string("base").pipe(
        Flag.withDefault(defaultBaseRef),
        Flag.withDescription("Git base ref used by diff-aware Fallow commands")
      ),
      check: Flag.boolean("check").pipe(
        Flag.withDescription("Fail only for promoted blocking lanes; advisory P1 lanes do not promote findings")
      ),
      out: Flag.string("out").pipe(
        Flag.withDefault(`${defaultOutDir}/${feature}.json`),
        Flag.withDescription("Envelope output path")
      ),
      quiet: Flag.boolean("quiet").pipe(
        Flag.withDescription("Suppress Fallow tool chatter in raw output where supported")
      ),
    },
    ({ advisory, base, check, out, quiet }) => runFallowFeature(feature, { advisory, base, check, out, quiet })
  ).pipe(Command.withDescription(`Run Fallow ${feature} and write a repo-cli report envelope`));

const envelopeCheckCommand = Command.make(
  "envelope-check",
  {
    path: Argument.string("path").pipe(Argument.withDescription("Envelope JSON path to validate")),
    require: Flag.string("require").pipe(
      Flag.withDefault(""),
      Flag.withDescription("Comma-separated top-level metadata keys that must be present")
    ),
    expectSubcommand: Flag.string("expect-subcommand").pipe(
      Flag.withDefault(""),
      Flag.withDescription("Expected Fallow subcommand recorded in the envelope")
    ),
    expectReportPath: Flag.string("expect-report-path").pipe(
      Flag.withDefault(""),
      Flag.withDescription("Expected reportPath recorded in the envelope")
    ),
    requireRawOutput: Flag.boolean("require-raw-output").pipe(
      Flag.withDescription("Require the envelope rawOutputRef artifact to exist")
    ),
  },
  ({ expectReportPath, expectSubcommand, path, require, requireRawOutput }) =>
    checkEnvelopePath(path, csvValues(require), expectSubcommand, expectReportPath, requireRawOutput)
).pipe(Command.withDescription("Decode and validate one Fallow report envelope"));

const commandContractCheckCommand = Command.make(
  "command-contract-check",
  {
    assert: Flag.string("assert").pipe(
      Flag.withDefault(A.join(fallowFeatureValues, ",")),
      Flag.withDescription("Comma-separated Fallow feature commands expected in the quality surface")
    ),
    requireEnvelope: Flag.boolean("require-envelope").pipe(
      Flag.withDescription("Run each advisory command and validate the emitted envelope")
    ),
    outDir: Flag.string("out-dir").pipe(
      Flag.withDefault(defaultOutDir),
      Flag.withDescription("Directory used for command-contract envelope probes")
    ),
  },
  ({ assert: asserted, outDir, requireEnvelope }) => runCommandContractCheck(asserted, requireEnvelope, outDir)
).pipe(Command.withDescription("Verify the implemented Fallow quality command contract"));

const boundariesConfigCheckCommand = Command.make(
  "config-check",
  {
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when generated Fallow boundary config is stale")),
  },
  ({ check }) => runBoundariesConfigCheck(check)
).pipe(Command.withDescription("Verify generated Fallow boundary config freshness"));

const ciContractCheckCommand = Command.make(
  "ci-contract-check",
  {
    workflow: Argument.string("workflow").pipe(Argument.withDescription("Workflow file to inspect")),
    expectLanes: Flag.string("expect-lanes").pipe(
      Flag.withDefault(A.join(fallowFeatureValues, ",")),
      Flag.withDescription("Comma-separated Fallow lanes expected in CI")
    ),
    expectBlockingLanes: Flag.string("expect-blocking-lanes").pipe(
      Flag.withDefault(""),
      Flag.withDescription("Comma-separated promoted Fallow lanes expected to run with --check in CI")
    ),
    expectOutDir: Flag.string("expect-out-dir").pipe(
      Flag.withDefault(defaultOutDir),
      Flag.withDescription("Expected envelope artifact output directory")
    ),
    requireUpload: Flag.boolean("require-upload").pipe(Flag.withDescription("Require artifact upload wiring")),
    ifNoFilesFound: Flag.string("if-no-files-found").pipe(
      Flag.withDefault("error"),
      Flag.withDescription("Expected upload-artifact missing-file behavior")
    ),
    advisory: Flag.boolean("advisory").pipe(Flag.withDescription("Require advisory Fallow invocations")),
  },
  ({ advisory, expectBlockingLanes, expectLanes, expectOutDir, ifNoFilesFound, requireUpload, workflow }) =>
    runCiContractCheck(
      workflow,
      expectLanes,
      expectBlockingLanes,
      expectOutDir,
      requireUpload,
      ifNoFilesFound,
      advisory
    )
).pipe(Command.withDescription("Verify hosted CI uses the repo-cli Fallow envelope wrapper"));

const fallowAuditCommand = makeFallowFeatureCommand("audit");
const fallowDeadCodeCommand = makeFallowFeatureCommand("dead-code");
const fallowHealthCommand = makeFallowFeatureCommand("health");
const fallowBoundariesCommand = makeFallowFeatureCommand("boundaries").pipe(
  Command.withSubcommands([boundariesConfigCheckCommand])
);
const fallowFlagsCommand = makeFallowFeatureCommand("flags");
const fallowSecurityCommand = makeFallowFeatureCommand("security");
const fallowFixPreviewCommand = makeFallowFeatureCommand("fix-preview");

/**
 * Fallow command group under the canonical repo quality surface.
 *
 * @example
 * ```ts
 * import { qualityFallowCommand } from "@beep/repo-cli/commands/Quality"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(qualityFallowCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const qualityFallowCommand = Command.make("fallow", {}, () =>
  jsonStringifyPretty({
    commands: fallowFeatureValues,
    helpers: ["command-contract-check", "envelope-check", "boundaries config-check", "ci-contract-check"],
    defaultOutDir,
  }).pipe(Effect.flatMap(Console.log), QualityScriptCommandError.mapError("Failed to render Fallow quality help."))
).pipe(
  Command.withDescription("Advisory Fallow quality wrappers and report-envelope checks"),
  Command.withSubcommands([
    fallowAuditCommand,
    fallowDeadCodeCommand,
    fallowHealthCommand,
    fallowBoundariesCommand,
    fallowFlagsCommand,
    fallowSecurityCommand,
    fallowFixPreviewCommand,
    commandContractCheckCommand,
    envelopeCheckCommand,
    ciContractCheckCommand,
  ])
);
