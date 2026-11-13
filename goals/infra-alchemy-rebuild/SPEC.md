# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired Spec

## Objective

Replace every Pulumi program under `infra/` with Alchemy stacks written as Effect code over
`alchemy`, `@alchemy.run/*` and `@distilled.cloud/*`, rebuilt from scratch under new physical
names so Alchemy owns all state, then delete `infra/`, the Pulumi CLI dependency, the TypeScript 6
pin and the Python and shell that lived there. The estate afterwards: CI runner fleet, turbo
cache, cost controls, GitHub repository settings, OIP web hosting, Storybook, and the two host
deployments (AI metrics on dankserver, OpenClaw), each a canonical `@beep/*` package or an
`alchemy.run.ts` beside its app.

Graduated 2026-11-06 from [`explorations/pulumi-to-alchemy`](../../explorations/pulumi-to-alchemy/README.md);
decisions D1–D16 in its `DECISIONS.md` (2026-11-06 session) are binding and are restated here as
constraints. Sibling packets: [`scripts-to-beep-cli`](../scripts-to-beep-cli/README.md) (owns
`beep github app mint`, the compiled `beep` binary and `scripts/` retirement) and
[`python-free-repo`](../python-free-repo/README.md) (owns the Python ban; this packet deletes
`infra/r2-cache/*.py` as part of its own cleanup).

## Non-Goals

- Changing what the infrastructure does: no new services, no hosting-platform change for OIP
  (stays on Vercel), no runner-economics change (self-hosted fleet stays).
- Adopting live Pulumi resources in place. Everything is greenfield (D12) except the singletons
  D20 lists (repository, rulesets, existing DNS records, oip.law Vercel domains, `BeepEffectWeb`
  into the shared store), each adopted per object and named in a decision file.
- Minting GitHub Apps from IaC (D10); app creation is a beep command in `scripts-to-beep-cli`.
- Porting `scripts/` or the historical Python outside `infra/` (sibling packets).
- Upstreaming providers before they are stable here (D14 says in-repo first).
- The `@alchemy.run/domain` work in `goals/alchemy-vault-sync-slice` (application domain, not IaC).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

New (every package via `bun run beep create-package`; new tooling kind `infra`, doctrine
amendment in `standards/architecture/07-non-slice-families.md` and `DECISIONS.md`):

- `@beep/infra-ci-runners` (tooling kind `infra`): VPC, security groups, flow logs,
  the runner composite, reaper Lambda, fleet controller SSM/IAM/KMS.
- `@beep/infra-turbo-cache` (tooling kind `infra`): the Cloudflare Worker + R2
  cache moved from `scratchpad/turbo-cache-r2` (moved, then the scratchpad module is deleted).
- `@beep/infra-cost-controls` (tooling kind `infra`): budget, anomaly monitor
  and subscription, cost-allocation tags, Compute Optimizer and Cost Optimization Hub enrollment.
- `@beep/infra-github` (tooling kind `infra`): repository settings, rulesets
  (including the beep-reviewer advisory switch), Actions secrets and variables, environments,
  labels, webhooks for `beep-effect/beep-effect`.
- `@beep/infra-hosts` (tooling kind `infra`): AI metrics on dankserver via
  `Docker.Context` over SSH plus `Docker.Container`/`Network`/`Volume` (`Docker.Service` is
  swarm-only); OpenClaw via `Command.Exec` (delete is a no-op, stdout is not an output).
- `@beep/alchemy-vercel` (tooling library): `Project`, `EnvVar`,
  `Domain` resources over `@distilled.cloud/vercel`.
- `@beep/alchemy-aws-extras` (tooling library):
  `CostAllocationTag`, `ComputeOptimizerEnrollment`, `CostOptimizationHubEnrollment`,
  `RunnerLaunchTemplate` (gp3 root volume, EBS-optimised, Spot options Alchemy's
  `LaunchTemplate` lacks); `KmsGrant` only if the P2 key-policy check shows an IAM condition
  cannot replace the six grants (D19).
