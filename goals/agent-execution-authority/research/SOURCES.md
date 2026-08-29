# Agent Execution Authority — Sources & Provenance

<!--
Inherited from explorations/agent-execution-sandbox at graduate (2026-07-25).
The exploration's ledger is PRIMARY; this file reproduces the corpus for
implementation convenience.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk (here, or the exploration's RESEARCH.md / research/*.md);
  otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft upstream is CLEAN-ROOM reimplement only;
  permissive may be ported WITH attribution; missing/unverified ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ the exploration's `links.goals`.
-->

- **Source exploration:** `explorations/agent-execution-sandbox` — primary
  ledger:
  [`explorations/agent-execution-sandbox/research/SOURCES.md`](../../../explorations/agent-execution-sandbox/research/SOURCES.md).
- **Provenance:** routed 2026-07-25 from the `academia-corpus-mining` align
  dispatch. Research was one workflow of 10 agents (4 external-landscape, 2
  in-repo inventory, 1 completeness critic, 3 follow-ups); verbatim structured
  outputs are the numbered reports `01`–`10` in the exploration's `research/`
  directory, each carrying per-claim URLs and per-source license notes as the
  agent verified them.
- **Nothing is vendored or ported.** No upstream code has been adopted. The
  dispositions below govern any future adoption.

## 1. Mined source corpus

Papers, not code — pattern sources only, cited through the parent packet's
on-disk cluster reports. Ids are sha256-derived keys into
`explorations/academia-corpus-mining/research/paper-catalog.jsonl`; full texts
stay outside this public repo.

| Source | Title (catalog) | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `9e55e391080a` | SymbolicAI: a framework for logic-based approaches… | n/a (paper) | `explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md` | the missing boundary | reference |
| `caefce8b35a2` | LLM Agents can Autonomously Exploit One-day Vulnerabilities | n/a (paper) | `explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md` | threat model for the browser/terminal tier | reference |
| `05d0a27d8629` | Secure-by-Default Guardrails for MCP-Based Tool Use… | n/a (paper) | same | default-deny pipeline; read-plus-egress gap | reference |
| `2ad7451c2819` | AGENT-FENCE: Mapping Security Vulnerabilities… | n/a (paper) | same | trajectory fields, authorization-break predicates | reference (rankings provisional) |
| `faeed21c6fc9` | Towards Trustworthy Agentic AI… | n/a (paper) | same | survey-derived control hypotheses | reference (not validated thresholds) |

**How these inform implementation:** they justify *having* a default-deny
boundary and a recorded decision per action; they supply **no** number,
percentage, ranking, or threshold this packet may import. Nothing in this corpus
is a design to copy — the concrete design comes from §2 and §4.

## 2. Upstream repositories & licenses

Only the entries this packet's implementation could plausibly touch are
reproduced here. The full table (≈35 repos across isolation tiers, authz
engines, egress proxies, and transparency logs) is in the exploration ledger §2.

### Permissive — may port with attribution

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [stripe/smokescreen](https://github.com/stripe/smokescreen) | MIT | port-with-attribution | Egress ACL ladder and precedence lattice — the shape of destination policy evaluation |
| [anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) | Apache-2.0 | port-with-attribution | Closest default-deny reference, TS-native. Relevant to the deferred host-isolation packet, not to this one |
| [cedar-policy/cedar](https://github.com/cedar-policy/cedar) + [cedar-spec](https://github.com/cedar-policy/cedar-spec) | Apache-2.0 | reference (named escalation path) | Default-deny PDP semantics; differential-testing assurance pattern worth copying even with an in-house evaluator |
| [open-policy-agent/opa](https://www.openpolicyagent.org/docs) | Apache-2.0 | reference | Decision logs naming bundle revision + masking — the precedent for pinning `policyRevision` into every record |
| [C2SP/C2SP](https://github.com/C2SP/C2SP) | specs CC-BY-4.0, code BSD-1-Clause | clean-room from spec | tlog-tiles / checkpoint / witness specs; basis for the deferred anchoring packet |
| [transparency-dev/tessera](https://github.com/transparency-dev/tessera) | Apache-2.0 | reference | Current-gen tlog library (Go); deferred anchoring packet |
| [sigstore/sigstore-js](https://github.com/sigstore/sigstore-js) | Apache-2.0 | reference | TS-native transparency-proof verification |
| [eclipse-biscuit/biscuit](https://github.com/eclipse-biscuit/biscuit) | Apache-2.0 | reference | Offline-attenuable capability tokens — explicitly rejected for v1 (decision 3), retained as the escalation path |

### Copyleft / source-available — clean-room reference only

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [codenotary/immudb](https://github.com/codenotary/immudb) | BUSL-1.1 (relicensed from Apache-2.0 — verify terms) | clean-room | Verifiable-DB design reference only |
| [evilsocket/opensnitch](https://github.com/evilsocket/opensnitch) | GPL-3.0 | clean-room | Ask-on-new-destination interaction model only |
| [daytonaio/daytona](https://github.com/daytonaio/daytona) | AGPL-3.0, public repo frozen 06/2026 | do not depend | Build-vs-buy cautionary datum |

### Unverified — reference only until license-checked

`invariantlabs-ai/mcp-injection-experiments`; LlamaFirewall (PurpleLlama mixed
licensing); `Romern/redactionschemes`; Kata Containers; and
`modelcontextprotocol/modelcontextprotocol` (GitHub API reports NOASSERTION).
Full re-verification list:
[`10-research-critique.md`](../../../explorations/agent-execution-sandbox/research/10-research-critique.md).

## 3. External research sources

Every citation lives with its claim in the exploration's numbered reports.
The ones this packet's decisions actually lean on:

- **Specs**: RFC 9162 (CT v2 Merkle proofs) for the chain shape; RFC 8693
  (token exchange / act chains) for the actor-chain vocabulary recorded as data;
  MCP authorization + security best practices for the "no token passthrough"
  constraint. (Exploration reports 02, 04, 09.)
- **Papers**: Zanzibar (ATC '19) for the new-enemy problem that makes
  `policyRevision` load-bearing; Macaroons (NDSS 2014) and Capability Myths
  Demolished for the attenuation model; CaMeL (2503.18813) and the six design
  patterns (2506.08837) for authorization-outside-the-model. (Reports 02, 03.)
- **Production reports**: Sigstore's privacy retrospective — anything in an
  append-only log is effectively unerasable — which is the direct argument for
  decision 4's no-payload ledger. Fly.io's macaroon report on untyped caveat
  blobs, which argues for typed schema caveats. Meta Policy Zones as the
  industrial reference for the taint propagation this packet does **not**
  attempt. (Reports 02, 04.)
- **Incidents (2025–2026)**: GitHub MCP toxic flow; Supabase MCP leak (the sink
  was an ordinary permitted *write*, which is why policy keys on audience rather
  than protocol); EchoLeak CVE-2025-32711; postmark-mcp backdoor; mcp-remote
  CVE-2025-6514. (Report 03.)

Sources the critique flags as cited-from-search-results-only — including FRCP
37(e) rule text, AICPA TSC, Schneier–Kelsey, and the MCP best-practices full
text — are marked in-place in the reports and **must be re-fetched before
normative use**. None of them gate this packet's implementation.

## 4. In-repo capability references

The bricks this packet composes. Verified with line anchors in the exploration's
reports [05](../../../explorations/agent-execution-sandbox/research/05-repo-execution-authority-surfaces.md)
and [06](../../../explorations/agent-execution-sandbox/research/06-repo-records-governance-seams.md).

| Brick | Path | Use |
|---|---|---|
| `TierGate` default-deny dispatch + audit record | `packages/foundation/capability/mcp-kit/src/TierGate.ts` | **extend** — `recordOutcome` added; the evaluator is a new implementation of the existing port |
| Caller identity + sanitized dispatch | `packages/foundation/capability/mcp-kit/src/{SanitizedSpan,McpCaller}.ts` | **reuse** — `clientId` is the run key |
| Outbound HTTP transformer | `packages/foundation/capability/api-transport/src/Transport.ts` | **extend** — hosts the `EgressDenied` marker (vocabulary, not the enforcement seam) |
| Typed-verdict gate shape | `packages/epistemic/use-cases/src/ClaimGate/` | **reuse** — refusal-as-value, error channel `never` |
| `UsageRecord` ledger row | `packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts` | **reference** — the `metadata: UnknownRecord` → `persist.jsonb` escape hatch the ledger must *not* have |
| Principal union | `packages/shared/domain/src/entity/Principal.ts` | **reuse** — embedded in the grant |
| Draft/Frozen tagged-union idiom | `packages/workspace/domain/src/entities/Turn/Turn.model.ts:164-190` | **reuse** — `LiteralKit.mapMembers(Tuple.evolve(...)).pipe(S.toTaggedUnion(tag))` is the `GrantSet` freeze shape |
| Raw `pgTable` precedent | `packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts` | **reuse** — non-`BaseEntity` row precedent |
| Migration splitter | `packages/drivers/postgres/src/PostgresDrizzle.service.ts:22-23` | **reference** — the `LegacyStatementBoundary` constraint on plpgsql bodies |
| Lint-law mechanism | `Laws/NoNativeRuntime.ts` | **reuse** — pattern for banning `FrozenGrantSet.make` outside its module |
| Budgets + typed refusal idiom | `packages/ontology/use-cases/src/tools/OntologyToolkit.ts` | **extend** — `ontology_publish_provenance` |
| Transport auth reference + e2e proof | `apps/professional-desktop/server/*.ts`, `apps/professional-desktop/test/integration/ontology-mcp-http.test.ts` | **reuse** — the acceptance test's model |
| Execution ledger tables + grant schema | `packages/epistemic/{domain,config,tables,use-cases,server}` | **NET-NEW** |
| Destination→audience resolver | — | **NET-NEW** — no destination-aware egress exists repo-wide |

## 5. Cross-links & provenance

- **Source exploration:**
  [`explorations/agent-execution-sandbox`](../../../explorations/agent-execution-sandbox/README.md)
  — [`BRIEF.md`](../../../explorations/agent-execution-sandbox/BRIEF.md),
  [`MAP.md`](../../../explorations/agent-execution-sandbox/MAP.md),
  [`DECISIONS.md`](../../../explorations/agent-execution-sandbox/DECISIONS.md)
  (14 dated decisions; this packet's `SPEC.md` decision log back-links to it).
- **Parent corpus ledger:**
  [`explorations/academia-corpus-mining/research/SOURCES.md`](../../../explorations/academia-corpus-mining/research/SOURCES.md)
  — primary for all mined-paper provenance.
- **Research-debt register:**
  [`10-research-critique.md`](../../../explorations/agent-execution-sandbox/research/10-research-critique.md)
  — unverified-source cluster; the RFC 3161 / eIDAS anchoring gap that defers
  the `agent-execution-record-anchoring` candidate; the repo-wide KMS void that
  keeps payload storage out of scope.
- **Sibling packets whose ownership this packet consumes or settles:**
  `goals/epistemic-bitemporal-edge-core` (immutability precedent and the
  Exception Ledger pattern), `explorations/ingestion-security-secret-governance`
  (credential custody — brokered, never held here),
  `explorations/agent-governance-control-plane` (governance protocol; settled
  from this side by decision 5), `explorations/mcp-auth-gated-registration`
  (absorbed by decision 2).
