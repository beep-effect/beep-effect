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
- [ ] `alchemy plan` for every deployed stack shows no create or replace against its live stage after
      cutover (OpenClaw has no live stage, operator ruling 2026-11-22), `alchemy drift` is clean, and the shared S3 state store lists every deployed
      stack including `BeepEffectWeb` (`plan` has no changes-pending exit code; GitHub secrets
      re-upload by design).
- [ ] CI runs on the Alchemy-built runner fleet; `heavy.yml` and `check.yml` enrolled against the
      Worker turbo cache with hit evidence from a `main` run and a PR run.
- [ ] oip.law production and staging serve from the Alchemy-managed Vercel project, env vars and
      domains; DNS and the assets bucket are Alchemy-owned.
- [ ] GitHub rulesets, secrets, variables, environments and labels are reconciled by
      `@beep/infra-github` with `alchemy drift` clean.
- [ ] AI metrics deploys through `@beep/infra-hosts`; the OpenClaw stack is declared and tested there, not installed
      (operator ruling, 2026-11-22).
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

### AI metrics resource graph: SSH Docker context, owned network, looked-up data volume, Phoenix container, Command.Exec host steps, 2026-11-13

The Pulumi program wrote a Compose file and a `systemd --user` unit over SSH and ran preflight, apply and health as remote commands. The `HostsAiMetrics` prod graph: `Docker.Context("Host")` with endpoint `host=ssh://<sshDestination>` and a pinned context name; `Docker.Network` (bridge, `beep-ai-metrics`), owned by the stack; the Phoenix data volume as `Docker.Volume.lookup` (read and mounted, never created, replaced or removed, so no plan can touch the data); `Docker.Container("Phoenix")` with the pinned image from configuration (the schema rejects `latest` and untagged images), `restart: unless-stopped`, `start: true`, `PHOENIX_WORKING_DIR=/data`, port `127.0.0.1:6006:6006` (loopback only, as in the Compose file) and a Docker healthcheck on `/healthz`; then `Command.Exec` steps over non-interactive SSH: Preflight (tools, engine, tailnet, data volume present), RetireCompose, TailscaleServe (the Pulumi apply script's port-switching logic unchanged, HTTPS 8447 to loopback 6006) and Health (Docker health is healthy, loopback answers, Serve fronts it, the public URL answers). Mapping: Compose service and `container_name` become the Container with the same name; the Compose project network becomes the stack's own network; the named Compose volume is the lookup; the systemd unit is retired, Docker's restart policy replaces it; the Tailscale Serve lines become their own step. `Docker.Service` is not used: it needs a swarm manager (D21 note). Ordering edges are Outputs (Exec `hash.input` in a later step's env, a constant container label mapped from RetireCompose), since Alchemy has no `dependsOn`. Each Exec hashes no files (`memo: { include: [], exclude: ["**"] }`), so it re-runs only when its rendered command or env changes. The two `op://` references (hash salt, raw archive key) are configuration fields the stack exports for clients; it never resolves them, and no resolved value is a prop, so none reaches state (tested).

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: alchemy destroy --stage prod, then run the saved rollbackToCompose command to re-enable the archived Compose unit; the Pulumi program (infra/src/AIMetrics.ts) stays on main until P6.

### App JWTs come from distilled GitHub App.appJwt; distilled pins follow main at rc.19, 2026-11-13

The GitHub-facing Lambdas authenticate as the fleet's GitHub App: `GitHubAppAuth` reads the App id and base64 PEM key from SSM once, signs the App JWT with `@distilled.cloud/github/App` `appJwt` (RS256 over WebCrypto, PKCS#1 and PKCS#8 keys), and mints installation tokens through distilled `apps.createInstallationAccessToken`. A first draft signed the JWT itself because `@distilled.cloud/github@1.0.0-rc.18` had no App module; main moved the distilled family to `1.0.0-rc.19` with #3278 (Alchemy beta.86), which ships it, so the hand-rolled signer was deleted. Root catalog pins `@distilled.cloud/aws` and `@distilled.cloud/github` follow the version `bun.lock` resolves on main, `1.0.0-rc.19`. The webhook HMAC-SHA256 check stays on `crypto.subtle` with a constant-time compare: Effect ships no HMAC module.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Pin @distilled.cloud/aws and @distilled.cloud/github back to rc.18 and restore a WebCrypto RS256 signer (rc.18 has no App module).

### aws-extras resource shape: BeepAWS types, schema props, a narrowed export, 2026-11-13

Four calls in `@beep/alchemy-aws-extras`. (1) Resource types use a `BeepAWS.` prefix (`BeepAWS.CostExplorer.CostAllocationTag`, `BeepAWS.ComputeOptimizer.Enrollment`, `BeepAWS.CostOptimizationHub.Enrollment`, `BeepAWS.EC2.RunnerLaunchTemplate`) so a future upstream `AWS.*` resource of the same name cannot collide with ours in one provider registry; the upstream PR renames them and keeps the old names in `ResourceOptions.aliases`. (2) Props and attributes are branded `S.Opaque` schemas with `LiteralKit` literals per the repo schema-first law. Each resource contract is a type alias `Resource<type, Props.Encoded, Attributes.Encoded, never, Providers>`, so callers pass plain objects, and `reconcile` decodes props before any AWS call, failing with `InvalidResourceProps`; an upstream port replaces `LiteralKit` and the `$I` annotations with plain `Schema` literals. (3) The repo `missingPipeableSignature` diagnostic rejects the `(id, Effect<props>)` overload of Alchemy `ResourceClass` on an exported value and diagnostic directives are not allowed, so each resource is built with `Resource(...)` internally and exported through `ExtrasResource`, which keeps only the `(id, props)` form; the runtime value is unchanged. (4) The package exports `providers` as a Layer constant rather than `providers()`, because `lazyEffect` rejects a zero-argument Layer factory.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Rename the types to AWS.* with the old names as Resource aliases, swap the schemas for plain interfaces, and export Alchemy's ResourceClass directly once the repo diagnostics allow it.

### @beep/alchemy-vercel resource shape: Project, EnvVar, Domain over 14 project operations, 2026-11-13

Exactly three resources (`Vercel.Project`, `Vercel.EnvVar`, `Vercel.Domain`) over `createProject/getProject/updateProject/deleteProject`, `createProjectEnv(upsert)/filterProjectEnvs/editProjectEnv/removeProjectEnv` and `addProjectDomain/getProjectDomain/updateProjectDomain/removeProjectDomain/verifyProjectDomain/moveProjectDomain`. Props, attributes and the env request body are `effect/Schema` schemas with the TS types derived from them. Attributes and the request body are branded `S.Opaque` (the provider builds them with `.make`); props (`ProjectProps`, `ProjectGitRepository`, `EnvVarProps`, `DomainProps`) stay annotated structs with schema-first inventory exceptions, because stacks pass them as plain object literals wrapped in `Input<>` and the engine round-trips them through state as JSON. The three resource interfaces are Alchemy handle types and carry the same kind of exception. Project props cover what infra/src/OipWeb.ts (removed in #3341) sets: framework, build and install commands, root directory, git repository, deployment protection (the API's `ssoProtection` values; `none` maps to `null`, Pulumi's `standardProtection` is `prod_deployment_urls_and_all_previews`), node version and `autoExposeSystemEnvs`. `teamId` and `gitRepository` replace the project (the project API cannot relink a repository); a same-name replacement deletes first because names are unique per team. Adopting a project linked to another repository fails with `ProjectRepositoryMismatch` rather than drifting. An existing env var is matched on key, branch and any overlapping target (Vercel's upsert overwrites on overlap), so an overlapping foreign variable needs `adopt(true)`; an omitted `type` compares as `encrypted`. The declared env `type` is a minimum on the order `plain` < `encrypted` < `sensitive`: a stored type that is equal or stronger (for example a team policy that stores Production and Preview values as `sensitive`) is accepted and never replaced; a weaker stored type plans an update, and reconcile replaces it delete-first, because Vercel does not promise an in-place type change; a write that still leaves a weaker type fails with `EnvVarTypeNotApplied` rather than churning. Repository identity is the git provider (GitHub link variants normalized) plus the path. An unverified domain plans an update on every deploy (the engine passes the stored output to `diff`), so reconcile re-runs `verifyProjectDomain` after the DNS change with unchanged props. EnvVar defines its own request-body schema (`EnvVarRequestBody`) because distilled types the body `unknown`; the value prop is `Redacted<string>`, unwrapped only to build that body, and is never an attribute. Storybook does not use the package (2026-11-09 decision).

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

### deploy-infra-github.yml ships disarmed behind INFRA_GITHUB_DEPLOY_ARMED, 2026-11-13

`.github/workflows/deploy-infra-github.yml`: push to `main` filtered to `packages/tooling/infra/github/**` and the workflow file, plus a bare `workflow_dispatch`; one GitHub-hosted job `Deploy infra-github (prod)` on `ubuntu-24.04`, `timeout-minutes: 20`, environment `infra-github-prod`, concurrency group `alchemy-infra-github-prod` without cancellation, the OIDC state role for AWS. Steps: package tests (no token), App token mint, plan, deploy, then a ruleset check that polls for up to 120 seconds until ruleset 10240248 is `active` and lists `beep-reviewer` exactly when the committed switch says `required`. The job is disarmed: it runs only while the repository variable `INFRA_GITHUB_DEPLOY_ARMED` is `true`, so merging this package changes nothing live and creates no environment. Arming is the reviewed live-adoption step: mint the App, create `infra-github-prod` (branch policy `main`) with `INFRA_GITHUB_APP_ID`, `INFRA_GITHUB_APP_PRIVATE_KEY` and `ALCHEMY_STATE_ROLE_ARN`, add `repo:beep-effect/beep-effect:environment:infra-github-prod` to the `beep-alchemy-state-rw` trust policy, then set the variable. No change to `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job; the job is in the explicit exemption list of `ci-runner-security.test.ts`.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Delete .github/workflows/deploy-infra-github.yml and its exemption line in ci-runner-security.test.ts.

### Drop KmsGrant: the GitHub App KMS key delegates to IAM, 2026-11-13

D19 left `KmsGrant` open until the key policy was read. It was read on 2026-11-13 (`aws kms get-key-policy --key-id 79ab38d9-2a9d-426b-b704-beb6fc5c971d`): the GitHub App KMS key has one statement, "Enable IAM User Permissions", granting `kms:*` to the account root principal. The key therefore delegates authorization to IAM. In the native runner composite the stack owns the termination-watcher roles, so an IAM inline policy granting `kms:Decrypt` with a `kms:EncryptionContext:PARAMETER_ARN` condition replaces the six `aws.kms.Grant` resources the Pulumi program carried for the upstream module (`infra/src/CiFleetController.ts`). `@beep/alchemy-aws-extras` ships no `KmsGrant`; the IAM policy belongs to `@beep/alchemy-github-runners`.

Lane goals/infra-alchemy-rebuild-p2-aws-extras

Reverse: Add a KmsGrant resource over distilled kms.createGrant / retireGrant to @beep/alchemy-aws-extras and grant the termination-watcher roles through it.

### github-runners ships as two sequential PRs: Lambdas first, composite second, 2026-11-13

`@beep/alchemy-github-runners` is about 6,500 lines before the composite (schemas, six service contracts, two distilled-backed live layers, seven Lambda programs and their entry points, 42 hermetic tests). The lane ships it as two sequential PRs, one open at a time: PR 1 carries the schemas, service contracts, live layers, Lambda programs and tests; PR 2 adds the runner user data, `RunnerSweep`, the `RunnerFleet` composite and its harness tests, and composes `RunnerLaunchTemplate` from `@beep/alchemy-aws-extras` if that has landed. PR 2 opens after PR 1 merges.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Fold the second PR's resources and composite into one PR if the first has not merged yet.

### Host stack configuration is a schema-decoded JSON file per stack, named by an environment variable, 2026-11-13

No tracked file carries a host address, login, path or port. `AiMetricsHostConfig` (`packages/tooling/infra/infra-hosts/src/AiMetricsConfig.ts`) and `OpenClawStackArgs` (`packages/tooling/infra/infra-hosts/src/OpenClawGeneration.ts`) are the stack configuration schemas; `loadHostConfigFile` (`packages/tooling/infra/infra-hosts/src/HostConfigFile.ts`) reads the file named by `BEEP_AI_METRICS_HOST_CONFIG` or `BEEP_OPENCLAW_HOST_CONFIG` and decodes it, turning a missing variable, an unreadable file, malformed JSON or a rejected value into a `ConfigError` before any resource is read (tested). Machine facts (SSH destination, tailnet name, legacy Compose root, workstation identity, backup target) are required fields; this stack's own conventions (container, network, volume and context names, ports 6006 and 8447, unit name) default to what the Compose deployment uses today. The files hold `op://` references only and live on the operator workstation outside the repo. The SSH agent socket is not a field: Docker's `ssh://` endpoint and the host steps both use the deploy process's `SSH_AUTH_SOCK`, which the runbook sets from the wrapped route.

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: Switch loadHostConfigFile to Config.schema over ConfigProvider.fromEnv with nested keys; the schemas stay the same.

### No Pulumi state exists for AI metrics or OpenClaw; the host stacks adopt what is on the host, 2026-11-13

Checked 2026-11-13 by the launching session: the Pulumi backend `s3://oip-law-pulumi-state` holds no stack for the AI metrics project and none for OpenClaw, so P4's cutover rule (export, then `pulumi destroy`) has nothing to act on for either; the programs describe deployments that exist on the hosts outside Pulumi state (corrected 2026-11-22: true for AI metrics only; no OpenClaw deployment of the program's shape exists, see decision `2026-11-22-openclaw-stays-declared-and-tested-not-installed`). Adoption therefore happens on the host, not in a state store. AI metrics: the data volume is looked up by name, the Compose container and unit are retired by the RetireCompose step, and the Tailscale Serve port state file is reused in place. OpenClaw: generations are content-addressed under the config root, so the first Alchemy apply writes a new generation directory beside any earlier ones and flips the `current` pointer through the same apply script; the snapshot and rollback paths are unchanged. The generation id changes once at this move, because the proof skill's recorded source path changed from `infra/src/OpenClawArtifacts.ts` to the new package. The Pulumi programs leave with `infra/` in P6; no `pulumi stack rm` is owed.

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: None needed: nothing is imported or destroyed in Pulumi. If a stack is later found in the backend, export it outside the repo and record it in a new decision before any pulumi destroy.

### Host stacks: two Alchemy stacks, prod from the workstation only, every other stage a rehearsal, 2026-11-13

`@beep/infra-hosts` holds two stacks, `HostsAiMetrics` (`packages/tooling/infra/infra-hosts/alchemy.run.ts`) and `HostsOpenClaw` (`packages/tooling/infra/infra-hosts/openclaw.alchemy.run.ts`): they target different machines (dankserver over SSH, the operator workstation under sudo), change on different cadences (a Phoenix image bump against an OpenClaw generation), and separate stacks keep separate S3 stage leases, so planning one never reads or locks the other. Stage `prod` is the only stage that mutates a real host. It runs from the operator workstation only (D21): both programs yield `WorkstationOnly` (`packages/tooling/infra/infra-hosts/src/HostsStage.ts`) before declaring a resource, a `Config` that fails with a `ConfigError` when `CI` is true, the inverse of the `Config.Literal("true", "CI")` guard the CI-deployed stacks use. The S3 store's stage lease is the overlap guard; there is no deploy workflow. Every other stage name is a rehearsal and may run anywhere: AI metrics deploys a throwaway Phoenix on stage-suffixed context, network, volume and container names on a separate loopback port, with no Compose retirement and no Tailscale Serve; OpenClaw renders the generation and declares no command. Tests: `packages/tooling/infra/infra-hosts/test/HostsStage.test.ts`, the CI cases in both stack tests.

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: Merge both programs into one stack in alchemy.run.ts, or drop the rehearsal branch so non-prod stages refuse; delete WorkstationOnly once a runner holds a scoped dankserver deploy key (Exception Ledger).

### infra-github deploys with a new beep-infra-github App, proposed and not minted, 2026-11-13

`@alchemy.run/github` authenticates with `GITHUB_TOKEN`; the workflow's own token cannot administer rulesets, environments or variables, and no installed App has those permissions (`beep-ci-fleet-controller` has `administration: write` but is the runner fleet's identity, and widening it couples two blast radii). Proposed, not minted: a new GitHub App `beep-infra-github` registered by `bun run beep github app mint` from a checked-in manifest (D10, same shape as `beep-knowledge-mint.manifest.json`: private, webhook inactive, no events), installed on `beep-effect/beep-effect` only, repository permissions `administration: write`, `environments: write`, `variables: write`, `issues: write` (labels), `metadata: read`, and `secrets: write` only once a secret is managed. Its id is the `infra-github-prod` environment variable `INFRA_GITHUB_APP_ID`; its private key is that environment's secret `INFRA_GITHUB_APP_PRIVATE_KEY` (also kept in 1Password by the mint). The deploy job mints a one-hour installation token with `actions/create-github-app-token` (already pinned in this repository); `GitHub.fromApp` in beta.86 is the in-process alternative. The read-only plan ran with the operator's `gh` token (`repo`, `admin:org`, `workflow` scopes).

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Use another credential with the same permissions in the workflow's token step; nothing is minted yet.

### infra-github manages no secret on day one; secret delivery waits for a ruling, 2026-11-13

`GitHub.Secret` re-uploads its value on every deploy, so a secret is managed only when the deploy can read its value. On day one the stack manages no secret. With a 1Password source: `KNOWLEDGE_MINT_APP_PRIVATE_KEY` (item `beep-knowledge-mint GitHub App`, field `private_key`); `VERCEL_TOKEN` has two candidate fields (`CLOUD_VERCEL_TOKEN`, `CLOUD_VERCEL_API_TOKEN`) and no record of which one it holds. No known source: `APP_ENV`, `APP_LOG_FORMAT`, `APP_LOG_LEVEL`, `APP_NAME`, `NEXT_PUBLIC_ENV`. Produced by another stack and not duplicated: the repository `TURBO_R2_READ_ACCESS_KEY_ID`, `TURBO_R2_READ_SECRET_ACCESS_KEY`, `TURBO_READ_TOKEN`, `TURBO_TEAM` and the `turbo-cache-write` environment's `TURBO_R2_WRITE_ACCESS_KEY_ID`, `TURBO_R2_WRITE_SECRET_ACCESS_KEY`, `TURBO_TOKEN` (turbo cache), and `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` on `beep-effect-web-prod`, `storybook-prod` and `turbo-cache-prod` (each app stack's deploy credentials). A CI deploy cannot read a 1Password value without putting a new long-lived credential into the workflow; the smallest option is a 1Password service-account token, scoped to a vault holding only these items, as an `infra-github-prod` environment secret read by `op run` in the deploy step. That needs an operator ruling and is not built.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Declare GitHub.Secret resources for the secrets with a value source once a delivery route is ruled.

### infra-github owns the repository, main ruleset, deploy environments, two variables and every label; the rest stays unmanaged, 2026-11-13

`@beep/infra-github` (stack `InfraGithub`) owns, from day one: the repository settings `GitHub.Repository` sends and the `main` ruleset (10240248), each adopted per object with `adopt(true)` and `protect()` (D20); the environments `beep-effect-web-prod`, `storybook-prod`, `turbo-cache-prod` and `turbo-cache-write` (branch policy `main`) with `ALCHEMY_STATE_ROLE_ARN` on the three `-prod` ones; the repository variables `KNOWLEDGE_MINT_APP_CLIENT_ID` and `KNOWLEDGE_MINT_APP_SLUG`; and all 26 labels, adopted by name. It leaves unmanaged, each listed with its reason in `productionConfig.unmanaged`: the `queue-lab` ruleset (26917133; `goals/merge-queue-lab` parks it and `merge-group-parity` re-arms it by a live edit, so owning it would revert that); repository settings the provider does not send (squash and merge commit title and message, update-branch, signoff, security and analysis) plus `description` and `visibility`; `professional-desktop-release` (tag deployment policy, which `GitHub.Environment` would recreate as a branch policy); the 22 environments the Vercel App created; `BEEP_SHARD_OVERFLOW` (an operator switch flipped live) and the `TURBO_*` variables (turbo cache cutover); every secret; the two runner-fleet `workflow_job` webhooks (ci-runners, P5); Actions permissions (no resource, verified gap). Every resource is retained on removal (`RemovalPolicy.retain()` over the stack), so a dropped declaration or a destroyed stage deletes nothing on GitHub. A census snapshot (`test/fixtures/census.json`, names and non-secret settings captured 2026-11-13) pins the configuration: a test fails when the two diverge or when a live object is neither owned nor listed.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Drop the resource from declareStack (it is retained, so GitHub keeps the object) and add it to productionConfig.unmanaged with the reason.

### One webhook per fleet routes jobs to every pool's build queue, 2026-11-13

The live fleet runs one terraform module per pool, so the heavy and shard-overflow pools each have a webhook and a webhook secret. The port follows upstream's multi-runner design instead: one webhook Lambda per fleet holds a matcher per pool (labels, match mode, build-queue URL), tries strict matchers (bidirectional or all-of) before any-of ones and sends the job to the first match. Two pools therefore need one App webhook URL and one secret; the overflow pool's separate secret parameter is not carried over.

Lane goals/infra-alchemy-rebuild-p2-github-runners

Reverse: Give each pool its own webhook Lambda and WebhookRuntimeConfig with a single matcher.

### OpenClaw applicator steps become ordered Command.Exec resources; checks report by exit status, 2026-11-13

The Pulumi program ran preflight, stage, apply, probe and an optional backup ship as `command.local.Command` resources with triggers, and exported the drift audit, live acceptance and rollback scripts as outputs plus each step's stdout as a secret output. `HostsOpenClaw` prod declares `Command.Exec` Preflight, Stage, Apply, Probe and (when `backup` is configured) BackupShip, in that order, each `shell: /bin/sh` over the rendered `/bin/bash --noprofile --norc -p -c '<program>'` script, with a 20-minute timeout on the long steps. Triggers map to the command text: every rendered script embeds what its Pulumi triggers listed (the generation id and tree for Stage, Apply, Probe and BackupShip; the declared identity for Preflight), and the memo hashes no files, so a step re-runs exactly when its rendered input changes. `Command.Exec` keeps no stdout and deletes nothing. That is not a gap here: every script fails closed with a non-zero exit (PREFLIGHT-FAIL, probe mismatches, BACKUP-FAIL receipts), which fails the deploy, and the step's stdout still streams to the deploy log. Nothing downstream consumed the stdout outputs. The drift audit, live acceptance and rollback stay operator commands, now stack outputs under `operatorCommands`, and the rollback command is the teardown, since `alchemy destroy` leaves the workstation untouched. `Command.Build` is not used: no step produces a file the stack consumes. The backup passphrase reaches the ship step only through the deploy process environment that `op run` builds, never through props or state (tested).

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: Replace each Exec with a repo-owned resource that captures stdout once a step's output must be kept; record the gap first (D16).

### OpenClaw generation renderers move into @beep/infra-hosts; infra re-exports them until P6, 2026-11-13

The pure generation model and every applicator script (about 2,300 lines from `infra/src/OpenClaw.ts`, plus `infra/src/OpenClawArtifacts.ts`) move to `@beep/infra-hosts/OpenClawGeneration` and `/OpenClawArtifacts`, so the Alchemy stack and the Pulumi program render from one copy. `infra/src/OpenClaw.ts` keeps only the Pulumi config mapping and component and re-exports the moved module; `infra/` gains a workspace dependency on `@beep/infra-hosts` and leaves in P6. Changes on the way: the backup target (`host`, `user`, `remoteDir`) loses its machine-specific defaults and is required wherever a backup is configured (the Pulumi mapping now requires the three config keys); messages that said `pulumi up` say `alchemy deploy`; doc examples decode the nested `OpenClawStackArgs` shape the stack's config file uses and name no real machine. The renderer tests moved with the code (`packages/tooling/infra/infra-hosts/test/OpenClawGeneration.test.ts`); the infra copy stays green until P6 deletes it.

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: Move src/OpenClawGeneration.ts and src/OpenClawArtifacts.ts back into infra/src and drop infra's @beep/infra-hosts dependency.

### Packet gate ruling: a dedicated beep-infra-github App deploys infra-github; the operator mints it, 2026-11-13

Ruling by the packet gate session, 2026-11-13, on the open question about the deploy credential. The proposal in the decision 'infra-github deploys with a new beep-infra-github App, proposed and not minted' is accepted as the design: a dedicated App `beep-infra-github`, installed on `beep-effect/beep-effect` only, repository permissions administration, environments, variables (`actions_variables`) and issues at write and metadata at read, no secrets permission while no secret is managed; its id (`INFRA_GITHUB_APP_ID`) and private key (`INFRA_GITHUB_APP_PRIVATE_KEY`) live on the `infra-github-prod` environment, and the deploy job mints a one-hour installation token. The mint itself is the operator's (`beep github app mint` is a browser handoff). Done in this lane: the manifest is checked in under the repo-configs policy data next to the two existing ones, `GitHubAppName` lists it and the mint command has its profile, so the mint is `bun run beep github app mint beep-infra-github`; the runbook's InfraGithub section carries the exact operator steps (mint, install, id and key, environment and its `ALCHEMY_STATE_ROLE_ARN` variable, the trust-policy subject). The permission key `actions_variables` is GitHub's name for the Variables repository permission; the operator confirms the registration page lists Variables before submitting. Nothing in the lane waits on the mint except arming.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Remove beep-infra-github from GitHubAppName and the mint profile, delete its manifest, and choose another deploy credential in a new decision.

### Packet gate ruling: beep reviewer ruleset edits the stack configuration once the stack is armed, 2026-11-13

