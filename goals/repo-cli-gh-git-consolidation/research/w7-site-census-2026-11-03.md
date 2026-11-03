# W7 call-site census: repo-cli gh/git consolidation

Read-only census of every hand-rolled `git` and `gh` spawn left in repo-cli after W0..W6, taken on lane
`feat/gh-git-w7-kit` at origin/main `e4f5395ff4` (2026-11-03) by a Claude Opus 5.5 research subagent. Every row
was re-found with `rg` on this tree; line numbers are from this head. Nothing was executed except read-only `git`
size probes (noted where used).

Path prefixes: `R/` = `packages/tooling/tool/cli/src`, `T/` = `packages/tooling/tool/cli/test`, `K/` =
`packages/drivers/git/src`, `A/` = `packages/tooling/library/ai-metrics/src`.

## How the census was taken

Searches (all under `R/`, comment lines dropped):

- the generic runners: `rg '\b(runGitOutput|runGitPathList|runGitLines|runGitRawOutput|runGitFoldedStdout)\b'`;
- every literal spawn of either tool: `rg '"git"|"/usr/bin/git"'` and `rg '"gh"|\bghOutput\('`, which also catches
  the group-local helpers (`captureGit`, `captureHost`, `successfulOutput`, `collectProcessOutput`, `runForOutput`,
  `capturedText`, `runLibraryCommand`, `runText`, `runInherited`, `runStreamingStep`, `runCommandStep`, plan steps);
- raw spawn APIs: `rg 'ChildProcess\.make\(|Bun\.spawn|spawner\.(string|spawn)\('`, each hit read to rule git and
  gh in or out;
- `A/` for the same patterns (only the three recorded ai-metrics KEEPs remain).

Counting rule: **one row per argv template**. When a group helper takes its argv from callers (for example
`gitLine`, `runWorktreeGitCapture`, `gitOutputOrNone`, `captureGit`), each caller is a row and the helper is named
in the route column. When a helper hardcodes its argv (`changedPaths`, `filePatch`, `gitReadAt`), the helper is
the row. This is why some files count more rows than the closeout ledger draft's runner-line count.

The "Prior" column names the ledger row that already recorded an outcome (KEEP, or a reason now stale). "—" means
the site has no recorded outcome. Every prior KEEP was re-checked against the current kit.

### Route abbreviations

| Abbrev | Spawn route | Output shape it gives the caller |
| --- | --- | --- |
| `YGX.out` | Yeet `runGitOutput` (`R/commands/Yeet/internal/GitExec.ts:103`) over shared `runGitOutput` | stdout and stderr merged, trimmed, 512 KiB bound, Yeet adapter fails on truncation |
| `YGX.paths` | Yeet `runGitPathList` (`:161`) over shared `runGitPathList` | stdout only, NUL-split, sorted unique, 8 MiB stdout bound |
| `YGX.fold` | Yeet `runGitFoldedStdout` (`:136`) over shared `runGitFoldedStdout` | stdout streamed into a fold, never buffered |
| `GX.out`, `GX.paths`, `GX.lines`, `GX.raw`, `GX.fold` | shared runners, `R/internal/repo-run/GitExec.ts:503`, `:551`, `:593`, `:604`, `:655` | as above; `lines` is unbounded stdout split on newlines; `raw` is unbounded, untrimmed stdout |
| `RRC` | `runRepoCommandCapture` (`R/internal/repo-run/RepoRun.executor.ts:108`) | `{ exitCode, output, truncated }`, merged and trimmed, 512 KiB |
| `RRCstream` | `runRepoCommandStreamingCapture` (`:133`) | as `RRC`, tee'd to the terminal |
| `SE.cap`, `SE.streams`, `SE.exit` | StepExec `runCaptured`, `runCapturedStreams`, `runToExit` | caller-chosen bound, env and stdio |
| `ghOutput` | `R/internal/github/GhCommand.ts:91` over `RRC("gh", ...)` | gh CLI stdout, the gh login's credential |
| `plan` | a `RepoPlanStep` run by `executeRepoPlanStepStreaming` | streamed to the operator, recorded as a lane step |

### What the kit gives, and where it differs from the runners

`@beep/git` (`K/Git.ts`, `GitShape` at `:2180`; argv builders in `K/GitCommand.ts`) runs `git` from `PATH` with
`extendEnv: true` plus `BASE_ENV` (`LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`,
`SSH_ASKPASS_REQUIRE=never`; `K/internal/sshEnvironment.ts:5`), returns stdout only, decodes it as UTF-8 text, and
fails closed on `GitOptions.maxOutputBytes` (default 16 MiB) and `GitOptions.timeout` (default 30 s). The
environment is read once when the instance is built; there is no per-call env, no `-c key=value`, and no absolute
binary path. Failures are `GitCommandError` (kinds `failed`, `refused`, `truncated`), `NotARepositoryError` and
`UnknownRefError`; `adaptGitKitError` (`R/internal/repo-run/GitExec.ts:259`) folds them back into any caller's
`GitCommandErrorAdapter`, so an `(A)` migration keeps each caller's error wording. Long or network-bound calls
use `patientGit` (`R/commands/Yeet/internal/GitExec.ts:339`, `GitOptions.make({ timeout: Duration.minutes(15) })`).

Consequences that recur below:

- Callers that read `--short` or non-`-z` output move to raw, unquoted paths. That is a correctness gain for
  paths with special characters, not a regression.
- `runGitOutput` merges stderr into the value it returns. The kit keeps stderr for the error only, so a
  zero-exit warning can no longer leak into a ref name or a count.
- Content diffs, streamed folds and byte-exact output cannot be expressed: the kit decodes stdout as text and
  buffers it.

## Key findings

1. **Latent defect, `R/commands/Yeet/internal/FinalCheckRefresh.ts:397` (`statusCounts`).** It reads
   `standards/effect-vitest.inventory.jsonc` at each revision through `YGX.out`, whose bound is 512 KiB
   (`R/internal/process/StepExec.ts:295`). The Yeet adapter fails on truncation (`GitErrorAdapter.ts:98`). The
   inventory is 687,609 bytes at this head. The read therefore fails, `Effect.option` turns the failure into
   `None`, and `:398` reads `None` as "an absent file has no findings". All four revisions read as empty maps, so
   `effectVitestDrift` reports no drift whatever the inventories hold. The tests use small fixture inventories
   (`T/yeet-final-check-refresh.test.ts:31`), so they cannot catch it. Moving the read onto `Git.show` (16 MiB)
   fixes the bound. The migration must also keep absence (`None`) apart from a failed read (unreadable).
2. **The kit's 16 MiB bound is too small for one log.**
   `R/commands/Knowledge/KnowledgeDoctor.service.ts:1570` runs the path-removal log over the whole history
   (`git log --diff-filter=DR -M --name-status` from the tree commit), and that log measures 21,331,346 bytes at
   this head. Any kit route there needs a `Git.makeWith({ maxOutputBytes: 64 MiB })` instance.
3. **`Git.log` always emits paths.** `R/commands/Goals/Doctor.ts:1030` (`log --format=%s -n 4000`, 253,932 bytes)
   would grow to 13,551,383 bytes, 81 % of the default bound, on the kit's forced `--name-only`. That forces a
   `log` option to omit paths. Separately, `Doctor.ts:1020` (21-day goals log) is already at 438,423 bytes of
   `runGitOutput`'s 524,288-character bound, and the Goals adapter does not fail on truncation
   (`Doctor.ts:826`), so it will silently go partial soon.
4. **P0 and the ledger draft missed these live spawns** (every one is a row below):
   - `R/commands/Worktree/Reap.service.ts` (five, including a `gh pr list`);
   - `R/commands/Qa/Qa.session.ts:570` (two);
   - `R/commands/Research/internal/RepoCards.ts` (three, including `gh api user/starred`);
   - all of `R/commands/Research/Library/*`: 22 git and five gh, behind the hardened `runLibraryCommand`;
   - the Cache trust-boundary probes in `Cache.pilot.ts`, `Cache.pilot.runner.ts`, `Cache.adapter.ts`,
     `Cache.fingerprint.ts` and `Cache.census.ts`;
   - `R/commands/Quality/FallowQuality.command.ts` (six);
   - the streamed `Worktree.command.ts` steps at `:519`, `:548` and `:893`;
   - `ExpectationRewrite.ts:616` and `:629` (`runInherited` worktree add and remove);
   - the Planner `status --short --branch` step (`Planner.ts:747`);
   - six more `gh` reads in `R/commands/Goals/Completion.ts` and one more in `CompletionEvidence.ts`, all through
     the same port as the draft's #83c row.
5. **These recorded KEEP reasons no longer hold against the kit:**
   - "`Git.lsFiles` lists index stages, not the plain listing" (O-16b `:2684`, O-19, O-22). Plain `ls-files`
     repeats unmerged paths too unless `--deduplicate` is given, so `lsFiles().map(e => e.path)` is the plain
     listing.
   - The O-06 `show-ref --verify` probe: `refExists` covers it.
   - O-25 `diff --cached --quiet`: `stagedChanges()` non-empty is the same answer.
   - #251b `branch --show-current`: `currentBranch({ mode: "show-current" })` exists since the W2 kit.
   - The O-03b `ls-remote` probe: `lsRemote` returns `[]` on a clean miss.

## Census

### W7a: Yeet (`R/commands/Yeet/**`)

