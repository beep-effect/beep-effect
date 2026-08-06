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
import * as S from "effect/Schema";
import { CodexFindingsIngestError } from "./Findings.errors.ts";

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

/**
 * Decode one data row, dropping every column the packet must never carry.
 *
 * The returned record is the whole of what leaves this module for a row: no
 * description, no author, no assignee. `index` is zero-based over data rows, so
 * the reported line number adds two to account for the header.
 *
 * @param row - Raw cells of one data row.
 * @param index - Zero-based position of the row among data rows.
 * @returns The normalized finding fields for that row.
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
    codexId: codexId.value,
    title: cellAt(row, "title"),
    severity: severity.value,
    codexStatus: status.value,
    commit: cellAt(row, "commit_hash"),
  };
});

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
 * The returned findings carry no description, author, or assignee. The report
 * body is unsanitized external text and belongs in ignored raw evidence, not in
 * a value that packet renderers can reach.
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
  const header = A.head(rows);

  if (O.isNone(header) || A.join(header.value, ",") !== A.join(CODEX_CSV_COLUMNS, ",")) {
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

  const dataRows = A.filter(A.drop(1)(rows), (row) => A.length(row) > 1);

  const findings = yield* Effect.forEach(dataRows, decodeRow);

  const identities = A.map(findings, (finding) => finding.codexId);
  if (A.length(A.dedupe(identities)) !== A.length(identities)) {
    return yield* CodexFindingsIngestError.make({
      reason: "csv-duplicate-finding",
      message:
        "The export lists the same finding more than once, so a packet built from it would double-count. Re-export the findings view.",
    });
  }

  return {
    findings,
    // Every row of one export names the same repository; the head row is the
    // only place it needs to be read from.
    repository: O.getOrElse(
      O.map(A.head(dataRows), (row) => cellAt(row, "repository")),
      () => ""
    ),
    statuses: A.dedupe(A.map(findings, (finding) => finding.codexStatus)),
  };
});
