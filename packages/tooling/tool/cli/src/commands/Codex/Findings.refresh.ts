/**
 * Preservation-safe refresh support for Codex findings packets.
 *
 * **Details**
 *
 * A refresh is an append-only reconciliation, never a packet regeneration.
 * Existing finding identities, triage judgments, lanes, and authored CSF files
 * are retained while unseen Codex identifiers receive new monotonically
 * increasing `CSF-NNN` identities. The complete reconciled packet is staged and
 * promoted atomically so an interrupted refresh cannot leave a mixed snapshot.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isPathWithinRoot, writeFileWithinCanonicalRootAtomically } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { applyJsoncModification } from "../../internal/cli/Jsonc.ts";
import { CodexFindingSeverity } from "./Findings.capture.schemas.ts";
import { CodexFindingsIngestError, CodexPacketWriteError } from "./Findings.errors.ts";
import { ordinalOfRecordId, priorIdsOfEntries, recordIdForOrdinal, severityCountsOf } from "./Findings.normalize.ts";
import {
  CodexTriageFinding,
  CodexTriageLedger,
  CodexTriageRemediation,
  CodexTriageValidation,
  decodeCodexTriageLedger,
} from "./Findings.triage.schemas.ts";
import { assertPacketDocumentsClean, PacketDocument } from "./Findings.write.ts";
import type { CodexFindingRecord, CodexPacketPlan } from "./Findings.schemas.ts";
import type { CodexDisposition } from "./Findings.triage.schemas.ts";

const $I = $RepoCliId.create("commands/Codex/Findings.refresh");
const encoder = new TextEncoder();
const parseJsonText = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeTriageFinding = S.encodeUnknownEffect(CodexTriageFinding);

const RefreshManifestInitiative = S.Struct({ id: S.String, status: S.String }).pipe(
  $I.annoteSchema("RefreshManifestInitiative", {
    description: "Existing initiative identity and lifecycle status required by refresh.",
  })
);
const RefreshManifestCompletionGate = S.Struct({ statement: S.String }).pipe(
  $I.annoteSchema("RefreshManifestCompletionGate", {
    description: "Existing completion statement whose captured count is reconciled.",
  })
);
const RefreshManifestSource = S.Struct({ repository: S.String, capturedAt: S.String }).pipe(
  $I.annoteSchema("RefreshManifestSource", {
    description: "Existing packet capture provenance checked against the incoming snapshot.",
  })
);
const RefreshManifestDispositionCounts = S.Struct({
  remediate: S.Int,
  "already-fixed": S.Int,
  "false-positive": S.Int,
  "out-of-scope": S.Int,
  untriaged: S.Int,
}).pipe(
  $I.annoteSchema("RefreshManifestDispositionCounts", {
    description: "Existing packet disposition totals reconciled against the triage ledger.",
  })
);
const RefreshManifestCatalog = S.Struct({
  expectedCount: S.Int,
  capturedCount: S.Int,
  severityCounts: S.Record(S.String, S.Int),
  dispositionCounts: RefreshManifestDispositionCounts,
  note: S.String,
}).pipe(
  $I.annoteSchema("RefreshManifestCatalog", {
    description: "Existing machine-owned manifest catalog fields updated by refresh.",
  })
);
const RefreshManifestPhase = S.Struct({ id: S.String, status: S.String }).pipe(
  $I.annoteSchema("RefreshManifestPhase", {
    description: "Existing packet phase identity and status.",
  })
);
const RefreshManifest = S.Struct({
  schemaVersion: S.Literal("initiative-manifest/v2"),
  initiative: RefreshManifestInitiative,
  mission: S.String,
  completionGate: RefreshManifestCompletionGate,
  branch: S.String,
  source: RefreshManifestSource,
  catalog: RefreshManifestCatalog,
  phases: S.Array(RefreshManifestPhase),
  verificationCommands: S.Array(S.String),
  statusNote: S.optionalKey(S.String),
}).pipe(
  $I.annoteSchema("RefreshManifest", {
    description: "Manifest fields required for a preservation-safe Codex packet refresh.",
  })
);

const decodeRefreshManifest = S.decodeUnknownEffect(RefreshManifest);

class PacketSnapshotFile extends S.Class<PacketSnapshotFile>($I`PacketSnapshotFile`)(
  {
    path: S.String,
    contents: S.String,
  },
  $I.annote("PacketSnapshotFile", {
    description: "One regular text file in an existing Codex findings packet snapshot.",
  })
) {}

/**
 * Existing ledger material used to preserve stable identities while planning.
 *
 * **Example** (Inspect the source model)
 *
 * ```ts
 * import { CodexRefreshLedgerSource } from "@beep/repo-cli/test/Codex"
 *
 * console.log(typeof CodexRefreshLedgerSource.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodexRefreshLedgerSource extends S.Class<CodexRefreshLedgerSource>($I`CodexRefreshLedgerSource`)(
  {
    contents: S.String,
    ledger: CodexTriageLedger,
  },
  $I.annote("CodexRefreshLedgerSource", {
    description: "Decoded existing ledger plus its original bytes for refresh concurrency checks.",
  })
) {}

/**
 * Machine-readable result of an append-only packet reconciliation.
 *
 * **Example** (Describe a no-op refresh)
 *
 * ```ts
 * import { CodexFindingsRefreshReconciliation } from "@beep/repo-cli/test/Codex"
 *
 * const result = CodexFindingsRefreshReconciliation.make({
 *   status: "no-new-findings",
 *   priorCount: 2,
 *   capturedCount: 2,
 *   preservedIds: ["CSF-001", "CSF-002"],
 *   appendedIds: [],
 *   updatedPaths: [],
 * })
 *
 * console.log(result.status) // "no-new-findings"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodexFindingsRefreshReconciliation extends S.Class<CodexFindingsRefreshReconciliation>(
  $I`CodexFindingsRefreshReconciliation`
)(
  {
    status: S.Literals(["updated", "no-new-findings"]),
    priorCount: S.Int,
    capturedCount: S.Int,
    preservedIds: S.Array(S.String),
    appendedIds: S.Array(S.String),
    updatedPaths: S.Array(S.String),
  },
  $I.annote("CodexFindingsRefreshReconciliation", {
    description: "Observable result of preserving prior packet work and appending unseen findings.",
  })
) {}

const ingestFailure = (
  reason:
    | "ledger-unreadable"
    | "mode-conflict"
    | "packet-missing"
    | "refresh-identity-drift"
    | "refresh-metadata-drift"
    | "refresh-packet-unreadable"
    | "refresh-removal",
  message: string,
  cause?: unknown
): CodexFindingsIngestError =>
  cause === undefined
    ? CodexFindingsIngestError.make({ reason, message })
    : CodexFindingsIngestError.make({ reason, message, cause });

const packetFailure = (
  reason: "commit-failed" | "packet-changed" | "path-escape" | "staging-failed",
  message: string,
  cause?: unknown
): CodexPacketWriteError =>
  cause === undefined
    ? CodexPacketWriteError.make({ reason, message })
    : CodexPacketWriteError.make({ reason, message, cause });

const valuesAreUnique = (values: ReadonlyArray<string>): boolean => A.length(A.dedupe(values)) === A.length(values);

const validateLedgerIdentityBijection = Effect.fnUntraced(function* (
  findings: ReadonlyArray<{ readonly id: string; readonly codexId: string }>
) {
  if (!valuesAreUnique(A.map(findings, (finding) => finding.id))) {
    return yield* ingestFailure(
      "refresh-identity-drift",
      "The existing triage ledger assigns one CSF identity more than once. Repair the ledger before refreshing."
    );
  }
  if (!valuesAreUnique(A.map(findings, (finding) => finding.codexId))) {
    return yield* ingestFailure(
      "refresh-identity-drift",
      "The existing triage ledger assigns one Codex identity more than once. Repair the ledger before refreshing."
    );
  }
});

/**
 * Reject destructive ingest-mode combinations before any capture is read.
 *
 * **Example** (Observe a mode conflict)
 *
 * ```ts
 * import { validateCodexFindingsIngestModes } from "@beep/repo-cli/test/Codex"
 * import { Effect } from "effect"
 *
 * const result = validateCodexFindingsIngestModes({ force: true, refresh: true }).pipe(
 *   Effect.as("accepted"),
 *   Effect.orElseSucceed(() => "conflict")
 * )
 *
 * console.log(Effect.runSync(result)) // "conflict"
 * ```
 *
 * @param options - The two existing-packet modes accepted by ingest.
 * @returns A void effect that fails when both modes were selected.
 * @effects Fails with a typed ingest error on a mode conflict; performs no I/O.
 * @category validation
 * @since 0.0.0
 */
