# FFmpeg judge cache input review basis

PR #2396 extracts the FFmpeg command builders into `FFmpeg.command.ts`.
The judge-rubric policy reaches that module through the FFmpeg driver.
The canonical policy-fingerprint writer adds the new module to the generated input list.

This review retains accepted main `850a5bb47b1f7792c06d4cbcbf44db37d3e177b4`, including its cache baseline
profile and epoch. The complete cache audit reports one blocking
configuration drift, `//#lint:policy-fingerprint:lint-judge-rubric`, and one source-digest review, `turbo.json`.
Its review subject is `//`, the root package. No other subject changed.

The task adds only `packages/drivers/ffmpeg/src/FFmpeg.command.ts` to `inputs`.
Removing that one added line restores the exact accepted-main `turbo.json` bytes.
The command stays `true`; dependencies, outputs, environment, cache settings and
all other task configuration stay unchanged.

| Input | SHA-256 |
| --- | --- |
| Accepted-main `turbo.json` | `daeb461599e90a6b4b2f1c091df202c7a5533d50c8d4bfa3ced0b6f6bb3815a0` |
| Current `turbo.json` | `b70d560d1df55616d19829c09f7cf9ab8916ce8a478e94dee289d9c296b23f4c` |
| Accepted-main baseline text | `1f9aac0a8f0a2ad6ea60fd0dd4618c80af9d4618ffc83bdbc1a9f92c012f079f` |
| Qualification ledger | `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb` |

This request records the changed input contract without granting cache qualification.
It keeps accepted main's baseline scope, profile `local-linux-x64-bun1.4.4` and epoch
`qualification-v3` unchanged. The qualification ledger remains byte-identical.
All 1,655 unassessed computations remain unassessed.
No exception row, debt inventory or coverage threshold changes.

After independent review, apply the hash-bound request through
`bun run beep cache baseline --request docs/reports/ffmpeg-judge-cache-input-request-2026-10-31.json`.
Re-run the cache configuration audit to check that the recorded input matches the task.
