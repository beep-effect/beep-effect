# Follow-up — delegation-chain & agent-identity standards (RFC 8693, GNAP, WIMSE, ID-JAG)

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (follow-up agent 3 (critic-dispatched); structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
# followup-3

## findings

### [0] RFC 8693 — delegation vs impersonation semantics
RFC 8693 OAuth 2.0 Token Exchange formally distinguishes impersonation (principal A becomes indistinguishable from B: 'they are actually dealing with B') from delegation (A 'still has its own identity separate from B... any actions taken are being taken by A representing B'), with delegation expressed via composite tokens whose sub claim comes from the subject_token and whose act claim comes from the actor_token.

*relevance:* A default-deny agent sandbox should mint delegation-style credentials, never impersonation-style: every action must remain attributable to the agent (actor), not silently to the user, so audit and revocation can target the agent principal specifically.

*urls:* https://www.rfc-editor.org/rfc/rfc8693.html

### [1] RFC 8693 — act/may_act claims and chain encoding
On-behalf-of chains are encoded as nested act claims (outermost act = current actor, nested act = prior actors), with the normative rule that consumers MUST only authorize against the current actor — prior actors are informational only; the may_act claim separately pre-authorizes a party to become an actor in a future exchange.

*relevance:* This is the JWT-world analogue of a macaroon/Biscuit attenuation chain: the sandbox can encode user→orchestrator→subagent hops as nested act claims for audit, while may_act gives a standard hook for default-deny actor substitution — a subagent cannot be spliced into the chain unless pre-authorized.

*urls:* https://www.rfc-editor.org/rfc/rfc8693.html

### [2] GNAP (RFC 9635) — what it adds over OAuth
GNAP is Standards Track (Oct 2024), deliberately not OAuth-compatible, and replaces scope strings with rich JSON access-rights objects (actions/locations/datatypes), adds stateful grant negotiation with continuation tokens (states: processing/pending/approved/finalized), key-bound access tokens requiring cryptographic proof-of-possession, and explicitly separates the end user operating the software from the resource owner who authorizes — supporting asynchronous cross-user approval natively.

*relevance:* GNAP's pending-grant + continuation model is a standards-track template for the sandbox's 'agent requests capability, human approves later' loop without CIBA bolt-ons, and its structured access-rights objects map directly onto tool-level allowlist entries rather than coarse scopes.

*urls:* https://www.rfc-editor.org/rfc/rfc9635.html

### [3] IETF WIMSE WG — current document set (July 2026)
WIMSE has six active WG drafts — architecture (draft-ietf-wimse-arch-08), workload-to-workload HTTP signatures (http-signature-05), workload identifier (identifier-03), mutual TLS (mutual-tls-02), workload credentials (workload-creds-02), and the Workload Proof Token (wpt-01) — plus draft-ietf-wimse-workload-identity-practices-05 in AD Evaluation for Informational publication.

*relevance:* Agents executing inside the sandbox are workloads in WIMSE's sense; per-hop workload identity (WPT proof-of-possession, HTTP signatures) is the complementary layer under user-delegation claims, letting the sandbox authenticate which agent runtime is exercising a delegated capability at each hop.

*urls:* https://datatracker.ietf.org/wg/wimse/documents/

### [4] WIMSE and AI agents — applicability drafts
Individual drafts extend WIMSE to agents: draft-ni-wimse-ai-agent-identity-02 (expires Sept 2026) treats the AI agent as the workload and proposes a Dual-Identity Credential binding agent identity to owner identity — explicitly solving two-party interactions but not multi-hop delegation — and draft-klrc-aiagent-auth proposes agent authn/authz best practices composing WIMSE and the OAuth family; WIMSE interim minutes (June 2026) record consensus that agent identity work is worth pursuing.

*relevance:* Confirms multi-hop agent delegation is an open gap at IETF: a sandbox that composes workload identity (which agent binary) with delegation chains (on whose behalf) is ahead of, not behind, the standards curve, and should keep the two identity planes separable.

*urls:* https://datatracker.ietf.org/doc/draft-ni-wimse-ai-agent-identity/ | https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/ | https://datatracker.ietf.org/meeting/interim-2026-wimse-01/materials/minutes-interim-2026-wimse-01-202606031500-00

### [5] OAuth Transaction Tokens — intra-domain call-chain context
draft-ietf-oauth-transaction-tokens-09 (July 2026, WG Last Call, Standards Track intent) defines short-lived signed JWTs that propagate user identity, workload identity, and immutable authorization context through a call chain within one trust domain, with replacement Txn-Tokens constrained so the token service must prevent scope expansion — replacements can only narrow permissions.

*relevance:* The narrow-only replacement rule is monotonic attenuation — the same invariant as macaroon caveats and Biscuit blocks — arriving as an IETF standard; the sandbox's internal hop-to-hop credential could adopt Txn-Token semantics for interoperability instead of a bespoke format.

*urls:* https://datatracker.ietf.org/doc/draft-ietf-oauth-transaction-tokens/

### [6] Identity Chaining Across Trust Domains
draft-ietf-oauth-identity-chaining-17 (July 2026, submitted to IESG) composes RFC 8693 token exchange (domain A's AS issues a JWT authorization grant audienced at domain B) with RFC 7523 JWT bearer assertion (redeemed at domain B's AS), preserving identity and authorization context across administrative trust boundaries in a service chain.

*relevance:* This is the standards-blessed pattern for the sandbox to cross trust boundaries (e.g., agent inside the sandbox reaching an external SaaS AS) without token passthrough: exchange at the home AS, redeem at the foreign AS, each domain applying its own default-deny policy.

*urls:* https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-chaining/

### [7] ID-JAG / Cross App Access — the enterprise agent-delegation profile
draft-ietf-oauth-identity-assertion-authz-grant-04 (May 2026; Parecki/Okta, McGuinness, Campbell/Ping; OAuth WG document) profiles identity chaining so an enterprise IdP brokers app-to-app access: client exchanges its IdP identity assertion via RFC 8693 for an ID-JAG audienced at the downstream resource app's AS, then redeems it via RFC 7523; Appendix A.4 explicitly covers 'AI Agent using External Tools'.

*relevance:* For enterprise deployment, the sandbox's outbound connections should be IdP-governed rather than per-user consent screens: ID-JAG centralizes which agent/client may reach which resource app — a policy-decision point that matches the default-deny posture and gives admins revocation.

*urls:* https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/

### [8] Okta productization of XAA
Okta markets ID-JAG as Cross App Access (XAA), announced an ecosystem of 25+ XAA integrations for governing AI-agent-to-app connections through the IdP (centralized policy, logging, revocability, no consent fatigue), and publishes developer guides for building XAA into MCP apps (OIDC-based Sept 2025; C# MCP July 2026; SAML resource apps July 2026).

*relevance:* Signals which delegation mechanism enterprise IdPs will actually ship: if the sandbox emits/accepts ID-JAG-shaped grants it plugs into the Okta ecosystem rather than requiring a parallel trust root.

*urls:* https://www.okta.com/newsroom/press-releases/okta-announces-cross-app-access-partners/ | https://developer.okta.com/blog/2025/09/03/cross-app-access | https://developer.okta.com/blog/2026/07/16/csharp-mcp-cross-app-access

### [9] Auth0 for AI Agents — Token Vault
Auth0's Token Vault lets agents fetch third-party provider access tokens (Google, Microsoft, Box, Slack, GitHub, generic OIDC, custom) at runtime through one Auth0 integration, with Auth0 holding refresh tokens and performing the token exchange so agent code never manages provider credentials; Auth0 for AI Agents reached GA in November 2025.

*relevance:* Token Vault is the productized answer to 'agents hoarding long-lived refresh tokens': the sandbox equivalent is a broker boundary where agents hold only short-lived, audience-bound leases and the vault holds durable secrets — a pattern worth mirroring even self-hosted.

*urls:* https://auth0.com/docs/get-started/auth0-for-ai-agents | https://auth0.com/blog/auth0-token-vault-secure-token-exchange-for-ai-agents/ | https://dev.to/auth0/auth0-for-ai-agents-is-now-generally-available-29el

### [10] Auth0 — asynchronous human-in-the-loop authorization
Auth0 implements human-in-the-loop agent approval with CIBA (Client-Initiated Backchannel Authentication) plus Rich Authorization Requests: an agent's sensitive action pauses while the user approves out-of-band (push/SMS/email) on a trusted device, even when not in the app; Auth0 also pairs FGA (relationship-based fine-grained authorization) with RAG document-level access control.

*relevance:* Directly maps to the sandbox's escalation path: default-deny on privileged capabilities with a CIBA-style blocking approval, and RAR-style structured payloads describing exactly what the agent wants approved rather than an opaque scope.

*urls:* https://auth0.com/docs/get-started/auth0-for-ai-agents | https://auth0.com/blog/introducing-auth0-for-ai-agents/

### [11] WorkOS — agent auth and auth.md registration protocol
WorkOS AuthKit operates as an OAuth 2.1 authorization server for MCP servers (working with official MCP SDKs) with FGA for tool-level permission scoping, and in mid-2026 WorkOS launched auth.md, an open protocol where a service exposes a machine-readable file at its root so AI agents can discover OAuth Protected Resource Metadata, parse required scopes, and self-register for scoped, auditable credentials.

*relevance:* auth.md is an emerging convention for agent onboarding/discovery the sandbox's outbound HTTP layer could consume; FGA-per-tool confirms the industry is converging on tool-granularity (not service-granularity) permissions, matching a default-deny tool allowlist design.

*urls:* https://workos.com/mcp | https://www.marktechpost.com/2026/05/25/workos-releases-auth-md-an-open-agent-registration-protocol-built-on-oauth-standards/ | https://workos.com/blog/oauth-on-behalf-of-ai-agents

### [12] IETF individual draft — On-Behalf-Of User Authorization for AI Agents
draft-oauth-ai-agents-on-behalf-of-user-02 (WSO2 authors, Aug 2025) added a requested_actor authorization parameter (agent named on the consent screen) and an actor_token at code redemption so issued tokens document the user→client→agent delegation chain, initiable from a resource-server challenge — but it is an expired individual submission never adopted by the OAuth WG.

*relevance:* Evidence that 'name the agent in the consent ceremony' has no adopted standard yet; the sandbox cannot rely on upstream OAuth consent to distinguish agents and must carry agent identity in its own credential layer (act claims, ID-JAG subject, or capability attenuation).

*urls:* https://datatracker.ietf.org/doc/draft-oauth-ai-agents-on-behalf-of-user/

### [13] OpenID Foundation — agentic AI identity workstream
The OIDF Artificial Intelligence Identity Management Community Group published the whitepaper 'Identity Management for Agentic AI' in October 2025 (also on arXiv as 2510.25819), assessing the authn/authz landscape for agents and setting a strategic agenda, and its Threat Modeling Subgroup answered NIST's RFI on securing AI agent systems in March 2026.

*relevance:* The canonical neutral survey to cross-check the sandbox's threat model against — it enumerates the same gaps (delegation chains, agent-distinct consent, revocation) this design must close, and signals where OIDF standardization will land next.

*urls:* https://openid.net/cg/artificial-intelligence-identity-management-community-group/ | https://arxiv.org/abs/2510.25819 | https://openid.net/new-whitepaper-tackles-ai-agent-identity-challenges/

### [14] MCP 2025-11-25 — OAuth 2.1 resource-server model
The 2025-11-25 MCP authorization revision makes the MCP server an OAuth 2.1 resource server that MUST implement RFC 9728 Protected Resource Metadata for AS discovery, requires clients to send the RFC 8707 resource parameter in all authorization and token requests, mandates audience validation ('MCP servers MUST only accept tokens specifically intended for themselves'), and newly promotes Client ID Metadata Documents (HTTPS-URL client_ids) over Dynamic Client Registration, which is retained only for backwards compatibility; it also adds a 403 insufficient_scope step-up authorization flow.

*relevance:* Defines the exact contract the sandbox must satisfy on both sides: as an MCP client it must mint per-resource, audience-bound tokens (default-deny across resources), and the step-up scope-challenge flow is the in-band mechanism for incremental capability grants.

*urls:* https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization

### [15] MCP — token passthrough prohibition and delegation boundary
MCP 2025-11-25 normatively forbids delegation-by-forwarding: 'MCP servers MUST NOT accept or transit any other tokens' and an MCP server calling upstream APIs 'MUST NOT pass through the token it received from the MCP client' — each hop must obtain its own token, explicitly to prevent confused-deputy attacks.

*relevance:* Rules out naive bearer-token chaining inside the sandbox; every hop needs a fresh, re-audienced credential (via token exchange, ID-JAG, or capability attenuation), which is precisely the niche macaroons/Biscuit/8693-act-chains fill.

*urls:* https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization

### [16] MCP ext-auth — Enterprise-Managed Authorization extension
The modelcontextprotocol/ext-auth repo (MIT-licensed) hosts a stable Enterprise-Managed Authorization extension that is expressly 'an application of the Identity Assertion JWT Authorization Grant... itself a profile of Identity Chaining Across Trust Domains': the MCP client exchanges its enterprise IdP ID/refresh token via RFC 8693 for an ID-JAG audienced at the MCP server, then redeems it via RFC 7523 at the MCP server's AS — plus a draft OAuth client-credentials extension for user-less agents.

*relevance:* The bridge tying threads (1), (7), and (5) together in shipping form: if the sandbox fronts MCP servers, supporting this extension gives it IdP-governed, per-server, revocable agent access with zero per-user consent screens — the enterprise default-deny path.

*urls:* https://github.com/modelcontextprotocol/ext-auth | https://raw.githubusercontent.com/modelcontextprotocol/ext-auth/main/specification/stable/enterprise-managed-authorization.mdx


## sources

- **RFC 8693 — OAuth 2.0 Token Exchange** (spec, n/a, n/a) https://www.rfc-editor.org/rfc/rfc8693.html
  - Standards Track. Delegation vs impersonation semantics; subject_token/actor_token; act/may_act claims; nested act encodes on-behalf-of chains with only the current actor authoritative.

- **RFC 9635 — Grant Negotiation and Authorization Protocol (GNAP)** (spec, n/a, n/a) https://www.rfc-editor.org/rfc/rfc9635.html
  - Standards Track, Oct 2024. Rich access-rights objects, stateful grant continuation, key-bound tokens, end-user vs resource-owner separation enabling async cross-user approval.

- **IETF WIMSE WG document list** (docs, n/a, n/a) https://datatracker.ietf.org/wg/wimse/documents/
  - Snapshot July 2026: arch-08, http-signature-05, identifier-03, mutual-tls-02, workload-creds-02, wpt-01 active; workload-identity-practices-05 with IESG.

- **draft-ni-wimse-ai-agent-identity** (spec, n/a, n/a) https://datatracker.ietf.org/doc/draft-ni-wimse-ai-agent-identity/
  - Individual draft, rev -02, expires Sept 2026. WIMSE applicability for AI agents; Dual-Identity Credential binding agent to owner; multi-hop delegation explicitly unsolved.

- **draft-ietf-oauth-transaction-tokens** (spec, n/a, n/a) https://datatracker.ietf.org/doc/draft-ietf-oauth-transaction-tokens/
  - Rev -09, July 2026, WG Last Call. Short-lived intra-domain call-chain JWTs; replacement tokens may only narrow scope (monotonic attenuation).

- **draft-ietf-oauth-identity-chaining** (spec, n/a, n/a) https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-chaining/
  - Rev -17, July 2026, submitted to IESG. RFC 8693 exchange + RFC 7523 redemption to carry identity across trust-domain boundaries.

- **draft-ietf-oauth-identity-assertion-authz-grant (ID-JAG)** (spec, n/a, n/a) https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/
  - Rev -04, May 2026, OAuth WG (Parecki/McGuinness/Campbell). IdP-brokered cross-app access; Appendix A.4 covers AI agents using external tools. Basis of Okta XAA.

- **draft-oauth-ai-agents-on-behalf-of-user** (spec, n/a, n/a) https://datatracker.ietf.org/doc/draft-oauth-ai-agents-on-behalf-of-user/
  - Expired individual submission (WSO2), rev -02 Aug 2025. requested_actor + actor_token to name the agent in consent and document the user→client→agent chain; never WG-adopted.

- **MCP Authorization spec, 2025-11-25 revision** (spec, n/a, n/a) https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
  - OAuth 2.1 RS model; RFC 9728 PRM mandatory; RFC 8707 resource param mandatory; Client ID Metadata Documents preferred over DCR; token passthrough forbidden; 403 step-up scope flow.

- **modelcontextprotocol/ext-auth** (repo, MIT, reference-only) https://github.com/modelcontextprotocol/ext-auth
  - License verified via GitHub API (spdx MIT, LICENSE at repo root). Stable Enterprise-Managed Authorization extension applies ID-JAG (RFC 8693 + RFC 7523); draft oauth-client-credentials extension. Spec text, not an implementation to port.

- **modelcontextprotocol/modelcontextprotocol (spec repo)** (repo, unverified, reference-only) https://github.com/modelcontextprotocol/modelcontextprotocol
  - GitHub API reports license spdx_id NOASSERTION ('Other') for the LICENSE file; treat license as unverified. Canonical MCP spec source.

- **Auth0 for AI Agents docs** (docs, n/a, n/a) https://auth0.com/docs/get-started/auth0-for-ai-agents
  - Token Vault federated token exchange (Google/Microsoft/Box/Slack/GitHub/OIDC/custom); CIBA + RAR async human-in-the-loop approval; FGA for RAG; Cloudflare MCP integration.

- **Auth0 Token Vault blog** (post, n/a, n/a) https://auth0.com/blog/auth0-token-vault-secure-token-exchange-for-ai-agents/
  - Vendor deep-dive: broker holds refresh tokens, agents fetch short-lived provider tokens at runtime. GA status corroborated by Auth0 dev.to post (Nov 2025).

- **Okta press release — Cross App Access ecosystem** (product, n/a, n/a) https://www.okta.com/newsroom/press-releases/okta-announces-cross-app-access-partners/
  - 25+ XAA integrations governing AI-agent-to-app connections via IdP policy, logging, and revocation; XAA is Okta's productization of ID-JAG.

- **Okta Developer — Build Secure Agent-to-App Connections with XAA** (post, n/a, n/a) https://developer.okta.com/blog/2025/09/03/cross-app-access
  - Developer walkthrough of the OIDC-based XAA flow; later companions cover C# MCP (2026-07-16) and SAML resource apps (2026-07-03).

- **WorkOS — Secure auth for MCP servers / auth.md** (product, n/a, n/a) https://workos.com/mcp
  - AuthKit as OAuth 2.1 AS for MCP with FGA tool-level scoping; auth.md (June 2026) is WorkOS's open agent-registration discovery protocol; see also workos.com/blog/oauth-on-behalf-of-ai-agents for their RFC 8693 OBO analysis.

- **OIDF AIIM CG — Identity Management for Agentic AI whitepaper** (paper, n/a, n/a) https://arxiv.org/abs/2510.25819
  - Oct 2025 whitepaper from the OpenID Foundation Artificial Intelligence Identity Management Community Group (CG page: openid.net/cg/artificial-intelligence-identity-management-community-group/); landscape + agenda for agent authn/authz; CG later responded to NIST RFI (Mar 2026).
