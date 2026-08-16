# ci-fleet-residue — friction and opportunity ledger

Record receipts at the moment friction happens; redact for the public repo.

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
