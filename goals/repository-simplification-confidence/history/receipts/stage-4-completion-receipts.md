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

## Doctor before and after

Before, at `9914e98a86`: packets=211, blocking_new=0, blocking_inherited=0,
blocking_resolved=0, advisories=3; all three were completion-gate-unsatisfied.
After, offline without clone receipts: packets=211, blocking_new=0, advisories=3;
the three typed packets are completion-gate-unknown. Legacy packets retain their
offline fallback. Read-only live observations verify all three PR-merge parts.
Final online fleet command results are recorded in the handoff. Post-merge refresh
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
