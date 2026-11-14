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
import { Grant } from "@proto/authority-model/Grant/Grant.aggregate";
import { CapabilityGrant, type GrantTerms, ResourceScope } from "@proto/kernel/Capability";
import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { CapabilityId, DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { byProcess, Cause, extend, Invocation, provenanceOf, Root } from "@proto/kernel/Invocation";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";

const { clock, given, provide, rejected, then, when } = Story;
const as = (invocation: Invocation) => provide(CurrentInvocation, invocation);

const story = Story.make(AuthorityModel, { layer: AuthorityHandlers });

// Fixtures build root invocations, as the boundary does in a host.
const acme = OrgId.make("org_acme");
const globex = OrgId.make("org_globex");
const humanRoot = (principal: string, grants: ReadonlyArray<CapabilityGrant> = []) =>
  Invocation.make({
    root: Root.cases.Human.make({ principal: PrincipalId.make(principal) }),
    onBehalfOf: PrincipalId.make(principal),
    grants,
    chain: [],
  });
const admin = humanRoot("p_admin", [
  CapabilityGrant.make({
    grant: GrantId.make("g_admin"),
    delegation: O.none(),
    capability: AuthorityGrants.id,
    operations: O.none(),
    resource: ResourceScope.cases.Org.make({ org: acme }),
    expires: O.none(),
  }),
]);
const reviewer = humanRoot("p_rev");
const run = RunId.make("run_1");
const agent = Invocation.make({
  root: Root.cases.Agent.make({ run, accountable: PrincipalId.make("p_rev") }),
  onBehalfOf: PrincipalId.make("p_rev"),
  grants: [],
  chain: [],
});

const review = CapabilityId.make("party.review");
const terms = (overrides: Partial<GrantTerms> = {}): GrantTerms => ({
  capability: review,
  operations: O.none(),
  resource: ResourceScope.cases.Org.make({ org: acme }),
  expires: O.some(DateTime.makeUnsafe("2026-12-31T00:00:00Z")),
  ...overrides,
});

const grant = Grant.ref("g_1");
const delegation = Delegation.ref("d_1");
const issued = GrantIssued.make({ holder: PrincipalId.make("p_rev"), terms: terms(), provenance: provenanceOf(admin) });

it.effect("issuing a grant needs authority.grants on the org", () =>
  story(
    as(reviewer),
    when(grant, IssueGrant.make({ holder: PrincipalId.make("p_rev"), terms: terms({ expires: O.none() }) })),
    rejected(MissingGrant.make({ capability: AuthorityGrants.id, operation: "IssueGrant" })),
    as(admin),
    when(grant, IssueGrant.make({ holder: PrincipalId.make("p_rev"), terms: terms({ expires: O.none() }) })),
    then(grant, GrantIssued.make({ holder: PrincipalId.make("p_rev"), terms: terms({ expires: O.none() }), provenance: provenanceOf(admin) })),
  ),
);

it.effect("a delegated grant cannot widen: capability, operations, resource or expiry", () => {
  const narrower = terms({
    operations: O.some(["AcceptClaim"]),
    resource: ResourceScope.cases.Record.make({ org: acme, record: "Claim/claim_1" }),
    expires: O.some(DateTime.makeUnsafe("2026-07-01T00:00:00Z")),
  });
  const to = (delegated: GrantTerms) =>
    DelegateGrant.make({ delegation: DelegationId.make("d_1"), to: run, terms: delegated });
  const opened = extend(
    provenanceOf(reviewer),
    byProcess("OpenOnDelegate", Cause.cases.Event.make({ stream: "Grant/g_1", seq: 2, event: "GrantDelegated" })),
  );
  return story(
    given(grant, issued),
    as(reviewer),
    when(grant, to(terms({ capability: CapabilityId.make("party.intake") }))),
    rejected(TermsWiden.make({ dimension: "capability" })),
    when(grant, to(terms({ resource: ResourceScope.cases.Org.make({ org: globex }) }))),
    rejected(TermsWiden.make({ dimension: "resource" })),
    when(grant, to(terms({ expires: O.some(DateTime.makeUnsafe("2027-01-01T00:00:00Z")) }))),
    rejected(TermsWiden.make({ dimension: "expires" })),
    when(grant, to(terms({ expires: O.none() }))),
    rejected(TermsWiden.make({ dimension: "expires" })),
    when(grant, to(narrower)),
    then(
      grant,
      GrantDelegated.make({
        holder: PrincipalId.make("p_rev"),
        delegation: DelegationId.make("d_1"),
        to: run,
        terms: narrower,
        provenance: provenanceOf(reviewer),
      }),
    ),
    // The model's own policy opens the delegation, relaying the holder's invocation.
    then(
      delegation,
      DelegationOpened.make({
        parent: GrantId.make("g_1"),
        parentDelegation: O.none(),
        holder: run,
        delegator: PrincipalId.make("p_rev"),
        terms: narrower,
        provenance: opened,
      }),
    ),
  );
});

it.effect("only the human holding a grant delegates it", () => {
  const delegate = DelegateGrant.make({ delegation: DelegationId.make("d_1"), to: run, terms: terms() });
  return story(
    given(grant, issued),
    as(humanRoot("p_eve")),
    when(grant, delegate),
    rejected(NotHolder.make({})),
    // An agent acting for the holder re-delegates its own delegation, never the parent grant.
    as(agent),
    when(grant, delegate),
    rejected(NotHolder.make({})),
  );
});

it.effect("a delegation only narrows, and only its delegator changes it", () => {
  const opened = DelegationOpened.make({
    parent: GrantId.make("g_1"),
    parentDelegation: O.none(),
    holder: run,
    delegator: PrincipalId.make("p_rev"),
    terms: terms({ operations: O.some(["AcceptClaim", "RetractClaim"]) }),
    provenance: provenanceOf(reviewer),
  });
  const narrower = terms({ operations: O.some(["AcceptClaim"]) });
  return story(
    given(delegation, opened),
    as(humanRoot("p_eve")),
    when(delegation, NarrowDelegation.make({ terms: narrower })),
    rejected(NotDelegator.make({})),
    as(reviewer),
    when(delegation, NarrowDelegation.make({ terms: terms({ operations: O.none() }) })),
    rejected(TermsWiden.make({ dimension: "operations" })),
    when(delegation, NarrowDelegation.make({ terms: narrower })),
    then(delegation, DelegationNarrowed.make({ holder: run, terms: narrower, provenance: provenanceOf(reviewer) })),
  );
});

it.effect("a grant expires at its deadline, scheduled by the model's own policy", () => {
  const expiring = terms({ expires: O.some(DateTime.makeUnsafe("2026-02-01T00:00:00Z")) });
  const expiredBy = extend(
    provenanceOf(admin),
    byProcess("ExpireAtDeadline", Cause.cases.Event.make({ stream: "Grant/g_1", seq: 1, event: "GrantIssued" })),
  );
  return story(
    clock("2026-01-01T00:00:00Z"),
    as(admin),
    when(grant, IssueGrant.make({ holder: PrincipalId.make("p_rev"), terms: expiring })),
    then(grant, GrantIssued.make({ holder: PrincipalId.make("p_rev"), terms: expiring, provenance: provenanceOf(admin) })),
    clock("2026-02-02T00:00:00Z"),
    then(grant, GrantExpired.make({ holder: PrincipalId.make("p_rev"), provenance: expiredBy })),
  );
});

it.effect("an admin revokes a grant", () =>
  story(
    given(grant, issued),
    as(admin),
    when(grant, RevokeGrant.make({})),
    then(grant, GrantRevoked.make({ holder: PrincipalId.make("p_rev"), provenance: provenanceOf(admin) })),
  ),
);

it.effect("a human takes and releases accountability; a run's child answers to the same human", () => {
  const accountability = Accountability.ref("run_1");
  const child = Accountability.ref("run_2");
  return story(
    // An agent root names its own accountable human for the run it starts.
    as(agent),
    when(child, AssignAccountability.make({})),
    then(
      child,
      AccountabilityAssigned.make({
        run: RunId.make("run_2"),
        accountable: PrincipalId.make("p_rev"),
        onBehalfOf: PrincipalId.make("p_rev"),
        provenance: provenanceOf(agent),
      }),
    ),
    as(reviewer),
    when(accountability, AssignAccountability.make({})),
    then(
      accountability,
      AccountabilityAssigned.make({
        run,
        accountable: PrincipalId.make("p_rev"),
        onBehalfOf: PrincipalId.make("p_rev"),
        provenance: provenanceOf(reviewer),
      }),
    ),
    as(humanRoot("p_eve")),
    when(accountability, ReleaseAccountability.make({})),
    rejected(NotAccountable.make({})),
    as(reviewer),
    when(accountability, ReleaseAccountability.make({})),
    then(
      accountability,
      AccountabilityReleased.make({ run, accountable: PrincipalId.make("p_rev"), provenance: provenanceOf(reviewer) }),
    ),
  );
});

it.effect("a run delegates its delegation further, only narrower, and only as its holder", () => {
  const held = DelegationOpened.make({
    parent: GrantId.make("g_1"),
    parentDelegation: O.none(),
    holder: run,
    delegator: PrincipalId.make("p_rev"),
    terms: terms({ operations: O.some(["AcceptClaim", "RetractClaim"]) }),
    provenance: provenanceOf(reviewer),
  });
  const narrower = terms({ operations: O.some(["AcceptClaim"]) });
  const child = Delegation.ref("d_child");
  const further = (delegated: GrantTerms) =>
    DelegateFurther.make({ child: DelegationId.make("d_child"), to: RunId.make("run_2"), terms: delegated });
  return story(
    given(delegation, held),
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
        holder: run,
        grant: GrantId.make("g_1"),
        child: DelegationId.make("d_child"),
        to: RunId.make("run_2"),
        terms: narrower,
        provenance: provenanceOf(agent),
      }),
    ),
    then(
      child,
      DelegationOpened.make({
        parent: GrantId.make("g_1"),
        parentDelegation: O.some(DelegationId.make("d_1")),
        holder: RunId.make("run_2"),
        delegator: PrincipalId.make("p_rev"),
        terms: narrower,
        provenance: extend(
          provenanceOf(agent),
          byProcess("OpenOnDelegate", Cause.cases.Event.make({ stream: "Delegation/d_1", seq: 2, event: "DelegationExtended" })),
        ),
      }),
    ),
  );
});

