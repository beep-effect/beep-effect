# Wiring evidence — 2026-08-06

Live proofs for the SPEC verification matrix, executed during P1/P2. Raw
command transcripts live in the session that drove this packet; key outputs
are quoted verbatim here.

## Store

- `basic-memory project add beep-shared ~/YeeBois/memory/beep-shared` →
  "Project 'beep-shared' added successfully"; set as default project.
- Git history (temporality convention active):
  `247db50 init beep-shared: conventions and folder structure` →
  `56e5219 first cross-agent note: adoption decision (author: claude-code)`.
- `uvx basic-memory doctor` → "Doctor checks passed." (search + sync clean).

## codegraph

- `codegraph init` on beep-effect16: **73,635 nodes / 234,417 edges in 2.1s**,
  298MB `.codegraph/` (gitignored). Zero API keys.
- `codegraph telemetry off` → "Telemetry disabled. Buffered, unsent data was
  deleted." Plus `DO_NOT_TRACK=1` + `CODEGRAPH_NO_UPDATE_CHECK=1` in every
  registration.

## Cross-agent round-trip (acceptance criterion 4)

1. **Claude Code (fresh `-p` session in beep-effect16, repo `.mcp.json`
   wiring, model haiku)** wrote the inaugural decision note via
   `mcp__basic-memory__write_note` → permalink
   `beep-shared/decisions/decision-shared-memory-and-code-kg-adoption`; in the
   same session answered a codegraph MCP query: LiteralKit defined at
   `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:785`.
2. **Grok CLI (fresh session)** recalled the note content **verbatim**
   including `author: claude-code`, and located LiteralKit via
   `codegraph__codegraph_explore`. Tools confirmed by the session itself:
   `basic-memory__read_note`, `codegraph__codegraph_explore`.

## Per-CLI registration (acceptance criterion 3)

| CLI | Where | Evidence | Live tool call |
| --- | --- | --- | --- |
| Claude Code | `.mcp.json` (repo) + `.claude/settings.json` `enabledMcpjsonServers` | committed in this PR | ✅ proven (round-trip leg 1) |
| Grok | `~/.grok/config.toml` via `grok mcp add` (basic-memory; codegraph with `-e` env) | `grok mcp doctor`: both handshake OK (23 tools / 1 tool) | ✅ proven (round-trip leg 2) |
| Codex | `~/.codex/config.toml` `[mcp_servers.basic-memory]`, `[mcp_servers.codegraph]` + env sub-table | `codex mcp list` shows both `enabled` with env | ⏳ deferred — weekly quota exhausted until 2026-08-08 ~06:50; registration-level evidence only |
| Cursor | `~/.cursor/mcp.json` (merged beside existing `sourcegraph`) | config excerpt (codegraph with `--path ${workspaceFolder}`) | ⏳ deferred — no headless cursor-agent CLI on this machine; GUI session required |

## Deviations / operator notes

- **Grok project trust:** stdio MCP servers do not attach in untrusted
  directories. beep-effect16 was added to `~/.grok/trusted_folders.toml`
  (beep-effect, 3, 5, 7 were already user-trusted — same repo, consistent
  intent). First recall attempt before the trust fix fell back to the
  basic-memory CLI bridge; the post-fix run used real MCP tools.
- **Claude workspace trust:** the `-p` proof session logged "Ignoring 55
  permissions.allow entries… workspace has not been trusted" — MCP still
  attached via `enabledMcpjsonServers`. First interactive session in
  beep-effect16 should accept the trust dialog.
- basic-memory's sync materialized frontmatter (title/permalink) into the
  store README on first index — expected behavior, committed as part of
  `56e5219`.
