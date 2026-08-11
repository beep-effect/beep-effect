---
"@beep/professional-desktop": patch
"@beep/agents-client": patch
"@beep/observability": patch
"@beep/workspace-use-cases": patch
---

Crispen the professional-desktop app: colocate schema defaults, behavior, and
fixture statics with their schemas; absorb optionality into Option schema
fields; convert discriminated shapes to tagged unions; move component logic
into Context.Service implementations behind Atom.runtime.

Remove three pre-release compatibility paths: the composer raw-normalization
confirm flow, the legacy `mui-mode` theme-preference migration, and the
boot-time purge of the retired `desktop:dock-workspace:v1` snapshot key. A
stale `mui-mode` value is no longer migrated and a stale v1 dock key is no
longer removed; neither is read by the current build.
