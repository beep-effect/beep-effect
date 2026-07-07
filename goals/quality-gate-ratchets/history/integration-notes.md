# Integration Notes — P1/P2 verify rounds (2026-07-06)

## Every verify failure was a true positive or an environment artifact

Six verify rounds to green. Ledger:

| Round | Failure | Class | Resolution |
| --- | --- | --- | --- |
| 1 | check (5 tsgo diagnostics), lint:spell, changeset-status, docgen 139 | true positives + env | Config-idiom env guards; FileSystem rewrite of Glob.test.ts; "actuals" dictionary; empty changeset |
| 2 | schema-first policy: 14 findings on the ratchet modules themselves | true positive (own gate) | 5 type aliases → annotated schemas (parallel session); DocgenQualityWorkerEvalReport property test; inventory refresh |
| 3 | verdict blamed dual-arity; real steps unknown (output lost to tail) | verdict misattribution (known bug) + operator error | full-log capture thereafter; stale quality-issue-index cleared |
| 4 | quality:knip: `@effect/platform-node` unlisted in modeling/utils | true positive (own gate caught the orchestrator's fix) | dependency declared |
| 4 | lint:spell: 30 names in untracked root scratch report | env (parallel-session artifact) | file preserved to session scratchpad |
| 4 | docgen 139 ×2 | env (see below) | concurrency-1 run exposed the REAL failure it was masking |
| 5 | uspto-mcp docgen: missing @since on DocumentsProjectionOutput | true positive (A1 refactor orphaned the export's JSDoc) | doc block moved to the export |
| 6 | quality:lint: turbo child died on spawn (PlatformError) | env | standalone cache warm; verify rides cache |

## Systemic: bun spawn instability under sustained load (rqt-015 candidate)

Four abnormal child-process deaths in one night on the 32-core box after ~12h
of continuous multi-agent load: `bunx turbo run docgen --concurrency=3`
segfaulted 3× (different packages each time: mid-graph, @beep/rdf-canonize
parse, one unattributed) and `bunx turbo run lint --concurrency=3` died with
an unreadable exit code. Every isolated/serial rerun passed; @beep/ui and
uspto-mcp docgen pass solo in seconds. Mitigations that worked: `--concurrency=1`
for the crash-prone lane once, letting the turbo local cache absorb the heavy
work, then normal-concurrency reruns ride cache hits. Suspects: bun 1.3.14
process-spawn layer under memory/fd pressure, not repo code (no crash
reproduces in isolation). Follow-up candidates: bun bump when available;
per-lane concurrency knob in the yeet planner for docgen/lint; box hygiene
(the session had ~12h of accumulated agent processes).

## The gates reviewed their own PR

Both new gates fired on real regressions inside this very integration: knip
caught 5 findings from lane merges (fixed in 4fcaaadd65) and then caught the
orchestrator's own unlisted dependency; schema-first caught the ratchet
modules' exported type aliases. Zero false positives across all rounds.
