---
"@beep/workspace-tables": patch
---

Crispen `@beep/workspace-tables` for the P2 repo-crispening wave: replace assertion-based insert row projections with explicit Drizzle insert objects, keep SQL row absence as concrete `null` at the table boundary, defer cross-package codec-static colocation to the family-close sweep, and add package-local `S.toArbitrary` projection laws for Thread, Message, and Turn converters. Public row helper signatures and encoded wire shapes remain unchanged.
