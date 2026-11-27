/**
 * The lane-reds parcel: its spec and the pure reducer from per-checkout inbox
 * rows and proof jobs to open P0/P1 reds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { checkFreshness, Freshness, isFreshItem, unknownSplit } from "./Freshness.ts";
import { plural } from "./internal/Plural.ts";
import { LaneRed, LaneRedKind } from "./LaneReds.models.ts";
import { ParcelSpec } from "./Parcel.models.ts";
import { makeParcelEnvelope, ParcelDraft } from "./ParcelEnvelope.models.ts";
import { redactText } from "./Redaction.ts";
import type { Freshness as FreshnessType } from "./Freshness.ts";
import type { InboxRowInput, LaneCheckoutInput, LaneRedsInput, ProofJobInput } from "./LaneReds.models.ts";
import type { ParcelBudget } from "./Parcel.models.ts";
import type { ParcelEnvelope } from "./ParcelEnvelope.models.ts";

/**
 * Spec of the lane-reds parcel: keyed by lane, fresh for 10 minutes.
 *
 * **Example** (Read the freshness bound)
 *
 * ```ts
 * import { LaneRedsSpec } from "@beep/palantiri/LaneReds"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(LaneRedsSpec.freshnessBound)) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LaneRedsSpec = ParcelSpec.make({
  id: "lane-reds",
  key: "lane",
  freshnessBound: Duration.minutes(10),
  sources: ["yeet-inbox", "proof-jobs"],
});

const isLaneRedKind = S.is(LaneRedKind);

const itemFreshness = (now: DateTime.Utc, observedAt: O.Option<DateTime.Utc>): FreshnessType =>
  O.match(observedAt, {
    onNone: () =>
      Freshness.cases.Unknown.make({ reason: "stale", asOf: O.none(), detail: O.some("no observation time") }),
    onSome: (at) => checkFreshness(now, LaneRedsSpec.freshnessBound, [at]),
  });

const rowRed =
  (now: DateTime.Utc, checkout: LaneCheckoutInput) =>
  (row: InboxRowInput): O.Option<LaneRed> => {
    const kind = row.kind;
    const severity = row.severity;
    return row.acked || row.superseded || severity === "P2" || !isLaneRedKind(kind)
      ? O.none()
      : // biome-ignore lint/plugin/prefer-schema-make-option: Fail closed: None reads as a pass here, so a refused input must throw
        O.some(
          LaneRed.make({
            kind,
            severity,
            prNumber: row.prNumber,
            lane: checkout.lane,
            branch: checkout.branch,
            summary: redactText(row.summary),
            observedAt: row.observedAt,
            freshness: itemFreshness(now, row.observedAt),
          })
        );
  };

const bySubmitted: Order.Order<ProofJobInput> = Order.mapInput(DateTime.Order, (job) => job.submittedAt);

const jobRed =
  (now: DateTime.Utc, checkout: LaneCheckoutInput) =>
  (job: ProofJobInput): O.Option<LaneRed> => {
    const observedAt = O.orElse(job.endedAt, () => O.some(job.submittedAt));
    return job.failed
      ? // biome-ignore lint/plugin/prefer-schema-make-option: Fail closed: None reads as a pass here, so a refused input must throw
        O.some(
          LaneRed.make({
            kind: "proof-job-failed",
            severity: "P1",
            prNumber: job.prNumber,
            lane: checkout.lane,
            branch: O.some(job.branch),
            summary: redactText(`proof job on ${job.branch}: ${job.reason}`),
            observedAt,
            freshness: itemFreshness(now, observedAt),
          })
        )
      : O.none();
  };

const latestJobPerBranch = (jobs: ReadonlyArray<ProofJobInput>): ReadonlyArray<ProofJobInput> =>
  A.map(R.values(A.groupBy(jobs, (job) => job.branch)), (group) => A.max(group, bySubmitted));

const severityRank = (red: LaneRed): number => (red.severity === "P0" ? 0 : 1);

const newestFirst: Order.Order<LaneRed> = Order.mapInput(
  Order.flip(O.makeOrder(DateTime.Order)),
  (red: LaneRed) => red.observedAt
);

const redOrder: Order.Order<LaneRed> = Order.combine(Order.mapInput(Order.Number, severityRank), newestFirst);

/**
 * Every open P0 or P1 red across the checkouts, with its own freshness,
 * P0 first and newest first within a tier.
 *
 * **Details**
 *
 * An inbox row counts when it is P0 or P1, asks for work (not base drift or
 * an observation row), and is neither acknowledged nor superseded by a newer
 * head. A proof job counts when it is the newest job on its branch and it
 * failed. A red observed within 10 minutes of `now` is `Fresh`; an older one
 * is `Unknown{stale}`.
 *
 * **Example** (No checkouts, no reds)
 *
 * ```ts
 * import { laneRedItems } from "@beep/palantiri/LaneReds"
 * import { LaneRedsInput } from "@beep/palantiri/LaneReds.models"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(laneRedItems(LaneRedsInput.make({ checkouts: [] }), DateTime.makeUnsafe(0)).length) // 0
 * ```
 *
 * @param input - The checkouts the source read.
 * @param now - The read time each red's freshness is checked against.
 * @returns The open reds.
 * @category mapping
 * @since 0.0.0
 */
export const laneRedItems: {
  (now: DateTime.Utc): (input: LaneRedsInput) => ReadonlyArray<LaneRed>;
  (input: LaneRedsInput, now: DateTime.Utc): ReadonlyArray<LaneRed>;
} = dual(
  2,
  (input: LaneRedsInput, now: DateTime.Utc): ReadonlyArray<LaneRed> =>
    A.sort(
      A.flatMap(input.checkouts, (checkout) =>
        A.appendAll(
          A.getSomes(A.map(checkout.rows, rowRed(now, checkout))),
          checkout.jobs.pipe(O.getOrElse(A.empty), latestJobPerBranch, A.map(jobRed(now, checkout)), A.getSomes)
        )
      ),
      redOrder
    )
);

