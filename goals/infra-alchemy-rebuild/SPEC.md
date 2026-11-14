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

### aws-extras resource shape: BeepAWS types, schema props, a narrowed export, 2026-11-13

Four calls in `@beep/alchemy-aws-extras`. (1) Resource types use a `BeepAWS.` prefix (`BeepAWS.CostExplorer.CostAllocationTag`, `BeepAWS.ComputeOptimizer.Enrollment`, `BeepAWS.CostOptimizationHub.Enrollment`, `BeepAWS.EC2.RunnerLaunchTemplate`) so a future upstream `AWS.*` resource of the same name cannot collide with ours in one provider registry; the upstream PR renames them and keeps the old names in `ResourceOptions.aliases`. (2) Props and attributes are branded `S.Opaque` schemas with `LiteralKit` literals per the repo schema-first law. Each resource contract is a type alias `Resource<type, Props.Encoded, Attributes.Encoded, never, Providers>`, so callers pass plain objects, and `reconcile` decodes props before any AWS call, failing with `InvalidResourceProps`; an upstream port replaces `LiteralKit` and the `$I` annotations with plain `Schema` literals. (3) The repo `missingPipeableSignature` diagnostic rejects the `(id, Effect<props>)` overload of Alchemy `ResourceClass` on an exported value and diagnostic directives are not allowed, so each resource is built with `Resource(...)` internally and exported through `ExtrasResource`, which keeps only the `(id, props)` form; the runtime value is unchanged. (4) The package exports `providers` as a Layer constant rather than `providers()`, because `lazyEffect` rejects a zero-argument Layer factory.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Rename the types to AWS.* with the old names as Resource aliases, swap the schemas for plain interfaces, and export Alchemy's ResourceClass directly once the repo diagnostics allow it.

### Drop KmsGrant: the GitHub App KMS key delegates to IAM, 2026-11-13

D19 left `KmsGrant` open until the key policy was read. It was read on 2026-11-13 (`aws kms get-key-policy --key-id 79ab38d9-2a9d-426b-b704-beb6fc5c971d`): the GitHub App KMS key has one statement, "Enable IAM User Permissions", granting `kms:*` to the account root principal. The key therefore delegates authorization to IAM. In the native runner composite the stack owns the termination-watcher roles, so an IAM inline policy granting `kms:Decrypt` with a `kms:EncryptionContext:PARAMETER_ARN` condition replaces the six `aws.kms.Grant` resources the Pulumi program carried for the upstream module (`infra/src/CiFleetController.ts`). `@beep/alchemy-aws-extras` ships no `KmsGrant`; the IAM policy belongs to `@beep/alchemy-github-runners`.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Add a KmsGrant resource over distilled kms.createGrant / retireGrant to @beep/alchemy-aws-extras and grant the termination-watcher roles through it.

### Provider tests run against an in-process fake AWS HTTP client, 2026-11-13

The `@alchemy.run/test` suites for `@beep/alchemy-aws-extras` run in hosted CI with no AWS credentials. `test/support/FakeAws.ts` is an in-memory account behind an effect `HttpClient`: distilled still signs, serializes (awsJson 1.1 and the EC2 query protocol) and parses every call, and only the transport is fake. Each test covers create, update, delete, read and adopt through `test.provider` and `stack.deploy` / `destroy` with `inMemoryState()`. A live mutation suite is out: the singletons are live settings in account 832907639880 and there is no separate test account. `test/integration/LiveRead.test.ts` runs only with `BEEP_ALCHEMY_AWS_EXTRAS_LIVE=1` and calls `read` only; on 2026-11-13 it read all six cost allocation tags and both enrollments as Active.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Replace test/support/FakeAws.ts with live tests under the alchemy-test runner against a dedicated test account.

### Pulumi stack beep-storybook/production is removed; it held no resources, 2026-11-13

The Pulumi Storybook program was never applied: `pulumi stack ls` in `infra/storybook` (backend `s3://oip-law-pulumi-state`) showed `production` with 0 resources, last updated five months ago. `pulumi stack export --stack production` was archived 2026-11-13 outside the repo at `~/.local/state/beep/infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json` (493 bytes, deployment version 3, 0 resources, 0 pending operations, sha256 `fde291a6f1488725c2dd0285b4bd25491578b95deb4d8e9b0823dd33f2448bbf`). `pulumi stack rm production --yes` runs after this decision merges. There is nothing to destroy and nothing to flip. The program sources (`infra/storybook`, `infra/src/Storybook.ts`) leave with the rest of `infra/` in P6; the Vercel config file beside the Storybook app is deleted now because no Vercel project reads it.

Lane goals/infra-alchemy-rebuild-p3-storybook

Reverse: From infra/storybook under AWS_PROFILE=elpresidank-vault: pulumi stack init production, then pulumi stack import --file ~/.local/state/beep/infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json.

### RunnerLaunchTemplate lives in @beep/alchemy-aws-extras, 2026-11-13

