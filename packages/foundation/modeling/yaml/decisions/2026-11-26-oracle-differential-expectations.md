---
title: Block-structure parse expectations are literals authored once against an independent parser, never regenerated with this one
date: 2026-11-26
reversal: Derive the expected values from this package's own parse, or replace the battery with parse → format → parse round-trips.
governs:
  - test/oracle-differential.test.ts#OracleCase
  - test/oracle-differential.test.ts#groups
enforcedBy: []
---
A round-trip through this engine (parse → format → parse) is blind to a parse bug the formatter is faithful to: a mis-nested document re-emits mis-nested and still matches. The shipped P0, a trailing comment on the last key of a nested block mapping that swallowed the following dedent and absorbed the next sibling key, survived every fixed-point fixture that way. So every `expected` value in `oracle-differential.test.ts` is a committed literal authored against an independent reference parser, and a shared-defect round-trip cannot go green.
Provenance (the `test/fixtures/explicit-key/ORACLE.md` convention): the oracle is `yaml@2.9.0` (`YAML.parse` defaults; `parseAllDocuments` for the multi-document case), authored 2026-08-12 offline in a scratch script outside the test run. The case matrix was extended from the savvy-web-systems dogfood sweep of that date (51 cases, double oracle `yaml@2.9.0` + `js-yaml@4.3.1`, a case counted only where both agreed).
Later groups were authored the same way against `yaml@2.9.1`: plain-scalar continuation (2026-10-23, effected-promotion wave 3, W3-d), compact-sequence and block-scalar-item (2026-10-23, #2131), value-less flow mapping keys (2026-10-23, #2142; the `!!set` row expects this parser's plain-object projection of the oracle's two-member `Set`) and compact explicit keys (2026-11-08; its deeper-`:` rows are invalid under the spec's s-indent(n) rule and pin the oracle's tolerance, and a collection key has no comparable plain-object projection, so those shapes are pinned at the AST level in `composer-regressions.test.ts`).
The oracles are not dependencies of the suite; the committed literals are the contract.
Rejected: regenerating the expectations with this package's parser, or asserting only kit round-trips, both of which pass a shared defect.
Accepted limit: the multi-line flow rows indent their closing `}`/`]` past the block level (YAML 1.2 §7.4 requires flow content in a block value to be indented past it). A column-0 closer there is a known, comment-independent strictness divergence tracked as #340: this engine rejects it with a typed InvalidIndentation, and the no-comment control fails the same way, while `yaml@2.9.0` accepts it leniently.