Ruling by the packet gate session, 2026-11-13: do the reviewer-switch change in this lane, since arming is blocked without it. Implemented in `@beep/repo-cli` (`commands/Reviewer/ReviewerRulesetOwner.ts`, wired into `updateReviewerRuleset`): after the `kriegcloud` login check, `release` and `require` read the repository variable `INFRA_GITHUB_DEPLOY_ARMED`. Absent or any value but exactly `true` (the deploy job's own condition): the command keeps its direct behavior and edits ruleset 10240248, so nothing changes for the repository today. `true`: the command never reads or writes the live ruleset; it sets `reviewerCheck` in `packages/tooling/infra/github/src/Production.ts` (`--apply` writes, otherwise it previews), refuses a `require` whose App id differs from the configuration's `beepReviewerAppId`, and prints the next steps (commit, a Yeet PR, the merge runs the deploy, and for `release` the admin bypass). An unreadable variable refuses before any ruleset read. Tests in `test/reviewer-ruleset-workflow.test.ts` cover both states, the unreadable variable, the dry run, the App-id refusal and the one-assignment rewrite. `docs/ops/beep-reviewer-app.md` documents the switch; a `release` raised while the reviewer is down merging through the repository-admin bypass is accepted.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Delete the INFRA_GITHUB_DEPLOY_ARMED branch in updateReviewerRuleset (ReviewerRulesetOwner.ts) so the command always edits the live ruleset, and keep the workflow disarmed.

### Packet gate ruling: every secret stays unmanaged and no new long-lived credential enters CI, 2026-11-13

Ruling by the packet gate session, 2026-11-13, on the open question about secret delivery. All repository and environment secrets stay unmanaged on day one. No 1Password service-account token, and no other new long-lived credential, goes into CI for this stack. The README of `@beep/infra-github` keeps the table of secret names with and without a value source; a later decision works from it.

Amended by `2026-11-14-packet-gate-ruling-the-infra-github-app-key-is-the-one-credential-that-enters-ci.md`: the secret-value ruling above stands, and the `beep-infra-github` App's private key, an environment secret on `infra-github-prod` that only the token-mint step reads, is the one credential that enters CI for this stack.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: A later decision names the secrets to manage and the delivery route the gate approves.

### Packet gate ruling: the first infra-github plan is accepted; the first deploy is bracketed by a ruleset capture, 2026-11-13

Ruling by the packet gate session, 2026-11-13, on the plan result. Accepted as it stands: the 36 provider-gap `create` entries are explained and the stack tests prove the first apply sends no create request; the work is not held on an upstream contribution, and the gap is recorded as friction with file evidence in `research/OPPORTUNITIES.md` so it can go upstream later. Added before any arming: because the `main` ruleset is rewritten on every deploy, the runbook's first-deploy procedure captures `gh api repos/beep-effect/beep-effect/rulesets/10240248` before and after the run under `~/.local/state/beep/infra-github/`, diffs them with `updated_at` removed (the diff must be empty), and on any other difference disarms and re-applies the captured JSON with `gh api -X PUT`.

Amendment, 2026-11-14 (packet gate, on review thread discussion_r4572751669): the compare and the restore leave out the `beep-reviewer` required check. The captures are compared with `updated_at` and that entry removed, and the switch position is read separately. On any other difference the restore re-applies the captured JSON with `gh api -X PUT`, except the `beep-reviewer` entry, which is taken from a fresh live read and kept at its live state, so a switch made by `beep reviewer ruleset release|require --apply` between the captures is not reverted. The restore is a runbook `jq` step, not code.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Remove the capture-and-compare step from the runbook's first-deploy procedure.

### Packet gate ruling: VERCEL_TOKEN stays unmanaged with no source identified, 2026-11-13

Ruling by the packet gate session, 2026-11-13: `VERCEL_TOKEN` stays unmanaged, and its source between `CLOUD_VERCEL_TOKEN` and `CLOUD_VERCEL_API_TOKEN` need not be identified now. Arming stays off until the gate says so: it needs the App, the reviewer-switch change merged, and the orchestrator told first, because the stack rewrites the ruleset that gates every merge during a CI measurement window.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: A later decision identifies the token's 1Password field and manages it.

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

### Phoenix cutover: stop and replace the Compose container, keep and look up its data volume, 2026-11-13

The live Phoenix container is Compose-managed, carries no Alchemy ownership labels, and `Docker.Container` recreates any adopted container whose config hash label is missing, so adopting it by name would replace it anyway. The stack therefore stops and replaces it and keeps the data. The RetireCompose step runs `systemctl --user disable --now ai-metrics-phoenix.service`; the unit's `ExecStop` is `docker compose down` without `-v`, which removes the container and the Compose network and keeps the named volume `beep-ai-metrics-dankserver_phoenix_data`. It moves the unit file into `<legacy config root>/retired-compose/`, reloads the user manager, refuses to continue if a Compose-labelled container named `beep-ai-metrics-phoenix` survived, and checks that the volume exists. The new container takes the same name and mounts the same volume at the same path, so Phoenix reads the same data. The volume is a `Docker.Volume.lookup`, not an adopted `Docker.Volume`: an adopted Compose volume carries Compose labels, `Volume`'s diff replaces (delete first) on any label difference, and the data is irreplaceable; a lookup is never deleted, and a missing volume fails the plan instead of mounting an empty one (tested). Downtime is the gap between `compose down` and the healthy container, about a minute. Rollback order matters because both containers share one name: save the `rollbackToCompose` operator command from the stack output, `alchemy destroy --stage prod` (removes the Alchemy container, network and context; the lookup leaves the volume alone), then run the saved command, which restores the archived unit and starts Compose against the same volume. Running it before the destroy would let the destroy delete the restored Compose container. Before the cutover the live session snapshots the volume with Phoenix stopped (runbook).

Lane goals/infra-alchemy-rebuild-p4-hosts

Reverse: Save operatorCommands.rollbackToCompose from the prod stack output, run alchemy destroy --stage prod (removes the Alchemy container, network and context; the looked-up volume stays), then run the saved command: it restores the archived unit and starts it, and docker compose up reattaches the same named volume.

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

The Pulumi Storybook program was never applied: `pulumi stack ls` in infra/storybook (removed in #3341) (backend `s3://oip-law-pulumi-state`) showed `production` with 0 resources, last updated five months ago. `pulumi stack export --stack production` was archived 2026-11-13 outside the repo at `~/.local/state/beep/infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json` (493 bytes, deployment version 3, 0 resources, 0 pending operations, sha256 `fde291a6f1488725c2dd0285b4bd25491578b95deb4d8e9b0823dd33f2448bbf`). `pulumi stack rm production --yes` runs after this decision merges. There is nothing to destroy and nothing to flip. The program sources (infra/storybook (removed in #3341), infra/src/Storybook.ts (removed in #3341)) leave with the rest of `infra/` in P6; the Vercel config file beside the Storybook app is deleted now because no Vercel project reads it.

Lane goals/infra-alchemy-rebuild-p3-storybook

Reverse: From infra/storybook under AWS_PROFILE=elpresidank-vault: pulumi stack init production, then pulumi stack import --file ~/.local/state/beep/infra-archives/pulumi-exports/beep-storybook-production-2026-11-13.json.

### Re-pin @distilled.cloud/vercel at 1.0.0-rc.19 after main moved to core rc.19, 2026-11-13

Supersedes the rc.18 pin decision. #3278 (93fe11eb05) moved main to `alchemy`/`@alchemy.run/*` 2.0.0-beta.86 and `@distilled.cloud/core@1.0.0-rc.19`. Keeping vercel at rc.18 would bring core rc.18 back as a second version, so the catalog entry moves to `@distilled.cloud/vercel@1.0.0-rc.19`, whose only dependency is core rc.19. `bun.lock` was regenerated from main's copy with `bun install`; it resolves a single core (rc.19). Against the installed rc.19 and beta.86, the package type checks and its 17 tests pass. The one adaptation is in the test harness: beta.86 types provider lifecycle errors as `ProviderError`.

Lane goals/infra-alchemy-rebuild-p2-vercel · PR #3290

Reverse: Return the catalog entry to the vercel release that matches whatever @distilled.cloud/core main resolves, in the same PR as that core bump.

### Runner Lambdas port terraform-aws-github-runner v7.10.1 without the features the live fleet leaves off, 2026-11-13

The handlers port `lambdas/functions/{webhook,control-plane,termination-watcher,gh-agent-syncer}` at v7.10.1, the version `infra/ci-runners/Pulumi.yaml` pins, as Effect programs over six service contracts (`GitHubAppAuth`, `GitHubRunners`, `Ec2Fleet`, `SsmStore`, `MessageQueue`, `RunnerBinaries`). Wire shapes stay upstream's: the SQS `ActionRequestMessage`, the `ghr:*` EC2 tags and the SSM token layout. Left out because the live fleet does not use them: dynamic `ghr-*` labels, dedicated hosts (`RunInstances`), the warm pool (`adjustPool`), the EventBridge webhook mode and queue-selection strategies other than first match, the AMI housekeeper, GitHub Enterprise base URLs in registration-token mode, and Powertools metrics and X-Ray. `jobQueuedCheck` defaults to false (the live value; upstream's default is true). Partial-launch, cap and retry semantics match upstream, including the on-demand failover for configured `CreateFleet` error codes. Two deliberate departures (amended 2026-11-18, #3386, 7aad2de4a2a). `defaultScaleErrors` adds `VcpuLimitExceeded` to upstream's `scale_errors`. A request-level `CreateFleet` failure whose code is in `scaleErrors` is retryable like the same code per instance, so the group's messages return to the build queue as batch item failures instead of going to the job-retry queue. Scale-up's cap count also departs: it reads unconsumed JIT config parameters before EC2 (cutover decision, "Overlap caps against EC2's read lag").

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

### The beep-reviewer switch is the committed reviewerCheck flag of infra-github, 2026-11-13

D20's switch is `StackConfig.mainRuleset.reviewerCheck` (`ReviewerCheck` LiteralKit: `required` | `advisory`). `requiredChecks` appends `{ context: "beep-reviewer", integrationId: 5321138 }` for `required` and leaves the configured checks alone for `advisory`; the stack tests flip it both ways and prove every other check and both bypass actors survive. The committed value is `advisory`, the live position (the census ruleset lists no `beep-reviewer`). The flag is committed configuration, not a dispatch input: a workflow input would be reverted by the next push deploy, and the standing deploy-workflow shape allows only a bare `workflow_dispatch`. CLI change, designed and not in this head (not needed for the plan): once the stack is armed, `beep reviewer ruleset release|require` stops PUTting ruleset 10240248 and instead rewrites `reviewerCheck` in `packages/tooling/infra/github/src/Production.ts` and opens the PR through Yeet; `--apply` on the old path refuses while `INFRA_GITHUB_DEPLOY_ARMED` is `true`. A `release` PR raised because the reviewer is down cannot itself pass a required `beep-reviewer` check, so it merges through the repository-admin bypass the ruleset keeps.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Remove the reviewer check from the stack's ruleset ownership (omit requiredStatusChecks handling for beep-reviewer) and keep the CLI's direct ruleset edit.

### The first infra-github plan adopts the main ruleset and converges everything else by name, 2026-11-13

Read-only `alchemy plan --stage preview_elpresidank` on 2026-11-13 against the shared S3 store (empty stage) and the live repository, configuration identical to `prod` (the stack derives no name from the stage; a non-`prod` stage needs `INFRA_GITHUB_LIVE_PREVIEW=plan-only`), `GITHUB_TOKEN` from `gh auth token` in that process only, AWS from the aws-vault export. Nothing was deployed; no live setting changed. Output (no secret material in it): `Plan: 36 to create, 1 to adopted`; `[MainRuleset] adopted`; `create` for `Repository`, 4 `Environment-*`, 3 `EnvironmentVariable-*-ALCHEMY_STATE_ROLE_ARN`, 2 `Variable-KNOWLEDGE_MINT_APP_*` and 26 `Label-*`; no replace, no delete. Why `create` is not a create: `GitHub.Repository`, `Environment`, `Variable` and `Label` have no `read` adoption probe in beta.86 (upstream main is the same), so an empty stage plans them as `create`; each reconcile observes the live object by name first and only updates (Repository GETs then PATCHes, Environment PUTs, Variable GETs and writes only on a value difference, Label GETs then PATCHes). The stack tests replay the first deploy against the census and assert zero POST and zero DELETE requests. Field by field, what the first apply would send: Repository PATCH with `name`, `homepage`, `has_issues`, `has_projects`, `has_wiki`, `has_discussions`, `is_template`, `allow_squash_merge`, `allow_merge_commit`, `allow_rebase_merge`, `allow_auto_merge`, `delete_branch_on_merge`, each equal to the census, and a topics PUT with the same 14 topics; the default branch is not sent because it already is `main`. Ruleset `main` (the forced post-adoption update) PUT with the same name, target, enforcement, conditions, bypass actors (admin role 5, App 5309624, `always`), the four rules and the 15 checks bound to App 15368; GitHub stores three fields the provider does not send (`required_reviewers: []` and `dismissal_restriction.enabled: false` in the pull request rule, `do_not_enforce_on_create: false` in the checks rule), each already at the default it falls back to, so the PUT rewrites them to their current values; this PUT recurs on every deploy because the provider compares the stored rules, extra keys included. Environments PUT with `deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }` (live) and no wait timer or reviewers (none live); the custom policy `main` already exists, so no policy is created or deleted. Variables: value equal, no write. Labels: PATCH with the same color and description. Acceptance against the target: the one object with an adoption probe shows `adopted`, nothing shows replace, and every update is explained above; the `create` labels are a provider gap, closed upstream by giving those four providers a name-based `read`, after which the same plan shows `adopted` throughout.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: n/a (read-only evidence); delete the plan stage's empty state with alchemy state if one was written.

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

### A tested pre-write guard holds every infra-github deploy to a no-op on ruleset 10240248, 2026-11-14

Window-5 requirements 1 and 3 (window-5 owner via the packet gate, 2026-11-14). `src/RulesetGuard.ts` states the guarded fields of the body the stack writes for ruleset 10240248 (required checks with context names and integration ids in order, the strict up-to-date policy, bypass actors, allowed merge methods, ref include and exclude) and compares them with a capture of the live ruleset. It also compares the rest of what the PUT writes (name, target, enforcement, rule types in order, the other pull request settings), and it fails closed (PR #3323 review findings carried here): the capture is decoded strictly with excess keys refused at every level, so an unknown key, rule type or condition, a missing field, or a provider-unsent setting away from its default (required reviewers, an enabled dismissal restriction, `do_not_enforce_on_create`) refuses the deploy in both modes; server-managed fields (ids, node ids, timestamps, links, `current_user_can_bypass`) are never read. `ruleset-guard.ts <capture>` exits non-zero on any difference and prints each differing field with planned and live values; `--diff-only` prints the same diff and exits zero. The deploy workflow runs it between plan and deploy against the same capture the stack reads (nothing is written on a difference) and again after the deploy on a fresh capture, polled for 120 seconds. Tests cover the equal case, server fields ignored, the reviewer check carried in both positions, and each guarded field differing. Pre-arming evidence: the runbook's InfraGithub section gives the read-only command, which needs no App and no arming. Run 2026-11-14 against live: empty diff, so no declared value had to move; any intended change to a guarded field waits for the window-5 verdict (2026-11-20T20:10Z), and declared values follow live. Unarmed (`INFRA_GITHUB_DEPLOY_ARMED` not `true`), the job is skipped before any step: nothing is planned against the live rulesets and the App need not exist.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Delete the Check the ruleset before deploy and after deploy steps from deploy-infra-github.yml and remove ruleset-guard.ts and src/RulesetGuard.ts.

### The AWS account and region guard lives in @beep/alchemy-aws-extras; the stack provides DockerLive, 2026-11-14

`@beep/alchemy-aws-extras` gains `DeployTarget` (`AwsAccountId`, the `DeployTarget` model and `requireDeployTarget`), and `@beep/infra-ci-runners` uses it instead of a copy of the cost-controls account schema and guard. Fallow's new-code duplication gate flagged the copy; the shared module is the single home a third AWS stack will need too. The guard compares the resolved `AWSEnvironment` account and region with the target and fails with a `ConfigError` naming the stack and target, never the credentials. `@beep/infra-cost-controls` keeps its own guard for now: changing it would run that stack's push-to-main deploy during the window-5 measurement; adopting the shared module there is a small later PR.

Also: `Lambda.FunctionProvider` needs a `Docker` service (it supports container-image functions), so the stack's provider layer provides `DockerLive` from `@alchemy.run/docker`, added to the root catalog at the same `2.0.0-beta.87` as the other `@alchemy.run/*` pins (D13). The layer is lazy: nothing runs `docker` unless a function is built from an image, and none is.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Inline requireDeployTarget back into packages/tooling/infra/ci-runners/src/Guards.ts and delete DeployTarget.ts from aws-extras.

### CI runners cutover from the Pulumi fleet: deploy beside, prove, move workflows, a day green, then destroy, 2026-11-14

Executable procedure for replacing the Pulumi fleet (`beep-ci-runners/production`) with the `CiRunners` stack, amended 2026-11-14 with the packet gate's rulings. Nothing here runs before the gate releases P5 on the window-5 verdict (2026-11-20T20:10Z; on a denial, window 6). Owners: **gate** = the packet gate session; **operator** = the human, only where an org or App setting or a workflow merge needs them; **lane** = the session the gate names; **orchestrator** = the coordinating session. Every AWS check is a single read, never a loop over instances.

**Preconditions (before any deploy).**

- Freeze: `beep-ci-runners/production` is frozen; no `pulumi preview` or `pulumi up` of it until the cost-controls component-removal PR has merged (cost-controls cutover decision). Nothing in steps 0 to 5 runs Pulumi.
- Spot arithmetic, which the orchestrator confirms against its live heavy burst cap before the first deploy: the account's Spot quota is 512 vCPU; the new fleet's `overlap` caps commit 32 vCPU (heavy 1 × 16 + overflow 2 × 8) and the schema reserves 480 for the live fleet at the agreed burst cap (heavy 6 × 16 + overflow 48 × 8), 512 in all (amended 2026-11-18 from a 416 reserve at the live default caps, which under-counted the burst). The schema's budget check refuses any `overlap` cap that would pass 512, and a personal stage reserves the live fleet plus the production overlap (480 + 32 = 512), so no rehearsal launches while the overlap lasts. The live burst cap of 8 alone fills the quota with the live overflow pool at 48, so a burst to 8 with new-fleet runners up makes `CreateFleet` fail with `MaxSpotInstanceCountExceeded` on whichever fleet asks last. If the orchestrator's burst cap is above 6, lower it (or the live overflow cap) first, or deploy with the new caps at 0 until the move.
- Step-1 precondition, binding (packet gate ruling 2026-11-18): live heavy bursts stay at 6 VMs or fewer for as long as both fleets exist (512 of 512 Spot vCPU committed). The gate relays it to the orchestrator, and the orchestrator and CI goals driver set `BEEP_HEAVY_BURST_MAX` in the burst tooling's template outside the repo; no lane edits that template. No `pulumi up` of `beep-ci-runners/production` while any heavy burst is active (`systemctl --user list-timers | rg ci-burst`), and nothing applies before the freeze-end preview of that stack is clean.

**Agreed with the CI goals driver (2026-11-18): burst cap, start sequence, window 6, reporting.**

- (a) Burst cap: before step 1 the packet gate tells the orchestrator, and the driver lowers `BEEP_HEAVY_BURST_MAX` to 6. It stays at 6 until drain and destroy (step 6) complete, and the gate reports that completion to the orchestrator as well. The control is the orchestrator-owned burst template outside the repo, `~/.cache/beep/ci-burst/TEMPLATE/set-cap.sh`, whose `BEEP_HEAVY_BURST_MAX` defaults to 6 and refuses a higher cap. The driver raises it back to 8 only after step 6d (drain and destroy) is reported, never at step 4 or 5 while the live fleet still exists; no lane edits that template (amended 2026-11-18, #3386 review).
- (b) Start sequence, strictly in order: the active cap-8 burst ends (its guard fires at or after 2026-11-18T05:19:25Z), then the freeze-end preview of `beep-ci-runners/production` comes back clean, then the first P5 deploy (step 1) runs.
- (c) Window 6 of the CI measurement starts when drain and destroy complete. The gate reports the time of each cutover milestone to the orchestrator as it happens: deploy beside (step 1), webhook overlap (step 2), per-pool proof (step 3), traffic move (step 4), green day (step 5), App webhook switch (step 6b), drain (step 6a), destroy (step 6d).

**Binding driver conditions (CI goals driver, 2026-11-18).**

- (d) The deploy applies exactly the checked change set. `deploy-ci-runners.yml` runs `plan-check.ts plan`, which plans `prod`, runs the plan check and saves the checked plan (each resource's action, binding actions, a SHA-256 digest of its redacted declared properties, a SHA-256 digest of each binding's payload, an HMAC-SHA256 fingerprint of its declared secret values keyed by a random per-plan salt saved with the plan (never the values), and whether an update would finish a pending replacement; plus every stack action and the cutover expectation). The deploy step runs `plan-check.ts deploy`, which plans again under the stage lease, runs the plan check again, compares that plan with the saved one and applies that same plan object only when they are equal (`applyIfUnchanged` in `src/CheckedDeploy.ts`). Any added, removed or changed resource, binding, digest, action or stage fails with `PlanDrift` before any write; `alchemy deploy` is never called. Proof: `test/CheckedDeploy.test.ts` moves the state between the check and the deploy and simulates each kind of drift; every case refuses and the apply stand-in never runs.
- (e) A real launch per pool before the traffic move. Step 3 passes only when every new pool, heavy and overflow, has launched a runner that picked up and completed a real job. That launch is the proof that the rendered user data fits under EC2's 16 KiB limit and boots; a passing plan is not. The static size test stays as well (`test/RunnerBootstrap.test.ts`: the rendered user data with the packed post-install is under 16,384 bytes, and the inline post-install is over it).

**Step 0, bootstrap (gate).** Create the deploy role, `ci-runners-prod` environment, variable and three secrets (deploy-role decision). Check: the `aws iam simulate-principal-policy` results listed there.

**Routine arm (amended 2026-11-18, #3386 r4617469519).** `CI_RUNNERS_DEPLOY_ARMED` admits only the two cutover dispatches. A `routine` run, every push included, also needs `CI_RUNNERS_ROUTINE_ARMED = true`. The gate sets that only after step 1b succeeds, so no push can update the reaper or reconcile the default group between 1a and 1b. Rollback: unset `CI_RUNNERS_ROUTINE_ARMED`.

**Overlap caps against EC2's read lag (amended 2026-11-18, #3386 r4617469584, r4620847603).** The overlap budget is an exact fit (512 vCPU), and scale-up's cap count must not lag a fresh launch. Scale-up counts a pool's runners in two reads, Parameter Store first and then EC2. The first read takes the unconsumed JIT config parameters from the last 15 minutes: a runner's config exists from its configuration until the runner reads and deletes it at boot. The second read takes the runners the tag-filtered `DescribeInstances` shows. A runner in both reads counts once, by instance id. If either read fails, the group launches nothing and every message returns to SQS as a batch item failure. Residual (corrected 2026-11-18, #3386 r4620945601 and r4620950042). Accepted (a′), driver re-ruling 2026-11-18; (b) and (c) rejected.

- Overcounts only mean fewer launches. Undercounts can happen in two ways: an EC2 read lag longer than a boot, or a token older than 15 minutes.
- Bound (wording corrected 2026-11-18, #3386 r4621054872): one invocation requests at most `cap − counted` runners, which is at most the cap. So each invocation launches at most min(runners missed by both reads, cap) runners beyond the true cap. The bound is on additional launches, not on missed runners: once overshoots accumulate, the runners missed can exceed the cap (with cap 2, four can be missed). The total overshoot accumulates across invocations while EC2's tag-filtered read lag outlasts runner boot. The hard ceiling is the 512 vCPU account Spot quota, shared with the live fleet. Past it, CreateFleet fails retryably and the message redelivers.
- Why accepted: the precondition (EC2's read lag outlasting a boot) is improbable. The harm is delay plus quota-capped spend: every extra runner serves a real queued job and is ephemeral, and the overlap ends at the drain.
- Rejected: (b), a cap margin of 1, does not bound a k-miss overshoot. (c), new alarm resources, would add IAM, simulations and another review cycle for a harm that is time-bounded and only causes delay.
- Tripwire, replacing the after-the-fact check:
  1. Report each pool's peak concurrent runners against its cap, from EC2 `DescribeInstances` plus CloudTrail `CreateFleet`/`RunInstances`, never from the Lambda's own count.
  2. Take that reading at each mapping check (after 1a, after 1b, before the drain) and again in the window-6 census.
  3. A pool that shows an observed overshoot of k has its cap cut by k, not a fixed 1, for the rest of the overlap. The driver re-rules the same day.

**Live-fleet mapping guard (amended 2026-11-18, `DenyLiveFleetMappings`).** The deploy role is denied every tag, untag, update and delete on the live fleet's six event-source mappings, by ARN. The rules while it holds:

- No `pulumi up` on the live fleet stack during the overlap, and never during a burst: a Pulumi replace would mint new mapping UUIDs outside the deny.
- Re-run the read-only `aws lambda list-event-source-mappings` immediately before step 1b and again before the drain, as part of the mapping check below. If any live UUID differs from the six in `DeployRolePolicy.ts`, HOLD and push the new ARNs first.
- The deny is removed in the P5 drain-and-destroy PR, together with the live fleet.

**Mapping check after 1a, after 1b and before the drain, each before any traffic move (amended 2026-11-18, #3386 r4614022089).** Read-only; every STOP holds the cutover at that step.

- (a) Run `aws lambda list-event-source-mappings` (us-east-1) and select by target, not by name or tag: count every mapping whose `FunctionArn` is a `function:beep-fleet-prod-*` function. For each, `aws lambda list-tags --resource <mapping arn>` must show `alchemy::stack=CiRunners` and `alchemy::stage=prod`; that proves tag on create worked and catches a mapping a foreign principal attached to a fleet function. STOP if any such mapping lacks either tag or carries a foreign `alchemy::` tag.
- (b) In the same run, the six live mapping UUIDs must equal the six in `DeployRolePolicy.ts`. STOP if any changed, and push the new ARNs first.
- (c) Report each run's fleet-target count, the UUIDs and the STOP/pass verdict to the orchestrator, and record them in the cutover record.
- (d) In the same run, take each pool's peak concurrent runners against its cap, from EC2 `DescribeInstances` plus CloudTrail `CreateFleet`/`RunInstances`, never from the Lambda's own count. Record it with (c). An observed overshoot of k cuts that pool's cap by k for the rest of the overlap (residual tripwire above).

There is no mutating direct-tag test against live resources. The simulations prove the policy, and check (a) proves the stack's real tagging.

**Step 1, deploy beside the live fleet (lane, through the workflow), in two dispatches (amended 2026-11-18).** 1a: with the deploy role on policy v1, a `workflow_dispatch` with `mode: bootstrap` deploys everything except `DefaultSecurityGroup` (`--exclude DefaultSecurityGroup` on both the plan and the deploy step; the filtered deploy prints no stack output, so the webhook check waits for 1b). The gate then reads the new VPC id with one `describe-vpcs`, writes policy v2 scoped to that VPC, re-runs the deploy-role simulations and updates the role. 1b: a dispatch with `mode: default-security-group` plans the full stack, which adds only `DefaultSecurityGroup`, and deploys it. Nothing merges to the workflow's paths between 1a and 1b; if a push runs there anyway, its `DefaultSecurityGroup` revoke is denied and the run fails before any other write, with no effect on the rest. Both dispatches deploy `prod` in `overlap` (heavy cap 1, overflow cap 2, new labels, every composite name pinned under `beep-fleet-prod-`; physical-names decision) through the shipped `deploy-ci-runners.yml`, which lands disarmed with the P5 PR and is armed by the gate only for these dispatches. Expected plans, as `plan-check.ts plan` lists them (amended 2026-11-18, #3386 review):

- 1a (`mode: bootstrap`): only creates (amended 2026-11-18, #3386 r4617469528: a re-run after a partial bootstrap also takes, as `noop` with only `noop` bindings, the resources the failed run created; an update, replace, delete or adoption still stops it, so repeating the dispatch finishes the bootstrap and nothing else). `plan-check.ts` enforces this expectation on both steps and refuses anything else as `UnexpectedChange`. It contains every stack resource except `DefaultSecurityGroup`: the personal plan's 66 creates minus `DefaultSecurityGroup`, plus what `prod` adds (the job-retry queues, their dead-letter queues and the job-retry functions with their event-source mappings), each with its binding creates. There are no updates, no stack actions and nothing outside the stack. The deploy applies exactly that checked plan (condition d). Because the plan is filtered, it prints no stack output, so the webhook check is skipped.
- 1b (`mode: default-security-group`): exactly one `DefaultSecurityGroup` row with no bindings, planned `adopted` (amended 2026-11-18, #3386 r4617469574: beta.87 reads the AWS-made default group before it has a state row and adopts it; `create` is accepted too). Only 1b may adopt: a `routine` plan refuses any `adopted` row. The adopted row is still in the checked plan and drift-compared. Every other resource is `noop` with no binding change. `plan-check.ts` accepts it (one create plus noops), the deploy applies exactly that checked plan, and the webhook then answers 401 to the unsigned request.

Anything else in either plan stops the step before any write: the two modes refuse an update, any binding change in 1b, a second create in 1b or a `DefaultSecurityGroup` in 1a as `UnexpectedChange` on both the plan and the deploy step. A different plan means the state moved or the program changed. Ask the CI goals driver through the orchestrator. Checks: one `aws lambda get-function --function-name beep-fleet-prod-webhook` succeeds; one `aws lambda get-function --function-name beep-ci-scale-up` shows the live function's unchanged `LastModified`. Rollback (amended 2026-11-18, #3386 r4617469539): the workflow has no destroy mode, and the deploy role has no key-deletion or key-policy grant, so the destroy is a gate step on the operator workstation with the account's admin credentials through aws-vault, never the deploy role. Disarm first (`CI_RUNNERS_DEPLOY_ARMED` unset) so no run overlaps it. Then, from `packages/tooling/infra/ci-runners` at the commit that deployed, run `AWS_PROFILE=elpresidank-vault CI=true bunx alchemy destroy --stage prod` (App credentials from the `ci-runners-prod` environment's 1Password items, `op run`); the `RunnerSweep` finds no runners and the stack goes in dependency order. Check: no `beep-fleet-prod-*` Lambda, queue or role remains, the fleet VPC is gone, and the live fleet's `beep-ci-scale-up` `LastModified` is unchanged. The KMS key enters its 30-day pending deletion. Nothing live depends on the stack yet.

**Step 2, overlap delivery path (operator, outside IaC).** Add a repository webhook on `beep-effect/beep-effect`: events `workflow_job` only, content type JSON, URL = the stack's webhook function URL, secret = the fleet's webhook secret. The live App's webhook stays untouched and keeps delivering to the live heavy controller (the live overflow pool keeps its own repository webhook), so both fleets hear every job and each acts only on its own labels: the live controllers on `beep-ec2-heavy` / `beep-shard-overflow`, the new webhook on `beep-fleet-heavy` / `beep-fleet-overflow`. Secret: the new function verifies one secret, `/beep-fleet/prod/app/github_app_webhook_secret`, and at the end state the App's webhook must sign with that same value; so `CI_RUNNERS_GITHUB_WEBHOOK_SECRET` is the live App's webhook secret value (its 1Password item, `op://<vault>/<item>/<webhook secret field>`, located by the operator at bootstrap), and the repository webhook is configured with it too. No second secret is needed, nothing in the stack changes, and step 6's URL move needs no secret rotation. (A distinct overlap secret would work for the repository webhook but force an App secret rotation at step 6, briefly breaking signature checks on the live fleet if it still existed.) Checks: the repository webhook's recent deliveries show a 2xx from the new URL for the next `workflow_job` event, and the webhook function's log shows it dropped for labels; one `aws sqs get-queue-attributes --queue-url <beep-fleet-prod-heavy-build URL> --attribute-names ApproximateNumberOfMessages` shows 0. Rollback: delete the repository webhook.

**Step 3, prove one job per pool (lane, one PR, operator merge since it touches `.github/`).** Run one heavy job and one shard-overflow job on the new labels: a `workflow_dispatch` job copied from `heavy.yml` with `runs-on: beep-fleet-heavy`, and one from `shard-overflow.yml` with `runs-on: beep-fleet-overflow`, in workflows on the groups' allowed-workflow lists (the operator adds them; both groups are `restricted_to_workflows`). Also repoint `fleet-shadow-check.yml` to the new labels (`runs-on: beep-fleet-heavy`, SSM reads under `/beep-fleet/prod/app/`) as extra per-pool proof during the overlap (ruling 2026-11-18). Pass condition (condition e, binding): each of the two pools launches a runner that picks up and completes its job, conclusion `success`; a pool that never launches, or a runner that never registers (user data over 16 KiB, or a boot failure), fails step 3 and blocks step 4. Checks: each job is picked up within the live pickup p50 + 2 minutes; runner names start `beep-fleet-heavy-` / `beep-fleet-ovf-`; afterwards the instance is gone (one `describe-instances` by instance id) and the runner is deregistered (`gh api orgs/beep-effect/actions/runners` lists no new-fleet runner); the reaper and termination-watcher logs show their passes. Rollback: delete the copied workflow.

**Step 4, move the workflows (lane PRs, operator merge).** Order (amended 2026-11-18): first the workflow PR applies the reader inventory below (option A), while `prod` stays in `overlap`; from its merge no workflow targets the live labels, and jobs queue on the new pools' overlap caps (heavy 1, overflow 2) until the phase PR lands. Then a stack PR sets `phase: "primary"`; its plan must be updates only (pool caps in the runtime configs). Spot: `primary` lets the new pools use the whole quota, which is safe only with the live fleet idle, so the phase never moves while a workflow still targets the live labels. Before the phase PR merges (amended 2026-11-18, #3386 review), all three hold: (i) old-label jobs have drained: no run created before the workflow PR merged is unfinished. For each nonterminal status (`queued`, `in_progress`, `waiting`, `pending`, `requested`), `gh api --paginate "repos/beep-effect/beep-effect/actions/runs?status=<status>&created=<=<merge time>&per_page=100" --jq '.total_count'` returns 0; that is one paged read per status, and `total_count` covers the whole result, so no page limit hides a run. Also, `gh api orgs/beep-effect/actions/runners` lists no busy `beep-ci-` or `beep-ovf-` runner; (ii) no heavy burst is active: `systemctl --user list-timers | rg ci-burst` shows no burst timer; (iii) the live fleet is empty: step 6a's single `describe-instances` returns no `pending` or `running` live runner. Empty instances alone do not count, since a queued old-label job or a burst can launch one a minute later. Check: the next pushes run every heavy and overflow job on the new fleet and the live scale-up Lambdas log no launches.

Rollback, in reverse order and drained at each step (amended 2026-11-18, #3386 review). Each scale-up function reads its pool caps from its environment when its handler is created (`RunnerRuntime`), so an invocation already running under the `primary` caps can launch a runner after the phase revert has deployed. Scale-up is therefore paused, and the pause drained, before anything is counted. The pause disables each scale-up function's SQS event-source mapping (`ScaleUpSource`), so build-queue messages stay in the queue untouched. Reserved concurrency 0 would not hold them: the mapping keeps polling and throttled batches come back after the visibility timeout (amended 2026-11-22: the build queue has a 1-minute timeout, no redrive and a one-day retention, so a message waits out a pause that can last 90 minutes, up to the day; before that change 5 receives, about 10 minutes, sent it to the build DLQ). The stack declares the mapping without an `enabled` value, so the pause still comes after the phase revert's deploy, and nothing deploys `prod` while it holds. The gate runs these steps from the operator workstation (`AWS_PROFILE=elpresidank-vault`, one call each). The function names are pinned: `beep-fleet-prod-heavy-scale-up` and `beep-fleet-prod-overflow-scale-up`.

1. Revert the phase PR and wait for its deploy to complete, so the scale-up configuration carries the overlap caps again. Rollback of this step: revert the revert, which needs the drain conditions above again.
2. Pause new-fleet scale-up. `aws lambda list-event-source-mappings --function-name beep-fleet-prod-heavy-scale-up --query 'EventSourceMappings[].UUID'` gives the mapping UUID; then `aws lambda update-event-source-mapping --uuid <uuid> --no-enabled`. Do the same for `beep-fleet-prod-overflow-scale-up`. Check: `aws lambda get-event-source-mapping --uuid <uuid>` reports `Disabled` for both; record the two UUIDs for step 6. No push to the workflow's paths merges while the pause holds; if a deploy runs anyway, read the mappings again and repeat this step and step 3. Rollback of this step: step 6's command.
3. Drain: wait at least the scale-up timeout (60 s) after both mappings report `Disabled`, so that no invocation, warm or not, is still running. Then wait until one `describe-instances` on `ghr:environment` `beep-fleet-prod-heavy` / `beep-fleet-prod-overflow` returns no `pending` instance, so every launch has settled. Rollback of this step: none needed (it only reads).
4. Check the caps: the same single read returns at most 1 heavy and 2 overflow `running` instances. If there are more, keep scale-up paused and wait for their jobs to finish (the reaper's 90-minute TTL bounds every runner), then read again. Rollback of this step: none needed (it only reads).
5. Only then revert the workflow PR, which sends jobs back to the live fleet (burst cap still 6). Rollback of this step: revert the revert.
6. Re-enable scale-up, now that the overlap configuration is live (step 1) and step 4 has passed: `aws lambda update-event-source-mapping --uuid <uuid> --enabled` for each of the two UUIDs from step 2. Check: `get-event-source-mapping` reports `Enabled` for both, and the build queues drain. Safety check: `aws sqs get-queue-attributes --queue-url <beep-fleet-prod-{heavy,overflow}-build-dlq URL> --attribute-names ApproximateNumberOfMessages` shows 0 on each build DLQ. If it is not 0, stop (amended 2026-11-22): waiting no longer sends a message there, so it is a dead letter scale-up sent after a failed runner configuration, and its log line names the cause. Move it back only once that cause is fixed and scale-up is enabled. `start-message-move-task` cannot do it: the build DLQ is no queue's redrive target any more. Move a batch at a time by hand: `aws sqs receive-message` from the DLQ, `aws sqs send-message` of the same body, unchanged, to the build queue, then `aws sqs delete-message` from the DLQ for each message only after its send succeeded. The moved message's receive count starts again at 0. The build DLQ must then read 0. Rollback of this step: step 2's command.

Both fleets keep running throughout.

**Step 5, a full day green (gate).** 24 hours of `main` and PR traffic on the new fleet with no fleet-attributable red (lost runner, pickup over the window-5 baseline, Spot capacity failure the live fleet did not have). The live fleet stays deployed and idle as the rollback. Check: the CI goals driver's census over that day. Rollback: step 4's reverts.

**Step 6, drain and destroy the old fleet; end-state delivery (gate, operator workstation, YubiKey route).**

(a) Confirm the live fleet is idle: one `aws ec2 describe-instances --filters Name=tag:ghr:environment,Values=beep-ci,beep-ovf Name=instance-state-name,Values=pending,running` returns none, and `gh api orgs/beep-effect/actions/runners` lists no `beep-ci-` / `beep-ovf-` runner.
(b) Superseded 2026-11-25 by `2026-11-25-ci-runners-6b-delete-execute-api-hooks` (the CI goals driver ruled option B): hook 714397446 stays, the App webhook is set inactive and not moved, and only the two Pulumi repository webhooks are deleted. Follow that decision; the original text below is kept for the record. Move the App's webhook URL to the new function URL with `beep github app` (secret unchanged, step 2). Check: the App's recent deliveries show a 2xx from the new URL. Then delete the overlap repository webhook and the live overflow pool's repository webhook. Check: no repository or App webhook still targets an `execute-api` URL of the old controllers (`gh api repos/beep-effect/beep-effect/hooks` and the App's hook config list only the function URL), and the next deliveries leave no failed delivery to a dead URL. Rollback: follow the ordered procedure below ("If step 6b ran, restore the delivery paths in this order"). The overlap repository webhook comes back first, on the new fleet's function URL, and the App webhook moves back only after its 2xx.
(c) Freeze lifted: the cost-controls component-removal PR has merged. Take a fresh export outside the repo, `pulumi stack export --stack production` to `~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-<date>.json`, size and sha256 in a decision, with the program's commit sha; the passphrase only through `op run` from `op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE`. Older exports do not count.
(d) Decide then, from a `pulumi destroy --preview-only` (Pulumi 3.271 has no `preview --destroy`), between a whole-stack destroy (if only fleet, network, reaper, controller and AWS turbo-cache leftovers remain and the turbo cache has moved to the Worker) and a targeted destroy (`--target` per fleet URN, no `--target-dependents`) if anything else still lives in the stack. Record the choice and the preview's resource count in a decision, then destroy.
(e) One PR deletes the program and its readers (inventory below): `infra/ci-runners/`, `infra/src/CiRunners.ts`, `CiFleetController.ts`, `CiRunnerPool.ts`, `CiShardOverflowPool.ts`, `infra/src/internal/ci-runners-entry.ts` and their tests, which also removes the duplicated post-install scripts.
(f) The operator decides whether to delete the old SSM App parameters under `/github-action-runners/`, the key behind `alias/beep-ci-github-app` (schedule deletion, 30 days) and `beep-ci-fleet-boundary`.
Rollback before (d), in order (amended 2026-11-18, #3386 review).

If step 6b ran, restore the delivery paths in this order before any job is sent back to the old labels (amended 2026-11-18, #3386 r4620414302 and r4620549657). Step 6b deleted the overlap repository webhook, and jobs still run on the `beep-fleet-*` labels until step 4's workflow revert, so the new fleet's delivery comes back first:

1. Re-create the overlap repository webhook on the new fleet's webhook function URL (step 2), and verify a 2xx delivery from it.
2. Point the App webhook back at the live controller's URL recorded before 6b.
3. Re-create the live overflow pool's repository webhook on its recorded live URL.
4. Check that the next App and live-overflow deliveries show a 2xx from the live controllers.
5. Only then run step 4's rollback (phase revert, paused and drained scale-up, workflow revert).
6. Once the workflow revert has moved every job off the `beep-fleet-*` labels and the new fleet's queues are drained, delete the overlap repository webhook.

Rollback after (d). `pulumi stack import` of the archive restores state only, and that state still lists the fleet the destroy removed. A recreated API Gateway endpoint gets a new host, so the URLs recorded before 6b no longer deliver (amended 2026-11-18, #3386 r4617469545). In order:

1. Re-create the overlap repository webhook on the new fleet's webhook function URL, and verify a 2xx delivery from it, since 6b deleted it and jobs still run on the `beep-fleet-*` labels.
2. Run `pulumi preview --refresh`, which must show the missing fleet resources as creates, and only then `pulumi up --refresh` from the archived commit.
3. Read the recreated `controllerWebhook` and `shardOverflowWebhook` stack outputs (`pulumi stack output`). Point the App webhook at `controllerWebhook` with `beep github app`, and re-create the live-overflow repository webhook on `shardOverflowWebhook`, secrets unchanged.
4. Verify the recreated endpoints: the controllers answer, and the App and live-overflow webhooks deliver with a 2xx.
5. Run step 4's workflow revert.
6. Delete the overlap repository webhook only after the revert has moved every job off the `beep-fleet-*` labels.

**Readers of the live fleet's labels, groups, tags and paths (git grep of the tree, 2026-11-14), with the edit each needs.**

| Reader | Uses | Edit at step 4 (option A) | At step 6 |
| --- | --- | --- | --- |
| `.github/workflows/heavy.yml` | `runs-on: beep-ec2-heavy`, 9 jobs | `beep-fleet-heavy` | — |
| `.github/workflows/cache-warm.yml` | `runs-on: beep-ec2-heavy` | `beep-fleet-heavy` | — |
| `.github/workflows/shard-overflow.yml` (called from `check.yml`) | `runs-on: beep-shard-overflow`; comment on the group | `beep-fleet-overflow`; comment | — |
| `.github/workflows/check.yml` | comment naming the overflow label; `beep runners bake --check --manifest infra/ci-runners/runner-image.json` | comment | bake check reads the stack config instead (AMI item) |
| the retired `fleet-shadow-check` workflow (deleted by P6, #3567) | `runs-on: beep-ec2-heavy`; reads SSM `/github-action-runners/app/<parameter>` to prove the runner cannot read App secrets | `beep-fleet-heavy` and `/beep-fleet/prod/app/<parameter>`, if kept | delete with the old fleet unless the denial proof is wanted for the new fleet (then keep it, repointed) |
| `.github/workflows/fleet-lane-probe.yml` | default input `beep-ec2-heavy` (the shadow-fleet probe) | default `beep-fleet-heavy`, if kept | delete with the old fleet (it probed the live shadow pool) |
| `.github/workflows/rerun-runner-loss.yml` | comment on `beep-ec2-heavy` Spot evictions | comment | — |
| `packages/foundation/capability/config-file/test/fixtures/codec-corpus/yaml/fleet-lane-probe.yml` | a YAML fixture copy | none (fixture text) | keep, or drop with the probe |
| `packages/tooling/tool/cli/src/commands/Ci/CiShardOverflow.ts` | `SHARD_OVERFLOW_RUNNER_LABEL = "beep-shard-overflow"`, used by the routing plan and `CiShardOverflowPreflight.ts` as label and group name | split into label `beep-fleet-overflow` and group `beep-shard-overflow` | — |
| `packages/tooling/tool/cli/src/commands/Ci/CiShardOverflowPreflight.ts` | group name, webhook URL check against the overflow controller endpoint | expect the fleet function URL | — |
| `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | `MANAGED_RUNNER_LABEL_PATTERN = /^(?:self-hosted\|beep-)/` | none: `beep-fleet-*` still classifies as managed | — |
| `Ci/Certainty.ts`, `Certainty.schemas.ts`, `CiLane.ts`, `Quality/Quality.plan.ts`, `Quality/Tasks.ts` | prose and report labels naming `beep-ec2-heavy` | wording | — |
| `packages/tooling/tool/cli/src/commands/Runners/Runners.schemas.ts`, `Runners.service.ts`, `Runners.command.ts` | `RUNNER_AMI_PIN_PARAMETER = /beep-ci/controller/runner-ami-id`, `ciFleetController:amiId` check, `pulumiPinCommand`, image name `beep-ci-runners-<sha>` | — | AMI item below |
| `packages/tooling/tool/cli/test/ci-runner-security.test.ts` | asserts `runs-on: beep-ec2-heavy` for `producer-inspect`, `producer-prepare`, `local-pilot-observe` | new label | add the deploy workflow's exemption line (workflow decision) |
| `ci-shard-overflow.test.ts`, `ci-certainty.test.ts`, `ci-lane-timings.test.ts`, `ci-rerun-runner-loss.test.ts`, `ci-docs-job-admission.test.ts`, `runners-bake.test.ts` and the `ci-certainty` fixtures | label strings, bake receipts | follow the source edits; fixtures recorded before the move keep the old label | bake tests follow the AMI change |
| `docs/runbooks/ci-runner-reliability.md` | the live pool table (prefixes, groups, labels, webhook secrets, roles) and overflow procedures | rewrite for the new fleet | drop the old-fleet rows |
| `docs/runbooks/aws-cost-operations.md` | `runner-image.json`, `ciFleetController:amiId`, cost tag keys `beep-ci`, `ghr:environment` | — | AMI procedure; tag keys stay (cost allocation keys are account settings) |
| `docs/runbooks/alchemy-infra.md` | stack and cutover text | the move | the destroy |

Live `ghr:environment` values (`beep-ci`, `beep-ovf`) are read only by the Pulumi program, the live Lambdas and the runbook table; `/github-action-runners/shard-overflow/*` is read only by the Pulumi program (gate's grep); `/github-action-runners/app/*` is read by the program, the live Lambdas and `fleet-shadow-check.yml`.

**Labels after the old fleet is gone (CI-affecting; the gate settles it with the orchestrator at release).**

- Option A, the workflows end on the new names. Cost: one reviewed edit at step 4 across the readers above (9 heavy jobs, cache warm, overflow, the CLI overflow constant, security and CLI tests, runbooks), done once; label names then differ from the runner-group names (`beep-fleet-heavy` in group `beep-ec2-heavy`), which the overflow preflight must model as two constants; rollback is one revert. Measurements keep working (`beep-` prefix classifies as managed), but per-label history in census and timing reports splits at the move date.
- Option B, relabel the pools back to the live names after step 6. Cost: workflows move twice (to `beep-fleet-*` at step 4, back to `beep-ec2-heavy` / `beep-shard-overflow` after the destroy), or they never move and the new pools take the live labels while the old fleet still exists, which makes both fleets launch a runner for every job until the destroy (double Spot use against a quota the live fleet alone can fill, and double cost). Done after the destroy, the relabel is a stack update (webhook matchers and runner registration labels; runners are ephemeral, so no re-registration of live runners) plus the workflow revert, and leaves names, groups and history continuous with today.

**AMI ownership (cutover PR, not now).** After the cutover `beep runners bake` stays manual and attended, but writes the stack's typed config instead of Pulumi: it edits `productionConfig.image.amiId` in `packages/tooling/infra/ci-runners/src/Config.ts`, and the pin's merge deploys it through the workflow. Files: `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts` (the `ciFleetController:amiId` check and `pulumiPinCommand`, the read of `/beep-ci/controller/runner-ami-id`), `Runners.schemas.ts` (`RUNNER_AMI_PIN_PARAMETER`, the `pulumiPinCommand` field), `Runners.command.ts` (the printed pin line), `packages/tooling/tool/cli/test/runners-bake.test.ts`, the bake receipt `infra/ci-runners/runner-image.json` (moves to the package, for example beside `src/Config.ts`, or into a `goals/` record), `.github/workflows/check.yml`'s `bake --check --manifest` step, and the AMI procedure in `docs/runbooks/aws-cost-operations.md`.

**Spot quota and cost while both fleets exist.** See the precondition above. Double-running cost is bounded: the new fleet runs only the proof jobs during the overlap (no other job carries its labels), at most 3 VMs, each reaped within 90 minutes; idle cost is the Lambdas, the SQS pairs, the KMS key (1 USD a month), flow logs and no NAT. After step 4 the live fleet is idle at zero instances.

**Rulings recorded (packet gate, 2026-11-14).** 1: repository webhook for the overlap, App webhook moved and repository webhook deleted at the end (steps 2 and 6b); one shared secret. 2: reuse the live App (D10, no minting from IaC); its `op://` items are located by the operator at bootstrap. 3: `beep-fleet-heavy` / `beep-fleet-overflow` for the overlap; end state option A or B settled at release. 4: the bake change above, in the cutover PR. 5: every composite name pinned in `prod` (physical-names decision). 6: the state role and OIDC provider stay bootstrap singletons (state-role decision). 7: no reader of `/github-action-runners/shard-overflow/*` outside the program; `/github-action-runners/app/*` is covered in the inventory.

Settled 2026-11-18 (packet gate): option A, the workflows end on `beep-fleet-*` (decision "CI runners workflows end on the beep-fleet labels"); `fleet-shadow-check.yml` is repointed during the overlap and deleted in the step-6 cleanup PR with the Pulumi program (decision "fleet-shadow-check is repointed for the overlap and deleted at the Pulumi cleanup"); the live heavy burst cap stays at 6 or fewer while both fleets exist (decision "Live heavy bursts stay at 6 or fewer while both runner fleets exist").

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Before the Pulumi destroy: restore the old delivery paths if step 6b ran, then revert the phase PR and the workflow move (step 4 rollback). After it: pulumi stack import of the archived export, pulumi preview --refresh showing the missing fleet as creates, then pulumi up --refresh from the archived program commit.

### CI runners deploy through a stack-scoped OIDC role, beep-alchemy-ci-runners-deploy (proposed), 2026-11-14

Proposed, not created. The packet gate session creates these when it releases P5 (after the window-5 verdict), from the commands below, and records the receipts in a follow-up decision. This lane created nothing.

GitHub environment `ci-runners-prod`, deployment branch policy `main` only. Variable `CI_RUNNERS_DEPLOY_ROLE_ARN = arn:aws:iam::832907639880:role/beep-alchemy-ci-runners-deploy`. Secrets, set from 1Password by reference without printing (`op read ... | gh secret set <name> --env ci-runners-prod --repo beep-effect/beep-effect`): `CI_RUNNERS_GITHUB_APP_ID`, `CI_RUNNERS_GITHUB_APP_KEY_BASE64`, `CI_RUNNERS_GITHUB_WEBHOOK_SECRET`. The live App is reused (gate ruling 2026-11-14, D10): `CI_RUNNERS_GITHUB_APP_ID` from `op://<vault>/<app item>/<app id field>`, `CI_RUNNERS_GITHUB_APP_KEY_BASE64` from `op://<vault>/<app item>/<base64 private key field>`, `CI_RUNNERS_GITHUB_WEBHOOK_SECRET` from `op://<vault>/<app item>/<webhook secret field>` (the live App's webhook secret: the overlap repository webhook and, at the end state, the App webhook sign with it; cutover step 2). The operator fills in the item and field names at bootstrap; the live values in SSM are never read back.

Role `beep-alchemy-ci-runners-deploy`: trusted by the existing provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, subject exactly `repo:beep-effect/beep-effect:environment:ci-runners-prod`, one-hour sessions. Inline policy `ci-runners-deploy`. Since the gate ruling of 2026-11-14 every name the stack and the composite choose in `prod` is pinned under `beep-fleet-prod-` (physical-names decision), so the policy is scoped by those names; EC2 network objects, launch templates and KMS keys have AWS-assigned ids and stay scoped by the ownership tags Alchemy stamps (`alchemy::stack = CiRunners`, `alchemy::stage = prod`). The one generated-name exception is the nine Lambda execution roles, which `Lambda.Function` names `CiRunners-<logical id>-prod-<suffix>` with no prop to pin them:

- State: `s3:ListBucket`, `s3:GetBucketLocation`, `s3:GetBucketVersioning`, `s3:GetBucketOwnershipControls`, `s3:GetBucketPublicAccessBlock`, `s3:GetEncryptionConfiguration` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an`; `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/CiRunners/*` only.
- EC2 reads: `ec2:Describe*` on `*`.
- EC2 creates (VPC, subnet, internet gateway, route table, security group `beep-fleet-prod-runner`, flow log, launch templates `beep-fleet-prod-{heavy,overflow}`): `ec2:CreateVpc`, `ec2:CreateSubnet`, `ec2:CreateInternetGateway`, `ec2:CreateRouteTable`, `ec2:CreateSecurityGroup`, `ec2:CreateFlowLogs`, `ec2:CreateLaunchTemplate` with `aws:RequestTag/alchemy::stack = CiRunners` and `aws:RequestTag/alchemy::stage = prod`. `ec2:CreateTags` in two statements only (amended 2026-11-18): tag-on-create, with `ec2:CreateAction` in exactly those seven create actions plus the same two request tags (Alchemy's EC2 providers tag through `TagSpecifications` on create); and direct `CreateTags` only on a resource that already carries `aws:ResourceTag/alchemy::stack = CiRunners` and `aws:ResourceTag/alchemy::stage = prod` (tag updates of the stack's own resources). A request tag alone never grants `CreateTags`: otherwise the role could stamp `alchemy::stack = CiRunners` on a live-fleet resource and gain every tag-scoped mutation and delete below on it.
- EC2 mutations and deletes on resources tagged `alchemy::stack = CiRunners` and `alchemy::stage = prod`: `ec2:ModifyVpcAttribute`, `ec2:AttachInternetGateway`, `ec2:DetachInternetGateway`, `ec2:CreateRoute`, `ec2:ReplaceRoute`, `ec2:DeleteRoute`, `ec2:AssociateRouteTable`, `ec2:DisassociateRouteTable`, `ec2:ModifySubnetAttribute`, `ec2:AuthorizeSecurityGroupEgress`, `ec2:RevokeSecurityGroupEgress`, `ec2:CreateLaunchTemplateVersion`, `ec2:ModifyLaunchTemplate`, `ec2:DeleteLaunchTemplateVersions`, `ec2:DeleteLaunchTemplate`, `ec2:DeleteFlowLogs`, `ec2:DeleteSecurityGroup`, `ec2:DeleteSubnet`, `ec2:DeleteRouteTable`, `ec2:DeleteInternetGateway`, `ec2:DeleteVpc`, `ec2:DeleteTags`. The new VPC's default security group carries no Alchemy tag: AWS creates it with the VPC, and `DefaultSecurityGroup` only empties its rules. Its two revokes are therefore granted positively, scoped to the new fleet VPC, in a second policy version (amended 2026-11-18, #3386 review). v1, created at step 0, has no default-group grant. v2 adds `ec2:RevokeSecurityGroupIngress` and `ec2:RevokeSecurityGroupEgress` on `security-group/*` with `ArnEquals ec2:Vpc` = the new fleet VPC's ARN. That ARN exists only once cutover step 1a has deployed the VPC, so the gate writes v2 after 1a (one `describe-vpcs` filtered on both `tag:alchemy::stack=CiRunners` and `tag:alchemy::stage=prod`, which must return exactly one VPC; zero or several stops the step, so a personal stage's VPC can never be scoped instead), re-runs the simulations below and only then dispatches the full deploy (step 1b). No grant reaches a security group in any other VPC. The sweep on destroy: `ec2:TerminateInstances` on instances whose `ghr:environment` starts with `beep-fleet-prod-` (`StringLike`).
- IAM (amended 2026-11-18, #3386 P1 r4613002543). Every write to a fleet role's permissions is held to the fleet boundary. `iam:CreateRole`, `iam:PutRolePolicy`, `iam:DeleteRolePolicy`, `iam:DetachRolePolicy` and `iam:PutRolePermissionsBoundary` on `role/beep-fleet-prod-*` and `role/CiRunners-*-prod-*` require `iam:PermissionsBoundary` = `arn:aws:iam::832907639880:policy/beep-fleet-boundary/fleet-boundary-prod` (StringEquals). `iam:AttachRolePolicy` requires the same plus `ArnLike iam:PolicyARN` in `policy/beep-fleet/prod/*` or `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`, the one AWS-managed policy, named because Alchemy attaches it to every Lambda execution role. `iam:DeleteRolePermissionsBoundary` and `iam:UpdateAssumeRolePolicy` are granted nowhere; Alchemy calls the latter only when a role's trust document changes, which this stack never does, so such a change would be an operator deploy. Reads (`GetRole`, `GetRolePolicy`, `ListRolePolicies`, `ListAttachedRolePolicies`, `ListRoleTags`) and metadata (`TagRole`, `UntagRole`, `UpdateRole`, `DeleteRole`) stay on the fleet roles. Policy CRUD and versions apply only on `policy/beep-fleet/prod/*`. A policy written there is capped by the boundary of the role it is attached to, so authoring one grants nothing beyond the boundary. Instance-profile CRUD and `AddRoleToInstanceProfile`/`RemoveRoleFromInstanceProfile` apply on `instance-profile/beep-fleet-prod-*`. `iam:PassRole` applies on the fleet roles with `iam:PassedToService` in `lambda.amazonaws.com`, `ec2.amazonaws.com` or `vpc-flow-logs.amazonaws.com`.
- Fleet boundary (bootstrap object per stage, not a stack resource; per stage since 2026-11-18, #3386 r4613663137). Its document is `fleetBoundary(stage)` in `DeployRolePolicy.ts`, published at `fleetBoundaryPolicyArnFor(stage)` = `arn:aws:iam::832907639880:policy/beep-fleet-boundary/fleet-boundary-<slug>`, and every role a stage creates carries that stage's boundary: the runner roles, every Lambda execution role, the flow-logs role and the reaper's role. The deploy role's role grants accept only `fleet-boundary-prod`. A test enumerates every planned prod role and Lambda execution role and checks that each carries `fleet-boundary-prod`. A personal stage needs its own boundary created the same way before its first deploy. Alchemy beta.87's `Lambda.Function` set no boundary, so the repo patches `@alchemy.run/aws` (`patchedDependencies`) to add `permissionsBoundary`, which is set on `CreateRole` and put on an existing role before any policy is attached. The gate creates the boundary out of band with aws-vault at step 0, at its own path outside `policy/beep-fleet/prod/*`: `aws iam create-policy --policy-name fleet-boundary-prod --path /beep-fleet-boundary/ --policy-document file://$D/fleet-boundary.json` (the prod document `deploy-role-policy.ts` writes). The deploy role has no grant at all on any `policy/beep-fleet-boundary/*` ARN (tested) (no CreatePolicy, CreatePolicyVersion, SetDefaultPolicyVersion, DeletePolicyVersion or DeletePolicy), so a run cannot rewrite the ceiling it is held to. If the stack owned the boundary, updating it would need CreatePolicyVersion, which is exactly the escalation. The boundary's allows are scoped to its one stage (amended 2026-11-18, driver P1 on the boundary ceiling and r4613663137): the prod boundary is no wider than the deploy role's own reach, and it matches no name, ARN or tag value of another stage (a test generates the `dev-alice` names with the stack's own name helpers and matches every prod pattern against them). For `prod`: SSM actions apply on `parameter/beep-fleet/prod/*`. KMS `Decrypt`, `Encrypt` and `GenerateDataKey` apply only with `kms:ViaService` = `ssm.us-east-1.amazonaws.com` and `kms:EncryptionContext:PARAMETER_ARN` under `parameter/beep-fleet/prod/*`, which covers both the fleet key and `aws/ssm` (the runner tokens), and only for fleet parameters. S3 object actions apply on the binaries buckets (`beep-fleet-prod-binaries-*`, and `cirunners-*-prod-*` for Alchemy-generated names), never the Alchemy state bucket. Logs apply on `/beep-fleet/prod/*`, `/aws/lambda/beep-fleet-prod-*` and `/aws/lambda/CiRunners-*-prod-*`. SQS message actions apply on `beep-fleet-prod-*` and `CiRunners-*-prod-*` queues. `lambda:InvokeFunction` applies on `function:beep-fleet-prod-*` and `function:CiRunners-*-prod-*`. EC2 has no service wildcard. `CreateFleet`/`RunInstances` create instances, volumes and EC2 Fleets only with `aws:RequestTag/ghr:environment` like `beep-fleet-prod-*`, and a launch is allowed only when its subnet and security group are tagged `alchemy::stack=CiRunners` and `alchemy::stage=prod` (a launch template, when the request names one, must be stack-owned too). AMIs, snapshots, network interfaces and Spot requests are read or created by the launch untagged, and they have no other grant. `CreateTags` is allowed on launch (`ec2:CreateAction`) or on fleet-tagged instances. `DeleteTags`, `TerminateInstances` and `ModifyInstanceMetadataOptions` apply only on instances whose `ghr:environment` is like `beep-fleet-prod-*`. There is no `CreateSnapshot`, `ModifySnapshotAttribute`, `CreateImage`, `ModifyImageAttribute` or `ModifyInstanceAttribute` grant. `Resource: "*"` appears only on the read-only `ec2:DescribeInstances`, `ec2:DescribeTags`, `ec2:DescribeLaunchTemplateVersions`, `ssm:DescribeParameters`, `logs:DescribeLogGroups` and `sts:GetCallerIdentity` (`boundaryWildcardReasons`). `iam:PassRole` applies on the stage's roles. It explicitly denies every IAM write, passing or assuming any role outside `role/beep-fleet-prod-*` and `role/CiRunners-*-prod-*`, `organizations:*`, `account:*`, `aws-portal:*` and `billing:*`, plus the IMDS re-enable. A capped Lambda or EC2 role therefore cannot create an uncapped role. The stack's former `RunnerBoundaryPolicy` resource is gone.
- Lambda: function CRUD, configuration, code, URL config, concurrency, tags, permissions and event-source mappings on `arn:aws:lambda:us-east-1:832907639880:function:beep-fleet-prod-*` only (eleven functions: `beep-fleet-prod-webhook`, `-ssm-housekeeper`, `-binaries-syncer`, `-termination-watcher`, `-reaper`, and per pool `-{heavy,overflow}-scale-up`, `-job-retry`, `-scale-down`); `lambda:CreateEventSourceMapping` on `*` (a mapping has no ARN until it exists), with `ArnLike lambda:FunctionArn` = `arn:aws:lambda:us-east-1:832907639880:function:beep-fleet-prod-*` plus both `aws:RequestTag/alchemy::` ownership tags, which Alchemy stamps on every mapping it creates. `lambda:TagResource` on `event-source-mapping:*` applies with those request tags only, and only for the three keys `alchemy::stack`, `alchemy::stage` and `alchemy::id` (`ForAllValues:StringEquals aws:TagKeys`); the Service Authorization Reference lists `lambda:TagResource` as a dependent action of `CreateEventSourceMapping` with tags, and tag on create carries no create-action key, so this is the narrowest grant the create needs. `UpdateEventSourceMapping` and `DeleteEventSourceMapping` on `event-source-mapping:*` require both `ArnLike lambda:FunctionArn` = the fleet functions (the reference lists that key on both actions) and `aws:ResourceTag/alchemy::stack = CiRunners` with `aws:ResourceTag/alchemy::stage = prod` (amended 2026-11-18, r4613039446 and r4613411045). The owned-tag condition alone does not protect an unowned mapping, because a direct `TagResource` can satisfy it (r4613657296). The protection is that `CreateEventSourceMapping` on fleet functions is granted only to this deploy role, so no other principal in the account manages fleet functions or their mappings, and that the live fleet's six mappings are denied explicitly (`DenyLiveFleetMappings`, decision "Deny the live fleet's event-source mappings until the P5 drain"). Simulations #21 to #28 were run by the gate (51/51 PASS). Tag on create is checked read-only after step 1a by the by-target tag check, once the stack has created its mappings with tags. No `lambda:UntagResource` is granted on mappings. `ListEventSourceMappings`, `GetEventSourceMapping` and `ListTags` apply on `*`.
- SQS: queue CRUD, attributes and tags on `arn:aws:sqs:us-east-1:832907639880:beep-fleet-prod-*` (ten queues: per pool `-build`, `-build-dlq`, `-job-retry`, `-job-retry-dlq`; fleet `-deregister-retry`, `-deregister-retry-dlq`).
- SSM: parameter put/get/delete/describe/tags on `arn:aws:ssm:us-east-1:832907639880:parameter/beep-fleet/prod/*`; `ssm:DescribeParameters` on `*`.
- KMS (amended 2026-11-18, #3386 r4617469606, r4617469616, r4617469632, against beta.87 `KMS/Key.ts` and `KMS/Alias.ts`).
  - `kms:CreateKey` and `kms:TagResource` require both ownership request tags, and `aws:TagKeys` limited to the three `alchemy::` keys. The KMS developer guide requires tag on create to be granted by "an IAM policy that isn't restricted to particular KMS keys", so the tag grant cannot be held to the new key, and a request can tag an existing IAM-delegated key with the ownership tags.
  - A tag therefore confers nothing that matters. Keys tagged `CiRunners`/`prod` get only `DescribeKey`, `GetKeyPolicy`, `GetKeyRotationStatus`, `ListResourceTags`, `EnableKeyRotation`, and key-side `CreateAlias`/`UpdateAlias`/`DeleteAlias` (an alias write is checked on the alias and on its target key).
  - No `PutKeyPolicy`, `ScheduleKeyDeletion`, `DisableKey` or `UntagResource` is granted: Alchemy calls `PutKeyPolicy` only for a declared policy, which the fleet key has none of, and deletion is the operator-workstation destroy, never this role.
  - `kms:Encrypt`, `Decrypt` and `GenerateDataKey` apply only through SSM (`kms:ViaService`) with `kms:EncryptionContext:PARAMETER_ARN` under `parameter/beep-fleet/prod/*`, so no key, tagged or not, serves this role outside fleet parameters.
  - `kms:ListAliases` on `*`, which takes no resource-level scope, because `KMS.Alias` lists aliases before it creates one.
  - `kms:CreateAlias`, `UpdateAlias` and `DeleteAlias` on `alias/beep-fleet-prod-*`.
- S3 binaries bucket: bucket CRUD, public-access block, tags and object put/delete on `arn:aws:s3:::beep-fleet-prod-binaries-832907639880` and its objects only, plus the reads beta.87 `S3/Bucket.ts` makes on every reconcile (amended 2026-11-18, #3386 r4617469641): `GetBucketLocation` (existence; called before the create too), `GetBucketPolicy`, `GetEncryptionConfiguration` with `PutEncryptionConfiguration` (written when the observed default rule differs) and `GetBucketNotification`.
- EventBridge: rule and target CRUD and tags on `arn:aws:events:us-east-1:832907639880:rule/beep-fleet-prod-*` (seven rules: per pool `-scale-down`; `-ssm-housekeeper`, `-binaries-syncer`, `-spot-interruption`, `-instance-state-change`, `-reaper`).
- CloudWatch Logs: log group CRUD, retention and tags on `/beep-fleet/prod/*` and `/aws/lambda/beep-fleet-prod-*` (Lambda log groups follow the pinned function names).
- STS: `sts:GetCallerIdentity`.

No assets bucket: the provider layer registers no `Assets` service, so each bundle uploads inline with `CreateFunction`/`UpdateFunctionCode` and the role needs no access to an `alchemy::assets-bucket`. No `ec2:RunInstances`/`CreateFleet`: the deploy never launches a runner; scale-up's own role does.

Policy JSON (amended 2026-11-18). The policy is code: `packages/tooling/infra/ci-runners/src/DeployRolePolicy.ts` builds `deployRolePolicy(vpcArn)` (v1 without a VPC, v2 with the prod fleet VPC) and `fleetBoundaryDocument`. Its unit tests assert the security properties of the generated documents:

- every tag-on-create grant carries `ec2:CreateAction` and both request tags;
- a direct `ec2:CreateTags` needs both ownership tags on the target;
- the default-group revoke is `ArnEquals ec2:Vpc` to the given VPC only;
- every role permission write carries the boundary condition, `AttachRolePolicy` is limited by policy ARN, and `PassRole` carries `PassedToService`;
- no `iam:*` wildcard and no `DeleteRolePermissionsBoundary` is granted;
- the boundary lies outside every policy path the role can write, and no version or delete grant reaches it;
- the boundary denies IAM writes, roles outside the fleet, and Organizations, account and billing actions;
- the boundary names `Resource: "*"` only on read-only actions listed in `boundaryWildcardReasons`; holds every EC2 write to fleet tags or the stack's launch inputs; grants no snapshot, image or instance-attribute write; serves KMS only through SSM for a fleet parameter; scopes SSM, S3, logs, SQS and Lambda to fleet ARNs; and keeps every action the fleet's own role policies grant;
- a mutating EC2 action on `Resource: "*"` appears only in the four statements whose reason `wildcardResourceReasons` records;
- every event-source mapping write is held by `lambda:FunctionArn`; later writes also need the ownership tags; mapping tagging is limited to the ownership keys and values;
- every planned role ARN, Lambda execution roles included, matches both the deploy role's role grants and the boundary's fleet-role patterns (`CiRunners.test.ts`).

`bun deploy-role-policy.ts --out-dir <dir> [--vpc-arn <arn>]`, run from that package, writes the policy, its chunks for `simulate-custom-policy` (each under 2,000 characters; the policy only allows, so the chunks evaluate together as the whole; its one deny, `DenyLiveFleetMappings`, applies from whichever chunk holds it) and `fleet-boundary.json`.

Simulations (this list is the record; placeholder ARNs stand in for the new VPC, a live-fleet object and a fleet role `beep-fleet-prod-x`). They are run against the generated JSON before arming, and again on v2 with the real VPC ARN between cutover steps 1a and 1b:

1. v2, default-group revokes in the new VPC (`ec2:Vpc` = new): allowed.
2. v2, the same in an unrelated VPC: implicitDeny.
3. v1, the same in the new VPC: implicitDeny (why step 1a excludes `DefaultSecurityGroup`).
4. `ec2:CreateTags` on the live VPC with both ownership request tags and no `ec2:CreateAction`: implicitDeny.
5. `ec2:CreateTags` with `ec2:CreateAction=CreateVpc` and both request tags: allowed.
6. `ec2:DeleteVpc` on a VPC tagged `alchemy::stack=CiRunners`, `alchemy::stage=prod`: allowed.
7. `ec2:DeleteVpc` on the live VPC: implicitDeny.
8. `lambda:UpdateFunctionCode` on `beep-ci-scale-up`: implicitDeny.
9. A direct `ec2:CreateTags` on a live-fleet security group without an `alchemy::stack` tag, requesting both ownership tags, no `ec2:CreateAction`: implicitDeny.
10. The same on a VPC tagged `alchemy::stack=Other`: implicitDeny.
11. `ec2:RevokeSecurityGroupEgress` on a live-fleet security group (`ec2:Vpc` = live): implicitDeny.
12. `iam:CreateRole` on `beep-fleet-prod-x` without `iam:PermissionsBoundary`: implicitDeny.
13. The same with the fleet boundary: allowed.
14. `iam:AttachRolePolicy` of `AdministratorAccess` on `beep-fleet-prod-x`, with the boundary: implicitDeny.
15. `iam:PutRolePolicy` on `beep-fleet-prod-x` without the boundary: implicitDeny.
16. `iam:PassRole` of `beep-fleet-prod-x` to `iam.amazonaws.com`: implicitDeny.
17. `iam:DeleteRolePermissionsBoundary` on `beep-fleet-prod-x`: implicitDeny.
18. `iam:CreatePolicyVersion` on the boundary ARN (`fleet-boundary-prod`): implicitDeny.
19. `iam:PutRolePermissionsBoundary` naming a different boundary ARN: implicitDeny.
20. Effective permissions: a `*:*` identity policy under the fleet boundary (`--permissions-boundary-policy-input-list`) is denied `iam:CreateRole`, `iam:AttachRolePolicy`, `sts:AssumeRole` of a non-fleet role and `organizations:LeaveOrganization`, and is allowed `ec2:DescribeInstances`. Extended 2026-11-18 (boundary ceiling), cases in `sim20-cases.json`:
    - Denied: `ssm:GetParameter` on `parameter/other/x`; `s3:GetObject` on `alchemy-state-832907639880-us-east-1-an/OtherStack/x` and on another bucket; `kms:Decrypt` on a non-fleet key; `ec2:TerminateInstances` and `ec2:ModifyInstanceAttribute` on an untagged instance; `ec2:ModifySnapshotAttribute`; `sqs:SendMessage` to a non-fleet queue; `lambda:InvokeFunction` on `beep-ci-scale-up`.
    - Allowed: `ec2:RunInstances` with the fleet tags from a stack launch template, subnet and security group; `ssm:GetParameter` on `parameter/beep-fleet/prod/x`; `kms:Decrypt` through SSM for a fleet parameter; SQS message actions on `beep-fleet-prod-*`; logs on the fleet groups; `ec2:TerminateInstances` on an instance tagged `ghr:environment=beep-fleet-prod-heavy`.
21. `lambda:CreateEventSourceMapping` to a fleet function with both request tags: allowed.
22. The same to `beep-ci-scale-up`: implicitDeny.
23. `lambda:UpdateEventSourceMapping` and `lambda:DeleteEventSourceMapping` on a mapping tagged `CiRunners`/`prod`: allowed.
24. The same on a mapping tagged `alchemy::stack=Other`: implicitDeny.
25. `lambda:UpdateEventSourceMapping` and `lambda:DeleteEventSourceMapping` on a mapping tagged `CiRunners`/`prod` whose `lambda:FunctionArn` is `beep-ci-scale-up`: implicitDeny.
25b. Under the fleet boundary, `sqs:ReceiveMessage` and `sqs:DeleteMessage` on `arn:aws:sqs:us-east-1:832907639880:beep-ci-build` (a non-fleet queue): implicitDeny.
26. `lambda:TagResource` on a foreign mapping with the ownership request tags: allowed by the allow statements. The vector: tag a foreign mapping with the ownership tags, then call `UpdateEventSourceMapping` with `FunctionName` set to a fleet function, which retargets it; whether `lambda:FunctionArn` evaluates the requested or the current target is not documented. The bound: the boundary denies every fleet role reading or deleting a non-fleet queue's messages (#25b), so the worst case is disrupting a foreign consumer, not reading its data. The account holds six such mappings (the live fleet's `beep-ci-*` and `beep-ovf-*`), so `DenyLiveFleetMappings` closes it for them until the P5 drain and destroy (#29a–d). With an extra tag key (`aws:TagKeys` includes `team`): implicitDeny. With `alchemy::stack=Other`: implicitDeny.
27. Tag on create: `lambda:TagResource` on `event-source-mapping:new` with both ownership request tags and keys `alchemy::stack`, `alchemy::stage`, `alchemy::id`: allowed.
28. `iam:CreateRole`, `iam:PutRolePolicy` and `iam:PassRole` on a role with a path (`role/beep-fleet/prod/beep-fleet-prod-flow-logs`), with the boundary: implicitDeny. This is the convention test: no fleet role may carry a path.
29a–d. `lambda:TagResource`, `lambda:UntagResource`, `lambda:UpdateEventSourceMapping` and `lambda:DeleteEventSourceMapping` on the live `beep-ci-scale-up` mapping (`event-source-mapping:e93fcf22-bfe9-4da4-92e7-a124812ac31b`), with both ownership request and resource tags and `lambda:FunctionArn` = a fleet function in the context: explicitDeny (`DenyLiveFleetMappings`).
30. KMS ownership by tag (r4617469606): `kms:PutKeyPolicy`, `kms:ScheduleKeyDeletion` and `kms:Decrypt` (with no `kms:ViaService`) on a key tagged `alchemy::stack=CiRunners`, `alchemy::stage=prod`: implicitDeny. `kms:Decrypt` through SSM (`kms:ViaService=ssm.us-east-1.amazonaws.com`, `PARAMETER_ARN` = a fleet parameter): allowed. The same with `PARAMETER_ARN=parameter/other/x`: implicitDeny.
31. `kms:TagResource` with both ownership request tags and `aws:TagKeys` = the three ownership keys: allowed. With an extra key `team`: implicitDeny.
32. `kms:ListAliases` on `*`: allowed. `kms:CreateAlias` on `alias/beep-fleet-prod-github-app` and on a key tagged `CiRunners`/`prod`: allowed. On an untagged key: implicitDeny.
33. `s3:GetBucketLocation`, `s3:GetBucketNotification`, `s3:GetBucketPolicy`, `s3:GetEncryptionConfiguration` and `s3:PutEncryptionConfiguration` on `arn:aws:s3:::beep-fleet-prod-binaries-832907639880`: allowed. The same on another bucket: implicitDeny.
20t–v. Under the prod boundary with the `*:*` identity: `ssm:GetParameter` on `parameter/beep-fleet/dev-alice/x`, `lambda:InvokeFunction` on `beep-fleet-dev-alice-heavy-scale-up`, `sqs:ReceiveMessage` on `beep-fleet-dev-alice-heavy-build` and `ec2:TerminateInstances` on an instance tagged `ghr:environment=beep-fleet-dev-alice-heavy`: implicitDeny.

Results. Simulations 1 to 11 passed on 2026-11-18 (packet gate session, `aws iam simulate-custom-policy`, account 832907639880, us-east-1) on the chunks generated before the IAM boundary change. Simulations 9 and 10 cover the CWE-863 bypass path: a direct `ec2:CreateTags` that sets the ownership tags on a resource without them is refused. On the chunks of a2c68248391, 51 of 51 simulations passed on 2026-11-18 (packet gate session, same account and region): #1 to #19, #20 with the extended cases 20a to 20s, #21 to #24, #25, #26a to #26c, #27 and #28, plus #25b: `sqs:ReceiveMessage` and `sqs:DeleteMessage` on the non-fleet `beep-ci-build` queue under the boundary, both implicitDeny.

Results at 8e3b3a45301 (2026-11-18, packet gate session, same account and region, #3386 r4613848496): 59 of 59 passed, plus #25b.

- #1 to #19 and #21 to #28 passed.
- #29a to #29d were all explicitDeny on the live `beep-ci-scale-up` mapping, even with the ownership tags and a fleet `lambda:FunctionArn` in the context.
- #20 base passed, and so did 20a to 20s, both the deny half and the allow half.
- 20t to 20w (dev-alice resources under the prod boundary) were all denied.
- #25b was implicitDeny.

Mapping inventory. The gate's read-only `aws lambda list-event-source-mappings` (us-east-1, 2026-11-18 about 11:4xZ) returned exactly the six ARNs `DenyLiveFleetMappings` denies. All six were `Enabled`, all target live-fleet functions, and no fleet mapping existed yet. The cutover decision re-reads the list before step 1b and before the drain.

Principal-access assumption. Only this deploy role can call `CreateEventSourceMapping` on `beep-fleet-prod-*` functions. No other principal in the account manages fleet functions or their mappings, which is what makes the owned-tag condition sufficient for the stack's own mappings.

Live validation (corrected 2026-11-18, #3386 r4614163550). Steps 1a and 1b run read-only checks only: the by-target tag check proves tag on create, and the six live UUIDs are confirmed unchanged (cutover decision, mapping check). For the direct-tag, update and delete sequences, the policy's answers are proven by simulations #23 to #29. Which function ARN AWS evaluates on a retargeting Update is unverified, so the live mappings are covered by `DenyLiveFleetMappings` and the by-target live check, not by that condition. By decision there is no mutating live test: no separate fixture account exists, and a fixture in the prod account would add risk without adding coverage. The results go into the cutover record before the traffic move.

Commands, run by the gate from the operator workstation (`AWS_PROFILE=elpresidank-vault`), after the policy JSON is generated and reviewed: `aws iam create-role --role-name beep-alchemy-ci-runners-deploy --assume-role-policy-document file://$D/trust.json --max-session-duration 3600 --tags Key=beep:owner,Value=infra-alchemy-rebuild`, `aws iam put-role-policy --role-name beep-alchemy-ci-runners-deploy --policy-name ci-runners-deploy --policy-document file://$D/policy-v1.json` (v2 at step 1a/1b, same command), `gh api -X PUT repos/beep-effect/beep-effect/environments/ci-runners-prod` with the `main` branch policy, `gh variable set CI_RUNNERS_DEPLOY_ROLE_ARN --env ci-runners-prod`, and the three `gh secret set` pipes. Checks: `aws iam simulate-principal-policy` must say `allowed` for `ec2:DeleteVpc` on a VPC tagged `alchemy::stack=CiRunners` and `implicitDeny` on the live `beep-ci-runners-vpc`; `implicitDeny` for `ec2:CreateTags` on the live `beep-ci-runners-vpc` (foreign tags, no `ec2:CreateAction`) even with request tags `alchemy::stack=CiRunners` and `alchemy::stage=prod`, and `allowed` for `ec2:CreateTags` with `ec2:CreateAction=CreateVpc` and those request tags; `implicitDeny` for `ec2:RevokeSecurityGroupIngress` on a security group in the live VPC; and `implicitDeny` for `lambda:UpdateFunctionCode` on `beep-ci-scale-up`.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: aws iam delete-role-policy --role-name beep-alchemy-ci-runners-deploy --policy-name ci-runners-deploy; aws iam delete-role --role-name beep-alchemy-ci-runners-deploy; gh api -X DELETE repos/beep-effect/beep-effect/environments/ci-runners-prod.

### CI runners deploy workflow drafted, not wired, until the window-5 release, 2026-11-14

Drafted here, not as a `.github` file: the window-5 measurement forbids any `.github/` change until the gate releases P5, and every workflow PR of this packet is disclosed to the orchestrator and merged by the operator. When released, the gate (or the lane it names) adds the workflow `deploy-ci-runners.yml` (in the repository workflows directory) with this content (synced 2026-11-18 to the shipped file: App secrets on the two steps that run the stack program only, and the checked deploy of the cutover decision's condition d), adds its line to the `ci-runner-security` exemption test as cost-controls did, and asks the operator for the merge:

```yaml
name: Deploy CI runners

# Deploys the `prod` stage of the CiRunners Alchemy stack in
# packages/tooling/infra/ci-runners: the runner fleet network, the heavy and
# shard-overflow pools (RunnerFleet), the runner IAM policies and the reaper,
# built beside the Pulumi beep-ci-runners/production fleet under new names
# (goals/infra-alchemy-rebuild P5). State lives in the shared S3 state store;
# its stage lease plus this concurrency group serialize prod deploys and never
# cancel one mid-apply.
#
# The job is DISARMED: it runs only while the repository variable
# CI_RUNNERS_DEPLOY_ARMED is `true`. Unarmed, the job is skipped before any
# step, so merging this workflow deploys nothing, and neither does a push or a
# manual dispatch. The packet gate arms it for cutover step 1 only after the
# orchestrator confirms the CI goals driver lowered the heavy burst cap to 6
# (decision "CI runners cutover from the Pulumi fleet").
# Armed, only the two cutover dispatches run (`bootstrap`, then
# `default-security-group`): a `routine` run, every push included, also needs
# CI_RUNNERS_ROUTINE_ARMED = `true`, which the gate sets only after step 1b
# succeeds. So no push can reconcile the stack between 1a and 1b.
#
# The plan step plans the stage, runs the plan check (src/PlanCheck.ts) and
# saves the checked plan; it stops the job on a replace, delete or orphan, a
# destructive binding change, a foreign resource or a stack action. The deploy
# step plans again under the stage lease, checks again and applies that same
# plan object only when it equals the saved one (src/CheckedDeploy.ts,
# applyIfUnchanged); any drift between the two stops it before a write. The
# dispatch input `mode` names the cutover expectation both steps enforce:
# `bootstrap` (step 1a) and `default-security-group` (step 1b) refuse any other
# change; pushes run as `routine`.
# Credentials: the stack-scoped OIDC role vars.CI_RUNNERS_DEPLOY_ROLE_ARN on
# the ci-runners-prod environment; App credentials are that environment's
# secrets, passed only to the plan and deploy steps, and stay Redacted to SSM.
# Runbook: docs/runbooks/alchemy-infra.md.
on:
  push:
    branches: [main]
    paths:
      - packages/tooling/infra/ci-runners/**
      - packages/tooling/library/alchemy-github-runners/src/**
      - packages/tooling/library/alchemy-aws-extras/src/**
      - bun.lock
      - .github/workflows/deploy-ci-runners.yml
  workflow_dispatch:
    inputs:
      mode:
        description: "routine; bootstrap (cutover step 1a: creates only, no DefaultSecurityGroup); default-security-group (step 1b: that one create)"
        type: choice
        options: [routine, bootstrap, default-security-group]
        default: routine

concurrency:
  group: alchemy-ci-runners-prod
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  deploy:
    name: Deploy CI runners (prod)
    if: >-
      vars.CI_RUNNERS_DEPLOY_ARMED == 'true' &&
      (vars.CI_RUNNERS_ROUTINE_ARMED == 'true' ||
      (github.event_name == 'workflow_dispatch' && inputs.mode != 'routine'))
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    environment:
      name: ci-runners-prod
    permissions:
      contents: read
      id-token: write
    env:
      CI: "true"
      ALCHEMY_TELEMETRY_DISABLED: "1"
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup monorepo CI
        uses: ./.github/actions/setup-monorepo-ci

      - name: Configure AWS credentials (ci-runners deploy role)
        uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ vars.CI_RUNNERS_DEPLOY_ROLE_ARN }}
          role-session-name: alchemy-ci-runners-prod
          aws-region: us-east-1

      # Plans prod, prints resources, actions and bindings (never a value), runs
      # the plan check and saves the checked plan for the deploy step.
      - name: Plan and check the prod stage
        working-directory: packages/tooling/infra/ci-runners
        # The App secrets reach only the two steps that run the stack program.
        env:
          CI_RUNNERS_GITHUB_APP_ID: ${{ secrets.CI_RUNNERS_GITHUB_APP_ID }}
          CI_RUNNERS_GITHUB_APP_KEY_BASE64: ${{ secrets.CI_RUNNERS_GITHUB_APP_KEY_BASE64 }}
          CI_RUNNERS_GITHUB_WEBHOOK_SECRET: ${{ secrets.CI_RUNNERS_GITHUB_WEBHOOK_SECRET }}
          # A push carries no inputs, so it plans as routine.
          MODE: ${{ inputs.mode || 'routine' }}
          EXCLUDE: ${{ inputs.mode == 'bootstrap' && 'DefaultSecurityGroup' || '' }}
        shell: bash
        run: |
          set -euo pipefail
          bun plan-check.ts plan --stage prod --expect "$MODE" ${EXCLUDE:+--exclude "$EXCLUDE"} \
            --out "$RUNNER_TEMP/ci-runners-checked-plan.json"

      # Applies only the checked change set: plans again, checks again, and
      # refuses before any write when the plan differs from the saved one.
      - name: Deploy the checked plan
        working-directory: packages/tooling/infra/ci-runners
        shell: bash
        # The App secrets reach only the two steps that run the stack program.
        env:
          CI_RUNNERS_GITHUB_APP_ID: ${{ secrets.CI_RUNNERS_GITHUB_APP_ID }}
          CI_RUNNERS_GITHUB_APP_KEY_BASE64: ${{ secrets.CI_RUNNERS_GITHUB_APP_KEY_BASE64 }}
          CI_RUNNERS_GITHUB_WEBHOOK_SECRET: ${{ secrets.CI_RUNNERS_GITHUB_WEBHOOK_SECRET }}
          MODE: ${{ inputs.mode || 'routine' }}
          EXCLUDE: ${{ inputs.mode == 'bootstrap' && 'DefaultSecurityGroup' || '' }}
        run: |
          set -euo pipefail
          bun plan-check.ts deploy --stage prod --expect "$MODE" ${EXCLUDE:+--exclude "$EXCLUDE"} \
            --checked "$RUNNER_TEMP/ci-runners-checked-plan.json" \
            | tee "$RUNNER_TEMP/ci-runners-deploy.log"

      # One unsigned request to the webhook: the handler must answer and refuse
      # it with 401. A 403 is Lambda refusing to invoke the function URL, so
      # GitHub could not deliver either: it fails the job. No AWS describe call, so the check adds nothing to the
      # account's EC2 API rate the live scale-up shares.
      # A bootstrap deploy is filtered, so it prints no stack output; the next full deploy checks the webhook.
      - name: Verify the webhook answers and refuses an unsigned event
        if: ${{ inputs.mode != 'bootstrap' }}
        shell: bash
        run: |
          set -euo pipefail
          url="$(grep -o -E '^webhookUrl=https://[a-z0-9]+\.lambda-url\.us-east-1\.on\.aws/' "$RUNNER_TEMP/ci-runners-deploy.log" | tail -n 1 | cut -d= -f2- || true)"
          if [[ -z "$url" ]]; then
            echo "::error::the deploy log names no webhook function URL"
            exit 1
          fi
          status="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "$url")"
          echo "webhook status=${status}"
          [[ "$status" == "401" ]]
```

Open points in the draft for the releasing lane: `plan-check.ts deploy` prints the stack output's webhook URL as one `webhookUrl=<url>` line, which the last step reads (beta.87 has no `alchemy output` command); the unsigned probe passes only on the handler's 401 from `Webhook.program.ts`; a 403 means Lambda refused to invoke the function URL (missing invoke permission), so GitHub could not deliver either, and it fails the job (amended 2026-11-18); the `mode` dispatch input runs cutover step 1a (`bootstrap`: `--exclude DefaultSecurityGroup` on both commands, creates only, no probe) and step 1b (`default-security-group`: exactly that one create); the `paths` filter redeploys the fleet on every library source change, which is intended (the Lambdas are bundled from that source) but means every `@beep/alchemy-github-runners` PR deploys runner code on merge, so those PRs need the same review bar as this package.

Added at the packet gate's GO (2026-11-18), disarmed: the workflow ships in the P5 PR with its job gated on `if: vars.CI_RUNNERS_DEPLOY_ARMED == 'true'`, the pattern `deploy-infra-github.yml` uses, so merging it, a later push and a manual dispatch all skip the job before any step while the variable is unset. The gate sets the variable for cutover step 1, only after the deploy role and environment exist and the orchestrator confirms `BEEP_HEAVY_BURST_MAX=6`; unsetting it disarms again. Its `ci-runner-security` exemption line is added in the same PR.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Do not add the drafted workflow; deploy prod from a gate-run dispatch instead.

### The ci-runners stack does not adopt the shared state role or the GitHub OIDC provider, 2026-11-14

SPEC says `@beep/infra-ci-runners` adopts the GitHub OIDC provider and the shared state role `beep-alchemy-state-rw` (D20, one decision per object). This lane does not declare them. Adopting the state role means declaring its trust policy, and that policy's subjects are added by each stack's bootstrap (`beep-effect-web-prod`, `storybook-prod` and the others as they land); a declaration in this stack would overwrite whichever subjects the declaring lane did not know about, and its `prod` deploy would run with the power to lock every other stack out of the state store. The OIDC provider is an account singleton every deploy role trusts. Both stay bootstrap singletons until one stack owns the list of deploy environments, which is `@beep/infra-github` (D10, it owns the environments) or a small bootstrap stack; the gate decides which. No resource of either kind is in the plan.

Closed by the packet gate ruling of 2026-11-14: the shared state role and the GitHub OIDC provider stay bootstrap singletons outside IaC, as SPEC records them; no stack adopts them, and the SPEC line that had `@beep/infra-ci-runners` adopting them is superseded by this decision.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Declare both in the ci-runners stack with adopt(true), listing every deploy environment subject in the role's trust policy.

### Runners keep the live IMDS post-install; the runner permissions boundary is new and narrowed, 2026-11-14

Runners keep the live fleet's post-install unchanged: the toolbelt fallback (git, unzip, zip, jq on an unbaked image), the per-job `ACTIONS_RUNNER_HOOK_JOB_STARTED` IMDS hook, and the fail-closed IMDS workload boundary that wraps `/opt/actions-runner/run.sh`, disables IMDS on the instance before the runner accepts a job and powers the instance off when the runner exits. `src/RunnerBootstrap.ts` holds the three scripts byte for byte as `infra/src/CiFleetController.ts` defines them, before that file's Terraform HCL escaping (the composite passes the script through unescaped). The composite's user data has the same order the module had (extract runner, post-install, fetch the JIT config from SSM while IMDS still works, delete it, start `run.sh` as `ec2-user`), so the shim lands where it did. Because IMDS is off once the runner starts, the composite's exit trap cannot terminate the instance through the API; the shim's power-off and the template's `terminate` shutdown behaviour do it, as on the live fleet.

IAM on each pool's runner role:

- Managed policy `beep-fleet-<stage>-runner-imds-disable`: the live document, `ec2:ModifyInstanceMetadataOptions` on the caller's own instance only while its endpoint is enabled.
- Permissions boundary `beep-fleet-<stage>-runner-boundary`, new and owned by the stack instead of reusing the operator-made `beep-ci-fleet-boundary`: allow `ec2:*`, `ssm:GetParameter`, `ssm:DeleteParameter`, `s3:GetObject`, `kms:Decrypt`, `sts:GetCallerIdentity`; deny `iam:Create*`, `iam:Put*`, `iam:Attach*`, `iam:Delete*`, `iam:Update*`; deny `ec2:ModifyInstanceMetadataOptions` once the endpoint is disabled. The live boundary was a ceiling for every module role (Lambdas included: logs, SQS, events, DynamoDB, metrics, `iam:PassRole` to `beep-ci`/`beep-ovf` roles); in the composite the Lambda roles get least-privilege `bind` policies of their own, so the boundary only needs to cover the runner, and drops `iam:PassRole`, which a runner never uses.

The scripts duplicate the Pulumi source until the old program is deleted at cutover; the duplicate goes away with `infra/`.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Drop postInstall and the two runner policies from declareCiRunners, or point runnerPermissionsBoundaryArn at beep-ci-fleet-boundary.

### New runner labels beep-fleet-heavy and beep-fleet-overflow; the live runner groups are reused, 2026-11-14

The new pools register with new labels, `beep-fleet-heavy` and `beep-fleet-overflow`, and the live runner names are not reused (`beep-fleet-heavy-`, `beep-fleet-ovf-` prefixes). With bidirectional label matching a job reaches a pool only when its `runs-on` labels equal the pool's, so during the overlap no existing job can be picked up by the new fleet, the live fleet never sees a new-label job, and no job launches two runners. Moving a workflow to the new fleet is then one reviewed `runs-on` edit per job (cutover decision), and moving it back is the revert of that edit.

The runner groups are the live org groups, `beep-ec2-heavy` and `beep-shard-overflow` (both exist, `restricted_to_workflows: true`, visibility `selected`, read 2026-11-14 with `gh api orgs/beep-effect/actions/runner-groups`). They stay outside IaC (decision of 2026-11-09). Because they are restricted to selected workflows, a proof job on the new fleet must run in a workflow already on each group's allowed list, or the operator adds the proof workflow to the list; that is an org setting the operator owns.

End state (gate ruling 2026-11-14): the new labels stand for the overlap; whether the workflows end on them (option A) or the pools are relabelled to the live names after the old fleet is destroyed (option B) is settled with the orchestrator at release. Both options, their costs and the full list of label readers are in the cutover decision.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Set PoolSettings.label back to beep-ec2-heavy and beep-shard-overflow in productionConfig.

### Personal ci-runners stages launch nothing and register repository runners only, 2026-11-14

A personal stage (`dev-$USER`; since 2026-11-18 the stage name must be canonical, so `dev_$USER` is refused by `requireDistinctStage`) deploys the same graph as `prod` under its own names, but by default it cannot run or register a runner anywhere:

- Every pool cap is 0, so scale-up never launches; the webhook's repository allow list is empty, so it drops every event.
- Runners register as repository runners (`runnerType: "Repo"`), never organization runners, so even a rehearsal cannot put a runner into the org groups `beep-ec2-heavy` or `beep-shard-overflow` that production jobs use.
- The App credentials are placeholders (`unset`) whatever the environment holds; `stageCredentials` reads the three `CI_RUNNERS_GITHUB_*` variables only for `prod` and for a rehearsal, so a stray variable on a workstation never reaches a personal fleet.
- The names are fenced from the live fleet (physical-names decision). The reaper and the termination watcher both match the stage's own pool environments exactly (`beep-fleet-<slug>-heavy`, `beep-fleet-<slug>-overflow`). The watcher matched by prefix until 2026-11-18, which would have let `dev-a`'s watcher act on `dev-a-b`'s runners; it now takes the exact list, and its retry path re-reads the instance and checks the same list before deregistering.
- The account guard (`requireDeployTarget`) and the `CI` guard on `prod` run first.

Rehearsals that launch runners are deferred (amended 2026-11-18). During the overlap the Spot budget reserves the whole quota (live fleet at burst cap 6 plus the `prod` overlap caps), so a launching rehearsal is refused at decode, and the procedure below cannot run until an approved configuration explicitly allocates rehearsal capacity, after the live fleet is destroyed. The no-rehearsal plan (`bunx alchemy plan --stage "dev-$USER"`) stays available. When enabled, a rehearsal opts in with `CI_RUNNERS_REHEARSAL_REPOSITORY=<owner>/<repo>`, a sandbox repository other than `beep-effect/beep-effect` (the schema refuses that one). It then needs the App credentials, each pool may launch one repository runner for that repository alone, and the Spot budget still reserves the live fleet and the `prod` overlap caps. The credentials come only through `op run` from references, never files or arguments, for example:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/ci-runners
CI_RUNNERS_REHEARSAL_REPOSITORY=<owner>/<sandbox> \
CI_RUNNERS_GITHUB_APP_ID=op://<vault>/<item>/<app-id field> \
CI_RUNNERS_GITHUB_APP_KEY_BASE64=op://<vault>/<item>/<base64 key field> \
CI_RUNNERS_GITHUB_WEBHOOK_SECRET=op://<vault>/<item>/<rehearsal webhook secret field> \
  op run -- bunx alchemy deploy --stage "dev-$USER" --env-file /dev/null
```

The App must be installed on the sandbox repository, and the sandbox needs a repository webhook (`workflow_job`) pointing at the stage's function URL with the rehearsal secret. Which App and which references to use is an open question for the gate (cutover decision); no rehearsal was run by this lane.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Give personalConfig the production caps, runnerType Org and allow list, and let stageCredentials read the environment in every stage.

### CI runners personal-stage plan: 66 to create, 9 binding changes, no EC2 reads, 2026-11-14

Personal-stage plan, read-only, run once (budget: at most two) from `packages/tooling/infra/ci-runners` on 2026-11-14 with the aws-vault session exported and no `CI_RUNNERS_*` variable set: `bunx alchemy plan --stage "dev_$USER" --env-file /dev/null`. No deploy, no `--yes`.

Result: exit 0 in 3.6 s, `Plan: 66 to create, 9 binding changes`; 0 update, 0 replace, 0 delete, 0 orphan, 0 adopt. The 66 creates by area: network 18 (VPC, default security group, internet gateway, route table, default route, 5 subnets, 5 route-table associations, runner security group, flow log, log group), flow-logs role 1, runner policies 2, reaper 3 (function, schedule, permission), fleet composite 42 (KMS key and alias, 3 App parameters, binaries bucket, 2 launch templates, 2 runner roles, 2 instance profiles, 6 queues, 8 functions, 3 event-source mappings, 6 rules, 6 permissions, the sweep). The 9 bindings are the inline policies of the nine functions, the reaper included. Every line of the output passed the pre-deploy gate (`test/support/PersonalPlan.ts` is this log with the stage renamed and timestamps zeroed).

AWS reads: a fresh stage has no state, so the plan read only the credentials resolution and the state bucket; it made no EC2 describe call, in line with the window-5 owner's budget. A plan of an existing stage reads each resource back once per plan (about 25 EC2 describes for the network, templates and security group); the deploy job should plan once per run.

Not verified without a deploy: provider behaviour against real AWS (bundling of the nine Effect Lambdas, the function URL, IAM eventual consistency, flow-log delivery, `CreateFleet` against the launch template), and the destroy ordering beyond the in-memory test.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: None needed: the plan changed nothing; delete this record if it is superseded by a later plan.

### CI runners physical names are beep-fleet-<stage>, fenced from the live beep-ci and beep-ovf objects, 2026-11-14

Every name the `CiRunners` stack pins derives from the stage: `prod` is `beep-fleet-prod`, a personal stage `dev-alice` is `beep-fleet-dev-alice` (stage names must equal their slug since 2026-11-18, so no two stages share names, and neither `beep-fleet-<slug>` nor `beep-fleet-prod` may prefix the other) (`physicalNames` in `packages/tooling/infra/ci-runners/src/Names.ts`). Production names, all new (D12), none adopted:

| Object | Production name |
| --- | --- |
| `RunnerFleet` name, pool `ghr:environment` | `beep-fleet-prod`, `beep-fleet-prod-heavy`, `beep-fleet-prod-overflow` |
| SSM root (App parameters, token and config paths) | `/beep-fleet/prod` |
| KMS alias of the App-secrets key | `alias/beep-fleet-prod-github-app` |
| VPC, internet gateway, route table `Name` tags | `beep-fleet-prod-vpc`, `beep-fleet-prod-igw`, `beep-fleet-prod-public` |
| Subnets (`Name` tags) | `beep-fleet-prod-public-us-east-1{a,b,c,d,f}` |
| Runner security group | `beep-fleet-prod-runner` |
| Flow logs: log group, role (default path `/`, amended 2026-11-18 r4613433026), flow log | `/beep-fleet/prod/vpc-flow-logs`, `beep-fleet-prod-flow-logs`, `beep-fleet-prod-flow-log` |
| Reaper Lambda | `beep-fleet-prod-reaper` |
| Runner IAM policy (path `/beep-fleet/prod/`) | `beep-fleet-prod-runner-imds-disable` (the runner boundary policy is gone: every role carries the bootstrap fleet boundary instead) |

Why these cannot collide: the live fleet's names all start with `beep-ci`, `beep-ovf`, `/beep-ci`, `/beep-ovf`, `/github-action-runners` or `alias/beep-ci` (terraform prefixes, SSM roots, KMS alias, IAM paths, Lambda names, groundwork `beep-ci-runners-*`). `requireFencedNames` refuses any stage whose names start with one of those prefixes or are a prefix of one, before any resource is declared; a test runs it over `prod` and several personal stages. The prefix rule mattered for the composite's termination watcher, which until 2026-11-18 acted on every instance whose `ghr:environment` started with the fleet name: `beep-ci` as a fleet name would have matched the live `beep-ci` environment. Since 2026-11-18 the watcher matches the fleet's pool environments exactly, on both its event path and its queued-retry path. One stage's watcher therefore never acts on another stage's runners, even when one slug prefixes another (`dev-al` and `dev-alice`). Pool names are also dash-free, so `<prefix>-<pool>` names never collide across (prefix, pool) pairs.

Composite names, pinned (gate ruling 2026-11-14): generated names derive from the state's instance ids, so a lost or moved state would mint a second fleet beside the first (the #3133 lesson), and every other `prod` stack of this packet pins its names. `RunnerFleet` gained an optional `namePrefix` (`@beep/alchemy-github-runners/RunnerFleetNames`, lower case, at most 28 characters so the longest name fits Lambda and EventBridge 64, IAM role 64, SQS 80 and S3 63 with a 24-character pool name). `prod` sets it to `beep-fleet-prod`; personal stages leave it unset and keep Alchemy's generated names. Production composite names:

| Resource | Name |
| --- | --- |
| Lambdas (log groups `/aws/lambda/<name>` follow) | `beep-fleet-prod-webhook`, `-ssm-housekeeper`, `-binaries-syncer`, `-termination-watcher`; per pool `beep-fleet-prod-{heavy,overflow}-scale-up`, `-job-retry`, `-scale-down`; the stack's `beep-fleet-prod-reaper` |
| SQS queues | per pool `-build`, `-build-dlq`, `-job-retry`, `-job-retry-dlq`; `beep-fleet-prod-deregister-retry`, `-deregister-retry-dlq` |
| Runner roles and instance profiles | `beep-fleet-prod-{heavy,overflow}-runner` |
| Launch templates | `beep-fleet-prod-{heavy,overflow}` |
| EventBridge rules | per pool `-scale-down`; `beep-fleet-prod-ssm-housekeeper`, `-binaries-syncer`, `-spot-interruption`, `-instance-state-change`, `-reaper` |
| Binaries bucket | `beep-fleet-prod-binaries-832907639880` (S3 names are global, so the account id is appended) |

A test asserts all 40 production names (`test/CiRunners.test.ts`, "pins every production physical name"); library tests cover the prefix, the length limits and the unprefixed default.

Still generated, and why that is safe: the nine Lambda execution roles. `Lambda.Function` (Alchemy 2.0.0-beta.87) names its own role `CiRunners-<logical id>-prod-<instance suffix>` and takes no role or role-name prop. After a state loss a redeploy would create new roles, but every function name is pinned, so the create collides with the existing function instead of standing up a second fleet. Pinning the roles needs a `roleName` prop on `Lambda.Function` (an upstream Alchemy change or a bun patch; candidate for D14). Other ids are AWS-assigned (VPC, subnets, security-group rules, KMS key, event-source mappings, permission statement ids) or already pinned by the stack (SSM paths, KMS alias, policies, flow logs).

Accepted (packet gate ruling, 2026-11-14): the Lambda execution roles stay generated, with no bun patch; the deploy role keeps its `role/CiRunners-*-prod-*` allowance for those nine roles only. The `roleName` prop on `Lambda.Function` is proposed upstream under D14 (in-repo first, upstream when stable) in the packet friction ledger.

Role paths (amended 2026-11-18, #3386 r4613433026). Every fleet role sits at the default path `/`: the runner roles, the flow-logs role and every Lambda execution role. The deploy role's grants and the fleet boundary name roles by prefix (`role/beep-fleet-*`, `role/CiRunners-*`), and an ARN with a path (`role/beep-fleet/prod/beep-fleet-prod-flow-logs`) matches neither, so the flow-logs role lost its `path`. A test enumerates every planned role ARN and every Lambda execution role ARN and checks each against both pattern sets. Only the IMDS policy keeps the path `/beep-fleet/prod/`, which is where `policy/beep-fleet/prod/*` grants reach.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Change physicalNames in packages/tooling/infra/ci-runners/src/Names.ts and redeploy each stage (every pinned name replaces).

### CI runners pre-deploy gate refuses every replace, delete, orphan and unreadable plan line, 2026-11-14

`plan-check.ts` (tested logic in `src/PlanCheck.ts`) is the pre-deploy gate the future deploy job runs between `alchemy plan` and `alchemy deploy`, mirroring the cost-controls `PlanCheck` but failing closed on reading as well as on content:

- It reads the plain plan output (the `[hh:mm:ss.mmm] LEVEL:` prefix and ANSI colours stripped). Lines before the single `Plan:` header are progress and skipped; every non-empty line after it must be a resource line `[fqn] <action>` (optionally with `(mode)` or `(renamed from ...)` notes), a binding line `[fqn/sid] <action|unbind>` directly after its resource, a task line `[fqn] run|drop [action]`, or an indented property line. Anything else is an `UnreadableLine`; zero or several headers is a `MissingPlan`.
- It refuses every `replace`, `delete` and `orphaned` on any resource (`DestructiveAction`), every binding `replace`, `unbind` or `delete` (`DestructiveBinding`, added 2026-11-18), every root id outside the stack's declared roots (`ForeignResource`) and every action task (`ActionTask`). Only `ActionTask` alone does not escalate; every other refusal stops the job for the CI goals driver through the orchestrator.
- It lists each resource with its action, bindings and changed property names, never values.

Amended 2026-11-18 (#3386 review): the gate no longer sits between `alchemy plan` and `alchemy deploy` over a log, because a deploy that re-plans after the check could apply a change set nobody checked. The workflow now runs the checked deploy. `plan-check.ts plan` plans the stage through the Alchemist API, runs these rules on the structured plan and saves the checked plan (per resource: action, binding actions and a SHA-256 of the redacted declared properties; plus stack actions). `plan-check.ts deploy` re-plans under the stage lease, re-checks, and applies that same plan object only when it equals the saved plan; otherwise it fails with `PlanDrift` and writes nothing (`applyIfUnchanged`, `src/CheckedDeploy.ts`). The saved plan also carries, per resource, a SHA-256 of each binding's payload, an HMAC-SHA256 fingerprint of the declared secret values under a random per-plan salt (a changed secret drifts while no secret is stored), and whether an update would finish a pending replacement (refused as `PendingReplacement`). It also carries the cutover expectation (`routine`, `bootstrap`, `default-security-group`), which refuses any change the step does not allow (`UnexpectedChange`). The log reader refuses a log whose rows do not account for the summary counts (`IncompletePlan`), and it reads an indented line only as a property or a continuation inside one (amended 2026-11-18). The log reader stays for personal-stage rehearsals as `plan-check.ts log <file>`. Cutover decision, condition (d).


Summary grammar (amended 2026-11-18). The log reader accepts only Alchemy beta.87's `formatPlanLines` summary: `no resources`, `no changes`, or `, `-joined `N to <action>`, `N binding changes` and `N tasks` parts, each count checked against the rows. The next alchemy bump re-checks beta.87 `formatPlanLines`; a summary grammar change makes the plan check fail closed and blocks deploys until PlanCheck matches it.

Bundle source and starting state (amended 2026-11-18, #3386 r4617469553). Alchemy beta.87 computes a Lambda bundle's hash only inside the provider's `diff` and keeps it out of the plan, so the checked plan cannot carry it. It carries `sourceTree` instead: the git tree id of the checkout, which `readSourceTree` requires to be clean (no uncommitted or untracked file), so `plan` and `deploy` provably bundle the same sources and a different tree is `PlanDrift`. Write `plan --out` outside the checkout (the workflow uses `$RUNNER_TEMP`): a checked plan saved inside it is an untracked file, and the deploy then refuses with "uncommitted changes", by design. Each resource also carries `baselineDigest`, an HMAC under the plan's salt of the state an update or delete starts from (the props last applied and the attributes last observed). Two plans that declare the same props from different starting points therefore differ: a retention change 7 -> 30 is not the same checked operation as 90 -> 30.

App key signing (amended 2026-11-18, #3386 r4617469594). Before planning, `plan-check.ts` signs a GitHub App JWT with the loaded key through the runtime's own signer (distilled GitHub `App.appJwt`, via `appKeyCanSign`), for every stage that holds real credentials. A key that passes the format checks but cannot sign fails with the `ConfigError` "App key cannot sign a GitHub App JWT"; neither the key nor its length appears.

Secret fingerprint (amended 2026-11-18, #3386 driver review). The saved plan carries the random salt and the HMAC-SHA256 fingerprints together, so anyone holding the plan can test guesses offline. That is acceptable only because the production credential loader (`appCredentials` in `src/Credentials.ts`) refuses low-entropy secrets before any plan is computed. Both `plan-check.ts plan` and `plan-check.ts deploy` decode through that one loader, so neither can fingerprint an unchecked value. Its checks:

- The webhook secret has at least 32 characters (`minimumWebhookSecretLength`) from the hex, base64 and base64url alphabet, with at least 10 distinct characters, and does not contain the placeholder. The required format is a generated secret in hex, base64 or base64url (`[A-Za-z0-9+/=_-]`). The assumed alphabet is hex, the narrowest the check admits (16 symbols, 4 bits each), so a generated secret of 32 characters carries 128 bits, and a base64 one of the same length 192. The check cannot measure entropy. It refuses the patterns a non-generated value shows, so the 128 bits rest on the secret having been generated (by GitHub or `openssl rand`). A run of one character, a padded or repeated placeholder, and a value with spaces are refused.
- The App key must decode from base64 to a PEM private-key block of at least 1,000 characters; a 2048-bit RSA key is about 1,700.
- The App id must be a number.

A failure is a `ConfigError` whose message says only "webhook secret is a placeholder", "webhook secret has characters outside [A-Za-z0-9+/=_-]", "webhook secret too weak" (short, or too few distinct characters), "App key is not a PEM private key" or "App id is not a number", never the value or its length.

The App id is low-entropy, so no resource is fingerprinted by it alone. Each resource's HMAC message carries the plan's whole sorted secret material before its own entries, so guessing the App id parameter's fingerprint also needs the App key and the webhook secret. A test over the planned `prod` resources changes only the webhook secret and shows that every fingerprint moves, `Runners/AppId` included.

Residual (a): a `Redacted` value inside a class instance or an Output expression is not fingerprinted (`redactedEntries` walks plain records and arrays only). No secret enters the stack that way today: the App credentials reach the composite as plain `Redacted` props.

Why no destructive allowlist: the network objects and the pools carry live runners and the webhook function URL is the App's delivery target, so a replace or delete is always an operator-reviewed deploy, not a push deploy. Cost-controls allows exactly one rollback delete; this stack has none to allow. Tests run the gate over the recorded personal-stage plan (66 creates, 9 bindings) and over synthetic replace, delete, orphan, unreadable, header and foreign-resource cases.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Replace the workflow's plan and deploy steps with plain alchemy plan and alchemy deploy, then delete src/CheckedDeploy.ts, plan-check.ts and src/PlanCheck.ts.

### The ci-runners reaper keys on the fleet's ghr:environment tags with the live 90-minute TTL, 2026-11-14

The live groundwork stack's reaper (`infra/src/CiRunners.ts`) terminates every instance tagged `beep-ci=runner` older than `ciRunners:reaperTtlMinutes` (90) on a five-minute schedule, as a backstop the guest cannot cancel. The new stack keeps the behaviour and the TTL but ports it to an Effect program over the composite's `Ec2Fleet` service (`src/Reaper.ts`, bundled by Alchemy from `src/internal/lambda/reaper.ts`), D19's pattern, and changes what it keys on:

- It lists instances by `ghr:environment` (the tag scale-up stamps on every runner), one listing per pool environment of its own fleet (`beep-fleet-prod-heavy`, `beep-fleet-prod-overflow`), in states pending, running, stopping and stopped, and terminates those launched more than 90 minutes ago. An instance without a launch time is kept; a failed termination is logged and the pass continues.
- Its role may describe instances and terminate only instances whose `ghr:environment` is one of those values. The live reaper's `beep-ci=runner` filter is not used: composite runners carry only `ghr:*` instance tags, and keying on `ghr:environment` means neither reaper can touch the other fleet's instances during the overlap.
- One pass costs two `DescribeInstances` pages every five minutes (the live reaper costs one); scale-down already lists each pool every minute.

The reaper's function name is pinned (`beep-fleet-<stage>-reaper`) in every stage; in `prod` its schedule rule is pinned too (`beep-fleet-prod-reaper`); the invoke permission is a statement inside the function's own policy.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Remove declareReaper from src/CiRunners.ts and redeploy; scale-down and the termination watcher remain.

### CI runners typed configuration carries the live pool values and a Spot vCPU budget the schema enforces, 2026-11-14

`CiRunnersConfig` (`src/Config.ts`) is the stack's typed configuration, decoded before any resource and carrying the live values as `productionConfig`:

- Pools, from `infra/src/CiRunnerPool.ts` and `infra/src/CiFleetController.ts`: heavy, seven 64 GiB types (`r7a.2xlarge`, `r7i.2xlarge`, `r6i.2xlarge`, `m7a/m7i/m6a/m6i.4xlarge`), cap 2, runner group `beep-ec2-heavy`; shard overflow, the three 8-vCPU types, cap 48, group `beep-shard-overflow`. Both Spot only, `capacity-optimized`, bidirectional label match, ephemeral JIT runners, job-queued check off, job retry 2 attempts / 120 s / backoff 2, minimum running time 5 minutes (the `RunnerPool` defaults already equal the live module inputs).
- Image: the baked AL2023 AMI `ami-07af50c345b5ba065` (`ciFleetController:amiId` in `infra/ci-runners/Pulumi.production.yaml`, last written by `beep runners bake` per `infra/ci-runners/runner-image.json`), root `/dev/xvda`, 100 GB gp3, 3000 IOPS, 250 MB/s, encrypted, EBS-optimized, public IP, run as `ec2-user`. The id is pinned in source, not read from an SSM parameter, so an unrelated deploy never moves the image; the live `/beep-ci/controller/runner-ami-id` parameter is not carried over.
- Network: a new VPC `10.89.0.0/16` (live is `10.88.0.0/16`), five `/20` public subnets in the live zones `us-east-1a,b,c,d,f`, flow-log retention 14 days.
- Reaper TTL 90 minutes; region `us-east-1`; account `832907639880`.
- Spot budget: the schema refuses a stage whose worst-case Spot vCPU exceeds the account quota (512, "All Standard Spot Instance Requests", read 2026-11-14). A phase field chooses the caps: `overlap` (beside the live fleet) runs heavy at 1 and overflow at 2 and reserves 416 vCPU for the live fleet (heavy 2 × 16 + overflow 48 × 8), committing 448; `primary` (after the workflows move) runs the live caps and reserves nothing. `prod` starts in `overlap`. The 64 vCPU left in the overlap means a live heavy burst may go to at most 6 VMs until the move; the live burst cap of 8 is already the whole quota with the live overflow pool at 48. Amended 2026-11-18 (review of #3386): the reserve is now 480, the live fleet at the agreed burst cap of 6 (heavy 6 × 16 + overflow 48 × 8), so the overlap commits exactly 512 and the budget check itself refuses a larger overlap cap; a personal stage reserves 480 + 32 = 512, so a rehearsal that launches anything is refused (a `ConfigError`) while the overlap lasts.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Edit productionConfig in src/Config.ts; drop the Spot budget check by removing the S.check on CiRunnersConfig.

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

### Cost controls Pulumi cutover executed: live verified, old pair destroyed, 11 state entries removed, 2026-11-14

Executed by the packet gate session, attended with the orchestrator, on 2026-11-14, in the live-first order (decision "Cost controls cutover goes live first, Pulumi destroy second"). Facts from the gate session.

**Live deploy (steps 1 and 2).** #3320 merged 2026-11-14T05:15:40Z as `1f34884a98c`; `Deploy cost controls` run 43560670140 succeeded. Plan `1 to create, 1 to update` (`AnomalyAlerts` create, `MonthlyBudget` update), the nine singletons `noop`, the pre-deploy gate printed `deploy may run`. Account read afterwards: four budget notifications with one EMAIL subscriber each, `beep-account-anomaly-alerts` DAILY, budget actions 0.

**Pulumi cutover (steps 3 to 5) on `beep-ci-runners/production`.**

- BEFORE export 05:20Z: 367 resources, 3,396,936 bytes, sha256 `2c5933f882423d165f2a7469d85131305369bedf3d4ec8ef44dccc567291d00c`, byte-identical to the 2026-11-13 archive.
- Unprotect 05:20:47Z: 12 resources.
- Targeted destroy preview: exactly 2 deletes (JSON step list `delete=2, same=1`); no `--target-dependents`, no `--refresh`, no `--run-program`. Real destroy 05:22:15Z to 05:22:20Z: 2 deleted (`Monthly Budget`, `beep-account-daily-anomalies`).
- State deletes 05:22:55Z to 05:23:19Z: 11, each rc 0.
- AFTER export 05:24Z: 354 resources, 3,329,126 bytes, sha256 `07fb8a58b4187a51bc1eca31e64f60e7dea395d980ec2bc7f26427de9314b326`, 0 pending operations.
- Comparison: BEFORE minus AFTER is exactly the 13 `AccountCostControls` URNs; nothing added. The other 354 resources are content-identical apart from three serialization effects of the CLI's state rewrite: 75 secret fields re-encrypted; empty-list entries dropped from `propertyDependencies` on 82 resources (non-empty entries and `dependencies` identical); 27 resources reordered in the snapshot list with 0 dangling and 0 out-of-order references.
- `shard-overflow-preflight` ok at 05:24:47Z. Account after: budget `beep-account-monthly-cost` only, subscription `beep-account-anomaly-alerts` only, the services monitor present, six tags Active, both enrollments Active.

**Freeze.** A freeze on `pulumi preview` and `pulumi up` for `beep-ci-runners/production` started 2026-11-14T05:22:55Z and ends after the component-removal PR (step 6, this lane) merges and `pulumi preview --expect-no-changes --stack organization/beep-ci-runners/production` is clean: until then the program still declares the component, and a preview would plan all thirteen objects again.

**Step 6.** The component-removal PR deletes `AccountCostControls` from the program (`infra/src/internal/ci-runners-entry.ts`, infra/src/AccountCostControls.ts (removed in #3366) and its test) and the `accountCostControls:` keys `expectedAccountId`, `monthlyBudgetUsd` and `anomalyImpactUsd` from `infra/ci-runners/Pulumi.production.yaml`. It keeps `accountCostControls:notificationEmailAddresses` and moves `decodeNotificationRecipients` unchanged into `infra/src/NotificationRecipients.ts`, because the AWS turbo cache's throttle alarm reads both. With the 13 URNs already gone from state, the program's desired graph after this PR equals the AFTER state, so the diff against the stack is nothing; `preview` being frozen, that is proven by reading the program diff (only the component's import and construction removed; every other declaration and the alarm's config read untouched). It merges only after `live` has been green for 24 hours (not before 2026-11-15T05:18Z).

**Archives.** Both exports stay under `~/.local/state/beep/infra-archives/pulumi-exports/` until the packet closes, not just until the first clean `pulumi preview --expect-no-changes --stack organization/beep-ci-runners/production`: the rollback imports the BEFORE export, or splices its 13 URNs, and compares the current state with the AFTER export.

Lane goals/infra-alchemy-rebuild-p3-cost-controls-pulumi-removal

Reverse: The 'after step 4' and 'after step 6' rollback paragraphs of decision 'Cost controls cutover from Pulumi' (disarm the Alchemy prod stage; compare a fresh export with the AFTER archive; import the BEFORE archive if unchanged, else splice its 13 URNs into the current export and import that; refresh, preview two creates, targeted up with --target-dependents; revert the removal PR first if it has merged).

### Cost controls cutover from Pulumi: destroy two URNs, state-delete eleven, no pulumi up, 2026-11-14

Rulings (packet gate session, 2026-11-14): the PR that removes the `AccountCostControls` component from the Pulumi program must merge before any later `pulumi preview` or `pulumi up` of `beep-ci-runners/production`, and it keeps `accountCostControls:notificationEmailAddresses` for the turbo-cache throttle alarm. The runner fleet and the AWS turbo cache in that stack are under a CI measurement window until the 2026-11-20 verdict, so every Pulumi step below is state-only or target-only, and the packet gate session tells the orchestrator before running them. The passphrase comes only through `op run` from the 1Password field `PULUMI_ENCRYPTION_PASSPHRASE` of item `BEEP_SECRETS` in vault `BEEP_SECRETS` (verified by the gate 2026-11-14); it never goes in a file, an argument or a log.

Procedure for the launching session; this lane ran none of it except the export. It touches only the `AccountCostControls` subtree of `beep-ci-runners/production` (backend `s3://oip-law-pulumi-state`, secrets provider `passphrase`), never runs the program (`pulumi destroy` and the `pulumi state` commands read state only; never pass `--run-program`), and needs no `pulumi up`. The same stack holds the live runner fleet and the AWS turbo cache, and a CI measurement window is running: no other URN is named, and `pulumi destroy` runs only with explicit `--target`s and without `--target-dependents`.

Archive: `pulumi stack export --stack production` taken 2026-11-13 at `~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-13.json` (3,396,936 bytes, sha256 `2c5933f882423d165f2a7469d85131305369bedf3d4ec8ef44dccc567291d00c`, deployment version 4, last update 2026-11-13T13:44:48-06:00, 367 resources, 0 pending operations). Re-export immediately before step 1 if the stack's last update is newer than that, and record the new file's size and sha256 in a follow-up decision; the latest export taken before step 1 is the reversal (it was the BEFORE export `~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-14T0520Z-before.json`, 367 resources; the AFTER export taken later has none of the 13 AccountCostControls URNs).

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
6. In a later PR, merged only after the `live` deploy has been green for 24 hours, delete `AccountCostControls` from `infra/src/internal/ci-runners-entry.ts`, infra/src/AccountCostControls.ts (removed in #3366) and its test, and the `accountCostControls:` keys from `Pulumi.production.yaml` except `notificationEmailAddresses`, which the turbo-cache throttle alarm keeps reading. That PR merges before the next `pulumi preview` or `up` of this stack: until then the program still declares the component, and a preview would plan to create all eleven resources again (the monitor create would hit the one-per-account quota). After it, the recipient list lives in two places only: that Pulumi config key and the `cost-controls-prod` GitHub secret.

Rollback, by stage:

- Before step 4 (the Pulumi pair is still live): one PR sets `notifications` back to `silent`. Its plan deletes the stack's own `AnomalyAlerts` subscription, the single delete `checkPlan` allows, by logical id and by the `delete` action only; the budget's notifications update to none. Every other delete, every replace and every orphan is still refused, and the nine adopted settings still may not change, so the window-5 condition is not weakened. Check: the gate step passes, and `aws ce get-anomaly-subscriptions` no longer lists `beep-account-anomaly-alerts`.
- After step 4, before the component-removal PR (step 6) merges, restore the Pulumi budget and subscription. Every command names the stack in full; `...` below stands for the `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE` prefix of `op run`, and `A=~/.local/state/beep/infra-archives/pulumi-exports` is set first. First take the Alchemy prod stage back to `silent` (first case) so only one set mails and the Alchemy stage is disarmed before Pulumi state changes. Then check whether the stack moved after the AFTER export: `... op run -- pulumi stack export --stack organization/beep-ci-runners/production --file "$A/beep-ci-runners-production-<UTC>-rollback-current.json"` (this is also the archive of the current state; record its size and sha256 in a decision), and compare it with `$A/beep-ci-runners-production-2026-11-14T0524Z-after.json` (354 resources, sha256 `07fb8a58b4187a51bc1eca31e64f60e7dea395d980ec2bc7f26427de9314b326`) on the deployment version and checkpoint (`jq '.version, .deployment.manifest'`) and on the resource URN set (`jq '[.deployment.resources[].urn] | sort'`); bytes are not comparable, because the CLI re-encrypts secrets on every state rewrite.
  - Unchanged since AFTER: import the BEFORE export, `... op run -- pulumi stack import --stack organization/beep-ci-runners/production --file "$A/beep-ci-runners-production-2026-11-14T0520Z-before.json"` (367 resources, sha256 `2c5933f882423d165f2a7469d85131305369bedf3d4ec8ef44dccc567291d00c`; the AFTER export has none of the 13 AccountCostControls URNs).
  - Moved since AFTER: never import BEFORE wholesale, because it would roll back every later change to the runner fleet and the turbo cache. `pulumi import` cannot bring the pair back either: the budget and subscription were destroyed in AWS, so there is nothing to adopt. Splice the 13 URNs into the current state instead: `jq --slurpfile before "$A/beep-ci-runners-production-2026-11-14T0520Z-before.json" --slurpfile after "$A/beep-ci-runners-production-2026-11-14T0524Z-after.json" '([$after[0].deployment.resources[].urn]) as $kept | ($before[0].deployment.resources | map(select(.urn as $u | $kept | index($u) | not))) as $acc | .deployment.resources += $acc' "$A/beep-ci-runners-production-<UTC>-rollback-current.json" > "$A/beep-ci-runners-production-<UTC>-rollback-spliced.json"`. It keeps every current resource as it is and appends the 13 in BEFORE's order: the component comes before its children, and everything they reference (the stack root, the providers) is already earlier in the list, so parents precede children. Check before importing: the spliced file has the current count plus 13, and its URN set minus the current one is exactly the 13 `AccountCostControls` URNs. Then check the spliced checkpoint's own references: every resource's `parent`, each entry of `dependencies` and `propertyDependencies`, and the URN part of `provider` (`urn::id`) must name a resource earlier in the list. `jq '.deployment.resources as $r | ($r | to_entries | map({key: .value.urn, value: .key}) | from_entries) as $ix | [$r | to_entries[] | .key as $i | .value | ([.parent] + (.dependencies // []) + ([(.propertyDependencies // {})[]] | add // []) + [(.provider // null | if . == null then null else split("::") | .[:-1] | join("::") end)]) | map(select(. != null and . != "")) | map(select(($ix[.] // $i) >= $i)) | length] | add // 0' "$A/beep-ci-runners-production-<UTC>-rollback-spliced.json"` prints the count of violations (a missing URN counts too); on any non-zero count, stop and do not import. Only at 0: `... op run -- pulumi stack import --stack organization/beep-ci-runners/production --file "$A/beep-ci-runners-production-<UTC>-rollback-spliced.json"`.
  - Either way, the imported state still lists the two objects step 4 destroyed. `... op run -- pulumi refresh --stack organization/beep-ci-runners/production --target "$U1" --target "$U2" --yes` drops them from state. `... op run -- pulumi preview --stack organization/beep-ci-runners/production --target "$U1" --target "$U2" --target-dependents` must show exactly two creates. `... op run -- pulumi up --stack organization/beep-ci-runners/production --target "$U1" --target "$U2" --target-dependents --yes` recreates them. Check: `aws budgets describe-budgets` lists `Monthly Budget` and `aws ce get-anomaly-subscriptions` lists `beep-account-daily-anomalies`. The singletons need nothing: neither tool changed their status.

- After step 6 merged: `pulumi up` and `preview` build their desired graph from the current program, which no longer declares the component, so first revert the component-removal PR (restoring `AccountCostControls` in the program and its config keys) and merge the revert, then run the rollback above from its stack-moved check: the disarm, the export and comparison, the BEFORE import or the splice, then the refresh, preview and targeted `up`. The orchestrator is told first, as for every step here.

Timing: steps 3 to 5 run right after step 2 is verified; the duplicate mails last only until step 4. The component-removal PR (step 6) does not merge until the `live` deploy has been green for 24 hours.

Lane goals/infra-alchemy-rebuild-p3-cost-controls

Reverse: Disarm the Alchemy prod stage (back to silent). Export organization/beep-ci-runners/production and compare it with the AFTER export; if unchanged, pulumi stack import the BEFORE export ~/.local/state/beep/infra-archives/pulumi-exports/beep-ci-runners-production-2026-11-14T0520Z-before.json, otherwise splice its 13 AccountCostControls URNs into the current export and import that. Then pulumi refresh and pulumi up --target-dependents the budget and subscription URNs (after step 6, revert it first).

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

### First armed OipWeb deploy failed on a sensitive variable edit, 2026-11-14

**What happened.** Before arming, the packet gate archived both Pulumi stacks of `opip-web`:
- `staging`: 79,266 bytes, sha256 `23c44a9f…1b4a93`, 18 resources, 0 pending operations.
- `production`: 101,138 bytes, sha256 `465ab3f9…81c803`, 22 resources, 0 pending operations.

The archives are kept off-repo under the operator's infra archive directory. The gate then armed the
deploy job: `OIP_WEB_INFRA_DEPLOY=enabled` at 2026-11-14T10:29:44Z, and `workflow_dispatch` run
43585534113 on `main` `b7d3c9d99a4`.

Staging went as follows:
- The plan was `Plan: 6 to create, 3 to adopted`, as predicted, and the guard passed.
- 8 of 9 resources applied: the project and both DNS records adopted, the two domains created with
  no change, the new `oip-law-web-assets-staging` bucket created, and `NEXT_DISABLE_PWA` and
  `CRM_HUBSPOT_ACCOUNT_ID` rewritten in place.
- `EnvHubSpotServiceKey` failed with `BadRequest: You cannot change the key of a Sensitive
  Environment Variable.`
- The job stopped before prod.

The gate disarmed at 10:31:44Z (variable deleted). Afterwards all six hostnames served normally,
Alchemy rows existed only under `OipWeb/staging/`, the prod bucket was absent, and Pulumi was
untouched.

**Cause.** `Vercel.EnvVar`'s in-place edit (`PATCH /v9/projects/{id}/env/{envId}`) sent the
variable's `key`. The real API refuses any `key` on a sensitive variable, even the identical one.
The evidence test that cleared arming ("one `PATCH Env`, no delete, no duplicate") ran the real
provider against an in-memory Vercel API that accepted the body. The fake was more permissive than
the service it models, so a green test proved nothing about this write.

**Fix (this lane).**
- The in-place edit now sends only what Vercel lets an edit change:
  - the value, always, because it cannot be read back and an edit is how adoption and rotation
    reach Vercel;
  - the targets and git branch, only when they differ from what is stored;
  - a declared comment.
- It never sends `key` or `type`. A key change is now a create-first replacement (review round 1
  on #3339): the new variable is created before the old one is deleted, so a failed create leaves
  the old one in place. Only a type change on the same project and key deletes first.
- The fake refuses what the real API refuses: any `key` on a sensitive variable, a non-sensitive
  `type` on a sensitive variable, and a `gitBranch` without the `preview` target. It also records
  each PATCH body's fields so tests assert them.

**Rehearsal on the real API.** Personal stage `dev_elpresidank`, scratch objects only, all
destroyed afterwards:
- The test-only stack `apps/oip-web/test/live/rehearsal.alchemy.run.ts` ran:
  1. A seed create.
  2. A state delete, then a re-deploy with every object adopted. This is the live stages' create
     path over existing variables, for encrypted, sensitive `valueFrom` and plain alike.
  3. A target change on the plain variable.
  4. A rotation of the sensitive value.
  5. A target change on the sensitive variable.
- The staging re-run shape ran separately: the variable's row was dropped while the project's row
  stayed, so the plan was `1 to adopted`, and the plan after it had no changes. A failed create does
  not delete its row, though: it leaves a `creating` checkpoint, which plans as `create` (below).
- The real `OipWeb` personal stage was deployed and destroyed, covering its project, two variables
  and bucket.
- Every write succeeded in place: same ids, no duplicates, stored types unchanged.

**The re-run.** After #3339 merged (`6e393d55c29`, 11:44:22Z) the gate re-armed at 11:45:21Z, and run
43591525409 succeeded on both stages:
- staging: `Plan: 1 to create` (`[EnvHubSpotServiceKey] create`, the eight others `noop`), then `Done: 1 succeeded`;
- prod: `Plan: 8 to create, 5 to adopted`, then `Done: 13 succeeded`.

Staging printed `create` rather than the probe's `adopted`. Alchemy commits a `creating` checkpoint
without attributes before it calls the provider (`Apply.ts`), the failed call left it in state, and the
planner prints such a row as `create`, deferring adoption to apply time (`Plan.ts`). The probe had
deleted the row instead, a wrong model of a failed create.

After the run, read-only:
- All six live variables kept their pre-arming ids, types and targets, with one variable per key.
- The six domains, six DNS records and both `*.vercel.app` domains were unchanged.
- No log line carried a value or a `__redacted__` envelope.
- Every `OipWeb` state row is `created` or `updated`.

**Rule from now on.** A provider write path is exercised against the real API on a scratch stage
before any live stage is armed. Fake-only evidence is not enough for a first arm. A fake encodes
only the API rules someone has observed or confirmed in the docs, and each such rule is pinned by
a test.

Lane goals/infra-alchemy-rebuild-p4-oip-web-envvar-fix

Reverse: Revert the EnvVar edit-field change; the rehearsal stack is test-only and can be deleted

### infra-github carries the live beep-reviewer check; the reviewer CLI stays the only switch, 2026-11-14

Window-5 requirement 2 (window-5 owner via the packet gate, 2026-11-14) asked for one of: (a) the stack does not own the `beep-reviewer` required check, or (b) it reads the live state of that check and carries it through unchanged. Chosen: (b). `GitHub.Ruleset` writes the ruleset as a whole body, so (a), leaving the check out of the body, would delete it on every deploy; carrying it is what the resource model supports cleanly. The workflow captures ruleset 10240248 once (`gh api repos/beep-effect/beep-effect/rulesets/10240248`) and hands the file to the stack as `INFRA_GITHUB_LIVE_RULESET`; `liveReviewerCheck` reads the `beep-reviewer` entry with its App binding and `requiredChecks` appends it after the 15 configured checks, where `beep reviewer ruleset require` puts it. Stack tests prove a live check survives a deploy present (bound to App 5321138) and absent. This supersedes the implementation of the packet-gate ruling 'beep reviewer ruleset edits the stack configuration once the stack is armed' (2026-11-13): with the live check carried, a committed `reviewerCheck` would be ignored and an armed CLI that edits it would silently do nothing, so the committed flag is removed and `beep reviewer ruleset release|require` keeps its direct edit of the live ruleset in every state. The hazard that ruling guarded against (a deploy writing back a stale switch position) is narrowed by the carry and the write guard below, not removed: a deploy does not undo the operator's switch except inside the write guard's single GET-to-PUT round-trip, which the runbook practice (no switch flips while a `Deploy infra-github` run is in progress) and its recovery step (read ruleset 10240248 after an overlapping run and re-apply the switch if it is not in the intended state) cover. Closing the capture-to-write window (window-5 owner via the packet gate, 2026-11-14): the body is built from a capture, so a `release` or `require --apply` landing between capture and write would be overwritten. Built in the provider, not as a workflow step: `src/RulesetWriteGuard.ts` registers a provider for `GitHub.Ruleset` directly (a direct registration takes precedence over the `GitHub.providers()` collection) that wraps the shipped `RulesetProvider`. For the ruleset named like the capture, its `reconcile` re-reads ruleset 10240248 through the same distilled client, decodes it with the guard's strict decoder, compares it with the capture over the guard's server-fields-excluded fields, and fails with `RulesetChangedSinceCapture` before the PUT if anything differs, so the gap is one API round-trip. A capture without an id fails closed (`CaptureWithoutId`). Tests (`test/RulesetWriteGuard.test.ts`): live equal to the capture writes (one PUT); `beep-reviewer` required, or released, after the capture refuses and sends no PUT. The runbook states that the switch is not flipped while a `Deploy infra-github` run is in progress and that a refused run is re-run with a fresh capture. `deploy-infra-github.yml` is unchanged by this. Exact guarantee (beep-reviewer round 2, 2026-11-14): the write guard closes the capture-to-PUT window except for the single GET-to-PUT round-trip; a switch flipped inside that round-trip is overwritten and not detected; the post-deploy check fails when the ruleset differs from what the deploy wrote, which means it moved after the write and nothing was undone. Window-5 owner ruling (2026-11-14): the write guard plus the runbook practice (the switch is not flipped while a `Deploy infra-github` run is in progress, with the recovery read-and-re-apply after any overlapping run) is sufficient for arming; no conditional update or further deploy-side refusal is required. Later improvement, not built: GitHub's ruleset `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` documents no `If-Match` or other precondition parameter (checked in the REST API description, 2026-11-14), and the ruleset GET returns only a weak `ETag` meant for conditional GETs (`If-None-Match`, 304); if GitHub ever honours a precondition on the PUT, the wrapped provider could send it and close the round-trip.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Re-add a committed reviewerCheck flag to MainRuleset and the armed-mode CLI branch (ReviewerRulesetOwner.ts in 0b8d6385b34), and drop the carry in requiredChecks.

### InfraGithub deploys through a stack-scoped OIDC role, beep-alchemy-infra-github-deploy, 2026-11-14

Ruling by the packet gate session, 2026-11-14: like the other stacks' deploy jobs, `Deploy infra-github` assumes a stack-scoped role, not the shared `beep-alchemy-state-rw`. The variable name (`ALCHEMY_STATE_ROLE_ARN` on `infra-github-prod`) and the workflow do not change; only the role it names does. The runbook step that added `repo:beep-effect/beep-effect:environment:infra-github-prod` to the trust policy of `beep-alchemy-state-rw` is dropped. The role is not created yet; the commands below are for the bootstrap, on the gate's word.

What the store code touches (read at Alchemy 2.0.0-beta.87; `AWS.state({ backend: "s3", … })` in `alchemy.run.ts` sets no `prefix`; the stack name is `InfraGithub`):

- Bucket `alchemy-state-832907639880-us-east-1-an` (`createStateBucketName(accountId, region)`).
- Bucket configuration, `ensureStateBucket` in `@alchemy.run/aws` `src/StateStore/State.ts`. It calls `headBucket` (`s3:ListBucket`), then reads versioning, encryption, the public access block and ownership controls. It writes them only on drift. Under this role a drift therefore fails the deploy instead of being converged, which is the intended fail-closed behavior: the bucket is a bootstrap singleton.
- Objects, `makeBucketState` in `alchemy` `src/State/BucketState.ts`. Every key is `{prefix}{stack}/{stage}/…`, so `InfraGithub/prod/{fqn}.json`, `InfraGithub/prod/__stack_output__.json` and `InfraGithub/prod/__lease__.json`:
  - reads: `GetObject`;
  - writes: `PutObject`, including the conditional lease write;
  - deletes: `DeleteObject` and the batch `DeleteObjects`, which S3 authorizes as `s3:DeleteObject` per key; stale rows and the lease release.
- Listings (`ListObjectsV2`, `s3:ListBucket`) use the stage prefix. Stack and stage enumeration lists bucket-level names but reads no object.
- No key outside `InfraGithub/` is read, written or deleted.
- Encryption is SSE-KMS with the AWS-managed `aws/s3` key. Its key policy grants use through S3 to principals in the account, so the role needs no KMS statement.

Trust: the existing provider `token.actions.githubusercontent.com`, audience `sts.amazonaws.com`, subject exactly `repo:beep-effect/beep-effect:environment:infra-github-prod`. Session length one hour.

Commands (operator workstation, `AWS_PROFILE=elpresidank-vault`), then the GitHub side:

```sh
export AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1
D="$(mktemp -d)"
cat > "$D/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"arn:aws:iam::832907639880:oidc-provider/token.actions.githubusercontent.com"},"Action":"sts:AssumeRoleWithWebIdentity","Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com","token.actions.githubusercontent.com:sub":"repo:beep-effect/beep-effect:environment:infra-github-prod"}}}]}
JSON
cat > "$D/policy.json" <<'JSON'
{"Version":"2012-10-17","Statement":[
{"Sid":"StateBucketRead","Effect":"Allow","Action":["s3:ListBucket","s3:GetBucketLocation","s3:GetBucketVersioning","s3:GetBucketOwnershipControls","s3:GetBucketPublicAccessBlock","s3:GetEncryptionConfiguration"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an"},
{"Sid":"StateObjects","Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/InfraGithub/*"}]}
JSON
aws iam create-role --role-name beep-alchemy-infra-github-deploy \
  --assume-role-policy-document "file://$D/trust.json" --max-session-duration 3600 \
  --description "GitHub OIDC deploy role for the InfraGithub Alchemy stack (infra-github-prod)" \
  --tags Key=beep:owner,Value=infra-alchemy-rebuild Key=beep:bootstrap,Value=infra-github-deploy
aws iam put-role-policy --role-name beep-alchemy-infra-github-deploy \
  --policy-name infra-github-deploy --policy-document "file://$D/policy.json"
aws iam get-role --role-name beep-alchemy-infra-github-deploy --query Role.Arn --output text
rm -r "$D"

gh variable set ALCHEMY_STATE_ROLE_ARN --env infra-github-prod --repo beep-effect/beep-effect \
  --body arn:aws:iam::832907639880:role/beep-alchemy-infra-github-deploy
```

Checks after creation (`aws iam simulate-principal-policy --policy-source-arn <role arn>`):
- `s3:PutObject` on `arn:aws:s3:::alchemy-state-832907639880-us-east-1-an/InfraGithub/prod/x.json` must say `allowed`;
- `s3:PutObject` on `…/CostControls/prod/x.json` must say `implicitDeny`;
- `s3:PutBucketVersioning` on the bucket must say `implicitDeny`.

The role is a bootstrap singleton, like the state role, until `@beep/infra-ci-runners` adopts the OIDC roles.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: gh variable delete ALCHEMY_STATE_ROLE_ARN --env infra-github-prod --repo beep-effect/beep-effect; aws iam delete-role-policy --role-name beep-alchemy-infra-github-deploy --policy-name infra-github-deploy; aws iam delete-role --role-name beep-alchemy-infra-github-deploy

### InfraGithub prod create guard lives in the providers, not in a plan-log step, 2026-11-14

The packet gate asked what refuses an unexpected `create` on `prod`. Nothing did: the
shipped `GitHub.Ruleset` create path POSTs a new ruleset when its name-based read misses,
and the write guard re-read 10240248 and then handed off to that path.

Decision: the guard wraps the `prod` providers (`src/ProdWriteGuard.ts`) and uses an
explicit allow-list (`productionCreateAllowList`, 36 logical ids). `MainRuleset` is not on
it. Off-list creates, any `replace`, a repository create path with no live repository,
`precreate` and `delete` fail with `ProdChangeRefused`. Where the provider has a `read` or
the change is a `replace`, the refusal comes at plan time. Otherwise it comes at the
resource's create path, before its request. The ruleset write guard also refuses a write
not aimed at the captured id.

Why not a plan-log check (cost-controls' `PlanCheck`): `alchemy deploy` plans again
internally and offers no hook between that plan and apply. A check of the separate
`alchemy plan` log would bind a different plan from the one the deploy applies, and it
needs `deploy-infra-github.yml` to save the log, which means asking the operator to approve
the workflow again. The provider guard binds the deploy's own plan and leaves the workflow
byte-identical.

Kinds with no `read` (environments, variables, labels) are refused only when they reach
the create path, after earlier allowed writes in the same deploy may have gone out. For
those kinds the plan-time control is the package test, which runs first in the deploy job.
It plans the committed stack declarations, not a copy of the list, and fails unless the
`create` set equals `productionCreateAllowList` exactly. It also requires every listed id
to be a converge-by-name kind (repository, environment, variable, label), so a kind whose
create path makes a second object cannot be admitted by adding it to both the stack and the
list.

Accepted limit: a removed declaration plans `orphaned`, its deploy sends no mutating
request (tested), and the guard does not refuse it. A removed declaration leaves the live
object in place and unmanaged: removing a live object is a deliberate, attended act outside
the deploy job. Refusing the orphan itself would need the plan-log check above.

Lane goals/infra-alchemy-rebuild-p3-github-plan-guard

Reverse: Drop prodGitHubProviders from alchemy.run.ts and return guardedRulesetProvider(capture) for prod again; delete src/ProdWriteGuard.ts, productionCreateAllowList and test/ProdWriteGuard.test.ts.

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

The procedure is the runbook's "Cutover from Pulumi" (`docs/runbooks/alchemy-infra.md`), executed by the packet gate session. Pulumi commands run from infra/oip-web (removed in #3341) as `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/OIP_SECRETS/PULUMI_CONFIG_PASSPHRASE op run -- pulumi <command>` with `AWS_PROFILE=elpresidank-vault` and `PULUMI_BACKEND_URL=s3://oip-law-pulumi-state` (the packet gate session found that this passphrase decrypts both stacks; the `BEEP_SECRETS` item's passphrase belongs to the runners stack). Steps: (1) read-only preconditions: the token at `op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY` returns HTTP 200 and portal 246203876 from HubSpot's account-info endpoint (verified by the packet gate session 2026-11-14), and the Alchemy Cloudflare token lists the records of both zones; (2) `pulumi stack export` of both stacks archived under `~/.local/state/beep/infra-archives/pulumi-exports/` with size and sha256 in a decision file; (3) the bootstrap decision's commands; (4) Pulumi frozen; (5) immediately before arming, the account-info read repeated with the token the environment secret was set from, then the packet gate session tells the orchestrator the time and sets `OIP_WEB_INFRA_DEPLOY=enabled` itself; plans must match the expected-plan decision, smoke checks pass, a second dispatch plans no changes, drift exits 0; (6) `pulumi state delete` for every adopted object, then `pulumi state unprotect` and a targeted destroy of the empty old buckets, then `pulumi stack rm`. Expected visitor effect: none; no project, domain or DNS record changes, and the variables are rewritten with their current values, which reach new deployments only. Each step names its check and rollback in the runbook.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Before step 6: unset OIP_WEB_INFRA_DEPLOY and keep Pulumi as owner. After step 6, per stack: pulumi stack init <stack>; pulumi stack import --stack <stack> --file <archive>; pulumi refresh --stack <stack> --target <bucket urn> --target-dependents; pulumi up --stack <stack>.

### OipWeb deploys from one armed workflow job; vercel-deploy.yml stays unedited, 2026-11-14

`.github/workflows/deploy-oip-web-infra.yml`: push to `main` filtered to the stack, `apps/oip-web/package.json`, `bun.lock`, the Vercel provider source and the workflow itself, plus a bare `workflow_dispatch`; one GitHub-hosted job (`timeout-minutes: 30`), environment `oip-web-infra-prod`, concurrency `alchemy-oip-web-infra` (never cancelled). Per stage, `staging` then `prod`: plan teed to a log, `bun apps/oip-web/stack/plan-guard.ts` (refuses replace, delete or orphan of the project, a variable, a domain, a DNS record or a bucket, and fails closed on a log without a `Plan:` line, on an unreadable resource line and on summary counts that disagree with the listed lines, beep-reviewer round 1 on #3323; on `prod` and `staging` it also refuses every `create` outside an explicit allow-list, so a failed adoption of the project or a DNS record cannot create a second one, packet gate 2026-11-14), deploy, then a curl poll of every hostname against today's responses (200 apex, 308 or 307 redirects). The job runs only while the repository variable `OIP_WEB_INFRA_DEPLOY` is `enabled`, so merging deploys nothing; setting it is a deploy act the packet gate session performs after telling the orchestrator the time (window-5 decision). Provider secrets are step-level `env` on the four plan and deploy steps only (beep-reviewer round 1); setup, the plan guard and the smoke checks never see them. It uses a stack-scoped OIDC role (`OIP_WEB_DEPLOY_ROLE_ARN`) because the state role is state-only, the Alchemy Cloudflare token (never the account IaC token), and one `CRM_HUBSPOT_SERVICE_KEY` secret for both stages: the packet gate session verified 2026-11-14 that the token equals the value both Pulumi stacks held. No change to `check.yml`, `heavy.yml`, `setup-monorepo-ci`, runner labels or any pull-request job. Because the projects are adopted in place, `vercel-deploy.yml` keeps its project ids and is not edited.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Delete .github/workflows/deploy-oip-web-infra.yml and its ci-runner-security exemption line; unset the OIP_WEB_INFRA_DEPLOY repository variable.

### OipWeb domains and DNS records are adopted per object and protected, 2026-11-14

Ruled by the packet gate session, 2026-11-14: approved as built. Per D20 the six Vercel domains (`oip.law`, `www.oip.law`, `opip.law`, `www.opip.law` on prod; `staging.oip.law`, `staging.opip.law` on staging) and the six Cloudflare records Pulumi owns (ids matching state) carry `adopt(true)`. The records are adopted at plan time (their props are literals). The domains plan as `create`, because their `project` prop is the adopted project's output and is unresolved when the plan is made; at apply the engine still gates them on `adopt(true)` (without it the existing domain is refused with `OwnedBySomeoneElse`), and reconcile finds each domain already on the target project with equal routing and makes no mutating request (`packages/tooling/library/alchemy-vercel/test/CreatePath.test.ts`). With the project adopted in place the domains are already on the target project, so `moveFrom` is not needed. Redirect codes are kept (308 on prod, 307 on staging). Records declare their live content, `proxied: false`, automatic TTL and the live comment `Managed by Pulumi for oip.law Vercel routing.`: the Cloudflare provider writes a record only when a declared field differs, and an undeclared comment defaults to `Managed by Alchemy (<fqn>)`, so keeping the live text makes adoption a pure read (DNS Read only). Rewording the comment is a later, separate deploy that needs DNS Edit. Both kinds carry `RemovalPolicy.protect()` on live stages, and the plan guard refuses any replace, delete or orphan of either.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Remove adopt(true) and RemovalPolicy.protect from the Domain and DNS declarations and delete-then-create each record during a maintenance window instead.

### OipWeb is not lane-affecting for CI window 5, on two binding conditions, 2026-11-14

Ruled in advance by the CI window-5 owner, through the orchestrator, relayed by the packet gate session, 2026-11-14: the OIP web PR is not lane-affecting, on two binding conditions.

**Condition 1: `vercel-deploy.yml` and the Vercel pull-request checks stay untouched, including after `OIP_WEB_INFRA_DEPLOY` is switched on.** The file is not edited by this PR or by the cutover. What the stack's adoption can change on the two projects (`oip-web`, `oip-web-staging`): on the project record itself, nothing. `Vercel.Project` declares only `name` and `teamId`, both equal to the live values, and the provider's `projectPatch` sends only declared fields that differ, so the adoption update sends an empty patch. Left undeclared, and therefore never sent: the git link (the project API cannot relink a repository anyway), the framework, the build and install commands, the root directory, the Node version, the system-variable exposure and deployment protection. `git.deploymentEnabled: false` lives in `apps/oip-web/vercel.json`, which no resource reads or writes. The project ids `vercel-deploy.yml` hard-codes (`VERCEL_ORG_ID` and the two `projectId` values in `VERCEL_APPS`) are kept: projects are adopted by name, `projectId` is a stable attribute, and a replace is refused twice, by `RemovalPolicy.protect()` in the engine and by the plan guard (`[Project] replace` fails `PlanRefused`). What the first deploy does change, under the projects: the three variables (planned `create`, because their `project` prop is the adopted project's output and unresolved at plan time; reconcile then edits the live variable in place, one write, no delete, no duplicate, `packages/tooling/library/alchemy-vercel/test/CreatePath.test.ts`) are rewritten with their current values (`NEXT_DISABLE_PWA` and `CRM_HUBSPOT_ACCOUNT_ID`, which preview builds read, were verified equal on both projects 2026-11-14 with booleans only; the production-only HubSpot token was verified equal by the packet gate session), and a variable write reaches new deployments only. Domains take the same create path and are left alone: each is already on the target project with equal routing, so reconcile makes no mutating request (same test file). DNS records are adopted at plan time and only read. The plan guard allows `create` on `prod` and `staging` only for an explicit allow-list (the assets bucket, the three variables and that stage's domains) and refuses a `create` of the project, a DNS record or any other resource, so a failed adoption of the project or a record can never become a second project or a duplicate record. After arming, the deploy workflow runs only on push to `main` (path-filtered) and dispatch, never on a pull request; it reads its own environment's secrets, not the repository `VERCEL_TOKEN`; and it shares no concurrency group with `vercel-deploy.yml`. Tests in `apps/oip-web/test/stack/OipWebStack.test.ts`: per live stage, adoption declares only `name` and `teamId`, every live project setting (framework, both commands, root directory, git link, protection, Node version, system variables) is unchanged afterwards, the adopted project id is the census id, and the DNS records are only read; a third test reads `.github/workflows/vercel-deploy.yml` and checks it hard-codes exactly those two project ids and the team id. `test/stack/PlanGuard.test.ts` covers the refusal of a project replace.

**Condition 2: switching the variable on is a deploy act.** The runbook's arming step (`docs/runbooks/alchemy-infra.md`, "Cutover from Pulumi", step 5) says to tell the orchestrator the time beforehand; the packet gate session sets `OIP_WEB_INFRA_DEPLOY=enabled` itself, never a workflow or a lane. The workflow file states the same.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Re-declare any project field in OipWebStack.ts (and drop the pull-request-surface tests) only with a new ruling from the CI window-5 owner; arming stays the packet gate session's act.

### OipWeb plans: the personal stage planned as designed; first prod and staging plans predicted, 2026-11-14

Read-only `alchemy plan --stage dev_elpresidank --env-file /dev/null` from `apps/oip-web` (aws-vault credentials exported, provider tokens through `op run`), 2026-11-14, twice: first with the account IaC Cloudflare token, then, after the project and DNS declarations narrowed, with the Alchemy token the workflow uses. Both exited 0 with `Plan: 4 to create`: `[AssetsBucket]`, `[EnvHubSpotAccountId]`, `[EnvNextDisablePwa]` and `[Project]`, all stage-named (`oip-web-dev-elpresidank`, `oip-law-web-assets-dev-elpresidank`); nothing adopted, moved or modified; no deploy; the state bucket holds no `OipWeb/` object afterwards. CI-style plan lines carry a `[HH:MM:SS.mmm] INFO: ` prefix and a `Plan · <stage>` title line; the plan guard strips the prefix and reads the stage from the title (fixtures in `test/stack/PlanGuard.test.ts`).

Corrected 2026-11-14 for the packet gate session (the first prediction of `1 to create, 12 to adopted` was wrong). The first plans, rendered by the engine itself against the seeded census in `apps/oip-web/test/stack/OipWebStack.test.ts` ("the first live plans pass the plan guard"), are `prod`: `Plan: 8 to create, 5 to adopted`, with `[Project]` and `[Dns-oip-law]`, `[Dns-opip-law]`, `[Dns-www-oip-law]`, `[Dns-www-opip-law]` adopted and `[AssetsBucket]`, `[Domain-oip-law]`, `[Domain-opip-law]`, `[Domain-www-oip-law]`, `[Domain-www-opip-law]`, `[EnvHubSpotAccountId]`, `[EnvHubSpotServiceKey]`, `[EnvNextDisablePwa]` create; `staging`: `Plan: 6 to create, 3 to adopted`, with `[Project]`, `[Dns-staging-oip-law]` and `[Dns-staging-opip-law]` adopted and `[AssetsBucket]`, `[Domain-staging-oip-law]`, `[Domain-staging-opip-law]` and the three variables create. Nothing is written while planning. The variables and domains plan as `create` because their `project` prop is the adopted project's output, which is unresolved when the plan is made, so the engine cannot read them for adoption; at apply it still gates each on `adopt(true)`. With the real providers over the in-memory Vercel API (`packages/tooling/library/alchemy-vercel/test/CreatePath.test.ts`): a domain already on the target project with equal routing gets no mutating request, and without `adopt(true)` it is refused with `OwnedBySomeoneElse`; an existing variable (literal `encrypted`, and sensitive `valueFrom`) gets exactly one `PATCH Env` on its own id, with the same key, type and targets, no `DELETE`, no `POST`, and stays the only variable with that key. That last result held only against the fake: the real API refuses the `key` the edit then sent on a sensitive variable, so the first armed staging deploy (run 43585534113) failed on `EnvHubSpotServiceKey`. The edit now sends only the value plus the targets and branch that differ, the fake refuses what the real API refuses, and the path is rehearsed on the real API (decision `2026-11-14-first-armed-oipweb-deploy-failed-on-a-sensitive-variable-edit`). The re-run (run 43591525409, main `6e393d55c29`, re-armed 2026-11-14T11:45:21Z) printed staging `Plan: 1 to create` (`[EnvHubSpotServiceKey] create`, the eight others `noop`) and prod `Plan: 8 to create, 5 to adopted`; both passed the guard and deployed (`Done: 1 succeeded`, `Done: 13 succeeded`). The failed run had left a `creating` checkpoint without attributes for `EnvHubSpotServiceKey` (Alchemy commits one before calling the provider), and the planner prints such a row as `create` and decides adoption at apply time. An earlier probe that deleted the row instead predicted `1 to adopted`; the stack test now models the checkpoint and asserts `1 to create` (`OipWebStack.test.ts`, "the staging re-run after the 2026-11-14 partial deploy"). After the deploy all six variables kept their ids, types and targets, and the six domains and six DNS records were unchanged.

Because the deploy job runs plan, guard and deploy unattended, the stop rule is code: on `prod` and `staging` the plan guard refuses every `create` outside an explicit allow-list (`prod`: `AssetsBucket`, `EnvNextDisablePwa`, `EnvHubSpotAccountId`, `EnvHubSpotServiceKey`, `Domain-oip-law`, `Domain-www-oip-law`, `Domain-opip-law`, `Domain-www-opip-law`; `staging`: the bucket, the three variables, `Domain-staging-oip-law`, `Domain-staging-opip-law`) with `PlanCreateRefused`, so a project or DNS record that fails to adopt can never be created a second time and a resource added to the stack later must be allow-listed deliberately. Personal stages create freely. `CRM_HUBSPOT_SERVICE_KEY` must be present at plan time: the stack reads it before declaring anything and `Vercel.EnvVar.diff` resolves it, so a missing key is a `ConfigError` before any write. Remaining stop signs for the reader of the run: any `replace`, `delete` or `orphaned` line (the guard and `RemovalPolicy.protect` both refuse it); `OwnedBySomeoneElse`, `EnvVarTypeNotApplied` or a Cloudflare 403; a `ConfigError` on `CI` or `CRM_HUBSPOT_SERVICE_KEY`; a second dispatch that plans anything but no changes.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: n/a (evidence record); a later plan that differs supersedes it with its own decision file.

### OipWeb Pulumi cutover done, both stacks removed, 2026-11-14

The packet gate session ran the `opip-web` Pulumi cutover on 2026-11-14, staging first. It used the
attended script, with one `stack_ls_json` fix: bare stack names are normalized to full names. Every
step was announced to the orchestrator, and every time below is UTC from command output.

**Archives, taken 10:29Z.** Both are kept until P6 under
`~/.local/state/beep/infra-archives/pulumi-exports/`, off-repo.

| Stack | Resources | Bytes | sha256 |
| --- | --- | --- | --- |
| staging | 18 | 79,266 | `23c44a9f49d6c5d0804af5b3e794aacfe8958e2882624572d20150df2d1b4a93` |
| production | 22 | 101,138 | `465ab3f9bca3d89165819155e63ec341469ddea20ee7fa04fc1f3ed61a81c803` |

The same directory (`opip-web-<stack>-2026-11-14-*`) also holds every step snapshot, the compare
inputs, both destroy previews (JSON) and both destroy logs, plus the script (`oip-web-pulumi-cutover.sh`)
and its steps file. Those are what `rollback` needs.

**The armed deploy before it.** Run 43591525409 (main `6e393d55c29`):
- staging planned `Plan: 1 to create` (`[EnvHubSpotServiceKey] create`, eight `noop`);
- prod planned `Plan: 8 to create, 5 to adopted`;
- both deployed, and the smoke checks passed.

The probe had predicted `1 to adopted` for staging. Why `create` printed instead:
1. Alchemy commits a `creating` checkpoint with no attributes before it calls the provider
   (`Apply.ts`).
2. The failed first run (43585534113) left that checkpoint for `EnvHubSpotServiceKey`.
3. The planner prints such a row as `create` and decides adoption at apply time (`Plan.ts`).
4. The probe had deleted the row instead, a wrong model of a failed create. The stack test now
   models the checkpoint.

Before the cutover, the live state matched the pre-arming census: the six variable ids, one variable
per key, the same types and targets, and unchanged domains and DNS records.

**Staging.**
1. Detach 8 URNs, 11:54:24Z to 11:54:39Z: 18 to 10 resources, compare ok.
2. Old bucket `staging-assets.oip.law`: 0 versions, 0 delete markers.
3. Unprotect 5 resources at 11:55:09Z.
4. The destroy preview showed exactly five deletes; destroy ran 11:56:08Z to 11:56:21Z with the
   orchestrator's go: `5 deleted, 2 unchanged`, 10 to 5, compare ok.
5. Component state delete at 11:56:54Z: 4 left.
6. `stack rm --force --preserve-config` at 11:57:10Z.

**Production.**
1. Detach 12 URNs, 11:57:39Z to 11:58:01Z: 22 to 10, compare ok.
2. Old bucket `assets.oip.law`: 0 versions, 0 delete markers.
3. Unprotect 5 resources at 11:58:04Z.
4. The destroy preview showed exactly five deletes; destroy ran 11:58:51Z to 11:59:06Z with the
   orchestrator's go: `5 deleted, 2 unchanged`, 10 to 5, compare ok.
5. Component state delete at 11:59:26Z: 4 left.
6. `stack rm` at 11:59:33Z.

**After.**
- `pulumi stack ls -a` lists only `organization/beep-ci-runners/production`: 354 resources,
  lastUpdate 2026-11-14T05:22:19.684Z, unchanged throughout.
- Both old buckets return 404; both Alchemy buckets exist; all six hostnames serve.

**What this PR retires (#3341).** The Pulumi program goes: infra/oip-web (removed in #3341), infra/src/OipWeb.ts
(removed in #3341), its entry and test. The Storybook Pulumi program goes in the same PR, under the P6 retire inventory
R1 (its stack was removed on 2026-11-13): infra/storybook (removed in #3341) and infra/src/Storybook.ts (removed in #3341), with its
entry and test, and infra/src/Vercel.ts (removed in #3341), which only those two programs imported. So
`@pulumi/cloudflare` and `@pulumiverse/vercel` leave `infra/`, the root catalog and `bun.lock`. This PR
also deletes the turbo-cache lab program (lab `c1023a`, destroyed 2026-10-24; decision
`2026-11-14-turbo-cache-lab-lab-c1023a-was-destroyed-on-2026-10-24-nothing-is-live`). The runners
program is unchanged.

Lane goals/infra-alchemy-rebuild-p4-oip-web-cutover

Reverse: Run the archived script's rollback per stack from a checkout that still has infra/oip-web (6e393d55c29): stack init, stack import of the archive, targeted refresh of the bucket group; disarm OIP_WEB_INFRA_DEPLOY first

### OipWeb stages: prod and staging own the live objects, names are pinned, personal stages are fenced off, 2026-11-14

`prod` and `staging` map to the Pulumi stacks `production` and `staging` and refuse to run without `CI=true`. Every physical name (project, bucket, hostnames, zone ids) is pinned in `apps/oip-web/stack/OipWebConfig.ts`; none is derived from a state-held instance id (the #3133 lesson). A personal stage (`dev_$USER`) gets `oip-web-<stage>` and `oip-law-web-assets-<stage>`, the two public variables, no domain, no DNS and no secret, and the `OipWebStackConfig` schema rejects a personal configuration that names a live project, a live or retiring bucket, a domain or the HubSpot secret source.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Collapse liveStageConfig into the Pulumi-style config file per stage and drop the schema fences; no live object depends on the shape.

### Packet gate ruling: the beep-infra-github App key is the one credential that enters CI for this stack, 2026-11-14

Ruling by the packet gate session, 2026-11-14, on review thread discussion_r4572751666. It amends
`2026-11-13-packet-gate-ruling-every-secret-stays-unmanaged-and-no-new-long-lived-credential-enters-ci.md`,
whose reversal line anticipated this ("a later decision names … the delivery route the gate approves").

What stands unchanged: the 2026-11-13 ruling was about delivering secret values. It kept a 1Password
service-account token, which can read every secret, out of CI. So every repository and environment secret stays
unmanaged by the stack.

What is amended, for one credential only: the deploy identity. The private key of the `beep-infra-github` App is
stored as an environment secret, `INFRA_GITHUB_APP_PRIVATE_KEY`, on `infra-github-prod`. It enters CI only in the
token-mint step of `deploy-infra-github.yml` (`actions/create-github-app-token`), which exchanges it for a one-hour
installation token.

Why: the stack writes repository settings, rulesets, environments, variables and labels, and the Actions
`GITHUB_TOKEN` can do none of that, so some administrative identity is unavoidable. The narrowest one available is
an App that:
- is installed on this one repository;
- has only the permissions the stack needs;
- has a key readable only by jobs on `main`, through a protected environment;
- exchanges that key for a one-hour token on every run.

The App and its environment:
- **App permissions** (checked-in manifest
  `packages/tooling/policy-pack/repo-configs/data/github-apps/beep-infra-github.manifest.json`): repository
  `administration` write (settings and rulesets), `environments` write, `actions_variables` write, `issues` write
  (labels), `metadata` read. No secrets permission, no events, webhook inactive.
- **Installation:** `beep-effect/beep-effect` only.
- **Mint step:** no `permission-*` inputs, so the token carries exactly the App's permissions.
- **Environment `infra-github-prod`:** deployment branch policy `protected_branches: false`,
  `custom_branch_policies: true`, with one branch policy, `main` (type `branch`). Only a job running on `main` can
  read the secret.

Alternative considered and not taken: keeping the key in AWS (SSM Parameter Store or Secrets Manager) and fetching
it through the OIDC role. That keeps the key out of GitHub's secret store but not out of the job's reach, and it
adds a second system to rotate.

Controls:
- The key is never a repository-level secret.
- It reaches no step but the mint step. This is already true in the workflow (blob
  `9b4af8a47264f24357b22016096c59689fca8fc3`), and the job-level `env` holds no secret.
- Rotation (runbook, InfraGithub section): mint a new key in the App settings, replace the environment secret, then
  delete the old key in the App settings.
- The operator mints the App and stores the key, so the credential exists only by their act.

Lane goals/infra-alchemy-rebuild-p3-github

Reverse: Delete the environment secret INFRA_GITHUB_APP_PRIVATE_KEY on infra-github-prod and uninstall the beep-infra-github App; the stack then cannot deploy from CI.

### RunnerFleet declares each pool's RunnerLaunchTemplate from aws-extras, 2026-11-14

With `@beep/alchemy-aws-extras` on `main` (#3292), `RunnerFleet` declares one `RunnerLaunchTemplate` per pool instead of taking a caller-built template id. The composite sets what it owns: the pool instance profile, the rendered user data, and metadata options that require IMDSv2 with instance metadata tags enabled (the user data reads `ghr:token_path` from them, hop limit 1 as upstream). The caller passes `launchTemplate`, a `Pick` of `RunnerLaunchTemplateProps` (`imageId`, `securityGroupIds`, `associatePublicIpAddress`, `blockDeviceMappings`, `ebsOptimized`, `tags`); instance types and Spot or on-demand capacity stay per launch in scale-up `CreateFleet`. Scale-up launches the template default version as a number, which the provider moves on every update, so a template change also rolls the scale-up runtime config. The earlier typed-input decision for this lane never merged and is replaced by this one.

Lane goals/infra-alchemy-rebuild-p2-github-runners-composite

Reverse: Restore a caller-supplied launchTemplate(spec) effect returning a template id and version, built from a RunnerLaunchSpec the composite hands out.

### Turbo-cache lab lab-c1023a was destroyed on 2026-10-24; nothing is live, 2026-11-14

**What the lab was.** It was the disposable AWS conformance lab of the completed goal
`turborepo-cache-conformance`, epoch `c1023a`, Pulumi stack `beep-turbo-cache-lab/lab-c1023a`.
- Its program, infra/src/internal/turbo-cache-lab-entry.ts (removed in #3341), deployed two
  `CiTurboCache` copies: an incumbent and an "evolved" incumbent.
- Each copy had an S3 bucket, an HTTP API with its authorizer, reader and writer Lambdas, their IAM
  roles and their log groups.
- The lab script's bootstrap added one KMS key and three SSM SecureStrings under
  `/beep-ci/cache-lab/c1023a/`.
- Every resource carried the tags `beep:lab=turbo-cache-conformance` and `beep:lab-epoch=c1023a`.

**Lifetime.** The Pulumi backend keeps four backups of that stack:
- First update 2026-10-24T01:12:05Z, a 100 KB checkpoint.
- Grown at 02:23:46Z to 201 KB, with both incumbents.
- Last full checkpoint at 03:21:10Z, 191 KB.
- At 03:21:59Z, 392 bytes: an empty deployment. That is consistent with the script's destroy (a
  targeted destroy of the bucket policies, emptying the buckets, a full destroy) followed by
  `pulumi stack rm`, which leaves only the `.bak`.

The backend lists no such stack today.

**Live check, 2026-11-14.** Seven read-only AWS calls in `us-east-1`, each made once, all came back
empty:
1. The resource-tag query for `beep:lab-epoch=c1023a`.
2. The same query for `beep:lab=turbo-cache-conformance`, any epoch.
3. SSM parameters under `/beep-ci/cache-lab/`.
4. CloudWatch log groups with the prefix `/aws/lambda/beep-tcl-`.
5. CloudWatch log groups matching the pattern `beep-tcl`.
6. IAM roles whose names start with `beep-tcl`.
7. S3 buckets whose names start with `beep-tcl`.

The KMS key's 7-day deletion window has long passed, and the key no longer appears in the tag query.
Nothing accrues cost.

**What remains.** Five small objects in the Pulumi backend bucket belong to that stack: the `.bak` and
the four backups, about 0.5 MB together. They stay with the bucket, whose fate the operator decides at
closeout.

**Consequence.** Deleting the lab program and its script (#3341) loses no capability and strands no
resource. To reverse it, restore the files from git history; there is nothing to redeploy.

**Who gathered the evidence, and its limits.** The packet's P6 retire-inventory lane gathered it on
2026-11-14. It read the lab program and the lab script, then made the seven read-only calls above
under the operator workstation's AWS profile. The P6 inventory document is committed under the
packet's research directory by a following packet PR. The check covers the lab's tag, name-prefix and
parameter-path conventions as the lab script creates them; a resource created outside those
conventions would not be found by it.

Reverse: n/a (record only)

### Vercel.EnvVar gains valueFrom so a secret never enters Alchemy state, 2026-11-14

Accepted by the packet gate session, 2026-11-14; the PR body says it changes a merged library and why. Alchemy writes a `Redacted` prop as `{ "__redacted__": <plain text> }` in state (`alchemy/src/State/StateEncoding.ts`), so `EnvVar.value` put any secret in the state bucket in clear JSON, protected only by SSE-KMS at rest. `EnvVarProps` now takes exactly one of `value` (non-secret) and `valueFrom: { config }`; the provider reads the config key inside `diff` and `reconcile` (`Config.Redacted`), sends it only to Vercel, and stores `valueDigest` (SHA-256 hex, `effect/crypto/Digest`) so a rotated value plans an update. Neither or both fails with `EnvVarValueMissing`. Package tests prove the secret is absent from persisted state, that a literal `value` is present (the control), and that rotation is detected. The digest is unsalted: fine for a high-entropy token, guessable for a short value. The OipWeb stack uses `valueFrom` for `CRM_HUBSPOT_SERVICE_KEY`.

Lane goals/infra-alchemy-rebuild-p4-oip-web

Reverse: Remove valueFrom and valueDigest from @beep/alchemy-vercel EnvVar and pass secrets as value again, accepting plain text in the KMS-encrypted state bucket.

### CI runners workflows end on the beep-fleet labels, 2026-11-18

Packet gate ruling, 2026-11-18, on the end-state label question of the cutover decision: option A. At cutover step 4 the workflows move to the new labels `beep-fleet-heavy` and `beep-fleet-overflow` (every reader in the cutover decision's inventory: `heavy.yml`'s nine jobs, `cache-warm.yml`, `shard-overflow.yml`, the CLI overflow label constant, which splits into label and group, and the tests and runbooks that name the label) and stay there. Reason: label isolation is what makes the overlap safe (each fleet's webhook acts only on its own labels, so no job launches two runners), and a rollback of the move is a plain revert of the workflow PR. The runner groups keep their live names, so the overflow preflight models label and group as two constants. Census and timing reports keep classifying the new labels as managed (`beep-` prefix); per-label history splits at the move date.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Relabel the pools to the live names (beep-ec2-heavy, beep-shard-overflow) in a later PR once the old fleet is gone, and revert the workflow runs-on edits.

### Seed coverage baseline rows for the seven packages the packet added, 2026-11-18

`standards/coverage.regression-baseline.jsonc` had no rows for seven packages this packet added: `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, `@beep/alchemy-vercel`, `@beep/infra-cost-controls`, `@beep/infra-github`, `@beep/infra-hosts` and `@beep/infra-turbo-cache`. The hosted Heavy / Coverage Regression job reported them as missing only on full-matrix runs (PR #3367 job 134497133455, PR #3369 job 134501277702).

The rows come from hosted measurement, not a local run. Each source run's unit coverage artifacts were downloaded, and the repo's own `collectCoverageProducerArtifacts` ran over them in a checkout of that run's tested SHA, on the producer runtime pins (Node 22.23.4, Bun 1.4.4). The resulting rows were inserted unchanged.

- Six rows come from workflow run 44212040109 (the run behind job 134497133455, execution SHA `169fdd16cdf`, all 25 partitions): `@beep/alchemy-aws-extras`, `@beep/alchemy-github-runners`, `@beep/alchemy-vercel`, `@beep/infra-github`, `@beep/infra-hosts` and `@beep/infra-turbo-cache`. `git diff --stat 169fdd16cdf b430fa98ee` is empty for each of their package directories.
- The `@beep/infra-cost-controls` row comes from #3373's own Check run 44219059468 (execution SHA `e576e8298f6`, the merge of `b430fa98ee` into `3199097213`), which contains #3366. #3366 rewrote `cost-controls/src/PlanCheck.ts` (4 files, +233/-44 since `169fdd16cdf`), so the first draft's row from run 44212040109 described the old file. The beep-reviewer caught it (thread r4608264233).
- Run 44219059468 also measured the six other packages. Their rows came out deep-equal to the rows taken from run 44212040109.
- #3370 (`5120c157e3`), merged into this lane afterwards, touched `@beep/infra-github`. In `src/` it changed only a JSDoc comment in `Config.ts`; the rest was a test and its fixture. The row is 100/100/100/100 with no uncovered counter, so it stands. Hosted Coverage Regression on this PR's head re-judges it.

Against `origin/main`, the diff adds 1137 lines and removes none. Decoded through the `CoverageRegressionBaseline` schema, it adds 7 rows and changes no existing row or document field.

| Package | Lines | Statements | Branches | Functions |
| --- | --- | --- | --- | --- |
| `@beep/alchemy-aws-extras` | 92.71 | 91.51 | 73.01 | 83.78 |
| `@beep/alchemy-github-runners` | 94.69 | 93.72 | 74.62 | 87.24 |
| `@beep/alchemy-vercel` | 92.99 | 91.73 | 87.79 | 82.05 |
| `@beep/infra-cost-controls` | 99.37 | 99.42 | 92.94 | 98.36 |
| `@beep/infra-github` | 100 | 100 | 100 | 100 |
| `@beep/infra-hosts` | 99.61 | 99.63 | 100 | 98.75 |
| `@beep/infra-turbo-cache` | 72.9 | 74.1 | 58.62 | 72.28 |

All seven rows clear the tiered minimum, so none needs a `follow_ups` entry. This packet owns the seven rows: each package's owning phase lane, and the packet gate until closeout.

Lane goals/infra-alchemy-rebuild-coverage-baseline-rows

Reverse: remove the 7 rows from standards/coverage.regression-baseline.jsonc

### Deny the live fleet's event-source mappings until the P5 drain, 2026-11-18

The deploy role grants `lambda:TagResource` on event-source mappings for tag on create, and Update/Delete need only the ownership tags plus `lambda:FunctionArn` on a fleet function. Whether `lambda:FunctionArn` evaluates the requested or the current target is not documented, so a tagged foreign mapping could be retargeted to a fleet function. The account holds six foreign mappings: the live Pulumi fleet's `beep-ci-*` and `beep-ovf-*` scale-up, job-retry and deregister-retry. A stalled live scale-up stalls production CI, so the driver ruled option B (2026-11-18). `DenyLiveFleetMappings` in `DeployRolePolicy.ts` denies `lambda:TagResource`, `UntagResource`, `UpdateEventSourceMapping` and `DeleteEventSourceMapping` on exactly those six mapping ARNs, read with `aws lambda list-event-source-mappings`. It is keyed on the resource ARNs alone, with no condition, because the `lambda:FunctionArn` form is ambiguous on update and `TagResource` does not document the key. Tag on create for the stack's own mappings is unchanged. The cutover decision re-reads the mappings before step 1b and before the drain, and holds if a UUID changes. Simulations #29a to #29d.

Lane goals/infra-alchemy-rebuild-p5-ci-runners · PR #3386

Reverse: remove DenyLiveFleetMappings in the P5 drain+destroy PR

### fleet-shadow-check is repointed for the overlap and deleted at the Pulumi cleanup, 2026-11-18

Packet gate ruling, 2026-11-18. During the overlap `fleet-shadow-check.yml` is repointed to the new fleet (`runs-on: beep-fleet-heavy`, and its App-secret denial probe reads `/beep-fleet/prod/app/<parameter>` instead of `/github-action-runners/app/<parameter>`), as extra per-pool proof in cutover step 3 that a runner cannot read the App key or webhook secret. It is deleted in the cutover step-6 cleanup PR together with the Pulumi program, `fleet-lane-probe.yml` and the other old-fleet readers. Both edits are `.github/` changes and ride the lane PRs the operator merges.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Restore .github/workflows/fleet-shadow-check.yml from git.

### infra-github is armed: beep-infra-github App 5808968, first deploy adopted ruleset 10240248 with no write, 2026-11-18

**App.** `beep-infra-github`, app id 5808968, installation 183128206, installed on
`beep-effect/beep-effect` only. The 2026-11-15 mint registered App 5766296 but could not
store its key (the `op` on `PATH` was the service-account shim, which cannot create items);
that orphan App was deleted. The 2026-11-18 mint stored the credentials through `op-human`.
The launcher now picks a human-capable writer and preflights the vault before it listens
(this PR).

**Environment.** `infra-github-prod` has a `main`-only branch policy plus
`INFRA_GITHUB_APP_ID`, the secret `INFRA_GITHUB_APP_PRIVATE_KEY` and
`ALCHEMY_STATE_ROLE_ARN = arn:aws:iam::832907639880:role/beep-alchemy-infra-github-deploy`.
The role was created per decision `2026-11-14-infra-github-deploy-role`. IAM simulation:
`allowed` under `InfraGithub/`, `implicitDeny` under `CostControls/`, `implicitDeny` for
`PutBucketVersioning`.

**Armed.** `INFRA_GITHUB_DEPLOY_ARMED=true` at 2026-11-18T00:10:15Z. First deploy: run
44205593606 on `main` 0ebff74854, success at 00:11:58Z.

**Ruleset 10240248.** The normalized diff of `rules`, `conditions`, `bypass_actors` and
`enforcement` (ids and timestamps removed) is empty. `updated_at` is unchanged at
2026-10-27T04:49:40-05:00: the stack adopted the ruleset with no write. The CI goals driver
ruled no window-5 restart.

**Side effect.** The provider's create upserts existing objects. Eight labels that had no
description now return `""` instead of `null`. Everything else matches the census:
repository settings, the four environments, and the `KNOWLEDGE_MINT_*` variables are
untouched.

**Standing rule (CI goals driver).** Report a later infra-github deploy only if the ruleset
diff is non-empty, or the deploy changes repository settings or required contexts.

Lane goals/infra-alchemy-rebuild-mint-vault-writer

Reverse: gh variable delete INFRA_GITHUB_DEPLOY_ARMED -R beep-effect/beep-effect

### job-env grants main schedule and dispatch runs read-only Turbo cache access, 2026-11-18

Root fix for #3380's review thread on the schedule- and dispatch-only callers, landing first in the follow-on chain the packet gate and the CI driver ruled (job-env fix, then the beep-ci pin bump, then the callers' inputs restored; one at a time, not gating window 6). `beep ci job-env` now treats a `schedule` or `workflow_dispatch` run whose `GITHUB_REF` is `refs/heads/main` as a reader: `local:rw,remote:r` with the read token, mode `read-only (main schedule or dispatch)`, no application secrets, never the write token. Any other ref for those events stays local-only, and push and pull-request output is pinned byte-identical by a test that passed on the unmodified code before the change (the exact GITHUB_ENV bytes for a push on main and a same-repository pull request) and passes after it; a raw before-and-after capture compared equal with `cmp`. The R2 pilot's adapter had allowed the same main schedule and dispatch reads before stage 2. Pin bump: the setup action runs `bun run beep ci job-env` after installing dependencies, and the root `beep` script runs the checkout's `packages/tooling/tool/cli/src/bin.ts`, so this behaviour takes effect on every checkout of main as soon as it merges, not only after a pin bump. `CiOperational.service.ts` is in the `bin-ci.ts` closure, though, so the merge cuts a new `beep-ci-*` release through `beep-ci-binary.yml`, whose main run opens the routine pin bump on `ci/beep-ci-pin-bump`; that bump goes through the orchestrator for the driver's closure re-diff as its own PR, after this one. The third PR then restores the cache inputs of `data-sync.yml` (dispatch only) and `property-laws-nightly.yml` (schedule and dispatch), the only remote-cache callers that run on schedule or dispatch alone; no caller mixes schedule or dispatch with push or pull_request. The heavy.yml runs reached from the cache-producer and cache-local-observe dispatchers do not run the remote-cache Lint Policy job, so they are unaffected.

Lane goals/infra-alchemy-rebuild-job-env-scheduled-read

Reverse: Revert this PR: job-env again treats schedule and workflow_dispatch as local-only; push and pull-request output never changed.

### Live heavy bursts stay at 6 or fewer while both runner fleets exist, 2026-11-18

Packet gate ruling, 2026-11-18, recorded as a binding precondition of cutover step 1. The account's Spot quota is 512 vCPU; the new fleet's overlap caps commit 32 (heavy 1 x 16, overflow 2 x 8) and the live fleet at its default caps holds 416 (heavy 2 x 16, overflow 48 x 8), 448 in all. While both fleets exist a live heavy burst may therefore reach at most 6 VMs (6 x 16 + 384 + 32 = 512); at 8 the two fleets would ask for more than the quota and `CreateFleet` would fail on whichever asks last. The cap binds the CI goals driver, so the gate relays it to the orchestrator; `BEEP_HEAVY_BURST_MAX` lives in the burst tooling's template outside the repo and is set by the orchestrator and driver, never by this lane. The schema's Spot budget in `CiRunnersConfig` enforces the new fleet's side of the same arithmetic: since the #3386 review it reserves 480 vCPU for the live fleet at this cap (6 x 16 + 48 x 8), so the overlap commits exactly 512 and any larger new-fleet cap is refused at decode.

Lane goals/infra-alchemy-rebuild-p5-ci-runners

Reverse: Lift the cap to 8 once the old fleet is drained and destroyed (cutover step 6d). Earlier, only if the new fleet holds no Spot: its overlap caps deployed at 0, its scale-up paused and drained (no invocation in flight), and both new pools with no pending or running instance. If the new fleet is already primary, first bring it back to overlap (cutover step 4 rollback) instead of relying on the overlap caps.

### Turbo-cache follow-on: the schedule and dispatch callers read the Worker cache again, 2026-11-18

Last PR of the turbo-cache stage-2 follow-on chain (packet gate GO after #3385 merged the `job-env` read grant and #3389 bumped the pin to `beep-ci-69e898ef9350`). `data-sync.yml` (dispatch only) and `property-laws-nightly.yml` (schedule and dispatch), the only remote-cache callers that run on schedule or dispatch alone, pass `turbo-remote-cache`, `turbo-api` (`vars.TURBO_CACHE_API`), `turbo-team` (`vars.TURBO_CACHE_TEAM`) and `turbo-read-token` (`secrets.TURBO_CACHE_READ_TOKEN`) again, never a write token and no R2 inputs, and the "local-only until" comments are gone. This supersedes the local-only part of the stage-2 decision. Proof: the pinned `beep-linux-x64` from `beep-ci-69e898ef9350` (checksum verified) and the source command both write `TURBO_CACHE=local:rw,remote:r`, the read token and mode `read-only (main schedule or dispatch)` for `schedule` and `workflow_dispatch` on `refs/heads/main`, and `local:rw` / `local-only` for a dispatch on another branch, byte-identical between the two; the #3385 test in `ci-runner-security.test.ts` pins the same cases. `certainty-nightly.yml` is untouched, and the change does not gate window 6.

Lane goals/infra-alchemy-rebuild-turbo-cache-inputs-restore

Reverse: Revert this PR: data-sync.yml and property-laws-nightly.yml go back to passing no cache inputs and run local-only; job-env and every other caller are unchanged.

### Turbo-cache stage 2: every Turbo-backed CI job reads the Worker cache under new names, 2026-11-18

Released by the operator's 2026-11-18 ruling on the window-5 holds. The workflows that call the setup-monorepo-ci action with the remote cache move together (heavy, check, shard-overflow and storybook; data-sync and property-laws-nightly are covered below), not only heavy and check: the ci-runner-security test pins one allowlist of secret lines across every caller, and a split would also give the overflow shards a different cache from the lanes they stand in for. Each passes `vars.TURBO_CACHE_API` and `vars.TURBO_CACHE_TEAM` (new repository variables: the Worker origin and team `beep`), `secrets.TURBO_CACHE_WRITE_TOKEN` on pushes (`turbo-cache-write` environment, principal ci-main) and `secrets.TURBO_CACHE_READ_TOKEN` (repository, principal ci-pr), and drops its `r2-*` inputs, because the R2 pilot's adapter would otherwise start and override `TURBO_API`. The action and `beep ci job-env` keep their input and policy slot names. Review round 1 on #3380 found two gaps. `cache-warm.yml` warmed the AWS cache: it now warms the Worker cache with the write token and starts the R2 adapter only for its explicit `r2_probe` qualification dispatch. And `job-env` gives a remote read only to same-repository pull requests, so the schedule- and dispatch-only callers (`data-sync.yml`, `property-laws-nightly.yml`) were passing dead cache inputs: the packet gate ruled to drop those inputs here, so both run local-only, and to fix the root as a follow-on chain that lands one PR at a time and does not gate window 6: `job-env` grants `local:rw,remote:r` to `schedule` and `workflow_dispatch` on `refs/heads/main` (push and pull-request output byte-identical), a `beep-ci` pin bump ships it, and a third PR restores the two callers' inputs. Both secrets were issued 2026-11-18 with the package's token.ts from prod state through `gh secret set` on stdin (values never printed); `@beep/infra-github` lists the two variables and two secrets as unmanaged and its census fixture records them. The AWS Lambda cache and the R2 pilot keep serving under their old names until P6. Dry proof against the prod Worker with the same two tokens, from a scratch workspace: write token remote miss, read token remote hit (`"source": "REMOTE"`), read token upload refused (`read_only`), and the write token still missing that hash afterwards.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache-stage-2

Reverse: Revert the stage-2 PR: the callers and cache-warm go back to vars.TURBO_API/TURBO_TEAM, secrets.TURBO_TOKEN/TURBO_READ_TOKEN and the R2 inputs, all still live. Then, one name per command: gh variable delete TURBO_CACHE_API -R beep-effect/beep-effect; gh variable delete TURBO_CACHE_TEAM -R beep-effect/beep-effect; gh secret delete TURBO_CACHE_READ_TOKEN -R beep-effect/beep-effect; gh secret delete TURBO_CACHE_WRITE_TOKEN --env turbo-cache-write -R beep-effect/beep-effect.

### CI runner handler bundles take their identity composer from a package-local leaf, 2026-11-19

Until now every module took its identity composer from the registry module, @beep/identity/packages. That module holds one composer per workspace package, so its text changes whenever a package is registered. Alchemy hashes each Lambda zip with its source map, and the source map embeds the text of every module the handler loads. The CiRunners handlers (seven entries in @beep/alchemy-github-runners, the reaper in @beep/infra-ci-runners) all loaded the registry through $AlchemyGithubRunnersId, $InfraCiRunnersId and $SchemaId, so registering any package anywhere in the monorepo planned all 11 functions as code updates. Making each registry export a pure leaf (PR 3422) shrinks the minified code but leaves the whole file in the source map.

The law is amended for packages whose modules a deployed handler bundle loads:

- Such a package takes its composer from a package-local leaf, src/internal/<Composer>.ts, that derives it from $BeepId in @beep/identity/Root. Root imports only Id.ts, so the handler graph no longer reaches the registry. The rule covers every module of the package, not only the ones a handler loads today: @beep/schema (87 modules), @beep/alchemy-github-runners (25) and @beep/infra-ci-runners (6).
- The registry stays the one list beep create-package and beep lint identity-registry read and write. The three registry entries are untouched, so the leaf form PR 3422 requires of them still holds. A leaf cannot drift from its registry entry unnoticed. In @beep/alchemy-github-runners and @beep/infra-ci-runners a test compares the leaf with the registry composer for the same slug (identifier, IRI, CURIE and derived identifiers). @beep/schema exports no internal path, so its test checks that identifiers its modules mint through the leaf sit under the registry's $SchemaId and equal what the registry composer derives. In @beep/identity a test asserts that $BeepId equals $I.
- A guard test in @beep/infra-ci-runners builds the eight handler entries with Alchemy's bundler and the options of its Lambda bundle plan, and fails if any source map lists an @beep/identity source other than Id.ts, Root.ts and internal/schemaStatics.ts (an allowlist, so the registry, the barrel or any new identity module fails it). Adding the registry import to the webhook handler fails the webhook row and only that row.
- beep lint identity-registry enforces the rule: only a package's src/internal/<Composer>.ts may use $BeepId (root-composer-outside-leaf), that leaf holds exactly one $BeepId.create over its own registry slug (root-leaf-slug-mismatch), and no scanned module of a package with such a leaf imports @beep/identity/packages or the @beep/identity barrel, which both load the registry (leaf-package-registry-import).
- Every other package keeps importing its composer from @beep/identity/packages.

The identifiers do not change. Rebuilt bundles differ from main before PR 3422 only in module wiring: the registry's compose calls and its three extra create calls are gone and the leaves add one create per composer; every other create, make and annotation argument is identical, and each bundle is about 6.8 KB smaller. After PR 3422 merged, which rewrote the registry file, the rebuilt bundles and source maps were byte-identical to the ones built before it: the registry no longer reaches them. The handlers reach @beep/schema only through LiteralKit, but the leaf rule covers the whole package so no @beep/schema module needs a per-module judgement about bundle reachability.

The check-census re-baseline on this lane also rewrote two rows this change does not cause, because `bun run beep quality check-census --write-baseline` re-measures every row: @beep/repo-cli grew by about 83,000 instantiations inherited from main, and @beep/law-practice-domain shrank by 51. Only the @beep/schema rows and its typeperf fixtures move because of the leaf.

Lane fix/ci-runner-handler-identity-leaves

Reverse: point the modules of @beep/schema, @beep/alchemy-github-runners and @beep/infra-ci-runners back at @beep/identity/packages; delete their src/internal/*Id.ts leaves, @beep/identity/Root with its export * from ./Root.ts in identity/src/index.ts, and the IdentityLeaf, SchemaIdLeaf, Root and HandlerBundles tests; drop the leaf rules (root-composer-outside-leaf, root-leaf-slug-mismatch, leaf-package-registry-import) from beep lint identity-registry and their tests; revert the leaf paragraphs in the schema-first-development SKILL.md and references/local-primitives.md, then run beep skills update; then regenerate standards/policy-tools.fingerprint.json, the turbo.json inputs, the effect-vitest inventory and the check-census baseline with their writers

### CI runners step 1a resumes after a denied deploy, 2026-11-19

Cutover step 1a (run 44435840783) passed its plan check and stopped in the deploy step on 14 denied calls, all implicit: four EC2 creates on the parent VPC, iam:ListPolicyTags and lambda:GetFunctionConcurrency. It left 20 state rows created and 52 creating; five functions and the runner IMDS-disable policy exist in AWS with their state rows still creating. The CI goals driver ruled, through the orchestrator:

- Resume, do not delete. Completing a state-tracked creating row is not adoption while the resource carries the CiRunners/prod tags and CloudTrail shows the deploy session created it. Both hold for all six. No state row is deleted by hand and no Pulumi apply runs on the live fleet.
- Grants only; the fleet boundary and the explicit deny stay. The parent-VPC side of a create is its own statement (Ec2CreatesInOwnedVpc) on vpc/* under aws:ResourceTag for the ownership tags, with no literal VPC id; the request-tag condition on the created resource is unchanged. The two Lambda reads are held to beep-fleet-prod-* functions and the IAM reads and the default-version write to policy/beep-fleet/prod/*. The teardown grants are held to the fleet's own names. iam:DeleteRolePermissionsBoundary is not granted: the provider's call on role delete is patched out.
- The bootstrap expectation takes a resumed create: a create whose prior state is creating, with its saved bindings as noop or update, and the replace of an event-source mapping generation that never existed (type AWS.Lambda.EventSourceMapping, prior state creating, no outputs, incomplete props, no delete-first). Each prints its own label, inside the plan-rows digest. Routine and step 1b refuse the replace. With every plan relayed for such a row the gate shows zero mappings on beep-fleet-prod-* functions and no CreateEventSourceMapping in CloudTrail since the first run.
- The workflow gains plan_only (ends after the plan step, runs unarmed, can never reach the deploy step) expect_plan_digest (the deploy refuses unless its plan rows give that digest) and expect_plan_head (the deploy refuses, before it plans, unless it runs on that full commit SHA). The two pins travel together and both cutover dispatches refuse without them; the digest itself does not cover the commit. Order: the PR is merged by hand, the corrected policy is applied and evidenced, a plan_only bootstrap runs, the driver reads its rows, digest and the CloudTrail proof that it only read, and the bootstrap then runs on the same commit with that digest.
- The policy stays in customer managed policies, split in statement order at 6,144 characters by managedPolicyDocuments; the drain and destroy step detaches and deletes every one of them, all versions.
- Mappings name their function by ARN.

Evidence: research/p5-ci-runners-deploy-role-coverage.md.

Lane fix/ci-runners-deploy-role-read-and-vpc-grants · PR #3408

Reverse: revert the PR; the deploy role's managed policies return to the previous default version with aws iam set-default-policy-version, and the workflow loses plan_only, expect_plan_digest and expect_plan_head

### Drop r7a.2xlarge from the new CI runner fleet, 2026-11-19

The CI goals driver ruled it, through the orchestrator, on 2026-11-19: `r7a.2xlarge` leaves the
new fleet's heavy and shard-overflow type lists. The live Pulumi fleet is not changed.

**Evidence.** One count, the packet gate's recount, from the live heavy fleet's CloudTrail for
2026-11-19, 00:00Z to 23:20Z (`RunInstances`, `BidEvictedEvent` and `TerminateInstances`, plus the
GitHub job windows of each runner; workstation-local folder
`~/.cache/beep/ci-runners-step0/eviction-analysis-20261119/`, not in the repo). Hour rule: an
instance counts from its `RunInstances` time to its `BidEvictedEvent` time if it was evicted, else to
its `TerminateInstances` time, else to the end of its last job window; the two instances with none of
these count to the end of the data. Result: 504 Spot launches, 23 evictions over 83.4 instance-hours,
27.6 evictions per 100 hours for the fleet. `r7a.2xlarge`: 10 evictions over 6.5 hours, 152.8 per
100 hours, 5.54 times the fleet. By zone: us-east-1b 19.79 times (6 evictions), us-east-1d 3.12 times
(1 eviction), us-east-1c 2.60 times (3 evictions). The rule was: remove a type whose rate is at least
twice the fleet's in at least two zones. It holds in all three zones where the type was evicted.

**Heavy pool.** Six types remain: `r7i.2xlarge`, `r6i.2xlarge`, `m7a.4xlarge`, `m7i.4xlarge`,
`m6a.4xlarge`, `m6i.4xlarge`. The largest type still has 16 vCPUs, so the Spot budget's heavy term is
unchanged. `m6i.4xlarge` stays on watch through the green day; it is re-ruled if it has at least two
evictions in a second zone.

**Overflow pool.** `r7i.2xlarge` and `r6i.2xlarge` only, under the ICE watch below. The
amended rule allowed `m7i.2xlarge` (its family had no evictions in 16.1 hours) only when the measured
peak memory of the overflow jobs, plus 25%, fits in 32 GiB. No measured figure exists: the
shard-overflow job (`shard-overflow.yml`, Test Unit partitions) does not run under
`beep ci runner-resources`; only the heavy lanes in `heavy.yml` do. No guessed figure was used. A
4xlarge type never goes into the overflow pool, because it would double the pool's per-VM vCPU term.

**ICE watch.** During the green day, the overflow pool is re-ruled if any overflow job waits more
than 10 minutes for a runner because `CreateFleet` returned `InsufficientInstanceCapacity` for every
remaining override. A measured Test Unit partition memory peak, which the `m7i.2xlarge` branch needs,
is owed only if the watch trips.

**Order of the heavy types.** The heavy pool takes `RunnerInstanceType.literals` in order, so its
first type moves from `r7a.2xlarge` to `r7i.2xlarge`. Only the empty-overrides fallback in
`ScaleUp.program.ts` reads the first type. Override priorities come from list order only under a
`prioritized` allocation strategy, and both pools run the default `capacity-optimized`
(`lowest-price` for on-demand), which sets none. This is not a priority change.

**Reach.** The change is to `packages/tooling/infra/ci-runners/src/Config.ts` alone. The next
CiRunners deploy carries the pools' instance types in each pool function's runtime configuration
(`env`): the scale-up, job-retry and scale-down functions of both pools, six function updates. No
launch template or other resource changes. Those rows are attributed to this decision.

Lane fix/ci-runners-drop-r7a-2xlarge

Reverse: Re-add r7a.2xlarge to RunnerInstanceType and to the new heavy (and overflow) type lists in packages/tooling/infra/ci-runners/src/Config.ts

### CiRunners function updates re-apply each function role's policies, 2026-11-20

The CI goals driver accepted the 22 IAM writes of the PR 2 CiRunners deploy (run 44671153275, 2026-11-20) as an
idempotent role reapply, and made them a standing expectation for every CiRunners deploy that updates functions.

What the deploy did, from the deploy role's CloudTrail (two reads from saved events over 03:57-04:05Z, identical):

- `iam:AttachRolePolicy` (AWSLambdaBasicExecutionRole) and `iam:PutRolePolicy` (the role's own inline policy) on
  each of the 11 functions' execution roles, 22 writes in all, and no other role or policy.
- Each PutRolePolicy document was byte-identical, as canonical JSON, to the same role's document in the previous
  deploy (2026-11-19, run 44507595565).
- 22 log-group writes (CreateLogGroup, which already existed, and PutRetentionPolicy) on the 11 functions' log groups.

The plan shows the role rows as noop, but the Lambda provider re-PUTs each function's role policies when the function
is updated.

Standing rule: every CiRunners function-update deploy expects exactly these 22 IAM writes and 22 log-group writes. Its
post-check compares the targets, and each PutRolePolicy document against the previous deploy's. A differing document,
or any other role or policy touched, stops the cutover and goes to the driver. Counts come from saved CloudTrail events,
never from pretty-printed lines.

Lane docs/infra-alchemy-p5-m6i-and-iam-reapply

Reverse: if the provider stops re-PUTting role policies, drop the 22 expected IAM writes from the post-check; if a deploy shows a changed document, stop and re-rule

### Drop m6i.4xlarge from the new heavy pool, 2026-11-20

The CI goals driver re-ruled `m6i.4xlarge` on 2026-11-20, ahead of the green day: it leaves the new fleet's heavy pool,
which keeps five types: `r7i.2xlarge`, `r6i.2xlarge`, `m7a.4xlarge`, `m7i.4xlarge` and `m6a.4xlarge`. The overflow
pool never listed it, and the live Pulumi fleet is not changed.

Supersedes the same-day decision `2026-11-20-m6i-4xlarge-kept-on-the-new-heavy-list-after-the-re-rule`. That decision
set a re-rule trigger: a second zone with at least three `m6i.4xlarge` evictions at P < 0.05, or an overall per-hour
P below 0.01. Both were met under both treatments in the result table below: us-east-1f with five evictions, and an
overall P of 0.0011 (0.0038 conservative).

**Method.** The test is evictions per instance-hour in the live (old) fleet's Spot population, cumulative from
2026-11-19 00:00Z.

- **Data:** the gate's analysis.3 (to 2026-11-20 05:46:42Z) plus analysis.4 (05:46:42Z to 09:09Z), both workstation-local
  analysis files built from the fleet's CloudTrail `RunInstances` and `BidEvictedEvent` records and the GitHub job
  windows of each runner.
- **Hour rule:** an instance counts from launch to its eviction, else to its last job end plus two minutes, else to the
  window end.
- **Statistic:** a Poisson tail P(X ≥ k) for each zone and overall, against the rest of the fleet's rate (every type
  except `m6i.4xlarge`).
- **Two treatments** of the 16 analysis.4 instances with no end source:
  - as measured (to the window end);
  - a conservative bound (`analysis.4.conservative.txt`): open non-m6i instances count zero hours, which raises the
    rest-of-fleet rate, and open m6i instances count to the window end.

**Result.**

| Measure | As measured | Conservative bound |
| --- | --- | --- |
| Rest of fleet (per 100 instance-hours) | 27.1 (29 evictions in 106.97 h) | 33.9 (85.54 h) |
| `m6i.4xlarge` overall: 7 evictions in 5.70 h, P(≥7) | 0.0011 | 0.0038 |
| us-east-1f: 5 evictions in 4.72 h, P(≥5) | 0.0100 | 0.0236 |
| us-east-1d: 2 evictions in 0.67 h, P(≥2) | 0.0146 | 0.0222 |

The rule was met under both treatments: us-east-1f below 0.05 or the overall test below 0.01, with us-east-1d already
significant.

**Reach.** The change is to `packages/tooling/infra/ci-runners/src/Config.ts`. `m6i.4xlarge` leaves the
`RunnerInstanceType` literal and `instanceVcpus`, and nothing else references it. The heavy pool takes every literal, so
only the heavy pool's runtime configuration changes: its scale-up, job-retry and scale-down functions get env-only
updates. The largest heavy type still has 16 vCPUs, so the Spot budget is unchanged. The change rides the next checked
dispatch, with those rows attributed.

**New watch.** It replaces the `m6i.4xlarge` watch: re-rule the new heavy pool if a heavy job waits more than 10 minutes
for a runner while `CreateFleet` returns `InsufficientInstanceCapacity` for all five overrides. The overflow ICE watch
and the us-east-1b watch continue.

Lane fix/ci-runners-drop-m6i-4xlarge

Reverse: re-add m6i.4xlarge to RunnerInstanceType and instanceVcpus in packages/tooling/infra/ci-runners/src/Config.ts, with an env-only dispatch

### m6i.4xlarge kept on the new heavy list after the re-rule, 2026-11-20

**Superseded** by `2026-11-20-drop-m6i-4xlarge-from-the-new-heavy-pool`: the re-rule trigger below was met, and
`m6i.4xlarge` left the new heavy pool.

The CI goals driver re-ruled `m6i.4xlarge` on 2026-11-20 and kept it on the new fleet's heavy list. The heavy pool keeps
its six types; there is no Config.ts change and no extra dispatch.

Source: the workstation-local analysis `~/.cache/beep/ci-runners-step0/eviction-analysis-20261119/analysis.3.txt`
(the live heavy fleet's CloudTrail from 2026-11-19 00:00Z to 2026-11-20 05:46Z: 674 Spot launches, 31 evictions over
83.87 instance-hours, 37.0 per 100 hours).

- `m6i.4xlarge` overall: 4 evictions over 3.76 hours, 106.5 per 100 hours, 3.16 times the rest of the fleet
  (P = 0.040 under the rest-of-fleet rate).
- By zone, only us-east-1d is significant: 2 evictions over 0.67 hours, 8.84 times (P = 0.022). us-east-1f is
  2.14 times on 2 evictions (P = 0.24, consistent with chance), and us-east-1b had none. The removal rule (at least
  twice the fleet in at least two zones) is not met.
- `m6i.4xlarge` is 4.5% of fleet hours. In a fleet that hits InsufficientInstanceCapacity often, keeping the capacity
  diversity outweighs that excess.
- In us-east-1f, the zone with the most ICE, non-m6i types run at 0.68 times the other zones' rate, so there is no zone
  change. The ICE load there is covered by the overflow ICE watch.
- For comparison: `m7i.4xlarge` had no evictions in 19.98 hours, and `r7i.2xlarge` ran at the fleet rate.

New trigger through the green day, cumulative from 2026-11-19 00:00Z: re-rule if a second zone reaches at least three
`m6i.4xlarge` evictions with P < 0.05, or if the overall per-hour P falls below 0.01.

Lane docs/infra-alchemy-p5-m6i-and-iam-reapply

Reverse: a Config.ts PR removing m6i.4xlarge from the new heavy list, plus an env-only dispatch

### Orphaned runner-tarball upload parts accepted as residual risk, 2026-11-20

The CI goals driver accepted a residual risk on 2026-11-20 for the runner-tarball mirror, which is now a multipart
upload: orphaned parts in the new fleet's binaries bucket.

- **When it happens:** an upload's `AbortMultipartUpload` never runs, because the binaries-syncer function is killed
  by its 5-minute timeout or by running out of its 1024 MB, or the abort itself fails. The upload's parts then stay in
  the bucket, stored and billed.
- **Bound:** the syncer runs once a day and uploads only when a new runner release appears. So at most one orphaned
  part set of at most 228 MB a day (the v2.338.2 asset is 228,071,396 bytes).
- **Why no lifecycle rule:** an `AbortIncompleteMultipartUpload` rule would clean these up automatically. But the
  CiRunners deploy role has no `s3:PutLifecycleConfiguration`, and adding it would be a new deploy-role write.
- **Cleanup:** by hand. List with `aws s3api list-multipart-uploads --bucket <binaries bucket>`, then abort each with
  `aws s3api abort-multipart-upload`.
- **Watch:** the post-deploy check after every CiRunners deploy confirms `ListMultipartUploads` is empty after the
  announced one-off syncer invoke.

Lane fix/runner-binaries-s3-upload

Reverse: give the CiRunners deploy role s3:PutLifecycleConfiguration on the binaries bucket and add an AbortIncompleteMultipartUpload rule of 1 day

### PR 2 dispatch before the per-pool proofs, 2026-11-20

The CI goals driver (the successor driver, 2026-11-20 02:10Z) ruled the order of the remaining P5 cutover steps:
the PR 2 dispatch, which deploys the handler identity leaves (#3431) and the r7a.2xlarge removal (#3430) to the
CiRunners stack, now goes before the per-pool proofs.

New order: PR 2 dispatch, then the operator adds the new-fleet repository webhook, then the heavy proof, the
overflow proof, BEEP_SHARD_OVERFLOW off, step 4a, step 4b, the post-4a pin bump, BEEP_SHARD_OVERFLOW on, the green
day, step 6b and the drain.

Conditions on the dispatch:

- A plan_only on the then-current main must show exactly 11 function rows `changes code (bundle hash, inferred)`.
  Exactly six of them (scale-up, job-retry and scale-down of both pools) also carry env, and that env diff is
  only r7a.2xlarge leaving the instance-type list. Each #3423 reconcile row is named; every other row is noop.
  Any other row stops it. If main moves before the dispatch word, a fresh plan_only on the new main is required.
- It waits for the driver's explicit word after the plan clears, and not before the heavy burst ends
  (03:54:14Z, 2026-11-20). CI_RUNNERS_ROUTINE_ARMED is set for that one dispatch only.
- Its proof is CloudTrail: GetPolicy on the webhook function's URL permission and no RemovePermission or
  AddPermission. Without that proof, step 4a does not go.

Lane docs/infra-alchemy-p5-dispatch-order

Reverse: restore the proofs-before-PR-2 order; re-proof each pool after the PR 2 dispatch

### Build queue: a waiting job lives a day and never reaches the DLQ for waiting, 2026-11-22

The new fleet's build queues moved a message to their DLQ after five receives at a two-minute visibility timeout, about
ten minutes. Scale-up returns a message over the pool's cap as a batch item failure, so every wait for a free slot costs
one receive. Nothing redrives the DLQ, so a job that waited ten minutes for capacity would stay queued until GitHub
times it out. The CI goals driver found this before the cutover and ruled the bar: a message waiting on the cap or on
capacity lives at least 24 hours and does not reach the DLQ for waiting alone.

**Measured on the live fleet's queue**, which has no redrive, a 30-second visibility timeout and one-day retention:

- Seven days: 2,113 messages sent and 1,502,086 received.
- Waiting is the normal state: in six hours on 2026-11-20 between 170 and 210 messages were in flight on average.
- The redelivery interval is the visibility timeout: receives per waiting message give 30.0 to 30.1 seconds in each of
  those hours.
- `ApproximateAgeOfOldestMessage` does not show this. It stayed at or under 140 seconds, because SQS leaves out messages
  received more than three times.

**Change**, on the build queue only:

- **No redrive policy.** The DLQ stays for the dead letters scale-up sends itself, which the SSM fix (#3454, merged before
  this) adds with the DLQ URL and the send grant. Nothing else reaches it, so a nonzero build-DLQ depth still means a
  deliberate dead letter. A message whose DLQ send fails is acknowledged with an error line, not returned: with no
  redrive it would relaunch an instance once a minute for the retention. An ERROR line in a scale-up log is a STOP in
  every proof and post-check. SQS allows at most 1,000 receives, which would need a visibility timeout of at least 87
  seconds to cover 24 hours; a redrive that the retention always beats protects nothing.
- **One-day retention**, as on the live fleet. The source set none, so the queues had SQS's default four days. It also bounds how long a cancelled
  job's message is retried.
- **One-minute visibility timeout**, down from two. It equals the scale-up function's timeout, the lowest value Lambda
  accepts for the mapping without redelivering a batch that is still being handled. A freed slot idles at most a minute
  when one message waits, against 30 seconds on the live fleet, whose function timeout is 30 seconds. The new
  function's longest run is 5.9 seconds so far, on few runs, so its timeout is not lowered here.

**Other messages.**

- A body that does not decode is acknowledged and dropped, now with one warning that names the message id and never the
  body.
- Scale-up returns a message whose event is not `workflow_job`, which now lives a day instead of five receives. The
  webhook cannot enqueue one: it answers 202 to any other event before it builds a message, and writes the checked
  event type into the message.
- A message whose handler keeps failing as a whole (configuration, GitHub or AWS outage) is retried for a day and then
  expires, as on the live fleet.
- The job-retry and deregister-retry queues keep their redrive of three receives and their retention.

**Plan expectation.** Alchemy replaces a queue only for a new name or FIFO flag, and declares the name, URL and ARN
stable, so both `BuildQueue` rows update in place and no dependent row is expected to change.

- Planned together with the SSM fix: 73 rows, 13 update and 60 noop, its accepted table plus the two `BuildQueue` rows.
- Planned after the SSM fix is deployed: 73 rows, 4 update and 69 noop, the two `BuildQueue` rows and both scale-up
  functions (code), unless the bundle diff shows another function that carries `scale-up.ts`.

A replace, or a dependent row with a new label, goes to the CI goals driver before a digest is accepted. The post-check
adds exactly two `SetQueueAttributes`, each confirmed by reading the attributes back: no redrive policy, retention 86400,
visibility 60, both DLQs unchanged, and both event source mappings still enabled.

**Order.** This must be deployed before the new fleet goes primary and before the webhook switch.

Reverse: drain the build queues, then set the 2-minute visibility timeout, the 5-receive redrive and messageRetentionPeriod 4 days explicitly on BuildQueue and redeploy; removing the retention property does not restore the default, and a message already received five times would go to the DLQ

### OpenClaw stays declared and tested, not installed (operator ruling), 2026-11-22

The operator ruled on 2026-11-22: OpenClaw is not installed on the workstation. `HostsOpenClaw`
(`packages/tooling/infra/infra-hosts/openclaw.alchemy.run.ts`) stays declared and tested, and is not deployed.

- **Why:** the install `HostsOpenClaw` manages does not exist on DankStation, checked read-only on 2026-11-22: no state
  directory `/var/lib/beep/openclaw` and no `openclaw.service` unit. Pulumi never had a stack for it (decision
  `2026-11-13-hosts-no-pulumi-state`). So nothing the stack would manage is live or left unmanaged. The workstation does
  hold a personal `~/.openclaw` from an earlier hand trial (last written 2026-10-05) and an inactive mise shim; the stack
  never managed either, and this ruling leaves both alone. This corrects the 2026-11-13 record, which assumed an OpenClaw
  deployment on the host. Installing it would add a root toolchain and a new 1Password
  service-account credential file for a service nobody runs.
- **Criteria amended:** the SPEC acceptance criterion and the P4 row named AI metrics and OpenClaw. They now ask that AI
  metrics deploys through `@beep/infra-hosts`, and that the OpenClaw stack is declared and tested there.
- **P6 unchanged:** the OpenClaw Pulumi program and its `infra/` files are still deleted with the other host program.

The same day the operator set the AI metrics session, which needs them present, for after P5, once the new runner fleet has
passed its proofs.

**Source.** The operator answered a structured prompt in the packet gate's T3 thread on 2026-11-22. The answers are quoted
as given, and each is the label of the option chosen:

- "Should it be installed?" (OpenClaw): "Don't install (Recommended)".
- "When should we do it?" (AI metrics): "After P5 (Recommended)".

Lane goals/infra-alchemy-rebuild-p4-rulings

Reverse: run the attended OpenClaw bootstrap, deploy HostsOpenClaw, and restore the two criteria

### Production turns the job-queued check on (reverses ruling A), 2026-11-22

This reverses the "job-queued check stays off in production" paragraph of
`2026-11-22-ssm-fix-advanced-jit-tokens-no-relaunch-loop-dead-letter-without-a-redrive.md` (ruling A). The CI goals
driver ruled the reversal after the P5 step 4b deploy, and this record.

**The finding.** After 4b raised the caps (heavy 1 → 2, overflow 2 → 48), heavy-build held a steady in-flight backlog
(18 messages at the arm, 25 at 21:16Z) while GitHub showed no queued `beep-fleet-heavy` job. These are messages for jobs
that were already served. Scale-up's over-cap path leaves a message on the build queue with no log line, SQS redelivers
it after the visibility timeout, and with the check off nothing drops it, so every redelivery that finds a free slot
launches a runner for a job that no longer needs one. The 21:21Z reading had 8 launches since the update: 6 took a job,
1 was reaped idle and 1 was still waiting. The old Pulumi fleet showed the same mechanism at scale after 4a: about 234
stale messages relaunched idle Spot runners until the queue was purged. Each idle launch is bounded (the runner is reaped),
but it is a VM per stale message and it holds a cap slot a queued job could use.

**Why the original reason no longer holds.** Ruling A kept the check off because the live fleet's jobs API answered
"not queued" for jobs that were queued, and two of seven pickup probes sat queued for over 25 minutes. That live
predicate read every status except `queued` as "no runner needed". Since #3454, `isJobQueued` is false only for
`in_progress` and `completed` (`GitHubApp.layer.ts`, `isTakenJobStatus`): a lagging read shows an earlier state
(requested, waiting, pending), which still launches. The check stays fail-open on a GitHub error, and every status
other than `queued` is logged with the job, the status and the answer.

**The change.** `PoolSettings` gains a required `jobQueuedCheck`; `productionConfig` sets it `true` for both pools and
`toRunnerPool` passes it to the fleet. Personal stages inherit it through `personalConfig`. The deploy plan is six
env-only rows (`BEEP_RUNNER_CONFIG.pool.jobQueuedCheck` false → true on each pool's scale-up, scale-down and job-retry)
with identical bundles, and the test that pinned the check off now pins it on.

**How it is checked after the deploy.** Every scale-up "the job's status is not queued" line with `queued: false` names
a job whose status is `in_progress` or `completed` and whose `started_at` precedes the line. A `queued: false` line for any
other status, or before the job started, is a STOP and a rollback (set it back to `false`).

Lane fix/ci-runners-prod-job-queued-check

Reverse: set jobQueuedCheck false for both pools in productionConfig and redeploy: six env-only rows, nothing migrated

### SSM fix: Advanced JIT tokens, no relaunch loop, dead-letter without a redrive, 2026-11-22

The new fleet's heavy proof failed on 2026-11-20: scale-up launched an instance, registered a JIT runner for it, failed
to store the runner's token in SSM, terminated the instance, and relaunched every two minutes (three times in all). The
CI goals driver ruled the fix and this record.

**Advanced tier.** Both token writes (the JIT config and the `config.sh` arguments) use the Advanced parameter tier. A
Standard parameter holds at most 4 KB, and a JIT config carries an RSA key and can exceed that. The live fleet writes
the same token at Advanced. This is the probable cause: the rejected calls recorded no error code, so the new log line
has to confirm it on the heavy re-proof, and a different SSM error there is a new ruling, not a retry.

**Cost.** Advanced parameters bill per parameter-month, prorated, on the line the live fleet already pays per runner. Three
deletion paths bound each token:

- The runner's start script deletes its own token parameter right after reading it at boot.
- The SSM housekeeper runs once a day and deletes token parameters last modified more than one day ago. A token whose
  instance dies before boot therefore lives at most about two days.
- A configuration that fails after the put also deletes the token, then the JIT runner, then terminates the instance.

**The job-queued check stays off in production.** The failed message was redelivered to scale-up after the build queue's
two-minute visibility timeout, so a launch followed the cancelled run. This fix first turned scale-up's check on, and
turned it off again before the merge:

- The live fleet keeps it off because GitHub's jobs API answered "not queued" for queued jobs. With the check on, two of
  seven pickup probes sat queued for over 25 minutes (`goals/ci-fleet-endgame/research/OPPORTUNITIES.md`).
- The not-queued branch acknowledges the message with no launch, no retry and no dead letter. It is fail-open only on a
  GitHub error.
- The relaunch is closed without it: a failed configuration never goes back to the build queue (amended 2026-11-22: a
  failed DLQ send used to). A cancelled job whose message SQS redelivers for another reason (over the cap, a launch shortfall) costs one
  VM, as on the live fleet.

A test decodes both deployed runtime configurations and pins the check off for both pools.

**What "not queued" means.** Job-retry always asks GitHub for the job's status, as the live fleet's does, and drops the
message when the job needs no runner. The live fleet reads every status except `queued` that way, and so did this port.
Now only `in_progress` and `completed` do: a lagging read normally shows an earlier state (requested, waiting, pending), not a later one. That is an
inference. The status the two stranded probes got was never recorded. Every status other than `queued` is logged with
the job and the answer, and job-retry logs the message it drops with its retry counter.

**What remains.** A transient configuration failure has lost its runner and relies on job-retry alone. A wrong
`in_progress` or `completed` at 120 seconds still drops that job, now with a log line. The live fleet instead redelivers
such a failure to scale-up, unchecked. In every proof and post-check, each drop line must be `in_progress` or
`completed`, with the job's start or completion time before the line; one that is not is a STOP.

**Failure classification.**

- A throttling code is transient whatever the status. Otherwise the AWS layer's fault reading decides, then the HTTP
  status. A GitHub 403 or 429 rate limit is transient.
- A conflict in the two steps that create under an instance-unique name reads as the first attempt having landed after
  a lost response: SSM `ParameterAlreadyExists` or a 409 on the token put, and a GitHub 409 on `generateJitConfig`. Both
  are transient, bounded by the two job-retry attempts. Every other conflict stays deterministic. A GitHub 409 carries
  no runner id, so its cleanup cannot delete that registration: an offline JIT registration remains, not a running
  machine.
- A transient failure goes through job-retry (120 s, then 240 s). When no retry can be published, it is dead-lettered
  like a deterministic one.

**Dead-letter semantics.** When a message is dead-lettered, its instance is terminated once, its JIT runner and token are
deleted, and the message is sent to the pool's own build DLQ and acknowledged. A failed DLQ send is logged as an error and
the message dropped (amended 2026-11-22, #3457): returning it would relaunch an instance once a minute for the build
queue's one-day retention, since that queue has no redrive, and the job is lost either way.

- **Nothing redrives a dead-lettered message.** No consumer and no automatic redrive exist, so that job stays queued
  until GitHub times it out.
- **A nonzero build-DLQ depth is therefore a STOP** in every proof and every post-check of this stack, next to the
  other build and job-retry queue counts.
- **An ERROR line in a scale-up log is a STOP** in every proof and post-check too: a dropped message after a failed DLQ
  send leaves no queue depth, only that line. One send failure writes two error lines, the failed send and the
  dead letter it was for, and the rule counts lines.

Lane fix/ci-runners-scaleup-jit-token-tier

Reverse: revert the SSM-fix commits and redeploy the previous CiRunners head; nothing is migrated, and tokens already in the Advanced tier are removed by their own deletion paths

### Environment secrets come from a workstation-only InfraGithubSecrets stack, 2026-11-23

Ruling relayed by the orchestrator on 2026-11-23: the operator wants the fleet-watch App's secret managed as code, not set by hand. The packet-gate ruling of 2026-11-13 still holds, so no credential that can read 1Password enters CI.

`@beep/infra-github` gains a second Alchemy stack, `InfraGithubSecrets` (`secrets.alchemy.run.ts`). It has its own state under the shared S3 store and owns only `GitHub.Secret` resources declared by `productionSecretsConfig`. Each value is read at deploy time from 1Password through the PATH `op` shim (`op run --env-file=secrets.env`), so the committed env file holds `op://` references only. Values stay `Redacted`, which keeps them out of logs and state, and the upload is sealed to the environment's public key. The stack refuses to start when `CI` is set, and on `prod` it requires `INFRA_GITHUB_SECRETS_PLANE=workstation`. No workflow references it, and a package test checks that. The CI stack lists each owned secret as unmanaged. The first entry is `fleet-watch/FLEET_WATCH_APP_PRIVATE_KEY`, from the `beep-fleet-watch GitHub App` item. The agent service account can read that item, so an agent can apply it. Each apply is an announced live step.

Rejected: a scoped 1Password service-account token as an `infra-github-prod` secret. It would put a long-lived credential into CI.

Lane feat/fleet-watch-app-and-env

Reverse: Delete secrets.alchemy.run.ts, secrets.env, src/Secrets.ts with its index.ts export and test/Secrets.test.ts, the declareSecrets case in test/ReadOnlyProviders.test.ts, and productionSecretsConfig with its README section; the secret stays in GitHub, unmanaged, with its Production.ts reason restored to awaiting a delivery route.

### Standing missed-event check: GitHub-only verdicts on a hosted schedule, read-only, fails on alert, 2026-11-23

The CI goals driver ruled a standing check for runner jobs that GitHub queued and the new fleet never served. The ruling came on 2026-11-19, and the driver specified the check on 2026-11-22. On 2026-11-23 it added token ruling 2′, amended the signals, and returned six blocking corrections in its first read. The check is its own pull request, after P5 step 4a and merged before 6b. Until it merges, the gate's local watch (`watch-once.sh`) covers 4a through the green day. This record is the check's specification and is written before any code.

**What it detects.** The check runs once for each `beep-fleet-*` job that is still `queued`. The trigger reads actions and runners only, so it works the same before and after 6b. Delivery evidence only classifies a trigger, and only before 6b.

A pool makes **progress** when at least one of its jobs started in the last 15 minutes (a `started_at` in that window and a `runner_name`). Progress counts every run the check reads, older `in_progress` runs included. Launches count only runs created in the last two hours.

| Verdict | Alerts | Condition |
| --- | --- | --- |
| `Stuck` | yes | The pool is at cap, a runner of the pool is idle in both runner reads of the run, and the job was created at or before the first runner read. A job created between the reads may simply not have been picked up yet. |
| `Wedged` | yes | The pool is at cap, at least one counted runner is not busy (offline or idle) in the second runner read, a pool job has been queued 15 minutes or more, and the pool made no progress. |
| `MissedDelivery` | yes, before 6b | No 2xx `queued` delivery for the job on repository hook 714397446, 5 minutes or more after the job was created. |
| `NoLaunch` | yes | The job has been queued 10 minutes or more, the pool is below cap counting registered runners, the pool has no idle runner in the second runner read (a runner that just booted counts), and one of three holds. The launches since the job's creation cover its rank (launches ≥ rank, and the job is still queued). Or the pool made no progress. Or the job has been queued 2 hours or more. This is the trigger. |
| `WaitingAtCap` | no | The pool is at cap, and no `Stuck` or `Wedged` condition holds. All runners busy at cap stays here. |
| `Waiting` | no | The pool is below cap, and no earlier verdict holds: every remaining below-cap case. With progress, a job queued under 2 hours whose launches since its creation are fewer than its rank (the pool's queued jobs created at or before it, itself included) is here. So is a job queued under 10 minutes, and a job whose pool has a runner idle in the second runner read, with or without progress. |

**Precedence.** A job gets the first verdict that holds, in this order: `Stuck`, `Wedged`, `MissedDelivery`, `NoLaunch`, `WaitingAtCap`, `Waiting`. Below the 10-minute threshold a job is `WaitingAtCap` or `Waiting`, unless `Stuck`, `Wedged` or `MissedDelivery` holds. With no runner idle in the second runner read, `Waiting` needs progress: with no progress, a job queued 10 minutes or more below cap is `NoLaunch` whatever its rank, so a total scale-up outage cannot hide as `Waiting`. Launches are read only from runs created in the last two hours, so such a job queued 2 hours or more below cap is `NoLaunch` whatever its rank or progress: an undercount of launches cannot leave it `Waiting` forever. A runner idle in the second read keeps a below-cap job `Waiting`: it may have just booted for the job.

Each `NoLaunch` carries a classification:

- **Before 6b:** `lost` (a 2xx delivery and still no launch) or `unknown`. A delivery page or detail failed after its retries, a candidate detail names no workflow job (its request or payload is absent), or the pages read do not reach back to the start of the job's delivery window (its creation minus 2 minutes). A failed read is unknown, never a miss. A job with no 2xx `queued` delivery reports as `MissedDelivery`, which ranks above `NoLaunch`. A 2xx delivered later than the job's creation plus 5 minutes falls outside the window and reads as missed, which is accepted.
- **From 6b:** `delivery evidence: gate`. The check reads no deliveries.

Not alerts: `WaitingAtCap` and `Waiting`. The p95 queue-to-start of the pool's jobs that started in the window goes in the summary only.

**Signals.** GitHub only. The check makes no AWS call and keeps no state between runs.

- **Runners.** Read from the org's self-hosted runners with their labels, twice in each run, 300 seconds apart. A counted runner is a registered `beep-fleet-*` runner of the pool, in one of three states:
  - `online` with `busy=false`: idle for this read;
  - `busy=true`: serving;
  - `offline`: booting, or a ghost. It counts toward the cap, never as idle.
- **Idle.** A runner is idle only when the same runner id is `online` and not busy in both reads. That holds for 300 seconds or more, with no cross-run state and no launch-time estimate.
- **Cap.** The cap is read at the first runner read and again at the second. A pool counts as at cap when either read is at cap, and as below cap only when both are. One cycling runner briefly reads below cap, and a single early read misclassified jobs that were waiting at cap (2026-11-22, 21:53Z pass).
- **Launches since a job's creation.** The pool's jobs with `started_at` at or after that creation and a `runner_name`, plus the pool's currently registered runners that are not busy. A job cancelled or skipped while queued gets a `started_at` without a runner, so it does not count. That trap was measured on 2026-11-22.
- **Jobs.** Read from the runs and jobs APIs with paging over every page, up to 50 pages per listing (a single `per_page=100` page is not enough). A listing that stops at 50 pages with fewer items than its total count fails the run as a read error, never a silent partial result. A listing that fits on one page is accepted on its first walk; any other listing is accepted when two consecutive walks of it agree. Once a first walk is not accepted, a later walk needs that agreement even when it fits on one page. After three walks without agreement the check uses the union of the walks' ids and adds `listing unstable (N walks)` to the summary. That is not a read error: a busy-hour listing must not red like an alert, and a job missed in one run is caught 10 minutes later. A repeated id counts as a disagreement and goes into the union. Real read failures (an HTTP error, a decode failure, a truncation or an empty page short of its own reported total, even when the total changed between pages) stay read errors. The runs are the `queued` and `in_progress` runs plus the runs created in the last two hours, which carry the started jobs for launches and progress. The jobs are the ones carrying a `beep-fleet-*` label.
- **Deliveries, before 6b only.** Read from repository hook 714397446 by cursor paging, newest first, once per run, back to the oldest alerting job's creation minus 2 minutes. Each delivery's detail is fetched once and cached. Delivery ids exceed 2^53 and stay strings end to end.

**Cap source.** Each pool's `maximumCount` has one source of truth: the production configuration in `packages/tooling/infra/ci-runners/src/Config.ts`. A generated input projects it for the check, and a test asserts the projection equals the production configuration for each pool and phase. Nothing in the workflow holds a cap literal, and overflow ON or OFF needs no workflow edit: the toggle changes which jobs carry the overflow label, not a pool's cap. The caps follow `main`, not the live fleet: between a cap change's merge and its deploy, the check reads the merged cap.

**Where it runs.** A scheduled workflow every 10 minutes on a hosted `ubuntu` runner, never on `beep-fleet`: the check must not depend on the fleet it watches. The logic is a `beep ci` subcommand in repo-cli. The workflow runs it from source, so it is not in the CI binary's closure, and its merge needs no binary release or pin-sync proof. A run lasts at least the 300-second gap between its two runner reads.

**Contracts.** Four services, so the tests run instantly with fakes:

- a GitHub reads service (runs, jobs, org runners, hook deliveries and delivery details);
- a token provider;
- the clock;
- a sleep seam for the 300-second gap.

**Token (ruling 2′).** A new read-only App, `beep-fleet-watch`, installed on `beep-effect/beep-effect` only.

- **Permissions:** actions read, organization self-hosted runners read and repository hooks read.
- **Key:** an Actions secret in the `fleet-watch` environment. The environment deploys from `main` only, and only the scheduled check uses it.
- **Tokens:** the workflow mints them with exactly those three permissions.

This is an explicit exception to the 2026-11-13 rule of one long-lived credential in CI, and the operator accepts it when creating the App. The fleet App (`beep-ci-fleet-controller`) is out: its key mints admin-write tokens and never leaves its store.

The code reads the installation token through the token provider, and the tests use a fake. So the check is built before the App exists. The workflow merges only once the App and environment exist, through the operator's hand merge.

**Hook source is configuration.** Before 6b the source is repository hook 714397446 (the new fleet's Lambda URL). From 6b there is no hook source at all: the check does not read `/app/hook/deliveries`. The 6b pull request does three things together:

- it sets the source to none;
- it drops or idles the repository-hooks read;
- it switches the classifier to `delivery evidence: gate`.

A run whose window spans the switch classifies each job by the configuration in effect at the job's creation.

**Failures and remedies.** A run fails on any alerting verdict. The step summary names the previous scheduled run and its time: the newest scheduled run created before this one, so a newer scheduled run pending behind this one is skipped. A manual dispatch, which is not in the scheduled runs, names the newest. The gap is measured from one scheduled run to the next, and a manual dispatch does not reset it. The gate and the green-day watch treat a gap of more than 30 minutes between scheduled runs as a finding. The summary lists each alerting job with:

- its id, pool, age, verdict and classification;
- before 6b, its delivery evidence (delivery id and status code, or the window read and the oldest delivery reached);
- the remedy commands, never run by the check:
  - **Before 6b:** when a 2xx or failed `queued` delivery exists, the redelivery (`gh api -X POST repos/<repo>/hooks/<hook>/deliveries/<id>/attempts`). When the delivery is `missed`, `gh run cancel <run>`, then, once the run completes, `gh run rerun <run>`.
  - **From 6b:** the gate's enrichment and App-redelivery command, and the same cancel and rerun pair.
  - The cancel and rerun pair is marked as the gate's call: it reruns the whole run. `gh run rerun --failed` refuses a run that is still in progress, so the summary never prints it for a queued job.

The check never redelivers, cancels, reruns or writes anything. It files no issue and adds no alert service. A green run writes one summary line: jobs checked, verdict counts, p95 queue-to-start, the previous run's time and the number of GitHub requests the run made (the installation-token budget at 144 runs a day). A setup or install failure turns the run red too, so the gate reads the summary heading `## Fleet missed-event check: N alert(s)`, not the run's colour.

**Tests.** They are built from the watch's dry runs, as fixtures:

- each verdict, each `NoLaunch` classification, and the precedence order;
- a delivery walk that reaches the job's creation but not its window start, creation minus 2 minutes (`unknown`);
- a listing stopped at 50 pages with fewer items than its total count (a read error, "listing truncated at 50 pages"; never a silent partial result);
- a listing whose ids change in every one of three walks (the union of the walks' ids, with `listing unstable (3 walks)` in the summary; not a failure);
- a delivery walk stopped at 60 pages (`unknown`);
- a detail read that fails (`unknown`);
- the rank rule with progress (`Waiting` with 3 launches for rank 4);
- a total outage: 0 launches and 3 jobs queued 10 minutes or more below cap, all `NoLaunch`;
- launches that cover the rank while the job is still queued (`NoLaunch`, watch-once's LOST rule);
- a job queued 2 hours or more below cap with progress and launches below its rank (`NoLaunch`, not `Waiting`);
- a cap read that cycles between the two runner reads (`WaitingAtCap`, not `Stuck`);
- an idle runner at cap in both reads (`Stuck`);
- an idle runner at cap in both reads and a job created between the reads (`WaitingAtCap`);
- a runner idle only in the second read, below cap, a job queued 12 minutes, with progress (`Waiting`);
- a runner idle only in the second read, below cap, a delivered job queued 12 minutes, without progress (`Waiting`);
- a 2xx `queued` delivery whose detail names no workflow job (`unknown`, not `MissedDelivery`);
- an empty page short of a total that changed between pages (a read error, never the union of partial walks);
- a paginated listing whose next walk fits on one page (accepted only when a third walk agrees);
- a newer scheduled run pending while this one runs (the previous run is the newest created before this one);
- two ghost `offline` runners at cap 2 with a job queued 20 minutes and no progress (`Wedged`);
- two busy runners on 40-minute jobs at cap 2 (`WaitingAtCap`);
- the 6b switch in the middle of a window (a job created before it is classified from deliveries; one created after it gets `delivery evidence: gate`);
- a runner registered `offline` below cap;
- launches that exclude a job cancelled or skipped while queued;
- the cap projection equal to the production configuration.

**Order.** The check lands as its own pull request before 6b. It touches a workflow path, so it needs the operator's hand merge and the driver's read, at a head whose tests are built from those fixtures. The watch stays the gate's tool until this check is green on `main`.

Lane feat/ci-missed-event-check

Reverse: delete the scheduled workflow and the beep ci subcommand, uninstall and delete the beep-fleet-watch App, and delete its fleet-watch secret; the gate's local watch covers the window again; nothing is migrated

### The missed-event check's schedule runs at minute 3 of each ten, 2026-11-24

After #3499 merged at 2026-11-24T00:04:06Z, `fleet-missed-event-check.yml` (cron `*/10 * * * *`, workflow active) had no scheduled run in over two hours. Its only runs were two manual dispatches, 45297774933 and 45308658599, both green, and the repository's other cron workflows fired as usual. The working diagnosis is that GitHub never registered the new workflow's schedule. A push to the default branch that changes the file makes GitHub read the schedule again, so this PR changes it.

The change is the cron itself: `3-59/10 * * * *`, still every ten minutes, at minutes 3, 13, 23, 33, 43 and 53. GitHub delays scheduled runs at periods of high load and names the start of every hour as one; at sufficient load it drops some queued runs. `*/10` puts one run in six on the hour. The repository's other crons already use off-boundary minutes (`41 4 * * *`, `17 9 * * *`).

No alert for a missing schedule is added to the check. A scheduled run exists only when the schedule fires, so the check can report its own missing schedule only from a manual dispatch, which already prints `previous scheduled run: none found`. Between scheduled runs, a gap of more than 30 minutes is already reported as a finding for the gate. Detecting a schedule that never registers needs a watcher outside this workflow.

Lane fix/ci-missed-event-check-cron-offset

Reverse: Set the cron in .github/workflows/fleet-missed-event-check.yml back to "*/10 * * * *" and the schedule assertion in ci-fleet-missed-event-check.test.ts to match.

### The missed-event check stops reading a job's delivery details at its first 2xx, 2026-11-24

The first run of the standing check (run 45297774933, 2026-11-24) spent 5m36s in its check step: the 300-second gap between the runner reads plus about 36 seconds of reads, 275 GitHub requests in all. A live measurement of the same reads without the gap counted 281 requests, 197 of them delivery details: every `queued` delivery inside any due job's seven-minute window was read, though only the one naming the job decides it.

The check now reads each job's candidate details nearest the job's creation first, four at a time, and stops at the first 2xx delivery whose detail names the job. Details already read for an earlier job are reused. A job with no such delivery still reads every candidate, so `DeliveryFailed`, `NotDelivered` and `Unreadable` are judged on the same reads as before; only `Delivered` can now name a different delivery id when a job has two 2xx deliveries. The same live measurement after the change counted 83 requests in 14 seconds, 4 of them details.

The 300-second gap and the job listings (one per run created in the last two hours, about 70) are unchanged: the gap is the specified stuck-runner test and the listings feed launches, progress and the p95. With the gap and about 40 seconds of setup, a run leaves roughly four minutes of the ten-minute cadence for reads; they now make about a third of the requests, so each request in a slow API hour can take about three times as long before a run outlasts the cadence.

Lane fix/ci-missed-event-check-request-budget

Reverse: Restore readDetails in FleetMissedEvent.command.ts to read every candidate id concurrently and drop the four delivery detail budget tests.

### Step 6b deletes the Pulumi repository webhooks and keeps the fleet's, 2026-11-25

Cutover step 6b (`2026-11-14-ci-runners-cutover-from-pulumi`, step 6 (b)) takes the Pulumi controllers off `workflow_job` delivery. Three repository webhooks deliver it today: 663255260 and 711445970 point at the Pulumi heavy and overflow controllers' `execute-api` URLs, and 714397446 is the overlap hook on the new fleet's function URL. The CI goals driver ruled option B on 2026-11-25. At T = 2026-11-26T16:00Z, hooks 663255260 and 711445970 are deleted, and 714397446 stays as the fleet's only delivery path. The runner App's webhook is not pointed at the function URL.

**Why B.** The missed-event check reads repository hook deliveries with the fleet-watch App's `repository_hooks: read`. App webhook deliveries can be read only with the App's JWT. Moving delivery to the App (option A, the cutover decision's original step) would leave the check with no delivery evidence from T onward: its `MissedDelivery` and `Delivered` verdicts would end, and only `Gate` evidence would remain. B keeps them live. B also has fewer moving parts at T: no App URL change, no JWT, no overlap window. Repository and App webhooks use the same delivery machinery, and the fleet serves this one repository. Option C, keeping both paths onto the function URL, would deliver every event twice. The fleet's webhook path has no dedupe and its queued check is off in production, so C would need new dedupe code, and it was rejected. No code changes: the check's hook timeline keeps naming repository hook 714397446, and `ci shard-overflow-preflight` keeps requiring a live repository hook to the function URL.

**Correction, 2026-11-26.** The settings-page read relayed on 2026-11-25 was wrong about the URL: the `beep-ci-fleet-controller` webhook URL is a GitHub pull request link, not the Pulumi fleet's `execute-api`. The App webhook was therefore not a live fleet delivery path at T, and setting it inactive (2026-11-26T03:38:19Z) was housekeeping. Step 6b's delivery change was exactly the two repository webhook deletions, and its proof rests on 714397446 alone: the hook list showed only 714397446, its deliveries after T were all 2xx, and Heavy / Doctest started on a `beep-fleet-heavy-i` runner at 03:45:00Z. Whether the App itself is retired, with its URL left as it is, is the cutover's step 6 (f) choice. The original paragraph is kept below for the record.

**The App webhook.** The runner App's settings page was read on 2026-11-25 at about 21:45Z, with the operator's sudo-mode access. The `beep-ci-fleet-controller` webhook is active, its URL host is the Pulumi fleet's `execute-api`, "Workflow job" is ticked under Subscribe to events, and "Workflow run" is not. The driver ruled at 21:40Z that at T, in the same step as the hook deletions, the operator sets this webhook inactive by unticking Active on the settings page. Deactivating it stops its deliveries and leaves the App's API use (installation tokens, JIT runner configs) unchanged. Re-ticking Active reverses it. The webhook is never pointed at the function URL. `beep github app` only mints an App, so the change goes through the settings page.

**Preconditions at T.**

- The driver's word naming T.
- This PR merged by 2026-11-26T15:00Z, in a slot of its own. The infra-github README is in `deploy-infra-github.yml`'s push paths, so the merge opens a deploy first hour, which must end before T.
- One green `fleet-missed-event-check` run at a `main` commit that contains #3539, within its request budget and with its token revoked. A scheduled run counts. If none has run by 2026-11-26T12:00Z, the driver may word one read-only `workflow_dispatch` on `main`.
- An hour of its own: nothing merges, and the hour overlaps no other CI-behaviour change.
- The Pulumi fleet idle (step 6 (a)), checked at T-5 min: `aws ec2 describe-instances --filters Name=tag:ghr:environment,Values=beep-ci,beep-ovf Name=instance-state-name,Values=pending,running` returns none, and `gh api orgs/beep-effect/actions/runners` lists no `beep-ci-` or `beep-ovf-` runner.
- The `deploy-infra-github.yml` run that this PR's merge starts has finished, and its first hour has ended.
- Each deleted hook's configuration (`gh api repos/beep-effect/beep-effect/hooks/<id>`: URL, events, content type, active; no secret is returned) is captured into the 6b log before the deletion, so a rollback uses the exact configuration.

**Proof, in the hour after T.**

- The next fleet job's queued delivery on 714397446 returns 2xx, and a `beep-fleet-*` runner picks the job up.
- `gh api repos/beep-effect/beep-effect/hooks` lists only 714397446.
- The App's settings page shows its webhook inactive.
- Delivery on 714397446 for a fleet job queued after T: the hook's recent deliveries show a 2xx `queued` delivery whose payload names that job. If a job stays queued for five minutes or more, the next missed-event check prints `delivery <id> (2xx)` for it; a run with no such job prints no delivery line, so the hook's delivery list is the proof.

**Rollback** (revised 2026-11-26). Re-create hooks 663255260 and 711445970 from the configurations captured before their deletion (URL, events, content type, active), with each secret from its store. Re-ticking the App webhook is not part of the rollback; anyone who re-enables it sets a real URL first or leaves it off. After the Pulumi destroy (step 6 (d), 2026-11-26) the recorded `execute-api` URLs no longer reach anything: follow the cutover decision's "Rollback after (d)" (restore the stack from the archived export, read the recreated `controllerWebhook` and `shardOverflowWebhook` outputs), then re-create the hooks on those fresh URLs.

Lane feat/ci-runners-6b-webhook-switch

Reverse: Re-create repository webhooks 663255260 and 711445970 from the configurations captured before their deletion, with each secret from its store. The App webhook is not part of the rollback.

### AI metrics Phoenix runs without a Docker healthcheck; the Health step probes /healthz, 2026-11-26

The 2026-11-26 dankserver rehearsal (stage `dev_<user>`) failed at Health: Docker ran the container's healthcheck as `CMD-SHELL`, and every probe ended with `stat /bin/sh: no such file or directory`. `arizephoenix/phoenix:22.0.1`, the image the live Compose deployment runs, ships no shell. `@alchemy.run/docker` sets healthchecks through `docker run --health-cmd`, which always runs its value in `/bin/sh`, so no command form reaches a shell-less image. The live Compose file avoids this with the API's exec form (`CMD /usr/bin/python3.13 -c ...`), which the CLI flag cannot express.

Decision: the Phoenix container carries no Docker healthcheck. The Health Exec step is the gate. It waits up to 36 x 5 s for the container to be running and to answer `/healthz` on its own published loopback port, then keeps the published-port, Serve and public-URL checks. `restart: unless-stopped` acts on exit, not on health, so the only loss is the health column in `docker ps`.

Config facts found live in the same session, now in the runbook:
- The image pin copies the live Compose `image:` line, tag and digest. The `15.5.0` the runbook named would have run an older Phoenix against a volume that 22.0.1 migrated.
- `legacyCompose.configRoot` comes from the unit's `WorkingDirectory`.
- The secret references live in `BEEP_SECRETS`, the only vault the agent service account reads.
- The data volume is `external: true` in the live Compose file and carries no `com.docker.compose.project` label (Pulumi created it 2026-08-06). The first prod apply (02:27Z) stopped at Preflight on that label, with nothing retired; the unit was restarted at once (74 s down). Preflight now accepts an unlabelled volume and still refuses one labelled with another project.
- The live unit's `ExecStop` is `docker compose stop`, not `down`. The cutover runs `docker compose down` without `-v` after stopping the unit, because RetireCompose refuses while a container of the Compose project survives.

Attempt 2 (02:40:36Z, from f0c12fcf150) deployed, but a field-by-field audit against the retired Compose service found three deltas the stack had never carried. All three now ride the stack:
- Seven Phoenix settings in the Compose `environment`: `PHOENIX_ENABLE_AUTH=false`, `PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER=false`, `PHOENIX_ENABLE_MCP_SERVER=true`, `PHOENIX_ENABLE_MCP_CODE_MODE=false`, `PHOENIX_DISABLE_AGENT_ASSISTANT=true`, `PHOENIX_ALLOWED_SANDBOX_PROVIDERS=NONE` and `PHOENIX_TELEMETRY_ENABLED=false`. Without them, 22.0.1's defaults turned auth on (`/v1/projects` answered 401) and enabled telemetry and the agent assistant.
- The external network `beep-ai-metrics-dankserver_default` (`<composeProject>_default`). The host's OTLP collector exports to `http://beep-ai-metrics-phoenix:6006/v1/traces` on that network, so it could no longer resolve Phoenix. The prod container now joins it, and Preflight refuses when it is missing.
- `stop_grace_period: 2m`, now `stopTimeout: "2 minutes"`, so a stop does not kill Phoenix's SQLite writer at Docker's 10 s default.

The same audit found the image, port binding, volume and restart policy matching. The healthcheck is dropped on purpose (above).

Outcome of the cutover, applied as attempt 3 from `f096be4dca8`:
- The export-failure window was 02:27:04Z (the attempt-1 stop) to 02:54:35Z, and ingestion was degraded from 02:40:46Z to 02:54:35Z.
- The collector's persistent queue drained from 42 batches to 0 after attempt 3. Between 02:44:41Z and 02:54:09Z, 22 batches ran out of retries and 91 spans were dropped. The driver accepted that as the cost of the cutover.
- Phoenix was down about 74 s, 52 s and 20 s across the three attempts.
- The live state was proven at `f096be4dca8`; later commits on the P4 PR change only documentation.

Rollback for the prod cutover (also in the runbook):
- RetireCompose deletes nothing. It disables the unit and moves the unit file into `<legacy config root>/retired-compose/`; the Compose root and its files stay on disk.
- To return to Compose, run `alchemy destroy --stage prod`, which keeps the looked-up volume, then the stack's `operatorCommands.rollbackToCompose`, which restores the unit and starts it on the same volume.
- If the data is damaged, stop the unit, restore the pre-cutover snapshot tarball into the volume with a throwaway container, and start the unit.

Lane fix/infra-hosts-phoenix-health-gate

Reverse: Restore a Docker healthcheck on the Phoenix container once the Docker provider can set the exec form or the image ships a shell; the Health step keeps its probe either way.

### Step 6 (d) destroyed the whole Pulumi ci-runners stack; P6 retires the AWS cache's credentials, 2026-11-26

Cutover step 6 (d) (`2026-11-14-ci-runners-cutover-from-pulumi`) asks for a choice, made from a destroy preview, between a whole-stack and a targeted destroy, with the preview's count on record. This file is that record, plus the receipt and what P6 retires around it.

**Choice: whole stack.** `pulumi destroy --preview-only --stack production` from a checkout at `dd10bba55d35` listed 353 resources to delete. Only the fleet, its network, reaper and controllers, and the AWS turbo-cache leftovers (`CiTurboCache`) remained, and the Turbo cache had moved to the Worker (`@beep/infra-turbo-cache`, stage 2). The CI goals driver ruled "GO, whole stack, including CiTurboCache" on 2026-11-26 at 04:05Z. The program and its state readers were deleted by this PR, so the destroy ran from that pinned checkout and not from this branch.

**Receipt.** The state export was taken at 04:00:21Z, outside the repo (354 resources, step 6 (c)).

- Run 1, 04:04:46–04:12:07Z: 347 deleted and 2 errored. The AWS cache's artifact bucket refused deletion with `BucketNotEmpty`: it held 6111 Turbo artifacts (about 245 MB), the newest written 2026-11-09. Versioning had never been enabled, and nothing in `.github` read the bucket, `vars.TURBO_API` or `secrets.TURBO_READ_TOKEN`. The run stopped there, as the driver's word required.
- The driver ruled at 04:57Z to empty the bucket and re-run the same destroy. The other option, `pulumi state delete` on the bucket, was rejected because it would leave an orphan bucket outside any IaC.
- 04:57Z: a key manifest (key, size and modification time only, no contents) was written outside the repo, and the bucket was emptied. It then listed 0 keys, 0 versions and 0 delete markers.
- Run 2, 04:58:19–04:58:26Z: 6 deleted and 0 errored.
- Across both runs, 353 were deleted, matching the preview. `pulumi stack --show-urns` lists 0 resources and the bucket returns 404.
- 04:58:47Z: no instance of the old fleet is in any state except terminated. Its VPC is gone. The only registered org runners are the new fleet's.
- A `beep-fleet-*` runner picked up a Heavy job at 04:58:50Z.

**Credentials P6 retires.** These belong to the destroyed AWS cache:

- repository variables `TURBO_API` and `TURBO_TEAM`;
- repository secrets `TURBO_READ_TOKEN` and `TURBO_TEAM`;
- the `turbo-cache-write` environment's `TURBO_TOKEN`.

They leave `@beep/infra-github`'s unmanaged lists and census fixture in this PR. The live objects are deleted, one name per command, right before the operator's hand merge, and a names-only list read follows. The `turbo-cache-write` environment stays, because it holds the Worker cache's `TURBO_CACHE_WRITE_TOKEN`. The two Pulumi repository webhooks, 663255260 and 711445970, were deleted at step 6 (b), so the webhook census keeps only 714397446. A workstation `.env` that still points `TURBO_API` at the AWS host only loses its remote cache reads.

**After the merge.** `pulumi stack rm production` runs on its own word once nothing in the repository names the stack. Until then, the stack's history and config stay in the state backend beside the export. Step 6 (f), which covers the old SSM App parameters, the KMS key, the permissions boundary and whether to retire the `beep-ci-fleet-controller` App, takes the operator's word.

**Reversal.** No reversal is needed for the credentials, which authenticated only against a cache that no longer exists. For the fleet, follow the cutover decision's "Rollback after (d)": restore the stack from the export at the pinned checkout, re-deploy it, and re-create the webhooks on its fresh URLs. The bucket's artifacts are rebuildable cache entries, and the manifest records which keys existed.

Lane chore/infra-alchemy-p6-retire

Reverse: Credentials: none needed, they served a destroyed cache. Fleet: the cutover decision's Rollback after (d), from the archived export at a checkout at or before dd10bba5.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Pulumi stays installed per stack until that stack's cutover | `infra/` | packet owner | destroy needs the CLI and program | the stack's `pulumi destroy` receipt |
| `@beep/infra-hosts` prod deploys from the operator workstation, never CI | one stack | packet owner | dankserver is reachable only over the YubiKey SSH route; S3 state lease is the overlap guard (D21) | a runner with a scoped deploy key to dankserver |
