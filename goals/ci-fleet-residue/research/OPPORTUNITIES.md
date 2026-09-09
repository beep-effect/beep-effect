# ci-fleet-residue — friction and opportunity ledger

Record receipts at the moment friction happens; redact for the public repo.

## 2026-09-09 — An unused Chrome package feed blocked Storybook twice

- What: final hosted proof for the lean runner-image PR #1062.
- Evidence: Storybook run `34383237868`, attempts 1 and 2, failed at
  `Install Playwright Chromium` before the build. APT reported `Hash Sum
  mismatch` for Google's `chrome-stable/deb` package index. A bounded retry
  reproduced the same expected and received digest mismatch.
- Attribution: an external feed on the GitHub-hosted Ubuntu image, separate
  from the EC2 image change. Playwright installs its own browser; its system
  dependency installation does not need Google's Chrome package feed.
- Repair: remove only Chrome feed definitions from the disposable runner
  before the existing `playwright install --with-deps chromium` command.
  Keep dependency installation and package integrity verification enabled.
  GitHub's own [image installer](https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/install-google-chrome.sh)
  already removes the older Chrome list name; cover current Chrome-prefixed
  `.list` and `.sources` definitions in this workflow as well.
- Prevention: scope job package sources to the dependencies the job needs,
  and require a successful hosted rerun before closing the incident.

## 2026-09-09 — A fresh image passed integrity but regressed setup time

- What: comparing the existing image with a fresh Bun 1.4.2 image before
  changing the production pin. Both probes used the same pushed revision,
  `r6i.2xlarge`, root-volume settings and isolated setup procedure.
- Evidence: the existing image missed the baked fast path and completed setup
  in 18 seconds, including a 9-second frozen install. The new image passed the
  exact setup integrity detector but took 228 seconds, including a 6-second
  install. The successful integrity result alone did not establish a speedup.
- Response: keep the production pin unchanged and instrument cache hashing,
  extraction and Node setup separately before choosing the repair. AWS console
  reads also returned older captures after newer ones; retain completed evidence
  instead of letting a stale response erase an observed peak or result.
- Isolation: a second fresh guest measured 163 seconds hashing the 1.35 GB
  cache archive, 27 seconds extracting it and 2 seconds setting up Node. The
  archive expands to 4.60 GB; the subsequent frozen install took 6 seconds.
  The repair removes this archive from future bakes and skips its restore,
  while retaining Bun's release digest, installed-binary digest, root ownership,
  version and lockfile checks. Every job still runs a fresh frozen install.
- Repair probe: the exact modified setup detector passed on another fresh
  instance, with a fast-path hit, 20-second setup and 9-second frozen install.
  This isolated result removes the archive regression; a production workflow
  probe is still required to measure hosted setup and completion time.
- Lean-image proof: the replacement bake omits the archive and reduces full
  snapshot data from 8.024 GiB to 2.350 GiB. Its fresh guest passed setup in
  11 seconds, including a 9-second frozen install, and Check passed 246/246
  tasks in 541 seconds. This uses pushed source `b9b6faa5a2`, including the
  newer Check overlay repair; the earlier source's 739-second Check is not a
  controlled image-only timing comparison. Peak sampled VM memory was
  11.61 GiB. The guest was terminated after capturing its terminal success.
- Rollout boundary: the refreshed saved image-only Pulumi plan has one SSM
  update, 83 unchanged resources and no replacements or deletions. It excludes
  the known enrollment-provider discrepancy. The intended pin and image
  receipt are reviewable; attended activation and a hosted probe remain.
- Prevention: require timed canaries as well as freshness and integrity checks
  before promoting an image intended to reduce setup cost.

## 2026-09-09 — Spot retry estimates must use billed usage

- What: comparing Spot, autoscaled On-Demand EC2 and EKS after the operator
  asked which option actually costs less.
- Evidence: AWS does not charge instance usage when it interrupts Linux
  Spot capacity, excluding SUSE, during the first instance hour. Charging
  every failed 20-minute attempt in a cost model overstates those compute
  costs. User-initiated termination and older instances have different rules.
