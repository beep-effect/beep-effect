# MAP — practice-office-provisioning

> Decomposition into goal packets. Every major component cites an existing
> repo capability or is marked NET-NEW. The graduation set below was ratified
> 2026-08-30 (see the graduation entry in [`DECISIONS.md`](./DECISIONS.md));
> the four promised-now packets are scaffolded in the same PR that lands this
> MAP. Gated candidates stay here as re-entry points — a fired gate reopens
> this packet at `decompose`.

## Promised-now goal packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `practice-box-provisioning` | Expand `@beep/box` with the provisioning managers the stay-on-Business posture needs (discovery reads first, then collaborations, webhooks, Box Sign requests), then ship the Effect-native desired-state reconciler that provisions the service-identity-owned client/matter tree: versioned intent document → live inventory → schema-validated plan artifact (dry-run default) → idempotent apply with `BlockedByEntitlement` entries for metadata/retention. | none | `@beep/box` demand-scoped generator and budget rules (`packages/drivers/box/scripts/box.surface.ts`, `packages/drivers/box/src/_generated/Box.operations.gen.ts`, `packages/drivers/box/README.md` — folder CRUD generated; target managers verified present in the installed SDK, r4 §Box driver); existing developer-token/CCG layers (`packages/drivers/box/src/Box.service.ts`); `@beep/m365` reads for the contact-intent inventory side; `@beep/schema` `LiteralKit` + schema-first laws. NET-NEW: the demand-manifest manager additions (regenerate + remeasure per the package budget); the reconciler program and its intent/plan/receipt schemas (package home confirmed with `bun run beep architecture` at P0, per r4); the Box service-identity setup. |
| `practice-m365-contacts` | Give `@beep/m365` its second auth lane (confidential client, certificate-first credential union; secret as limited dev fallback) and contacts write verbs behind per-lane decoded scope configs, then seed a dedicated contact folder in the attorney's mailbox from the salvaged contact-export CSVs — dedup by normalized email, never overwriting hand-edited contacts, reconciler-tagged for rollback. | none | injected token-provider seam (`packages/drivers/m365/src/M365.auth.ts:262-300`); injectable service layer (`packages/drivers/m365/src/M365.service.ts:1180-1209`); fake-HTTP fixture/capture test pattern (`packages/drivers/m365/test/M365.service.test.ts`); RBAC-for-Applications scoping (r7 correction — ApplicationAccessPolicy is legacy). NET-NEW: `M365Auth` confidential-client constructor; per-lane configs replacing the four-entry write-scope blacklist (`packages/drivers/m365/src/M365.config.ts:122-151`); write-safe HTTP executor (non-idempotent POSTs never blind-replayed); contact schemas + verbs; the seeding job. |
| `practice-mail-backfill` | Make the historical mail estate searchable in the attorney's Outlook: one EOP2 seat (CSP quote + dry-run assignment first), archive + auto-expansion enablement, then the Purview network-upload PST import per the r2 runbook — segregated `/Historical-PST` root, ≤100 GB tranches, reconciliation before any retention-hold change. | source PSTs from the preserved salvage estate (no corpus *processing* required — ratified appetite carve-out) | r2 runbook ([`research/r2-purview-pst-import.md`](./research/r2-purview-pst-import.md), AzCopy + mapping-CSV mechanics, flat-vs-recursive staging pairing); EOP2 decision + r7 §A adjudication; tenant global admin + Azure CLI access (CAPTURE). NET-NEW: the goal-local operator runbook and evidence protocol (documentation-and-operations goal; generated mapping CSVs and PST inventories are client-identifying and stay out of the repo). |
| `freshbooks-driver` | Ship `@beep/freshbooks` on the `@beep/hubspot` pattern: auth-code token helper whose single-use refresh-token rotation runs through a single refresh owner with atomic persistence, clients/invoices/payments read verbs, and invoice-PDF retrieval gated on a first-phase endpoint-validation spike against the existing dev app. | none | `@beep/hubspot` driver pattern (`packages/drivers/hubspot` — FetchHttpClient + Schema decode + `LiteralKit` errors + `S.Redacted` config); `bun run beep create-package` (new-package law); FreshBooks dev app + 1Password refs (CAPTURE — refs stay references). NET-NEW: the driver package and every verb; the rotation-serialization token helper. |

