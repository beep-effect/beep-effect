# Cache baseline review: 4-A1 (repo-cli QAS discovery adopts `@beep/repo-workspaces`)

Reviewed 2026-10-27 for 4-A1 of `goals/effected-promotion` (wave-4 plan PR sequence, W4-f).

`bun run beep quality cache-policy` reported 7 blocking findings, all introduced by this branch and all of one kind:
configuration drift on `@beep/repo-cli`, on six task tuples (`#build`, `#check`, `#doctest`, `#lint:deprecated-apis`,
`#test`, `#test:property`), and on the root tuple `//#lint:policy-fingerprint`.

The cause is one manifest edit: `packages/tooling/tool/cli/package.json` gains the regular dependency
`"@beep/repo-workspaces": "workspace:^"`, because `Quality/internal/QualityArtifactSupport.ts`
`discoverWorkspacePackages` now takes its member directories from `@beep/repo-workspaces/WorkspaceDiscovery` (map
site #143). The scripts block is unchanged. `bun run beep tsconfig-sync` added the matching project reference to the
package `tsconfig.json` and `tsconfig.check.json` and regenerated `standards/fallow.boundaries.generated.jsonc`;
`bun.lock` records the new workspace edge. No third-party dependency is added.

Turbo coupling, measured with `bunx turbo run build check test --filter=@beep/repo-cli --dry=json` on this lane with
and without the manifest line (142 tasks before, 144 after):

- added tasks: `@beep/repo-workspaces#build` and `@beep/repo-workspaces#transit` (its own dependencies were already in
  repo-cli's closure, so the workspace closure gains exactly one package);
- `@beep/repo-cli#build` and `#check` gain `@beep/repo-workspaces#build`; `#test` and `#transit` gain
  `@beep/repo-workspaces#transit`;
- no task is removed. The only dependent of `@beep/repo-cli` among the workspaces is `@beep/scratchpad`, whose closure
  gains the same one package.

The root subject (`//`) drifts on one tuple, `//#lint:policy-fingerprint`, as a consequence of the same edge:
`bun run beep lint policy-fingerprint --write` adds `packages/tooling/library/repo-workspaces/{package.json,src/**}`
to the fingerprinted policy-tool closure in `standards/policy-tools.fingerprint.json` and to that task's `inputs` in
`turbo.json`, because the package is now reachable from repo-cli. No other `turbo.json` key changes.

This request re-records the baseline for the `@beep/repo-cli` and `//` subjects only. No qualification is granted, and
no other subject changes.
