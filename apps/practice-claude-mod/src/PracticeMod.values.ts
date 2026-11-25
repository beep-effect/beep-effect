/**
 * The rows the practice mod keeps on the machine it runs on: verdicts on
 * answers, explicit timer intervals, and the attorney's chosen matter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeClaudeModId } from "@beep/identity/packages";
import { ReviewItemId } from "@beep/law-practice-domain/values";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PracticeClaudeModId.create("PracticeMod.values");

/**
 * **Example** (List the redrawn tools)
 *
 * ```ts
 * import { PracticeKgToolName } from "@/PracticeMod.values"
 *
 * console.log(PracticeKgToolName.literals.length) // 11
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgToolName = LiteralKit([
  "kg_clients",
  "kg_docket_family",
  "kg_application_lookup",
  "kg_find",
  "corpus_search_text",
  "corpus_get_document",
  "email_search",
  "kg_candidate_claims",
  "kg_matter_lookup",
  "kg_correspondent_lookup",
  "kg_provenance",
]).pipe(
  $I.annoteSchema("PracticeKgToolName", {
    description: "A practice-kg MCP tool whose calls the mod redraws in plain language.",
  })
);

/**
 * **Example** (Name a redrawn tool)
 *
 * ```ts
 * import type { PracticeKgToolName } from "@/PracticeMod.values"
 *
 * const tool: PracticeKgToolName = "kg_matter_lookup"
 * console.log(tool) // "kg_matter_lookup"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PracticeKgToolName = typeof PracticeKgToolName.Type;

/**
 * A matter the attorney chose with `/matter`, kept only when the knowledge
 * graph resolved it uniquely.
 *
 * **Example** (Make a chosen matter)
 *
 * ```ts
 * import { ChosenMatter } from "@/PracticeMod.values"
 *
 * const matter = ChosenMatter.make({ reference: "12345.10008US01", docketKey: "12345.10008US01", client: "12345" })
 * console.log(matter.reference) // "12345.10008US01"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChosenMatter extends S.Opaque<ChosenMatter, { readonly brand: unique symbol }>()(
  S.Struct({
    reference: S.NonEmptyString.annotateKey({ description: "The reference the attorney typed." }),
    docketKey: S.NullOr(S.NonEmptyString).annotateKey({ description: "The resolved client-keyed docket, if any." }),
    client: S.NullOr(S.NonEmptyString).annotateKey({ description: "The resolved client number, if any." }),
  }).pipe(
    $I.annoteSchema("ChosenMatter", { description: "A uniquely resolved matter the attorney chose for this session." })
  )
) {}

/**
 * The answer a per-answer verdict targets: one completed turn of one
 * session, kept beside the verdict rows so a reviewer knows what was asked.
 *
 * **Details**
 *
 * `itemId` is `kg-answer:<sessionId>:<turnId>`, the same item id a review
 * queue uses for a knowledge-graph answer.
 *
 * **Example** (Make an answer item)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { KgAnswerItem } from "@/PracticeMod.values"
 *
 * const item = KgAnswerItem.make({
 *   itemId: "kg-answer:s-1:t-1",
 *   sessionId: "s-1",
 *   turnId: "t-1",
 *   question: "Which matter is 10008US01?",
 *   matter: O.none(),
 * })
 * console.log(item.itemId) // "kg-answer:s-1:t-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KgAnswerItem extends S.Opaque<KgAnswerItem, { readonly brand: unique symbol }>()(
  S.Struct({
    itemId: ReviewItemId,
    sessionId: S.NonEmptyString,
    turnId: S.NonEmptyString,
    question: S.String,
    matter: S.OptionFromNullOr(ChosenMatter),
  }).pipe($I.annoteSchema("KgAnswerItem", { description: "The completed turn a per-answer verdict targets." }))
) {}

/**
 * One explicit timer interval, written as one JSON line to the mod's local
 * timer log.
 *
 * **Details**
 *
 * Only `/time start` and `/time stop` create intervals; the duration is the
 * explicit interval and nothing else (law-time-capture-spine doctrine). The
 * rows stay raw until that goal's entry model exists.
 *
 * **Example** (Make a timer interval)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { TimerInterval } from "@/PracticeMod.values"
 *
 * const interval = TimerInterval.make({
 *   schemaVersion: "practice-timer/v1",
 *   sessionId: "s-1",
 *   matter: O.none(),
 *   startedAt: DateTime.makeUnsafe(0),
 *   stoppedAt: DateTime.makeUnsafe(60_000),
 * })
 * console.log(interval.schemaVersion) // "practice-timer/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TimerInterval extends S.Opaque<TimerInterval, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("practice-timer/v1"),
    sessionId: S.NonEmptyString,
    matter: S.OptionFromNullOr(ChosenMatter),
    startedAt: S.DateTimeUtcFromString,
    stoppedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("TimerInterval", { description: "One explicit timer interval, one line of the local timer log." })
  )
) {}
