# SOURCES — 2026-08-28

Quarantined evidence. Short, fenced, quoted, sanitized excerpts with canonical links.
Derived from `claims.jsonl`. No x.com posts (X search blocked: `client-not-enrolled`).

## Law

### f-law-01 — iManage next-gen GA October; MCP now writes workspaces and files

- URL: https://www.lawnext.com/2026/08/imanage-announces-general-availability-of-its-next-generation-platform-enabling-organizations-to-scale-ai-reliably.html
- Kind: `web`

```
With the next-gen platform the MCP server is being advanced to support agentic actions like creating workspaces, creating folders, filing, moving, and linking documents. AI-generated work product lands in the governed record matching the same permissions, audit trail, and lifecycle set in the matter or project. Playbook-based review, tabular review, and MCP read and write actions are available today.
```

### f-law-02 — Bloomberg Law ships BLAW AI, Workspaces, agents, and Claude MCP

- URL: https://www.prnewswire.com/news-releases/bloomberg-law-unveils-new-ai-powered-legal-intelligence-experience-at-iltacon-2026-302856497.html
- Kind: `web`

```
Using the Model Context Protocol (MCP), Bloomberg Law now offers an integration with Anthropic's Claude. New capabilities include BLAW AI, a new AI mode that provides a unified destination for legal questions and deeper analysis, delivering structured, cited responses grounded in Bloomberg Law content and selected materials.
```

### f-law-03 — Clarra MCP: 120+ tools over 250 REST endpoints, Claude Cowork

- URL: https://www.prnewswire.com/news-releases/clarra-introduces-the-most-comprehensive-mcp-server-for-legal-case-management-302854675.html
- Kind: `web`

```
With more than 120 tools, Clarra's Model Context Protocol (MCP) server is the most comprehensive in the industry, allowing law firms and legal departments to securely connect Claude and other large language models (LLMs) to litigation data, documents, and workflows. Clarra's MCP Server provides token-efficient access to more than 250 REST API endpoints.
```

### f-law-04 — Gemini Enterprise for Legal: 13+ permission-bound MCP connectors

- URL: https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-for-legal/
- Kind: `web`

```
Secure MCP connectors link agents to the document management systems, case repositories, research services, and industry applications legal teams already rely on — inheriting each platform's existing user permissions and access controls rather than working around them. iManage: Gives Gemini Enterprise for Legal permission-bound, auditable access to governed iManage content, eliminating the need for bulk exports or custom integrations.
```

### f-law-05 — BLANC: patent white-space via multi-view NPMI drop

- URL: https://arxiv.org/abs/2608.26685
- Kind: `arxiv`

```
When three-quarters of a target pair's documents are removed, BLANC recovers 34.1% (ML/AI) and 27.3% (glass) of the depleted combinations, whereas size-matched removals not aimed at them (random documents, or those of a different established combination) essentially never do: the target is never recovered in 191 decoy trials. Collapsing the three semantic views into one recovers nothing.
```

### f-law-06 — Refute: USPTO ODP four-field gate still holds; petition includeDocuments still 500s

- URL: https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/
- Kind: `web`

```
Since June, the Open Data Portal requires a registered USPTO.gov account. Now four profile fields have become mandatory: Job Title, Organization Name, Organization Type, and Intended Use. The deadline is August 18, 2026. If the fields are missing, your API access may be interrupted. GET /api/v1/petition/decisions/{id}?includeDocuments=true returns HTTP 500 for every record we tested, from 2004 to 2026.
```

## Effect

### f-effect-01 — SchemaBinary overnight: strict encode, decoder limits, dict/number arrays

- URL: https://github.com/Effect-TS/effect/pull/7508
- Kind: `github`

```
honor onExcessProperty: "error" across the exact single, batch, stateful dictionary, and channel encode paths; reject crafted extra-map entries that collide with declared struct fields; keep dictionary state unchanged when strict validation rejects a frame.
```

### f-effect-02 — Effect McpServer: non-object tool results no longer go in structuredContent

- URL: https://github.com/Effect-TS/effect/pull/7495
- Kind: `github`

```
packages/effect/src/unstable/ai/McpServer.ts decided whether a toolkit result was structured with: structuredContent: typeof result.encodedResult === "object" ? result.encodedResult : undefined. typeof also reports "object" for null and for arrays. A tool whose success schema encoded to either shape put a non-object into structuredContent, which MCP requires to be a JSON object.
```

### f-effect-03 — Effect Socket is now pull-based with TLS constructors

- URL: https://github.com/Effect-TS/effect/pull/7487
- Kind: `github`

```
Pull-based Socket API with backpressure. Add NodeSocket.makeTls. Add NodeSocketServer.makeTls. Close pending Node sockets immediately.
```

### f-effect-04 — Refute: drizzle TaggedErrorClass break still open after beep #852

- URL: https://github.com/drizzle-team/drizzle-orm/issues/6162
- Kind: `github`

```
[BUG]:Deprecated TaggedErrorClass syntax incompatible with Effect v4 release candidates. state: open. updated_at: 2026-08-25T17:32:17Z. comments: 3.
```

### f-effect-05 — Refute: Instant Cloud sunset 2027-08-31 still holds

- URL: https://www.instantdb.com/essays/instant_team_joins_openai
- Kind: `web`

```
On August 31st, 2027, all cloud apps will shut down. Backups will stay available for 12 more months, until August 31st, 2028. New signups are closed. Existing users should migrate off of Instant Cloud within the next 12 months.
```

## Agents

### f-agents-01 — Daydreaming: steal hosted agent skills via ordinary task results

- URL: https://arxiv.org/abs/2608.26733
- Kind: `arxiv`

```
Across 7 skills and 4 victim models, Daydreaming recovers 86.8% of original skill's capability at Output, outperforming SigLeak by almost 4x. It produces installable skills using a median of 32 victim calls per skill even with disclosure defenses enabled. These results show that hiding skill files and filtering direct disclosure do not, by themselves, prevent functional reconstruction through normal use.
```

### f-agents-02 — WikiSkill: persist experience in a wiki so skills can evolve

- URL: https://arxiv.org/abs/2608.27454
- Kind: `arxiv`

```
WikiSkill separates raw execution experience, accumulated knowledge, and executable skills, while continuously consolidating experience into the wiki, which subsequent skill updates can build on. We find that skill evolution complements model scaling: larger models generally benefit more from evolved skills, while smaller models with skills can outperform substantially larger models without them.
```

### f-agents-03 — SymbolLKG: ontology-as-topology plus symbolic solver routing

- URL: https://arxiv.org/abs/2608.26836
- Kind: `arxiv`

```
We introduce an ontology-based LKG that treats logical rules and constraints as first-class topological nodes, enabling explicit modeling of dependencies extracted from text. We further design a Logic Router to dynamically dispatch tasks to the optimal symbolic engine, which is supported by a topology-aware hybrid retrieval mechanism.
```

### f-agents-04 — Refute: SEP-2640 still open; skill-contract fork has not settled

- URL: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640
- Kind: `github`

```
SEP-2640: Skills Extension. State: OPEN. updatedAt: 2026-08-25T22:57:35Z. Extension identifier: io.modelcontextprotocol/skills.
```
