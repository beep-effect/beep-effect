# External landscape — authorization & capability models

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (ext-authz sweep agent; structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
## findings

### [0] Object-capability discipline
Miller/Yee/Shapiro's 'Capability Myths Demolished' (2003) shows that in an object-capability system designation and authority are combined (messages travel only along held capabilities; Alice can grant Bob access to Carol only if Alice holds both), unlike Unix-style ambient authority where open() succeeds without explicitly presenting a credential; the paper demolishes the equivalence, confinement, and irrevocability myths and argues pure capability systems have strictly stronger security properties than ACL systems.

*relevance:* This is the theoretical foundation for the packet's core requirement: no ambient filesystem/process/credential/network authority. The sandbox should pass narrow capability values into generated-code execution rather than letting code reach a globally-authorized API surface; the 'irrevocability myth' section also rebuts the common objection that capability grants cannot be revoked.

*urls:* http://zesty.ca/capmyths/new.html | https://classpages.cselabs.umn.edu/Fall-2021/csci5271/papers/SRL2003-02.pdf | https://blog.acolyer.org/2016/02/16/capability-myths-demolished/

### [1] Macaroons: caveat-based attenuation
Macaroons (Birgisson et al., Google, NDSS 2014) are bearer credentials built from nested chained HMACs whose embedded caveats 'attenuate and contextually confine when, where, by who, and for what purpose a target service should authorize requests'; holders can only add caveats (weaken), never strengthen, and third-party caveats require a discharge macaroon from an external authority before the token verifies.

*relevance:* Direct prior art for grants narrowed by principal, purpose, resource, operation, and expiry via monotonic attenuation; third-party caveats are a cryptographic mechanism for the packet's escalation outcome (an external approver must mint a discharge before the grant is usable).

*urls:* https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/ | https://theory.stanford.edu/~ataly/Papers/macaroons.pdf | https://www.ndss-symposium.org/ndss2014/ndss-2014-programme/macaroons-cookies-contextual-caveats-decentralized-authorization-cloud/

### [2] Macaroons in production (revocation and typing lessons)
Fly.io's production macaroon system revokes via a unique nonce per token plus a revocation list with wholesale cache invalidation ('Revocation is rare, so just keeping a revocation list and invalidating caches wholesale seems fine'), splits cryptographic verification (centralized) from caveat clearing (domain-specific, distributed), and was built from scratch because community implementations 'decided to use untyped opaque blobs' for caveats.

*relevance:* Field evidence that (a) a simple revocation-list + short-lived-token design is adequate when revocation is rare, (b) caveat languages should be strongly typed — which favors a schema-first Effect/TypeScript caveat model over adopting an untyped macaroon library, and (c) token verification should be a centralized service, matching the packet's 'authorization decided outside the model' requirement.

*urls:* https://fly.io/blog/macaroons-escalated-quickly/

### [3] Biscuit tokens
Eclipse Biscuit is an Apache-2.0 'delegated, decentralized, capabilities-based authorization token' supporting offline attenuation by appending blocks of Datalog checks, public-key verification without contacting the issuer, per-block revocation identifiers that authorizers can reject against a revocation list, and third-party blocks that delegate part of the decision to external parties; production users include Apache Pulsar at Clever Cloud, and @biscuit-auth/biscuit-wasm (Apache-2.0, v0.6.0) wraps the Rust implementation for Node/browser with TypeScript type definitions.

*relevance:* Closest off-the-shelf match for the packet's grant token: offline-attenuable, expiry/resource/operation expressible as Datalog checks, revocation-identifier story already designed, permissive license, and a TS-usable WASM binding — the embedding cost is the WASM boundary plus teaching the team Datalog instead of reusing effect/Schema for the caveat language.

*urls:* https://github.com/eclipse-biscuit/biscuit | https://github.com/eclipse-biscuit/biscuit-wasm

### [4] UCAN delegation semantics
UCAN 1.0.0 (Community Specification License) expresses authority as cryptographically signed delegation chains rooted in a subject DID where each delegation 'must either directly restate or attenuate (diminish) its capabilities'; capabilities bind subject DID + command verb + policy constraints with nbf/exp timestamps, and the spec strictly separates idempotent delegations from invocations, which require proof chains and replay prevention via unique CID tracking.

*relevance:* The delegation/invocation split is a clean model for the packet: agents hold delegations (inert authority) but every actual execution is an invocation checked outside the model; the chain names the full principal lineage (user → orchestrator → subagent), which the packet's immutable execution records need.

*urls:* https://github.com/ucan-wg/spec

### [5] UCAN revocation (the hard part)
The UCAN revocation sub-spec (v1.0.0-rc.1) lets any issuer in a proof chain revoke delegations they issued (revocations are themselves 'ucan/revoke' invocations naming the target CID, immutable and irreversible, invalidating all downstream derivatives), but explicitly operates in 'fully eventually consistent contexts' and calls revocation 'the last line of defense against abuse', with resource controllers required to maintain revocation caches.

*relevance:* Confirms revocation is the structural weakness of offline-verifiable capability tokens: eventual consistency is unacceptable for secret-egress decisions, so the sandbox design should pair short expiries and attenuation (offline) with an online policy-decision check at sink time rather than relying on revocation propagation.

*urls:* https://github.com/ucan-wg/revocation

### [6] UCAN TypeScript embedding
ucanto (storacha/ucanto, dual Apache-2.0/MIT) is a TypeScript UCAN-RPC framework providing 'a declarative system for defining capabilities', UCAN validation, capability-handler routing, pluggable transports, and a type-safe batched client across @ucanto/{client,server,core,validator,principal} packages.

*relevance:* Proves a capability-invocation runtime can be built idiomatically in TypeScript with typed capability definitions — the closest existing analogue to an Effect-native grant/invocation layer, and permissively licensed for porting patterns (its declarative capability schema maps naturally onto effect/Schema).

*urls:* https://github.com/storacha/ucanto

### [7] Cedar policy engine
Cedar (Apache-2.0, Rust) evaluates permit/forbid policies over principal/action/resource with when/unless conditions under default-deny semantics ('access is only granted when explicitly permitted'), validates policies against an application schema, is 'designed for analysis using Automated Reasoning' with bounded-latency evaluation, and ships WebAssembly bindings (cedar-wasm) for JavaScript/TypeScript plus a symbolic compiler for policy verification.

*relevance:* Cedar's default-deny, forbid-overrides-permit, schema-validated model is the strongest drop-in candidate for the packet's PDP: grants become Cedar entities/context (principal, purpose, resource, operation, sink, expiry as attributes), evaluation stays outside the model, and TS embedding via WASM is proven; cost is a second schema language alongside effect/Schema.

*urls:* https://github.com/cedar-policy/cedar

### [8] Cedar formal assurance
cedar-spec (Apache-2.0) maintains a Lean formalization of Cedar with machine-checked proofs and a differential randomized testing framework that continuously compares the formal model against the production Rust implementation.

*relevance:* Precedent that the authorization core of an agent sandbox can be small enough to formally verify; if the packet builds its own Effect-native evaluator, differential testing against a declarative model is the assurance pattern to copy for properties like 'deny always wins' and 'no grant without expiry'.

*urls:* https://github.com/cedar-policy/cedar-spec

### [9] OPA/Rego as PDP
OPA (CNCF-graduated, Apache-2.0) 'decouples policy decision-making from policy enforcement', runs as embedded library, sidecar, or HTTP server, compiles Rego to WebAssembly, distributes versioned policy bundles, and returns arbitrary structured decisions — 'not just binary allow/deny' but violation messages, metadata, and nested data.

*relevance:* Structured (non-boolean) decisions are exactly what the packet's visible typed outcomes require — a decision can carry {denied, reason, escalationPath, budgetRemaining} rather than false; Rego-to-WASM also demonstrates running the PDP in-process in a TS runtime without a network hop.

*urls:* https://www.openpolicyagent.org/docs

### [10] Decision logging and policy-revision audit
OPA decision logs record per-decision a unique decision ID, the full input, the result, and the bundle revision that produced the decision, and support a masking policy (data.system.log.mask) that erases or redacts fields by JSON Pointer before upload, with erased/masked paths tracked in the event record itself.

*relevance:* Direct prior art for two packet requirements at once: immutable execution records that name the policy revision each decision was made under, and secret-minimizing storage classes (structured masking with an auditable record of what was masked, rather than logging raw input).

*urls:* https://www.openpolicyagent.org/docs/latest/management-decision-logs/

### [11] Zanzibar and consistency of authorization state
Google's Zanzibar (USENIX ATC '19) models authorization as relationship tuples evaluated with external consistency via zookie consistency tokens so 'authorization decisions respect causal ordering of user actions' (preventing the 'new enemy' problem), at trillions of ACLs, millions of authz requests/second, <10ms p95, 99.999% availability.

