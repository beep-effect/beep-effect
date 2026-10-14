### sol-2-1
- file: scratchpad/effected/jsonl/Envelope.ts:255
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and section 14. The recorded native-runtime deviation changes the transient merge representation while retaining decoded class payloads; this is new evidence of an additional behavioral regression.
- evidence: Read-only `bun --eval` differential probes imported upstream exclusively from the pinned oracle. With `class Payload extends S.Class<Payload>("ProbePayload")({ n: S.Finite, keep: S.String }) {}` and event data `S.Union([Payload, S.Null])`, both journals successfully load the same seed `{ n: 1, keep: "a" }`. Calling `appendPatch("x", { n: 2 })` produces upstream `Success Payload { n: 2, keep: "a" }` with two persisted records; the lab produces `Failure InvalidData` with only the seed persisted. A second probe reproduces the same failure with a `S.Struct(...).pipe(S.decodeTo(S.instanceOf(Payload), ...))` codec.
- failure: `shallowMerge` now creates a plain record, but `patchCodec` derives structural fields only when the registered schema itself is a callable declaration. A union containing a schema class, or a transformation producing a class instance, falls through to its ordinary encoder. That encoder rejects the plain merged record, making previously valid partial patches fail. The restored tests cover a bare `S.Class` and therefore miss schema composition.
- fix: Extend structural patch-codec derivation through class-bearing union members and codec transformations, preserving their transformations and checks. Continue validating the encoded result through the original registered envelope codec before writing. Add regression cases for the nullable schema class and transformed class payload.

### sol-2-2
- file: scratchpad/effected/jsonl/README.md:145
- class: docs   severity: backlog
- standard: D11; the 2026-10-09 native-runtime ruling and the module’s recorded native-runtime deviation.
- evidence: Lines 145–147 state that four operations remain allowlisted: weak registry lifetime, registry freezing, service-constructor augmentation and prototype-preserving merge. The reviewed source instead uses an owned registry, a service subclass and a plain transient merge. `rg -n 'jsonl' standards/effect-laws.allowlist.jsonc` returns no matches, and the ledger explicitly records removal of all four JSONL entries.
- failure: The runtime-boundary description contradicts the implementation and Port notes, giving readers an incorrect account of the module’s exceptions and ownership behavior.
- fix: Replace the obsolete allowlist sentences with a brief description of the current owned-registry, service-subclass and structural patch-encoding approach.

REQUIRED: 1
BACKLOG: 1