# Demo architecture options

Date: 2026-08-25

## Decision summary

Recommend **Option C**, a narrow the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`) that composes existing beep
bricks and permissively licensed UI patterns. It gives the five-day demo a deterministic local
bundle, explicit evidence and approval boundaries, and a small tailnet deployment without
depending on the full TrustGraph runtime.

Option A is the fallback only if two day-zero gates pass: the TypeScript port receives a clear
root license and attribution record, and its trimmed stack starts cleanly with the required
routes. Option B should not be used for this lunch. Semantica is a deliberate construction
canary whose current ingest, extract, and serve commands all stop at `StageNotImplemented`.
[L5, "Options matrix"](./05-open-source-references.md#options-matrix),
[L4 §E](./04-in-repo-capability-inventory.md#e-lab-applications).

The destination for every option is Benjamin's tailnet, never a public SaaS endpoint. The later
capture records the tailnet as the deployment target; the six lanes did not verify that a demo
service is already running there. [CAPTURE, 2026-08-25 later](../CAPTURE.md#2026-08-25-later),
[L4 §F](./04-in-repo-capability-inventory.md#f-infrastructure-and-tailnet-deployment).

## Shared demo contract

All three options implement the same small vertical slice:

```text
public site + synthetic Office records
  -> parse mail, PDF, DOCX, XLSX fixture rows
  -> normalize into the fastener ontology
  -> enrich with standards, supplier offers, projects, tools, lots, and evidence
  -> persist locally in PGlite + DuckDB
  -> load a bounded RDF dataset into Oxigraph for SPARQL and SHACL checks
  -> retrieve with graph filters + DuckDB FTS/BM25 + cited source spans
  -> draft clarification, quote, certificate packet, and supplier PO
  -> approve / edit / reject
  -> stop at a non-executing receipt
