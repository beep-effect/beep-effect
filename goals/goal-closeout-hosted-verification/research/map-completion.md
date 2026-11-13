# Map: how goal completion is verified today, and what the 2026-11-12 rulings change

Read-only research for P0. Every claim cites `file:line` in this worktree
(branch `feat/goal-closeout-hosted-verification`, base `7a462a27d4f`).

## Legend

| Short | Path |
| --- | --- |
| `C` | `packages/tooling/tool/cli/src/commands/Goals/Completion.ts` |
| `CE` | `packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.ts` |
| `CES` | `packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.schemas.ts` |
| `CESv` | `packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.service.ts` |
| `GS` | `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts` |
| `DS` | `packages/tooling/tool/cli/src/commands/Goals/Decisions.schemas.ts` |
| `DP` | `packages/tooling/tool/cli/src/commands/Goals/Decisions.projection.ts` |
| `DR` | `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts` |
| `SS` | `packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts` |
| `RT` | `packages/drivers/github/src/ReviewThread.ts` |
| `T-comp` | `packages/tooling/tool/cli/test/goals-completion.test.ts` |
| `T-obs` | `packages/tooling/tool/cli/test/goals-completion-observation.test.ts` |
| `T-ev` | `packages/tooling/tool/cli/test/goals-completion-evidence.test.ts` |
| `T-io` | `packages/tooling/tool/cli/test/support/CompletionIo.ts` |

Rulings (all under `goals/goal-closeout-hosted-verification/decisions/2026-11-13-*`):

| Id | File suffix | Touches `Completion.ts`? |
| --- | --- | --- |
| D-after | `completion-verifies-after-the-merge-without-the-pre-merge-job-timing-rule.md` | yes |
| D-hosted | `completion-evidence-is-hosted-facts-only.md` | yes |
| D-red | `a-final-merged-over-a-red-required-check-verifies-with-attributed-reds.md` | yes |
| D-onepr | `closeout-is-one-pr-and-goals-doctor-blocks-on-an-unverified-closeout.md` | yes (proposal-keyed readers), plus `DR` |
| D-mig | `batch-migration-then-proposedcloseout-leaves-the-schema.md` | yes (digest slot) |
| D-hand | `operator-hand-merges-goal-finals-no-merger-guard.md` | no change needed (see 3.5) |
| D-exit | `goal-md-gains-an-operator-ruling-exit.md` | no (Bootstrap template) |
| D-done | `done-means-closeout-adopted-on-main-in-the-template-and-every-active-packet.md` | no |
| D-cov | `final-check-coverage-runs-only-packages-whose-tests-read-goals.md` | no (separate lane) |

---

## 1. The pipeline as it stands

### 1.1 Entry points and callers

- `goals completion refresh [--slug] [--readiness-job <uuid>]` is the only writer
  (`C:1301-1317`). `refresh` validates the flag pair (`C:1255-1262`), resolves the
  workstation receipt store or the legacy clone file (`C:1263-1278`), then runs
  `refreshRecord` per packet (`C:1286`).
- `refreshRecord` decodes the manifest, skips grandfathered packets, finds the
  `final` PR ref, calls `observeGoalCompletion`, and writes a receipt only when merge
  facts exist (`C:1217-1250`, write gate `C:1241-1246`). It prints the set-status
  adoption hint for a verified proposal (`C:1211-1216`, `C:1249`).
- Readers of stored receipts: `storedGoalCompletion` (`C:949-996`),
  `projectGoalLifecycle` (`C:1017-1073`), `readGoalLifecycle` (`C:1088-1099`),
  `goalCloseoutView` / `readGoalCloseoutView(s)` (`C:1126-1199`).
- Outside this file: `goals doctor` observes online or reads the stored receipt and
  emits **advisory** `completion-gate-unknown|unsatisfied` and
  `closeout-adoption-pending` findings (`DR:1462-1545`, severity `DR:1488`,
  `DR:1538`). `goals set-status` refuses to adopt a proposal without a verified view
  (`SS:424-450`, refusal text `SS:437-442`).

### 1.2 Hosted facts read today

Completion does **not** go through `internal/github/GithubRest.ts`. It has its own
port, `GoalCompletionIo` (`CESv:42-87`), whose live implementation calls
`GitHubClient.requestDecoded` / `paginate` directly (`CE:94-245`, identity
selection `CE:102-113`). Fixtures replace it (`T-io`).

