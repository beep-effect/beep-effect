# LeJeune Bolt agentic use-case evaluation

Date: 2026-08-25

## Method

Scores run from 1, weak, to 5, strong. The six dimensions are:

- `Value`: time saved times frequency times risk reduced for LeJeune.
- `Wow`: clarity and impact in a 30-minute executive follow-up.
- `Feasibility`: credible in about five working days with the inventoried source.
- `Data`: 5 means public or synthetic data is enough; lower scores require LeJeune systems.
- `Trust`: the action has an obvious evidence trail and human-approval boundary.
- `Paid path`: the demo can grow into a measurable managed service.

Totals are unweighted. When totals tie, the higher rank goes to the use case that better
differentiates this offer from inbox-to-quote vendors. Vendor and ROI numbers remain vendor
claims unless the lane says otherwise. [L6 §1](./06-landscape-m365-and-competitors.md#1-vendors-selling-ai-quoting-rfq-to-quote-email-order-capture-and-portal-ordering-to-distributors).

## Ranked evaluation

| Rank | Candidate use case                                         | Value | Wow | Feas. | Data | Trust | Paid path |  Total |
| ---: | ---------------------------------------------------------- | ----: | --: | ----: | ---: | ----: | --------: | -----: |
|    1 | RFQ email and attachments to a reviewed quote request      |     5 |   5 |     5 |    5 |     5 |         5 | **30** |
|    2 | Cited specification-clarification assistant                |     5 |   5 |     4 |    5 |     5 |         4 | **28** |
|    3 | Veteran mailbox, PST, and call notes to temporal memory    |     5 |   5 |     4 |    3 |     5 |         5 | **27** |
|    4 | MTR and certificate retrieval plus compliance packet       |     5 |   4 |     4 |    4 |     5 |         5 | **27** |
|    5 | Lot and installation-readiness checker                     |     5 |   4 |     4 |    4 |     5 |         4 | **26** |
|    6 | Tool, rental, and repair companion                         |     4 |   4 |     4 |    5 |     5 |         4 | **26** |
|    7 | Account and relationship memory for handoffs               |     4 |   4 |     4 |    3 |     5 |         5 | **25** |
|    8 | Evidence-bearing multi-supplier price, ATP, and lead sweep |     5 |   5 |     3 |    3 |     4 |         5 | **25** |
|    9 | Approval-gated supplier PO placement                       |     5 |   5 |     2 |    2 |     5 |         5 | **24** |
|   10 | Project-aware order and in-transit awareness               |     5 |   4 |     3 |    2 |     4 |         5 | **23** |

### 1. RFQ email and attachments to a reviewed quote request

The agent joins a synthetic Outlook thread, Excel takeoff, and PDF schedule, then extracts the
job, drawing revision, line items, grade, type, style, dimensions, finish, quantity, domestic
rule, certificates, ship-to, need-by date, and requested tools. It shows exact source spans and
asks only for fields the thread did not establish. The public workflow says RFQs arrive in
piecemeal mail and require much more than a unit price; the repo already has mail reads, document
text, span-grounded extraction, and a local bundle pattern. [L3 §1.2](./03-fastener-distribution-process.md#12-what-an-rfq-actually-contains),
[L3 §6](./03-fastener-distribution-process.md#6-how-emails-and-calls-encode-this),
[AISC bolting FAQ](https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/),
[Portland Bolt ordering guide](https://www.portlandbolt.com/technical/faqs/how-to-order-bolts/),
[L4, "Capability-to-demo mapping"](./04-in-repo-capability-inventory.md#capability-to-demo-mapping).

### 2. Cited specification-clarification assistant

The assistant explains why a requested assembly needs compatible nuts, washers, DTI grade, and
installation tools; detects A490 plus hot-dip galvanizing; distinguishes F1852 twist-off from
heavy hex and F3148 TNA; and routes an engineered substitution to approval. Every answer opens
the governing excerpt and source. This is visually strong, fully demonstrable with public
technical material, and harder for generic quoting vendors to fake. It must remain an advisory
and RFI-drafting tool, not an engineer of record. [L3 §2](./03-fastener-distribution-process.md#2-the-spec-clarification-job),
[AISC bolting FAQ](https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/),
[RCSC 2020 specification](https://www.boltcouncil.org/files/2020RCSCSpecification.pdf).

### 3. Veteran mailbox, PST, and call notes to temporal memory

A veteran's correction becomes a reviewable claim such as "this customer means melt,
manufacture, and coat in the U.S. when the RFQ says domestic." The graph keeps the source,
reviewer, valid-from date, confidence, and superseded rule, then applies the approved correction
to the next RFQ. This directly answers the retirement risk and distinguishes the demo from
transaction-only competitors. Real value requires consented LeJeune data, so the five-day demo
uses synthetic messages and one synthetic call note; a paid pilot can replace them with one
authorized mailbox or PST. [L3 §5](./03-fastener-distribution-process.md#5-pain-points-and-tacit-knowledge-retiring-veterans-carry),
[L6 §4](./06-landscape-m365-and-competitors.md#4-knowledge-graph--agent-memory-products-and-the-tacit-knowledge-from-email-story),
[Graphiti](https://github.com/getzep/graphiti).

### 4. MTR and certificate retrieval plus compliance packet

The agent connects each order or shipment line to its heat-level MTR, finished-product CoC,
assembly test report, RoCap record, lot tag, and origin statement, then lists missing evidence.
This has strong risk-reduction and paid-service potential and can use a small local PDF fixture
set. It ranks below veteran memory only because certificate assembly is less distinctive in the
competitive field. [L3 §1.8](./03-fastener-distribution-process.md#18-mtrs-cocs-lot-control),
[Fastenal MTR availability](https://crafter.fastenal.com/static-assets/pdfs/Fastenal-MTR-Availability.pdf),
[FHWA bolting Q&A](https://www.fhwa.dot.gov/bridge/boltsqa.cfm).

### 5. Lot and installation-readiness checker

Before release, the agent checks matched assemblies, mixed lots, factory lubrication, extra
verification assemblies, DTI grade, Skidmore or bushing requirements, and tool compatibility.
It returns blockers and cited remedies rather than a generic green check. The public data is
enough for rules, but useful execution needs LeJeune lot and project records. [L3 §2.5, §2.8,
and §2.10](./03-fastener-distribution-process.md#25-install-tools-the-rfq-forgets),
[FHWA bolting Q&A](https://www.fhwa.dot.gov/bridge/boltsqa.cfm).

### 6. Tool, rental, and repair companion

The quote assistant adds the compatible shear wrench or TNA tool, socket, calibrator, rental
window, verification extras, and a repair swap when the RFQ implies field installation. It is a
simple cross-sell with strong public data and an obvious human check. The paid path is narrower
than the top cases, but the demo can make the order feel specific to LeJeune rather than to a
generic industrial catalog. [L1 §3](./01-lejeunebolt-site-mining.md#3-service-and-process-signals),
[tool portfolio](https://lejeunebolt.com/tool-portfolio/),
[rentals](https://rentals.lejeunebolt.com/), [repair](https://lejeunebolt.com/repair/).

### 7. Account and relationship memory for handoffs

The graph preserves customer channel preferences, recurring specifications, supplier exceptions,
inspection habits, open promises, and the evidence behind them. A successor can ask why an
account receives a certain assembly or shipping pattern. The value is real, but data availability
is the constraint: public pages cannot prove customer-specific preferences, and general agent
memory must exclude private contact and finance fields. [L3 §5](./03-fastener-distribution-process.md#5-pain-points-and-tacit-knowledge-retiring-veterans-carry),
[L1 §10](./01-lejeunebolt-site-mining.md#10-gaps-and-verification-queue).

### 8. Evidence-bearing multi-supplier price, ATP, and lead sweep

The agent compares two or three timestamped supplier offers by price, available-to-promise,
split quantity, mill lead, pack size, origin, coating, certificates, freight, and expiry. The
five-day version uses synthetic supplier replies or an authorized local CSV. Current portal
scraping is neither supported by the repo nor safe under supplier terms. [L3 §1.4-§1.5](./03-fastener-distribution-process.md#14-quoting-what-the-distributor-promises),
[Epicor fastener distribution](https://www.epicor.com/en-us/solutions/industries/distribution/fastener-distribution-software/),
[Grainger terms](https://www.grainger.com/content/terms-of-access).

### 9. Approval-gated supplier PO placement

After the rep selects an offer, the agent generates a supplier PO draft, shows policy checks and
evidence, records approve/edit/reject, and emits a non-executing receipt. This has high business
value and wow factor, but no seller write connector exists and HTML portal automation can violate
terms. A real engagement must use a supplier-approved API, punchout, or EDI path. [L6 §6.2-§6.3](./06-landscape-m365-and-competitors.md#62-supplier-portal-terms-of-service-vs-automated-ordering),
[Fastenal terms](https://www.fastenal.com/fast/legal-information),
[Minnesota punchout instructions](https://osp.admin.mn.gov/sites/osp/files/pdf/t-572%285%29.pdf).

### 10. Project-aware order and in-transit awareness

The agent answers what is quoted, approved, ordered, allocated, shipped, backordered, certified,
and still missing by project, release, sequence, package, and lot. It maps well to LeJeune's
published sequencing and timed-delivery work, but M365 alone is unlikely to hold authoritative
shipment state. The unknown ERP, carrier, and supplier systems make this a paid-pilot use case,
not a five-day hero. [L1 §3](./01-lejeunebolt-site-mining.md#3-service-and-process-signals),
[110 North Wacker](https://lejeunebolt.com/portfolio-items/110-north-wacker/),
[American Airlines Hangar](https://lejeunebolt.com/portfolio-items/american-airlines-hanger-2-ohare/).

## Top three

### Top 1: RFQ to reviewed quote request

This is the best entry because executives recognize the work immediately, competitors validate
the budget category, and the local source already covers most of the non-domain plumbing. The
demo earns trust by recovering missing fields, showing every source span, and refusing to send
anything. It also creates the measurement for a pilot: time to a reviewed draft, missing-field
catches, accepted line matches, and rep edits.

### Top 2: cited specification clarification

This is where the demo stops looking like an inbox parser. One prohibited coating, wrong DTI,
or missing companion tool makes the graph and evidence visible in business terms. The public
technical corpus is sufficient for a strong fixed scenario, while the approval boundary makes
the trust model legible. It should draft an explanation or RFI, never claim final engineering or
project-compliance authority.

### Top 3: temporal veteran memory

This is the strategic reason to build rather than buy a generic quote-entry tool. The executive
sees a correction survive the person who supplied it, with source, review, validity, and
supersession. It is also the strongest path to a managed service: connect one authorized mailbox,
adjudicate claims with veterans, measure reuse, and expand by account or product family. The
demo must be honest that the real corpus is unavailable until consent.

## Exact 30-minute demo storyline

| Time        | What the executive sees                                                                                                                                                                | Use case proved            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 00:00-02:00 | A tailnet-only LeJeune-branded home screen states the fixed data boundary: public corpus plus synthetic Office records, all local.                                                     | Trust frame                |
| 02:00-05:00 | A synthetic Outlook thread, Excel takeoff, and PDF schedule enter one project inbox. The screen shows document hashes and source dates.                                                | RFQ ingest                 |
| 05:00-09:00 | Parsed quote lines appear beside highlighted source spans. The agent groups piecemeal messages and flags missing Type, finish, assembly, and need-by facts.                            | RFQ structure              |
| 09:00-12:00 | The executive opens one missing-field question and sees why the system asked it rather than guessing.                                                                                  | Trust and approval         |
| 12:00-16:00 | A rule check catches A490 plus hot-dip galvanizing and a mismatched DTI. The answer opens the AISC/RCSC or supplier source and drafts an RFI.                                          | Spec clarification         |
| 16:00-20:00 | Two synthetic supplier replies become comparable offers with split ATP, lead time, domestic status, certs, freight, and expiry. Each cell links to its reply.                          | Sourcing context           |
| 20:00-23:00 | The agent proposes the quote, companion tool, verification extras, and certificate package. The rep edits one line and approves the draft.                                             | Reviewed quote             |
| 23:00-26:00 | A veteran note corrects what one customer's word "domestic" means. The executive approves the claim and sees its source, valid date, and superseded predecessor.                       | Veteran memory             |
| 26:00-28:00 | The same RFQ reruns. The approved correction changes the compliance warning, with a visible before/after explanation.                                                                  | Memory reuse               |
| 28:00-30:00 | A supplier PO draft appears. The system stops before submission, records the approval decision, and names the next paid pilot: one mailbox, one RFQ class, measurable review outcomes. | Safe action and engagement |

If M365 consent or a model provider fails, the same scenario runs from the fixed local bundle.
No live portal, current supplier price, or real LeJeune correspondence is required for the lunch.
