/**
 * `yeet economics` pressure join (certainty-scorecard MEAS-08): PSI recorder
 * samples and admission-journal pressure stamps joined onto attempts.
 *
 * **Details**
 *
 * {@link YeetPressureSource} reads two sources that already exist and writes
 * nothing: the PSI recorder file (`$HOME/.local/state/beep-psi/safe-pressure.jsonl`,
 * appended about every 30 s by `beep-psi-sample.timer`) and the machine-wide
 * admission history (archive segments plus the live journal). The pure
 * {@link joinEconomicsPressure} joins the recorder's samples onto each local
 * attempt by time window (start to end, both included) and the admitted and
 * released rows' SCHE-09 stamps by attempt id, grouped into leases by nonce.
 * Every joined field is either present or absent with its reason; nothing is
 * interpolated. Pressure is context, never attribution: concurrent attempts
 * share one window's samples.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { parsePressureFile } from "@beep/palantiri/HostPressure";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AdmissionJournalReleasedV3,
  readAdmissionJournalHistory,
} from "../../../internal/repo-run/AdmissionJournal.ts";
import { parseMeminfoFieldGib } from "../../../internal/repo-run/MemoryStats.service.ts";
import { admissionRootFor, perUserRuntimeRoot } from "../../../internal/repo-run/RuntimeRoot.ts";
import { ciLedgerSourceStatus } from "../../Ci/CostLedger.schemas.ts";
import { currentYeetAttemptOrigin } from "./AttemptJournal.ts";
import {
  AdmissionStampRead,
  AdmissionStampRow,
  EconomicsAdmissionsAbsent,
  EconomicsAdmissionsJoin,
  EconomicsAdmissionsJoined,
  EconomicsAttemptPressure,
  EconomicsLeasePressure,
  EconomicsPressure,
  EconomicsPressureGapCount,
  EconomicsPressureRead,
  EconomicsPressureReadStatus,
  EconomicsPressureSourceRow,
  EconomicsPsiFigure,
  EconomicsPsiWindow,
  EconomicsSamplesAbsent,
  EconomicsSamplesJoin,
  EconomicsSamplesJoined,
  EconomicsStampAbsent,
  EconomicsStampJoin,
  EconomicsStampJoined,
  PsiRecorderRead,
  PsiRecorderSample,
} from "./EconomicsPressure.schemas.ts";
import type { AdmissionJournalEvent, AdmissionJournalHistory } from "../../../internal/repo-run/AdmissionJournal.ts";
import type { AdmissionPressureStamp } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import type { CiLedgerSourceStatus } from "../../Ci/CostLedger.schemas.ts";
import type { EconomicsAttempt, EconomicsJournal } from "./Economics.schemas.ts";
import type { EconomicsPressureGap, EconomicsPressureSourceKind } from "./EconomicsPressure.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/EconomicsPressure");

const RECORDER_RELATIVE_PATH = ".local/state/beep-psi/safe-pressure.jsonl";

// ---------------------------------------------------------------------------
// Recorder lines
// ---------------------------------------------------------------------------

const RecorderPressureText = S.OptionFromOptionalKey(S.String);

// The recorder's line as `sample-safe.py` writes it; keys the join does not use are ignored.
const PsiRecorderLine = S.Struct({
  time: S.String,
  boot_id: S.String,
  memory: S.OptionFromOptionalKey(S.Struct({ MemAvailable: RecorderPressureText })),
  pressure: S.OptionFromOptionalKey(
    S.Struct({ cpu: RecorderPressureText, memory: RecorderPressureText, io: RecorderPressureText })
  ),
}).pipe(
  $I.annoteSchema("PsiRecorderLine", {
    description: "One safe-pressure.jsonl line: instant, boot id, meminfo fields and /proc/pressure texts.",
  })
);

const PsiRecorderLineJson = JsonStringCodec(PsiRecorderLine);
const JsonRecordJson = JsonStringCodec(S.Unknown);

const some10 = (text: O.Option<string>): O.Option<number> =>
  O.flatMap(text, (pressure) => O.map(parsePressureFile(pressure).some, (stats) => stats.avg10));

const memAvailableGib = (value: O.Option<string>): O.Option<number> =>
  O.map(
    O.flatMap(value, (field) => parseMeminfoFieldGib(`MemAvailable: ${field}`, "MemAvailable:")),
    (gib) => Num.round(gib, 3)
  );

const sampleOf = (line: typeof PsiRecorderLine.Type): O.Option<PsiRecorderSample> =>
  O.map(DateTime.make(line.time), (at) =>
    PsiRecorderSample.make({
      atMillis: DateTime.toEpochMillis(at),
      bootId: line.boot_id,
      cpuSome10: some10(O.flatMap(line.pressure, (texts) => texts.cpu)),
      memorySome10: some10(O.flatMap(line.pressure, (texts) => texts.memory)),
      ioSome10: some10(O.flatMap(line.pressure, (texts) => texts.io)),
      memAvailableGib: memAvailableGib(O.flatMap(line.memory, (memory) => memory.MemAvailable)),
    })
  );

/**
 * Decode the PSI recorder file's text into samples.
 *
 * **Details**
 *
 * Every non-blank line counts in `lines`; one that is not a recorder line, or
 * whose `time` is not an instant, counts in `invalidLines`. The attempt
 * journal's torn-tail rule applies: invalid JSON on an unterminated last line
 * is an append still in flight and counts in neither. Samples are sorted by
 * instant.
 *
 * **Example** (One sample and one bad line)
 *
 * ```ts
 * import { decodePsiRecorderText } from "@beep/repo-cli/test/Yeet"
 *
 * const read = decodePsiRecorderText(
 *   '{"time":"2026-11-14T12:00:00+00:00","boot_id":"b","pressure":{"cpu":"some avg10=1.50 avg60=0 avg300=0 total=1"}}\n{}\n'
 * )
 * console.log([read.lines, read.invalidLines, read.samples.length]) // [2, 1, 1]
 * ```
 *
 * @param text - The recorder file's contents.
 * @returns The read, with status `read`.
 * @category parsing
 * @since 0.0.0
 */
