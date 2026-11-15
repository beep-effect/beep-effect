/**
 * Schemas for the `yeet economics` pressure join (certainty-scorecard
 * MEAS-08): the PSI recorder samples and admission-journal stamps the join
 * reads, and the per-attempt pressure context it reports.
 *
 * **Details**
 *
 * Nothing here is sampled or written on a hot path. The recorder samples
 * (`$HOME/.local/state/beep-psi/safe-pressure.jsonl`, one line about every 30
 * seconds) and the SCHE-09 slice 2 stamps on admitted and released rows exist
 * already; the join only reads them. Pressure is context for the scheduler
 * levers, never attribution: every attempt running in the same window sees the
 * same samples.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AdmissionPressureStamp } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import { CiLedgerSourceStatus } from "../../Ci/CostLedger.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/EconomicsPressure.schemas");

// Derived counts, never operator input (the economics report's own rule).
const PressureCount = S.Int.check(S.isGreaterThanOrEqualTo(0));
const OptionalFinite = S.OptionFromNullOr(S.Finite);

/**
 * Why a joined pressure field is absent for one attempt or lease.
 *
 * **Details**
 *
 * `remote-host`: the attempt ran on another host (a fleet-host journal, or a
 * start row naming another host), which this host's recorder and admission
 * journal never saw. `source-unread`: the source was not read, or its read
 * failed (the source row says which). `untimed`: the attempt has no start or
 * end time, or its end precedes its start. `outside-recorder`: no sample falls
 * in the window and the window lies outside the recorder's sampled span (the
 * recorder keeps about 14 days). `no-samples`: the window lies inside the
 * span but no sample falls in it, as for an attempt shorter than the 30 s tick
 * or a recorder gap. `no-admission-row`: no admitted or released row in the
 * admission history carries the attempt id (never admitted, a routed worker,
 * written before rows carried attempt ids, or trimmed past the archive).
 * `no-row`: the lease has no row of this transition in the history (a lease
 * still held or evicted has no released row). `unstamped`: the row carries no
 * pressure stamp (the protocol's `pressure` gate was off, the writer predates
 * the stamp, a v1 released row, or a stamp this revision does not recognise).
 *
 * **Example** (Recognise a short attempt)
 *
 * ```ts
 * import { EconomicsPressureGap } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsPressureGap.is["no-samples"]("no-samples")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsPressureGap = LiteralKit([
  "remote-host",
  "source-unread",
  "untimed",
  "outside-recorder",
  "no-samples",
  "no-admission-row",
  "no-row",
  "unstamped",
]).pipe(
  $I.annoteSchema("EconomicsPressureGap", {
    description: "Why a joined pressure field is absent for one attempt or lease.",
  })
);

/**
 * Type of {@link EconomicsPressureGap}.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsPressureGap = typeof EconomicsPressureGap.Type;

const EconomicsSamplesGap = EconomicsPressureGap.pick([
  "remote-host",
  "source-unread",
  "untimed",
  "outside-recorder",
  "no-samples",
]).pipe($I.annoteSchema("EconomicsSamplesGap", { description: "Why an attempt has no joined recorder samples." }));

const EconomicsAdmissionsGap = EconomicsPressureGap.pick(["remote-host", "source-unread", "no-admission-row"]).pipe(
  $I.annoteSchema("EconomicsAdmissionsGap", { description: "Why an attempt has no joined admission leases." })
);

const EconomicsStampGap = EconomicsPressureGap.pick(["no-row", "unstamped"]).pipe(
  $I.annoteSchema("EconomicsStampGap", { description: "Why one lease transition has no joined pressure stamp." })
);

/**
 * One PSI recorder line as the join consumes it.
 *
 * **Details**
 *
 * `cpuSome10`, `memorySome10` and `ioSome10` are the `some avg10` figures of
 * the line's `/proc/pressure` texts and `memAvailableGib` its MemAvailable,
 * each absent when the line lacks it or it does not parse. `bootId` tells the
 * boots in one window apart.
 *
 * **Example** (A sample with every field)
 *
 * ```ts
 * import { PsiRecorderSample } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const sample = PsiRecorderSample.make({
 *   atMillis: 1_763_142_000_000,
 *   bootId: "boot-1",
 *   cpuSome10: O.some(1.5),
 *   memorySome10: O.some(0),
 *   ioSome10: O.some(3.2),
 *   memAvailableGib: O.some(88.1),
 * })
 * console.log(sample.bootId) // "boot-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PsiRecorderSample extends S.Opaque<PsiRecorderSample, { readonly brand: unique symbol }>()(
  S.Struct({
    atMillis: S.Finite,
    bootId: S.String,
    cpuSome10: OptionalFinite,
    memorySome10: OptionalFinite,
    ioSome10: OptionalFinite,
    memAvailableGib: OptionalFinite,
  }).pipe(
    $I.annoteSchema("PsiRecorderSample", {
      description: "One PSI recorder line: its instant, boot id, PSI some avg10 figures and MemAvailable.",
    })
  )
) {}

/**
 * How a pressure source read went.
 *
 * **Details**
 *
 * `read`: the source was read (an empty admission journal reads as `read`
 * with no rows). `missing`: the recorder file does not exist, or `HOME` is
 * unset. `unreadable`: the read failed for another reason. `not-read`: the
 * caller did not read the source, as the closeout summary does not.
 *
 * **Example** (A source the caller skipped)
 *
 * ```ts
 * import { EconomicsPressureReadStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsPressureReadStatus.is["not-read"]("not-read")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsPressureReadStatus = LiteralKit(["read", "missing", "unreadable", "not-read"]).pipe(
  $I.annoteSchema("EconomicsPressureReadStatus", {
    description: "Whether a pressure source was read, missing, unreadable or not read by the caller.",
  })
);

/**
 * Type of {@link EconomicsPressureReadStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsPressureReadStatus = typeof EconomicsPressureReadStatus.Type;

/**
 * The PSI recorder file as read: its decoded samples and the lines that did
 * not decode.
 *
 * **Example** (A recorder that was not read)
 *
 * ```ts
 * import { PsiRecorderRead } from "@beep/repo-cli/test/Yeet"
 *
 * const read = PsiRecorderRead.make({ status: "not-read", lines: 0, invalidLines: 0, samples: [] })
 * console.log(read.status) // "not-read"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PsiRecorderRead extends S.Opaque<PsiRecorderRead, { readonly brand: unique symbol }>()(
  S.Struct({
    status: EconomicsPressureReadStatus,
    lines: PressureCount,
    invalidLines: PressureCount,
    samples: S.Array(PsiRecorderSample),
  }).pipe(
    $I.annoteSchema("PsiRecorderRead", {
      description: "The PSI recorder file's read status, line counts and decoded samples.",
    })
  )
) {}

/**
 * Which admission transition a stamp row records.
 *
 * **Example** (Recognise a release)
 *
 * ```ts
 * import { AdmissionStampTransition } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(AdmissionStampTransition.is.released("released")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionStampTransition = LiteralKit(["admitted", "released"]).pipe(
  $I.annoteSchema("AdmissionStampTransition", {
    description: "The admission transition an admission-journal stamp row records.",
  })
);

/**
 * Type of {@link AdmissionStampTransition}.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionStampTransition = typeof AdmissionStampTransition.Type;

/**
 * One admitted or released admission-journal row that carries an attempt id,
 * with its pressure stamp when it has one.
 *
 * **Example** (An unstamped admission)
 *
 * ```ts
 * import { AdmissionStampRow } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = AdmissionStampRow.make({ nonce: "n-1", attemptId: "a-1", transition: "admitted", pressure: O.none() })
 * console.log(row.transition) // "admitted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionStampRow extends S.Opaque<AdmissionStampRow, { readonly brand: unique symbol }>()(
  S.Struct({
    nonce: S.String,
    attemptId: S.String,
    transition: AdmissionStampTransition,
    pressure: S.OptionFromNullOr(AdmissionPressureStamp),
  }).pipe(
    $I.annoteSchema("AdmissionStampRow", {
      description: "An admitted or released admission-journal row with an attempt id and its optional pressure stamp.",
    })
  )
) {}

/**
 * The admission history as read for the join.
 *
 * **Details**
 *
 * `rows` counts the history's distinct rows and `opaqueRows` the ones this
 * revision could not decode; `stamps` keeps only admitted and released rows
 * that carry an attempt id.
 *
 * **Example** (A history read with no rows)
 *
 * ```ts
 * import { AdmissionStampRead } from "@beep/repo-cli/test/Yeet"
 *
 * const read = AdmissionStampRead.make({ status: "read", rows: 0, opaqueRows: 0, stamps: [] })
 * console.log(read.stamps.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionStampRead extends S.Opaque<AdmissionStampRead, { readonly brand: unique symbol }>()(
  S.Struct({
    status: EconomicsPressureReadStatus,
    rows: PressureCount,
    opaqueRows: PressureCount,
    stamps: S.Array(AdmissionStampRow),
  }).pipe(
    $I.annoteSchema("AdmissionStampRead", {
      description: "The admission history's read status, row counts and attempt-keyed admitted and released rows.",
    })
  )
) {}

/**
 * Everything the pressure join reads: this host's label, the PSI recorder and
 * the admission history.
 *
 * **Example** (Nothing read)
 *
 * ```ts
 * import { AdmissionStampRead, EconomicsPressureRead, PsiRecorderRead } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const read = EconomicsPressureRead.make({
 *   host: O.none(),
 *   recorder: PsiRecorderRead.make({ status: "not-read", lines: 0, invalidLines: 0, samples: [] }),
 *   admissions: AdmissionStampRead.make({ status: "not-read", rows: 0, opaqueRows: 0, stamps: [] }),
 * })
 * console.log(read.recorder.status) // "not-read"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsPressureRead extends S.Opaque<EconomicsPressureRead, { readonly brand: unique symbol }>()(
  S.Struct({
    host: S.OptionFromNullOr(S.String),
    recorder: PsiRecorderRead,
    admissions: AdmissionStampRead,
  }).pipe(
    $I.annoteSchema("EconomicsPressureRead", {
      description: "This host's label, the PSI recorder read and the admission history read the pressure join uses.",
    })
  )
) {}

/**
 * Mean and maximum of one PSI figure over a window's samples.
 *
 * **Example** (A window's CPU figure)
 *
 * ```ts
 * import { EconomicsPsiFigure } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsPsiFigure.make({ mean: 1.25, max: 2 }).max) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsPsiFigure extends S.Opaque<EconomicsPsiFigure, { readonly brand: unique symbol }>()(
  S.Struct({ mean: S.Finite, max: S.Finite }).pipe(
    $I.annoteSchema("EconomicsPsiFigure", {
      description: "Mean (rounded to 0.01) and maximum of one PSI some avg10 figure over a window's samples.",
    })
  )
) {}

/**
 * The recorder samples inside one attempt's window, summarised.
 *
 * **Details**
 *
 * A sample is in the window when its instant lies between the attempt's start
 * and end, both included. `boots` counts distinct boot ids, so a window that
 * spans a reboot reads 2. Each figure is present only when every sample in the
 * window carries it, never a summary over only some of them.
 *
 * **Example** (A window with one sample and no MemAvailable)
 *
 * ```ts
 * import { EconomicsPsiFigure, EconomicsPsiWindow } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const figure = EconomicsPsiFigure.make({ mean: 1, max: 1 })
 * const window = EconomicsPsiWindow.make({
 *   samples: 1,
 *   boots: 1,
 *   cpuSome10: O.some(figure),
 *   memorySome10: O.some(figure),
 *   ioSome10: O.some(figure),
 *   memAvailableGibMin: O.none(),
 * })
 * console.log(window.samples) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsPsiWindow extends S.Opaque<EconomicsPsiWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    samples: PressureCount,
    boots: PressureCount,
    cpuSome10: S.OptionFromNullOr(EconomicsPsiFigure),
    memorySome10: S.OptionFromNullOr(EconomicsPsiFigure),
    ioSome10: S.OptionFromNullOr(EconomicsPsiFigure),
    memAvailableGibMin: OptionalFinite,
  }).pipe(
    $I.annoteSchema("EconomicsPsiWindow", {
      description: "Sample and boot counts, PSI some avg10 mean and max, and minimum MemAvailable over one window.",
    })
  )
) {}

/**
 * An attempt's recorder samples were joined.
 *
 * **Example** (Read the joined window)
 *
 * ```ts
 * import { EconomicsPsiWindow, EconomicsSamplesJoined } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const joined = EconomicsSamplesJoined.make({
 *   window: EconomicsPsiWindow.make({
 *     samples: 0,
 *     boots: 0,
 *     cpuSome10: O.none(),
 *     memorySome10: O.none(),
 *     ioSome10: O.none(),
 *     memAvailableGibMin: O.none(),
 *   }),
 * })
 * console.log(joined._tag) // "joined"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsSamplesJoined extends S.Opaque<EconomicsSamplesJoined, { readonly brand: unique symbol }>()(
  S.TaggedStruct("joined", { window: EconomicsPsiWindow }).pipe(
    $I.annoteSchema("EconomicsSamplesJoined", { description: "The recorder samples in an attempt's window." })
  )
) {}

/**
 * An attempt has no joined recorder samples, and why.
 *
 * **Example** (A remote attempt)
 *
 * ```ts
 * import { EconomicsSamplesAbsent } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsSamplesAbsent.make({ reason: "remote-host" }).reason) // "remote-host"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsSamplesAbsent extends S.Opaque<EconomicsSamplesAbsent, { readonly brand: unique symbol }>()(
  S.TaggedStruct("absent", { reason: EconomicsSamplesGap }).pipe(
    $I.annoteSchema("EconomicsSamplesAbsent", { description: "Why an attempt has no joined recorder samples." })
  )
) {}

/**
 * An attempt's recorder samples: joined, or absent with the reason.
 *
 * **Example** (Match a samples join)
 *
 * ```ts
 * import { EconomicsSamplesAbsent, EconomicsSamplesJoin } from "@beep/repo-cli/test/Yeet"
 *
 * const text = EconomicsSamplesJoin.match(EconomicsSamplesAbsent.make({ reason: "untimed" }), {
 *   joined: ({ window }) => `${window.samples} samples`,
 *   absent: ({ reason }) => reason,
 * })
 * console.log(text) // "untimed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsSamplesJoin = S.Union([EconomicsSamplesJoined, EconomicsSamplesAbsent]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("EconomicsSamplesJoin", { description: "An attempt's recorder samples, joined or absent." })
);

/**
 * Type of {@link EconomicsSamplesJoin}.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsSamplesJoin = typeof EconomicsSamplesJoin.Type;

/**
 * One lease transition's pressure stamp was joined.
 *
 * **Example** (A joined admission stamp)
 *
 * ```ts
 * import { EconomicsStampJoined } from "@beep/repo-cli/test/Yeet"
 * import { AdmissionPressureStamp } from "@beep/repo-cli/test/RepoRun"
 *
 * const stamp = AdmissionPressureStamp.make({
 *   capacityTokens: 8,
 *   activeTokens: 3,
 *   queuedTokens: 0,
 *   queuedTickets: 0,
 *   memAvailableGib: 50,
 * })
 * console.log(EconomicsStampJoined.make({ stamp })._tag) // "joined"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsStampJoined extends S.Opaque<EconomicsStampJoined, { readonly brand: unique symbol }>()(
  S.TaggedStruct("joined", { stamp: AdmissionPressureStamp }).pipe(
    $I.annoteSchema("EconomicsStampJoined", { description: "The pressure stamp of one lease transition." })
  )
) {}

/**
 * One lease transition has no joined pressure stamp, and why.
 *
 * **Example** (A stamp written while the gate was off)
 *
 * ```ts
 * import { EconomicsStampAbsent } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsStampAbsent.make({ reason: "unstamped" }).reason) // "unstamped"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsStampAbsent extends S.Opaque<EconomicsStampAbsent, { readonly brand: unique symbol }>()(
  S.TaggedStruct("absent", { reason: EconomicsStampGap }).pipe(
    $I.annoteSchema("EconomicsStampAbsent", { description: "Why one lease transition has no joined pressure stamp." })
  )
) {}

/**
 * One lease transition's pressure stamp: joined, or absent with the reason.
 *
 * **Example** (Match a stamp join)
 *
 * ```ts
 * import { EconomicsStampAbsent, EconomicsStampJoin } from "@beep/repo-cli/test/Yeet"
 *
 * const text = EconomicsStampJoin.match(EconomicsStampAbsent.make({ reason: "no-row" }), {
 *   joined: ({ stamp }) => `${stamp.activeTokens} active`,
 *   absent: ({ reason }) => reason,
 * })
 * console.log(text) // "no-row"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsStampJoin = S.Union([EconomicsStampJoined, EconomicsStampAbsent]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("EconomicsStampJoin", { description: "One lease transition's pressure stamp, joined or absent." })
);

/**
 * Type of {@link EconomicsStampJoin}.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsStampJoin = typeof EconomicsStampJoin.Type;

/**
 * One admission lease of an attempt, keyed by its nonce, with the admitted and
 * released stamps.
 *
 * **Example** (A lease still held)
 *
 * ```ts
 * import { EconomicsLeasePressure, EconomicsStampAbsent } from "@beep/repo-cli/test/Yeet"
 *
 * const lease = EconomicsLeasePressure.make({
 *   nonce: "n-1",
 *   admitted: EconomicsStampAbsent.make({ reason: "unstamped" }),
 *   released: EconomicsStampAbsent.make({ reason: "no-row" }),
 * })
 * console.log(lease.released._tag) // "absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsLeasePressure extends S.Opaque<EconomicsLeasePressure, { readonly brand: unique symbol }>()(
  S.Struct({
    nonce: S.String,
    admitted: EconomicsStampJoin,
    released: EconomicsStampJoin,
  }).pipe(
    $I.annoteSchema("EconomicsLeasePressure", {
      description: "One admission lease of an attempt, by nonce, with its admitted and released pressure stamps.",
    })
  )
) {}

/**
 * An attempt's admission leases were joined by attempt id.
 *
 * **Example** (One joined lease)
 *
 * ```ts
 * import { EconomicsAdmissionsJoined, EconomicsLeasePressure, EconomicsStampAbsent } from "@beep/repo-cli/test/Yeet"
 *
 * const absent = EconomicsStampAbsent.make({ reason: "unstamped" })
 * const joined = EconomicsAdmissionsJoined.make({
 *   leases: [EconomicsLeasePressure.make({ nonce: "n-1", admitted: absent, released: absent })],
 * })
 * console.log(joined.leases.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsAdmissionsJoined extends S.Opaque<EconomicsAdmissionsJoined, { readonly brand: unique symbol }>()(
  S.TaggedStruct("joined", { leases: S.NonEmptyArray(EconomicsLeasePressure) }).pipe(
    $I.annoteSchema("EconomicsAdmissionsJoined", {
      description: "The admission leases whose admitted or released rows carry the attempt's id.",
    })
  )
) {}

/**
 * An attempt has no joined admission leases, and why.
 *
 * **Example** (No admission row)
 *
 * ```ts
 * import { EconomicsAdmissionsAbsent } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsAdmissionsAbsent.make({ reason: "no-admission-row" }).reason) // "no-admission-row"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsAdmissionsAbsent extends S.Opaque<EconomicsAdmissionsAbsent, { readonly brand: unique symbol }>()(
  S.TaggedStruct("absent", { reason: EconomicsAdmissionsGap }).pipe(
    $I.annoteSchema("EconomicsAdmissionsAbsent", { description: "Why an attempt has no joined admission leases." })
  )
) {}

/**
 * An attempt's admission leases: joined, or absent with the reason.
 *
 * **Example** (Match an admissions join)
 *
 * ```ts
 * import { EconomicsAdmissionsAbsent, EconomicsAdmissionsJoin } from "@beep/repo-cli/test/Yeet"
 *
 * const text = EconomicsAdmissionsJoin.match(EconomicsAdmissionsAbsent.make({ reason: "remote-host" }), {
 *   joined: ({ leases }) => `${leases.length} leases`,
 *   absent: ({ reason }) => reason,
 * })
 * console.log(text) // "remote-host"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsAdmissionsJoin = S.Union([EconomicsAdmissionsJoined, EconomicsAdmissionsAbsent]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("EconomicsAdmissionsJoin", { description: "An attempt's admission leases, joined or absent." })
);

/**
 * Type of {@link EconomicsAdmissionsJoin}.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsAdmissionsJoin = typeof EconomicsAdmissionsJoin.Type;

/**
 * The pressure context joined onto one attempt.
 *
 * **Details**
 *
 * `mode` and `elapsedMs` are the attempt's own, so a row can be read against
 * its duration without another join.
 *
 * **Example** (An attempt whose start row names another host)
 *
 * ```ts
 * import { EconomicsAdmissionsAbsent, EconomicsAttemptPressure, EconomicsSamplesAbsent } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = EconomicsAttemptPressure.make({
 *   checkout: "beep-effect",
 *   runId: "main-0123456789ab",
 *   attemptId: "a-1",
 *   mode: O.some("verify"),
 *   elapsedMs: O.some(60000),
 *   samples: EconomicsSamplesAbsent.make({ reason: "remote-host" }),
 *   admissions: EconomicsAdmissionsAbsent.make({ reason: "remote-host" }),
 * })
 * console.log(row.samples._tag) // "absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsAttemptPressure extends S.Opaque<EconomicsAttemptPressure, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.String,
    runId: S.String,
    attemptId: S.String,
    mode: S.OptionFromNullOr(S.String),
    elapsedMs: OptionalFinite,
    samples: EconomicsSamplesJoin,
    admissions: EconomicsAdmissionsJoin,
  }).pipe(
    $I.annoteSchema("EconomicsAttemptPressure", {
      description: "One attempt's joined recorder samples and admission leases, each absent with its reason.",
    })
  )
) {}

/**
 * A source the pressure join reads.
 *
 * **Example** (List the sources)
 *
 * ```ts
 * import { EconomicsPressureSourceKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsPressureSourceKind.literals) // ["psi-recorder", "admission-journal"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsPressureSourceKind = LiteralKit(["psi-recorder", "admission-journal"]).pipe(
  $I.annoteSchema("EconomicsPressureSourceKind", {
    description: "A source the pressure join reads: the PSI recorder or the admission journal.",
  })
);

/**
 * Type of {@link EconomicsPressureSourceKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsPressureSourceKind = typeof EconomicsPressureSourceKind.Type;

/**
 * How many attempts lack a joined field for one reason.
 *
 * **Example** (Three short attempts)
 *
 * ```ts
 * import { EconomicsPressureGapCount } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsPressureGapCount.make({ reason: "no-samples", count: 3 }).count) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsPressureGapCount extends S.Opaque<EconomicsPressureGapCount, { readonly brand: unique symbol }>()(
  S.Struct({ reason: EconomicsPressureGap, count: PressureCount }).pipe(
    $I.annoteSchema("EconomicsPressureGapCount", {
      description: "How many attempts lack a joined pressure field for one reason.",
    })
  )
) {}

/**
 * One pressure source, how much of it was read, and how many attempts it
 * joined.
 *
 * **Details**
 *
 * `status` follows the cost ledger's rule: `present` only when every part the
 * note names was read, `partial` when some part was not (the note names it),
 * `absent` when nothing was. The recorder's parts are its lines and the
 * admission journal's are its distinct rows; a line or row that does not
 * decode is an unread part. `joined` counts attempts with the field joined
 * and `absent` the others by reason, so the two sum to every attempt in the
 * report, the fleet hosts' included.
 *
 * **Example** (A recorder that was not read)
 *
 * ```ts
 * import { EconomicsPressureSourceRow } from "@beep/repo-cli/test/Yeet"
 *
 * const row = EconomicsPressureSourceRow.make({
 *   source: "psi-recorder",
 *   status: "absent",
 *   note: "PSI recorder samples; not read on this path",
 *   joined: 0,
 *   absent: [],
 * })
 * console.log(row.status) // "absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsPressureSourceRow extends S.Opaque<
  EconomicsPressureSourceRow,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    source: EconomicsPressureSourceKind,
    status: CiLedgerSourceStatus,
    note: S.String,
    joined: PressureCount,
    absent: S.Array(EconomicsPressureGapCount),
  }).pipe(
    $I.annoteSchema("EconomicsPressureSourceRow", {
      description: "One pressure source, its read status with the parts it missed, and its joined and absent counts.",
    })
  )
) {}

/**
 * The report's pressure section: one row per source and the context joined
 * onto each attempt.
 *
 * **Details**
 *
 * `attempts` lists the attempts of journals read on this host. A fleet host's
 * attempts are counted in each source row as `remote-host` and never listed:
 * only aggregates leave the fleet-host fold (PERIL-11 slice 3). The default (used where the caller reads no pressure source, as the
 * closeout summary) lists no attempts and marks both sources `absent`.
 *
 * **Example** (The default section)
 *
 * ```ts
 * import { EconomicsPressure } from "@beep/repo-cli/test/Yeet"
 *
 * const section = EconomicsPressure.make({})
 * console.log(section.sources.map((row) => row.status)) // ["absent", "absent"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsPressure extends S.Opaque<EconomicsPressure, { readonly brand: unique symbol }>()(
  S.Struct({
    sources: S.Array(EconomicsPressureSourceRow).pipe(
      S.withConstructorDefault(
        Effect.succeed(
          A.map(EconomicsPressureSourceKind.literals, (source) =>
            EconomicsPressureSourceRow.make({
              source,
              status: "absent",
              note: "not read on this path",
              joined: 0,
              absent: A.empty(),
            })
          )
        )
      )
    ),
    attempts: S.Array(EconomicsAttemptPressure).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EconomicsAttemptPressure>()))
    ),
  }).pipe(
    $I.annoteSchema("EconomicsPressure", {
      description: "Pressure sources with their read status, and the PSI samples and admission stamps per attempt.",
    })
  )
) {}
