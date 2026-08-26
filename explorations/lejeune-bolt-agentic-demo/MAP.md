# LeJeune Knowledge Desk map

**RATIFIED 2026-08-26 — shape review passed; decompose complete**

**GRADUATION EXECUTED 2026-08-26:** the promised-now work now lives in
[`lejeune-demo-corpus-and-ontology`](../../goals/lejeune-demo-corpus-and-ontology/README.md)
and
[`lejeune-knowledge-desk-lab`](../../goals/lejeune-knowledge-desk-lab/README.md).
Build starts on Benjamin's signal.

## Candidate goal packets

| Slug | Commitment | Mission | Depends on |
| --- | --- | --- | --- |
| `lejeune-demo-corpus-and-ontology` | Promised now for lunch | Build the machine-local public and synthetic fixture bundle, small fastener ontology, exact-span extraction set, and deterministic projections. | None |
| `lejeune-knowledge-desk-lab` | Promised now for lunch | Build the disposable customer-demo lab that runs the fixed 30-minute scenario through review, memory reuse, PO draft, and tailnet delivery. | `lejeune-demo-corpus-and-ontology` |
| `lejeune-m365-pilot` | Gated re-entry | Ingest one consented mailbox or PST, adjudicate veteran claims, and measure RFQ review and citation outcomes. | Lunch proof, consent, pilot scope, and retention terms |
| `trustgraph-port-licensing-and-component-donor` | Gated re-entry | License Benjamin's TypeScript port, record attribution, prove the trimmed workbench, and identify named components safe to donate. | Benjamin's license decision |