```

PGlite stores graph-shaped application rows and review state. DuckDB stores the corpus catalog,
source metadata, supplier snapshots, and full-text index. The current `@beep/oxigraph` driver
creates an in-memory store for a request, so it is a query and validation engine, not durable
persistence. [L4 §C, "RDF stores, validation, canonicalization, and visualization drivers"](./04-in-repo-capability-inventory.md#rdf-stores-validation-canonicalization-and-visualization-drivers),
`packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-194,253-290`.

The minimal ontology is `ProductVariant`, `Component`, `Standard`, `Finish`, `Tool`,
`SupplierOffer`, `Project`, `RFQ`, `QuoteLine`, `LotCertificate`, `Approval`, and `ExpertClaim`.
Every extracted or remembered claim carries source, exact span where available, publication or
message date, confidence, reviewer state, and validity. [L1 §2](./01-lejeunebolt-site-mining.md#2-product-taxonomy-as-a-draft-ontology),
[L4 §C](./04-in-repo-capability-inventory.md#c-knowledge-graph-substrate).

## Option A: brand the TrustGraph TypeScript port workbench

### Architecture and pipeline

Use `~/YeeBois/dev/trustgraph/ts/packages/workbench` as the presentation layer, but keep the
LeJeune corpus builder in beep-effect. A build command produces a PGlite plus DuckDB bundle using
the same deterministic pattern as `apps/practice-kg-mcp`. A small adapter exposes quote lines,
source records, graph neighborhoods, search, and approval state to one workbench route. Oxigraph
loads a bounded RDF projection for SPARQL and SHACL checks. The TrustGraph NATS, FalkorDB,
Qdrant, agent, RAG, and worker services are enabled only if the route actually needs them.
[L4 §G](./04-in-repo-capability-inventory.md#g-external-trustgraph-typescript-port),
`~/YeeBois/dev/trustgraph/ts/deploy/docker-compose.yml:20-500`,
`apps/practice-kg-mcp/src/runtime/Host.ts:51-114`.

The flow is:

1. Mine the public corpus and load synthetic Outlook, Excel, PDF, supplier, and certificate
   fixtures from a machine-local directory.
2. Use `@beep/doc-text`, `@beep/file-processing`, and `@beep/langextract` to produce cited quote
   lines and candidate claims.
3. Normalize and validate the small fastener ontology; store the durable bundle in PGlite and
   DuckDB.
4. Expose graph and hybrid retrieval to the existing Library, Graph, and Chat interaction
   patterns.
5. Add one approval panel that writes a decision and a non-executing order receipt.

### Branding surface

The existing sidebar already says `Beep Graph`, while the chat still contains `TrustGraph` and
generic Graph RAG, Doc RAG, and Agent labels. Replace all product marks on the demo route with
`LeJeune Knowledge Desk`, use LeJeune-inspired colors without copying protected artwork, and
rename modes to `Quote`, `Specification`, and `Evidence`. The source rail and approval panel
should remain visible at all times. [L4 §G, "Branding and license assessment"](./04-in-repo-capability-inventory.md#branding-and-license-assessment),
`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/components/layout/sidebar.tsx:166`,
`~/YeeBois/dev/trustgraph/ts/packages/workbench/src/pages/chat.tsx:39-41,266`.

### Tailnet deployment

Build a minimal Compose profile containing the workbench, the adapter/API, and only the proven
backend services. Mount the corpus and bundle read-only from a host path outside both repos.
Add an app-specific `/health` endpoint. On the demo host, use `@beep/tailscale` to read
`tailscale status --json`, configure Tailscale Serve, derive the MagicDNS HTTPS URL, and verify
the endpoint. Do not reuse its hard-coded `/.well-known/t3/environment` probe unless the demo
implements that route. The AI-metrics infrastructure is the closest checked-in pattern for a
generated Compose file, user service, Serve configuration, and curl health check.
`packages/drivers/tailscale/src/Tailscale.service.ts:134-216,297-443`,
`infra/src/AIMetrics.ts:144-222`.

### Five-day plan

| Day | Outcome                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clear root license and attribution; start the trimmed stack; freeze ontology and fixtures. If either gate fails, switch to C before noon. |
| 2   | Build PGlite/DuckDB bundle and adapter; render one project and its source records.                                                        |
| 3   | Wire quote and specification retrieval with source spans and fixed rule checks.                                                           |
| 4   | Finish branding, approval panel, expert correction, and non-executing PO receipt.                                                         |
| 5   | Package minimal Compose profile, expose on tailnet, test fixed scenarios, and rehearse offline fallback.                                  |

### Risks

- The port has no verified root license or standalone repository URL. Its client package's
  Apache declaration does not license the whole checkout. It is reference-only until fixed.
- The declared Compose stack is large and was not started in lane 04. Source composition is not
  runtime proof.
- The parity ledger lists 31 scoped gaps: 24 missing and seven partial. Ontology, provenance,
  orchestration, and store gaps could land directly on this demo.
- A PGlite/DuckDB adapter is net-new because the port's native stack centers on FalkorDB and
  Qdrant.
- Mixed branding and unused routes can make a narrow proof look unfinished.

[L5, "Recommendation"](./05-open-source-references.md#recommendation),
`~/YeeBois/dev/trustgraph/ts/docs/parity/00-gap-matrix.md:20-74`.

## Option B: extend `apps/labs/semantica`

### Architecture and pipeline

Implement Semantica's planned `ingest`, `extract`, and `serve` stages, then add a temporary web
projection. Ingest reads the local corpus and synthetic Office fixtures through the file-
processing seam. Extract uses DocText or Tika plus LangExtract. Normalize writes the small
fastener graph to PGlite, the corpus and FTS projection to DuckDB, and an RDF projection for
Oxigraph/SHACL. Serve exposes read-only search, evidence, graph, and draft-action methods. A new
React route provides the graph, source rail, quote form, and approval panel.
[L4 §E](./04-in-repo-capability-inventory.md#e-lab-applications),
`apps/labs/semantica/src/canary/Command.ts:23-30,63-160`,
`apps/labs/semantica/src/runtime/Layer.ts:44-76`.

### Branding surface

The current UI is a heading and paragraph, so nearly all branding and interaction work is new.
Use a single `LeJeune Knowledge Desk` screen, not a generic Semantica explorer. Keep Semantica's
name in build metadata only. Tauri adds no value to a tailnet web demo and should stay out of the
critical path. `apps/labs/semantica/src/App.tsx:1-29`,
`apps/labs/semantica/package.json:14-42`.

### Tailnet deployment

Run the implemented server and Vite-built web UI as one bounded host service. Add `/health`, a
fixed read-only bundle path, and a separate writable decision ledger. Use the same Tailscale
status, Serve, MagicDNS, and HTTPS proof as Option A, based on
`packages/drivers/tailscale/src/Tailscale.service.ts:134-216,297-443` and
`infra/src/AIMetrics.ts:144-222`.

### Five-day plan

| Day | Outcome                                                                         |
| --- | ------------------------------------------------------------------------------- |
| 1   | Replace `StageNotImplemented` for ingest; freeze ontology and fixture manifest. |
| 2   | Implement extraction, normalization, PGlite/DuckDB bundle, and tests.           |
| 3   | Implement serve/search/evidence methods and SPARQL/SHACL checks.                |
| 4   | Build the entire demo UI, approval flow, and branding.                          |
| 5   | Add host service, health check, tailnet Serve, scenario tests, and rehearsal.   |

### Risks

- All three named canary stages intentionally fail today. The plan is almost entirely net-new.
- Its ratified boundary is KG construction and evaluation, while the workbench owns retrieval and
  graph UX. A lunch UI would blur that boundary.
- Tauri and headless canary concerns consume time without improving the tailnet story.
- Five days leave almost no recovery margin for model, extraction, or deployment failures.

[L5, "Comparison with current beep labs"](./05-open-source-references.md#comparison-with-current-beep-labs-and-the-typescript-port).

## Option C: new the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`)

