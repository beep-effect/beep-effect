/**
 * Which day the service owes a digest for.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { addDays, isAfter, LocalDate } from "@beep/schema/LocalDate";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $DocketIntakeId.create("Digest");

/**
 * How far the digests have come, read from the saved state.
 *
 * **Example** (Describe digest progress)
 *
 * ```ts
 * import { DigestProgress } from "../../src/Digest.ts"
 * import * as O from "effect/Option"
 *
 * const nothingYet = DigestProgress.make({ digestedThrough: O.none(), earliestProcessed: O.none() })
 * console.log(nothingYet)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DigestProgress extends S.Class<DigestProgress>($I`DigestProgress`)(
  {
    digestedThrough: S.Option(LocalDate).annotateKey({ description: "The last day a digest was written for." }),
    earliestProcessed: S.Option(LocalDate).annotateKey({
      description: "The earliest day any message in the ledger was processed on.",
    }),
  },
  $I.annote("DigestProgress", { description: "How far the docket intake digests have come." })
) {}

/**
 * The earliest day a digest is still owed for, if any.
 *
 * **Details**
 *
 * After a digest has been written, the next owed day is the day after it.
 * Before any digest has been written, it is the earliest day a message was
 * processed on. Either way a day is owed only once it is over, so today is
 * never owed. Writing digests one owed day at a time therefore walks through
 * every day of an outage in order instead of skipping to yesterday.
 *
 * **Example** (Find the next owed day after a gap)
 *
 * ```ts
 * import { DigestProgress, digestDayDue } from "../../src/Digest.ts"
 * import { LocalDate } from "@beep/schema/LocalDate"
 * import * as O from "effect/Option"
 *
 * const due = digestDayDue(
 *   LocalDate.make({ year: 2030, month: 1, day: 10 }),
 *   DigestProgress.make({
 *     digestedThrough: O.some(LocalDate.make({ year: 2030, month: 1, day: 6 })),
 *     earliestProcessed: O.none()
 *   })
 * )
 * console.log(O.map(due, (day) => day.toISOString())) // Some("2030-01-07")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const digestDayDue: {
  (progress: DigestProgress): (today: LocalDate) => O.Option<LocalDate>;
  (today: LocalDate, progress: DigestProgress): O.Option<LocalDate>;
} = dual(2, (today: LocalDate, progress: DigestProgress): O.Option<LocalDate> => {
  const yesterday = addDays(today, -1);
  const next = O.orElse(O.map(progress.digestedThrough, addDays(1)), () => progress.earliestProcessed);
  return O.filter(next, (day) => !isAfter(day, yesterday));
});
