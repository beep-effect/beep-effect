---
title: "P4: party corrections across a logical key retract and reassert instead of superseding"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Allow cross-key supersession in the append law and migrate party fixtures back; existing retraction records stay append-only."
---

The append law accepts supersession only inside one (scope, logicalKey) partition. A party correction that changes the proposition's logical key (for example a corrected finance fact or a vetoed merge) is recorded as a direct Retraction of the old claim plus a newly minted claim, so the history stays checkable and nothing is silently overwritten. An exact replay of an identical record into PartyLedgerMemory is unchanged state, not a conflict; a different record under an existing id or claim/time key is still a LedgerConflict. Party challenge records must name existing claims at both ends.
