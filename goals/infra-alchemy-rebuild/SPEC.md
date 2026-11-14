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

### aws-extras resource shape: BeepAWS types, schema props, a narrowed export, 2026-11-13

Four calls in `@beep/alchemy-aws-extras`. (1) Resource types use a `BeepAWS.` prefix (`BeepAWS.CostExplorer.CostAllocationTag`, `BeepAWS.ComputeOptimizer.Enrollment`, `BeepAWS.CostOptimizationHub.Enrollment`, `BeepAWS.EC2.RunnerLaunchTemplate`) so a future upstream `AWS.*` resource of the same name cannot collide with ours in one provider registry; the upstream PR renames them and keeps the old names in `ResourceOptions.aliases`. (2) Props and attributes are branded `S.Opaque` schemas with `LiteralKit` literals per the repo schema-first law. Each resource contract is a type alias `Resource<type, Props.Encoded, Attributes.Encoded, never, Providers>`, so callers pass plain objects, and `reconcile` decodes props before any AWS call, failing with `InvalidResourceProps`; an upstream port replaces `LiteralKit` and the `$I` annotations with plain `Schema` literals. (3) The repo `missingPipeableSignature` diagnostic rejects the `(id, Effect<props>)` overload of Alchemy `ResourceClass` on an exported value and diagnostic directives are not allowed, so each resource is built with `Resource(...)` internally and exported through `ExtrasResource`, which keeps only the `(id, props)` form; the runtime value is unchanged. (4) The package exports `providers` as a Layer constant rather than `providers()`, because `lazyEffect` rejects a zero-argument Layer factory.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Rename the types to AWS.* with the old names as Resource aliases, swap the schemas for plain interfaces, and export Alchemy's ResourceClass directly once the repo diagnostics allow it.

### @beep/alchemy-vercel resource shape: Project, EnvVar, Domain over 14 project operations, 2026-11-13

