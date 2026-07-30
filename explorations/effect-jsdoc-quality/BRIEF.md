# Brief

<!--
Stage 3 artifact, DRAFTED EARLY as grill preparation (stage is still
`research`): /grill-with-docs interviews against a concrete plan, so this
draft is the interview input. The human has NOT signed off; every section is
provisional until DECISIONS.md records the grill outcomes.
-->

## Problem

beep-effect's JSDoc is mechanically complete — every one of ~18k exports has
a compilable `@example`, `@category`, `@since`, gated by a required ratchet —
yet hovers don't teach. A 20-sample audit found 60% trivial examples, zero
`// Output:` annotations, and `@see` is effectively unused (75 repo-wide).
Effect v4 hovers teach because their conventions are a machine-enforced
grammar (sections, titled examples, described resolved links). The gap is
enumerable and portable; what's missing is a decision on carrier, hardness,
and scope. Why now: the grammar was just reverse-engineered to path:line
precision (`research/` legs), so a later goal can implement without
re-mining Effect.

## Appetite

One goal packet, roughly two weeks of focused work including a 2-3 package
pilot. Not a repo-wide migration — the ~18k-export surface is explicitly out
of appetite; enforcement must be ratchet-on-touch.

## Solution Sketch (= `research/options.md` Option B, pending grill)

1. Rewrite `.patterns/jsdoc-documentation.md` + `jsdoc-annotation-specialist`
   skill: adopt **When to use** / **Details** / **Gotchas** / titled example
   sections, described-`@see`; resolve the `@remarks` collision; keep
   namespace-import and `@since 0.0.0` laws.
2. Port ~6-8 `Jsdocs.ts` grammar semantics as new `jsdoc-inventory` rules
   riding the existing fail-on-growth baseline (no new CI lane).
3. Example carrier per grill: B1 (keep `@example` tag) or B2 (`**Example**`
   sections + teach `@beep/docgen` to harvest description fences — verified
   localized). Either way example compilation is preserved.
4. Pilot on `foundation/modeling/schema` + one tooling package + one
   law-practice slice; acceptance = before/after WebStorm hover screenshots.
5. Fast-track regardless: described-`@see` convention.

## Rabbit Holes

- Markdown-section parsing inside ts-morph comment text (fence-aware, not
  regex-naive) — the validator's real complexity.
- `@remarks` migration: 491 existing uses; grandfather vs migrate decides
  churn.
- `{@link}` resolution needs a checker program — most expensive rule; stage
  last or defer to a follow-on goal.
- Category vocabulary: 113 live values vs 80 canonical (`models` = 43%) — a
  separate repair, do not let it infect this goal.

## No-Gos

- No mass rewrite of existing JSDoc; ratchet-on-touch only.
- No dependency on `@effect/jsdocs` (private upstream package).
- No `@example` ban without a compile-validation story (Effect's regression).
- No real-semver `@since`; `0.0.0` policy stands.
- No named-import example rule (repo namespace-import law wins).
- No website/Jekyll chrome; `LLMS.md`-style corpus is a separate future goal
  (Option D).
