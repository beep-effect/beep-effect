# Closeout ledger: site-list rows

Closeout C (PLAN "Waves"). One row per row of [`site-list.md`](./site-list.md), in its order, with the outcome
and the decision that records it. Every row is migrated or kept with a recorded reason (SPEC acceptance 1). Spawns
that the site list never named are covered by the W7 census ([`w7-site-census-2026-11-03.md`](./w7-site-census-2026-11-03.md),
D-16 to D-21) and by the W8 re-census ([`w8-drift-census-2026-11-13.md`](./w8-drift-census-2026-11-13.md), D-22),
which together cover SPEC acceptance 2.

Prefix `R/` = `packages/tooling/tool/cli/src`.

## gh-CLI surface (17)

| Row | Site | Outcome | Decision |
| --- | --- | --- | --- |
| #74 | `R/commands/Reviewer/GitHubAppAuth.ts` | Migrated. The hand-rolled JWT signer, token POST and cache are gone; the down-scoped App token is `GitHubApp.token` plus `assertPermissions` (kit gap G2). No `gh` or `git` literal remains. | D-12 |
| #75 | `R/commands/Reviewer/ReviewerService.ts` | Migrated onto `@beep/github` (`GitHubClient` from the reviewer token). No spawn literal remains. | D-12 |
| #76 | `R/commands/Reviewer/ReviewerRuleset.ts` | Migrated onto `@beep/github`. No spawn literal remains. | D-12 |
| #77 | `R/internal/github/GithubGraphql.ts` | Migrated. The review-thread reader folded into the kit's `ReviewThread` (G3); the file keeps `markPullRequestReadyDocument` and `graphqlErrorToGitHubError` only, both over `GitHubClient`. | D-03, D-13 |
| #78 | `R/commands/Yeet/internal/Status.ts` | Migrated for review threads and REST reads; the remaining `gh` reads carry `KEEP (D-13)` comments naming the member the kit lacks. | D-13 |
| #79 | `R/commands/Yeet/internal/WatchMode.ts` | Migrated for review threads; two `gh` reads `KEEP (D-13)`. | D-13 |
| #80 | `R/commands/Yeet/internal/MergeGate.ts` | Migrated onto `GithubRest`, `GitHubRepository` and `ReviewThread`. No spawn literal remains. | D-13 |
| #81 | `R/commands/Yeet/internal/closeout/GhCollect.ts` | Migrated for review threads; three reads `KEEP (D-13)`. | D-13 |
| #82 | `R/commands/Yeet/internal/Reply.ts` | Migrated onto `ReviewThread` and `GithubRest.createIssueComment`; one `KEEP (D-13)`. | D-13 |
| #83 | `R/internal/github/GhCommand.ts` | Shrunk to `ghOutput` and `GhCommandFailure`, the shared route the remaining `KEEP` gh reads use; the cursor and page helpers retired with their last callers. | D-13 |
| #84 | `R/internal/github/GithubRest.ts` | Already a kit-backed facade over `@beep/github`; kept as the migration target and extended by W4/W6. | D-03, D-13, D-15 |
| #85 | `R/commands/Skills/Skills.command.ts` | No `gh` or `git` spawn (stale since effected-promotion R10). | D-03 |
| #247 | `ReviewerRuleset.ts`, `ReviewerService.ts` | As #75 and #76. | D-12 |
| #248 | `R/commands/Ci/LaneTimings.ts` | Migrated onto `@beep/github`. No spawn literal remains. | D-12 |
| #249 | `R/commands/Ci/CiGovernance.ts`, `CiRerunRunnerLoss.ts` | Migrated onto `@beep/github`; `CiGovernance` keeps one `KEEP (D-19)` read (census B14). | D-12, D-19 |
| #250 | Yeet gh-CLI surface (`PullRequest`, `Planner`, `MergeGate` and others) | Migrated across W4, W6 and W7a; `Planner` plan steps and `PullRequest`'s `gh pr create` fallback seam carry `KEEP (D-13)` / `KEEP (W6)` / `KEEP (D-18)` comments. | D-13, D-15, D-18 |
| #303 | repo-cli Reviewer | As #74 to #76; the `gh auth token` and `op read` credential spawns run on `@beep/commands` `Run.text`. | D-05, D-12 |

