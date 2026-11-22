# Comment ratchet: design research

Lane `ratchet`, checkout a1b08269809. Repo paths are relative to that checkout; `cli/` abbreviates
`packages/tooling/tool/cli/`. Measurements come from scripts in the scratchpad under
`proto/ratchet/` (`lib.ts`, `history.ts`, `size.ts`, `scope.ts`, `cases.ts`, `full.ts`). The
scanner in `lib.ts` is a port of `census/census.ts`; it reproduces the census exactly
(9,851 enforced files, 24,690 prose groups, `full.ts`). "Enforced" = zones src, test, tooling-root.

## 1. Recommendation

Commit no inventory of comments. Use two checks that share one scanner and one fingerprint function:

1. **Delta check** (everywhere): over the files changed between the merge base and the checked tree,
   the multiset of banned-comment fingerprints may not gain a member. Fingerprints carry no path.
   The floor is the merge base, so it lowers itself every time a deletion merges.
2. **Lock check** (tree only): any scope that is not listed as *pending* must contain zero banned
   comments. Whole-tree on main; on a pull request it judges only the scopes the PR locks and the files
   the PR changes (5.4), so a violation already on main does not red every open PR. The pending list is one small shard per package under `standards/comment-law/`. A shard
   may only lose scopes. A sweep PR that empties a scope deletes its line. New packages are never pending.

At zero pending scopes, the lock check is a plain ban. Then the delta check, shards and ratchet code
are deleted and the rule stays as an ordinary lint rule.

Reason in one sentence: the delta check is the only design that stores nothing, survives renames and
moves, and cannot collide across lanes; the lock check covers its one real hole, which is that a
violation merged under S11 becomes part of the next merge base.

## 2. What the repo already does

| Ratchet | Unit | Base | Shrink behaviour | Cost seen |
| --- | --- | --- | --- | --- |
| JSDoc totals (`cli/src/commands/Quality/internal/JSDocRatchet.ts:34-56,361-400`) | 21 repo-wide counts, 1,361 bytes | committed file | growth fails; a decrease only prints `tighten-baseline` | 14 of 1,391 main commits since 2026-10-15 touch it |
| Coverage (`standards/coverage.regression-baseline.jsonc`) | per file and package, 1.76 MB | base-branch document, plus the merge-base document to decide who authored a row (`cli/src/commands/Quality/internal/CoverageRegression.ts:1098-1101`) | author regenerates rows | 115 commits |
| effect-vitest (`standards/effect-vitest.inventory.jsonc`) | path + symbol + evidence + AST-anchor hash + ordinal (`cli/src/commands/Lint/Lint.schemas.ts:1861-1874`) | committed, 1.05 MB | whole-file `--write` | 129 commits; the anchor logic needs about 100 lines of ambiguity rules (`cli/src/commands/Lint/internal/EffectVitestScan.ts:304-440`) |
| schema-first (`standards/schema-first.inventory.jsonc`) | path + symbol, with a hand-written reason | committed, 161 KB | `--write` | 83 commits |
| fallow health (`standards/fallow.health.regression-baseline.jsonc`) | count per file per class | committed, 21 KB | regenerate | 10 commits |
| entity-kit freeze (`cli/src/commands/Laws/EntityKitFreeze.ts:8-14`) | file membership | committed, 67 lines | a stale row *fails* until `--write` prunes it; `--write` never adds a row | 2 commits |
| knowledge doctor (`cli/src/commands/Knowledge/KnowledgeDoctor.baseline.ts:118-132,600-630`) | content digest with durable document identity | minted on main by an App PR (`.github/workflows/knowledge-baseline-mint.yml:1-18,24-28`); a branch may only delete entries | weekly mint | 8 commits; needs rename lineage plus an identity sidecar |
| changeset status, fallow lanes, knowledge semantic-delta | none | merge base, via `--base` / `BEEP_PROOF_BASE` (`package.json:429,456`; `cli/src/commands/Quality/ChangesetStatus.ts:8`; `cli/src/commands/Quality/Tasks.ts:3940-3944`) | automatic | no committed state |

Shared code: `diffMembership` and `diffTotals` (`cli/src/internal/ratchet/RatchetDiff.ts:70-94,244-271`)
and `enforceRatchet` (`cli/src/internal/ratchet/RatchetLifecycle.ts:67-91`). `diffMembership` is an
O(n*m) `A.some` scan over a *set*, so it is wrong for a multiset and quadratic at 24,690 rows. A
`diffMultiset` on `HashMap` counts belongs beside it. `enforceRatchet` is usable as is.

