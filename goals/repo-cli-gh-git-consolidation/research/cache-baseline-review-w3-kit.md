# Cache baseline review: W3 kit (`@beep/github` down-scoped installation tokens)

Reviewed 2026-11-02 for the W3 kit PR of `goals/repo-cli-gh-git-consolidation` (#2556).

After `bun run beep lint policy-fingerprint --write`, `bun run beep quality cache-policy` reported 3 blocking
findings, all introduced by this branch and all configuration drift on the root's policy-fingerprint seals:
`//#lint:policy-fingerprint:goals-doctor`, `:knowledge` and `:quality`.

The cause is one import. `packages/drivers/github/src/GitHubApp.ts` now imports `TokenPermissions.fromGitHub` for
the new `assertPermissions` (fail closed when GitHub grants less than a down-scoped token request asked for), so
`packages/drivers/github/src/TokenPermissions.ts` enters the closure of the three policy tasks that already reached
`GitHubApp.ts`. The fingerprint write adds that one input to each of the three seals in `turbo.json` and
`standards/policy-tools.fingerprint.json`. No package manifest changes and no dependency is added or removed
(`TokenPermissions.ts` is a module of the same package).

Recording the root subject accepts the existing posture for the three re-sealed tasks. No qualification is granted,
and no other subject changes.
