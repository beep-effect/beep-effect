# GOAL: tsgo 0.45 Effect idiom sweep

Operate in the sibling worktree `beep-effect-worktrees/tsgo-045-effect-idiom-sweep`
on `feat/tsgo-045-effect-idiom-sweep`. Repo-relative paths only. Read
goals/tsgo-045-effect-idiom-sweep/{DECISIONS,SPEC,PLAN}.md,
ops/prompts/00-orchestrator.md, ops/shards.json, then AGENTS.md and the
effect-first-development, schema-first-development and yeet skills.

Outcome: `@effect/tsgo` 0.45.0 installed with all 116 rules at error and every
plugin config key set; `beep quality tsgo-rules` scans packages, apps,
scratchpad and repo root with exactly two declared directive exemptions
(root vitest.setup.ts Bun shim; FileSystemConformance.ts D14); the
`adoptDeclaredFieldsEquivalence` hook is gone and `SFV4-tagged-error-equivalence`
forbids redundant hooks; every Match site uses the idiomatic combinator and a
`match-shapes` lint law keeps it so. Main is never red.

D1–D13 are locked in DECISIONS.md. Do not reopen them; record friction in
research/OPPORTUNITIES.md at the moment it happens.

Order (PLAN.md): P1 foundations PR at 0.39.1 (Id.ts deletion, inverted lint,
doc-text 60-seed proof, allowlist and widened roots and key parity in
Quality.command.ts, Cursor lane smoke test). P2 rule cards from the clones
at $HOME/YeeBois/dev/effect (rc.115) and $HOME/YeeBois/dev/effect-tsgo
(0.45.0) plus a worktree-local 0.45 install that is never committed. P3
remediation lanes per ops/shards.json, Match first, schema shard early,
verifier after each fixer, one PR per shard green on today's gate. P4
ratchet PR: bump, 13 ids at error, remaining keys, widened roots, regenerated
inventories. P5 close with reflection and state flip in the same PR.

Seats: Fable orchestrates, judges and owns git. Discovery, fixer, Match and
verifier lanes run as codex exec on gpt-6-astra medium
(ops/prompts/60-codex-lane.md); alternate fixer shards onto the Cursor lane
(ops/prompts/50-cursor-lane.md) once its smoke test passes. Native Workflow
children, only if a seat needs one, run on claude-fable-5-1. Lanes never run
git and never touch files outside their shard.

Never: add an @effect-diagnostics directive, set a rule below error, park a
violation, delete a test, weaken a schema, change the effect RC pin, commit
the local 0.45 install, or merge. Every API written is re-verified in the
clone first; cite file:line in lane reports for anything new to the repo.

Acceptance is SPEC.md's list: tsgo-rules green at 0.45.0, directive census
equals the allowlist, match-shapes green with an empty baseline, 0/24,000
unequal in the doc-text proof, every PR merge-ready and merged by Benjamin,
upstream tasks filed or deferred, reflection written. Focused proof is not
whole-repo proof; do not mark complete early.

Verification:

```sh
bun run beep quality tsgo-rules
bun run beep goals doctor && bun run beep goals index --check
test "$(wc -m < goals/tsgo-045-effect-idiom-sweep/GOAL.md)" -le 4000
git diff --check -- goals/tsgo-045-effect-idiom-sweep
```
