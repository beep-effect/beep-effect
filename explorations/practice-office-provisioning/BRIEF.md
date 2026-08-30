# Brief

<!--
Stage 3. Shape Up pitch: problem, appetite, fat-marker solution sketch,
rabbit holes, no-gos. Concrete enough to decompose, rough enough to leave
design latitude. Drafted 2026-08-30 from CAPTURE + RESEARCH + DECISIONS;
exits shape only when the operator confirms it matches his picture.
-->

## Problem

The practice runs on ad-hoc files, one mailbox, and manual habit. The
historical estate (decades of mail and documents) sits in a salvage archive
the attorney cannot search; current work has no matter-centric system of
record, no versioning discipline, no signature flow, and no written process
a future assistant could follow. Meanwhile the tenant already owns the right
platforms — Box (Business, with Box Drive daily), M365 (Business Premium +
Copilot, 2 seats), FreshBooks, HubSpot — none of them provisioned into a
system.

## Appetite

Live-first and bounded: provision the go-forward structure now, in a
handful of goal-sized packets; historical population is explicitly out of
this appetite (it fires after `goals/oppold-corpus-salvage-restoration` G1
and the `oppold-corpus-pipeline-v2` re-entry deliver the extracted estate).
Two historical carve-outs sit inside the appetite because they need no
corpus output: the raw-PST mail import (a license seat and a runbook) and
the contact seeding from the already-salvaged contact-export CSVs.

## Solution sketch (fat marker)

1. **Desired-state reconciler** (Effect-native, ratified) over `@beep/box`:
   a versioned intent document (schemas for the client/matter taxonomy,
   collaborations, and — plan-permitting — metadata/retention) → live
   inventory through the driver → schema-validated plan artifact (dry-run
   is the default mode) → idempotent apply. Entitlement gaps surface as
   `BlockedByEntitlement` plan entries, never silent skips. The canonical
   matter tree is owned by a dedicated Box service identity; the attorney
   collaborates at client-folder level. Requires NET-NEW Box driver
   managers scoped to the stay-on-Business posture — collaborations, Sign,
   and webhooks now; metadata and retention managers join only when a plan
   upgrade is ratified — all under the package's type-instantiation budget.
2. **`@beep/m365` auth + write verbs**, shrunk to contacts: a second MSAL
   confidential-client token provider beside PKCE (certificate-first
   credential union; secret as limited dev fallback),
   RBAC-for-Applications scoping, contacts import into a dedicated folder
   in the attorney's mailbox (dedup by normalized email, seeded from the
   salvaged contact CSVs), and replacement of the read-only scope blacklist
   with per-lane decoded configs. No driveItem upload, no `Sites.Selected`,
   and no Graph mail-write lane — historical mail arrives only via the
   Purview import; no decision approves Graph message creation.
3. **Mail backfill runbook** (operational, thin on code): one EOP2 seat on
   the attorney → enable archive + auto-expansion → Purview network-upload
   import per the r2 runbook (with the AzCopy `--recursive` correction),
   segregated `/Historical-PST` root, ≤100 GB tranches, reconciliation
   before releasing retention hold.
4. **Signature + invoice flow**: Box Sign engagement-letter requests driven
   off an idempotent workflow ledger (operational transactions, not
   desired-state); `@beep/freshbooks` driver (hubspot-pattern) retrieving
   invoice PDFs for delivery into client Box folders.
5. **Walkthroughs**: eight Claude Artifacts pages per the R5 outline,
   teaching the attorney the system the reconciler provisioned.

## Rabbit holes

- The Purview >100 GB / auto-expanding-archive documentation contradiction —
  support case before tranche 2/3, never assume.
- Box CCG platform-app approval on the Business plan — verify before the
  service-identity design hardens.
- Box quote economics (Governance-on-Business, Business Plus, Enterprise
  Plus bundling) — decision-ready table first, upgrade later if triggered.
- FreshBooks webhook retry/verification semantics — unverified; keep
  webhooks out of the first driver goal.
- Reconciler adopt-vs-foreign semantics — v1 adopts only an explicit
  allowlist of existing resources and never prunes/deletes.
- Metadata-driven filing on a plan that lacks metadata templates — folder
  conventions carry the taxonomy until an upgrade is ratified.

## No-gos

- No SharePoint document store — Box is the sole document record; Copilot's
  Box connector is the cross-store search surface.
- No billing-platform change and no LEDES/UTBMS scope — FreshBooks bills,
  Box signs and delivers.
- No Pulumi for the practice estate.
- No retention automation that deletes anything without the attorney's
  explicit sign-off.
- No GAL/org-contact provisioning.
- No historical population before salvage-restoration G1 passes — except
  the two appetite carve-outs (raw-PST mail import; contact-CSV seeding) —
  and no multi-firm productization of any of this.
