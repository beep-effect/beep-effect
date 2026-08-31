# SUGGESTED ACTIONS — 2026-08-31

Executable captures. Human admits. Do not auto-append to `explorations/INBOX.md` or `goals/`.
Derived from `claims.jsonl` (21 findings). An item graduates when a human fires its capture command.

## Priority (PROMPT kickoffs)

These six match `PROMPT.md` plus the captures named for this packet. Capture first if you only fire a few.

### f-law-02 — Swedish public-law MCP pair: Lifos position currency + Domstolsverket case-law watch

Repo AvoccadoTech/legal-mcp-sweden was created 2026-08-31T04:22:15Z (first feat commit inside the window). Two read-only stdio MCP servers, no account/API key: lifos watches Migrationsverket rättsliga ställningstaganden via RSS and flags knowledge-base cites that have been superseded; rattspraxis mirrors ~17k Domstolsverket published decisions into local SQLite then FTS5-matches a firm watchlist. Explicitly not a JUNO replacement. Store-nothing / gitignored ledger of which positions a firm watches. Direct foil for `gov-legal-mcp` (sister of 08-30 Croatia MCP, different URL).

```
bun run beep research capture https://github.com/AvoccadoTech/legal-mcp-sweden --tags law,mcp,github,sweden
```

### f-agents-03 — Agent Plugins co-evolution (Claude marketplace study, arXiv 2608.28497)

Monday 2026-08-31 cs.SE/cs.AI listing arXiv 2608.28497 (submitted 2026-08-28): first large-scale empirical study of Claude Code plugin marketplaces (1,926 repos, 8,351 plugins, 77,773 plugin-touching commits). Finds 8.8× commit growth in six months, 61.3% Software Engineering plugins, feat 39.6% (vs 17.2% OSS), Claude co-authors 34.9% of commits, and 78% of skills Script–Markdown co-changes functionally coupled. Direct Agent Plugins / skills / MCP intersection for skill-contract-kernel.

```
bun run beep research capture https://arxiv.org/abs/2608.28497 --tags agents,agent-plugins,skills,mcp
```

### f-effect-06 — Effect #7265 MCP 2026-07-28 protocol adapter still OPEN

Effect-TS/effect#7265 (opened 2026-08-15) was updated 2026-08-31T10:12:21Z and remains OPEN. Adds McpProtocol.v2026_07_28: stateless server/discover, McpRequestContext, multi-round-trip tools via McpSchema.InputRequired, and Schema-declared tool output including non-object structuredContent. Effect Schema as MCP/tool-contract intersection; unpublished pending rc.113. Do not treat as shipped until an RC cuts.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7265 --tags effect,mcp,schema,tool-contracts
```

### f-agents-06 — agent-skill-security-scanner (skillscan) created Aug 31

New GitHub repo daffnjk/agent-skill-security-scanner created 2026-08-31T02:07:42Z: offline deterministic static scanner for Agent Skills, MCP tools, IDE rules, and plugin bundles (Go skillscan). Treats skills as untrusted data (no install/exec/URL fetch); fail-closed on incomplete scans (exit 3). TrustShift-adjacent pre-install audit tooling for skills/MCP supply chain.

```
bun run beep research capture https://github.com/daffnjk/agent-skill-security-scanner --tags agents,skills,mcp,security,trustshift
```

### f-effect-05 — Jazz #2347 browser identity MERGED (OPEN claim MOVES)

garden-co/jazz#2347, still OPEN on the 2026-08-30 packet, merged 2026-08-31T05:37:27Z (00:37 CT Aug 31). Completes browser replica identity with durable per-database node identity and foreground lease high-water handoff (Fixes 1933). Cheap-check Jazz #2347 still OPEN MOVES to merged. w-jazz-wire-v1 follow-through: identity landed; alpha.54 RC #2361 and tagged-error #2435 remain live.

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2347 --tags jazz,local-first,replica-identity
```

### f-law-05 — NormasTCU: Brazilian Portuguese legal IR + LLM-as-judge (arXiv 2608.27746)

