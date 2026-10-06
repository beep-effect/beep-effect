/**
 * Schema-first domain model for the W8 KPI reading (S7 contract §9, KPI law v1.2 §7).
 *
 * **Details**
 *
 * These schemas classify and measure; none of them ratifies vocabulary. Tier
 * literals name ETL classification buckets onto the ratified assurance tiers
 * (KPI law v1.2 §7.3), instants are UTC `DateTime` values encoded as ISO
 * strings, and durations are non-negative integer milliseconds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { PosInt } from "../projection/PosInt.ts";
import { RepoRelativePath } from "../projection/Schemas.ts";

const $I = $CiopsId.create("kpi/Schemas");

/**
 * ETL classification of an attempt or episode onto the ratified assurance tiers.
 *
 * **Details**
 *
 * KPI law v1.2 §7.3: `repair-green` is TierRepairGreen, `local-full-proof` is
 * TierLocalFullProof, `local-full-proof-merged-preview` is its merged-preview
 * sub-partition (by stage, never by admission kind), and `ci-merge-green` is
 * TierCiMergeGreen. `unassigned` is the reported bucket for pre-push
 * cheap-gates and every review-fix attempt; `untiered` counts starts that carry
 * no `stage` member. The two buckets are reporting classes, not tiers.
 *
 * **Example** (Recognize the merged-preview sub-partition)
 *
 * ```ts
 * import { KpiTier } from "@/kpi/Schemas"
 *
 * console.log(KpiTier.is["local-full-proof-merged-preview"]("local-full-proof-merged-preview")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KpiTier = LiteralKit([
  "repair-green",
  "local-full-proof",
  "local-full-proof-merged-preview",
  "ci-merge-green",
  "unassigned",
  "untiered",
]).pipe(
  $I.annoteSchema("KpiTier", {
    description: "ETL classification of an attempt onto a ratified assurance tier, its sub-partition, or a bucket.",
  })
);

/**
 * Decoded classification accepted by {@link KpiTier}.
 *
 * @see {@link KpiTier} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type KpiTier = typeof KpiTier.Type;

/**
 * Clock label carried by every episode (KPI law v1.2 §7.4).
 *
 * **Details**
 *
 * `seat-request` when a ticket joined to the streak's first attempt set the
 * opening instant; otherwise `attempt-start`.
 *
 * **Example** (Recognize the seat-request clock)
 *
 * ```ts
 * import { EpisodeClock } from "@/kpi/Schemas"
 *
 * console.log(EpisodeClock.is["seat-request"]("seat-request")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EpisodeClock = LiteralKit(["seat-request", "attempt-start"]).pipe(
  $I.annoteSchema("EpisodeClock", {
    description: "Which instant opened a KPI episode: a joined seat request or the first attempt start.",
  })
);

/**
 * Decoded clock label accepted by {@link EpisodeClock}.
 *
 * @see {@link EpisodeClock} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type EpisodeClock = typeof EpisodeClock.Type;

/**
 * Censoring classes the reading counts (KPI law v1.2 §7.5).
 *
 * **Details**
 *
 * `right-censored` is an open streak at its last measured instant;
 * `left-censored` has a compaction receipt cutoff at or after its opening;
 * `possibly-truncated` opens at the first retained attempt of an at-cap
 * journal with no receipt; `survivorship` is an enqueue naming an attempt with
 * no pinned journal, counted and never imputed.
 *
 * **Example** (Recognize the possibly-truncated class)
 *
 * ```ts
 * import { CensorClass } from "@/kpi/Schemas"
 *
 * console.log(CensorClass.is["possibly-truncated"]("possibly-truncated")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CensorClass = LiteralKit(["right-censored", "left-censored", "possibly-truncated", "survivorship"]).pipe(
  $I.annoteSchema("CensorClass", {
    description: "Censoring or survivorship class a KPI episode or seat request is counted under.",
  })
);

/**
 * Decoded censoring class accepted by {@link CensorClass}.
 *
 * @see {@link CensorClass} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type CensorClass = typeof CensorClass.Type;

/**
 * Adoption class of an episode against one change event (launch sitting Ruling 8).
 *
 * **Details**
 *
 * `pre` started before the event's `landedAt`; `post-adopted` started after it
 * on a head whose ancestry includes the merge commit; `post-unadopted` started
 * after it without that ancestry and is reported outside the post-period;
 * `unknown` has a head absent from the object store.
 *
 * **Example** (Recognize the post-unadopted class)
 *
 * ```ts
 * import { AdoptionClass } from "@/kpi/Schemas"
 *
 * console.log(AdoptionClass.is["post-unadopted"]("post-unadopted")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdoptionClass = LiteralKit(["pre", "post-adopted", "post-unadopted", "unknown"]).pipe(
  $I.annoteSchema("AdoptionClass", {
    description: "Adoption-qualified membership of an episode relative to one operational change event.",
  })
);

/**
 * Decoded adoption class accepted by {@link AdoptionClass}.
 *
 * @see {@link AdoptionClass} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdoptionClass = typeof AdoptionClass.Type;

/**
 * Window slices reported by the reading (launch sitting Ruling 5).
 *
 * **Details**
 *
 * `W` is the post-baseline window; `W-a` ends at M1's measurement instant for
 * the M1-replica; `W-b` is the canonical admission root's retained window,
 * where the seat-request clock is complete and CQ-012 shares may be printed.
 *
 * **Example** (Recognize the retained-admission slice)
 *
 * ```ts
 * import { WindowSlice } from "@/kpi/Schemas"
 *
 * console.log(WindowSlice.is["W-b"]("W-b")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WindowSlice = LiteralKit(["W", "W-a", "W-b"]).pipe(
  $I.annoteSchema("WindowSlice", {
    description: "Named slice of the ratified KPI window that a reading row is computed over.",
  })
);

/**
 * Decoded window slice accepted by {@link WindowSlice}.
 *
 * @see {@link WindowSlice} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type WindowSlice = typeof WindowSlice.Type;

/**
 * Series a change-event row partitions, read from its adoption-qualified caveat.
 *
 * **Details**
 *
 * `local` names the local series (both local tiers and the unassigned
 * bucket); `hosted` names TierCiMergeGreen, which the reading reports
 * unmeasured. A row with both carries both members.
 *
 * **Example** (Recognize the local series)
 *
 * ```ts
 * import { ChangeEventSeries } from "@/kpi/Schemas"
 *
 * console.log(ChangeEventSeries.is.local("local")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChangeEventSeries = LiteralKit(["local", "hosted"]).pipe(
  $I.annoteSchema("ChangeEventSeries", {
    description: "Series an operational change event partitions, per its adoption-qualified membership caveat.",
  })
);

/**
 * Decoded series accepted by {@link ChangeEventSeries}.
 *
 * @see {@link ChangeEventSeries} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type ChangeEventSeries = typeof ChangeEventSeries.Type;

/**
 * Outcome of one `git merge-base --is-ancestor` probe in the adoption table.
 *
 * **Example** (Recognize a missing head)
 *
 * ```ts
 * import { AncestryVerdict } from "@/kpi/Schemas"
 *
 * console.log(AncestryVerdict.is["head-missing"]("head-missing")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AncestryVerdict = LiteralKit(["ancestor", "not-ancestor", "head-missing"]).pipe(
  $I.annoteSchema("AncestryVerdict", {
    description: "Whether a change event's merge commit is an ancestor of an episode's resolved head.",
  })
);

/**
 * Decoded verdict accepted by {@link AncestryVerdict}.
 *
 * @see {@link AncestryVerdict} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AncestryVerdict = typeof AncestryVerdict.Type;

/**
 * Pinned inputs the KPI service reads by path and SHA-256 (S7 contract §9).
 *
 * **Details**
 *
 * `fleet-manifest` is the `run4-fleet` MANIFEST, whose per-file digests pin the
 * attempt journals; `fleet-admission-journal` is its canonical admission
 * journal; `admission-snapshot` is the 2026-10-01 redacted snapshot;
 * `adoption-table` is the committed ancestry table; `change-event-ledger` is
 * the control-interventions ledger the lab's constant table is asserted
 * against.
 *
 * **Example** (Recognize the adoption table role)
 *
 * ```ts
 * import { KpiInputRole } from "@/kpi/Schemas"
 *
 * console.log(KpiInputRole.is["adoption-table"]("adoption-table")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KpiInputRole = LiteralKit([
  "fleet-manifest",
  "fleet-admission-journal",
  "admission-snapshot",
  "adoption-table",
  "change-event-ledger",
]).pipe(
  $I.annoteSchema("KpiInputRole", {
    description: "Role of a pinned document the KPI reading consumes by repo-relative path and SHA-256.",
  })
);

/**
 * Decoded input role accepted by {@link KpiInputRole}.
 *
 * @see {@link KpiInputRole} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type KpiInputRole = typeof KpiInputRole.Type;

/**
 * Lowercase 40-hex git commit id, as the change-event ledger and attempt starts record it.
 *
 * **Example** (Accept a merge commit)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GitCommitSha } from "@/kpi/Schemas"
 *
 * console.log(S.is(GitCommitSha)("debbbb51f77ae10015788dec0b819f12b96c3552")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitCommitSha = S.String.check(
  S.isPattern(/^[0-9a-f]{40}$/, { message: "Commit ids must be 40 lowercase hex characters" })
).pipe(
  $I.annoteSchema("GitCommitSha", {
    description: "Full lowercase hexadecimal git commit id.",
  })
);

/**
 * Decoded commit id accepted by {@link GitCommitSha}.
 *
 * @see {@link GitCommitSha} for runtime decoding.
 * @category models
 * @since 0.0.0
 */
