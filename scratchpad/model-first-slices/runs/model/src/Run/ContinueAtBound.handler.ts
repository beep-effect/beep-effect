import { DelegationId, RunId } from "@proto/kernel/Ids";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import { OpenContinuation } from "@proto/runs-contract/Run/OpenContinuation.command";
import { RejectRun } from "@proto/runs-contract/Run/RejectRun.command";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { Authority } from "../Authority.external.ts";
import { AgentRun } from "./AgentRun.aggregate.ts";
import { ContinueAtBound } from "./ContinueAtBound.policy.ts";

/**
 * Asks the authority context to pass the bounded run's delegation on to the
 * run it continues as, as the bounded run, then opens that run with the
 * remaining budget and the open reservations; a refusal is recorded as the
 * new run's rejection.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ContinueAtBoundLive = ContinueAtBound.toLayer(
  Effect.gen(function* () {
    const runs = yield* AgentRun;
    const authority = yield* Authority;
    return Effect.fn(function* (trigger) {
      const { event } = trigger;
      const previous = RunId.make(trigger.source.id);
      const hop = byProcess(ContinueAtBound.policyName, eventCause(trigger));
      const provenance = extend(event.provenance, hop);
      yield* authority
        .grantRun({
          provenance: event.provenance,
          hop,
          source: event.source,
          delegation: DelegationId.make(`dlg:${event.next}`),
          run: event.next,
          terms: event.terms,
        })
        .pipe(
          Effect.flatMap((granted) =>
            runs.send(
              event.next,
              OpenContinuation.make({
                session: event.session,
                previous,
                lineage: event.lineage,
                generation: event.generation,
                parent: event.parent,
                purpose: event.purpose,
                versions: event.versions,
                // What the open reservations hold moves with them.
                allowance: event.remaining + A.reduce(event.reservations, 0, (sum, held) => sum + held.units),
                reservations: event.reservations,
                historyBound: event.historyBound,
                source: event.source,
                terms: event.terms,
                delegation: granted.delegation,
                accountable: granted.accountable,
                requester: event.requester,
                runProvenance: granted.provenance,
                provenance,
              }),
            ),
          ),
          Effect.catchTag("GrantDenied", (denied) =>
            runs.send(event.next, RejectRun.make({ session: event.session, reason: `grant:${denied.reason}`, provenance })),
          ),
          Effect.asVoid,
        );
    });
  }),
);
