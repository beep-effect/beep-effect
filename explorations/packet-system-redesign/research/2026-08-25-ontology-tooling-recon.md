# Ontology tooling recon: ontoskills, open-ontologies, mykg

**Date:** 2026-08-25 · **Sources:** local clones `~/YeeBois/dev/ontoskills`
@ `f15690a` (last commit 2026-05-05), `~/YeeBois/dev/open-ontologies` @
`339db9a` (2026-08-25), `~/YeeBois/dev/mykg` @ `5ab1c1b` (2026-08-19). All
three MIT, reference-only. **Method:** one reader agent per repo returning
structured findings with path:line evidence, one refuting verifier per repo
that re-opened every cited file; the operator-side spot check confirmed the
verifiers' "missed" items (`save_snapshot` / `apply_reasoning` dead in
ontoskills; PROV-O emission flag, KGCL records, 108 `#[tool(` in
open-ontologies). Where a verifier refuted a line citation, this note cites
the file only. Companion to
[`2026-08-25-agento-ontology-mapping.md`](./2026-08-25-agento-ontology-mapping.md).

The question was whether any of these change the queued amendments or the
fleet convention-migration campaign. Answer: none replaces anything; four
ideas sharpen them, and one new amendment candidate (J, gate certificates)
is worth queuing.

## 1. ontoskills (SKILL.md → OWL compiler + MCP retrieval)

Python core (~10.6k LOC) compiles Anthropic-style skill folders into OWL 2
Turtle modules: deterministic phase 1 (frontmatter, sha-256 of the skill
dir, markdown-it block extraction), then a Claude tool-use extraction into a
Pydantic `ExtractedSkill` (31-type knowledge-node taxonomy, requirements,
state transitions, workflows), serialized with rdflib and SHACL-validated
before write. A Rust MCP server (oxigraph) serves skills back by BM25 search.
349 commits, 2026-03-15 to 2026-05-05, one author, 538 Python tests but no CI
workflow runs them.

Verified and worth taking:

- **Two-tier validation with severities.** Permissive OWL TBox plus a strict
  hand-written SHACL shapes file; `sh:Violation` blocks the write,
  `sh:Warning` reports. `dependsOnSkill` is a Warning precisely because the
  target "may not yet be compiled" (`core/specs/ontoskills.shacl.ttl`,
  `core/src/validator.py` runs pySHACL with `allow_warnings=True`). That is
  the rule a 214-packet migration needs: forward references to
  not-yet-migrated packets warn, so packets can land in any order.
- **Drift classified as breaking / additive / cosmetic, with generated
  "who is affected" queries.** `core/src/differ.py` diffs two compiled
  projections, buckets intent / state / requirement / knowledge-node changes,
  and `drift_report.py` emits a SPARQL query plus an action per breaking
  change. Wired only to `ontocore diff --from A --to B`
  (`core/src/cli/audit.py`); the snapshot flow the docstrings describe is
  dead code (`save_snapshot` has no callers).
- **Fleet-wide linter separate from per-node shapes.** `core/src/linter.py`
  checks whole-graph invariants SHACL cannot express: dependency cycles
  (error), duplicate intents (error), unreachable skills and dead states
  (warning), workflow-step cycles (error).
- **Refuse-to-write, hash-skip inside the artifact.** Serialize, infer
  links, validate, only then write; the content hash is stored in the
  projection (`oc:contentHash`) so unchanged inputs skip recompilation.

Not worth taking:

- The "deterministic" claim covers retrieval over a compiled artifact, not
  compilation: extraction is an un-temperatured Claude loop, `generated_by`
  is never serialized, and the ontology header stamps `datetime.now()`.
  An LLM step without a receipt (model, prompt hash, output hash) is exactly
  the gap candidate 4 exists to close.
- PROV-O use is `prov:wasDerivedFrom` as a string literal of a directory
  path. `Prov.ts` already exceeds it.
- `oc:Attempt` / `oc:hasStatus` are declared and never produced or consumed.
- `COMPILER_VERSION` (0.11.0) lags `pyproject` (1.1.0), so the manifest
  version field lies. A migration format-version story must not copy this.

## 2. open-ontologies (Rust MCP server for ontology governance)

108 MCP tools over an in-memory oxigraph store: build, validate (SHACL
translated to SPARQL), version, diff, drift with rename detection (KGCL
output), plan/apply with blast radius, certify (four-way verdict), policy
(SPARQL ASK templates), knowledge packs, bi-temporal named graphs, and an
append-only lineage log. 515 commits, 2026-03-09 to 2026-08-25, ~850 tests,
CI on ubuntu and windows. The most active of the three.

Verified and worth taking:

- **Gate output as a typed certificate.** `src/civex.rs` `Certificate`:
  verdict enum (Execute / Reject / Experiment / Abstain), `assumptions[]`
  (including `do_calculus_unavailable:<reason>` when a feature is off),
  `graph_slice_hash`, `provenance_hash`, a numeric bound, and a `rationale`
  joined from the triage rules that fired. The causal vocabulary around it
  is a self-described structural proxy (`civex.rs` header); the shape is the
  value.
