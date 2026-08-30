# SUGGESTED_ACTIONS — 2026-08-28

Proposals only. Human admits. Do not auto-append to explorations/INBOX.md or goals/. Derived from claims.jsonl (15 findings).

## Priority (PROMPT kickoffs)

These five match `PROMPT.md`. Capture first if you only fire a few.

### f-agents-01 — Daydreaming: steal hosted agent skills via ordinary task results

Daydreaming (arXiv 2608.26733, 2026-08-27, Berkeley/NYCU) reconstructs a multi-file hosted skill from black-box task results only (Output-level; no disclosure path). Across 7 skills and 4 victim models it recovers up to 86.8% of original-skill capability at a median 32 victim calls, ~4x SigLeak, even with disclosure defenses on. Names Harvey as a Skill-as-a-Service vendor. Intersection of skills + legal-AI + skill-contract-kernel: hiding SKILL.md is not enough if the work path leaks behavior. Read next to TrustShiftProbe (temporal MCP defection) and Tenet's bash/fs-vs-MCP harness asterisk.

```sh
bun run beep research capture https://arxiv.org/abs/2608.26733 --tags agents,skills,security,daydreaming,arxiv
```

### f-law-01 — iManage next-gen GA October; MCP now writes workspaces and files

LawNext dated 2026-08-27 republished iManage's 2026-08-24 announcement: next-gen platform GA in October 2026. The iManage MCP Server is being advanced from read to agentic write (create workspace/folder, file, move, link). Playbook-based review, tabular review, and MCP read/write are available today. Context Fabric keeps content in-place with inherited permissions. Open ecosystem names Copilot, Harvey, Legora, Thomson Reuters, Spellbook, ChatGPT Enterprise, and Claude. Missed by the 2026-08-26 packet; ILTACON-week DMS write-back is the new competitor move.

```sh
bun run beep research capture https://www.lawnext.com/2026/08/imanage-announces-general-availability-of-its-next-generation-platform-enabling-organizations-to-scale-ai-reliably.html --tags law,imanage,mcp,dms,competitor
```

### f-effect-02 — Effect McpServer: non-object tool results no longer go in structuredContent

Effect #7495 (merged 2026-08-28T12:42Z) fixes McpServer.ts sending null or arrays as MCP structuredContent. The old check was typeof encodedResult === "object", which is true for null and arrays; MCP requires a JSON object. Closes #7494. Directly relevant to beep mcp-kit / gov-legal-mcp / uspto-mcp tool result schemas: encoded success must be a JSON object or structuredContent stays undefined.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7495 --tags effect,effect-v4,mcp,tools
```

### f-effect-01 — SchemaBinary overnight: strict encode, decoder limits, dict/number arrays

Standing SchemaBinary-as-cluster-wire HOLDS and MOVES. Overnight Effect merged #7506 (dictionary and number-array handling), #7507 (decoder limits), and #7508 (2026-08-28T05:08Z: honor onExcessProperty error across exact/batch/stateful-dictionary/channel encode; reject crafted extra-map entries that collide with declared struct fields; keep dictionary state unchanged on reject). Closes EFF-956/958/959. No rc.113 yet; still on effect@4.0.0-rc.112. Watchlist w-schema-binary stays; the codec is being hardened in-tree before the next RC.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7508 --tags effect,effect-v4,schemabinary,codec
```

### f-law-06 — Refute: USPTO ODP four-field gate still holds; petition includeDocuments still 500s

Standing 2026-08-26 f-law-05 HOLDS. Independent August 2026 live check (patent.dev): the four USPTO-profile fields (Job Title, Organization Name, Organization Type, Intended Use) remain mandatory after 2026-08-18 or ODP products and API keys are revoked; they cannot be set via API. GET /api/v1/petition/decisions/{id}?includeDocuments=true still returns HTTP 500 for every record tested 2004-2026. OA migration to api.uspto.gov/api/v1/patent/oa/ is complete and keyed. uspto-prosecution-read / OA extraction / PTMNFEE still gated.

```sh
bun run beep research capture https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/ --tags law,uspto,odp,refute
```

## Law

### f-law-02 — Bloomberg Law ships BLAW AI, Workspaces, agents, and Claude MCP

Bloomberg Law (2026-08-20, shown through ILTACON 2026-08-27) launched BLAW AI (cited conversational research), Workspaces, and guided AI agents, plus an MCP integration that puts Bloomberg litigation intelligence and dockets into Claude. Missed by the 2026-08-26 packet. Completes the ILTACON picture: research vendors (Bloomberg) now ship MCP out, not only DMS vendors shipping MCP in.

```sh
bun run beep research capture https://www.prnewswire.com/news-releases/bloomberg-law-unveils-new-ai-powered-legal-intelligence-experience-at-iltacon-2026-302856497.html --tags law,bloomberg,mcp,claude,competitor
```

### f-law-03 — Clarra MCP: 120+ tools over 250 REST endpoints, Claude Cowork

Clarra (2026-08-19, demoed ILTACON booth 816) shipped an MCP server with more than 120 tools over 250 REST endpoints for litigation case management, connecting Claude Cowork (and ChatGPT, Copilot, Cursor, Lovable) to matter data, documents, and workflows already in Clarra. Token-efficient access; admin-configurable custom properties. Missed by the 2026-08-26 packet. Direct foil for gov-legal-mcp / practice-kg-mcp / law-docketing-patent-spine.

