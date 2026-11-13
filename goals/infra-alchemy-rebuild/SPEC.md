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

### @beep/infra-turbo-cache is the first infra-kind package; the scratchpad module moved into it, 2026-11-13

Created with `bun run beep create-package infra-turbo-cache --family tooling --kind infra --dir-name turbo-cache` at `packages/tooling/infra/turbo-cache`: the directory drops the `infra-` prefix the kind segment already carries, as `tool/cli` does for `@beep/repo-cli`. The scaffold appended an explicit workspace path; it is replaced by the `packages/tooling/infra/*` glob beside the other tooling kinds, so later infra packages need no root edit. Every scratchpad file moved with `git mv` (handler to `src/Protocol.ts`, binding to `src/Bucket.ts`, constructor to `src/TurboCache.ts`, state reader to `src/internal/StateReader.ts`, handoff to `src/TokenHandoff.ts`, the CLI to `token.ts` at the package root beside `alchemy.run.ts`); `config.ts` and `token-failure.ts` folded into their users. `Protocol` and `Bucket` are public modules, not `internal/`, because the test Worker fixtures that import them are bundled by Alchemy with plain package resolution, which honours the exports map. `scratchpad/turbo-cache-r2`, its `test:turbo-cache-r2` script and the scratchpad's `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/test` dependencies are gone.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: git mv the modules back to scratchpad/turbo-cache-r2, restore its test:turbo-cache-r2 script and Alchemy dependencies, drop packages/tooling/infra/* from root workspaces and remove the package.

### Cache tokens reach GitHub by stdin handoff under new names, not GitHub.Secret in this stack, 2026-11-13

`GitHub.Secret` in this stack would need a credential that can write repository and environment secrets inside the `turbo-cache-prod` deploy job; the Actions `GITHUB_TOKEN` cannot, so it would mean a new long-lived admin token or an App installation (App minting is out of scope, D10). Instead tokens stay in state only (never a stack output) and `token.ts` pipes one to a receiver's stdin: `gh secret set TURBO_CACHE_WRITE_TOKEN --env turbo-cache-write` for `ci-main`, `gh secret set TURBO_CACHE_READ_TOKEN` (repository) for `ci-pr`, the workstation's 1Password item for the trusted writers. The live `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and `TURBO_READ_TOKEN` are untouched: the new names stand beside them until stage 2 flips `setup-monorepo-ci`. `@beep/infra-github` reconciles these secrets when it lands, reading the tokens with `Output.stackRef`-style state reads rather than a second distribution path.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Add GitHub.Secret resources for TURBO_CACHE_WRITE_TOKEN and TURBO_CACHE_READ_TOKEN to alchemy.run.ts and a repository-admin GITHUB_TOKEN secret to turbo-cache-prod.

### Personal-stage deploy proof blocked: the Alchemy Cloudflare token has no R2 permission, 2026-11-13

The brief's live proof (deploy `dev_$USER`, run a Turborepo task twice against it, show a read-only token refused a write, destroy) did not run: the stack's Cloudflare token cannot reach R2, and the lane does not widen or mint tokens on its own. Evidence, 2026-11-13, with `op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN` (an account token, `/accounts/<id>/tokens/verify` active): `GET /accounts/<id>/r2/buckets` returns `Authentication error`; `workers/subdomain` and `alerting/v3/available_alerts` succeed. The 2026-10-28 mint script for that token (`goals/beep-effect-web-alchemy/ops/mint-alchemy-token.sh`, archived in #2834) granted Workers Scripts Write, Secrets Store Write and Account Settings Read on the account plus four zone groups, no R2 group. `bunx alchemy plan --stage dev_elpresidank --env-file /dev/null` (aws-vault credentials exported, AWS_REGION=us-east-1) loads the S3 state and then fails in `plan.diff.resource` with `Unauthorized: Authentication error` (Cloudflare code 10000); a plan writes nothing, so nothing needs destroying. The R2 pilot's provisioning token (`BEEP_TURBO_R2` item) has R2 but no Workers subdomain or Notifications access and is not this stack's credential, so it was not used. Missing, for the operator: **Workers R2 Storage Write** on the account (deploy of any stage, including the prod workflow), and **Notifications Write** once `TURBO_CACHE_ALERT_EMAIL` is set. Until then the same behaviour is proven on Alchemy's local providers (workerd plus a local R2 bucket, in-memory state, no credentials), `bun run test:integration` in the package (`test/integration/`), 4 runtime/stack tests passed: `the pinned Turbo binary gets a remote hit with an empty local cache` (first run `0 cached, 1 total`, second run with a fresh local cache `1 cached, 1 total` with run-summary `"source": "REMOTE"`; a read-only token's run of a changed task stays `0 cached, 1 total` twice, so its upload was refused), `streams generated artifacts, isolates teams, and refuses unauthorized storage access` (reader GET 200, reader PUT 403, other team 403), `the cache stack keeps one token per principal under stable fqns and hands each to its holder` (the handed-off reader token reads status 200 and is refused PUT 403), `the TurboCache stack deploys the cache Worker for the beep team and refuses anonymous requests`. The `prod` deploy on merge fails at plan with the same error until the token is widened; the launching session should hold the merge or widen the token first.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: n/a (evidence record); superseded by the live dev_$USER deploy, turbo miss/hit and refused-write receipts once the token carries Workers R2 Storage Write.

### Pin the prod bucket and Worker names: beep-turbo-cache, 2026-11-13

Alchemy names a bucket or Worker from an instance id it keeps in state, so a stage whose state is lost or moved mints new ones (PR #3133). `prod` pins both to `beep-turbo-cache` (greenfield, D12: neither the AWS cache nor the pilot bucket `beep-turbo-r2-pilot` is touched), giving CI a stable `TURBO_API` of `https://beep-turbo-cache.beep-effect.workers.dev`. Personal stages keep generated names. The stage is read with `Effect.serviceOption(Stage)`, so the bundled Worker runtime, which has no `Stage`, never sees a stage-dependent prop. `RemovalPolicy.retain` holds the bucket and the tokens in `prod` only.

Lane goals/infra-alchemy-rebuild-p3-turbo-cache

Reverse: Remove productionNames from src/TurboCache.ts; prod then takes generated names from state-held instance ids.

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

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Pulumi stays installed per stack until that stack's cutover | `infra/` | packet owner | destroy needs the CLI and program | the stack's `pulumi destroy` receipt |
| `@beep/infra-hosts` prod deploys from the operator workstation, never CI | one stack | packet owner | dankserver is reachable only over the YubiKey SSH route; S3 state lease is the overlap guard (D21) | a runner with a scoped deploy key to dankserver |
