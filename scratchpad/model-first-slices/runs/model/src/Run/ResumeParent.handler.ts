import { RunId } from "@proto/kernel/Ids";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import { ChildFinished } from "@proto/runs-contract/Run/ChildFinished.command";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { AgentRun, requestOf, unspent } from "./AgentRun.aggregate.ts";
import { ResumeParent, ResumeParentTrigger } from "./ResumeParent.policy.ts";

/**
 * Reads the finished run; when it has a parent, tells the parent what its
 * lineage did not spend. The event names no parent, so the handler reads the
 * run, whose terminal state no longer changes.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ResumeParentLive = ResumeParent.toLayer(
  Effect.gen(function* () {
    const runs = yield* AgentRun;
    return Effect.fn(function* (trigger) {
      const finished = yield* runs.get(RunId.make(trigger.source.id));
      const run = requestOf(finished);
      const parent = O.flatMap(run, (record) => record.parent);
      if (O.isNone(run) || O.isNone(parent)) return;
      yield* runs.send(
        parent.value,
        ChildFinished.make({
          child: run.value.lineage,
          returned: unspent(run.value.budget),
          outcome: ResumeParentTrigger.matchOrElse(trigger.event, { RunCompleted: ({ outcome }) => outcome }, ({ _tag }) => _tag),
          provenance: extend(trigger.event.provenance, byProcess(ResumeParent.policyName, eventCause(trigger))),
        }),
      );
    });
  }),
);
