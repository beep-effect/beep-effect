# Pre-S4 review loop — round 3 triage (the cap's last round), 2026-08-27

Panel: seat H (codex, ULTRA — post-grill delta attack, all semantic claims
Oxigraph-executed or scheduler-executed), seat I (codex, MAX — ruling→artifact +
disposition audit), seat J (grok, xhigh — deployed-carrier fidelity). Reports:
[round3-seat-h.md](./round3-seat-h.md), [round3-seat-i.md](./round3-seat-i.md),
[round3-seat-j.md](./round3-seat-j.md). Raw totals: 26 blockers / 18 warns / 3 notes,
heavily convergent. Every disposition below names its landed carrier; the suite gates
(`validate_packet.py` + `run_cq_suite.py`) are green post-fix at 25 seed tests + 19
must-fail fixtures, validator 0 blockers / 1 aggregated S5-visibility warn.

## Convergent blockers (multiple seats, highest confidence) — ALL FIXED

| Finding | Seats | Fix (carrier) |
|---|---|---|
| CQ-009 audited checkout exclusion; deployed law is ORIGIN-keyed, kind-independent, review-fix exempt via empty key | H-04 + J-B3 (+J-U2) | Query rebuilt on `hasOriginKey` (typed grants, `!= ""`), `occupiesCheckout` REMOVED from the model, closed-world record retargeted, scope.md corrected, fixture = same-origin/different-checkout |
| `grantedFrom` is not a stored edge — ticket deleted at admission, no FK, no coexistence | H-05 + J-B4 | Edge REMOVED (glossary, CQ-021 NOT-EXISTS, closed-world, seed); CQ-021 = queued tickets only; CQ-023 scoped to queued; measurement-rules gained the self-erasing-handoff limitation; scheduler transition-journal chip spawned |
| `QuarantineException` mis-read deployed quarantine (corrupt-record paths, not owner state) | J-B1 + H-W03 | Member REMOVED; domain = {HardFloorException}, ETL-derived from snapshot-global flag (J-W5 folded in) |
| Aging is priority promotion, not a service bound — deriving the starvation bound from it was false | H-07 + J-W5 | `starvationBoundMs` re-declared as OPERATOR/S7 POLICY fact (the monitor's threshold — the invariant exists BECAUSE the scheduler guarantees nothing); publishAgingSeconds stays an extracted fact, not the carrier |
| Two-kind validator falsely licensed `dependsOn` (substring) and `estimatedFailureProbability` (Could roots) | I-03 + H-09 | Exact-QName tokens + Must/Should-only roots; unlicensed term is now a BLOCKER; `dependsOn` gets an honest `supports=dependsOnTransitive`; `estimatedFailureProbability` DEFERRED (removed; CQ-018 stays Could with empty requireds) |
| Auditor-gate §4b was an obsolete abridgment; `_shared/schemas` "missing" | I-02 + H-14 | §4b rewritten to the skill's REAL protocol (observation→hypothesis→analysis→proposal, blinded+adversary seats, mechanical `--gate`, steward ratification) with lane-output reconciliation; ROOT CAUSE of "missing": the `~/.agents/skills` mirror is STALE (Aug 17) while `~/.claude/skills/_shared/schemas/` holds all eight contracts — mirror re-sync recorded as an S4 LAUNCH PRECONDITION; skill+schema digests added to the freeze (H-14) |
| `MaxGrantCost` hard-duration residue in UC-002/UC-001/scope | I-04 + H-W06 | Charge-vs-capacity + advisory-screen language everywhere; hard limits named S7 territory |

## Seat H (delta attack) — remaining dispositions

| # | Finding | Disposition |
|---|---|---|
| H-01 | CQ-019 arm 2 missed a proposal whose derived (step-level) scope was narrowed with no materialized edge | FIXED: arm 3 derives scope through `hasStep/schedulesWorkUnit/hasScope`; fixture cq019-derived-scope-gap.ttl |
| H-02 | Plain-string quantities lexically green in CQ-010/023/026 | FIXED: `isNumeric` guards treat non-numeric datatype as violation; fixtures cq010-string-tokens, cq026-string-budget; cq023-invented-exception carries the numeric path implicitly |
| H-03 | CQ-020 merged proposal sequences; "current" unqueryable | FIXED: `hasCurrentProposal` admitted (hasCurrentEpoch precedent), `?proposal` projected, `proposedFor` removed |
| H-06 | CQ-022 cancelled healthy retries (episode-scoped join) | FIXED: `VerificationAttempt` + `inAttempt` admitted; attempt-scoped join; `failsEpisode`/`servesEpisode` removed; fixture cq022-cross-attempt (rows_eq_0) |
| H-08 | Binding convention was prose-only | FIXED: `bind_params` machinery in the runner (one-tuple enforcement, all-blocks substitution, rebind-identity + mutation self-tests) + static one-row/same-tuple checks in the validator |
| H-10 | CQ-008 accepted an untyped ticket as a grant; WaitingGrant undead | FIXED: typed `SeatGrant` + ActiveGrant-only; WaitingGrant REMOVED from GrantState; fixture cq008-ticket-not-grant (rows_eq_0) |
| H-11 | CQ-013 negation over undeclared `p50Ms` closure | FIXED: `p50Ms` closure record added (writer contract; S6 SHACL); CQ-013 note updated. The "coverage violation instead of cheapest" reshape was NOT adopted — closure is the honest fix, the query stays |
| H-12 | Any invented exception suppressed CQ-023 | FIXED: negation pinned to the closed member; fixture cq023-invented-exception |
| H-13 | Probe estimator was not nearest-rank; phantom "v2 conforms" | FIXED: probe v3.2 (`ceil(p*n)-1`), fleet re-run appended to the baseline (headline unchanged at n≈284), measurement-rules conformance sentence rewritten honestly |
| W-01 | CQ-019 NL narrowed while arm 1 is deliberately universal | FIXED: NL widened ("any subject") |
| W-02 | Dangling provenance target laundered | FIXED: arm 4 + closed `hasAffectedOutcome` + fixture cq019-dangling-target |
| W-04 | Cache posture was spec-level and two-state | FIXED: moved to WorkUnitExecution; `CallerControlled` member added; fail-closed precision recorded |
| W-05 | CQ-025/026 joined any current estimate | FIXED: `usedCostEstimate` (immutable admission snapshot) on execution and grant |
| W-07 | scope.md contradicted the episode clock | FIXED: scope defers to the ETL law's three clock cases |
| W-08 | "proof is a fact" / causal-impact overclaims | FIXED: ORSD evidence phrasing; UC-005 observational deltas |
| W-09 | Literal-domain members bypassed the checker | FIXED (warn-level by design): validator parses the table, licenses via exact QName/seed/`*(supports: ...)`, aggregates unexercised members into one S5-visibility warn — the licensed DOMAIN is the admission unit; member-level blockers would force vacuous fixtures |
| W-10 | S4 candidates could cite a Could CQ | FIXED: `--s4-lane` mode rejects decision citations outside Must/Should |
| N-01 | "FULL" ambiguous for individuals/members | FIXED: §4b states no kind is exempt |
| N-02 | Frozen-input census omitted the Could CQ | FIXED: "26 CQs (18 Must / 7 Should / 1 Could)" |

## Seat I (disposition audit) — remaining dispositions

| # | Finding | Disposition |
|---|---|---|
| I-01 | `**/docs` gitignore silently excluded the ENTIRE `ontology/docs/` authority surface from every commit — the packet's core was never landed | FIXED: `.gitignore` gains `!explorations/*/ontology/docs/` (+`/**`) negations (modeled on the goals rules); the surface is staged and lands with the round-3 commit. Root-caused: `git add <dir>` silently skips ignored paths, and the original status listing never showed docs/ — nobody diffed the absence |
| I-05 | Baseline still causally named #870 `ControlIntervention` | FIXED: OperationalChangeEvent + observational qualifier in the baseline header |
| I-06 | Event registry regressed the retained-lock correction ("replaced") | FIXED: registry hypothesis + mechanism comment rewritten (lock RETAINED; contenders queue) |
| I-07 | Lane-contract unit 5/7 paths abbreviated with `...` | FIXED: full paths |
| I-08 | `--s4-lane` named but ignored (silent success) | FIXED: real argparse mode — telemetry completeness (5 frozen digests, corpus_commit, model), two-kind record rules, source_domain, statuses, counts, evidence-path existence; unknown args are an argparse error; missing file exits 1 |
| I-N01 | pyoxigraph positional-format deprecation | RECORDED (maintenance note; not changed this round — the suite pins no pyoxigraph version, revisit when it breaks) |

## Seat J (carrier fidelity) — remaining dispositions

| # | Finding | Disposition |
|---|---|---|
| J-B2 | `actualWallMs` carrier ("journal step records with elapsedMs") does not exist | FIXED: carrier corrected to `verdict.lanes[].durationMs` (attempt-level `elapsedMs` only for whole-attempt executions) in CQ-025, glossary, measurement-rules |
| J-W1 | 5 GiB gloss over-read | FIXED: CQ-021 note + glossary state the slot-default + reserve/floor formula |
| J-W2 | Fail-closed overclaim (CI/`--cache=` bypass) | FIXED: CachePosture domain note + CQ-024 note carry the resolver precision |
| J-W3 | `failedStepId` is verdict-nested, optional | FIXED: CQ-022 + CommittedFailure glossary carrier corrected |
| J-W4 | `publish` kind latent/unused | FIXED: CQ-021 + AdmissionWorkKind notes mark it reserved |
| J-W6 | `capacityAtAdmissionTokens` not a snapshot field; post-grant snapshot false-reds | FIXED: pinned as remaining-BEFORE-charge, ETL-reconstructed (CQ-010 note + glossary) |
| J-W7 | Ring buffer precision (50 starts per branch-file per checkout) | FIXED: measurement-rules §3 |
| J-U1 | CQ-019 notes vs TurboQuery reason-drop split | FIXED: closed-world scopedByComputation record already names raw-turbo-output ingestion; the CQ note inherits via closed-world reference (no packet split remains) |
| J-U2 | merged-preview origin-skipped, outside old CQ-009 | FIXED by the origin rebuild: CQ-009 is now kind-independent — merged-preview leases carry the same originKey and are covered |
| J-U3 | GrantState/ExecutionState/CancelClass are not deployed enums | FIXED: literal-domains ruling 6 (packet-side domains; S4 lanes must not hunt source enums) |
| J-N1..N5 | Confirmations with nuance | RECORDED in the respective notes (process-grain Agent, hotPaths reserved, config defaults) |

## Not adopted (with reasons)

- **H-07's "remove the hard-invariant claim"**: the grill ruled starvation a hard
  invariant; the repair keeps the Must CQ as the MONITOR of a declared bound and
  removes only the false claim that the scheduler provides the bound. A violation row
  is an operational finding to act on — that is what "hard invariant" means here.
- **H-11's coverage-violation reshape of CQ-013**: closure declaration is the honest
  minimal fix; reshaping the argmin into a coverage query would change the CQ's
  decision question.
- **W-09 member-level blockers**: warn-level aggregation adopted instead (rationale in
  the table).

## Residue for S4/S5 (recorded, not silently dropped)

1. **S4 LAUNCH PRECONDITION**: re-sync the `~/.agents/skills` mirror (stale since
   Aug 17; lacks `_shared/schemas/`) or pass `$SKILL`/`$SHARED` pointing at
   `~/.claude/skills/` explicitly in lane commands.
2. The aggregated unexercised-member warn (16 members) is S5's ratify-or-strike list.
3. CQ-013's `attributedDelayMs` retroactive-CQ flag stands for S5 (round-1 carryover).
4. The scheduler admission-transition journal (durable ticket→lease handoff) is a
   spawned repo-improvement candidate; until it lands, granted-wait history follows
   the measurement-rules fallback clocks.
