# Infra check cache output review

`infra/turbo.json` adds `dist/tsconfig.tsbuildinfo` to the outputs of
`@beep/infra#check`. The check invokes `tsrs -b tsconfig.json`, which inherits
`${configDir}/dist/tsconfig.tsbuildinfo` from `tsconfig.base.json`. The workspace
output list also includes the root task's `.beep/gates/check/**` glob because
Turbo uses the workspace list in place of the inherited one. A cache hit can
therefore restore both the check record and the compiler's build info.

The cache audit reports configuration drift for `@beep/infra#check` and
source drift for `infra/turbo.json`. The baseline update records the output
under `@beep/infra` and the configuration file's digest under the root subject
(`//`). Both retain the existing scope, runtime profile, and epoch.
