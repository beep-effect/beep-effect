/**
 * Data-quality issues raised while graduating identifiers or building PartyKey
 * bases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PartyDomainId.create("values/Identifier/Identifier.errors");

/**
 * Why an identifier or PartyKey basis was rejected as a data-quality issue.
 *
 * **Example** (Check an issue reason)
 *
 * ```ts
 * import { IdentifierIssueReason } from "@beep/party-domain/Identifier"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IdentifierIssueReason)("invalid-domain")) // true
 * console.log(S.is(IdentifierIssueReason)("typo")) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const IdentifierIssueReason = LiteralKit([
  "empty-value",
  "unpaired-surrogate",
  "unparseable-mailbox",
  "invalid-domain",
  "missing-authority",
  "ambiguous-phone",
  "unsupported-country",
  "invalid-phone",
  "missing-source-record-identity",
  "invalid-basis",
]).pipe(
  $I.annoteSchema("IdentifierIssueReason", {
    description: "Why an identifier or PartyKey basis was rejected as a data-quality issue.",
  })
);

/**
 * {@inheritDoc IdentifierIssueReason}
 *
 * @category errors
 * @since 0.0.0
 */
export type IdentifierIssueReason = typeof IdentifierIssueReason.Type;

/**
 * Which input field an issue concerns.
 *
 * **Example** (Check an issue field)
 *
 * ```ts
 * import { IdentifierIssueField } from "@beep/party-domain/Identifier"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IdentifierIssueField)("country")) // true
 * console.log(S.is(IdentifierIssueField)("display-name")) // false
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const IdentifierIssueField = LiteralKit(["value", "namespace", "handle", "record-id", "country", "basis"]).pipe(
  $I.annoteSchema("IdentifierIssueField", { description: "Which input field an identifier issue concerns." })
);

/**
 * {@inheritDoc IdentifierIssueField}
 *
 * @category errors
 * @since 0.0.0
 */
export type IdentifierIssueField = typeof IdentifierIssueField.Type;

/**
 * A data-quality issue raised while graduating an identifier or building a
 * PartyKey basis. It is never repaired by stripping or guessing.
 *
 * **Gotchas**
 *
 * `input` holds the raw offending text when one raw value failed (an email
 * address, phone number, handle, namespace or record id). That text is
 * personal data: report the `reason` and `field`, and do not log `input`
 * verbatim. Structural basis failures carry an empty `input` and
 * `field: "basis"`; schema messages are never copied into an issue.
 *
 * **Example** (Inspect an issue reason)
 *
 * ```ts
 * import { IdentifierIssue } from "@beep/party-domain/Identifier"
 *
 * const issue = IdentifierIssue.make({ reason: "invalid-domain", input: "a@-bad-.test", field: "value" })
 * console.log(issue.reason) // "invalid-domain"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentifierIssue extends S.TaggedError<IdentifierIssue, { readonly brand: unique symbol }>(
  $I`IdentifierIssue`
)(
  "IdentifierIssue",
  {
    reason: IdentifierIssueReason,
    input: S.String,
    field: S.optionalKey(IdentifierIssueField),
  },
  $I.annoteError<IdentifierIssue>("IdentifierIssue", {
    description: "A data-quality issue raised while graduating an identifier or building a PartyKey basis.",
  })
) {}
