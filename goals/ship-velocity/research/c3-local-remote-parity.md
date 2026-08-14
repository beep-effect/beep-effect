# C3 — local verify ↔ remote CI parity audit

Date: 2026-08-13  
Scope: PR workflows and the current `bun run beep yeet verify` / `publish` implementation on `main`.  
Method: source audit only; no installs, builds, tests, Turbo, or Yeet commands were run.

## Findings

### 1. The advertised invariant is false in the current implementation

The Yeet skill says full verify runs “the same global commands CI runs,” including full docgen, test, secrets/security/SAST/Nix, and therefore predicts a first-push green (`.claude/skills/yeet/SKILL.md:215-226`). The live implementation does something different:

- `yeet verify` plans one `bun run beep quality github-checks pre-push` step and then a detached-HEAD frozen install (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:364-387`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:622-628`).
- That pre-push collector contains build, root lint, root check, Knip, JSDoc Ratchet, bounded local docgen, root test, two Fallow checks, seven Repo Sanity checks, secret/security/SAST/Nix, and changeset status on branches (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:223-253`, `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:272-339`, `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:357-419`).
- It does **not** contain CI's Coverage Regression, Codegen Drift, Commitlint, Professional Desktop IPC Stdio, Ecosystem Contracts, Property Laws, or Storybook browser test. The dedicated `beep ci local` battery does contain every locally runnable `check.yml` lane, including those omitted lanes, but Yeet does not call it (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1205-1227`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:364-370`).
- `beep ci local --fast` explicitly skips coverage, integration, and Nix, but full `beep ci local` does not (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1229-1256`). This makes it the natural source for an exact parity tier, not the current pre-push approximation.

The practical result is that a green default verify cannot guarantee the 16 required hosted contexts. Coverage and Codegen are complete blind spots, while several other contexts are only approximated by broader but differently shaped local commands.

### 2. PR workflow inventory

Only `check.yml` and `storybook.yml` trigger on pull requests to `main` (`.github/workflows/check.yml:1-7`, `.github/workflows/storybook.yml:1-7`). Release, desktop release, data sync, property-nightly, fleet-probe, and fleet-shadow workflows have no PR trigger, so they are outside this matrix.

#### Shared execution environment