// The refusal paths `bun run outcomes` found unexecuted, each met by the caller it is meant for.
it.effect("a grant is issued once, narrowed only by an admin and only narrower, and refused once inactive", () => {
  const narrower = terms({ operations: O.some(["AcceptClaim"]) });
  const other = Grant.ref("g_2");
  return story(
    given(grant, issued),
    as(admin),
    when(grant, IssueGrant.make({ holder: PrincipalId.make("p_rev"), terms: terms() })),
    rejected(GrantAlreadyIssued.make({})),
    as(reviewer),
    when(grant, NarrowGrant.make({ terms: narrower })),
    rejected(MissingGrant.make({ capability: AuthorityGrants.id, operation: "NarrowGrant" })),
    when(grant, RevokeGrant.make({})),
    rejected(MissingGrant.make({ capability: AuthorityGrants.id, operation: "RevokeGrant" })),
    as(admin),
    when(grant, NarrowGrant.make({ terms: terms({ expires: O.none() }) })),
    rejected(TermsWiden.make({ dimension: "expires" })),
    when(grant, NarrowGrant.make({ terms: narrower })),
    then(grant, GrantNarrowed.make({ holder: PrincipalId.make("p_rev"), terms: narrower, provenance: provenanceOf(admin) })),
    // A grant nobody issued, or one revoked, takes nothing more.
    when(other, RevokeGrant.make({})),
    rejected(GrantNotActive.make({ status: "Unissued" })),
    when(other, NarrowGrant.make({ terms: narrower })),
    rejected(GrantNotActive.make({ status: "Unissued" })),
    as(reviewer),
    when(other, DelegateGrant.make({ delegation: DelegationId.make("d_9"), to: run, terms: narrower })),
    rejected(GrantNotActive.make({ status: "Unissued" })),
  );
});

