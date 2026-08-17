# Gold Intake — Handoff Runbook

> **For a Claude Code / Codex session rooted at this repository's checkout root.**
> This staging folder is the bridge from an external research effort into this repo's
> `explorations/` → `goals/` pipeline. Read this file first, then drive the phases below.

## What this is

An external effort mined **27 reference repos** (Free Law Project tools, USPTO/patent MCP servers, and
AI/agent/legal-app projects) for reusable "gold" relevant to beep-effect / Prose-to-Proof. The output:

- `GOLD_SYNTHESIS.md` — synthesis-first report (exec summary, gap map, gold catalog by 11 themes, adoption roadmap with P1/P2/P3 waves, risks/deprecations/licensing, per-repo appendix + matrix).
- `research/gold-catalog.json` — **219 verified nuggets**, each with: `repo`, `sourceFile`, `line`, `snippet`, `theme`, `relevance` (direct/adjacent/serendipitous), and final `finalBeepTarget` / `gapStatus` (gap/partial/dup) / `recommendation` (port/wrap/adopt/study/fork/skip/reference) / `priority` (P1/P2/P3). Plus per-repo `verdicts`.
- `research/per-repo/*.md` — drill-down notes per repo (citations + snippets).
- `ROUTING-SEED.md` / `routing-seed.json` — a **grounded Wave-1 routing hypothesis** (10 agents verified the top clusters against the live tree, 2026-06-29) to jump-start Phase 1. Starting point, **not** the final gated matrix.

Citations were adversarially verified (0 refuted; spot-check passed). Treat `gold-catalog.json` as the
machine-readable source of truth.

## Mission

Convert the gold into this repo's fuzzy front end so there's a deep, grounded, adversarially-reviewed backlog
of execute-ready work for GPT-5.6 / Fable. **Reconciliation-first** — nothing is lost, nothing is duplicated.

## Hard constraint — do NOT duplicate existing work

This repo already has 4 active explorations, 3 graduated, and ~61 goals; **nearly every gold theme is already
claimed** (e.g. `ip-law-knowledge-graph`, `epistemic-claim-lifecycle-gate`, `langextract-capability`,
`provenance-shared-claim-kernel`, `file-processing-capability`, `solo-firm-docketing`, `local-first-voice`,
`m365-mcp`, `agentic-professional-runtime`). House rule: **attach / coordinate / extend existing packets;
create net-new only for genuine gaps.** The Phase-1 routing matrix enforces this and is an approval gate.

## Locked decisions (from the planning grill)

1. **Routing model:** reconciliation-first. Every nugget → `attach-existing | extend-goal | new-exploration | dup-skip`, a concrete target packet (or proposed new slug), and a wave.
2. **Run scope:** enumerate the FULL backlog; auto-run unattended stages (capture + deep-research + codex review) for ALL wedges to research-complete; graduate **only Wave 1 (P1)** now; Waves 2–3 stay queued.
3. **Carving:** wedge / problem-shaped (Shape-Up), roadmap-aligned — like `solo-firm-docketing` / `local-first-voice`, not theme-buckets.
4. **Align cadence:** pipeline pre-drafts `DECISIONS.md` (Q + recommended answer + rationale); user runs `/grill-with-docs <slug>` to confirm/adjust.
5. **Review design:** codex (`codex:rescue` / GPT-5) critiques each `RESEARCH.md` and each graduated `SPEC.md`; `/grill-with-docs` carries align; `/quality-review-fix-loop` runs once per wave for cross-packet consistency.

## Per-wedge pipeline (the 6 `/explore` stages + 2 review gates)

`capture → research → [codex gate 1] → align → shape → decompose → graduate → [codex gate 2]`