The P0 matrix row placed `RunnerLaunchTemplate` in `@beep/alchemy-github-runners`; SPEC Target Surfaces and the P2 brief place it in `@beep/alchemy-aws-extras`. It lands in aws-extras: it is a generic EC2 resource (block devices, EBS optimisation, Spot options, tag specifications) with no runner semantics, which is what aws-extras holds and what goes upstream as props on `AWS.AutoScaling.LaunchTemplate`. The runner composite imports it. Its props cover the live fleet template in `infra/src/CiFleetController.ts` lines 976-1062: the AL2023 AMI through `resolve:ssm:`, a 100 GB encrypted gp3 `/dev/xvda` at 3000 IOPS and 250 MB/s, EBS optimisation, IMDSv2 with hop limit 1 and instance tags, the instance profile, security groups, a public IPv4 address, user data and launch tags.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Move src/RunnerLaunchTemplate.ts and its test into @beep/alchemy-github-runners and re-export it there; the resource type string does not change.

### storybook-prod GitHub environment and its state-role subject are bootstrap singletons, 2026-11-13

Created 2026-11-13 for `.github/workflows/deploy-storybook.yml`, by hand because `@beep/infra-github` does not exist yet: GitHub environment `storybook-prod` (custom branch policy, `main` only), its variable `ALCHEMY_STATE_ROLE_ARN`, and its secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (piped from the 1Password references the `beep-effect-web-prod` environment uses, values never printed). The trust policy of role `beep-alchemy-state-rw` now lists two subjects: `repo:beep-effect/beep-effect:environment:beep-effect-web-prod` and `repo:beep-effect/beep-effect:environment:storybook-prod`. The Cloudflare token can read the zone's Worker routes (none existed before this stack); the first prod deploy proves the write. `@beep/infra-github` adopts the environment, variable and secrets when it lands (D20).

Lane goals/infra-alchemy-rebuild-p3-storybook

Reverse: gh api -X DELETE repos/beep-effect/beep-effect/environments/storybook-prod; set the beep-alchemy-state-rw trust policy sub condition back to the single beep-effect-web-prod subject with aws iam update-assume-role-policy.

### Storybook is served at beep-effect.com/storybook through a zone route, 2026-11-13

