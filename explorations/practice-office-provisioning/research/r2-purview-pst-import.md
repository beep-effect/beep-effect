# R2 — Purview / Exchange PST Import Service

Research date: 2026-08-30
Lane: practice-office-provisioning / R2
Scope: operational mechanics of bulk-importing historical PST files into Exchange
Online via the Microsoft Purview Import service. Curated per-matter artifacts
go to Box (R1); this lane is mail only. No client-identifying data.

Cross-read: SKU identification and upgrade shopping live in
[`r5-sku-preflight-and-process.md`](./r5-sku-preflight-and-process.md). This
report states the import *mechanics* and the *user-rights* gate; R5 owns
recording the live oip.law assignment.

## Executive summary

The supported bulk path is **network upload**, not drive shipping, not Graph,
not EWS, and not `New-MailboxImportRequest`. In the Microsoft Purview portal
an administrator with **Mailbox Import Export** plus **Mail Recipients** (or
Global Admin) creates a job, copies a SAS URL, uploads PSTs with the
wizard-supplied AzCopy into the tenant's `ingestiondata` blob, submits a
mapping CSV, waits for analysis, then imports with optional Intelligent
Import filters. Network upload is free and unlimited in volume; blobs expire
**30 days** after the most recent import job if none are in progress.

**Headline risk for this practice:** the *method* is available under all
commercial licensing agreements, but the *user rights* to bulk-import PST
files are listed only for Exchange Online Plan 2, Microsoft 365 E3/E5
(and A/G variants), Office 365 E3/E5 (and A/G variants), Microsoft Purview
Suite / Defender+Purview Suite FLW, and Microsoft 365 E5 Information
Protection and Governance. **Microsoft 365 Business Standard and Business
Premium are not on that list.** Business Premium *does* include a 1.5 TB
auto-expanding archive. Those are different gates. Confirm the assigned SKU
in R5 before any irreversible upload. Using the Import page without a listed
SKU is a product-terms risk even if the UI is visible.

**Recommended target, given the ratified "archive mailbox" decision:** import
into the attorney's **archive mailbox** (`IsArchive=TRUE`) under a segregated
folder such as `/Historical-PST`. Never set `TargetRootFolder` to `/` on an
archive import: Microsoft documents that combination as landing Inbox / Sent
/ Deleted content in **hidden non-IPM folders**. Do not use a dedicated
shared mailbox as a multi-identity dump — Exchange Online Archiving terms
prohibit using an archive to store mail for multiple users.

Hard operational ceiling: **100 GB per archive import**. Imports land in the
*main* archive only; auto-expand storage is on-demand and is not a target.
The 2026-06-11 overview says split >100 GB jobs and wait for auto-expand
between them. A 2025-09-11 troubleshoot article still says auto-expansion
**does not support PST import**. Treat that conflict as open: batch ≤100 GB,
wait (provisioning can take up to 30 days, growth cap 1 GB/day), and be
ready to open a support ticket if expansion does not occur.

After import, Exchange sets `RetentionHoldEnabled` to **True indefinitely**.
Leave it on until a keep-forever (or long) retention policy exists.
Historical legal mail must not auto-purge when the hold is later cleared.

---

## 1. Network-upload flow, end to end

Two methods exist. For a solo commercial tenant without an Enterprise
Agreement, only network upload is in play.

| Factor | Network upload | Drive shipping |
| --- | --- | --- |
| Cost | Free | Costs apply (see Purview service description) |
| Licensing of the *method* | All commercial licensing agreements | Microsoft Enterprise Agreement only; not MPSA |
| Max volume | Unlimited (network dependent) | 10 TB per drive, max 10 drives per job |
| Time | Several hours per TB (network) | 7–10 business days after Microsoft receives the drive |
| Regions | Includes Germany and Switzerland | Not available in Germany or Switzerland |
| Best for | Ongoing or smaller migrations | Large one-time EA migrations |

