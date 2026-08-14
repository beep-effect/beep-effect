# Lane 6 — Goals-packet conventions and graduation pipeline

Contract for minting a well-formed `goals/` packet (or pair) for (1) `apps/experiments/*` via `beep create-package` variants (nextjs / vite / tauri) and (2) `beep delete-package`. Checkout date 2026-08-13.

**Authority, in rank order:** `goals/README.md` → `explorations/README.md` + `.agents/skills/explore/SKILL.md` → live CLI/schema under `packages/tooling/tool/cli/src/commands/Goals/` and `Lint/ReflectionArtifact.ts` → `goals/_template/` → ceremony-batch packets from `82ee9f8ef0` → `research/README.md` (what not to do) → `docs/ROADMAP.md` §Exploration funnel (lane slot).

**Portfolio (`goals/INDEX.md`, generated):** 138 packets — 44 active · 1 paused · 89 completed-retained · 0 superseded · 4 reference.

Architecture / `AGENTS.md` / skills outrank packet prose. Directory names do **not** encode lifecycle. `goals/_archive/` is an archive *operation*, not a status.

```text
idea → INBOX bullet or /explore new <topic>
     → explorations/<slug>/  (capture → research → align → shape → decompose)
     → four-point definition-of-ready
     → goals/<slug>/ from goals/_template/   (one or more packets)
     → /goal follow the instructions in goals/<slug>/GOAL.md
     → yeet: repair → verify → publish --pr → monitor
     → same-PR flip to completed-retained + closeout reflection
```

---

## 1. Exploration pipeline (only legal path into `goals/`)

Convention: `explorations/README.md`. Operator: `/explore` skill. **No** `bun run beep explore` CLI. Exploration validation is conversational in v1 — no lint gate.

### 1.1 Stages, statuses, anatomy

| Stage | Artifact | Exit |
| --- | --- | --- |
| 0 `capture` | `CAPTURE.md` append-only; never interrogate/reorganize. Media → `assets/`. | Enough mass to ground. |
| 1 `research` | `RESEARCH.md` (external **and** in-repo inventory) + `research/SOURCES.md`. | Landscape + lego bricks known. |
| 2 `align` | `DECISIONS.md` — Q / A / Rationale. Deferred logged DEFERRED. | `openQuestions` empty or deferred. |
| 3 `shape` | `BRIEF.md` — problem, appetite, fat-marker sketch, rabbit holes, no-gos. | Human confirms it matches their head. |
| 4 `decompose` | `MAP.md` — candidate goals, edges, first slice, capability cites. | Definition-of-ready. |
| 5 `graduate` | Ceremony only. | Promised-now `goals/` packets exist. |

Stages loop. Manifest `stage` is the resume point, not file presence. Cold read: `ATLAS.md` → packet README → only current-stage files. Every session must update `stage` / `openQuestions` / `updated`, rewrite "Next Open Question", append a Trail line, sync ATLAS on stage/status change.

| Status | Meaning |
| --- | --- |
| `active` | In ATLAS Active. |
| `parked` | Dated reason in `DECISIONS.md`. |
| `graduated` | Promised-now goals exist. Packet stays as provenance. Reopens at `decompose` when a MAP gate fires. |
| `killed` | Epitaph in ATLAS Killed. A successful outcome. |

```text
explorations/<slug>/
  README.md  CAPTURE.md  RESEARCH.md  research/SOURCES.md
  DECISIONS.md  BRIEF.md  MAP.md  ops/manifest.json  assets/
```

Scaffold from `explorations/_template/`. Worked fiction: `explorations/EXAMPLE.md` (graduates two sibling goals; kills a third idea instead of stuffing it).

Manifest `exploration-manifest/v1`:

```json
{
  "schemaVersion": "exploration-manifest/v1",
  "exploration": {
    "slug": "<slug>", "title": "<Title>", "status": "active", "stage": "capture",
    "openQuestions": [], "sources": ["research/SOURCES.md"],
    "links": { "goals": [], "docs": [], "supersededBy": null },
    "created": "YYYY-MM-DD", "updated": "YYYY-MM-DD"
  }
}
```

`stage` ∈ `capture | research | align | shape | decompose | graduate`. `links.goals` / `links.docs` are the graduation cross-links. Ceremony packets also use live `links.related` (not in the template).

### 1.2 Shape brief → SPEC seed

`BRIEF.md` sections, in order: **Problem** · **Appetite** (budget, not estimate) · **Solution Sketch** (fat-marker) · **Rabbit Holes** · **No-Gos**.

Graduation mapping (skill + `explorations/README.md`):

| Brief / align | Goal SPEC |
| --- | --- |
| No-gos | Non-Goals |
| Rabbit holes | Constraints |
| `DECISIONS.md` | Decision Log |
| MAP first vertical slice | SPEC "First Vertical Slice" |
| MAP capability cites | Target Surfaces + Constraints |

Use **back-links**, not copies, of BRIEF/RESEARCH/DECISIONS.

