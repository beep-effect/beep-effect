# Opportunity 24: owned CI runners — workload, architecture, and security

## Executive recommendation

Pilot a **hybrid**, not an across-the-board migration: keep every fork-exposed
job on Blacksmith and send one duplicated, non-required `Coverage Regression`
job from trusted same-repository PR branches to an ephemeral 8-vCPU EC2 Spot
runner built from a lockfile-keyed AMI. Keep the required Blacksmith job during
the measurement period. This tests the largest 8-vCPU demand row and the whole
security/control plane without making a new runner a merge gate.

If the pilot passes, move trusted same-repository heavy lanes to owned EC2 while
fork PRs continue on managed runners. A pre-baked image and trusted-main,
read-only Turbo seed are parts of that design, not separate reasons to expose a
self-hosted worker to arbitrary fork code. Firecracker and the workstation are
second-phase tools for trusted workloads only.

This conclusion is deliberately narrower than “replace Blacksmith.” The repo is
public, and `pull_request` jobs execute PR-controlled code. The workflow already
withholds application and Turbo secrets on PRs
(`.github/workflows/check.yml:108-123`), but it also grants
`pull-requests: write` at workflow scope (`.github/workflows/check.yml:13-15`).
Before any PR code reaches an owned worker, that write grant must move to the
no-checkout `PR Size Label` job; owned compute does not make PR code trusted.

## 1. Committed demand curve

### Method and limits

The timing file contains 1,932 job rows and is the retained hosted-CI source
(`goals/quality-speedup/research/data/ci-lane-timings.tsv:1-1933`; provenance at
`goals/quality-speedup/research/quality-time-inventory.md:3-14`). Its 92 distinct
run IDs span 2026-08-01 06:11:39Z through 2026-08-04 03:44:55Z, or 2.898 days.
Thus the observed cadence is `92 / 2.898 * 7 = 222.2` workflow runs/week. This
is a short, unusually busy window and should be treated as a **burst demand
estimate**, not a long-term billing forecast.

For each lane below:

- `p50` is the upper median of successful, nonblank `duration_s` rows, matching
  the published success-only method
  (`goals/quality-speedup/research/quality-time-inventory.md:54-71`);
- allocations count non-skipped rows with positive duration, so the push-only
  Build and PR-only Size Label retain their actual event cadence;
- `runs/week = allocations / 2.898 * 7`; and
- `runner-min/week = p50 seconds * runs/week / 60`.

This requested p50 model is a capacity demand curve, not an invoice
reconstruction. It includes the cadence of canceled attempts but substitutes a
successful p50 for their partial duration. The source has job wall time but no
step split (`followup/r2-ci-shared-setup.md:12-24`).

### Per-lane demand

| Lane | Current runner | p50 | Observed allocations | Runs/week | Runner-min/week |
| --- | ---: | ---: | ---: | ---: | ---: |
| Coverage Regression | 8 vCPU | 692 s | 92 | 222.2 | 2,562.9 |
| Test Unit | 4 vCPU | 635 s | 92 | 222.2 | 2,351.8 |
| Lint Policy | 8 vCPU | 588 s | 92 | 222.2 | 2,177.7 |
| Property Laws | 4 vCPU | 538 s | 92 | 222.2 | 1,992.5 |
| Docgen | 4 vCPU | 498 s | 92 | 222.2 | 1,844.4 |
| Check | 8 vCPU | 429 s | 92 | 222.2 | 1,588.8 |
| Lint | 8 vCPU | 327 s | 92 | 222.2 | 1,211.1 |
| JSDoc Ratchet | 4 vCPU | 289 s | 92 | 222.2 | 1,070.3 |
| Test Integration | 8 vCPU | 277 s | 92 | 222.2 | 1,025.9 |
| Repo Sanity | 4 vCPU | 93 s | 92 | 222.2 | 344.4 |
| Fallow Advisory Envelopes | 4 vCPU | 87 s | 92 | 222.2 | 322.2 |
| SAST | 2 vCPU | 80 s | 92 | 222.2 | 296.3 |
| Codegen Drift | 4 vCPU | 76 s | 92 | 222.2 | 281.5 |
| Commitlint | 2 vCPU | 71 s | 92 | 222.2 | 263.0 |
| Nix Shell | 2 vCPU | 70 s | 92 | 222.2 | 259.3 |
| Knip | 4 vCPU | 69 s | 92 | 222.2 | 255.5 |
| Professional Desktop IPC Stdio | 4 vCPU | 55 s | 92 | 222.2 | 203.7 |
| Security | 2 vCPU | 44 s | 92 | 222.2 | 163.0 |
| Secret Scanning | 2 vCPU | 35 s | 92 | 222.2 | 129.6 |
| Build (push only) | 4 vCPU | 98 s | 14 | 33.8 | 55.2 |
| PR Size Label (PR only) | 2 vCPU | 7 s | 78 | 188.4 | 22.0 |

