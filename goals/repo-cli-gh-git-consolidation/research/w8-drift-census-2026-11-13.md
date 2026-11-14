# W8 drift census: repo-cli gh/git consolidation

Read-only re-census of hand-rolled `git` and `gh` spawns in repo-cli and ai-metrics, taken at `05ed8bc6b6c`
(origin/main, 2026-11-13) on lane `chore/gh-git-closeout`, then worked under decision D-22: a row migrates only
where an existing kit member covers its argv and its caller's contract exactly; every other row stays hand-rolled
with a `// KEEP (D-22): <reason>` comment directly above the spawn. No kit member was added.

Method: the W7 census searches (`research/w7-site-census-2026-11-03.md`, "How the census was taken") over `R/` and
`A/`: the generic runners, every literal `"git"` / `"/usr/bin/git"` / `"gh"` spawn and group helper, and the raw
spawn APIs (`ChildProcess.make(`, `Bun.spawn`, `spawner.spawn(`). A row is new drift when it has no census row, or
its census row carries no recorded outcome. Line numbers are from `05ed8bc6b6c`.

Path prefixes as in the W7 census: `R/` = `packages/tooling/tool/cli/src`, `A/` =
`packages/tooling/library/ai-metrics/src`, `T/` = `packages/tooling/tool/cli/test`. Introducing PRs are the squash
merges on `main`, dated by their commit date.

## Drift rows