### 1.3 MAP and the four-point definition-of-ready

Template MAP columns: Slug · Mission · Depends on · Capabilities cited. Gold (`explorations/document-structure-ontologies/MAP.md`) adds Order, live package paths + NET-NEW, per-row first slice, Sequencing, First Campaign Vertical Slice, Inherited Constraints and Re-entry.

Capability check: every major component cites an existing brick or is marked NET-NEW. Challenge reflexive NET-NEW (`EXAMPLE.md` downgrades "date parsing" to `@beep/schema` DateTime codecs).

An exploration may graduate **only** when all four hold:

1. Brief complete (problem, appetite, sketch, rabbit holes, no-gos).
2. No unresolved blocking questions (`openQuestions` empty or deferred-with-rationale).
3. Map names slugs, missions, edges, first vertical slice.
4. Capability check.

Fail any point → drop back to the owning stage. `EXAMPLE.md` Session 6 fails #2 on purpose.

### 1.4 Graduation mechanics

Per **promised-now** candidate:

1. `cp -R goals/_template goals/<slug>`.
2. Seed SPEC from the brief (table above).
3. Cross-link: exploration `links.goals` ↔ goal `provenance.exploration`.
4. Carry `research/SOURCES.md` into the goal — reproduce the corpus **and** name the exploration ledger as primary. Register in `researchReports[]` + `currentSourceOfTruth[]`.
5. Include `GOAL.md` ≤ 4000 chars.
6. When every promised-now goal exists: ATLAS → Graduated; exploration `status: graduated`.
7. **Gated/queued candidates do not hold the packet open.** They stay in `MAP.md`. A fired gate **reopens the exploration at `decompose`** — do not scaffold from an old MAP row (ratified 2026-08-13).

`docs/ROADMAP.md`: shape freely; **scaffold a `goals/` packet only into a free NOW-lane slot**.

`INBOX.md`: one bullet per idea. `/explore` (bare) triages — new packet, attach to existing `CAPTURE.md`, or strike through with a word of why. Capture files are typos-exempt. **Do not auto-append** (see §7).

`ATLAS.md` is navigation, never doctrine.

---

## 2. Goal-packet standard

New execution-capable packets **must** start from `goals/_template`. Lighter shape only when README **and** manifest mark the packet non-executable.

### 2.1 Tree and roles

```text
goals/<slug>/
  README.md              orientation: Lifecycle line, mission, launch, next action, evidence
  SPEC.md                NORMATIVE: objective, non-goals, hierarchy, surfaces, constraints,
                         acceptance, decision log, first slice, stop conditions
  PLAN.md                mutable phases — ids must not contradict ops/manifest.json
  GOAL.md                /goal launcher, not doctrine. Target 3500, hard max 4000
  ops/manifest.json      machine routing; initiative.status is canonical lifecycle
  research/SOURCES.md    provenance ledger (inherited at graduate)
  history/reflections/
    _TEMPLATE.md         copy; not an artifact
    <YYYY-MM-DD>-<agent>.md   closeout / on-demand
```

Optional, not required at scaffold: `ops/handoffs/`, `ops/prompts/`, `research/OPPORTUNITIES.md` (friction receipts), Codex-only `findings/` + `raw/`. `_template` is excluded from inventory scans.

Source hierarchy: user objective → `AGENTS.md` / skills → architecture standards → SPEC → PLAN → GOAL → research/ops/history. Ceremony SPECs insert the exploration BRIEF/DECISIONS/MAP above this SPEC.

### 2.2 Launcher

Every `active` execution packet needs `GOAL.md`. `SPEC.md` stays `packetAnchorDocument`. Command:

```text
/goal follow the instructions in goals/<slug>/GOAL.md
```

Verify: `test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000`. Ceremony-batch launchers are 602–967 chars (template is 2030; `skill-contract-kernel` is 2842). Do not pad. Remove `GOAL.md` only after marking `reference` or `paused` with an explicit non-executable rationale (`executionCapable: false`).

### 2.3 Lifecycle (closed vocabulary)

`initiative.status` is canonical. README `Lifecycle:` mirrors it. Both plus `INDEX.md` are written by **one** command:

```sh
bun run beep goals set-status <slug> <status>
```

| State | Meaning |
| --- | --- |
| `active` | Open. Must have `GOAL.md`. |
| `paused` | Stopped on purpose (includes authored-but-not-started). Resume conditions explicit. |
| `completed-retained` | Shipped; kept as evidence/precedent. |
| `superseded` | Replaced. Record `supersededBy` + `supersededNote`. |
| `reference` | Design/research precedent. |

Legacy tokens (`complete`, `pending`, `DONE`, …) are invalid; 2026-07 migration parked originals in `statusNote`. `removed` is not a status.

**Phase** statuses are a different domain: `pending | in-progress | complete | superseded`. Phase `superseded` means that phase moved to another packet (record phase-level `supersededBy`). It is terminal but not `complete`, so all-phases-complete checks stay honest. Precedent: `ci-fleet-endgame` P4/P5.

