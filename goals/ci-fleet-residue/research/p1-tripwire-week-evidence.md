# P1 tripwire-week evidence (2026-08-16T23:30Z → 2026-08-23)

Window-close attribution for the spot-revert interruption tripwire
(>2 interruption-attributed re-runs/week returns the longest lanes to
on-demand). Raw evidence: GitHub Actions runs created 2026-08-16..2026-08-24,
attempt-1 jobs and check-run annotations per re-run; attribution by a
GPT-5.6 (xhigh) analysis pass over the archived evidence, verified by the
closing agent. Measurement recipe: p1-spot-revert-baseline.md.


## Scope and method

The monitoring window is `2026-08-16T23:30:00Z <= created_at < 2026-08-24T00:00:00Z`. Run metadata comes from `reruns.jsonl`; attempt-1 job state and runner identity come from `rerun-evidence/jobs-<run_id>.json`; annotation fingerprints come from `rerun-evidence/annotations-<job_id>.json`. This yields 16 re-run run IDs: 3 pre-deploy, 12 in-window, and 1 after the window.

## Re-run attribution

| Run ID | Workflow | `created_at` | Attempt-1 failure evidence and runner | Attributed class | In window? |
|---:|---|---|---|---|---|
| 31968275700 | Check | 2026-08-16T19:40:23Z | Build job 95216658480, `Run build checks` failed; annotations include `DateTime.ts is not a module`, Effect type/context errors, and `bun run build exited (2)`; runner `beep-ci-i-02c91fee37e051e46` (`beep-ec2-heavy`). | Build/type-check failure; non-interruption | No — pre-deploy |
| 31972763300 | Check | 2026-08-16T21:11:39Z | Test Integration job 95227646233, `Run verification lane` failed; annotations include a Matcher type mismatch, repeated `schema/src/index.ts is not a module`, and implicit `any`; runner `beep-ci-i-0b3438c5505f85de8` (`beep-ec2-heavy`). | Type-check/code failure; non-interruption | No — pre-deploy |
| 31976213181 | Check | 2026-08-16T22:23:31Z | Docgen job 95236021293, `Run verification lane` cancelled; annotations say `The job has exceeded the maximum execution time of 1h0m0s` and `The operation was canceled`; runner `beep-ci-i-0b5f2d5b5b41a1f41` (`beep-ec2-heavy`). | CI timeout flake; non-interruption | No — pre-deploy |
| 31986265095 | Check | 2026-08-17T01:52:59Z | Property Laws job 95261721889 failed `Run property laws lane` with `Property failed after 146 tests` and exit 1 on hosted runner `GitHub Actions 1000008242`; Coverage Regression job 95261722012 failed `Run verification lane` with exit 1 on `beep-ci-i-09a88bcbe16323bd6` (`beep-ec2-heavy`). | Genuine red/property-test and verification failures; non-interruption | Yes |
| 31990662540 | Check | 2026-08-17T03:17:00Z | Coverage Regression job 95273506897, `Run verification lane` failed; annotation says `Process completed with exit code 1`; runner `beep-ci-i-08eae7d2934b6a009` (`beep-ec2-heavy`). | Ordinary verification-lane failure; non-interruption | Yes |
| 32019107679 | Check | 2026-08-17T10:13:13Z | Lint Policy job 95354812245, `Run verification lane` cancelled; annotations say `The operation was canceled` and `The run was canceled by @kriegcloud`; runner `beep-ci-i-0bf2117956bf8b3fb` (`beep-ec2-heavy`). | Explicit user/supersede-style cancel; non-interruption | Yes |
| 32037908618 | Check | 2026-08-17T14:07:09Z | Commitlint job 95411859610 failed `Setup monorepo CI`; annotations show `setup-bun` download HTTP 429 after three attempts; hosted runner `GitHub Actions 1000009635`. | Hosted action-download/rate-limit failure; non-interruption | Yes |
| 32039140806 | Storybook | 2026-08-17T14:28:09Z | Build And Test job 95415229097 failed `Setup monorepo CI`; annotations show `setup-bun` download HTTP 429 after three attempts; hosted runner `GitHub Actions 1000009656`. | Hosted action-download/rate-limit failure; non-interruption | Yes |
| 32040357343 | Check | 2026-08-17T14:49:18Z | Test Integration job 95418452570 failed `Set up job` on `beep-ci-i-0f1777d1ec0633cf0`; hosted jobs 95418452585 and 95418452596 also failed setup. Their annotations show action archive HTTP 429/502/503 failures after retries. | Action-download service/rate-limit failure across mixed runners; non-interruption | Yes |
| 32042697673 | Check | 2026-08-17T15:33:49Z | Repo Sanity job 95424735409 (hosted), Test Integration job 95424735464 on `beep-ci-i-0c4f3f5e87f36b65b`, and Lint Policy job 95424735496 on `beep-ci-i-0c5168f94519afb02` failed setup; annotations show action-download HTTP 429/503 failures (plus exit 127 on Test Integration). | Action-download service/rate-limit failure across mixed runners; non-interruption | Yes |
| 32043502828 | Check | 2026-08-17T15:49:48Z | Professional Desktop IPC Stdio job 95426825024 failed `Set up job`; annotations show `setup-rust-toolchain` download HTTP 429 after retries; hosted runner `GitHub Actions 1000009762`. | Hosted action-download/rate-limit failure; non-interruption | Yes |
| 32055369976 | Check | 2026-08-17T18:32:09Z | PR Size Label job 95464176124 failed `Label PR by size`; annotation says `No server is currently available to service your request`; hosted runner `GitHub Actions 1000009978`. | Hosted GitHub API/service failure; non-interruption | Yes |
| 32080950731 | Check | 2026-08-17T23:33:47Z | Docgen job 95543690619, `Run verification lane` cancelled; annotations say `The operation was canceled` and `The run was canceled by @kriegcloud`; runner `beep-ci-i-06ce4359141a5f815` (`beep-ec2-heavy`). | Explicit user/supersede-style cancel; non-interruption | Yes |
| 32088793049 | Storybook | 2026-08-18T01:35:55Z | Build And Test job 95566721042, `Install Playwright Chromium` cancelled; annotations say `The operation was canceled` and `The run was canceled by @kriegcloud`; hosted runner `GitHub Actions 1000010632`. | Explicit user/supersede-style cancel on hosted runner; non-interruption | Yes |
| 32668069065 | Check | 2026-08-23T21:37:07Z | Lint Policy job 97264522737, `Run verification lane` cancelled; annotations say `The job has exceeded the maximum execution time of 50m0s` and `The operation was canceled`; runner `beep-ci-i-032876b44cde6141c` (`beep-ec2-heavy`). | Lint Policy/CI timeout; non-interruption | Yes |
| 32688837330 | Check | 2026-08-24T04:07:30Z | Docgen job 97318717263 failed; annotation says `The self-hosted runner lost communication with the server`; runner `beep-ci-i-037d5bcd2346fcd0a` (`beep-ec2-heavy`). | **Spot/fleet interruption** | No — created 2026-08-24 |

