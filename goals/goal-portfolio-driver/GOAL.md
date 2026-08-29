# GOAL: Drain the active goal portfolio

> **PAUSED 2026-08-17 — DO NOT EXECUTE.** This packet's lifecycle is `paused`
> behind a revisit gate (exploration wrap-up complete AND
> goals/packet-control-plane-core closed — see README.md). A `/goal` launch
> of this file before the gate holds must stop here and report. The locked
> queue below is stale and will be relocked from control-plane derived state
> at revisit.


Run one long-lived Claude Fable driver in this worktree until every queued slug is merged and
`completed-retained` with evidence, then close this packet by final PR.

`goals/goal-portfolio-driver/SPEC.md` is normative. Read it, `PLAN.md`, `ops/manifest.json`, and
`AGENTS.md` before the first wake. Do not reopen its pre-settled decisions.

## Wake protocol

On every wake:

1. Read `ops/state/loop-state.json`. If missing, stale, invalid, or inconsistent, run the SPEC
   Recovery probe: delegate inspection of worktrees, open PRs, INDEX, queue, verdicts, incidents,
   and merge state; reconstruct it without destructive action.
2. Read `goals/INDEX.md` Active table, then `ops/queue.json`. Remaining work is always
   `queue goals intersect INDEX.active`; queue status is never lifecycle truth.
3. Enforce breakers, two edit lanes, two monitor slots, the verify mutex, serialized merge arming,
   dependencies, budgets, and the disk floor.
4. Advance each eligible lane exactly one SPEC transition. Park exhausted goals, free resources,
   and continue; terminal or waiting lanes invent no work.
5. Dispatch the stage agent named by SPEC; never do stage work inline. Never read raw packet docs,
   diffs, logs, transcripts, findings, or Greptile bodies. Read only verdicts of at most 60 lines and
   one-line or JSON-count outputs. Never trust self-report.
6. Require every stage agent to finish at
   `ops/state/runs/<slug>/<stage>-r<N>.verdict.md` with YAML `status`, `goal`, `stage`, `round`,
   `budgetUsed`, and `nextAction`, at most 15 bullets, and evidence paths only. Require a fresh
   distiller verdict for Codex work and named verification.
7. Reserve GitHub writes, resource orchestration, reconciliation, and merge verification for the
   driver. Stage agents never commit, push, post, resolve, merge, or mutate settings.
8. After transitions, atomically update loop state and `ops/status.md`; locally commit only those
   driver-owned state/heartbeat artifacts with a compliant message. Never push state-only commits.
9. Schedule the next wake immediately for local work or in about five minutes when all work waits
   on hosted checks/jobs. Continue until Definition of Done or a global breaker.

## Dispatch routing

- Codex: backend/docs/research implementation, distillation, Greptile drafts, and Chrome QA.
- Fable stage agents: packet briefs, frontend implementation/fixes,
  `quality-review-fix-loop`, `crispen`, Yeet publish/closeout, and reflections.
- Driver: GitHub writes, auto-merge, fresh merge reads, main-run watch, and state commits.

Use the reusable templates in `ops/prompts/`. For multi-PR goals, finish one sequential PR unit and
reseed from fresh main before the next. The final unit must carry `/reflect`, the
`completed-retained` status flip, and INDEX regeneration before publish.

Safety rails: never force-push; never stash clear/drop/pop; never branch-delete,
worktree-prune, reset-hard, or clean; never revert unexplained out-of-scope main-checkout changes;
never edit `.github/workflows/**` or `docs/_internal/**`; never use admin merge or lower gates;
never weaken `.gitleaks.toml` in-PR; never mutate `.claude/settings.json` or repo settings; never
trust self-reports. The full verbatim rail and all budgets/playbooks are in normative `SPEC.md`.

Done only when `queue goals intersect INDEX.active` is empty, every slug is `completed-retained`
with merge evidence, P3 has an independent ledger, and the P4 PR is merged. Otherwise keep looping
or report the fired breaker and evidence.