Canonical new-packet phases (template + every `82ee9f8` packet): P0 Research · P1 Implement · P2 Verify · P3 Yeet: PR to mergeable · P4 Close. Custom names are fine (`identity-iri-fibered` P0 is "Blocker and contract audit"). **A plan must not contradict its own manifest.** Equality of id sequences across packets is not a gate.

### 2.4 Completion gate + slug-in-commit

A goal is not achieved — may not be `completed-retained` — until work ships as a PR driven to mergeable via `/yeet` (`bun run beep yeet`: repair → verify → publish `--pr` → monitor). Local proof is necessary, not sufficient.

```json
"completionGate": {
  "operator": "yeet",
  "requiresPullRequest": true,
  "requiresMergeable": true,
  "statement": "Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (...).",
  "grandfathered": false
}
```

Pre-2026-06-30 work: `grandfathered: true`.

**Slug-in-merged-commit rule:** `beep goals doctor` emits **advisory** `completion-gate-unsatisfied` when a non-grandfathered `completed-retained` packet has no merge/squash subject in the last 4000 `git log --format=%s` lines that contains either the **packet slug** or `#N` from wire-only `mergedPullRequest` (e.g. `295` → `#295` on `agent-pipeline-velocity`). Offline heuristic; stays advisory because squash subjects vary. **Put the slug in the yeet PR title** and/or record `mergedPullRequest`.

`AGENTS.md`: **same-PR packet-state flips** — flip lifecycle and land the closeout reflection in the same PR as the final work.

---

## 3. Manifest schema (`GoalManifest` / `initiative-manifest/v2`)

Source: `Goals.schemas.ts`. Decoder is **lenient**: only `initiative` (`id` + canonical `status`) and `completionGate` are required. Unknown keys survive on disk and are **stripped from decoded output**. Doctor re-reads raw JSON for `provenance`, `mergedPullRequest`, etc.

### 3.1 Typed fields

| Field | Req | Notes |
| --- | --- | --- |
| `initiative.id` / `status` | yes | Slug + `GoalStatus`. |
| `initiative.title` / `created` / `updated` | no | Title + dates. `set-status` stamps `updated`. |
| `initiative.packetAnchorDocument` | no | `"SPEC.md"`. |
| `completionGate.*` | yes | Optional `grandfatheredNote`. |
| `schemaVersion` | no | Canonical `initiative-manifest/v2`. v1 / `1.0.0` → upgrade advisory. |
| `lifecycle` | no | Must equal `initiative.status` (blocking mismatch). |
| `packetPath` / `executionCapable` / `reflectionRequired` / `mission` / `statusNote` | no | Template: capable true, reflection true, mission feeds INDEX. |
| `blockedBy` | no | `string[]`. Presence suppresses `stale-active`. May be slugs **or** prose. |
| `supersededBy` / `supersededNote` | no | Advisory-required when status is `superseded`. |
| `claimedBy` / `claimedAt` / `discoveredFrom` | no | Schema-ready, unenforced. |
| `phases` | no | Array **or** record of `{ status, id?, name?, exit? }`. |
| `provides` / `requires` | no | Default `[]`. `CapabilitySlug` = `namespace/name` kebab, 32/seg, 64 total. Same slug in both → decode fail (self-cycle). |

Good slugs: `knowledge/doctor`, `skills/warehouse`, `goals/graph`, `jsdoc/carrier-retirement`. Bad: `p1/research-done`.

### 3.2 Wire-only fields gold packets always carry

In `_template` and every `82ee9f8` packet; not on the `GoalManifest` class:

| Field | Role |
| --- | --- |
| `provenance.exploration` | `"explorations/<slug>"`. Doctor advisory if missing on disk or path-escapes repo. |
| `provenance.graduated` / `note` | Date + lineage. |
| `provenance.goal` | When a goal splits from another goal (`ci-lane-economics` ← `ci-fleet-endgame`). |
| `currentSourceOfTruth[]` | Ranked read list. Gold includes AGENTS/CLAUDE, four packet docs, SOURCES, **and** exploration BRIEF/MAP/DECISIONS. |
| `researchReports[]` | Local `research/SOURCES.md` plus `../../explorations/...` back-links. |
| `agentLaunchers[]` | `{ kind: "codex-goal", path: "GOAL.md", targetChars: 3500, maxChars: 4000, command: "/goal follow the instructions in goals/<slug>/GOAL.md" }`. |
| `verificationCommands[]` / `stopConditions[]` | Checklist + stops. Doctor does not execute them. |
| `dependencies[]` | Informal predecessor list (distinct from typed `requires`). |
| `mergedPullRequest` | Number (or Codex object). Feeds completion-gate heuristic. |

---

## 4. Validation / lint gates

### 4.1 Live `beep goals` surface

```text
bun run beep goals doctor [--write-baseline]
bun run beep goals index [--write | --check]
bun run beep goals set-status <slug> <status>
bun run beep goals set-status --migrate [--write]
```

