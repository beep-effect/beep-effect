# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-15 — migration target

**Question:** What does "done" mean for removing TypeScript 6, and should the
infra Pulumi stacks move to Alchemy? (Round 1 also offered: host stacks to
Effect CLI commands vs Alchemy custom providers; isolating the Vercel and
runner-module gaps; a credential-free Alchemy spike as the first slice.)

**Answer:** No Alchemy migration. Operator, verbatim: "We don't need a complete
migration to alchemy. Honestly If pulumi doesn't support ts7 then we can just
isolate it to infra." Pulumi stays; its TypeScript 6 requirement is confined to
`infra/` instead of being patched at the repository root.

**Rationale:** Research found Alchemy v2 still in beta (2.0.0-beta.83) with no
coverage for the Vercel projects, the Terraform-backed GitHub runner module,
KMS grants, Compute Optimizer enrollment or host-level SSH/systemd. A full
migration would mean custom providers for all of them, which is far larger than
the benefit of removing one TypeScript 6 copy. Isolation keeps every stack and
its state untouched. Rejected: the full migration, zero TS6 in the repo, and the
Alchemy spike. The recommendation offered was a TS7-only root with any
leftover Pulumi isolated; the operator's answer goes further and keeps all of
Pulumi.

## 2026-10-15 — packet outcome

**Question:** Graduate, park or kill this exploration?

**Answer:** Killed. Epitaph: Pulumi stays; Alchemy can't cover our providers
yet, and isolating Pulumi's TypeScript 6 need in `infra/` is enough.

**Rationale:** The isolation needs no goal packet. It is one follow-up PR in
the TS7 exit program: an infra-local preload makes Pulumi resolve infra's
nested `typescript` 6, which retires the root `@pulumi/pulumi` patch and its
syncpack hold. RESEARCH.md and research/SOURCES.md stay as provenance if Alchemy
coverage changes; reopen at research in that case.

## 2026-11-02 — reopened at research

**Question:** Does the 2026-10-15 kill still hold now that the TS6 isolation shipped and the
repo runs Alchemy in production?

**Answer:** Reopened. The operator asked on 2026-11-02 (via the orchestrator hand-over) for a
dedicated investigation of "can beep-effect migrate its infrastructure off Pulumi onto Alchemy,
and if not fully, what are the options?" The packet's own exit condition was "reopen at research
only if Alchemy gains coverage for Vercel, the GitHub runner module and host-level resources";
none of those three gained coverage (re-verified against the checkout at `450702936d`), so the
reopen is on the operator's request and on two changed facts: the isolation landed
(`infra/pulumi-typescript6.cjs`), and Alchemy is live for beep-effect.com and the R2 cache
stacks. Status back to `active`; stage `align` with the research refreshed under
`RESEARCH.md` "2026-11-02".

**Rationale:** The 10-15 answer ("isolate it to infra") was to a narrower question (how to
remove the root TS6 patch). The 11-02 question is direction: Pulumi or Alchemy for the whole
estate. Research now records a resource-by-resource matrix (40 kinds covered, 9 gaps, 1
partial), per-gap options, three candidate options with state-migration and rollback plans,
and a recommendation: finish the isolation as "Pulumi stays, precompiled, no TS6" (option C)
and adopt Alchemy-first-for-new as policy (option B), holding a full migration (A) behind named
gates. Nothing here is decided; the eight frontier questions are listed at the end of the
2026-11-02 research and in the manifest for the grill session.

**Not decided (frontier for the grill, 2026-11-02):** goal statement (no TS6 vs no Pulumi);
Alchemy-first policy and canonical state store; OIP hosting (Vercel vs Cloudflare); retiring
the Storybook program; the runner fleet's future; host stacks (Pulumi vs Alchemy vs Effect CLI);
appetite for the credential-free option-C spike; account singletons in or out of IaC.

## 2026-11-06 — grill session: direction overturned to full migration

Grill session (`/grill-with-docs`, operator present) over the eight frontier questions plus the
operator's three new concerns: `@beep/infra` smells (Python and shell, no tsgo diagnostics,
`node:crypto` and async/await in the Lambda, nested tests, patches of unknown need, scattered
Markdown), `./scripts` smells (same), and Python scattered through the repo. Sixteen rounds of
one question each, every answer below is the operator's. The 2026-11-02 recommendation
("C now, B as policy, A behind gates") is overturned: the target is A, from scratch.

