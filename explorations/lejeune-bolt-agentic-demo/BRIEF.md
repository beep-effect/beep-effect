# LeJeune Knowledge Desk brief

**RATIFIED 2026-08-26 (shape review)**

## Problem

Structural-fastener quoting is piecemeal. A buyer's request can be split across email, a takeoff,
a PDF schedule, a drawing, and a call note. The distributor must recover the fastener assembly,
finish, quantity, certification, delivery, tool, and substitution facts before comparing offers
or drafting a quote. The work continues through sourcing, order tracking, lot evidence, and
specification clarification. This workflow is a reconstruction, not a LeJeune SOP.
[RFQ workflow](./RESEARCH.md#rfq-to-quote-to-source-to-order-to-specify).

The immediate business risk is that experienced employees may retire with customer-specific
exceptions and technical judgment still held in mailboxes, notes, and memory. The retirement
claim comes from the packet and remains unverified by public sources. The useful unit of retained
knowledge is a reviewed, time-bound claim with a source and supersession history, not a chat log.
[Company profile](./RESEARCH.md#company-profile-and-operating-position),
[temporal-memory case](./research/07-use-case-evaluation.md#3-veteran-mailbox-pst-and-call-notes-to-temporal-memory).

The packet says Microsoft Office is the system of record, but the public site does not confirm
that claim. A paid pilot can test Outlook, OneDrive, SharePoint, or an authorized PST. The lunch
cannot depend on tenant consent or on missing attachment-ingest work.
[Microsoft 365 surfaces](./RESEARCH.md#microsoft-365-surfaces),
[M365 inventory](./research/04-in-repo-capability-inventory.md#a-microsoft-365-ingestion).

## Appetite

Spend five working days. The exact 30-minute scenario in lane 07 is the definition of done. The
app is a one-week customer-demo lab, with a proposed delete-or-promote review on 2026-09-30. It
must rehearse and run from a fixed local bundle without M365, a model provider, or the network.
[30-minute storyline](./research/07-use-case-evaluation.md#exact-30-minute-demo-storyline),
[Option C plan](./research/08-demo-options.md#five-day-plan-2).

The lunch is replay-first. Its demo artifact is a recorded golden run whose every beat replays
deterministically from the local bundle. One live provider extraction is an optional flourish
only after a clean rehearsal.

The appetite buys one vertical proof, not a platform. It includes two fixed RFQ layouts, a small
fastener ontology, three specification checks, one veteran correction, synthetic supplier
offers, approval records, a PO draft, tailnet packaging, and an offline fallback. Broad mail
backfill, arbitrary OCR, current supplier integrations, and production semantic memory do not
fit this cut.
[Five-day constraint](./RESEARCH.md#2026-08-25-constraints-discovered),
[capability cut](./research/04-in-repo-capability-inventory.md#recommended-five-day-cut).

Reserve roughly half a day for new-package gates, schema-first work, and the JSDoc rubric. The
day-5 browser rehearsal is recorded through `bun run beep qa` and also proves the offline
fallback.

## Solution sketch

### Demo contract

```text
public site corpus + synthetic Office records
  -> parse mail, PDF, DOCX, and XLSX fixture rows
  -> extract exact source spans and normalized RFQ lines
  -> add standards, projects, tools, lots, offers, and reviewed claims
  -> persist PGlite application state + DuckDB corpus and full-text index
  -> load bounded RDF into in-memory Oxigraph for query and validation
  -> retrieve with graph filters, full-text search, and visible citations
  -> draft clarification, quote, and supplier PO
  -> approve / edit / reject
  -> stop at a non-executing receipt
```

This is the shared contract from the architecture comparison. The lab uses the practice-KG
PGlite and DuckDB pattern, `@beep/langextract` exact spans, RDF and provenance models, and
in-memory Oxigraph. The fastener schemas, fixtures, rules, review flow, and UI are new work.
[Shared demo contract](./research/08-demo-options.md#shared-demo-contract),
[capability inventory](./RESEARCH.md#2026-08-25-in-repo-capability-inventory).

### Thirty-minute story

1. Open a beep-branded "LeJeune Knowledge Desk" on a MagicDNS HTTPS URL. State the data boundary:
   public `lejeunebolt.com` material and synthetic Office records, stored locally.
2. Load a synthetic Outlook thread, Excel takeoff, and PDF schedule. Show document hashes,
   dates, extracted quote lines, exact source spans, and the missing facts the system refuses to
   guess.
3. Catch a fixed specification problem, open the governing ASTM F3125, RCSC, AISC, or supplier
   excerpt, and draft an RFI. The assistant is advisory and never acts as engineer of record.
4. Compare timestamped synthetic offers, including split availability, lead time, origin,
   certificates, freight, and expiry. Draft the reviewed quote and companion tool or test items.
5. Review one veteran correction with source, validity, scope, and supersession. Rerun the RFQ
   and show exactly how the approved correction changes the warning.
6. End on a supplier PO draft with policy checks and approve/edit/reject. Emit a non-executing
   receipt and ask for a measured, consented M365 pilot.

The three cases and timing come from lane 07. The offer data stays synthetic because the public
corpus contains no current price, stock, lead-time, or supplier authority.
[Top three](./research/07-use-case-evaluation.md#top-three),
[public-data limit](./RESEARCH.md#2026-08-25-constraints-discovered).

### Product and deployment boundary

Create exactly one new workspace package through the repo package generator: the proposed
`lejeune-bolt-workbench` lab (under `apps/labs/`). Both promised-now goal packets deliver into
it. Its ops scripts and internal modules own the corpus builder, ontology schemas, and fixtures;
machine-local data stays outside the repository. Keep the screen small: RFQ and quote, graph or
table, source evidence, approval, and the memory change. Use beep branding and the working title
"LeJeune Knowledge Desk." Port only named, permissively licensed interaction patterns after
preserving notices.
[Option C architecture](./research/08-demo-options.md#architecture-and-pipeline-2),
[Option C branding](./research/08-demo-options.md#branding-surface-2).

Make one live `@beep/anthropic` extraction call a day-1 acceptance item. If it fails, fall to
`openai-compat`, `venice-ai`, or `xai` the same day.

Run one web artifact and one Effect API process on Benjamin's tailnet. Mount the immutable bundle
separately from the mutable approval ledger. Expose `/health` and one Tailscale Serve mapping.
Give `@beep/cosmos` a half-day browser timebox on day 2. If it does not render the demo graph
inside that box, ship table and source with no renegotiation. Do not use a static-image stand-in.
Keep a fixed-output fallback if the model provider fails.
[Option C deployment](./research/08-demo-options.md#tailnet-deployment-2),
[Option C risks](./research/08-demo-options.md#risks-2).

The lunch closes on a service-as-software engagement: connect one approved Office source, define
the ontology and authority rules with the business, adjudicate veteran claims, measure citation
and review quality, and expand only after the evidence supports approved actions.
[Service-as-software research](./research/06-landscape-m365-and-competitors.md#5-service-as-software-for-smb--mid-market-distributors).

## Rabbit holes

- **Live supplier portals and terms.** Do not scrape or automate a portal. A real path requires
  an agreed API, punchout, or EDI contract. The lunch ends at a draft.
  [Supplier-portal constraint](./RESEARCH.md#2026-08-25-constraints-discovered).
- **Real M365 and PST consent.** Delegated reads can still hit tenant policy. App-only mail and
  Teams export raise the consent burden. Keep them in the paid pilot.
  [M365 consent](./research/06-landscape-m365-and-competitors.md#36-app-registration-and-consent-model-what-lunch-can-vs-cannot-do).
- **Full TrustGraph runtime.** The local port has an unverified root license, a large service
  stack, and documented gaps. It is a donor or escape hatch, not the default architecture.
  [Option A risks](./research/08-demo-options.md#risks).
- **Tauri and Semantica.** Tauri does not help a tailnet web demo, and Semantica's named stages
  are deliberate stubs. Do not turn the lunch into Semantica implementation.
  [Option B](./research/08-demo-options.md#option-b-extend-appslabssemantica).
- **General ontology ambition.** Freeze the shared-contract classes and three cited checks. Do
  not model the complete catalog, ERP, standards library, or every customer exception.
  [Shared demo contract](./research/08-demo-options.md#shared-demo-contract).
- **Part numbers and copyrighted standards.** Keep technical documents as cited sources. Do not
  commit third-party pages, binaries, full standards, or a copied product catalog.
  [Mining requirements](./research/08-demo-options.md#reproducible-lejeuneboltcom-mining-sketch).
- **Untested graph and model paths.** `@beep/cosmos` and the model adapters exist in source, but
  lane 04 did not browser-test or provider-test them. Preserve table, source, and fixed-output
  fallbacks.
  [Capability inventory](./RESEARCH.md#2026-08-25-in-repo-capability-inventory).

## No-gos

- No external write, quote send, supplier order, portal action, or state that implies execution.
  [PO case](./research/07-use-case-evaluation.md#9-approval-gated-supplier-po-placement).
- No public endpoint. Tailnet users are named and the fixed scenario remains offline-capable.
  [Tailnet constraint](./RESEARCH.md#2026-08-25-constraints-discovered).
- No scraped third-party content, real correspondence, or raw corpus payload in the repository.
  [Mining sketch](./research/08-demo-options.md#reproducible-lejeuneboltcom-mining-sketch).
- No claim that the assistant is an engineer of record or may approve substitutions, compliance,
  price, margin, or purchasing authority.
  [Specification case](./research/07-use-case-evaluation.md#2-cited-specification-clarification-assistant).
- No current price, availability, supplier, project, or certificate claim without a source and
  as-of date. Lunch offers are labeled `SYNTHETIC`.
  [Public-data limit](./RESEARCH.md#2026-08-25-constraints-discovered).
- No "AI magic" claim. Every extraction, answer, remembered correction, and draft action exposes
  its source, review state, uncertainty, and stop point.
  [Top-three trust model](./research/07-use-case-evaluation.md#top-three).