- `@beep/alchemy-github-runners` (tooling library): the
  runner composite (webhook, SQS, scale-up via EC2 `CreateFleet` Spot launches, scale-down,
  launch template, SSM, syncer, termination watcher; Lambdas ported to Effect and bundled by
  Alchemy, D19) with MIT attribution to `github-aws-runners/terraform-aws-github-runner`.
- an `alchemy.run.ts` beside `apps/oip-web` and beside `apps/storybook`.
- `apps/beep-effect-web/alchemy.run.ts`: state store switched to the shared S3 store.
- `.github/workflows/*`: Alchemy deploy jobs per stack (prod only from `main`, concurrency group
  per stack), fleet and cache re-enrollment.
- `docs/runbooks/`: one runbook per stack family; Pulumi runbooks deleted or rewritten.

Deleted at the end: `infra/` (every file), `scratchpad/turbo-cache-r2`, `@pulumi/*` and
`@pulumiverse/*` catalog entries, `infra/pulumi-typescript6.cjs`, the `typescript ^6` syncpack
group, `infra:prepare-gha-runners` in root `postinstall`, `infra` in root `workspaces`.

## Constraints

- Effect-first and schema-first repo laws apply to every new package exactly as to any `@beep/*`
  package: `effect/<Module>` leaf imports, `Effect.fn`/`fnUntraced`, `HashMap`/`HashSet`, no
  `node:crypto` or `node:http` where `effect/*` provides the module, no async/await outside
  framework-owned boundaries, `tsgo` diagnostics enforced, tests under `test/` with `@beep/*`
  imports, JSDoc per `.patterns/jsdoc-documentation.md`, `package-verify` before handoff.
- No Python, no shell scripts, no Markdown other than the package README and the runbook.
- Alchemy pins are npm catalog entries (`alchemy`, `@alchemy.run/*`, `@distilled.cloud/*`), bumped
  in their own PR with `alchemy plan` no-op on every stack (D13). No frozen tool clones, no git-ref
  pins. The Alchemy and distilled reference checkouts provisioned by `bun run beep refs provision`
  are for research and for proving an unreleased fix before a bump. A fix already merged upstream but
  not yet released may ride as a bun `patchedDependencies` patch on the pinned version, recorded
  in `research/t3code-alchemy-patches.md`-style notes and removed in the bump that ships it.
- Use what Alchemy and distilled ship before writing anything: the P0 "use this, never roll
  that" matrix is the gate for every new resource or helper (D16). A repo-owned resource exists
  only where the matrix records a verified gap.
- Repo-owned resources follow Alchemy's provider conventions (`infrastructure-as-code/provider`,
  `custom-provider`, `testing/testing-providers`) and the `@alchemy.run/test` harness, so the
  generic ones (Vercel, KMS Grant, cost tag, enrollments) can go upstream unchanged (D14).
- One state store: `AWS.state({ backend: "s3", encryption: <kms> })` in the existing account, new
  bucket named in the account-regional `<prefix>-<accountId>-<region>-an` form, bootstrapped once
  with Alchemy's own bootstrap commands under `AWS_PROFILE=elpresidank-vault` (D6, D17, D18).
  Every stack declares it; `prod` stages deploy only from CI under a concurrency group, except
  `@beep/infra-hosts` (D21, Exception Ledger).
- Credentials flow through `op run` with `op://` references; never `alchemy profile`, never
  checked-in ciphertext. Pulumi `secure:` values move to 1Password references (G8).
- Cutover per stack (D12): deploy beside the live Pulumi stack under new names, verify, flip,
  `pulumi stack export` archived outside the repo, `pulumi destroy`, then delete the program.
  Order: storybook, turbo cache, cost controls, GitHub, OIP, hosts, runner fleet last.
