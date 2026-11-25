/**
 * Typed failures of the question queue and its answer-log store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { QuestionOptionId, ReviewItemId } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { DefectCause } from "../internal/DefectCause.ts";

const $I = $LawPracticeUseCasesId.create("QuestionQueue/QuestionQueue.errors");

/**
 * **Details**
 *
 * The answer row schema cannot see the question, so the queue checks the
 * `optionId` against the item's `options` before it appends anything.
 *
 * **Example** (Report an unknown option)
 *
 * ```ts
 * import { UnknownQuestionOptionError } from "@beep/law-practice-use-cases/QuestionQueue"
 *
 * const error = UnknownQuestionOptionError.make({ itemId: "question:1", optionId: "move-date" })
 * console.log(error._tag) // "UnknownQuestionOptionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnknownQuestionOptionError extends S.TaggedError<
  UnknownQuestionOptionError,
  { readonly brand: unique symbol }
>($I`UnknownQuestionOptionError`)(
  "UnknownQuestionOptionError",
  {
    itemId: ReviewItemId.annotateKey({
      description: "Question the answer was recorded for.",
    }),
    optionId: QuestionOptionId.annotateKey({
      description: "Option the answer named; the question offers no option with this id.",
    }),
  },
  $I.annoteError<UnknownQuestionOptionError>("UnknownQuestionOptionError", {
    title: "Unknown question option",
    description: "A decided answer names an option its question does not offer.",
  })
) {}

/**
 * **Example** (Report an answer for another question)
 *
 * ```ts
 * import { QuestionNotFoundError } from "@beep/law-practice-use-cases/QuestionQueue"
 *
 * const error = QuestionNotFoundError.make({ itemId: "question:2" })
 * console.log(error.itemId) // "question:2"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class QuestionNotFoundError extends S.TaggedError<QuestionNotFoundError, { readonly brand: unique symbol }>(
  $I`QuestionNotFoundError`
)(
  "QuestionNotFoundError",
  {
    itemId: ReviewItemId.annotateKey({
      description: "Question the answer names; it is not the question given with the answer.",
    }),
  },
  $I.annoteError<QuestionNotFoundError>("QuestionNotFoundError", {
    title: "Question not found",
    description: "An answer was submitted for a question other than the one given with it.",
  })
) {}

const AnswerLogOperationBase = LiteralKit(["read", "append"]);

/**
 * **Example** (Guard a store operation)
 *
 * ```ts
 * import { AnswerLogOperation } from "@beep/law-practice-use-cases/QuestionQueue"
 *
 * console.log(AnswerLogOperation.is.read("read")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnswerLogOperation = AnswerLogOperationBase.pipe(
  $I.annoteSchema("AnswerLogOperation", {
    description: "Answer-log store operation that failed: reading the rows or appending one.",
  }),
  SchemaUtils.withLiteralKitStatics(AnswerLogOperationBase)
);

/**
 * @see {@link AnswerLogOperation} for the operation names.
 * @category errors
 * @since 0.0.0
 */
export type AnswerLogOperation = typeof AnswerLogOperation.Type;

/**
 * **Details**
 *
 * A store that cannot answer fails with this error rather than returning an
 * empty log: an unreadable log would otherwise put every question back in the
 * digest. After a failed `append` the row may or may not be stored; read the
 * log before writing again. The cause is kept for diagnostics only.
 *
 * **Example** (Report a failed read)
 *
 * ```ts
 * import { AnswerLogError } from "@beep/law-practice-use-cases/QuestionQueue"
 *
 * const error = AnswerLogError.make({ operation: "read" })
 * console.log(error.operation) // "read"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AnswerLogError extends S.TaggedError<AnswerLogError, { readonly brand: unique symbol }>(
  $I`AnswerLogError`
)(
  "AnswerLogError",
  {
    cause: DefectCause.annotateKey({
      description: "Optional underlying store defect.",
    }),
    operation: AnswerLogOperation.annotateKey({
      description: "Store operation that failed.",
    }),
  },
  $I.annoteError<AnswerLogError>("AnswerLogError", {
    title: "Answer log unavailable",
    description: "The answer-log store could not read its rows or append one.",
  })
) {}
