import { Story } from "@alchemy.run/domain/Story";
import { it } from "@effect/vitest";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { extend, type Invocation, provenanceOf } from "@proto/kernel/Invocation";
import { RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { CancelRun, RunCancelled } from "@proto/runs-contract/Run/CancelRun.command";
import { CompleteRun, RunCompleted } from "@proto/runs-contract/Run/CompleteRun.command";
import { RunRejected } from "@proto/runs-contract/Run/RejectRun.command";
import { RequestRun, RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { NotInSession } from "@proto/runs-contract/Run/SessionRuns.read";
import { Authority, GrantDenied } from "@proto/runs-model/Authority.external";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
import { GrantOnRequest } from "@proto/runs-model/Run/GrantOnRequest.policy";
import { RunState } from "@proto/runs-model/Run/RunState.query";
import { RunsHandlers } from "@proto/runs-model/Runs.handlers";
import { RunsModel } from "@proto/runs-model/Runs.model";
import * as O from "@beep/utils/Option";
import { Cast } from "./Cast.ts";
import { buildersOf, delegationOf, parentTerms, requesterOf, runOf, sourceOf, strangerOf } from "./fixtures.ts";

// The `RunState` query: a run's status, and its outcome once it completed, read by someone who
// takes part in its session. Every story is a property over a generated cast (`Cast.ts`), at the
// default 100 runs.
const { call, fail, given, provide, query, rejected, succeed, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);
const story = Story.make(RunsModel, { layer: RunsHandlers, stub: [Authority] });

/** A run's allowance: one reservation's worth and what stays free beside it. */
const allowanceOf = ({ ledger }: Cast) => ledger.used + ledger.unused + ledger.free;

/** The cast's run, asked for by the requester. */
const requestOf = (cast: Cast) =>
  RequestRun.make({
    session: cast.session,
    purpose: cast.purposes.run,
    versions: cast.versions,
    allowance: allowanceOf(cast),
    historyBound: cast.bound,
    source: sourceOf(cast),
    terms: parentTerms(cast),
  });

it.effect.prop(
  "the requester reads the run as requested, running and completed with its outcome; a stranger is refused at each",
  [Cast],
  ([cast]) => {
    const { asRun, self, hopOn, requested } = buildersOf(cast);
    const { run: id } = cast.runs;
    const run = runOf(cast);
    const { outcome } = cast.words;
    const refusedTo = (invocation: Invocation) => [as(invocation), query(RunState, { run: id }), rejected(NotInSession.make({}))];
    return story(
      as(requesterOf(cast)),
      when(run, requestOf(cast)),
      then(run, requested(allowanceOf(cast))),
      // The grant is not back yet: the run is requested.
      query(RunState, { run: id }, { status: "requested", outcome: O.none() }),
      ...refusedTo(strangerOf(cast)),
      call(Authority.grantRun, { run: id, source: sourceOf(cast), terms: parentTerms(cast), delegation: delegationOf(id) }),
      succeed(Authority.grantRun, { delegation: delegationOf(id), accountable: cast.principals.requester, provenance: self(id) }),
      then(
        run,
        RunActivated.make({
          session: cast.session,
          delegation: delegationOf(id),
          accountable: cast.principals.requester,
          runProvenance: self(id),
          provenance: extend(provenanceOf(requesterOf(cast)), hopOn(GrantOnRequest.policyName, id, 1, RunRequested)),
        }),
      ),
      as(requesterOf(cast)),
      query(RunState, { run: id }, { status: "running", outcome: O.none() }),
      ...refusedTo(strangerOf(cast)),
      // The run itself takes part in its session; a run outside it does not.
      as(asRun(id)),
      query(RunState, { run: id }, { status: "running", outcome: O.none() }),
      ...refusedTo(asRun(cast.runs.stray)),
      as(asRun(id)),
      when(run, CompleteRun.make({ outcome })),
      then(run, RunCompleted.make({ session: cast.session, outcome, released: 0, provenance: self(id) })),
      as(requesterOf(cast)),
      query(RunState, { run: id }, { status: "completed", outcome: O.some(outcome) }),
      ...refusedTo(strangerOf(cast)),
    );
  },
);

it.effect.prop("a refused grant and a withdrawn request read as rejected and cancelled, with no outcome", [Cast], ([cast]) => {
  const { hopOn, requested } = buildersOf(cast);
  const { run: id, peer } = cast.runs;
  const [, reason] = cast.words.reasons;
  return story(
    as(requesterOf(cast)),
    when(runOf(cast), requestOf(cast)),
    then(runOf(cast), requested(allowanceOf(cast))),
    call(Authority.grantRun, { run: id }),
    fail(Authority.grantRun, GrantDenied.make({ reason: cast.words.denial })),
    then(
      runOf(cast),
      RunRejected.make({
        session: cast.session,
        reason: `grant:${cast.words.denial}`,
        released: 0,
        provenance: extend(provenanceOf(requesterOf(cast)), hopOn(GrantOnRequest.policyName, id, 1, RunRequested)),
      }),
    ),
    query(RunState, { run: id }, { status: "rejected", outcome: O.none() }),
    given(AgentRun.ref(peer), requested(allowanceOf(cast))),
    when(AgentRun.ref(peer), CancelRun.make({ reason })),
    then(AgentRun.ref(peer), RunCancelled.make({ session: cast.session, reason, provenance: provenanceOf(requesterOf(cast)) })),
    query(RunState, { run: peer }, { status: "cancelled", outcome: O.none() }),
  );
});

it.effect.prop("a run nobody requested reads as unrequested, to anyone, as a session nobody started reads as empty", [Cast], ([cast]) => {
  const { stray } = cast.runs;
  const unrequested = { status: "unrequested", outcome: O.none() } as const;
  return story(
    as(requesterOf(cast)),
    query(RunState, { run: stray }, unrequested),
    as(strangerOf(cast)),
    query(RunState, { run: stray }, unrequested),
  );
});
