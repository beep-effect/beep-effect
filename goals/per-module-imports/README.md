# Per-Module Imports

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Migrate the repo from barrel imports (`import { Effect } from "effect"`,
`import { P } from "@beep/utils"`) to per-module imports (`import * as Effect
from "effect/Effect"`, `import * as P from "@beep/utils/Predicate"`), enforce
the convention with the incumbent toolchain (Biome `noRestrictedImports`
warn→error ratchet + an inverted `laws effect-imports` ts-morph command), and
rewrite every law/doc/skill that taught the old form — gated on a measured
pilot, because the evidence says the win is module-graph time (servers, tests,
tsserver, dev tooling), not production bundle bytes.

## Launch

```text
/goal follow the instructions in goals/per-module-imports/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decision log inside).
3. [`PLAN.md`](./PLAN.md) - active execution plan and per-phase notes.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - the six grounding reports (P0, 2026-08-23).
6. [`history/`](./history/) - evidence and closeouts, as they land.

## Current Phase

**Terminal at the measured stop.** P2 completed with an
**inconclusive — stop** verdict. The approved `apps/professional-desktop`
pilot passed every correctness gate, reached zero root imports, and was
idempotent, but its one permitted symmetric extension produced no stable
qualifying performance improvement. The strict-pass authority therefore did
not activate P3. The mass migration, Biome warn-to-error ratchet, written-law
flip, and global enforcement flip were not executed. P4 closeout is complete,
and this packet is retained as the vehicle, pilot, and decision record.

## Latest Evidence

P2 merged through PR #990 on 2026-09-03. Fifteen valid source-tsgo and Vitest
samples per state, seven cold-route samples, and five deterministic builds
produced no decisive win and no stable material regression. The full
threshold math and stop decision are recorded in
[`history/p2-pilot-verdict.md`](./history/p2-pilot-verdict.md), with auditable
raw samples under [`history/measurements/`](./history/measurements/).

P1's migration vehicle, foundation leaf exports, generator fixes, and focused
law/doc gates merged through PR #971. Its evidence remains in
[`research/p1-census-baseline.md`](./research/p1-census-baseline.md). The P4
reflection is
[`history/reflections/2026-09-03-codex.md`](./history/reflections/2026-09-03-codex.md).

## Notes

- The pilot gate is a real gate: no-win or a material regression stops the
  mass migration (`SPEC.md` § Pilot Gate).
- P3 is recorded as terminally stopped, not as completed implementation. It
  may be reconsidered only through a new decision with new evidence; this
  closed packet grants no continuation authority.
- Foundation leaf-export work (`@beep/dock`, `@beep/observability`,
  `@beep/schema`, …) must precede the consumers that import those barrels.
- The operator's global Effect rules file was not changed because the global
  convention did not land (see `SPEC.md` D14).