*relevance:* The new-enemy problem is the packet's stale-grant disclosure risk in disguise: a revoked privilege observed late plus an allowed sink equals wrongful disclosure; zookies are the canonical mechanism for pinning an agent run to a named policy/ACL snapshot — matching the packet requirement that grants name a policy revision.

*urls:* https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/

### [12] OpenFGA (Zanzibar-style, embeddable)
OpenFGA (Apache-2.0) is a Zanzibar-inspired authorization engine with a modeling DSL, relationship tuples, a Check API over HTTP/gRPC, official JS/TypeScript SDK (@openfga/sdk), embeddability as a Go library, and Postgres/MySQL/SQLite/in-memory backends; production users include Auth0, Grafana Labs, and Docker.

*relevance:* Candidate for the relationship layer of the sandbox (which principal relates to which matter/document/tool in a legal-tech domain), with low TS embedding cost via official SDK; however it is a separate service+datastore to operate, and purpose/budget dimensions would have to be layered on top since tuples express who-relates-to-what, not why or how-much.

*urls:* https://github.com/openfga/openfga

### [13] SpiceDB caveats and ZedTokens
SpiceDB (Apache-2.0) combines ReBAC with 'caveats' — contextual conditions on relationships that add ABAC-style constraints — and implements Zanzibar's consistency model via ZedTokens to prevent the new-enemy problem at '5ms p95 when scaled to millions of queries/s, billions of relationships'; the official Node client @authzed/authzed-node is Apache-2.0 with TypeScript support.