- Matrix PR jobs use Bun from `.bun-version` (1.3.14), Node from `.nvmrc` (24 unless `use-node: false`), and `bun install --frozen-lockfile` (`.github/actions/setup-monorepo-ci/action.yml:26-41`, `.github/actions/setup-monorepo-ci/action.yml:64-71`, `.bun-version:1`, `.nvmrc:1`).
- For PRs, the verify matrix sets `TURBO_CACHE=local:rw`; Turbo API/token/team and application secrets/DB URLs are empty because their expressions are push-only (`.github/workflows/check.yml:118-132`). The platform also supplies standard GitHub Actions variables such as `CI`, `GITHUB_ACTIONS`, `GITHUB_EVENT_NAME`, and `GITHUB_BASE_REF`.
- Turbo-backed matrix lanes receive `--affected --base origin/main --summarize`; `TURBO_SCM_BASE=origin/main` is injected by the CLI (`.github/workflows/check.yml:218-245`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:650-683`).
- Required status is from the current repo descriptor/offline ruleset snapshot. The descriptor's 16 `required: true` rows align with the same-day live-ruleset receipt; visible JSDoc Ratchet is explicitly not required (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:340-405`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:417-532`, `goals/ci-lane-economics/research/OPPORTUNITIES.md:30-38`). Ruleset state is not declarative in the repository, so this is a dated 2026-08-13 assertion, not a timeless workflow property.

#### Check workflow jobs

| PR check / required | Runner | Exact PR command and material environment |
| --- | --- | --- |
| PR Size Label / no | `ubuntu-24.04` | Inline `actions/github-script` paginates PR files and applies `size/S..XL`; GitHub API only (`.github/workflows/check.yml:17-46`; non-required descriptor at `CiLane.ts:330-339`). |
| Lint / **yes** | `ubuntu-24.04` | Wrapper: `bun run beep ci lane lint --affected --base origin/main --summarize`; body: `bunx turbo run lint --concurrency=2 --affected --summarize`, `TURBO_SCM_BASE=origin/main` (`.github/workflows/check.yml:58-63`, `.github/workflows/check.yml:220-229`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:650-683`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:901-905`). |
| Lint Policy / **yes** | `beep-ec2-heavy` | `bun run beep ci lane lint-policy` → `bun run beep lint policy`; `CI=true` makes the policy scan full-repo and its subprocess group concurrency is 3 (`.github/workflows/check.yml:64-69`, `.github/workflows/check.yml:230-232`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:905`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1599-1620`). |
| Repo Sanity / **yes** | `ubuntu-24.04` | `bun run beep ci lane repo-sanity --changeset-status` → `bun run audit:github repo-sanity` plus `bun run changeset:status:since-main`. Repo Sanity expands to changeset graph, config sync, Fallow boundaries config, version sync offline, Syncpack, Sherif, and Bun high audit (`.github/workflows/check.yml:70-75`, `.github/workflows/check.yml:233-238`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:933-937`, `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:296-339`). |
| Check / **yes** | `beep-ec2-heavy` | `bun run beep ci lane check --affected --base origin/main --summarize` → `bun run check -- --concurrency=1 --affected --summarize`. Affected scope suppresses root-only tsgo test/smoke extras (`.github/workflows/check.yml:76-81`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:804-806`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1409-1418`). |
| Test Unit / **yes** | `ubuntu-24.04` | `bun run beep ci lane test-unit --affected --base origin/main --summarize` → `bun run test -- --unit --concurrency=2 --affected --summarize` (`.github/workflows/check.yml:82-87`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:943-945`). |
| Test Integration / **yes** | `beep-ec2-heavy` | `bun run beep ci lane test-integration --affected --base origin/main --summarize` → `bun run test -- --integration --affected --summarize`. It runs parallel integration tasks, then serial SQL tests at concurrency 1; with PR DB env blank it starts PGLite Testcontainers and injects `BEEP_TEST_DATABASE_*` (`.github/workflows/check.yml:88-93`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:942`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1228-1277`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1287-1310`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1833-1865`). |
| Ecosystem Contracts / no | `ubuntu-24.04` | `bun run beep ci lane ecosystem` → Effect-Drizzle `beep:type-test`, then `beep:bundle-probe` (`.github/workflows/check.yml:94-99`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:865-879`; non-required at `CiLane.ts:408-415`). |
| Coverage Regression / **yes** | `beep-ec2-heavy` | `bun run beep ci lane coverage --affected --base origin/main --summarize` → `bun run coverage -- --concurrency=3 --affected --summarize`; env forces `CI=true`, `GITHUB_ACTIONS=true`, `VITEST_COVERAGE_RATCHET=1`, fixed `BEEP_FC_SEED=20260708`, `NODE_OPTIONS+=--no-experimental-webstorage`, and clears terminal metadata (`.github/workflows/check.yml:100-105`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:855`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:584-605`). Coverage is cache-disabled (`turbo.json:166-180`). |
| Docgen / **yes** | `beep-ec2-heavy` | PR gate computes `none`, `affected`, or `full`. Normal affected mode is `bun run docgen:local -- --base origin/main --head HEAD --parallel=3`; changes to docgen implementation or global Bun/Turbo/TS config force `bun run docgen` (`.github/workflows/check.yml:146-169`, `.github/workflows/check.yml:240-245`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:685-698`). |
| Codegen Drift / **yes** | `ubuntu-24.04` | `bun run beep ci lane codegen` → ECFR `generate`; `git diff --exit-code -- packages/drivers/ecfr/src/_generated packages/drivers/ecfr/openapi.json`; Professional Desktop `codegen:check` (`.github/workflows/check.yml:112-117`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:807-835`). |
| Professional Desktop IPC Stdio / **yes** | `ubuntu-24.04` | Path-gated; installs stable Rust, then `bun run beep ci lane desktop-ipc` → app `beep:test:integration:ipc` (`.github/workflows/check.yml:261-317`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:856-863`). |
| Property Laws / no | `ubuntu-24.04` | `bun run beep ci lane property --affected --base origin/main --summarize` → `BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708 bunx turbo run test:property --concurrency=4 --affected --summarize`; local-only Turbo cache on PR (`.github/workflows/check.yml:323-374`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:583-609`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:920-931`). |
| Fallow Advisory Envelopes / no | `ubuntu-24.04` | `bun run beep ci lane fallow --base origin/main`; blocking `audit`/`dead-code`, advisory `health`/`boundaries`/`flags`/`security`/`fix-preview`, followed by seven envelope schema checks and artifact upload (`.github/workflows/check.yml:376-502`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:700-757`). PR Turbo credentials are blank and cache is local-only (`.github/workflows/check.yml:441-453`). |
| Knip / **yes** | `ubuntu-24.04` | `bun run beep ci lane knip` → `bun run beep quality knip`; Node setup disabled (`.github/workflows/check.yml:504-525`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:900`). |
| JSDoc Ratchet / no | `ubuntu-24.04` | `bun run beep ci lane jsdoc-ratchet`: write CI inventory JSON/Markdown, then ratchet that inventory; Node setup disabled (`.github/workflows/check.yml:527-559`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:882-899`). |
| Commitlint / **yes** | `ubuntu-24.04` | Computes PR base SHA, then `bun run beep ci lane commitlint --from <PR_BASE_SHA> --to HEAD` → `bunx commitlint --from ... --to HEAD --verbose`; Node setup disabled (`.github/workflows/check.yml:602-660`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:837-854`). |
| Secret Scanning / **yes** | `ubuntu-24.04` | Pinned Gitleaks container digest scans `origin/main..HEAD` with `--redact`; critically, `.gitleaks.toml` and `.gitleaksignore` are copied from the base branch so a PR cannot weaken its own scan (`.github/workflows/check.yml:662-719`). |
| Security / **yes** | `ubuntu-24.04` | Pinned OSV action scans `bun.lock` with `osv-scanner.toml`; on PRs a GitHub API probe conditionally enables `actions/dependency-review-action` with severity `high` and AGPL-3.0/GPL-3.0 denial (`.github/workflows/check.yml:721-805`). `GH_TOKEN` exists only for the API step (`.github/workflows/check.yml:742-748`). |
| Nix Shell / **yes** | `ubuntu-24.04` | Installs Nix from `nixos-unstable`, read-only Cachix on PR, then `bun run beep ci lane nix` → `nix --option warn-dirty false flake check --all-systems` and `nix ... develop --command echo 'Dev shell OK'` (`.github/workflows/check.yml:808-847`, `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:906-918`). |
| SAST / **yes** | `ubuntu-24.04` | `bun run beep ci lane sast` → local/shared `github-checks sast`: Semgrep TypeScript, JavaScript, security-audit, secrets, and vendored first-party rules with `--error`; only changed tracked JS/TS files are scanned (`.github/workflows/check.yml:849-883`, `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:870-971`). |

`Build` in `check.yml` is push-only and does **not** run on PRs (`.github/workflows/check.yml:561-600`).

#### Storybook workflow

| PR check / required | Runner | Exact PR command and environment |
| --- | --- | --- |
| Build And Test / no | `ubuntu-24.04` | `bunx playwright install --with-deps chromium`; `bunx turbo run storybook:build --filter=@beep/storybook --summarize`; `bunx turbo run test:storybook --filter=@beep/storybook`; assert `apps/storybook/storybook-static/index.html`; upload artifact. PR env is `TURBO_CACHE=local:rw` with blank token/team (`.github/workflows/storybook.yml:17-79`). The app scripts expand to Storybook build and a browser test harness (`apps/storybook/package.json:27-34`). It is absent from the 16-context required set documented above, so it is visible but non-required as of 2026-08-13. |

### 3. What Yeet proves locally

#### Default `bun run beep yeet verify`

Execution order is:

1. `bun run beep yeet fallow-feedback --from .beep/fallow --emit .beep/yeet/fallow-quality-issues.json --advisory` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:344-362`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:622-627`).
2. `bun run beep quality github-checks pre-push`, after refreshing `origin/main` (`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:145-151`, `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:540-563`, `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:664-683`). Its lanes are:
   - Preflight: branch changeset status; Repo Sanity's seven checks; Knip; Fallow audit/dead-code; secrets; OSV; SAST; Nix (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:272-339`, `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:357-419`).
   - Heavy: full root `bun run build`, `bun run lint`, and `bun run check`. Local default Turbo concurrency is 3; root lint also runs the full repo-policy battery and root check adds tsgo test/smoke probes (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:223-236`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:563-568`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1399-1418`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1655-1689`).
   - Test: unscoped `bun run test`, which means unit plus parallel and serial integration, with the serial SQL resource chosen from local `BEEP_TEST_DATABASE_URL` / `DATABASE_URL*` when present or PGLite Testcontainers otherwise (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:253`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1294-1310`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1822-1868`).
   - Documentation: exact CI JSDoc inventory/ratchet, but `bun run docgen:local -- --allow-full`, not the CI workflow's computed `none/affected/full` command (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:237-252`).
