# SPEC — Goal Portfolio Driver

This is the normative loop contract. Agents MUST obey it exactly. When this document and a
dispatch prompt disagree, this document wins. It was authored from
`research/approved-plan-2026-07-14.md`; its locked decisions are not reopened during execution.

## Objective

Continuously drain the static portfolio queue in dependency order until every queued goal has
merged-PR evidence and lifecycle `completed-retained`. A long-lived Claude Fable driver preserves
orchestration context, delegates all stage work, and resumes safely from committed machine state.

## Non-Goals

- Reprioritizing `docs/ROADMAP.md` after the P1 queue lock.
- Treating `queue.json` as lifecycle truth or editing `goals/INDEX.md` by hand.
- Doing implementation, review, QA, log analysis, or diff analysis in the driver context.
- Weakening quality, security, Greptile, CI, or merge gates to increase throughput.
- Touching pre-existing worktrees, branches, stashes, or unexplained main-checkout changes.
- Automatically deleting merged branches; that repository-setting change remains out of scope.

## Source Hierarchy

1. The approved design in `research/approved-plan-2026-07-14.md`.
2. `AGENTS.md`, `CLAUDE.md`, and required stage skills.
3. Governing architecture, goal-lifecycle, ROADMAP, Yeet, and memory standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Pre-settled Decisions

1. **Queue-static / INDEX-status.** P1 locks `ops/queue.json` as ordering and dependency data.
   Live lifecycle status is freshly derived from the `goals/INDEX.md` Active table. Remaining work
   is `queue goals intersect INDEX.active`; only `bun run beep goals set-status` writes status.
2. **Two edit lanes, two monitor slots, one verify mutex.** At most two goals may edit and two PRs
   may occupy hosted-monitor slots. Only one machine-wide Yeet verify/publish-class proof may run.
3. **Closeout rides the final PR.** The final PR unit carries the reflection, status transition to
   `completed-retained`, and regenerated INDEX so INDEX cannot lead the merge.
4. **Frontend heuristic.** Frontend QA is required when the goal diff touches `apps/**`,
   `packages/**/ui/**`, or any non-test `*.tsx` file.
5. **Park and continue.** Budget exhaustion creates an incident, frees the lane, and continues the
   queue unless a global circuit breaker fires.
6. **Auto-merge policy.** Only after all local, hosted, Greptile, and closeout gates pass may the
   driver arm `gh pr merge --squash --auto`. Merges serialize; no new merge is armed until the
   prior merge and its main push run are resolved. Verify every merge by a fresh API read.
7. **Locked queue + wave handoff (grill D1).** Packets graduating mid-run are not admitted. This
   run drains exactly the locked queue; the P3 final audit emits a wave-2 queue proposal for
   one-message operator approval.
8. **Coexistence: probe + defer + notify (grill D3).** Before acquiring the verify mutex, probe
   machine-wide for running turbo/vitest/yeet processes and defer until they finish. Operator PRs
   are foreign: never touched, counted in merge serialization. Push-notify the operator on every
   park and breaker.
9. **Fable capacity: sleep-and-resume (grill D4).** Rate-limit signals schedule a 30-60 minute
   wakeup and retry; codex background stages continue. Capacity exhaustion is pacing, never a
   breaker.
10. **IMPLEMENT dispatch (grill D5).** Codex workers receive the target packet's own `GOAL.md` as
    primary instruction, prefixed by the loop preamble (safety rails + verdict contract) and
    scoped by the Fable brief to one phase/PR unit per dispatch.

## Per-Goal State Machine

The driver advances each eligible lane by exactly one transition per wake:

```text
QUEUED -> LANE_SETUP -> PACKET_REVIEW -> IMPLEMENT -> QUALITY_LOOP -> CRISPEN
  -> [FRONTEND_QA when heuristic matches] -> PUBLISH -> PR_MONITOR -> MERGED -> DONE
ANY STATE on exhausted budget -> PARK
```

