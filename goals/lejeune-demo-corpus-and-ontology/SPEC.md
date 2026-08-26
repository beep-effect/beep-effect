# LeJeune Demo Corpus and Ontology Spec

## Objective

Build a deterministic, machine-local bundle for the fixed LeJeune lunch scenario. The bundle
combines public material with synthetic Office fixtures, preserves exact source spans, applies
three cited fastener rules, and projects the same normalized records into PGlite, DuckDB, and a
bounded in-memory Oxigraph dataset.

This packet supplies the capability required by
[`lejeune-knowledge-desk-lab`](../lejeune-knowledge-desk-lab/README.md). Both packets deliver
into one proposed `lejeune-bolt-workbench` lab (under `apps/labs/`); this packet does not create
or promote a second package.

Provenance: graduated 2026-08-26 from
[`explorations/lejeune-bolt-agentic-demo`](../../explorations/lejeune-bolt-agentic-demo/README.md).

## Non-Goals

- No second corpus, ontology, fixture, or shared workspace package.
- No promotion of the fastener schemas, rules, or operations into shared or foundation
  packages. Promotion requires a later explicit decision.
- No real Microsoft 365, PST, customer correspondence, supplier portal, price feed, inventory
  feed, or purchasing integration.
- No arbitrary OCR, drawing understanding, general document ingestion, full ERP ontology, or
  comprehensive standards engine.
- No raw website pages, binaries, copied standards, product catalog, third-party corpus
  payloads, or anonymized customer RFQ in the repository or lunch bundle.
- No uncited compliance claim, engineer-of-record judgment, substitution approval, quote send,
  supplier order, or other external write.

## Source Hierarchy

1. The ratified
   [`DECISIONS.md`](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md), especially the
   2026-08-26 shape-review decisions.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture, lab-app, schema-first, and Effect-first standards.
4. The source exploration's
   [`BRIEF.md`](../../explorations/lejeune-bolt-agentic-demo/BRIEF.md) and
   [`MAP.md`](../../explorations/lejeune-bolt-agentic-demo/MAP.md).
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Lab-local schemas, internal modules, fixtures, and operations in the proposed
  `lejeune-bolt-workbench` lab (under `apps/labs/`).
- A machine-local immutable demo bundle containing normalized records, recorded provider
  outputs, citations, hashes, and deterministic projections.
- A separately mounted mutable machine-local review/corpus surface governed by the
  2026-09-30 disposition date.
- `goals/lejeune-demo-corpus-and-ontology/` for contracts, proof, and closeout evidence.

The lab packet owns the customer-facing screen. Its day-1 scaffold may proceed on stubs, but
bundle integration and lab acceptance require the capability declared by this packet.

## Constraints

### Fixture contract

- Freeze exactly two RFQ layouts:
  1. an Outlook body table plus an attached XLSX takeoff;
  2. a prose email plus an attached PDF schedule.
- Each layout splits relevant facts across the message and attachment and leaves at least one
  required field missing. The expected output must preserve the missing value rather than
  infer it.
- Include timestamped synthetic supplier offers and lot certificates. Every such record and
  every screen projection of it is visibly labeled `SYNTHETIC`.
- Public-site input is read from the sanctioned machine-local corpus. Raw public payloads,
  customer samples, and third-party documents never enter the repository.

### Frozen domain

The ontology contains exactly these 12 top-level classes:

1. `ProductVariant`
2. `Component`
3. `Standard`
4. `Finish`
5. `Tool`
6. `SupplierOffer`
7. `Project`
8. `RFQ`
9. `QuoteLine`
10. `LotCertificate`
11. `Approval`
12. `ExpertClaim`

Schemas remain lab-local and schema-first. Every external input is decoded at its boundary.
The packet must not introduce a general fastener, catalog, ERP, or procurement ontology.

### Cited rule checks

Each result stores the governing source, revision or access date, matched facts, disposition,
and exact source evidence. The fixed checks are:

