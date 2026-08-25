/**
 * Deterministic MCP tool-name normalization and collision reporting.
 *
 * Candidate names are normalized without consulting registration order, capped
 * at 64 ASCII characters with a SHA-256 prefix digest, grouped by both the
 * normalized and final wire names, and rendered as canonical checked-in JSON.
 * Any duplicate is a typed hard failure before tool registration or report
 * writing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $GovLegalMcpId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { flow, HashMap, HashSet, Match, Number as N, Order, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GovLegalMcpId.create("ToolNames");
const MAX_WIRE_NAME_LENGTH = 64;
const TRUNCATED_PREFIX_LENGTH = 55;
const DIGEST_PREFIX_LENGTH = 8;
const combiningMarksPattern = /\p{M}+/gu;
const acronymBoundaryPattern = /([A-Z]+)([A-Z][a-z])/g;
const lowerToUpperBoundaryPattern = /([a-z0-9])([A-Z])/g;
const unsafeCharactersPattern = /[^a-z0-9_-]+/g;
const underscoreRunsPattern = /_+/g;
const hyphenRunsPattern = /-+/g;
const edgeSeparatorsPattern = /^[_-]+|[_-]+$/g;
const wireNamePattern = /^[a-zA-Z0-9_-]+$/u;

const NormalizationFailureReason = LiteralKit(["empty_normalized", "invalid_normalized"]).annotate(
  $I.annote("NormalizationFailureReason", {
    description: "Reasons deterministic MCP tool-name normalization can reject a candidate.",
  })
);

const RowDuplicateVerdict = LiteralKit(["unique", "duplicate_normalized", "duplicate_final"]).annotate(
  $I.annote("RowDuplicateVerdict", {
    description: "Per-candidate collision verdict in a tool-name collision report.",
  })
);

const CollisionFailureReason = LiteralKit(["duplicate_normalized", "duplicate_final"]).annotate(
  $I.annote("CollisionFailureReason", {
    description: "Duplicate grouping stage that caused deterministic MCP tool-name generation to fail.",
  })
);

const ReportDuplicateVerdict = LiteralKit(["clean", "duplicate"]).annotate(
  $I.annote("ReportDuplicateVerdict", {
    description: "Aggregate collision verdict for a complete tool-name report.",
  })
);

const RegistrationFailureReason = LiteralKit(["missing_candidate", "wire_name_drift"]).annotate(
  $I.annote("RegistrationFailureReason", {
    description: "Reasons a registered MCP tool declaration can disagree with the validated production report.",
  })
);

const NormalizedWireName = S.NonEmptyString.check(
  S.isPattern(wireNamePattern, {
    identifier: $I`NormalizedWireNameCheck`,
    title: "Normalized MCP wire name",
    description: "A non-empty MCP wire name containing only ASCII letters, digits, underscores, and hyphens.",
    message: "Expected a non-empty MCP wire name matching ^[a-zA-Z0-9_-]+$",
  })
).pipe(
  $I.annoteSchema("NormalizedWireName", {
    description: "A normalized MCP wire name containing only the frozen safe ASCII character set.",
  })
);

const isNormalizedWireName = S.is(NormalizedWireName);
const encodeCompactJson = Unknown.encodeResultFromJsonString;
const encodeJsonLeaf: (value: unknown) => string = flow(encodeCompactJson, Result.getOrThrow);
const jsonEntryOrder = Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key);

/**
 * One source and upstream operation identifier submitted to name generation.
 *
 * **Example** (Construct candidate from source)
 *
 * ```ts
 * import { ToolNameCandidate } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const candidate = ToolNameCandidate.make({ source: "ecfr", operationId: "listTitles" })
 * console.log(candidate.operationId)
 * // "listTitles"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolNameCandidate extends S.Class<ToolNameCandidate>($I`ToolNameCandidate`)(
  {
    operationId: S.NonEmptyString.annotateKey({
      description: "Public upstream operation identifier preserved in report metadata.",
    }),
    source: S.NonEmptyString.annotateKey({
      description: "Driver prefix prepended to the upstream operation identifier.",
    }),
  },
  $I.annote("ToolNameCandidate", {
    description: "One source and upstream operation identifier submitted to deterministic MCP name generation.",
  })
) {}

/**
 * One deterministic candidate row in the checked-in collision report.
 *
 * **Example** (Construct collision report row)
 *
 * ```ts
 * import { ToolNameCollisionRow } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const row = ToolNameCollisionRow.make({
 *   candidate: "ecfr_listTitles",
 *   digest: null,
 *   duplicateVerdict: "unique",
 *   finalWireName: "ecfr_list_titles",
 *   normalized: "ecfr_list_titles",
 *   originalOperationId: "listTitles",
 *   source: "ecfr",
 *   truncated: false
 * })
 * console.log(row.finalWireName)
 * // "ecfr_list_titles"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolNameCollisionRow extends S.Class<ToolNameCollisionRow>($I`ToolNameCollisionRow`)(
  {
    candidate: S.NonEmptyString,
    digest: S.NullOr(S.String),
    duplicateVerdict: RowDuplicateVerdict,
    finalWireName: NormalizedWireName,
    normalized: NormalizedWireName,
    originalOperationId: S.NonEmptyString,
    source: S.NonEmptyString,
    truncated: S.Boolean,
  },
  $I.annote("ToolNameCollisionRow", {
    description: "One deterministic candidate row in the gov-legal MCP tool-name collision report.",
  })
) {}

/**
 * Versioned deterministic report for every candidate MCP tool name.
 *
 * **Example** (Read production report verdict)
 *
 * ```ts
 * import { ProductionToolNameCollisionReport } from "@beep/gov-legal-mcp/ToolNames"
 *
 * console.log(ProductionToolNameCollisionReport.duplicateVerdict)
 * // "clean"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolNameCollisionReport extends S.Class<ToolNameCollisionReport>($I`ToolNameCollisionReport`)(
  {
    candidates: S.Array(ToolNameCollisionRow),
    duplicateVerdict: ReportDuplicateVerdict,
    schemaVersion: S.tag("gov-legal-mcp/tool-name-collision-report/v1"),
  },
  $I.annote("ToolNameCollisionReport", {
    description: "Versioned deterministic collision report for all gov-legal MCP candidate tool names.",
  })
) {}

/**
 * Typed rejection of an empty or unsafe normalized candidate.
 *
 * **Example** (Reject empty normalized name)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { normalizeToolName, ToolNameNormalizationError } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const result = normalizeToolName("---")
 * console.log(Result.isFailure(result) && S.is(ToolNameNormalizationError)(result.failure))
 * // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ToolNameNormalizationError extends S.TaggedError<ToolNameNormalizationError>(
  $I`ToolNameNormalizationError`
)(
  "ToolNameNormalizationError",
  {
    candidate: S.String,
    message: S.NonEmptyString,
    normalized: S.String,
    reason: NormalizationFailureReason,
  },
  $I.annoteError<ToolNameNormalizationError>("ToolNameNormalizationError", {
    description: "Typed rejection of a candidate whose deterministic normalization is empty or unsafe.",
  })
) {}

/**
 * Typed hard failure carrying the complete in-memory duplicate report.
 *
 * **Example** (Fail closed on duplicates)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import {
 *   buildToolNameCollisionReport,
 *   ToolNameCandidate,
 *   ToolNameCollisionError
 * } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const result = buildToolNameCollisionReport([
 *   ToolNameCandidate.make({ source: "ecfr", operationId: "search.results" }),
 *   ToolNameCandidate.make({ source: "ecfr", operationId: "search/results" })
 * ])
 * console.log(Result.isFailure(result) && S.is(ToolNameCollisionError)(result.failure))
 * // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ToolNameCollisionError extends S.TaggedError<ToolNameCollisionError>($I`ToolNameCollisionError`)(
  "ToolNameCollisionError",
  {
    collisionKeys: S.Array(S.String),
    message: S.NonEmptyString,
    reason: CollisionFailureReason,
    report: ToolNameCollisionReport,
  },
  $I.annoteError<ToolNameCollisionError>("ToolNameCollisionError", {
    description: "Typed hard failure carrying the complete duplicate tool-name report and colliding keys.",
  })
) {}

/**
 * Typed rejection of a tool declaration absent from or drifted against the
 * validated production collision report.
 *
 * **Example** (Reject missing tool registration)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import {
 *   resolveProductionToolName,
 *   ToolNameCandidate,
 *   ToolNameRegistrationError
 * } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const result = resolveProductionToolName(
 *   ToolNameCandidate.make({ source: "ecfr", operationId: "missing" }),
 *   "ecfr_missing"
 * )
 * console.log(Result.isFailure(result) && result.failure instanceof ToolNameRegistrationError)
 * // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ToolNameRegistrationError extends S.TaggedError<ToolNameRegistrationError>($I`ToolNameRegistrationError`)(
  "ToolNameRegistrationError",
  {
    candidate: ToolNameCandidate,
    expectedWireName: NormalizedWireName,
    message: S.NonEmptyString,
    reason: RegistrationFailureReason,
  },
  $I.annoteError<ToolNameRegistrationError>("ToolNameRegistrationError", {
    description: "Typed fail-closed rejection of a tool declaration that disagrees with the production report.",
  })
) {}

type GroupedRows = HashMap.HashMap<string, ReadonlyArray<ToolNameCollisionRow>>;

const rowOrder = Order.combine(
  Order.mapInput(Order.String, (row: ToolNameCollisionRow) => row.finalWireName),
  Order.combine(
    Order.mapInput(Order.String, (row: ToolNameCollisionRow) => row.source),
    Order.mapInput(Order.String, (row: ToolNameCollisionRow) => row.originalOperationId)
  )
);
const candidateEquivalence = S.toEquivalence(ToolNameCandidate);
const stringEquivalence = S.toEquivalence(S.String);

const candidateText = (candidate: ToolNameCandidate): string => `${candidate.source}_${candidate.operationId}`;

const sha256Prefix8 = (normalized: string): string =>
  pipe(createHash("sha256").update(normalized, "utf8").digest("hex"), Str.takeLeft(DIGEST_PREFIX_LENGTH));

const groupsBy = (
  rows: ReadonlyArray<ToolNameCollisionRow>,
  keyOf: (row: ToolNameCollisionRow) => string
): GroupedRows =>
  A.reduce(rows, HashMap.empty<string, ReadonlyArray<ToolNameCollisionRow>>(), (groups, row) => {
    const key = keyOf(row);
    const grouped = pipe(HashMap.get(groups, key), O.getOrElse(A.empty<ToolNameCollisionRow>));
    return HashMap.set(groups, key, A.append(grouped, row));
  });

const duplicateKeys = (groups: GroupedRows): HashSet.HashSet<string> =>
  pipe(
    HashMap.entries(groups),
    A.fromIterable,
    A.filter(([, rows]) => N.isGreaterThan(A.length(rows), 1)),
    A.map(([key]) => key),
    HashSet.fromIterable
  );

const renderCanonicalValue = (value: unknown, indent: string): string => {
  const nested = `${indent}  `;
  if (A.isArray(value)) {
    return A.match(value, {
      onEmpty: () => "[]",
      onNonEmpty: (items) =>
        `[\n${pipe(
          items,
          A.map((item) => `${nested}${renderCanonicalValue(item, nested)}`),
          A.join(",\n")
        )}\n${indent}]`,
    });
  }
  if (P.isObject(value) && !P.isNull(value)) {
    return A.match(pipe(R.toEntries(value), A.sort(jsonEntryOrder)), {
      onEmpty: () => "{}",
      onNonEmpty: (entries) =>
        `{\n${pipe(
          entries,
          A.map(([key, entry]) => `${nested}${encodeJsonLeaf(key)}: ${renderCanonicalValue(entry, nested)}`),
          A.join(",\n")
        )}\n${indent}}`,
    });
  }
  return encodeJsonLeaf(value);
};

/**
 * Normalize one full candidate string under the frozen NFKD and ASCII policy.
 *
 * **Example** (Normalize camelCase operation id)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { normalizeToolName } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const normalized = Result.getOrThrow(normalizeToolName("ecfr_listTitles"))
 * console.log(normalized)
 * // "ecfr_list_titles"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeToolName = (candidate: string): Result.Result<string, ToolNameNormalizationError> => {
  const normalized = pipe(
    candidate,
    Str.normalize("NFKD"),
    Str.replace(combiningMarksPattern, ""),
    Str.replace(acronymBoundaryPattern, "$1_$2"),
    Str.replace(lowerToUpperBoundaryPattern, "$1_$2"),
    Str.toLowerCase,
    Str.replace(unsafeCharactersPattern, "_"),
    Str.replace(underscoreRunsPattern, "_"),
    Str.replace(hyphenRunsPattern, "-"),
    Str.replace(edgeSeparatorsPattern, "")
  );

  return Match.value(normalized).pipe(
    Match.when(Str.isEmpty, () =>
      Result.fail(
        ToolNameNormalizationError.make({
          candidate,
          message: "Tool-name normalization produced an empty string.",
          normalized,
          reason: "empty_normalized",
        })
      )
    ),
    Match.when(isNormalizedWireName, (value) => Result.succeed(value)),
    Match.orElse(() =>
      Result.fail(
        ToolNameNormalizationError.make({
          candidate,
          message: "Tool-name normalization produced characters outside ^[a-zA-Z0-9_-]+$.",
          normalized,
          reason: "invalid_normalized",
        })
      )
    )
  );
};

/**
 * Project one source/operation pair to its normalized, capped report row.
 *
 * **Example** (Project candidate to wire name)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { projectToolNameCandidate, ToolNameCandidate } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const row = Result.getOrThrow(
 *   projectToolNameCandidate(ToolNameCandidate.make({ source: "ecfr", operationId: "getStructure" }))
 * )
 * console.log(row.finalWireName)
 * // "ecfr_get_structure"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const projectToolNameCandidate = (
  input: ToolNameCandidate
): Result.Result<ToolNameCollisionRow, ToolNameNormalizationError> =>
  pipe(
    normalizeToolName(candidateText(input)),
    Result.map((normalized) => {
      const truncated = N.isGreaterThan(Str.length(normalized), MAX_WIRE_NAME_LENGTH);
      const digest = truncated ? O.some(sha256Prefix8(normalized)) : O.none<string>();
      const finalWireName = truncated
        ? `${pipe(normalized, Str.takeLeft(TRUNCATED_PREFIX_LENGTH))}_${pipe(
            digest,
            O.getOrElse(() => Str.empty)
          )}`
        : normalized;

      return ToolNameCollisionRow.make({
        candidate: candidateText(input),
        digest: O.getOrNull(digest),
        duplicateVerdict: "unique",
        finalWireName,
        normalized,
        originalOperationId: input.operationId,
        source: input.source,
        truncated,
      });
    })
  );

/**
 * Build a sorted collision report, failing closed on either duplicate stage.
 *
 * **Example** (Build clean multi-source report)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { buildToolNameCollisionReport, ToolNameCandidate } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const report = Result.getOrThrow(
 *   buildToolNameCollisionReport([
 *     ToolNameCandidate.make({ source: "govinfo", operationId: "search" }),
 *     ToolNameCandidate.make({ source: "ecfr", operationId: "listTitles" })
 *   ])
 * )
 * console.log(report.duplicateVerdict)
 * // "clean"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const buildToolNameCollisionReport = (
  candidates: ReadonlyArray<ToolNameCandidate>
): Result.Result<ToolNameCollisionReport, ToolNameNormalizationError | ToolNameCollisionError> =>
  Result.gen(function* () {
    const projected = yield* Result.all(A.map(candidates, projectToolNameCandidate));
    const normalizedDuplicates = duplicateKeys(groupsBy(projected, (row) => row.normalized));
    const finalDuplicates = duplicateKeys(groupsBy(projected, (row) => row.finalWireName));
    const hasNormalizedDuplicates = N.isGreaterThan(HashSet.size(normalizedDuplicates), 0);
    const hasFinalDuplicates = N.isGreaterThan(HashSet.size(finalDuplicates), 0);
    const rows = pipe(
      projected,
      A.map((row) =>
        ToolNameCollisionRow.make({
          ...row,
          duplicateVerdict: HashSet.has(normalizedDuplicates, row.normalized)
            ? "duplicate_normalized"
            : HashSet.has(finalDuplicates, row.finalWireName)
              ? "duplicate_final"
              : "unique",
        })
      ),
      A.sort(rowOrder)
    );
    const report = ToolNameCollisionReport.make({
      candidates: rows,
      duplicateVerdict: hasNormalizedDuplicates || hasFinalDuplicates ? "duplicate" : "clean",
    });

    if (hasNormalizedDuplicates) {
      return yield* Result.fail(
        ToolNameCollisionError.make({
          collisionKeys: pipe(normalizedDuplicates, A.fromIterable, A.sort(Order.String)),
          message: "Duplicate normalized MCP tool names are forbidden.",
          reason: "duplicate_normalized",
          report,
        })
      );
    }
    if (hasFinalDuplicates) {
      return yield* Result.fail(
        ToolNameCollisionError.make({
          collisionKeys: pipe(finalDuplicates, A.fromIterable, A.sort(Order.String)),
          message: "Duplicate final MCP wire names are forbidden.",
          reason: "duplicate_final",
          report,
        })
      );
    }
    return report;
  });

/**
 * Render a report with sorted keys, two-space indentation, LF endings, and one
 * trailing newline.
 *
 * **Example** (Render report trailing newline)
 *
 * ```ts
 * import {
 *   ProductionToolNameCollisionReport,
 *   renderToolNameCollisionReport
 * } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const rendered = renderToolNameCollisionReport(ProductionToolNameCollisionReport)
 * console.log(rendered.endsWith("\n"))
 * // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const renderToolNameCollisionReport = (report: ToolNameCollisionReport): string =>
  `${renderCanonicalValue(report, "")}\n`;

/**
 * Frozen four-tool source/operation registry consumed by generation.
 *
 * **Example** (Count frozen production candidates)
 *
 * ```ts
 * import { ProductionToolNameCandidates } from "@beep/gov-legal-mcp/ToolNames"
 *
 * console.log(ProductionToolNameCandidates.length)
 * // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ProductionToolNameCandidates: ReadonlyArray<ToolNameCandidate> = [
  ToolNameCandidate.make({ source: "govinfo", operationId: "search" }),
  ToolNameCandidate.make({ source: "ecfr", operationId: "listTitles" }),
  ToolNameCandidate.make({ source: "ecfr", operationId: "searchResults" }),
  ToolNameCandidate.make({ source: "ecfr", operationId: "getStructure" }),
];

/**
 * Validated clean production report evaluated before any toolkit declaration.
 *
 * **Example** (List production final wire names)
 *
 * ```ts
 * import { ProductionToolNameCollisionReport } from "@beep/gov-legal-mcp/ToolNames"
 *
 * console.log(ProductionToolNameCollisionReport.candidates.map((row) => row.finalWireName))
 * // ["ecfr_get_structure", "ecfr_list_titles", "ecfr_search_results", "govinfo_search"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ProductionToolNameCollisionReport = Result.getOrThrowWith(
  buildToolNameCollisionReport(ProductionToolNameCandidates),
  (error) => error
);

/**
 * Resolve one registered tool name through the validated production report,
 * failing when the declaration is absent or its expected wire name drifted.
 *
 * **Example** (Resolve matching production wire name)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { resolveProductionToolName, ToolNameCandidate } from "@beep/gov-legal-mcp/ToolNames"
 *
 * const result = resolveProductionToolName(
 *   ToolNameCandidate.make({ source: "ecfr", operationId: "listTitles" }),
 *   "ecfr_list_titles"
 * )
 * console.log(Result.getOrThrow(result))
 * // "ecfr_list_titles"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const resolveProductionToolName: {
  <const WireName extends string>(
    expectedWireName: WireName
  ): (candidate: ToolNameCandidate) => Result.Result<WireName, ToolNameRegistrationError>;
  <const WireName extends string>(
    candidate: ToolNameCandidate,
    expectedWireName: WireName
  ): Result.Result<WireName, ToolNameRegistrationError>;
} = dual(
  2,
  <const WireName extends string>(
    candidate: ToolNameCandidate,
    expectedWireName: WireName
  ): Result.Result<WireName, ToolNameRegistrationError> =>
    pipe(
      ProductionToolNameCollisionReport.candidates,
      A.findFirst((row) =>
        candidateEquivalence(
          candidate,
          ToolNameCandidate.make({ operationId: row.originalOperationId, source: row.source })
        )
      ),
      O.match({
        onNone: () =>
          Result.fail(
            ToolNameRegistrationError.make({
              candidate,
              expectedWireName,
              message: "Registered MCP tool candidate is absent from the validated production report.",
              reason: "missing_candidate",
            })
          ),
        onSome: (row) =>
          pipe(
            stringEquivalence(row.finalWireName, expectedWireName),
            Bool.match({
              onFalse: () =>
                Result.fail(
                  ToolNameRegistrationError.make({
                    candidate,
                    expectedWireName,
                    message: "Registered MCP wire name drifted from the validated production report.",
                    reason: "wire_name_drift",
                  })
                ),
              onTrue: () => Result.succeed(expectedWireName),
            })
          ),
      })
    )
);
