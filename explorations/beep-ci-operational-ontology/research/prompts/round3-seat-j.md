# Round-3 Seat J — deployed-carrier fidelity audit (grok, xhigh reasoning)

You audit the beep-ci-operational-ontology packet's claims about DEPLOYED source
carriers. Round-2 proved several confident carrier claims false against origin/main;
the application pass then wrote many NEW carrier claims. Verify every one against the
actual source in this working tree (which now includes PR #870). You are READ-ONLY:
no file writes, no git mutations.

## Claims to verify (each: TRUE / FALSE / IMPRECISE, with file:line + verbatim quote)

Packet root: `explorations/beep-ci-operational-ontology/`. Claim sources:
`ontology/docs/competency-questions.yaml` (CQ-009/010/019/020..026 notes),
`ontology/docs/literal-domains.md`, `ontology/docs/pre-glossary.csv`,
`research/kpi-measurement-rules.md`.

Against `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts`
and `QualityScheduler.ts`:
1. AdmissionWorkKind LiteralKit members are exactly full-proof, merged-preview,
   review-fix, publish; AdmissionPriority exactly publish, verify.
2. admissionTokenWeight: full-proof 3, merged-preview 5, review-fix 1, publish 1;
   the packet's "one token ≈ 5 GiB" gloss.
3. AdmissionConfig defaults: publishAgingSeconds 120, reviewFixClassCap 3,
   capacityMaxTokens 10, hardFloorGib 15; AdmissionSnapshot fields hardFloorEngaged
   and quarantined exist as claimed (CQ-023's StarvationException carriers).
4. Ticket/lease records: YeetAdmissionTicket has enqueuedAtMillis + nonce;
   YeetAdmissionLease has admittedAtMillis + weightTokens; the claim that the lease
   is created FROM the admitted ticket (the packet's `grantedFrom` edge — how does
   QualityScheduler.ts actually tie a lease to its ticket? nonce? pid+procStart?).
   State precisely what the linkage is.
5. The claim (CQ-009 note) that review-fix leases are class-capped with NO
   checkout/origin gate while full-proof work is origin-exclusive — find the actual
   gate logic in QualityScheduler.ts / Handler.ts admission call sites.
6. The claim (kpi-measurement-rules §1) that a publish's embedded full proof is
   requested as kind full-proof (so no caller requests `publish` yet) — check
   Handler.ts admission request construction.

Against `packages/tooling/tool/cli/src/internal/cli/TurboCache.ts`:
7. TurboCacheMode literals `local:rw` and `local:rw,remote:r` with mapped names
   LocalOnly / LocalWriteRemoteRead; "every other configuration fails closed to
   local-only" (CQ-024).

Against `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts` and
`Planner.ts`:
8. The ring buffer retains ~50 attempts per branch (the exact constant + eviction
   semantics); step records carry elapsedMs (CQ-025's actualWallMs carrier) and
   failedStepId (CQ-022's CommittedFailure carrier).
9. YeetProofTier is exactly full | cheap-gates | review-fix (distinct from
   AdmissionWorkKind — the packet claims the two domains share the review-fix
   spelling but are different enumerations).

Also flag ANY carrier claim in the new CQ notes I did not list that you can falsify.

## Output

A severity-ranked findings report (BLOCKER = packet asserts something the source
contradicts; WARN = imprecise/underspecified; NOTE = confirmed with nuance), each
finding with the verbatim source evidence. Emit the FULL report as your final
message — it will be captured to the packet by the orchestrator.
