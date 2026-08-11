# Agent-Facing Instruction Pre-Audit — AGENTS.md, skills, reflections

> Provenance: pre-exploration codex lane (GPT-5.6 Sol, medium effort,
> read-only), 2026-07-13. Corpus note: the live checkout contains 69
> reflection files, of which 22 are templates and **47 are authored
> reflections** (an earlier survey's "114" figure included templates). All 47
> were streamed, covering **218 structured findings**: 67 tooling-friction,
> 61 implementation-improvement, 47 goal-critique, 32 codification-todo, 11
> prompt-critique.

## A. AGENTS.md structural critique

`AGENTS.md` is 117 lines, 789 words, 5.8 KB — roughly 1.4–1.8K tokens. The 30
skill frontmatters add 1,441 words / 11.3 KB, making the permanent
agent-facing prefix ≈ 4–5K tokens before other settings. Material but not
intrinsically excessive.

The architecture split is sound: `AGENTS.md` stays out of package topology
while `standards/ARCHITECTURE.md` provides the navigable hierarchy
(ARCHITECTURE.md:19,178,1083).

The weakest structural choice: a "laws only" file also carries **volatile
operational state** — a dated memory migration, Graphiti deprecation
schedule, MCP provisioning details, tool routing, a five-minute cache TTL
(AGENTS.md:3,76,107). This conflicts with its own advice that volatile
knowledge should not occupy the permanent cache prefix (AGENTS.md:111).

Rule classes:

- **Mechanically checkable**: test import boundaries, retired catalog
  prohibition, PR-only `main`, commit-message width, private-doc exclusion,
  Graphiti group shape (AGENTS.md:26,38,47,69).
- **Judgment-heavy**: "prefer typed errors", "prefer match helpers", "keep
  service boundaries explicit", "when safe", "focused", "testable"
  (AGENTS.md:13,25). Useful steering; cannot produce reliable compliance
  telemetry without operational definitions.
- **Probable enforcement duplication**: schema-first, terse-effect forms,
  import style, commitlint, docgen, parts of the private-path policy already
  have lint/Yeet gates. Reflections show agents discovering terse-effect,
  native-runtime, dual-arity, and schema-first through those gates
  (goals/goals-doctor/history/reflections/2026-07-11-claude.md:21). Deletion
  candidates **only if** telemetry shows agents learn them from diagnostics
  as effectively as from pre-steering. The canonical Yeet routing remains
  load-bearing (AGENTS.md:41).

Repeatedly requested but absent laws:

- Flip packet manifest/lifecycle/reflection state in the **same PR** as final
  work: requested in 11 reflections
  (goals/fallow-zero-dead-code/history/reflections/2026-07-11-claude.md:10).
- Attribute verification failures as introduced / inherited / unrelated /
  environment-only: 6 reflections; current Yeet wording promises green
  without defining attribution
  (goals/identity-iri-core/history/reflections/2026-07-02-claude.md:18).
- Durable on-disk handoffs and isolated worktrees for agent/session
  transitions: 10 reflections mention subagents or handoffs; AGENTS.md only
  discusses reuse and cache TTL
  (goals/fallow-zero-dead-code/history/reflections/2026-07-11-claude.md:22).
- Distinguish repo-symbol discovery from installed-package discovery: the
  live-source rule yields false negatives when the question concerns package
  exports (AGENTS.md:31,
  goals/chat-input-and-theming/history/reflections/2026-06-21-claude.md:10).

## B. Reflection synthesis

Rough thematic matches; overlapping.

| Theme | Observed frequency | Instruction-surface status |
|---|---:|---|
| Quality/Yeet/lint feedback loops | 40/47 reflections; ~102/218 findings | Addressed in principle, operationally contradicted: mislabelled verdict hints, mutating/scanning races, late-only gates make "canonical path" unreliable as diagnosis (goals/quality-gate-ratchets/history/reflections/2026-07-06-claude.md:10). |
| Packet lifecycle and closeout drift | ~62 findings; 11 reflections request same-PR updates, 11 request goals-doctor support | Mostly silent. `/reflect` exists; nothing in the always-loaded law binds closeout paperwork to the shipping change. Several packets stayed falsely active for weeks (goals/firecrawl-driver/history/reflections/2026-07-11-claude.md:10). |
| Runner/environment/tool-state failures | ~74 findings | Partly addressed (generic MCP stability, memory fallback). Silent on Bun/Vitest divergence, pipe exit-status masking, concurrent tree mutation, inherited-red attribution (goals/identity-iri-core/history/reflections/2026-07-02-claude.md:14). |
| Discovery, exports, scaffolding, reuse | ~38 findings; 8 reflections mention new-package/scaffold onboarding | Partly addressed. Live-source/barrel discovery strong for repo symbols, too broad for installed dependencies. Architecture codegen does not promise a Yeet-clean package surface. |
| Agent coordination and handoff | ~16 findings across 10 reflections | Largely silent: durable artifacts, exact scope ownership, separate worktrees are not codified. |
| Browser/real-engine proof gaps | ~15 findings; 3 concrete cases | Silent except frontend tool routing. Green typecheck/jsdom did not catch browser behavior or missing styles (goals/chat-input-and-theming/history/reflections/2026-06-21-claude.md:23). |

## C. Skill inventory hygiene

No plugin `SKILL.md` files visible under `.claude/plugins` from the sandbox.

Collision clusters:

- `effect-first-development` claims features, refactors, bugs, APIs,
  services, schemas, and tests; `schema-first-development`,
  `schema-model-specialist`, `effect-services`, `effect-v4-imports`
  subdivide the same space (each skill's SKILL.md:3).
- `ponytail` triggers on any coding task, colliding with effect-first,
  `crispen`, and its own review/audit variants (ponytail SKILL.md:3).
- `quality-review-fix-loop` and `yeet` both claim quality repair through
  review-ready/mergeable closeout.
- `grill-me`/`grill-with-docs` and `claude-frontend-lane`/atom/shadcn have
  plausible routing ambiguity.

Exact-name scans found **no reference in authored reflections or root
AGENTS.md for 16 skills**: `claude-frontend-lane`, `effect-services`,
`grill-me`, `jsdoc-annotation-specialist`, `mcp-jetbrains`,
`onepassword-secret-refs`, all six `ponytail*` skills,
`quality-review-fix-loop`, `schema-model-specialist`, `turborepo`. Dead-weight
*hypothesis* only — transcripts may show invocations reflections omit.

Likely load-bearing: `yeet` (named in 25 reflections), `reflect`,
effect/schema guidance, atom guidance, exploration, symbol discovery. Likely
retirement/consolidation candidates: one-shot `ponytail-help/gain/debt`,
overlapping ponytail review modes, deprecated Graphiti guidance (which still
preserves historical read routing).

## D. Pulse-phase hypotheses

| # | Hypothesis | Confirm/refute with |
|---|---|---|
| H1 | Vague Code Laws do not reduce corresponding failures; agents mainly react to lint diagnostics. | Transcript exposure plus first-failure Yeet lane/category, normalized by task type. |
| H2 | Misattributed Yeet hints cause ≥1 unnecessary rerun in >10% of failed sessions. | `verdict.json` hint vs actual failing step labels, subsequent commands, verify count, wall time. |
| H3 | A scoped law sweep before full verify cuts verification attempts by ≥1 for new CLI/package work. | Command chronology and number/duration of verify runs. |
| H4 | >10% of completed goal packets remain active or phase-stale after merge. | Manifest/README timestamps vs merged PR SHA/date and reflection presence. |
| H5 | ≥half of the 16 unreferenced skills are never invoked in transcripts. | Skill-selection events and loaded-skill identifiers. |
| H6 | Broad skill collisions increase multi-skill loading without improving first-pass success. | Co-invocation matrix, prompt-token cost, first-pass gate outcome, correction count. |
| H7 | Repo-only discovery produces repeatable false negatives for installed dependencies. | Search targets in transcripts, later `node_modules`/exports inspection, reversed conclusions. |
| H8 | Unit-green frontend/driver work still yields material runtime defects in >15% of browser/real-engine checks. | Gate state immediately before QA plus browser/driver findings afterward. |
| H9 | Atomic "ship + manifest + reflection" sessions nearly eliminate retroactive closeout work. | Shipping-commit contents and later goals-doctor findings. |
