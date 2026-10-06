# M365 Agent Outbox — Sources & Provenance

- **Source exploration:** none — this goal was authored directly from an
  operator request of 2026-10-06.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| Workstream A slice 1 | App-only lane and mailbox write verbs | this repo, branch `feat/m365-write-lane` (commit `4b731ed08b`, unpublished on 2026-10-06) | `packages/drivers/m365/src/M365.service.ts`, `M365.config.ts`, `M365.auth.ts` | Auth lane, write-safe executor, event verbs | Reused as is |
| Workstream A packet | Practice Docket Intake Spec | this repo, branch `docs/practice-docket-intake-packet` | `goals/practice-docket-intake/SPEC.md` | Constraints, non-goals (no send, no MCP exposure) | Honoured; the outbox is a separate server and registration |
| Workstream A runbook | Docket intake: Entra app registration | same branch | `docs/runbooks/docket-intake-entra-registration.md` | Certificate, Exchange RBAC scope, verification | Pattern copied; run in the same sitting |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| None | N/A | N/A | N/A |

## 3. External research sources

Read 2026-10-06.

- Anthropic, "Set up the Microsoft 365 connector"
  (<https://support.claude.com/en/articles/12542951-set-up-the-microsoft-365-connector>).
  Findings used: write tools need an Entra administrator to consent the
  updated permission set (`Mail.Send`, `Mail.ReadWrite`, `Calendars.ReadWrite`,
  `Files.ReadWrite.All`, `MailboxSettings.ReadWrite`, `ChatMessage.Send`,
  `ChannelMessage.Send`, `Chat.Create`, `People.Read`) and the organization to
  configure the connector's permissions under Organization settings >
  Connectors; "Attachments aren't supported in write tools"; the two
  enterprise applications are the M365 MCP Client for Claude
  (`08ad6f98-a4f8-4635-bb8d-f1a3044760f0`) and the M365 MCP Server for Claude
  (`07c030f6-5743-41b7-ba00-0a6e85f37c17`).
- The connector's own tool schemas in a live session: `outlook_send_mail` and
  `outlook_create_draft` take `to`, `cc`, `bcc`, `subject`, `body` and
  `bodyType` and no attachment field.
- Microsoft Learn, "Role Based Access Control for Applications in Exchange
  Online" (<https://learn.microsoft.com/exchange/permissions-exo/application-rbac>).
  Findings used: `Application Mail.Send`, `Application Mail.ReadWrite` and
  `Application Calendars.ReadWrite` are assignable roles; an assignment takes
  `-App`, `-Role` and `-CustomResourceScope`; `Test-ServicePrincipalAuthorization`
  verifies the scope; a scoped assignment and a tenant-wide Graph application
  permission add up.
- Microsoft Graph v1.0 reference: create message, add attachment,
  `attachment: createUploadSession` (files from 3 MB to 150 MB, chunk requests
  without an `Authorization` header), `message: send`.

## 4. In-repo capability references

- `packages/drivers/m365` and `goals/m365-driver` — the driver and its error
  taxonomy.
- `packages/drivers/m365-mcp` and `goals/m365-mcp` — the read-only server, the
  sanitized toolkit and the conformance pattern.
- `packages/drivers/nlp-mcp` and `.mcp.json` — the precedent for a repo-local
  stdio registration.
- `docs/runbooks/onepassword-beep-secrets-layout.md` — field label rules.

## 5. Cross-links & provenance

- Observed state that started the packet: the connector for the firm tenant
  held read scopes only on 2026-10-06 and its draft tools failed on a missing
  `Mail.ReadWrite`; a browser-driven send produced about 40 blank drafts and
  one unintended message.
