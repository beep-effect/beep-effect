# Sweep E-github: adversarial audit of `.github/**` and hosted settings

## Provenance

- Head: `e62411d63f` (lane `rsc-packet`, branch `docs/repository-simplification-confidence-packet`, equal to `main`).
- Date: 2026-10-09, about 14:00–14:40Z. Read-only sweep. No files were changed in any checkout.
- Repository: `beep-effect/beep-effect` (public).
- Files read in full: all 11 workflows under `.github/workflows/`, `.github/actions/setup-monorepo-ci/action.yml`, `.github/hooks/impeccable.json`, `CODEOWNERS`, `PULL_REQUEST_TEMPLATE.md` and `ISSUE_TEMPLATE/config.yml`. `.github/skills/**` (153 files, 3.5 MB) and `.github/agents/**` (4 files) were inventoried only.
- Source cross-read: `scripts/ci-job-env.mjs`, `scripts/ci-change-profile.sh`, the CLI `Ci/CiLane.ts` (`CI_LANE_DESCRIPTORS`), `Ci/HeavyAdmission.ts` (`heavyDocsOnlyPattern`, `sourcesFor`, `verdictFor`), `test/ci-lane.test.ts`, `goals/ship-velocity/research/branch-protection-contexts.json`, `apps/professional-desktop/src-tauri/tauri.conf.json` and `turbo.json`.
- Commands (read-only):
  - `gh api repos/beep-effect/beep-effect` plus `/rulesets`, `/rulesets/10240248`, `/rulesets/10240248/history[/<v>]`, `/branches/main/protection`, `/actions/permissions{,/workflow,/fork-pr-contributor-approval,/artifact-and-log-retention,/selected-actions}`, `/environments`, `/environments/<e>/{deployment-branch-policies,secrets,variables}`, `/actions/{secrets,variables,organization-secrets,organization-variables}` (names only), `orgs/beep-effect/actions/runner-groups`, `/actions/caches`, `/actions/cache/usage`, `/actions/artifacts`, `/deployments?environment=turbo-cache-write`, `/dependency-graph/{sbom,compare}`, `/actions/runs/<id>{,/jobs,/pending_deployments}`, `/actions/jobs/<id>/logs`.
  - `gh run list` for each workflow, `gh pr list --state all --limit 200 --json labels` and `gh label list`.
  - `bun run beep ci lane --help`, `bun run beep ci lane --list`, `rg`, `jq` and `git log`.
- No secret values were read. TURBO_API was only classified as Vercel or non-Vercel, and its value is not recorded.

## Headline

- 1 P0, 5 P1, 10 P2, 17 P3.
- **P0: main post-merge CI has been stalled since 2026-10-06.** Run 37518935952 is "waiting" on the `turbo-cache-write` environment and holds the `Check-refs/heads/main` concurrency group. 39 of the last 40 main-push Check runs were cancelled. As a result no trusted remote-cache write and no post-merge proof has happened on main since 2026-10-06T13:30Z.
- **The trusted remote-cache writer boundary is not enforced by GitHub.** `TURBO_TOKEN` also exists as a repository-level secret. Two scheduled or dispatchable workflows read it outside the environment and send it to Turbo's default (Vercel) endpoint, which answers 403.
- **The required-check declarations have drifted three ways.** The live ruleset, `CI_LANE_DESCRIPTORS` and the 2026-08-27 snapshot fixture disagree, and the unit test only compares the descriptors with the stale fixture.
- **The PR size labeler** is the `pr-size` job in `check.yml`. It only ever adds labels, so 17 of the last 200 PRs carry more than one `size/*` label.

## Hosted settings as returned (2026-10-09)

