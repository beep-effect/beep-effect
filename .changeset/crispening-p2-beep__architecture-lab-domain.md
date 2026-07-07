---
"@beep/architecture-lab-domain": patch
---

Crispen `@beep/architecture-lab-domain` for the P2 repo-crispening wave: move WorkItem Option absence defaults onto the schemas, derive WorkPriority ranking and WorkItem lifecycle guards from their LiteralKit domains, colocate Worker decode behavior, tighten WorkItem id/title precision, add field and union annotations, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded WorkItem wire shapes remain unchanged; the CreateWorkItemInput constructor-time priority absence is preserved as an explicit exception.