| Fact | Endpoint (live adapter) | Consumer |
| --- | --- | --- |
| PR merged, head SHA, merge commit, merge time, base, created_at | `GET pulls/{n}` (`CE:148-158`, wire `CES:161-171`) | `C:657-678` |
| Merge commit tree and parent count | `GET commits/{merge}` (`CE:159-165`) | `C:681-690` |
| All check runs on the accepted head (`filter=all`) | `GET commits/{head}/check-runs` (`CE:166-177`) | `C:695-696`, facts `CE:398-447` |
| Merge-push rule suite (inventory of rules GitHub evaluated, deleted rulesets included; listing reaches back one month) | `GET rulesets/rule-suites?ref=…&time_period=month` and `GET rulesets/rule-suites/{id}` (`CE:214-236`; lookup `CE:362-386`) | `CE:645-816` |
| Current rulesets, ruleset history, history version at merge | `GET rulesets`, `…/{id}/history`, `…/history/{v}` (`CE:196-213`, `CE:237-243`; fold `CE:304-345`) | `CE:650-663`, `CE:681-762` |
| Issue timeline (`ready_for_review`, `head_ref_force_pushed`) | `GET issues/{n}/timeline` (`CE:178-188`) | non-gating sub-claims `C:773-810` |
| First check-suite receipt time on the head | `GET commits/{head}/check-suites` (`CE:189-195`) | review-window sub-claim `C:784-801` |
| Packet manifest at the accepted head | local `git show` first, GitHub contents fallback (`CE:133-147`, `C:553-569`) | accepted-declaration digest `C:691-694`, sub-claim `C:811-833` |

**Review threads are not read at all.** The only thread facts anywhere in
`Completion.ts` are the local `status.json` counters
`unresolvedReviewThreadCount` / `followUpThreadCount` inside the readiness-recovery
schema (`C:356-357`), consumed through `deriveYeetMergeReady` (`C:465`). The hosted
reader that implements the AGENTS.md "outstanding thread" rule already exists in
`@beep/github/ReviewThread` (`RT:620-627` `isOutstanding`, `RT:647-648`
`outstanding`, `RT:820-832` `list`), but Completion never calls it.

### 1.3 Local (non-hosted) inputs today

| Input | Where | Role today |
| --- | --- | --- |
| `.beep/yeet/runs/<runId>/verdict.json` named by a `yeet-verdict` acceptance ref | `C:488-551` (read `C:501-506`) | **gating** when the ref is `gating: true` (the default, `GS:364`) |
| `.beep/yeet/jobs/<jobId>.json` and the run's `status.json` | `C:377-473` | gating, via `--readiness-job` recovery |
| Receipt stores (workstation `github.com__<owner>__<name>.jsonl`, legacy clone `.beep/goals/completion-receipts.ndjson`) | `C:881-916`, store `CompletionReceiptStore.service.ts:107-108` | cache of derived receipts; re-resolved on read (`C:988-994`) |

Census (jq over `goals/*/ops/manifest.json`, this worktree): 38 manifests declare a
`yeet-verdict` acceptance ref and none sets `gating: false`; 26 carry a committed
`closeout`; 8 carry `proposedCloseout`. The only other declared kind is one
non-gating `packet-history` ref (`goals/turborepo-cache-conformance`).

### 1.4 Observation and receipt shapes

`GoalCompletionObservation` (`C:83-107`) is the pure input; `GoalCompletionReceipt`
(`GS:1008-1033`, `schemaVersion: "goal-completion-receipt/v1"` at `GS:1010`) is the
persisted output. Fields that matter here:

| Field | Schema | Meaning |
| --- | --- | --- |
| `declarationDigest` / `acceptedDeclarationDigest` | `S.NonEmptyString` / `OptionFromNullOr` | digest of the current manifest's identity, `completionGate`, closeout slot and PR refs (`C:292-305`); the accepted one is computed from the manifest at the PR head (`C:691-694`) |
| `requiredChecks` | `GoalRequiredCheckSnapshot` (`GS:947-967`) | required contexts, history sources, `mergeTimeInventory` (the rule suite), `gaps`, `rulesetReadsComplete` |
| `requiredCheckFacts` | `GoalRequiredCheckFact[]` (`GS:798-811`) | one fact per required context, bound to the accepted head: `checkRunId`, `conclusion`, `outcome` |
| `evidence` | `GoalEvidenceCheck[]` (`GS:412-423`) | gating evidence: the always-present `hosted-required-checks` ref (`C:68`, built `C:716-723`) plus every declared acceptance ref (`C:571-589`) |
| `nonRequiredReds` | `GoalNonRequiredRed[]` (`GS:982-993`) | reds of non-required lanes, `attribution` always `"unknown"` (`C:767`) |
| `subClaims` | `GoalEvidenceCheck[]` | non-gating: accepted-declaration, draft-to-ready, review-window, an always-unknown `yeet-verdict merge-ready` (`C:834-866`) |
| `outcome` | `verified | unsatisfied | unknown` (`GS:289-293`) | from `overallOutcome` (`C:197-215`) |

