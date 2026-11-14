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

### @beep/infra-turbo-cache is the first infra-kind package; the scratchpad module moved into it, 2026-11-13

Created with `bun run beep create-package infra-turbo-cache --family tooling --kind infra --dir-name turbo-cache` at `packages/tooling/infra/turbo-cache`: the directory drops the `infra-` prefix the kind segment already carries, as `tool/cli` does for `@beep/repo-cli`. The scaffold appended an explicit workspace path; it is replaced by the `packages/tooling/infra/*` glob beside the other tooling kinds, so later infra packages need no root edit. Every scratchpad file moved with `git mv` (handler to `src/Protocol.ts`, binding to `src/Bucket.ts`, constructor to `src/TurboCache.ts`, state reader to `src/internal/StateReader.ts`, handoff to `src/TokenHandoff.ts`, the CLI to `token.ts` at the package root beside `alchemy.run.ts`); `config.ts` and `token-failure.ts` folded into their users. `Protocol` and `Bucket` are public modules, not `internal/`, because the test Worker fixtures that import them are bundled by Alchemy with plain package resolution, which honours the exports map. the scratchpad turbo-cache-r2 directory, its `test:turbo-cache-r2` script and the scratchpad's `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/test` dependencies are gone.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: git mv the modules back to scratchpad/turbo-cache-r2, restore its test:turbo-cache-r2 script and Alchemy dependencies, drop packages/tooling/infra/* from root workspaces and remove the package.

### Cache tokens reach GitHub by stdin handoff under new names, not GitHub.Secret in this stack, 2026-11-13

`GitHub.Secret` in this stack would need a credential that can write repository and environment secrets inside the `turbo-cache-prod` deploy job; the Actions `GITHUB_TOKEN` cannot, so it would mean a new long-lived admin token or an App installation (App minting is out of scope, D10). Instead tokens stay in state only (never a stack output) and `token.ts` pipes one to a receiver's stdin: `gh secret set TURBO_CACHE_WRITE_TOKEN --env turbo-cache-write` for `ci-main`, `gh secret set TURBO_CACHE_READ_TOKEN` (repository) for `ci-pr`, the workstation's 1Password item for the trusted writers. The live `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and `TURBO_READ_TOKEN` are untouched: the new names stand beside them until stage 2 flips `setup-monorepo-ci`. `@beep/infra-github` reconciles these secrets when it lands, reading the tokens with `Output.stackRef`-style state reads rather than a second distribution path.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Add GitHub.Secret resources for TURBO_CACHE_WRITE_TOKEN and TURBO_CACHE_READ_TOKEN to alchemy.run.ts and a repository-admin GITHUB_TOKEN secret to turbo-cache-prod.

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

### Personal-stage live proof of the turbo cache, after the Cloudflare token gained R2 access, 2026-11-13

First attempt, blocked: the stack's Cloudflare token (`op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`, also the `turbo-cache-prod` secret) had no R2 permission. `GET /accounts/<id>/r2/buckets` returned `Authentication error`, and `bunx alchemy plan --stage dev_elpresidank --env-file /dev/null` loaded the S3 state and then failed in `plan.diff.resource` with `Unauthorized: Authentication error` (Cloudflare code 10000). The token had been minted 2026-10-28 for the website stack with Workers Scripts, Secrets Store, Account Settings and four zone groups, no R2 group. The lane did not widen it. With the operator's authorization the orchestrator added **Workers R2 Storage Write** to that token later the same day (secret value unchanged). **Notifications Write** was not added, so the error alert stays opt-in (no `TURBO_CACHE_ALERT_EMAIL`).

Live proof, 2026-11-13, Alchemy `2.0.0-beta.86`, from the package directory with the aws-vault session exported (`eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`, `AWS_REGION=us-east-1`) and the Cloudflare references passed through `op run`:

1. `bunx alchemy deploy --stage dev_$USER --yes --env-file /dev/null`: `Plan: 6 to create, 1 binding changes`, `Done: 6 succeeded`, Worker at a generated `turbocache-turbocache-dev-elpresidank-<id>.beep-effect.workers.dev` URL (personal stages do not pin names).
2. `bun token.ts --stage dev_$USER --principal ci-main -- sh -c "umask 077; cat > <scratch file>"` and the same for `ci-pr`: each printed only `TURBO_API=<worker url>` and `TURBO_TEAM=beep`; each file held 64 bytes, never printed, deleted afterwards.
3. A scratch Turborepo workspace outside the repository (one `build` task writing `out.txt`, `turbo` 2.11.11, `TURBO_CACHE=local:rw,remote:rw`, a fresh `--cache-dir` per run):
   - writer, empty local cache: `build: cache miss, executing 49dec4f73680ff15`, `Cached: 0 cached, 1 total`;
   - writer, fresh local cache: `build: cache hit, replaying logs 49dec4f73680ff15`, `Cached: 1 cached, 1 total`, run summary `"source": "REMOTE"`, `out.txt` restored;
   - reader, same input, fresh local cache: `cache hit, replaying logs 49dec4f73680ff15`, `"source": "REMOTE"` (a read token restores);
   - reader, changed input: `cache miss, executing dd4f4eb1ad453041` with `WARNING failed to contact remote cache: Unknown status read_only: The credential may read this team's artifacts but not upload them.`; the same run again with a fresh local cache is still `cache miss` (the upload was refused);
   - `curl -X PUT` of an artifact with the reader token: `403`, body `{"error":{"code":"read_only",...}}`; anonymous `GET /v8/artifacts/status?slug=beep`: `401`.
