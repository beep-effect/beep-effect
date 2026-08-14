# C4 — Turbo remote cache: local enablement, warming, and hit rates

Date: 2026-08-13

## Findings

### 1. The AWS cache is deployed and strongly asymmetric, but current PRs and local quality commands do not read it

The deployed component is S3 behind API Gateway and three Lambdas. The authorizer accepts either token for reads, accepts only the trusted token for artifact `PUT`, and signs an accepted write for a separate validating writer wrapper (`infra/lambda/turbo-cache/src/authorizer.ts:22-38`, `infra/lambda/turbo-cache/src/authorizer.ts:56-93`). The read Lambda has `READ_ONLY=true`; the writer has `READ_ONLY=false`; both use the same S3 bucket, while the authorizer loads token parameter ARNs from SSM (`infra/src/CiTurboCache.ts:504-562`). API Gateway routes status/GET/HEAD/events to the reader and artifact PUT to the writer (`infra/src/CiTurboCache.ts:622-642`). The post-#700 integrations correctly use Lambda invocation ARNs, and the writer invoke permission is narrowed to PUT (`infra/src/CiTurboCache.ts:599-619`, `infra/src/CiTurboCache.ts:680-688`).

The history is:

| PR | Local merge commit | Result |
| --- | --- | --- |
| #654 | `b8fb5c97aa` | Designed token/method asymmetry and scaffolded `CiTurboCache`; did not deploy it. |
| #673 | `c0333d03d5` | Added the pinned `turborepo-remote-cache@2.12.0` Lambda package, instantiated the component from the runner stack, and recorded live read-deny/write-roundtrip probes. The component is now in the production entrypoint (`infra/src/internal/ci-runners-entry.ts:8-20`, `infra/src/internal/ci-runners-entry.ts:134-148`). |
| #674 | `f883e2b16a` | Initially gave same-repo PR jobs read-only remote access and main pushes read-write access. |
| #696 | `2824cbf641` | Reversed PR consumption: every PR-controlled `check.yml` block now receives blank remote settings and `local:rw`; only pushes get the endpoint/token/team and `local:rw,remote:rw` (`.github/workflows/check.yml:118-131`, `.github/workflows/check.yml:331-338`, `.github/workflows/check.yml:441-448`). |
| #700 | `281574a888` | Replaced function ARNs with invocation ARNs in both API integrations (`infra/src/CiTurboCache.ts:599-619`). |

Who can write today:

- On `push` to `main`, the Check verify matrix, Property Laws, Fallow invocation, and Build receive the `turbo-cache-write` environment or its trusted secret and `remote:rw` (`.github/workflows/check.yml:47-52`, `.github/workflows/check.yml:118-124`, `.github/workflows/check.yml:323-338`, `.github/workflows/check.yml:561-573`). Any cacheable Turbo task those jobs execute may write. Build is push-only and full-repo (`.github/workflows/check.yml:561-596`).
- A PR cannot write and, after #696, cannot read. The server would safely reject a read token's PUT anyway (`infra/lambda/turbo-cache/src/authorizer.ts:78-89`), but the workflow now withholds endpoint and token entirely.
- Local agents have no sanctioned write credential. They should receive only the read token. SSM parameter ARNs are infrastructure inputs, not a local credential-delivery mechanism (`infra/ci-runners/Pulumi.production.yaml:16-22`).

What “PR turbo cache local-only” means in practice is worse than merely “remote hits = 0.” PR setup restores the GitHub Actions `.turbo/cache` fallback only when remote credentials are absent, but every PR lane passes `cache-write: false` (`.github/actions/setup-monorepo-ci/action.yml:52-62`, `.github/workflows/check.yml:196-201`, `.github/workflows/check.yml:352-356`). The action saves that fallback only when `cache-write: true` (`.github/actions/setup-monorepo-ci/action.yml:81-87`). Main jobs use remote credentials, so they do not replenish the fallback. Consequently PR runners can consume only any compatible legacy/fallback entry that still exists; they do not publish fresh PR cache state for the next attempt. On ephemeral hosted/fleet runners, cold PR-lane hit rates will trend toward zero except for reuse inside a single Turbo graph.

### 2. A fresh local checkout is not remote-cache enabled, even if `.env` is copied

Turbo 2.10.9 is locked (`bun.lock:7597`), and the self-hosted client contract is the standard trio: `TURBO_API`, `TURBO_TOKEN`, and `TURBO_TEAM`. No custom `remoteCache` block is needed. The repository's `turbo.json` has no `remoteCache` configuration at all (`turbo.json:1-32`). Client artifact signature verification is also off: there is no `remoteCache.signature: true` and no `TURBO_REMOTE_CACHE_SIGNATURE_KEY`. The HMAC in the Lambda design authenticates API Gateway-to-writer invocation; it does not sign downloaded Turbo artifacts (`infra/lambda/turbo-cache/README.md:18-37`). The design explicitly calls artifact signing optional defense in depth (`goals/ci-fleet-endgame/research/p3-cache-design.md:276-291`).