*relevance:* Caveated relationships are a shipping mechanism for attaching expiry/purpose/context conditions to a relationship grant, and ZedTokens give the strongest available consistency story among open-source ReBAC engines — relevant if the packet chooses relationship-based grants over token-based ones.

*urls:* https://github.com/authzed/spicedb | https://github.com/authzed/authzed-node

### [14] SPIFFE/SPIRE workload identity
SPIFFE issues workloads cryptographic identities (X.509 or JWT SVIDs under a trust-domain-scoped SPIFFE ID) via a Workload API using node and workload attestation instead of pre-shared secrets, with automatic rotation and cross-domain federation; SPIRE, the reference implementation, is a CNCF-graduated project under Apache-2.0.

*relevance:* Solves 'name the principal' for non-human executors: each sandboxed run can hold an attested, short-lived identity instead of ambient credentials, removing credential authority from the sandbox entirely and giving the execution record a cryptographically verifiable principal; likely overkill to deploy initially but the attestation-not-secrets pattern is the one to copy.

*urls:* https://spiffe.io/docs/latest/spiffe-about/overview/ | https://github.com/spiffe/spire

### [15] XACML PDP/PEP lineage and obligations
OASIS XACML 3.0 (standard since January 2013) defines the PEP/PDP/PIP/PAP separation with four decision values (Permit, Deny, Indeterminate, NotApplicable) and obligations semantics requiring that conforming PEPs 'deny access unless they understand and can discharge all of the <Obligations> elements', while advice may be safely ignored.

*relevance:* Two decades of lineage for the packet's 'authorization decided outside the model' requirement, plus two directly reusable ideas: a decision vocabulary richer than allow/deny (precedent for typed outcomes like Indeterminate → validator failure) and obligations — post-decision duties such as redact-before-egress that the enforcement point must fail-closed on if it cannot discharge.

*urls:* http://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html | https://www.styra.com/blog/opa-vs-xacml-which-is-better-for-authorization/

### [16] Purpose-based access control (grants that name WHY)
Byun/Bertino/Li's Purpose-Based Access Control (2005 onward) attaches intended-purpose metadata to data and authorizes users for specific access purposes organized in purpose hierarchies, and a 2023 paper ('Towards a Purpose-Based Access Control Model Derived from the Purpose Limitation Principle') formalizes purpose as actions/sequences of actions with a purpose-matching algorithm derived from GDPR's purpose limitation principle.

*relevance:* The academic lineage for the packet's purpose-binding requirement: purposes as a hierarchy with a matching algorithm (requested purpose must be subsumed by granted purpose) is a concrete, implementable design for the 'purpose' field of a grant, and ties the sandbox design to GDPR purpose-limitation compliance language attorneys will recognize.

*urls:* https://journals.sagepub.com/doi/10.3233/FAIA230958 | https://ebooks.iospress.nl/volumearticle/65580 | https://www.researchgate.net/publication/221366969_Purpose_based_access_control_of_complex_data_for_privacy_protection

### [17] Purpose limitation via information flow control at scale
Meta's Privacy Aware Infrastructure enforces purpose limitation with Policy Zones, an information-flow-control system that propagates purpose annotations through data flows with runtime enforcement and SQL parsing across exabyte-scale warehouses and petabytes/hour stream systems, on the argument that IFC 'controls not only data access but also how data is processed and transferred', unlike point-in-time access checks.

