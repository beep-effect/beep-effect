---
"@beep/professional-desktop": patch
"@beep/observability": patch
"@beep/workspace-use-cases": patch
---

Crispen the professional-desktop app: colocate schema defaults, behavior, and
fixture statics with their schemas; absorb optionality into Option schema
fields; convert discriminated shapes to tagged unions; move component logic
into Context.Service implementations behind Atom.runtime.
