# Instance

- id: `ids-statement-presence-kind`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/law-practice/domain/src/entities/IdsSubmissionFact/IdsSubmissionFact.values.ts:331`
- symbol: `IdsStatementFacts`
- members: `statementPresent`, `statementType`
- evidence: E4 at `IdsSubmissionFact.values.ts:297-307,331-336` — the
  optional type identifies which present 37 CFR 1.97(e) statement was
  observed, so Some(type) implies presence; E1 at lines 315-319 and every
  repository fixture constructs true with a type.

# Current shape

The persisted `IdsStatementFacts` schema stores a presence boolean beside an
optional two-literal statement type and the independent
`sizeFeeAssertionPresent` fact. The pair distinguishes absence, a statement
whose subtype was not recorded, and either known subtype, but also permits a
typed statement marked absent.

# Cardinality gap

The boolean/presence pair has four structural combinations and three are legal:
absent/None, present/None, and present/Some. Because `IdsStatementType` has two
literals, those three shapes become four concrete target variants: `absent`,
`present-untyped`, `e1-foreign-citation`, and
`e2-no-prior-knowledge`. `sizeFeeAssertionPresent` is independent and excluded
from this count.

# Target schema

Define an `IdsStatementPresenceKind` LiteralKit with the four concrete variants
and use its members to build a tagged union. `IdsStatementFacts` keeps the
independent size-fee assertion beside one `statementKind` value. Wrap the
decoded model in a boundary codec from the existing flat encoded object:
false/null decodes to absent, true/null to present-untyped, and true plus either
type to the corresponding typed variant; false plus a type is rejected. Encode
each variant back to the exact existing `statementPresent` and
`statementType` values. Reuse the existing `IdsStatementType` literals rather
than defining competing e1/e2 strings.

# Migration inventory

- `IdsSubmissionFact.values.ts:20,118-146` — reuse `IdsStatementType` as the
  canonical subtype vocabulary.
- `IdsSubmissionFact.values.ts:292-341` — introduce the named presence-kind
  owner, replace the correlated fields in the decoded class, retain
  `sizeFeeAssertionPresent`, and add the legacy flat codec with the existing
  `IdsStatementFacts` identity and annotations.
- `IdsSubmissionFact.model.ts:68-102` — keep the `statement` JSONB field and
  `IdsStatementFacts` codec in place; no entity or table-column change.
- `tables/src/entities/IdsSubmissionFact/IdsSubmissionFact.converters.ts:47-109`
  — continue encoding the entity before insert and decoding every untrusted
  selected JSONB row through `IdsSubmissionFact`.
- `server/src/CandorRecord/CandorRecord.repo.ts:264-303` — no repository-flow
  change; list and append continue crossing those converters.
- Update decoded readers in `tables/test/CandorConverters.test.ts:263-274` and
  any application code to match `statementKind` rather than inspecting an
  Option. Whole-source search found no production reader of the old pair.
- Update constructors in `domain` JSDoc and fixtures at
  `tables/test/CandorConverters.test.ts:106`,
  `server/test/CandorRecord.test.ts:157-161`, and
  `server/test/CandorRecord.pglite.test.ts:168` while retaining their encoded
  input objects where they deliberately test decoding.
- Package entity/value barrels already export `IdsStatementFacts` and
  `IdsStatementType`; export the new presence-kind schema with the same domain
  surface and add the required changeset when implemented.

# Guard-deletion accounting

Delete the decoded `statementPresent` boolean, `statementType` Option, their
constructor defaults, and every downstream presence/Option coherence check.
The boundary transform alone reads and writes the legacy pair. Keep
`sizeFeeAssertionPresent` as an independent observed fact.

# Encoded-side impact

This is Tier 2. Preserve the JSONB object exactly: the same property names,
boolean values, null/string representation, defaults, and the two existing
statement-type strings. Existing legal database rows decode and re-encode
without migration. The previously representable false/type contradiction is
rejected as invalid domain data. Entity IDs, table columns, insert/select
shapes, repository errors, and ordering are unchanged.

# Test impact

Add decode/encode fixtures for absent, present-untyped, e1, and e2, plus
rejection of false with either type. Derive arbitrary round trips from the
decoded union and assert their encoded projections. Retain the entity
round-trip suite at `LawPracticeDomain.test.ts:244-260`, converter JSONB
round-trip at `CandorConverters.test.ts:239-283`, in-memory repository tests,
and PGlite persistence tests. Package tests must import through `@beep/*`.

# Risk and sequencing

Land alone as Tier 2 with encoded-compat proof. The principal risk is changing
the JSONB projection or treating present-untyped as absent. Keep the
independent size-fee assertion outside this union and decode stored rows before
any reader migration relies on the new tag.
