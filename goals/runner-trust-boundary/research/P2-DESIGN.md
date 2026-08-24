# P2 workload identity boundary design

Date: 2026-08-24

Status: in progress. The boundary endpoint-value simulation passed live;
deployment, drain, live red-team proof (including Gate L), and the P4 JIT
replay probe remain operator work.

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
  |     |     +-- ModifyInstanceMetadataOptions(HttpEndpoint=disabled)
  |     |     `-- require 5 consecutive IPv4+IPv6 token PUT failures, max 90s
  |     +-- helper exits, so its AWS CLI credential cache dies
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

The failure path is closed. If a required IAM edge dry-run fails, the metadata
disable call fails, either endpoint succeeds often enough to prevent five
consecutive dual-endpoint denials, or the 90-second deadline expires, the shim
logs the failure, requests poweroff, exits non-zero, and never invokes
`run.module.sh`. Only the documented `other_disable: INCONCLUSIVE` result
remains admissible.

`/opt/beep/imds-disable.sh` does only these credentialed operations:

1. Obtain an IMDSv2 token.
2. Read the local instance id and region from IMDS.
3. Run the three live IAM edge dry-runs. Any `FAIL` result aborts before the
   real disable and before runner admission. The other-instance
   `InvalidInstanceID.*` result may remain `INCONCLUSIVE`.
4. Call `ec2:ModifyInstanceMetadataOptions` with
   `--http-endpoint disabled` on that instance.
5. Poll token PUTs to `169.254.169.254` and `fd00:ec2::254` until both fail for
   five consecutive one-second checks. Any successful endpoint resets the
   streak.

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
  "Sid": "DisableOwnMetadataEndpoint",
  "Effect": "Allow",
  "Action": "ec2:ModifyInstanceMetadataOptions",
  "Resource": "arn:aws:ec2:*:*:instance/*",
  "Condition": {
    "ArnEquals": {
      "ec2:SourceInstanceARN": "arn:aws:ec2:*:*:instance/${ec2:InstanceID}"
    },
    "StringEquals": {
      "ec2:MetadataHttpEndpoint": "disabled"
    }
  }
}
```

`ec2:SourceInstanceARN` is the instance that originated the role-credential
request; `${ec2:InstanceID}` is the target instance. The two match only when an
instance modifies itself. The second condition admits only the disable value.
The policy grants no describe, token, role-assumption, or general
metadata-options authority.

The first rollout (2026-08-24, launch-template v10/v11) used the module's own
self-termination shape, `"StringEquals": {"aws:ARN": "${ec2:SourceInstanceARN}"}`.
The canary reported `IMDS_EDGE self_disable: FAIL (UnauthorizedOperation)` on
every boot, and IAM Access Analyzer classifies `aws:ARN` as an unsupported
condition key, so that statement can never match. The same defect sits in the
module's self-terminate inline policy: the fleet's post-job termination has been
coming from the scale-down path, not from the guest. A bare
`${ec2:SourceInstanceARN}` in `Resource` is rejected by IAM as malformed
(`must be in ARN format or "*"`). Access Analyzer reports no findings for the
`ArnEquals` form above.

## Permissions-boundary Deny

The hand-managed `beep-ci-fleet-boundary` gains this statement:

```json
{
  "Sid": "DenyMetadataEndpointReenable",
  "Effect": "Deny",
  "Action": "ec2:ModifyInstanceMetadataOptions",
  "Resource": "*",
  "Condition": {
    "StringNotEquals": {
      "ec2:MetadataHttpEndpoint": "disabled"
    }
  }
}
```

The Deny caps every principal governed by the boundary, including later role
drift. `enabled` is explicitly denied. A request that omits
`ec2:MetadataHttpEndpoint` also satisfies `StringNotEquals` and is denied. The
checked-in v2 document preserves the current three statements and replaces the
account id in `PassOwnRoles` with `<acct>`.

`ops/imds-disable-policy-simulation.sh` renders the account placeholder into a
temporary boundary document and supplies a stand-in identity policy that
allows `ec2:ModifyInstanceMetadataOptions` on `*`. That stand-in represents the
identity-policy ceiling so the boundary v2 Deny is the only variable in three
read-only custom-policy simulations:

- `disabled` must be `allowed`;
- `enabled` must be `explicitDeny`;
- an omitted endpoint key must be `explicitDeny`.

