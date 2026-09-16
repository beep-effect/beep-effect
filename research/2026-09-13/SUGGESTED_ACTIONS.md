# SUGGESTED_ACTIONS — 2026-09-13

Executable captures. Human admits.

## Priority (PROMPT kickoffs)

### f-law-04 — In-window: patent-kb-connect docs for hosted 727k-US-patent MCP

GitHub repo blazingbunny/patent-kb-connect created 2026-09-12T15:20:17Z (inside window). Documents how to connect Claude/Codex/Pi to a hosted MCP at https://patents.adriandelrosario.com/mcp over ~727k US patents / 24M vectors with tools patent_search, patent_search_mmr, patent_temporal, patent_compare, patent_chain, get_patent, patent_distill, patent_stats. API-key gated (pkb_). Novel IP-search MC…

```
bun run beep research capture https://github.com/blazingbunny/patent-kb-connect --tags law,patent,mcp,github,agents
```

### f-law-05 — In-window: feature-separate-batch-eval-mcp for cross-patent eval issues

GitHub repo 73882/feature-separate-batch-eval-mcp created 2026-09-13T03:20:50Z (inside window). Stdio MCP that reads prior single-patent feature-separation eval outputs and discovers cross-patent issues (language/domain/input-structure interactions) that single-record reports miss; requires ≥10 support + ≥10 control patents per candidate; tools include status/tag/check/run/insights. Rising-edge pa…

```
bun run beep research capture https://github.com/73882/feature-separate-batch-eval-mcp --tags law,patent,mcp,eval,github
```

### f-effect-03 — MOVES: #8201 still OPEN staging rc.116; now absorbs #8206+#8212 (updated Sep 12 19:55Z)

Effect-TS/effect#8201 (Version Packages rc) remains OPEN draft=false mergeable_state=clean (updated 2026-09-12T19:55:46Z, in-window). Stages unpublished effect@4.0.0-rc.116 whose patch list now includes: #7265 MCP 2026-07-28 server support; #8202 RcRef idleTimeToLive:0; in-window merges #8206 multipart hang fix (merged 2026-09-12T19:20:07Z) and #8212 ByteSize canonical integer string inputs (merge…

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/8201 --tags effect,rc116,changesets,mcp
```

### f-effect-04 — ByteSize #8212 MERGED: canonical integer string inputs (source-breaking; staged for rc.116)

Effect-TS/effect#8212 MERGED 2026-09-12T19:47:22Z by IMax153 (+142/-11). Restricts ByteSize.Input string literals to non-negative decimal integers with recognized case-sensitive units (rejects "4Mb"/"garbage" at compile time); adds ByteSize.fromString / fromStringUnsafe for arbitrary/fractional strings. Source-breaking for callers using loose string literals. Already listed in open #8201 rc.116 ch…

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/8212 --tags effect,bytesize,schema
```

### f-effect-10 — Zero canary tip moves to @rocicorp/zero@1.10.0-canary.21 (in-window npm)

Local-first adjacent: npm @rocicorp/zero dist-tag canary moved to 1.10.0-canary.21 (registry time 2026-09-13T07:24:26.639Z, in-window). latest remains 1.9.0 (2026-08-14). Separate head dist-tag still points at ephemeral 1.11.0-head-* builds (head tip time pre-window). Treat as canary-channel motion only — not a stable release — useful for Zero sync consumers watching post-Instant-sunset local-firs…

```
bun run beep research capture https://www.npmjs.com/package/@rocicorp/zero/v/1.10.0-canary.21 --tags zero,local-first,canary
```

### f-agents-01 — BROKEN/MOVES: SEP-2640 Status=Final on branch; draft=false; still OPEN/unmerged; 4 in-window commits Sep 13 UTC

