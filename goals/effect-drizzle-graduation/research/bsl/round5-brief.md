# BSL Round 5 Brief — Arrays, Reverse/Through Relations, Repository Generalization

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Same protocol as rounds 2–4:
implement in `scratchpad/bsl/`, prove everything green (unmasked exit codes), write
`research/round5-report.md`, do **not** commit.

Read first: `research/round4-report.md` and `research/round3-report.md` §G (the
`.array()` design you are now implementing), then the round-3 brief's laws/conventions
(apply verbatim — zero runtime type assertions, overload-with-broad-impl,
`TaggedErrorClass` + `.make()`, effect helper modules, both-sides-of-every-invariant,
JSDoc titled examples), then the current sources.

## Deliverables (priority order)

### A. `.array()` — implement round-3's recorded design

Combinator-owned dimensions in field metadata; no dims slot on descriptors, no
wrapper spec. Requirements:

- **The hard part is validation flow, solve it first.** A base combinator's
  `ValidateEncoded` (e.g. `pg.text` requiring a string-encoded schema) must apply to
  the **element** type of an array-encoded schema. Design the authoring shape so the
  compile error still lands at the pipe callsite with a readable message — e.g.
  element-combinator-as-argument (`pg.array(pg.text())`, optional dims) or an
  equivalent you can justify. Whatever ships: the field's encoded type must be
  validated as ReadonlyArray (to the declared depth) of the base carrier, at type
  level AND runtime.
- Before writing types, verify against installed drizzle rc4 what `.array()` /
  `SetDimensions` actually do: the brand's shape, the default dimensions meaning,
  and multi-dimension behavior. Cite file:line in the report.
- Projection: compile the base builder once, apply the array modifier, brand with
  `SetDimensions` in the same centralized pipeline as `SetNotNull`/`SetHasDefault`.
  `$inferSelect`/`$inferInsert` fixtures must show the recursively-readonly array
  carrier at the declared depth.
- Identity: `array<baseIdent,dims>` (or equivalent literal) so scalar↔array and
  depth-mismatched foreign keys fail both type-level and runtime validation —
  negative fixtures for both.
- Bare array/object schemas WITHOUT `pg.array` continue deriving `jsonb` exactly as
  today — no silent change to existing derivation; state this in the report.
- Interactions to decide + test: array + `unique`, array + `default_` (value must be
  the array carrier), array + `version`/`identity`/`primaryKey` (expect: reject),
  enum arrays (if drizzle rc supports `enumCol.array()` — check; if not, reject
  loudly and document).
- **Live proof**: a `text[]` (and one deeper, e.g. `text[][]` if the rc supports it)
  column travels through pushSchema DDL, inserts, and round-trips decoded through
  the model against pglite. Watch PGlite array parsing the same way round 4 had to
  watch timestamp parsers — document whatever you find.

### B. Reverse `many` + `through` relations, proven by live queries

Round 4 proved `defineRelations` accepts our config; this round proves the relations
actually *query*.

- **Reverse `many`**: for every forward one-edge, emit the reverse `many` on the
  target table. Naming must be deterministic and collision-free; design the rule
  (consider: derived from the source model key, disambiguated by source field when
  two FKs share source and target) and make collisions a loud `SchemaAssemblyError`,
  never a silent overwrite. Reverse and forward relations must share aliases so
  drizzle pairs them.
- **`through`**: junction projection using RQBv2's `.through(column)` (installed
  source: `drizzle-orm/src/relations.ts:1374`). Proposed derivation rule — a model
  whose composite primary key consists entirely of FK columns (the `Membership`
  shape) is a junction; each side gets a `many ... through` to the other. If you
  adopt a different or additional rule (e.g. explicit opt-in on `Bsl.schema`),
  justify it in the report. Verify the exact rc4 `through` API shape against source
  before designing.
- **Live proofs** (the point of this deliverable): against pglite with seeded rows,
  run actual RQBv2 queries through `drizzle({ client, relations })` —
  `findMany({ with: ... })` for: forward one (user → org), reverse many (org →
  users), self-reference (org → parentOrg / childOrgs), and through (org ⇄ users
  via membership). Assert row contents, not just absence-of-throw.

### C. Generalize the optimistic repository beyond service-free codecs

Lift `repository.ts`'s `ServiceFreeCodec` bound: carry the model's
`DecodingServices` / encoding services through `makeRepository`'s Effect and method
signatures the way `SqlModel.makeRepository` does. No behavior change; the round-4
live suite must keep passing unchanged. Add a type-level fixture with a
service-requiring codec proving the services surface in the method signatures
(execution with a real service is NOT required this round).

### D. Promotion-ready live harness

Refactor `live.test-support.ts` so the pieces round 4 flagged are cleanly separable
for eventual promotion into a shared package: the timestamp-parser pinning and the
camel/snake repository view become named, documented, individually-consumable
constructors (still scratchpad-local). The live suites consume the refactored form.
No new capability — this is shape work so graduation is a move, not a rewrite.

### E. BaseEntity migration plan (document only)

`research/baseentity-migration-plan.md`: map every `BaseEntity.fields` +
`EntitySchema.persist` member (packages/shared/domain/src/entity/BaseEntity.ts) onto
its BSL kit equivalent; name what is proven live vs still missing; propose the
migration order (which packages move first, what the compatibility shims are, how
`EntityTable.pgTableFrom` call sites convert); list the graduation blockers with the
receipts from rounds 2–5. This is a plan for the operator to review — make no
changes outside `scratchpad/bsl/`.

### F. Report

`research/round5-report.md`: per-deliverable outcomes; the array-validation design
decision and the drizzle facts it rests on; the reverse-naming and junction rules;
assertion census; open items → round-6 queue.

## Proofs

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/
```

Fully green, unmasked exit codes, zero runtime type assertions (census in report),
negative-fixture matrix grown for every new invariant. Blocked deliverables:
finish the rest, document the blocker precisely — no silent degradation.