3. `bun install --frozen-lockfile` in a detached temporary worktree of committed `HEAD` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:445-457`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:624-628`).

Full proof waves are fail-fast by default; `--collect-all` continues later waves (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:94-96`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:364-386`). The whole pre-push group is a single Yeet plan step; its sub-lanes are not reusable as separate durable proofs.

#### `verify --merged`

This already implements the requested would-be-merge-tree mechanism: it resolves the current base/head, runs `git merge-tree --write-tree`, creates a synthetic merge commit, checks it out in a detached worktree, performs a frozen install, and rebuilds/runs the normal proof plan there (`packages/tooling/tool/cli/src/commands/Yeet/internal/MergedPreview.ts:499-566`, `packages/tooling/tool/cli/src/commands/Yeet/internal/MergedPreview.ts:605-619`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:1118-1185`). It is opt-in and only exposed on `verify` (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:88-92`, `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:227-246`).

This matters because hosted PR jobs run the synthetic PR merge ref, while ordinary local verify proves the branch tree (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:1118-1126`). `--merged` closes tree shape, but not missing lanes: it still runs the same incomplete pre-push collector.

#### What `yeet publish` re-proves

Normal publish:

1. Checks base freshness. It warns when behind, but allows a stale base when branch/base path sets do not overlap; only overlap blocks by default (`packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:719-752`, `packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts:816-847`). This cannot detect semantic cross-file coupling.
2. Commits the reviewed intent, runs a clean-HEAD frozen-install preflight, runs the same full branch-tree pre-push proof, records exact proof state, verifies the proof did not dirty the tree, then pushes (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:498-527`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:607-615`).
3. `--reuse-verified` can skip the proof only after exact saved-state validation; `--fast --monitor` skips it; `--start-pr-early` pushes first, then runs it (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:411-418`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:448-495`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:506-519`).

