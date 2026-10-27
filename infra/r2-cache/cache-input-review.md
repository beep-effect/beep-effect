# Effect-import cache input correction

Reviewed subject: `//#lint:effect-imports`.

The Effect import source scanner already excludes `**/dist` and everything below
it through `CODE_EXCLUSION_GLOBS` in `commands/Laws/EffectImports.ts`. Turbo's
input list included those generated JavaScript and declaration files. A built
workstation therefore hashed files that the source check never examines, while
a clean CI checkout omitted them.

Add `!**/dist/**` to this task's inputs so its cache key follows the existing
scanner boundary. No task becomes cacheable, no source files leave the scan,
and the cache qualification scope, profile and epoch stay unchanged.

The regression check used the actual Turbo dry-run hasher: adding a generated
file under a foundation package's `dist` directory preserved the task hash;
adding a source file under that package's `src` directory changed it. Both probe
files were removed afterward. Generated Next.js and Storybook inputs remain
unchanged because the scanner currently examines those paths; this correction
does not widen its exclusion policy.

Only the named subject's configuration changed. The baseline source digest changes
because `turbo.json` changed; it grants no new qualification.