export const decodePsiRecorderText = (text: string): PsiRecorderRead => {
  const all = A.filter(Str.split(text, "\n"), flow(Str.trim, Str.isNonEmpty));
  const tornTail =
    !Str.endsWith("\n")(text) && O.exists(A.last(all), (line) => O.isNone(JsonRecordJson.decodeOption(line)));
  const lines = tornTail ? A.dropRight(all, 1) : all;
  const samples = A.getSomes(A.map(lines, flow(PsiRecorderLineJson.decodeOption, O.flatMap(sampleOf))));
  return PsiRecorderRead.make({
    status: "read",
    lines: A.length(lines),
    invalidLines: A.length(lines) - A.length(samples),
    samples: A.sort(samples, sampleOrder),
  });
};

const sampleOrder = Order.mapInput(Order.Number, (sample: PsiRecorderSample) => sample.atMillis);

// ---------------------------------------------------------------------------
// Admission rows
// ---------------------------------------------------------------------------

const isReleasedV3 = S.is(AdmissionJournalReleasedV3);

const stampRow =
  (transition: AdmissionStampRow["transition"], pressure: O.Option<AdmissionPressureStamp>) =>
  (event: { readonly nonce: string; readonly attemptId: O.Option<string> }): O.Option<AdmissionStampRow> =>
    O.map(event.attemptId, (attemptId) =>
      AdmissionStampRow.make({ nonce: event.nonce, attemptId, transition, pressure })
    );

const stampRowOf: (event: AdmissionJournalEvent) => O.Option<AdmissionStampRow> =
  Match.type<AdmissionJournalEvent>().pipe(
    Match.tag("admission-admitted", (event) => stampRow("admitted", event.pressure)(event)),
    Match.tag("admission-released", (event) =>
      stampRow("released", isReleasedV3(event) ? event.pressure : O.none())(event)
    ),
    Match.orElse(() => O.none<AdmissionStampRow>())
  );

