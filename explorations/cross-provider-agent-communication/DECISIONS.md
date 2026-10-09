# Decisions

## 2026-10-09: capability is the selection criterion

Question: What should this exploration optimize?

Answer: The operator prioritizes capability and asks for a new packet grounded
in the earlier goal and exploration work. Preserve that lineage and re-evaluate
its exclusions against the current workflow. This request authorizes research
and a proposal; it is not evidence that any transport is deployed.

Rationale: Prior packets optimized narrower collision awareness and PR-event
notification. Their time bounds and same-host assumptions do not set this
packet's capability ceiling.

## 2026-10-09: connect existing sessions and managed workers

Question: Which outcome matters most for the first implementation?

Answer: The operator selected "Connect existing app sessions and Beep-launched
agents (Recommended)" through the structured question interface.

Rejected alternatives: managed workers only; existing app sessions only.

Rationale: A solution that works only after replacing the user's working
sessions would miss half the requested outcome. Both integration modes must
appear in the acceptance matrix, with unknown cells left explicit.

## 2026-10-09: proposed architecture, pending alignment

Recommendation: Beep owns durable addressing, messages, receipts and orchestrator
integration. Provider adapters use each runtime's strongest supported control
interface. Prefer explicit native session attachment, then opt-in launch
wrappers, then clearly marked queued/pull fallback. Evaluate Agent Relay as a
replaceable delivery implementation in a head-to-head spike before committing
to a new delivery engine.

Rationale: Neither a transport standard nor a messaging product proves delivery
into every existing desktop session. Keeping capabilities per session preserves
steering, cancellation, attachments, and remote routing when a provider has them.

Rejected as the default: a lowest-common-denominator MCP polling loop; a new
shared-memory service; a universal ACP wrapper that hides native steering;
silent CLI resume into a session already owned by an app; treating notifications
as permission to delegate or merge. These are engineering recommendations,
not new repository law. No global settings were changed.

Reversal: swap an adapter/backend behind the same delivery receipts. Keep
provider-specific extensions and raw bounded protocol metadata so capabilities
are not lost during normalization. No production migration is part of this
exploration.

## Pre-spike frontier (superseded below)

1. Confirm the proposed brief and the first capability spike before graduation
   (settled by the operator acceptance recorded below).
2. Determine experimentally which installed app-session routes deliver while
   busy and wake while idle, preserving the visible session and permissions.
3. Select native Beep delivery versus Agent Relay integration from that evidence.

The second and third questions are technical research work, not facts for the
operator to supply. Remote hosts, richer attachments and external A2A clients
remain in the capability roadmap; they are deferred until local attachment
proof to keep failures attributable. No provider is dropped from the spike.

## 2026-10-09: accepted brief; run the bounded capability spike

The operator accepted the brief and requested the spike through the structured
closeout answer. Both existing app sessions and managed workers remain in scope.
Run disposable native-provider tests and the adoption comparison within existing
authorized subscriptions, recording unsupported and unavailable cells explicitly.
This is a research loop to settle implementation choices; it does not install
a production router or take over the active fleet orchestrator.


## 2026-10-09: native adapters first; Relay adoption remains conditional

Question: What does the executed spike justify implementing?

Answer: Start the Beep-owned contract with native Codex app-server, Claude
persistent stream input and Grok ACP adapters. Preserve per-session capability
and permission evidence. Use a transactional local store, with SQLite the
leading candidate. Keep Agent Relay replaceable and optional for the first
local slice; re-evaluate its full backend when the missing cells can be tested.

Rationale: Native routes delivered model receipts and a two-provider exchange.
Relay local-only passed synthetic queue/recovery tests, but disables remote
capabilities and rejects absent recipients. It also lacks native Grok/Cursor
adapters. Neither side has completed production or existing-app qualification.

Rejected: treating PTY heuristics as equivalent to steering; declaring Relay's
full backend inferior from local-only tests; waiting for Cursor access before
implementing already-qualified native edges; dropping Cursor or existing apps
from acceptance. Reversal: replace delivery drivers behind the versioned receipt
contract, preserving the journal and capability evidence.

## 2026-10-09: explicit policy is a resume precondition

Question: How should a bridge recover a provider session?

Answer: Persist the enrolled permission/model fingerprint, supply explicit
policy on server startup and resume/queue, and compare effective settings before
inference. Refuse or hold any mismatch; preserve both widening and downgrading
as failures. Never derive authorization from peer text.

