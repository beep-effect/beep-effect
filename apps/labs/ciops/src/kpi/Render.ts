/**
 * Deterministic renderings of the W8 KPI artifacts: the adoption table, the
 * reading's JSON document and its Markdown report (launch sitting Ruling 10).
 *
 * **Details**
 *
 * Every rendering is a pure function of a decoded value: JSON is the schema
 * encoding printed with two-space indentation and a trailing newline, and the
 * Markdown is computed from the reading alone, so the same pins always render
 * the same bytes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DateTime, Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AdoptionTable, KpiReading } from "./Schemas.ts";
import type {
  ChangeEventPartition,
  ChangeEventTierPartition,
  M1ReplicaRow,
  PercentileRow,
  PercentileSet,
  StarvationRow,
  WindowSlice,
} from "./Schemas.ts";

const pretty = (encoded: unknown): string => `${JSON.stringify(encoded, null, 2)}\n`;

/**
 * Renders the adoption table as its committed JSON bytes.
 *
 * **Example** (Render an empty table)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { DateTime, Effect } from "effect"
 * import { renderAdoptionTable } from "@/kpi/Render"
 * import { AdoptionTable, PinnedKpiInput } from "@/kpi/Schemas"
 *
 * const table = AdoptionTable.make({
 *   schemaVersion: "ciops-kpi-adoption-table/v1",
 *   generator: "apps/labs/ciops/scripts/generate-adoption-table.ts",
 *   probe: "git merge-base --is-ancestor <mergeCommit> <resolvedHeadSha>",
 *   generation: "local clone with full history; never a CI check",
 *   windowStart: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
 *   windowEnd: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z"),
 *   pins: [
 *     PinnedKpiInput.make({
 *       role: "change-event-ledger",
 *       path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
 *       sha256: Sha256Hex.make("f520b302424f871804c050d9698dcb8e10f19c081fd3dc48a9a19932308d724d")
 *     })
 *   ],
 *   rows: []
 * })
 * console.log(Effect.runSync(renderAdoptionTable(table)).endsWith("\n")) // true
 * ```
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderAdoptionTable = Effect.fn("KpiRender.renderAdoptionTable")(function* (
  table: AdoptionTable
): Effect.fn.Return<string, S.SchemaError> {
  return pretty(yield* S.encodeEffect(AdoptionTable)(table));
});

/**
 * Renders the reading as its committed `ciops-kpi-reading/v1` JSON bytes.
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderReadingJson = Effect.fn("KpiRender.renderReadingJson")(function* (
  reading: KpiReading
): Effect.fn.Return<string, S.SchemaError> {
  return pretty(yield* S.encodeEffect(KpiReading)(reading));
});

const iso = (instant: DateTime.Utc): string => DateTime.formatIso(instant);

// Milliseconds with a human reading beside them: 3671966 -> "3671966 (61.2 min)".
const formatMs = (ms: number): string =>
  ms < 60_000
    ? `${ms} (${(ms / 1_000).toFixed(1)} s)`
    : ms < 3_600_000
      ? `${ms} (${(ms / 60_000).toFixed(1)} min)`
      : `${ms} (${(ms / 3_600_000).toFixed(1)} h)`;

const percentile = (value: O.Option<number>): string => O.match(value, { onNone: () => "—", onSome: formatMs });

const setCells = (set: PercentileSet): ReadonlyArray<string> => [
  `${set.n}`,
  percentile(set.p50Ms),
  percentile(set.p95Ms),
];

const row = (cells: ReadonlyArray<string>): string => `| ${A.join(cells, " | ")} |`;

const table = (header: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): string =>
  A.join([row(header), row(A.map(header, () => "---")), ...A.map(rows, row)], "\n");

const percentileTable = (rows: ReadonlyArray<PercentileRow>, slice: WindowSlice): string =>
  table(
    [
      "Tier",
      "Cut n",
      "Cut P50 ms",
      "Cut P95 ms",
      "Uncut n",
      "Uncut P50 ms",
      "Uncut P95 ms",
      "Right-censored",
      "Left-censored",
      "Possibly truncated",
      "Seat-request",
      "Attempt-start",
    ],
    pipe(
      A.filter(rows, (entry) => entry.slice === slice),
      A.map((entry) => [
        entry.tier === "ci-merge-green" ? "ci-merge-green (unmeasured: no pinned hosted input)" : entry.tier,
        ...setCells(entry.cut),
        ...setCells(entry.uncut),
        `${entry.rightCensored}`,
        `${entry.leftCensored}`,
        `${entry.possiblyTruncated}`,
        `${entry.seatRequestEpisodes}`,
        `${entry.attemptStartEpisodes}`,
      ])
    )
  );

const starvationTable = (rows: ReadonlyArray<StarvationRow>): string =>
  table(
    ["Slice", "Bound ms", "Normative", "Requests", "Beyond bound", "Open at capture", "Exceptions"],
    A.map(rows, (entry) => [
      entry.slice,
      formatMs(entry.boundMs),
      entry.normative ? "yes (declared)" : "no (sensitivity)",
      `${entry.requests}`,
      `${entry.beyondBound}`,
      `${entry.openAtCapture}`,
      entry.exceptions,
    ])
  );

const replicaTable = (rows: ReadonlyArray<M1ReplicaRow>): string =>
  table(
    [
      "Slice",
      "Label",
      "comparable24h n",
      "comparable24h P50 ms",
      "comparable24h P95 ms",
      "uncut n",
      "uncut P50 ms",
      "uncut P95 ms",
      "Right-censored streaks",
      "Left-censored excluded",
      "Closed > 24 h excluded",
    ],
    A.map(rows, (entry) => [
      entry.slice,
      entry.label,
      ...setCells(entry.comparable24h),
      ...setCells(entry.uncut),
      `${entry.rightCensoredStreaks}`,
      `${entry.leftCensoredEpisodesExcluded}`,
      `${entry.closedEpisodesOver24hExcluded}`,
    ])
  );

const partitionCells = (partition: ChangeEventTierPartition): string =>
  `${partition.tier}: pre ${partition.pre.n}+${partition.preCensored}c, post-adopted ${partition.postAdopted.n}+${partition.postAdoptedCensored}c, post-unadopted ${partition.postUnadopted}, unknown ${partition.unknown}`;

const changeEventTable = (reading: KpiReading): string =>
  table(
    ["Id", "landedAt", "Merge commit", "Series", "In W", "Partition (cut n + censored)"],
    A.map(reading.changeEvents, (event) => {
      const partition = A.findFirst(reading.changeEventPartitions, (entry) => entry.changeEventId === event.id);
      return [
        event.id,
        iso(event.landedAt),
        `\`${event.mergeCommit}\``,
        A.join(event.tiers, " + "),
        O.exists(partition, (entry) => entry.inWindow) ? "yes" : "no",
        O.match(partition, {
          onNone: () => "—",
          onSome: (entry) =>
            A.join(
              A.map(
                A.filter(entry.tiers, (tier) => tier.tier !== "ci-merge-green"),
                partitionCells
              ),
              "<br>"
            ) || "hosted only (unmeasured)",
        }),
      ];
    })
  );

const pushFirstId = "iv-1427-push-first-publish";

const pushFirstTable = (partition: ChangeEventPartition): string =>
  table(
    [
      "Tier",
      "Pre cut n",
      "Pre P50 ms",
      "Pre P95 ms",
      "Pre censored",
      "Post-adopted cut n",
      "Post-adopted P50 ms",
      "Post-adopted P95 ms",
      "Post-adopted censored",
      "Post-unadopted",
      "Unknown",
    ],
    A.map(partition.tiers, (tier) => [
      tier.tier,
      ...setCells(tier.pre),
      `${tier.preCensored}`,
      ...setCells(tier.postAdopted),
      `${tier.postAdoptedCensored}`,
      `${tier.postUnadopted}`,
      `${tier.unknown}`,
    ])
  );

const pushFirstSection = (reading: KpiReading): ReadonlyArray<string> =>
  O.match(
    A.findFirst(reading.changeEventPartitions, (entry) => entry.changeEventId === pushFirstId),
    {
      onNone: () => ["The reading carries no #1427 partition."],
      onSome: (partition) => {
        const postN = A.reduce(
          partition.tiers,
          0,
          (sum, tier) => sum + tier.postAdopted.n + tier.postAdoptedCensored + tier.postUnadopted + tier.unknown
        );
        return [
          "#1427 (`iv-1427-push-first-publish`, landed 2026-10-06T01:36:13Z) partitions the **local series only**. " +
            "Its post-period is the last 1 h 43 min of `W` before the capture, so it is read as a comparison of " +
            "populations across the event (which tiers the episodes fall in), never as a shift in one population's " +
            `percentiles. Post-period episodes in \`W\`: ${postN} (every adoption class).`,
          "",
          pushFirstTable(partition),
          "",
          "- **Squash undercount.** #1427 is a squash of the `goals/push-first-publish` branch, so checkouts on " +
            "that branch and on the lanes merged into it (#1431, #1433, #1442) ran push-first before `landedAt` " +
            "without the merge commit in their ancestry; adoption-qualified membership files them pre-period and " +
            "undercounts the post-period (ledger caveat SQUASH ADOPTION).",
          "- **Confounders.** Local admission demand falls at the same instant (the push-first default takes no " +
            "admission ticket). On the hosted tier the same default adds the heavy-admission label at PR creation, " +
            "flips `--pr` on and sends heads with cheap-gates as their only local proof; the hosted series is not " +
            "partitioned here and is unmeasured (Ruling 4). `iv-1422-spot-pool-drop-r6a` lands 46 min later on the " +
            "hosted tier and partitions nothing local.",
          "- Every comparison is OBSERVATIONAL (KPI law §2).",
        ];
      },
    }
  );

/**
 * Renders the reading's Markdown report from the reading alone.
 *
 * **Details**
 *
 * Inputs and their digests, the windows, per-slice percentile tables (cut and
 * uncut in the law's sense), starvation, the M1-replica, CQ-012, the
 * change-event partitions and the #1427 paragraph. TierCiMergeGreen is
 * labelled unmeasured; no figure is an A-Box term.
 *
 * @category rendering
 * @since 0.0.0
 */
