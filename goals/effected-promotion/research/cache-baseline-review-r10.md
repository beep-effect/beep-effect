# Cache baseline review: roadmap PR R10 (repo-cli adopts `@beep/git`)

Reviewed 2026-10-25 for roadmap PR R10 of `goals/effected-promotion` (wave-4 plan PR sequence, W4-l).

`bun run beep quality cache-policy` reported 6 blocking findings, all introduced by this branch and all of one kind:
configuration drift on `@beep/repo-cli`, on six task tuples (`#build`, `#check`, `#doctest`, `#lint:deprecated-apis`,
`#test`, `#test:property`).

The cause is one manifest edit: `packages/tooling/tool/cli/package.json` gains the regular dependency
`"@beep/git": "workspace:^"`, because `Skills/internal/MergeBase.ts`, `internal/repo-run/GitWorktree.ts` and
`Yeet/internal/ProvenanceFooter.ts` now read git through `@beep/git/Git`. The scripts block is unchanged.
`bun run beep tsconfig-sync` added the matching project reference to the package `tsconfig.json` and
`tsconfig.check.json` and regenerated `standards/fallow.boundaries.generated.jsonc`; `bun.lock` records the new
workspace edge. No third-party dependency is added.

Turbo coupling, measured with `bunx turbo run build check test --filter=@beep/repo-cli --dry=json` on this lane with
and without the manifest line (134 tasks before, 136 after):

- added tasks: `@beep/git#build` and `@beep/git#transit` (`@beep/git`'s own dependencies `@beep/fc-runs`,
  `@beep/identity`, `@beep/schema` and `@beep/utils` were already in repo-cli's closure, so the workspace closure
  gains exactly one package);
- `@beep/repo-cli#build` and `#check` gain `@beep/git#build`; `#test` and `#transit` gain `@beep/git#transit`;
- no task is removed. The only dependent of `@beep/repo-cli` among the workspaces is `@beep/scratchpad`, whose closure
  gains the same one package.

The root subject (`//`) drifts on one tuple, `//#lint:policy-fingerprint`, as a consequence of the same edge:
`bun run beep lint policy-fingerprint --write` adds `packages/drivers/git/{package.json,src/**}` to the fingerprinted
policy-tool closure in `standards/policy-tools.fingerprint.json` and to that task's `inputs` in `turbo.json`, because
the package is now reachable from repo-cli. No other `turbo.json` key changes.

This request re-records the baseline for the `@beep/repo-cli` and `//` subjects only. No qualification is granted, and
no other subject changes.
