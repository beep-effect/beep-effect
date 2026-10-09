# Gap follow-up 17: PR timelines and red-check attribution for H2

## Gap follow-up (2.H2 (reconcile the three doctor advisories individually against actual GitHub and acceptance evidence); 3 goal completion (unknown vs unsatisfied))

Provenance: repo head `e62411d63f` (= main), lane `rsc-packet`, swept 2026-10-09, read-only.
Commands used:
- `gh api repos/beep-effect/beep-effect/issues/<n>/timeline --paginate` filtered to ready_for_review / convert_to_draft / labeled / merged / closed / head_ref_force_pushed, for #1427, #1429 and #1462
- `gh pr view <n> --json createdAt,mergedAt,mergeCommit,baseRefOid,headRefOid,labels`
- `git log -1 --format='%H %P'` on each merge commit, plus `git merge-base` of the accepted head against the merge's first parent
- `gh api repos/.../commits/<sha>/check-runs` filtered to `Coverage Regression|Lint Policy`
- `gh api repos/.../actions/runs?head_sha=<sha>`, `.../actions/runs/<id>`, and `.../actions/runs?branch=main&event=push&created=2026-10-05T12:00Z..2026-10-06T03:00Z` (Check workflow, jobs for both lanes)
- `gh api --allow-escape-sequences repos/.../actions/jobs/<id>/logs`, used to compare `##[error]command` lines and the `[coverage-ratchet] coverage regression(s) detected:` rows

### (a) Draft and ready timeline

All times are UTC. None of the three PRs has a `convert_to_draft` event. Each one has exactly one `ready_for_review` event, and GitHub emits that event only for a PR that was a draft. That makes the event direct evidence that the PR was opened as a draft.

| PR | created | `ready-for-heavy` labeled | `ready_for_review` | last head push (Check run created) | merged | ready → merge | push → merge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #1427 push-first-publish | 2026-10-05T20:28:39Z | 20:28:46Z (7 s after open) | 2026-10-05T21:12:50Z | head `4bdc437219` at 2026-10-06T00:51:47Z | 2026-10-06T01:36:13Z (`01d8c18f31`) | 4 h 23 m | 44 m |
| #1429 document-ast-pattern-classification | 2026-10-05T20:35:14Z | 20:35:33Z | 2026-10-05T21:18:32Z | head `e9eafb4a6f` at 2026-10-06T00:09:53Z | 2026-10-06T00:55:25Z (`2f2426b695`) | 3 h 37 m | 45 m |
| #1462 practice-box-onboarding | 2026-10-06T04:46:44Z | 04:46:45Z | 2026-10-06T09:51:46Z | head `b106798b3e` | 2026-10-06T09:51:53Z (`98c3947d44`) | **7 s** | (not measured) |

Findings:
- #1427: draft, then `ready_for_review`, then merge. The order matches the statement's "draft → `yeet ready`" step. `ready-for-heavy` is present. The timeline cannot show that the transition went through `bun run beep yeet ready` rather than the GitHub UI, because a timeline event records the actor and the time, not the tool. It also cannot show a `merge-ready: yes` verdict. The 20-minute review window (later of ready and last push) was 44 m, so the window condition held at merge.
- #1429: same shape. Draft → ready → merge, the label is present, and the window was 45 m.
- #1462: the draft → ready → merge order holds, but ready came 7 s before merge. Under the window rule that `AGENTS.md` states (Quality Operator, "Mergeable"), the 20-minute window had **not** elapsed. A timeline-based check would therefore mark any "went through the review window" claim for #1462 as `unsatisfied`, not `unknown`.
- Timeline answer to brief gap (a): GitHub events can satisfy the "draft → ready" and review-window parts of push-first-publish's extra statement. They cannot satisfy the "`merge-ready: yes`" part. That part still needs a `yeet-verdict` ref, or a separate admitted proxy: required checks green and zero outstanding threads at the merge time. If that proxy is not admitted, the honest outcome for that sub-claim stays `unknown`.

### (b) Red non-required checks at the accepted heads

Base facts:
- #1429: `baseRefOid` = `cd6c9a1b72` (#1421). The merge commit `2f2426b695` has first parent `61d1b494f0` (#1435), and `git merge-base e9eafb4a6f 61d1b494f0` = `cd6c9a1b72`. Main moved two commits (`69de1ddda7` and `61d1b494f0`) after the last PR run was created.
- #1427: `baseRefOid` = `61d1b494f0`. The merge `01d8c18f31` has first parent `2f2426b695` (#1429), and the merge-base with the head is `61d1b494f0`. So #1429 landed on main between #1427's last run and #1427's merge.
- **Both PRs merged while their Heavy lanes were still running.** On #1429 head run `37392526135`, Lint Policy finished at 00:59:04Z and Coverage Regression at 01:13:36Z, after the merge at 00:55:25Z. On #1427 head run `37396200850`, Lint Policy finished at 01:42:00Z and Coverage Regression at 01:46:53Z, after the merge at 01:36:13Z. Neither red was visible at merge time, so a receipt should record both lanes as "pending at merge, failed after", not as "red at accepted head when accepted".

Main-push Check runs before each merge (both lanes):

