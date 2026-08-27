# SOURCES — 2026-08-26

Quarantined evidence. Short, fenced, quoted, sanitized excerpts with canonical links.
Derived from `claims.jsonl`. No x.com posts (X search blocked: `client-not-enrolled`).

## Law

### f-law-01 — RelativityOne connects to Gemini Enterprise for Legal over MCP

- URL: https://www.prnewswire.com/news-releases/relativity-accelerates-enterprise-ai-transformation-with-google-clouds-gemini-enterprise-for-legal-302858717.html
- Kind: `web`

```
RelativityOne now integrates with Google Cloud's Gemini Enterprise for Legal through the Model Context Protocol (MCP). This latest connection to the MCP has launched as part of Gemini Enterprise for Legal, an agentic solution purpose-built to meet the complex requirements and workflows of the legal industry.
```

### f-law-02 — Thomson Reuters launches Thomson 1.0 on Qwen 3.5 + Westlaw/Practical Law

- URL: https://www.lawnext.com/2026/08/thomson-reuters-launches-thomson-its-own-proprietary-llm-trained-on-westlaw-and-practical-law-content.html
- Kind: `web`

```
The model launching today is formally Thomson 1.0... Although the models it used changed over the course of the project, the most recent was Qwen 3.5. Jonathan Schwarz... said... then continuing to train it exclusively on TR's proprietary content from Westlaw, Practical Law, Checkpoint and Reuters. None of that training data comes from customers.
```

### f-law-03 — Next-gen CoCounsel Legal GA: Deep Research Verify + Claude MCP

- URL: https://www.thomsonreuters.com/en/press-releases/2026/august/thomson-reuters-launches-next-generation-of-cocounsel-legal-the-ai-ecosystem-built-for-legal-professionals
- Kind: `web`

```
Deep Research Verify checks whether cited Westlaw and Practical Law authority supports specific legal assertions, helping legal professionals strengthen confidence in AI-assisted work product. Thomson Reuters is continuing its work with Anthropic, including the launch of an expanded CoCounsel Legal MCP with Claude in August.
```

### f-law-04 — Harvey ships Tenet (Kimi K3 post-train) and Harvey II matter memory

- URL: https://www.law.com/legaltechnews/2026/08/20/harvey-introduces-tenet-its-first-post-trained-ai-model-for-legal-/
- Kind: `web`

```
Legal artificial intelligence startup Harvey on Thursday introduced Tenet, the company's first post-trained open-weight AI model. The company worked with AI training platform Fireworks AI to develop the tool using Chinese AI startup Moonshot AI's model Kimi K3 as a base. Just two days prior to the Tenet news, the company announced the launch of Harvey II, the second generation of its AI legal platform featuring new capabilities for retaining context.
```

### f-law-05 — USPTO ODP now requires four profile fields or API keys revoke

- URL: https://data.uspto.gov/apis/office-action-retrieval/search
- Kind: `web`

```
Also, effective August 18, 2026, we will be requiring users to provide four additional fields of information on their USPTO profile. Failure to do so will result in loss of access to ODP products and API key. Please update these fields in your USPTO.gov account settings by selecting the "Open Data Portal" section.
```

### f-law-06 — Spellbook closes the Word-export gap with an in-agent multi-document editor

- URL: https://legaltech.ca/2026/08/18/spellbook-launches-ai-document-editor-for-multi-document-legal-work/
- Kind: `web`

```
Toronto-based legal AI company Spellbook has launched an AI document editor that allows lawyers to edit, comment on, and redline contracts directly inside its Associate agent—without moving the documents into Microsoft Word. Tools capable of generating extensive redlines may still require lawyers to export the results to Word for precise manual changes. Word-based AI assistants, meanwhile, often operate on one document at a time.
```

### f-law-07 — Dual-judge protocol for legally grounded VLM evaluation

- URL: https://arxiv.org/abs/2608.24258
- Kind: `arxiv`

```
We contribute one additional evaluation signal: a dual-judge protocol that pairs a standard 0-10 quality judge with a strict binary semantic-equivalence judge against a human-curated reference. On 4,680 evaluations under seven visibility levels and two occlusion modes, the two judges are moderately associated (point-biserial r = 0.644), while revealing an asymmetric Type II pattern affecting 8.0% of all evaluations.
```

