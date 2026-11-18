# P1 measurements: the agent signal through Turbo

Measured 2026-11-18 on the lane, `@beep/glob` (273 green tests in 29 files), stdout plus stderr,
`wc -m`. The exploration's baseline of 13,450 characters was taken in a checkout with a shorter
path; the same command measures 14,238 on this lane before the change.

| Run | Before | After |
| --- | ---: | ---: |
| `turbo run test --filter=@beep/glob --only --force`, only `CLAUDECODE=1` set | 14,238 | 820 |
| The same, only `CODEX_THREAD_ID` set | 14,238 | 820 |
| Task path, no agent variable, `--force` (cache miss) | n/a | 15,960 |
| Task path, `CLAUDECODE=1`, cache hit | n/a | 1,098 |

What the remaining characters are:

- Raw Turbo run, 820: the task's own log is 621 (Turbo's prefix on every line, Bun's two command
  echo lines, Vitest's run line with the absolute path, the summary) and Turbo's header and footer
  are 199.
- Task-path cache hit, 1,098: no test log is replayed and there is no `Test Files` line. 401 are
  Turbo's own lines, 378 are a 1Password warning about this lane's environment file, and the rest
  is the task path's step banner.

A dry run hashes the `@beep/glob` test task identically with and without the agent variables, so
cache reuse is unchanged. The miss and the hit both go through the task path because it sets a
hashed global variable that a raw `turbo run` does not.
