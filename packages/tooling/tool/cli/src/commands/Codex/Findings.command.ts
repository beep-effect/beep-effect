/**
 * `beep codex findings ingest` — turn a signed-in CSV export into a goal packet.
 *
 * The command never authenticates. The operator runs `Export findings as CSV`
 * from the already signed-in findings view and passes the downloaded file, so
 * no cookie, token, or authorization header is ever read, stored, logged, or
 * placed on a process command line.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { Unknown } from "@beep/schema/Unknown";
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { dryRunFlag, forceFlag, jsonFlag } from "../../internal/cli/Flags.ts";
import { printJsonOrLines, printLines } from "../../internal/cli/Printer.ts";
import { writePortfolioIndex } from "../Goals/PortfolioIndex.ts";
import { CodexFindingSeverity, decodeCodexFindingsCapturePayload } from "./Findings.capture.schemas.ts";
import { decodeCodexFindingsCsv } from "./Findings.csv.ts";
import { CodexFindingsIngestError, CodexFindingsRedactionError } from "./Findings.errors.ts";
import { defaultPacketSlug, planPacket, priorIdsOfEntries } from "./Findings.normalize.ts";
import { renderPacketDocuments } from "./Findings.packet.ts";
import {
  loadCodexRefreshLedgerSource,
  priorIdsOfRefreshSource,
  refreshCodexFindingsPacket,
  validateCodexFindingsIngestModes,
} from "./Findings.refresh.ts";
import { describeSensitiveHits, scanSensitiveUnknown } from "./Findings.scan.ts";
import { decodeCodexTriageLedger } from "./Findings.triage.schemas.ts";
import { writePacket } from "./Findings.write.ts";
import type { CodexFindingsRefreshReconciliation, CodexRefreshLedgerSource } from "./Findings.refresh.ts";
import type { CodexPacketPlan } from "./Findings.schemas.ts";

const SOURCE_URL = "https://chatgpt.com/codex/cloud/security/findings/";

/**
 * Recover the capture date from the export's own filename.
 *
 * **Details**
 *
 * The date must come from the capture, never from the wall clock, or the same
 * export would produce a different packet tomorrow. Codex names its download
 * `codex-security-findings-<ISO timestamp>.csv`.
 *
 * **Example** (Reading a capture date)
 *
 * ```ts
 * import { captureDateFromFileName } from "@beep/repo-cli/commands/Codex/Findings.command"
 * import * as O from "effect/Option"
 *
 * const date = captureDateFromFileName("codex-security-findings-2026-08-04T16-06-15.518Z.csv")
 *
 * console.log(O.getOrElse(date, () => "unknown")) // "2026-08-04"
 * ```
 *
 * @param fileName - Basename of the downloaded export.
 * @returns The `YYYY-MM-DD` capture date, or `None` when the name carries none.
 * @category utilities
 * @since 0.0.0
 */
export const captureDateFromFileName = (fileName: string): O.Option<string> => {
  const match = /(\d{4}-\d{2}-\d{2})/.exec(fileName);
  return match === null ? O.none() : O.fromUndefinedOr(match[1]);
};

const encodePayload = Unknown.encodeUnknownSyncFromJsonString;
const parseJsonText = Unknown.decodeUnknownEffectFromJsonString;

const readPriorIds = Effect.fnUntraced(function* (packetDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const ledgerPath = `${packetDir}/ops/triage.json`;

  const exists = yield* fs.exists(ledgerPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return priorIdsOfEntries([]);
  }

  // A ledger that exists but cannot be read is a hard failure, never an empty
  // binding map. Falling back to "no bindings" here would let a --force ingest
  // renumber every CSF-NNN from the current sort order, silently invalidating
  // hand-written references and the exact-identifier closeout allowlist — the
  // precise outcome sticky identity exists to prevent.
  const entries = yield* fs.readFileString(ledgerPath).pipe(
    Effect.flatMap(parseJsonText),
    Effect.flatMap(decodeCodexTriageLedger),
    Effect.map((ledger) => A.map(ledger.findings, (finding) => ({ id: finding.id, codexId: finding.codexId }))),
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "ledger-unreadable",
        message: `${ledgerPath} exists but does not decode as a codex-triage/v1 ledger. Repair or remove it before re-ingesting; continuing would renumber every CSF-NNN and break the closeout allowlist.`,
      })
    )
  );

  return priorIdsOfEntries(entries);
});

type CodexFindingsIngestCommandOptions = {
  readonly from: string;
  readonly slug: O.Option<string>;
  readonly date: O.Option<string>;
  readonly branch: O.Option<string>;
  readonly expectedCount: O.Option<number>;
  readonly refresh: boolean;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly json: boolean;
};