export const validateCodexFindingsIngestModes = Effect.fnUntraced(function* (options: {
  readonly force: boolean;
  readonly refresh: boolean;
}) {
  if (options.force && options.refresh) {
    return yield* ingestFailure(
      "mode-conflict",
      "--refresh preserves an existing packet while --force replaces it; choose exactly one existing-packet mode."
    );
  }
});

const ensurePacketDirectory = Effect.fnUntraced(function* (repoRoot: string, slug: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalRoot = yield* fs
    .realPath(repoRoot)
    .pipe(
      Effect.mapError((cause) => packetFailure("path-escape", "The repository root could not be canonicalized.", cause))
    );
  const packetDir = path.join(canonicalRoot, "goals", slug);
  const packetExists = yield* fs
    .exists(packetDir)
    .pipe(
      Effect.mapError((cause) => packetFailure("staging-failed", "The existing packet could not be inspected.", cause))
    );
  if (!packetExists) {
    return yield* ingestFailure(
      "packet-missing",
      `goals/${slug} does not exist. --refresh requires a previously captured, decodable packet.`
    );
  }
  const info = yield* fs
    .stat(packetDir)
    .pipe(
      Effect.mapError((cause) => packetFailure("staging-failed", "The existing packet could not be inspected.", cause))
    );
  if (info.type !== "Directory") {
    return yield* ingestFailure("packet-missing", `goals/${slug} is not a packet directory and cannot be refreshed.`);
  }
  const canonicalPacketDir = yield* fs
    .realPath(packetDir)
    .pipe(
      Effect.mapError((cause) => packetFailure("path-escape", "The existing packet could not be canonicalized.", cause))
    );
  if (!isPathWithinRoot(path.join(canonicalRoot, "goals"), canonicalPacketDir)) {
    return yield* packetFailure("path-escape", "The existing packet resolves outside goals/ and cannot be refreshed.");
  }
  return { canonicalPacketDir, canonicalRoot, packetDir };
});

/**
 * Read and validate the existing ledger before sticky identifiers are planned.
 *
 * **Example** (Build the ledger read effect)
 *
 * ```ts
 * import { loadCodexRefreshLedgerSource } from "@beep/repo-cli/test/Codex"
 * import { Effect } from "effect"
 *
 * const source = loadCodexRefreshLedgerSource({ repoRoot: ".", slug: "codex-security-findings-2026-08-04" })
 *
 * console.log(Effect.isEffect(source)) // true
 * ```
 *
 * @param options - Repository root and packet slug selected by ingest.
 * @returns The decoded ledger and its exact source text.
 * @effects Reads and canonicalizes the existing packet directory and triage ledger.
 * @category use-cases
 * @since 0.0.0
 */
