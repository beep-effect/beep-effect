---
title: "TURB-01: the owner drift check runs in Repo Sanity, on the PR that adds or removes a reader"
date: 2026-11-12
lane: "fix/turb-01-owner-drift-lint"
reversal: "Remove the lint:coverage-owners step from the repo-sanity body in CiLane.ts and the coverage-owners lint command; the repo-cli test still holds the rows when it runs."
---

The slice 1 drift check lived only in a @beep/repo-cli test, and the planner never selects repo-cli for a reader that appears outside it. `dependentSeedOwnerForFile` drops test-tree files, so a PR that adds a test file under repo-cli-kit's `test/` tree reading `standards/schema-first.inventory.jsonc` selects only repo-cli-kit and merges green. The next PR that regenerates the inventory selects only repo-cli by its row, so the new reader goes unrun and the drift test goes red on that unrelated PR or on main. A new reader in `apps/**` src behaves the same way. The post-merge review of #3063 found this (2026-11-12).

The check now also runs as `bun run beep lint coverage-owners`, a step in the Repo Sanity lane body (`CiLane.ts`). That lane runs for every diff except packet-prose-only ones, which cannot add a TypeScript reader. The lint and the repo-cli test call the same `workspaceCoverageOwnerDrift`. It globs `packages/**` and `apps/**` TypeScript sources, compares every row with the scan in both directions, and fails on drift or on an empty scan. On this head it reads 9242 sources in about 7 s with zero drift. Seeding the reader from the scenario above turned it red: the row lists @beep/repo-cli, the scan finds @beep/repo-cli and @beep/repo-cli-kit. `yeet final-check` replays `ci lane repo-sanity`, so a local final pass covers it too.

Rejected: a planner trigger that maps any changed `*.ts` mentioning a row basename to @beep/repo-cli. A deleted or edited reader no longer mentions the basename in its head text, so the trigger would miss removals unless the planner also read base blobs. It would also make the planner read file contents on every run.