type DecodedCodexFindingsCsv = Effect.Success<ReturnType<typeof decodeCodexFindingsCsv>>;

const locateRepositoryRoot = Effect.fn("CodexFindings.locateRepositoryRoot")(function* () {
  return yield* findRepoRoot().pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-unreadable",
        message: "The repository root could not be located.",
      })
    )
  );
});

const readCodexFindingsExport = Effect.fn("CodexFindings.readExport")(function* (from: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(from).pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-unreadable",
        message: "The export could not be read. Check the path passed to --from.",
      })
    )
  );
  return yield* decodeCodexFindingsCsv(text);
});

const resolveCaptureDate = Effect.fn("CodexFindings.resolveCaptureDate")(function* (
  date: O.Option<string>,
  fileName: string
) {
  const resolvedDate = O.orElse(date, () => captureDateFromFileName(fileName));
  if (O.isNone(resolvedDate)) {
    return yield* CodexFindingsIngestError.make({
      reason: "capture-date-unknown",
      message:
        "The capture date could not be read from the export filename. Pass --date YYYY-MM-DD so the packet is reproducible rather than clock-dependent.",
    });
  }
  return resolvedDate.value;
});

const decodeCapturePayload = Effect.fn("CodexFindings.decodeCapturePayload")(function* (
  parsed: DecodedCodexFindingsCsv,
  capturedAt: string,
  expectedCount: O.Option<number>
) {
  const payloadInput = {
    schemaVersion: "codex-findings-capture/v1",
    capture: {
      capturedAt,
      sourceUrl: SOURCE_URL,
      repository: parsed.repository,
      findingsView: `repo-scoped, status=${A.join(A.map(parsed.statuses, Str.toLowerCase), "|")}`,
      expectedCount: O.getOrElse(expectedCount, () => A.length(parsed.findings)),
      authState: "authenticated",
    },
    findings: parsed.findings,
  };

  // Scan the payload before decoding: a credential sitting in a field the
  // schema would have dropped must still stop the ingest.
  const hits = scanSensitiveUnknown("capture", payloadInput);
  if (A.isReadonlyArrayNonEmpty(hits)) {
    return yield* CodexFindingsRedactionError.make({
      message:
        "Refusing to ingest: the export carries secret-shaped or personal content. The offending values are deliberately not reproduced here.",
      surfaces: describeSensitiveHits(hits),
    });
  }

  return yield* decodeCodexFindingsCapturePayload(payloadInput).pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-invalid",
        message:
          "The export decoded into findings that fail the capture contract. Values are refused rather than truncated; re-export and retry.",
      })
    )
  );
});

const loadPlanningProvenance = Effect.fn("CodexFindings.loadPlanningProvenance")(function* (
  options: CodexFindingsIngestCommandOptions,
  repoRoot: string,
  provisionalSlug: string
) {
  if (!options.refresh) {
    const path = yield* Path.Path;
    return {
      refreshSource: O.none<CodexRefreshLedgerSource>(),
      priorIds: yield* readPriorIds(path.join(repoRoot, "goals", provisionalSlug)),
      plannedBranch: O.getOrUndefined(options.branch),
    };
  }

  const source = yield* loadCodexRefreshLedgerSource({ repoRoot, slug: provisionalSlug });
  return {
    refreshSource: O.some(source),
    priorIds: priorIdsOfRefreshSource(source),
    plannedBranch: O.getOrElse(options.branch, () => source.ledger.meta.branch),
  };
});

const prepareCodexFindingsIngest = Effect.fn("CodexFindings.prepareIngest")(function* (
  options: CodexFindingsIngestCommandOptions
) {
  const path = yield* Path.Path;
  const repoRoot = yield* locateRepositoryRoot();
  const parsed = yield* readCodexFindingsExport(options.from);
  const capturedAt = yield* resolveCaptureDate(options.date, path.basename(options.from));
  const payload = yield* decodeCapturePayload(parsed, capturedAt, options.expectedCount);
  // Must match the slug planPacket will derive, or prior identifiers would be
  // read from the wrong packet; both sides go through the same helper.
  const provisionalSlug = O.getOrElse(options.slug, () => defaultPacketSlug(capturedAt));
  const provenance = yield* loadPlanningProvenance(options, repoRoot, provisionalSlug);
  const plan = yield* planPacket(payload, {
    slug: O.getOrUndefined(options.slug),
    branch: provenance.plannedBranch,
    capturedAt,
    expectedCount: O.getOrUndefined(options.expectedCount),
    priorIds: provenance.priorIds,
  });

  return {
    repoRoot,
    plan,
    refreshSource: provenance.refreshSource,
    documents: renderPacketDocuments({
      plan,
      // Report bodies are the evidence P2 validates against. They only ever reach
      // ignored `raw/reports/`; no tracked renderer accepts this shape.
      rawReports: parsed.reports,
      // Raw evidence is the normalized capture, never the export itself: the CSV
      // carries author email addresses and unsanitized report bodies.
      rawPayloadJson: `${encodePayload(payload)}\n`,
    }),
  };
});