The `Storybook` stack (`apps/storybook/alchemy.run.ts`) is a `Cloudflare.Website.StaticSite` whose `prod` Worker has no custom domain and no workers.dev URL: one zone route, `beep-effect.com/storybook*`, puts it in front of the apex Worker. The trailing wildcard is deliberate: a route pattern is matched against the whole URL, query string included, and cannot contain one, so an exact `beep-effect.com/storybook` pattern would miss the bare slug with a query (review thread on #3289). The 2026-10-20 public-origin ruling makes `beep-effect.com` the single origin and reserves the `storybook` slug in `@beep/public-site` (`SiteRoute`), so a subdomain would contradict the route map. The build writes to `site/storybook`, so every asset path already carries the route prefix and the Worker needs no script. The prod Worker name is pinned (`beep-storybook-prod`) because a generated name comes from a state-held instance id (the #3133 lesson). `memo: false`: stories live in sibling workspace packages outside the default memo scope, so the build runs on each deploy and the Worker changes only when the output does. Proof before prod: stage `dev_elpresidank` deployed 2026-11-13 (568 assets); `/storybook` redirects to `/storybook/`, `/storybook/` and `/storybook/index.json` return 200, `/storybook/iframe.html?…` redirects to `/storybook/iframe?…` with the query intact, an unknown asset and `/` return 404. The stage was destroyed afterwards.

Lane goals/infra-alchemy-rebuild-p3-storybook

Reverse: Remove the routes from apps/storybook/alchemy.run.ts and give the Worker a domain (or workers.dev) instead; alchemy destroy --stage prod removes the Worker and its route.

### Cost controls adopts nine account singletons (D20), 2026-11-14

D20 per-object adoption list for the `CostControls` stack. Nine live account objects are adopted, not recreated; none has a greenfield name.

| Logical id | Resource type | Live object | Adoption path |
| --- | --- | --- | --- |
| `AppTag` | `BeepAWS.CostExplorer.CostAllocationTag` | tag key `App` (Active) | silent: `read` returns plain attributes |
| `BeepCiTag` | same | tag key `beep-ci` (Active) | silent |
| `DataClassTag` | same | tag key `DataClass` (Active) | silent |
| `GhrEnvironmentTag` | same | tag key `ghr:environment` (Active) | silent |
| `ManagedByTag` | same | tag key `ManagedBy` (Active) | silent |
| `ProjectTag` | same | tag key `Project` (Active) | silent |
| `ComputeOptimizer` | `BeepAWS.ComputeOptimizer.Enrollment` | account enrollment (Active, member accounts off) | silent |
| `CostOptimizationHub` | `BeepAWS.CostOptimizationHub.Enrollment` | account enrollment (Active, member accounts off) | silent |
| `AccountServicesMonitor` | `AWS.CostExplorer.AnomalyMonitor` (`prod` only) | `arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460`, name `beep-account-services` | `adopt(true)` on this resource only; the deploy adds the `alchemy::*` ownership tags |

The eight `@beep/alchemy-aws-extras` singletons default to `retain`: removing one from the stack or destroying the stack leaves the account setting alone (hermetic test "removing the singletons from the stack deletes nothing"). Their reconcile writes only when the live status differs from the declared `Active`, which it does not today (read 2026-11-13). The monitor is retained in every stage that declares it. Because the monitor is adopted, the Pulumi cutover removes it from Pulumi state instead of destroying it.

Gotcha: an attended `pulumi up --refresh` of `beep-ci-runners/production` before the cutover would see the new `alchemy::*` tags on the monitor as drift and remove them; the next Alchemy read then reports it `Unowned` again and `adopt(true)` re-adopts it. No Pulumi update runs during the CI measurement window, and the cutover removes the monitor from Pulumi state.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Remove the singleton declarations from the stack: retain leaves every live setting untouched; drop adopt(true) on the monitor and remove its alchemy:: tags with aws ce untag-resource.

### Cost controls deploys through a stack-scoped OIDC role, beep-alchemy-cost-controls-deploy (proposed), 2026-11-14

Proposal, not created by this lane. Ruling (packet gate session, 2026-11-14): the gate creates the role, the environment, its variable and the recipient secret itself from the commands below, when this lane's PR is about to open, so the first deploy after the merge has credentials. The shared role `beep-alchemy-state-rw` stays state-only; the `CostControls` stack takes its own GitHub OIDC deploy role, `beep-alchemy-cost-controls-deploy`, and its workflow assumes only that role (state access included), as `vars.COST_CONTROLS_DEPLOY_ROLE_ARN` on the `cost-controls-prod` environment.

Trust: the existing provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, subject exactly `repo:beep-effect/beep-effect:environment:cost-controls-prod`. Session length one hour.

Permissions, inline policy `cost-controls-deploy`, least privilege for what the five providers and the post-deploy check call:

- Budgets (global service; budget ARNs carry no region): `budgets:ViewBudget` on `arn:aws:budgets::832907639880:budget/*` (DescribeBudget and DescribeBudgets, the latter for the verify step); `budgets:ModifyBudget`, `budgets:TagResource`, `budgets:UntagResource`, `budgets:ListTagsForResource` only on `arn:aws:budgets::832907639880:budget/beep-account-monthly-cost`. ModifyBudget covers create, update, delete and every notification and subscriber call. The Pulumi budget `Monthly Budget` stays out of reach.
- Cost Explorer anomaly detection (global, `us-east-1` endpoint): `ce:GetAnomalyMonitors`, `ce:GetAnomalySubscriptions`, `ce:CreateAnomalySubscription` on `*` (list and create take no resource ARN); `ce:UpdateAnomalyMonitor`, `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` on the adopted monitor `arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460`; `ce:UpdateAnomalySubscription`, `ce:DeleteAnomalySubscription`, `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` on `arn:aws:ce::832907639880:anomalysubscription/*`. No `ce:CreateAnomalyMonitor` and no `ce:DeleteAnomalyMonitor`: the monitor is adopted and retained.
- Cost allocation tags: `ce:ListCostAllocationTags`, `ce:UpdateCostAllocationTagsStatus` on `*`.
- Compute Optimizer (regional API, called in `us-east-1`): `compute-optimizer:GetEnrollmentStatus`, `compute-optimizer:UpdateEnrollmentStatus` on `*`.
- Cost Optimization Hub (`us-east-1` only): `cost-optimization-hub:ListEnrollmentStatuses`, `cost-optimization-hub:UpdateEnrollmentStatus` on `*`.
- No `iam:CreateServiceLinkedRole`: both service-linked roles exist (both services are enrolled), and the reconcile writes only on a status change. A re-enrollment after an opt-out would fail loudly and need that permission added on purpose.
- State store: `s3:ListBucket`, `s3:GetBucketLocation`, `s3:GetBucketVersioning`, `s3:GetBucketOwnershipControls`, `s3:GetBucketPublicAccessBlock`, `s3:GetEncryptionConfiguration` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an`; `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/CostControls/*` only. No bucket-configuration writes: the store is operator-bootstrapped, and the plan step fails on an outdated store instead of repairing it. The AWS-managed `aws/s3` key authorizes S3 use for account principals, so no KMS statement.

Commands for the launching session (operator workstation, `AWS_PROFILE=elpresidank-vault`), then the GitHub side:

```sh
export AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1
D="$(mktemp -d)"
cat > "$D/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com","token.actions.githubusercontent.com:sub":"repo:beep-effect/beep-effect:environment:cost-controls-prod"}}}]}
JSON
cat > "$D/policy.json" <<'JSON'
{"Version":"2012-10-17","Statement":[
{"Sid":"BudgetsRead","Effect":"Allow","Action":["budgets:ViewBudget"],"Resource":"arn:aws:budgets::832907639880:budget/*"},
{"Sid":"BudgetOwned","Effect":"Allow","Action":["budgets:ModifyBudget","budgets:TagResource","budgets:UntagResource","budgets:ListTagsForResource"],"Resource":"arn:aws:budgets::832907639880:budget/beep-account-monthly-cost"},
{"Sid":"AnomalyRead","Effect":"Allow","Action":["ce:GetAnomalyMonitors","ce:GetAnomalySubscriptions","ce:CreateAnomalySubscription"],"Resource":"*"},
{"Sid":"AnomalyMonitorAdopted","Effect":"Allow","Action":["ce:UpdateAnomalyMonitor","ce:TagResource","ce:UntagResource","ce:ListTagsForResource"],"Resource":"arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460"},
{"Sid":"AnomalySubscriptions","Effect":"Allow","Action":["ce:UpdateAnomalySubscription","ce:DeleteAnomalySubscription","ce:TagResource","ce:UntagResource","ce:ListTagsForResource"],"Resource":"arn:aws:ce::832907639880:anomalysubscription/*"},
{"Sid":"CostAllocationTags","Effect":"Allow","Action":["ce:ListCostAllocationTags","ce:UpdateCostAllocationTagsStatus"],"Resource":"*"},
{"Sid":"Enrollments","Effect":"Allow","Action":["compute-optimizer:GetEnrollmentStatus","compute-optimizer:UpdateEnrollmentStatus","cost-optimization-hub:ListEnrollmentStatuses","cost-optimization-hub:UpdateEnrollmentStatus"],"Resource":"*"},
{"Sid":"StateBucketRead","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:GetBucketVersioning","s3:GetBucketOwnershipControls","s3:GetBucketPublicAccessBlock","s3:GetEncryptionConfiguration"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an"},
{"Sid":"StateObjects","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/CostControls/*"}]}
JSON
aws iam create-role --role-name beep-alchemy-cost-controls-deploy \
  --assume-role-policy-document "file://$D/trust.json" --max-session-duration 3600 \
  --description "GitHub OIDC deploy role for the CostControls Alchemy stack (cost-controls-prod)" \
  --tags Key=beep:owner,Value=infra-alchemy-rebuild Key=beep:bootstrap,Value=cost-controls-deploy
aws iam put-role-policy --role-name beep-alchemy-cost-controls-deploy \
  --policy-name cost-controls-deploy --policy-document "file://$D/policy.json"
aws iam get-role --role-name beep-alchemy-cost-controls-deploy --query Role.Arn --output text
rm -r "$D"

gh api -X PUT repos/beep-effect/beep-effect/environments/cost-controls-prod \
  -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/beep-effect/beep-effect/environments/cost-controls-prod/deployment-branch-policies \
  -f name=main -f type=branch
gh variable set COST_CONTROLS_DEPLOY_ROLE_ARN --env cost-controls-prod \
  --body arn:aws:iam::832907639880:role/beep-alchemy-cost-controls-deploy
```

Recipient secret, same bootstrap step, before the switch to `live` (ruling, packet gate session, 2026-11-14: no new 1Password field; the list already lives encrypted in the Pulumi stack config, and the gate verified on 2026-11-14 that it decrypts to a one-recipient list). From `infra/ci-runners`, without printing it:

```sh
cd infra/ci-runners
AWS_PROFILE=elpresidank-vault PULUMI_BACKEND_URL=s3://oip-law-pulumi-state \
PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- \
  pulumi config get accountCostControls:notificationEmailAddresses --stack production \
  | jq -r 'join(",")' | tr -d '\n' \
  | gh secret set COST_CONTROLS_NOTIFICATION_EMAILS --env cost-controls-prod --repo beep-effect/beep-effect
gh secret list --env cost-controls-prod --repo beep-effect/beep-effect   # names only
```

After the Pulumi component leaves the program (cutover step 5), this GitHub secret is the only copy of the list besides the Pulumi config key the turbo-cache throttle alarm keeps.

Checks after creation: `aws iam simulate-principal-policy` for `budgets:ModifyBudget` on `budget/Monthly Budget` must say `implicitDeny`, and on `budget/beep-account-monthly-cost` `allowed`. Like the state role, the role and environment are bootstrap singletons until `@beep/infra-ci-runners` and `@beep/infra-github` adopt them (D20).

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: gh secret delete COST_CONTROLS_NOTIFICATION_EMAILS --env cost-controls-prod --repo beep-effect/beep-effect; aws iam delete-role-policy --role-name beep-alchemy-cost-controls-deploy --policy-name cost-controls-deploy; aws iam delete-role --role-name beep-alchemy-cost-controls-deploy; gh api -X DELETE repos/beep-effect/beep-effect/environments/cost-controls-prod.

### Cost controls deploy workflow: one hosted job, main pushes, plan before deploy, polled check, 2026-11-14

`.github/workflows/deploy-cost-controls.yml` deploys the `prod` stage under the packet's standing conditions:

- Triggers: `push` to `main` filtered to `packages/tooling/infra/cost-controls/**`, `packages/tooling/library/alchemy-aws-extras/src/**`, `bun.lock` and the workflow file, plus a bare `workflow_dispatch` with no inputs (no `--adopt` path: the one adoption that needs it is declared per resource in source).
- Exactly one GitHub-hosted job, `Deploy cost controls (prod)`, on `ubuntu-24.04` with `timeout-minutes: 20`, in its own environment `cost-controls-prod`, under concurrency group `alchemy-cost-controls-prod` with `cancel-in-progress: false`; the S3 stage lease is the second guard.
- Credentials: `aws-actions/configure-aws-credentials` (same pinned SHA as the other deploy workflows) assumes `vars.COST_CONTROLS_DEPLOY_ROLE_ARN`, the stack-scoped role, not the shared state role.
- `alchemy plan --stage prod` before `alchemy deploy --stage prod --yes`, both with `--env-file /dev/null --no-input`, `CI=true`, `ALCHEMY_TELEMETRY_DISABLED=1`, and without `--detailed`, so the log names resources and actions but no property values. The recipient secret is passed to both steps and read only in the `live` phase.
- A post-deploy check polls (10 tries, 15 s apart) until the budget `beep-account-monthly-cost` exists and the monitor `beep-account-services` carries `alchemy::stack=CostControls`, because Budgets and Cost Explorer are eventually consistent.
- Nothing else changes: no edit to `check.yml`, `heavy.yml`, `.github/actions/setup-monorepo-ci`, runner labels or any pull-request job. The job's line joins the exemption list in `packages/tooling/tool/cli/test/ci-runner-security.test.ts` beside the other two Alchemy deploys.

Rulings (packet gate session, 2026-11-14): the first `prod` plan runs only in this workflow, never from a workstation; this lane's PR opens when the gate says a packet slot is free (next in line after the three open PRs drain by one). The first run happens on the merge of this lane's PR. It needs the role, environment and variable from the deploy-role decision first; without them the credentials step fails and nothing is touched.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Delete .github/workflows/deploy-cost-controls.yml and its line in the ci-runner-security exemption list; the stack's resources stay as last deployed.

### Cost controls personal-stage plan: 1 create, 8 adopted, no delete or replace; no spend, 2026-11-14

Read-only `alchemy plan` for a personal stage against account 832907639880, from `packages/tooling/infra/cost-controls` on 2026-11-13, credentials from `eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`, `AWS_REGION=us-east-1`, `CI` unset: `bunx alchemy plan --stage dev_elpresidank --env-file /dev/null --no-input --detailed`. Exit 0, `Plan: 1 to create, 8 to adopted`, no delete, no replace, no update. No deploy ran; afterwards the state bucket still held only `BeepEffectWeb/` and `Storybook/`, and every live setting read the same as before.

| Plan line | Live state (read-only `aws` reads, same day) | Why |
| --- | --- | --- |
| `[MonthlyBudget] create`, `budgetName: beep-account-monthly-cost-dev_elpresidank`, limit 200 USD, cost types as Pulumi's, `notifications: []` | `aws budgets describe-budgets` lists one budget, `Monthly Budget` (200 USD, MTD $371.54) | new stage-suffixed name, nothing to read; silent phase, so no subscribers and no recipient variable read |
| `[AppTag]`, `[BeepCiTag]`, `[DataClassTag]`, `[GhrEnvironmentTag]`, `[ManagedByTag]`, `[ProjectTag]` `adopted`, no declared property changes | `aws ce list-cost-allocation-tags` for the six keys: all `Active`, `UserDefined` | `read` returns plain attributes; declared `Active` equals live, so the deploy would write nothing |
| `[ComputeOptimizer] adopted`, no changes | `aws compute-optimizer get-enrollment-status`: `Active`, member accounts off | same |
| `[CostOptimizationHub] adopted`, no changes | `aws cost-optimization-hub list-enrollment-statuses`: `Active`, member accounts off | same |
| no monitor, no subscription line | `aws ce get-anomaly-monitors`: one `DIMENSIONAL`/`SERVICE` monitor `beep-account-services`; `get-anomaly-subscriptions`: `beep-account-daily-anomalies`, daily, threshold 10 | by design a personal stage declares neither (the monitor is an account singleton adopted only by `prod`) |

Difference from the brief's expectation (three named creates): only the budget plans as a create. The anomaly monitor cannot be created beside the live one (one services monitor per account) and is adopted by `prod`, and the subscription exists only in `prod`'s `live` phase. The `prod` plan, which exercises the monitor adoption, first runs as the workflow's plan step; it needs `CI=true` and, by the packet gate session's ruling of 2026-11-14, runs only in the workflow, never from a workstation. The hermetic tests cover it (`adopts the services monitor, keeps the budget silent and retains both`).

Spend: none. AWS Budgets monitoring budgets and their notifications are free (only action-enabled budgets beyond two cost $0.10/day; this budget has no actions, and the account's one existing budget has none either); Cost Anomaly Detection monitors and subscriptions are free, and no monitor is added; cost allocation tag activation, Compute Optimizer default enrollment (no enhanced infrastructure metrics) and Cost Optimization Hub enrollment are free. Basis: the AWS Budgets pricing page and the Cost Management quotas page, read 2026-11-13. The parallel period adds one free budget.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: n/a (read-only plan record)

### Cost controls: new pinned names for budget and subscription; the services monitor is adopted, 2026-11-14

The `CostControls` stack (`packages/tooling/infra/cost-controls`, D5) replaces the Pulumi `AccountCostControls` component of `beep-ci-runners/production`. Its two named, greenfield resources get new physical names pinned in source for `prod`, so no deploy depends on a state-held instance id (the #3133 lesson), and they run beside the Pulumi-owned ones until the cutover (D12):

| Logical id | Resource | `prod` name | Pulumi name it runs beside |
| --- | --- | --- | --- |
| `MonthlyBudget` | `AWS.Budgets.Budget` | `beep-account-monthly-cost` | `Monthly Budget` |
| `AnomalyAlerts` | `AWS.CostExplorer.AnomalySubscription` | `beep-account-anomaly-alerts` | `beep-account-daily-anomalies` |

Both names differ from the live ones on purpose: the Budget provider's `read` returns plain attributes, so a same-name budget would be adopted silently. A personal stage suffixes the budget with the stage (`beep-account-monthly-cost-dev_<user>`) and declares no subscription.

The third named resource cannot be greenfield. AWS allows one `DIMENSIONAL` / `SERVICE` ("AWS services") anomaly monitor per account (Cost Management quotas page; the live account has exactly one, `beep-account-services`), so a second monitor beside the Pulumi one would fail `CreateAnomalyMonitor` with a quota error, and the plan cannot show that because plan never calls create. The monitor therefore joins the adopted singletons (next decision): `prod` declares `AccountServicesMonitor` with the live name `beep-account-services`, `AdoptPolicy.adopt(true)` on that one resource (its `read` reports `Unowned` because it carries no Alchemy tags) and `RemovalPolicy.retain()`. Adoption also keeps the monitor's detection history. Personal stages do not declare it, so a dev stage never adopts the account's only services monitor.

Budget retention: `RemovalPolicy.retain(stage === "prod")`, the Alchemy form of the Pulumi `protect: true`, so a stack destroy cannot remove the account budget. The subscription is destroy-on-delete like any owned resource.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Rename the budget and subscription in packages/tooling/infra/cost-controls/src/CostControls.ts (a rename replaces them); to recreate the monitor instead, the Pulumi-owned one must be deleted first (one per account).

### Cost controls cutover from Pulumi: destroy two URNs, state-delete eleven, no pulumi up, 2026-11-14

Rulings (packet gate session, 2026-11-14): the PR that removes the `AccountCostControls` component from the Pulumi program must merge before any later `pulumi preview` or `pulumi up` of `beep-ci-runners/production`, and it keeps `accountCostControls:notificationEmailAddresses` for the turbo-cache throttle alarm. The runner fleet and the AWS turbo cache in that stack are under a CI measurement window until the 2026-11-20 verdict, so every Pulumi step below is state-only or target-only, and the packet gate session tells the orchestrator before running them. The passphrase comes only through `op run` from the 1Password field `PULUMI_ENCRYPTION_PASSPHRASE` of item `BEEP_SECRETS` in vault `BEEP_SECRETS` (verified by the gate 2026-11-14); it never goes in a file, an argument or a log.

Procedure for the launching session; this lane ran none of it except the export. It touches only the `AccountCostControls` subtree of `beep-ci-runners/production` (backend `s3://oip-law-pulumi-state`, secrets provider `passphrase`), never runs the program (`pulumi destroy` and the `pulumi state` commands read state only; never pass `--run-program`), and needs no `pulumi up`. The same stack holds the live runner fleet and the AWS turbo cache, and a CI measurement window is running: no other URN is named, and `pulumi destroy` runs only with explicit `--target`s and without `--target-dependents`.

Archive: `pulumi stack export --stack production` taken 2026-11-13 at `~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-13.json` (3,396,936 bytes, sha256 `2c5933f882423d165f2a7469d85131305369bedf3d4ec8ef44dccc567291d00c`, deployment version 4, last update 2026-11-13T13:44:48-06:00, 367 resources, 0 pending operations). Re-export immediately before step 1 if the stack's last update is newer than that, and record the new file's size and sha256 in a follow-up decision; the newest export is the reversal.

URNs (13: eleven live resources, the component's AWS provider, the component). Every one but the component is `protect: true`; tags and enrollments are also `retainOnDelete`.

| # | Object | URN | Step |
| --- | --- | --- | --- |
| 1 | budget `Monthly Budget` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:budgets/budget:Budget::account-cost-controls-monthly` | destroy |
| 2 | subscription `beep-account-daily-anomalies` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalySubscription:AnomalySubscription::account-cost-controls-daily-anomalies` | destroy |
| 3 | monitor `beep-account-services` (adopted by Alchemy) | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalyMonitor:AnomalyMonitor::account-cost-controls-service-monitor` | state delete |
| 4 | tag `App` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-App` | state delete |
| 5 | tag `beep-ci` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-beep-ci` | state delete |
| 6 | tag `DataClass` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-DataClass` | state delete |
| 7 | tag `ghr:environment` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ghr:environment` | state delete |
| 8 | tag `ManagedBy` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ManagedBy` | state delete |
| 9 | tag `Project` | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-Project` | state delete |
| 10 | Compute Optimizer enrollment | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:computeoptimizer/enrollmentStatus:EnrollmentStatus::account-cost-controls-compute-optimizer` | state delete |
| 11 | Cost Optimization Hub enrollment | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costoptimizationhub/enrollmentStatus:EnrollmentStatus::account-cost-controls-optimization-hub` | state delete |
| 12 | component AWS provider | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$pulumi:providers:aws::account-cost-controls-aws` | state delete |
| 13 | component | `urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls::account-cost-controls` | state delete |

Why state delete for 3-11: a Pulumi delete of a tag deactivates it, of an enrollment opts the account out, and of the monitor deletes the account's only services monitor that Alchemy now owns. Only the budget and the subscription, which Alchemy replaced under new names, are destroyed.

Preconditions: the first `prod` deploy of `CostControls` is green including its verify step; `alchemy plan --stage prod` in CI shows no create or replace; `aws ce list-tags-for-resource` on the monitor shows `alchemy::stack=CostControls`; the orchestrator has been told the Pulumi steps are about to run.

Environment, from `infra/ci-runners` (single quotes: URNs contain `$` and `:`):

```sh
cd infra/ci-runners
export AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1 PULUMI_BACKEND_URL=s3://oip-law-pulumi-state
U1='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:budgets/budget:Budget::account-cost-controls-monthly'
U2='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalySubscription:AnomalySubscription::account-cost-controls-daily-anomalies'
U3='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/anomalyMonitor:AnomalyMonitor::account-cost-controls-service-monitor'
U4='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-App'
U5='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-beep-ci'
U6='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-DataClass'
U7='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ghr:environment'
U8='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-ManagedBy'
U9='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costexplorer/costAllocationTag:CostAllocationTag::account-cost-controls-tag-Project'
U10='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:computeoptimizer/enrollmentStatus:EnrollmentStatus::account-cost-controls-compute-optimizer'
U11='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$aws:costoptimizationhub/enrollmentStatus:EnrollmentStatus::account-cost-controls-optimization-hub'
U12='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls$pulumi:providers:aws::account-cost-controls-aws'
U13='urn:pulumi:production::beep-ci-runners::beep:infra:AccountCostControls::account-cost-controls'
```

1. Unprotect, state only, URNs 1-12:

   ```sh
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi state unprotect --stack production --yes "$U1" "$U2" "$U3" "$U4" "$U5" "$U6" "$U7" "$U8" "$U9" "$U10" "$U11" "$U12"
   ```

   Check: `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi stack export --stack production | jq '[.deployment.resources[] | select(.urn|test("AccountCostControls")) | .protect // false] | any'` prints `false`, and `| jq '.deployment.resources|length'` still prints 367.
2. Destroy the old budget and subscription, preview first:

   ```sh
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi destroy --stack production --target "$U1" --target "$U2" --preview-only
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi destroy --stack production --target "$U1" --target "$U2" --yes
   ```

   The preview must show exactly 2 deletes, both named above, nothing else; never add `--target-dependents` or `--run-program`. Check: `aws budgets describe-budgets --account-id 832907639880 --query 'Budgets[].BudgetName'` lists `beep-account-monthly-cost` and not `Monthly Budget`; `aws ce get-anomaly-subscriptions --query 'AnomalySubscriptions[].SubscriptionName'` lacks `beep-account-daily-anomalies`; `aws ce get-anomaly-monitors` still lists `beep-account-services`.
3. State delete, URN 3 first (its dependent, URN 2, is gone), then 4-11, then 12, then 13:

   ```sh
   for u in "$U3" "$U4" "$U5" "$U6" "$U7" "$U8" "$U9" "$U10" "$U11" "$U12" "$U13"; do
     PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi state delete --stack production --yes "$u" || break
   done
   ```

   Check after the loop: no `AccountCostControls` URN in the export and 354 resources; `aws` reads unchanged (six tags Active, both enrollments Active, monitor present).
4. Flip `notifications` to `live` in the `prod` configuration (`packages/tooling/infra/cost-controls/src/Config.ts`) in one PR; the `COST_CONTROLS_NOTIFICATION_EMAILS` environment secret was already set in the bootstrap step (deploy-role decision). Its deploy adds the budget notifications and creates `beep-account-anomaly-alerts`. Check: `aws budgets describe-notifications-for-budget --account-id 832907639880 --budget-name beep-account-monthly-cost` lists four notifications; the subscription exists on the monitor's ARN with threshold 10.
5. In a later PR, delete `AccountCostControls` from `infra/src/internal/ci-runners-entry.ts`, `infra/src/AccountCostControls.ts` and its test, and the `accountCostControls:` keys from `Pulumi.production.yaml` except `notificationEmailAddresses`, which the turbo-cache throttle alarm keeps reading. That PR merges before the next `pulumi preview` or `up` of this stack: until then the program still declares the component, and a preview would plan to create all eleven resources again (the monitor create would hit the one-per-account quota). After it, the recipient list lives in two places only: that Pulumi config key and the `cost-controls-prod` GitHub secret.

Rollback: before step 5, `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi stack import --stack production --file <newest archive>` restores the subtree as exported (other resources too, so import only if no other update ran since the export; otherwise re-add single objects with `pulumi import`). Then `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi up --stack production --target "$U1" --target "$U2"` recreates `Monthly Budget` and `beep-account-daily-anomalies`, the Alchemy prod stage goes back to `silent`, and `aws budgets delete-budget --account-id 832907639880 --budget-name beep-account-monthly-cost` removes the retained Alchemy budget. The singletons need nothing: neither tool changed their status.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Before the program PR: pulumi stack import --stack production --file ~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-13.json (or a newer export), then pulumi up --target the budget and subscription URNs.

### Cost controls runs silent beside Pulumi and goes live after the cutover, 2026-11-14

Two budgets and two anomaly subscriptions would mail the same people twice, and on creation, not only on the next breach: month-to-date spend was $371.54 against the $200 limit on 2026-11-13, so all four live notifications (ACTUAL 50/80/100 %, FORECASTED 100 %) are in `ALARM`, and a new budget with the same thresholds alerts at once.

The stack therefore runs in two phases, set by `notifications` in the tracked `prod` configuration:

1. `silent` (what this lane ships): the new budget exists with no notifications and no anomaly subscription is declared; the adopted monitor keeps feeding the Pulumi-owned subscription. Nobody is mailed by the new stack.
2. `live`: one-line PR after the Pulumi cutover destroyed `Monthly Budget` and `beep-account-daily-anomalies`; the deploy it triggers adds the four budget notifications and creates `beep-account-anomaly-alerts` on the adopted monitor.

So recipients are never mailed twice. Each threshold mails once from the new budget when the phase flips, because the month is already over budget, which is the alert the old budget would also have sent at the next breach. The gap without budget alerts is the time between the destroy step of the cutover and the `live` deploy, one PR merge; the gap without anomaly mail is the same window, and the daily anomaly digest is at most one day late. The parallel period itself is the time between the first `prod` deploy and the cutover, which the launching session runs right after verifying that deploy.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Set notifications to live in the prod configuration before the cutover (recipients then get every alert twice until the Pulumi budget and subscription are destroyed).

### Cost controls configuration is a tracked schema; recipients come only from the environment, 2026-11-14

Configuration is schema-first in `src/Config.ts` (`CostControlsConfig`, an `S.Opaque` struct): `expectedAccountId` (twelve digits), `region` (`LiteralKit(["us-east-1"])`), `monthlyBudgetUsd` and `anomalyImpactUsd` (finite, positive), `notifications` (`LiteralKit(["silent", "live"])`). The stage inputs are tracked source, decoded through `resolveStageConfig` at program start; a bad value stops the stack with a `ConfigError` before any AWS read. `prod`: account `832907639880` (already public throughout the repository), $200 budget and $10 anomaly impact, the values in `infra/ci-runners/Pulumi.production.yaml` today. Every other stage takes the same values, always `silent`.

Recipients stay out of tracked files. The Pulumi stack file carries `accountCostControls:notificationEmailAddresses` only as a `secure:` ciphertext, so the addresses are not public there either. The stack reads them from one environment variable, `COST_CONTROLS_NOTIFICATION_EMAILS` (comma-separated, decoded by `NotificationRecipients` to normalized, deduplicated `EmailString`s), and only in the `live` phase, so silent stages and the personal plan need no addresses at all. CI: a secret of the same name on the `cost-controls-prod` GitHub environment, which Actions masks in logs. Source (ruling, packet gate session, 2026-11-14): no new 1Password field; the bootstrap step pipes the list from the encrypted Pulumi config key into the GitHub secret without printing it (deploy-role decision). A workstation never needs the list: personal stages are always `silent`. The plan and deploy steps run without `--detailed`, so no property value reaches a public log. The addresses do sit in the stack's state objects as plain props (the Budget and AnomalySubscription providers take strings), inside the private SSE-KMS state bucket, the same exposure the Pulumi state had for its decrypted outputs.

Account guard: `requireExpectedAccount` compares the resolved `AWSEnvironment` account and region with the configuration through a literal schema and fails with a `ConfigError` naming the expected account; it runs on every stage before any resource. `prod` also requires `CI=true` (`requireCiForProduction`). The provider layer (`src/Providers.ts`) registers only the five providers the stack declares and pins the region with `AWS.Region.of("us-east-1")`: Budgets and Cost Explorer are global services served from `us-east-1`, Cost Optimization Hub answers only there.

Coupling kept as is: in the Pulumi program the same `notificationEmailAddresses` list also feeds the AWS turbo cache's throttle alarm (`throttleAlarmRecipients` in `infra/src/internal/ci-runners-entry.ts`). The PR that deletes the `AccountCostControls` component keeps that config key, or moves it to a `ciTurboCache:` key, until the AWS cache leaves Pulumi.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Move thresholds back into environment config by reading them with Config.schema(CostControlsConfig) instead of the tracked stage inputs; recipients have no tracked form to revert.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Pulumi stays installed per stack until that stack's cutover | `infra/` | packet owner | destroy needs the CLI and program | the stack's `pulumi destroy` receipt |
| `@beep/infra-hosts` prod deploys from the operator workstation, never CI | one stack | packet owner | dankserver is reachable only over the YubiKey SSH route; S3 state lease is the overlap guard (D21) | a runner with a scoped deploy key to dankserver |
