# Decisions locked

Nine decisions, locked in the `JSDOC_CODEMOD` grill session on 2026-08-06. Each records what was
chosen, why, and what was rejected. Reopening one should require new evidence, not new preference.

## D1 — Carrier retirement, not a quality rewrite

Convert `@example` → `**Example** (Title)` and `@remarks` → `**Details**`/`**Gotchas**`,
preserving prose and example code **verbatim**.

**Why.** It is compile-neutral (D-fact below), mostly deterministic, and removes both the gate
landmine and the bad exemplars in one move. A quality rewrite would put ~13,600 model-authored
code blocks into the docgen compile gate as new code.

**Rejected.** Full quality rewrite (rewrite leads, make examples observable) — scope explosion
and compile risk. Ranked-subset quality tier — killed by the correction that the JSDoc laws are
agent-facing, so there is no subset of the corpus that matters less.

## D2 — Grok returns data only; the codemod writes every file

The pipeline extracts blocks, Grok returns a JSON map of `anchor → { title, remarks, leadEnd }`,
and the codemod applies it.

**Why.** A bad model output becomes a bad string, never a broken file or a lost doc block.
Deterministic titles were rejected because 13,209 formulaic titles would install a *new* bad
exemplar teaching agents that Example titles are filler — the exact failure this initiative exists
to end.

**Rejected.** Deterministic titles (formulaic at corpus scale). Grok agents editing files
directly (a hallucinated rewrite silently destroys documentation; unbounded blast radius).

## D3 — Four PRs; the mega-PR is regenerated, never rebased

P0 law + packet, P1 codemod, P2 generators, P3 the 1,935-file migration.

**Why.** A deterministic codemod plus frozen data files makes P3 re-derivable: on conflict,
re-run against fresh `main` and replace the branch. Conflicts stop being a merge problem. This
property is forfeited by a single hand-edit, which is why D9 exists.

**Rejected.** Per-family sequence (~10 merge gauntlets at the full required-check count, and the
gate stays hot until the last one lands). Single all-in-one PR (buries the codemod — the only
part worth reviewing — inside the diff nobody reads). Stacked PRs (a non-`main` base runs a
fraction of the required checks).

## D4 — Transform = carrier + deterministic free wins + Grok semantic routing

Beyond the carrier swap: `@template`→`@typeParam`, `@module`→`@packageDocumentation`,
`@default`→`@defaultValue`, `{type}` blob removal, `@returns`/`@throws` hyphen, canonical tag
order, lead splitting, `@see` purpose phrases.

**Why.** `firstSectionLine` (`JSDocDocumentationInventory.ts:453`) computes the lead as everything
before the first section marker, so inserting sections *moves the boundary* and can clear
`multiple-description-paragraphs`. And Grok is already reading each block to write a title —
returning a section routing and a lead split point in the same call costs a few extra output
tokens on ~1,400 of 13,265 blocks.

**Rejected.** Carrier-only (leaves 872 multi-paragraph leads and the grammar findings, requiring a
second migration later). Repo-wide grammar sweep including the ~4,600 untouched blocks (materially
larger diff, touches files the gate never flagged).

## D5 — Per-block conservation law, exhaustive, two clauses

Content conservation (fence code bytes identical, prose tokens preserved, added prose limited to
section markers and data-sourced strings) plus a closed tag-rewrite allowlist. Everything outside
the allowlist is bytes-identical. Violations quarantine. Full contract: SPEC §5.3.

**Why.** Every other gate gets *happier* when content silently disappears — totals drop, examples
still compile, shape stays valid. Conservation is the only check that catches a drop, and a
1,935-file diff will not be read by a human. Sampling was rejected because a systematic bug in a
rare block shape could go entirely unsampled.

**Rejected.** Inverse round-trip to byte-exact original (strictly stronger, but two transforms to
maintain and an artifact that can drift). Fingerprint manifest plus sampled review (cheapest,
but accepts a blind spot exactly where a codemod bug would live).

