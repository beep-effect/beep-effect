---
schema: beep.research.watchlist/v0
updated: 2026-09-10
note: Draft ledger patch. Advance only AFTER human merge of research/2026-09-10. Do not claim merged.
---

# WATCHLIST

Routine-proposed. Human admits. Add-with-evidence only.

| id | term | why | evidence | action |
| --- | --- | --- | --- | --- |
| w-schema-binary | Effect SchemaBinary / cluster wire | SchemaBinary default ships in published rc.113; MessagePack removed; keep watching next RC / cluster consumers | effect@4.0.0-rc.113 | keep |
| w-drizzle-taggederror | drizzle Schema.TaggedErrorClass | still open; no update since 2026-08-25 despite rc.113 | drizzle-orm#6162 | keep |
| w-uspto-odp-auth | USPTO ODP profile + API key | four fields still mandatory (live Sep 10 Support page); petition includeDocuments 500s standing/unverified | data.uspto.gov/support 2026-09-10 | keep |
| w-skills-over-mcp | Agent Plugins vs SEP-2640 | Accepted not Final; OpenAI shipped snapshot-import Skills-over-MCP (Arcade Sep 8) while SEP still OPEN/draft — disk vs wire fork widened | mcp#2640; arcade.dev 2026-09-08 | keep |
| w-trustshift | MCP TrustShift delayed defect | install-time scanners miss it; Scanning the Harness quantifies unpinned MCP + shell pre-approvals in public harnesses | arXiv 2608.23763; 2609.07360 | keep |
| w-instant-sunset | Instant Cloud sunset 2027-08-31 | essay unchanged on 2026-09-10; self-host is the path | instantdb essay | keep |
| w-legal-models-2026-08 | Thomson 1.0 / Harvey Tenet | competitor specialist models + MCP/verify; fabric news remains separate from model news | TR arXiv 2608.27147 | keep |
| w-imanage-mcp-write | iManage MCP write-back | first-party MCP Server GA May 2026; write expansion + platform GA October 2026 — distinct from TR partnership MCP still coming soon | iManage ILTACON blog; docs.imanage MCP help | keep |
| w-daydreaming | Daydreaming skill steal | hosted skills leak via ordinary task results; Harvey named | arXiv 2608.26733 | keep |
| w-blanc-whitespace | BLANC patent white space | multi-view delta-NPMI; three views required | arXiv 2608.26685 | keep |
| w-legal-dms-mcp | DMS/research MCP fabric | Split clocks: iManage first-party MCP GA; Everlaw first-party MCP live; TR partnership MCP coming soon; Harvey-Everlaw fall 2026; LawToolBox M365 matter MCP shipping | iManage docs; Everlaw MCP KB; Harvey blog; lawtoolbox.com/mcp | keep |
| w-deepjudge-ahp | DeepJudge AHP handoff | app to app on MCP; Harvey beta + TR CoCounsel | LawNext 2026-08-13 | keep |
| w-lawtoolbox-mcp | LawToolBox M365 MCP | 70+ tools over matter containers in org M365 — shipping product surface | lawtoolbox.com/mcp 2026-09-10 | keep |
| w-harvey-pacerpro | Harvey-PacerPro docket | firm litigation record into Harvey | LawNext 2026-08-24 | keep |
| w-harvey-everlaw-mcp | Harvey-Everlaw MCP evidence bridge | still expected fall 2026; not GA; distinct from Everlaw first-party MCP | harvey.ai blog live Sep 10 | keep |
| w-everlaw-first-party-mcp | Everlaw hosted MCP | api.everlaw.com/v1/mcp OAuth read-only search tools — first-party evidence layer | Everlaw MCP KB | add |
| w-mcp-enterprise-ig | MCP Enterprise IG | #3306 IdP/ID-JAG docs still OPEN (last update 2026-09-01); SEP-2640 Accepted not Final | mcp#3306 | keep |
| w-jazz-wire-v1 | Jazz sync wire v1 | alpha.54 CUT on npm (jazz-tools@2.0.0-alpha.54 2026-09-10); #2118 closed unmerged; watch post-cut consumers | jazz-tools@2.0.0-alpha.54 | keep |
| w-uspto-oed-ai | USPTO OED AI discipline | first generative-AI-predicated order; no in-window follow-on | IPWatchdog D2026-16 | keep |
| w-rayrun-sep2640 | Rayrun SEP-2640 host | host implements draft skills/list+get; SEP still Accepted not Final | ray.run/docs/skills | keep |
| w-effect-rc113 | effect@4.0.0-rc.113 published | #7446 merged; rc.113 on GitHub/npm 2026-09-10; tip moved off rc.112; watch next Version Packages | effect@4.0.0-rc.113 | keep |
| w-effect-mcp-adapter | Effect MCP 2026-07-28 adapter | #7265 still OPEN after rc.113 publish (updated 2026-09-09); do not pin | Effect#7265 | keep |
| w-skillscan | agent-skill-security-scanner | offline fail-closed static scanner; Scanning the Harness adjacent | harness-eval 2609.07360 | keep |
| w-agent-plugins-coevo | Agent Plugins co-evolution | HookPry + Scanning the Harness extend plugin/hook/MCP config supply-chain | arXiv 2609.03884, 2609.07360 | keep |
| w-public-law-mcp | Public-law jurisdiction MCP | Iceland PoC + german-legal-mcp created Sep 8; foil for gov-legal-mcp | metaneutrons/german-legal-mcp | keep |
| w-skillshift | SkillShift / Skill Policy Integrity | covert utility-preserving skill steering; scanner misses | arXiv 2609.02564 | keep |
| w-acle-effect-closure | ACLE-MCP + effect closure | invocation-time leases + EffectBound; SEP-3004 still OPEN (updated Sep 10) | mcp#3004 | keep |
| w-repo-to-skill | DisCo Repo-To-Skill / AREX-Skill | author-reported verified skill library | arXiv 2609.02749 | keep |
| w-hookpry | HookPry lifecycle-hook supply chain | attacker-controlled lifecycle-hook updates; intersects Scanning the Harness | arXiv 2609.03884 | keep |
| w-skill-scanner-cel | Cisco skill-scanner CEL shadow layer | shadow CEL decision layer; SkillShift-adjacent | cisco skill-scanner#210 | keep |
| w-swe-gate | SWE-Gate review-constraint gap | functional success != review-constraint compliance | arXiv 2609.04167 | keep |
| w-harness-scan | Scanning the Harness defect rates | 16% confirmed security defects in public coding-agent setups; unpinned MCP + shell pre-approvals | arXiv 2609.07360 | add |
| w-trajmark | TrajMark trajectory watermark | ownership + segment tamper localization for coding-agent trajectories | arXiv 2609.10416 | add |
| w-openai-skills-snapshot | OpenAI Skills-over-MCP snapshot import | ships scan-time import into plugins; not live SEP-2640 runtime | arcade.dev 2026-09-08 | add |