/**
 * Project an admission history onto the rows the pressure join reads.
 *
 * **Details**
 *
 * Keeps admitted rows and v1 and v3 released rows that carry an attempt id,
 * in history order, with each row's stamp (a v1 released row has none).
 * `rows` is the history's distinct rows, decoded or not.
 *
 * **Example** (An empty history)
 *
 * ```ts
 * import { admissionStampReadOf } from "@beep/repo-cli/test/Yeet"
 * import { AdmissionJournalArchive, AdmissionJournalHistory } from "@beep/repo-cli/test/RepoRun"
 *
 * const read = admissionStampReadOf(
 *   AdmissionJournalHistory.make({
 *     archive: AdmissionJournalArchive.make({ directory: "/admit/journal-archive", segments: [] }),
 *     archivedRows: 0,
 *     liveRows: 0,
 *     duplicateRows: 0,
 *     opaqueRows: 0,
 *     events: [],
 *   })
 * )
 * console.log(read.rows) // 0
 * ```
 *
 * @param history - The folded admission history.
 * @returns The read, with status `read`.
 * @category utilities
 * @since 0.0.0
 */
export const admissionStampReadOf = (history: AdmissionJournalHistory): AdmissionStampRead =>
  AdmissionStampRead.make({
    status: "read",
    rows: history.archivedRows + history.liveRows - history.duplicateRows,
    opaqueRows: history.opaqueRows,
    stamps: A.getSomes(A.map(history.events, stampRowOf)),
  });

// ---------------------------------------------------------------------------
// The join
// ---------------------------------------------------------------------------

interface PressureContext {
  readonly leases: HashMap.HashMap<string, A.NonEmptyReadonlyArray<EconomicsLeasePressure>>;
  readonly read: EconomicsPressureRead;
  readonly span: O.Option<readonly [number, number]>;
}

const samplesAbsent = (reason: EconomicsSamplesAbsent["reason"]): EconomicsSamplesJoin =>
  EconomicsSamplesAbsent.make({ reason });

const parseMillis = (value: O.Option<string>): O.Option<number> =>
  O.map(O.flatMap(value, DateTime.make), DateTime.toEpochMillis);

const attemptWindow = (attempt: EconomicsAttempt): O.Option<readonly [number, number]> =>
  O.filter(O.all([parseMillis(attempt.startedAt), parseMillis(attempt.endedAt)]), ([start, end]) => end >= start);

const figureOf = (values: A.NonEmptyReadonlyArray<number>): EconomicsPsiFigure =>
  EconomicsPsiFigure.make({
    mean: Num.round(Num.sumAll(values) / A.length(values), 2),
    max: A.max(values, Order.Number),
  });

// A figure is present only when every sample in the window carries it.
const everySample = (
  samples: A.NonEmptyReadonlyArray<PsiRecorderSample>,
  pick: (sample: PsiRecorderSample) => O.Option<number>
): O.Option<A.NonEmptyReadonlyArray<number>> =>
  O.flatMap(O.all(A.map(samples, pick)), A.match({ onEmpty: O.none, onNonEmpty: O.some }));

const windowOf = (samples: A.NonEmptyReadonlyArray<PsiRecorderSample>): EconomicsPsiWindow =>
  EconomicsPsiWindow.make({
    samples: A.length(samples),
    boots: HashSet.size(HashSet.fromIterable(A.map(samples, (sample) => sample.bootId))),
    cpuSome10: O.map(
      everySample(samples, (sample) => sample.cpuSome10),
      figureOf
    ),
    memorySome10: O.map(
      everySample(samples, (sample) => sample.memorySome10),
      figureOf
    ),
    ioSome10: O.map(
      everySample(samples, (sample) => sample.ioSome10),
      figureOf
    ),
    memAvailableGibMin: O.map(
      everySample(samples, (sample) => sample.memAvailableGib),
      A.min(Order.Number)
    ),
  });