Standing claim 'Accepted≠Final / still OPEN/draft' is partially BROKEN and MOVES in-window. Live GitHub MCP check: PR #2640 state=open, merged=false, draft=false, labels include SEP/final/extension (no draft label), mergeable_state=blocked, updated_at=2026-09-13T05:04:03Z. Branch sep/skills-extension tip 582d814a; seps/2640-skills-extension.md Status: Final. Four commits landed in-window (2026-09-…

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640,refute
```

### f-agents-06 — SEP-2640 adds Agent Skills backwards-compatibility MUST/SHOULD (in-window normative tweak)

In-window commit 8079d781 (2026-09-13T04:48:42Z) on sep/skills-extension amends Skill Format: when Agent Skills changes incompatibly, clients MUST honor any backwards-compatibility mechanisms from that spec and SHOULD continue supporting the prior Agent Skills revision. Paired refresh commit fd72d3f1 retargets WG links experimental-ext-skills→ext-skills, requires servers declaring the skills exten…

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/commit/8079d7811255c751031db8c2c03ecad0e74f8e27 --tags agents,mcp,skills,sep-2640
```

### f-agents-07 — agent-security-auditor skill packages CI skill_scanner as installable offline Agent Skill (opened Sep 13)

Shubhamsaboo/awesome-llm-apps#1167 opened 2026-09-13T06:09:07Z in-window: adds agent-security-auditor — same skill_scanner already used in CI, now an installable Agent Skill (Python stdlib only, no network, never executes scanned code). Detects ClawHavoc-style install lures, curl|bash, undeclared network, credential harvest, obfuscation, unpinned installs; demo flags LURE01/EXEC01 CRITICAL. Patter…

```
bun run beep research capture https://github.com/Shubhamsaboo/awesome-llm-apps/pull/1167 --tags agents,skills,security,scanner
```

### f-agents-08 — awesome-skills-registry adds BackBond/agent-scan skill source (static MCP/agent-manifest scanner)

truefoundry/awesome-skills-registry#23 created 2026-09-12T14:17:28Z (in-window) registers BackBond/agent-scan with skills_path: skills/ so skills/agent-scan/SKILL.md is ingested. Upstream skill describes local static inspection of exported MCP/AI-agent tool manifests before attachment; pins @backbond/agent-scan@0.6.2; MCP launch via npx -y @backbond/agent-scan@0.6.2 mcp; explicitly states results …

```
bun run beep research capture https://github.com/truefoundry/awesome-skills-registry/pull/23 --tags agents,skills,security,scanner
```

### f-agents-09 — HOLD: Tier-1 SEP-2640 SDK + docs gates still OPEN (go/python/csharp/docs; no in-window merge)

After SEP-2640 Final-on-branch + in-window SEP text polish, ship gates unchanged: go-sdk#1238 still OPEN (updated_at 2026-09-11T14:18:17Z), python-sdk#3485 OPEN (2026-09-11T17:35:30Z), csharp-sdk#1856 OPEN (2026-09-08T19:42:03Z), docs#3353 OPEN (2026-09-11T15:31:23Z) with merge gate waiting on Final-on-main. None merged in this window. Final SEP status must not be read as shipped SDK APIs or websi…

```
bun run beep research capture https://github.com/modelcontextprotocol/go-sdk/pull/1238 --tags agents,mcp,skills,sdk
```

## Remainder

### f-law-01 — Refute HOLD: USPTO ODP four-field profile gate still mandatory

```
bun run beep research capture https://data.uspto.gov/support --tags law,uspto,odp,auth,refute
```

### f-law-02 — Refute HOLD: iManage/TR CoCounsel partnership MCP still coming soon (not GA)

```
bun run beep research capture https://imanage.com/resources/resource-center/news/imanage-thomson-reuters-atrategic-partnership-governed-ai-legal-workflows/ --tags law,imanage,cocounsel,mcp,refute
```

### f-law-03 — Refute HOLD: Harvey–Everlaw MCP still expected fall 2026 (not GA)

```
bun run beep research capture https://www.harvey.ai/blog/harvey-everlaw-evidence-ediscovery --tags law,harvey,everlaw,mcp,refute
```

### f-law-06 — Patlytics MCP live in Claude and ChatGPT (read-only patent intelligence)

```
bun run beep research capture https://www.patlytics.ai/blog/patlytics-mcp-patent-intelligence-now-available-in-claude-and-chatgpt --tags law,patlytics,mcp,patent,competitor
```

### f-law-07 — Otto HUB MCP Controller: live USPTO docket + IPMS into Claude/Copilot/ChatGPT