That is the whole group. **`beep goals bootstrap` / `adopt` / `graduate` do not exist.** `honest-repo-signal` (2026-08-13) records this as a friction receipt: bootstrap is specified in `knowledge-surface-automation` Workstream E and unimplemented. Scaffold with `cp -R goals/_template`.

Adjacent:

| Command | Role |
| --- | --- |
| `beep lint goal-packets` | Alias of `goals doctor`. |
| `beep lint reflection-artifacts` | Completed-packet reflection gate. |
| `beep lint roadmap-refs` | ROADMAP links stay live. |
| `beep codex findings ingest --from <csv>` | Codex-security packets **only**. Not a general scaffolder. |
| `beep create-package` | Package/app scaffolder — the *product* of this initiative, not the packet mint. |

### 4.2 Doctor findings

**Blocking** (ratchet vs `goals/goals-doctor.baseline.jsonc`: inherited advisory, **new fail**, baseline only shrinks):

| Kind | Trigger |
| --- | --- |
| `manifest-missing` / `manifest-invalid` | Missing, unparseable, or fails `GoalManifest`. |
| `lifecycle-mismatch` | `initiative.status` ≠ `lifecycle`. |
| `readme-status-line` | No `Lifecycle:` line, or it disagrees. |
| `goal-md-oversize` | `GOAL.md` > 4000 chars. |
| `phases-terminal-but-active` | Every phase `complete`, packet still `active`. |
| `reflection-frontmatter-invalid` | Any `history/reflections/<YYYY-MM-DD>-<agent>.md` fails decode — **any** packet. `_TEMPLATE.md` ignored (name ≠ regex). |

**Advisory:** `stale-active` (21 days, no `blockedBy`/`statusNote`; single-pass `git log --since=21.days -- goals/`); `active-missing-goal-md`; `schema-version-upgrade`; `completion-gate-unsatisfied`; `superseded-without-pointer`; `exploration-backlink-missing`. Git advisories skip on shallow history. Budget < 10s.

### 4.3 Index, set-status, yeet wiring

```sh
bun run beep goals index --write   # regenerate goals/INDEX.md
bun run beep goals index --check   # fail on drift (yeet verify / lint-policy)
```

Grouped by status; row = slug, title, phases `x/y`, updated, mission (≤120 chars, from `manifest.mission` else README). Undecodable manifests render under "Invalid or missing" — not dropped. Never hand-edit. Merge conflicts → rerun `--write`.

`set-status` atomically rewrites `initiative.status`, `lifecycle` if present, `initiative.updated`, README `Lifecycle:`, and INDEX. Refuses unknown slugs/statuses and READMEs without a `Lifecycle:` line. `--migrate` is the 2026-07 one-shot; do not use it for ordinary work.

`Quality/Tasks.ts` `rootRepoLintPolicySteps` always runs `goals:doctor`, `goals:index-check`, `lint:reflection-artifacts`, `lint:roadmap-refs`. A new packet with a missing Lifecycle line, bad JSON, oversize GOAL, or undrifted INDEX **fails the PR**.

### 4.4 Reflections

`bun run beep lint reflection-artifacts` **blocks** when status is `completed-retained`, `reflectionRequired` is not explicit `false`, and no valid artifact exists (or frontmatter fails). Explicit `false` → advisory. `superseded` exempt (doctor still wants a pointer). Absent `reflectionRequired` still gates completed packets.

`ReflectionFrontmatter`: `goal`, `agent` (lowercase), `date`, `trigger` ∈ `closeout | on-demand | todo-codify`, `confidence` ∈ `high | medium | low`, `findings[]` `{ category, confidence, instruction, explanation }` with category ∈ `tooling-friction | implementation-improvement | goal-critique | prompt-critique | codification-todo`, `todos[]`.

