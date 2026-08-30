# Research

## 2026-08-30 — five-lane sweep + live tenant probes

Five research lanes ran against the ten pre-ratified decisions in
[`DECISIONS.md`](./DECISIONS.md); full reports live in
[`research/`](./research/) and the provenance ledger is
[`research/SOURCES.md`](./research/SOURCES.md). Live tenant probes (Box MCP,
M365 MCP, `az rest` Graph reads) grounded several questions in fact the same
day. An operator-run Sol Pro gap session
([`research/sol-pro-oracle-prompt.md`](./research/sol-pro-oracle-prompt.md))
is outstanding; its report lands as `research/r7-sol-pro-gap-report.md`.

### Live tenant ground truth (probed, not researched)

- M365 tenant: **Business Premium with Copilot for Business, 2 seats, both
  assigned** (`toppold@` and `boppold@oip.law`) plus free Power Automate.
  Read live from `subscribedSkus` via `az rest`.
- Box tenant: org logins on the practice domain; **zero enterprise metadata
  templates**; Benjamin's root holds a 2026-07-03 staging drop (mail-export
  folders + entity CSVs + ~300 MB of category zips), all Benjamin-owned with
  no collaborations — invisible from Tom's per-user root. Box for
  Microsoft 365, Claude, ChatGPT, and Copilot Studio integrations enabled.
- Azure CLI signed in as `boppold@oip.law`; Entra app-registration work can
  be driven from this machine.

### External landscape

**Mail backfill
([`r2-purview-pst-import.md`](./research/r2-purview-pst-import.md))** — the
only supported bulk path is Purview network upload (AzCopy + mapping CSV).
Import into the attorney's archive mailbox under a segregated
`TargetRootFolder` such as `/Historical-PST`; `IsArchive=TRUE` with root `/`
documented lands content in hidden non-IPM folders. Hard ceiling 100 GB per
archive-import job; imports set `RetentionHoldEnabled=true` indefinitely
(leave on until a retention policy exists). Bulk-import *user rights* are
listed only for EXO Plan 2 / E3 / E5 / Purview add-ons — **not Business
Premium**, which the live SKU read makes a confirmed gap: the backfill needs
a temporary step-up seat or add-on. One genuine docs conflict is open
(overview says wait for auto-expansion between >100 GB batches; a newer
troubleshoot page says auto-expand does not support PST import) — Sol Pro
section A adjudicates.

**Graph write surface
([`r3-graph-write-surface.md`](./research/r3-graph-write-surface.md))** —
documents have a clean path: resumable `driveItem` upload sessions (320 KiB
multiples, 5–10 MiB fragments), `Sites.Selected` app permission with a
per-site write grant as the least-privilege runtime design. Historical mail
does NOT: Graph MIME creation makes drafts (4 MB post-base64 cap, no
received-time fidelity contract), and the new 2026 Graph mailbox
import/export API moves opaque FTS streams between Exchange mailboxes — it
is not a PST or RFC822 ingress. Purview stays the authoritative mail lane;
Graph mail writes are for clearly-labelled reference drafts at most.
Contacts: `POST /users/{id}/contacts` with `Contacts.ReadWrite` app-only is
straightforward; GAL/org contacts are a different, heavier surface.

**Box as legal DMS
([`r1-box-legal-dms.md`](./research/r1-box-legal-dms.md))** — the original
Grok lane crashed at turn 167 before writing its report (stream cutoff); the
standing report is a salvage distillation over its evidence log (132 cited
references, claims tagged `(log)`/`(provided)`, gaps listed as explicit
NOT-COVERED follow-ups). It frames the current tenant honestly — a secure,
versioned matter-folder repository with sharing, Box Drive, and e-signature,
NOT yet a governed legal DMS — and delivers the matter-centric taxonomy
patterns, the plan-gate analysis (metadata Business Plus+, retention needs
Governance, Box Sign ~100 API requests/yr on Business), an upgrade-trigger
table, and a recommended starter taxonomy sketch.

**SKU + process norms
([`r5-sku-preflight-and-process.md`](./research/r5-sku-preflight-and-process.md))**
— decision-ready gating matrix across SKUs (now anchored by the live read),
preflight stop conditions, and an 8-page walkthrough content outline
(intake/conflicts, numbering, day-one matter file, email filing, versioning,
Box Sign engagement letters, FreshBooks invoice delivery, close/retain).

### In-repo capability inventory

