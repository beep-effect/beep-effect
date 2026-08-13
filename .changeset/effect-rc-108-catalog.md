---
{}
---

No release: move the workspace catalog from Effect `4.0.0-beta.107` to the
published `4.0.0-rc.108` cut (`npm` dist-tag `rc`), matching the already-updated
`.repos/effect` subtree at `26db404a32`.

Lockstep `@effect/*` catalog pins move with `effect`. `@beep/drizzle` peers
`effect` and `drizzle-orm` follow the workspace catalog, and the scratchpad
AI clients switch to `catalog:` so they cannot lag the workspace pin again.
The RC compiler now fails `effect(duplicatePackage)` (`TS377051`) when a
nested `drizzle-orm` copy is present, so the peer had to move off rc.4.
