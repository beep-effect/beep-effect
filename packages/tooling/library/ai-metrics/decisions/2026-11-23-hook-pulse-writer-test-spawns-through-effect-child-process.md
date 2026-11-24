---
title: The hook-pulse shell conformance tests spawn through Effect ChildProcess
date: 2026-11-23
reversal: Spawn the writer and switch with Bun.spawn or node:child_process, pipe stdin unconditionally and read stdout after the exit code.
governs:
  - test/hook-pulse-writer.test.ts#stdinOrIgnoredWhenAGuardExitsBeforeReading
  - test/hook-pulse-writer.test.ts#runWriter
  - test/hook-pulse-writer.test.ts#runSwitch
enforcedBy: []
---

The writer and switch are shell, so the tests spawn the real scripts through Effect's `ChildProcess` with `extendEnv: true`.
That spawner delivers stdin and closes it under both `bun --bun` and the coverage runtime. `endOnDone` is stated because closing stdin is what ends the run.
Stdout, stderr and the exit code drain concurrently. A child that fills a pipe while the parent waits on `exitCode` hangs. A signal death fails `exitCode` and is left to propagate.
Stdin is `"ignore"` whenever the child exits before reading it: the kill switch, an agent kind outside `HookPulseAgentKind`, and the argv-only switch. Otherwise Bun reports the late EPIPE as an unhandled error that fails a run whose tests all passed.
`extendEnv` inherits `PATH` for `jq`, `sha256sum`, `date` and `cat` without reading `process.env`.
Rejected: `Bun.spawn*`. Under the coverage runtime it delivered no stdin, and its async form never closed it, so the writer's `payload="$(cat)"` hung CI for 40 minutes.
Rejected: `node:child_process`, which the `nodeBuiltinImport` law forbids.
Accepted limit: an empty ledger only says that one of the writer's guards exited. Probe stdin with a `cat` echo before blaming the environment.
