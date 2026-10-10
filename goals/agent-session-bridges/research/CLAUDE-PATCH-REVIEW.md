# Claude MCP corrective patch independent review

Promoted from the sanitized `agent-comms-claude-mcp-fix-review.md` receipt.

2026-10-09. Terminal: zero actionable introduced findings.

Read-only scope: Claude launch context, authentication route, tool authorization and policy provenance. Reviewed the frozen production implementation, startup fixture, package README and private zero-model diagnostic. No model calls, tests, provider launches or source changes were performed by this reviewer. Existing 19-case owner proof was not rerun; the retained canonical package log records audit and docgen passing.

The correction replaces safe mode (which disables explicit MCP) with restricted mode while preserving empty inherited setting sources, strict explicit MCP configuration, exact scoped messaging allowlist, empty built-ins, dontAsk/no prompts, no Chrome/slash commands/session persistence, replacement environment and pinned model/effort. Explicit settings exclude inherited instruction/rule files and disable automatic memory. README retains the administrator-managed instruction exception and does not claim effective context readback. Authentication remains the caller-provided existing subscription route; bare mode and new billing are not introduced.

The fixture asserts restricted=true, safeMode=false, empty setting sources and exact exclusion/memory settings. Native model/permission/session initialization is still mandatory before accepting terminal output. Permission provenance remains launch-enforced rather than effective-reported. The zero-model MCP connection diagnostic establishes startup only; live autonomous delivery remains separate evidence.

Both pre-review and post-review hash checks passed:

- AiProviderCliSession.claude.service.ts: `2e1936ed378002361b9c2a10b3a9c0fac46743b415149b419587410b409ce1f7`
- managed-claude-peer.ts: `65d60dfaddcd56be75e3b5b34ea83b5b1836f195f4a8b869c0b01d18e8fd30c9`
- provider README.md: `582e24df86512dbeccd2426bd2bef54a4e1b0ed20aec9711502d56162a72ace1`
