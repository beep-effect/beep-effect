/**
 * Ports of the docket intake pipeline. The pipeline owns the order of work,
 * the date policy and idempotency; each port is one outside capability with
 * no policy of its own.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Context, Effect } from "effect";
import * as S from "effect/Schema";
import { DocketIntakeStage } from "./DocketIntake.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketIntake.ports");
/**
 * Failure of one docket intake port call.
 *
 * **Details**
 *
 * `ambiguousWrite` is true only when a calendar create may or may not have
 * taken effect. The pipeline then looks the entry up by key instead of
 * creating it again. `cause` is a short technical label, never message
 * content.
 *
 * **Example** (Make a port error)
 *
 * ```ts
 * import { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketIntakeError.make({ cause: "timeout", stage: "review" }).stage);
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocketIntakeError extends S.TaggedError($I`DocketIntakeError`)(
  "DocketIntakeError",
  {
    ambiguousWrite: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({ description: "Whether a create may or may not have taken effect." }),
    cause: S.String.annotateKey({ description: "Short technical label of the failure; never content." }),
    stage: DocketIntakeStage.annotateKey({ description: "Stage whose port failed." }),
  },
  $I.annote("DocketIntakeError", { description: "Failure of one docket intake port call." })
) {}
/**
 * Port: read access to the watched mailbox.
 *
 * **Example** (Reference the mailbox port)
 *
 * ```ts
 * import { DocketMailbox } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketMailbox.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketMailbox extends Context.Service()($I`DocketMailbox`) {}
/**
 * Port: agent 1, the paralegal who classifies a message and enters it, and
 * who revises or defends its entry when the review disputes it.
 *
 * **Example** (Reference the paralegal port)
 *
 * ```ts
 * import { DocketParalegal } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketParalegal.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketParalegal extends Context.Service()($I`DocketParalegal`) {}
/**
 * Port: agent 2, the secretary who reviews agent 1's entry adversarially and
 * reads the mail date and response period from the source document itself.
 *
 * **Details**
 *
 * `review` is the independent first reading. `critique` lists problems with
 * what the secretary is shown of the entry, and `reread` reads disputed fields
 * again in the later rounds of the review loop.
 *
 * **Example** (Reference the secretary port)
 *
 * ```ts
 * import { DocketSecretary } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketSecretary.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketSecretary extends Context.Service()($I`DocketSecretary`) {}
/**
 * Port: practice-KG matter lookup.
 *
 * **Example** (Reference the lookup port)
 *
 * ```ts
 * import { DocketMatterLookup } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketMatterLookup.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketMatterLookup extends Context.Service()($I`DocketMatterLookup`) {}
/**
 * Port: read-only access to the tracked dates on the attorney's docket sheet.
 *
 * **Details**
 *
 * The port is optional. When no layer provides it the pipeline does no
 * cross-check and adds no flag; when it fails the entry is flagged
 * `tracked-dates-unavailable` and is written all the same. Nothing is ever
 * written to the sheet.
 *
 * **Example** (Reference the tracked dates port)
 *
 * ```ts
 * import { DocketTrackedDates } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketTrackedDates.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketTrackedDates extends Context.Service()($I`DocketTrackedDates`) {}
/**
 * Port: the attorney's calendar, the system of record.
 *
 * **Example** (Reference the calendar port)
 *
 * ```ts
 * import { DocketCalendar } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketCalendar.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketCalendar extends Context.Service()($I`DocketCalendar`) {}
/**
 * Port: durable intake state (cursor and ledger).
 *
 * **Example** (Reference the store port)
 *
 * ```ts
 * import { DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketIntakeStore.key);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketIntakeStore extends Context.Service()($I`DocketIntakeStore`) {}
