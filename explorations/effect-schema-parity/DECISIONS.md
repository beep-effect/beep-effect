# Effect Schema Parity — Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

Pre-research grill, 2026-09-12, run with `/grill-with-docs` from the WebStorm
scratch before any RESEARCH.md existed. These entries are the operator's
locked intent; the align stage ratifies or revises them once research has
produced the knowledge layer and the candidate lists.

## 2026-09-12 — Comparison baseline

**Question:** What is the "before"? The brief asked for a pre-rc.112 checkout
compared against main, but the repo is already on rc.115.

**Answer:** Audit beep-effect's schema usage directly against effect main.
Use `git diff effect@4.0.0-rc.112..main` (28 schema-relevant commits) only as
a "recently changed, look here first" hint list. No clone, no checkout;
`.repos/effect` already tracks main with every tag.

**Rationale:** A version changelog misses idioms that predate rc.112 and were
never adopted. Rejected: strict rc.112 to main changelog first; snapshot
c8349ed to main (three days of upstream, already absorbed by the rc.113/115
bumps).

## 2026-09-12 — Packet shape

**Question:** The brief bundles four wants (upstream delta, queryable
knowledge base, repo-wide idiom migration, `@beep/schema` deletions). One
packet or several?

**Answer:** One exploration packet graduating into exactly one goal, phased
internally.

**Rationale:** Operator's call; the recommendation was one exploration
graduating into three goals (knowledge + gate, retirements, idiom campaign).
Rejected: knowledge base first with the rest deferred; a single packet doing
everything end to end without graduating.

## 2026-09-12 — Knowledge layer

**Question:** How is the per-symbol "queryable knowledge" produced, and how
does it serve both agents and a hosted gate when graft indexes are
git-ignored and `.repos/effect` is machine-local?

**Answer:** Hybrid, graft-led. (1) `graft build --only-dir packages/effect/src`
inside `$HOME/YeeBois/dev/effect` (structural, no LLM key) so agents query it
with `graft ask "<q>" --source <effect-dir>` and a second `graft mcp
<effect-dir>` server. (2) A repo script emits one sha-pinned JSONL row per
exported schema-relevant symbol (module, name, kind, signature, JSDoc
sections, examples, since, sha), committed as a repo-cli test fixture like
`effect-vitest-rc115`, and re-pinned on every effect bump. Sub-agent prompts
are templated from those rows; nobody hand-copies JSDoc.

**Rationale:** Mechanical extraction is deterministic and cheap; agent quota
is spent on judgment. The committed inventory is what lets the gate run
hosted. Rejected: sub-agent-authored per-module documents (drift on every
bump, quota spent on transcription); graft-only with a local-only gate
(contradicts the standing-gate close condition); pulling effect into this
repo's graft with `--follow-nested-repos` (476+ upstream files rank alongside
repo code; freshness churn on every fetch).

## 2026-09-12 — Equivalence test for retirement

**Question:** "If effect ships it, delete ours" needs a test for "ships it";
name overlap is weak evidence.

**Answer:** Same intent is enough. When upstream covers a concept's intent,
retire the `@beep/schema` concept and adapt every consumer to whatever
upstream offers, accepting behaviour changes.

**Rationale:** Operator's call, taken over the recommendation (retire only
when the concept's existing test suite passes against the substituted
upstream symbol, with narrowings recorded). Recorded risk: silent semantic
drift across 2,508 importing files, and some upstream surfaces are plain
value modules with no schema (`HttpStatus`, `HttpMethod`, `Url`), so "same
intent" will sometimes mean adopting a non-schema surface. Rejected: a thin
`@beep/schema` re-export alias (contradicts "delete entirely").

## 2026-09-12 — Goal closing condition

**Question:** "One goal" must close, but "new and going forward" is a
standing property.

**Answer:** The goal closes when a standing gate exists and the backlog it
found is zero. It ships (a) the knowledge layer, (b) an upstream-parity
detector lane fed by the inventory, and (c) drives that lane's findings to
zero. "Going forward" is the lane on every effect bump, not an open goal.

**Rationale:** Rejected: closing on the 56 listed modules and the retirement
PRs only (no automation, drift returns); a rolling campaign goal (conflicts
with packet lifecycle laws and same-PR closeout).

## 2026-09-12 — Performance

**Question:** "Optimizing schema performance at all costs": which
performance, and does it override readability and doctrine?

