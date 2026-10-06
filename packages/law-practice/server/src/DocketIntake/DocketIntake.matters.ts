/**
 * Matter lookup port of the docket intake pipeline while the practice
 * knowledge-graph lookup is not wired in.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocketIntakeError, DocketMatterLookup } from "@beep/law-practice-use-cases/DocketIntake";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";

/**
 * Matter lookup that always reports the lookup as unavailable.
 *
 * **Details**
 *
 * Every lookup fails at stage `lookup` with the label
 * `practice-kg-lookup-not-wired`. The pipeline keeps the entry and marks it
 * `matter-lookup-failed`, so the attorney still sees the deadline and knows
 * the matter was not resolved. The live adapter over `PracticeKgMatterLookup`
 * (branch `feat/practice-kg-matter-lookup`) replaces this layer once that
 * lookup is merged.
 *
 * **Example** (Provide the unavailable lookup)
 *
 * ```ts
 * import { DocketMatterLookupUnavailableLive } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketMatterLookupUnavailableLive);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketMatterLookupUnavailableLive: Layer.Layer<DocketMatterLookup> = Layer.succeed(
  DocketMatterLookup,
  DocketMatterLookup.of({
    lookup: Effect.fn("DocketMatterLookup.lookup")(function* (references) {
      yield* Effect.annotateCurrentSpan({ docket_reference_count: A.length(references) });
      return yield* DocketIntakeError.make({ cause: "practice-kg-lookup-not-wired", stage: "lookup" });
    }),
  })
);
