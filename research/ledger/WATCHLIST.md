---
schema: beep.research.watchlist/v0
updated: 2026-09-05
note: Draft ledger patch. Advance only AFTER human merge of research/2026-09-05. Do not claim merged.
---

# WATCHLIST

Routine-proposed. Human admits. Add-with-evidence only.

| id | term | why | evidence | action |
| --- | --- | --- | --- | --- |
| w-schema-binary | Effect SchemaBinary / cluster wire | v4 default transport; no published rc.113; Changesets #7446 still stages unpublished rc.113 (updated 2026-09-05T10:00:05Z) | Effect#7446 | keep |
| w-drizzle-taggederror | drizzle Schema.TaggedErrorClass | still open; no update since 2026-08-25; beep #852 merged and does not close it | drizzle-orm#6162 | keep |
| w-uspto-odp-auth | USPTO ODP profile + API key | four fields still mandatory (live Sep 5 Support page); petition includeDocuments 500s standing/unverified (no authenticated probe) | data.uspto.gov/support 2026-09-05 | keep |
| w-skills-over-mcp | Agent Plugins vs SEP-2640 | SEP Accepted by Core Maintainers 2026-09-03 but PR still OPEN/draft; needs reference implementation, conformance tests, ext-skills repo; Accepted != Final != shipped; disk vs wire fork remains live | mcp#2640 | keep |
| w-trustshift | MCP TrustShift delayed defect | install-time scanners miss it; skillscan adjacent; SkillShift + HookPry + skill-scanner CEL shadow layer extend the scanner-gap story | arXiv 2608.23763, 2609.02564, 2609.03884; cisco skill-scanner#210 | keep |
| w-instant-sunset | Instant Cloud sunset 2027-08-31 | official essay + homepage banner unchanged on 2026-09-05; self-host is the path | instantdb essay 2026-08-22 | keep |
| w-legal-models-2026-08 | Thomson 1.0 / Harvey Tenet | competitor specialist models + MCP/verify; Harvey-Everlaw fall-2026 MCP is fabric news, not model news | TR arXiv 2608.27147 | keep |
| w-imanage-mcp-write | iManage MCP write-back | standing DMS write-back watch (GA Oct 2026) distinct from TR partnership MCP still coming soon -- do not call MCP GA | LawNext 2026-08-27; iManage press 2026-09-05 live | keep |
| w-daydreaming | Daydreaming skill steal | hosted skills leak via ordinary task results; Harvey named; AGENT-O Agent Card ontology adjacent; NLIP interop adjacent | arXiv 2608.26733, 2608.28345, 2609.04135 | keep |
| w-blanc-whitespace | BLANC patent white space | multi-view delta-NPMI; three views required | arXiv 2608.26685 | keep |
| w-legal-dms-mcp | DMS/research MCP fabric | iManage/TR APIs available, MCP coming soon; Everlaw-CoCounsel future-facing; Harvey-Everlaw MCP expected fall 2026 (not GA) -- three GA clocks | Everlaw 2026-09-01; Harvey 2026-09-03; iManage live Sep 5 | keep |
| w-deepjudge-ahp | DeepJudge AHP handoff | app to app on MCP; Harvey beta + TR CoCounsel | LawNext 2026-08-13 | keep |
| w-lawtoolbox-mcp | LawToolBox M365 MCP | 70 tools over matter containers in org M365 | LawNext 2026-08-24 | keep |
| w-harvey-pacerpro | Harvey-PacerPro docket | firm litigation record into Harvey | LawNext 2026-08-24 | keep |
| w-harvey-everlaw-mcp | Harvey-Everlaw MCP evidence bridge | announced Sep 3; expected joint availability fall 2026; not GA; distinct from Everlaw-CoCounsel and iManage/TR clocks | harvey.ai blog 2026-09-03 | add |
| w-mcp-enterprise-ig | MCP Enterprise IG | charter merged; nav #3321 merged; #3306 IdP/ID-JAG docs still OPEN (last update 2026-09-01); SEP-2640 Accepted not Final | mcp#2626, mcp#3321, mcp#3306 | keep |
| w-jazz-wire-v1 | Jazz sync wire v1 | #2361 alpha.54 pkg.pr.new RC CLOSED obsolete 2026-09-04; path moved to #2118 Changesets packaging tip (OPEN) + #2583 V1 format settlement (MERGED 2026-09-05); alpha.54 not cut | jazz#2118, jazz#2583, jazz#2361 | keep |
| w-uspto-oed-ai | USPTO OED AI discipline | first generative-AI-predicated order; no in-window follow-on | IPWatchdog 2026-08-28 D2026-16 | keep |
| w-rayrun-sep2640 | Rayrun SEP-2640 host | host implements draft skills/list+get; SEP now Accepted not Final -- host is still not a SEP vote | ray.run/docs/skills 2026-08-29 | keep |
| w-effect-rc113 | effect@4.0.0-rc.113 staged | Changesets #7446 stages unpublished rc.113 (updated 2026-09-05T10:00:05Z); published latest remains rc.112; do not pin | Effect#7446 | keep |
| w-effect-mcp-adapter | Effect MCP 2026-07-28 adapter | #7265 still OPEN (updated 2026-09-04): v2026-07-28 adapter, lifecycle, MRTR, subscriptions, JSON tool outputs; unpublished pending rc.113; HOLD+MOVED | Effect#7265 | keep |
| w-skillscan | agent-skill-security-scanner | offline fail-closed static scanner; SkillShift shows scanners can miss policy steering; Cisco skill-scanner CEL shadow layer is adjacent rising edge | daffnjk/agent-skill-security-scanner; cisco-ai-defense/skill-scanner#210 | keep |
| w-agent-plugins-coevo | Agent Plugins co-evolution | empirical Claude marketplace study; HookPry extends plugin/hook supply-chain surface (lifecycle-hook updates) | arXiv 2608.28497, 2609.03884 | keep |
| w-public-law-mcp | Public-law jurisdiction MCP | Sweden Lifos pair + claimed Iceland PoC (Sep 4); foil for gov-legal-mcp. ArthurLegal/prawmi remain REPORT appendix-only, not packet truth | iceland-context-mcp-poc | keep |
| w-skillshift | SkillShift / Skill Policy Integrity | covert utility-preserving skill steering; scanner misses; HookPry + skill-scanner CEL continue the gap | arXiv 2609.02564 | keep |
| w-acle-effect-closure | ACLE-MCP + effect closure | invocation-time leases + EffectBound; SEP-3004 tamper-evident audit records adjacent (still OPEN) | arXiv 2609.02690, 2609.02866; mcp#3004 | keep |
| w-repo-to-skill | DisCo Repo-To-Skill / AREX-Skill | author-reported verified skill library; no in-window follow-on | arXiv 2609.02749 | keep |
| w-hookpry | HookPry lifecycle-hook supply chain | attacker-controlled lifecycle-hook updates steer harnesses; author-reported peak ASR 92.5%; Defender 0% recall; intersects Agent Plugins / SkillShift / approval firewalls | arXiv 2609.03884 | add |
| w-skill-scanner-cel | Cisco skill-scanner CEL shadow layer | #210 merged shadow CEL decision layer (cel-go v0.32.0); rules stay shadow; correlating typed facts only -- not a policy-integrity proof; SkillShift-adjacent | cisco-ai-defense/skill-scanner#210 | add |
| w-swe-gate | SWE-Gate review-constraint gap | functional success != review-constraint compliance; 34.3% of green repairs fail constraint tests; yeet/review-gate adjacent | arXiv 2609.04167 | add |