1. **capture** (`CAPTURE.md`, append-only) — seed from the wedge's nuggets (title, snippet, `repo/file:line`, beep-target) + pointer to the relevant `GOLD_SYNTHESIS.md` section.
2. **research** (`RESEARCH.md`) — `/deep-research` per subtopic → raw reports in `explorations/<slug>/research/<subtopic>.md`; synthesize **External Landscape** (cited) + **In-Repo Capability Inventory** (cite `@beep/*` + path; gaps NOT FOUND via `repo-symbol-discovery`) + **Constraints**.
3. **codex gate 1** — `codex:rescue` adversarially critiques `RESEARCH.md`; save to `explorations/<slug>/reviews/<YYYY-MM-DD>-codex-research.md`; fold findings back.
4. **align** (`DECISIONS.md`) — pipeline pre-drafts Q+rec+rationale; user `/grill-with-docs <slug>`; clear manifest `openQuestions`.
5. **shape** (`BRIEF.md`) — problem, appetite, solution sketch, rabbit holes, no-gos; iterate to sign-off.
6. **decompose** (`MAP.md`) — candidate goals + sequencing + first vertical slice; capability-check every component.
7. **graduate** — verify the 4-point gate; scaffold `goals/<slug>/` from `goals/_template`; seed `SPEC.md` (no-gos→non-goals, rabbit holes→constraints, DECISIONS→decision log); `GOAL.md` ≤4000 chars; cross-link manifests; update `ATLAS.md`.
8. **codex gate 2** — `codex:rescue` reviews each graduated `SPEC.md` for scope/acceptance soundness; fold fixes in.

## Phases

- **Phase 1 — Reconciliation (GATE):** start from `ROUTING-SEED.md` (already routes the 10 highest-value clusters, verified 2026-06-29). Extend it: a Workflow/agent reads `research/gold-catalog.json` + the live `explorations/`+`goals/`+`ATLAS.md` and routes the **remaining + long-tail** nuggets, re-confirming the seed against the then-current tree. Write `ROUTING.md` (human matrix grouped by target) + `routing.json` here in `_gold-intake/`. **Get user approval before opening any packet.**
  - `routing.json` entry shape (one per nugget cluster): `{ cluster, nuggetIds[], route: attach-existing|extend-goal|new-exploration|mixed|dup-skip, primaryTarget, targetExists, secondaryTargets[], wave: P1|P2|P3, netNew[], alreadyCovered[], rationale, cautions }`.
  - **Proposed new-exploration slugs from the seed** (verify before scaffolding): `gov-legal-data-driver-codegen` (P1), `mcp-auth-gated-registration` (P1), `citation-grounding-hallucination-guard` (P2), `court-vocabulary-resolver` (P2), `agent-memory-tiers-bitemporal-edges` (P2), `effect-orchestration-patterns` (P2), `rag-retrieval-projection` (P2). Clean extend-goal: `file-processing-capability` (OCR concretization). Mixed-extend: `packages/drivers/uspto` (already on ODP — add query-DSL/EPO/BigQuery) and `langextract-capability` (add anti-inference + doc-structure).
- **Phase 2 — Backlog scaffolding:** for each `new-exploration` wedge run `/explore new <slug>`, seed CAPTURE, then a Workflow fans out deep-research + synthesizes RESEARCH + codex gate-1 + pre-drafts DECISIONS. For `attach-existing`/`extend-goal`, append into the target packet's `CAPTURE.md` / `research/`. End every packet at research-complete; sync manifests + `ATLAS.md`.
- **Phase 3 — Wave 1 graduation:** per P1 wedge: `/grill-with-docs <slug>` → `BRIEF.md` → `MAP.md` → graduate → codex gate 2. Output: execute-ready `goals/<slug>/` launchable via `/goal follow the instructions in goals/<slug>/GOAL.md`.
- **Phase 4 — Consistency + memory:** `/quality-review-fix-loop` over the Wave-1 set; log durable decisions + gold→packet provenance to Cognee (the always-on dev-memory) and file memory (`MEMORY.md`); confirm `ATLAS.md`. (Edited 2026-08-01: Graphiti retired 2026-07-25 — see `standards/memory-architecture/04-decision-log.md`.)

## Conventions (non-negotiable)

