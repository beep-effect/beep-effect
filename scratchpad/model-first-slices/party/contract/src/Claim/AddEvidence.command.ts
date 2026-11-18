import * as Domain from "@alchemy.run/domain";
import { carry } from "@proto/kernel/Invocation";
import { Sequence } from "@proto/kernel/Measure";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { EvidenceSignal } from "../Evidence.ts";
import { ClaimId } from "./Claim.id.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

/**
 * The fact: more evidence arrived, and the claim's evidence revision is now
 * `revision`. A proposal made against an earlier revision is stale.
 *
 * @category events
 * @since 0.0.0
 */
export class EvidenceAdded extends Domain.Event(
  "EvidenceAdded",
  carry({ signals: S.Array(EvidenceSignal), revision: Sequence }),
  { description: "More evidence arrived and the claim's evidence revision is now `revision`. A proposal made against an earlier revision is stale." },
) {}

/**
 * Add evidence to a pending claim.
 *
 * @category commands
 * @since 0.0.0
 */
export class AddEvidence extends Domain.Command(
  "AddEvidence",
  {
    target: ClaimId,
    middleware: [Session],
    input: { signals: S.Array(EvidenceSignal) },
    events: [EvidenceAdded],
    rejects: [ClaimNotPending, MissingGrant],
  },
  { description: "Add evidence to a pending claim; an earlier proposal becomes stale." },
) {}