export type GitCommitSha = typeof GitCommitSha.Type;

/**
 * Change-event ledger id such as `iv-1427-push-first-publish`.
 *
 * **Example** (Accept a ledger id)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ChangeEventId } from "@/kpi/Schemas"
 *
 * console.log(S.is(ChangeEventId)("iv-1427-push-first-publish")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChangeEventId = S.String.check(
  S.isPattern(/^iv-[0-9]+(-[a-z0-9]+)+$/, { message: "Change-event ids must look like iv-<pr>-<slug>" })
).pipe(
  $I.annoteSchema("ChangeEventId", {
    description: "Stable id of one operational change-event row in the control-interventions ledger.",
  })
);

/**
 * Decoded ledger id accepted by {@link ChangeEventId}.
 *
 * @see {@link ChangeEventId} for runtime decoding.
 * @category models
 * @since 0.0.0
 */
export type ChangeEventId = typeof ChangeEventId.Type;

/**
 * One pinned input: its role, repo-relative path and expected SHA-256.
 *
 * **Example** (Pin the adoption table)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { PinnedKpiInput } from "@/kpi/Schemas"
 *
 * const input = PinnedKpiInput.make({
 *   role: "adoption-table",
 *   path: "apps/labs/ciops/test/fixtures/adoption-table.json",
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(input.role) // "adoption-table"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PinnedKpiInput extends S.Class<PinnedKpiInput>($I`PinnedKpiInput`)(
  { role: KpiInputRole, path: RepoRelativePath, sha256: Sha256Hex },
  $I.annote("PinnedKpiInput", {
    description: "Role, repo-relative path and pinned SHA-256 of one document the KPI reading consumes.",
  })
) {}

/**
 * Request to compute the KPI reading from pinned inputs under a repo root.
 *
 * **Details**
 *
 * `repoRoot` is a locator only; every input is checked against its SHA-256
 * over the raw bytes before any decode.
 *
 * **Example** (Construct a reading request)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { KpiReadingInput, PinnedKpiInput } from "@/kpi/Schemas"
 *
 * const input = KpiReadingInput.make({
 *   repoRoot: ".",
 *   inputs: [
 *     PinnedKpiInput.make({
 *       role: "change-event-ledger",
 *       path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
 *       sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *     })
 *   ]
 * })
 * console.log(input.inputs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KpiReadingInput extends S.Class<KpiReadingInput>($I`KpiReadingInput`)(
  { repoRoot: S.NonEmptyString, inputs: S.NonEmptyArray(PinnedKpiInput) },
  $I.annote("KpiReadingInput", {
    description: "Caller-supplied repo root plus the pinned documents the KPI reading is computed from.",
  })
) {}

/**
 * Episode key: one `(checkout, branch)` pair (KPI law §1; v1.2 §7.1).
 *
 * **Example** (Key an episode)
 *
 * ```ts
 * import { EpisodeKey } from "@/kpi/Schemas"
 *
 * const key = EpisodeKey.make({ checkout: "beep-effect", branch: "feat/ciops-p4-kpi-etl" })
 * console.log(key.branch) // "feat/ciops-p4-kpi-etl"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EpisodeKey extends S.Class<EpisodeKey>($I`EpisodeKey`)(
  { checkout: S.NonEmptyString, branch: S.NonEmptyString },
  $I.annote("EpisodeKey", {
    description: "Fleet-relative checkout label and branch that together key one red streak.",
  })
) {}

/**
 * Adoption class of an episode against one change event.
 *
 * **Example** (Record a post-adopted episode)
 *
 * ```ts
 * import { EpisodeAdoption } from "@/kpi/Schemas"
 *
 * const adoption = EpisodeAdoption.make({ changeEventId: "iv-1427-push-first-publish", adoption: "post-adopted" })
 * console.log(adoption.adoption) // "post-adopted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EpisodeAdoption extends S.Class<EpisodeAdoption>($I`EpisodeAdoption`)(
  { changeEventId: ChangeEventId, adoption: AdoptionClass },
  $I.annote("EpisodeAdoption", {
    description: "An episode's adoption-qualified membership relative to one change event.",
  })
) {}

/**
 * One KPI episode: a `(checkout, branch)` red streak within one tier's attempt subsequence.
 *
 * **Details**
 *
 * `stoppedAt` is the closing attempt's finish (else its start); for a
 * right-censored streak it is the last measured instant, and `durationMs` is
 * then the uncut lower bound. `censoring` is empty for a closed, uncensored
 * episode.
 *
 * **Example** (Construct a closed seat-request episode)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import { EpisodeKey, KpiEpisode } from "@/kpi/Schemas"
 *
 * const episode = KpiEpisode.make({
 *   key: EpisodeKey.make({ checkout: "beep-effect", branch: "main" }),
 *   tier: "local-full-proof",
 *   clock: "seat-request",
 *   openedAt: DateTime.makeUnsafe("2026-10-02T10:00:00.000Z"),
 *   stoppedAt: DateTime.makeUnsafe("2026-10-02T10:30:00.000Z"),
 *   durationMs: S.Natural.make(1_800_000),
 *   censoring: [],
 *   adoption: []
 * })
 * console.log(episode.durationMs) // 1800000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KpiEpisode extends S.Class<KpiEpisode>($I`KpiEpisode`)(
  {
    key: EpisodeKey,
    tier: KpiTier,
    clock: EpisodeClock,
    openedAt: S.DateTimeUtcFromString,
    stoppedAt: S.DateTimeUtcFromString,
    durationMs: S.Natural,
    censoring: S.Array(CensorClass),
    adoption: S.Array(EpisodeAdoption),
  },
  $I.annote("KpiEpisode", {
    description: "One per-tier red streak with its clock label, instants, duration, censoring and adoption.",
  })
) {}

/**
 * Change-event row carried by the lab's typed constant table (launch sitting Ruling 8).
 *
 * **Example** (Construct the #1427 row)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { ChangeEventRow } from "@/kpi/Schemas"
 *
 * const row = ChangeEventRow.make({
 *   id: "iv-1427-push-first-publish",
 *   landedAt: DateTime.makeUnsafe("2026-10-06T01:36:13.000Z"),
 *   mergeCommit: "01d8c18f314661a7957ef6420b2180ffb29804d1",
 *   tiers: ["local"]
 * })
 * console.log(row.tiers) // ["local"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangeEventRow extends S.Class<ChangeEventRow>($I`ChangeEventRow`)(
  {
    id: ChangeEventId,
    landedAt: S.DateTimeUtcFromString,
    mergeCommit: GitCommitSha,
    tiers: S.NonEmptyArray(ChangeEventSeries),
  },
  $I.annote("ChangeEventRow", {
    description: "Ledger id, landing instant, merge commit and partitioned series of one change event.",
  })
) {}

/**
 * One row of the committed adoption table: an ancestry probe of a merge commit against a head.
 *
 * **Example** (Record an ancestor verdict)
 *
 * ```ts
 * import { AdoptionTableRow } from "@/kpi/Schemas"
 *
 * const row = AdoptionTableRow.make({
 *   changeEventId: "iv-870-weighted-admission",
 *   mergeCommit: "debbbb51f77ae10015788dec0b819f12b96c3552",
 *   resolvedHeadSha: "28d962ec6b8d721430ed4d84ca8ff0f7c9715b74",
 *   ancestry: "ancestor"
 * })
 * console.log(row.ancestry) // "ancestor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdoptionTableRow extends S.Class<AdoptionTableRow>($I`AdoptionTableRow`)(
  {
    changeEventId: ChangeEventId,
    mergeCommit: GitCommitSha,
    resolvedHeadSha: GitCommitSha,
    ancestry: AncestryVerdict,
  },
  $I.annote("AdoptionTableRow", {
    description: "Result of git merge-base --is-ancestor for one change event's merge commit and one resolved head.",
  })
) {}

/**
 * Bounds of one window slice: `[start, end)`, membership by episode start.
 *
 * **Example** (Bound the post-baseline window)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { WindowBounds } from "@/kpi/Schemas"
 *
 * const window = WindowBounds.make({
 *   slice: "W",
 *   start: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
 *   end: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z")
 * })
 * console.log(window.slice) // "W"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WindowBounds extends S.Class<WindowBounds>($I`WindowBounds`)(
  { slice: WindowSlice, start: S.DateTimeUtcFromString, end: S.DateTimeUtcFromString },
  $I.annote("WindowBounds", {
    description: "Half-open instant range of one named window slice; episodes belong by their opening instant.",
  })
) {}

/**
 * Nearest-rank P50 and P95 over one population, with its size.
 *
 * **Details**
 *
 * Percentiles are absent when the population is empty.
 *
 * **Example** (Record a percentile set)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PercentileSet } from "@/kpi/Schemas"
 *
 * const set = PercentileSet.make({
 *   n: S.Natural.make(58),
 *   p50Ms: O.some(S.Natural.make(3_671_966)),
 *   p95Ms: O.some(S.Natural.make(36_741_278))
 * })
 * console.log(set.n) // 58
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PercentileSet extends S.Class<PercentileSet>($I`PercentileSet`)(
  {
    n: S.Natural,
    p50Ms: S.OptionFromOptionalKey(S.Natural),
    p95Ms: S.OptionFromOptionalKey(S.Natural),
  },
  $I.annote("PercentileSet", {
    description: "Population size and nearest-rank P50/P95 in milliseconds; percentiles absent when n is zero.",
  })
) {}

/**
 * Per-slice, per-tier percentile row: cut and uncut sets with censoring and clock counts beside them.
 *
 * **Details**
 *
 * Cut and uncut use the law's sense (KPI law v1.2 §7.2): censored episodes
 * excluded, or included at their observed lower bounds.
 *
 * **Example** (Record an empty tier row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PercentileRow, PercentileSet } from "@/kpi/Schemas"
 *
 * const empty = PercentileSet.make({ n: S.Natural.make(0), p50Ms: O.none(), p95Ms: O.none() })
 * const row = PercentileRow.make({
 *   slice: "W",
 *   tier: "ci-merge-green",
 *   cut: empty,
 *   uncut: empty,
 *   rightCensored: S.Natural.make(0),
 *   leftCensored: S.Natural.make(0),
 *   possiblyTruncated: S.Natural.make(0),
 *   seatRequestEpisodes: S.Natural.make(0),
 *   attemptStartEpisodes: S.Natural.make(0)
 * })
 * console.log(row.tier) // "ci-merge-green"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PercentileRow extends S.Class<PercentileRow>($I`PercentileRow`)(
  {
    slice: WindowSlice,
    tier: KpiTier,
    cut: PercentileSet,
    uncut: PercentileSet,
    rightCensored: S.Natural,
    leftCensored: S.Natural,
    possiblyTruncated: S.Natural,
    seatRequestEpisodes: S.Natural,
    attemptStartEpisodes: S.Natural,
  },
  $I.annote("PercentileRow", {
    description: "Cut and uncut percentiles for one slice and tier, with censored and clock-label counts beside them.",
  })
) {}

/**
 * Starvation count at one bound (KPI law v1.2 §7.6).
 *
 * **Details**
 *
 * Only the 120000 ms row is normative; the 15 and 60 minute rows are
 * sensitivity rows. Exceptions are unobservable over history.
 *
 * **Example** (Record the normative starvation row)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StarvationRow } from "@/kpi/Schemas"
 *
 * const row = StarvationRow.make({
 *   slice: "W",
 *   boundMs: 120_000,
 *   normative: true,
 *   requests: S.Natural.make(10),
 *   beyondBound: S.Natural.make(0),
 *   openAtCapture: S.Natural.make(0),
 *   exceptions: "unobservable"
 * })
 * console.log(row.normative) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StarvationRow extends S.Class<StarvationRow>($I`StarvationRow`)(
  {
    slice: WindowSlice,
    boundMs: PosInt,
    normative: S.Boolean,
    requests: S.Natural,
    beyondBound: S.Natural,
    openAtCapture: S.Natural,
    exceptions: S.Literal("unobservable"),
  },
  $I.annote("StarvationRow", {
    description: "Seat requests in a slice and how many waited beyond one declared or sensitivity bound.",
  })
) {}

/**
 * M1's definition run over the fleet pin (launch sitting Ruling 5), never M1 itself.
 *
 * **Details**
 *
 * M1 modes, no tiers, M1's 24 h `comparable24h` cut and its `uncut` row (which
 * still excludes right-censored streaks).
 *
 * **Example** (Record an M1-replica row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { M1ReplicaRow, PercentileSet } from "@/kpi/Schemas"
 *
 * const empty = PercentileSet.make({ n: S.Natural.make(0), p50Ms: O.none(), p95Ms: O.none() })
 * const row = M1ReplicaRow.make({
 *   slice: "W-a",
 *   label: "M1 definition over the fleet pin, not M1",
 *   comparable24h: empty,
 *   uncut: empty,
 *   rightCensoredStreaks: S.Natural.make(0),
 *   leftCensoredEpisodesExcluded: S.Natural.make(0),
 *   closedEpisodesOver24hExcluded: S.Natural.make(0)
 * })
 * console.log(row.label) // "M1 definition over the fleet pin, not M1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class M1ReplicaRow extends S.Class<M1ReplicaRow>($I`M1ReplicaRow`)(
  {
    slice: WindowSlice,
    label: S.Literal("M1 definition over the fleet pin, not M1"),
    comparable24h: PercentileSet,
    uncut: PercentileSet,
    rightCensoredStreaks: S.Natural,
    leftCensoredEpisodesExcluded: S.Natural,
    closedEpisodesOver24hExcluded: S.Natural,
  },
  $I.annote("M1ReplicaRow", {
    description: "Time-to-certainty M1's episode definition evaluated over the fleet pin, labelled as not M1.",
  })
) {}

// CQ-012 queue-wait share over W-b, printed only when every episode in the slice decomposes.
class Cq012Shares extends S.Class<Cq012Shares>($I`Cq012Shares`)(
  {
    status: S.tag("shares"),
    decomposedEpisodes: S.Natural,
    windowEpisodes: S.Natural,
    queueWaitShare: UnitInterval,
    grandTotalMs: S.Natural,
  },
  $I.annote("Cq012Shares", {
    description: "Queue-wait share of total episode time over W-b, printed only when every episode decomposes.",
  })
) {}

// CQ-012 shares voided because some episode in the slice does not decompose; only the pair is kept.
class Cq012Void extends S.Class<Cq012Void>($I`Cq012Void`)(
  { status: S.tag("void"), decomposedEpisodes: S.Natural, windowEpisodes: S.Natural },
  $I.annote("Cq012Void", {
    description: "Void CQ-012 shares, reported only as the decomposed and window episode counts.",
  })
) {}

/**
 * CQ-012 decomposition: shares, or void with its `(decomposedEpisodes, windowEpisodes)` pair.
 *
 * **Example** (Match on the decomposition status)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Cq012Decomposition } from "@/kpi/Schemas"
 *
 * const voided = Cq012Decomposition.cases.void.make({
 *   decomposedEpisodes: S.Natural.make(0),
 *   windowEpisodes: S.Natural.make(1)
 * })
 * console.log(Cq012Decomposition.guards.void(voided)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Cq012Decomposition = S.Union([Cq012Shares, Cq012Void]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("Cq012Decomposition", {
    description: "CQ-012 queue-wait decomposition over W-b: shares, or void with the episode-count pair.",
  })
);

/**
 * Decoded decomposition accepted by {@link Cq012Decomposition}.
 *
 * @see {@link Cq012Decomposition} for constructors and discriminator-aware helpers.
 * @category models
 * @since 0.0.0
 */
