/**
 * The send guard of the Microsoft 365 outbox server.
 *
 * **Details**
 *
 * A send restates the recipients, subject and attachments the caller means to
 * send. {@link checkSendExpectation} compares that restatement with the draft
 * as Graph stores it and with the name, byte length and SHA-256 digest of
 * each stored attachment, computed from the stored bytes at check time. It is
 * a pure function: it reads nothing and sends nothing.
 *
 * @category guards
 * @since 0.1.0
 */

import { $M365McpId } from "@beep/identity/packages";
import { GraphMessage } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import { flow, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OutboxAttachmentDigest } from "./OutboxAttachmentSource.ts";
import type { GraphRecipient } from "@beep/m365";

const $I = $M365McpId.create("OutboxSendGuard");

/**
 * What the caller expects a send to deliver.
 *
 * **Example** (Restate a draft before sending)
 *
 * ```ts
 * import { OutboxSendExpectation } from "@beep/m365-mcp/OutboxSendGuard"
 *
 * const expect = OutboxSendExpectation.make({
 *   attachments: [],
 *   bcc: [],
 *   cc: [],
 *   subject: "Filing receipt",
 *   to: ["counsel@example.test"]
 * })
 * console.log(expect.to.length)
 * // 1
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxSendExpectation extends S.Class<OutboxSendExpectation>($I`OutboxSendExpectation`)(
  {
    attachments: S.Array(OutboxAttachmentDigest).annotateKey({
      description:
        "Every attachment the message must carry: its name, size and sha256 exactly as create_draft or get_draft returned them.",
    }),
    bcc: S.Array(S.String).annotateKey({ description: "Every blind-carbon-copy address; empty when there is none." }),
    cc: S.Array(S.String).annotateKey({ description: "Every carbon-copy address; empty when there is none." }),
    subject: S.String.annotateKey({ description: "The subject, compared after trimming." }),
    to: S.Array(S.String).annotateKey({ description: "Every primary recipient address." }),
  },
  $I.annote("OutboxSendExpectation", {
    description: "The exact recipients, subject and attachments a send is expected to deliver.",
  })
) {}

/**
 * A part of a stored draft that can differ from a send expectation.
 *
 * **Example** (Guard a mismatch field)
 *
 * ```ts
 * import { OutboxSendMismatchField } from "@beep/m365-mcp/OutboxSendGuard"
 *
 * console.log(OutboxSendMismatchField.is.subject("subject"))
 * // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const OutboxSendMismatchField = LiteralKit([
  "not-a-draft",
  "to",
  "cc",
  "bcc",
  "subject",
  "attachments",
  "attachment-digest",
]).pipe(
  $I.annoteSchema("OutboxSendMismatchField", {
    description: "A part of a stored draft that differs from the send expectation.",
  })
);

/**
 * Type for {@link OutboxSendMismatchField}.
 *
 * **Example** (Type a mismatch field)
 *
 * ```ts
 * import type { OutboxSendMismatchField } from "@beep/m365-mcp/OutboxSendGuard"
 *
 * const field: OutboxSendMismatchField = "attachment-digest"
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type OutboxSendMismatchField = typeof OutboxSendMismatchField.Type;

/**
 * The guard's refusal: the fields in which the stored draft differs.
 *
 * **Example** (Construct a mismatch)
 *
 * ```ts
 * import { OutboxSendMismatch } from "@beep/m365-mcp/OutboxSendGuard"
 *
 * const mismatch = OutboxSendMismatch.make({ fields: ["to", "subject"] })
 * console.log(mismatch.fields.length)
 * // 2
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxSendMismatch extends S.Class<OutboxSendMismatch>($I`OutboxSendMismatch`)(
  {
    fields: S.NonEmptyArray(OutboxSendMismatchField).annotateKey({
      description: "The differing fields, in a fixed order, each at most once.",
    }),
  },
  $I.annote("OutboxSendMismatch", {
    description: "Refusal of the send guard, naming the fields in which the stored draft differs.",
  })
) {}

/**
 * Everything the guard compares: the stored draft, the summaries of its
 * stored attachments, and the caller's expectation.
 *
 * **Example** (Assemble a guard input)
 *
 * ```ts
 * import { GraphMessage } from "@beep/m365"
 * import { OutboxSendCheck, OutboxSendExpectation } from "@beep/m365-mcp/OutboxSendGuard"
 * import * as O from "effect/Option"
 *
 * const check = OutboxSendCheck.make({
 *   draft: GraphMessage.make({ id: "message-id", isDraft: O.some(true), subject: O.some("Filing receipt") }),
 *   expect: OutboxSendExpectation.make({ attachments: [], bcc: [], cc: [], subject: "Filing receipt", to: [] }),
 *   stored: []
 * })
 * console.log(check.draft.id)
 * // "message-id"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class OutboxSendCheck extends S.Class<OutboxSendCheck>($I`OutboxSendCheck`)(
  {
    draft: GraphMessage.annotateKey({ description: "The draft as Graph stores it." }),
    expect: OutboxSendExpectation.annotateKey({ description: "What the caller expects to send." }),
    stored: S.Array(OutboxAttachmentDigest).annotateKey({
      description: "Name, byte length and digest of each stored attachment, computed from the stored bytes.",
    }),
  },
  $I.annote("OutboxSendCheck", { description: "Input of the send guard." })
) {}

const sortStrings = A.sort(Order.String);

const normalizeAddress = flow(Str.trim, Str.toLowerCase);

const addressSet = flow(A.map(normalizeAddress), A.dedupe, sortStrings);

/**
 * The addresses of a stored recipient list.
 *
 * **Details**
 *
 * An absent list is empty. A recipient without an address becomes `""`, which
 * no expected address equals, so it can never pass the guard unnoticed.
 *
 * **Example** (Read stored addresses)
 *
 * ```ts
 * import { GraphEmailAddress, GraphRecipient } from "@beep/m365"
 * import { storedRecipientAddresses } from "@beep/m365-mcp/OutboxSendGuard"
 * import * as O from "effect/Option"
 *
 * const addresses = storedRecipientAddresses(
 *   O.some([
 *     GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({ address: O.some("counsel@example.test") })) })
 *   ])
 * )
 * console.log(addresses)
 * // ["counsel@example.test"]
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const storedRecipientAddresses: (recipients: O.Option<ReadonlyArray<GraphRecipient>>) => ReadonlyArray<string> =
  flow(
    O.getOrElse((): ReadonlyArray<GraphRecipient> => []),
    A.map((recipient) =>
      pipe(
        recipient.emailAddress,
        O.flatMap((emailAddress) => emailAddress.address),
        O.getOrElse(() => "")
      )
    )
  );

const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  A.length(left) === A.length(right) && A.every(left, (value, index) => value === right[index]);

const sameAddressSet = (stored: O.Option<ReadonlyArray<GraphRecipient>>, expected: ReadonlyArray<string>): boolean =>
  sameStrings(pipe(stored, storedRecipientAddresses, addressSet), addressSet(expected));

const sizeAndName = (attachment: OutboxAttachmentDigest): string => `${attachment.size}\u0000${attachment.name}`;

const sizeNameAndDigest = (attachment: OutboxAttachmentDigest): string =>
  `${sizeAndName(attachment)}\u0000${attachment.sha256}`;

const sameMultiset = (
  left: ReadonlyArray<OutboxAttachmentDigest>,
  right: ReadonlyArray<OutboxAttachmentDigest>,
  key: (attachment: OutboxAttachmentDigest) => string
): boolean => sameStrings(sortStrings(A.map(left, key)), sortStrings(A.map(right, key)));

/**
 * Whether two attachment lists hold the same names, sizes and digests,
 * counting duplicates and ignoring order.
 *
 * **Example** (Compare attachment lists)
 *
 * ```ts
 * import { OutboxAttachmentDigest } from "@beep/m365-mcp/OutboxAttachmentSource"
 * import { sameAttachments } from "@beep/m365-mcp/OutboxSendGuard"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const receipt = OutboxAttachmentDigest.make({ name: "receipt.pdf", sha256: Sha256Hex.make("0".repeat(64)), size: 4 })
 * console.log(sameAttachments([receipt], [receipt]))
 * // true
 * console.log(sameAttachments([receipt, receipt], [receipt]))
 * // false
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const sameAttachments: {
  (right: ReadonlyArray<OutboxAttachmentDigest>): (left: ReadonlyArray<OutboxAttachmentDigest>) => boolean;
  (left: ReadonlyArray<OutboxAttachmentDigest>, right: ReadonlyArray<OutboxAttachmentDigest>): boolean;
} = dual(2, (left: ReadonlyArray<OutboxAttachmentDigest>, right: ReadonlyArray<OutboxAttachmentDigest>): boolean =>
  sameMultiset(left, right, sizeNameAndDigest)
);

/**
 * Compare a stored draft with what the caller expects to send.
 *
 * **Details**
 *
 * The result is `Option.none` when the draft may be sent, and otherwise the
 * fields that differ. The draft passes only when all of these hold:
 *
 * - it is still a draft;
 * - each recipient list equals the expected list as a set, ignoring case and
 *   surrounding whitespace of an address;
 * - the subject is equal after trimming;
 * - the stored attachments' names and byte lengths equal the expected ones,
 *   counting duplicates (`attachments` otherwise);
 * - with names and sizes equal, the digests of the stored bytes equal the
 *   expected digests (`attachment-digest` otherwise).
 *
 * **Example** (Refuse a draft whose subject changed)
 *
 * ```ts
 * import { GraphMessage } from "@beep/m365"
 * import { checkSendExpectation, OutboxSendCheck, OutboxSendExpectation } from "@beep/m365-mcp/OutboxSendGuard"
 * import * as O from "effect/Option"
 *
 * const mismatch = checkSendExpectation(
 *   OutboxSendCheck.make({
 *     draft: GraphMessage.make({ id: "message-id", isDraft: O.some(true), subject: O.some("Edited in Outlook") }),
 *     expect: OutboxSendExpectation.make({ attachments: [], bcc: [], cc: [], subject: "Filing receipt", to: [] }),
 *     stored: []
 *   })
 * )
 * console.log(O.map(mismatch, (found) => found.fields))
 * // Option.some(["subject"])
 * ```
 *
 * @category guards
 * @since 0.1.0
 */
export const checkSendExpectation = (check: OutboxSendCheck): O.Option<OutboxSendMismatch> => {
  const { draft, expect, stored } = check;
  const sameNamesAndSizes = sameMultiset(stored, expect.attachments, sizeAndName);
  const differs: ReadonlyArray<readonly [OutboxSendMismatchField, boolean]> = [
    ["not-a-draft", !O.contains(draft.isDraft, true)],
    ["to", !sameAddressSet(draft.toRecipients, expect.to)],
    ["cc", !sameAddressSet(draft.ccRecipients, expect.cc)],
    ["bcc", !sameAddressSet(draft.bccRecipients, expect.bcc)],
    [
      "subject",
      Str.trim(
        pipe(
          draft.subject,
          O.getOrElse(() => "")
        )
      ) !== Str.trim(expect.subject),
    ],
    ["attachments", !sameNamesAndSizes],
    ["attachment-digest", sameNamesAndSizes && !sameAttachments(stored, expect.attachments)],
  ];
  const fields = pipe(
    A.filter(differs, ([, isDifferent]) => isDifferent),
    A.map(([field]) => field)
  );

  return A.isReadonlyArrayNonEmpty(fields) ? O.some(OutboxSendMismatch.make({ fields })) : O.none();
};
