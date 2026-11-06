# Runtime identity and immutable safety boundaries

The native-runtime law checker correctly requires a documented identity and
retention reason for native weak collections. These citation owners authenticate
runtime capabilities by the exact issued object; structural equality cannot
replace that check. Effect has no weak-key collection equivalent.

Seven file/kind entries now document the existing native boundary uses:

- Callback observations: weak issuance tied to the exact callback result.
- Callback sessions: weak captured-session issuance, detached object identity,
  and operation-owned list handles.
- Cleaner pipeline: exact reservation handles without retaining abandoned keys.
- Cleaner values: weak scoped issuance, with only bounded empty/space caches.
- Resource objects: weak handle membership with separately bounded slot state.
- Cleaner value object methods: freezing issued handles and inspecting their
  data descriptors without invoking substituted getters.
- Public absolute ceilings: freezing the complete numeric safety-limit table
  before JavaScript consumers can mutate it.

The entries use the canonical `standards/effect-laws.allowlist.jsonc` mechanism.
Its snapshot was regenerated with the repo-configs code generator. The first
focused scan still used the prior snapshot and reported the original warnings;
the scan after regeneration passed: 40 source files, zero warnings, zero errors,
seven used entries. The 27 other entries are outside this focused scan.

One native `typeof` guard in captured-session restoration now uses
`P.isObjectOrArray`. Upstream Predicate source confirms the same non-null object
check: arrays remain accepted, functions remain rejected. This does not widen
issuance, because weak membership is still required before reading a snapshot.

Existing cleaner-value and callback-session suites passed: 11 tests in 4.44
seconds with one worker. These include copied/foreign handle rejection and a
forged getter case. The identity lint profile was refreshed through its
canonical writer. No equality, ownership, garbage-collection, safety ceiling,
or citation semantic contract was relaxed.

This boundary accounting does not establish full target parity or complete the
remaining schema-first, hosted quality, or goal acceptance work.