| State | Required transition and gate | Budget |
| --- | --- | --- |
| `QUEUED` | Select the first dependency-ready member of `queue intersect INDEX.active`. | N/A |
| `LANE_SETUP` | Create `lane-<slug>` from fresh `origin/main`; install in-lane; record owned processes. | One setup attempt; setup failures use the applicable playbook budget. |
| `PACKET_REVIEW` | Fable subagent writes a brief of at most 40 lines: remaining phases, sequential PR units, dependencies, named verification, and frontend flag. | One brief plus one correction. |
| `IMPLEMENT` | Codex background agents implement one phase/PR unit. A distiller freshly reruns named verification and writes the verdict. | Two Codex attempts plus one Fable rescue per phase. |
| `QUALITY_LOOP` | Run `quality-review-fix-loop`; advance only with zero required blockers. | Skill's three rounds, then explicit waiver or park. |
| `CRISPEN` | Run the `crispen` skill; advance only when the second pass is a no-op. | Two passes. |
| `FRONTEND_QA` | Codex plus Chrome writes findings; Fable frontend agent fixes; Codex re-runs QA. | Three QA/fix rounds. |
| `PUBLISH` | Under the global verify mutex, run the Yeet ten-step recipe. The final PR unit includes reflection, status flip, and INDEX regeneration. | Local-verify and rebase budgets in the playbook. |
| `PR_MONITOR` | Attribute red checks; remediate Greptile to 5/5 and zero issues; arm auto-merge; fresh-read merge; watch main. | Two hosted repair rounds and three Greptile rounds per PR. |
| `MERGED` | If another PR unit remains, reseed from fresh main and return to `LANE_SETUP`; otherwise advance. | N/A |
| `DONE` | Record merged-PR evidence and confirm `completed-retained` in a fresh INDEX read. | Terminal. |
| `PARK` | Write `ops/incidents/<date>-<seq>-<class>-<slug>.md`, release resources, and continue. | Terminal pending operator adjudication. |

Multi-phase packets ship as sequential PR units. `professional-desktop-adversarial-qa` repeats
QA and repair until two consecutive clean rounds before closeout.

## Concurrency and Resource Policy

- The driver runs in the `portfolio-driver` worktree; edit work occurs only in driver-created
  `lane-<slug>` worktrees. Never reuse or alter pre-existing worktrees.
- Keep at most two edit lanes and two PR-monitor slots. A monitoring PR releases its edit lane for
  the next dependency-ready goal.
- Hold one global verify mutex across Yeet verify, publish, and equivalent full-repo proofs. Do not
  run manual Turbo, shared PGLite, Docker, or overlapping server work beside that proof.
- Allocate unique branches, ports, Portless names, temp/database paths, and PID manifests per lane.
  Run commands from the lane root. Never share or symlink `node_modules` between worktrees.
- Merges are serialized. Main red blocks merge arming but does not block safe local work.
- The driver performs GitHub writes. Stage agents may research, edit their lane, and write verdicts,
  but may not commit, push, comment, resolve threads, arm merges, or change repository settings.

## Context Economy Protocol

The driver MAY read only `ops/state/loop-state.json`, `ops/queue.json`, the INDEX Active table,
incident files, verdict files of at most 60 lines, and one-line or JSON-count command outputs. It
MUST NOT read packet bodies, diffs, raw logs, findings bodies, Greptile thread bodies, Codex
transcripts, or full reports. Delegate those reads and all stage work.

Every dispatched agent must end by writing:

```text
goals/goal-portfolio-driver/ops/state/runs/<slug>/<stage>-r<N>.verdict.md
```

The file is at most 60 lines, begins with YAML frontmatter fields `status` (`pass`, `fail`, or
`blocked`), `goal`, `stage`, `round`, `budgetUsed`, and `nextAction`, then contains at most 15
finding bullets and evidence paths only. No logs, diffs, transcripts, thread bodies, or report
content may be dumped into it. Full artifacts sit beside the verdict for the next stage agent.

Codex completion is never accepted from self-report. A cheap distiller subagent must fresh-read
deliverables, rerun the stage's named verification commands, and write its own verdict.

## Failure-Mode Playbook

Every exhausted class parks the goal and continues the queue unless its circuit breaker fires.

| Class | Detect | Remedy | Budget | Escalation |
| --- | --- | --- | --- | --- |
| Local verify fail | Named local command or Yeet verify is red. | Remove only `.beep/fallow`; apply changeset-status rules; use an empty changeset for version-neutral dependency changes; run Codex fixes; compare systemic `@beep/schema` `$defs` failures with main HEAD before attribution. | Three Codex fix rounds. | Park with command, attribution, and evidence paths. |
| Hosted check fail | Required hosted check is red. | Attribute introduced/inherited/unrelated/environment-only first. Rerun Vercel 429 leading to TS6305; neutralize secret strings in-file and land any allowlist main-first; reproduce secret-split failures with fixture parity. Cancelled (not failed) checks: rerun ONLY the newest head-SHA's run — rerunning an older run races the branch concurrency group and cancels the live one. | Two hosted repair/rerun rounds. | Park; inherited failures are not assigned to the goal. |
| Greptile rounds | Score below 5/5 or actionable issues remain. | Classify fix/rebut/resolve-stale; always fix P1 security. Codex drafts fixes/replies; Fable reviews every reply before the driver posts it; resolve with Yeet closeout and re-gate at 5/5 and zero issues. | Three rounds per PR. | Park with unresolved thread IDs and verdict paths. |
| Stale base/conflicts | Yeet refuses publish or reports stale/conflicted base. | Fetch and rebase `origin/main` in-lane, reverify, then publish push-only with reused verification and PR; never use staged-only with amend/push-only. Never `--amend` an already-pushed commit (plain push rejects non-fast-forward after the full proof) — ship review fixes as follow-up commits; `--reuse-verified` is commit-SHA-keyed, so a fresh verify must precede push-only. | Two rebase cycles per PR. | Conflicts only in untouched files are a misattribution signal: park. |
| Main red after merge | Main push run is red after a verified merge. | Halt merge arming and attribute. For introduced failure, put a fix-forward at queue head; if unresolved, send a revert PR through the full pipeline. Do not misattribute inherited red. | Four hours for fix-forward. | Keep merges halted; park/revert after budget. |
| Codex job death | Background job exits, vanishes, or emits no verdict. | Re-derive state from fresh `git status` and Yeet status, never the worker's final message; respawn with the same bounded prompt. | Two respawns. | Park and record last trustworthy filesystem state. |
| Driver death | Heartbeat is stale or loop state is missing/inconsistent. | Run the SPEC Recovery probe: inspect worktree list, open PRs, INDEX, queue, verdicts, incidents, and fresh merge state; reconstruct loop state. Armed auto-merges may remain armed. | One recovery probe plus one reconciliation pass. | Stop if state cannot be made unambiguous without destructive action. |