Runner-size evidence: the nine-entry matrix assigns Lint, Lint Policy, Check,
Integration, and Coverage to 8-vCPU runners and the other four entries to
4-vCPU (`.github/workflows/check.yml:46-107`). Standalone 4-vCPU jobs are at
`.github/workflows/check.yml:247-249,313-314,361-362,487-488,509-510,542-545`;
standalone 2-vCPU jobs are at
`.github/workflows/check.yml:18-22,576-578,633-635,689-691,772-774,809-811`.

| Size class | Runner-min/week | Runner-hours/week | Share |
| --- | ---: | ---: | ---: |
| 2 vCPU | 1,133.1 | 18.9 | 6.2% |
| 4 vCPU | 8,721.6 | 145.4 | 47.3% |
| 8 vCPU | 8,566.4 | 142.8 | 46.5% |
| **Total** | **18,421.0** | **307.0** | **100%** |

The fleet therefore needs burst concurrency more than queue optimization: all
normal lanes fan out together, while hosted queue p50 is only 8–9 seconds
(`goals/quality-speedup/research/quality-time-inventory.md:73-76`). A single
workstation can absorb a selected lane, but replacing the fan-out with one
machine would turn parallel work into a queue.

## 2. Architecture options and rough economics

All prices in this section are **estimate — verify current pricing**. They are
training-knowledge planning figures, not live AWS, RunsOn, GitHub, or
Blacksmith quotes. Region, architecture, interruption rate, storage, data
transfer, discounts, and controller fees can materially change them.

### Ranked recommendation

#### 1. Hybrid: managed fork lanes, ephemeral EC2 Spot for trusted heavy lanes

**Mechanics.** The base-branch workflow chooses the managed label for fork PRs
and the owned label only when
`github.event.pull_request.head.repo.full_name == github.repository` (and,
preferably, an explicit trusted-actor policy). A webhook/Lambda controller or a
hosted control plane launches one immutable VM per queued job, obtains a
short-lived JIT runner configuration, registers it with `--ephemeral`, and
terminates the VM after exactly one job. Candidate implementations are
`ec2-github-runner`-class Lambda/EC2 orchestration or RunsOn-class AWS-account
orchestration. ARC runner scale sets provide similar ephemeral semantics but
introduce Kubernetes/EKS, which is unjustified for this initial demand.

Use memory-oriented instances for type-heavy lanes rather than mapping vCPU
alone. The census found individual check programs around 9 GB peak RSS, and the
repo already attributed whole-runner losses to 4-vCPU Blacksmith capacity
(`goals/quality-speedup/research/SOURCES.md:36-53`). Start 8-vCPU lanes at 32 GB
RAM and record peak RSS before right-sizing.

**Cost model.** Illustrative Spot rates are $0.035/hour (2 vCPU), $0.07/hour
(4 vCPU), and $0.14/hour (8 vCPU), **estimate — verify current pricing**. Applied
to the p50 demand curve, compute is about `$0.66 + $10.18 + $19.99 =
$30.83/week`. Add roughly $5–15/week for controller minimums, EBS snapshot/root
volume time, logs, S3, failed boots, and Spot interruption waste, **estimate —
verify current pricing**: approximately $36–46/week at this burst cadence.
Illustrative on-demand equivalents ($0.115/$0.23/$0.46 per hour) would be about
$101/week before overhead, **estimate — verify current pricing**, so Spot and
scale-to-zero are essential to the cost case. Compare the pilot's measured
fully loaded dollars/job against the invoice; do not accept a percentage claim
derived from list prices.

