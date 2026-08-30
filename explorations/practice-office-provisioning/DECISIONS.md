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

## 2026-08-30 — SKU preflight resolved (supersedes "SKU unknown" above)

**Question:** The "M365 tenant authority" entry left the SKU unknown. What is
it?

**Answer:** Settled the same day by a live `subscribedSkus` Graph read: the
tenant's only paid SKU is **Microsoft 365 Business Premium with Copilot for
Business**, 2 seats, both assigned (the attorney and Benjamin). The
licensing preflight from that entry is complete; align work must not reopen
it.

**Rationale:** Live tenant data beats research inference. Consequence
(r2/r5/r7): archive + retention rights are covered; bulk PST-import user
rights are not — see the EOP2 decision below.

## 2026-08-30 — PST-import rights path (align)

**Question:** Which license grants the mail backfill's PST-import rights on
top of Business Premium?

**Answer:** One Exchange Online Plan 2 seat assigned to the attorney's
mailbox ($8/user/mo paid yearly, $96/yr list). Before purchase: obtain a
CSP/New Commerce quote for true term options and dry-run the license
assignment to verify service-plan coexistence beside Business Premium.

**Rationale:** r7 verified the license belongs on the target mailbox user,
and EOP2 is the cheapest verified entitlement. Rejected: Purview Suite for
Business Premium ($10/mo promo — only if the compliance stack is wanted),
E3 routes (overkill), defer-to-quote (blocks the import window needlessly).

## 2026-08-30 — Box plan posture (align)

**Question:** Upgrade Box before provisioning, or ship on Business?

**Answer:** Stay on Business and ship now; the reconciler emits explicit
`BlockedByEntitlement` plan entries for metadata templates and retention
instead of skipping. The Box quote (Governance-on-Business eligibility and
price, Business Plus, Enterprise Plus bundling, Shield) is gathered in
parallel; any upgrade is a later ratified decision with real prices.
External-collaborator economics are already CONFIRMED by r7's plan matrix:
Business carries paid external collaborators while Business Plus unlocks
unlimited external collaborators — so client-facing collaboration at scale
is itself an upgrade trigger, and the quote prices that trigger rather
than discovering it.

**Rationale:** Structure, collaborations, versioning, and Box Sign work
today; blocking visibly preserves honesty about what the plan lacks.
Rejected: quote-first (delays Tom's go-live) and upgrade-now (spends before
knowing whether metadata-driven filing beats folder conventions for a solo
practice).

## 2026-08-30 — matter-tree ownership topology (align)

**Question:** Who owns the canonical client/matter folder tree in Box?

**Answer:** A dedicated Box service identity owns the canonical tree; the
attorney collaborates at client-folder level (co-owner/editor); Benjamin
retains admin. The CCG platform-app approval flow on the Business plan is a
verification item before build. Identity is split by role, per r7 §F:
the service account is the stable identity for the tree, webhooks, and
reconciliation, but Box Sign treats the authenticated requester as the
request owner/sender — so engagement-letter Sign requests are created in
the attorney's user context (authorized user token / as-user), never as
the service account. r7 §F also cautions against a hidden automation-owned
root; this packet makes that ownership an explicit ratified decision with
the attorney collaborated at client-folder level.

**Rationale:** Stable owner for webhooks and Sign requests; survives
personnel/device changes; matches r7 §F. The probed status quo (everything
Benjamin-owned, zero collaborations, invisible to the attorney) is exactly
what to migrate away from. Rejected: attorney-owned (automation rides a
personal account) and Benjamin-owned (practice records under a non-attorney
personal root).

## 2026-08-30 — M365 document lane dropped (align)

**Question:** Does any document egress to SharePoint survive?

**Answer:** No. Box is the sole document store; the M365 Copilot → Box
connector (enabled the same day) provides the cross-store search surface.
The `@beep/m365` write-verbs goal shrinks to contacts only — no driveItem
upload, no `Sites.Selected`, and no Graph mail-write lane: historical mail
arrives exclusively via the Purview import, and no decision approves Graph
message creation.

**Rationale:** R3 required a named site + purpose before provisioning
`Sites.Selected`; no consumer existed. Rejected: handbook-site-only (the
walkthroughs ship as Claude Artifacts) and capability-without-consumer.

## 2026-08-30 — contacts import shape (align)

**Question:** Where do extracted client/counsel entities land as contacts?

