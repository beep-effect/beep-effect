# r30-cli-yeet-portfolio-index-staged-deletion

Current-source P2 refresh at `f97a89bdfdc5bc71b69aab09b8d425591698d42a`.
E4, derived/internal, Tier 1. Selected pair remains 4/3; full Boolean carrier
with independent present is 8/6. R32 production-only 8/3 expansion is rejected.
No source implementation, independent P3 or census dry credit. Paths below
are relative to packages/tooling/tool/cli unless otherwise qualified.

## Current shape

The qualifying owner is the complete concrete object passed to
`portfolioIndexPublishDisposition` within `enforcePortfolioIndexPublishIntent`
at `src/commands/Yeet/internal/PortfolioIndexGuard.ts:233-239`. Use the inventory
symbol `enforcePortfolioIndexPublishIntent.portfolioIndexPublishDisposition argument`
and `kind: object-literal`, with its object opening at line 233. The raw R30
locator at :141 names an excluded function-parameter declaration and must not
be admitted as written.

The object has five actual own members: `committed: Option<string>`,
`present: boolean` from the portfolio-existence observation, `regenerated: string`,
`staged: boolean` from intent path membership, and `stagedDeletion: boolean`
from membership in the deletion-query output. The two selected members
`staged` and `stagedDeletion` are real Boolean values, so they satisfy the net
without virtual payload predicates or a function-parameter owner. `present`
is already true on this production path after the early return at :209-212;
it remains an independent Boolean in the complete consumer carrier because
supported direct calls include an absent portfolio plus staged change.

The actual writer :221-238 uses the reviewed intent to decide whether to run
`git diff --cached --diff-filter=D --name-only -z -- goals/INDEX.md`. The unstaged
branch supplies an empty deletion list, so deletion cannot be selected there.
`runGitPathList` propagates a `YeetCommandError` rather than inventing a failed
probe result (`GitExec.ts:87-92`). There is no partial successful carrier emitted
when this query fails. Source module documentation :4-10 and pure helper
contract :108-111 describe three staging cases: unstaged, staged addition or
modification, and staged deletion. The deletion case is an exception within
the staged intent, not an independently observed ancestry-style partial fact.

The pure reader is :137-148. Its public test route is
`src/test/Yeet.test-kit.ts:52`, exposed by the existing test export pattern at
`package.json:68-70`. Its sole production object construction is :233-239;
its other direct calls are the documentation example :119-125 and the seven
fixtures at `test/yeet-portfolio-index-guard.test.ts:142,155,164,178,181,184,197`.
Tests are support for the declared contract, not sweep sources.

## Cardinality gap

The selected pair has four representable tuples and three legal staging
meanings. This is a minimal cluster, not a claim that every member of the
complete carrier belongs to one state variable.

| staged | stagedDeletion | Meaning and source support |
| --- | --- | --- |
| false | false | Unstaged. Writer :220-231; current/stale/missing fixtures :153-159,176,182-188. |
| true | false | Staged addition or modification. Writer :222-238; refusal fixtures :162-168,179 and documentation :119-125. |
| true | true | Staged deletion. Same writer and source exception :9-10; direct fixture :195-201 and Git-backed integration :361-381. |
| false | true | Excluded by the staged-intent deletion contract and its production construction at :222-238. No supported direct constructor or alternate writer establishes this as a legitimate independent diagnostic fact. |

E4 is the implication `stagedDeletion => staged`, evidenced by :222-238 and
the contract :108-111. The complete supported consumer domain retains
`present=false` with a staged change (`test:140-149`), all `Option<string>`
values for committed content, and all strings for regenerated content. There
is no claim that presence implies or is implied by any staging case. No
whole-owner Boolean product is used to inflate the count. The production
path's true `present` value does not authorize removing the independent
consumer field or the early absence diagnostic.

## Target schema

Keep the finite staging domain in this existing internal module. Reuse the
already imported `LiteralKit` and existing `$I`; add `effect/Schema` as `S`.
The new schema is `PortfolioIndexStaging`, with a same-name schema-derived
Type alias, annotated through `$I.annoteSchema(...)`:

```ts
export const PortfolioIndexStaging = LiteralKit([
  "unstaged",
  "staged-change",
  "staged-deletion",
]).pipe(
  $I.annoteSchema("PortfolioIndexStaging", {
    description: "How the reviewed publish intent stages the derived goals index.",
  })
);
export type PortfolioIndexStaging = typeof PortfolioIndexStaging.Type;
```

Use one annotated `S.Class` named `PortfolioIndexPublishObservation` to own the
whole decoded carrier. Its required fields are exactly:

```ts
{
  committed: S.Option(S.String),
  present: S.Boolean,
  regenerated: S.String,
  staging: PortfolioIndexStaging,
}
```

