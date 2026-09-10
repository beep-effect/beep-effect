# Instance

- id: `ai-metrics-canonical-root-kind`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/identity-registry.ts:112`
- symbol: `AiMetricsCanonicalRoot`
- members: `excludedFromParentSnapshot`, `kind`, `parentRootId`
- evidence: E3/E1 at `identity-registry.ts:588-614` — root kind determines
  both exclusion and parent-id presence, and the constructor writes both
  canonical arms from the same git-root probe.

# Current shape

The exported schema stores identity/timestamps plus a two-value `kind`, an
independent exclusion boolean, and optional `parentRootId`. It is nested in the
persisted `AiMetricsIdentityRegistry.roots` array at lines 203-217. Registry
reads decode arbitrary on-disk JSON at 745-759; `identityRegistryToJson` encodes
at 782-817; `mergeAndPersistRegistry` preserves/replaces roots and atomically
writes at 839-912. `withFirstSeen` at 762-766 spreads the whole root unchanged
except its timestamp.

# Cardinality gap

The three coarse axes represent eight tuples. Exactly two are legitimate:
`primary-clone` + false + no parent, and `linked-worktree` + true + parent id.
The public constructor writes both (`identity-registry.ts:597-613`) and tests
assert them at `identity-registry.test.ts:98-143`. No writer, fixture, or
reader gives a mixed tuple meaning.

# Target schema

Use the existing `AiMetricsRootKind` LiteralKit as the discriminator for two
schema classes. `AiMetricsPrimaryCloneRoot` carries `kind: S.tag("primary-clone")`
and no parent payload. `AiMetricsLinkedWorktreeRoot` carries
`kind: S.tag("linked-worktree")` and required `parentRootId`. Both share all
identity, revision, and timestamp fields. Combine them with
`S.toTaggedUnion("kind")`.

Keep a private encoded root schema with the current keys/order:
`cloneIdHash`, `excludedFromParentSnapshot`, timestamps, `kind`, optional
`parentRootId`, repository/revision/root/worktree identity. A fallible
`S.decodeTo` transformation accepts only the two legitimate tuples and encodes
the exact inverse boolean/optional field.

# Migration inventory

- `identity-registry.ts:42-128` — reuse `AiMetricsRootKind`, define shared root
  fields and both annotated cases, then install the legacy encoded transform.
- `identity-registry.ts:203-217` — keep the registry `roots` position and JSON
  decoder/encoder while nesting the new root codec.
- `identity-registry.ts:367-417,588-614` — preserve git-root probe outcomes and
  construct the matching case directly.
- `identity-registry.ts:745-766` — retain missing-registry behavior and
  first-seen copying without widening the union.
- `identity-registry.ts:768-912` — migrate readers, sorting, legacy namespace
  checks, merge, and atomic persistence without changing identity semantics.
- `test/identity-registry.test.ts:98-143,259-419,540-575` — retain both roots,
  legacy registry migration, idempotent upsert, round trip, and privacy checks.

# Guard-deletion accounting

Delete `excludedFromParentSnapshot: isLinkedWorktree`, optional-parent spreads,
and downstream code that must correlate kind/boolean/presence. Match on `kind`
when parent data is needed. The compatibility decoder retains the sole mixed
legacy-tuple rejection.

# Encoded-side impact

Tier 2 identity-registry compatibility. Compare old/new canonical
`encode(decode(registry))` for primary and linked roots, preserving every key,
`excludedFromParentSnapshot`, optional omission/presence of `parentRootId`,
revision omission, array order, and JSON property order. Reject the six mixed
tuples because no supported constructor or legacy fixture gives them meaning.
Preserve the existing registry-version and hash-salt defaults/migration.

# Test impact

Add exact old/new root and full-registry byte comparisons for both arms plus
six incoherent decode failures. Retain source-discovery tests, first/last-seen
behavior, root sorting, namespace refusal, legacy registry migration, atomic
write, and path/privacy assertions.

# Risk and sequencing

Land as one Tier 2 registry codec change. The main risk is disturbing old
registry reads or salted identity continuity; preserve read/decode failure
precedence and merge keys exactly. Do not alter git discovery, hashing, root
ids, worktree ids, or namespace migration.
