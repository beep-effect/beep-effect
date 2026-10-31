# FFmpeg judge cache input review basis

PR #2396 extracts the FFmpeg command builders into `FFmpeg.command.ts`.
The judge-rubric policy reaches that module through the FFmpeg driver.
The canonical policy-fingerprint writer adds the new module to the generated input list.

The complete cache audit reports one blocking configuration drift,
`//#lint:policy-fingerprint:lint-judge-rubric`, and one source-digest review, `turbo.json`.
Its review subject is `//`, the root package. No other subject changed.

The task adds only `packages/drivers/ffmpeg/src/FFmpeg.command.ts` to `inputs`.
Removing that one added line restores the exact previous `turbo.json` bytes.
The command stays `true`; dependencies, outputs, environment, cache settings and
all other task configuration stay unchanged.

| Input | SHA-256 |
| --- | --- |
| Previous `turbo.json` | `7af7a9fd6c7209f84475d275ac0ceb2cab46d3e1a0a2d6e6429d9bd1d1b2badf` |
| Current `turbo.json` | `f1afe334b0e8d2974befbbfd4fe2a92c7431691b288443c27b35c30ffb4704e1` |
| Previous baseline text | `988ed33bad5e93aade662229c2fdb56fad30059183afce7f1495a7966532e6d6` |
| Qualification ledger | `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb` |

This request records the changed input contract without granting cache qualification.
It keeps the baseline scope, profile `local-linux-x64-bun1.4.2` and epoch
`qualification-v2` unchanged. The qualification ledger remains byte-identical.
No exception row, debt inventory or coverage threshold changes.

After independent review, apply the hash-bound request through
`bun run beep cache baseline --request docs/reports/ffmpeg-judge-cache-input-request-2026-10-31.json`.
Re-run the cache configuration audit to check that the recorded input matches the task.
