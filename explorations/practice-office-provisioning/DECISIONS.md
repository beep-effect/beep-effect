# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

<!--
Pre-seeded align artifact: these entries were ratified in the 2026-08-30
/grill-with-docs session that opened this packet. Artifact presence is never
stage state; the packet enters at research with these decisions standing.
-->

## 2026-08-30 — packet routing

**Question:** Which packet owns the M365-upload + Box-DMS provisioning scope —
an amendment to a corpus packet, the M365 exploration, or something new?

**Answer:** A new exploration packet (this one), downstream of
`goals/oppold-corpus-salvage-restoration` (G1) and the gated
`oppold-corpus-pipeline-v2` re-entry for population only.

**Rationale:** `m365-document-ingest` (M365 exploration MAP) is the opposite
direction (ingest into beep); the overhaul re-entries are corpus-internal;
egress/provisioning had no owner. Rejected: amending the overhaul MAP (injects
practice-ops scope into a graduated corpus packet), reopening
`microsoft-365-integration` (wrong owner for Box + practice process), and
skipping straight to goals (research still open — premature per graduation
doctrine).

## 2026-08-30 — mail search modality

**Question:** What does "upload dad's historical emails to M365 so he can
search them" mean mechanically, given Graph cannot bulk-import PSTs?

**Answer:** Both lanes — raw PSTs into an Exchange archive mailbox via the
Purview/Exchange PST Import Service (Outlook-native search), plus curated
per-client/matter message and document artifacts into the DMS.

**Rationale:** Outlook search is the UX Tom expects; curated artifacts are
what the matter-centric filing system needs. Rejected: import-only (loses the
DMS filing) and files-only (Tom would search email outside Outlook).

## 2026-08-30 — document system of record

**Question:** Documents were headed to two stores (M365 "searchable" +
Box DMS). Which is the system of record?

**Answer:** Box owns documents (client/matter taxonomy, versioning,
retention). M365 owns mail, contacts, calendar. No document duplication into
SharePoint.

**Rationale:** Split-brain versioning risk outweighs one-search-box
convenience. SharePoint-as-DMS (single vendor) was offered as pushback and
rejected: Box is the stated intent and Box-for-legal is a researchable
industry pattern.

## 2026-08-30 — M365 tenant authority

**Question:** What admin authority and SKU does the oip.law tenant have?

**Answer:** Global admin is available; the SKU is unknown — a licensing
preflight is a first-class step before any irreversible tenant config.

**Rationale:** Purview import, retention, and search/Copilot gates are
SKU-dependent; guessing the SKU would poison the research.

## 2026-08-30 — auth lanes for egress

**Question:** Delegated PKCE (the existing `@beep/m365` lane) or app-only
client credentials for the bulk egress?

**Answer:** Both, split by job — app-only application permissions for bulk
backfill runners; delegated write scopes for interactive verbs. The driver
grows a second token provider.

**Rationale:** Bulk jobs should not ride one human token's lifetime and
throttling; interactive future verbs (e.g. docketing calendar push) need
delegated anyway. Rejected: single-lane variants of either kind.

## 2026-08-30 — Box tenant reality

**Question:** Does a Box tenant exist, and which plan?

**Answer:** Yes — Business plan (25 versions/file).

**Rationale:** Version depth and governance features are plan-gated. Research
must flag every place legal-DMS practice assumes Business Plus/Enterprise
features and surface the upgrade as an explicit decision, never an assumption.

## 2026-08-30 — sequencing vs the corpus chain

**Question:** Does provisioning wait for the corpus pipeline so taxonomy
derives from extracted entities in one shot?

**Answer:** Live-first — provision Box DMS + M365 process with known
clients/matters so Tom uses it for new work now; historical population lands
after salvage-restoration G1 and pipeline-v2 outputs.

**Rationale:** Structure needs no corpus; population does. The daily practice
workflow should not be hostage to a multi-week restoration chain. Rejected:
backfill-gated (weeks of ad-hoc process) and unmanaged parallelism (taxonomy
churn risk noted; mitigated by starter-set taxonomy + explicit reconcile step
at backfill time).

## 2026-08-30 — walkthrough deployment target

**Question:** Where do the HTML walkthrough artifacts for Tom deploy?

**Answer:** Claude Artifacts (private-by-default HTML pages).

**Rationale:** Zero tenant plumbing, shareable links, private by default.
Rejected for now: SharePoint handbook site (recommended, but more plumbing),
oip-web authed route (most engineering, ties to secure-document-delivery),
Box-hosted pages (weak HTML preview).

## 2026-08-30 — research and execution routing

**Question:** How is the deep research executed?

**Answer:** Five lanes from the opening Fable session: Grok 4.6 as primary
web driver (firecrawl deep-research skill, x-search on) for Box-DMS config
and Purview import mechanics; GPT-5.6 Sol xhigh (explicitly authorized) for
the Graph write surface and driver goal shape; Sol medium for the SKU
preflight + process norms; codex for token-heavy distillation. Every lane
writes reports into this packet's `research/` directory — files on disk,
never chat-only.

**Rationale:** Matches the quota-routing doctrine; xhigh is explicitly
authorized by the operator for the two hard lanes only.

## 2026-08-30 — provisioning-as-code shape

**Question:** How is the Box/M365 configuration applied and iterated?

**Answer:** Versioned repo code over ad-hoc CLI scripts or manual admin
consoles — provisioning must be code we iterate on in a controlled fashion.
No Box Pulumi/Terraform provider exists (verified 2026-08-30), so the open
comparison is an Effect-native desired-state reconcile program over
`@beep/box`/`@beep/m365` (schema-first diff/apply, dry-run) vs a Pulumi
Dynamic Provider wrapper. The reconcile-shape choice stays open for R4
research; the versioned-code preference itself is ratified.

**Rationale:** Operator directive 2026-08-30 ("code we version to iterate on
… over cli scripts or commands"). Idempotent re-runs and reviewable diffs are
what "production grade" means for tenant configuration.

## 2026-08-30 — signatures and billing

**Question:** The operator added "document signature workflows & E-Billing
for his clients, I think box has this." Box Sign exists; Box has no billing
product, and the 2026-07-14 ratified fact says FreshBooks is the billing
platform with no LEDES e-billing clients. What is in scope?

**Answer:** Billing stays in FreshBooks (upholds the ratified decision). Box
handles the document side: engagement letters and fee agreements via Box
Sign, and secure invoice delivery into client-shared folders. Research covers
Box Sign availability/limits on the Business plan plus the FreshBooks
client-portal/payment surface. No billing-platform change.

**Rationale:** Box Sign is Box-native; e-billing is not. Rejected: reopening
the billing platform (overturns a jointly-made decision without Tom's
buy-in) and LEDES/UTBMS scope (no client trigger has fired since 2026-07-14).
