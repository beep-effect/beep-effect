# Cache review for the `@beep/mcpb-kit` XDG dependency (2026-11-22)

Branch `t3/mcpb-kit-output-outside-dist` (PR #3484), based on `main` @ dcbc144e150. Reviewer: Claude
Opus 5.5 (mcpb-kit output lane).

`bun run beep cache audit` reports four blocking `configuration-drift` findings, all in
`@beep/mcpb-kit`: `build`, `check`, `lint:deprecated-apis` and `test`, and one advisory
`configuration-source-drift` for `turbo.json` in the root subject `//`.

## Cause

`@beep/mcpb-kit` now resolves its Windows download cache under the XDG cache home through
`@beep/xdg/XdgBase`. Its manifest gains the `@beep/xdg` workspace dependency, and
`bun run beep tsconfig-sync` adds the matching project references. The dependency adds the
`@beep/xdg#build` and `#transit` upstream edges to the package's tasks, and the manifest bytes
the package's review basis includes change.

`//` (root, inherited): `turbo.json` on `main` (sha256 `1565194a19c7…`, last changed by #3458,
bc49cb63651) differs from the source digest `_root.json` records (`87a78b2ac488…`). This branch does
not touch `turbo.json`; the baseline writer re-records every subject whose recorded configuration
is stale, so `//` is re-recorded here with only that source digest changed.

## Judgement

No task command, cache flag, output glob or environment variable changed. The edit only adds a
manifest dependency and upstream edges. Recording the new configuration grants no qualification.

## Reversal

Remove the `@beep/xdg` dependency from `packages/tooling/library/mcpb-kit/package.json`, rerun
`bun install` and `bun run beep tsconfig-sync`, and re-record the `@beep/mcpb-kit` subject. The root source digest tracks `turbo.json` on `main`
and needs no reversal.
