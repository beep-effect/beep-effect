# FFmpeg judge cache input review basis

PR #2396 extracts the FFmpeg command builders into `FFmpeg.command.ts`.
The judge-rubric policy reaches that module through the FFmpeg driver.
The canonical policy-fingerprint writer adds the new module to the generated input list.

This review retains accepted main `349bdeaebfd2604bb662eb67711f71309370093e`, including its cache baseline
profile and epoch. The complete cache audit reports one blocking
configuration drift, `//#lint:policy-fingerprint:lint-judge-rubric`, and one source-digest review, `turbo.json`.
Its review subject is `//`, the root package. No other subject changed.

The task adds only `packages/drivers/ffmpeg/src/FFmpeg.command.ts` to `inputs`.
Removing that one added line restores the exact accepted-main `turbo.json` bytes.
The command stays `true`; dependencies, outputs, environment, cache settings and
all other task configuration stay unchanged.

| Input | SHA-256 |
| --- | --- |
| Accepted-main `turbo.json` | `64444c02445b3fe8a55923b801e3eb7571370f7420cab869e9520ffcec636950` |
| Current `turbo.json` | `c8d646fc8fdb1c0da18b2b6452ed69c2292c5756ca630ea114b70bc7e93834ce` |
| Accepted-main baseline text | `108a3fe7a0eec11ba8d117c94f97dd299d1ac933a8e34d458d17904645b8939d` |
| Qualification ledger | `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb` |

This request records the changed input contract without granting cache qualification.
It keeps accepted main's baseline scope, profile `local-linux-x64-bun1.4.4` and epoch
`qualification-v3` unchanged. The qualification ledger remains byte-identical.
All 1,655 unassessed computations remain unassessed.
No exception row, debt inventory or coverage threshold changes.

After independent review, apply the hash-bound request through
`bun run beep cache baseline --request docs/reports/ffmpeg-judge-cache-input-request-2026-10-31.json`.
Re-run the cache configuration audit to check that the recorded input matches the task.
