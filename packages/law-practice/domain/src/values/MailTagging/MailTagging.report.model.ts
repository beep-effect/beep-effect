/**
 * Mail-tagging run report: counts only, with an associative combine.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { flow, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { TaggingRunId } from "./MailTagging.ids.model.ts";
import { AttachmentSkipReason, TaggingMode } from "./MailTagging.ledger.model.ts";
import { UnmatchedReason } from "./MailTagging.matching.model.ts";
import { MailCategoryName } from "./MailTagging.taxonomy.model.ts";

const $I = $LawPracticeDomainId.create("values/MailTagging/MailTagging.report.model");

/**
 * How many times one owned category was added during a run.
 *
 * **Example** (Count category adds)
 *
 * ```ts
 * import { CategoryAddCount } from "@beep/law-practice-domain/values"
 *
 * const count = CategoryAddCount.make({ category: "P: USPTO", count: 3 })
 * console.log(count.count) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CategoryAddCount extends S.Class<CategoryAddCount>($I`CategoryAddCount`)(
  {
    category: MailCategoryName.annotateKey({
      description: "Owned category that was added.",
    }),
    count: S.Natural.annotateKey({
      description: "Number of messages the category was added to.",
    }),
  },
  $I.annote("CategoryAddCount", {
    description: "How many times one owned category was added during a run.",
  })
) {}

const byCategory: Order.Order<CategoryAddCount> = Order.mapInput(
  Order.String,
  (item: CategoryAddCount) => item.category
);

/**
 * Renders in-memory per-category counts as the report's canonical list.
 *
 * **Details**
 *
 * The list is sorted by category name, holds one entry per category, and omits
 * zero counts, so equal aggregations always render identically.
 *
 * **Example** (Render aggregated category counts)
 *
 * ```ts
 * import { type MailCategoryName, categoryAddCounts } from "@beep/law-practice-domain/values"
 * import * as HashMap from "effect/HashMap"
 *
 * const counts = HashMap.make<Array<[MailCategoryName, number]>>(["P: USPTO", 2], ["P: Admin", 1])
 * console.log(categoryAddCounts(counts).map((item) => `${item.category}=${item.count}`))
 * // ["P: Admin=1", "P: USPTO=2"]
 * ```
 *
 * @param counts - Per-category add counts aggregated in memory.
 * @returns The sorted, zero-free list of category counts.
 * @category constructors
 * @since 0.0.0
 */
export const categoryAddCounts = (counts: HashMap.HashMap<MailCategoryName, number>): ReadonlyArray<CategoryAddCount> =>
  pipe(
    HashMap.toEntries(counts),
    A.filter(([, count]) => count > 0),
    A.map(([category, count]) => CategoryAddCount.make({ category, count })),
    A.sort(byCategory)
  );

const addCategoryCount = (
  counts: HashMap.HashMap<MailCategoryName, number>,
  item: CategoryAddCount
): HashMap.HashMap<MailCategoryName, number> =>
  HashMap.modifyAt(
    counts,
    item.category,
    flow(
      O.getOrElse(() => 0),
      (count) => O.some(count + item.count)
    )
  );

const combineCategoryAdds = (
  self: ReadonlyArray<CategoryAddCount>,
  that: ReadonlyArray<CategoryAddCount>
): ReadonlyArray<CategoryAddCount> =>
  categoryAddCounts(A.reduce(A.appendAll(self, that), HashMap.empty<MailCategoryName, number>(), addCategoryCount));

const sumCounts = <K extends string>(
  self: Readonly<Record<K, number>>,
  that: Readonly<Record<K, number>>
): Record<K, number> => R.map(self, (count, key) => count + that[key]);

/**
 * Counts-only outcome of one tagging run.
 *
 * **Gotchas**
 *
 * The report carries ids, counts, and category names. It never carries
 * subjects, senders, or any message content, and a dry run has the same shape
 * as an apply run with `wrote: false`.
 *
 * **Example** (Decode a run report)
 *
 * ```ts
 * import { TaggingRunReport } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const report = S.decodeUnknownSync(TaggingRunReport)({
 *   mode: "dry-run",
 *   runId: "run-0001",
 *   scanned: 3,
 *   matched: 1,
 *   unmatched: { "no-signal": 1, "below-threshold": 1, ambiguous: 0 },
 *   alreadyTagged: 0,
 *   categoryAdds: [{ category: "M: acme.10001", count: 1 }],
 *   attachmentsFiled: 0,
 *   attachmentsDeduped: 0,
 *   attachmentsSkipped: { inline: 0, "not-a-file": 0, empty: 0, "too-large": 0 },
 *   wrote: false
 * })
 * console.log(report.unmatched["below-threshold"]) // 1
 * ```
 *
 * @see {@link combineTaggingRunReports} for merging page-level reports.
 * @category models
 * @since 0.0.0
 */