The live simulator does evaluate `ec2:MetadataHttpEndpoint`, but it does not
resolve `${ec2:SourceInstanceARN}` from `--context-entries`: every tested
self-scoping policy shape returned `implicitDeny` with no matched statement.
The simulator therefore proves only the boundary Deny edges, not the
self-scoped identity allow. The helper's pre-disable EC2 dry-runs and Gate L
provide that live proof while IMDS role credentials are still available. Any
failed boundary simulation or required Gate L edge stops rollout. The
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

- It can invoke `imds-disable.sh` again. The IAM allow and boundary ceiling let
  that helper disable only its own endpoint, which is already disabled.
- It can invoke `self-poweroff.sh`. This can deny service only to its own
  ephemeral one-job VM. GitHub and the controller recover through normal retry
  and teardown paths.
- It can inspect command lines readable by `ec2-user`, including possible JIT
  argv residue. Probe K reports that state without disclosure; P4 owns replay.
- It can remove the owner firewall with root-equivalent access. That no longer
  restores IMDS because the EC2 metadata endpoint itself is disabled. Gate J
  still requires the owner DROP to remain armed as defense in depth.

It cannot use the new policy to enable IMDS, change another instance, or make a
metadata-options request without the endpoint key.

## Red-team and external proof

The workflow keeps Gates A through E and adds F through J and L only when
`inputs.redteam` is true. K is informational under the same input. The wrapper
requires exactly one PASS for A through J plus L, then proves
`METADATA_DISABLED`, deregistration, and terminal EC2 state. The container
probe image preflight pulls the digest-pinned reference before Gates D, G, and
H. Each container writes `PROBE_RAN` before curl and `IMDS_REACHABLE` only after
a successful token PUT. A gate accepts denial only when captured stdout has the
first marker and lacks the second, so a Docker launch failure cannot masquerade
as IMDS denial.

| Proof | SPEC properties | Finding mapping | Required result |
| --- | --- | --- | --- |
| Three boundary IAM simulations | 2, 3 | both workload-identity IDs | With an unrestricted stand-in identity policy, `disabled` is allowed while `enabled` and a missing endpoint key are explicit Denies. The simulator does not prove self-scoping. |
| Pulumi preview and controller tests | 2, 3 | both workload-identity IDs | One managed policy ARN reaches the module; launch IMDS stays enabled; every failed required IAM edge aborts; admission requires five consecutive dual-endpoint denials; rendered helper and shim pass shell syntax. |
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
| Gate L `L_IAM_EDGES` | 2, 3 | both workload-identity IDs | Before the real disable, own `disabled` dry-run is authorized, own `enabled` is denied by the boundary, and another instance is denied when EC2 checks authorization before existence. Any edge `FAIL` aborts before disable and admission; `InvalidInstanceID.*` remains explicitly inconclusive only for the other-instance edge. |
| External `METADATA_DISABLED` | 2, 3 | both workload-identity IDs | AWS reports `disabled applied` from a record in any lifecycle state. The verifier retries `InvalidInstanceID.NotFound` up to six times at five-second intervals before failing. |
| `AMI_PIN` and lane fast-path probe | 1, 4 | P1 held image finding, not the two P2 IDs | Worker matches the serving AMI from a record in any lifecycle state, using the same six-attempt describe retry, and the sealed digest/owner/mode checks pass. |
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
3. Apply boundary v2 with the recipe below and verify the new default version.
4. Run `pulumi up --refresh --yes` for the production runner stack.
5. Stop new admission long enough to drain every pre-flip runner. Do not let a
   proof job land on an older launch-template version.
6. Run `goals/ci-fleet-endgame/ops/redteam-verify.sh main` and require A through
   J plus L, `AMI_PIN`, `METADATA_DISABLED`, deregistration, and EC2 teardown.
   Gate L must prove self-disable and self-reenable exactly once. Its
   other-instance edge must PASS, or may be retained as `INCONCLUSIVE` only
   when EC2 returns `InvalidInstanceID.NotFound` or
   `InvalidInstanceID.Malformed` before authorization.
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
rendered_boundary="$(mktemp "${TMPDIR:-/tmp}/beep-ci-fleet-boundary.v2.XXXXXX.json")"
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
