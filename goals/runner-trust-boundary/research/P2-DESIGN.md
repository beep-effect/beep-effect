# P2 workload identity boundary design

Date: 2026-08-24

Status: in progress. Live canaries and throwaway-role probes corrected the IAM
condition-key model to current-state semantics. Boundary v4 deployment, drain,
live red-team proof (including Gate L), and the P4 JIT replay probe remain
operator work.

## Decision realized

P2 implements the ratified P0 fork without changing the module's bootstrap
contract. The permissions-boundary-capped instance role remains available only
while the pinned module reads instance facts and consumes its SSM configuration.
The runner cannot start until a root helper disables the metadata endpoint on
its own instance and both host endpoint probes fail for five consecutive
one-second checks.

The module still launches with `runner_metadata_options.http_endpoint` set to
`enabled`. Bootstrap requires it. The one-way change occurs inside the existing
`run.sh` invocation, after the module fetches and deletes the one-use JIT
parameter. `userdata_post_install` is too early because the module's
`start-runner.sh` still needs IMDS and role credentials after post-install.

## Boot sequence

```text
EC2 launch
  |
  |  launch template: HttpEndpoint=enabled, HttpTokens=required
  v
module user-data (root)
  |
  +-- install runner at /opt/actions-runner
  |
  +-- userdata_post_install
  |     +-- keep Gate E job-start hook
  |     +-- install /opt/beep/imds-disable.sh
  |     +-- install /opt/beep/self-poweroff.sh
  |     +-- validate two exact sudoers entries
  |     +-- move run.sh -> run.module.sh
  |     `-- install the run.sh shim
  |
  +-- start-runner.sh (root)
  |     +-- IMDSv2 token -> instance id, region, tags
  |     +-- SSM get-parameters-by-path for static config
  |     +-- SSM get-parameter --with-decryption for one-use JIT config
  |     +-- SSM delete-parameter for that instance
  |     +-- chown /opt/actions-runner to ec2-user
  |     `-- sudo -u ec2-user ./run.sh --jitconfig <one-use-value>
  |
  +-- run.sh shim (ec2-user, runner still offline)
  |     +-- sudo /opt/beep/imds-disable.sh
  |     |     +-- read local instance id and region through IMDSv2
  |     |     +-- prove own-disable and other-instance IAM edges
  |     |     +-- cache the role credentials in shell variables
  |     |     +-- ModifyInstanceMetadataOptions(HttpEndpoint=disabled)
  |     |     +-- require 5 consecutive IPv4+IPv6 token PUT failures, max 90s
  |     |     +-- prove the post-disable metadata-options lock twice
  |     |     `-- discard the cached role credentials
  |     +-- on failure: self-poweroff, exit non-zero, never start runner
  |     `-- on success: ./run.module.sh "$@"
  |
  +-- GitHub runner
  |     +-- job-start hook re-asserts the ec2-user owner DROP
  |     `-- one job executes with IMDS disabled
  |
  `-- module runner exits -> shim calls self-poweroff
        `-- guest shutdown terminates EC2 instance
