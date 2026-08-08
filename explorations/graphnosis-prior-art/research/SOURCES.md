# Graphnosis Prior Art — Sources & Provenance

- **Cluster / origin:** a single research session on 2026-08-06. Benjamin found the Graphnosis
  open-source project, cloned it to `~/YeeBois/dev/Graphnosis`, and downloaded four PDFs into
  `~/Downloads/RESEARCH_08_06_26/`. The PDFs were mined from local copies, then replaced with the
  link manifest [`assets/README.md`](../assets/README.md) (canonical URLs + SHA-256 of the mined
  copies); the repo clone stays out of tree.
- **Provenance:** ranked inventory [`SYNTHESIS.md`](./SYNTHESIS.md); cross-source argument
  [`cross-source-triangulation.md`](./cross-source-triangulation.md); raw mining corpus
  [`mining/`](./mining/) (8 territory surveys, 8 beep-side mappings with proof, 4 paper reads,
  4 paper mappings, and the machine-readable [`mining/INDEX-repo.json`](./mining/INDEX-repo.json)
  carrying all 112 repo findings and 115 mappings with territory-namespaced ids). Amendment
  proposals: [`amendments-open-goals.md`](./amendments-open-goals.md),
  [`amendments-shipped-code.md`](./amendments-shipped-code.md),
  [`AMENDMENTS.json`](./AMENDMENTS.json) (26 amendments, 76 paper mappings).

## 1. Mined source corpus

