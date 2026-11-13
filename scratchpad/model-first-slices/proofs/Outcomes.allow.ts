/**
 * Declared command outcomes no story or test executes yet, each with why. `bun run outcomes
 * --check` fails on a gap missing here, and on an entry here that has since been covered.
 */
export const uncoveredOutcomes: ReadonlyArray<{
  readonly aggregate: string;
  readonly command: string;
  readonly outcome: string;
  readonly reason: string;
}> = [
  { aggregate: "Grant", command: "IssueGrant", outcome: "GrantAlreadyIssued", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Grant", command: "NarrowGrant", outcome: "accepted", reason: "no story sends it directly: narrowing and revocation are exercised through DelegateGrant and RevokeGrant" },
  { aggregate: "Grant", command: "NarrowGrant", outcome: "GrantNotActive", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Grant", command: "NarrowGrant", outcome: "TermsWiden", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Grant", command: "NarrowGrant", outcome: "MissingGrant", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Grant", command: "RevokeGrant", outcome: "GrantNotActive", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Grant", command: "RevokeGrant", outcome: "MissingGrant", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Grant", command: "DelegateGrant", outcome: "GrantNotActive", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Delegation", command: "OpenDelegation", outcome: "DelegationAlreadyOpen", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Delegation", command: "NarrowDelegation", outcome: "DelegationNotActive", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Delegation", command: "RevokeDelegation", outcome: "accepted", reason: "no story sends it directly: narrowing and revocation are exercised through DelegateGrant and RevokeGrant" },
  { aggregate: "Delegation", command: "RevokeDelegation", outcome: "DelegationNotActive", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Delegation", command: "RevokeDelegation", outcome: "NotDelegator", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Delegation", command: "DelegateFurther", outcome: "DelegationNotActive", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
  { aggregate: "Accountability", command: "AssignAccountability", outcome: "AccountabilityAlreadyAssigned", reason: "authority refusal paths: the authority stories predate the outcome counter and were not extended in phase 4" },
];
