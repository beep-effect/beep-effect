# SKU preflight and practice-process walkthrough outline

Research date: 2026-08-30

## Executive summary

Do not make a PST import, archive, retention, or eDiscovery configuration decision from the description "Office Microsoft 365 Pro." Microsoft does not sell a commercial subscription by that name. A Global Administrator must first record the exact product names under **Billing > Your products**, then record the product licenses and enabled service plans assigned to the attorney under **Users > Active users > Licenses and apps**. A tenant may own several products while the attorney is assigned only one of them.

The minimum license depends on the actual job:

- A normal Exchange mailbox, a 50 GB archive, mailbox-wide retention, Content Search, and an unlicensed shared mailbox up to 50 GB can be available with Exchange Online Plan 1 and the Exchange-bearing Business plans. Microsoft 365 Apps for business has no Exchange mailbox.
- A 1.5 TB auto-expanding archive is included with Exchange Online Plan 2, Office 365 E3/E5, Microsoft 365 E3/E5, and Microsoft 365 Business Premium. Business Basic, Business Standard, Office 365 E1, and Exchange Online Plan 1 need Exchange Online Archiving or a qualifying upgrade.
- Microsoft's bulk **PST Import Service** is a separate gate. The current Microsoft Purview service description grants it to Exchange Online Plan 2, Office 365 E3/E5, Microsoft 365 E3/E5, and qualifying Purview add-ons. It does **not** list Business Premium by itself.
- Basic Content Search is much more widely available than eDiscovery Premium. Microsoft reserves eDiscovery Premium for E5 or a qualifying Purview add-on. Current Microsoft Learn pages for the redesigned eDiscovery experience also say that administrators and users working in eDiscovery cases need Microsoft 365 Enterprise E3 or E5. Treat a visible Purview menu as no proof of a license right.
- Business Premium is the most natural small-firm baseline when endpoint security, desktop Office, retention labels, and auto-expanding archive matter. If advanced eDiscovery is required, add Microsoft Purview Suite for Microsoft 365 Business Premium at the published US list price of $10 per user per month. If only a one-time bulk PST import is required, compare the cost and operational effect of a qualifying short-term add-on or Exchange Online Plan 2 with a controlled Outlook import. Confirm the purchasable SKU and term with Microsoft or the tenant's reseller before ordering.

Box remains the document management system of record. Outlook is the communications workspace, FreshBooks is the billing ledger and delivery system, and Box Sign is the engagement-letter signature system. Walkthroughs should reinforce that division. A message or invoice that belongs to the client file must be filed in Box even if another system also retains a working copy.

This report is operational guidance, not a legal opinion. The attorney must set the firm's retention schedule and confirm applicable state-bar, USPTO, tax, privacy, and malpractice-carrier requirements before any automatic deletion policy is enabled.

## SKU identification steps

### Record what the tenant owns