## Gated candidates (re-entry points — reopen this packet at `decompose`)

| Candidate | Mission sketch | Gate |
| --- | --- | --- |
| `practice-sign-invoice-flow` | Box Sign engagement-letter requests driven off an idempotent workflow ledger in the attorney's user context, plus FreshBooks invoice-PDF delivery into client Box folders (operator-export intake-folder fallback if the endpoint spike fails). | `practice-box-provisioning` has applied the starter tree live AND `freshbooks-driver` P0 has resolved the invoice-PDF endpoint question. |
| `practice-walkthroughs` | The eight Claude Artifacts walkthrough pages per the adopted R5 outline, authored page-by-page with the attorney. | `practice-box-provisioning` starter taxonomy is applied live (the pages teach the provisioned system, not a plan). |

## Sequencing

1. **Immediately parallel, low-code**: `freshbooks-driver` P0 (endpoint
   validation + live limits) and `practice-mail-backfill` P0 (CSP quote,
   dry-run license assignment, support case for the >100 GB conflict). Both
   burn down VERIFY items carried from `ops/manifest.json`.
2. **Engineering center**: `practice-box-provisioning` — driver discovery
   reads → mutation paths → reconciler → dry-run plan artifact against the
   live tenant → operator-attended first apply. Everything client-facing
   hangs off this tree.
3. **Parallel driver lane**: `practice-m365-contacts` touches only
   `@beep/m365` and the attorney's mailbox; it does not wait on the Box tree.
4. **Gated re-entries** fire per the table above; the sign/invoice flow and
   walkthroughs decompose with real evidence (live tree, verified endpoint)
   instead of assumptions.

## First vertical slice

For `practice-box-provisioning`: from a starter-taxonomy intent document,
produce a schema-validated **dry-run plan artifact against the live Box
tenant** — inventory reads the actual root (including the 2026-07 staging
drop, which the plan treats as foreign, not adopted), the plan proposes the
service-identity-owned tree with client-folder collaborations for the
attorney, `BlockedByEntitlement` rows appear for metadata templates and
retention on the Business plan, and zero mutations execute. A second dry-run
over an unchanged tenant yields an identical plan. That proves the intent
schema, inventory, planner, artifact, and entitlement surfacing before any
write path exists.

## Inherited risks

- Purview >100 GB / auto-expanding-archive docs conflict — support case
  before tranche 2/3, never assume (BRIEF, r2 §2.5, r7 §A).
- Box CCG platform-app approval on the Business plan — verify before the
  service-identity design hardens (r7 §F).
- Box quote economics (Governance-on-Business, Business Plus, collaborator
  seats) — decision-ready table first; upgrade is a later ratified decision.
- FreshBooks webhook retry/verification semantics unverified — webhooks stay
  out of the first driver goal.
- Reconciler adopt-vs-foreign: v1 adopts only an explicit allowlist and never
  prunes or deletes (BRIEF rabbit hole; r4 idempotency table).
- Folder conventions carry the taxonomy until a plan upgrade is ratified —
  no metadata-driven filing on Business.
- `@beep/box` type-instantiation budget: manager additions require
  regeneration and remeasurement; some families may need narrow hand-written
  operations (r4 open question 4).
- Box SDK version provenance drift (catalog/lock vs trace constant) must be
  repaired before growing the generated surface (r4).
- Confidentiality: plan artifacts, receipts, fixtures, and runbook outputs
  must never carry client/matter names, tokens, upload URLs, or contact
  bodies into the tracked repo (r4 receipt rules; repo is public).
- Box Sign custom-integration allowance (~100 requests/yr on Business) —
  fine at solo volume, an upgrade trigger if workflows grow.
- FreshBooks single-use refresh rotation: two concurrent refreshers strand
  one token — single refresh owner, atomic persistence (r7 §F9).