Exactly three resources (`Vercel.Project`, `Vercel.EnvVar`, `Vercel.Domain`) over `createProject/getProject/updateProject/deleteProject`, `createProjectEnv(upsert)/filterProjectEnvs/editProjectEnv/removeProjectEnv` and `addProjectDomain/getProjectDomain/updateProjectDomain/removeProjectDomain/verifyProjectDomain/moveProjectDomain`. Props, attributes and the env request body are `effect/Schema` schemas with the TS types derived from them. Attributes and the request body are branded `S.Opaque` (the provider builds them with `.make`); props (`ProjectProps`, `ProjectGitRepository`, `EnvVarProps`, `DomainProps`) stay annotated structs with schema-first inventory exceptions, because stacks pass them as plain object literals wrapped in `Input<>` and the engine round-trips them through state as JSON. The three resource interfaces are Alchemy handle types and carry the same kind of exception. Project props cover what `infra/src/OipWeb.ts` sets: framework, build and install commands, root directory, git repository, deployment protection (the API's `ssoProtection` values; `none` maps to `null`, Pulumi's `standardProtection` is `prod_deployment_urls_and_all_previews`), node version and `autoExposeSystemEnvs`. `teamId` and `gitRepository` replace the project (the project API cannot relink a repository); a same-name replacement deletes first because names are unique per team. Adopting a project linked to another repository fails with `ProjectRepositoryMismatch` rather than drifting. An existing env var is matched on key, branch and any overlapping target (Vercel's upsert overwrites on overlap), so an overlapping foreign variable needs `adopt(true)`; an omitted `type` compares as `encrypted`. The declared env `type` is a minimum on the order `plain` < `encrypted` < `sensitive`: a stored type that is equal or stronger (for example a team policy that stores Production and Preview values as `sensitive`) is accepted and never replaced; a weaker stored type plans an update, and reconcile replaces it delete-first, because Vercel does not promise an in-place type change; a write that still leaves a weaker type fails with `EnvVarTypeNotApplied` rather than churning. Repository identity is the git provider (GitHub link variants normalized) plus the path. An unverified domain plans an update on every deploy (the engine passes the stored output to `diff`), so reconcile re-runs `verifyProjectDomain` after the DNS change with unchanged props. EnvVar defines its own request-body schema (`EnvVarRequestBody`) because distilled types the body `unknown`; the value prop is `Redacted<string>`, unwrapped only to build that body, and is never an attribute. Storybook does not use the package (2026-11-09 decision).

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Rename or reshape props in a major changeset of @beep/alchemy-vercel before any stack depends on it; after P4, migrate the OIP stack in the same PR.

### Drop KmsGrant: the GitHub App KMS key delegates to IAM, 2026-11-13

D19 left `KmsGrant` open until the key policy was read. It was read on 2026-11-13 (`aws kms get-key-policy --key-id 79ab38d9-2a9d-426b-b704-beb6fc5c971d`): the GitHub App KMS key has one statement, "Enable IAM User Permissions", granting `kms:*` to the account root principal. The key therefore delegates authorization to IAM. In the native runner composite the stack owns the termination-watcher roles, so an IAM inline policy granting `kms:Decrypt` with a `kms:EncryptionContext:PARAMETER_ARN` condition replaces the six `aws.kms.Grant` resources the Pulumi program carried for the upstream module (`infra/src/CiFleetController.ts`). `@beep/alchemy-aws-extras` ships no `KmsGrant`; the IAM policy belongs to `@beep/alchemy-github-runners`.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Add a KmsGrant resource over distilled kms.createGrant / retireGrant to @beep/alchemy-aws-extras and grant the termination-watcher roles through it.

### github-runners ships as two sequential PRs: Lambdas first, composite second, 2026-11-13

`@beep/alchemy-github-runners` is about 6,500 lines before the composite (schemas, six service contracts, two distilled-backed live layers, seven Lambda programs and their entry points, 42 hermetic tests). The lane ships it as two sequential PRs, one open at a time: PR 1 carries the schemas, service contracts, live layers, Lambda programs and tests; PR 2 adds the runner user data, `RunnerSweep`, the `RunnerFleet` composite and its harness tests, and composes `RunnerLaunchTemplate` from `@beep/alchemy-aws-extras` if that has landed. PR 2 opens after PR 1 merges.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Fold the second PR's resources and composite into one PR if the first has not merged yet.

### One webhook per fleet routes jobs to every pool's build queue, 2026-11-13

The live fleet runs one terraform module per pool, so the heavy and shard-overflow pools each have a webhook and a webhook secret. The port follows upstream's multi-runner design instead: one webhook Lambda per fleet holds a matcher per pool (labels, match mode, build-queue URL), tries strict matchers (bidirectional or all-of) before any-of ones and sends the job to the first match. Two pools therefore need one App webhook URL and one secret; the overflow pool's separate secret parameter is not carried over.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Give each pool its own webhook Lambda and WebhookRuntimeConfig with a single matcher.

### Pin @distilled.cloud/vercel at 1.0.0-rc.18, 2026-11-13

The root catalog gains `@distilled.cloud/vercel: 1.0.0-rc.18`. It is the published release whose only dependency is `@distilled.cloud/core@1.0.0-rc.18`, the core bun.lock already resolves for the other distilled packages, so no second core version enters the graph. rc.19 and rc.20 exist but would pull a newer core and belong to a deliberate distilled bump (D13). The operation signatures and line numbers the P0 matrix cites (`services/projects.ts`) match rc.18 exactly; every API the package uses was checked against the installed module, not the reference checkout (which tracks rc.19+).

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Change the root catalog entry and bun.lock in a dedicated pin-bump PR with alchemy plan no-op on every stack (D13).

### Provider tests run against an in-process fake AWS HTTP client, 2026-11-13

The `@alchemy.run/test` suites for `@beep/alchemy-aws-extras` run in hosted CI with no AWS credentials. `test/support/FakeAws.ts` is an in-memory account behind an effect `HttpClient`: distilled still signs, serializes (awsJson 1.1 and the EC2 query protocol) and parses every call, and only the transport is fake. Each test covers create, update, delete, read and adopt through `test.provider` and `stack.deploy` / `destroy` with `inMemoryState()`. A live mutation suite is out: the singletons are live settings in account 832907639880 and there is no separate test account. `test/integration/LiveRead.test.ts` runs only with `BEEP_ALCHEMY_AWS_EXTRAS_LIVE=1` and calls `read` only; on 2026-11-13 it read all six cost allocation tags and both enrollments as Active.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Replace test/support/FakeAws.ts with live tests under the alchemy-test runner against a dedicated test account.

### Pulumi stack beep-storybook/production is removed; it held no resources, 2026-11-13

The Pulumi Storybook program was never applied: `pulumi stack ls` in `infra/storybook` (backend `s3://oip-law-pulumi-state`) showed `production` with 0 resources, last updated five months ago. `pulumi stack export --stack production` was archived 2026-11-13 outside the repo at `~/.local/state/beep/infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json` (493 bytes, deployment version 3, 0 resources, 0 pending operations, sha256 `fde291a6f1488725c2dd0285b4bd25491578b95deb4d8e9b0823dd33f2448bbf`). `pulumi stack rm production --yes` runs after this decision merges. There is nothing to destroy and nothing to flip. The program sources (`infra/storybook`, `infra/src/Storybook.ts`) leave with the rest of `infra/` in P6; the Vercel config file beside the Storybook app is deleted now because no Vercel project reads it.

Lane goals/infra-alchemy-rebuild-p3-storybook

Reverse: From infra/storybook under AWS_PROFILE=elpresidank-vault: pulumi stack init production, then pulumi stack import --file ~/.local/state/beep/infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json.

### Re-pin @distilled.cloud/vercel at 1.0.0-rc.19 after main moved to core rc.19, 2026-11-13

Supersedes the rc.18 pin decision. #3278 (93fe11eb05) moved main to `alchemy`/`@alchemy.run/*` 2.0.0-beta.86 and `@distilled.cloud/core@1.0.0-rc.19`. Keeping vercel at rc.18 would bring core rc.18 back as a second version, so the catalog entry moves to `@distilled.cloud/vercel@1.0.0-rc.19`, whose only dependency is core rc.19. `bun.lock` was regenerated from main's copy with `bun install`; it resolves a single core (rc.19). Against the installed rc.19 and beta.86, the package type checks and its 17 tests pass. The one adaptation is in the test harness: beta.86 types provider lifecycle errors as `ProviderError`.

Lane goals/infra-alchemy-rebuild-p2-vercel · PR #3290

Reverse: Return the catalog entry to the vercel release that matches whatever @distilled.cloud/core main resolves, in the same PR as that core bump.

### Runner Lambdas port terraform-aws-github-runner v7.10.1 without the features the live fleet leaves off, 2026-11-13

The handlers port `lambdas/functions/{webhook,control-plane,termination-watcher,gh-agent-syncer}` at v7.10.1, the version `infra/ci-runners/Pulumi.yaml` pins, as Effect programs over six service contracts (`GitHubAppAuth`, `GitHubRunners`, `Ec2Fleet`, `SsmStore`, `MessageQueue`, `RunnerBinaries`). Wire shapes stay upstream's: the SQS `ActionRequestMessage`, the `ghr:*` EC2 tags and the SSM token layout. Left out because the live fleet does not use them: dynamic `ghr-*` labels, dedicated hosts (`RunInstances`), the warm pool (`adjustPool`), the EventBridge webhook mode and queue-selection strategies other than first match, the AMI housekeeper, GitHub Enterprise base URLs in registration-token mode, and Powertools metrics and X-Ray. `jobQueuedCheck` defaults to false (the live value; upstream's default is true). Partial-launch, cap and retry semantics match upstream, including the on-demand failover for configured `CreateFleet` error codes.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Port the left-out upstream feature from lambdas/functions at v7.10.1 into the matching program and add its config field.

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