4. `bunx alchemy destroy --stage dev_$USER --yes --env-file /dev/null` first failed on the bucket with `BucketNotEmpty` (the writer's one artifact); Alchemy's `R2.Bucket` has no empty-on-delete option in beta.86. The one object in the dev bucket was deleted through the R2 objects API (name guarded to the `-dev-elpresidank-` bucket), then destroy reported `Done: 1 succeeded`. Verified gone: the account's R2 bucket list is `["beep-turbo-r2-pilot"]` only (the pilot, untouched), no Worker script named `turbocache*`, the Worker URL answers 404.

The hermetic equivalents run in CI: `bun run test:integration` in the package (workerd and a local R2 bucket, in-memory state, 4 tests).

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: n/a (evidence record; the stage was destroyed and verified gone).

### Pin @distilled.cloud/vercel at 1.0.0-rc.18, 2026-11-13

The root catalog gains `@distilled.cloud/vercel: 1.0.0-rc.18`. It is the published release whose only dependency is `@distilled.cloud/core@1.0.0-rc.18`, the core bun.lock already resolves for the other distilled packages, so no second core version enters the graph. rc.19 and rc.20 exist but would pull a newer core and belong to a deliberate distilled bump (D13). The operation signatures and line numbers the P0 matrix cites (`services/projects.ts`) match rc.18 exactly; every API the package uses was checked against the installed module, not the reference checkout (which tracks rc.19+).

Lane goals/infra-alchemy-rebuild-p2-vercel

Reverse: Change the root catalog entry and bun.lock in a dedicated pin-bump PR with alchemy plan no-op on every stack (D13).

### Pin the prod bucket and Worker names: beep-turbo-cache, 2026-11-13

Alchemy names a bucket or Worker from an instance id it keeps in state, so a stage whose state is lost or moved mints new ones (PR #3133). `prod` pins both to `beep-turbo-cache` (greenfield, D12: neither the AWS cache nor the pilot bucket `beep-turbo-r2-pilot` is touched), giving CI a stable `TURBO_API` of `https://beep-turbo-cache.beep-effect.workers.dev`. Personal stages keep generated names. The stage is read with `Effect.serviceOption(Stage)`, so the bundled Worker runtime, which has no `Stage`, never sees a stage-dependent prop. `RemovalPolicy.retain` holds the bucket and the tokens in `prod` only.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Remove productionNames from src/TurboCache.ts; prod then takes generated names from state-held instance ids.

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

### Runner user data supports Amazon Linux and Ubuntu and reads its token path from instance tags, 2026-11-13

The user data ports upstream's `user-data.sh`, `install-runner.sh` and `start-runner.sh` without X-Ray, the CloudWatch agent or the SSM config-path lookup: scale-up tags each instance with `ghr:token_path` and `ghr:runner_name_prefix`, and the script reads them through IMDSv2 metadata tags, so a pool needs no SSM config parameters. The live fleet controller pins `ciFleetController:amiId` (`infra/ci-runners/Pulumi.production.yaml`; the AL2023 default parameter in `infra/src/CiFleetController.ts`; boot-time `dnf upgrade-minimal`), while the Ubuntu 24.04 parameter in `infra/ci-runners/Pulumi.yaml` configures the `CiRunners` groundwork stack. The script picks dnf or apt-get from `/etc/os-release` (installing AWS CLI v2 on Ubuntu), so either image works; the runner still starts with the actions runner run script in its `/opt/actions-runner` install directory, which keeps the live post-install shim working.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Bake run_as, token path and agent mode back into SSM config parameters read by the user data, as upstream's start-runner.sh does.

### RunnerFleet owns the App secret parameters under its own KMS key and serves the webhook from a function URL, 2026-11-13

The composite declares one KMS key and alias per fleet and writes the App id, base64 key and webhook secret as SecureString `SSM.Parameter`s under it from caller-supplied `Redacted` values (nothing here reads 1Password or mints an App). Lambda roles read them through `bind` inline policies; the termination watcher's `kms:Decrypt` carries `kms:EncryptionContext:PARAMETER_ARN` for the id and key parameters, so no KMS grant exists. The webhook is a public Lambda function URL (the module used API Gateway); `RunnerSweep` depends on each pool's scale-up function so destroy sweeps runtime instances first.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Take existing parameter ARNs as inputs and drop the composite's KMS key and SSM parameters.

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

### The packet ran four open PRs on 2026-11-13, one over its cap, 2026-11-13

#3289, #3290, #3291 and #3292 were open together because three P2 children were released at once under the operator's push ruling and raced the open-PR count. The orchestrator accepted the four as they stood rather than discard running hosted proofs; no fifth opened until the count fell below three.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: n/a (record of a breach; later lanes count open packet PRs before `yeet open`)

### The throttle alarm becomes an opt-in Workers Observability real-time-issue alert, 2026-11-13

The AWS cache alarmed on Lambda throttles because a throttled read is a silent miss and a throttled write a lost upload. A Worker has no reserved concurrency to exhaust; the equivalent failure is the Worker erroring. The account's available-alerts listing (read 2026-11-13 with the Alchemy token) offers `workers_observability_real_time_issue` (no filters), `workers_observability_alert` and `billing_usage_alert`; the stack enables Workers Logs on the Worker and adds a `Cloudflare.Alerting.NotificationPolicy` of the first type when `TURBO_CACHE_ALERT_EMAIL` is set, the same opt-in the AWS alarm had (`throttleAlarmRecipients`). No rate-limit binding: per-token throttling would turn a busy CI wave into cache misses, the failure the alarm existed to catch. Creating the policy needs Notifications Write on the stack's Cloudflare token; until the recipients secret is set no policy is planned.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Remove the NotificationPolicy and the observability flag from the stack; re-add a CloudWatch-style alarm only if Workers start throttling.

### Turbo cache policy: one token per team principal, read or write, rotation in the resource id, 2026-11-13

The signed-policy semantics of the AWS cache (authorizer plus HMAC-signed writer) and the R2 pilot (separate read and read-write grants) become data in `CachePolicy`: a team (`beep`) owns `<team>/<hash>` keys, and each principal of a team holds its own `Random` token of access class `read` or `write`. The Worker is the only holder of bucket access, so the token class it checks is the whole write boundary: a `read` token may query, download, read status and report events, and its upload is `403 read_only` before the bucket is touched. Principals: `ci-main` (write; only in the `turbo-cache-write` environment, which only protected `main` pushes enter), `ci-pr` (read; a repository secret, which GitHub never passes to fork pull requests, so forks stay local-only), `dankstation` and `beep-worker` (write; the named trusted workstations). One token per holder replaces the AWS cache's one shared write token, so revoking a workstation does not rotate CI. `rotation` is part of each token's resource id (`TurboCacheToken-<team>-<principal>-r<n>`): raising it replaces exactly that token on the next `main` deploy.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Collapse cachePolicy to one write principal per team and drop the access check in Protocol.ts; tokens of removed principals stop working on the next deploy.

### turbo-cache-prod GitHub environment and its state-role subject are bootstrap singletons, 2026-11-13

Created 2026-11-13 for `.github/workflows/deploy-turbo-cache.yml`, by hand because `@beep/infra-github` does not exist yet: GitHub environment `turbo-cache-prod` (custom branch policy, `main` only), its variable `ALCHEMY_STATE_ROLE_ARN` (the `beep-effect-web-prod` value), and its secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` piped from `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN` and `.../CLOUD_CLOUDFLARE_ACCOUNT_ID` without printing them. The trust policy of role `beep-alchemy-state-rw` was read first (two subjects, the storybook lane's edit included) and now lists three: `beep-effect-web-prod`, `storybook-prod`, `turbo-cache-prod`. `TURBO_CACHE_ALERT_EMAIL` is not set (no recipient chosen). `@beep/infra-github` adopts the environment, variable and secrets when it lands (D20).

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: gh api -X DELETE repos/beep-effect/beep-effect/environments/turbo-cache-prod; set the beep-alchemy-state-rw trust policy sub list back to the beep-effect-web-prod and storybook-prod subjects with aws iam update-assume-role-policy.

### Turbo-cache stage 2 and the runner fleet wait for the ci-lane-economics window-5 verdict, 2026-11-13

Agreed 2026-11-13 with the orchestrator and the CI window-5 owner. Repointing heavy.yml, check.yml and the setup-monorepo-ci action to the Worker cache (stage 2) and replacing the runner fleet (P5) both change what window 5 measures, so they release on the window-5 census verdict (scheduled 2026-11-20T20:10Z), not on the clock: on a pass both release; on a denial stage 2 may land as a repair before window 6 and P5 waits for window 6's verdict. Nothing live degrades meanwhile: the AWS Lambda cache and the R2 pilot keep serving and the Worker cache runs beside them. Deploy workflows this packet adds are push-to-main only, one hosted job with `timeout-minutes`, and every PR that adds or edits a workflow is disclosed to the orchestrator and merged by the operator.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Proceed with stage 2 or P5 earlier only if the window-5 owner agrees to restart the measurement window.

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

### Cost controls adopts nine account singletons (D20), 2026-11-14

D20 per-object adoption list for the `CostControls` stack. Nine live account objects are adopted, not recreated; none has a greenfield name. All nine are declared by `prod` only (amended 2026-11-14 after beep-reviewer round 1 on #3310): `prod` deploys only from CI behind the pre-deploy gate, and personal stages declare their own budget alone, so no workstation deploy adopts, claims or writes an account-wide setting and no two stage states claim one singleton.

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

### Cost controls deploys through a stack-scoped OIDC role, beep-alchemy-cost-controls-deploy, 2026-11-14

Created 2026-11-14 by the packet gate session from the commands below, run as written (policy files in a scratch directory, deleted afterwards), before this lane's PR opened. Receipts: role `arn:aws:iam::832907639880:role/beep-alchemy-cost-controls-deploy` with inline policy `cost-controls-deploy`; `aws iam simulate-principal-policy` for `budgets:ModifyBudget` returns `implicitDeny` on the Pulumi budget `Monthly Budget` and `allowed` on `beep-account-monthly-cost`; GitHub environment `cost-controls-prod` with a `main`-only branch policy; environment variable `COST_CONTROLS_DEPLOY_ROLE_ARN` set; environment secret `COST_CONTROLS_NOTIFICATION_EMAILS` set from the encrypted Pulumi config, its shape checked only (one line, contains an `@`, no spaces). This lane created nothing. The shared role `beep-alchemy-state-rw` stays state-only; the `CostControls` stack takes its own GitHub OIDC deploy role, `beep-alchemy-cost-controls-deploy`, and its workflow assumes only that role (state access included), as `vars.COST_CONTROLS_DEPLOY_ROLE_ARN` on the `cost-controls-prod` environment.

Trust: the existing provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, subject exactly `repo:beep-effect/beep-effect:environment:cost-controls-prod`. Session length one hour.

Permissions, inline policy `cost-controls-deploy`, least privilege for what the five providers and the post-deploy check call:

- Budgets (global service; budget ARNs carry no region): `budgets:ViewBudget` on `arn:aws:budgets::832907639880:budget/*` (DescribeBudget and DescribeBudgets, the latter for the verify step); `budgets:ModifyBudget`, `budgets:TagResource`, `budgets:UntagResource`, `budgets:ListTagsForResource` only on `arn:aws:budgets::832907639880:budget/beep-account-monthly-cost`. ModifyBudget covers create, update, delete and every notification and subscriber call. The Pulumi budget `Monthly Budget` stays out of reach.
- Cost Explorer anomaly detection (global, `us-east-1` endpoint): `ce:GetAnomalyMonitors`, `ce:GetAnomalySubscriptions`, `ce:CreateAnomalySubscription` on `*` (list and create take no resource ARN); `ce:UpdateAnomalyMonitor`, `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` on the adopted monitor `arn:aws:ce::832907639880:anomalymonitor/a54c4e18-4b98-4923-8256-fbb09e595460`; `ce:UpdateAnomalySubscription`, `ce:DeleteAnomalySubscription`, `ce:TagResource`, `ce:UntagResource`, `ce:ListTagsForResource` on `arn:aws:ce::832907639880:anomalysubscription/*`. No `ce:CreateAnomalyMonitor` and no `ce:DeleteAnomalyMonitor`: the monitor is adopted and retained.
- Cost allocation tags: `ce:ListCostAllocationTags`, `ce:UpdateCostAllocationTagsStatus` on `*`.
- Compute Optimizer (regional API, called in `us-east-1`): `compute-optimizer:GetEnrollmentStatus`, `compute-optimizer:UpdateEnrollmentStatus` on `*`.
- Cost Optimization Hub (`us-east-1` only): `cost-optimization-hub:ListEnrollmentStatuses`, `cost-optimization-hub:UpdateEnrollmentStatus` on `*`.
- No `iam:CreateServiceLinkedRole`: both service-linked roles exist (both services are enrolled), and the reconcile writes only on a status change. A re-enrollment after an opt-out would fail loudly and need that permission added on purpose.
- State store: `s3:ListBucket`, `s3:GetBucketLocation`, `s3:GetBucketVersioning`, `s3:GetBucketOwnershipControls`, `s3:GetBucketPublicAccessBlock`, `s3:GetEncryptionConfiguration` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an`; `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/CostControls/*` only. No bucket-configuration writes: the store is operator-bootstrapped, and the plan step fails on an outdated store instead of repairing it. The AWS-managed `aws/s3` key authorizes S3 use for account principals, so no KMS statement.

Commands as run by the packet gate session (operator workstation, `AWS_PROFILE=elpresidank-vault`), then the GitHub side:

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
- `alchemy plan --stage prod --detailed` writes to a file under `$RUNNER_TEMP` (on failure only its non-property lines are printed), then the pre-deploy gate step runs `plan-check.ts` on that file and on the live values of the nine adopted settings, then `alchemy deploy --stage prod --yes` without `--detailed`; all with `--env-file /dev/null --no-input`, `CI=true`, `ALCHEMY_TELEMETRY_DISABLED=1`. No property value reaches the log. The recipient secret is passed to plan and deploy and read only in the `live` phase. The gate is the window-5 ruling's condition 2 (decision "Cost controls is not lane-affecting on two conditions").
- A post-deploy check polls (10 tries, 15 s apart) until the budget `beep-account-monthly-cost` exists and the monitor `beep-account-services` carries `alchemy::stack=CostControls`, because Budgets and Cost Explorer are eventually consistent.
- Nothing else changes: no edit to `check.yml`, `heavy.yml`, `.github/actions/setup-monorepo-ci`, runner labels or any pull-request job. The job's line joins the exemption list in `packages/tooling/tool/cli/test/ci-runner-security.test.ts` beside the other two Alchemy deploys.

Rulings (packet gate session, 2026-11-14): the first `prod` plan runs only in this workflow, never from a workstation; this lane's PR opens when the gate says a packet slot is free (next in line after the three open PRs drain by one). The first run happens on the merge of this lane's PR. It needs the role, environment and variable from the deploy-role decision first; without them the credentials step fails and nothing is touched.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Delete .github/workflows/deploy-cost-controls.yml and its line in the ci-runner-security exemption list; the stack's resources stay as last deployed.

### Cost controls cutover goes live first, Pulumi destroy second (packet gate), 2026-11-14

Ruling of the packet gate session, 2026-11-14, superseding the destroy-first order and the two-hour gap rule recorded on 2026-11-14 (cutover decision, timing; silent-parallel-run decision, gap limit): in the Pulumi cutover `live` goes first and the Pulumi destroy second.

Why: the destroy-first order leaves a gap between destroying `Monthly Budget` and `beep-account-daily-anomalies` and the `live` deploy in which the account, already over its budget ($371.54 month to date against $200 on 2026-11-13), has no budget and no anomaly mail at all. The cost of the new order is one duplicate burst: the new budget sends each threshold mail once when its notifications are created, and the new `AnomalyAlerts` subscription runs beside the old Pulumi one, so at most one duplicate daily anomaly digest, until the gate session destroys the old pair right after the `live` deploy is verified.

New order: (1) merge the `live` PR, whose deploy adds the budget notifications and creates `AnomalyAlerts` (the pre-deploy gate accepts a budget update and an `AnomalyAlerts` create while the nine singletons stay no-op; the PR does not touch the workflow, so it is an ordinary gate merge, disclosed to the orchestrator before it merges as the window-5 owner asked); (2) verify both exist and the gate step passed; (3) the gate session destroys only the old Pulumi budget and subscription by target, then removes the monitor, six tags, two enrollments, provider and component from Pulumi state; (4) the component-removal PR merges after `live` has been green for 24 hours. Rollback follows the order: before (3), a PR back to `silent` (the gate's single allowed `AnomalyAlerts` delete); after (3), restore the Pulumi pair (import, refresh, preview two creates, targeted up), then `silent`; after (4), revert the removal PR first. The cutover decision, the silent-parallel-run decision, the runbook and the package README carry the new order.

Lane goals/infra-alchemy-rebuild-p3-cost-controls-live

Reverse: Return to the destroy-first order with a bounded gap: destroy the old Pulumi pair before merging live; requires a new packet gate ruling.

### Cost controls personal-stage plan: 1 create, no account singleton, no delete or replace; no spend, 2026-11-14

Amended 2026-11-14 after beep-reviewer round 1 on #3310 (P2, relayed by the packet gate session): personal stages no longer declare any account singleton, so a workstation deploy cannot adopt or write an account-wide setting outside the workflow's pre-deploy gate. Re-measured the same day with the same read-only command (`bunx alchemy plan --stage dev_elpresidank --env-file /dev/null --no-input`): `Plan: 1 to create`, the only line `[MonthlyBudget] create`; the state bucket still held only `BeepEffectWeb/` and `Storybook/` afterwards. The `prod` graph is unchanged. The first measurement, kept below as history, planned `1 to create, 8 to adopted` because every stage then adopted the six tags and two enrollments.


Read-only `alchemy plan` for a personal stage against account 832907639880, from `packages/tooling/infra/cost-controls` on 2026-11-13, credentials from `eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"`, `AWS_REGION=us-east-1`, `CI` unset: `bunx alchemy plan --stage dev_elpresidank --env-file /dev/null --no-input --detailed`. Exit 0, `Plan: 1 to create, 8 to adopted`, no delete, no replace, no update. No deploy ran; afterwards the state bucket still held only `BeepEffectWeb/` and `Storybook/`, and every live setting read the same as before.

| Plan line | Live state (read-only `aws` reads, same day) | Why |
| --- | --- | --- |
| `[MonthlyBudget] create`, `budgetName: beep-account-monthly-cost-dev_elpresidank`, limit 200 USD, cost types as Pulumi's, `notifications: []` | `aws budgets describe-budgets` lists one budget, `Monthly Budget` (200 USD, MTD $371.54) | new stage-suffixed name, nothing to read; silent phase, so no subscribers and no recipient variable read |
| `[AppTag]`, `[BeepCiTag]`, `[DataClassTag]`, `[GhrEnvironmentTag]`, `[ManagedByTag]`, `[ProjectTag]` `adopted`, no declared property changes | `aws ce list-cost-allocation-tags` for the six keys: all `Active`, `UserDefined` | `read` returns plain attributes; declared `Active` equals live, so the deploy would write nothing |
| `[ComputeOptimizer] adopted`, no changes | `aws compute-optimizer get-enrollment-status`: `Active`, member accounts off | same |
| `[CostOptimizationHub] adopted`, no changes | `aws cost-optimization-hub list-enrollment-statuses`: `Active`, member accounts off | same |
| no monitor, no subscription line | `aws ce get-anomaly-monitors`: one `DIMENSIONAL`/`SERVICE` monitor `beep-account-services`; `get-anomaly-subscriptions`: `beep-account-daily-anomalies`, daily, threshold 10 | by design a personal stage declares neither (the monitor is an account singleton adopted only by `prod`) |

Difference from the brief's expectation (three named creates): only the budget plans as a create. The eight tag and enrollment singletons and the anomaly monitor are `prod` only; the anomaly monitor cannot be created beside the live one (one services monitor per account) and is adopted by `prod`, and the subscription exists only in `prod`'s `live` phase. The `prod` plan, which exercises the monitor adoption, first runs as the workflow's plan step; it needs `CI=true` and, by the packet gate session's ruling of 2026-11-14, runs only in the workflow, never from a workstation. The hermetic tests cover it (`adopts the services monitor, keeps the budget silent and retains both`).

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

The third named resource cannot be greenfield. AWS allows one `DIMENSIONAL` / `SERVICE` ("AWS services") anomaly monitor per account (Cost Management quotas page; the live account has exactly one, `beep-account-services`), so a second monitor beside the Pulumi one would fail `CreateAnomalyMonitor` with a quota error, and the plan cannot show that because plan never calls create. The monitor therefore joins the adopted singletons (next decision): `prod` declares `AccountServicesMonitor` with the live name `beep-account-services`, `AdoptPolicy.adopt(true)` on that one resource (its `read` reports `Unowned` because it carries no Alchemy tags) and `RemovalPolicy.retain()`. Adoption also keeps the monitor's detection history. Personal stages do not declare it, nor any other account singleton, so a dev stage never adopts the account's only services monitor or any tag or enrollment.

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

Preconditions: the first `prod` deploy of `CostControls` is green including its verify step (done 2026-11-14, run 43555854755); `alchemy plan --stage prod` in CI shows no create or replace; `aws ce list-tags-for-resource` on the monitor shows `alchemy::stack=CostControls`; the orchestrator has been told the Pulumi steps are about to run.

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

Order (packet gate ruling, 2026-11-14, superseding the earlier destroy-first order and its two-hour gap rule): `live` goes first and the Pulumi destroy second, so the account, already over its budget, is never without budget and anomaly mail. The cost is one duplicate burst: the new budget sends its threshold mails once when its notifications are created, and the new `AnomalyAlerts` subscription runs beside the old Pulumi one until step 4.

1. Merge the `live` PR (an ordinary gate merge; it does not touch the workflow). Its deploy updates the budget with the four notifications and creates `AnomalyAlerts`; the pre-deploy gate accepts that plan because the budget and the subscription are not singletons, and the nine singletons stay no-op.
2. Verify: the workflow's gate step printed all nine singletons as `noop` and `deploy may run`; `aws budgets describe-notifications-for-budget --account-id 832907639880 --budget-name beep-account-monthly-cost` lists four notifications; `aws ce get-anomaly-subscriptions` lists `beep-account-anomaly-alerts` on the monitor's ARN with threshold 10, beside the old `beep-account-daily-anomalies`.
3. Unprotect, state only, URNs 1-12:

   ```sh
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi state unprotect --stack production --yes "$U1" "$U2" "$U3" "$U4" "$U5" "$U6" "$U7" "$U8" "$U9" "$U10" "$U11" "$U12"
   ```

   Check: `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi stack export --stack production | jq '[.deployment.resources[] | select(.urn|test("AccountCostControls")) | .protect // false] | any'` prints `false`, and `| jq '.deployment.resources|length'` still prints 367.
4. Destroy the old budget and subscription, preview first, right after step 2 passed:

   ```sh
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi destroy --stack production --target "$U1" --target "$U2" --preview-only
   PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi destroy --stack production --target "$U1" --target "$U2" --yes
   ```

   The preview must show exactly 2 deletes, both named above, nothing else; never add `--target-dependents` or `--run-program`. Check: `aws budgets describe-budgets --account-id 832907639880 --query 'Budgets[].BudgetName'` lists `beep-account-monthly-cost` and not `Monthly Budget`; `aws ce get-anomaly-subscriptions --query 'AnomalySubscriptions[].SubscriptionName'` lacks `beep-account-daily-anomalies`; `aws ce get-anomaly-monitors` still lists `beep-account-services`.
5. State delete, URN 3 first (its dependent, URN 2, is gone), then 4-11, then 12, then 13:

   ```sh
   for u in "$U3" "$U4" "$U5" "$U6" "$U7" "$U8" "$U9" "$U10" "$U11" "$U12" "$U13"; do
     PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi state delete --stack production --yes "$u" || break
   done
   ```

   Check after the loop: no `AccountCostControls` URN in the export and 354 resources; `aws` reads unchanged (six tags Active, both enrollments Active, monitor present).
6. In a later PR, merged only after the `live` deploy has been green for 24 hours, delete `AccountCostControls` from `infra/src/internal/ci-runners-entry.ts`, `infra/src/AccountCostControls.ts` and its test, and the `accountCostControls:` keys from `Pulumi.production.yaml` except `notificationEmailAddresses`, which the turbo-cache throttle alarm keeps reading. That PR merges before the next `pulumi preview` or `up` of this stack: until then the program still declares the component, and a preview would plan to create all eleven resources again (the monitor create would hit the one-per-account quota). After it, the recipient list lives in two places only: that Pulumi config key and the `cost-controls-prod` GitHub secret.

Rollback, by stage:

- Before step 4 (the Pulumi pair is still live): one PR sets `notifications` back to `silent`. Its plan deletes the stack's own `AnomalyAlerts` subscription, the single delete `checkPlan` allows, by logical id and by the `delete` action only; the budget's notifications update to none. Every other delete, every replace and every orphan is still refused, and the nine adopted settings still may not change, so the window-5 condition is not weakened. Check: the gate step passes, and `aws ce get-anomaly-subscriptions` no longer lists `beep-account-anomaly-alerts`.
- After step 4, before the component-removal PR (step 6) merges, restore the Pulumi budget and subscription: `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run -- pulumi stack import --stack production --file <newest archive>` (import only if no other update ran since the export; otherwise re-add single objects with `pulumi import`). The import restores state only, and that state still lists the two objects step 4 deleted, so refresh them first: `... op run -- pulumi refresh --stack production --target "$U1" --target "$U2" --yes`, then `... op run -- pulumi preview --stack production --target "$U1" --target "$U2"` and confirm exactly two creates, then `... op run -- pulumi up --stack production --target "$U1" --target "$U2" --yes`. Check: `aws budgets describe-budgets` lists `Monthly Budget` and `aws ce get-anomaly-subscriptions` lists `beep-account-daily-anomalies`. Then take the Alchemy prod stage back to `silent` (first case) so only one set mails. The singletons need nothing: neither tool changed their status.
- After step 6 merged: `pulumi up` and `preview` build their desired graph from the current program, which no longer declares the component, so first revert the component-removal PR (restoring `AccountCostControls` in the program and its config keys) and merge the revert, then run the import, refresh, preview and targeted `up` above. The orchestrator is told first, as for every step here.

Timing: steps 3 to 5 run right after step 2 is verified; the duplicate mails last only until step 4. The component-removal PR (step 6) does not merge until the `live` deploy has been green for 24 hours.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Before the program PR: pulumi stack import --stack production --file ~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-13.json (or a newer export), then pulumi up --target the budget and subscription URNs.

### Cost controls runs silent beside Pulumi and goes live after the cutover, 2026-11-14

Two budgets and two anomaly subscriptions would mail the same people twice, and on creation, not only on the next breach: month-to-date spend was $371.54 against the $200 limit on 2026-11-13, so all four live notifications (ACTUAL 50/80/100 %, FORECASTED 100 %) are in `ALARM`, and a new budget with the same thresholds alerts at once.

The stack therefore runs in two phases, set by `notifications` in the tracked `prod` configuration:

1. `silent` (what this lane ships): the new budget exists with no notifications and no anomaly subscription is declared; the adopted monitor keeps feeding the Pulumi-owned subscription. Nobody is mailed by the new stack.
2. `live`: one-line PR, merged before the Pulumi destroy (packet gate ruling, 2026-11-14); the deploy it triggers adds the four budget notifications and creates `beep-account-anomaly-alerts` on the adopted monitor. The old Pulumi budget and subscription are destroyed right after the `live` deploy is verified.

Superseded in part (packet gate ruling, 2026-11-14): the silent phase kept recipients from being mailed twice during the parallel run, but the destroy-first order it assumed left a gap with no budget or anomaly mail on an account already over its budget. The order is now `live` first, Pulumi destroy second. The cost is one duplicate burst: each threshold mails once from the new budget when its notifications are created (the month is already over budget), and the new daily anomaly subscription runs beside the old one until the gate session destroys the old pair right after the `live` deploy is verified, so at most one duplicate daily digest. There is no gap and no gap limit; the earlier two-hour rule is withdrawn. The component-removal PR still waits until `live` has been green for 24 hours.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Return prod to silent with one PR (notifications: silent); its plan deletes only the stack's own AnomalyAlerts subscription, the single delete the pre-deploy gate allows.

### Cost controls configuration is a tracked schema; recipients come only from the environment, 2026-11-14

Configuration is schema-first in `src/Config.ts` (`CostControlsConfig`, an `S.Opaque` struct): `expectedAccountId` (twelve digits), `region` (`LiteralKit(["us-east-1"])`), `monthlyBudgetUsd` and `anomalyImpactUsd` (finite, positive), `notifications` (`LiteralKit(["silent", "live"])`). The stage inputs are tracked source, decoded through `resolveStageConfig` at program start; a bad value stops the stack with a `ConfigError` before any AWS read. `prod`: account `832907639880` (already public throughout the repository), $200 budget and $10 anomaly impact, the values in `infra/ci-runners/Pulumi.production.yaml` today. Every other stage takes the same values, always `silent`.

Recipients stay out of tracked files. The Pulumi stack file carries `accountCostControls:notificationEmailAddresses` only as a `secure:` ciphertext, so the addresses are not public there either. The stack reads them from one environment variable, `COST_CONTROLS_NOTIFICATION_EMAILS` (comma-separated, decoded by `NotificationRecipients` to normalized, deduplicated `EmailString`s), and only in the `live` phase, so silent stages and the personal plan need no addresses at all. CI: a secret of the same name on the `cost-controls-prod` GitHub environment, which Actions masks in logs. Source (ruling, packet gate session, 2026-11-14): no new 1Password field; the bootstrap step pipes the list from the encrypted Pulumi config key into the GitHub secret without printing it (deploy-role decision). A workstation never needs the list: personal stages are always `silent`. The plan and deploy steps run without `--detailed`, so no property value reaches a public log. The addresses do sit in the stack's state objects as plain props (the Budget and AnomalySubscription providers take strings), inside the private SSE-KMS state bucket, the same exposure the Pulumi state had for its decrypted outputs.

Account guard: `requireExpectedAccount` compares the resolved `AWSEnvironment` account and region with the configuration through a literal schema and fails with a `ConfigError` naming the expected account; it runs on every stage before any resource. `prod` also requires `CI=true` (`requireCiForProduction`). The provider layer (`src/Providers.ts`) registers only the five providers the stack declares and pins the region with `AWS.Region.of("us-east-1")`: Budgets and Cost Explorer are global services served from `us-east-1`, Cost Optimization Hub answers only there.

Coupling kept as is: in the Pulumi program the same `notificationEmailAddresses` list also feeds the AWS turbo cache's throttle alarm (`throttleAlarmRecipients` in `infra/src/internal/ci-runners-entry.ts`). The PR that deletes the `AccountCostControls` component keeps that config key, or moves it to a `ciTurboCache:` key, until the AWS cache leaves Pulumi.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Move thresholds back into environment config by reading them with Config.schema(CostControlsConfig) instead of the tracked stage inputs; recipients have no tracked form to revert.

### Cost controls is not lane-affecting on two conditions: no enforcement, and a pre-deploy plan gate (window-5 owner), 2026-11-14

Ruling of the CI window-5 owner, relayed by the orchestrator through the packet gate session on 2026-11-14, before this lane's PR opened: the `@beep/infra-cost-controls` PR is not lane-affecting for the CI measurement window, on two binding conditions about what the deploy does. Both are built into the head that opens the PR.

1. No enforcement, ever, without a new ruling. The stack declares no budget action, no service control policy, no quota change and no anomaly response that can stop, throttle or deny EC2 or Spot launches for the heavy runner pool or the `beep-ovf` overflow pool. Confirmed for this head: it declares six resource types only (`DeclaredResourceTypes`: Budgets budget, Cost Explorer anomaly monitor and subscription, cost allocation tag, Compute Optimizer and Cost Optimization Hub enrollment), the provider layer registers only those five providers, and the budget props have no action field. The test "declares only the six cost types, and the budget carries no action" (`test/CostControls.test.ts`) fails if the planned graph gains any other type, any type naming a budget action, Organizations, Service Quotas, EC2, Auto Scaling, Lambda or IAM, or a budget prop containing "action". The package README states it. The later switch from `silent` to `live` adds email notifications only (four budget notifications and one daily anomaly email subscription), and that PR is disclosed to the orchestrator before it merges.
2. "Adopts nine account cost settings with no property change" holds at apply time, enforced by the workflow. Between plan and deploy, in the same single job, the step "Check the plan before deploy" runs `bun plan-check.ts` with five paths (the detailed plan log, then the raw AWS CLI outputs for the cost allocation tags, the Compute Optimizer enrollment, the Cost Optimization Hub enrollment and the anomaly monitors) (`src/PlanCheck.ts`, `checkPlan`), and the job fails before any deploy unless every one of the nine adopted singletons (the six tags, the two enrollments, the services monitor) plans as `adopted` or `noop` with no declared property change, and nothing in the plan is a `delete`, `replace` or `orphaned`, with one exception the packet gate ruled on 2026-11-14 (ruling C on the #3310 review): a `delete` of the stack's own `AnomalyAlerts` email subscription, by logical id, so the `live`-to-`silent` rollback can pass. It is not one of the nine settings and touches nothing that affects EC2, Spot or Lambda; the nine settings still may not change, so the condition is not weakened. Because a cold adoption compares declared props only, the gate also reads the nine live values with the AWS CLI and requires them to equal the declared ones (tags Active, enrollments Active for this account only, exactly one DIMENSIONAL/SERVICE monitor named `beep-account-services`), so the reconcile writes nothing to them. One write remains by design: adopting the monitor adds Alchemy's `alchemy::*` ownership tags to it; no cost, threshold or detection property changes. Tests in `test/PlanCheck.test.ts` cover a clean first plan, an all-noop later plan, a singleton update, a singleton property change, a delete and a replace, a missing singleton, a live setting that differs, and a resource outside the stack. Any resource outside the stack (the stack has nothing that touches EC2, Spot or Lambda concurrency) stops the job with an instruction, also in the runbook section "Cost controls", to ask the CI goals driver through the orchestrator.

The workflow keeps its disclosed shape: push to `main` path-filtered plus an optional bare `workflow_dispatch`, one GitHub-hosted job with `timeout-minutes: 20`, environment `cost-controls-prod`, and nothing touching `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job. The gate reads only APIs the deploy role already allows.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Only by a new ruling of the CI window owner; mechanically, drop the plan-check step from deploy-cost-controls.yml and the enforcement test, which this ruling forbids without one.

### JIT registration applies to ephemeral pools only; a failed runner start terminates, 2026-11-14

beep-reviewer (#3313, P2) found that a non-ephemeral pool with the default `jitConfig: true` booted a runner that could not start: scale-up writes a JIT config only when `pool.ephemeral && pool.jitConfig`, but the user data keyed on `jitConfig` alone. Of the two ways out (refuse the combination in the pool schema, or make user data and scale-up agree), the port takes the second because it is what upstream does: v7.10.1 `start-runner.sh` runs `config.sh` whenever JIT is disabled or the runner is not ephemeral, so `jitConfig` is ignored for non-ephemeral runners rather than rejected. `renderRunnerUserData` now uses `ephemeral && jitConfig`, the same condition as scale-up, and its exit trap terminates the instance when the runner exits non-zero (upstream also terminates on a failed start), so a misconfigured non-ephemeral runner no longer stays up. Tests cover `ephemeral: false` with the default `jitConfig`.

Lane goals/infra-alchemy-rebuild-p2-github-runners-fleet · PR #3314

Reverse: Refuse jitConfig true on a non-ephemeral pool in the RunnerPool schema, with the default following ephemeral, and drop the user-data guard.

### OipWeb adopts the live Vercel projects in place, 2026-11-14

Ruled by the packet gate session, 2026-11-14: approved, a per-object exception to D12 in the spirit of D20, because it changes no setting, keeps ids, history and preview URLs, and leaves `vercel-deploy.yml` unedited, which the CI measurement window requires; every adopted object keeps `RemovalPolicy` protection, with a test that destroying a stage deletes none of them. The 2026-11-14 census found the live projects `oip-web` (prj_J5xqp5jg7POGvoIwOj7e1axpoPxb) and `oip-web-staging` (prj_orJn2nvxflBiJqPF0VWLOD0RFAzE) linked to `beep-effect/beep-effect` (Pulumi state still records the pre-transfer `kriegcloud/beep-effect`). A new project beside each (D12) would need a READY production build before the domain move, would put previews and history on new hostnames, and would force an edit of `vercel-deploy.yml`, whose `VERCEL_APPS` env names both project ids and which runs pull-request jobs. As built, `Vercel.Project` declares only `name` and `teamId`, so adoption sends no project setting at all (the window-5 decision lists what it can and cannot change). Every adopted object (project, three variables, domains, DNS records) carries `RemovalPolicy.protect()` on `prod` and `staging`; `test/stack/OipWebStack.test.ts` deploys each live stage over the seeded census, runs `destroy`, and asserts `ProtectedResource` with every adopted object and the bucket still present and no delete call made. Neither option costs anything on the Hobby team.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Declare a new project per stage (projectName oip-web-<stage>-new), add moveFrom with the live project id to each Vercel.Domain, edit the two projectId values in vercel-deploy.yml VERCEL_APPS, and forget the adopted project rows with alchemy state delete.

### OipWeb assets buckets are new; the Pulumi buckets are empty and unread, 2026-11-14

Ruled by the packet gate session, 2026-11-14: approved as built. `assets.oip.law` and `staging-assets.oip.law` hold 0 objects, 0 versions and 0 delete markers (census 2026-11-14), and no app, package or workflow reads or writes them. A new bucket therefore needs no copy and no reader switch, so D12's greenfield default applies at no cost: `oip-law-web-assets-prod` and `oip-law-web-assets-staging` (HeadBucket 404 on both names, so unclaimed), with the Pulumi baseline restated (versioning, AES256 with SSE-C blocked, full public-access block, BucketOwnerEnforced, DenyInsecureTransport policy) and `RemovalPolicy.protect()` on live stages; the deploy role also denies `s3:DeleteBucket` on both. S3 bills storage and requests only, so an empty bucket costs nothing. The Pulumi buckets are deleted empty at cutover after `pulumi state unprotect` on their five protected resources each.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Set assetsBucketName to assets.oip.law / staging-assets.oip.law in liveStageConfig (the S3 provider adopts silently by name), skip the Pulumi bucket destroy and pulumi state delete the five bucket resources instead.

### OipWeb bootstrap: deploy role, environment, secrets and the Cloudflare grant, 2026-11-14

Ruled by the packet gate session, 2026-11-14: it runs these commands itself when the PR is about to open; no lane runs them. `@beep/infra-github` adopts the environment, variable and secrets when it lands (D20). Run on the operator workstation with the aws-vault session alive; values are piped from 1Password and never printed.

**1. Deploy role** (least privilege on the shared state store, matching the cost-controls deploy role: bucket-level reads only, object read, write and delete under the stack's own `OipWeb/` prefix; every action on the two assets buckets, `s3:DeleteBucket` denied on them). The packet gate session created it 2026-11-14 05:10Z with this policy. No bucket-config writes are needed because the plan step fails on a missing or outdated store; every object a deploy touches is `OipWeb/<stage>/...` (resource rows, `__stack_output__.json`, `__lease__.json`; the store version is a code constant, and bucket-policy calls exist only in `alchemy state migrate`):

```sh
export AWS_PROFILE=elpresidank-vault
d="$HOME/.cache/beep/oip-web-bootstrap"; mkdir -p "$d"
cat > "$d/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com","token.actions.githubusercontent.com:sub":"repo:beep-effect/beep-effect:environment:oip-web-infra-prod"}}}]}
JSON
cat > "$d/policy.json" <<'JSON'
{"Version":"2012-10-17","Statement":[
 {"Sid":"StateBucketRead","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:GetBucketVersioning","s3:GetBucketOwnershipControls","s3:GetBucketPublicAccessBlock","s3:GetEncryptionConfiguration"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an"},
 {"Sid":"StateObjects","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/OipWeb/*"},
 {"Sid":"AssetsBuckets","Effect":"Allow","Action":"s3:*","Resource":["arn:aws:s3:::oip-law-web-assets-prod","arn:aws:s3:::oip-law-web-assets-prod/*","arn:aws:s3:::oip-law-web-assets-staging","arn:aws:s3:::oip-law-web-assets-staging/*"]},
 {"Sid":"NeverDeleteAssetsBuckets","Effect":"Deny","Action":"s3:DeleteBucket","Resource":["arn:aws:s3:::oip-law-web-assets-prod","arn:aws:s3:::oip-law-web-assets-staging"]}
]}
JSON
aws iam create-role --role-name beep-alchemy-oip-web-deploy \
  --assume-role-policy-document "file://$d/trust.json" \
  --tags Key=beep:owner,Value=infra-alchemy-rebuild Key=beep:stack,Value=OipWeb
aws iam put-role-policy --role-name beep-alchemy-oip-web-deploy \
  --policy-name oip-web-deploy --policy-document "file://$d/policy.json"
aws iam get-role --role-name beep-alchemy-oip-web-deploy --query Role.Arn --output text
```

**2. Environment, branch policy, variable and secrets:**

```sh
R=beep-effect/beep-effect; E=oip-web-infra-prod
gh api -X PUT "repos/$R/environments/$E" \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST "repos/$R/environments/$E/deployment-branch-policies" -f name=main -f type=branch
gh variable set OIP_WEB_DEPLOY_ROLE_ARN --env "$E" -R "$R" \
  --body arn:aws:iam::832907639880:role/beep-alchemy-oip-web-deploy
op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_VERCEL_TOKEN | gh secret set VERCEL_TOKEN --env "$E" -R "$R"
op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN | gh secret set CLOUDFLARE_API_TOKEN --env "$E" -R "$R"
op read op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID | gh secret set CLOUDFLARE_ACCOUNT_ID --env "$E" -R "$R"
op read op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY | gh secret set CRM_HUBSPOT_SERVICE_KEY --env "$E" -R "$R"
gh variable list --env "$E" -R "$R"; gh secret list --env "$E" -R "$R"
```

One `CRM_HUBSPOT_SERVICE_KEY` secret serves both stages: the packet gate session verified that the token equals the value both Pulumi stacks held. The repository variable `OIP_WEB_INFRA_DEPLOY` is not part of the bootstrap; arming is the separate deploy act in the window-5 decision (`gh variable set OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect --body enabled`, after the token re-check and after telling the orchestrator the time).

**3. Cloudflare grant on the Alchemy token** (`op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`; never the account IaC token). The six records live in zones `oip.law` (id `144f81bdbe12b3a7530cdcc8d56b13cc`: `oip.law` A, `www.oip.law` CNAME, `staging.oip.law` CNAME) and `opip.law` (id `0d26e874202f4579081926dc38b3bf80`: `opip.law` A, `www.opip.law` CNAME, `staging.opip.law` CNAME). The token already reads both zones (`GET /zones/{zone_id}` returned 200) and is refused on their records (403). The first `prod` and `staging` deploys call, per record, `GET /zones/{zone_id}/dns_records?name.exact=<name>&type=<type>` at plan time and again in reconcile, and nothing else: content, TTL, proxy flag and the declared comment (`Managed by Pulumi for oip.law Vercel routing.`, the live text) all match, so the provider skips `PUT /zones/{zone_id}/dns_records/{id}`. `GET /zones/{zone_id}` is called only when a name lookup finds nothing. Needed now: **Zone · DNS · Read** (API permission group `DNS Read`) on both zones. Needed for any later record change (rewording the comment, a content change, a removal): **Zone · DNS · Edit** (API `DNS Write`) on the same zones. **Zone · Zone · Read** (API `Zone Read`) is already granted. Declaring no comment would not be a pure read: the provider then sends its default `Managed by Alchemy (<fqn>)`, which differs from the live comment and triggers the `PUT`.

Checks after the bootstrap: the role ARN prints; the one variable and four secret names list; with the widened token, `GET /zones/{zone_id}/dns_records` returns 200 on both zones.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: gh variable delete OIP_WEB_INFRA_DEPLOY -R beep-effect/beep-effect; gh api -X DELETE repos/beep-effect/beep-effect/environments/oip-web-infra-prod; aws iam delete-role-policy --role-name beep-alchemy-oip-web-deploy --policy-name oip-web-deploy; aws iam delete-role --role-name beep-alchemy-oip-web-deploy; remove the oip.law and opip.law DNS grant from the Alchemy Cloudflare token.

### OipWeb cutover procedure from Pulumi, 2026-11-14

The procedure is the runbook's "Cutover from Pulumi" (`docs/runbooks/alchemy-infra.md`), executed by the packet gate session. Pulumi commands run from `infra/oip-web` as `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/OIP_SECRETS/PULUMI_CONFIG_PASSPHRASE op run -- pulumi <command>` with `AWS_PROFILE=elpresidank-vault` and `PULUMI_BACKEND_URL=s3://oip-law-pulumi-state` (the packet gate session found that this passphrase decrypts both stacks; the `BEEP_SECRETS` item's passphrase belongs to the runners stack). Steps: (1) read-only preconditions: the token at `op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY` returns HTTP 200 and portal 246203876 from HubSpot's account-info endpoint (verified by the packet gate session 2026-11-14), and the Alchemy Cloudflare token lists the records of both zones; (2) `pulumi stack export` of both stacks archived under `~/.local/state/beep/infra-archives/pulumi-exports/` with size and sha256 in a decision file; (3) the bootstrap decision's commands; (4) Pulumi frozen; (5) immediately before arming, the account-info read repeated with the token the environment secret was set from, then the packet gate session tells the orchestrator the time and sets `OIP_WEB_INFRA_DEPLOY=enabled` itself; plans must match the expected-plan decision, smoke checks pass, a second dispatch plans no changes, drift exits 0; (6) `pulumi state delete` for every adopted object, then `pulumi state unprotect` and a targeted destroy of the empty old buckets, then `pulumi stack rm`. Expected visitor effect: none; no project, domain or DNS record changes, and the variables are rewritten with their current values, which reach new deployments only. Each step names its check and rollback in the runbook.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Before step 6: unset OIP_WEB_INFRA_DEPLOY and keep Pulumi as owner. After step 6: pulumi stack import --file <archive> per stack.

### OipWeb deploys from one armed workflow job; vercel-deploy.yml stays unedited, 2026-11-14

`.github/workflows/deploy-oip-web-infra.yml`: push to `main` filtered to the stack, `apps/oip-web/package.json`, `bun.lock`, the Vercel provider source and the workflow itself, plus a bare `workflow_dispatch`; one GitHub-hosted job (`timeout-minutes: 30`), environment `oip-web-infra-prod`, concurrency `alchemy-oip-web-infra` (never cancelled). Per stage, `staging` then `prod`: plan teed to a log, `bun apps/oip-web/stack/plan-guard.ts` (refuses replace, delete or orphan of the project, a variable, a domain, a DNS record or a bucket, and fails closed on a log without a `Plan:` line, on an unreadable resource line and on summary counts that disagree with the listed lines; beep-reviewer round 1 on #3323), deploy, then a curl poll of every hostname against today's responses (200 apex, 308 or 307 redirects). The job runs only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`, so merging deploys nothing; setting it is a deploy act the packet gate session performs after telling the orchestrator the time (window-5 decision). Provider secrets are step-level `env` on the four plan and deploy steps only (beep-reviewer round 1); setup, the plan guard and the smoke checks never see them. It uses a stack-scoped OIDC role (`OIP_WEB_DEPLOY_ROLE_ARN`) because the state role is state-only, the Alchemy Cloudflare token (never the account IaC token), and one `CRM_HUBSPOT_SERVICE_KEY` secret for both stages: the packet gate session verified 2026-11-14 that the token equals the value both Pulumi stacks held. No change to `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job. Because the projects are adopted in place, `vercel-deploy.yml` keeps its project ids and is not edited.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Delete .github/workflows/deploy-oip-web-infra.yml and its ci-runner-security exemption line; unset the OIP_WEB_INFRA_DEPLOY repository variable.

### OipWeb domains and DNS records are adopted per object and protected, 2026-11-14

Ruled by the packet gate session, 2026-11-14: approved as built. Per D20 the six Vercel domains (`oip.law`, `www.oip.law`, `opip.law`, `www.opip.law` on prod; `staging.oip.law`, `staging.opip.law` on staging) and the six Cloudflare records Pulumi owns (ids matching state) are adopted with `adopt(true)`. With the project adopted in place the domains are already on the target project, so `moveFrom` is not needed. Redirect codes are kept (308 on prod, 307 on staging). Records declare their live content, `proxied: false`, automatic TTL and the live comment `Managed by Pulumi for oip.law Vercel routing.`: the Cloudflare provider writes a record only when a declared field differs, and an undeclared comment defaults to `Managed by Alchemy (<fqn>)`, so keeping the live text makes adoption a pure read (DNS Read only). Rewording the comment is a later, separate deploy that needs DNS Edit. Both kinds carry `RemovalPolicy.protect()` on live stages, and the plan guard refuses any replace, delete or orphan of either.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Remove adopt(true) and RemovalPolicy.protect from the Domain and DNS declarations and delete-then-create each record during a maintenance window instead.

### OipWeb is not lane-affecting for CI window 5, on two binding conditions, 2026-11-14

Ruled in advance by the CI window-5 owner, through the orchestrator, relayed by the packet gate session, 2026-11-14: the OIP web PR is not lane-affecting, on two binding conditions.

**Condition 1: `vercel-deploy.yml` and the Vercel pull-request checks stay untouched, including after `OIP_WEB_INFRA_DEPLOY` is switched on.** The file is not edited by this PR or by the cutover. What the stack's adoption can change on the two projects (`oip-web`, `oip-web-staging`): on the project record itself, nothing. `Vercel.Project` declares only `name` and `teamId`, both equal to the live values, and the provider's `projectPatch` sends only declared fields that differ, so the adoption update sends an empty patch. Left undeclared, and therefore never sent: the git link (the project API cannot relink a repository anyway), the framework, the build and install commands, the root directory, the Node version, the system-variable exposure and deployment protection. `git.deploymentEnabled: false` lives in `apps/oip-web/vercel.json`, which no resource reads or writes. The project ids `vercel-deploy.yml` hard-codes (`VERCEL_ORG_ID` and the two `projectId` values in `VERCEL_APPS`) are kept: projects are adopted by name, `projectId` is a stable attribute, and a replace is refused twice, by `RemovalPolicy.protect()` in the engine and by the plan guard (`[Project] replace` fails `PlanRefused`). What adoption does change, under the projects: the three variables are rewritten with their current values (`NEXT_DISABLE_PWA` and `CRM_HUBSPOT_ACCOUNT_ID`, which preview builds read, were verified equal on both projects 2026-11-14 with booleans only; the production-only HubSpot token was verified equal by the packet gate session), and a variable write reaches new deployments only. Domains and DNS records are adopted without a write. After arming, the deploy workflow runs only on push to `main` (path-filtered) and dispatch, never on a pull request; it reads its own environment's secrets, not the repository `VERCEL_TOKEN`; and it shares no concurrency group with `vercel-deploy.yml`. Tests in `apps/oip-web/test/stack/OipWebStack.test.ts`: per live stage, adoption declares only `name` and `teamId`, every live project setting (framework, both commands, root directory, git link, protection, Node version, system variables) is unchanged afterwards, the adopted project id is the census id, and the DNS records are only read; a third test reads `.github/workflows/vercel-deploy.yml` and checks it hard-codes exactly those two project ids and the team id. `test/stack/PlanGuard.test.ts` covers the refusal of a project replace.

**Condition 2: switching the variable on is a deploy act.** The runbook's arming step (`docs/runbooks/alchemy-infra.md`, "Cutover from Pulumi", step 5) says to tell the orchestrator the time beforehand; the packet gate session sets `OIP_WEB_INFRA_DEPLOY=enabled` itself, never a workflow or a lane. The workflow file states the same.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Re-declare any project field in OipWebStack.ts (and drop the pull-request-surface tests) only with a new ruling from the CI window-5 owner; arming stays the packet gate session's act.

### OipWeb plans: the personal stage planned as designed; first prod and staging plans predicted, 2026-11-14

Read-only `alchemy plan --stage dev_elpresidank --env-file /dev/null` from `apps/oip-web` (aws-vault credentials exported, provider tokens through `op run`), 2026-11-14, twice: first with the account IaC Cloudflare token, then, after the project and DNS declarations narrowed, with the Alchemy token the workflow uses. Both exited 0 with `Plan: 4 to create`: `[AssetsBucket]`, `[EnvHubSpotAccountId]`, `[EnvNextDisablePwa]` and `[Project]`, all stage-named (`oip-web-dev-elpresidank`, `oip-law-web-assets-dev-elpresidank`); nothing adopted, moved or modified; no deploy; the state bucket holds no `OipWeb/` object afterwards. The run showed that CI-style plan lines carry a `[HH:MM:SS.mmm] INFO: ` prefix, which the plan guard strips (fixture in `test/stack/PlanGuard.test.ts`). Predicted from the census, not planned against live objects: the first prod plan is `Plan: 1 to create, 12 to adopted` with `[AssetsBucket] create` and `adopted` for `[Dns-oip-law]`, `[Dns-opip-law]`, `[Dns-www-oip-law]`, `[Dns-www-opip-law]`, `[Domain-oip-law]`, `[Domain-opip-law]`, `[Domain-www-oip-law]`, `[Domain-www-opip-law]`, `[EnvHubSpotAccountId]`, `[EnvHubSpotServiceKey]`, `[EnvNextDisablePwa]` and `[Project]`; the first staging plan is `Plan: 1 to create, 8 to adopted` with `[AssetsBucket] create` and `adopted` for `[Dns-staging-oip-law]`, `[Dns-staging-opip-law]`, `[Domain-staging-oip-law]`, `[Domain-staging-opip-law]`, the three variables and `[Project]` (adoption takes the declared props as the old props, so the planner reports `adopted`). `adopted` forces a reconcile: the project sends no field (only name and team are declared, both equal), domains and DNS records find every declared field equal and write nothing, the variables are rewritten with their current values. Stop signs: any `replace`, `delete` or `orphaned` line (the guard and `RemovalPolicy.protect` both refuse it); any `create` other than `[AssetsBucket]` (a live object was not found where the census put it); `OwnedBySomeoneElse`, `EnvVarTypeNotApplied` or a Cloudflare 403; a `ConfigError` on `CI` or `CRM_HUBSPOT_SERVICE_KEY`; a second dispatch that plans anything but no changes.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: n/a (evidence record); a later plan that differs supersedes it with its own decision file.

### OipWeb stages: prod and staging own the live objects, names are pinned, personal stages are fenced off, 2026-11-14

`prod` and `staging` map to the Pulumi stacks `production` and `staging` and refuse to run without `CI=true`. Every physical name (project, bucket, hostnames, zone ids) is pinned in `apps/oip-web/stack/OipWebConfig.ts`; none is derived from a state-held instance id (the #3133 lesson). A personal stage (`dev_$USER`) gets `oip-web-<stage>` and `oip-law-web-assets-<stage>`, the two public variables, no domain, no DNS and no secret, and the `OipWebStackConfig` schema rejects a personal configuration that names a live project, a live or retiring bucket, a domain or the HubSpot secret source.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Collapse liveStageConfig into the Pulumi-style config file per stage and drop the schema fences; no live object depends on the shape.

### RunnerFleet declares each pool's RunnerLaunchTemplate from aws-extras, 2026-11-14

With `@beep/alchemy-aws-extras` on `main` (#3292), `RunnerFleet` declares one `RunnerLaunchTemplate` per pool instead of taking a caller-built template id. The composite sets what it owns: the pool instance profile, the rendered user data, and metadata options that require IMDSv2 with instance metadata tags enabled (the user data reads `ghr:token_path` from them, hop limit 1 as upstream). The caller passes `launchTemplate`, a `Pick` of `RunnerLaunchTemplateProps` (`imageId`, `securityGroupIds`, `associatePublicIpAddress`, `blockDeviceMappings`, `ebsOptimized`, `tags`); instance types and Spot or on-demand capacity stay per launch in scale-up `CreateFleet`. Scale-up launches the template default version as a number, which the provider moves on every update, so a template change also rolls the scale-up runtime config. The earlier typed-input decision for this lane never merged and is replaced by this one.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Restore a caller-supplied launchTemplate(spec) effect returning a template id and version, built from a RunnerLaunchSpec the composite hands out.

### Vercel.EnvVar gains valueFrom so a secret never enters Alchemy state, 2026-11-14

Accepted by the packet gate session, 2026-11-14; the PR body says it changes a merged library and why. Alchemy writes a `Redacted` prop as `{ "__redacted__": <plain text> }` in state (`alchemy/src/State/StateEncoding.ts`), so `EnvVar.value` put any secret in the state bucket in clear JSON, protected only by SSE-KMS at rest. `EnvVarProps` now takes exactly one of `value` (non-secret) and `valueFrom: { config }`; the provider reads the config key inside `diff` and `reconcile` (`Config.Redacted`), sends it only to Vercel, and stores `valueDigest` (SHA-256 hex, `effect/crypto/Digest`) so a rotated value plans an update. Neither or both fails with `EnvVarValueMissing`. Package tests prove the secret is absent from persisted state, that a literal `value` is present (the control), and that rotation is detected. The digest is unsalted: fine for a high-entropy token, guessable for a short value. The OipWeb stack uses `valueFrom` for `CRM_HUBSPOT_SERVICE_KEY`.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Remove valueFrom and valueDigest from @beep/alchemy-vercel EnvVar and pass secrets as value again, accepting plain text in the KMS-encrypted state bucket.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Pulumi stays installed per stack until that stack's cutover | `infra/` | packet owner | destroy needs the CLI and program | the stack's `pulumi destroy` receipt |
| `@beep/infra-hosts` prod deploys from the operator workstation, never CI | one stack | packet owner | dankserver is reachable only over the YubiKey SSH route; S3 state lease is the overlap guard (D21) | a runner with a scoped deploy key to dankserver |
