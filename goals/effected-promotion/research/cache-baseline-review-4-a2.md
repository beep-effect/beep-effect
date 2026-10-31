# Cache baseline review: 4-A2 (repo-cli pattern readers adopt `WorkspacePatterns`)

Reviewed 2026-10-31 for 4-A2 of `goals/effected-promotion` (wave-4 plan PR sequence, W4-f).

`bun run beep quality cache-policy` reported 7 blocking findings, all introduced by this branch and all of one kind:
configuration drift on the root subject (`//`), on seven per-tool policy-fingerprint seals
(`//#lint:policy-fingerprint:{goals-doctor,goals-index,knowledge,lint-deprecated-apis,lint-roadmap-refs,quality,tsconfig-sync}`),
plus the advisory `configuration-source-drift: turbo.json`.

No manifest changes. The cause is the source move this PR makes: `@beep/repo-workspaces` promotes
`src/internal/patterns.ts` to the public `src/WorkspacePatterns.ts` leaf, and repo-cli's `TsconfigSync.plan.ts`,
`CreatePackage.command.ts`, `Quality/ChangesetGraph.ts` and `Quality/Tasks.ts` import that leaf.
`bun run beep lint policy-fingerprint --write` then regenerates `standards/policy-tools.fingerprint.json` and the
matching `inputs` of each seal in `turbo.json`. Measured against `origin/main` (807e82235a), key by key:

- six seals (`goals-doctor`, `goals-index`, `knowledge`, `lint-deprecated-apis`, `lint-roadmap-refs`, `quality`) swap
  one input, `packages/tooling/library/repo-workspaces/src/internal/patterns.ts` for
  `packages/tooling/library/repo-workspaces/src/WorkspacePatterns.ts` (the same file under its new path);
- the `tsconfig-sync` seal adds 51 inputs and removes none: `repo-workspaces/package.json`,
  `repo-workspaces/src/WorkspacePatterns.ts`, `packages/foundation/modeling/yaml/package.json` and 48 `@beep/yaml`
  `src/**` files, because `TsconfigSync.plan.ts` now reads its syncpack sources through `WorkspacePatterns.read`, which
  parses `pnpm-workspace.yaml` with `@beep/yaml` (the deleted `readRootPackageJson` read only `package.json`);
- no other `turbo.json` key changes, no task is added or removed, and no package subject drifts.

This request re-records the baseline for the `//` subject only. No qualification is granted, and no other subject
changes.
