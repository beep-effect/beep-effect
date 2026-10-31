# Cache baseline review addendum 3: main merge at e733f61bbb (2026-10-31)

Follows [`-3.md`](cache-baseline-review-2026-10-31-3.md). Merging `origin/main` at
`e733f61bbb` (#2378, #2384, #2405) conflicted again in
`standards/cache-qualification-baseline.json`. I took main's baseline and re-recorded
this branch's subjects on top of it. Main now carries current seals, so after
`bun run beep lint policy-fingerprint --write` the only seal input change relative
to main is `apps/beep-effect-web/package.json` joining the workspace-manifest inputs.

Drifted subjects:

- `//`: `//#lint:policy-fingerprint`, which gains the new app manifest input.
- `@beep/beep-effect-web`: the seven scaffold tasks, which main's baseline does not carry,
  recorded as first entries with commands, outputs, env and cache flags unchanged
  from the scaffold.

No qualification is granted, and scope, profile and epoch are copied unchanged.
