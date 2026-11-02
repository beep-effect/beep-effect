# Site list (from effected-promotion W4-l)

Copied on 2026-11-01 from `goals/effected-promotion/history/reuse-ledger.md`, where every row below reads
"follow-up goal (W4-l)". Map numbers refer to `goals/effected-promotion/research/promotion-map-2026-10-20.md`
("Reuse sites"). SPEC W4-l of that packet records why they left it: each needs a kit feature that is not built yet.

## gh-CLI surface (17 sites)

Kit gaps: a review-thread resource, a down-scoped GitHub App token, and a gh-token client in `@beep/github`.

| Site | Map # | Map status | Ledger status | Reason |
| --- | --- | --- | --- | --- |
| repo-cli Reviewer/GitHubAppAuth.ts | #74 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer/ReviewerService.ts | #75 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer/ReviewerRuleset.ts | #76 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/github/GithubGraphql.ts | #77 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/Status.ts | #78 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/WatchMode.ts | #79 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/MergeGate.ts | #80 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/closeout/GhCollect.ts | #81 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet/internal/Reply.ts | #82 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/github/GhCommand.ts | #83 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/github/GithubRest.ts | #84 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Skills/Skills.command.ts | #85 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer/ReviewerRuleset.ts, ReviewerService.ts | #247 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Ci/LaneTimings.ts | #248 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Ci/CiGovernance.ts, Ci/CiRerunRunnerLoss.ts (GitHub reads) | #249 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Yeet gh-CLI surface (PullRequest, Planner, MergeGate and others) | #250 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Reviewer | #303 | partial | follow-up goal (W4-l) | gh-CLI surface; needs kit features (review-thread resource, down-scoped App token, gh-token client). Moves to the repo-cli gh/git consolidation goal (W4-l). |

## git wrappers (11 sites)

Kit gaps in `@beep/git`: fail-closed output parsers, rename score, pathspec, bounded output and `Git.isAncestor`.

| Site | Map # | Map status | Ledger status | Reason |
| --- | --- | --- | --- | --- |
| repo-cli internal/repo-run/GitExec.ts | #100 | partial | dead collectors deleted (R10); follow-up goal (W4-l) | R10 deleted `collectDirtyPaths` and `collectChangedPathsSinceBase` (no importer: `git grep -w` outside `goals/` hit only their definitions and the generated instrumentation catalog). The parsers wait for kit gaps (follow-up goal). |
| repo-cli Yeet/internal/GitExec.ts | #101 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli internal/repo-run/ChangedFiles.ts | #102 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Worktree/Worktree.schemas.ts | #105 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Worktree/Fleet.service.ts | #106 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| ai-metrics config-snapshot.ts | #107 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Knowledge/KnowledgeDoctor.grouping.ts | #110 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli Knowledge/KnowledgeDoctor.service.ts | #111 | partial | follow-up goal (W4-l) | Needs `Git.isAncestor` in the kit (W4-l; the plan's R10 deferral). |
| repo-cli commands (per-group git wrappers) | #112 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli `GitExec.ts` and the Yeet git helper layer | #251 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |
| repo-cli typed git wrappers (Codex Security, Session and others) | #252 | partial | follow-up goal (W4-l) | Git wrappers that need kit gaps (fail-closed parsers, rename score, pathspec, bounded output). Moves to the repo-cli gh/git consolidation goal (W4-l). |

## `ScriptedSpawner` test sweep (4 sites)

Tests that hand-roll a scripted child-process spawner instead of the `@beep/commands` test layer.

| Site | Map # | Map status | Ledger status | Reason |
| --- | --- | --- | --- | --- |
| repo-cli test  (and driver/app tests) | #125 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| repo-cli test | #279 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| test-utils | #291 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |
| tailscale test tailscale.test.ts | #300 | partial | follow-up goal (W4-l) | The `ScriptedSpawner` test sweep (W4-l). |

## Other

| Site | Map # | Map status | Ledger status | Reason |
| --- | --- | --- | --- | --- |
| repo-cli `Yeet/internal/GhOps.ts` | #281 | follow-up goal (W4-l) | Unchanged by R8. |
| ai-metrics | #304 | partial | adopted in R4 (yaml half); follow-up goal (W4-l) | The yaml half moved in R4 (#32); the git half goes with the gh/git follow-up goal. |
| repo-cli Reviewer/GitHubAppAuth.ts | #124 | partial | follow-up goal (W4-l) | Reviewer App-auth spawns; travels with #74 in the gh/git consolidation goal. |
| repo-cli Yeet/internal/GhOps.ts | #281 | partial | follow-up goal (W4-l) | GhOps splicer; R8 hands it to the follow-up goal. |