### Termination watcher uses EC2 state-change events, not CloudTrail BidEvictedEvent, 2026-11-13

Upstream's spot termination handler listens for the CloudTrail `BidEvictedEvent`, which needs a trail. The port deregisters on `EC2 Spot Instance Interruption Warning` and on `EC2 Instance State-change Notification` (`shutting-down`, `terminated`), both native EventBridge events, so no trail is required and an instance stopped for any reason is deregistered. One Lambda handles both events and the deregister-retry queue (busy runner: GitHub 422, re-queued after 300 s; a record that keeps failing reaches the queue's DLQ). Metrics are not ported.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Add an EventBridge rule on the CloudTrail BidEvictedEvent and decode it in TerminationEvent.

### Vercel.Domain adoption moves the domain from a named project, 2026-11-13

A domain belongs to one project at a time and the project-scoped API cannot find which project holds a domain, so `Vercel.Domain` takes an optional `moveFrom` (id or name of the project holding it today). Without prior state, `read` looks on the target project and then on `moveFrom`, and reports what it finds as `Unowned`; under `adopt(true)` the engine takes it over and `reconcile` calls `moveProjectDomain` from the holding project to the target, carrying redirect and git-branch settings. A later change of the `project` prop is an update that moves the domain the same way. This is the D20 per-object adoption for the oip.law domains: the cutover flip is one deploy with `moveFrom` set to the Pulumi-owned project.

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Drop the moveFrom prop and adopt per domain by removing it from the Pulumi project first (delete-then-create in the flip).

