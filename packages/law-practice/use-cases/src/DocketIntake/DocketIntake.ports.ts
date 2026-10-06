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
import type * as O from "effect/Option";
import type {
  DocketCalendarEntry,
  DocketIntakeState,
  DocketMessage,
  DocketSourceDocument,
  DocketWrittenEntry,
  MatterLookupResult,
  ParalegalEntry,
  SecretaryReview,
} from "./DocketIntake.schemas.ts";

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
export class DocketIntakeError extends S.TaggedError<DocketIntakeError>($I`DocketIntakeError`)(
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
 * Port shape: read access to the watched mailbox.
 *
 * **Example** (Name a mailbox method)
 *
 * ```ts
 * import type { DocketMailboxShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketMailboxShape = "receivedSince";
 * console.log(method);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketMailboxShape {
  /** Mark the message as entered, keeping every category the pipeline did not add. Best effort. */
  readonly markEntered: (message: DocketMessage) => Effect.Effect<void, DocketIntakeError>;
  /** Every received message at or after the timestamp (all of them when `None`), oldest first, all pages. */
  readonly receivedSince: (since: O.Option<string>) => Effect.Effect<ReadonlyArray<DocketMessage>, DocketIntakeError>;
  /** Bytes of the message's document attachments the reviewer can read. */
  readonly sourceDocuments: (
    message: DocketMessage
  ) => Effect.Effect<ReadonlyArray<DocketSourceDocument>, DocketIntakeError>;
}

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
export class DocketMailbox extends Context.Service<DocketMailbox, DocketMailboxShape>()($I`DocketMailbox`) {}

/**
 * Port shape: agent 1, the paralegal who enters a message.
 *
 * **Example** (Name the paralegal method)
 *
 * ```ts
 * import type { DocketParalegalShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketParalegalShape = "enter";
 * console.log(method);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketParalegalShape {
  readonly enter: (message: DocketMessage) => Effect.Effect<ParalegalEntry, DocketIntakeError>;
}

/**
 * Port: agent 1, the paralegal who classifies a message and enters it.
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
export class DocketParalegal extends Context.Service<DocketParalegal, DocketParalegalShape>()($I`DocketParalegal`) {}

/**
 * Port shape: agent 2, the secretary who reviews an entry.
 *
 * **Example** (Name the secretary method)
 *
 * ```ts
 * import type { DocketSecretaryShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketSecretaryShape = "review";
 * console.log(method);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketSecretaryShape {
  readonly review: (input: {
    readonly documents: ReadonlyArray<DocketSourceDocument>;
    readonly entry: ParalegalEntry;
    readonly message: DocketMessage;
  }) => Effect.Effect<SecretaryReview, DocketIntakeError>;
}

/**
 * Port: agent 2, the secretary who reviews agent 1's entry adversarially and
 * reads the mail date and response period from the source document itself.
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
export class DocketSecretary extends Context.Service<DocketSecretary, DocketSecretaryShape>()($I`DocketSecretary`) {}

/**
 * Port shape: practice-KG matter lookup.
 *
 * **Example** (Name the lookup method)
 *
 * ```ts
 * import type { DocketMatterLookupShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketMatterLookupShape = "lookup";
 * console.log(method);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketMatterLookupShape {
  /** Resolve the references of one message to a matter. Never guesses between candidates. */
  readonly lookup: (references: ReadonlyArray<string>) => Effect.Effect<MatterLookupResult, DocketIntakeError>;
}

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
export class DocketMatterLookup extends Context.Service<DocketMatterLookup, DocketMatterLookupShape>()(
  $I`DocketMatterLookup`
) {}

/**
 * Port shape: the attorney's calendar.
 *
 * **Example** (Name a calendar method)
 *
 * ```ts
 * import type { DocketCalendarShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketCalendarShape = "findByKey";
 * console.log(method);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketCalendarShape {
  /** Create the entry. Fails with `ambiguousWrite` when the outcome is unknown; never retries a create itself. */
  readonly create: (entry: DocketCalendarEntry) => Effect.Effect<DocketWrittenEntry, DocketIntakeError>;
  /** The entry already carrying this idempotency key, if one exists. */
  readonly findByKey: (key: string) => Effect.Effect<O.Option<DocketWrittenEntry>, DocketIntakeError>;
}

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
export class DocketCalendar extends Context.Service<DocketCalendar, DocketCalendarShape>()($I`DocketCalendar`) {}

/**
 * Port shape: durable intake state.
 *
 * **Example** (Name a store method)
 *
 * ```ts
 * import type { DocketIntakeStoreShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketIntakeStoreShape = "save";
 * console.log(method);
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketIntakeStoreShape {
  /** The saved state, or empty state when nothing has been saved. */
  readonly load: Effect.Effect<DocketIntakeState, DocketIntakeError>;
  /** Replace the saved state atomically. */
  readonly save: (state: DocketIntakeState) => Effect.Effect<void, DocketIntakeError>;
}

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
export class DocketIntakeStore extends Context.Service<DocketIntakeStore, DocketIntakeStoreShape>()(
  $I`DocketIntakeStore`
) {}
