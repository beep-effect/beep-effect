# Cache baseline review: graft retirement (2026-10-28)

`bun run beep cache audit` on `chore/retire-graft` reported one blocking
finding, `global-configuration-drift: turbo-global-configuration`, plus the
`configuration-source-drift: turbo.json` review row. No package subject drifted.

The changed input is the root `turbo.json` only:

- `globalPassThroughEnv` drops `GRAFT_CRUX_MODULE` and `GRAFT_EXTRACT_MODULE`.
  They named Node modules of the retired graft deep-build patch kit, which no
  task reads any more.
- Five task input globs drop the `!graft/**` exclusion. The `graft/` cache
  directory is no longer created or ignored, so the exclusion matches nothing.

Both edits remove references to a tool that no longer exists. They change no
task command, output, or dependency, and grant no qualification. Subject
recorded: `//` (root global configuration).
