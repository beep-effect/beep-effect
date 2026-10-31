# FFmpeg judge cache input review basis

PR #2396 extracts the FFmpeg command builders into `FFmpeg.command.ts`.
The judge-rubric policy reaches that module through the FFmpeg driver.
The canonical policy-fingerprint writer adds the new module to the generated input list.

This review retains accepted main `0167e56db6e8debc692e8c26ab2c64ef245fb1cd`, including its cache baseline
profile and epoch. The complete cache audit reports one blocking
configuration drift, `//#lint:policy-fingerprint:lint-judge-rubric`, and one source-digest review, `turbo.json`.
Its review subject is `//`, the root package. No other subject changed.

The task adds only `packages/drivers/ffmpeg/src/FFmpeg.command.ts` to `inputs`.
Removing that one added line restores the exact accepted-main `turbo.json` bytes.
The command stays `true`; dependencies, outputs, environment, cache settings and
all other task configuration stay unchanged.

| Input | SHA-256 |
| --- | --- |
| Accepted-main `turbo.json` | `5670b52eeaeddfbf74063354b8b61ccc2729f08d39eed60aae0fa0022046d793` |
| Current `turbo.json` | `41fbcdd6fbb4bf732c71a285bef180be9ffabf9d478a74e4e7d053211cd19fca` |
| Accepted-main baseline text | `ffc8e3361326af0250356cc02ef72a504b9b322da6d2ede230179006c0143183` |
| Qualification ledger | `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb` |

This request records the changed input contract without granting cache qualification.
It keeps accepted main's baseline scope, profile `local-linux-x64-bun1.4.4` and epoch
`qualification-v3` unchanged. The qualification ledger remains byte-identical.
All 1,655 unassessed computations remain unassessed.
No exception row, debt inventory or coverage threshold changes.

After independent review, apply the hash-bound request through
`bun run beep cache baseline --request docs/reports/ffmpeg-judge-cache-input-request-2026-10-31.json`.
Re-run the cache configuration audit to check that the recorded input matches the task.
