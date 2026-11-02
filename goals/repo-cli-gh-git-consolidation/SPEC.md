# repo-cli gh/git consolidation Spec

## Objective

Move repo-cli and its tests off hand-rolled gh and git spawning onto @beep/github, @beep/git and @beep/commands, extending the kits where they lack the feature.

The work was split out of `goals/effected-promotion` by its decision W4-l. The sites are listed in
[`research/site-list.md`](./research/site-list.md).

## Non-Goals

- New GitHub or git behaviour beyond what the listed sites already do.
- The 8 partial drivers that effected-promotion R9 excluded, each with its own named kit option.
- `@beep/github`, `@beep/git` or `@beep/commands` features no listed site needs.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli` (Reviewer, Yeet, Ci, Skills, Worktree, Knowledge, `internal/github`, `internal/repo-run`).
- `packages/tooling/library/ai-metrics` (`config-snapshot.ts` and the git half of #304).
- The kits that gain the missing features: `@beep/github`, `@beep/git`, `@beep/commands`.
- Tests that hand-roll a scripted spawner (`@beep/test-utils`, repo-cli, tailscale).

## Constraints

- Each kit feature lands with tests before the sites move onto it.
- Each site keeps its observable output, exit codes and error classes, proven the way effected-promotion R10 did
  (a recorded before/after differential, `research/git-adoption-differential-r10.json` there).
- One owner switch per PR, no alias left behind.

## Acceptance Criteria

- [ ] Every row of `research/site-list.md` is migrated, or carries a recorded reason it stays.
- [ ] repo-cli and ai-metrics contain no hand-rolled `gh` or `git` spawn outside the kits, except rows kept with a
      reason.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/repo-cli-gh-git-consolidation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/repo-cli-gh-git-consolidation/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/repo-cli-gh-git-consolidation` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-01 | Packet created by effected-promotion closeout PR C (step 6) from its W4-l decision, with its site list copied from that packet's reuse ledger. It starts `paused`. | effected-promotion W4-l moved these sites out because each needs a kit feature, about 1,700 lines. | Fold the sites back into effected-promotion, per W4-l's own reversal. |
| 2026-11-02 | D-02 **Unpaused** (`goals set-status repo-cli-gh-git-consolidation active`). | The operator asked on 2026-11-02 for a session to see the effected goals to completion; effected-promotion's own closeout verified on 2026-11-01 (#2476), so this follow-up is the remaining effected work. | `goals set-status repo-cli-gh-git-consolidation paused`. |
| 2026-11-02 | D-03 **P0 findings bind the plan.** `research/p0-site-inventory-2026-11-02.md` is the site census: rows #77, #84 and #281 are already kit-backed facades over `@beep/github` (kept as the migration target), #85 has no gh or git spawn (row stale since R10), and the kit gaps are named once as G1 to G10. The PLAN "Waves" table (W0 to W5, then C) is the binding PR sequence; each PR flips its own row. | The 2026-10-20 site list predates R10 and the kit-backed `internal/github/` facade; the census replaces it as the working list without rewriting the inherited rows. | Delete the Waves table and work from `research/site-list.md` alone. |
| 2026-11-02 | D-04 **Bounded output (G6) is implemented inside `@beep/git`** as a `maxOutputBytes` option on the collected run with a typed `GitCommandError` kind, not by making `@beep/git` depend on `@beep/commands` `Run.collect`. | The two are sibling drivers with identical dependency footprints; a driver-to-driver edge for one bound would be the first such edge in `packages/drivers`, and `Run.collect`'s `CommandOutput` model would have to be unwrapped back into the git classifier's `Collected` triple. | Route `internal/run.ts` `runCollected` through `Run.collect` and add the dependency. |
| 2026-11-02 | D-05 **The gh-token client stays in repo-cli.** `GithubIdentity.layerGithubClientFor` keeps the identity precedence (`--token-ref`, `BEEP_GH_TOKEN_REF`, the App triple, `gh auth token`); W3 moves its `gh auth token` and `op read` spawns onto `@beep/commands` `Run.text` with redaction, and `@beep/github` exposes only `layerFromToken` and the App client. The site list's "gh-token client" kit gap (G1) is closed by that move, not by a kit member. | The precedence is repo-cli policy (which secret store, which operator login), not a GitHub concern; every gh site then takes `GitHubClient` from the repo-cli layer. | Add `GitHubClient.layerFromGhCli` to `@beep/github` and point `layerGithubClientFor` at it. |
| 2026-11-02 | D-06 **`Git.layer` is provided once at the repo-cli runtime edge** (`bin-main.ts` `BaseLayers`, `Dispatch.manifest.ts` `BaseServices`), and sites take `Git` from their requirements. The lift lands per command group as its sites move: W0 lifts Knowledge, the Quality residue probe and the Ci route census; `GitWorktree.ts` and `TmpfsReap.ts` keep a leaf `Effect.provideServiceEffect(Git, Git.make)` until W1 lifts the Yeet requirement unions (`Sweep`, `Merge`, `MonitorLoop`, `Porcelain`) that reach them. The `@beep/git` files move from six per-command policy-fingerprint seals into the shared seal (`research/cache-baseline-review-w0.md`, request `research/cache-baseline-request-w0.json`). | effected-promotion W4-l (R10 part) named this goal as the one that lifts `Git` into callers' requirements; widening Yeet's seventeen explicit unions in W0 cascaded into four more files and belongs with the Yeet git-layer switch. | Drop `Git.layer` from `BaseLayers` and provide `Git.make` at each leaf again. |
| 2026-11-02 | D-07 **W0 as built.** `@beep/git` gains `Git.isAncestor(cwd, ancestor, descendant)` (`merge-base --is-ancestor`; git's silent exit 1 is `false`, an unknown object is `UnknownRefError`, a noisy exit 1 stays `GitCommandError`; the classifier also reads `Not a valid commit name`, the wording `--is-ancestor` uses) and `Git.worktreePrune(cwd)`, each with command, service, test-double, coverage and real-repository tests. Sites: `KnowledgeDoctor.service.ts` `isAncestorLive` reads the answer and, on any failure, runs `Git.isShallow` to keep its shallow-clone refusal; `ResidueTerminalLaneLive.ts` `ancestorOf` keeps `false` on failure; `RouteCensus.ts` `RouteGit.isAncestor` keeps `RouteError` with the exit code when git ran and the typed reason otherwise; `GitWorktree.ts` and `TmpfsReap.ts` prune through the kit, and TmpfsReap's `-C <repo> worktree remove --force` becomes `Git.worktreeRemove({ force: true })`. Differential `ops/is-ancestor-prune-differential.ts` -> `research/is-ancestor-prune-differential-w0.json`: 21 scenarios, 18 same, 3 classified (unknown object, shallow clone, non-repository: a bare exit 128 becomes the typed `UnknownRefError` or `NotARepositoryError`; every site maps it back to its old answer), 0 unclassified. The Yeet is-ancestor probes (`FinalCheckRefresh.ts`, `Sweep.ts`) and `HeadInstallPreflight.ts`'s prune wait for W1. | One owner per concept; the typed errors are the only behaviour shift and each site folds them back. | Restore the frozen `old*` bodies recorded in the differential script. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
