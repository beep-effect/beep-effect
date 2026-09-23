---
schema: beep.research.watchlist/v0
updated: 2026-09-23
note: Draft ledger patch. Advance only AFTER human merge of research/2026-09-23. Do not claim merged. Wednesday packet. Prior #1199 merged 2026-09-22.
---

# WATCHLIST

Routine-proposed. Human admits. Add-with-evidence only.

| id | term | why | evidence | action |
| --- | --- | --- | --- | --- |
| w-schema-binary | Effect SchemaBinary / cluster wire | SchemaBinary shipped in rc.113+; tip now rc.117 — watch cluster consumers | effect@4.0.0-rc.117 | keep |
| w-drizzle-taggederror | drizzle Schema.TaggedErrorClass | #6162 still OPEN | drizzle-orm#6162 | keep |
| w-uspto-odp-auth | USPTO ODP profile + API key | four fields still mandatory (live Sep 23) | data.uspto.gov/support 2026-09-23 | keep |
| w-skills-over-mcp | Agent Plugins vs SEP-2640 | **SEP-2640 MERGED Final on main** 2026-09-13; Tier-1 SDKs still OPEN | mcp#2640 merged; sdk PRs OPEN | keep |
| w-trustshift | MCP TrustShift delayed defect | install-time scanners miss it; registry 48.8% initialize | arXiv 2609.10962 | keep |
| w-instant-sunset | Instant Cloud sunset 2027-08-31 | 2027-08-31 unchanged (reconfirmed Sep 23) | instantdb essay | keep |
| w-legal-models-2026-08 | Thomson 1.0 / Harvey Tenet | competitor specialist models + MCP/verify | TR arXiv 2608.27147 | keep |
| w-imanage-mcp-write | iManage MCP write-back | write tools live; platform GA October 2026; TR partnership MCP still coming soon (reconfirmed Sep 23) | iManage docs; partnership page | keep |
| w-daydreaming | Daydreaming skill steal | hosted skills leak via ordinary task results | arXiv 2608.26733 | keep |
| w-blanc-whitespace | BLANC patent white space | multi-view delta-NPMI | arXiv 2608.26685 | keep |
| w-legal-dms-mcp | DMS/research MCP fabric | Split clocks reconfirmed Sep 23: Harvey first-party docs + Everlaw first-party + Harvey↔Everlaw fall 2026 + iManage/TR coming soon + Everlaw↔TR/Copilot/Gemini fall 2026 | Harvey MCP docs; Everlaw; iManage | keep |
| w-deepjudge-ahp | DeepJudge AHP handoff | app to app on MCP; also Astra for Law plugin partner | LawNext 2026-08-13; Astra press | keep |
| w-lawtoolbox-mcp | LawToolBox M365 MCP | 70+ tools over matter containers | lawtoolbox.com/mcp | keep |
| w-harvey-pacerpro | Harvey-PacerPro docket | firm litigation record into Harvey | LawNext 2026-08-24 | keep |
| w-harvey-everlaw-mcp | Harvey-Everlaw MCP evidence bridge | still expected fall 2026; not GA (reconfirmed Sep 23) | harvey.ai blog live Sep 23 | keep |
| w-everlaw-first-party-mcp | Everlaw hosted MCP | api.everlaw.com/v1/mcp OAuth read-only | Everlaw MCP KB | keep |
| w-mcp-enterprise-ig | MCP Enterprise IG | #3306 still OPEN (reconfirmed Sep 23) | mcp#3306 | keep |
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
| w-schema-jit | SchemaJIT/AOT compilers | **SETTLED merged** #7908 Sep 18 — watch npm inclusion via rc.118 | Effect#7908 merged | retire-after-admit |
| w-sep2640-final-unmerged | SEP-2640 Final≠merged | **RETIRED 2026-09-23** Final merged; replaced by w-sep2640-sdk-ship | mcp#2640 merged 2026-09-13 | retired |
| w-zero-canary | Rocicorp Zero canary channel | canary.11 unchanged; also watch head channel | npm zero canary.11 | keep |
| w-patent-kb-connect | patent-kb-connect hosted MCP | 727k US patent MCP created Sep 12 | blazingbunny/patent-kb-connect | keep |
| w-patlytics-mcp | Patlytics MCP Claude+ChatGPT | read-only prior-art/claims MCP foil for Tom | Patlytics blog | keep |
| w-scanners-as-skills | agent-security-auditor / agent-scan skills | CI scanner packaged as installable skills | awesome-llm-apps#1167; registry#23 | keep |
| w-harvey-guardrails | Harvey Guardrails AI acquisition | agent reliability foil (Sep 9) | harvey.ai/blog/guardrails-ai-joins-harvey | keep |
| w-harvey-first-party-mcp | Harvey first-party MCP Server | Vault + knowledge tools; Streamable HTTP + OAuth; Claude/Gemini/Copilot | developers.harvey.ai/guides/harvey_mcp | keep |
| w-arcangel-mcp | Arcangel patents/TM hosted MCP | Cursor plugin + arcb_ bot token; read/draft; no USPTO file | Ga1axia/arcangel-cursor-plugin | keep |
| w-jazz-wire-v2 | Jazz sync wire protocol v2 | alpha.55 required coordinated upgrade; **tip now alpha.56** | jazz-tools@2.0.0-alpha.56 | keep |
| w-sep2640-sdk-ship | SEP-2640 Tier-1 SDK ship gate | go#1238 / python#3485 / ts#2818 still OPEN (Sep 23 activity) | SDK PRs 2026-09-23 | keep |
| w-stochastic-deputy | Stochastic Deputy tenant isolation | remove tenant id from MCP tool schema; bind credential below agent | arXiv 2609.14780 | keep |
| w-intentcap | IntentCap task-scoped capability leases | compose user/workflow/tool/env; Skill/MCP text must not widen authority | arXiv 2609.14631 | keep |
| w-acquirebound | AcquireBound post-fulfillment activation | provenance-bounded runtime auth for acquired resources | arXiv 2609.14744 | keep |
| w-clarra-mcp | Clarra case-management MCP | 120+ tools / 250+ REST; Claude Cowork + write actions | clarra.com press | keep |
| w-after-the-party | Viral skill-registry governance | OpenClaw registry boom then crest; post-viral governance | arXiv 2609.17274 | keep |
| w-legora-ontology | Legora ontology + AI-native citator | limited beta; Q4 GA; intersects neural-symbolic legal research | Legora Sep 14 press | keep |
| w-legora-salesforce | Salesforce global Legora adoption | in-house AmLaw-scale agentic OS signal | Legora Sep 16 press | keep |
| w-effect-httpapi-parse | HttpApi.ParseOptions on main | #8269 MERGED Sep 17; **now in rc.116+** | Effect#8269; npm rc.117 | keep |
| w-effect-http-query | HTTP QUERY method on main | #8261 MERGED Sep 17; **now in rc.116+** | Effect#8261; npm rc.117 | keep |
| w-effect-rc117 | effect@4.0.0-rc.117 tip | tip still rc.117; watch #8336 → rc.118 (refreshed Sep 23) | effect@4.0.0-rc.117; Effect#8336 | keep |
| w-effect-unstable-paths | Effect unstable path removal | #8354 MERGED Sep 22; no compat exports | Effect#8354 | add |
| w-effect-http-api-rename | HttpApi module path rename | #8365 MERGED Sep 22; effect/httpapi → effect/http-api | Effect#8365 | add |
| w-openai-astra-law | OpenAI Astra for Law | Trusted Access still limited; soft press continues | Legal IT Insider 2026-09-17; NeoTeo 2026-09-23 | keep |
| w-jazz-alpha-56 | jazz-tools@2.0.0-alpha.56 tip | tip still alpha.56 (reconfirmed Sep 23) | npm jazz-tools alpha.56 | keep |
| w-sep3004-closed | SEP-3004 closed unmerged | remains closed unmerged (no reopen) | mcp#3004 closed | keep |
| w-rac-auth-drift | RAC authorization drift | arXiv 2609.23498 controller pre-commit guard for MCP workflows | arXiv 2609.23498 | add |
| w-everlaw-mcp-fabric | Everlaw multi-vendor MCP fall 2026 | Harvey + TR CoCounsel + Gemini + Copilot expected fall 2026 | Everlaw ILTACON press | add |
| w-a2m-mcp-hijack | A2M Attraction-to-Manipulation | MCP registry/tool hijack threat on LiveMCPBench | arXiv 2609.26761; github.com/Lilaizhen/A2M | add |
| w-paypal-zt-mcp | PayPal zero-trust MCP extensions | dual-persona + permission-filtered discovery | arXiv 2609.22573 | add |
| w-graphskillevo | GraphSkillEvo graph skills | structured skill IR beyond flat SKILL.md | arXiv 2609.21749 | add |
| w-cimplifi-maestro | Cimplifi Maestro / CI Lake | Relativity aiR orchestration competitor | GlobeNewswire 2026-09-22 | add |
| w-zero-head | Rocicorp Zero head dist-tag | head builds moving daily while canary.11 static | npm @rocicorp/zero head 20260923 | add |
| w-mcp-infra-wg | MCP Infrastructure WG | charter merged Sep 22 | mcp#3385 | add |
| w-sep3371-sdk-ext | SEP-3371 SDK extension points | consistent extension hooks across SDKs | mcp#3371 OPEN | add |