it.effect("a delegation opens once; only its delegator revokes it; a revoked or unopened one takes nothing", () => {
  const opened = DelegationOpened.make({
    parent: GrantId.make("g_1"),
    parentDelegation: O.none(),
    holder: run,
    delegator: PrincipalId.make("p_rev"),
    terms: terms({ operations: O.some(["AcceptClaim"]) }),
    provenance: provenanceOf(reviewer),
  });
  const unopened = Delegation.ref("d_none");
  return story(
    given(delegation, opened),
    when(
      delegation,
      OpenDelegation.make({
        parent: GrantId.make("g_1"),
        parentDelegation: O.none(),
        holder: run,
        delegator: PrincipalId.make("p_rev"),
        terms: terms({ operations: O.some(["AcceptClaim"]) }),
        provenance: provenanceOf(reviewer),
      }),
    ),
    rejected(DelegationAlreadyOpen.make({})),
    as(humanRoot("p_eve")),
    when(delegation, RevokeDelegation.make({})),
    rejected(NotDelegator.make({})),
    as(reviewer),
    when(delegation, RevokeDelegation.make({})),
    then(delegation, DelegationRevoked.make({ holder: run, provenance: provenanceOf(reviewer) })),
    when(delegation, RevokeDelegation.make({})),
    rejected(DelegationNotActive.make({ status: "Revoked" })),
    when(unopened, NarrowDelegation.make({ terms: terms({ operations: O.some(["AcceptClaim"]) }) })),
    rejected(DelegationNotActive.make({ status: "Unopened" })),
    as(agent),
    when(unopened, DelegateFurtherCommand.make({ child: DelegationId.make("d_child"), to: RunId.make("run_9"), terms: terms() })),
    rejected(DelegationNotActive.make({ status: "Unopened" })),
  );
});

it.effect("a run's accountability is assigned once", () =>
  story(
    as(reviewer),
    when(Accountability.ref("run_7"), AssignAccountability.make({})),
    then(
      Accountability.ref("run_7"),
      AccountabilityAssigned.make({
        run: RunId.make("run_7"),
        accountable: PrincipalId.make("p_rev"),
        onBehalfOf: PrincipalId.make("p_rev"),
        provenance: provenanceOf(reviewer),
      }),
    ),
    when(Accountability.ref("run_7"), AssignAccountability.make({})),
    rejected(AccountabilityAlreadyAssigned.make({})),
  ),
);