### Amendment 2026-08-06 — the original wording contradicted D4

As first written, D5 asserted `tags[i] bytes-identical` with additions limited to three section
markers. That is incompatible with D4, which puts `@template`→`@typeParam`,
`@module`→`@packageDocumentation`, `@default`→`@defaultValue`, `{type}` removal,
`@returns`/`@throws` hyphen fixes, canonical tag reordering, and `@see` purpose phrases **in
scope**. Under the original letter, every block containing a grammar target would have quarantined
instead of being fixed, and `@see` purpose phrases would have been forbidden prose.

Both decisions were locked in consecutive grill questions and never reconciled against each other.
Three independent reviewers on PR #576 flagged it (clawhole `bug`, Greptile P1 ×1, plus the GOAL
mirror) before any implementation existed.

**Resolution:** keep D4 intact and split D5 into the two clauses above, rather than reverting to
carrier-only or deferring grammar fixes to a second pass. The safety property D5 exists to
guarantee — you cannot silently destroy documentation — lives entirely in the content clause. The
tag clause was never load-bearing for that property; it was over-broad phrasing that happened to
forbid the transforms D4 requires.

**Lesson for the remaining decisions:** a locked decision is only as good as its consistency with
its neighbours. When one decision constrains what another permits, state the interaction
explicitly in both places. GOAL.md now carries an explicit "do not restate this as tag bodies
identical" warning for exactly this reason.

## D5b — Anchors are `path#symbol#ordinal`

Added 2026-08-06 from PR #576 review (Greptile P1).

`path#symbol` is **not unique**. Overloads, declaration merging, default exports, and same-name
type companions for runtime schemas all produce multiple documented declarations sharing a name —
and `.patterns/jsdoc-documentation.md` names that companion pattern as documented law, so it is
common rather than exotic. Two blocks sharing an anchor means the title map applies one block's
title to another, or per-anchor resume silently skips one.

`ordinal` is the 0-based index among blocks resolving to the same `path#symbol`, in source order;
`0` in the common unique case. It is stable under edits elsewhere in the file (unlike line
numbers) and under edits to the block itself (unlike content hashes).

**Why this needed its own decision.** The conservation law cannot detect the failure. A title
applied to the wrong block is well-formed prose in a valid section and passes every assertion in
§5.3. That is why SPEC §7 gained a dedicated verification row: `extract` must fail loudly on a
duplicate anchor rather than resolving it silently.

### Amendment 2026-08-06 — ordinals are not stable under reorder

The first version of D5b said ordinals shift only when a same-named declaration is added or
removed ahead of a block. **Reordering** shifts them too, and it is the worst case: the anchor set
is unchanged and the record count still matches, so nothing about the data's shape looks wrong
while a frozen title binds to a different block. Both reviewers on PR #581 caught it (Greptile P2,
clawhole `reliability`) within an hour of D5b landing.

Because `titles.jsonl` and `overrides.jsonl` freeze when P3 opens, a later `extract` renumber can
mis-bind silently. Anchor uniqueness alone is therefore not sufficient — it makes each anchor
resolve to one block within a single `extract`, but says nothing about whether a *frozen* record
still belongs to the block its anchor now names.

**Resolution:** records carry `sourceHash` (hash of the original block bytes at extract time) and
`kind`, and `apply`/`verify` fail closed unless frozen records biject with `extract`, every
`sourceHash` matches, and every `kind` agrees. Bijection catches add/remove via count divergence;
the hash catches reorder and in-place edits where counts still match.

**The distinction that makes this work:** an anchor is for *addressing* and must stay stable, so
it can never be a content hash. A `sourceHash` is for *verification* and must be exact. Using a
hash to address would destroy re-derivability; using one to verify is what makes freezing safe.
The two are not in tension once separated.

