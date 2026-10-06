# Re-record the baseline after `//#config-sync:check` gained its generated-file inputs

`beep tsconfig-sync --check` (`config-sync:check`) now reads two files it
regenerates in write mode: `vitest.aliases.generated.json` and
`standards/fallow.boundaries.generated.jsonc` (PR #1477). The cached
`//#config-sync:check` task in the root `turbo.json` hashed only
`**/package.json`, `**/tsconfig*.json`, `**/docgen.json`,
`syncpack.config.ts` and `tsconfig.base.json`, so a commit that edits only a
generated file replayed the last green result and the drift surfaced on a
later, unrelated PR. The two paths are added to that task's `inputs`.

The projection records the input globs of every root task, so the re-record
moves exactly one node, `//#config-sync:check`, by two added input entries.
No command text, output declaration, environment key, dependency edge or
cache flag changed; no node is added or removed and no projection source
moved. The re-record also refreshes the advisory `configuration-source-drift`
digest of the root `turbo.json` that this edit changed.

Accept the widened `//#config-sync:check` inputs in the legacy configuration
baseline. This review grants no runtime qualification. Retain the current
identity/types/fc-runs/test-runner lint scope, `local-linux-x64-bun1.4.2`
profile and `qualification-v2` epoch; the qualification ledger is untouched.
