import { Story } from "@alchemy.run/domain/Story";
import { AccountabilityAlreadyAssigned } from "@proto/authority-contract/Accountability/AssignAccountability.command";
import { DelegateFurther as DelegateFurtherCommand } from "@proto/authority-contract/Delegation/DelegateFurther.command";
import { DelegationNotActive } from "@proto/authority-contract/Delegation/DelegationNotActive.rejection";
import { DelegationAlreadyOpen, OpenDelegation } from "@proto/authority-contract/Delegation/OpenDelegation.command";
import { DelegationRevoked, RevokeDelegation } from "@proto/authority-contract/Delegation/RevokeDelegation.command";
import { GrantNotActive } from "@proto/authority-contract/Grant/GrantNotActive.rejection";
import { GrantAlreadyIssued } from "@proto/authority-contract/Grant/IssueGrant.command";
import { GrantNarrowed, NarrowGrant } from "@proto/authority-contract/Grant/NarrowGrant.command";
import { it } from "@effect/vitest";
import {
  AccountabilityAssigned,
  AssignAccountability,
} from "@proto/authority-contract/Accountability/AssignAccountability.command";
import {
  AccountabilityReleased,
  NotAccountable,
  ReleaseAccountability,
} from "@proto/authority-contract/Accountability/ReleaseAccountability.command";
import { AuthorityGrants } from "@proto/authority-contract/Authority.capabilities";
import {
  DelegateFurther,
  DelegationExtended,
  NotDelegationHolder,
} from "@proto/authority-contract/Delegation/DelegateFurther.command";
import { DelegationNarrowed, NarrowDelegation } from "@proto/authority-contract/Delegation/NarrowDelegation.command";
import { NotDelegator } from "@proto/authority-contract/Delegation/NotDelegator.rejection";
import { DelegationOpened } from "@proto/authority-contract/Delegation/OpenDelegation.command";
import { DelegateGrant, GrantDelegated, NotHolder } from "@proto/authority-contract/Grant/DelegateGrant.command";
import { GrantExpired } from "@proto/authority-contract/Grant/ExpireGrant.command";
import { GrantIssued, IssueGrant } from "@proto/authority-contract/Grant/IssueGrant.command";
import { GrantRevoked, RevokeGrant } from "@proto/authority-contract/Grant/RevokeGrant.command";
import { TermsWiden } from "@proto/authority-contract/TermsWiden.rejection";
import { Accountability } from "@proto/authority-model/Accountability/Accountability.aggregate";
import { AuthorityHandlers } from "@proto/authority-model/Authority.handlers";
import { AuthorityModel } from "@proto/authority-model/Authority.model";
import { Delegation } from "@proto/authority-model/Delegation/Delegation.aggregate";
import { OpenOnDelegate } from "@proto/authority-model/Delegation/OpenOnDelegate.policy";
import { ExpireAtDeadline } from "@proto/authority-model/Grant/ExpireAtDeadline.policy";
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { CapabilityGrant, type GrantTerms, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { DelegationId, type PrincipalId } from "@proto/kernel/Ids";
import { byProcess, Cause, extend, Invocation, provenanceOf, Root } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import * as O from "@beep/utils/Option";
import { Cast, instants, recordOf, streamOf } from "./Cast.ts";

const { clock, given, provide, rejected, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(AuthorityModel, { layer: AuthorityHandlers });

/**
 * The cast in its roles. Root invocations are built as the boundary does in a host: the admin
 * holds `authority.grants` on the home org; the reviewer and the stranger hold nothing directly;
 * the agent is the cast's run, answered for by the reviewer. The default terms are a grant of the
 * cast's capability on the home org until the deadline.
 */
const rolesOf = (cast: Cast) => {
  const { orgs, principals, runs, grants, delegations, capabilities } = cast;
  const at = instants(cast);
  const humanRoot = (principal: PrincipalId, held: ReadonlyArray<CapabilityGrant> = []) =>
    Invocation.make({ root: Root.cases.Human.make({ principal }), onBehalfOf: principal, grants: held, chain: [] });
  const home = ResourceScope.cases.Org.make({ org: orgs.home });
  const terms = (overrides: Partial<GrantTerms> = {}): GrantTerms => ({
    capability: capabilities.granted,
    operations: O.none(),
    resource: home,
    expires: O.some(at.deadline),
    ...overrides,
  });
  const admin = humanRoot(principals.admin, [
    CapabilityGrant.make({
      grant: grants.admin,
      delegation: O.none(),
      capability: AuthorityGrants.id,
      operations: O.none(),
      resource: home,
      expires: O.none(),
    }),
  ]);
  const reviewer = humanRoot(principals.reviewer);
  const agent = Invocation.make({
    root: Root.cases.Agent.make({ run: runs.run, accountable: principals.reviewer }),
    onBehalfOf: principals.reviewer,
    grants: [],
    chain: [],
  });
  const grant = Grant.ref(grants.held);
  return {
    at,
    admin,
    reviewer,
    stranger: humanRoot(principals.stranger),
    agent,
    terms,
    grant,
    delegation: Delegation.ref(delegations.held),
    issued: GrantIssued.make({ holder: principals.reviewer, terms: terms(), provenance: provenanceOf(admin) }),
    /** Both of the cast's operations, then only the kept one. */
    both: O.some([cast.operations.kept, cast.operations.dropped]),
    kept: O.some([cast.operations.kept]),
    /** The run's held delegation of the held grant, opened at the reviewer's request. */
    opened: (delegated: GrantTerms) =>
      DelegationOpened.make({
        parent: grants.held,
        parentDelegation: O.none(),
        holder: runs.run,
        delegator: principals.reviewer,
        terms: delegated,
        provenance: provenanceOf(reviewer),
      }),
  };
};

// Each story starts its clock at the cast's start, so every expiry in the cast lies ahead of it.
const startAt = (cast: Cast) => clock(instants(cast).start);

it.effect.prop("issuing a grant needs authority.grants on the org", [Cast], ([cast]) => {
  const { admin, reviewer, terms, grant } = rolesOf(cast);
  const holder = cast.principals.reviewer;
  return story(
    startAt(cast),
    as(reviewer),
    when(grant, IssueGrant.make({ holder, terms: terms({ expires: O.none() }) })),
    rejected(MissingGrant.make({ capability: AuthorityGrants.id, operation: IssueGrant.tag })),
    as(admin),
    when(grant, IssueGrant.make({ holder, terms: terms({ expires: O.none() }) })),
    then(grant, GrantIssued.make({ holder, terms: terms({ expires: O.none() }), provenance: provenanceOf(admin) })),
  );
});

it.effect.prop("a delegated grant cannot widen: capability, operations, resource or expiry", [Cast], ([cast]) => {
  const { at, reviewer, terms, grant, delegation, issued, kept, opened: openedOn } = rolesOf(cast);
  const narrower = terms({
    operations: kept,
    resource: ResourceScope.cases.Record.make({ org: cast.orgs.home, record: recordOf(cast) }),
    expires: O.some(at.early),
  });
  const to = (delegated: GrantTerms) =>
    DelegateGrant.make({ delegation: cast.delegations.held, to: cast.runs.run, terms: delegated });
  // The delegation is the grant's second event, after its issue.
  const opened = extend(
    provenanceOf(reviewer),
    byProcess(OpenOnDelegate.policyName, Cause.cases.Event.make({ stream: streamOf(grant), seq: 2, event: GrantDelegated.tag })),
  );
  return story(
    startAt(cast),
    given(grant, issued),
    as(reviewer),
    when(grant, to(terms({ capability: cast.capabilities.swapped }))),
    rejected(TermsWiden.make({ dimension: "capability" })),
    when(grant, to(terms({ resource: ResourceScope.cases.Org.make({ org: cast.orgs.other }) }))),
    rejected(TermsWiden.make({ dimension: "resource" })),
    when(grant, to(terms({ expires: O.some(at.beyond) }))),
    rejected(TermsWiden.make({ dimension: "expires" })),
    when(grant, to(terms({ expires: O.none() }))),
    rejected(TermsWiden.make({ dimension: "expires" })),
    when(grant, to(narrower)),
    then(
      grant,
      GrantDelegated.make({
        holder: cast.principals.reviewer,
        delegation: cast.delegations.held,
        to: cast.runs.run,
        terms: narrower,
        provenance: provenanceOf(reviewer),
      }),
    ),
    // The model's own policy opens the delegation, relaying the holder's invocation.
    then(delegation, DelegationOpened.make({ ...openedOn(narrower), provenance: opened })),
  );
});

it.effect.prop("only the human holding a grant delegates it", [Cast], ([cast]) => {
  const { stranger, agent, terms, grant, issued } = rolesOf(cast);
  const delegate = DelegateGrant.make({ delegation: cast.delegations.held, to: cast.runs.run, terms: terms() });
  return story(
    startAt(cast),
    given(grant, issued),
    as(stranger),
    when(grant, delegate),
    rejected(NotHolder.make({})),
    // An agent acting for the holder re-delegates its own delegation, never the parent grant.
    as(agent),
    when(grant, delegate),
    rejected(NotHolder.make({})),
  );
});

it.effect.prop("a delegation only narrows, and only its delegator changes it", [Cast], ([cast]) => {
  const { reviewer, stranger, terms, delegation, both, kept, opened } = rolesOf(cast);
  const narrower = terms({ operations: kept });
  return story(
    startAt(cast),
    given(delegation, opened(terms({ operations: both }))),
    as(stranger),
    when(delegation, NarrowDelegation.make({ terms: narrower })),
    rejected(NotDelegator.make({})),
    as(reviewer),
    when(delegation, NarrowDelegation.make({ terms: terms({ operations: O.none() }) })),
    rejected(TermsWiden.make({ dimension: "operations" })),
    when(delegation, NarrowDelegation.make({ terms: narrower })),
    then(delegation, DelegationNarrowed.make({ holder: cast.runs.run, terms: narrower, provenance: provenanceOf(reviewer) })),
  );
});

it.effect.prop("a grant expires at its deadline, scheduled by the model's own policy", [Cast], ([cast]) => {
  const { at, admin, terms, grant } = rolesOf(cast);
  const holder = cast.principals.reviewer;
  const expiring = terms({ expires: O.some(at.early) });
  // The issue is the grant's first event.
  const expiredBy = extend(
    provenanceOf(admin),
    byProcess(ExpireAtDeadline.policyName, Cause.cases.Event.make({ stream: streamOf(grant), seq: 1, event: GrantIssued.tag })),
  );
  return story(
    startAt(cast),
    as(admin),
    when(grant, IssueGrant.make({ holder, terms: expiring })),
    then(grant, GrantIssued.make({ holder, terms: expiring, provenance: provenanceOf(admin) })),
    clock(at.deadline),
    then(grant, GrantExpired.make({ holder, provenance: expiredBy })),
  );
});

it.effect.prop("an admin revokes a grant", [Cast], ([cast]) => {
  const { admin, grant, issued } = rolesOf(cast);
  return story(
    startAt(cast),
    given(grant, issued),
    as(admin),
    when(grant, RevokeGrant.make({})),
    then(grant, GrantRevoked.make({ holder: cast.principals.reviewer, provenance: provenanceOf(admin) })),
  );
});

it.effect.prop("a human takes and releases accountability; a run's child answers to the same human", [Cast], ([cast]) => {
  const { reviewer, stranger, agent } = rolesOf(cast);
  const { run, child: childRun } = cast.runs;
  const human = cast.principals.reviewer;
  const accountability = Accountability.ref(run);
  const child = Accountability.ref(childRun);
  return story(
    startAt(cast),
    // An agent root names its own accountable human for the run it starts.
    as(agent),
    when(child, AssignAccountability.make({})),
    then(
      child,
      AccountabilityAssigned.make({ run: childRun, accountable: human, onBehalfOf: human, provenance: provenanceOf(agent) }),
    ),
    as(reviewer),
    when(accountability, AssignAccountability.make({})),
    then(
      accountability,
      AccountabilityAssigned.make({ run, accountable: human, onBehalfOf: human, provenance: provenanceOf(reviewer) }),
    ),
    as(stranger),
    when(accountability, ReleaseAccountability.make({})),
    rejected(NotAccountable.make({})),
    as(reviewer),
    when(accountability, ReleaseAccountability.make({})),
    then(accountability, AccountabilityReleased.make({ run, accountable: human, provenance: provenanceOf(reviewer) })),
  );
});

it.effect.prop("a run delegates its delegation further, only narrower, and only as its holder", [Cast], ([cast]) => {
  const { reviewer, agent, terms, delegation, both, kept, opened } = rolesOf(cast);
  const narrower = terms({ operations: kept });
  const child = Delegation.ref(cast.delegations.child);
  const further = (delegated: GrantTerms) =>
    DelegateFurther.make({ child: cast.delegations.child, to: cast.runs.child, terms: delegated });
  return story(
    startAt(cast),
    given(delegation, opened(terms({ operations: both }))),
    // A human, even the delegator, does not hold the delegation: the run does.
    as(reviewer),
    when(delegation, further(narrower)),
    rejected(NotDelegationHolder.make({})),
    as(agent),
    when(delegation, further(terms({ operations: O.none() }))),
    rejected(TermsWiden.make({ dimension: "operations" })),
    when(delegation, further(narrower)),
    then(
      delegation,
      DelegationExtended.make({
        holder: cast.runs.run,
        grant: cast.grants.held,
        child: cast.delegations.child,
        to: cast.runs.child,
        terms: narrower,
        provenance: provenanceOf(agent),
      }),
    ),
    // The extension is the delegation's second event, after its opening.
    then(
      child,
      DelegationOpened.make({
        parent: cast.grants.held,
        parentDelegation: DelegationId.makeOption(cast.delegations.held),
        holder: cast.runs.child,
        delegator: cast.principals.reviewer,
        terms: narrower,
        provenance: extend(
          provenanceOf(agent),
          byProcess(
            OpenOnDelegate.policyName,
            Cause.cases.Event.make({ stream: streamOf(delegation), seq: 2, event: DelegationExtended.tag }),
          ),
        ),
      }),
    ),
  );
});

// The refusal paths `bun run outcomes` found unexecuted, each met by the caller it is meant for.
it.effect.prop("a grant is issued once, narrowed only by an admin and only narrower, and refused once inactive", [Cast], ([cast]) => {
  const { admin, reviewer, terms, grant, issued, kept } = rolesOf(cast);
  const narrower = terms({ operations: kept });
  const other = Grant.ref(cast.grants.unissued);
  return story(
    startAt(cast),
    given(grant, issued),
    as(admin),
    when(grant, IssueGrant.make({ holder: cast.principals.reviewer, terms: terms() })),
    rejected(GrantAlreadyIssued.make({})),
    as(reviewer),
    when(grant, NarrowGrant.make({ terms: narrower })),
    rejected(MissingGrant.make({ capability: AuthorityGrants.id, operation: NarrowGrant.tag })),
    when(grant, RevokeGrant.make({})),
    rejected(MissingGrant.make({ capability: AuthorityGrants.id, operation: RevokeGrant.tag })),
    as(admin),
    when(grant, NarrowGrant.make({ terms: terms({ expires: O.none() }) })),
    rejected(TermsWiden.make({ dimension: "expires" })),
    when(grant, NarrowGrant.make({ terms: narrower })),
    then(grant, GrantNarrowed.make({ holder: cast.principals.reviewer, terms: narrower, provenance: provenanceOf(admin) })),
    // A grant nobody issued, or one revoked, takes nothing more.
    when(other, RevokeGrant.make({})),
    rejected(GrantNotActive.make({ status: "Unissued" })),
    when(other, NarrowGrant.make({ terms: narrower })),
    rejected(GrantNotActive.make({ status: "Unissued" })),
    as(reviewer),
    when(other, DelegateGrant.make({ delegation: cast.delegations.stray, to: cast.runs.run, terms: narrower })),
    rejected(GrantNotActive.make({ status: "Unissued" })),
  );
});

it.effect.prop("a delegation opens once; only its delegator revokes it; a revoked or unopened one takes nothing", [Cast], ([cast]) => {
  const { reviewer, stranger, agent, terms, delegation, kept, opened } = rolesOf(cast);
  const unopened = Delegation.ref(cast.delegations.unopened);
  const once = opened(terms({ operations: kept }));
  return story(
    startAt(cast),
    given(delegation, once),
    when(
      delegation,
      OpenDelegation.make({
        parent: once.parent,
        parentDelegation: once.parentDelegation,
        holder: once.holder,
        delegator: once.delegator,
        terms: once.terms,
        provenance: once.provenance,
      }),
    ),
    rejected(DelegationAlreadyOpen.make({})),
    as(stranger),
    when(delegation, RevokeDelegation.make({})),
    rejected(NotDelegator.make({})),
    as(reviewer),
    when(delegation, RevokeDelegation.make({})),
    then(delegation, DelegationRevoked.make({ holder: cast.runs.run, provenance: provenanceOf(reviewer) })),
    when(delegation, RevokeDelegation.make({})),
    rejected(DelegationNotActive.make({ status: "Revoked" })),
    when(unopened, NarrowDelegation.make({ terms: terms({ operations: kept }) })),
    rejected(DelegationNotActive.make({ status: "Unopened" })),
    as(agent),
    when(unopened, DelegateFurtherCommand.make({ child: cast.delegations.child, to: cast.runs.stray, terms: terms() })),
    rejected(DelegationNotActive.make({ status: "Unopened" })),
  );
});

it.effect.prop("a run's accountability is assigned once", [Cast], ([cast]) => {
  const { reviewer } = rolesOf(cast);
  const human = cast.principals.reviewer;
  const accountability = Accountability.ref(cast.runs.stray);
  return story(
    startAt(cast),
    as(reviewer),
    when(accountability, AssignAccountability.make({})),
    then(
      accountability,
      AccountabilityAssigned.make({ run: cast.runs.stray, accountable: human, onBehalfOf: human, provenance: provenanceOf(reviewer) }),
    ),
    when(accountability, AssignAccountability.make({})),
    rejected(AccountabilityAlreadyAssigned.make({})),
  );
});
