/**
 * Decoding boundary for the Codex Cloud findings CSV export.
 *
 * The findings view exports its own CSV through a signed-in browser action, so
 * this CLI never touches a cookie, a token, or an authorization header — the
 * operator downloads a file and passes its path. That is the whole reason the
 * capture lane is a file import rather than a scripted fetch.
 *
 * Three of the export's columns — `author_email`, `assignee_name`, and
 * `assignee_email` — carry personal data that no packet needs. They are dropped
 * here, at the parse boundary, so nothing downstream can leak what it never
 * received. The reject-scan independently refuses email addresses as a second
 * line of defense.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { MappedLiteralKit } from "@beep/schema";
import { parseCsvRows } from "@beep/schema/CsvParser";
import { ParserOptions } from "@beep/schema/ParserOptions";
import { A, O, Str } from "@beep/utils";
import { Effect } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { SecurityCloudFindingId } from "./Findings.capture.schemas.ts";
import { CodexFindingsIngestError } from "./Findings.errors.ts";
import type { CodexCaptureSource } from "./Findings.capture.schemas.ts";

const $I = $RepoCliId.create("commands/Codex/Findings.csv");

/**
 * Column header the signed-in CSV export is expected to declare, in order.
 *
 * **Gotchas**
 *
 * An export whose header differs is refused rather than best-effort mapped. A
 * signed-out request returns an HTML login document, and a silently reordered
 * column would otherwise map severities onto commits.
 *
 * **Example** (Checking the expected width)
 *
 * ```ts
 * import { CODEX_CSV_COLUMNS } from "@beep/repo-cli/commands/Codex/Findings.csv"
 *
 * console.log(CODEX_CSV_COLUMNS.length) // 17
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CODEX_CSV_COLUMNS = [
  "finding_url",
  "repository",
  "repository_url",
  "title",
  "description",
  "severity",
  "status",
  "detected_at",
  "committed_at",
  "author_email",
  "assignee_name",
  "assignee_email",
  "has_patch",
  "configured_scan_id",
  "commit_hash",
  "relevant_paths",
  "resolution_reason",
] as const;

/**
 * Exact Security Cloud CSV header verified against the October 2026 export.
 *
 * **Details**
 *
 * Summary is not a complete report: validation and attack-path evidence are
 * available separately in finding details. Unknown headers remain unsupported.
 *
 * **Example** (Checking the current export width)
 *
 * ```ts
 * import { SECURITY_CLOUD_CSV_COLUMNS } from "@beep/repo-cli/commands/Codex/Findings.csv"
 *
 * SECURITY_CLOUD_CSV_COLUMNS.length // => 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SECURITY_CLOUD_CSV_COLUMNS = [
  "Finding ID",
  "Source",
  "Repository",
  "Title",
  "Summary",
  "Severity",
  "Status",
  "Paths",
  "Observed revision",
  "Detected at",
] as const;

/**
 * Columns dropped at the parse boundary because they carry personal data.
 *
 * **Example** (Naming the dropped columns)
 *
 * ```ts
 * import { CODEX_CSV_PII_COLUMNS } from "@beep/repo-cli/commands/Codex/Findings.csv"
 *
 * console.log(CODEX_CSV_PII_COLUMNS.includes("author_email")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CODEX_CSV_PII_COLUMNS = ["author_email", "assignee_name", "assignee_email"] as const;

/**
 * Reversible codec from the export's lowercase severity to the packet domain.
 *
 * **Example** (Decoding a wire severity)
 *
 * ```ts
 * import { CodexCsvSeverity } from "@beep/repo-cli/commands/Codex/Findings.csv"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(CodexCsvSeverity)("medium")) // "Medium"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexCsvSeverity = MappedLiteralKit([
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
  ["informational", "Informational"],
]).pipe(
  $I.annoteSchema("CodexCsvSeverity", {
    description: "Codec from the CSV export's lowercase severity to the capitalized packet domain.",
  })
);

/**
 * Packet-domain severity decoded from a CSV cell.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexCsvSeverity = typeof CodexCsvSeverity.Type;

/**
 * Reversible codec from the export's lowercase status to the packet domain.
 *
 * **Example** (Decoding a wire status)
 *
 * ```ts
 * import { CodexCsvStatus } from "@beep/repo-cli/commands/Codex/Findings.csv"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(CodexCsvStatus)("new")) // "New"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodexCsvStatus = MappedLiteralKit([
  ["new", "New"],
  ["open", "Open"],
  ["closed", "Closed"],
  ["triaged", "Triaged"],
  ["in_progress", "In Progress"],
  ["fixed", "Fixed"],
  ["wontfix", "Won't fix"],
  ["duplicate", "Duplicate"],
  ["false_positive", "False positive"],
]).pipe(
  $I.annoteSchema("CodexCsvStatus", {
    description: "Codec from the CSV export's lowercase status to the capitalized packet domain.",
  })
);

/**
 * Packet-domain status decoded from a CSV cell.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodexCsvStatus = typeof CodexCsvStatus.Type;

/**
 * One finding's unsanitized report body, destined only for ignored evidence.
 *
 * **Gotchas**
 *
 * This shape is deliberately distinct from the tracked finding record, and no
 * packet renderer accepts it. Report text is external prose that legitimately
 * quotes developer-local paths and secret-shaped literals — measured against a
 * real 27-finding export, 4 bodies carry content the tracked-document scan
 * refuses outright. It belongs in gitignored `raw/`, never in a tracked file.
 *
 * **Example** (Constructing a raw report)
 *
 * ```ts
 * import { CodexRawReport } from "@beep/repo-cli/commands/Codex/Findings.csv"
 *
 * const report = CodexRawReport.make({
 *   codexId: "d2b9e11e8550819193516057a336ff90",
 *   description: "The resolver reads an unbounded file.",
 *   relevantPaths: "packages/x/src/Y.ts",
 *   detectedAt: "2026-08-04T16:06:15.518000Z",
 * })
 *
 * console.log(report.relevantPaths) // "packages/x/src/Y.ts"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CodexRawReport extends S.Class<CodexRawReport>($I`CodexRawReport`)(
  {
    codexId: S.String,
    description: S.String,
    relevantPaths: S.String,
    detectedAt: S.String,
  },
  $I.annote("CodexRawReport", {
    description: "One finding's unsanitized report body, written only to ignored raw evidence.",
  })
) {}

const FINDING_URL_PREFIX = "https://chatgpt.com/codex/cloud/security/findings/";

/**
 * Recover the Codex finding identity from an export's `finding_url` cell.
 *
 * **Details**
 *
 * The export carries no bare identifier column, so identity comes from the
 * canonical URL's final segment. Requiring the exact prefix keeps a redirected
 * or rewritten URL from contributing an identity.
 *
 * **Example** (Reading an identity)
 *
 * ```ts
 * import { codexIdFromFindingUrl } from "@beep/repo-cli/commands/Codex/Findings.csv"
 * import * as O from "effect/Option"
 *
 * const id = codexIdFromFindingUrl(
 *   "https://chatgpt.com/codex/cloud/security/findings/d2b9e11e8550819193516057a336ff90"
 * )
 *
 * console.log(O.getOrElse(id, () => "none")) // "d2b9e11e8550819193516057a336ff90"
 * ```
 *
 * @param url - The `finding_url` cell of one export row.
 * @returns The 32-character identity, or `None` when the URL is not canonical.
 * @category utilities
 * @since 0.0.0
 */
