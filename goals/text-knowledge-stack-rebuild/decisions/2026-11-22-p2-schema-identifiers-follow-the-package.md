---
title: "P2: schema identifiers follow the package to @beep/text and the epistemic identifier fixture is regenerated"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Give @beep/text a composer that keeps the provenance segment for the three moved modules and restore the fixture from git, by a decision file."
---

packages/epistemic/domain/test/fixtures/value-schema-identifiers.txt pins 20 @beep/provenance/... annotation identifiers, and its test comment says they never move. They move in P2: an identifier is a schema annotation composed from a code path, not a published term (no registry shard or term-snapshot row names provenance, so L0-3 is not involved) and not a stored value (no reader of these strings exists outside the fixture). Keeping the old segment would be an alias for the retired name, which chapter 11 rule 3 forbids. The fixture is regenerated in the rename commit with exactly those 20 lines changed, and the later well-formedness commit adds the WellFormedText lines. The comment in ValueSchemaIdentifiers.test.ts is corrected: the fixture records identifier changes so they are reviewed, and a package rename under a decision is a reviewed change.
