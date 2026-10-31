# Cache baseline review: roadmap PR R3a (`@beep/schema/Jsonc` owner switch)

Reviewed 2026-10-31 for roadmap PR R3a of `goals/effected-promotion` (SPEC W4-o, W4-h and W4-i, R3a
parts; map sites #1 and #255).

`bun run beep quality cache-policy` reported 11 blocking findings, all introduced by this branch and
all of one kind: configuration drift on `@beep/repo-cli` (`#build`, `#check`, `#doctest`,
`#lint:deprecated-apis`, `#test`, `#test:property`) and on `@beep/lint-rules` (`#build`, `#check`,
`#lint:deprecated-apis`, `#test`, `#test:property`).

Three manifests change:

- `packages/tooling/tool/cli/package.json` gains the regular dependency `"@beep/jsonc": "workspace:^"`:
  every former `@beep/schema/Jsonc` importer in repo-cli (20 source files, three test files) and the
  four callers of the facade's `decodeJsoncTextAs` re-export now decode through
  `Jsonc.bind(schema).decode`. `jsonc-parser` stays a repo-cli dependency for the editing facade
  (`internal/cli/Jsonc.ts`); R3b removes it.
- `packages/tooling/policy-pack/lint-rules/package.json` gains the devDependency
  `"@beep/jsonc": "workspace:^"` for `test/registry.test.ts`, the one test that decoded the Biome
  plugin configs through the facade.
- `packages/foundation/modeling/schema/package.json` drops the dependency `"jsonc-parser": "catalog:"`
  and the `./Jsonc` entries of `exports` and `publishConfig.exports`, because `src/Jsonc.ts` and its
  test are deleted. `cache-policy` reports no drift for `@beep/schema`.

No scripts block changes (`bun run beep lint package-scripts` is unchanged), no `turbo.json` changes,
and no third-party package enters: `bun.lock` gains the two workspace edges and loses the
`@beep/schema` -> `jsonc-parser` edge from a plain `bun install`. `bun run beep tsconfig-sync --write`
regenerated both packages' `tsconfig.json` and `tsconfig.check.json` references (one added each), the
root `tsconfig.json` and `vitest.aliases.generated.json` (the `@beep/schema/Jsonc` alias removed) and
`standards/fallow.boundaries.generated.jsonc`.

Turbo coupling, measured with `bunx turbo run build check test --filter=<pkg> --dry=json` on the
unchanged base revision and on this branch:

- `@beep/repo-cli`: 144 tasks before and after, identical task ids. `@beep/jsonc` was already upstream
  of repo-cli through `@beep/repo-tsconfig`, so the edge becomes direct and no package enters the
  closure.
- `@beep/lint-rules`: 19 -> 21 tasks; the closure gains exactly `@beep/jsonc#build` and
  `@beep/jsonc#transit`. Every dependency of `@beep/jsonc` (`@beep/identity`, `@beep/schema`,
  `@beep/utils`, `effect`) was already in the lint-rules closure.
- `@beep/schema` loses a third-party dependency and no task; its dependents' closures are unchanged.

`bun run beep lint policy-fingerprint` reports the fingerprint current (the `@beep/jsonc` sources were
already in the policy-tool closure through `@beep/repo-tsconfig`).

This request re-records the baseline for the `@beep/repo-cli` and `@beep/lint-rules` subjects only. No
qualification is granted, and no other subject changes.

## Re-record after merging `origin/main` b30cd9e6dd (2026-10-31, review round 1)

The review round merged `origin/main` b30cd9e6dd (R2b #2381, G4 per-task policy fingerprint seals #2390, the
repo-cli coverage shard split #2392) into the lane. The merge took `main`'s baseline, so the R3a review above
is applied again on top of it with the same manifests and the same reason. `bun run beep quality cache-policy`
on the merged tree reported configuration drift on `@beep/repo-cli` only (`#check`, `#doctest`,
`#lint:deprecated-apis`, `#test`, `#test:property`) and, once `bun run beep lint policy-fingerprint --write`
re-sealed the root `//#lint:policy-fingerprint:*` tasks for the changed repo-cli dependency closure, source
drift on the root `turbo.json`; the root `//` joins the subjects, and the `@beep/lint-rules` subject is kept so
the recorded review still names both manifests the PR changes. No qualification is granted.
