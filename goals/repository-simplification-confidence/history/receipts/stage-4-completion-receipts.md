# Stage 4: structured completion receipts

Lane: `rsc-h2-completion`. Implementation and reconciliation ship together.
The completion receipt is derived after merge; the manifest declares a final PR,
never its own future merge commit. Lifecycle state is unchanged.

## Contract and recovery

The additive schemas distinguish final and supporting PRs and optional acceptance
evidence. Legacy singular/plural PR fields normalize in memory; grandfathered
packets retain their bypass. `GoalCompletionVerifier` resolves a typed observation
without I/O. The GitHub adapter binds the final PR head to its merge result without
requiring original-head ancestry for squash or rebase. Single-parent commits do
not establish squash versus rebase, so method remains unknown rather than guessed.

Historical required checks come from ruleset versions effective at merge, with
the version endpoints retained in the receipt. Check runs use `filter=all`, so a
post-merge rerun does not erase a pre-merge result. Unsupported historical ruleset
conditions and unavailable observations remain unknown. Repository inventory
cannot reconstruct deleted rulesets; that historical completeness boundary remains
an adapter limitation. Proof-fact and packet-history evidence references are
recognized but remain unknown until a head-bound provider is implemented.

The reused `MergeGateCheckRun` lives in a schema-only module with its existing
identifier and public re-export retained, preventing completion observations from
importing merge-handler runtime wiring.

Storage reuses `resolveProofLedgerLocation`: the owning clone's
`.beep/goals/completion-receipts.ndjson`, separate from ProofLedger. ProofFact
version, expiry and TTC semantics are unchanged. Reads reject mismatched repository,
packet, declaration digest or PR; incomplete trailing rows are ignored. A failed
refresh cannot displace definite evidence. Doctor reads only;
`bun run beep goals completion refresh --slug <packet>` is the explicit writer.
Revert the owning PR to restore the former reader; delete derived receipts and
refresh to rebuild them.

## Commands and fixture outcomes

All heavy commands use `beep-heavy` with the user-session bus environment; at most
two H2 admissions run concurrently. Scratch command logs remain lane-local.

| Fixture | Expected outcome |
| --- | --- |
| Merged PR without packet-name title, squash/non-ancestor accepted head | verified |
| Merge and rebase observation shapes | verified |
| Unmerged final PR, required red, stale head-bound evidence | unsatisfied |
| GitHub/rate-limit error or missing historical ruleset | unknown |
| Grandfathered manifest | verified bypass |
| Nongating historical statement failure | overall verified, sub-claim unsatisfied |
| Post-merge red rerun following pre-merge success | required check verified |
| Changed nested initiative.packetId | different declaration digest |
| Partial append or stale digest/PR | ignored |
| Unknown refresh following definite receipt | definite evidence retained |
| Doctor online versus explicit refresh | read-only versus append |
| All live manifests | decode without rewrite |

Final package, parity and coverage results are recorded in the lane handoff.
Required commands: `beep quality package-verify @beep/repo-cli`,
`beep quality test-tsgo`, `beep docgen local --base origin/main`,
`beep ci lane jsdoc-ratchet`, `CI=true beep knowledge refs --check`,
`beep quality fallow audit`, `beep quality fallow health`, and scoped goal-test
coverage compared with the existing touched-file baseline rows.

## Qualification and scope

Qualified implementation and fixture head: `9e05651ae0237b10ffed2da4d3574909715dd74d`.
Later delivery commits contain packet evidence and main integration. The source
review returned ZERO ACTIONABLE FINDINGS at this head; it is separate from the
compiler and runtime results below.

| Command | Result |
| --- | --- |
| `beep quality test-tsgo` | pass after the Arbitrary import and markerless-doctor repairs |
| `beep docgen local --base origin/main` | pass, one package aggregated |
| `beep ci lane jsdoc-ratchet` | pass; zero non-generated legacy findings |
| `CI=true beep knowledge refs --check` | pass; zero live gated observations after D repaired the inherited SPEC literal |
| `beep quality fallow audit` / `health` | pass; zero introduced findings, one inherited-adjacent audit finding |
| Scoped goal and merge-gate coverage | 258 tests passed across 13 files; every existing touched baseline row met or improved |
| `beep quality package-verify @beep/repo-cli` | fail (handoff gate incomplete: repaired-head full run never admitted; cancelled while queued, not a test failure) |