- Prevention: join termination initiator and instance age to billing evidence;
  report delay, repeat setup and supporting-resource charges separately.
  Keep the On-Demand reliability decision distinct from a claim that Spot
  had a higher invoice. The cost runbook links the canonical billing table.

## 2026-09-09 — Full coverage exposed untested cost-control boundaries

- What: the final local proof passed build, lint, checks and unit tests, then
  rejected uncovered configuration/error paths in the new account-controls
  module and a lower branch percentage in the runner command.
- Repair: exercise Pulumi config loading, reject invalid account/threshold
  values, verify recipient diagnostics redact their input, and assert the
  stale intended-manifest error without querying the live image. The focused
  account module now measures 100% lines/statements/functions; the runner
  command measures 89.28% branches against its previous 86.36% floor.
- Test isolation: the shared Vitest configuration enables concurrent tests,
  while Pulumi config and mocks use a shared runtime. Set `concurrent: false`
  on this fixture suite so one case cannot replace another case's mock monitor.
- API compatibility: hosted `lint:deprecated-apis` rejected Vitest's older
  `sequential` shorthand and `toThrowError` matcher. Use the supported suite
  option and `toThrow`, and run the exact lint gate after adding test APIs.
- Prevention: cover real configuration and failure boundaries before the full
  proof; retain the existing regression baseline instead of lowering it.

## 2026-09-09 — Legacy IAM policies blocked cost remediation

- What: retiring the reviewed old keys and refreshing the stale runner image.
- Evidence: `kms:ScheduleKeyDeletion` was denied on the first old EKS key;
  six policies name only `terraform-user` as administrator. The separate old
  FluentBit key permits current account administration and entered a 30-day
  pending-deletion period. The current CI key was excluded.
- Resolution: the operator supplied secret references for the existing
  `terraform-user`. STS verified that exact identity; fresh metadata confirmed
  the six approved keys' creation dates, zero grants and matching aliases.
  All six entered PendingDeletion at 13:15 UTC, with 30-day windows ending
  October 9. The current CI key remains Enabled. No IAM policy was weakened.
- Bake evidence: `RunInstances` was rejected before creation by the unrelated
  `FreedomFramework-CI` policy's explicit `LimitEC2Size` deny, which permits
  only `t2.micro` for the current operator login.
- Bake access repair: after the operator approved continuation, the September 9
  16:08 UTC operation detached only that obsolete policy from the operator
  user. The policy remains available for rollback, its other attachment remains,
  and every other operator policy attachment was verified unchanged. A fresh
  `r6i.2xlarge` bake then launched successfully; image validation and activation
  remain separate steps.
- Prevention: capture the required operator identity and exact launch-policy
  preflight in the bake runbook. Keep the rejection distinct from a broken
  image or a capacity shortage; do not create credentials or weaken fleet
  roles to route around a denial.

## 2026-09-09 — Cost audit found stale images and incomplete cleanup evidence

- What: the operator requested an account cost audit after the permanent
  On-Demand migration. August Cost Explorer usage was $522.10, including
  $454.78 in EC2 compute. Historical $100 budget and Spot instructions no
  longer describe the current purchase model or workload.
- Evidence: all 20 sampled successful heavy jobs used the full setup path,
  with a 74-second median setup. `bun run beep runners bake --check --json`
  confirmed mismatches in the live image's Bun version, archive digest and
  lockfile digest. The image contains Bun 1.4.0; current jobs require 1.4.2.
  This is freshness drift, with no evidence required of artifact corruption.
- Paid skip evidence: Doctest job 102413512462 in run 34335406225 allocated
  an EC2 runner for 14 seconds, skipped setup and verification, and ran only
  the skip step. Moving eligibility ahead of allocation needs a canary:
  sampled hosted queues show that a new planning dependency can delay useful
  heavy work even while reducing EC2 minutes.
