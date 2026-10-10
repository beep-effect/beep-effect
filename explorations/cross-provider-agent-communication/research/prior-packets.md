# Prior packet inventory for cross-provider real-time communication

Read-only repository-document research, 2026-10-09. Repository: beep-effect8. Claims below describe recorded packet evidence; historical vendor capability claims require present-day re-verification. No source code inspection, paid calls, runtime communication experiments, or repository edits were performed. A targeted memory-registry lookup had no matching entries.

## Conclusions that should govern the new exploration

1. The operator remembers correctly: the strongest prior communication packet is `explorations/fleet-coordination`, graduated into retained `goals/fleet-mirror`. Its explicit settled decision is push to reachable sessions plus pull for everyone, with the derived mirror authoritative. It did NOT ship a general cross-provider messaging plane. `goals/fleet-mirror/README.md:35-46` explicitly says rung 2 is decided but unimplemented; lines 50-65 describe shipped rung 1/1.5.
2. Newer actual delivery evidence reverses an optimistic September design: `explorations/pr-event-awareness/research/2026-09-28-W7-socket-probe.md:36-46` measured foreground/in-flight Claude child delivery, but every detached sender failed. Its lines 58-96 explain the result and cut W8, the idle-wake inbox tail. `goals/yeet-pr-events/README.md:9-11` confirms the cut and completed-retained status is at line 5. Do not revive the SessionStart tail as already-proven delivery.
3. Older rejection of Buzz/ACP/A2A concerned a narrow collision-mirror objective, 1–2-day appetite, human-started TUIs, and same-host scope. Those are context-specific judgments, not capability ceilings for a new capability-first exploration. Buzz was explicitly corrected to harness-agnostic and viable as an alternative session-owning operating model (`explorations/fleet-coordination/research/T1-prior-art.md:375-396`).
4. New orchestrator policy gives a useful coordination owner, register, handoff and merge gate; it does not establish a real-time transport. The new exploration should compare (a) attach to existing independent sessions and (b) orchestrator-owned spawned sessions, and separate launch, discovery, queued delivery, mid-turn steering, idle wake, durable receipt/ack, restart recovery and permission continuity.
5. Current doctrine limits cross-provider *delegation*: originating orchestrator decides and launches; Cursor and grok-build workers do not delegate onward (`docs/runbooks/agent-pools.md:27-35`). A messaging bus need not grant recipient launch or merge authority. Treat this as a design constraint while preserving capability-first evaluation.

## Primary lineage: fleet-coordination → fleet-mirror

- `explorations/fleet-coordination/CAPTURE.md:10-21`: original operator requested a message board between independent clones so agents could relay main/policy changes.
- `explorations/fleet-coordination/README.md:14-27`: Mode A duplicate repairs, Mode B policies landing under other PRs; same filesystem/kernel/user; cross-machine was explicitly out of that packet.
- Manifest `explorations/fleet-coordination/ops/manifest.json`: graduated; no open questions; retained goal fleet-mirror.
- `explorations/fleet-coordination/DECISIONS.md:11-18`: D1 chose a read-only derived fleet view and excluded a claim registry, mutual exclusion and enforcement.
- `explorations/fleet-coordination/DECISIONS.md:309-340`: D7 kept push and pull in the retained mirror goal; push is targeted acceleration, not authority. Reachability cannot be assumed.
- `explorations/fleet-coordination/README.md:64-71` and `research/T6-cross-session-messaging.md:150-166`: August measured a live/busy Claude session without a socket. Session existence/liveness must not be derived from transport reachability.
- `research/T6-cross-session-messaging.md:46-100`: historical Claude 2.1.224 capability inventory: discovery/delivery tools, Unix socket same-machine transport, per-user restriction, non-guaranteed delivery and acceptance/hold/drop mechanics; messages are consumed at boundaries rather than universal instantaneous interruption.
- `research/T6-cross-session-messaging.md:230-276`: permission-mode-dependent inbound holds, expiring holds, unattended workers and incomplete fleet coverage; registry covers Claude only, transport misses non-Claude/dormant/container sessions.
- `goals/fleet-mirror/README.md:50-65`: recorded shipped read-only `beep worktree fleet`, positive-only Claude registry liveness guarded against PID reuse, live-ranked contested rows.