All heavy commands ran through the canonical admission wrapper, with at most two
H2 admissions. The scoped fixture run uses its own module-cache path to avoid
colliding with package audit. No baseline or suppression was added. Percentages
below are the scoped read, not a claim of repository-wide coverage. Existing
baseline uncovered counts also met or improved.

| File | Lines current / baseline | Statements current / baseline | Branches current / baseline | Functions current / baseline |
| --- | --- | --- | --- | --- |
| Bootstrap.schemas.ts | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| Completion.ts | 80.15% / no row | 76.71% / no row | 54.54% / no row | 71.02% / no row |
| Doctor.ts | 81.58% / 63.34% | 81.31% / 63.59% | 71.73% / 42.42% | 88.4% / 72.09% |
| Goals.command.ts | 50% / 50% | 50% / 50% | 100% / 100% | 0% / 0% |
| Goals.schemas.ts | 100% / 100% | 100% / 100% | 100% / 100% | 100% / 100% |
| MergeGate.schemas.ts | 100% / no row | 100% / no row | 100% / no row | 100% / no row |
| MergeGate.ts | 100% / no row | 100% / no row | 100% / no row | 100% / no row |

The implementation adds completion schemas/service/readers and explicit refresh,
changes doctor reporting and command registration, and extracts the existing
MergeGate check schema to break the runtime/static cycle while preserving its
identifier and re-export. Reconciliation changes only the three named manifests.
No root/generated wiring or reference links are authored by H2. The initial patch
note was retired once D policy #1566 merged because `@beep/repo-cli` is private.

First hosted head `9737a4a77e` failed Property Laws and both repo-cli unit shards
on the invalid Arbitrary module path; the second shard also exposed unconditional
doctor root discovery in markerless fixtures. Completed job logs were read at once.
Imports were repaired in `c433eba29e`; doctor eligibility and the root-probe
regression assertion were repaired in `9e05651ae0`. Their inbox rows are acknowledged
against the repair commits. The separate review missed the import error; the test
compiler, rather than that assurance, establishes the corrected module boundary.
Hosted proof is read on the latest PR head. Vercel's two deployment statuses report
rate limits and are environment-only under the existing merge-gate exception.

## Doctor before and after

Before, at `9914e98a86`: packets=211, blocking_new=0, blocking_inherited=0,
blocking_resolved=0, advisories=3; all three were completion-gate-unsatisfied.
After, offline without clone receipts: packets=211, blocking_new=0, advisories=3;
the three typed packets are completion-gate-unknown. Legacy packets retain their
offline fallback. Read-only live observations verify all three PR-merge parts.
The final online fleet command reports packets=211, blocking_new=0,
blocking_inherited=0, baseline_resolved=0, advisories=19. All three targeted
packets are absent from that advisory list; 19 legacy packets have unknown
historical evidence. Post-merge refresh
remains pending the orchestrator's merge.

## Known advisories

All three observations bind 16 historical required contexts to the accepted head.
Ruleset `10240248`, version `50918272`, effective `2026-09-25T14:46:59.802Z`,
was selected from repository ruleset history. Overall outcomes below concern
merged-PR acceptance. Statement sub-claims are separately reported and nongating
under R79/R80. Automated non-required red attribution stays unknown; the explicit
log comparisons below supply the independently reviewed attribution.

| Packet / final PR | Accepted head | Merge commit / time | Outcome / sub-claims |
| --- | --- | --- | --- |
| document-ast-pattern-classification / #1429 | e9eafb4a6f296ffb5f24a5b5cf610624199c43c3 | 2f2426b695ff2d082443dceb484a40c0c41c1b77 / 2026-10-06T00:55:25Z | verified; draft-ready verified; review window 45m35s verified; merge-ready verdict unknown |
| practice-box-onboarding / #1462 | b106798b3e6070ab539e338bde3704c27d3cf031 | 98c3947d44359fd230a9adfb082268847e3174fb / 2026-10-06T09:51:53Z | verified; draft-ready verified; review window 7s unsatisfied; merge-ready verdict unknown |
| push-first-publish / #1427 | 4bdc437219e17d9a3ad169781eba38edf91ba639 | 01d8c18f314661a7957ef6420b2180ffb29804d1 / 2026-10-06T01:36:13Z | verified; draft-ready verified; review window 44m33s verified; merge-ready verdict unknown |

