# Local implementation placement

2026-10-09. Architecture and source reuse review against the lane, subsequently
updated to `7febc0287b` from origin/main before production edits.

## Placement

- `@beep/repo-cli`: command-owned `AgentMessage` schemas, transactional store,
  routing service, live SQLite layer, CLI and MCP composition. This is repository
  operations; a new shared/product package is not earned by the first consumer.
- `@beep/ai-provider-cli`: product-neutral owned native sessions, explicit launch
  profiles and provider wire boundaries. Existing auth probes remain separate.
- `@beep/acp`: reuse correlated bidirectional process RPC for Grok/Cursor; add
  missing standard `session/set_mode` using existing generated schemas.
- `@beep/mcp-kit`: reuse toolkit sanitization, protocol handshake support and
  tool hints. Enrolled launch grants establish sender identity independently of
  the MCP transport client identifier.

Imports flow tooling → driver → protocol/foundation. No driver imports private
CLI code. No new shared-memory service or index is introduced.

## Delivery and permission boundaries

Effect's Bun SQLite client supplies WAL, bounded busy timeout and transactional
`BEGIN IMMEDIATE`; the store explicitly sets and reads back synchronous FULL.
Provider calls never run inside SQL transactions. Acceptance and grant-budget
debits are atomic; claims commit before calling a model. Expired unresolved
claims become ambiguous and are held without automatic resend. This is process
crash recovery; no power-loss qualification is claimed.

The live boundary requires a private state directory/database. Each managed
session has one scoped owner. MCP launch grants carry enrolled sender identity,
allowed recipients, expiry and a persisted message budget. Tool parameters
cannot impersonate another sender or create new enrollment. Envelope capability
and policy fingerprints describe the intended destination; changed enrollment
fails before inference. Role addresses remain unsupported until the existing
register's authority and handoff behavior are explicitly integrated.

## Source anchors

- [ACP client](../../../packages/drivers/acp/src/AcpClient.service.ts)
- [Auth home helper](../../../packages/drivers/ai-provider-cli/src/AiProviderCliHome.service.ts): its shared-home overlay is not a hermetic profile.
- [MCP composition](../../../packages/drivers/gov-legal-mcp/src/Server.ts)
- [Session ledger](../../../packages/tooling/tool/cli/src/commands/Session/SessionLedger.service.ts)
- [Architecture placement](../../../standards/architecture/07-non-slice-families.md)

Exact native protocol evidence remains in the source exploration. Provider
notification buffers are not durable mailboxes; scoped handlers are installed
before activity, and transport loss must leave an explicit unknown outcome.
