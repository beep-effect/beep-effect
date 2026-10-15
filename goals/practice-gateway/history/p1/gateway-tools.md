# Gateway tool surface — design (2026-10-14)

One `.mcpb` (`apps/practice-gateway`) serving setup tools plus the providers
the practice profile selects. Effect `McpServer.layerStdio`, providers
composed with `@beep/mcp-kit` `composeGatedLayers`.

## Setup tools (always mounted)

| Tool | Input | Output | Notes |
| --- | --- | --- | --- |
| `setup_profile_get` | — | `PracticeProfile` or none | Reads the saved profile (gateway data dir). |
| `setup_profile_save` | `PracticeProfile` | saved profile | Written by the onboarding skill after the interview. Holds no secrets. |
| `setup_status` | — | `SetupReport` + plain-language summary | Requirements derived from the saved profile; `SetupDoctor.check`. |
| `setup_repair` | `requirement: SetupRequirementId` | `ProbeResult` | `SetupDoctor.repair`; approval through `SetupApprovals`. |

## Approval (`SetupApprovals` in the gateway)

- Primary: `McpServer.elicit` (`effect/ai/McpServer`, available in the
  installed effect) with the remediation's plain-language summary and a
  yes/no schema. Declined or cancelled → `declined`.
- Host support for elicitation in Claude Desktop and Claude Code is
  UNVERIFIED; test in the proof VM. If a host lacks it, the gateway answers
  `declined` and the tool result tells the agent to ask the lawyer in chat;
  record the residual risk before adding any agent-relayed approval path.

## Requirement catalog (slice 1)

Derived per provider from the profile:

- `claude-desktop-installed`, `claude-signed-in` (human: sign-in) — verified
  first (D3).
- Box Drive: `box-drive-installed` (automatic: install), `box-drive-signed-in`
  (human: sign-in), `box-drive-folder-available`.
- Microsoft 365: `m365-consented` (human: consent via the gateway's
  loopback authorizer), `m365-token-cached` (DPAPI file present).
- practice-kg: `practice-kg-bundle-present`, `practice-kg-self-check`.
- Machine: `bitlocker-on` (human: admin-prompt, informational when blocked).

## Provider tools

- practice-kg: `PracticeKgToolkitLayer` in process once its resource layers
  move out of `apps/practice-kg-mcp`.
- Microsoft 365: `M365McpRegistrationsLive` with the gateway's
  `M365InteractiveAuthorizer` (loopback + system browser) and a DPAPI-backed
  MSAL cache plugin over `@beep/windows-secrets`.
- Box Drive: file tools over the local Box Drive folder (list, read); no Box
  API in slice 1 (P0 decision).