```
bun run beep research capture https://blackhills.ai/otto-hub/mcp-controller/ --tags law,patent,mcp,uspto,ipms,competitor
```

### f-law-08 — Harvey raises $550M at $15.5B valuation (Sep 9; missed by prior packet)

```
bun run beep research capture https://www.harvey.ai/blog/harvey-raises-dollar550m-at-a-dollar155b-valuation-to-help-legal-teams-own-their-intelligence --tags law,harvey,funding,competitor
```

### f-law-09 — Harvey acquires Guardrails AI for agent reliability (4th 2026 deal)

```
bun run beep research capture https://www.harvey.ai/blog/guardrails-ai-joins-harvey --tags law,harvey,guardrails,agents,acquisition
```

### f-law-10 — Morrison Foerster firmwide Legora partnership (Sep 2026)

```
bun run beep research capture https://legora.com/customers/morrison-foerster --tags law,legora,adoption,competitor
```

### f-law-11 — LawToolBox MCP: governed M365 matter containers for Claude/Copilot/Harvey/Legora

```
bun run beep research capture https://lawtoolbox.com/mcp/ --tags law,lawtoolbox,mcp,m365,dms
```

### f-law-12 — Everlaw first-party MCP Server KB live (api.everlaw.com/v1/mcp; distinct from Harvey bridge)

```
bun run beep research capture https://support.everlaw.com/hc/en-us/articles/49986656959771-Everlaw-MCP-Server --tags law,everlaw,mcp,ediscovery
```

### f-effect-01 — HOLD: effect tip still 4.0.0-rc.115; rc.116 not on npm

```
bun run beep research capture https://www.npmjs.com/package/effect?activeTab=versions --tags effect,rc115,npm,refute
```

### f-effect-02 — HOLD: Effect MCP #7265 still MERGED on main; adapter still unpublished (no rc.116)

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7265 --tags effect,mcp,adapter,refute
```

### f-effect-05 — HOLD: SchemaJIT/AOT #7908 still draft/OPEN (updated in-window Sep 13)

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7908 --tags effect,schema,jit,refute
```

### f-effect-06 — HOLD: drizzle TaggedErrorClass #6162 still OPEN (no update since Aug 25)

```
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,schema,refute
```

### f-effect-07 — HOLD: Instant Cloud sunset 2027-08-31 still holds (essay unchanged)

```
bun run beep research capture https://www.instantdb.com/essays/instant_team_joins_openai --tags instant,local-first,sunset,refute
```

### f-effect-08 — HOLD: jazz-tools alpha tip still 2.0.0-alpha.54; #2748 alpha.55 not cut

```
bun run beep research capture https://www.npmjs.com/package/jazz-tools/v/2.0.0-alpha.54 --tags jazz,local-first,alpha-54,refute
```

### f-effect-09 — HOLD: Evolu #708 still OPEN; @evolu/common@8.11.0 still unpublished

```
bun run beep research capture https://github.com/evoluhq/evolu/pull/708 --tags evolu,local-first,hlc,refute
```

### f-agents-02 — Refute HOLD: MCP #3306 Enterprise IdP / ID-JAG docs still OPEN (no update since Sep 1)

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306 --tags agents,mcp,enterprise,refute
```

### f-agents-03 — Refute HOLD: SEP-3004 Tamper-Evident Audit Record still OPEN; no in-window move toward Final

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3004 --tags agents,mcp,audit,sep-3004,refute
```

### f-agents-04 — Refute HOLD: no new arXiv cs.AI/SE/CR listings since Fri 11 Sep 2026 (weekend gap; no MCP/skills/harness since Sep 12)

```
bun run beep research capture https://arxiv.org/list/cs.AI/new --tags agents,arxiv,refute
```

### f-agents-05 — Refute HOLD: no fresh OpenAI/Anthropic/Cursor skills-over-MCP product news in-window; UHP now Verified Final·PR open (Sep 12)

```
bun run beep research capture https://unifiedharnessprotocol.dev/skills-over-mcp/ --tags agents,mcp,skills,uhp,refute
```

### f-effect-11 — Refute HOLD: jazz-tools tip still alpha.54; #2748 still OPEN staging alpha.55 (updated Sep 13)

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2748 --tags jazz,local-first,alpha-55,refute
```
