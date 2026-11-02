# Research

## External Landscape

### 2026-10-15 — Scope, provenance, and Alchemy identity

Research only, against checkout `b536e1bba7c867c893e687562ece6c3a86536829`
(branch `docs/explore-pulumi-to-alchemy`, the merged #1833 head). No deployment,
state inspection, cloud authentication, secret resolution, or install experiment
was performed. All resource counts below distinguish source construction from
historical deployment receipts. Current cloud/service liveness is **UNVERIFIED**.
Public fetches used `curl -L --fail --silent --show-error --max-time 30` or
`--max-time 40`; fetch date throughout is **2026-10-15 UTC**. The machine-readable
[fetch receipt](research/FETCHES.json) retains URL, exit code, body size and hash,
not downloaded source bodies. The [source ledger](research/SOURCES.md) records
reuse and license discipline.

The [Alchemy website](https://alchemy.run) links to
[`alchemy-run/alchemy`](https://api.github.com/repos/alchemy-run/alchemy), whose
API reports Apache-2.0, an unarchived repository, and a push on 2026-10-15. The
[actual LICENSE](https://raw.githubusercontent.com/alchemy-run/alchemy/main/LICENSE)
confirms Apache-2.0. The [latest GitHub release](https://api.github.com/repos/alchemy-run/alchemy/releases/latest)
is **v2.0.0-beta.83**, published 2026-10-12; the
[npm registry](https://registry.npmjs.org/alchemy) independently reports
`latest: 2.0.0-beta.83` (published 2026-10-12) and `next: 2.0.0-beta.72`.
This is an actively changing **beta**, not evidence of production suitability.
The [main-branch commit response](https://api.github.com/repos/alchemy-run/alchemy/commits/main)
returned `59cc24d72f35000a673b032226568c6957f27ebb` during the sweep.

Current Alchemy is explicitly Effect-based: resource declarations collect an
Effect graph, providers are Layers, and custom providers implement reconcile,
delete, list and optional read/diff hooks. This is materially different from
older async API examples. See the fetched
[resource guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/resource.mdx)
and [custom-provider guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/custom-provider.mdx).
No upstream code was copied into this packet.

### 2026-10-15 — Runtime and TypeScript 7

The [getting-started page](https://alchemy.run/getting-started) requires Bun or
Node **24.11.1+**. The
[release launcher](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/bin/cli.js)
runs directly under Bun, hands Bun package-manager launches to Bun, and checks
Node module-hook support for the Node route. The
[Node registration code](https://raw.githubusercontent.com/alchemy-run/alchemy/main/packages/alchemy/bin/register-oxc.js)
uses the Oxc loader for user TS/TSX. The upstream
[root development runtime declarations](https://raw.githubusercontent.com/alchemy-run/alchemy/main/package.json)
list Bun 1.3.13 and Node 24 with warning enforcement; those development pins are
not a separately established minimum Bun runtime version.

The [released package manifest](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/package.json)
has **no `typescript` or `typescript-api` runtime dependency or peer dependency**;
both appear in devDependencies. The
[released workspace catalog](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/pnpm-workspace.yaml)
uses `typescript: ^7.0.2` and `typescript-api: npm:typescript@7.1.0-dev.20260905.1`.
It also retains a TS6 catalog for SvelteKit and TS5 for Next.js. Thus evidence
supports a TS7 development path and ordinary Bun execution without Pulumi's
classic compiler shim; it does **not** support claiming that Alchemy's entire
monorepo contains no older compiler or that all transitive runtime paths have
been audited. Compatibility with this repo's exact Effect/TS7 versions and a
clean dependency graph remains **UNVERIFIED** until an isolated, credential-free
compile/runtime spike. Replacing one TS6 exception must not silently introduce
framework-driven exceptions elsewhere.

### 2026-10-15 — State and secrets

The [state documentation](https://alchemy.run/state-store), also checked at the
[release tag](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/website/src/content/docs/state-store/index.mdx),
describes local `.alchemy/` files, Cloudflare Worker/Durable Object SQLite remote
state, Postgres state with a per-stack/stage advisory lock, and in-memory testing.
S3/Redis/DynamoDB are examples for implementing a custom State Layer, **not
verified built-in remote backends**. See the
[custom-store guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/state-store/custom-state-store.mdx)
and [Postgres implementation](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/PostgresState.ts).
Cloudflare state bootstraps infrastructure and keeps its authentication token
and encryption key in Cloudflare Secrets Store; selecting it would itself add
an operational dependency. No Pulumi-state importer was established by this
research; equivalent state ownership/adoption must be designed separately.

The [secret-provider guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/environments/secret-providers.mdx)
supports dotenv, process environment, Doppler, Infisical and custom Effect
ConfigProvider Layers. The [secrets guide](https://alchemy.run/environments/secrets)
describes `Config.Redacted` and cloud secret bindings. A built-in 1Password
reference resolver was **NOT FOUND** in the examined provider surface; existing
approved injection would need an explicit boundary. Crucially, **redaction is
not encryption**: release
[StateEncoding.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/StateEncoding.ts)
unwraps Redacted values for persistence, and
[LocalState.ts](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/State/LocalState.ts)
writes that encoding as JSON. Do not assume local state encrypts secrets.
Cloudflare's documented at-rest encryption does not establish the same guarantee
for every custom or Postgres backend.

### 2026-10-15 — Coverage against the actual inventory

The matrix uses the fetched, **non-truncated v2.0.0-beta.83 source tree**
([release tree API](https://api.github.com/repos/alchemy-run/alchemy/git/trees/v2.0.0-beta.83?recursive=1)),
not a generic list of supported clouds. A matching file proves an implementation
exists, not tested property compatibility, adoption safety, or operational parity.
Names in the middle column are paths relative to `packages/alchemy/src/` in that
tree. Gaps mean **NOT FOUND in that release tree**, not a claim that no third
party could implement them.

| Current use | Alchemy release implementation / gap | Migration constraint |
| --- | --- | --- |
| CI VPC, default SG, IGW, routes, subnets/associations, worker SG and egress, flow logs | `AWS/EC2/{Vpc,DefaultSecurityGroup,InternetGateway,RouteTable,Route,Subnet,RouteTableAssociation,SecurityGroup,SecurityGroupRule,FlowLog}.ts` | Egress maps to `SecurityGroupRule` with `type: egress`, not an identically named Pulumi resource; [rule source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EC2/SecurityGroupRule.ts), [flow-log source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EC2/FlowLog.ts). |
| EC2 launch template | `AWS/AutoScaling/LaunchTemplate.ts` | Its Platform abstraction also manages a role; preserve exact user-data, IMDS and AMI semantics rather than assuming structural identity. [Source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/AutoScaling/LaunchTemplate.ts). |
| CloudWatch log groups, Lambda Functions/permissions, scheduled rule + target | `AWS/Logs/LogGroup.ts`, `AWS/Lambda/{Function,Permission}.ts`, `AWS/EventBridge/Rule.ts` | Event targets are embedded in Rule props; [Rule source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/EventBridge/Rule.ts), [Lambda source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/Lambda/Function.ts). Preserve rendered reaper and three cache ZIP handlers. |
| IAM Role, RolePolicy, Policy; SSM Parameter | `AWS/IAM/{Role,Policy}.ts`, `AWS/SSM/Parameter.ts` | Inline RolePolicy maps to Role.inlinePolicies; [Role source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/IAM/Role.ts). |
| S3 bucket, public-access block, encryption, lifecycle, bucket policy, versioning | `AWS/S3/Bucket.ts` combines those concerns | [Bucket props](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/S3/Bucket.ts) include publicAccessBlock, encryption, lifecycleRules, policy and versioning; current multiple Pulumi identities become one Alchemy identity. |
| Cache HTTP API, request authorizer, integrations, five routes, stage | `AWS/ApiGatewayV2/{Api,Authorizer,Integration,Route,Stage}.ts` | Found in release tree; handler authentication/cache/writer permission contracts remain untested. |
| Optional OIP DynamoDB lock table | `AWS/DynamoDB/Table.ts` | Found; lock semantics and retention require property-level validation. |
| AWS Budget, anomaly monitor/subscription | `AWS/Budgets/Budget.ts`, `AWS/CostExplorer/{AnomalyMonitor,AnomalySubscription}.ts` | Found; account scope, notification configuration, and retained ownership still need validation. |
| Six activated cost-allocation tags | No `CostAllocationTag` managed resource found; `AWS/CostExplorer/UpdateCostAllocationTagsStatus.ts` exists | This is a Binding.Service operation, not a stateful resource; custom lifecycle work required. [Source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/CostExplorer/UpdateCostAllocationTagsStatus.ts). |
| Compute Optimizer and Cost Optimization Hub enrollments | **NOT FOUND** | Requires custom provider/API integration or deliberately separate ownership; preserve retain-on-delete behavior. |
| Six KMS grants over three module functions × two parameters | `AWS/KMS/{Key,Alias}.ts` exist; managed `Grant` **NOT FOUND** | Key coverage does not establish grant lifecycle support. |
| Terraform-backed ghaRunners provider/module | `AWS/AutoScaling/AutoScalingGroup.ts` exists; ghaRunners-compatible module **NOT FOUND** | [ASG source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/AWS/AutoScaling/AutoScalingGroup.ts) is a primitive, not the webhook, queues, scale-up/down, token handling, binary syncer and termination composite. Module replacement is a substantial gap. |
| OIP and Storybook Vercel projects; OIP env vars/domains | Vercel provider/resources **NOT FOUND** | Blocking coverage gap for a full replacement unless custom work or independent Vercel ownership is selected later. |
| OIP Cloudflare DNS records | `Cloudflare/DNS/Record.ts` | [Record source](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/Cloudflare/DNS/Record.ts); preserve imported IDs and zone/attachment gates. |
| GitHub integration | `GitHub/{Repository,Secret,Variable,Environment,Webhook,...}.ts` | [GitHub guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/github/index.mdx) covers Actions config/webhooks; no direct Pulumi GitHub provider is used locally. This does not replace the runner module. |
| AI metrics Compose and OpenClaw host scripts | `Docker/{Image,Container,Network,Volume,Service,...}.ts`, `Command/{Build,Exec,Dev}.ts` | [Docker guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/docker/index.mdx), [Command guide](https://alchemy.run/command). Docker resources alone do not replace remote SSH/systemd/Tailscale or generation activation. |
| Remote commands, local managed files and systemd units | Built-in SSH remote Command / local File / systemd resource **NOT FOUND** | `Command.Exec` can invoke local programs, including an explicit SSH client, but [its delete hook is a no-op](https://raw.githubusercontent.com/alchemy-run/alchemy/v2.0.0-beta.83/packages/alchemy/src/Command/Exec.ts). Drift, rollback and deletion need a custom provider or existing Effect command flow. |
| Custom infrastructure | Resource + Provider Layer lifecycle supported | [Custom-provider guide](https://raw.githubusercontent.com/alchemy-run/alchemy/main/website/src/content/docs/infrastructure-as-code/custom-provider.mdx); ability to implement a provider is not evidence that these gaps are thin or safe. |

ACM, Route53 and CloudFront implementations also exist in the release tree, but
**no direct use of those services was found in these five programs**. They are
not substituted into the inventory: OIP/Storybook use Vercel and OIP DNS uses
Cloudflare. The opaque runner module may have additional internals; local SDK
outputs do not prove their complete resource set.

The Terraform registry resolves the current wrapper's address to
[`github-aws-runners/terraform-aws-github-runner`](https://registry.terraform.io/v1/modules/github-aws-runners/github-runner/aws/7.10.1).
The [repository API](https://api.github.com/repos/github-aws-runners/terraform-aws-github-runner)
reports MIT; the [v7.10.1 LICENSE.md](https://raw.githubusercontent.com/github-aws-runners/terraform-aws-github-runner/v7.10.1/LICENSE.md)
confirms it. An initial `LICENSE` lookup returned 404 and was corrected using
the fetched tag directory listing. Port-with-attribution is permitted by packet
policy, with original notices retained. No Alchemy import/adoption/replacement of this
Terraform module was tested.

### 2026-10-15 — Alternatives, without choosing an approach

- **Isolate Pulumi:** a genuinely separate non-hoisted dependency tree could
  preserve a compatible compiler without patching the root TS7 resolution. This
  is a module-resolution inference, not an install proof. Pulumi's
  [shim](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/typescript-shim.ts)
  and [closure parser](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/runtime/closure/parseFunction.ts)
  still use the classic compiler API; its
  [manifest](https://raw.githubusercontent.com/pulumi/pulumi/master/sdk/nodejs/package.json)
  accepts TypeScript below 7. This contains the requirement rather than removing
  it. [License: Apache-2.0](https://raw.githubusercontent.com/pulumi/pulumi/master/LICENSE).
- **SST v3 lineage:** the redirected canonical repository is
  [`anomalyco/sst`](https://api.github.com/repositories/285092252), MIT per its
  [LICENSE](https://raw.githubusercontent.com/sst/sst/dev/LICENSE). Its
  [platform manifest](https://raw.githubusercontent.com/sst/sst/dev/platform/package.json)
  pins `@pulumi/pulumi: 3.215.0` and `typescript: 5.7.2`. It retains Pulumi and a
  classic compiler dependency; it does not provide a TS7-only exit, although its
  own pinned compiler is TS5 rather than this repo's TS6 bridge.
- **CDKTF / Terraform:** the official
  [CDKTF README](https://raw.githubusercontent.com/hashicorp/terraform-cdk/main/README.md)
  says it was sunset on 2025-12-10, with no further fixes/compatibility updates;
  [metadata](https://api.github.com/repos/hashicorp/terraform-cdk) reports archived.
  CDKTF is [MPL-2.0](https://raw.githubusercontent.com/hashicorp/terraform-cdk/main/LICENSE),
  so packet policy permits clean-room reference only. Terraform itself remains
  active ([latest release API](https://api.github.com/repos/hashicorp/terraform/releases/latest):
  v1.16.6 on 2026-10-14) and currently uses
  [BUSL-1.1](https://raw.githubusercontent.com/hashicorp/terraform/main/LICENSE),
  not CDKTF's license. Treat as reference only and assess the applicable grant
  before reuse. Terraform could preserve the runner module, but is a different
  toolchain/ownership choice, not an Effect-native replacement by itself.
- **Plain Effect CLI for host stacks:** existing render/plan/process/systemd
  bricks below could own host installation explicitly. This is an in-repo
  composition candidate, not an already existing general reconciler; state,
  idempotence, rollback and drift responsibilities would still need an owner.

## In-Repo Capability Inventory

### 2026-10-15 — Exhaustive program and stack-file inventory

Both tracked `git ls-files '*Pulumi*.yaml' '*Pulumi*.yml'` and hidden-aware file
discovery returned **five programs and ten YAML files**, including nested infra.
All five use the Pulumi Node.js runtime. Counts below exclude the implicit root
stack/default provider unless explicitly described as receipt totals.
Package ownership is `@beep/infra` (`infra/package.json`); generated SDK ownership
is `@pulumi/gharunners`; Lambda artifacts have their own standalone manifest.

| Project / entry point | Every tracked stack config | Provisioned surface and source count | Evidence of use vs dormancy |
| --- | --- | --- | --- |
| `beep-effect-ai-metrics`, `infra/Pulumi.yaml:1-5`; `infra/src/internal/ai-metrics-entry.ts:3-18` | `infra/Pulumi.beep-ai-metrics-dankserver.yaml` | `AIMetricsStack` component (`infra/src/AIMetrics.ts:513`) plus **3 remote commands** for dankserver: preflight/apply/health (`:639`, `:656`, `:669`); local target has **0 command resources** (`:628-690`). Renders files, Docker Compose, systemd, Tailscale and SSH host actions rather than direct cloud resources. | Applied historically: `goals/ai-metrics-stack/history/outputs/p6a-closeout-proof-restart.md:34-44` records six stack resources and Phoenix health. Current backend and service liveness **UNVERIFIED**. |
| `beep-ci-runners`, `infra/ci-runners/Pulumi.yaml:1-15`; `infra/src/internal/ci-runners-entry.ts:14-33` | `infra/ci-runners/Pulumi.production.yaml` | Four components: CiRunnersStack, CiFleetController, CiTurboCache, AccountCostControls. **78 direct AWS resources**, plus explicit AWS and ghaRunners providers, ghaRunners custom module, four components, implicit root/default providers and opaque module expansion. Breakdown below. | Recent operational receipts: `docs/runbooks/ci-runner-reliability.md:240-260` records 2026-10-06 saved-plan apply (2 updated/218 unchanged), then 220 unchanged. Current total **UNVERIFIED**, not inferred from 78. |
| **`opip-web`**, retained legacy project name, `infra/oip-web/Pulumi.yaml:1-5`; `infra/src/internal/oip-web-entry.ts:3-18` | `infra/oip-web/Pulumi.staging.yaml`, `infra/oip-web/Pulumi.production.yaml` | `OipWebStack` component plus **7 unconditional custom resources, up to 19 optional**. Assets S3 controls, Vercel Project/env/domains, optional DynamoDB lock table and Cloudflare records. Bootstrap state bucket is not created by this stack. `infra/src/OipWeb.ts:651-755`, `:855-1123`. | Applied historically: `goals/oip-web-production-hardening/history/outputs/oip-state-bucket-rename-evidence.md:48-60` records staging 15 / production 19 unchanged after migration. Current deployment **UNVERIFIED**. |
| `beep-openclaw`, `infra/openclaw/Pulumi.yaml:1-5`; `infra/src/internal/openclaw-entry.ts:6-27` | **NOT FOUND** | `OpenClawStack` component (`infra/src/OpenClaw.ts:2736`) plus **4 local commands**, optionally **5** with backup (`:2884-2947`). Content-addressed file generations, unit/scripts, stage/apply/probe, optional backup shipping; host actions, not direct cloud resources. | Source and runbooks exist, but `goals/openclaw-workstation-agent/README.md:51-54`, `:130-140` still lists live vertical slice, switch/rollback/drift proof pending. Definitive apply receipt **NOT FOUND**; deployment status unknown, not declared dormant. |
| `beep-storybook`, `infra/storybook/Pulumi.yaml:1-14`; `infra/src/internal/storybook-entry.ts` | `infra/storybook/Pulumi.production.yaml` | `StorybookStack` component (`infra/src/Storybook.ts:323`) plus **1 Vercel Project** (`:391`). | `goals/storybook-app/history/2026-06-07-implementation-verification.md:50-66` proves only a three-create preview, explicitly no live mutation. Live apply **NOT FOUND**; dormant/unapplied candidate, not proven absent in cloud. |

OIP's count formula: assets Bucket + four S3 control resources + Vercel Project
are six; `NEXT_DISABLE_PWA` makes seven. Optional lock table (one), six other
Vercel env vars, six domains and six zone-gated Cloudflare records add at most 19.
Vercel env helper: `infra/src/OipWeb.ts:701-725`; DNS helper/import:
`:727-755`; resource instantiation and gates: `:855-1123`. Legacy component alias
`beep:infra:OpipWebStack` remains at `:845-852`. Imports/aliases cannot be discarded
without an explicit state-identity plan.

CI source count breakdown (not a cloud-state census):

| Component | Direct resource accounting | Source |
| --- | --- | --- |
| CiRunnersStack | **29 AWS resources** from 21 constructor sites; subnet/route association helper expands over five AZs. VPC, default SG, IGW, route table/route, five subnets/associations, SG/egress, flow log and its log/IAM, launch template, reaper log/IAM/Lambda/schedule/target/permission. | `infra/src/CiRunners.ts:1249-1592`; helper calls `:1312-1343` |
| CiTurboCache | **30 AWS resources** from 26 sites, because route helper creates five routes. Bucket + public-access/encryption/lifecycle/policy; three log groups, three roles, three policies, three functions; HTTP API, authorizer, two integrations, five routes, stage, three Lambda permissions. | `infra/src/CiTurboCache.ts:264-679`; route helper `:621-641` |
| CiFleetController | **8 AWS resources**: SSM AMI parameter, IAM IMDS-disable policy, six KMS grants; explicit ghaRunners provider and Module are additional. | `infra/src/CiFleetController.ts:839`, `:856`, `:872`, `:887`, `:1040-1069` |
| AccountCostControls | **11 AWS resources**: Budget, six cost-allocation tags, two enrollment resources, anomaly monitor/subscription; explicit AWS Provider additional. Retain-on-delete applies to enrollment/tag resources. | `infra/src/AccountCostControls.ts:138-228`, especially `:201-220` |

No sixth program exists under `infra/lambda/` or the generated SDK. The runner
bridge is configured at `infra/ci-runners/Pulumi.yaml:6-13`: `terraform-module`
**0.2.2**, module `github-aws-runners/github-runner/aws` **7.10.1**.
`infra/ci-runners/sdks/ghaRunners/module.ts:9-23` defines a **CustomResource**;
its outputs (`:36-45`) expose binary syncer, termination handler/watcher, queues,
runners, SSM parameters and webhook. The provider extends ProviderResource
(`provider.ts:7`) and accepts AWS/random configuration and executor selection
(`:29-55`). Its full expanded internal resource count is **NOT DERIVABLE** from
this generated SDK; the historical fleet total is not a current module census.

`infra/lambda/turbo-cache/` owns a separate manifest and lock, outside the root
Bun workspace (`README.md:3-9`). It pins `turborepo-remote-cache@2.12.0`, bundles
Node22 CommonJS entry/read, request-authorizer and writer handlers
(`package.json:8`, `README.md:20-26`). `build.sh:12-24` runs frozen install,
checks/tests/bundle and ZIP packaging. CiTurboCache consumes a FileArchive
(`infra/src/CiTurboCache.ts:508`). Reaper source instead uses AssetArchive and
StringAsset (`infra/src/CiRunners.ts:1548-1568`). Neither is a serialized callback.

### 2026-10-15 — Providers, cross-stack edges, backend and deploy ownership

The complete direct dependency set is declared by `@beep/infra` at
`infra/package.json:49-54`. Root catalog/lock evidence:

| Package | Declared | Resolved lock |
| --- | --- | --- |
| `@pulumi/aws` | `^7.49.0`, `package.json:93` | `7.50.0`, `bun.lock:5804` |
| `@pulumi/cloudflare` | `^6.22.0`, `package.json:94` | `6.22.0`, `bun.lock:5806` |
| `@pulumi/command` | `^4.5.0`, `package.json:95` | `4.5.0`, `bun.lock:5808` |
| `@pulumi/pulumi` | exact `3.268.0`, `package.json:96` | `3.268.0`, `bun.lock:5810` |
| `@pulumiverse/vercel` | `^5.4.1`, `package.json:97` | `5.4.1`, `bun.lock:5812` |
| `@pulumi/gharunners` | local `file:ci-runners/sdks/ghaRunners`, `infra/package.json:52` | local SDK, `bun.lock:8856`; SDK requests Pulumi `^3.238.0` and TS `^6.0.3` (`package.json:10-12`) |

Custom dynamic provider implementation, `pulumi/dynamic`, `dynamic.Resource`,
`serializeFunction`, and CallbackFunction: **NOT FOUND** in infra source search.
Executing StackReference: **NOT FOUND**. Five occurrences are JSDoc examples only
(`infra/src/internal/ci-runners-entry.ts:68`, `:86`, `:104`, `:122`, `:140`).
Ordinary Output.apply dataflow closures do exist; that is not evidence of
function serialization. Generated CustomResource/ProviderResource and in-repo
ComponentResource classes are distinct from dynamic providers.

CI backend evidence names `s3://oip-law-pulumi-state`
(`goals/speed-loop/research/runner-secrets.md:97-98`;
`docs/runbooks/ci-runner-reliability.md:208-214`). OIP's rename receipt records
backend login and both stack applies, and archives/deletes the legacy source
bucket (`goals/oip-web-production-hardening/history/outputs/oip-state-bucket-rename-evidence.md:41-60`).
Do not infer the current backend from an older bucket name or treat OIP's assets
bucket as its state bucket. Exact currently selected AI metrics/OpenClaw/
Storybook backend URLs: **NOT FOUND**. No local Pulumi login or backend state
was read. `PULUMI_BACKEND_URL` in captured TS7 proof recipes is a disposable
local file backend, not proof of production backend selection (`CAPTURE.md`).

Deployment evidence is runbook/manual/tool driven. No Pulumi deploy step was
found in `.github/workflows/`; `.github/workflows/check.yml:347` references runner
image validation, not a Pulumi deployment. CI deploy recipe and receipt are in
`docs/runbooks/ci-runner-reliability.md:208-260`; OIP login/apply receipt is above;
AI metrics remote apply/reconcile is recorded in
`goals/ai-metrics-stack/history/outputs/p5b-real-pulumi-remote-apply.md:24-43`.
OpenClaw procedures are at
`goals/openclaw-workstation-agent/ops/handoffs/p2-slice-proof-runbook.md:104-140`
and `p3-live-agent-runbook.md:88`; Storybook is preview-only in the located receipt.
No general `beep infra/deploy/pulumi` command registration was found. `beep runners`
exists for AMI baking and emits a Pulumi pin command
(`packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:72-82`);
it is not a replacement stack deployer.

The exact checked-in invocation evidence is:

| Program | Deployment entry and source (commands documented, not executed here) |
| --- | --- |
| AI metrics | Work in `infra`; preview/up select `beep-ai-metrics-dankserver`; passphrase supplied out of band. `goals/ai-metrics-stack/history/outputs/p5b-real-pulumi-remote-apply.md:83-91`. |
| CI runners | Work in `infra/ci-runners`; production stack, S3 login and existing env wrapper; saved preview then plan apply. `docs/runbooks/ci-runner-reliability.md:205-221`, `:247-254`. |
| OIP | Login to `s3://oip-law-pulumi-state`, staging preview/up followed by production preview/up. `goals/oip-web-production-hardening/PLAN.md:62-70`; destination-login renderer in `ops/migrate-oip-state-bucket.ts:573` in that packet. |
| OpenClaw | Work in `infra/openclaw`; initialize workstation, configure identity and preview/up in an armed PTY. `goals/openclaw-workstation-agent/ops/handoffs/p2-slice-proof-runbook.md:66-105`; procedure is not proof of execution. |
| Storybook | Work in `infra/storybook`; injected-env production preview. `goals/storybook-app/history/2026-06-07-implementation-verification.md:40-47`; no located apply receipt. |

Tracked-text scans found no implementation wiring `PULUMI_BACKEND_URL`,
`PULUMI_HOME`, `.pulumi/credentials`, or a backend-lookup helper. The documented
login and external operator environment select the backend. Existing
`beep ai-metrics install apply` is **dry-run-only**, explicitly leaving real
mutation to Pulumi (`packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1159`).
Runner baking reads production YAML and emits a config pin suggestion
(`Runners.service.ts:821`, `:860`), not a deploy.

### 2026-10-15 — Secrets and checked-in configuration boundaries

Only reference/configuration **names** are recorded below: no reference URI,
resolved value, encrypted ciphertext, account ID, host identity or credential.
An `encryptionsalt` or a secret-reference field alone is not proof that arbitrary
string configuration is encrypted.

| Program | Secret mechanism and names | Source |
| --- | --- | --- |
| AI metrics | `aiMetrics:hashSaltSecretRef`, `rawArchiveKeySecretRef` are reference-name configuration; target/SSH/remote-root/Tailscale options select remote installation. Stack YAML includes encryptionsalt; no `secure` object in scanned structure. | `infra/Pulumi.beep-ai-metrics-dankserver.yaml:2-15`; render/apply flow `infra/src/AIMetrics.ts:97-196`, `:639-680` |
| CI fleet/cache/cost | SSM/KMS indirection via `githubAppIdSsmParameterArn`, `githubAppKeyBase64SsmParameterArn`, `githubAppWebhookSecretSsmParameterArn`, `githubAppKmsKeyArn`, `readOnlyTokenSsmParameterArn`, `tokenKmsKeyArn`, `trustedWriteTokenSsmParameterArn`, `writerSharedSecretSsmParameterArn`; `accountCostControls:notificationEmailAddresses` uses an encrypted `secure` object. ZIP paths and AMI/runner-label values are deployment inputs, not secret reads. | `infra/ci-runners/Pulumi.production.yaml:3-27`; KMS grants `infra/src/CiFleetController.ts:1040-1069` |
| OIP | `oipWeb:hubSpotServiceKey` is encrypted in both checked-in stack configs. Runtime loader uses `config.getSecret` for `hubSpotServiceKey` and optional `sanityApiToken`; token absent from checked-in configs. | `infra/oip-web/Pulumi.production.yaml:23-24`; staging `:21-22`; `infra/src/OipWeb.ts:613-619` |
| OpenClaw | `gatewayAuthTokenRef`, `telegramBotTokenRef`, `hostedProviderApiKeyRef`, `backupPassphraseSecretRef` are names loaded with config.get, with actual resolution delegated to generated resolver/runtime. Resolver binary/path/trust and expected-host identity fields constrain that boundary. Command stdout outputs are Pulumi-secret marked. | `infra/src/OpenClaw.ts:2657-2693`, `:2951-2969`; entry `infra/src/internal/openclaw-entry.ts:12-27` |
| Storybook | Production stack config contains only encryptionsalt; non-secret project build/install/repository defaults live in project YAML. Credentials come from documented injected environment, not stack plaintext inventoried here. | `infra/storybook/Pulumi.production.yaml:1`; project `Pulumi.yaml:7-14`; preview receipt `goals/storybook-app/history/2026-06-07-implementation-verification.md:40-47` |

The Pulumi passphrase environment-key mapping is documented at
`docs/runbooks/onepassword-beep-secrets-layout.md:70`; values and reference URIs
are intentionally omitted. Operational coupling outside infra also includes
`docs/runbooks/aws-cost-operations.md:190`, `:263`, `:296-301`, `:385`, `:586`,
`:639` (retention/adoption/AMI/deploy), and
`docs/runbooks/ci-runner-reliability.md:272-288` (drift/refresh and KMS ordering).
These are migration/runbook obligations, not extra Pulumi programs.

Git history confirms recent maintenance/use signals without cloud verification:
`721d1239b1` (2026-10-05, runner Spot type fix #1422), `77bc3c9184` (2026-10-05,
runbook apply receipt #1450), `a69b1956ee` (2026-10-01, capacity-optimized pools
#1364), `702e815971` (2026-09-09, cost guardrails #1055), `690fdd17d6`
(2026-08-24, IMDS before admission #800). #1833 changes compiler compatibility;
that commit alone does not establish any stack is unused.

### 2026-10-15 — Remaining TypeScript 6 obligations after #1833

The capture's hoped-for removal is broader than the Pulumi migration actually
proves. `docs/runbooks/typescript-toolchain.md:185-211` explicitly records
remaining classic-API consumers; its table at `:12-14` records bridge ownership.

| Remaining surface | Evidence / required distinction |
| --- | --- |
| Infra compiler and generated SDK | `infra/package.json:65`: TS `^6.0.3`; SDK `infra/ci-runners/sdks/ghaRunners/package.json:12`: same. Lock `bun.lock:8858` resolves infra TS 6.0.3. |
| Root + scratchpad bridge | `package.json:46`, `:285`; `scratchpad/package.json:96`: `@typescript/typescript6` catalog 6.0.2. `bun.lock:6348` bridge depends on `@typescript/old: npm:typescript@^6`, resolved TS 6.0.3 at `:6306`. Root native TS remains `^7.0.2` (`package.json:45`, `:248`). |
| Patched Pulumi runtime | `patches/@pulumi%2Fpulumi@3.268.0.patch:10-18`, `:31-33` redirect tsutils/shim to bridge; registered `package.json:366`, `bun.lock:3616`. Pulumi optional TS peer is `<7` (`bun.lock:5810`). |
| Syncpack holds | `syncpack.config.ts:174-182` holds Pulumi exact version for patch; `:205-212` permits infra TS6 divergence until migration. |
| Install/build coupling | Root `infra:prepare-gha-runners` uses `infra/node_modules/typescript/bin/tsc` (`package.json:419`), invoked by root postinstall (`:434`); infra coverage builds SDK first (`infra/package.json:34`). SDK `scripts/build.js:24-40`, `:53-59` rejects compiler major other than 6 and executes that compiler. |
| Classic API codemods independent of Pulumi | `goals/schema-opaque-default/ops/codemod/codemod.ts:11`, `fixup.ts:35`, `scratchpad/.jsdoc-loop/census.ts:8` import the bridge. **Still remain if infra alone migrates.** |
| Frozen ontology replay | `docs/runbooks/typescript-toolchain.md:205-208` retains an older compiler reproduction requirement; distinguish historical replay from active workspace pins. |

No additional non-fixture workspace manifest declaring a Pulumi provider was
found in the targeted manifest sweep. Documentation and historical packet
mentions are evidence/recipes, not extra executable stacks. Deleting history to
make a text search for “TS6” empty is not an established migration requirement.

### 2026-10-15 — Existing Effect-native building blocks

| Package / brick | Source evidence | Disposition and boundary |
| --- | --- | --- |
| `@beep/repo-cli` subprocess execution | `packages/tooling/tool/cli/src/internal/process/StepExec.ts:1073` runCaptured, `:1190` runCapturedStreams, `:1281` runToExit, `:1323` ensureZeroExit; result schemas `:87-166` | **REUSE** CLI-internal Effect ChildProcess/Spawner, typed timeout/bounded capture/cleanup/admission; avoid another shell-runner abstraction. |
| `@beep/repo-utils` argv guards | `packages/tooling/library/repo-utils/src/ProcessArgs.ts:131`, `:171`, `:202`, `:238`, `:270` | **REUSE** end-of-options and literal-argument construction. |
| `@beep/repo-cli` systemd schemas/helpers | `internal/systemd/SystemdUnit.schemas.ts:101-161`; `SystemdUnit.ts:43-305` under `packages/tooling/tool/cli/src/` | **REUSE** validated paths/directives, unit Bun path, user-unit dir, parsing, environment-file and installed-unit reads; internal, not a new public generic renderer. |
| Specialized CLI timer rendering/install | `commands/Graft/GraftDeep.service.ts:502-553`; `commands/Refs/Refs.service.ts:621`, `:684-687`; `commands/Research/internal/Timers.ts:86-130`, `:216` under the same CLI root | **EXTEND/EXTRACT** existing render/write/reload flows; specialized ownership must remain explicit. |
| `@beep/repo-ai-metrics` typed install plans | `packages/tooling/library/ai-metrics/src/install.ts:370`, `:484`, `:548`, `:1348`, `:1413` | **REUSE** spec, steps, plan and dry-run separation. |
| `@beep/repo-ai-metrics` forwarder timer plan | `packages/tooling/library/ai-metrics/src/forwarder.ts:790`, `:854`, `:966` | **REUSE** package-level pure systemd rendering and plan schemas. |
| `@beep/openclaw` systemctl service | `packages/drivers/openclaw/src/OpenclawSystemd.service.ts:86-94`, `:229`, `:247-252` | **REUSE/EXTEND** reload/enable/disable/restart/show/start/stop through live Effect spawner; OpenClaw-specific. |
| `@beep/repo-cli` runner deployment tooling | `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:206-238`, `:911`; `Runners.command.ts:72-82` | **REUSE** existing AMI baking operation and report; does not reconcile the fleet. |
| `@beep/infra` OpenClaw generation and renderers | `infra/src/OpenClaw.ts:710` intent, `:1205` hash, `:1268` generation, `:1355` unit, `:1429` run, `:1532` tree, `:1601` preflight, `:1737` stage, `:1869` apply, `:1991` rollback, `:2145` drift, `:2204` probe, `:2279` acceptance, `:2382` backup | **EXTRACT** existing behavior before rewriting; current containing module imports Pulumi, so importing it unchanged would retain the dependency. |
| `@beep/infra` AI metrics rendering | `infra/src/AIMetrics.ts:97` Compose, `:113` systemd, `:141` preflight, `:160` apply, `:196` health | **EXTRACT** file-local pure renderers and preserve remote execution/health semantics. |

First-party Alchemy imports under `packages/**`: **NOT FOUND**. A general shared
systemd renderer package, general deploy command, and first-party cloud
state/reconciliation engine: **NOT FOUND** in the bounded reuse searches.
Existing unit renderers and process runners do not establish those capabilities.

## Constraints Discovered

### 2026-10-15 — Constraints and evidence limits

1. **Full-provider parity is absent.** Vercel, runner-module semantics, KMS grants,
   cost enrollments and managed cost-tag lifecycle need explicit treatment.
   A custom provider extension point does not make each gap a thin adapter.
2. **State identity is a first-order migration boundary.** Preserve OIP's legacy
   project/component aliases/imported DNS, bootstrap-managed backend, fleet
   module ownership and retained account resources. No state export/import,
   replacement plan or no-recreate proof is established here.
3. **Host orchestration is already substantial code.** AI metrics remote SSH
   and OpenClaw generations/rollback/drift/backup cannot be replaced by generic
   command success alone; Alchemy Exec delete is a no-op.
4. **Secret/state guarantees vary by backend.** Local Alchemy persistence can
   contain unwrapped secret data. Preserve approved injection, secret-marked
   Pulumi outputs, host files and remote-state access boundaries. This packet
   names references/configuration only and contains no resolved secrets.
5. **Compiler exit has separate obligations.** Pulumi/SDK removal may release
   infra's TS6 and patch, but codemod/census bridge imports survive. Alchemy's
   TS7 manifest is encouraging evidence, not this checkout's compatibility proof.
6. **Evidence is bounded.** Static counts exclude implicit and opaque module
   expansion. Receipts establish past actions; none establish current stacks,
   backend selection, resource count, drift or runtime health. No cloud/API
   credential operations were authorized for this stage.
7. **Version/license selection matters.** Latest Alchemy is beta. Permissive
   sources permit port-with-attribution; missing/version-unverified licenses
   remain reference-only. CDKTF is sunset; Terraform BUSL requires its own review.

### 2026-10-15 — Candidate align-stage questions (unanswered)

These are a research handoff, **not decisions or an implementation plan**. Their
short forms are mirrored in `ops/manifest.json` exploration.openQuestions.

1. Is the target zero active TS6 dependencies, or only removal of Pulumi's root
   hoisting/patch exception, with codemod/census/replay handled separately?
2. Should host-local AI metrics/OpenClaw ownership move to existing Effect CLI
   plans, Alchemy custom resources, or remain separate from the cloud migration?
3. Is full Pulumi removal required, or may Vercel and the Terraform runner
   module remain isolated while proven cloud primitives migrate incrementally?
4. What scope and appetite cover Vercel, KMS grants, cost enrollments/tags and
   the runner-module replacement gaps?
5. Which Alchemy version, Effect version, runtime and credential-free TS7 spike
   would establish an acceptable compatibility/maintenance baseline?
6. Which state backend, concurrency/locking, secret encryption, backup and
   recovery guarantees are required for local and CI deploys?
7. What evidence and later operational authorization must precede adopting
   existing resource identities without recreation, loss of retention, or
   dual ownership?
8. Which stacks are still desired, and what later live inventory would distinguish
   active CI/OIP/AI metrics from unproved Storybook/OpenClaw deployment state?
9. What first reversible vertical slice and acceptance evidence would test the
   chosen direction without making the fleet/state migration the first experiment?

## 2026-11-02 — Reopened research

### 2026-11-02 — Scope and what changed since the 10-15 kill

Research only, on checkout `cda8f0d199` (branch `claude/explore-pulumi-to-alchemy-40ee3a`
off `main`). No `pulumi` or `alchemy` command ran, no cloud credential or 1Password reference
was resolved, no infra file was changed. Alchemy coverage is verified against the local
reference checkout (`$HOME/YeeBois/references/effect/alchemy` at `450702936d`, 2026-11-01,
`v2.0.0-beta.84` + 246 commits) and the fetched [llms.txt](https://alchemy.run/llms.txt);
receipts are in [research/FETCHES.json](research/FETCHES.json) and
[research/SOURCES.md](research/SOURCES.md) section 6. Deployment and liveness claims below are
read from repo receipts and are **UNVERIFIED** against live cloud state, as on 10-15.

Deltas since the 2026-10-15 sections:

| Area | 2026-10-15 | 2026-11-02 |
| --- | --- | --- |
| TS6 coupling | root `patches/@pulumi%2Fpulumi@3.268.0.patch` redirects the hoisted runtime to the `@typescript/typescript6` bridge; syncpack holds `@pulumi/pulumi` exact | Patch gone; `@pulumi/pulumi` is `3.273.0` in the catalog with no hold. Every infra `Pulumi.yaml` preloads `infra/pulumi-typescript6.cjs` through `runtime.options.nodeargs`, which resolves `typescript` to infra's nested `^6.0.3`. Syncpack keeps one version group for that pin (`syncpack.config.ts:153-163`). Root `postinstall` still runs `infra:prepare-gha-runners` with `infra/node_modules/typescript/bin/tsc`, so **every `bun install` in the repo compiles with TypeScript 6** |
| Pulumi programs | five | **six**: `infra/turbo-cache-lab/Pulumi.yaml` (disposable conformance lab reusing `CiTurboCache`; `lab-aws.sh` wraps `pulumi stack init` and `config set`) |
| CiTurboCache | 30 direct resources | +`aws.sns.Topic`, `aws.sns.TopicSubscription`, `aws.cloudwatch.MetricAlarm` (#2252 throttle alarm) |
| Alchemy in the repo | none | **three live stacks**: `apps/beep-effect-web/alchemy.run.ts` (`BeepEffectWeb`, `Cloudflare.Website.Vite`, `Cloudflare.state()`, CI deploy on `main`, first green run 41244684210, site live at beep-effect.com) and `infra/r2-cache/` (`BeepTurboR2Pilot`, `BeepTurboR2SignedCredentials`, run from a frozen tool clone of Alchemy commit `95f1581` with local state under `$HOME/.local/state/beep/r2-cache/alchemy`). Catalog pins `alchemy` and `@alchemy.run/cloudflare` at `2.0.0-beta.84` |
| Alchemy release | `2.0.0-beta.83` (2026-10-12) | `latest` `2.0.0-beta.84` (2026-10-24); main is 246 commits ahead with no newer tag |
| Pulumi upstream TS7 | not checked | `sdk/nodejs` optional peer is still `typescript >= 3.8.3 < 7`; an issue-title search for "typescript 7" in pulumi/pulumi finds nothing relevant (E71). No upstream TS7 support is in flight |

What `goals/beep-effect-web-alchemy` learned (SPEC decision log and reflection), relevant here:
per-package stacks are Alchemy's own guidance for different deploy cadences; `Cloudflare.state()`
documents no lock, so prod deploys run only in CI under a concurrency group and the stack
refuses `prod` without `CI=true`; the state store needs a registered workers.dev subdomain
(Cloudflare error 10007); the shared IaC token lacked Secrets Store, Workers domains and ruleset
scopes, so a dedicated least-privilege token was minted; Alchemy adopts nothing it cannot prove
it owns; credentials flow through `op run`, never `alchemy profile`. "Most of the time went to
repo gates, not to Alchemy."

### 2026-11-02 — Alchemy as of the checkout (source-verified)

- **Packaging.** Split provider packages under `@alchemy.run/*`: `aws`, `cloudflare`,
  `cloudflare-runtime`, `docker`, `kubernetes`, `github`, `git`, `hetzner`, `fly`, `railway`,
  `gcp`, `neon`, `planetscale`, `turso`, `redis`, `sql`, `prisma`, `drizzle`, `stripe`, `axiom`,
  `acme`, `domain`, `doppler`, `infisical`, `better-auth`, `frontend-frameworks`, `test`. **No
  `vercel` package**; the 37 "vercel" hits in `packages/` are OIDC audience strings, Next.js
  source detection and test fixtures.
- **TypeScript.** Workspace catalog `typescript: ^7.0.2`; a `typescript-classic: 6.0.3` catalog
  exists only for SvelteKit and TS5 for Next.js. `packages/alchemy/package.json` has no
  `typescript` dependency or peer. Peer `effect ^4.0.5`; the repo catalog is `effect 4.1.1`
  and the lock already resolves it for beep-effect-web.
- **State stores** (`alchemy/src/State/`, `aws/src/StateStore/`, `cloudflare/src/StateStore/`):
  local `.alchemy/`; Cloudflare Durable Object SQLite (encrypted, keys in Secrets Store, **no
  stage lock**); **AWS S3** via `BucketState` with a per-`(stack, stage)` `__lease__.json`
  written by conditional put, 60 s TTL, refreshed by the holder, so a second deploy fails fast
  (new since 10-15; `alchemy state bootstrap --backend aws` provisions the bucket in CI);
  **AWS DynamoDB** with an S3 overflow bucket and `alchemy state migrate` from S3; Postgres as
  the documented custom-store example; in-memory for tests.
- **Adoption** (`AdoptPolicy.ts`, `cli/adopting-resources.mdx`): with no prior state the
  engine calls the provider's `read`; an owned or ownership-less resource is adopted silently,
  an `Unowned` one fails with `OwnedBySomeoneElse` unless `--adopt`/`adopt(true)`. Recovery of
  a wiped store needs no flag. **No Pulumi (or Terraform) state importer exists**; the only
  "pulumi" mentions are prose in blog posts and the binding guide.
- **Commands** (`alchemy/src/Command/`): `Build`, `Exec`, `Dev`, `Local`, `Memo`, with env
  redaction (`Redaction.ts`). `Exec.delete` is still `Effect.void` (`Exec.ts:127`). **No remote
  or SSH command.** `hetzner/src/Ssh.ts` is an exec/scp client over `effect/process`, but it is a
  Hetzner `Server` binding that uses the server's Alchemy-managed deploy key. `aws/src/Bootstrap/Ec2.ts`
  renders a systemd unit only for the hosted `AWS.EC2.Instance` program; there is no general
  systemd or managed-file resource.
- **GitHub** (`github/src`): `Repository`, `Secret(s)`, `Variable(s)`, `Environment`, `Webhook`,
  `Ruleset`, `BranchProtection`, `Release`, `Label`, `Milestone`, `TeamAccess`,
  `PersonalAccessToken`, issue and PR actions. Nothing about self-hosted runners.
- **Terraform.** No module bridge; "terraform" appears only in comments.
- **CLI**: `deploy`, `plan`, `destroy`, `drift` (re-observe and optionally repair), `nuke`,
  `state`, `dev`, `logs`, `profile`, `--adopt`.

### 2026-11-02 — Coverage matrix, resource by resource

Left column: every `new <provider>.<Resource>(` site in `infra/src/*.ts` (construction sites,
with instance multipliers where a helper loops). Middle: the Alchemy resource in the checkout,
as a path under `packages/aws/src/` or `packages/cloudflare/src/`, or **GAP**. A match means an
implementation exists; property parity and adoption behaviour are untested. "Merge" means several
Pulumi identities become one Alchemy identity, which matters for adoption (one `read`, one state
row).

**`beep-ci-runners` / `CiRunnersStack`** (`infra/src/CiRunners.ts`)

| Pulumi resource | Alchemy | Note |
| --- | --- | --- |
| `aws.ec2.Vpc` | `AWS/EC2/Vpc.ts` | |
| `aws.ec2.DefaultSecurityGroup` | `AWS/EC2/DefaultSecurityGroup.ts` | |
| `aws.ec2.InternetGateway` | `AWS/EC2/InternetGateway.ts` | |
| `aws.ec2.RouteTable`, `aws.ec2.Route` | `AWS/EC2/RouteTable.ts`, `AWS/EC2/Route.ts` | |
| `aws.ec2.Subnet` ×5, `aws.ec2.RouteTableAssociation` ×5 | `AWS/EC2/Subnet.ts`, `AWS/EC2/RouteTableAssociation.ts` | |
| `aws.ec2.SecurityGroup` | `AWS/EC2/SecurityGroup.ts` | |
| `aws.vpc.SecurityGroupEgressRule` | `AWS/EC2/SecurityGroupRule.ts` | different resource name and shape (`type: egress`) |
| `aws.ec2.FlowLog` | `AWS/EC2/FlowLog.ts` | |
| `aws.cloudwatch.LogGroup` ×2 | `AWS/Logs/LogGroup.ts` | |
| `aws.iam.Role` ×2, `aws.iam.RolePolicy` ×2 | `AWS/IAM/Role.ts` (`inlinePolicies`, `managedPolicyArns`, `permissionsBoundary`) | **merge**: RolePolicy folds into Role |
| `aws.ec2.LaunchTemplate` | `AWS/AutoScaling/LaunchTemplate.ts` (`imageId`, `instanceType`, `userData`, `metadataOptions`) | verify block-device and IMDS parity; its Platform variant also manages a role |
| `aws.lambda.Function` (reaper; `pulumi.asset.AssetArchive` + `StringAsset`) | `AWS/Lambda/Function.ts` | Alchemy bundles from an Effect program or takes `bundle: false` with `handler`/`runtime` (`nodejs22.x`/`nodejs24.x`); inline-string code becomes a bundle directory |
| `aws.lambda.Permission` | `AWS/Lambda/Permission.ts` | |
| `aws.cloudwatch.EventRule`, `aws.cloudwatch.EventTarget` | `AWS/EventBridge/Rule.ts` (`scheduleExpression`, embedded targets; `ToLambda.ts`) | **merge**: target folds into rule |

**`beep-ci-runners` / `CiTurboCache`** (`infra/src/CiTurboCache.ts`; also the whole
`beep-turbo-cache-lab` program)

| Pulumi resource | Alchemy | Note |
| --- | --- | --- |
| `aws.s3.Bucket`, `BucketPublicAccessBlock`, `BucketServerSideEncryptionConfiguration`, `BucketLifecycleConfiguration`, `BucketPolicy` | `AWS/S3/Bucket.ts` (`publicAccessBlock`, `encryption`, `lifecycleRules`, `policy`, `versioning`) | **merge** 5→1 |
| `aws.cloudwatch.LogGroup` ×3 | `AWS/Logs/LogGroup.ts` | |
| `aws.iam.Role` ×3, `aws.iam.RolePolicy` ×3 | `AWS/IAM/Role.ts` | **merge** |
| `aws.lambda.Function` ×3 (`pulumi.asset.FileArchive` of a prebuilt zip under `BEEP_INFRA_ARTIFACTS_ROOT`) | `AWS/Lambda/Function.ts` | needs the prebuilt-zip path (`bundle: false`); verify zip-from-path and `reservedConcurrentExecutions` |
| `aws.lambda.Permission` ×3 | `AWS/Lambda/Permission.ts` | |
| `aws.apigatewayv2.Api`, `Authorizer` (REQUEST), `Integration` ×2, `Route` ×5, `Stage` | `AWS/ApiGatewayV2/{Api,Authorizer,Integration,Route,Stage}.ts` (`authorizerType: "REQUEST"`, `identitySource`) | `HttpApi.ts` is a higher-level alternative |
| `aws.sns.Topic`, `aws.sns.TopicSubscription` | `AWS/SNS/Topic.ts`, `AWS/SNS/Subscription.ts` | |
| `aws.cloudwatch.MetricAlarm` | `AWS/CloudWatch/Alarm.ts` | |

**`beep-ci-runners` / `CiFleetController`** (`infra/src/CiFleetController.ts`)

| Pulumi resource | Alchemy | Note |
| --- | --- | --- |
| `aws.ssm.Parameter` | `AWS/SSM/Parameter.ts` | |
| `aws.iam.Policy` | `AWS/IAM/Policy.ts` | |
| `aws.kms.Grant` ×6 | **GAP** | `AWS/KMS/` has `Key`, `Alias`, `KeyBinding` and crypto operations; no managed Grant |
| `gharunners.Module` (`terraform-module` 0.2.2 → `github-aws-runners/github-runner/aws` 7.10.1; ~220 live resources per the 2026-10-06 receipt) | **GAP** | no Terraform-module bridge; `AWS/AutoScaling/AutoScalingGroup.ts`, `Lambda`, `SQS`, `EventBridge`, `SSM` primitives exist, but the webhook/scale-up/scale-down/syncer/termination-watcher composite does not |
| `gharunners.Provider`, `aws.Provider` | `AWS.providers()`, `Region.of` | provider pinning is a Layer, not a resource |

**`beep-ci-runners` / `AccountCostControls`** (`infra/src/AccountCostControls.ts`)

| Pulumi resource | Alchemy | Note |
| --- | --- | --- |
| `aws.Provider` (explicit `us-east-1`) | `Region.of("us-east-1")` layer | |
| `aws.budgets.Budget` | `AWS/Budgets/Budget.ts` (`notificationType`, subscribers) | |
| `aws.costexplorer.AnomalyMonitor`, `AnomalySubscription` | `AWS/CostExplorer/AnomalyMonitor.ts`, `AnomalySubscription.ts` | |
| `aws.costexplorer.CostAllocationTag` ×6 | **GAP** (thin) | only the `UpdateCostAllocationTagsStatus` action exists; a custom resource over it is small. Retain-on-delete today |
| `aws.computeoptimizer.EnrollmentStatus` | **GAP** | no `ComputeOptimizer` service directory |
| `aws.costoptimizationhub.EnrollmentStatus` | **GAP** | no `CostOptimizationHub` service directory |

**`opip-web` / `OipWebStack`** (`infra/src/OipWeb.ts`)

| Pulumi resource | Alchemy | Note |
| --- | --- | --- |
| `aws.s3.Bucket`, `BucketPublicAccessBlock`, `BucketServerSideEncryptionConfiguration`, `BucketPolicy`, `BucketVersioning` | `AWS/S3/Bucket.ts` | **merge** 5→1; assets bucket `assets.oip.law` / `staging-assets.oip.law` |
| `aws.dynamodb.Table` (optional Pulumi S3-backend lock table) | `AWS/DynamoDB/Table.ts` | purpose disappears under Alchemy (S3 state has its own lease) |
| `vercel.Project` (Next.js, `cd ../.. && bun run --cwd apps/oip-web build:pwa`, git repository, deployment authentication) | **GAP** | no Vercel provider |
| `vercel.ProjectEnvironmentVariable` ×7 | **GAP** | |
| `vercel.ProjectDomain` ×6 (gated by `attachProductionDomains`/`attachStagingDomain`) | **GAP** | |
| `cloudflare.DnsRecord` (zone-gated, imported IDs) | `Cloudflare/DNS/Record.ts` | adoption of existing records needs `--adopt` per the beep-effect-web notes |

**`beep-storybook` / `StorybookStack`**: `vercel.Project` → **GAP**. Never applied (10-15
finding unchanged); `apps/storybook/vercel.json` still exists.

**`beep-effect-ai-metrics` / `AIMetricsStack`**: `command.remote.Command` ×3 (SSH via the
local agent socket to dankserver; preflight/apply/health) → **GAP**: no remote command resource.
The rendering (Compose, systemd units, scripts) is pure code already.

**`beep-openclaw` / `OpenClawStack`**: `command.local.Command` ×4–5 (stage/apply/probe/
acceptance, optional backup) → **PARTIAL**: `Command.Exec` runs local programs with redacted
env, memoizes on content hash, and surfaces stdout, but its delete is a no-op. OpenClaw already
owns rollback, drift and backup in its own scripts, so the loss is smaller than for AI metrics.

**Tally.** 40 distinct Pulumi resource kinds map to an Alchemy resource (some by merge), 9 kinds
are gaps (`kms.Grant`, `gharunners.Module`, `CostAllocationTag`, two enrollment statuses,
three Vercel kinds, `command.remote.Command`) and 1 is partial (`command.local.Command`). By
live resource count the picture inverts: the runner module alone is ~220 of the production CI
stack's ~298 resources (78 direct + module), and it is the one with no path.

### 2026-11-02 — Gap list with a per-gap option

| # | Gap | Options | Lean (for the grill) |
| --- | --- | --- | --- |
| G1 | Terraform runner module (`ghaRunners`, ~220 resources, MIT) | (a) keep `beep-ci-runners` on Pulumi; (b) port the composite to Alchemy AWS primitives with attribution (large: webhook, SQS, scale-up/down Lambdas, SSM, ASG, syncer, termination watcher); (c) replace the service (GitHub-hosted larger runners; Blacksmith is banned by ruling) and delete the fleet; (d) drive Terraform/OpenTofu from `Command.Exec` (BUSL/MPL review, delete no-op) | (a) now; (c) is a cost decision, not an IaC one |
| G2 | `aws.kms.Grant` ×6 | custom provider over `CreateGrant`/`RetireGrant` (thin); only meaningful if G1 moves | follows G1 |
| G3 | `CostAllocationTag` ×6 | custom resource over `UpdateCostAllocationTagsStatus` (thin, idempotent, retain-on-delete) or drop from IaC and record in `docs/runbooks/aws-cost-operations.md` | custom resource if AccountCostControls moves, else drop |
| G4 | Compute Optimizer and Cost Optimization Hub enrollments | custom provider over the two enrollment APIs, or treat as one-time account settings outside IaC (they are retain-on-delete singletons already) | drop from IaC, runbook record |
| G5 | Vercel (OIP project + 7 env vars + 6 domains; Storybook project) | (a) keep `opip-web`/`beep-storybook` on Pulumi; (b) custom Alchemy Vercel provider over the REST API (three resource kinds, moderate); (c) replace the service: `apps/oip-web` to Cloudflare Workers via `Cloudflare.Website.Nextjs` (OpenNext; PWA build, `next/image`, HubSpot and Sanity to re-verify) and Storybook to `Cloudflare.Website.StaticSite`; (d) drop Vercel project config from IaC (Vercel's Git integration deploys regardless; `vercel.json` exists in both apps) and keep DNS + assets in Alchemy | (d) for Storybook now; (a) or (c) for OIP is a product call |
| G6 | Remote SSH commands (AI metrics) | (a) custom Alchemy provider wrapping `ssh` over `effect/process` (pattern: `hetzner/src/Ssh.ts`; repo brick: `StepExec`); (b) make `beep ai-metrics install apply` real (today dry-run-only, `Programs.ts:1159`) and retire the stack; (c) keep on Pulumi | (b): this was never cloud IaC |
| G7 | Local commands (OpenClaw) | `Command.Exec` for create/update with OpenClaw's own rollback; or Effect CLI as G6(b); or keep on Pulumi | same route as G6 |
| G8 | Pulumi stack config and `secure:` ciphertext (`hubSpotServiceKey`, `notificationEmailAddresses`, passphrase `CLOUD_PULUMI_ENCRYPTION_PASSPHRASE`) | Alchemy reads `effect/Config` from env/ConfigProvider via `op run`; checked-in encrypted values move to `op://` references; stack YAML config becomes typed stack props | applies to every moved stack |
| G9 | State backend (`s3://oip-law-pulumi-state` for CI and OIP; local/unknown for the host stacks) | Alchemy S3 state (`BucketState` lease) in the same account, or the existing Cloudflare store (no lock, CI-serialized); no importer, so adoption is by `read` + `--adopt` | S3 state for AWS stacks, Cloudflare store for Cloudflare stacks; one grill question |

### 2026-11-02 — Option C feasibility: Pulumi stays, TypeScript 6 leaves

Pulumi's Node runtime (`@pulumi/pulumi@3.273.0`, installed) registers ts-node and loads
`typescript` only when `PULUMI_NODEJS_TYPESCRIPT === "true"` (`cmd/run/run.js:234`, branch at
`:279-350`); the CLI sets that from `runtime.options.typescript`, default on for `nodejs`.
`tsutils.typeScriptRequireStrings` and `loadTypeScriptCompilerOptions` run only inside that
branch. The other `typescript-shim` consumers are the closure serializer
(`runtime/closure/{parseFunction,rewriteSuper,utils}.js`, reached only through
`serializeFunction`/`CallbackFunction`, **NOT FOUND** in `infra/src` on 10-15 and re-checked
today) and `provider/experimental/analyzer.js` (component provider authoring, unused). So a
program whose `main` is compiled JavaScript with `runtime.options.typescript: false` needs no
TypeScript at deploy time, and `infra/pulumi-typescript6.cjs` plus the six `nodeargs` lines go.

What a precompile step needs: an emitting tsconfig for `infra/src` (today `noEmit: true`,
checked by `tsrs -b`), `rewriteRelativeImportExtensions` because infra imports use `.ts`
specifiers and the package is `type: module`, an output directory the six `Pulumi.yaml` `main`
fields point at, and a build step before `pulumi preview|up` (local runbooks; there is no
Pulumi deploy workflow in `.github/workflows/`). Whether `tsrs`/`tsgo` emit is used, or TS7's
own `tsc`, is a spike question; the repo's `check` gates stay on tsrs either way.

The second TS6 consumer is the ghaRunners SDK build: `scripts/build.js:26-41` throws unless the
compiler major is 6. That guard is repo-authored (the SDK's `package.json` pins
`typescript ^6.0.3` because the guard exists, not the other way round); the SDK emits JS plus
`.d.ts` from seven files with `module: nodenext`. Compiling it with TypeScript 7 (declaration
emit included) or checking in the compiled `bin/` are both candidates. Because root
`postinstall` runs this build, it is the item that currently forces TypeScript 6 into every
checkout and worktree.

Outside infra, `@typescript/typescript6` stays for the schema-opaque codemod and the scratchpad
JSDoc census (`docs/runbooks/typescript-toolchain.md:208-211`); that is a separate obligation
this packet does not own.

### 2026-11-02 — Three candidate options

| | A. Full migration to Alchemy | B. Hybrid: Alchemy for Cloudflare and web, Pulumi retained for the gaps | C. Pulumi stays, TS6 removed by precompiling |
| --- | --- | --- | --- |
| What moves | all six programs; G1–G9 all need an answer first | nothing that is live today moves; policy: new infrastructure Cloudflare-first on Alchemy, no new Pulumi stacks; dormant stacks retired; Storybook/OIP DNS and assets are the only adoption candidates | nothing moves; `infra/src` is emitted to JS, `typescript: false`, preload and TS6 pin removed, ghaRunners guard relaxed |
| Removes TS6 from infra | yes, eventually | no (needs C anyway) | **yes** |
| Removes Pulumi | yes | no | no |
| Blocking gaps | G1 (no path but destroy/recreate or a large port), G5, G6 | none | none |
| Custom providers to write | KMS Grant, cost tag, two enrollments, Vercel (or replace), remote command | none now | none |
| State risk | highest: every adopted resource is a `read`-based takeover with no importer; the runner module cannot be adopted | low: only new or dormant stacks | none |
| Beta exposure | all production infra on a `2.0.0-beta.*` with no semver promise; main moves ~250 commits per release | bounded to Cloudflare stacks (already the case) | none |
| Effort shape | months, operator-attended applies for the fleet | days per adopted stack; policy document | 1–2 PRs plus a credential-free spike |
| What it buys | one toolchain, Effect-native infra, Alchemy `drift`/`dev`/typed bindings for the Lambda cache | the direction without the cliff; keeps the door open for A as Alchemy matures | the operator's stated pain (TS6 in every install) gone now |

### 2026-11-02 — State migration and rollback per option

**A. Full migration**, per stack, in order Storybook (dormant) → turbo-cache-lab (disposable)
→ OIP → AccountCostControls → CiTurboCache → CiRunnersStack/CiFleetController (last, or never):

1. Freeze: `pulumi stack export` to an archive outside the repo; refresh-and-expect-no-changes
   first so the archive equals live state (the 2026-10-01 receipt shows state and live can
   differ after Lambda edits).
2. Write the Alchemy stack with the same physical names and tags; `alchemy plan` against the
   chosen state store (S3 state in the same account for AWS stacks). Every pre-existing
   resource must plan as adopt or no-op; any create or replace is a stop.
3. `alchemy deploy --adopt` only for resources the provider reports `Unowned`; verify the
   state rows with `alchemy state`.
4. Remove the resources from Pulumi state (`pulumi state delete` per URN, or
   `pulumi stack rm --force` after everything is adopted). Never `pulumi destroy`.
5. Rollback: delete the Alchemy stage state (`alchemy state` delete, not `alchemy destroy`),
   `pulumi stack import` the archive, `pulumi preview --expect-no-changes`. Resources never
   changed, so rollback is a state operation only.
6. Exception: the runner module has no adopt path. It is destroyed and recreated under a
   replacement (fleet downtime, GitHub App webhook re-registration), or kept on Pulumi, which is
   why B exists.

**B. Hybrid**: only new or dormant stacks touch Alchemy. New Cloudflare stacks: nothing to
migrate; rollback is `alchemy destroy` of a stage. Storybook: `pulumi stack rm` after confirming
the Vercel project is console-managed or deleted. OIP DNS/assets, if adopted: steps 1–5 above
for one bucket and six records. CI and host stacks: unchanged, their Pulumi S3 backend and
passphrase stay. Consolidation question for the grill: the r2-cache stacks keep local state in
`$HOME/.local/state/beep`; moving them to the Cloudflare store is its own small adopt.

**C. Pulumi stays**: no state moves. Rollback is a git revert of the `Pulumi.yaml`
`typescript`/`main`/`nodeargs` lines, the preload file, the syncpack group and the SDK guard;
a local file-backend `pulumi preview` on the compiled program proves the runtime path before
any S3-backed preview (the 10-15 recipe, minus the "Found typescript version 6.0.3" log line
which must now be absent).

### 2026-11-02 — Recommendation (for the grill to confirm or overturn)

Do **C now and B as standing policy**; hold A behind named gates.

- C answers the operator's concrete pain (TypeScript 6 compiled on every `bun install`,
  the preload, the syncpack exception) in one or two PRs without touching cloud state, and it
  does not depend on Alchemy at all. The 10-15 kill chose isolation; C finishes it.
- B is already true in practice (three Alchemy stacks live, none of them a Pulumi port) and
  costs only a written policy plus retiring the dormant Storybook program. It keeps the
  direction the operator wants without taking ~220 fleet resources through a `read`-based
  takeover on a beta.
- A becomes worth re-pricing when any of these fire: Alchemy ships a non-beta 2.0; the runner
  fleet is replaced or ported (G1); OIP leaves Vercel or an Alchemy Vercel provider exists (G5);
  the host stacks move to the Effect CLI (G6/G7). Each gate is a re-entry point for this packet
  at `decompose`, not a reason to keep it active.

Questions the grill session must settle (mirrored in `ops/manifest.json` `openQuestions`):

1. Goal statement: is the target "no TypeScript 6 in `infra/`" (C suffices) or "no Pulumi"
   (A, or B converging on A)?
2. Standing policy: is new infrastructure Alchemy-first, and does any new Pulumi stack need an
   exception? Which state store is canonical for Alchemy stacks (Cloudflare store, S3 state
   with lease, or per-cloud), and do the r2-cache stacks leave local state?
3. OIP hosting: stay on Vercel (then keep `opip-web` on Pulumi, or drop Vercel project config
   from IaC and keep only DNS/assets), or move `apps/oip-web` to Cloudflare Workers via
   OpenNext? Product and risk call, not an IaC call.
4. Storybook: retire the never-applied `beep-storybook` program (and the Vercel project?) now?
5. Runner fleet: keep the Terraform module on Pulumi indefinitely, or schedule a replacement
   (GitHub-hosted larger runners vs an Alchemy-native composite), with the cost comparison as
   its own exploration?
6. Host stacks (AI metrics, OpenClaw): Pulumi, Alchemy custom resources, or the Effect CLI
   that already renders them?
7. Appetite for the credential-free spike that gates C: compiled-JS `pulumi preview` on a file
   backend with `typescript: false`, plus the ghaRunners SDK built by TypeScript 7 and its
   `node --test` suite green.
8. Account singletons (G3, G4): keep in IaC through thin custom resources, or move to the cost
   runbook as one-time settings?
