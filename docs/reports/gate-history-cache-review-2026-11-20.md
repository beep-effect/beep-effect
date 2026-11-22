# Cache baseline review: gate run history

Dated 2026-11-20. Lane `goals/gate-run-history-lane`. This is the review basis for recording new
cache baseline settings for two subjects.

## What changed

| Subject | Change | Why |
| --- | --- | --- |
| `@beep/repo-gate-run` | A new workspace dependency, `@beep/sqlite`, with its project reference in the three tsconfig files. | The history store is the library's one driver adapter (decision `sqlite-driver-under-the-narrow-adapter-rule` in `goals/gate-run-history`). |
| `@beep/repo-gate-run` | The `coverage` script runs Vitest under Bun (`bunx --bun vitest run --coverage`). | The SQLite store tests need `bun:sqlite` and skip under Node, so coverage measured under Node would miss the store. `@beep/agent-memory-store` does the same. |
| `//` (root) | The policy fingerprint inputs in `turbo.json` were resealed by the repo CLI after the gate command gained the history queries. | The reseal is the tool's output for a new repo CLI export; no entry was edited by hand. |

## What did not change

No task gained or lost an output. No environment entry, pass-through variable or cache flag
changed. No task of another package changed its configuration.

## Effect on cached results

The dependency edge and the script digest change the task hashes of `@beep/repo-gate-run`, so its
cached results are not reused across this change. That is the intended outcome: each task now
depends on the driver's sources.
