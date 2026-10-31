# FFmpeg judge cache input review basis

PR #2396 extracts the FFmpeg command builders into `FFmpeg.command.ts`.
The judge-rubric policy reaches that module through the FFmpeg driver.
The canonical policy-fingerprint writer adds the new module to the generated input list.

This review retains accepted main `480b302e427d3aca139f9a5c62e71ecc1e00c5bc`, including its cache baseline
profile and epoch update. The complete cache audit reports one blocking
configuration drift, `//#lint:policy-fingerprint:lint-judge-rubric`, and one source-digest review, `turbo.json`.
Its review subject is `//`, the root package. No other subject changed.

The task adds only `packages/drivers/ffmpeg/src/FFmpeg.command.ts` to `inputs`.
Removing that one added line restores the exact accepted-main `turbo.json` bytes.
The command stays `true`; dependencies, outputs, environment, cache settings and
all other task configuration stay unchanged.

| Input | SHA-256 |
| --- | --- |
| Accepted-main `turbo.json` | `1d009a6a437b07788a0246fefc60d6418b95962c77b77ec9fa406bd25e056aa4` |
| Current `turbo.json` | `c56508e1a9dc7cc1320f4717cef284dc9b81771d3b6a0feaa6078b7ff01dc574` |
| Accepted-main baseline text | `fc1afbb089bec054bc84f88cd61a5559e36f14c040817590944f97e0d3b47365` |
| Qualification ledger | `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb` |

This request records the changed input contract without granting cache qualification.
It keeps accepted main's baseline scope, profile `local-linux-x64-bun1.4.4` and epoch
`qualification-v3` unchanged. The qualification ledger remains byte-identical.
All 1,655 unassessed computations remain unassessed.
No exception row, debt inventory or coverage threshold changes.

After independent review, apply the hash-bound request through
`bun run beep cache baseline --request docs/reports/ffmpeg-judge-cache-input-request-2026-10-31.json`.
Re-run the cache configuration audit to check that the recorded input matches the task.
