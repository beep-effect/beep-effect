# GOAL: migrate barrel imports to per-module form

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths below are repo-relative.

Outcome: every in-scope import of the `effect` barrel and live `@beep`
foundation barrels uses per-module form (`import * as Effect from
"effect/Effect"`; named `pipe`/`flow`/`identity` from `effect/Function`;
`import * as P from "@beep/utils/Predicate"`), enforced by Biome
`noRestrictedImports` with a warn→error family ratchet — gated on a measured
pilot. Barrels stay as the public/docgen surface.

Terminal disposition: P2 selected the normative stop route in `SPEC.md` D14.
P3 was not authorized, so this run closes after P4 with the bounded P1/P2
vehicle and pilot evidence retained; it does not claim the global outcome.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/per-module-imports/README.md`
- `goals/per-module-imports/SPEC.md` (normative; decision log inside)
- `goals/per-module-imports/PLAN.md` (phase state + working notes)
- `goals/per-module-imports/ops/manifest.json`

Read those first, then `AGENTS.md` and the research reports `SPEC.md` cites.
Repo standards outrank packet prose when they conflict.

Scope:

- In: `laws effect-imports` inversion + ts-morph migration command; foundation
  leaf exports (both export maps + tsconfig-sync); generator templates; Biome
  rule + family overrides; executable AND JSDoc/Markdown import corpus; the
  law-flip checklist (`research/enforcement-census.md` §B).
- Out: removing barrels; new permanent lint tools; `scratchpad/`,
  `explorations/` assets, `goals/*/ops` assets; `@beep/invariant` (does not
  exist).

Non-negotiable constraints:

1. Invert `laws effect-imports` BEFORE writing any import — today it rewrites
   per-module back to the barrel and Yeet repair auto-runs it.
2. The pilot gate (P2, `apps/professional-desktop` proposed) decides mass
   migration; enforcement config identical between measured states; a material
   regression or no-win STOPS the migration.
3. The census mapping table (`research/import-census.md` §3) is the codemod's
   data; preserve aliases and type-only syntax; emit only specifiers present
   in the target package's export map; manual-review queue over guessing.
4. Batch order: warn rule frozen once → foundation kernel as ONE batch →
   vertical families → apps last → single error flip. Written laws and
   generators flip with enforcement, not after.
5. Each batch ships as a PR driven to mergeable via `/yeet`.

Workflow:

1. Start at `PLAN.md`'s current phase; make the smallest change satisfying
   `SPEC.md`.
2. Preserve unrelated worktree changes; never `git add -A`.
3. Prove each batch: new law check, forbidden-specifier census, codemod
   idempotence, `bun run beep yeet verify`, `bun run docgen:local`.
4. At P4 Close, write a reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [x] `SPEC.md` terminal-route acceptance boxes all check.
- [x] Pilot verdict + raw stats recorded; the gate's stop disposition applied.
- [x] Strict-pass-only P3 outcomes are explicitly not executed under D14 and
  are not represented as completed migration work.

Stop and report instead of improvising when: the gate says no-win or material
regression; leaf bypass exposes a design-level cycle; a foundation batch's CI
wave cannot be attributed; or the same blocker repeats after investigation.
