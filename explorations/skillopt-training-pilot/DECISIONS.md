# Decisions

<!--
Stage 2. One entry per resolved branch-closing question, newest last.
The first five are seeded from the grill-with-docs session of 2026-07-06
(successor-initiative planning) — locked with the user before this packet
opened; recorded here so this packet is self-contained.
-->

## 2026-07-06 — pilot target skill (grill, seeded)

**Question:** Which skill does the SkillOpt pilot train first?

**Answer:** **schema-first-development** (user override of the recommended cheap pilot repo-symbol-discovery).

**Rationale:** Highest-value target whose compliance is machine-checkable by the repo's own law machinery (schema-first lint + tsgo diagnostics) — the scorer is the point, not an obstacle. Costs: rollouts are minutes each; the eval harness must exist first. Rejected: repo-symbol-discovery (cheap but low-stakes), both-staged (appetite doubles).

## 2026-07-06 — success bar & park condition (grill, seeded)

**Question:** What does pilot success mean?

**Answer:** **Loop runs; lift informs.** Success = full training loop end-to-end on ≥10 scored tasks with the validation gate holding (non-regressing best_skill.md); measured lift recorded as evidence, not gated. Park condition: harness integration infeasible within appetite → park with findings.

**Rationale:** First pilots measure machinery, not ceiling; a noisy first eval set must not fail a working loop. Rejected: require measured lift; require production adoption.

## 2026-07-06 — provisioning (grill, seeded)

**Question:** How is pip-installed SkillOpt provisioned in a repo with zero Python conventions?

**Answer:** **flake.nix python3 + uv, committed pyproject.toml + uv.lock** (home: decided at decompose; default a small tools/ dir in the goal packet or tooling family).

**Rationale:** Matches the everything-is-pinned posture (bun.lock, skills-lock, catalog). Rejected: gitignored ad hoc venv (irreproducible), container (slow iteration; harness drives host CLIs).

## 2026-07-06 — execution labor (grill, seeded)

**Question:** Who implements?

**Answer:** Codex sub-agents implement; Claude orchestrates, reviews, verifies, performs GitHub writes. Worktree lanes inherit the quality-gate-ratchets conventions (codex cwd = worktree; codex cannot commit in worktrees; deliverable-on-disk).

## 2026-07-06 — scope boundary vs adoption (grill, seeded)

**Question:** Does the pilot ship the trained skill?

**Answer:** **No.** Adoption of best_skill.md is explicitly out of scope — a follow-on decision made with lift data in hand. The pilot's deliverables are the harness, the corpus, the run report, and the park-or-proceed verdict.

## 2026-07-06 — BRIEF sign-off

**Question:** Does the shaped pitch match the user's picture?

**Answer:** **Signed off as drafted** — corpus-from-history, scalar law-scorer, worktree rollout runner, one gated PR + local training runs, B5 Phoenix as stretch, park-with-findings legitimate.

**Rationale:** Offered reshape-smaller (drop B5 / lower corpus floor) and reshape-bolder (two-skill / SkillOpt-Sleep); both declined.

## 2026-07-06 — harness/corpus code home

**Question:** Extend `beep agent-effectiveness` vs goal-packet-local tools/?

**Answer:** **Extend the `beep agent-effectiveness` command family** (`@beep/repo-cli` + `@beep/repo-ai-metrics`) — e.g. `beep agent-effectiveness evals ...`; the uv/pyproject for SkillOpt lives in a small root `tools/skillopt/` directory.

**Rationale:** Tooling family already owns eval semantics, Phase-1 surfaces, and Phoenix bundles; the harness becomes durable eval infrastructure under CLI conventions (identity, schemas, tests) instead of dying with the packet. Rejected: packet-local tools/ (non-reusable, convention-exempt).