### Architecture and pipeline

Create a customer-demo lab with an explicit, disposable charter. Reuse the proven practice-KG
shape rather than the legal ontology:

1. A build process reads the mined corpus, synthetic EML or normalized Graph messages, Excel
   rows, PDFs, supplier replies, and certificate fixtures.
2. `@beep/file-processing`, `@beep/doc-text`, optional Tika, and `@beep/langextract` emit
   document records, exact spans, normalized RFQ lines, and candidate expert claims.
3. `@beep/rdf`, `@beep/identity`, ontology projections, and SHACL enforce the fastener model.
4. PGlite persists graph-shaped vertical records, reviews, and approvals. DuckDB persists the
   catalog, hashes, source metadata, supplier snapshots, and FTS. Oxigraph evaluates bounded RDF
   queries in memory.
5. Read-only MCP or RPC tools expose corpus search, RFQ lines, claims, evidence, graph neighbors,
   rule checks, and supplier offers. `@beep/mcp-kit` provides the governed tool boundary.
6. One React screen uses `@beep/ui` and `@beep/cosmos`: RFQ and quote on the left, graph and
   source evidence in the center, approval and memory change on the right.
7. An action service may parse, retrieve, compare, and draft automatically. Quote send and PO
   placement produce approve/edit/reject records and stop before any external write.

