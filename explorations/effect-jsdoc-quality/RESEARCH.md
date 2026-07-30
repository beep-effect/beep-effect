# Research

## External Landscape

### 2026-07-30 — Effect v4 JSDoc grammar & docs pipeline (leg: `research/effect-doc-pipeline.md`)

Effect v4's hover quality is the output of a machine-enforced grammar
(`@effect/jsdocs`, private, ~30 diagnostics): one-paragraph description →
**When to use** ("Use to/when/as/with" openers) → **Details** → **Gotchas** →
titled **Example** sections with exactly one fence → a 5-tag whitelist in
fixed order, with `{@link}` targets resolved against a real checker program.
`@example` is forbidden upstream — and in that swap v4 **lost example
typechecking entirely** (the old docgen compile machinery idles against zero
tags). Their validator also does not fail CI (diagnostics gated behind a
`--check` flag nobody passes). Classic `@effect/docgen` still generates the
website markdown; a hand-authored, typechecked `ai-docs/` tree generates the
committed `LLMS.md`. Full map with citations in the leg file.

### 2026-07-30 — Effect vs beep diff + adoption reality (leg: `research/diff-effect-vs-beep.md`)

The two systems optimize opposite halves: beep enforces presence+compilation
with real CI teeth; Effect enforces pedagogy with no teeth and no compiler.
Effect's own adoption is uneven (When-to-use 99% in Option.ts → 19% in
Stream.ts; examples on only 14% of Schema.ts exports), which reframes
"Effect-level" as their *target* state and argues for ratchet-on-touch here.
One hard conflict found: Effect requires named imports in examples; our
repo law requires namespace imports (`import * as S`) — ours wins.

## In-Repo Capability Inventory

Full table with dispositions in `research/SOURCES.md` §4. Highlights:

- `@beep/repo-docgen` (`packages/tooling/tool/docgen/`) — compiles examples
  via `tsc --noEmit`, and (correction 2026-07-30, surfaced by Codex review on
  PR #516) ALREADY harvests description fences alongside `@example` tag
  fences (`Core.ts:319-338` via `extractFencedCodeBlocks`) — so the B2
  carrier needs a regression fixture, not new harvesting; `runExamples`
  exists, default false.
- JSDoc inventory (12 mechanical ts-morph rules) + fail-on-growth ratchet +
  required "JSDoc Ratchet" CI lane — the enforcement chassis new grammar
  rules ride on.
- `deterministic-rubric-v1` (15 example-quality finding codes) — advisory
  only, wired to no CI lane.
- 80-slug `JSDocCategories` LiteralKit + alias/reject normalization — but
  live source carries 113 distinct values (39 non-canonical, 511
  occurrences, `models` alone is 43% of all categories).
- Prior art: `goals/jsdoc-worker-eval` (LLM scoring verdicts + reusable
  packet contract; write-mode explicitly non-goal),
  `goals/repo-codegraph-jsdoc` tag-exhaustiveness audit (tag database with
  `ASTDerivability`, category taxonomy — untypechecked, port-to-LiteralKit
  if used), `goals/quality-gate-ratchets` (ratchet pattern).
- Organic precedent: law-practice value models already write bold
  `**Example**` headings (3 of 20 sampled examples).
- NOT FOUND: any section-grammar rule, any `{@link}` resolution check, any
  described-`@see` convention (verified — "When to use" appears nowhere in
  `.patterns/jsdoc-documentation.md`).

## Constraints Discovered

- `@remarks` collision: current law routes details/gotchas semantics into
  `@remarks` (`.patterns/jsdoc-documentation.md:183-186`); Effect's grammar
  puts them in description-body sections. One must win before any validator
  ships (491 existing `@remarks` uses to migrate or grandfather).
- Import-style divergence: Effect's named-import example rule contradicts
  the repo-wide namespace-import law — we keep ours; do not port
  `example-import-style` as-is.
- `@since` semantics: real semver requires release history we don't have;
  the `0.0.0` placeholder policy stands (grill to confirm).
- Unenforced conventions historically hit zero adoption here
  (`@precondition`/`@postcondition`/`@throws` all 0) — Option A alone is
  evidence-refuted.
- Public repo: reference screenshots stay local-path-only in `CAPTURE.md`.
- Exploration discipline: no mass JSDoc edits, no `goals/` packet before
  `/grill-with-docs`.

## Synthesis

"Effect-level for beep" = **their grammar + our compiler + our ratchet**.
The gap is precisely enumerable (diff §8): ~14 Effect diagnostics have no
beep counterpart, of which ~6-8 are cheap inventory rules; example *quality*
(60% trivial in our n=20 sample) already has a detector
(`deterministic-rubric-v1`) that just lacks CI wiring; cross-linking is the
cheapest visible win (75 `@see` repo-wide → described-`@see` convention).
Everything else is editorial craft that belongs in the pattern doc's
exemplars and the annotation skill, not in CI. Options bracketed in
`research/options.md` (lead: Option B); operational rubric in
`research/quality-rubric.md`; six decision axes staged for
`/grill-with-docs`.