Construct it with `.make` at the actual producer and all direct callers. The
new staging field is required and has no default; both replaced fields were
required. Keep `committed` a required real Option with no None default, and
keep `regenerated` a required full string. Empty strings, whitespace, Unicode,
newlines, None, Some("") and arbitrary unequal content remain accepted.
`S.Option` preserves actual Option values; its local reference contract is
`.repos/effect/packages/effect/src/Schema.ts:13673`. Do not introduce a
JSON codec, optional-key conversion, trimmed text, NonEmptyString constraint,
content hash, default or coercion.

This is one derived ephemeral observation, constructed at the existing call
boundary. It introduces no stored state. Do not preserve the removed Boolean
pair through aliases, getters, a migration facade or an alternate accepted
legacy input. Export the schema and class through the existing module/test-kit
route for real constructor use; do not broaden the public command barrel or
change package export metadata.

The existing `PortfolioIndexPublishDisposition` LiteralKit at :74-84 is the
result domain, not a reusable staging domain. Its five values remain exactly
as written. Targeted live-source and barrel searches found no existing
PortfolioIndexStaging/PortfolioIndexPublishObservation model to reuse.
`LiteralKit remains the existing imported primitive in this module.
Use schema-derived `.is`, `.$match` or `.Enum` helpers when needed, without a
hand-written string union, duplicate predicate helper or tagged union. None
of the three selected staging cases has a case-specific payload.

## Migration inventory

| Site | Required migration and preserved behavior |
| --- | --- |
| PortfolioIndexGuard.ts:16-31,73-100 | Reuse LiteralKit, `$I` and the existing disposition model; introduce the required observation class and staging kit in this same internal file. Follow titled export JSDoc examples. Do not create a package or new role file. |
| PortfolioIndexGuard.ts:119-125 | Migrate the documented full input to `PortfolioIndexPublishObservation.make` with `staging: "staged-change"`; retain every existing payload and the `drifted` result. |
| PortfolioIndexGuard.ts:130-148 | Accept the observation class. Keep absent first. Select staging with the kit's exhaustive match. A staged change returns drifted before testing content. Unstaged returns current only when `O.contains(committed, regenerated)` is true, otherwise regenerated. Staged deletion returns removed only on that same comparison, otherwise regenerated. Keep exact string equality and full Option handling. |
| PortfolioIndexGuard.ts:199-220 | Keep context/intent signatures, acquired services, the failure-tolerant exists probe, absence return, rendering and error mapping, then local index read and failure-to-None recovery, in the same sequence. Despite its name, `committed` here is the current local file read, not `git show HEAD`; preserve that meaning. |
| PortfolioIndexGuard.ts:221-239 | Derive a single staging literal from existing intent membership and, only when staged, the same one Git query. No intent membership means unstaged with no query. Membership plus a query result containing the index means staged-deletion; membership plus no index in that result means staged-change. Remove the empty-array sentinel and the two Boolean members. Pass the four-field `.make` observation once. A temporary branch condition is permitted; do not rebuild a parallel flag carrier. |
| PortfolioIndexGuard.ts:241-263 | Leave return handling for current/removed, drifted error artifact fields and exact messages, contained write, write error mapping, regeneration log and returned disposition unchanged. There is no new side effect and no staging operation. |
| test/yeet-portfolio-index-guard.test.ts:1-8,138-202 | Import the actual class through `@beep/repo-cli/test/Yeet`; migrate all seven inputs and preserve their exact committed/present/regenerated values. Map FF to unstaged, TF to staged-change, TT to staged-deletion. Preserve the absent+staged-change diagnostic at :140-149. |
| test/yeet-portfolio-index-guard.test.ts:207-408 | The nine Effect integration scenarios use the unchanged enforce function. Preserve all fixtures, intent paths, expected Git index state, refusal text, absent behavior, symlink containment and local regeneration observations. |
| src/test/Yeet.test-kit.ts:52 and package.json:68-70 | Existing wildcard test export carries the models for their actual consumer usage. No manifest or barrel edit is needed. |
| Handler.ts:789-806 | Existing-commit bypass remains first; commit-message validation, reviewed staging, optional stash and stash recording happen before this guard. Commit execution follows it; failure restores the stash. No call order or failure restoration change is permitted. |

The exact Git argv stays `diff --cached --diff-filter=D --name-only -z --
goals/INDEX.md`. Run it after the same render and read and before disposition;
keep no-query behavior for absence and unstaged intent. Do not add a second
Git read, infer deletion from local file absence, add a new snapshot/refresh,
or reinterpret a deletion query failure as unstaged. The intent and index
observations remain at their current times; this migration does not promise
an atomic Git snapshot.

Graft discovery plus a targeted `packages/` and `apps/` TypeScript search for
the helper, removed field and class names found the above actual callers and
exports. Graph edges alone are not the exhaustive-call-site proof. Existing
other internal Yeet modules do not inspect this input carrier.

## Guard-deletion accounting

Delete the coherence expression `input.staged && !input.stagedDeletion` at
:145 and the separately read `input.stagedDeletion` at :147. The match selects
one staging case, so callers no longer construct the forbidden false/true
pair and readers no longer reconstruct the staging classification from two
bits. Delete both old members from the constructed object and consumer
carrier. The writer's synthetic empty deletion list at :232 disappears when
the unstaged arm directly produces its literal. No compatibility getters or
old-shape projection keep those obligations alive.

Retain the intent-membership boundary condition and the queried-path membership
test. They determine the state from real external data and are not redundant
coherence guards. Retain the absence guard, actual Option/string content
comparison, typed Git error, containment enforcement and refusal policy.
The change does not erase the staged-change refusal; it expresses that policy
with the staging literal. The existing disposition result branches at
:241-262 are application effects and are outside this cluster.

## Encoded-side impact

Tier 1, internal and derived. The concrete observation is passed directly to
the pure helper; no encoder, persisted artifact, transport or remote client
uses the old flag pair. `@beep/repo-cli/test/Yeet` exposes a decoded TypeScript
seam; migrate its known consumers atomically. Do not add a legacy codec for an
unshipped internal carrier or treat the raw parameter declaration as an
encoded API.

Keep the `PortfolioIndexPublishDisposition` literal values, `YeetStagedPublishIntent`
paths, generated goals index bytes, Git index state, CLI messages, typed error
messages, issue artifact subcategory `derived-index-hand-staged`, remediation
text, symlink protection and stash/commit ordering unchanged. No dependency,
lockfile, package script/export, generated source, manifest protocol or output
schema changes are required. Running this design does not itself regenerate
or write the real goals index.

## Test impact

P2 is read-only: no product tests were added or run and no implementation was
made. The seven direct helper tests cover all three legal staging cases and
the required absent+staged-change counterexample. The nine Effect integration
scenarios cover absent checkout; missing/current/stale local projection;
symlinked file and parent; staged current or stale additions; and staged
legacy deletion with a missing local copy.

At implementation time migrate those direct inputs without changing expected
results. Add focused production-schema coverage for the required three-value
staging domain and the complete retained payload domain, including Some("")
and empty regenerated text. Verify the decision matrix against the source
contract across present/absent, the three staging literals and content
None/equal/different. Preserve the early absent outcome for every staging
case; current content never excuses a staged change; stale/missing content
still regenerates a staged deletion. Do not author a false/true legacy fixture
and then call it a supported fourth staging state.

Retain existing integration proof for contained writes and untouched Git
staging, and add a focused command-order/no-query assertion only if the
migration changes how the query is arranged. A Git deletion-query error must
still propagate before any index write. The private truth-table receipt is
only a mathematical check of this proposed mapping; it is not execution of
production TypeScript, a replacement for package verification or P3 evidence.

After an independently reviewed implementation, run the focused relevant
existing tests through the repository quality lane and the required
`bun run beep quality package-verify @beep/repo-cli`, then the campaign Yeet
checks. This private design has no permission to change or execute those
product paths during P2.

## Risk

The main regression risk is moving equality ahead of the staged-change refusal,
which would allow a correctly generated staged index back into the commit.
A second is treating every staged deletion as removed before repairing a
missing local copy; the existing Git integration expects regenerated there.
The full `present` field matters for supported absent diagnostics, while
`committed` must remain an Option of the local read at the current time.
Narrowing any of those fields would exceed this selected pair.

This qualification differs from the Sweep ancestry hold. Portfolio has a
concrete owned object, a documented staged-deletion subset of staged intent,
and a failing query that emits no observation. Sweep allows construction of
partial facts from separately timed tolerant probes without a class-wide
ancestry/local-tip exclusion. Neither type permissiveness nor lack of a
counterexample alone proves a legal-state domain.

Parent must review this re-anchoring and full carrier proof, then integrate
only the corrected designed row and design. Source changes require rebinding
and renewed judgment. Independent P3 remains pending. Apply only after the
campaign gate in the ordered Tier 1E internal tooling batch, with coordinated
serial shared-file edits. This bundle does not alter the raw R30 output,
canonical inventory, prior non-admissions or any other worker's files.

## 2026-09-24 complete-carrier correction

The opening concrete object is Guard.ts233, its five fields234-238.
Presence=false with staged-change is an explicit supported test142-149, not
an invented hypothetical. The early production return209-212 merely means
this one call site sees present=true. It cannot narrow the helper carrier or
replace its absence-first behavior. Preserve all three staging states for
either presence value: selected pair4/3 and complete Boolean projection8/6.
The existing target observation models the full carrier, not an excluded
parameter-only owner or a true-presence private surrogate.

Authoritative current direct fixture call lines:142,155,164,178,181,184,197.
Integration call lines:225,242,262,282,306,332,352,374,397. Current guard
branches:144 absence,145 staged-change refusal,146 content regeneration,147
deletion/current. Producer:221 intent membership,222 conditional Git query,
233 observation construction. Handler800 runs guard within the restoration
protected commit tail; test facade52 forwards the module. Preserve current
service requirement Crypto alongside FileSystem, Path and ChildProcessSpawner.
These current anchors supersede any historical illustrative test-span references.