const outsideSpan = (span: O.Option<readonly [number, number]>, [start, end]: readonly [number, number]): boolean =>
  O.match(span, { onNone: constant(true), onSome: ([first, last]) => end < first || start > last });

const windowJoin =
  (context: PressureContext) =>
  (window: readonly [number, number]): EconomicsSamplesJoin =>
    A.match(
      A.filter(context.read.recorder.samples, ({ atMillis }) => atMillis >= window[0] && atMillis <= window[1]),
      {
        onEmpty: () => samplesAbsent(outsideSpan(context.span, window) ? "outside-recorder" : "no-samples"),
        onNonEmpty: (samples) => EconomicsSamplesJoined.make({ window: windowOf(samples) }),
      }
    );

const samplesJoin = (context: PressureContext, attempt: EconomicsAttempt): EconomicsSamplesJoin =>
  EconomicsPressureReadStatus.is.read(context.read.recorder.status)
    ? O.match(attemptWindow(attempt), { onNone: () => samplesAbsent("untimed"), onSome: windowJoin(context) })
    : samplesAbsent("source-unread");

const admissionsJoin = (context: PressureContext, attempt: EconomicsAttempt): EconomicsAdmissionsJoin =>
  EconomicsPressureReadStatus.is.read(context.read.admissions.status)
    ? O.match(HashMap.get(context.leases, attempt.attemptId), {
        onNone: () => EconomicsAdmissionsAbsent.make({ reason: "no-admission-row" }),
        onSome: (leases) => EconomicsAdmissionsJoined.make({ leases }),
      })
    : EconomicsAdmissionsAbsent.make({ reason: "source-unread" });

const stampJoin = (
  rows: ReadonlyArray<AdmissionStampRow>,
  transition: AdmissionStampRow["transition"]
): EconomicsStampJoin =>
  O.match(
    A.findFirst(rows, (row) => row.transition === transition),
    {
      onNone: () => EconomicsStampAbsent.make({ reason: "no-row" }),
      onSome: (row) =>
        O.match(row.pressure, {
          onNone: () => EconomicsStampAbsent.make({ reason: "unstamped" }),
          onSome: (stamp) => EconomicsStampJoined.make({ stamp }),
        }),
    }
  );

const leaseOf =
  (rows: ReadonlyArray<AdmissionStampRow>) =>
  (nonce: string): EconomicsLeasePressure => {
    const own = A.filter(rows, (row) => row.nonce === nonce);
    return EconomicsLeasePressure.make({
      nonce,
      admitted: stampJoin(own, "admitted"),
      released: stampJoin(own, "released"),
    });
  };

// One lease per nonce, in the order the history first names it.
const leasesOf = (rows: A.NonEmptyReadonlyArray<AdmissionStampRow>): A.NonEmptyReadonlyArray<EconomicsLeasePressure> =>
  A.map(A.dedupe(A.map(rows, (row) => row.nonce)), leaseOf(rows));

const leasesByAttempt = (
  stamps: ReadonlyArray<AdmissionStampRow>
): HashMap.HashMap<string, A.NonEmptyReadonlyArray<EconomicsLeasePressure>> =>
  HashMap.fromIterable(
    A.map(R.toEntries(A.groupBy(stamps, (row) => row.attemptId)), ([attemptId, rows]) => [attemptId, leasesOf(rows)])
  );

const isRemote = (host: O.Option<string>, attempt: EconomicsAttempt): boolean =>
  O.exists(attempt.host, (written) => O.exists(host, (local) => local !== written));

const attemptPressure =
  (context: PressureContext, remoteJournal: boolean) =>
  (attempt: EconomicsAttempt): EconomicsAttemptPressure => {
    const remote = remoteJournal || isRemote(context.read.host, attempt);
    return EconomicsAttemptPressure.make({
      checkout: attempt.checkout,
      runId: attempt.runId,
      attemptId: attempt.attemptId,
      mode: attempt.mode,
      elapsedMs: attempt.elapsedMs,
      samples: remote ? samplesAbsent("remote-host") : samplesJoin(context, attempt),
      admissions: remote ? EconomicsAdmissionsAbsent.make({ reason: "remote-host" }) : admissionsJoin(context, attempt),
    });
  };

