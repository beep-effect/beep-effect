# Instance

- id: `yeet-prepared-publish-commit`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:760`
- symbol: `PreparedPublishCommit`
- members: `skipCommit`, presence of `stash`
- evidence: E1/E4 at `Handler.ts:775-792,805-810` — both skip writers return
  no stash; the commit writer may return a staged-only stash.

Audited at checkout `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
against main corpus `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
Replacement P3 review remains pending.

# Current shape and cardinality

The private readonly tuple holds a skip boolean and `Option<YeetStashState>`.
Four coarse combinations are representable; three are legal: skipped,
committed without a stash, and committed with a stash. Skip with a stash is
never written.

# Cardinality gap

The boolean plus Option-presence projection has cardinality four. Its producer
graph admits three states because both skip paths always carry None.

# Target schema

Reuse `Handler.ts`'s `$I`, `effect/Schema`, and the existing schema-owned
`YeetStashState`. Add a two-case tagged schema: `skip` has no payload; `commit`
carries `stash: S.Option(YeetStashState)`. Use named `S.Class` members and
`S.toTaggedUnion("kind")`. The commit Option deliberately represents the two
commit substates without duplicating a presence flag.

Writers return `PreparedPublishCommit.cases.skip.make({})` or
`.cases.commit.make({ stash })`. At `runPublishMode`, match the union directly
for post-phase stash restoration. Derive the existing `skipCommit` boolean once
only where the excluded downstream function-parameter contracts still require
it. Do not split the union back into sibling skip/stash locals.

# Migration inventory

- `Handler.ts:13-40,149-160` — retain `$I`/Schema, promote the existing
  `YeetStashState` type-only import to a value import, and add only the tagged
  member definitions needed by the private union.
- `Handler.ts:760-813` — replace the tuple and all three return sites. Preserve
  existing-commit logging, message validation, staging, staged-only stash
  creation, extras update, failure restoration, commit execution, and errors.
- `Handler.ts:932-993` — stop tuple destructuring; keep early/standard publish
  choice, pass the derived skip boolean through existing function parameters,
  and restore a stash only from the commit member's Some payload.
- `Handler.ts:816-929,1199-1219` — retain standalone `skipCommit` parameters
  and exact `publishResult(context, !skipCommit)` behavior; these function
  flags are excluded from the campaign.
- `yeet.test.ts:3650-3680,4124-4229` and publish-flow tests — preserve
  existing-commit, reusable-skip, staged-only stash, failure restore, success
  restore, and conflicting-pop behavior.

# Guard-deletion accounting

Delete the tuple's cross-position invariant, both `[true, None]` writes, the
`[false, stash]` write, tuple destructuring, and the outer `O.match(stash)` that
could be paired with skip. The union match owns restoration eligibility.

# Encoded-side impact

None. `PreparedPublishCommit` is private in-process state. Verdict extras,
stash markers and refs, git commands, logs, published result booleans, and
artifact encoding remain unchanged.

# Test impact

Cover both skip producers, commit without stash, and staged-only commit with
stash. Prove skip never runs restore, commit-Some restores after both early and
standard tails, commit failure uses the existing guarded restore path, and
`publishResult.createdCommit` remains the inverse of the derived skip flag.

# Risk and sequencing

Tier 1 Yeet-local migration. Preserve staged-only ordering: stash only after
reviewed paths are staged, restore on commit failure, and ensure restoration
after the complete post-commit publish tail.
