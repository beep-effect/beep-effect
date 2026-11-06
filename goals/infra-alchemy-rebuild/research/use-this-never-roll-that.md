# Use this, never roll that: the P0 gate matrix

P0 exit artifact for `goals/infra-alchemy-rebuild` (D16), 2026-11-06. A repo-owned resource or
helper is allowed only where a row records a **verified gap** with file evidence. Everything else
uses the shipped primitive in column 2. Evidence lives in the three sibling reports:
[`alchemy-distilled-source-inventory.md`](alchemy-distilled-source-inventory.md) (INV),
[`alchemy-docs-catalog.md`](alchemy-docs-catalog.md) (DOCS),
[`t3code-stack-patterns.md`](t3code-stack-patterns.md) (T3), and
[`t3code-alchemy-patches.md`](t3code-alchemy-patches.md) (another lane's note on t3code's beta.85
patches). Pins: `alchemy` / `@alchemy.run/*` `2.0.0-beta.85`, `@distilled.cloud/*` `1.0.0-rc.18`;
every primitive below is in the published beta.85 (INV "Main-only check").

Path shorthand as in INV: `alchemy/`, `aws/`, `cf/`, `gh/`, `docker/`, `test/` are
`~/YeeBois/references/effect/alchemy/packages/<pkg>/src`; `dist-aws/`, `dist-vercel/` are
`~/YeeBois/references/effect/distilled/packages/<pkg>/src(/services)`.

Legend for column 4: **none** = no repo-owned code; **config** = stack composition only;
**repo resource** = a new `Resource` + provider in a `@beep/alchemy-*` library.

## Cross-cutting (every stack)