### Staleness inside this lineage

`goals/fleet-mirror/SPEC.md:14-16` and `:31-32` still say rung 2 is blocked on speed-loop PR-I. Later D7 and README explicitly remove that dependency and retain rung 2 as unimplemented. `goals/fleet-mirror/PLAN.md:59` still says exploration stays active while rung 2 remains unbuilt, but exploration manifest/README say graduated. Prefer dated amendments and explicit scope-status statements; do not silently equate completed-retained rung 1 with completed messaging.

## Newer PR-awareness lineage: pr-event-awareness → yeet-pr-events

- `explorations/pr-event-awareness/README.md:14-19`: desired seconds-scale awareness of conflicts, review comments and reds; attributed/coalesced dispatch by orchestrator.
- `explorations/pr-event-awareness/README.md:83-105`: September research found no workstation push source for those events, missing durable production in canonical monitor mode, session-id forwarding gaps; align chose durable producer, session-owned inbox tail, human escalation for no live owner, orchestrator dispatch and 30 s polling.
- `explorations/pr-event-awareness/DECISIONS.md:135-157`: producer and reader share checkout inbox; workstation-wide inbox and webhooks deferred. Those scope constraints are narrower than cross-provider conversation.
- `explorations/pr-event-awareness/DECISIONS.md:259-286`: D15 assumed a SessionStart-spawned own-child inbox tail could bypass holds; rejected changing user inbound policy.
- `explorations/pr-event-awareness/research/2026-09-28-W7-socket-probe.md:11-27`: measured newline JSON wire shape, no server reply, receiver transcript necessary to establish delivery. Connect/write success alone is insufficient evidence.
- Same probe `:36-46`: foreground and background while tool invocation remained in flight delivered; delayed background, setsid and systemd detached senders did not.
- Same probe `:58-96`: own-child evidence scoped to in-flight invocation. Slice 2 cut; no rejected opt-in revived. Retained paths: hook injection at next tool call, desktop set_monitor, monitor-side dead-owner notification.
- `goals/yeet-pr-events/README.md:9-11`, `:48-55`: slice 1 PR #1270 shipped durable capture; socket failure cut W8. W9/W10 recorded closeout surfaces. This research did not verify current implementation directly.

### Related Codex evidence needing refresh

`explorations/pr-event-awareness/RESEARCH.md:608-616` records a locally verified codex-cli 0.156.1 `codex queue --thread ... --message ...` and `codex agents` against shared app-server, explicitly undocumented. This is a strong historical lead, not evidence that today's installed CLI exposes the same interface. The current user's AGENTS permission-continuity warning makes Desktop send_message_to_thread a separate unsafe continuation lane pending verification; do not conflate queue/resume/app-server and desktop task messaging.

## Prior art verdicts that deserve reconsideration under capability-first scope

- MCP Agent Mail: `explorations/fleet-coordination/research/T1-prior-art.md:62` and `:125-145` recorded identities, threaded inboxes, advisory leases, tooling, pull requirement; rejected as heavy/wrong delivery for ambient collision awareness. Prior claim that upstream said “No broadcast by design” was refuted; Human Overseer composer supports select-all. New exploration should verify today's push/wake integrations rather than inherit a disproven quote.
- A2A/AGNTCY ACP: same report `:77` and `:196-205` rejected as service interoperability rather than repo-file collision detection. This does not reject their relevance to cross-provider communication.
- Buzz: same report `:375-396` corrected a false “replace Claude” claim: harness-agnostic; Claude and Codex adapters; spawned harness stdio gives delivery; no attach-to-existing-session ACP verb recorded. `:403-413` historical cross-host/size constraints; `:417-440` recorded noisy/quiet/wrong-story communication failures and loop control requirements. Evaluate orchestration-owned sessions distinctly from independent existing Desktop/TUI sessions.
- Claude native Agent Teams: `explorations/fleet-coordination/research/SYNTHESIS.md:552` records file-locked shared claims and automatic mailboxes. It is a reference for same-harness transport, not four-provider interoperability.

