# Cache baseline review: closeout PR C

Reviewed 2026-11-01 for the closeout PR C of `goals/effected-promotion` (the effected lab leaves
`scratchpad/`, W4-m and W4-n).

`bun run beep quality cache-policy` reported 1 blocking finding, introduced by this branch: configuration drift for
`@beep/scratchpad#docgen`.

The cause is one manifest edit. `scratchpad/package.json` drops the six `*:effected` scripts and the 44 dependencies
that only the deleted lab imported: 26 `@beep/*` workspace entries (`cli-kit`, `commands`, `config-file`, `git`,
`github`, `github-commands`, `github-references`, `github-reporting`, `glob`, `jsonc`, `lockfiles`,
`managed-section`, `markdown`, `memfs`, `npm-spec`, `package-json`, `repo-tsconfig`, `repo-workspaces`,
`runtime-env`, `sbom`, `semver`, `spdx`, `toml`, `tsconfig`, `walker`, `yaml`), the devDependency `@beep/fc-runs`,
and the third-party `@pnpm/catalogs.*` (4), `@sigstore/bundle`, `@sigstore/sign`, `ink`, `react`,
`@typescript/native`, `minimatch`, `oxc-parser`, `smol-toml`, `spdx-exceptions`, `spdx-expression-parse`,
`spdx-license-ids`, `string-width` and `ts-morph`. Before the edit each one was checked against every remaining
scratchpad file (`scratchpad/beep`, `scratchpad/effect-ontology`, `scratchpad/party`, `scratchpad/test/beep`, the
probes): none imports it, and at the parent commit only lab files did. No dependency is added. The `docgen` script
and the other scratchpad scripts are unchanged, and `bun run beep lint package-scripts` reports 0 drifting
manifests. `scratchpad/tsconfig.json` loses the 27 project references `tsconfig-sync` prunes for the removed
workspace edges, and `standards/fallow.boundaries.generated.jsonc` and `bun.lock` record the same edges and the
removed third-party entries.

`scratchpad/docgen.json` drops two excludes that named deleted files (`vitest.effected.config.ts`,
`effected/.canary/**`); the docgen source set does not change, because both paths no longer exist.

The root (`//`) manifest does not change. `bun run beep lint policy-fingerprint` reports `current`.

## Turbo coupling

Measured on this branch against `origin/main` bb2134fcb952e07580c4cebf2586c901f090ef5b. The walk covers the
workspace dependency closure (dependencies, devDependencies, peer and optional, `workspace:` specifiers only) of
every manifest at both commits:

- `@beep/scratchpad` loses one package from its closure: 95 workspaces before, 94 after. Of the 27 direct
  workspace edges removed (26 dependencies and the `@beep/fc-runs` devDependency), 26 stay reachable through the
  remaining dependencies; only `@beep/github-references` leaves the closure.
- No workspace depends on `@beep/scratchpad`, so no other closure changes.
- The lab manifest `scratchpad/effected/sbom/package.json` (`@effected/sbom`, not a bun workspace member) is gone
  with the lab.

The closure shrinks and only the edited manifest's bytes move. Recording this subject accepts the existing posture
for the edited manifest; it replaces the subject's review recorded on main
(`goals/tsrs-gates/research/cache-baseline-review-2026-10-26.md`), whose tsrs command changes the merged manifest
keeps. No qualification is granted, and no other subject changes.
