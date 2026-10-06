# M365 agent outbox: Entra registration (operator-attended)

The agent outbox (`goals/m365-agent-outbox`) lets agent sessions on the
workstation draft mail with attachments, send a draft, and write calendar
events in the attorney's mailbox. This runbook registers the application that
lets it do so and, optionally, turns on the claude.ai connector's write tools.

Run it in the same sitting as the docket intake registration
(`docs/runbooks/docket-intake-entra-registration.md`, which arrives with
`goals/practice-docket-intake`): the same person, the same Entra admin center
session and the same Exchange Online PowerShell session do both. The two registrations stay separate on purpose.
The docket service reads inbound mail unattended and must never be able to
send; the outbox can send and must never run unattended.

It needs someone who is both an Entra application administrator and an
Exchange Online administrator of the firm tenant. Steps 1 to 6 take about 15
minutes on top of the docket registration, plus a propagation wait.

As with the docket registration:

- **No API permission is added and no admin consent is granted for this
  application in Entra.** Access is granted in Exchange Online with role
  assignments scoped to the attorney's mailbox (RBAC for Applications). A
  tenant-wide Graph `Mail.Send` application permission would add to the scoped
  one and let the application send as every mailbox in the tenant.
- **The credential is a certificate, not a client secret.**

Nothing in this runbook is committed back to the repository. Keep the tenant
id, client id, mailbox address and key out of chat, issues and pull requests.

## What the outbox is allowed to do

| Exchange application role | Used for |
| --- | --- |
| `Application Mail.ReadWrite` | Create a draft, attach files to it, read it back before sending, delete it. |
| `Application Mail.Send` | Send a draft from the attorney's address. The message lands in Sent Items. |
| `Application Calendars.ReadWrite` | Create and update calendar events. |

All three are limited to the one mailbox by the management scope in step 4.
The server adds its own limits on top: one tool sends, it restates the exact
recipients, subject and attachments and is checked against the stored draft,
attachments come only from configured directories, and every send is written
to a local audit log first.

## 1. Create the certificate (workstation)

```bash
umask 077 && mkdir -p ~/.local/state/beep/m365-outbox/registration && cd ~/.local/state/beep/m365-outbox/registration
```

```bash
openssl req -x509 -newkey rsa:2048 -sha256 -days 730 -nodes -subj "/CN=beep-agent-outbox" -keyout agent-outbox.key.pem -out agent-outbox.cert.pem
```

```bash
openssl x509 -in agent-outbox.cert.pem -noout -fingerprint -sha256 | sed 's/.*=//; s/://g'
```

The last command prints the SHA-256 thumbprint. The certificate
(`agent-outbox.cert.pem`) is public; the key (`agent-outbox.key.pem`) is the
secret. Do not reuse the docket intake certificate.

## 2. Register the application (Entra admin center)

1. **Identity > Applications > App registrations > New registration.**
2. Name: `beep-agent-outbox`. Supported account types: **this organizational
   directory only**. No redirect URI. Register.
3. **Certificates & secrets > Certificates > Upload certificate**: upload
   `agent-outbox.cert.pem`. Check that the thumbprint shown matches step 1.
4. Do **not** open **API permissions** to add anything, and do not grant admin
   consent. Remove the default delegated `User.Read` entry if it is listed.
5. From **Overview**, note the **Application (client) ID**. The
   **Directory (tenant) ID** is the same as for the docket registration.
6. **Identity > Applications > Enterprise applications**, open
   `beep-agent-outbox`, and note its **Object ID**. This is the service
   principal's object id; it is not the object id shown on the app
   registration page.

## 3. Store the values (1Password, operator)

The agent service account is read-only on the vault, so the operator adds
these fields to the `BEEP_SECRETS` item with `op-human` or the 1Password app.
The label prefix is the section
(see [BEEP_SECRETS layout](onepassword-beep-secrets-layout.md)).