Ids are territory-namespaced (`<territory>:<id>`) after the collision repair described in
[`../RESEARCH.md`](../RESEARCH.md#a-defect-in-this-packets-own-mining-recorded-so-nobody-over-trusts-it).
Full evidence per row is in the matching `mining/map-*.md`.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `retrieval:tie-break` | Provenance-keyed total order, compared field-at-a-time | Graphnosis | `src/core/query/tie-break.ts:1-91` | determinism | clean-room (our `SourceTextIdentity` is richer) |
| `retrieval:guarded-max` | `base(v) ← max(base(v), x)`, never a sum — degree-independence by construction | Graphnosis | `src/core/query/traverser.ts:365-369,385-389,402-406` | retrieval scoring | clean-room |
| `retrieval:node-hop` | Search state is `(node, hop)` under a hop budget, not `node` | Graphnosis | `src/core/query/traverser.ts` | retrieval traversal | clean-room |
| `retrieval:seeds-vs-floor` | Seeds decide what ENTERS traversal; a source floor decides what SURVIVES | Graphnosis | `src/core/query/seed-finder.ts`, `traverser.ts` | retrieval membership | design-idea |
| `retrieval:three-clocks` | `now` / `retiredAt` / `asOf` are three inputs, never conflated | Graphnosis | `src/core/query/query-engine.ts` | determinism | design-idea |
| `epistemics:adjudication` | Contradictions surfaced to the owner, never auto-resolved | Graphnosis + whitepaper §14 | `src/core/corrections/correction-engine.ts` | epistemics | reference (we are ahead) |
| `epistemics:reweight` | `setConfidence` is a distinct operation from edit and from retirement | Graphnosis | `src/core/corrections/confidence.ts` | epistemics | design-idea |
| `epistemics:preview-forget` | `previewForgetTopic` runs the same code path as `forgetByTopic` | Graphnosis | `src/core/optimization/pruner.ts` | epistemics | design-idea |
| `graph-model:retirement-reason` | Retirement reason (delete vs supersede) decides whether re-ingest may resurrect content | Graphnosis | `src/core/graph/retirement.ts` | epistemics | clean-room |
| `gai-format:error-class` | Error taxonomy keyed on what the consumer should DO; version-skew carved out from corruption | Graphnosis | `src/core/errors.ts:70-135` | failure modelling | clean-room |
| `gai-format:spec-discipline` | "One break, once"; §6 known weaknesses; §8.6 deliberately-NOT; conformance declared per layer | Graphnosis | `SPEC.md` §0,§6,§8.0,§8.6 | process | design-idea |
| `gai-format:conformance-fixtures` | Deliberately-malformed fixtures that test refusals | Graphnosis | `spec/conformance.mjs`, `spec/make-fixtures.ts` | proof | design-idea |
| `proof:non-vacuity` | Every scan asserts its own scan matched something | Graphnosis | `tests/**` (7 cited files) | proof | clean-room |
| `proof:instrument-self-id` | The measuring instrument identifies, defines, and unit-tests itself | Graphnosis | `tests/longmemeval/official/evidence-recall.ts:867-911` | proof | design-idea |
| `proof:provenance-grade` | Per-run honesty grade on recorded evidence (`exact` / `approximate` / …) | Graphnosis | `benchmarks/evidence/manifest.json:15,47,55` | proof | clean-room |
| `agent-surface:determinism-tier` | Tools grouped by intent AND by determinism tier | Graphnosis | `GRAPHNOSIS.md` §"The tools", §Approximate/Conditional/Non-deterministic | agent surface | design-idea |
| `craft:cost-in-changelog` | A changelog entry states what a change COSTS | Graphnosis | `CHANGELOG.md`, `git log` subjects | process | design-idea |
| `craft:scope-triage` | ROADMAP as a triage instrument; borderline default = "separate package" | Graphnosis | `ROADMAP.md` | process | design-idea |
| `craft:bundle-disclaimer` | State the confidentiality disclaimer where the belief forms | Graphnosis | `README.md`, `NOTICE` | governance | clean-room |
| `ts-04` | Completion oracle as the classifying primitive of a step | trained-skills PDF | pp. 1-55 (see `mining/paper-trained-skills.md`) | procedure model | design-idea |
| `ts-09` | Bounded walk with per-EDGE lifetime caps; cap-reached is a normal outcome | trained-skills PDF | ditto | procedure model | clean-room |
| `ts-19` | Authority ceiling, min-composed, absence ⇒ most restrictive | trained-skills PDF | ditto | governance | design-idea (§8 = proposal) |
| `ts-20` | **Rule 5** — the writer of a node cannot raise its own ceiling | trained-skills PDF | ditto | governance | clean-room |
| `ts-23` | Content-sensitivity lock at the egress boundary, not in the planner | trained-skills PDF | ditto | governance | clean-room |
| `wp-03` | Guarded max write, +6.0 pts measured (conditions in `mining/paper-whitepaper.md`) | whitepaper | pp. 1-35 | retrieval scoring | clean-room |
| `wp-13` | Ranking is a pure function of `(corpus, query)` | whitepaper | ditto | determinism | design-idea |
| `cc-04` / `cc-05` | Eight-axis modality taxonomy — **originates with Ning et al. 2018 (MATRES)**, not Chronocept | Chronocept (citing) | pp. 1-20 | temporal semantics | reference-only |
| `cc-13` | Shuffle-vs-remove ablation *design* (not its results) | Chronocept | ditto | eval methodology | reference-only |
| `R2` | Derived, non-contiguous nodes are inadmissible where spans are mandatory | RAPTOR (by contrast) | pp. 1-23 | retrieval | reference-only |

**How these inform this packet.** *Retrieval*: the donor's determinism mechanisms
(tie-break, guarded max, `(node, hop)`, seeds-vs-floor) are pre-commitments for
`goals/hybrid-retrieval-fusion-core` and the unwritten `citation-graph-retrieval-channel` — each is
one SPEC sentence now and a migration later. *Governance*: `ts-20` (Rule 5) and `ts-09` (declared
caps) are repo-law shaped, not packet shaped. *Epistemics*: the donor's separation of reweight from
edit from retirement corroborates a boundary we already drew; only `retirement-reason` is new.
*Proof/process*: non-vacuity and provenance grading are directly portable to our law scanners and
`ai-metrics`. *Papers*: RAPTOR and Chronocept are primarily **anti-adoption** evidence, which is a
legitimate and useful result.

The one load-bearing quote, because it names the failure mode precisely — Graphnosis
`src/core/query/tie-break.ts`: ordering on a surrogate id makes results *"an artifact of how the
candidate pool was built rather than anything about the query."*

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [nehloo/Graphnosis](https://github.com/nehloo/Graphnosis) @ `7a19c4b`, v0.11.0 | **Apache-2.0** (`LICENSE`, `NOTICE` — © 2026 Nehloo Interactive LLC) | **port-with-attribution** permitted; we nonetheless take patterns clean-room, since every mechanism lands on an Effect v4 schema-first surface with no shared code | determinism mechanisms, epistemic operation boundaries, failure-class taxonomy, spec/process discipline |
| `3d-force-graph` (vendored into Graphnosis `dist/cli/vendor/`) | MIT (© Vasco Asturiano) | not taken | — (noted only because `NOTICE` documents the vendoring, itself a `craft` finding) |

No Graphnosis source is vendored into beep-effect. If any port becomes verbatim, the Apache-2.0
attribution requirement attaches and must be recorded here and in the receiving package header.

## 3. External research sources

Mined from local PDF copies on 2026-08-06; the copies were then replaced with the link manifest
[`assets/README.md`](../assets/README.md), which pins each one by SHA-256. Citations were
transcribed from the PDFs' own title pages during mining, not recalled. Mining notes under
[`mining/`](./mining/) reference the original `assets/*.pdf` paths; the checksums identify exactly
which bytes those notes read.

| Artifact | Pages | Canonical URL | Provenance | License |
|---|---|---|---|---|
| Graphnosis whitepaper — *The Un-Brain* | 35 | DOI [10.5281/zenodo.20843387](https://doi.org/10.5281/zenodo.20843387) | PDF CreationDate 2026-06-26. Vendor-authored. Identity to DOI settled 2026-08-06: the repo README names this title + DOI, and the trained-skills paper's companion citation carries the same title + DOI. | **CC BY 4.0** per the repo README's statement; Zenodo record page returned 504 at verification time, so first-hand license text unverified |
| Graphnosis trained-skills — *"Borrowable Skills as Lean Un-Ganglia Subgraphs"* | 55 | DOI [10.5281/zenodo.21205599](https://doi.org/10.5281/zenodo.21205599) | PDF CreationDate 2026-07-05. Vendor-authored. Title from the PDF's title page matches the repo README's entry for this DOI. | as above |
| RAPTOR — *Recursive Abstractive Processing for Tree-Organized Retrieval* | 23 | [arXiv:2401.18059](https://arxiv.org/abs/2401.18059) | PDF CreationDate 2024-01-31. Download filename contained a newline — cleaned on copy. | **CC BY 4.0**, stated on the arXiv abs page (verified 2026-08-06) |
| Chronocept — *"Instilling a Sense of Time in Machines"* | 20 | [arXiv:2505.07637](https://arxiv.org/abs/2505.07637) | arXiv v1. Krish Goel, Sanskar Pandey, KS Mahadevan, Harsh Kumar, Vishesh Khadaria. | **CC BY 4.0**, stated on the arXiv abs page (verified 2026-08-06); the PDF itself prints none — the earlier reference-only call keyed on that. The quantitative quarantine below is independent of license and stands. |

Secondary citation, reached through Chronocept and worth following independently: **Ning et al.
2018 (MATRES)** for the eight-axis modality taxonomy. Not on disk; cite via
[`mining/paper-chronocept.md`](./mining/paper-chronocept.md) until fetched.

**Quarantined — do not quote:** Graphnosis LongMemEval figures (their own badge says
`re-measuring`; only the 8.4%/45k end is reproducible from committed artifacts) and all Chronocept
quantitative results (n=129, best R²=0.1298, linear regression worse than the mean predictor).

## 4. In-repo capability references

| Brick | Path | Disposition |
|---|---|---|
| `@beep/provenance` — `SourceTextIdentity` (7 required fields incl. `extractor{name,version}`, `normalizationVersion`), `TextAnchor`, `VerifiedTextAnchor` | `packages/foundation/modeling/provenance/src/` | **extend** — add the missing `Order.Order`; the package has none (`grep -rn "Order"` → only the `isWellOrdered` predicate) |
| Contradiction substrate — sealed `ContradictionCandidate`, append-only `ContradictionDisposition`, detector-as-provenance annotation | `packages/epistemic/domain/src/{entities,values}/Contradiction/` | **reuse** — ahead of the donor |
| `EdgeRelation` / `SymmetricEdgeRelation` `LiteralKit` vocabulary | `packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:13` | reuse |
| `EdgeVersion` bitemporal model + table + migration CHECKs | `packages/epistemic/{domain,tables}/…`, `packages/_internal/db-admin/drizzle/20260726000000_epistemic_bitemporal_edge/migration.sql:77-78` | **extend** — invariants live only in SQL |
| `EdgeAuthority` commands (`RecordEdgeFactFields`, `SupersedeEdgeFactFields`, `OrgScopeAgreementCheck`) | `packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.commands.ts:75-230` | **extend** — the minting door for the interval invariant |
| `GrantSet` (Draft/Frozen, digest re-verifiable at read) + `TierGate` (626 LOC, wired into `GovernedTier`) | `packages/epistemic/domain/src/values/GrantSet/`, `packages/foundation/capability/mcp-kit/src/TierGate.ts` | **reuse** — the session-scoped authority half already exists and must not be weakened |
| `Skill` entity | `packages/agents/domain/src/entities/Skill/Skill.model.ts` | **NET-NEW** — 47 lines, `{fixtureKey, name}` only |
| `AgentSkillFrontmatter` | `packages/tooling/library/ai-sync/src/schemas.ts:120-145` | **extend** — `{name, description}`; no termination bound |
| `runLawScan` (single choke point, 7 scanners, 3,714 LOC) | `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:98-183` | **extend** — no non-vacuity assertion |
| `BenchmarkRun` | `packages/tooling/library/ai-metrics/src/models.ts:654-668` | **extend** — 8 fields, no command provenance |
| `CiLaneReplay` `LiteralKit` (`exact`/`approximate`/`none`) | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:96-123` | **reuse as precedent** for the grade above |
| `YeetStatusArtifactState` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:43,505-563` | **extend** — skew and corruption collapse to one state |
| `WinkCorpus` ranking + `internal/order.ts` comparators | `packages/drivers/wink/src/WinkCorpus.service.ts:783-784`, `internal/order.ts:24-57` | **fix** — ties on insertion order |
| `DocText` pdfjs extraction | `packages/drivers/doc-text/src/DocText.service.ts:108-170` | **fix** — proxy leak, no wall-time bound |
| `PracticeKg` projections / queries | `packages/law-practice/server/src/PracticeKg.projections.ts:200,444`, `PracticeKg.queries.ts:26-124` | **fix** (concat sort key) / reuse |
| `Graph` value (`GraphKindValue = LiteralKit(["directed","undirected"])`) | `packages/foundation/modeling/schema/src/Graph/Graph.shared.ts:48` | reference — directed XOR undirected; no co-resident dual class (deliberate, see `wp-02`) |

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md) · [`../RESEARCH.md`](../RESEARCH.md) ·
  [`../README.md`](../README.md) · [`../ops/manifest.json`](../ops/manifest.json)
- Packets this research routes into (details in [`SYNTHESIS.md`](./SYNTHESIS.md) §7):
  `goals/hybrid-retrieval-fusion-core`, `goals/ingestion-secret-scrub`, `goals/practice-kg-mcp`,
  `goals/knowledge-surface-automation`, `goals/coding-agent-effectiveness-evidence-loop`,
  `goals/citation-verified-span-substrate`, `goals/agentic-professional-runtime`,
  `goals/legal-document-intake`, `goals/epistemic-contradiction-triage`,
  `explorations/rag-retrieval-projection`, `explorations/epistemic-belief-view-revision`,
  `explorations/agent-memory-tiers-bitemporal-edges`,
  `explorations/agent-governance-control-plane`, `explorations/effect-orchestration-patterns`.
- Proposed graduations: `NEW:epistemic-contradiction-detection`, plus a repo-law bundle carrying
  Rule 5, declared loop caps, and law-scanner non-vacuity.
- No codex review on this packet — the mining ran on Claude sub-agents at Benjamin's direction
  (Codex weekly limit exhausted 2026-08-06).