```

The launch template already sets
`InstanceInitiatedShutdownBehavior=terminate`. The module's later
`terminate-instances` cleanup call is expected to lack credentials and fail
harmlessly. The termination watcher, deregistration path, and stale reaper
remain independent AWS-side cleanup controls.

## Runner shim and root helpers

`userdata_post_install` runs after the module writes the runner's original
`run.sh`. The P2 snippet moves that file to `run.module.sh` and replaces it with
a small shim. The shim calls the IMDS helper before the original runner. It
captures the original runner's status, calls the poweroff helper on every normal
runner-exit path, and returns the captured status if shutdown returns before the
guest stops.

The failure path is closed. If a required pre- or post-disable IAM edge dry-run
fails, credential capture fails, the metadata disable call fails, either
endpoint succeeds often enough to prevent five consecutive dual-endpoint
denials, or the 90-second deadline expires, the shim logs the failure, requests
poweroff, exits non-zero, and never invokes `run.module.sh`. Only the documented
`other_disable: INCONCLUSIVE` result remains admissible.

`/opt/beep/imds-disable.sh` does only these credentialed operations:

1. Obtain an IMDSv2 token.
2. Read the local instance id and region from IMDS.
3. Prove that own-disable is authorized while current state is `enabled`, and
   that another instance is not authorized. Any `FAIL` result aborts before
   the real disable and before runner admission. The other-instance
   `InvalidInstanceID.*` result may remain `INCONCLUSIVE`.
4. Read the instance-profile role name and credentials through IMDS into
   root-process shell variables. They are never logged or written to disk.
5. Call `ec2:ModifyInstanceMetadataOptions` with
   `--http-endpoint disabled` on that instance.
6. Poll token PUTs to `169.254.169.254` and `fd00:ec2::254` until both fail for
   five consecutive one-second checks. Any successful endpoint resets the
   streak.
7. Use only the cached credentials to require `UnauthorizedOperation` for both
   own-enable and own-disable dry-runs, proving the disabled-state lock is
   total, then unset the credential variables before runner admission.

It does not call `ec2:DescribeInstances`. A successful API response may still
mean the metadata-options change is pending, so only sustained local denial
lets the runner start. The external verifier separately requires AWS to report
`HttpEndpoint=disabled` and `State=applied` before teardown.

`/opt/beep/self-poweroff.sh` logs one line and executes `shutdown -P now`.
Both helpers are owned by root with mode `0755` under root-owned `/opt/beep`.
The sudoers file has one `NOPASSWD` entry per helper, is mode `0440`, and must
pass `visudo -cf` during boot. The existing Gate E sudoers file stays separate.

All post-install shell options remain inside subshells. The module passes
`userdata_post_install` through Terraform JSON, where every string is an HCL
template. `escapeHclTemplateSequences` changes shell `${...}` and `%{...}` to
`$${...}` and `%%{...}` only on module inputs. The IAM policy document below is
owned by the Pulumi AWS provider and does not pass through that bridge, so its
policy variable stays exactly `${ec2:SourceInstanceARN}`.

## IAM allow

Pulumi creates managed policy `beep-ci-runner-imds-disable` under `/beep-ci/`
and supplies its ARN through `runner_iam_role_managed_policy_arns`. It has one
statement:

```json
{
  "Sid": "DisableOwnMetadataEndpointWhileEnabled",
  "Effect": "Allow",
  "Action": "ec2:ModifyInstanceMetadataOptions",
  "Resource": "arn:aws:ec2:*:*:instance/*",
  "Condition": {
    "ArnEquals": {
      "ec2:SourceInstanceARN": "arn:aws:ec2:*:*:instance/${ec2:InstanceID}"
    },
    "StringEquals": {
      "ec2:MetadataHttpEndpoint": "enabled"
    }
  }
}
```

`ec2:SourceInstanceARN` is the instance that originated the role-credential
request; `${ec2:InstanceID}` is the target instance. The two match only when an
instance modifies itself. The second condition admits the action only while
the target instance's current endpoint state is `enabled`. After the helper
disables the endpoint, the role no longer has authority over any metadata
option on its own instance.

The requested metadata-options values are not constrainable with this action's
metadata condition keys because those keys describe current resource state.
That is acceptable here: only the root bootstrap helper calls the action, it
requests endpoint disable, and every metadata option other than the endpoint is
harmless. The policy grants no describe, token, role-assumption, other-instance,
or post-disable metadata-options authority.

## Condition-key semantics

Three operator-run findings on 2026-08-24 corrected the policy model:

1. At `2026-08-24T22:12:45Z` and `2026-08-24T22:24:09Z`, canaries using the
   module-style `aws:ARN` form and then the `ArnEquals
   ec2:SourceInstanceARN` form both logged
   `IMDS_EDGE self_disable: FAIL (UnauthorizedOperation)` on every boot.
2. During `2026-08-24T22:24Z`–`22:29Z`, IAM Access Analyzer reported `aws:ARN`
   as an unsupported condition key and a bare `${ec2:SourceInstanceARN}`
   `Resource` as malformed. It reported no finding for the `ArnEquals` form.
3. During the same `2026-08-24T22:24Z`–`22:29Z` window, throwaway-role probes
   on an instance whose endpoint was `enabled` showed that an
   `ec2:MetadataHttpEndpoint = disabled` Allow rejected both requested values,
   while an `= enabled` Allow authorized both. Thus, for
   `ec2:ModifyInstanceMetadataOptions`, `ec2:MetadataHttpEndpoint` is current
   target-instance state, not the requested value. The same state semantics
   apply to the metadata tokens and PUT response hop-limit condition-key
   family.

The old boundary therefore denied every modification while the endpoint was
enabled, blocking its own disable call. The module's self-terminate statement
is also dead because its unsupported `aws:ARN` condition can never match.
Observed post-job termination has come from the controller's scale-down path,
not that inline statement.

## Permissions-boundary Deny

The hand-managed `beep-ci-fleet-boundary` gains this statement:

```json
{
  "Sid": "DenyMetadataOptionsOnceDisabled",
  "Effect": "Deny",
  "Action": "ec2:ModifyInstanceMetadataOptions",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "ec2:MetadataHttpEndpoint": "disabled"
    }
  }
}
```

The Deny caps every principal governed by the boundary, including later role
drift. Once an instance's endpoint is disabled, no principal under the boundary
can modify any of that instance's metadata options again: this is the one-way
lock. An absent key, representing a non-instance resource, neither denies nor
allows; the role's own resource and current-state conditions gate its Allow.
The checked-in v2 filename is retained, and the document preserves the current
three statements while replacing the account id in `PassOwnRoles` with
`<acct>`.

`ops/imds-disable-policy-simulation.sh` renders the account placeholder into a
temporary boundary document and supplies a stand-in identity policy that
allows `ec2:ModifyInstanceMetadataOptions` on `*`. That stand-in represents the
identity-policy ceiling so the boundary's state-lock Deny is the only variable
in three read-only custom-policy simulations:

- current `disabled` must be `explicitDeny`;
- current `enabled` must be `allowed`;
- an omitted endpoint key, the non-instance case, must be `allowed`.

The live simulator does evaluate `ec2:MetadataHttpEndpoint`, but it does not
resolve `${ec2:SourceInstanceARN}` from `--context-entries`: every tested
self-scoping policy shape returned `implicitDeny` with no matched statement.
The simulator therefore proves only the boundary state edges, not the
self-scoped identity allow. The helper's pre-disable dry-runs and cached-
credential post-disable dry-runs provide the live proof collected by Gate L.
Any failed boundary simulation or required Gate L edge stops rollout. The
no-profile broker from `P0-MECHANISM.md` remains the mandatory fallback, not a
change this phase may make on its own.

## JIT residue status

The pinned module stores the one-use JIT configuration in a root shell variable,
deletes its SSM parameter, then passes the value as the argument following
`--jitconfig`. The P2 shim preserves that invocation so it does not redesign
the pinned module. As a result, a job may be able to read the argument from a
surviving `/proc/*/cmdline` owned by `ec2-user`. P2 does not claim that this
residue is removed.

Informational probe K scans readable process command lines for the exact
`--jitconfig` argument and emits only `JIT residue: visible` or
`JIT residue: absent`. It never prints the next argument or any command line.
The probe is non-gating because absence of the flag in that scan is not replay
proof.

P4 owns the replay probe. An operator-only candidate will retain the consumed
value only in root-owned tmpfs, wait for the original runner registration, then
attempt a second registration with that same value. GitHub must reject it. The
probe must scrub and unlink the temporary copy, terminate the candidate, and
retain only the rejection class and timestamps. The workflow must not attempt
this probe, because pull-request-visible logs and process inspection are the
wrong place to handle the value.

## What job code can still do

A job keeps passwordless sudo and Docker parity with the existing fleet, but it
cannot recover role credentials once the endpoint is disabled. The remaining
deliberate capabilities are narrow:

- It can invoke `imds-disable.sh` again. Because IMDS is already unreachable,
  the helper fails before obtaining instance facts or making an AWS request.
- It can invoke `self-poweroff.sh`. This can deny service only to its own
  ephemeral one-job VM. GitHub and the controller recover through normal retry
  and teardown paths.
- It can inspect command lines readable by `ec2-user`, including possible JIT
  argv residue. Probe K reports that state without disclosure; P4 owns replay.
- It can remove the owner firewall with root-equivalent access. That no longer
  restores IMDS because the EC2 metadata endpoint itself is disabled. Gate J
  still requires the owner DROP to remain armed as defense in depth.

It cannot use the new policy to enable IMDS, change another instance, or modify
its own metadata options after the endpoint is disabled.

## Red-team and external proof

The workflow keeps Gates A through E and adds F through J and L only when
`inputs.redteam` is true. K is informational under the same input. The wrapper
requires exactly one PASS for A through J plus L. While the assigned worker is
alive, it samples the executing instance's AMI and metadata state on every run
poll, then proves deregistration and terminal EC2 state. The run log's instance
id is a cross-check and fallback, not the primary discovery path. Terminated
instances report metadata state as `pending`; that state is not evidence that
the endpoint lock was applied. The container probe image preflight pulls the
digest-pinned reference before Gates D, G, and H. Each container writes
`PROBE_RAN` before curl and `IMDS_REACHABLE` only after a successful token PUT.
A gate accepts denial only when captured stdout has the first marker and lacks
the second, so a Docker launch failure cannot masquerade as IMDS denial.

| Proof | SPEC properties | Finding mapping | Required result |
| --- | --- | --- | --- |
| Three boundary IAM simulations | 2, 3 | both workload-identity IDs | With an unrestricted stand-in identity policy, current `disabled` is an explicit Deny while current `enabled` and a missing key are allowed. The missing key is the non-instance case; the simulator does not prove self-scoping. |
| Pulumi preview and controller tests | 2, 3 | both workload-identity IDs | One managed policy ARN reaches the module; launch IMDS stays enabled; own-disable and other-instance probes precede credential capture and disable; cached-credential own-enable and own-disable probes follow sustained denial; every failed required edge aborts; rendered helper and shim pass shell syntax. |
| Gate A `A_APP_SECRET_SSM` | 2, 3 | `c799c2269d748191997ff176ce4bfd48` | Job cannot read the GitHub App key or webhook secret. |
| Gate B `B_S3` | 2 | `c799c2269d748191997ff176ce4bfd48` | Job cannot list buckets or write the distribution bucket. |
| Gate C `C_TAILNET_LAN` | 2 | supporting isolation, neither exact ID alone | Job cannot reach the sampled tailnet or LAN targets. |
| Gate D `D_CONTAINER_IMDS` | 2, 3 | `c799c2269d748191997ff176ce4bfd48` | The digest-pinned ordinary bridged container launches, runs curl, and its token PUT fails. |
| Gate E `E_RUNNER_IMDS_HOOK` | 2, 3 | `33cd94a12d788191afbec1edc25c433f` | Existing runner-user token PUT still fails. |
| Gate F `F_ROOT_IMDS` | 2, 3 | both workload-identity IDs | Root IPv4 and IPv6 token PUTs fail. This closes the sudo path missed by CSF-006. |
| Gate G `G_HOSTNET_CONTAINER_IMDS` | 2, 3 | both workload-identity IDs | The digest-pinned host-network container launches and runs curl; IPv4 and IPv6 token PUTs fail. |
| Gate H `H_PRIVILEGED_CONTAINER_IMDS` | 2, 3 | both workload-identity IDs | The digest-pinned privileged host-network container launches and runs curl; IPv4 and IPv6 token PUTs fail. |
| Gate I `I_ROOT_STS` | 2, 3 | both workload-identity IDs | Root STS identity fails with the normal and clean environments after CLI presence is proved. |
| Gate J `J_HOOK_STILL_ARMED` | 2 | `33cd94a12d788191afbec1edc25c433f` | `.env`, hook executable, and IPv4/available-IPv6 owner DROP all remain armed. |
| Informational K `JIT_RESIDUE` | 3 | both IDs, not closure proof | Emit only `visible` or `absent`; P4 replay remains required. |
| Gate L `L_IAM_EDGES` | 2, 3 | both workload-identity IDs | While current state is enabled, own-disable is authorized and another instance is denied when EC2 checks authorization before existence. After sustained endpoint denial, cached credentials prove both own-enable and own-disable are denied by the one-way lock. Each self edge must PASS exactly once; `InvalidInstanceID.*` remains inconclusive only for the other-instance edge. |
| External `METADATA_DISABLED` | 2, 3 | both workload-identity IDs | AWS reports `disabled applied` in a sample captured while the worker is alive. If no live applied sample exists, the verifier uses the six-attempt, five-second `InvalidInstanceID.NotFound` retry and accepts only `disabled applied`; `disabled pending` from a shutting-down or terminated record is not evidence. |
| `AMI_PIN` and lane fast-path probe | 1, 4 | P1 held image finding, not the two P2 IDs | Worker matches the serving AMI sampled while it is alive, falling back to the same six-attempt post-run describe retry, and the sealed digest/owner/mode checks pass. |
| Scoped deregistration and EC2 teardown | 5 | supporting evidence for both P2 IDs | One registration maps to one VM, deregisters, powers off, and reaches terminal EC2 state. |
| Heavy-lane routing check | 1 | admission IDs remain P3-owned | Heavy pull-request lanes still use the EC2 label. |
| P3 organization runner-group proof | 6 | admission IDs, not the P2 IDs | Selected repository and default-branch workflow controls pass without fallback. |
| P4 JIT replay probe | 3 | both workload-identity IDs | Reuse is rejected, residue is scrubbed, and no value enters retained evidence. |

The P2 code narrows the claims for the two transferred findings as follows:

- `c799c2269d748191997ff176ce4bfd48` (CSF-005) needs the boundary simulation,
  live `METADATA_DISABLED`, Gates A, B, D, F, G, H, I, and L, plus teardown and
  P4 replay proof.
- `33cd94a12d788191afbec1edc25c433f` (CSF-006) needs the same primary endpoint
  proof, with Gates F and I carrying the missed sudo/root path, Gate J proving
  Gate E did not silently disappear, and Gate L proving the live one-way IAM
  edges before disable.

Neither ID is closure-ready from source changes alone.

## Rollout and rollback

Any failed simulation, preview, boot, registration, security gate, metadata
state read, lane probe, or teardown assertion stops rollout. Stop new
admission, drain in-flight candidates, and terminate candidates. Heavy lanes
queue. They do not move to hosted runners.

The previous launch-template version remains available for mechanical
recovery. Restoring an IMDS-enabled version requires a separate explicit
operator command and a packet record that names re-entry into the known-risk
state. No agent or automated failure path performs that restoration. The
previous version is retained, not silently selected.

## Operator steps

Run these steps in order:

1. Execute `ops/imds-disable-policy-simulation.sh` and require its three
   boundary-edge PASS lines. This does not prove self-scoping; Gate L does.
2. Run `pulumi preview` for the production runner stack. Confirm one managed
   policy creation, its attachment through the module input, and no unrelated
   replacement. Preview is read-only; stop if credentials or backend access are
   unavailable.
3. Apply the checked-in boundary document as boundary v4 with the recipe below
   and verify the new default version.
4. Run `pulumi up --refresh --yes` for the production runner stack.
5. Stop new admission long enough to drain every pre-flip runner. Do not let a
   proof job land on an older launch-template version.
6. Run `goals/ci-fleet-endgame/ops/redteam-verify.sh main` and require A through
   J plus L, `AMI_PIN`, `METADATA_DISABLED`, deregistration, and EC2 teardown.
   Gate L must prove self-disable, post-disable self-reenable denial, and
   post-disable self-redisable denial exactly once each. Its other-instance
   edge must PASS, or may be retained as `INCONCLUSIVE` only when EC2 returns
   `InvalidInstanceID.NotFound` or `InvalidInstanceID.Malformed` before
   authorization.
7. Dispatch the lane probe on `main`. Require the baked fast path and the
   expected serving image.
8. Retain sanitized policy, deployment, gate, lane, and teardown evidence. Do
   not retain account ids, instance ids, credentials, or JIT values.

The boundary is hand-managed and IAM retains at most five policy versions.
List versions first. If five exist, choose and delete one non-default version
by explicit version id before creating the new default. Never delete the
current default.

```sh
set -eu
account_id="$(aws sts get-caller-identity --query Account --output text)"
policy_arn="arn:aws:iam::${account_id}:policy/beep-ci-fleet-boundary"
rendered_boundary="$(mktemp "${TMPDIR:-/tmp}/beep-ci-fleet-boundary.v4.XXXXXX.json")"
trap 'rm -f -- "${rendered_boundary}"' EXIT

sed "s/<acct>/${account_id}/g" \
  goals/runner-trust-boundary/ops/beep-ci-fleet-boundary.v2.json \
  > "${rendered_boundary}"

versions_json="$(aws iam list-policy-versions --policy-arn "${policy_arn}")"
printf '%s\n' "${versions_json}" | jq .
version_count="$(printf '%s\n' "${versions_json}" | jq '.Versions | length')"
if [ "${version_count}" -ge 5 ]; then
  : "${BEEP_OBSOLETE_BOUNDARY_VERSION:?set this to one inspected non-default version id}"
  aws iam delete-policy-version \
    --policy-arn "${policy_arn}" \
    --version-id "${BEEP_OBSOLETE_BOUNDARY_VERSION}"
fi

aws iam create-policy-version \
  --policy-arn "${policy_arn}" \
  --policy-document "file://${rendered_boundary}" \
  --set-as-default
```

Leave `BEEP_OBSOLETE_BOUNDARY_VERSION` unset when fewer than five versions
exist. When five exist, set it only after inspection to a non-default version.
After creation, read the policy's default version and compare its document with
the rendered file before continuing to `pulumi up`.