### Vercel objects without state read as Unowned; list() stays empty, 2026-11-13

Vercel projects, env vars and domains carry no tags or labels, so a provider cannot prove it created one. `read` returns plain attributes only with prior state, or when the object is the resource's own previous generation (`previous`, used by the engine's delete-first replacement admission); every other existing object is `Unowned` and needs `adopt(true)`/`--adopt`. `list()` keeps Alchemy's empty default, because without a marker it would hand every project in the team to `alchemy unsafe nuke`.

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Add an ownership marker (for example a project env var or comment carrying the stack, stage and logical id) and return owned reads for it, then implement list() for nuke.

### Vercel.Project fails on a repository-link mismatch instead of relinking, 2026-11-13

Review thread PRRT_kwDOPbO_N863RrL3 on #3290: an adopted project never received the declared `gitRepository`. The installed `@distilled.cloud/vercel@1.0.0-rc.18` has no operation that links or relinks a project's repository: `projects.ts` exposes only `createProject.gitRepository`, and the only link operations are `networking` private-link endpoints. So `Vercel.Project` checks the observed link against the declared `gitRepository` (owner/name, case-insensitive) and fails with `ProjectRepositoryMismatch`, both in `diff` (so `alchemy plan` reports it before anything is applied) and before any write in `reconcile`. A deliberate change of the declared repository still replaces the project. For the P4 oip.law adoption, the existing project must already be linked to `beep-effect/beep-effect`, or the props must omit `gitRepository`.

Lane goals/infra-alchemy-rebuild-p2-vercel · PR #3290

Reverse: Relink in reconcile once a distilled release ships a project link operation, and drop ProjectRepositoryMismatch in the same PR.

### Vercel provider surface: env credentials, constant layers, narrowed constructors, 2026-11-13

Credentials are distilled's `CredentialsFromEnv` (`VERCEL_TOKEN`, optional `VERCEL_API_URL`) and the team is a per-resource `teamId` prop; there is no Alchemy AuthProvider, profile or `Contributions` module. Two repo diagnostics (errors here, off upstream) shape the exported surface: `lazyEffect` rejects zero-argument functions returning a Layer, so `Vercel.providers`, `Vercel.resources` and the three `XProvider` layers are constants rather than Alchemy's `providers()` calls; `missingPipeableSignature` rejects the `(id, Effect<props>)` overload of Alchemy's resource constructor, so each resource is exported as `DeclaredResource<R>` (the `ResourceClass` without that overload; declarations yield props first). The upstream PR (D14) restores both mechanically. `resources` is exported so tests and other hosts can supply their own `Credentials` and `HttpClient`.

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Expose providers()/XProvider() functions and the full ResourceClass type once the repo's lazyEffect and missingPipeableSignature diagnostics allow them, or when the package goes upstream.

