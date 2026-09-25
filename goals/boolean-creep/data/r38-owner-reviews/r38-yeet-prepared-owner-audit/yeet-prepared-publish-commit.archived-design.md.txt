# yeet-prepared-publish-commit

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`,2026-09-22.
Private stored Tier1 owner remains designed4/3, pending independent P3.

## Current shape

The private readonly tuple holds a skip boolean and `Option<YeetStashState>`.
Four coarse combinations are representable; three are legal: skipped,
committed without a stash, and committed with a stash. Skip with a stash is
not a valid result of this private successful preparation operation. Unlike
exported raw schemas, this tuple is not an accepted external input domain: its
only writers and consumer are file-local and no decoder/export admits additional
callers. Failures/interruption do not return another tuple state; existing error
and finalizer channels carry them.

## Cardinality gap

The boolean plus Option-presence projection has cardinality four. Its producer
graph admits three states because both skip paths return before stash creation and always
carry None. The successful commit path alone can retain the stash it just created.
YeetStashState95-104 has required createdAt,marker,stashSha full String payloads;
retain empty strings and full values, without new SHA/date/nonempty checks. No
payload field becomes a finite axis or default.

## Target schema

Reuse `Handler.ts`'s `$I`, `effect/Schema`, and the existing schema-owned
`YeetStashState`. Add a two-case tagged schema: `skip` has no payload; `commit`
carries `stash: S.Option(YeetStashState)`. Use a private LiteralKit case domain, named annotated `S.Class` members and
`S.toTaggedUnion("kind")`; annotate the union before deriving helpers so statics
remain. Use the existing YeetStashState runtime schema without copying its fields. The commit Option deliberately represents the two
commit substates without duplicating a presence flag.

Writers return `PreparedPublishCommit.cases.skip.make({})` or
`.cases.commit.make({ stash })`. At `runPublishMode`, match the union directly
for post-phase stash restoration. Derive the existing `skipCommit` boolean once
only where the excluded downstream function-parameter contracts still require
it. Do not split the union back into sibling skip/stash locals.

## Migration inventory

- `Handler.ts:13-40,156` — retain `$I`/Schema, promote the existing
  `YeetStashState` type-only import to a value import, and add only the tagged
  member definitions needed by the private union.
- `Handler.ts:765-820` — replace the tuple and all three return sites. Preserve
  existing-commit logging, message validation, staging, staged-only stash
  creation, extras update, failure restoration, commit execution, and errors.
  Exact order: message validation786, reviewed staging787, optional stash788,
  extras789, portfolio-intent enforcement791, commit phase792 and failure artifacts;
  restorePublishStashOnFailure surrounds that protected commit window. Do not
  move stash creation ahead of reviewed staging or return commit before success.
- `Handler.ts:939-1000` — stop tuple destructuring; keep early/standard publish
  choice, pass the derived skip boolean through existing function parameters,
  and restore a stash only from the commit member's Some payload. Keep reusable
  proof checks then base-freshness enforcement/extras update before preparation
  (953-958). Keep the choice of early/standard tail and the single ensuring
  restoration around the complete tail (992-998), including failure/interruption.
- `Handler.ts:822-936,1336-1356` — retain standalone `skipCommit` parameters
  and exact `publishResult(context, !skipCommit)` behavior; these function
  flags are excluded from the campaign.
- `yeet.test.ts:3650-3680,4124-4229` and publish-flow tests — preserve
  existing-commit, reusable-skip, staged-only stash, failure restore, success
  restore, and conflicting-pop behavior. Current explicit guarded-window tests
  are4230-4285; preserve success leaving stash parked for the outer tail, failure/
  interruption restoration, no-stash no-op, and conflict preserving stash.

## Guard-deletion accounting

Delete the tuple's cross-position invariant, both `[true, None]` writes, the
`[false, stash]` write, tuple destructuring, and the outer `O.match(stash)` that
could be paired with skip. The union match owns restoration eligibility. Keep Option matching within the
commit case because a commit legitimately may have no stash. No filesystem,
stash-identity, conflict-pop or reusable-proof/base-freshness check is deleted.

## Encoded-side impact

None. `PreparedPublishCommit` is private in-process state. Verdict extras,
stash markers and refs, git commands, logs, published result booleans, and
artifact encoding remain unchanged. The private tuple has no codec, defaults or
public barrel/testkit exposure; exported YeetStashState and restoration helpers
remain untouched. Do not infer this private relation for arbitrary public stash
helper inputs or verdict extras.

## Test impact

Cover both skip producers, commit without stash, and staged-only commit with
stash. Prove skip never runs restore, commit-Some restores after both early and
standard tails, commit failure uses the existing guarded restore path, and
`publishResult.createdCommit` remains the inverse of the derived skip flag.
Preserve existingcommit and reusableproof distinct log text even though both map
to skip. Use mocked/scoped command seams for failure and cleanup assertions. Run
focused Yeet publish tests and `bun run beep quality package-verify @beep/repo-cli`
after implementation, then campaign/Yeet gates. This audit only inspected source
and enumerated four tuples; no commit, stash, Yeet job or runtime proof occurred.

## Risk and sequencing

Tier 1 Yeet-local migration. Preserve staged-only ordering: stash only after
reviewed paths are staged, restore on commit failure, and ensure restoration
after the complete post-commit publish tail. Keep the private union local, with
shared Handler changes coordinated serially. Independent replacement P3 remains
pending; no source implementation, corpus completion or dry-round credit.
