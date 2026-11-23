---
title: "P2: OccurrenceId is minted from a receipt through definePreimage with a literal canonical unit; the citation path keeps its proof gate"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Type the unit slot as OffsetUnit again or require a VerifiedTextAnchor in mintOccurrenceId, by a decision file that bumps occurrence/v1 if the bytes change."
---

OccurrencePreimage is declared with @beep/jsonc/Mint definePreimage under domain tag occurrence/v1 with a committed golden vector, so a changed preimage fails its golden check unless the tag is bumped. The tuple is the one p0-rq4 fixes. Its unit slot is S.Literal("utf16-code-unit") rather than OffsetUnit: one range in two units would otherwise be two ids for one occurrence. mintOccurrenceId takes Anchored, a powerless receipt, because the id is a function of the receipt's fields and not a claim of proof: the L2 anchors table, the memory read path and the v3 receipt transform all hold receipts. The proof gate stays where it is today: makeCitationMentionId still accepts only a genuine VerifiedTextAnchor, projects it to its receipt and then mints. The error channel is PreimageMintError (schema error or canonicalization error); a quote with a lone surrogate, which TextAnchor admits, fails there. Goldens were checked on this base: the vector over the existing cm1 test source gives occurrence sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48 through the production minting function and through an independent SHA-256 over the JSON text.
