---
"@beep/md": patch
"@beep/tika": patch
---

Stabilize the nightly property-law sweep (issue #677) against its two recurring
failure classes. `@beep/md` bounds the five recursive Markdown child-list
schemas with an arbitrary-only `maxLength` hint, so schema-derived generation
of `Document`-bearing models stays inside the nightly 1000-run budget without
constraining decoded documents. `@beep/tika` moves `TikaError` equivalence into
the schema declaration as a fields-only `toEquivalence` annotation, replacing
the `Equal.equals` declaration fallback that compared non-schema `Error`
runtime metadata and failed round-trip laws seed-dependently; the property test
now validates the public comparator directly instead of a test-local override.