- Audit friction: empty RDS instance inventories missed a retained 2021
  final snapshot that explains the recurring backup charge. Logs created in
  2022 included two groups with August 2026 ingestion. Reconcile billed usage
  types with service-specific backup/version inventories and last activity;
  creation dates and empty compute lists are insufficient deletion evidence.
- Observability limitation: Compute Optimizer requires 30 cumulative hours
  of metrics per EC2 instance. One-job runners require measurements grouped
  by lane and runner configuration; opting into recommendations alone does
  not provide rightsizing proof for this fleet.
- Prevention and decisions: the operator chose a $500 soft guardrail with
  current reliability and speed preserved, approved standard cost visibility,
  and confirmed VaultCtx retirement. The owning audit and implementation plan
  is `docs/runbooks/aws-cost-operations.md`. Exact data candidates and cloud
  execution receipts remain private. The approved pre-cutoff workload cleanup
  was executed, including all seven old-key deletion schedules; the runbook
  separates completed actions from the blocked runner-image bake.

## 2026-09-09 — Runner queue delay resembled a fleet outage

- What: the operator reported that jobs appeared not to pick up runners after
  the cost-control rollout.
- Evidence: all 273 scale-up retry warnings in the captured 40-minute window
  correlated with `maximum number of runners reached` at the unchanged cap of
  14. Fresh workers subsequently accepted all six heavy lanes in run
  34354910245; Check, Test Integration, Doctest and Docgen passed while the
  remaining two continued. Scale-up was Active with a successful update.
- Prevention: check the organization runner API, queued job timestamps, live
  EC2 inventory and Lambda retry reasons together before changing capacity.
  The repository runner endpoint does not list this organization-owned pool.
  Capacity waiting and zero-idle boot time are distinct from missing runner
  registration or failed instance launches. Preserve the reliability decision
  and require measured queue/runtime evidence before changing the cap.

## 2026-09-09 — Spot reclamation and broken termination credential access

- What: recent PR verification lanes repeatedly lost their EC2 runners. AWS
  Spot request status confirmed `instance-terminated-no-capacity` for nine
  distinct failed runners across Check, Coverage Regression, and Lint Policy
  in runs 34326794784, 34328058384, 34328673593, and 34329733429.
- Evidence: retained fleet records contained 30 capacity interruptions across
  three instance types and both configured availability zones. GitHub reported
  the losses about 11 minutes after EC2 recorded termination; an apparent
  18-minute lane lifetime is not evidence of a fixed lane timeout. The
  tag-based reaper reported an empty reap set with its 150-minute TTL.
- Additional defect: the termination notification Lambda logged 164 failures
  across 133 instances during 08:00–09:00 UTC. The minimal fingerprint is
  `Failed to deregister runner from GitHub` with `kms:Decrypt` denied because
  no identity policy allows it. The pinned upstream v7.10.1 watcher grants
  SSM reads without forwarding the customer-managed KMS key grant.
- Prevention: make the heavy pool permanently On-Demand, preserve its cap and
  ephemeral teardown, and manage a separate key- and SSM-context-scoped decrypt
  grant for all three cleanup roles. Verify resource wiring with Pulumi mocks,
  preview the actual infrastructure diff, and require live capacity and
  credential-operation evidence after deployment. The operational procedure is
  in `docs/runbooks/ci-runner-reliability.md`.
- Deployment-check friction: the initial preview exposed an `Output<T>` string
  coercion in the new regional SSM condition, which a literal-region mock did
  not exercise. The regression now passes the same Pulumi output form as the
  real entrypoint. The later KMS-grant implementation passes that output directly
  to regional AWS inputs. Require inspection of rendered values, not just the
  resource-count summary.
- Review friction: external inline policies on module-owned roles can block
  deletion or fail to follow same-name role replacement. The final source owns
  six key grants instead, with exact parameter contexts and immutable role IDs
  in grant names. Lambda discovery explicitly uses the controller region. The
  attended migration created the grants before removing the three initial
  policies. Final preview: 201 unchanged. Post-removal CloudTrail events prove
  successful SSM reads and KMS decrypts for both parameters; natural cleanup
  reached GitHub. Add access before removing working access and verify reads.