- **Plans as persisted artifacts.** `src/plan.rs`: a plan has an owner, an
  id, `applied_at`, and a blast radius counted from references to removed
  things; `apply_plan` takes the id, and an unknown id is an error, not a
  fallback to latest. The monitor's `blocked` flag is honoured by apply
  (`src/monitor.rs`).
- **Evidence attached to the promoted artifact.** `src/pack.rs`: sorted
  N-Triples plus a manifest `{sha256, tool_version, evidence?}` where absent
  evidence is a distinguishable state; unpack verifies the checksum before
  loading. Caveat from the verifier: sorted lines are not a canonical form
  for blank nodes; use RDFC-1.0 rather than port the sort.
- **Validators report reach.** `src/shacl.rs` forces `conforms=null` when
  any constraint was skipped and emits the focus-node count;
  `src/temporal.rs` returns `truncated: [{scan, limit, consequence}]` plus a
  warning when truncation changes meaning. A vacuous green cannot pass
  silently.
- **Probe-actual-shape migrations.** `src/state.rs`: ordered append-only
  `MIGRATIONS` under `PRAGMA user_version`, each step probing `table_info`
  because pre-tracker databases all report version 0, tested against real
  half-migrated fixtures (`tests/fixtures/state/`). The 65 non-v2 manifests
  with 79 key shapes are the same situation: probe the fields, do not trust
  a declared version.
- **Policy as a separate predicate.** `src/policy.rs`: authorisation rules
  are SPARQL ASK templates with a `{target}` placeholder, persisted and
  listable, evaluated independently of the risk gate. Composition is manual
  (nothing in `src` calls both), and `check_action` is fail-open on SPARQL
  error, so the split is the idea to keep, not the wiring.
- **PROV-O on ingest.** `src/inputs.rs` `provenance: Option<bool>` emits
  `prov:wasDerivedFrom` plus a `prov:Entity` per source file with path and
  timestamp, "interoperates with platforms that expect PROV-O (Semantica,
  TrustGraph)". Minimal, but it confirms the IRI choice in Amendment I.

Not worth taking:

- The lineage log: five untyped strings per row, no hash, no chain, no fold,
  `seq = MAX(seq)+1` without a unique index, and `onto_save` / `onto_push`
  never record, so a "version before push" rule cannot fire on it. The
  governance webhook is fire-and-forget with the result discarded.
  `ops/events/` is ahead on every axis.
- The borderline loop's "self-calibrating thresholds": `partition()` never
  reads persisted verdicts and `apply_verdicts` exists only in a doc comment.
- Version snapshots are full N-Triples copies in SQLite.
- The Planner layer plans graph mutations (PDDL / Fast Downward). No agent,
  model, or tool assignment per step exists anywhere in the repo.
- README counts ("70+ tools", "160+ tests") are stale.

## 3. mykg (Markdown corpus → induced RDFS schema → confidence-scored graph)

Python CLI, v0.4.2. Twelve sentinel-gated steps: preprocess, ingest (sha-256
manifest, tiktoken windows, frontmatter stripped), pass-1 schema induction
over token batches with algorithmic merge plus two LLM passes, schema
validation, optional human approval flag, flatten, pass-2 per-chunk instance
extraction with a validate → retry → partial-recover → backfill ladder, name
normalization, assembly with deterministic `type-slug` IDs and a merge log,
orphan scoring and reconnection, export (JSONL, RDFS Turtle, NetworkX,
Obsidian, Neo4j CSV) and a 15-tool read-only MCP server. 361 commits,
2026-05-27 to 2026-08-19, 1319 tests, CI on ubuntu and windows; the repo's
own healthiness doc admits no test drives the real CLI end to end.

Verified and worth taking:

- **The graph cannot write back.** Nothing writes to `input/*.md`; the MCP
  layer loads `nodes.jsonl` / `edges.jsonl` and exposes no mutation. That is
  D8 enforced structurally rather than by law, and the shape Amendment I
  should copy: derived flat artifacts plus a query layer with no write path.
- **Content-addressed idempotency at the file and shard level.**
  `step_ingest.py` hashes every file into a manifest; `--append` rehashes,
  evicts shards for changed files, and re-extracts only those. LLM-call
  memoization by `sha256(system + user + label)` exists only in the
  filesystem "agent" adapter (`src/mykg/llm/agent_adapter.py`), not in the
  API adapters.
- **Response hardening.** `pass2.py`: strip nulls, coerce bare scalars to
  `{value, confidence}`, validate types / properties / endpoints, retry once
  with the error list prepended, then drop invalid edges and any new node not
  anchored by a surviving edge, then backfill every schema attribute as
  `{null, 0.0}`. Nothing enters the graph unless it references a declared
  class and a node in the same extraction.
- **Locked base schema.** `base_schema.py` loads an existing RDFS/OWL TTL as
  locked classes and properties; `--freeze-schema` skips induction entirely.
  For packets this means inducing nothing: seed from the packet vocabulary
  and run induction once as a discovery pass for what the vocabulary misses.