## Circuit Breakers and Stop Conditions

- Three consecutive parks in the same failure class halt the queue.
- Any main red halts merge arming; safe local implementation may continue.
- The same flaky check blocking three PRs creates a quarantine mini-goal at queue head.
- Twelve Codex-hours spent on one goal parks that goal.
- Less than 50 GB free disk prevents creation of new lanes.
- Stop if required sources are missing or contradictory, named scope must expand, or progress would
  require unnamed credentials, cost, destructive action, or policy approval.
- Stop rather than guess when recovery cannot distinguish ownership, status, or merge truth.

## Safety Rails

**Safety rails (deny-list + protocol text in GOAL.md + every codex prompt preamble)**: never
force-push, never stash clear/drop/pop, never branch-delete/worktree-prune/reset-hard/clean (the
33 stashes/135 branches/7 worktrees are yours), never revert unexplained out-of-scope changes in
the main checkout (you work there mid-session), never edit `.github/workflows/**` or
`docs/_internal/**`, never merge with `--admin`/lower gate thresholds, never weaken
`.gitleaks.toml` in-PR, never mutate `.claude/settings.json` or repo settings, never trust
self-reports.

## Definition of Done

The portfolio goal is done only when `queue intersect INDEX.active` is empty and every slug in the
locked queue is `completed-retained` with fresh, durable merged-PR evidence. The final audit also
confirms no open goal PRs, no leftover `lane-*` worktrees, and no unaccepted incidents, and emits
the wave-2 queue proposal (grill D1) from whatever is active at audit time.

## Acceptance Criteria

- [ ] P1 locks a dependency-ordered queue derived from `docs/ROADMAP.md` and reconciled with INDEX.
- [ ] Every wake advances each eligible lane by at most one normative state transition.
- [ ] Two edit lanes, two monitor slots, the verify mutex, and serialized merge arming are enforced.
- [ ] Every stage emits a schema-conforming verdict of at most 60 lines; the driver reads no raw
      stage context and accepts no self-report.
- [ ] Budget exhaustion parks and frees a lane; global breakers halt only their named activity.
- [ ] Each final goal PR carries reflection, status transition, and INDEX regeneration.
- [ ] `queue intersect INDEX.active` is empty and every queued slug has merged-PR evidence.
- [ ] P3 creates `history/outputs/LEDGER.md`; P4 closes this packet in its own final PR.

## Verification Matrix

| Claim | Command or evidence | Required result |
| --- | --- | --- |
| Packet schema | `bun run beep goals doctor` | This packet has no error or advisory. |
| Manifest JSON | `jq . goals/goal-portfolio-driver/ops/manifest.json` | Passes. |
| Queue JSON | `jq . goals/goal-portfolio-driver/ops/queue.json` | Passes; P1 locks it. |
| Loop-state JSON | `jq . goals/goal-portfolio-driver/ops/state/loop-state.json` | Passes. |
| Launcher size | `test "$(wc -m < goals/goal-portfolio-driver/GOAL.md)" -le 4000` | Passes. |
| Reflection contract | `bun run beep lint reflection-artifacts` | Passes. |
| ROADMAP references | `bun run beep lint roadmap-refs` | Passes. |
| P0 hardening | Fresh reads named in `PLAN.md` | Each completed item remains true. |
| Continuous loop | `ops/status.md`, loop state, INDEX, and merged-PR API reads | Heartbeat fresh; active count decreases; ledger agrees. |
| Final audit | `history/outputs/LEDGER.md` | Every queue slug retained and merge-proven. |

## Related Packets

- `goals/repo-crispening-orchestration` — orchestration structure and crispen stage contract.
- `goals/goals-doctor` — packet lifecycle/schema diagnostics.
- `goals/agent-pipeline-velocity` — throughput, bounded delegation, and pipeline feedback.