1. Matched-assembly requirements for the applicable structural-bolt cases, grounded in the
   exploration's
   [assembly research](../../explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md#21-why-a-bolt-assembly-needs-matched-nuts-washers-dtis).
2. ASTM F959 DTI strength matching to the bolt strength, grounded in the same
   [DTI section](../../explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md#21-why-a-bolt-assembly-needs-matched-nuts-washers-dtis).
3. Refusal to silently hot-dip galvanize A490, grounded in the
   [coating-compatibility research](../../explorations/lejeune-bolt-agentic-demo/research/03-fastener-distribution-process.md#27-galvanizing--coating-compatibility).

The checks are advisory citations, not engineering approval. A substitution or ambiguous case
must stop for an RFI or qualified human decision.

### Extraction and projection

- Parse the supported email-body, XLSX, and text-layer PDF fixtures without promising OCR.
- Use `@beep/langextract` for structured exact-span extraction. Every normalized field that
  came from source text must slice back to the recorded source.
- Follow the practice-KG pattern: PGlite holds graph-shaped application and review state;
  DuckDB holds the corpus catalog and full-text index; in-memory Oxigraph receives only a
  bounded RDF projection for query and validation.
- Projection rebuilds from the same normalized input must return identical fixture query
  results and stable bundle metadata. Oxigraph is not durable storage.
- The bundle separates immutable fixture/replay data from mutable approvals and reviewed
  claims.

### Replay, provider, and retention

- Replay-first is the lunch contract. The bundle embeds recorded successful provider outputs
  needed by the golden run, so the complete scenario replays with network and provider
  unavailable.
- Day-1 acceptance includes one live `@beep/anthropic` extraction over public or synthetic
  data. If that call fails, try `openai-compat`, `venice-ai`, or `xai` the same day. A live call
  never becomes a lunch dependency.
- Provider recordings contain no secret, raw authorization header, or undisclosed real data.
- Delete the mutable machine-local corpus on 2026-09-30 unless an explicit promotion or
  consented pilot grants a new retention term. Authored packet history and source ledgers
  remain.

## Decision Log

Binding detail remains in the exploration; these rows identify what this goal executes.

| Decision | Packet consequence |
| --- | --- |
| [Lunch data boundary](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--lunch-data-boundary) | Public machine-local corpus plus synthetic Office records only. |
| [Two RFQ layouts](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--which-two-rfq-layouts-should-the-demo-fix) | Freeze the Outlook/XLSX and prose/PDF pairs, each split and incomplete. |
| [Ontology and rules](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--freeze-which-ontology-and-rule-check-slice) | Twelve lab-local classes and exactly three cited checks. |
| [Provider posture](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--which-model-provider-posture-should-the-demo-use) | Hosted extraction may record output; fixed replay is the offline path. |
| [Single lab package](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-26--single-lab-package) | Both packets deliver into one lab package; no promotion now. |
| [Replay-first](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-26--replay-first-lunch-demo) | The recorded golden run, not a live provider call, is the lunch artifact. |
| [Disposition date](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--what-deletion-date-governs-the-lab-and-corpus) | Mutable corpus deletes or receives explicit promotion on 2026-09-30. |

## Acceptance Criteria

- [ ] The two fixed RFQ pairs parse into deterministic source documents; facts remain split,
      and each fixture yields at least one explicit missing-field result.
- [ ] Every extracted source-backed field has an exact `@beep/langextract` span that slices to
      its recorded text.
- [ ] The 12-class ontology is the complete lunch class set and remains lab-local.
- [ ] Each of the three rules has positive and refusal or mismatch fixtures, opens the cited
      governing source, and records uncertainty or human-stop behavior where applicable.
- [ ] Every supplier offer and lot certificate is timestamped and labeled `SYNTHETIC`.
- [ ] PGlite, DuckDB, and bounded Oxigraph projections rebuild deterministically and return the
      committed golden queries and citations.
- [ ] One live day-1 extraction succeeds through `@beep/anthropic` or one same-day fallback;
      the provider output needed for the golden run is recorded safely.
- [ ] With network and provider unavailable, replay completes with the same normalized records,
      rule results, citations, and bundle identity.
- [ ] Raw corpus payloads, customer data, third-party binaries, and secrets are absent from the
      repository.
- [ ] The mutable corpus exposes its 2026-09-30 delete-or-promote disposition.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/lejeune-demo-corpus-and-ontology/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/lejeune-demo-corpus-and-ontology/ops/manifest.json` | Passes |
| Fixture contract | Package-local schema and fixture tests | Two split layouts; missing fields retained |
| Exact spans | Package-local extraction tests | Every recorded span slices to its source |
| Rules | Golden rule-check tests | Three cited rules; positive and refusal paths |
| Projection rebuild | Golden PGlite, DuckDB, and Oxigraph queries | Identical results from identical inputs |
| Offline replay | Recorded golden run with provider and network disabled | Same bundle identity and visible outputs |
| Data boundary | Tracked-file and bundle inventory | No prohibited payload or secret |
| Repository quality | `bun run beep yeet verify` | Green on the final tree |
| Whitespace | `git diff --check -- goals/lejeune-demo-corpus-and-ontology` | Passes |

## Stop Conditions

- Required exploration sources are missing, materially contradictory, or cannot support one
  of the three cited checks.
- A raw corpus payload, real correspondence, customer RFQ, secret, or unauthorized third-party
  content would enter the repository or demo bundle.
- The implementation proposes another workspace package or promotion outside the lab.
- Exact spans, deterministic projection rebuild, or offline replay cannot be proven.
- A rule result would imply engineer-of-record, substitution, compliance, pricing, or purchasing
  authority.
- Verification requires unnamed credentials, cost, destructive side effects, or policy
  approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
