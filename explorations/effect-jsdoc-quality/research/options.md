# Options: closing the JSDoc quality gap (pre-grill)

Dated 2026-07-30. Four candidates, minimal → ambitious. Recommendation up
top per repo convention; nothing here is decided — `/grill-with-docs`
resolves the axes at the end.

## Recommendation

**Lead with Option B** (grammar port, compile validation preserved,
ratchet-on-new). It ports the only thing Effect actually has that we lack —
the machine-checkable section grammar — while keeping the two things we have
that Effect lost or never had: example compilation and CI teeth. Options A
and C exist to bracket B at the grill; D is future-goal material.
Independent of the winner: **fast-track the described-`@see` convention**
(cheapest, highest-visibility change; needs no grammar debate).

## Option A — Convention-only (floor)

- **Change:** rewrite `.patterns/jsdoc-documentation.md` + the
  `jsdoc-annotation-specialist` skill to adopt sections
  (**When to use** / **Details** / **Gotchas** / titled examples) and
  described-`@see`; resolve the `@remarks` collision. No tooling.
- **Ratchet story:** none.
- **Effort:** S (days).
- **Evidence against it standing alone:** in this repo, unenforced
  conventions hit zero adoption — `@precondition` 0, `@throws` 0,
  `@postcondition` 0 despite 900+ lines of law and registered tags.
- **Keep because:** every other option contains it; it is step 1 of B and C.

## Option B — Grammar port, compile validation preserved (RECOMMENDED)

- **Change:**
  1. Option A's law + skill rewrite.
  2. ~6-8 new `jsdoc-inventory` rules porting `Jsdocs.ts` semantics
     (diff §8 ADD rows): description shape, section order/emptiness/dupes,
     When-to-use prefix, example title+uniqueness+fence rules, described-@see,
     tag order. `{@link}` resolution (A9) staged last or deferred — the only
     rule needing a checker program.
  3. New rule codes ride the existing fail-on-growth baseline
     (`jsdoc-totals.regression-baseline.jsonc`) — **ratchet-on-new/touched
     code, no retroactive sweep of ~18k exports**.
  4. Pilot: 2-3 packages rewritten by `jsdoc-annotation-specialist`
     (proposal: `packages/foundation/modeling/schema` + one tooling package +
     one law-practice slice, which already grew titled examples organically);
     acceptance = before/after WebStorm hover screenshots.
- **Sub-decision for the grill (example carrier):**
  - **B1 — keep `@example` tag** as the carrier, add section grammar around
    it. Zero docgen change; hover renders both (lab probe confirms); slight
    divergence from Effect's look (tag row instead of bold heading).
  - **B2 — move to `**Example** (Title)` sections**, teach
    `@beep/docgen` `Parser.ts` to harvest description fences
    (`extractFencedCodeBlocks` already exists in `Core.ts:268` — verified
    localized change), keep `tsc --noEmit`. Closer to Effect's look; touches
    docgen + the mandatory-`@example` law + inventory presence checks.
- **Ratchet story:** advisory first run → fold new codes into the baseline →
  required lane unchanged ("JSDoc Ratchet" already required).
- **Effort:** M (1-2 weeks incl. pilot).
- **Risks:** markdown-section parsing subtleties in ts-morph comment text;
  pilot scope creep; `@remarks` migration ambiguity (existing 491 uses).

## Option C — Full validator + migration (ceiling)

- **Change:** dedicated `beep quality jsdoc-grammar` at `Jsdocs.ts` parity
  including resolved links; ban `@example` (full B2); migrate all ~18k
  exports via codemod + agent passes; hard-required from day one.
- **Effort:** XL (multi-week, all-package churn).
- **Against:** we would enforce harder than Effect enforces on itself (their
  CI doesn't fail on grammar violations; their own adoption is 19-99%);
  review noise swamps signal; conflicts with parallel in-flight work.
- **Keep because:** the grill should consciously reject or stage it, not
  never see it.

## Option D — Pedagogy infrastructure (park as future goals)

Orthogonal to "looks like Effect"; each item is a separate goal candidate:

- Wire `deterministic-rubric-v1` into an **advisory** CI lane (15 codes exist
  today, zero teeth).
- LLM example-quality scoring per `goals/jsdoc-worker-eval` verdicts
  (hosted codex candidate-baseline; advisory-only; write-mode explicitly
  non-goal per its SPEC).
- `runExamples` pilot (runner exists, one config flag) to make `// Output:`
  comments verified claims.
- `ai-docs/`-style typechecked LLM corpus → generated `LLMS.md` analog.
- Category vocabulary repair: 39 non-canonical values / 511 occurrences
  normalize to alias/unknown today; either extend the 80-slug LiteralKit or
  remediate — plus split the 43% `models` monolith with navigational
  sub-categories.

## Grill decision axes (mapped to evidence)

| Axis | Evidence | Proposed default |
| --- | --- | --- |
| Keep/evolve `@beep/docgen` vs adopt Effect stack | Theirs: private, diagnostics-without-teeth, example compilation dead | Keep ours; port semantics only |
| Section enforcement hardness | Unenforced = 0 adoption here; hard-gate = churn; Effect target-state ≠ actual-state | Ratchet-on-touch via existing baseline |
| Every-export compilable example | Schema.ts 14% + our 60%-trivial sample: presence ≠ pedagogy | Keep presence law BUT re-examine per symbol kind; tighten quality on what exists |
| Example carrier | B1 zero-tooling vs B2 Effect-look (verified-cheap docgen change); hover lab probe compares directly | Decide at grill with lab results |
| Pilot scope | foundation/modeling/schema (highest reuse), tooling (already eslint-strict), law-practice (organic precedent) | 2-3 packages, hover-screenshot acceptance |
| Inventory/ratchet relationship | New codes ride existing fail-on-growth baseline + required lane | No new CI lane needed |
| Law changes | `@remarks` collision (:183-186); tag order rework; described-@see; `@since` stays `0.0.0`; import-style divergence from Effect stays | Rewrite pattern doc once, at goal start |
