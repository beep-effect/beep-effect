# Knowledge-Surface Audit & Automation — PLAN

Execution order is ratified (see SPEC.md). Phases map to `ops/manifest.json`.

## P0 — Seed: packet + prior-ritual lessons (complete)

1. Hand-create this packet on branch `knowledge-surface-automation` (done — this is it;
   it deliberately predates `beep goals bootstrap` so Workstream E's doctor can adopt it
   as its first test case).
2. Mine prior-ritual lessons into `research/prior-ritual-lessons.md`: closeout
   reflections / decision logs of `goals/agent-effectiveness-loop`,
   `goals/agent-pipeline-velocity`, `goals/ai-metrics-stack`, `goals/goals-doctor`,
   ratchet packets, and `tools/skillopt`.
3. Baseline inventories: `research/surface-inventory.md` (clone-agnosticism scan, skills
   provenance/drift, manifest + index state) and `research/cli-ground-truth.md` (exact
   existing CLI surface the workstreams extend).

Exit: research trio exists, packet validates against `beep goals doctor`, branch pushed.

## P1 — Phase-0 read-only reports

- C Stage-1 scanner slice: versioned `KnowledgeFinding` Effect Schema + golden tests on
  paired base/HEAD fixture archives (edit, reflow, rename, command, assertion) proving
  only semantic additions surface. No gate wiring yet.
- `beep skills provenance <skill>` for ONE GitHub-backed customized skill; explicit
  upstream repo+commit resolution task for every skills.sh-sourced skill.
- `beep knowledge refs --tree HEAD --json` over current repo-relative and machine-local
  references in agent-facing files, plus representative `repo://goal/*` fixtures;
  resolve tracked targets and goal slugs, classify false positives, and measure
  mismatches.
- Manifest graph inventory + decode tests (additive `provides`/`requires` decode proof).
- Workstream E pure-plan report: `beep goals bootstrap --plan --json` for a representative
  input and `beep goals adopt knowledge-surface-automation --plan --json` for this packet;
  report paths, ownership boundaries, preservation decisions, and validation requirements
  without writing.

Rule: read-only. No mutation until each report's false-positive rate is eyeballed.

## P2 — Grill remaining decisions

Grill the six open items in SPEC.md with Benjamin; outcomes land as their own docs-only
PR before any implementation PR (per feedback-grill-decisions-pr-separation).

## P3 — Workstream A rewrite + hermetic lane; C Stage-1 gate

- ast-grep/comby rewrite rules shipped into the repo; mechanical path rewrite pass;
  scan becomes the standing diff-scoped gate.
- Hermetic clean-clone lane (emptied `$HOME`); ASLR torture variant as an optional
  scheduled lane.
- C Stage-1 semantic-delta gate wired into the existing quality job.

## P4 — Workstreams B, D, E behind gates; C Stage 2

- B: snapshot + patch series + materialize/check + clearing house + hunk ledger.
- D: manifest `provides`/`requires` + bun:sqlite projection + `next`/`explain` +
  Mermaid INDEX block; evidence receipts with C; scout, respec --dry-run, relics.
- E, only after Benjamin reviews P1's pure-plan report: compileMaterializationPlan +
  bootstrap/graduate/adopt + atomic publish + capsules; adopt THIS packet as the first
  adoption case.
- C Stage 2 (sealed baseline + counterfactual tests + debt leases + causal grouping)
  only after Stage-1 precision is proven.

## P5 — Renovate schedule + recurring review ritual

Renovate regex manager on `skills-lock.json` (pending P2 confirmation), monthly HITL
hunk-review ritual with ledger + ghost replay, batch report parent PR.

## P6 — Close

Same-PR packet-state flip, closeout reflection via `/reflect`, gates remain standing.

## Deliverable discipline

- Every workstream's first shipped artifact is its Phase-0 report command.
- Grill outcomes are docs-only PRs, separate from implementation PRs.
- Spin-offs (context rent, bitemporal --as-of) are captured as explorations, not built.