## Supporting packets, with limits

### cursor-agent-pool → agent-pool-doctrine / agent-pool-picker

`explorations/cursor-agent-pool/README.md:16-25` captures pool utilization/parity and graduation. Historical model defaults in that spark are superseded by 2026-10-01 policy. D6 (`DECISIONS.md:70-81`) locks Cursor to Bash `cursor-agent -p`, rejects undocumented provider adapter/Workflow-child route. D9/D13 (`:109-118`, `:163-175`) establish measured hooks admission while recording missing events; not real-time peer messaging. `goals/agent-pool-doctrine/README.md:11-16` carries current chains; lines 38-42 still describe an old uncommitted P1 snapshot, so use its dated policy/runbook rather than assume whole packet complete. Picker is a routing selector, not messaging transport.

### orchestrator-handoff

`goals/orchestrator-handoff/README.md:5` active; `SPEC.md:5-8` register/handoff/gate objective, `:48-59` durable state location, role, register renderer, handoff template, merge gate, exact-head/fail-closed rules and typed active/blocked/unreachable/retired states. `:61` preserves delegated editing with owner commits. Concrete reusable authority/control boundaries for proposed communication envelopes. No generic peer bus promised.

### multi-provider-llm-dispatch-fallback → llm-provider-subscription-auth

`explorations/multi-provider-llm-dispatch-fallback/README.md:14-30` graduated shipped vendor-CLI auth leg; ordered runtime dispatch demand-gated and unscaffolded. `goals/llm-provider-subscription-auth/README.md:18-22`, `:46-49` retained provider-instance/auth-probe/home-isolation/persistence implementation. Authentication and model dispatch are separate from runtime messages into agent sessions.

### agent-fleet-layout

`explorations/agent-fleet-layout/README.md:14-28` 2026-10-05 lane/seat/registry layout graduated to five goals. Registry over existing mirror is an ownership/discovery input, not messaging proof.

### unified-ai-toolchain and agent-chat-interface

`goals/unified-ai-toolchain/README.md:9-19` retained schema/sync V1; V2/V3 conditional; `SPEC.md:96` explicitly excludes runtime control of agents/sessions/servers/IDEs. `explorations/agent-chat-interface/README.md:14-32` is product chat-input/domain work; ACP chat binding deferred. Neither establishes cross-provider agent communication.

### agent-execution-sandbox → agent-execution-authority

`explorations/agent-execution-sandbox/README.md:28-35` chat-egress and host-isolation follow-ons gated; `:43-53` execution authority/schema grants and records. Product policy boundary, not a workstation transport implementation. Keep it distinct while studying communication authority.

## Suggested questions for the new packet

- Which actual surfaces must communicate: human-started Desktop chats, independent TUIs, headless workers, cloud jobs, orchestrator-spawned ACP/app-server sessions? Each has different attach/wake/steer capabilities.
- Does success require delivery while idle, steering while busy, bidirectional replies, durable ack/replay, or only event awareness? Measure each separately.
- Can existing subscriptions support each route; does launch/control need new paid APIs? Model fallback policy is not implicit spending authorization.
- Could a provider-neutral local broker consume typed messages and provider adapters while keeping register/ledger authoritative and recipient authority explicit?
- Which old scope exclusions should be deliberately lifted under the new capability-first priority, and which remain binding current policy?
- How will sender/recipient identity, session replacement, permission continuity, delivery receipts and communication-loop budgets be established with live local tests?