| Label | Value |
| --- | --- |
| `CLOUD_M365_OUTBOX_TENANT_ID` | Directory (tenant) ID |
| `CLOUD_M365_OUTBOX_CLIENT_ID` | Application (client) ID of `beep-agent-outbox` |
| `CLOUD_M365_OUTBOX_CERT_THUMBPRINT_SHA256` | Thumbprint from step 1 |
| `CLOUD_M365_OUTBOX_CERT_PRIVATE_KEY` | Full contents of `agent-outbox.key.pem` |
| `CLOUD_M365_OUTBOX_MAILBOX` | The attorney's primary mailbox address |

Then delete the local key:

```bash
shred -u ~/.local/state/beep/m365-outbox/registration/agent-outbox.key.pem
```

## 4. Grant mailbox-scoped access (Exchange Online PowerShell)

Use the PowerShell session already connected for the docket registration, or
connect one:

```powershell
Connect-ExchangeOnline
```

Check that the role names exist in the tenant exactly as written below:

```powershell
Get-ManagementRole | Where-Object Name -like "Application *" | Select-Object Name
```

Create the Exchange pointer to the service principal:

```powershell
New-ServicePrincipal -AppId "<outbox-client-id>" -ObjectId "<outbox-enterprise-app-object-id>" -DisplayName "beep-agent-outbox"
```

Create a scope of its own, so that either registration can be removed without
touching the other:

```powershell
New-ManagementScope -Name "beep-agent-outbox-mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq '<attorney-mailbox>'"
```

Assign the three roles, each limited to that scope:

```powershell
New-ManagementRoleAssignment -App "<outbox-enterprise-app-object-id>" -Role "Application Mail.ReadWrite" -CustomResourceScope "beep-agent-outbox-mailbox"
```

```powershell
New-ManagementRoleAssignment -App "<outbox-enterprise-app-object-id>" -Role "Application Mail.Send" -CustomResourceScope "beep-agent-outbox-mailbox"
```

```powershell
New-ManagementRoleAssignment -App "<outbox-enterprise-app-object-id>" -Role "Application Calendars.ReadWrite" -CustomResourceScope "beep-agent-outbox-mailbox"
```

## 5. Verify the scope (same PowerShell session)

This check does not wait for the permission cache.

```powershell
Test-ServicePrincipalAuthorization -Identity "<outbox-enterprise-app-object-id>" -Resource "<attorney-mailbox>" | Format-Table
```

Expected: three rows, each with `InScope` set to `True`.

Then run it once against any other mailbox in the tenant:

```powershell
Test-ServicePrincipalAuthorization -Identity "<outbox-enterprise-app-object-id>" -Resource "<some-other-mailbox>" | Format-Table
```

Expected: every row has `InScope` set to `False`. If a row is `True`, the
application can send as a mailbox it should not: stop, remove the role
assignments, and report it. Do not continue with a tenant-wide grant.

Check the docket registration did not pick up the send role:

```powershell
Get-ManagementRoleAssignment -Role "Application Mail.Send" | Format-Table Name, RoleAssigneeName, CustomResourceScope
```

Expected: one row, for `beep-agent-outbox`.

Role changes can take from 30 minutes to two hours to reach Microsoft Graph.

## 6. Hand back

Tell the orchestrator session that the outbox registration is done and how
many rows step 5 showed in scope. Send no ids. The outbox live smoke then
reads the values through `op run`. With the credentials alone it acquires a
token and reads one page of drafts, writing nothing. With
`M365_OUTBOX_LIVE_WRITE=1` it also creates a draft from the mailbox to itself
with one synthetic attachment, reads it back and deletes it. With
`M365_OUTBOX_LIVE_SEND=1` it creates such a draft, sends it, and records the
audit ids.

## 7. Optional: the claude.ai connector's write tools

