# Cache baseline review: roadmap PR R5a

Reviewed 2026-10-28 for roadmap PR R5a of `goals/effected-promotion` (typed
frontmatter adoption in `@beep/repo-cli`, SPEC W4-g, W4-h and W4-i, R5a parts).

`bun run beep quality cache-policy` reported 6 blocking findings, all
introduced by this branch and all of one kind: configuration drift on
`@beep/repo-cli` task tuples (`#build`, `#check`, `#doctest`,
`#lint:deprecated-apis`, `#test`, `#test:property`).

The only manifest edit is one runtime dependency: `@beep/repo-cli` gains
`@beep/yaml` (`workspace:^`), because `DeletePackage` now removes a package
key from a changeset's frontmatter through `YamlFormat.modifyToString`. The
scripts block is unchanged (`bun run beep lint package-scripts` reports 0
drifting manifests), and so is `packages/tooling/tool/cli/turbo.json`. No
third-party package enters: `bun.lock` gains only the workspace edge, from a
plain `bun install`. The generated `tsconfig.json` and `tsconfig.check.json`
references and `standards/fallow.boundaries.generated.jsonc` were regenerated
by `bun run beep tsconfig-sync`.

Turbo coupling: no closure grows. `@beep/yaml` was already upstream of
`@beep/repo-cli` through `@beep/markdown` (a repo-cli runtime dependency that
lists `@beep/yaml` among its own runtime dependencies); the edge becomes
direct, so the recorded repo-cli task tuples now name `@beep/yaml#build`,
`#transit` and `#audit` among their direct dependencies (nine lists in the
baseline: one `#audit`, three `#build` and five `#transit`), and no
package enters any closure that did not already reach it. `@beep/yaml` itself
is unchanged. No other workspace's dependencies change, and
`bun run beep lint policy-fingerprint` reports the fingerprint current.

Recording this subject accepts the existing posture for `@beep/repo-cli` with
its one new direct dependency. No qualification is granted, and no other
subject changes.
