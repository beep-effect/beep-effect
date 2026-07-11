# Agent Memory Infrastructure — Research Run (2026-07-08)

Comparative research on six agent-memory products for two distinct roles in this repo:

- **Role A — product-runtime memory**: memory subsystem candidates for the agents of
  `goals/agentic-professional-runtime`, evaluated under the binding
  `standards/memory-architecture/` doctrine (deterministic-first; semantic memory is a
  managed cache, never source of truth; external services live behind `drivers/*`).
  Products are scored as capability donors / operational caches / projection engines —
  explicitly NOT as system of record.
- **Role B — dev-tooling memory**: the memory stack for Claude/Codex agents building
  this repo (resolves the current Graphiti-vs-Cognee drift; final rec picks one winner).

Hard gates for Role A: self-hostable/local-first; OSI license with no copyleft trap
(SSPL/BUSL disqualify, AGPL flagged); TS-native or clean HTTP/MCP API (Python sidecar
behind `drivers/*` passes). Token/blockchain infrastructure is not an auto-disqualifier.

All research lanes were executed by Codex sub-agents at `--effort xhigh`. One lane used
the oracle CLI to drive a GPT-5.5 Pro (extended thinking) deep-research pass.

## Lane index

| Artifact | Lane | Input |
|---|---|---|
| [origintrail-clone.md](origintrail-clone.md) | clone deep-read | `~/YeeBois/research/ontology_research/ontology_repos/dkg` |
| [origintrail-docs.md](origintrail-docs.md) | docs sweep | https://docs.origintrail.io/llms.txt |
| [trustgraph-clone.md](trustgraph-clone.md) | clone deep-read | `~/YeeBois/dev/trustgraph` |
| [trustgraph-docs.md](trustgraph-docs.md) | docs sweep | https://trustgraph.ai/llms.txt |
| [graphiti-clone.md](graphiti-clone.md) | clone deep-read | `~/YeeBois/dev/graphiti` |
| [zep-graphiti-docs.md](zep-graphiti-docs.md) | docs sweep | https://help.getzep.com/llms.txt |
| [cognee-clone.md](cognee-clone.md) | clone deep-read | `~/YeeBois/research/knowledge-graphs/repos/cognee` |
| [cognee-docs.md](cognee-docs.md) | docs sweep | https://docs.cognee.ai/llms.txt |
| [supermemory-clone.md](supermemory-clone.md) | clone deep-read | `~/YeeBois/dev/supermemory` |
| [supermemory-docs.md](supermemory-docs.md) | docs sweep | https://supermemory.ai/docs/llms.txt |
| [mem0-clone.md](mem0-clone.md) | clone deep-read | `~/YeeBois/dev/mem0` |
| [mem0-docs.md](mem0-docs.md) | docs sweep | https://docs.mem0.ai/llms.txt |
| [oracle-deep-research.md](oracle-deep-research.md) | GPT-5.5 Pro deep research + doctrine stress-test | oracle CLI bundle |
| [00-recommendation.md](00-recommendation.md) | final synthesis & recommendation | all of the above |

## Artifact contract

Every lane artifact must contain: a TL;DR; hard-gate verdicts with evidence; findings
(architecture, storage model, retrieval, provenance/bitemporal support, integration
surface incl. MCP, license, self-host story, maturity); a Role-A assessment; a Role-B
assessment; contradictions found against the repo's prior assessments
(`standards/memory-architecture/03-saas-landscape-assessment.md`,
`05-context-graph-capability-assessment.md`,
`explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`); and a
References section citing exact file paths (clone lanes) or URLs (docs lanes) for every
material claim.

Related prior art: `standards/memory-architecture/`, `docs/BEEPGRAPH_ARCHITECTURE.md`,
`explorations/agent-memory-tiers-bitemporal-edges/`.
