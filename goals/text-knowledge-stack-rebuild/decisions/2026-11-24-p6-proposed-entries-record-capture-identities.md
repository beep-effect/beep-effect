---
title: "Proposed claim entries record capture identities so traversal can authorize each capture"
date: 2026-11-24
lane: "p6"
reversal: "Drop ProposedClaimEntry.captures and LawClaimProposals.captures, and authorize captures by the claim scope alone."
---

ActivityRecord.used names capture ids without their scope, so a traversal cannot decide whether a principal may see a capture from the activity record. ProposedClaimEntry now carries captures, a HashSet of the SourceTextIdentity values the proposal read; the claim proposal and office-action review writers fill it. ProvenanceTraversal mints each identity's CaptureId and authorizes the identity's scopeRef with provenance-traversal. An activity that used a denied capture is omitted, and only granted captures used by kept activities are returned. A capture id with no recorded identity is not treated as a capture.
