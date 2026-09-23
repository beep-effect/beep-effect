# nlp-mcp capture: first stdio message against a 2026-only build

Date: 2026-09-22. Goal: `mcp-stateless-kit-and-drivers`, PR 4 (D-cli-contract).

## Setup

- Host under test: `packages/drivers/nlp-mcp` with `Server.ts` temporarily pinned to
  `statelessMcpProtocols` (`[McpProtocol.v2026_07_28]`), launched exactly as `.mcp.json` does
  (`bun run ./packages/drivers/nlp-mcp/src/bin.ts`) behind a shim that appends every stdin byte to
  a log before handing the stream to the host:

  ```sh
  exec tee -a "${CAPTURE_LOG:?}" | bun run ./packages/drivers/nlp-mcp/src/bin.ts
  ```

- Client: Claude Code `2.1.275` (the desktop app's CLI), run headless from the lane with the shim
  registered as a dynamic stdio server:

  ```sh
  claude -p "Reply with exactly OK." --max-turns 1 --strict-mcp-config \
    --mcp-config '{"mcpServers":{"nlp":{"type":"stdio","command":"<shim>","args":[]}}}' \
    --output-format json
  ```

  Once with the environment untouched, once with `MCP_PROTOCOL_NEGOTIATION=auto`.

- Codex CLI `0.156.0` was attempted (`codex exec -c mcp_servers.nlp.command=<shim>`, once with
  `CODEX_MCP_PROTOCOL_VERSION=2026-07-28` and once without) and is recorded as not captured: the
  run exited 1 before spawning any stdio server (`rmcp::transport::worker: worker quit with fatal:
  Transport channel closed` on the project's HTTP `webstorm` entry), and the Codex pool is
  exhausted this week, so the "if cheap" clause does not hold.

## Claude Code, default environment: `initialize` first

First frame, verbatim:

```json
{"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{"roots":{"listChanged":true},"elicitation":{}},"clientInfo":{"name":"claude-code","title":"Claude Code","version":"2.1.275","description":"Anthropic's agentic coding tool","websiteUrl":"https://claude.com/claude-code"}},"jsonrpc":"2.0","id":0}
```

Result: the 2026-only host answers `-32022`; Claude Code reports the server as
`{"name":"nlp","status":"failed"}`. This is the launch path the operator uses daily.

## Claude Code, `MCP_PROTOCOL_NEGOTIATION=auto`: `server/discover` first

The three frames sent, verbatim:

```json
{"jsonrpc":"2.0","id":"server-discover-probe-1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"claude-code","title":"Claude Code","version":"2.1.275","description":"Anthropic's agentic coding tool","websiteUrl":"https://claude.com/claude-code"},"io.modelcontextprotocol/clientCapabilities":{"roots":{"listChanged":true},"elicitation":{}}}}}
```

```json
{"jsonrpc":"2.0","id":"listen:0","method":"subscriptions/listen","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"claude-code","title":"Claude Code","version":"2.1.275","description":"Anthropic's agentic coding tool","websiteUrl":"https://claude.com/claude-code"},"io.modelcontextprotocol/clientCapabilities":{"roots":{"listChanged":true},"elicitation":{}}},"notifications":{"toolsListChanged":true}}}
```

```json
{"method":"tools/list","jsonrpc":"2.0","id":0,"params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"claude-code","title":"Claude Code","version":"2.1.275","description":"Anthropic's agentic coding tool","websiteUrl":"https://claude.com/claude-code"},"io.modelcontextprotocol/clientCapabilities":{"roots":{"listChanged":true},"elicitation":{}}}}}
```

Result: the host answers `server/discover` and `tools/list`; Claude Code reports
`{"name":"nlp","status":"connected"}`. (`subscriptions/listen` is answered method-not-found and
the client proceeds.)

## Verdict

The daily CLI speaks `2026-07-28` on stdio only when `MCP_PROTOCOL_NEGOTIATION=auto` is set in
Claude Code's own environment; by default it sends a legacy `initialize` that a 2026-only host
must refuse. Flipping nlp-mcp today would silently break the `.mcp.json` `nlp` server for every
default launch, which is exactly the failure D-cli-contract exists to prevent. **nlp-mcp is held
on `v2025_06_18`** and the hold is an exception-ledger row in `SPEC.md`; the re-entry gate in
`explorations/effect-mcp-2026-07-28/MAP.md` names the two ways it opens.

The candidate flip is a two-line change to `packages/drivers/nlp-mcp/src/Server.ts` (import
`statelessMcpProtocols`, pass it as `protocols`) plus `instructions` and a `conformance2026` test
in the shape of the other four hosts; it was applied for this capture and reverted.

## Reproduce

```sh
bun run beep worktree new <lane>            # any lane on main
# pin nlp-mcp Server.ts to statelessMcpProtocols, write the shim above, then:
CAPTURE_LOG=<log> claude -p "Reply with exactly OK." --max-turns 1 --strict-mcp-config \
  --mcp-config '{"mcpServers":{"nlp":{"type":"stdio","command":"<shim>","args":[]}}}' --output-format json
MCP_PROTOCOL_NEGOTIATION=auto CAPTURE_LOG=<log2> claude -p ... (same flags)
```

Run from a shell without `CLAUDECODE` set (a nested Claude Code refuses to start otherwise).
