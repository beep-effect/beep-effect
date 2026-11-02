# Cache baseline review: W3 sites (Reviewer and Ci onto `@beep/github`, secret spawns onto `@beep/commands`)

Reviewed 2026-11-02 for the W3 sites PR of `goals/repo-cli-gh-git-consolidation` (SPEC D-12).

After `bun run beep lint policy-fingerprint --write`, `bun run beep cache audit` reported 10 blocking findings, all
introduced by this branch and all configuration drift, on two subjects.

Root (`//`), four tasks: `//#lint:policy-fingerprint`, `//#lint:policy-fingerprint:goals-doctor`, `:knowledge` and
`:quality`. The cause is one import. `packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts` now reads the
`gh auth token` and `op read` secrets through `@beep/commands` `Run.text`, so `packages/drivers/commands/src/Run.ts`
and the two modules it imports (`Redaction.ts`, `internal/capture.ts`), plus that package's manifest, enter the
closure of the three policy tasks that already reached `GithubIdentity.ts`. The fingerprint write adds those four
inputs to each of the three seals in `turbo.json` and `standards/policy-tools.fingerprint.json`, and adds
`packages/drivers/commands/src/**` to the `//#lint:policy-fingerprint` input list because repo-cli now depends on
the package.

`@beep/repo-cli`, six tasks: `#build`, `#check`, `#doctest`, `#lint:deprecated-apis`, `#test` and `#test:property`.
The cause is the manifest: `packages/tooling/tool/cli/package.json` adds `"@beep/commands": "workspace:^"` to
`dependencies` (the only manifest byte change), which changes the package's dependency closure, so every task whose
review basis is its own manifest drifts. `bun.lock` records the same workspace edge, and `beep tsconfig-sync` adds the
matching project reference to `tsconfig.json` and `tsconfig.check.json`.

Recording the two subjects accepts the existing posture for the ten drifted tasks. No qualification is granted, and
no other subject changes.
