# Grok native communication spike

2026-10-09. Bounded synthetic tests on installed Grok Build 1.0.50 (c58f321264ba), `grok-4.7` medium. Model usage events report `grok-4.7-build`. Existing cached subscription authentication; no API-key fallback, new billing route, credential copy, global configuration edits or unrelated session attachment.

## Verified results

- ACP initialize/authenticate/session-new succeeded. New-session model/config options confirm `grok-4.7` and `medium`.
- Wire extension `_x.ai/interject` accepted requests with `status: queued`. The upstream handler name `x.ai/interject` needs the ACP wire underscore; the unprefixed request returned -32601 Method not found.
- Five idle interjections produced five nonce-bearing assistant replies in the same owned session. Observed latency: 1.705, 1.304, 1.704, 1.203 and 1.304 seconds. This demonstrates idle wake through queued prompt fallback.
- Five requests sent while the original bounded prompt remained pending produced five nonce-bearing assistant replies. Each nonce arrived after the original prompt's `end_turn` response; classify as queued follow-up. Observed latency from initial busy prompt dispatch: 8.589, 5.336, 6.332, 4.542 and 7.161 seconds. **Same-active-turn steering was not demonstrated.** Timestamp classification was recomputed from accumulated assistant chunks, handling nonce fragmentation.
- Targeted `session/cancel` returned the original prompt's `stopReason: cancelled` in approximately 0.31 seconds.
- Owned private leader reconnect with explicit `session/load` accepted the same session identifier and a subsequent prompt completed. This is verified history/session resume through load, with no existing UI continuity claim.
- A second owned leader connection attempting to prompt the prior session without `session/load` failed -32602 Invalid params, `unknown session id`. ACP `agentInstanceId` changed across connections. **Live shared-backend attachment was not proven**; do not substitute the successful load path for live attach.

## Isolation and limitations

Process used a private child HOME under this spike directory, with bwrap mounting the existing auth file read-only into the private Grok home. Original credential contents were never read/copied. Minimal private config disables auto-update and envrc. Inherited API credential environment variables were omitted. Effective discovery initially showed zero hooks, skills, plugins, MCP servers and project instructions. Grok subsequently generated 22 bundled skills in its private home; hooks/plugins/MCP/project instructions remained zero. Three built-in agent definitions remain, with subagent execution disabled by CLI.

The exact native launch is retained in the private cache `handshake-result.json`; portable replay variants are included as Python sources in this packet. CLI pins empty built-in tool allowlist, no subagents, disabled web search, plan permission mode and read-only sandbox; all client tool/permission requests are refused. No tool-call or permission-request event occurred in the five-idle/five-busy trace.

The first sandbox startup failed resolving an unreadable `/run/podman/podman.sock`; child-only tmpfs masks for podman/containerd/docker runtime directories fixed that precondition. One initial unprefixed-method test was stopped via its owned Python process after method rejection; its cleanup terminated its owned child. No unrelated/default leader socket was inspected or killed.

No GUI/TUI bridge, arbitrary existing-session attach, leader restart durability, cross-provider exchange, remote route, attachment or general broker replay was tested. Five samples describe observed behavior, not statistically meaningful p95 performance. Queue acceptance alone was never counted as model receipt.

`SUMMARY.json` and `results-prefixed.json` are sanitized receipts. Raw NDJSON, stderr, handshake and effective-config files stay local mode 600 in this mode-700 directory; they can include authentication metadata, opaque IDs and synthetic transcript fragments and must not be committed. The scripts remain reusable. All owned test children and private leaders were terminated by their probe finalizers.

Protocol reference: [official Grok headless/ACP documentation](https://docs.x.ai/build/cli/headless-scripting). The inspected [upstream interject handler](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/extensions/interject.rs) informed the request shape; installed behavior above was measured independently.
