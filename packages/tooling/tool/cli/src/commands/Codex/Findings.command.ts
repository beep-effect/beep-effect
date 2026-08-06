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
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { dryRunFlag, forceFlag, jsonFlag } from "../../internal/cli/Flags.ts";
import { printJsonOrLines, printLines } from "../../internal/cli/Printer.ts";
import { writePortfolioIndex } from "../Goals/PortfolioIndex.ts";
import { CodexFindingSeverity, decodeCodexFindingsCapturePayload } from "./Findings.capture.schemas.ts";
import { decodeCodexFindingsCsv } from "./Findings.csv.ts";
import { CodexFindingsIngestError, CodexFindingsRedactionError } from "./Findings.errors.ts";
import { defaultPacketSlug, planPacket, priorIdsOfEntries } from "./Findings.normalize.ts";
import { renderPacketDocuments } from "./Findings.packet.ts";
import { describeSensitiveHits, scanSensitiveUnknown } from "./Findings.scan.ts";
import { decodeCodexTriageLedger } from "./Findings.triage.schemas.ts";
import { writePacket } from "./Findings.write.ts";

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

const encodePayload = S.encodeUnknownSync(S.fromJsonString(S.Unknown));
const parseJsonText = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

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
export const runCodexFindingsIngest = Effect.fnUntraced(function* (options: {
  readonly from: string;
  readonly slug: O.Option<string>;
  readonly date: O.Option<string>;
  readonly branch: O.Option<string>;
  readonly expectedCount: O.Option<number>;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly json: boolean;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-unreadable",
        message: "The repository root could not be located.",
      })
    )
  );

  const text = yield* fs.readFileString(options.from).pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-unreadable",
        message: "The export could not be read. Check the path passed to --from.",
      })
    )
  );

  const parsed = yield* decodeCodexFindingsCsv(text);

  const resolvedDate = O.orElse(options.date, () => captureDateFromFileName(path.basename(options.from)));
  if (O.isNone(resolvedDate)) {
    return yield* CodexFindingsIngestError.make({
      reason: "capture-date-unknown",
      message:
        "The capture date could not be read from the export filename. Pass --date YYYY-MM-DD so the packet is reproducible rather than clock-dependent.",
    });
  }
  const capturedAt = resolvedDate.value;

  const payloadInput = {
    schemaVersion: "codex-findings-capture/v1",
    capture: {
      capturedAt,
      sourceUrl: SOURCE_URL,
      repository: parsed.repository,
      findingsView: `repo-scoped, status=${A.join(A.map(parsed.statuses, Str.toLowerCase), "|")}`,
      expectedCount: O.getOrElse(options.expectedCount, () => A.length(parsed.findings)),
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

  const payload = yield* decodeCodexFindingsCapturePayload(payloadInput).pipe(
    Effect.mapError(() =>
      CodexFindingsIngestError.make({
        reason: "payload-invalid",
        message:
          "The export decoded into findings that fail the capture contract. Values are refused rather than truncated; re-export and retry.",
      })
    )
  );

  // Must match the slug planPacket will derive, or prior identifiers would be
  // read from the wrong packet; both sides go through the same helper.
  const provisionalSlug = O.getOrElse(options.slug, () => defaultPacketSlug(capturedAt));
  const priorIds = yield* readPriorIds(path.join(repoRoot, "goals", provisionalSlug));

  const plan = yield* planPacket(payload, {
    slug: O.getOrUndefined(options.slug),
    branch: O.getOrUndefined(options.branch),
    capturedAt,
    expectedCount: O.getOrUndefined(options.expectedCount),
    priorIds,
  });

  const documents = renderPacketDocuments({
    plan,
    // Report bodies are the evidence P2 validates against. They only ever reach
    // ignored `raw/reports/`; no tracked renderer accepts this shape.
    rawReports: parsed.reports,
    // Raw evidence is the normalized capture, never the export itself: the CSV
    // carries author email addresses and unsanitized report bodies.
    rawPayloadJson: `${encodePayload(payload)}\n`,
  });

  const outcome = yield* writePacket({
    repoRoot,
    slug: plan.slug,
    documents,
    dryRun: options.dryRun,
    force: options.force,
  });

  // The packet is already promoted, so a failed index regeneration must not
  // fail the ingest — but it must not be silent either, or `goals/INDEX.md`
  // goes stale while the run reports success.
  const indexRegenerated =
    options.dryRun ||
    (yield* writePortfolioIndex().pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    ));

  // Walk the severity domain rather than the counts object so the summary keeps
  // canonical most-severe-first order and omits zero-count severities.
  const severities = A.join(
    A.map(
      A.filter(CodexFindingSeverity.Options, (severity) => (plan.severityCounts[severity] ?? 0) > 0),
      (severity) => `${severity} ${plan.severityCounts[severity] ?? 0}`
    ),
    " · "
  );

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
    },
    [
      `✓ export   ${A.length(plan.records)} findings   ${severities}`,
      "✓ scan     0 rejections across payload and tracked documents",
      ...(A.isReadonlyArrayEmpty(outcome.reportedEvidence)
        ? A.empty<string>()
        : [
            `! raw      ${A.length(outcome.reportedEvidence)} report body/bodies carry sensitive-shaped text (ignored, untracked): ${A.join(outcome.reportedEvidence, ", ")}`,
          ]),
      outcome.committed
        ? `✓ packet   ${outcome.packetPath}  (${A.length(outcome.written)} files)`
        : `• dry run  ${outcome.packetPath} not written  (${A.length(outcome.written)} files planned)`,
      ...(indexRegenerated
        ? A.empty<string>()
        : ["! index    goals/INDEX.md could not be regenerated; run `beep goals index`"]),
      "",
      `Next: /goal follow the instructions in ${outcome.packetPath}/GOAL.md`,
    ]
  );
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

const findingsIngestCommand = Command.make(
  "ingest",
  {
    from: fromFlag,
    slug: slugFlag,
    date: dateFlag,
    branch: branchFlag,
    expectedCount: expectedCountFlag,
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
      force: flags.force,
      dryRun: flags.dryRun,
      json: flags.json,
    });
  })
).pipe(Command.withDescription("Bootstrap a goal packet from a signed-in Codex findings CSV export"));

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
    "",
    "Export the CSV from the signed-in findings view first:",
    `  ${SOURCE_URL}`,
  ])
).pipe(
  Command.withDescription("Capture Codex Cloud security findings into a goal packet"),
  Command.withSubcommands([findingsIngestCommand])
);
