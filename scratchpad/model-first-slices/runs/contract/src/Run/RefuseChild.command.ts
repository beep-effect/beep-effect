import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { RunEvent } from "./RunEvent.ts";

/**
 * The fact: the child run was refused; its share returns to the parent, which runs on.
 *
 * @category events
 * @since 0.0.0
 */
export class ChildRunRefused extends Domain.Event(
  "ChildRunRefused",
  RunEvent.fields({ child: RunId, allowance: S.Int, reason: S.String }),
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
  { target: RunId, input: { child: RunId, reason: S.String, provenance: Provenance }, events: [ChildRunRefused] },
  { description: "Record that a run's child was refused, returning its budget share." },
) {}