```sh
bun run beep research capture https://www.prnewswire.com/news-releases/clarra-introduces-the-most-comprehensive-mcp-server-for-legal-case-management-302854675.html --tags law,clarra,mcp,docketing,competitor
```

### f-law-04 — Gemini Enterprise for Legal: 13+ permission-bound MCP connectors

Google Cloud (2026-08-25) launched Gemini Enterprise for Legal as a purpose-built agentic platform: legal skills, pre-built agents, a governed control plane with verifiable grounding, and secure MCP connectors that inherit existing RBAC/ethical walls. Named connectors include iManage, NetDocuments, Docusign, Everlaw, RelativityOne, Thomson Reuters HighQ, CourtListener, and Harvey. RelativityOne-over-MCP was claimed 2026-08-26; this is the wider 13-plus connector graph and the in-place, no-bulk-export rule. Intersects iManage write-back (f-law-01) and NetDocuments Claude MCP.

```sh
bun run beep research capture https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-for-legal/ --tags law,gemini,mcp,google,competitor
```

### f-law-05 — BLANC: patent white-space via multi-view NPMI drop

BLANC (arXiv 2608.26685, 2026-08-27) finds patent white space as combinations whose NPMI drops when the corpus is filtered by a keyword (DeltaNPMI). Three semantic views (application/use, novelty, inventive step); collapsing them to one recovers nothing. On depleted USPTO G06N (5,417) and C03C (1,982) corpora, recovering 34.1% and 27.3% of hidden combinations when 75% of a target pair is removed; 0/191 decoy trials. Usable method for patent-drafting-episode-ledger / law-docketing-patent-spine landscape, not a substitute for CPC Y02 (already contradicted 2026-08-26).

```sh
bun run beep research capture https://arxiv.org/abs/2608.26685 --tags law,patent,whitespace,arxiv
```

## Effect

### f-effect-03 — Effect Socket is now pull-based with TLS constructors

Effect #7487 (merged 2026-08-27T23:09Z) makes the Socket API pull-based with backpressure. Follow-ups #7511/#7512 (2026-08-28) add NodeSocket.makeTls and NodeSocketServer.makeTls; #7513 closes pending Node sockets immediately. Continues the 2026-08-27 closed-packet Socket.fromWebSocket cross-runtime work (#7477, excluded). Cluster/AI clients can share one socket constructor with TLS and backpressure. Relevant to beep box-driver / openai-driver / mcp-host-retrofit.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7487 --tags effect,effect-v4,socket,tls
```

### f-effect-04 — Refute: drizzle TaggedErrorClass break still open after beep #852

Standing 2026-08-26 drizzle TaggedErrorClass claim HOLDS. drizzle-orm#6162 remains OPEN (last update 2026-08-25T17:32Z, 3 comments). beep #852 (effect-drizzle kits) merged 2026-08-27T05:00Z and does not close the upstream break: effect-core still calls Schema.TaggedErrorClass after Effect renamed it. Do not treat kit simplification as a Drizzle v4-RC fix.

```sh
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,effect-v4,refute
```

### f-effect-05 — Refute: Instant Cloud sunset 2027-08-31 still holds

Standing Instant Cloud sunset watchlist HOLDS. Official essay unchanged: new signups closed; existing users migrate within 12 months; all cloud apps shut down 2027-08-31; backups through 2028-08-31. Self-host docs (VPS Docker Compose; AWS Aurora matching Instant Cloud topology) remain the migration path. No walk-back in this window.

```sh
bun run beep research capture https://www.instantdb.com/essays/instant_team_joins_openai --tags effect,local-first,instant,refute
```

## Agents

### f-agents-02 — WikiSkill: persist experience in a wiki so skills can evolve

WikiSkill (arXiv 2608.27454, 2026-08-27) separates raw execution experience, a persistent wiki, and executable skills; the wiki is the accumulation surface later skill updates build on. Skill evolution complements model scaling; smaller models with evolved skills beat larger models without them; skills transfer across model families and other-model-evolved skills can beat self-evolved. Sits next to HypoForge / StarHarness (2026-08-26) and semantica C0 / skill-contract-kernel: harness-and-wiki, not weight updates.

```sh
bun run beep research capture https://arxiv.org/abs/2608.27454 --tags agents,skills,wiki,arxiv
```

### f-agents-03 — SymbolLKG: ontology-as-topology plus symbolic solver routing

SymbolLKG (arXiv 2608.26836, 2026-08-27) is a neuro-symbolic stack: an ontology-based Logical Knowledge Graph treats rules and constraints as first-class topological nodes, then a Logic Router dispatches to a symbolic engine with topology-aware hybrid retrieval. Claims higher accuracy and verifiable reasoning paths vs prompting/RAG. Same constraints-before-LLM family as Bosch CGM (2026-08-26). Intersects today's repo-replay #866 (semantic-foundation closed) and open ontology-agent-surface / belief-view-engine / epistemic-contradiction-detection.

```sh
bun run beep research capture https://arxiv.org/abs/2608.26836 --tags agents,ontology,neural-symbolic,arxiv
```

### f-agents-04 — Refute: SEP-2640 still open; skill-contract fork has not settled

Standing skills-over-MCP / SEP-2640 watchlist HOLDS. modelcontextprotocol#2640 remains OPEN (last update 2026-08-25T22:57Z). No merge in this window. Disk Agent Plugins vs wire SEP-2640 is still a live fork; hosts already implement both (2026-08-26 f-agents-03). Do not pick a single skill transport for skill-contract-kernel / mcp-kit until the SEP moves.

```sh
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640,refute
```