Rulings and facts that bind the design:

- S31 (operator, 2026-10-15; file memory `feedback-no-inventory-growth-s31`): never grow a debt or
  exception inventory under `standards/`; improve the check. Path-keyed inventories already needed a
  separate ruling for a plain file move
  (`goals/text-knowledge-stack-rebuild/decisions/2026-11-19-p1-s31-rows-move-with-the-file.md`).
- `merge=regenerate` does not help lanes: GitHub computes mergeability server-side and ignores local
  drivers, so PRs stay DIRTY. The repo already rejected it for this reason and chose per-package
  shards (`standards/generated-artifacts.policy.md`, "Per-package shards", "Rejected").
- Committed scans with no gate reader were deleted on 2026-11-14 because every merge made them stale
  (same file, "Uncommitted scans"). A census belongs in `.beep/`.
- File memory `feedback-prefer-biome-gritql-for-syntactic-guards` (operator, 2026-10-21): syntactic guards
  default to Biome GritQL, "not ... new law lanes". Lane `lint` measured that GritQL cannot express a
  comment ban (`lint.md`, section 1) and a delta needs git context, so this design departs from that
  default for a stated reason. The plain ban at the end should be a lint rule, not a law.
- A verdict must not read clone-local refs (#3453, HEAD). A merge-base diff reads one named base
  commit, which is the existing contract for the git-delta tasks.
- Hosted clones are blobless with full history (`.github/workflows/check.yml:257-262`). Reading base
  blobs one at a time fetches one at a time; the gitleaks step shows the batch-prefetch form
  (`check.yml:2352-2371`). `--no-renames` listings need no blobs.
- `Heavy / Lint Policy` is **not** required (`cli/src/commands/Ci/CiLane.ts:461-471`). Required contexts
  are in `standards/branch-protection-contexts.json` and include `Repo Sanity`, `Lint`, `JSDoc Ratchet`.
  The home-path law was put into Repo Sanity for exactly this reason (`CiLane.ts:2092-2093`).
- S11 lets a final PR merge over reds, required ones included (AGENTS.md, Quality Operator).

## 3. Measured pressure

`history.ts 400` replayed the last 400 first-parent main commits (13.3 days). 292 touch TS/JS.

| Kind | Commits adding one or more (path-free) | Groups added | Groups removed | Same-file add+remove pairs (edits) |
| --- | ---: | ---: | ---: | ---: |
| prose | 266 of 292 (91%) | 5,013 | 435 | 381 |
| non-exported JSDoc | 86 | 750 | 48 | 39 |
| member JSDoc | 51 | 406 | 45 | 29 |
| exported/module JSDoc | 207 | 5,147 | 1,005 | 804 |
| directive | 20 | 445 | 15 | 1 |

- The repo gains about 375 prose comments a day; 13 days of adds equal 20% of the 24,690 stock. Median
  commit adds 7, p90 45. 45% of adds land in new files; the top ten commits hold 25%. A sweep without
  the delta check loses to inflow.
- Switching the delta check to blocking would red 91% of PRs at today's habits. It needs an advisory
  window and an AGENTS.md line on the same day.
- 130 of 292 commits carry at least one prose edit pair (same-file add+remove); 100 (34%) carry one with
  token similarity of at least 0.5, 219 groups in all. Only 14 commits pass a per-file count and fail the
  fingerprint check, but that figure is confounded: nearly every other commit already fails because it
  adds comments. Once adds stop, strict edits would bind on roughly a third of today's commits. The
  remedy is always a deletion, so the cost is real but bounded; it is not "little".
- `@beep/repo-cli` holds 8,985 of 24,690 prose groups and 194 of 292 commits change its count.

Lane-collision proxy (pairs of commits merged within 24 h): 10,745 of 12,720 pairs (84%) both change
the prose population, so both would edit one central per-file or fingerprint file. 6,412 pairs (50%)
change the same package's count row; 564 (4.4%) touch the same file's row. Under an enforced ban adds
disappear; looking only at the 138 commits that remove prose, 2,052 of 3,019 pairs (68%) still hit the
same package row. These are touch overlaps, an upper bound on textual conflicts, not conflict counts.

## 4. Options

A repo-wide totals · B per-package counts · C per-file counts · D path+fingerprint set ·
E merge-base delta, nothing committed · F path-free fingerprint multiset sealed by a main-side mint ·
P pending-scope list with a zero rule (the lock check).

### 4.1 Baseline size (enforced zones; pretty JSON, 16-hex fingerprints; `size.ts`, `scope.ts`)

| Option | prose only (24,690) | + non-exported JSDoc (31,596) | + member (37,264) | all JSDoc (79,398) |
| --- | --- | --- | --- | --- |
| A | 1 row / 21 B | 2 / 44 B | 3 / 68 B | 4 / 93 B |
| B | 218 / 13.0 KB | 219 / 16.5 KB | 219 / 19.7 KB | 219 / 25.0 KB |
| C | 4,089 / 365 KB | 4,694 / 449 KB | 4,931 / 485 KB | 8,065 / 853 KB |
| D | 24,519 / 961 KB | 31,363 / 1.19 MB | 36,929 / 1.36 MB | 78,188 / 2.71 MB |
| E | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| F (one `hash[ count]` per line) | 23,902 / 407 KB | 30,671 / 522 KB | 36,145 / 616 KB | 76,594 / 1.30 MB |
| P, package scopes (path list) | 218 / 8.0 KB | 219 / 8.0 KB | 219 / 8.0 KB | 219 / 8.0 KB |
| P, file scopes | 4,089 / 274 KB | 4,694 / 316 KB | 4,931 / 331 KB | 8,065 / 546 KB |

The recommended kinds (prose + local + member) give 219 package scopes, not 218: the extra owner is `(root)`
(109 groups in `.claude/`, `.semgrep/` and root config files), which has no `@beep/` name and needs its own shard name.
P as one shard per package is the same rows in as many files, about 25-30 KB with headers (estimate,
not generated). Other P granularities for prose: package + first directory 571 rows / 27 KB; directory
917 / 44 KB. D uses the file path as an object key, so one row is one `(path, fingerprint)`.

### 4.2 Verdict per case (run, not argued: `cases.ts`)

| Case | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| rename file, same package | pass | pass | FAIL | FAIL | pass | pass |
| rename file across packages | pass | FAIL | FAIL | FAIL | pass | pass |
| move function to another file, same package | pass | pass | FAIL | FAIL | pass | pass |
| move function to another package | pass | FAIL | FAIL | FAIL | pass | pass |
| edit the wording | pass | pass | pass | FAIL | FAIL | FAIL |
| append a line to a `//` group | pass | pass | pass | FAIL | FAIL | FAIL |
| delete one, add a different one | pass | pass | pass | FAIL | FAIL | FAIL |
| re-wrap the same words | pass | pass | pass | pass | pass | pass |
| copy a commented file | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL |
| new file with a comment | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL |
| delete one comment | pass | pass | pass | pass | pass | pass |
| split one group in two | FAIL | FAIL | FAIL | FAIL | FAIL* | FAIL |

"FAIL" for C and D on a rename means the author must edit the baseline, adding a row, which S31 reads
as growth. The delete-and-add row is the decisive one for A-C: a count ratchet lets an agent trade a
decision record for a new excuse. (*) the line tier in 5.2 fixes it:
`split.ts` passes a split, a trim and a join, and still fails a rewrite, a duplicated line, and a
re-wrap combined with a trim. On history the tier rescued only 7 of 5,013 groups, so it exists to let
sweeps trim, not for volume.

P on the same cases: a rename or move inside one pending or one locked scope passes; a move from a
pending into a locked scope fails (wanted: the comment must go); everything else follows E in a pending
scope and the plain ban in a locked scope.

### 4.3 Two PRs deleting different comments (git merges run in a throwaway repo)

| Shared state | Result |
| --- | --- |
| A/B, same row, both 100 to 99 | merges **cleanly to 99 while the truth is 98**: slack of one, or a stale-row red on main if exactness is enforced |
| A/B, same row, 99 vs 97 | CONFLICT |
| B/C, adjacent rows | CONFLICT |
| D/F, adjacent fingerprint rows | CONFLICT |
| D/F, distant rows | clean |
| F where only the mint writes | no lane edits it: clean |
| E | nothing shared: clean |
| P, deleting different shard files | clean |
| P, same package shard, adjacent scope lines | CONFLICT; resolution is always the intersection |

### 4.4 Remaining axes

| | Generated files | Auto-lower | S11 merge over the red | Cacheable verdict | S31 |
| --- | --- | --- | --- | --- | --- |
| A-D | excluded by the scanner; regenerating a file into or out of the exclusion changes rows | no: regenerate and commit | main stays red until fixed or re-baselined, and re-baselining is the usual escape | yes | new inventory |
| E | excluded by the scanner | yes, by definition | **laundered**: the next merge base contains it | no (needs base; git-delta class) | none |
| F | excluded | weekly mint; a deleted comment can return until then | main stays red | yes | shrink-only inventory, 0.4-1.3 MB, plus App, seal guard, lineage code |
| P | excluded | stale scope fails, `--write` prunes | pending scope: survives until the sweep; locked scope: main stays red | yes | shrink-only, 8 KB of scopes |

E + P is the recommendation because P bounds E's hole: a laundered comment in a pending scope has to be
removed before the scope can lock, and in a locked scope the tree-only check stays red on every head.

F is the runner-up. Choose it only if the sweep is expected to stall for months with most scopes pending.

## 5. Recommended design

### 5.1 Scope and kinds

`CommentKind = directive | license | prose | jsdoc-local | jsdoc-member | jsdoc-export`. Directive and
licence are exempt by grammar, but the census
grammar is too loose to gate on: unanchored prefixes (`effect-`, `region`, `=>`, `typos`, `semgrep`) exempt
"// => we do this because upstream is flaky", and any comment in the first 12 lines containing "derived from" or
"ported from" counts as a licence (both run). About 20 of 975 directives and several of 76 licences are prose today.
The generated-file test is loose too: any first-600-character match of "Generated by"/"DO NOT EDIT" exempts the file;
13 enforced-path files are exempt by header text alone, among them the hand-written
`packages/tooling/library/repo-gate-run/test/TypeCheckAdapter.test.ts`. A gate needs token-exact directives, an
attribution form, and generated status by path or registry. Which of the others are banned is a policy literal, not scanner logic.

Binding constraints on the choice:

- `prose` and `jsdoc-local` must be banned **together**. Banning only `//` makes `/** */` on a local
  the free conversion, and the fingerprint is per kind, so the delta check would not see it.
- The census class `jsdoc-local` is **not** the same as "not exported". It is decided by an `Export*` AST node
  at the comment, so a declaration exported through `export { X }` is called local: 405 documented
  declarations, 403 of them with `@since`, mostly `@beep/ui`
  (`packages/foundation/ui-system/ui/src/components/accordion.tsx:13`). The JSDoc inventory counts them as
  exports, because it walks `sourceFile.getExportedDeclarations()`
  (`cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1250`). Banning `jsdoc-local` with the
  census classifier would therefore contradict the required JSDoc Ratchet. The scanner must resolve export
  specifiers (and `export default X`) before the ban covers that kind.
- Kinds depend on context, so un-exporting a documented symbol turns `jsdoc-export` into `jsdoc-local` and
  fails the delta (run in `proto/ratchet-refute/kinds.ts`); exporting an interface with member docs does the same. Rare on
  history (0 exact, 3 near matches in 292 commits). Dropping the kind from the digest fixes unchanged text.
- `jsdoc-export` cannot be banned while `JSDoc Ratchet` is a required context that fails on
  `missingExportExamples`, `missingExportCategories` and `missingExportSince` above 0
  (`standards/jsdoc-totals.regression-baseline.jsonc`). That is a separate ruling. Until then,
  moving prose into an exported symbol's Details section stays open as an escape.

### 5.2 Fingerprint

Unit: a comment group (adjacent own-line `//` with equal indent, or one block), as in the census.
Fingerprint: first 16 hex of SHA-256 over `kind NUL text`, with delimiters and leading `*` removed and
whitespace runs collapsed. No path, line or neighbour. Full-tree duplicates are small (788 extra copies
of 24,690 prose groups), so multiset counting is enough; no occurrence ordinal is needed.

Delta algorithm, over `merge-base..tree` with `--no-renames` and statuses A, C, M, T, D:

1. `before` = multiset over base blobs of changed in-scope files; `after` = same over the checked tree.
2. `introduced = after - before`, `removed = before - after`.
3. Line tier: an introduced `//` group is admitted when each of its normalised lines is still available
   in the line multiset of `removed` (consume on use), taken from the **same file** only: the pooled form in
   `split.ts`, extended to several files, lets unrelated lines be recombined into a new comment. This admits trims, splits and joins; a rewrite
   still fails.
4. What is left fails. No rename detection anywhere, so no similarity threshold and no blob-heavy git
   in blobless clones.

A file that enters or leaves the exclusion set (generated, vendor, fixture) is compared by its
classification on each side. A generated file that becomes hand-written therefore introduces its comments.

Base: PR = `beep ci lane --event-base`, which already resolves the first parent of the proven merge commit
(`cli/src/commands/Ci/CiEventBase.ts:262-296`); `check.yml:18-28` forbids binding affected scope to a freshly
fetched ref. On push `--event-base` returns the pushed commit itself, so the delta there is empty by
construction and main relies on the lock check. `check.yml:4-5` runs only for PRs into `main`, so a stack
layer gets no hosted verdict until it is retargeted;
local = `--base`, then `BEEP_PROOF_BASE` / `BEEP_YEET_PROOF_BASE`, then `origin/main`, the fallback order
fallow already implements (`cli/src/commands/Quality/FallowQuality.command.ts:1622-1625`). An
unresolvable base fails; it never skips. A branch that merges main moves its merge base, so merged-in
comments are never attributed to the lane.

### 5.3 Schemas (sketch; not compiled)

```ts
const $I = $RepoCliId.create("commands/Laws/CommentLaw.model");

export const CommentKind = LiteralKit([
  "directive", "license", "prose", "jsdoc-local", "jsdoc-member", "jsdoc-export",
]).pipe($I.annoteSchema("CommentKind", { description: "Syntactic class of one source comment." }));

export const CommentLawEnforcement = LiteralKit(["advisory", "blocking"]).pipe(
  $I.annoteSchema("CommentLawEnforcement", { description: "Whether comment-law findings fail the check." })
);

export const CommentLawRule = LiteralKit([
  "introduced-comment", "locked-scope-comment", "stale-pending-scope", "pending-scope-grew",
]).pipe($I.annoteSchema("CommentLawRule", { description: "Rule that produced a comment-law finding." }));

export class CommentLawPolicy extends S.Opaque<CommentLawPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("comment-law-policy/v1"),
    enforcement: CommentLawEnforcement,
    bannedKinds: S.NonEmptyArray(CommentKind),
  }).pipe($I.annoteSchema("CommentLawPolicy", { description: "Banned comment kinds and enforcement state." }))
) {}

export class CommentLawPending extends S.Opaque<CommentLawPending, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("comment-law-pending/v1"),
    package: S.NonEmptyString,
    scopes: S.NonEmptyArray(S.NonEmptyString),
  }).pipe($I.annoteSchema("CommentLawPending", {
    description: "Package-relative path prefixes not yet swept to zero banned comments; may only shrink.",
  }))
) {}

export class CommentFingerprint extends S.Opaque<CommentFingerprint, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: CommentKind,
    digest: S.String.check(S.isPattern(/^[0-9a-f]{16}$/)),
    file: S.String,
    line: S.Int,
    excerpt: S.String,
  }).pipe($I.annoteSchema("CommentFingerprint", { description: "One banned comment and its path-free digest." }))
) {}

export class CommentLawFinding extends S.Opaque<CommentLawFinding, { readonly brand: unique symbol }>()(
  S.Struct({ rule: CommentLawRule, scope: S.String, comment: S.Option(CommentFingerprint) }).pipe(
    $I.annoteSchema("CommentLawFinding", { description: "One comment-law violation." })
  )
) {}
```

Files: `standards/comment-law/policy.jsonc` (like `standards/schema-crispening.policy.jsonc`) and
`standards/comment-law/@beep/<pkg>.pending.jsonc` (the schema-catalog layout). Each shard starts with
`scopes: ["."]`. A scope may be replaced only by narrower scopes inside it, so a large package
(`@beep/repo-cli`) can be swept by command directory: replace `"."` with the remaining directories.
`cli/test` is one flat directory with 4,664 prose groups, so a scope must also accept a single file path.
No comment counts are stored. Counts come from `--census`, which writes `.beep/comment-law/census.json`.

Service: `CommentLaw` as a `Context.Service` with `scan(source)`, `delta(base)`, `lock`, `prune`; Git
access through `@beep/git`. `Git.show(ref, path)` exists (`packages/drivers/git/src/Git.ts:3959`) but is
one process and one lazy fetch per file, so a batch blob read has to be added to the driver. Parser:
`oxc-parser` is present only transitively, as an *optional* dependency of `@shadcn/lint` (`bun.lock:7265`, resolved
at `bun.lock:9055`; storybook nests 0.127.0); either add it to the catalog or use the
TypeScript scanner. The oxc prototype scans all 9,851 files in 5.7 s at nice 19, so the whole-tree lock
check is affordable uncached.

### 5.4 Shrink-only guard

- Every head scope must lie inside a merge-base scope of the same package, else `pending-scope-grew`. A
  package absent from the base has no shard. A renamed package may take over the shard of exactly one
  package that vanished in the same diff.
- A pending scope with zero banned comments is `stale-pending-scope` and fails (the entity-kit rule).
  `--write` removes it and deletes an empty shard. `--write` never adds a scope.
- Widening `bannedKinds` is a one-time re-seed PR that only a decision file can carry, with the
  `pending-scope-grew` guard comparing per policy version. This is the single point where the list may
  grow; it needs an explicit operator ruling because S31 reads as a blanket ban.

Lock race, reproduced with git merges: PR A sweeps scope `y` and deletes its shard; PR B moves a commented
function from pending `x` into `y`. Both are green, both merge cleanly, and main is red.
`strictRequiredStatusChecksPolicy` is false (`standards/branch-protection-contexts.json`), so GitHub does not
re-run B. Hosted PRs test the merge commit, so a whole-tree lock in a required lane would then red every open
PR. Hence: PR runs judge scopes the PR locks plus the files it changes; push runs judge the whole tree.

`stale-pending-scope` as a failure can red main when two sweeps together empty a scope that neither
emptied alone. Report it as an advisory on push and as a failure on PRs.

### 5.5 Commands and hosted lane

| Command | Use |
| --- | --- |
| `bun run beep laws comments --check [--base <ref>]` | delta + lock; root script `lint:comment-law` |
| `bun run beep laws comments --check --staged` | pre-commit: delta of the index against HEAD |
| `bun run beep laws comments --write` | prune stale scopes |
| `bun run beep laws comments --census [--json]` | counts per package and kind; input for `/delete-comment` |
| `bun run beep laws comments --list <scope>` | worklist for one sweep |

- Hosted owner: a step in the `repo-sanity` CiLane body beside `lint:private-home-paths`, with `--base`,
  because Repo Sanity is required and starts without `ready-for-heavy`. Code path only, so docs-only PRs
  skip it. Hosted PR checkouts pass no `ref:` (`check.yml:257-262`), which for `pull_request` means the merge
  ref (confirmed by `check.yml:25`, "HEAD remains the synthetic merge"), so activation reaches every open PR on its next push even if the lane has not merged main.
  `check.yml:396-403` passes no base to `ci lane repo-sanity` today; the arm must pass
  `--event-base`; the CLI flag exists (`cli/src/commands/Ci/CiLane.ts:3139,3308`), only the workflow arm and the lane body change.
- Local: `lint:comment-law` in cheap-gates via `githubCheckLane` + `rootTaskLane(..., base)`
  (`cli/src/commands/Quality/internal/GithubChecks.ts:88-105,909-918`), and in `policyGitDeltaTasks`
  (`cli/src/commands/Quality/Tasks.ts:3944`). Turbo `cache: false`, like `//#knowledge:semantic-delta`.
- Editor and end state: an oxlint JS rule in `packages/tooling/policy-pack/lint-rules`.
  `context.sourceCode.getAllComments()` is already used there (`src/rules/tsdoc-syntax.ts:82`).
  `lint:oxlint` runs inside the non-required Lint Policy lane, so the rule cannot replace the law check
  until it has a required owner.
- Wiring a law touches about 24 files (counted from the first template). Template: `git show --stat 00e2e35dbae` (no-tracked-python) or
  `7f7cb719ba6` (entity-kit freeze). It includes `standards/policy-tools.fingerprint.json`,
  `root-package.projection.generated.json`, the cache baseline, catalogs, `TurboConfigProof.ts`,
  `DocsPolicy.ts`, `vitest.shards.json` and `turbo.json`.

### 5.6 Failure text

```
[comment-law] regression: 3 comment(s) introduced since merge base 1a2b3c4d5e6f
  - packages/foo/src/Bar.service.ts:41  prose  "// Retry twice because the upstream..."
  - packages/foo/src/Bar.service.ts:88  jsdoc-local  "Builds the request."
  - packages/foo/test/Bar.test.ts:12  prose  "// arrange"
[comment-law] editing a comment counts as writing a new one; moving it unchanged does not.
[comment-law] instead: delete it if the code already says it; put the reason in a name, type, schema
[comment-law]   annotation or test title; record a real decision in an ADR (run /delete-comment).
[comment-law] there is no baseline to regenerate and no allowlist.

[comment-law] locked scope: @beep/csv is swept; 1 comment found
  - packages/foundation/modeling/csv/src/Csv.codec.ts:19  prose  "// fall back"
[comment-law] stale: @beep/csv scope "src/internal" has no comments left; run `bun run beep laws comments --write`
```

### 5.7 Rollout and reversal

1. PR 1: scanner, `--census`, delta check with `enforcement: "advisory"`, AGENTS.md rule, `/delete-comment`.
2. PR 2: seed shards (219), lock check on.
3. After the advisory window: one-line PR to `"blocking"`. Keep the window short (days); inflow is about
   375 a day. Coordinate with the orchestrator, since open lanes are hit on the next push.
4. Sweep PRs shrink shards. At zero pending scopes, delete shards, delta check and policy, and promote the oxlint
   rule to `error` with a required owner.

Reversal at any stage: set `enforcement` to `"advisory"` (one line, no state to restore). Full removal:
revert PR 1-2; no other gate reads the shards. Deleted comments come back only through git history, so
sweep PRs stay per package and are revertible on their own.

## 6. Second-order effects to settle in the goal

- **Codemods that rewrite words inside comments** (renaming a module named in prose) count as edits and
  fail. With strict edits the codemod must delete the comment. An escape token would become the new
  excuse; not recommended.
- **Directive reasons**: 20 of 292 commits added 445 directives, 409 of them in three PRs. A
  `biome-ignore ...: <essay>` is a free prose carrier. Cap reason length in the scanner, or accept it.
- **Line-shift ripple**: deletions move line numbers. The effect-vitest membership key ignores lines
  except inside the `id` ordinal (`Lint.schemas.ts:1861-1874`), but `preserveEffectVitestExceptions`
  requires exact line and column ids for duplicate groups (`EffectVitestScan.ts:349-362`), so a sweep of
  a test file can reopen reviewed exceptions there. `standards/policy-tools.fingerprint.json` is a path
  list with no content hash, so a comment-only sweep should not touch it; adding the law does, and 127
  main commits touch it, so that PR will conflict there. Schema-first inventory key behaviour under line shifts: not verified.
- **Coverage**: comments are not statements, but a touched package is re-measured on the PR, and
  inherited rows surface (file memory `coverage-ratchet-remeasures-touched-package`). Sweeping
  `@beep/repo-cli` will hit this. Not reproduced here.
- **Criss-cross merges** give several merge bases (reproduced: two), so a local `--base origin/main` run can
  differ from hosted. Hosted runs use the merge commit's first parent and are not affected.

## 7. Evidence limits

The history replay uses first-parent commits as PRs and the current zone rules for old trees. The
classifier is the census heuristic (regex directive list, AST attachment). Package ownership in
`history.ts` is a path regex, in `size.ts` the nearest `package.json`. Nothing was run on a hosted runner;
the repo-sanity base plumbing, batch blob read and shard seeding are designs only.

## Refutation pass

Second reviewer, 2026-11-21, same checkout. Prototypes rerun; new ones in `proto/ratchet-refute/`. The body
above is already corrected.

| Claim | Verdict | Evidence |
| --- | --- | --- |
| History replay: 292/400 commits, 266 fail, 5,013 added, 435 removed, median 7, p90 45 | confirmed | `history.ts 400` rerun in 23 s; output byte-identical to the stored `history.json`; `an.ts`, `dist.ts` agree |
| Baseline sizes | confirmed for prose and all JSDoc | `size.ts`, `scope.ts` rerun |
| 218 pending rows | corrected | true for prose only; the recommended kinds give 219, the extra one is `(root)`, 109 groups, no package name |
| Case table (A-F) | confirmed | `cases.ts`, `split.ts` rerun; every cell matches |
| "Delta passes unchanged moves" | confirmed with limits | fails when the move changes the kind (un-export, export an interface with member docs, licence past line 12); a plain move or re-indent passes |
| Line tier allows only trims, splits, joins | refuted | it pools removed lines across all files: one line from `a.ts` plus one from `b.ts` forms a new comment in `c.ts` and passes (`line.ts`). Restrict the pool to one file, or to lines that were in one removed group for a trim or split |
| Multiset is a floor | confirmed with limit | a deleted `// TODO fix` pays for a new identical one on unrelated code; low value to abuse |
| 100 to 99 twice merges to 99 | confirmed | rerun in a throwaway repo |
| Collision proxy 84% / 50% / 4.4% | confirmed | 10,745 / 6,412 / 564 of 12,720; `an3.ts` 2,052 of 3,019 |
| `merge=regenerate` rejected | confirmed | `standards/generated-artifacts.policy.md:68-70` |
| Lint Policy not required, Repo Sanity is, home paths there for that reason | confirmed | `CiLane.ts:461-467,2092-2094`; `branch-protection-contexts.json` |
| Repo Sanity starts without `ready-for-heavy` | confirmed by reading | `check.yml:237-253`: `needs` admission but runs under `!cancelled()` |
| Hosted PR checkouts "appear to" use the merge ref | confirmed | `check.yml:18-28`, `CiEventBase.ts` |
| PR base = merge base with `GITHUB_BASE_REF`; push = `event.before` | corrected | use the existing `--event-base`; push resolves to the pushed commit, so the delta is empty there; stack layers have no hosted run (`check.yml:4-5`) |
| repo-sanity base plumbing must be built | corrected | `ci lane` already has `--base` and `--event-base` (`CiLane.ts:3139,3308`); only the arm and body change |
| Precedent table commit counts and byte sizes | confirmed | 14, 115, 129, 83, 10, 2, 8, 127 since 2026-10-15; 1,391 was `--since` at the author's local time (a UTC-midnight query gives 1,445) |
| `diffMembership` is a quadratic set diff | confirmed | `RatchetDiff.ts:82-87` |
| Entity-kit freeze precedent | confirmed | `EntityKitFreeze.ts:8-14`; the baseline has 2 commits |
| repo-cli 8,985 groups, `cli/test` 4,664 flat, 194 commits | confirmed | `scope.ts`, `dist.ts` |
| Scanner reproduces the census, 5.7 s | confirmed | 9,851 / 24,690 in 4.97 s; 0 oxc parse errors over the enforced files. Hosted time unmeasured |
| "14 of 292, so treating an edit as new adds little" | refuted as an inference | confounded by adds; 100 commits (34%) hold a near-edit at similarity 0.5 or more, 120 at 0.3, 130 by pairing |
| `jsdoc-local` can be banned on day one | refuted for the census classifier | 405 declarations exported by specifier (403 with `@since`) are classed local while the JSDoc Ratchet requires their docs; 1,177 of 6,906 `jsdoc-local` blocks carry `@since` or `@category`, so the trusted 6,906 / 35.5K figure overstates non-exported JSDoc |
| Directives and licences "exempt by grammar" | corrected | open escapes, run in `kinds.ts`; `Region-confined`, `Effect-returning`, `Istanbul's` and similar prose are counted as directives today |
| Generated files excluded by the scanner | corrected | header text alone exempts 13 files, at least one hand-written test; adding the phrase to any header is an escape |
| Locked scope keeps main red | confirmed, cost understated | the red reaches every open PR's required lane through the merge ref, and a clean two-PR race produces it without S11 (reproduced) |
| JSDoc Ratchet blocks an exported-JSDoc ban | confirmed | baseline holds the three metrics at 0; context is required |
| effect-vitest duplicates can reopen | confirmed by reading | behaviour in `EffectVitestScan.ts:366-430` (349-362 is its doc comment) |
| Wiring about 15 files | corrected | about 24 in `00e2e35dbae`, net of unrelated files |
| `oxc-parser` transitive | confirmed, sharpened | optional dependency of `@shadcn/lint`; no manifest lists it |
| Schema sketches | not verified | not compiled, here or by the author |
| Coverage re-measure, schema-first keys under line shifts | not verified | unchanged |

Omitted by the author: the 2026-10-21 GritQL-first ruling (section 2 now states why this departs from it), and
that the oxlint end state is silenced by a file-level disable comment, so the scanner must reject directives naming the rule
(`lint.md`, section 2).

Verdict: the recommendation survives. Delta plus pending scopes is still the only option that keeps no comment
inventory and does not collide. It needs five changes before it is buildable: (1) resolve export specifiers
before banning `jsdoc-local`; (2) strict directive, licence and generated grammars; (3) PR-scoped lock, whole tree
on main; (4) `--event-base`, not a fetched ref; (5) a line tier that cannot recombine lines across groups.