// ---------------------------------------------------------------------------
// Source rows
// ---------------------------------------------------------------------------

const gapOrder = Order.mapInput(Order.String, (row: EconomicsPressureGapCount) => row.reason);

const gapCounts = (reasons: ReadonlyArray<EconomicsPressureGap>): ReadonlyArray<EconomicsPressureGapCount> =>
  A.sort(
    A.map(A.dedupe(reasons), (reason) =>
      EconomicsPressureGapCount.make({ reason, count: A.filter(reasons, (each) => each === reason).length })
    ),
    gapOrder
  );

// The parts a source covers (recorder lines, or distinct admission rows) and how many did not decode.
interface SourceParts {
  readonly status: EconomicsPressureReadStatus;
  readonly total: number;
  readonly unit: string;
  readonly unread: number;
}

const readNote = ({ total, unread, unit }: SourceParts): string =>
  `; ${total} ${unit}${unread > 0 ? `; missing: ${unread} of ${total} ${unit} did not decode` : ""}`;

const partsNote = (parts: SourceParts): string =>
  EconomicsPressureReadStatus.match({
    read: () => readNote(parts),
    missing: () => "; missing: the source does not exist",
    unreadable: () => "; missing: the source could not be read",
    "not-read": () => "; not read on this path",
  })(parts.status);

// `present` only when every part was read; a source not read at all is `absent`.
const partsStatus = (parts: SourceParts): CiLedgerSourceStatus =>
  EconomicsPressureReadStatus.is.read(parts.status)
    ? ciLedgerSourceStatus(parts.total - parts.unread, parts.total)
    : "absent";

// `None` is a joined field, `Some` the reason it is absent.
const sourceRow = (
  source: EconomicsPressureSourceKind,
  base: string,
  parts: SourceParts,
  gaps: ReadonlyArray<O.Option<EconomicsPressureGap>>
): EconomicsPressureSourceRow =>
  EconomicsPressureSourceRow.make({
    source,
    status: partsStatus(parts),
    note: `${base}${partsNote(parts)}`,
    joined: A.filter(gaps, O.isNone).length,
    absent: gapCounts(A.getSomes(gaps)),
  });

const samplesGap: (join: EconomicsSamplesJoin) => O.Option<EconomicsPressureGap> = EconomicsSamplesJoin.match({
  joined: () => O.none<EconomicsPressureGap>(),
  absent: ({ reason }) => O.some(reason),
});

const admissionsGap: (join: EconomicsAdmissionsJoin) => O.Option<EconomicsPressureGap> = EconomicsAdmissionsJoin.match({
  joined: () => O.none<EconomicsPressureGap>(),
  absent: ({ reason }) => O.some(reason),
});

const sourceRows = (
  read: EconomicsPressureRead,
  attempts: ReadonlyArray<EconomicsAttemptPressure>
): ReadonlyArray<EconomicsPressureSourceRow> => [
  sourceRow(
    "psi-recorder",
    "PSI recorder lines (safe-pressure.jsonl), time-joined onto local attempt windows",
    { status: read.recorder.status, total: read.recorder.lines, unread: read.recorder.invalidLines, unit: "lines" },
    A.map(attempts, (attempt) => samplesGap(attempt.samples))
  ),
  sourceRow(
    "admission-journal",
    "admission history rows (archive and live journal), joined by attempt id",
    { status: read.admissions.status, total: read.admissions.rows, unread: read.admissions.opaqueRows, unit: "rows" },
    A.map(attempts, (attempt) => admissionsGap(attempt.admissions))
  ),
];