| main SHA | created | Coverage Regression | Lint Policy |
| --- | --- | --- | --- |
| `b877057bc4` | 10-05 22:56Z | failure | failure |
| `cd6c9a1b72` (#1429 base) | 23:30Z | run cancelled (no lane result) | run cancelled |
| `69de1ddda7` | 23:39Z | cancelled | cancelled |
| `61d1b494f0` (#1429 merge parent, #1427 base) | 10-06 00:48Z | failure | failure |
| `2f2426b695` (#1429 merge, #1427 merge parent) | 00:55Z | failure | failure |
| `01d8c18f31` (#1427 merge) | 01:36Z | run cancelled | run cancelled |
| `26269bb0ec` (next) | 01:48Z | failure | failure |

Main had been red on Coverage Regression on every completed push run since at least 10-05 16:28Z, and on Lint Policy intermittently. Comparing the failure signatures in the job logs splits each red into inherited and introduced parts:

**Lint Policy**
- main `61d1b494f0`, job 112052129675, fails on `knowledge:refs-check` (two broken targets under `goals/agentic-cad-patent-tooling/...` and `goals/desktop-chat-surface/...`), `lint:schema-first`, and `packages/law-practice/server lint:laws`.
- #1427 head, job 112053879379, fails on `knowledge:refs-check` and `law-practice/server lint:laws` only. Both are a subset of main's failures. Verdict: **inherited**.
- #1429 head, job 112041342859, fails on everything main fails on, plus `lint:tsgo-rules` ("vitest.aliases.generated.json differs from tsconfig.json compilerOptions.paths"; #1429 edits `tsconfig.json`, 3 lines) and `packages/foundation/modeling/schema lint:laws` (a `typeof` check at `packages/foundation/modeling/schema/src/PatternOntology/PatternOntology.schema.ts:279`). Both extra failures persist on main `2f2426b695` (job 112065334691) and `26269bb0ec` (job 112078509208). Verdict: **mixed: inherited plus introduced**.

**Coverage Regression** (ratchet rows)
- main `61d1b494f0`, job 112052129591: rows for `PracticeKg.claims.ts` (law-practice-server, 4 rows) and `Yeet/internal/Retire.ts` (3 rows).
- #1429 head, job 112041342921: main's 7 rows, plus `PatternOntology.schema.ts` (branches, "new file has 1 uncovered unit(s)"), which carries onto main `2f2426b695` and `26269bb0ec`, so it was **introduced**. It also has 3 `Corpus/internal/RestorationTransformations.ts` rows that appear neither on main `61d1b494f0` nor on post-merge main `2f2426b695`. The PR tested against base `cd6c9a1b72` or an earlier base, whose own main run was cancelled. Those 3 rows are **unknown**: they are probably base drift that later main commits fixed, but no completed run at `cd6c9a1b72` shows it. Verdict: **mixed: inherited plus introduced plus unknown**.
- #1427 head, job 112053879351: main's 7 rows, plus new rows in `Yeet/internal/Guards.ts`, `Planner.ts`, `PullRequest.ts`, `Yeet/Yeet.command.ts`, and `internal/repo-run/RepoRun.models.ts` (13 rows, all files #1427 touched). All 13 reappear on main `26269bb0ec` (job 112078509169). Verdict: **mixed: inherited plus introduced**.

Summary: of 4 lane reds, 1 is purely inherited (#1427 Lint Policy) and 3 are mixed with introduced components (#1427 Coverage, #1429 Coverage, #1429 Lint Policy). None is purely introduced, and none could be called fully inherited from the lane conclusion alone. Lane-level `conclusion` is not enough to attribute a red. Attribution needs comparison at the level of failing subcommands and ratchet rows.

### Proposed plan (implementing lane)

1. Receipt tolerance: do not record non-required reds as "tolerated" from the lane conclusion alone. Record `{lane, conclusionAtMerge: pending|failure|success, conclusionFinal, attribution: inherited|introduced|mixed|unknown}`. For #1429 and #1427 the honest value is `pending` at merge time.
2. Attribution source: compare the failing-subcommand set (`##[error]command ... exited`) and the coverage-ratchet row set at the head against the nearest **completed** main push run at or before the PR's merge-base. If that base run was cancelled, walk back to the next completed one and mark the result `unknown` for any delta that cannot be explained. Treat a rate-limited or failed log fetch as `unknown`.
3. push-first-publish extra statement: model it as three sub-claims. (i) Draft → ready ordering: `verified` from the timeline. (ii) Review window ≥ 20 min: `verified` (44 m) from ready, the last push, and the merge. (iii) `merge-ready: yes`: `unknown` unless a `yeet-verdict` ref exists at `4bdc437219`. Do not mark it `unsatisfied`.
4. The required lanes stay unaffected: both PRs remain `verified` on the PR-merge part. The introduced non-required reds are tracked as follow-up evidence (they carried onto main) and do not count as goal unsatisfaction.
5. Handle #1462 separately. Its 7-second ready-to-merge gap violates the review-window rule, so any window sub-claim for practice-box-onboarding is `unsatisfied`.

### Open questions

- Who performed `ready_for_review` on #1427 and #1429 (the timeline `actor` field was not extracted), and was it `yeet ready` or the UI? The timeline cannot tell the two apart.
- Whether merging with non-required Heavy lanes still `in_progress` was a sanctioned practice on 10-06, or a gap in `yeet merge-gate`.
- The origin of #1429's `RestorationTransformations.ts` rows. The base run at `cd6c9a1b72` was cancelled and `69de1ddda7`'s lanes were cancelled, so no completed main run between them exists to confirm it.
- #1462's required-check and thread state at merge was not checked in this sweep. Only its timeline was.
