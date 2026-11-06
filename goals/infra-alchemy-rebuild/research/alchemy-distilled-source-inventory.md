# Alchemy and distilled source inventory

P0 research for `goals/infra-alchemy-rebuild`, 2026-11-06. Read-only pass over the reference
checkouts; no `alchemy`, `pulumi` or cloud command ran. Every claim cites a file in a checkout.

## Checkouts and release status

| Checkout | Commit | Position |
| --- | --- | --- |
| `~/YeeBois/references/effect/alchemy` | `17fb76f4f` (2026-11-06) | `v2.0.0-beta.85-48-g17fb76f4f` |
| `~/YeeBois/references/effect/distilled` | `0b07e4d1f` (2026-11-06) | packages at `1.0.0-rc.18` |
| `~/YeeBois/references/effect/alchemy/submodules/distilled` | `07830aae3` (2026-10-23) | the distilled pin Alchemy's workspace builds against |

npm (`npm view`, 2026-11-06): `alchemy` `latest` = `2.0.0-beta.85` (`next` is a stale
`2.0.0-beta.72`); `@alchemy.run/aws`, `@alchemy.run/github`, `@alchemy.run/docker`,
`@alchemy.run/test` all `2.0.0-beta.85`; `@distilled.cloud/aws` and `@distilled.cloud/vercel`
`latest` = `1.0.0-rc.18`. The published `@alchemy.run/aws@2.0.0-beta.85` depends on
`@distilled.cloud/aws: 1.0.0-rc.18` exactly and peers on `alchemy 2.0.0-beta.85`,
`effect ^4.1.0`. The repo catalog already pins `alchemy` and `@alchemy.run/cloudflare` at
`2.0.0-beta.85` (`package.json:3,149`).

**Main-only check.** `git diff --name-status v2.0.0-beta.85..HEAD -- packages` adds only
`alchemy/src/Cli/JsonConsole.ts`, `Cli/components/ui/ProgramStatus.ts`, `Local/RpcToken.ts`,
`domain/src/{Annotations,Query}.ts` and `fly/src/internal/Oidc.ts`. The 48 commits after the tag
touch the state store, Docker, GitHub and Command files only for lint (#2831 bans raw
`Date`/`env`/`fetch`/UUID inside Effect code; 43 lines across 8 files). Every primitive below
was confirmed present at the tag with `git cat-file -e v2.0.0-beta.85:<path>`. **Nothing this
packet needs is main-only.** All rows below are "published in beta.85".

Path shorthand: `alchemy/` = `~/YeeBois/references/effect/alchemy/packages/alchemy/src`,
`aws/` = `.../packages/aws/src`, `cf/` = `.../packages/cloudflare/src`, `gh/` =
`.../packages/github/src`, `docker/` = `.../packages/docker/src`, `test/` =
`.../packages/alchemy-test/src`, `dist-aws/` = `~/YeeBois/references/effect/distilled/packages/aws/src/services`,
`dist-vercel/` = `~/YeeBois/references/effect/distilled/packages/vercel/src`.

## 1. Engine primitives (`alchemy`)

Root barrel `alchemy/index.ts:1-60` re-exports `AdoptPolicy`, `RemovalPolicy`, `Secrets`,
`Namespace`, `Random`, `Stack`, `Stage`, `Output` (type plus `stackRef`), `Plan`, `Drift`,
`Telemetry`, `inMemoryState`, `localState`. `Command` is **not** in the root barrel: import it
from `alchemy/Command` (`packages/alchemy/package.json:39`).

