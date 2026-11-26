# P6 retire infra/: cache review

`goals/infra-alchemy-rebuild` P6 deletes the root `infra/` workspace (the Pulumi programs and
`@beep/infra`). After that deletion, `bun run beep cache audit` reports blocking
`configuration-drift` findings on 37 root tasks and on every package's `#lint:deprecated-apis`,
plus `configuration-source-drift` on `turbo.json` and on the deleted `infra/turbo.json`. Each
input change is listed below.

- Every package's `#lint:deprecated-apis`: the task's global inputs named
  `$TURBO_ROOT$/infra/**/tsconfig*.json` and `$TURBO_ROOT$/infra/package.json`. Both entries are
  removed, because nothing under `infra/` exists.
- Root `//` tasks (`//#lint:*`, `//#fallow:*`, `//#repo-sanity:*`, `//#jsdoc:*`,
  `//#check:model-first-slices`, `//#config-sync:check`, `//#goals:index-check`,
  `//#topo-sort`): each drops its `infra/` input globs (`infra/**`, `infra/package.json`,
  `infra/**/*.ts` and similar), or drops `infra` from a brace list such as
  `{apps,packages,infra}`. The command scan scopes in `@beep/repo-cli` drop the same root in the
  same change, so each task's inputs still match what its command reads.
- `@beep/infra`: the subject is deleted with the package.
- `turbo.json` source digest: changes for the edits above. `infra/turbo.json` is deleted.

No cache flag, output, environment or dependency edge changed for any remaining task, and no
cache qualification is granted.
