# Cache baseline review: goal-data inputs on integration test tasks (ROUT-03 slice 2)

Dated 2026-11-26. This follows `rout-03-slice-2-cache-review-2026-11-26.md` in the same pull request.
Review found that `@beep/law-practice-server` reads the citation ops child only from
`test/integration/**`, which its `test` script excludes. The integration lane runs
`test:integration:parallel --affected`, so the child's real consumer was not selected.

## What changed

| Subject | Task | Inputs added |
| --- | --- | --- |
| `@beep/law-practice-server` | `test:integration`, `test:integration:parallel` (new overrides) | the same inputs as its `test` task, including the `ops/manifest.json` negation |
| `@beep/eyecite` | `test:integration` (new override) | the frozen six-form profile fixture |
| `@beep/ontology` | `test:integration` (new override) | the legal-ontology-landscape asset manifest |

The root subject `//` records each per-package `turbo.json` digest, so it is re-recorded too.

## What did not change

Both integration tasks stay `cache: false` at the root, so no cached result is reused or dropped.
No output, environment entry, dependency edge or other task changed.