| # | Site | argv | Route | Output use | Class | Kit member, or reason | Prior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Y1 | `internal/PublishScope.ts:461` | `stash push --keep-index --include-untracked -m <marker>` | `YGX.out` | exit | B | `stashPush({ message, includeUntracked: true, keepIndex: true })` (E4) | — |
| Y2 | `PublishScope.ts:462` | `rev-parse stash@{0}` | `YGX.out` | trimmed | A | `revParse(cwd, "stash@{0}")` (adds `--verify`) | — |
| Y3 | `PublishScope.ts:477` | `stash list --format=%H %gd %s` | `YGX.out` | lines; match sha or marker, take `%gd` | A | `stashList()`: match `entry.sha` or `entry.message` containing the marker, take `entry.ref` | — |
| Y4 | `PublishScope.ts:532` | `stash pop <stash@{n}>` | `YGX.out` | exit; every failure caught and logged | A | `stashPop({ index })`, index parsed from `StashEntry.ref`; `MergeConflictError`/`DirtyWorktreeError` land in the same catch | — |
| Y5 | `PublishScope.ts:711` | `merge-base <base> HEAD` | `YGX.out` | trimmed | A | `mergeBase(cwd, base, "HEAD")` | — |
| Y6 | `PublishScope.ts:719` | `rev-list --count <mb>..<base>` | `YGX.out` | count | B | `revListCount` (N1) | — |
| Y7 | `PublishScope.ts:728` | `diff --name-only -z <mb>..HEAD` | `YGX.paths` | NUL paths, sorted unique | A | `changedFiles({ base: mb, head: "HEAD", twoDot: true })` + `sortedUniquePaths` | — |
| Y8 | `PublishScope.ts:731` | `diff --name-only -z <mb>..<base>` | `YGX.paths` | NUL paths | A | as Y7 | — |
| Y9 | `PublishScope.ts:847` | `rev-parse --abbrev-ref --symbolic-full-name @{u}` | `RRC` | trimmed; nonzero is none | B | `currentBranch` then `upstream(cwd, branch)` (N3), strip `refs/remotes/` | O-06 KEEP ("no kit member") |
| Y10 | `PublishScope.ts:911` | `show-ref --verify --quiet refs/remotes/origin/<b>` | `RRC` | exit | A | `refExists(cwd, "refs/remotes/origin/<b>")`; differs only for a ref whose object is missing | O-06 KEEP (stale) |
| Y11 | `PublishScope.ts:916` | `rev-list --count <ref>..HEAD` | `YGX.out` | count | B | `revListCount` (N1) | — |
| Y12 | `PublishScope.ts:928` | `diff --name-only -z <ref>..HEAD` | `YGX.paths` | NUL paths | A | as Y7 | — |
| Y13 | `PublishScope.ts:1208` | `ls-files --cached -z -- <paths>` | `YGX.paths` | NUL paths | A | `lsFiles({ pathspec })` mapped to `path`, `sortedUniquePaths` (dedupes unmerged stages, as today) | — |
| Y14 | `PublishScope.ts:1211` | `ls-files --cached --ignored --exclude-standard -z -- <paths>` | `YGX.paths` | NUL paths | B | `checkIgnore(cwd, paths, { noIndex: true })` (E6); the inputs are already index paths (`publishRestagePaths` keeps only indexed ones), so both answer "which tracked paths match an ignore rule" | — |
| Y15 | `PublishScope.ts:1225` | `add -- <paths>` | `YGX.out` | exit | A | `add(cwd, paths)` | — |
| Y16 | `PublishScope.ts:1228` | `add --force -- <paths>` | `YGX.out` | exit | B | `add(cwd, paths, { force: true })` (E5) | — |
| Y17 | `internal/Handler.ts:424` | `rev-parse <base>` | `YGX.out` | trimmed | A | `revParse(cwd, base)` | — |
| Y18 | `Handler.ts:1450` | `show -s --format=%P HEAD` | `YGX.out` | split parents, require exactly two | A | `revParse("HEAD^1")`, `revParse("HEAD^2")`, `refExists("HEAD^3") === false`; `UnknownRefError` is the refusal | — |
| Y19 | `Handler.ts:1458` | `fetch --quiet --no-tags origin refs/heads/<b>` | `YGX.out` | exit (writes `FETCH_HEAD`) | B | `patientGit.fetch({ ref: "refs/heads/<b>", noTags: true })` (E1) | — |
| Y20 | `Handler.ts:1459` | `rev-parse FETCH_HEAD` | `YGX.out` | trimmed | A | `revParse(cwd, "FETCH_HEAD")` | — |
| Y21 | `Handler.ts:1460` | `merge-base <p2> <base>` | `YGX.out` | trimmed | A | `mergeBase` | — |
| Y22 | `Handler.ts:1462` | `merge-tree --write-tree <p1> <p2>` | `YGX.out` | trimmed tree; any failure is a refusal | B | `mergeTree(cwd, p1, p2)` (N2); `conflicted` is the refusal | — |
| Y23 | `Handler.ts:1465` | `rev-parse HEAD^{tree}` | `YGX.out` | trimmed | A | `revParse(cwd, "HEAD^{tree}")` | — |
| Y24 | `internal/FinalCheck.ts:548` | `status --porcelain --untracked-files=all` | `YGX.out` | non-empty | A | `status({ untrackedFiles: "all" })` non-empty | — |
| Y25 | `FinalCheck.ts:565` | `rev-parse HEAD` | `YGX.out` | trimmed | A | `revParse` | — |
| Y26 | `FinalCheck.ts:621` | `rev-parse HEAD` | `YGX.out` | trimmed | A | `revParse` | — |
| Y27 | `FinalCheck.ts:622` | `merge-base <base> HEAD` | `YGX.out` | trimmed | A | `mergeBase` | — |
| Y28 | `FinalCheck.ts:623` | `diff --name-only -z --diff-filter=d <mb> HEAD` | `YGX.paths` | NUL paths | A | `changedFiles({ base: mb, head: "HEAD", twoDot: true, diffFilter: "d" })` | — |
| Y29 | `internal/FinalCheckRefresh.ts:466` (helper `gitLine` `:213`) | `merge-base <r> <base>` | `YGX.out` | trimmed | A | `mergeBase` | — |
| Y30 | `FinalCheckRefresh.ts:467` (`gitLine`) | `merge-base <finalHead> <base>` | `YGX.out` | trimmed | A | `mergeBase` | — |
| Y31 | `FinalCheckRefresh.ts:544` (`gitLine`) | `rev-list --count <head>..<finalHead>` | `YGX.out` | count | B | `revListCount` (N1) | — |
| Y32 | `FinalCheckRefresh.ts:217` (`changedPaths`, callers `:468`, `:469`) | `diff --name-only --no-renames -z <from> <to>` | `YGX.paths` | NUL paths into a `HashSet` | A | `changedFiles({ base: from, head: to, twoDot: true, noRenames: true })` | — |
| Y33 | `FinalCheckRefresh.ts:384` (`filePatch`, callers `:474`, `:475`) | `diff --no-color --no-renames --no-ext-diff --binary --full-index <from> <to> -- <path>` | `YGX.fold` | stdout bytes folded into a patch-identity digest | C | streamed byte fold; comment at `:223`: content lines "keep every byte, whitespace and invalid UTF-8 included". The kit buffers decoded text. This is the last `runGitFoldedStdout` caller | — |
| Y34 | `FinalCheckRefresh.ts:397` (`statusCounts`) | `show <rev>:standards/effect-vitest.inventory.jsonc` | `YGX.out` | text; any failure read as absent | A | `show(cwd, rev, path)`: `None` is absent; a failure must surface as unreadable. Fixes key finding 1 | — |
| Y35 | `internal/ProofState.ts:217` | `config --get remote.origin.url` | `YGX.out` | trimmed; a missing key fails | A | `configGet(cwd, "remote.origin.url")`, `None` fails as today | — |
| Y36 | `ProofState.ts:292` | `diff --binary --output=<path> HEAD` and `... --cached` | `YGX.out` | exit; the patch bytes are read back from the file | C | git writes a byte-exact patch into a path fenced inside the artifact tree (`:284`, "Fail closed if the fingerprint target (or a symlink...) resolves outside"); the kit only returns decoded stdout. Moves to `RRC` at retirement | — |
| Y37 | `ProofState.ts:336` | `status --short` | `YGX.out` | text into the proof fingerprint | A | `StatusEntry.format(yield* git.status(cwd), { renames: "arrow" })`; fingerprint bytes change once (porcelain v1 lines; `--short` also honours `status.branch`), so pre-switch proof-reuse records miss once | — |
| Y38 | `internal/Provenance.ts:1329` | `rev-parse --git-common-dir` | `GX.out` | trimmed, resolved against the checkout root | A | `commonDir` (absolute; today's relative answer is relative to cwd, not to the checkout root, a latent mismatch the kit removes) | — |
| Y39 | `Provenance.ts:1330` | `rev-parse --show-toplevel` | `GX.out` | trimmed | A | `repoRoot` | — |
| Y40 | `Provenance.ts:1533` | `config --get beep.workspace.label` | `GX.out` | trimmed, option | A | `configGet`, other failures to `None` as today | — |
| Y41 | `internal/ExpectationRewrite.ts:498` | `diff --unified=0 --no-color --find-renames=50% <mb> HEAD -- <paths>` | `GX.out` (`fileDiffAdapter`) | patch text; truncation is the typed `ExpectationDiffOverflow` | B | `diffPatch({ base: mb, head: "HEAD", unified: 0, findRenames: 50, pathspec })` (N6) on a `Git.makeWith({ maxOutputBytes: 512 KiB })` instance; `kind: "truncated"` maps to the overflow | — |
| Y42 | `ExpectationRewrite.ts:544` | `diff --name-only -z --diff-filter=M <mb> HEAD -- <pathspec>` | `YGX.paths` | NUL paths | A | `changedFiles({ twoDot: true, diffFilter: "M", pathspec })` | — |
| Y43 | `ExpectationRewrite.ts:616` | `worktree add --detach <baseRoot> <mb>` | `SE.exit` via `runInherited` | exit code | A | `patientGit.worktreeAdd(cwd, baseRoot, { ref: mb, detach: true })`; failure becomes the existing "unverified" verdict | — |
| Y44 | `ExpectationRewrite.ts:629` | `worktree remove --force <baseRoot>` | `SE.exit` | ignored | A | `worktreeRemove(cwd, baseRoot, { force: true })` | — |
| Y45 | `internal/HeadInstallReceipt.ts:202` | `rev-parse <sha>^{tree}` | `YGX.out` | trimmed | A | `revParse` | — |
| Y46 | `HeadInstallReceipt.ts:204` | `ls-tree -r --full-tree <sha>` | `YGX.fold` | folded to install-input lines | A | `lsTree(cwd, sha, { fullTree: true })` (adds `-z`, so no quoted paths); the whole listing is 6,719,002 bytes at this head, inside 16 MiB | — |
| Y47 | `internal/MergedPreview.ts:574` | `rev-parse <head>` | `YGX.out` | trimmed | A | `revParse` | — |
| Y48 | `MergedPreview.ts:575` | `rev-parse <base>` | `YGX.out` | trimmed | A | `revParse` | — |
| Y49 | `MergedPreview.ts:584` (helper `gitCapture` `:458`) | `merge-tree --write-tree <base> <head>` | `RRC` | exit 0/1 plus parsed tree, paths and messages | B | `mergeTree` (N2) | O-04b KEEP ("no kit member") |
| Y50 | `MergedPreview.ts:609` (`gitCapture`) | `commit-tree <tree> -p <base> [-p <head>] -m <msg>` | `RRC` | trimmed oid | C | single-consumer plumbing outside the typed-introspection contract (D-03, P0 §5); stays on `RRC` | O-04b KEEP |
| Y51 | `internal/GateStaleness.ts:628` | `diff --name-only -z <base>...<head>` | `YGX.paths` | NUL paths; failure is `[]` | A | `changedFiles({ base, head })` | — |
| Y52 | `internal/PortfolioIndexGuard.ts:230` | `diff --cached --diff-filter=D --name-only -z -- <path>` | `YGX.paths` | NUL paths | A | `stagedChanges({ diffFilter: "D", pathspec: [path] })` | — |
| Y53 | `internal/ProvenanceFooter.ts:664` | `rev-parse HEAD` | `GX.out` | trimmed | A | `revParse` | — |
| Y54 | `internal/PullRequestTitle.ts:273` | `log --no-merges --reverse --pretty=%s <range>` | `YGX.out` | first non-empty line | B | `log({ revisions: [range], noMerges: true, reverse: true, omitPaths: true })`, first `subject` (E3) | — |
| Y55 | `internal/PullRequest.ts:352` | `log --reverse --pretty=format:## %s%n%n%b <range>` | `YGX.out` | text: subjects and bodies | B | `log({ revisions: [range], reverse: true, includeBody: true, omitPaths: true })` (E3), rendered back to `## <subject>\n\n<body>` | #250i KEEP ("`Git.log` has no body") |
| Y56 | `Yeet.command.ts:775` (helper `git` `:765`, `PATH` env) | `rev-parse --abbrev-ref HEAD` | `RRC` with `PATH` | trimmed | A | `currentBranch(root)` + `O.getOrElse(() => "HEAD")`; the injected `PATH` is the inherited one, which the kit's `extendEnv` already passes | — |
| Y57 | `Yeet.command.ts:776` | `rev-parse --verify <head>` | `RRC` with `PATH` | trimmed | A | `revParse(root, head)` (identical argv) | — |
| Y58 | `internal/Planner.ts:489` (`commitStep`) | `commit -m <msg>`; `commit --amend -m <msg>`; `commit --amend --no-edit` | `plan` | streamed to the operator | C | the commit runs the repo's commit hooks, whose output must stream live through `executeRepoPlanStepStreaming` and can outlast the kit's 30 s default; the step is a recorded lane step (id, label, `resume: "never"`) | #250j unresolved |
| Y59 | `Planner.ts:513` (`pushStep`) | `push -u origin <refspec>` with `BEEP_YEET_REUSE_PRE_PUSH_PROOF=1` | `plan` | streamed | C | a per-step env for the pre-push hook (comment `:509`: "The prove-first push carries the proof-reuse marker it always carried"); the kit has no per-call env | #250j unresolved |
| Y60 | `Planner.ts:747` (`statusLocalStep`) | `status --short --branch` | `plan` | printed to the operator | C | human-facing step output; the `--branch` header line has no kit model | — |
| Y61 | `internal/Sweep.ts:1017` | `ls-remote origin refs/heads/<b>` | `RRC` (`captureCommand`) | tip parsed; empty is absent | A | `patientGit.lsRemote(cwd, "origin", { patterns: ["refs/heads/<b>"] })`; `[]` is absent | O-03b KEEP (stale) |
| Y62 | `Sweep.ts:1272` | `ls-remote origin refs/heads/<b>` | `RRC` | as Y61 | A | as Y61 | O-03b KEEP (stale) |
| Y63 | `Sweep.ts:1145` | `push origin --force-with-lease=refs/heads/<b>:<sha> :refs/heads/<b>` | `RRC` | exit plus `stale info` text | C | stands: `// KEEP (W2b)` at `:1144`, `Git.push` has no lease value; convertible only if `push` gains `forceWithLease: { ref, expected }` | O-03b KEEP |
| Y64 | `Sweep.ts:1550` | `fetch --prune origin` | `runCommandStep` | exit | B | `fetch({ prune: true })` with `ref` made optional (E1) | O-03b KEEP ("`Git.fetch` needs a ref") |
| Y65 | `Sweep.ts:1553` | `merge --ff-only refs/remotes/origin/<main>` | `runCommandStep` | exit | C | stands: no `merge` member, single consumer (D-03) | O-03b KEEP |

gh rows in W7a. All of them carry a recorded KEEP. Each was re-checked: the kit still lacks the named surface
(the checks rollup and its `bucket`, gh's branch-to-PR resolution in any state, the base-repository resolution,
GraphQL `author.login` without the `[bot]` suffix, and `--log-failed` step extraction).

| # | Site | argv | Route | Class | Reason | Prior |
| --- | --- | --- | --- | --- | --- | --- |
| Y66 | `internal/Status.ts:716` | `pr checks [--required] --json ...` | `RRC` | D KEEP | checks rollup with `bucket` | #78b |
| Y67 | `Status.ts:828` | `run list --branch <b> --limit 20 --json ...` | `RRC` | D KEEP | as #78b | #78b |
| Y68 | `Status.ts:1093` | `pr view` GraphQL fields | `ghOutput` | D KEEP | `mergeStateStatus`/`reviewDecision` are GraphQL-only | #78b |
| Y69 | `Status.ts:1124` | REST `pulls/{n} --jq` fallback | `ghOutput` | D KEEP | tri-state `mergeable` | #78b |
| Y70 | `internal/WatchMode.ts:183` | `pr checks --json ...` | `RRC` | D KEEP | checks rollup | #79b |
| Y71 | `WatchMode.ts:286` | `pr view --json ...` | `RRC` | D KEEP | branch-resolved view | #79b |
| Y72 | `internal/Settle.ts:364` | `api repos/{owner}/{repo}/rules/branches/<base>` | `RRC` | D KEEP | raw rules payload | #250g |
| Y73 | `internal/ReadyGate.ts:580` | `pr view <n> --json author --jq .author.login` | `ghOutput` | D KEEP | login without `[bot]` | #250g |
| Y74 | `internal/Retire.ts:504` | `pr view <branch> --json files` | `ghOutput` | D KEEP | branch lookup in any state | #250g |
| Y75 | `Sweep.ts:876` | `pr view <branch> --json ...` | `ghOutput` | D KEEP | branch lookup in any state | #250g |
| Y76 | `internal/Merge.ts:139` | `pr view <selector> --json ...` | `ghOutput` | D KEEP | branch lookup in any state | #250f |
| Y77 | `internal/PullRequest.ts:69` | `pr view` fallback | `ghOutput` | D KEEP | `// KEEP (W6)` at `:59` | #250f |
| Y78 | `internal/MonitorLoop.ts:1034` | `run view --job <id> --log-failed` | `RRC` | D KEEP | gh cuts the failing steps out of the log | #250f |
| Y79 | `internal/Reply.ts:1041` (helper `:816`) | `repo view --json owner,name` | `ghOutput` | D KEEP | gh's base-repository resolution | #82b |
| Y80 | `internal/closeout/GhCollect.ts:143` (helper `:84`) | closeout comment and review pages | `ghOutput` | D KEEP | no kit resource | #81b |
| Y81 | `GhCollect.ts:388` | `pr view ...` | `ghOutput` | D KEEP | branch-resolved view | #81b |
| Y82 | `GhCollect.ts:397` | `repo view --json owner,name` | `ghOutput` | D KEEP | base-repository resolution | #81b |
| Y83 | `Planner.ts:634` | `pr view --json number,headRefName,state` | `plan` | D KEEP | branch-resolved view step | #250g |
| Y84 | `Planner.ts:648` | `pr checks --watch --fail-fast ...` | `plan` | D KEEP | checks rollup step | #250g |
| Y85 | `Planner.ts:719` | `pr view --json ...,author` | `plan` | D KEEP | branch-resolved view step | #250g |
| Y86 | `Planner.ts:733` | `api graphql -f query=<yeet-closeout-review-query>` | `plan` | D KEEP | recorded closeout step (placeholder query) | #250g |
| Y87 | `Planner.ts:766` | `pr view --json ...,mergeStateStatus,reviewDecision` | `plan` | D KEEP | GraphQL-only fields | #250g |
| Y88 | `Planner.ts:804` | `pr checks --json <fields>` | `plan` | D KEEP | checks rollup step | #250g |

Not rows: the Planner `gh` descriptors at `:545` (`pr create`), `:592` (heavy label) and `:613` (provenance stamp).
They stay as lane records, and `Handler` hands them to kit calls (#250e), so nothing spawns them.

### W7b: Ci, Docgen, Knowledge, Quality, Goals, Holds, Laws, Lint, Runners, Research, Cache (plus Qa and Refs)

| # | Site | argv | Route | Output use | Class | Kit member, or reason | Prior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | `Ci/RouteClassify.ts:911` (`gitReadAt`) | `ls-tree -z --full-tree <ref> -- :(literal)<path>` | `GX.raw` | NUL entries, find the blob | A | `lsTree(cwd, ref, { fullTree: true, pathspec: [":(literal)<path>"] })`; the kit adds `-r`, which changes nothing for an exact-path blob lookup | — |
| B2 | `RouteClassify.ts:923` (`gitReadAt`) | `cat-file blob <oid>` | `GX.raw` | raw text | A | `show(cwd, ref, path)` once B1 has proved a blob: `git show <blob>` prints the plain contents (no textconv), the same bytes as `cat-file blob` | — |
| B3 | `RouteClassify.ts:931` | `diff --name-status -z --no-renames <base> <head> --` | `GX.raw` | NUL name-status table | B | `nameStatus({ base, head, twoDot: true, noRenames: true })` (E2) | — |
| B4 | `RouteClassify.ts:939` | `rev-list --count <base>..<head>` | `GX.raw` | count | B | `revListCount` (N1) | — |
| B5 | `Ci/RouteCensus.ts:675` | `sh -c 'printf ... \| git cat-file --batch-check'` | `RRCraw` | missing shas | C | stands: single-consumer plumbing (D-03, P0 §5) | O-12b KEEP |
| B6 | `RouteCensus.ts:689` | `merge-base origin/main <head>` | `RRCraw` | trimmed, non-empty | A | `mergeBase(cwd, "origin/main", head)` | — |
| B7 | `RouteCensus.ts:710` | `fetch --quiet --no-write-fetch-head origin <sha>` | `RRC` | exit; failure only warns | B | `patientGit.fetch({ ref: sha, noWriteFetchHead: true })` (E1); `FETCH_HEAD` must stay untouched for concurrent readers such as Y20 | — |
| B8 | `RouteCensus.ts:718` | `fetch --quiet origin +refs/pull/*/head:refs/remotes/pull/*` | `RRC` | exit | A | `patientGit.fetch({ ref: "+refs/pull/*/head:refs/remotes/pull/*" })`; the `+` refspec passes `rejectOptionLikeRefs` | — |
| B9 | `Ci/RouteCorpus.ts:525` (helper `runGh` `:341`) | `gh api rate_limit` | `ghOutput` | decoded reset time | D | `GithubRest.rateLimit` (`core.resetAt`) | #83c unresolved |
| B10 | `RouteCorpus.ts:583` (`callGh`) | `gh run list --workflow <w> --created <day> --limit <cap> --json <fields>` | `ghOutput` | decoded rows | D | `GitHubClient.paginate("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", { created: day, per_page: 100 })`. REST field names replace gh's `--json` names, a display-name `--workflow` must first resolve to an id through `GET .../actions/workflows`, and `RouteGhRateLimited` maps from `GitHubError` kind `rateLimited` | #83c |
| B11 | `RouteCorpus.ts:612` (`callGh`) | `gh run view <id> --json <fields>,jobs` | `ghOutput` | decoded run plus jobs | D | `GitHubClient.requestDecoded("GET /repos/{owner}/{repo}/actions/runs/{run_id}")` + `paginate(".../runs/{run_id}/jobs")` | #83c |
| B12 | `Ci/HeavyAdmission.ts:536` | `fetch --quiet --no-tags origin +refs/heads/<b>:refs/remotes/origin/<b>` | `RRC` (`capture` seam) | ignored | B | `patientGit.fetch({ ref: "+refs/heads/<b>:refs/remotes/origin/<b>", noTags: true })` (E1); the `capture` test seam becomes `Git.layerTest` | — |
| B13 | `HeavyAdmission.ts:540` | `diff --name-only origin/<b>...HEAD` | `RRC` | lines | A | `changedFiles({ base: "origin/<b>", head: "HEAD" })` | — |
| B14 | `Ci/CiGovernance.ts:258` | `gh api <args>` (dependency review) | `RRC` | exit, error line, `--include` headers | D KEEP | stands: reads gh's own exit code and headers | #249b KEEP |
| B15 | `Docgen/internal/Doctest.ts:861` | `diff --name-only origin/main...HEAD -- packages apps` | `GX.lines` | lines | A | `changedFiles({ base: "origin/main", head: "HEAD", pathspec: ["packages", "apps"] })` | — |
| B16 | `Doctest.ts:862` | `diff --name-only HEAD -- packages apps` | `GX.lines` | lines | A | `unstagedChanges({ head: "HEAD", pathspec: [...] })` (same `diff HEAD` argv plus `-z`) | — |
| B17 | `Doctest.ts:863` | `ls-files --others --exclude-standard -- packages apps` | `GX.lines` | lines | A | `untrackedFiles({ pathspec: [...] })` | — |
| B18 | `Knowledge/KnowledgeDoctor.service.ts:1560` (`pathRemovalsLive`) | `rev-parse --is-shallow-repository` | `SE.streams` | trimmed; nonzero is none | A | `isShallow`, any failure to `None` as today | #111b KEEP (covers the log, not this probe) |
| B19 | `KnowledgeDoctor.service.ts:1570` | `-c core.quotePath=false log --diff-filter=DR -M --name-status --format=%x1e%H%x1f%s <treeCommit>` | `SE.streams` | parsed removals; nonzero is none | B | `log({ revisions: [treeCommit], nameStatus: true, diffFilter: "DR", findRenames: 50, quotePath: false })` (E3) on a `maxOutputBytes: 64 MiB` instance (key finding 2) | #110/#111b KEEP ("`Git.log` takes no starting ref") |
| B20 | `KnowledgeDoctor.service.ts:1729` (`resolveDoctorRefs`) | `rev-parse --is-shallow-repository` | `SE.streams` | stdout `"true"` refuses; nonzero passes | A | `isShallow`; only exit-code failures fold to `false`, and a spawn failure stays a `KnowledgeOperationalError` | #111c unresolved |
| B21 | `KnowledgeDoctor.service.ts:1883` | `diff --name-only -z <mb> <head>` | `GX.paths` | NUL paths | A | `changedFiles({ base: mb, head, twoDot: true })` + `sortedUniquePaths` | — |
| B22 | `KnowledgeDoctor.service.ts:1973` | `status --porcelain --untracked-files=no` | `SE.streams` | clean flag | A | `status({ untrackedFiles: "no" })` empty; any failure is not clean | — |
| B23 | `KnowledgeDoctor.service.ts:2019` | `diff --name-only -z <mb> <head>` | `GX.paths` | NUL paths | A | as B21 | — |
| B24 | `KnowledgeDoctor.service.ts:2024` | `ls-tree --name-only -z <mb> -- <baseline>` | `GX.paths` | non-empty | A | `lsTree(cwd, mb, { pathspec: [baseline] })` non-empty (`-r` is moot for a file path) | — |
| B25 | `Knowledge/Knowledge.service.ts:1086` | `for-each-ref --format=%(refname) refs/heads refs/remotes refs/tags` | `GX.lines` | lines | A | `forEachRef({ patterns: ["refs/heads", "refs/remotes", "refs/tags"] })` mapped to `ref` | — |
| B26 | `Quality/internal/CoverageRegression.ts:1925` | `show <mb>:standards/coverage.regression-baseline.jsonc` | `GX.raw` | text, option | A | `show` (the file is 1,544,889 bytes, inside 16 MiB) | — |
| B27 | `CoverageRegression.ts:2178` | `show <base>:<baseline>` | `GX.raw` | text; failure is a configuration error | A | `show`; `None` becomes the same configuration error | — |
| B28 | `CoverageRegression.ts:2222` | `show <mb>:<baseline>` | `GX.raw` | text, option | A | `show` | — |
| B29 | `Quality/CheckCensus.ts:960` | `status --porcelain` | `GX.lines` | non-empty | A | `status()` non-empty | — |
| B30 | `Quality/internal/JSDocDocumentationInventory.ts:1643` | `ls-files --cached --others --exclude-standard` | `GX.lines` | lines into a set | A | `lsFiles()` paths unioned with `untrackedFiles()`; `--exclude-standard` affects only the `--others` half, so the union is the same set. The two calls are not atomic, which a scanner tolerates | — |
| B31 | `Quality/internal/JSDocRatchet.ts:609` | `ls-files --cached --others --exclude-standard packages apps` | `GX.lines` | lines | A | as B30 with `pathspec: ["packages", "apps"]`; sort the union for a stable order | — |
| B32 | `Quality/Quality.command.ts:2684` | `ls-files -z --cached --others --exclude-standard` | `GX.raw` | NUL paths into a set | A | as B30 | O-16b KEEP (stale reason) |
| B33 | `Quality.command.ts:997` | `branch --show-current` (`git:branch` step) | `QualityTaskStep` | trimmed | C | stands: labelled `QualityTaskStep`, whose log prefix is its contract | O-16b KEEP |
| B34 | `Quality.command.ts:1019` | `rev-parse origin/main` (`git:origin-main`) | `QualityTaskStep` | trimmed | C | stands, as B33 | O-16b KEEP |
| B35 | `Quality.command.ts:1038` | `rev-parse --is-shallow-repository` (`git:shallow`) | `QualityTaskStep` | trimmed | C | stands, as B33 | O-16b KEEP |
| B36 | `Quality.command.ts:1045` | `fetch origin --quiet --unshallow` (`git:fetch:unshallow`) | `runFixedStep` | exit | C | stands, as B33 | O-16b KEEP |
| B37 | `Quality.command.ts:1048` | `fetch origin main:refs/remotes/origin/main --quiet` (`git:fetch:origin-main`) | `runFixedStep` | exit | C | stands, as B33 | O-16b KEEP |
| B38 | `Quality.command.ts:1376` | `merge-base origin/main HEAD` (`secrets:merge-base`) | `QualityTaskStep` | trimmed | C | stands, as B33 | O-16b KEEP |
| B39 | `Quality.command.ts:3327` | `ls-files` (`lint:jsdoc-module-tags:git-ls-files`) | `QualityTaskStep` | lines plus exit | C | stands, as B33 | O-16b KEEP |
| B40 | `Quality/FallowQuality.command.ts:1518` (helper `collectProcessOutput` `:1027`) | `status --porcelain` | `SE.streams` | non-empty; failure is clean | A | `status()` non-empty, failures to `false` | — |
| B41 | `FallowQuality.command.ts:1526` | `rev-parse --verify <base>` | `SE.streams` | `ProcessResult`, exit 128 on failure | A | `revParse(cwd, base)` folded into the same `ProcessResult` | — |
| B42 | `FallowQuality.command.ts:1570` | `diff --binary [--no-renames] --unified=<n> <base> -- .` | `SE.streams` | patch text fed to fallow | B | `diffPatch({ base, binary: true, unified: n, noRenames, pathspec: ["."] })` (N6) on a raised-`maxOutputBytes` instance; today's capture is unbounded | — |
| B43 | `FallowQuality.command.ts:1583` | `ls-files --others --exclude-standard -z` | `SE.streams` | NUL paths | A | `untrackedFiles()` | — |
| B44 | `FallowQuality.command.ts:1595` | `diff --binary --unified=<n> --no-index -- /dev/null <file>` | `SE.streams` | patch text; exit 0 or 1 both succeed | B | `diffPatch({ noIndex: ["/dev/null", file], binary: true, unified: n })` (N6) | — |
| B45 | `FallowQuality.command.ts:1693` | `ls-files -- goals/*/research/codemod-write.jsonc` | `SE.streams` | lines | A | `lsFiles({ pathspec: [glob] })` mapped to `path` | — |
| B46 | `Quality/internal/LaneProofReuse.ts:245` (helper `runGit` `:222`) | `rev-parse --git-path yeet-lane-proof-index-<uuid>` | `SE.streams` | trimmed path, resolved against the root | B | `gitDir(cwd, { path })` (N5); the absolute answer needs no resolve | — |
| B47 | `LaneProofReuse.ts:251` | `read-tree HEAD` with `GIT_INDEX_FILE` | `SE.streams` | exit | C | per-call `GIT_INDEX_FILE` for a temporary index; the kit reads its environment once at `make` (the #106b reason) | — |
| B48 | `LaneProofReuse.ts:252` | `add -A -- .` with `GIT_INDEX_FILE` | `SE.streams` | exit | C | as B47 | — |
| B49 | `LaneProofReuse.ts:253` | `write-tree` with `GIT_INDEX_FILE` | `SE.streams` | trimmed tree | C | as B47 | — |
| B50 | `Quality/ChangesetGraph.ts:351` (helper `:218`) | `ls-files -z -- <package.json pathspecs>` | `SE.cap` | NUL paths | A | `lsFiles({ pathspec })` mapped to `path` | O-19 KEEP (stale reason) |
| B51 | `ChangesetGraph.ts:396` | `ls-files -z -- :(glob).changeset/*.md` | `SE.cap` | NUL paths | A | as B50 | O-19 KEEP (stale reason) |
| B52 | `Quality/CatalogUsage.ts:358` | `ls-files -z -- <template sources>` | `SE.cap` | NUL paths | A | as B50 | O-22 KEEP (stale reason) |
| B53 | `Goals/Completion.ts:578` (port `readGoalCompletionGit`, `CompletionEvidence.ts:80`) | `show <head>:goals/<slug>/ops/manifest.json` | `GX.out` | text; failure falls back to gh | A | `show`; `None` and failures both take the gh fallback | — |
| B54 | `Completion.ts:934` (port) | `remote get-url origin` | `GX.out` | option | A | `remoteUrl()` | — |
| B55 | `Completion.ts:580` (port `readGoalCompletionGithub`, `CompletionEvidence.ts:103`) | `gh api repos/{owner}/{repo}/contents/<path>?ref=<head> -H Accept: application/vnd.github.raw+json` | `ghOutput` | raw text, option | D | `GitHubContent.getFileOption(path, { ref: head })` | #83c |
| B56 | `Completion.ts:682` | `gh api repos/{owner}/{repo}/pulls/<n>` | `ghOutput` | decoded `Pull` | D | `GitHubClient.requestDecoded("GET /repos/{owner}/{repo}/pulls/{pull_number}")` with the existing `Pull` schema; `GithubRest.pullRequest` lacks `merged_at`, `merge_commit_sha` and `base.repo.full_name` | #83c |
| B57 | `Completion.ts:706` | `gh api repos/{owner}/{repo}/commits/<sha> --jq ...` | `ghOutput` | decoded `Commit` | D | `GitHubClient.requestDecoded("GET /repos/{owner}/{repo}/commits/{ref}")` (the W6 route) | #83c |
| B58 | `Completion.ts:729` | `gh api .../commits/<head>/check-runs?per_page=100&filter=all --paginate --slurp` | `ghOutput` | decoded pages | D | `GitHubClient.paginate("GET /repos/{owner}/{repo}/commits/{ref}/check-runs", { filter: "all" })`; `GithubRest.checkRuns` omits `filter=all`, so it returns only the latest runs | #83c |
| B59 | `Completion.ts:811` | `gh api .../issues/<n>/timeline?per_page=100 --paginate --slurp` | `ghOutput` | ready and force-push events, option | D | `GithubRest.reviewTimeline(n)` (`readyAt`, `forcedAt`). It fails closed on an event without an instant, where the site skips that event; under `Effect.option` that degrades to no events, so `paginate` stays the exact route if that matters | #83c |
| B60 | `Completion.ts:826` | `gh api .../commits/<head>/check-suites?per_page=100 --paginate --slurp` | `ghOutput` | earliest `created_at`, option | D | `GithubRest.headFirstReceivedAt(head)`; it reads one 100-row page where the site paginates | #83c |
| B61 | `Goals/CompletionEvidence.ts:216` | `gh api .../rulesets/<id>/history?per_page=100 --paginate --slurp` | `ghOutput` | decoded history | D | `GitHubClient.paginate("GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history")` | #83c |
| B62 | `CompletionEvidence.ts:233` | `gh api .../rulesets/<id>/history/<version>` | `ghOutput` | decoded version | D | `GitHubClient.requestDecoded("GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}")` | #83c |
| B63 | `CompletionEvidence.ts:273` | `gh api .../rulesets/rule-suites?ref=<ref>&time_period=month&per_page=100 --paginate --slurp` | `ghOutput` | decoded list | D | `GitHubClient.paginate("GET /repos/{owner}/{repo}/rulesets/rule-suites", { ref, time_period: "month" })` | #83c |
| B64 | `CompletionEvidence.ts:298` | `gh api .../rulesets/rule-suites/<id>` | `ghOutput` | decoded suite | D | `GitHubClient.requestDecoded("GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}")` | #83c |
| B65 | `CompletionEvidence.ts:564` | `gh api .../rulesets?per_page=100&includes_parents=true --paginate --slurp` | `ghOutput` | decoded list, option | D | `GitHubClient.paginate("GET /repos/{owner}/{repo}/rulesets", { includes_parents: true })`; `Ruleset.list`'s `RulesetInfo` lacks `created_at` | #83c |
| B66 | `Goals/Doctor.ts:1005` (helper `gitOutputOrNone` `:829`) | `rev-parse --is-shallow-repository` | `GX.out` | option | A | `isShallow`, failures to `None` | — |
| B67 | `Doctor.ts:1020` | `log --since=21.days --name-only --format= -- goals/` | `GX.out` | path lines (438 KB, near the 512 KiB bound) | B | `log({ since: "21.days", paths: ["goals/"] })` (E3), flatten `paths` | — |
| B68 | `Doctor.ts:1030` | `log --format=%s -n 4000` | `GX.out` | subject lines | B | `log({ limit: 4000, omitPaths: true })` (E3); without `omitPaths` the kit's forced `--name-only` makes it 13.6 MB | — |
| B69 | `Holds/Holds.command.ts:56` | `rev-parse HEAD` | `GX.out` | trimmed | A | `revParse` | — |
| B70 | `Laws/internal/TrackedTextFiles.ts:158` | `ls-files -z --stage` | `GX.raw` | stage records filtered by mode | A | `lsFiles()`: filter `mode`, map `path`, dedupe (the listing is 6,580,772 bytes, inside 16 MiB) | — |
| B71 | `Laws/SchemaTagIdioms.ts:1045` | `ls-files -z -- <pathspecs>` | `GX.raw` | NUL paths | A | `lsFiles({ pathspec })` mapped to `path` | — |
| B72 | `Lint/internal/EffectSchemaInventorySource.ts:106` (helper `git` `:86`) | `rev-parse --git-dir` (probe in the reference clone) | `GX.raw` | exit | A | `commonDir(reference)` as the probe: it succeeds exactly where `--git-dir` does | — |
| B73 | `EffectSchemaInventorySource.ts:112` | `cat-file -e <pin>^{commit}` | `GX.raw` | exit | A | `refExists(reference, "<pin>^{commit}")`; `false` raises the same pin-absent error | — |
| B74 | `EffectSchemaInventorySource.ts:121` | `show <pin>:<file>` | `GX.raw` | text | A | `show`; `None` raises the same error | — |
| B75 | `Lint/OpaqueRoundtrips.ts:342` | `ls-files -z -- *.test.ts *.test.tsx` | `GX.paths` | NUL paths | A | `lsFiles({ pathspec })` mapped to `path` + `sortedUniquePaths` | — |
| B76 | `Runners/Runners.service.ts:268` | `remote -v` | `SE.cap` | remote names whose URL holds a canonical form | A | `configList()` filtered to `remote.<name>.url`/`.pushurl`. It reads raw URLs with no `insteadOf` rewrite, which matches both forms in `BAKE_CANONICAL_REMOTE_FORMS` (`:62`); a `remoteList` member is the alternative if rewritten URLs must match | O-26c unresolved |
| B77 | `Runners.service.ts:287` | `branch -r --contains <rev>` | `SE.cap` | remote branch lines | B | `branchList({ remotes: true, contains: rev })` (E10) | O-26b KEEP ("no kit member") |
| B78 | `Runners.service.ts:337` | `status --porcelain=v1 --untracked-files=all -- bun.lock .bun-version .bun-linux-x64.sha256` | `SE.cap` | non-empty | A | `status({ untrackedFiles: "all", pathspec: [...] })` non-empty | — |
| B79 | `Research/internal/Daily.ts:116` (helper `git` `:101`) | `check-ignore -q <state dir>` | `SE.exit` | exit 0/1 | A | `checkIgnore(vault, [dir])` non-empty means ignored; a kit failure takes today's exit-128 branch of `stagePathspecs` | — |
| B80 | `Daily.ts:117` | `add -A -- <pathspecs>` | `SE.exit` | exit | A | `add(vault, pathspecs)` (git 2.x stages removals for a pathspec, so `-A` adds nothing) | — |
| B81 | `Daily.ts:119` | `diff --cached --quiet` | `SE.exit` | exit 0/1 | A | `stagedChanges()` non-empty is exit 1 | O-25 KEEP (stale) |
| B82 | `Daily.ts:134` | `-c commit.gpgsign=false commit -q -m <msg>` | `SE.exit` | exit | B | `commit(vault, msg, { noGpgSign: true })` (E7; `--no-gpg-sign` overrides `commit.gpgSign`) | — |
| B83 | `Research/internal/RepoCards.ts:222` (helper `runForOutput` `:76`) | `remote get-url origin` | `SE.cap` | option | A | `remoteUrl(repoDir)` | — |
| B84 | `RepoCards.ts:225` | `log -1 --format=%cI` | `SE.cap` | option string | A | `log({ limit: 1 })[0].committedAt`; same instant, rendered as UTC `Z` instead of the committer's offset | — |
| B85 | `RepoCards.ts:260` | `gh api user/starred --paginate --jq ...` | `SE.cap` | decoded lines | D | `GitHubClient.paginate("GET /user/starred")` on the gh-cli identity (`layerGithubClientFor`) | — |
| B86 | `Research/Library/Library.verify.ts:430` | `-C <clone> cat-file -t <rev>` | `runLibraryCommand` | trimmed type | C | hardened acquisition boundary for untrusted clones: `runLibraryCommand` (`Library.adapter.ts:61`) sets `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_LFS_SKIP_SMUDGE=1`, `GIT_TERMINAL_PROMPT=0`, per-call caps, a 5-minute timeout and sanitized diagnostics; callers add `-c core.hooksPath=/dev/null`. Comment `Library.github.ts:146`: "Isolated git configuration prevents user filters; hooks are disabled and submodules/LFS remain pointers." The kit has no per-call env or `-c` | — |
| B87–B107 | `Library.github.ts:111` (`clone --no-checkout --no-recurse-submodules`), `:117` (`remote get-url`), `:136` and `:139` (`rev-parse --verify <rev>^{commit}`), `:137` and `:398` (`fetch --no-recurse-submodules origin <rev>`), `:147` (`checkout --detach` with LFS filters off), `:161`, `:550` (`ls-tree -r --name-only`), `:186`, `:197`, `:576` (`show <rev>:<file>`), `:212` (`diff ... --output=<file>`), `:397` (`cat-file -e`); `Library.evidence.ts:620` (`remote get-url`), `:621` (`cat-file -t`), `:624`, `:748` (`ls-tree -r --name-only`), `:655` (`diff ... --output=<file>`), `:742` (`show`), `:854` (`diff --no-ext-diff --no-textconv --quiet <base>...<head>`) | as listed | `runLibraryCommand` (helpers `Library.github.ts:125`, `Library.evidence.ts:618`) | mixed | C (21 rows) | as B86 | — |
| B108–B112 | `Library.github.ts:256` (`gh api <identity endpoint>`), `:302` (`gh api <endpoint>&page=n`), `:359` (`gh api -H Accept: application/vnd.github.diff .../pulls/<n>`), `:440`, `:472` (`gh api graphql ...`) | as listed | `runLibraryCommand` | raw response bodies saved as evidence artifacts | D KEEP (5 rows) | the raw gh response text is the stored evidence (`saveLibraryText(..., raw, ...)`), behind the same boundary as B86 | — |
| B113–B117 | `Cache/Cache.workflow.ts:158` (`ls-files --cached --others --exclude-standard -z -- <sources>`), `:207` (`status --porcelain=v1 --untracked-files=all --ignored=matching --ignore-submodules=none -- <sources>`), `:322`, `:342`, `:759` (`rev-parse HEAD`) | as listed | `captureGit` (`:131`): `/usr/bin/git`, `extendEnv: false`, `PATH=/usr/bin`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, 4 MiB bound | mixed | C (5 rows) | producer trust boundary: the pinned absolute `/usr/bin/git` is itself hashed into the workflow identity (`inspectionTools` list at `:331` passes it to `inspectCacheLinkedFile`), and the ambient environment and global config are scrubbed. The kit runs `git` from `PATH` with the environment extended | — |
| B118–B123 | `Cache/Cache.pilot.ts:412`, `:1121` (`rev-parse HEAD`), `:413` (`rev-parse --path-format=absolute --git-common-dir`), `:438`, `:1120` (`status --porcelain --untracked-files=all`), `:549` (`rev-parse --absolute-git-dir`) | as listed | `captureHost` (`:222`): `/usr/bin/git`, `extendEnv: false`, `HOME=/nonexistent`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_OPTIONAL_LOCKS=0`, 30 s | mixed | C (6 rows) | as B113 | — |
| B124 | `Cache/Cache.pilot.runner.ts:214` | `rev-parse --path-format=absolute --git-common-dir` | `SE.streams`, `/usr/bin/git`, `extendEnv: false` | trimmed path | C | as B113 | — |
| B125 | `Cache/Cache.adapter.ts:89` | `rev-parse --path-format=absolute --git-common-dir` | `SE.streams`, `/usr/bin/git`, `extendEnv: false` | trimmed path | C | as B113 | — |
| B126 | `Cache/Cache.fingerprint.ts:189` (helper `captureVersion` `:124`) | `rev-parse --path-format=absolute --git-common-dir` | `SE.cap`, `extendEnv: false`, `LANG=C`, 10 s | trimmed path | C | toolchain fingerprint probes all run with a scrubbed environment; an inherited `GIT_DIR`/`GIT_COMMON_DIR` (set inside git hooks) would redirect the answer under the kit's `extendEnv` | — |
| B127 | `Cache/Cache.census.ts:637` (helper `capture` `:125`) | `rev-parse HEAD` | `SE.cap` (`extendEnv: true`, Turbo vars blanked) | trimmed | A | `revParse` (the blanked Turbo variables do not affect git) | — |
| B128 | `Cache/Cache.command.ts:244` (helper `runText` `:167`, `Bun.spawnSync` inside an Effect) | `status --porcelain=v1 --untracked-files=normal` | `Bun.spawnSync` | empty means clean | A | `status({ untrackedFiles: "normal" })` empty; also stops blocking the runtime thread | Not row |
| B129 | `Cache.command.ts:245` | `rev-parse HEAD` | `Bun.spawnSync` | trimmed | A | `revParse` | Not row |
| B130 | `Cache.command.ts:246` | `rev-parse origin/main` | `Bun.spawnSync` | trimmed | A | `revParse` | Not row |
| B131 | `Cache.command.ts:247` | `rev-parse HEAD^{tree}` | `Bun.spawnSync` | trimmed | A | `revParse` | Not row |
| B132 | `Cache.command.ts:651` | `diff --name-only origin/main...HEAD --` | `Bun.spawnSync` | lines | A | `changedFiles({ base: "origin/main", head: "HEAD" })` | Not row |
| B133 | `Refs/Refs.service.ts:184` | `git` with per-call `HOME`/`PATH`/`CI`, `extendEnv: false` | `SE.cap` | as recorded | C | stands: per-call env and a 15-minute deadline | O-23 KEEP |
| B134 | `Refs.service.ts:292` | `mustRun(..., "git", ...)` | as B133 | as recorded | C | stands | O-23 KEEP |
| B135 | `Qa/Qa.session.ts:570` (helper `capturedText` `:512`) | `-C <cwd> rev-parse HEAD` | `SE.cap` | option | A | `revParse(cwd, "HEAD")`, failures to `None` | — |
| B136 | `Qa.session.ts:570` | `-C <cwd> status --porcelain` | `SE.cap` | dirty flag | A | `status(cwd)` non-empty | — |

"Not row" in the Prior column means the draft listed the site under "Not rows" without an outcome.

### W7c: Worktree (`R/commands/Worktree/**`)

| # | Site | argv | Route | Output use | Class | Kit member, or reason | Prior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | `Worktree.service.ts:195` | `gh pr list --head <b> --state merged --json number,headRefOid --limit 100` | `ghOutput` | decoded rows, option | D | `PullRequest.list({ head: "<owner>:<b>", state: "closed" })` filtered on `merged`, `headSha` for `headRefOid`; needs a GitHub client layer in the Worktree group | #83c unresolved |
| W2 | `Worktree.service.ts:770` (helper `runPreservationProbe` `:734`) | `rev-list --count <revision> --` | `GX.raw` | count | B | `revListCount` (N1) | #112c unresolved |
| W3 | `Worktree.service.ts:796` | `for-each-ref --format=%(refname) <ref>` | `GX.raw` | exact refname line present | A | `forEachRef({ patterns: [ref] })` and `entries.some(e => e.ref === ref)` | #112c |
| W4 | `Worktree.service.ts:814` | `for-each-ref --format=%(symref:lstrip=3) refs/remotes/origin/HEAD` | `GX.raw` | branch name; empty (including a dangling `origin/HEAD`) is `main` | A | `defaultBranch({ remote: "origin" })`, then `refExists("refs/remotes/origin/<name>")`, falling back to `main`. `symbolic-ref` still answers for a dangling symref, so the `refExists` guard is what keeps the fallback exact | #112c |
| W5 | `Worktree.service.ts:881` | `for-each-ref --format=%(upstream) refs/heads/<b>` | `GX.raw` | full upstream refname or empty | B | `upstream(cwd, b)` (N3) | #112c |
| W6 | `Worktree.service.ts:1456` (helper `runPreservationCommand` `:720`) | `check-ref-format <archiveRef>` | `GX.out` | exit | B | the pre-spawn refname guard inside `updateRef` (N4) | #112c |
| W7 | `Worktree.service.ts:1462` (args `:371`) | `update-ref <archiveRef> <head> <zero-oid>` (create only) | `GX.out` | exit | B | `updateRef(cwd, archiveRef, { create: head })` (N4) | #112c |
| W8 | `Worktree.service.ts:1624` (helper `runWorktreeGitCapture` `:713`) | `rev-parse --path-format=absolute --git-common-dir` | `GX.out` | trimmed | A | `commonDir(mainCheckout)` (identical argv) | #112c |
| W9 | `Worktree.service.ts:1629` | as W8, in the target | `GX.out` | trimmed | A | `commonDir(target)` | #112c |
| W10 | `Worktree.service.ts:1662` | `status --porcelain --untracked-files=all --ignore-submodules=none` | `GX.out` | non-empty lines | A | `status({ untrackedFiles: "all", ignoreSubmodules: "none" })` mapped through `toLine({ renames: "arrow" })` | #112c |
| W11 | `Worktree.service.ts:1674` | `submodule status --recursive` | `GX.out` | exit (probe) | A | `submoduleStatus({ recursive: true })` | #112c |
| W12 | `Worktree.service.ts:1681` | `submodule foreach --quiet --recursive '<per-submodule status script printing NUL-ended paths>'` | `GX.raw` | NUL-split dirty paths | B | `submoduleForeach(cwd, script, { recursive: true, quiet: true })` (E9). Without `--quiet` git prints `Entering '<path>'` on stdout, which this NUL parse would read as a dirty submodule | #112c |
| W13 | `Worktree.service.ts:1725` | `diff --binary HEAD --` | `GX.raw` | patch text preserved as residue | B | `diffPatch({ base: "HEAD", binary: true })` (N6); the kit's forced `--no-ext-diff` also guarantees a real patch | P0 §5 KEEP (single consumer; no longer single) |
| W14 | `Worktree.service.ts:1796` (args `:318`) | `worktree remove [--force] <path>` | `GX.out` | exit | A | `worktreeRemove(cwd, path, { force })` | #112c |
| W15 | `Worktree.service.ts:1806` | `worktree prune` | `GX.out` | exit | A | `worktreePrune` | #112c |
| W16 | `Worktree.service.ts:1821` (args `:414`) | `update-ref -d refs/heads/<b> <head>` (CAS delete) | `GX.out` | exit | B | `updateRef(cwd, "refs/heads/<b>", { delete: head })` (N4) | P0 §5 KEEP (single consumer; no longer single) |
| W17 | `Worktree.service.ts:2460` | `config --local merge.regenerate.<key> <value>` | `GX.out` | exit | A | `configSet(checkout, key, value)`; a plain `git config <key> <value>` already writes the repository's local config | #112c |
| W18 | `Worktree.command.ts:519` (helper `runStreamingStep` `:417`) | `fetch --quiet --force origin main:refs/remotes/origin/main` | `RRCstream` | exit (with `--quiet` there is no progress to stream) | A | `patientGit.fetch({ ref: "+main:refs/remotes/origin/main" })` (the `+` refspec is `--force` for that refspec) | — |
| W19 | `Worktree.command.ts:527` | `rev-parse --verify refs/remotes/origin/main^{commit}` | `GX.out` | exit | A | `revParse(cwd, "refs/remotes/origin/main", { peel: "commit" })` | Not row |
| W20 | `Worktree.command.ts:540` | `rev-parse --verify <base>^{commit}` | `GX.out` | trimmed | A | `revParse(cwd, base, { peel: "commit" })` | Not row |
| W21 | `Worktree.command.ts:548` (args `:221`) | `worktree add <path> -b <branch> <sha>` | `RRCstream` | exit | B | `patientGit.worktreeAdd(cwd, path, { ref: sha, newBranch: branch })` (E8); checkout progress is no longer streamed | — |
| W22 | `Worktree.command.ts:628` | `status --porcelain` | `GX.out` | lines | A | `status()` mapped through `toLine({ renames: "arrow" })` | Not row |
| W23 | `Worktree.command.ts:692` | `worktree prune --dry-run` | `GX.out` | lines of git's prune prose (written to stderr, kept by the merged capture) | C | the doctor report prints git's own "Removing worktrees/<id>: <reason>" lines verbatim; `WorktreeEntry.prunable` keeps the fact but drops the reason by design (`K/Git.models.ts`). Moves to `RRC` at retirement | Not row |
| W24 | `Worktree.command.ts:893` | `submodule update --init --recursive` | `RRCstream` | exit | A | `patientGit.submoduleUpdate({ init: true, recursive: true })` (this repo has no `.gitmodules`, so nothing streams) | — |
| W25 | `Worktree.command.ts:1138` | `config --local --list` | `GX.out` | find `merge.regenerate.driver=` | A | `configList({ scope: "local" })`, find key `merge.regenerate.driver` | Not row |
| W26 | `Reap.service.ts:147` (seam `ReapCommandRunner` `:47`, helper `successfulOutput`) | `gh pr list --head <b> --state open/merged --json number,headRefOid --limit 1` | `RRC` (seam) | decoded rows, option | D | `PullRequest.list({ head: "<owner>:<b>", state: "open" or "closed" })`, merged filter for the merged case; the seam becomes `PullRequest`/`Git` test layers | — |
| W27 | `Reap.service.ts:193` | `rev-parse HEAD` | `RRC` (seam) | trimmed, option | A | `revParse`, failures to `None` | — |
| W28 | `Reap.service.ts:210` | `log -1 --format=%ct HEAD` | `RRC` (seam) | epoch seconds | A | `log({ limit: 1 })[0].committedAt` to epoch seconds | — |
| W29 | `Reap.service.ts:213` | `rev-parse --path-format=absolute --git-path HEAD` | `RRC` (seam) | trimmed path | B | `gitDir(cwd, { path: "HEAD" })` (N5) | — |
| W30 | `Reap.service.ts:355` | `status --porcelain --untracked-files=all --ignore-submodules=none` | `RRC` (seam) | non-empty | A | `status({ untrackedFiles: "all", ignoreSubmodules: "none" })` non-empty | — |
| W31 | `internal/ResidueTerminalLaneLive.ts:93` (helper `gitOutput` `:79`) | `rev-parse --path-format=absolute --show-toplevel --git-dir --git-common-dir` | `RRC` | three lines | B | `repoRoot` + `gitDir(cwd)` (N5) + `commonDir` | Not row |
| W32 | `ResidueTerminalLaneLive.ts:144` | `symbolic-ref --quiet --short HEAD` | `RRC` | trimmed; failure ends the proof | A | `currentBranch(checkout)` (`abbrev-ref` mode shortens the same way); `None` ends the proof | Not row |
| W33 | `ResidueTerminalLaneLive.ts:145` | `rev-parse --verify HEAD` | `RRC` | trimmed | A | `revParse(checkout, "HEAD")` | Not row |
| W34 | `ResidueTerminalLaneLive.ts:148` | `--no-optional-locks status --porcelain --untracked-files=all --ignore-submodules=none` | `RRC` | empty | A | `status({ noOptionalLocks: true, untrackedFiles: "all", ignoreSubmodules: "none" })` empty | Not row |
| W35 | `internal/ResidueReap.ts:1874` | `grep ...` | `RRC` | as recorded | C | stands: single-consumer plumbing (D-03, P0 §5) | O-08b KEEP |
| W36 | `ResidueReap.ts:2130` | `ls-files --error-unmatch ...` | `RRC` | exit | C | stands | O-08b KEEP |
| W37 | `ResidueReap.ts:2153` | `--no-optional-locks worktree list ...` | `RRC` | as recorded | C | stands (`worktreeList` has no `noOptionalLocks`) | O-08b KEEP |
| W38–W45 | `Fleet.service.ts:805` (`init --bare`), `:822`, `:846`, `:1019` (scanner fetches), `:840` (`cat-file -e`), `:970` (`merge-base`), `:988` (`diff --name-only -z`), `:1129` (`merge-tree --write-tree --name-only`) | as listed | `runGitProbe` (`:416`) with the scanner env | mixed | C (8 rows) | stands: per-call scanner `env` (`:825`); the kit reads its environment once at `make` | #106b KEEP |

### Outside the three batches (retirement step and entry points)

| # | Site | argv | Route | Output use | Class | Kit member, or reason | Prior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| X1 | `R/internal/repo-run/GitExec.ts:1106` (`currentBranch`, `show-current` mode) | `branch --show-current` | `GX.out` | trimmed | A | `currentBranch({ mode: "show-current" })` + `O.getOrElse(() => "")` | #100/#251b KEEP (stale since the W2 kit) |
| X2 | `GitExec.ts:855` (`guardCloneLocalGitAttributes`) | `rev-parse --git-path info/attributes` | private `runGitStructured` | trimmed path | B | `gitDir(cwd, { path: "info/attributes" })` (N5) | #100/#251c KEEP (single consumer; no longer single) |
| X3 | `GitExec.ts:819` (`writeGitArchive`) | `-c <canonical archive config> archive --format=tar --output=<file> <commit>` with `GIT_ATTR_NOSYSTEM=1` | private `runGitStructured` | exit | C | stands: single-consumer plumbing (D-03, P0 §5); needs `-c` config and a per-call env | #100/#251c KEEP |
| X4 | `R/bin.ts:27` (helper `runGit` `:20`) | `diff --name-only --diff-filter=ACMRTUXB HEAD --` | `Bun.spawnSync` | lines | C | runs before the Effect CLI loads; comment `:6`: the no-op path "intentionally stays in this tiny module" so clean worktrees skip the Effect startup | Not row |
| X5 | `R/bin.ts:28` | `diff --cached --name-only --diff-filter=ACMRTUXB --` | `Bun.spawnSync` | lines | C | as X4 | Not row |
| X6 | `R/bin.ts:29` | `ls-files --others --exclude-standard` | `Bun.spawnSync` | lines | C | as X4 | Not row |
| X7 | `R/bin-main.ts:128` (`currentGitOrigin`) | `remote get-url origin` | `Bun.spawnSync` | trimmed or `""` | C | runs in `withHostTurboCacheDefaults` before the program builds its platform layer (`CliRuntime.main(..., { platform: Layer.empty })`, `:160`), so no `ChildProcessSpawner` exists yet; the result seeds `Bun.env` before `ConfigProvider.fromEnv()` is rebuilt (`:150`) | Not row |
| X8 | `A/config-snapshot.ts:706` | `rev-parse --show-toplevel` | `spawner.string` | untrimmed | C | stands: a `checkout\r` name must keep its whitespace | #107/#304b KEEP |
| X9 | `A/config-snapshot.ts:761` | `rev-parse --git-dir` | `ChildProcess.make` | exit plus capped stderr as evidence | C | stands | #107/#304b KEEP |
| X10 | `A/git-root-evidence.ts:159` | multi-value `rev-parse` evidence probe with `-c core.fsmonitor=false` | `ChildProcess.make`, 5 s | evidence kinds | C | stands: needs `-c`; `Git.makeWith` now gives a per-instance timeout, so only the `-c` half of the P0 reason remains | #304c KEEP |

## 1. Proposed kit additions (the W7 kit PR)

All members follow the kit's data-first `dual` shape, return the existing tagged errors
(`GitCommandError | NotARepositoryError | UnknownRefError`), refuse option-like arguments before spawning
(`rejectOptionLikeRefs`), and need a `makeTest` stub and an argv-shape test in `K/test`.

### New members

| Id | Member | Signature | argv | Output schema | Error mapping | Sites (count) |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | `revListCount` | `(cwd, range, options?: { firstParent?: boolean }) => Effect<number, GitCommandError \| NotARepositoryError \| UnknownRefError>` | `rev-list --count [--first-parent] <range> --` | `S.Int` with `S.isGreaterThanOrEqualTo(0)` decoded from trimmed stdout, fail-closed | unknown revision gives `UnknownRefError` (`refFailureArms`); non-integer stdout gives `GitCommandError` (`kind: "failed"`, "unparseable rev-list count") | Y6, Y11, Y31, B4, W2 (5) |
| N2 | `mergeTree` | `(cwd, base, head) => Effect<MergeTreeResult, GitCommandError \| NotARepositoryError \| UnknownRefError>` | `merge-tree --write-tree -z --name-only <base> <head>` (git 2.38 or later) | new `MergeTreeResult` tagged union in `Git.models.ts`: `clean { tree }` and `conflicted { tree, paths: Array<string>, messages: Array<string> }` | new classify kind: exit 0 is `clean`, exit 1 is `conflicted` (data, not failure), exit 2 or more is `GitCommandError`; bad revision gives `UnknownRefError` | Y22, Y49 (2) |
| N3 | `upstream` | `(cwd, branch) => Effect<Option<string>, GitCommandError \| NotARepositoryError>` | `for-each-ref --format=%(upstream) refs/heads/<branch>` | full refname (`refs/remotes/origin/x`), empty output is `None` | option-like branch refused | Y9, W5 (2) |
| N4 | `updateRef` | `(cwd, ref, change: { readonly create: string } \| { readonly delete: string }) => Effect<void, GitCommandError \| NotARepositoryError>` | guard `check-ref-format <ref>`, then `update-ref <ref> <new> <zero-oid sized to new>` or `update-ref -d <ref> <expected>` | `void` | an invalid name gives `GitCommandError` (`kind: "refused"`); a failed CAS (the ref exists, or does not point at `expected`) gives `GitCommandError` (`kind: "failed"`, stderr kept). A dedicated conflict tag is optional; the callers only need the failure | W6, W7, W16 (3) |
| N5 | `gitDir` | `(cwd, options?: { path?: string }) => Effect<string, GitCommandError \| NotARepositoryError>` | `rev-parse --path-format=absolute --git-dir`, or with `path` `rev-parse --path-format=absolute --git-path <path>` | absolute path; trailing newline removed, otherwise untrimmed (as `commonDir`) | as `commonDir` (`unknownRef` dies, not a repository fails typed) | W31, W29, B46, X2 (4) |
| N6 | `diffPatch` | `(cwd, options: { base?: string; head?: string; cached?: boolean; noIndex?: readonly [string, string]; binary?: boolean; unified?: number; noRenames?: boolean; findRenames?: number; pathspec?: ReadonlyArray<string> }) => Effect<string, GitCommandError \| NotARepositoryError \| UnknownRefError>` | `diff --no-color --no-ext-diff [--binary] [--unified=<n>] [--no-renames \| --find-renames=<n>%] [--cached] [<base> [<head>]] [-- <pathspec>]`, or `diff --no-color --no-ext-diff [...] --no-index -- <a> <b>` | patch text, decoded and untrimmed | `noIndex`: exit 0 and exit 1 both succeed (exit 1 means differences); otherwise exit 0 only. Truncation gives `GitCommandError` `kind: "truncated"`, which a caller relying on overflow-as-signal (Y41) maps itself. Reuse `rejectRenameScore` and `rejectNonNaturalNumber` | Y41, B42, B44, W13 (4) |

### Extensions of existing members

| Id | Member | New option | argv change | Sites (count) |
| --- | --- | --- | --- | --- |
| E1 | `fetch` | `ref` becomes optional; `noTags?: boolean`; `noWriteFetchHead?: boolean` | `fetch [--depth N] [--unshallow] [--prune] [--no-tags] [--no-write-fetch-head] <remote> [tag] [<ref>]`; no `ref` fetches the configured refspecs | Y19, Y64, B7, B12 (4) |
| E2 | `nameStatus` | `noRenames?: boolean` | adds `--no-renames`; reject it together with `findRenames` | B3 (1) |
| E3 | `log` | `revisions?: ReadonlyArray<string>`, `noMerges?: boolean`, `reverse?: boolean`, `since?: string`, `omitPaths?: boolean`, `includeBody?: boolean` | `--no-merges`, `--reverse`, `--since=<v>` and the revisions before `--`; `omitPaths` drops `--name-only`/`--name-status`; `includeBody` appends `%x00%b` to `LOG_FORMAT`, with `CommitLogEntry.body` as an optional key | Y54, Y55, B19, B67, B68 (5) |
| E4 | `stashPush` | `keepIndex?: boolean` | adds `--keep-index` | Y1 (1) |
| E5 | `add` | options `{ force?: boolean }` (a third data-first argument) | `add [--force] -- <paths>` | Y16 (1) |
| E6 | `checkIgnore` | options `{ noIndex?: boolean }` | `check-ignore [--no-index] -z --stdin` | Y14 (1) |
| E7 | `commit` | `noGpgSign?: boolean` | adds `--no-gpg-sign` | B82 (1) |
| E8 | `worktreeAdd` | `newBranch?: string` | `worktree add [--force] [--detach] [-b <name>] <path> [<ref>]`; reject `newBranch` together with `detach` | W21 (1) |
| E9 | `submoduleForeach` | `quiet?: boolean` | `submodule foreach [--quiet] [--recursive] <command>` | W12 (1) |
| E10 | `branchList` | `contains?: string` | adds `--contains <rev>` | B77 (1) |

Kit PR scope: six new members, ten extensions, one new model (`MergeTreeResult`), one new classify kind (merge-tree
and `--no-index` exit 1), and 37 call sites waiting on them (20 on new members, 17 on extensions). `@beep/github` needs no additions: every (D) migration
uses an existing member, `GithubRest`, or a `GitHubClient` route.

The kit PR also adds `R/internal/repo-run/PatientGit.ts`, exporting `PATIENT_GIT_OPTIONS` and `patientGit`
moved out of Yeet, with a re-export from `R/internal/repo-run/index.ts`. W7b (B7, B8, B12) and W7c (W18, W21,
W24) need the patient instance without importing Yeet. W7a then switches `R/commands/Yeet/internal/GitExec.ts`
to re-export it. No `@beep/git` change is needed for the large-output sites (B19, B42): they build their own
`Git.makeWith` instance.

Recorded KEEPs this PR makes convertible, and which the census therefore reclassifies as (B): Y9 (O-06), Y49
(O-04b), Y55 (#250i), Y64 (O-03b), B19 (#110/#111b), B77 (O-26b), W13 and W16 (P0 §5), X2 (#251c).

## 2. Proposed site batches

Every lane starts after the kit PR merges, and each lane owns the tests for its own files.

- **W7-kit (first, alone):** `packages/drivers/git/src/**`, `packages/drivers/git/test/**`, a changeset for
  `@beep/git`, plus the new `R/internal/repo-run/PatientGit.ts` and its export line in
  `R/internal/repo-run/index.ts`.
- **W7a (Yeet):** `R/commands/Yeet/**`: `Yeet.command.ts`, `internal/Planner.ts`, the wrappers in
  `internal/GitExec.ts` and `internal/GitErrorAdapter.ts` included. Also `R/test/Yeet.test-kit.ts` and the
  `T/yeet*.test.ts` files (including `T/yeet-git-exec.test.ts` and `T/yeet-final-check-refresh.test.ts`). Rows
  Y1–Y88: 43 (A), 14 (B), 8 (C) git rows, 23 (D) KEEP rows. W7a also deletes the Yeet `runGitOutput` and
  `runGitPathList` wrappers once its last callers move, and moves Y36 onto `RRC`.
- **W7b (the rest of the commands):** `R/commands/{Ci, Docgen, Knowledge, Quality, Goals, Holds, Laws, Lint,
  Runners, Research, Cache}/**`. `Qa` (B135, B136) and `Refs` (KEEP-only, no edits) are folded in because they
  belong to no named group. Tests: the `T/ci-*`, `T/doctest*`, `T/knowledge*`, `T/coverage*`, `T/check-census*`,
  `T/fallow*`, `T/changeset*`, `T/catalog-usage*`, `T/goals*`, `T/holds*`, `T/laws*`, `T/lint*` (except
  `T/lint-policy-scope.test.ts`), `T/runners*`, `T/research*`, `T/cache*` and `T/qa*` files. Rows B1–B136. W7b
  also reshapes the `GoalCompletionIo` port's string-argv `git` and `github` methods into typed operations, and
  the `HeavyAdmission` `capture` seam into `Git.layerTest`.
- **W7c (Worktree):** `R/commands/Worktree/**` and its tests (`T/worktree*`, `T/reap*`, `T/residue*`, `T/fleet*`,
  `T/tmpfs*`). Rows W1–W45. W7c also moves W23 off `runWorktreeGitCapture` onto `RRC`, deletes
  `runWorktreeGitCapture`, `runPreservationCommand` and `runPreservationProbe` once their callers move, and
  reshapes the `ReapCommandRunner` seam.
- **Retirement (last, alone):** `R/internal/repo-run/GitExec.ts`, `R/internal/repo-run/index.ts`,
  `T/step-git-exec.test.ts`, `T/catalog-shard-scope.test.ts` and `T/lint-policy-scope.test.ts`. The last two use
  `runGitOutput` only to build fixture repos (`git init`, `config`, `commit`); they move to the kit members plus
  `@beep/commands` `Run.exitCode(ChildProcess.make("git", ["init", ...]))` for `init`. Rows X1–X3; X4–X10 are
  unchanged KEEPs.

Disjointness check: W7a is exactly `R/commands/Yeet/**`, `R/test/Yeet.test-kit.ts` and `T/yeet*`. W7b is eleven
other command directories plus `Qa` and `Refs`, with their test prefixes. W7c is `R/commands/Worktree/**` with
its test prefixes. The kit PR and the retirement step own `R/internal/repo-run/**` and the three named tests, and
they run sequentially, before and after the lanes, never alongside them. No file is in two parallel batches. The
one shared file, `R/internal/repo-run/index.ts`, is edited only by the kit PR (adding an export) and later by the
retirement step. `R/internal/github/GhCommand.ts` is not edited by any batch.

### Retirement step: what goes, what stays

Delete from `R/internal/repo-run/GitExec.ts`, once W7a, W7b and W7c have merged: `runGitOutput` (`:503`),
`runGitPathList` (`:551`), `runGitLines` (`:593`), `runGitRawOutput` (`:604`), the private `runGitCaptured`
(`:387`), `structuredCapture` (`:440`), `gitPathOutputBound` (`:450`) and `gitLinesFromOutput` (`:371`). Rewrite
`currentBranch`'s `show-current` branch (X1) and `guardCloneLocalGitAttributes` (X2) onto the kit.

Must stay in that file:

- `adaptGitKitError`, `GitCommandErrorAdapter`, `GitKitError` (every migrated site uses them);
- the typed readers (`resolveGitCommit`, `resolveGitMergeBase`, `readGitTree`, `readGitRenames`, the three
  `collect*Paths`, `currentBranch`, `ensureOriginMain`) and the ref helpers (`isSafeOriginBranch`,
  `originBranchFromBase`, `safeOriginBranchFromBase`);
- `sortedUniquePaths`, which the (A) path rows use, and `gitPathListFromNulOutput`, which the Cache KEEP B113
  still uses;
- `writeGitArchive` with `gitArchiveArgs`, `gitArchiveEnv` and the private `runGitStructured` plus
  `failFromOutcome` it needs (X3 KEEP);
- `runGitFoldedStdout`, whose only caller after W7 is the Y33 KEEP. The Yeet `runGitFoldedStdout` wrapper keeps
  that one caller, or Y33 calls the shared runner directly.

Drop `gitTreeEntriesFromNulOutput` only if no test-kit user remains after B1 moves to `lsTree`.

KEEP sites that rode a deleted runner move onto `runRepoCommandCapture`, the repo-cli child-process owner P0 §5
names for single-consumer plumbing: Y36 (W7a) and W23 (W7c). After W7, `ghOutput` has no callers outside Yeet
(W1, B9–B11, B55–B65 migrate), and `GhCommand.ts` stays for the 23 Yeet gh KEEPs.

## 3. Totals

Rows are argv templates (see "How the census was taken"). Rows marked "prior" already carried a ledger outcome.
Rows marked "new" had none: the draft's unresolved and "Not rows" items plus the sites P0 missed.

| Batch | Rows | (A) | (B) | (C) | (D) migrate | (D) KEEP | prior | new |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W7a Yeet | 88 | 43 | 14 | 8 | 0 | 23 | 33 | 55 |
| W7b | 136 | 54 | 12 | 49 | 15 | 6 | 19 | 117 |
| W7c Worktree | 45 | 21 | 10 | 12 | 2 | 0 | 13 | 32 |
| Outside (X) | 10 | 1 | 1 | 8 | 0 | 0 | 6 | 4 |
| **All** | **279** | **119** | **37** | **77** | **17** | **29** | **71** | **208** |

Of the 233 git rows, 119 move onto an existing kit member as they stand, 37 wait on the W7 kit PR, and 77 stay
hand-rolled, each with a named reason. In the (C) column:

- Library: 22;
- Cache trust boundary: 14;
- labelled Quality steps: 7;
- Fleet scanner: 8;
- Planner steps: 3;
- `GIT_INDEX_FILE` steps: 3;
- ResidueReap: 3;
- `bin.ts` and `bin-main.ts`: 4;
- ai-metrics: 3;
- Refs: 2;
- one each: Y33, Y36, Y50, Y63, Y65, B5, W23, X3.

Of the 46 gh rows, 17 migrate to `@beep/github` and 29 stay KEEP: 23 Yeet rows (D-13/D-15), CiGovernance and
five Library evidence reads.

19 prior rows leave KEEP:

- 10 are (A) today because their recorded reason is stale: Y10, Y61, Y62, B18, B32, B50, B51, B52, B81, X1;
- 9 become (B) through the kit PR: Y9, Y49, Y55, Y64, B19, B77, W13, W16, X2.

By the draft's own unit (generic-runner call lines), its 70 runner sites become:

- (A) 55;
- (B) 11: Y1, Y6, Y11, Y14, Y16, Y19, Y22, Y41, Y54, B3, B4;
- (C) 2: Y33, Y36;
- 2 helper lines with mixed outcomes: `FinalCheckRefresh.ts:214` `gitLine` (Y29 and Y30 are (A), Y31 is (B)) and
  `Goals/Doctor.ts:830` (B66 is (A), B67 and B68 are (B)).

## Sites that could not be classified with full confidence

None is left unclassified. These carry a caveat the lane must settle:

- **B10** (`gh run list --workflow`): if `workflow` is a display name rather than a file name or id, the REST
  route needs a workflow-id lookup first, and the corpus decoder must map REST fields onto gh's `--json` names.
- **Y10** (`show-ref --verify` to `refExists`): equal except for a ref whose object is missing, where `cat-file -e`
  answers `false`.
- **Y14** (`ls-files -c -i --exclude-standard` to `check-ignore --no-index`): equal for tracked inputs,
  parent-directory rules included. Worth one fixture with an ignored directory.
- **B59 and B60** (`GithubRest.reviewTimeline` and `headFirstReceivedAt`): small semantic drift (fail-closed on an
  undated event; one page of check suites). The exact fallback is `GitHubClient.paginate`.
- **Y37** (`status --short` into the proof fingerprint): exact in meaning, but the fingerprint bytes change once.
- **B19:** exact only on a raised `maxOutputBytes` instance (the log is 21.3 MB today).
- **B76:** chose `configList` (raw URLs) over a single-consumer `remoteList`. Switch if rewritten `insteadOf`
  URLs must match.
