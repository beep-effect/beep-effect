# Cache baseline review: adoption PR 4-A4 (repo-cli `EcosystemPolarity` adopts `SourceBoundary.scan`)

Reviewed 2026-10-28 for adoption PR 4-A4 of `goals/effected-promotion` (wave-4 plan PR sequence, W4-f; map site
#154).

`bun run beep quality cache-policy` reported 7 blocking findings, all introduced by this branch and all of one kind:
configuration drift on `@beep/repo-cli`, on six task tuples (`#build`, `#check`, `#doctest`, `#lint:deprecated-apis`,
`#test`, `#test:property`), and on the root tuple `//#lint:policy-fingerprint`.

The cause is one manifest edit: `packages/tooling/tool/cli/package.json` gains the regular dependency
`"@beep/repo-workspaces": "workspace:^"`, because `commands/Lint/EcosystemPolarity.ts` now scans each ecosystem
member's `src` through `SourceBoundary.scan` from `@beep/repo-workspaces/SourceBoundary` instead of its own ts-morph
walk. The scripts block is unchanged. `bun run beep tsconfig-sync --write` added the matching project reference to the
package `tsconfig.json` and `tsconfig.check.json` and regenerated `standards/fallow.boundaries.generated.jsonc`;
`bun.lock` records the new workspace edge. No third-party dependency is added, and `ts-morph` stays a repo-cli
dependency because other repo-cli files import it.

Turbo coupling, measured with `bunx turbo run build check test --filter=@beep/repo-cli --dry=json` on this lane with
and without the manifest line (142 tasks before, 144 after):

- added tasks: `@beep/repo-workspaces#build` and `@beep/repo-workspaces#transit`. Every regular dependency of
  `@beep/repo-workspaces` (`@beep/commands`, `@beep/git`, `@beep/glob`, `@beep/identity`, `@beep/lockfiles`,
  `@beep/npm-spec`, `@beep/package-json`, `@beep/schema`, `@beep/semver`, `@beep/utils`, `@beep/walker`,
  `@beep/yaml`) was already in repo-cli's closure, so the workspace closure gains exactly one package;
- `@beep/repo-cli#build` and `#check` gain `@beep/repo-workspaces#build`; `#test` and `#transit` gain
  `@beep/repo-workspaces#transit`;
- no task is removed. The only dependent of `@beep/repo-cli` among the workspaces is `@beep/scratchpad`, which
  already depends on `@beep/repo-workspaces` directly (its lab suites import the testing cluster), so its closure is
  unchanged.

The root subject (`//`) drifts on one tuple, `//#lint:policy-fingerprint`, as a consequence of the same edge:
`bun run beep lint policy-fingerprint --write` adds `packages/tooling/library/repo-workspaces/{package.json,src/**}`
to the fingerprinted policy-tool closure in `standards/policy-tools.fingerprint.json` and to that task's `inputs` in
`turbo.json`, because the package is now reachable from repo-cli. `//#lint:ecosystem-polarity` itself keeps its
inputs (`packages/ecosystem/*/package.json`, `packages/ecosystem/*/src/**/*.{ts,tsx,mts,cts}`) and its dependency on
`//#lint:policy-fingerprint`; the scanner moving into `@beep/repo-workspaces` is covered by that fingerprint. No other
`turbo.json` key changes.

This request re-records the baseline for the `@beep/repo-cli` and `//` subjects only. No qualification is granted, and
no other subject changes.