Rationale: Codex preserved readOnly/never on client reconnect but returned
`dangerFullAccess` after server restart without overrides. The probe stopped.
A separate combined server-default and explicit-resume/queue mitigation passed.
It does not establish each setting's independent sufficiency or Desktop safety.
Reversal: disable resume for the affected adapter while retaining pending mail.

## Current frontier

- Existing visible app enrollment and bidirectional autonomous reply-tool
  proof are the next technical research gate. ChatGPT-backed kinds remain
  distinct from Codex-owned CLI sessions.
- Cursor's approved route must pass actual generation. No money or model-pin
  change was made; any paid remedy requires the operator's separate decision.
- Production durability, owner fencing, Yeet integration, group/attachment and
  remote-host tests are DEFERRED to implementation; disposable fixtures cannot
  qualify those components. Full Relaycast deployment comparison is DEFERRED
  until a scoped local/self-hosted test can be run without new paid services.


## 2026-10-09: include a measured browser conversation route

Question: Can a disposable existing app exchange replies with a managed peer?

Answer: Yes for one already-open Claude web conversation while idle, through a
controller-mediated visible browser bridge. It returned the managed Grok nonce;
the same Grok session acknowledged the exact reply, the acknowledgement returned
to Claude, and the app transcript survived reload. The separate busy-send attempt
remained unsent after a browser timeout. Native Desktop and autonomous tools are
not qualified by these results.

Rationale: This proves an actual last step into an app conversation without
operator copy/paste, while preserving the distinction from native steering or
permission inspection. The running Codex Desktop instead owns a separate stdio
runtime, so its managed CLI results cannot establish app enrollment.

Decision: Keep native adapters preferred, add an optional browser-mediated
bridge with explicit enrollment and a narrower capability record. Before
production, implement send-intent persistence, same-conversation checks,
assistant-message extraction and timeout reconciliation. Never retry an ambiguous
click as if it were a failed model operation. Reversal: remove the test tab/bridge
enrollment and keep its receipt; no global settings were changed.

Remaining frontier: production autonomous tool integration; native app enrollment
with observable permission continuity; Cursor's approved access route; browser
busy-state reliability. The full backend/remote comparison remains deferred.

## 2026-10-09 — Graduate the local implementation

**Question:** What follows the completed native and visible-app spikes?

**Answer:** The operator selected “Graduate implementation goals and begin the router plus session bridges.” The promised-now packets are [agent-message-router](../../goals/agent-message-router/SPEC.md) and [agent-session-bridges](../../goals/agent-session-bridges/SPEC.md). Implement a local durable router first and compose owned native sessions with autonomous message tools.

**Rationale:** The measured interfaces support a useful managed capability now. The visible Claude web exchange remains valid controller-mediated evidence, while a production browser driver requires additional implementation and qualification. The initial router supports direct scoped addresses. Role enrollment and production orchestrator integration remain unsupported until existing register authority is explicitly composed. No peer message grants authority.

**Deferred frontier:** Native Desktop enrollment and app-wide continuity move to `agent-existing-session-enrollment`; a deployable browser bridge moves to `agent-browser-session-bridge`; cross-host operation moves to `agent-communication-federation`; production role handoff and Yeet producers move to `orchestrator-live-coordination`. Reopen at decompose when the gates in MAP fire. Cursor generation remains blocked on existing-plan access; no billing/model change is authorized.

**Rejected:** Keeping the exploration open until every requested app has a production adapter; that would hide executable work already established. Also rejected treating the browser controller or managed workers as native Desktop attachment.

## 2026-10-09 — Native desktop orchestration is the next capability gate

The operator clarified that web-app integration is optional and selected
"Claude Code in Desktop ↔ Codex/local coding chats in ChatGPT Desktop" as the
first native target. Either visible coding session should be able to orchestrate
and exchange messages with the other. T3 Code is an authorized alternative to
compare if its session control is stronger.

The managed router/bridge implementation remains a foundation, not proof of this
native desktop outcome. Evaluate extensions, plugins, MCP integration and desktop
modifications for existing-session attachment, bidirectional context consumption,
idle wake, active-turn delivery and permission continuity. Distinguish an app
hosting a newly launched provider session from attaching the same conversation in
another app. Do not default to a provider solely because its model has messaging
tools. The native acceptance gate controls the recommendation; a browser route is
not required to complete it.

The operator also requested skill updates so both Codex and Claude can orchestrate
and discover the cross-provider tools. Shared skill routing can be updated once
the managed implementation is qualified, while explicitly preserving the separate
native-app gate and provider-specific fallback rules.
