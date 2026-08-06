/**
 * Fallow advisory envelope mapping for Yeet quality packets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Console, Context, DateTime, Effect, FileSystem, flow, Layer, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { csvValues } from "../../../internal/cli/Flags.ts";
import { commandTextForStep, RepoRunPlan } from "../../../internal/repo-run/index.ts";
import {
  FallowFeatureFamily,
  FallowReportEnvelope,
  FindingAttributionKind,
  fallowEnvelopeFileName,
} from "../../Quality/internal/FallowEnvelope.schema.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { buildQualityIssueIndex, QualityIssue, QualityIssueIndex, QualityIssueRouting } from "./QualityIssueIndex.ts";
import type {
  FallowFailureEnvelope,
  FallowReportFinding,
  FallowReportOk,
} from "../../Quality/internal/FallowEnvelope.schema.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/FallowFeedback");

const fallowEnvelopeFileNames = A.map(FallowFeatureFamily.Options, (feature) => fallowEnvelopeFileName(feature, true));

// Local aliases keep this module's prior names while sourcing the single
// shared Fallow report-envelope codec, eliminating producer/consumer drift.
type FallowOkEnvelope = FallowReportOk;
type FallowFinding = FallowReportFinding;
const FallowEnvelope = FallowReportEnvelope;
type FallowEnvelope = FallowReportEnvelope;

class FallowYeetIssueFixture extends S.Class<FallowYeetIssueFixture>($I`FallowYeetIssueFixture`)(
  {
    id: S.String,
    sourceFeature: FallowFeatureFamily,
    sourceEnvelopeRef: S.String,
    sourceFindingId: S.String,
    tool: S.Literal("fallow"),
    parser: S.String,
    subCategory: S.String,
    blocking: S.Literal(false),
    attribution: FindingAttributionKind,
  },
  $I.annote("FallowYeetIssueFixture", {
    description: "Expected Yeet issue projection for one Fallow fixture finding.",
  })
) {}

class FallowFixtureDocument extends S.Class<FallowFixtureDocument>($I`FallowFixtureDocument`)(
  {
    schemaVersion: S.Literal("fallow-quality-enforcement/report-fixtures/v1"),
    fixtures: S.NonEmptyArray(FallowEnvelope),
    yeetIssueFixtures: S.NonEmptyArray(FallowYeetIssueFixture),
  },
  $I.annote("FallowFixtureDocument", {
    description: "Checked-in Fallow report envelope fixture document.",
  })
) {}

// `.beep/fallow` is gitignored, regenerable state. An advisory phase must never
// fail a publish over it, so the two envelope defects that are pure leftovers —
// envelopes written before this Yeet run started, and advisory-named envelopes
// produced in check mode — are purged and the phase skips (decision 25 / ledger
// #55). Leftover classification therefore runs BEFORE every hard-failing check,
// and those checks only ever see the envelopes that survive the purge: a stale
// or check-mode envelope that also disagrees with its feature family is still
// just leftover state. Everything else (a surviving fresh envelope whose
// findings disagree with its feature family, unreadable or undecodable
// envelopes) is a producer bug in current-run output rather than stale state:
// those still surface, each carrying this one-command remedy.
const FALLOW_ENVELOPE_PURGE_REMEDY = "rm -rf .beep/fallow";

const withPurgeRemedy = (message: string): string => `${message}\nRemedy: ${FALLOW_ENVELOPE_PURGE_REMEDY}`;

const FallowEnvelopeDefectKind = LiteralKit(["mode-mismatch", "stale"]).pipe(
  $I.annoteSchema("FallowEnvelopeDefectKind", {
    description: "Self-healable Fallow advisory envelope defect kind: regenerable leftovers, never a run failure.",
  })
);

class FallowEnvelopeEntry extends S.Class<FallowEnvelopeEntry>($I`FallowEnvelopeEntry`)(
  {
    envelope: FallowEnvelope,
    filePath: S.String,
  },
  $I.annote("FallowEnvelopeEntry", {
    description: "One decoded Fallow envelope paired with the file it was read from.",
  })
) {}

class FallowEnvelopeDefect extends S.Class<FallowEnvelopeDefect>($I`FallowEnvelopeDefect`)(
  {
    detail: S.String,
    filePath: S.String,
    kind: FallowEnvelopeDefectKind,
    subcommand: FallowFeatureFamily,
  },
  $I.annote("FallowEnvelopeDefect", {
    description: "One purgeable Fallow advisory envelope file plus why it is unusable for the current Yeet run.",
  })
) {}

const decodeFallowEnvelopeJson = S.decodeUnknownEffect(S.fromJsonString(FallowEnvelope));
const decodeFallowFixtureDocumentJsonc = decodeJsoncTextAs(FallowFixtureDocument);
const decodeRepoRunPlanJson = S.decodeUnknownEffect(S.fromJsonString(RepoRunPlan));
const decodeQualityIssueIndexJson = S.decodeUnknownEffect(S.fromJsonString(QualityIssueIndex));
const encodeQualityIssueIndexJson = S.encodeUnknownEffect(S.fromJsonString(QualityIssueIndex));

const readFileText = Effect.fn("YeetFallowFeedback.readFileText")(function* (
  filePath: string
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read "${filePath}".`, { file: filePath })));
});

/**
 * Configurable allowed root the Fallow advisory feedback reader/writer is
 * constrained to.
 *
 * Every Fallow feedback path (the `--from` envelope directory, the `--emit`
 * output index, and the fixture document) is resolved within this root via
 * {@link resolvePathWithinRoot}, following symlinks and canonicalizing the
 * deepest existing ancestor so not-yet-created write targets are still guarded.
 * A candidate that escapes the root through `..`, an absolute path outside it,
 * or a symlink pointing outside it is rejected before any bytes are read or
 * written — preventing repo-controlled symlink file clobber (CSF-011).
 *
 * The reference defaults to {@link O.none}, which resolves against the repository
 * root (the production behavior). Provide an override (see
 * {@link layerFallowFeedbackAllowedRoot}) to constrain feedback to an explicit
 * output directory — for example a temp directory in tests, or a non-repo Fallow
 * output dir — while keeping the symlink/traversal protection intact.
 *
 * **Example** (Read a fallow feedback allowed root entry)
 *
 * ```ts
 * import { FallowFeedbackAllowedRoot } from "@beep/repo-cli/commands/Yeet/internal/FallowFeedback"
 * console.log(FallowFeedbackAllowedRoot.key)
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const FallowFeedbackAllowedRoot: Context.Reference<O.Option<string>> = Context.Reference<O.Option<string>>(
  $I`FallowFeedbackAllowedRoot`,
  {
    defaultValue: O.none<string>,
  }
);

/**
 * Build a layer that overrides the {@link FallowFeedbackAllowedRoot} allowed
 * root with an explicit directory.
 *
 * Pass the configured Fallow output directory (or, in tests, a temp directory)
 * that the advisory feedback reader/writer is permitted to resolve paths within.
 * The symlink/traversal protection of {@link resolvePathWithinRoot} is preserved
 * — any candidate that escapes the supplied root is still rejected.
 *
 * **Example** (Restrict feedback output to a root)
 *
 * ```ts
 * import { layerFallowFeedbackAllowedRoot } from "@beep/repo-cli/commands/Yeet/internal/FallowFeedback"
 * const OutputRoot = layerFallowFeedbackAllowedRoot("/tmp/fallow-output")
 * console.log(OutputRoot) // example value
 * ```
 *
 * @param root - Absolute directory the advisory feedback reader/writer may resolve paths within.
 * @returns A layer that sets {@link FallowFeedbackAllowedRoot} to the supplied root.
 * @category guards
 * @since 0.0.0
 */
