# Agent Pipeline Velocity Spec

## Objective

In a single PR: (1) both agent runtimes (Claude Code, Codex) receive the same
universal repo laws from a single generated source with a drift gate; the three
heavyweight skills load via progressive disclosure; `.claude/settings.json`
carries a curated permission allowlist. (2) The PR-review lineup is
greptile-only (coderabbit/chatgpt gates off by default, apps deactivated).
(3) PR CI lanes read the turbo remote cache (read-only; push stays
read-write). (4) main's check-runs report zero failures. (5) yeet phase
wall-times are measured, feedback concurrency is rebenchmarked (3 → measured
optimum), and `yeet verify` full tier gains hosted-parity lanes (lint-policy,
BASE-config gitleaks, fallow advisory). (6) A `beep worktree` command
(new/remove/doctor) automates the standards/git-worktrees.md bootstrap.
Measured before/after deltas recorded per rqt convention (rqt-011+).

## Non-Goals

- Branch protection / rulesets on main (deferred past this goal).
- Multiple or stacked PRs.
- Full crispen-ultra cleanup of Yeet/Quality internals (only
  optimization-unblocking refactors; the rest → debt ledger).
- External build-tooling swaps (oxlint/rolldown/etc. — rqt-010 waiver stands).
- Burning the full 2,003-item jsdoc @example backlog (only CI-blocking warnings).
- Forced/flag-day worktree migration of in-flight clones.
- Any net growth of always-loaded context (CLAUDE.md/AGENTS.md size budget holds).

## Source Hierarchy

1. User objective (exploration CAPTURE + 9 locked DECISIONS, 2026-07-05).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`yeet`, `explore`, `reflect`, `crispen`).
3. Governing standards: `standards/ARCHITECTURE.md`, `standards/git-worktrees.md`, `goals/repo-quality-throughput/` conventions (proof-parity-map, rqt numbering).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `.github/workflows/check.yml` (PR cache policy; CSF-001 amendment comment).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/{Planner,Closeout,Handler,Status}.ts`.
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (parity lanes).
- New `packages/tooling/tool/cli/src/commands/Worktree/` (+ tests, barrel, command registration).
- Root `CLAUDE.md` + `AGENTS.md` + new single-source input + generator/drift check.
- 14 nested package CLAUDE.md/AGENTS.md files (audit: dedupe/shrink/delete).
- `.claude/skills/{effect-first-development,turborepo,atom-reactivity-specialist}/` (+ `skills-lock.json`, `.codex/config.toml` re-pin).
- `.claude/settings.json` (permissions allowlist).
- `standards/git-worktrees.md` (helper flow), `.claude/skills/yeet/SKILL.md` (gate lineup).
- `goals/{agent-effectiveness-phoenix-enrichment,agent-effectiveness-workflow-integration,yeet-operator-clarity,yeet-pr-closeout-loop}/ops/manifest.json` (supersede).
- GitHub App config (browser-side, via Claude-in-Chrome): CodeRabbit + ChatGPT review deactivation.

## Constraints

- **Sequencing gate**: PR #291 (`codex/yeet-verify-repair`) merges before code-touching phases.
- **Fable-direct**: Phase-D analysis/redesign by Fable only; Codex executes specified changes.
- Instrument-before-optimize: no Phase-D change lands without a recorded baseline.
- No gate weakened: parity additions strengthen local proof; closeout keeps greptile score/issue gates.
- gitleaks allowlist changes must land on main first (hosted reads BASE config).
- Concurrency benchmark must watch memory pressure (tsgo/vitest per-package on 128GB).
- GOAL.md ≤ 4,000 chars. Conventional commit messages only (this PR models the fixed hygiene).
- Preserve unrelated worktree changes (user + codex agents work in parallel checkouts).

## Acceptance Criteria

- [ ] `gh api repos/{owner}/{repo}/commits/main/check-runs` → 0 failing after quick strikes.
- [ ] PR CI logs show remote-cache HITs with zero uploads on a PR event.
- [ ] Default closeout gate set = hosted-checks + review-threads + greptile; coderabbit/chatgpt only via explicit flags; apps deactivated.
- [ ] Generated CLAUDE.md + AGENTS.md are byte-identical to generator output (drift check command exists and passes; both files carry all universal rules).
- [ ] Combined SKILL.md bytes for the 3 heavyweight skills reduced ≥50% with content preserved under `references/`; skills-lock + .codex/config.toml re-pinned.
- [ ] Fresh-session smoke: allowlisted read-only + verify commands run without permission prompts.
- [ ] Yeet phase wall-times visible in `yeet status`/summary output; baseline + post-change timings recorded in packet history (rqt-011+ entries with measured deltas).
- [ ] `yeet verify` full tier runs lint-policy, BASE-config gitleaks, and fallow-advisory equivalents.
- [ ] `beep worktree new smoke && beep worktree doctor && beep worktree remove smoke` round-trips green.
- [ ] 4 superseded manifests updated; ATLAS + exploration cross-links in place.
- [ ] Closeout reflection exists; `bun run beep lint reflection-artifacts` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/agent-pipeline-velocity/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/agent-pipeline-velocity/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/agent-pipeline-velocity` | Passes |
| Main green | `gh api repos/:owner/:repo/commits/main/check-runs --jq '[.check_runs[]|select(.conclusion=="failure")]|length'` | `0` |
| Instruction drift | generator `--check` mode (added this goal) | Passes |
| Worktree helper | `bun run beep worktree new smoke && bun run beep worktree remove smoke` | Passes |
| Full proof | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (esp. crispen creep beyond optimization-unblocking).
- A change would weaken full proof, hosted checks, or closeout gates.
- Verification requires unnamed credentials, cost, destructive side effects, or policy approval.
- Concurrency increase causes OOM/thrash — record measured ceiling instead of forcing target.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
