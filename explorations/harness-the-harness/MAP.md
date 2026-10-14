# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `practice-gateway` | One `.mcpb` gateway with a setup doctor, a `PracticeProfile` onboarding skill and an unsigned bootstrapper, proved by a recorded from-zero onboarding on a clean Windows VM (practice-kg, Box, Microsoft 365). **Promised now.** | none | `apps/practice-kg-mcp` (`.mcpb` + bun-compiled Windows binary, reuse packaging); `packages/law-practice/server` (practice-kg tools, compose in process); `packages/drivers/box`, `packages/drivers/m365` (reuse); `goals/agentic-professional-runtime` approval policy (reuse); `explorations/stack-installer` evidence contract (reuse); `packages/tooling/library/ai-sync` (validate generated config); gateway host, setup doctor, `PracticeProfile`, Credential Manager store, bootstrapper: NET-NEW |
| `practice-gateway-providers` | Add provider adapters in adoption order (D5): Clio first, then OneDrive/SharePoint or Dropbox per the interview data. **Gated:** opens when D9's attorney interviews rank the next providers. | `practice-gateway` | `packages/drivers/freshbooks` (billing-adapter precedent); `packages/drivers/m365` (OneDrive/SharePoint via Graph, extend); Clio, Dropbox adapters: NET-NEW |
| `practice-gateway-signed-release` | Azure Artifact Signing under the operator's entity (D11, D12), signed bootstrapper and gateway, SmartScreen reputation tracking. **Gated:** opens before the first install on a real lawyer machine. Money: operator approves the account. | `practice-gateway` | NET-NEW (no signing pipeline in repo) |
| `practice-harness-improvement-loop` | The Notion source's gated self-improvement loop on top of the harness: observe, attribute, propose skill/preference changes, validate, approve, activate a pinned version, roll back; policy stays outside the writable area. **Gated:** opens after the gateway runs on the attorney's machine. | `practice-gateway` | `packages/tooling/library/ai-metrics` (local transcript ingestion, extend); `packages/tooling/library/ai-sync` (reuse); `goals/agentic-professional-runtime` candidate promotion (reuse) |

## Sequencing

`practice-gateway` is the only promised-now goal: it proves the whole idea
end to end on the one machine the repo has never proved (Windows), with the
providers the attorney already uses. Everything else needs evidence it
produces: interview data ranks providers, a passing VM run justifies signing
spend, and a gateway in daily use gives the improvement loop real sessions
to learn from. The sibling `practice-claude-mod` runs in parallel; the
onboarding skill ships in that plugin (or a companion plugin) without
touching its rows or matter band.

## First Vertical Slice

Inside `practice-gateway`: on a clean Windows VM, the unsigned bootstrapper
installs Claude Desktop and the gateway `.mcpb`, the lawyer signs in to
Claude (first human step), and the onboarding skill interviews them, writes a
`PracticeProfile` choosing practice-kg + Box + Microsoft 365, then drives the
doctor until every `SetupRequirement` is `Satisfied`, with Box and Microsoft
365 consent screens and any UAC prompt as the only human steps. Verified by a
recorded run (structured result, transcript, checksums, screencast) and a
second run from the same snapshot that reaches green without new hiccups.

## Open Risks Inherited From The Brief

- Claude Desktop vs Claude Code: prove the gateway in both hosts.
- The bootstrapper stays dumb; all intelligence comes after the handoff.
- Claude login is the first human step; verify it before anything else.
- No extension sandbox: policy enforced in gateway code paths.
- Credential Manager access from the bun-compiled binary is unproven.
- OAuth loopback redirects may be blocked on firm networks; device-code
  fallback.
- Box call budget needs the gateway's own ledger.
- Unsigned SmartScreen warnings in the VM are expected, not failures.
- Do not duplicate `practice-claude-mod`'s rows or matter band.
