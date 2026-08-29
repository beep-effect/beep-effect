# Research

<!--
Stage 1. Cited external landscape + in-repo capability inventory. Every claim
cites a URL retrieved during research or a repo path; gaps are marked NOT
FOUND. Detailed per-slice reports live in research/ (structured subagent
outputs, verbatim); this file is the curated synthesis.
-->

## 2026-07-25 — Landscape sweep + repo inventory

Method: one `agent-sandbox-research` workflow — four external-landscape
agents, two in-repo inventory agents, a completeness critic, and three
critic-dispatched follow-ups (agent-CLI sandboxes, egress enforcement,
delegation standards). Full structured outputs, with per-claim URLs and
per-source license dispositions, are preserved verbatim under
[`research/`](./research/) (reports `01`–`10`); the provenance ledger is
[`research/SOURCES.md`](./research/SOURCES.md). This section compresses what
is load-bearing for align/shape.

### 1. External landscape — the layered-architecture consensus

Every in-runtime capability system surveyed disclaims being a lone security
boundary: workerd tells you to wrap it in a VM, Deno's docs require OS-level
sandboxing for untrusted code, Wasmtime documents defense-in-depth layering.
Every production agent-code platform pairs a kernel-or-VM host boundary with
an out-of-band policy plane: Modal on gVisor, E2B/AWS on Firecracker + jailer,
Docker Sandboxes on microVMs with pre-declared policy, Anthropic on
bubblewrap/Seatbelt + external proxy
([01 §17](./research/01-external-isolation-runtimes.md)). The convergent
architecture matches this packet's capture sketch: **typed named grants and
budgets expressed in the Effect layer for legibility and audit, enforced by an
OS/VM boundary plus a TLS-capable egress proxy, with authorization living in
boundary components — never in the model or generated code.**

Base-layer candidates, all license-verified ([01](./research/01-external-isolation-runtimes.md),
[07](./research/07-followup-agent-cli-sandboxes.md)):

- **Anthropic sandbox-runtime (srt)** — Apache-2.0, the only TS-native
  library-embeddable default-deny sandbox found (bubblewrap+seccomp / Seatbelt
  / WFP-alpha; deny-all network via host HTTP+SOCKS5 proxies with optional
  per-destination TLS termination). Honest threat appendix: env-var proxy
  bypass on Linux, domain fronting, Unix-socket escapes, **no CPU/memory/disk
  ceilings**.
- **OpenAI Codex CLI** — Apache-2.0 Rust; the strongest portable corpus of
  per-OS enforcement. Architecture signal: OpenAI migrated Linux enforcement
  from Landlock-first to **bubblewrap-first** (Landlock is now legacy
  fallback), with a seccomp socket-block + netns/UDS proxy bridge for
  allowlisted egress; deny-default SBPL Seatbelt profiles portable nearly
  verbatim; native Windows tier (sandbox user + ACL + firewall).
- **Google Gemini CLI** — Apache-2.0; counter-example on defaults (sandboxing
  opt-in, default Seatbelt profile allows network) but its six parameterized
  `.sb` profiles are a clean tiered-profile template.
- **Kubernetes SIG agent-sandbox** — Apache-2.0, pre-1.0, active: Sandbox /
  SandboxTemplate / SandboxClaim / SandboxWarmPool CRDs, hard isolation via
  `runtimeClassName` (gVisor/Kata recipes), controller-managed default-deny
  NetworkPolicy. The cluster tier gets resource ceilings for free via pod
  limits.
- **Hostile-tier primitives** — Firecracker (vCPU/memory/I/O rate ceilings
  built in, Linux/KVM-only), gVisor (proven for untrusted AI code at Modal),
  Wasmtime (purest zero-ambient-authority grant model + fuel/epoch CPU
  metering; component tier only). nsjail's protobuf config is a ready-made
  declarative shape for a per-run limits artifact.