const unreadableLanes = (input: LaneRedsInput): ReadonlyArray<string> =>
  A.map(
    A.filter(input.checkouts, (checkout) => !checkout.inboxReadable || O.isNone(checkout.jobs)),
    (checkout) => checkout.lane
  );

const skippedLines = (input: LaneRedsInput): number =>
  A.reduce(input.checkouts, 0, (total, checkout) => total + checkout.skippedLines);

const attributionGaps = (unreadable: ReadonlyArray<string>, skipped: number): ReadonlyArray<string> =>
  A.getSomes([
    A.match(unreadable, { onEmpty: O.none, onNonEmpty: (lanes) => O.some(`unreadable: ${A.join(lanes, ", ")}`) }),
    skipped > 0 ? O.some(`${plural(skipped, "inbox line")} skipped`) : O.none(),
  ]);

const unreachable = (unreadable: ReadonlyArray<string>): FreshnessType =>
  Freshness.cases.Unknown.make({
    reason: "unreachable",
    asOf: O.none(),
    detail: O.some(
      A.match(unreadable, {
        onEmpty: () => "no checkout to read",
        onNonEmpty: (lanes) => `inbox or proof jobs unreadable in ${A.join(lanes, ", ")}`,
      })
    ),
  });

const envelopeFreshness = (input: LaneRedsInput, now: DateTime.Utc): FreshnessType => {
  const unreadable = unreadableLanes(input);
  return unreadable.length === input.checkouts.length
    ? unreachable(unreadable)
    : A.match(attributionGaps(unreadable, skippedLines(input)), {
        onEmpty: () => Freshness.cases.Fresh.make({ asOf: now }),
        onNonEmpty: (gaps) =>
          Freshness.cases.Unknown.make({
            reason: "attribution-incomplete",
            asOf: O.some(now),
            detail: O.some(A.join(gaps, "; ")),
          }),
      });
};

const summarize = (input: LaneRedsInput, items: ReadonlyArray<LaneRed>): string => {
  const unreadable = unreadableLanes(input);
  const skipped = skippedLines(input);
  const tail = A.join(
    A.appendAll(
      A.isReadonlyArrayNonEmpty(unreadable) ? [`unreadable: ${A.join(unreadable, ", ")}`] : [],
      skipped > 0 ? [`${plural(skipped, "inbox line")} skipped`] : []
    ),
    "; "
  );
  const suffix = tail === "" ? "" : `; ${tail}`;
  return A.match(items, {
    onEmpty: () => `no open P0/P1 reds across ${plural(input.checkouts.length, "lane")}${suffix}`,
    onNonEmpty: (reds) => {
      const split = A.match(
        unknownSplit(reds, (red) => red.lane),
        {
          onEmpty: () => "",
          onNonEmpty: (parts: ReadonlyArray<string>) => `; ${A.join(parts, ", ")}`,
        }
      );
      const p0 = A.filter(reds, (red) => red.severity === "P0").length;
      const lanes = A.dedupe(A.map(reds, (red) => red.lane)).length;
      return `${A.filter(reds, isFreshItem).length} of ${plural(reds.length, "red")} fresh${split}; ${p0} P0, ${reds.length - p0} P1 across ${plural(lanes, "lane")}${suffix}`;
    },
  });
};

/**
 * Reduce the checkouts' inbox rows and proof jobs to the lane-reds parcel.
 *
 * **Details**
 *
 * Freshness has two levels. Each red carries its own (see
 * {@link laneRedItems}). The envelope's describes the read: `Fresh` when
 * every checkout's inbox and job records were read,
 * `Unknown{attribution-incomplete}` when some were unreadable or inbox lines
 * did not decode, and `Unknown{unreachable}` when none could be read. The
 * summary leads with the split, such as
 * `1 of 2 reds fresh; 1 stale (lane-b); 1 P0, 1 P1 across 2 lanes`. At most
 * `budget` reds are kept, with an N-of-M receipt.
 *
 * **Example** (A checkout with no reds)
 *
 * ```ts
 * import { reduceLaneReds } from "@beep/palantiri/LaneReds"
 * import { LaneCheckoutInput, LaneRedsInput } from "@beep/palantiri/LaneReds.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const checkout = LaneCheckoutInput.make({ lane: "main", branch: O.some("main"), inboxReadable: true, skippedLines: 0, rows: [], jobs: O.some([]) })
 * const parcel = reduceLaneReds(LaneRedsInput.make({ checkouts: [checkout] }), DateTime.makeUnsafe("2026-10-15T12:00:00Z"), 20)
 * console.log(parcel.summary) // "no open P0/P1 reds across 1 lane"
 * console.log(parcel.freshness._tag) // "Fresh"
 * ```
 *
 * @param input - The checkouts the source read.
 * @param now - The read time.
 * @param budget - The most reds to keep.
 * @returns The parcel envelope.
 * @category mapping
 * @since 0.0.0
 */
export const reduceLaneReds: {
  (now: DateTime.Utc, budget: ParcelBudget): (input: LaneRedsInput) => ParcelEnvelope;
  (input: LaneRedsInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope;
} = dual(3, (input: LaneRedsInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope => {
  const items = laneRedItems(input, now);
  return makeParcelEnvelope(
    ParcelDraft.make({
      spec: LaneRedsSpec,
      readAt: now,
      freshness: envelopeFreshness(input, now),
      summary: summarize(input, items),
      items,
      budget,
    })
  );
});
