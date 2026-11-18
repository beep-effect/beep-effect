import * as Domain from "@alchemy.run/domain";
import { GrantTerms, TermDimension } from "@proto/kernel/Capability";
import { DelegationId, RunId } from "@proto/kernel/Ids";
import { GrantRef } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { Count } from "@proto/kernel/Measure";
import { HistoryBound } from "./HistoryBound.ts";
import { BudgetExceeded } from "./BudgetExceeded.rejection.ts";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { RunVersions } from "./RunVersions.ts";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/DelegateRun.command");

/**
 * Refused: the child's grant would reach further than the parent run's own.
 *
 * @category rejections
 * @since 0.0.0
 */
export class ChildGrantWidens extends S.TaggedError<ChildGrantWidens, { readonly brand: unique symbol }>()(
  "ChildGrantWidens",
  { dimension: TermDimension },
  $I.annote("ChildGrantWidens", { httpApiStatus: 422, description: "A child run's grant can only narrow its parent's." }),
) {}

/**
 * The fact: the run set aside part of its budget for a child run, under
 * narrower terms of its own delegation, and waits for it.
 *
 * @category events
 * @since 0.0.0
 */
export class ChildRequested extends Domain.Event(
  "ChildRequested",
  RunEvent.fields({
    child: RunId,
    delegation: DelegationId,
    purpose: S.String,
    allowance: Count,
    terms: GrantTerms,
    versions: RunVersions,
    historyBound: HistoryBound,
    source: GrantRef,
  }),
  { description: "The run set aside part of its budget for a child run, under narrower terms of its own delegation, and waits for it." },
) {}

/**
 * Start a child run, as the run itself: a share of the budget and a grant
 * that can only narrow this run's.
 *
 * @category commands
 * @since 0.0.0
 */
export class DelegateRun extends Domain.Command(
  "DelegateRun",
  {
    target: RunId,
    middleware: [Session],
    input: { child: RunId, delegation: DelegationId, purpose: S.String, allowance: Count, terms: GrantTerms },
    events: [ChildRequested],
    rejects: [RunNotRunning, NotThisRun, BudgetExceeded, ChildGrantWidens],
  },
  { description: "Start a child run with a share of this run's budget and narrower terms of its grant." },
) {}
