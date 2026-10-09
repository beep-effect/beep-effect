# Local agent messaging

`bun run beep agent-message` connects explicitly owned managed workers through a
private SQLite mailbox. The first implementation supports queued direct messages.
It does not attach to an arbitrary open Desktop conversation or elect an
orchestrator. Provider-specific capabilities and evidence remain separate.

This is an experimental managed route. The bridge goal records a successful
autonomous Codex/Grok and Codex/Claude send, reply and acknowledgment exchanges
with settled native turns, persisted grant budgets and owned cleanup. Claude
also passed queued acceptance during an active native turn and subsequent drain. Consult the [per-mode evidence](../../goals/agent-session-bridges/research/NATIVE-QUALIFICATION.md)
before treating another provider or application surface as qualified.

The operator controls enrollment and grants. Each provider receives only a scoped
stdio MCP server with send, reply, inbox, acknowledge, inspect and discover tools.
Peer text carries no launch, merge, policy-change or spending authority.

## Owned state and startup

Choose an absolute private directory outside the repository, such as a dedicated
child of `~/.cache/beep/agent-messaging`. Keep the directory mode `0700` and profile
and grant files `0600`. The CLI refuses a symlink or group/world-accessible state
root, database, profile or grant file. Raw transcripts and credentials never belong
in a tracked goal packet.

Start by inspecting the command help:

```sh
bun run beep agent-message --help
bun run beep agent-message serve --help
```

`serve` requires an explicit state directory, private launch profile, endpoint,
participant, owner, repository scope and positive generation. A profile uses the
`ManagedLaunchProfile` contract in `@beep/ai-provider-cli`. Its executable,
arguments, environment and MCP servers are trusted host configuration; never build
one from peer message text. It must select an existing subscription and the
approved model. Each worker gets its own profile root and disposable workspace.
Do not inherit interactive hooks, plugins, API keys or unrelated MCP servers.
For Grok, the profile's `sandboxWritablePaths` must contain only this command's
canonical state directory. Its named native sandbox extends the read-only profile
with that mailbox allowance. It does not make the repository writable.

The driver starts and verifies its native session before registering the endpoint.
MCP startup may happen before registration; tool calls remain unauthorized until
the host registers a current grant. The grant binds one endpoint generation and
owner to a repository scope, allowed recipient list, expiry and persistent message
budget. An optional conversation scope restricts it to one host-selected task;
omitting that scope grants access across conversations within the other limits.
Register its private JSON file with:

```sh
bun run beep agent-message grant --state-dir "$STATE_DIR" --file "$GRANT_FILE"
```

`STATE_DIR` and `GRANT_FILE` above are operator-supplied absolute paths. The grant
file is an identifier for persisted authority, not a way for a model to mint a new
grant. Re-registering the same grant does not reset its spent budget. The model
cannot choose its sender identity through tool parameters.

## Sending and observing

Use `list` to inspect enrollment evidence. A handshake advertises capability;
actual delivery and participant acknowledgement supply stronger evidence for a
particular message. Enrollment does not prove native Desktop attachment.

The operator `send --file` command accepts a JSON `Envelope` with stable message
and idempotency IDs, conversation, scoped sender and direct recipient, timestamps,
body and the target's current capability/policy fingerprints. `reply --file`
requires `replyTo` and validates the original conversation and both participants.
An equal-ID/equal-content retry returns the original acceptance. Different content
with the same identity fails.

Models normally use the scoped tools instead of constructing full envelopes. The
host fills their authenticated sender, policy fingerprints, timestamps and expiry.
The reply tool derives its recipient and conversation from the original message.
Messages and grants are checked transactionally against current generations.

```sh
bun run beep agent-message list --state-dir "$STATE_DIR"
bun run beep agent-message send --state-dir "$STATE_DIR" --file "$ENVELOPE_FILE"
bun run beep agent-message inspect --state-dir "$STATE_DIR" --message-id "$MESSAGE_ID"
bun run beep agent-message watch --state-dir "$STATE_DIR" --message-id "$MESSAGE_ID"
```

`watch` emits durable receipt rows as JSON lines until interrupted. `inbox` reads
queued messages; `acknowledge` records explicit recipient consumption. Operator
commands have host authority and must not be exposed as general model tools.

## Delivery and recovery

Acceptance commits before dispatch. A claim records the owner, attempt and lease
before native inference, outside the SQLite transaction. Competing dispatchers
cannot claim the same active endpoint. The provider call has a bounded lifetime.

Acknowledgement proves participant consumption; it does not prove the provider
turn has finished or its work succeeded. Acknowledging during an active turn keeps
the dispatch fence until a known terminal result. An uncertain call retains that
fence even if it already acknowledged. An expired in-flight attempt becomes
`ambiguous`, with its original owner retained. `recover` records recovery facts
without resending uncertain work. A delivered message that reaches its expiry
without acknowledgement also becomes an owned ambiguity.

If acknowledgement precedes an uncertain native completion, receipt history
retains the acknowledgement and adds an ambiguity diagnostic. A confirmed result
for that exact active attempt can reconcile the hold. Replaying a completion for
an already settled attempt cannot re-open it.

An ambiguity requires reconciliation against the original owned runtime and its
receipts. This slice deliberately has no command that clears the hold or silently
replays the message. Do not delete rows, reset quotas or change generations to
bypass it. A future adapter can add consumptive reconciliation only when it can
prove the original outcome.

A higher endpoint generation does not redirect old mail. Replacement refuses
active or ambiguous dispatches, as well as delivered messages awaiting
acknowledgement, and terminalizes unsent messages for the old
generation with a diagnostic receipt. New grants and messages then target the
new generation.

## Disposal and retained evidence

Stop only the workers and MCP children owned by this launch. Keep their mailbox
and receipts. The store uses SQLite WAL with FULL synchronization and refuses
unknown schema versions; process-crash tests do not establish power-loss behavior
for every filesystem.

For a stopped-writer backup, close all owned provider and SQLite scopes first,
then retain the database and any WAL/SHM sidecars together in another private
directory. For a live database, use SQLite's consistent backup facility. Never
copy only the main file while a WAL writer is active.

See the [router goal](../../goals/agent-message-router/SPEC.md) and
[bridge goal](../../goals/agent-session-bridges/SPEC.md) for the current acceptance
matrix, reproducible probes and the separately gated existing-app work.