| File | Argv | Introduced | Outcome |
| --- | --- | --- | --- |
| `R/commands/Yeet/internal/Siblings.ts:421` | `fetch --quiet --no-tags --no-write-fetch-head origin refs/pull/<n>/head` | #2701, 2026-11-05 | migrated -> `patientGit.fetch({ remote: "origin", ref, noTags, noWriteFetchHead })`; any failure is the unavailable probe, as a non-zero exit was |
| `R/commands/Yeet/internal/Siblings.ts:435` | `merge-tree --write-tree --name-only <base> <head>` | #2701, 2026-11-05 | migrated -> `Git.mergeTree`; `clean` is the clean probe, `conflicted.paths` the conflicts, every failure unavailable |
| `R/commands/Yeet/internal/HeadMove.ts:104` | `config core.sshCommand` | #3130, 2026-11-12 | migrated -> `Git.configGet` (trimmed like the read it replaces); unset or failed is no configured command |
| `R/commands/Yeet/internal/HeadMove.ts:118` | `cat-file -e <sha>^{commit}` (missing-object probe) | #3130, 2026-11-12 | migrated -> `Git.refExists` (same argv); a failed probe reads as missing, as before |
| `R/commands/Yeet/internal/HeadMove.ts:133` | `cat-file -e <sha>^{commit}` (post-fetch check) | #3130, 2026-11-12 | migrated -> `Git.refExists`; a still-missing object fails the classification (unknown verdict) as the failed read did |
| `R/commands/Yeet/internal/HeadMove.ts:419` | `config user.email` | #3130, 2026-11-12 | migrated -> `Git.configGet` (not in the brief's list; the same exact member) |
| `R/commands/Yeet/internal/HeadMove.ts:425` | `show -s --format=%cI <sha>` | #3130, 2026-11-12 | migrated -> `Git.log({ revisions: [sha], limit: 1, omitPaths: true })[0].committedAt`, the same `%cI` instant; failure is `None` as before (new real-repo test) |
| `R/commands/Yeet/internal/HeadMove.ts:122` | `fetch --no-tags --no-write-fetch-head --no-auto-maintenance origin <sha>...` | #3130, 2026-11-12 | KEEP (D-22): `Git.fetch` takes one ref and no `--no-auto-maintenance`, and the kit cannot pass the per-call `GIT_TERMINAL_PROMPT` / BatchMode `GIT_SSH_COMMAND` env |
| `R/commands/Yeet/internal/HeadMove.ts:137` | `show -s --format=%P <sha>` | #3130, 2026-11-12 | KEEP (D-22): no kit member reads a commit's parent list |
| `R/commands/Yeet/internal/HeadMove.ts:144` | `show -s --format=format:%an%x00%ae%x00%aI%x00%ce <sha>` | #3130, 2026-11-12 | KEEP (D-22): no kit model carries the committer mailbox or the author date's original offset |
| `R/commands/Yeet/internal/HeadMove.ts:147` | `cat-file commit <sha>` | #3130, 2026-11-12 | KEEP (D-22): raw commit object (headers, `gpgsig`, exact message), single-consumer plumbing (D-03) |
| `R/commands/Yeet/internal/HeadMove.ts:226` | `diff-tree --no-commit-id --raw --no-renames --no-abbrev -r -z <sha>^ <sha> --` | #3130, 2026-11-12 | KEEP (D-22): `Git.nameStatus` drops the old/new modes the comparison reads |
| `R/commands/Yeet/internal/HeadMove.ts:252` | `--literal-pathspecs diff ... --binary --full-index <sha>^ <sha> -- <path>` (streamed digest) | #3130, 2026-11-12 | KEEP (D-22): streamed byte fold keeping invalid UTF-8, the Y33 reason (D-18) |
| `R/commands/Yeet/internal/HeadMove.ts:343` | `merge-tree --write-tree --merge-base=<old> <base> <before>` | #3130, 2026-11-12 | KEEP (D-22): `Git.mergeTree` has no `--merge-base` |
| `R/commands/Ci/CiOperational.service.ts:275` | `diff --name-only --no-renames <base>...<head>` | #2860, 2026-11-07 | KEEP (D-22): not exact. The change profile reads git's C-quoted lines, so a special-byte path never matches a docs pattern and keeps every profile; `Git.changedFiles` returns the raw `-z` path and flips `docs_only` (the `quoted path` golden in `T/ci-bootstrap-parity.test.ts` failed on the migration, which was reverted) |
| `R/commands/Ci/CiCachePilotInputs.ts:419` | `worktree add --detach <tree> <rev>` | #2906, 2026-11-07 | KEEP (D-22): not exact. Inherited stdio puts git's own output on the job log as the retired shell adapter did; the kit captures it |
| `R/commands/Ci/CiCachePilotInputs.ts:521` | `rev-parse HEAD` | #2906, 2026-11-07 | KEEP (D-22): not exact. git's stderr is inherited onto the job log; the kit captures it |
| `R/commands/Ci/CiCachePilotInputs.ts:526`, `:549` | `diff --quiet HEAD` (two rows) | #2906, 2026-11-07 | KEEP (D-22): the exit status is the step's own exit code; no exit-status member |
| `R/commands/Ci/CiCachePilotHost.ts:272` | `worktree remove -- <tree>` | #2906, 2026-11-07 | KEEP (D-22): not exact. git's `... is not a working tree` stderr streams to the job log, which `T/ci-cache-pilot.test.ts` pins against the shell adapter (failed on the migration, reverted) |
| `R/commands/Yeet/internal/ReadyGate.ts:1005` | `gh api repos/{owner}/{repo}/issues/<n>/comments --method POST --field body=<body>` | #2791, 2026-11-06 | migrated -> `GithubRest.createIssueComment` under `provideYeetGhLogin(repoRoot)` (the gh login the `gh api user` check read) |
| `R/commands/Yeet/internal/ReadyGate.ts:908` | `gh api repos/{owner}/{repo}/pulls/<n>` | #2791, 2026-11-06 | KEEP (D-22): `GithubRest.pullRequest`'s record drops `base.repo.full_name`, which decides comment coverage |
| `R/commands/Yeet/internal/ReadyGate.ts:927` | `gh api .../issues/<n>/timeline?per_page=100 --paginate --slurp` | #2791, 2026-11-06 | KEEP (D-22): `GithubRest.reviewTimeline` skips an undated event and folds to one `readyAt`; this read refuses an undated ready event and checks every draft transition |
| `R/commands/Yeet/internal/ReadyGate.ts:972` | `gh api user --jq .login` | #2791, 2026-11-06 | KEEP (D-22): no kit member reads the authenticated login |
| `R/commands/Yeet/internal/ReadyGate.ts:982` | `gh api .../issues/<n>/comments?per_page=100 --paginate --slurp` | #2791, 2026-11-06 | KEEP (D-22): `GithubRest` has no issue-comment listing |
| `R/commands/Goals/FinalPullRequest.ts:114` (`byNumber`) | `gh pr view <n> --json number,state,headRefName` | #3248, 2026-11-13 | migrated -> `PullRequest.get` over `layerWorktreeGithub(root)` (the gh login, `GH_REPO` or `origin`); `merged` -> `MERGED`, `open` -> `OPEN`, else `CLOSED`; any failure `None` |
| `R/commands/Goals/FinalPullRequest.ts:114` (`forBranch`) | `gh pr view --json number,state,headRefName` | #3248, 2026-11-13 | KEEP (D-22): any-state branch lookup; the kit has only `openPullRequestForBranch` |
| `R/commands/Ci/CiShardOverflow.ts:690` | `gh api --method GET repos/{owner}/{repo}/actions/runs -f status=<s> -f per_page=100 --jq .workflow_runs[].id` | #3256, 2026-11-13 | KEEP (D-22): no typed member lists runs by status |
| `R/commands/Ci/CiShardOverflow.ts:708` | `gh api --method GET --paginate .../actions/runs/<id>/jobs -f filter=latest -f per_page=100 --jq ...` | #3256, 2026-11-13 | KEEP (D-22): no typed member lists a run's jobs with runner `labels` |
| `R/commands/Ci/CiPartitions.service.ts:242` | `gh api repos/<o>/<r>/actions/jobs/<id>/logs --allow-escape-sequences` | #3007, 2026-11-09 | KEEP (D-22): raw redirect download under its own bound; no job-log member |
| `R/commands/Ci/Certainty.ts:1183` | `log --no-show-signature --first-parent --format=%H%x09%cI --since --until <ref>` | #3118, 2026-11-12 | KEEP (D-22): `Git.log` has no `--first-parent` or `--until` |
| `R/commands/Ci/Certainty.ts:1202` | `diff-tree --no-commit-id --name-only --no-renames -r <sha>` | #3118, 2026-11-12 | KEEP (D-22): `diff-tree` answers nothing for a merge commit; `changedFiles` compares two trees |
| `R/commands/Cache/Cache.fingerprint.ts:291` | `ls-files --cached --deduplicate -z -- *.test.ts *.test.tsx` | #2826, 2026-11-06 | KEEP (D-22): hashes git's raw NUL-framed stdout under a scrubbed env (`extendEnv: false`), the B126 reason (D-19) |
| `R/commands/Cache/Cache.fingerprint.ts:327` | `ls-files --stage -z` (`GitCommand.lsFiles()` argv) | #2826, 2026-11-06 | KEEP (D-22): as `:291` |
| `A/git-root-evidence.ts:195` | `config --local --get remote.origin.url` | #2364, 2026-10-31 | KEEP (D-22): evidence probe on X10's scrubbed `readGit` (per-call `GIT_*` overrides cleared, 16 KiB cap, strict UTF-8, exit 1 read as no origin) |

