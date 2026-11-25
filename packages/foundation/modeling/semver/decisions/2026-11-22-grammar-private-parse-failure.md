---
title: The grammar is plain synchronous code that throws a private ParseFailure
date: 2026-11-22
reversal: Rewrite the internal grammar as Effect or Result combinators with typed errors threaded through every low-level parser.
governs:
  - src/internal/grammar.ts#ParseFailure
  - src/internal/grammar.ts#catchParseFailureAtEntryPoint
  - src/internal/grammar.ts#parseVersion
  - src/internal/grammar.ts#parseRange
  - src/internal/grammar.ts#parseComparator
enforcedBy: []
---

The recursive-descent grammar is plain synchronous code. A low-level parser that
fails throws the private `ParseFailure`, which carries only the failure position;
`catchParseFailureAtEntryPoint` converts it to a failed `ParseResult` at the three
entry points, so it never escapes them. `SemVer`, `Range` and `Comparator` build
their own domain errors from that result, and every other thrown value is
rethrown as a defect.

Parsing is pure and total, so an Effect wrapper adds ceremony without value, and
one set of parsers serves every entry point without threading error constructors.

Rejected: an `Effect`/`Result` combinator grammar with a typed error per concept,
which the repo's typed-error law suggests by default.