### D1 — Packaging: three sibling goal packets

**Question:** One umbrella packet or several, given the infra rebuild is months and the Python
ban is days?

**Answer:** Three sibling goal packets, all graduated from this exploration:
`goals/infra-alchemy-rebuild`, `goals/scripts-to-beep-cli`, `goals/python-free-repo`.

**Rationale:** Each closes on its own clock; the three-open-PR cap per packet would otherwise
hold the ban hostage to the fleet. Cross-links in each SPEC.

### D2 — Runner fleet: port the Terraform composite to Alchemy AWS primitives

**Question:** The `beep-ci-runners` fleet is a Terraform module (~220 of ~298 live resources) with
no Alchemy bridge. Port, replace with GitHub-hosted runners, or keep on Pulumi?

**Answer:** Port the composite (webhook Lambda, SQS, scale-up/down Lambdas, launch template and
ASG, SSM, syncer, termination watcher) to `@alchemy.run/aws` primitives as a repo-owned Alchemy
resource, MIT attribution to `github-aws-runners/terraform-aws-github-runner`. Fleet downtime
during cutover is planned. Rejected: hosted larger runners (CI-economics change), Pulumi
residue (contradicts "completely replace Pulumi").

### D3 — OIP hosting: custom Alchemy Vercel resources over `@distilled.cloud/vercel`

**Question:** Alchemy has no Vercel resource; distilled ships `@distilled.cloud/vercel`, and
Alchemy's own AWS provider is built on distilled SDKs. Custom provider, move to Cloudflare
Workers, or drop Vercel from IaC?

**Answer:** Repo-owned Alchemy resources `Vercel.Project`, `Vercel.EnvVar`, `Vercel.Domain`
over `@distilled.cloud/vercel`, following the `alchemy/packages/aws` pattern. Hosting of the
client-facing site is unchanged. Storybook follows the same resources if it stays on Vercel.

### D4 — photo-face: port to TypeScript on onnxruntime-node

**Question:** `packages/tooling/tool/cli/python/photo-face` backs `beep files match-person`
(InsightFace buffalo_l, AdaFace KPRPE) in a pinned Python 3.12 venv. Port, retire, or
externalise?

**Answer:** Port to Effect over `onnxruntime-node` and `sharp`, same ONNX model pins; detection,
alignment, embedding, quality and scoring reimplemented and parity-tested against saved
embeddings. The feature stays; the Python venv and its supply chain go.

### D5 — Topology: app stacks beside their app; platform stacks in a new tooling kind

**Question:** Where do Alchemy stacks live?

**Answer:** App deploys sit beside the app (`apps/oip-web/alchemy.run.ts`,
`apps/storybook/alchemy.run.ts`, as `apps/beep-effect-web` already does). Repo-platform stacks
become `packages/tooling/infra/<name>` (a new tooling kind: `@beep/infra-ci-runners`,
`@beep/infra-turbo-cache`, `@beep/infra-github`, `@beep/infra-cost-controls`,
`@beep/infra-hosts`), each created with `beep create-package`. Repo-owned Alchemy resources
become `packages/tooling/library/alchemy-<provider>`. The root workspace member `infra/` is
deleted. Doctrine amendment owed: `07-non-slice-families.md` tooling kind catalog gains `infra`.

### D6 — State store: one AWS S3 `BucketState` for every stack

**Question:** Cloudflare Durable Object store (live for beep-effect-web, no lock), AWS S3
BucketState (lease lock), DynamoDB, or custom?

**Answer:** One store: AWS S3 BucketState in the existing account, bootstrapped once with
`alchemy state bootstrap --backend aws`. `BeepEffectWeb` re-adopts into it (read + `--adopt`,
no resource change). Cloudflare-only stacks carry AWS credentials for state only.

### D7 — Turbo cache: the Cloudflare Worker + R2 port becomes the only cache

**Question:** Live AWS Lambda cache, the r2-cache pilot (patched Rust adapter, Python labs), or
the operator's `scratchpad/turbo-cache-r2` Effect-native Worker port?

**Answer:** The scratchpad module is moved (not copied) into `@beep/infra-turbo-cache` and the
scratchpad module is deleted once moved. The AWS Lambda cache, `infra/lambda/turbo-cache`,
`infra/r2-cache` (patches, Python labs, shell wrappers, frozen Alchemy tool clone) and
`infra/turbo-cache-lab` are deleted. CI and workstations re-enroll against the Worker URL and
per-team tokens. Carried over as requirements: signed-policy semantics, the cache-input baseline
review, and the throttle alarm's intent.

