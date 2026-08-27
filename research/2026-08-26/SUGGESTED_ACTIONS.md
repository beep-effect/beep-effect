# SUGGESTED_ACTIONS — 2026-08-26

Proposals only. Human admits. Do not auto-append to `explorations/INBOX.md` or `goals/`.
Derived from `claims.jsonl` (34 findings). An item graduates when a human fires its capture command.

## Priority (PROMPT kickoffs)

These four match `PROMPT.md`. Capture first if you only fire a few.

### f-law-05 — USPTO ODP now requires four profile fields or API keys revoke

Effective 2026-08-18, USPTO ODP requires four additional USPTO-profile fields or ODP products and API keys are revoked. OA text is at api.uspto.gov/api/v1/patent/oa/ with daily refresh. Petition includeDocuments still 500s. This gates uspto-prosecution-read, OA extraction, and PTMNFEE ingest.

```sh
bun run beep research capture https://data.uspto.gov/apis/office-action-retrieval/search --tags law,uspto,office-action,odp
```

### f-effect-01 — effect@4.0.0-rc.112 adds SchemaBinary as the cluster wire codec

effect@4.0.0-rc.112 (2026-08-25) added SchemaBinary, a compact schema-derived codec with streaming, optional fingerprints/dictionaries, and RPC support. Same release retried EventLog remote writes (#7401) and returned workflow discard execution IDs (#7428).

```sh
bun run beep research capture https://github.com/Effect-TS/effect/releases/tag/effect%404.0.0-rc.112 --tags effect,effect-v4,schema,rpc
```

### f-effect-05 — drizzle-orm effect-core still calls Schema.TaggedErrorClass

drizzle-orm#6162: drizzle-orm 1.0.0-rc.4 effect-core still calls Schema.TaggedErrorClass after Effect renamed it to Schema.TaggedError. Intersects open beep PR #852 (effect-drizzle kits).

```sh
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,effect-v4
```

### f-agents-03 — Skills-over-MCP WG: Agent Plugins (disk) vs SEP-2640 (wire)

experimental-ext-skills PR #120 merged 2026-08-25 with the Agent Plugins (disk snapshot of a file directory) vs skills-over-MCP / SEP-2640 (wire) analysis. Hosts already implement both shapes.

```sh
bun run beep research capture https://github.com/modelcontextprotocol/experimental-ext-skills/pull/120 --tags agents,mcp,skills,sep-2640
```

### f-agents-07 — TrustShiftProbe: compromised MCP servers stay honest for N calls then defect

TrustShiftProbe (arXiv 2608.23763): a compromised MCP server behaves benignly for a conditioning window then defects; 69.5% mean ASR across frontier agents, mitigated to 42.7% by SHIELD. Install-time SKILL.md scanners miss it because the evasion is temporal. Read before un-parking #853.

```sh
bun run beep research capture https://arxiv.org/abs/2608.23763 --tags agents,mcp,security,trustshift
```

### f-law-02 — Thomson Reuters launches Thomson 1.0 on Qwen 3.5 + Westlaw/Practical Law

Thomson Reuters launched Thomson 1.0, a Qwen 3.5 post-train on Westlaw, Practical Law, Checkpoint, and Reuters; first deployment is CoCounsel Legal Tabular Analysis. TR says the last training run cost $450,000 and customer data was not used.

```sh
bun run beep research capture https://www.lawnext.com/2026/08/thomson-reuters-launches-thomson-its-own-proprietary-llm-trained-on-westlaw-and-practical-law-content.html --tags law,cocounsel,thomson,competitor
```

### f-law-04 — Harvey ships Tenet (Kimi K3 post-train) and Harvey II matter memory

Harvey introduced Tenet, its first post-trained open-weight legal model, using Moonshot Kimi K3 plus async RL on synthetic, public legal, and expert data. Two days earlier Harvey II added matter-context retention.

```sh
bun run beep research capture https://www.law.com/legaltechnews/2026/08/20/harvey-introduces-tenet-its-first-post-trained-ai-model-for-legal-/ --tags law,harvey,tenet,competitor
```

### f-law-09 — Dis2Pat: disclosure-to-complete-application patent drafting benchmark

Dis2Pat (arXiv 2608.21249, EMNLP 2026) is a disclosure-to-complete-application benchmark from inventor-style de-legalized disclosures, with local multi-agent baseline Patent-MAF. Usable gold for patent-drafting-episode-ledger and effect-native-legal-eval.

```sh
bun run beep research capture https://arxiv.org/abs/2608.21249 --tags law,patent-drafting,benchmark,arxiv
```

## Law

### f-law-01 — RelativityOne connects to Gemini Enterprise for Legal over MCP

On 2026-08-25 RelativityOne integrated with Google Cloud Gemini Enterprise for Legal through MCP, adding a conversational agentic layer on RelativityOne for matter standup, workspace alignment, and access control.

```sh
bun run beep research capture https://www.prnewswire.com/news-releases/relativity-accelerates-enterprise-ai-transformation-with-google-clouds-gemini-enterprise-for-legal-302858717.html --tags law,relativity,mcp,gemini,competitor
```

### f-law-03 — Next-gen CoCounsel Legal GA: Deep Research Verify + Claude MCP

Thomson Reuters generally released next-generation CoCounsel Legal (2026-08-20) with Deep Research Verify for citation support checks and an expanded CoCounsel Legal MCP with Claude. Westlaw Brief Builder, Workspaces, and Thomson-powered Tabular Analysis shipped in the same drop.

```sh
bun run beep research capture https://www.thomsonreuters.com/en/press-releases/2026/august/thomson-reuters-launches-next-generation-of-cocounsel-legal-the-ai-ecosystem-built-for-legal-professionals --tags law,cocounsel,verify,mcp,competitor
```

### f-law-06 — Spellbook closes the Word-export gap with an in-agent multi-document editor

Spellbook launched an in-Associate multi-document editor (2026-08-18) so lawyers can edit, comment, and redline without exporting to Word. The stated gap was AI redlines that still required Word for precise edits, while Word add-ins stayed single-document.

```sh
bun run beep research capture https://legaltech.ca/2026/08/18/spellbook-launches-ai-document-editor-for-multi-document-legal-work/ --tags law,spellbook,editor,competitor
```

### f-law-07 — Dual-judge protocol for legally grounded VLM evaluation

arXiv 2608.24258 (2026-08-25) proposes a dual-judge eval: a 0-10 quality judge plus a strict binary semantic-equivalence judge against a human-curated legal reference. On 4,680 UK traffic-sign evaluations the judges are moderately associated (r=0.644) with an 8.0% Type II pattern; high quality scores are least trustworthy under heavy occlusion.

```sh
bun run beep research capture https://arxiv.org/abs/2608.24258 --tags law,eval,vlm,arxiv
```

### f-law-08 — CPC Y02 green-patent labels are systematically wrong at corpus scale

arXiv 2608.23420 audits USPTO Y02 tags across 9.07M granted patents and finds 180,384 False Green and 29,465 Silent Green administrative errors. Correcting consensus-attributed errors cuts the measured green-patent population by 25.5% (592,387 to 441,468). CPC Y02 is not safe ground truth.

```sh
bun run beep research capture https://arxiv.org/abs/2608.23420 --tags law,uspto,y02,arxiv
```

### f-law-10 — ClaimGAT treats claim dependency as a graph

ClaimGAT (arXiv 2608.21924) encodes each claim independently, builds a directed claim-dependency graph, and predicts litigation risk from grant-time information only (AUC-ROC 0.818; 4.89x lift at top 10%).

```sh
bun run beep research capture https://arxiv.org/abs/2608.21924 --tags law,patent-drafting,claimgat,arxiv
```

### f-law-11 — Nightshift: top-50 embedding shortlist misses 59.7% of examiner X-refs

Nightshift (new OSS prior-art agent) reports that a top-50 gemini-embedding-001 shortlist still misses 59.7% of examiner-applied anticipatory refs (top-50 recall 40.3%; top-2000 recall 83.9% on 171,695 G06Q patents).

```sh
bun run beep research capture https://github.com/JonathanSolvesProblems/nightshift --tags law,patent-drafting,prior-art,nightshift
```

### f-law-12 — mcp-trademarks: USPTO TSDR + keyless knockout search over MCP

pipeworx-io/mcp-trademarks exposes USPTO trademark search (keyless tmsearch Elasticsearch) plus serial/registration/document lookup that requires a USPTO API key. Pack endpoint also injects shared Pipeworx meta-tools (~30 extra schemas).

```sh
bun run beep research capture https://github.com/pipeworx-io/mcp-trademarks --tags law,trademark,mcp,uspto
```

## Effect

### f-effect-02 — Effect #7461 removes MessagePack; EventLog/cluster move to SchemaBinary

Merged 2026-08-26, Effect PR #7461 removed msgpackr and the unstable MessagePack encoding/RPC APIs, moved event-log persistence and remote messages to SchemaBinary, and dropped the MessagePack cluster transport option.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7461 --tags effect,effect-v4,schemabinary,msgpack
```

### f-effect-03 — EventLog retries transient remote writes

Effect PR #7401 (merged 2026-08-24, shipped in rc.112) retries transient EventLog remote write failures on the existing exponential backoff schedule so pending local entries synchronize after recovery.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7401 --tags effect,eventlog,local-first
```

### f-effect-04 — Workflow discard endpoints return execution IDs

Effect PR #7428 (merged 2026-08-24) declares Schema.String success values for generated workflow discard RPCs and HTTP endpoints so proxy clients can type and decode the deterministic execution ID that Workflow.execute(..., { discard: true }) already returned.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7428 --tags effect,workflow,httpapi
```

### f-effect-06 — Unpublished drizzle 1.0.0-rc.5 snapshots throw on undefined RQB v2 filters

drizzle-orm#6180: unpublished 1.0.0-rc.5 snapshots throw Unexpected 'undefined' in filter value on RQB v2 where fields that rc.4 skipped. Types still allow undefined; EmptyFilter is not exported.

```sh
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6180 --tags effect,drizzle,rqb
```

### f-effect-07 — Evolu 8.6.1 fixes null-column sync

@evolu/common@8.6.1 (2026-08-25) fixed synchronization of nullable column updates: setting a nullable column to null now syncs across devices instead of throwing.

```sh
bun run beep research capture https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.6.1 --tags effect,evolu,local-first
```

### f-effect-08 — Jazz lands a trusted React Native relay admission ABI

Jazz PR #2169 (merged 2026-08-26 Chicago time) adds a versioned C ABI that admits a length-bounded JSON document from trusted Kotlin/Objective-C hosts, minting an opaque 32-byte capability. JS never sees config, claims, or tokens.

```sh
bun run beep research capture https://github.com/garden-co/jazz/pull/2169 --tags effect,jazz,local-first,react-native
```

### f-effect-09 — Instant team joins OpenAI; Instant Cloud sunsets 2027-08-31

Instant's team joined OpenAI. Instant Cloud: new signups closed; existing users must migrate within 12 months; all cloud apps shut down 2027-08-31; backups remain until 2028-08-31. Instant is open source with a self-host migration guide.

```sh
bun run beep research capture https://www.instantdb.com/essays/instant_team_joins_openai --tags effect,instant,local-first,vendor
```

### f-effect-10 — AgentRoom: CRDT+MCP shared filesystem for concurrent coding agents

AgentRoom (arXiv 2608.23740) is a realtime CRDT-backed shared workspace exposing file-level claim, status, and broadcast as MCP tools. For CLI-stable models, 2-agent AgentRoom abandons fewer tasks than Solo; coordination, not parallelism or CRDT-merge, bears the load.

```sh
bun run beep research capture https://arxiv.org/abs/2608.23740 --tags effect,crdt,mcp,agents,arxiv
```

### f-effect-11 — Effect compresses the in-repo jsdocs skill

Effect PR #7479 (merged 2026-08-26) compressed the in-repo jsdocs skill from 1,205 to 873 words (212 to 164 lines), dropping duplicated validation/example instructions while keeping checker-specific contracts.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7479 --tags effect,jsdocs,skill
```

## Agents

### f-agents-01 — StarHarness evolves skills/MCP/subagent harnesses around frozen weights

StarHarness (arXiv 2608.24804) evolves environment-specific harnesses (prompts, tools, skills, MCP providers, subagents, loop config) with weights frozen, gaining +20-35pp on ITBench/EnterpriseOps-Gym/AutomationBench after 4-12 accepted changes. Gains transfer across GPT and Qwen without re-evolution.

```sh
bun run beep research capture https://arxiv.org/abs/2608.24804 --tags agents,harness,skills,mcp,arxiv
```

### f-agents-02 — PayPal SCOUT hybrid-retrieves 2k+ MCP tools (140.2k to 1.3k tokens)

PayPal SCOUT (arXiv 2608.23992) surfaces two MCP meta-tools (tool_search, execute_tool) that hybrid-retrieve among 2,000+ tools across 200+ servers, cutting production tool tokens from 140.2k (70.1% of context) to 1.3k (0.8%).

```sh
bun run beep research capture https://arxiv.org/abs/2608.23992 --tags agents,mcp,scout,retrieval,arxiv
```

### f-agents-04 — MCP Python SDK patches FastMCP breakage across v2.1.0/2.1.1/v2.0.1

MCP Python SDK v2.0.1 (2026-08-26) backports the FastMCP import warning to the 2.0.x line; v2.1.1 (2026-08-25) pointed mcp.server.fastmcp imports at the migration guide. Guidance: pin mcp<2 or upgrade to 2.

```sh
bun run beep research capture https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.1 --tags agents,mcp,python-sdk
```

### f-agents-05 — kilo-kit-mcp: skill routing plus C4 workflow gates before completion

kilo-kit-mcp is an MCP server that hard-gates file writes until C4 orchestrate/grill-plan approval, then requires verification-before-completion. 19 tools, 177 skills. Rhymes with yeet cheap-gates (#837/#845).

```sh
bun run beep research capture https://github.com/VoDaiLocz/kilo-kit-mcp --tags agents,mcp,kilo-kit,gates
```

### f-agents-06 — HypoForge: skill learning for hypothesis generation/testing without weight updates

HypoForge (arXiv 2608.25770, 2026-08-26) learns reusable scientific skills for hypothesis generation (adversarial generator-discriminator) and testing (execution outcomes) without fine-tuning foundation models. Sits next to semantica C0 / StarHarness / CGM as harness-and-gate, not weight updates.

```sh
bun run beep research capture https://arxiv.org/abs/2608.25770 --tags agents,hypoforge,skills,arxiv
```

### f-agents-08 — Bosch CGM: constraints-before-LLM as hypothesis-space operators

Bosch CGM (arXiv 2608.24218) treats hard constraints as hypothesis-space operators before the LLM. Hard admissibility shrinks the candidate space ~480x without dropping GT; the gate, not the LLM, is the decisive lift (F1 0.08 to 0.66). A small model with constraints matches a frontier LLM without them at ~28x lower cost.

```sh
bun run beep research capture https://arxiv.org/abs/2608.24218 --tags agents,ontology,constraints,arxiv
```

### f-agents-09 — MCP agents-wg moves from biweekly to weekly meetings

modelcontextprotocol/agents-wg commit c8be0ef (2026-08-25) changed the working-group meeting cadence from biweekly to weekly.

```sh
bun run beep research capture https://github.com/modelcontextprotocol/agents-wg/commit/c8be0efdfaa523cf81e4b66ba8e848222544584a --tags agents,mcp,agents-wg
```

### f-agents-10 — OpenClaw maps Cursor/Claude/Codex/Agent Plugin bundles

OpenClaw installs bundles from Agent Plugins, Codex, Claude, and Cursor and maps skills, hooks, and MCP tools into native features. Bundles are content packs with a narrower trust boundary than in-process native plugins.

```sh
bun run beep research capture https://docs.openclaw.ai/plugins/bundles --tags agents,openclaw,bundles,plugins
```

### f-agents-11 — Claude Code v2 negotiates the 2026-07-28 MCP spec

Claude Code v2 runtime (MCP TypeScript SDK 2.0; default on v2.1.232+) adds MCP protocol revision 2026-07-28. HTTP and claude.ai connectors are asked whether they support the newer revision; stdio servers stay on the earlier handshake unless MCP_PROTOCOL_NEGOTIATION=auto.

```sh
bun run beep research capture https://code.claude.com/docs/en/mcp-servers --tags agents,claude-code,mcp,spec
```
