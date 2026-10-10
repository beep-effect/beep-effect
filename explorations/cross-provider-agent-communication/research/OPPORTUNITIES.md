# Research friction

## 2026-10-09: delivery claims need runtime-state evidence

Task: re-evaluate realtime cross-provider communication. Prior packet evidence
shows detached senders could write a Claude notification socket without waking
the intended idle session. An accepted socket write is not a delivery receipt.
See `goals/yeet-pr-events/` and the prior-work report in this packet.

Prevention: every adapter probe must record busy/idle/disconnected state,
same-session identity, permission continuity, receive acknowledgement, and an
observable response containing a per-message nonce.

## 2026-10-09: template points at a retired catalog

Task: scaffold an exploration from `explorations/_template`. Its RESEARCH.md
inventory guidance still names `standards/repo-exports.catalog.md`; current
AGENTS.md requires live source and barrel searches. Used current graft/source
evidence instead. Prevention: update the template in a focused maintenance
change; do not restore the removed catalog.

## 2026-10-09: restart can reinterpret Codex permissions

Task: reconnect an owned read-only app-server thread. After server restart,
`thread/resume` without explicit policy returned `dangerFullAccess`; inference
stopped. Same-server reconnect had retained `readOnly`. Receipt:
`spike/codex/persistent-results.json`. Combined explicit server defaults and
resume/queue policy passed a separate mitigation. Prevention: persist the
enrolled policy fingerprint, send it explicitly and compare effective settings
before inference. Never treat a successful resume RPC as permission continuity.

## 2026-10-09: terminal turn status is not a successful Cursor generation

Task: ACP nonce echo. Model selected Opus 5.5 medium, but the reply said
`Upgrade your plan to continue` with `end_turn` and no RPC error. CLI ask mode
also initialized the ACP session in agent mode until explicit `session/set_mode`.
Receipt: `spike/cursor/results.json`. Prevention: read effective mode and classify
access-error content; require nonce/model evidence instead of trusting end_turn.
No paid remedy or model substitution was attempted.

## 2026-10-09: protocol details matter at the provider edge

Task: disposable native delivery. Raw NDJSON over Codex's Unix socket timed out;
the documented WebSocket upgrade worked. A bounded app-server proxy attempt also
timed out and is not qualified by this spike. Grok accepted `_x.ai/interject`,
while the unprefixed method returned `-32601`. Prevention: pin installed schemas,
negotiate extensions and run a zero-model handshake before model probes.

## 2026-10-09: isolated homes can still expose host/runtime details

Task: Grok private-home launch. Initial bubblewrap setup hit inaccessible host
runtime sockets; private tmpfs masks for container runtime directories fixed the
environment. Grok then generated 22 bundled skills in its disposable home;
Claude safe mode retained three built-in plugin metadata entries. Prevention:
assert effective isolation counts and describe what was disabled precisely.

## 2026-10-09: local Relay differs from the full messaging facade

Task: compare adoption with native routes. Local-only delivery rejected absent
recipients, manual flush returned `capability_disabled`, and remote capabilities
were disabled. The published Claude settings mapper dropped `effort`; the Codex
default differs from the repo pin. Receipt: `spike/relay/REPORT.md`. Prevention:
qualify the deployed mode and effective provider identity, not package-wide
feature claims. Full Relaycast comparison remains separate work.


## 2026-10-09: replay artifacts need isolation after packaging

Task: publish reproducible spike sources in the packet. Review found a dormant
Codex queue leg lacking explicit policy and Cursor/Relay helpers retaining their
original cache root. Removed the unsafe queue leg; parameterized the copied
helpers for a fresh cache root. Initial Biome validation also found introduced
formatting/style issues. Prevention: syntax, cache-location and policy guards
must be checked on packaged sources, independently of the original live receipt.


## 2026-10-09: visible UI needs receipt and timeout reconciliation

Task: existing Claude web conversation reply proof. Accessibility indices became
stale during composer rendering; semantic textbox/button locators succeeded.
Assistant accessibility headings dropped underscores, while the rendered body
preserved the nonce and reply. Read the body, normalize presentation punctuation
only, and validate the bounded envelope. A busy Send click timed out despite an
enabled button; the draft remained unsent. The probe inspected state instead of
retrying. Prevention: use recipient-message-bound extraction, explicit send
intents and post-timeout reconciliation. See `spike/APP-PROOF.md`.

## 2026-10-09: installed T3 qualification needs explicit boundaries

Separate `T3CODE_HOME` did not isolate native history discovery. The profile had
382 other metadata records; the controllers did not inspect their transcripts.
Discovery/import internals were not independently audited. An external
read-only MCP client correctly refused Full-access launch; supported OAuth
enrollment supplied the required ceiling. T3 detach effect success lacked a
physical native-unload receipt. The first busy test sent an underspecified reply
prompt; separate receiver instructions fixed the bounded exchange. Claude's
foreground `sleep 25` was blocked, so generation cancellation was tested
separately without bypassing that restriction. Prevention: distinguish state
roots, grants, model consumption, host detach and physical runtime teardown in
the qualification runner. See `T3CODE-QUALIFICATION.md`.

The commit secret scan initially classified two SHA-256 evidence digests as
generic API keys because their JSON map keys contained authentication terms.
The values were recomputed file digests, not credentials. Changed the evidence
index to explicit `file`/`sha256` records instead of suppressing the scanner.
