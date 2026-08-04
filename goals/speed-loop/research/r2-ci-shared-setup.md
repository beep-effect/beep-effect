# CI shared-setup efficiency: follow-up PR planning

## Executive answer

`check.yml` has **20 pull-request job contexts**: one 9-entry `verify` matrix plus
11 standalone jobs. Seventeen of those contexts run the shared monorepo setup;
`PR Size Label`, `Secret Scanning`, and `Security` do not. `Build` is a 21st
context, but is push-only. The matrix definition and runner sizes are at
`.github/workflows/check.yml:46-107`; the standalone jobs occupy
`.github/workflows/check.yml:247-842`.

The checked-in timing TSV has job wall time only, not step time
(`goals/quality-speedup/research/data/ci-lane-timings.tsv:1`). Therefore the
setup/check split below is an estimate, not a measurement. A representative
successful docs PR shows a 7 s platform/action floor, then setup-bearing small
lanes at 69-92 s: Commitlint 72 s, Codegen 82 s, Nix 69 s, Repo Sanity 92 s,
and Knip 69 s (`goals/quality-speedup/research/data/ci-lane-timings.tsv:1918-1930`).
I use **60 s as the midpoint pre-check setup floor** (roughly 7 s job overhead
plus checkout/fetch/runtime/cache/install, and matrix disk cleanup). This is
consistent with the minimum successful setup-bearing lane totals of 63-71 s,
but must be replaced by the composite's newly emitted timing once enough runs
exist. The composite already records total setup and install seconds in the job
summary (`.github/actions/setup-monorepo-ci/action.yml:83-125`); the TSV collector
does not ingest them.

On that basis, a normal PR repeats about **15-17 runner-minutes of pre-check
setup** (17 setup-bearing contexts x about 60 s, less path-gated skips). This is
total runner consumption, not critical-path latency: the jobs start in parallel,
and observed queue p50 is only 8-9 s
(`goals/quality-speedup/research/quality-time-inventory.md:56-76`). Eliminating
all repeated setup cannot save 17 minutes of PR makespan; it can save that much
compute/cost, while makespan improves only where setup is removed from the
slowest lane(s).

## 1. Current pipeline map

### Shared mechanics

Every `verify` matrix entry checks out full history, fetches the PR base,
computes the docgen gate, deletes large runner-image stacks, then invokes the
composite; Lint and Lint Policy additionally install `typos`
(`.github/workflows/check.yml:123-193`). The lane command is selected by matrix
id; the five Turbo-shaped lanes receive `--affected`, `--base`, and
`--summarize` on PRs (`.github/workflows/check.yml:195-237`).

The composite always:

1. sets up Bun and, unless disabled, Node
   (`.github/actions/setup-monorepo-ci/action.yml:21-35`);
2. restores Bun's **download cache**, `~/.bun/install/cache`, under
   `bun-${runner.os}-${hashFiles('bun.lock')}`
   (`.github/actions/setup-monorepo-ci/action.yml:37-44`);
3. optionally restores `.turbo/cache` when remote-cache credentials are absent
   (`.github/actions/setup-monorepo-ci/action.yml:46-56`);
4. always runs `bun install --frozen-lockfile`; it does not cache `node_modules`
   (`.github/actions/setup-monorepo-ci/action.yml:58-65`); and
5. optionally saves the two caches (`.github/actions/setup-monorepo-ci/action.yml:67-81`).

There is **no explicit Blacksmith cache action/configuration** in `.github`;
Blacksmith appears here as the runner provider. The repo uses GitHub's
`actions/cache` interface. Any transparent provider acceleration is outside
the checked-in contract and is not evidenced here.

### Cache behavior today

- PR verification deliberately gets empty `TURBO_TOKEN`/`TURBO_TEAM` and
  `TURBO_CACHE=local:rw`; secret-backed remote caching is trusted-push only
  (`.github/workflows/check.yml:108-123`). This is the correct security posture
  for PR-controlled code.
- All PR callers pass `cache-write: "false"`; examples are the matrix
  (`.github/workflows/check.yml:182-187`), Property Laws
  (`.github/workflows/check.yml:336-340`), and the standalone small lanes
  (`.github/workflows/check.yml:498-525`). Thus parallel PR jobs can restore a
  pre-existing cache, but cannot populate a cache for one another.
- The Turbo fallback key includes `${github.job}`
  (`.github/actions/setup-monorepo-ci/action.yml:52-56`). All matrix children
  have the same job id, `verify`, so they address the same pre-existing archive;
  they still cannot exchange results during the concurrent run. Exact-key saves
  occur only when `cache-write` is true and remote credentials are absent
  (`.github/actions/setup-monorepo-ci/action.yml:75-81`). In the normal trusted
  push configuration, remote credentials make the local fallback ineligible.