| Primitive | Export and file | Props / shape | Delete semantics | Adoption |
| --- | --- | --- | --- | --- |
| Stack | `Alchemy.Stack(name, { providers, state, secrets? }, Effect)` (`alchemy/Stack.ts:124-147`) | `providers`: a Layer; `state`: a `State` Layer; `secrets`: providers or a stage callback (`Stack.ts:98-128`) | n/a | n/a |
| `Stack.useSync` | `Alchemy.Stack.useSync((stack) => props)`: `Stack` is a `Context.Service` (`Stack.ts:89,147`), so `useSync` is Effect's service accessor | builds stage-dependent props at declaration time; live in `apps/beep-effect-web/alchemy.run.ts:19-22` | n/a | n/a |
| Stage | `Stage` service (`alchemy/Stage.ts:3`); the CLI resolves `--stage`, else `$ALCHEMY_STAGE` from env or `--env-file`/`.env`, else `live_$USER`/`dev_$USER` (`alchemy/Cli/commands/flags.ts:61-63`) | string | n/a | n/a |
| AdoptPolicy | `AdoptPolicy.adopt(enabled?)` (`alchemy/AdoptPolicy.ts:203-214`), `Unowned(attrs)` (`:110-131`), `unownedUnlessPrevious` (`:144`), errors `OwnedBySomeoneElse` (`:42`), `UnverifiableReplacement` (`:62`) | boolean, or an `Effect<boolean>`; pipe onto a resource or a whole scope | n/a | Routing table at `AdoptPolicy.ts:9-16`: `read` undefined → create; plain attrs → silent adopt; `Unowned` → fail unless `adopt(true)`/`--adopt`. Resources without ownership semantics return plain attrs and adopt silently |
| RemovalPolicy | `RemovalPolicy.retain(enabled?)` (`alchemy/RemovalPolicy.ts:54`), `RemovalPolicy.destroy(enabled?)` (`:88`) | boolean or `Effect<boolean>`; decorates one resource or a scope | `retain` skips `provider.delete`, drops the state row (`:1-24`). Persisted on the row, not a prop, so changing it plans as `noop` but takes effect next deploy (`:12-17`). `GitHub.Repository`, `GitHub.Ruleset`, `Cloudflare.Zone` default to retain (`:19-21`) | n/a |
| Namespace | `Namespace.push(id, effect)` / `push(id)` (`alchemy/Namespace.ts:12-30`), `set`, `CurrentNamespace` | prefixes logical ids of every resource declared inside | n/a | n/a. Alchemy's own composites use it: `aws/EC2/Network.ts`, `aws/ApiGatewayV2/HttpApi.ts:91`, `aws/CloudFront/Distribution.ts:658` |
| Random | `Random(id, { bytes? })` / `makeRandom` (`alchemy/Random.ts:6-31`) | `bytes` default 32; output `text: Redacted<string>` hex | `delete: Effect.void` (`:56`); value is minted once and kept in state (`:33-55`) | `read` returns the stored output |
| Output | `alchemy/Output.ts`: `map` (`:226`), `flatMap` (`:270`), `mapEffect` (`:265`), `all` (`:399`), `named` (`:396`), `stackRef` (`:547-554`) | `stackRef` reads another stack's persisted output from the state store at plan/apply time | n/a | n/a |
| Secrets.ProcessEnv | `Secrets.ProcessEnv({ disabled? })` (`alchemy/Secrets/ProcessEnv.ts:22-35`) | implicit last entry of every stack's `secrets`, so the shell (and therefore `op run`) overrides every provider | n/a | n/a |
| Secrets.DotEnv | `Secrets.DotEnv({ path?, expandVariables? })` (`alchemy/Secrets/DotEnv.ts:9-41`) | reads files into the ConfigProvider without touching `process.env` | n/a | n/a. **Gotcha:** the CLI also loads `.env` from the cwd by default (`flags.ts:113`); a `.env` that holds `op://` references would feed raw reference strings to `Config` unless `op run` exports the same keys (ProcessEnv wins) or the job passes `--env-file /dev/null` (`flags.ts:91`) |
| Provider contract | `Provider.succeed(R, {...})` (`alchemy/Provider.ts:535`), `Provider.effect` (`:488`), `Provider.collection([...])` (`:606`), `ProviderCollection` | required: `reconcile` (`:387`), `delete` (`:402`), `list` (`:228`); optional: `read` (`:265`), `diff` (`:300`), `stables` (`:299`), `observe` (`:341`), `precreate` (`:353`), `tail`/`logs` | resource option `defaultRemovalPolicy` (`alchemy/Resource.ts:264,457`) | `read` returning `Unowned(...)` is how a provider opts into the gate |

### Command (`alchemy/Command`)

| Primitive | File | Props | Delete | Notes |
| --- | --- | --- | --- | --- |
| `Command.Exec` | `alchemy/Command/Exec.ts:8-128` | `command`, `cwd?`, `shell?` (default false), `env?: Record<string, string \| Redacted \| undefined>` (`Command/Command.ts:32-55`), `timeout?: Duration.Input` (`:61-73`), `memo?: MemoOptions \| boolean` (default true: every non-gitignored file in `cwd` plus the nearest lockfile is hashed) | **`delete: () => Effect.void`** (`Exec.ts:127`) | Output is only `hash.input` (`:21-32`). **stdout is not surfaced as an attribute**; the 2026-11-02 note that it "surfaces stdout" is wrong for beta.85. Re-runs when `command`/`cwd`/`env` or hashed inputs change (`:96-112`). Non-zero exit fails with `CommandError` (`Command.ts:98-101`) |
| `Command.Build` | `alchemy/Command/Build.ts:19-116` | `outdir` plus the Exec props; outputs `outdir`, `hash.input`, `hash.output` | `delete` removes the output (`Build.ts:217`) | Use for prebuilt artifacts the stack ships (Lambda zip directories) |
| `Command.providers()` | `alchemy/Command/Providers.ts:10` | registers Build/Exec/Dev | | Already merged into `AWS.providers()` (`aws/Providers.ts:1892-1898`); a Cloudflare-only or Docker-only stack must merge it itself |

There is no remote/SSH command. `Command.Exec` runs locally, so a step on dankserver is a local
`ssh <host> ...` command line under `Exec` (non-interactive key or agent auth).

## 2. State stores

| Store | Export and file | Props | Lock | Bootstrap |
| --- | --- | --- | --- | --- |
| `AWS.state()` default (**DynamoDB**) | `AWS.state(options)` (`aws/StateStore/Store.ts:117-118`), `dynamoDBState` (`aws/StateStore/DynamoDBState.ts:186-250`) | `name?` (table `alchemy-state-<name>`), `tableName?`, `overflowBucketName?`, `kmsKeyId`, `overflowThreshold?` (`DynamoDBState.ts:50-98`) | per-stage `LEASE` item, refreshed by holder (`:125-135,194-208`) | table is created with deletion protection on first use, **except in CI**, where a missing table fails the run (`:210-246`) |
| `AWS.state({ backend: "s3" })` (**BucketState**) | `s3State` (`aws/StateStore/State.ts:191-215`) over `makeBucketState` (`alchemy/State/BucketState.ts:169`) | `name?` (bucket `alchemy-state-<name>-<accountId>-<region>-an`), `bucketName?` (must follow `<prefix>-<accountId>-<region>-an`, the account-regional namespace), `prefix?`, `encryption?` (default AES256, no KMS) (`State.ts:29-66,376-377`) | `{prefix}{stack}/{stage}/__lease__.json` by conditional put, `LEASE_TTL_MS = 60_000`, refreshed every TTL/3, a second deploy fails fast (`BucketState.ts:14-53,247-364`) | created on first use except in CI (`State.ts:240-258`, `alchemy/State/Provisioning.ts` `deployMissing`); `provisionStateBucket(bucket, region, kmsKeyId?)` converges secure defaults (`State.ts:519-540`) |
| `Cloudflare.state()` | `cf/StateStore/State.ts:79` | Durable Object + SQLite store | none documented (beep-effect-web decision log) | needs a workers.dev subdomain (beep-effect-web SPEC) |
| `inMemoryState()` / `localState()` | `alchemy/State/index.ts` | for tests / local | n/a | n/a |

