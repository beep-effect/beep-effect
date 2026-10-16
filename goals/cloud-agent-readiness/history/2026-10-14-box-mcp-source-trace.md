# Box MCP startup source trace — 2026-10-14

The operator selected a read-only trace of the unauthenticated Box connection
seen in the [post-main audit](2026-10-14-post-main-headless-parity.md).
The source is now identified as Codex's remote plugin registry, not a Beep
repository MCP declaration or an explicit worker `mcp_servers` entry.

## Verified configuration chain

- On beep-worker, `codex plugin list --json` reports
  `box@openai-curated-remote`, version **8.0.1**, installed **true** and enabled
  **true**. Its source is **remote**; installation policy is `AVAILABLE` and
  authentication policy is `ON_INSTALL`.
- The cached plugin declaration at
  `~/.codex/plugins/cache/openai-curated-remote/box/8.0.1/mcp.json` declares
  a streamable HTTP MCP server named `box` at `https://mcp.box.com`.
- The explicit worker `~/.codex/config.toml` MCP entries are only node_repl
  and graft. Its locally listed plugin settings do not include Box. The
  inspected global Desktop state contains no Box endpoint or plugin-id match.
- `codex mcp list --json` lists code-review, codex_app, cua_repl, graft and
  node_repl. It does not list Box. Therefore this explicit/effective MCP list
  is insufficient to inventory the separately registered remote plugin.
- The captured native session stderr reports `AuthRequired` from Box because
  an access token was not found. Read-only log-database inspection finds three
  Box endpoint error records, all with the same missing-token condition and
  no associated thread id. This does not establish their exact startup phase
  or prove that every record belongs to the audited session.

The plugin registry and cached declaration explain the endpoint's availability;
the captured stderr establishes the failed connection during the native audit.
No token or authentication-store content was inspected. The evidence does not
prove why ON_INSTALL authentication was missing, whether another Desktop
session is authenticated, or which internal startup path contacts the plugin.

## Disposition

No configuration, plugin installation, enablement or authentication state was
changed. No OAuth flow, plugin removal or service restart was initiated.
The worker readiness checkout remains at `9b0960391e` during the trace with
its eight existing changed paths. Native Codex inference and the main model
manifest check remain qualified by their earlier receipts; Box is not.

If Box is intended for worker tasks, connect it through the supported human
plugin authentication flow and then qualify an actual bounded read-only tool
request. If it is unnecessary for a headless baseline, select a scoped
exclusion only after confirming how remote plugin settings affect Desktop and
other sessions. Do not delete caches or remove repository MCP entries to fix
this separate registry authentication gap.
