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
    delegation: null,
    capability: AuthorityGrants.id,
    operations: null,
    resource: ResourceScope.cases.Org.make({ org: acme }),
    expires: null,
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
  operations: null,
  resource: ResourceScope.cases.Org.make({ org: acme }),
  expires: DateTime.makeUnsafe("2026-12-31T00:00:00Z"),
  ...overrides,
});

const grant = Grant.ref("g_1");
const delegation = Delegation.ref("d_1");
const issued = new GrantIssued({ holder: PrincipalId.make("p_rev"), terms: terms(), provenance: provenanceOf(admin) });

it.effect("issuing a grant needs authority.grants on the org", () =>
  story(
    as(reviewer),
    when(grant, new IssueGrant({ holder: PrincipalId.make("p_rev"), terms: terms({ expires: null }) })),
    rejected(new MissingGrant({ capability: AuthorityGrants.id, operation: "IssueGrant" })),
    as(admin),
    when(grant, new IssueGrant({ holder: PrincipalId.make("p_rev"), terms: terms({ expires: null }) })),
    then(grant, new GrantIssued({ holder: PrincipalId.make("p_rev"), terms: terms({ expires: null }), provenance: provenanceOf(admin) })),
  ),
);

it.effect("a delegated grant cannot widen: capability, operations, resource or expiry", () => {
  const narrower = terms({
    operations: ["AcceptClaim"],
    resource: ResourceScope.cases.Record.make({ org: acme, record: "Claim/claim_1" }),
    expires: DateTime.makeUnsafe("2026-07-01T00:00:00Z"),
  });
  const to = (delegated: GrantTerms) =>
    new DelegateGrant({ delegation: DelegationId.make("d_1"), to: run, terms: delegated });
  const opened = extend(
    provenanceOf(reviewer),
    byProcess("OpenOnDelegate", Cause.cases.Event.make({ stream: "Grant/g_1", seq: 2, event: "GrantDelegated" })),
  );
  return story(
    given(grant, issued),
    as(reviewer),
    when(grant, to(terms({ capability: CapabilityId.make("party.intake") }))),
    rejected(new TermsWiden({ dimension: "capability" })),
    when(grant, to(terms({ resource: ResourceScope.cases.Org.make({ org: globex }) }))),
    rejected(new TermsWiden({ dimension: "resource" })),
    when(grant, to(terms({ expires: DateTime.makeUnsafe("2027-01-01T00:00:00Z") }))),
    rejected(new TermsWiden({ dimension: "expires" })),
    when(grant, to(terms({ expires: null }))),
    rejected(new TermsWiden({ dimension: "expires" })),
    when(grant, to(narrower)),
    then(
      grant,
      new GrantDelegated({
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
      new DelegationOpened({
        parent: GrantId.make("g_1"),
        parentDelegation: null,
        holder: run,
        delegator: PrincipalId.make("p_rev"),
        terms: narrower,
        provenance: opened,
      }),
    ),
  );
});

it.effect("only the human holding a grant delegates it", () => {
  const delegate = new DelegateGrant({ delegation: DelegationId.make("d_1"), to: run, terms: terms() });
  return story(
    given(grant, issued),
    as(humanRoot("p_eve")),
    when(grant, delegate),
    rejected(new NotHolder()),
    // An agent acting for the holder re-delegates its own delegation, never the parent grant.
    as(agent),
    when(grant, delegate),
    rejected(new NotHolder()),
  );
});

it.effect("a delegation only narrows, and only its delegator changes it", () => {
  const opened = new DelegationOpened({
    parent: GrantId.make("g_1"),
    parentDelegation: null,
    holder: run,
    delegator: PrincipalId.make("p_rev"),
    terms: terms({ operations: ["AcceptClaim", "RetractClaim"] }),
    provenance: provenanceOf(reviewer),
  });
  const narrower = terms({ operations: ["AcceptClaim"] });
  return story(
    given(delegation, opened),
    as(humanRoot("p_eve")),
    when(delegation, new NarrowDelegation({ terms: narrower })),
    rejected(new NotDelegator()),
    as(reviewer),
    when(delegation, new NarrowDelegation({ terms: terms({ operations: null }) })),
    rejected(new TermsWiden({ dimension: "operations" })),
    when(delegation, new NarrowDelegation({ terms: narrower })),
    then(delegation, new DelegationNarrowed({ holder: run, terms: narrower, provenance: provenanceOf(reviewer) })),
  );
});

it.effect("a grant expires at its deadline, scheduled by the model's own policy", () => {
  const expiring = terms({ expires: DateTime.makeUnsafe("2026-02-01T00:00:00Z") });
  const expiredBy = extend(
    provenanceOf(admin),
    byProcess("ExpireAtDeadline", Cause.cases.Event.make({ stream: "Grant/g_1", seq: 1, event: "GrantIssued" })),
  );
  return story(
    clock("2026-01-01T00:00:00Z"),
    as(admin),
    when(grant, new IssueGrant({ holder: PrincipalId.make("p_rev"), terms: expiring })),
    then(grant, new GrantIssued({ holder: PrincipalId.make("p_rev"), terms: expiring, provenance: provenanceOf(admin) })),
    clock("2026-02-02T00:00:00Z"),
    then(grant, new GrantExpired({ holder: PrincipalId.make("p_rev"), provenance: expiredBy })),
  );
});

it.effect("an admin revokes a grant", () =>
  story(
    given(grant, issued),
    as(admin),
    when(grant, new RevokeGrant()),
    then(grant, new GrantRevoked({ holder: PrincipalId.make("p_rev"), provenance: provenanceOf(admin) })),
  ),
);

it.effect("a human takes and releases accountability; a run's child answers to the same human", () => {
  const accountability = Accountability.ref("run_1");
  const child = Accountability.ref("run_2");
  return story(
    // An agent root names its own accountable human for the run it starts.
    as(agent),
    when(child, new AssignAccountability()),
    then(
      child,
      new AccountabilityAssigned({
        run: RunId.make("run_2"),
        accountable: PrincipalId.make("p_rev"),
        onBehalfOf: PrincipalId.make("p_rev"),
        provenance: provenanceOf(agent),
      }),
    ),
    as(reviewer),
    when(accountability, new AssignAccountability()),
    then(
      accountability,
      new AccountabilityAssigned({
        run,
        accountable: PrincipalId.make("p_rev"),
        onBehalfOf: PrincipalId.make("p_rev"),
        provenance: provenanceOf(reviewer),
      }),
    ),
    as(humanRoot("p_eve")),
    when(accountability, new ReleaseAccountability()),
    rejected(new NotAccountable()),
    as(reviewer),
    when(accountability, new ReleaseAccountability()),
    then(
      accountability,
      new AccountabilityReleased({ run, accountable: PrincipalId.make("p_rev"), provenance: provenanceOf(reviewer) }),
    ),
  );
});

it.effect("a run delegates its delegation further, only narrower, and only as its holder", () => {
  const held = new DelegationOpened({
    parent: GrantId.make("g_1"),
    parentDelegation: null,
    holder: run,
    delegator: PrincipalId.make("p_rev"),
    terms: terms({ operations: ["AcceptClaim", "RetractClaim"] }),
    provenance: provenanceOf(reviewer),
  });
  const narrower = terms({ operations: ["AcceptClaim"] });
  const child = Delegation.ref("d_child");
  const further = (delegated: GrantTerms) =>
    new DelegateFurther({ child: DelegationId.make("d_child"), to: RunId.make("run_2"), terms: delegated });
  return story(
    given(delegation, held),
    // A human, even the delegator, does not hold the delegation: the run does.
    as(reviewer),
    when(delegation, further(narrower)),
    rejected(new NotDelegationHolder()),
    as(agent),
    when(delegation, further(terms({ operations: null }))),
    rejected(new TermsWiden({ dimension: "operations" })),
    when(delegation, further(narrower)),
    then(
      delegation,
      new DelegationExtended({
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
      new DelegationOpened({
        parent: GrantId.make("g_1"),
        parentDelegation: DelegationId.make("d_1"),
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
  const narrower = terms({ operations: ["AcceptClaim"] });
  const other = Grant.ref("g_2");
  return story(
    given(grant, issued),
    as(admin),
    when(grant, new IssueGrant({ holder: PrincipalId.make("p_rev"), terms: terms() })),
    rejected(new GrantAlreadyIssued()),
    as(reviewer),
    when(grant, new NarrowGrant({ terms: narrower })),
    rejected(new MissingGrant({ capability: AuthorityGrants.id, operation: "NarrowGrant" })),
    when(grant, new RevokeGrant()),
    rejected(new MissingGrant({ capability: AuthorityGrants.id, operation: "RevokeGrant" })),
    as(admin),
    when(grant, new NarrowGrant({ terms: terms({ expires: null }) })),
    rejected(new TermsWiden({ dimension: "expires" })),
    when(grant, new NarrowGrant({ terms: narrower })),
    then(grant, new GrantNarrowed({ holder: PrincipalId.make("p_rev"), terms: narrower, provenance: provenanceOf(admin) })),
    // A grant nobody issued, or one revoked, takes nothing more.
    when(other, new RevokeGrant()),
    rejected(new GrantNotActive({ status: "Unissued" })),
    when(other, new NarrowGrant({ terms: narrower })),
    rejected(new GrantNotActive({ status: "Unissued" })),
    as(reviewer),
    when(other, new DelegateGrant({ delegation: DelegationId.make("d_9"), to: run, terms: narrower })),
    rejected(new GrantNotActive({ status: "Unissued" })),
  );
});

it.effect("a delegation opens once; only its delegator revokes it; a revoked or unopened one takes nothing", () => {
  const opened = new DelegationOpened({
    parent: GrantId.make("g_1"),
    parentDelegation: null,
    holder: run,
    delegator: PrincipalId.make("p_rev"),
    terms: terms({ operations: ["AcceptClaim"] }),
    provenance: provenanceOf(reviewer),
  });
  const unopened = Delegation.ref("d_none");
  return story(
    given(delegation, opened),
    when(
      delegation,
      new OpenDelegation({
        parent: GrantId.make("g_1"),
        parentDelegation: null,
        holder: run,
        delegator: PrincipalId.make("p_rev"),
        terms: terms({ operations: ["AcceptClaim"] }),
        provenance: provenanceOf(reviewer),
      }),
    ),
    rejected(new DelegationAlreadyOpen()),
    as(humanRoot("p_eve")),
    when(delegation, new RevokeDelegation()),
    rejected(new NotDelegator()),
    as(reviewer),
    when(delegation, new RevokeDelegation()),
    then(delegation, new DelegationRevoked({ holder: run, provenance: provenanceOf(reviewer) })),
    when(delegation, new RevokeDelegation()),
    rejected(new DelegationNotActive({ status: "Revoked" })),
    when(unopened, new NarrowDelegation({ terms: terms({ operations: ["AcceptClaim"] }) })),
    rejected(new DelegationNotActive({ status: "Unopened" })),
    as(agent),
    when(unopened, new DelegateFurtherCommand({ child: DelegationId.make("d_child"), to: RunId.make("run_9"), terms: terms() })),
    rejected(new DelegationNotActive({ status: "Unopened" })),
  );
});

it.effect("a run's accountability is assigned once", () =>
  story(
    as(reviewer),
    when(Accountability.ref("run_7"), new AssignAccountability()),
    then(
      Accountability.ref("run_7"),
      new AccountabilityAssigned({
        run: RunId.make("run_7"),
        accountable: PrincipalId.make("p_rev"),
        onBehalfOf: PrincipalId.make("p_rev"),
        provenance: provenanceOf(reviewer),
      }),
    ),
    when(Accountability.ref("run_7"), new AssignAccountability()),
    rejected(new AccountabilityAlreadyAssigned()),
  ),
);
