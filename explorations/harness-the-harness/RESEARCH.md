# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape (2026-10-14)

### t3code: a control surface over installed agents

Local reference `.repos/t3code` (`a01c48f862`, 2026-10-13; upstream
[pingdotgg/t3code](https://github.com/pingdotgg/t3code)). It calls itself an
"agent harness control surface" and drives Claude Code, Codex, Cursor, Grok
Build, OpenCode and others *as installed and logged in on the machine*:

- Claude through the Agent SDK with `pathToClaudeCodeExecutable` pointed at the
  installed binary (`apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`,
  `makeClaudeQueryOptions`), so sessions run on the user's own install and
  login.
- Codex through a dedicated `packages/effect-codex-app-server`.
- History and forking from SDK session APIs (`apps/server/src/claudeHistoryWorker.ts`).
- Git checkpoints and diffs (`apps/server/src/checkpointing/`).
- An application-hosted MCP server exposed to the agents
  (`apps/server/src/mcp/OrchestratorMcpService.ts`).
- Gap for our use: its install docs assume the user ran `claude auth login`
  in a terminal; only Antigravity gets in-app "Install" / "Sign in" buttons.

Fit: it is the "harness the harness" pattern. It is a developer tool; nothing
in it addresses non-technical onboarding, practice systems, or policy.

### MCP Bundles (`.mcpb`): one-click server install

- Claude Desktop renders a settings UI from the manifest's `user_config`;
  `sensitive: true` values are stored in the OS keychain and injected into
  the server's environment via `${user_config.<key>}`
  ([Claude connector docs](https://claude.com/docs/connectors/building/mcpb.md),
  [mcpb repo index](https://docsearch.algolia.com/mcp/docs/repo/modelcontextprotocol/mcpb)).
- `server.type` is `node`, `python` or `binary`; launch comes from
  `mcp_config`. A `binary` server is self-contained, which is what
  practice-kg-mcp already ships (below). Whether Desktop supplies its own Node
  for `node` servers is UNVERIFIED from primary docs.
- No manifest-level sandbox: the process runs with full user privileges.
  Keychain storage protects secrets at rest, not runtime access.

### Claude Code on Windows

Official setup docs: native Windows needs nothing else; Git for Windows is
optional (enables the Bash tool; otherwise a PowerShell tool, still rolling
out). Install is `irm https://claude.ai/install.ps1 | iex`, no administrator
rights ([Claude Code setup](https://code.claude.com/docs/en/setup)). So the
lawyer's machine needs neither WSL nor virtualization for Claude Code itself.

### Provider adoption among solo and small firms

- Practice management, one non-ABA survey of 500 practitioners: Clio 38%
  overall (32% of solos, 41% of 2-5 attorney firms), MyCase 14%,
  PracticePanther 10%, 18% of solos on Google/Microsoft only
  ([The Legal Stack](https://www.thelegalstack.org/research/the-solo-and-small-firm-tech-stack-report-what-500)).
- Documents: ABA 2022 Solo & Small Firm TechReport lists the most-cited cloud
  tools (Dropbox, Office 365, Google Workspace, Box, Clio, Evernote,
  NetDocuments, MyCase) without shares
  ([ABA 2022](https://www.americanbar.org/groups/law_practice/resources/tech-report/2022/solo-small-firm/)).
  Vendor/review sources place NetDocuments and iManage at 25-50+ attorney
  firms ([LexWorkplace](https://lexworkplace.com/imanage-vs-netdocuments/)).
- Password managers: an older ABA figure, cited secondhand, puts use near 21%
  of firms, no vendor split
  ([MyCase summary](https://www.mycase.com/blog/general/aba-survey-lawyers-cybersecurity-and-secure-client-portals/)).
- Vendor shares by firm size live in the paid ABA 2024 Legal Technology
  Survey volumes ([ABA Tech Survey](https://www.americanbar.org/groups/law_practice/resources/legal-technology-resource-center/tech-survey/)).

### Windows code signing

Azure Artifact Signing (formerly Trusted Signing) offers Basic and Premium
tiers and bills from account creation; individuals qualify for public-trust
certificates only in the US and Canada
([pricing](https://azure.microsoft.com/pricing/details/artifact-signing/),
[quickstart](https://learn.microsoft.com/azure/artifact-signing/quickstart)).
The dollar price did not load from the official page; a forum report of about
$10/month for Basic is UNVERIFIED. A valid signature does not grant immediate
SmartScreen reputation; it accrues over releases signed with the same
identity.

### Terms

The Notion source page records that Anthropic's Agent SDK documentation
restricts third-party products from offering claude.ai login or subscription
limits without approval ([Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)).
Driving the user's *own* installed Claude Code is what t3code does; whether a
distributed product may do the same is OPEN and must be settled before any
SDK-driven wrapper ships. Extensions (`.mcpb`, Claude Code plugins) do not
raise this question: they run inside Anthropic's own clients.

## In-Repo Capability Inventory (2026-10-14)

| Brick | Path | Relevance |
| --- | --- | --- |
| practice-kg MCP | `apps/practice-kg-mcp` | The "one MCP, many tools" pattern: 10 `kg_*` tools; already ships as a `.mcpb` with a bun-compiled Windows binary plus DuckDB sidecars (README, Distribution). Proof that the dependency-removal path works on the attorney's Windows PC. |
| practice-claude-mod goal | `goals/practice-claude-mod` (from `explorations/claude-mods-law-practice`) | The in-Claude-Code "wrap" layer: plain-language tool rows, verdicts, matter band, firm skills. This packet must not duplicate it. |
| Agentic Professional Runtime | `goals/agentic-professional-runtime` | Candidate-before-acceptance policy, scoped context packets; governs anything outward-facing. |
| Professional desktop | `apps/professional-desktop` | Only needed if Q1 chooses an own app. |
| AI config validation | `packages/tooling/library/ai-sync` | Validate and drift-check agent configuration the harness generates. |
| Transcript analytics | `packages/tooling/library/ai-metrics` | Local session ingestion for the reflection loop (developer tooling today). |
| Drivers | `packages/drivers/{box,box-provisioning,m365,m365-mcp,freshbooks,onepassword-cli}` | Existing provider adapters: Box, Microsoft 365, FreshBooks (billing), 1Password. |
| Doctor pattern | `op-doctor`, `bun run beep models check` (workstation tooling) | Probe, name the failing line, fix: the shape of the setup doctor. |
| Parked installer lessons | `explorations/stack-installer/CAPTURE.md` | Approval before mutation, narrow real repairs, app-first but manual-capable, evidence artifact contract, Windows proof never landed. Its re-entry gate ("a workflow with product pull adopts the approval-first repair and fresh-machine evidence pattern") is this packet. |
| Office provisioning | `explorations/practice-office-provisioning` (graduated) | How the current practice estate was provisioned by hand; the steps an onboarding agent must automate. |
| Box Drive on Windows | `docs/runbooks/practice-box-drive-windows.md` | Existing Windows-side Box runbook to mine for probes. |

NOT FOUND:

- A gateway MCP that fronts multiple providers behind one connection.
- A setup desired-state model, probe set, or doctor for a lawyer machine.
- A Windows Credential Manager secret-store adapter (no keytar/DPAPI use in
  source).
- Adapters for Clio, MyCase, PracticePanther, NetDocuments, Dropbox, Google
  Workspace.
- A signed Windows bootstrapper or code-signing pipeline.
- An onboarding interview workflow (practice profile schema).

## Constraints Discovered

- **No sandbox in extensions.** A `.mcpb` server runs with full user
  privileges; policy must be enforced in the server's own code paths.
- **Windows proof has never landed** for any installer work in this repo
  (stack-installer). Treat Windows evidence as the first gate, not the last.
- **SDK login terms** constrain any own-app wrapper, not extensions.
- **Human-steps boundary.** Agents do not create accounts or enter
  credentials for the user; onboarding must route those to the human.
- **Box API budget.** About 50K calls/month by contract with no visible
  counter; the gateway keeps its own ledger.
- **Firm IT.** Admin rights may be blocked; unsigned binaries are flagged by
  Defender/SmartScreen; proxies interfere with OAuth redirects.