export const codexIdFromFindingUrl = (url: string): O.Option<string> => {
  if (!Str.startsWith(FINDING_URL_PREFIX)(url)) {
    return O.none();
  }
  const tail = Str.slice(Str.length(FINDING_URL_PREFIX))(url);
  return /^[0-9a-f]{32}$/.test(tail) ? O.some(tail) : O.none();
};

// The export's `description` column is a quoted cell that may carry commas and
// newlines, so RFC 4180 handling is mandatory. `@beep/schema` already owns a
// reviewed parser for exactly this; hand-rolling a second one would duplicate
// its quote and line-ending edge cases without inheriting its coverage.
const csvParserOptions = ParserOptions.new();

const cellAt = (row: ReadonlyArray<string>, column: (typeof CODEX_CSV_COLUMNS)[number]): string =>
  row[CODEX_CSV_COLUMNS.indexOf(column)] ?? "";

const decodeSeverity = S.decodeUnknownOption(CodexCsvSeverity);
const decodeStatus = S.decodeUnknownOption(CodexCsvStatus);

// Only the source-qualified Diff scan identity is verified by a real export.
// A new source namespace must be admitted with its own fixture, never stripped.
class SecurityCloudCsvRow extends S.Class<SecurityCloudCsvRow>($I`SecurityCloudCsvRow`)(
  {
    "Finding ID": SecurityCloudFindingId,
    Source: S.Literals(["Diff scan"]),
    Repository: S.String.check(
      S.isPattern(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, {
        identifier: $I`SecurityCloudRepositoryUrlCheck`,
        title: "Security Cloud Repository Url",
        description: "Canonical HTTPS GitHub repository URL without credentials, query, or fragment.",
      })
    ),
    Title: S.String,
    Summary: S.String,
    Severity: CodexCsvSeverity,
    Status: CodexCsvStatus,
    Paths: S.String,
    "Observed revision": S.String,
    "Detected at": S.String,
  },
  $I.annote("SecurityCloudCsvRow", {
    description: "Verified Security Cloud summary export row; the full detail evidence is not exported.",
  })
) {}

