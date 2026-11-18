# Cache baseline review: @beep/storybook gains an Alchemy stack (2026-11-13)

Reviewer: Claude Fable 5.2 (`goals/infra-alchemy-rebuild-p3-storybook`). No qualification is granted.

The Storybook stack (`apps/storybook/alchemy.run.ts`) changes the `@beep/storybook` manifest, and the census
`commandDigest` hashes the whole scripts block, so `bun run beep quality cache-policy` reports
`configuration-drift` on every cached `@beep/storybook` computation: `build`, `check`, `lint`,
`lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `storybook:build` and `test`.

What changed in the manifest:

- a new script `storybook:build:site` (`storybook build -o site/storybook`), the build command the stack runs.
  It is not a Turbo task and takes part in no cached computation;
- `beep:lint` and `beep:lint:fix` name one more file, `alchemy.run.ts`, in their Biome file list;
- dependency `@beep/public-site` (the route slug and origin the stack reads) and dev dependencies `alchemy`,
  `@alchemy.run/aws`, `@alchemy.run/cloudflare`;
- `vercel.json` is deleted and `alchemy.run.ts` is added, both inside the package's default inputs.

`lint` has a real input change (one more linted file). The commands, outputs, environment and dependency edges
of `build`, `check`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `storybook:build` and `test` are
unchanged; they drift only through the shared scripts digest and the new workspace dependency. The stack's
upload directory `apps/storybook/site/` is gitignored, so it is in no task's inputs or outputs.

Re-recording `@beep/storybook` adopts the new digest. No task becomes cacheable, no exception row is added, and
scope, profile and epoch are unchanged.

## Root subject `//`, inherited from `main`

The baseline was last recorded at `3e822c71c5d` (#3242). Since then #3263, #3271, #3274 and #3276 regenerated
root `turbo.json`, which the audit reports as `REVIEW configuration-source-drift: turbo.json` on `main` itself,
and a re-record has to cover it. Comparing `turbo.json` at `3e822c71c5d` with this head, only the generated
`inputs` lists of ten root-declared tasks differ:
`@beep/repo-cli#lint:policy-fingerprint:goals-doctor`, `:knowledge`, `:lint-roadmap-refs`, `:quality`,
`:quality-bun-audit`, `:quality-changeset-graph`, `:quality-jsdoc-inventory`, `:quality-jsdoc-module-tags`,
`:quality-jsdoc-ratchet` and `:quality-tsgo-rules`. The lists follow source files those PRs added, moved or
removed under `packages/tooling/tool/cli/src/commands/{Ci,Goals,Quality,Yeet}`, `packages/drivers/github/src`
and `packages/foundation/modeling/glob/src`. No task was added or removed, and no command, output, environment
or dependency edge changed. This lane's diff does not touch `turbo.json`.