**Ops burden.** Medium-high: GitHub App/webhook availability, JIT token
lifecycle, AMI patching, Spot capacity diversification, retry semantics, AWS
quotas, orphan termination, observability, and incident response. A
RunsOn-class service buys down control-plane work at an additional fee;
`ec2-github-runner`-class ownership costs less in subscription but leaves more
on-call surface. ARC is the highest burden unless an EKS platform already
exists.

#### 2. Pre-baked AMI/installed tree/trusted-main Turbo seed (modifier to #1)

**Mechanics.** Build and sign an AMI from trusted `main`, keyed by image digest,
architecture, `.bun-version`, `.nvmrc`, `bun.lock`, package metadata, and
toolchain versions. It contains Bun/Node/system dependencies and an immutable
installed `node_modules` layer. At job start, checkout the exact SHA; use the
installed layer only if its key matches, otherwise run the normal frozen
install. Seed a read-only `.turbo/cache` from trusted main. PR jobs may copy/read
that seed into their disposable filesystem but may never publish into a cache
namespace consumed by trusted jobs. The current composite caches Bun downloads
but still executes `bun install --frozen-lockfile` every time
(`.github/actions/setup-monorepo-ci/action.yml:37-65`), so an installed tree is
a genuinely different primitive.

**Setup-floor erasure.** The r2 study estimates a 60-second setup floor and
15–17 setup runner-minutes per ordinary PR across 17 setup-bearing contexts
(`followup/r2-ci-shared-setup.md:18-33`). If boot plus key verification reduces
that floor to 5–15 seconds, **estimate**, the saving is 45–55 seconds/job:

- all 17 contexts: 12.75–15.6 runner-minutes/run, or about 47–58
  runner-hours/week at the observed cadence;
- the nine heavy/setup-bearing rows above (five 8-vCPU plus Test Unit, Property
  Laws, Docgen, and JSDoc): 6.75–8.25 runner-minutes/run, or about 25–31
  runner-hours/week; and
- makespan improves by only 45–55 seconds where the critical lane uses the
  image, because jobs run concurrently. This is primarily compute/cost removal,
  not a 15-minute user-visible acceleration.

The alternative installed-tree artifact was estimated to save 8–12
runner-minutes/PR but has compression, native-binary, and lifecycle-hook risks
(`followup/r2-ci-shared-setup.md:228-251`). An AMI/EBS snapshot makes the bytes
available before dispatch and avoids adding a serial producer job.

**Cost/ops.** AMI snapshots and an S3 seed should be low single-digit dollars per
week at this scale, **estimate — verify current pricing**. The real cost is
image engineering: rebuild on lock/toolchain/base-image change; CVE patch SLA;
provenance/SBOM; canary and rollback; garbage collection; and proving that
native modules and lifecycle hooks exactly match the frozen install.

#### 3. Workstation runner for one trusted heavy label

**Mechanics.** Do not install a long-lived runner directly on the operator's
workstation. Run a controller on a dedicated management VM and dispatch each
job into a fresh KVM/libvirt VM cloned from a sealed template, with no host
mounts, no desktop session access, no SSH agent, no user home, and no tailnet or
LAN reachability. Register each guest as ephemeral and terminate it after one
job. Advertise a single specific label such as `owned-workstation-coverage`,
not a generic `self-hosted` pool, and cap concurrency until measured RSS proves
safe. The host has enough raw resources to test large lanes; the inventory
specifically notes the 64-thread/128-GB machine but requires both wall time and
peak RSS before parallelization
(`goals/quality-speedup/research/quality-time-inventory.md:147-157`).

**Cost model.** For Coverage alone, the p50 curve is 42.7 runner-hours/week. At
250–450 W under sustained load and $0.15/kWh, electricity is about $1.60–$2.90
per week, **estimate — verify current pricing**, plus depreciation and the much
larger cost of operator downtime. Its marginal cash cost is excellent; its
availability, residential power/network, single failure domain, and risk to a
valuable interactive workstation make it unsuitable as the sole required
runner.

