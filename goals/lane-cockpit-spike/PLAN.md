# Lane Cockpit Spike Plan

## Status

Status: `in-progress` (P3)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Create the lab; prove `render` from `@textjs/react/testing` under the repo's Vitest; capture one real `session open --json` report as a fixture. | The test runner question is settled and a fixture exists, or the circuit breaker fired. |
| P1 Implement | complete | Report schema, lanes service, then the board: ordering, detail pane, keys, filter, error state. | `SPEC.md` acceptance criteria for behaviour are met. |
| P2 Verify | complete | Frame tests, `quality package-verify`, one manual run against the live ledger. | Verification matrix rows are green or a blocker is documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable, then merge. | PR merged; zero unresolved review threads. |
| P4 Close | pending | Run the keep test for one working day, record the verdict, delete the lab on kill, update the exploration's map, write the reflection. | Verdict decision file, reflection and packet state landed. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status lane-cockpit-spike completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug lane-cockpit-spike` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add lane-cockpit-spike --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/lane-cockpit-spike/GOAL.md)" -le 4000
jq . goals/lane-cockpit-spike/ops/manifest.json
rg -n "lane-cockpit-spike|GOAL.md|agentLaunchers|packetAnchorDocument" goals/lane-cockpit-spike
git diff --check -- goals/lane-cockpit-spike
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug lane-cockpit-spike`; add a `kind: checkpoint` file there, never edit this block._

### P0: render runs under the repo's Vitest on Bun and Node, 2026-11-10

The first-hour question is settled. A Text.js frame rendered with render from @textjs/react/testing, inside an @effect/vitest it.effect, passed under both bunx --bun vitest run (837 ms for the file) and bunx vitest run on Node (1.31 s). The circuit breaker did not fire.

One finding: the repo's shared Vitest config runs tests concurrently, and Text.js keeps process-wide renderer and input state, so concurrent renders in one file interleave and draw empty frames. The frame suite declares { concurrent: false }; each test then renders on its own and all pass.

Lane claude/lane-cockpit-spike-e015b2

Reverse: None needed: a measurement, not a choice.

### P2: first frame from the live ledger, 2026-11-10

About fifteen minutes after the lab was created, the board drew this repository's live ledger. The frame below is the board at 110x24 on 2026-11-10, read through the lab's own session-source layer and rendered offscreen; home paths are shortened to ~. It matches session open --json at the same moment: 127 live rows, 26 of them blocked, blocked rows first.

```text
╭─  Lanes  127 live · 26 blocked · oldest 35d  ──────────────────────────────────────────────────────────────╮
│ > residue-closeout-refinal           blocked  #3094    9m HOLD: operator ruling - stop hand-merging goal … │
│ ! yeet-async-merge                   blocked  —       32m Yielded slice A to trusting-hamilton-1ad7d1 (op… │
│ ! eloquent-moore-73e9aa              blocked  —        8h Stood down by the orchestrator: leave this work… │
│ ! beep-effect11                      blocked  —        1d reboot: successor runs /operator-handoff; gate … │
│ ! citation-extraction-engine         blocked  #2966    1d Unblock when designated2976repairlands via owne… │
│ ! vault-sync-observability           blocked  #2962    1d Operator: choose (a) third goals-only re-final … │
│ ! ci-schema-property-unblock         blocked  #2950    1d Native followup after docs resource release: ex… │
│ ! research-intake-refinal3           blocked  #2963    1d Hold for operator decision on the early-merged … │
│ ! scripts-to-beep-cli-p3             blocked  #2961    1d #2961 merged before merge-ready; refresh unsati… │
│ ! ci-citation-refusal-contract       blocked  —        1d Exported refusal-contract patch is owned by con… │
│ ! execution-authority-slice          blocked  #2853    2d Decide on the Heavy / Check stories red for #28… │
│ ! gpcfa-refinal2                     blocked  #2869    3d HOLD MERGE of #2869: after #2854+#2849 merge, m… │
│ ! hold-ledger-closeout               blocked  #2865    3d After #2854 merges: merge origin/main, push 35d… │
│ ! beep-effect3                       blocked  —        3d Operator resolves SPEC.md OK conflict; then app… │
│ ! blissful-wescoff-88e979            blocked  —        6d W4 @beep/repo-run starts when gh-git W7 runner … │
│ ! perf-turbo-cache-hygiene-ece673    blocked  #2559    7d retire lane once orchestrator-owned tokeneconom… │
│ ! youthful-burnell-9c23fd            blocked  #2463    9d Standing by: #1875 stays open pending the opera… │
│ ! beep-effect4                       blocked  #2357   11d Move this chat to Local so its Codex-managed pr… │
│ ────────────────────────────────────────────────────────────────────────────────────────────────────────── │
│ residue-closeout-refinal · docs/residue-closeout-refinal · claude-code · blocked · 9m ago                  │
│ next: HOLD: operator ruling - stop hand-merging goal finals (then 3rd re-final) or rule goal closed witho… │
│ checkout: <worktrees>/residue-closeout-refinal                                             │
╰─  ↑↓ move · / filter · enter expand · y copy path · p copy PR · q quit  ───────────────────────────────────╯
```

A PTY run of the start script (stty 100x20) drew the same board full-screen, moved the selection on j, quit on q, left the alternate screen and exited 0.

Observation for the keep test: the ledger holds 127 live rows, some 35 days old. The board shows every one with its age, as the spec requires; whether that wall is usable is the operator's call.

Lane claude/lane-cockpit-spike-e015b2

Reverse: None needed: a measurement, not a choice.

<!-- beep:decisions:end -->
