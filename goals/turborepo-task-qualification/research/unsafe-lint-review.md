# Identity lint success-log exclusion

Observed 2026-09-09 UTC with exact stable Turbo 2.10.12 and Biome 2.5.6 in an
isolated linked worktree. The real `lint` script remains `bun run beep:lint`,
whose nested command is `biome check .`.

A synthetic secret canary in an appended `console.log(...)` source statement
produced a `noConsole` warning. The command returned exit 0 and the captured
stdout contained the canary in the diagnostic source excerpt. The observation
used a fresh run with cache reads and writes disabled and a network namespace
without external connectivity. It did not upload or replay an artifact, and
the fixture source was restored after the probe.

The current task has `outputLogs: full`; a successful diagnostic stream can
therefore contain sensitive source text. This fails the required capture-safety
negative case even though no real secret was used in this experiment.

Decision: exclude `@beep/identity#lint` for `turbo-task-result`, profile
`local-linux-x64-bun1.4.1`, epoch `qualification-v1`, and set only this task's
effective cache flag to false. The task was unassessed, so the legal initial
ledger disposition is `excluded`; there is no prior qualification to revoke.
Fresh lint execution remains authoritative. Other computations keep their
existing unassessed posture.

The compact observation is `local-preflight-observations.json`. Original stdout
is 1,755 bytes, SHA-256
`a00f985875db51ce93e309e2726f3d99f47135fca46ce33fdd76cf796c8d269e`.
Original stderr is 32 bytes, SHA-256
`e5b1730b91d002df43cac54a7956a8e249d0bb9c3c57b19347754555046ecd55`.
Raw synthetic-canary logs remain in the isolated fixture's ignored `.beep/`
directory for seven days. They are not checked into this public repository.

Re-entry requires a narrow repair, independent success/warning/error capture
tests, proof that failed diagnostics cannot become reusable artifacts, a new
reviewed contract, and the full local/shadow/signed-remote matrix. A script or
configuration change alone is not qualification.
