# Synthesis Adversarial Review

## 1. MISSED DIAMONDS

### Finding 1 - DXOS was reduced to indexing/service shape and lost provenance, conflict, cursor, and pullback diamonds

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:27`, §2 DIAMONDS MATRIX: "Four-position or exact-handle indexing for deterministic retrieval."

> `20-repo-mining-synthesis.md:28`, §2 DIAMONDS MATRIX: "Service/layer boundary with one API over memory/local and persistent/graph stores."

What the ground truth says:

`explorations/identity-as-iri/research/repos/dxos-semantic-index.md`, §7 DIAMONDS:

> `dxos-semantic-index.md:80`: "Preserve assertion, attribution, valence, and provenance as separate channels."

> `dxos-semantic-index.md:82`: "Treat conflicts as query-time data, not write-time overwrite."

> `dxos-semantic-index.md:84`: "Copy the cursor idea for source-index maintenance."

> `dxos-semantic-index.md:86`: "The pure graph adapter is a useful `pullback` mental model."

Recommended correction:

Add separate clean-room DXOS diamonds for provenance/valence channel separation, query-time conflict handling, source cursor maintenance, and graph-adapter/pullback shape. Keep the existing indexing and service-boundary rows, but they are not enough to represent the report.

### Finding 2 - Skygest deterministic vocabulary generation was dropped from the diamonds matrix

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:25`, §2 DIAMONDS MATRIX: "Entity-local modules that co-locate schema, IRI derivation, triples, reverse mapping, and projections."

> `20-repo-mining-synthesis.md:30`, §2 DIAMONDS MATRIX: "Projection metadata drift checks and declared retrieval metadata keys."

What the ground truth says:

`explorations/identity-as-iri/research/repos/skygest.md`, §9 DIAMONDS:

> `skygest.md:143`: "Deterministic vendored-vocabulary generation is worth adopting as a clean-room phase 1/phase 3 idea."

> `skygest.md:143`: "Skygest pins ontology Turtle inputs, parses them into a class table, emits Effect Schema modules plus `iris.ts`, and tests generated output for drift"

Recommended correction:

Add a Skygest clean-room diamond for deterministic vendored-vocabulary generation and drift tests. The prototype guidance should distinguish "vocab data schema" from "generated/reconciled vocab artifact with drift proof."

### Finding 3 - Ontosphere dataset-faithful export, canonical hash proof, diagnostics loop, and provenance-isolation diamonds were under-weighted

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:26`, §2 DIAMONDS MATRIX: "Named graph partitioning for asserted data, ontology, inferred data, shapes, workflows, and provenance."

> `20-repo-mining-synthesis.md:91`, §5 OPEN-QUESTION INPUT: "Exact indexed retrieval is the recurring useful pattern"

What the ground truth says:

`explorations/identity-as-iri/research/repos/ontosphere.md`, §9 DIAMONDS:

> `ontosphere.md:136`: "Dataset-faithful exports are a strong proof surface."

> `ontosphere.md:136`: "Phase 3: fold+projection proof should include dataset-faithful N-Quads/TriG and canonical hash checks."

> `ontosphere.md:137`: "Reasoning plus validation plus repair is the right user-facing loop."

> `ontosphere.md:139`: "Provenance should be kept out of semantic reasoning and export by default."

Recommended correction:

Keep named graph partitioning, but add distinct Ontosphere diamonds for dataset-faithful N-Quads/TriG canonical hash checks, the diagnostics/repair loop, and provenance exclusion from semantic reasoning/export.

## 2. MISATTRIBUTION

### Finding 1 - Ontograph is over-cited for "SHACL report data with severity policy"

VERDICT: QUESTIONABLE

What the synthesis says:

> `20-repo-mining-synthesis.md:29`, §2 DIAMONDS MATRIX: "SHACL validation as structured report data, with severity policy separate from graph construction."

> `20-repo-mining-synthesis.md:29`, §2 DIAMONDS MATRIX source list: "effect-ontology.md §7, §9; ontograph-core.md §7, §9; skygest.md §7, §9"

What the ground truth says:

`explorations/identity-as-iri/research/repos/ontograph-core.md`, §7 Validation and §9 DIAMONDS:

> `ontograph-core.md:65`: "`SHACLValidator.validate` iterates data records, chooses a shape by the record's `@type`, validates each property, and returns conforms/results/timestamp."

> `ontograph-core.md:127`: "Runtime SHACL generation and validation are separate from authoring."

By contrast, the severity-policy part is directly supported by `effect-ontology.md`, §7:

> `effect-ontology.md:131`: "Policy validation can log only, fail on violations, or fail on warnings according to `ValidationPolicy`."

And report-data severity is directly supported by `skygest.md`, §7:

> `skygest.md:57`: "The SHACL domain distinguishes severities, violations, validation reports, and engine errors, and a non-conforming report is represented as data instead of thrown as an error"

Recommended correction:

Split the row. Attribute "SHACL generation/validation separate from authoring" to Ontograph, and reserve "structured report data with severity policy" for effect-ontology and Skygest.

## 3. LICENSE VIOLATIONS

clean

Checked every row in the synthesis license ledger against the report license sections. DXOS remains FSL-1.1-Apache-2.0 reference-only, n3-types remains reference-only, and Skygest remains reference-only for repo code. The MIT/Apache rows match their reports: effect-ontology, n3, ontograph-core, ontology-master, ontorite, ontosphere, owl-fol-translator, rdfjs-types, and rdflib-js. No synthesis row upgrades a reference-only source to adopt-as-is, adapt, or port-with-attribution.

## 4. OVERCLAIMS

### Finding 1 - "Exact indexed retrieval is the recurring useful pattern" overstates mixed retrieval evidence

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:91`, §5 OPEN-QUESTION INPUT: "Exact indexed retrieval is the recurring useful pattern: rdflib indexes subject, predicate, object, and graph; DXOS has memory/SQLite layers over fact triples; Ontosphere separates named graphs and canonicalization; Skygest projection contracts declare metadata keys and reject drift."

