# GOAL: deliver restart-safe projection dispatch

Repo root: the current `beep-effect` checkout. Do not assume an absolute path;
several checkouts exist.

Outcome: atomically commit an accepted record and projection intent; update one
rebuildable projection without duplicate/regression through a persisted Effect
v4 worker; and converge after restart even when the desktop hint is lost.

Treat these files as the detailed contract:

- `goals/projection-dispatch-core/README.md`
- `goals/projection-dispatch-core/SPEC.md`
- `goals/projection-dispatch-core/PLAN.md`
- `goals/projection-dispatch-core/ops/manifest.json`
- `goals/projection-dispatch-core/research/SOURCES.md`

Then read repo instructions, standards, exploration, and workflow-spike
evidence. Higher-priority standards outrank the packet.

Scope:

- In: epistemic dispatch/status/RPC contracts; accepted-record, intent,
  projection, and cursor persistence; isolated worker; scoped hint; desktop
  re-query/server scope auth; focused crash/retry/auth proof.
- Out: sync engines; in-memory durable work; retrieval/RRF/vector behavior;
  FalkorDB/graph; multi-device sync; speculative `PubSub`/registries; shared
  projection package; invented `UserId`; client-trusted scope; `goals/INDEX.md`.

Workflow:

1. Stop at P0 until `effect-v4-workflow-engine-spike` lands its persistence
   adapter, atomicity limits, competing-worker contract, and restart evidence.
2. Consume that adapter in `packages/drivers/workflow`; do not duplicate it.
3. Prove the authority record plus intent commit atomically and every crash
   window recovers pending intent. Never assume exactly once.
4. Key exactly on `{ authorityRecordId, authorityVersion, projectionTarget }`.
   Freeze monotonic cursor/status and retry/stale rules from fixtures.
5. Implement schema-first, Effect-first epistemic contracts. Use one trivial
   rebuildable target, isolated worker, bounded concurrency, and explicit retry.
6. Emit only a minimal best-effort version hint after durable progress. Start
   with one scoped queue/stream; do not promote topology without proof.
7. Authenticate with `RpcSessionAuth`; server-authorize workspace/matter scope
   before registration. The launch token is not a user identity.
8. Kill before and after worker completion. Start fresh against the same store,
   withhold the hint, reconnect, and prove convergence without regression.
9. Preserve unrelated changes and update packet evidence/status.
10. At P3 Close, write the required `/reflect` artifact; reflection lint passes.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion passes.
- [ ] Atomic handoff and delivery class are proved without exactly-once claims.
- [ ] Retry, stale work, and both kill windows preserve projection/cursor state.
- [ ] Unauthorized subscription scope is rejected server-side.
- [ ] Reconnect converges without a hint.
- [ ] Required verification is green or unrelated failures are recorded.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/projection-dispatch-core/GOAL.md)" -le 4000
jq . goals/projection-dispatch-core/ops/manifest.json
git diff --check -- goals/projection-dispatch-core
```

Stop on a failed prerequisite, unprovable atomic/recovery boundary, auth scope
that requires trusting the client or inventing a principal, or any non-goal.

Done only when the matrix is green and the work ships as a PR driven to
mergeable through Yeet; otherwise report blockers with file/command evidence.
