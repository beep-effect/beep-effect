# P1 deployment-proof evidence

Date: 2026-08-24

Status: complete; the two held findings are closure-ready and remain open

This record covers the fresh bake, deployment, red-team, fast-path, and
teardown proof required by P1. Identifiers follow the packet's public
sanitization convention.

## Identity and inputs

The bake must run as IAM user `beep-ci-runner-launcher`. Its effective policy
set is `beep-ci-bake`, `beep-ci-launch`, and
`beep-ci-runner-launch-guardrails`. The first attempt used the operator's admin
identity and AWS denied `ec2:RunInstances` with `UnauthorizedOperation`. The
decoded denial matched the unrelated `LimitEC2Size` identity-policy statement,
not MFA or an organization SCP. The successful bake logs record
`arn:aws:iam::<acct>:user/beep-ci-runner-launcher` before launch.

The operator resolved both network inputs live rather than copying old packet
values:

- `describe-subnets` identified `beep-ci-runners-public-a`, CIDR
  `10.88.0.0/20`, as the production public subnet. Its id is retained only as
  `subnet-…`.
- The serving launch template identified `beep-ci-runner-workers` as the worker
  security group. Its id is retained only as `sg-…`.

## Bake #1 → deploy #1

Bake #1 ran from `abbe959d1e` between `17:49:03Z` and `18:02:27Z` and exited
0 after its bake-complete marker. The report records Bun `1.4.0`, lockfile
digest `ee8762b6…`, Bun archive digest `2d03fb5f…`, and the current AL2023
latest image as its base. The prior pin was the 2026-08-16 image.

The operator applied the report's exact pin command, then ran
`pulumi up --refresh --yes`. Deploy #1 exited 0 in `1m7s`. SSM parameter
`/beep-ci/controller/runner-ami-id` advanced to version 6 and served the bake
#1 image.

## Red-team runs 1–2

