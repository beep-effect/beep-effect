# Verification route opportunities

## Layer 1 root external dependencies prevent catalog isolation

- Work: compile the catalog refinement into Turbo 2.11.10 task inputs with
  `futureFlags.globalConfiguration` enabled.
- Evidence: `turbo run build check lint --dry=json` on an isolated tracked-tree
  copy, before and after replacing the root manifest global input with the
  projection. A Biome 2.5.6 to 2.5.7 catalog and lockfile hash probe invalidated
  194 build, 194 check and 194 lint tasks in both configurations. The root
  external-dependency hash changed from `b55570e5294f5588` to
  `22c9ab0f0746d8e8`. Root devDependencies includes Biome. Packet markdown
  invalidated zero tasks in both configurations.
- Source: [Turbo caching documentation](https://turborepo.dev/docs/crafting-your-repository/caching)
  documents workspace-root lockfile dependency changes as global cache misses.
- Prevention: prove root external-dependency hashing before adopting a
  lockfile-locality assumption. Replacing file inputs cannot exclude root
  dependencies from Turbo's global external-dependency hash. The opt-in
  `BEEP_LAYER1_DRYRUN=1` integration fixture retains the intended zero-build /
  zero-check acceptance assertion; it currently fails and must not be cited as
  accepted. The lockfile mutation is a hash probe, not an install or registry
  integrity validation.
