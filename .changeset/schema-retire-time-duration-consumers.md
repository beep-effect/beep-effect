---
"@beep/skill-contract": minor
"@beep/langextract": minor
"@beep/observability": minor
"@beep/ui": patch
"@beep/lejeune-bolt-workbench": patch
---

Replace the retired `@beep/schema` time and duration concepts under the "Upstream-First
Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`, 2026-09-29).
`@beep/skill-contract` exports `IsoDateTimeString` for its receipt and audit timestamps and
`@beep/langextract` keeps a module-local copy for verified-span attempts; both keep the
stored ISO strings byte-identical. `@beep/ui` owns its picker timezone adapters,
`@beep/observability` takes `Duration` values for its Node SDK intervals, and the LeJeune
workbench validates timestamps with `DateTime.formatIso` alone. Timestamp fields decode to
`string` instead of the `ISOStr` brand.