### f-law-08 — CPC Y02 green-patent labels are systematically wrong at corpus scale

- URL: https://arxiv.org/abs/2608.23420
- Kind: `arxiv`

```
Correcting consensus-attributed administrative errors reduces the measured green-patent population by 25.5% (592,387 to 441,468 patents; sensitivity bounds 390,540-508,126). We identify 180,384 administrative Type I errors (False Green) and 29,465 administrative Type II errors (Silent Green).
```

### f-law-09 — Dis2Pat: disclosure-to-complete-application patent drafting benchmark

- URL: https://arxiv.org/abs/2608.21249
- Kind: `arxiv`

```
To bridge the gap, we introduce Dis2Pat, a disclosure-to-patent dataset that reflects realistic patenting workflows by requiring the generation of complete patent applications directly from inventor-style, de-legalized disclosures. We further propose a strong baseline named Patent-MAF. It is a multi-agent framework for locally deployable patent drafting.
```

### f-law-10 — ClaimGAT treats claim dependency as a graph

- URL: https://arxiv.org/abs/2608.21924
- Kind: `arxiv`

```
We propose ClaimGAT, a Graph Attention Network that encodes each claim independently, constructs a directed claim dependency graph, processes it with GATConv layers, and aggregates independent claims via Attentional Aggregation to yield both a litigation risk score and claim-level gate weights. ClaimGAT achieves an AUC-ROC of 0.818 and a lift of 4.89x at the top 10%, using only information observable at the time of patent grant.
```

### f-law-11 — Nightshift: top-50 embedding shortlist misses 59.7% of examiner X-refs

- URL: https://github.com/JonathanSolvesProblems/nightshift
- Kind: `github`

```
Ranking this corpus with gemini-embedding-001, the strongest embedding available, a top-50 shortlist still misses 59.7% of the references a USPTO examiner actually applied to anticipate a claim. Better ranking does not fix it. Reading further down the list does.
```

### f-law-12 — mcp-trademarks: USPTO TSDR + keyless knockout search over MCP

- URL: https://github.com/pipeworx-io/mcp-trademarks
- Kind: `github`

```
search_trademarks: Search US federal trademarks by mark text — the clearance/knockout-search path. Covers the full USPTO register (the tmsearch.uspto.gov Elasticsearch backend that replaced TESS). Keyless. get_trademark_by_serial / get_trademark_by_registration / get_trademark_documents require USPTO API key (free at account.uspto.gov).
```

## Effect

### f-effect-01 — effect@4.0.0-rc.112 adds SchemaBinary as the cluster wire codec

- URL: https://github.com/Effect-TS/effect/releases/tag/effect%404.0.0-rc.112
- Kind: `github`

```
Add SchemaBinary, a compact schema-derived codec with streaming, optional fingerprints and dictionaries, and RPC support. Retry transient EventLog remote write failures so pending local entries are synchronized after recovery. Return workflow execution IDs from generated RPC and HTTP discard endpoints.
```

### f-effect-02 — Effect #7461 removes MessagePack; EventLog/cluster move to SchemaBinary

- URL: https://github.com/Effect-TS/effect/pull/7461
- Kind: `github`

```
Remove the msgpackr dependency and the unstable MessagePack encoding and RPC serialization APIs. Move event-log persistence and remote messages to SchemaBinary. Remove the MessagePack cluster transport option and update tests, docs, benchmarks, and the lockfile.
```

### f-effect-03 — EventLog retries transient remote writes

- URL: https://github.com/Effect-TS/effect/pull/7401
- Kind: `github`

```
Retry transient EventLog remote write failures with the existing exponential backoff schedule so pending local entries synchronize after recovery. The remote worker now drains journal notifications into a one-slot wake-up queue, preventing payload retention during prolonged outages while preserving a wake-up that arrives during an in-flight retry.
```

### f-effect-04 — Workflow discard endpoints return execution IDs

- URL: https://github.com/Effect-TS/effect/pull/7428
- Kind: `github`

```
Workflow.execute(payload, { discard: true }) returns the deterministic execution ID, but WorkflowProxy left generated discard operations at their default void / no-content success schemas. This change declares Schema.String success values for generated workflow discard RPCs and HTTP endpoints.
```

### f-effect-05 — drizzle-orm effect-core still calls Schema.TaggedErrorClass