### Vercel provider tests run on an in-memory Vercel API, no live suite, 2026-11-13

The 14 provider tests use `@alchemy.run/test/Vitest` (`Test.make`, `test.provider`, `stack.deploy/destroy`) over `Vercel.resources` with a fake `HttpClient` (`test/harness/FakeVercel.ts`) that keeps projects, env vars and domains in memory and answers with the fields distilled's response schemas require. They cover create, update, delete, read and adopt for each resource, delete-first replacement, the domain move and the owned/unowned read distinction, and need no token in CI. The package's vitest config inlines `alchemy` so the engine and the providers share one module instance (the `Unowned` brand is module-private). No live test was run; none touched the oip.law project.

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Add an opt-in live suite behind an environment flag that creates and deletes a scratch project, never touching oip.law.

### OipWeb adopts the live Vercel projects in place (recommended; cutover awaits a ruling), 2026-11-14

The 2026-11-14 census found the live projects `oip-web` (prj_J5xqp5jg7POGvoIwOj7e1axpoPxb) and `oip-web-staging` (prj_orJn2nvxflBiJqPF0VWLOD0RFAzE) with settings identical to `infra/src/OipWeb.ts` and linked to `beep-effect/beep-effect` (Pulumi state still records the pre-transfer `kriegcloud/beep-effect`). A new project beside each (D12) would need a READY production build before the domain move, would put previews and history on new hostnames, and would force an edit of `vercel-deploy.yml`, whose `VERCEL_APPS` env names both project ids and which runs pull-request jobs. Adopting in place (`adopt(true)` on `Vercel.Project`, a per-object exception to D12 in the spirit of D20) plans as `adopted` with no setting change, keeps ids, previews, history and the git link, and leaves that workflow unedited. The stack is built for adoption, with `RemovalPolicy.protect()` on both live projects because destroying an adopted stage would delete the live project. Neither option costs anything on the Hobby team. The cutover does not run until the orchestrating session rules on this.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Declare a new project per stage (projectName oip-web-<stage>-new), add moveFrom with the live project id to each Vercel.Domain, edit the two projectId values in vercel-deploy.yml VERCEL_APPS, and forget the adopted project rows with alchemy state delete.

### OipWeb assets buckets are new; the Pulumi buckets are empty and unread, 2026-11-14

`assets.oip.law` and `staging-assets.oip.law` hold 0 objects, 0 versions and 0 delete markers (census 2026-11-14), and no app, package or workflow reads or writes them. A new bucket therefore needs no copy and no reader switch, so D12's greenfield default applies at no cost: `oip-law-web-assets-prod` and `oip-law-web-assets-staging` (HeadBucket 404 on both names, so unclaimed), with the Pulumi baseline restated (versioning, AES256 with SSE-C blocked, full public-access block, BucketOwnerEnforced, DenyInsecureTransport policy) and `RemovalPolicy.protect()` on live stages. S3 bills storage and requests only, so an empty bucket costs nothing. The Pulumi buckets are deleted empty at cutover after `pulumi state unprotect` on their five protected resources each.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Set assetsBucketName to assets.oip.law / staging-assets.oip.law in liveStageConfig (the S3 provider adopts silently by name), skip the Pulumi bucket destroy and pulumi state delete the five bucket resources instead.

### OipWeb cutover procedure from Pulumi, 2026-11-14

