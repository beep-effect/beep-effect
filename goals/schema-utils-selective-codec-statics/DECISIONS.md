# Selective Schema Codec Statics Decisions

This is the durable `/grilling` ledger for the goal. Every answer records the
question, chosen answer, rationale, and rejected alternatives. A changed
decision requires a new dated entry; do not silently edit a ratified answer.

## Locked before round 1

### 2026-08-30 — D0: Effect Schema ownership

**Question:** May the goal implement or wrap its own Schema classes to obtain a
more convenient static API?

**Answer:** No. Use Effect's public `Schema` and `S.Class` implementations.

**Rationale:** The operator explicitly prefers the safe option and has prior
negative experience maintaining custom Schema class implementations.

**Rejected:** Custom Schema subclasses, constructor wrappers, proxies,
decorators, and hand-built AST-compatible schema objects.

### 2026-08-30 — D1: Migration outcome

**Question:** Is this only a new opt-in API, or must it replace the existing
broad helpers?

**Answer:** It is a repository migration. Replace every existing bare
`withCodecStatics` and `with<X>CodecStatics` use with an explicit minimal key
selection, then delete all broad variants and their implementations.

**Rationale:** Broad bundles attach methods schemas do not consume and create
collision and semantic hazards. Explicit selection makes the attached surface
reviewable at each declaration.

**Rejected:** Add the selector while retaining broad helpers; translate every
broad helper to a fixed full tuple; leave compatibility aliases indefinitely.

## Round 1 frontier — awaiting operator answer

### Q1: Explicit-selector compatibility

Should `withCodecStatics` require a non-empty key tuple everywhere, with no
zero-argument overload or deprecated broad compatibility path?

### Q2: `S.Class` utility shape

Should classes use a nested, frozen utility bag with an explicit class receiver
(`classStatics(this, keys)`), allowing consumer-side destructuring while
avoiding constructor mutation and custom class machinery?

### Q3: JSON boundary

Should JSON-string convenience names stay out of `withCodecStatics`, with
`S.fromJsonString(schema, formatOptions)` named explicitly and only ordinary
selected runners attached to that transformed schema?

