# Goal Portfolio Driver Plan

## Status

Status: `active`

## P0 — Harden

- [x] Enable and fresh-read the repository auto-merge flag.
- [x] Apply the scoped permissions diff and verify that a deny rule blocks.
- [x] Create the dedicated portfolio-driver worktree and packet scaffold.
- [x] Deliver `research/deep-research-2026-07-14.md` on residual operational risks.
- [x] Merge PR #409 through the gated auto-merge pipeline.
- [x] Confirm the GitHub token has `workflow` scope (refreshed 2026-07-16) or record the B7
      parking rule.
- [x] Complete the flaky PGLite teardown fix dry run (PR #414, squash e48f4c12) and the Test Unit
      fix-forward (PR #412 via armed auto-merge, squash 34f7300c); main `Test Unit` and
      `Test Integration` both green on run 29542058642.
- [x] Run unattended Codex-Chrome QA smoke twice (ops/qa-smoke/, 2/2 pass via Chrome extension
      bridge); Claude-in-Chrome fallback documented.
- [x] Fresh-read every P0 exit criterion and make the packet goals-doctor-green.

Exit: permissions and auto-merge hardening remain verified; the flaky-test dry run, PR #409,
QA smoke/fallback, and packet scaffold are proven through their named gates.

## P1 — Scaffold + Queue

- [x] Dispatch background research across all active packet SPECs (four codex sweep groups).
- [x] Record dependency edges, sequential PR units, and frontend flags in
      `research/dependency-sweep-{1..4}.md`; synthesis lives in `ops/queue.json` and
      `research/decisions-locked.md`.
- [x] Seed the plan's named dependency edges and validate every queue slug against INDEX.
- [x] Apply only the small ROADMAP driver note required by the design (post-#407 reconcile left
      no stale rows to refresh).
- [x] Lock `ops/queue.json` in dependency order by setting `locked` to `true` (grill D1/D2).
- [ ] Verify queue JSON, goals doctor, INDEX check, ROADMAP references, and full Yeet proof.
- [ ] Ship the scaffold and locked queue through the complete gated PR pipeline.

Exit: a static, dependency-ordered queue is merged and live status remains owned by INDEX.

## P2 — Drain Loop

- [ ] Launch Claude Fable with
      `/goal follow the instructions in goals/goal-portfolio-driver/GOAL.md`.
- [ ] Start the self-paced `/loop`: immediate for local work, about five minutes when all work is
      waiting on hosted checks or background jobs.
- [ ] Maintain at most two edit lanes, two monitor slots, one verify mutex, and serialized merges.
- [ ] Advance every eligible lane one state-machine transition per wake.
- [ ] Regenerate `ops/status.md` and locally commit loop state on every transition.
- [ ] Park exhausted goals with incident records and continue unless a breaker fires.
- [ ] Continue until `queue intersect INDEX.active` is empty or a global breaker halts the loop.

Exit: every queue goal is merged and `completed-retained`, or the exact breaker is recorded.

## P3 — Final Audit

- [ ] Dispatch a fresh audit subagent that is not the driver.
- [ ] Prove every queue slug is `completed-retained` with merged-PR evidence.
- [ ] Prove there are no open `goals/*` PRs and no leftover `lane-*` worktrees.
- [ ] Prove the incident ledger is empty or every remaining incident is explicitly accepted.
- [ ] Write `history/outputs/LEDGER.md` with the complete evidence map.

Exit: the ledger proves the portfolio Definition of Done from fresh sources.

## P4 — Close

- [ ] Snapshot final loop state and include the ledger in this packet's closing PR.
- [ ] Write the closeout reflection via `/reflect`.
- [ ] Run `bun run beep lint reflection-artifacts`.
- [ ] In the same final PR, set `goal-portfolio-driver` to `completed-retained` and regenerate INDEX.
- [ ] Drive the closing PR through Yeet, Greptile 5/5 with zero issues, CI, auto-merge, and fresh
      merge verification.

Exit: the meta packet is `completed-retained`, reflected, merged, and evidence-complete.

## Verification Commands

```sh
test "$(wc -m < goals/goal-portfolio-driver/GOAL.md)" -le 4000
jq . goals/goal-portfolio-driver/ops/manifest.json
jq . goals/goal-portfolio-driver/ops/queue.json
jq . goals/goal-portfolio-driver/ops/state/loop-state.json
rg -n "goal-portfolio-driver|GOAL.md|agentLaunchers|packetAnchorDocument" \
  goals/goal-portfolio-driver
git diff --check -- goals/goal-portfolio-driver
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep lint roadmap-refs
```
