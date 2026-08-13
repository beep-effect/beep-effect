# USPTO Patent Driver Depth — Decisions

The seven 2026-06-29 recommendations were align seeds, not decisions. The
2026-07-14 align gate supersedes them with the eight locked resolutions below.
In particular, graduation of the docketing spine changed the answers to Q2,
Q5, Q6, and Q7.

## 2026-07-14 — Q1: Driver-wave scope

**Status:** LOCKED

**Question:** Does this wave deepen `@beep/uspto` in place, or fan out into
international and commercial patent-data drivers?

**Answer:** Deepen `@beep/uspto` in place first, exclusively for capabilities
the docketing spine needs. EPO OPS and Google Patents BigQuery remain separate,
consumer-pulled candidate goals. SerpApi is parked, and ppubs is at most a
best-effort experiment.

**Rationale:** The official USPTO read path now has a named consumer and can
produce useful, credential-bounded depth without coupling the first wave to
OAuth, GCP billing, attribution, or scraping risk.

**Rejected options:** One patent-data mega-goal; graduating EPO or BigQuery
without a named product pull; treating SerpApi or ppubs as a committed tier.

## 2026-07-14 — Q2: First vertical slice

**Status:** LOCKED — changed by docketing graduation

**Question:** What is the smallest end-to-end proof that should graduate first?

**Answer:** A known-application prosecution-event read: application number to a
schema-decoded, provenance-bearing prosecution observation containing numeric
status and description, `eventDataBag` transaction events, an authoritative
office-action/document reference, typed technical failures, and a fixture-backed
contract test shaped for the patent-spine intake port. P0 must first verify the
current office-action endpoint and envelope and decide whether transaction
events come from the dedicated Patent File Wrapper path or an aggregate
projection.

**Rationale:** The graduated patent spine needs official prosecution evidence,
not a general query builder. This slice proves the driver-to-intake contract
while keeping legal interpretation and scheduling out of the driver.

**Rejected options:** Query DSL as the first slice; a broad application-search
surface; deadline computation in `@beep/uspto`; assuming either Patent File
Wrapper transactions or OA Text Retrieval is authoritative without a live
reconciliation spike.

## 2026-07-14 — Q3: `searchStructured`

**Status:** LOCKED

**Question:** Should structured application search enter the committed public
contract now?

**Answer:** No. `searchStructured` stays out until a live spike proves the
applications endpoint's method, body, field list, pagination, and error behavior.
When admitted, it must preserve the real asymmetry: `filters` use
`name`/`value[]`, while `rangeFilters` and `sort` use `field`.

**Rationale:** Structured POST is confirmed for PTAB, not for the applications
endpoint. Publishing an inferred request contract would turn an evidence gap
into public API debt.

**Rejected options:** Shipping the secondary-source POST shape as fact; hiding
the uncertainty behind a permissive record; coupling structured search to the
first prosecution-read slice.

## 2026-07-14 — Q4: Native vocabulary lifecycle

**Status:** LOCKED

**Question:** How are USPTO status and event vocabularies made deterministic?

**Answer:** Generate a package-private, deterministic artifact carrying source
identity, retrieval date, checksum, and refresh command. Runtime
`/status-codes` access may detect and report drift but never silently changes
decode semantics. Refreshes produce reviewable diffs. The same mechanism owns
all four native vocabularies together: application status codes, OA transaction
event codes, document codes, and `PTMNFEE2` maintenance event codes.
Prosecution-affecting changes require a separately versioned, attorney-reviewed
rule update in the patent spine.

**Rationale:** Offline decode and fixture-based CI need stable meanings.
Separating native vocabulary refresh from legal rule versions makes drift
visible without letting a network response rewrite docketing semantics.

**Rejected options:** Runtime cache as decode authority; hand-maintained maps;
silent mutation on drift; mixing USPTO-native descriptions with legal phase or
deadline rules.

## 2026-07-14 — Q5: Placement and translation boundary

**Status:** LOCKED — changed by docketing graduation

**Question:** Where do native decoding, legal meaning, ports, and translation
belong?

**Answer:** `packages/drivers/uspto` owns USPTO-native schemas, codes, and
technical OA/`PTMNFEE2` decoding. Future independent wrappers live in
`packages/drivers/epo` and `packages/drivers/google-patents-bigquery`.
`law-practice/domain` owns `ProsecutionPhase` and deadline-relevant semantics;
`law-practice/use-cases` owns driver-neutral ports; `law-practice/server` is the
only place that translates `@beep/uspto` records and errors into those ports.
There is no `drivers/_shared`, no `ClaimLifecycle` overload, and no competing
law-practice overlay goal in this packet.

**Rationale:** The docketing packets now own the legal model and intake port.
Keeping native facts in drivers and all translation in the server adapter
prevents transport vocabulary from becoming domain doctrine.

