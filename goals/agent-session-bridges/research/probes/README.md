# Managed autonomous reply probe

`managed-roundtrip.py` is an opt-in synthetic integration runner for an owned Codex
session and one owned Grok or Claude session. It launches the repository CLI and
native driver; it does not enroll or resume existing application conversations.
The orchestrator owns live calls. The passing Codex/Grok and Codex/Claude runs are recorded in
[the qualification report](../NATIVE-QUALIFICATION.md); publishing this script
alone does not qualify another provider or source snapshot.

Use Python 3.9+, Bun, the installed pinned provider CLIs, and bubblewrap. Build the
repository's dependencies first. Existing subscription authentication must already
exist at the default runtime HOME references: `.codex/auth.json` and either
`.grok/auth.json` or `.claude/.credentials.json`. The runner checks reference-file
metadata and never reads credential contents. No API-key or alternative billing
environment variables are passed. Codex remains `gpt-6.1-sol` medium, Claude remains
`claude-opus-5-5` medium, and Grok remains `grok-4.7` medium through the native driver.

```sh
python3 goals/agent-session-bridges/research/probes/managed-roundtrip.py \
  --repo "$PWD" --peer claude --run-model-probes
```

The Grok state-write preflight and autonomous exchange passed on the snapshots
recorded in the qualification report. Use `--peer grok` for that route. An earlier
private attempt exposed a terminal sleep despite intended built-in exclusion and
is retained as a failed receipt. A read-only
filesystem sandbox and prompt restrictions do not themselves prove tool denial.
The public receipt therefore does not claim built-in denial, including on success.
Provider policy readback and actual tool permissions need their own evidence.

The runtime HOME determines a fresh owner-private directory below
`~/.cache/beep/agent-comms-implementation/`. The script rejects a cache redirected
into the repository. Each provider gets its own empty workspace and HOME. Claude
and Grok use a read-only root with only the owned home, workspace and router state
writable; the existing authentication reference is mounted read-only. Codex uses
its driver-prepared read-only/never profile and an existing authentication symlink.
The parent CLI and provider environments use an explicit PATH/LANG/USER/LOGNAME
allowlist plus owned HOME and required provider isolation settings. Global
configuration and credential files are not modified.

Grants are conversation-pinned, recipient-pinned and limited to one send each.
In the regular run, the controller only submits the initial seed. Codex must
acknowledge the seed and send the request using its own MCP tool; the peer must acknowledge and reply using
its own MCP tool; Codex must acknowledge that reply. Success requires exactly
three logical messages, correct nonce/correlation/conversation/senders, all three
acknowledgments, zero active dispatches and exactly one persisted grant use per
provider. Ambiguous, failed or expired messages stop the experiment without retry.

For the separate Claude busy-queue case, add `--exercise-busy-peer`:

```sh
python3 goals/agent-session-bridges/research/probes/managed-roundtrip.py \
  --repo "$PWD" --peer claude --exercise-busy-peer --run-model-probes
```

This flag is rejected for Grok before any provider launch. The controller first
submits a Claude primer asking for acknowledgement followed by approximately
800 words of neutral FIFO explanation, without peer sends. After observing its
acknowledgement with `dispatch_active = 1`, the controller accepts a second
synthetic nonce message through the actual CLI. One database snapshot immediately
after acceptance must show the primer still active and the second message still
accepted and inactive. Missing that opportunity blocks the run with
`busy-opportunity-missed`; the runner does not repeat the primer or delivery.

Both controller messages must then be acknowledged and their native dispatches
settled, with zero outbound grant usage. The same sessions proceed to the regular
three-message autonomous Codex/Claude exchange. Final success requires exactly
five logical messages, all acknowledged and inactive, with one persisted send
per provider. The receipt reports the two-message controller-submitted busy
exercise separately from the three-message autonomous exchange. This demonstrates
durable queue acceptance during an active owned native turn and subsequent drain;
it does not demonstrate steering into that turn, an autonomous busy reply, or an
existing application conversation.

Enrollment is bounded to 90 seconds, exchange to 240 seconds, and the overall
operation to 420 seconds plus bounded owned process-group cleanup. With the busy
flag, opportunity discovery is bounded to 90 seconds and settlement to 120 seconds,
within that same overall deadline. The runner
prints only a sanitized JSON receipt and exits 1 for a blocked probe after cleanup.
It retains raw logs, synthetic IDs, profiles, grants, database/sidecars and the
receipt privately in the cache. Public output contains source file digests and
provider-level facts; it contains no process/session/grant/message identifiers,
absolute HOME paths or raw error output. `ownedProcessGroupsStopped` verifies the
launched groups, not unrelated processes or descendants that escaped those groups.
Failure evidence is retained; the script never clears ambiguity or resets budgets.

Source lineage: promoted and refined from the private `managed-roundtrip.py` helper
on 2026-10-09; original helper SHA-256 `642ed493b3c4a6bc30d7a98aa63e82c9bcd9483daa3842cb4cf271b0faf6b01c`.
The public runner adds Claude selection, conversation scope, bounded cleanup,
sanitized output and nonzero blocked exit; it is not a copy of a passing probe.

Each new run records initial and final repository/runner source digests, native
executable and Bun/bubblewrap digests, and the bounded Bun version read. Success
also requires those sources and executables to remain unchanged through cleanup.
These hashes describe only that run; old failed receipts are never retroactively
assigned the current source or executable hashes.

The Grok profile supplies `sandboxWritablePaths` with exactly the owned router
state directory. The native driver and serving CLI must validate its private,
canonical owned location and exact match to `--state-dir`, then configure the
native `beep-messaging` sandbox. Root’s zero-model diagnosis found
`SQLITE_READONLY_DIRECTORY` inside the native MCP child sandbox; merely allowing
the outer bubblewrap state mount was insufficient. The native child state-write pass plus outside-write refusal were observed in
the separate [preflight receipt](../GROK-SANDBOX-PREFLIGHT.json). The subsequent
autonomous exchange also passed. This script does not repeat that preflight or
extend its evidence to changed sandbox profiles.