- Turbo cache requirements carried from the AWS cache and the r2 pilot (D7): per-team tokens,
  signed-policy semantics (CI writes only from protected `main` and named trusted workstations,
  same-repo PR jobs read-only, forks local-only), the cache-input baseline review
  (`infra/r2-cache/cache-input-review.md` content preserved in the package README), and a
  throttle or error-rate alarm equivalent.
- `goals/repo-cli-gh-git-consolidation` is a requirement, not a dependent (D10).
- `beep reviewer ruleset release|require` becomes a stage config flag on `@beep/infra-github`;
  the CLI stops editing rulesets once the stack owns them (D20).
- `scratchpad/turbo-cache-r2` is on branch `@chore/deps-update-11-6-26`; it must land on `main`
  before P3 moves it.
- Every irreversible step (destroying a Pulumi stack) lands its reversal path first: the exported
  state archive location and a `pulumi stack import` recipe recorded in a decision file.

## Acceptance Criteria

- [ ] P0 research reports exist under `research/` (docs catalog, source-pattern inventory,
      t3code stack patterns, blog catalog, the "use this, never roll that" matrix) and the
      matrix has been reviewed before any P1 package is scaffolded.
- [ ] Each target package exists via `create-package`, passes
      `bun run beep quality package-verify <pkg>`, and has stack tests on the `@alchemy.run/test`
      harness.
- [ ] `alchemy plan` for every stack shows no create or replace against its live stage after
      cutover, `alchemy drift` is clean, and the shared S3 state store lists every stack
      including `BeepEffectWeb` (`plan` has no changes-pending exit code; GitHub secrets
      re-upload by design).
- [ ] CI runs on the Alchemy-built runner fleet; `heavy.yml` and `check.yml` enrolled against the
      Worker turbo cache with hit evidence from a `main` run and a PR run.
- [ ] oip.law production and staging serve from the Alchemy-managed Vercel project, env vars and
      domains; DNS and the assets bucket are Alchemy-owned.
- [ ] GitHub rulesets, secrets, variables, environments and labels are reconciled by
      `@beep/infra-github` with `alchemy drift` clean.
- [ ] AI metrics and OpenClaw deploy through `@beep/infra-hosts`.
- [ ] `infra/` and `scratchpad/turbo-cache-r2` are deleted; no `@pulumi/*` in any manifest or
      lockfile; no `typescript ^6` pin; root `postinstall` no longer builds the ghaRunners SDK.
- [ ] Every Pulumi stack destroyed has a decision file naming its state export archive.
- [ ] Doctrine amended: tooling kind `infra` in `07-non-slice-families.md`, a dated entry in
      `standards/architecture/DECISIONS.md`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/infra-alchemy-rebuild/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/infra-alchemy-rebuild/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/infra-alchemy-rebuild` | Passes |
| Package gates | `bun run beep quality package-verify @beep/infra-<name>` per package | Passes |
| Stack plan | `op run --env-file=<lane env> -- bunx alchemy plan --stage prod` per stack | no create/replace after cutover |
| Drift | `bunx alchemy drift --stage prod` per stack | clean |
| Pulumi gone | `rg -n '@pulumi|pulumiverse|typescript6' package.json packages apps bun.lock` | no matches |
| Infra gone | `test ! -d infra && test ! -d scratchpad/turbo-cache-r2` | Passes |
| Cache hits | hosted run logs showing `turbo` remote hits on the Worker URL | present for main and PR |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator. Brief double-running cost during a stack cutover is pre-authorised (D12).
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add infra-alchemy-rebuild --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug infra-alchemy-rebuild`; add a `kind: decision` file there, never edit this block._

### Carry the upstream Artifacts.cached fix as a bun patch on alchemy beta.85, 2026-11-09