/**
 * Join the pressure sources onto every attempt of the local and remote
 * journals.
 *
 * **Details**
 *
 * Pure. A remote journal's attempts (the fleet hosts'), and a local attempt
 * whose start row names a host other than `read.host`, get both fields absent
 * as `remote-host`. Otherwise the samples join by window and the leases by
 * attempt id (see {@link EconomicsPressureGap} for each absence). Only the
 * local journals' attempts are listed, in journal order; the remote ones count
 * in the source rows alone.
 *
 * **Example** (Nothing read, no attempts)
 *
 * ```ts
 * import {
 *   AdmissionStampRead,
 *   EconomicsPressureRead,
 *   joinEconomicsPressure,
 *   PsiRecorderRead,
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const read = EconomicsPressureRead.make({
 *   host: O.none(),
 *   recorder: PsiRecorderRead.make({ status: "not-read", lines: 0, invalidLines: 0, samples: [] }),
 *   admissions: AdmissionStampRead.make({ status: "not-read", rows: 0, opaqueRows: 0, stamps: [] }),
 * })
 * const pressure = joinEconomicsPressure(read, [], [])
 * console.log(pressure.sources.map((row) => row.status)) // ["absent", "absent"]
 * ```
 *
 * @param read - What the pressure source read.
 * @param local - Journals read on this host.
 * @param remote - Journals read from other hosts.
 * @returns The report's pressure section.
 * @category utilities
 * @since 0.0.0
 */
export const joinEconomicsPressure: {
  (
    local: ReadonlyArray<EconomicsJournal>,
    remote: ReadonlyArray<EconomicsJournal>
  ): (read: EconomicsPressureRead) => EconomicsPressure;
  (
    read: EconomicsPressureRead,
    local: ReadonlyArray<EconomicsJournal>,
    remote: ReadonlyArray<EconomicsJournal>
  ): EconomicsPressure;
} = dual(
  3,
  (
    read: EconomicsPressureRead,
    local: ReadonlyArray<EconomicsJournal>,
    remote: ReadonlyArray<EconomicsJournal>
  ): EconomicsPressure => {
    const samples = read.recorder.samples;
    const context: PressureContext = {
      read,
      span: O.map(O.all([A.head(samples), A.last(samples)]), ([first, last]): readonly [number, number] => [
        first.atMillis,
        last.atMillis,
      ]),
      leases: leasesByAttempt(read.admissions.stamps),
    };
    const joinAll = (journals: ReadonlyArray<EconomicsJournal>, isRemoteJournal: boolean) =>
      A.flatMap(journals, (journal) => A.map(journal.attempts, attemptPressure(context, isRemoteJournal)));
    const attempts = joinAll(local, false);
    // A fleet host's attempts count in the source rows only: no host row leaves the fold (PERIL-11 slice 3).
    return EconomicsPressure.make({
      sources: sourceRows(read, A.appendAll(attempts, joinAll(remote, true))),
      attempts,
    });
  }
);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const gapList = (row: EconomicsPressureSourceRow): string =>
  A.match(row.absent, {
    onEmpty: () => "",
    onNonEmpty: (gaps) =>
      ` (absent: ${A.join(
        A.map(gaps, (gap) => `${gap.reason} ${gap.count}`),
        ", "
      )})`,
  });

const sourceLine = (row: EconomicsPressureSourceRow): string =>
  `${row.source} ${row.status}, ${row.joined} of ${row.joined + Num.sumAll(A.map(row.absent, (gap) => gap.count))} joined${gapList(row)}`;

const isStamped: (join: EconomicsStampJoin) => boolean = EconomicsStampJoin.guards.joined;

const stampLine = (attempts: ReadonlyArray<EconomicsAttemptPressure>): string => {
  const leases = A.flatMap(attempts, (attempt) =>
    EconomicsAdmissionsJoin.match(attempt.admissions, { joined: ({ leases }) => leases, absent: () => A.empty() })
  );
  const stamped = (pick: (lease: EconomicsLeasePressure) => EconomicsStampJoin) =>
    A.filter(leases, flow(pick, isStamped)).length;
  return `  stamps: ${stamped((lease) => lease.admitted)} admitted and ${stamped((lease) => lease.released)} released of ${A.length(leases)} joined lease(s)`;
};