Publish does **not** run the merge preview and offers no `--merged` flag (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:227-246`). Thus even normal non-fast publish can prove a green tree different from the tree GitHub immediately tests.

### 4. Parity matrix

Gap classes use the requested taxonomy. “Covered” means materially the same local body, while any important shape difference is still named.

| CI lane | Current local equivalent inside default Yeet verify | Gap class and precise gap |
| --- | --- | --- |
| PR Size Label | None | **REMOTE-ONLY by nature**; GitHub API label mutation, non-required (`CiLane.ts:330-339`). |
| Lint | Root `bun run lint` | **DIVERGENT FLAGS/ENV**: local is unscoped, concurrency 3, and co-schedules the repo-policy helpers; CI is affected Turbo-only at concurrency 2 (`GithubChecks.ts:223-236`, `CiLane.ts:650-667`, `CiLane.ts:901-905`). Local is semantically broader but not execution-identical. |
| Lint Policy | Included inside root lint | **DIVERGENT FLAGS/ENV**: same policy step list, but CI sets `CI=true` and owns an isolated heavy job; local runs it alongside root lint with local process/env/cache posture (`Tasks.ts:1599-1620`, `Tasks.ts:1663-1689`). |
| Repo Sanity | Same seven lanes + changeset status | Covered on a feature branch; local refreshes `origin/main`, matching PR baseline intent (`Quality.command.ts:540-563`, `GithubChecks.ts:272-339`). Still **DIVERGENT TREE** unless `--merged`. |
| Check | Full root `bun run check` | **DIVERGENT FLAGS/ENV**: local full graph, concurrency 3, plus tsgo tests/smoke; CI affected, concurrency 1, no extras (`Tasks.ts:1399-1418`, `CiLane.ts:804-806`). #668's flat source-mode package scripts are shared by both paths—for example the four reference-tip owners use `tsgo -p tsconfig.check.json` (`apps/practice-kg-mcp/package.json:17-23`, `apps/professional-desktop/package.json:23-26`, `packages/epistemic/server/package.json:17-25`, `packages/law-practice/server/package.json:17-23`)—so #668 did not itself introduce a semantic local/remote mode split. |
| Test Unit | Included in full root test | **DIVERGENT FLAGS/ENV**: local all packages/concurrency 3; CI affected/concurrency 2 (`Tasks.ts:1822-1831`, `CiLane.ts:943-945`). |
| Test Integration | Included in full root test | **DIVERGENT FLAGS/ENV**: PR DB URLs are forced blank, guaranteeing Testcontainers; local silently uses `BEEP_TEST_DATABASE_URL` or `DATABASE_URL*` if present (`check.yml:125-132`, `Tasks.ts:1294-1310`). Both run parallel + serial bodies, so services exist locally, but the database/provider may differ. |
| Ecosystem Contracts | None | **MISSING**. The exact two commands exist only in `beep ci lane ecosystem` (`CiLane.ts:865-879`). Non-required, but can still leave a visible red. |
| Coverage Regression | None | **MISSING** and highest-risk required gap. Root test never invokes coverage. CI runs affected, deterministic, ratcheted coverage with cache disabled (`Tasks.ts:584-605`, `turbo.json:166-180`). The comparison reads the committed `standards/coverage.regression-baseline.jsonc` from the checked-out merge tree and compares generated summaries (`CoverageRegression.ts:27-40`, `CoverageRegression.ts:505-521`, `CoverageRegression.ts:810-841`); it does not dynamically fetch a separate “main baseline.” Usually that file is main's baseline, but a PR can modify it. |
| Docgen | `docgen:local --allow-full` | **DIVERGENT FLAGS/ENV**: CI workflow calculates none/affected/full and uses affected `--parallel=3` or full root docgen; local uses bounded local mode with self-escalation (`check.yml:146-169`, `CiLane.ts:685-698`, `GithubChecks.ts:244-252`). This is much closer than the old “CI always full” description, but not literal command parity. |
| Codegen Drift | None | **MISSING** required lane: ECFR regeneration/drift plus desktop migration bundle check (`CiLane.ts:807-835`). |
| Professional Desktop IPC Stdio | None | **MISSING** required and workflow-gated. CI also installs stable Rust and applies a path filter (`check.yml:261-317`). |
| Property Laws | None | **MISSING** non-required. It uniquely enforces 400 deterministic runs with fixed seed and concurrency 4 (`CiLane.ts:583-609`, `CiLane.ts:920-931`). Ordinary unit tests do not imply this shape. |
| Fallow Advisory Envelopes | Only blocking audit/dead-code, plus prior-run advisory feedback | **MISSING** five advisory runs, seven envelope validations, and artifact-shape proof (`GithubChecks.ts:406-419`, `CiLane.ts:700-757`). Non-required. |
| Knip | Same `beep quality knip` | Covered command (`CiLane.ts:900`, `GithubChecks.ts:237`). **DIVERGENT TREE** unless `--merged`. |
| JSDoc Ratchet | Same `beep ci lane jsdoc-ratchet` | Covered command (`GithubChecks.ts:237-243`, `CiLane.ts:882-899`). Non-required; **DIVERGENT TREE** unless `--merged`. |
| Commitlint | No commit-range lane | **MISSING** required. Yeet validates the proposed single commit message before commit, but CI checks the entire PR range with `--from <base SHA> --to HEAD` (`check.yml:615-660`, `CiLane.ts:837-854`). Existing multi-commit branches and server-side squash text remain uncovered. |
| Secret Scanning | Host `gitleaks git` over merge-base..HEAD using branch config | **DIVERGENT FLAGS/ENV**: CI runs a pinned container digest and base-pins both config and ignore files; local trusts the branch's `.gitleaks*` and installed binary (`Quality.command.ts:826-850`, `check.yml:681-719`). This is a security-relevant false-green avenue. |
| Security | Docker OSV scanner v2.3.3 | **DIVERGENT FLAGS/ENV** plus **REMOTE-ONLY** dependency-review sub-gate. Local OSV is a close approximation (`Quality.command.ts:853-868`); GitHub dependency graph/license review cannot be reproduced offline (`check.yml:742-805`, `CiLane.ts:489-508`). |
| Nix Shell | Same two Nix commands | Command-covered, but **DIVERGENT FLAGS/ENV**: CI installs Nix against `nixos-unstable` on Ubuntu and optionally reads Cachix; local uses workstation Nix/store (`check.yml:808-847`, `CiLane.ts:906-918`). |
| SAST | Same shared `beep quality github-checks sast` body | Covered command and changed-file range (`check.yml:869-883`, `Quality.command.ts:870-971`). **DIVERGENT TREE** unless `--merged`; container registry/network availability remains environmental. |
| Build And Test (Storybook) | Root build may build Storybook, but no browser lane or artifact assertion | **MISSING** `test:storybook`, explicit Playwright Chromium setup, and static-artifact proof (`storybook.yml:57-79`). |
| Every branch-tree-covered lane | Ordinary verify/publish | **DIVERGENT TREE** whenever `origin/main` moved: GitHub proves the merge ref; default local proof uses HEAD. The stale-base guard only blocks overlapping paths, whereas semantic coupling can cross disjoint files (`PublishScope.ts:719-752`, `MergedPreview.ts:1-21`). |
| Greptile / Vercel or other hosted app checks | None | **REMOTE-ONLY by nature**. These are outside the two workflow files audited here; local parity should predict prerequisites and start them early, not claim reproduction. |

### 5. Ranked recommendations

Runtime estimates are directional for the stated 32c/64t, 128 GB workstation. They are grounded by the retained local full-proof mean of 1,022 s and hosted lane measurements, not by a benchmark run in this audit (`goals/quality-speedup/research/quality-time-inventory.md:78-93`, `goals/ci-lane-economics/research/cache-warm-lane-census.md:40-59`). Cold local times will vary with Bun/Turbo/Docker/Nix caches.

#### 1. Make exact merged-tree parity mandatory immediately before push

**Change:** add a pre-publish `--ci-parity` tier that first refreshes `origin/main`, materializes the existing merge preview, frozen-installs it, and runs `beep ci local --affected --base origin/main` from that worktree. Make normal `yeet publish` invoke it; retain an explicit monitored escape hatch for urgent/early push. Do not create a second merge-preview implementation—the existing `git merge-tree` lifecycle is already correct (`MergedPreview.ts:499-566`, `Handler.ts:1163-1185`).

- **Impact:** Very high. Closes every required CLI-runnable lane plus merge-tree drift in one architectural move; converts `beep ci lane` from unused parity infrastructure into Yeet's authoritative source.
- **Effort:** Medium, roughly 2–4 engineering days including plan/verdict/proof-state tests and path-gate parity.
- **Runtime:** Warm estimate +12–25 min over current verify, dominated by coverage; frozen install likely seconds to a few minutes. Coverage's hosted p50 is 13.6 min and cache is disabled (`cache-warm-lane-census.md:52`, `turbo.json:166-180`).
- **Risk:** Medium. A fully sequential 21-lane battery could overrun agent patience; preserve lane-level checkpoints and run independent cheap lanes concurrently within the 128 GB budget. Do not reuse a branch-tree proof as merged-tree proof—the proof key must include base SHA and merged tree SHA.

#### 2. Put cheap, deterministic missing required lanes into default verify now

**Change:** before the larger tier lands, add exact `beep ci lane codegen`, PR-range commitlint, and path-gated desktop IPC to default verify. Use the same path predicate as the workflow and install/check Rust only when selected. Also base-pin the local Gitleaks config/ignore and run the pinned container digest.

- **Impact:** High. Removes four common “local green, required remote red” classes (Codegen, Commitlint, Desktop IPC, Secret Scanning) without paying coverage on every edit loop.
- **Effort:** Low–medium, 1–2 days because lane definitions already exist; the workflow path-gate should be extracted or represented once rather than copied.
- **Runtime:** Warm +1–4 min normally; desktop lane adds about 1–3 min only on relevant changes. Hosted p50s including setup are Codegen 2.8 min, Commitlint 1.5 min, Secrets 0.9 min, Desktop 1.1 min (`cache-warm-lane-census.md:50-59`), so the workstation with dependencies already present should be lower.
- **Risk:** Low, except Codegen writes generated files before the drift check. Run it in the clean/merged temp worktree or assert no primary-worktree mutation.

#### 3. Make Coverage Regression a required pre-publish tier, not an every-edit default

**Change:** invoke the exact CI coverage lane (`--affected --base ... --summarize`, fixed env) in `--ci-parity` and mandatory normal publish. Keep it out of the default inner-loop verify unless coverage-owning files changed; use a conservative full fallback for global coverage inputs, lockfile, Vitest config, or coverage baseline changes.

- **Impact:** Very high. It is the slowest required blind spot and historically a high-failure lane; current default verify offers zero signal (`quality-time-inventory.md:58-71`).
- **Effort:** Low for unconditional wiring, medium for sound owner/global-trigger selection.
- **Runtime:** +8–15 min estimated on the 32-core workstation, bounded by the hard Turbo concurrency 3 and cache-disabled tasks (`CiLane.ts:855`, `Tasks.ts:515-522`, `turbo.json:166-180`).
- **Risk:** Medium. An unsound affected selector recreates false greens. Until owner selection is proved, prefer exact CI affected scope plus a full fallback rather than skipping.

#### 4. Sanitize local PR env and replay CI flags exactly in parity mode

**Change:** parity mode must set PR-equivalent blank application secrets/DB variables, `TURBO_CACHE=local:rw`, exact per-lane concurrency, and pinned Bun/Node. Force Test Integration to Testcontainers unless an explicit `--external-db` diagnostic override is selected. Dispatch `beep ci lane lint`, `lint-policy`, `check`, `test-unit`, and `test-integration` rather than treating full root commands as identical.

- **Impact:** High. Eliminates false greens from a developer's external DB/secrets and catches memory/concurrency-specific failures under the same lane shape.
- **Effort:** Medium, 2–3 days for a schema-backed environment profile and tests.
- **Runtime:** Similar work volume to current proof; exact affected scope may save 5–10 min versus the current full build/check/lint/test, offsetting some coverage cost. Current local full proof averages 17 min (`quality-time-inventory.md:78-89`).
- **Risk:** Medium. Blanking env indiscriminately can change tools outside the lane. Apply an allowlisted environment per lane, not a process-global mutation.

#### 5. Align Docgen through the existing workflow decision, not “always full”

**Change:** move the PR docgen gate predicate into CLI-owned planning and call the exact resulting `beep ci lane docgen --mode ... --base ... --head ...` from local parity. Keep `docgen:local --allow-full` as the fast developer loop.

- **Impact:** Medium. Removes command drift and a stale mental model: CI is affected by default and full only for global inputs, not unconditionally full (`check.yml:146-169`, `CiLane.ts:685-698`).
- **Effort:** Low–medium, about 1 day.
- **Runtime:** Usually 2–5 min affected; full remains the expensive fallback. Current hosted affected/full mixture has p50 2.9 min (`cache-warm-lane-census.md:49`).
- **Risk:** Low if the YAML predicate is deleted after CLI parity tests; high if duplicated in both places.

#### 6. Add path-triggered visible non-required lanes to parity, not the default global proof

**Change:** run Ecosystem Contracts for `packages/ecosystem/**`, Storybook Build And Test for Storybook/UI story/runtime changes, and full Fallow advisory envelope validation when its configuration or affected surfaces change. Run Property Laws affected with its fixed 400/seed contract either in `--ci-parity` or when a package exposes `test:property`.

- **Impact:** Medium. These do not block the current ruleset, but eliminating visible reds shortens human/reviewer backpressure and prevents “merge-ready except noisy jobs.”
- **Effort:** Medium, 2–4 days for single-sourced path predicates and Playwright provisioning.
- **Runtime:** +2–5 min Storybook, under 1–2 min Ecosystem, Fallow mostly overlaps existing blocking work, Property approximately +5–12 min affected on this workstation. Property's retained hosted p50 was about 9 min in the earlier census (`quality-time-inventory.md:60-68`).
- **Risk:** Medium. Browser dependencies and property tests add environment flake; pin Chromium/tool versions and retain the fixed seed used by CI.

#### 7. Accept genuine remote-only gates, but preflight and overlap them

**Change:** keep PR Size labeling, GitHub Dependency Review, Greptile, Vercel, and hosted permission checks remote-only. Before push, cheaply validate dependency-diff shape/license metadata locally and verify that the repository dependency graph is enabled when authenticated. Use `--start-pr-early --monitor` only as an overlap mode after the clean-HEAD install/security preflight, and never describe it as local parity.

- **Impact:** Medium for latency, zero false claim of reproducibility. Review and hosted checks start while local expensive proof runs (`Planner.ts:597-605`, `Handler.ts:448-495`).
- **Effort:** Low, roughly 1 day for cheap predictors/status rendering.
- **Runtime:** Seconds locally; saves wall-clock by overlapping remote queue/review with local coverage/property.
- **Risk:** Low. Predictors must remain advisory; the GitHub dependency-review verdict and reviewer findings stay authoritative.

#### 8. Store parity per lane and base SHA so fixes receive fast backpressure

**Change:** persist each `beep ci lane` result with command hash, tree SHA, base SHA, env-profile hash, duration, and reusable/non-reusable status. Fail-fast may stop expensive later lanes, but a rerun should reuse exact green lanes. Start cheap/high-failure lanes first, then coverage/property/docgen; stream every failure when memory permits.

- **Impact:** High for pipeline speed. Today Yeet wraps the whole battery as one proof step, so one late failure invalidates the practical value of earlier greens (`Planner.ts:364-387`). Retained data shows the local pre-push aggregate averaged 1,022 s and failed in 20/101 observed runs (`quality-time-inventory.md:78-89`).
- **Effort:** Medium–high, 3–6 days because proof-state and verdict schemas change.
- **Runtime:** No material cold penalty; large repeat-run savings.
- **Risk:** Medium–high. Reuse is safe only when all five identities match: command, lane inputs, merged tree, base SHA, and env profile. Any ambiguity must rerun.

## Bottom line

The repository already has both missing primitives: exact CLI lane definitions (`beep ci lane` / `beep ci local`) and an isolated merge-tree proof (`yeet verify --merged`). The failure is composition. Default Yeet still calls the older broad `github-checks pre-push` collector, while publish proves HEAD rather than the merge preview. The shortest high-certainty path is therefore:

1. add the cheap missing required lanes to default verify;
2. make exact `beep ci local` on the existing merged preview mandatory before normal publish;
3. keep Coverage in that mandatory pre-publish tier;
4. sanitize env to PR posture; and
5. leave only API/reviewer/vendor gates remote-only, started early and monitored.