type PreparedCodexFindingsIngest = Effect.Success<ReturnType<typeof prepareCodexFindingsIngest>>;

const writeCodexFindingsIngest = Effect.fn("CodexFindings.writeIngest")(function* (
  options: CodexFindingsIngestCommandOptions,
  prepared: PreparedCodexFindingsIngest
) {
  if (O.isSome(prepared.refreshSource)) {
    const outcome = yield* refreshCodexFindingsPacket({
      repoRoot: prepared.repoRoot,
      slug: prepared.plan.slug,
      source: prepared.refreshSource.value,
      plan: prepared.plan,
      documents: prepared.documents,
      dryRun: options.dryRun,
    });
    return { outcome, reconciliation: O.some(outcome.reconciliation) };
  }

  return {
    outcome: yield* writePacket({
      repoRoot: prepared.repoRoot,
      slug: prepared.plan.slug,
      documents: prepared.documents,
      dryRun: options.dryRun,
      force: options.force,
    }),
    reconciliation: O.none<CodexFindingsRefreshReconciliation>(),
  };
});

type CodexFindingsIngestWriteResult = Effect.Success<ReturnType<typeof writeCodexFindingsIngest>>;
type CodexFindingsIngestOutcome = CodexFindingsIngestWriteResult["outcome"];

const regeneratePortfolioIndex = Effect.fn("CodexFindings.regeneratePortfolioIndex")(function* (
  dryRun: boolean,
  reconciliation: O.Option<CodexFindingsRefreshReconciliation>
) {
  const unchangedRefresh = O.isSome(reconciliation) && A.isReadonlyArrayEmpty(reconciliation.value.appendedIds);
  if (dryRun || unchangedRefresh) {
    return true;
  }
  return yield* writePortfolioIndex().pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
});

const renderSeveritySummary = (plan: CodexPacketPlan): string =>
  A.join(
    A.map(
      A.filter(CodexFindingSeverity.Options, (severity) => (plan.severityCounts[severity] ?? 0) > 0),
      (severity) => `${severity} ${plan.severityCounts[severity] ?? 0}`
    ),
    " · "
  );

const renderRawEvidenceLines = (outcome: CodexFindingsIngestOutcome): ReadonlyArray<string> =>
  A.match(outcome.reportedEvidence, {
    onEmpty: A.empty<string>,
    onNonEmpty: (reportedEvidence) => [
      `! raw      ${A.length(reportedEvidence)} report body/bodies carry sensitive-shaped text (ignored, untracked): ${A.join(reportedEvidence, ", ")}`,
    ],
  });

const renderPacketStatusLine = (
  outcome: CodexFindingsIngestOutcome,
  reconciliation: O.Option<CodexFindingsRefreshReconciliation>,
  dryRun: boolean
): string => {
  if (outcome.committed) {
    return `✓ packet   ${outcome.packetPath}  (${A.length(outcome.written)} files updated)`;
  }
  if (dryRun) {
    return `• dry run  ${outcome.packetPath} not written  (${A.length(outcome.written)} files planned)`;
  }
  if (O.isSome(reconciliation) && reconciliation.value.status === "no-new-findings") {
    return `✓ refresh  ${outcome.packetPath} already reconciled; no new findings`;
  }
  return `• packet  ${outcome.packetPath} unchanged`;
};

const renderRefreshLines = (reconciliation: O.Option<CodexFindingsRefreshReconciliation>): ReadonlyArray<string> =>
  O.match(reconciliation, {
    onNone: A.empty<string>,
    onSome: (result) =>
      A.match(result.appendedIds, {
        onEmpty: A.empty<string>,
        onNonEmpty: (appendedIds) => [
          `✓ refresh  preserved ${result.priorCount} prior records; appended ${A.join(appendedIds, ", ")}`,
        ],
      }),
  });

const renderCodexFindingsIngestLines = (
  plan: CodexPacketPlan,
  outcome: CodexFindingsIngestOutcome,
  reconciliation: O.Option<CodexFindingsRefreshReconciliation>,
  dryRun: boolean,
  indexRegenerated: boolean
): ReadonlyArray<string> => [
  `✓ export   ${A.length(plan.records)} findings   ${renderSeveritySummary(plan)}`,
  "✓ scan     0 rejections across payload and tracked documents",
  ...renderRawEvidenceLines(outcome),
  renderPacketStatusLine(outcome, reconciliation, dryRun),
  ...renderRefreshLines(reconciliation),
  ...(indexRegenerated
    ? A.empty<string>()
    : ["! index    goals/INDEX.md could not be regenerated; run `beep goals index`"]),
  "",
  `Next: /goal follow the instructions in ${outcome.packetPath}/GOAL.md`,
];