| Need | Use (exact import) | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| Stack shell | `Alchemy.Stack(name, { providers, state }, Effect.gen(...))` from `alchemy` (`alchemy/Stack.ts:124-147`) | none | none |
| Stage-dependent props | `Alchemy.Stack.useSync((stack) => ...)`; `yield* Alchemy.Stack` (`apps/beep-effect-web/alchemy.run.ts:19-32`) | none | none |
| Prod-from-CI guard | `Config.Literal("true", "CI")` from `effect/Config` when `stack.stage === "prod"` (`apps/beep-effect-web/alchemy.run.ts:36-38`) | none | one shared guard Effect in a tiny `@beep/infra-*` internal module is fine; it is composition, not a resource |
| State store | `AWS.state({ backend: "s3", bucketName, prefix?, encryption })` from `@alchemy.run/aws` (`aws/StateStore/Store.ts:8-28,117-118`, `State.ts:29-66`); or the new default `AWS.state()` (DynamoDB, `DynamoDBState.ts:186-250`) | none. **Constraint:** `bucketName` must follow `<prefix>-<accountId>-<region>-an` (`State.ts:40-47,370-377`); `name` alone does not select S3 | none; one shared `state` Layer value imported by every stack |
| State bootstrap | `alchemy state bootstrap` (configured store; the only form for a custom `bucketName`) or `--backend aws-s3` / `--backend aws` (`alchemy/Cli/commands/state.ts:288-330`, `aws/StateStore/State.ts:250`) | none; CI never creates a store without `--yes` (`alchemy/State/Provisioning.ts`) | none (a decision file with the teardown reversal) |
| State inspection | `alchemy state list|read|delete`, `state read <Stack>/<stage>/output` (`state.ts:139-412`; T3 `.github/workflows/release.yml:432-451`) | none | none |
| Lambda assets bucket | `Assets.AssetsLive` inside `AWS.providers()` (`aws/Providers.ts:1896`, `aws/Assets.ts:77-92`), bootstrapped by `alchemy provider aws bootstrap` | **open:** the bootstrap command's doc requires an SSO or `aws login` profile (`website/src/content/docs/cli/aws.mdx:36-39`), which the aws-vault rule forbids | none if env credentials work; else a one-time tagged bucket (`alchemy::assets-bucket=true`, `aws/Assets.ts:17,189-201`) created in the P1 bootstrap decision |
| Credentials | `op run` env only: AWS env/profile vars (`aws/Environment.ts:15-21`), `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TOKEN` (`gh/Credentials.ts:63-77`), `VERCEL_TOKEN` (`dist-vercel/credentials.ts:35-37`); `Secrets.ProcessEnv` is implicit and wins (`alchemy/Secrets/ProcessEnv.ts:22-35`) | none. **Avoid** `Secrets.DotEnv` and stray `.env` files: the CLI loads `.env` by default (`alchemy/Cli/commands/flags.ts:113`); pass `--env-file /dev/null` in CI | none |
| Deploy-role credentials (CI) | `AWS.IAM.OpenIDConnectProvider` + `AWS.IAM.Role` for GitHub OIDC; `Credentials.fromAssumeRole` (`aws/Credentials.ts:144`) shared by providers and state (`aws/Providers.ts:229-259`) | none | none |
| Generated secrets | `Random(id, { bytes })` / `makeRandom` from `alchemy` (`alchemy/Random.ts:6-60`); `Alchemy.KeyPair` | none | none |
| Physical names | `createPhysicalName({ id, maxLength })` from `alchemy/PhysicalName` (used at `aws/KMS/Alias.ts:163-172`) | none | none |
| Grouping a composite | `Namespace.push(id)` from `alchemy/Namespace` (`alchemy/Namespace.ts:12-30`; Alchemy's own `aws/EC2/Network.ts`, `aws/ApiGatewayV2/HttpApi.ts:91`) | none | none |
| Removal policy | `RemovalPolicy.retain(stage === "prod")` from `alchemy/RemovalPolicy` (`:54`); repo/ruleset/zone retain by default (`:19-21`) | none | none |
| Adoption | `AdoptPolicy.adopt(true)` per resource, never stack-wide (`alchemy/AdoptPolicy.ts:203`; T3 avoid #2) | none | none (one decision file per adopted object) |
| Cross-stack refs | `Output.stackRef`, `Resource.ref(id, { stage: "prod" })` (`alchemy/Output.ts:547-554`; T3 copy #4) | none | none |
| Drift gate | `alchemy drift --stage prod` exits 2 on drift (DOCS cli/drift) | `alchemy plan` has no "changes" exit code (DOCS cli/index) | none; CI parses plan output |
| Telemetry | `Alchemy.Telemetry.layerOtlp` per Function/Worker (DOCS telemetry); CLI usage telemetry off via `ALCHEMY_TELEMETRY_DISABLED=1` (T3 copy #10) | none | none. Axiom is a new paid service: avoid (T3 avoid #7) |
| Tests | `Test.make({ providers, state: inMemoryState() })` from `@alchemy.run/test/Vitest` (`test/Vitest.ts:87-174`), `test.provider`, `stack.deploy`/`destroy`; worktree stages via `WorktreeStage.worktreeStage` (`test/WorktreeStage.ts:12-36`) | the t3code vite-plus patch is not needed here (patches note) | none |
| Known beta.85 bug | upstream `main` fix for `Artifacts.cached` hanging waiters (`alchemy/Artifacts.ts:141-143` at `17fb76f4f`; patches note) | release lag only | a bun `patchedDependencies` entry until the next release (patches note); not a repo resource |

## `@beep/infra-ci-runners` (CiRunnersStack, reaper, CiFleetController, runner composite)

| Need (Pulumi source) | Use | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| VPC, IGW, route table, 5 public subnets, associations (`infra/src/CiRunners.ts`) | `AWS.EC2.Network({ cidrBlock, availabilityZones: 5, nat: "none" })` (`aws/EC2/Network.ts:31-126`), or the primitives `AWS.EC2.Vpc`/`Subnet`/`InternetGateway`/`RouteTable`/`Route`/`RouteTableAssociation` | none | none |
| Default SG lock-down, worker SG, egress rule | `AWS.EC2.DefaultSecurityGroup`, `SecurityGroup`, `SecurityGroupRule` (`type: "egress"`) | none | none |
| Flow logs + log group + delivery role | `AWS.EC2.FlowLog` (`aws/EC2/FlowLog.ts`), `AWS.Logs.LogGroup`, `AWS.IAM.Role` with `inlinePolicies` | none | none |
| Reaper Lambda on a schedule (inline `StringAsset` code) | `AWS.Lambda.Function({ main })` bundling an Effect handler (`aws/Lambda/Function.ts:1398`), `AWS.EventBridge.Rule({ scheduleExpression, targets })` + `ToLambda`, or `ScheduleEventSource`; `AWS.Lambda.Permission` | none | none (handler code is Effect, schema-first, in the package) |
| SSM runner AMI id parameter | `AWS.SSM.Parameter`; AMI lookup by `AWS.EC2.getAmi` capability (`aws/Providers.ts:1902-1905`) or SSM `GetParameter` binding | none | none |
| IAM IMDS-disable policy, runner role, instance profile, permissions boundary | `AWS.IAM.Policy`, `AWS.IAM.Role({ permissionsBoundary, managedPolicyArns, inlinePolicies })`, `AWS.IAM.InstanceProfile` | none | none |
| `aws.kms.Grant` ×6 (termination-watcher roles decrypting the App id/key parameters) | IAM `inlinePolicies` granting `kms:Decrypt` with `kms:EncryptionContext:PARAMETER_ARN`, or the KMS crypto bindings (`aws/KMS/KeyBinding.ts`) | the grants exist only because upstream module v7.10.1 does not pass `kms_key_arn` to the watcher roles it owns (`infra/src/CiFleetController.ts:1118-1155`); in a native composite the stack owns those roles. Verify the App KMS key policy delegates to IAM | **drop `KmsGrant`** from `@beep/alchemy-aws-extras` unless that key policy forbids IAM delegation (then: repo resource over `kms.createGrant`/`retireGrant`, `dist-aws/kms.ts:1912,5093`) |
| Runner launch template: AL2023 AMI via SSM, 100 GB gp3 `/dev/xvda` encrypted, 3000 IOPS / 250 MB/s, EBS-optimized, IMDSv2 hop 1 with instance tags, runner tags (`CiFleetController.ts:976-1062`) | `AWS.AutoScaling.LaunchTemplate` (`aws/AutoScaling/LaunchTemplate.ts:53-122`) | **verified gap:** no `blockDeviceMappings`, `ebsOptimized`, `instanceMarketOptions`, `tagSpecifications` props (grep empty; props end at `metadataOptions`/`tags`) | **repo resource** `RunnerLaunchTemplate` in `@beep/alchemy-github-runners` over `ec2.createLaunchTemplate`/`createLaunchTemplateVersion`/`modifyLaunchTemplate`/`deleteLaunchTemplate` (`dist-aws/ec2.ts:24719,24752,43531,28155`); file an upstream PR adding the props, then delete the repo resource |
| Spot capacity (`instance_target_capacity_type: "spot"`, `capacity-optimized`, 7 instance types × 5 subnets) | `ec2.createFleet` (`dist-aws/ec2.ts:24028`) called from the scale-up Lambda at runtime | not an IaC resource: the upstream module launches instances with `CreateFleet` from its scale-up Lambda; it has **no ASG**. `AWS.AutoScaling.AutoScalingGroup` exists but changes runner semantics | none for IaC; runtime code in the scale-up handler |
| Webhook endpoint (API GW HTTP API in the module) | `AWS.Lambda.Function({ functionUrl: true })` (`Function.ts:201-233`) or `AWS.ApiGatewayV2.HttpApi` | none | none |
| Build queue + DLQ, job-retry queue | `AWS.SQS.Queue`, `QueueEventSource`/`EventSourceMapping`, `AWS.SQS.QueueSink` binding | none | none |
| Scale-up (SQS-triggered, reserved concurrency 1), scale-down (scheduled), syncer (scheduled + S3 bucket), SSM housekeeper | `AWS.Lambda.Function({ reservedConcurrentExecutions })` (`Function.ts:363`), `ScheduleEventSource`, `AWS.S3.Bucket` | the upstream Lambda code ships as release zips; `Function` takes a directory, not a zip path (`Function.ts:394-420`) | **open question:** port the handlers to Effect (D2 says port "to Alchemy AWS primitives", which covers infra, not code) or unpack the MIT release zips with `Command.Build` + `bundle: false` |
| Termination watcher (spot interruption + state change → Lambda, runner deregistration) | `AWS.EventBridge.Rule({ eventPattern, targets })` + `ToLambda`, `AWS.Lambda.Function` | same code question as above | same |
| App credentials in SSM (`id`, `key_base64`, `webhook_secret`, KMS-encrypted) | `AWS.SSM.Parameter({ type: "SecureString", keyId })`, `AWS.KMS.Key` + `Alias` | none | none; values come from `beep github app mint` (D10) |
| GitHub App webhook URL pointing at the new webhook endpoint | `apps.updateWebhookConfigForApp` (`distilled/packages/github/src/services/apps.ts`) | **verified gap:** `@alchemy.run/github` has no App resources and token-only credentials (`gh/Credentials.ts:63-77`); `GitHub.Webhook` is a repository hook | **decide:** set it in `beep github app mint`/a `beep github app webhook` command (D10 keeps apps CLI-side), or a small repo resource with App JWT auth |
| Org runner group `beep-ec2-heavy` restricted to the repo | `actions.createSelfHostedRunnerGroupForOrg`, `updateSelfHostedRunnerGroupForOrg`, `setRepoAccessToSelfHostedRunnerGroupInOrg` (`distilled/packages/github/src/services/actions.ts`) | **verified gap** in `@alchemy.run/github` (no runner-group resource); today it is a manual org setting | **repo resource** `RunnerGroup` in `@beep/alchemy-github-runners` (upstream candidate), or leave manual and record it |
| Runtime cleanup of instances/registrations the scale-up Lambda creates | delete-only sweep resource pattern (T3 copy #2, `infra/relay/src/previewTunnelSweep.ts:15-26,153-183`) | Alchemy never tracks runtime-created instances | **repo resource** `RunnerSweep` (delete-only), part of the composite |
| Runner composite as one declaration | `Namespace.push("Runners")` over the rows above | the composite itself (D2) | `@beep/alchemy-github-runners` composite function, MIT attribution |

## `@beep/infra-turbo-cache` (Worker + R2, replaces CiTurboCache and `infra/r2-cache`)

| Need | Use | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| Cache bucket with lifecycle | `Cloudflare.R2.Bucket({ lifecycleRules })` (`cf/R2/Bucket.ts:193-240`) + `RemovalPolicy.retain` in prod | none | none |
| Worker serving the turbo protocol | `Cloudflare.Worker` (`cf/Workers/Worker.ts`) with `ReadWriteBucket` binding | none | handler code only (the scratchpad module) |
| Per-team tokens | `Random(...)` per team, bound as Worker secrets (already the scratchpad pattern) | none | none |
| Signed-policy semantics (main/trusted workstations write, PRs read, forks local) | token classes per team + Worker route logic; `GitHub.Secret` with `environment: "turbo-cache-write"` for the writer token | none in Alchemy; the policy is application logic | Worker code, not a resource |
| Distribute tokens to CI | `GitHub.Secrets({ owner, repository, environment?, secrets })` in this stack (Alchemy's own `stacks/src/github.ts:53-65`) or a `stackRef` read by `@beep/infra-github` | none | none |
| Throttle / error-rate alarm | `Cloudflare.Alerting.NotificationPolicy`/`CustomAlert` (`cf/Alerting/*.ts`), `Cloudflare.Workers.RateLimit` binding | alert types for Worker error rate not verified against the account plan | none; decide in P3 |
| Cloudflare API token for the stack | `Cloudflare.ApiToken.AccountApiToken` (`cf/ApiToken/AccountApiToken.ts:150`; `stacks/src/github.ts:76-120`) | none | none (replaces `goals/beep-effect-web-alchemy/ops/mint-alchemy-token.sh`-style scripts) |
| Source module | `scratchpad/turbo-cache-r2` | **the module is not on `main`**: it exists only on branch `@chore/deps-update-11-6-26` (commit `830341baeb`, "feat(scratchpad): port alchemy turbo cache example with tests"); this worktree has no `scratchpad/turbo-cache-r2` | none; P3 must land or cherry-pick it first |

## `@beep/infra-cost-controls` (AccountCostControls)

| Need | Use | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| Region pin `us-east-1` | `AWS.Region.of("us-east-1")` (`aws/Region.ts:15`) | none | none |
| Monthly budget + email notifications | `AWS.Budgets.Budget({ notifications: [{ subscribers: [{ subscriptionType: "EMAIL" }] }] })` (`aws/Budgets/Budget.ts:20-53,131-171`) | none. `read` returns plain attrs, so a same-name budget adopts silently (`:455-467`): pick a new `budgetName` per D12 | none |
| Anomaly monitor + subscription | `AWS.CostExplorer.AnomalyMonitor`, `AnomalySubscription` (`aws/CostExplorer/*.ts`) | none (tag-gated adoption) | none |
| Cost allocation tags ×6 | none in Alchemy; op `cost-explorer.updateCostAllocationTagsStatus` / `listCostAllocationTags` (`dist-aws/cost-explorer.ts:3258,2875`) | **verified gap** (`aws/CostExplorer/` has only the action binding) | **repo resource** `CostAllocationTag` in `@beep/alchemy-aws-extras`, `defaultRemovalPolicy: "retain"`, account singleton per tag key |
| Compute Optimizer enrollment | op `compute-optimizer.getEnrollmentStatus`/`updateEnrollmentStatus` (`dist-aws/compute-optimizer.ts:2836,3308`) | **verified gap** (no `aws/ComputeOptimizer/`) | **repo resource** `ComputeOptimizerEnrollment`, retain, singleton |
| Cost Optimization Hub enrollment | op `cost-optimization-hub.listEnrollmentStatuses`/`updateEnrollmentStatus` (`dist-aws/cost-optimization-hub.ts:1507,1624`) | **verified gap** (no `aws/CostOptimizationHub/`) | **repo resource** `CostOptimizationHubEnrollment`, retain, singleton |

Singleton note: these three are account settings, not named objects; D12 greenfield names do not
apply. Each `read` returns plain attributes (silent adopt) and `delete` is a no-op under retain.

## `@beep/infra-github` (repository settings)

| Need | Use | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| Repository settings | `GitHub.Repository({ owner: "beep-effect", name: "beep-effect", ... })` (`gh/Repository.ts`) | none. Converges the live repo by name (`:399-456`) and **retains on delete** (`:228-232`): greenfield does not apply | none (decision file: first deploy converges live settings) |
| Rulesets incl. the beep-reviewer required check | `GitHub.Ruleset({ requiredStatusChecks: { checks: [{ context, integrationId }] }, pullRequest, bypassActors, ... })` (`gh/Ruleset.ts:15-200`) | same-name rulesets are `Unowned` (`:600-614`); ruleset `10240248` is also mutated by `beep reviewer ruleset release|require --apply` (`docs/ops/beep-reviewer-app.md:166-173`) | none; **decide** one owner: the switch becomes a stack input (`enforcement` or the check list) and the CLI edits config + deploys, or the CLI keeps the switch and the stack omits that check |
| Actions secrets | `GitHub.Secrets` / `GitHub.Secret({ environment? })` (`gh/Secrets.ts`, `gh/Secret.ts`) | secrets re-upload on every deploy, so `plan` is never a pure no-op (DOCS github/actions-config) | none; the acceptance "plan no-op" needs a carve-out |
| Actions variables | `GitHub.Variables` / `GitHub.Variable` | none | none |
| Environments (`beep-effect-web-prod`, `turbo-cache-write`, `professional-desktop-release`) | `GitHub.Environment({ deploymentBranchPolicy, reviewers })` | none; PUT semantics adopt by name | none |
| Labels | `GitHub.Label` (reconcile observes by name and updates, `gh/Label.ts:239-262`) | none | none |
| Repository webhooks | `GitHub.Webhook` | none | none |
| Org-level secrets/variables, repo Actions permissions | `actions.createOrUpdateOrgSecret`, `createOrgVariable`, `setGithubActionsPermissionsRepository`, `setAllowedActionsRepository`, `setGithubActionsDefaultWorkflowPermissionsRepository` | **verified gap** in `@alchemy.run/github` | only if the stack must own them; otherwise out of scope (record) |
| Auth | `GITHUB_TOKEN` from the App mint under `op run` (`gh/Credentials.ts:63-77`) | no App-installation credential layer | none; `beep github app mint` supplies the token (D10) |

## `@beep/infra-hosts` (AI metrics on dankserver, OpenClaw)

| Need | Use | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| Remote engine over SSH | `Docker.Context("dankserver", { docker: "host=ssh://<user>@<host>" })` from `@alchemy.run/docker` (`docker/Context.ts:9-95`) | none; it is a CLI context on the deploying machine, keys/agent auth only | none |
| Phoenix container (today Compose + systemd user unit) | **`Docker.Container({ context, image, restart: "unless-stopped", volumes, networks, healthcheck })`** (`docker/Container.ts:22-118,442`) | `Docker.Service` needs a swarm manager (`docker/Service.ts:325-332`); D9 named `Service` | none; D9 amendment: `Container`, not `Service`, unless a `Docker.Swarm` is declared |
| Network, volume | `Docker.Network`, `Docker.Volume` with `context` | none | none |
| Tailscale Serve and other host steps | `Command.Exec({ command: "ssh <host> ...", memo: { include } })` from `alchemy/Command` (`alchemy/Command/Exec.ts:8-128`) | `Exec.delete` is `Effect.void` (`:127`); outputs only `hash.input`, no stdout | none; teardown steps are explicit |
| OpenClaw stage/apply/probe/acceptance/backup (`command.local.Command` ×4-5) | `Command.Exec` per step, `memo.include` narrowed; `Command.Build` for staged artifacts | same as above; OpenClaw owns rollback in its own scripts | none |
| Where it runs | local deploy over the YubiKey SSH route | CI cannot reach dankserver over that route (DOCS cross-cutting #16) | none; a decision for a non-CI `prod` exception |

## `@beep/alchemy-vercel` and the app stacks (OIP, Storybook)

| Need | Use | Verified gap | Repo-owned |
| --- | --- | --- | --- |
| Vercel project (Next.js, build command, git repo, root dir, deployment protection) | ops `projects.createProject`/`getProject`/`updateProject`/`deleteProject` (`dist-vercel/services/projects.ts:26015,26150,26446,26099`) | **verified gap**: no Vercel package in Alchemy, no `@distilled.cloud/vercel` consumer in `alchemy/packages` | **repo resource** `Vercel.Project` |
| Env vars ×7 (sensitive, per-target) | `createProjectEnv` (`upsert`), `filterProjectEnvs`, `editProjectEnv`, `removeProjectEnv` (`projects.ts:26038,26133,26116,26337`) | **verified gap**; request body typed `unknown` (`projects.ts:3723-3729`) | **repo resource** `Vercel.EnvVar` with its own body schema |
| Project domains ×6 | `addProjectDomain`, `getProjectDomain`, `updateProjectDomain`, `removeProjectDomain`, `verifyProjectDomain`, **`moveProjectDomain`** (`projects.ts:25970-26550`) | **verified gap** | **repo resource** `Vercel.Domain`; the cutover flip is `moveProjectDomain`, because a domain belongs to one project at a time |
| Provider wiring | pattern of `aws/KMS/Alias.ts:56-161` + `docker/Providers.ts:30-46`; credentials `VERCEL_TOKEN`, team via `teamId` query (`dist-vercel/credentials.ts:4-60`) | none | `Vercel.providers()` |
| OIP assets bucket (5 Pulumi resources) | `AWS.S3.Bucket({ versioning, encryption, publicAccessBlock, policy })` | none | none |
| OIP DNS records (imported IDs today) | `Cloudflare.DNS.Record` (`cf/DNS/Record.ts:180-195,259`) | records are name-unique and carry no ownership marker, so they are `Unowned`: greenfield cannot apply | none; `adopt(true)` per record with a decision file, or delete-then-create in the flip |
| Pulumi S3 lock table | none | purpose disappears (S3/DynamoDB state has its own lease) | none (drop) |
| Storybook | `Vercel.Project` (above) or `Cloudflare.Website.StaticSite` (`cf/Website/StaticSite.ts`) | the Pulumi program was never applied | open question (below) |
| `BeepEffectWeb` state move | read + `--adopt` into the shared store (D6) | no Cloudflare → AWS migrate (`alchemy/Alchemist/State.ts:238-250`) | none |

## Planned repo-owned code after this gate

| Package | Keep | Drop or change |
| --- | --- | --- |
| `@beep/alchemy-vercel` | `Project`, `EnvVar`, `Domain` | none |
| `@beep/alchemy-aws-extras` | `CostAllocationTag`, `ComputeOptimizerEnrollment`, `CostOptimizationHubEnrollment` | **`KmsGrant` dropped** unless the App key policy blocks IAM delegation |
| `@beep/alchemy-github-runners` | composite, `RunnerLaunchTemplate` (until upstream gains block devices), `RunnerSweep`, optionally `RunnerGroup` | **no ASG** in the composite; Spot stays `CreateFleet` in the scale-up handler |
| `@beep/infra-hosts` | composition only | `Docker.Container` instead of `Docker.Service` |

## Open questions for the operator

1. **D6 store backend.** beta.85 made DynamoDB the default `AWS.state()` and calls the S3 bucket
   store the earlier layout (`aws/StateStore/Store.ts:8-64`, commit `1e5fbafec`). Both lease per
   stage. Keep S3 (explicit `backend: "s3"` everywhere, bucket name in the `-an` namespace) or take
   the default DynamoDB table? Either way the store bucket/table and state objects need SSE-KMS,
   because redacted outputs sit in state as plain `{"__redacted__": ...}` (T3 avoid #11).
2. **Lambda assets bucket bootstrap.** `AWS.providers()` dies without the tagged assets bucket,
   and `alchemy provider aws bootstrap` documents SSO or `aws login` profiles only. May the P1
   spike try it under `aws-vault exec`, and if that fails, create the tagged bucket as part of
   the recorded state bootstrap?
3. **Runner Lambda code.** Port the upstream module's webhook, scale-up/down, syncer, housekeeper
   and termination-watcher handlers to Effect (months, fully owned), or deploy the MIT release
   zips unpacked through `Command.Build` + `bundle: false` (weeks, upstream-shaped)?
4. **Runner group and App webhook URL.** Own the `beep-ec2-heavy` org runner group and the App
   webhook URL in IaC (two small resources over distilled `actions`/`apps`), or keep both manual
   or in `beep github app` commands?
5. **beep-reviewer switch owner.** `@beep/infra-github` reconciling the ruleset would revert
   `beep reviewer ruleset release|require --apply`. Make the switch a stack input deployed from CI,
   or leave that check out of the managed ruleset?
6. **Adopt list.** Greenfield cannot apply to: the GitHub repository, its rulesets (`Unowned`),
   labels and environments (silent adopt by name), the `oip.law` and `beep-effect.com` DNS records,
   the Vercel domain move, the cost-controls account singletons, and `BeepEffectWeb`. Approve
   these as the per-object adopt exceptions to D12, one decision file each?
7. **Hosts deploy location.** AI metrics and OpenClaw reach dankserver only over the YubiKey SSH
   route, so CI cannot deploy their `prod` stage. Accept a recorded non-CI exception for
   `@beep/infra-hosts`, with a local lease from the shared store?
8. **Storybook hosting.** Vercel through `@beep/alchemy-vercel`, or `Cloudflare.Website.StaticSite`
   (no new provider, no Vercel seat)? The Pulumi program was never applied, so nothing is live
   to flip.
9. **Plan no-op acceptance.** `alchemy plan` has no change exit code and GitHub secrets
   re-upload every deploy. Replace the SPEC's "plan no-op" check with "`alchemy drift` exit 0"
   plus a parsed plan, carving out secrets?
10. **Turbo-cache source.** `scratchpad/turbo-cache-r2` exists only on `@chore/deps-update-11-6-26`.
    Land it on `main` first (its own PR), or let P3 move it straight from that branch?

## Sources

- Sibling reports in this directory: `alchemy-distilled-source-inventory.md`,
  `alchemy-docs-catalog.md`, `t3code-stack-patterns.md`, `t3code-alchemy-patches.md`.
- `~/YeeBois/references/effect/alchemy` at `17fb76f4f` (`v2.0.0-beta.85-48`): files cited inline
  under `packages/{alchemy,aws,cloudflare,github,docker,alchemy-test}/src`, `stacks/src/github.ts`,
  `website/src/content/docs/cli/aws.mdx`.
- `~/YeeBois/references/effect/distilled` at `0b07e4d1f`: `packages/aws/src/services/{kms,ec2,cost-explorer,compute-optimizer,cost-optimization-hub}.ts`,
  `packages/vercel/src/{credentials.ts,errors.ts,services/projects.ts}`,
  `packages/github/src/services/{actions,apps}.ts`.
- `~/YeeBois/references/effect/t3code/infra/relay`, `infra/task-cache` (via T3).
- This worktree: `goals/infra-alchemy-rebuild/SPEC.md` (Target Surfaces),
  `explorations/pulumi-to-alchemy/DECISIONS.md` (D1–D16), `explorations/pulumi-to-alchemy/RESEARCH.md`
  ("2026-11-02" coverage matrix), `infra/src/{CiFleetController,CiRunners,AIMetrics,OipWeb}.ts`,
  `apps/beep-effect-web/alchemy.run.ts`, `docs/ops/beep-reviewer-app.md`, `.github/workflows/`.
- Primary clone branch `@chore/deps-update-11-6-26` (`scratchpad/turbo-cache-r2`, commit `830341baeb`).
- https://alchemy.run/llms.txt and the doc pages listed in `SOURCES.md` (via DOCS).
