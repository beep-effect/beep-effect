# @beep/alchemy-github-runners

Ephemeral self-hosted GitHub Actions runners on EC2 Spot, declared with Alchemy and run by
Effect Lambdas. The Lambdas are a port of the `lambdas/functions/*` handlers of
[`github-aws-runners/terraform-aws-github-runner`](https://github.com/github-aws-runners/terraform-aws-github-runner)
v7.10.1, the version `infra/ci-runners/Pulumi.yaml` pins for the live fleet.

## Status

The package carries the schemas, service contracts, live layers, Lambda programs (entry points under
`src/internal/lambda/`), the runner user data, `RunnerSweep` and the `RunnerFleet` composite. Until
`@beep/alchemy-aws-extras` ships `RunnerLaunchTemplate`, the composite takes each pool's launch template as
an input built from the `RunnerLaunchSpec` it hands the caller.

## Attribution

The scale-up, scale-down, webhook dispatch, job retry, SSM housekeeper, termination watcher and
runner-binaries syncer logic is ported from `github-aws-runners/terraform-aws-github-runner`,
released under the MIT License:

```text
MIT License

Copyright (c) 2025 GitHub Terraform AWS runners
Copyright (c) 2020-2024 Koninklijke Philips N.V., https://www.philips.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Every source file that carries ported logic repeats a short notice pointing here.

## Design

Design order is schema, then service contract, then implementation. This section is the design;
the code follows it.

### Schemas

| Module | Shapes |
| --- | --- |
| `WorkflowJob.models` | The subset of GitHub's `workflow_job` webhook payload the dispatcher reads (action, job id, labels, repository, owner type, installation), the inbound webhook request (lower-cased headers plus raw body) and the response (status and body). |
| `RunnerMessages.models` | Queue messages: `ActionRequestMessage` (webhook to build queue, upstream's wire shape kept so a message survives a mixed fleet), its retry form with `retryCounter`, and `DeregisterRetryMessage` (termination watcher to its retry queue). |
| `RunnerPool.models` | Fleet and pool configuration: instance types, capacity type, allocation strategy, on-demand failover error codes, VM cap, labels and label-match mode, runner group, name prefix, minimum running time, boot time, idle count, job-retry policy, runner OS and architecture. |
| `RunnerRuntime.models` | What each Lambda decodes from its environment at cold start: webhook matchers (queue URL plus labels per pool), pool runtime config (scale-up, job retry, scale-down), housekeeper paths, termination-watcher filters, syncer target. One JSON env var per Lambda, decoded once. |
| `RunnerInstance.models` | The `ghr:*` EC2 tag vocabulary and the runner inventory row decoded from `DescribeInstances`. |
| `Ec2Events.models` | EventBridge events: `EC2 Spot Instance Interruption Warning` and `EC2 Instance State-change Notification`. |
| `SsmParameters.models` | SSM path layout: per-pool token path (one-use JIT configs keyed by instance id), the runner-group id cache, the App id, key and webhook-secret parameter names. |
| `GitHubRunners.models` | GitHub-side rows: self-hosted runner (id, name, status, busy), runner group, job status, installation token. |

### Services

| Service | Operations | Live layer |
| --- | --- | --- |
| `GitHubAppAuth` | App JWT (RS256 over WebCrypto, PKCS#1 keys wrapped to PKCS#8), installation lookup for an org or repo, installation access token | distilled GitHub `apps.*` |
| `GitHubRunners` | job status, runner group by name, JIT config, registration token, get, list and delete a self-hosted runner (org or repo scope) | distilled GitHub `actions.*` |
| `Ec2Fleet` | `CreateFleet` (instant), list runners by tag filter, terminate, tag, untag, describe by id | distilled `ec2` |
| `SsmStore` | get (decrypted), put SecureString with tags, delete, list by path | distilled `ssm` |
| `MessageQueue` | send with optional delay | distilled `sqs` |
| `RunnerBinaries` | latest `actions/runner` release asset, cached object version tag, upload | distilled GitHub `repos.getLatestRelease`, `fetch`, distilled `s3` |

Every Lambda program depends only on these contracts, so the tests run each program against
in-memory fakes with no AWS or GitHub credentials.

### Event flow

```text
GitHub workflow_job (queued)
  -> webhook Lambda (function URL): HMAC-SHA256 check, repository allow list,
     label match per pool (exact or bidirectional), SendMessage to the pool's build queue
  -> build queue (SQS, DLQ) -> scale-up Lambda (reserved concurrency 1, partial batch failures):
     group by owner, optional "still queued" check, count live runners against the VM cap,
     CreateFleet instant (Spot, capacity-optimized, instance types x subnets; on-demand failover
     on the configured error codes), JIT config per instance into SSM (tagged InstanceId),
     tag ghr:github_runner_id; messages over the cap go back as batch failures
     and the rest are published to the job-retry queue
  -> job-retry queue (delayed) -> job-retry Lambda: job still queued -> back to the build queue
  -> instance boots: user data reads its JIT config from SSM, deletes it, runs one job, powers off
scale-down Lambda (every minute): orphan sweep, idle and minimum-running-time checks,
  deregister then terminate; boot-timeout instances are tagged ghr:orphan
termination watcher (EventBridge: Spot interruption warning, state change to
  shutting-down/terminated): deregister the runner; a busy runner goes to the
  deregister-retry queue
SSM housekeeper (daily): delete token parameters older than N days
runner-binaries syncer (daily): mirror the latest actions/runner tarball into S3
```

### Composite resource graph

`RunnerFleet` declares one fleet under `Namespace.push(...)`, all shipped Alchemy primitives
except the launch template (an input until `@beep/alchemy-aws-extras` lands) and `RunnerSweep`:

```text
Fleet
  KMS.Key + KMS.Alias                       App secrets and token parameters
  SSM.Parameter x3 (SecureString)           App id, App key (base64), webhook secret: caller values
  S3.Bucket                                 runner binaries
  Lambda.Function webhook (function URL)    + inline policy: SQS send to every pool queue, SSM read
  Lambda.Function syncer + EventBridge.Rule + Lambda.Permission
  Lambda.Function housekeeper + EventBridge.Rule + Lambda.Permission
  Lambda.Function termination-watcher + EventBridge.Rule x2 + Lambda.Permission x2
    + SQS.Queue deregister-retry (+ DLQ) + Lambda.EventSourceMapping
    + kms:Decrypt with kms:EncryptionContext:PARAMETER_ARN (no KMS grant)
  IAM.Role runner + IAM.InstanceProfile    per pool
  Pool <name> (one per pool)
    SQS.Queue build + DLQ, SQS.Queue job-retry
    Lambda.Function scale-up (reserved concurrency 1) + EventSourceMapping
    Lambda.Function job-retry + EventSourceMapping
    Lambda.Function scale-down + EventBridge.Rule + Lambda.Permission
  RunnerSweep                               delete-only: terminates and deregisters what scale-up made
```

There is no autoscaling group: Spot capacity is a runtime `CreateFleet` call.

## Out of scope here

The org runner group and the GitHub App webhook URL stay outside IaC (packet decision
`2026-11-09-runner-group-app-webhook-outside-iac`). Nothing in this package reads 1Password or
mints an App; the caller supplies the secret values.
