# Per-Module Imports

## Status

Lifecycle: `active`

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

P2 Pilot gate. P1 completed the inverted family-scoped law, mapping-driven
code/JSDoc/Markdown migration modes, pilot-blocking public leaves, generator
repairs, and JSDoc root-import detection. The next action is operator approval
of the proposed `apps/professional-desktop` pilot before measuring or writing
pilot imports.

## Latest Evidence

P1 complete 2026-09-03: the focused law suite is green; the proposed pilot
dry-run has zero manual reviews or parser warnings in executable and JSDoc
modes; all new public leaves resolve under NodeNext and Bundler; every touched
workspace package passed default package verification; the JSDoc ratchet has
zero root-policy findings; and full repository docgen passed. The reproducible
gross, in-scope, pilot, and authored-Markdown counts are recorded in
[`research/p1-census-baseline.md`](./research/p1-census-baseline.md).

## Notes

- The pilot gate is a real gate: no-win or a material regression stops the
  mass migration (`SPEC.md` § Pilot Gate).
- Foundation leaf-export work (`@beep/dock`, `@beep/observability`,
  `@beep/schema`, …) must precede the consumers that import those barrels.
- The operator's global Effect rules file is updated in-session when the
  in-repo convention lands (see `SPEC.md` Decision Log).
