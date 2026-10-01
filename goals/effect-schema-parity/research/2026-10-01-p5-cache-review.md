# P5 cache baseline review (2026-10-01)

The P5 statics retirement removed the last `@beep/schema` import from two
packages, so their manifests drop the `@beep/schema` workspace dependency
(`bun run beep quality knip` reported both as unused):

- `@beep/architecture-lab-use-cases` (`packages/architecture-lab/use-cases`)
- `@beep/workspace-use-cases` (`packages/workspace/use-cases`)

`bun run beep tsconfig-sync` dropped the matching project reference from each
package's `tsconfig.json` and `tsconfig.check.json`. `bun run beep cache audit`
then reported `configuration-drift` for the five cached tasks of each package
(`build`, `check`, `lint:deprecated-apis`, `test`, `test:property`): their
recorded dependency graph lost one upstream package. No task input, output,
environment key or cache policy changed; the drift is the narrower dependency
closure only. The baseline is re-recorded with `cache baseline --request`
(request kept outside the repo), with scope, profile and epoch copied from the
committed baseline.
