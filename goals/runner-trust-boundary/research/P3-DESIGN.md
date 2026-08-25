# P3 admission defense-in-depth design

Date: 2026-08-24

Status: in progress. This change stages the reusable workflow and organization
registration. The default-branch call and runner-group workflow restriction
must land in the follow-up cutover change described below.

## Admission rule

The runner group admits a job only when all three terms are true:

```text
admit(job) = label
  ∧ repo ∈ group.selected_repos
  ∧ workflow_ref ∈ group.selected_workflows
```

`label` means the job requests the fleet's exact `beep-ec2-heavy` label set.
The controller's bidirectional label match rejects ordinary `self-hosted` jobs.
The group then limits the repository to `beep-effect/beep-effect` and the
workflow reference to one of these protected default-branch files:

- `beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main`
- `beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main`
- `beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main`

The group is defense in depth. P2's disabled metadata endpoint remains the
primary boundary for code that reaches a worker.

## Why the heavy lanes use a reusable workflow

The five EC2 lanes now live in `.github/workflows/heavy.yml` as one matrix job.
Their called job names remain `Lint Policy`, `Check`, `Test Integration`,
`Coverage Regression`, and `Docgen`. The caller's `github` context still
describes the original pull request or push, so no event inputs are needed.
The call inherits secrets; the called job retains the old push-only secret and
environment expressions.

A local reusable-workflow call resolves the called file from the caller's
commit. In a pull request, that makes the heavy steps PR-editable. The external
form `beep-effect/beep-effect/.github/workflows/heavy.yml@main` resolves the job
definition from the protected default branch while the checkout still receives
the pull-request revision. Selected-workflow admission can then allow the
default-branch reusable workflow without allowing the PR merge-ref caller.

`check.yml` keeps its existing top-level concurrency group. The called workflow
does not add a second group because GitHub gives it the caller workflow name;
reusing the same group in both places can cancel the caller. Token permissions
stay `contents: read` at the caller and called job.

## Two-PR cutover

GitHub cannot resolve the `@main` form until `heavy.yml` exists on `main`.
Therefore the first PR adds `heavy.yml` and calls it locally:

```yaml
jobs:
  heavy:
    name: Heavy
    uses: ./.github/workflows/heavy.yml
    secrets: inherit
```

After that PR merges, the follow-up PR contains this workflow-routing diff:

```diff
diff --git a/.github/workflows/check.yml b/.github/workflows/check.yml
@@
-    uses: ./.github/workflows/heavy.yml
+    uses: beep-effect/beep-effect/.github/workflows/heavy.yml@main
```

At the follow-up cutover, the operator sets runner group
`beep-ec2-heavy` to `restricted_to_workflows: true` and selects the three
`@refs/heads/main` workflow references listed above. Until then, the group
remains open to workflows and this PR's local call does not protect the heavy
steps from PR edits.

The local reusable call changes the required check contexts in this first PR.
The operator must rename the ruleset contexts before this PR can merge; the
follow-up keeps the same names:

| Previous context | Required context after cutover |
| --- | --- |
| `Lint Policy` | `Heavy / Lint Policy` |
| `Check` | `Heavy / Check` |
| `Test Integration` | `Heavy / Test Integration` |
| `Coverage Regression` | `Heavy / Coverage Regression` |
| `Docgen` | `Heavy / Docgen` |

`Heavy` comes from the caller job's explicit `jobs.heavy.name`. The `heavy` job
id does not set the displayed prefix while `name: Heavy` is present. The text
after the slash comes from the called matrix job's `name`, which is unchanged
from the old required context.

## Organization registration

The GitHub App now has organization self-hosted-runner read/write permission.
Organization group `beep-ec2-heavy` has id 4, allows public repositories, and
selects only `beep-effect/beep-effect`. Its workflow restriction stays off
until the follow-up cutover.

The controller now passes all three admission inputs to the pinned module:

- `enable_organization_runners: true`
- `runner_group_name: "beep-ec2-heavy"`
- `repository_white_list: ["beep-effect/beep-effect"]`

The module requests organization registration in the named group. If GitHub
reports that the group is absent or rejects the runner, registration fails.
There is no retry into `Default` or repository registration. `Default` also
does not admit public repositories in this organization.

## What P3 does not protect

After cutover, a pull request cannot replace the EC2 job definitions or widen
the runner group's repository and workflow lists. It can still change code,
scripts, package metadata, generated inputs, and test data consumed by the
fixed steps. A fixed `bun run beep ci lane ...` command still executes
PR-controlled repository code. P3 does not make that code trusted and does not
replace P2's workload-identity boundary, sealed AMI checks, or one-job VM
lifecycle.

## P4 JIT replay probe

`fleet-shadow-check.yml` has an operator-only `jit_replay` boolean input,
defaulting to false. With both `redteam` and `jit_replay` true, Probe M reads
the current listener's `--jitconfig` value from `/proc`, never prints it, and
runs a second `Runner.Listener` from a scratch copy of `bin` and `externals`.
It captures output in the ephemeral runner temp directory.

The probe classifies replay as rejected only when the listener log reports a
recognized server-side rejection phrase. Markers are case-sensitive and
phrase-anchored (`already registered|used|configured|exists`, `invalid
JIT|runner config|token`, `token|configuration expired`, `Unauthorized`,
`runner not found`, `access|permission denied`) so a local diagnostic that
merely contains a keyword cannot pass as a rejection. It classifies replay as
accepted when the listener reports `Listening for Jobs` or `Connected to GitHub`, or survives to the
timeout without a rejection. Every other exit is inconclusive and fails the
gate — including a marker-free non-zero exit, which reports its exit status
and redacted first log line without passing.
When an accepted payload is decodable, the probe prints only its runner name so
the operator can remove the registration.

`GATE M_JIT_REPLAY: PASS` means GitHub rejected the second listener. Accepted
or inconclusive results produce `FAIL`. Runs without `jit_replay` print
`GATE M_JIT_REPLAY: SKIPPED`; that line does not match the verifier's PASS/FAIL
gate accounting. `REDTEAM_JIT_REPLAY=1` adds the dispatch input and makes
`M_JIT_REPLAY` required for that wrapper run only.

## Rollback

For admission or registration failure, stop new admission and drain candidate
workers. Set `enable_organization_runners: false`, restore the previous launch
template version, and terminate candidates. Heavy lanes queue during repair;
they do not move to hosted runners. The organization group may remain because
repository-level registration does not place runners in it.

This is a mechanical rollback. It removes P3's organization admission and does
not satisfy the security acceptance criteria by itself.

## Proof plan

1. Read organization group id 4 through the GitHub API. Require
   `visibility: selected`, only `beep-effect/beep-effect`, public repository
   allowance, workflow restriction enabled, and exactly the three protected
   workflow references.
2. Launch one candidate and prove its registration reports runner group
   `beep-ec2-heavy`; absence or rejection of that group must leave the runner
   offline without a `Default` or repository registration.
3. Open or update a pull request and prove one heavy job reaches an assigned
   group runner through `heavy.yml@main`.
4. Dispatch a job with the fleet label from a workflow outside the allowlist.
   Require it to stay queued through the observation window and prove no fleet
   runner receives an assignment.
5. Run
   `REDTEAM_JIT_REPLAY=1 goals/ci-fleet-endgame/ops/redteam-verify.sh main`.
   Require exactly one `GATE M_JIT_REPLAY: PASS`, the complete existing gate
   set, scoped deregistration, and EC2 teardown.

Retain only sanitized group fields, workflow references, runner group names,
gate classifications, and timestamps. Do not retain the JIT value.