| Surface | Returned |
|---|---|
| Classic branch protection on `main` | 404 "Branch not protected" (rulesets only) |
| Rulesets | One: id 10240248 `main`, target branch, active, `~DEFAULT_BRANCH` |
| Ruleset rules | deletion, non_fast_forward, pull_request (0 approvals; thread resolution **false**; code-owner review false; merge methods merge/squash/rebase), required_status_checks (strict false; **no integration_id** on any context) |
| Ruleset bypass | `RepositoryRole` 5 (admin), `always`, added in version 52153287 (2026-10-06T17:22Z); the previous version had none |
| Required contexts (16) | Lint, Heavy / Check, Test Unit, Heavy / Test Integration, Heavy / Docgen, Codegen Drift, Repo Sanity, Knip, Commitlint, Secret Scanning, Security, SAST, Nix Shell, Professional Desktop IPC Stdio, Heavy / Doctest, JSDoc Ratchet |
| Ruleset history | `Heavy / Coverage Regression` present at v48600030 (09-03), gone at v49479116 (09-11). `Heavy / Lint Policy` present at v49479116, gone at v50918272 (09-25) |
| Actions permissions | enabled; allowed_actions `selected`; `sha_pinning_required: true`; default workflow token `read`; cannot approve PR reviews |
| Allowed action patterns | GitHub-owned plus oven-sh/setup-bun, taiki-e/install-action, actions-rust-lang/setup-rust-toolchain, cachix/cachix-action, cachix/install-nix-action, google/osv-scanner-action/*, **changesets/action** (no consumer), peter-evans/create-pull-request, tauri-apps/tauri-action, swatinem/rust-cache |
| Fork PR approval | `all_external_contributors` |
| Artifact/log retention | 90 days (the maximum) |
| Security & analysis | secret_scanning enabled; **push_protection disabled**; dependabot_security_updates disabled; `dependency_graph` key **absent** from the response, although `/dependency-graph/sbom` returns 1,936 packages and the "Dependency Graph" dynamic workflow is active |
| Environments | `turbo-cache-write` (custom branch policy `main`, no reviewers, secret `TURBO_TOKEN`) plus 18 Vercel-style `Preview – *` / `Production – *` environments with no protection. **`professional-desktop-release` does not exist** (404) |
| Repo secret names | APP_ENV, APP_LOG_FORMAT, APP_LOG_LEVEL, APP_NAME, NEXT_PUBLIC_ENV, TURBO_READ_TOKEN, TURBO_TEAM, **TURBO_TOKEN** |
| Repo variable names | TURBO_API (non-Vercel, self-hosted), TURBO_TEAM |
| Org secrets/vars visible to repo | none |
| Runner groups | `Default` (no public repos) and `beep-ec2-heavy` (id 4, selected visibility, `allows_public_repositories: true`, `restricted_to_workflows: true`: cache-warm, check, fleet-lane-probe, fleet-shadow-check, heavy, each `@refs/heads/main`). Zero registered runners at query time (ephemeral JIT fleet) |
| Actions cache | 157 entries, 10,722,947,543 bytes (at or over the 10 GB default). Largest: bun-Linux-fleet 3.6 GiB (1), playwright-chromium 3.2 GiB (12), bun-Linux-shared 2.0 GiB (1), turbo-Linux-fleet 781 MiB (44) |
| Artifacts | 8,115 total. Unexpired: storybook-static 3,360 (about 38.4 GiB), fallow-envelopes 4,751 (about 275 MiB), cache-warm 4 |
| Registered workflows | 12 file workflows plus dynamic Dependency Graph. **`repo-law` (`.github/workflows/repo-law.yml`) is registered `active` but the file does not exist at head** |
| `turbo-cache-write` deployments | about 9,510 records (100 per page × 9,510 pages, from the `rel="last"` link) |

### Recent outcomes per workflow (newest first)

| Workflow | Last runs |
|---|---|
| Cache Warm | failure 10-01 (sched), failure 09-16 (dispatch), failure 09-15 (sched). Cause: `@beep/repo-docgen#test` exited 1 on the heavy runner after a 17m57s cold run |
| Official Data Sync | failure 09-15, 08-15, 07-15. Cause: `BEEP_ISO3166_PART1_CSV_URL is required` (secret not configured) |
| Fleet Lane Probe | cancelled 09-09, success 08-25 ×2 |
| Fleet Shadow Check | success 09-09, success 08-25, cancelled 08-25 |
| Property Laws Nightly | success 10-08, 10-07, 10-06 |
| Release Desktop | never run |
| Rerun Runner Loss | skipped (normal: there were no failures) |
| Heavy Admit | success / cancelled / success on 10-09 |
| Storybook (push) | 29 success, **11 cancelled** of the last 40 |
| Check (push) | **39 cancelled, 1 pending** of the last 40. Last success 2026-10-06T13:30Z |

## Findings

Severity scale: P0 is broken now and blocks the program. P1 is a security or correctness boundary violation. P2 is wrong behavior or a cost or retention defect. P3 is hygiene or least-privilege polish.

### P0

**E-01. A stuck main Check run holds the concurrency group; main post-merge CI has not completed since 2026-10-06.**
- Evidence: `.github/workflows/check.yml:12-14` sets the group `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress` true only for pull requests. Run 37518935952 (push, head `2d52bdd1ad`, created 2026-10-06T19:26:07Z) has `status: waiting` and 27 completed jobs. Four jobs are `waiting` (Labs, Test Unit (unit-b), Test Unit (repo-cli-2), Heavy / Build), all with a pending deployment to `turbo-cache-write` (0 reviewers, wait_timer 0, `current_user_can_approve: false`). Every later main push queues as `pending` and is cancelled when the next push replaces it (39 of 40). Run 37937963005 for `e62411d63f` is pending behind it now.
- Impact:
  - No trusted `TURBO_TOKEN` writer job (the `verify`, `lint-shard`, `test-unit-shard`, `property-laws` and `fallow-advisory` jobs plus the Heavy matrix on push) has finished since 10-06. This is a plausible cause of the brief's "zero observed remote hits".
  - There is no post-merge proof on main.
  - The "Save post-lane Turbo fallback" and docgen main cache saves have not run.
  - PR heads still pass because PR runs use their own groups.
- Fix:
  1. Immediately (an operator or orchestrator write action, out of scope for this sweep): `gh run cancel 37518935952`. If it will not cancel: `gh api -X POST repos/beep-effect/beep-effect/actions/runs/37518935952/force-cancel`. Then confirm the next main push runs.
  2. Durable: add a read-only detector, for example in `beep ci` or the yeet monitor, that flags any main-ref run in `waiting`/`pending` for more than 60 minutes that holds the Check group. Also reduce environment use to the jobs that actually write (see E-14).
- Fixture: a `gh run list` / `pending_deployments` JSON fixture with one `waiting` main run older than 60 minutes plus a `pending` successor. The detector reports `held-group` and names the run. A fixture without the old waiting run reports clean.

### P1

**E-02. `TURBO_TOKEN` exists at repository level, so the trusted-writer environment boundary is advisory.**
- Evidence: the repo secret names include `TURBO_TOKEN`, and the `turbo-cache-write` environment secret names include `TURBO_TOKEN` (branch policy `main`).
  - `property-laws-nightly.yml:186-188` and `data-sync.yml:315-317` read `secrets.TURBO_TOKEN` with no `environment:`.
  - Both workflows accept `workflow_dispatch` (`property-laws-nightly.yml:166`, `data-sync.yml:302`), and dispatch can target any branch.
  - The same-repo PR copies of `check.yml`, `storybook.yml` and `heavy-admit.yml` are PR-controlled, so one edited expression (`secrets.TURBO_TOKEN` without the `github.event_name == 'push'` guard) would hand the write token to PR code. Only the environment-scoped copy would be blocked by the `main` branch policy.
- Fix: delete the repository-level `TURBO_TOKEN` (an operator hosted-settings action). Keep it only as a `turbo-cache-write` environment secret. Move any workflow that legitimately writes into that environment, or make it read-only via `TURBO_READ_TOKEN`.
- Fixture: a policy test over parsed workflow YAML. Every `secrets.TURBO_TOKEN` reference must sit in a job whose `environment` resolves to `turbo-cache-write` on push. A paired true-positive fixture (a job reading it without the environment) must fail. The hosted check is `gh api …/actions/secrets` showing no `TURBO_TOKEN`.

**E-03. The nightly and data-sync jobs bypass the credential policy and send the cache token to the default (Vercel) endpoint.**
- Evidence:
  - Both jobs set `TURBO_TOKEN`/`TURBO_TEAM` in the job `env` (`property-laws-nightly.yml:186-188`, `data-sync.yml:315-317`) but neither sets `TURBO_API`.
  - Neither passes `turbo-remote-cache: "true"` to the composite action, so `scripts/ci-job-env.mjs` (the one policy definition, `action.yml:251-275`) never runs. The repo `TURBO_API` is self-hosted.
  - The 2026-10-08 nightly log shows `WARNING Remote cache returned 403 and access could not be restored; disabling remote caching for this run`.
  - `TURBO_CACHE` is unset, so Turbo's default (remote read-write) applies. The non-empty `env.TURBO_TOKEN` also suppresses the local-fallback restore (`action.yml:288`).
- Fix: remove the job-level `TURBO_*` env from both workflows. Route them through `setup-monorepo-ci` with `turbo-remote-cache: "true"`, `turbo-api: ${{ vars.TURBO_API }}`, `turbo-read-token: ${{ secrets.TURBO_READ_TOKEN }}` and no write token. `ci-job-env.mjs` would leave schedule/dispatch events local-only, or the policy should be extended to grant read-only access to `schedule` on `main`.
- Fixture: a `ci-job-env` policy port test (brief workstream C) with the event matrix {push, pull_request same-repo, pull_request fork, schedule, workflow_dispatch@main, workflow_dispatch@branch} × {token present/absent}, asserting the exported `TURBO_CACHE` mode and that `TURBO_API` is set whenever any token is exported. A workflow-lint fixture rejects a job-level `env.TURBO_TOKEN`.

**E-04. The required-check declarations disagree, and the guard test checks a stale fixture.**
- Evidence:

  | Context | Live ruleset | `CI_LANE_DESCRIPTORS` (`Ci/CiLane.ts:379`) | Snapshot `goals/ship-velocity/research/branch-protection-contexts.json` (captured 2026-08-27) |
  |---|---|---|---|
  | Heavy / Lint Policy | absent (removed 09-25) | required (`CiLane.ts:398`) | required |
  | Heavy / Coverage Regression | absent (removed 09-11) | required (`CiLane.ts:441`) | required |
  | JSDoc Ratchet | **required** | non-required (`CiLane.ts:529`) | absent |

  - `test/ci-lane.test.ts:352` ("matches the exact captured required-check context set") compares the descriptors with the snapshot, so it is green while both differ from GitHub.
  - The snapshot's `rulesetName` ("main branch protection") also no longer matches the live "main".
  - `standards/architecture/DECISIONS.md:1509` says "The hosted Coverage Regression lane is the authority for the floors", but the context is no longer merge-blocking. No decision record was found for either removal.
- Fix:
  1. Decide each of the three contexts (restore the two Heavy contexts, or record the demotion), then make the descriptors match.
  2. Replace the frozen snapshot with a generated, dated capture written by a read-only `beep ci ruleset --capture` (new) and verified by `--check` against live `gh api …/rulesets/10240248`. Run it in Repo Sanity on push, where a network failure reports unknown rather than pass.
  3. Add `integration_id` 15368 (GitHub Actions) to each required context (see E-27).
- Fixture: the captured ruleset JSON from v52153287 against the descriptors fails with the three-row diff above; the reconciled descriptors pass; and an "unknown" network fixture yields a non-green advisory.

**E-05. Dependency review is permanently skipped (fails open) although the dependency graph is enabled.**
- Evidence:
  - `check.yml:1085-1141` reads `.security_and_analysis.dependency_graph.status` from `GET /repos/{repo}`. The live response has no `dependency_graph` key, so the status is `"unavailable"`, `enabled=false` and `Dependency review` (`check.yml:1143-1149`) is skipped.
  - The 2026-10-09 PR run 37935067245 logs `Dependency graph status could not be determined (got 'unavailable'); skipping the dependency-review gate`.
  - `/dependency-graph/sbom` returns 1,936 packages and `/dependency-graph/compare/<base>...<head>` succeeds.
  - The `dependency-review` descriptor (`CiLane.ts:584`) claims it is part of the required "Security" context.
- Fix: probe availability with `gh api repos/$GITHUB_REPOSITORY/dependency-graph/compare/$BASE...$HEAD` (403/404 means unavailable; other failures fail closed), or drop the probe and run `actions/dependency-review-action` unconditionally on PRs, now that the graph is known to be enabled.
- Fixture: probe-classifier fixtures, where compare 200 gives enabled, 404 "dependency graph disabled" gives disabled, 5xx or network error fails closed, and a repo payload lacking the key no longer means "skip".

**E-06. Retiring Knip requires a ruleset change in the same window.**
- Evidence: "Knip" is a required context (ruleset) and descriptor (`CiLane.ts:509`). The job is at `check.yml:858-880`.
- Removing the job without first removing the context leaves every PR "Expected" forever, and admin bypass (E-27) would become the only merge path.
- Fix, in this order:
  1. Remove "Knip" from ruleset 10240248 (hosted write, recorded in the packet Decision Log with the reverse command).
  2. Delete the job and the descriptor, and update `ci-lane.test.ts` (descriptor count 27 to 26).
  3. Re-capture the ruleset (E-04).
- Fixture: the E-04 reconciliation test fails if a required context has no producing job in any workflow, using a workflow-job-name inventory parsed from `.github/workflows/*.yml` (including the `Heavy / ` prefix for `heavy.yml` jobs called by `check.yml`).

### P2

**E-07. The PR size labeler accumulates contradictory labels.**
- Evidence: in `check.yml:20-49` (`pr-size`), `github.rest.issues.addLabels` (line 43) adds `size/{S,M,L,XL}` on every `pull_request` event and never removes the other `size/*` labels. 17 of the last 200 PRs carry two or more `size/*` labels (for example #1545 `size/S,size/L` and #1490 `size/XL,size/S`). The job fails on fork PRs (read-only token), and its context is non-required.
- Fix: list the current labels, remove every other `size/*` label, and add the new one only if it is absent. Port the threshold logic to a tested `beep ci pr-size` function so the job is a thin call. Skip fork PRs explicitly (`github.event.pull_request.head.repo.full_name == github.repository`).
- Fixture: label-diff function cases, where {current: [size/S, size/L, bug], count: 25} gives remove [size/S], add none (size/L kept), and {current: [], count: 3} gives add [size/S].

**E-08. Storybook cancels main pushes, and its artifacts dominate storage.**
- Evidence:
  - `storybook.yml:9-11` sets `cancel-in-progress: true` for every event, so 11 of the last 40 main pushes were cancelled and their Playwright-cache save (`storybook.yml:102-108`) never ran.
  - `storybook.yml:139-146` uploads `storybook-static` with no `retention-days` on every PR and push. There are 3,360 unexpired artifacts (about 38.4 GiB) at the repo maximum of 90 days.
- Fix: use `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` (the same as `check.yml:14`). Set `retention-days: 7` for PRs and 30 for push, or upload only on push.
- Fixture: a workflow-lint rule that every workflow with a `push: main` trigger and a concurrency block must not cancel push runs, and every `upload-artifact` step must declare `retention-days`.

**E-09. Release Desktop has no release environment, no signing secrets, and has never run.**
- Evidence:
  - `release-desktop.yml:84,363` uses `environment: professional-desktop-release`, but the environment does not exist (API 404). GitHub would create it unprotected on first use, so the header comment's "cannot run before release approval" (`release-desktop.yml:20-22`) is false.
  - `TAURI_SIGNING_PRIVATE_KEY` is absent from repo, org and environment secrets, so `release-desktop.yml:151-159` would fail.
  - The workflow has never run.
  - The updater endpoint in `apps/professional-desktop/src-tauri/tauri.conf.json:36` and comment line 28 still names the previous owner (`kriegcloud/beep-effect`) and relies on GitHub's rename redirect.
  - `tauri-apps/tauri-action@84b9d35…` (line 208) has no version comment.
- Fix: workstream D decides. Either (a) create the environment with required reviewer = operator, prevent self-review off, branch/tag policy `professional-desktop-v*`, and move the signing secrets there; or (b) record the release path as dormant and disable the workflow (`gh workflow disable`) with a reconsideration condition. Either way, fix the endpoint to `beep-effect/beep-effect` and annotate the action version.
- Fixture: a hosted-settings check (`gh api …/environments/professional-desktop-release` exists with a `required_reviewers` rule) that runs in a read-only `beep ci settings --check`. A missing environment fails.

**E-10. Official Data Sync has failed every month since at least July and over-grants write access.**
- Evidence:
  - The `BEEP_ISO3166_*` secrets and `BEEP_DATA_SYNC_TOKEN` are not configured (repo and org secret lists).
  - Workflow-level `contents: write` and `pull-requests: write` apply (`data-sync.yml:306-308`).
  - The checkout persists credentials (`data-sync.yml:319-322`) while third-party downloads, `bun install` lifecycle scripts and tests run.
  - `cache-write: "true"` makes it the only Bun-cache writer (E-16).
  - The fallback `github.token` (line 382) opens PRs whose events never trigger `Check`, so a sync PR can never satisfy the required contexts.
  - The workflow has no concurrency group.
- Fix: decide whether to retire or repair. If repaired: job-level permissions, `persist-credentials: false`, a dedicated GitHub App or fine-grained token so the PR triggers CI, `cache-write: "false"`, `concurrency: data-sync`, and a precondition step that skips with a notice (rather than failing) when the authenticated-source secrets are absent, or drop `--include-authenticated`.
- Fixture: the E-03 event-matrix test extended with `schedule` plus a missing-secret case, giving `skipped-with-notice` rather than exit 1.

**E-11. Cache Warm fails every time, so the deliberate cold-recovery path does not work.**
- Evidence:
  - `cache-warm.yml:76-77` runs `bun run beep cache warm`.
  - The last 3 runs failed in `@beep/repo-docgen#test` (2026-10-01 run 36867409067, `turbo run build check lint test --cache=local:w,remote:w`).
  - It also pins older action majors than every other workflow (`actions/checkout@…# v4.4.0` line 63, `upload-artifact@…# v4.6.2` line 81).
- Fix: attribute the docgen test failure (inherited or environment-only on the heavy runner), fix it once on main, and align the action pins. Consider warming only `build check` (the tasks other lanes restore) rather than `test`.
- Fixture: the cache workstream (G) explicit remote-hit proof, as a warm receipt JSON followed by a PR lane `.turbo/runs/*.json` showing `remote` hits for the same hashes.

**E-12. Heavy "docs-only" admission is broader than the lanes' own relevance gates.**
- Evidence:
  - `Ci/HeavyAdmission.ts:283` `heavyDocsOnlyPattern` treats any `\.md$` path, plus `docs/`, `explorations/`, `research/` and `.changeset/*.md`, as docs-only. Such a PR gets `skip-satisfied` (`verdictFor`), and `heavy.yml:34,114-118` reports every `Heavy / *` context green without work.
  - The Docgen lane's own gate (`heavy.yml:126-131`) treats `\.md$` changes as docgen-relevant, and `turbo.json` `docgen` inputs are `$TURBO_DEFAULT$` (all tracked package files). So a PR touching only `packages/*/README.md` or `**/src/**/*.md` passes the required `Heavy / Docgen` and `Heavy / Doctest` without proof.
  - `scripts/ci-change-profile.sh:32-39` (`goals_only`) is a third, narrower definition.
- Fix: derive docs-only from one schema-owned classifier shared by the admission decision and the change-profile port (workstream C). Exclude paths under `packages/`/`apps/` that are Turbo inputs of docgen/doctest.
- Fixture: classifier cases, where `packages/a/README.md` is not docs-only, `docs/runbooks/x.md` is docs-only, and `goals/x/PLAN.md` is docs-only (goals_only true), plus a parity test that the admission and change-profile classifiers agree on a shared corpus.

**E-13. Fork PR code can reach the self-hosted heavy pool with only a label as the gate.**
- Evidence: `sourcesFor` (`Ci/HeavyAdmission.ts`, around line 306) admits any `pull_request` carrying `ready-for-heavy` and never inspects `head.repo`. `heavy.yml:34` then runs the PR checkout on `beep-ec2-heavy`, whose runner group `allows_public_repositories: true`. The runner user has `sudo` and can run `--privileged` containers (`fleet-shadow-check.yml:84,159`). Mitigations present: one-use JIT/ephemeral workers, IMDS denial gates, a runner group restricted to `@main` workflows, fork PRs need approval (`all_external_contributors`), and the label needs triage rights.
- Fix: make admission return `hold` for fork heads unless a second, distinct label (for example `ready-for-heavy-fork`) is present. Never return `skip-satisfied` for forks, because that would mark the contexts satisfied without proof. Record the decision.
- Fixture: `HeavyAdmissionEvent` gains `headRepository`/`baseRepository`. A fork with `ready-for-heavy` gives `hold`; a same-repo PR with the label gives `run`.

**E-14. The cache-writer environment is attached to jobs that do not write, and accumulates deployments.**
- Evidence:
  - `check.yml:138` puts the whole `verify` matrix in `turbo-cache-write` on push, including `uses_turbo: "false"` lanes (repo-sanity, ecosystem, shadcn-lint, codegen), and passes `turbo-remote-cache: "true"` plus `TURBO_TOKEN` to all of them (`check.yml:236-240`).
  - `heavy.yml:36` does the same for lint-policy and docgen (`uses_turbo: "false"`).
  - About 21 deployments are created per main push. There are about 9,510 deployment records, and the E-01 stall is a deployment wait.
- Fix: set `environment:` and `turbo-token` only where `matrix.uses_turbo == 'true'` (expression on both), or split non-Turbo lanes into a job without the environment.
- Fixture: the workflow-lint rule from E-02 extended so that a job reading the write token must have `uses_turbo` true or an explicit allowlist entry.

**E-15. The application-secret plumbing is dead, and the trusted Cachix push is a no-op.**
- Evidence:
  - Eight app secrets (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `EMAIL_RESEND_API_KEY`, `AUTH_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SECURITY_TRUSTED_ORIGINS`, `LIVEBLOCKS_SECRET_KEY`) are passed at six call sites (`check.yml` verify/lint-shard/test-unit-shard/property-laws, `heavy.yml:151-158`, and `action.yml:87-118` inputs). None exists in repo, org or `turbo-cache-write` secrets, so `ci-job-env.mjs` always exports blanks.
  - `CACHIX_AUTH_TOKEN` (`check.yml:1186`) is absent, so "Setup Cachix (trusted push)" has nothing to push.
- Fix: decide whether any job needs real app secrets. If none does, delete the inputs and the `app-secrets` branch of `ci-job-env.mjs` while keeping the blank-export behavior that stabilizes Turbo env hashing (the brief's credential-policy parity requirement). Remove or provision Cachix push.
- Fixture: the `ci-job-env` port test asserts the same blank-export set for every event (hash stability) after the inputs are removed.

**E-16. The setup action defaults to cache-write; the Bun cache writer is stale, and the cache budget is exhausted.**
- Evidence:
  - `action.yml:9-12` defaults `cache-write: "true"`. Every caller overrides it to `"false"` except `data-sync.yml:328`, the only `bun-*` cache writer (monthly and failing).
  - `bun-Linux-fleet` (3.6 GiB) and `bun-Linux-shared` (2.0 GiB) are each a single stale entry, restored on every non-baked setup (`action.yml:277-285`), although the action comments state that restoring cost more than a fresh install.
  - Total cache usage is 10.72 GB against the 10 GB default, which causes eviction churn.
- Fix: default `cache-write` to `"false"` (fail closed), delete the Bun restore/save steps or limit them to the trusted push writer, and purge the stale `bun-*` entries.
- Fixture: action-input default lint (`cache-write` default must be `"false"`), plus a cache-usage receipt before and after the purge.

### P3

- **E-17. Ghost workflow.** `repo-law` (`.github/workflows/repo-law.yml`, id 231729043) is registered `active` with no file at head. Fix: `gh workflow disable 231729043`. Check: the workflow list shows it disabled.
- **E-18. Impeccable residue in `.github` (workstream A retire).** Remove `.github/hooks/impeccable.json` (a postToolUse hook that runs `node .github/skills/impeccable/scripts/hook.mjs`), `.github/skills/impeccable/**` (153 files, 3.5 MB) and `.github/agents/impeccable-*.agent.md` (4). Consumers to update: `packages/tooling/tool/cli/test/skills-provenance.test.ts`, `Knowledge/Knowledge.refs.ts`, `Quality/Quality.command.ts`, `biome.jsonc`, `biome.identity.jsonc`, `eslint.config.mjs` and `knip.jsonc` (which reference `.github/skills|agents|hooks`). No SkillOpt or SST references exist under `.github`.
- **E-19. Unused allowlist entry.** `changesets/action@*` is in the allowed actions with no consumer; remove it unless workstream D keeps a publish path. `swatinem/rust-cache` stays (used inside actions-rust-lang).
- **E-20. Runner group scope.** `beep-ec2-heavy` selected workflows include `check.yml@refs/heads/main`, but no `check.yml` job targets the pool. `heavy-admit.yml` is not listed and its `heavy.yml@main` calls still get runners, which suggests matching is by the called workflow. Remove `check.yml` after a probe on a program PR. `fleet-lane-probe.yml` (pre-cutover parity probe, last run 09-09) needs a keep or retire decision.
- **E-21. Unused permissions.** SAST has `security-events: write` (`check.yml:1198`) but no SARIF upload exists in the lane (`CiLane.ts` has no sarif/upload); drop it. Security has `pull-requests: write` (`check.yml:1053`), used only by the always-skipped dependency review (E-05); keep it only once E-05 is fixed.
- **E-22. Missing timeouts.** The aggregators `lint` (`check.yml:444-456`) and `test-unit` (`check.yml:558-570`), and `release-desktop-ready` (`release-desktop.yml:360`), have no `timeout-minutes` (the default is 360).
- **E-23. Persisted checkout credentials.** `persist-credentials` defaults to true in `data-sync.yml:320`, `property-laws-nightly.yml:191` (with `issues: write` at workflow level, `:177-179`), `release-desktop.yml:126` and `:375` (`contents: write`). Set it to false and move permissions to job level.
- **E-24. Action major drift, with no updater for actions.**
  - `actions/checkout` v4.4.0 (cache-warm) vs v5.1.0.
  - `upload-artifact` v4.6.2 vs v7.0.1.
  - `actions/cache/save` v4.3.0 (the "post-lane Turbo fallback" steps in check/heavy) vs v6.1.0.
  - `cachix/install-nix-action` v30.
  - There is no `.github/dependabot.yml`, so with `sha_pinning_required` nothing bumps the pins. Add a dependabot `github-actions` ecosystem entry or a `beep` pin-check.
- **E-25. Push trust check.** `scripts/ci-job-env.mjs:58` uses `trustedPush = eventName === "push"` with no `GITHUB_REF == refs/heads/main` check. It is safe only because no other push trigger uses the action today (release-desktop tag pushes do not request remote cache). Add the ref check as defense in depth when porting to Ci (workstream C).
- **E-26. Orphan secrets and duplicates.** `APP_ENV`, `APP_LOG_FORMAT`, `APP_LOG_LEVEL`, `APP_NAME` and `NEXT_PUBLIC_ENV` are referenced by no workflow. `TURBO_TEAM` exists as both a secret and a var (`vars.TURBO_TEAM || secrets.TURBO_TEAM` in nightly and data-sync). 18 unprotected Vercel `Preview – *`/`Production – *` environments, including one auto-suffixed name, need an owner check before cleanup.
- **E-27. Ruleset hardening.**
  - Required contexts have no `integration_id`, so any app with statuses write can satisfy them.
  - `required_review_thread_resolution` is false although doctrine treats unanswered threads as a hard merge gate (enforced only by yeet tooling).
  - CODEOWNERS is ineffective (`require_code_owner_review: false`).
  - Admin `always` bypass was added 10-06; record its owner and reconsideration condition in the packet.
  - These are hosted writes; each needs a Decision Log entry with its reverse.
- **E-28. Heavy Admit pending replacement.** `heavy-admit.yml:245-247` groups every `labeled` event per ref with no cancel. A non-`ready-for-heavy` label event that arrives while a `ready-for-heavy` run is pending replaces (cancels) that pending run, so the matrix never runs and the contexts stay "Expected". Fix: include the label name in the group (`heavy-admit-${{ github.ref }}-${{ github.event.label.name == 'ready-for-heavy' }}`). Fixture: a concurrency-key function test, or a hosted probe on a program PR that applies two labels quickly.
- **E-29. Inherent PR-controlled workflows.** Required contexts other than `Heavy / *` come from PR-ref workflow files, so a same-repo PR can rename or neuter its own required job. Only `heavy.yml@main` is trusted. Accept and document this as the single-operator posture; no fixture applies.
- **E-30. Descriptor coverage.** `CI_LANE_DESCRIPTORS` documents itself as "check.yml lane" inventory, but 8 entries are produced by `heavy.yml` (7) or `storybook.yml` (1). The `Heavy Admission` job (in `check.yml` and `heavy-admit.yml`) and the scheduled or dispatch workflows have no declaration. Add a `workflow` field (`check|heavy|storybook`) to `CiLaneDescriptor` and a parser test that every hosted job name maps to a descriptor or an explicit exemption.
- **E-31. Heavy changes are proven only after merge.** `check.yml:130` and `heavy-admit.yml:295` call `heavy.yml@main`, so PR edits to `heavy.yml` are not exercised before merge (forced by the runner-group restriction, `heavy.yml:76-83`). Document it, and require a post-merge Heavy probe for `heavy.yml`-touching PRs, once E-01 is cleared.
- **E-32. Composite action runs PR code.** In the PR checkout, `setup-monorepo-ci`, `scripts/ci-change-profile.sh` (`eval`'d) and `scripts/ci-job-env.mjs` are PR-controlled even inside `heavy.yml@main`. Secret exposure is still bounded, because `heavy.yml` gates the write token and app secrets on `github.event_name == 'push'` in the trusted file and PRs get only `TURBO_READ_TOKEN`. Keep the secret expressions in the caller (never move them into the composite action or the script), and note it in the port's acceptance criteria.
- **E-33. Comment drift.** `heavy-admit.yml:229-232` says `size/*` from pr-size "spends nothing". That is true for GITHUB_TOKEN labels, but human or agent labels do start runs (see E-28).

## Generated lane declarations vs actual jobs

`bun run beep ci lane --list` returns 27 descriptors. Mapped to hosted jobs:

| Descriptor id | Context | Producing job | Required (descriptor / ruleset) |
|---|---|---|---|
| pr-size | PR Size Label | check.yml `pr-size` | no / no |
| lint | Lint | check.yml `lint` (aggregates `Lint (lint-a/b)`) | yes / yes |
| lint-policy | Heavy / Lint Policy | heavy.yml matrix | **yes / no** |
| repo-sanity | Repo Sanity | check.yml `verify` | yes / yes |
| check | Heavy / Check | heavy.yml | yes / yes |
| test-unit | Test Unit | check.yml `test-unit` (aggregates 4 shards) | yes / yes |
| test-integration | Heavy / Test Integration | heavy.yml | yes / yes |
| coverage | Heavy / Coverage Regression | heavy.yml | **yes / no** |
| docgen | Heavy / Docgen | heavy.yml | yes / yes |
| doctest | Heavy / Doctest | heavy.yml | yes / yes |
| ecosystem | Ecosystem Contracts | check.yml `verify` | no / no |
| codegen | Codegen Drift | check.yml `verify` | yes / yes |
| desktop-ipc | Professional Desktop IPC Stdio | check.yml | yes / yes |
| fallow | Fallow Advisory Envelopes | check.yml | no / no |
| knip | Knip | check.yml `knip` | yes / yes (retire: E-06) |
| shadcn-lint | Shadcn Lint | check.yml `verify` | no / no |
| jsdoc-ratchet | JSDoc Ratchet | check.yml | **no / yes** |
| build | Heavy / Build | heavy.yml | no / no |
| commitlint | Commitlint | check.yml | yes / yes |
| secrets | Secret Scanning | check.yml (inline gitleaks) | yes / yes |
| security, dependency-review | Security | check.yml (dependency review skipped: E-05) | yes / yes |
| nix | Nix Shell | check.yml | yes / yes |
| sast | SAST | check.yml | yes / yes |
| property | Property Laws | check.yml | no / no |
| labs | Labs | check.yml `verify` | no / no |
| storybook | Storybook | storybook.yml | no / no |
| (none) | Heavy Admission | check.yml `admission`, heavy-admit.yml | no declaration / no |

Every required ruleset context has a producing job. No descriptor lacks a job.

## Proposed plan (implementing lane for workstream E)

1. **Unblock first (orchestrator, hosted write):** cancel run 37518935952 (E-01) and confirm the next main push Check completes. Every later hosted proof depends on it.
2. **Hosted settings PR-independent writes**, each with a Decision Log row and its reverse:
   - Delete the repo-level `TURBO_TOKEN` (E-02).
   - Disable the `repo-law` ghost (E-17).
   - Enable secret-scanning push protection.
   - Decide `professional-desktop-release` (E-09).
   - Remove the `changesets/action` allowlist entry if D drops publishing (E-19).
   - Narrow the runner group (E-20) after a probe.
3. **Ruleset reconciliation:**
   - Decide Coverage Regression, Lint Policy and JSDoc Ratchet.
   - Remove `Knip` in the same window as the job deletion (E-06).
   - Add `integration_id` and reconsider thread resolution (E-27).
   - Land the `beep ci ruleset --capture/--check` command and regenerate the snapshot (E-04).
4. **One workflow PR** (a single push per wave):
   - pr-size label replacement (E-07).
   - Storybook concurrency and retention (E-08).
   - Nightly and data-sync credential routing, or data-sync retirement (E-03, E-10).
   - The environment limited to Turbo writers (E-14).
   - The dependency-review probe (E-05).
   - Permissions, timeouts and persist-credentials (E-21..E-23).
   - Action pin alignment plus a dependabot actions entry (E-24).
   - Heavy-admit concurrency key (E-28).
   - Impeccable removal (E-18, shared with A).
   - `cache-write` default false and the Bun cache path (E-16).
5. **CLI changes with fixtures (workstream C port):**
   - Shared docs-only classifier (E-12).
   - Fork-aware admission (E-13).
   - `ci-job-env` port with the event × credential matrix and a ref check (E-03, E-15, E-25).
   - Descriptor `workflow` field plus a YAML job-name parser test (E-30).
   - Workflow-lint rules: write-token-in-env, push-never-cancelled, artifact retention, action default (E-02, E-08, E-14, E-16).
   - Run `bun run beep quality package-verify @beep/repo-cli`.
6. **Hosted verification on the program PR:**
   - A PR run where pr-size leaves exactly one label.
   - Dependency review executes.
   - A main push where the environment is attached only to Turbo jobs and the remote cache reports `read-write (trusted push)`.
   - A nightly dispatch with no 403 warning.
   - A follow-up PR showing remote hits (with G).
7. **Fix the cache-warm docgen failure** once on main (E-11), attributed before repair.

## Open questions

- Why does run 37518935952 wait on a pending `turbo-cache-write` deployment with no reviewers or wait timer? Possible causes include a GitHub-side deployment-protection stall or the deployment-record volume; this was not established. Does it recur after cancellation?
- Is the repo-level `TURBO_TOKEN` the same credential as the environment copy, or a different (possibly obsolete) token? Values are not readable, so the operator should rotate after deletion if unsure.
- Who removed `Heavy / Coverage Regression` (09-11) and `Heavy / Lint Policy` (09-25) from the ruleset, and why? The history API reports only actor type `User`; no repo decision record was found (searched `DECISIONS.md`, `docs/runbooks/ci-runner-reliability.md` and `git log --grep`). The runner-reliability runbook records high runner-loss rates for exactly those two lanes, which is a plausible but unconfirmed reason.
- Are any of the 18 Vercel `Preview – *`/`Production – *` environments still bound to live Vercel projects? This needs the Vercel side.
- Does the `beep-ec2-heavy` runner group match reusable workflows by caller or by called file? The inference in E-20 comes from `heavy-admit.yml` succeeding without a listing; prove it with a probe before narrowing.
- Should `fleet-lane-probe.yml` and `fleet-shadow-check.yml` stay as operator probes? The red-team gates look like durable security evidence, while the lane probe is described as pre-cutover tooling.
- Whether any job truly needs the app secrets (E-15) was not established from workflows alone. It needs a test-suite grep for `DATABASE_URL` and similar under CI conditions.