The procedure is the runbook's "Cutover from Pulumi" (`docs/runbooks/alchemy-infra.md`), executed by the orchestrating session after the project ruling: (1) read-only preconditions, the HubSpot token proven live by a read that returns portal 246203876 and the Cloudflare token's DNS edit scope verified; (2) `pulumi stack export` of both stacks archived under `~/.local/state/beep/infra-archives/pulumi-exports/` with size and sha256 in a decision file; (3) deploy role and environment bootstrapped; (4) Pulumi frozen; (5) arm and dispatch, plans must match the expected-plan decision, smoke checks pass, a second dispatch plans no changes, drift exits 0; (6) `pulumi state delete` for every adopted object, then `pulumi state unprotect` and a targeted destroy of the empty old buckets, then `pulumi stack rm`. Expected visitor effect: none; adoption rewrites settings that already hold, DNS records change only their comment, variable writes reach new deployments only. Each step names its check and rollback in the runbook. The one live risk is a wrong HubSpot token, which would surface on the next production deployment as a failing contact form; step 1 removes it.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Before step 6: unset OIP_WEB_INFRA_DEPLOY and keep Pulumi as owner. After step 6: pulumi stack import --file <archive> per stack.

### OipWeb deploys from one armed workflow job; vercel-deploy.yml stays unedited, 2026-11-14

`.github/workflows/deploy-oip-web-infra.yml`: push to `main` filtered to the stack, the Vercel provider source and the workflow itself, plus a bare `workflow_dispatch`; one GitHub-hosted job (`timeout-minutes: 30`), environment `oip-web-infra-prod`, concurrency `alchemy-oip-web-infra` (never cancelled). Per stage, `staging` then `prod`: plan teed to a log, `bun apps/oip-web/stack/plan-guard.ts` (refuses replace, delete or orphan of a project, domain, DNS record or bucket and fails closed on a log without a `Plan:` line), deploy, then a curl poll of every hostname against today's responses (200 apex, 308 or 307 redirects). The job runs only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`, so merging deploys nothing. It needs a stack-scoped OIDC role (`OIP_WEB_DEPLOY_ROLE_ARN`, state bucket plus `oip-law-web-assets-*`) because the state role is state-only. No change to `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job. Because the projects are adopted in place, `vercel-deploy.yml` keeps its project ids and is not edited.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Delete .github/workflows/deploy-oip-web-infra.yml and its ci-runner-security exemption line; unset the OIP_WEB_INFRA_DEPLOY repository variable.

### OipWeb domains and DNS records are adopted per object and protected, 2026-11-14

Per D20 the six Vercel domains (`oip.law`, `www.oip.law`, `opip.law`, `www.opip.law` on prod; `staging.oip.law`, `staging.opip.law` on staging) and the six Cloudflare records Pulumi owns (ids matching state) are adopted with `adopt(true)`. With the project adopted in place the domains are already on the target project, so `moveFrom` is not needed. Redirect codes are kept (308 on prod, 307 on staging). Records keep content, `proxied: false` and automatic TTL; only the comment changes to name the Alchemy stack, an in-place update. Both carry `RemovalPolicy.protect()` on live stages, and the workflow's plan guard refuses any replace, delete or orphan of either.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Remove adopt(true) and RemovalPolicy.protect from the Domain and DNS declarations and delete-then-create each record during a maintenance window instead.

### OipWeb plans: the personal stage planned as designed; first prod and staging plans predicted, 2026-11-14

