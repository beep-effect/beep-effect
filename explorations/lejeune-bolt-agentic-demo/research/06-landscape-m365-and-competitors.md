# Landscape: Microsoft 365 ingest, quoting automation, and knowledge-graph memory for a fastener distributor

**Packet:** `explorations/lejeune-bolt-agentic-demo`
**Access date for all live sources:** 2026-08-25
**Brief:** LeJeune Bolt Company (Minnesota structural fastener distributor; public site [lejeunebolt.com](https://lejeunebolt.com/)). Jackson LeJeune described a day of email/call RFQs → manufacturer/seller lookup → portal order placement → spec explanation. Microsoft 365 is the system of record. Veterans are retiring. The intended demo is local ingest of office data → fastener knowledge graph + agent memory → agents that quote / source / order / specify **with human approval**. See [`CAPTURE.md`](../CAPTURE.md).

**How claims are marked**

- Every factual claim carries a URL or a repo `path:line`.
- **VENDOR-CLAIMED** = the vendor or a vendor press release said it; not independently audited here.
- **UNVERIFIED** = not confirmed from a primary page, GitHub API, Microsoft Learn, or in-repo source in this pass.
- Numbers from aggregators (ITQlick, ERP Research, Prospeo, PitchBook snippets) are labeled as such.
- No invented URLs, names, or funding figures. No personal contact details beyond what a company publishes on its own site.

---

## 1. Vendors selling AI quoting, RFQ-to-quote, email-order capture, and portal ordering to distributors

The market that maps onto Jackson’s day is **not** generic CPQ. It is: unstructured inbound (email / PDF / spreadsheet / photo / text) → line-item extract → catalog / cross-reference match → customer-specific price and ATP → draft quote or ERP order → **rep approval**. A second, older layer is template/EDI order capture (Conexiom, Esker). A third layer is manufacturer/master-distributor **portals** that the fastener house logs into as a *buyer*.

### 1.1 Fastener-specific quoting (highest relevance)

| Vendor | What they sell | Funding / stage | Pricing signal | Named proof | Human-in-the-loop |
| --- | --- | --- | --- | --- | --- |
| **BoltWise** ([getboltwise.com](https://getboltwise.com)) | AI quoting + PO automation + supplier library for fastener / MRO / PVF distributors. ERP write-back to Epicor Prophet 21, INxSQL, The Business Edge. | Seed. Denver Business Journal (reprinted): **$3M** seed, Form D 2024-07-25; $1M of that was 2023 pre-seed SAFE. Lead Range Ventures; Bienville, SpringTime, Sarah Smith Fund, Service Provider Capital. ([company reprint](https://getboltwise.com/blog/denver-company-raked-in-3m-to-bring-ai-to-industrial-procurement)) | Custom after demo. ([BoltWise vs Conexiom](https://getboltwise.com/boltwise-vs-conexiom)) | Computer Insights / The Business Edge partnership: 100-line quotes “hours → minutes.” ([ci-inc.com](https://www.ci-inc.com/testimonials/transforming-fastener-distribution-through-innovation/)) | Rep verifies matched parts, then “Send to The Business Edge.” |
| **Soff** ([soff.ai](https://soff.ai)) | AI quoting; email-routed RFQs; customer-priority queues. | UNVERIFIED (no primary funding page confirmed this pass) | UNVERIFIED | Search-indexed case study: **Fastener Dimensions** (aerospace fasteners), ~1,500 weekly RFQs, quoting headcount 10, **quote throughput doubled**, no added headcount. Live scrape of that URL returned **404** on 2026-08-25 — treat as **VENDOR-CLAIMED / UNVERIFIED until the page is live**. Indexed URL: [soff.ai/blog/how-fastener-dimensions-uses-soff-to-double-quote-throughput](https://soff.ai/blog/how-fastener-dimensions-uses-soff-to-double-quote-throughput) | Email routing + prioritization; humans still send offers. |

BoltWise is the closest named competitor to a LeJeune lunch pitch. Cole Weiler (CEO) is quoted on why fasteners are the hard case: “for fasteners, companies could easily be buying more than 10,000 unique parts that can be as cheap as fractions of a cent.” ([same DBJ reprint](https://getboltwise.com/blog/denver-company-raked-in-3m-to-bring-ai-to-industrial-procurement)) Vendor match-rate claims (95%+ PO matching, 90%+ on matchable descriptions) are **VENDOR-CLAIMED** on comparison pages. ([BoltWise vs Proton](https://getboltwise.com/boltwise-vs-proton-ai)) Tracxn/Prospeo later-round figures ($2.5M Sep 2025; $6.5M total) **conflict with each other** and are **UNVERIFIED** third-party estimates.

Adjacent fastener ERPs (not RFQ-AI products): [Ximple fastener distribution](https://www.ximplesolution.com/industries/fastener-distribution-software/), [10X ERP fasteners](https://10xerp.com/industries/fasteners) (claims “AI built in” with approval/undo — **VENDOR-CLAIMED**), UK [OGL fasteners ERP](https://www.ogl.co.uk/industries-erp-software/fasteners-fixings).

### 1.2 Distributor RFQ-to-quote / order-entry AI (horizontal)

**Proton.ai** (Cambridge, MA) — the most visible “AI OS for distributors.”

- Product: CRM + PIM + eCommerce AI + **Order & Quote Entry Automation** GA **2026-07-21**. Agents draft quotes, follow up, source substitutes; **reps approve every quote before it reaches the customer**. ([Proton launch post](https://www.proton.ai/blog/proton-ends-rekeying-era-with-agentic-order-quote-entry-automation); [Distribution Strategy Group](https://distributionstrategy.com/2026/07/proton-ai-launches-ai-platform-to-automate-order-and-quote-entry-for-distributors/))
- Funding: **$20M Series A**, 2022-01-18, led by Felicis Ventures; Battery also named on jobs pages. ([GlobeNewswire](https://www.globenewswire.com/news-release/2022/01/18/2368707/0/en/Proton-ai-Raises-20M-Series-A-Led-by-Felicis-Ventures.html); [CB Insights](https://www.cbinsights.com/company/protonai))
- Named customers: **Building Products Inc.** (Midwest lumberyard wholesaler) on the launch; **Replenex** president Matt Cohen on the homepage. ([Proton](https://www.proton.ai/))
- **VENDOR-CLAIMED** PoV vs an unnamed “one of North America’s largest industrial distributors”: 3× better on description-only lists than the in-house cross-reference; list prep time −75%. DSG notes Proton did not name the distributor and results were **not independently verified**. ([DSG](https://distributionstrategy.com/2026/07/proton-ai-launches-ai-platform-to-automate-order-and-quote-entry-for-distributors/))
- Other **VENDOR-CLAIMED** metrics on the product page: 15 min → 60 s per quote; 90% match-rate; 85% first-time match on cross-refs; 60–80% cost-per-order reduction. ([proton.ai/order-and-quote-entry](https://www.proton.ai/order-and-quote-entry))
- Pricing: not public. 2022 press: “~700,000 wholesale distributors in the US, 32,000 doing more than $10M.” ([GlobeNewswire](https://www.globenewswire.com/news-release/2022/01/18/2368707/0/en/Proton-ai-Raises-20M-Series-A-Led-by-Felicis-Ventures.html))

**Prokeep** — conversation-first “Order Engine” for wholesale / construction distributors (text + email + photo + PDF).

- AI Order Automation: RFQ → ERP inventory check → send-ready quote “in under 60 seconds.” **VENDOR-CLAIMED**. ([prokeep.com/order-automation-launch](https://www.prokeep.com/order-automation-launch))
- Pricing: **per branch location**, not per seat; custom quote; Pro tier includes Order Automation; Elite adds segmentation. “Unlimited users / contacts / messages.” ([prokeep.com/pricing](https://www.prokeep.com/pricing))
- Named proof (vendor case studies): **Auer Steel**; **Johnstone Supply** (“After a broadcast? We’d do between $60K and $100K”); **Green Mountain Electric Supply** (+142% purchases YoY); **J.J. Nichting**. ([prokeep.com/order-engine](https://www.prokeep.com/order-engine); [AI OA page](https://www.prokeep.com/prokeep-ai-order-automation-for-distribution-sales-teams))
- “8,500+ distributors” / “20 million more orders” are **VENDOR-CLAIMED**. Funding: **UNVERIFIED** this pass.

**Mercura** (YC W25; Munich / SF) — AI quote and order automation for construction-supply distributors and manufacturers (HVAC, electrical, plumbing). Email-body + attachment RFQ extract → product match → ERP populate.

- Funding: **$2.1M seed** announced 2025-12-29 (SignalFire, YC, others); earlier ~$500K YC; secondary total **~$2.6M**. ([Signalbase](https://www.trysignalbase.com/news/funding/mercura-secures-21m-seed-round); [YC company page](https://www.ycombinator.com/companies/mercura); [startupintros](https://startupintros.com/orgs/mercura))
- “60+ distributors and manufacturers” is **VENDOR-CLAIMED**. ([mercura.ai](https://www.mercura.ai/))
- Pricing: not public.

**Canals** (Miami) — “AI operating system” for wholesale distributors (quotes, orders, invoices, POs). Secondary report: **$35M Series A** led by Base10 Partners (2026-06), “dozens of customers including Regency Supply and Kendall Group,” “8 million sales orders and $5 billion in payables.” **VENDOR/PRESS — not independently verified here.** ([TAMradar](https://www.tamradar.com/funding-rounds/canals-series-a-35m))

**ChannelFlex** (Chicago, founded 2025, 2–10 people) — inbox-forward RFQ → catalog match + confidence score → rep review. Claims 90%+ line-item match, live in 2–4 weeks. **No named customers, no public funding, no public price.** Treat as early-stage. ([channelflex.com](https://channelflex.com/); [quoting page](https://channelflex.com/ai-powered-quoting-distributors/); [LinkedIn](https://www.linkedin.com/company/channelflex))

**Distro** ([distro.app](https://distro.app/blog/distro-autobid-intelligent-order-entry-and-quoting-automation-engine-that-transforms-quoting-from-hours-to-minutes)) — HVAC / plumbing / electrical quoting + takeoffs. **VENDOR-CLAIMED** positioning vs Canals. Funding/pricing **UNVERIFIED**. Do not confuse with Distro.io (hiring ATS).

**Aginera** — PO/RFQ inbox monitor for electrical / industrial suppliers (ABB, Siemens, Schneider examples). Pricing **UNVERIFIED**. ([aginera.ai/solutions/automated-quoting](https://aginera.ai/solutions/automated-quoting))

**WizCommerce “Ella”**, **HireSeals / seals.ai**, **Flow RMS**, **Ziffity Ace** (NAED blog): more inbox-to-quote/order tools. Treat marketing metrics as **VENDOR-CLAIMED**. ([wizcommerce roundup](https://wizcommerce.com/blog/top-ai-order-entry-automation-software/); [NAED / Ziffity](https://blog.naed.org/the-business-case-for-ai-in-electrical-distribution); [hireseals.ai](https://hireseals.ai/))

### 1.3 Email / document order capture (inbound PO, not outbound quote)

These products solve Jackson’s *order-in* problem more than the *quote-out* problem. Still relevant: many fastener customers send POs as PDFs.

**Conexiom** (Vancouver; founded 2005)

- AI capture of emailed POs (PDF, Excel, text, handwritten) → ERP-ready sales orders. Native Epicor **Prophet 21 and Eclipse**. ([conexiom.com/platform](https://conexiom.com/platform))
- Funding: **$170M** total; last round **$130M** PE (ICONIQ, Warburg Pincus, Luminate). ([CB Insights](https://www.cbinsights.com/company/conexiom))
- SAP Store **Commercial Edition: USD 30,000/year + USD 20,000 setup**, 1-year minimum. Enterprise “price upon request.” ([SAP partner listing](https://www.sap.com/products/scm/partners/ecmarket-inc-conexiom-ai-order-automation-for-sap-s4hana.html))
- **VENDOR-CLAIMED:** 3,500+ deployments; 1B+ line items/year; 80%+ touchless. G2 reviewer: “a bit pricey.” ([GetApp](https://www.getapp.com/operations-management-software/a/conexiom/))

**Esker** — enterprise order-to-cash. Email + EDI + portal + punchout intake; AI extract + ERP validate; exception queues.

- **VENDOR-CLAIMED** impact stats: 92% less manual entry, 5× faster processing, 3× fewer errors. Named: **Suntory/Schweppes**, **NVIDIA** (60× faster repeat orders, 3× growth, no added headcount), **FUCHS Lubricants**. ([esker.com/solutions/order-management](https://www.esker.com/solutions/order-management/))
- Pricing: enterprise, not public. Implementation typically months (competitor roundups).

**Workist** (Berlin; formerly outsmart.ai)

- Inbox → ERP order agent; template-free. Funding **$11.72M** (Series A ~$8.99M, 2022-09-20, Earlybird / 468 Capital / LEA). ([CB Insights](https://www.cbinsights.com/company/workist/financials))
- Named: **EVG** (electromechanical distributor, Duisburg) 4.5 min → 16 s (**96%** time save) — **VENDOR CASE**. **Primavera**, **Wero** (6,000 docs/quarter, 43 days saved), **Microbiologics**. ([workist.com/en/success-stories/evg](https://www.workist.com/en/success-stories/evg))
- Humans handle exceptions; “AI learns from every interaction.” ([workist.com/en/order-management-software](https://www.workist.com/en/order-management-software))

**Rossum**, **Hypatos**, others: extraction gateways, not distributor quoting. Useful as a component, not the lunch story.

**Epicor AutoOrder** (Prophet 21 add-on): inbound customer POs in native formats → structured docs into P21 without rekeying. ([top10erp.org P21 additional capabilities](https://www.top10erp.org/products/epicor-prophet-21/additional-capabilities))

### 1.4 Supplier / dealer portals (the other half of Jackson’s day)

Jackson **logs into seller systems and places orders**. That is the opposite direction from Conexiom.

- **Aleran**: ERP-connected CPQ + dealer/distributor self-service portals (Epicor, SAP, Infor CSI). **VENDOR-CLAIMED** 30–50% CSR workload reduction on repeat inquiries. ([aleran.com](https://www.aleran.com/))
- **PunchOut** (cXML / OCI) is the *legitimate* automated-ordering path on Grainger, Fastenal, MSC, etc. Minnesota NASPO contract T-572(5) instructs state agencies to use punchout for Fastenal, Grainger, MSC. ([osp.admin.mn.gov PDF](https://osp.admin.mn.gov/sites/osp/files/pdf/t-572%285%29.pdf))
- **Do not bot the HTML portal.** Grainger Terms of Access (revised 2025-10-21) prohibit retrieve/index/scrape/data-mine “including through use of any robot, spider, screen scraping…” and require compliance with robots.txt. ([grainger.com/content/terms-of-access](https://www.grainger.com/content/terms-of-access))
- Fastenal documents a **Supplier Portal** for vendors selling *to* Fastenal, plus optional EDI/fax/email commerce “if Fastenal and Purchaser agree.” ([fastenal.com/fast/legal-information](https://www.fastenal.com/fast/legal-information)) That is not a license to script Fastenal.com as a customer.

**Implication for the demo:** show a *draft purchase order* and a human “place this on the supplier portal” step — never a silent login bot.

### 1.5 What this category does *not* cover well

None of these vendors advertise **“ingest 20 years of Outlook + Teams + SharePoint from retiring veterans into a local knowledge graph, then quote with citations.”** They automate the *transaction*. The tacit “why you need these fasteners in addition to the bolts to install the beams” lives in mail, call notes, and heads. That gap is the wedge.

---

## 2. Distributor-ERP AI features

LeJeune’s ERP is **unknown** from the capture (M365 is the stated system of record). These are the four stacks a mid-size industrial distributor is most often already on, plus what their AI actually does.

### 2.1 Epicor Prophet 21

P21 is the North American wholesale-distribution ERP. Strengths called out by third-party reviews: customer-specific / contract / matrix pricing, multi-warehouse, drop-ship, special order. ([Softabase 2026 review](https://softabase.com/software/erp/epicor-prophet-21))

**Pricing (not Epicor list — aggregators disagree):**

| Source | Signal |
| --- | --- |
| [ITQlick 2026](https://www.itqlick.com/epicor-prophet-21/pricing) | “starts at $200 per user/month”; 10-user 1st year **$38k–$148k+** including $20k–$100k onboarding |
| [ERP Research](https://www.erpresearch.com/pricing/epicor-prophet-21) | ~$1,000/mo platform + **$100–$175/user/mo**; TCO $60k–$300k; impl. 3–7 months |
| Softabase | Cloud **$200–$400/user/mo**; 25–50 user all-in **$150k–$500k** |

Treat these as **market hearsay**, not a quote.

**AI:**

- **Epicor Prism Business Communications** (2025-09-03): ERP AI agent on **email** (no new portal). Multi-supplier RFQ handling, quote comparison, suggested next steps. **Outcomes-based pricing: users only pay for RFQs that convert to purchase orders.** Named: Jason Bassett, IT Manager, **Madsen’s Custom Cabinets** — “convert an email conversation with a supplier into a purchase order at the click of a button.” Initially announced for **Epicor Kinetic**. ([Business Wire](https://www.businesswire.com/news/home/20250903859301/en/Epicor-Launches-Industrys-First-ERP-AI-Agent-with-Outcomes-Based-Pricing-to-Accelerate-Supplier-Decisions))
- 2026-08-21: Epicor says Prism is **embedded in Kinetic and Prophet 21** for LATAM GA. ([Business Wire related item on same page](https://www.businesswire.com/news/home/20260821770826/en/Epicor-Prism-Launches-Across-Latin-America-Bringing-Embedded-Industry-Specific-AI-to-Manufacturers-and-Distributors))
- **AutoOrder** (above): inbound PO capture into P21.
- Final on-prem feature release for P21: **2028.1** (tentatively May 2028); active on-prem support through **2029-06-30** (ERP Research citing Epicor Jan 2026). **UNVERIFIED against Epicor’s own announcement page this pass.**

**Gap vs the lunch demo:** Prism helps *buy-side* RFQ email into the ERP. It does not mine 15 years of a retiring estimator’s mailbox for “this job at U.S. Bank Stadium used X anchor because Y.”

### 2.2 Infor (CloudSuite Distribution / CSI / Coleman → Velocity)

- **Coleman AI** (2018 platform): NLP in Infor apps; “Coleman, create a requisition for item 4321.” ([Infor announcement](https://www.infor.com/news/infor-announces-coleman-ai-platform))
- **Combilift** (parts quoting in CloudSuite Industrial): 3 years of quote history → Coleman recommends related parts in the Parts Estimator. **VENDOR-CLAIMED:** 20 min → 5 min (−75%), +30% first-time-fix, +30% revenue/transaction, −40% service job cost, <60 days to production. ([Infor Nordics blog](https://www.infor.com/nordics/blog/innovation-showcase-how-to-increase-equipment-uptime-and-customer-service-with-ai-driven-part-recommendations); Constellation write-up of same case)
- **Turtle** (large US electrical distributor) + Infor data-science pricing widget in CloudSuite Distribution order-entry: **+1.3% gross margin**, item pricing **98% faster**; Magee also cited ~$700k new revenue / ~$500k margin at launch (podcast, numbers “not updated in about two months”). ([TechTarget](https://www.techtarget.com/enterprise-software/podcast/How-a-distributor-used-AI-driven-dynamic-pricing-for-quick-ROI); [Infor Velocity blog](https://www.infor.com/blog/the-agentic-enterprise))
- April 2026 CloudSuite Distribution: Industry AI Agents + Agentic Orchestrator, MCP server into Infor apps. ([Infor blog](https://www.infor.com/blog/infor-cloudsuite-distribution-april-2026-release))
- **Team Air Distributing**: three agents in <2 weeks (credit, inventory across 18 branches, onboarding); credit Qs 15–20 min → <1 min. ([Infor](https://www.infor.com/blog/team-air-distributing-agentic-enterprise-infor))
- Velocity Suite: **VENDOR-CLAIMED** “flat subscription — agents, orchestration, and managed services included, no consumption pricing cliff.” ([Infor](https://www.infor.com/blog/the-agentic-enterprise))

### 2.3 SAP (Joule, CPQ, Intelligent Product Recommendation)

- **Deal Closing Assistant** + **Sales Quoting Agent** + **Sales Pricing Agent**: automate quote creation, pricing validation, order from accepted quotes. ([sap.com/use-cases/joule-assistant/deal-closing-ai](https://www.sap.com/use-cases/joule-assistant/deal-closing-ai))
- Sapphire 2026: Deal Closing Assistant “can automate quotes and pricing and facilitate orders through closing”; CX assistants GA planned Q2 2026. ([SAP Sapphire 2026 news guide](https://www.sap.com/topics/events/sapphire/innovation-news-guide-2026))
- **SAP Intelligent Product Recommendation**: extract customer needs from unstructured text (email, Word) and recommend configurations into SAP CPQ / Commerce / Sales Cloud. ([sap.com product page](https://www.sap.com/products/crm/intelligent-product-recommendation.html))
- **SAP CPQ** remains the configured-product quoting engine; Gartner MQ Leader 2026-01-22 (SAP cites Gartner). External (dealer/distributor) users: published **CAD 34.00 / user / month** on the Canadian store page — currency-local list, not a US quote. ([SAP CPQ](https://www.sap.com/canada/products/financial-management/cpq.html))
- Ceratizit **AIQuote** (in-house, SAP-backed): scan inbound mail, create quotations/orders in SAP; target ~40% of quotations autonomous. **Internal industrial manufacturer**, not a distributor SaaS. ([Luxinnovation](https://luxinnovation.lu/news/aiquote-ceratizit-s-ai-at-the-service-of-b2b-quotes))

Mid-size US fastener houses are more often on P21 / Infor / Business Edge than S/4 + Joule. SAP is the ceiling, not the lunch default.

### 2.4 Microsoft Dynamics 365 Copilot (Sales + Supply Chain + Business Central)

**Dynamics 365 Sales / Supply Chain agents** (Ignite 2024 onward; Wave 1 2026 expansion):

- **Sales Qualification Agent**, **Sales Order Agent** (D365, not the same as BC), **Supplier Communications Agent** (reads vendor email, matches POs, extracts confirmations/delays). ([ZDNet](https://www.zdnet.com/article/microsoft-introduces-ten-ai-agents-for-sales-finance-supply-chain-in-dynamics-365/); [Dr Dynamics inventory](https://www.drdynamics.co.uk/blog/every-microsoft-first-party-ai-agent-in-dynamics-365))
- **Procurement Agent** in D365 SCM: public preview as of Microsoft’s 2026-04-16 manufacturing blog. ([Microsoft Dynamics blog](https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2026/04/16/becoming-a-frontier-manufacturing-firm-agentic-decisions-across-the-manufacturing-value-chain/))
- **Sales agent in Microsoft 365 Copilot**: GA; Outlook/Teams/D365; grounded in CRM + Graph. ([Microsoft 365 Copilot Sales agent](https://learn.microsoft.com/en-us/microsoft-sales-copilot/use-sales-chat); [2026-07-07 Dynamics blog](https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2026/07/07/moving-sales-and-service-organizations-forward-with-agentic-cx-and-microsoft-365-copilot/))

**Business Central Sales Order Agent** (closest Microsoft analog to Proton for SMB):

- Monitors a **shared mailbox**; identifies customer; drafts quote PDF; **user review before send**; converts to order on confirmation. Attachment (PDF/image) processing added in 2025 Wave 1. Config can skip customer quote confirmation for recurring accounts. ([BC Sales Order Agent process](https://learn.microsoft.com/en-us/dynamics365/business-central/sales-order-agent-process); [setup: quote vs order gates](https://learn.microsoft.com/en-us/dynamics365/business-central/sales-order-agent-setup); [preview blog 2025-04-03](https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2025/04/03/sales-order-agent-in-microsoft-dynamics-365-business-central-now-in-public-preview/))
- Billing: Copilot Studio messages (consumption). ([overview](https://learn.microsoft.com/en-nz/dynamics365/business-central/sales-order-agent))

**Licensing (2026 aggregator of Microsoft list pages, not a quote):** Sales Professional $65 / Enterprise $105 / Premium $150; SCM $210 / Premium $300; Premium SKUs include **1,000 Copilot Credits per user/month**. ([AlphaVima 2026 guide](https://alphavima.com/blog/dynamics-365-licensing-guide/); Microsoft licensing PDF referenced via [fwlink](https://go.microsoft.com/fwlink/?LinkId=866544)) Agents that run autonomously draw **Copilot Credits**. Treat dollar figures as **list-price signals**.

**Copilot in M365 is not a fastener quoting engine.** MDM’s 2025 survey of sub-$100M distributors: Copilot used for Excel, legal replies, marketing, chatbots — almost nobody using it for pricing/quoting. 27% of (broader) distributors ranked pricing/margin #1 AI investment; 73% expect ≥2% margin lift from pricing AI. ([mdm.com](https://www.mdm.com/article/technology/ai/the-hidden-majority-your-ai-is-writing-emails-your-competitors-ai-is-finding-margin/))

---

## 3. Microsoft 365 Graph surfaces for a local-first ingest demo

In-repo brick: `@beep/m365` is a **Graph v1.0 read-only delegated driver**. Default scopes: `offline_access`, `User.Read`, `Files.Read.All`, `Sites.Read.All`, `Mail.Read`, `Calendars.Read`. Write scopes (`Mail.Send`, `Files.ReadWrite.All`, …) are reserved and **never requested in v1**. ([`packages/drivers/m365/src/M365.config.ts:113-146`](../../../packages/drivers/m365/src/M365.config.ts)) Service methods include `listMessages`, `getMessage`, `deltaDriveItems`, `downloadDriveItemContent`, `listEvents`, `getEvent`, `listSites`, `listDrives`. **No** Chat, transcripts, contacts, MIME `$value`, or Copilot Retrieval in the v1 shape. ([`M365.service.ts:791-807`](../../../packages/drivers/m365/src/M365.service.ts), [`listMessages` 1142-1149](../../../packages/drivers/m365/src/M365.service.ts))

### 3.1 Mail — delta, MIME, attachments

| Capability | Endpoint / note | Permissions (least privileged) |
| --- | --- | --- |
| Incremental mailbox sync | `GET /me/mailFolders/{id}/messages/delta` (also `/users/{id}/…`). Tokens: `@odata.nextLink` / `@odata.deltaLink`. `$filter` only `receivedDateTime ge/gt`. No `$search`. | Delegated: `Mail.ReadBasic` (least) / `Mail.Read`. Application: `Mail.ReadBasic.All` / `Mail.Read`. ([message: delta](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0)) |
| Full MIME of a message | `GET /me/messages/{id}/$value` | Same mail-read family. ([Get MIME content](https://learn.microsoft.com/en-us/graph/outlook-get-mime-message)) |
| List attachments | `GET /me/messages/{id}/attachments` | ([list attachments](https://learn.microsoft.com/en-us/graph/api/message-list-attachments?view=graph-rest-1.0)) |
| Raw attachment bytes | `GET /me/messages/{id}/attachments/{id}/$value` — file = original bytes; itemAttachment message = MIME; reference attachments → HTTP 405. ([attachment-get](https://learn.microsoft.com/en-us/graph/api/attachment-get?view=graph-rest-1.0)) | |
| Group *conversations* | **No** `$value` MIME for M365 Group posts. Structured body + attachments only. ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5881925/mime-content-access-for-group-mailboxes-via-micros)) | |

**Local-first pattern:** delta per folder (Inbox, Sent, project folders) → persist ids locally → `$value` or `getMessage` + attachment `$value` onto disk → never log bodies (the beep driver already forbids logging mail bodies: [`M365.service.ts:4-7`](../../../packages/drivers/m365/src/M365.service.ts)).

`Mail.Read` **delegated**: `AdminConsentRequired` = **No** on the permissions reference — but tenant **consent policies** can still force admin approval. Microsoft’s recommended user-consent policy has been moving Mail.*, Calendars.*, Chat.*, OnlineMeetings.* onto the admin-consent list (Message Center / Entra managed policy updates 2025–2026). ([permissions reference Mail.Read](https://learn.microsoft.com/en-us/graph/permissions-reference); [MC1304287 Exchange consent](https://mc.merill.net/message/MC1304287); [Q&A on managed policy](https://learn.microsoft.com/en-us/answers/questions/5572742/clarification-on-mc1163922)) **Application** `Mail.Read` is tenant-wide, **admin consent required**, and should be mailbox-restricted with an [application access policy](https://learn.microsoft.com/en-us/graph/permissions-reference) — inappropriate for a lunch demo.

### 3.2 Teams chat and meeting transcripts

| Surface | Notes | Consent |
| --- | --- | --- |
| Chat messages | `Chat.Read` **delegated** (user’s 1:1/group chats). `Chat.Read.All` is **application only**, admin consent. Teams Export APIs for bulk: `Chat.Read.All` + `ChannelMessage.Read.All` + `User.Read.All`. ([Teams export](https://learn.microsoft.com/en-us/microsoftteams/export-teams-content); [Chat.Read](https://learn.microsoft.com/en-us/graph/permissions-reference)) | Chat.Read delegated: AdminConsentRequired **No** (policy may override). Export APIs: **admin**. |
| Meeting transcripts | `callTranscript` resource; `GET …/onlineMeetings/{id}/transcripts` + content. Delta-by-organizer exists. ([callTranscript](https://learn.microsoft.com/en-us/graph/api/resources/calltranscript?view=graph-rest-1.0)) | `OnlineMeetingTranscript.Read.All`: **AdminConsentRequired Yes for both application and delegated**. ([permissions notes](https://learn.microsoft.com/en-us/answers/questions/5543644/graph-api-get-all-transcripts-list-why-we-need-adm)) |
| Evaluation quota | Transcript content APIs: **600 minutes per month per tenant per app** in evaluation mode unless a payment model applies. ([teams-licenses](https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/teams-licenses.md)) | |
| License | Meeting **AI insights** APIs require a **Microsoft 365 Copilot** license. Transcripts themselves are a Teams feature with tenant admin controls. | |

**Demo implication:** a single-user delegated Graph login can pull **that user’s Outlook mail and calendar**. Teams *transcripts* and org-wide chat almost certainly need an **IT admin** at lunch-plus-one, not Jackson’s personal consent.

### 3.3 SharePoint / OneDrive files

- Incremental: `GET /me/drive/root/delta`, `/drives/{id}/root/delta`, `/sites/{id}/drive/root/delta`. ([driveItem: delta](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0))
- Content: `@microsoft.graph.downloadUrl` (short-lived, ~1 hour) or `/items/{id}/content`. ([driveItem resource](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/resources/driveitem?view=odsp-graph-online))
- Delegated `Files.Read.All` / `Sites.Read.All`: user can only read what **they** can already open. Application `Files.Read.All` is whole-tenant. ([OneDrive permissions](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference?view=odsp-graph-online); [permissions overview](https://learn.microsoft.com/en-us/graph/permissions-overview))
- `@beep/m365` already implements `deltaDriveItems` + content download, and **skips encrypted / sensitivity-labeled “pfile” extensions** rather than requesting decrypt grants. ([`M365.service.ts:100-118`](../../../packages/drivers/m365/src/M365.service.ts), [`deltaDriveItems` ~1072](../../../packages/drivers/m365/src/M365.service.ts))

### 3.4 Outlook contacts and calendar

- Contacts: `GET /me/contacts` (and folder-scoped). Least privileged: **Contacts.Read** (delegated or application). ([list contacts](https://learn.microsoft.com/en-us/graph/api/user-list-contacts?view=graph-rest-1.0)) **Not in `@beep/m365` v1.**
- Calendar: `GET /me/events` / `calendarView`. `@beep/m365` exposes `listEvents` / `getEvent` with `Calendars.Read`. ([`M365.service.ts:1136-1140`](../../../packages/drivers/m365/src/M365.service.ts))
- June 2026 default consent tightening added **Contacts.ReadWrite**, **Contacts.Read.Shared**, **People.Read**, Tasks.* to the Microsoft-recommended **admin-consent** list. ([MC1304287](https://mc.merill.net/message/MC1304287))

### 3.5 Copilot Retrieval API — useful, but not mail

[Overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/retrieval/overview) (updated 2026-08-20):

- Grounds on **SharePoint, OneDrive, Copilot connectors** — **not** mailbox items.
- Keeps data in place; honors M365 ACLs.
- License: included with **M365 Copilot add-on**; otherwise **pay-as-you-go preview** (SharePoint + connectors only; **OneDrive excluded** on PAYG).
- Limits: 1,500-char query; one data source per call; max 25 hits; **200 requests per user per hour**; semantic/hybrid only for `.doc/.docx/.pptx/.pdf/.aspx/.one`; no images/charts; large-file caps 512 MB (docx/pptx/pdf) / 150 MB (other).
- Permissions: `Files.Read.All` + `Sites.Read.All` (and `ExternalItem.Read.All` for connectors).

**For the demo:** Retrieval API is a *hosted* RAG over files Jackson already can open. It does **not** replace local mail ingest and does **not** build a fastener graph. It is a fallback if they already pay for Copilot and want “ask my SharePoint” in five minutes.

### 3.6 App registration and consent model (what lunch can vs cannot do)

From [permissions overview](https://learn.microsoft.com/en-us/graph/permissions-overview):

| | **Delegated** (on behalf of signed-in user) | **Application** (app-only) |
| --- | --- | --- |
| Who consents | User (if tenant policy allows) **or** admin for all users | **Only admin** (Privileged Role Admin / Global Admin) |
| Blast radius | Intersection of **granted scopes ∩ what that user can already access** | Everything the permission names (all mailboxes, all sites) unless restricted |
| Lunch-demo fit | **Yes** — Jackson signs in, consents to Mail.Read / Files.Read.All / Calendars.Read | **No** — IT project |

**Practical lunch path:** public-client / device-code or interactive MSAL (already how `@beep/m365` auth is shaped: [`M365.auth.ts`](../../../packages/drivers/m365/src/M365.auth.ts) “MSAL-backed delegated token provider”). If LeJeune’s tenant uses Microsoft’s recommended consent policy, **even Mail.Read may bounce to an admin**. Have a PST fallback (below) so the demo does not die on Entra.

### 3.7 Throttling (size the ingest)

Global Graph cap: **130,000 requests / 10 seconds / app across all tenants**. ([throttling-limits](https://learn.microsoft.com/en-us/graph/throttling-limits))

**Outlook (mail, calendar, contacts, attachments)** — per **app ID × mailbox**:

- 10,000 API requests / 10 minutes
- **4 concurrent** requests
- 150 MB upload / 5 minutes

Exceeding one mailbox does not throttle another. `@beep/m365` already retries on throttle (`DEFAULT_MAX_RETRIES = 3`, default Retry-After 1s: [`M365.config.ts:93`](../../../packages/drivers/m365/src/M365.config.ts), [`M365.service.ts:99`](../../../packages/drivers/m365/src/M365.service.ts)).

**Teams:** per-app-per-tenant GET team ~30 rps; per channel/chat resource often **1 rps**. Export message APIs higher (docs list 200 rps tenant for some getAllMessages). Design Teams ingest as a slow crawl.

**SharePoint/OneDrive:** Graph defers to [SharePoint throttling guidance](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online) (not a single rps number).

**Retrieval API:** 200 req/user/hour (above).

### 3.8 Exchange / Outlook PST as offline fallback

If Graph consent is blocked, **still demo**:

1. **Outlook for Windows** (the user who owns the mailbox): File → Open & Export → Outlook Data File (.pst). Official consumer/admin docs describe this path. ([Microsoft Support export to PST](https://support.microsoft.com/en-us/office/export-emails-contacts-and-calendar-items-to-outlook-using-a-pst-file) — URL pattern; confirm on the live Support article if linking in a slide).
2. **Microsoft Purview eDiscovery (new experience)** — classic Content Search / ClickOnce export tool **retired 2025-08-31**. New export supports **“Create PSTs for messages where possible”**, max PST package 1–10 GB (default 5 GB). Requires eDiscovery permissions (Export role / eDiscovery Manager), not a random sales login. ([edisc-search-export](https://learn.microsoft.com/en-us/purview/edisc-search-export); [edisc-review-set-export](https://learn.microsoft.com/en-us/purview/edisc-review-set-export); classic retirement note on [ediscovery-export-search-results](https://learn.microsoft.com/en-us/purview/ediscovery-export-search-results))
3. **`New-MailboxExportRequest` is Exchange *on-prem***, not Exchange Online. ([Practical 365](https://practical365.com/export-mailboxes-to-pst-exo/))

PST is the honest “IT won’t grant Graph this week” path for a family business.

---

## 4. Knowledge-graph / agent-memory products (and the “tacit knowledge from email” story)

GitHub metadata below is from the **GitHub REST API on 2026-08-25** (license SPDX + star count).

| Product | License | Stars (2026-08-25) | What it is | Tacit-knowledge-from-email story |
| --- | --- | --- | --- | --- |
| **TrustGraph** [trustgraph-ai/trustgraph](https://github.com/trustgraph-ai/trustgraph) | **Apache-2.0** (was AGPL-3.0 at launch; switched May 2025) | 2,609 | Context-graph factory, OntologyRAG, Context Cores (offline-reloadable), docker-compose local, Neo4j/Cassandra/Memgraph/FalkorDB, 40+ LLMs. ([docs intro](https://docs.trustgraph.ai/overview/introduction.html); [license PR](https://github.com/trustgraph-ai/trustgraph/pull/373)) | Document/data → hypergraph context cores. **No first-party M365 mail connector documented.** Email would be “drop EML/PST-extracted text into the factory.” Local/on-prem is the sovereignty pitch. |
| **cognee** [topoteretes/cognee](https://github.com/topoteretes/cognee) | Apache-2.0 | 30,264 | ECL pipeline (Extract / Cognify / Load); local default stores; `remember` / `recall` / `forget`. | **Gmail** first-class community connector (`cognee-community-connector-gmail`): OAuth, incremental, forget-on-delete. **Outlook/Graph mail: not listed.** Slack/Notion/Drive/Confluence connectors exist. ([cognee dlt/Gmail docs](https://docs.cognee.ai/integrations/dlt-integration); [integrations](https://docs.cognee.ai/integrations)) Cloud “Outlook” cards: several data-source tiles are **Coming soon**. |
| **Graphiti** [getzep/graphiti](https://github.com/getzep/graphiti) | Apache-2.0 | 30,309 | Bi-temporal KG; episodes; hybrid BM25 + vector + graph. Backs **Zep**. | Episode types: `text`, `message` (`Speaker: …`), JSON. Zep ingest docs list **email / Slack exports / transcripts** as on-disk backfill via `zep-ingest`; live turns via `thread.add_messages`; business data (including emails) via `graph.add`. ([Adding episodes](https://help.getzep.com/graphiti/core-concepts/adding-episodes); [Ingest](https://help.getzep.com/adding-context); [architecture: communications](https://help.getzep.com/architecture-patterns)) **This is the best OSS “email as evolving facts” story** (lead times, preferred mill, “we always spec A325 on that GC”). |
| **Zep Cloud** | Graphiti OSS + managed (not the deprecated Zep CE) | — | SOC 2 / HIPAA / BYOC **VENDOR-CLAIMED**. | Secondary: Flex **$1,250/year** / 50k credits, +$25 / 10k. **UNVERIFIED against live pricing page this pass.** ([mnemoverse citing Zep pricing](https://mnemoverse.com/docs/library/ai-memory-solutions-2026-q3)) |
| **mem0** [mem0ai/mem0](https://github.com/mem0ai/mem0) | Apache-2.0 | 64,039 | Vector-first memory; optional graph. | Conversation/turn memory, not mailbox ingest. Secondary: **$24M Series A** Oct 2025 — **UNVERIFIED here against a primary press URL**. No published “ingest Outlook” story found. |
| **LangGraph memory + LangMem** [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) MIT 40,452 stars; [langmem](https://github.com/langchain-ai/langmem) MIT 1,625 | Short-term = thread checkpointer; long-term = Store (namespace/key JSON). LangMem extracts facts from conversations, hot-path tools + background manager. ([LangChain memory concepts](https://docs.langchain.com/oss/python/concepts/memory); [LangMem launch](https://blog.langchain.com/langmem-sdk-launch/)) | Email = just another message list **you** feed the graph. No connector. |
| **Microsoft GraphRAG** [microsoft/graphrag](https://github.com/microsoft/graphrag) | **MIT** (GitHub API; some 2026 blogs wrongly say Apache-2.0) | 35,683 | Batch entity extract + Leiden communities + hierarchical summaries. Research project, not a Microsoft product. | **Static corpora.** Poor fit for a living inbox (incremental updates are expensive; no temporal invalidation). Microsoft’s own Graphiti comparison table: GraphRAG = batch document summarization. ([getzep/graphiti README](https://github.com/getzep/graphiti)) Indexing cost **VENDOR/SECONDARY** $50–200 per ~500 pages. |
| **Neo4j** [neo4j/neo4j](https://github.com/neo4j/neo4j) | Community **GPL-3.0**; Enterprise commercial | 17,138 | Property graph + vector indexes; GraphRAG helpers. | Storage, not an email story. **GPL-3.0 ⇒ clean-room / don’t vendor into a public Apache repo without counsel.** AuraDB and Enterprise are the non-copyleft production paths. |

**Port discipline for this public repo:** Apache-2.0 / MIT may be ported with attribution. Neo4j Community GPL-3.0 is **clean-room / reference-only**. TrustGraph Apache-2.0 is compatible with a local demo (and is already in the capture as a branding/workbench reference).

**Best stack for “retiring veteran’s mailbox → trustworthy quoting agent”:** Graphiti (or TrustGraph cores) on a **local** graph store; episodes = MIME-parsed messages + attachments; custom entity types = fastener attributes (grade, finish, diameter, spec, job, GC, mill). Cognee if you want ECL + Gmail-class connectors and can add a Graph mail source. mem0/LangMem as the *hot* conversational layer on top, not the corpus.

---

## 5. Service-as-software for SMB / mid-market distributors

Capture asked for **service-as-software**, not another SaaS seat.

### 5.1 The thesis (cited, not invented)

- Sequoia (Julien Bek, 2026-03-05): copilots sell the tool; autopilots sell the **work**. “For every dollar spent on software, six are spent on services.” ([sequoiacap.com/article/services-the-new-software](https://sequoiacap.com/article/services-the-new-software/))
- Foundation Capital (2025-07-03): **$4.6T** services-as-software TAM; pricing moving access → outcome; outcome pricing fails when results are not instrumentable across customers. ([foundationcapital.com](https://foundationcapital.com/ideas/the-4-6t-services-as-software-opportunity-lessons-from-the-first-year))
- Worked examples (not distribution): Sierra priced per resolution; Crosby per-document legal review; Garfield £2/letter. ([Forbes 2026-04-21](https://www.forbes.com/sites/josipamajic/2026/04/21/ai-native-agencies-sell-outcomes-not-software-and-investors-are-paying-attention/); Sequoia essay)

### 5.2 Distribution is already edging into outcomes

- **Epicor Prism:** pay only for RFQs that become POs. ([Business Wire](https://www.businesswire.com/news/home/20250903859301/en/Epicor-Launches-Industrys-First-ERP-AI-Agent-with-Outcomes-Based-Pricing-to-Accelerate-Supplier-Decisions))
- **Conexiom:** per trading partner + per document (+ platform fee). ([BoltWise comparison citing Conexiom](https://getboltwise.com/boltwise-vs-conexiom); SAP Store $30k+$20k)
- **Prokeep:** per **location**, unlimited users — closer to “cover the counter” than seats. ([pricing](https://www.prokeep.com/pricing))
- **Infor Velocity:** vendor says flat subscription, no consumption cliff. ([Infor](https://www.infor.com/blog/the-agentic-enterprise))

### 5.3 Case studies with dollar outcomes (mostly vendor)

| Case | What happened | Source |
| --- | --- | --- |
| Turtle (electrical, Infor) | +1.3% GM; 98% faster item pricing; ~$500k margin / $700k revenue at launch (**podcast, not audited**) | [TechTarget](https://www.techtarget.com/enterprise-software/podcast/How-a-distributor-used-AI-driven-dynamic-pricing-for-quick-ROI) |
| Combilift parts (Infor Coleman) | 20→5 min related-parts; +30% revenue/txn | [Infor](https://www.infor.com/nordics/blog/innovation-showcase-how-to-increase-equipment-uptime-and-customer-service-with-ai-driven-part-recommendations) |
| EVG (Workist) | 4.5 min → 16 s order entry (96%) | [Workist](https://www.workist.com/en/success-stories/evg) |
| Fastener Dimensions (Soff) | 1,500 RFQs/week; 2× quote throughput | Indexed blog; **live 404** |
| Intuilize “Motor City Industrial” $50M | **VENDOR-CLAIMED** $500k+ GM lift, >10× ROI | [Intuilize guide](https://info.intuilize.com/how-distributors-can-simplify-operations-with-ai-guide-2026) |
| Intuilize $10M janitorial | **VENDOR-CLAIMED** $93.6k GM / 99.5% price adoption / 4 months | [Intuilize case](https://info.intuilize.com/price-optimization-case-study-mid-market-distributor-intuilize) |
| CentSight $12M distributor | **VENDOR-CLAIMED** $140k vendor-cost save | [centsight.com](https://centsight.com/case-studies/smb-vendor-costs) |
| PROS grocery wholesaler | **expected** $8.5M revenue uplift, 8-month payback | [casestudies.com / PROS](https://www.casestudies.com/company/pros/case-study/why-a-wholesale-grocery-distributor-chose-ai-powered-pricing-and-quoting-by-pros) |
| NVIDIA (Esker) | 60× faster repeat orders, 3× growth, no headcount | [Esker](https://www.esker.com/solutions/order-management/) |
| The Lab (mid-size MRO distributor) | Pricing overrides −45%; 6-month breakeven; 4× 12-month ROI | [thelabconsulting.com](https://thelabconsulting.com/case-studies/distribution-and-manufacturing-pricing-capability-improvement-automation/) |

**Pricing bands for a mid-market distributor (secondary):** Intuilize’s 2026 guide puts pricing-optimization SaaS at **$2k–$8k/month**, inventory opt. **$2k–$10k/month**, enterprise **$50k–$500k/year** for $100M+ firms. ([same Intuilize guide](https://info.intuilize.com/how-distributors-can-simplify-operations-with-ai-guide-2026)) Pulse RevOps (2026-08-16) maps sub-$50M single-DC ERP contracts **$18k–$95k**, $50–500M **$95k–$485k**. ([pulserevops.com](https://pulserevops.com/revenue-architecture/ra0066)) **UNVERIFIED as market research quality.**

**Service-as-software offer that fits LeJeune (inferred, not a quote):** do not sell seats. Sell a **scoped outcome** — e.g. “every inbound RFQ in Jackson’s mailbox becomes a reviewed draft quote with mill/ATP and a spec note, with a human send” — priced per **completed, approved quote** or as a managed desk that replaces N hours of inside-sales grind. Epicor already legitimized “pay when the RFQ becomes a PO.” Foundation Capital’s caveat applies: fastener win-rate is messy; instrument **draft-accepted-by-rep**, not “won job.”

---

## 6. Risks

### 6.1 Data governance for a family-owned distributor

- **M365 is the SoR.** Mailboxes of retiring estimators are the crown jewels: mill relationships, unwritten spec substitutions, “never sell X into that plant.” Putting that in a multi-tenant SaaS quoting tool is a **board-level** decision, not a feature checkbox.
- **Delegated Graph + local disk** is the governance-compatible demo: Jackson consents for **his** mail/files; bytes land on a machine they control; `@beep/m365` already refuses to log bodies. Tenant-wide `Mail.Read` application permission is how incidents happen ([audit guidance flagging Mail.Read / Files.Read.All app grants](https://accuroai.co/blog/audit-ai-app-oauth-grants-microsoft-365-google-workspace)).
- **Consent policy drift (2025–2026):** even delegated Mail.Read may require admin. Plan PST.
- **Copilot Retrieval API** keeps data in Microsoft’s index — fine if they already bought Copilot; **not** “local-first.” PAYG preview excludes OneDrive. Terms of Use apply. ([Retrieval overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/retrieval/overview))
- **Sensitivity labels / encrypted files:** Graph v1 will hand back protected blobs; beep skips them. Do not ask for decrypt-all.
- **Minnesota / US:** no GDPR Article 22 unless they process EU personal data. Still: customer drawings, NASA-adjacent patented fastener work ([CAPTURE.md](../CAPTURE.md) — proprietary NASA fasteners), and GC emails are **confidential business information**. Offer a written processing boundary: local graph, no training on their corpus, destruction on request.
- **eDiscovery PST export** is an *admin* power with an export key “anyone can use” — Microsoft tells you to protect it like a password. ([classic export doc](https://learn.microsoft.com/en-us/purview/ediscovery-export-search-results)) Wrong person exporting “all mailboxes” is a family-business nightmare.

### 6.2 Supplier-portal Terms of Service vs automated ordering

- **Grainger:** explicit ban on robots, spiders, scraping, data mining, circumventing navigation. ([Terms of Access](https://www.grainger.com/content/terms-of-access))
- **Fastenal:** EDI/email/fax commerce only if **agreed in writing**; Supplier Portal is for *their* vendors. ([legal-information](https://www.fastenal.com/fast/legal-information))
- **Punchout / EDI / published APIs** are the compliant automation rails (see MN T-572 punchout instructions).
- Pattern: an agent that **fills a cart draft** and asks Jackson to click Place Order on the real portal (or sends an EDI 850 the supplier already enabled) is defensible. An agent that **replays a browser login** is a ToS and account-ban risk.

### 6.3 Human-approval patterns (what actually ships)

Almost every serious product in §1–§2 **refuses to auto-send the customer quote**:

- Proton: “Reps approve every quote before it reaches the customer.” ([launch](https://www.proton.ai/blog/proton-ends-rekeying-era-with-agentic-order-quote-entry-automation))
- Dynamics 365 BC Sales Order Agent: quote is a **safe intermediate** (no planning/reservation impact); setup toggles “send quotes for confirmation” vs “make orders from quotes.” ([setup](https://learn.microsoft.com/en-us/dynamics365/business-central/sales-order-agent-setup))
- Oracle Fusion “Quote to Purchase Requisition Assistant”: requisitions **always created in draft**. ([Oracle 25D](https://docs.oracle.com/en/cloud/saas/readiness/scm/25d/ssproc25d/25D-ssproc-wn-f40074.htm))
- ChannelFlex / BoltWise / Workist: confidence scores + exception queues.

Governance literature that maps onto a fastener desk:

- Gate **irreversible / external / priced** actions (send quote, place supplier order, commit a mill). Let **reversible** actions run (parse RFQ, propose alternates, draft spec paragraph). ([Arthur HITL](https://www.arthur.ai/column/human-in-the-loop-governance-for-ai-agents); [agentic-patterns HITL](https://agentic-patterns.com/patterns/human-in-loop-approval-framework/))
- GDPR Art. 22 is a reminder even for US firms with EU jobs: a rubber-stamp reviewer is not “human review.” ([DeepInspect](https://www.deepinspect.ai/blog/gdpr-ai-article-22-automated-decision))
- Log: run id, draft hash, recipient, approver, decision, edits. Append-only.

**Suggested approval lanes for LeJeune (design, not product):**

| Lane | Examples | Gate |
| --- | --- | --- |
| Auto | Parse RFQ; match known SKU; retrieve last-paid; pull mill ATP from *licensed* API | None |
| Review | First-time customer; description-only line; substitute; spec-critical (A325 vs A490, galvanized vs plain, NASA/proprietary) | Inside sales |
| Dual control | Place supplier order > $X; any portal login; email send to GC | Jackson / estimator of record |

---

## 7. What would knock the socks off a fastener executive

One page, grounded in the findings above.

**They have already been pitched “AI.”** MDM shows shops Jackson’s size using Copilot to clean Excel. Proton, BoltWise, Prokeep, Canals, Mercura, Workist, Conexiom, Esker, Epicor Prism, Infor Velocity, and BC’s Sales Order Agent all sell some slice of **inbox → draft quote/order**. A lunch that demos another chat box loses to whoever showed a 100-line RFQ turning into a P21 quote last quarter.

**The thing none of them own — and that CAPTURE actually asked for — is the retiring brain.** BoltWise’s own positioning even names it: “Our best quoting knowledge lives in a few people's heads.” ([BoltWise vs Proton](https://getboltwise.com/boltwise-vs-proton-ai)) Combilift said the same sentence to Infor in 2022 and trained Coleman on three years of **structured ERP quotes**, not Outlook. LeJeune’s SoR is **Office**. The veterans’ substitutions, mill quirks, “why you need these fasteners in addition to the bolts to hang the beam,” and the Mystic Lake / U.S. Bank Stadium / NASA jobs live in **mail, attachments, Teams, and calendar**, not in an item master.

**The socks-off demo, therefore, is not a better Proton.** It is:

1. **Jackson (or a volunteer veteran) signs in with delegated Graph** — or, if Entra blocks Mail.Read, drops a **PST** on the table. Show the consent screen and the local folder filling. Cite the four-concurrent / 10k-per-10-min Outlook cap so it looks engineered, not magical.
2. **Watch the graph grow on a machine in the room** (TrustGraph context core or Graphiti episodes). Nodes: fastener attributes, jobs, GCs, mills, people. Edges with **time**: “we used to buy A from mill M until 2024; now mill N.” That temporal invalidation is Graphiti’s actual differentiator versus GraphRAG.
3. **Replay one real-shaped RFQ** (anonymized): 40 messy lines, mixed mill numbers, a photo of a cut sheet. Agent produces a **draft quote + spec paragraph + recommended mill + ‘needs these companion fasteners because…’** with **citations back to the ingested email/PDF** — and a fat **Approve / Edit / Reject** control. Proton’s own launch copy is “reps approve every quote”; steal that UX, don’t invent autonomy.
4. **Stop at the supplier portal.** Show a filled cart / EDI 850 **draft**. Say out loud that Grainger’s ToS bans robots and that punchout/EDI is the grown-up path. Executives who have been burned by a banned Fastenal login will lean in.
5. **Price it like Epicor Prism, not like Copilot seats:** “we run the quoting desk for this branch; you pay when a rep-accepted draft goes out” (or per approved quote). Sequoia’s 6:1 services/software line is the business-model slide; Foundation Capital’s instrumentation warning is the fine print.

**What not to claim:** that Copilot Retrieval API reads mail (it doesn’t); that application `Mail.Read` is “just an admin click” (it is all mailboxes); that you will auto-order on Grainger.com; that GraphRAG is the memory layer for a living inbox; that BoltWise/Proton don’t exist. Name them, then draw the gap they left open: **local, cited, veteran-memory agents with approval — on the Office corpus they already have.**

---

## Sources

Access date for all: **2026-08-25**. License column filled for repositories.

| URL or path | What it evidenced | License |
| --- | --- | --- |
| https://lejeunebolt.com/ | Company is a public fastener distributor | — |
| ../CAPTURE.md | Brief: M365 SoR, Jackson’s day, veterans, NASA/USB Stadium/Mystic Lake | — |
| https://getboltwise.com | Fastener AI quoting, ERP list (P21, INxSQL, Business Edge) | — |
| https://getboltwise.com/blog/denver-company-raked-in-3m-to-bring-ai-to-industrial-procurement | $3M seed, investors, fastener SKU-count quote | — |
| https://getboltwise.com/boltwise-vs-conexiom | Pricing model (custom vs per-partner); match-rate **VENDOR-CLAIMED** | — |
| https://getboltwise.com/boltwise-vs-proton-ai | Proton OA GA 2026-07-21; tribal-knowledge positioning | — |
| https://www.ci-inc.com/testimonials/transforming-fastener-distribution-through-innovation/ | Business Edge + BoltWise named partnership | — |
| https://soff.ai/blog/how-fastener-dimensions-uses-soff-to-double-quote-throughput | Fastener Dimensions case (**indexed; live 404**) | — |
| https://www.proton.ai/blog/proton-ends-rekeying-era-with-agentic-order-quote-entry-automation | OA GA, HITL, BPI, unnamed industrial PoV | — |
| https://distributionstrategy.com/2026/07/proton-ai-launches-ai-platform-to-automate-order-and-quote-entry-for-distributors/ | Independent-press write-up; unverified PoV caveat | — |
| https://www.globenewswire.com/news-release/2022/01/18/2368707/0/en/Proton-ai-Raises-20M-Series-A-Led-by-Felicis-Ventures.html | $20M Series A, 2022-01-18 | — |
| https://www.cbinsights.com/company/protonai | $20M total, Felicis | — |
| https://www.proton.ai/order-and-quote-entry | **VENDOR-CLAIMED** speed/match metrics | — |
| https://www.proton.ai/ | Replenex named; product suite | — |
| https://www.prokeep.com/order-automation-launch | AI OA under 60s **VENDOR-CLAIMED** | — |
| https://www.prokeep.com/pricing | Per-location pricing | — |
| https://www.prokeep.com/order-engine | Named distributor case quotes | — |
| https://www.ycombinator.com/companies/mercura | YC W25, product | — |
| https://www.trysignalbase.com/news/funding/mercura-secures-21m-seed-round | $2.1M seed 2025-12-29 | — |
| https://startupintros.com/orgs/mercura | ~$2.6M / 2 rounds **secondary** | — |
| https://www.mercura.ai/ | 60+ customers **VENDOR-CLAIMED** | — |
| https://www.tamradar.com/funding-rounds/canals-series-a-35m | Canals $35M Series A **secondary** | — |
| https://channelflex.com/ | Early quoting product; 94% automatch UI **VENDOR-CLAIMED** | — |
| https://channelflex.com/ai-powered-quoting-distributors/ | Inbox-forward workflow, HITL | — |
| https://www.linkedin.com/company/channelflex | Founded 2025, 2–10 employees | — |
| https://distro.app/blog/distro-autobid-intelligent-order-entry-and-quoting-automation-engine-that-transforms-quoting-from-hours-to-minutes | Distro quoting claims **VENDOR-CLAIMED** | — |
| https://aginera.ai/solutions/automated-quoting | Electrical/industrial PO/RFQ inbox | — |
| https://conexiom.com/platform | PO capture, P21/Eclipse native, 1B+ lines **VENDOR-CLAIMED** | — |
| https://www.cbinsights.com/company/conexiom | $170M raised | — |
| https://www.sap.com/products/scm/partners/ecmarket-inc-conexiom-ai-order-automation-for-sap-s4hana.html | USD 30,000/yr + 20,000 setup | — |
| https://www.esker.com/solutions/order-management/ | Order mgmt AI; NVIDIA/Suntory/FUCHS | — |
| https://www.workist.com/en/success-stories/evg | EVG 96% time save | — |
| https://www.workist.com/en/order-management-software | HITL + learning | — |
| https://www.cbinsights.com/company/workist/financials | $11.72M raised | — |
| https://www.top10erp.org/products/epicor-prophet-21/additional-capabilities | AutoOrder | — |
| https://www.aleran.com/ | Dealer portals / CPQ | — |
| https://www.grainger.com/content/terms-of-access | No scraping / robots | — |
| https://www.fastenal.com/fast/legal-information | Supplier portal + EDI-by-agreement | — |
| https://osp.admin.mn.gov/sites/osp/files/pdf/t-572%285%29.pdf | MN punchout for Fastenal/Grainger/MSC | — |
| https://www.businesswire.com/news/home/20250903859301/en/Epicor-Launches-Industrys-First-ERP-AI-Agent-with-Outcomes-Based-Pricing-to-Accelerate-Supplier-Decisions | Prism outcomes pricing; Madsen’s | — |
| https://softabase.com/software/erp/epicor-prophet-21 | P21 strengths; $150k–$500k hearsay | — |
| https://www.itqlick.com/epicor-prophet-21/pricing | $200/user aggregator | — |
| https://www.erpresearch.com/pricing/epicor-prophet-21 | $100–$175/user aggregator; on-prem end dates | — |
| https://www.infor.com/news/infor-announces-coleman-ai-platform | Coleman 2018 | — |
| https://www.infor.com/nordics/blog/innovation-showcase-how-to-increase-equipment-uptime-and-customer-service-with-ai-driven-part-recommendations | Combilift parts AI | — |
| https://www.techtarget.com/enterprise-software/podcast/How-a-distributor-used-AI-driven-dynamic-pricing-for-quick-ROI | Turtle 1.3% GM | — |
| https://www.infor.com/blog/the-agentic-enterprise | Velocity flat pricing **VENDOR-CLAIMED**; Turtle recap | — |
| https://www.infor.com/blog/infor-cloudsuite-distribution-april-2026-release | Industry AI agents Apr 2026 | — |
| https://www.infor.com/blog/team-air-distributing-agentic-enterprise-infor | Team Air agents | — |
| https://www.sap.com/use-cases/joule-assistant/deal-closing-ai | Joule Deal Closing / quoting agents | — |
| https://www.sap.com/topics/events/sapphire/innovation-news-guide-2026 | Sapphire 2026 assistants | — |
| https://www.sap.com/products/crm/intelligent-product-recommendation.html | Unstructured-text → recommendation | — |
| https://www.sap.com/canada/products/financial-management/cpq.html | CPQ list + CAD 34 external user | — |
| https://luxinnovation.lu/news/aiquote-ceratizit-s-ai-at-the-service-of-b2b-quotes | Ceratizit AIQuote / SAP | — |
| https://www.zdnet.com/article/microsoft-introduces-ten-ai-agents-for-sales-finance-supply-chain-in-dynamics-365/ | D365 10 agents 2024-10 | — |
| https://www.drdynamics.co.uk/blog/every-microsoft-first-party-ai-agent-in-dynamics-365 | Agent inventory 2026 | — |
| https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2026/04/16/becoming-a-frontier-manufacturing-firm-agentic-decisions-across-the-manufacturing-value-chain/ | Procurement Agent preview | — |
| https://learn.microsoft.com/en-us/dynamics365/business-central/sales-order-agent-process | BC Sales Order Agent HITL | — |
| https://learn.microsoft.com/en-us/dynamics365/business-central/sales-order-agent-setup | Quote vs order config | — |
| https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2025/04/03/sales-order-agent-in-microsoft-dynamics-365-business-central-now-in-public-preview/ | BC agent preview | — |
| https://learn.microsoft.com/en-us/microsoft-sales-copilot/use-sales-chat | M365 Copilot Sales agent | — |
| https://alphavima.com/blog/dynamics-365-licensing-guide/ | 2026 D365 list prices **aggregator** | — |
| https://www.mdm.com/article/technology/ai/the-hidden-majority-your-ai-is-writing-emails-your-competitors-ai-is-finding-margin/ | Sub-$100M distributor AI usage | — |
| https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0 | Mail delta | — |
| https://learn.microsoft.com/en-us/graph/outlook-get-mime-message | MIME `$value` | — |
| https://learn.microsoft.com/en-us/graph/api/attachment-get?view=graph-rest-1.0 | Attachment `$value` | — |
| https://learn.microsoft.com/en-us/graph/api/message-list-attachments?view=graph-rest-1.0 | List attachments | — |
| https://learn.microsoft.com/en-us/answers/questions/5881925/mime-content-access-for-group-mailboxes-via-micros | No group-post MIME | — |
| https://learn.microsoft.com/en-us/graph/permissions-reference | Mail.Read admin-consent flags | — |
| https://learn.microsoft.com/en-us/graph/permissions-overview | Delegated vs application | — |
| https://mc.merill.net/message/MC1304287 | 2026 Exchange consent defaults | — |
| https://learn.microsoft.com/en-us/microsoftteams/export-teams-content | Teams export APIs + admin perms | — |
| https://learn.microsoft.com/en-us/graph/api/resources/calltranscript?view=graph-rest-1.0 | Transcripts | — |
| https://learn.microsoft.com/en-us/answers/questions/5543644/graph-api-get-all-transcripts-list-why-we-need-adm | Transcript admin consent | — |
| https://github.com/microsoftgraph/microsoft-graph-docs-contrib/blob/main/concepts/teams-licenses.md | 600 min/mo eval transcripts | — |
| https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0 | Drive delta | — |
| https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference?view=odsp-graph-online | Files.Read.All delegated vs app | — |
| https://learn.microsoft.com/en-us/graph/api/user-list-contacts?view=graph-rest-1.0 | Contacts | — |
| https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/retrieval/overview | Retrieval API limits, license, no mail | — |
| https://learn.microsoft.com/en-us/graph/throttling-limits | Outlook 10k/10min, 4 concurrent; global 130k/10s | — |
| https://learn.microsoft.com/en-us/purview/edisc-search-export | New eDiscovery PST export | — |
| https://learn.microsoft.com/en-us/purview/edisc-review-set-export | PST package sizes 1–10 GB | — |
| https://learn.microsoft.com/en-us/purview/ediscovery-export-search-results | Classic export retired 2025-08-31 | — |
| https://practical365.com/export-mailboxes-to-pst-exo/ | No New-MailboxExportRequest in EXO | — |
| packages/drivers/m365/src/M365.config.ts:113-146 | beep delegated read scopes | Apache-2.0 (workspace) |
| packages/drivers/m365/src/M365.service.ts:4-7, 791-807, 1142-1149 | No body logging; method surface | Apache-2.0 (workspace) |
| https://github.com/trustgraph-ai/trustgraph | Apache-2.0, 2609 stars | Apache-2.0 |
| https://docs.trustgraph.ai/overview/introduction.html | Context cores, local deploy | — |
| https://github.com/trustgraph-ai/trustgraph/pull/373 | AGPL → Apache May 2025 | — |
| https://github.com/topoteretes/cognee | Apache-2.0, 30264 stars | Apache-2.0 |
| https://docs.cognee.ai/integrations/dlt-integration | Gmail connector | — |
| https://github.com/getzep/graphiti | Apache-2.0, 30309 stars | Apache-2.0 |
| https://help.getzep.com/graphiti/core-concepts/adding-episodes | Episode types including message | — |
| https://help.getzep.com/adding-context | Email as ingest source | — |
| https://github.com/mem0ai/mem0 | Apache-2.0, 64039 stars | Apache-2.0 |
| https://github.com/langchain-ai/langgraph | MIT, 40452 stars | MIT |
| https://github.com/langchain-ai/langmem | MIT, 1625 stars | MIT |
| https://docs.langchain.com/oss/python/concepts/memory | Short vs long-term memory | — |
| https://github.com/microsoft/graphrag | MIT, 35683 stars | MIT |
| https://github.com/neo4j/neo4j | GPL-3.0 Community | GPL-3.0 |
| https://sequoiacap.com/article/services-the-new-software/ | Copilot vs autopilot, 6:1 | — |
| https://foundationcapital.com/ideas/the-4-6t-services-as-software-opportunity-lessons-from-the-first-year | $4.6T, outcome-pricing caveat | — |
| https://www.forbes.com/sites/josipamajic/2026/04/21/ai-native-agencies-sell-outcomes-not-software-and-investors-are-paying-attention/ | Crosby / Sierra examples | — |
| https://info.intuilize.com/how-distributors-can-simplify-operations-with-ai-guide-2026 | SMB AI price bands; Motor City **VENDOR-CLAIMED** | — |
| https://centsight.com/case-studies/smb-vendor-costs | $12M distributor $140k **VENDOR-CLAIMED** | — |
| https://thelabconsulting.com/case-studies/distribution-and-manufacturing-pricing-capability-improvement-automation/ | MRO pricing automation ROI | — |
| https://www.arthur.ai/column/human-in-the-loop-governance-for-ai-agents | HITL gating | — |
| https://agentic-patterns.com/patterns/human-in-loop-approval-framework/ | Approval pattern | — |
| https://docs.oracle.com/en/cloud/saas/readiness/scm/25d/ssproc25d/25D-ssproc-wn-f40074.htm | Draft-mode requisitions | — |
| https://accuroai.co/blog/audit-ai-app-oauth-grants-microsoft-365-google-workspace | Dangerous Graph grants | — |
| https://x.com/WallStreetApes/status/2065508254147588210 | C.H. Robinson quoting-agents clip (adjacent logistics; 220 likes / 22k views, 2026-06-12) | — |
| https://10xerp.com/industries/fasteners | Fastener ERP + “AI built in” **VENDOR-CLAIMED** | — |
| https://www.ximplesolution.com/industries/fastener-distribution-software/ | Fastener cloud ERP | — |

**X note:** Keyword search for Proton/BoltWise/Prokeep/Mercura returned no posts this pass. Semantic search surfaced adjacent quoting automation (aPriori CM RFQs; C.H. Robinson 100% AI quoting / 31 s — **logistics, not fasteners**, high engagement).
