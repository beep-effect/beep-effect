# Cross-provider communication interfaces

Research date: 2026-10-09. Scope: existing app sessions and Beep-launched agents. Read-only local help/version checks and primary documentation; no model requests, authentication reads, external messages, configuration edits, or agent launches.

## Result

A capability-first broker is practical, but capability must be per *session and transport*, not simply per provider. Grok and Cursor already expose bidirectional ACP, so treating them as output-only subprocesses would discard useful capabilities. Existing desktop/IDE sessions require an owner-controlled connection or an explicitly supported inbound channel. Starting another CLI with the same persisted session ID does not prove attachment to the original running agent.

Separate `observe`, `queue_followup`, `wake_idle`, `steer_active`, `cancel_active`, `resume_history`, `attach_live`, and `fork_history`. Mark each as documented, source-observed, locally interface-observed, or end-to-end verified. This investigation did not end-to-end verify any of them.

## Local interface receipts

All commands used `timeout 15s` and returned without initiating an agent/model turn.

| Command | Observed result |
| --- | --- |
| `grok --version` | `grok 1.0.50 (c58f321264ba) [stable]` |
| `grok --help` | Single-turn `-p`; `streaming-json` ACP updates; `streaming-messages-json`; partial messages; resume/continue/fork; custom leader socket |
| `grok agent --help` | `stdio`, `headless` WS relay, `serve` WS server, `leader`; shared leader/no-leader selection |
| `grok agent stdio --help` | Stdio agent entry point; custom leader socket |
| `grok agent serve --help` | Bind defaults to `127.0.0.1:2419`; authentication secret option (no secret read or server started) |
| `cursor-agent --version` | `2026.10.01-e373342` |
| `cursor-agent --help` | Print `stream-json`, partial deltas, resume/continue, persistent sessions |
| `cursor-agent acp --help` | `Start the Cursor Agent as an ACP (Agent Client Protocol) server`; command works despite omission from root command listing |
| `cursor-agent persist --help` | Start/list/attach/stop sessions surviving terminal/SSH disconnects |
| `claude --version` | `2.1.295 (Claude Code)` |
| `claude --help` | Realtime stream-json input/output, replay user messages, resume/fork, desktop handoff, background/attach/logs/stop |
| `claude --help` filtered for channels | No `channels` match; documentation availability must not be conflated with installed flag availability |
| `codex --version` | `codex-cli 0.162.0` |
| `codex app-server --help` | Stdio, Unix socket, WebSocket; daemon/proxy; TS/JSON-schema generation; WebSocket authentication options |
| `codex queue --help` | Queue a message for existing session; `--thread` accepts UUID or exact name; `--message`; remote Unix/WS endpoint |
| `codex agents --help` | Browse all agent sessions on shared local app-server daemon |
| `codex app-server proxy --help` | Proxy stdio to running app-server control socket; explicit `--sock` |
| `codex app-server daemon --help` | Lifecycle controls and read-only `version`; none invoked |

Resolved Grok/Cursor executables were user-local `~/.local/bin/grok` and `~/.local/bin/cursor-agent`. `claude` resolves through the shell's configured command route. No configuration dumps or existing session transcripts were read.

## Provider paths and limits

### Grok Build

