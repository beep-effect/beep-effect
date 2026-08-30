# Oracle session prompt — Sol Pro gap report (operator-run, 2026-08-30)

Paste everything below the rule into a GPT-5.6 Sol Pro (web, extended
thinking + browsing) session. Save the resulting report as
`research/r7-sol-pro-gap-report.md` in this packet.

---

# Deep research: solo IP practice office provisioning — gap report

You are running a one-shot deep research session with browsing. Today is
2026-08-30. Produce ONE self-contained markdown research report I can save
as a file. You have no access to our repository or prior reports — every
fact you need is in this prompt. Do not restate this brief or add meta
commentary; spend your entire effort on the open questions.

## Fixed context (ratified decisions — do not relitigate)

- A solo IP (patent) law practice, one attorney; his son (a software
  engineer) builds the tooling in a TypeScript/Effect monorepo.
- Box is the document system of record. The tenant exists on the Box
  **Business** plan; the attorney uses Box Drive daily. Box Sign is in scope
  for engagement letters. Already enabled: Box for Microsoft 365 (web),
  plus Claude, ChatGPT, and Copilot Studio integrations.
- A Microsoft 365 tenant (custom domain) owns mail, contacts, calendar.
  Global Admin is available. CONFIRMED by live Graph read 2026-08-30: the
  tenant's only paid SKU is **Microsoft 365 Business Premium with Copilot
  for Business** (2 seats, both assigned — the attorney and the engineer).
  Documents are NOT duplicated into SharePoint.
- Historical estate: large Outlook PST archives plus documents restored
  from the practice's past; backfill happens AFTER go-live (live-first).
- Mail strategy, both lanes: raw PSTs → the attorney's Exchange archive
  mailbox via the Microsoft Purview import service; curated per-matter
  artifacts → Box.
- Billing is FreshBooks (ratified; not changing). A FreshBooks Private App
  (dev) exists with all scopes enabled.
- All tenant provisioning ships as versioned code with idempotent
  reconcile semantics; Microsoft Graph access uses two auth lanes
  (app-only client credentials for bulk jobs, delegated for interactive).

## What we already researched (do not redo; correct only with evidence)

- The Purview PST Import Service is the only supported bulk path (network
  upload + AzCopy + mapping CSV). Bulk-import *user rights* are listed for
  Exchange Online Plan 2, Office/Microsoft 365 E3/E5, and Purview add-ons —
  NOT for Microsoft 365 Business Standard/Premium. Business Premium does
  include the 1.5 TB auto-expanding archive; those are separate gates.
- Docs conflict #1: the Purview import overview says to split >100 GB
  archive imports and wait for auto-expansion; a 2025-09 troubleshoot
  article says auto-expanding archives do not support PST import.
- Imports into an archive must use a segregated TargetRootFolder (never
  `/`, which lands content in hidden non-IPM folders); imports set
  RetentionHoldEnabled=true indefinitely.
- On the Box side: metadata cascade policies and retention require plan
  tiers above Business (Business Plus / Enterprise, with a Governance
  add-on for legal retention). Folder naming is not retention.
- Graph MIME message creation cannot guarantee received-date fidelity; a
  2026-era Graph "mailbox import/export" API was spotted and needs
  evaluation.
- No Box provider exists for Pulumi or Terraform; provisioning will be a
  custom desired-state reconcile program over Box/Graph SDK drivers.

## Your assignment — fill these gaps

**A. Licensing paths (make it decision-grade).** Baseline is now fixed: a
2-seat Microsoft 365 Business Premium (with Copilot for Business) tenant.
For getting bulk PST import rights for ONE of those users: compare Exchange
Online Plan 2 as an add-on/step-up, a single E3 seat, and the Purview
add-on SKUs — current US monthly pricing, monthly vs annual commitment,
whether each stacks legally beside an assigned Business Premium seat, and
whether the entitlement can be held for 1–3 months and dropped after the
import. Who must hold the license: the admin running the import, the
target mailbox's user, or both? Adjudicate docs conflict #1 with the
newest authoritative pages you can find, and state the operationally safe
plan for ~100–300 GB of PSTs landing in a Business Premium user's archive.

**B. Box plan economics and Business-plan reality.** Current (2026) Box
pricing and feature matrix across Business, Business Plus, Enterprise,
Enterprise Plus, including minimum seat counts. Verify exactly what a
legal-DMS setup loses on plain Business: metadata templates and cascade
policies, retention/Governance add-on availability and price, Box Shield,
watermarking. Box Sign: what is included per plan (volume caps, API
access to Sign requests). End with an upgrade decision framework for a
solo firm: stay on Business vs Business Plus vs Enterprise, with triggers.

**C. Legal-ethics operational layer.** The reasonable-care standard for
client files in commercial cloud storage (state bar cloud-computing
opinions; treat jurisdiction as generic US), record-retention norms for a
patent prosecution practice (client files, USPTO prosecution records,
correspondence/email), malpractice-carrier expectations for document
management and versioning, and where retention AUTOMATION is dangerous
(auto-deletion without attorney sign-off). Keep this operational, not a
legal opinion.

**D. FreshBooks integration depth.** As of 2026: API surface maturity for
clients/invoices/payments, webhook/callback reliability and verification,
rate limits, OAuth token and refresh-token lifetimes for Private Apps,
invoice PDF retrieval (for delivering invoices into Box client folders),
official or well-maintained Node SDKs, and known gotchas (identity URLs,
account vs business IDs, pagination).

**E. New or changed Microsoft surfaces.** Status of the Graph mailbox
import/export API (GA or preview, licensing, size limits, whether it can
replace Purview network upload at PST scale). Current state of Graph MIME
message creation limits and fidelity. Creating contacts at scale from
extracted client entities: personal contactFolders vs org-level contacts
vs GAL, with app-only permission implications. Current best practice for
scoping app-only mail access (ApplicationAccessPolicy vs newer RBAC for
Applications).

**F. Provisioning identity and tenant hygiene.** On the Box side: is a
platform app with Client Credentials Grant available on the Business
plan, what approval flow does it need, and should provisioning run as a
service account vs the attorney's account (webhook ownership, Sign
request ownership, collaboration visibility)? On the Microsoft side:
app registration with certificate-based client credentials on a
small-business tenant — practical pitfalls. Secrets live in 1Password;
note any provider-specific credential-rotation constraints.

## Output contract

- One markdown document, no preamble.
- Sections A–F in order; findings as numbered claims, each with an inline
  URL and access date. Never invent a URL; if a page is unreachable, tag
  the claim UNVERIFIED instead of inferring.
- Tag every material claim CONFIRMED / LIKELY / UNVERIFIED.
- Every comparison as a decision-ready table (Option / Cost / Gates /
  Recommendation).
- Close with three sections: "Deltas to our prior findings" (anything in
  the summary above you found to be wrong, with evidence), "Remaining
  open questions", and a full source list.
