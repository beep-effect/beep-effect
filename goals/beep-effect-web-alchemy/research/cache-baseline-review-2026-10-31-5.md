# Cache baseline review addendum 4: main merge at 8afbd51a6c (2026-10-31)

Follows [`-4.md`](cache-baseline-review-2026-10-31-4.md). Merging `origin/main` at
`8afbd51a6c` conflicted again in `standards/cache-qualification-baseline.json` and
`standards/fallow.boundaries.generated.jsonc`. I took main's copies, then regenerated the
boundaries with `config-sync` and the seals with `lint policy-fingerprint --write`. The
only seal input change relative to main is still `apps/beep-effect-web/package.json`
joining the workspace-manifest inputs.

Drifted subjects:

- `//`: `//#lint:policy-fingerprint`, which gains the new app manifest input.
- `@beep/beep-effect-web`: the seven scaffold tasks, recorded as first entries again
  because main's baseline does not carry them.

Commands, outputs, env, cache flags and edges are unchanged. No qualification is
granted, and scope, profile and epoch are copied unchanged.
