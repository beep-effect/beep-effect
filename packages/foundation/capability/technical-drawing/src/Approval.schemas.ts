/**
 * Sign-off domain: the approval statement keyed to a sheet-set hash, the
 * confirmation artifacts an approver can author (an email reply or an
 * initialed PDF page), refusal reasons, and the recorded approval.
 *
 * **Details**
 *
 * The record is evidence of a reasonable inquiry (37 CFR 11.18(b); the 2024 AI
 * guidance, 89 FR 25609): it never rests on who ran the CLI. It rests on an
 * artifact the approver authored that carries, on a line of its own, the exact
 * statement printed for that sheet set.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { EmailString, LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Sha256Hex } from "./Manifest.schemas.ts";

const $I = $TechnicalDrawingId.create("Approval.schemas");

/**
 * The verbatim approval line an approver must write for a sheet set.
 *
 * **Example** (The statement for a hash)
 *
 * ```ts
 * import { approvalStatement, Sha256Hex } from "@beep/technical-drawing"
 *
 * console.log(approvalStatement(Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const approvalStatement = (sheetSetSha256: Sha256Hex): string =>
  `I approve design-figure sheet set ${sheetSetSha256} for filing.`;

/**
 * Trimmed, lower-cased email address (`@beep/schema`'s `EmailString`).
 *
 * **Example** (Normalise an address)
 *
 * ```ts
 * import { EmailAddress } from "@beep/technical-drawing"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(EmailAddress)("Attorney@Example.com"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmailAddress = EmailString;

/**
 * Type for {@link EmailAddress}.
 *
 * **Example** (Annotate an address)
 *
 * ```ts
 * import { EmailAddress } from "@beep/technical-drawing"
 * import * as S from "effect/Schema"
 *
 * const approver: EmailAddress = S.decodeUnknownSync(EmailAddress)("attorney@example.com")
 * console.log(approver)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EmailAddress = typeof EmailAddress.Type;

/**
 * An email confirmation, as read from the mail service.
 *
 * **Details**
 *
 * `authoredText` is the message's attorney-authored portion only (Graph
 * `uniqueBody`, plain text), never the full body with the quoted thread.
 *
 * **Example** (A reply)
 *
 * ```ts
 * import { EmailAddress, EmailConfirmation } from "@beep/technical-drawing"
 *
 * const reply = EmailConfirmation.make({
 *   internetMessageId: "<a@b>",
 *   from: EmailAddress.make("attorney@example.com"),
 *   sender: EmailAddress.make("attorney@example.com"),
 *   receivedAt: "2026-10-06T12:00:00Z",
 *   authoredText: "Looks right.\n"
 * })
 * console.log(reply.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmailConfirmation extends S.Class<EmailConfirmation>($I`EmailConfirmation`)(
  {
    kind: S.tag("email").annotateKey({ description: "Confirmation discriminator." }),
    internetMessageId: S.NonEmptyString.annotateKey({ description: "RFC 5322 Message-ID of the reply." }),
    from: EmailAddress.annotateKey({ description: "Graph `from` address." }),
    sender: EmailAddress.annotateKey({ description: "Graph `sender` address." }),
    receivedAt: S.NonEmptyString.annotateKey({ description: "Graph `receivedDateTime`." }),
    authoredText: S.String.annotateKey({ description: "Plain-text `uniqueBody`: the portion the sender wrote." }),
  },
  $I.annote("EmailConfirmation", {
    description: "An email reply's sender addresses and attorney-authored plain text.",
  })
) {}

/**
 * A PDF confirmation: one page the approver initialed.
 *
 * **Example** (An initialed page)
 *
 * ```ts
 * import { EmailAddress, PdfConfirmation } from "@beep/technical-drawing"
 *
 * const page = PdfConfirmation.make({
 *   path: "/corpus/matter/approval.pdf",
 *   initialedPage: 2,
 *   pageText: "Initials: AB\n",
 *   deliveredBy: EmailAddress.make("attorney@example.com"),
 *   attestedBy: "operator"
 * })
 * console.log(page.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PdfConfirmation extends S.Class<PdfConfirmation>($I`PdfConfirmation`)(
  {
    kind: S.tag("pdf").annotateKey({ description: "Confirmation discriminator." }),
    path: S.NonEmptyString.annotateKey({ description: "Absolute path of the PDF under the corpus root." }),
    initialedPage: S.Int.check(
      S.isGreaterThanOrEqualTo(1, {
        identifier: $I`InitialedPageCheck`,
        title: "Initialed Page",
        description: "PDF pages are numbered from one.",
        message: "Expected a page number of at least 1",
      })
    ).annotateKey({ description: "One-based page the approver initialed; named by the operator." }),
    pageText: S.String.annotateKey({ description: "Extracted text of the initialed page only." }),
    deliveredBy: EmailAddress.annotateKey({ description: "Approver the operator attests delivered the PDF." }),
    attestedBy: S.NonEmptyString.annotateKey({ description: "Operator making the delivery attestation." }),
  },
  $I.annote("PdfConfirmation", {
    description: "The text of the page an approver initialed, with the operator's delivery attestation.",
  })
) {}

/**
 * A confirmation artifact, discriminated on `kind`.
 *
 * **Example** (Guard a confirmation)
 *
 * ```ts
 * import { Confirmation, EmailAddress, EmailConfirmation } from "@beep/technical-drawing"
 * import * as S from "effect/Schema"
 *
 * const c = EmailConfirmation.make({ internetMessageId: "<a@b>", from: EmailAddress.make("a@b.co"), sender: EmailAddress.make("a@b.co"), receivedAt: "t", authoredText: "" })
 * console.log(S.is(Confirmation)(c))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Confirmation = S.Union([EmailConfirmation, PdfConfirmation]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Confirmation", {
    description: "Email reply or initialed PDF page offered as the approver's confirmation.",
  })
);

/**
 * Type for {@link Confirmation}.
 *
 * **Example** (Annotate a confirmation)
 *
 * ```ts
 * import { EmailAddress, EmailConfirmation } from "@beep/technical-drawing"
 * import type { Confirmation } from "@beep/technical-drawing"
 *
 * const c: Confirmation = EmailConfirmation.make({ internetMessageId: "<a@b>", from: EmailAddress.make("a@b.co"), sender: EmailAddress.make("a@b.co"), receivedAt: "t", authoredText: "" })
 * console.log(c.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Confirmation = typeof Confirmation.Type;

const ApprovalRefusalReasonBase = LiteralKit([
  "statement-missing",
  "statement-only-quoted",
  "sender-mismatch",
  "delivery-mismatch",
]);

/**
 * Why a confirmation does not approve a sheet set.
 *
 * **Example** (Read the reasons)
 *
 * ```ts
 * import { ApprovalRefusalReason } from "@beep/technical-drawing"
 *
 * console.log(ApprovalRefusalReason.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ApprovalRefusalReason = ApprovalRefusalReasonBase.pipe(
  $I.annoteSchema("ApprovalRefusalReason", {
    description:
      "No verbatim statement line; the line appears only below a reply/forward boundary; the email sender is not the approver; or the PDF was not delivered by the approver.",
  }),
  SchemaUtils.withLiteralKitStatics(ApprovalRefusalReasonBase)
);

/**
 * Type for {@link ApprovalRefusalReason}.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { ApprovalRefusalReason } from "@beep/technical-drawing"
 *
 * const reason: ApprovalRefusalReason = "statement-only-quoted"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ApprovalRefusalReason = typeof ApprovalRefusalReason.Type;

/**
 * A recorded approval of one sheet set.
 *
 * **Details**
 *
 * `by` is descriptive metadata about who ran the command, never proof. The
 * proof is the confirmation: its locator, its content hash, and the
 * approver address it was matched against.
 *
 * **Example** (An email approval)
 *
 * ```ts
 * import { ApprovalRecord, EmailAddress } from "@beep/technical-drawing"
 *
 * const record = ApprovalRecord.make({
 *   sheetSetSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   approver: EmailAddress.make("attorney@example.com"),
 *   statement: "I approve design-figure sheet set e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 for filing.",
 *   by: "developer",
 *   recordedAt: "2026-10-06T12:00:00Z",
 *   confirmationKind: "email",
 *   confirmationLocator: "<a@b>",
 *   confirmationSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   matchedAddress: EmailAddress.make("attorney@example.com"),
 *   attestedBy: ""
 * })
 * console.log(record.confirmationKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApprovalRecord extends S.Class<ApprovalRecord>($I`ApprovalRecord`)(
  {
    sheetSetSha256: Sha256Hex.annotateKey({ description: "Hash of the approved sheet-set PDF." }),
    approver: EmailAddress.annotateKey({ description: "Approver address recorded for the matter." }),
    statement: S.NonEmptyString.annotateKey({ description: "The verbatim statement that was matched." }),
    by: S.String.annotateKey({ description: "Who ran the sign command; descriptive only." }),
    recordedAt: S.NonEmptyString.annotateKey({ description: "ISO-8601 time the record was written." }),
    confirmationKind: S.Literals(["email", "pdf"]).annotateKey({ description: "Kind of confirmation artifact." }),
    confirmationLocator: S.NonEmptyString.annotateKey({
      description: "Internet Message-ID of the reply, or the PDF path and page (`path#page=n`).",
    }),
    confirmationSha256: Sha256Hex.annotateKey({ description: "Hash of the matched confirmation text." }),
    matchedAddress: EmailAddress.annotateKey({
      description: "Sender (email) or attested deliverer (PDF) that matched.",
    }),
    attestedBy: S.String.annotateKey({ description: "Operator delivery attestation for a PDF; empty for email." }),
  },
  $I.annote("ApprovalRecord", {
    description: "Sheet-set hash, approver, matched statement, and the confirmation evidence of one approval.",
  })
) {}
