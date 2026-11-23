/**
 * Question value objects: the facts an agent already checked and the answer
 * options it offers when it asks the attorney through the review queue.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CalendarDate } from "../CalendarDate/index.ts";
import { SourceRef } from "../SourceRef/index.ts";

const $I = $LawPracticeDomainId.create("values/Question/Question.model");

/**
 * **Details**
 *
 * Lowercase kebab-case, such as `keep-date` or `move-to-2026-11-02`. Answer
 * rows name the chosen option by this id.
 *
 * **Example** (Check option ids)
 *
 * ```ts
 * import { QuestionOptionId } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(QuestionOptionId)("keep-date")) // true
 * console.log(S.is(QuestionOptionId)("Keep Date")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const QuestionOptionId = S.NonEmptyString.check(
  S.isPattern(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
    $I.annote("QuestionOptionIdKebabCaseCheck", {
      title: "Kebab-case option id",
      description: "Lowercase letters and digits in hyphen-separated words.",
      message: "Expected a lowercase kebab-case option id, for example keep-date.",
    })
  )
).pipe(
  $I.annoteSchema("QuestionOptionId", {
    description: "Lowercase kebab-case identifier of one answer option, stable within its question.",
  })
);

/**
 * @see {@link QuestionOptionId} for the id format.
 * @category models
 * @since 0.0.0
 */
export type QuestionOptionId = typeof QuestionOptionId.Type;

/**
 * **Example** (Read the write kinds)
 *
 * ```ts
 * import { OptionWriteKind } from "@beep/law-practice-domain"
 *
 * console.log(OptionWriteKind.literals) // ["calendar-date"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OptionWriteKind = LiteralKit(["calendar-date"]).pipe(
  $I.annoteSchema("OptionWriteKind", {
    description: "Kinds of write an answer option can imply; calendar dates for now, docket writes later.",
  })
);

/**
 * @see {@link OptionWriteKind} for the literal domain.
 * @category models
 * @since 0.0.0
 */
export type OptionWriteKind = typeof OptionWriteKind.Type;

/**
 * **Details**
 *
 * `calendar-date` sets a calendar event's title and due date. With `eventId`
 * it updates that provisional event; without it, it creates one. The write is
 * only proposed when the attorney decides on the option; the operator approves
 * the batch before anything is applied.
 *
 * **Example** (Decode a calendar write)
 *
 * ```ts
 * import { OptionWrite } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const write = Effect.runSync(
 *   S.decodeUnknownEffect(OptionWrite)({
 *     kind: "calendar-date",
 *     title: "Response due",
 *     dueOn: "2026-11-02",
 *   })
 * )
 *
 * console.log(write.dueOn.toISOString()) // "2026-11-02"
 * console.log(O.isNone(write.eventId)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const OptionWrite = OptionWriteKind.toTaggedUnion("kind")({
  "calendar-date": {
    title: S.NonEmptyString.annotateKey({
      description: "Title of the calendar event the write sets.",
    }),
    dueOn: CalendarDate.annotateKey({
      description: "Due date the write sets, encoded as YYYY-MM-DD.",
    }),
    eventId: S.NonEmptyString.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Provisional calendar event to update; absent means create a new event.",
      })
    ),
  },
}).pipe(
  $I.annoteSchema("OptionWrite", {
    description: "The write an answer option implies, discriminated on its kind.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * @see {@link OptionWrite} for the tagged-union schema.
 * @category value-objects
 * @since 0.0.0
 */
export type OptionWrite = typeof OptionWrite.Type;

