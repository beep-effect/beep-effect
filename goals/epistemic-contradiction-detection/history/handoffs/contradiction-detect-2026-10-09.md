lane: contradiction-detect
head: 8f4b6ba7461c5c1b9bd7035185a11b6ce012c2bd (implementation 9edd003a48 plus main merge; handoff commit follows)
PR(s): none (stopped at the brief's repeated-blocker gate before publication)
package-verify: @beep/epistemic-domain: fail (latest audit; actual ref decode corrected in 9edd003a48, no fresh proof); @beep/epistemic-use-cases: pending (queued pipeline cancelled at stop)
hosted-parity: test-tsgo: pass (330 CLI tests; package checks separately outstanding) | docgen local: not run (stop; domain package docgen passed) | jsdoc-ratchet: pass | knowledge refs: fail (inherited RSC SPEC:374:4 observation, base attribution recorded) | fallow audit+health: not run (stop) | config-sync check: pass (one added alias per generated file; no inherited hunk) | scoped coverage: not run (audit stopped pipeline)
handoff: goals/epistemic-contradiction-detection/history/handoffs/contradiction-detect-2026-10-09.md
open items: Resume both package-verify commands, package suites, coverage and remaining parity before Yeet publish; P0 complete, P1/P2 in-progress, P3/P4 pending, packet active. Option 1 uses class-specific detector identities and SemVer; reversal requires a future contract-owner migration, with ContradictionMatchBasisKind widening a follow-up, never a dependency. DetectedContradiction emits content plus key/digest; full-entity fixture lifts assert hasValidSeals, with content/submit checks additional; any future stamping adapter stays caller-owned. Proposal facts use subject/predicate/value/polarity from the other assertion, content-derived ids and shipped digests; changing shape/id rules requires a detector version. Exact negation is equal value/opposite polarity on any predicate; value-conflict is unequal values/both asserted on declared single-valued predicates; all other combinations emit nothing. Undeclared predicates default multi-valued and missing modality comparable; reversals require explicit representation contracts and versioned semantics. Four concept files were hand-authored after the architecture dry-run planned placeholders/out-of-scope writes; friction receipt is research/OPPORTUNITIES.md; reversal removes concept/export/barrel and reruns config-sync. Alias diff is one added ContradictionDetection entry in each generated file, no inherited hunk. No shipped schema/dependency edit, push, PR, monitor, reflection or lifecycle flip; owned proof units stopped and P0 rows acknowledged, without claiming a green re-run.
blocked: repeated domain audit diagnostic triggered the brief's stop condition; actual call fixed at 9edd003a48 but qualification and publication remain unfinished.

Evidence pointers: history/p0/2026-10-09-contract.md;
history/p1/2026-10-09-implementation.md (full alias hunks);
history/p2/2026-10-09-verification.md; research/OPPORTUNITIES.md.
Focused golden suite: 19/19 pass twice on c833513460. Full domain suite:
9 files / 99 tests pass. Latest audit's repeated diagnostic was the unchanged
BeliefVersionRef decode at test line 67; the first repair targeted another call.
Corrected in 9edd003a48, no re-run after the stop. Inbox ack receipts bind the
first repair c833513460 and actual ref repair 9edd003a48. Source/packet is retained
in local commits; the only subsequent commit is handoff/stop metadata.
Graft source discovery: one call, approximately 55,724 tokens saved.
