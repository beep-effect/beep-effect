---
title: "SCHE-09 admission history retention is owned here; local-proof-under-ten consumes it"
date: 2026-11-09
reversal: "Move SCHE-09 to local-proof-under-ten by a superseding decision in both packets; the retained rows keep their schema."
---

The plan's candidate list put SCHE-09 (retain admission history beyond the 200-row ring, with pressure fields) under local-proof-under-ten while MAP.md row 1 listed it here; exploration ruling D23 gives it one owner, this goal, because retention of admission history is measurement; local-proof-under-ten reads the retained history as the before/after evidence for its scheduler levers (SCHE-08, SCHE-07, SCHE-01/02) and does not implement it. The ring is `RETAINED_ADMISSIONS = 200` in `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` today. Rejected (this author's addition, not part of D23): owning it in local-proof-under-ten, where the scheduler goal would grade itself on history it also writes. Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D23), recorded in the `explorations/ten-minute-certainty/MAP.md` candidate-table amendment (row 1).
