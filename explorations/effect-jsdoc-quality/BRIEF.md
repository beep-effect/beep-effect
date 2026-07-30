# Brief

<!--
Stage 3. Shaped and grilled: the 2026-07-30 /grill-with-docs session resolved
every open axis (see DECISIONS.md). This brief is the human-aligned pitch the
graduated goal packet implements.
-->

## Problem

beep-effect's JSDoc is mechanically complete — every one of ~18k exports has
a compilable `@example`, `@category`, `@since`, gated by a required ratchet —
yet hovers don't teach. A 20-sample audit found 60% trivial examples, zero
`// Output:` annotations, and `@see` effectively unused (75 repo-wide).
Effect v4 hovers teach because their conventions are a machine-enforced
grammar (sections, titled examples, described resolved links). The grammar is
reverse-engineered to path:line precision in `research/`, the WebStorm
hover-fidelity evidence is in, and all decisions are grilled — a goal can
implement without re-mining anything.

## Appetite

One goal packet, roughly two weeks of focused work including a 2-3 package
pilot. Not a repo-wide migration — the ~18k-export surface is explicitly out
of appetite; enforcement is ratchet-on-touch.

## Solution Sketch (decided — DECISIONS.md 2026-07-30)

1. Rewrite `.patterns/jsdoc-documentation.md` + the
   `jsdoc-annotation-specialist` skill: `**When to use**` / `**Details**` /
   `**Gotchas**` / titled `**Example**` sections; described-`@see` (day-one);
   `@remarks` retired (cleanup-on-touch); hygiene fixes ride along
   (tsdoc.json `@module`/`@template`, line-847 bug, stale skill paths).
2. Port ~6-8 `Jsdocs.ts` grammar semantics as new `jsdoc-inventory` rules,
   shape-checked opt-in (sections optional, validated when present), riding
   the existing fail-on-growth baseline. `{@link}` resolution deferred to a
   follow-on goal.
3. Example carrier B2 transitional: `**Example** (Title)` sections canonical;
   `@beep/docgen` harvests both carriers (tag path + section fences via
   existing `extractFencedCodeBlocks`); compile validation preserved;
   presence law becomes kind-aware (value-level exports require an Example;
   pure type-level exports prose-only).
4. Pilot trio — `foundation/modeling/schema` + a tooling package + a
   law-practice values slice; acceptance = before/after WebStorm hover
   screenshots against the Effect reference hovers.

## Rabbit Holes

- Markdown-section parsing inside ts-morph comment text (fence-aware, not
  regex-naive) — the validator's real complexity.
- `@remarks` migration: 491 existing uses; cleanup-on-touch only, never bulk.
- Kind-aware example rule: symbol-kind classification must match docgen's
  view of exports or the two gates will disagree.
- Category vocabulary leakage (113 live values vs 80 canonical) — a separate
  repair; do not let it infect this goal.

## No-Gos

- No mass rewrite of existing JSDoc; ratchet-on-touch only.
- No dependency on `@effect/jsdocs` (private upstream package).
- No `@example` ban without the docgen section-harvest landing first.
- No real-semver `@since`; `0.0.0` policy stands.
- No named-import example rule (repo namespace-import law wins).
- No `{@link}`/`@see` target resolution in this goal (follow-on).
- No `standards/architecture/DECISIONS.md` ADR (documentation law, not
  architecture doctrine).
- No website/Jekyll chrome; LLMS-corpus analog is a separate future goal.