- Migration preview friction: targeting only the six new grant URNs reported
  `Target ... could not be found in the stack` before dependent invokes resolved.
  A full program preview excluding the three existing policy URNs produced
  exactly six creates. Save and constrain that creation plan, then preview the
  three policy removals separately after the grants exist and have propagated.
- Verification friction: concurrent AWS metadata commands briefly encountered
  `CreateOAuth2Token: Rate exceeded`; a serialized retry completed. Let the CLI
  refresh its login credentials before starting a metadata fan-out.

## Seed context (2026-08-13, from the split)

- Spot evidence: 3 same-second reclaims killed 6 jobs on cutover evening
  (2026-08-11 19:49:32Z sweep); on-demand since. A calm-week baseline is the
  revert precondition.
- IMDS attribution is CONFOUNDED: the original DROP rollback blamed the
  firewall, but the toolbelt post-install reproduced the identical
  runner-start failure with no firewall (inline set -u leak). Retest
  subshell-scoped.
- Closeout writer bug field evidence: PR #668 and #673 closeouts both
  emitted reviewedHeadSha as a raw Option object.
## 2026-08-13 — mid-publish worktree writes would fail proof-changed-worktree

- What: while a `yeet publish` full proof was running for the P3 closeout
  writer fix, packet research notes were written into
  `goals/ci-fleet-residue/research/`. `validatePostCommitProofDidNotChangeWorktree`
  fails the publish when ANY staged/unstaged/untracked path exists post-proof,
  regardless of who created it — the files had to be parked in `/tmp` and
  restored after the push.
