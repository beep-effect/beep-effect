# Cache baseline review: goal-data consumer Turbo inputs (ROUT-03 slice 2)

Dated 2026-11-26. Goal `route-soundness-repair`, PLAN slice 4 (ROUT-03 slice 2). This is the
review basis for re-recording the cache baseline of six subjects.

## What changed

Each package whose tests read a goal or exploration path, or the law-practice use-cases fixtures
by relative path, now declares that path as a `test` task input in its own `turbo.json`. No root
`turbo.json` task changed.

| Subject | Task | Inputs added |
| --- | --- | --- |
| `@beep/repo-cli` | `test`, `test:property`, `coverage` | `goals/speed-loop/ops/runner-burst/**`, `goals/*/ops/**/*.ts` |
| `@beep/ciops` | `test` (new override) | `gate-order-handoff.json`, the s6 ABox and journal, the run4-fleet corpus, the two KPI research pins and the competency questions |
| `@beep/semantica` | `test` (new override) | the C2 replay eval report |
| `@beep/eyecite` | `test` (already `cache: false`) | the frozen six-form profile fixture |
| `@beep/law-practice-server` | `test` (new `turbo.json`) | citation `ops/**` minus `ops/manifest.json`, the frozen six-form profile fixture, `packages/law-practice/use-cases/test/fixtures/**` |
| `@beep/ontology` | `test` (new `turbo.json`) | the legal-ontology-landscape asset manifest |

## What did not change

The root subject `//` records the digest of every per-package `turbo.json`, so it is re-recorded for
the four changed files and the two new ones; no root task, input or flag changed.

No task gained or lost an output. No environment entry, pass-through variable, dependency edge
or cache flag changed. Every override starts from `$TURBO_EXTENDS$`, so the root inputs stay in
force and only the listed paths are added.

## Effect on cached results

The new inputs change the `test` hashes of the six subjects (and `test:property` and `coverage`
for `@beep/repo-cli`), so their cached results are not reused across this change. That is the
intent: an edit to a consumed goal path now reruns, and under `--affected` selects, the tests
that read it. A packet manifest under a consumed prefix still selects nothing.