- The Bun download cache is useful and correctly lockfile-keyed, but every job
  still performs dependency linking and lifecycle work. Push-only Build enables
  writes (`.github/workflows/check.yml:541-570`), so it can refresh the Bun cache.
- Turbo's `build`, `lint`, `check`, and ordinary `test` tasks are cacheable;
  `test:integration` and `coverage` explicitly are not, although both depend on
  cacheable `^build` tasks (`turbo.json:33-68`, `turbo.json:69-115`,
  `turbo.json:125-155`). `codegen` is also uncached (`turbo.json:157-160`).
- Only the aggregate **audit** path injects `--force` in CI
  (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:498-504`,
  `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1416-1421`). The
  `check.yml` matrix lanes do not globally force Turbo. Fallow's audit command
  is a separate Fallow subprocess, not the Turbo `audit` task.

### Jobs and estimated split

The wall p50 values below are success-only PR medians computed across the TSV's
1,932 observations (`goals/quality-speedup/research/data/ci-lane-timings.tsv:2-1933`).
The inventory's independently published hosted table confirms the same broad
ordering and records the longer-lived cohort at
`goals/quality-speedup/research/quality-time-inventory.md:54-71`. “Setup” uses
the 60 s floor above; “body” is `max(wall - 60, 0)`. Fractions are deliberately
rounded because the source has no step split.

| PR context | Current body/mechanics | Wall p50 | Estimated setup / body | Setup share |
| --- | --- | ---: | ---: | ---: |
| PR Size Label | GitHub API script only; no checkout/monorepo setup (`check.yml:18-45`) | 7 s | about 7 s platform+action / inseparable API body | n/a |
| Lint | Turbo `lint`, affected; 8-vCPU; installs typos (`check.yml:54-59`) | 319 s | about 60 / 259 s | about 19% |
| Lint Policy | repo policy tools; 8-vCPU; installs typos (`check.yml:60-65`) | 589 s | about 60 / 529 s | about 10% |
| Repo Sanity | repo-sanity + PR changeset status (`check.yml:66-71`, `check.yml:219-224`) | 94 s | about 60 / 34 s | about 64% |
| Check | Turbo `check`, affected; 8-vCPU (`check.yml:72-77`) | 396 s | about 60 / 336 s | about 15% |
| Test Unit | Turbo `test`, unit selection, affected (`check.yml:78-83`) | 626 s | about 60 / 566 s | about 10% |
| Test Integration | Turbo integration selection, affected (`check.yml:84-89`) | 165 s | about 60 / 105 s | about 36% |
| Coverage Regression | Turbo coverage, affected (`check.yml:90-95`) | 177 s | about 60 / 117 s | about 34% |
| Docgen | workflow path gate; affected/full mode (`check.yml:96-101`, `check.yml:143-159`) | 373 s | about 60 / 313 s when run; about 10 s total when skipped | about 16% when run |
| Codegen Drift | eCFR generation+diff and desktop migration check (`CiLane.ts:770-799`) | 76 s | about 60 / 16 s | about 79% |
| Professional Desktop IPC Stdio | path gate, Rust setup, shared setup, IPC proof (`check.yml:247-306`) | 55 s mixed | skipped path about 10 s; executing path is approximately the setup floor plus proof | not stable |
| Property Laws | affected Turbo property tests, 400 runs (`check.yml:308-358`) | 523 s | about 60 / 463 s | about 11% |
| Fallow Advisory Envelopes | disk cleanup, shared setup, seven Fallow lanes, validation/upload (`check.yml:360-484`) | 87 s | about 60 / 27 s | about 69% |
| Knip | shared setup without Node, then Knip (`check.yml:486-506`) | 69 s | about 60 / 9 s | about 87% |
| JSDoc Ratchet | shared setup without Node, inventory+ratchet (`check.yml:508-539`) | 289 s | about 60 / 229 s | about 21% |
| Commitlint | checkout/range, setup without Node, commitlint (`check.yml:576-631`) | 71 s | about 60 / 11 s | about 85% |
| Secret Scanning | checkout/fetch + pinned gitleaks container; **no shared setup** (`check.yml:633-687`) | 35 s | no monorepo setup; checkout/container/scan inseparable | 0% shared setup |
| Security | checkout + OSV + conditional dependency review; **no shared setup** (`check.yml:689-770`) | 44 s | no monorepo setup; action/check body inseparable | 0% shared setup |
| Nix Shell | shared setup, Nix/Cachix setup, two Nix checks (`check.yml:772-807`) | 70 s | about 60 / 10 s | about 86% |
| SAST | checkout/fetch, shared setup, Semgrep lane (`check.yml:809-842`) | 81 s | about 60 / 21 s | about 74% |
| Build (push only) | full Turbo build, remote cache enabled (`check.yml:541-574`) | 98 s published p50 | about 60 / 38 s | about 61% |

The p50s above are distribution summaries over heterogeneous change sets. In
particular, affected/path-gated lanes can be near-floor on docs-only PRs and
hundreds of seconds on source PRs. They are suitable for planning bounds, not
an assertion that a specific tool body always takes the residual shown.

### What is actually duplicated across Turbo jobs?

The CI lane adapter maps Check to the root `check` task, Test Unit to `test`,
Test Integration to `test:integration`, and Coverage to `coverage`
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:765-818`,
`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:886-887`). Turbo caches by
task hash, so similarly expensive compiler/test activity under different task
names is **not** cross-task reusable. In particular:

- Check and Test Unit do not both declare a Turbo `build` dependency. They run
  distinct `check` and `test` graphs. A shared build artifact does not eliminate
  their main work.
- Test Integration and Coverage both declare `dependsOn: ["^build"]`; their
  upstream build tasks can be reused, but their own task bodies are deliberately
  uncached (`turbo.json:125-155`). Today they run in separate concurrent jobs
  with isolated local caches, so both can repeat identical `^build` work.
- A trusted base cache can eliminate unchanged package tasks within Lint,
  Check, Test Unit, and the `^build` portions above. It cannot make `lint` satisfy
  `check`, or `check` satisfy `test`.

## 2. Ranked options

Savings are estimated **per PR run**. “Runner” means summed job execution;
“makespan” means elapsed time to all gates. Ranges reflect the missing hosted
step/cache-hit telemetry, which the existing inventory explicitly calls out
(`goals/quality-speedup/research/quality-time-inventory.md:27-35`).

### 1. Consolidate the four smallest CLI-only gates, while preserving status contexts

**Candidate:** Repo Sanity + Codegen Drift + Knip + Commitlint in one 4-vCPU job.
Run one checkout/setup, execute all four bodies with failure collection, and
emit machine-readable outcomes. Their present medians total about 310 runner-s;
one setup plus their estimated bodies is about 130 s: **about 180 s (3 min)
runner savings per PR**. Adding four no-setup status-proxy jobs costs roughly
4 x the 7 s platform floor, leaving **about 2.5 min net**. The aggregate should
finish in about 2-2.5 min, still well below the current 10+ minute critical
lanes, so expected makespan impact is negligible.

Implementation sketch:

- add a `small-gates` job with checkout, base-range computation, one composite
  setup (`use-node: false`), and a CLI command that runs all bodies without
  fail-fast and writes one output per lane;
- retain jobs named `Repo Sanity`, `Codegen Drift`, `Knip`, and `Commitlint` as
  tiny `needs: small-gates` proxies that fail from the corresponding output; or
- if ruleset administration is acceptable, require `Small Gates` instead and
  delete the four old jobs.

Risks: proxy correctness must fail closed when the aggregate is cancelled or
never produces outputs; GitHub job outputs have size/lifecycle constraints;
sequential bodies trade some parallel runner time for about 30-40 s longer
completion of this non-critical cluster. Do not fold Security/Secret Scanning
into it: their least-privilege and base-pinned trust boundaries are different.

**Ruleset:** proxy form preserves names and needs no edit. A real merge/rename
needs a ruleset edit.

### 2. Publish a trusted-base Turbo cache that PR jobs may only read

Current push jobs can use the remote cache, but PR jobs intentionally cannot
receive its credentials; the local fallback is restore-only in PRs and is not
normally saved on credentialed pushes. Add a trusted `push`-event export of
`.turbo/cache` to `actions/cache`, with lane/task-family + OS + lock/config hash
and base SHA in the key. PR jobs restore from the target branch/base cache and
remain `cache-write: false`. Alternatively use a cache service that supports
OIDC and enforce read-only access for untrusted PRs; do not expose a bearer
`TURBO_TOKEN` to PR-controlled commands.

Expected saving: **2-8 runner-minutes and roughly 1-4 makespan minutes** on PRs
where many affected dependents are unchanged from the base; near zero on broad
lockfile/config changes. The local fleet observed only 12-30% hit rates on
repeated tasks, while hosted hit rates are presently unmeasured
(`goals/quality-speedup/research/quality-time-inventory.md:95-101`,
`goals/quality-speedup/research/quality-time-inventory.md:134-143`), so this
range must be validated over 20 runs.

Mechanics:

- save separate cache archives per task family on trusted push to avoid
  simultaneous exact-key collisions;
- key with OS, Turbo version/config, `bun.lock`, and base commit; restore only
  compatible prefixes;
- keep Coverage and Integration bodies uncached, but allow their `^build`
  dependencies to hit; and
- record Turbo cache-hit counts from each `--summarize` file, not merely job
  wall time.

Risks: cache poisoning if PRs can write to a namespace later trusted by main;
stale/incorrect hits if task inputs or environment variables are incomplete;
archive size and upload time; remote-cache service cost. Turbo already declares
important global inputs/env (`turbo.json:8-31`), but this deserves a hash audit.