const decodeSecurityCloudRow = Effect.fn("CodexFindings.decodeSecurityCloudRow")(function* (
  row: ReadonlyArray<string>,
  index: number
) {
  if (A.length(row) !== A.length(SECURITY_CLOUD_CSV_COLUMNS)) {
    return yield* CodexFindingsIngestError.make({
      reason: "csv-row-malformed",
      message: `Row ${index + 2} does not match the Security Cloud export width. Download the export again.`,
    });
  }
  const decoded = yield* S.decodeUnknownEffect(SecurityCloudCsvRow)(
    R.fromEntries(A.zip(SECURITY_CLOUD_CSV_COLUMNS, row))
  ).pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "csv-row-malformed",
        message: `Row ${index + 2} has an unsupported Security Cloud identity, source, repository, severity, or status. Values are refused rather than guessed.`,
      })
    )
  );
  return {
    repository: Str.slice(Str.length("https://github.com/"))(decoded.Repository),
    finding: {
      codexId: decoded["Finding ID"],
      title: decoded.Title,
      severity: decoded.Severity,
      codexStatus: decoded.Status,
      commit: decoded["Observed revision"],
    },
    report: CodexRawReport.make({
      codexId: decoded["Finding ID"],
      description: decoded.Summary,
      relevantPaths: decoded.Paths,
      detectedAt: decoded["Detected at"],
    }),
  };
});

/**
 * Decode one data row into its tracked projection and its raw report body.
 *
 * **Details**
 *
 * The two halves are returned separately on purpose. `finding` is the only
 * shape any tracked renderer accepts; `report` carries the unsanitized report
 * text and relevant paths and is reachable only by the ignored `raw/` writer.
 * Personal-data columns are read by neither. `index` is zero-based over data
 * rows, so the reported line number adds two to account for the header.
 *
 * @param row - Raw cells of one data row.
 * @param index - Zero-based position of the row among data rows.
 * @returns The tracked projection paired with its raw report body.
 */
const decodeRow = Effect.fnUntraced(function* (row: ReadonlyArray<string>, index: number) {
  const line = index + 2;
  if (A.length(row) !== A.length(CODEX_CSV_COLUMNS)) {
    return yield* CodexFindingsIngestError.make({
      reason: "csv-row-malformed",
      message: `Row ${line} has ${A.length(row)} cells but the header declares ${A.length(CODEX_CSV_COLUMNS)}. The export is truncated or corrupt; download it again.`,
    });
  }

  const codexId = codexIdFromFindingUrl(cellAt(row, "finding_url"));
  const severity = decodeSeverity(cellAt(row, "severity"));
  const status = decodeStatus(cellAt(row, "status"));

  if (O.isNone(codexId) || O.isNone(severity) || O.isNone(status)) {
    return yield* CodexFindingsIngestError.make({
      reason: "csv-row-malformed",
      message: `Row ${line} carries an unrecognized finding URL, severity, or status. Values are refused rather than guessed; update the CLI if Codex introduced a new one.`,
    });
  }

  return {
    repository: cellAt(row, "repository"),
    finding: {
      codexId: codexId.value,
      title: cellAt(row, "title"),
      severity: severity.value,
      codexStatus: status.value,
      commit: cellAt(row, "commit_hash"),
    },
    report: CodexRawReport.make({
      codexId: codexId.value,
      description: cellAt(row, "description"),
      relevantPaths: cellAt(row, "relevant_paths"),
      detectedAt: cellAt(row, "detected_at"),
    }),
  };
});

