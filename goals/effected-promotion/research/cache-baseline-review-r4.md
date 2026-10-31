# Cache baseline review: roadmap PR R4

Reviewed 2026-10-31 for roadmap PR R4 of `goals/effected-promotion` (the npm `yaml` package leaves the repo-cli and
`@beep/repo-ai-metrics` runtime dependencies, W4-h).

`bun run beep quality cache-policy` reported 5 blocking findings, all introduced by this branch and all of one kind:
configuration drift for `@beep/repo-ai-metrics` on five task tuples (`#build`, `#check`, `#lint:deprecated-apis`,
`#test`, `#test:property`).

The cause is one manifest edit. `@beep/repo-ai-metrics` drops the third-party `yaml` dependency and gains
`@beep/yaml` as a workspace dependency, because `compose.ts` now renders the local Phoenix compose file through the
`@beep/yaml` stringifier. The scripts block does not change (`bun run beep lint package-scripts` reports 0 drifting
manifests), and no third-party dependency is added. The `tsconfig.json` and `tsconfig.check.json` project references
to `yaml`, `standards/fallow.boundaries.generated.jsonc` and `bun.lock` edits only record that one workspace edge and
the two removed `yaml` entries.

`@beep/repo-cli` drops `yaml` from its dependencies too; it already depended on `@beep/yaml` directly, and the policy
reports no drift for it.

The root (`//`) does not change. `bun run beep lint policy-fingerprint --write` leaves
`standards/policy-tools.fingerprint.json` and `turbo.json` byte-identical.

## Turbo coupling

Measured on this branch after merging `origin/main` d5ac507ae3 by walking the workspace dependency closure
(dependencies, devDependencies, peer and optional, `workspace:` specifiers only) of every manifest, with and without
the new `@beep/repo-ai-metrics` -> `@beep/yaml` edge:

- `@beep/repo-ai-metrics` gains no upstream package: `@beep/yaml` was already in its closure transitively.
- No other workspace's closure changes. The dependents of `@beep/repo-ai-metrics` (`@beep/infra`, `@beep/palantiri`,
  `@beep/repo-cli`, `@beep/scratchpad`) already reached `@beep/yaml`.

No closure grows; only the edited manifest's bytes move.

Recording this subject accepts the existing posture for the edited manifest. No qualification is granted, and no other
subject changes.