**Ops burden.** High per unit of capacity: hypervisor and image patching,
network isolation, power/UPS, thermal management, host availability, cleanup,
and a managed-runner fallback. Restrict it to trusted same-repository PRs,
trusted pushes, scheduled experiments, or manual dispatches.

#### 4. Firecracker/warm-pool variants

**Mechanics.** Maintain pristine, pre-booted microVM snapshots containing the
toolchain and immutable dependency/cache layers. Dispatch resumes a clean clone,
injects only the one-job runner configuration, executes, exports logs, and
destroys the clone. Never snapshot a VM after it has run PR code. A simpler AWS
variant is an EC2 warm pool of stopped/hibernated instances or fast-launch AMIs;
it saves boot time without operating a microVM control plane. Firecracker is
most natural on the owned workstation or dedicated bare metal; nested
virtualization/host requirements make it a poor first EC2 experiment.

**Cost model.** Warm capacity trades latency for idle cost. One always-warm
8-vCPU instance at an illustrative $0.14 Spot/hour is $23.52/week even before
jobs, **estimate — verify current pricing**; on-demand is substantially more.
Pristine memory snapshots add storage but little marginal clone cost,
**estimate — verify current pricing**. The value is sub-second-to-seconds
dispatch and a possible further 5–15 second reduction beyond a fast AMI, not a
large reduction in check bodies.

**Ops burden.** Very high: snapshot compatibility across kernel/CPU updates,
network identity reset, entropy/clock correctness, guest-agent lifecycle,
microVM escape patching, and capacity scheduling. Pursue only after the plain
AMI pilot proves that boot/setup latency is still economically material.

#### 5. Full owned fleet for all public-PR lanes

This has the largest theoretical savings and the worst risk-adjusted value.
GitHub approval settings reduce accidental execution but are not a sufficient
sandbox, and a previously approved contributor or compromised account can
still submit hostile code. Even single-use VMs move network isolation, image
security, cache integrity, teardown, abuse response, and forensics onto the
operator. Keep this behind the hybrid option unless there is a separately
reviewed untrusted-code platform with no ambient credentials or reachable
assets.

## 3. Public-repository security design

### Required checklist

- [ ] **Fork routing is fail-closed.** Fork PRs and unknown trust states use
  managed runners. Only same-repository branches owned by trusted collaborators
  may select an owned label. The decision is in the trusted base workflow, not
  in PR-controlled files or labels.
- [ ] **Outside contributors require approval.** Configure the repository to
  require approval for every outside-contributor workflow run, not merely the
  contributor's first PR where the current GitHub plan supports it. Re-require
  approval after a head SHA changes. Treat approval as defense in depth, not as
  authorization to reach the owned fleet.
- [ ] **Dedicated runner group.** Allow only this repository and only the
  reviewed workflow path/ref to use the group where current GitHub runner-group
  policy supports workflow restrictions. Do not expose a default or
  organization-wide `self-hosted` label.
- [ ] **One job, one VM.** Use JIT/ephemeral registration; launch from a sealed
  image; terminate and verify destruction after the job, cancellation, timeout,
  lost-runner event, and Spot interruption. No post-job VM or memory snapshot is
  reused.
- [ ] **No ambient cloud identity on workers.** No instance profile, static AWS
  keys, GitHub App key, SSH key, Docker socket to a privileged host, or
  controller credentials. Block IMDS from the guest and isolate the controller
  plane.
- [ ] **OIDC is narrowly placed.** Do not grant `id-token: write` to a job that
  runs PR code. A separate trusted-push cache seeder may use GitHub OIDC with an
  AWS trust policy bound to repository, workflow, event/ref, and environment.
  Workers get, at most, a short-lived object-specific read URL or a read-only
  cache proxy; no generic S3 bearer credential.
- [ ] **Minimize `GITHUB_TOKEN`.** Heavy PR jobs declare `permissions:
  contents: read` explicitly. Move the current workflow-wide
  `pull-requests: write` permission (`.github/workflows/check.yml:13-15`) into
  `PR Size Label`, which calls the API but does not checkout or execute repo
  code (`.github/workflows/check.yml:18-45`). Use
  `persist-credentials: false` on owned-lane checkout.
