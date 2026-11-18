import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/CancelRun.command");

/**
 * Refused: only the person who requested the run, or the one who answers for it, cancels it.
 *
 * @category rejections
 * @since 0.0.0
 */
export class NotRunOwner extends S.TaggedError<NotRunOwner, { readonly brand: unique symbol }>()(
  "NotRunOwner",
  {},
  $I.annote("NotRunOwner", { httpApiStatus: 403, description: "Only the run's requester or accountable human may cancel it." }),
) {}

/**
 * The fact: a person cancelled the run.
 *
 * @category events
 * @since 0.0.0
 */
export class RunCancelled extends Domain.Event("RunCancelled", RunEvent.fields({ reason: S.String })) {}

/**
 * Cancel a run that has not finished.
 *
 * @category commands
 * @since 0.0.0
 */
export class CancelRun extends Domain.Command(
  "CancelRun",
  {
    target: RunId,
    middleware: [Session],
    input: { reason: S.String },
    events: [RunCancelled],
    rejects: [NotRunOwner, RunNotRunning],
  },
  { description: "Cancel a run you requested or answer for." },
) {}