/**
 * **Example** (Build an option without a write)
 *
 * ```ts
 * import { QuestionOption } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const option = QuestionOption.make({ optionId: "keep-date", label: "Keep the current date" })
 *
 * console.log(O.isNone(option.write)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class QuestionOption extends S.Opaque<QuestionOption, { readonly brand: unique symbol }>()(
  S.Struct({
    optionId: QuestionOptionId.annotateKey({
      description: "Identifier answer rows use to name this option.",
    }),
    label: S.NonEmptyString.annotateKey({
      description: "Plain-language answer shown to the attorney.",
    }),
    write: OptionWrite.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Write this option implies when decided; absent for an option that changes nothing.",
      })
    ),
  }).pipe(
    $I.annoteSchema("QuestionOption", {
      description: "One answer the attorney can choose, optionally naming the write it implies.",
    })
  )
) {}

/**
 * **Example** (Type an encoded option id)
 *
 * ```ts
 * import type { QuestionOption } from "@beep/law-practice-domain"
 *
 * const optionId: QuestionOption.Encoded["optionId"] = "keep-date"
 * console.log(optionId) // "keep-date"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace QuestionOption {
  /**
   * Wire-encoded representation of a decoded {@link QuestionOption}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { QuestionOption } from "@beep/law-practice-domain"
   *
   * type Wire = QuestionOption.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof QuestionOption.Encoded;
}

/**
 * **Example** (Check the option count)
 *
 * ```ts
 * import { QuestionOptions } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const keep = { optionId: "keep-date", label: "Keep the current date" }
 * const move = { optionId: "move-date", label: "Move the date" }
 *
 * console.log(S.decodeUnknownExit(QuestionOptions)([keep, move])._tag) // "Success"
 * console.log(S.decodeUnknownExit(QuestionOptions)([keep])._tag) // "Failure"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const QuestionOptions = S.Array(QuestionOption)
  .check(
    S.isMinLength(
      2,
      $I.annote("QuestionOptionsMinimumCheck", {
        title: "At least two options",
        description: "A question offers the attorney at least two answers.",
        message: "Expected at least two answer options.",
      })
    ),
    S.isMaxLength(
      5,
      $I.annote("QuestionOptionsMaximumCheck", {
        title: "At most five options",
        description: "A question offers the attorney at most five answers.",
        message: "Expected at most five answer options.",
      })
    ),
    S.makeFilter(
      (options: ReadonlyArray<QuestionOption>) =>
        A.length(A.dedupe(A.map(options, ({ optionId }) => optionId))) === A.length(options),
      $I.annote("QuestionOptionsUniqueIdCheck", {
        title: "Distinct option ids",
        description: "No two options of one question share an option id.",
        message: "Expected every answer option to have a distinct option id.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("QuestionOptions", {
      description: "The two to five answer options of one question, with distinct option ids.",
    })
  );

/**
 * @see {@link QuestionOptions} for the count and uniqueness checks.
 * @category value-objects
 * @since 0.0.0
 */
export type QuestionOptions = typeof QuestionOptions.Type;

/**
 * **Example** (Build a checked fact)
 *
 * ```ts
 * import { QuestionFact } from "@beep/law-practice-domain"
 *
 * const fact = QuestionFact.make({ text: "The office action was mailed on 2026-08-02.", sourceRefs: [] })
 *
 * console.log(fact.text) // "The office action was mailed on 2026-08-02."
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class QuestionFact extends S.Opaque<QuestionFact, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.NonEmptyString.annotateKey({
      description: "The checked fact, in plain language.",
    }),
    sourceRefs: S.Array(SourceRef).annotateKey({
      description: "Source passages the fact was checked against, in display order.",
    }),
  }).pipe(
    $I.annoteSchema("QuestionFact", {
      description: "A fact the asking agent already checked against records, with its sources.",
    })
  )
) {}

/**
 * **Example** (Type an encoded fact)
 *
 * ```ts
 * import type { QuestionFact } from "@beep/law-practice-domain"
 *
 * const text: QuestionFact.Encoded["text"] = "The office action was mailed on 2026-08-02."
 * console.log(text) // "The office action was mailed on 2026-08-02."
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace QuestionFact {
  /**
   * Wire-encoded representation of a decoded {@link QuestionFact}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { QuestionFact } from "@beep/law-practice-domain"
   *
   * type Wire = QuestionFact.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof QuestionFact.Encoded;
}