**Answer:** Type-check cost first (tsc/type-instantiation; the repo has a
TS2589 flake class and heavy `@beep/schema` docs), runtime decode/encode on
hot paths second (Result/sync codec APIs). Every change carries a
before/after number; no readability regression without one. "At all costs"
becomes "no unmeasured cost". Upstream lead: `657254b821` "Optimize Schema
initialization (#8196)".

**Rationale:** Rejected: runtime decode only; no performance lane.

## 2026-09-12 — Module list roles

**Question:** The 56 listed paths mix core schema modules with http/ai/rpc/
sql/encoding/net/observability/devtools modules. Same role?

**Answer:** No. Role A (adoption surfaces): `Schema*`, `JsonSchema`,
`VariantSchema`/`Model`, `Arbitrary`, `StandardSchema`, `SCHEMA.md`,
`migration/schema.md`. Role B (idiom exemplars): everything else, mined for
how effect's own authors compose schemas (annotations, class patterns, error
modelling, encoding boundaries) to form the idiom rubric for the repo-wide
audit. B modules are not adoption targets.

**Rationale:** Rejected: all 56 as adoption surfaces (broadens into http/ai/
rpc parity that rules and other packets already cover); dropping B (loses
the exemplar mining the "idiomatic, precise, clean" intent depends on).

## 2026-09-12 — Orchestration lane

**Question:** Which lane runs the "maximally optimized specialized
sub-agent prompts"?

**Answer:** Codex exec lanes (`codex exec --model gpt-6-astra`, `medium`
effort per repo `AGENTS.md`), one per Role A module or `@beep/schema`
concept, each prompt generated from the inventory rows plus graft output for
that module, each writing a findings file into the packet. Fable orchestrates
and judges. The Codex pool is available again as of 2026-09-12 (second
ChatGPT subscription).

**Rationale:** Preserves the scarce Fable weekly limit per the delegation
rules. Rejected: native Workflow children under `claudex` (same pool, plus
5-hour session-limit deaths); Fable `Agent` subagents (forbidden for bulk
work).

## 2026-09-12 — PR batching

**Question:** `@beep/schema` is imported from 2,508 files; Yeet caps
base-delta capture at 512 KiB and squash merges drop late pushes. How do
retirements ship?

**Answer:** One PR for everything, regardless of size: retirements, consumer
migrations, idiom fixes, and the gate at zero.

**Rationale:** Operator's call, taken over the recommendation (one PR per
retired concept with all its consumers). Precedent: #1060 migrated ~830 files
in one PR. Plan around: merge main early and often against the 512 KiB
capture cap, use the manual `gh pr` route for very large path counts, and
never push after the squash. Rejected: one PR per consumer package then a
final deletion PR (the old module lingers as a de facto deprecation window);
one PR per upstream module family.

## 2026-09-12 — Gate home

**Question:** Where does the standing parity gate live?

**Answer:** A new `UpstreamParity*` detector family inside the existing
`schema-first` lint command, next to `SchemaFirstDetectors.ts`, driven by
the committed JSONL inventory under the repo-cli test fixtures, with its own
inventory file so its floor ratchets independently. Every effect bump re-pins
the fixture exactly like the effect-vitest procedure.

**Rationale:** Reuses store, ratchet, scan, and grouped-finding machinery.
Rejected: a separate `lint:upstream-parity` lane (duplicates machinery, adds
to the lane-economics budget); a `graft check`-style freshness script only
(catches staleness, not reintroduced hand-rolling).

## 2026-09-12 — Doctrine surface

**Question:** "Same intent, delete and adapt" generalises to an upstream-first
rule for `foundation/modeling`. Where is it recorded?

**Answer:** A `standards/architecture/DECISIONS.md` entry (upstream-first for
`foundation/modeling`, precedent 2026-07-08 upstream PGlite) plus the
operational rule in the `@beep/schema` README: a concept is retired the
moment upstream covers its intent, in the same PR as its consumer migration.
Written in the goal, not now.

**Rationale:** Architecture-wide, hard to reverse, resolves a real tradeoff,
so it meets the DECISIONS bar. Rejected: README only (other foundation
packages keep hand-rolling); record nothing until the first retirement lands.

## 2026-09-12 — Deliverable of this session

**Question:** What is produced now?

**Answer:** The WebStorm scratch rewritten in place as a decision-annotated
kickoff prompt, and this packet seeded at stage 0 with the original brief
verbatim and this grill. Nothing committed.

**Rationale:** Rejected: scratch rewrite only; a sibling clarified scratch
with the original untouched (provenance now lives in CAPTURE.md instead).