### D8 — Historical Python: triage, not a literal port

**Question:** ~290 tracked `.py` files (129 citation-extraction probes, 43 ciops ontology, 25
turborepo adoption, skill scripts, timer ops). Port all, triage, or delete?

**Answer:** Triage. Anything referenced by a workflow, systemd timer, skill, hook, package script
or packet ops manifest is ported (Effect for tooling, vanilla TypeScript for packet-local
scripts). One-shot probes whose outputs are already recorded are deleted with a ledger note
pointing at the retained output. The ban is a `beep lint laws` law plus a lefthook and a CI
check failing on any tracked `*.py`; agents may still run Python outside the repo, never commit it.

### D9 — Host stacks: Alchemy Docker over SSH plus Command, no custom SSH resource

**Question:** AI metrics (SSH to dankserver, Compose + systemd) and OpenClaw (local commands) have
no Pulumi `command.remote` equivalent. CLI commands, custom SSH resource, or both?

**Answer:** Operator: use Alchemy's `Command` and `Docker` providers. Verified in the checkout:
`Docker.Context("vps", { docker: "host=ssh://user@host" })` then `Docker.Service`/`Container`/
`Network`/`Volume` against that context; `Command.Exec` for OpenClaw's steps (memoised on input
hash). `@beep/infra-hosts` owns both. Rejected: a repo-owned SSH resource; CLI-only.

### D10 — GitHub ownership: repo settings, rulesets, secrets, variables, environments, labels

**Question:** How far does `@alchemy.run/github` ownership go?

**Answer:** `@beep/infra-github` owns the repository's rulesets (including the beep-reviewer
advisory switch), Actions secrets and variables, environments, labels and webhooks. GitHub Apps
stay CLI-minted: `scripts/github-app/create-*.ts` becomes `beep github app mint` (in
`scripts-to-beep-cli`), and app ids and keys feed the stack as config. This packet depends on
`goals/repo-cli-gh-git-consolidation`, not the reverse.

### D11 — CI bootstrap: compiled `beep` binary; one allowlisted shell file

**Question:** `scripts/ci-*.sh` and `scripts/cloud/bootstrap.sh` run before bun or the beep CLI
exist on the runner. Compile, composite actions, or keep an allowlist?

**Answer:** `bun build --compile` of the beep CLI, published per `main` merge (or built in
`setup-monorepo-ci` and cached). Workflows fetch the binary and call `beep ci change-profile`,
`beep ci runner-resources`, `beep ci prune-apt`. `scripts/` keeps exactly one file,
`cloud/bootstrap.sh`, as the reviewed shell exception; a lint law fails on any other tracked
`.sh` outside `.claude/`, `.codex/`, `.cursor/` hooks. Everything else in `scripts/` becomes a
beep command.

### D12 — Cutover: greenfield names, parallel build, flip, then destroy Pulumi

**Question:** Adopt in place, big-bang, or parallel?

**Answer:** New physical names for everything (state bucket included). Each Alchemy stack deploys
beside its live Pulumi counterpart, is verified (CI on the new fleet, cache hits on the Worker,
OIP preview), traffic flips, then `pulumi destroy` per stack with the exported state archived
outside the repo. Order: storybook, turbo cache, cost controls, GitHub, OIP, hosts, runner fleet
last. Zero planned downtime, brief double cost.

### D13 — Alchemy pin: npm catalog, deliberate bumps; reference checkouts track main

**Answer:** One catalog entry each for `alchemy`, `@alchemy.run/*`, `@distilled.cloud/*`; bumps
are their own PR with `alchemy plan` no-op on every stack. No frozen tool clones.

### D14 — Upstreaming: build in-repo, upstream the generic resources, keep the runner composite

**Answer:** Providers ship under `packages/tooling/library/alchemy-<provider>` following Alchemy's
provider conventions and test harness. Vercel, KMS Grant, CostAllocationTag and the two
enrollment resources go upstream when stable (upstream-contribution hygiene ruling applies); the
runner composite stays repo-owned.

### D15 — Slugs

**Answer:** `infra-alchemy-rebuild`, `scripts-to-beep-cli`, `python-free-repo`.

### D16 — Research: P0 of infra-alchemy-rebuild, implementation gated on it

