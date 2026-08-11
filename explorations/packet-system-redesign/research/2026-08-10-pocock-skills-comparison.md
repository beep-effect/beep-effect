# Pocock skills vs beep-effect: workflow comparison + drift audit

**Date:** 2026-08-10 · **Sources:** local clone `~/YeeBois/dev/mattpocock-skills`
at `84fdeff` (2026-08-06, in sync with origin/main), https://www.aihero.dev/skills
(scraped 2026-08-10), skill files both sides. **License:** MIT — port with
attribution.

## 1. His workflow, mapped to ours

aihero groups 23 skills by when you reach for them; beep's equivalents:

| Pocock group | His skills | beep equivalent | Verdict |
| --- | --- | --- | --- |
| Getting started | setup-matt-pocock-skills, ask-matt (router) | CLAUDE.md laws + skill frontmatter triggers | Covered differently; a router is unnecessary at beep's skill-count with rich triggers |
| **Main flow** | grill-with-docs → to-spec → to-tickets → implement → code-review | explore align/shape → graduation SPEC seeding → MAP/PLAN phases → goal launcher → yeet + quality loops | Same spine. His is conversation-scoped; beep's is packet-scoped (durable, resumable, fleet-shared) — beep's is strictly stronger for multi-session work |
| Shaping | wayfinder (decision map on tracker), prototype, research | exploration packets + DECISIONS.md; scratchpad experiments; /explore research + deep-research lanes | Covered. Wayfinder ≈ exploration packet with tracker persistence; packets win on provenance |
| Upkeep | improve-codebase-architecture, diagnosing-bugs, resolving-merge-conflicts, triage, wizard | fallow/crispen/quality-review-fix-loop; codex rescue; (no merge-conflict or wizard skill) | Mostly covered by stronger repo-native machinery |
| Productivity | grill-me, handoff, to-questionnaire, teach, wait-what, writing-for-agents | grill-me, teach; durable on-disk handoffs *law* but no skill; AskUserQuestion covers to-questionnaire's sync case | Gaps: handoff, writing-for-agents, wait-what |
| Reference (shared disciplines) | **grilling**, domain-modeling, codebase-design, tdd | — (beep skills each carry their own protocol) | **The structural idea beep lacks**: user-invoked thin pointers over model-invoked shared disciplines |

Philosophy match: his README's anti-GSD/BMAD/Spec-Kit stance ("small, easy to
adapt, composable; frameworks own the process and make process bugs
unfixable") is the same conclusion lane 1/2 research reached and that D-series
decisions encode. beep is already on his side of that argument — with a
heavier, packet-native spine that suits a fleet rather than a solo operator.

## 2. Drift audit: the three vendored skills

| Skill | Local state | Upstream state (84fdeff) | Verdict |
| --- | --- | --- | --- |
| `teach` | 9,507 B + 4 format refs | identical | **Byte-identical, current.** |
| `grill-me` | thin pointer: "Run a `/grilling` session." | same | **Pointer is current but BROKEN locally: no `/grilling` skill exists in the repo** (nor user-level — `~/.claude/skills/grill-me` is the old fat one-question-at-a-time version, shadowed by the project copy). Typing /grill-me today resolves to a dangling reference. |
| `grill-with-docs` | 8,211 B repo-native fork (standards/ARCHITECTURE surfaces, GLOSSARY/DECISIONS routing, promotion records) + repo-adapted ADR-FORMAT/CONTEXT-FORMAT | 245 B: "Run a `/grilling` session, using the `/domain-modeling` skill." | Local fork is a *deliberate, good* adaptation (upstream's generic CONTEXT.md/docs-adr model was correctly rerouted to beep's standards surfaces). But it predates the upstream protocol refactor, so it never got the grilling improvements. |

## 3. The upstream improvement that matters: frontier-rounds grilling

Upstream PR #788 (`grill-me-align`, 2026-08-06) landed a rewritten shared
`grilling` discipline. Protocol delta vs beep's current "one branch-closing
question at a time" (encoded in /explore align, grill-with-docs, grill-me):

1. **Design tree + frontier**: model the session as a decision tree; the
   frontier = every question whose prerequisites are settled.
2. **Rounds, not single questions**: ask the *whole frontier* per round,
   numbered, each with a recommended answer (❓ **Q1** … ➡️ format); wait;
   recompute; next round. Dependent questions wait for later rounds.