The merge-time verdict is a tagged union (`GS:904-913`): `verified { facts (min 1) }`
(`GS:826-835`), `unsatisfied { reds, ruleSuiteRed }` (`GS:855-864`),
`unknown { gaps }` (`GS:879-888`); gaps are listed at `GS:516-529`.

### 1.5 Decision logic

1. `decideGoalCompletionEvidence` (`CE:506-566`), pure:
   - `reds` = relevant facts with `outcome: unsatisfied` bound to the accepted head (`CE:512`).
   - `activeRed` = a rule source active at push whose `required_status_checks` evaluation failed (`CE:518-521`).
   - Any `reds` or `activeRed` → `unsatisfied` immediately, even with gaps (`CE:528-529`).
   - Otherwise gaps (`CE:530-560`) → `unknown`; a deleted-but-gating failed ruleset → `unsatisfied` once gaps are empty (`CE:524-527`, `CE:562`); else `verified` (`CE:565`).
2. `hostedRequiredOutcome` maps the verdict onto the hosted evidence check (`C:595-604`).
3. `goalCompletionUnknownReasons` (`C:174-195`) and `overallOutcome` (`C:197-215`)
   combine merge facts, accepted head, accepted digest, **every gating evidence check
   whatever its kind** (`C:180`, `C:189-192`, `C:201-210`) and the verdict.
4. `storedGoalCompletion` (`C:949-996`) filters by packet, digest, final PR and repo
   (`C:960-967`), prefers "definite" rows (`C:968-979`), keeps a verified row sticky
   over a newer unknown (`C:979-985`), and re-resolves the chosen row (`C:988-994`).
5. `projectGoalLifecycle` (`C:1017-1073`) adopts a proposal only when the re-resolved
   row is verified, the hosted check is verified at the accepted head (`C:1044-1054`),
   the accepted digest equals the current one (`C:1031`), **and** a gating
   `yeet-verdict` is declared and every gating declared ref verified at the head
   (`C:1055-1071`).

### 1.6 Where the `yeet-verdict` acceptance ref is enforced (four sites)

| Site | Lines | Effect |
| --- | --- | --- |
| Schema: `closeoutGateAdmits` | `GS:1535-1541` (yeet clause `GS:1537`), used by `GoalProposedCloseoutCheck` `GS:1543-1562` and `GoalCloseoutRecordCheck` `GS:1564-1586`, applied `GS:1807` | a manifest with `proposedCloseout` or `closeout` **does not decode** without a gating `yeet-verdict` ref. D-hosted's reversal names this function. |
| Evidence read | `C:571-589` → `C:488-551` | the local verdict file becomes a gating `GoalEvidenceCheck`: `unsatisfied` on head mismatch or `mergeReady.ready == false`, `verified` only with a head and a readiness record, else `unknown` (`C:525-535`) |
| Outcome | `C:180`, `C:188-192`, `C:201-212` | an unknown or unsatisfied gating verdict makes the receipt unknown or unsatisfied |
| Lifecycle | `C:1055-1071` | even a verified receipt does not adopt unless a gating `yeet-verdict` is declared and verified |

### 1.7 Readiness recovery and the job timing rule

- `readinessRecoveryRefusal` (`C:475-486`) only decides whether recovery may be
  attempted: the declared verdict must be a successful `publish` at the accepted head
  that does **not** already record readiness.
- `recoverReadiness` (`C:377-473`) does the work. It checks the canonical verdict
  path (`C:387-389`), reads the job record and the run's `status.json`
  (`C:390-413`), and evaluates 31 predicates (`C:429-467`). The timing rules are
  `C:457-461`. The one D-after removes is **`C:461` "job finalized after PR merge"**
  (`finalizedAt <= mergedAt`). `C:457-460` order the job's own timestamps.
  `C:462-466` require recorded and derived readiness (threads, checks, window) from
  the **local** status snapshot.
- Note: D-after's reversal text names `readinessRecoveryRefusal`, but the merge-time
  predicate lives in `recoverReadiness` at `C:461`. Under D-hosted the whole recovery
  path is moot, so the two rulings delete it together (section 3).
