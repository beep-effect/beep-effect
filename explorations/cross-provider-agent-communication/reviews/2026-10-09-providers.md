# Provider factual review

Reviewed 2026-10-09: exploration packet in the `cross-provider-agent-comms` lane, against the same-session research report and primary sources already inspected during this session. No new provider calls, model probes, configuration changes or repository edits.

## Final findings

0 actionable findings on the corrected files reviewed below. The initial P2 scope finding was repaired and rechecked in `RESEARCH.md:55`, `research/PROBE-PLAN.md:10-17`, and `research/ARCHITECTURE.md:8-12`.

The provider table now explicitly names ChatGPT Desktop/Work/cloud-backed chats and preserves unknown attachment state. The probe matrix separates local executor from cloud backing and ordinary web chat, requiring app/backend inventory before mapping endpoints. The architecture adds app host/backend identity to the ownership model. Codex success cannot substitute for the requested ChatGPT app cells.

## Resolved initial finding

### P2 — Include the requested ChatGPT app surface explicitly in the acceptance matrix

Locations: `explorations/cross-provider-agent-communication/RESEARCH.md:55`; `research/PROBE-PLAN.md:10-13`; related `BRIEF.md` Codex/ChatGPT bridge label.

The operator named ChatGPT alongside Grok, Claude and Cursor, then selected existing app sessions plus Beep-launched workers. The current matrix names only “Ordinary ChatGPT cloud chat” and “ChatGPT cloud chat where exposed.” Codex app-server control is explicitly a separate runtime, so the requested existing ChatGPT app surface cannot be silently represented by the Codex row. This could let a later spike report all requested families covered using a Codex Desktop pass and an ordinary-cloud-chat unknown, without inventorying the actual ChatGPT Desktop/Work local chat the operator uses.

Action: add explicit ChatGPT app rows for relevant backing kinds (ChatGPT-backed cloud conversation, local Work/Codex-backed task where available), with UI identity, backend identity, existing-session attachment, busy delivery, idle wake, permission continuity and evidence status. If the exact app/backing is not yet established, record it as an unresolved discovery cell rather than assuming cloud-only. No new inbound API claim is required. A Codex protocol pass counts for that ChatGPT app row only when the same visible conversation and its backend ownership are proven.

Basis: original request and scope choice in `CAPTURE.md`; the packet's own distinction between ordinary ChatGPT conversations and Codex app-server; primary [Codex app-server documentation](https://developers.openai.com/codex/app-server) establishes Codex thread control, not a universal ordinary-ChatGPT control API.

## Checked with no other actionable findings

- Claude Code channels stay documented-preview, installed-help absence stays a local observation, and Desktop attachment remains unverified. The packet does not infer generic MCP idle wake.
- Codex queue/agents/proxy are HELP-observed at installed 0.162.0; ownership and permission continuity remain required. Queue and active `turn/steer` are separate.
- Grok ACP and server/leader entry points are interface-observed; upstream interjection source is not treated as installed-build verification.
- Cursor ACP is correctly separated from stronger SDK local steering. Detached/cloud fallback and arbitrary IDE attachment remain explicit limitations.
- Resume/fork/new-runtime behavior is not sold as live attachment; concurrent writers are forbidden.
- A2A/ACP/MCP operate at different boundaries, with version pinning and no universal app-control claim.
- Agent Relay adoption is conditional on identical native-versus-Relay probes; the packet does not claim the winner has already passed.

Final result: zero actionable findings after the scope repair; no provider-interface factual contradiction found. This is a factual packet review, not runtime delivery validation.
