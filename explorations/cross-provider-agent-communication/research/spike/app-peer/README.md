# Manual existing-app/Grok peer handoff

[REPORT.md](REPORT.md) and [receipt.json](receipt.json) describe one completed
managed Grok peer exchange. The root controller owns the visible Claude app
evidence: enrollment, reply in the same conversation, returned Grok ACK,
`APP_ROUNDTRIP_COMPLETE`, and persistence of URL/messages after reload. These
are root observations, not an independent browser inspection by this worker.
The root normalized typographic JSON quotation punctuation displayed by the UI
while preserving the nonce, fields and reply value. No model text or nonce was
substituted. A separate busy-browser send attempt timed out and remained an
unsent draft after original output finished; no busy-delivery success is claimed.

This exchange uses **controller-mediated browser/model-output forwarding**.
It does not establish autonomous send/reply tools, production app enrollment,
busy intervention or broker durability. Public receipts omit exact nonce,
session/process identities, conversation URLs and private transcripts.

## Opt-in manual replay

The packaged source is a portable replay variant of the private measured
helper. Its syntax was checked; this variant was not run against models.
Without opt-in it exits before creating a workspace or invoking a provider:

```sh
python probe.py
```

An authorized replay uses existing Grok subscription quota for two bounded
synthetic turns. It requires bwrap and the exact measured Grok revision, derives
the current user's paths at runtime, and creates a fresh mode-700 directory
under `~/.cache/beep/agent-comms-spike/app-peer-replay-*`. It never uses the
packet/repository directory as provider cwd. A private child HOME and read-only
bind of existing cached auth avoid credential copying. No API-key environment,
provider fallback, global configuration repair, new billing or tool execution
is allowed.

```sh
timeout --signal=INT --kill-after=10s 600s python probe.py --run-model-probes
```

The script prints the owned cache directory, verifies isolated configuration,
and leaves the same owned Grok session alive through this handoff:

1. `outgoing.json` contains Grok's generated synthetic request. An authorized
   controller forwards that actual request into an explicitly enrolled,
   disposable app conversation and records its own app evidence.
2. The controller extracts the app's actual JSON reply. Preserve semantic fields
   and nonce if normalizing displayed JSON punctuation. Atomically replace
   `incoming.json` in the printed cache directory with that reply. The reply must
   identify sender `claude-app`, recipient `grok`, the exact generated nonce and
   a bounded nonempty `reply` string.
3. Grok consumes the reply in the same session and writes `acknowledgement.json`
   and `receipt.json`. The ACK must preserve the nonce and exact reply. The
   controller may forward that ACK back into the same enrolled app conversation.

Do not enroll or write to unrelated app conversations. The script has no browser
control and cannot establish UI continuity itself. It waits only for this one
reply, has a 600-second bound, and terminates only its owned child in a finalizer.
All tool/permission reverse requests are refused. Raw logs, exact correlation
and runtime identity files remain private in the new cache directory and must
not be committed. Remove only that owned directory after its process stops.
