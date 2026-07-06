---
"@beep/colors": patch
---

Crispen `@beep/colors` for the repo-crispening-orchestration P2 wave: colocate
the `ProcessLike` decoder and color-support behavior on the schema class, add
per-key schema annotations for process metadata and formatter fields, replace
the disabled formatter factory with the shared `thunk` helper, and add
`S.toArbitrary` parity laws for `ProcessLike` round-trips and disable
overrides. Public structural input and encoded shapes are unchanged.
