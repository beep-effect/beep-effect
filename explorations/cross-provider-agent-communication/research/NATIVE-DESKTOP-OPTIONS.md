# Existing native desktop conversations

Evidence date: 2026-10-09. Selected scope: **Claude Code Desktop ↔ Codex/local
coding conversations**, with either agent coordinating. Browser mediation is
optional. T3 Code is evaluated separately in `T3CODE-OPTIONS.md`.

The managed Codex/Grok/Claude proofs establish Beep-owned processes. They do not
establish attachment to an existing first-party desktop conversation. A native
bridge is plausible through documented extensions, but the selected pair has
not passed an existing-session autonomous round trip.

## What current sources establish

Claude Code documents same-machine messaging sockets, an address exposed by
`/status`, and script/hook senders. Accepted messages can start an idle turn;
active receivers read them between tool calls. Delivery retains receiver
permissions. Inbound accept/hold/refuse decisions also depend on sender trust
and permission classes; a detached external process cannot assume the privileges
of an owned child. This is a live-session inbox, not arbitrary history resume.
[Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging).

The Desktop Code tab separately documents listing and messaging its own local,
SSH and WSL Code sessions. Replies travel back through that surface; busy
receivers read messages after their current work finishes. Terminal and cloud
sessions are outside this app-specific listing. Unattended sessions and inbound
controls impose additional restrictions. These are two distinct messaging
paths with different busy behavior.
[Desktop session messaging](https://code.claude.com/docs/en/desktop#work-across-sessions).

ChatGPT plugins document local MCP apps in Desktop. The OpenAI MCP extensions
specification documents desktop thread panels and negotiated
`hostCapabilities.experimental["openai/message"]`. An MCP App can issue
`ui/message` for `active` or `new`, with sending enabled by default. The method
does not expose an arbitrary dormant thread identifier. A panel bound to the
existing conversation is therefore a concrete native integration candidate;
background lifetime, busy behavior, permission continuity and support in the
selected local coding host remain unverified. Updating model context alone
does not demonstrate wake.
[Desktop plugins](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt),
[extension specification](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md),
[extension guide](https://developers.openai.com/plugins/build/extensions).

Codex app-server documents thread start/resume and active-turn steer/interrupt,
including expected-turn identity checks. Those operations provide stronger
controls when a client owns or legitimately enrolls the runtime. The API docs
do not establish attachment to the currently running Desktop stdio child.
[App-server protocol](https://learn.chatgpt.com/docs/app-server).

## Installed evidence and boundaries

Read-only package metadata reported `claude-desktop 2.26454.2-1`,
`chatgpt-bin 26.1007.21434-1`, and Claude Code `2.1.295`. The ChatGPT application
archive identifies `openai-codex-electron`; the Claude archive identifies
`@ant/desktop`. Static application bundles contain Claude desktop Code session
management tools and Cowork dispatch operations, and OpenAI desktop thread tools
including `send_message_to_thread`. Presence of internal tools is not an
external service contract or permission to invoke them from Claude.

The earlier installed-process discovery found Desktop's bundled Codex
`0.162.0-alpha.17.2` running app-server with default stdio. The shared daemon was
absent. Static startup code recognizes `CODEX_APP_SERVER_USE_LOCAL_DAEMON=1`,
subject to CLI/version and host eligibility gates, with stdio fallback. Starting
an isolated app profile or a new daemon would qualify that profile, not attach
the existing running conversation. Never write to the app's anonymous stdio
descriptors as a second client.
[Exact installed discovery receipt](spike/app-discovery/REPORT.md).

Static-source fingerprints retained for reproducibility:

| Archive member | SHA-256 |
| --- | --- |
| Claude `index.chunk-BGHqtHXd.js` | `d60614ab74f38dfd892f2e7dd74691bd95bd5e3178a9cc086be5a2cc4d18fcc0` |
| ChatGPT `application-network-startup-CfAQmSYg.js` | `cd6e8a8fbc4354a6e6ff19c6e4bf6fc1fb3960c63708c83871357c6238f516a8` |
| ChatGPT `main-39FdJ_vp.js` | `78ffc19681d7605d0b48c8cbfdc185211a58d218c4512647de567519dd5ca3bc` |

No chat transcripts, credentials or user configuration values were inspected.
No native application was modified, and no message or model turn was sent in
this research pass.

## Surface qualification matrix

| Receiver surface | Outbound tools | Incoming wake / control | Current disposition |
| --- | --- | --- | --- |
| Claude Code Desktop | App session messaging and local MCP documented | App session path plus separate Code inbox documented | Native target; cross-provider sender enrollment unqualified |
| Claude Desktop Chat | Local `.mcpb` tools documented | Generic MCP does not by itself establish idle wake | Outside selected coding pair |
| Claude Cowork | Plugin-local MCP and dispatch capabilities documented/static | Externally callable existing-task wake contract unqualified | Keep separate from Code |
| Codex Desktop local coding | Installed app thread tools observed; local plugins documented generally | `ui/message` host negotiation candidate; app-owned runtime attach unqualified | Primary unresolved receiver |
| ChatGPT Desktop local Work | Local MCP App candidate | Same host-capability/lifetime qualification needed | Distinct backend identity |
| ChatGPT Work Cloud in Desktop | Plugin tools | MCP Events documents subscribed-chat processing | Alternative, not selected local route |

The cloud event route expressly includes Desktop Work with Cloud selected; it
cannot qualify local coding conversations.
[MCP Events](https://developers.openai.com/plugins/build/mcp-events).
Claude Chat extension packaging likewise supplies tools, not an automatic
conversation controller.
[Local desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop),
[MCP bundle source](https://github.com/modelcontextprotocol/mcpb).

## Recommended native architecture and next proof

Reuse the Beep broker and scoped send/reply/inbox/acknowledge tools. Package a
Claude Code plugin that enrolls its live inbox through an owned session hook,
respecting the native sender and inbound rules. Package a ChatGPT Desktop local
MCP plugin with a thread-entrypoint panel. The panel binds an explicit enrolled
conversation, receives broker events and requests `ui/message`; the model uses
the scoped reply tool to return the response. Tool availability supplies the
outbound half; host-supported message injection supplies the inbound half.
Although `ui/message` uses a protocol user-message role, the content must plainly
identify the enrolled peer and synthetic-message provenance. It must not claim
to be the operator, grant consent, or change the receiver's scoped tool grants.

Start with a disposable native app profile and coding conversation to negotiate
the actual host mode, exercise the plugin, and inspect effective policy before
and after delivery. General ChatGPT Desktop plugin support cannot stand in for
the selected Codex local coding host. Only after that qualification should the
same mechanism enroll an existing user conversation. A live panel receiving an
event proves neither background wake nor model consumption; receipts must
separate broker acceptance, host submission, model reply and settled ACK.

Prefer this extension route before an app modification. If the selected coding
host lacks the message capability or background delivery, investigate a
version-fenced host adapter using the app's own session actions and permission
binding. An ASAR patch is a possible engineering fallback, not a proven or
supported integration. A shared runtime requires actual desktop enrollment and
exclusive turn ownership, not a second independent resume writer.

Claude Code Desktop is the stronger documented default coordinator for existing
native sessions. Codex Desktop can be considered as the coordinator after its receiver and
permission continuity pass. Either model can coordinate once both receivers
are qualified; choosing an orchestrator does not repair a missing inbound path.

| Disposable test | Required evidence |
| --- | --- |
| Enroll selected existing local coding chat | Host/backend identity; negotiated message capability; no history scan |
| Idle synthetic nonce in both directions | Same conversation receives, model replies via scoped tool, ACK settles |
| Busy synthetic exchange | Actual queue/steer semantics; no claim based only on transport acceptance |
| Panel background / close / app reload | Delivery lifetime and restored same-conversation identity |
| Permissions before and after wake | Same effective sandbox/approval policy; stop immediately on mismatch |
| Cancel and stale delivery | Targeted turn identity, terminal cancellation, no later cross-turn completion |

The repository's existing warning about Desktop background continuation remains
a hard constraint: `send_message_to_thread` can rehydrate unrestricted local
threads with managed permissions. Its availability inside this Codex session
does not prove a Claude-accessible external service. Do not use it as the native
bridge until the installed build's effective policy continuity is verified.
