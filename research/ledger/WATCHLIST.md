---
schema: beep.research.watchlist/v0
updated: 2026-09-30
note: Draft until human merge of research/2026-09-30. Do not claim merged. Prior #1308 merged 2026-09-27. Wednesday catch-up after Sep 28+29 failed automation; ~72h window; no weekly consolidation.
---

# WATCHLIST

Routine-proposed. Human admits. Add-with-evidence only.

| id | term | why | evidence | action |
| --- | --- | --- | --- | --- |
| w-schema-binary | Effect SchemaBinary / cluster wire | SchemaBinary shipped in rc.113+; tip now rc.118 — watch cluster consumers | effect@4.0.0-rc.118 | keep |
| w-drizzle-taggederror | drizzle Schema.TaggedErrorClass | #6162 still OPEN (reconfirmed Sep 30) | drizzle-orm#6162 | keep |
| w-uspto-odp-auth | USPTO ODP profile + API key | four fields still mandatory (reconfirmed Sep 30 via patent.dev) | patent.dev; data.uspto.gov/support | keep |
| w-skills-over-mcp | Agent Plugins vs SEP-2640 | **SEP-2640 MERGED Final on main** 2026-09-13; Tier-1 SDKs still OPEN | mcp#2640 merged; sdk PRs OPEN | keep |
| w-trustshift | MCP TrustShift delayed defect | install-time scanners miss it; registry 48.8% initialize | arXiv 2609.10962 | keep |
| w-instant-sunset | Instant Cloud sunset 2027-08-31 | 2027-08-31 unchanged (reconfirmed Sep 30) | instantdb essay | keep |
| w-legal-models-2026-08 | Thomson 1.0 / Harvey Tenet | competitor specialist models + MCP/verify | TR arXiv 2608.27147 | keep |
| w-imanage-mcp-write | iManage MCP write-back | write tools live; platform GA October 2026; TR partnership MCP still coming soon; ChatGPT plugin foil noted (reconfirmed Sep 30) | iManage docs; partnership page | keep |
| w-daydreaming | Daydreaming skill steal | hosted skills leak via ordinary task results | arXiv 2608.26733 | keep |
| w-blanc-whitespace | BLANC patent white space | multi-view delta-NPMI | arXiv 2608.26685 | keep |
| w-legal-dms-mcp | DMS/research MCP fabric | Split clocks reconfirmed Sep 25: Harvey first-party docs + Everlaw first-party + Harvey↔Everlaw fall 2026 + iManage/TR coming soon + Everlaw↔TR/Copilot/Gemini fall 2026 | Harvey MCP docs; Everlaw; iManage | keep |
| w-deepjudge-ahp | DeepJudge AHP handoff | app to app on MCP; also Astra for Law plugin partner | LawNext 2026-08-13; Astra press | keep |
| w-lawtoolbox-mcp | LawToolBox M365 MCP | 70+ tools over matter containers | lawtoolbox.com/mcp | keep |
| w-harvey-pacerpro | Harvey-PacerPro docket | firm litigation record into Harvey | LawNext 2026-08-24 | keep |
| w-harvey-everlaw-mcp | Harvey-Everlaw MCP evidence bridge | still expected fall 2026; not GA (reconfirmed Sep 30) | harvey.ai blog live Sep 27 | keep |
| w-everlaw-first-party-mcp | Everlaw hosted MCP | api.everlaw.com/v1/mcp OAuth read-only | Everlaw MCP KB | keep |
| w-mcp-enterprise-ig | MCP Enterprise IG | #3306 still OPEN/blocked (reconfirmed Sep 30) | mcp#3306 | keep |
| w-jazz-wire-v1 | Jazz sync wire | **RETIRED 2026-09-23** superseded by alpha.56 / w-jazz-wire-v2 | jazz-tools@2.0.0-alpha.55 | retired |
| w-uspto-oed-ai | USPTO OED AI discipline | first generative-AI-predicated order | IPWatchdog D2026-16 | keep |
| w-rayrun-sep2640 | Rayrun SEP-2640 host | host implements draft skills/list+get | ray.run/docs/skills | keep |
| w-effect-rc115 | effect@4.0.0-rc.115 tip | **RETIRED 2026-09-23** tip past to rc.117 | effect@4.0.0-rc.117 | retired |
| w-effect-mcp-adapter | Effect MCP 2026-07-28 adapter | **RETIRED 2026-09-23** publish gap closed via rc.116+ | Effect#7265; npm rc.117 | retired |
| w-effect-rc116 | effect@4.0.0-rc.116 staged | **RETIRED 2026-09-23** shipped; tip past to rc.117 | Effect#8201 merged; npm rc.117 | retired |
| w-skillscan | agent-skill-security-scanner | offline fail-closed static scanner | harness-eval 2609.07360 | keep |
| w-agent-plugins-coevo | Agent Plugins co-evolution | HookPry + Scanning the Harness | arXiv 2609.03884, 2609.07360 | keep |
| w-public-law-mcp | Public-law jurisdiction MCP | Iceland PoC + german-legal-mcp | metaneutrons/german-legal-mcp | keep |
| w-skillshift | SkillShift / Skill Policy Integrity | covert utility-preserving skill steering | arXiv 2609.02564 | keep |
| w-acle-effect-closure | ACLE-MCP + effect closure | invocation-time leases; SEP-3004 **CLOSED unmerged** Sep 22 | mcp#3004 closed; arXiv 2609.02690 | keep |
| w-repo-to-skill | DisCo Repo-To-Skill / AREX-Skill | author-reported verified skill library | arXiv 2609.02749; 2609.11682 | keep |
| w-hookpry | HookPry lifecycle-hook supply chain | attacker-controlled lifecycle-hook updates | arXiv 2609.03884 | keep |
| w-skill-scanner-cel | Cisco skill-scanner CEL shadow layer | shadow CEL decision layer | cisco skill-scanner#210 | keep |
| w-swe-gate | SWE-Gate review-constraint gap | functional success != review-constraint compliance | arXiv 2609.04167 | keep |
| w-harness-scan | Scanning the Harness defect rates | 16% confirmed security defects | arXiv 2609.07360 | keep |
| w-trajmark | TrajMark trajectory watermark | ownership + segment tamper localization | arXiv 2609.10416 | keep |
| w-openai-skills-snapshot | OpenAI Skills-over-MCP snapshot import | ships scan-time import into plugins | arcade.dev 2026-09-08 | keep |
| w-mcp-registry-draw | MCP registry unrepaired sample | 48.8% initialize; 37.5% never start | arXiv 2609.10962 | keep |
| w-cobra-skills | COBRA-Skills bandit skill evolution | budgeted skill optimization | arXiv 2609.11682 | keep |
| w-nobox-mcp | No-Box MCP prompt-injection scan | description-only IPI detection | arXiv 2609.10854 | keep |
| w-schema-jit | SchemaJIT/AOT compilers | **RETIRED 2026-09-30** #7908 ships in effect@4.0.0-rc.118 (SchemaJITCompiler export) | effect@4.0.0-rc.118 dist/schema/index.d.ts | retired |
| w-sep2640-final-unmerged | SEP-2640 Final≠merged | **RETIRED 2026-09-23** Final merged; replaced by w-sep2640-sdk-ship | mcp#2640 merged 2026-09-13 | retired |
| w-zero-canary | Rocicorp Zero canary channel | canary.15 → **canary.20** (2026-09-30) | npm @rocicorp/zero 1.11.0-canary.20 | keep |
| w-patent-kb-connect | patent-kb-connect hosted MCP | 727k US patent MCP created Sep 12 | blazingbunny/patent-kb-connect | keep |
| w-patlytics-mcp | Patlytics MCP Claude+ChatGPT | read-only prior-art/claims MCP foil for Tom | Patlytics blog | keep |
| w-scanners-as-skills | agent-security-auditor / agent-scan skills | CI scanner packaged as installable skills | awesome-llm-apps#1167; registry#23 | keep |
| w-harvey-guardrails | Harvey Guardrails AI acquisition | agent reliability foil (Sep 9) | harvey.ai/blog/guardrails-ai-joins-harvey | keep |
| w-harvey-first-party-mcp | Harvey first-party MCP Server | Vault + knowledge tools; Streamable HTTP + OAuth; Claude/Gemini/Copilot | developers.harvey.ai/guides/harvey_mcp | keep |
| w-arcangel-mcp | Arcangel patents/TM hosted MCP | Cursor plugin + arcb_ bot token; read/draft; no USPTO file | Ga1axia/arcangel-cursor-plugin | keep |
| w-jazz-wire-v2 | Jazz sync wire protocol v2 | still wire-v2 at alpha.58 (reconfirmed Sep 30) | jazz-tools@2.0.0-alpha.58 | keep |
| w-sep2640-sdk-ship | SEP-2640 Tier-1 SDK ship gate | go#1238 / py#3485 / ts#2818 still OPEN (reconfirmed Sep 30) | SDK PRs 2026-09-30 | keep |
| w-stochastic-deputy | Stochastic Deputy tenant isolation | remove tenant id from MCP tool schema; bind credential below agent | arXiv 2609.14780 | keep |
| w-intentcap | IntentCap task-scoped capability leases | compose user/workflow/tool/env; Skill/MCP text must not widen authority | arXiv 2609.14631 | keep |
| w-acquirebound | AcquireBound post-fulfillment activation | provenance-bounded runtime auth for acquired resources | arXiv 2609.14744 | keep |
| w-clarra-mcp | Clarra case-management MCP | 120+ tools / 250+ REST; Claude Cowork + write actions | clarra.com press | keep |
| w-after-the-party | Viral skill-registry governance | OpenClaw registry boom then crest; post-viral governance | arXiv 2609.17274 | keep |
| w-legora-ontology | Legora ontology + AI-native citator | citator still limited beta / Q4 GA (Beri Sep 26); ALI Restatements partnership remains the ontology signal | Legora ALI press; beri.net Sep 26 | keep |
| w-legora-salesforce | Salesforce global Legora adoption | Bradley + Veolia + Brodies + Justice Connect extend AmLaw/enterprise OS cluster | Legora newsroom Sep 23–25 | keep |
| w-effect-httpapi-parse | HttpApi.ParseOptions on main | #8269 MERGED Sep 17; **now in rc.116+** | Effect#8269; npm rc.117 | keep |
| w-effect-http-query | HTTP QUERY method on main | #8261 MERGED Sep 17; **now in rc.116+** | Effect#8261; npm rc.117 | keep |
| w-effect-rc117 | effect@4.0.0-rc.117 tip | **RETIRED 2026-09-30** tip moved to effect@4.0.0-rc.118 (#8336 MERGED Sep 28); replaced by w-effect-rc118 | effect@4.0.0-rc.118; Effect#8336 | retire-after-admit |
| w-effect-unstable-paths | Effect unstable path removal | #8354 MERGED Sep 22; no compat exports | Effect#8354 | keep |
| w-effect-http-api-rename | HttpApi module path rename | #8365 MERGED Sep 22; effect/httpapi → effect/http-api | Effect#8365 | keep |
| w-openai-astra-law | OpenAI Astra for Law | Trusted Access still limited; soft press continues | Legal IT Insider 2026-09-17; NeoTeo 2026-09-23 | keep |
| w-jazz-alpha-56 | jazz-tools@2.0.0-alpha.56 tip | **RETIRED 2026-09-27** tip past to alpha.57; replaced by w-jazz-alpha-57 | jazz-tools@2.0.0-alpha.57 | retired |
| w-sep3004-closed | SEP-3004 closed unmerged | remains closed unmerged (reconfirmed Sep 30; no reopen) | mcp#3004 closed | keep |
| w-rac-auth-drift | RAC authorization drift | arXiv 2609.23498 controller pre-commit guard for MCP workflows | arXiv 2609.23498 | keep |
| w-everlaw-mcp-fabric | Everlaw multi-vendor MCP fall 2026 | Harvey + TR CoCounsel + Gemini + Copilot expected fall 2026 | Everlaw ILTACON press | keep |
| w-a2m-mcp-hijack | A2M Attraction-to-Manipulation | MCP registry/tool hijack threat on LiveMCPBench | arXiv 2609.26761; github.com/Lilaizhen/A2M | add |
| w-paypal-zt-mcp | PayPal zero-trust MCP extensions | dual-persona + permission-filtered discovery | arXiv 2609.22573 | add |
| w-graphskillevo | GraphSkillEvo graph skills | structured skill IR beyond flat SKILL.md | arXiv 2609.21749 | add |
| w-cimplifi-maestro | Cimplifi Maestro / CI Lake | Relativity aiR orchestration competitor | GlobeNewswire 2026-09-22 | add |
| w-zero-head | Rocicorp Zero head dist-tag | head tip 1.11.0-head-cb19d9a9-20260930 | npm @rocicorp/zero head 20260930 | keep |
| w-mcp-infra-wg | MCP Infrastructure WG | charter merged Sep 22 | mcp#3385 | add |
| w-sep3371-sdk-ext | SEP-3371 SDK extension points | consistent extension hooks across SDKs | mcp#3371 OPEN | add |
| w-legora-amlaw-cluster | Legora AmLaw / enterprise rollout cluster | Bradley firm-wide + Brodies Scotland HQ + Justice Connect + Veolia Group Legal in one ~47h window | Legora newsroom Sep 23–25 | add |
| w-legora-ali-restatements | Legora × ALI Restatements | Restatements into research platform — ontology/citator grounding | Legora ALI press Sep 23 | add |
| w-everlaw-adoption-2026 | Everlaw 2026 Legal AI Adoption Report | 49% genAI; billable-hour pressure; ~30% multi-agent pilots | Everlaw/ACEDS/ILTA report Sep 24 | add |
| w-hexis-fsm-skills | HEXIS FSM skill compile | skills → extended FSMs; +16.1pp vs Skill+ReAct | arXiv 2609.30123 | add |
| w-dow-billable-state | Persistent Billable State / DoW | MCP tool-return cost attacks; CAF up to 14,293×; sparse safeguard proxies | arXiv 2609.28585 | add |
| w-approval-laundering | Agent Approval Laundering | entry-invocation approvals omit transitive effects; effect-bound records | arXiv 2609.28586 | add |
| w-progressive-skill-discovery | Progressive Skill Discovery | role-scoped capability delivery as access control | arXiv 2609.28693 | add |
| w-argus-employment-ekg | ARGUS employment-discrimination event KGs | CourtListener complaints → document-level Event KGs | arXiv 2609.30184 | add |
| w-effect-httpapi-query-docs | HttpApi QUERY Swagger/Scalar | #8292 still OPEN/dirty (reconfirmed Sep 30); docs surface for QUERY | Effect#8292 | keep |
| w-evolu-8110 | @evolu/common@8.11.0 shipped | **RETIRED 2026-09-30** tip past to 8.12.0; replaced by w-evolu-8120 | npm @evolu/common@8.12.0 | retire-after-admit |
| w-beri-buyer-guide-2026-09 | Beri Harvey/CoCounsel/Legora GC guide | library>model; pricing checked Sep 27; Agent Pro metering | beri.net Sep 26 | add |
| w-chatgpt-legal-plugins | Everlaw + Legora + iManage ChatGPT Enterprise plugins | iManage ChatGPT Enterprise added to the Everlaw+Legora set; plugin path live while cross-vendor MCP GA pending | Everlaw blog; Legora newsroom; iManage | keep |
| w-specharness | SpecHarness / State Authority Principle | agents propose; runtime commits; SkillsBench gaps shrink | arXiv 2609.29921 | add |
| w-instrumental-evasion | Instrumental Monitor Evasion / EvasionBench | ordinary task pressure → monitor bypass ≤98% attempt | arXiv 2609.30217; instrumental-evasion.com | add |
| w-haqq-legal-ai-rubric | HAQQ 50-point Harvey/Legora/CoCounsel rubric | soft competitive scoring foil | haqq.ai | add |
| w-jazz-alpha-57 | jazz-tools@2.0.0-alpha.57 tip | **RETIRED 2026-09-30** tip past to alpha.58; replaced by w-jazz-alpha-58 | npm jazz-tools@2.0.0-alpha.58 | retire-after-admit |
| w-effect-rc118 | effect@4.0.0-rc.118 tip | tip effect@4.0.0-rc.118; watch #8577 for rc.119 | effect@4.0.0-rc.118; Effect#8577 | add |
| w-effect-rc119 | effect@4.0.0-rc.119 staging | #8577 OPEN staging rc.119 (updated Sep 30) | Effect#8577 | add |
| w-jazz-alpha-58 | jazz-tools@2.0.0-alpha.58 tip | tip alpha.58; wire-v2 still applies | npm jazz-tools@2.0.0-alpha.58 | add |
| w-evolu-8120 | @evolu/common@8.12.0 shipped | maxMutationSize + relay fixes | npm @evolu/common@8.12.0 | add |
| w-legora-uk-scholars | Legora UK Legal AI Scholars | King's/City/BPP + clinic live cases; SRA AI warning framing | Legora newsroom Sep 29 | add |
| w-legora-munich-dach | Legora Munich / DACH growth | Germany 3k→13k; in-house 8×; Munich office | Legora newsroom Sep 28 | add |
| w-skilllite | SKILLLITE malicious skill audit | compact-LLM skill supply-chain auditing | arXiv 2609.36879 | add |
| w-latent-monitor-evasion | Latent monitor evasion from feedback | activation-monitor feedback channel | arXiv 2609.36490 | add |
| w-assay-evidence-graph | Assay content-addressed evidence graphs | accountable AI-assisted delivery | arXiv 2609.36170 | add |
| w-sage-skill-gate | SAGE statistical skill-edit gate | self-evolving skill document acceptance | arXiv 2609.36043 | add |
| w-agentbug-smith | AgentBug-Smith harness bugs | automated harness-bug reproduction | arXiv 2609.37864 | add |
| w-workday-prog-skills | Workday progressive skill disclosure | production cost study of lazy skill loading | arXiv 2609.35692 | add |
