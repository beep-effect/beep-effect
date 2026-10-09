# Practice contacts: grant, seeding and reversal

All identifiers, mailbox values and source locations below are placeholders.
The orchestrator runs administrative commands after PR 1 merges. The worker never
runs tenant-administration commands. Live contact writes run only code on main.

## 1. Grant (route A)

Reuse the existing certificate registration `beep-agent-outbox` and its Exchange
service principal. Add no registration or Entra permission; its
`requiredResourceAccess` remains empty. Entra and Exchange grants are additive.
Use the new attorney-only scope rather than the existing shared scope.

Connect the administrative Exchange Online PowerShell session, or obtain the
Exchange token in the orchestrator's already authenticated az session. Each
operation below has equivalent PowerShell and Exchange admin REST forms.

```powershell
Connect-ExchangeOnline
```

```sh
T=$(az account get-access-token --resource https://outlook.office365.com --query accessToken -o tsv)
```

Create the scope, assign the contacts role, then test the attorney and comparison
mailbox. Only the contacts row must be `InScope=True` for the attorney and
`InScope=False` for the other mailbox. Pre-existing mail/calendar grants may
still report True on the other mailbox: record that without changing them.

```powershell
New-ManagementScope -Name "beep-practice-contacts-mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq '<attorney-mailbox>'"
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"New-ManagementScope","Parameters":{"Name":"beep-practice-contacts-mailbox","RecipientRestrictionFilter":"PrimarySmtpAddress -eq '<attorney-mailbox>'"}}}
JSON
```

```powershell
New-ManagementRoleAssignment -Name "beep-practice-contacts-readwrite" -App "<outbox-enterprise-app-object-id>" -Role "Application Contacts.ReadWrite" -CustomResourceScope "beep-practice-contacts-mailbox"
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"New-ManagementRoleAssignment","Parameters":{"Name":"beep-practice-contacts-readwrite","App":"<outbox-enterprise-app-object-id>","Role":"Application Contacts.ReadWrite","CustomResourceScope":"beep-practice-contacts-mailbox"}}}
JSON
```

```powershell
Test-ServicePrincipalAuthorization -Identity "<outbox-enterprise-app-object-id>" -Resource "<attorney-mailbox>"
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"Test-ServicePrincipalAuthorization","Parameters":{"Identity":"<outbox-enterprise-app-object-id>","Resource":"<attorney-mailbox>"}}}
JSON
```

```powershell
Test-ServicePrincipalAuthorization -Identity "<outbox-enterprise-app-object-id>" -Resource "<other-mailbox>"
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"Test-ServicePrincipalAuthorization","Parameters":{"Identity":"<outbox-enterprise-app-object-id>","Resource":"<other-mailbox>"}}}
JSON
```

Hand back values only: `contacts-inscope attorney=True other=False` with UTC time.
No ids or addresses enter the evidence. Authorization propagation may take
30 minutes to two hours; the folder-list probe is read-only.

Route B, a dedicated registration following the outbox runbook's steps 1–5,
was considered and rejected because new vault fields would require `op-human`.

## 2. Seeding run

The live write is pre-authorized by R3. Run in this order, from main's merged code.
The five `M365_APP_ONLY_*` names in `contacts.env` resolve the existing outbox
certificate and attorney mailbox. No mailbox flag exists. No other env file is
needed. The fixed folder name is `Practice contacts (seeded)`, and stored ids
survive a later rename. The state location defaults to
`<state-home>/beep/practice-m365-contacts/`, where `<state-home>` is
`XDG_STATE_HOME` or the user's default local state directory.

1. Check the references with output suppressed:

   ```sh
   op run --env-file=apps/practice-m365-contacts/contacts.env -- true >/dev/null
   ```

2. Run the read-only grant probe from the driver package:

   ```sh
   beep-heavy op run --env-file=../../../apps/practice-m365-contacts/contacts.env -- env -u M365_LIVE_WRITE -u M365_LIVE_CONTACTS_WRITE bunx --bun vitest run test/integration/M365.appOnly.live.test.ts -t "contacts smoke: lists"
   ```

3. Export every contact in every folder before any write. The target must be
   outside the checkout and must not exist; its parent and file use modes 0700
   and 0600. Record the count and full sha256 in SPEC. Do not print the content.

   ```sh
   op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts export --out <corpus-home>/ops/practice-contacts/<YYYY-MM-DD>/export.jsonl
   ```

4. Run online dry-run with each salvaged CSV supplied through repeatable `--csv`
   flags. There is no default corpus location. VCF is accepted only by offline
   census; online dry-run and apply reject it. Stop on any untracked tagged
   contact. Conflicts mean matching name/company with differing personal email;
   they are counted and skipped, never overwritten.

   ```sh
   op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts dry-run --csv <input.csv>
   ```