> `20-repo-mining-synthesis.md:93`, §5 OPEN-QUESTION INPUT: "define a v4 service whose local layer indexes identity, IRI, CURIE, schema handle, and projection metadata exactly"

What the ground truth says:

`explorations/identity-as-iri/research/repos/dxos-semantic-index.md`, §5 Retrieval API and §8 ROUGH:

> `dxos-semantic-index.md:19`: "Predicate retrieval normalizes the query predicate and stored predicate, then accepts exact normalized matches plus substring matches in either direction"

> `dxos-semantic-index.md:96`: "Avoid substring predicate matching in the registry."

`explorations/identity-as-iri/research/repos/skygest.md`, §11 D1-D9 DELTA TABLE:

> `skygest.md:180`: "Skygest does not implement our Fibered kit, but it does bind projection contracts, metadata drift checks, entity runtime catalog entries, AI Search projection shapes, and entity search hydration by IRI or query"

Recommended correction:

Say exact indexed retrieval is strongly supported by rdflib and by the ID-first parts of DXOS, while DXOS fuzzy predicate matching and Skygest AI/search projection evidence must be treated as separate discovery/search surfaces outside the registry.

## 5. DECISION-PRESSURE ERRORS

### Finding 1 - D7 is presented as corpus consensus when the design authority keeps it open and the reports only provide partial pressure

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:59`, §4 DECISION PRESSURE: "multiple repos agree against a fold-only user experience for intrinsic facts"

> `20-repo-mining-synthesis.md:67`, §5 OPEN-QUESTION INPUT: "The corpus favors building the fold channel first and then adding inline intrinsic facts only if they compile into the same tuple grammar."

What the ground truth says:

Design authority, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`, §2 Decisions:

> `identity-iri-fibration-handoff.md:106-114`: "D7 - Where relational facts live: OPEN." It lists inline, fold-only, or both, says the recommendation on file is both channels, and says: "Implement the fold channel first regardless"

`explorations/identity-as-iri/research/repos/skygest.md`, §11 D1-D9 DELTA TABLE:

> `skygest.md:179`: "Skygest places facts in several locations: per-entity `toTriples`, entity definitions, a predicate registry, D1 entity-link tables, and app-side graph builders"

`explorations/identity-as-iri/research/repos/ontorite.md`, §10 ROUGH:

> `ontorite.md:204`: "Generic triple buckets become a second model."

> `ontorite.md:204`: "our D6 model should keep relation facts as one schema-validated tuple grammar instead of letting generic buckets become peer authoring channels."

Recommended correction:

Rewrite the D7 pressure as: "D7 remains open by authority. Skygest provides entity-local ergonomics pressure; Ontorite provides a warning against generic second channels; the fold-first order comes from the handoff, not from corpus consensus."

## 6. PROTOTYPE-GUIDANCE GAPS