- A second, separate pre-merge timing rule applies to **hosted** check runs:
  `goalRequiredCheckFacts` takes the newest run that *started* before the merge
  (`CE:411`) and counts it only if it also *completed* before the merge (`CE:426`);
  otherwise it is `pending`/`unknown` (`CE:427-436`), which becomes the
  `required-check-unobserved` gap (`CE:551-558`). D-after does not name this rule,
  but it decides whether D-hand merges verify (see Q1).

### 1.8 How S11 / red finals are refused today

1. A required context red at the accepted head (or the rule suite failing an active
   `required_status_checks` rule, which is exactly what an admin bypass of a red or
   pending check records: `result: "bypass"` with a failed evaluation, pinned by
   `T-ev:266-280`) → verdict `unsatisfied` (`CE:512-529`).
2. → the hosted evidence check is `unsatisfied` (`C:600`, `C:716-723`) → the receipt
   is `unsatisfied` (`C:203-211`).
3. Independently, the local verdict of an S11 merge records `mergeReady.ready: false`
   or nothing. Recovery then demands `requiredChecksGreen` from the local snapshot
   (`C:462-466`), so the readiness path refuses too (`C:525-529`).
4. An `unsatisfied` row is "definite" (`C:971`) and wins over later unknowns;
   `projectGoalLifecycle` and `set-status` refuse (`C:1072`, `SS:437-442`).
5. The only way out was a goals-only re-final PR. Packets show the cost:
   `goals/fleet-root-registry/decisions/2026-11-07-completion-moves-to-docs-only-re-final.md`
   (it already names its reds and their attribution in prose),
   `goals/scripts-to-beep-cli/decisions/2026-11-08-refinal-after-early-merge.md` and
   three more re-finals in that packet,
   `goals/repository-simplification-residue/decisions/2026-11-10-refinal-3073-merged-before-readiness.md`,
   `goals/alchemy-vault-sync-slice/decisions/2026-11-10-third-goals-only-re-final-after-2962-merged-before-readiness.md`.

---

## 2. Tests that pin today's behaviour

| Test | Lines | Pins | Disposition |
| --- | --- | --- | --- |
| Recovery matrix, 29 variants (`valid` … `hosted-red`) | `T-obs:1064-1181`; fixtures `T-obs:285-450` | `recoverReadiness` / `readinessRecoveryRefusal`, incl. `finalized-after-merge` (`T-obs:1077`, `T-obs:1165`) | **delete** with recovery; replace with one "local verdict is advisory" test |
| `--readiness-job` CLI validation | `T-obs:1040-1050` | flag pairing and UUID shape | **delete** with the flag |
| Lifecycle rejects candidates "despite a verified flag" | `T-comp:597-649` | candidate `T-comp:604` (no readiness evidence) and `T-comp:605-616` (readiness unsatisfied) | **change**: those two must now adopt; the others stay. Add attributed-red and outstanding-thread candidates |
| Decode rejects a closeout gate without a `yeet-verdict` ref | `T-comp:679`, `T-comp:724` | `closeoutGateAdmits` yeet clause | **flip** to success |
| Proposal receipt built with a verified readiness check | `T-comp:484-516` | readiness required for adoption | **change** fixture: readiness no longer needed |
| Pure resolver: verify / red / stale head / missing / grandfathered / non-gating window | `T-comp:357-464` | `overallOutcome` | **stay**. The fixture (`T-comp:94-134`) gains thread evidence if threads become gating |
| A rerun pending at merge cannot reuse an older green | `T-obs:587-591` | `CE:426` | **change** to `unsatisfied` if Q1 is adopted (that run later fails), never `verified` |
| A post-merge rerun cannot erase a pre-merge result | `T-obs:625-633`, `CES:27-28` | `CE:411` | **stay** |
| Required red is unsatisfied | `T-obs:634-638`, `T-ev:258-265`, `T-comp:413-426` | `CE:528` | **stay**, plus an attributed twin that verifies |
| Rule-suite bypass with a failed `required_status_checks` rule | `T-ev:266-280` | `activeRed` | **stay** unattributed; add an attributed twin (and a Q2 case) |
| Deleted-ruleset red and newer red | `T-ev:301-315`, `T-ev:472-511` | `recoveredRed`, newest-run rule | **stay** |
| Non-required reds do not block | `T-ev:227-257` | `C:742-772` | **stay** |
| Receipt selection, sticky verified, shared store | `T-obs:699-970`, `goals-completion-receipt-store.test.ts` | `C:949-996` | **stay**; extend "definite" for thread evidence |
| Port reads | `goals-completion-kit.test.ts:21-175` | `CE:94-245` | **stay**; add a review-thread read |

