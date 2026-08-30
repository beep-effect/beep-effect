# R1: Box as the legal document system of record

Date: 2026-08-30

> **Provenance note.** This report is a salvage distillation of a crashed R1
> research lane. `(log)` marks a claim recovered from pages or search results
> captured in the session log. `(provided)` marks a tenant fact or ratified
> decision supplied with the mission. No claim in this report relies on an
> uncited URL that was merely seen in the session. No new live research was
> needed, so there are no `(live)` claims.

## Executive summary

Box can be the document system of record for this solo practice, but the
current Business tenant should be described accurately: it is a secure,
versioned, matter-folder repository with sharing, basic workflow, desktop
access, and e-signature. It is not yet a fully governed legal DMS. The live
tenant has no enterprise metadata templates, and Business is not entitled to
them. Enforceable retention and legal holds require Box Governance, which is a
paid add-on below Enterprise Plus. `(provided; log)`
[Box metadata](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/using-metadata.md)
[Box retention](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies)

Start with a shallow, deterministic `client / matter / document-class`
taxonomy provisioned from versioned code. Give every client and matter a
stable, nonsemantic internal ID. Put client collaboration in a dedicated
subfolder because Box permissions cascade downward and cannot be made more
restrictive at a child folder. `(log)`
[Box folder permissions](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-folder-permissions.md)
[NCBA folder guidance](https://www.ncbar.org/2022/04/05/diy-file-naming-conventions-and-folder-structure/)

The Business plan already covers the immediate engagement-letter use case.
Box Sign allows unlimited requests sent from the Box web app on Business, plus
100 requests per customer per year through third-party or custom integrations.
It also includes templates, audit trails, password protection, SMS
verification, custom branding, and Sign-Relay integration. Signed PDFs remain
in Box, and Box exposes a downloadable signing log. `(log)`
[Box Sign plan matrix](https://docs.box.com/en/box-sign/box-sign-for-admins/box-sign-features-in-box-individual-and-business-plans)
[sender storage and permissions](https://docs.box.com/en/box-sign/file-storage-and-permissions/understanding-the-senders-file-storage-and-permissions.md)
[signing log](https://docs.box.com/en/box-sign/sign-document-management/viewing-the-signing-log.md)

Do not use folder upload email as a substitute for email filing. It saves only
attachments, omits the message body, caps the whole message at 50 MB, and is
documented for manual, occasional use rather than forwarding rules or scripts.
M365 remains the mail system of record. Use the Box for Microsoft 365
integration already enabled in the tenant, or an API-backed filing flow, when
the practice later needs message-plus-attachment capture. `(provided; log)`
[upload to Box through email](https://docs.box.com/en/box-fundamentals/for-users/uploads-and-downloads/uploading-and-downloading-files-and-folders-to-box/upload-to-box-through-email)

The first upgrade decision should not be based on firm size. It should fire
when the practice needs one of three controls: searchable matter metadata,
unlimited client collaborators, or enforceable retention. Metadata and
unlimited external collaborators point to Business Plus. Retention points to a
Governance quote or Enterprise Plus. Security classification and
classification-based access controls point to Enterprise or a confirmed Box
Shield entitlement. `(log)`
[Box pricing](https://www.box.com/pricing)
[Box Relay plan matrix](https://docs.box.com/en/box-relay/about-relay/relay-features-in-box-business-plans)

## 1. Matter-centric information architecture

### 1.1 Client, then matter, then document class

Legal DMS products organize content around a client and a matter workspace.
iManage describes the client as the filing cabinet, the matter as its divider,
and ordinary folders inside the matter for documents and correspondence.
NetDocuments likewise lists matter-centric organization, workspace templates,
metadata, email integration, version control, and folder-level access among
the defining legal-DMS capabilities. `(log)`
[iManage matter organization](https://registration.imanage.com/pages/organizing-your-files-in-imanage-work)
[NetDocuments legal DMS guidance](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)

For Box, adapt that model literally:

1. A stable client folder is the ownership and navigation boundary.
2. Each engagement or portfolio is a separate matter folder.
3. A provisioned matter-type skeleton supplies predictable document classes.
4. Box version history handles ordinary edit iterations; filenames record
   only legally meaningful states such as `FILED`, `ISSUED`, or `EXECUTED`.

`(log)` Consistent folder templates reduce filing ambiguity and can be copied
for every new matter. Legal guidance also warns that deeper DIY structures
depend on disciplined naming and become fragile when people do not follow the
rules. [NetDocuments](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)
[NCBA](https://www.ncbar.org/2022/04/05/diy-file-naming-conventions-and-folder-structure/)

### 1.2 Stable numbering

Use opaque, never-reused identifiers:

- Client: `C0001`, `C0002`, and so on.
- Matter: `M2026-0001`, `M2026-0002`, and so on.
- Folder display: `C0001 - Client Short Name` and
  `M2026-0001 - US Patent - Short Description`.

`(log)` This is an adaptation, not a universal industry number. The supported
industry pattern is client first, then matter, with a documented naming
standard. The NCBA specifically asks firms to decide whether the client name,
client number, or both identify the top-level folder. Stable numeric prefixes
also keep Box Drive's name sort deterministic.
[NCBA](https://www.ncbar.org/2022/04/05/diy-file-naming-conventions-and-folder-structure/)

Do not encode mutable facts such as matter status, responsible attorney, or a
client's legal name into the identifier. Do not place invention titles,
inventor names, unpublished application numbers, or other confidential facts
in a filename unless the working context requires them. A short descriptive
suffix is for human navigation; the ID is the durable key. `(log)` Legal file
guidance recommends specific but short names, consistent dates, conservative
characters, and keeping sensitive information out of names.
[Bill4Time naming guidance](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/)

### 1.3 Filename convention

Use:

```text
YYYYMMDD_DocType_ShortDescription_Status.ext
```

Examples without client-identifying data:

```text
20260830_EngagementLetter_EXECUTED.pdf
20260914_InventionDisclosure_RECEIVED.pdf
20261002_USPTO_NonFinalOfficeAction_RECEIVED.pdf
20261201_ResponseToOfficeAction_FILED.pdf
```

`(log)` An ISO-like date prefix makes chronological sorting independent of
filesystem timestamps. Short document-type and status tokens make a file
understandable outside its folder. Avoid special characters and needlessly
long names. [NCBA](https://www.ncbar.org/2022/04/05/diy-file-naming-conventions-and-folder-structure/)
[Bill4Time](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/)

Do not add `_v1`, `_v2`, or `_final_final` for routine edits. Box creates a new
version when a file is edited through supported editors or Box Drive, when the
user chooses **Upload New Version**, or when a same-named file is uploaded into
the same folder. Keep separate files only for meaningful records such as a
client-approved draft and the document actually filed. `(log)`
[Box version history](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History)

### 1.4 Matter subfolder pattern

The skeleton should describe work products, not billing task codes. The 2023
UTBMS patent-prosecution codes are useful as a vocabulary for work phases, but
the practice has ratified that billing remains in FreshBooks without LEDES.
They therefore should not become folder numbers or billing configuration.
`(provided; log)`
[UTBMS IP patent-prosecution codes](https://utbms.com/ip-patent-prosecution-codes/)

Use a small common skeleton plus matter-specific additions. Empty folders that
do not apply may be omitted at creation time. A predictable template matters
more than reproducing every possible proceeding. `(log)`
[NetDocuments](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)
[Bill4Time](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/)

## 2. Box feature fit and plan gates

### 2.1 Metadata templates and cascade policies

Box metadata templates define reusable fields; instances attach template
values to files or folders; cascade policies propagate a folder's template and
values to descendants; and metadata queries search those values. A file or
folder can have up to 100 templates. `(log)`
[Box metadata developer guide](https://developer.box.com/guides/metadata/)

Metadata is reserved for Business Plus, Enterprise, Enterprise Plus, and
Enterprise Advanced. The current Business tenant has zero enterprise metadata
templates, so the starter system must not depend on a hidden or manually
created template. `(provided; log)`
[using metadata](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/using-metadata.md)

When the entitlement exists, create a `Legal Matter` enterprise template with
fields such as `clientId`, `matterId`, `matterType`, `jurisdiction`, `status`,
`openDate`, and `closeDate`, then apply it at each matter root. Cascade is an
offline process, can take time, cannot be undone as a single operation, and
leaves applied values behind when the policy is disabled. External
collaborators can see applied templates and attributes. Test in a disposable
tree before applying it to production. `(log)`
[cascading metadata](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/cascading-metadata-in-folders)

### 2.2 Retention, disposition, and legal holds

Retention is part of Box Governance. Governance is included in Enterprise Plus
and Enterprise Advanced and is sold as an add-on to other business plans.
Policies can target folders, classification labels, metadata, or all new
content. Retained content can move to Trash but cannot be purged until the
period ends; the longest applicable policy wins. Retention covers existing and
future file versions. `(log)`
[Box retention](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies)

Box legal holds can preserve managed-user custodians, folders, files, and file
versions. A legal hold outranks retention disposition. This is a litigation or
investigation control, not the ordinary client-file retention schedule.
`(log)`
[Box legal holds](https://docs.box.com/en/box-governance/legal-holds/about-legal-hold-policies.md)

On the current Business plan, folder names such as `99 Closed` are lifecycle
labels only. They do not prevent deletion and must never be described as a
retention policy. The practice should adopt its legal retention schedule with
counsel or its responsible attorney before the provisioning code creates any
destructive disposition rule. `(provided; log)`
[Box retention](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies)

### 2.3 Classification and Box Shield

Box classification labels identify content sensitivity and support
classification-based access policies. A file or folder can have one label;
an enterprise can define up to 25. External users can see a file's label in
preview but cannot change it unless they are an allowed internal role.
`(log)`
[classification labels](https://docs.box.com/en/box-shield/shield-classification-labels-and-policies/classification-labels)

The current pricing page lists native classifications, classification-based
access policies, and threat-detection rules under Enterprise's advanced
security. It separately lists Box Shield and Shield Pro among optional add-ons,
so the exact SKU must be confirmed in a quote before code treats any Shield API
as available. Business does not supply these controls. `(log)`
[Box pricing](https://www.box.com/pricing)
[Box Shield](https://www.box.com/shield)

For a one-attorney starter deployment, do not imitate classification by adding
`CONFIDENTIAL` to every filename. Box content is client-confidential by
default as a practice rule. Buy and configure classification when it will
drive an actual control, such as blocking external sharing, restricting an AI
integration, or meeting a client security requirement. `(log)`
[Box Shield](https://www.box.com/shield)

### 2.4 Collaboration and waterfall permissions

Box folder collaborations use Co-owner, Editor, Viewer Uploader, Previewer
Uploader, Viewer, Previewer, and Uploader roles on Business and Enterprise
accounts, subject to admin enablement. Single-file collaboration supports only
Editor and Viewer. An Editor can rename, move, and delete descendants and may
invite other collaborators if the admin permits it. A Viewer can preview and
download but cannot upload or edit. An Uploader can add content without
previewing or downloading it. `(log)`
[collaborator permission levels](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-collaborator-permission-levels)

Permissions follow a waterfall. Access granted on a folder applies to every
descendant, and inherited access cannot be reduced at a child. Invite a client
only to the narrowest dedicated exchange folder. Do not collaborate on the
client root or matter root unless the client should see every descendant.
`(log)`
[folder permissions](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-folder-permissions.md)

Business charges external collaborators as paid accounts; Business Plus and
higher plans include unlimited external collaborators. An outside client's
free account does not inherit the firm's storage quota, although uploads into
a firm-owned folder consume the owner's storage. `(log)`
[Box pricing](https://www.box.com/pricing)
[Box community answer](https://support.box.com/hc/en-us/community/posts/4411192390547-External-Collaborators-and-storage-space)

### 2.5 Client-sharing security defaults

Use these defaults for provisioned client-exchange folders:

- Client role is `Viewer` for outbound delivery, including invoices and final
  work product. Use `Viewer Uploader` only when the client must both download
  and submit documents. Use `Uploader` or a File Request when the client must
  submit without seeing existing items. `(log)`
  [roles](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-collaborator-permission-levels)
  [File Request](https://docs.box.com/en/box-fundamentals/for-users/collaborating/sharing-content-using-box/introducing-box-file-request.md)
- Change the enterprise default collaboration role from Editor to Viewer so a
  mistaken invitation starts read-only. `(log)`
  [default collaborator role](https://docs.box.com/en/box-admin-tools/managing-content/enterprise-settings/changing-the-default-collaborator-level-from-editor-to-viewer.md)
- Prefer named collaboration or `Invited people only` shared links. If a shared
  link is necessary, set a password and expiry and avoid `People with the
  link` for client-confidential material. `(log)`
  [securing shared links](https://docs.box.com/en/box-fundamentals/for-users/collaborating/using-shared-links/securing-shared-links.md)
- Review external users and their activity, grant the minimum access, and
  remove access when the engagement ends. The firm's admin cannot apply all
  managed-user controls, such as its own SSO or device pinning, to an external
  user. `(log)`
  [external-user practices](https://docs.box.com/en/box-admin-tools/managing-box-users-and-admins/external-users/best-practice-managing-external-users.md)

### 2.6 Box Relay

Business and Business Plus include file, folder, task, and Sign events and
actions, manual starts, multiple outcomes, condition logic, rejections,
scheduled workflows, and dynamic file or folder naming. Enterprise adds
metadata triggers and actions, custom workflow templates, automated
classification, and workflow ownership transfer. Enterprise Advanced adds
Forms, Doc Gen, and end-to-end Sign signature-request outcomes. `(log)`
[Relay plan matrix](https://docs.box.com/en/box-relay/about-relay/relay-features-in-box-business-plans)

Starter uses that fit Business include notifying the attorney when a client
uploads to an exchange folder, routing an engagement letter for approval and
signature, and moving a completed signed document into `00 Engagement`.
However, the Box Drive FAQ says Drive uploads do not trigger workflow actions.
Test the exact trigger path before relying on Relay, and use a supported web,
Sign, or API entry point for critical automation. `(log)`
[Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)

### 2.7 Email-to-Box

Business and Enterprise administrators can enable a unique upload address on a
folder and restrict it to that folder's collaborators. The feature uploads
attachments only, not the email body. The whole message must remain under
50 MB, `.msg` and `.eml` attachments from Outlook desktop can fail, and SPF
failures reject an upload. Box says the feature is for manual, occasional use
and does not support automated forwarding or scripts. `(log)`
[upload to Box through email](https://docs.box.com/en/box-fundamentals/for-users/uploads-and-downloads/uploading-and-downloading-files-and-folders-to-box/upload-to-box-through-email)

Use it only as a convenience address for occasional attachments, with
**Only allow email uploads from collaborators in this folder** enabled. It is
not a defensible matter-email archive. M365 keeps the message record; Box keeps
selected attachments and work product. `(provided; log)`
[upload to Box through email](https://docs.box.com/en/box-fundamentals/for-users/uploads-and-downloads/uploading-and-downloading-files-and-folders-to-box/upload-to-box-through-email)

### 2.8 Box Sign

Business includes unlimited documents sent for e-signature from the Box web
app. It includes unlimited templates, SMS verification, document password
protection, shared signature requests, Sign-Relay integration, custom branding,
and text-field validation. The Business allowance for third-party and custom
integration requests is 100 per customer per year. Enterprise adds signer
attachments and recipient groups; Enterprise Plus adds batch send, ready-sign
links, Box-login verification, and conditional fields. `(log)`
[Box Sign plan matrix](https://docs.box.com/en/box-sign/box-sign-for-admins/box-sign-features-in-box-individual-and-business-plans)

Engagement letters and fee agreements fit the current plan. Keep a reusable
template in a firm-controlled template area, send the request from the matter's
`00 Engagement` folder, and save the completed PDF there. The sender needs
download permission, Box stores the workflow PDFs in Box, and Box creates the
signed PDF after completion. `(log)`
[sender storage and permissions](https://docs.box.com/en/box-sign/file-storage-and-permissions/understanding-the-senders-file-storage-and-permissions.md)

Download and retain the signing log with the completed agreement when the
matter policy calls for it. The log can include hashes, identities, IP
addresses, timestamps, authentication methods, and signature events. `(log)`
[signing log](https://docs.box.com/en/box-sign/sign-document-management/viewing-the-signing-log.md)

### 2.9 Box Drive constraints

Box Drive streams the user's accessible Box tree into Finder or File Explorer.
Online-only files are placeholders until opened, at which point Drive downloads
them to a local cache and uploads saved changes. The default cache is at most
25 GB, while content explicitly marked offline is outside that cap and can
consume disk space until only 2 GB remains. `(log)`
[Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)

Mark only the active matters needed for travel as offline. The selection is
per device; entire selected folders download; logging out removes cached and
offline content and resets offline preferences. Two people editing the same
desktop file do not see live changes, and overlapping saves can produce
conflict copies. `(log)`
[offline access](https://docs.box.com/en/box-drive/getting-started-with-box-drive/making-content-available-offline)

Windows commonly limits paths to 260 characters. New Box Drive supports long
paths internally, but File Explorer and Microsoft Office can still fail on very
long paths. Keep the hierarchy shallow and names short. Box Drive also rejects
some characters and reserved names, and names are case-insensitive and
accent-insensitive. `(log)`
[Windows-specific Box Drive limits](https://support.box.com/hc/en-us/articles/48792836793875-Windows-Specific-Limitations-for-the-New-Box-Drive)
[Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)

Do not use Box Drive for the historical backfill or for mass moves. Box says it
is not a bulk migration tool, and desktop copy operations download content
before uploading the copy. Provision and backfill through the API or a Box
migration tool. `(provided; log)`
[Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)

The tenant reportedly shows 25 prior versions per file. Current Box
documentation and pricing show 50 prior versions for Business and Business
Plus, 100 for Enterprise, and unlimited for Enterprise Plus, Enterprise
Advanced, or Governance customers. Treat the observed tenant value as the
operational limit until Box confirms the contract or the admin console is
corrected. `(provided; log)`
[Box version history](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History)
[Box pricing](https://www.box.com/pricing)

## 3. Client collaboration and invoice delivery

Create one `90 Client Exchange` folder inside each matter and collaborate only
there. Its children may include `01 From Client`, `02 To Client`, `03 For
Signature`, and `04 Invoices`. The client cannot see sibling internal folders
when invited only to this child, but will inherit access to everything below
it. `(log)`
[folder permissions](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-folder-permissions.md)

FreshBooks can download one or many invoices as PDFs and can email an invoice
or share it by link. A client can view and print an emailed invoice without
creating a FreshBooks account, and the client portal can download invoice PDFs.
FreshBooks remains the billing source of truth. `(provided; log)`
[manage FreshBooks invoices](https://support.freshbooks.com/hc/en-us/articles/4404632032013-How-do-I-manage-my-invoices)
[FreshBooks client accounts](https://support.freshbooks.com/hc/en-us/articles/115011425548-How-do-client-accounts-work)

For Box delivery, export the final invoice PDF from FreshBooks, give it a
deterministic name such as `20260830_Invoice_000123_ISSUED.pdf`, and upload it
to `90 Client Exchange/04 Invoices`. Give the client Viewer access. The Box
copy is a delivery artifact; payment status and corrections stay in
FreshBooks. If the invoice is replaced, upload a new version only when it is
the same accounting document. Use a new file for a credit note or corrected
invoice with a new FreshBooks identifier. `(provided; log)`
[manage FreshBooks invoices](https://support.freshbooks.com/hc/en-us/articles/4404632032013-How-do-I-manage-my-invoices)
[collaborator roles](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-collaborator-permission-levels)

## 4. Practitioner reality and alternatives

The recovered research found little first-hand material from solo attorneys
who use Box as their primary DMS. That absence matters. The strongest specific
practitioner result was a law-firm user describing a Box matter skeleton with
Engagement/Termination, Work Product, Correspondence, Docket, Discovery,
Productions, Experts, Transcripts, and Settlement. The same user criticized
Box search, although they said it had improved. `(log)`
[Lawyertalk Box workflow discussion](https://www.reddit.com/r/Lawyertalk/comments/1phg1u7/whats_your_dropbox_workflow_for_case_files_mine/)

Another practitioner result characterized Box as file storage and sharing
rather than a full contract or legal-DMS product, with folder navigation and a
manually numbered taxonomy as pain points. A separate small-office discussion
described pairing Clio with Box for client uploads and downloads. Those reports
support using Box as this practice's document layer while M365 and FreshBooks
retain their ratified responsibilities. `(log)`
[Box as contract repository discussion](https://www.reddit.com/r/Lawyertalk/comments/1me9s2u/inhouse_attorneys_whats_your_favorite_contract/)
[Clio and Box discussion](https://www.reddit.com/r/Lawyertalk/comments/186dmpi)

Small-firm discussions consistently frame iManage and NetDocuments as costly
or complex compared with ordinary cloud storage, but they also identify what a
general repository lacks: matter-native email filing, document profiles,
managed legal workflows, OCR/search, ethical walls, and legal-specific
governance. `(log)`
[small-firm DMS discussion](https://www.reddit.com/r/LawFirm/comments/1crmf2r/what_do_small_law_firms_use_for_document/)
[NetDocuments feature baseline](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)

The practical conclusion is narrower than a product comparison. Box is viable
for a solo practice because administration and collaboration are small enough
to impose conventions through code. If retrieval failures, email-filing labor,
conflict controls, or client requirements outgrow those conventions, the next
comparison should include a legal-specific DMS rather than adding more folder
depth. `(log)`
[NetDocuments](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)
[iManage](https://registration.imanage.com/pages/organizing-your-files-in-imanage-work)

**NOT COVERED — needs follow-up:** the crashed lane did not obtain a usable,
claim-specific X post from a solo or small-firm attorney. Its X-targeted search
returned attorney profile pages but no post that connected a practitioner to
Box Drive. Do not treat those profiles as evidence. `(log)`

## Upgrade-trigger table

Current public annual list prices are $15 per user per month for Business,
$25 for Business Plus, and $35 for Enterprise, each with a three-user minimum.
Enterprise Plus pricing is not cleanly stated as an annual list price on the
captured page. The existing tenant may be on a legacy agreement, so these are
comparison figures, not a quote. `(log)`
[Box pricing](https://www.box.com/pricing)

| Recommended practice or control | Minimum documented entitlement | Cost of lacking it on Business | Concrete upgrade trigger | Decision |
| --- | --- | --- | --- | --- |
| Enterprise `Legal Matter` metadata template | Business Plus | Matter fields remain encoded in folders or an external manifest; no metadata query; live tenant has zero templates. `(provided; log)` | The provisioning contract must search, report, or reconcile by matter status, jurisdiction, type, or close date rather than folder ID. | Move to Business Plus before deploying metadata resources. [Metadata plans](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/using-metadata.md) |
| Metadata cascade at matter roots | Business Plus | No automatic propagation of matter identity to descendants; folder moves are harder to audit. `(log)` | A workflow, report, or migration needs every descendant to carry the matter ID. | Business Plus, then test cascade on a disposable tree because cascade is asynchronous and has no bulk undo. [Cascade behavior](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/cascading-metadata-in-folders) |
| Unlimited client collaborators | Business Plus | Each external collaborator on Business consumes a paid account; client sharing can raise license cost and invite seat churn. `(log)` | The first recurring client collaboration is opened, or expected external seats make Business Plus cheaper than paid Business collaborators. | Obtain a tenant-specific quote; Business Plus lists unlimited external collaborators. [Pricing](https://www.box.com/pricing) |
| Metadata-driven Relay and reusable custom workflow templates | Enterprise | Business Relay cannot trigger on metadata or use enterprise custom templates; provisioning must use API code or simpler file/folder triggers. `(log)` | Two or more workflows depend on metadata values, or workflow duplication becomes an audit or maintenance risk. | Enterprise. [Relay matrix](https://docs.box.com/en/box-relay/about-relay/relay-features-in-box-business-plans) |
| Native classifications and classification-based access policies | Enterprise, subject to SKU confirmation | `Confidential` is only a convention; Box cannot enforce a classification-based sharing or AI-access rule. `(log)` | A client, cyber insurer, or internal AI policy requires a technical control based on sensitivity. | Get a written Enterprise/Shield entitlement matrix before implementation. [Pricing](https://www.box.com/pricing) [Shield](https://www.box.com/shield) |
| Enforceable retention and disposition | Box Governance add-on on Business, Business Plus, or Enterprise; included in Enterprise Plus and Enterprise Advanced | Users can delete or purge content under ordinary trash settings; a `Closed` folder is not retention. `(log)` | Before the practice represents that a formal retention schedule is technically enforced, or before automatic disposition is enabled. | Compare a Governance add-on quote with Enterprise Plus. [Retention plans](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies) |
| Legal holds | Box Governance | No native custodian, folder, file, and version preservation control for a dispute or investigation. `(log)` | A litigation hold, subpoena response, investigation, or client outside-counsel guideline requires preservation. | Buy Governance immediately; do not approximate a hold with permissions or copied folders. [Legal holds](https://docs.box.com/en/box-governance/legal-holds/about-legal-hold-policies.md) |
| More version history | Enterprise gives 100; Enterprise Plus, Enterprise Advanced, or Governance give unlimited | The observed tenant limit is 25, although current Business documentation says 50; older edits can age out. `(provided; log)` | A version audit confirms files are approaching the tenant limit, or a client/policy requires history beyond it. | First resolve the 25-versus-50 entitlement mismatch; then choose Enterprise or Governance based on the actual preservation duty. [Version history](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History) |
| Box Sign signer attachments and recipient groups | Enterprise | Engagement letters still work, but the signer cannot use the Enterprise attachment field and requests cannot target recipient groups. `(log)` | An intake or engagement workflow requires supporting files from the signer inside the signature transaction, or repeat group routing. | Enterprise. [Sign matrix](https://docs.box.com/en/box-sign/box-sign-for-admins/box-sign-features-in-box-individual-and-business-plans) |
| Box Sign batch send, ready-sign links, Box-login verification, or conditional fields | Enterprise Plus | Business must send ordinary requests individually and cannot use these advanced controls. `(log)` | Repeated high-volume engagement campaigns, public ready-sign intake, Box-account authentication, or conditional agreement logic becomes a real workflow. | Enterprise Plus, after confirming that the workflow justifies Governance-inclusive pricing. [Sign matrix](https://docs.box.com/en/box-sign/box-sign-for-admins/box-sign-features-in-box-individual-and-business-plans) |
| Forms-to-Doc-Gen-to-Sign end-to-end Relay | Enterprise Advanced | Business can use Sign events and actions but cannot run the captured Enterprise Advanced Forms, Doc Gen, and signature-outcome chain. `(log)` | The practice approves an automated intake-to-generated-engagement process with enough volume to replace the current controlled template flow. | Enterprise Advanced only after a measured pilot. [Relay matrix](https://docs.box.com/en/box-relay/about-relay/relay-features-in-box-business-plans) |

## Recommended starter taxonomy sketch

This is the desired-state sketch for the known-client go-live. Codes are
examples only; provisioning assigns the real IDs. `(provided; log)`

```text
01 Clients/
  C0001 - Client Short Name/
    M2026-0001 - US Patent - Short Description/
      00 Engagement and Administration/
      01 Intake and Invention Disclosure/
      02 Prior Art and Search/
      03 Drafting/
      04 Filing and Formalities/
      05 USPTO Correspondence/
        01 Incoming/
        02 Outgoing/
      06 Prosecution/
      07 Issuance and Post-Grant/
      08 Foreign and PCT/
      09 Billing Records/
      90 Client Exchange/
        01 From Client/
        02 To Client/
        03 For Signature/
        04 Invoices/
      99 Closed Matter Records/

02 Firm Administration/
  01 Templates/
    01 Engagement Letters/
    02 Fee Agreements/
    03 Matter Folder Manifests/
  02 Policies and Procedures/
  03 Vendor and Subscription Records/

90 Provisioning Control/
  01 Desired-State Manifests/
  02 Plans and Receipts/
  03 Exception Reports/
```

`(log)` The skeleton follows the client/matter/document-type pattern recommended
for small cloud-drive practices and the matter/workspace model used by legal
DMS products. It stays shallow to reduce Box Drive path failures.
[NCBA](https://www.ncbar.org/2022/04/05/diy-file-naming-conventions-and-folder-structure/)
[iManage](https://registration.imanage.com/pages/organizing-your-files-in-imanage-work)
[Windows Box Drive limits](https://support.box.com/hc/en-us/articles/48792836793875-Windows-Specific-Limitations-for-the-New-Box-Drive)

Provisioning rules:

1. Create and reconcile only known starter clients at go-live; backfill later
   through an API-backed migration lane, not Box Drive. `(provided; log)`
   [Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)
2. Record Box folder IDs in the desired-state receipt. Names are display data
   and may change; IDs are reconciliation keys. `(provided)`
3. Do not create metadata or retention resources on Business. Emit explicit
   `blocked-by-entitlement` plan entries for them. `(provided; log)`
   [metadata](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/using-metadata.md)
   [retention](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies)
4. Invite clients only to `90 Client Exchange`, never the client or matter
   root. Default to Viewer and elevate only for a documented need. `(log)`
   [folder permissions](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-folder-permissions.md)
5. Keep `09 Billing Records` internal. Copy issued PDFs intended for delivery
   into `90 Client Exchange/04 Invoices`; FreshBooks remains authoritative.
   `(provided; log)`
   [FreshBooks invoices](https://support.freshbooks.com/hc/en-us/articles/4404632032013-How-do-I-manage-my-invoices)
6. Create only the subfolders applicable to the matter type. A PCT-only,
   trademark, opinion, licensing, or general-advice matter should have its own
   versioned skeleton rather than a pile of empty patent-prosecution folders.
   `(log)`
   [NetDocuments](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)

## Open questions

1. **What is the tenant's real version entitlement?** The observed limit is 25,
   while current Box documentation says Business receives 50 prior versions.
   Resolve this with the account contract or Box support before setting a
   preservation expectation. `(provided; log)`
   [version history](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History)
2. **What does Box quote for two or three effective seats?** Public plans have a
   three-user minimum, while the supplied practice context says two seats.
   Obtain prices for Business Plus, Enterprise, Governance, and any required
   Shield SKU. `(provided; log)` [pricing](https://www.box.com/pricing)
3. **Which external-collaboration roles and defaults are currently enabled?**
   Verify Viewer as the default, whether Editors can invite, shared-link
   audience defaults, password and expiry settings, and external-user MFA
   requirements before creating client folders. `(log)`
   [roles](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-collaborator-permission-levels)
   [shared links](https://docs.box.com/en/box-fundamentals/for-users/collaborating/using-shared-links/securing-shared-links.md)
4. **What is the approved records schedule?** Define the retention event,
   period, exceptions, closed-matter handling, and disposition approval for
   each matter class before buying Governance or creating policies. `(log)`
   [retention](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies)
5. **Should the signing log be stored beside every executed agreement?** Box
   exposes it, but the practice must decide whether the PDF log is mandatory
   matter content and for how long. `(log)`
   [signing log](https://docs.box.com/en/box-sign/sign-document-management/viewing-the-signing-log.md)
6. **How will M365 messages be filed when message capture becomes necessary?**
   Folder upload email is attachment-only and unsuitable for automation. Test
   the already-enabled Box for Microsoft 365 integration and define whether a
   filed `.msg` or `.eml`, a PDF rendering, or mailbox-only retention is the
   record. `(provided; log)`
   [email upload](https://docs.box.com/en/box-fundamentals/for-users/uploads-and-downloads/uploading-and-downloading-files-and-folders-to-box/upload-to-box-through-email)
7. **Which enabled AI integrations may read which Box folders?** Claude,
   ChatGPT, and Copilot Studio are enabled at the Box root. Confirm their
   scopes, admin controls, client-consent implications, and whether a future
   classification policy must restrict them before using them on matter
   content. `(provided; log)` [Box Shield](https://www.box.com/shield)
8. **NOT COVERED — needs follow-up:** obtain direct, claim-specific X evidence
   from solo or small-firm attorneys using Box as their primary DMS. The
   salvaged X search did not find it. `(log)`
9. **NOT COVERED — needs follow-up:** test Box search, Box Drive path behavior,
   offline storage, Office co-authoring, client invitation, Box Sign, and Relay
   with a synthetic patent matter before go-live. Vendor documentation does
   not substitute for this tenant-specific acceptance test. `(log)`
   [Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)

## Sources

### Box product and plan sources

- `(log)` [Box plans and pricing](https://www.box.com/pricing)
- `(log)` [Box for law firms](https://www.box.com/industries/law-firms)
- `(log)` [Box metadata overview](https://developer.box.com/guides/metadata/)
- `(log)` [Using metadata](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/using-metadata.md)
- `(log)` [Cascading metadata in folders](https://docs.box.com/en/box-fundamentals/for-users/staying-organized/organizing-and-tracking-content/cascading-metadata-in-folders)
- `(log)` [Retention policies](https://docs.box.com/en/box-governance/retention/about-retention-and-retention-policies)
- `(log)` [Legal holds](https://docs.box.com/en/box-governance/legal-holds/about-legal-hold-policies.md)
- `(log)` [Classification labels](https://docs.box.com/en/box-shield/shield-classification-labels-and-policies/classification-labels)
- `(log)` [Box Shield](https://www.box.com/shield)
- `(log)` [Collaboration roles](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-collaborator-permission-levels)
- `(log)` [Folder permissions](https://docs.box.com/en/box-fundamentals/for-users/collaborating/collaborating-by-inviting-others/understanding-folder-permissions.md)
- `(log)` [External-user practices](https://docs.box.com/en/box-admin-tools/managing-box-users-and-admins/external-users/best-practice-managing-external-users.md)
- `(log)` [Securing shared links](https://docs.box.com/en/box-fundamentals/for-users/collaborating/using-shared-links/securing-shared-links.md)
- `(log)` [File Request](https://docs.box.com/en/box-fundamentals/for-users/collaborating/sharing-content-using-box/introducing-box-file-request.md)
- `(log)` [Relay plan matrix](https://docs.box.com/en/box-relay/about-relay/relay-features-in-box-business-plans)
- `(log)` [Upload to Box through email](https://docs.box.com/en/box-fundamentals/for-users/uploads-and-downloads/uploading-and-downloading-files-and-folders-to-box/upload-to-box-through-email)
- `(log)` [Box Sign plan matrix](https://docs.box.com/en/box-sign/box-sign-for-admins/box-sign-features-in-box-individual-and-business-plans)
- `(log)` [Box Sign sender storage and permissions](https://docs.box.com/en/box-sign/file-storage-and-permissions/understanding-the-senders-file-storage-and-permissions.md)
- `(log)` [Box Sign signing log](https://docs.box.com/en/box-sign/sign-document-management/viewing-the-signing-log.md)
- `(log)` [Box Drive FAQ](https://support.box.com/hc/en-us/articles/29475996910867-Box-Drive-Frequently-Asked-Questions)
- `(log)` [Box Drive offline access](https://docs.box.com/en/box-drive/getting-started-with-box-drive/making-content-available-offline)
- `(log)` [Windows-specific Box Drive limits](https://support.box.com/hc/en-us/articles/48792836793875-Windows-Specific-Limitations-for-the-New-Box-Drive)
- `(log)` [Box version history](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History)

### Legal DMS and taxonomy sources

- `(log)` [NetDocuments: How to develop a legal DMS](https://www.netdocuments.com/blog/how-to-develop-document-management-system/)
- `(log)` [iManage: Organizing files in matters and workspaces](https://registration.imanage.com/pages/organizing-your-files-in-imanage-work)
- `(log)` [North Carolina Bar Association: DIY file naming and folder structure](https://www.ncbar.org/2022/04/05/diy-file-naming-conventions-and-folder-structure/)
- `(log)` [Bill4Time: File-tree and naming examples](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/)
- `(log)` [UTBMS IP patent-prosecution codes](https://utbms.com/ip-patent-prosecution-codes/)

### Practitioner and operational sources

- `(log)` [Lawyertalk: Box matter-folder workflow](https://www.reddit.com/r/Lawyertalk/comments/1phg1u7/whats_your_dropbox_workflow_for_case_files_mine/)
- `(log)` [Lawyertalk: Box as a contract repository](https://www.reddit.com/r/Lawyertalk/comments/1me9s2u/inhouse_attorneys_whats_your_favorite_contract/)
- `(log)` [Lawyertalk: Clio and Box](https://www.reddit.com/r/Lawyertalk/comments/186dmpi)
- `(log)` [LawFirm: Small-firm DMS alternatives](https://www.reddit.com/r/LawFirm/comments/1crmf2r/what_do_small_law_firms_use_for_document/)
- `(log)` [Box community: External collaborators and storage](https://support.box.com/hc/en-us/community/posts/4411192390547-External-Collaborators-and-storage-space)
- `(log)` [FreshBooks: Managing invoices](https://support.freshbooks.com/hc/en-us/articles/4404632032013-How-do-I-manage-my-invoices)
- `(log)` [FreshBooks: Client accounts](https://support.freshbooks.com/hc/en-us/articles/115011425548-How-do-client-accounts-work)
