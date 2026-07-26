# External landscape — agent / MCP security ecosystem & incidents

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (ext-agentsec sweep agent; structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
## findings

### [0] MCP authorization spec (2025-06-18): OAuth 2.1 resource-server model
The MCP 2025-06-18 authorization spec makes MCP servers OAuth 2.1 resource servers only: clients MUST implement RFC 8707 resource indicators in both authorization and token requests, servers MUST implement RFC 9728 Protected Resource Metadata and MUST validate token audience, PKCE is mandatory for clients, and servers MUST NOT accept or transit tokens issued for other resources (token passthrough is explicitly forbidden). Authorization overall is OPTIONAL for MCP implementations and applies to HTTP transports; STDIO transports are told to use environment credentials instead.

*relevance:* Validates the packet's 'authorization decided outside the model' requirement at protocol level: the authorization server is an external component, tokens are audience-bound to a named resource, and the spec's canonical-URI resource naming is a ready-made vocabulary for the 'resource' field of a grant. The STDIO carve-out means local-process MCP servers get ambient env credentials by default — exactly the ambient authority the sandbox must remove.

*urls:* https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | https://auth0.com/blog/mcp-specs-update-all-about-auth/

### [1] MCP spec current status: 2025-11-25 stable, 2026-07-28 release candidate
As of July 2026 the stable MCP revision is 2025-11-25 (adds OIDC Discovery for authorization-server discovery, incremental/step-up scope consent via WWW-Authenticate, OAuth Client ID Metadata Documents as recommended client registration, experimental async Tasks). A 2026-07-28 revision was locked as RC on May 21, 2026 (final publication scheduled July 28, 2026) with six auth-hardening SEPs: mandatory iss validation per RFC 9207 against mix-up attacks, credential binding to the issuing authorization server, documented refresh-token and scope-accumulation behavior, a stateless protocol (removes initialize handshake and Mcp-Session-Id header), and MCP Apps rendered in sandboxed iframes with pre-declared UI templates.

*relevance:* Any MCP-facing surface of the execution boundary should target 2025-11-25 semantics but design for 2026-07-28: incremental scope consent maps directly to narrow, purpose-scoped, expiring grants; the stateless redesign means execution records, not protocol session state, must carry continuity; pre-declared sandboxed UI templates are precedent for reviewing capability surface before execution.

*urls:* https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ | https://modelcontextprotocol.io/specification/2025-11-25/changelog | https://workos.com/blog/mcp-2025-11-25-spec-update | https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/

### [2] MCP security best practices: confused deputy, token passthrough, session hijacking
The MCP Security Best Practices document (normative companion to the authorization spec) names three central attack classes: confused-deputy attacks on MCP proxy servers with static client IDs (consent-cookie skip lets an attacker's dynamically registered client harvest authorization codes), token passthrough (forwarding client tokens upstream breaks audit, rate limiting, and trust boundaries — servers must reject tokens not issued for them), and session hijacking via predictable or shared session IDs.

*relevance:* The confused-deputy analysis is the protocol-level statement of the packet's composition problem: an intermediary holding privileged credentials plus an attacker-influenced request path becomes disclosure authority. Grant records should therefore name the principal on whose behalf a downstream call is made, and the boundary should never re-use one ambient credential across principals.

*urls:* https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | https://github.com/microsoft/mcp-for-beginners/blob/main/02-Security/mcp-security-best-practices-2025.md

### [3] Tool poisoning, rug pulls, cross-server shadowing (Invariant Labs, April 2025)
Invariant Labs demonstrated (April 2025) three MCP-specific attack classes against Cursor, Claude Desktop, Zapier and others: tool poisoning (malicious instructions hidden in tool descriptions, visible to the LLM but not the user), rug pulls (tool definitions silently mutate after initial user approval), and cross-server shadowing (a malicious server's tool description overrides or intercepts calls intended for a legitimate server's tool). MCPTox (arXiv 2508.14925) later benchmarked tool-poisoning susceptibility on real-world MCP servers.

*relevance:* Grants must pin tool identity to a content hash of the tool definition at approval time (rug-pull defense), treat all tool metadata as untrusted input to the planner, and scope each grant to a named server+tool pair so a co-installed server cannot shadow it — this motivates the packet's 'policy revision' field: a definition change invalidates the grant.

*urls:* https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks | https://invariantlabs.ai/blog/introducing-mcp-scan | https://github.com/invariantlabs-ai/mcp-injection-experiments | https://arxiv.org/pdf/2508.14925

### [4] MCP scanners: mcp-scan is now Snyk Agent Scan (Apache-2.0)
The invariantlabs-ai/mcp-scan repository now ships as Snyk Agent Scan (Apache-2.0, ~2.8k stars, actively maintained): it scans local AI agent components (MCP servers, agent skills) for 15+ risks including prompt injection, tool poisoning/shadowing, toxic data flows, and hardcoded secrets; the original mcp-scan added tool pinning/hashing for rug-pull detection and cross-reference scanning between servers. Its own docs warn that scanning MCP configurations executes the commands defined in them, requiring per-server approval or a --dangerously-run-mcp-servers flag.

*relevance:* A pre-admission scanner is a useful gate before granting any MCP server a principal identity in the sandbox, but the executes-config caveat proves scanners themselves need the default-deny boundary — 'inspect' is already 'execute' for stdio MCP servers, so admission tooling must run inside the sandbox it feeds.

*urls:* https://github.com/invariantlabs-ai/mcp-scan | https://invariantlabs.ai/blog/introducing-mcp-scan

### [5] MCP gateways: Lasso mcp-gateway (MIT)
Lasso Security's mcp-gateway (MIT, ~381 stars) is a proxy layer between the client and multiple MCP servers that manages server lifecycle from a central mcp.json, intercepts requests/responses to mask tokens/API keys/JWTs/cloud credentials, does PII masking via a Presidio plugin, prompt-injection detection via a Lasso plugin, and pre-loading reputation/tool-description scanning.

*relevance:* Precedent for a policy-enforcement-point topology: one chokepoint that owns all MCP server connections and applies sink-side redaction. But its protections are plugin/pattern-based (probabilistic redaction), so for the packet it belongs at the 'secret-minimizing storage class' layer, not as the authorization decision itself.

*urls:* https://github.com/lasso-security/mcp-gateway

### [6] CaMeL: capability-based authorization outside the model (Google DeepMind/ETH)
CaMeL (arXiv 2503.18813, code at google-research/camel-prompt-injection, Apache-2.0, explicitly unmaintained research artifact) defeats prompt injection by design: a Privileged LLM compiles the trusted user query into a program; a Quarantined LLM parses untrusted data with no tool access; a custom Python interpreter tracks provenance capabilities on every value and enforces explicit security policies before each tool call, so untrusted data can never alter control flow. It solves 67-77% of AgentDojo tasks with provable security guarantees.

*relevance:* The strongest academic precedent for the packet's core stance: authorization decided outside the model by a deterministic interpreter, with per-value capabilities making 'privileged read + allowed outbound sink' an explicitly policy-checked disclosure flow. The ~23-33% utility loss is the cost baseline to quote when arguing feasibility.

*urls:* https://arxiv.org/pdf/2503.18813 | https://github.com/google-research/camel-prompt-injection | https://simonwillison.net/2025/Apr/11/camel/ | https://huggingface.co/papers/2503.18813

### [7] Lethal trifecta framing (Simon Willison, June 2025)
Willison's June 16, 2025 'lethal trifecta' post argues any agent combining (a) access to private data, (b) exposure to untrusted content, and (c) ability to communicate externally will leak data via prompt injection; any HTTP-capable tool (API call, image load, even a clickable link) is an exfiltration channel, and probabilistic guardrails that catch 99% of attacks are inadequate because adversaries search for the 1%. The fix is architectural: never compose all three legs in one execution context.

*relevance:* This is the exact justification for the packet's destination- and purpose-aware egress requirement: authority must be computed over the composition of grants (privileged read + outbound sink = disclosure authority), so the policy engine needs cross-grant reasoning, not per-tool allowlists.

*urls:* https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ | https://www.hiddenlayer.com/research/the-lethal-trifecta-and-how-to-defend-against-it

### [8] Six design patterns for prompt-injection-resistant agents (June 2025)
Beurer-Kellner, Debenedetti, Tramèr, Paverd et al. (arXiv 2506.08837, industry+academia including Google, Microsoft, ETH) systematize six patterns with provable resistance: Action-Selector, Plan-Then-Execute (freeze allowable tool calls before reading untrusted data), LLM Map-Reduce (isolate untrusted processing), Dual LLM (privileged planner never sees untrusted tokens; quarantined LLM has no tools), Code-Then-Execute (generate a checkable program first), and Context-Minimization. Security comes from restricting what the agent may do after exposure, not from detecting injections.

*relevance:* Gives the sandbox its grant-lifecycle shape: a grant set can be finalized at plan time and made immutable before any untrusted input enters context, turning later injection into a visible typed denial rather than a policy question; code-then-execute matches the packet's model-generated-code lane with an external validator.

*urls:* https://arxiv.org/abs/2506.08837 | https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/

### [9] Guardrail frameworks are probabilistic detectors, not authorization boundaries
LlamaFirewall (Meta PurpleLlama, paper arXiv 2505.03574) layers PromptGuard 2 (BERT-style injection classifier), AlignmentCheck (chain-of-thought audit for goal hijacking), CodeShield (Semgrep/regex static analysis of generated code, 8 languages), and regex scanners; NeMo Guardrails (Apache-2.0) offers five rail types (input, dialog, retrieval, execution, output) mixing deterministic Colang flows with LLM-based self-checks; Guardrails AI (Apache-2.0) is validator-based post-hoc I/O checking with no mechanism to constrain agent capabilities or tool access. All three detect/filter content; none can bind principals, resources, budgets, or sinks.

*relevance:* Positions guardrails correctly in the architecture: they are advisory validators whose failures should surface as the packet's typed 'validator failure' outcome, layered inside a deterministic default-deny boundary — they cannot substitute for it, per Willison's 99%-is-failing argument.

*urls:* https://arxiv.org/pdf/2505.03574 | https://github.com/meta-llama/PurpleLlama/blob/main/LlamaFirewall/README.md | https://meta-llama.github.io/PurpleLlama/LlamaFirewall/docs/documentation/llamafirewall-architecture/architecture | https://github.com/NVIDIA-NeMo/Guardrails | https://github.com/guardrails-ai/guardrails

### [10] Egress control: Anthropic sandbox-runtime (Apache-2.0)
anthropic-experimental/sandbox-runtime (Apache-2.0, verified LICENSE; the engine behind Claude Code sandboxing, released as open-source preview ~Nov 2025) enforces OS-level filesystem and network restrictions without containers (sandbox-exec on macOS, bubblewrap on Linux) and mediates all egress through HTTP and SOCKS5 proxies enforcing domain allowlists/denylists; it is explicitly designed to sandbox agents, local MCP servers, bash commands, and arbitrary processes.

*relevance:* Direct, permissively licensed precedent for the packet's host-level default-deny lane: proxy-enforced named egress sinks (domain granularity) composable with fs/process ceilings; its domain-only granularity also shows the gap the packet must fill — no purpose-awareness, no per-grant budget, no principal identity on flows.

*urls:* https://github.com/anthropic-experimental/sandbox-runtime | https://github.com/anthropic-experimental/sandbox-runtime/blob/main/LICENSE | https://www.infoq.com/news/2025/11/anthropic-claude-code-sandbox/ | https://code.claude.com/docs/en/sandboxing

### [11] Anthropic computer/browser use: how consequential actions are gated
Anthropic's computer-use stack runs server-side classifiers on prompts/screenshots that flag suspected prompt injections and steer Claude to ask for human confirmation before acting; guidance mandates human confirmation for consequential actions (financial transactions, accepting ToS/cookies), recommends restricting internet access to a domain allowlist, and Anthropic additionally trains injection-refusal via RL on simulated poisoned web content — while stating no browser agent is immune to prompt injection.

*relevance:* Production evidence for the packet's 'escalation' typed outcome: a detector can downgrade an action from auto-approved to human-confirm without being the authorization decision itself; domain allowlists plus confirmation points is the currently deployed, admittedly incomplete, egress story the packet's grant model should subsume.

*urls:* https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool | https://www.anthropic.com/research/prompt-injection-defenses

### [12] OpenAI Operator / ChatGPT agent: confirmations, watch mode, takeover mode
OpenAI's Operator system card (Jan 2025) and ChatGPT agent system card (Jul 2025) document three gate types: confirmations before state-changing actions (Operator confirms in 100% of financial transactions in their eval set), watch mode (on sensitive sites like email/banking the agent pauses unless the user is actively supervising the conversation), and takeover mode (user enters credentials/payment data directly; the agent does not collect or screenshot during takeover). OpenAI describes these mitigations as 'speed bumps' for attackers, not guarantees.

*relevance:* Maps industry consensus gates onto the packet's typed outcomes: confirmation = escalation outcome, watch mode = supervision requirement attachable to a grant's purpose/resource sensitivity class, takeover mode = secret-minimizing storage class where credentials never enter the agent's observation stream.

*urls:* https://openai.com/index/operator-system-card/ | https://cdn.openai.com/operator_system_card.pdf | https://deploymentsafety.openai.com/chatgpt-agent/watch-mode | https://cdn.openai.com/pdf/839e66fc-602c-48bf-81d3-b21eacc3459d/chatgpt_agent_system_card.pdf

### [13] Incident: GitHub MCP toxic agent flow (May 2025)
Invariant Labs showed (May 26, 2025) that a crafted public GitHub Issue could hijack an agent connected to the official GitHub MCP server into reading private repositories and exfiltrating their contents into a public PR/issue; the attack bypassed GitHub's permission model entirely because the agent's token spanned all repos, and researchers noted it is an architectural issue with no server-side code fix — mitigation requires dynamic, context-aware per-session permission narrowing.

*relevance:* Canonical proof that a broad ambient credential plus one attacker-readable write sink equals disclosure: the packet's grants must scope resources per task (single repo, not 'all repos the user can read') and treat writes to shared/visible surfaces as egress sinks subject to the same policy as network egress.

*urls:* https://invariantlabs.ai/blog/mcp-github-vulnerability | https://simonwillison.net/2025/May/26/github-mcp-exploited/ | https://github.com/github/github-mcp-server/issues/844

### [14] Incident: Supabase MCP database leak via support tickets (July 2025)
General Analysis demonstrated (July 2025) that a Supabase MCP setup running with the service_role key (bypassing Row-Level Security) could be prompt-injected through attacker-submitted support tickets into SELECTing the private integration_tokens table and INSERTing the secrets back into the attacker-visible ticket thread — a complete lethal-trifecta exploit where the 'egress channel' is an ordinary allowed database write.

*relevance:* Strongest concrete evidence for the packet's claim that 'a privileged read plus an allowed outbound sink composes into disclosure authority' — the sink was not network egress but a permitted write to a lower-trust-visible resource, so egress policy must classify data destinations by audience, not just by protocol.

*urls:* https://generalanalysis.com/blog/supabase-mcp-blog | https://simonwillison.net/2025/Jul/6/supabase-mcp-lethal-trifecta/

### [15] Incidents: MCP supply chain (postmark-mcp backdoor; mcp-remote CVE-2025-6514)
Two 2025 supply-chain incidents: (1) the npm package postmark-mcp v1.0.16 (Sept 15-25, 2025, found by Koi Security) added one line BCC'ing every outgoing email to an attacker address, with ~1,500 weekly installs across an estimated 300-500 organizations; (2) CVE-2025-6514 (CVSS 9.6, JFrog, fixed in mcp-remote 0.1.16, >437k downloads affected) achieved OS command execution on MCP clients because mcp-remote passed a malicious server's OAuth authorization_endpoint URL into open(), the first real-world RCE from merely connecting to an untrusted remote MCP server.

*relevance:* MCP servers and even OAuth discovery metadata are untrusted principals: the sandbox must run MCP server processes themselves under the default-deny boundary (no ambient network/fs), and every field received from a server — including auth endpoints — is attacker-controlled input to be validated outside the model.

*urls:* https://thehackernews.com/2025/09/first-malicious-mcp-server-found.html | https://www.theregister.com/2025/09/29/postmark_mcp_server_code_hijacked/ | https://jfrog.com/blog/2025-6514-critical-mcp-remote-rce-vulnerability/ | https://github.com/advisories/GHSA-6xpm-ggf7-wc3p

### [16] Incident: EchoLeak zero-click exfiltration (CVE-2025-32711, June 2025)
Aim Security's EchoLeak (CVE-2025-32711, CVSS 9.3, patched server-side by Microsoft June 2025) was a zero-click indirect prompt injection against Microsoft 365 Copilot: a crafted email, once retrieved into RAG context, made Copilot exfiltrate chat logs, OneDrive/SharePoint/Teams content to an attacker server with no user interaction — the egress vector being content rendering/link fetching rather than an explicit tool call.

*relevance:* Shows the egress boundary must cover implicit sinks (markdown image fetches, link unfurling, any renderer-initiated network I/O), not just declared tool calls — the packet's 'sink' concept needs to enumerate renderer and retrieval side-channels as governed egress.

*urls:* https://thehackernews.com/2025/06/zero-click-ai-vulnerability-exposes.html | https://socprime.com/blog/cve-2025-32711-zero-click-ai-vulnerability/

### [17] OWASP agentic security taxonomies (Feb 2025 and Dec 2025)
OWASP's Agentic Security Initiative published 'Agentic AI - Threats and Mitigations' (Feb 2025) — a threat taxonomy spanning agent design, memory (memory poisoning), planning/autonomy, tool use (tool misuse, privilege compromise), and deployment, since referenced by Microsoft's agentic failure-modes work and AWS — and released the 'OWASP Top 10 for Agentic Applications' (Dec 9, 2025, designated the 2026 benchmark) as the successor risk list for autonomous agents.

*relevance:* Ready-made external vocabulary to map the packet's typed outcomes and threat coverage against (memory poisoning maps to the packet's 'no ambient memory authority'; tool misuse/privilege compromise to grant naming); citing conformance to OWASP agentic categories strengthens the design's review story for legal-tech compliance audiences.

*urls:* https://storage.ghost.io/c/44/95/449506ca-034e-480f-9725-fcde08ef1cc1/content/files/2025/04/Agentic-AI---Threats-and-Mitigations.pdf | https://genai.owasp.org/2025/12/09/owasp-genai-security-project-releases-top-10-risks-and-mitigations-for-agentic-ai-security/ | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/


## sources

- **MCP Authorization specification (2025-06-18)** (spec, n/a, n/a) https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
  - Fetched in full. OAuth 2.1 draft-13 basis; RFC 8707/9728/8414/7591; PKCE mandatory; token passthrough forbidden; audience validation mandatory. Authorization is OPTIONAL overall; STDIO uses env credentials.

- **MCP Security Best Practices (2025-06-18)** (spec, n/a, n/a) https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
  - URL confirmed via links inside the fetched authorization spec; covers confused deputy, token passthrough, session hijacking. Content summarized via search results, not fetched in full.

- **MCP 2025-11-25 changelog** (spec, n/a, n/a) https://modelcontextprotocol.io/specification/2025-11-25/changelog
  - Stable revision as of July 2026: OIDC discovery, incremental scope consent, Client ID Metadata Documents, experimental Tasks. Seen in search results; details cross-checked against WorkOS summary.

- **MCP 2026-07-28 Release Candidate announcement** (post, n/a, n/a) https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
  - Fetched. RC locked 2026-05-21, final 2026-07-28; six auth SEPs (RFC 9207 iss validation, credential binding), stateless protocol, sandboxed MCP Apps. Marks 2025-11-25 as becoming obsolete.

- **Invariant Labs: MCP tool poisoning notification** (post, n/a, n/a) https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks
  - April 2025 disclosure of tool poisoning, rug pulls, cross-server shadowing; affected Cursor/Claude Desktop/Zapier setups.

- **Invariant Labs: Introducing MCP-Scan** (post, n/a, n/a) https://invariantlabs.ai/blog/introducing-mcp-scan
  - Describes original mcp-scan capabilities: tool pinning/hashing (rug-pull detection), cross-origin scanning.

- **mcp-scan / Snyk Agent Scan** (repo, Apache-2.0, permissive-port) https://github.com/invariantlabs-ai/mcp-scan
  - Fetched repo page: now branded Snyk Agent Scan (Invariant Labs absorbed by Snyk), Apache-2.0, ~2.8k stars, active. Warning: scanning MCP configs executes their commands.

- **mcp-injection-experiments** (repo, unverified, reference-only) https://github.com/invariantlabs-ai/mcp-injection-experiments
  - PoC code reproducing tool-poisoning attacks; license not verified — treat as reference-only.

- **Lasso Security mcp-gateway** (repo, MIT, permissive-port) https://github.com/lasso-security/mcp-gateway
  - Fetched repo page: MIT, ~381 stars. Proxy hub for MCP servers: token/secret masking, Presidio PII plugin, injection detection plugin, pre-load reputation scanning. Smaller project — assess maintenance before depending on it.

- **CaMeL: Defeating Prompt Injections by Design** (paper, n/a, n/a) https://arxiv.org/pdf/2503.18813
  - Google DeepMind/ETH. Privileged/Quarantined LLM split, per-value capabilities, deterministic interpreter enforcing policy before each tool call; 67-77% AgentDojo tasks with provable security.

- **camel-prompt-injection (reference implementation)** (repo, Apache-2.0, permissive-port) https://github.com/google-research/camel-prompt-injection
  - LICENSE fetched: Apache-2.0. Explicitly an unmaintained research artifact ('likely contains bugs', 'not a Google product') — port ideas and code freely but do not depend on it.

- **The lethal trifecta for AI agents (Willison)** (post, n/a, n/a) https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
  - June 16, 2025. Private data + untrusted content + external comms = leak; 99%-effective guardrails are failing defenses; remove a leg architecturally.

- **Design Patterns for Securing LLM Agents against Prompt Injections** (paper, n/a, n/a) https://arxiv.org/abs/2506.08837
  - Beurer-Kellner, Debenedetti, Tramèr, Paverd et al., June 2025. Six patterns incl. Plan-Then-Execute, Dual LLM, Code-Then-Execute; security via restriction after untrusted exposure, not detection.

- **LlamaFirewall (Meta PurpleLlama)** (repo, unverified, reference-only) https://github.com/meta-llama/PurpleLlama/blob/main/LlamaFirewall/README.md
  - PurpleLlama is mixed-licensed (MIT for benchmarks, Llama Community License for safeguard models); LlamaFirewall component license not visible in README — verify before any code reuse. Paper: arxiv.org/pdf/2505.03574 (n/a). PromptGuard 2 model weights likely Llama-licensed.

- **NeMo Guardrails (NVIDIA)** (repo, Apache-2.0, permissive-port) https://github.com/NVIDIA-NeMo/Guardrails
  - Fetched repo page: Apache-2.0. Five rail types (input/dialog/retrieval/execution/output); mixes deterministic Colang flows with probabilistic LLM self-checks.

- **Guardrails AI** (repo, Apache-2.0, permissive-port) https://github.com/guardrails-ai/guardrails
  - Fetched repo page: Apache-2.0. Validator-hub post-hoc I/O validation + structured output; no capability/tool-access constraint mechanism.

- **Anthropic sandbox-runtime** (repo, Apache-2.0, permissive-port) https://github.com/anthropic-experimental/sandbox-runtime
  - LICENSE fetched directly: Apache-2.0. OS-level fs/network sandboxing (sandbox-exec/bubblewrap) + HTTP and SOCKS5 egress proxies with domain allow/denylists; sandboxes agents, local MCP servers, bash. Research preview status (~Nov 2025) — API may churn.

- **Anthropic computer use tool docs** (docs, n/a, n/a) https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
  - Automatic prompt-injection classifiers on computer-use prompts; human-confirmation guidance for consequential actions; domain-allowlist recommendation.

- **Anthropic: Mitigating prompt injection in browser use** (post, n/a, n/a) https://www.anthropic.com/research/prompt-injection-defenses
  - Layered defense: RL training on simulated injections, screenshot classifiers steering to user confirmation; states no browser agent is immune.

- **OpenAI Operator System Card** (docs, n/a, n/a) https://cdn.openai.com/operator_system_card.pdf
  - Jan 23, 2025. Confirmations before state-changing actions (100% on financial-transaction evals), watch mode, takeover mode (no collection/screenshots during credential entry); mitigations framed as speed bumps.

- **ChatGPT Agent System Card / watch mode** (docs, n/a, n/a) https://deploymentsafety.openai.com/chatgpt-agent/watch-mode
  - July 17, 2025 agent generation: watch mode auto-pauses on sensitive sites when the user stops supervising. Full card: cdn.openai.com/pdf/839e66fc-602c-48bf-81d3-b21eacc3459d/chatgpt_agent_system_card.pdf.

- **Invariant Labs: GitHub MCP exploited** (post, n/a, n/a) https://invariantlabs.ai/blog/mcp-github-vulnerability
  - May 26, 2025 toxic-agent-flow: public issue injection -> private repo exfiltration via public PR; architectural, bypassed GitHub permission model. Also: simonwillison.net/2025/May/26/github-mcp-exploited/ and github.com/github/github-mcp-server/issues/844.

- **General Analysis: Supabase MCP can leak your entire SQL database** (post, n/a, n/a) https://generalanalysis.com/blog/supabase-mcp-blog
  - July 2025. service_role key bypassing RLS + support-ticket injection -> secrets written into attacker-visible ticket. Willison commentary: simonwillison.net/2025/Jul/6/supabase-mcp-lethal-trifecta/.

- **postmark-mcp npm backdoor coverage** (post, n/a, n/a) https://thehackernews.com/2025/09/first-malicious-mcp-server-found.html
  - Sept 2025, Koi Security: v1.0.16 BCC'd all outgoing mail to attacker; ~1,500 weekly installs. Also theregister.com/2025/09/29/postmark_mcp_server_code_hijacked/.

- **JFrog: CVE-2025-6514 mcp-remote RCE** (post, n/a, n/a) https://jfrog.com/blog/2025-6514-critical-mcp-remote-rce-vulnerability/
  - July 9, 2025, CVSS 9.6; malicious authorization_endpoint -> command injection via open(); affected 0.0.5-0.1.15, fixed 0.1.16, >437k downloads. Advisory: github.com/advisories/GHSA-6xpm-ggf7-wc3p.

- **EchoLeak CVE-2025-32711 coverage** (post, n/a, n/a) https://thehackernews.com/2025/06/zero-click-ai-vulnerability-exposes.html
  - June 2025, Aim Security; zero-click M365 Copilot RAG injection exfiltrating tenant data; CVSS 9.3; Microsoft server-side patch; no known in-the-wild exploitation.

- **OWASP Agentic AI - Threats and Mitigations** (spec, n/a, n/a) https://storage.ghost.io/c/44/95/449506ca-034e-480f-9725-fcde08ef1cc1/content/files/2025/04/Agentic-AI---Threats-and-Mitigations.pdf
  - Feb 2025 taxonomy (memory poisoning, tool misuse, privilege compromise); referenced by Microsoft/AWS. Successor list: OWASP Top 10 for Agentic Applications, Dec 9, 2025 (genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/).

- **MCPTox: tool-poisoning benchmark** (paper, n/a, n/a) https://arxiv.org/pdf/2508.14925
  - Benchmark for tool-poisoning attacks on real-world MCP servers; useful for empirically testing the sandbox's tool-metadata hardening. Seen in search results; not fetched in full.