---

## 3. What must go, stay or be added

### 3.1 D-after: verify after the merge, no pre-merge job timing

**Go**

- `recoverReadiness` in full (`C:377-473`), including the merge-timing predicate
  `C:461` and the local readiness derivations `C:462-466`.
- `Recovery`, `RecoveryFacts` and their decoders (`C:313-375`).
- `readinessRecoveryRefusal` (`C:475-486`).
- The `readinessJob` threading: the `observeGoalCompletion` parameter and decode
  (`C:632`, `C:724-731`), `readDeclaredEvidence`'s `recovery` parameter (`C:577`,
  `C:585`), the recovery branch and recovery-specific detail text in
  `readLocalEvidence` (`C:509-524`, `C:540-549`), the `refreshRecord` and `refresh`
  parameters and validation (`C:1224`, `C:1240`, `C:1252-1262`), and the CLI flag
  (`C:1307-1313`).
- Imports used only by recovery: `UUID` (`C:10`), `repoRunArtifactId` (`C:25`),
  `deriveYeetMergeReady` (`C:27`), `ProofJobRecord` (`C:28`),
  `YeetMergeReadyFromEncoded` (`C:30`), `YeetWatchCheck` (`C:31`).
  `readContainedFileStringNoFollow` stays (`C:898`); `decideYeetReviewWindow` stays
  (`C:804`).

**Stay**

- Every hosted read in 1.2. They are keyed to the PR, its head and its merge commit,
  so `refresh` can run any time after the merge. The one real time limit is GitHub's
  one-month rule-suite listing (`CE:220`, `CE:360-361`, gap docs `GS:500-504`), which
  D-hosted accepts and D-exit covers.
- `refresh` as sole writer, with a receipt only when merge facts exist (`C:1241-1246`).
- The review-window and draft-to-ready sub-claims measured at `mergedAt`
  (`C:803-859`). They are non-gating and must stay non-gating (D-hand; pinned by
  `T-comp:451-464`).

**Change (recommended, open as Q1)**

