import * as Domain from "@alchemy.run/domain";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { carry } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { EvidenceSignal } from "../Evidence.ts";
import { Proposition } from "../Proposition.ts";

/**
 * The fact: a review of the claim was asked for, as this run. Each review is
 * its own run, so a second review of one claim is a second run. It carries
 * what the run needs to assess, against which evidence revision.
 *
 * @category events
 * @since 0.0.0
 */
export class ReviewRequested extends Domain.Event(
  "ReviewRequested",
  carry({
    run: RunId,
    org: OrgId,
    proposition: Proposition,
    signals: S.Array(EvidenceSignal),
    evidenceRevision: S.Int,
  }),
  { description: "A review of the claim was asked for as this agent run, with what the run needs to assess and the evidence revision it reviews. Each review is its own run." },
) {}
