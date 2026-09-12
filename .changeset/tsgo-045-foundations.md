---
"@beep/identity": patch
"@beep/effect-drizzle": patch
"@beep/repo-cli": patch
"@beep/db-admin": patch
"@beep/professional-desktop": patch
"@beep/doc-text": patch
---

Retire the redundant TaggedError equivalence hook now that Effect derives Schema
class equivalence by construction, invert the `SFV4-tagged-error-equivalence`
lint to report class-level `toEquivalence` hooks, replace the tsgo-rules gate's
hard-coded directive exemption with a two-entry schema allowlist, and verify
plugin option parity against the installed `@effect/tsgo` README.
