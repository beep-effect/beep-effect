# Round 2 Seat G — free adversarial attack

Successor of round-1 seat D. Zero credit claimed for grill-frontier items, ring-buffer
existence, right-censor reporting, TurboQuery reason-loss, or CQ-019B-as-recipe.

## Findings

- [BLOCKER] CQ-019 notes / S6 completeness — "affected-scoped" is defined by the edge it
  requires, so the recorded completeness letter is circular and an omitted-edge A-Box
  still launders. The round-1 fix redefined `scopedByComputation` as "trusts the affected
  set of" and wrote: every *affected-scoped* Proof and emitted schedule MUST carry the
  edge. Nothing but the edge identifies a subject as affected-scoped. No producer (S7
  projection is unbuilt; SHACL is S6) can be shown to force a filtered schedule to
  assert it. Partner 019B does not close this: it still joins on the edge, so omitting
  the edge greens 019B too.

  Letter-satisfying launder (typed fail-open exists; filtered schedule asserts nothing):

  ```turtle
  @prefix ciops: <https://oip.law/ontology/ci-ops#> .
  :c1 a ciops:AffectedComputation ; ciops:hasAffectedOutcome :fo .
  :fo a ciops:FailOpenOutcome .
  :sched a ciops:Proof .    # real work units: FilterScope. no edge, no hasScope
  ```

  CQ-019: zero rows. Completeness letter: `:sched` is not "affected-scoped". Honest
  remap is observationally identical. Non-circular substitute (closed scope-provenance):
  (1) every Proof/Schedule has `hasScope` *derived from its WorkUnit scopes*, not from
  the trust edge; (2) `hasScope ≠ FullRepoScope` ⇒ `scopedByComputation` MUST exist;
  (3) every `AffectedComputation` has a closed-enum outcome. Free `hasScope
  FullRepoScope` without (1) still lies.

- [BLOCKER] CQ-012 vs CQ-007 — the round-1 "lever-attribution instrument" never reads
  the property admitted to close the queue-wait game. CQ-007 requireds now include
  `queueWaitMs` inside `timeToCertaintyMs`. CQ-012 (triage: the repaired attribution
  query) still chains only lock/exec/repair/ci over that same total. After #870 the
  hypothesized effect is queue replacing bounce. CQ-012 then reports lock-share drop
  while queue is an unprojected remainder (`1 - sum(shares)`). Traceability-matrix
  line for CQ-012 lists no `queueWaitMs`. NL still says "versus execution, repair, and
  CI wait". The admission was local to CQ-007; the instrument that was supposed to
  *use* it was not updated.

- [BLOCKER] `scope.md` KPI + #870 ControlIntervention — before/after cannot be
  attributed from the declared vein, and the post-period deletes the pre-period.
  Scope.md starts the clock at "first failed attempt" (or first attempt after an
  edit). `queueWaitMs` notes call seat-request-to-grant wait *inside* the episode.
  #870 converts an in-journal bounce attempt (`ProofState.ts` still emits "Another
  Yeet full proof…"; probe `LOCK_SENTENCE` matches that substring) into out-of-journal
  ticket wait. `YeetAttemptStarted`/`Finished` (`AttemptJournal.ts`) have no ticket,
  lease, or enqueue field; `QualityScheduler.schemas.ts` is absent from this tree.
  Fleet `--exclude-bounces` already dropped the 17% bounce economy from the published
  41.3m P50, so a post series that includes queue is not on the same clock.
  Perishable *this week* (summaries in the markdown are not a substitute):
  1. `~/YeeBois/projects/*/.beep/yeet/runs/*/attempts.ndjson` for the 27-checkout
     fleet, with sha256 + mtime + checkout HEAD. Each branch keeps 50 starts; a
     post-#870 yeet on a busy branch drops a pre-#870 attempt from the *same file*.
     The experiment is self-erasing.
  2. A sample of verdict `message` values matching `LOCK_SENTENCE` (classifier dies
     when bounce text is replaced).
  3. This checkout's journals *before* the corpus rebase (baseline calls them pure
     pre-intervention; first post-rebase yeet mixes the epoch).
  4. `gh run list` for 2026-08-20..28 (`run_started_at` is already rewritten; createdAt
     /updatedAt still exist).
  5. On main checkouts, whatever file actually stores tickets/leases (this packet
     cannot name it). If that store rotates, `queueWaitMs` is unrecoverable.
  Missing, not perishable: no `ControlIntervention` individual with `landedAt
  2026-08-27T19:52:03Z` exists anywhere under `ontology/`. CQ-016 has nothing to
  partition.

