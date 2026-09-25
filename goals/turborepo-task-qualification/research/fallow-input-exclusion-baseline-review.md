# Accept the `.fallow/` input exclusion and the turbo 2.11.3 schema bump

Commit `c9f36e36a1` (`perf(test): cache vitest transforms, share turbo cache,
unisolate coverage`, branch `@slop/09-22-26`) adds `!.fallow/**` beside
`!.beep/**` in the 14 of the 66 root `turbo.json` tasks that already excluded
`.beep/`, so the git-ignored Fallow scratch directory cannot invalidate those
tasks' hashes. Commit `849bf061ff` on the same branch bumps the `$schema` URL
from `v2-11-2` to `v2-11-3` through `version-sync` in the root file and in ten
workspace `turbo.json` files, five apps (`labs/api-docs`, `labs/ciops`,
`oip-web`, `professional-desktop`, `storybook`) and five packages
(`identity`, `types`, `ai-sync`, `repo-configs`, `cli`). Seven of the 14 tasks
are cached (`build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`,
`test`, `test:property`) and every package inherits them from the root
configuration, so against the prior baseline `beep quality cache-policy`
reports `configuration-drift` for 925 of the 1253 recorded cached computations
(every computation of those seven tasks except `@beep/api-docs#build`, whose
own root entry excludes neither directory) and `configuration-source-drift`
for the root file and all ten re-versioned workspace files.

No command, cache flag, output declaration, dependency edge or environment
declaration changed; the drift is one additional negative input glob in each
of the 14 tasks plus a schema URL that turbo does not hash into task inputs
(no cached computation outside those seven tasks drifted). Excluding a
git-ignored directory can only remove spurious invalidations, never hide a
real input.

Accept the re-hashed configurations in the legacy configuration baseline. This
review grants no runtime qualification. Retain the identity/types scope,
`local-linux-x64-bun1.4.2` profile and `qualification-v2` epoch; the
qualification ledger is untouched.