export const layerFallowFeedbackAllowedRoot = (root: string): Layer.Layer<never> =>
  Layer.succeed(FallowFeedbackAllowedRoot)(O.some(root));

const resolveAllowedRoot = Effect.fn("YeetFallowFeedback.resolveAllowedRoot")(function* (): Effect.fn.Return<
  string,
  YeetCommandError,
  Path.Path | FileSystem.FileSystem
> {
  const configuredRoot = yield* FallowFeedbackAllowedRoot;
  return yield* O.match(configuredRoot, {
    onNone: () => findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repository root."))),
    onSome: (root) => Effect.succeed(root),
  });
});

const resolveRepoPath = Effect.fn("YeetFallowFeedback.resolveRepoPath")(function* (
  value: string
): Effect.fn.Return<string, YeetCommandError, Path.Path | FileSystem.FileSystem> {
  const allowedRoot = yield* resolveAllowedRoot();
  // Resolve the candidate (relative or absolute) against the configured allowed
  // root, following symlinks and canonicalizing the deepest existing ancestor so
  // not-yet-created write targets are still guarded. Fails closed (PathSafetyError)
  // when the real path escapes the root via `..`, an absolute path outside the
  // root, or a symlink pointing outside it — preventing repo-controlled symlink
  // file clobber (CSF-011).
  return yield* resolvePathWithinRoot({ root: allowedRoot, candidate: value }).pipe(
    Effect.mapError(YeetCommandError.new(`Path "${value}" is not contained within the allowed Fallow feedback root.`))
  );
});

