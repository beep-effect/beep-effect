# Instance

- id: `r3-tooling-docgen-quality-companion-kinds`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:274`
- symbol: `effectiveMissingRequiredTags.companionKinds`
- members: `isSchemaCompanionTypeAlias`, `isCompanionNamespace`,
  `isSchemaCompanionInterface`
- evidence: E2 at `Quality.subjects.ts:327-336` — the missing-tag reader ORs
  three companion recognizers through their negations. Each is gated by a
  different `declarationKind`, so no combined-true case can reach the reader.

# Current shape

Three private predicates classify the same export name, declaration kind, and
signature. The missing-tag reader needs to know whether the declaration is one
of three companion forms or not, while the separate `inheritDoc` fact can
co-occur with any form. The companion domain is one four-case syntactic kind
flattened into three booleans.

# Cardinality gap

Eight boolean triples are representable and four companion kinds are legal:
`none`, `schema-type-alias`, `namespace`, and `schema-interface`. Because a
declaration has one kind string, type, namespace, and interface recognizers are
mutually exclusive.

# Target schema

Define a private annotated `DocgenCompanionDeclarationKind` LiteralKit with the
four cases, imported from the narrow `@beep/schema/LiteralKit` subpath and
annotated through the file's existing repo-CLI identity composer. Replace the
three predicates with one classifier over `(exportName, declarationKind,
signature)`. Match only the relevant declaration kinds, retain their exact
regular expressions, and return `none` for every other kind or signature.

`effectiveMissingRequiredTags` derives the kind once and suppresses `@example`
when `hasInheritDoc(rawJsDoc)` is true or the companion kind is not `none`.
Keep inheritDoc as an independent documentation carrier rather than folding it
into the companion syntax taxonomy.

# Migration inventory

- `Quality.subjects.ts:8-29` — add the narrow LiteralKit import; reuse `$I`
  rather than introducing another identity owner.
- `Quality.subjects.ts:274-289` — replace the three boolean recognizers with the
  named kind and one classifier. Preserve both supported schema type-alias
  signatures, declared-namespace matching, interface `extends` matching,
  escaping of export names, and anchoring.
- `Quality.subjects.ts:318-337` — derive one kind and replace the three-negation
  guard while leaving the independent inheritDoc branch and exact missing-tag
  filtering unchanged.
- `Quality.subjects.ts:610-652` remains the sole writer/consumer path through
  `makeSubjectCandidate`; `DocgenQualitySubject.deterministicMissingTags` and
  all report/render schemas remain unchanged.
- Whole source/barrel search found no other reader of the private predicates;
  the new LiteralKit remains private and requires no barrel export.
- `test/docgen.test.ts:365-504,2147-2182` already exercises inheritDoc, both
  schema type-alias forms, namespace, interface, and ordinary type aliases;
  strengthen it with explicit kind near-misses and co-occurrence cases.

# Guard-deletion accounting

Delete all three `is*Companion*` boolean helpers and the three correlated
negations in `effectiveMissingRequiredTags`. One literal classifier becomes the
sole companion-form coherence boundary; only the independent inheritDoc
boolean remains.

# Encoded-side impact

None. The literal is private derived state. Quality subject/report schemas,
stable identities, missing-tag arrays, review finding codes, rendered Markdown
and JSON, declaration signatures, and CLI behavior remain byte-compatible.

# Test impact

Prove all four kinds: both accepted schema type aliases, a declared companion
namespace, a schema companion interface, and ordinary/nonmatching declarations.
Include a type alias with a mismatched export name, an ordinary namespace, an
interface without the supported schema-style `extends`, and a companion that
also has inheritDoc. Assert exact `@example` suppression and unchanged other
required tags/finding codes. Run focused Docgen quality tests and full
`@beep/repo-cli` package verification with the required patch changeset.

# Risk and sequencing

Land in Tier 1E with the other repo-CLI designs. Do not broaden the companion
recognition grammar: the refactor classifies the three existing accepted forms
and leaves all near-misses subject to the current documentation requirement.
