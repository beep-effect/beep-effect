import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Sequence } from "@proto/kernel/Measure";
import { carry } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { Disposition } from "../Disposition.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";
import { $PartyContractId } from "@proto/kernel/Identity";

const $I = $PartyContractId.create("Claim/ProposeDisposition.command");

/**
 * Refused: only an agent run proposes; a person decides directly.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotAnAgent extends S.TaggedError<NotAnAgent, { readonly brand: unique symbol }>()(
  "NotAnAgent",
  {},
  $I.annote("NotAnAgent", { httpApiStatus: 403, description: "Only an agent run may propose a disposition." }),
) {}

/**
 * Refused: the proposal was made against evidence that has since changed.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ProposalStale extends S.TaggedError<ProposalStale, { readonly brand: unique symbol }>()(
  "ProposalStale",
  { evidenceRevision: Sequence },
  $I.annote("ProposalStale", { httpApiStatus: 409, description: "The evidence changed since the proposal's revision; assess it again." }),
) {}

/**
 * The fact: an agent run proposed what to do with a pending claim, and why,
 * against one evidence revision, under a digest an approval names.
 *
 * @category events
 * @since 0.0.0
 */
export class DispositionProposed extends Domain.Event(
  "DispositionProposed",
  carry({ disposition: Disposition, rationale: S.String, run: RunId, evidenceRevision: Sequence, digest: S.String }),
  { description: "An agent run proposed what to do with a pending claim and why, against one evidence revision, under a digest that an approval names." },
) {}

/**
 * What an agent run may ask for: a proposal a reviewer later decides on.
 *
 * @category commands
 * @since 0.0.0
 */
export class ProposeDisposition extends Domain.Command(
  "ProposeDisposition",
  {
    target: ClaimId,
    middleware: [Session],
    input: { disposition: Disposition, rationale: S.String, evidenceRevision: Sequence },
    events: [DispositionProposed],
    rejects: [ClaimNotPending, MissingGrant, NotAnAgent, ProposalStale],
  },
  { description: "Propose accepting or rejecting a pending claim, with a rationale. Agent runs only." },
) {}
