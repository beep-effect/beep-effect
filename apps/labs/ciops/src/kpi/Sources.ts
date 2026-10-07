/**
 * Source decoders for the W8 KPI reading: the `run4-fleet` manifest's attempt
 * pins, attempt journals and the two admission sources.
 *
 * **Details**
 *
 * Every function here is pure over bytes already checked against their
 * SHA-256. The manifest is read line by line (no YAML dependency, as the live
 * replay reads it); attempt and admission rows decode through schemas, and
 * the two admission sources merge by nonce and event tag, failing closed on a
 * disagreement (launch sitting Ruling 5).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { DateTime, Effect, HashMap, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { topLevelBlock } from "../projection/Evidence.ts";
import { GitCommitSha, KpiAdmissionJoinMismatchError, KpiInputDecodeError } from "./Schemas.ts";
import type { KpiInputRole } from "./Schemas.ts";

const $I = $CiopsId.create("kpi/Sources");

/**
 * Deployed `ProofStage` carried by an attempt start (KPI law v1.2 §7.3).
 *
 * **Example** (Recognize the merged-preview stage)
 *
 * ```ts
 * import { ProofStage } from "@/kpi/Sources"
 *
 * console.log(ProofStage.is["merged-preview"]("merged-preview")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProofStage = LiteralKit(["repair-loop", "pre-push", "merged-preview", "hosted"]).pipe(
  $I.annoteSchema("ProofStage", {
    description: "Deployed proof stage recorded on an attempt start: repair-loop, pre-push, merged-preview or hosted.",
  })
);

/**
 * Decoded stage accepted by {@link ProofStage}.
 *
 * @see {@link ProofStage} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type ProofStage = typeof ProofStage.Type;

/**
 * Yeet proof scope recorded on an attempt start; a guard on the tier rule, never a tier.
 *
 * **Example** (Recognize the cheap-gates scope)
 *
 * ```ts
 * import { ProofScope } from "@/kpi/Sources"
 *
 * console.log(ProofScope.is["cheap-gates"]("cheap-gates")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProofScope = LiteralKit(["full", "cheap-gates", "review-fix"]).pipe(
  $I.annoteSchema("ProofScope", {
    description: "Yeet proof scope (`proofTier`) of an attempt start, used only as a guard on the tier rule.",
  })
);

/**
 * Decoded proof scope accepted by {@link ProofScope}.
 *
 * @see {@link ProofScope} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type ProofScope = typeof ProofScope.Type;

/**
 * Outcome of one attempt as the reading counts it.
 *
 * **Details**
 *
 * `success` is a green verdict; `red` is a failed verdict or any
 * termination (a terminated attempt counts as red, KPI law §6); `bounce` is a
 * pre-#870 lock bounce, which never opens a streak; `unterminated` has no
 * terminal row and stays outside every streak, as in M1.
 *
 * **Example** (Recognize a lock bounce)
 *
 * ```ts
 * import { AttemptOutcome } from "@/kpi/Sources"
 *
 * console.log(AttemptOutcome.is.bounce("bounce")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AttemptOutcome = LiteralKit(["success", "red", "bounce", "unterminated"]).pipe(
  $I.annoteSchema("AttemptOutcome", {
    description: "How the reading counts one attempt: green, red, lock bounce, or without a terminal row.",
  })
);

/**
 * Decoded outcome accepted by {@link AttemptOutcome}.
 *
 * @see {@link AttemptOutcome} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AttemptOutcome = typeof AttemptOutcome.Type;

/**
 * One pinned attempt: its start joined with its terminal row.
 *
 * **Details**
 *
 * `finishedAt` is the terminal row's `recordedAt`, absent for an
 * unterminated attempt and for a reconciler-stamped termination, which never
 * ends a duration (KPI law v1.2 §7.4).
 *
 * **Example** (Construct a green repair attempt)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import { FleetAttempt } from "@/kpi/Sources"
 *
 * const attempt = FleetAttempt.make({
 *   checkout: "beep-effect",
 *   runId: "main-0123456789ab",
 *   attemptId: "a-1",
 *   branch: "main",
 *   mode: "repair",
 *   startedAt: DateTime.makeUnsafe("2026-10-02T10:00:00.000Z"),
 *   stage: O.some("repair-loop"),
 *   proofScope: O.some("full"),
 *   resolvedHeadSha: O.none(),
 *   outcome: "success",
 *   finishedAt: O.some(DateTime.makeUnsafe("2026-10-02T10:05:00.000Z"))
 * })
 * console.log(attempt.outcome) // "success"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetAttempt extends S.Class<FleetAttempt>($I`FleetAttempt`)(
  {
    checkout: S.NonEmptyString,
    runId: S.NonEmptyString,
    attemptId: S.NonEmptyString,
    branch: S.NonEmptyString,
    mode: S.String,
    startedAt: S.DateTimeUtcFromString,
    stage: S.Option(ProofStage),
    proofScope: S.Option(ProofScope),
    resolvedHeadSha: S.Option(GitCommitSha),
    outcome: AttemptOutcome,
    finishedAt: S.Option(S.DateTimeUtcFromString),
  },
  $I.annote("FleetAttempt", {
    description: "One pinned attempt start joined with its terminal row, as the KPI fold consumes it.",
  })
) {}

/**
 * One pinned attempt journal (one branch-scoped run-id file of one checkout).
 *
 * **Details**
 *
 * `atWriterCap` and `compactionReceipts` come from the manifest's ring-window
 * record; `compactionCutoff` is the latest retained `journal-compacted`
 * cutoff, absent when the journal carries no receipt.
 *
 * **Example** (Construct an empty journal)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { FleetJournal } from "@/kpi/Sources"
 *
 * const journal = FleetJournal.make({
 *   checkout: "beep-effect",
 *   runId: "main-0123456789ab",
 *   atWriterCap: false,
 *   compactionCutoff: O.none(),
 *   attempts: []
 * })
 * console.log(journal.attempts.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetJournal extends S.Class<FleetJournal>($I`FleetJournal`)(
  {
    checkout: S.NonEmptyString,
    runId: S.NonEmptyString,
    atWriterCap: S.Boolean,
    compactionCutoff: S.Option(S.DateTimeUtcFromString),
    attempts: S.Array(FleetAttempt),
  },
  $I.annote("FleetJournal", {
    description: "One pinned attempt journal with its ring-window facts and its decoded attempts.",
  })
) {}

/**
 * One attempt-journal pin named by the fleet manifest.
 *
 * **Example** (Construct a journal pin)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { AttemptJournalPin } from "@/kpi/Sources"
 *
 * const pin = AttemptJournalPin.make({
 *   path: "attempts/beep-effect/main-0123456789ab/attempts.ndjson",
 *   checkout: "beep-effect",
 *   runId: "main-0123456789ab",
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   atWriterCap: false
 * })
 * console.log(pin.checkout) // "beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttemptJournalPin extends S.Class<AttemptJournalPin>($I`AttemptJournalPin`)(
  {
    path: S.NonEmptyString,
    checkout: S.NonEmptyString,
    runId: S.NonEmptyString,
    sha256: Sha256Hex,
    atWriterCap: S.Boolean,
  },
  $I.annote("AttemptJournalPin", {
    description: "Manifest-relative path, checkout label, run id, digest and writer-cap flag of one attempt journal.",
  })
) {}

/**
 * Capture instant and attempt-journal pins read from the `run4-fleet` manifest.
 *
 * **Example** (Construct manifest facts with no journals)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { FleetManifestFacts } from "@/kpi/Sources"
 *
 * const facts = FleetManifestFacts.make({
 *   captureInstant: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z"),
 *   journals: []
 * })
 * console.log(facts.journals.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetManifestFacts extends S.Class<FleetManifestFacts>($I`FleetManifestFacts`)(
  { captureInstant: S.DateTimeUtcFromString, journals: S.Array(AttemptJournalPin) },
  $I.annote("FleetManifestFacts", {
    description: "The fleet capture instant and every attempt-journal pin the manifest names.",
  })
) {}

const LOCK_SENTENCE = "Another Yeet full proof";

// Reconciler-stamped reasons: `recordedAt` is the sweep, not the attempt's end (TTC ruling 75).
const reconcilerReasons: ReadonlyArray<string> = ["legacy-unowned-start", "owner-dead", "stale-unverifiable-owner"];

const attemptSchemaVersion = S.Literal("yeet-attempt-journal/v1");
const optionalString = S.OptionFromOptionalKey(S.String);
const optionalInstant = S.OptionFromOptionalKey(S.DateTimeUtcFromString);

const AttemptStartedRow = S.Struct({
  schemaVersion: attemptSchemaVersion,
  _tag: S.tag("attempt-started"),
  attemptId: S.NonEmptyString,
  branch: S.NonEmptyString,
  mode: S.String,
  startedAt: S.DateTimeUtcFromString,
  stage: S.OptionFromOptionalKey(ProofStage),
  proofTier: S.OptionFromOptionalKey(ProofScope),
  resolvedHeadSha: S.OptionFromOptionalKey(GitCommitSha),
});

const AttemptFinishedRow = S.Struct({
  schemaVersion: attemptSchemaVersion,
  _tag: S.tag("attempt-finished"),
  attemptId: S.NonEmptyString,
  recordedAt: S.DateTimeUtcFromString,
  verdict: S.Struct({ outcome: S.String, failureKind: optionalString, message: optionalString }),
});

const AttemptTerminatedRow = S.Struct({
  schemaVersion: attemptSchemaVersion,
  _tag: S.tag("attempt-terminated"),
  attemptId: S.NonEmptyString,
  recordedAt: S.DateTimeUtcFromString,
  reason: S.String,
});

const JournalCompactedRow = S.Struct({
  schemaVersion: attemptSchemaVersion,
  _tag: S.tag("journal-compacted"),
  terminalEvictionCutoffRecordedAt: optionalInstant,
  oldestEvictedRecordedAt: optionalInstant,
});

const AttemptJournalRow = S.Union([
  AttemptStartedRow,
  AttemptFinishedRow,
  AttemptTerminatedRow,
  JournalCompactedRow,
]).pipe(S.toTaggedUnion("_tag"));

type AttemptJournalRow = typeof AttemptJournalRow.Type;
type AttemptStartedRow = typeof AttemptStartedRow.Type;
type AttemptFinishedRow = typeof AttemptFinishedRow.Type;
type TerminalRow = AttemptFinishedRow | typeof AttemptTerminatedRow.Type;

const decodeAttemptJournalRow = S.decodeEffect(S.fromJsonString(AttemptJournalRow));

const decodeFailure = (role: KpiInputRole, path: string, message: string) =>
  KpiInputDecodeError.make({ role, path, message });

const nonEmptyLines = (text: string): ReadonlyArray<string> => pipe(Str.split(text, "\n"), A.filter(Str.isNonEmpty));

const decodeJournalLine =
  (path: string) =>
  (line: string, index: number): Effect.Effect<AttemptJournalRow, KpiInputDecodeError> =>
    decodeAttemptJournalRow(line).pipe(
      Effect.mapError(() =>
        decodeFailure("fleet-manifest", path, `Attempt journal line ${index + 1} did not match its schema.`)
      )
    );

const isLockBounce = (row: AttemptFinishedRow): boolean =>
  O.exists(row.verdict.failureKind, Eq.equals("handler-error")) &&
  O.exists(row.verdict.message, Str.includes(LOCK_SENTENCE));

const finishedOutcome = (row: AttemptFinishedRow): AttemptOutcome =>
  Eq.equals(row.verdict.outcome, "success")
    ? AttemptOutcome.Enum.success
    : isLockBounce(row)
      ? AttemptOutcome.Enum.bounce
      : AttemptOutcome.Enum.red;

const terminalOutcome = (row: TerminalRow): AttemptOutcome =>
  AttemptJournalRow.guards["attempt-finished"](row) ? finishedOutcome(row) : AttemptOutcome.Enum.red;

// A reconciler-stamped termination keeps its order and stays red but ends no duration.
const terminalInstant = (row: TerminalRow): O.Option<DateTime.Utc> =>
  AttemptJournalRow.guards["attempt-terminated"](row) && A.contains(reconcilerReasons, row.reason)
    ? O.none()
    : O.some(row.recordedAt);

const toAttempt =
  (pin: AttemptJournalPin, terminals: HashMap.HashMap<string, TerminalRow>) =>
  (start: AttemptStartedRow): FleetAttempt => {
    const terminal = HashMap.get(terminals, start.attemptId);
    return FleetAttempt.make({
      checkout: pin.checkout,
      runId: pin.runId,
      attemptId: start.attemptId,
      branch: start.branch,
      mode: start.mode,
      startedAt: start.startedAt,
      stage: start.stage,
      proofScope: start.proofTier,
      resolvedHeadSha: start.resolvedHeadSha,
      outcome: O.match(terminal, { onNone: () => AttemptOutcome.Enum.unterminated, onSome: terminalOutcome }),
      finishedAt: O.flatMap(terminal, terminalInstant),
    });
  };

const isTerminalRow = (row: AttemptJournalRow): row is TerminalRow =>
  AttemptJournalRow.guards["attempt-finished"](row) || AttemptJournalRow.guards["attempt-terminated"](row);

// The first terminal row per attempt wins, in file order.
const firstTerminals = (rows: ReadonlyArray<AttemptJournalRow>): HashMap.HashMap<string, TerminalRow> =>
  A.reduce(A.filter(rows, isTerminalRow), HashMap.empty<string, TerminalRow>(), (terminals, row) =>
    HashMap.has(terminals, row.attemptId) ? terminals : HashMap.set(terminals, row.attemptId, row)
  );

const compactionCutoff = (rows: ReadonlyArray<AttemptJournalRow>): O.Option<DateTime.Utc> =>
  pipe(
    A.filter(rows, AttemptJournalRow.guards["journal-compacted"]),
    A.map((row) => O.orElse(row.terminalEvictionCutoffRecordedAt, () => row.oldestEvictedRecordedAt)),
    A.getSomes,
    A.match({ onEmpty: O.none, onNonEmpty: (cutoffs) => O.some(A.max(cutoffs, DateTime.Order)) })
  );

/**
 * Assembles one attempt journal from its decoded rows (exposed for fixtures).
 *
 * **Details**
 *
 * Each `attempt-started` row becomes one {@link FleetAttempt}, joined with the
 * first terminal row for its attempt id; the latest `journal-compacted`
 * cutoff becomes the journal's left-censoring cutoff.
 *
 * **Example** (Assemble an empty journal)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { Effect } from "effect"
 * import { AttemptJournalPin, decodeAttemptJournal } from "@/kpi/Sources"
 *
 * const pin = AttemptJournalPin.make({
 *   path: "attempts/beep-effect/main-0123456789ab/attempts.ndjson",
 *   checkout: "beep-effect",
 *   runId: "main-0123456789ab",
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   atWriterCap: false
 * })
 * console.log(Effect.runSync(decodeAttemptJournal(pin, "")).attempts.length) // 0
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeAttemptJournal = Effect.fn("KpiSources.decodeAttemptJournal")(function* (
  pin: AttemptJournalPin,
  text: string
): Effect.fn.Return<FleetJournal, KpiInputDecodeError> {
  const rows = yield* Effect.forEach(nonEmptyLines(text), decodeJournalLine(pin.path));
  const terminals = firstTerminals(rows);
  const starts = A.filter(rows, AttemptJournalRow.guards["attempt-started"]);
  return FleetJournal.make({
    checkout: pin.checkout,
    runId: pin.runId,
    atWriterCap: pin.atWriterCap,
    compactionCutoff: compactionCutoff(rows),
    attempts: A.map(
      A.dedupeWith(starts, (a, b) => a.attemptId === b.attemptId),
      toAttempt(pin, terminals)
    ),
  });
});

// Splits a YAML list block into its items: each item starts at a column-0 `- ` line.
const listItems = (block: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> => {
  const starts = A.getSomes(A.map(block, (line, index) => (Str.startsWith("- ")(line) ? O.some(index) : O.none())));
  return A.map(starts, (start, k) =>
    A.take(A.drop(block, start), O.getOrElse(A.get(starts, k + 1), () => A.length(block)) - start)
  );
};

const unquote = (value: string): string => Str.replace(/^'(.*)'$/, "$1")(value);

const member = (item: ReadonlyArray<string>, prefix: string): O.Option<string> =>
  O.map(A.findFirst(item, Str.startsWith(prefix)), (line) => unquote(Str.slice(Str.length(prefix))(line)));

const manifestFailure = (path: string, message: string) => decodeFailure("fleet-manifest", path, message);

const writerCapByPath = (lines: ReadonlyArray<string>): HashMap.HashMap<string, boolean> =>
  HashMap.fromIterable(
    A.getSomes(
      A.map(listItems(topLevelBlock(lines, "sources")), (item) =>
        O.map(
          member(item, "- path: "),
          (path) => [path, O.exists(member(item, "    at_writer_cap: "), Eq.equals("true"))] as const
        )
      )
    )
  );

const pinOf =
  (caps: HashMap.HashMap<string, boolean>) =>
  (item: ReadonlyArray<string>): O.Option<O.Option<AttemptJournalPin>> =>
    O.exists(member(item, "  kind: "), Eq.equals("attempts"))
      ? O.some(
          O.all({
            path: member(item, "- path: "),
            checkout: member(item, "  checkout: "),
            runId: member(item, "  run_id: "),
            sha256: O.filter(member(item, "  sha256: "), S.is(Sha256Hex)),
          }).pipe(
            O.flatMap((fields) =>
              O.map(HashMap.get(caps, fields.path), (atWriterCap) => AttemptJournalPin.make({ ...fields, atWriterCap }))
            )
          )
        )
      : O.none();

/**
 * Reads the capture instant and every attempt-journal pin from the manifest text.
 *
 * **Details**
 *
 * A minimal line-based read of the known-shape `run4-fleet` manifest: the
 * top-level `capture_instant`, each `files` item of kind `attempts` (path,
 * checkout, run id, SHA-256) and each `sources` item's `at_writer_cap`. An
 * attempt item missing a member or its ring-window record fails typed.
 *
 * **Example** (Read an attempts-free manifest)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { readFleetManifestFacts } from "@/kpi/Sources"
 *
 * const facts = Effect.runSync(readFleetManifestFacts("MANIFEST.yaml", "capture_instant: '2026-10-06T03:19:28.440Z'\n"))
 * console.log(facts.journals.length) // 0
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const readFleetManifestFacts = Effect.fn("KpiSources.readFleetManifestFacts")(function* (
  path: string,
  manifest: string
): Effect.fn.Return<FleetManifestFacts, KpiInputDecodeError> {
  const lines = Str.split(manifest, "\n");
  const instant = O.flatMap(A.findFirst(lines, Str.startsWith("capture_instant: ")), (line) =>
    DateTime.make(unquote(Str.slice(Str.length("capture_instant: "))(line)))
  );
  const captureInstant = yield* Effect.fromOption(O.map(instant, DateTime.toUtc)).pipe(
    Effect.mapError(() => manifestFailure(path, "The manifest carries no readable capture_instant."))
  );
  const pins = A.getSomes(A.map(listItems(topLevelBlock(lines, "files")), pinOf(writerCapByPath(lines))));
  const journals = yield* Effect.forEach(pins, (pin, index) =>
    Effect.fromOption(pin).pipe(
      Effect.mapError(() => manifestFailure(path, `Attempt file item ${index + 1} lacks a pin member or ring window.`))
    )
  );
  return FleetManifestFacts.make({ captureInstant, journals });
});

/**
 * Event tag of an admission journal row the reading consumes.
 *
 * **Example** (Recognize a withdrawal)
 *
 * ```ts
 * import { AdmissionEventTag } from "@/kpi/Sources"
 *
 * console.log(AdmissionEventTag.is["admission-withdrawn"]("admission-withdrawn")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionEventTag = LiteralKit([
  "admission-enqueued",
  "admission-admitted",
  "admission-released",
  "admission-withdrawn",
  "admission-ticket-evicted",
  "admission-lease-evicted",
]).pipe(
  $I.annoteSchema("AdmissionEventTag", {
    description: "Event tag of one admission journal row, v1 through v3.",
  })
);

/**
 * Decoded tag accepted by {@link AdmissionEventTag}.
 *
 * @see {@link AdmissionEventTag} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionEventTag = typeof AdmissionEventTag.Type;

const optionalMillis = S.OptionFromOptionalKey(S.Finite);

/**
 * The members of an admission row the KPI reading consumes, from either source.
 *
 * **Details**
 *
 * `checkoutRoot` is present on canonical rows only; snapshot rows carry a
 * capture-scoped `checkoutRef` instead, so a snapshot row joins an attempt by
 * attempt id and branch only (launch sitting Ruling 12c).
 *
 * **Example** (Construct an enqueue row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { KpiAdmissionRow } from "@/kpi/Sources"
 *
 * const row = KpiAdmissionRow.make({
 *   _tag: "admission-enqueued",
 *   nonce: "n-1",
 *   attemptId: O.some("a-1"),
 *   branch: O.some("main"),
 *   checkoutRoot: O.none(),
 *   enqueuedAtMillis: O.some(1000),
 *   admittedAtMillis: O.none(),
 *   withdrawnAtMillis: O.none(),
 *   evictedAtMillis: O.none()
 * })
 * console.log(row._tag) // "admission-enqueued"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KpiAdmissionRow extends S.Class<KpiAdmissionRow>($I`KpiAdmissionRow`)(
  {
    _tag: AdmissionEventTag,
    nonce: S.NonEmptyString,
    attemptId: optionalString,
    branch: optionalString,
    checkoutRoot: optionalString,
    enqueuedAtMillis: optionalMillis,
    admittedAtMillis: optionalMillis,
    withdrawnAtMillis: optionalMillis,
    evictedAtMillis: optionalMillis,
  },
  $I.annote("KpiAdmissionRow", {
    description: "Admission row members the KPI reading consumes: tag, nonce, join keys and instants.",
  })
) {}

const AdmissionCell = S.Union([S.String, S.Finite, S.Boolean, S.Null]);
const decodeAdmissionRecord = S.decodeEffect(S.fromJsonString(S.Record(S.String, AdmissionCell)));
const decodeKpiAdmissionRow = S.decodeUnknownEffect(KpiAdmissionRow);

// Custody members differ by construction between the two sources (different salts and the
// checkout surrogate); every other member must agree on a shared (nonce, tag) row.
const custodyMembers: ReadonlyArray<string> = [
  "ownerRef",
  "ownerRefVariant",
  "pid",
  "procStart",
  "checkoutRoot",
  "checkoutRef",
];

class SourcedAdmissionRow extends S.Class<SourcedAdmissionRow>($I`SourcedAdmissionRow`)(
  { key: S.String, comparable: S.String, row: KpiAdmissionRow },
  $I.annote("SourcedAdmissionRow", {
    description: "An admission row with its dedupe key and its custody-free comparable form.",
  })
) {}

const comparableForm = (record: { readonly [key: string]: string | number | boolean | null }): string =>
  pipe(
    R.toEntries(record),
    A.filter(([key]) => !A.contains(custodyMembers, key)),
    A.sort(Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)),
    A.map(([key, value]) => `${key}=${typeof value}:${String(value)}`),
    A.join("\u001f")
  );

const decodeAdmissionLine =
  (role: KpiInputRole, path: string) =>
  (line: string, index: number): Effect.Effect<SourcedAdmissionRow, KpiInputDecodeError> =>
    Effect.gen(function* () {
      const record = yield* decodeAdmissionRecord(line);
      const row = yield* decodeKpiAdmissionRow(record);
      return SourcedAdmissionRow.make({
        key: `${row.nonce}\u0000${row._tag}`,
        comparable: comparableForm(record),
        row,
      });
    }).pipe(
      Effect.mapError(() => decodeFailure(role, path, `Admission journal line ${index + 1} did not match its schema.`))
    );

const mismatchOf = (rows: A.NonEmptyReadonlyArray<SourcedAdmissionRow>): O.Option<KpiAdmissionJoinMismatchError> => {
  const head = A.headNonEmpty(rows);
  return A.every(rows, (row) => row.comparable === head.comparable)
    ? O.none()
    : O.some(
        KpiAdmissionJoinMismatchError.make({
          nonce: head.row.nonce,
          eventTag: head.row._tag,
          message: "The canonical journal and the redacted snapshot disagree on a non-custody member of this row.",
        })
      );
};

const groupOrder = Order.mapInput(
  Order.String,
  (rows: A.NonEmptyReadonlyArray<SourcedAdmissionRow>) => A.headNonEmpty(rows).key
);

/**
 * Merges the canonical journal with the redacted snapshot, deduplicated by nonce and event tag.
 *
 * **Details**
 *
 * Rows sharing a `(nonce, _tag)` key must agree on every member except the
 * custody members (`ownerRef`, `ownerRefVariant`, `pid`, `procStart`,
 * `checkoutRoot`, `checkoutRef`); the first disagreement fails closed with
 * {@link KpiAdmissionJoinMismatchError}, with no fallback. The merged rows are
 * sorted by nonce, then tag.
 *
 * **Example** (Merge two empty sources)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { mergeAdmissionSources } from "@/kpi/Sources"
 *
 * const rows = Effect.runSync(mergeAdmissionSources({ path: "a.ndjson", text: "" }, { path: "b.ndjson", text: "" }))
 * console.log(rows.length) // 0
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const mergeAdmissionSources = Effect.fn("KpiSources.mergeAdmissionSources")(function* (
  canonical: { readonly path: string; readonly text: string },
  snapshot: { readonly path: string; readonly text: string }
): Effect.fn.Return<ReadonlyArray<KpiAdmissionRow>, KpiInputDecodeError | KpiAdmissionJoinMismatchError> {
  const canonicalRows = yield* Effect.forEach(
    nonEmptyLines(canonical.text),
    decodeAdmissionLine("fleet-admission-journal", canonical.path)
  );
  const snapshotRows = yield* Effect.forEach(
    nonEmptyLines(snapshot.text),
    decodeAdmissionLine("admission-snapshot", snapshot.path)
  );
  const groups = A.groupBy(A.appendAll(canonicalRows, snapshotRows), (row) => row.key);
  const ordered = A.sort(R.values(groups), groupOrder);
  yield* O.match(A.head(A.getSomes(A.map(ordered, mismatchOf))), {
    onNone: () => Effect.void,
    onSome: Effect.fail,
  });
  return A.map(ordered, (rows) => A.headNonEmpty(rows).row);
});