- **Schema deltas as history.** `schema_history.py` writes one delta file
  per schema write (concepts and properties added / removed, with the
  trigger), which is the paper's "Issues / Assumptions" idea made
  machine-readable.

Gaps that are instructive because the packet system already has the
missing piece:

- **Frontmatter is discarded before chunking** (`chunker.py`
  `_strip_frontmatter`). For a packet the manifest and frontmatter are the
  highest-signal structured data. The projection pipeline should parse them
  deterministically into nodes at confidence 1.0 and use an LLM only for
  prose sections, if at all.
- **Identity is `type + name slug`** (`ids.py`). Two packets with a
  `Decision` named "Adopt X" collapse into one node. Packet-derived nodes
  need the packet slug (or a minted IRI under the repo's IRI doctrine) in
  the key.
- **Provenance stops at file paths.** `Chunk` carries `token_start` /
  `token_end` but nodes only receive `source_files`; the chunk link lives in
  an intermediate index and orphan rationales are stripped from stored
  edges. "Traceable to specific words" is prompt text with no span check.
  The evidence-span model plus PROV `Activity` / `used` closes this.
- **Confidence is LLM self-report** clamped to [0, 1], 0.5 when the wrapper
  is missing, no calibration. Do not read it as a probability.
- **Shipped defaults undercut the docs.** `orphan_pass.enabled: false` in
  every profile; `prep_mode: batch_chunks` with `batch_per_file: false`, the
  mode the architecture doc itself flags for cross-file over-attribution;
  `schema_max_restarts: 0`. The output ontology is RDFS-only (`rdfs:Class`,
  `rdfs:subClassOf`, `rdf:Property`), no `owl:` terms; OWL is consumed on
  input only. Root `prompts/` and packaged `src/mykg/prompts/` have drifted
  and only the packaged copies load.

## 4. What the three add up to

Read together with AgentO, the four sources describe one pipeline shape and
they agree on where the seams are:

1. **Ingest deterministically first.** Manifest, frontmatter, event stream,
   headings and code blocks become nodes at confidence 1.0 with no LLM
   (ontoskills phase 1, the part mykg skips). LLM extraction, if used at all,
   runs only over prose sections and is receipted (model, prompt hash,
   output hash), the receipt ontoskills forgot.
2. **Validate in two tiers and report reach.** Effect schemas for per-node
   shape with a Violation / Warning severity (LiteralKit), forward references
   as Warnings during migration, a fleet-wide linter for cycles / duplicates /
   unreachable packets, and every verdict carrying what it did not check.
3. **Gates emit certificates, not booleans.** Verdict enum, assumptions,
   input hashes, rationale, reach. Plans and approvals are persisted
   artifacts applied by id.
4. **The graph is derived and cannot write back.** Flat artifacts plus a
   read-only query layer; canonical (RDFC-1.0) serialization so the hash in
   the receipt means the same thing on every machine.
5. **Migrate by probing shape, classifying drift, and recording assumptions.**
   Probe fields rather than trust a declared version; classify each change
   as breaking / additive / cosmetic with a "who is affected" query; keep a
   per-packet assumptions report; hand-review a stratified sample; amend the
   schema; re-run and diff.

## 5. Dispositions

| Idea | Source | Disposition |
| --- | --- | --- |
| Violation / Warning severity tiers; forward refs warn during migration | ontoskills | adopt in the campaign charter and the projection validator (Amendment I) |
| Drift classified breaking / additive / cosmetic with generated affected-packet query | ontoskills | adopt as the campaign's diff report |
| Fleet-wide linter separate from per-packet shapes | ontoskills | adopt; extends `beep goals doctor` |
| Gate output as a typed certificate with assumptions, hashes, rationale, reach | open-ontologies | queue as Amendment J (candidates 2 and 4) |
| Plans persisted with owner / id, applied by id, unknown id is an error | open-ontologies | fold into Amendment H (work plan identity) |
| Evidence inside the promoted artifact, absence distinguishable | open-ontologies | fold into candidate 4 receipts |
| Probe-actual-shape migration with half-migrated fixtures | open-ontologies | adopt in the campaign charter |
| Bi-temporal valid / recorded clocks on projections | open-ontologies | note for `bitemporal-goal-roadmap` (parked); not this packet |
| Structural read-only query layer; deterministic ingest of frontmatter first | mykg (by contrast) | adopt in Amendment I |
| Content-addressed shards and `--append` re-extraction | mykg | adopt if any LLM extraction lane is chartered; otherwise moot |
| Response-hardening ladder, locked base schema, schema-delta history | mykg | adopt if an LLM extraction lane is chartered |
| Induce a schema from packets | mykg | rejected; the vocabulary exists, seed and lock it |
| `type + name` identity | mykg | rejected; packet slug or minted IRI in the key |
| Untyped lineage log, full-copy snapshots, borderline "self-calibration" | open-ontologies | rejected; `ops/events/` is ahead |
| "Deterministic compile" framing, path-literal PROV | ontoskills | rejected |
| OWL / RDF as system of record | all | rejected; D8 |