**Selection rule** (`Store.ts:8-28`): `backend` defaults to `"dynamodb"`; passing `bucketName`,
`prefix` or `encryption` without `backend` selects S3; **`name` alone does not**. The DynamoDB
default landed in `1e5fbafec` "feat(aws)!: DynamoDB is the default AWS.state(), with alchemy
state migrate from S3 (#2691)", 2026-10-28, first tagged in `v2.0.0-beta.85`. A default-bucket S3
stage is refused by the default store until `alchemy state migrate` moves it
(`Store.ts:49-64`, `Migration.ts:1-30`). There is no Cloudflare → AWS migrate: the only
`resolved.migrate` is S3 → DynamoDB (`alchemy/Alchemist/State.ts:238-250`), so `BeepEffectWeb`
moves by read-and-adopt as D6 says.

**CLI** (`alchemy/Cli/commands/state.ts`): `state list|read|delete|nuke|bootstrap|teardown|migrate|logs`
(`:139-412`). `bootstrap` without `--backend` provisions "the one the config sets"
(`:288-330`), which is the only form that addresses a custom `bucketName` (`Provisioning.ts`
`required()`: `configured` stores print `alchemy state bootstrap`). In CI, a missing or
outdated store is created or upgraded only with `--yes` (`Provisioning.ts` `deployMissing`,
`upgradeOutdated`). The S3 store reports itself as backend `aws-s3` (`aws/StateStore/State.ts:250`), so a default-named S3 store bootstraps with `alchemy state bootstrap --backend aws-s3 [--name <n>]`; `--backend aws` provisions the DynamoDB table. Store logical names must match `^[a-z0-9](?:[a-z0-9-]{0,18}[a-z0-9])?$`.

## 3. AWS (`@alchemy.run/aws`)

`AWS.providers()` (`aws/Providers.ts:261`) registers every AWS resource plus `Command`, `Random`,
`KeyPair`, Docker and Route53 adapters (`:1886-1898`), and `provideMerge`s `Region`,
`Credentials`, `Endpoint` (fresh per call), `AwsAuth` and a 10-attempt retry policy
(`:1905-1922`). The environment resolves from `AWS_PROFILE` (default `default`),
`AWS_REGION`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN`
(`aws/Environment.ts:15-21`), so the aws-vault `credential_process` profile works as-is.
`AWS.Region.of("us-east-1")` (`aws/Region.ts:15`) pins a region; `Credentials.fromAssumeRole`
(`aws/Credentials.ts:144`) builds a deploy-role layer to share between providers and state
(`Providers.ts:229-259`).

Adoption pattern across AWS: tag-owning resources return `Unowned` unless Alchemy's ownership
tags match (`hasAlchemyTags`), so greenfield names never collide and Pulumi-created look-alikes
fail loudly.

| Capability | Export and file | Key props | Delete | Adoption |
| --- | --- | --- | --- | --- |
| VPC composite | `AWS.EC2.Network` (`aws/EC2/Network.ts:31-126`) | `cidrBlock`, `availabilityZones?`, `nat?: "none" \| "single" \| "per-az"`, `gatewayEndpoints?`, DNS flags, `tags?`; returns the underlying resources | destroys children | per child |
| VPC primitives | `AWS.EC2.Vpc`, `Subnet`, `InternetGateway`, `RouteTable`, `Route`, `RouteTableAssociation`, `SecurityGroup`, `SecurityGroupRule`, `DefaultSecurityGroup`, `FlowLog` (`aws/EC2/*.ts`) | FlowLog: `resourceType`, `resourceId`, `trafficType?`, `logDestinationType?`, `logGroupName?`, `deliverLogsPermissionArn?`, `maxAggregationInterval?`, `logFormat?` | destroy | tag-gated |
| Launch template | `AWS.AutoScaling.LaunchTemplate` (`aws/AutoScaling/LaunchTemplate.ts:53-122`) | `launchTemplateName?`, `imageId`, `instanceType`, `securityGroupIds?`, `keyName?`, `instanceProfileName?`, `userData?`, `associatePublicIpAddress?`, `metadataOptions?`, `tags?`, plus a bundled-program mode (`main`, `handler`, `port`, `env`, `build`, `roleManagedPolicyArns`) | destroy (`:565`) | — |
| ASG | `AWS.AutoScaling.AutoScalingGroup` (`aws/AutoScaling/AutoScalingGroup.ts`) | `launchTemplate`, `subnetIds`, `minSize`, `maxSize`, `desiredCapacity?`, `instanceRequirements?`, `terminationPolicies?`, ... | destroy (`:641`) | — |
| Lifecycle hook | `AWS.AutoScaling.LifecycleHook` | `autoScalingGroup`, `lifecycleTransition`, `heartbeatTimeout?`, ... | destroy | — |
| IAM | `AWS.IAM.Role` (`aws/IAM/Role.ts`: `assumeRolePolicyDocument?`, `managedPolicyArns?`, `inlinePolicies?`, `permissionsBoundary?`, `tags?`), `Policy`, `InstanceProfile`, `ServiceLinkedRole`, `OpenIDConnectProvider` | inline policies fold Pulumi `RolePolicy` into the role | destroy (`Role.ts:644`) | tag-gated (`Role.ts:481`) |
| KMS | `AWS.KMS.Key` (`description?`, `keyUsage?`, `keySpec?`, `policy?`, `enableKeyRotation?`, `rotationPeriod?`, `multiRegion?`, `deletionWindow?`, `tags?`), `AWS.KMS.Alias` (`aliasName?`, `targetKeyId`); crypto bindings (`Decrypt`, `Encrypt`, ...) emit least-privilege IAM statements (`aws/KMS/KeyBinding.ts`) | | Key schedules deletion (`Key.ts:400`) | Alias `Unowned` unless state (`Alias.ts:91`) |
| Lambda | `AWS.Lambda.Function` (`aws/Lambda/Function.ts:1398`): bundles an Effect or async `main` with rolldown, or `bundle: false` ships `main`'s directory as-is (`:394-420`); `runtime?: "nodejs22.x" \| "nodejs24.x"`; `reservedConcurrentExecutions?` (`:363`); `functionUrl?: boolean \| FunctionUrlConfig` (`:201-233`); `layers?` | | destroy | — |
| Lambda wiring | `AWS.Lambda.Permission` (`action`, `functionName`, `principal`, `sourceArn?`, ...), `EventSourceMapping`, `QueueEventSource`, `ScheduleEventSource`, `EventBridgeEventSource` (`aws/Lambda/*.ts`) | | destroy | — |
| SQS | `AWS.SQS.Queue` (`aws/SQS/Queue.ts`), `QueueSink`, send/receive bindings | | destroy (`:776`) | tag-gated (`:584`) |
| EventBridge | `AWS.EventBridge.Rule` (`name?`, `eventPattern?`, `scheduleExpression?`, `state?`, `targets?`, `tags?`), `ToLambda`, `ToQueue`, `EventBus` (`aws/EventBridge/*.ts`) | targets fold into the rule | destroy (`Rule.ts:596`) | tag-gated (`:389`) |
| Scheduler | `AWS.Scheduler.Schedule`, `ScheduleGroup` | | destroy | — |
| SSM | `AWS.SSM.Parameter` (`name?`, `type?`, `value`, `tier?`, `keyId?`, `allowedPattern?`, `dataType?`, `tags?`); read bindings `GetParameter`, `GetParametersByPath` | | destroy (`Parameter.ts:502`) | tag-gated (`:331`) |
| Logs / alarms | `AWS.Logs.LogGroup` (`retention?`, `kmsKeyId?`, `deletionProtectionEnabled?`), `AWS.CloudWatch.Alarm`, `AWS.SNS.Topic`, `AWS.SNS.Subscription` | | destroy | — |
| S3 | `AWS.S3.Bucket` (`aws/S3/Bucket.ts`, 2400 lines): `bucketName?`, `forceDestroy?`, `versioning?`, `encryption?`, `publicAccessBlock?`, `lifecycleRules?`, `policy?`, `cors?`, `website?`, `replication?`, ... | Pulumi's five bucket resources merge into one | empties the bucket then deletes (`:581-645`) | — |
| Budgets | `AWS.Budgets.Budget` (`budgetName?`, `budgetType?`, `timeUnit?`, `budgetLimit?`, `costFilters?`, `costTypes?`, `notifications?` with `EMAIL`/`SNS` subscribers, `tags?`) | | destroy (`:532`) | `read` returns plain attrs: **silent adopt by name** (`Budget.ts:455-467`) |
| Cost Explorer | `AWS.CostExplorer.AnomalyMonitor` (`monitorName?`, `monitorType`, `monitorDimension?`, `monitorSpecification?`), `AnomalySubscription` (`monitorArnList`, `subscribers`, `frequency`, `thresholdExpression?`), `CostCategory`; the `UpdateCostAllocationTagsStatus` op is only an action binding (`aws/CostExplorer/UpdateCostAllocationTagsStatus.ts`) | | destroy | tag-gated (`AnomalyMonitor.ts:158`) |
| AMI lookup | `AWS.EC2.getAmi` capability, resolved at plan (`Providers.ts:1902-1905`) | | n/a | n/a |

**Verified absent in `aws/`:** no `KMS/Grant.ts` (`ls aws/KMS`), no `ComputeOptimizer` or
`CostOptimizationHub` directory, no cost-allocation-tag resource, no EC2 Fleet resource.
`LaunchTemplate` has **no `blockDeviceMappings`, `ebsOptimized`, `instanceMarketOptions` or
`iamInstanceProfile` ARN form**: `grep BlockDevice|InstanceMarket|EbsOptimized
aws/AutoScaling/LaunchTemplate.ts` is empty, and the props list stops at the fields above. The
live runner module sets a 100 GB encrypted gp3 `/dev/xvda` root with 3000 IOPS and 250
throughput, `runners_ebs_optimized: true`, Spot via `CreateFleet` (`infra/src/CiFleetController.ts:979-1062`).
`Lambda.Function` takes a directory, not a prebuilt zip path: the upstream module's release zips
must be unpacked first (`Command.Build`).

**Assets bucket.** `AWS.providers()` merges `Assets.AssetsLive` (`aws/Providers.ts:1896`), which looks up a bucket tagged `alchemy::assets-bucket=true` (`aws/Assets.ts:17,181-190`; default name `alchemy-assets-<accountId>-<region>-an`, `:200-201`) and dies with "Assets bucket not found. Run 'alchemy provider aws bootstrap'" when absent outside an emulator (`:77-92`). Lambda code goes to that bucket, with an inline `ZipFile` fallback only when no `Assets` service exists (`aws/Lambda/Function.ts:2279-2290`). `alchemy provider aws bootstrap` takes `--aws-profile` (`aws/Cli.ts:1-45`) and its doc says the profile must be SSO or `aws login` (`website/src/content/docs/cli/aws.mdx:36-39`), which the aws-vault rule forbids. Verify in the P1 spike whether env credentials from `aws-vault exec` satisfy `Aws.bootstrap`; otherwise the bucket is a one-time bootstrap the state-bootstrap decision must cover.

## 4. Cloudflare (`@alchemy.run/cloudflare`)

| Capability | Export and file | Notes |
| --- | --- | --- |
| R2 bucket | `Cloudflare.R2.Bucket` (`cf/R2/Bucket.ts`): `name?`, `storageClass?`, `jurisdiction?`, `locationHint?`, `domains?`, `lifecycleRules?` (`:233`), `cors?` | delete empties then deletes (`:1533-1576`). Bindings `ReadBucket`, `WriteBucket`, `ReadWriteBucket`, presign tokens |
| R2 S3 credentials | `Cloudflare.R2.S3Credentials(bucket, { access: "read" \| "write" \| "read-write" })` (`cf/R2/S3Credentials.ts:129`) | bucket-scoped API token turned into S3 credentials, delivered to a Worker binding |
| Worker | `Cloudflare.Worker` (`cf/Workers/Worker.ts`): `name?`, `main?`/`script?`, `compatibility?`, `observability?`, `logpush?`, `limits?`, `crons?`, `domain?`, `routes?`, `env?`, `workersDev?`, `tailConsumers?`, `bundle?` | `RateLimit` binding (`cf/Workers/RateLimit.ts`), `SecretKey` binding |
| Website | `Cloudflare.Website.{Vite,StaticSite,Nextjs,...}` (`cf/Website/*.ts`) | live: `Website.Vite` for beep-effect-web |
| DNS | `Cloudflare.DNS.Record` (`cf/DNS/Record.ts:259`) | no ownership markers; an existing `(name, type)` match is `Unowned`, so taking a record over needs `adopt(true)` (`:180-195`) |
| API tokens | `Cloudflare.ApiToken.AccountApiToken` (`cf/ApiToken/AccountApiToken.ts:150`), `UserApiToken` | mints least-privilege tokens in-stack; Alchemy's own `stacks/src/github.ts:35-120` mints CI tokens and writes them to `GitHub.Secrets` |
| Alerting | `Cloudflare.Alerting.NotificationPolicy`, `Webhook`, `CustomAlert` (`cf/Alerting/*.ts`) | candidate for the turbo-cache error-rate alarm |
| State | `Cloudflare.state()` (`cf/StateStore/State.ts:79`) | being retired by D6 |

## 5. GitHub (`@alchemy.run/github`)

`GitHub.providers(options?)` (`gh/Providers.ts:49`). Credentials are **a token only**:
`GITHUB_ACCESS_TOKEN` or `GITHUB_TOKEN` (`gh/Credentials.ts:63-77`); there is no GitHub App
installation-token credential (`grep -i installation|privateKey|jwt gh/*.ts` finds only
`BranchProtection` `appId` check props). Uses `@distilled.cloud/github` and `libsodium-wrappers`
for secret sealing (`packages/github/package.json:55-59`).

| Resource | Props | Delete | Adoption |
| --- | --- | --- | --- |
| `GitHub.Repository` (`gh/Repository.ts`) | `owner`, `name`, `description?`, `homepage?`, `visibility?`, `has*?`, `defaultBranch?`, `allow{Squash,Merge,Rebase,Auto}Merge?`, `deleteBranchOnMerge?`, `topics?`, `archived?`, `autoInit?`, ... | **retain by default** (`:228-232`) | reconcile observes by name and converges an existing repo (`:399-456`; 422 treated as a create race): effectively **silent adopt of `beep-effect/beep-effect`** |
| `GitHub.Ruleset` (`gh/Ruleset.ts`) | `owner`, `repository`, `name`, `enforcement?`, `target?`, `conditions?{include,exclude}`, `bypassActors?`, `requiredStatusChecks?{checks[{context,integrationId}], strictRequiredStatusChecksPolicy}`, `requiredSignatures?`, `pullRequest?{...}`, `creation?`, `update?`, `deletion?`, `requiredLinearHistory?`, `nonFastForward?`, `mergeQueue?` | **retain by default** (`:305,438`) | a same-name existing ruleset is **`Unowned`** (`:600-614`): adopt or rename |
| `GitHub.BranchProtection` | classic protection props | destroy (`:565`) | — |
| `GitHub.Secret` / `GitHub.Secrets` | `owner`, `repository`, `name`/`secrets`, `value: Redacted`, `environment?` | destroy (`Secret.ts:212`) | overwrite (values are write-only) |
| `GitHub.Variable` / `GitHub.Variables` | `owner`, `repository`, `name`/`variables`, `value`, `environment?` | destroy (`Variable.ts:233`) | — |
| `GitHub.Environment` | `owner`, `repository`, `name`, `waitTimer?`, `preventSelfReview?`, `reviewers?`, `deploymentBranchPolicy?` | destroy (`:375`) | — |
| `GitHub.Label` | `owner`, `repository`, `name`, `color?`, `description?` | destroy (`:294`) | — |
| `GitHub.Webhook` (repository hook) | `owner`, `repository`, `url: Input<string>`, `events?`, `secret?`, `contentType?`, `active?` | destroy (`:244`) | — |
| Also | `Collaborator`, `TeamAccess`, `Milestone`, `Release`, `Issue`, `PersonalAccessToken`, `WikiPage`, event sources | | |

**Verified absent:** organization secrets and variables (`Secret`/`Variable` are repo or
environment scoped), self-hosted runner groups, repository Actions permissions, and the GitHub
App webhook config. distilled has all of them: `actions.createOrUpdateOrgSecret`,
`createOrgVariable`, `createSelfHostedRunnerGroupForOrg`, `updateSelfHostedRunnerGroupForOrg`,
`setRepoAccessToSelfHostedRunnerGroupInOrg`, `setGithubActionsPermissionsRepository`,
`setAllowedActionsRepository`, `setGithubActionsDefaultWorkflowPermissionsRepository`
(`~/YeeBois/references/effect/distilled/packages/github/src/services/actions.ts`) and
`apps.updateWebhookConfigForApp` / `getWebhookConfigForApp` (`.../services/apps.ts`; App JWT
auth).

## 6. Docker (`@alchemy.run/docker`)

`Docker.providers({ bin? })` (`docker/Providers.ts:30-46`) registers Container, Image, Network,
RemoteImage, Volume, Context, Service, Swarm over the Docker CLI (`DOCKER_BIN` overrides).

| Resource | Props | Delete | Adoption |
| --- | --- | --- | --- |
| `Docker.Context` (`docker/Context.ts:9-95`) | `name?`, `description?`, `docker?` endpoint spec such as `host=ssh://user@host`; "connection metadata only, never credentials"; SSH authenticates with keys/agent (`:20-27`) | `docker context rm` (`:183-189`) | `read` by name. It is a **CLI context on the deploying machine** (`~/.docker/contexts`), so a CI runner recreates it every run |
| `Docker.Container` (`docker/Container.ts:22-118,242,442`) | `image`, `context?`, `name?`, `command?`, `environment?` (Redacted ok), `envFiles?`, `ports?`, `volumes?`, `restart?: "no" \| "always" \| "on-failure" \| "unless-stopped"`, `networks?`, `healthcheck?`, resource limits, security options | destroy (`:700`) | ownership labels; else `Unowned` (`:581`) |
| `Docker.Service` (`docker/Service.ts:517`) | image or bundled `main`, `context?` (a Context or a `Docker.Swarm`), `replicas?`, `ports?`, `networks?` | destroy (`:908`) | `Unowned` unless labelled (`:646`). **Swarm only:** "The target engine must be a swarm manager ... for a plain single container on a non-swarm daemon use `Docker.Container` instead" (`:325-332`) |
| `Docker.Swarm` (`docker/Swarm.ts:57,128`) | `context?`, `advertiseAddr?`, `listenAddr?`, `defaultAddrPool?`, `subnetSize?` | | idempotent `docker swarm init` |
| `Docker.Network`, `Docker.Volume` | `context?`, driver/labels | destroy | label-gated (`Network.ts:102`, `Volume.ts:127`) |
| `Docker.Image`, `Docker.RemoteImage` | build or pull | | |

There is no Compose resource; `Container.ts:527` mentions compose only as an out-of-band
attacher. The AI metrics stack today renders a Compose file plus a systemd user unit and a
Tailscale Serve step (`infra/src/AIMetrics.ts:36,101-174,656-690`).

## 7. Test harness (`@alchemy.run/test`)

`Test.make(options)` from `@alchemy.run/test/Vitest` (`test/Vitest.ts:87-174`, over
`@effect/vitest` `it.live`) or `@alchemy.run/test/Alchemy` (the Bun runner,
`test/Alchemy.ts:106-135`). `MakeOptions` (`test/Core.ts:52-124`): `providers`, `state?`,
`profile?`, `limit?` (shared permit label for rate-limited APIs), `stage?` (default
`test_$USER`, or `ALCHEMY_TEST_STAGE`; never reads `ALCHEMY_STAGE`, `Core.ts:180-186`),
`adopt?`, `dev?`, `sidecar?`. The API is `test`, `test.provider` (no built-in cleanup; the body
calls `stack.destroy()`), `deploy`, `destroy`, `beforeAll`/`afterAll`. `WorktreeStage.worktreeStage(cwd)`
derives a stage from the git worktree (`test/WorktreeStage.ts:12-36`). Exemplar provider test:
`packages/integration-tests/test/AWS/KMS/Key.test.ts:13-80` (deploy, assert through the raw
distilled op, `Provider.findProvider(Key)` to check `list`, redeploy as no-op). The t3code relay
stack runs the same harness credential-free with `providers: Layer.empty, state: inMemoryState()`
(see `t3code-stack-patterns.md`).

## 8. distilled SDKs for the repo-owned providers

### `@distilled.cloud/vercel` (for `@beep/alchemy-vercel`)

Root barrel `dist-vercel/index.ts:9-14` (credentials, errors, traits `T`, `VercelProtocol`,
`Retry`, all services); per-service subpaths `@distilled.cloud/vercel/<service>`
(`packages/vercel/package.json:55-61`). Credentials: `VERCEL_TOKEN`, optional
`VERCEL_API_URL`, `CredentialsFromEnv`, `credentials({ token, apiBaseUrl })`; team scoping is a
per-request `teamId`/`slug` query field, not credential state (`dist-vercel/credentials.ts:4-60`).
Typed errors: `NotFound`, `BadRequest`, `Forbidden`, `UnprocessableEntity`, `PaymentRequired`,
`Gone`, `UnknownVercelError`, `VercelParseError` (`dist-vercel/errors.ts`). 41 service modules.

| Resource | Operations (`dist-vercel/services/projects.ts` unless noted) |
| --- | --- |
| `Vercel.Project` | `createProject` (`:26015`; body: `name`, `framework?`, `gitRepository?{repo,type}`, `buildCommand?`, `installCommand?`, `outputDirectory?`, `rootDirectory?`, `ssoProtection?`, `environmentVariables?`, `serverlessFunctionRegion?`, `previewDeploymentsDisabled?`, ...), `getProject` (`:26150`), `getProjects` (`:26218`), `updateProject` (`:26446`; adds `passwordProtection?`, `ssoProtection?`, `trustedIps?`, `nodeVersion?`, `gitForkProtection?`, `skewProtection*`, ...), `deleteProject` (`:26099`), `pauseProject`/`unpauseProject`, `updateProjectProtectionBypass` (`:26485`) |
| `Vercel.EnvVar` | `createProjectEnv` (`:26038`; `upsert` query, body typed only as `unknown`, `:3723-3729`), `filterProjectEnvs` (`:26133`), `getProjectEnv` (`:26201`), `editProjectEnv` (`:26116`), `removeProjectEnv` (`:26337`), `batchRemoveProjectEnv` (`:25992`); shared env vars in `services/environment.ts` (`createSharedEnvVariable`, ...); custom environments (`createCustomEnvironment`, `getProjectCustomEnvironments`) |
| `Vercel.Domain` (project domain) | `addProjectDomain` (`:25970`; `name`, `gitBranch?`, `customEnvironmentId?`, `redirect?`, `redirectStatusCode?`), `getProjectDomain` (`:26167`), `getProjectDomains` (`:26184`), `updateProjectDomain` (`:26463`), `removeProjectDomain` (`:26320`), `verifyProjectDomain` (`:26550`), **`moveProjectDomain` (`:26286`)** |
| account domains | `services/domains.ts`: `getDomain`, `getDomainConfig`, `getDomains`, `createOrTransferDomain`, `deleteDomain`, `updateDomain`, `getDomainVerificationRecord` |
| deploy evidence | `services/deployments.ts`: `getDeployments`, `getDeployment`, `createDeployment`, `cancelDeployment` |

Two things the provider must own: the env-var request body is `unknown` in the generated
types, so `Vercel.EnvVar` declares its own `effect/Schema` for `{ key, value, type, target,
gitBranch? }`; and moving `oip.law` from the live Pulumi-managed project to a greenfield one is
a `moveProjectDomain`, not a remove/add pair.

### `@distilled.cloud/aws` (for `@beep/alchemy-aws-extras` and the runner composite)

Per-service subpaths (`packages/aws/package.json:30` `./*`), e.g. `@distilled.cloud/aws/kms`.

| Need | Operations |
| --- | --- |
| KMS grant | `kms.createGrant` (`dist-aws/kms.ts:1912`), `listGrants` (`:4417`), `listRetirableGrants` (`:4728`), `retireGrant` (`:5093`), `revokeGrant` (`:5163`) |
| Compute Optimizer enrollment | `compute-optimizer.getEnrollmentStatus` (`dist-aws/compute-optimizer.ts:2836`), `updateEnrollmentStatus` (`:3308`) |
| Cost Optimization Hub enrollment | `cost-optimization-hub.listEnrollmentStatuses` (`dist-aws/cost-optimization-hub.ts:1507`), `updateEnrollmentStatus` (`:1624`), `getPreferences`/`updatePreferences` (`:1404,1654`) |
| Cost allocation tags | `cost-explorer.listCostAllocationTags` (`dist-aws/cost-explorer.ts:2875`), `updateCostAllocationTagsStatus` (`:3258`) |
| Runner launch template and fleet | `ec2.createLaunchTemplate` (`dist-aws/ec2.ts:24719`), `createLaunchTemplateVersion` (`:24752`), `modifyLaunchTemplate` (`:43531`), `describeLaunchTemplateVersions` (`:33735`), `deleteLaunchTemplate` (`:28155`), `createFleet` (`:24028`) |

### `@distilled.cloud/onepassword`

Connect, Events, Users, OAuth and Partnership APIs (`distilled/packages/onepassword/README.md`).
Alchemy ships secret providers only for Doppler and Infisical (`packages/doppler`,
`packages/infisical`). A Connect-backed `Secrets` provider is possible but not needed: `op run`
plus the implicit `Secrets.ProcessEnv` already covers the doctrine.

## 9. The pattern to copy: a distilled operation wrapped as a Resource

`aws/KMS/Alias.ts` (213 lines) is the smallest complete example:

1. Types: `AliasProps` (`:18-27`) and `interface Alias extends Resource<"AWS.KMS.Alias", AliasProps, Attributes, never, Providers>` (`:29-39`).
2. Declaration: `export const Alias = Resource<Alias>("AWS.KMS.Alias")` (`:56`).
3. Provider: `export const AliasProvider = () => Provider.succeed(Alias, { stables, list, read, diff, reconcile, delete })` (`:58-161`).
   - `stables: ["aliasName", "aliasArn"]` (`:60`): attributes that never change across updates.
   - `list` (`:61-86`): paginate with `kms.listAliases.pages({}).pipe(Stream.runCollect)`.
   - `read` (`:87-92`): `return output ? state : Unowned(state)`, i.e. adopt only what state proves it owns.
   - `diff` (`:93-98`): `if (!isResolved(news)) return;` then `{ action: "replace" }` on an identity change.
   - `reconcile` (`:99-141`): observe, create if missing (`catchTag("AlreadyExistsException")`), converge drifted fields, re-read, `session.note(...)`; retries on eventual consistency with `Effect.retry({ while, schedule })`.
   - `delete` (`:142-160`): `catchTag("NotFoundException", () => Effect.void)`, then poll until gone.
4. Physical names: `createPhysicalName({ id, maxLength })` (`alchemy/PhysicalName`) when the prop is omitted (`:163-172`).
5. Registration: the resource joins `Provider.collection([...])` and its provider layer joins `Layer.mergeAll(...)` in `AWS.providers()` (`aws/Providers.ts:690-691`). A repo package exports its own `providers()` built the same way (`docker/Providers.ts:30-46` is the compact template) and the stack merges it beside `AWS.providers()`.
6. Credentials: the provider calls distilled ops directly; `Region`, `Credentials`, `Endpoint` and `Retry` arrive from the layers `AWS.providers()` `provideMerge`s (`aws/Providers.ts:1905-1922`). A sibling repo collection must be provided those same layers (`Layer.provide(AWS.providers())` or the exported `Region.fromEnvironment`/`Credentials.fromEnvironment`); prove which in the P2 spike.
7. Test: `packages/integration-tests/test/AWS/KMS/Key.test.ts` shape (section 7).

## Sources

Checkout paths (all `~/YeeBois/references/effect/...`):

- `alchemy/packages/alchemy/src/{index.ts,Stack.ts,Stage.ts,AdoptPolicy.ts,RemovalPolicy.ts,Namespace.ts,Random.ts,Output.ts,Provider.ts,Resource.ts}`
- `alchemy/packages/alchemy/src/Command/{index.ts,Command.ts,Exec.ts,Build.ts,Providers.ts}`
- `alchemy/packages/alchemy/src/Secrets/{index.ts,DotEnv.ts,ProcessEnv.ts}`
- `alchemy/packages/alchemy/src/State/{BucketState.ts,Provisioning.ts,Export.ts,index.ts}`, `src/Alchemist/State.ts`, `src/Cli/commands/{state.ts,flags.ts}`, `packages/alchemy/package.json`
- `alchemy/packages/aws/src/StateStore/{Store.ts,State.ts,DynamoDBState.ts,Migration.ts}`, `src/Providers.ts`, `src/Environment.ts`, `src/Region.ts`, `src/Credentials.ts`
- `alchemy/packages/aws/src/{EC2/Network.ts,EC2/FlowLog.ts,AutoScaling/LaunchTemplate.ts,AutoScaling/AutoScalingGroup.ts,AutoScaling/LifecycleHook.ts,IAM/Role.ts,IAM/Policy.ts,IAM/InstanceProfile.ts,KMS/Key.ts,KMS/Alias.ts,KMS/KeyBinding.ts,Lambda/Function.ts,Lambda/Permission.ts,SQS/Queue.ts,EventBridge/Rule.ts,SSM/Parameter.ts,Logs/LogGroup.ts,S3/Bucket.ts,Budgets/Budget.ts,CostExplorer/AnomalyMonitor.ts,CostExplorer/AnomalySubscription.ts}`
- `alchemy/packages/cloudflare/src/{R2/Bucket.ts,R2/S3Credentials.ts,DNS/Record.ts,Workers/Worker.ts,ApiToken/AccountApiToken.ts,Alerting/,StateStore/State.ts}`
- `alchemy/packages/github/src/{Providers.ts,Credentials.ts,Repository.ts,Ruleset.ts,Secret.ts,Secrets.ts,Variable.ts,Variables.ts,Environment.ts,Label.ts,Webhook.ts,BranchProtection.ts}`, `packages/github/package.json`
- `alchemy/packages/docker/src/{Providers.ts,Context.ts,Container.ts,Service.ts,Swarm.ts,Network.ts,Volume.ts}`
- `alchemy/packages/alchemy-test/src/{index.ts,Vitest.ts,Alchemy.ts,Core.ts,WorktreeStage.ts}`, `packages/integration-tests/test/AWS/KMS/Key.test.ts`
- `alchemy/stacks/src/github.ts`, `alchemy/.gitmodules`
- `distilled/packages/vercel/{package.json,src/index.ts,src/credentials.ts,src/errors.ts,src/services/{projects,domains,environment,deployments}.ts}`
- `distilled/packages/aws/{package.json,src/services/{kms,compute-optimizer,cost-optimization-hub,cost-explorer,ec2}.ts}`
- `distilled/packages/github/src/services/{actions,apps}.ts`, `distilled/packages/onepassword/README.md`

Repo paths (this worktree): `package.json`, `apps/beep-effect-web/alchemy.run.ts`,
`infra/src/{CiFleetController,AIMetrics,OipWeb}.ts`, `goals/beep-effect-web-alchemy/SPEC.md`.

Registry: `npm view alchemy dist-tags`, `npm view @alchemy.run/aws@2.0.0-beta.85 dependencies peerDependencies`,
`npm view @distilled.cloud/vercel dist-tags` (2026-11-06); https://www.npmjs.com/package/alchemy,
https://www.npmjs.com/package/@distilled.cloud/vercel.
