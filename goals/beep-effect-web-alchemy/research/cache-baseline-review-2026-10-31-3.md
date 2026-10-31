# Cache baseline review addendum 2: main merge after #2376 (2026-10-31)

Follows [`cache-baseline-review-2026-10-31.md`](cache-baseline-review-2026-10-31.md)
and [`-2.md`](cache-baseline-review-2026-10-31-2.md). Merging `origin/main` at
`3fbb6e614b` (#2376, graft retirement) conflicted in
`standards/cache-qualification-baseline.json`. The conflict was resolved by taking
main's baseline and re-recording this branch's subjects on top of it, then running
`bun run beep lint policy-fingerprint --write`. Seal input changes relative to main:

- Removed: `packages/tooling/tool/cli/src/internal/GlobPattern.ts` (deleted by #2381),
  `packages/tooling/tool/cli/src/commands/Graft/Graft.schemas.ts` and
  `packages/foundation/modeling/schema/src/UnitInterval.ts`. These left the import
  closures with #2376. Main's committed seal still listed them, so this part is inherited.
- Added: `packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocNodes.ts`
  (inherited closure change) and `apps/beep-effect-web/package.json` (this
  branch's new app).

Drifted subjects:

- `//`: the seven `//#lint:policy-fingerprint*` tasks.
- `@beep/beep-effect-web`: all seven scaffold tasks (`#build`, `#check`, `#lint`,
  `#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws`, `#test`). They are first entries
  again, because main's baseline does not carry this branch's earlier record. Commands,
  outputs, env and cache flags come from the scaffold unchanged.

No qualification is granted, and scope, profile and epoch are copied unchanged.