const writeQualityIssueIndex = Effect.fn("YeetFallowFeedback.writeQualityIssueIndex")(function* (
  emitPath: string,
  index: QualityIssueIndex
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absoluteEmitPath = yield* resolveRepoPath(emitPath);
  const json = yield* encodeQualityIssueIndexJson(index).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode Fallow quality issue index."))
  );
  yield* fs
    .makeDirectory(path.dirname(absoluteEmitPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create output directory for "${absoluteEmitPath}".`)));
  yield* fs
    .writeFileString(absoluteEmitPath, `${json}\n`)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write "${absoluteEmitPath}".`)));
});

const readQualityIssueIndex = Effect.fn("YeetFallowFeedback.readQualityIssueIndex")(function* (
  emitPath: string
): Effect.fn.Return<QualityIssueIndex, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const absoluteEmitPath = yield* resolveRepoPath(emitPath);
  const text = yield* readFileText(absoluteEmitPath);
  return yield* decodeQualityIssueIndexJson(text).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode emitted QualityIssueIndex "${absoluteEmitPath}".`))
  );
});

const fallbackPackageName = "@beep/root" as const;

const routeForFallow = (reason: string): ReadonlyArray<QualityIssueRouting> => [
  QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason }),
];

const sourceFileFromRef = (sourceRef: string): O.Option<string> =>
  pipe(Str.split(sourceRef, "#")[0], O.fromUndefinedOr, O.filter(Str.isNonEmpty));

const categoryForFallow = (feature: typeof FallowFeatureFamily.Type): QualityIssue["category"] =>
  feature === "security" ? "security-audit" : "repo-law";

const severityForFallow = (blocking: boolean): QualityIssue["severity"] => (blocking ? "error" : "warning");

const fallowFindingIssue = (envelope: FallowOkEnvelope, finding: FallowFinding, advisory: boolean): QualityIssue => {
  const blocking = advisory ? false : finding.blocking;
  return QualityIssue.make({
    id: `fallow:${envelope.subcommand}:${finding.id}`,
    category: categoryForFallow(finding.featureFamily),
    subCategory: finding.subCategory,
    severity: severityForFallow(blocking),
    blocking,
    confidence: "structured",
    message: `Fallow ${finding.featureFamily} ${finding.attribution} finding: ${finding.id}.`,
    evidence: [envelope.reportPath, finding.sourceRef],
    packageName: fallbackPackageName,
    ...O.getOrElse(
      pipe(
        sourceFileFromRef(finding.sourceRef),
        O.map((file) => ({ file }))
      ),
      () => ({})
    ),
    sourceAnchor: finding.id,
    tool: "fallow",
    parser: finding.parser,
    attribution: finding.attribution,
    command: envelope.command,
    exitCode: envelope.exitStatus,
    rawOutputRef: envelope.rawOutputRef,
    routing: routeForFallow("Fallow advisory finding"),
  });
};

const fallowFailureIssue = (envelope: FallowFailureEnvelope, advisory: boolean): QualityIssue => {
  const blocking = advisory ? false : envelope.status === "base-resolution-failed" || envelope.status === "tool-failed";
  return QualityIssue.make({
    id: `fallow:${envelope.subcommand}:${envelope.status}`,
    category:
      envelope.status === "invalid-json" || envelope.status === "invalid-report" ? "parser-error" : "command-failure",
    subCategory: `fallow:${envelope.subcommand}:${envelope.status}`,
    severity: severityForFallow(blocking),
    blocking,
    confidence: "partial",
    message: `Fallow ${envelope.subcommand} envelope status ${envelope.status}: ${envelope.stderrExcerpt}`,
    evidence: [envelope.reportPath],
    packageName: fallbackPackageName,
    tool: "fallow",
    parser: `fallow/${envelope.subcommand}/v1`,
    attribution: "not-applicable",
    sourceAnchor: envelope.status,
    command: envelope.command,
    exitCode: envelope.exitStatus,
    rawOutputRef: envelope.rawOutputRef,
    rawExcerpt: envelope.stderrExcerpt,
    routing: routeForFallow("Fallow advisory envelope failure"),
  });
};

const issuesFromEnvelope = (envelope: FallowEnvelope, advisory: boolean): ReadonlyArray<QualityIssue> =>
  envelope.status === "ok"
    ? A.map(envelope.report.findings, (finding) => fallowFindingIssue(envelope, finding, advisory))
    : [fallowFailureIssue(envelope, advisory)];

const issueIndexFromEnvelopes = (envelopes: ReadonlyArray<FallowEnvelope>, advisory: boolean): QualityIssueIndex =>
  buildQualityIssueIndex(
    pipe(
      envelopes,
      A.flatMap((envelope) => issuesFromEnvelope(envelope, advisory))
    )
  );

// Reject self-contradictory payloads: a successful envelope's findings must share
// its subcommand feature family, otherwise the issue id (derived from the
// subcommand) and category/message (derived from the finding) would disagree.
const familyMismatchRefs: (envelopes: ReadonlyArray<FallowEnvelope>) => ReadonlyArray<string> = flow(
  A.filter(
    (envelope: FallowEnvelope) =>
      envelope.status === "ok" &&
      !envelope.report.findings.every((finding) => finding.featureFamily === envelope.subcommand)
  ),
  A.map((envelope) => envelope.reportPath)
);

const assertAdvisoryEnvelopes = Effect.fn("YeetFallowFeedback.assertAdvisoryEnvelopes")(function* (
  envelopes: ReadonlyArray<FallowEnvelope>,
  advisory: boolean
): Effect.fn.Return<void, YeetCommandError> {
  const inconsistentRefs = familyMismatchRefs(envelopes);
  if (!A.isReadonlyArrayEmpty(inconsistentRefs)) {
    return yield* YeetCommandError.make({
      message: `Fallow advisory feedback received envelope(s) whose findings disagree with the subcommand feature family: ${A.join(inconsistentRefs, ", ")}`,
      exitCode: 1,
    });
  }
  if (!advisory) {
    return;
  }
  const nonAdvisoryRefs = pipe(
    envelopes,
    A.filter((envelope) => !envelope.advisory),
    A.map((envelope) => envelope.reportPath)
  );
  if (!A.isReadonlyArrayEmpty(nonAdvisoryRefs)) {
    return yield* YeetCommandError.make({
      message: `Fallow advisory feedback received non-advisory envelope(s): ${A.join(nonAdvisoryRefs, ", ")}`,
      exitCode: 1,
    });
  }
});

// The on-disk advisory phase keeps the same contract check, but teaches the
// remedy: a mismatched envelope on disk is regenerable, so the operator (or
// agent) never has to rediscover `rm -rf .beep/fallow` from a 2026-06 memory.
const assertEnvelopeFamilyConsistency = Effect.fn("YeetFallowFeedback.assertEnvelopeFamilyConsistency")(function* (
  envelopes: ReadonlyArray<FallowEnvelope>
): Effect.fn.Return<void, YeetCommandError> {
  const inconsistentRefs = familyMismatchRefs(envelopes);
  if (A.isReadonlyArrayEmpty(inconsistentRefs)) {
    return;
  }
  return yield* YeetCommandError.make({
    command: FALLOW_ENVELOPE_PURGE_REMEDY,
    message: withPurgeRemedy(
      `Fallow advisory feedback received envelope(s) whose findings disagree with the subcommand feature family: ${A.join(inconsistentRefs, ", ")}`
    ),
    exitCode: 1,
  });
});

const runStartMillis = (runStartedAt: string | undefined): O.Option<number> =>
  pipe(O.fromUndefinedOr(runStartedAt), O.flatMap(DateTime.make), O.map(DateTime.toEpochMillis));

// An envelope with an unparseable `generatedAt` cannot be proven fresh, so it is
// treated as stale rather than trusted.
const envelopeIsStale = (envelope: FallowEnvelope, startedAtMillis: number): boolean =>
  pipe(
    DateTime.make(envelope.generatedAt),
    O.match({
      onNone: () => true,
      onSome: (generatedAt) => DateTime.toEpochMillis(generatedAt) < startedAtMillis,
    })
  );

const envelopeDefect = (
  entry: FallowEnvelopeEntry,
  startedAtMillis: O.Option<number>
): O.Option<FallowEnvelopeDefect> =>
  entry.envelope.advisory
    ? pipe(
        startedAtMillis,
        O.filter((startedAt) => envelopeIsStale(entry.envelope, startedAt)),
        O.as(
          FallowEnvelopeDefect.make({
            detail: `generated ${entry.envelope.generatedAt}, older than the Yeet run start`,
            filePath: entry.filePath,
            kind: "stale",
            subcommand: entry.envelope.subcommand,
          })
        )
      )
    : O.some(
        FallowEnvelopeDefect.make({
          detail: `advisory-named envelope was produced in check mode (${entry.envelope.reportPath})`,
          filePath: entry.filePath,
          kind: "mode-mismatch",
          subcommand: entry.envelope.subcommand,
        })
      );

const selfHealableDefects = (
  entries: ReadonlyArray<FallowEnvelopeEntry>,
  startedAtMillis: O.Option<number>
): ReadonlyArray<FallowEnvelopeDefect> => A.getSomes(A.map(entries, (entry) => envelopeDefect(entry, startedAtMillis)));

// The complement of `selfHealableDefects`: the envelopes that are not purgeable
// leftovers, so they are the only ones a hard-failing consistency check may read.
const survivingEnvelopes = (
  entries: ReadonlyArray<FallowEnvelopeEntry>,
  startedAtMillis: O.Option<number>
): ReadonlyArray<FallowEnvelope> =>
  pipe(
    entries,
    A.filter((entry) => O.isNone(envelopeDefect(entry, startedAtMillis))),
    A.map((entry) => entry.envelope)
  );

const purgeEnvelopeFile = Effect.fn("YeetFallowFeedback.purgeEnvelopeFile")(function* (
  defect: FallowEnvelopeDefect
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  // A delete that fails is reported in the skip note, never raised: the phase is
  // advisory and the next run re-attempts the purge.
  return yield* fs.remove(defect.filePath, { force: true }).pipe(
    Effect.as(O.none<string>()),
    Effect.orElseSucceed(() => O.some(defect.filePath))
  );
});

const purgeNoteLines = (
  defects: ReadonlyArray<FallowEnvelopeDefect>,
  unpurged: ReadonlyArray<string>
): ReadonlyArray<string> => [
  `[yeet] advisory feedback skipped: stale envelopes purged (${A.length(defects)})`,
  ...A.map(defects, (defect) => `[yeet]   - ${defect.subcommand} (${defect.kind}): ${defect.detail}`),
  ...(A.isReadonlyArrayEmpty(unpurged)
    ? []
    : [`[yeet]   ! could not delete: ${A.join(unpurged, ", ")}`, `[yeet]   Remedy: ${FALLOW_ENVELOPE_PURGE_REMEDY}`]),
  "[yeet] .beep/fallow is gitignored, regenerable state; the next fallow run rewrites these envelopes.",
];

const readEnvelopeFile = Effect.fn("YeetFallowFeedback.readEnvelopeFile")(function* (
  filePath: string
): Effect.fn.Return<FallowEnvelope, YeetCommandError, FileSystem.FileSystem> {
  const text = yield* readFileText(filePath);
  return yield* decodeFallowEnvelopeJson(text).pipe(
    Effect.mapError(
      YeetCommandError.new(withPurgeRemedy(`Failed to decode Fallow envelope "${filePath}".`), {
        command: FALLOW_ENVELOPE_PURGE_REMEDY,
        file: filePath,
      })
    )
  );
});

const envelopePaths = Effect.fn("YeetFallowFeedback.envelopePaths")(function* (
  fromPath: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absoluteFromPath = yield* resolveRepoPath(fromPath);
  const entries = yield* fs.readDirectory(absoluteFromPath).pipe(
    // Treat only a missing directory as "no envelopes yet"; surface every other
    // failure (permission errors, invalid paths, ...) so misconfiguration is not
    // silently masked by a successful empty QualityIssueIndex.
    Effect.catch((error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(A.empty<string>())
        : Effect.fail(
            YeetCommandError.make({
              command: FALLOW_ENVELOPE_PURGE_REMEDY,
              message: withPurgeRemedy(`Failed to read Fallow envelope directory "${absoluteFromPath}".`),
              file: absoluteFromPath,
              cause: error,
            })
          )
    )
  );
  return pipe(
    entries,
    A.filter((entry) => A.contains(fallowEnvelopeFileNames, entry)),
    A.map((entry) => path.join(absoluteFromPath, entry)),
    A.sort(Order.String)
  );
});

const spaceValues = (value: string): ReadonlyArray<string> =>
  pipe(Str.split(value, " "), A.map(Str.trim), A.filter(Str.isNonEmpty));

const readEnvelopeEntries = Effect.fn("YeetFallowFeedback.readEnvelopeEntries")(function* (
  fromPath: string
): Effect.fn.Return<ReadonlyArray<FallowEnvelopeEntry>, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const paths = yield* envelopePaths(fromPath);
  return yield* Effect.forEach(
    paths,
    (filePath) =>
      readEnvelopeFile(filePath).pipe(Effect.map((envelope) => FallowEnvelopeEntry.make({ envelope, filePath }))),
    { concurrency: 1 }
  );
});

/**
 * Convert Fallow advisory envelopes from a directory into a Yeet issue index.
 *
 * **Details**
 *
 * In advisory mode the phase self-heals rather than failing the run: envelopes
 * left over from an earlier Yeet run (stale) and advisory-named envelopes that
 * were produced in check mode (mode-mismatched) are deleted, an empty issue
 * index is emitted so downstream consumers see the same state as an absent
 * `.beep/fallow`, and the run continues with a skip note on stdout — which the
 * step recorder captures into the run verdict.
 *
 * **Gotchas**
 *
 * Self-heal covers regenerable leftovers only. Envelope contract violations and
 * unreadable/undecodable envelopes still fail, each printing the exact
 * `rm -rf .beep/fallow` remedy.
 *
 * Order matters: leftovers are classified and purged first, and the feature
 * family consistency check reads only the envelopes that survive that purge. A
 * stale or check-mode envelope that also disagrees with its feature family is
 * regenerable state and self-heals; the same disagreement on a surviving fresh
 * envelope is current-run producer output and still fails with exit code 1.
 *
 * @category commands
 * @since 0.0.0
 */
export const runYeetFallowFeedback = Effect.fn("YeetFallowFeedback.runYeetFallowFeedback")(function* (options: {
  readonly advisory: boolean;
  readonly emit: string;
  readonly from: string;
  readonly runStartedAt?: string;
}): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const entries = yield* readEnvelopeEntries(options.from);
  if (!options.advisory) {
    const envelopes = A.map(entries, (entry) => entry.envelope);
    yield* assertAdvisoryEnvelopes(envelopes, false);
    yield* writeQualityIssueIndex(options.emit, issueIndexFromEnvelopes(envelopes, false));
    yield* Console.log(`[yeet] Fallow advisory issue index written to ${options.emit}`);
    return;
  }
  // Classify and purge regenerable leftovers before any hard-failing check, then
  // check only the survivors (decision 25 / ledger #55): a stale or check-mode
  // envelope is never allowed to fail the publish, whatever else it carries.
  const startedAtMillis = runStartMillis(options.runStartedAt);
  const defects = selfHealableDefects(entries, startedAtMillis);
  const surviving = survivingEnvelopes(entries, startedAtMillis);
  if (!A.isReadonlyArrayEmpty(defects)) {
    const unpurged = A.getSomes(yield* Effect.forEach(defects, purgeEnvelopeFile, { concurrency: 1 }));
    // Emit the same index an absent `.beep/fallow` produces so a downstream
    // consumer never reads a half-truth built from a partially stale directory.
    yield* writeQualityIssueIndex(options.emit, issueIndexFromEnvelopes(A.empty<FallowEnvelope>(), true));
    yield* Console.log(A.join(purgeNoteLines(defects, unpurged), "\n"));
    // Leftovers are healed; a family mismatch left on an envelope that survived
    // the purge is a producer bug in current-run output, so it still fails.
    return yield* assertEnvelopeFamilyConsistency(surviving);
  }
  yield* assertEnvelopeFamilyConsistency(surviving);
  yield* writeQualityIssueIndex(options.emit, issueIndexFromEnvelopes(surviving, true));
  yield* Console.log(`[yeet] Fallow advisory issue index written to ${options.emit}`);
});

const fixtureIssueMatches = (issue: QualityIssue, fixture: FallowYeetIssueFixture): boolean =>
  issue.tool === fixture.tool &&
  issue.parser === fixture.parser &&
  issue.subCategory === fixture.subCategory &&
  issue.blocking === fixture.blocking &&
  issue.attribution === fixture.attribution &&
  issue.sourceAnchor === fixture.sourceFindingId;

const fixtureDiagnostics = (
  index: QualityIssueIndex,
  fixtures: ReadonlyArray<FallowYeetIssueFixture>,
  assertions: ReadonlyArray<string>
): ReadonlyArray<string> => [
  ...(A.contains(assertions, "QualityIssueIndex") && index.schemaVersion !== "yeet-quality-issue-index/v1"
    ? ["emitted document is not a QualityIssueIndex"]
    : []),
  ...(A.contains(assertions, "tool=fallow") && A.some(index.issues, (issue) => issue.tool !== "fallow")
    ? ["expected every issue.tool to be fallow"]
    : []),
  ...(A.contains(assertions, "blocking=false") && A.some(index.issues, (issue) => issue.blocking)
    ? ["expected every Fallow advisory issue to be nonblocking"]
    : []),
  ...(A.contains(assertions, "attribution") && A.some(index.issues, (issue) => issue.attribution === undefined)
    ? ["expected every Fallow issue to carry attribution"]
    : []),
  ...A.flatMap(fixtures, (fixture) =>
    A.some(index.issues, (issue) => fixtureIssueMatches(issue, fixture))
      ? []
      : [`missing Yeet issue fixture projection for ${fixture.id}`]
  ),
];

/**
 * Decode checked-in Fallow fixtures and assert Yeet issue projection invariants.
 *
 * @category commands
 * @since 0.0.0
 */
export const runYeetFallowFixtureCheck = Effect.fn("YeetFallowFeedback.runYeetFallowFixtureCheck")(function* (options: {
  readonly assertions: string;
  readonly emit: string;
  readonly fixturePath: string;
}): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const absoluteFixturePath = yield* resolveRepoPath(options.fixturePath);
  const fixtureText = yield* readFileText(absoluteFixturePath);
  const document = yield* decodeFallowFixtureDocumentJsonc(fixtureText).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode Fallow fixture document "${options.fixturePath}".`))
  );
  yield* assertAdvisoryEnvelopes(document.fixtures, true);
  const index = issueIndexFromEnvelopes(document.fixtures, true);
  yield* writeQualityIssueIndex(options.emit, index);
  const emittedIndex = yield* readQualityIssueIndex(options.emit);
  const diagnostics = fixtureDiagnostics(emittedIndex, document.yeetIssueFixtures, csvValues(options.assertions));
  if (!A.isReadonlyArrayEmpty(diagnostics)) {
    return yield* YeetCommandError.make({
      message: `Fallow fixture check failed:\n${A.join(
        A.map(diagnostics, (diagnostic) => `- ${diagnostic}`),
        "\n"
      )}`,
      exitCode: 1,
    });
  }
  yield* Console.log(`[yeet] Fallow fixture check ok: ${options.fixturePath}`);
});

