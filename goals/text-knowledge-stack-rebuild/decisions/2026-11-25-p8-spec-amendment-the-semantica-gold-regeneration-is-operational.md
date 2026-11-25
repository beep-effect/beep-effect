---
title: "P8 SPEC amendment: the L3/L6 exit's semantica gold fixture regeneration moves to operational follow-up #3554"
date: 2026-11-25
lane: "goals/text-knowledge-stack-rebuild-p7-retirement"
reversal: "Restore the subclause to the L3/L6 exit and hold the goal open until the C1 measure has run"
---

The L3/L6 exit (SPEC.md:450-460) includes "the semantica gold fixture is regenerated". P5 held that row (row 14, checkpoint `2026-11-23-p5-l3-l6-exits-recorded`): the gold projection is pinned by its canonical dataset digest, and the digest comes from an operational C1 measure run over a C0 ledger. That ledger needs the out-of-repo corpus and hosted embeddings that bill, so it is blocked on the operator and on money, which the autonomy charter escalates rather than decides. No placeholder digest was written. The code it needs is on `main`: `Dataset` equality is a quotient with an RDFC-1.0 canonical digest (`@beep/rdf` `Canonical`). The subclause leaves the PR completion proof and becomes operational follow-up issue #3554, which names its done condition. The other L3/L6 subclauses are unchanged. The P6 operational step (the Practice KG bundle rebuild and the matter-wall grants) is in no acceptance clause; it is tracked as issue #3555.
