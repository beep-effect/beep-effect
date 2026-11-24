---
title: "P5: the legal-intake TTL rendering does not parse as Turtle, so row 1 records its parity as a refusal"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Rewrite legal-intake.ttl with full IRIs or escaped local names in a later commit that refreshes the frozen digest and the parity record, by a decision file"
---

Row 1 measured the `legal-intake` rendering parity that design section 5.1 asked for. The n3 driver refuses `packages/law-practice/domain/assets/vocabulary/legal-intake.ttl` at line 5 (`Unexpected "beep:taxonomy/legal-intake"`): Turtle `PN_LOCAL` forbids an unescaped `/`, and every local name in the file has one. `docketing.ttl` and `party-roles.ttl` parse. The file is a published rendering whose bytes the move keeps (decision `2026-11-23-p5-the-law-practice-asset-pack-and-its-json-scheme-sources`), so row 1 does not repair it. The frozen fixture `ontology/test/fixtures/legal-seed-freeze.json` records `turtleParses` per rendering and `legalIntakeParity` as `Refused` with the parser message, and `LegalSeedFreeze.test.ts` asserts both. The row 11 pack test therefore compares only the two parseable TTL renderings with their SKOS projections and asserts that `legal-intake.ttl` still refuses with the same message, so a silent repair or a further break shows up as a test failure.