const readStdinText = Effect.fn("YeetFallowFeedback.readStdinText")(function* (
  fromStdin: boolean
): Effect.fn.Return<string, YeetCommandError> {
  if (!fromStdin) {
    return yield* YeetCommandError.make({
      message: "yeet plan-contract-check requires --from-stdin.",
      exitCode: 1,
    });
  }
  if (process.stdin.isTTY) {
    return yield* YeetCommandError.make({
      message: "yeet plan-contract-check --from-stdin received no stdin.",
      exitCode: 1,
    });
  }
  return yield* Effect.tryPromise(() => Bun.stdin.text()).pipe(
    Effect.mapError((cause) =>
      YeetCommandError.make({
        message: `Failed to read yeet plan stdin: ${cause instanceof Error ? cause.message : String(cause)}`,
        exitCode: 1,
      })
    )
  );
});

const decodePlanText = Effect.fn("YeetFallowFeedback.decodePlanText")(function* (
  text: string
): Effect.fn.Return<RepoRunPlan, YeetCommandError> {
  const jsonText = Str.trim(text);
  return yield* decodeRepoRunPlanJson(jsonText).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode yeet run plan."))
  );
});

const fallowAdvisoryPrecedenceDiagnostics = (
  plan: RepoRunPlan,
  stepIndex: number,
  step: RepoRunPlan["steps"][number]
): ReadonlyArray<string> => {
  if (step.id !== "advisory:01-fallow-feedback") {
    return [];
  }
  const laterPhaseBeforeAdvisory = pipe(
    plan.steps,
    A.take(stepIndex),
    A.filter((candidate) => candidate.phase === "full" || candidate.phase === "publish"),
    A.map((candidate) => candidate.id)
  );
  return [
    ...(step.phase === "feedback" ? [] : [`expected step phase feedback, got ${step.phase}`]),
    ...(A.isReadonlyArrayEmpty(laterPhaseBeforeAdvisory)
      ? []
      : [
          `expected Fallow advisory feedback before full/publish step(s), got before it: ${A.join(laterPhaseBeforeAdvisory, ", ")}`,
        ]),
  ];
};

