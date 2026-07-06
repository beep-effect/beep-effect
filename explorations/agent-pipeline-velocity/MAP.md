# Map

<!-- Stage 4. Candidate goal packets, sequencing, first slice, capability cites. -->

## Candidate Goal Packets

Exactly one (user constraint: single goal, single PR):

| Slug | Mission | Dependencies |
| --- | --- | --- |
| `agent-pipeline-velocity` | Cut agent context friction and time-to-mergeable-PR in one pass: greptile-only reviews, read-only PR cache, green main, single-sourced instruction files, progressive-disclosure skills, permission allowlist, instrumented + rebenchmarked yeet, local/hosted parity, `beep worktree` helper. | PR #291 (codex/yeet-verify-repair) merged first. Supersedes 4 packets (see ledger surgery). |

## Sequencing

1. **Gate**: PR #291 merges (external, in flight).
2. Phase B quick strikes (B1 Chrome bot deactivation is user-flagged EARLY; B2 cache; B3 main-green verify/fill).
3. Phase C agent effectiveness (C1–C5) — parallelizable with late Phase B.
4. Phase D pipeline rqt-011+ (Fable-direct; D1 instrumentation precedes all D-changes so every delta is measured).
5. Phase E worktree helper + ledger/reflection closeout.
6. Single PR via yeet publish → greptile-only closeout → user merges.

**First vertical slice**: Phase B1 (review-bot consolidation) — smallest
end-to-end cut that touches browser config, Closeout.ts defaults, and skill
docs, and immediately reduces closeout churn for this very PR.

## Ledger Surgery (part of graduation)

Superseded by `goals/agent-pipeline-velocity` (manifest `relatedPackets` +
status flip, `updated` stamped):

- `goals/agent-effectiveness-phoenix-enrichment` (pending-planning → superseded)
- `goals/agent-effectiveness-workflow-integration` (pending-planning → superseded)
- `goals/yeet-operator-clarity` (active, P5 closeout residue → superseded)
- `goals/yeet-pr-closeout-loop` (active → superseded)

`goals/repo-quality-throughput` remains completed-reference; its rqt-NNN
numbering and measured-delta conventions continue at rqt-011.

## Capability Check

| Component | Capability cite | Status |
| --- | --- | --- |
| Closeout gate trim | `Yeet/internal/Closeout.ts` `PrCloseoutGateName` + gate logic | reuse/extend |
| PR cache policy | `.github/workflows/check.yml` TURBO_TOKEN wiring (CSF-001 block) | reuse/extend |
| Main-green fixes | PR #291 in flight + known failure causes (memory + rating evidence) | external + fill |
| Instruction generator + drift check | beep CLI command framework; existing quality lane pattern (`Quality/Tasks.ts` bunxStep) | **NET-NEW command, existing framework** |
| Nested-instruction audit | 14 files inventoried in `research/baseline-agent-config.md` | reuse (audit) |
| Skill progressive disclosure | `.claude/skills/*` + `skills-lock.json` hash pinning + `.codex/config.toml` mirror | reuse/restructure |
| Permission allowlist | `.claude/settings.json` (exists, empty of permissions) | reuse/extend |
| Phase wall-time instrumentation | turbo `--summarize` JSONs + `beep ci append-turbo-summary` + `Yeet/internal/Status.ts` | reuse/extend (thin NET-NEW surface) |
| Concurrency benchmark | `Planner.ts` YEET_TURBO_CONCURRENCY constant; `--forceTurbo` env plumbing | reuse/extend |
| Parity lanes in verify | `Quality/Tasks.ts` lanes + check.yml lane list + `proof-parity-map.md` (rqt-004) | reuse/extend |
| rqt leftovers | Named in `goals/repo-quality-throughput` implementation-closeout.md | reuse (frontier) |
| `beep worktree` helper | CLI command framework + `standards/git-worktrees.md` checklist as spec | **NET-NEW command, existing framework + spec** |
| Debt ledger | crispen/ponytail comment conventions | reuse |

No NET-NEW component lacks an existing framework to sit in; both NET-NEW
items are thin commands over documented specs.