*relevance:* The strongest industrial evidence for the packet's composition insight that 'a privileged read plus an allowed outbound sink composes into disclosure authority': access-time checks are insufficient — purpose labels must flow with data from read to sink, which is exactly the taint/label propagation the egress policy layer needs.

*urls:* https://engineering.fb.com/2024/08/27/security/privacy-aware-infrastructure-purpose-limitation-meta/ | https://engineering.fb.com/2025/07/23/security/policy-zones-meta-purpose-limitation-batch-processing-systems/

### [18] Budget/amount as a first-class grant dimension (standards)
OAuth 2.0 Rich Authorization Requests (RFC 9396) standardizes an authorization_details array of typed JSON objects with common fields (type, actions, locations, datatypes, identifier, privileges) whose canonical example is payment_initiation with an instructedAmount {currency, amount} and named creditor — an amount- and counterparty-bound grant that plain scopes cannot express.

*relevance:* A standards-track shape for encoding the packet's budget ceilings directly in the grant payload: 'type' maps to purpose category, 'locations' to sinks, 'actions' to operations, and instructedAmount proves regulators and banks already accept spend as an authorization dimension, not just a runtime counter.

*urls:* https://www.rfc-editor.org/rfc/rfc9396.html

### [19] Budget-scoped agent credentials in industry
Payment networks now ship budget-bound agent authority: Mastercard Agent Pay lets organizations set 'authorization rules and spending limits that are programmatically enforced', and agent-issued virtual cards (Stripe Issuing for Agents, Ramp on Visa Intelligent Commerce) are scoped to single transactions with merchant allowlists, spend limits, and automatic expiry, blocking anything else at the network level.

*relevance:* Convergent industry design (2025-2026) validating the packet's grant shape — principal (card holder/agent), purpose (merchant/category), resource ceiling (spend limit), sink (merchant allowlist), and expiry composed into one credential enforced outside the agent — the same composite the sandbox should apply to tokens, tool calls, and egress.

*urls:* https://www.mastercard.com/us/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html | https://ramp.com/blog/virtual-cards-for-ai-agents


## sources

- **Capability Myths Demolished (Miller, Yee, Shapiro, 2003)** (paper, n/a, n/a) http://zesty.ca/capmyths/new.html
  - Foundational ocap paper; PDF mirror at https://classpages.cselabs.umn.edu/Fall-2021/csci5271/papers/SRL2003-02.pdf. Defines ambient authority and rebuts the irrevocability myth.

- **Macaroons: Cookies with Contextual Caveats (NDSS 2014)** (paper, n/a, n/a) https://theory.stanford.edu/~ataly/Papers/macaroons.pdf
  - HMAC-chained attenuation-only caveats confining when/where/who/purpose; third-party caveats + discharges. Google Research page: https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/

- **Fly.io: Macaroons Escalated Quickly** (post, n/a, n/a) https://fly.io/blog/macaroons-escalated-quickly/
  - Production report: nonce+revocation-list revocation, centralized verification, typed caveats built in-house because public implementations use untyped opaque blobs. Their Go/Elixir code not evaluated as a dependency.

- **Eclipse Biscuit (spec + Rust implementation)** (spec, Apache-2.0, permissive-port) https://github.com/eclipse-biscuit/biscuit
  - Offline attenuation via Datalog blocks, per-block revocation identifiers, third-party blocks. Spec 'done' for credentials language/crypto/serialization; v3.x implementations in Rust/WASM/Python/Haskell. Main site biscuitsec.org returned 403 to WebFetch; verified via GitHub.

- **biscuit-wasm (@biscuit-auth/biscuit-wasm)** (repo, Apache-2.0, permissive-port) https://github.com/eclipse-biscuit/biscuit-wasm
  - Node/browser WASM wrapper with ESM/CJS + TypeScript definitions; latest shown v0.6.0 — verify release recency before adopting.

- **UCAN 1.0 specification** (spec, n/a, n/a) https://github.com/ucan-wg/spec
  - Community Specification License v1.0. Delegation chains rooted in subject DID, attenuation-only, nbf/exp, invocation vs delegation split, CID-based replay prevention.

- **UCAN Revocation sub-spec** (spec, n/a, n/a) https://github.com/ucan-wg/revocation
  - v1.0.0-rc.1 (not final). Issuer-in-chain revocation as ucan/revoke invocations; explicitly eventually consistent; 'last line of defense'.

- **ucanto (UCAN RPC framework, TypeScript)** (repo, Apache-2.0 OR MIT, permissive-port) https://github.com/storacha/ucanto
  - Declarative typed capability definitions, validator, server routing, pluggable transports. Small community (62 stars) — treat as pattern source more than hardened dependency.