export const renderReadingMarkdown = (reading: KpiReading): string =>
  A.join(
    [
      "# W8 KPI reading (`ciops-kpi-reading/v1`)",
      "",
      "<!-- GENERATED by apps/labs/ciops/scripts/generate-kpi-reading.ts; do not hand-edit. -->",
      "",
      "Rules: KPI law v1.2 §7 (`explorations/beep-ci-operational-ontology/research/kpi-measurement-rules.md`), " +
        "S7 contract §9, P4 launch sitting Rulings 3-12. Estimator: nearest-rank. Durations are milliseconds. " +
        "**Cut / uncut** are the law's sense (§7.2): censored episodes excluded, or included at their observed " +
        "lower bounds. No figure here is emitted to the A-Box.",
      "",
      "## Inputs",
      "",
      table(
        ["Role", "Path", "SHA-256"],
        A.map(reading.inputs, (input) => [input.role, `\`${input.path}\``, `\`${input.sha256}\``])
      ),
      "",
      "## Windows",
      "",
      table(
        ["Slice", "Start", "End"],
        A.map(reading.windows, (window) => [
          window.slice,
          iso(window.start),
          `${iso(window.end)}${window.slice === "W" ? " (exclusive)" : " (inclusive)"}`,
        ])
      ),
      "",
      `Untiered starts in W (no \`stage\` member, never imputed): ${reading.untieredStarts}. ` +
        `Survivorship (enqueues in W naming an attempt with no pinned journal, counted, never imputed): ` +
        `${reading.survivorshipUnjoinedRequests}.`,
      "",
      ...A.flatMap(["W", "W-a", "W-b"] as const, (slice) => [
        `## Percentiles — ${slice}`,
        "",
        percentileTable(reading.percentiles, slice),
        "",
      ]),
      "TierCiMergeGreen is reported unmeasured (Ruling 4): no pin carries hosted input. The `local-full-proof` " +
        "row includes its `local-full-proof-merged-preview` sub-partition.",
      "",
      `## Starvation (declared bound ${reading.starvationBoundMs} ms)`,
      "",
      starvationTable(reading.starvation),
      "",
      "A nonzero normative count makes the report failing (KPI law §4); a failing report is a lawful verdict. " +
        "Exceptions are unobservable over history (§7.6).",
      "",
      "## M1-replica",
      "",
      replicaTable(reading.m1Replica),
      "",
      "## CQ-012 queue-wait share (W-b)",
      "",
      reading.decomposition.status === "shares"
        ? `Shares: queue-wait share ${reading.decomposition.queueWaitShare.toFixed(4)} of ${reading.decomposition.grandTotalMs} ms over ${reading.decomposition.windowEpisodes} episodes.`
        : `Void: ${reading.decomposition.decomposedEpisodes} of ${reading.decomposition.windowEpisodes} episodes decompose (every episode must).`,
      "",
      "## Change events (observational)",
      "",
      changeEventTable(reading),
      "",
      "## #1427",
      "",
      ...pushFirstSection(reading),
      "",
    ],
    "\n"
  );