Read-only `alchemy plan --stage dev_elpresidank --env-file /dev/null` from `apps/oip-web` (aws-vault credentials exported, provider tokens through `op run`), 2026-11-14: exit 0, `Plan: 4 to create` with `[AssetsBucket]`, `[EnvHubSpotAccountId]`, `[EnvNextDisablePwa]` and `[Project]` as creates, all stage-named (`oip-web-dev-elpresidank`, `oip-law-web-assets-dev-elpresidank`); nothing adopted, moved or modified; no deploy. The run also showed that CI-style plan lines carry a `[HH:MM:SS.mmm] INFO: ` prefix, which the plan guard now strips (fixture in `test/stack/PlanGuard.test.ts`). Predicted from the census, not planned against live objects: the first prod plan is `Plan: 1 to create, 12 to adopted` with `[AssetsBucket] create` and `adopted` for `[Dns-oip-law]`, `[Dns-opip-law]`, `[Dns-www-oip-law]`, `[Dns-www-opip-law]`, `[Domain-oip-law]`, `[Domain-opip-law]`, `[Domain-www-oip-law]`, `[Domain-www-opip-law]`, `[EnvHubSpotAccountId]`, `[EnvHubSpotServiceKey]`, `[EnvNextDisablePwa]` and `[Project]`; the first staging plan is `Plan: 1 to create, 8 to adopted` with `[AssetsBucket] create` and `adopted` for `[Dns-staging-oip-law]`, `[Dns-staging-opip-law]`, `[Domain-staging-oip-law]`, `[Domain-staging-opip-law]`, the three variables and `[Project]` (adoption takes the declared props as the old props, so the planner reports `adopted`, not `update`). Stop signs: any `replace`, `delete` or `orphaned` line (the guard and `RemovalPolicy.protect` both refuse it); any `create` other than `[AssetsBucket]` (a live object was not found where the census put it); `OwnedBySomeoneElse`, `ProjectRepositoryMismatch` or `EnvVarTypeNotApplied`; a `ConfigError` on `CI` or `CRM_HUBSPOT_SERVICE_KEY`; a second dispatch that plans anything but no changes.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: n/a (evidence record); a later plan that differs supersedes it with its own decision file.

### OipWeb stages: prod and staging own the live objects, names are pinned, personal stages are fenced off, 2026-11-14

`prod` and `staging` map to the Pulumi stacks `production` and `staging` and refuse to run without `CI=true`. Every physical name (project, bucket, hostnames, zone ids) is pinned in `apps/oip-web/stack/OipWebConfig.ts`; none is derived from a state-held instance id (the #3133 lesson). A personal stage (`dev_$USER`) gets `oip-web-<stage>` and `oip-law-web-assets-<stage>`, the two public variables, no domain, no DNS and no secret, and the `OipWebStackConfig` schema rejects a personal configuration that names a live project, a live or retiring bucket, a domain or the HubSpot secret source.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Collapse liveStageConfig into the Pulumi-style config file per stage and drop the schema fences; no live object depends on the shape.

### Vercel.EnvVar gains valueFrom so a secret never enters Alchemy state, 2026-11-14

Alchemy writes a `Redacted` prop as `{ "__redacted__": <plain text> }` in state (`alchemy/src/State/StateEncoding.ts`), so `EnvVar.value` put any secret in the state bucket in clear JSON, protected only by SSE-KMS at rest. `EnvVarProps` now takes exactly one of `value` (non-secret) and `valueFrom: { config }`; the provider reads the config key inside `diff` and `reconcile` (`Config.Redacted`), sends it only to Vercel, and stores `valueDigest` (SHA-256 hex, `effect/crypto/Digest`) so a rotated value plans an update. Neither or both fails with `EnvVarValueMissing`. Package tests prove the secret is absent from persisted state, that a literal `value` is present (the control), and that rotation is detected. The digest is unsalted: fine for a high-entropy token, guessable for a short value. The OipWeb stack uses `valueFrom` for `CRM_HUBSPOT_SERVICE_KEY`.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Remove valueFrom and valueDigest from @beep/alchemy-vercel EnvVar and pass secrets as value again, accepting plain text in the KMS-encrypted state bucket.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Pulumi stays installed per stack until that stack's cutover | `infra/` | packet owner | destroy needs the CLI and program | the stack's `pulumi destroy` receipt |
| `@beep/infra-hosts` prod deploys from the operator workstation, never CI | one stack | packet owner | dankserver is reachable only over the YubiKey SSH route; S3 state lease is the overlap guard (D21) | a runner with a scoped deploy key to dankserver |