## Count and verdict

**Interruption-attributed re-run run IDs inside the window: 0.**

**Tripwire verdict: CALM.** The tripwire requires more than 2 interruption-attributed re-runs in the week. None of the 12 in-window re-run run IDs has an explicit runner-loss/shutdown annotation or a failed self-hosted job with zero failed steps. The self-hosted failures in-window instead have concrete failed/cancelled steps and fingerprints for code/test failure, action-download failure, explicit cancellation, or timeout. The only explicit runner-loss annotation belongs to run 32688837330, whose `created_at` is 2026-08-24T04:07:30Z, after the monitoring window, so it does not increment the tripwire count.

## Evidence notes

- Run 31990662540 is the least specific in-window failure: its annotation reports only exit 1. It is classified as an ordinary verification-lane failure because the self-hosted job records a concrete failed step (`Run verification lane`), has no runner-loss/shutdown annotation, and is therefore not the required failed-with-zero-failed-steps shape. `reruns.jsonl` also records the final re-run conclusion as `failure`, which is consistent with a persistent lane failure rather than a vanished runner recovered by retry.
- Run 31986265095 has both a concrete hosted property-test counterexample and a self-hosted Coverage Regression exit 1. The hosted property failure alone explains the failed run; the self-hosted job also has a recorded failed step and no loss signal, so neither failure is fleet-interruption-shaped.
- Runs 32040357343 and 32042697673 include failures on self-hosted runners, but their job annotations identify action archive HTTP 429/502/503 failures during setup, matching simultaneous hosted failures. The explicit transport fingerprints outweigh runner placement and make these service/setup failures, not spot interruptions.
- Runs 31976213181 and 32668069065 are self-hosted cancellations, but each annotation explicitly identifies the configured maximum execution time. Runs 32019107679, 32080950731, and 32088793049 instead explicitly identify cancellation by `@kriegcloud`. None has a runner-loss/shutdown fingerprint.
- Across all 16 `jobs-<run_id>.json` files, **no self-hosted job has `conclusion: failure` with an empty `failed_steps` array**. Therefore there are no `POSSIBLE interruption` attributions under the zero-failed-step rule. Run 32688837330 is stronger than possible because its annotation explicitly states runner loss, but it is out-of-window.
- Run 32040357343 reached `run_attempt: 3`, so it was invoked twice after attempt 1. Its supplied attempt-1 evidence is still entirely action-download-shaped; counting invocations rather than run IDs would not change the interruption total of zero.