The first two packets are the lunch promise, and both deliver into exactly one new workspace
package: the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`). The M365 and TrustGraph
packets do not block that promise. When either gate fires, reopen this exploration at
`decompose` before creating its goal packet, as required by the exploration graduation contract.

## Capability check

### `lejeune-demo-corpus-and-ontology`

- **Document extraction, EXISTING.** `@beep/doc-text` extracts PDF text layers and DOCX text at
  `packages/drivers/doc-text/src/DocText.service.ts:125-163,179-224`.
- **Exact-span extraction, EXISTING.** `@beep/langextract` aligns structured output to source at
  `packages/foundation/capability/langextract/src/Service/Service.layer.ts:44-104` and
  `VerifiedSpan/VerifiedSpan.behavior.ts:641-683`.
- **RDF, evidence, identity, and validation, EXISTING.** Use `@beep/rdf`, `@beep/identity`,
  `@beep/ontology-*`, `@beep/oxigraph`, and `@beep/shacl`; the exact paths and current maturity
  are in [lane 04 §C](./research/04-in-repo-capability-inventory.md#c-knowledge-graph-substrate).
- **Deterministic local bundle, EXISTING PATTERN.** Follow the PGlite graph, DuckDB full-text,
  provenance, and read-only tool pattern at
  `packages/law-practice/server/src/PracticeKg.projections.ts:572-645` and
  `apps/practice-kg-mcp/src/runtime/Host.ts:51-114`.
- **Fastener domain, NET-NEW.** RFQ schemas, the 12-class ontology, three fixed rule checks,
  synthetic offers and certificates, two RFQ layouts, and their evaluation set do not exist in
  the inventory. [Lane 04 capability mapping](./research/04-in-repo-capability-inventory.md#capability-to-demo-mapping).
- **Corpus builder, NET-NEW.** Turn the machine-local site corpus and synthetic Office fixtures
  into hashed, dated PGlite, DuckDB, and bounded RDF projections. Keep raw payloads outside the
  repo. [Option C pipeline](./research/08-demo-options.md#architecture-and-pipeline-2).

### `lejeune-knowledge-desk-lab`

- **Lab lifecycle, EXISTING LAW.** Create the app through `bun run beep create-package`; do not
  hand-build the workspace. The lab owns a deletion-dated charter and no public API.
  [Option C risks](./research/08-demo-options.md#risks-2).
- **Tool and approval boundaries, EXISTING.** `@beep/mcp-kit` and `@beep/acp` provide governed
  tools, permissions, and elicitation at
  `packages/foundation/capability/mcp-kit/README.md:3-4,17-20,28-48` and
  `packages/drivers/acp/src/AcpRpc.models.ts:28-343`.
- **Graph view, EXISTING BUT UNVERIFIED.** `@beep/cosmos` renders graphs at
  `packages/drivers/cosmos/src/Cosmos.renderer.ts:331-587`. Browser proof and lab wiring are
  missing, so the slice needs a table-and-source fallback.
- **Tailnet delivery, EXISTING BUT UNVERIFIED.** `@beep/tailscale` covers status, Serve, HTTPS,
  and MagicDNS at `packages/drivers/tailscale/src/Tailscale.service.ts:134-216,297-443`.
  `infra/src/AIMetrics.ts:144-222` is the service, Serve, and health-check precedent.
- **Customer demo UI, NET-NEW.** The single-screen RFQ, evidence, graph or table, quote review,
  memory diff, and PO draft do not exist.
- **Review semantics, NET-NEW.** Quote and claim approve/edit/reject, temporal supersession, and
  the non-executing PO receipt need app-specific schemas and behavior. Existing epistemic models
  are evidence and contradiction bricks, not a procurement product.
  [Lane 04 inventory](./RESEARCH.md#2026-08-25-in-repo-capability-inventory).
- **Lab process and tailnet packaging, NET-NEW.** Add `/health`, corpus/build metadata without
  message bodies, mounted immutable and mutable paths, a user service or small Compose unit, and
  one Serve mapping. [Option C deployment](./research/08-demo-options.md#tailnet-deployment-2).

### `lejeune-m365-pilot`

- **Delegated Microsoft Graph reads, EXISTING BUT LIVE TENANT UNVERIFIED.** `@beep/m365` reads
  mail, calendar, sites, and drives at
  `packages/drivers/m365/src/M365.service.ts:791-806,1071-1186`.
- **PST export, EXISTING BUT PARTIAL.** `@beep/libpff` emits deterministic EML and relationship
  JSONL at `packages/drivers/libpff/src/Libpff.pffexport.ts:436-474,682-788`.
- **Checkpointed mailbox ingest, attachment download, and MIME normalization, NET-NEW.** The
  current driver does not expose attachment download and no complete EML normalization package
  was found. [Lane 04 §A and §B](./research/04-in-repo-capability-inventory.md#a-microsoft-365-ingestion).
- **Consent, claim-adjudication operations, retention, and measurement, NET-NEW.** The pilot must
  bind access, review roles, deletion terms, and metrics to one authorized corpus.

### `trustgraph-port-licensing-and-component-donor`

- **Workbench routes, EXTERNAL AND PARTIAL.** The local port has nine routes at
  the TrustGraph port workbench `App.tsx` routes (machine-local checkout; see research/04 §G), plus a broad unverified
  Compose stack and 31 documented parity gaps.
- **Root license and attribution, NET-NEW GATE.** The port remains reference-only until Benjamin
  adds a root MIT or Apache-2.0 license and an attribution record.
- **Named donor inventory and trimmed runtime proof, NET-NEW.** Identify specific source, graph,
  layout, and approval interaction components, then prove only the services they require.
  [Option A risks](./research/08-demo-options.md#risks).

## Sequencing

1. **Freeze decisions, fixtures, ontology, and rule checks.** Done 2026-08-26: the align round
   ratified every proposed detail without reopening the operator-ratified Option C, lunch
   boundary, or five-day appetite ([`DECISIONS.md`](./DECISIONS.md)).
2. **Build `lejeune-demo-corpus-and-ontology`.** The deterministic bundle is the shared contract
   for extraction, retrieval, citations, spec checks, synthetic offers, and veteran correction.
   It gives the UI stable data and keeps provider or network failures out of the critical path.
3. **Build `lejeune-knowledge-desk-lab` against that bundle.** Add the one-screen story,
   approve/edit/reject records, temporal rerun, PO draft, service packaging, tailnet Serve, and
   offline rehearsal.
4. **Re-enter for `lejeune-m365-pilot` only after consent and commercial scope.** Replace one
   fixture class with one authorized mailbox or PST and measure the same review outcomes.
5. **Re-enter for the TrustGraph donor independently.** Licensing may proceed on day zero, but
   the lunch lab does not wait for it. Donate only named components after license and runtime
   proof.

This ordering keeps the two promised-now packets deterministic and makes both gated packets
optional. It follows the Option C recommendation and the consent and license constraints.
[Option C recommendation](./research/08-demo-options.md#recommendation),
[research constraints](./RESEARCH.md#2026-08-25-constraints-discovered).

## First vertical slice

The first slice spans the two promised-now packets. A reviewer opens one synthetic RFQ project,
sees exact source spans and missing fields, opens a cited specification refusal, compares two
synthetic supplier offers, approves one veteran correction, reruns the RFQ, and ends at a
non-executing PO receipt. The same flow works from the local bundle with the network and model
provider unavailable.
[30-minute storyline](./research/07-use-case-evaluation.md#exact-30-minute-demo-storyline).

### Five-day schedule

| Day | Outcome |
| --- | --- |
| 1 | Package generator, deterministic bundle skeleton, `@beep/anthropic` live smoke test, and screen scaffold. |
| 2 | Full 30-minute story on stubs and a half-day `@beep/cosmos` browser timebox. |
| 3 | Real extraction for two RFQ layouts, rule checks, citations, and uncertainty. |
| 4 | Veteran correction and temporal rerun, synthetic offers, quote and non-executing PO receipts, and approve/edit/reject records. |
| 5 | Service packaging, `/health`, tailnet Serve, fixed-scenario tests, recorded rehearsal, and offline fallback proof, with roughly half a day reserved for governance gates. |

This is the Option C schedule from
[lane 08](./research/08-demo-options.md#five-day-plan-2). Benjamin's shape review settled the
day-3 extraction slice at exactly two RFQ layouts.

### Slice acceptance

- The recorded replay-first golden run is the lunch demo artifact, and every beat is
  deterministic from the fixed local bundle.
- One live `@beep/anthropic` extraction call is a day-1 acceptance item. On failure, fall to
  `openai-compat`, `venice-ai`, or `xai` the same day.
- `@beep/cosmos` gets a half-day browser timebox on day 2. If the demo graph does not render in
  the browser inside the box, the lunch ships table and source with no renegotiation and no
  static-image stand-in.
- The day-5 rehearsal is recorded through `bun run beep qa` and proves the offline fallback.
- The exact 30-minute sequence completes from the fixed local bundle.
- Each extracted line, rule answer, supplier-offer cell, and reused correction opens its source
  or exact span.
- Every lunch offer is marked `SYNTHETIC` and dated.
- Approve/edit/reject creates an internal record. Quote send and PO submission remain impossible.
- `/health`, the MagicDNS HTTPS endpoint, and the named-user tailnet boundary are proven.
- Provider failure has a fixed-output fallback.
- The app and mutable demo corpus carry the proposed 2026-09-30 disposition date.

## Open risks inherited from the brief

- **Align is closed.** Every choice in `DECISIONS.md` was ratified on 2026-08-26; reopening one
  requires a new dated entry, not an edit.
- **Five days leave little recovery margin.** New schemas, fixtures, UI, review behavior, and
  packaging must stay within the fixed scenario.
  [Option C risks](./research/08-demo-options.md#risks-2).
- **Graph rendering and model providers lack live proof.** Table, source, and fixed-output
  fallbacks are part of the slice, not optional polish.
  [Lane 04 inventory](./RESEARCH.md#2026-08-25-in-repo-capability-inventory).
- **Supplier portals and M365 can change the authorization boundary.** The lunch uses neither;
  the pilot needs consent and agreed interfaces.
  [Research constraints](./RESEARCH.md#2026-08-25-constraints-discovered).
- **The TrustGraph port cannot donate code before licensing.** Option C must stay clean-room with
  respect to that checkout until the gate closes.
  [License register](./research/05-open-source-references.md#license-register).
- **Public technical material is dated and copyrighted.** Store designations, revisions,
  selectors, and source links. Do not reproduce whole standards or third-party corpora.
  [Site-mining implications](./research/01-lejeunebolt-site-mining.md#9-what-the-public-corpus-can-seed-for-the-demo).
- **Public project claims can be ambiguous.** Do not use unverified Mystic Lake or broad NASA
  claims in the fixed scenario.
  [Projects research](./RESEARCH.md#clients-and-projects).