- URL: https://github.com/drizzle-team/drizzle-orm/issues/6162
- Kind: `github`

```
effect-core/errors.js calls Schema.TaggedErrorClass but it was renamed to Schema.TaggedError in a recent release. The issue is with 1.0.0-rc.4. It's on that branch: drizzle-orm/src/effect-core/errors.ts.
```

### f-effect-06 — Unpublished drizzle 1.0.0-rc.5 snapshots throw on undefined RQB v2 filters

- URL: https://github.com/drizzle-team/drizzle-orm/issues/6180
- Kind: `github`

```
Between 1.0.0-rc.4 and the 1.0.0-rc.5-* snapshots, RQB v2 started throwing at runtime when a where filter object contains a field whose value is undefined: Error: Unexpected 'undefined' in filter value. Use 'EmptyFilter' if you want the filter field to be skipped. The types still accept it.
```

### f-effect-07 — Evolu 8.6.1 fixes null-column sync

- URL: https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.6.1
- Kind: `github`

```
Fixed synchronization of nullable column updates. Setting a nullable column to null now synchronizes across devices instead of throwing an assertion error.
```

### f-effect-08 — Jazz lands a trusted React Native relay admission ABI

- URL: https://github.com/garden-co/jazz/pull/2169
- Kind: `github`

```
A dedicated versioned C ABI accepts a strict, length-bounded JSON admission document from trusted Kotlin/Objective-C host code. Rust canonicalizes and validates schema, scope, database identity, and claims before minting an opaque 32-byte capability. The generic execute/TurboModule channel cannot admit or revoke scopes and never receives configuration, claims, or tokens.
```

### f-effect-09 — Instant team joins OpenAI; Instant Cloud sunsets 2027-08-31

- URL: https://www.instantdb.com/essays/instant_team_joins_openai
- Kind: `web`

```
The Instant team is joining OpenAI. New signups are closed. Existing users should migrate off of Instant Cloud within the next 12 months. On August 31st, 2027, all cloud apps will shut down. Backups will stay available for 12 more months, until August 31st, 2028. We've written a guide to help you self-host Instant and migrate your apps too.
```

### f-effect-10 — AgentRoom: CRDT+MCP shared filesystem for concurrent coding agents

- URL: https://arxiv.org/abs/2608.23740
- Kind: `arxiv`

```
AgentRoom is a realtime collaborative editing protocol for concurrent coding agents. Its runtime layer exposes file-level claim, status, and broadcast as MCP tools on a CRDT-merged shared filesystem. Coordination, not parallelism or CRDT-merge, bears the load.
```

### f-effect-11 — Effect compresses the in-repo jsdocs skill

- URL: https://github.com/Effect-TS/effect/pull/7479
- Kind: `github`

```
compress the jsdocs skill workflow and declaration guidance; remove duplicated root-level validation and example instructions; preserve checker-specific category, tag, module, link, and refinement contracts. The skill is reduced from 1,205 to 873 words and from 212 to 164 lines.
```

## Agents

### f-agents-01 — StarHarness evolves skills/MCP/subagent harnesses around frozen weights

- URL: https://arxiv.org/abs/2608.24804
- Kind: `arxiv`

```
We present StarHarness, a framework for evolving environment-specific agent harnesses while keeping model weights fixed. The evolved harness can include prompt and task framing, tool interfaces, skills, MCP-backed providers, subagent structure, and agent-loop configuration. Across ITBench SRE, EnterpriseOps-Gym ITSM, and AutomationBench Finance, harness evolution improves full-benchmark performance by 20-35 percentage points over the default harness.
```

### f-agents-02 — PayPal SCOUT hybrid-retrieves 2k+ MCP tools (140.2k to 1.3k tokens)

- URL: https://arxiv.org/abs/2608.23992
- Kind: `arxiv`

```
We present SCOUT (Selective Context Optimization for Universal Tooling), which reframes tool exposure as a context-selection problem, injecting only tools relevant to the current step. In production at PayPal, SCOUT reduces MCP tool-token consumption from 140.2k tokens (70.1% of context) to 1.3k tokens (0.8%), a 99% reduction.
```

### f-agents-03 — Skills-over-MCP WG: Agent Plugins (disk) vs SEP-2640 (wire)