3. **Facts never reach the user**: environment questions dispatch subagents;
   a running exploration is an unsettled prerequisite — only its downstream
   questions wait, the rest of the frontier is asked now.
4. **Done = empty frontier**, and no acting until the user confirms shared
   understanding.

This is strictly better for an operator whose attention is the fleet
bottleneck (lane 6): one-at-a-time serializes every round-trip; frontier
rounds batch independent decisions — exactly the D-series approval-batching
economics applied to grilling itself. It maps directly onto AskUserQuestion's
multi-question calls (up to 4/call = a paged round). Note today's align
session ran 11 questions serially; under frontier rounds Q1/Q3 gating the
rest would have been round 1, with most of Q4–Q11 batched into round 2.

Other upstream deltas worth noting (v1.1/v1.2 changelogs): harness-neutral
subagent language, secrets redaction in diagnosing-bugs, neutral third-person
docs voice, `agents/openai.yaml` Codex metadata on every skill (local
grill-with-docs lacks one; local grill-me/teach have them).

## 4. Suggestions (ranked)

**Disposition 2026-08-10 (operator):** #1 grilling core fix APPLIED same day
(new `.claude/skills/grilling/` with AskUserQuestion + packet bindings;
grill-with-docs re-pointed at it, its repo-surface body kept, openai.yaml
added; /explore align + guardrail updated to frontier rounds). #2 two-axis
code-review, #4 handoff, #5 writing-for-agents: NOT selected now — #2
remains live inside this packet as the conformance-critic shape
(RESEARCH.md §A6) rather than a standalone skill port.

1. **Vendor a repo-adapted `/grilling` discipline skill** carrying the
   frontier-rounds protocol, with two beep-specific bindings: rounds are
   delivered via AskUserQuestion (≤4 questions/call, paging longer
   frontiers), and when run inside an exploration align stage each settled
   round appends dated DECISIONS.md entries + syncs manifest
   `openQuestions`. Fixes the dangling grill-me pointer as a side effect.
2. **Re-point `grill-with-docs` at the shared discipline**: keep the entire
   repo-surface body (it is the repo's `domain-modeling` equivalent and
   better than upstream's generic one), but replace its bespoke
   "one-at-a-time" interview protocol section with "run /grilling"; add the
   missing `agents/openai.yaml`. Update `/explore` align wording ("one
   question at a time" → frontier rounds via /grilling) and `/adhd`/other
   grill mentions opportunistically.
3. **Port the two-axis `/code-review` idea (Standards × Spec)** adapted to
   packets: spec axis reviews the diff against the owning goal's SPEC.md /
   change tree ("implements REQ-X and nothing else") as a read-only critic.
   This is not just a skill port — it is the plan-vs-diff checker the
   packet-redesign traceability decisions (RESEARCH.md §A6, lane 5 §5.5)
   already call for; porting the skill shape gives the redesign its critic
   for free.
4. **Port `/handoff`** adapted to the repo's durable-handoff law (packet
   `ops/handoffs/` or scratchpad as target, not chat) — the law exists but
   has no operating procedure; upstream's skill is the missing procedure.
5. **Port `/writing-for-agents`** as the skill-authoring discipline — beep
   authors skills constantly and has no rubric skill; upstream's pairs well
   with the Anthropic best-practices findings already cited in lane 2.
6. **Skip (covered or low-value here):** ask-matt router (frontmatter
   triggers already route), to-spec/to-tickets/implement/tdd (goals packets
   + yeet own this spine; tracer-bullet blocking edges are already a
   packet-redesign task-graph input), wayfinder (exploration packets),
   triage/wizard/prototype (repo-native equivalents or niche),
   wait-what/to-questionnaire (nice-to-have operator UX; AskUserQuestion
   covers the sync case).

## 5. Relevance back to this packet

- Frontier-rounds grilling is *approval batching for decisions* — same
  economics as D-series K/lane-6 conclusions; adopting it is dogfooding.
- Two-axis review's Spec axis is the concrete critic shape for the
  REQ→diff conformance gate (D-traceability).
- Upstream's user-invoked-pointer / model-invoked-discipline split is the
  structural pattern the redesign's "few evaluated skills over command
  behavior" guardrail (pass 2) should follow.