**Answer:** A deep-research pass over every alchemy.run doc page the operator listed, the full
alchemy and distilled sources, t3code's `infra/relay` and `infra/task-cache` stacks, and all 48
alchemy.run blog posts (grok-4.7 xhigh deep-research lanes) lands under
`goals/infra-alchemy-rebuild/research/`. P0 exit is a reviewed "use this, never roll that"
matrix; P1 scaffolding waits for it. Grok lanes start as soon as the packet exists.

## 2026-11-06 — packet outcome

**Question:** Graduate, park or kill?

**Answer:** Graduated into the three goals above.

**Rationale:** Every frontier question is answered (D1–D16); the eight 2026-11-02 open
questions map onto D2, D3, D5–D7, D9, D12 (option-C spike: rejected, nothing to precompile when
Pulumi leaves) and D9/D14 (account singletons: thin custom resources, upstream candidates).

## 2026-11-06 — P0 research follow-ups (same session, after the source inventory)

The P0 inventory (`goals/infra-alchemy-rebuild/research/alchemy-distilled-source-inventory.md`,
`use-this-never-roll-that.md`) verified five facts against the checkout that amend earlier
decisions. Operator answers:

### D17 — State store is S3 explicitly, KMS-encrypted (amends D6)

`AWS.state()` defaults to DynamoDB in beta.85; S3 needs `backend: "s3"`, a bucket name in the
account-regional `<prefix>-<accountId>-<region>-an` form, and `encryption` because secrets sit in
state as redacted JSON. **Answer:** keep S3: `AWS.state({ backend: "s3", encryption: <kms> })`.

### D18 — Bootstrap runs Alchemy's own command under aws-vault

`AWS.providers()` dies without a tagged Lambda assets bucket; the documented bootstrap assumes an
SSO or `aws login` profile. **Answer:** run `alchemy provider aws bootstrap` and
`alchemy state bootstrap` once under `AWS_PROFILE=elpresidank-vault` (credential_process), record
the receipt in a decision file; a repo-owned `beep infra bootstrap` only if the command insists
on SSO. Never `aws login`.

### D19 — Runner Lambdas are ported to Effect and bundled by Alchemy (refines D2)

The upstream module has no autoscaling group: scale-up launches Spot instances through EC2
`CreateFleet`; Lambdas ship as MIT release zips and `Lambda.Function` bundles a directory.
**Answer:** port webhook, scale-up, scale-down, syncer and termination watcher to Effect over
`@distilled.cloud/aws`, bundled by Alchemy, attribution kept. Verified gap: Alchemy's
`LaunchTemplate` cannot set the gp3 root volume, EBS-optimised or Spot options, so a repo-owned
`RunnerLaunchTemplate` over distilled EC2 is allowed (upstream PR candidate). `KmsGrant` is
probably unnecessary once the composite owns the termination-watcher roles (an IAM policy with
the encryption-context condition replaces it); confirm against the key policy in P2.

### D20 — Singletons are adopted per object; the reviewer switch moves into the stack (amends D12)

The repository, its rulesets, existing DNS records and the oip.law Vercel domains cannot be
recreated under new names. **Answer:** per-object `adopt(true)` for those, each listed in a
decision file; everything else stays greenfield. `beep reviewer ruleset release|require` becomes
a stage config flag on `@beep/infra-github`; the CLI stops editing rulesets directly.

### D21 — Hosts stack deploys prod from the workstation only (exception to the CI-only rule)

CI cannot reach dankserver (YubiKey SSH route). **Answer:** `@beep/infra-hosts` prod runs from
the operator workstation through `op run` and the wrapped SSH route, refuses to run in CI, and
relies on the S3 state lease as the only overlap guard. Exception Ledger row; removal condition:
a runner with a scoped deploy key. Also from the inventory: `Docker.Service` is swarm-only, so
dankserver uses `Docker.Container` on the SSH `Docker.Context` (D9 wording corrected);
`Command.Exec` deletes nothing and does not expose stdout, so OpenClaw's probe/acceptance steps
need `Build` or a small repo-owned resource if their output matters.

Also recorded: `alchemy plan` has no "changes pending" exit code and GitHub secrets re-upload on
every deploy, so the acceptance check is "plan shows no create or replace" plus `alchemy drift`,
not a literal no-op; `scratchpad/turbo-cache-r2` lives on branch `@chore/deps-update-11-6-26`
and must land on `main` before P3 moves it.
