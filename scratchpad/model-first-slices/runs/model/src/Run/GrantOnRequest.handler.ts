import { DelegationId, RunId } from "@proto/kernel/Ids";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import { ActivateRun } from "@proto/runs-contract/Run/ActivateRun.command";
import { RejectRun } from "@proto/runs-contract/Run/RejectRun.command";
import * as Effect from "effect/Effect";
import { Authority } from "../Authority.external.ts";
import { AgentRun } from "./AgentRun.aggregate.ts";
import { GrantOnRequest } from "./GrantOnRequest.policy.ts";

/**
 * Asks the authority context to delegate the requested terms to the run as
 * the requester, then activates it; a refusal is recorded as the run's rejection.
 *
 * @category handlers
 * @since 0.0.0
 */
export const GrantOnRequestLive = GrantOnRequest.toLayer(
  Effect.gen(function* () {
    const runs = yield* AgentRun;
    const authority = yield* Authority;
    return Effect.fn(function* (trigger) {
      const { event } = trigger;
      const run = RunId.make(trigger.source.id);
      const hop = byProcess(GrantOnRequest.policyName, eventCause(trigger));
      const provenance = extend(event.provenance, hop);
      yield* authority
        .grantRun({
          provenance: event.provenance,
          hop,
          source: event.source,
          delegation: DelegationId.make(`dlg:${run}`),
          run,
          terms: event.terms,
        })
        .pipe(
          Effect.flatMap((granted) =>
            runs.send(
              run,
              new ActivateRun({
                delegation: granted.delegation,
                accountable: granted.accountable,
                runProvenance: granted.provenance,
                provenance,
              }),
            ),
          ),
          Effect.catchTag("GrantDenied", (denied) =>
            runs.send(run, new RejectRun({ session: event.session, reason: `grant:${denied.reason}`, provenance })),
          ),
          Effect.asVoid,
        );
    });
  }),
);
