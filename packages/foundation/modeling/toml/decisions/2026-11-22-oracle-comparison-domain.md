---
title: Compare the oracle within its representable precision
date: 2026-11-22
reversal: Remove normalization and extend generated values to datetimes and lone surrogates.
governs:
  - test/oracle.property.test.ts#canon
  - test/oracle.property.test.ts#oracle
  - test/oracle.property.test.ts#documentBoundedAtFourNestedTablesAndWidthFive
  - test/oracle.property.test.ts#assertOursAgainstCorpus
enforcedBy: []
---
Keep smol-toml imports confined to the differential oracle test module.
Generate conservative plain values without datetime classes, lone surrogates or NaN equality cases.
Compare corpus datetimes structurally at milliseconds because the oracle truncates finer fractions.
Parse oracle integers as bigint and normalize safe integers on both sides; stringify bigint inputs directly.
Normalize NaN and negative zero to distinct sentinels; exercise NaN round trips separately.
Use the full TOML 1.1 corpus as the authority when the oracle rejects or disagrees with a fixture.
Rejected: requiring raw object equality, default oracle integer parsing or oracle authority over the corpus.
Those alternatives confuse representation and precision limits with engine correctness.
