# Agent Execution Sandbox — Sources & Provenance

<!--
The provenance ledger for this packet. Started in the research stage
(2026-07-25); keep current through graduate; the graduated goal inherits a
copy.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk
  URL, cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/BUSL/SSPL) upstream is
  CLEAN-ROOM reimplement only; permissive (MIT/Apache/BSD) may be ported WITH
  attribution; missing/unverified LICENSE ⇒ reference only.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Origin:** routed 2026-07-25 from the
  [`academia-corpus-mining`](../../academia-corpus-mining/README.md) align
  dispatch (high-priority route: default-deny execution authority).
- **Research method:** one `agent-sandbox-research` workflow (2026-07-25):
  4 external-landscape agents + 2 in-repo inventory agents → completeness
  critic → 3 follow-up agents. Verbatim structured outputs are the
  numbered reports in this directory (`01`–`10`); each carries per-claim
  URLs and per-source license notes exactly as the agent verified them.

## 1. Mined source corpus (inherited from the parent packet)

Papers, not code — pattern sources only, cited via the parent packet's
on-disk cluster reports (Academia.edu downloads carry no stable canonical
URLs; the parent's ledger discipline applies). Ids are sha256-derived keys
into
[`../../academia-corpus-mining/research/paper-catalog.jsonl`](../../academia-corpus-mining/research/paper-catalog.jsonl);
full texts stay outside this public repo.

| Id | Title (catalog) | Carried by | Disposition |
|---|---|---|---|
| `9e55e391080a` | SymbolicAI: a framework for logic-based approaches… | [t3-agent-metacognition-neurosymbolic](../../academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md) | lesson = the missing boundary; not an implementation to copy |
| `caefce8b35a2` | LLM Agents can Autonomously Exploit One-day Vulnerabilities | [t3-agent-security-orchestration](../../academia-corpus-mining/research/t3-agent-security-orchestration.md) | sharpest warning for the browser/terminal fixture |
| `05d0a27d8629` | Secure-by-Default Guardrails for MCP-Based Tool Use… | same | default-deny pipeline pattern; exposes read-plus-egress gap |
| `2ad7451c2819` | AGENT-FENCE: Mapping Security Vulnerabilities… | same | trajectory fields, authorization-break predicates; rankings provisional |
| `faeed21c6fc9` | Towards Trustworthy Agentic AI… | same | survey-derived control hypotheses, not validated thresholds |

The corpus is strong enough to demand boundary fixtures, not strong enough to
import any security percentage, ranking, or numerical limit (parent report,
Quality notes).

## 2. Upstream repositories & licenses

Nothing vendored or ported yet — dispositions below govern any future
adoption. All "verified" entries were checked by a research agent against the
repo LICENSE file or the GitHub API license endpoint on 2026-07-25 (per-source
notes in the numbered reports).

### Permissive — may port with attribution

| Repo | License | Why it matters | Report |
|---|---|---|---|
| [anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) | Apache-2.0 | Closest default-deny reference; TS-native; primary port candidate | 01, 03, 08 |
| [openai/codex](https://github.com/openai/codex) | Apache-2.0 | bwrap-first Linux tier, portable SBPL profiles, Windows tier | 07 |
| [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | Apache-2.0 | Parameterized `.sb` profile family | 07 |
| [kubernetes-sigs/agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox) | Apache-2.0 | Cluster-tier CRDs, managed default-deny NetworkPolicy | 07 |
| [google/gvisor](https://github.com/google/gvisor) | Apache-2.0 | Syscall-surface isolation tier | 01 |
| [firecracker-microvm/firecracker](https://github.com/firecracker-microvm/firecracker) | Apache-2.0 | Hostile-tier microVM with built-in resource ceilings | 01 |
| [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) | Apache-2.0 (LLVM exc.; exact text hedged — recheck) | Zero-ambient-authority component tier, fuel metering | 01 |
| [cloudflare/workerd](https://github.com/cloudflare/workerd) | Apache-2.0 | Binding syntax for named grants; self-disclaims sole-boundary | 01 |
| [google/nsjail](https://github.com/google/nsjail) | Apache-2.0 | Declarative per-run limits config shape (rlimits+cgroups) | 01 |
| [e2b-dev/E2B](https://github.com/e2b-dev/E2B) + [infra](https://github.com/e2b-dev/infra) | Apache-2.0 | Remote-tier Firecracker orchestration patterns | 01 |
| [superradcompany/microsandbox](https://github.com/superradcompany/microsandbox) | Apache-2.0 | Self-hosted microVM + native MCP; beta, watch only | 01 |
| [stripe/smokescreen](https://github.com/stripe/smokescreen) | MIT | Egress ACL ladder, precedence lattice, mTLS role identity | 08 |
| [mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy) | MIT | TLS-termination mechanics; spike harness for URL/method policy | 08 |
| [superfly/tokenizer](https://github.com/superfly/tokenizer) | Apache-2.0 | Sealed-secret credential-injection proxy | 08 |
| [coredns/coredns](https://github.com/coredns/coredns) (acl plugin) | Apache-2.0 | Per-sandbox scoped resolver with query-level policy + metrics | 08 |
| [eclipse-biscuit/biscuit](https://github.com/eclipse-biscuit/biscuit) + [biscuit-wasm](https://github.com/eclipse-biscuit/biscuit-wasm) | Apache-2.0 | Offline-attenuable capability tokens, revocation ids | 02 |
| [storacha/ucanto](https://github.com/storacha/ucanto) | Apache-2.0/MIT | Typed capability-invocation runtime in TS (pattern source) | 02 |
| [cedar-policy/cedar](https://github.com/cedar-policy/cedar) + [cedar-spec](https://github.com/cedar-policy/cedar-spec) | Apache-2.0 | Default-deny PDP candidate; Lean-verified assurance pattern | 02 |
| [openfga/openfga](https://github.com/openfga/openfga) | Apache-2.0 | ReBAC relationship layer option | 02 |
| [authzed/spicedb](https://github.com/authzed/spicedb) + [authzed-node](https://github.com/authzed/authzed-node) | Apache-2.0 | Caveated relationships + ZedToken consistency | 02 |
| [spiffe/spire](https://github.com/spiffe/spire) | Apache-2.0 | Attestation-based workload identity pattern | 02 |
| [open-policy-agent/opa](https://www.openpolicyagent.org/docs) | Apache-2.0 | Decision logs naming bundle revision + masking | 02 |
| [transparency-dev/tessera](https://github.com/transparency-dev/tessera) | Apache-2.0 | Current-gen tlog library (Go; sidecar or spec-port) | 04 |
| [transparency-dev/witness](https://github.com/transparency-dev/witness) | Apache-2.0 | Checkpoint cosigning against split-view | 04 |
| [sigstore/rekor-tiles](https://github.com/sigstore/rekor-tiles) | Apache-2.0 | Shard-and-freeze ledger lifecycle reference | 04 |
| [sigstore/sigstore-js](https://github.com/sigstore/sigstore-js) | Apache-2.0 | TS-native transparency-proof verification | 04 |
| [google-research/camel-prompt-injection](https://github.com/google-research/camel-prompt-injection) | Apache-2.0 | Authorization-outside-the-model reference (unmaintained research artifact) | 03 |
| [invariantlabs-ai/mcp-scan](https://github.com/invariantlabs-ai/mcp-scan) (Snyk Agent Scan) | Apache-2.0 | Pre-admission scanner; itself needs the sandbox | 03 |
| [lasso-security/mcp-gateway](https://github.com/lasso-security/mcp-gateway) | MIT | PEP-topology precedent; probabilistic redaction layer only | 03 |
| [NVIDIA-NeMo/Guardrails](https://github.com/NVIDIA-NeMo/Guardrails), [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) | Apache-2.0 | Validator tier (never the boundary) | 03 |
| [C2SP/C2SP](https://github.com/C2SP/C2SP) | specs CC-BY-4.0, code BSD-1-Clause | tlog-tiles/checkpoint/witness specs — clean TS reimplementation basis | 04 |
| [modelcontextprotocol/ext-auth](https://github.com/modelcontextprotocol/ext-auth) | MIT | Enterprise-managed authorization (ID-JAG applied to MCP) — spec text | 09 |

### Copyleft / source-available — clean-room reference only

| Repo | License | Note | Report |
|---|---|---|---|
| [daytonaio/daytona](https://github.com/daytonaio/daytona) | AGPL-3.0, public repo frozen 06/2026 | Do not depend; build-vs-buy cautionary datum | 01 |
| [codenotary/immudb](https://github.com/codenotary/immudb) | BUSL-1.1 (relicensed from Apache-2.0 — verify terms) | Verifiable-DB design reference | 04 |
| [evilsocket/opensnitch](https://github.com/evilsocket/opensnitch) | GPL-3.0 | Ask-on-new-destination interaction model only | 08 |
| [containers/bubblewrap](https://github.com/containers/bubblewrap/blob/main/LICENSE) | LGPL-2.0-or-later | Moot in practice: exec'd as external binary (as srt does), never linked | 01 |

### Unverified — reference only until licensed-checked

[invariantlabs-ai/mcp-injection-experiments](https://github.com/invariantlabs-ai/mcp-injection-experiments);
LlamaFirewall (PurpleLlama mixed licensing — component license not visible);
[Romern/redactionschemes](https://github.com/Romern/redactionschemes);
Kata Containers (license stated on site, repo LICENSE not fetched);
[modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol)
(GitHub API reports NOASSERTION). Full re-verification list:
[`10-research-critique.md`](./10-research-critique.md).

## 3. External research sources (non-code)

Every citation lives with its claim in the numbered reports; the ones a
packet-level decision leans on:

- **Specs/standards**: MCP authorization (2025-06-18, 2025-11-25, 2026-07-28
  RC) + security best practices; RFC 8693 (token exchange / act chains),
  RFC 9396 (RAR), RFC 9635 (GNAP), RFC 9110 §11.7.2 (Proxy-Authorization),
  RFC 8484 (DoH), RFC 9162 (CT v2 Merkle proofs); IETF drafts: transaction
  tokens, identity chaining, ID-JAG, WIMSE set, idempotency-key header
  (draft, not RFC); XACML 3.0; OWASP agentic taxonomies + SSRF cheat sheet;
  Landlock kernel UAPI. (Reports 02, 03, 04, 08, 09.)
- **Papers**: Capability Myths Demolished; Macaroons (NDSS 2014); Zanzibar
  (ATC '19); CaMeL (2503.18813); six design patterns (2506.08837);
  Crosby–Wallach tamper-evident logging; Schneier–Kelsey forward-secure logs
  (not fetched in full); PBAC lineage + 2023 purpose-limitation formalization
  (abstracts only); MCPTox (2508.14925, not fetched); OIDF agentic-identity
  whitepaper (arXiv 2510.25819). (Reports 02, 03, 04, 09.)
- **Production docs/posts**: Claude Code sandboxing + network-config; Docker
  Sandboxes microVM architecture; Modal security; Deno security model;
  Wasmtime security; Fly.io macaroons; Meta Policy Zones (2024/2025); OPA
  decision logs; Cilium toFQDNs/Tetragon; systemd resource-control; Copilot
  agent firewall; Codex cloud internet access; Operator/ChatGPT-agent system
  cards; Anthropic computer-use + prompt-injection defenses; Sigstore
  privacy/Rekor v2; Azure SQL ledger; S3 Object Lock; QLDB retirement;
  agent-payment credentials (Mastercard/Ramp — vendor claims). (Reports 01,
  02, 03, 04, 07, 08.)
- **Incidents (2025–2026)**: GitHub MCP toxic flow; Supabase MCP leak;
  EchoLeak CVE-2025-32711; postmark-mcp backdoor; mcp-remote CVE-2025-6514.
  (Report 03.)

Sources the critique flags as cited-from-search-results-only (Mozilla canary
page, Apple App Sandbox body, two GitHub issues, FRCP 37(e) rule text, AICPA
TSC, Schneier–Kelsey PDF, PBAC PDFs, MCP best-practices full text, MCPTox)
are marked in-place in the reports and must be re-fetched before normative
use.

## 4. In-repo capability references

The bricks this packet composes (verified with line anchors in
[05](./05-repo-execution-authority-surfaces.md) /
[06](./06-repo-records-governance-seams.md); summary table in
[`../RESEARCH.md`](../RESEARCH.md) §6):

| Brick | Path |
|---|---|
| Budgets + typed refusal idiom | `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`, `OntologyToolService.ts` |
| TierGate default-deny dispatch + audit record | `packages/foundation/capability/mcp-kit/src/TierGate.ts` |
| Credential-gated layer composition | `packages/foundation/capability/mcp-kit/src/{SourceAuth,ToolkitComposition,ApiKeyRequired}.ts` |
| Caller identity + sanitized dispatch | `packages/foundation/capability/mcp-kit/src/{SanitizedSpan,McpCaller}.ts` |
| Output ceilings | `packages/foundation/capability/mcp-kit/src/FieldTier.ts` |
| Outbound HTTP chokepoint | `packages/foundation/capability/api-transport/src/Transport.ts` |
| Spawn chokepoint + law | `ChildProcessSpawner` wiring (`packages/tooling/tool/cli/src/bin-main.ts`) + `Laws/NoNativeRuntime.ts` |
| ACP permission/terminal surface | `packages/drivers/acp/src/{AcpRpc.models,AcpClient.service,AcpAgent.service}.ts` |
| Env hygiene + shadow HOME | `packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.values.ts`, `packages/drivers/ai-provider-cli/src/AiProviderCliHome.service.ts` |
| Principal union | `packages/shared/domain/src/entity/Principal.ts` |
| UsageRecord ledger row | `packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts` |
| Typed-verdict gate shape | `packages/epistemic/use-cases/src/ClaimGate/`, `packages/shared/domain/src/values/ClaimLifecycle/` |
| Turn/tool-call trace | `packages/workspace/domain/src/entities/Turn/Turn.model.ts` |
| Redaction banks | `packages/tooling/library/ai-metrics/src/privacy.ts`, `packages/foundation/capability/observability/src/CauseRedaction.ts` |
| Transport auth reference + e2e proof | `apps/professional-desktop/server/*.ts`, `apps/professional-desktop/test/integration/ontology-mcp-http.test.ts` |

Sibling packets/goals whose ownership this packet consumes or must settle
(seam map in RESEARCH.md §7): `goals/ingestion-secret-scrub`,
`goals/agentic-professional-runtime`, `goals/epistemic-bitemporal-edge-core`,
`explorations/agent-governance-control-plane`,
`explorations/ingestion-security-secret-governance`,
`explorations/mcp-auth-gated-registration`,
`explorations/model-artifact-admission`,
`explorations/multi-provider-llm-dispatch-fallback`.

## 5. Cross-links & provenance

- Parent packet and corpus ledger:
  [`explorations/academia-corpus-mining/research/SOURCES.md`](../../academia-corpus-mining/research/SOURCES.md)
  (primary for all mined-paper provenance).
- This packet's [`CAPTURE.md`](../CAPTURE.md) (route provenance, boundary
  sketch, open tensions) and [`../README.md`](../README.md) (trail).
- Research-debt register: [`10-research-critique.md`](./10-research-critique.md)
  (unverified-source cluster; RFC 3161/eIDAS anchoring gap; repo KMS void).
