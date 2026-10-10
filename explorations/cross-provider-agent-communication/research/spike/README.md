# Executed capability spike

2026-10-09. The operator accepted the brief and authorized these disposable
experiments. This report supersedes the pre-spike evidence boundary elsewhere
in the packet. It does not qualify a production service or all existing apps.

## Decision

Proceed with a Beep-owned durable contract and native provider adapters.
Codex app-server, Claude persistent stream input and Grok ACP are usable managed
session edges on the tested versions. Preserve Codex active steering; represent
Claude/Grok busy input as queued follow-up. Keep Cursor enrolled only at the
capabilities actually proved until its existing access route succeeds.

Use a transactional local store behind the repo's typed service boundary.
SQLite is the leading storage choice from this spike, subject to production
integration tests. Agent Relay remains a replaceable component candidate,
especially for network delivery; it is not a prerequisite for the first local
slice. Its tested local-only mode leaves required offline-recipient and remote
capabilities unavailable, and its native adapters do not yet cover Grok/Cursor.
This is a decision about current evidence, not a claim that Relay cannot be
extended or that its untested full backend loses a complete benchmark.

**Subsequent app proof:** an already-open Claude web conversation exchanged a
request/reply/acknowledgement with a managed Grok peer and retained its identity
through reload. See [APP-PROOF.md](APP-PROOF.md). This controller-mediated UI
route qualifies idle web delivery only; other app surfaces, autonomous tools
and reliable busy delivery remain gates for the full outcome.

## Measured provider matrix

All model exchanges used existing subscription routes, synthetic bounded text,
owned processes and the mandated model pins. No model was switched after a
failed result. Five samples show feasibility, not a reliability guarantee.

| Surface | Idle model receipt | Input while busy | Cancel | Reconnect / restart | Existing visible app |
| --- | --- | --- | --- | --- | --- |
| Codex 0.162.0; `gpt-6.1-sol`, medium | 5/5; 1.96–4.17 s model reply | 5/5 nonce received in the same active turn | `interrupted` | Persistent client reconnect passed; default restart widened sandbox; explicit-policy mitigation passed | Unknown |
| Claude Code 2.1.295; `claude-opus-5-5`, medium requested | 5/5; 1.21–1.41 s | 5/5 queued subsequent replies; same session | Control success; terminal `error_during_execution`, cancellation reason not proved | Not tested | Unknown; channels not exercised |
| Grok Build 1.0.50; `grok-4.7`, medium; usage `grok-4.7-build` | 5/5; 1.20–1.71 s | 5/5 queued subsequent replies; no same-turn steering proof | `cancelled`, 0.31 s | Owned leader load + prompt passed; no-load attach returned unknown session | Unknown |
| Cursor 2026.10.01-e373342; Opus 5.5 300K medium requested/selected | 0/1 attempted; plan access message | Not run after access barrier | Not run | Owned denied session not found after process restart; successful-session persistence untested | Unknown |

Cursor returned `Upgrade your plan to continue` as assistant text with
`stopReason: end_turn`, not an RPC error. Generation of the requested model was
not proved. The remaining four idle and five busy samples were not run. No
purchase, account change or fallback model was attempted. The adapter must
classify access failures independently from a nominal end-of-turn record.

Codex ephemeral threads could not be resumed after disconnect in the first
suite. A separate persistent thread passed same-server client reconnect with
model and permissions unchanged. After restarting its owned server, resume
without policy overrides returned `dangerFullAccess` instead of `readOnly`;
`approvalPolicy: never` remained. The probe halted before inference and archived
the owned thread. This is an observed configuration-resolution failure, not
proof of the Desktop continuation bug or a universal Codex defect.

Evidence: [Codex samples](codex/results.json),
[persistent permission failure](codex/persistent-results.json),
[Claude receipts](claude/receipts.json), [Grok report](grok/REPORT.md),
[Cursor report](cursor/REPORT.md). The [explicit-policy mitigation](codex-mitigation/REPORT.md) passed client
reconnect, owned server restart and `codex queue`, retaining readOnly/never and
model/effort. It set server defaults and explicit resume/queue policy together;
the test does not isolate which setting is independently sufficient. It does
not erase the failed default case or establish Desktop permission continuity.

## Actual two-provider exchange

One Codex → Grok → Codex request/reply/acknowledgement passed in **8.54 seconds**.
Both owned sessions stayed alive; model outputs carried the fresh correlation
nonce through the full exchange. A test controller forwarded the structured
outputs between native sessions. It did not give either model a production
send/reply tool. This proves the two native edges compose; autonomous tool
invocation, existing UI continuity and durable broker replay remain separate.

See [round-trip receipt](grok/roundtrip-result.json) and
[round-trip procedure](grok/ROUNDTRIP.md).

## Agent Relay comparison

