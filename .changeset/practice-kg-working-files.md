---
"@beep/law-practice-domain": patch
"@beep/law-practice-use-cases": major
"@beep/law-practice-server": major
"@beep/practice-kg-mcp": major
---

Build the practice knowledge-graph bundle from the attorney's working files. `build.ts --include-run <label>` folds a later source run in, reads each new file's folder path for its docket and client, and `--docket-register <file>` reads the docket register as an attribution source. Attribution now ranks `folder-path` ahead of text references, and uses `docket-register` last, only for a family whose documents name no client themselves. `matters` gains `client_name`, surfaced as `clientName` on `PracticeKgMatter` and `kg_matter_lookup`, and as the client label in `kg_clients`. The text scan recognises every country stage the reference extractor does (`practiceKgDocketCountryCodes`).

Breaking: `PracticeKgMatter` and the bundle manifest have new required fields, the store format is pglite `3` / duckdb `3` (bundle version `2026-10-06-02`), and the host refuses older bundles by name. Rebuild the bundle and install extension `0.3.0` together.
