---
"@beep/ontology-ui": patch
"@beep/ui": patch
---

Resolve relative import specifiers that pointed at `.tsx` modules with a
`.ts` extension (Session region exports/workbench, editor-00 blocks,
professional-desktop entry), left unresolvable after the relative-extension
enforcement landed on main.