- **Ruled out / reference-only** — Daytona (AGPL-3.0 and public repo frozen
  mid-2026 — also a cautionary datum: agent-sandbox vendors can close OSS
  mid-lifecycle, favoring primitives over platforms); Modal and Docker
  Sandboxes (proprietary; good lifecycle/design language: "boundaries defined
  before the agent runs, not by the agent").

Two cross-cutting facts constrain the design. **No laptop-local CLI sandbox
(srt, Codex, Gemini) has any CPU/memory/process/disk ceiling** — host resource
ceilings must be added deliberately (cgroup v2 + rlimits, as nsjail composes)
or delegated to a microVM/cluster tier
([07 §13](./research/07-followup-agent-cli-sandboxes.md)). And macOS
`sandbox-exec`/Seatbelt is **officially deprecated yet load-bearing for all
three vendors** — it still works on macOS 26, Apple ships no replacement for
non-App-Store process sandboxing, so a macOS tier is best-effort
defense-in-depth with a container fallback, monitored per OS release
([07 §10–11](./research/07-followup-agent-cli-sandboxes.md)).

### 2. External landscape — egress is the hard, novel part

Hostname allowlisting is the floor, not the policy: Claude Code's own docs
warn the non-terminating proxy is bypassable via domain fronting, and broad
domains (github.com) are exfiltration paths
([01 §3](./research/01-external-isolation-runtimes.md)). The assembled prior
art ([08](./research/08-followup-egress-enforcement.md)) gives the packet a
nearly complete enforcement stack:

- **Policy ladder & precedence** — Stripe Smokescreen (MIT): per-role
  `open/report/enforce` (with `report` as the observe-only rollout mode), a
  debugged precedence lattice (global-deny > role allow > global-allow),
  mTLS-bound principal identity, and budget controls at the same chokepoint.
- **TLS termination as per-destination opt-in** — srt's `tlsTerminate` +
  `excludeDomains` pattern: CONNECT-hostname policy always on, decrypted
  request filtering only where authorized, pinned clients degrade to
  hostname-only instead of breaking. Smokescreen's `mitm_domains` adds
  per-destination header injection — production prior art for stamping
  purpose/run metadata onto authorized flows only.
- **Credential non-possession** — proxy-side injection: Claude Code's
  credential "mask" mode and Fly.io tokenizer (Apache-2.0) sealed secrets that
  name their own `allowed_hosts`. The agent process never holds a usable
  secret, and the secret itself binds to its permitted sink.
- **Kernel floor without new daemons** — systemd per-unit
  `IPAddressAllow/Deny` and cgroup eBPF (`cgroup/connect4` redirect +
  `cgroup_skb/egress` deny) make proxy routing enforced rather than
  env-var-cooperative. Tetragon's docs supply the governing lesson: denial
  must be **synchronous at connect time** — async kill-after-the-fact is not a
  control.
- **DNS is its own sink** — srt documents that system-resolver lookups are not
  fenced; DNS tunneling exfiltrates through recursive resolution; DoH on 443
  makes DNS-layer filtering untrustworthy as a boundary. The enforceable
  design is Cilium's: the sandbox's resolver is the only source of legitimate
  IPs, connects to never-resolved IPs are denied, and the proxy dials the IP
  it validated (OWASP anti-rebinding), with resolution logged as telemetry.
- **Production ergonomics** — GitHub Copilot's agent firewall writes blocked
  requests into the PR body (denial as run evidence, matching this packet's
  typed-outcome requirement); OpenAI Codex cloud ships an HTTP-method
  restriction (GET/HEAD/OPTIONS) — method as a first-class, cheap, high-value
  policy dimension; Claude Code's network-config doc gives the minimum
  allowlist an agent run needs and the rule that **repo-controlled files must
  never configure the proxy/CA path** (else the control plane is
  agent-writable).

### 3. External landscape — authorization, delegation, purpose, budget

Foundations and convergences ([02](./research/02-external-authorization-capability-models.md),
[09](./research/09-followup-delegation-agent-identity.md)):

- **Ocap discipline** (Capability Myths Demolished) is the theory behind "no
  ambient authority"; **monotonic attenuation** is the convergent invariant
  across macaroon caveats, Biscuit blocks, UCAN delegation, and IETF
  Transaction Tokens' narrow-only replacement rule.
- **Revocation is the structural weakness** of offline-verifiable tokens: UCAN
  revocation is explicitly eventually consistent ("last line of defense");
  Fly.io's production answer is nonce + revocation list + short expiry with
  centralized verification. Design consequence: short expiries and
  attenuation offline, plus an **online policy check at sink time** — Zanzibar
  zookies (the "new enemy" problem is stale-grant disclosure in disguise) are
  the canonical mechanism for pinning a run to a named policy revision.
- **Typed caveats over untyped blobs**: Fly.io built macaroons from scratch
  because community implementations use opaque blobs — favoring an
  effect/Schema-native grant language over adopting a token library's DSL.
  Cedar (Apache-2.0, formally verified in Lean, WASM TS bindings, default-deny
  forbid-wins) is the strongest drop-in PDP candidate; OPA's decision logs
  (decision id + input + result + **bundle revision** + auditable masking) are
  direct prior art for execution records naming their policy revision. XACML
  contributes the >2-valued decision vocabulary and fail-closed
  **obligations** (post-decision duties like redact-before-egress).
- **Purpose-binding has real lineage**: PBAC purpose hierarchies with a
  subsumption-matching algorithm (GDPR purpose-limitation-derived), and Meta's
  Policy Zones showing at industrial scale that **purpose labels must flow
  with data from read to sink** — access-time checks cannot catch the
  read-plus-egress composition. This is the strongest external support for
  the packet's most novel requirement, and nothing portable implements it at
  repo scale.
- **Budget is an accepted authorization dimension**: RFC 9396 Rich
  Authorization Requests (typed `authorization_details` with
  `instructedAmount`), and 2025–2026 agent-payment credentials (Mastercard
  Agent Pay, single-transaction virtual cards with merchant allowlists, spend
  limits, auto-expiry) — principal + purpose + ceiling + sink + expiry
  composed into one externally enforced credential, exactly the packet's grant
  shape.
- **Delegation chains**: RFC 8693 distinguishes delegation from impersonation
  — the sandbox must mint **delegation-style** credentials (nested `act`
  claims for user → orchestrator → subagent lineage; `may_act` to
  pre-authorize actor substitution). GNAP's pending-grant/continuation states
  are the standards-track shape for "agent requests, human approves later."
  MCP normatively **forbids token passthrough**, so every hop needs a fresh
  re-audienced credential — precisely the niche capability attenuation or
  token exchange fills. Enterprise direction: ID-JAG / Okta Cross App Access
  (with an MIT-licensed MCP ext-auth extension applying it); WIMSE supplies
  the separate workload-identity plane (which agent binary), and multi-hop
  agent delegation is an **open IETF gap** — composing the two planes puts
  this design ahead of, not behind, the standards curve. SPIFFE's
  attestation-not-secrets pattern covers naming non-human principals.

### 4. External landscape — agent/MCP security evidence

([03](./research/03-external-agent-mcp-security.md)) The corpus-mined claims
from capture are now corroborated by named incidents:

- **Read + allowed sink = disclosure, empirically**: GitHub MCP toxic flow
  (broad ambient token + public PR as the sink), Supabase MCP leak
  (service_role read + attacker-visible **database write** as the sink — the
  egress channel was an ordinary allowed write, so sinks must be classified
  by *audience*, not protocol), EchoLeak (zero-click; the sink was renderer
  image-fetching — implicit sinks are governed egress too).
- **Supply chain**: postmark-mcp backdoor and mcp-remote CVE-2025-6514 (RCE
  from merely connecting) — MCP servers and even OAuth discovery metadata are
  untrusted principals; server processes belong **inside** the default-deny
  boundary, and admission scanners themselves execute what they scan.
- **Tool identity must be pinned**: Invariant Labs' tool poisoning / rug pulls
  / cross-server shadowing motivate grants that hash the tool definition at
  approval time — a definition change invalidates the grant (the packet's
  policy-revision field, concretely).
- **Authorization outside the model is provable**: CaMeL (Apache-2.0 research
  artifact) enforces per-value capabilities in a deterministic interpreter
  before each tool call, at a ~23–33% utility cost — the feasibility baseline
  to quote. The six design patterns paper (Plan-Then-Execute et al.) gives
  the grant-lifecycle shape: **finalize and freeze the grant set before any
  untrusted input enters context**, turning later injection into a typed
  denial rather than a policy question.
- **Guardrails are validators, not boundaries**: LlamaFirewall / NeMo
  Guardrails / Guardrails AI detect and filter; none bind principals,
  resources, budgets, or sinks. Their failures surface as the packet's typed
  `validator failure` outcome inside a deterministic boundary (Willison's
  "99% is failing" argument). Production gates (Anthropic computer-use
  classifiers → human confirmation; Operator confirmations / watch mode /
  takeover mode) map onto the packet's escalation, supervision-class, and
  secret-minimizing outcomes.
- **MCP protocol trajectory**: target 2025-11-25 semantics (audience-bound
  tokens, RFC 8707 resource indicators, incremental scope consent), design
  for the 2026-07-28 RC (iss validation, credential binding, stateless
  protocol — continuity must live in execution records, not session state).
  The STDIO carve-out (env credentials) is exactly the ambient authority the
  sandbox removes.

### 5. External landscape — tamper-evident records with secret minimization

([04](./research/04-external-tamper-evident-records.md)) The field cleanly
separates what proofs give from what they do not — CT's and Rekor's own
framing confirms the capture axiom (inclusion proofs show presence and
append-only evolution, never legitimacy or authorization):

- **Adopt RFC 9162 proof semantics; serve tlog-tiles**: Merkle history trees
  beat naive hash chains by orders of magnitude in proof size
  (Crosby–Wallach); C2SP tlog-tiles (CC-BY-4.0 spec) serves an entire log as
  static, CDN-cacheable tiles + one Ed25519-signed checkpoint — offline
  verifiable by tenants, auditors, or a court expert. sigstore-js
  (Apache-2.0) proves the TS-native verification path. Rekor v2's
  shard-and-freeze lifecycle maps onto legal-matter lifecycle
  (active → closed → retained). Trillian is maintenance-mode; build on
  Tessera patterns or reimplement the (small) spec.
- **The threat is the platform itself**: a single-operator ledger proves
  nothing about non-equivocation; witness cosigning or at minimum periodic
  checkpoint anchoring into a second trust domain (S3 Object Lock, a
  customer-visible endpoint) counters split-view/alternate-history rewrites.
  The Azure SQL ledger digest-anchoring pattern — records in Postgres,
  app-level Merkle blocks, digests exported to WORM — is the most directly
  portable shape, with its honest "detect, not prevent" threat model. QLDB's
  retirement is the cautionary tale against coupling guarantees to a managed
  ledger product; immudb is now BUSL-1.1 (cleanroom reference only).
- **Redaction vs immutability resolves via storage classes + crypto-shredding**:
  the tamper-evident class stores only hashes, opaque principal/purpose/grant
  identifiers, and typed outcomes (Sigstore's PII-in-log regret is the hard
  rule — attorney-client material is only ever committed-to, never embedded);
  secret-bearing payloads live in an encrypted class under per-matter/principal
  DEKs where **key destruction is the erasure mechanism** — itself a loggable,
  attributable event. Redactable signatures remain academic; hash-commitment
  per field gives Merkle-style selective disclosure for free.
- **Legal-tech obligations are first-class**: FRCP 37(e) preservation means a
  per-matter legal-hold flag that suspends retention expiry **and freezes DEK
  destruction**, itself an immutable ledger event (mirroring S3 Object Lock's
  governance/compliance/legal-hold trichotomy); SOC 2 C1.2 secure-disposal
  coexists with immutability only via this class separation; forward-secure
  keying (Schneier–Kelsey) matters because the logger may share a host with
  semi-trusted generated code. Every side-effecting invocation carries an
  idempotency key so replay/duplicate is a typed outcome, not a silent re-run.

### 6. In-repo capability inventory

Full detail with line-anchored paths in
[05](./research/05-repo-execution-authority-surfaces.md) and
[06](./research/06-repo-records-governance-seams.md). The bricks that exist
(compose, don't rebuild):

| Brick | Where | What it gives the sandbox |
|---|---|---|
| Server-owned budgets + typed refusal | `packages/ontology/use-cases/src/tools/OntologyToolkit.ts` | Ceilings-as-schema-constants, refusal-as-value union, `failureMode: "return"` — the canonical boundary idiom |
| Enforcement pipeline | `packages/ontology/use-cases/src/tools/OntologyToolService.ts` | validate → check ceiling → take permit → execute → record; CAS + Semaphore(1) TOCTOU closure; workspace-root confinement |
| Default-deny dispatch gate + per-call audit | `packages/foundation/capability/mcp-kit/src/TierGate.ts` | The repo's real MCP security boundary: fail-closed (unannotated ⇒ destructive), refusal-as-value, sanitized `TierGateAuditRecord` per call. **Audit is generated but nowhere persisted** |
| Composition-time capability vanishing | `mcp-kit` `SourceAuth.ts` / `ToolkitComposition.ts` | Hard-gated layers don't exist without the credential — "ungranted capability is absent, not erroring" |
| Request-local caller identity | `mcp-kit` `SanitizedSpan.ts` / `McpCaller.ts` | The dispatch-wrap seam for threading principal/grant/budget context into every tool call |
| Output ceilings | `mcp-kit` `FieldTier.ts`; SPARQL safeguards | Byte-budgeted projection + fetchable handles — the output-channel resource ceiling |
| Transport auth reference | `apps/professional-desktop/server/OntologyMcpTransport.ts`, `RpcSessionAuth.ts` | Origin allowlist + bearer token + feature-gated mutation mount + decision metrics; e2e proof in `test/integration/ontology-mcp-http.test.ts` |
| Outbound HTTP chokepoint | `packages/foundation/capability/api-transport/src/Transport.ts` | The single shared egress wrapper (auth, rate limit, retry) — destination policy slots in as one more `transformClient` stage. No filtering today; keyless drivers can bypass via FetchHttpClient |
| Process-spawn chokepoint | `ChildProcessSpawner` layers + `NoNativeRuntime` lint law | All agent-adjacent spawning behind one injectable service; wrap the layer, the repo inherits it. No policy/ceilings today; a few `Bun.spawnSync` escapes in tooling bootstrap |
| Cross-tool agent surface | `packages/drivers/acp` (`RequestPermissionRpc`, terminal lifecycle RPCs) | The permission-request seam and client-owned terminals the sandbox must govern; no default policy handler, decisions not recorded |
| Spawn-time hygiene | `packages/agents/domain` `ProviderInstance.values.ts`; `ai-provider-cli` shadow-HOME | Env records that reject credential-shaped names at decode; per-instance HOME isolation (convention, not OS-enforced) |
| Principal vocabulary | `packages/shared/domain/src/entity/Principal.ts` | `AgentPrincipal` with required `onBehalfOfUserId` — grants key to this union; identity only, no scopes/verification |
| Usage/cost ledger row | `packages/epistemic/domain/.../UsageRecord.model.ts` + sinks | Actor + model + tokens + spend micros + `credentialReference` + metadata jsonb (TierGate's designated audit sink). Mutable BaseEntity rows — append-only by convention only |
| Typed-verdict gate shape | `ClaimGate` (`packages/epistemic/use-cases`), `ClaimLifecycleTransition` | The repo-blessed gate pattern ("records a transition, does not authorize one"); the sandbox authority service is its third instance |
| Immutability substrate (design) | `goals/epistemic-bitemporal-edge-core` P0 spike + `ops/handoffs/p0-to-p1-handoff.md` | Half-open bitemporal axes, supersession lineage, typed conflicts — cite the handoff (spike code is scheduled for deletion); P1 not landed |
| Approval surface | `goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md`; `ApprovalGate` entity | Seven-verdict model; gate-record field list. Code vocabulary is `['pending']`/`['candidate']` only; **the action-authorization and release verdicts have no code owner** |
| Turn/tool-call event trace | `packages/workspace/domain` `Turn.model.ts`; `ThreadStore` | Append-only (by repo surface) tool_call/tool_result items — the causal-parent trace execution records correlate with |
| Redaction banks | `ai-metrics/privacy.ts`, `observability/CauseRedaction.ts` | Pre-consolidation (ingestion-secret-scrub owns merging); route failure causes through before persisting; do not add a third bank |

Verified NOT FOUND (both repo agents, independent searches; terms recorded in
[05](./research/05-repo-execution-authority-surfaces.md) /
[06](./research/06-repo-records-governance-seams.md)): a named authority-grant
object (principal + purpose + resource + operation + sink + budget + policy
revision + expiry) or any revocation model; default-deny host authority;
destination-aware egress anywhere; resource ceilings beyond per-request counts
(no CPU/memory/process/fs/output/cumulative-run limits); any OS isolation
primitive (zero hits for seccomp/landlock/bubblewrap/nsjail/isolated-vm);
cross-tool taint/label propagation; a tamper-evident ledger (no hash chains,
no append-only DB enforcement); IAM sessions/scopes; a central env manifest
(`@beep/shared-config` reserved, not created); `safeForPrompt` in code
(spec-only); durable execution (workflow-engine spike unstarted); and — per
the critic's spot-check — **no encryption-at-rest / KMS / retention /
legal-hold / crypto-shredding seam at all** (the storage-class design lands on
greenfield; the only custody surface is the 1Password reference schema +
CLI driver).

### 7. Seam map (verified ownership)

From [06 §18](./research/06-repo-records-governance-seams.md):

- **Owned elsewhere — consume**: prompt admission → `ingestion-secret-scrub`
  (`safeForPrompt`, explicitly not action authorization); human disposition →
  professional-runtime policy + `ApprovalGate`; immutability/supersession
  substrate → `epistemic-bitemporal-edge-core`; governance protocol (roles,
  gated lifecycles, blockers, exceptions) → `agent-governance-control-plane`;
  credential custody → `ingestion-security-secret-governance` vault candidates
  (the sandbox **brokers through** it, never holds custody); model
  qualification → `model-artifact-admission` (admission dispositions must not
  collapse into action authorization); MCP mount-gating + per-call audit →
  `@beep/mcp-kit` (shipped).
- **Contested / unsettled**: the sandbox-vs-control-plane execution-isolation
  seam (capture's own words: "the seam is not settled"); the first
  action-authorization fixture vs `mcp-auth-gated-registration`'s
  `mcp-write-wall` (that packet's sole surviving candidate is one of Q10's
  fork options in miniature — picking an MCP fixture should absorb/satisfy
  it, not duplicate it); **agent-initiated outbound egress has no owner** —
  ingestion-security owns ingress-side fetch of untrusted content, nobody
  owns outbound sinks.
- **Unclaimed, no code**: the grant object and revocation, host/process
  isolation, resource ceilings, cumulative run budgets, delegation-chain
  authority, the tamper-evident execution ledger, and the
  action-authorization + release verdicts.

### 8. Constraints surfaced (feed align/shape)

1. Grants in the Effect layer cannot self-enforce — a kernel/VM boundary and
   an egress proxy are mandatory components, per the unanimous layering
   consensus (§1).
2. Host resource ceilings do not come from any laptop-tier prior art; they
   are additive work (cgroups/rlimits) or a reason to escalate workloads to a
   microVM/cluster tier (§1).
3. Hostname allowlists are a floor. The egress design needs: TLS-terminating
   proxy (per-destination opt-in), validated-IP dialing (anti-rebinding),
   sink classification by audience (Supabase lesson), implicit-sink coverage
   (EchoLeak lesson), and an explicit decision on DNS mediation (§2, §4).
4. Offline-verifiable grants revoke eventually-consistently; the design pairs
   short expiry + attenuation with an online sink-time policy check pinned to
   a named policy revision (§3).
5. MCP forbids token passthrough: per-hop, re-audienced, delegation-style
   (never impersonation) credentials are a protocol requirement, not a taste
   choice (§3, §4).
6. The tamper-evident class may contain only hashes, opaque identifiers, and
   typed outcomes; payloads live in a crypto-shred class whose key
   destruction is loggable erasure; legal hold freezes both retention expiry
   and key destruction — and the repo has **no KMS/retention seam today**,
   which materially scopes the records workstream (§5, §6).
7. Policy must be immutable from inside the boundary: the sandbox denies
   writes to its own policy/settings surface, and repo-controlled files never
   configure the proxy/CA path (§1, §2).
8. macOS Seatbelt is deprecated-but-load-bearing; treat the macOS tier as
   defense-in-depth with a container fallback and per-OS-release monitoring
   (§1).
9. Purpose-aware flow control (labels flowing read → sink) has industrial
   precedent (Meta Policy Zones) but nothing portable; it is the most novel,
   highest-cost requirement and a candidate rabbit hole for shaping (§3).

### 9. What the research says about master align Q10 (not deciding it)

- **Privileged read + outbound sink**: now the empirically best-attested
  failure class (GitHub MCP, Supabase, EchoLeak), and outbound egress is the
  one seam *nobody* in the repo owns. Smallest credible fixture: generalize
  TierGate's grant check and slot destination policy into the api-transport
  seam. Weakness: without host isolation it proves policy, not boundary.
- **Browser-to-terminal**: strongest offensive evidence in the mined corpus
  (one-day exploitation), and the ACP driver already exposes the permission
  and terminal seams — but it requires the largest host-isolation build
  first.
- **Model-generated code**: richest portable prior art (srt, Codex CLI SBPL/
  bwrap corpus), but capture's own warning stands — starting here risks
  narrowing "sandbox" to a code runner and missing cross-tool authority.
- **Citation-derived legal action**: most product-specific consequence, but
  the approval-verdict vocabulary it depends on exists only in prose
  (`['pending']`/`['candidate']` literals), and it entangles sandbox
  mechanics with attorney-authority policy design.
- Whichever fixture is chosen, the `mcp-write-wall` collision (§7) must be
  resolved in the same decision.

### 10. Research debt (registered, non-blocking)

From the critic ([10](./research/10-research-critique.md)), two medium gaps
stand open with rationale rather than answers: (a) a cluster of sources was
cited from search results without full fetch or license verification —
enumerated in the critique; the affected dispositions are marked
reference-only in [`research/SOURCES.md`](./research/SOURCES.md) and must be
re-verified before any dependency or normative-citation decision; (b) trusted
timestamping / legally recognized anchoring (RFC 3161 TSAs, eIDAS qualified
timestamps, FRE 902(13)–(14) self-authentication, OpenTimestamps) was not
researched — for a ledger whose consumers include courts, whether checkpoints
anchor to witnesses, a TSA, or both is an open records-design question for a
targeted follow-up during shape.
