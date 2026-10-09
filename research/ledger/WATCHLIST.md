---
schema: beep.research.watchlist/v0
updated: 2026-10-09
note: Draft until human merge of research/2026-10-09. ~24h window; Friday (no weekly); no tombstones.
---

# WATCHLIST

Routine-proposed. Human admits. Add-with-evidence only.

| id | term | why | evidence | action |
| --- | --- | --- | --- | --- |
| w-schema-binary | Effect SchemaBinary / cluster wire | SchemaBinary shipped; cluster shutdown/shard-handoff series merged Oct 8–9 (unreleased past 4.0.2) | effect@4.0.2; Effect#8941 | keep |
| w-drizzle-taggederror | drizzle Schema.TaggedErrorClass | #6162 still OPEN (reconfirmed Oct 3) | drizzle-orm#6162 | keep |
| w-uspto-odp-auth | USPTO ODP profile + API key | four fields still mandatory (govdelivery) | USPTO govdelivery 421c568 | keep |
| w-skills-over-mcp | Agent Plugins vs SEP-2640 | **SEP-2640 MERGED Final on main** 2026-09-13; Tier-1 SDKs still OPEN; vendor productization: Legora Skills; research: arXiv 2610.04832 | mcp#2640 merged; sdk PRs OPEN; Legora; arXiv | keep |
| w-trustshift | MCP TrustShift delayed defect | install-time scanners miss it; registry 48.8% initialize | arXiv 2609.10962 | keep |
| w-instant-sunset | Instant Cloud sunset 2027-08-31 | still 2027-08-31 (reconfirmed Oct 3) | instantdb essay | keep |
| w-legal-models-2026-08 | Thomson 1.0 / Harvey Tenet | competitor specialist models + MCP/verify | TR arXiv 2608.27147 | keep |
| w-imanage-mcp-write | iManage MCP write-back | Legora native iManage Cloud read + save-back live (Oct 2); TR MCP still coming soon | legora.com/blog/your-imanage-in-legora | keep |
| w-daydreaming | Daydreaming skill steal | hosted skills leak via ordinary task results | arXiv 2608.26733 | keep |
| w-blanc-whitespace | BLANC patent white space | multi-view delta-NPMI | arXiv 2608.26685 | keep |
| w-legal-dms-mcp | DMS/research MCP fabric | Split clocks reconfirmed Oct 2: Harvey first-party docs + Everlaw first-party + Harvey↔Everlaw fall 2026 + iManage/TR coming soon + Everlaw↔TR/Copilot/Gemini fall 2026; NetDocuments↔Copilot MCP live (Oct 5, ndMAX Enterprise) | Harvey MCP docs; Everlaw; iManage; Conventus Law Oct 5 | keep |
| w-deepjudge-ahp | DeepJudge AHP handoff | app to app on MCP; also Astra for Law plugin partner | LawNext 2026-08-13; Astra press | keep |
| w-lawtoolbox-mcp | LawToolBox M365 MCP | 70+ tools over matter containers | lawtoolbox.com/mcp | keep |
| w-harvey-pacerpro | Harvey-PacerPro docket | firm litigation record into Harvey | LawNext 2026-08-24 | keep |
| w-harvey-everlaw-mcp | Harvey-Everlaw MCP evidence bridge | still fall 2026, not GA (reconfirmed Oct 8 via Everlaw URL) | everlaw.com blog Aug 27 | keep |
| w-everlaw-first-party-mcp | Everlaw hosted MCP | api.everlaw.com/v1/mcp OAuth read-only | Everlaw MCP KB | keep |
| w-mcp-enterprise-ig | MCP Enterprise IG | #3306 still OPEN/blocked (reconfirmed Oct 3) | mcp#3306 | keep |
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
| w-zero-canary | Rocicorp Zero canary channel | tip **canary.29 → canary.34**; latest dist-tag is now 1.10.0 stable | npm @rocicorp/zero 1.11.0-canary.34 | keep |
| w-patent-kb-connect | patent-kb-connect hosted MCP | 727k US patent MCP created Sep 12 | blazingbunny/patent-kb-connect | keep |
| w-patlytics-mcp | Patlytics MCP Claude+ChatGPT | still Claude+ChatGPT read-only (reconfirmed Oct 3) | Patlytics blog | keep |
| w-scanners-as-skills | agent-security-auditor / agent-scan skills | CI scanner packaged as installable skills | awesome-llm-apps#1167; registry#23 | keep |
| w-harvey-guardrails | Harvey Guardrails AI acquisition | agent reliability foil (Sep 9) | harvey.ai/blog/guardrails-ai-joins-harvey | keep |
| w-harvey-first-party-mcp | Harvey first-party MCP Server | Vault + knowledge tools; Streamable HTTP + OAuth; Claude/Gemini/Copilot | developers.harvey.ai/guides/harvey_mcp | keep |
| w-arcangel-mcp | Arcangel patents/TM hosted MCP | Cursor plugin + arcb_ bot token; read/draft; no USPTO file | Ga1axia/arcangel-cursor-plugin | keep |
| w-jazz-wire-v2 | Jazz sync wire protocol v2 | still wire-v2 at alpha.58 (reconfirmed Oct 2; unchanged) | jazz-tools@2.0.0-alpha.58 | keep |
| w-sep2640-sdk-ship | SEP-2640 Tier-1 SDK ship gate | py#3485 still OPEN (reconfirmed Oct 9, last update 2026-10-07); go#1238 dirty; ts#2818 draft (tombstoned capture) | SDK PRs | keep |
| w-stochastic-deputy | Stochastic Deputy tenant isolation | remove tenant id from MCP tool schema; bind credential below agent | arXiv 2609.14780 | keep |
| w-intentcap | IntentCap task-scoped capability leases | compose user/workflow/tool/env; Skill/MCP text must not widen authority | arXiv 2609.14631 | keep |
| w-acquirebound | AcquireBound post-fulfillment activation | provenance-bounded runtime auth for acquired resources | arXiv 2609.14744 | keep |
| w-clarra-mcp | Clarra case-management MCP | 120+ tools / 250+ REST; Claude Cowork + write actions | clarra.com press | keep |
| w-after-the-party | Viral skill-registry governance | OpenClaw registry boom then crest; post-viral governance | arXiv 2609.17274 | keep |
| w-legora-ontology | Legora ontology + AI-native citator | citator still limited beta / Q4 GA (Beri Sep 26); ALI Restatements partnership remains the ontology signal; Legora Skills GA (Markdown skills, 250+ library) | Legora ALI press; beri.net Sep 26; legora.com/blog/introducing-skills | keep |
| w-legora-salesforce | Salesforce global Legora adoption | Bradley + Veolia + Brodies + Justice Connect extend AmLaw/enterprise OS cluster | Legora newsroom Sep 23–25 | keep |
| w-effect-httpapi-parse | HttpApi.ParseOptions on main | #8269 MERGED Sep 17; **now in rc.116+** | Effect#8269; npm rc.117 | keep |
| w-effect-http-query | HTTP QUERY method on main | #8261 MERGED Sep 17; **now in rc.116+** | Effect#8261; npm rc.117 | keep |
| w-effect-rc117 | effect@4.0.0-rc.117 tip | **RETIRED 2026-09-30** tip moved to effect@4.0.0-rc.118 (#8336 MERGED Sep 28); replaced by w-effect-rc118 | effect@4.0.0-rc.118; Effect#8336 | retire-after-admit |
| w-effect-unstable-paths | Effect unstable path removal | #8354 MERGED Sep 22; no compat exports | Effect#8354 | keep |
| w-effect-http-api-rename | HttpApi module path rename | #8365 MERGED Sep 22; effect/httpapi → effect/http-api | Effect#8365 | keep |
| w-openai-astra-law | OpenAI Astra for Law | Trusted Access still limited; soft press continues | Legal IT Insider 2026-09-17; NeoTeo 2026-09-23 | keep |
| w-jazz-alpha-56 | jazz-tools@2.0.0-alpha.56 tip | **RETIRED 2026-09-27** tip past to alpha.57; replaced by w-jazz-alpha-57 | jazz-tools@2.0.0-alpha.57 | retired |
| w-sep3004-closed | SEP-3004 closed unmerged | still closed unmerged (reconfirmed Oct 3) | mcp#3004 | keep |
| w-rac-auth-drift | RAC authorization drift | arXiv 2609.23498 controller pre-commit guard for MCP workflows | arXiv 2609.23498 | keep |
| w-everlaw-mcp-fabric | Everlaw multi-vendor MCP fall 2026 | Harvey + TR CoCounsel + Gemini + Copilot expected fall 2026; not GA (reconfirmed Oct 2) | Everlaw ILTACON press | keep |
| w-a2m-mcp-hijack | A2M Attraction-to-Manipulation | MCP registry/tool hijack threat on LiveMCPBench | arXiv 2609.26761; github.com/Lilaizhen/A2M | add |
| w-paypal-zt-mcp | PayPal zero-trust MCP extensions | dual-persona + permission-filtered discovery | arXiv 2609.22573 | add |
| w-graphskillevo | GraphSkillEvo graph skills | structured skill IR beyond flat SKILL.md | arXiv 2609.21749 | add |
| w-cimplifi-maestro | Cimplifi Maestro / CI Lake | Relativity aiR orchestration competitor | GlobeNewswire 2026-09-22 | add |
| w-zero-head | Rocicorp Zero head dist-tag | ~10 head builds in the Oct 9 window after latest moved to 1.10.0; prior head tag 79adc09f-20261008 not re-read | npm @rocicorp/zero | keep |
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
| w-chatgpt-legal-plugins | Everlaw + Legora + iManage ChatGPT Enterprise plugins | plugin path live while cross-vendor MCP pending (reconfirmed Oct 2) | Everlaw blog; Legora newsroom; iManage | keep |
| w-specharness | SpecHarness / State Authority Principle | agents propose; runtime commits; SkillsBench gaps shrink | arXiv 2609.29921 | add |
| w-instrumental-evasion | Instrumental Monitor Evasion / EvasionBench | ordinary task pressure → monitor bypass ≤98% attempt | arXiv 2609.30217; instrumental-evasion.com | add |
| w-haqq-legal-ai-rubric | HAQQ 50-point Harvey/Legora/CoCounsel rubric | soft competitive scoring foil | haqq.ai | add |
| w-jazz-alpha-57 | jazz-tools@2.0.0-alpha.57 tip | **RETIRED 2026-09-30** tip past to alpha.58; replaced by w-jazz-alpha-58 | npm jazz-tools@2.0.0-alpha.58 | retire-after-admit |
| w-effect-rc118 | effect@4.0.0-rc.118 tip | **RETIRED 2026-10-02** effect@4.0.0 latest; tip past rc.118; replaced by w-effect-400 | npm effect@4.0.0; effect.website/blog/releases/effect/40 | retire-after-admit |
| w-effect-rc119 | effect@4.0.0-rc.119 staging | **RETIRED 2026-10-02** #8577 shipped 4.0.0; no rc.119 published | Effect#8577; npm effect@4.0.0 | retired |
| w-jazz-alpha-58 | jazz-tools@2.0.0-alpha.58 tip | **RETIRED 2026-10-06** — tip past to alpha.59; replace with w-jazz-alpha-59 | jazz v2.0.0-alpha.59 | retire-after-admit |
| w-evolu-8120 | @evolu/common@8.12.0 shipped | **RETIRED 2026-10-02** tip past to 8.15.1; replaced by w-evolu-8151 | npm @evolu/common@8.15.1 | retire-after-admit |
| w-legora-uk-scholars | Legora UK Legal AI Scholars | Legal Cheek Oct 2 secondary + newsroom still live | Legal Cheek; Legora newsroom | keep |
| w-legora-munich-dach | Legora Munich / DACH growth | Germany 3k→13k; in-house 8×; Munich office | Legora newsroom Sep 28 | add |
| w-skilllite | SKILLLITE malicious skill audit | compact-LLM skill supply-chain auditing | arXiv 2609.36879 | add |
| w-latent-monitor-evasion | Latent monitor evasion from feedback | activation-monitor feedback channel | arXiv 2609.36490 | add |
| w-assay-evidence-graph | Assay content-addressed evidence graphs | accountable AI-assisted delivery | arXiv 2609.36170 | add |
| w-sage-skill-gate | SAGE statistical skill-edit gate | self-evolving skill document acceptance | arXiv 2609.36043 | add |
| w-agentbug-smith | AgentBug-Smith harness bugs | automated harness-bug reproduction | arXiv 2609.37864 | add |
| w-workday-prog-skills | Workday progressive skill disclosure | production cost study of lazy skill loading | arXiv 2609.35692 | add |
| w-effect-400 | effect@4.0.x stable LTS tip | tip still **4.0.2**; unreleased main Oct 8–9 (DNS #8880/#8953, MCP subs #8924/#8925, OTel parent #8929, cluster shutdown, JSON Schema bounds #8956) | Effect release effect@4.0.2; Effect#8880 | keep |
| w-evolu-8151 | @evolu/common@8.15.1 tip | **RETIRED 2026-10-03** tip past to 8.17.0; replaced by w-evolu-8170 | npm @evolu/common@8.17.0 | retire-after-admit |
| w-apex-skill-chain | APEX cross-skill hijack | approval-laundering via skill handoff records; 74% ASR | arXiv 2610.01564 | add |
| w-pace-provenance | PACE provenance capability enforcement | admission-time vetting insufficient | arXiv 2610.01349 | add |
| w-mcri-skill-eval | MCRI skill evaluation framework | four-dimensional skill analysis | arXiv 2610.01506 | add |
| w-pretext-scanner-evasion | Pretext malicious-skill detection defeat | scanner-evasion rising edge | arXiv 2609.39607 | add |
| w-actionguard-poisoned | ActionGuard tool-call auth under poisoned skills | execution-boundary auth | arXiv 2609.39450 | add |
| w-clio-learned-hand | Clio × Learned Hand judiciary AI | ABA Journal Oct 1 coverage; Cert citator blog adjacent | ABA Journal; Clio Cert blog | keep |
| w-ca-sb574 | California SB 574 attorney genAI statute | compliance clock Jan 1 2027 | CA.gov; H&K Oct 1 | add |
| w-evolu-8170 | @evolu/common@8.17.0 tip | **RETIRED 2026-10-06** — tip past to 8.18.0; replace with w-evolu-8180 | @evolu/common@8.18.0 | retire-after-admit |
| w-effect-410-staging | effect@4.1.0 changeset #8647 | **RETIRED 2026-10-06** — #8647 merged 2026-10-04 as **4.0.1 patch**, no 4.1.0 | Effect#8647; effect@4.0.1 | retire-after-admit |
| w-effect-cloudflare-clef | @effect/ai-cloudflare Clef | @effect/ai-cloudflare@4.0.1 published; #8832 DecisionModel images | npm @effect/ai-cloudflare 4.0.1; Effect#8832 | add |
| w-clio-cert | Clio Cert AI-native citator | detection/anchoring service for Vincent/agents | Clio Enterprise blog Oct 1 | add |
| w-defa-failure-attr | DeFA dependency-guided failure attribution | agent failure localization across long traces | arXiv 2610.01256 | add |
| w-effect-402-staging | effect@4.0.2 changeset #8744 | **RETIRED 2026-10-08** — shipped effect@4.0.2 (Oct 7) incl. #8842; replaced by w-effect-400 tip | effect@4.0.2 release | retire-after-admit |
| w-jazz-alpha-59 | jazz-tools@2.0.0-alpha.59 tip | reconfirmed Oct 9: alpha dist-tag still 2.0.0-alpha.59 | npm jazz-tools@2.0.0-alpha.59 | keep |
| w-evolu-8180 | @evolu/common@8.18.0 + relay 4.2.2 | **RETIRED 2026-10-08** — tip past to 8.19.0; replace with w-evolu-8190 | @evolu/common@8.19.0 | retire-after-admit |
| w-tanstack-db-012 | TanStack DB 0.12 accepted/visible sync split | tip still **0.12.3** (reconfirmed Oct 9; published 2026-10-07) | npm @tanstack/db 0.12.3 | keep |
| w-legora-skills | Legora Skills product surface | enablement sessions Oct 14–15; "first" framing contested (renamed workflows per practitioner) | legora.com/blog/introducing-skills; X @WeAreLegora; X @willchen500 | add |
| w-netdocs-copilot-mcp | NetDocuments↔Copilot MCP | governed DMS MCP live | Conventus Law Oct 5 | add |
| w-tr-ross-cert | TR v ROSS cert petition | intent announced; no petition found as of Oct 8 | LawSites Oct 2 | add |
| w-uspto-si-roundtable | USPTO SI vendor roundtable Oct 15 | procurement signal; RSVP Oct 7 | FedSift USPTO-26-RFI001 | add |
| w-crime-skill-composition | CRIME benign-skill composition attack | composition risk beyond single-skill vetting | arXiv 2610.05943 | add |
| w-swe-cc | SWE-CC repo-policy compliance | coding-agent governance benchmark | arXiv 2610.06193 | add |
| w-mcp-local-security | MCP Local Server Security guide | stdio single trust domain guidance | mcp#3072 | add |
| w-harvey-mcp-policy-engine | Harvey MCP Policy Engine | Tool Pinner (pin + diff tool descriptions/schemas) + Sanitizer + out-of-model policies | harvey.ai blog Oct 7 | add |
| w-tsc-rs | tsc-rs (pingdotgg/ts-rust) Rust TS7 port | Effect diagnostics built in (tsgo 0.46.1 port); 1.61x vs tsc 7 on T3 Code | github pingdotgg/ts-rust; npm tsc-rs 0.1.0 | add |
| w-effect-tsgo | @effect/tsgo minor cadence | 0.49.0 → 0.51.1 in ~24h (Oct 6–7) | npm @effect/tsgo 0.51.1 | add |
| w-mcp-ts-oauth-issuer | MCP TS SDK OAuth issuer binding | GHSA-6qxp-vccf-f47h / CVE-2026-104850; npm latest still 1.32.1 (published 2026-10-05); no newer patch in the Oct 9 window | GHSA-6qxp-vccf-f47h; npm @modelcontextprotocol/sdk | keep |
| w-sep2127-server-cards | SEP-2127 MCP Server Cards | merged Oct 6; .well-known/ai-catalog.json discovery | mcp#2127 | add |
| w-evolu-8190 | @evolu/common@8.19.0 tip | DatabaseHeldError (exhaustive EvoluError switches) | @evolu/common@8.19.0 | add |
| w-legora-bmw | Legora × BMW Group | enterprise in-house DACH; >13,000 German users | Legora newsroom Oct 8 | add |
| w-ivo-sage | Ivo Sage open contract model | open weights on DeepSeek V4 Flash | Artificial Lawyer Oct 7 | add |
| w-harness-security-bench | HarnessSecurity-Bench | auto-approve 29.2% → 95.6% ASR across six harnesses | arXiv 2610.07639 | add |
| w-packhallu | PackHallu rule-file dependency substitution | AGENTS.md/.cursorrules supply-chain injection | arXiv 2610.09264 | add |
| w-google-patent-rct | Google/NBER patent-drafting RCT | quality +0.34/+0.38 SD; juniors no unassisted gain | Google Research blog Oct 7; NBER w35720 | add |
| w-embeddinggemma2 | EmbeddingGemma 2 | open multimodal on-device embeddings; Google AI Edge Foresight ships an offline Mac notetaker on it | Google blog Oct 6; TechCrunch Oct 8 | keep |
| w-harvey-lab-aa | Harvey LAB-AA v1.1 hallucination gate | headline all-pass in single digits; checker model swings counts ~8× | AA LAB-AA v1.1; AI Primer Oct 8 | add |
| w-harvey-lexis-mtd | Harvey × LexisNexis Motion to Dismiss | first co-developed agentic workflow; summary-judgment workflow next | harvey.ai blog Oct 7–8 | add |
| w-harvey-wake-sleep | Harvey wake-sleep memory | all-pass 2.9% → 15.7% over 10 cycles; ~2.5× tool calls | Harvey X Oct 8; ZenML | add |
| w-usa-today-openai | USA Today v OpenAI copyright | SDNY 1:26-cv-08892; >$250M; DMCA 1202 | The Verge; Bloomberg Law Oct 8 | add |
| w-ropes-ai-hours | Big-firm AI hours inside billable targets | Ropes & Gray up to 100 Innovation Hours; Akerman similar | Finance Time Oct 8 | add |
| w-cited-not-consulted | Cited but Not Consulted | models name the authority and the verdict often ignores the swap | arXiv 2610.12361 | add |
| w-parcel | PARCEL legal citation NLI | public Supported/Refuted/Not Found analogue to LAB-AA's private gate | arXiv 2610.10971 | add |
| w-effect-dns-net | effect/net DNS + TLSA | merged on main, unreleased past effect@4.0.2 | Effect#8880; Effect#8953 | add |
| w-effect-mcp-subs | Effect HTTP MCP subscriptions | servers can disable subscriptions; spurious list-change fix | Effect#8924; Effect#8925 | add |
| w-effect-cluster-shutdown | Effect cluster shutdown / shard handoff | ~9 PRs Oct 8–9 on v3 and v4; unreleased | Effect#8941 | add |
| w-zero-110-stable | @rocicorp/zero 1.10.0 stable | npm latest left the canary-only watch; canary.34 continues | npm @rocicorp/zero | add |
| w-google-foresight | Google AI Edge Foresight | offline Mac meeting notes on EmbeddingGemma 2 | TechCrunch; The Verge Oct 8 | add |
| w-claude-code-2295 | Claude Code hook onFailure block | 2.1.295 fail-closed when a hook cannot start | claude-code CHANGELOG | add |
| w-codex-0162 | Codex 0.162.0 managed worktrees | worktrees, Command Center pins, ranked tool search, Linux sandbox fixes | Codex rust-v0.162.0 | add |
| w-skill-constellations | Skill Constellations copy network | 2,193,119 dated SKILL.md adoptions | arXiv 2610.11169 | add |
| w-skill-coinstall | One Skill Too Many | co-installed skills drop constraints while the task passes | arXiv 2610.11647 | add |
| w-pycache-trap | PyCache Trap skill scanners | 94–100% ASR via substituted bytecode cache | arXiv 2610.10612 | add |
| w-nomos | NOMOS policy-to-gate compiler | written policy to static tool-call gates; schema checks reject inoperable rules | arXiv 2610.11030 | add |
| w-spec-growth | Spec Growth Engine | model-free spec graph vs import graph; agents grow the spec | arXiv 2610.11725 | add |
| w-ontology-tower | Ontology tower | narrow-and-deep ontology as an agent's operating knowledge | arXiv 2610.11768 | add |
| w-cross-provider-review | Cross-provider review contract | separate pools, bounded reviewer, explicit failure states | arXiv 2610.10961 | add |