arXiv 2608.27746 (cs.IR primary; Monday 2026-08-31 mailing; submitted 2026-08-27) introduces NormasTCU: 14,469 Brazilian Federal Court of Accounts normative acts, 46 real-user queries, 3,048 human judgments over 812 query-document pairs by four TCU auditors. LLM-as-judge shows positive scoring bias (MAE 0.46–0.66 on 0–2 and only fair-to-moderate pair-level κ (0.32–0.53) vs humans, but nDCG@10/MRR system rankings often hit Kendall τ≥0.90 while P@10/R@10 do not. Rank-aware metrics survive LLM judges; precision/recall cutoffs do not. Relevant to citation/schema-first legal retrieval eval.

```
bun run beep research capture https://arxiv.org/abs/2608.27746 --tags law,arxiv,legal-ir,llm-as-judge
```

## Remainder

### f-law-01 — Refute: USPTO ODP four-field gate and petition includeDocuments 500s still hold

Standing USPTO ODP claim HOLDS. Live data.uspto.gov banner still mandates four profile fields as of 2026-08-18; patent.dev essay unchanged: Job Title, Organization Name, Organization Type, and Intended Use remain mandatory or ODP products/API keys revoke. Prior live check that GET petition decisions with includeDocuments=true returns HTTP 500 across 2004–2026 is not walked back. Unauth probe returns 401 (500 untestable without key). No in-window USPTO fix.

```
bun run beep research capture https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/ --tags law,uspto,odp,refute
```

### f-law-03 — Awesome-legal-MCP list + legalaimcp.com directory MCP launched 2026-08-31

Repo gbrussich52/awesome-legal-mcp-servers was created 2026-08-31T12:01:42Z (07:01 CT) listing 48 AI tools and MCP servers for law firms, mirroring legalaimcp.com. Companion site ships its own read-only MCP at legalaimcp.com/mcp (search, get-one-tool, list-categories, firm-size-aware recommendation; no auth). Listings include Harvey MCP, CoCounsel, CourtListener official MCP, and a CourtListener Citations Checker framed as catching hallucinated cites. First public catalog of the legal-MCP fabric in this window.

```
bun run beep research capture https://github.com/gbrussich52/awesome-legal-mcp-servers --tags law,mcp,github,directory
```

### f-law-04 — Korean case-law MCP rebrands to lawful-mcp and files Anthropic connector SECURITY.md

On 2026-08-31 the maintained Korean legal MCP (case law, statutes, sentencing; previously legal-search-mcp) was renamed lawful-mcp, branded 로풀 (Lawful). Same-day commits lead hosted quick-start with a web-connector URL plus OAuth (no key, no JSON and add SECURITY.md covering repo plus hosted service, explicitly required for the Anthropic connector directory. Jurisdiction MCP positioning for Claude/ChatGPT directory listing with citation-aware Korean corpus tools.

```
bun run beep research capture https://github.com/LimEulYoung/lawful-mcp --tags law,mcp,github,korea
```

### f-law-06 — QUEST: Danish asylum-appeal credibility extraction + crels vs qrels (arXiv 2608.28555)

arXiv 2608.28555 (cs.IR primary; Monday mailing; submitted 2026-08-28) introduces QUEST over Danish Refugee Appeals Board materials (pub 200 summaries / 4,028 chunks; priv 315 cases / 20,912 chunks). Authors add crels (credibility relevance) distinct from ordinary qrels; Cohen's κ between qrels and crels is 0.04 (pub and 0.02 (priv). LLM-as-judge vs human credibility expert is weak (κ 0.130 pub / −0.010 priv). Ethics statement requires human-in-the-loop. Intersects legal IR + LLM-as-judge + schema-first factor extraction.

```
bun run beep research capture https://arxiv.org/abs/2608.28555 --tags law,arxiv,legal-ir,asylum,llm-as-judge
```

### f-effect-01 — Refute: effect@4.0.0-rc.112 holds; Changesets #7446 stages unpublished rc.113

Standing SchemaBinary/rc.112 watchlist HOLDS. GitHub Releases newest effect@ tag remains effect@4.0.0-rc.112 (published 2026-08-25). Changesets #7446 still OPEN (updated 2026-08-30T23:53:43Z) staging unpublished effect@4.0.0-rc.113. Do not pin beep cluster transport or effect-v4 kits on an unmerged Changesets PR.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7446 --tags effect,effect-v4,rc,changesets
```

### f-effect-02 — Refute: drizzle TaggedErrorClass break still open

Standing drizzle Schema.TaggedErrorClass claim HOLDS. drizzle-orm#6162 remains OPEN (closed_at=null, last update still 2026-08-25T17:32Z). No upstream fix in this window. beep #852 kits do not close it.

```
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,TaggedErrorClass
```

### f-effect-03 — Refute: Instant Cloud sunset 2027-08-31 still holds

Standing Instant Cloud sunset watchlist HOLDS. Official essay unchanged: Instant Cloud runs until August 31st, 2027; backups through August 31st, 2028; new signups closed; self-host migration remains the path. No walk-back in this window.

```
bun run beep research capture https://www.instantdb.com/essays/instant_team_joins_openai --tags instant,local-first,sunset
```

### f-effect-04 — Effect #7532: canonical IP network values with Schema codecs (MERGED)

Effect-TS/effect#7532 opened 2026-08-30T19:24:53Z and merged 2026-08-31T11:56:47Z. Adds canonical IPv4/IPv6 CIDR network values with Schema codecs and reuses the model for PostgreSQL cidr validation. Continues Schema-first Net after still-OPEN #7524. In-tree work that unpublished rc.113 would absorb; already on main.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7532 --tags effect,schema,net,cidr
```

### f-effect-07 — Cambria: Resource Abstraction for Parametrized Algebraic Effects and Handlers (arXiv 2608.27798)

Monday 2026-08-31 cs.PL/new lists arXiv 2608.27798 (Liell-Cock and Staton, Oxford): Cambria, a calculus of parametrized algebraic effects and handlers. Step-indexed parametricity so clients cannot depend on how a handler represents dynamically allocated resources. On-axis for Effect-TS handler lineage.

```
bun run beep research capture https://arxiv.org/abs/2608.27798 --tags effect,arxiv,algebraic-effects,handlers
```

### f-effect-08 — Jazz #2435: wire v1 reject unknown structured error tags

garden-co/jazz#2435 opened 2026-08-31T11:23:08Z and still OPEN. Closes Jazz wire-v1 structured errors to a shared TypeScript/Rust enum: unknown error codes previously mapped to unknown_N are now rejected by both runtimes. Tagged-error / local-first wire intersection; future variants need a coordinated wire change.

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2435 --tags jazz,local-first,wire-v1,tagged-error
```

### f-agents-01 — Refute: SEP-2640 Skills Extension still OPEN (draft)

Standing skills-over-MCP / SEP-2640 watchlist HOLDS (unsettled). modelcontextprotocol#2640 remains OPEN (SEP draft label + extension; updatedAt 2026-08-29T18:46:46Z, no in-window update). Not merged, not closed, still draft-track. Disk Agent Plugins vs wire skills remains a live fork.

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640
```

### f-agents-02 — MCP #3321 Enterprise IG nav MERGED

MOVE vs 2026-08-30 OPEN claim: PR #3321 docs(community): move Enterprise IG charter into interest-groups nav merged 2026-08-30T22:33:58Z by localden. Body notes #2626 landed charter after reorg into interest-groups/, so the page was missing from docs.json nav. Completes the Enterprise IG charter discoverability fix. w-mcp-enterprise-ig moves to IdP docs (#3306).

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3321 --tags agents,mcp,enterprise-ig
```

### f-agents-04 — AGENT-O semantic Agent Card ontology (arXiv 2608.28345)

Monday 2026-08-31 cs.AI listing arXiv 2608.28345 (submitted 2026-08-28): AGENT-O is an OWL 2/RDF modular ontology defining a semantic Agent Card for health-oriented AI agents, covering runtime, models, workflow, tools, clinical use, evaluation, provenance, governance, and reporting. Evaluated with OWL-RL reasoning and three SHACL suites. Rising-edge ontologies-for-agents / schema-card contracts.

```
bun run beep research capture https://arxiv.org/abs/2608.28345 --tags agents,ontology,agent-card
```

### f-agents-05 — MCP #3306 Enterprise IdP / ID-JAG docs (draft)

In-window draft PR #3306 Document identity provider support for enterprise managed auth updated 2026-08-31T06:38:06Z (OPEN, isDraft=true). Documents which IdPs issue ID-JAGs today (Okta, Ping Identity, Microsoft Entra ID) vs prior page that only named examples. Follows Enterprise IG nav merge (#3321) on the enterprise-auth rising edge.

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306 --tags agents,mcp,enterprise-ig,auth
```

### f-agents-07 — Logos: agent harness on cross-process bus (arXiv 2608.28553)

Monday 2026-08-31 cs.AI/cs.MA listing arXiv 2608.28553 (submitted 2026-08-28): Logos frames modern agent systems as runtime-assembled plugins under a spatiotemporal-composability calculus, then moves the plugin carrier off a single shared-process failure domain onto a cross-process bus. Rising-edge agent-harness / plugin-composition formalization next to Agent Plugins packaging.

```
bun run beep research capture https://arxiv.org/abs/2608.28553 --tags agents,agent-harness,plugins
```
