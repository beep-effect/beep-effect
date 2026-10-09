/**
 * Inputs, plans and private journals of contact seeding.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeM365ContactsId } from "@beep/identity/packages";
import { Contact } from "@beep/law-practice-use-cases/DocumentIdentification";
import { GraphPathSegment } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $PracticeM365ContactsId.create("Contacts.schemas");

/** Fixed rollback category, shared by every run.
 * **Example** (Inspect the rollback tag)
 * ```ts
 * import { seedCategory } from "@/Contacts.schemas"
 * console.log(seedCategory) // "beep-practice-contacts-seed"
 * ```
 * @category constants
 * @since 0.0.0
 */
export const seedCategory = "beep-practice-contacts-seed";

/** Dedicated folder's initial name; recorded ids survive later renames.
 * **Example** (Inspect the initial folder name)
 * ```ts
 * import { seedFolderName } from "@/Contacts.schemas"
 * console.log(seedFolderName)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const seedFolderName = "Practice contacts (seeded)";

/** Private caller-supplied inputs; no corpus location is inferred.
 * **Example** (Build an offline input)
 * ```ts
 * import { ContactInputs } from "@/Contacts.schemas"
 * console.log(ContactInputs.make({ csv: ["fixture.csv"], vcf: [] }).csv.length) // 1
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class ContactInputs extends S.Class<ContactInputs>($I`ContactInputs`)(
  { csv: S.Array(S.NonEmptyString), vcf: S.Array(S.NonEmptyString) },
  $I.annote("ContactInputs", { description: "Explicit private contact source paths." })
) {}

/** A plan distinguishes creates from each safety-preserving skip.
 * **Example** (Construct a skip)
 * ```ts
 * import { ContactPlanRow } from "@/Contacts.schemas"
 * console.log(ContactPlanRow.cases.SkipUnidentifiable.make({ count: 1 }).count) // 1
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ContactPlanRow = S.TaggedUnion({
  Create: { contact: Contact },
  SkipExistsInMailbox: { contact: Contact },
  SkipAlreadySeeded: { contact: Contact },
  Conflict: { contact: Contact, reason: S.tag("same-name-company-different-email") },
  SkipUnidentifiable: { count: S.Natural },
}).pipe(
  $I.annoteSchema("ContactPlanRow", { description: "Contact create plan with explicit skip and conflict cases." })
);
/**
 * A decoded create or skip decision carrying private source identity.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContactPlanRow = typeof ContactPlanRow.Type;

/** Counts-only public report.
 * **Example** (Construct an empty report)
 * ```ts
 * import { ContactReport } from "@/Contacts.schemas"
 * console.log(ContactReport.make({ runId: "fixture-run", Create: 0, SkipExistsInMailbox: 0, SkipAlreadySeeded: 0, Conflict: 0, SkipUnidentifiable: 0, untrackedTagged: 0, created: 0, failed: 0, edited: 0, deleted: 0 }))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class ContactReport extends S.Class<ContactReport>($I`ContactReport`)(
  {
    runId: S.NonEmptyString,
    Create: S.Natural,
    SkipExistsInMailbox: S.Natural,
    SkipAlreadySeeded: S.Natural,
    Conflict: S.Natural,
    SkipUnidentifiable: S.Natural,
    untrackedTagged: S.Natural,
    created: S.Natural,
    failed: S.Natural,
    edited: S.Natural,
    unverifiable: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0))
    ),
    deleted: S.Natural,
  },
  $I.annote("ContactReport", { description: "Counts only; never names, addresses or paths." })
) {}

/** Counts for one unique CSV byte stream.
 * **Example** (Describe an empty export)
 * ```ts
 * import { CsvCensus } from "@/Contacts.schemas"
 * console.log(CsvCensus.make({ sha256: "fixture-hash", inputsSharingHash: 1, columnCount: 0, headerNames: [], recordCount: 0, withEmail: 0, withNonRoleEmail: 0, roleOnly: 0 }).recordCount)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class CsvCensus extends S.Class<CsvCensus>($I`CsvCensus`)(
  {
    sha256: S.NonEmptyString,
    inputsSharingHash: S.Natural,
    columnCount: S.Natural,
    headerNames: S.Array(S.String),
    recordCount: S.Natural,
    withEmail: S.Natural,
    withNonRoleEmail: S.Natural,
    roleOnly: S.Natural,
  },
  $I.annote("CsvCensus", { description: "CSV header names and counts without source paths or records." })
) {}

/** Offline source census, including VCF comparison counts only.
 * **Example** (Describe an empty census)
 * ```ts
 * import { ContactCensus } from "@/Contacts.schemas"
 * console.log(ContactCensus.make({ csvInputs: [], csvNormalized: 0, unidentifiable: 0, vcfCards: 0, vcfNormalized: 0, vcfOverlap: 0, vcfOnly: 0 }).vcfCards)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class ContactCensus extends S.Class<ContactCensus>($I`ContactCensus`)(
  {
    csvInputs: S.Array(CsvCensus),
    csvNormalized: S.Natural,
    unidentifiable: S.Natural,
    vcfCards: S.Natural,
    vcfNormalized: S.Natural,
    vcfOverlap: S.Natural,
    vcfOnly: S.Natural,
  },
  $I.annote("ContactCensus", { description: "Counts-only offline CSV and VCF census." })
) {}

/** One privately journaled create and its original change key.
 * **Example** (Construct a journal entry)
 * ```ts
 * import { CreatedContact } from "@/Contacts.schemas"
 * console.log(CreatedContact.make({ sourceKey: "fixture-key", contactId: "fixture-id", changeKey: "fixture-version" }).sourceKey)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class CreatedContact extends S.Class<CreatedContact>($I`CreatedContact`)(
  { sourceKey: S.NonEmptyString, contactId: GraphPathSegment, changeKey: S.NonEmptyString },
  $I.annote("CreatedContact", { description: "Private contact create receipt for guarded undo." })
) {}

/** Private durable run state, written before any non-idempotent create.
 * **Example** (Construct an empty journal)
 * ```ts
 * import { RunJournal } from "@/Contacts.schemas"
 * console.log(RunJournal.make({ runId: "fixture-run", folderCreated: false, contacts: [] }).contacts.length) // 0
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class RunJournal extends S.Class<RunJournal>($I`RunJournal`)(
  {
    runId: GraphPathSegment,
    folderId: S.OptionFromOptionalKey(GraphPathSegment).pipe(S.withConstructorDefault(Effect.succeedNone)),
    folderCreated: S.Boolean,
    contacts: S.Array(CreatedContact),
    pendingSourceKey: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("RunJournal", { description: "Durable run id, folder ownership and contact receipts." })
) {}

/** Technical failure codes; no private contact value is a failure message.
 * **Example** (Inspect a failure reason)
 * ```ts
 * import { ContactsFailureReason } from "@/Contacts.schemas"
 * console.log(ContactsFailureReason.is["untracked-tagged"]("untracked-tagged")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ContactsFailureReason = LiteralKit([
  "input",
  "state",
  "locked",
  "untracked-tagged",
  "unsafe-export",
  "ambiguous-write",
  "missing-version",
  "confirmation",
  "folder-ambiguous",
]).pipe($I.annoteSchema("ContactsFailureReason", { description: "Sanitized contact job failure reasons." }));
/**
 * A technical job failure code safe to include in public diagnostics.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContactsFailureReason = typeof ContactsFailureReason.Type;

/** Sanitized job failure.
 * **Example** (Construct a stopped run)
 * ```ts
 * import { ContactsError } from "@/Contacts.schemas"
 * console.log(ContactsError.make({ reason: "untracked-tagged" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ContactsError extends S.TaggedError<ContactsError>($I`ContactsError`)(
  "ContactsError",
  { reason: ContactsFailureReason },
  $I.annote("ContactsError", { description: "A safety guard or private input failure." })
) {}