- Evidence: `packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts`
  (`proof-changed-worktree` packet, "no staged, unstaged, or untracked paths
  remain").
- Prevention: a path-set diff (snapshot at commit, fail only on new paths)
  does NOT work — files an agent writes during the proof are new paths in
  the post-proof set and still fail, while grandfathering baseline paths
  would mask proof-time mutations of those files. The honest options are
  isolation or messaging: run the proof against a detached worktree of the
  committed HEAD (the head-install preflight already builds exactly that
  machinery), or emit an explicit advisory at publish start ("worktree is
  sealed until push") so operators/agents park side work elsewhere.

## 2026-08-13 — no safe porcelain for bumping a locked transitive dep

- What: a fresh advisory (GHSA-2v37-7h3g-55p8, nanoid <3.3.18) failed
  `repo-sanity:bun-audit` and `pre-push:security` mid-arc — environment
  class, identical tree had passed ~40 min earlier. Remediation required
  bumping ONLY the transitive `nanoid@3.3.17` (under postcss/docx), and no
  bun porcelain does that: `bun update nanoid` silently ADDS `nanoid@^6` as
  a root direct dependency (wrong and does not fix the locked 3.3.17);
  `bun update docx` re-resolved docx's own subtree but left `postcss/nanoid`
  at 3.3.17; a root `overrides` entry would force the 5.x consumers down.
  Ended up hand-patching the `bun.lock` entry (version + registry
  `dist.integrity`) and verifying with `bun install --frozen-lockfile` +
  both security lanes.
- Evidence: bun.lock one-line diff `nanoid@3.3.17 -> 3.3.18`;
  `bun audit` / osv-scanner green after; `bun install` accepted integrity.
- Prevention: a `beep` helper (or documented recipe) for
  "bump one locked transitive to a fixed release": patch the lock entry
  with registry integrity, frozen-install to verify, run both audit lanes.
  Advisory-feed failures mid-publish are recurring; the repair should be a
  one-command ritual, not lockfile surgery.

## 2026-08-14 — merged P2 IMDS hook is undeployable: bash `${...}` parses as HCL in the bridge

- What: answering "does anything need a deploy", ran `pulumi preview --stack
  production --diff` on beep-ci-runners. The plan hard-fails on every
  runner config's `userdata_post_install` (#708): the hook script's bash
  expansions (`${runner_uid}`, `${runner_dir}`, `${hook_armed}`) reach the
  terraform-module bridge's generated `pulumi.tf.json` unescaped, and
  Terraform JSON syntax parses string values as templates — each `${...}`
  becomes `Error: Invalid reference` ("a reference to a resource type must
  be followed by at least one attribute access"), 10x, one per runner
  config. The whole stack plan aborts, which also blocks the pending #700
  CiTurboCache `integrationUri` updates (2 resources) from deploying.
- Evidence: `pulumi preview` exit 1, `error: Preview failed: Plan failed`
  after `~ 2 to update, 61 unchanged`; errors anchored on
  `pulumi.tf.json` lines 144–168 `userdata_post_install` in
  `module.ci-fleet-controller`. Source: `infra/src/CiFleetController.ts`
  lines 81–106 (TS `\${...}` escapes produce literal bash `${...}`).
- Prevention: escape Terraform-side as `$${...}` (TS template literal
  `$\${...}`) so the rendered template hands bash `${...}` back; add a
  test asserting module-bound userdata contains no unescaped `${` (the
  #708 tests validated TS string content but never round-tripped through
  an HCL template parse, so review + CI stayed green on an undeployable
  artifact). Longer term: a plan/preview smoke lane for infra-touching PRs
  would have caught this pre-merge.

## 2026-08-14 — redteam-verify.sh could never finish under zsh

- What: dispatching the P2 Gate E / red-team validation, the wrapper
  `goals/ci-fleet-endgame/ops/redteam-verify.sh` crashed at its first run
  poll: `status` is a read-only special parameter in zsh (aliases `$?`),
  and the script assigns `status="$(gh run view ...)"` under a
  `#!/usr/bin/env zsh` shebang — so the teardown/termination assertions
  can never have executed in this form. The dispatched run itself was fine;
  gates and teardown were asserted manually.
- Evidence: `redteam-verify.sh:88: read-only variable: status`; run
  31779611279 completed green while the wrapper had already died.
- Prevention: renamed to `run_status` (fixed with the P2 evidence PR). Ops
  scripts under zsh shebangs need a reserved-parameter pass (`status`,
  `options`, `argv`); a bash shebang would also have dodged it.

## 2026-08-14 — background op reads silently dismiss the 1Password prompt

- What: the first live `beep runners bake` failed before AWS: reading
  `op://BEEP_CI/aws-runner-launcher` from a background task raised the
  1Password desktop authorization prompt with nobody watching, and it was
  dismissed — "authorization prompt dismissed, please try again". A
  foreground retry minutes later failed the same way (prompt still not
  reaching the operator).
- Evidence: bake task exit 1 with the op client error before any aws call.
- Prevention: authorize new-vault access in a foreground operator command
  first (`! op read ...` in-session), then run the long job in the
  background; or grant the CLI standing access to the vault ahead of
  fan-out work.

## 2026-08-14 — first live bake hit three IAM walls the design never metabolized

- What: `beep runners bake` (shipped #702, never operator-run) failed three
  ways in sequence: (1) the launcher user `beep-ci-runner-launcher` had no
  `ssm:GetParameter` on the public AL2023 parameter — its policies were
  built for burst RunInstances only, never extended for bake reads /
  CreateImage / console output; (2) extending inline policy hit the 2048-char
  aggregate inline quota → moved to a customer-managed `beep-ci-bake` policy;
  (3) the launcher's own guardrails DENY RunInstances whenever an instance
  profile is attached (`DenyLaunchWithInstanceProfile`) — bake guests must be
  identity-less — while the CLI made `--instance-profile` a REQUIRED flag.
  The brief's "minimal instance profile (SSM only if used)" open question
  resolves to: NO profile at all (console-marker driver needs no in-guest
  AWS), and the CLI was fixed to make the flag opt-in.
- Evidence: AccessDeniedException on ssm:GetParameter; LimitExceeded
  (2048-byte user policy quota); UnauthorizedOperation "explicit deny"
  naming ec2:InstanceProfile null-condition. Managed policy
  `beep-ci-bake` (SSM base-AMI + pin read, tag-conditioned GetConsoleOutput
  + CreateImage, CreateImage-conditioned CreateTags) now attached to the
  launcher.
- Prevention: the launcher user and its policies are hand-managed (infra
  only references them in comments) — bake permissions should move into IaC
  with the rest of the fleet; command briefs that add a new AWS caller
  should enumerate the caller's exact action set against the live policy
  before the first operator run.

## 2026-08-14 — blind bake failures until the script narrated itself

- What: two more live-bake failure classes after the IAM walls. (1) The CLI
  treated `InvalidInstanceID.NotFound` from the first post-launch
  describe-instances as fatal — EC2 read-after-write propagation, seconds
  wide — killing the bake right after RunInstances succeeded; fixed by
  folding NotFound (instance and AMI variants) into the AwsResourcePending
  retry. (2) The bake script emitted nothing to the serial console until its
  final success marker, so an in-guest failure produced only "stopped
  without the marker" with zero forensics — and the failure-path teardown
  terminates the instance, destroying the console evidence the verifier had
  already fetched. After adding `exec >> /dev/console` + an ERR trap that
  prints the failing line, one run pinpointed the actual bug instantly:
  AL2023's cloud-init rejects the newer `--machine-id` flag
  (`cloud-init clean --logs --machine-id` → "unrecognized arguments"), so
  the bake died on its LAST cleanup line after a fully successful install
  (2490 packages warm in 9.22s). Replaced with `cloud-init clean --logs` +
  explicit `truncate -s 0 /etc/machine-id` + dbus machine-id removal.
- Evidence: console snapshot with `BEEP_RUNNERS_BAKE_FAILED line 25:
  cloud-init clean --logs --machine-id`; attempts 4 and 5 outputs.
- Prevention: landed — bake scripts narrate to the console permanently and
  the ERR trap names the failing line; propagation NotFound is retried and
  unit-tested. Residual idea for the next touch: the verifier should attach
  the console tail to the no-marker error instead of discarding it.

## 2026-08-14 — the verifier terminated three good bakes; two more AWS shape gotchas

- What: after the console narration landed, three consecutive bakes
  actually SUCCEEDED in-guest (marker on the serial console) while the CLI
  reported failure and terminated the freshly baked instance: EC2 posts a
  stopped instance's console output minutes after the stop, and the
  verifier read it immediately, got empty, and called that "no marker".
  Two further shape gotchas: AWS CLI v2 auto-decodes get-console-output's
  Output field (a base64 decode layer on top fails on plain text), and
  CreateImage evaluates snapshot resources with ACCOUNT-LESS ARNs
  (`arn:aws:ec2:us-east-1::snapshot/*`) — an account-qualified policy
  resource silently never matches.
- Evidence: attempt 9's error carried an empty console tail while the
  poller's running-state snapshot held BEEP_RUNNERS_BAKE_COMPLETE; attempt
  10 failed "invalid base64 console output"; attempt 11's encoded-auth
  failure named the account-less snapshot ARN. Attempt 12 shipped
  ami-076e22e205ce6a512.
- Prevention: landed — empty post-stop console reads retry as pending
  (6-minute window), the base64 layer is gone, and the policy uses the
  ARN forms AWS actually evaluates. Meta-lesson: a teardown that destroys
  the only evidence (terminate-on-failure) plus an eventually-consistent
  read is a false-negative machine; verifiers must retry reads that can
  trail the state transition they gate on.

## 2026-08-14 — bake revision must be pushed; console posting latency varies 3x

- What: three bakes from the activation branch failed in-guest at
  `git checkout --detach <rev>`: the bake guest clones from GitHub and the
  branch was unpushed, so HEAD was unreachable — the instance launches,
  installs everything, verifies the Bun archive (CSF-016 worked first
  try), then dies on the checkout. Separately, EC2's post-at-stop console
  latency varied from under 2 minutes (first successful bake) to over 6
  (the window that false-failed a later one) — the wait is now 20 minutes.
- Evidence: `BEEP_RUNNERS_BAKE_FAILED line 18: git -C /tmp/beep-effect
  checkout --detach 2d76aa59...` in the posted console; `/tmp/
  bun-linux-x64.zip: OK` immediately above it.
- Prevention: landed — `assertRevisionPushed` refuses the bake before any
  AWS call when no remote branch contains HEAD, naming the push as the
  remedy. The general rule: any command that ships a local revision to a
  remote executor must prove remote reachability first.

## 2026-08-14 — hosted docgen "hang" was turbo grouped-log backpressure

- What: PR #718's Docgen lane hung five consecutive times, always wedging
  the moment `@beep/repo-cli:docgen` started, while the identical command
  (same mode, forced turbo, pinned to 8 cores) passed locally in under two
  minutes. Two wrong theories fell first: the ship-velocity A7 success-exit
  class (a lane process-group reaper now guards every verification lane —
  correct fix, wrong bug) and per-package docgen flake (rerun-proof: 5/5).
  The discriminating probe — `TURBO_LOG_ORDER: stream` on the lane job —
  made the job pass immediately: turbo's grouped log mode buffers a task's
  output behind its group header and stopped draining the pipe of the
  chattiest task (repo-cli, 1139 examples), so the child blocked on a full
  pipe write forever. This branch exposed it by making repo-cli's docgen
  inputs stale enough to run hosted at full output volume.
- Evidence: runs 31797064763 (attempts 1/3/4) and 31810908695 all wedge at
  the `@beep/repo-cli:docgen` group open with zero further output; run on
  head d52aa0077a with streamed logs completes Docgen green in ~5 minutes;
  #716's repo-cli docgen hosted took 11 seconds (smaller output).
- Prevention: landed — lane jobs stream task logs (also the observability
  posture a wedge diagnosis needs), and lane process groups are reaped
  after the lane exits. Feeds ship-velocity SPEC A7: buffered child pipes
  are a hang class of their own, distinct from success-exit wedges.

## 2026-08-16 — activation validated live; rollback previews need --refresh

- What: post-merge (#718, admin-merged past the wedged Docgen gate with the
  ruleset's Docgen requirement lifted for under a minute and restored), the
  activation deployed in 53s (SSM runner-ami -> ami-07fb13d84a42d3584,
  marker-gated toolbelt live). The first fleet-lane probe was the discovery
  run for the baked image's missing bunx symlink ("Failed to spawn bunx
  turbo") — fixed in parallel as #725 (bake + setup-action self-heal); the
  second probe passed end-to-end: "baked runner repair: created missing
  bunx symlink", "Baked fast path: true", full test-integration green on a
  baked worker. Rollback gotcha: a plain `pulumi preview` after reverting
  the pin reports NO diff — aws.ssm.Parameter values are pulumi secrets
  and their diffs are suppressed without state refresh; with
  `pulumi preview --refresh` the revert plans exactly
  `runner-ami update [diff: ~value,version]`.
- Evidence: probe runs 31969468654 (bunx discovery, failed) and
  31971776803 (success); rollback previews with and without --refresh;
  superseded AMIs ami-076e22e205ce6a512 and ami-012c2a9252a1bbd6f
  deregistered with their snapshots; IAM: beep-ci-bake policy v4 drops the
  vestigial PassRole, beep-ci-bake-instance role/profile deleted.
- Prevention: the rollback recipe is `pulumi config set
  ciFleetController:amiId <prior> && pulumi up --refresh --yes` — never
  trust a no-diff preview on secret-valued resources without refresh.

## 2026-08-16 — greptile score parsing collides with score-shaped prose

- What: PR #727's closeout gate reported "greptile 4/5" while the live
  summary comment says "Confidence Score: 5/5" with zero issues. The
  summary body also contains "1/5" and "3/5" as PROSE (Greptile describing
  goals/INDEX.md's phase-completion count moving 1/5 -> 3/5), and Greptile
  edits its summary in place after re-reviews — so any parser that greps
  N/5 patterns or caches an earlier fetch reads a wrong score on exactly
  the PRs whose diffs mention phase counts.
- Evidence: issue comment 5309682378 contains {1/5, 3/5, 5/5}; repeated
  `yeet closeout` runs kept reporting 4/5 (a value not present in the
  final body) after the in-place re-score.
- Prevention: anchor the closeout parser to the "Confidence Score:"
  heading, never a bare N/5 match, and re-fetch on updated_at rather than
  trusting a prior parse of an in-place-edited comment.

### Budget adoption exposed a parent/provider import ordering failure

- **Doing:** attended adoption of the existing budget after an approved preview.
- **Evidence:** the bulk import registered the dedicated provider before its new
  component parent; Pulumi reported `child resource ... refers to missing parent`
  while saving the checkpoint. Only provider state was created; no AWS workload
  changed. A private encrypted export was captured before the operation.
- **Remediation:** compare and restore that checkpoint, register the component
  first, then import its provider and existing budget before previewing updates.
- **Prevention:** adoption runbooks must separate new component registration from
  child-provider imports and verify a recoverable state export before mutation.

- **Verified recovery:** restored the pre-operation checkpoint, imported the
  component first, then its provider and budget. The approved saved-plan update
  completed with ten creates, three updates, 201 unchanged, and no replacements
  or deletions. A normal encrypted export passed integrity checking afterward.
  Direct AWS reads confirm the $500 budget, four existing-recipient alerts, six
  Active tags, standard account-only enrollments, and a confirmed daily $10
  anomaly subscription. The fleet remains On-Demand with cap 14.

### Account-only Cost Optimization Hub enrollment produced a perpetual diff

- **Doing:** refreshed no-change proof after the approved cost-control apply.
- **Evidence:** AWS reported the current account Active but returned null for
  `includeMemberAccounts`; Pulumi repeatedly proposed adding false. Omitting the
  argument did not help because the provider supplied its false default.
- **Disposition:** omitting the argument and ignoring only its changes both
  left a proposed update after refresh. The scoped reconciliation made no AWS
  changes. Neither ineffective workaround is retained. Keep explicit false and
  verify actual enrollment separately; 213 other resources show no changes.
  Revisit on a provider fix; do not loop applies to clear this readback mismatch.
- **Source:** [provider enrollment contract](https://www.pulumi.com/registry/packages/aws/api-docs/costoptimizationhub/enrollmentstatus/)
  documents that this argument does not support drift detection.

### Hosted closeout exposed two inherited CI defects

- **Doing:** verifying PR #1055 after merging current main.
- **Evidence:** the CLI unit job reported 3,313 passing tests and one failure:
  recursive directory reads returned identical export paths in different orders.
  Storybook correctly skipped an unaffected build, then its unconditional upload
  failed because no static artifact existed. Both jobs completed with full logs.
- **Remediation:** sort both directory inventories before comparing contents, and
  upload Storybook only when its static index exists. The executed Storybook lane
  retains its existing required-artifact check, so a missing build output still
  fails. Both defects were present in the merged base, not caused by AWS cleanup.
- **Prevention:** compare filesystem inventories independently of enumeration order
  and make artifact uploads respect successful affected-lane skips.
- **Companion-test correction:** the initial focused selection missed the workflow
  security suite, whose literal upload-gate assertion still required the old
  condition. The full suite exposed it. Update that contract to require both the
  artifact-presence guard and strict missing-file handling; include security,
  lane and scheduler suites together when validating the repair.
  Run that focused selection with the package's `bunx --bun vitest run` runtime:
  all 120 related tests pass there; a Node invocation exposed a Bun-spawn fixture
  difference in the pre-existing bootstrap test.
