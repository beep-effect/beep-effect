# Docket intake: Entra app registration (operator-attended)

The docket intake service (`goals/practice-docket-intake`) reads one mailbox
and writes to its calendar without anyone signed in. This runbook registers
the application that lets it do so. It is run once, by someone who is both an
Entra application administrator and an Exchange Online administrator of the
firm tenant. It takes about 20 minutes plus a propagation wait.

Two things differ from an ordinary app registration:

- **No API permission is added and no admin consent is granted in Entra.**
  Access is granted in Exchange Online, with a role assignment scoped to the
  attorney's mailbox (RBAC for Applications). A tenant-wide Graph application
  permission would add to the scoped one and give the app every mailbox, so it
  must not be granted beside it.
- **The credential is a certificate, not a client secret.**

Nothing in this runbook is committed back to the repository. Keep the tenant
id, client id, mailbox address and key out of chat, issues and pull requests.

## What the service is allowed to do

| Exchange application role | Used for |
| --- | --- |
| `Application Mail.ReadWrite` | Read new messages and attachments; set categories on a message. It never sends, moves or deletes mail. |
| `Application Calendars.ReadWrite` | Create and update the tentative docket entries and reminder events. |
| `Application MailboxSettings.ReadWrite` | Add the `Docket - *` names to the mailbox's category list. |

All three are limited to the one mailbox by the management scope in step 4.

## 1. Create the certificate (workstation)

```bash
umask 077 && mkdir -p ~/.local/state/beep/docket-intake/registration && cd ~/.local/state/beep/docket-intake/registration
```

```bash
openssl req -x509 -newkey rsa:2048 -sha256 -days 730 -nodes -subj "/CN=beep-docket-intake" -keyout docket-intake.key.pem -out docket-intake.cert.pem
```

```bash
openssl x509 -in docket-intake.cert.pem -noout -fingerprint -sha256 | sed 's/.*=//; s/://g'
```

The last command prints the SHA-256 thumbprint. The certificate
(`docket-intake.cert.pem`) is public; the key (`docket-intake.key.pem`) is the
secret.

## 2. Register the application (Entra admin center)

1. **Identity > Applications > App registrations > New registration.**
2. Name: `beep-docket-intake`. Supported account types: **this organizational
   directory only**. No redirect URI. Register.
3. **Certificates & secrets > Certificates > Upload certificate**: upload
   `docket-intake.cert.pem`. Check that the thumbprint shown matches step 1.
4. Do **not** open **API permissions** to add anything, and do not grant admin
   consent. Remove the default delegated `User.Read` entry if it is listed.
5. From **Overview**, note the **Application (client) ID** and the
   **Directory (tenant) ID**.
6. **Identity > Applications > Enterprise applications**, open
   `beep-docket-intake`, and note its **Object ID**. This is the service
   principal's object id; it is not the object id shown on the app
   registration page.

## 3. Store the values (1Password, operator)

The agent service account is read-only on the vault, so the operator adds
these fields to the `BEEP_SECRETS` item with `op-human` or the 1Password app.
The label prefix is the section
(see [BEEP_SECRETS layout](onepassword-beep-secrets-layout.md)).

| Label | Value |
| --- | --- |
| `CLOUD_M365_DOCKET_TENANT_ID` | Directory (tenant) ID |
| `CLOUD_M365_DOCKET_CLIENT_ID` | Application (client) ID |
| `CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256` | Thumbprint from step 1 |
| `CLOUD_M365_DOCKET_CERT_PRIVATE_KEY` | Full contents of `docket-intake.key.pem` |
| `CLOUD_M365_DOCKET_MAILBOX` | The attorney's primary mailbox address |

Then delete the local key:

```bash
shred -u ~/.local/state/beep/docket-intake/registration/docket-intake.key.pem
```

## 4. Grant mailbox-scoped access (Exchange Online PowerShell)

Run in PowerShell with the `ExchangeOnlineManagement` module, signed in as an
Exchange administrator. Replace the three placeholders.

```powershell
Connect-ExchangeOnline
```

Check that the role names exist in the tenant exactly as written below:

```powershell
Get-ManagementRole | Where-Object Name -like "Application *" | Select-Object Name
```

Create the Exchange pointer to the service principal:

```powershell
New-ServicePrincipal -AppId "<client-id>" -ObjectId "<enterprise-app-object-id>" -DisplayName "beep-docket-intake"
```

Create the scope that matches only the attorney's mailbox:

```powershell
New-ManagementScope -Name "beep-docket-intake-mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq '<attorney-mailbox>'"
```

Assign the three roles, each limited to that scope:

```powershell
New-ManagementRoleAssignment -App "<enterprise-app-object-id>" -Role "Application Mail.ReadWrite" -CustomResourceScope "beep-docket-intake-mailbox"
```

```powershell
New-ManagementRoleAssignment -App "<enterprise-app-object-id>" -Role "Application Calendars.ReadWrite" -CustomResourceScope "beep-docket-intake-mailbox"
```

```powershell
New-ManagementRoleAssignment -App "<enterprise-app-object-id>" -Role "Application MailboxSettings.ReadWrite" -CustomResourceScope "beep-docket-intake-mailbox"
```

## 5. Verify the scope (same PowerShell session)

This check does not wait for the permission cache.

```powershell
Test-ServicePrincipalAuthorization -Identity "<enterprise-app-object-id>" -Resource "<attorney-mailbox>" | Format-Table
```

Expected: three rows, each with `InScope` set to `True`.

Then run it once against any other mailbox in the tenant:

```powershell
Test-ServicePrincipalAuthorization -Identity "<enterprise-app-object-id>" -Resource "<some-other-mailbox>" | Format-Table
```

Expected: every row has `InScope` set to `False`. If a row is `True`, the app
can reach a mailbox it should not: stop, remove the role assignments, and
report it. Do not continue with a tenant-wide grant.

Role changes can take from 30 minutes to two hours to reach Microsoft Graph.

## 6. Hand back

Tell the orchestrator session that the registration is done and how many rows
step 5 showed in scope. Send no ids. The service's live smoke then reads the
values through `op run`, lists a page of messages, creates one uniquely marked
test event, and deletes it.

## Rotation and removal

- **Rotate** before the certificate expires (two years): repeat step 1, upload
  the new certificate beside the old one, update the two `CERT` fields in
  1Password, restart the service, then delete the old certificate in Entra.
- **Revoke at once**: delete the certificate in Entra, or run
  `Remove-ManagementRoleAssignment` for the three assignments.
- **Remove entirely**: remove the role assignments, the management scope
  (`Remove-ManagementScope`), the Exchange service principal
  (`Remove-ServicePrincipal`), and the app registration.

`ApplicationAccessPolicy` is the legacy way to scope application access and is
not used here.
