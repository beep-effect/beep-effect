# Push-First Publish — Sources & Provenance

- **Source exploration:** none. Authored directly from a 2026-10-05
  grill-with-docs session with the operator; the ten decisions in `SPEC.md`
  were each chosen against named alternatives.

## 1. Grounding facts (in-repo, verified 2026-10-05)

| Fact | Location | Consequence |
| --- | --- | --- |
| Default publish plan runs the full proof before push; `--fast --monitor` skips it; `--start-pr-early` overlaps it but still blocks on it. | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` `publishSteps` (~L738–L779) | D1, D5 |
| `--fast` is guarded to require `--monitor`. | `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:36-37` | D5 removes the guard |
| Yeet has no draft option; `isDraft` is only read. | `grep draft` over `commands/Yeet/**` returns reads only | D4 |
| Merge-ready verdict requires `notDraft`. | `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts:453` | D9: a draft can never reach `merge-ready: yes` without a new terminal |
| `check.yml` triggers on `pull_request` (main) and `push` (main) only. | `.github/workflows/check.yml:3-10` | D8: a push without a PR produces no hosted signal |
| `heavy-admit.yml` triggers on `pull_request: labeled`. | `.github/workflows/heavy-admit.yml:14-17` | Draft + label still admits heavy lanes |
| Hosted `check.yml` carries gitleaks/semgrep/SAST/Nix lanes. | `grep -l gitleaks\|semgrep\|sast\|nix .github/workflows/*.yml` → `check.yml` | D2: nothing local-only is lost |
| Cheap-gates is a collected tier of 12 deterministic gates and takes no admission token; full proof weight 3, merged preview 5, review-fix 1. | `.claude/skills/yeet/SKILL.md` "Authoritative Gates" and scheduler section; `Handler.ts:531,553` | D1 |
| The parity audit found the "green local = green CI" invariant false: local proves HEAD, GitHub proves the merge ref. | `goals/ship-velocity/research/c3-local-remote-parity.md` §1, §4 | Weakens the case for a mandatory pre-push full proof |
| `yeet` skill step 5 names `gh pr create --draft --fill` as a manual fallback; step 10 says mark ready only when green and threads answered. | `.claude/skills/yeet/SKILL.md` "Mergeable PR Workflow" | D4, D10 encode these in the tool |
| `goals bootstrap` is plan-only (`--plan --json`); no writer. | `beep goals bootstrap --help` | Packet materialized by hand from the plan payloads |

## 2. Operator context (out of repo)

- Operator memory rules "open PRs as draft until final" and "apply
  ready-for-heavy at PR open" were already standing; D4 encodes them.
- Two standing operator memories conflicted: "minimize hosted CI runs, one PR,
  budgeted pushes" versus "push first, hosted proves, filtered local checks".
  D6 resolves it: push-first wins, the budgeted-pushes clause survives as "one
  push per addressed wave".

## 3. Upstream repositories & licenses

None.

## 4. External research sources

None required; the decision is about this repo's own operator workflow.

## 5. Cross-links & provenance

- `goals/ship-velocity/research/c2-yeet-monitor-backpressure.md` — monitor
  mechanics the D7/D9 changes build on.
- `goals/ship-velocity/research/d1-admission-scheduler.md` — scheduler
  contract this packet leaves untouched.
- `goals/time-to-certainty` B7 (`--until-ready`) and B8 (heavy admission) —
  terminals and label flow reused by D7–D9.