## git wrappers (11)

| Row | Site | Outcome | Decision |
| --- | --- | --- | --- |
| #100 | `R/internal/repo-run/GitExec.ts` | Typed readers on `Git` (W1a); generic runners deleted (W7 retire). Left: `runGitStructured` for `writeGitArchive` (X3 KEEP) and `runGitFoldedStdout` for the streamed byte digests (Y33, and HeadMove's under D-22). | D-08, D-21, D-22 |
| #101 | `R/commands/Yeet/internal/GitExec.ts` | Migrated onto `Git` and `patientGit`; the W1b `lockfileChangedSinceBase` KEEP moved in W2 onto `Git.changedFiles({ pathspec: ["bun.lock"] })`. | D-09, D-10, D-18 |
| #102 | `R/internal/repo-run/ChangedFiles.ts` | Migrated onto `Git.unstagedChanges`, `stagedChanges`, `untrackedFiles` and `changedFiles`. | D-10 |
| #105 | `R/commands/Worktree/Worktree.schemas.ts` | Migrated onto `Git`. No spawn literal remains. | D-10 |
| #106 | `R/commands/Worktree/Fleet.service.ts` | Reads migrated in W2 and W7c; the `runGitProbe` callers that scan other clones stay with eight `KEEP (D-20)` comments. | D-10, D-20 |
| #107 | ai-metrics `config-snapshot.ts` | `ls-files` migrated (W2b); the two evidence probes stay (X8 `KEEP (W2b, SPEC D-11)`, X9 `KEEP (D-21)`). | D-11, D-21 |
| #110 | `R/commands/Knowledge/KnowledgeDoctor.grouping.ts` | Kept in W2 (`Git.log` had no starting ref), then moved onto the W7 kit's `log` options: `pathRemovals` reads `Git.log` and `knowledgePathRemovalsFromLog` folds its entries. No spawn literal remains. | D-10, D-17 |
| #111 | `R/commands/Knowledge/KnowledgeDoctor.service.ts` | Migrated onto `Git.isAncestor` (G9) with the `Git.isShallow` refusal kept. | D-07 |
| #112 | per-group git wrappers | One-liners migrated in W2 and W2b; the rest in W7a/W7b/W7c or `KEEP` with census reasons. | D-10, D-11, D-18, D-19, D-20 |
| #251 | `GitExec.ts` and the Yeet git helper layer | As #100 and #101. | D-08, D-09, D-21 |
| #252 | typed git wrappers (Codex Security, Session and others) | Migrated in W2 and W7b. | D-10, D-19 |

## `ScriptedSpawner` test sweep (4)

| Row | Site | Outcome | Decision |
| --- | --- | --- | --- |
| #125 | repo-cli tests (and driver/app tests) | Moved onto `@beep/commands` `ScriptedSpawner`; the doubles that stay carry `// Own double:` comments. W8 brought the doubles added after W5 under the same rule. | D-14, D-22 |
| #279 | repo-cli tests | As #125. | D-14, D-22 |
| #291 | `@beep/test-utils` | No second double: `ScriptedSpawner` lives in `@beep/commands`, so the test kit stays free of a drivers dependency. | D-14 |
| #300 | tailscale `tailscale.test.ts` | Moved onto `ScriptedSpawner` (`hang: true` for the never-finishing case). | D-14 |

## Other (4)

| Row | Site | Outcome | Decision |
| --- | --- | --- | --- |
| #281 | `R/commands/Yeet/internal/GhOps.ts` | Already a kit-backed facade; its `gh` login helpers run through `ghOutput`. No spawn literal remains in the file. | D-03, D-15 |
| #304 | ai-metrics (git half) | As #107. | D-11, D-21 |
| #124 | `R/commands/Reviewer/GitHubAppAuth.ts` (App-auth spawns) | As #74. | D-12 |
| #281 | `GhOps.ts` splicer (second listing) | As the first #281 row. | D-03, D-15 |