Executed npm `@agent-relay/sdk`, `harness-driver` and `harnesses` at **13.2.0**.
Upstream reference: `5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db`.
Release/source byte equivalence was not established. No full Relaycast backend,
cloud workspace, provider model or existing app was used in these fixtures.

- Actual Linux local-only broker: synthetic native sidecar spawn/control,
  local queued delivery and fixture `delivery.accepted` passed. Restart retained
  the audit reconciliation outbox. That outbox was not a completed remote send.
- Actual published `RelayHarnessSession`: busy input deferred; another Node
  process restored and invoked the fake host once; duplicate delivery did not
  invoke it again. This is useful queue behavior, not model-consumption proof.
- Local-only remote delivery/attach, cross-machine routing, messaging tools and
  worker presence were disabled. Absent recipients were rejected, not held for
  future enrollment. Manual flush returned `capability_disabled`.
- Codex's explicit model/medium settings survived a mapping test. Claude's
  `effort` field did not. Cursor/Grok ship PTY definitions rather than the native
  control routes investigated here. A custom native sidecar is possible but
  requires additional adapter work.
- Root Apache-2.0, SDK missing license metadata and broker MIT declarations
  require component-level verification before adoption. Nothing was vendored.

See [Relay report](relay/REPORT.md). The same complete acceptance matrix was
not run against a full Relay backend, so there is no complete performance winner.

## Durable contract experiment

A disposable Python/SQLite model passed **29 assertions** covering atomic
acceptance, duplicate identity rejection, dispatch claims, process crashes before
and after acceptance, ambiguous consumption, role/direct address separation,
handoff recovery, competing claims and serialization with an in-flight action.

This is a small executable design model, not `@beep` code or the real session
ledger/Yeet integration. Lost acknowledgement and external consumption were
simulated. Ledger replacement did not fsync file/directory state: these tests
cover process termination, not power-loss durability. Production must test its
actual storage, cross-process ownership and external-action reconciliation.

100 SQLite FULL-sync acceptance samples measured p95 **5.94 ms**, max **58.08 ms**.
100 Codex `thread/read` calls measured p95 **87.26 ms**. Neither measurement is
end-to-end broker performance. Codex steer acknowledgements took 0.56–0.78 ms;
those are transport acknowledgements, not model response latency.

See [contract receipts](contract/results.json) and [model](contract/probe.py).

## Required gates still open

1. Extend the subsequent Claude web idle proof to each requested app
   kind, including ChatGPT Desktop/Work local-executor and cloud-backed chats.
   A Codex result cannot be relabelled a ChatGPT web or Work result.
2. Autonomous send/reply tool integration with recipient authentication, scopes,
   bounded conversation loops and the same-session app/worker vertical slice.
3. Cursor generation on the approved existing route; any new spending remains
   an operator decision. A plan error is a blocked cell, not an unsupported API.
4. Production replay, offline recipients, group/topic delivery, attachments,
   wrong-repo and stale-owner refusals, authority/Yeet integration and handoff.
5. Remote hosts and full Relay backend comparison if Relay remains a candidate.
   Neither native fixtures nor local-only Relay qualify federation.

## Reproduction and artifact handling

Scripts are research fixtures, not package modules or automatic tests. Inspect
them before use. Copy a provider directory into a **new owned directory under
`~/.cache/beep/`**, create an empty workspace and run the documented entry point.
Never run them from the repository or against an existing user conversation.
Cursor and Relay require an explicit `BEEP_SPIKE_ROOT` for that new cache;
follow their reproduction notes to install/copy sources into the same root.
Their packaged sources were hardened after the original run and checked without
rerunning providers. Provider scripts consume the existing subscriptions; do not
run them in CI.
Use a bounded host timeout and stop only the child process groups they create.

Codex requires Python `websockets`. `python probe.py --run-model-probes` runs
the 5+5 suite; `python persistent_probe.py --run-model-probes` reproduces the
separate persistent-policy check.
Its Unix socket uses a WebSocket HTTP upgrade, not raw NDJSON. The public copies
use runtime HOME paths, a cache-location guard and explicit opt-in. The default
restart failure fixture omits the unreachable queue leg; queue reproduction is
only in the explicit-policy fixture. Receipts refer to the observed private run.
Claude `python handshake.py` performs no model turn;
`python probe.py --run-model-probes` runs its model suite. Grok, Cursor and Relay
have their own reproduction notes. `python contract/probe.py` has no model dependency.

Private raw logs and exact session/correlation identities remain in
`~/.cache/beep/agent-comms-spike/` with restricted permissions. Public receipts
retain booleans, timings, versions and failure classes. Auth configuration was
used through installed subscription routes; no secret values were copied into
the packet. Owned test processes were stopped. Production source, global app
settings, unrelated conversations and billing configuration were not changed.
The subsequent app experiment retained only its own disposable web conversation.