Body rubric: Summary · Tooling (Worked / Didn't / Frustrating / Wished existed) · Implementation opportunities · Goal & prompt critique · TODOs · Lessons HIGH/MEDIUM/LOW.

Gold: `goals/identity-iri-fold/history/reflections/2026-08-01-claude.md` — six evidence-backed findings, two TODOs. That is the bar.

Write via `/reflect <slug>` or copy `_TEMPLATE.md`. Then `bun run beep lint reflection-artifacts`.

### 4.5 New-packet checklist (still binding)

```sh
cp -R goals/_template goals/<slug>
# replace every placeholder
test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000
jq . goals/<slug>/ops/manifest.json
rg -n "<slug>|GOAL.md|agentLaunchers|packetAnchorDocument" goals/<slug>
git diff --check -- goals/<slug>
bun run beep goals index --write
bun run beep goals doctor
bun run beep lint reflection-artifacts
```

---

## 5. Dissection — three `82ee9f8` packets

Commit `82ee9f8ef0` (2026-08-13, PR #703) added six goals. All six share this exact tree (no extra files):

```text
goals/<slug>/{README,SPEC,PLAN,GOAL}.md
goals/<slug>/ops/manifest.json
goals/<slug>/research/SOURCES.md
goals/<slug>/history/reflections/_TEMPLATE.md
```

(`skill-contract-kernel`, same day, also kept `history/.gitkeep` + `research/.gitkeep`. Doctor does not care.)

### 5.1 `patent-document-schema` — campaign lead

First promised-now graduate of `explorations/document-structure-ontologies` (`graduated` / `graduate`; `links.goals` lists all four siblings). MAP order 1. No `blockedBy`.

Manifest: v2, `active`/`active`, `executionCapable` + `reflectionRequired` true, one-line `mission`, `statusNote` "Graduated first … later campaign goals must not widen this packet", `provenance.exploration` + `graduated: 2026-08-13`, empty `dependencies`/`blockedBy`, `currentSourceOfTruth` includes exploration BRIEF/MAP/DECISIONS, `researchReports` = local SOURCES + `../../explorations/document-structure-ontologies/research/SOURCES.md`, standard P0–P4 pending, packet-specific `stopConditions`.

README: `Lifecycle: active` under `## Status` → Mission → Launch → Read This First → Current Phase (named + next action) → Latest Evidence (points at the source MAP) → Notes.

SPEC (the seed pattern): Objective · Non-Goals = exploration no-gos · Source Hierarchy inserts BRIEF/DECISIONS/MAP · Target Surfaces = exact paths (`packages/law-practice/domain`, `PracticeKg.claims.ts`) · Constraints = LiteralKit + 37 CFR 1.77(b) / MPEP 608 / EPO F-IV · Acceptance checkboxes · **First Vertical Slice** copied from the MAP row · **Decision Log** inherited D1–D8, one line each · Stop Conditions.

PLAN: five-row table, ids match manifest. Execution notes: load `schema-first-development`; preserve MAP boundaries. Ceremony packets omit the template's P4 closeout checklist; including it is safer for cold executors.

GOAL.md: **967 chars**. Outcome, In/Out, P0→implement→yeet→reflect. No duplicated acceptance matrix.

SOURCES.md: first paragraph declares the exploration ledger primary and this file a reproduction. Then inherited corpus (licenses + dispositions, sweep reports, in-repo bricks, cross-links). Never fabricate URLs.

Reflections: only `_TEMPLATE.md` — correct for an unstarted packet.

### 5.2 `document-ast-pattern-classification` — sequenced sibling

Same exploration. MAP order 2. `dependencies` / `blockedBy`: `["goals/patent-document-schema"]`. `statusNote`: ships second.

SPEC restates the shared D1–D8 **from this packet's point of view** and walls off sibling scope (SPAR, patent, FOLIO, MCP) in Non-Goals. That is the multi-track discipline: each SPEC is independently abandonable.

PLAN leaner; still id-aligned. GOAL.md **687 chars** (shortest of the three). SOURCES.md is the same inherited corpus as §5.1 — do not invent a per-goal research fan-out at graduation.

README Latest Evidence: "The D5/D7 decomposition and verified source paths in the source MAP." Evidence at scaffold time is the exploration, not a PR.

### 5.3 `identity-iri-fibered` — sequential sibling + prose blockers

From `explorations/identity-as-iri` (`links.goals`: core, fold, fibered). MAP: core → fold → fibered, strictly. Core and fold are `completed-retained`. Fibered graduated 2026-08-13 after fold PR #536 (2026-08-01).

`dependencies: ["goals/identity-iri-core", "goals/identity-iri-fold"]`. `blockedBy` is **prose**, not slugs: semantic-web PR2/PR3 cleanups have no goal packets. README/SPEC: do not treat a branch/PR label as proof; require landed-content evidence. Non-empty `blockedBy` also suppresses `stale-active`.

`researchReports` adds the exploration synthesis + adversarial review (`20-` / `21-*.md`). P0 renamed "Blocker and contract audit"; P1 "Implement full MAP row". SPEC has a **BlockedBy Note** plus acceptance "No P1 work begins before both textual blockers clear."

GOAL.md **864 chars**, leads with the blocker. SOURCES.md reproduces the 12-repo license table (`port-with-attribution` / `REFERENCE-ONLY` / `clean-room`). Missing/unverified license ⇒ reference only.

Closeout bar (predecessor, not 82ee9f8): `goals/identity-iri-fold` — all phases `complete`, `completed-retained`, `statusNote` cites PR #536, reflection `2026-08-01-claude.md` schema-valid and information-rich.

### 5.4 Other 82ee9f8 packets (same skeleton)

- `spar-document-annotation-wire` — campaign #3; Non-Goals wall off PO-as-RDF, patent semantics, FOLIO/MCP.
- `folio-lynx-taxonomy-browse` — campaign #4. `blockedBy` mixes a goal slug **and** `explorations/lynx-lkg-ontology-grounding#artifact-vetting-and-license-proof`. `provenance.relatedExploration` is a live extra key. Consumes a sibling exploration's license decision without absorbing its remaining MAP.
- `epistemic-memory-retention-projections` — third graduate (over months) from `agent-memory-tiers-bitemporal-edges`. `dependencies: ["goals/epistemic-bitemporal-edge-core"]`. `statusNote` encodes a calibration gate: mechanism may proceed; policy stays inert; RRF belongs to `rag-retrieval-projection`.

---

## 6. Multi-track: one packet vs siblings

### 6.1 Dominant precedent — sibling packets from one MAP

| Exploration | Promised-now | Gated leftovers |
| --- | --- | --- |
| `document-structure-ontologies` | 4 siblings (patent → PO → SPAR → FOLIO) | none. "Independently shippable and abandonable." Campaign order ≠ shared scope. |
| `identity-as-iri` | 3 sequential | none. Later siblings wait on completed-retained predecessors. |
| `agent-memory-tiers-bitemporal-edges` | 3, over months | RRF left to another exploration. Reopened at decompose. |
| `typed-agent-skill-contracts` | 1 (`skill-contract-kernel`) | 5 waves stay in MAP. Exploration stays **`active`** at `graduate`. |
| `graphnosis-prior-art` | 2 new + 26 amendments to *existing* packets | Can dissolve rather than mint a mega-packet. |
| `EXAMPLE.md` | 2 siblings | Third idea **killed**, not stuffed. |

If a track is independently shippable, it is a sibling. If gated on a future trigger, it stays in the exploration MAP.

### 6.2 One packet with internal tracks

| Packet | Pattern | Lesson |
| --- | --- | --- |
| `ci-fleet-endgame` | Two **co-primaries** (worker-per-job **and** no 20-min jobs). | Split 2026-08-13: P4 → `ci-fleet-residue`, P5 → `ci-lane-economics`. Parent phases `superseded` + `supersededBy`. P6 close gated on the child so the parent cites both halves. **Two co-primaries are unstable.** |
| `knowledge-surface-automation` | 7 phases, workstreams A–E, `provides` four capabilities including unimplemented `goals/bootstrap`. | Multi-capability via `provides[]`. Heavy. |
| `agent-pipeline-velocity` | "One goal, one PR." | Valid when appetite is a single pass. `mergedPullRequest: 295`. |
| `codex-security-findings-*` | Generated ingest. | Do not copy. |

Supported split: phase `superseded` + sibling successor. Do not invent a new lifecycle token.

### 6.3 Recommendation for this fan-out

Scaffolding and deletion are independently shippable and abandonable. Shared CLI family is adjacency, not a shared acceptance criterion.

**Preferred (82ee9f8 / document-structure):** two siblings.

| Order | Slug | `provides` | First slice |
| --- | --- | --- | --- |
| 1 | `package-deletion` | `tooling/delete-package` | Delete a fixture minted by current `create-package`; catalogs clean. |
| 2 | `experiment-apps-scaffold` | `apps/experiments` | One vite app under `apps/experiments/*`, portless + typecheck, then delete via #1. |

Encode order as `dependencies` / `blockedBy`. Do not merge SPECs. Campaign vertical slice (round-trip) lives in whichever ships second. Gated follow-ups (Storybook variant, gallery, cross-app e2e) stay on a MAP as reopen-at-`decompose` rows.

**Acceptable** if synthesis insists on one packet: two implement phases, `provides: ["apps/experiments", "tooling/delete-package"]` (no self-cycle), SPEC walls tracks in Non-Goals-per-track, split tripwire if either grows a second primary (`ci-fleet-endgame` style).

---

## 7. Research-routine legality

`research/README.md` + `AGENTS.md`:

- Nightly packets are immutable after merge.
- **Machine proposes, human admits.** Nothing auto-appends to `explorations/INBOX.md` or `goals/`. Actions graduate when a human fires a capture command from `SUGGESTED_ACTIONS.md`.
- No explorations ceremony on research packets.
- Friction receipts go in the *active* packet's `research/OPPORTUNITIES.md` at the moment they happen (redact secrets; `~` not home paths).

This fan-out is not the nightly routine and is still bound: **do not drop a bullet in INBOX "for later"** and do not mint `goals/` from research output without an admitted graduation. The synthesis *is* that ceremony — write the packet(s) with four-point DoR content in the prose (or graduate from a real exploration). Direct authorship without an exploration is legal (`goals/README.md` source #1 is "user objective"); it just lacks the DoR paper trail.

---

## 8. Copy-ready template (no scaffolder exists)

Confirmed against live CLI + `honest-repo-signal`: copy `_template`, replace placeholders. One-packet two-track shape below; prefer the sibling split in §6.3 if the synthesis allows.

### 8.1 Tree + commands

```text
goals/experiment-apps-lifecycle/
  README.md  SPEC.md  PLAN.md  GOAL.md
  ops/manifest.json
  research/SOURCES.md
  history/reflections/_TEMPLATE.md    # verbatim from goals/_template
```

```sh
bun run beep goals index --write
bun run beep goals doctor
test "$(wc -m < goals/experiment-apps-lifecycle/GOAL.md)" -le 4000
```

If an exploration exists, set `provenance.exploration` and inherit SOURCES. If not, omit `provenance.exploration` (no back-link advisory) and build SOURCES in P0.

### 8.2 `ops/manifest.json`

```json
{
  "schemaVersion": "initiative-manifest/v2",
  "initiative": {
    "id": "experiment-apps-lifecycle",
    "title": "Experiment Apps Lifecycle",
    "status": "active",
    "created": "2026-08-13",
    "updated": "2026-08-13",
    "packetAnchorDocument": "SPEC.md"
  },
  "packetPath": "goals/experiment-apps-lifecycle",
  "lifecycle": "active",
  "mission": "Scaffold law-abiding apps/experiments/* via create-package variants and fully prune packages/apps with delete-package.",
  "statusNote": "Two tracks: apps/experiments (nextjs, vite, tauri) and tooling/delete-package. Split if either grows a second primary.",
  "executionCapable": true,
  "reflectionRequired": true,
  "provenance": {
    "note": "Authored from the 2026-08-13 six-lane fan-out. Set provenance.exploration if an explorations/* packet graduates into this."
  },
  "dependencies": [],
  "blockedBy": [],
  "provides": ["apps/experiments", "tooling/delete-package"],
  "requires": [],
  "completionGate": {
    "operator": "yeet",
    "requiresPullRequest": true,
    "requiresMergeable": true,
    "statement": "Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (bun run beep yeet: repair -> verify -> publish --pr -> monitor).",
    "grandfathered": false
  },
  "currentSourceOfTruth": [
    "AGENTS.md",
    "CLAUDE.md",
    "goals/experiment-apps-lifecycle/README.md",
    "goals/experiment-apps-lifecycle/SPEC.md",
    "goals/experiment-apps-lifecycle/PLAN.md",
    "goals/experiment-apps-lifecycle/GOAL.md",
    "goals/experiment-apps-lifecycle/research/SOURCES.md"
  ],
  "researchReports": ["research/SOURCES.md"],
  "agentLaunchers": [
    {
      "kind": "codex-goal",
      "path": "GOAL.md",
      "targetChars": 3500,
      "maxChars": 4000,
      "command": "/goal follow the instructions in goals/experiment-apps-lifecycle/GOAL.md"
    }
  ],
  "phases": [
    { "id": "P0", "name": "Research", "status": "pending" },
    { "id": "P1", "name": "Implement experiment-app variants", "status": "pending" },
    { "id": "P2", "name": "Implement delete-package", "status": "pending" },
    { "id": "P3", "name": "Verify both tracks", "status": "pending" },
    { "id": "P4", "name": "Yeet: PR to mergeable", "status": "pending" },
    { "id": "P5", "name": "Close", "status": "pending" }
  ],
  "verificationCommands": [
    "test \"$(wc -m < goals/experiment-apps-lifecycle/GOAL.md)\" -le 4000",
    "jq . goals/experiment-apps-lifecycle/ops/manifest.json",
    "rg -n \"experiment-apps-lifecycle|GOAL.md|agentLaunchers|packetAnchorDocument\" goals/experiment-apps-lifecycle",
    "git diff --check -- goals/experiment-apps-lifecycle",
    "bun run beep lint reflection-artifacts",
    "bun run beep goals doctor",
    "bun run beep goals index --check"
  ],
  "stopConditions": [
    "A variant would require relaxing repo laws (schema-first, effect-first, portless wrapping, identity registration).",
    "delete-package cannot name a closed, testable set of config surfaces without a live inventory.",
    "Either track would absorb unrelated create-package or architecture-command work.",
    "Verification requires unnamed credentials, cost, destructive side effects, or policy approval.",
    "The same blocker repeats after reasonable investigation."
  ]
}
```

Two implement phases ⇒ P5 Close (PLAN ids must match). Sibling split: two standard P0–P4 manifests, one `provides` each.

### 8.3 `README.md` (Lifecycle line is load-bearing)

```markdown
# Experiment Apps Lifecycle

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Law-abiding `apps/experiments/*` via `beep create-package` variants (nextjs,
vite, tauri) and a `beep delete-package` that prunes every config surface.

## Launch

```text
/goal follow the instructions in goals/experiment-apps-lifecycle/GOAL.md
```

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`research/SOURCES.md`](./research/SOURCES.md)

## Current Phase

P0 Research: inventory every surface `create-package` writes and every surface
humans still edit by hand when adding or removing a package/app.

## Latest Evidence

Not started.

## Notes

Two tracks, one packet. Split (`superseded` phase + sibling) if either track
grows a second primary.
```

Doctor/`set-status` regex `Lifecycle:`. Do not paraphrase.

### 8.4 SPEC / PLAN / GOAL / SOURCES

**SPEC** (gold section order): Objective (both tracks, observable) · Non-Goals (production `apps/` that are not experiments; relaxing portless; implementing `beep goals bootstrap`; architecture-command redesign; deleting git history) · Source Hierarchy (insert exploration BRIEF/MAP/DECISIONS if any) · Target Surfaces — **P0 names the live write-set**; do not invent the catalog list before inventory (`CreatePackage/`, future `DeletePackage/`, `apps/experiments/`, tsconfig/turbo/identity/workspaces/portless) · Constraints (schema-first, effect-first, portless `http://<name>.beep.localhost:1355`, identity registration, closed LiteralKit `nextjs | vite | tauri`, delete is complete) · Acceptance checkboxes per track · **First Vertical Slice** = scaffold a throwaway vite experiment app, prove typecheck + portless, `delete-package` it, prove catalogs clean · Decision Log (inherit from the fan-out; do not leave empty) · Stop Conditions (match manifest) · Exception Ledger (`None` until real).

**PLAN** table (ids = manifest). Include the template closeout checklist: `/reflect` → `lint reflection-artifacts` → `set-status … completed-retained`.

**GOAL.md** (ceremony-batch size, not template size):

```markdown
# GOAL: Ship experiment-app variants and delete-package

Repo root: the current beep-effect checkout. Do not assume an absolute path.

Outcome: `beep create-package` mints a law-abiding app under
`apps/experiments/*` for nextjs, vite, and tauri, and `beep delete-package`
prunes every inventoried config surface.

Read README.md, SPEC.md, PLAN.md, ops/manifest.json, and repo instructions
first. Repo standards outrank packet prose.

Scope:
- In: create-package variants, delete-package, apps/experiments conventions,
  inventoried catalogs, focused tests, this packet.
- Out: production apps, goals bootstrap, architecture-command redesign,
  relaxing portless or schema-first laws, unrelated CLI work.

Workflow:
1. P0 inventory of create-package write-set and leftover manual surfaces.
2. Smallest variant that serves portless and typechecks.
3. delete-package as that write-set's inverse; prove with a round-trip.
4. Preserve unrelated worktree changes.
5. Publish through yeet; cite `experiment-apps-lifecycle` in the PR title.
6. At Close, write history/reflections/<YYYY-MM-DD>-<agent>.md via /reflect
   and `beep goals set-status experiment-apps-lifecycle completed-retained`.

Stop if a named stop condition fires. Done when SPEC acceptance passes and
the PR is merge-ready, or a blocker is reported with file/command evidence.
```

**SOURCES.md:** start from `_template/research/SOURCES.md`. If no exploration, say so. Fill §2–§4 in P0: Next/Vite/Tauri licenses + disposition; in-repo bricks (`CreatePackage`, identity registration, portless, workspace catalogs) marked reuse / extend / NET-NEW. Never fabricate URLs. Cite `goals/knowledge-surface-automation` and `goals/honest-repo-signal` for bootstrap-not-implemented.

---

## 9. Closeout sequence and in-flight redesign

1. If design is still open, run an exploration first. If the fan-out settled the brief, the synthesis may author `goals/` directly — SPEC must still carry DoR content.
2. Copy `_template`; no leftover `<slug>` placeholders.
3. `status` = `lifecycle` = README `Lifecycle:` = `active`.
4. `beep goals index --write` in the **same commit** that adds the packet.
5. Execute via `/goal … GOAL.md`.
6. Yeet. **Slug in the PR title.** Record `mergedPullRequest` at closeout.
7. Same PR: reflection + `lint reflection-artifacts` + `set-status <slug> completed-retained`.
8. Do not flip a graduated exploration back to active unless a MAP gate fired.

`explorations/packet-system-redesign` is shape-stage (CAS events, derived lifecycle, fifth MAP check, `DESIGN.md`). **Not law.** New packets match today's `_template` + v2 + four-point DoR. Do not add `ops/events/` or `DESIGN.md` until that exploration graduates and a goal ships the machinery.

---

## 10. Synthesis scorecard

- [ ] From `goals/_template` (or two copies).
- [ ] Manifest decodes (`id` + canonical status + `completionGate`); v2; `status` == `lifecycle` == `Lifecycle:`.
- [ ] `packetAnchorDocument: SPEC.md`; `GOAL.md` ≤ 4000; `agentLaunchers` present.
- [ ] `mission` one-liner; `reflectionRequired: true`; `grandfathered: false`.
- [ ] `provides` real CapabilitySlugs; no self-cycle.
- [ ] PLAN ids match `phases[]`.
- [ ] SPEC has Non-Goals, surfaces, constraints, acceptance, first slice, decision log, stops; walls sibling/track scope.
- [ ] SOURCES exists; no fabricated URLs; licenses have dispositions.
- [ ] Reflections dir has `_TEMPLATE.md` only (no fake closeout).
- [ ] `INDEX.md` regenerated same commit; doctor introduces no new blockers.
- [ ] If from an exploration: DoR recorded, manifests cross-linked, SOURCES inherited, ATLAS updated, gated leftovers left in the MAP.
- [ ] Closing PR title cites the slug; reflection + `set-status` land in that PR.

Product design (variant matrix, prune surface list) belongs in the other lanes and in this SPEC after those lanes settle — not here.