`alchemy@2.0.0-beta.85` leaves every later caller of a failed `Artifacts.cached` id waiting forever (`lib/Artifacts.js` resolves the `Deferred` only on success). Upstream `main` fixed it (`packages/alchemy/src/Artifacts.ts`, `Effect.onExit` with `Deferred.done`, success cached, failure evicted). The same change rides as `patches/alchemy@2.0.0-beta.85.patch` through bun `patchedDependencies`, keeping the npm pin intact (D13; `research/t3code-alchemy-patches.md`). The first bump past beta.85 drops the patch after `grep -n onExit node_modules/alchemy/lib/Artifacts.js` confirms the release carries it.

Lane goals/infra-alchemy-rebuild-p1

Reverse: Delete patches/alchemy@2.0.0-beta.85.patch and its patchedDependencies entry in the bump PR that ships the fix.

### BeepEffectWeb re-adopts into the shared store by name, adopt only on dispatch, 2026-11-09

`BeepEffectWeb` moves from `Cloudflare.state()` to the shared S3 store by code change only (`apps/beep-effect-web/alchemy.run.ts`): Alchemy has no Cloudflare-to-AWS state migration, so the first `prod` deploy against the empty S3 stage reads every resource by name. `Cloudflare.Worker` (custom domain and redirects included) reports plain attributes, so it adopts silently; nothing in the stack is `Unowned`. The deploy workflow gains a `workflow_dispatch` input `adopt` that passes `--adopt` for the one case a read reports `Unowned`; it is never set on push. The old state objects stay in the Cloudflare Durable Object store untouched and are deleted only after the S3 plan shows no create or replace. Acceptance per the P0 note: plan shows no create or replace, `alchemy drift` clean.

Lane goals/infra-alchemy-rebuild-p1

Reverse: Set state back to Cloudflare.state() in apps/beep-effect-web/alchemy.run.ts and drop the AWS credentials step; the Cloudflare store still holds the previous prod state.

### GitHub OIDC provider and state-only deploy role are bootstrap singletons, 2026-11-09

GitHub Actions reaches the shared state store through two bootstrap singletons created 2026-11-09 under `AWS_PROFILE=elpresidank-vault` (IAM user, account 832907639880): the OIDC provider `arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com` (audience `sts.amazonaws.com`) and the role `arn:aws:iam::832907639880:role/beep-alchemy-state-rw` (inline policy `alchemy-state-bucket-rw`: bucket configuration reads and writes plus object get/put/delete on `alchemy-state-832907639880-us-east-1-an`, nothing else; trust restricted to `repo:beep-effect/beep-effect:environment:beep-effect-web-prod`). The ARN is the `ALCHEMY_STATE_ROLE_ARN` variable on the `beep-effect-web-prod` GitHub environment. Both carry tags `beep:owner=infra-alchemy-rebuild`, `beep:bootstrap=state-store`. Each later stack adds its environment subject to the trust policy; stacks that manage AWS resources get their own scoped deploy role. `@beep/infra-ci-runners` adopts the provider and role with `adopt(true)` in P5 (one decision file each), per D20.

Lane goals/infra-alchemy-rebuild-p1

Reverse: aws iam delete-role-policy --role-name beep-alchemy-state-rw --policy-name alchemy-state-bucket-rw; aws iam delete-role --role-name beep-alchemy-state-rw; aws iam delete-open-id-connect-provider --open-id-connect-provider-arn arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com; gh variable delete ALCHEMY_STATE_ROLE_ARN --env beep-effect-web-prod.

### Org runner group and GitHub App webhook URL stay outside IaC, 2026-11-09

Open question 4 of the P0 matrix. The `beep-ec2-heavy` org runner group and the GitHub App webhook URL stay outside IaC: the runner group remains an org setting recorded in the ci-runners runbook, and the App webhook URL is set by the `beep github app` command family that D10 already makes the App's owner. `@alchemy.run/github` has no runner-group or App resource and token-only credentials, so owning either means two repo resources with App-JWT auth for two objects that change once per fleet rebuild. Revisit in P5 only if a runbook step drifts in practice.

