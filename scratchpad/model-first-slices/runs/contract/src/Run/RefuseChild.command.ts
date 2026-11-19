import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import { Count, IdText } from "@proto/kernel/Measure";
import { RunEvent } from "./RunEvent.ts";

/**
 * The fact: the child run was refused; its share returns to the parent, which runs on.
 * `reason` is a refusal code, not prose: `grant:` and why the authority
 * context refused the child's grant.
 *
 * @category events
 * @since 0.0.0
 */
export class ChildRunRefused extends Domain.Event(
  "ChildRunRefused",
  RunEvent.fields({ child: RunId, allowance: Count, reason: IdText }),
  { description: "The child run was refused. Its share returns to the parent, which continues." },
) {}

/**
 * Record on the parent that its child was refused. Sent only by the runs
 * model's own policy; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class RefuseChild extends Domain.Command(
  "RefuseChild",
  { target: RunId, input: { child: RunId, reason: IdText, provenance: Provenance }, events: [ChildRunRefused] },
  { description: "Record that a run's child was refused, returning its budget share." },
) {}