### Non-required reds and follow-ups

#1429's merge-base is `cd6c9a1b7223c3e6c7b14265cd0f0c22517f89d4`. After
walking past cancelled runs, its nearest completed main ancestor is
`b877057bc49dca15be45cc7c494e6c9326e5cc92`, run
[37385597353](https://github.com/beep-effect/beep-effect/actions/runs/37385597353).
A later main run is not its valid baseline.

- Lint Policy: pending at merge, final failure at `00:59:04Z`; head job
  `112041342859` versus baseline `112020340130`. Baseline failures are
  `knowledge:refs-check` and `lint:schema-first`. Head adds `lint:tsgo-rules`,
  schema package `lint:laws`, and law-practice/server `lint:laws`. Attribution
  is mixed: inherited root failures and introduced alias/PatternOntology errors;
  the unexplained law-practice delta remains unknown rather than charged to H2.
- Coverage Regression: pending at merge, final failure at `01:13:36Z`; head
  `112041342921` versus baseline `112020340159`. Head has 11 rows: PracticeKg
  four, RestorationTransformations three, Retire three, PatternOntology one.
  The baseline log is incomplete, so full-lane attribution is unknown. The new
  PatternOntology branch row is an introduced follow-up; other rows cannot be
  classified from absent baseline evidence.

#1427's merge-base and nearest completed main ancestor are
`61d1b494f05cb3974538071d5b5d1b32a25443d0`, run
[37395917048](https://github.com/beep-effect/beep-effect/actions/runs/37395917048).

- Lint Policy: pending at merge, final failure at `01:42:00Z`; head
  `112053879379` versus baseline `112052129675`. Head failures
  `knowledge:refs-check` and law-practice/server `lint:laws` are a subset of
  baseline failures (which also include `lint:schema-first`): inherited.
- Coverage Regression: pending at merge, final failure at `01:46:53Z`; head
  `112053879351` versus baseline `112052129591`. Seven baseline rows
  (PracticeKg four, Retire three) persist; 13 introduced rows are Yeet Guards
  three, Planner one, PullRequest four, Yeet.command two, RepoRun.models three.
  Attribution is mixed. Introduced rows are tracked for the program's consolidated
  quality repair; they do not negate the verified required-lane acceptance.

#1462's nearest completed baseline is `bde2e5b8c763b2e5de10b0c9b5a89d145bfc8531`,
run `37436678262`. No failing Lint Policy/Coverage Regression lane was observed
on its head or baseline. Its short review window is preserved as a historical
unsatisfied statement sub-claim, with no lifecycle reset.

Follow-up ownership: the program orchestrator routes introduced historical lint
and coverage rows to their original packet owners in the consolidated repair.
The five remaining substring-only legacy citations (`agent-pipeline-velocity`,
`chat-input-and-theming`, `effect-native-migration`, `mcp-host-retrofit`,
`uspto-mcp`) require owner-confirmed typed declarations in a later migration; H2
changes only the three specified manifests. Missing historical verdicts remain
unknown until an authentic accepted-head verdict is recovered.

## Capacity-blocked delivery

The full repaired-head package command remained unstarted through canonical
admission contention and a retry. The worker stopped only its queued command
and cancelled its owned readiness monitor before handoff. No package result is
inferred from stopping the wrapper. The qualified source is published at PR
#1574; this delivery evidence is committed locally and awaits Yeet publication.
The PR remains draft. The full package gate, content-final ready transition,
readiness monitoring and orchestrator merge remain open.

The final GraphQL lane reported API rate exhaustion. REST updated the PR body
and confirmed its draft/head state. The last successful thread read had zero
threads; a final thread read is unknown until GraphQL quota recovers.
