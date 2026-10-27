# Cache baseline review: roadmap PR R9

Reviewed 2026-10-25 for roadmap PR R9 of `goals/effected-promotion` (the four drivers onto `@beep/commands`, W4-l).

`bun run beep quality cache-policy` reported 17 blocking findings, all
introduced by this branch and all of one kind: configuration drift on four
task tuples (`#build`, `#check`, `#lint:deprecated-apis`, `#test`) for each of
`@beep/exiftool`, `@beep/obs`, `@beep/pdf-tools` and `@beep/tailscale`, and on
`//#lint:policy-fingerprint`.

The cause is four manifest edits, one line each: every driver gains
`@beep/commands` as a workspace dependency, because exiftool, pdf-tools and
tailscale now collect their child processes through `Run.collect` and obs
spawns OBS detached through `Run.detach`. No scripts block changes
(`bun run beep lint package-scripts` reports 0 drifting manifests), and no
third-party dependency is added. The `tsconfig.json` and
`tsconfig.check.json` project references to `commands`,
`standards/fallow.boundaries.generated.jsonc` and `bun.lock` edits only record
those four workspace edges.

The root (`//`) drift is the policy fingerprint. `@beep/repo-cli` depends on
`@beep/exiftool`, `@beep/obs` and `@beep/pdf-tools`, so its fingerprinted
closure now reaches `@beep/commands`: `bun run beep lint policy-fingerprint
--write` adds `packages/drivers/commands/package.json` and
`packages/drivers/commands/src/**` to `standards/policy-tools.fingerprint.json`
and to the `//#lint:policy-fingerprint` inputs in `turbo.json`. Nothing else in
the root manifest or `turbo.json` changes.

## Turbo coupling

Measured on this branch against its base `origin/main` 35faa4a00d, by walking
the workspace dependency closure (dependencies, devDependencies, peer and
optional, `workspace:` specifiers only) of every manifest before and after:

- `@beep/exiftool`, `@beep/obs`, `@beep/pdf-tools` and `@beep/tailscale` each
  gain one upstream package, `@beep/commands`, whose own dependencies
  (`@beep/identity`, `@beep/schema`, `@beep/utils`) each already had
  (tailscale through `@beep/schema`).
- Their dependent `@beep/repo-cli` gains the same one package. No other
  workspace's closure grows, and none shrinks.

Five closures grow by one package each; nothing else moves.

Recording these subjects accepts the existing posture for the four edited
manifests and the root. No qualification is granted, and no other subject
changes.