Lane goals/infra-alchemy-rebuild-p1

Reverse: Add RunnerGroup and an App-webhook resource over distilled actions/apps to @beep/alchemy-github-runners and adopt both objects.

### Shared S3 state store: default account-regional bucket, SSE-KMS with the AWS-managed key, 2026-11-09

The shared store is the account-regional default S3 bucket `alchemy-state-832907639880-us-east-1-an` (D6, D17): `AWS.state({ backend: "s3", encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] } })`, declared in `apps/beep-effect-web/alchemy.run.ts` and copied verbatim by every later stack. Encryption is SSE-KMS with the AWS-managed S3 key rather than a customer-managed key: redacted outputs are still KMS-protected at rest, the CI state role needs no key-policy grant, and the store has no key to bootstrap before itself; a customer-managed key is a later `kmsMasterKeyId` edit (existing objects are not rewritten). Bootstrapped 2026-11-09 from `apps/beep-effect-web` with the aws-vault session exported into the environment (`eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`, `AWS_REGION=us-east-1`), then `bunx alchemy state bootstrap --no-input` and `bunx alchemy state list --no-input`; Alchemy's resolver takes environment credentials first and otherwise an Alchemy profile, never `AWS_PROFILE` on its own, and the repo uses no Alchemy profiles (no `aws login`, no `alchemy profile`). Receipt: `State store configured in 'alchemy.run.ts' is ready (v5)`; bucket verified with `aws s3api get-bucket-encryption` (aws:kms, bucket key on, SSE-C blocked), versioning and public-access block. The Lambda assets bucket (`alchemy provider aws bootstrap`, D18) is deferred to the first stack that deploys a Lambda (`@beep/infra-ci-runners`), since no earlier stack needs `AWS.providers()`.

Lane goals/infra-alchemy-rebuild-p1

Reverse: After every stack is destroyed: bunx alchemy state teardown --backend aws --yes under the same profile; the bucket is deleted with its objects.

### Storybook deploys as a Cloudflare StaticSite, not through the Vercel provider, 2026-11-09

Open question 8 of the P0 matrix. Storybook deploys through `Cloudflare.Website.StaticSite` in `apps/storybook/alchemy.run.ts`, not through `@beep/alchemy-vercel`. The Pulumi Storybook program was never applied, so nothing is live to flip; StaticSite needs no new provider and no Vercel seat, and it matches `apps/beep-effect-web` (the one live stack, also Cloudflare). D3 scoped the Vercel resources to OIP, "and Storybook if it stays on Vercel"; it does not. `@beep/alchemy-vercel` stays exactly the three OIP resources.

Lane goals/infra-alchemy-rebuild-p1

Reverse: Replace the StaticSite in apps/storybook/alchemy.run.ts with Vercel.Project/Domain from @beep/alchemy-vercel once that library exists; no live resource depends on the choice.

### Pin the prod Worker name; adopt-by-name needed it, 2026-11-12

Amends the decision 'BeepEffectWeb moves to the S3 store by code change only'. Its premise, that the first prod deploy against the empty S3 stage reads every resource by name and adopts silently, did not hold for the Worker: Alchemy names a Worker {stack}-{stage}-{id}-{instanceId} with a random instance id kept in state, so the empty stage minted beepeffectweb-website-prod-cbwmlwzgibgw7skx. That Worker could not take beep-effect.com from the live beepeffectweb-website-prod-lu7dco5dnf2llcs2, and Deploy beep-effect-web (prod) failed on every push from #3021 (2026-11-09) to 2026-11-12. Both Workers carry the alchemy:stack:BeepEffectWeb, alchemy:stage:prod and alchemy:id:Website tags (read 2026-11-12), and the S3 record is a creating checkpoint without attributes. With the prod name pinned, the planner's recovery read finds the orphan, the explicit name forces a replace, the replacement observes the live Worker as owned and adopts it without --adopt, and the replace then deletes the orphan. Agent-proposed with the operator's go-ahead on 2026-11-12.

