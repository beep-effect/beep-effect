# Decisions

Date: 2026-08-25

Benjamin was unavailable for the align round. The operator-ratified entries below are pinned,
but still await Benjamin's confirmation. Every other entry is a recommendation, not a settled
decision.

## Ratified by operator, pending Benjamin's confirmation

### 2026-08-25 — Demo architecture

**Status:** ratified by operator, pending Benjamin's confirmation

**Question:** Which demo architecture should carry the lunch scenario?

**Answer:** Build Option C, a new customer-demo lab at
the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`), with the working product title "LeJeune Knowledge Desk."
The lab is beep-branded and gets a deletion-dated charter. Treat the local TrustGraph TypeScript
port as a component donor after Benjamin licenses it, and as a day-zero escape hatch only.

**Rationale:** Option C composes the practice-KG bundle, evidence, approval, graph, and tailnet
bricks without taking on the full TrustGraph runtime. Option A remains reference-only until its
root license and trimmed runtime are proven. Option B is rejected for this appetite because
Semantica's ingest, extract, and serve commands still stop at `StageNotImplemented`.
[Demo options, "Decision summary"](./research/08-demo-options.md#decision-summary),
[Option C](./research/08-demo-options.md#option-c-new-appslabslejeune-bolt-workbench),
[in-repo lab inventory](./research/04-in-repo-capability-inventory.md#e-lab-applications).

### 2026-08-25 — Lunch use cases and closing beat

**Status:** ratified by operator, pending Benjamin's confirmation

**Question:** Which use cases define the lunch story?

**Answer:** Show three connected cases: an RFQ email plus attachments becoming a reviewed quote
request with exact source spans; a specification-clarification assistant grounded in ASTM
F3125, RCSC, and AISC material that drafts an RFI; and a veteran correction becoming a reviewed,
time-bound claim that changes the same RFQ on rerun. Close with an approval-gated supplier PO
draft. It never submits an order.

**Rationale:** These are the research lane's top three by value, clarity, five-day feasibility,
trust boundary, and paid path. The PO draft makes the approval boundary visible without claiming
a seller connector or violating supplier terms. The remaining ranked cases are follow-up
candidates, not part of the lunch promise.
[Top three](./research/07-use-case-evaluation.md#top-three),
[30-minute storyline](./research/07-use-case-evaluation.md#exact-30-minute-demo-storyline),
[PO evaluation](./research/07-use-case-evaluation.md#9-approval-gated-supplier-po-placement).

### 2026-08-25 — Deployment boundary

**Status:** ratified by operator, pending Benjamin's confirmation

**Question:** Where should the lunch build run?

**Answer:** Run one local-first bundle on Benjamin's tailnet. Expose it only through Tailscale
Serve at a MagicDNS HTTPS address. The fixed scenario must also run fully offline.

**Rationale:** This preserves the captured tailnet boundary and avoids making a public product
claim. PGlite stores graph-shaped application and review state, DuckDB stores the corpus catalog
and full-text index, and in-memory Oxigraph handles bounded RDF queries and validation. A public
endpoint and a cloud-only runtime are rejected.
[Research constraints, item 6](./RESEARCH.md#2026-08-25-constraints-discovered),
[shared demo contract](./research/08-demo-options.md#shared-demo-contract),
[Option C deployment](./research/08-demo-options.md#tailnet-deployment-2).

### 2026-08-25 — Lunch data boundary

**Status:** ratified by operator, pending Benjamin's confirmation

**Question:** What data may the lunch demo use?

**Answer:** Use the public `lejeunebolt.com` corpus from
`~/data-home/lejeune-bolt-corpus/` plus synthetic Office records. Keep the corpus machine-local
and never commit it. Real Microsoft 365 or PST ingestion belongs to a consented paid pilot
through `@beep/m365` or `@beep/libpff`.

**Rationale:** Public pages can seed terminology and cited technical material, but not current
prices, stock, authority, orders, or lot certificates. Live M365 consent and attachment ingest
are not lunch-safe dependencies. Real correspondence, tenant-wide collection, and third-party
scraped supplier data are rejected for this demo.
[Research constraints, items 3, 4, and 8](./RESEARCH.md#2026-08-25-constraints-discovered),
[M365 inventory](./research/04-in-repo-capability-inventory.md#a-microsoft-365-ingestion),
[mining sketch](./research/08-demo-options.md#reproducible-lejeuneboltcom-mining-sketch).

### 2026-08-25 — Engagement framing

**Status:** ratified by operator, pending Benjamin's confirmation

**Question:** What commercial story should the demo support?

**Answer:** Frame the work as a service-as-software engagement. Connect approved M365 sources,
define the ontology and authority rules, preserve veteran corrections with provenance, measure
retrieval and citation quality, then move from recommendations to approved actions.

**Rationale:** Generic RFQ extraction is already a product category. The proposed distinction is
local, cited, time-aware expert knowledge with visible review. A seat-priced chatbot, generic AI
consulting pitch, and claim of a finished SaaS product are rejected.
[Vendor gap](./RESEARCH.md#vendors-and-competitors),
[service-as-software thesis](./research/06-landscape-m365-and-competitors.md#5-service-as-software-for-smb--mid-market-distributors),
[temporal-memory case](./research/07-use-case-evaluation.md#3-veteran-mailbox-pst-and-call-notes-to-temporal-memory).

### 2026-08-25 — Appetite and definition of done

**Status:** ratified by operator, pending Benjamin's confirmation

**Question:** How much work is authorized before lunch?

**Answer:** Spend five working days. The exact 30-minute scenario is the definition of done.
Treat the app as a one-week lab with a deletion date, not the beginning of a general platform.

**Rationale:** The source can support a deterministic corpus, a small ontology, cited spans,
synthetic offers, one reviewed correction, and a non-executing PO receipt. It cannot add broad
mail backfill, arbitrary OCR, live supplier connectors, a general memory engine, and a complete
ontology in five days. Those options are rejected from the lunch scope.
[Research constraints, item 7](./RESEARCH.md#2026-08-25-constraints-discovered),
[recommended five-day cut](./research/04-in-repo-capability-inventory.md#recommended-five-day-cut),
[Option C recommendation](./research/08-demo-options.md#recommendation).

## Proposed for Benjamin's align round

### 2026-08-25 — License the TypeScript port for component reuse?

**Status:** PROPOSED

**Question:** License the TypeScript port under MIT or Apache-2.0 so its workbench components can
be reused?

**Recommended answer:** Yes. Prefer Apache-2.0 to match the relevant upstream TrustGraph
repositories and retain the license and attribution record at the port root.

**Reasoning:** The port has useful workbench routes, but its root license is unverified. Until
Benjamin licenses it, the lunch lab may study it but must not copy from it.
[License constraint](./RESEARCH.md#2026-08-25-constraints-discovered),
[license register](./research/05-open-source-references.md#license-register).

**Rejected options:** Shipping copied components before licensing; making the port a lunch
dependency; leaving the license absent and treating the port as reusable.

### 2026-08-25 — Confirm the lab slug and working product name?

**Status:** PROPOSED

**Question:** Confirm the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`) and "LeJeune Knowledge Desk"?