The checked-in template lists only `TURBO_TOKEN` and `TURBO_TEAM`, not `TURBO_API` or `TURBO_CACHE` (`.env.example:189-201`). This checkout's ignored `.env` likewise defines only the first two names (`.env:128-129`); the token is a 1Password reference, but its referenced item cannot prove from metadata alone that it is the new AWS read token. There is no operator/local-cache setup page under `docs/`, `standards/`, or `scripts/`.

There are two independent local execution blockers:

1. Root quality commands deliberately add `--cache=local:rw` whenever they are not in CI and the caller supplied no cache-control flag (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:481-489`, `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:545-560`). This explicit argument prevents plain `bun run check`, `lint`, `test`, and `build` from using remote cache regardless of `TURBO_CACHE` in `.env`.
2. Only the root Build step opts into the local `op run --env-file=.env` wrapper (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1399-1406`). Ordinary Turbo steps do not set `useLocalEnv` (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1172-1180`). The CLI detects and removes unresolved `op://` values for `TURBO_TOKEN` and `TURBO_TEAM` before spawning Turbo (`packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:251-262`, `packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:294-307`). Thus merely copying the ignored `.env` does not inject those secrets for Check/Lint/Test.

Verdict: a plain quality command in a fresh checkout does **not** read the AWS remote cache today. Missing pieces are a documented `TURBO_API`; a stable nonempty `TURBO_TEAM`; a 1Password-backed read-only `TURBO_TOKEN`; read-only remote cache mode; and CLI support that both resolves the local 1Password environment and stops forcing local-only mode when a complete remote-read configuration is present.

### 3. Main already performs broad post-merge warming; there is no dedicated cache-warm workflow or command

`check.yml` runs on every push to `main` (`.github/workflows/check.yml:3-7`). PRs add `--affected`, but main does not, so main Turbo lanes traverse full task graphs and emit summaries (`.github/workflows/check.yml:209-228`). The push-only Build runs the full build graph and writes remote (`.github/workflows/check.yml:561-600`). This is already a post-merge warmer for build/check/lint/unit/property/docgen and any cacheable dependency tasks reached by those lanes. Integration, coverage, codegen, and other tasks explicitly marked `cache:false` cannot be warmed (`turbo.json:124-186`).

No `beep cache warm` command and no dedicated scheduled warm workflow exists. The nightly property workflow has `TURBO_TOKEN`/`TURBO_TEAM` but no custom `TURBO_API`, no `TURBO_CACHE`, and no `turbo-cache-write` environment (`.github/workflows/property-laws-nightly.yml:31-49`); it therefore is not wired to this asymmetric AWS cache. The same stale pre-AWS wiring exists in Storybook and data-sync (`.github/workflows/storybook.yml:21-27`, `.github/workflows/data-sync.yml:12-30`). These jobs should not be counted as AWS writers.

### 4. Cache-key fragmentation is dominated by broad global inputs, per-clone dotenv, lockfile/force policy, and environment/version skew

The repository's own retained-summary audit measured 3,845 hits from 16,007 executions (24.0%), with 121/187 grouped runs at 0% and 93.6% of all misses inside those all-miss groups (`goals/speed-loop/research/o2-turbo-cache-keys.md:3-36`). That pattern points primarily to force/cold/absent backend, not small input differences.

Concrete fragmentation and correctness inputs:

- Every task hashes `.bun-version`, `.nvmrc`, root `package.json`, and three root TS configs (`turbo.json:8-18`). Root manifest and aggregate TS config churn invalidates every package task. The existing audit found root `package.json` changed in 131/863 commits, root `tsconfig.json` in 95/863, `tsconfig.packages.json` in 45/863, and `bun.lock` in 198/863 (`goals/speed-loop/research/o2-turbo-cache-keys.md:59-79`).
- Build and audit hash `$TURBO_ROOT$/.env*` (`turbo.json:34-39`, `turbo.json:187-197`). Therefore differing ignored `.env` files across `../beep-effect*` clones generate different build/audit keys even when code and declared output-affecting values are equivalent. The glob also hashes `.env.example` and any `.envrc`.
- UI story globs are injected into every package's lint/check/audit key (`turbo.json:68-79`, `turbo.json:91-103`, `turbo.json:187-197`). One story edit invalidates unrelated packages.
- `BEEP_ESLINT_PROFILE` and `VITE_COSMOS_SPIKE` are globally hashed for every task (`turbo.json:18`). Build/audit hash broad secret/public environment families (`turbo.json:39-52`, `turbo.json:198-214`), so CI and local build keys legitimately diverge when those values differ. `audit` additionally hashes `CI`, intentionally splitting local/hosted results (`turbo.json:198-214`). Cache credentials are pass-through and correctly do not affect task hashes (`turbo.json:19-31`).
- Turbo/dependency state is fixed by `bun.lock`, while runtime selectors are pinned at Bun 1.3.14 and Node 24 (`package.json:340`, `.bun-version:1`, `.nvmrc:1`). Clones at different commits or with lockfile drift cannot share dependency-sensitive hashes; agents bypassing the pins create an unmeasured correctness risk even where hashes happen to coincide. Yeet intentionally forces all dependency-sensitive proof steps with `TURBO_FORCE=true` when `bun.lock` differs from base (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:1234-1247`). Those runs cannot benefit from reads; this is a deliberate false-green control.
- There are no absolute checkout paths in configured Turbo inputs. However build/check/audit cache and restore `.tsbuildinfo` files (`turbo.json:53-65`, `turbo.json:98-102`, `turbo.json:215-227`). Cross-root restore therefore needs an explicit portability probe; setup-bun already documents a real absolute-home-path poisoning failure in a different cache (`.github/actions/setup-monorepo-ci/action.yml:26-35`). Do not assume incremental compiler artifacts are portable just because task hashes match.
- The current test key includes `vitest.shared.ts` but omits `vitest.setup.ts`, even though the setup can change test behavior (`turbo.json:104-114`). That is a stale-hit hazard, not desirable hit-rate optimization. The existing audit calls it out directly (`goals/speed-loop/research/o2-turbo-cache-keys.md:141-147`).

### 5. Measurement exists per run, but it is not yet an operational cache SLO

CI already invokes Turbo with `--summarize` and appends the newest `.turbo/runs/*.json` summary (`.github/workflows/check.yml:220-228`, `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts:156-180`). The renderer reports attempted tasks, local hits, remote hits, misses, disabled tasks, duration, and the five slowest tasks (`packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts:201-240`). This is enough for an individual run, but no workflow uploads all raw summaries or aggregates hit rates by SHA/lane/cache mode over time. Setup's “Turbo cache hit” field refers to the GitHub Actions fallback restore, not remote Turbo task hits (`.github/actions/setup-monorepo-ci/action.yml:101-130`). Conflating those two metrics will report false success.

Lambda-side logs can show request volume, 401/403/404/5xx, throttling, latency, and oversized upload failures, but not a task hit rate by themselves: HEAD/GET/PUT requests must be correlated with Turbo summaries. The design already requires cold/warm pairs and recording hit rate, bytes, wall time, Lambda errors, 403s, and cost (`goals/ci-fleet-endgame/research/p3-cache-design.md:256-274`); that rollout measurement was not productized.

## Ranked recommendations

### 1. Make local remote-read configuration a first-class CLI contract

**Exact per-checkout template (names only):**

```dotenv
TURBO_API=
TURBO_TOKEN=
TURBO_TEAM=
TURBO_CACHE=local:rw,remote:r
```

Store `TURBO_TOKEN` as a 1Password secret reference to the AWS **read-only** token; keep `TURBO_API` and `TURBO_TEAM` identical across all `../beep-effect*` checkouts. If client artifact signing is later enabled, add `TURBO_REMOTE_CACHE_SIGNATURE_KEY` as another 1Password reference and `remoteCache.signature: true` together in one rollout. Do not distribute the trusted write token to agent clones.

Then change the quality-task launcher so every Turbo step opts into the existing `op run --env-file=.env` path, and make `localTurboCacheArgs` honor a complete remote-read configuration instead of unconditionally injecting `--cache=local:rw`. Fail closed to local-only if any of `TURBO_API`, `TURBO_TOKEN`, or `TURBO_TEAM` is absent/unresolved. Add a read-only status/known-artifact preflight that never attempts PUT. Also add all four names and comments to `.env.example` plus one operator doc.

- **Impact:** Very high. This is the gating change for every local clone and for Yeet; without it, AWS warming cannot shorten local verification.
- **Effort:** Medium (CLI policy, tests, template/doc, sanitized preflight).
- **Risk:** Medium. The chief risks are accidentally handing agents the write token or resolving 1Password references inconsistently. Enforce `remote:r` client-side and retain the server's PUT denial.

### 2. Restore remote reads for same-repo PRs, or deliberately fund a writable fallback

The deployed architecture was built to permit untrusted reads safely. Re-enable #674's same-repo PR `TURBO_API` + read token + `local:rw,remote:r`, while keeping fork PRs local-only. If the security decision behind #696 is immovable, set `cache-write: true` on a trusted, post-main fallback seed job and use a branch/SHA-safe Actions-cache key; current PR restore-only fallback decays without a producer.

- **Impact:** Very high. Removes repeated cold computation on the slowest feedback path and makes main warming useful to PRs.
- **Effort:** Low for same-repo remote reads; medium for a correct Actions-cache seed design.
- **Risk:** Medium. Read-token leakage permits download/cost abuse but not writes; preserve throttles, rotation, fork isolation, and the server token/method matrix. Do not use `pull_request_target`.

### 3. Treat existing main-push Check as the canonical warmer; do not start with a workstation nightly writer

Main already runs full graphs after every merge with trusted `remote:rw`. First verify that those jobs actually produce PUTs and later remote hits. Add a small dedicated `cache-warm` workflow only for recovery after cache purge/global-key migrations, or if measurements show long quiet periods defeat the 30-day lifecycle. Run it in `turbo-cache-write`, on ephemeral infrastructure, pinned to `main`, with `--summarize`; never on PR code.

A local `beep cache warm` on the 9970X is technically attractive for a purge/backfill because it can populate a full graph quickly, but a nightly workstation writer is not worth the credential expansion or duplicate compute while every merge already warms main. If implemented, require explicit operator authorization, a clean exact `origin/main` checkout, pinned Bun/Node/lockfile, no dirty `.env`-fragmented inputs, and an isolated ephemeral environment. Default local agents remain read-only.

Expected Yeet effect: remote cache can make a fresh clone or evicted `.turbo` approach the repository's already-observed warm-local regime, but it will not eliminate uncached policy work or lockfile-forced proofs. The repository reports warm local verify still taking 9–17 minutes (`goals/speed-loop/research/o2-turbo-cache-keys.md:428-438`); the historical input-tightening estimate is only +3–8 hit-rate points and usually under a minute, occasionally 1–3 minutes (`goals/speed-loop/research/o2-turbo-cache-keys.md:348-374`). Measure on this workstation rather than promising a fixed saving.

- **Impact:** High for fresh clones/caches; low incremental value for already-warm main.
- **Effort:** Low to validate existing warming; medium for a recovery workflow/command.
- **Risk:** High for a persistent local write token; low for a main-only ephemeral workflow.

### 4. Establish a remote-cache dashboard and acceptance test before tuning keys

Upload every raw `.turbo/runs/*.json` as a short-retention artifact and ingest: head SHA, base SHA, workflow/job/attempt, runner class, Turbo/Bun/Node versions, `TURBO_CACHE` mode, whether `TURBO_FORCE`/`--force` was present, task family/hash/status/local/remote/duration, bytes restored if available, and wall time. Report separately:

- eligible remote hits / eligible tasks;
- local hits / eligible tasks;
- forced and cache-disabled tasks (excluded from denominator);
- cold zero-hit runs;
- p50/p95 lane wall time by runner and cache mode.

Correlate that with API Gateway/Lambda CloudWatch counts for HEAD/GET hit/miss, PUT success/413/5xx, 401/403, throttles, duration, and bytes. Acceptance should include an exact-main cold run, immediate second run, a fresh second checkout read, a read-token PUT-denial probe, and deletion/restoration of declared outputs. The existing summary renderer is the right starting point but its one-latest-file behavior is insufficient for multi-step jobs (`packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts:267-291`).

- **Impact:** High. Separates key misses from force, missing credentials, cache outages, and oversized Lambda artifacts.
- **Effort:** Medium.
- **Risk:** Low if logs never contain tokens or secret-bearing env values.

### 5. Fix correctness holes before narrowing inputs; then reduce proven global invalidators

First add `vitest.setup.ts` (and the root alias config where actually consumed) to test-family inputs, and run cold/warm output-restoration probes. Preserve Yeet's lockfile-triggered `TURBO_FORCE=true`; the repo has already observed cached plain commands masking dependency failures (`goals/yeet-agent-ergonomics/research/session-findings.md:21-23`). Consider artifact signing only as defense in depth: it proves artifacts came from a signing-key holder, not that the task key included every semantic input.

After correctness probes pass, stop hashing per-clone `.env*` globally; declare only output-affecting env on the packages/tasks that consume it. Localize UI story globs, `BEEP_ESLINT_PROFILE`, and Vite env to their real consumers; remove unnecessary root manifest/aggregate config inputs only with deliberate before/after hash probes. Standardize all clones on the checked-in Bun/Node versions and exact `bun.lock`.

- **Impact:** Medium-high hit-rate improvement with substantially lower false-green risk.
- **Effort:** Medium-high because each removal needs invalidation and restoration proofs.
- **Risk:** High if done as a broad cleanup. A stale remote artifact amplifies a missing-input bug to every checkout, so treat any unexplained green replay as a failure, not a speed win.