/**
 * Assert a named Yeet plan step exists with exact command shape.
 *
 * @category commands
 * @since 0.0.0
 */
export const runYeetPlanContractCheck = Effect.fn("YeetFallowFeedback.runYeetPlanContractCheck")(function* (options: {
  readonly expectArgs: string;
  readonly expectCommand: string;
  readonly expectStepId: string;
  readonly expectStepLabel: string;
  readonly fromStdin: boolean;
}): Effect.fn.Return<void, YeetCommandError> {
  const text = yield* readStdinText(options.fromStdin);
  const plan = yield* decodePlanText(text);
  const step = A.findFirst(plan.steps, (candidate) => candidate.id === options.expectStepId);
  if (O.isNone(step)) {
    return yield* YeetCommandError.make({
      message: `missing yeet plan step ${options.expectStepId}`,
      exitCode: 1,
    });
  }
  const stepIndex = A.findFirstIndex(plan.steps, (candidate) => candidate.id === options.expectStepId);
  const expectedArgs = spaceValues(options.expectArgs);
  const diagnostics = [
    ...(step.value.label === options.expectStepLabel
      ? []
      : [`expected step label ${options.expectStepLabel}, got ${step.value.label}`]),
    ...(step.value.command === options.expectCommand
      ? []
      : [`expected step command ${options.expectCommand}, got ${step.value.command}`]),
    ...(A.join(step.value.args, " ") === A.join(expectedArgs, " ")
      ? []
      : [`expected step args ${A.join(expectedArgs, " ")}, got ${A.join(step.value.args, " ")}`]),
    ...pipe(
      stepIndex,
      O.match({
        onNone: () => [],
        onSome: (index) => fallowAdvisoryPrecedenceDiagnostics(plan, index, step.value),
      })
    ),
  ];
  if (!A.isReadonlyArrayEmpty(diagnostics)) {
    return yield* YeetCommandError.make({
      message: `yeet plan-contract-check failed for ${options.expectStepId}:\n${A.join(
        A.map(diagnostics, (diagnostic) => `- ${diagnostic}`),
        "\n"
      )}`,
      command: commandTextForStep(step.value),
      exitCode: 1,
    });
  }
  yield* Console.log(`[yeet] plan contract ok: ${options.expectStepId}`);
});