- Copy `explorations/_template` & `goals/_template` **verbatim**. UPPERCASE artifact filenames, kebab-case slugs, real `YYYY-MM-DD` dates, `CAPTURE.md` append-only, links-not-copies, close the loop every session (README "Next Open Question" + manifest + `ATLAS.md`).
- **Graduation gate (all 4):** BRIEF complete · no unresolved blocking questions · MAP names goals (slug+mission+deps+first-slice) · every component cites existing capability or NET-NEW.
- Standards: effect-first (typed errors / Option / Schema-decode), schema-first, hexagonal slice-first, drivers isolated, authority/projection/cache. See `standards/ARCHITECTURE.md`, `standards/effect-first-development.md`, `standards/memory-architecture/`.
- Capability-cited before inventing: `repo-symbol-discovery` / ripgrep `packages/*/*/*/src/**` + barrels. Compose existing bricks (epistemic claim/evidence/provenance, `@beep/langextract`, `@beep/semantic-web`, the driver skeletons) — don't rebuild.

## Mechanics (exact, confirmed against the live repo)

- **Templates:** scaffold from `explorations/_template/` and `goals/_template/` verbatim. Exploration packet = `README.md` + `CAPTURE.md` (append-only) + `RESEARCH.md` (External Landscape cited + In-Repo Capability Inventory + Constraints) + `DECISIONS.md` (dated Q/Answer/Rationale) + `BRIEF.md` (problem/appetite/sketch/rabbit-holes/no-gos) + `MAP.md` (candidate goals table + sequencing + first slice) + `ops/manifest.json` + `assets/`. Goal packet = `README.md` + `SPEC.md` (normative) + `PLAN.md` (P0–P3) + `GOAL.md` (≤4000 chars) + `ops/manifest.json` + `research/` + `history/reflections/`.
- **Manifest cross-link at graduation:** exploration `ops/manifest.json` → `links.goals: ["goals/<slug>", …]`; goal `ops/manifest.json` → `provenance: { "exploration": "explorations/<slug>", "graduated": "YYYY-MM-DD" }`. Update `explorations/ATLAS.md` on every stage/status change.
- **Deep-research storage:** raw `/deep-research` reports → `explorations/<slug>/research/<subtopic>.md`; synthesize the cited summary into `RESEARCH.md`. Codex critiques → `explorations/<slug>/reviews/<YYYY-MM-DD>-codex-<artifact>.md`.
- **Codex review invocation:** use the `codex:rescue` plugin pointed at the artifact path with an adversarial-critique instruction (find gaps, unsupported claims, missed prior art, deprecations, scope/acceptance holes); fold findings back, then record the critique file under `reviews/`.
- **Driver/codegen precedent:** for the gov-data + patent drivers, reuse the repo's own Effect codegen path in `packages/drivers/{runpod,acp}` (`openapi.json` + `scripts/generate.ts`) — do **not** introduce Orval/axios/Zod. `@beep/uspto` already targets ODP (`data.uspto.gov/api/v1/...`) with File-Wrapper support; extend it, don't restart. Never reintroduce legacy PatentsView/PEDS endpoints (sunset; `api.patentsview.org` 301→ODP).
- **Reflections:** any executed goal writes `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`; `bun run beep lint reflection-artifacts` must pass.

## Verification

- `routing.json` covers all 219 nuggets (none unrouted); each → a real packet or proposed slug; user-approved.
- Each Wave-1 graduated packet passes the 4-point gate + `test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000`, `jq . goals/<slug>/ops/manifest.json`, `git diff --check -- goals/<slug>`.
- Each Wave-1 `RESEARCH.md` + `SPEC.md` has a recorded codex critique under `reviews/`.
- `/quality-review-fix-loop` over the Wave-1 set: zero blocking findings.
- `ATLAS.md` + manifests cross-linked; no packet duplicates an active goal.

## First action for the beep session

Re-ground, then start Phase 1:
1. Read `_gold-intake/ROUTING-SEED.md` (the grounded starting routing) + `GOLD_SYNTHESIS.md` (exec summary + gap map + adoption roadmap); skim `explorations/ATLAS.md` + `goals/`.
2. Re-confirm the seed against the current tree, route the remaining/long-tail nuggets, and produce `ROUTING.md` + `routing.json`; bring the matrix back for approval before opening any packet.
3. On approval, scaffold the approved P1 wedges and run the per-wedge pipeline (Phase 2 → 3).

_Source provenance: mined from the machine-local `law_stuff/repos` research shelf (2026-06-29). This folder retains the full source for traceability._
