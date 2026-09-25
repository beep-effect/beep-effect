# r30-cli-yeet-portfolio-index-staged-deletion

Private native P2 proposal, produced by `gpt-6-astra` with `xhigh` reasoning
(actual parent-confirmed launch, `fork_turns: none`). Source HEAD is
`e7b1e907726421c7d2a2e1cdd140280df47f2353`; pinned merged main is
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce`. This design has no P3 or
implementation credit. Paths prefixed with `src/` and `test/` below are relative
to `packages/tooling/tool/cli/`. Exact source, fixture, contract and dependency
hashes remain in the private P2 bundle bound by
[the parent integration receipt](../data/r30-parent-integration.json).

## Current shape

The qualifying owner is the complete concrete object passed to
`portfolioIndexPublishDisposition` within `enforcePortfolioIndexPublishIntent`
at `src/commands/Yeet/internal/PortfolioIndexGuard.ts:232-238`. Use the inventory
symbol `enforcePortfolioIndexPublishIntent.portfolioIndexPublishDisposition argument`
and `kind: object-literal`, with its object opening at line 232. The raw R30
locator at :140 names an excluded function-parameter declaration and must not
be admitted as written.

The object has five actual own members: `committed: Option<string>`,
`present: boolean` from the portfolio-existence observation, `regenerated: string`,
`staged: boolean` from intent path membership, and `stagedDeletion: boolean`
from membership in the deletion-query output. The two selected members
`staged` and `stagedDeletion` are real Boolean values, so they satisfy the net
without virtual payload predicates or a function-parameter owner. `present`
is already true on this production path after the early return at :208-211;
it remains an independent Boolean in the complete consumer carrier because
supported direct calls include an absent portfolio plus staged change.

The actual writer :220-237 uses the reviewed intent to decide whether to run
`git diff --cached --diff-filter=D --name-only -z -- goals/INDEX.md`. The unstaged
branch supplies an empty deletion list, so deletion cannot be selected there.
`runGitPathList` propagates a `YeetCommandError` rather than inventing a failed
probe result (`GitExec.ts:86-90`). There is no partial successful carrier emitted
when this query fails. Source module documentation :4-10 and pure helper
contract :107-110 describe three staging cases: unstaged, staged addition or
modification, and staged deletion. The deletion case is an exception within
the staged intent, not an independently observed ancestry-style partial fact.

The pure reader is :136-147. Its public test route is
`src/test/Yeet.test-kit.ts:49`, exposed by the existing test export pattern at
`package.json:65-68`. Its sole production object construction is :232-238;
its other direct calls are the documentation example :118-124 and the seven
fixtures at `test/yeet-portfolio-index-guard.test.ts:140,153,162,176,179,182,195`.
Tests are support for the declared contract, not sweep sources.

## Cardinality gap

The selected pair has four representable tuples and three legal staging
meanings. This is a minimal cluster, not a claim that every member of the
complete carrier belongs to one state variable.

| staged | stagedDeletion | Meaning and source support |
| --- | --- | --- |
| false | false | Unstaged. Writer :220-231; current/stale/missing fixtures :153-159,176,182-188. |
| true | false | Staged addition or modification. Writer :221-237; refusal fixtures :162-168,179 and documentation :118-124. |
| true | true | Staged deletion. Same writer and source exception :9-10; direct fixture :195-201 and Git-backed integration :361-381. |
| false | true | Excluded by the staged-intent deletion contract and its production construction at :221-237. No supported direct constructor or alternate writer establishes this as a legitimate independent diagnostic fact. |

E4 is the implication `stagedDeletion => staged`, evidenced by :221-237 and
the contract :107-110. The complete supported consumer domain retains
`present=false` with a staged change (`test:138-147`), all `Option<string>`
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
`.repos/effect/packages/effect/src/Schema.ts:12746-12794`. Do not introduce a
JSON codec, optional-key conversion, trimmed text, NonEmptyString constraint,
content hash, default or coercion.

This is one derived ephemeral observation, constructed at the existing call
boundary. It introduces no stored state. Do not preserve the removed Boolean
pair through aliases, getters, a migration facade or an alternate accepted
legacy input. Export the schema and class through the existing module/test-kit
route for real constructor use; do not broaden the public command barrel or
change package export metadata.

The existing `PortfolioIndexPublishDisposition` LiteralKit at :73-83 is the
result domain, not a reusable staging domain. Its five values remain exactly
as written. Targeted live-source and barrel searches found no existing
PortfolioIndexStaging/PortfolioIndexPublishObservation model to reuse.
`LiteralKit` is exported at `packages/foundation/modeling/schema/src/index.ts:287`.
Use schema-derived `.is`, `.$match` or `.Enum` helpers when needed, without a
hand-written string union, duplicate predicate helper or tagged union. None
of the three selected staging cases has a case-specific payload.

## Migration inventory

| Site | Required migration and preserved behavior |
| --- | --- |
| PortfolioIndexGuard.ts:16-31,73-100 | Reuse LiteralKit, `$I` and the existing disposition model; introduce the required observation class and staging kit in this same internal file. Follow titled export JSDoc examples. Do not create a package or new role file. |
| PortfolioIndexGuard.ts:118-124 | Migrate the documented full input to `PortfolioIndexPublishObservation.make` with `staging: "staged-change"`; retain every existing payload and the `drifted` result. |
| PortfolioIndexGuard.ts:129-147 | Accept the observation class. Keep absent first. Select staging with the kit's exhaustive match. A staged change returns drifted before testing content. Unstaged returns current only when `O.contains(committed, regenerated)` is true, otherwise regenerated. Staged deletion returns removed only on that same comparison, otherwise regenerated. Keep exact string equality and full Option handling. |
| PortfolioIndexGuard.ts:198-219 | Keep context/intent signatures, acquired services, the failure-tolerant exists probe, absence return, rendering and error mapping, then local index read and failure-to-None recovery, in the same sequence. Despite its name, `committed` here is the current local file read, not `git show HEAD`; preserve that meaning. |
| PortfolioIndexGuard.ts:220-238 | Derive a single staging literal from existing intent membership and, only when staged, the same one Git query. No intent membership means unstaged with no query. Membership plus a query result containing the index means staged-deletion; membership plus no index in that result means staged-change. Remove the empty-array sentinel and the two Boolean members. Pass the four-field `.make` observation once. A temporary branch condition is permitted; do not rebuild a parallel flag carrier. |
| PortfolioIndexGuard.ts:240-260 | Leave return handling for current/removed, drifted error artifact fields and exact messages, contained write, write error mapping, regeneration log and returned disposition unchanged. There is no new side effect and no staging operation. |
| test/yeet-portfolio-index-guard.test.ts:1-8,138-202 | Import the actual class through `@beep/repo-cli/test/Yeet`; migrate all seven inputs and preserve their exact committed/present/regenerated values. Map FF to unstaged, TF to staged-change, TT to staged-deletion. Preserve the absent+staged-change diagnostic at :138-147. |
| test/yeet-portfolio-index-guard.test.ts:205-406 | The nine Effect integration scenarios use the unchanged enforce function. Preserve all fixtures, intent paths, expected Git index state, refusal text, absent behavior, symlink containment and local regeneration observations. |
| src/test/Yeet.test-kit.ts:49 and package.json:65-68 | Existing wildcard test export carries the models for their actual consumer usage. No manifest or barrel edit is needed. |
| Handler.ts:775-791 | Existing-commit bypass remains first; commit-message validation, reviewed staging, optional stash and stash recording happen before this guard. Commit execution follows it; failure restores the stash. No call order or failure restoration change is permitted. |

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
:144 and the separately read `input.stagedDeletion` at :146. The match selects
one staging case, so callers no longer construct the forbidden false/true
pair and readers no longer reconstruct the staging classification from two
bits. Delete both old members from the constructed object and consumer
carrier. The writer's synthetic empty deletion list at :231 disappears when
the unstaged arm directly produces its literal. No compatibility getters or
old-shape projection keep those obligations alive.

Retain the intent-membership boundary condition and the queried-path membership
test. They determine the state from real external data and are not redundant
coherence guards. Retain the absence guard, actual Option/string content
comparison, typed Git error, containment enforcement and refusal policy.
The change does not erase the staged-change refusal; it expresses that policy
with the staging literal. The existing disposition result branches at
:240-259 are application effects and are outside this cluster.

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
