# Practice Gateway — Sources & Provenance

- **Source exploration:** `explorations/harness-the-harness` — primary ledger:
  [`explorations/harness-the-harness/research/SOURCES.md`](../../../explorations/harness-the-harness/research/SOURCES.md).
  This copy carries the corpus for implementation; the exploration ledger
  stays primary.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `t3-claude-adapter` | Claude Agent SDK adapter | pingdotgg/t3code | `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts` (`makeClaudeQueryOptions`, L948-L1068) | drive installed Claude Code | port-with-attribution |
| `t3-history` | SDK session history/fork worker | pingdotgg/t3code | `apps/server/src/claudeHistoryWorker.ts` | session evidence | reference |
| `t3-checkpoints` | Git checkpoint store and diffs | pingdotgg/t3code | `apps/server/src/checkpointing/` | undo / what changed | reference |
| `t3-mcp` | App-hosted orchestrator MCP | pingdotgg/t3code | `apps/server/src/mcp/OrchestratorMcpService.ts` | harness tools for agents | reference |
| `stack-installer-lessons` | Installer proof and UX lessons | beep-effect | `explorations/stack-installer/CAPTURE.md` | approval-first repair, fresh-machine evidence | reuse |

**How these inform this packet:** t3code shows the control-surface shape
(adapters over installed agents, checkpoints, an app-hosted MCP); the
stack-installer lessons give the repair and evidence discipline for setup.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| pingdotgg/t3code | MIT (`LICENSE`, Copyright 2026 T3 Tools Inc.) | port-with-attribution | adapter, checkpoint and app-MCP patterns |

## 3. External research sources

- [Claude connector docs — MCP Bundles](https://claude.com/docs/connectors/building/mcpb.md)
- [MCPB repository index](https://docsearch.algolia.com/mcp/docs/repo/modelcontextprotocol/mcpb)
- [Claude Code setup](https://code.claude.com/docs/en/setup)
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [The Legal Stack — Solo and Small Firm Tech Stack Report](https://www.thelegalstack.org/research/the-solo-and-small-firm-tech-stack-report-what-500)
- [ABA 2022 Solo & Small Firm TechReport](https://www.americanbar.org/groups/law_practice/resources/tech-report/2022/solo-small-firm/)
- [ABA Tech Survey](https://www.americanbar.org/groups/law_practice/resources/legal-technology-resource-center/tech-survey/)
- [MyCase — ABA survey on cybersecurity](https://www.mycase.com/blog/general/aba-survey-lawyers-cybersecurity-and-secure-client-portals/)
- [LexWorkplace — iManage vs. NetDocuments](https://lexworkplace.com/imanage-vs-netdocuments/)
- [t3code](https://github.com/pingdotgg/t3code)
- [Azure Artifact Signing pricing](https://azure.microsoft.com/pricing/details/artifact-signing/)
- [Azure Artifact Signing quickstart](https://learn.microsoft.com/azure/artifact-signing/quickstart)

## 4. In-repo capability references

- `apps/practice-kg-mcp` — reuse (gateway pattern, `.mcpb` Windows binary).
- `goals/practice-claude-mod` — sibling; owns the in-Claude-Code wrap layer.
- `goals/agentic-professional-runtime` — reuse (approval policy, context packets).
- `apps/professional-desktop` — conditional on Q1.
- `packages/tooling/library/ai-sync` — reuse (config validation, drift).
- `packages/tooling/library/ai-metrics` — extend (local transcript ingestion).
- `packages/drivers/{box,box-provisioning,m365,m365-mcp,freshbooks,onepassword-cli}` — reuse as providers.
- Gateway, setup doctor, practice profile, Windows Credential Manager store, new provider adapters, Windows bootstrapper — NET-NEW.

## 5. Cross-links & provenance

- Notion source page: Development Todo "Coding Agent Effectiveness & How the
  same capabilities can be achieved for non technical agent setups in
  beep-effect (law-practice)".
- Sibling: [`explorations/claude-mods-law-practice`](../../../explorations/claude-mods-law-practice/README.md)
  → [`goals/practice-claude-mod`](../../practice-claude-mod/README.md).
- Pattern archive this packet re-enters: [`explorations/stack-installer`](../../../explorations/stack-installer/README.md).
- Exploration: [`RESEARCH.md`](../../../explorations/harness-the-harness/RESEARCH.md), [`DECISIONS.md`](../../../explorations/harness-the-harness/DECISIONS.md).
- [Onboarding distribution research (B1/B2)](onboarding-distribution.md) — primary sources on MCPB prompts, plugins, Claude Desktop install, `.mcpb` install and `claude://` links
