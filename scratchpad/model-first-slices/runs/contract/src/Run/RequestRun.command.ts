import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { RunEvent } from "./RunEvent.ts";
import { RunVersions } from "./RunVersions.ts";
import { SessionId } from "./Session.id.ts";

/**
 * Refused: a run id is requested once.
 *
 * @category rejections
 * @since 0.0.0
 */
export class RunAlreadyExists extends Domain.Rejection(
  "RunAlreadyExists",
  {},
  { httpApiStatus: 409, description: "This run id is already in use." },
) {}

/**
 * Refused: a person requests a top-level run; a run starts a child with `DelegateRun`.
 *
 * @category rejections
 * @since 0.0.0
 */
export class HumanOnly extends Domain.Rejection(
  "HumanOnly",
  {},
  { httpApiStatus: 403, description: "Only a person requests a top-level run." },
) {}

/**
 * The fact: a person asked for a run, delegating these narrowed terms of a
 * grant they hold, with this budget and history bound (D26).
 *
 * @category events
 * @since 0.0.0
 */
export class RunRequested extends Domain.Event(
  "RunRequested",
  RunEvent.fields({
    purpose: S.String,
    versions: RunVersions,
    allowance: S.Int,
    historyBound: S.Int,
    source: GrantRef,
    terms: GrantTerms,
    requester: PrincipalId,
  }),
) {}

/**
 * Request a run: one bounded piece of work, under a delegation of a grant
 * the requester holds, narrowed to named operations, a resource and an
 * expiry, with a budget.
 *
 * @category commands
 * @since 0.0.0
 */
export class RequestRun extends Domain.Command(
  "RequestRun",
  {
    target: RunId,
    middleware: [Session],
    input: {
      session: SessionId,
      purpose: S.String,
      versions: RunVersions,
      allowance: S.Int,
      historyBound: S.Int,
      source: GrantRef,
      terms: GrantTerms,
    },
    events: [RunRequested],
    rejects: [RunAlreadyExists, HumanOnly],
  },
  { description: "Request an agent run under a narrowed delegation of your grant, with a budget." },
) {}
