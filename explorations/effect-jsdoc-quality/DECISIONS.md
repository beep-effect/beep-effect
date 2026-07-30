# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Grill session 2026-07-30 (`/grill-with-docs`, live with the
human) resolved all twelve; evidence lives in `research/*` and the hover-lab
eyeball (five WebStorm screenshots of `scratchpad/jsdoc-hover-lab.ts`,
local-only). openQuestions in ops/manifest.json emptied accordingly.
-->

## 2026-07-30 — hover-lab evidence (context for the entries below)

The user hovered the five probes in `scratchpad/jsdoc-hover-lab.ts` in
WebStorm: body-section markdown renders at full Effect fidelity (bold
headings, bullets, highlighted fences, ASCII arrows, `// Output:`); the
`@example` tag body renders as a degraded verbatim box (caption trapped,
literal ```ts markers visible); `@remarks` renders with its heading collapsed
onto the tag row; custom tags `@effects`/`@precondition` DO render as
"tag — text" rows; described `@see` and inline `{@link}` render fully.

## 2026-07-30 — overall approach

**Question:** Convention-only (A), grammar port + ratchet (B), full validator
+ migration (C), or B-then-C staged?

**Answer:** Option B — grammar port + ratchet.

**Rationale:** A is evidence-refuted (unenforced conventions here hit zero
adoption: `@precondition`/`@throws` = 0). C would enforce harder than Effect
enforces on itself (their CI never fails grammar; their adoption is 19–99%)
at ~18k-export churn. B ports the only thing Effect has that we lack — the
machine-checkable grammar — while keeping example compilation and CI teeth.

## 2026-07-30 — example carrier

**Question:** Keep `@example` tag (B1) or `**Example** (Title)` sections (B2),
and how do 16,604 existing tags transition?

**Answer:** B2 transitional — sections canonical for new/touched code;
`@beep/docgen` harvests BOTH carriers; presence = section OR grandfathered
tag; existing tags migrate cleanup-on-touch; no mass codemod.

**Rationale:** Hover lab was decisive — the tag body renders degraded in
WebStorm while body sections render like Effect's. Harvest change verified
localized (`extractFencedCodeBlocks` exists, `Core.ts:268`; harvest point
`Parser.ts:163`). Compile validation preserved for both carriers.

## 2026-07-30 — @remarks fate

**Question:** Under the section grammar, what happens to `@remarks`
(currently "the single highest-leverage tag", law :183-186, 491 uses)?

**Answer:** Retired — `**Details**`/`**Gotchas**` sections own the semantics;
`@remarks` forbidden in new work; existing uses cleanup-on-touch (inventory
rule flags `@remarks` in touched files).

**Rationale:** Matches Effect's 5-tag universe; hover lab showed `@remarks`
headings collapse onto the tag row while body sections get true hierarchy;
a residual-role compromise would leave a fuzzy boundary every author and
validator must judge.

## 2026-07-30 — enforcement hardness

**Question:** How hard do the section-grammar rules bite?

**Answer:** Shape-checked opt-in — sections optional; when present validated
(order, non-empty, `Use to/when/as/with` opener, titled unique single-fence
Examples, no loose fences, described `@see`, no-`@remarks`-in-new-work).
Example required per the kind-split below. New rule codes ride the existing
fail-on-growth baseline (`standards/jsdoc-totals.regression-baseline.jsonc`).
`{@link}`/`@see` target resolution DEFERRED to a follow-on goal.

**Rationale:** Mirrors Effect's validator (sections optional there too);
requiring `**When to use**` everywhere would out-Effect Effect and breed
boilerplate; link resolution is the only rule needing a checker program —
staged out. Advisory-only rejected: unenforced = unadopted here.

## 2026-07-30 — every-export example law

**Question:** Keep the universal compilable-example law or split by symbol
kind?

**Answer:** Kind-split — value-level exports (functions, constants, classes,
schemas, services) require an Example; pure type-level exports (type aliases,
interfaces, namespaces, `.Encoded` companions) require good prose, Example
optional. Inventory rule becomes kind-aware; baseline stays at zero.

**Rationale:** Effect's Schema.ts (14% examples, excellent hovers) proves
presence ≠ pedagogy; our 60%-trivial sample clusters exactly where examples
are forced onto surfaces with nothing to demonstrate.

## 2026-07-30 — pilot scope

**Question:** Which packages pilot the grammar?

**Answer:** Trio — `packages/foundation/modeling/schema` + one tooling
package (docgen or similar) + one law-practice values slice. Acceptance =
before/after WebStorm hover screenshots.

**Rationale:** Three families, three authoring contexts: highest hover
traffic, strictest existing lint, and the organic titled-`**Example**`
precedent respectively.

## 2026-07-30 — @since policy

**Question:** Keep `0.0.0` placeholder or adopt Effect's real-semver @since?

**Answer:** Keep `0.0.0` until v1.0; stable-semver format check only.

**Rationale:** Real versions are meaningful only with release history; ours
would be fiction.

## 2026-07-30 — example import style

**Question:** Port Effect's named-import example rule?

**Answer:** No — examples keep repo law namespace imports
(`import * as S from "effect/Schema"`).

**Rationale:** The one grammar rule that conflicts with repo-wide import law;
examples must teach the idiom the surrounding code requires.

## 2026-07-30 — described-@see timing

**Question:** Fast-track the described-`@see` convention or defer?

**Answer:** Day-one — the rule (every `@see` carries a purpose phrase) +
cross-link authoring guidance land in the goal's first implementation wave.

**Rationale:** Cheapest, highest-visibility win (75 `@see` across ~18k
exports today); hover lab confirmed full rendering.

## 2026-07-30 — hygiene fixes

**Question:** Separate PR for tsdoc.json `@module`/`@template` cleanup, the
pattern-doc line-847 copy-paste bug, and the skill's 3 stale Source Reference
paths?

**Answer:** No — they ride the goal's law-rewrite PR (implementation phase).

**Rationale:** All three touch files the law rewrite already rewrites; a
separate PR adds a check-battery round-trip for zero review benefit.

## 2026-07-30 — decision-record surface

**Question:** Does this warrant a `standards/architecture/DECISIONS.md` ADR?

**Answer:** No — this file + the goal packet SPEC are the durable record; the
rewritten `.patterns/jsdoc-documentation.md` becomes the binding law surface
at implementation time.

**Rationale:** Documentation law + tooling routing, not architecture-wide
doctrine; fails the ADR high bar (not topology, reversible, no architecture
tradeoff).

## 2026-07-30 — planning/implementation separation

**Question:** What lands in the next PR?

**Answer:** Decisions + graduation only, zero implementation: this DECISIONS
log, finalized BRIEF/MAP, manifest flip to graduated, and the
`goals/effect-jsdoc-quality` packet encoding every decision. Law rewrite,
inventory rules, docgen change, and pilot happen in the goal's own execution
PRs.

**Rationale:** Explicit user instruction — grilling/planning is reviewed and
landed separately from implementation.