Totals: 35 argv rows (the two `diff --quiet` rows share a table line); 9 migrated (7 git, 2 gh), 26 KEEP (D-22).

### Shifts in the migrated rows

- Siblings: the conflicted paths come from `-z`, so a non-ASCII path is reported raw where `--name-only` printed it
  C-quoted (display only). The merge-tree argv the suite asserts is the kit's
  (`merge-tree --write-tree -z --name-only --end-of-options`); the fetch drops `--quiet` (stdout was never read).
  The fetch now runs on the 15-minute patient instance where the capture had no timeout.
- ReadyGate: a failed comment post names the REST failure (`gh reviewer request failed (GitHubError)`) where it
  named the gh capture's failure tag; the caller still downgrades it to the manual-request warning.
- FinalPullRequest `byNumber`: the repository is `GH_REPO` or `origin`, where `gh` could resolve another remote
  (the W7c shift, D-20).
- HeadMove: the object probes and config reads no longer go through the strict-UTF-8 fold; their values are a
  sha check and a trimmed config value, so only a non-UTF-8 `core.sshCommand` or `user.email` reads differently.

## Comment-only rows

Already compliant or already recorded; only the `// KEEP` comment was missing.

| File | Argv | Outcome |
| --- | --- | --- |
| `R/internal/github/GithubIdentity.ts:483` | `gh auth token` | `// KEEP (D-05)`: identity policy, on `@beep/commands` `Run.text` (introduced #1508, 2026-10-06; moved onto `Run.text` in W3) |
| `R/internal/github/GithubIdentityConfig.ts:141` | `gh config get -h github.com user` | `// KEEP (D-05)`: on `Run.text`; no gh configuration member (introduced #3068, 2026-11-10) |
| `R/bin.ts:22` | three `lint --fix` no-op reads (`diff --name-only`, `diff --cached --name-only`, `ls-files --others`) | `// KEEP (D-21, X4-X6)`: pre-runtime `Bun.spawnSync` |
| `R/bin-main.ts:125` | `remote get-url origin` | `// KEEP (D-21, X7)`: read before `Git.layer` exists |
| `R/internal/repo-run/GitExec.ts:603` | `-c ... archive --format=tar --output=<path> <commit>` | `// KEEP (D-21, X3)`: `-c` config, per-call env, bytes to `--output` |
| `A/config-snapshot.ts:761` | `rev-parse --git-dir` | `// KEEP (D-21, X9)`: exit code and capped stderr are the evidence |
| `A/git-root-evidence.ts:213` | `-c core.fsmonitor=false rev-parse --path-format=absolute --show-toplevel --absolute-git-dir --git-common-dir` | `// KEEP (D-21, X10)`: `-c` plus the scrubbed per-call env |
| `R/commands/Research/Library/Library.github.ts:109` | `-c core.hooksPath=/dev/null clone --no-checkout --no-recurse-submodules -- <remote> <clone>` | `// KEEP (D-19, B87)` |
| `R/commands/Research/Library/Library.github.ts:117` | `-C <clone> remote get-url origin` | `// KEEP (D-19, B88)` (the existing D-19 comment, now numbered) |
| `R/commands/Research/Library/Library.github.ts:129` | the clone `git` helper | `// KEEP (D-19, B87-B107 clone reads)` |
| `R/commands/Research/Library/Library.github.ts:256`, `:302`, `:372`, `:457`, `:487` | the five `gh api` evidence reads | `// KEEP (D-19, B108)` .. `// KEEP (D-19, B112)`: raw gh text is the stored evidence |
| `R/commands/Yeet/internal/GitExec.ts:91` | `runGitFoldedStdout` JSDoc | stale "one caller" sentence (and a missing ` * ` prefix) fixed: Y33 plus HeadMove's reads and patch digest |

## Test doubles (D-14)

| File | Double | Outcome |
| --- | --- | --- |
| `T/gh-spawn-attribution.test.ts` | every spawn fails NotFound | moved to `ScriptedSpawner.make(() => ScriptedSpawner.notFound("gh"))` via `provideSpawner` |
| `T/github-identity-credential.coverage.test.ts` (1) | every spawn fails NotFound | moved to `ScriptedSpawner` (`notFound("gh")`) |
| `T/github-identity-credential.coverage.test.ts` (2) | decorates the scripted `gh auth token` with an oversized stdout | `// Own double`: per-spawn stream shape |
| `T/github-ledger-command-timer.coverage.test.ts` | every spawn fails NotFound | moved to `ScriptedSpawner` (`notFound("systemctl")`) |
| `T/qa-doctor.test.ts` | every spawn fails NotFound | moved to `ScriptedSpawner.make(() => ScriptedSpawner.notFound(...)).layer` |
| `T/yeet-tier-dedupe.test.ts` | counts `write-tree` over the real spawner | `// Own double`: decorates the real platform spawner |
| `T/history-notes-git.test.ts` | adds isolated git config env over the real spawner | `// Own double`: decorates the real platform spawner |
| `T/knowledge-doctor-removals.test.ts` | records argv over the real spawner | `// Own double`: decorates the real platform spawner |
| `T/research-library-acquisition.test.ts` (1) | runs `/usr/bin/true` for every spawn | `// Own double`: real child streams |
| `T/research-library-acquisition.test.ts` (2) | records `op` argv, runs `printf` / `false` | `// Own double`: decorates the real platform spawner |
| `T/ci-cache-pilot-in-process.test.ts` | runs a side effect before each scripted answer | `// Own double`: decorates `ScriptedSpawner` with per-spawn file writes |
| `T/ci-partitions.test.ts` | dies on any spawn | `// Own double`: must-not-spawn guard (`ScriptedSpawner` records instead of dying) |
| `T/compute-command.test.ts` | dies on any spawn | `// Own double`: must-not-spawn guard |
| `T/github-ledger.test.ts` | dies on any spawn | `// Own double`: must-not-spawn guard |
| `T/history-command.test.ts` | dies on any spawn | `// Own double`: must-not-spawn guard |
| `T/Research/research-library-mine-pdf.test.ts` | dies on any spawn | `// Own double`: must-not-spawn guard |
| `T/github-app-mint-outcomes.test.ts` | dies only on `op-doctor` over the scripted store | `// Own double`: injects a defect |
| `T/github-app-mint.test.ts` | puts fixture scripts on PATH over the real spawner | `// Own double`: decorates the real platform spawner |
| `T/quality-step-timeout.test.ts` | one handle that never exits until killed | `// Own double`: drives the capture timeout |
| `T/Research/research-library-mine-runner.test.ts` | reads stdin, hanging / failing handles | `// Own double`: per-spawn behaviour |
| `T/support/GithubLedgerFakes.ts` | value-level line-keyed `scriptedSpawner` | `// Own double`: shared value-level spawner many suites provide with `Effect.provideService` and read as lines |
| `packages/tooling/library/ai-metrics/test/claude-cowork-lifecycle.test.ts` (2) | stdin-gated synthetic helper; real spawner with the second spawn stubbed | `// Own double` on both |
| `packages/tooling/library/ai-metrics/test/cursor-lifecycle.test.ts` (3) | ACK-gated exit with release count; stdin-gated helper; output-request signal with release count | `// Own double` on all three |

## Tests changed by the migrations

- `T/yeet-siblings.test.ts`: the scripted merge-tree answers are the kit's `-z` form; the asserted argv are the kit's.
- `T/yeet-head-move.test.ts`: the interruption double stubs `configGet` and `refExists`; a new real-repo case pins
  `committerInstant` against `show -s --format=%cI` and an unknown commit as `None`.
- `T/yeet-review-comment-request.test.ts`: runs under `provideLegacyGh`, so the comment POST reaches the scripted
  `gh` as `api -X POST repos/{owner}/{repo}/issues/42/comments body=<body>` and answers a decodable comment.
- `T/goals-final-pull-request.test.ts`: `byNumber` reads a recorded `GET {repo}/pulls/12` through
  `GithubTransportFetch`, with `gh auth token` and `git remote get-url origin` scripted.
