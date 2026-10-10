# Capability probe specification

2026-10-09. Acceptance specification retained after the authorized bounded
spike. [Executed results](spike/README.md) record which cells ran, failed or remain
unknown. This full matrix is not complete. Use disposable sessions and existing
authorized subscriptions; do not resume or inject into unrelated live work.

## Required matrix

Record every cell for Claude Code terminal/IDE/Desktop, Codex terminal/IDE/app,
ChatGPT Desktop/Work chats split by local executor versus cloud backing, ordinary
ChatGPT web chat, Cursor local CLI/IDE/cloud, and Grok CLI/GUI/
server. Not every product must support every action, but every requested family
must have explicit evidence for both existing and Beep-launched sessions.
Inventory actual app host and backend identity before mapping endpoints. A Codex
thread ID, a Work local executor and a cloud ChatGPT conversation are separate
identities until a supported app contract explicitly connects them.

| Operation | Busy | Idle | Disconnected/restarted |
| --- | --- | --- | --- |
| Direct request and reply | Context delivery or explicit queue receipt | Wake same enrolled session | Durable defer and resume/reconnect receipt |
| Steering | Same active turn acknowledged, or typed unsupported | Start a new turn, clearly labelled | Stale-turn rejection |
| Cancellation | Targeted turn cancellation and result | No-op result | Never kill another owner |
| Group/topic message | Per-recipient receipts | Bounded wake fan-out | One logical recipient receipt; retries retain its ID |
| Handoff | Old role holder fenced | New role holder receives pending role messages | Epoch survives restart |
| Artifact/attachment | Supported typed content or reference | Same | Digest and access check on replay |

## Evidence per attempt

Provider, app build, CLI version, adapter version, protocol version, model and
effort; opaque test session and turn IDs; launch/attach method; declared and
observed capabilities; sender/recipient identities; permission profile before
and after; message nonce; requested delivery mode; each timestamp; process
ownership; received transcript marker; recipient acknowledgement; terminal
receipt. Sanitize identifiers and paths in public reports.

A fresh unrelated nonce in the recipient's response and the original session
identifier are required to prove model receipt. A socket write, MCP notification
or HTTP 200 alone proves only its own transport step. UI evidence is required
for the claim that the exchange appeared in the existing app conversation.

## Minimal procedure

1. Create two disposable workspaces outside `/tmp`; assign fixed versions and
   repo-approved model pins. Managed workers use minimal dedicated config.
2. Enroll one human-started session and one managed worker. Capture permission
   identity and ownership, without printing tokens or session transcripts.
3. Send a short nonce request in each direction. The target echoes the nonce
   through its reply tool. Repeat idle and during a bounded read-only task.
4. Test native steering separately from queued follow-up and interrupt/restart.
5. Enqueue offline, restart the broker, reconnect, duplicate the send, and lose
   the acknowledgement after target consumption. Reconcile without claiming
   exactly-once model side effects. Repeat with an adapter that cannot inspect
   consumption: retain an ambiguous receipt and hold unsafe retries.
6. Transfer orchestrator role with a role-addressed message and a direct reply
   to the old run pending. Route only the former to the successor. Maintain one
   logical receipt per message/recipient despite repeated transport attempts.
   Crash before/after every handoff write; race competing claims and an in-flight
   predecessor control action. Reconcile ledger/epoch disagreement; reject stale
   queued actions and wait for an accepted action outcome before activation.
7. Attempt a stale target, concurrent session resume, wrong-repo target and
   unsolicited model/permission change. Verify typed refusal/defer receipts.
8. Remove only test enrollment and processes. Read back permissions and verify
   no live work was touched.

## Pass criteria and measurement

Proposed local objectives: broker durable acceptance p95 <=100 ms; delivery to
an already-ready runtime p95 <=1 s; wake acknowledgement p95 <=3 s when a
provider supports it. Measure model reply latency separately. Run 100 non-model
transport samples per route and at least five idle plus five busy model exchanges
per provider/mode within existing quota. Failure is a finding, never a hidden
average. These numbers are proposed targets, not promises or observations.

Must pass regardless of latency: zero silent drops; no wrong-session delivery;
no duplicate logical receipt; no permission widening or downgrade; no transcript
fork presented as attachment; no second writer into a live provider session;
crash-consistent retries; message-loop budget; cancellable bounded wake work.

## Adoption comparison

Run identical native-Beep and Agent Relay cases on fixed revisions. Compare
per-session control depth, all four provider families, existing UI integration,
recovery, remote routing, payloads, model pins and local deployment. Integration
cost breaks ties after capability. Adopt Relay components if they win these
cases; build only the missing Beep contract and provider bridges. Do not install
an upstream's auto-setup over live user configuration during a probe.

## Truthful result vocabulary

`documented`, `help-observed`, `handshake-verified`, `transport-accepted`,
`context-received`, `same-session-woken`, `active-turn-steered`, `unsupported`,
`failed`, `unknown`. The production delivery enum need not use these exact
names; the report must preserve their distinctions.