- [WARN] admission law, five round-1 properties — not wholesale retroactive-CQ
  laundering. `queueWaitMs`, `occurredAt`, `episodeStartedAt`, `hasCurrentEpoch` were
  demanded by pre-repair NL (queue wait / window / "current"). Lawful: SPARQL caught
  up to an existing question. It still matters in two narrower ways. (a)
  `attributedDelayMs`: original NL was "most delay certainty" + "earliest and
  cheapest"; the repair wrote "(ranked by attributed delay)" into the NL *and*
  collapsed earliest into cheapest-by-p50 in the same pass. That is the ORSD hazard
  (term minted, CQ rewritten to name it). (b) `occurredAt` / `episodeStartedAt`
  duplicate `recordedAt` / `beganAt` as fresh names so each broken query got its own
  timestamp instead of one temporal vocabulary. The law held as a gate against
  CQ-less classes; it did not hold as a brake on per-query property minting.

- [WARN] `hasCurrentEpoch` vs CQ-015 note — partner B11 (task-hash grain) was "FIXED"
  as a note on CQ-015. The same pass admitted `TreeState → CacheEpoch` as the queryable
  "current" on CQ-014 and froze that grain in the S4 input suite. S4 will extract the
  coarser property. The note is not a candidate, not a ledger issue, and not a
  `cq_justification` constraint. The T-Box admission contradicts the caveat.

- [BLOCKER] pre-S4 loop — four concrete holes, none philosophical.
  1. Grill/delta inversion vs the 3-round cap. Triage and README order grill-then
     round-2-delta. This "final" round 2 is firing on the pre-grill suite. Grill
     admissions (scheduling CQs, ScheduleProposal) will either skip the panel or
     consume the last round. DECISIONS `loop-bounds` (dry-2) is not the loop that is
     running; the quality-loop cap is.
  2. Disposition self-review. Independent seats wrote findings. One fixer (Fable)
     authored the CQs, the repairs, *and* the REJECTED/FIXED map. Seat D's CQ-019
     invariant was "FIXED" by redefining the property (see first finding) rather than
     encoding D's counterexample. Independent seats cannot veto a definitional FIXED.
  3. Round-0 is the only mechanical gate and it is not in the packet.
     `round0_check.py` is cited by `s4-lane-contract.md` §6 and README ("scratchpad-
     run"); it is not in this tree. Observed round-0 catches were census, "provisional"
     prefix, probe-wrong-root. Structurally invisible: SPARQL-vs-NL, vacuity,
     convention circularity, VALUES-as-A-Box, source pin, adversarial graphs. "Round-0
     re-run: 0 blockers" after 14 query repairs is a category error. The S4 example
     `frozen_inputs` hashes two of the five files the contract table freezes, so a
     lane that copies the example under-freezes and still passes the sketched check.
  4. Effort-escalation is falsified by this round. Round-1 seats A–D at max/xhigh did
     not execute SPARQL. Round-2 seat E's Oxigraph run found BIND/UNION and aggregate
     oracles the xhigh adversary missed. Max reasoning does not conjure an engine.
     The missing capability is a failing-fixture runner, not a higher `reasoning_effort`.

- [WARN] parameter-binding convention — two holes the "a given X" phrase-match
  created. (1) VALUES are bindings, not an A-Box. ORSD §7.1 still wants non_empty
  against a seeded A-Box; the suite contains no turtle/graph, only VALUES individuals.
  Empty graph + VALUES ⇒ zero rows on every relational Must. (2) CQ-007 NL is "For an
  episode" (no "a given"), so it escaped the harness. The decomposition of "an"
  episode is a global dump with no window, while CQ-012 windows on `episodeStartedAt`.
  Membership of the two Must KPI queries can diverge.

- [WARN] traceability regen — seat B's drift fix inverted the detector.
  `regen_cq_artifacts.py` sets `ontology_terms := required_classes + required_properties`
  from YAML and never parses SPARQL. CQ-019 SPARQL binds untyped `?subject` ("proof or
  schedule"); requireds still list `Proof` only; the matrix is "in sync" by construction
  and cannot see the subject-class hole. The repair certifies the YAML author's claim.

## Attacks that failed

- Treating all five admissions as retroactive-CQ laundering (four were NL-first).
- Re-raising CQ-019B as the completeness condition (it still needs the omitted edge).
- Re-raising ring-buffer *existence*, right-censor reporting, TurboQuery reason-loss,
  Scope/SeatRequest/Agent grill, corpus rebase, DRR-as-runtime, S6 SHACL deferral.
- Calling "18 tests parse" a lie (they claimed parse, not execution).
- `LaneKind` as catalog (recorded REJECTED; no new evidence).
- Unit 7 file missing from this tree (that is the known rebase question).