## Never-rerun completeness scan

**Runner-lost-shaped IDs: none determinable from the supplied `runs-window.jsonl`.** The file contains 472 unique run-level records, including 53 attempt-1 failures and 63 attempt-1 cancellations that were never re-run, but its schema has no job, `runner_name`, labels, failed-step, or annotation fields. The supplied job and annotation evidence covers only the 16 re-run run IDs. Consequently, no never-rerun ID can be responsibly asserted to be both self-hosted and runner-lost-shaped from the local artifacts; this is an evidence limitation, not proof that no such never-rerun event occurred.

## Addendum (2026-08-24, PR #778 review hardening)

Three reviewer findings, each addressed with new evidence:

**Every prior attempt is now classified.** Run 32040357343 reached
`run_attempt: 3`, so attempt 2 needed its own classification.
Attempt-2 evidence (`p1-tripwire-week-raw/rerun-evidence/
jobs-32040357343-attempt2.json`): two jobs failed at `Set up job` —
hosted `GitHub Actions 1000009685` and self-hosted
`beep-ci-i-0f1777d1ec0633cf0`. Both check-run annotation sets are empty,
so the self-hosted job's full log was pulled
(`rerun-evidence/job-95420324181.log`): `actions/checkout` archive
download failed HTTP 429, then 502, then 429 — "Failed to download
archive ... after 3 attempts". Same action-download storm as attempt 1
and as the simultaneous hosted failure; not an interruption. Every
attempt of every re-run in the window is now classified; the in-window
interruption count remains **0**.

**Raw inputs are archived.** The run listing, per-attempt job records,
annotations, and the attempt-2 log are committed under
`p1-tripwire-week-raw/` with the exact fetch recipes, so the table above
is regenerable after GitHub's retention expires.

**The verdict is anchored robustly, not to a derived timestamp.** The
repo-retained anchor facts are: #730 merged 2026-08-16T23:29:16Z, and the
dated operator record in `p1-spot-revert-baseline.md` that the pulumi
apply ran the same night. The exact apply-completion timestamp was not
retained. The verdict does not depend on it: an extension capture through
2026-08-24T06:39Z (see `p1-tripwire-week-raw/README.md`) shows exactly
**one** interruption-attributed re-run (32688837330, 2026-08-24T04:07Z)
in the entire post-merge range. Therefore any 7-day spot window whose
apply completed by 2026-08-17T06:39Z — over seven hours past the latest
plausible apply on the dated record — is fully measured and contains at
most 1 interruption-attributed re-run, far under the >2/week tripwire.
