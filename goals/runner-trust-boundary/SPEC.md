# Runner Trust Boundary Spec

## Objective

Keep the heavy pull-request lanes on EC2 and make their runner class
non-privileged. The finished boundary has no usable ambient instance-role
credentials during job execution, boots each job on a fresh ephemeral VM from
a sealed digest-verified AMI, and retains runner-group admission controls as
defense in depth.

## Ratified security posture

**DEFANG THE FLEET, KEEP PRS ON IT.** Two independent hosted-runner admissions
for a heavy lane ended in shutdown signals and in-flight tasks exiting 137.
Moving every PR lane back to hosted capacity is not an available remediation.
The primary boundary must therefore remove privilege from the runner class
that executes untrusted PR code. Admission gating may reduce exposure, but it
cannot substitute for a safe workload boundary.

The required runner class has all of these properties:

1. PR code may continue to run on the EC2 heavy fleet.
2. A job VM has no usable ambient application instance-role credentials.
3. Bootstrap and JIT registration do not leave a credential source that job
   code can recover through ordinary, sudo, root, or privileged-container
   execution.
4. The AMI and setup fast path verify the installed Bun binary and sealed cache
   by ownership, mode, and digest before reuse.
5. Every job receives a fresh VM, followed by runner deregistration and EC2
   teardown.
6. GitHub runner-group controls are owned outside PR-editable workflow content
   and are verified as a second boundary.

## Ownership

- `goals/runner-trust-boundary` owns runner trust-boundary security, transferred
  Codex IDs, external admission proof, workload-identity removal, and
  exact-ID dashboard closure.
- `goals/ci-fleet-endgame` keeps fleet performance and architecture ownership.
  It remains active and P6-gated; this packet does not absorb or close it.
- `goals/ci-fleet-residue` remains completed-retained. Its 2026-08-14 live Gate
  E and teardown run `31779611279` is the `P1` proof precedent, not current
  proof.

## Findings transfer

Codex IDs, not packet-local CSF ordinals or titles, define identity. The
ownership inventory has sixteen source-packet records that map to nine unique
Codex IDs: six open IDs, either transferred or held, and three historically
closed IDs. The table also records the completed 2026-08-13 CSF-002 recurrence.
That duplicate is outside the sixteen-record ownership count but keeps the
occurrence history exact against all three source ledgers. This packet does not
invent closure reasons for the three IDs absent from the six-open inventory.

| Source packet and CSF ordinal | Codex ID | Finding identity | Lane | Current dashboard state, 2026-08-24 |
| --- | --- | --- | --- | --- |
| `2026-08-10` CSF-001; `2026-08-13` CSF-001; `2026-08-24` CSF-001 | `08ee74d0eb18819187fd02f570b4d57c` | PR code now runs on self-hosted EC2 CI lanes | admission | Open; transferred |
| `2026-08-10` CSF-002; `2026-08-13` CSF-002 | `382c538bc3c8819195f83b4a36b002fb` | Non-ephemeral CI runners expose PR jobs to trusted push secrets | historical fleet lifecycle | Closed; absent from the exact six-open inventory |
| `2026-08-10` CSF-003; `2026-08-13` CSF-003; `2026-08-24` CSF-004 | `a3a281b2a3d881919fdcbf68ee2364f0` | PR code now runs on owned EC2 CI runners | admission | Open; transferred |
| `2026-08-10` CSF-004; `2026-08-13` CSF-004; `2026-08-24` CSF-005 | `c799c2269d748191997ff176ce4bfd48` | Shadow runner exposes AWS role creds to job code | workload identity | Open; transferred |
| `2026-08-13` CSF-005 | `ca9a4a0353e481919011a7d8380f5068` | CI runner IMDS firewall rollback exposes AWS role creds | historical workload identity | Closed; absent from the exact six-open inventory |
| `2026-08-13` CSF-006 | `e841bb5393c08191a74ff574c0108bd8` | PR code can steal EC2 runner IAM credentials | historical admission and identity | Closed; absent from the exact six-open inventory |
| `2026-08-13` CSF-008; `2026-08-24` CSF-006 | `33cd94a12d788191afbec1edc25c433f` | Red-team gate misses sudo IMDS credential path | workload identity | Open; transferred |
| `2026-08-24` CSF-003 | `9459410104b881919cd820b97c673b67` | Baked runner trusts mutable Bun binary | `P1` deployment proof | Open; held — closure-ready |
| `2026-08-24` CSF-009 | `d1f026deb21881919d853e63780734fe` | IMDS hook can silently remain unarmed | `P1` deployment proof | Open; held — closure-ready |