export const loadCodexRefreshLedgerSource = Effect.fnUntraced(function* (options: {
  readonly repoRoot: string;
  readonly slug: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { packetDir } = yield* ensurePacketDirectory(options.repoRoot, options.slug);
  const ledgerPath = path.join(packetDir, "ops", "triage.json");
  const contents = yield* fs
    .readFileString(ledgerPath)
    .pipe(
      Effect.mapError((cause) =>
        ingestFailure(
          "ledger-unreadable",
          "The existing ops/triage.json could not be read. Repair it before refreshing.",
          cause
        )
      )
    );
  const ledger = yield* parseJsonText(contents).pipe(
    Effect.flatMap(decodeCodexTriageLedger),
    Effect.mapError((cause) =>
      ingestFailure(
        "ledger-unreadable",
        "The existing ops/triage.json does not decode as codex-triage/v1. Repair it before refreshing.",
        cause
      )
    )
  );
  yield* validateLedgerIdentityBijection(ledger.findings);
  if (ledger.meta.expectedCount !== ledger.findings.length || ledger.meta.capturedCount !== ledger.findings.length) {
    return yield* ingestFailure(
      "refresh-metadata-drift",
      "The existing triage ledger counts do not equal its finding entries. Reconcile the packet before refreshing."
    );
  }
  return CodexRefreshLedgerSource.make({ contents, ledger });
});

const readPacketSnapshot = Effect.fnUntraced(function* (packetDir: string, canonicalPacketDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(packetDir, { recursive: true })
    .pipe(
      Effect.mapError((cause) => packetFailure("staging-failed", "The existing packet could not be listed.", cause))
    );
  const files: Array<PacketSnapshotFile> = [];
  for (const relativePath of A.sort(entries, Order.String)) {
    const candidate = path.join(packetDir, relativePath);
    const info = yield* fs
      .stat(candidate)
      .pipe(
        Effect.mapError((cause) =>
          packetFailure("staging-failed", "An existing packet entry could not be read.", cause)
        )
      );
    if (info.type === "Directory") {
      continue;
    }
    if (info.type !== "File") {
      return yield* packetFailure(
        "path-escape",
        "The existing packet contains a non-file entry and cannot be refreshed."
      );
    }
    const canonicalFile = yield* fs
      .realPath(candidate)
      .pipe(
        Effect.mapError((cause) =>
          packetFailure("path-escape", "An existing packet file could not be canonicalized.", cause)
        )
      );
    if (!isPathWithinRoot(canonicalPacketDir, canonicalFile)) {
      return yield* packetFailure("path-escape", "An existing packet file resolves outside the packet.");
    }
    const contents = yield* fs
      .readFileString(candidate)
      .pipe(
        Effect.mapError((cause) => packetFailure("staging-failed", "An existing packet file could not be read.", cause))
      );
    files.push(PacketSnapshotFile.make({ path: relativePath, contents }));
  }
  return files;
});

const snapshotFile = (files: ReadonlyArray<PacketSnapshotFile>, relativePath: string): O.Option<PacketSnapshotFile> =>
  A.findFirst(files, (file) => Str.equivalence(file.path, relativePath));

const requireSnapshotFile = Effect.fnUntraced(function* (
  files: ReadonlyArray<PacketSnapshotFile>,
  relativePath: string
) {
  const file = snapshotFile(files, relativePath);
  if (O.isNone(file)) {
    return yield* ingestFailure(
      "refresh-packet-unreadable",
      `The existing packet is missing ${relativePath}; refresh requires a complete packet.`
    );
  }
  return file.value;
});

const upsertSnapshotFile = (
  files: ReadonlyArray<PacketSnapshotFile>,
  file: PacketSnapshotFile
): ReadonlyArray<PacketSnapshotFile> =>
  pipe(
    A.filter(files, (existing) => !Str.equivalence(existing.path, file.path)),
    A.append(file),
    A.sort(Order.mapInput(Order.String, (entry: PacketSnapshotFile) => entry.path))
  );

const snapshotsAreEqual = (
  left: ReadonlyArray<PacketSnapshotFile>,
  right: ReadonlyArray<PacketSnapshotFile>
): boolean =>
  left.length === right.length &&
  A.every(left, (file, index) => {
    const other = right[index];
    return (
      other !== undefined && Str.equivalence(file.path, other.path) && Str.equivalence(file.contents, other.contents)
    );
  });

const severityPhrase = (records: ReadonlyArray<{ readonly severity: CodexFindingSeverity }>): string => {
  const counts = severityCountsOf(records);
  return A.join(
    A.map(
      A.filter(CodexFindingSeverity.Options, (severity) => (counts[severity] ?? 0) > 0),
      (severity) => `${counts[severity] ?? 0} ${severity}`
    ),
    ", "
  );
};

const refreshSummary = (priorCount: number, appendedCount: number): string =>
  `Refresh capture: the original ${priorCount} records retain their prior triage and proof; ${appendedCount} newly captured record(s) await P2 validation and P3 lane assignment.`;

const stripRefreshSummary = Str.replace(
  /\s*Refresh capture: the original \d+ records retain their prior triage and proof; \d+ newly captured record\(s\) await P2 validation and P3 lane assignment\.$/u,
  ""
);

const appendRefreshSummary = (existing: string, priorCount: number, appendedCount: number): string =>
  `${stripRefreshSummary(existing)} ${refreshSummary(priorCount, appendedCount)}`;

const replaceCountTruth = (
  text: string,
  priorCount: number,
  capturedCount: number,
  priorSeverity: string,
  capturedSeverity: string
): string =>
  pipe(
    text,
    Str.replaceAll(`${priorCount}-finding batch`, `${capturedCount}-finding batch`),
    Str.replaceAll(
      `the ${priorCount} Codex Cloud security findings`,
      `the ${capturedCount} Codex Cloud security findings`
    ),
    Str.replaceAll(`exact ${priorCount}-ID allowlist`, `exact ${capturedCount}-ID allowlist`),
    Str.replaceAll(`All ${priorCount} captured Codex findings`, `All ${capturedCount} captured Codex findings`),
    Str.replaceAll(`All ${priorCount} findings have`, `All ${capturedCount} findings have`),
    Str.replaceAll(`CSF file count equals ${priorCount}`, `CSF file count equals ${capturedCount}`),
    Str.replaceAll(priorSeverity, capturedSeverity),
    Str.replaceAll(`all ${priorCount} findings are validated`, `the original ${priorCount} findings are validated`),
    Str.replaceAll(`P2/P3 are complete`, `P2/P3 were complete for the original ${priorCount}-finding snapshot`)
  );

const managedRefreshBlock = (priorCount: number, appendedCount: number): string =>
  `<!-- codex-findings-refresh:start -->\n${refreshSummary(priorCount, appendedCount)}\n<!-- codex-findings-refresh:end -->`;

const upsertManagedRefreshBlock = (
  text: string,
  heading: string,
  priorCount: number,
  appendedCount: number
): string => {
  const block = managedRefreshBlock(priorCount, appendedCount);
  const existing = /<!-- codex-findings-refresh:start -->[\s\S]*?<!-- codex-findings-refresh:end -->/u;
  if (existing.test(text)) {
    return Str.replace(existing, block)(text);
  }
  const anchor = `${heading}\n\n`;
  return Str.includes(anchor)(text) ? Str.replace(anchor, `${anchor}${block}\n\n`)(text) : `${text}\n${block}\n`;
};

const mergeManagedPacketDocument = (
  text: string,
  heading: string,
  priorCount: number,
  capturedCount: number,
  appendedCount: number,
  priorSeverity: string,
  capturedSeverity: string
): string =>
  upsertManagedRefreshBlock(
    replaceCountTruth(text, priorCount, capturedCount, priorSeverity, capturedSeverity),
    heading,
    priorCount,
    appendedCount
  );

const mergeSpec = (
  text: string,
  priorCount: number,
  capturedCount: number,
  priorSeverity: string,
  capturedSeverity: string
): string => replaceCountTruth(text, priorCount, capturedCount, priorSeverity, capturedSeverity);

const mergePlan = (
  text: string,
  plan: CodexPacketPlan,
  priorCount: number,
  appendedCount: number,
  priorSeverity: string,
  capturedSeverity: string
): string => {
  const capturedCount = plan.records.length;
  const rows = Str.split("\n")(replaceCountTruth(text, priorCount, capturedCount, priorSeverity, capturedSeverity));
  return A.join(
    A.map(rows, (line) => {
      if (Str.startsWith("| P1 capture")(line)) {
        return `| P1 capture | complete | Capture the full signed-in CSV snapshot. | ${capturedCount} IDs reconcile: ${capturedSeverity}. |`;
      }
      if (Str.startsWith("| P2 validate")(line)) {
        return `| P2 validate | in-progress | Validate newly captured reports at current HEAD. | ${priorCount}/${capturedCount} retain prior triage; ${appendedCount} await verdict and disposition. |`;
      }
      if (Str.startsWith("| P3 lane-partition")(line)) {
        return `| P3 lane-partition | in-progress | Assign newly captured findings to disjoint root-cause lanes. | Existing lanes stay intact; ${appendedCount} new finding(s) await assignment. |`;
      }
      if (Str.startsWith("| P8 merge-and-close")(line)) {
        return `| P8 merge-and-close | pending | Merge and close captured findings. | PR merged; all ${capturedCount} IDs resolved. |`;
      }
      return Str.replaceAll(`" = ${priorCount}`, `" = ${capturedCount}`)(line);
    }),
    "\n"
  );
};

const mergeSources = (text: string, priorCount: number, capturedCount: number): string =>
  Str.replaceAll(`supplied the ${priorCount}-record`, `supplied the ${capturedCount}-record full-snapshot`)(text);

const dispositionCountsOf = (findings: ReadonlyArray<{ readonly disposition: CodexDisposition }>) => ({
  remediate: A.length(A.filter(findings, (finding) => finding.disposition === "remediate")),
  "already-fixed": A.length(A.filter(findings, (finding) => finding.disposition === "already-fixed")),
  "false-positive": A.length(A.filter(findings, (finding) => finding.disposition === "false-positive")),
  "out-of-scope": A.length(A.filter(findings, (finding) => finding.disposition === "out-of-scope")),
  untriaged: A.length(A.filter(findings, (finding) => finding.disposition === "untriaged")),
});

const severityCountsEqual = (
  left: Readonly<Record<string, number>>,
  right: ReturnType<typeof severityCountsOf>
): boolean => A.every(CodexFindingSeverity.Options, (severity) => (left[severity] ?? 0) === (right[severity] ?? 0));

const dispositionCountsEqual = (
  left: ReturnType<typeof dispositionCountsOf>,
  right: ReturnType<typeof dispositionCountsOf>
): boolean =>
  left.remediate === right.remediate &&
  left["already-fixed"] === right["already-fixed"] &&
  left["false-positive"] === right["false-positive"] &&
  left["out-of-scope"] === right["out-of-scope"] &&
  left.untriaged === right.untriaged;

const validateManifestCatalog = Effect.fnUntraced(function* (
  manifest: typeof RefreshManifest.Type,
  ledger: CodexTriageLedger
) {
  const priorCount = ledger.findings.length;
  const priorSeverityCounts = severityCountsOf(ledger.findings);
  const priorDispositionCounts = dispositionCountsOf(ledger.findings);
  if (
    manifest.catalog.expectedCount !== priorCount ||
    manifest.catalog.capturedCount !== priorCount ||
    !severityCountsEqual(manifest.catalog.severityCounts, priorSeverityCounts) ||
    !dispositionCountsEqual(manifest.catalog.dispositionCounts, priorDispositionCounts)
  ) {
    return yield* ingestFailure(
      "refresh-metadata-drift",
      "The existing manifest catalog does not reconcile with the triage ledger. Repair packet counts before refreshing."
    );
  }
});

const validateManifestProvenance = Effect.fnUntraced(function* (
  manifest: typeof RefreshManifest.Type,
  plan: CodexPacketPlan
) {
  if (
    !Str.equivalence(manifest.initiative.id, plan.slug) ||
    !Str.equivalence(manifest.branch, plan.branch) ||
    !Str.equivalence(manifest.source.repository, plan.repository) ||
    !Str.equivalence(manifest.source.capturedAt, plan.capturedAt)
  ) {
    return yield* ingestFailure(
      "refresh-metadata-drift",
      "The existing manifest provenance does not match the incoming full snapshot."
    );
  }
});

const reopenManifestPhases = Effect.fnUntraced(function* (
  text: string,
  phases: (typeof RefreshManifest.Type)["phases"]
) {
  let merged = text;
  for (const phaseId of ["P2", "P3"]) {
    const index = A.findFirstIndex(phases, (phase) => phase.id === phaseId);
    if (O.isNone(index)) {
      return yield* ingestFailure(
        "refresh-packet-unreadable",
        `The existing manifest is missing ${phaseId}; refresh cannot reopen validation safely.`
      );
    }
    merged = applyJsoncModification({
      content: merged,
      path: ["phases", index.value, "status"],
      value: "in-progress",
    });
  }
  return merged;
});

const mergeManifest = Effect.fnUntraced(function* (
  text: string,
  plan: CodexPacketPlan,
  ledger: CodexTriageLedger,
  appendedCount: number
) {
  const parsed = yield* parseJsonText(text).pipe(
    Effect.flatMap(decodeRefreshManifest),
    Effect.mapError((cause) =>
      ingestFailure(
        "refresh-packet-unreadable",
        "The existing ops/manifest.json does not decode as the refreshable initiative-manifest/v2 shape.",
        cause
      )
    )
  );
  yield* validateManifestCatalog(parsed, ledger);
  yield* validateManifestProvenance(parsed, plan);
  const priorCount = ledger.findings.length;
  const priorDispositionCounts = dispositionCountsOf(ledger.findings);
  const capturedCount = plan.records.length;
  const dispositionCounts = { ...priorDispositionCounts, untriaged: priorDispositionCounts.untriaged + appendedCount };
  let merged = text;
  const modify = (path: ReadonlyArray<string | number>, value: unknown): void => {
    merged = applyJsoncModification({ content: merged, path, value });
  };
  modify(["mission"], Str.replace(`the ${priorCount} Codex`, `the ${capturedCount} Codex`)(parsed.mission));
  modify(
    ["completionGate", "statement"],
    Str.replace(`exact ${priorCount} Codex`, `exact ${capturedCount} Codex`)(parsed.completionGate.statement)
  );
  modify(["catalog", "expectedCount"], capturedCount);
  modify(["catalog", "capturedCount"], capturedCount);
  modify(["catalog", "severityCounts"], plan.severityCounts);
  modify(["catalog", "dispositionCounts"], dispositionCounts);
  modify(["catalog", "note"], appendRefreshSummary(parsed.catalog.note, priorCount, appendedCount));
  if (parsed.statusNote !== undefined) {
    modify(["statusNote"], appendRefreshSummary(parsed.statusNote, priorCount, appendedCount));
  }
  merged = yield* reopenManifestPhases(merged, parsed.phases);
  modify(
    ["verificationCommands"],
    A.map(parsed.verificationCommands, (command) =>
      Str.replaceAll(`" = ${priorCount}`, `" = ${capturedCount}`)(command)
    )
  );
  return merged;
});

const pendingTriageFinding = (record: CodexFindingRecord): CodexTriageFinding =>
  CodexTriageFinding.make({
    id: record.id,
    codexId: record.codexId,
    title: record.title,
    severity: record.severity,
    codexStatus: record.codexStatus,
    commit: record.commit,
    disposition: "untriaged",
    validation: CodexTriageValidation.make({ status: "pending" }),
    remediation: CodexTriageRemediation.make({ status: "pending", changedFiles: [], verificationCommands: [] }),
  });

const mergeTriage = Effect.fnUntraced(function* (
  text: string,
  ledger: CodexTriageLedger,
  plan: CodexPacketPlan,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  let merged = text;
  const modify = (path: ReadonlyArray<string | number>, value: unknown, isArrayInsertion = false): void => {
    merged = applyJsoncModification({
      content: merged,
      path,
      value,
      ...(isArrayInsertion ? { isArrayInsertion: true } : {}),
    });
  };
  modify(["meta", "expectedCount"], plan.records.length);
  modify(["meta", "capturedCount"], plan.records.length);
  if (ledger.meta.note !== undefined) {
    modify(["meta", "note"], appendRefreshSummary(ledger.meta.note, ledger.findings.length, appended.length));
  }
  for (let offset = 0; offset < appended.length; offset += 1) {
    const record = appended[offset];
    if (record === undefined) {
      continue;
    }
    const encoded = yield* encodeTriageFinding(pendingTriageFinding(record)).pipe(
      Effect.mapError((cause) =>
        ingestFailure(
          "refresh-packet-unreadable",
          `The generated ${record.id} triage entry could not be encoded.`,
          cause
        )
      )
    );
    modify(["findings", ledger.findings.length + offset], encoded, true);
  }
  return merged;
});

const validatePublishedIndexRows = Effect.fnUntraced(function* (
  text: string,
  prior: ReadonlyArray<{ readonly id: string }>
) {
  for (const finding of prior) {
    if (!Str.includes(`[${finding.id}]`)(text)) {
      return yield* ingestFailure(
        "refresh-packet-unreadable",
        `findings/INDEX.md is missing the published ${finding.id} row; repair the index before refreshing.`
      );
    }
  }
});

const mergeIndexSeverityRows = (text: string, plan: CodexPacketPlan): string => {
  let merged = text;
  for (const severity of CodexFindingSeverity.Options) {
    const count = plan.severityCounts[severity] ?? 0;
    const row = new RegExp(`\\| ${severity} \\| \\d+ \\|`, "u");
    if (row.test(merged)) {
      merged = Str.replace(row, `| ${severity} | ${count} |`)(merged);
    } else if (count > 0) {
      merged = Str.replace("| --- | ---: |", `| --- | ---: |\n| ${severity} | ${count} |`)(merged);
    }
  }
  return merged;
};

const generatedIndexRows = Effect.fnUntraced(function* (
  generated: string,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  const generatedLines = Str.split("\n")(generated);
  const rows: Array<string> = [];
  for (const record of appended) {
    const generatedRow = A.findFirst(generatedLines, (line) => Str.includes(`[${record.id}]`)(line));
    if (O.isNone(generatedRow)) {
      return yield* ingestFailure(
        "refresh-packet-unreadable",
        `The generated evidence set is missing the ${record.id} index row.`
      );
    }
    rows.push(generatedRow.value);
  }
  return rows;
});

const appendIndexRows = Effect.fnUntraced(function* (text: string, rows: ReadonlyArray<string>) {
  if (A.isReadonlyArrayEmpty(rows)) {
    return text;
  }
  const anchor = Str.includes("\n\n## Current Remediation State")(text)
    ? "\n\n## Current Remediation State"
    : "\n\n## Closeout Mapping";
  if (!Str.includes(anchor)(text)) {
    return yield* ingestFailure(
      "refresh-packet-unreadable",
      "findings/INDEX.md has no stable section after its findings table."
    );
  }
  return Str.replace(anchor, `\n${A.join(rows, "\n")}${anchor}`)(text);
});

const mergeFindingsIndex = Effect.fnUntraced(function* (
  text: string,
  generated: string,
  plan: CodexPacketPlan,
  prior: ReadonlyArray<{ readonly id: string }>,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  yield* validatePublishedIndexRows(text, prior);
  const rows = yield* generatedIndexRows(generated, appended);
  const merged = yield* appendIndexRows(mergeIndexSeverityRows(text, plan), rows);
  return upsertManagedRefreshBlock(merged, "## Current Remediation State", prior.length, appended.length);
});

const validateRefreshSnapshotCount = Effect.fnUntraced(function* (plan: CodexPacketPlan) {
  if (plan.expectedCount !== plan.records.length) {
    return yield* ingestFailure(
      "refresh-metadata-drift",
      "A refresh requires an exact full snapshot: expectedCount must equal the decoded finding count."
    );
  }
});

const validateRefreshProvenance = Effect.fnUntraced(function* (
  plan: CodexPacketPlan,
  source: CodexRefreshLedgerSource
) {
  if (
    !Str.equivalence(source.ledger.meta.repository, plan.repository) ||
    !Str.equivalence(source.ledger.meta.capturedAt, plan.capturedAt) ||
    !Str.equivalence(source.ledger.meta.branch, plan.branch) ||
    !Str.equivalence(source.ledger.meta.findingsView, plan.findingsView)
  ) {
    return yield* ingestFailure(
      "refresh-metadata-drift",
      "The incoming snapshot provenance does not match the existing packet. Use the same repository, date, branch, and findings view."
    );
  }
});

const findingCaptureIsStable = (incoming: CodexFindingRecord, existing: CodexTriageFinding): boolean =>
  Str.equivalence(incoming.id, existing.id) &&
  Str.equivalence(incoming.title, existing.title) &&
  Str.equivalence(incoming.severity, existing.severity) &&
  Str.equivalence(incoming.codexStatus, existing.codexStatus) &&
  Str.equivalence(incoming.commit, existing.commit);

const validatePublishedFindings = Effect.fnUntraced(function* (
  incomingRecords: ReadonlyArray<CodexFindingRecord>,
  prior: ReadonlyArray<CodexTriageFinding>
) {
  for (const existing of prior) {
    const incoming = A.findFirst(incomingRecords, (record) => Str.equivalence(record.codexId, existing.codexId));
    if (O.isNone(incoming)) {
      return yield* ingestFailure(
        "refresh-removal",
        "The incoming snapshot removes at least one previously captured Codex identity. Refresh accepts full supersets only."
      );
    }
    if (!findingCaptureIsStable(incoming.value, existing)) {
      return yield* ingestFailure(
        "refresh-identity-drift",
        "A previously captured Codex identity changed its stable CSF binding or captured metadata. Refresh refuses identity drift."
      );
    }
  }
});

const validateAppendedOrdinals = Effect.fnUntraced(function* (
  appended: ReadonlyArray<CodexFindingRecord>,
  prior: ReadonlyArray<CodexTriageFinding>
) {
  const highestReserved = A.reduce(prior, 0, (highest, finding) =>
    Math.max(
      highest,
      O.getOrElse(ordinalOfRecordId(finding.id), () => 0)
    )
  );
  if (
    !A.every(appended, (record, offset) => Str.equivalence(record.id, recordIdForOrdinal(highestReserved + offset + 1)))
  ) {
    return yield* ingestFailure(
      "refresh-identity-drift",
      "A new finding would reuse or skip a reserved CSF ordinal. New identities must append after the highest published ordinal."
    );
  }
});

const validateReconciliation = Effect.fnUntraced(function* (plan: CodexPacketPlan, source: CodexRefreshLedgerSource) {
  const prior = source.ledger.findings;
  yield* validateRefreshSnapshotCount(plan);
  yield* validateRefreshProvenance(plan, source);
  yield* validatePublishedFindings(plan.records, prior);
  const priorCodexIds = A.map(prior, (finding) => finding.codexId);
  const appended = A.filter(plan.records, (record) => !A.contains(priorCodexIds, record.codexId));
  yield* validateAppendedOrdinals(appended, prior);
  return appended;
});

const documentsForScan = (files: ReadonlyArray<PacketSnapshotFile>): ReadonlyArray<PacketDocument> =>
  A.map(files, (file) =>
    PacketDocument.make({
      path: file.path,
      contents: file.contents,
      tracked: !Str.startsWith("raw/")(file.path) || Str.equivalence(file.path, "raw/.gitignore"),
      scan: Str.startsWith("raw/reports/")(file.path) ? "report" : "reject",
    })
  );

const requireGeneratedDocument = Effect.fnUntraced(function* (
  documents: ReadonlyArray<PacketDocument>,
  relativePath: string
) {
  const document = A.findFirst(documents, (candidate) => Str.equivalence(candidate.path, relativePath));
  if (O.isNone(document)) {
    return yield* ingestFailure("refresh-packet-unreadable", `The generated evidence set is missing ${relativePath}.`);
  }
  return document.value;
});

const mergeSnapshotTextFile = Effect.fnUntraced(function* (
  files: ReadonlyArray<PacketSnapshotFile>,
  relativePath: string,
  merge: (contents: string) => Effect.Effect<string, CodexFindingsIngestError>
) {
  const existing = yield* requireSnapshotFile(files, relativePath);
  const contents = yield* merge(existing.contents);
  return upsertSnapshotFile(files, PacketSnapshotFile.make({ path: relativePath, contents }));
});

const mergePacketMarkdownDocuments = Effect.fnUntraced(function* (
  files: ReadonlyArray<PacketSnapshotFile>,
  plan: CodexPacketPlan,
  priorCount: number,
  appendedCount: number,
  priorSeverity: string,
  capturedSeverity: string
) {
  const capturedCount = plan.records.length;
  let merged = yield* mergeSnapshotTextFile(files, "README.md", (contents) =>
    Effect.succeed(
      mergeManagedPacketDocument(
        contents,
        "## Current Phase",
        priorCount,
        capturedCount,
        appendedCount,
        priorSeverity,
        capturedSeverity
      )
    )
  );
  merged = yield* mergeSnapshotTextFile(merged, "GOAL.md", (contents) =>
    Effect.succeed(
      mergeManagedPacketDocument(
        contents,
        "Rules:",
        priorCount,
        capturedCount,
        appendedCount,
        priorSeverity,
        capturedSeverity
      )
    )
  );
  merged = yield* mergeSnapshotTextFile(merged, "SPEC.md", (contents) =>
    Effect.succeed(mergeSpec(contents, priorCount, capturedCount, priorSeverity, capturedSeverity))
  );
  merged = yield* mergeSnapshotTextFile(merged, "PLAN.md", (contents) =>
    Effect.succeed(mergePlan(contents, plan, priorCount, appendedCount, priorSeverity, capturedSeverity))
  );
  return yield* mergeSnapshotTextFile(merged, "research/SOURCES.md", (contents) =>
    Effect.succeed(mergeSources(contents, priorCount, capturedCount))
  );
});

const mergePacketStateDocuments = Effect.fnUntraced(function* (
  files: ReadonlyArray<PacketSnapshotFile>,
  generatedIndex: PacketDocument,
  plan: CodexPacketPlan,
  ledger: CodexTriageLedger,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  let merged = yield* mergeSnapshotTextFile(files, "ops/manifest.json", (contents) =>
    mergeManifest(contents, plan, ledger, appended.length)
  );
  merged = yield* mergeSnapshotTextFile(merged, "ops/triage.json", (contents) =>
    mergeTriage(contents, ledger, plan, appended)
  );
  return yield* mergeSnapshotTextFile(merged, "findings/INDEX.md", (contents) =>
    mergeFindingsIndex(contents, generatedIndex.contents, plan, ledger.findings, appended)
  );
});

const appendGeneratedFindingDocuments = Effect.fnUntraced(function* (
  files: ReadonlyArray<PacketSnapshotFile>,
  original: ReadonlyArray<PacketSnapshotFile>,
  documents: ReadonlyArray<PacketDocument>,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  let merged = files;
  for (const record of appended) {
    const relativePath = `findings/${record.id}.md`;
    if (O.isSome(snapshotFile(original, relativePath))) {
      return yield* ingestFailure(
        "refresh-identity-drift",
        `The reserved path ${relativePath} already exists without a matching ledger identity.`
      );
    }
    const generated = yield* requireGeneratedDocument(documents, relativePath);
    merged = upsertSnapshotFile(
      merged,
      PacketSnapshotFile.make({ path: generated.path, contents: generated.contents })
    );
  }
  return merged;
});

const mergeAppendedPacketFiles = Effect.fnUntraced(function* (
  original: ReadonlyArray<PacketSnapshotFile>,
  documents: ReadonlyArray<PacketDocument>,
  plan: CodexPacketPlan,
  source: CodexRefreshLedgerSource,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  const generatedIndex = yield* requireGeneratedDocument(documents, "findings/INDEX.md");
  const priorCount = source.ledger.findings.length;
  const priorSeverity = severityPhrase(source.ledger.findings);
  const capturedSeverity = severityPhrase(plan.records);
  const markdown = yield* mergePacketMarkdownDocuments(
    original,
    plan,
    priorCount,
    appended.length,
    priorSeverity,
    capturedSeverity
  );
  const state = yield* mergePacketStateDocuments(markdown, generatedIndex, plan, source.ledger, appended);
  return yield* appendGeneratedFindingDocuments(state, original, documents, appended);
});

const mergeRefreshPacketFiles = Effect.fnUntraced(function* (
  original: ReadonlyArray<PacketSnapshotFile>,
  documents: ReadonlyArray<PacketDocument>,
  plan: CodexPacketPlan,
  source: CodexRefreshLedgerSource,
  appended: ReadonlyArray<CodexFindingRecord>
) {
  if (A.isReadonlyArrayEmpty(appended)) {
    return original;
  }
  return yield* mergeAppendedPacketFiles(original, documents, plan, source, appended);
});

const appendRawEvidenceFiles = (
  files: ReadonlyArray<PacketSnapshotFile>,
  documents: ReadonlyArray<PacketDocument>
): ReadonlyArray<PacketSnapshotFile> =>
  pipe(
    documents,
    A.filter((document) => Str.startsWith("raw/")(document.path) && !Str.equivalence(document.path, "raw/.gitignore")),
    A.reduce(files, (merged, document) =>
      upsertSnapshotFile(merged, PacketSnapshotFile.make({ path: document.path, contents: document.contents }))
    )
  );

const changedSnapshotFiles = (
  original: ReadonlyArray<PacketSnapshotFile>,
  finalFiles: ReadonlyArray<PacketSnapshotFile>
): ReadonlyArray<PacketSnapshotFile> =>
  A.filter(finalFiles, (file) => {
    const existing = snapshotFile(original, file.path);
    return O.isNone(existing) || !Str.equivalence(existing.value.contents, file.contents);
  });

const makeRefreshResult = (
  slug: string,
  updatedPaths: ReadonlyArray<string>,
  committed: boolean,
  reportedEvidence: ReadonlyArray<string>,
  reconciliation: CodexFindingsRefreshReconciliation
) => ({
  packetPath: `goals/${slug}`,
  written: A.map(updatedPaths, (relativePath) => `goals/${slug}/${relativePath}`),
  committed,
  reportedEvidence,
  reconciliation,
});

const stageRefreshSnapshot = Effect.fnUntraced(function* (
  canonicalRoot: string,
  stagingRelative: string,
  files: ReadonlyArray<PacketSnapshotFile>
) {
  const path = yield* Path.Path;
  for (const file of files) {
    yield* writeFileWithinCanonicalRootAtomically({
      canonicalRoot,
      candidate: path.join(stagingRelative, file.path),
      bytes: encoder.encode(file.contents),
    }).pipe(Effect.mapError((cause) => packetFailure("staging-failed", `${file.path} could not be staged.`, cause)));
  }
});

const assertRefreshSnapshotUnchanged = Effect.fnUntraced(function* (
  packetDir: string,
  canonicalPacketDir: string,
  original: ReadonlyArray<PacketSnapshotFile>
) {
  const current = yield* readPacketSnapshot(packetDir, canonicalPacketDir);
  if (!snapshotsAreEqual(original, current)) {
    return yield* packetFailure(
      "packet-changed",
      "The existing packet changed during refresh staging. Re-run against the current packet."
    );
  }
});

const verifyMovedAsideSnapshot = Effect.fnUntraced(function* (
  packetDir: string,
  backupDir: string,
  original: ReadonlyArray<PacketSnapshotFile>
) {
  const fs = yield* FileSystem.FileSystem;
  // Close the last comparison-to-rename race: a writer could change the
  // packet after the preflight snapshot but immediately before this move.
  // Compare the moved-aside bytes before promotion so that version is
  // restored rather than silently replaced when it differs.
  const canonicalBackupDir = yield* fs
    .realPath(backupDir)
    .pipe(
      Effect.mapError((cause) => packetFailure("commit-failed", "The moved-aside packet could not be verified.", cause))
    );
  const movedAside = yield* readPacketSnapshot(backupDir, canonicalBackupDir);
  if (!snapshotsAreEqual(original, movedAside)) {
    yield* fs.rename(backupDir, packetDir).pipe(Effect.ignore);
    return yield* packetFailure(
      "packet-changed",
      "The existing packet changed during refresh promotion. Re-run against the current packet."
    );
  }
});

const promoteRefreshSnapshot = Effect.fnUntraced(function* (
  packetDir: string,
  stagingDir: string,
  backupDir: string,
  original: ReadonlyArray<PacketSnapshotFile>
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .rename(packetDir, backupDir)
    .pipe(
      Effect.mapError((cause) => packetFailure("commit-failed", "The existing packet could not be moved aside.", cause))
    );
  yield* verifyMovedAsideSnapshot(packetDir, backupDir, original);
  const restoreThenFail = Effect.fnUntraced(function* (cause: unknown) {
    yield* fs.rename(backupDir, packetDir).pipe(Effect.ignore);
    return yield* packetFailure("commit-failed", "The staged refresh could not be promoted.", cause);
  });
  yield* fs.rename(stagingDir, packetDir).pipe(Effect.catch(restoreThenFail));
  yield* fs
    .remove(backupDir, { recursive: true, force: true })
    .pipe(
      Effect.mapError((cause) =>
        packetFailure("commit-failed", "The verified prior-packet backup could not be removed.", cause)
      )
    );
});

const cleanupRefreshStaging = Effect.fnUntraced(function* (packetDir: string, stagingDir: string, backupDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const backupExists = yield* fs.exists(backupDir).pipe(Effect.orElseSucceed(() => false));
  const packetExists = yield* fs.exists(packetDir).pipe(Effect.orElseSucceed(() => false));
  if (backupExists && !packetExists) {
    // The backup is the only surviving copy in this state. Restore it or
    // leave it in place for recovery; cleanup must never delete it.
    yield* fs.rename(backupDir, packetDir).pipe(Effect.ignore);
  }
  yield* fs.remove(stagingDir, { recursive: true, force: true }).pipe(Effect.ignore);
});

const commitRefreshSnapshot = Effect.fnUntraced(function* (
  canonicalRoot: string,
  canonicalPacketDir: string,
  packetDir: string,
  slug: string,
  original: ReadonlyArray<PacketSnapshotFile>,
  finalFiles: ReadonlyArray<PacketSnapshotFile>,
  updatedPaths: ReadonlyArray<string>,
  reportedEvidence: ReadonlyArray<string>,
  reconciliation: CodexFindingsRefreshReconciliation
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const goalsDir = path.join(canonicalRoot, "goals");
  const stagingDir = yield* fs
    .makeTempDirectory({ directory: goalsDir, prefix: `.tmp-${slug}-refresh-` })
    .pipe(
      Effect.mapError((cause) =>
        packetFailure("staging-failed", "A refresh staging directory could not be created.", cause)
      )
    );
  const backupDir = `${stagingDir}-previous`;
  const stagingRelative = path.relative(canonicalRoot, stagingDir);
  return yield* Effect.onError(
    Effect.gen(function* () {
      yield* stageRefreshSnapshot(canonicalRoot, stagingRelative, finalFiles);
      yield* assertRefreshSnapshotUnchanged(packetDir, canonicalPacketDir, original);
      yield* promoteRefreshSnapshot(packetDir, stagingDir, backupDir, original);
      return makeRefreshResult(slug, updatedPaths, true, reportedEvidence, reconciliation);
    }),
    () => cleanupRefreshStaging(packetDir, stagingDir, backupDir)
  );
});

/**
 * Reconcile and atomically promote a full-snapshot refresh.
 *
 * **Example** (Inspect the refresh operation)
 *
 * ```ts
 * import { refreshCodexFindingsPacket } from "@beep/repo-cli/test/Codex"
 *
 * console.log(typeof refreshCodexFindingsPacket) // "function"
 * ```
 *
 * @param options - Existing source, incoming plan/documents, and write mode.
 * @returns The packet write outcome plus an explicit preservation result.
 * @effects Reads and scans the complete packet; non-dry runs stage, verify, and atomically promote it.
 * @category use-cases
 * @since 0.0.0
 */
export const refreshCodexFindingsPacket = Effect.fnUntraced(function* (options: {
  readonly repoRoot: string;
  readonly slug: string;
  readonly source: CodexRefreshLedgerSource;
  readonly plan: CodexPacketPlan;
  readonly documents: ReadonlyArray<PacketDocument>;
  readonly dryRun: boolean;
}) {
  const { canonicalPacketDir, canonicalRoot, packetDir } = yield* ensurePacketDirectory(options.repoRoot, options.slug);
  const original = yield* readPacketSnapshot(packetDir, canonicalPacketDir);
  const triageFile = yield* requireSnapshotFile(original, "ops/triage.json");
  if (!Str.equivalence(triageFile.contents, options.source.contents)) {
    return yield* packetFailure(
      "packet-changed",
      "ops/triage.json changed after refresh planning. Re-run against the current packet."
    );
  }
  const appended = yield* validateReconciliation(options.plan, options.source);
  const priorCount = options.source.ledger.findings.length;
  const capturedCount = options.plan.records.length;
  const mergedFiles = yield* mergeRefreshPacketFiles(
    original,
    options.documents,
    options.plan,
    options.source,
    appended
  );
  const finalFiles = appendRawEvidenceFiles(mergedFiles, options.documents);
  const reportedEvidence = yield* assertPacketDocumentsClean(documentsForScan(finalFiles));
  const changed = changedSnapshotFiles(original, finalFiles);
  const updatedPaths = A.map(changed, (file) => file.path);
  const reconciliation = CodexFindingsRefreshReconciliation.make({
    status: A.isReadonlyArrayEmpty(appended) ? "no-new-findings" : "updated",
    priorCount,
    capturedCount,
    preservedIds: A.map(options.source.ledger.findings, (finding) => finding.id),
    appendedIds: A.map(appended, (record) => record.id),
    updatedPaths,
  });

  if (options.dryRun || A.isReadonlyArrayEmpty(changed)) {
    return makeRefreshResult(options.slug, updatedPaths, false, reportedEvidence, reconciliation);
  }
  return yield* commitRefreshSnapshot(
    canonicalRoot,
    canonicalPacketDir,
    packetDir,
    options.slug,
    original,
    finalFiles,
    updatedPaths,
    reportedEvidence,
    reconciliation
  );
});

/**
 * Recover sticky identity bindings from a validated refresh source.
 *
 * **Example** (Inspect the binding helper)
 *
 * ```ts
 * import { priorIdsOfRefreshSource } from "@beep/repo-cli/test/Codex"
 *
 * console.log(typeof priorIdsOfRefreshSource) // "function"
 * ```
 *
 * @param source - Existing decoded ledger source.
 * @returns The prior Codex-ID-to-CSF-ID binding map.
 * @category utilities
 * @since 0.0.0
 */
export const priorIdsOfRefreshSource = (source: CodexRefreshLedgerSource) =>
  priorIdsOfEntries(A.map(source.ledger.findings, (finding) => ({ id: finding.id, codexId: finding.codexId })));
