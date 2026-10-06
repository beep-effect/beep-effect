---
"@beep/law-practice-domain": patch
"@beep/law-practice-use-cases": major
"@beep/law-practice-server": major
"@beep/practice-kg-mcp": major
---

Attach a USPTO application or patent to the matter that dominates its citations: when one client-keyed family holds at least 3 of the citing documents and at least 80% of them, and no file name elsewhere carries the number, the anchor becomes a member with the new attribution source `mention-dominance` (`PRACTICE_KG_ANCHOR_DOMINANCE`); the other families keep their mention edges.

Record who writes about each matter. The build reads the headers of the `.eml` / `.msg` documents it holds and an optional contacts table (`build.ts --contacts <file>`, `--practice-domain <domain>`) into three new DuckDB tables: `matter_correspondents`, `contact_client_links`, and `contact_addresses`. `lookupPracticeKgCorrespondents` and the new MCP tool `kg_correspondent_lookup` resolve an email address; only the attorney's own contact links to a matter the bundle holds can make the answer `unique`, never message counts, inferred links, role mailboxes, or the practice's own addresses. The tool accepts a bare address or one header entry, marks only the decided row `unique` (the rest `candidate`), and lists it first.

Breaking: the store format is pglite `4` / duckdb `4` (default bundle version `2026-10-07-01`), the host refuses older bundles by name, `PracticeKgOptions`, `PracticeKgVerifySummary`, and the toolkit gain members. Rebuild the bundle and install extension `0.4.0` together.
