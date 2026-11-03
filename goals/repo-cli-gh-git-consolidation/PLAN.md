# repo-cli gh/git consolidation Plan

## Status

Status: `active` — P0 research complete (`research/p0-site-inventory-2026-11-02.md`); P1 runs the waves below, one PR each, W0 first.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | `research/p0-site-inventory-2026-11-02.md`: every site-list row, the kit gaps G1-G10, the off-list spawns and the wave plan; decisions D-02 to D-05 in `SPEC.md`. |
| P1 Implement | in-progress | Land the kit features with tests, then switch the sites, one owner per PR (the Waves table). | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Waves

The binding sequence from P0 (`research/p0-site-inventory-2026-11-02.md`, section 5). Kit features land with tests
before the sites that use them; one owner switch per PR; each PR records a before/after differential under `ops/`
and `research/` (the effected-promotion R10 pattern: frozen old bodies against the kit over scratch repositories,
zero unclassified differences). Each PR flips its own row.

| Wave | Kit features | Sites | Status |
| --- | --- | --- | --- |
| W0 | G9 `Git.isAncestor`, G10 `Git.worktreePrune`; `Git.layer` once at the CLI runtime edge (D-06) | `Knowledge/KnowledgeDoctor.service.ts` (#111), `Worktree/internal/ResidueTerminalLaneLive.ts`, `Ci/RouteCensus.ts` is-ancestor probes; `internal/repo-run/GitWorktree.ts` and `commands/Worktree/internal/TmpfsReap.ts` worktree remove and prune | merged, #2514 |
| W1 | G4 fail-closed parsers, G5 `nameStatus` rename score and pathspec, G6 bounded output (D-04), G10 `revParse` peel | `internal/repo-run/GitExec.ts` core (#100, #251), `Yeet/internal/GitExec.ts` (#101) and the Yeet is-ancestor probes (`FinalCheckRefresh`, `Sweep`), `HeadInstallPreflight`; Yeet lifts `Git` into its requirement unions and drops the leaf `Git.make` provisions | merged: kit #2522, readers W1a #2539, Yeet layer W1b #2546 |
| W2 | G7 dirty-axis flags and pathspec, G8 `log` name-status | `internal/repo-run/ChangedFiles.ts` (#102), `Quality/Quality.command.ts`, `Knowledge/KnowledgeDoctor.grouping.ts` (#110), the per-group one-liner wrappers (#112, #252), `Worktree/Worktree.schemas.ts` (#105) and the `Fleet.service.ts` reads (#106), ai-metrics `config-snapshot.ts` (#107, #304) | merged, #2593 (D-10: #102, #105, #106 and the one-liners of #112/#252 with an exact member; #110 KEEP, `Git.log` has no starting ref); W2b pending: the Yeet `Settle`/`ProofShadow` and `Retire`/`Sweep`/`MergedPreview`/`ReadyGate`/`PullRequest`/`PublishScope`/`Status` git halves, `Library.inventory.ts`, ai-metrics #107 |
| W2b | none (the W0-W2 kit as merged) | the Yeet git halves of `Settle`, `ProofShadow`, `Sweep` (CommandProbe adapter), `Retire`, `MergedPreview`, `ReadyGate`, `PullRequest`, `Status` (#112, #250); `Research/Library/Library.inventory.ts`; ai-metrics `config-snapshot.ts` `ls-files` (#107, #304); `PublishScope` KEEP | merged, #2606 (D-11) |
| W3 | G2 down-scoped App token; the `gh auth token` and `op read` spawns onto `@beep/commands` `Run` (D-05) | `Reviewer/*` (#74, #75, #76, #124, #247, #303), `Ci/LaneTimings.ts` (#248), `Ci/CiGovernance.ts` and `Ci/CiRerunRunnerLoss.ts` (#249) | kit merged (#2556); sites merged (#2614, D-12) |
| W4 | G3 `ReviewThread` resource in `@beep/github` | `internal/github/GithubGraphql.ts` (#77) folds into the kit; `Yeet/internal/{Status,WatchMode,MergeGate,Reply,closeout/GhCollect}.ts` (#78 to #82) and the Yeet REST surface (#250) onto `GithubRest` and `PullRequest`; `GhCall.ts` deleted, `GhCommand.ts` (#83) shrinks | kit merged (#2600); sites merged (#2622, D-13) |
| W5 | none (`@beep/commands` `ScriptedSpawner` as-is) | the hand-rolled scripted spawners in repo-cli tests (#125, #279), ai-metrics tests and `tailscale.test.ts` (#300); #291 records that `@beep/test-utils` adds no second double | merged, #2642 (D-14) |
| W6 | none (the W4 kit; `GithubRest` merge title optional, check suites `per_page: 100`) | the Yeet `gh` sites D-13 deferred: `PullRequest.ts`, `ProvenanceFooter.ts`, `ReviewWindow.ts`, `Merge.ts`, `MonitorLoop.ts`, `MonitorComments.ts` and their `capture` seams | merged, #2648 (D-15) |
| C | none | Closeout: ledger of every site-list row (migrated or kept with reason), reflection, `proposedCloseout` | in review, this PR (#2654) |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/repo-cli-gh-git-consolidation/GOAL.md)" -le 4000
jq . goals/repo-cli-gh-git-consolidation/ops/manifest.json
rg -n "repo-cli-gh-git-consolidation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/repo-cli-gh-git-consolidation
git diff --check -- goals/repo-cli-gh-git-consolidation
```