- URL: https://github.com/modelcontextprotocol/experimental-ext-skills/pull/120
- Kind: `github`

```
Adding a breakdown of Agent Plugins 1.0 vs skills over MCP. The main point I made here is that both can bundle these types of artifacts but in the case of plugins its more of a snapshot of a file directory.
```

### f-agents-04 — MCP Python SDK patches FastMCP breakage across v2.1.0/2.1.1/v2.0.1

- URL: https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.1
- Kind: `github`

```
One off backport of the FastMCP import warning for 2.0.x, this is due to a lot of people running into this error and making issues on other repos about it. Ideally either pin mcp<2 or upgrade to 2. Point imports of mcp.server.fastmcp at the migration guide.
```

### f-agents-05 — kilo-kit-mcp: skill routing plus C4 workflow gates before completion

- URL: https://github.com/VoDaiLocz/kilo-kit-mcp
- Kind: `github`

```
An MCP server for safer coding agents: skill routing, C4 workflow gates, memory checks, and verification before completion. kilo_orchestrate_task: C4 closed-loop gate. Enforces brainstorming before code mutation. kilo_write_file: Atomic directory write with Protocol Hard-Gate check.
```

### f-agents-06 — HypoForge: skill learning for hypothesis generation/testing without weight updates

- URL: https://arxiv.org/abs/2608.25770
- Kind: `arxiv`

```
We propose HypoForge, an experience-guided multi-agent framework that learns reusable scientific skills for automated hypothesis generation and hypothesis testing. By matching skill learning strategies with stage-specific supervision, HypoForge enables continual improvement without fine-tuning foundation models.
```

### f-agents-07 — TrustShiftProbe: compromised MCP servers stay honest for N calls then defect

- URL: https://arxiv.org/abs/2608.23763
- Kind: `arxiv`

```
This openness introduces a severe server-side threat we term TrustShift: a compromised MCP server behaves benignly during an initial conditioning phase, building operational reliance and suppressing agent skepticism, before switching to an adversarial payload once an interaction threshold is reached. The evasion is temporal, not syntactic: benign at deploy time, the server's defection is invisible to predeployment static analysis. Across frontier proprietary and open-weight models, TrustShift attacks achieve a 69.5% mean attack success rate that SHIELD mitigates to 42.7%.
```

### f-agents-08 — Bosch CGM: constraints-before-LLM as hypothesis-space operators

- URL: https://arxiv.org/abs/2608.24218
- Kind: `arxiv`

```
Methodologically, constraints operate as hypothesis-space operators rather than post-hoc validators. On a controlled structural-decoy benchmark, hard admissibility shrinks the candidate space ~480x without dropping the GT, and a layer-by-layer ablation shows this gate—not the LLM—is the decisive lift (F1 0.08 to 0.66).
```

### f-agents-09 — MCP agents-wg moves from biweekly to weekly meetings

- URL: https://github.com/modelcontextprotocol/agents-wg/commit/c8be0efdfaa523cf81e4b66ba8e848222544584a
- Kind: `github`

```
Change meeting cadence from biweekly to weekly.
```

### f-agents-10 — OpenClaw maps Cursor/Claude/Codex/Agent Plugin bundles

- URL: https://docs.openclaw.ai/plugins/bundles
- Kind: `web`

```
OpenClaw can install plugins from four external ecosystems: the vendor-neutral Agent Plugins standard, plus Codex, Claude, and Cursor. These are called bundles - content and metadata packs that OpenClaw maps into native features like skills, hooks, and MCP tools. Bundles are not the same as native OpenClaw plugins. Native plugins run in-process and can register any capability. Bundles are content packs with selective feature mapping and a narrower trust boundary.
```

### f-agents-11 — Claude Code v2 negotiates the 2026-07-28 MCP spec

- URL: https://code.claude.com/docs/en/mcp-servers
- Kind: `web`

```
Claude Code connects to MCP servers through one of two client runtimes. The v1 runtime is built on MCP TypeScript SDK 1.x. The v2 runtime is the same code on MCP TypeScript SDK 2.0, which adds MCP protocol revision 2026-07-28. On Claude Code v2.1.232 or later, Claude Code uses the v2 runtime. It asks HTTP and claude.ai connector servers whether they support the newer revision, and uses it with those that do.
```