**Recommended answer:** Yes. Keep the package slug descriptive and disposable. Use the product
name only on the demo surface, with beep branding and no copied third-party marks.

**Reasoning:** A small branded app keeps the RFQ, evidence, graph, review, and memory change on
one screen. Generic TrustGraph or Semantica branding would make the proof look like a reskin.
[Option C branding](./research/08-demo-options.md#branding-surface-2).

**Rejected options:** Renaming a general beep package around one customer; presenting the app as
a production LeJeune product; carrying TrustGraph marks into the demo.

### 2026-08-25 — Which two RFQ layouts should the demo fix?

**Status:** PROPOSED

**Question:** Which two RFQ layouts should the deterministic fixture set support?

**Recommended answer:** Fix one Outlook body table with an attached Excel takeoff, and one prose
email with an attached PDF schedule. Both should split relevant facts across messages and leave
at least one field missing.

**Reasoning:** The research says RFQs arrive piecemeal through email, spreadsheets, drawings,
PDFs, photos, and calls. Two layouts exercise exact-span extraction and missing-field questions
without promising arbitrary document intake.
[RFQ workflow](./RESEARCH.md#rfq-to-quote-to-source-to-order-to-specify),
[top RFQ case](./research/07-use-case-evaluation.md#1-rfq-email-and-attachments-to-a-reviewed-quote-request).

**Rejected options:** A single clean spreadsheet that hides the real problem; three or more
layouts in the first slice; OCR-heavy drawings in the lunch path.

### 2026-08-25 — Ask for one anonymized RFQ before lunch?

**Status:** PROPOSED

**Question:** Should Benjamin ask the LeJeune sales and logistics contact for one anonymized real
RFQ before lunch?

**Recommended answer:** Yes, with explicit permission, only to check whether the two synthetic
layouts feel real. Keep it outside the repo and the lunch bundle. The demo remains public plus
synthetic even if the sample arrives.

**Reasoning:** The public contact form is not a bolt RFQ, so fixture realism is still unverified.
Using the sample only as a private comparison preserves the ratified lunch boundary.
[RFQ verification gap](./research/01-lejeunebolt-site-mining.md#10-gaps-and-verification-queue),
[data constraint](./RESEARCH.md#2026-08-25-constraints-discovered).

**Rejected options:** Making the sample a critical dependency; committing or presenting it;
asking for a mailbox export before consent and pilot terms exist.

### 2026-08-25 — Which model-provider posture should the demo use?

**Status:** PROPOSED

**Question:** Should the demo use a local model, a hosted provider, or both?

**Recommended answer:** Use an already configured hosted provider for extraction and reasoning
over public and synthetic content. Keep a fixed local replay of successful outputs as the fully
offline fallback.

**Reasoning:** Hosted providers are allowed for this data boundary. The repo has several model
adapters, but lane 04 did not verify a live provider. Local-only inference would add hardware and
quality risk that the lunch does not need. An unrelated confidentiality rule from another
vertical does not constrain this architecture.
[Model-adapter inventory](./research/04-in-repo-capability-inventory.md#d-agent-runtime-mcp-and-memory),
[offline fallback](./research/07-use-case-evaluation.md#exact-30-minute-demo-storyline).

**Rejected options:** Local-only inference as a launch requirement; hosted calls over real
LeJeune correspondence; a demo that fails when the provider is unavailable.

### 2026-08-25 — Freeze which ontology and rule-check slice?

**Status:** PROPOSED

**Question:** What ontology and specification rules should freeze on day one?

**Recommended answer:** Use the 12 shared-contract classes: `ProductVariant`, `Component`,
`Standard`, `Finish`, `Tool`, `SupplierOffer`, `Project`, `RFQ`, `QuoteLine`, `LotCertificate`,
`Approval`, and `ExpertClaim`. Fix three rule checks: matched assemblies, DTI strength matching,
and the A490 hot-dip-galvanizing refusal.

**Reasoning:** These classes cover the 30-minute scenario. The three rules create visible,
cited refusals without pretending to encode complete ASTM, RCSC, or AISC practice.
[Shared demo contract](./research/08-demo-options.md#shared-demo-contract),
[specification checks](./RESEARCH.md#products-standards-and-a-demo-ontology).

**Rejected options:** A general fastener or ERP ontology; reproducing whole standards; adding
rules that cannot open a governing source and revision.

### 2026-08-25 — What deletion date governs the lab and corpus?

**Status:** PROPOSED

**Question:** What date should trigger lab disposition and demo-corpus deletion?

**Recommended answer:** Set 2026-09-30 as the delete-or-promote review date. Delete the mutable
demo corpus then unless a consented pilot authorizes a new retention term. Keep authored packet
history and source ledgers.

**Reasoning:** A concrete date makes the disposable lab and machine-local retention promise
testable. The tailnet is an access boundary, not a reason to retain data indefinitely.
[Tailnet and retention proposal](./RESEARCH.md#2026-08-25-open-questions-for-align),
[Option C recommendation](./research/08-demo-options.md#recommendation).

**Rejected options:** No date; deleting the evidence packet; carrying lunch fixtures into a
pilot without a new authorization.

### 2026-08-25 — Who reviews veteran-memory claims in a pilot?

**Status:** PROPOSED

**Question:** Which roles should adjudicate a veteran correction before the system reuses it?

**Recommended answer:** Require the source veteran, an active successor, and the appropriate
technical or commercial authority for the claim. Record the reviewer, valid-from date,
superseded claim, scope, and source.

**Reasoning:** The demo only proves memory when a correction becomes a reviewed, time-bound
claim and changes a later recommendation. A chat transcript alone is not governed memory.
[Temporal-memory case](./research/07-use-case-evaluation.md#3-veteran-mailbox-pst-and-call-notes-to-temporal-memory),
[claim capability](./RESEARCH.md#2026-08-25-in-repo-capability-inventory).

**Rejected options:** Automatic promotion from email; one global rule with no customer or
product scope; indefinite validity.

### 2026-08-25 — How should the draft-only PO closing beat look?

**Status:** PROPOSED

**Question:** How literal should the supplier PO draft look while preserving the no-write rule?

**Recommended answer:** Show a neutral supplier-offer comparison, a PO draft, policy and evidence
checks, approve/edit/reject, and a clearly labeled non-executing receipt. Do not mimic a live
supplier portal or imply submission.

**Reasoning:** This gives the executive a concrete action boundary. The repo has approval
transport models, but no seller write connector, and supplier portal automation can violate
terms.
[PO evaluation](./research/07-use-case-evaluation.md#9-approval-gated-supplier-po-placement),
[supplier-portal constraint](./RESEARCH.md#2026-08-25-constraints-discovered).

**Rejected options:** Hiding the action beat; browser automation; a fake "order placed" success
state.

### 2026-08-25 — What is the paid pilot's first scope and success measure?

**Status:** PROPOSED

**Question:** What bounded pilot should the lunch ask permission to start?

**Recommended answer:** Offer a two- to four-week pilot around one consenting mailbox or PST and
one RFQ class. Measure time to reviewed draft, citation coverage, accepted line matches, rep
edits, missing-field catches, and reuse of reviewed corrections.

**Reasoning:** This replaces synthetic records with one authorized corpus and measures the same
work the lunch story demonstrates. Tenant-wide ingestion and live purchasing would make the
first pilot hard to authorize and hard to measure.
[Research align question 11](./RESEARCH.md#2026-08-25-open-questions-for-align),
[top RFQ case](./research/07-use-case-evaluation.md#top-1-rfq-to-reviewed-quote-request),
[top memory case](./research/07-use-case-evaluation.md#top-3-temporal-veteran-memory).

**Rejected options:** A tenant-wide transformation; a generic chatbot proof; success defined by
demo applause rather than review outcomes.

### 2026-08-25 — What pricing shape should the pilot use?

**Status:** PROPOSED

**Question:** How should the first paid engagement be priced?

**Recommended answer:** Quote a fixed-fee discovery and pilot with named data, workflow, and
measurement boundaries. Price any managed continuation after the baseline shows review volume
and accepted-draft performance. Do not use per-seat pricing.

**Reasoning:** The offer is hands-on source connection, ontology and authority design, claim
review, measurement, and controlled expansion. The research does not establish LeJeune's volume
or a defensible outcome price before discovery.
[Service-as-software thesis](./research/06-landscape-m365-and-competitors.md#5-service-as-software-for-smb--mid-market-distributors),
[research align question 11](./RESEARCH.md#2026-08-25-open-questions-for-align).

**Rejected options:** A SaaS seat subscription; open-ended time and materials with no acceptance
measures; outcome pricing based on an unmeasured baseline.