export type Cq012Decomposition = typeof Cq012Decomposition.Type;

/**
 * The KPI reading document, schema id `ciops-kpi-reading/v1` (launch sitting Ruling 10).
 *
 * **Details**
 *
 * Generated check-by-default as `research/kpi-reading.json`. It names every
 * pinned input with its digest, the estimator, the declared starvation bound
 * and the window slices, and carries no A-Box term.
 *
 * **Example** (Construct a minimal reading)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import { Cq012Decomposition, KpiReading, PinnedKpiInput, WindowBounds } from "@/kpi/Schemas"
 *
 * const reading = KpiReading.make({
 *   schemaVersion: "ciops-kpi-reading/v1",
 *   estimator: "nearest-rank",
 *   inputs: [
 *     PinnedKpiInput.make({
 *       role: "adoption-table",
 *       path: "goals/ciops-ontology-pipeline/research/kpi-adoption-table.json",
 *       sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *     })
 *   ],
 *   windows: [
 *     WindowBounds.make({
 *       slice: "W",
 *       start: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
 *       end: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z")
 *     })
 *   ],
 *   starvationBoundMs: 120_000,
 *   untieredStarts: S.Natural.make(0),
 *   survivorshipUnjoinedRequests: S.Natural.make(0),
 *   percentiles: [],
 *   starvation: [],
 *   m1Replica: [],
 *   decomposition: Cq012Decomposition.cases.void.make({
 *     decomposedEpisodes: S.Natural.make(0),
 *     windowEpisodes: S.Natural.make(0)
 *   }),
 *   changeEvents: []
 * })
 * console.log(reading.schemaVersion) // "ciops-kpi-reading/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KpiReading extends S.Class<KpiReading>($I`KpiReading`)(
  {
    schemaVersion: S.Literal("ciops-kpi-reading/v1"),
    estimator: S.Literal("nearest-rank"),
    inputs: S.NonEmptyArray(PinnedKpiInput),
    windows: S.NonEmptyArray(WindowBounds),
    starvationBoundMs: PosInt,
    untieredStarts: S.Natural,
    survivorshipUnjoinedRequests: S.Natural,
    percentiles: S.Array(PercentileRow),
    starvation: S.Array(StarvationRow),
    m1Replica: S.Array(M1ReplicaRow),
    decomposition: Cq012Decomposition,
    changeEvents: S.Array(ChangeEventRow),
  },
  $I.annote("KpiReading", {
    description: "The W8 KPI reading: pinned inputs, windows, per-tier percentiles, starvation and change events.",
  })
) {}

/**
 * A pinned input's raw bytes could not be read at its repo-relative path.
 *
 * **Example** (Construct a read failure)
 *
 * ```ts
 * import { KpiInputReadError } from "@/kpi/Schemas"
 *
 * const error = KpiInputReadError.make({ role: "adoption-table", path: "missing.json", message: "No such file" })
 * console.log(error._tag) // "KpiInputReadError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KpiInputReadError extends S.TaggedError<KpiInputReadError>($I`KpiInputReadError`)(
  "KpiInputReadError",
  { role: KpiInputRole, path: S.String, message: S.String },
  $I.annoteError<KpiInputReadError>("KpiInputReadError", {
    description: "A pinned KPI input could not be read at its repo-relative path.",
  })
) {}

/**
 * A pinned input's raw bytes do not hash to the pinned SHA-256.
 *
 * **Details**
 *
 * Raised for a pin, a committed table, or the change-event ledger the lab's
 * constant table is asserted against; the digest is checked before decode.
 *
 * **Example** (Construct a digest mismatch)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { KpiDigestMismatchError } from "@/kpi/Schemas"
 *
 * const error = KpiDigestMismatchError.make({
 *   role: "change-event-ledger",
 *   path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
 *   expectedSha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   actualSha256: Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198")
 * })
 * console.log(error._tag) // "KpiDigestMismatchError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KpiDigestMismatchError extends S.TaggedError<KpiDigestMismatchError>($I`KpiDigestMismatchError`)(
  "KpiDigestMismatchError",
  { role: KpiInputRole, path: S.String, expectedSha256: Sha256Hex, actualSha256: Sha256Hex },
  $I.annoteError<KpiDigestMismatchError>("KpiDigestMismatchError", {
    description: "A pinned KPI input or committed table does not hash to its pinned SHA-256.",
  })
) {}

/**
 * A pinned input's verified bytes did not decode to the shape the reading consumes.
 *
 * **Example** (Construct a decode failure)
 *
 * ```ts
 * import { KpiInputDecodeError } from "@/kpi/Schemas"
 *
 * const error = KpiInputDecodeError.make({
 *   role: "adoption-table",
 *   path: "goals/ciops-ontology-pipeline/research/kpi-adoption-table.json",
 *   message: "Expected ancestor | not-ancestor | head-missing"
 * })
 * console.log(error._tag) // "KpiInputDecodeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KpiInputDecodeError extends S.TaggedError<KpiInputDecodeError>($I`KpiInputDecodeError`)(
  "KpiInputDecodeError",
  { role: KpiInputRole, path: S.String, message: S.String },
  $I.annoteError<KpiInputDecodeError>("KpiInputDecodeError", {
    description: "Digest-verified KPI input bytes did not decode to the schema the reading consumes.",
  })
) {}

/**
 * The fleet journal and the redacted snapshot disagree on a row they share.
 *
 * **Details**
 *
 * Rows are deduplicated by nonce and event tag; a shared key whose rows differ
 * fails closed, with no fallback (launch sitting Ruling 5).
 *
 * **Example** (Construct a join mismatch)
 *
 * ```ts
 * import { KpiAdmissionJoinMismatchError } from "@/kpi/Schemas"
 *
 * const error = KpiAdmissionJoinMismatchError.make({
 *   nonce: "n-1",
 *   eventTag: "admission-enqueued",
 *   message: "enqueuedAtMillis differs between sources"
 * })
 * console.log(error._tag) // "KpiAdmissionJoinMismatchError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KpiAdmissionJoinMismatchError extends S.TaggedError<KpiAdmissionJoinMismatchError>(
  $I`KpiAdmissionJoinMismatchError`
)(
  "KpiAdmissionJoinMismatchError",
  { nonce: S.NonEmptyString, eventTag: S.NonEmptyString, message: S.String },
  $I.annoteError<KpiAdmissionJoinMismatchError>("KpiAdmissionJoinMismatchError", {
    description: "The two admission sources disagree on a row with the same nonce and event tag.",
  })
) {}

/**
 * The KPI service contract exists but its implementation has not landed.
 *
 * **Example** (Construct the not-implemented failure)
 *
 * ```ts
 * import { KpiNotImplementedError } from "@/kpi/Schemas"
 *
 * const error = KpiNotImplementedError.make({ operation: "read" })
 * console.log(error._tag) // "KpiNotImplementedError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KpiNotImplementedError extends S.TaggedError<KpiNotImplementedError>($I`KpiNotImplementedError`)(
  "KpiNotImplementedError",
  { operation: S.Literal("read") },
  $I.annoteError<KpiNotImplementedError>("KpiNotImplementedError", {
    description: "The CiOpsKpi contract stub was called before the reading fold landed.",
  })
) {}
