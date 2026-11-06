# Host-local Cowork lifecycle source

This is an inert source adapter, not a deployed observer or a controlled model
canary. Importing it installs no plugin, starts no Claude session, changes no
settings, and enables no collector or service. Ordinary Personal chat and the
Desktop Code tab are separate populations. VM and cloud Cowork are unsupported
by this local Unix transport.

The installed-source contract is Claude Desktop 4.23118.0 with its Code 2.1.317
engine. The production factory fixes the public app archive and native engine
hashes, and separately fixes the Desktop executable hash. A receiver-owned
`CoworkLifecyclePolicy` supplies the canonical workspace, app PID/start ticks,
host/root/route/enrollment identities, source paths and privacy salt. Callback
data cannot supply those identities. The Python bridge uses SO_PEERCRED and
bounded Linux ancestry observations to find the enrolled engine and Desktop
generation, with stable public-file metadata across the callback. This is
same-UID nonexclusive evidence, not exclusive authority over another agent.
Installed source and an interpreter digest alone do not attest which callback
JavaScript was executed; runtime helper/configuration binding remains a separate
deployment qualification.

Cowork's public SDK source sets `CLAUDE_CODE_ENTRYPOINT=local-agent`. Only the
standalone hook program reads its own inherited value for that single key. The
receiver library reads no environment or user configuration. An arbitrary
caller body or selector value is insufficient without the separate receiver
enrollment and observed app/engine ancestry. The synthetic test port deliberately
injects fake files and processes and is never an actual Cowork admission.

## Listener and callback bounds

Use a short receiver-owned socket path, preferably below a private 0700 directory
under `/run/user/<uid>`. Paths are restricted to ASCII and at most 107 UTF-8 bytes.
The bridge refuses symlinks, nonprivate parents and any existing path; it never
overwrites an existing or foreign socket. Normal success/error cleanup removes
only the exact socket inode created by that helper. A hard kill can leave a
stale socket: a later open then refuses until the owner separately verifies and
cleans it. No model or native task is replayed to recover delivery.
Controlled projection/journal failures signal the helper's explicit termination
handler, allowing that same guarded finalizer to run before a 200-millisecond
force-kill fallback. Cleanup failure never converts the original refusal into
acceptance, and a foreign replacement is preserved on both success and failure.
Public source digests retain the verified file descriptor's metadata identity;
the canonical entry must match it before enrollment and after the callback.

One `open()` accepts **one callback**, not a whole session. Its receiver-owned
listen window defaults to 30 seconds and is capped at 5 minutes. The caller owns
the Scope, process resources, pause gate and later opens at the same configured
path. No automatic daemon, endless reconnect loop or host enrollment is supplied.
Do not infer both Start and End from one open, or all-session coverage from any
sample. Missed callbacks and missing terminal events remain Unknown.

Public source hashing happens before the listener declares readiness. Once a
callback is accepted, the local bridge has a 1.2-second boundary and the journal
transaction has a 1-second bound. The standalone program also exits silently
after 1.2 seconds, including when stdin never ends. It writes no stdout/stderr,
context, decision, title or environment instructions. The generated plugin does
not override native hook timeouts; the native SessionEnd default remains 1.5
seconds. A lost or late ACK is uncertainty, not evidence that nothing committed.

## Privacy, identity and durable delivery

Only SessionStart/SessionEnd, a bounded session ID, and the event-specific finite
start source/end reason survive the transient projector. Session titles,
transcript paths, prompts, errors, cwd, model fields, usage estimates and unknown
maps are discarded before IPC forwarding or persistence. Transcript paths are
never opened. Session IDs are salted by the receiver before durable storage.

The native hook program creates a fresh occurrence UUID independently of input.
Transport idempotency uses that occurrence plus the enrolled runtime; it is not
session-ID-plus-kind. Thus repeated resume/compact callbacks for one native PID
can remain distinct. The same occurrence cannot change its payload without a
journal conflict. An explicitly prepared synthetic transport retry retains its
occurrence identity; the production helper does not automatically retry or
repeat a model/task. A process exit code 0 from the silent helper is not delivery
proof. Acceptance ACKs follow the existing journal transaction, and independent
backend readback is still required for visibility.

The distinct `claude-desktop`/`cowork` metadata variant exports a first-durable-
intake clock point. Native absolute time, duration, model usage and inference
success stay Unknown. Existing Cursor serialization, names and attributes remain
unchanged. No Cowork callback is a successful-turn or all-launch denominator.

## Uninstalled plugin artifact and later admission

`renderCoworkLifecyclePlugin` returns only three source files: a plugin manifest,
two command hooks and `scripts/observe-lifecycle.mjs`. It uses no top-level
`bin/`, downloads nothing, writes no files and enables nothing. Its explicit
interpreter and stable receiver path must be separately qualified, including
the actual helper entry and any interpreter startup behavior. Rendering source
is not an install/configuration proof.

Before an actual occurrence, root must authorize host-local deployment, bind the
designated Cowork task/helper to the enrolled process/root, qualify the actual
interpreter/source route, and confirm private receiver reachability. Any account
plugin upload/enablement is a separate action. The next existing user-owned
Cowork task can supply an occurrence; this module never creates a new chat or
provider request. The current dankserver lifecycle filter is Cursor-specific;
an explicitly reviewed future Cowork filter extension is required before
claiming backend visibility. It is not changed here.

Primary contract references:

- https://claude.com/docs/plugins/platform-support
- https://claude.com/docs/plugins/build
- https://code.claude.com/docs/en/hooks
