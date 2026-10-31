# FFmpeg judge cache input review basis

PR #2396 extracts the FFmpeg command builders into `FFmpeg.command.ts`.
The judge-rubric policy reaches that module through the FFmpeg driver.
The canonical policy-fingerprint writer adds the new module to the generated input list.

This review retains accepted main `825307367b1de27f81884dfae7e37f98a82bdd72`, including its cache baseline
profile and epoch. The complete cache audit reports one blocking
configuration drift, `//#lint:policy-fingerprint:lint-judge-rubric`, and one source-digest review, `turbo.json`.
Its review subject is `//`, the root package. No other subject changed.

The task adds only `packages/drivers/ffmpeg/src/FFmpeg.command.ts` to `inputs`.
Removing that one added line restores the exact accepted-main `turbo.json` bytes.
The command stays `true`; dependencies, outputs, environment, cache settings and
all other task configuration stay unchanged.

| Input | SHA-256 |
| --- | --- |
| Accepted-main `turbo.json` | `42268abe7f46dc7c13a82e5507c2c021ce16403ca4952e976c55b33565bd6389` |
| Current `turbo.json` | `5b036d8ddf1dc735fc2b387d6bfe1a7ff57000805a958f92d2ebcd1c49335b9c` |
| Accepted-main baseline text | `7d081d691b23f8fc110f459403bfcee960ee0d08c63bc4847b1e092dd5b12e3d` |
| Qualification ledger | `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb` |

This request records the changed input contract without granting cache qualification.
It keeps accepted main's baseline scope, profile `local-linux-x64-bun1.4.4` and epoch
`qualification-v3` unchanged. The qualification ledger remains byte-identical.
All 1,655 unassessed computations remain unassessed.
No exception row, debt inventory or coverage threshold changes.

After independent review, apply the hash-bound request through
`bun run beep cache baseline --request docs/reports/ffmpeg-judge-cache-input-request-2026-10-31.json`.
Re-run the cache configuration audit to check that the recorded input matches the task.
