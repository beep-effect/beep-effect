# Types lint toolchain-key preparation

The dependency-free `@beep/types#lint` task remains uncached. Its child configuration now declares `BEEP_CACHE_TOOLCHAIN_DIGEST` as a hashed task environment input, preparing the existing runtime-key guard for a future types-specific pilot.

## Actual native plan evidence

At source `ff3970ddf0c0848d65830d60af080ad903ed4b6a` with only the reviewed child-config overlay, eight metadata-only native calls compared two synthetic digest values before and after the declaration using pinned Turbo 2.11.10 and 2.11.11-canary.1. Both clients ignored the undeclared digest change before the edit and changed the task hash after the declaration. Input paths, command, dependency closure and outputs were preserved; the child `turbo.json` was the only file input whose content hash changed. The task has no dependency tasks and caching stayed disabled in every plan.

[The machine-readable receipt](types-lint-toolchain-key-2026-11-06.json) binds native binary digests, raw-plan digests, source and configuration identities, observations and resource bounds. Raw plans remain private. The only configuration edit adds the hashed environment declaration; root configuration, workspace scripts and experimental flags are unchanged.

## Limits and next work

These were native `--dry=json` plans: no lint task, quality suite or remote cache operation ran, no credential was loaded, and no speedup or qualification is claimed. Declaring the input does not enforce or validate the digest at ordinary execution boundaries. The existing pilot requires a reviewed installed-toolchain identity; types still needs its own scanner scope, invalidation, output/log, cross-root, concurrency and shadow evidence before a qualification transition. Production signing and remote producer approval remain separate prerequisites.

The environment behavior follows the installed Turbo documentation in `node_modules/turbo/docs/crafting-your-repository/using-environment-variables.mdx`: task `env` values contribute to the task hash. The receipt records exact client identities rather than asserting a latest-version lookup.

Reverse by removing this declaration or reverting the change. Cache eligibility and qualification state are unaffected by either action.