This also composes with D3's regeneration model instead of fighting it: re-deriving P3 against a
newer `main` fails the identity check exactly on blocks whose documentation changed upstream,
which get re-titled, while everything untouched reuses its frozen record.

**Pattern worth noticing.** This is the third defect in the same family — the first was
conservation-vs-grammar, the second was anchor collision, this is anchor drift. All three share a
shape: a check that passes while the underlying binding is wrong, because the output is
*well-formed*. Well-formedness is not correctness, and no amount of shape validation substitutes
for verifying identity. Assume the next defect in this packet has the same shape and look for it
there first.

## D6 — Placement: `packages/tooling/tool/cli`, `beep quality jsdoc-migrate`

Decided rather than asked; reversible.

**Why.** Consistency: the `jsdoc-*` command family already lives there (`jsdoc-inventory`,
`jsdoc-quality`, `jsdoc-ratchet`, `jsdoc-module-tags`). Colocation lets
`documentationShapeViolations` be exported *within* the package instead of becoming a
cross-package public surface. A new package would trigger four governance gates.

## D7 — Fix generators first, in their own PR

**Why.** All 18 generated files come from repo-owned generators. Migrating their output without
fixing the emitters plants a mine: the next `bun run generate` reverts the migration and fails the
ratchet for an author who merely regenerated a driver.

**Rejected.** Generators inside P3 (buries real template logic in the mechanical diff — the same
mistake avoided by splitting out P1). Excluding generated files from the inventory (cheapest and
arguably correct doctrine, but leaves 1,065 legacy exemplars in code agents read, contradicting
the agent-facing-laws principle). Migrating output only (the codegen mine).

## D8 — Title pass is a repo pipeline step against the local proxy

`beep quality jsdoc-migrate titles` calls `http://127.0.0.1:8317` with model `grok-4.5` via
`effect/unstable/http`, appending to `titles.jsonl` with per-anchor resume.

**Why.** The proxy is what bills the Grok plan rather than API credits — a direct xAI API call
would defeat the purpose. A native Workflow caps at 1,000 agents per run and one call per file is
1,935. A script has no cap, resumes per anchor rather than per run, and keeps the whole
extract→titles→apply→verify pipeline in one place.

**Rejected.** `claudeg` Workflow batched at ~4 files per agent (~490 agents; fits the cap, but
adds harness overhead to a pure data transform and resumes per run). Workflow split across
multiple runs (manual bookkeeping, highest spend). Extending `packages/drivers/xai` (driver
surface growth for a one-shot migration).

## D9 — Residue is data; gate, law, and baseline flip inside P3

Quarantined blocks are resolved into `overrides.jsonl` carrying full replacement block text,
consumed exactly like `titles.jsonl`.

**Why.** Fixing residue by hand on the P3 branch would forfeit the regenerability locked in D3 —
the conflict this decision exists to resolve. As data, the branch stays
`f(main, codemod, titles.jsonl, overrides.jsonl)`, the corpus reaches zero, and the gate swap,
baseline rewrite, and final law state can all land atomically with the migration.

**Rejected.** P3 mechanical-only with a follow-up P4 cleanup (corpus non-zero between PRs, extra
gauntlet). Keeping cleanup-on-touch after migration (leaves git-diff work in every CI run to
detect a condition that can no longer occur). Widening conservation to permit fences (would fold
the 114 unfenced examples in, but puts 114 never-compiled code bodies into the docgen gate inside
the mega-PR).

## Load-bearing facts behind these decisions

**Both carriers already compile.** `docgen/src/Core.ts:360-376` extracts `descriptionExamples`
*and* `exampleTagExamples` and compiles both. Conversion is compile-neutral. Without this, D1 and
D3 would both be untenable.

**The gate scorer is reusable as an oracle.** `documentationShapeViolations`
(`JSDocDocumentationInventory.ts:439`) makes per-block regression decidable.

**Zero collision hazards.** No block mixes a legacy carrier with the section form of the same
concept, so neither duplicate sections nor title collisions are reachable.