- [ ] **Network is hostile-code grade.** Dedicated account/VPC/subnet; deny
  east-west, RFC1918, metadata, management plane, LAN, workstation host, and
  tailnet access. Permit only the minimum egress needed for GitHub and pinned
  dependency endpoints; log DNS/flow activity and rate-limit abuse.
- [ ] **Cache trust is directional.** Trusted main may publish; PR workers may
  read a content-addressed seed and write only to an untrusted, per-run
  namespace that is never restored by trusted jobs. Include image digest,
  lock/config, tool versions, environment inputs, and task inputs in keys. The
  current repo correctly denies remote-cache secrets to PR code
  (`.github/workflows/check.yml:108-123`).
- [ ] **Artifacts and logs are untrusted.** No automatic execution/rendering of
  runner-produced artifacts in privileged contexts. Retain immutable controller
  audit logs linking workflow/run/job/head SHA, image digest, instance ID,
  registration, and confirmed teardown.
- [ ] **Capacity and cleanup fail safe.** Per-repo concurrency and spend caps;
  watchdog termination; orphan sweeper; encrypted disposable volumes; no public
  inbound ports; patched base image; image signing/SBOM; incident kill switch
  that routes all jobs back to managed runners.
- [ ] **Red-team before gate promotion.** A test PR attempts metadata access,
  VPC/LAN access, cache writes, host persistence, credential discovery,
  privileged-container escape, and cancellation-time persistence. Every attempt
  must fail and every guest must disappear.

### Why `pull_request_target` is forbidden

`pull_request_target` runs the workflow from the trusted base-repository context
and can receive a write-capable token and secrets. Checking out the PR head—or
running any script/action influenced by it—then combines attacker-controlled
code with privileged context. It must not be used to “solve” fork approval,
cache writes, labels, or OIDC for owned runners. Keep code-executing checks on
`pull_request`; place privileged metadata-only automation in a separate job
that never checks out or evaluates PR-controlled content.

### What Blacksmith currently absorbs

The committed contract shows Blacksmith as the runner provider while cache
logic remains GitHub Actions based (`followup/r2-ci-shared-setup.md:59-62`). As
a managed ephemeral provider it currently absorbs, to varying provider-defined
degrees that are not evidenced in this repo: capacity acquisition, queue-to-VM
dispatch, runner registration/token lifecycle, base-image maintenance,
isolation and teardown, host/metadata hardening, autoscaler availability,
capacity failures, and fleet telemetry/support. With an owned fleet the
operator newly owns all of those, plus Spot diversification/interruption,
quotas, patch/CVE response, image provenance, VPC/egress design, orphan and
cost cleanup, cache poisoning boundaries, abuse complaints, forensics, and the
pager when required checks cannot start. Any savings target must price that
operational transfer, not only EC2 minutes.

## 4. Coupling map

| Related ledger item | What owned compute changes | Trust boundary / sequencing |
| --- | --- | --- |
| **#12 cross-clone/VPC S3 Turbo cache** | An S3-backed cache in the AWS account can use a gateway endpoint, content-addressed objects, lifecycle expiry, and cheap same-region reads. It also gives EC2 jobs and local clones one base-cache substrate. This could realize the earlier 2–8 runner-minute/PR estimate for a trusted-base cache (`followup/r2-ci-shared-setup.md:191-224`). | Trusted push/OIDC seeder writes `trusted/main/...`; PR workers receive read-only, object-scoped access and cannot mutate trusted keys. Do the Turbo input/env hash audit before trusting hits. Owned runners make #12 cheaper to operate, not automatically safe. |
| **#21 input-hash proof-carrying CI** | Stable image digests plus a proof service/object store let a lane key include code/input hash, workflow version, toolchain, runner image, and relevant environment. The controller can return a prior signed passing proof without provisioning a heavy worker, attacking rerun cost rather than merely speeding it up. #21's stated design is at `followup/OPPORTUNITIES.md:128-134`. | A privileged verifier/controller signs proofs outside the PR guest. Untrusted jobs may request/consume proofs but never sign or overwrite trusted proof records. Required contexts must still report an auditable success for the exact head/input hash. Pilot cache/image first; proof reuse is a separate PR. |
| **ADHD attestation model** | The controller can attest workflow/run/job/head SHA, immutable image digest, instance identity, and teardown. Owned hardware makes runner identity explicit. | The attestation key must never enter the job VM. Attestation proves what environment ran attacker code; it does not make the code or its outputs trusted. |
| **ADHD RAM-checkpoint idea** | Firecracker/KVM snapshots can preserve a pristine booted toolchain and cache state, making fast clones and controlled checkpoint experiments possible. This is the “un-trap” noted in opportunity 24 (`followup/OPPORTUNITIES.md:145-155`). | Only snapshot pre-job pristine state, or trusted non-PR workloads. Never resume post-PR memory: it can persist attacker code, tokens, network state, and poisoned caches. Treat RAM checkpointing as a later trusted-workload spike, not part of the EC2 pilot. |