Lane fix/beep-effect-web-prod-worker-name

Reverse: Remove productionWorkerName from apps/beep-effect-web/alchemy.run.ts once the S3 state holds a completed Website record; the generated name then stays authoritative.

### App JWTs come from distilled GitHub App.appJwt; distilled pins follow main at rc.19, 2026-11-13

The GitHub-facing Lambdas authenticate as the fleet's GitHub App: `GitHubAppAuth` reads the App id and base64 PEM key from SSM once, signs the App JWT with `@distilled.cloud/github/App` `appJwt` (RS256 over WebCrypto, PKCS#1 and PKCS#8 keys), and mints installation tokens through distilled `apps.createInstallationAccessToken`. A first draft signed the JWT itself because `@distilled.cloud/github@1.0.0-rc.18` had no App module; main moved the distilled family to `1.0.0-rc.19` with #3278 (Alchemy beta.86), which ships it, so the hand-rolled signer was deleted. Root catalog pins `@distilled.cloud/aws` and `@distilled.cloud/github` follow the version `bun.lock` resolves on main, `1.0.0-rc.19`. The webhook HMAC-SHA256 check stays on `crypto.subtle` with a constant-time compare: Effect ships no HMAC module.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Pin @distilled.cloud/aws and @distilled.cloud/github back to rc.18 and restore a WebCrypto RS256 signer (rc.18 has no App module).

### github-runners ships as two sequential PRs: Lambdas first, composite second, 2026-11-13

`@beep/alchemy-github-runners` is about 6,500 lines before the composite (schemas, six service contracts, two distilled-backed live layers, seven Lambda programs and their entry points, 42 hermetic tests). The lane ships it as two sequential PRs, one open at a time: PR 1 carries the schemas, service contracts, live layers, Lambda programs and tests; PR 2 adds the runner user data, `RunnerSweep`, the `RunnerFleet` composite and its harness tests, and composes `RunnerLaunchTemplate` from `@beep/alchemy-aws-extras` if that has landed. PR 2 opens after PR 1 merges.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Fold the second PR's resources and composite into one PR if the first has not merged yet.

### One webhook per fleet routes jobs to every pool's build queue, 2026-11-13

The live fleet runs one terraform module per pool, so the heavy and shard-overflow pools each have a webhook and a webhook secret. The port follows upstream's multi-runner design instead: one webhook Lambda per fleet holds a matcher per pool (labels, match mode, build-queue URL), tries strict matchers (bidirectional or all-of) before any-of ones and sends the job to the first match. Two pools therefore need one App webhook URL and one secret; the overflow pool's separate secret parameter is not carried over.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Give each pool its own webhook Lambda and WebhookRuntimeConfig with a single matcher.

### Runner Lambdas port terraform-aws-github-runner v7.10.1 without the features the live fleet leaves off, 2026-11-13

The handlers port `lambdas/functions/{webhook,control-plane,termination-watcher,gh-agent-syncer}` at v7.10.1, the version `infra/ci-runners/Pulumi.yaml` pins, as Effect programs over six service contracts (`GitHubAppAuth`, `GitHubRunners`, `Ec2Fleet`, `SsmStore`, `MessageQueue`, `RunnerBinaries`). Wire shapes stay upstream's: the SQS `ActionRequestMessage`, the `ghr:*` EC2 tags and the SSM token layout. Left out because the live fleet does not use them: dynamic `ghr-*` labels, dedicated hosts (`RunInstances`), the warm pool (`adjustPool`), the EventBridge webhook mode and queue-selection strategies other than first match, the AMI housekeeper, GitHub Enterprise base URLs in registration-token mode, and Powertools metrics and X-Ray. `jobQueuedCheck` defaults to false (the live value; upstream's default is true). Partial-launch, cap and retry semantics match upstream, including the on-demand failover for configured `CreateFleet` error codes.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Port the left-out upstream feature from lambdas/functions at v7.10.1 into the matching program and add its config field.

