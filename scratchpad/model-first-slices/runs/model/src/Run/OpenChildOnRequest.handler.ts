import { RunId } from "@proto/kernel/Ids";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import { OpenChildRun } from "@proto/runs-contract/Run/OpenChildRun.command";
import { RefuseChild } from "@proto/runs-contract/Run/RefuseChild.command";
import * as Effect from "effect/Effect";
import { Authority } from "../Authority.external.ts";
import { AgentRun } from "./AgentRun.aggregate.ts";
import { OpenChildOnRequest } from "./OpenChildOnRequest.policy.ts";

/**
 * Asks the authority context to delegate the parent run's narrowed terms to
 * the child, as the parent run, then opens the child with its budget share;
 * a refusal returns the share to the parent and is recorded there.
 *
 * @category handlers
 * @since 0.0.0
 */
export const OpenChildOnRequestLive = OpenChildOnRequest.toLayer(
  Effect.gen(function* () {
    const runs = yield* AgentRun;
    const authority = yield* Authority;
    return Effect.fn(function* (trigger) {
      const { event } = trigger;
      const parent = RunId.make(trigger.source.id);
      const hop = byProcess(OpenChildOnRequest.policyName, eventCause(trigger));
      const provenance = extend(event.provenance, hop);
      yield* authority
        .grantRun({
          provenance: event.provenance,
          hop,
          source: event.source,
          delegation: event.delegation,
          run: event.child,
          terms: event.terms,
        })
        .pipe(
          Effect.flatMap((granted) =>
            runs.send(
              event.child,
              new OpenChildRun({
                session: event.session,
                parent,
                purpose: event.purpose,
                versions: event.versions,
                allowance: event.allowance,
                historyBound: event.historyBound,
                source: event.source,
                terms: event.terms,
                delegation: granted.delegation,
                accountable: granted.accountable,
                requester: granted.accountable,
                runProvenance: granted.provenance,
                provenance,
              }),
            ),
          ),
          Effect.catchTag("GrantDenied", (denied) =>
            runs.send(parent, new RefuseChild({ child: event.child, reason: `grant:${denied.reason}`, provenance })),
          ),
          Effect.asVoid,
        );
    });
  }),
);