Source: [Learn about importing your organization's PST files](https://learn.microsoft.com/en-us/purview/pst-import-overview)
(updated 2026-06-11).

Drive shipping uses `WAImportExport.exe`, BitLocker-encrypts the drive, and
Microsoft returns the drive un-wiped. It is out of scope here.

### 1.1 Permissions

To create jobs you need **both**:

- **Mailbox Import Export** in Exchange Online — not assigned to any role
  group by default.
- **Mail Recipients** — present on Organization Management and Recipient
  Management.

Or: Global Administrator. Microsoft recommends the least-privilege path:
create a dedicated Exchange Online role group, assign those two roles, add
the operator. Do not leave Global Admin as the standing import identity.

### 1.2 Step 1 — Create the job and copy the SAS URL

1. Sign in to [https://purview.microsoft.com/](https://purview.microsoft.com/).
2. **Data lifecycle management → Microsoft 365 → Import → New import job**.
3. Job name: **lowercase letters, numbers, hyphens, underscores only**. No
   spaces, no uppercase.
4. Choose **Upload your data**.
5. Show the network-upload SAS URL, copy it, download AzCopy from the
   wizard (or [https://aka.ms/downloadazcopylatest](https://aka.ms/downloadazcopylatest)).

Protect the SAS URL like a password. Only the AzCopy version from the wizard
/ `aka.ms/downloadazcopylatest` is supported. Azure Storage Explorer cannot
*upload* PSTs to this container. A separate Azure subscription is not
required; the blob is a Microsoft-managed `ingestiondata` container in the
same regional datacenter as the tenant.

Source: [Use network upload to import PST files](https://learn.microsoft.com/en-us/purview/pst-import-network-upload)
(updated 2026-06-11). Older docs alias the same article as
`use-network-upload-to-import-pst-files`.

### 1.3 Step 2 — AzCopy upload

```text
azcopy.exe copy "<Source directory of PST files>" "<SAS URL>"
```

Rules:

- The source argument is a **directory**, not a single file. Every PST in
  that directory is uploaded.
- Optional `--recursive` changes Azure pathnames; those pathnames must match
  `FilePath` in the mapping CSV **exactly, case-sensitive**.
- Optional subfolder after `ingestiondata` in the SAS URL; that subfolder
  name becomes `FilePath`.
- Each PST must have a unique name.
- **≤20 GB per PST** is the documented recommendation. Larger files slow
  the later import job; they are not a hard reject.

### 1.4 Step 3 — Optional view; 30-day expiry

Azure Storage Explorer can attach with the SAS and **list** blobs in
`ingestiondata`. It cannot delete them. If no import jobs are in progress,
**all PSTs in `ingestiondata` are deleted 30 days after the most recent
import job was created**. You must create the import job (step 5) within
30 days of upload. After deletion, completed jobs still appear in the UI
but their file lists go empty.

Source: [FAQ about importing PST files](https://learn.microsoft.com/en-us/purview/pst-import-faq).

### 1.5 Step 4 — Mapping CSV schema

Do not change the header, including the unused SharePoint columns.
Microsoft's template is
[https://go.microsoft.com/fwlink/p/?LinkId=544717](https://go.microsoft.com/fwlink/p/?LinkId=544717).

```csv
Workload,FilePath,Name,Mailbox,IsArchive,TargetRootFolder,ContentCodePage,SPFileContainer,SPManifestContainer,SPSiteUrl
Exchange,,annb.pst,annb@contoso.onmicrosoft.com,FALSE,/,,,,
Exchange,,annb_archive.pst,annb@contoso.onmicrosoft.com,TRUE,,,,,
Exchange,PSTFiles,pilarp_archive.pst,pilarp@contoso.onmicrosoft.com,TRUE,/ImportedPst,,,,
```

| Column | Rule |
| --- | --- |
| `Workload` | Always `Exchange` for mailbox import. |
| `FilePath` | Azure folder under the container. Blank if uploaded to the root of `ingestiondata`. **Do not include `ingestiondata`**. Case-sensitive vs Azure. |
| `Name` | PST filename. Case-sensitive vs Azure. Unique within the job. |
| `Mailbox` | SMTP address, or Exchange GUID when the address is ambiguous / inactive / soft-deleted. Not a public folder or Microsoft 365 Group. |
| `IsArchive` | `FALSE` or blank → primary. `TRUE` → archive (must already be enabled; that row fails otherwise, other rows continue). `TRUE` also works for hybrid cloud archive with an on-prem primary. Hard **100 GB per import** into the main archive. |
| `TargetRootFolder` | Blank → new folder named **Imported** at mailbox root (Inbox-sibling). `/` → merge at the top of the folder tree. `/FolderName` → new Inbox-sibling folder. See Finding 2 for the archive + `/` trap. |
| `ContentCodePage` | Optional. Numeric code page for ANSI CJK PSTs (e.g. `932` Japanese). Leave blank for Unicode. |
| `SPFileContainer`, `SPManifestContainer`, `SPSiteUrl` | Leave blank for PST import. |

**Max 500 rows per mapping file / import job.** More than 500 PSTs → split
into multiple jobs. Validation fails the whole file over that cap.

Cannot import to public folders or unified groups.

### 1.6 Step 5 — Submit the job and wait for analysis

Back in **New import job**: check **I'm done uploading my files** and **I
have access to the mapping file**, upload the CSV, click **Validate**. The
filename turns green on success; otherwise **View log** lists per-row
errors (almost always case, path, >500 rows, or archive not enabled).
Accept terms, save. Status: **Analysis in progress** → **Analysis
completed**. Refresh the list.

Creating import jobs via PowerShell is **not supported**. Use the Purview
UI. (`Get-MailboxImportRequest` still appears in troubleshooting for
corrupted-item counts; that is inspection, not job creation.)

### 1.7 Step 6 — Filter or import everything

On **Import to Microsoft 365**, either:

- **No, I want to import everything**, or
- **Yes, I want to filter it before importing** (Intelligent Import).

Filters, after analysis, can:

- import only items of a certain age,
- import selected message types,
- exclude messages sent or received by specific people (From / To / Cc).

Source: [Filter data when importing PST files](https://learn.microsoft.com/en-us/purview/pst-import-filter-data)
(updated 2026-04-06).

For a salvage estate whose value is "keep everything searchable," default
to import-everything unless the analysis graph shows obvious junk (e.g.
newsletters, huge attachment dumps). Filters are a volume-reduction tool,
not a records-management substitute.

---

## 2. Target choices and consequences

Supported destinations:

- User **primary** mailbox (`IsArchive=FALSE`).
- User **archive** mailbox (`IsArchive=TRUE`, archive already enabled).
- **Inactive** mailbox (GUID in `Mailbox`).
- Hybrid **cloud archive** (on-prem primary + `IsArchive=TRUE`).

Not supported: public folders, unified groups.

### 2.1 Primary vs archive vs shared mailbox

| Target | What happens | Use here? |
| --- | --- | --- |
| Attorney primary | Consumes the live 50 GB or 100 GB user quota. Mixes historical salvage with day-forward mail. Items > MaxReceiveSize still skip at 150 MB. | Overflow only, after archive batches, if auto-expand stalls. |
| Attorney archive | Isolated from Inbox. Main archive only, **100 GB per import**. Auto-expand is not a pre-provisioned target. | **Default.** Matches the ratified archive-mailbox decision. |
| Dedicated shared mailbox | Technically mappable by SMTP. Archive can be enabled (`Enable-Mailbox -Archive` works; auto-enable also allows Shared Mailbox). Unlicensed shared mailbox is **50 GB**. Growing it requires EXO Plan 2 or EOA + Plan 1. | **Do not** use as a multi-identity dump. |

Exchange Online Archiving footnote 2:

> An Archive Mailbox can be used only to archive mail for a single user or
> entity for which a license has been applied. Using an Archive Mailbox as
> a means to store mail from multiple users or entities is prohibited.

Source: [Exchange Online Archiving service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-archiving-service-description/exchange-online-archiving-service-description).
Auto-expand docs repeat the same rule (no journaling / transport-rule /
auto-forward into an archive as a multi-user dump; Microsoft may deny
additional archiving).

One licensed entity (the attorney) importing the firm's historical PST
estate into that person's archive is the compliant reading. A shared
mailbox stuffed with several people's PST dumps is not.

Shared mailboxes *are* supported for auto-expanding archive, and
`Set-OrganizationConfig -AutoEnableArchiveMailbox $true` will auto-provision
an archive on a Shared Mailbox when it hits 90% of quota *if* archiving is
in the assigned license and the mailbox is not dir-synced. That is a
capacity feature, not permission to use the box as a dump.

### 2.2 `TargetRootFolder` strategies

| Value | Result | For this estate |
| --- | --- | --- |
| *(blank)* | New folder **Imported** at mailbox root, Inbox-sibling. | Acceptable fallback. |
| `/` | Merge at the top of the mailbox/archive folder tree. Default folders merge. | **Danger on archive.** See §2.3. Do not use. |
| `/Historical-PST` | New Inbox-sibling folder containing the PST tree. | **Recommended** for a single-batch estate. |
| `/Historical-<pststem>` | One top-level folder per PST. | Use if PSTs represent distinct eras/sources and you want visual separation. |

Microsoft's own tip: run a few test batches before committing the
production mapping.

### 2.3 The hidden-archive trap (`IsArchive=TRUE` + `TargetRootFolder=/`)

If the PST contains default folders (Inbox, Sent Items, Deleted Items)
**and** `TargetRootFolder` is `/` **and** the target is an archive, Exchange
stores the imported content in **non-IPM (hidden) folders**. Storage usage
grows; Outlook shows nothing.

Workaround: remap to blank or `/FolderName` and reimport. Do not use `/`
for this practice.

Source: [Imported PST file content doesn't appear in archive mailbox](https://learn.microsoft.com/en-us/troubleshoot/exchange/administration/imported-pst-file-content-hidden-in-archive-mailbox).

### 2.4 Auto-expanding archive behavior

Prerequisites: enable the archive first
(`Enable-Mailbox -Identity <user> -Archive` or EAC **Recipients → Mailboxes
→ Others → Manage mailbox archive**), then enable auto-expand via Exchange
Online PowerShell only (not EAC, not Purview portal):

```powershell
# One mailbox
Enable-Mailbox -Identity <user> -AutoExpandingArchive

# Entire organization (also covers future mailboxes once their archive is on)
Set-OrganizationConfig -AutoExpandingArchive
```

Once on, **it cannot be turned off**. Administrators cannot adjust the
quota. Enabling it on a mailbox that later becomes inactive blocks
recover/restore of that inactive mailbox (Content Search export is then
the recovery path).

Mechanics ([Learn about auto-expanding archiving](https://learn.microsoft.com/en-us/purview/autoexpanding-archiving),
[Enable auto-expanding archiving](https://learn.microsoft.com/en-us/purview/enable-autoexpanding-archiving)):

- Main archive starts at **100 GB** on qualifying SKUs (50 GB on
  Business Basic/Standard / EXO Plan 1 / Office 365 E1). Warning quota ~90 GB.
- On hold / retention policy, main archive quota bumps 100 → 110 GB
  (warning 90 → 100 GB) when auto-expand is enabled for that user.
- Conversion to auto-expand when archive **including Recoverable Items**
  hits the quota. Extra storage can take **up to 30 days**.
- Growth cap **1 GB/day**. Max **1.5 TB** including Recoverable Items.
- Auxiliary folders are named `<folder>_yyyy (Created on ...)`. Sometimes
  an entire folder moves and keeps its original name, so Outlook will not
  advertise that it now lives on an auxiliary.
- After **any** auxiliary is provisioned, users **cannot delete folders**
  in the archive.
- Classic Outlook search from the **primary** mailbox **does not return**
  auto-expanded archive items. Search is scoped to the current Outlook
  search scope. eDiscovery Content Search **does** search auxiliaries.
  Holds and MRM deletion policies also apply to auxiliaries.
- Item / read-unread counts in Outlook against auxiliaries may be wrong.

### 2.5 The 100 GB archive-import conflict

Two official documents disagree.

**Overview, updated 2026-06-11**
([Archive mailbox import limit](https://learn.microsoft.com/en-us/purview/pst-import-overview#archive-mailbox-import-limit)):

> When you import PST files to a user's archive mailbox (`IsArchive` =
> TRUE), data is imported into the user's main archive mailbox only. The
> import doesn't target auto-expanding archive storage, because
> auto-expanding archive storage is provisioned on demand rather than in
> advance. As a result, you can't import more than 100 GB of data into a
> user's archive in a single import. To import more than 100 GB, divide
> the data across multiple imports and allow time for the archive to
> auto-expand between imports.

**Troubleshoot, updated 2025-09-11**
([Import job fails with MapiExceptionShutoffQuotaExceeded](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/purview/pst-import-service/issues-with-pst-import-job#import-job-fails-with-mapiexceptionshutoffquotaexceeded-error)):

> If the target mailbox is an archive mailbox, you can import up to 100 GB
> of data from PST files into it. However, you can't enable the archive
> mailbox for auto-expansion because the auto-expansion feature doesn't
> support PST import and migration scenarios. … If you have to import more
> than 100 GB … contact Microsoft Support.

Operational stance until Microsoft reconciles this: treat 100 GB as a hard
per-job archive ceiling; enable auto-expand *before* the first large batch
if the SKU allows it; wait for observed expansion (up to 30 days, 1 GB/day)
before the next archive batch; if expansion does not happen, open a support
ticket as the troubleshoot article instructs. Overflow into the primary
plus an MRM **Move to Archive** tag is the documented alternative (and the
workaround used in the field — see Finding 4).

---

## 3. Licensing prerequisites

Two different licenses are easy to conflate.

1. **Method availability** (overview table): network upload is available
   under **all commercial licensing agreements**. That is about *whether
   the Import page exists as a tenant capability*, not about *who may
   benefit*.
2. **User rights to bulk-import PST files** (Purview service description,
   "Licenses for email archiving"):

> To bulk-import PST files to Exchange Online mailboxes, the following
> licenses provide user rights:
>
> - Exchange Online P2
> - Microsoft 365 E5/A5/G5/E3/A3/G3
> - Microsoft Purview Suite/EDU/GOV/FLW and Microsoft Defender + Purview Suite FLW
> - Microsoft 365 E5/A5/F5/G5 Information Protection and Governance
> - Office 365 E5/A5/G5/E3/A3/G3

**Business Basic, Business Standard, and Business Premium are not listed.**

Source: [Microsoft Purview service description — Licenses for email archiving](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description#licenses-for-email-archiving).

"Which users need a license?": the user whose mailbox benefits. Inactive
mailboxes do not require a usage license. Shared / resource mailboxes
generally do not, except when using features that require E5 / Purview
Suite / IP+G.

Whether the Import *UI* is technically reachable on a Business SKU is
unverified here (R5 must record the live tenant). Visibility is not the
license test. Importing without a listed SKU is a product-terms risk
([Microsoft Product Terms](https://www.microsoft.com/licensing)).

### 3.1 Archive and auto-expand rights (separate gate)

From the same Purview section:

| Right | Listed SKUs |
| --- | --- |
| Archive mailbox limited to **50 GB** | Exchange Online Plan 1; Office 365 E1 |
| Archive mailbox limited to **1.5 TB** (auto-expand) | Exchange Online Archiving add-on; Exchange Online Plan 2; Microsoft 365 E5/A5/G5/E3/A3/G3; Purview Suite / Defender+Purview Suite FLW; Microsoft 365 E5/A5/F5/G5 Information Protection and Governance; Office 365 E5/A5/G5/E3/A3/G3; **Microsoft 365 Business Premium** |

Mailbox quotas from [Exchange Online limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits):

| SKU | User mailbox | Archive | Unlicensed shared |
| --- | --- | --- | --- |
| Business Basic / Standard | 50 GB | 50 GB | 50 GB |
| Business Premium | 50 GB | 1.5 TB (starts at 100 GB; auto-expand) | 50 GB |
| Microsoft 365 / Office 365 E3/E5 | 100 GB | 1.5 TB | 50 GB; 100 GB if licensed E3/E5 |
| Exchange Online Plan 1 | 50 GB | 50 GB | 50 GB |
| Exchange Online Plan 2 | 100 GB | 1.5 TB | 50 GB; 100 GB with Plan 2 |

R5 notes a 2026 packaging announcement of extra Business mailbox capacity;
the service-description table still says 50 GB. **The live EAC quota is
the controlling fact.** This report does not rest on the announcement.

### 3.2 Practical path if the tenant is on a Business SKU

- **Business Standard:** 50 GB archive, no listed PST-import user right, no
  auto-expand. Options: add Exchange Online Archiving (archive/auto-expand
  only — does **not** add PST-import user rights), assign Exchange Online
  Plan 2 to the attorney, or move the user to Office 365 / Microsoft 365
  E3. R5 owns price comparison.
- **Business Premium:** 1.5 TB archive **yes**; bulk PST-import user rights
  **not listed**. Same Plan 2 / E3 / Purview-add-on question. Do not assume
  Purview Suite for Business Premium grants PST import — confirm the
  commerce SKU against the service-description list before treating it as
  the import solution (R5 already flags this).
- Drive shipping remains EA-only regardless of SKU.

End-user Outlook Import/Export ([fwlink LinkID=785075](https://go.microsoft.com/fwlink/p/?LinkID=785075))
is a different workflow and is not the bulk Import Service. It does not
satisfy the "user rights to bulk-import" table, because it is not that
service.

---

## 4. Operational realities

### 4.1 Size, format, throughput

- PST format: ANSI and Unicode; prefer Unicode. Outlook 2007+ source.
- Unique filenames. ≤20 GB recommended. ≤300 nested folder levels.
- Items **>150 MB are skipped** (Exchange Online message size limit).
  Default `MaxReceiveSize` is 35 MB; the import service auto-sets it to
  150 MB on the target mailbox if a larger item is present.
- Throughput about **24 GB/day per mailbox**, not guaranteed (shared
  multi-tenant). Different target mailboxes run in parallel; multiple PSTs
  into the **same** mailbox run **sequentially**.

Sources: overview "Requirements and limits" / "Import rate";
[issues with PST import job](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/purview/pst-import-service/issues-with-pst-import-job)
(updated 2025-09-11).

### 4.2 Deduplication

Source: [FAQ — How does the PST import process handle duplicate email items?](https://learn.microsoft.com/en-us/purview/pst-import-faq#how-does-the-pst-import-process-handle-duplicate-email-items-)

Matching is **`SourceEntryId`**, not content.

- Same PST + same `TargetRootFolder` on reimport → skip (no duplicates).
- Native mailbox items (no `SourceEntryId`) → copied → **duplicates**.
- Different PST with overlapping content → **duplicates** (EntryIds differ).
- Same PST + **different** `TargetRootFolder` → full reimport.

Not configurable. Not subject/date/body matching. Conflict resolution keeps
the existing target item when a `SourceEntryId` match is found.

Implication: overlapping salvage PSTs (e.g. several Outlook exports of the
same mailbox) will produce duplicates unless you collapse them before
upload. Repair-and-reimport into the *same* folder is safe.

### 4.3 Metadata, corruption, retries

Original sent/received timestamps and recipients are preserved.

Corrupt items are skipped and counted as **Items skipped (corrupted)** in
the Import UI. `Get-MailboxImportRequest -BatchName … | Get-MailboxImportRequestStatistics -IncludeReport`
exposes `BadItemsEncountered`. Fix with **Scanpst.exe**, re-upload, new
job; same target folder skips already-imported items.

### 4.4 Failure modes

| Symptom | Cause | What to do |
| --- | --- | --- |
| Stuck / slow | PST >20 GB, or several PSTs sequential into one mailbox, or shared-tenant load | Expect ~24 GB/day. Split oversized PSTs. Do not PowerShell-create jobs. |
| `MapiExceptionShutoffQuotaExceeded` | Target full, or archive import >100 GB | Check free quota vs PST size. Batch ≤100 GB to archive. Support ticket if auto-expand does not help. |
| `MailboxAmbiguous` | Duplicate SMTP/UPN (active + soft-deleted) | Put the Exchange GUID in `Mailbox`. [Import fails MailboxAmbiguous](https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/purview/pst-import-service/import-fails-mailboxambiguous). |
| Mapping validation fail | Case mismatch, `ingestiondata` in FilePath, >500 rows, archive not enabled | Fix CSV; enable archive; split jobs. |
| Upload path fail | AzCopy recursive path / case ≠ `FilePath`/`Name` | Recopy names exactly. |
| Empty file list on old jobs | 30-day blob expiry | Expected. Recreate job if you still need the blobs. |
| Azure Storage Explorer cannot delete | By design | Wait for 30-day cleanup, or ignore leftover blobs. |
| Content missing in Outlook after archive import | `TargetRootFolder=/` + default PST folders → hidden non-IPM | Remap and reimport. Verify folder visibility *before* blaming search. |

### 4.5 Retention hold after import

The Import service sets `RetentionHoldEnabled` to **True indefinitely**.
The assigned retention policy is not processed until the hold is cleared
or given an end date. That is deliberate: old imported mail would otherwise
hit deletion/archive tags immediately.

Management options ([network-upload "More information"](https://learn.microsoft.com/en-us/purview/pst-import-network-upload#more-information)):

```powershell
Set-Mailbox -Identity <user> -RetentionHoldEnabled $false
Set-Mailbox -Identity <user> -EndDateForRetentionHold <date>   # leave hold True
```

Or change the retention policy first (lengthen delete/archive tags), then
clear the hold.

**Do not disable the hold until a keep-forever or long retention policy is
in place.** Historical legal mail must not auto-purge. Spiceworks field
report (2019): `RetentionHoldEnabled $true` blocked MRM **Move to Archive**
until it was cleared, after which `Start-ManagedFolderAssistant` moved
overflow from primary to archive. If you use the primary-then-MRM overflow
path, clearing the hold is a required step — but only after the policy is
safe.

### 4.6 Indexing and search latency

Microsoft publishes **no SLA** for Microsoft Search / Outlook indexing
after a PST import. Outlook/EXO search is Microsoft Search. Practical
consequences:

- Hidden-folder mapping (§2.3) is a more common "can't find it" cause than
  indexing delay. Verify the folder is visible in the archive first.
- Classic Outlook search from the primary will **not** hit auto-expanded
  archive items. Search inside the archive, or use Content Search.
- eDiscovery Content Search *does* search auxiliaries.
- For large imports, wait hours to days before treating a miss as data
  loss. Spot-search known messages in the archive scope.

---

## 5. Alternatives (brief)

| Path | Verdict for this estate |
| --- | --- |
| **Drive shipping** | EA only, 7–10 days after receipt, BitLocker via `WAImportExport.exe`, Microsoft returns the drive un-wiped. Not this tenant. [Drive shipping docs](https://learn.microsoft.com/en-us/purview/pst-import-drive-shipping). |
| **Classic Outlook Import/Export** | End-user, workstation-bound, one PST at a time. Petri notes the wizard can target the archive from a dropdown. Fine for a single modest PST; not a salvage-estate tool. [Outlook import](https://go.microsoft.com/fwlink/p/?LinkID=785075). |
| **`New-MailboxImportRequest`** | Docs: **"no longer supported in Exchange Online"**; redirects to network upload. [cmdlet page](https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/new-mailboximportrequest?view=exchange-ps). |
| **Graph mailbox import/export** | Opaque full-fidelity FTS streams from `exportItems` / `createImportSession`. Primary and shared mailboxes. **Not PST, not EML, not RFC822.** Explicitly **not** backup/restore. Item-level, not bulk PST. [Mailbox import and export APIs](https://learn.microsoft.com/en-us/graph/api/resources/mailbox-import-export-api-overview?view=graph-rest-1.0). |
| **Graph MIME `GET /$value`** | Export-only. Creating non-draft items from MIME is not the bulk-PST path (R3 owns write-surface detail). |
| **EWS** | Disablement starts **October 2026**, fully **April 2027**. Do not build a new EWS importer. [EWS deprecation](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-ews-exchange-online). |
| **BitTitan MigrationWiz PST** | Paid. PST 2003+, no corrupt-file repair, upload to Azure or BitTitan storage then migrate. Guide still uses **EWS** against Exchange Online and `EWSAllowedAppIDs` allow-listing — time-limited. [BitTitan PST to Microsoft 365](https://help.bittitan.com/hc/en-us/articles/115008258948-PST-to-Microsoft-365-Migration-Guide). |
| **Other third-party PST tools** | Exist (vendor marketing; not evaluated). Optional only if Purview licensing or the 100 GB archive ceiling blocks the official path. Not first choice. |

---

## 6. Field evidence

Not Microsoft Learn; treat as operational color.

- **Spiceworks, 2019** ([QuotaExceededException thread](https://community.spiceworks.com/t/office-365-pst-import-error-quotaexceededexception/696652)):
  importing several ~20 GB PSTs into a shared-mailbox archive with
  auto-expand enabled still hit quota. Workaround: split ≤100 GB into the
  archive, rest into primary, set `RetentionHoldEnabled $false`, then MRM
  Move to Archive + `Start-ManagedFolderAssistant`. Matches the official
  100 GB ceiling and the retention-hold gotcha.
- **Petri** ([Import PST to Office 365](https://petri.com/import-pst-to-office-365/)):
  walkthrough of the Purview network-upload path; notes Outlook desktop
  import can target archive. Useful as a secondary runbook, not a license
  source.
- **Exchange Team Blog** ([Office 365 Auto-Expanding Archives FAQ](https://techcommunity.microsoft.com/t5/exchange-team-blog/office-365-auto-expanding-archives-faq/ba-p/607784)):
  linked from current auto-expand Learn as "more technical details." Use
  for auxiliary-archive behavior, not for PST-import licensing.

---

## Licensing matrix

Legend: **Yes** = listed user right. **No** = not listed for that right.
Archive sizes are the service-description / EXO-limits figures; live EAC
quota controls.

| SKU | Bulk PST Import Service (user rights) | In-Place Archive | Auto-expanding archive (1.5 TB) | Notes for this lane |
| --- | --- | --- | --- | --- |
| Microsoft 365 Business Basic | **No** | Yes, 50 GB | No (add EOA or upgrade) | Import UI visibility unknown; do not assume rights. |
| Microsoft 365 Business Standard | **No** | Yes, 50 GB | No (add EOA or upgrade) | Same. EOA add-on does not add PST-import rights. |
| Microsoft 365 Business Premium | **No** (not listed) | Yes, starts 100 GB | **Yes** | Archive capacity is not the import license. |
| Microsoft 365 Apps for business | **No** | No mailbox | No | Cannot host oip.law mail. |
| Office 365 E1 | **No** | Yes, 50 GB | No (add EOA) | |
| Office 365 E3 / E5 | **Yes** | Yes | Yes | E3 is the cheapest *listed* suite that grants import + 1.5 TB archive. |
| Microsoft 365 E3 / E5 | **Yes** | Yes | Yes | |
| Exchange Online Plan 1 | **No** | Yes, 50 GB | No (add EOA or move to P2) | |
| Exchange Online Plan 2 | **Yes** | Yes | Yes | Cleanest Exchange-only upgrade for import + archive. |
| Exchange Online Archiving add-on | **No** (archive only) | — | Yes, on an eligible base | Does not appear on the bulk-import list. |
| Microsoft Purview Suite / IP+G / Defender+Purview Suite FLW | **Yes** (listed) | per base SKU | Yes (listed) | Confirm the exact commerce add-on name against the service-description string before buying. |

Drive shipping: EA only, any of the above.

Who needs the license: the mailbox that *benefits*. For this estate, that
is the attorney.

---

## Recommended runbook sketch

Assume salvage restoration (G1) has produced a set of PSTs. Do not start
this runbook until R5 has recorded the assigned SKU.

1. **SKU preflight (R5).** If the attorney is on Business Standard or
   Business Premium, do not treat Purview import as licensed. Assign
   Exchange Online Plan 2 or move to Office 365 / Microsoft 365 E3 (or a
   listed Purview/IP+G add-on) *before* irreversible upload. Enable the
   archive. If the estate is likely >50 GB (Standard) or will exceed the
   main 100 GB archive, enable auto-expand on that mailbox only
   (`Enable-Mailbox -AutoExpandingArchive`) — it cannot be turned off.
2. **Inventory PSTs.** Count, size, unique names, date range, source
   account. Run Scanpst.exe on every file. Split anything >20 GB. Collapse
   overlapping exports of the same mailbox (SourceEntryId will not
   dedupe across different PSTs).
3. **Target.** Attorney archive. `IsArchive=TRUE`.
   `TargetRootFolder=/Historical-PST` (or `/Historical-<pststem>`).
   **Never `/`.** Do not create a shared-mailbox dump.
4. **Batch.** ≤100 GB of PST payload per archive import job. Wait for
   auto-expand (watch archive size in EAC; allow up to 30 days) before the
   next archive batch. If expansion does not occur, open a Microsoft
   support ticket. Overflow option: remaining PSTs into primary
   (`IsArchive=FALSE`, still `/Historical-PST`), then MRM Move to Archive
   **after** a safe retention policy exists and the import retention hold
   is intentionally cleared.
5. **Network upload.** Dedicated EXO role group (Mailbox Import Export +
   Mail Recipients). Job name lowercase. AzCopy from the wizard. Create
   the import job within 30 days of upload. Treat the SAS URL as a secret;
   do not paste it into tickets or this repo.
6. **Mapping CSV shape** (placeholder SMTP — replace with the live address
   or Exchange GUID if `MailboxAmbiguous`):

   ```csv
   Workload,FilePath,Name,Mailbox,IsArchive,TargetRootFolder,ContentCodePage,SPFileContainer,SPManifestContainer,SPSiteUrl
   Exchange,,firm-mail-2008.pst,user@oip.law,TRUE,/Historical-PST,,,,
   Exchange,,firm-mail-2014.pst,user@oip.law,TRUE,/Historical-PST,,,,
   ```

   Unique `Name` per row. ≤500 rows. Header unchanged. Leave SP columns
   blank. `FilePath` blank if AzCopy targeted the container root.
7. **Validate → Analysis completed → import everything**, unless the
   analysis graph is junk-heavy (then age/type/user filters).
8. **Verify.**
   - Job status Complete.
   - Per-PST imported vs skipped/corrupted counts.
   - Folder `/Historical-PST` (or per-PST folders) **visible** in Outlook
     archive — not hidden.
   - Spot-search known messages **in the archive scope**, not from the
     primary.
   - `Get-MailboxStatistics` (primary and archive) for size.
   - Leave `RetentionHoldEnabled` True until retention design exists.
9. **Retention.** Design keep-forever or long retention for this mailbox
   *before* clearing the hold. Then either `Set-Mailbox -RetentionHoldEnabled $false`
   or set `-EndDateForRetentionHold`.
10. **Do not** disable auto-expand (you cannot). Do not delete archive
    folders after an auxiliary has been provisioned (you cannot). Do not
    build EWS or Graph-FTS importers for this job.

---

## Open questions

1. **Live SKU (R5).** Does the attorney's assigned product appear on the
   bulk-PST-import user-rights list? If it is Business Standard/Premium,
   which purchasable add-on or replacement actually grants the right
   (EXO Plan 2 vs Office 365 E3 vs a named Purview add-on)?
2. **UI vs terms.** Does a Business SKU tenant even see **Data lifecycle
   management → Import**, or is the restriction portal-enforced? Visibility
   is not entitlement either way.
3. **Auto-expand vs PST import.** 2026-06-11 overview says split and wait;
   2025-09-11 troubleshoot says auto-expansion does not support PST import.
   Which behavior does this tenant get? Needs a first 100 GB batch as a
   probe, then a support ticket if the archive does not grow.
4. **Estate size.** Unknown until salvage restoration G1 finishes. The
   100 GB-per-batch and 1 GB/day growth cap make calendar time a function
   of that number (e.g. ~1.5 TB theoretical max is a many-month ingest if
   auto-expand actually accepts PST-driven growth).
5. **Indexing SLA.** None published. How long until Outlook archive search
   is trustworthy on this tenant after a multi-tens-of-GB import?
6. **Retention policy currently assigned.** Unknown. The import hold will
   freeze it; clearing the hold without inspecting tags is how historical
   mail gets purged.
7. **Ambiguous SMTP.** Will the live alias collide with a soft-deleted
   mailbox? Have Exchange GUID ready.
8. **Purview Suite for Business Premium.** R5 asks whether that commerce
   SKU is on the bulk-import list. This report's list uses the service-
   description strings; the Suite-for-Business-Premium retail name is not
   spelled identically there. Confirm before buying it *for import*.

---

## Sources

Microsoft Learn (scraped 2026-08-30; cite `en-us` URLs):

| Page | URL | Updated / note |
| --- | --- | --- |
| Learn about importing PST files | https://learn.microsoft.com/en-us/purview/pst-import-overview | 2026-06-11 |
| Use network upload | https://learn.microsoft.com/en-us/purview/pst-import-network-upload | 2026-06-11 (alias: `use-network-upload-to-import-pst-files`) |
| Filter imported data | https://learn.microsoft.com/en-us/purview/pst-import-filter-data | 2026-04-06 |
| PST import FAQ | https://learn.microsoft.com/en-us/purview/pst-import-faq | 2026-06-11 |
| Drive shipping | https://learn.microsoft.com/en-us/purview/pst-import-drive-shipping | EA-only path |
| Issues with PST import job | https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/purview/pst-import-service/issues-with-pst-import-job | 2025-09-11 |
| Import fails MailboxAmbiguous | https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/purview/pst-import-service/import-fails-mailboxambiguous | |
| Hidden archive content | https://learn.microsoft.com/en-us/troubleshoot/exchange/administration/imported-pst-file-content-hidden-in-archive-mailbox | |
| Enable archive mailboxes | https://learn.microsoft.com/en-us/purview/enable-archive-mailboxes | |
| Learn about auto-expanding archiving | https://learn.microsoft.com/en-us/purview/autoexpanding-archiving | |
| Enable auto-expanding archiving | https://learn.microsoft.com/en-us/purview/enable-autoexpanding-archiving | "can't be turned off" |
| Microsoft Purview service description | https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description | bulk-import user rights |
| Exchange Online Archiving service description | https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-archiving-service-description/exchange-online-archiving-service-description | one-user archive; footnote 2 |
| Exchange Online limits | https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits | quotas |
| Graph mailbox import/export | https://learn.microsoft.com/en-us/graph/api/resources/mailbox-import-export-api-overview?view=graph-rest-1.0 | FTS streams, not PST |
| EWS deprecation | https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-ews-exchange-online | Oct 2026 / Apr 2027 |
| New-MailboxImportRequest | https://learn.microsoft.com/en-us/powershell/module/exchangepowershell/new-mailboximportrequest?view=exchange-ps | "no longer supported in Exchange Online" |
| Mapping CSV template | https://go.microsoft.com/fwlink/p/?LinkId=544717 | |
| End-user Outlook PST import | https://go.microsoft.com/fwlink/p/?LinkID=785075 | not the bulk service |
| Purview portal | https://purview.microsoft.com/ | |
| AzCopy | https://aka.ms/downloadazcopylatest | wizard copy preferred |
| Product Terms | https://www.microsoft.com/licensing | user-rights enforcement |

Secondary:

| Page | URL | Role |
| --- | --- | --- |
| Exchange Team Blog auto-expand FAQ | https://techcommunity.microsoft.com/t5/exchange-team-blog/office-365-auto-expanding-archives-faq/ba-p/607784 | linked from current Learn |
| Spiceworks QuotaExceededException | https://community.spiceworks.com/t/office-365-pst-import-error-quotaexceededexception/696652 | 100 GB + retention-hold war story |
| Petri import guide | https://petri.com/import-pst-to-office-365/ | secondary runbook |
| BitTitan PST to Microsoft 365 | https://help.bittitan.com/hc/en-us/articles/115008258948-PST-to-Microsoft-365-Migration-Guide | EWS-dependent third party |

Sibling lane: [`r5-sku-preflight-and-process.md`](./r5-sku-preflight-and-process.md)
(SKU identification, upgrade shopping, eDiscovery gates).
