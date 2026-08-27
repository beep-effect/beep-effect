---
schema: beep.research.watchlist/v0
updated: 2026-08-27
---

# WATCHLIST

Routine-proposed. Human admits. Add-with-evidence only.

| id | term | why | evidence | action |
| --- | --- | --- | --- | --- |
| w-schema-binary | Effect SchemaBinary / cluster wire | v4 default transport; MessagePack removed | effect@4.0.0-rc.112, #7461 | add |
| w-evolu-jsonvalue | Evolu encodeJsonValue | local-first also dropped msgpackr for a schema-narrow codec | @evolu/common@8.7.0 | add |
| w-drizzle-taggederror | drizzle Schema.TaggedErrorClass | still broken on v1.0.0-rc.4; beep #852 merged and does not close it | drizzle-orm#6162 | keep |
| w-uspto-odp-auth | USPTO ODP profile + API key | OA APIs now keyed; live page is JS so 2026-08-18 notice was inconclusive this run | data.uspto.gov OA search notice 2026-08-18 | keep |
| w-uspto-rpi-reexam | USPTO RPI-for-EPR NPR | 26 split comments; identity rules for anonymous reexam | IPWatchdog 2026-08-25 | add |
| w-skills-over-mcp | Agent Plugins vs SEP-2640 | skill contract fork; SEP PR still open | experimental-ext-skills#120, modelcontextprotocol#2640 | keep |
| w-trustshift | MCP TrustShift delayed defect | install-time scanners miss it; still unread before any #853 un-park | arXiv 2608.23763 | keep |
| w-instant-sunset | Instant Cloud sunset 2027-08-31 | local-first vendor-durability shock | instantdb essay 2026-08-22 | keep |
| w-legal-models-2026-08 | Thomson 1.0 / Harvey Tenet / Lexis planned | three specialist-model houses + Tenet numbers + bash-vs-MCP harness asterisk | TR + Harvey + Lexis week of 2026-08-20 | keep |
| w-lexis-protege | Lexis Legal Intelligence Engine | dynamic skill/model harness; Shepard's verify; proprietary model later 2026 | Lexis press 2026-08-24 | add |
| w-clio-judiciary | Clio Arredondo SVP Judiciary | first big-house judiciary AI product line; starts 2026-08-31 | Law.com 2026-08-25 | add |
| w-tenet-harness | Tenet LAB bash/fs vs Mercor MCP | eval gold must record harness | Harvey Tenet preview + Fireworks 2026-08-26 | add |