const matchesCsvColumns = (actual: ReadonlyArray<string>, expected: ReadonlyArray<string>): boolean =>
  A.length(actual) === A.length(expected) && Str.equivalence(A.join(actual, ","), A.join(expected, ","));

/**
 * Decode a signed-in CSV export into capture findings, dropping personal data.
 *
 * **When to use**
 *
 * Use as the only entry point from an export file to packet data. It refuses a
 * signed-out HTML response, an unexpected header, a malformed row, and a
 * duplicated finding identity, so every downstream stage receives a payload
 * that already reconciles.
 *
 * **Gotchas**
 *
 * `findings` carries no description, author, or assignee — it is the tracked
 * projection. The report bodies come back separately as `reports`, which only
 * the ignored `raw/` writer consumes, so unsanitized external prose cannot
 * reach a value a packet renderer accepts.
 *
 * **Example** (Refusing a signed-out response)
 *
 * ```ts
 * import { decodeCodexFindingsCsv } from "@beep/repo-cli/commands/Codex/Findings.csv"
 * import { Effect } from "effect"
 *
 * const program = decodeCodexFindingsCsv("<!doctype html><title>Log in</title>").pipe(
 *   Effect.map(() => "accepted"),
 *   Effect.orElseSucceed(() => "refused")
 * )
 *
 * console.log(Effect.runSync(program)) // "refused"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const decodeCodexFindingsCsv = Effect.fnUntraced(function* (text: string) {
  const rows = yield* parseCsvRows(text, csvParserOptions).pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-unreadable",
        message:
          "The file could not be parsed as CSV. Re-run `Export findings as CSV` from the signed-in findings view.",
      })
    )
  );
  const header = O.getOrElse(A.head(rows), A.empty<string>);
  const legacy = matchesCsvColumns(header, CODEX_CSV_COLUMNS);
  const securityCloud = matchesCsvColumns(header, SECURITY_CLOUD_CSV_COLUMNS);
  if (!legacy && !securityCloud) {
    // A signed-out export is an HTML login document, which lands here rather
    // than as a parse crash. Both cases mean "no usable export", so the
    // operator gets one instruction instead of a stack trace.
    return yield* CodexFindingsIngestError.make({
      reason: Str.includes("<html")(Str.toLowerCase(Str.slice(0, 400)(text)))
        ? "auth-expired"
        : "csv-header-unsupported",
      message:
        "The file is not a current Codex findings CSV export. Re-run `Export findings as CSV` from the signed-in findings view and pass the downloaded file.",
    });
  }

  const dataRows = A.filter(A.drop(1)(rows), (row) => !(A.length(row) === 1 && row[0] === ""));

  const decoded = yield* Effect.forEach(dataRows, securityCloud ? decodeSecurityCloudRow : decodeRow);
  const findings = A.map(decoded, (entry) => entry.finding);
  const reports = A.map(decoded, (entry) => entry.report);

  const identities = A.map(findings, (finding) => finding.codexId);
  if (A.length(A.dedupe(identities)) !== A.length(identities)) {
    return yield* CodexFindingsIngestError.make({
      reason: "csv-duplicate-finding",
      message:
        "The export lists the same finding more than once, so a packet built from it would double-count. Re-export the findings view.",
    });
  }

  const repositories = A.dedupe(A.map(decoded, (entry) => entry.repository));
  if (A.length(repositories) > 1) {
    return yield* CodexFindingsIngestError.make({
      reason: "csv-row-malformed",
      message: "The export contains multiple repositories. Scope the findings view to one repository and export again.",
    });
  }

  const source: CodexCaptureSource = securityCloud ? "security-cloud-csv" : "cloud-csv";
  return {
    source,
    findings,
    reports,
    // Every row of one export names the same repository; the head row is the
    // only place it needs to be read from.
    repository: O.getOrElse(A.head(repositories), () => ""),
    statuses: A.dedupe(A.map(findings, (finding) => finding.codexStatus)),
  };
});
