# Migration set inventory

Read-only map of the packets the batch migration covers, made on 2026-11-12
against `origin/main` at `7a462a27d4f`. Hosted facts were read from GitHub the
same day. The rulings applied are the nine files in `../decisions/`, chiefly:

- hosted facts only: merged, every required check at the merged head
  succeeded, no outstanding review thread; the yeet verdict is advisory
  (`../decisions/2026-11-13-completion-evidence-is-hosted-facts-only.md:8`);
- a red required check verifies only when a decision file names it with its
  attribution and fix PR
  (`../decisions/2026-11-13-a-final-merged-over-a-red-required-check-verifies-with-attributed-reds.md:8`);
- the migration covers "the 8 packets carrying `proposedCloseout` and the 9 at
  `completion-gate-unknown`"
  (`../decisions/2026-11-13-batch-migration-then-proposedcloseout-leaves-the-schema.md:8`);
- older finals whose rule suite GitHub no longer lists need the operator-ruling
  exit (`../decisions/2026-11-13-completion-evidence-is-hosted-facts-only.md:8`,
  `../decisions/2026-11-13-goal-md-gains-an-operator-ruling-exit.md:8`).

## Result

The two lists overlap on six packets, so the migration set is **11 packets**.
Every final PR has merged and has no unresolved review thread. GitHub still
lists the merge-push rule suite for all 11 today.

