import * as Domain from "@alchemy.run/domain";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { Proposition } from "@proto/party-contract/Proposition";
import * as S from "effect/Schema";

/**
 * The mailbox could not be read.
 *
 * @category errors
 * @since 0.0.0
 */
export class MailboxUnavailable extends S.TaggedError<MailboxUnavailable>()("MailboxUnavailable", {
  mailbox: S.String,
}) {}

/**
 * One claim a source found, with the upstream id it was found under. A
 * poller sends it as `AssertClaim` with that id as the command id, so a
 * redelivery applies once.
 *
 * @category models
 * @since 0.0.0
 */
export const SourceAssertion = S.Struct({
  sourceId: S.String,
  claimId: ClaimId,
  proposition: Proposition,
  signals: S.Array(EvidenceSignal),
});
/**
 * @category models
 * @since 0.0.0
 */
export type SourceAssertion = typeof SourceAssertion.Type;

/**
 * Where contact evidence comes from (a mailbox). A port: the model declares
 * the contract, a host implements it, and only a host's cluster class calls it.
 *
 * @category external systems
 * @since 0.0.0
 */
export class ContactSource extends Domain.ExternalSystem(
  "ContactSource",
  {
    observe: {
      args: { mailbox: S.String, since: S.Number },
      success: { assertions: S.Array(SourceAssertion) },
      error: MailboxUnavailable,
    },
  },
  { description: "Reads a mailbox for claims about parties since a point in time." },
) {}