export class TaggingRunReport extends S.Class<TaggingRunReport>($I`TaggingRunReport`)(
  {
    mode: TaggingMode.annotateKey({
      description: "Whether the run only reported or also wrote.",
    }),
    runId: TaggingRunId.annotateKey({
      description: "Run the report describes.",
    }),
    scanned: S.Natural.annotateKey({
      description: "Messages read.",
    }),
    matched: S.Natural.annotateKey({
      description: "Messages matched to a matter.",
    }),
    unmatched: S.Record(UnmatchedReason, S.Natural).annotateKey({
      description: "Unmatched messages per reason.",
    }),
    alreadyTagged: S.Natural.annotateKey({
      description: "Messages skipped because the tag ledger already covers them.",
    }),
    categoryAdds: S.Array(CategoryAddCount).annotateKey({
      description: "Category adds per owned category, sorted by category name.",
    }),
    attachmentsFiled: S.Natural.annotateKey({
      description: "Attachments uploaded to the document store.",
    }),
    attachmentsDeduped: S.Natural.annotateKey({
      description: "Attachments skipped because the same content was already filed for the matter.",
    }),
    attachmentsSkipped: S.Record(AttachmentSkipReason, S.Natural).annotateKey({
      description: "Attachments not filed, per reason.",
    }),
    wrote: S.Boolean.annotateKey({
      description: "Whether the run performed any write.",
    }),
  },
  $I.annote("TaggingRunReport", {
    description: "Counts-only outcome of one tagging run.",
  })
) {}

const zeroUnmatched: TaggingRunReport["unmatched"] = { "no-signal": 0, "below-threshold": 0, ambiguous: 0 };

const zeroAttachmentsSkipped: TaggingRunReport["attachmentsSkipped"] = {
  inline: 0,
  "not-a-file": 0,
  empty: 0,
  "too-large": 0,
};

/**
 * Builds the all-zero report of a run.
 *
 * **Example** (Start a run report)
 *
 * ```ts
 * import { TaggingRunId, emptyTaggingRunReport } from "@beep/law-practice-domain/values"
 *
 * const report = emptyTaggingRunReport("dry-run", TaggingRunId.make("run-0002"))
 * console.log(report.scanned) // 0
 * console.log(report.wrote) // false
 * ```
 *
 * @param mode - Whether the run only reports or also writes.
 * @param runId - Run the report describes.
 * @returns A report with every count at zero and `wrote: false`.
 * @see {@link combineTaggingRunReports} for which this is the identity.
 * @category constructors
 * @since 0.0.0
 */
export const emptyTaggingRunReport: {
  (mode: TaggingMode, runId: TaggingRunId): TaggingRunReport;
  (runId: TaggingRunId): (mode: TaggingMode) => TaggingRunReport;
} = dual(
  2,
  (mode: TaggingMode, runId: TaggingRunId): TaggingRunReport =>
    TaggingRunReport.make({
      mode,
      runId,
      scanned: 0,
      matched: 0,
      unmatched: zeroUnmatched,
      alreadyTagged: 0,
      categoryAdds: [],
      attachmentsFiled: 0,
      attachmentsDeduped: 0,
      attachmentsSkipped: zeroAttachmentsSkipped,
      wrote: false,
    })
);

/**
 * Merges two reports of the same run by adding their counts.
 *
 * **Details**
 *
 * The operation is associative, and {@link emptyTaggingRunReport} of the same
 * mode and run is its identity. `mode` and `runId` come from the first report;
 * `wrote` is true when either report wrote.
 *
 * **Example** (Merge two page reports)
 *
 * ```ts
 * import {
 *   TaggingRunId,
 *   TaggingRunReport,
 *   combineTaggingRunReports,
 *   emptyTaggingRunReport
 * } from "@beep/law-practice-domain/values"
 *
 * const empty = emptyTaggingRunReport("apply", TaggingRunId.make("run-0003"))
 * const page = TaggingRunReport.make({ ...empty, scanned: 2, matched: 1, wrote: true })
 * const total = combineTaggingRunReports(page, page)
 * console.log(total.scanned) // 4
 * console.log(total.wrote) // true
 * ```
 *
 * @param self - Report accumulated so far.
 * @param that - Report to add.
 * @returns The report holding the summed counts.
 * @category combinators
 * @since 0.0.0
 */
export const combineTaggingRunReports: {
  (self: TaggingRunReport, that: TaggingRunReport): TaggingRunReport;
  (that: TaggingRunReport): (self: TaggingRunReport) => TaggingRunReport;
} = dual(
  2,
  (self: TaggingRunReport, that: TaggingRunReport): TaggingRunReport =>
    TaggingRunReport.make({
      mode: self.mode,
      runId: self.runId,
      scanned: self.scanned + that.scanned,
      matched: self.matched + that.matched,
      unmatched: sumCounts(self.unmatched, that.unmatched),
      alreadyTagged: self.alreadyTagged + that.alreadyTagged,
      categoryAdds: combineCategoryAdds(self.categoryAdds, that.categoryAdds),
      attachmentsFiled: self.attachmentsFiled + that.attachmentsFiled,
      attachmentsDeduped: self.attachmentsDeduped + that.attachmentsDeduped,
      attachmentsSkipped: sumCounts(self.attachmentsSkipped, that.attachmentsSkipped),
      wrote: self.wrote || that.wrote,
    })
);