**Ruleset:** no edit; job context names remain unchanged.

### 3. Replace per-job `bun install` with a lockfile-keyed installed-tree artifact or runner image

The existing Bun cache avoids downloads but not the repeated installation/link
step. Two concrete variants:

1. trusted, immutable `node_modules` cache/artifact keyed by runner image,
   `.bun-version`, `bun.lock`, root package metadata, and architecture; each job
   restores it and verifies the key instead of running install; or
2. a Blacksmith runner image/snapshot preloaded with the exact lockfile install,
   if the provider offers an immutable image primitive. No such primitive is
   configured in this repository today.

If restore takes 15-30 s instead of the estimated 45-55 s runtime/cache/install
portion, the gross saving is **about 8-12 runner-minutes per PR** across 17
jobs. Makespan saving is only **about 0.5 min**, because setup is parallel.

Risks are high: `node_modules` is large; artifact compression/download can cost
as much as `bun install`; native binaries must match the image; lifecycle hooks
(`postinstall` and `prepare`) are part of the root install contract
(`package.json:421-422`); a cache key omission creates hard-to-debug stale
installs. Benchmark artifact bytes and restore time before adopting. A single
producer job with `needs` is not automatically better: it adds a roughly
60-second serial prerequisite before every check. Prefer a cache/image already
available at job start.

**Ruleset:** no edit if job names remain. Adding a non-required cache-primer job
also needs no edit.

### 4. Prime build outputs once, then restore into Integration and Coverage

Add a PR `build-prime` job that runs affected `turbo run build`, uploads either
declared build outputs or (preferably) the content-addressed `.turbo/cache`, and
make Test Integration and Coverage depend on it. Both then restore the cache
before running. Turbo's build outputs are explicitly declared
(`turbo.json:34-67`), so `.turbo/cache` preserves Turbo's own mapping and is
less brittle than hand-listing `dist`, `.next`, and other directories.

Gross saving is only the duplicated `^build` portion: approximately **40-80
runner-seconds per PR** using the push Build residual as a loose upper bound.
The producer itself costs about one setup floor plus build and artifact transfer,
so this is likely **net neutral or negative** and can add 1-2 minutes to both
dependent lanes. It becomes attractive only when combined with option 2 or 3,
so the same producer amortizes dependency provisioning and a trusted cache.

Risks: new serial dependency and single point of failure; environment-specific
build hashes/outputs; large artifacts; build outputs do not remove the distinct
Check or Test Unit work.

**Ruleset:** no edit if the existing required Test Integration/Coverage names
remain and `build-prime` is non-required. Replacing those contexts does require
an edit.

### 5. Keep the current Bun download cache, but fix cache observability before tuning keys

The `bun.lock` key already answers the narrow “Bun install cache keyed on
`bun.lock`” proposal. Do not add another package-download cache. Instead, extend
the timing collector to capture checkout, cleanup, composite total, Bun install,
cache restore, and lane-body durations plus Bun/Turbo hit metadata. The composite
already produces most of this (`.github/actions/setup-monorepo-ci/action.yml:83-125`).

Savings: **zero directly**, but it turns every range above into a measured
before/after and detects cases where cache transfer is slower than warm install.
This should land in the same follow-up as the first optimization or one PR ahead.

**Ruleset:** no edit.

## 3. Required-check constraint

The repo-native CI descriptor currently marks exactly **17 distinct required
context names**: the nine matrix contexts
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:339-412`), Desktop IPC
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:413-420`), and Knip,
JSDoc Ratchet, Commitlint, Secret Scanning/Security, Nix, and SAST
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:432-513`). PR Size,
Fallow, push-only Build, and Property Laws are marked non-required
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:329-338`,
`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:422-456`,
`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:514-522`). This confirms the
low end of the remembered “17-24” range from live source; it does not query the
hosted ruleset.

Any option that removes, renames, or replaces one of those 17 contexts requires
an atomic ruleset edit. Cache changes, new non-required producer jobs, and
consolidation behind fail-closed proxy jobs preserve the names and do not.

## Recommended sequence

1. Land step-level timing/cache-hit collection and the four-lane small-gate
   consolidation with fail-closed proxy contexts: predictable about 2.5 min
   runner saving, low effect on critical path, no ruleset coordination.
2. Export trusted-push Turbo task-family caches for read-only PR restore; measure
   20 PR runs and retain only if p50 makespan improves by at least 60 s without
   increasing failure/cancellation rate.
3. Benchmark an installed-tree artifact on one non-critical lane. Promote it
   only if restore is at least 20 s faster than the measured composite install
   and artifact size/maintenance are acceptable.
4. Do not land a standalone build-prime dependency unless it is bundled with
   the dependency/cache producer and an end-to-end timing proves net positive.