5. Run the contacts-only smoke from the driver package: exactly one synthetic
   contact POST and one DELETE of that same contact. Do not set `M365_LIVE_WRITE`.

   ```sh
   beep-heavy op run --env-file=../../../apps/practice-m365-contacts/contacts.env -- env -u M365_LIVE_WRITE M365_LIVE_CONTACTS_WRITE=1 bunx --bun vitest run test/integration/M365.appOnly.live.test.ts -t "contacts smoke"
   ```

6. Apply with the same CSV flags, then re-run dry-run. The first apply creates
   at most one folder and the plan's contacts; the second plan must have zero
   creates. Every create carries category `beep-practice-contacts-seed` and
   the invisible `beepSeedRun` property. No master category is provisioned.

   ```sh
   op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts apply --yes --csv <input.csv>
   ```

7. Run both rollback dry-runs in §3. Record counts and run id only. The worker
   never executes live undo; it requires a later orchestrator ruling.

One writer holds an exclusive private lock. Stale locks fail closed: inspect
and remove a stale lock only after proving its owner exited. Journals must be
preserved; unexpected malformed state stops the run. An ambiguous POST triggers
marker reconciliation and stops before any retry. A live defect must be fixed
through a reviewed PR before another live run.

## 3. Rollback

The pre-seed export backs up the prior mailbox contacts. Existing mailbox
contacts are never patched. Per-run undo removes only recorded contacts that
still carry their marker and whose change key matches; edited contacts are
reported and preserved. Category undo is the complete R3c reversal and deletes
every tagged contact in every folder, reporting edited contacts as a count.
It does not require a journal. Missing receipts or change keys are counted as
`unverifiable`, separately from confirmed edits; per-run undo preserves them.
Both remove an empty folder only if a journal
records that this job created it, and never remove folders with child folders.

```sh
op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts undo --run <run-id> --dry-run
op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts undo --by-category --dry-run
```

After a later orchestrator ruling, the corresponding live reversals are:

```sh
op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts undo --run <run-id> --yes
op run --env-file=apps/practice-m365-contacts/contacts.env -- bun run apps/practice-m365-contacts/src/bin.ts undo --by-category --yes
```

## 4. Remove the grant

The orchestrator removes the contacts assignment before removing its scope.
Exchange refuses scope deletion while an assignment still references it.
The outbox's three previous assignments and `beep-docket-intake-mailbox` stay
untouched. Obtain `$T` as in §1 for the equivalent REST forms.

```powershell
Remove-ManagementRoleAssignment -Identity "beep-practice-contacts-readwrite" -Confirm:$false
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"Remove-ManagementRoleAssignment","Parameters":{"Identity":"beep-practice-contacts-readwrite"}}}
JSON
```

```powershell
Remove-ManagementScope -Identity "beep-practice-contacts-mailbox" -Confirm:$false
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"Remove-ManagementScope","Parameters":{"Identity":"beep-practice-contacts-mailbox"}}}
JSON
```

Verify no contacts role assignment for the outbox app, and no contacts authorization row:

```powershell
Get-ManagementRoleAssignment -Role "Application Contacts.ReadWrite"
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"Get-ManagementRoleAssignment","Parameters":{"Role":"Application Contacts.ReadWrite"}}}
JSON
```

```powershell
Test-ServicePrincipalAuthorization -Identity "<outbox-enterprise-app-object-id>" -Resource "<attorney-mailbox>"
```

```sh
curl --fail-with-body -sS -X POST "https://outlook.office365.com/adminapi/beta/<tenant-id>/InvokeCommand" \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -H "X-ResponseFormat: json" -H "X-AnchorMailbox: UPN:<admin-upn>" \
  --data-binary @- <<'JSON'
{"CmdletInput":{"CmdletName":"Test-ServicePrincipalAuthorization","Parameters":{"Identity":"<outbox-enterprise-app-object-id>","Resource":"<attorney-mailbox>"}}}
JSON
```

Route A added no Entra grant, so Graph requires no removal. Confirm the service
principal has no Graph `Contacts.ReadWrite` application role assignment:

```sh
az rest --method GET --url "https://graph.microsoft.com/v1.0/servicePrincipals/<outbox-enterprise-app-object-id>/appRoleAssignments"
```

Primary API references: [Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac),
[child folders](https://learn.microsoft.com/en-us/graph/api/contactfolder-list-childfolders?view=graph-rest-1.0),
and [contact deletion](https://learn.microsoft.com/en-us/graph/api/contact-delete?view=graph-rest-1.0).