const printCodexFindingsIngestResult = Effect.fn("CodexFindings.printIngestResult")(function* (
  options: CodexFindingsIngestCommandOptions,
  plan: CodexPacketPlan,
  writeResult: CodexFindingsIngestWriteResult
) {
  const { outcome, reconciliation } = writeResult;
  const indexRegenerated = yield* regeneratePortfolioIndex(options.dryRun, reconciliation);
  const refreshJson = O.map(reconciliation, (refresh) => ({ refresh }));

  yield* printJsonOrLines(
    options.json,
    {
      packetPath: outcome.packetPath,
      committed: outcome.committed,
      capturedAt: plan.capturedAt,
      findingCount: A.length(plan.records),
      severityCounts: plan.severityCounts,
      files: A.length(outcome.written),
      indexRegenerated,
      ...O.getOrElse(refreshJson, () => ({})),
    },
    renderCodexFindingsIngestLines(plan, outcome, reconciliation, options.dryRun, indexRegenerated)
  );
});

/**
 * Ingest a Codex findings CSV export into a bootstrapped goal packet.
 *
 * **Example** (Naming the ingest entry point)
 *
 * ```ts
 * import { runCodexFindingsIngest } from "@beep/repo-cli/commands/Codex/Findings.command"
 *
 * console.log(typeof runCodexFindingsIngest) // "function"
 * ```
 *
 * @param options - Validated ingest flags, including the export path.
 * @returns An effect that writes or plans the packet and prints the summary.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodexFindingsIngest = Effect.fn("CodexFindings.runIngest")(function* (
  options: CodexFindingsIngestCommandOptions
) {
  yield* validateCodexFindingsIngestModes({ refresh: options.refresh, force: options.force });
  const prepared = yield* prepareCodexFindingsIngest(options);
  const writeResult = yield* writeCodexFindingsIngest(options, prepared);
  yield* printCodexFindingsIngestResult(options, prepared.plan, writeResult);
});

const fromFlag = Flag.string("from").pipe(
  Flag.withDescription("Path to the CSV downloaded from the signed-in findings view")
);
const slugFlag = Flag.string("slug").pipe(Flag.optional, Flag.withDescription("Override the generated packet slug"));
const dateFlag = Flag.string("date").pipe(
  Flag.optional,
  Flag.withDescription("Capture date (YYYY-MM-DD) when the export filename does not carry one")
);
const branchFlag = Flag.string("branch").pipe(
  Flag.optional,
  Flag.withDescription("Override the remediation branch the packet declares")
);
const expectedCountFlag = Flag.integer("expected-count").pipe(
  Flag.optional,
  Flag.withDescription("Finding total the dashboard reported, used to fail closed on a partial export")
);
const refreshFlag = Flag.boolean("refresh").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Append unseen findings to an existing packet while preserving prior triage and CSF prose")
);

const findingsIngestCommand = Command.make(
  "ingest",
  {
    from: fromFlag,
    slug: slugFlag,
    date: dateFlag,
    branch: branchFlag,
    expectedCount: expectedCountFlag,
    refresh: refreshFlag,
    force: forceFlag("Replace an existing packet, discarding its hand-written triage prose"),
    dryRun: dryRunFlag("Report the packet that would be written without touching the filesystem"),
    json: jsonFlag,
  },
  Effect.fnUntraced(function* (flags) {
    yield* runCodexFindingsIngest({
      from: flags.from,
      slug: flags.slug,
      date: flags.date,
      branch: flags.branch,
      expectedCount: flags.expectedCount,
      refresh: flags.refresh,
      force: flags.force,
      dryRun: flags.dryRun,
      json: flags.json,
    });
  })
).pipe(Command.withDescription("Capture or refresh a goal packet from a signed-in Codex findings CSV export"));

/**
 * `beep codex findings` — capture-to-packet commands.
 *
 * **Example** (Reading the command name)
 *
 * ```ts
 * import { findingsCommand } from "@beep/repo-cli/commands/Codex/Findings.command"
 *
 * console.log(findingsCommand.name) // "findings"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const findingsCommand = Command.make("findings", {}, () =>
  printLines([
    "Codex findings commands:",
    "- bun run beep codex findings ingest --from <export.csv>",
    "- bun run beep codex findings ingest --refresh --from <full-export.csv>",
    "",
    "Export the CSV from the signed-in findings view first:",
    `  ${SOURCE_URL}`,
  ])
).pipe(
  Command.withDescription("Capture Codex Cloud security findings into a goal packet"),
  Command.withSubcommands([findingsIngestCommand])
);
