# Cache baseline review: wave 3-A7 (repo-cli `TsconfigSync.schemas` onto `@beep/tsconfig`)

Reviewed 2026-10-27 for PR 3-A7 of `goals/effected-promotion` (wave-4 plan PR sequence).

`bun run beep quality cache-policy` reported 6 blocking findings, all introduced by this branch and all of one kind:
configuration drift on `@beep/repo-cli`, on six task tuples (`#build`, `#check`, `#doctest`, `#lint:deprecated-apis`,
`#test`, `#test:property`).

The cause is one manifest edit: `packages/tooling/tool/cli/package.json` gains the regular dependency
`"@beep/tsconfig": "workspace:^"`, because `TsconfigSync/TsconfigSync.plan.ts` now decodes tsconfig documents through
`@beep/tsconfig/TsconfigJson`. Until now repo-cli reached the package only through `@beep/repo-tsconfig`. The scripts
block is unchanged. `bun run beep tsconfig-sync --write` added the matching project reference to the package
`tsconfig.json` and `tsconfig.check.json` and regenerated `standards/fallow.boundaries.generated.jsonc`; `bun.lock`
records the new workspace edge. No third-party dependency is added.

Turbo coupling, measured with `bunx turbo run build check test --filter=@beep/repo-cli --dry=json` on this lane with
and without the manifest line (142 tasks before, 142 after):

- no task is added or removed: `@beep/tsconfig#build` and `#transit` were already in the graph through
  `@beep/repo-tsconfig`;
- `@beep/repo-cli#build` and `#check` gain the direct edge `@beep/tsconfig#build`; `#test` and `#transit` gain
  `@beep/tsconfig#transit`.

The root subject (`//`) does not drift: `bun run beep lint policy-fingerprint --write` leaves
`standards/policy-tools.fingerprint.json` and `turbo.json` unchanged, because `@beep/tsconfig` was already in the
fingerprinted policy-tool closure.

This request re-records the baseline for the `@beep/repo-cli` subject only. No qualification is granted, and no other
subject changes.