**Rejected options:** Driver-owned prosecution phases or deadlines; translation
inside use-cases; a shared cross-driver abstraction before two consumers exist;
reusing `ClaimLifecycle`; creating another law-practice goal from this packet.

## 2026-07-14 — Q6: Credential and matter-consent controls

**Status:** LOCKED — changed by docketing graduation

**Question:** How are technical source capability and matter authorization kept
independent and enforced?

**Answer:** Drivers and MCP `SourceAuth` own technical capability metadata:
source, operation class, public-identifier versus free-text, credential class,
cost class, and attribution. Law practice owns a matter authorization record
with approver, matter, source, operation class, scope, expiry or revocation,
consent provenance, and audit evidence. Both controls are enforced at the
law-practice server adapter and MCP dispatch gate. Credential presence never
implies matter consent. Public-identifier reads default allowed; every external
free-text operation requires explicit matter-level authorization. BigQuery also
requires cost authorization and retention of CC BY attribution.

**Rationale:** Source authentication answers whether a call can be made; matter
authorization answers whether it may be made for this representation. The
graduated docketing boundary supplies the matter context that the driver cannot
own.

**Rejected options:** Credential-as-consent; source-wide opt-in flags; treating
official USPTO free-text search as privilege-safe; putting matter authorization
inside a driver; omitting cost or attribution policy from BigQuery dispatch.

## 2026-07-14 — Q7: MCP boundary and gate defaults

**Status:** LOCKED — changed because `mcp-kit` and `uspto-mcp` shipped

**Question:** Which MCP host and gate policy should new operations use?

**Answer:** Reuse shipped `@beep/mcp-kit`. Existing ODP tools retain the shipped
soft gate. Future EPO, BigQuery, and SerpApi toolkits default to hard gates.
Keyless sources use `none` plus matter-consent dispatch policy. New USPTO
operations extend `packages/drivers/uspto-mcp`; no second USPTO MCP package is
created. The dependency is `goals/mcp-kit` and the shipped `uspto-mcp` boundary,
not the superseded exploration that produced them.

**Rationale:** `SourceAuth`, credential-keyed composition, the typed
`api_key_required` envelope, and `TierGate` already exist. This packet only
extends their use with operation/source metadata and matter-aware dispatch.

**Rejected options:** A second USPTO MCP host; re-deriving conditional layer
composition; changing shipped ODP tools to hard gates; treating `SourceAuth` as
the matter-consent decision.

## 2026-07-14 — Q8: `PTMNFEE2` ingestion

**Status:** LOCKED

**Question:** How should the official maintenance-fee events product enter the
docketing spine?

**Answer:** Treat `PTMNFEE2` as weekly cumulative ASCII snapshots. Discover with
an ODP account/API key, checksum-pin the release, and perform validated
full-replace ingestion in `@beep/uspto`; never append snapshots. The driver owns
technical decoding only, while docketing goals own legal interpretation.
Small attributed fixtures are supportable under Public Domain Mark 1.0 with
release, checksum, and extraction provenance.

**Rationale:** Each weekly file is cumulative event evidence, not a delta or a
deadline table. Separating faithful parse from legal interpretation preserves
reissue, lapse, reinstatement, and calendar-rule review in the patent spine.

**Rejected options:** Per-record API polling; append-only snapshot ingestion;
driver-computed deadlines or current legal status; invented 2026 layouts or
event-code lists; unattributed fixtures.

## 2026-07-14 — Deferred implementation spikes

### OA endpoint and envelope

**Status:** DEFERRED to `uspto-prosecution-read` P0.

Prove the current office-action endpoint and response envelope, reconcile Patent
File Wrapper transactions with OA Text Retrieval, and identify whether the
observation's transactions come from a dedicated endpoint or an aggregate
projection. This blocks implementation detail, not shape sign-off.

### `searchStructured` live contract

**Status:** DEFERRED to `uspto-search-structured` P0 or a separately approved
slice.

Prove method, request body, field list, pagination, and typed error behavior on
the applications endpoint before admitting a public method.

### Vocabulary-generation retrieval route

**Status:** DEFERRED to `uspto-prosecution-read` P0.

Prove one authoritative retrieval route and checksum stability for the generated
application-status, OA-event, document-code, and `PTMNFEE2`-event artifacts.

## 2026-08-13 — Holding-pen graduation convention — LOCKED

**Answer:** Graduate the packet now that its two promised-now goals exist. Keep
`uspto-search-structured`, `epo-driver`,
`google-patents-bigquery-driver`, and the SerpApi lane in `MAP.md` as re-entry
points. A fired spike or consumer gate reopens this packet at `decompose`; it
does not spawn a goal directly.

**Rationale:** Spike-gated, consumer-pulled, and parked provider lanes preserve
future routing without holding the official USPTO-depth exploration open.