- `CE:426` drops `completed_at <= mergedAt` and keeps `started_at <= mergedAt`
  (`CE:411`). A required run that was pending when the operator hand-merged
  (D-hand: #2962, #3101 and #3132 merged within minutes of the ready flip) then
  counts by its eventual conclusion, and a post-merge rerun still cannot launder a
  red (the run must have started before the merge). Without this, such a final stays
  `unknown` forever (`required-check-unobserved`), which D-onepr turns into a
  permanent blocking doctor finding.

### 3.2 D-hosted: hosted facts only

**Go (as gating)**

- The `yeet-verdict` clause of `closeoutGateAdmits` (`GS:1537`). Keep the
  non-grandfathered and final-PR-match clauses (`GS:1536`, `GS:1538-1541`). Update
  the two filter messages (`GS:1559-1560`, `GS:1583-1584`) and the
  `GoalCloseoutVerification` doc that names the "readiness verdict" (`GS:1346-1349`).
- The `readiness` conjunct of `projectGoalLifecycle` (`C:1055-1072`).
- Gating of non-hosted kinds in `goalCompletionUnknownReasons` and `overallOutcome`
  (`C:180`, `C:201`). Restrict "gating" to hosted kinds with a named predicate (for
  example a `HostedEvidenceKind` LiteralKit pick of `GoalAcceptanceEvidenceKind`) so a
  declared `gating: true` on a local kind can no longer gate.

**Demote to advisory (D-hosted: "verdict.json is advisory")**

- Keep a reduced `readLocalEvidence` (`C:488-551` minus recovery) and record its
  check with `gating: false` in the receipt, so a reader can still see whether a local
  verdict agreed. Alternatively drop it and leave the 38 declared refs inert (Q8).
- Do **not** rewrite the 38 manifests' `acceptanceEvidence` in the change PR.
  `goalCompletionDeclarationDigest` hashes the whole encoded `completionGate`
  (`C:295-302`). Editing it changes the digest, which orphans stored receipts
  (`C:964`) and breaks the accepted-head equality (`C:1031`) for finals that already
  merged with the old gate. If the refs should eventually go, take `acceptanceEvidence`
  out of the digest input in the same PR that re-runs refresh (Q9).

**Stay**

- Merge facts, the rule-suite inventory, ruleset history, head-bound required facts
  and the pure verdict (`C:657-715`, `CE:362-566`, `CE:645-816`).
- The accepted-head manifest read (`C:553-569`). A local `git show` of the head is a
  content-addressed copy of hosted bytes, and the contents API is the fallback.
- Grandfathered short-circuit (`C:656`, `C:198`).

**Add**

- **Review-thread fact.** Add a port method
  `reviewThreads(root, number): Effect<ReviewThreads, YeetCommandError>` to
  `GoalCompletionIo` (`CESv:42-87`). The live adapter wraps `ReviewThread.list` (`RT:671`,
  `RT:820-832`) and the fixture adds a route (`T-io`). Classify with `outstanding`
  (`RT:647-648`), which already encodes the AGENTS.md rule: unresolved, or resolved
  by the author with a later human follow-up (`RT:575-627`).
  - New evidence kind `hosted-review-threads` in `GoalAcceptanceEvidenceKind`
    (`GS:236-243`). The evidence uses a fixed ref, like `hostedRef` (`C:68`), and is
    always appended next to it (`C:716-723`). Outcome: `verified` when 0 threads are
    outstanding, `unsatisfied` when more than 0, `unknown` when the read fails.
  - Make it gating in the same places as `hosted-required-checks`:
    `goalCompletionUnknownReasons`, `overallOutcome`, the `projectGoalLifecycle`
    hosted conjunct (`C:1044-1054`) and the "definite" filter (`C:968-978`).
  - Optionally add a receipt field `reviewThreads: Option<{ total, outstanding }>` so
    doctor can print counts.
  - Caveats: the GraphQL selection has `resolvedBy { login }` and no resolution time
    (`RT:407-413`), so this is the state **at refresh**, not at merge (Q3). GraphQL
    has the scarce budget (`internal/github/GithubRest.ts:5-14`); one paginated read
    per refresh is small, and a failure is `unknown`, never green.
- **Receipt compatibility.** Existing v1 rows carry no thread evidence. If threads
  become required in re-resolution (`C:988-994`), every stored verified receipt
  degrades to `unknown`, and D-onepr makes that a blocker. Either bump to
  `goal-completion-receipt/v2` and evaluate v1 rows by the v1 rule, or re-refresh
  every committed closeout in the D-mig PR (Q4).

### 3.3 D-red: attributed reds verify

**Go**

- The unconditional early `unsatisfied` for head-bound reds and `activeRed`
  (`CE:528-529`), and for `recoveredRed` (`CE:562`). They become conditional on
  attribution.
- `hostedRequiredOutcome`'s "any non-verified fact means not verified" (`C:600-603`).
  An attributed red counts as accounted for.

**Stay**

- The definition of a red: an unsatisfied fact at the accepted head (`CE:512`), or a
  failed rule-suite evaluation (`CE:518-527`).
- Every **gap** still means `unknown` (`CE:530-561`). An attribution cannot stand in
  for a missing inventory, because without the rule suite nobody knows which contexts
  were required.
- Non-required reds stay non-blocking (`C:742-772`). Their `attribution: "unknown"`
  (`C:767`) may optionally be filled from the same decision files.

**Add**

- Read attributions from the packet's decision files through the existing projection
  core (`goalDecisionLogReport`, `DP:425-449`; service `Decisions.service.ts:30-33`).
  `refreshRecord` already holds the `GoalPacketRecord` (`C:1217`), and doctor has its
  own packet reader. Invalid files land in `invalid` and are ignored (`DP:430-434`),
  so a malformed attribution fails closed.
- Thread the attributions into `GoalCompletionEvidenceInput` (`CES:131-145`) and the
  observation, and persist them in the receipt. The verifier re-resolves stored rows
  (`C:988-994`, `C:1037-1043`), so a verdict that depends on attributions is only
  reproducible if the receipt carries them.
- New verdict behaviour (pure, in `decideGoalCompletionEvidence`):
  1. Compute gaps as today. Gaps make the verdict `unknown`.
  2. A red is *attributed* when an attribution for this final PR names its context.
  3. A rule-suite red is attributed when every required context that is not green at
     the accepted head is attributed. A rule-suite red with **no** non-green context
     is Q2.
  4. Any unattributed red makes the verdict `unsatisfied { reds, ruleSuiteRed }`, as
     today.
  5. Otherwise the verdict is `verified`. Extend `GoalCompletionEvidenceVerified`
     (`GS:826-835`) with `attributedReds` (default empty), and keep `facts` as all
     relevant facts so the min-length-1 check (`GS:830`) still holds when every
     context is red.
- `describeGoalCompletionEvidence` (`CE:585-592`) and the hosted evidence detail
  (`C:721`) list the attributed reds ("the receipt lists the reds", D-red).
- Doctor: an attribution naming a context that is not red, or two files that
  disagree, becomes a finding (advisory, doctor lane).

### 3.4 Collateral inside `Completion.ts` from D-onepr and D-mig

- `projectGoalLifecycle`, `readGoalLifecycle`, `goalCloseoutView`,
  `readGoalCloseoutView(s)` and `adoptionHint` all key on `proposedCloseout`
  (`C:1021`, `C:1093`, `C:1131`, `C:1164`, `C:1212`). Once the final PR writes
  `closeout` directly, lifecycle comes from the manifest and the receipt supplies only
  `verified | unverified` (the shape `renderGoalCloseoutRecordView` already renders,
  `GS:1498-1505`). `adoptionHint` and the `closeout-adoption-pending` finding
  (`DR:1529-1543`) go.
- **Digest trap for D-mig.** `goalCompletionDeclarationDigest` reads the closeout
  slot as `proposedCloseout ?? closeout` (`C:301`). After `proposedCloseout` leaves the
  schema, the accepted-head manifest of a migrated or re-final packet still carries a
  raw `proposedCloseout`. `readAcceptedManifest` decodes it with the new `GoalManifest`
  (`C:566`), which drops the key, so the accepted digest no longer equals the current
  one and `C:1031` refuses forever. Replace digest equality with a hosted check that
  the accepted-head manifest names this PR as final: raw `closeout.finalPullRequest`,
  legacy raw `proposedCloseout.finalPullRequest`, or the `final` entry in
  `completionGate.pullRequests`. D-onepr already states the final "names itself as
  the final PR".

### 3.5 D-hand, D-exit, D-done, D-cov

- D-hand: no change. Completion reads no merger identity (`GoalCompletionPull` has no
  `merged_by`, `CES:161-171`), and the review-window and draft-to-ready sub-claims are
  non-gating (`C:834-866`). Keep it that way. Q1 is the real D-hand exposure.
- D-exit: the template change is in `Goals/Bootstrap.ts`. Completion only needs to
  keep the `rule-suite-unavailable` gap explicit (`CE:378-382`), so doctor can say
  "older than one month: use the operator-ruling exit".
- D-done and D-cov: no `Completion.ts` impact.

---

## 4. Proposed machine-readable shape for an attributed red

### 4.1 File

One decision file per final, `kind: decision` (the default, `DS:193`), so it also
renders in the SPEC Decision log:

```yaml
---
title: "Final #3101 merged over red Coverage and Docgen"
date: 2026-11-13
lane: "feat/some-lane"
reversal: "Delete this file; goals completion refresh reports #3101 unsatisfied again."
redAttribution:
  finalPullRequest: 3101
  reds:
    - context: "Coverage"
      attribution: inherited
      fixPullRequest: 3105
    - context: "Docgen"
      attribution: introduced
      fixPullRequest: 3107
---

Evidence: the failing runs, the main commit where each red started, and why the
final merged over them (S11).
```

Why a nested `redAttribution` block and not the existing `pullRequest` key:
`pullRequest` is documented as the lane PR that took the decision (`DS:164-167`), but
packets already use it to mean the final (for example
`goals/fleet-root-registry/decisions/2026-11-07-completion-moves-to-docs-only-re-final.md:5`
names final #2859). A dedicated `finalPullRequest` removes the ambiguity. The
frontmatter is real YAML (`DP:195`, over `@beep/yaml`), so nested sequences decode.

### 4.2 Schema (schema-first, existing frontmatter extended)

The schemas belong in `Goals.schemas.ts` next to `GoalRedAttribution` (`GS:315-319`).
`Decisions.schemas.ts` imports them; there is no cycle, because `Goals.schemas.ts`
does not import Decisions (`GS:18-28`).

```ts
// Goals.schemas.ts: named literal domain; "unknown" cannot attribute a red.
export const GoalAttributedRedCause = GoalRedAttribution.pick(["inherited", "introduced", "mixed"]).pipe(
  $I.annoteSchema("GoalAttributedRedCause", { description: "Why a required check was red at a goal's final merge." })
)

export class GoalAttributedRed extends S.Opaque<GoalAttributedRed, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.NonEmptyString,                     // exact GoalRequiredCheckFact.context
    attribution: GoalAttributedRedCause,
    fixPullRequest: S.Int.check(S.isGreaterThan(0)),
  }).pipe($I.annoteSchema("GoalAttributedRed", { description: "One red required check named with its cause and fix PR." }))
) {}

export class GoalRedAttributionBlock extends S.Opaque<GoalRedAttributionBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    reds: S.NonEmptyArray(GoalAttributedRed),
  })
    .check(/* contexts unique; every fixPullRequest !== finalPullRequest */)
    .pipe($I.annoteSchema("GoalRedAttributionBlock", { description: "Reds a final merged over, attributed in a decision file." }))
) {}

// Decisions.schemas.ts, GoalDecisionFrontmatter fields (DS:189-196) gain:
//   redAttribution: S.optionalKey(GoalRedAttributionBlock),
```

Because the frontmatter decodes with `onExcessProperty: "error"` (`DP:126`), the key
must land in the schema before any packet uses it. A file that misspells it is
rejected, not silently ignored.

### 4.3 Receipt fact

```ts
export class GoalAttributedRedFact extends S.Opaque<GoalAttributedRedFact, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.NonEmptyString,
    checkRunId: S.OptionFromNullOr(S.Finite),     // from the head-bound fact; none for a rule-suite-only red
    conclusion: GoalCheckConclusion,
    attribution: GoalAttributedRedCause,
    fixPullRequest: S.Int.check(S.isGreaterThan(0)),
    decisionFile: S.NonEmptyString,               // GoalDecisionFileName that attributed it
  })
) {}
// GoalCompletionReceipt (GS:1008-1033) and GoalCompletionObservation (C:83-107) gain
//   attributedReds: ArrayKeyDefaultEmpty(GoalAttributedRedFact)   // same pattern as GS:1023
```

### 4.4 Matching rules

1. Take valid decisions (any `kind`) whose `redAttribution.finalPullRequest` equals
   the declared final. Invalid files never attribute.
2. Union their reds by `context`. Two files that disagree on the same context leave
   that context unattributed (fail closed) and produce a doctor finding.
3. A red verifies only when its `context` matches. An attribution naming a context
   that was not red is ignored and reported as stale.
4. Gaps still win over attributions (section 3.3).
5. Renderer: `renderEntry` (`DP:232-239`) adds one line, for example
   `Attributed reds for #3101: Coverage (inherited, fix #3105); Docgen (introduced, fix #3107)`.
   Only files that have the block change, so there is no repo-wide `--write`.
6. Authoring: `goals decisions add` (`Decisions.ts:254-348`) can take repeatable
   `--attribute-red "<context>=<cause>#<fix>"` plus `--final <n>`. The merge gate's
   free-text `--tolerate "<check>=<attribution>"` (`Yeet/internal/MergeGate.ts:108-131`)
   maps onto it.

---

## 5. Open questions

- **Q1.** Should a required run that was pending at merge count by its eventual
  conclusion (drop `CE:426`'s completed-before-merge bound, keep started-before-merge
  at `CE:411`)? Without it, D-hand merges stay `unknown` forever.
- **Q2.** A rule-suite red with no non-green context (operator bypassed while checks
  were pending, and they later went green): should it verify, or must the bypass
  itself be attributed?
- **Q3.** Is the review-thread state at refresh time acceptable as the hosted fact?
  GitHub exposes no resolution time in the current selection (`RT:407-413`), so a
  post-merge human comment would block and a post-merge resolve would clear.
- **Q4.** For receipt compatibility, bump to `goal-completion-receipt/v2` (v1 rows
  keep v1 rules), or re-refresh all 26 committed closeouts in the D-mig PR? Rule
  suites older than one month go `unknown`, so those finals need the D-exit.
- **Q5.** Must the fix PR exist on GitHub (one extra `pulls/{n}` read; the port
  already has it, `CESv:60`)? Must it be merged, or only opened?
- **Q6.** Do `introduced` reds verify? D-red does not restrict the cause, but AGENTS.md
  S11 is framed around inherited reds.
- **Q7.** Read attributions from the refreshing clone's working tree, or from
  `origin/main`? Blocking doctor (D-onepr) argues for `origin/main` to keep results
  deterministic.
- **Q8.** Keep the reduced advisory `yeet-verdict` read in receipts, or delete
  `readLocalEvidence` and leave the 38 declared refs inert?
- **Q9.** Take `acceptanceEvidence` out of `goalCompletionDeclarationDigest`
  (`C:295-302`) now, so advisory refs can later be deleted without orphaning
  receipts?
- **Q10.** Remove `--readiness-job` outright, or accept it with a deprecation warning
  for one release? Packet decision files cite it only as history.
