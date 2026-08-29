# Typed Agent Skill Contracts — Sources & Provenance

- **Cluster / origin:** 2026-08-10 mining pass over Kingsley Idehen's OpenLink
  `ai-agent-skills` corpus (7 Codex gpt-5.6-sol lanes at reasoning=high, one report per lane,
  vendored under [`mining/`](./mining/)), plus a same-session Fable pass over
  `agent-rdf-memory/` and one operator-supplied paper.
- **Provenance:** cross-lane rollup [`mining/SYNTHESIS.md`](./mining/SYNTHESIS.md); raw lane
  outputs also retained outside the repo at `~/YeeBois/research/daily/08-10-2026/mining/`
  (logs, prompts, status).
- **Mined revision:** OpenLinkSoftware/ai-agent-skills commit
  [`929692f45d1b48ea990884154f82707c7a7cc5c2`](https://github.com/OpenLinkSoftware/ai-agent-skills/tree/929692f45d1b48ea990884154f82707c7a7cc5c2).
  File paths cited by the lane reports are relative to that immutable tree.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `mining/protocols.md` | Agent-interop protocols lane | OpenLinkSoftware/ai-agent-skills | `a2a-client/`, `acp-client/`, `fediverse-crud/`, `osdi-inclusion-engine/`, `opml-rss-reader/`, `rss-feed-generator/` | A2A/ActivityPub clients, discovery, evidence ladder | port (shapes) |
| `mining/kg-pipeline.md` | KG generation pipeline lane | OpenLinkSoftware/ai-agent-skills | `kg-generator/`, `document-to-kg-skill/`, `csv-to-rdf-det-generator/`, `rdf-det-variant-generator/`, `infographic-describer/`, `kg-output/` | source→KG contracts, IRI policy, provenance gaps | port (shapes) |
| `mining/rdf-infographic.md` | Flagship artifact-contract lane | OpenLinkSoftware/ai-agent-skills | `rdf-infographic-skill/` | 65-gate delivery contract, harness validators | port (contract), reference (validators) |
| `mining/query-skills.md` | Query & data skills lane | OpenLinkSoftware/ai-agent-skills | `data-twingler/`, `dbpedia-query-skill/`, `wikidata-query-skill/`, `s3-query-skill/`, `linked-data-skills/`, `virtuoso-rdf-loader/`, `virtuoso-support-agent/` | query-plan state machines, capability probes, mutation authorization | port (shapes) |
| `mining/identity-commerce.md` | Identity & commerce lane | OpenLinkSoftware/ai-agent-skills | `youid/`, `mtls-curl/`, `openlink-license-*/`, `resource-access-offers-generator/`, `set-webdav-resource-property/`, `mpp-stripe-client/` | WebID credential chain, delegation, re-extraction gate, 402 flow | port (shapes); never their secret handling |
| `mining/ops-publishing.md` | Ops & publishing lane | OpenLinkSoftware/ai-agent-skills | `iodbc-dsn-manager/`, `openlink-request-broker-configurator/`, `screencast-recorder/`, `pinchtab/`, `weblog-from-webdav/`, `website-from-webdav/` | ref-leases, capability gates, deployable-vs-live algebra, publication sagas | port (shapes) |
| `mining/meta-authoring.md` | Skill-authoring meta lane | OpenLinkSoftware/ai-agent-skills | `AGENTS.md`, `opal-agent-skill-assembler/`, `uriburner-opal-agent-skills/`, `templates/`, `scripts/`, `showcases-and-explainers/`, `fuxi-engineer/`, `wc2026-*` | authoring lifecycle, bounded KG loop + receipts, scene proof contracts | port (shapes) |
| (session pass) | agent-rdf-memory Fable analysis | OpenLinkSoftware/ai-agent-skills | `agent-rdf-memory/` | intent-routing ontology, sparse manifest, transcript-audit gate, write triggers | clean summary in `CAPTURE.md`; port (shapes) |

**Pinned source anchors:** protocols ([A2A workflow](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/a2a-client/SKILL.md#L32-L65)); KG pipeline
([harness alignment](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/kg-generator/SKILL.md#L23-L70)); RDF infographic
([strict harness contract](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/rdf-infographic-skill/SKILL.md#L48-L99)); query skills
([discovery preflight](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/data-twingler/SKILL.md#L145-L190)); identity and commerce
([YouID delivery gates](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/youid/SKILL.md#L81-L116)); ops and publishing
([screencast evidence workflow](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/screencast-recorder/SKILL.md#L27-L122)); meta-authoring
([repository agent law](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/AGENTS.md#L5-L45)); agent-rdf-memory
([load and retrieval gates](https://github.com/OpenLinkSoftware/ai-agent-skills/blob/929692f45d1b48ea990884154f82707c7a7cc5c2/agent-rdf-memory/AGENTS.md#L1-L57)).

**How these inform this packet:** each lane report carries its own ranked "Steal-worthy for
beep-effect" list and a "Dead ends" list; the rollup thesis (contract-rich, enforcement-poor →
Effect Schema as the enforcement layer) plus five convergent patterns and ten ranked ports live
in [`mining/SYNTHESIS.md`](./mining/SYNTHESIS.md). Dispositions are per *pattern/shape* — no
lane recommended porting any OpenLink implementation verbatim; their validators and scripts are
explicitly the anti-pattern half of the evidence.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| https://github.com/OpenLinkSoftware/ai-agent-skills | MIT (LICENSE verified in clone 2026-08-10) | port-with-attribution | contract shapes, gate lists, state-machine phases, evidence-ladder semantics, receipt field sets; NOT implementations (regex validators, shell harnesses, secret handling) |
| https://github.com/microsoft/agent-governance-toolkit | MIT (LICENSE fetched 2026-08-13) | port-with-attribution | ACS fail-closed evaluation discipline, pre/post intervention-point vocabulary, evidence size bounds, audit-record separation; NOT its policy engine or runtime |
| https://github.com/in-toto/attestation | Apache-2.0 (LICENSE fetched 2026-08-13) | interop + vocabulary adoption | Statement/predicate/envelope split for evidence receipts; inspections ≈ re-extraction; SLSA VSA shape for gate summaries |

Interop-target and reference-only repos/specs surveyed 2026-08-13 (MCP, Agent Skills, A2A,
OASF, Oracle Agent Spec, LangChain, effect-smol, Temporal, Restate, XState, W3C PROV-O/Web
Annotation/VC, C2PA, SLSA, Guardrails, Outlines, promptfoo, OpenAI Evals) carry per-URL license
and disposition rows in the two landscape reports' `SOURCES ledger rows` sections (§3 below).

## 3. External research sources

- *The AI Barrister Flight Simulator: A Neuro-Symbolic Benchmark for Structured Legal
  Reasoning* — Lewis & Zueco, AIXC Research; ICLR 2026 workshop.
  https://openreview.net/pdf/42ef464c05efa3c750f623b7df2fe74aefe677c3.pdf (challenge-walled;
  operator-supplied). Note: [`mining/ai-barrister-flight-simulator.md`](./mining/ai-barrister-flight-simulator.md).
  Local PDF (kept out of this public repo):
  `~/YeeBois/research/daily/08-10-2026/mining/sources/ai-barrister-flight-simulator-iclr2026.pdf`.
- https://github.com/OpenLinkSoftware/ai-agent-skills — the mined corpus itself (see §1/§2).
- **2026-08-13 landscape sweep (research close).** Two lane reports are the full per-URL
  ledgers — every claim carries the URL the lane actually fetched, with license and disposition
  in each report's terminal `SOURCES ledger rows` section:
  - [`../research/landscape/skill-contract-formats.md`](../research/landscape/skill-contract-formats.md)
    — MCP 2025-11-25 (tools/Tasks/resources/prompts/schema), Anthropic-originated Agent Skills
    spec (agentskills.io), OpenAI function calling + Structured Outputs, Google A2A 1.0
    (spec + normative protobuf), AGNTCY OASF (agent record, Agent Skills manifest/validation,
    evaluation schemas), Oracle Agent Spec (+ tracing), LangChain/LangGraph tool contracts,
    Effect AI `Tool`/`Toolkit` (effect-smol), Microsoft Agent Control Specification +
    AGT-Evidence profile.
  - [`../research/landscape/workflow-evidence-frameworks.md`](../research/landscape/workflow-evidence-frameworks.md)
    — Temporal, Restate, XState, W3C PROV-O + PROV Constraints + Web Annotation, C2PA 2.4,
    in-toto attestations + SLSA build provenance/VSA, W3C VC 2.0, Guardrails AI, Outlines,
    promptfoo, OpenAI Evals.

## 4. In-repo capability references

Inventoried 2026-08-13 (research close). The two lane reports under
[`inventory/`](./inventory/) are the ledger — every brick cited as package + `file:line`
verified against the working tree, with per-port-component `EXISTS`/`PARTIAL`/`NET-NEW`
verdict tables:

- [`inventory/contract-kernel-evidence.md`](./inventory/contract-kernel-evidence.md) — ports
  1/2/4: `@beep/schema` (LiteralKit, defaults), `@beep/identity` (`$I`), yeet gate/verdict/
  proof machinery, reflection-artifact lint + goal manifests, `qa-inventory/v1`,
  `@beep/provenance` verified anchors, `@beep/epistemic-*` claim gate, `@beep/exiftool` XMP
  stamping.
- [`inventory/protocol-query-memory.md`](./inventory/protocol-query-memory.md) — ports
  3/5/6/7/8/10: `effect/unstable/http(api)` clients/servers, `@beep/api-transport`,
  `@beep/m365` OAuth/PKCE, MCP/`@beep/mcp-kit`/`@beep/acp`, `@beep/semantic-web` + ontology
  SPARQL path, `beep qa` pipeline, `@beep/ai-sync` skill/config schemas, memory wiring.

Confirmed NOT FOUND (searched, not assumed): better-auth; A2A/ActivityPub anything; a
citation-extraction or `knowledge*` package; browser ref-epochs/tab-leases; intent→context
routing manifest; transcript-audit gate. `@beep/acp` is Agent Client Protocol, not A2A.

## 5. Cross-links & provenance

- Packet artifacts: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md).
- Mining rollup: [`mining/SYNTHESIS.md`](./mining/SYNTHESIS.md) (report index inside).
- Out-of-repo raw run: `~/YeeBois/research/daily/08-10-2026/mining/` (prompts, logs,
  status.txt) and the clone `~/YeeBois/research/daily/08-10-2026/ai-agent-skills/`.
- Session memory pointer: `~/.claude/memory/beep-effect/openlink-skills-mining-2026-08-10.md`.
- Related packets: [`legal-patent-kg-deepening`](../../legal-patent-kg-deepening/) (gold-path
  eval consumer), [`agent-memory-tiers-bitemporal-edges`](../../agent-memory-tiers-bitemporal-edges/)
  (memory-routing track adjacency); goals `citation-verified-span-substrate`,
  `agent-effectiveness-loop` (evidence/receipt consumers).