### Runner user data supports Amazon Linux and Ubuntu and reads its token path from instance tags, 2026-11-13

The user data ports upstream's `user-data.sh`, `install-runner.sh` and `start-runner.sh` without X-Ray, the CloudWatch agent or the SSM config-path lookup: scale-up tags each instance with `ghr:token_path` and `ghr:runner_name_prefix`, and the script reads them through IMDSv2 metadata tags, so a pool needs no SSM config parameters. The live fleet controller pins `ciFleetController:amiId` (`infra/ci-runners/Pulumi.production.yaml`; the AL2023 default parameter in `infra/src/CiFleetController.ts`; boot-time `dnf upgrade-minimal`), while the Ubuntu 24.04 parameter in `infra/ci-runners/Pulumi.yaml` configures the `CiRunners` groundwork stack. The script picks dnf or apt-get from `/etc/os-release` (installing AWS CLI v2 on Ubuntu), so either image works; the runner still starts with `./run.sh` from `/opt/actions-runner`, which keeps the live post-install shim working.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Bake run_as, token path and agent mode back into SSM config parameters read by the user data, as upstream's start-runner.sh does.

### RunnerFleet owns the App secret parameters under its own KMS key and serves the webhook from a function URL, 2026-11-13

The composite declares one KMS key and alias per fleet and writes the App id, base64 key and webhook secret as SecureString `SSM.Parameter`s under it from caller-supplied `Redacted` values (nothing here reads 1Password or mints an App). Lambda roles read them through `bind` inline policies; the termination watcher's `kms:Decrypt` carries `kms:EncryptionContext:PARAMETER_ARN` for the id and key parameters, so no KMS grant exists. The webhook is a public Lambda function URL (the module used API Gateway); `RunnerSweep` depends on each pool's scale-up function so destroy sweeps runtime instances first.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Take existing parameter ARNs as inputs and drop the composite's KMS key and SSM parameters.

### RunnerFleet takes the launch template as a typed input until aws-extras lands, 2026-11-13

`@beep/alchemy-aws-extras` (and its `RunnerLaunchTemplate`) was not on `origin/main` when the composite was written. `RunnerFleet` therefore owns each pool's runner role and instance profile and renders its user data, and hands them to a caller-supplied `launchTemplate(spec)` effect that returns a launch template id and version (`RunnerLaunchSpec` -> `RunnerLaunchTemplateRef`). The template must require IMDSv2 and enable instance metadata tags. Once `RunnerLaunchTemplate` lands, the composite composes it by default and the input becomes an override.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Replace the launchTemplate input with a RunnerLaunchTemplate declared inside the composite from RunnerLaunchSpec.

### Termination watcher uses EC2 state-change events, not CloudTrail BidEvictedEvent, 2026-11-13

Upstream's spot termination handler listens for the CloudTrail `BidEvictedEvent`, which needs a trail. The port deregisters on `EC2 Spot Instance Interruption Warning` and on `EC2 Instance State-change Notification` (`shutting-down`, `terminated`), both native EventBridge events, so no trail is required and an instance stopped for any reason is deregistered. One Lambda handles both events and the deregister-retry queue (busy runner: GitHub 422, re-queued after 300 s; a record that keeps failing reaches the queue's DLQ). Metrics are not ported.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Add an EventBridge rule on the CloudTrail BidEvictedEvent and decode it in TerminationEvent.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Pulumi stays installed per stack until that stack's cutover | `infra/` | packet owner | destroy needs the CLI and program | the stack's `pulumi destroy` receipt |
| `@beep/infra-hosts` prod deploys from the operator workstation, never CI | one stack | packet owner | dankserver is reachable only over the YubiKey SSH route; S3 state lease is the overlap guard (D21) | a runner with a scoped deploy key to dankserver |