**Driver gaps
([`r4-provisioning-code-shape.md`](./research/r4-provisioning-code-shape.md),
with `file:line` evidence)** — `@beep/box` is demand-scoped: folder CRUD is
generated; metadata templates, cascade policies, retention, collaborations,
Box Sign requests, and webhooks are compile-time absent until added to the
demand manifest (budget-gated per the box-typecheck-cost goal). `@beep/m365`
has the right seam: the token-provider contract is injected, so a
confidential-client (app-only) provider sits beside PKCE without touching
the REST service; write verbs attach to `M365Shape`/`makeService`. One
finding to carry into the goal: the current read-only scope guard is a
four-entry blacklist that would silently accept `Files.ReadWrite`,
`Contacts.ReadWrite`, and `Mail.ReadWrite` — replace it with separate
decoded delegated and app-only lane configs.

**Provisioning shape (R4 recommendation, matching the ratified
versioned-code decision)** — an **Effect-native desired-state reconcile
program** over the drivers: decode a versioned intent document, inventory
live tenants, emit a schema-validated plan artifact, apply that exact plan
with per-resource idempotency and preconditions; dry-run is the normal
planning mode. Plan entries must surface `BlockedByEntitlement` for
metadata/retention on the current Box Business plan rather than skipping.
Pulumi (already in the repo for infra) was rejected for this estate: its
Dynamic Provider model fits poorly with rich live discovery, entitlement
blockers, and resource adoption. Box Sign requests are operational
transactions driven off an idempotent workflow ledger, not standing
desired-state resources.

### Oracle gap report (same day —
[`r7-sol-pro-gap-report.md`](./research/r7-sol-pro-gap-report.md))

The operator-run Sol Pro session landed within hours: 26 cited sources,
CONFIRMED/LIKELY/UNVERIFIED tagging. Headlines:

- **Licensing path settled to a default**: the PST-import license belongs on
  the TARGET MAILBOX user (Tom), not the admin. Cheapest verified path:
  **one Exchange Online Plan 2 seat, $8/user/mo paid yearly ($96/yr)**.
  Newly discovered alternative: **Purview Suite for Microsoft 365 Business
  Premium** ($10/user/mo first-year promo through 2026-12-31) also carries
  import rights and fits the existing base plan — pick it only if the
  compliance stack is wanted. E3 routes rejected as overkill. True 1–3
  month term economics are UNVERIFIED pending a CSP/New Commerce quote;
  EOP2-beside-Business-Premium coexistence needs a dry-run assignment.
- **Auto-expand conflict adjudicated operationally**: the newer (2026-06)
  import overview permitting staged >100 GB imports beats the older
  troubleshoot page, but the contradiction stands — open a support case
  before tranche 2/3; expect ~24 GB/day/mailbox, ≤20 GB per PST, up to
  30 days for archive expansion.
- **Corrections to lane findings**: plain Box Business DOES include
  watermarking; Governance-add-on-on-Business eligibility is a quote-level
  open item (safest assumption stays Business Plus+); Graph mailbox
  import/export is real but still not a PST/RFC822 ingress;
  **ApplicationAccessPolicy is legacy — new code targets RBAC for
  Applications** for app-only mailbox scoping.
- Box Sign on Business: ~100 custom-integration API sign requests/year —
  fine for engagement letters at solo volume, a trigger if workflows grow.

### Residual frontier for align

1. Confirm the EOP2-seat default (vs Purview-Suite-for-BP) and get the
   CSP quote for term length; dry-run the license assignment on a test
   basis before import day (r7 A, open items 1–2).
2. Box quote items: Governance on Business eligibility/price, Enterprise
   Plus bundling, Shield add-on price; upgrade triggers table (r7 B + r1).
3. Ownership/collaboration topology: service account vs Tom-owned matter
   folders; which existing tenant resources the reconciler adopts vs treats
   as foreign (R4 open questions; current staging drop is invisible to Tom).
4. Document egress exception: whether anything ships to SharePoint at all
   (`Sites.Selected` needs a named site + purpose) or the M365 doc lane is
   dropped in favor of Box-only (R3 open questions).
5. Contacts: which extracted entities become whose contacts, dedup keys,
   GAL yes/no (R3).
6. FreshBooks: driver goal shape, redirect URI for the dev app, scope
   tightening, invoice→Box delivery mechanics; live request-limit and
   webhook-retry numbers still unverified (R6 + r7 D).
7. Walkthrough artifacts: adopt R5's 8-page outline; confirm audience
   framing with Tom. Malpractice-carrier specifics stay out of code until
   the actual policy is in hand (r7 open item 7).
