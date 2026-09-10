# Quiet lint capture preflight

Observed 2026-09-09. The verified repair changes only identity's `lint` script
to `biome check . > /dev/null 2>&1`. Its detailed `beep:lint` command remains
`biome check .`, and `beep:audit` still invokes that detailed command. The main
checkout now uses this repair after the complete preflight passed. Identity
remains excluded with its cache disabled. Its full package audit and docgen
pass; the [baseline review](./quiet-lint-baseline-review.md) attributes the
resulting shared script digests without expanding reuse.

The owned `qualification-pilot-a2` worktree isolates this probe from the native
activation comparison in `qualification-pilot-a1`. Both use existing one-token
admission. The quiet probe binds the exact Bun, Biome and stable/canary Turbo
binaries, runs without network access or ambient credentials, and records
bounded private captures. It mounts system tools and Git metadata read-only;
only its owned fixture checkout is writable.

The prepared matrix compares normal and quiet command exit codes for success,
source warning, syntax failure, sensitive filename, schema-version warning and
invalid configuration. It then executes the full identity dependency graph
under each Turbo client, retaining the selected task's facts separately from
graph-wide output. The graph contains identity and types lint. A skipped task
or dependency failure cannot count as a successful identity execution.

The first attempt failed its setup. The proposed enabled child configuration
had invalid formatter layout, causing the nominal baseline to exit one. All
six direct pairs consequently exited one; their matching codes establish no
lint-repair verdict. Turbo then rejected the combination of `--cache` and
`--force` before producing a run summary. The worktree's tracked bytes were
restored, and its Git status was clean after the failed attempt.

The corrected probe uses the formatted v2 proposal and clears only its own
disposable cache directory before each graph run. A successful baseline is
mandatory before running the adversarial cases. The next attempt passed all
six direct exit comparisons: success, source warning, sensitive filename and
schema warning returned zero; syntax and invalid-configuration cases returned
one. Quiet direct captures contained none of the synthetic source/filename
canaries or protected paths.

Five exact-stable graph cases then ran identity with the expected exits and
bounded task logs free of those canaries and paths. The invalid root config
failed the types dependency before identity ran. The probe incorrectly required
an identity summary record and stopped, so this attempt has no canary-client
or complete-matrix verdict. Cleanup restored tracked bytes and a clean worktree.
The repaired probe accepts that omitted record only for the invalid-config
case with an observed failed types dependency, a nonzero graph exit and no
identity log. It records `selectedTaskExecuted: false` and continues to the
canary client. The full rerun has now passed all 18 records: six direct pairs
and, for each client, five identity executions plus the attributed dependency
failure before identity. Successful selected-task logs are 33 bytes and the
syntax-failure log is 73 bytes. None contains the synthetic canaries or
protected paths. All direct exits retain parity. Cleanup restores the owned
worktree's tracked bytes and clean Git status. The
[complete sanitized receipt](./quiet-lint-complete.json) records these facts;
no shadow or signed-remote claim is available.

The [partial receipt](./quiet-lint-stable-partial.json) preserves those direct
and selected-task observations as digests and explicit facts. The failed types
dependency exposed the synthetic configuration canary in the graph's stdout;
that capture stays private. It is neither an identity execution nor a safe
replay artifact. Graph-wide diagnostics remain separate from the selected
task's bounded replay log.

Probe scripts, raw captures and receipts remain under ignored
`.beep/qualification-local-preflight/` with seven-day retention. They are
exploratory evidence. The durable Cache real-pilot runner and full protocol
matrix remain required for qualification.