Official headless documentation identifies `grok agent stdio` as ACP JSON-RPC over stdin/stdout. Initialize/authenticate, create a session, issue `session/prompt`, consume text in `session/update`; prompt response supplies completion metadata. This is a two-way control transport, whereas `grok -p --output-format streaming-json` is a single-turn convenience path. [Headless and scripting](https://docs.x.ai/build/cli/headless-scripting).

The installed CLI distinguishes new `--session-id` from `--resume` and supports `--fork-session`; therefore do not repeat the older web table's claim that `--session-id` can resume. The documentation suggests `--no-auto-update`, but the installed root help lacks it: verify support before adding it.

The TUI documents active-turn interjection and cancellation. [Keyboard shortcuts](https://docs.x.ai/build/keyboard-shortcuts). Upstream official source separately shows broadcasting interjections to every attached client, injection at safe points, and conversion of idle/late interjections into queued prompt turns. This is upstream-main source evidence, not proof that installed commit c58f321264ba exposes the same request contract. [Interjection implementation](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/session/acp_session_impl/interjection.rs).

Integration choice: ACP for Beep-owned sessions; investigate the shared leader for existing TUI sessions, with explicit live attach identity and ownership. Probe exact advertised extensions before exposing programmatic steering. Do not infer that opening a second `stdio` process attaches to the desired TUI session merely because both use a leader.

### Cursor

Official ACP documentation specifies stdio NDJSON JSON-RPC, `initialize`, authentication, `session/new` or `session/load`, `session/prompt`, streamed `session/update`, permission reverse requests, and `session/cancel`. Missing responses to permissions can block progress. Cursor adds blocking question/plan requests and notification extensions; clients must handle both. [Cursor ACP](https://cursor.com/docs/cli/acp).

The current TypeScript SDK documents `run.steer(text)` for an active local run. Its promise reports `complete_delivered` or `revert_to_followup`; only the latter should trigger post-run `agent.send()`. Cloud and detached local handles always return the fallback. The method is optional, so check it directly. SDK also documents cancellation and `Agent.resume(id)`; resume does not establish that arbitrary editor chat IDs identify SDK agents. [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript).

Integration choice: ACP for common turn control; SDK for Beep-owned local sessions requiring acknowledged steering. Existing editor attachment needs a separate verified path. Persistent CLI `attach` is interface-observed and promises terminal survival, not arbitrary IDE attachment.

Print output is NDJSON; failures may exit without a terminal result. Partial streaming can include duplicate buffered/final flushes. Filter deltas rather than blindly concatenating every assistant event. [Output format](https://cursor.com/docs/cli/reference/output-format).

### Claude Code and Claude Desktop

Local CLI help exposes bidirectional stream-json input/output and replayed user messages. Official Agent SDK streaming-input documentation supports a persistent input generator, sequential queued messages, context persistence, streaming feedback, and interruption. Queueing another user message is not proof of immediate steering. [Streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode), [CLI reference](https://code.claude.com/docs/en/cli-reference).

Official Claude Code channels are the strongest documented existing-session inbound path found here: an MCP channel pushes events into an already-open session and can provide a reply tool. Research preview, Anthropic authentication only, organization enablement where applicable, and launch-time activation apply. An ordinary MCP server does not gain this capability automatically. Local help did not expose `--channels`, so detect availability rather than claiming it works on this install. [Channels](https://code.claude.com/docs/en/channels), [Channels reference](https://code.claude.com/docs/en/channels-reference).

Existing Desktop session attachment is unverified. CLI `--desktop`, background `attach`, and resume are distinct mechanisms. The reviewed Desktop page contained no channels match; that absence alone does not establish that Desktop lacks every equivalent feature. [Desktop documentation](https://code.claude.com/docs/en/desktop).

For Beep-owned Claude sessions prefer the official Agent SDK or stream-json owner process. For existing Code sessions prioritize a locally verified channel path. Never resume the same persisted conversation into two independent writers as a substitute for live attachment.

### Codex CLI/app and ChatGPT app

Official app-server exposes thread start/resume/fork/read and event subscriptions; turn start, steer, and interrupt. `turn/steer` requires the active `expectedTurnId`, appends input to that turn, and rejects absent/mismatched active turns. It cannot override model/cwd/sandbox. Interruption finishes as interrupted. `thread/read` can inspect stored history without loading/subscribing; fork creates a distinct thread. [Codex app-server](https://developers.openai.com/codex/app-server).

Installed help exposes daemon/proxy and authenticated socket transports, which are candidates for an owner-held shared connection. It does not prove that a new CLI process can safely attach to any desktop-owned runtime. Probe owner, protocol version, thread/turn identity, notification stream, and permission continuity. Session history sharing is insufficient.

Additional installed interface evidence makes shared-daemon Codex the strongest local attachment candidate: `codex queue --thread <UUID-or-exact-name> --message <text>` explicitly targets an existing session, `codex agents` browses shared-daemon sessions, and `app-server proxy --sock <path>` connects to the running control socket. These were HELP-only observations, not sends. Verify that the Desktop app's target actually belongs to this daemon and retains its permission profile. Queueing is a separate operation from `turn/steer`; do not relabel it as active-turn steering.

The local app has purpose-built task APIs, but repo policy explicitly holds its existing-task message/resume route unsafe until Full access/Never ask continuity is verified. Do not work around this by silently changing permissions. Ordinary ChatGPT conversations are a separate surface from Codex app-server threads; no generic ChatGPT conversation turn-injection API was established by this research.

## Protocol fit

ACP is a client-to-coding-agent control protocol and good common denominator for prompt/update/permissions/cancel. Session loading is capability-dependent. Standard cancellation drains updates and resolves the original prompt as cancelled; sending cancel is not a completion acknowledgement. The reviewed v1 lifecycle completes a turn before the next standard prompt; provider steering requires a supported extension or SDK contract. [Prompt lifecycle](https://agentclientprotocol.com/protocol/prompt-turn), [Session setup](https://agentclientprotocol.com/protocol/session-setup).

Official ecosystem adapters exist for Claude Agent SDK and Codex. They are candidates, not proof of live desktop-session attachment or feature parity. [Claude ACP adapter](https://github.com/agentclientprotocol/claude-agent-acp), [Codex ACP adapter](https://github.com/zed-industries/codex-acp).

A2A provides task/message interoperability, streaming, subscription and cancellation, useful for a network-facing broker. It does not attach to provider runtimes or guarantee native mid-turn steering. Pin protocol versions: v1 renamed operations and changed stream discrimination from v0.3. [A2A specification](https://a2a-protocol.org/latest/specification/), [v1 changes](https://a2a-protocol.org/latest/whats-new-v1/).

MCP resources/list changes are not a portable agent wake instruction. Even transport semantics depend on revision: the 2026-07-28 SDK migration documents `subscriptions/listen`, and replaces server-to-client sampling/elicitation requests with in-band input-required retries. Client-host support and channel-specific admission remain essential. [MCP 2026 revision migration](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28).

## Proposed probe plan

1. Interface-only capability probe: enumerate installed versions/help and generate local protocol schemas where safe. Record exact executable/version, transport, provider session identity, runtime owner and supported methods. Unknown stays unknown.
2. Transport handshake in a disposable workspace with no prompt: ACP initialize for Grok/Cursor; Codex app-server initialize. Capture capabilities and harmless method-not-found responses; suppress auth/account details. No inference unless separately authorized.
3. Beep-owned test session: observe stream, send followup while busy, wake while idle, steer at safe points, then cancel. Use unique message IDs and an agent acknowledgement containing the ID; do not equate transport acceptance with model consumption. Measure acknowledged delivery separately from work completion.
4. Existing-session probe: connect through the original owner/channel, read identity and current turn, and send one unique harmless marker. Confirm it appears in the same app transcript, survives restart once, and retains permissions. Assert only one runtime writer. Fork/resume tests use distinct receipts.
5. Boundary tests: late steer, idle message, completion-racing message, reconnect replay, cancellation drain, duplicated delivery, permission wait, compaction, and detached sender. Parent reports prior W7 evidence: running Bash-child socket delivery worked; detached senders did not wake idle. Preserve that as historical evidence until reproduced on the selected interface.
6. Fail closed on unsupported steer; durably queue a followup with explicit fallback receipt. This is especially required for detached/cloud Cursor handles. Never resend after `complete_delivered`.

## Design implication

Use a durable broker mailbox with per-session adapter ownership, monotonically ordered receipts, deduplicated message IDs and authenticated local control. Keep accepted, delivered, consumed, completed and cancelled separate. One broker owns provider stdin/control; apps connect through supported channels/shims or explicitly verified shared runtime endpoints. Expose capabilities per registered session; don't impose the weakest CLI's limitations on every provider, and don't promise strongest-provider behavior across all apps.
