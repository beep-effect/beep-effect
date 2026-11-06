# Cache baseline review: generator check mode through codegen-kit (#2686, 2026-11-06)

#2686 (`f2f95e69b5`, `fix(codegen): preserve generated sources during drift checks`) merged
without re-recording the cache baseline. On `main` at `7484d606e6`, `bun run beep cache audit`
reports 18 `configuration-drift` blocks across two subjects and nothing else that blocks:

- `@beep/html`: `build`, `check`, `docgen`, `doctest`, `lint`, `lint:deprecated-apis`,
  `lint:jsdoc`, `lint:laws`, `test`, `test:property`
- `@beep/technical-drawing`: `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`,
  `lint:jsdoc`, `lint:laws`, `test`

## What changed

Both subjects changed in the same way in #2686:

- **Manifest bytes** (`package.json`). A new `@beep/codegen-kit` (`workspace:^`) dependency, and the
  `generate:check` script now calls the generator's own `--check` mode
  (`bun run scripts/generate.ts --check` for `@beep/html`,
  `bun run scripts/generate-label-glyphs.ts --check` for `@beep/technical-drawing`) instead of
  regenerating and running `git diff --exit-code`. `generate:check` is not a cached task, but every
  task whose review basis includes the subject's manifest drifts with its bytes.
- **Project references** (`tsconfig.json`, `tsconfig.check.json`). A reference to
  `../../../tooling/library/codegen-kit/tsconfig.json`, which matches the new dependency.

The baseline also rejects the request unless the root subject `//` is reviewed, because root
`turbo.json` changed after the last re-record (#2511, `96a7698b63`):

- **`//`**: #2702 and #2704 added `packages/tooling/library/repo-cli-kit/src/cli/Jsonc.ts` and
  `packages/tooling/tool/cli/src/commands/Goals/{Decisions.projection,Decisions.schemas,ManifestProjection}.ts`
  to the `inputs` of the two policy-fingerprint seals
  `@beep/repo-cli#lint:policy-fingerprint:goals-doctor` and
  `@beep/repo-cli#lint:policy-fingerprint:knowledge`. These are the files those PRs imported into the
  `goals doctor` and knowledge policy closures, written by `lint policy-fingerprint --write`. No task
  was added or removed, and no other key of any root task changed. The audit reports this as
  `REVIEW configuration-source-drift: turbo.json`.

No cached task's command, outputs, cache flag or env keys changed. This review re-records the legacy
posture of `@beep/html`, `@beep/technical-drawing` and `//` at the new manifest, tsconfig and
`turbo.json` bytes and grants no qualification.