1. Sign in to the [Microsoft 365 admin center](https://admin.microsoft.com/) with the Global Administrator account.
2. In Dashboard view, open **Billing > Your products**. In Simplified view, select **Subscriptions**. Microsoft documents this path in [What Microsoft business subscriptions do I have?](https://learn.microsoft.com/en-us/microsoft-365/admin/admin-overview/what-subscription-do-i-have?view=o365-worldwide).
3. If more than one billing account exists, select **Change billing account** and inspect each account.
4. Record each exact product name, subscription status, purchased seats, assigned seats, renewal or expiration date, billing frequency, and whether the product says "with Teams" or "no Teams." Open each product to capture its detail page. Do not normalize the name to "Pro."
5. Open **Billing > Licenses** and record the available and assigned count for every product. This catches add-ons that may not be obvious from the primary suite name.

### Record what the attorney actually receives

1. Open **Users > Active users**.
2. Select the attorney's account, then select **Licenses and apps**. Microsoft documents this exact path in [Assign or unassign licenses for users](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/assign-licenses-to-users?view=o365-worldwide).
3. Expand **Licenses** and record every checked product. Expand **Apps** or service plans under each product and record any disabled service, especially Exchange Online, Microsoft Purview, Microsoft Defender, and Microsoft 365 Apps.
4. Repeat for any licensed administrator that will run a Purview import or eDiscovery case. Administrative permission and user licensing are different requirements.
5. Record whether assignment is direct or group-based. If group-based, identify the licensing group so a later group change does not silently remove the entitlement.

### Verify the live Exchange state before making changes

1. In the Exchange admin center, open **Recipients > Mailboxes**, select the attorney, and record the primary mailbox quota and current usage.
2. Record whether an archive mailbox already exists, its usage, and whether auto-expanding archiving is enabled. Do not enable it during preflight. Microsoft warns in [Enable auto-expanding archiving](https://learn.microsoft.com/en-us/purview/enable-autoexpanding-archiving) that it cannot be turned off after it is enabled for an organization or mailbox.
3. List shared mailboxes, their current sizes, and any licenses assigned to them. An unlicensed shared mailbox is limited to 50 GB. A shared mailbox needs its own qualifying license for 100 GB, an archive, litigation hold, eDiscovery Premium, or advanced retention features.
4. In the Purview portal, confirm which solutions are visible, but use the recorded licenses and Microsoft's service descriptions to decide entitlement. Visibility is not the license test.
5. Save screenshots or a sanitized worksheet containing product names, counts, service-plan states, and quotas. Do not include message content, client names, or secret values.

### Preflight stop conditions

Stop before importing PSTs, enabling archives, creating retention/deletion policies, or opening eDiscovery cases if any of these remains unknown:

- the exact assigned user SKU and add-ons;
- whether Exchange Online is enabled for the attorney;
- the attorney's live primary and archive quotas;
- the number and size of PSTs and their target mailbox or archive;
- whether the proposed operation requires PST Import Service, Content Search, an eDiscovery case, legal hold, or eDiscovery Premium;
- the firm's approved retention schedule and whether any existing hold applies;
- whether a shared mailbox will receive a feature that requires it to be licensed.

## Gating matrix

Legend: **Yes** means the base SKU grants the stated right. **Limited** means a narrower form is available or a live-tenant check is required. **No** means the base SKU does not grant it. "CS" means Content Search; "Std" means the case, search, export, and hold functions associated with eDiscovery Standard; "Prem" means custodian, review-set, analytics, and advanced case functions.

The mailbox numbers below follow Microsoft's current [Exchange Online limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits) and [Purview licensing](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description) pages. Microsoft separately announced an additional 50 GB for Business mailboxes in its [2026 packaging update](https://www.microsoft.com/en-us/licensing/news/2026-m365-packaging-pricing-updates). Because the service-description table still says 50 GB while current commerce pages show 100 GB for some Business offers, the actual mailbox quota in the Exchange admin center is the controlling preflight fact for this tenant.

| Base SKU | PST Import Service | In-Place Archive | Auto-expanding archive | Retention policies and labels | Content Search / eDiscovery tier | Shared mailbox | Documented mailbox quotas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Microsoft 365 Business Basic | No | Yes, 50 GB | No; add Exchange Online Archiving or upgrade | Limited: Exchange mailbox-wide retention is licensed; Business Basic is not listed for creating/publishing general retention labels | CS: Yes. Prem: No. New eDiscovery case experience: verify, because current Learn guidance requires Enterprise E3/E5 users | Yes; user needs an Exchange license; shared mailbox needs no license through 50 GB | User 50 GB in Learn, with +50 GB rollout announced; archive 50 GB; unlicensed shared 50 GB |
| Microsoft 365 Business Standard | No | Yes, 50 GB | No; add Exchange Online Archiving or upgrade | Same as Business Basic | CS: Yes. Prem: No. New eDiscovery case experience: verify | Yes, same conditions | User 50 GB in Learn, with +50 GB rollout announced; archive 50 GB; unlicensed shared 50 GB |
| Microsoft 365 Business Premium | No, not by itself | Yes, initial 100 GB archive allocation | Yes, up to 1.5 TB when enabled | Yes for static retention policies and creation/manual publication of labels; no E5-only auto-apply, event-based, disposition-review, or regulatory-record features | CS: Yes. Prem: No unless Purview Suite for Business Premium is added. New Standard case experience: verify | Yes; separately license a shared mailbox if advanced retention, hold, Premium eDiscovery, archive, or over 50 GB is needed | User 50 GB in Learn, with +50 GB rollout announced; archive up to 1.5 TB; unlicensed shared 50 GB |
| Microsoft 365 Apps for business | No | No Exchange mailbox | No | No Exchange retention right from this SKU | No Exchange CS/eDiscovery data source from this SKU | No access right because there is no Exchange license | No mailbox or archive |
| Office 365 E1 | No | Yes, 50 GB | No; add Exchange Online Archiving or upgrade | Yes for Exchange retention policies and basic/manual labels; no E5-only automatic or records-management features | CS: Yes. Prem: No. Current redesigned case licensing should be verified before relying on Std | Yes, same 50 GB unlicensed rule | User 50 GB; archive 50 GB; unlicensed shared 50 GB |
| Office 365 E3 | Yes | Yes, initial 100 GB archive allocation | Yes, up to 1.5 TB | Yes for static policies and basic/manual labels; no E5-only advanced label automation and records features | CS/Std: Yes. Prem: No | Yes; assign a qualifying license for advanced features or 100 GB | User 100 GB; archive up to 1.5 TB; unlicensed shared 50 GB, licensed shared up to 100 GB |
| Office 365 E5 | Yes | Yes | Yes, up to 1.5 TB | Yes, including E5 retention automation, event/disposition, records, and advanced label capabilities | CS/Std/Prem: Yes | Yes; license the shared mailbox for Premium or other advanced features | User 100 GB; archive up to 1.5 TB; unlicensed shared 50 GB, licensed shared up to 100 GB |
| Microsoft 365 E3 | Yes | Yes | Yes, up to 1.5 TB | Yes for static policies and basic/manual labels; no E5-only advanced label automation and records features | CS/Std: Yes. Prem: No | Yes; assign a qualifying license for advanced features or 100 GB | User 100 GB; archive up to 1.5 TB; unlicensed shared 50 GB, licensed shared up to 100 GB |
| Microsoft 365 E5 | Yes | Yes | Yes, up to 1.5 TB | Yes, including E5 retention automation, event/disposition, records, and advanced label capabilities | CS/Std/Prem: Yes | Yes; license the shared mailbox for Premium or other advanced features | User 100 GB; archive up to 1.5 TB; unlicensed shared 50 GB, licensed shared up to 100 GB |
| Exchange Online Plan 1 | No | Yes, 50 GB | No; add Exchange Online Archiving or move to Plan 2 | Limited to Exchange: mailbox retention and publication of basic labels to the Exchange mailbox are licensed; no cross-workload or E5 features | Exchange CS: Yes. Prem: No. Do not assume redesigned case rights | Yes, same 50 GB unlicensed rule | User 50 GB; archive 50 GB; unlicensed shared 50 GB |
| Exchange Online Plan 2 | Yes | Yes | Yes, up to 1.5 TB | Limited to Exchange: mailbox retention and basic Exchange labels; no E5-only advanced records features from Plan 2 alone | Exchange CS: Yes. Prem: No. Do not assume redesigned case rights | Yes; a Plan 2 license raises a shared mailbox to 100 GB and supports qualifying hold/archive use | User 100 GB; archive up to 1.5 TB; shared 50 GB unlicensed or 100 GB with Plan 2 |

### How to read the matrix for this initiative

- **If network-upload PST import is mandatory**, the base license must be Exchange Online Plan 2, Office 365 E3/E5, Microsoft 365 E3/E5, or a qualifying Purview add-on. The network-upload method itself has no data-volume charge and accepts commercial licensing agreements, but each benefiting user still needs the required license. Drive shipping has separate cost and agreement restrictions. See [Import organization PST files](https://learn.microsoft.com/en-us/purview/pst-import-overview).
- **If the goal is only to preserve old mail**, do not equate PST Import Service with Outlook's interactive Import/Export function. They are different workflows. Determine PST count, size, folder structure, duplicates, and target archive before selecting either.
- **If only mailbox-wide retention is needed**, Business Basic and Standard can have Exchange-location retention rights. If the walkthrough expects the attorney to choose matter-specific labels manually, Business Premium, Office 365 E1/E3/E5, Microsoft 365 E3/E5, or an appropriately licensed Exchange mailbox is the safer documented gate.
- **If legal hold and case management are needed**, test the exact tenant against the current eDiscovery portal after licensing. Microsoft's older feature descriptions place Content Search broadly and distinguish Standard from Premium; Microsoft's redesigned 2026 eDiscovery documentation says case users need Microsoft 365 Enterprise E3 or E5. Escalate that conflict to Microsoft licensing support rather than infer rights from a menu.
- **If eDiscovery Premium is needed**, choose E5 or a qualifying Purview Suite. Premium is not included in Business Premium, Office 365 E3, Microsoft 365 E3, or Exchange Online Plan 2 by themselves.

## Upgrade-path notes

Prices below are US commercial list prices per user per month, paid yearly, as published on 2026-08-30. Taxes, reseller discounts, promotions, regional prices, month-to-month premiums, existing-contract pricing, and overlapping-service-plan rules can change the result. Existing customers may retain earlier pricing until renewal. Confirm the checkout price and license compatibility before purchase.

| Starting SKU | Published base price | Needed gate | Decision-ready path | Published resulting price | Increment from starting SKU | Tradeoff or check |
| --- | ---: | --- | --- | ---: | ---: | --- |
| Business Basic | $7 | Desktop Office plus archive/labels | Move to Business Premium | $22 | +$15 | Adds desktop apps, security/management, basic labels, and auto-expanding archive. Still no PST Import Service or Premium eDiscovery by itself. |
| Business Standard | $14 | Auto-expanding archive, security, and basic labels | Move to Business Premium | $22 | +$8 | Natural small-firm upgrade. Still no PST Import Service or Premium eDiscovery by itself. |
| Business Premium | $22 | Premium eDiscovery and advanced retention/records | Add Purview Suite for Microsoft 365 Business Premium | $32 total | +$10 | Up to 300 seats. Microsoft advertises advanced eDiscovery and automated retention. Confirm that the commerce SKU grants the intended PST-import right before treating it as the import solution. |
| Business Basic | $7 | PST Import Service plus 100 GB mailbox/archive | Replace with Office 365 E3 | $26 | +$19 | Grants PST import and enterprise Exchange/compliance, but compare desktop-app, Teams, security, and device-management composition before switching. |
| Business Standard | $14 | PST Import Service plus enterprise mailbox/archive | Replace with Office 365 E3 | $26 | +$12 | Grants PST import. This is a suite change, not a pure compliance add-on. |
| Business Premium | $22 | PST Import Service without Premium eDiscovery | Replace with Office 365 E3 | $26 | +$4 | Cheap list-price delta, but loses Business Premium's SMB security and device-management bundle unless replaced elsewhere. Do not switch on price alone. |
| Any Business SKU | $7 / $14 / $22 | PST import plus Microsoft 365 enterprise identity/device controls | Move to Microsoft 365 E3 | $39 | +$32 / +$25 / +$17 | Broad enterprise baseline. Premium eDiscovery still needs an add-on or E5. |
| Business Premium | $22 | Full E5 suite, including Premium eDiscovery | Move to Microsoft 365 E5 | $60 | +$38 | Most complete and most expensive path. Usually excessive for one mailbox unless other E5 security, voice, analytics, or compliance features are required. |
| Exchange Online Plan 1 | $4 | PST import, 100 GB primary, auto-expanding archive | Move to Exchange Online Plan 2 | $8 | +$4 | Cleanest Exchange-only upgrade. No desktop Office and no Premium eDiscovery. |
| Business Basic, Business Standard, Office 365 E1, or Exchange Online Plan 1 | Varies | Auto-expanding archive only | Add Exchange Online Archiving | Quote required | Quote required | Microsoft documents eligibility and 1.5 TB auto-expansion, but its current US public pages do not expose a reliable list price. Obtain a tenant/reseller quote. Does not raise the primary mailbox to 100 GB. |
| Microsoft 365 Apps for business | $10 | Mail, calendar, contacts, and DMS-adjacent Office use | Replace with Business Standard or Premium | $14 or $22 | +$4 or +$12 | Apps for business alone cannot host the oip.law mailbox. Standard is the desktop-app/mail baseline; Premium adds security, labels, and auto-expanding archive. |

Current public list-price references are Microsoft's [Business plan comparison](https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-plans-and-pricing), [Office 365 enterprise comparison](https://www.microsoft.com/en-us/microsoft-365/enterprise/office-365-plans-and-pricing), [Microsoft 365 enterprise comparison](https://www.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plans-and-pricing), [Exchange Online comparison](https://www.microsoft.com/en-us/microsoft-365/exchange/exchange-online-business-plans-and-pricing), and [Purview Suite for Business Premium](https://www.microsoft.com/en-us/security/small-medium-business/microsoft-purview-suite-business-premium).

### Recommended decision sequence

1. Identify the exact owned and assigned licenses and the live mailbox quotas.
2. Inventory the PSTs without opening or importing them. Record count, size, source account, date range, and intended target.
3. Decide whether bulk network upload is genuinely required. For one modest PST, a controlled desktop Outlook import may avoid buying a higher tier, but it needs its own duplicate, folder, bandwidth, and validation plan.
4. Decide whether archive capacity is 50 GB or 1.5 TB, and whether the primary mailbox needs 100 GB.
5. Decide whether the legal requirement is simple Content Search, a hold/case workflow, or Premium eDiscovery. These are not synonyms.
6. Buy or change only the license that closes the recorded gate. Re-run the user-license and service-plan check after assignment and before configuration.

## Walkthrough content outline

The pages below should use fictional examples only. Each page should end with a short "done looks like" panel and a link to the next page. The walkthrough should never imply that a software workflow replaces the attorney's professional judgment.

### Page 1: New-client intake and conflicts clearance

**Norm.** Create a prospective-client record before accepting work. Collect only enough information to run a complete conflict search, identify the parties and matter, locate deadlines, and decide whether the firm can and will act. Do not create an active matter or begin substantive work until conflicts, scope, fee terms, and authority to proceed are resolved.

**Why it exists.** Missed conflicts threaten loyalty and confidentiality. A missed statutory, USPTO, court, or client deadline can create malpractice exposure before an engagement letter is signed. A written non-engagement record prevents later confusion about whether the firm accepted the matter. File-opening guidance from the [Law Society of Alberta](https://learningcentre.lawsociety.ab.ca/mod/page/view.php?id=397) and the [Louisiana State Bar Association checklist](https://www.lsba.org/documents/PracticeAidGuide2/S05Whole.pdf) both put conflict checks, identifying information, matter numbers, and engagement terms in the opening procedure.

**What the page teaches.**

1. Create a **Prospective** intake entry with the person's legal name, preferred contact details, referred-by source, opposing or related parties, inventors, assignees, affiliates, and a short non-confidential matter description.
2. Capture every known date immediately, label its source, and put it on the attorney's calendar with advance reminders. Mark unverified dates as unverified and obtain the source document.
3. Run and document the conflict search across clients, former clients, prospects, adverse parties, inventors, companies, and affiliates. Record the result and attorney decision.
4. Decide **accept**, **decline**, or **more information needed**. Send and retain a non-engagement letter for a decline when appropriate.
5. For an acceptance, confirm identity, scope, responsible attorney, billing terms, client communication preferences, and any required advance payment before opening the active matter.
6. Move to active status only after the engagement letter is signed and any required payment or waiver condition is satisfied. If emergency work begins earlier, document the attorney's explicit decision, scope, and deadline plan.

### Page 2: Client and matter numbering

**Norm.** Give each client one stable client number and each distinct engagement a separate matter number. Numbers are identifiers, not descriptions. Do not encode confidential subject matter, mutable names, or too much business meaning into the identifier.

**Why it exists.** Stable numbers keep Box, Outlook filing, calendars, FreshBooks, and reports aligned even when a company changes its name or a contact changes. Separate matter numbers keep conflict, scope, billing, retention, and deadline histories from bleeding into one another.

**What the page teaches.**

1. Assign the next sequential client ID, for example `C000123`. Never reuse a retired number.
2. Assign a matter sequence under that client, for example `C000123-M001`. Open a new matter for a new engagement, even for the same client.
3. Add a short human-readable matter name outside the identifier, for example `US utility application - fictional device`.
4. Use the exact same client and matter IDs in the Box folder name, FreshBooks project or invoice reference, calendar category, and email-filing subject tag.
5. Maintain one controlled matter register with status, responsible attorney, open date, close date, and destruction-review date. Do not maintain competing number lists.

### Page 3: Open the matter and create the day-one Box file

**Norm.** Box is the DMS of record. Create the complete matter skeleton from a controlled template on day one, then place every received source document, engagement record, deadline source, and work product in the proper folder. Box Drive is a synchronized view of Box, not a second storage location.

**Why it exists.** A predictable file lets the attorney reconstruct what arrived, what advice was given, what was filed, and what deadline source controlled. It also limits accidental disclosure by keeping collaboration at the correct matter folder rather than in personal desktop, Downloads, or email-only copies. ABA Model Rule 1.6's comment requires reasonable safeguards against unauthorized access and disclosure; see [Rule 1.6, Comment 18](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/).

**What the page teaches.**

1. Copy the approved matter-folder template and rename the root `<matter-id> - <short matter name>`.
2. Create or confirm these top-level folders: `00 Administration and engagement`, `01 Client source documents`, `02 Correspondence`, `03 Prior art and research`, `04 Drafts and work product`, `05 Filed and official records`, `06 Billing`, and `90 Closing`. Add a matter-type folder only when the work requires it.
3. Save the signed engagement package, conflict-clearance record, intake summary, and deadline-source documents. Restrict the conflict record if it contains information not appropriate for the ordinary matter file.
4. Put every known deadline in the calendar from the source document. Save the source in `05 Filed and official records` and record the calendar entry's matter ID and source path.
5. Check Box collaborators and inherited permissions. Remove anyone who does not need access. Do not create open shared links for client-confidential material.
6. Confirm in Box web that the folders and first documents synchronized. Do not rely only on the green status icon in Box Drive.

### Page 4: File email and attachments

**Norm.** Outlook is for sending, receiving, calendaring, and short-term mailbox access. Box holds the complete matter record. File substantive client, opposing-party, vendor, USPTO, and court communications, plus the attachments on which the firm relied, into the matter's Box `02 Correspondence` or substantive folder. Leave transitory scheduling notes, newsletters, spam, and exact duplicates in Outlook unless they affect the representation.

**Why it exists.** An inbox is organized by person and time, not by the complete matter. Relying on Outlook alone makes the file hard to transfer, review, close, or produce and separates attachments from the advice or instructions that gave them meaning. Filing everything indiscriminately creates a different risk: important records disappear into duplicate noise.

**What the page teaches.**

1. Ask whether the message records instructions, advice, consent, a decision, a deadline, a filing, evidence, a promise, a conflict issue, or a material status update. If yes, file it.
2. Save the message in a format that preserves sender, recipients, date, subject, body, and attachments. Use `<YYYY-MM-DD> - Email - <from or to> - <short subject>` and the matter ID where the tool does not already supply it.
3. Save relied-on attachments in the proper substantive folder. Keep the original attachment unchanged; create a working copy only when editing is required.
4. If one message covers two matters, file a copy or reference in each matter. Do not make a reviewer infer the second matter from the inbox.
5. Complete filing at the end of the work session or by a defined daily cutoff. Use an Outlook category or filing folder only as a temporary queue, not as the permanent matter file.
6. Keep Outlook retention and deletion settings consistent with the firm's approved policy. Do not enable automatic deletion merely because a copy should exist in Box.

### Page 5: Draft and version documents in Box

**Norm.** Keep one canonical working file in Box and let Box create versions when the file is edited through Box Drive, Box Edit, or Microsoft integration. Use a new filename for a genuinely different document, branch, filed copy, or client-facing milestone, not for every edit.

**Why it exists.** Files named `final`, `final2`, and `really-final` hide which text controlled and invite the wrong document to be filed or sent. Box keeps prior versions when a file with the same name is edited or uploaded as a new version, but the number retained depends on the Box plan and admin settings. See [Accessing Version History](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History).

**What the page teaches.**

1. Create the draft in the matter's `04 Drafts and work product` folder with `<YYYY-MM-DD> - <document type> - <short description>`.
2. Open and save that same file through Box Drive or the approved Box/Microsoft editor. Do not download, rename, and upload parallel copies for routine edits.
3. Before a major change, verify that Box shows the latest version. Add a Box version comment if the interface supports it and the change needs explanation.
4. Use **Upload New Version** when another person returns a revised file that should continue the same document history. Confirm the filename and preview before replacing the current version.
5. Create a separate, locked milestone file for `Client review`, `Approved for filing`, `Filed`, or `Executed`. Put filed or executed copies in `05 Filed and official records`; never overwrite them with a later draft.
6. Use Box's version history to inspect or restore an earlier version. Do not assume history is unlimited; record the firm's Box plan and configured version limit.

### Page 6: Send and complete an engagement letter with Box Sign

**Norm.** Send the approved engagement letter from the matter's Box folder, require the correct signer or signers, save the completed document and signing log back to the matter, and do not mark the matter engaged until the defined conditions are met.

**Why it exists.** The signed letter proves who the client is, what the firm agreed to do, fee terms, communication expectations, and exclusions from scope. Correct recipient authentication and a retained signing record reduce disputes about authority and execution. Box Sign supports signer roles, signing order, authentication, reminders, expiration, and a selected Box save location; see [Sending a document for signature](https://support.box.com/hc/en-us/articles/4404105810195-Sending-a-document-for-signature).

**What the page teaches.**

1. Finalize the approved engagement letter in `00 Administration and engagement`. Confirm the client legal name, matter ID, scope, exclusions, fees, retention notice, and all required signers.
2. Choose **Sign > Request Signature** from the Box file. Select the matter's engagement folder as the completed-request save location.
3. Add each recipient, assign `Signer`, `Approver`, or `Get a Copy`, set signing order, and add signature, printed name, title, and date fields. Use the approved authentication method for the sensitivity and risk.
4. Set an expiration and reminders. Review recipient email addresses character by character before sending.
5. Track the request in Box Sign. Do not start work merely because the request was sent. Follow the firm's rule for signed status and any required payment.
6. When complete, verify the signed PDF and signing log in Box, rename them with the execution date, and update the matter register to **Engaged**. If declined or expired, preserve the status and decide whether to resend or close as non-engaged.

### Page 7: Deliver and file an invoice from FreshBooks

**Norm.** FreshBooks creates, sends, and tracks the invoice. The client receives the invoice through FreshBooks with a PDF copy when appropriate. The final PDF is also filed in the matter's Box `06 Billing` folder. Box is the matter-file copy, not the accounts-receivable ledger.

**Why it exists.** One billing system prevents conflicting invoice numbers, balances, and payment status. A filed PDF shows what the client received at that point in time, while FreshBooks retains delivery and payment state. FreshBooks can attach a PDF when sending and can download an invoice as PDF; see [Create an invoice](https://support.freshbooks.com/hc/en-us/articles/216631328-How-do-I-create-an-invoice) and [Manage invoices](https://support.freshbooks.com/hc/en-us/articles/4404632032013-How-do-I-manage-my-invoices).

**What the page teaches.**

1. In FreshBooks, select the correct client and matter or project reference. Verify time, expenses, rates, trust or retainer treatment, tax, invoice date, and payment terms.
2. Review the draft against the engagement terms. Generate the final invoice number only in FreshBooks.
3. Select **Send to**, verify recipients, add the approved message, and select **Attach a PDF copy of this invoice** when the firm's policy calls for it. Send from FreshBooks.
4. Download the sent invoice PDF and save it in `06 Billing` as `<YYYY-MM-DD> - Invoice <number> - <matter-id>.pdf`. Do not edit the PDF after filing.
5. Record payment, credit, write-off, or refund only in FreshBooks. If a corrected invoice is required, issue it through FreshBooks and file the corrected PDF without overwriting the original sent invoice.

### Page 8: Close, retain, and archive a matter

**Norm.** Close a matter through a checklist, not by dragging its folder into an archive. Confirm the work is complete, report the outcome, clear future deadlines and financial items, return client property, freeze the final record, assign a retention/destruction-review date, and restrict the closed file.

**Why it exists.** Poor closing can leave a live deadline, unpaid balance, client original, or promised action hidden in an apparently finished file. A closing letter fixes the end of scope and tells the client about remaining obligations and file handling. The [Law Society's managing and closing guidance](https://www.lawsociety.org.uk/topics/business-management/managing-and-closing-files) identifies missed dates, unreturned assets, unpaid bills, and failure to tell the client as file-management risks.

**What the page teaches.**

1. Review the matter against scope. Confirm every filing, response, reporting duty, undertaking, and docket item is complete. Record any future client-controlled maintenance or renewal date in the closing letter and appropriate calendar.
2. Send the final report and closing letter. Return originals or client property, document delivery and receipt, and state the firm's retention and destruction policy.
3. Issue the final FreshBooks invoice, resolve trust or retainer balances under the firm's accounting rules, and record remaining accounts receivable. Do not let a folder move erase a receivable.
4. Clean the Box file: file final correspondence and official documents, remove exact convenience duplicates where policy permits, confirm canonical versions, and preserve signed, filed, and billing records.
5. Update the matter register with closed date, outcome, retention category, destruction-review date, location, and any **do not destroy** or hold flag. Retention must be matter-type and jurisdiction aware; never use a universal destruction period without attorney approval.
6. Move the folder to the controlled closed-matters area, make it read-only for ordinary users where feasible, remove unnecessary collaborators and shared links, and verify the archived folder in Box web. Do not delete Outlook or Microsoft 365 content until the approved retention and hold analysis permits it.

## Open questions

### Licensing and migration

1. What exact products appear under **Billing > Your products**, and which products and service plans are assigned to the attorney and any administrator who will perform import or eDiscovery work?
2. Has the tenant received Microsoft's 2026 additional 50 GB Business mailbox rollout? What primary quota does Exchange show today?
3. Does an archive mailbox already exist? Is auto-expanding archiving already enabled at either mailbox or organization level?
4. How many PSTs exist, how large are they, which mailboxes produced them, and should their contents enter the primary mailbox, online archive, or remain as preserved source evidence?
5. Is Microsoft's network-upload PST Import Service a hard requirement, or is a supervised Outlook import acceptable for a small one-time migration?
6. Is the required investigation function Content Search, preservation/hold in an eDiscovery case, or eDiscovery Premium review and analytics?
7. Are any shared mailboxes expected to exceed 50 GB or receive archive, hold, advanced retention, or Premium eDiscovery features?
8. Is the subscription direct from Microsoft, through a CSP/reseller, nonprofit, government, or another channel that changes available SKUs and prices?

### Practice policy

1. Which US jurisdiction's ethics rules govern the practice, and what do the malpractice carrier and state bar require for file retention, closing letters, calendar redundancy, cloud vendors, and client consent?
2. What patent-specific matter types and deadline chains will the firm support: provisional, utility, design, PCT, national phase, prosecution, opinions, assignments, maintenance fees, or portfolio counseling?
3. What numbering convention already exists in FreshBooks, Box, paper files, or prior counsel records, and must old identifiers be preserved?
4. Which folder template and document-naming syntax will the attorney actually use? The proposed template should be tested on three fictional matter types before adoption.
5. Which emails count as substantive for this practice, and what approved method will preserve message metadata and attachments in Box?
6. What Box plan, version-history limit, retention setting, legal-hold capability, and Box Sign authentication options does the firm own?
7. What event changes a prospect to an active client: attorney approval, signed engagement letter, cleared funds, or a documented emergency exception?
8. Who performs the daily deadline review and the independent backup check in a solo practice when the attorney is unavailable?
9. What is the approved matter-type retention schedule, and who may authorize destruction after the review date?

## Sources

### Microsoft licensing and administration

- Microsoft Learn, [What Microsoft business subscriptions do I have?](https://learn.microsoft.com/en-us/microsoft-365/admin/admin-overview/what-subscription-do-i-have?view=o365-worldwide)
- Microsoft Learn, [Assign or unassign licenses for users](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/assign-licenses-to-users?view=o365-worldwide)
- Microsoft Learn, [Understand subscriptions and licenses in Microsoft 365 for business](https://learn.microsoft.com/en-us/microsoft-365/commerce/licenses/subscriptions-and-licenses?view=o365-worldwide)
- Microsoft Learn, [Microsoft Purview service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-365-service-descriptions/microsoft-365-tenantlevel-services-licensing-guidance/microsoft-purview-service-description)
- Microsoft Learn, [Exchange Online limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits)
- Microsoft Learn, [Exchange Online service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-service-description)
- Microsoft Learn, [Exchange Online Archiving service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-archiving-service-description/exchange-online-archiving-service-description)
- Microsoft Learn, [Enable auto-expanding archiving](https://learn.microsoft.com/en-us/purview/enable-autoexpanding-archiving)
- Microsoft Learn, [Import organization PST files](https://learn.microsoft.com/en-us/purview/pst-import-overview)
- Microsoft Learn, [Learn about retention policies and retention labels](https://learn.microsoft.com/en-us/purview/retention)
- Microsoft Learn, [Microsoft Purview eDiscovery legacy solutions](https://learn.microsoft.com/en-us/purview/ediscovery)
- Microsoft Learn, [Get started with eDiscovery](https://learn.microsoft.com/en-us/purview/edisc-get-started)
- Microsoft Learn, [Microsoft 365 and Office 365 platform service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/office-365-platform-service-description/office-365-platform-service-description)
- Microsoft, [2026 Microsoft 365 pricing and packaging update](https://www.microsoft.com/en-us/licensing/news/2026-m365-packaging-pricing-updates)
- Microsoft, [Business plans and pricing](https://www.microsoft.com/en-us/microsoft-365/business/microsoft-365-plans-and-pricing)
- Microsoft, [Office 365 enterprise plans and pricing](https://www.microsoft.com/en-us/microsoft-365/enterprise/office-365-plans-and-pricing)
- Microsoft, [Microsoft 365 enterprise plans and pricing](https://www.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plans-and-pricing)
- Microsoft, [Exchange Online plans and pricing](https://www.microsoft.com/en-us/microsoft-365/exchange/exchange-online-business-plans-and-pricing)
- Microsoft, [Purview Suite for Microsoft 365 Business Premium](https://www.microsoft.com/en-us/security/small-medium-business/microsoft-purview-suite-business-premium)

### Practice process and product operation

- American Bar Association, [Model Rule 1.6, confidentiality comment](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/comment_on_rule_1_6/)
- Law Society of Alberta, [Develop a file opening procedure and checklist](https://learningcentre.lawsociety.ab.ca/mod/page/view.php?id=397)
- Louisiana State Bar Association, [Practice Aid Guide: checklist for opening files](https://www.lsba.org/documents/PracticeAidGuide2/S05Whole.pdf)
- Law Society of Ontario, [File Management Guideline](https://www.lso.ca/lawyers/practice-supports-and-resources/practice-management-guidelines/file-management)
- The Law Society, [Managing and closing files](https://www.lawsociety.org.uk/topics/business-management/managing-and-closing-files)
- Box Support, [Accessing Version History](https://support.box.com/hc/en-us/articles/360043697054-Accessing-Version-History)
- Box Support, [Sending a Document for Signature](https://support.box.com/hc/en-us/articles/4404105810195-Sending-a-document-for-signature)
- FreshBooks Support, [How do I create an invoice?](https://support.freshbooks.com/hc/en-us/articles/216631328-How-do-I-create-an-invoice)
- FreshBooks Support, [How do I manage my invoices?](https://support.freshbooks.com/hc/en-us/articles/4404632032013-How-do-I-manage-my-invoices)