**Answer:** A dedicated contact folder in the attorney's mailbox, app-only
`Contacts.ReadWrite` scoped via RBAC for Applications, dedup key =
normalized email (fallback name+company), never overwriting hand-edited
contacts, reconciler-tagged for rollback. Seed source: the salvaged
contact-export CSVs from the T7 salvage tree (whose 2026-07 copies already
sit in Box); pipeline extraction enriches later. No GAL/org contacts.

**Rationale:** Smallest correct surface (R3); GAL semantics add admin
weight a two-seat tenant does not need. Rejected: both-mailboxes (duplicate
upkeep) and org contacts.

## 2026-08-30 — FreshBooks driver goal (align)

**Question:** What shape does the FreshBooks integration graduate as?

**Answer:** A `@beep/freshbooks` driver goal following the `@beep/hubspot`
pattern (FetchHttpClient + Schema decode + LiteralKit errors + `S.Redacted`
config): auth-code token helper with a local exact-match HTTPS redirect,
clients/invoices/payments read verbs plus invoice-PDF retrieval for Box
delivery — gated on validating the actual PDF endpoint first (r7 lists it
UNVERIFIED); webhooks follow later. The token helper must treat
FreshBooks' single-use refresh-token rotation as a serialization problem,
not just a persistence one (r7 §F9): a single refresh owner — one
dedicated refresher behind a lock — performs every refresh and atomically
persists the rotated token before releasing it; two concurrent refreshers
presenting the same single-use token strand one of them. The existing all-scopes dev app stays dev-only; the
production app is registered least-privilege at graduation.

**Rationale:** Versioned-code decision needs a repo home for the
invoice-to-Box flow. Rejected: MCP-only (no code home) and
webhooks-in-first-goal (r7 flags retry/verification details unverified).

## 2026-08-30 — walkthrough content plan (align)

**Question:** Adopt R5's walkthrough outline?

**Answer:** Yes — the 8-page outline (intake/conflicts, numbering, day-one
matter file, email filing, versioning, Box Sign engagement letters,
FreshBooks invoice delivery, close/retain) becomes the content plan,
authored during the walkthrough goal and reviewed with the attorney
page-by-page. Malpractice-carrier specifics stay out until the actual
policy is read.

**Rationale:** The outline already encodes the ratified system-of-record
split. Rejected: merging to fewer pages (revisit during authoring if
onboarding feels heavy).

## 2026-08-30 — reconciler shape ratified (align)

**Question:** Effect-native desired-state reconcile program or Pulumi
Dynamic Provider (left open by "provisioning-as-code shape" above)?

**Answer:** Effect-native reconcile program over `@beep/box` and
`@beep/m365`: decode a versioned intent document, inventory live tenants
through the drivers, emit a schema-validated plan artifact (dry-run is the
normal planning mode), apply that exact plan with per-resource idempotency
and preconditions, and surface `BlockedByEntitlement` entries.

**Rationale:** Operator-ratified 2026-08-30 following R4's grounded
recommendation. Pulumi (already in the repo for infra) rejected for this
estate: a second state/reconciliation engine whose read/diff model fits
poorly with live discovery, entitlement blockers, and resource adoption.

## 2026-08-30 — shape exit and graduation set

**Question:** Does `BRIEF.md` match the operator's picture, and which MAP
candidates graduate now?

**Answer:** BRIEF confirmed — the operator green-lit execution the same day
("merged, now let's execute") after the shape PR chain landed. Four
promised-now goals graduate immediately: `practice-box-provisioning`,
`practice-m365-contacts`, `practice-mail-backfill`, and `freshbooks-driver`.
Two candidates stay gated in `MAP.md` as re-entry points:
`practice-sign-invoice-flow` (gate: live starter tree + the FreshBooks P0
endpoint verdict) and `practice-walkthroughs` (gate: starter taxonomy
applied live). The exploration flips to `graduated`; the five VERIFY items
carry into the owning goals' P0 phases (CSP quote + support case →
`practice-mail-backfill`; Box quote + CCG approval →
`practice-box-provisioning`; FreshBooks live limits → `freshbooks-driver`).

**Rationale:** The four promised-now goals need no evidence that does not
already exist; the two gated flows would otherwise decompose against
assumptions (an unprovisioned tree, an unverified endpoint). Rejected:
graduating all six at once (the gated pair would sit fake-active), and
holding the packet open for the gated pair (the graduation contract keeps
re-entry in `MAP.md`, not in packet status).