/**
 * Render the pressure section for the terminal: one line per source and one
 * for the joined leases' stamps.
 *
 * **Example** (The default section)
 *
 * ```ts
 * import { EconomicsPressure, renderEconomicsPressure } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderEconomicsPressure(EconomicsPressure.make({}))[0]?.startsWith("pressure")) // true
 * ```
 *
 * @param pressure - The report's pressure section.
 * @returns The rendered lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderEconomicsPressure = (pressure: EconomicsPressure): ReadonlyArray<string> => [
  `pressure (MEAS-08 time join; context, not attribution): ${A.join(A.map(pressure.sources, sourceLine), "; ")}`,
  ...A.map(pressure.sources, (row) => `  ${row.source}: ${row.note}`),
  stampLine(pressure.attempts),
];

// ---------------------------------------------------------------------------
// Live source
// ---------------------------------------------------------------------------

const optionalConfigString = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none<string>));

const unreadRecorder = (status: EconomicsPressureReadStatus): PsiRecorderRead =>
  PsiRecorderRead.make({ status, lines: 0, invalidLines: 0, samples: A.empty() });

const readRecorder = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* optionalConfigString("HOME");
  return yield* O.match(O.filter(home, Str.isNonEmpty), {
    onNone: () => Effect.succeed(unreadRecorder("missing")),
    onSome: (directory) =>
      fs.readFileString(path.join(directory, RECORDER_RELATIVE_PATH)).pipe(
        Effect.map(decodePsiRecorderText),
        Effect.catchTag("PlatformError", (error) =>
          Effect.succeed(unreadRecorder(error.reason._tag === "NotFound" ? "missing" : "unreadable"))
        )
      ),
  });
});

const readAdmissions = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const choice = yield* perUserRuntimeRoot();
  const root = admissionRootFor(path, choice);
  return yield* readAdmissionJournalHistory(root).pipe(
    Effect.map(admissionStampReadOf),
    Effect.catchTag("QualitySchedulerError", () =>
      Effect.succeed(AdmissionStampRead.make({ status: "unreadable", rows: 0, opaqueRows: 0, stamps: A.empty() }))
    )
  );
});

const readPressure = Effect.fn("Yeet.Economics.readPressure")(function* () {
  const origin = yield* currentYeetAttemptOrigin;
  const recorder = yield* readRecorder();
  const admissions = yield* readAdmissions();
  return EconomicsPressureRead.make({ host: origin.host, recorder, admissions });
});

/**
 * Service contract for the pressure sources `yeet economics` joins.
 *
 * @category services
 * @since 0.0.0
 */
export interface YeetPressureSourceShape {
  readonly read: Effect.Effect<EconomicsPressureRead>;
}

const makeYeetPressureSource: Effect.Effect<YeetPressureSourceShape, never, FileSystem.FileSystem | Path.Path> =
  Effect.map(Effect.context<FileSystem.FileSystem | Path.Path>(), (context) => ({
    read: readPressure().pipe(Effect.provide(context)),
  }));

/**
 * Service boundary that reads the PSI recorder and the admission history
 * read-only for the pressure join.
 *
 * **Details**
 *
 * The recorder is `$HOME/.local/state/beep-psi/safe-pressure.jsonl`; without
 * `HOME`, or without the file, it reads `missing`, and any other failure
 * `unreadable`. The admission history is the scheduler's archive segments and
 * live journal under the per-user admission root, read without creating any
 * directory; a failed read is `unreadable`. `host` is this host's label, as
 * attempt-started rows write it. A read never fails.
 *
 * **Example** (Read the sources)
 *
 * ```ts
 * import { YeetPressureSource } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const source = yield* YeetPressureSource
 *   return yield* source.read
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YeetPressureSource extends Context.Service<YeetPressureSource, YeetPressureSourceShape>()(
  $I`YeetPressureSource`,
  { make: makeYeetPressureSource }
) {
  /** Live source over the filesystem. */
  static readonly layer: Layer.Layer<YeetPressureSource, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    YeetPressureSource,
    YeetPressureSource.make
  );
}
