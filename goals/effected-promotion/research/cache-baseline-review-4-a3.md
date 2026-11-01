# Cache baseline review: 4-A3 (repo-utils workspace discovery and dependency graph onto `@beep/repo-workspaces`)

Reviewed 2026-10-31 for 4-A3 of `goals/effected-promotion` (wave-4 plan PR sequence, W4-f).

`bun run beep quality cache-policy` reported 17 blocking findings, all introduced by this branch and all of one kind:
configuration drift on the root subject (`//`), on seventeen per-tool policy-fingerprint seals, plus the advisory
`configuration-source-drift: turbo.json`.

No manifest changes. The cause is the source move this PR makes: repo-utils `Workspaces.ts`, `Dependencies.ts`,
`DependencyIndex.ts` and `schemas/WorkspaceDeps.ts` are deleted, and every repo-cli caller reads the workspace
members through the new `packages/tooling/tool/cli/src/internal/RepoWorkspaces.ts`, which runs
`@beep/repo-workspaces` `WorkspaceDiscovery` and `DependencyGraph`. `bun run beep lint policy-fingerprint --write`
regenerates `standards/policy-tools.fingerprint.json` and the matching `inputs` of each seal in `turbo.json`.
Measured against `origin/main` 900023804b, on which the lane was rebuilt by cherry-pick once #2433 merged (it was
first cut from #2418, then rebuilt on f9b40dbb3b, the head of #2433; the counts are the same against both), key by key:

- `shared` removes the four deleted repo-utils files and adds nothing;
- six seals (`goals-doctor`, `goals-index`, `knowledge`, `lint-deprecated-apis`, `lint-roadmap-refs`, `quality`)
  add two inputs each: `repo-cli/src/internal/RepoWorkspaces.ts` and `repo-workspaces/src/DependencyGraph.ts`;
- eight seals (`laws`, `lint-effect-vitest`, `lint-identity-registry`, `lint-jsdoc`, `lint-laws`,
  `lint-package-scripts`, `lint-schema-first`, `topo-sort`) add 90 inputs each, the closure the workspace reader now
  reaches: `RepoWorkspaces.ts`, 11 `@beep/repo-workspaces` inputs (`package.json` and 10 sources), 49 `@beep/yaml`,
  22 `@beep/lockfiles`, 4 `@beep/package-json` and 3 `@beep/glob` files; `topo-sort` also drops
  `repo-cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts` (the deleted root-key guard was its only reason);
- `tsconfig-sync` adds 39 inputs (the same closure less `@beep/yaml` and the repo-workspaces `package.json` and
  `WorkspacePatterns.ts`, which it has sealed since 4-A2) and `version-sync` 25 (`RepoWorkspaces.ts`, 11
  repo-workspaces, 7 lockfiles, 3 package-json, 3 glob files), because TurboResolver now discovers its workspace
  directories through the kit;
- no other `turbo.json` key changes, no task is added or removed, and no package subject drifts.

The review-round fixes (the fail-closed root guard and the generated-directory filter in `RepoWorkspaces.ts`, the
RegistrationGeometry read of the kit's dependency fields) add no input beyond those counts.

This request re-records the baseline for the `//` subject only, on main's profile (`local-linux-x64-bun1.4.4`,
`qualification-v3`). No qualification is granted, and no other subject changes.
