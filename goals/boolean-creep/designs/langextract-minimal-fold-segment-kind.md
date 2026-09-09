# Instance

- id: `langextract-minimal-fold-segment-kind`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/foundation/capability/langextract/src/Alignment/Alignment.behavior.ts:186`
- symbol: `minimalFoldTokens.segmentKind`
- members: `endOfLineHyphen`, `whitespace`
- evidence: E1/E2 at `Alignment.behavior.ts:118,186-203` — the regular
  expression alternatives make the two capture groups exclusive, and the
  matcher reads them as end-of-line hyphen, whitespace, or ordinary text with
  no combined-true case.

# Current shape

`minimalFoldTokens` converts two mutually exclusive regular-expression capture
groups into a temporary object of booleans, then pattern-matches that object.
The third regex alternatives both intentionally share the ordinary-text case.

# Cardinality gap

Four boolean pairs are representable. Exactly three semantic states exist:
`end-of-line-hyphen`, `whitespace`, and `text`; both booleans cannot be true
because capture groups one and two belong to different regex alternatives.

# Target schema

Add a private named `MinimalFoldSegmentKind` LiteralKit with those three values
in `Alignment.behavior.ts`. Derive the literal directly from capture-group
presence and dispatch through its exhaustive `$match`. Use the existing narrow
`@beep/schema/LiteralKit` subpath already established by this package's
Alignment and Extraction models; do not export a behavior-only helper through
the package barrel.

Preserve capture precedence: group one selects end-of-line hyphen, group two
selects whitespace, and both ordinary-text alternatives select text. The
literal controls only token construction; `match.index`, `Str.length`,
`lowerSegments`, UTF-16 source offsets, code-unit token expansion, and raw
source-slice recovery remain unchanged.

# Migration inventory

- `Alignment.behavior.ts:9-17` — import `LiteralKit` from the narrow schema
  subpath and define the private named kit beside the minimal-fold constants.
- `Alignment.behavior.ts:177-203` — replace the temporary boolean object and
  object-pattern branches with one literal derivation and exhaustive match.
- `Alignment.test.ts:88-203` — retain Unicode lowercase expansion and offsets,
  whitespace folding, dropped/retained end-of-line hyphens, independent
  repeated-hyphen choices, and ambiguous raw-slice rejection; add an isolated
  plain-text segment case only if existing public cases do not cover it.
- Live barrel search found no public `segmentKind` owner and no consumer beyond
  `minimalFoldTokens`; keep the domain private to Alignment behavior.

# Guard-deletion accounting

Delete the two-field `segmentKind` object and both boolean object-pattern
guards. The regex remains the boundary parser; the application branch receives
one legal literal.

# Encoded-side impact

None. The literal is internal and ephemeral. Alignment status, matched text,
source offsets, and extraction encodings remain unchanged.

# Test impact

Run the LangExtract Alignment suite and full `@beep/langextract` package
verification. The test table must distinguish whitespace, dropped
end-of-line hyphen, retained compound hyphen, and ordinary text.

# Risk and sequencing

Land in Tier 1C with foundation capability state. Preserve regex ordering and
source-offset arithmetic exactly; only the capture classification changes.
The bounded token-NFA and its shared transition budget landed after the first
design; preserve its token stream, optional-hyphen semantics, and fail-closed
exhaustion behavior unchanged.
