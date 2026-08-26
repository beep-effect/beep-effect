# LeJeune Bolt agentic demo research synthesis

Date: 2026-08-25

This stage-1 synthesis joins six research lanes. First-party pages are company claims, not
independent proof. `UNVERIFIED` marks facts that require LeJeune records, tenant access, a
supplier agreement, or a live runtime. The public corpus is useful for a demo ontology, but it
does not contain current stock, prices, supplier lead times, open orders, authority rules, or
lot-specific certificates.

## 2026-08-25 external landscape

### Company profile and operating position

LeJeune Bolt presents itself as a privately held structural-fastener and installation-tool
distributor serving steel and concrete construction from Burnsville, Minnesota, and Chino,
California. Its public offer spans project sales, warehousing, logistics, technical support,
tool sales, rentals, repair, and testing. The published history conflicts between 1976 in
Burnsville and 1977 in Minneapolis, so neither origin story should become an unqualified graph
fact. A 2021 company document reports more than 70,000 square feet of warehouse space and
one- or two-day service to most U.S. destinations; both are dated company claims. [L1 §1](./research/01-lejeunebolt-site-mining.md#1-company-profile),
[homepage](https://lejeunebolt.com/), [2021 capability statement](https://lejeunebolt.com/lbc/wp-content/uploads/2021/08/03-158-Capability-Statement.pdf),
[older brochure](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/lejeunebrochure.pdf).

The strongest succession signal is indirect. One public industry listing says average tenure is
more than 20 years, and the site biographies span purchasing, logistics, sales, testing, repair,
warehouse work, field training, and project support. The packet says veterans are retiring, but
no public source names a retirement or succession plan. Treat the retirement statement as
`PACKET / UNVERIFIED` until lunch discovery. [L1 §1, "Published team signal"](./research/01-lejeunebolt-site-mining.md#published-team-signal),
[L2, "Gaps"](./research/02-social-clients-and-projects.md#gaps),
[Short Span Steel Bridges supplier page](https://www.shortspansteelbridges.org/suppliers/lejeune-bolt-company/).

### Clients and projects

The first-party portfolio contains 38 LeJeune Bolt case pages plus seven additional TNA cases.
It supports a broad project mix, but most pages do not identify the contracting fabricator,
erector, or general contractor. The safest named examples for the demo are:

- U.S. Bank Stadium, where LeJeune says it supplied and supported steel construction and
  erection. [L1 §4](./research/01-lejeunebolt-site-mining.md#4-named-projects-and-clients),
  [project page](https://lejeunebolt.com/portfolio-items/us-bank-stadium/).
- Boeing 777X Wing Factory, which describes sequencing and coordination between an unnamed
  fabricator and erector. [L1 §4](./research/01-lejeunebolt-site-mining.md#4-named-projects-and-clients),
  [project page](https://lejeunebolt.com/portfolio-items/boeing-777x-wing-factory/).
- American Airlines Hangar 2 at O'Hare, which describes long F2280 TC bolts, multiple
  truckloads, secure-site clearance, and timed delivery. [L1 §4](./research/01-lejeunebolt-site-mining.md#4-named-projects-and-clients),
  [project page](https://lejeunebolt.com/portfolio-items/american-airlines-hanger-2-ohare/).
- Gerald Desmond Bridge and the San Francisco-Oakland Bay Bridge SAS span, which show special
  coating, sourcing, testing, and inspection demands. [L1 §4](./research/01-lejeunebolt-site-mining.md#4-named-projects-and-clients),
  [Gerald Desmond](https://lejeunebolt.com/portfolio-items/gerald-desmond-bridge/),
  [SAS span](https://lejeunebolt.com/portfolio-items/sas-bridge/).
- 110 North Wacker and Wilshire Grand, which show sequence packaging, just-in-time delivery,
  gang boxes, will-call, and pick-and-lift constraints. [L1 §4](./research/01-lejeunebolt-site-mining.md#4-named-projects-and-clients),
  [110 North Wacker](https://lejeunebolt.com/portfolio-items/110-north-wacker/),
  [Wilshire Grand](https://lejeunebolt.com/portfolio-items/wilshire-grand-center/).

NASA is narrower than the raw brief implied. Public sources support use of LeJeune's ASTM F3148
TNA system on NASA's Mobile Launcher 2 ground platform, not a separate NASA-owned family of
"proprietary fasteners." Mystic Lake Amphitheater remains `PACKET / UNVERIFIED`: public project
credits name the separate LeJeune Steel Company, not LeJeune Bolt. Do not merge those companies
or repeat either claim without project records and permission. [L2, "Packet jobs"](./research/02-social-clients-and-projects.md#packet-jobs),
[STRUCTURE sponsored post](https://www.structuremag.org/article/sponsored-post-this-bolt-launches-spaceships/),
[NASA ML2 video](https://www.youtube.com/watch?v=jYv677bn7Mg),
[Mystic Lake partner post](https://www.facebook.com/erastructural/posts/congratulations-to-the-entire-project-team-behind-the-mystic-lake-amphitheater-o/1638653270706240/).

### Products, standards, and a demo ontology

The public portfolio supports a compact ontology around `FastenerAssembly`,
`FastenerComponent`, `Standard`, `FinishCoating`, `Tool`, `LotCertification`,
`ProjectRequirement`, `FulfillmentUnit`, and `ApprovalTest`. Product families include tension-
control assemblies, heavy-hex structural assemblies, F3148 TNA fixed-spline assemblies, nuts,
washers, anchors, threaded rod, weld studs, and installation or verification tools. These are
source-derived classes, not LeJeune's internal data model. [L1 §2](./research/01-lejeunebolt-site-mining.md#2-product-taxonomy-as-a-draft-ontology),
[product portfolio](https://lejeunebolt.com/product-portfolio/),
[tool portfolio](https://lejeunebolt.com/tool-portfolio/),
[TNA bolts](https://www.tightenright.com/bolts/).

The core standards vocabulary includes ASTM F3125, F1852, F2280, F3148, A563, F436, F1554,
F959, B695, F2329, and F1136, with AISC, RCSC, AWS D1.1, AASHTO, AREMA, and ICC-ES as named
authorities. The RCSC 2020 edition groups A325/F1852 as strength group 120, F3148 as 144, and
A490/F2280 as 150, and recognizes the Combined Method. Standards and technical documents must
carry designation, revision, publisher, source, and effective date; old brochures and manuals
must not become timeless truth. [L1 §2, "Standards and controlled vocabularies"](./research/01-lejeunebolt-site-mining.md#standards-and-controlled-vocabularies),
[combined-method article](https://lejeunebolt.com/combined-method-and-tna-144-bolts-added-to-rcsc-2020-edition/),
[RCSC 2020 specification](https://www.boltcouncil.org/files/2020RCSCSpecification.pdf).

Three specification checks are ideal demo material because the agent can explain a refusal:
TC and F3148 products are matched assemblies; an F959 DTI must match the bolt strength; and an
A490 product must not be silently hot-dip galvanized. Any substitution still needs the proper
engineer or buyer approval. [L3 §2.1-§2.3](./research/03-fastener-distribution-process.md#21-why-a-bolt-assembly-needs-matched-nuts-washers-dtis),
[AISC bolting FAQ](https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/),
[Fastenal structural-bolt guide](https://blueprint.fastenal.com/structural-bolts.html),
[ASTM F959 guide](https://www.portlandbolt.com/technical/specifications/astm-f959/).

### RFQ to quote to source to order to specify

The public evidence and the brief reconstruct the following workflow. It is not a LeJeune SOP.
[L3 §1](./research/03-fastener-distribution-process.md#1-buyer--distributor--manufacturer-flow),
[AISC bolting FAQ](https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/),
[Portland Bolt ordering guide](https://www.portlandbolt.com/technical/faqs/how-to-order-bolts/).

1. A fabricator or erector sends an email, spreadsheet, drawing, PDF, photo, or call summary.
   The request may arrive across several messages. The distributor must recover specification,
   grade, type, style, diameter, length, finish, quantity and unit, domestic rule, certificates,
   ship-to, need-by date, tools, and substitution permission.
2. The distributor checks the drawing and governing standards. Missing `Type` is not permission
   to assume Type 1. "A325" plus a shear-wrench requirement may mean an F1852 assembly, but the
   agent may only flag or propose the interpretation.
3. The distributor compares stock, mill, and broker offers. A useful offer records price, ATP,
   lead time, pack quantity, origin, freight, certificate status, coating capability, lot rules,
   and offer timestamp. Named industry manufacturers include Nucor Fastener, Infasco, Haydon,
   and Unytite, but all are `UNVERIFIED` as LeJeune suppliers.
4. The quote combines price with availability, lead time, freight, documentation, matched-
   assembly requirements, tool rental, verification quantities, exclusions, and validity.
5. After a buyer PO, the distributor places a supplier PO, tracks partials and backorders,
   preserves lot identity, and manages sequence packaging and delivery constraints.
6. MTRs, CoCs, assembly test reports, RoCap records, lot tags, and mill/heat provenance travel
   with the fulfillment record. The agent should retrieve documents by part, lot, heat, and
   control number, not by filename alone.
7. The distributor explains companion parts and tools, disallowed combinations, compliance
   wording, and substitution choices. Any priced, external, or irreversible action stops for
   human review.

The veteran's advantage is exception memory: which customer means "domestic," which mill can
certify melt location, which finish fits a tool socket, how a TC length relates to grip, and
which inspector will require a separate test per lot combination. The useful graph claims are
therefore time-bound relationships and prohibitions, each attached to evidence, not a price
list presented as universal truth. [L3 §3.2 and §5](./research/03-fastener-distribution-process.md#32-per-supplier-what-the-veteran-has-in-a-notebook),
[BoltWise ERP-integration page](https://getboltwise.com/erp-integrations),
[RCSC 2020 specification](https://www.boltcouncil.org/files/2020RCSCSpecification.pdf).

### Microsoft 365 surfaces

The packet says Microsoft Office is the system of record; the public site does not confirm it.
The most plausible first corpus is Outlook RFQs and sent quotes, Excel takeoffs, PDF schedules,
SharePoint or OneDrive documents, and calendar context. [L3 §7](./research/03-fastener-distribution-process.md#7-implications-for-an-agent-this-packet),
[L1 §6](./research/01-lejeunebolt-site-mining.md#6-systems-suppliers-and-named-vendors).

| Surface                 | Useful first step                                        | Consent and product limit                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outlook mail            | Folder delta, message body or MIME, and attachment bytes | Delegated `Mail.Read` may still hit tenant policy. App-only access is admin-consented and broad. [L6 §3.1](./research/06-landscape-m365-and-competitors.md#31-mail--delta-mime-attachments), [Graph mail delta](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0)                                                |
| SharePoint and OneDrive | Drive delta plus local content download                  | Delegated access is limited to files the user can open. Encrypted or sensitivity-labeled content must stay protected. [L6 §3.3](./research/06-landscape-m365-and-competitors.md#33-sharepoint--onedrive-files), [Graph drive delta](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0)                          |
| Calendar                | Project and meeting context                              | The in-repo driver already has read methods; it is context, not a transcript. [L6 §3.4](./research/06-landscape-m365-and-competitors.md#34-outlook-contacts-and-calendar)                                                                                                                                                                     |
| Teams chat              | Later admin/consent project                              | The in-repo driver has no Teams API. Organization-wide export is admin-scoped. [L6 §3.2](./research/06-landscape-m365-and-competitors.md#32-teams-chat-and-meeting-transcripts), [Teams export](https://learn.microsoft.com/en-us/microsoftteams/export-teams-content)                                                                        |
| Meeting transcripts     | Later admin/consent project                              | Transcript read requires admin consent and may have metered limits. [L6 §3.2](./research/06-landscape-m365-and-competitors.md#32-teams-chat-and-meeting-transcripts), [call transcript](https://learn.microsoft.com/en-us/graph/api/resources/calltranscript?view=graph-rest-1.0)                                                             |
| PST export              | Demo fallback when Graph consent blocks                  | User export or authorized Purview export only; no tenant-wide collection at lunch. [L6 §3.8](./research/06-landscape-m365-and-competitors.md#38-exchange--outlook-pst-as-offline-fallback), [Purview export](https://learn.microsoft.com/en-us/purview/edisc-search-export)                                                                   |
| Copilot Retrieval API   | Optional hosted file retrieval                           | It covers SharePoint, OneDrive, and connectors, not mail, and does not build a local fastener graph. [L6 §3.5](./research/06-landscape-m365-and-competitors.md#35-copilot-retrieval-api--useful-but-not-mail), [Microsoft overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/retrieval/overview) |

### Vendors and competitors

BoltWise is the closest direct competitor: it markets fastener/MRO/PVF quote and PO automation,
supplier-library matching, and ERP write-back. Its named Business Edge integration leaves final
part matching and send/write-back with the rep. Proton, Prokeep, Mercura, ChannelFlex, Conexiom,
Workist, Epicor Prism, Infor Velocity, and Dynamics 365 Business Central cover adjacent inbox-
to-quote, order-entry, ERP-agent, or supplier-communication work. Most metrics in this market are
vendor claims; the demo must label them that way. [L6 §1](./research/06-landscape-m365-and-competitors.md#1-vendors-selling-ai-quoting-rfq-to-quote-email-order-capture-and-portal-ordering-to-distributors),
[BoltWise](https://getboltwise.com),
[Business Edge case](https://www.ci-inc.com/testimonials/transforming-fastener-distribution-through-innovation/),
[Proton launch](https://www.proton.ai/blog/proton-ends-rekeying-era-with-agentic-order-quote-entry-automation),
[Business Central agent](https://learn.microsoft.com/en-us/dynamics365/business-central/sales-order-agent-process).

The competitive gap is not generic RFQ extraction. Existing products already draft quotes and
orders. The distinctive claim worth testing is local, cited capture of veteran knowledge from
the Office corpus, with time-aware corrections and visible approval. No surveyed product was
shown to combine that full story for a fastener distributor. This is an inference from the
survey, not proof that no vendor has private capability. [L6 §1.5](./research/06-landscape-m365-and-competitors.md#15-what-this-category-does-not-cover-well),
[L6 §7](./research/06-landscape-m365-and-competitors.md#7-what-would-knock-the-socks-off-a-fastener-executive).

Named product and tool relationships on LeJeune's public site include TONE, Makita, Metabo HPT,
DeWalt, Skidmore-Wilhelm, SURSPIDER, and Unytite. Powers exclusivity and the 2018 Boulons Plus
distribution relationship are `UNVERIFIED` as current. Nucor, Infasco, Haydon, Portland Bolt,
and Applied Bolting appear in the industry or event landscape, not as confirmed LeJeune
suppliers. [L1 §6](./research/01-lejeunebolt-site-mining.md#6-systems-suppliers-and-named-vendors),
[tool portfolio](https://lejeunebolt.com/tool-portfolio/),
[Unytite case](https://www.tightenright.com/portfolio-items/unytite-manufacturing-plant/),
[Boulons Plus announcement](https://www.tightenright.com/boulons-plus-canadian-distributor/).

### Open-source KG and memory references

License governs what may be reused. The table records repository-level licenses verified from
the local checkouts; star counts and runtime readiness are intentionally omitted here.
[L5, "License register"](./research/05-open-source-references.md#license-register).

| Reference                        | Verified license                                        | Relevant idea                                                                 | Treatment                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TrustGraph                       | Apache-2.0                                              | Flow-based ingest, Graph RAG, document RAG, context cores                     | Port with attribution. [repo](https://github.com/trustgraph-ai/trustgraph)                                                                  |
| trustgraph-ui React root         | Apache-2.0                                              | Graph explorer, source view, chat and ingest patterns                         | Port named files with attribution; replace marks. [repo](https://github.com/trustgraph-ai/trustgraph-ui)                                    |
| trustgraph-ui Python proxy       | GPL-3.0-or-later                                        | Static/API proxy                                                              | Clean-room only. [repo](https://github.com/trustgraph-ai/trustgraph-ui)                                                                     |
| Local TrustGraph TypeScript port | Root license `UNVERIFIED`                               | Existing Beep Graph workbench and service stack                               | Reference-only until the owner adds a root license and attribution record. [L5 source row](./research/05-open-source-references.md#sources) |
| Cognee                           | Apache-2.0                                              | Provenance, hybrid and temporal retrieval, session and trace memory           | Integrate through a service boundary or port with notice. [repo](https://github.com/topoteretes/cognee)                                     |
| CogniWeave                       | MIT                                                     | Tri-pane, retrieval-strip, graph, approve/dismiss patterns                    | Port with notice; current synthesis/vector path is incomplete. [repo](https://github.com/CaptnRumpy/CogniWeave)                             |
| Graphiti                         | Apache-2.0                                              | Episodes, bi-temporal facts, hybrid retrieval, communities                    | Strong memory sidecar; it supplies no application UI. [repo](https://github.com/getzep/graphiti)                                            |
| Graphnosis                       | Apache-2.0                                              | Deterministic local retrieval, source lines, owner-adjudicated contradictions | Small-footprint reference or port with attribution. [repo](https://github.com/nehloo/Graphnosis)                                            |
| Graphify                         | Apache-2.0 with retained MIT notices for older portions | Confidence labels, communities, path/explain views                            | Port under the applicable notices. [repo](https://github.com/Graphify-Labs/graphify)                                                        |
| Falkor CodeGraph                 | MIT                                                     | Resizable graph/chat, expansion, path highlighting                            | Reuse interaction patterns, not its code ontology. [repo](https://github.com/FalkorDB/code-graph)                                           |
| Microsoft GraphRAG               | MIT                                                     | Batch community summaries                                                     | Poor fit for a living inbox; reference for static-corpus summaries. [repo](https://github.com/microsoft/graphrag)                           |
| Neo4j Community                  | GPL-3.0                                                 | Property-graph storage                                                        | Clean-room/reference-only under this packet's rule. [repo](https://github.com/neo4j/neo4j)                                                  |

## 2026-08-25 in-repo capability inventory

Maturity means source state, not a live environment. `works` identifies substantive code;
`partial` means required composition or runtime proof is absent; `stub` is an intentional shell.
Every row comes from [L4](./research/04-in-repo-capability-inventory.md).

| Demo feature                    | Package and source evidence                                                                                                                | Maturity                              | What is reusable and what is missing                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Outlook, files, sites, calendar | `@beep/m365`, `packages/drivers/m365/src/M365.config.ts:100-146`; `M365.service.ts:791-806,1071-1186`                                      | works; live tenant `UNVERIFIED`       | Delegated read-only Graph, retries, mail/calendar/site/drive reads. Checkpointed ingest and tenant proof are missing.                          |
| Attachments and Teams           | `packages/drivers/m365/src/M365.schemas.ts:567-575,605-614`                                                                                | **NOT FOUND** in driver API           | Message schema has only `hasAttachments`; no attachment download, Teams chat, or transcript methods.                                           |
| Agent-facing M365 reads         | `@beep/m365-mcp`, `packages/drivers/m365-mcp/README.md:3-18`                                                                               | works; launch `UNVERIFIED`            | Read-only MCP tools. Not an ingest job or write path.                                                                                          |
| PST export                      | `@beep/libpff`, `packages/drivers/libpff/src/Libpff.pffexport.ts:436-474,682-788`                                                          | partial                               | Deterministic EML export and relationship JSONL; native `pffexport` and downstream MIME parsing are required.                                  |
| PDF and DOCX text               | `@beep/doc-text`, `packages/drivers/doc-text/src/DocText.service.ts:125-163,179-224`                                                       | works                                 | Dependency-light text extraction. No OCR or quote schema.                                                                                      |
| Broad document extraction       | `@beep/file-processing`, `FileProcessing.service.ts:43-74,181-185`; `@beep/tika`, `Tika.tikaapp.ts:142-203`                                | partial                               | Real contracts and Tika adapters. Concrete engine/runtime composition remains.                                                                 |
| Grounded line-item extraction   | `@beep/langextract`, `Service.layer.ts:44-104`; `VerifiedSpan.behavior.ts:641-683`                                                         | works; model run `UNVERIFIED`         | Exact span alignment. Fastener schema, examples, evaluation set, and provider setup are **NOT FOUND**.                                         |
| Local lexical/hybrid retrieval  | `@beep/wink`, `packages/drivers/wink/src/WinkCorpus.service.ts:511-671`                                                                    | works                                 | Local BM25, vectors, and similarity. No domain ontology.                                                                                       |
| RDF and provenance              | `@beep/rdf`, `packages/foundation/modeling/rdf/src/Rdf.ts:765-806,1113-1153`; `Evidence.ts:200-285`; `Prov.ts:975-1085`                    | works                                 | RDF, datasets, JSON-LD, evidence selectors, and PROV models.                                                                                   |
| Ontology, SPARQL, SHACL         | `@beep/ontology-*`, `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:310-490`; `Session.validation.ts:671-895`           | backend works; UI stub                | File-backed sessions, queries, inference, validation, provenance. Fastener ontology and usable editor UI are **NOT FOUND**.                    |
| Graph store and rendering       | `@beep/oxigraph`, `Oxigraph.sparql.ts:202-286`; `@beep/cosmos`, `Cosmos.renderer.ts:331-587`                                               | works in source; runtime `UNVERIFIED` | SPARQL and graph rendering exist. Durable Oxigraph persistence and lab wiring are not established by L4.                                       |
| Claims and contradictions       | `@beep/epistemic-*`, `CandidateClaim.model.ts:49`; `Evidence.model.ts:55`; `Contradiction.model.ts:43`; `GovernedTierGate.gate.ts:250-415` | works; persistence partial            | Evidence, contradiction, fail-closed egress, and review UI. This is not a procurement approval product.                                        |
| Agent runtime and context       | `@beep/agents-*`, `ProfessionalRuntime.contracts.ts:672-784`; `ProfessionalRuntime.service.ts:40-50`                                       | partial                               | Evidence-bounded context packets exist; current proof is fixture-backed. Production context assembly is **NOT FOUND**.                         |
| Durable agent memory            | `packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:308-417`; `Thread.layer.ts:32-84`                                     | **NOT FOUND** as semantic memory      | Thread storage exists, but no production `ContextGraph` or durable semantic `Memory` service was found.                                        |
| Approval transport              | `@beep/acp`, `packages/drivers/acp/src/AcpRpc.models.ts:28-343`                                                                            | works                                 | Permission and elicitation models exist. Order proposal, approve/reject UX, and seller write connector are **NOT FOUND**.                      |
| Local vertical bundle           | `@beep/practice-kg-mcp`, `apps/practice-kg-mcp/src/runtime/Host.ts:51-114`; `PracticeKg.projections.ts:572-645`                            | works                                 | Best pattern: curated inputs to PGlite graph, DuckDB FTS, provenance, and read-only MCP. Fastener vertical is **NOT FOUND**.                   |
| In-repo workbench               | `apps/labs/trustgraph-workbench/src/App.tsx:1-7`                                                                                           | stub                                  | One heading, no pipeline, routes, backend, or deploy stack.                                                                                    |
| Semantica                       | `apps/labs/semantica/src/canary/Command.ts:63-160`; `src/runtime/Layer.ts:44-76`                                                           | stub                                  | Intended ingest/extract/serve seams all stop at `StageNotImplemented`; its current charter is construction, not demo UX.                       |
| Tailnet exposure                | `@beep/tailscale`, `packages/drivers/tailscale/src/Tailscale.service.ts:134-216,297-443`; `infra/src/AIMetrics.ts:149-216`                 | works; deployment partial             | Status, Serve, HTTPS probe, MagicDNS URL, and one infra precedent exist. No lab process, health probe, data path, or Serve composition.        |
| External Beep Graph workbench   | `~/YeeBois/dev/trustgraph/ts/packages/workbench/src/App.tsx:28-46`; `deploy/docker-compose.yml:20-500`                                     | partial; runtime `UNVERIFIED`         | Nine routes and a broad Compose stack exist. Root license, current deployment, and 31 documented parity gaps block an unqualified reuse claim. |

The honest five-day cut is a deterministic local corpus, a small ontology, source-linked line
items, a timestamped supplier snapshot, a cited spec answer, and a non-executing order proposal
with approve/reject. Live M365 is a stretch. Live seller ordering is outside the inventoried
capability. [L4, "Capability-to-demo mapping"](./research/04-in-repo-capability-inventory.md#capability-to-demo-mapping).

## 2026-08-25 constraints discovered

1. **Public-site collection needs restraint.** The lane made 550 source requests and retained
   a much smaller normalized corpus. Firecrawl was unavailable locally. A custom crawler
   `User-Agent` caused 403 responses across all 198 URLs in the first bulk pass, while the
   earlier plain request profile returned 200. Test the exact request profile against two pages,
   honor `robots.txt` and sitemaps, rate-limit, cache, deduplicate, and stop on blocks. Do not
   treat a successful plain profile as permission to evade controls. [L1, "Scope and method"](./research/01-lejeunebolt-site-mining.md#scope-and-method),
   [friction receipt](./research/OPPORTUNITIES.md#2026-08-25-custom-crawler-user-agent-triggered-site-wide-403-responses),
   [homepage](https://lejeunebolt.com/).
2. **Supplier portals are not browser-automation targets.** Grainger bars scraping and robots;
   Fastenal permits EDI, email, or fax commerce only by agreement. Use published APIs,
   punchout, or agreed EDI. The demo ends at a draft cart or PO and a human action. [L6 §6.2](./research/06-landscape-m365-and-competitors.md#62-supplier-portal-terms-of-service-vs-automated-ordering),
   [Grainger terms](https://www.grainger.com/content/terms-of-access),
   [Fastenal legal terms](https://www.fastenal.com/fast/legal-information).
3. **M365 consent can stop the live ingest.** Delegated access is bounded by the signed-in
   user's rights, but tenant policy can still require an admin. Application mail access and Teams
   transcripts are admin work. Use single-user delegated reads, never log bodies, and rehearse a
   PST fallback. [L6 §3.6](./research/06-landscape-m365-and-competitors.md#36-app-registration-and-consent-model-what-lunch-can-vs-cannot-do),
   [Microsoft permissions overview](https://learn.microsoft.com/en-us/graph/permissions-overview).
4. **The corpus contains confidential business information.** Mail, drawings, prices, supplier
   terms, and certificates need source-level authorization, field-level access, retention and
   deletion rules, and a no-training promise. Do not put bank, tax, principal, or trade-reference
   fields into general agent memory. [L1 §10](./research/01-lejeunebolt-site-mining.md#10-gaps-and-verification-queue),
   [credit application](https://lejeunebolt.com/lbc/wp-content/uploads/2016/07/creditapplication.docx).
5. **License discipline is a build constraint.** Apache-2.0 and MIT code may be ported with
   notices; GPL components are clean-room only under the packet rule; missing or unverified
   licenses are reference-only. The local TypeScript workbench has no verified root license, so
   it cannot be copied or shipped as Option A until the owner fixes that record. [L5, "License register"](./research/05-open-source-references.md#license-register).
6. **Tailnet-only is a product boundary.** The later capture explicitly rejects a public SaaS
   deployment. The demo should run on one controlled host, store its corpus locally, expose one
   HTTPS MagicDNS endpoint with Tailscale Serve, and invite only named attendees. The deployed
   state is still `UNVERIFIED`. [CAPTURE, 2026-08-25 later](./CAPTURE.md#2026-08-25-later),
   [L4 §F](./research/04-in-repo-capability-inventory.md#f-infrastructure-and-tailnet-deployment).
7. **The appetite is five working days.** No option can safely add tenant onboarding, broad
   mail backfill, OCR for arbitrary drawings, current multi-supplier integrations, a production
   memory engine, and real portal ordering in that time. Fixed scenarios and an offline fallback
   are required. [L4, "Recommended five-day cut"](./research/04-in-repo-capability-inventory.md#recommended-five-day-cut).
8. **Public data is ontology seed, not operational truth.** Current stock, sell price, cost,
   margin, lead time, approved suppliers, authority, project compliance, and lot certificates
   require authorized operational data. All demo offers must be stamped `SYNTHETIC` or carry an
   as-of timestamp and source. [L1 §9](./research/01-lejeunebolt-site-mining.md#9-what-the-public-corpus-can-seed-for-the-demo),
   [contact form](https://lejeunebolt.com/contact-us/).

## 2026-08-25 open questions for align

Each question closes a branch. The recommendation is a research-stage proposal, not a recorded
decision.

1. **What single promise should the lunch demo prove?** Recommended: "A messy RFQ becomes a
   cited, reviewable quote and specification draft informed by retained expert knowledge." It
   combines the frequent transaction with the strategic succession problem and avoids claiming
   absent order execution.
2. **What data should the first rehearsal use?** Recommended: use the mined public corpus plus
   synthetic email, quote, supplier-offer, project, and certificate fixtures. Treat a delegated
   Outlook login as a stretch only after explicit consent. This keeps the demo deterministic and
   prevents lunch from turning into tenant administration.
3. **Which UI architecture is authorized?** Recommended: choose Option C now, or Option A only
   after the TypeScript port gets an explicit root license and attribution record. Option B
   conflicts with Semantica's current construction-only boundary.
4. **How much ontology is enough?** Recommended: freeze the nine public classes above plus
   `SupplierOffer`, `RFQ`, `QuoteLine`, and `ExpertClaim`. That supports the storyline without
   attempting a complete ASTM or ERP master.
5. **What counts as memory in the demo?** Recommended: one reviewed expert correction with
   source, valid-from, supersedes, reviewer, and effect on a later recommendation. Do not call a
   chat transcript or browser persistence "agent memory."
6. **How should supplier price and availability appear?** Recommended: a timestamped synthetic
   snapshot with two or three suppliers, split ATP, lead time, origin, certificate status, and
   expiry. No website or portal scrape should be presented as current inventory.
7. **Where does automation stop?** Recommended: generate a draft supplier PO or cart, display
   policy checks and evidence, require approve/edit/reject, then emit a non-executing receipt.
   Real submission waits for an agreed API, punchout, or EDI path.
8. **What may the specification assistant decide?** Recommended: it may detect missing fields,
   explain cited rules, refuse known-bad combinations, and propose an RFI or substitution. An
   authorized human or engineer remains the decision-maker.
9. **What is the M365 fallback hierarchy?** Recommended: prepared local fixtures first,
   single-user delegated Outlook/OneDrive second, user-authorized PST third, and Teams or
   tenant-wide collection later. This orders the paths by demo reliability and consent burden.
10. **What retention promise should accompany the tailnet deployment?** Recommended: keep the
    corpus under a machine-local data root, invite named tailnet users, log access and approvals,
    and delete the corpus on a stated date unless LeJeune authorizes a pilot.
11. **What paid follow-up should the demo ask for?** Recommended: a two- to four-week discovery
    and pilot around one consenting mailbox and one RFQ class, measured by accepted draft rate,
    time to reviewed quote, correction reuse, and citation coverage. Price the managed outcome,
    not a chatbot seat, only after baseline measurement.