State on 2026-10-06: the consent in item 1 below is already done for the firm
tenant. The write permission set was added to the enterprise application's
existing all-principals grant with the Azure CLI, signed in as the tenant
administrator, in place of the portal. One enterprise application serves every
Claude account in the tenant, so the grant covers all of them. The scope
string and grant id from before the change are saved on the workstation at
`~/.cache/beep/orchestrator/m365-connector-consent-before-2026-10-06.txt`;
patching the grant back to that string undoes it. **Item 2 is still open, and
until it is done the connector's own send tools work in every claude.ai
session.**

This step is independent of steps 1 to 6 and can be skipped. It gives
claude.ai chat, desktop and mobile sessions text-only drafts and calendar
writes. It does not give them attachments: the connector's write tools reject
any message with one.

1. **Entra admin center > Identity > Applications > Enterprise applications**,
   open **M365 MCP Server for Claude**
   (application id `07c030f6-5743-41b7-ba00-0a6e85f37c17`), then
   **Permissions**. Review the updated permission set and grant admin consent.
   It is one set: besides `Mail.ReadWrite`, `Mail.Send` and
   `Calendars.ReadWrite` it carries `Files.ReadWrite.All`,
   `MailboxSettings.ReadWrite`, `ChatMessage.Send`, `ChannelMessage.Send`,
   `Chat.Create` and `People.Read`.
2. **claude.ai > Organization settings > Connectors > Microsoft 365**, set the
   tool permissions. Where the page offers a choice per tool, use this table;
   where it offers one switch for a group, choose the stricter setting of the
   tools in the group:

   | Tools | Setting |
   | --- | --- |
   | Send mail, send draft, forward mail | **Blocked** |
   | Create, update and delete draft; create, update and delete event; respond to event | **Ask** |
   | SharePoint and OneDrive write tools, Teams send and post tools, mailbox rules, labels and automatic replies | **Blocked** |

   The outbox stays the only route that sends mail from an agent session,
   because it is the only one that checks the draft and writes an audit record.
3. Reconnect the connector in a claude.ai session and ask it for its granted
   scopes. `Mail.ReadWrite` and `Calendars.ReadWrite` should be listed.

To undo: on the enterprise application's **Permissions** page, revoke the
admin consent, or set every write tool to **Blocked**.

## 8. Optional: sessions outside the repository

The repository's `.mcp.json` registers `beep-m365-outbox` for sessions that
run inside a checkout. For sessions started elsewhere, register it once at
user level. `<clone>` is the primary checkout of this repository:

```bash
claude mcp add --scope user beep-m365-outbox -- op run --env-file=<clone>/packages/drivers/m365-mcp/outbox.env -- bun run <clone>/packages/drivers/m365-mcp/src/bin-outbox.ts
```

Files to attach go in the staging directory
`${XDG_DATA_HOME:-$HOME/.local/share}/beep/m365-outbox/attachments`, which the
server creates on first start. Copy a file there before asking a session to
attach it. To allow other directories instead, set
`M365_OUTBOX_ATTACHMENT_ROOTS` to absolute directories separated by `:` (for a
user-level registration, add `-e M365_OUTBOX_ATTACHMENT_ROOTS=<dirs>` before
the `--`). Never list the home directory or a working tree.

The audit log is under
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/m365-outbox/audit`, one
`YYYY-MM.jsonl` file per month.

## Rotation and removal

- **Rotate** before the certificate expires (two years): repeat step 1, upload
  the new certificate beside the old one, update the two `CERT` fields in
  1Password, start a new session, then delete the old certificate in Entra.
- **Revoke at once**: delete the certificate in Entra, or run
  `Remove-ManagementRoleAssignment` for the `Application Mail.Send`
  assignment. Either stops sending immediately for new tokens; a token already
  issued stays valid for up to an hour.
- **Remove entirely**: remove the three role assignments, the management scope
  (`Remove-ManagementScope "beep-agent-outbox-mailbox"`), the Exchange service
  principal (`Remove-ServicePrincipal`), and the app registration.

`ApplicationAccessPolicy` is the legacy way to scope application access and is
not used here.