[L4 §H](./04-in-repo-capability-inventory.md#h-oppold-ip-law-practice-kg-bricks-as-a-vertical-template),
`apps/practice-kg-mcp/README.md:3-37`,
`packages/law-practice/server/src/PracticeKg.projections.ts:572-645`,
`packages/foundation/capability/mcp-kit/README.md:3-4,17-20,28-48`.

### Branding surface

Brand the entire small app rather than reskinning generic routes. Use `LeJeune Knowledge Desk`
as a working title, a restrained industrial palette, role labels such as `Inside sales review`
and `Technical review`, and domain nouns throughout. The hero screen should show a messy RFQ
becoming a cited quote, not a graph without a business action. Port only named Apache/MIT
interaction patterns after adding notices; do not copy the GPL Python proxy, unlicensed
TypeScript port code, or upstream marks. [L5, "What to port, integrate, or clean-room in one
week"](./05-open-source-references.md#what-to-port-integrate-or-clean-room-in-one-week).

### Tailnet deployment

Build one web artifact and one Effect API process. Store the immutable bundle and mutable
approval ledger in separate mounted directories. Expose `/health` and a build/corpus manifest
that contains no secrets or message bodies. Run as a user service or small Compose unit on the
tailnet host. Use `@beep/tailscale` to verify daemon/account state and configure one HTTPS
MagicDNS Serve mapping. Apply the `infra/src/AIMetrics.ts:144-222` pattern for preflight,
service lifecycle, Serve status, and health proof; no public DNS or Cloudflare resource is
needed.

### Five-day plan

| Day | Outcome                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Run the repo package generator, ratify the lab boundary, freeze ontology and fixture scenarios, and create the deterministic bundle skeleton. |
| 2   | Parse two or three RFQ layouts into exact-span line items; load public standards, projects, synthetic offers, and certificates.               |
| 3   | Implement graph plus FTS retrieval, rule checks, citations, uncertainty, and one temporal expert correction.                                  |
| 4   | Finish the single branded screen, approve/edit/reject flow, and non-executing quote and PO receipts.                                          |
| 5   | Add service packaging, `/health`, tailnet Serve, fixed-scenario tests, visual rehearsal, and a completely local fallback.                     |

### Risks

- A new package and UI are still real work. The implementation must use the repo generator and
  architecture workflow rather than hand-made folders.
- Fastener schemas, rules, fixtures, and UI are net-new. Scope must stay at two or three RFQ
  layouts and a small rule set.
- Live Graph attachment retrieval, MIME normalization, and supplier connectors remain missing.
- External UI code needs per-file license notices and new branding. Clean-room composition with
  `@beep/ui` is safer when provenance is unclear.
- `@beep/cosmos` and model providers have source implementations but were not browser- or
  provider-tested in lane 04. Preserve a table/source-only visual fallback.

## Reproducible `lejeunebolt.com` mining sketch

The corpus stays machine-local at `~/data-home/lejeune-bolt-corpus/` and is never committed.
The previous lane made 550 requests and retained page, PDF, and attachment records. Its first
bulk pass failed because an honest crawler `User-Agent` received 403 for all 198 requested URLs,
while an earlier plain request returned 200. That difference is diagnostic evidence only. The
miner must keep its honest identity and stop the whole run on any `401`, `403`, or `429`; it must
not switch to a browser profile or retry around the refusal. [L1, "Scope and method"](./01-lejeunebolt-site-mining.md#scope-and-method),
[403 friction receipt](./OPPORTUNITIES.md#2026-08-25-custom-crawler-user-agent-triggered-site-wide-403-responses).

The checked-in runner is [`ops/mine-site.ts`](../ops/mine-site.ts). It needs only Bun and the
repository's existing dependencies:

```sh
bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts --dry-run
bun run explorations/lejeune-bolt-agentic-demo/ops/mine-site.ts \
  --root ~/data-home/lejeune-bolt-corpus
```

The runner fetches each allowed host's robots policy, preflights two pages with the same honest
identity used by the crawl, recursively expands sitemap indexes, and performs one link-closure
pass. It accepts only allowlisted HTTPS URLs, including redirect targets. Successful responses
move from temporary files into a staged run only after status, content type, size, and SHA-256
checks pass. Validation publishes the run and updates `current`; a refusal or interruption leaves
the `.staging` directory and `run.log` for diagnosis.

Implementation requirements for the real script:

- Resolve the corpus root through `realpath` before writing. Refuse paths inside the checkout or
  any path containing `/beep-effect`.
- Write atomically to a dated run directory, then update a local `current` pointer only after the
  manifest and hashes validate.
- Keep raw pages, extracted text, PDFs, and attachments separate. Never store form submissions,
  credentials, cookies, or authenticated pages.
- Record `EXTRACTED`, `INFERRED`, and `UNVERIFIED` status in the normalized graph, not in the raw
  corpus.
- Reuse only content backed by a validated 2xx manifest row. On later runs, map first, fetch new
  candidates, and cap requests per host.
- Keep technical documents as cited source material. Do not reproduce copyrighted standards or
  whole sites in the public repository.

## Recommendation

Choose Option C and treat the app as a customer-demo lab with a deletion date, not a new general
platform. Reuse the practice-KG bundle and governance patterns, keep Oxigraph in-memory, and
deploy one web/API unit to Benjamin's tailnet. Preserve Option A as a day-zero escape hatch after
license and runtime proof. Reject Option B for this appetite. The five-day definition of done is
the exact 30-minute scenario in `07-use-case-evaluation.md`, repeatable from a fixed local bundle,
with no live supplier write and no public endpoint.
