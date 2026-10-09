# Gap 19: the other effect-vitest worktrees and the #1555 detector delta

## Provenance

- Repository head: `e62411d63f` (`origin/main`). The rsc-packet checkout and the beep-effect2 clone's `origin/main` both resolve to it.
- Date: 2026-10-09. The sweep was read-only and ran with `GIT_OPTIONAL_LOCKS=0`. No lane, index, ref or stash was modified.
- Scope: every directory matching `~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-*` except the six `effect-vitest-canon-*` lanes that `V-vitest-canon.md` already covers. 41 directories matched: 40 git worktrees and 1 non-worktree.
- Commands:
  - Per worktree: `git symbolic-ref`, `git rev-parse`, `git status --porcelain | wc -l`, `git diff --cached --shortstat`, `git diff --shortstat`, `git ls-files --others --exclude-standard`, `git merge-base --is-ancestor HEAD origin/main|e4c608f9c1|5c6bd1aba2`, `git rev-list --count HEAD --not origin/main 5c6bd1aba2 e4c608f9c1`.
  - Remote: `git ls-remote origin 'refs/heads/codex/effect-vitest-*' 'refs/heads/fix/vitest-alias-dock-css'`.
  - GitHub: `gh pr list -R beep-effect/beep-effect --head <branch> --state all --json number,state,headRefOid,mergedAt`, plus `gh pr view` for #1281, #1285, #1290, #1297, #1306, #1307 and #1399 (close comments).
  - Content-on-main probes: for each unpublished diff, every added line of 25 or more characters is searched with `grep -F` in `git show origin/main:<file>`, and untracked files are compared by `git hash-object` against `origin/main:<path>`. This is a heuristic: the #1552 per-module import rewrite makes import lines miss even when the content landed.
  - Detector delta: `git show 7a0fd7041e --stat -- standards/effect-vitest.primitives.jsonc packages/tooling/tool/cli/src/commands/Lint/internal/`, `git diff 7a0fd7041e~1 7a0fd7041e -- standards/effect-vitest.primitives.jsonc standards/effect-vitest.inventory.jsonc`, and `git log`/`git diff 2d52bdd1ad HEAD -- packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitest*.ts`.
- Raw outputs, in the same scratch folder: `gap19-raw.txt`, `gap19-lsremote.txt`, `gap19-prs.txt`, and the survey scripts `gap19-*.sh`.

## 1. Headline

- **40 worktrees.**
  - 36 are fully published: 22 through the consolidation PR #1307, and 14 through their own merged PRs.
  - The other 4 contain committed work that is in none of main, continuation `e4c608f9c1`, or the #1307 head `5c6bd1aba2`:
    - `wave-d-pacer`, 1 commit;
    - `rdf`, 4 commits;
    - `wave-d-cosmos`, 1 commit pushed after its PR merged;
    - `pr1399-conflict`, whose closed PR is already satisfied on main.
- **4 worktrees have uncommitted edits:** `capability-leaves`, `coverage-followup`, `inventory-proof` and `rdf`. None of them overlaps the continuation delta or continuation's staged files: `git diff --name-only c921d9e11d e4c608f9c1` and `git diff --cached --name-only` in continuation contain no rdf, box, pacer or ci-lane-timings paths.
- **#1555 changed no detector logic.**
  - `git show 7a0fd7041e --stat -- …/Lint/internal/` lists only `standards/effect-vitest.primitives.jsonc` (157+/157−).
  - Between the lane base `2d52bdd1ad` and HEAD, the only commit that touched `EffectVitest{Detectors,Policy,Primitives,Scan,Store,Syntax}.ts` was #1552 `aa9ce19cff`, a per-module import rewrite. Its 6 files are +41/−31, and all of the changes are import or JSDoc lines.
  - So regenerating the inventory on a lane rebased onto main reconciles the 4.0.1 pin. Rule semantics have not moved.

## 2. Per-worktree table

Columns:

- **dirty**: `git status --porcelain | wc -l`.
- **ahead**: `rev-list --count origin/main..HEAD`.
- **resid**: commits in none of main, `5c6bd1aba2` (#1307 head) and `e4c608f9c1`.
- **remote**: `ls-remote` returned the branch. Every remote head returned equals the local head.

Every head is **not** an ancestor of `e4c608f9c1` except `coverage-followup` and `inventory-proof`, which sit on old main commits.

| worktree (`effect-vitest-…`) | branch | head | dirty | staged / unstaged | ahead | main anc | #1307 anc | resid | remote | PR | disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| acp | codex/effect-vitest-acp | 09a8f73397 | 0 | – | 10 | n | y | 0 | y | #1297 CLOSED (→#1307) | published via #1307 |
| agents-foundation | codex/…-agents-foundation | 3194e465b6 | 0 | – | 9 | n | y | 0 | y | #1304 CLOSED | via #1307 |
| business-drivers | codex/…-business-drivers | 3d79b3530a | 0 | – | 20 | n | y | 0 | y | #1290 CLOSED | via #1307 |
| cache-docs | codex/…-cache-docs | 784a9a9918 | 0 | – | 1 | n | n | 1 | n | #1259 MERGED, head = local | squash on main |
| capability-leaves | codex/…-capability-leaves | 38ac5d9da9 | 7 | – / 2 files +98/−83, 5 untracked | 8 | n | y | 0 | n | none | **commits via #1307; WIP unpublished** |
| cli-artifacts | codex/…-cli-artifacts | e129cf3b79 | 0 | – | 29 | n | n | 29 | n | #1467 MERGED, head = local | squash on main |
| cli-config | codex/…-cli-config | abb9ab2cea | 0 | – | 11 | n | y | 0 | y | #1293 CLOSED | via #1307 |
| coverage-followup | codex/…-coverage-followup | b5bf6822b9 | 2 | 2 files +38 / – | 0 | y | y | 0 | n | none | **staged WIP unpublished** |
| database-drivers | codex/…-database-drivers | 9ab680a912 | 0 | – | 24 | n | y | 0 | y | #1295 CLOSED | via #1307 |
| filesystem | codex/…-filesystem | 0fce23fbac | 0 | – | 3 | n | n | 3 | n | #1047 MERGED, head = local | squash on main |
| government-drivers | codex/…-government-drivers | 9573811245 | 0 | – | 7 | n | y | 0 | y | #1305 CLOSED | via #1307 |
| inventory-proof | codex/…-inventory-proof | d9f74d230a | 25 | – / 1 file +27, 24 untracked | 0 | y | y | 0 | n | none | **WIP unpublished** |
| leaves-checkpoint | codex/…-leaves-checkpoint | 565bb88600 | 0 | – | 15 | n | y | 0 | y | #1285 CLOSED | via #1307 |
| lint-rules | codex/…-lint-rules | 46452d6815 | 0 | – | 10 | n | y | 0 | y | #1306 CLOSED | via #1307 |
| mcp-kit | codex/…-mcp-kit | 166721d72c | 0 | – | 10 | n | y | 0 | y | #1281 CLOSED | via #1307 |
| md | codex/…-md | c03a3983e8 | 0 | – | 14 | n | y | 0 | y | #1296 CLOSED | via #1307 |
| media-drivers | codex/…-media-drivers | 80e01f276d | 0 | – | 14 | n | y | 0 | y | #1294 CLOSED | via #1307 |
| observability | codex/…-observability | 9b8d959e1d | 0 | – | 16 | n | y | 0 | y | #1300 CLOSED | via #1307 |
| phoenix | codex/…-phoenix | 441bfec4e5 | 0 | – | 9 | n | y | 0 | y | #1302 CLOSED | via #1307 |
| pr1399-conflict | fix/vitest-alias-dock-css | 744760f811 | 0 | – | 3 | n | n | 3 | y | #1399 CLOSED | superseded; alias on main |
| pretext | codex/…-pretext | 91a23ba8a3 | 0 | – | 11 | n | y | 0 | y | #1303 CLOSED | via #1307 |
| provenance | codex/…-provenance | 769c458492 | 0 | – | 8 | n | y | 0 | y | #1282 CLOSED | via #1307 |
| provider-drivers | codex/…-provider-drivers | 29c8d7355d | 0 | – | 13 | n | y | 0 | y | #1287 CLOSED | via #1307 |
| rdf | codex/…-rdf | d88e376619 | 5 | – / 5 files +391/−171 | 4 | n | n | 4 | n | none | **commits and WIP unpublished** |
| repo-configs | codex/…-repo-configs | 4fd64599c9 | 0 | – | 11 | n | y | 0 | y | #1298 CLOSED | via #1307 |
| repo-utils | codex/…-repo-utils | 6ad006114b | 0 | – | 13 | n | y | 0 | y | #1299 CLOSED | via #1307 |
| runner-browser | codex/…-runner-browser | 93bbd7b11b | 0 | – | 1 | n | n | 1 | n | #1262 MERGED, head = local | squash on main |
| runner-context | codex/…-runner-context | 59ae5f956b | 0 | – | 3 | n | n | 3 | n | #1241 MERGED, head = local | squash on main |
| shared-domain | codex/…-shared-domain | a97ca9c183 | 0 | – | 11 | n | y | 0 | y | #1301 CLOSED | via #1307 |
| wave-b | codex/…-wave-b | 87a4334fd8 | 0 | – | 4 | n | n | 4 | n | #1245 MERGED, head = local | squash on main |
| wave-c | codex/…-wave-c | cbd522809a | 0 | – | 15 | n | n | 15 | n | #1252 MERGED, head = local | squash on main |
| wave-d-codegen | codex/…-wave-d-codegen | 58f9466fad | 0 | – | 25 | n | n | 25 | n | #1255 MERGED, head = local | squash on main |
| wave-d-colors | codex/…-wave-d-colors | f7f9e9a21d | 0 | – | 20 | n | n | 20 | n | #1256 MERGED, PR head 86fd3240b3 | local is an ancestor of the PR head, so covered |
| wave-d-cosmos | codex/…-wave-d-cosmos | d4ef8af2e6 | 0 | – | 41 | n | n | 41 | y | #1258 MERGED, PR head 04dbe47df2 | **1 post-merge commit unpublished** |
| wave-d-obs | codex/…-wave-d-obs | 4ab742b7f1 | 0 | – | 29 | n | n | 29 | n | #1263 MERGED, head = local | squash on main |
| wave-d-pacer | codex/…-wave-d-pacer | e8feb7244a | 0 | – | 30 | n | n | 30 | n | none | **1 commit unpublished** |
| wave-d-pglite | codex/…-wave-d-pglite | 6f899d5d77 | 0 | – | 57 | n | n | 57 | y | #1264 MERGED, head = local | squash on main |
| wave-d-tailscale | codex/…-wave-d-tailscale | a7fe3d14a4 | 0 | – | 36 | n | n | 36 | n | #1265 MERGED, head = local | squash on main |
| wave-d-test-utils | codex/…-wave-d-test-utils | ee143d68e0 | 0 | – | 38 | n | n | 38 | n | #1266 MERGED, head = local | squash on main |
| wink-isolation | codex/…-wink-isolation | 4577925f9e | 0 | – | 2 | n | n | 2 | n | #1242 MERGED, head = local | squash on main |
| inventory-next | – | – | – | – | – | – | – | – | – | – | not a git worktree; holds only `.beep/yeet/runs/<run>` residue (4 KiB) |

**Notes on the table.**

- For squash merges, a non-zero **resid** is expected: squashed commits are never ancestors of main. Those worktrees are judged by "PR MERGED and PR head equals local head".
- **Remote branches.** 22 branches exist on the remote: the 19 superseded-by-#1307 branches, `wave-d-cosmos`, `wave-d-pglite` and `fix/vitest-alias-dock-css`. The other 18 local branches have no remote.
- **The #1307 linkage.** #1307 is `codex/effect-vitest-consolidated`, MERGED 2026-09-28 as squash `c2b75455df`. The tree of its head `5c6bd1aba2` equals the squash tree (`git diff --quiet` succeeded). Every close comment says: "This PR's exact head `<sha>` is preserved as an ancestor of the published consolidation branch". The ancestor checks confirm this for all 19 closed branches.

## 3. Flagged work: in none of main, continuation or #1307

### 3.1 `effect-vitest-rdf`: 4 commits plus WIP, no PR, no remote

- Commits, dated 2026-09-25 22:18–22:31, on base `7581ead6c8`:
  - `fd01a034a6` docs: prepare RDF wave
  - `f3ade2c6cd` test(rdf): adopt canonical assertions without weakening checks
  - `7c62e550c0` docs: record remaining RDF assertion findings
  - `d88e376619` test(rdf): preserve complete causes in failure assertions
- Unstaged WIP, mtime 2026-09-25 22:34:
  - `packages/foundation/modeling/rdf/test/{IRI,ProvRdf,Rdf,URI}.test.ts`
  - `goals/effect-vitest-canon/research/OPPORTUNITIES.md`
  - 5 files, +391/−171 in total.
- Probe results:

  | Change | Added lines missing on main |
  | --- | --- |
  | Committed: IRI | 15/15 |
  | Committed: URI | 14/14 |
  | Committed: Rdf | 20/33 |
  | Committed: ProvRdf | 20/24 |
  | WIP: Rdf | 38/97 |
  | WIP: IRI | 7/20 |
  | WIP: URI | 7/20 |
  | WIP: ProvRdf | 0/40 |

- Main touched these tests later, in #1307 `c2b75455df`, #1346, #1371 and #1552. Main's inventory still carries 12 rows under `modeling/rdf/test`.
- **This is the largest unpublished canon residue outside the six lanes.**

### 3.2 `effect-vitest-wave-d-pacer`: 1 commit, no PR, no remote

- The only commit not in merged #1263 (obs): `e8feb7244a` "test(pacer): instrument scenarios and expose cancellation cleanup gap", 2026-09-25. It changes 12 files, +265/−146.
- Pacer was migrated on main independently. `@beep/test-runner` first enters `packages/drivers/pacer/test/Pacer.test.ts` in #1307, so the test file is superseded in substance. 39 of the commit's 136 probe lines are missing on main, partly because of the import rewrite.
- **Not on main:**
  - `.changeset/pacer-instrumented-tests.md`,
  - `goals/effect-vitest-canon/research/2026-09-25-pacer-partial-proof.md`,
  - `goals/effect-vitest-canon/research/pacer-cache-review.md`.
- The commit subject records a "cancellation cleanup gap" finding. Whether main's pacer tests cover that gap is not established; see the open questions.

### 3.3 `effect-vitest-wave-d-cosmos`: 1 post-merge commit, pushed

- `d4ef8af2e6` "docs(effect-vitest): anchor Obs timing to equivalent source tree", 2026-09-25 10:57. It was pushed to `origin/codex/effect-vitest-wave-d-cosmos` after #1258 merged at 15:57Z with PR head `04dbe47df2`.
- It changes 2 files, +12/−2:
  - `goals/effect-vitest-canon/history/2026-09-25-obs-migration.md`, where the added "Timing provenance reconciliation" section is absent on main;
  - `…/ops/inventory/timings/context/after/beep_obs.json`.
- It is evidence prose and timing metadata only, with no test or source code.

### 3.4 `effect-vitest-pr1399-conflict`: closed, already satisfied

- `9802497473` adds the `dock.css` alias to `vitest.aliases.generated.json` (+3). Main's file contains `dock.css` twice.
- Greptile's closing summary on #1399 says the tip tree equals main and recommends closing it as superseded.
- Nothing needs preserving.

## 4. Uncommitted work in published worktrees

| Worktree | State | Content vs main |
| --- | --- | --- |
| `capability-leaves` (head `38ac5d9da9` ⊂ #1307) | Unstaged: `packages/drivers/box/test/Box.service.test.ts` (+~95/−~80) and `…/integration/Box.live.test.ts` (±4). Untracked: `goals/effect-vitest-canon/history/capability-leaves-box-preparation.md` and 4 timing JSONs under `ops/inventory/timings/capability-leaves-preparation/`. mtime 2026-09-26 01:11. | 10 of 34 Box probe lines missing on main; all 5 untracked files absent on main. Main has since changed Box tests (#1487, #1489, #1552), so this WIP will conflict. |
| `coverage-followup` (head `b5bf6822b9` = #1193, on main) | Staged: `packages/tooling/tool/cli/test/ci-lane-timings.test.ts` (+26) and `OPPORTUNITIES.md` (+12). mtime 2026-09-22. | 14 of 15 probe lines missing on main, including the tests named "renders an unratified version without c…" and "retains a pending job status and reports unava…". The file exists on main. |
| `inventory-proof` (head `d9f74d230a` = #1239, on main) | Unstaged: `OPPORTUNITIES.md` +27. 24 untracked files under `goals/effect-vitest-canon/ops/inventory/reconciliation/modeling/` (464 KiB), dated 2026-09-25 17:00. | 12 of the 24 are byte-identical to main. 4 differ: `README.md`, `manifest.json`, `test-files.json`, `validation.json`. 8 are absent: `{flake,observability,property,resource}/beep_{data,schema}.jsonl`. These are stale reconciliation evidence that predates #1307. |
| `rdf` | See section 3.1. | |

## 5. What @effect/vitest 4.0.1 → 4.0.2 (#1555, `7a0fd7041e`) changed

**Files.** Only `standards/effect-vitest.primitives.jsonc` matched the pathspec `standards/effect-vitest.primitives.jsonc packages/tooling/tool/cli/src/commands/Lint/internal/`, with 157+/157−. #1555's whole stat touches two CLI `src` files, and neither is a detector:

- `commands/Laws/EffectImports.ts` (±14),
- `internal/package-scripts/PackageScripts.schemas.ts` (±14).

**Primitives diff, `standards/effect-vitest.primitives.jsonc`:**

- Header and pin fields:
  - generated-from comment, `version`, `tag`: 4.0.1 → 4.0.2;
  - `sha`: `460272d304…` → `269a7c8643…`;
  - `coverage.method` text and one note mention 4.0.2.
- 75 anchors with `startLine`/`endLine` shifts only. Example: `module.@effect/vitest` 19 → 22, `API` 25 → 31.
- 1 signature change: the `Vitest` namespace anchor, lines 30–188 → 39–209.
  - `export namespace Vitest` became `export declare namespace Vitest`.
  - Upstream added one-line JSDoc descriptions to `TestFunction`, `Test`, `Arbitraries`, `Tester`, `MethodsNonLive` and `Methods`.
  - Member types, options and `prop` contracts are textually unchanged.
- No anchor was added or removed. `name`, `kind`, `file`, `description`, `whenToUse`, `whenNotToUse` and replacement fields are all unchanged.

**Inventory diff, `standards/effect-vitest.inventory.jsonc`:**

- `effectVitestVersion` is 4.0.1 → 4.0.2. The row count is 1,879 before and after.
- 4 rows were re-anchored by line shifts:
  - 2 × `EV013 …quality-tasks.test.ts …retry-loop`, shifted by #1552's edit to that file;
  - 2 × `EV014 …gov-legal-mcp/test/Server.test.ts …it.layer`, shifted by #1555's edit to that file.
- One EV013 `occurrence` hash changed with its re-anchor.

**Tests and fixtures:**

- The fixture directory was renamed `test/fixtures/effect-vitest-401` → `effect-vitest-402`, with refreshed `src/index.ts.txt` (±65), `src/utils.ts.txt` (+22) and charter snippets.
- `test/effect-vitest-contract.test.ts` and `test/effect-vitest-primitives.test.ts` updated only their pin strings.

**Detector source:**

- `git log 2d52bdd1ad..HEAD -- …/Lint/internal/EffectVitest*.ts …/Lint/Lint.schemas.ts` returns only #1552.
- Every non-comment line #1552 changed is an `import { X } from "effect"` → `import * as X from "effect/X"` rewrite.

**Verdict.** The 4.0.2 bump changed pins and anchors only, not detector logic or rule primitives.

- A lane that still carries `effectVitestVersion: "4.0.1"` fails the pin check ("rejects an installed Effect Vitest version outside the 4.0.2 pin"), so it must regenerate the inventory after taking main.
- The regenerated rows should differ only by re-anchoring. The large line and occurrence churn from #1552's import rewrite of test files lands in the same regeneration.

## Proposed plan for the implementing lane

1. **Preserve before anything else.** Use read-only exports into the program scratch, with no stash and no checkout:
   - rdf: `git -C <rdf> format-patch origin/main..HEAD` plus `git diff > rdf-wip.patch`;
   - pacer: `git format-patch -1 e8feb7244a`;
   - cosmos: `git format-patch -1 d4ef8af2e6`;
   - capability-leaves: `git diff` plus a tar of the 5 untracked files;
   - coverage-followup: `git diff --cached`;
   - inventory-proof: `git diff` plus a tar of the 8 absent and 4 differing untracked files.
2. **Triage against main. Never merge these branches.** Every base predates #1307 and #1552.
   - **rdf**: replay the 4 commits and the WIP onto the fresh canon lane with `git apply -3`, and re-run the RDF rows of the detector. This is the only candidate with likely net-new test strength.
   - **coverage-followup**: re-apply the 2 staged ci-lane-timings tests, which look net-new.
   - **capability-leaves**: diff the Box WIP against main's post-#1487 tests, and keep only assertions main lacks.
   - **pacer**: check whether the "cancellation cleanup gap" is asserted on main. If not, port that test only. Drop the stale changeset.
   - **cosmos** and **inventory-proof**: keep as evidence in the canon packet history if wanted, but do not re-land the timing or reconciliation data. #1307 and later inventories supersede them.
3. **Retire as fully published, after step 1 for the dirty ones.** Cover the 19 superseded-by-#1307 worktrees, the 14 merged-own-PR worktrees and `pr1399-conflict`, using `bun run beep worktree remove <name> --archive --delete-branch`. The `inventory-next` residue dir needs its own step: it is not a registered worktree, so `worktree remove` refuses it ("Removal target is not a registered managed worktree."). Tar its `.beep/yeet/runs` residue into the program scratch, then delete the directory directly. The 22 remote branches can be deleted alongside: every one is merged, superseded, or carries only `d4ef8af2e6`.
4. **Inventory.** After integrating the continuation delta and the triage above on a lane from main, regenerate `standards/effect-vitest.inventory.jsonc` once under the 4.0.2 pin. No detector change is needed for the version bump.

## Open questions

- Whether main's `packages/drivers/pacer/test/Pacer.test.ts` covers the cancellation-cleanup gap named by `e8feb7244a`. Line probes cannot decide this. It needs a semantic read or the detector.
- Whether the rdf commits and WIP are stronger than main's #1307 RDF migration or an alternative to it. The probe misses are partly import-rewrite noise. It needs a per-test semantic diff.
- Whether the `coverage-followup` staged tests still match main's `ci-lane-timings` implementation (dated 2026-09-22). They were not run, by rule.
- Who owned `rdf`, `wave-d-pacer`, `capability-leaves` and `inventory-proof`, and whether those sessions are dead. No session ledger or lease lookup was done.
- Why `effect-vitest-inventory-next` exists without a git worktree. Its yeet run directory was not opened.
