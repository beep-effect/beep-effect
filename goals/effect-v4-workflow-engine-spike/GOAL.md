# GOAL: prove Effect v4 workflow restart durability

Repo root: the current `beep-effect` working directory; paths are repo-relative.

Outcome: a persistence-backed `WorkflowEngine.makeUnsafe` adapter in
`packages/drivers/workflow` has a documented pass/fail contract proving whether
one deterministic workflow survives real process kill/restart with one keyed
activity, one durable clock, and one deferred acknowledgment, plus handoff
evidence for `goals/law-docketing-reliability`.

Read these as the detailed contract:

- `goals/effect-v4-workflow-engine-spike/README.md`
- `goals/effect-v4-workflow-engine-spike/SPEC.md`
- `goals/effect-v4-workflow-engine-spike/PLAN.md`
- `goals/effect-v4-workflow-engine-spike/ops/manifest.json`
- `goals/effect-v4-workflow-engine-spike/research/SOURCES.md`

Then read `AGENTS.md`, `CLAUDE.md`, and the sources named by `SPEC.md`.

Scope:

- In: persistence-store selection; `packages/drivers/workflow` adapter;
  deterministic execution/activity identity; one activity, clock, and external
  durable-deferred completion; crash harness; Effect-upgrade guard; handoff evidence.
- Out: product reminder workflows, bespoke checkpoint/replay, a general
  resilience stack, circuit breakers, generic fan-out or provider selectors,
  LLM retry consolidation, unrelated consumers, and `goals/INDEX.md`.

Workflow:

1. Inspect the exploration, vendored unstable workflow modules, persistence
   candidates, live checkout, and current worktree.
2. Execute P0 first: choose the store and map every `SPEC.md` constraint to proof
   or an explicit limit.
3. Implement the smallest Effect-first adapter and harness. Kill the process at
   controlled crash windows; restart a fresh process against the same store.
4. Prove rediscovery, retry/idempotency safety, timer/deferred recovery,
   competing-worker behavior, and one inspectable result.
5. Add an upgrade guard that fails near an Effect bump through a compile-time
   contract fixture and rerun of the behavioral crash harness.
6. Archive the pass/fail contract and docketing handoff without unsupported
   production-topology or legal-calendar claims.
7. Preserve unrelated changes; verify through Yeet and complete P3 reflection.

Acceptance:

- [ ] Every acceptance criterion and 14-point P0 constraint is answered.
- [ ] The proof uses persistence and real process kill/restart, not `layerMemory`
      or graceful shutdown alone.
- [ ] Compile-time and behavioral upgrade guards are documented and runnable.
- [ ] Handoff evidence gives docketing an explicit pass/fail decision and gaps.
- [ ] Required checks pass or unrelated failures are reproduced and recorded.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/effect-v4-workflow-engine-spike/GOAL.md)" -le 4000
jq . goals/effect-v4-workflow-engine-spike/ops/manifest.json
git diff --check -- goals/effect-v4-workflow-engine-spike explorations/effect-orchestration-patterns explorations/ATLAS.md
bun run beep yeet verify
```

Stop before entering a named non-goal, weakening the crash contract, claiming
exactly-once delivery without evidence, or changing dependencies, lockfiles,
public API/schema, auth, infra, security behavior, or destructive state without
the approval required by `SPEC.md`.

Done only when the evidence contract is complete and Yeet reports the PR work
mergeable, or when a documented engine failure gives docketing an actionable
handoff and blocks unsupported adoption.