The exact open allowlist for this packet is the six IDs marked Open above.
`P1` owns the two held identities. `P2` through `P4` own the remaining four.

## Source hierarchy

1. The operator-ratified decisions dated 2026-08-24.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. The three source packets and their exact-ID triage ledgers.
4. `goals/ci-fleet-endgame`, `goals/ci-fleet-residue`, and
   `goals/ci-lane-economics` evidence named in `research/SOURCES.md`.
5. Current first-party GitHub and AWS documentation plus live organization and
   deployment facts captured during P0.
6. The 2026-08-24 operator ratification in `research/P0-GRILL.md`.
7. This `SPEC.md`.
8. `PLAN.md`, then `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. A later operator
decision must be recorded before it changes the ratified posture.

## Target surfaces

- GitHub organization runner-group policy and sanitized inspection evidence.
- `.github/workflows/**` only where the ratified defense-in-depth design
  requires workflow routing or proof.
- `infra/**` runner controller, launch-template, IAM, bootstrap, and deployment
  configuration required by the approved design.
- `packages/tooling/tool/cli/**` runner bake, integrity verification, and
  red-team tooling required by the approved design.
- `.github/actions/setup-monorepo-ci/**` baked fast-path integrity checks.
- `goals/runner-trust-boundary/**` and referenced fleet evidence.

## Non-goals

- Moving heavy PR work from EC2 to GitHub-hosted runners.
- Reworking fleet cost, speed, sharding, or general architecture owned by
  `ci-fleet-endgame` and its performance successors.
- Reopening or changing `ci-fleet-residue` history.
- Treating PR workflow approval, labels, or runner groups as the primary
  workload boundary.
- Accepted risk, raw finding reports, broad CI cleanup, unrelated IAM changes,
  or unapproved infrastructure migration.

## Phase gates

### P0 Posture validation and grill gate

P0 collected sanitized current facts rather than relying on packet history:

- GitHub organization runner groups, repository access, public-repository
  allowance, workflow restrictions, runner membership, default-group fallback,
  and which controls a PR can or cannot edit.
- The deployed controller and launch template, AMI pin, instance profile,
  metadata options, bootstrap/JIT credential delivery, runner user, teardown,
  and current fast-path checks.
- Current heavy-lane placement and the hosted-runner failures that keep those
  lanes on EC2.
- A threat model covering ordinary process, sudo, UID 0, privileged container,
  host networking, cache persistence, image tampering, stale registration, and
  post-job teardown.

P0 ended with the 2026-08-24 operator grill in
`research/P0-GRILL.md`. It records the questions, options, pushback, final
mechanism, rollback, and approved proof sequence. Its status is
`ratified 2026-08-24`.

### P1 08-24 CSF-003/CSF-009 deployment proof

Status: `complete 2026-08-24 (closure-ready evidence retained)`. P1 satisfied
all requirements against the fresh serving image:

1. [x] The launcher-identity bake produced a sanitized, complete report. The
   serving bake #3 report records Bun `1.4.0`, the `f81ab29f…` lockfile key, and
   the `2d03fb5f…` archive digest. See
   [`P1-EVIDENCE.md` § Bake #3](./research/P1-EVIDENCE.md#merge-bake-guard-bake-3--deploy-2).
2. [x] The report's exact pin was applied with
   `pulumi up --refresh --yes`; SSM
   `/beep-ci/controller/runner-ami-id` version 7 serves that image. See
   [`P1-EVIDENCE.md` § Bake #3 → deploy #2](./research/P1-EVIDENCE.md#merge-bake-guard-bake-3--deploy-2).
3. [x] Red-team run `32763957629` produced exactly one PASS for Gates A, B, C,
   D, and `E_RUNNER_IMDS_HOOK`, plus `AMI_PIN: PASS`, scoped deregistration,
   EC2 teardown, and plain `REDTEAM: PASS`. See
   [`P1-EVIDENCE.md` § Red-team run 4](./research/P1-EVIDENCE.md#red-team-run-4-pass).
4. [x] Lane probe `32763957329` reported `Baked fast path: true` only after the
   checkout keys, Bun binary, sealed cache, owners, modes, digests, and symlink
   matched. See
   [`P1-EVIDENCE.md` § Lane probe #3](./research/P1-EVIDENCE.md#lane-probe-3-positive-path).
5. [x] The two held Codex IDs have individual closure-ready mappings in
   [`P1-EVIDENCE.md`](./research/P1-EVIDENCE.md#closure-ready-mapping). Both
   remain open until the `P5` remediation PR merge gate; `P6` owns dashboard
   closure.

### P2 Workload identity boundary

Retain `beep-ci-runner-profile` only for root-owned bootstrap. Fetch the one-use
JIT configuration into root-only tmpfs, delete its Parameter Store value, and
keep the runner offline. A one-shot root helper must call
`ec2:ModifyInstanceMetadataOptions` on its own instance with
`HttpEndpoint=disabled`, then exit. Bootstrap waits fail-closed until host
probes against both IPv4 and IPv6 IMDS fail.

Add the role allow scoped to `${ec2:SourceInstanceARN}` and
`ec2:MetadataHttpEndpoint = disabled`. Add a boundary Deny for the same action
when the endpoint value is anything other than `disabled`. Dry-run proof must
cover both edges before deployment. If self-only one-way disable cannot be
proved, the no-profile controller-broker alternative becomes mandatory.

Before runner startup, scrub the JIT buffer and prove no residue survives in
arguments, environment, `/proc`, files, logs, cloud-init data, swap, or the
runner work directory. Prove ordinary, sudo, root, privileged-container,
host-network, direct IMDS, delayed teardown, and replay paths. Gate E remains a
second control, not a claim that a UID rule withstands root.

### P3 Admission defense in depth

Admission begins only after workload identity passes. Before refactoring the
workflow, prove live that GitHub accepts a selected reusable workflow at
`refs/heads/main` when its caller runs from a pull-request merge ref.

Move the five heavy pull-request lanes into reusable `heavy.yml` on `main` and
call it from `check.yml` with
`uses: beep-effect/beep-effect/.github/workflows/heavy.yml@main`. Create
organization group `beep-ec2-heavy` with public-repository access enabled,
visibility `selected` for only `beep-effect/beep-effect`, and workflow
restriction enabled for `heavy.yml`, `fleet-shadow-check.yml`, and
`fleet-lane-probe.yml`, each at `refs/heads/main`.

The controller must use organization-scoped registration with
`enable_organization_runners` and `runner_group_name`. A missing or rejecting
group must fail closed without `Default` or repository fallback. The operator
must first grant `admin:org`, fine-grained organization self-hosted-runner
write, or GitHub App `organization_self_hosted_runners` permission.

### P4 Boundary verification

Run the ratified red-team matrix on the deployed non-privileged runner class.
Prove sealed-image integrity, one-job-one-VM lifecycle, runner deregistration,
EC2 teardown, runner-group policy, and absence of usable job credentials.
Map the deployed evidence to each of the remaining four open Codex IDs and mark
all six IDs closure-ready. Do not close any dashboard ID before the `P5`
remediation PR merge gate passes.

### P5 Yeet publish, review, and merge gate

Publish the remediation through Yeet. Reach `merge-ready: yes`, resolve every
review thread, and merge the PR only with explicit operator authority. The six
dashboard IDs remain open throughout this phase. A mergeable but unmerged PR
does not satisfy the gate.

### P6 Dashboard closure

After the `P5` merge gate passes, close the six exact Codex IDs as Already fixed
using their individual deployed evidence. Reconcile the live dashboard against
the exact allowlist and retain sanitized closure metadata.

### P7 Close

Record the final evidence and reflection, then update packet lifecycle, plan,
manifest, and index state together.

## Acceptance criteria

- [x] P0 records current GitHub and AWS facts and the retained 2026-08-24
      operator grill ratifying design, sequence, rollback, and proof.
- [x] `P1` satisfies every deployment-proof requirement and records
      closure-ready evidence for the two held exact IDs in
      `research/P1-EVIDENCE.md`.
- [ ] Heavy PR lanes remain on EC2, with their placement rationale retained.
- [ ] Every job uses a fresh VM from a sealed digest-verified AMI.
- [ ] No ordinary, sudo, root, privileged-container, or host-network path can
      obtain usable ambient application instance-role credentials.
- [ ] The role allow and boundary Deny prove one-way, self-only metadata
      disable; the JIT residue and replay probes pass before runner startup.
- [ ] Runner-group controls use the default-branch reusable workflow, match the
      selected-repository and three-workflow design, and cannot fall back.
- [ ] The complete red-team matrix, runner deregistration, and EC2 teardown pass
      against the deployed configuration.
- [ ] The remediation PR is published, reviewed, `merge-ready: yes`, and merged
      before any of the six dashboard IDs are closed.
- [ ] After merge, all six open Codex IDs are closed with exact deployed
      evidence; the three older closed identities are not reopened or
      reclassified without proof.
- [ ] Fleet packet ownership remains unchanged.
- [ ] Yeet reports `merge-ready: yes`, review threads are zero, the PR is merged,
      and the closeout reflection validates.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/runner-trust-boundary/GOAL.md)" -le 4000` | Pass |
| Manifest JSON | `jq . goals/runner-trust-boundary/ops/manifest.json` | Pass |
| Packet health | `bun run beep goals doctor` | No new blocking findings |
| Goal index | `bun run beep goals index --check` | Pass |
| Reflection schema | `bun run beep lint reflection-artifacts` | Exit 0 |
| P0 gate | Retained fact record and operator grill | Ratified 2026-08-24 |
| `P1` bake | Fresh bake report, pin, deployment, setup log | All integrity checks pass |
| `P1` red team | `redteam-verify.sh <deployed-ref>` | One PASS per required gate, teardown proved |
| Workload identity | Ordinary plus privileged probes | No usable application role credentials |
| Dashboard | Post-merge signed-in exact-ID reconciliation | All six packet IDs closed after `P5` merge |
| Whitespace | `git diff --check -- goals/runner-trust-boundary` | Pass |

## Stop conditions

- P0 facts contradict the ratified posture and the operator has not made a new
  decision.
- The operator grill is incomplete or does not ratify the design.
- A proposal moves the heavy PR lanes to hosted runners or promotes admission
  gating to the primary boundary.
- The job VM retains usable application instance-role credentials or a
  bootstrap path that job-controlled privilege can recover.
- A Bun-binary, sealed-cache, AMI, gate, deregistration, or teardown check
  fails.
- Required GitHub or AWS authority is unavailable for deployed proof.
- Work crosses into fleet performance or architecture ownership without an
  explicit handoff.
- Tracked evidence contains raw findings, secrets, email addresses, machine
  IDs, or developer-local absolute paths.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