- **Cedar policy language** (repo, Apache-2.0, permissive-port) https://github.com/cedar-policy/cedar
  - Default-deny permit/forbid over principal/action/resource + when/unless; schema validation; automated-reasoning-friendly; cedar-wasm bindings for JS/TS; CLI, language server, symbolic compiler. Docs at docs.cedarpolicy.com (direct page fetch 404'd; npm page for @cedar-policy/cedar-wasm 403'd — WASM binding verified via repo README).

- **cedar-spec (Lean formalization + DRT)** (repo, Apache-2.0, permissive-port) https://github.com/cedar-policy/cedar-spec
  - Machine-checked Lean model with differential randomized testing against the Rust implementation — assurance pattern to copy for a custom evaluator.

- **Open Policy Agent docs** (docs, Apache-2.0, permissive-port) https://www.openpolicyagent.org/docs
  - CNCF-graduated PDP; embedded/sidecar/server modes; Rego→WASM; structured non-boolean decisions; bundle-based policy distribution. Decision logs (decision id, input, result, bundle revision, masking): https://www.openpolicyagent.org/docs/latest/management-decision-logs/

- **Zanzibar: Google's Consistent, Global Authorization System (USENIX ATC '19)** (paper, n/a, n/a) https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/
  - Relationship tuples, zookies/external consistency (new-enemy problem), trillions of ACLs, <10ms p95.

- **OpenFGA** (repo, Apache-2.0, permissive-port) https://github.com/openfga/openfga
  - Zanzibar-inspired; HTTP/gRPC Check API; @openfga/sdk for JS/TS; embeddable as Go library; Postgres/MySQL/SQLite backends; used by Auth0/Grafana/Docker.

- **SpiceDB** (repo, Apache-2.0, permissive-port) https://github.com/authzed/spicedb
  - ReBAC + caveats (contextual ABAC-style conditions); ZedTokens consistency; Postgres/MySQL/CockroachDB/Spanner datastores. Node client @authzed/authzed-node is Apache-2.0: https://github.com/authzed/authzed-node

- **SPIFFE overview / SPIRE** (spec, Apache-2.0, permissive-port) https://spiffe.io/docs/latest/spiffe-about/overview/
  - Attestation-based workload identity (X.509/JWT SVIDs, Workload API, trust domains, federation); SPIRE repo (Apache-2.0, CNCF graduated): https://github.com/spiffe/spire

- **OASIS XACML 3.0 Core Specification** (spec, n/a, n/a) http://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html
  - OASIS Standard 2013-01-22. PEP/PDP/PIP/PAP data-flow model; Permit/Deny/Indeterminate/NotApplicable; fail-closed obligations vs ignorable advice. Modern comparison: https://www.styra.com/blog/opa-vs-xacml-which-is-better-for-authorization/

- **Towards a Purpose-Based Access Control Model Derived from the Purpose Limitation Principle (2023)** (paper, n/a, n/a) https://journals.sagepub.com/doi/10.3233/FAIA230958
  - Purpose formalized as actions/sequences with a purpose-matching algorithm; GDPR-derived. Also at https://ebooks.iospress.nl/volumearticle/65580. Byun/Bertino/Li PBAC lineage (purpose hierarchies, intended vs access purpose): https://www.researchgate.net/publication/221366969_Purpose_based_access_control_of_complex_data_for_privacy_protection — abstracts seen in search results; full PDFs not retrieved.

- **Meta: Purpose limitation via Privacy Aware Infrastructure / Policy Zones** (post, n/a, n/a) https://engineering.fb.com/2024/08/27/security/privacy-aware-infrastructure-purpose-limitation-meta/
  - IFC-based purpose-annotation propagation with runtime enforcement at exabyte scale; batch-processing follow-up (2025-07-23): https://engineering.fb.com/2025/07/23/security/policy-zones-meta-purpose-limitation-batch-processing-systems/

- **RFC 9396: OAuth 2.0 Rich Authorization Requests** (spec, n/a, n/a) https://www.rfc-editor.org/rfc/rfc9396.html
  - authorization_details typed objects (type/actions/locations/datatypes/privileges); payment_initiation instructedAmount example = standardized amount-bound grant.

- **Mastercard Agent Pay for Machines (press, June 2026)** (post, n/a, n/a) https://www.mastercard.com/us/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html
  - Programmatically enforced authorization rules and spending limits for agent payments. Complementary virtual-card scoping (merchant allowlist, single-transaction, auto-expiry): https://ramp.com/blog/virtual-cards-for-ai-agents — vendor content, treat scale claims accordingly.