Run [`32760440289`](https://github.com/beep-effect/beep-effect/actions/runs/32760440289)
concluded `success`. Its five real summary lines each appeared exactly once:
`GATE A_APP_SECRET_SSM: PASS`, `GATE B_S3: PASS`,
`GATE C_TAILNET_LAN: PASS`, `GATE D_CONTAINER_IMDS: PASS`, and
`GATE E_RUNNER_IMDS_HOOK: PASS`. The executing instance launched at
`18:06:47Z` on the bake #1 image and terminated.

The wrapper still returned `REDTEAM: FAIL`. It counted the echoed shell source
as a second PASS for every gate and waited for a fleet-wide six-runner roster
that included heavy lanes from two other pull requests. This run is
superseded. It is retained because it proves both the underlying gates and the
two wrapper defects.

After the wrapper fix, run
[`32761051746`](https://github.com/beep-effect/beep-effect/actions/runs/32761051746)
concluded `success` and produced exactly one PASS for each gate A through E.
It then reported:

```text
deregistration scope: beep-ci-<id> (4 other controller runners observed and ignored)
GATE AMI_PIN: PASS (bake #1 image)
ephemeral runner deregistered after 1s
EC2 termination asserted after 1s
REDTEAM: PASS
```

There was no AWS-skipped qualifier. The executing instance launched at
`18:12:18Z` on the bake #1 image and terminated.

## Lane probe #1: stale key, negative path

Run [`32761137404`](https://github.com/beep-effect/beep-effect/actions/runs/32761137404)
ran `test-integration` on the bake #1 image and concluded `success`. Its setup
action reported:

```text
baked runner stale or failed integrity checks; using full setup
Baked fast path: false
```

This was a correct rejection, not a bake defect. `origin/main` had advanced to
`7d4ce3434c` in PR #786. That revision's `bun.lock` digest was `f81ab29f…`,
which did not match bake #1's `ee8762b6…` key. Bun `1.4.0` and archive digest
`2d03fb5f…` still matched. The lockfile-keyed integrity check therefore refused
a stale image and used the full setup path.

## Merge, bake guard, bake #3 → deploy #2

The branch merged `origin/main` as `10c82e7aa3` and reinstalled dependencies.
Bake #2 then stopped before launch:

```text
Bake revision 10c82e7aa3… is not reachable from any github.com/beep-effect/beep-effect remote branch; push it before baking.
```

The provenance guard behaved correctly. To avoid an unverified early push,
the operator baked from a detached worktree at `origin/main` revision
`7d4ce3434c`, whose lockfile matched the merged branch.

Bake #3 ran between `18:21:58Z` and `18:34:07Z` and exited 0 after its
bake-complete marker. Its report records Bun `1.4.0`, lockfile digest
`f81ab29f…`, archive digest `2d03fb5f…`, the current AL2023 latest base, and the
bake #1 image as the prior pin.

The operator again applied the report's exact pin and ran
`pulumi up --refresh --yes`. Deploy #2 exited 0 in `36s`. SSM
`/beep-ci/controller/runner-ami-id` advanced to version 7 and now serves the
bake #3 image. The committed `infra/ci-runners/Pulumi.production.yaml` carries
the same pin.

## Post-flip contamination

Red-team run
[`32763386226`](https://github.com/beep-effect/beep-effect/actions/runs/32763386226)
and lane-probe run
[`32763385680`](https://github.com/beep-effect/beep-effect/actions/runs/32763385680)
were dispatched about two minutes after deploy #2. Six bake #1 instances were
still serving other pull requests, and both jobs landed on that older image.

Run `32763386226` concluded `success` at the workflow level and Gates A through
E each passed. Its teardown scope ignored 10 other observed controller
runners. The local deployment assertion correctly rejected the worker:

```text
GATE AMI_PIN: FAIL (expected bake #3 image, got bake #1 image)
REDTEAM: FAIL
```

Lane probe `32763385680` also concluded `success`, but setup reported the stale
integrity fallback and `Baked fast path: false`. Both runs are retained as
negative-path evidence. `AMI_PIN` prevents a clean gate result from being
misattributed to the newly deployed image, while the setup integrity check
prevents reuse of an image with the wrong lockfile key.

## Fleet drain

The operator polled `describe-instances` once a minute, filtered by the bake #1
image. The count fell `6 → 4 → 2 → 1 → 0` at about `18:42Z`. No new
bake #1 instance could appear because scale-up read the version 7 pin. The
operator dispatched the final pair only after the count reached zero.

## Red-team run 4: PASS

Run [`32763957629`](https://github.com/beep-effect/beep-effect/actions/runs/32763957629)
used `fleet-shadow-check.yml`, `redteam=true`, and ref `main`. It was dispatched
at `18:42:58Z` and concluded `success`. At `18:45:03Z`, the summary emitted
exactly one PASS for each of:

- `GATE A_APP_SECRET_SSM`
- `GATE B_S3`
- `GATE C_TAILNET_LAN`
- `GATE D_CONTAINER_IMDS`
- `GATE E_RUNNER_IMDS_HOOK`

The wrapper then reported:

```text
deregistration scope: beep-ci-<id> (1 other controller runners observed and ignored)
GATE AMI_PIN: PASS (bake #3 image)
ephemeral runner deregistered after 1s
EC2 termination asserted after 1s
REDTEAM: PASS
```

There was no AWS-skipped qualifier. The executing instance launched after the
pin flip on the bake #3 image and terminated.

## Lane probe #3: positive path

Run [`32763957329`](https://github.com/beep-effect/beep-effect/actions/runs/32763957329)
used `fleet-lane-probe.yml`, label `beep-ec2-heavy`, lane
`test-integration`, and ref `main`. It was dispatched at `18:42:58Z` and
concluded `success`. The executing instance launched at `18:43:26Z` on the
bake #3 image, as verified by `describe-instances`, and later terminated.

At `18:49:16Z`, the `Detect baked runner` step printed:

```text
baked runner fast path: bun 1.4.0, binary 33d56b07…, lockfile f81ab29f…, archive 2d03fb5f…, cache d66ccc9d…
```

The action prints that line only after all of these values match:

- checkout `bun.lock`, `.bun-version`, and `.bun-linux-x64.sha256` keys;
- installed Bun binary digest, owner `0:0`, and mode `755`;
- sealed cache digest, owner `0:0`, and mode `444`;
- the `bunx → bun` symlink.

The restored warm store then supported `bun install --frozen-lockfile`, which
reported `bun install v1.4.0`. The setup summary recorded
`Baked fast path: true`.

## Script change

`goals/ci-fleet-endgame/ops/redteam-verify.sh` now:

- accepts `[ref] [expected-ami]`, with `REDTEAM_EXPECTED_AMI` as the environment
  alternative;
- scopes deregistration and EC2 assertions to `beep-ci-<id>` when the workflow
  log yields the executing instance id, and falls back to all observed runners
  only when recovery fails;
- reads the executing instance's image once before teardown and reports the
  local `AMI_PIN` gate;
- passes `--region us-east-1` to EC2 reads; and
- anchors each required PASS count to end-of-line so the echoed command source
  is not counted.

This packet only describes that already committed script change.

## Closure-ready mapping

| Codex ID | Held finding | P1 evidence that satisfies it | State |
| --- | --- | --- | --- |
| `9459410104b881919cd820b97c673b67` | CSF-003, "Baked runner trusts mutable Bun binary" | [Bake #3](#merge-bake-guard-bake-3--deploy-2) produced a fresh sealed image keyed to `f81ab29f…`; [lane probe #3](#lane-probe-3-positive-path) admitted the fast path only after the binary and cache digest, owner, and mode checks; [lane probe #1](#lane-probe-1-stale-key-negative-path) rejected a stale lockfile key. | Open; held — closure-ready |
| `d1f026deb21881919d853e63780734fe` | CSF-009, "IMDS hook can silently remain unarmed" | [Red-team run 4](#red-team-run-4-pass) emitted exactly one `E_RUNNER_IMDS_HOOK: PASS` and `D_CONTAINER_IMDS: PASS` on a fresh post-#783 image; `AMI_PIN: PASS` binds those gates to the serving bake #3 image. | Open; held — closure-ready |

These findings are closure-ready, **not closed**. Dashboard closure waits for
the P5 remediation PR merge gate; P6 owns the closure action.

## Serving state after P1

- SSM `/beep-ci/controller/runner-ami-id` version 7 serves the bake #3 image.
- `bun.lock` at `main` revision `7d4ce3434c` has digest `f81ab29f…`, which
  matches the serving image key.
- The bake #1 image and the 2026-08-16 image remain registered as prior pins
  for mechanical rollback under the ratified stop-and-drain posture.