| Class | Packets |
| --- | --- |
| Would verify clean | goal-packet-conflict-free-appends (#2869), packet-archive-mechanics (#2998), beep-effect-web-alchemy (#2583), merge-queue-lab (#3112)\*, scripts-to-beep-cli (#3027)\*, alchemy-vault-sync-slice (#3132)\* |
| Verifies only with attributed reds | citation-extraction-engine (#2966, 4 reds), research-intake-2026-11 (#2963, 4 reds), lejeune-demo-corpus-and-ontology (#2756, 1 red), hold-ledger (#2755 as recorded, 1 red), literal-kit-subset-algebra (#2080, 7 reds) |
| Cannot verify | none today; literal-kit-subset-algebra joins this class when its rule suite leaves the one-month listing, around 2026-11-22 |
| Final not merged | none |

\* Clean only because the code counts a `skipped` required check as
success (`packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.ts:388-389`).
On these goals-only diffs, 7 of the 15 required contexts were skipped by path
filters. If "succeeded" in the hosted-facts ruling means `success` only, these
three cannot verify. See open question 1.

hold-ledger would verify clean if its final is corrected to #2865. That PR
merged later and is the re-final the packet README describes, but the manifest
never recorded it. See the hold-ledger section.

## (1) Packets carrying `proposedCloseout` (8)

Found by scanning every `goals/*/ops/manifest.json` for a non-null
`proposedCloseout`. `goals/public-origin-beep-effect-com` mentions the word
only in prose (`goals/public-origin-beep-effect-com/ops/manifest.json:84`); its
field is null. In all eight, `initiative.status` is `active`, `closeout` is
absent, and the proposal is `completed-retained`.

| Packet | `initiative.status` | Proposal (manifest lines) | Final PR | Final listed in `completionGate.pullRequests` |
| --- | --- | --- | --- | --- |
| citation-extraction-engine | active (`:6`) | `{status: completed-retained, finalPullRequest: 2966}` (`:600-603`) | #2966 | yes, role final (`:34-35`) |
| goal-packet-conflict-free-appends | active (`:7`) | `… 2869` (`:105-108`) | #2869 | yes (`:33-34`) |
| hold-ledger | active (`:7`) | `… 2755` (`:121-124`) | #2755 | **no**: #2755 is listed as `supporting` (`:40-43`) |
| lejeune-demo-corpus-and-ontology | active (`:7`) | `… 2756` (`:102-105`) | #2756 | yes (`:33-34`) |
| merge-queue-lab | active (`:6`) | `… 3112` (`:44-47`) | #3112 | yes (`:32-33`) |
| packet-archive-mechanics | active (`:7`) | `… 2998` (`:46-49`) | #2998 | yes (`:29-30`) |
| research-intake-2026-11 | active (`:7`) | `… 2963` (`:128-131`) | #2963 | yes (`:48-49`) |
| scripts-to-beep-cli | active (`:7`) | `… 3027` (`:137-140`) | #3027 | yes (`:57-58`) |

Line references are to each packet's `ops/manifest.json`.

Live PR state from `gh pr view <n> --json state,mergedAt,mergeCommit,headRefOid,isDraft`:

| PR | state | isDraft | mergedAt (UTC) | mergeCommit | headRefOid |
| --- | --- | --- | --- | --- | --- |
| #2966 | MERGED | false | 2026-11-09T02:51:49Z | `9f44753a8c14` | `f84f5e885071` |
| #2869 | MERGED | false | 2026-11-07T06:44:22Z | `06d64bfb9d8f` | `b32c79590a5d` |
| #2755 | MERGED | false | 2026-11-06T12:49:54Z | `914ede95a490` | `9c9d6bb57924` |
| #2756 | MERGED | false | 2026-11-06T12:49:43Z | `1e7e1e4e194e` | `a85ee9112eda` |
| #3112 | MERGED | false | 2026-11-10T07:33:53Z | `719af45779ce` | `7622ddb63271` |
| #2998 | MERGED | false | 2026-11-09T10:10:49Z | `31274dd87010` | `a941630f4a41` |
| #2963 | MERGED | false | 2026-11-08T11:42:52Z | `de54b37982be` | `ea2ac3a42b09` |
| #3027 | MERGED | false | 2026-11-09T21:26:17Z | `f06983928210` | `b73ad4201e71` |

All eight were merged by the operator account (`mergedBy`).

## (2) Packets at `completion-gate-unknown` (9)

`bun run beep goals doctor` was run once offline (8.6 s, exit 0). It printed
`packets=298 blocking_new=0 blocking_inherited=0 baseline_resolved=0 advisories=29`
and these nine `completion-gate-unknown` rows:

| Packet | Final PR | Doctor detail | Merged (UTC) | In proposal set |
| --- | --- | --- | --- | --- |
| alchemy-vault-sync-slice | #3132 | gating yeet-verdict unknown (a receipt with merge facts exists) | 2026-11-12T23:35:49Z | no; `closeout` already committed (`goals/alchemy-vault-sync-slice/ops/manifest.json:227-230`) |
| beep-effect-web-alchemy | #2583 | no matching clone receipt | 2026-11-02T17:09:53Z | no; `completed-retained` (`:7`) with no `closeout` record, operator acceptance in `statusNote` (`:123`) |
| citation-extraction-engine | #2966 | no matching clone receipt | 2026-11-09T02:51:49Z | yes |
| goal-packet-conflict-free-appends | #2869 | no matching clone receipt | 2026-11-07T06:44:22Z | yes |
| hold-ledger | #2755 | no matching clone receipt | 2026-11-06T12:49:54Z | yes |
| literal-kit-subset-algebra | #2080 | no matching clone receipt | 2026-10-23T09:34:30Z | no; `completed-retained` (`:7`), no `closeout`, red attribution only in `completionGate.statement` (`:21`) |
| merge-queue-lab | #3112 | gating yeet-verdict unknown | 2026-11-10T07:33:53Z | yes |
| packet-archive-mechanics | #2998 | gating yeet-verdict unknown | 2026-11-09T10:10:49Z | yes |
| scripts-to-beep-cli | #3027 | no matching clone receipt | 2026-11-09T21:26:17Z | yes |

From the same run:

- The other two proposal packets show as `completion-gate-unsatisfied`, not
  unknown: lejeune-demo-corpus-and-ontology (#2756) and
  research-intake-2026-11 (#2963). Their stored receipts match the current
  declaration digest and recorded an unsatisfied outcome.
- Two packets outside the migration set are also unsatisfied with typed
  finals: entity-optimistic-concurrency (#1941) and
  turborepo-cache-conformance (#2238). The ruling does not name them.
- Eleven legacy packets have no PR reference (`codex-security-findings-2026-10-14-c2`,
  `docs-lint-oxlint-rules`, …). They are unsatisfied and also outside the
  ruling's set.

"No matching clone receipt" means no stored receipt matches the current
declaration digest. Receipts do exist in the shared store for several of these
packets, under older digests. For example, hold-ledger #2755 has two
`unsatisfied` receipts from 2026-11-06/07, and literal-kit #2080 has two
`unsatisfied` receipts from 2026-10-23. The digest covers `completionGate`,
`proposedCloseout ?? closeout` and the PR refs
(`packages/tooling/tool/cli/src/commands/Goals/Completion.ts:292-305`).

**Online mode was not run.** The `--online` flag exists
(`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:1770-1773`) and calls
`observeGoalCompletion` for every completed or proposed packet that has a final
(`Doctor.ts:1502-1503`, `Doctor.ts:1245-1251`); about 83 manifests qualify.
Each observation makes roughly 20 or more REST calls: the pull, the merge
commit, check-runs, check-suites, the timeline, the ruleset list, history and
version reads for each current ruleset, and **a full month of `refs/heads/main`
rule suites paged 100 at a time with no actor filter**
(`packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.ts:214-224`, `:362-386`),
about 10 pages today. That totals well over 1,000 calls against a budget of
about 120. The targeted reads below reproduce the same hosted facts for the
11 finals.

## Hosted facts per final

Method: one ruleset list, plus the `main` ruleset (id 10240248), its history,
and the version in effect on 2026-10-23. Then the `refs/heads/main` rule-suite
list over one month, filtered by the merging actor, the rule-suite detail for
each merge push, and `commits/<head>/check-runs?filter=all` for each head.
Required contexts follow the code: the newest run on the accepted head that
started at or before the merge, counted only if it also completed by the merge
(`CompletionEvidence.ts:398-447`). "Now" is the newest run on that head today.

Required contexts. The current `main` ruleset (last changed 2026-10-27) has 15:
Lint, Heavy / Check, Test Unit, Heavy / Test Integration, Heavy / Docgen,
Codegen Drift, Repo Sanity, Commitlint, Secret Scanning, Security, SAST, Nix
Shell, Professional Desktop IPC Stdio, Heavy / Doctest and JSDoc Ratchet.
Version 53390820, in effect on 2026-10-23 for #2080, adds `beep-reviewer` and
Heavy / Effect Diagnostics, for 17. The `queue-lab` ruleset targets only
`refs/heads/queue-lab`, so it is not a source for these merges.

| Final | Rule suite (listed?) | Suite result | required_status_checks at merge (GitHub) | Required facts at merge | Required facts now | Unresolved threads |
| --- | --- | --- | --- | --- | --- | --- |
| #2966 | 4987357073 (yes) | bypass | fail: "4 of 15 required status checks are cancelled." | 11 success, 4 cancelled | same | 0 of 10 |
| #2869 | 4966485383 (yes) | pass | pass | 15 success | same | 0 of 0 |
| #2755 | 4950923683 (yes) | bypass | fail: "Required status check \"Test Unit\" is expected." | 14 success, Test Unit had no run before merge | 15 success (Test Unit green at 13:21:44Z) | 0 of 0 |
| #2756 | 4950920521 (yes) | bypass | fail: "Test Unit" is expected | 14 success, Test Unit had no run before merge | 15 success (Test Unit green at 13:24:09Z) | 0 of 0 |
| #3112 | 5014953566 (yes) | pass | pass | 8 success, 7 skipped | same | 0 of 0 |
| #2998 | 4992873503 (yes) | pass | pass | 15 success | same | 0 of 0 |
| #2963 | 4979492915 (yes) | bypass | fail: "4 of 15 required status checks are queued." | 11 success, 4 pending | 11 success, 4 cancelled (12:00:25Z) | 0 of 0 |
| #3027 | 5006199032 (yes) | pass | pass | 8 success, 7 skipped | same | 0 of 0 |
| #3132 | 5084808221 (yes) | pass | pass | 8 success, 7 skipped | same | 0 of 0 |
| #2583 | 4861619916 (yes) | pass | pass | 15 success | same | 0 of 1 |
| #2080 | 4682361780 (yes) | bypass | fail: "7 of 17 required status checks have not succeeded: 2 expected." | 10 success, 5 pending, 2 with no run before merge | 10 success, 5 cancelled, 2 failure | 0 of 12 |

The seven skipped contexts on #3112, #3027 and #3132 are Heavy / Check,
Heavy / Docgen, Codegen Drift, Nix Shell, Professional Desktop IPC Stdio,
Heavy / Doctest and JSDoc Ratchet. GitHub's rule suite counted them as passing.

Non-required reds on the head (the code records these as `nonRequiredReds`,
`Completion.ts:742-772`):

- #2966: Heavy / Build and Heavy / Lint Policy were cancelled.
- #2963: Heavy / Build and Heavy / Lint Policy were cancelled.
- #2080: Heavy / Coverage Regression failed. Heavy / Build, Heavy / Lint
  Policy, Lint (lint-a), Property Laws, Test Unit (repo-cli-1),
  Test Unit (repo-cli-2) and Test Unit (unit-b) were cancelled.
- All other finals have none.

Resolved threads: every resolution was by the PR author or a review bot. The
last comments came from the author, CodeRabbit or `beep-reviewer`. No resolved
thread carries a later human reviewer comment that is still unanswered.

## Per-packet classification

### citation-extraction-engine: attributed reds (4)

The final is #2966. It merged through a ruleset bypass about 8.5 hours after
Heavy / Check, Heavy / Test Integration, Heavy / Docgen and Heavy / Doctest
were cancelled (completed 2026-11-08T18:22Z). These are reds both at merge and
now. No decision under `goals/citation-extraction-engine/decisions/` names
them. A possible attribution lead: `goals/citation-extraction-engine/SPEC.md:396-398`
names #2994 as the `unblocks-main` PR for episode ep70, which may be when
these runs were cancelled. This is not verified. Adopt only after a decision
file names the four reds with their attribution and fix PR.

### goal-packet-conflict-free-appends: clean

The final is #2869: rule suite pass, 15 of 15 green, no threads. A later
re-final, #2874, merged at 2026-11-07T07:55:12Z (`9ed136596bb`). Its commit
message says it rebinds the proposal "to this PR", but the diff wrote #2869,
the predecessor. It also moved the gating verdict ref to the `refinal3`
branch run (`goals/goal-packet-conflict-free-appends/ops/manifest.json:37-40`).
#2874 is clean too: suite 4966981891 pass, 15 of 15 green, no threads. Either
PR verifies. #2874 is not listed in the manifest at all.

### hold-ledger: attributed red as recorded; clean with the corrected final

The recorded final is #2755. Test Unit had no run before the merge, and
GitHub's rule suite failed it as "expected". The merge was a bypass, and
Test Unit went green 32 minutes later. Under merge-time facts, that is one red
(Test Unit). If the post-merge re-derivation ruling
(`../decisions/2026-11-13-completion-verifies-after-the-merge-without-the-pre-merge-job-timing-rule.md:8`)
also applies to check-run timing, it is clean.

There is a manifest defect. Re-final #2865 (`ee13c9c0840`, merged
2026-11-07T07:02:21Z) demoted #2755 to `supporting` and was meant to carry the
proposal (`goals/hold-ledger/README.md:43-53`). It never added itself to
`pullRequests`, and it left `finalPullRequest: 2755`. `goalPullRequestRefs`
therefore prepends a synthetic final #2755, so #2755 appears twice, as both
supporting and final
(`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:1849-1855`).
#2865 itself is clean: suite 4966614439 pass, 15 of 15 green, no threads.

### lejeune-demo-corpus-and-ontology: attributed red (1)

The final is #2756. The pattern matches #2755, with merges 11 seconds apart:
Test Unit was "expected" at merge, the merge was a bypass, and Test Unit went
green at 13:24:09Z. No re-final exists, and `decisions/` is empty. The
classification follows the same timing question as hold-ledger.

### merge-queue-lab: clean\*

The final is #3112: rule suite pass, 8 green and 7 skipped, no threads. The
offline doctor reports unknown only because the gating yeet verdict is
unknown, which the hosted-facts ruling makes advisory. The stored receipt from
2026-11-10 already records hosted-required-checks as verified.

### packet-archive-mechanics: clean

The final is #2998: rule suite pass, 15 of 15 green, one review with no
threads. As with merge-queue-lab, only the yeet verdict was unknown.

### research-intake-2026-11: attributed reds (4)

The final is #2963. Heavy / Check, Heavy / Test Integration, Heavy / Docgen
and Heavy / Doctest were queued when the PR was merged through a bypass, and
were cancelled 17 minutes later. These are reds at merge and now. The packet's
hand-merge decision
(`goals/research-intake-2026-11/decisions/2026-11-08-third-refinal-hand-merge.md:9`)
covers the earlier #2912, not #2963.

### scripts-to-beep-cli: clean\*

The final is #3027: rule suite pass, 8 green and 7 skipped, no threads. It is
the fifth re-final. #2860 through #3022 are supporting PRs
(`goals/scripts-to-beep-cli/ops/manifest.json:27-58`).

### alchemy-vault-sync-slice: clean\*

The final is #3132 (2026-11-12): rule suite pass, 8 green and 7 skipped, no
threads. The `closeout` is already committed, and the operator ruling is
recorded in
`goals/alchemy-vault-sync-slice/decisions/2026-11-12-operator-ruling-close-in-one-packet-state-pr.md:8-14`.
Under the hosted-facts ruling this flips from unknown to verified, with no
manifest change needed.

### beep-effect-web-alchemy: clean

The final is #2583: rule suite pass, 15 of 15 green, one resolved thread. The
packet is `completed-retained` with no `closeout` record. #2613 removed the
proposal and recorded the operator's acceptance as a `statusNote`
(`goals/beep-effect-web-alchemy/ops/manifest.json:123`). "Flip to verified"
here means writing a receipt, or also writing a `closeout` record; see open
question 3.

### literal-kit-subset-algebra: attributed reds (7); rule suite expiring

The final is #2080. The merge was a bypass under the 17-context ruleset
version 53390820. At merge, Heavy / Check, Heavy / Test Integration,
Heavy / Docgen, Heavy / Doctest and Heavy / Effect Diagnostics were pending,
and Lint and Test Unit had no run yet. All five Heavy runs were cancelled
three seconds after the merge, and the Lint and Test Unit aggregators then
failed. The attribution exists only in prose in `completionGate.statement`
(`goals/literal-kit-subset-algebra/ops/manifest.json:21`), which cites an S44
orchestrator ruling. The packet has no `decisions/` directory and no `SPEC.md`
today. It needs a decision file naming the seven reds. Because these reds
were caused by the bypass merge itself, it is unclear what the "fix PR" for
them would be.

The rule suite was pushed 2026-10-23T09:34:29Z. It is still listed today, but
leaves the one-month window around 2026-11-22. After that, refresh can only
return unknown, and the packet needs the operator-ruling exit.

## Rule-suite listing window

GitHub lists rule suites for one month (`time_period=month`). Approximate
dates when each final's merge push drops out of the listing:

| Final | Pushed (UTC) | Drops out about |
| --- | --- | --- |
| #2080 | 2026-10-23 | 2026-11-22 |
| #2583 | 2026-11-02 | 2026-12-02 |
| #2755, #2756 | 2026-11-06 | 2026-12-06 |
| #2865, #2869, #2874 | 2026-11-07 | 2026-12-07 |
| #2963 | 2026-11-08 | 2026-12-08 |
| #2966, #2998, #3027 | 2026-11-09 | 2026-12-09 |
| #3112 | 2026-11-10 | 2026-12-10 |
| #3132 | 2026-11-12 | 2026-12-12 |

## Notes for the migration PR

- Every manifest in the set still declares a gating `yeet-verdict` in
  `completionGate.acceptanceEvidence`. The lines are: citation `:45`,
  gpcfa `:39`, hold-ledger `:47`, lejeune `:39`, merge-queue-lab `:38`,
  packet-archive `:40`, research-intake `:29`, scripts `:63`,
  alchemy-vault `:29`, web-alchemy `:52` and literal-kit `:31`. Making it
  advisory by editing the manifest changes the declaration digest
  (`Completion.ts:300`) and orphans existing receipts. Making it advisory in
  `closeoutGateAdmits` does not.
- Converting `proposedCloseout` to `closeout` with the same status and final
  keeps the digest. The digest reads `proposedCloseout ?? closeout`
  (`Completion.ts:301`).
- Batching the refresh: the live provider re-pages the whole month of `main`
  rule suites for every packet (`CompletionEvidence.ts:214-224`, `:368`).
  Filtering by `actor_name` (the PR's `merged_by`) took 5 pages for every
  operator merge and 4 pages for the bot merge. Reading the list once per
  refresh run would cut the batch from about 11 × 10 pages to about 10.
- The pre-merge timing rule lives in two places. One is the readiness-job
  check (`Completion.ts:461`, `:475-486`), which the ruling removes. The other
  is the check-run binding (`CompletionEvidence.ts:411`, `:426`), which the
  ruling does not name. #2755 and #2756 depend on the second.

## API usage

- REST: 38 calls. One ruleset list, three ruleset reads (main ruleset, its
  history, version 53390820), one queue-lab ruleset, nine rule-suite list
  pages (5 for the operator, 4 for the bot), 11 rule-suite details and
  13 check-run reads.
- GraphQL: 13 `gh pr view` calls and 2 batched review-thread queries (the
  first cost 11 points).
- No pagination loop ran over GraphQL. Core quota was 3,012 of 5,000 remaining
  at the start.

## Open questions

1. Does "every required check at the merged head succeeded" accept `skipped`
   (and `neutral`), as `CompletionEvidence.ts:388-389` does today? If it does
   not, #3112, #3027 and #3132 cannot verify, because path filters skip 7 of
   15 required contexts on goals-only diffs.
2. Does the post-merge ruling also lift the check-run binding to runs that
   started and completed before the merge (`CompletionEvidence.ts:411`,
   `:426`)? If so, #2755 and #2756 verify clean, since Test Unit went green
   after the merge. #2963 and #2080 stay red either way.
3. For completed packets with no `closeout` record (beep-effect-web-alchemy,
   literal-kit-subset-algebra), does "unknowns that verify flip to verified"
   mean writing a receipt only, or also writing a `closeout` record?
4. hold-ledger: should the migration correct the final to #2865 (clean)? The
   alternative is keeping #2755 (one red) and writing an attribution.
   Similarly, should gpcfa record #2874?
5. For reds caused by the bypass merge itself (cancelled or queued Heavy
   runs on #2963 and #2080), what counts as the "fix PR" the
   attributed-reds ruling requires?
6. literal-kit-subset-algebra's rule suite leaves the listing around
   2026-11-22. Should the migration land before then? The alternative is
   routing it to the operator-ruling exit now.