## 5. Falsifiable pilot

### Carrier and scope

Create a standalone infrastructure spike/PR, tentatively
`ci/owned-runner-coverage-pilot`, under opportunity 24. Do not hide it inside a
Turbo-cache, input-hash, lane-consolidation, or current quality-speedup feature
PR: those change the work being measured and confound attribution. The spike
may consume the cache-key audit as a prerequisite, but #12 and #21 should remain
separate follow-ups.

Phase 0 is controller/image/security infrastructure only. Phase 1 adds a
**non-required shadow** job named `Coverage Regression (owned pilot)` for
trusted same-repository PRs. It runs the exact Coverage command and SHA in
parallel with the existing required Blacksmith `Coverage Regression`; forks do
not instantiate the shadow job. Coverage is the best first lane because it is
the largest 8-vCPU demand row (2,562.9 runner-minutes/week), has an 11.5-minute
p50, and its own body is deliberately uncached, so a result cannot be explained
away solely by a warm Turbo hit (the cacheability distinction is documented at
`followup/r2-ci-shared-setup.md:145-152`).

After 20 paired, same-SHA executions, publish raw per-run rows containing:
provider, run/job IDs, head SHA, image digest, instance type/market, queue,
provision, setup/install, lane-body, total wall, peak RSS, interruption/retry,
instance seconds, EBS/S3/controller allocation, result, and confirmed teardown.
Do not promote the owned job to a required context until the report passes all
criteria below.

### Success criteria

**Cost/run**

- Fully loaded owned cost (compute + boot/interruption waste + EBS + S3/logs +
  allocated controller fee) is at most **$0.06 per successful Coverage run,
  estimate — verify current pricing**, and the measured weekly projection is at
  least 30% below the comparable share of the current Blacksmith invoice.
- Cost is reported both per attempt and per successful completion; retries and
  orphan time cannot disappear from the denominator.

**Wall time and capacity**

- At least 20 paired same-SHA samples; compare medians and p95s, not one run.
- Owned total job wall p50 is no worse than Blacksmith p50 by more than 5%, and
  p95 is no worse by more than 10%.
- Provisioning/queue p50 <= 30 s and p95 <= 90 s; setup p50 <= 15 s, proving at
  least 45 s of the estimated 60 s setup floor was erased.
- Peak RSS fits with at least 25% headroom; first-attempt infrastructure success
  >= 95%; a Spot loss retries once on a fresh VM and never reuses state.

**Zero security regressions**

- Zero fork/unknown-trust jobs scheduled on the owned runner in controller and
  GitHub audit logs.
- Zero worker instance profiles/static credentials; metadata, private VPC/LAN,
  workstation/tailnet, controller, and trusted-cache write probes all fail.
- 100% of job/cancel/timeout/interruption guests are confirmed terminated within
  five minutes; the orphan sweeper test succeeds.
- PR job token is read-only, checkout credentials are not persisted, no
  `id-token: write` is present, and no post-job disk/RAM snapshot is reused.
- Existing required contexts and fork behavior remain unchanged throughout the
  shadow phase. Any violation fails the pilot regardless of cost or speed.

If these pass, Phase 2 changes only trusted same-repository Coverage to the
owned label while preserving managed fallback and the required context name.
Then expand one lane at a time in descending runner-minute demand, rechecking
RSS and cost. Fork-exposed lanes stay managed unless a later, separately
approved untrusted-code architecture demonstrates the same controls.
