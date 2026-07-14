# Harness Hygiene Mechanical Spec

## Objective

The agent-facing instruction surface sheds confirmed dead weight and gains
the three laws agents repeatedly requested — via evidence-cited, mechanical,
no-regret edits only.

## Non-Goals

- No law DELETIONS (lint-duplicated Code Laws stay until H1 evidence or a
  replay-eval gate exists — pulse DECISIONS 2026-07-14).
- No skill consolidation (the effect-first/schema-first collision clusters
  and proxy-only skills are a later, evidence-gated decision).
- No changes to nested AGENTS.md files, hooks, settings, permission
  allowlists, or CI.
- No workflow/branch-discipline mandates (attribution is owned by
  `goals/harness-otel-adoption`).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `.claude/skills/{ponytail-audit,ponytail-debt,ponytail-gain,ponytail-help}`
  — delete (zero invocation signal across both harnesses, fleet-wide:
  `explorations/agent-effectiveness-pulse/research/pulse/skill-usage.md`).
- `AGENTS.md` (root; CLAUDE.md symlink) — single batched edit.
- Owned destination surfaces for evicted volatile prose (e.g.
  `standards/memory-architecture/` for the memory/Graphiti operational
  details; keep only a one-line pointer in AGENTS.md).

## Constraints

- AGENTS.md is the prompt-cache prefix: all edits land as ONE batched change;
  the file must get shorter or same-size overall (adding the three laws must
  be offset by the volatile-state eviction).
- Each of the three laws is written with its honest evidence framing:
  - Same-PR packet-state flips: requested in 11 reflections; H4 refuted
    (goal staleness is rare) and H9 partial — this is agent ergonomics, not
    drift prevention. Keep it one or two lines.
  - Verification-failure attribution taxonomy (introduced / inherited /
    unrelated / environment-only): requested in 6 reflections; complements
    yeet's green promise.
  - Durable on-disk handoffs for agent/session transitions: 10 reflections;
    deliverable-on-disk over chat-only handoff.
- Deleted skills: confirm no references remain (`rg -n "ponytail-(audit|debt|gain|help)"`)
  in skills, docs, settings, and plugin manifests; the base `ponytail` and
  `ponytail-review` skills stay (proxy-only signal exists).
- Evicted prose must land in an owned surface, not be deleted (memory
  architecture decision log stays authoritative).
- Model economy: Fable 5/Opus plan, design, and review only; all token-heavy
  execution lanes run on codex `gpt-5.6-sol` at `--effort medium` (operator's
  weekly Fable 5 limit is the scarce resource — pulse DECISIONS 2026-07-14
  "subagent-economy").
- Exploration provenance: `explorations/agent-effectiveness-pulse`
  (pre-audit: `research/2026-07-13-agents-md-preaudit.md`; usage:
  `research/pulse/skill-usage.md`; hypotheses:
  `research/pulse/closeout-hypotheses.md`).

## Acceptance Criteria

- [ ] The four skill directories are gone and no dangling references remain.
- [ ] AGENTS.md contains the three new laws, no volatile operational state
      (dated migrations, deprecation schedules, MCP provisioning detail),
      and is not longer than before the change.
- [ ] Evicted prose lives at its owned surface with a pointer from AGENTS.md.
- [ ] Each law's packet evidence is cited in this packet's history notes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/harness-hygiene-mechanical/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/harness-hygiene-mechanical/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/harness-hygiene-mechanical` | Passes |
| Dead skills gone | `test ! -d .claude/skills/ponytail-audit` (and the other three) | Passes |
| No dangling refs | `rg -n "ponytail-(audit\|debt\|gain\|help)" --glob '!explorations/**' --glob '!goals/**'` | No hits |
| Laws present | `rg -n "same-PR\|attribut\|handoff" AGENTS.md` | Three laws found |
| Prefix size | `wc -c AGENTS.md` before/after recorded in evidence | Not larger |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- A deleted skill turns out to be referenced by tooling (plugin manifests,
  hooks) — stop and report instead of force-deleting.
