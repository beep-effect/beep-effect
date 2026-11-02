# Cache baseline review: roadmap PR R3b

Reviewed 2026-11-01 for roadmap PR R3b of `goals/effected-promotion` (the npm `jsonc-parser` package leaves
`@beep/repo-cli`, `@beep/repo-configs` and the root devDependencies, W4-o and W4-h).

`bun run beep quality cache-policy` reported 5 blocking findings, all introduced by this branch and all of one kind,
configuration drift: four for `@beep/repo-configs` on its task tuples (`#check`, `#lint:deprecated-apis`, `#test`,
`#test:property`) and one for the root's `//#lint:policy-fingerprint:shared` (see "Root (`//`)").

The cause is one manifest edit. `@beep/repo-configs` drops the third-party `jsonc-parser` dependency and gains
`@beep/jsonc` as a workspace dependency, because `AllowlistJsoncTextToUnknown` now parses through
`Jsonc.parseResult` and its test formats through `JsoncFormatter`. The scripts block does not change, and no
third-party dependency is added. The `tsconfig.json` and `tsconfig.check.json` project references to `jsonc`,
`standards/fallow.boundaries.generated.jsonc` and `bun.lock` edits only record that one workspace edge and the
removed `jsonc-parser` entries.

The other manifest edits report no drift: `@beep/repo-cli` drops `jsonc-parser` (it already depended on
`@beep/jsonc`), the root drops its `jsonc-parser` devDependency (the catalog entry stays for the oracles), and
`@beep/jsonc` gains `jsonc-parser` as the devDependency of its `test/JsoncParserOracle.test.ts`.
These manifest edits leave the policy-tools seal alone; the one seal change in this branch is the root's, under
"Root (`//`)".

## Turbo coupling

Measured with `bunx turbo run <task> --dry=json` on this branch, rebuilt on `origin/main` bb2134fcb9 (R4 merged as
#2469), and on a sibling worktree of the base revision's manifests (`origin/main` plus the oracle only):

| Filter | Task | Tasks before | Tasks after | Added |
| --- | --- | ---: | ---: | --- |
| `@beep/repo-configs` | `check` | 11 | 12 | `@beep/jsonc#build` |
| `@beep/repo-configs` | `test` | 11 | 12 | `@beep/jsonc#transit` |
| `@beep/repo-configs` | `lint:deprecated-apis` | 14 | 15 | `@beep/jsonc#transit` |
| `@beep/repo-configs` | `test:property` | 11 | 12 | `@beep/jsonc#transit` |
| `@beep/oip-web` | `check`, `test`, `build` | 22 | 22 | none |

`@beep/jsonc`'s own dependencies (`@beep/identity`, `@beep/schema`, `@beep/utils`) were already in the
`@beep/repo-configs` closure, so the closure gains exactly `@beep/jsonc`. The two dependents of
`@beep/repo-configs` (`@beep/repo-cli` and `@beep/oip-web`) already reached `@beep/jsonc`, so no other workspace's
closure changes.

## Root (`//`)

Two later edits move the root. The root manifest gains `@beep/jsonc` as a devDependency (beside `@beep/glob`),
because `goals/schema-opaque-default/ops/codemod/run.ts`, which read its keep list through the removed root
`jsonc-parser` devDependency, now parses it through `Jsonc.parseResult`. And `@beep/jsonc` gains
`src/internal/lines.ts` (the line widening the formatter and the formatted modifier share), so
`bun run beep lint policy-fingerprint --write` adds that file to the `//#lint:policy-fingerprint:shared` inputs
in `turbo.json` and `standards/policy-tools.fingerprint.json`. `bun run beep quality cache-policy` then reports one
blocking finding, configuration drift for `//#lint:policy-fingerprint:shared`, and no other; `@beep/jsonc` was
already in the policy tools' closure, and `tsconfig-sync --check` reports no drift.

Recording these subjects accepts the existing posture for the edited manifests. No qualification is granted, and
no other subject changes.