### Finding 1 - PN_LOCAL escaping is deferred below where the handoff and N3 report place it

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:81`, §5 OPEN-QUESTION INPUT: "ship full-IRI fallback first for any slash/dot local that is not proven safe, with a shared PN_LOCAL codec and tests before adding escaped-local emission."

> `20-repo-mining-synthesis.md:99`, §6 PROTOTYPE GUIDANCE: "Add a PN_LOCAL projection helper that emits a prefixed name only when safe and otherwise emits `<fullIRI>`"

What the ground truth says:

Design authority, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`, §9 Phased plan:

> `identity-iri-fibration-handoff.md:380-385`: "Phase 1 - Vocab + CURIE types" includes "PN_LOCAL escaper" and acceptance criteria for codec round-trips and property-based tests.

`explorations/identity-as-iri/research/repos/n3.md`, §7 DIAMONDS and §8 ROUGH:

> `n3.md:171`: "Phase 1 PN_LOCAL escaper design should copy N3's parser-side acceptance model, not its writer-side contraction model."

> `n3.md:189`: "the Phase 1 escaper and Phase 3 Turtle projection should share one codec so parseable and printable CURIE/local-name rules stay aligned"

Recommended correction:

Keep full-IRI fallback as the initial Turtle writer policy, but do not defer the PN_LOCAL codec/escaper. Prototype step 1 should build the shared PN_LOCAL codec in Phase 1; step 3 should consume it and may still choose full-IRI fallback for unsafe emission.

### Finding 2 - Prototype guidance omits the handoff's mandatory §8 migrations and Ontorite's idempotent sweep lesson

VERDICT: CONFIRMED-ERROR

What the synthesis says:

> `20-repo-mining-synthesis.md:61`, §4 DECISION PRESSURE: "The corpus reinforces separate owned/borrowed channels and a migration gate for legacy `identifier` overloading."

> `20-repo-mining-synthesis.md:108`, §6 PROTOTYPE GUIDANCE: "Add drift/canary tests: generated vocab drift, projection metadata key drift, wrong-shape domain/range canaries, and byte-stable round trips where possible."

What the ground truth says:

Design authority, `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`, §8 Migrations and §9 Phased plan:

> `identity-iri-fibration-handoff.md:358`: "Migrations / retro-fixes (do these regardless of phases)"

> `identity-iri-fibration-handoff.md:362-367`: "`identifier` overloading", the `parent_class_of` direction bug, and Dublin Core migration are mandatory fixes.

> `identity-iri-fibration-handoff.md:400-401`: Phase 3 acceptance includes "§8 migrations applied to `Ontology_models.ts`"

`explorations/identity-as-iri/research/repos/ontorite.md`, §9 DIAMONDS:

> `ontorite.md:188`: "Idempotent migration/sweep passes."

> `ontorite.md:188`: "our owned identity annotations and borrowed predicate channels should have explicit migration gates instead of overloading one annotation key."

Recommended correction:

Add a prototype step in Phase 3 for the §8 migrations, with idempotent migration/sweep tests. Do not leave the migration gate as a D9 note without execution order.

### Finding 3 - Projection proof guidance omits Ontosphere's dataset-faithful/canonical hash proof surface

VERDICT: QUESTIONABLE

What the synthesis says:

> `20-repo-mining-synthesis.md:105`, §6 PROTOTYPE GUIDANCE: "Ship the cheapest projections first: JSON-LD context, Turtle, and a simple Markdown view, all as pure folds from the assembled value."

> `20-repo-mining-synthesis.md:108`, §6 PROTOTYPE GUIDANCE: "Add drift/canary tests: generated vocab drift, projection metadata key drift, wrong-shape domain/range canaries, and byte-stable round trips where possible."

What the ground truth says:

`explorations/identity-as-iri/research/repos/ontosphere.md`, §9 DIAMONDS:

> `ontosphere.md:136`: "Dataset-faithful exports are a strong proof surface."

> `ontosphere.md:136`: "Phase 3: fold+projection proof should include dataset-faithful N-Quads/TriG and canonical hash checks."

Recommended correction:

Keep JSON-LD/Turtle/Markdown as the cheapest user-facing projections, but add a proof-only dataset export/canonical hash lane once named graph partitions enter the assembled value. If that is deferred, mark the deferral explicitly instead of omitting it.

## Overall Verdict

After the listed corrections are applied, the synthesis can be trustworthy for high-level design decisions, but not as the sole prototype checklist. Its main direction tracks the handoff, and the license discipline is clean. The unsafe parts are evidence compression: DXOS, Skygest, Ontosphere, and Ontorite each contain diamonds that materially affect Phase 1, Phase 3, or Phase 4 ordering, and D7/retrieval are stated more strongly than the reports justify. Use the design authority for locked D1-D9 decisions, and treat the corrected synthesis as supporting evidence rather than authority.
