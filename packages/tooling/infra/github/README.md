# @beep/infra-github

The `InfraGithub` Alchemy stack: the `beep-effect/beep-effect` repository settings, its
`main` ruleset (with the beep-reviewer advisory switch), the deploy environments and their
variables, repository variables and labels. Packet: `goals/infra-alchemy-rebuild` (P3, D10,
D20). Runbook: `docs/runbooks/alchemy-infra.md`.

Status: built and planned read-only against the live repository. Not deployed; the deploy
workflow ships disarmed until the reviewed live adoption.

## Design

Design order is schema, typed configuration, then resources.

1. **Schema** (`src/Config.ts`): `StackConfig` and its parts (`RepositorySettings`,
   `MainRuleset`, `EnvironmentSpec`, `VariableSpec`, `LabelSpec`, `UnmanagedObject`), with
   `LiteralKit` domains for every literal set (`MergeMethod`, `BypassActorType`,
   `BypassMode`, `RulesetEnforcement`, `ObjectClass`).
2. **Configuration** (`src/Production.ts`): `productionConfig`, the live state captured
   2026-11-13 restricted to what the stack owns, plus `unmanaged`, every live object the
   stack leaves alone with its reason. The configuration does not depend on the stage.
3. **Resources** (`src/Stack.ts`): `declareStack(config)` declares shipped
   `@alchemy.run/github` resources only (`Repository`, `Ruleset`, `Environment`,
   `Variable`, `Label`); no repo-owned resource.

### Ownership on day one

| Object | Disposition | Why |
| --- | --- | --- |
| Repository settings sent by `GitHub.Repository` | adopted (`adopt(true)`, `protect()`) | singleton (D20); converged by name |
| Settings `GitHub.Repository` does not send (squash/merge commit title and message, update-branch, signoff, security and analysis) and `description`, `visibility` | unmanaged | provider gap; the stack never sends them |
| Ruleset `main` (10240248) | adopted (`adopt(true)`, `protect()`) | singleton (D20); same-name ruleset reads as `Unowned` |
| Ruleset `queue-lab` (26917133) | unmanaged | `goals/merge-queue-lab` parks it and `merge-group-parity` re-arms it by a live edit |
| Environments `beep-effect-web-prod`, `storybook-prod`, `turbo-cache-prod`, `turbo-cache-write` | owned, adopted by name | Alchemy deploy environments; branch policy `main` |
| Environment `professional-desktop-release` | unmanaged | its policy is a tag pattern; the provider recreates missing policies as branch policies |
| Vercel-created environments (`Preview*`, `Production*`, `vercel-*`, 22 in all) | unmanaged | owned by the Vercel App; the OIP stack (P4) decides |
| Env variable `ALCHEMY_STATE_ROLE_ARN` on the three `-prod` environments | owned | value is known and non-secret |
| Repo variables `KNOWLEDGE_MINT_APP_CLIENT_ID`, `KNOWLEDGE_MINT_APP_SLUG` | owned | App config fed as stack config (D10) |
| Repo variable `BEEP_SHARD_OVERFLOW` | unmanaged | an operator switch flipped live |
| Repo variables `TURBO_*` | unmanaged | the turbo cache cutover sets them |
| All 26 labels | owned, adopted by name | `GitHub.Label` observes by name and updates |
| Every secret (11 repository, 9 environment) | unmanaged | see "Secrets" |
| Two repository webhooks (`workflow_job`) | unmanaged | runner fleet; their secret belongs to the ci-runners stack (P5) |
| Actions permissions | unmanaged | no `@alchemy.run/github` resource (verified gap) |

Every resource is retained on removal (`RemovalPolicy.retain()` over the whole stack): a
dropped declaration or a destroyed stage forgets the object and deletes nothing. The
repository and the `main` ruleset are also `protect()`ed, so a plan that would replace or
delete them fails before anything is applied.

### Secrets

`GitHub.Secret` re-uploads its value on every deploy, so a secret is managed only when the
deploy can read its value. On day one the stack manages none:

- Has a 1Password source: `KNOWLEDGE_MINT_APP_PRIVATE_KEY` (`beep-knowledge-mint GitHub App`
  item, `private_key`). `VERCEL_TOKEN` has two candidate fields (`CLOUD_VERCEL_TOKEN`,
  `CLOUD_VERCEL_API_TOKEN`) and no record of which one it holds.
- No known source: `APP_ENV`, `APP_LOG_FORMAT`, `APP_LOG_LEVEL`, `APP_NAME`, `NEXT_PUBLIC_ENV`.
- Produced by another stack (named, not duplicated): `TURBO_R2_READ_ACCESS_KEY_ID`,
  `TURBO_R2_READ_SECRET_ACCESS_KEY`, `TURBO_READ_TOKEN`, `TURBO_TEAM` (secret),
  `turbo-cache-write/{TURBO_R2_WRITE_ACCESS_KEY_ID,TURBO_R2_WRITE_SECRET_ACCESS_KEY,TURBO_TOKEN}`
  (turbo cache); `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` on
  `beep-effect-web-prod`, `storybook-prod`, `turbo-cache-prod` (each stack's deploy).

Ruling (packet gate, 2026-11-13): every secret stays unmanaged on day one, and no
1Password service-account token or other new long-lived credential goes into CI for this
stack. The lists above are what a later decision works from.

### Credential

The workflow's own `GITHUB_TOKEN` cannot administer rulesets, environments or variables, and
no installed App has those permissions (`beep-ci-fleet-controller` has administration but is
the runner fleet's identity). Accepted (packet gate, 2026-11-13): a dedicated App
`beep-infra-github`, minted by `bun run beep github app mint beep-infra-github` from the
manifest checked in under the repo-configs policy data (`github-apps/beep-infra-github.manifest.json`,
D10), installed on `beep-effect/beep-effect` only, with repository permissions
`administration` (settings, rulesets), `environments`, `actions_variables` and `issues`
(labels) at write and `metadata` at read; no secrets permission while no secret is managed.
The mint is the operator's; the steps are in the runbook's InfraGithub section. Its id is the
`infra-github-prod` environment variable `INFRA_GITHUB_APP_ID` and its key the environment
secret `INFRA_GITHUB_APP_PRIVATE_KEY`; the workflow mints a one-hour installation token with
`actions/create-github-app-token`. `@alchemy.run/github` beta.86 also ships `GitHub.fromApp`,
which could mint in-process instead.

### The beep-reviewer switch

The stack does not own the `beep-reviewer` check (window-5 requirement, option (b)): the
deploy reads the live ruleset and writes its `beep-reviewer` entry back exactly as it is,
App binding included, so `beep reviewer ruleset release|require --apply` stays the only
switch, armed or not. The ruleset is written as a whole body, so leaving the check out of it
(option (a)) would remove it; carrying it is what the resource model supports. Tests prove a
live check survives a deploy present and absent. Because the body is built from a capture,
`src/RulesetWriteGuard.ts` wraps the `GitHub.Ruleset` provider: immediately before the PUT
it re-reads the live ruleset and refuses, writing nothing, if it no longer equals the
capture. This closes the capture-to-PUT window except for the single GET-to-PUT round-trip: a
switch flipped inside that round-trip is overwritten and not detected. Tests cover the equal
case and the check flipped either way. The post-deploy check (`--reviewer-from`) fails when the
ruleset differs from what the deploy wrote, which means it moved after the write and nothing was
undone. The remaining round-trip is covered by practice: the switch is not flipped while a
`Deploy infra-github` run is in progress (runbook, InfraGithub section).

### The ruleset 10240248 guard

`src/RulesetGuard.ts` states every field the deploy writes for ruleset 10240248 (name,
target, enforcement, conditions, bypass actors, the rule types in order, the pull request
settings and merge methods, the strict policy, required checks with their integration ids)
and compares it with a capture of the live ruleset. The guard fails closed: the capture is decoded strictly, so an unknown key, an
unknown rule type, a missing field, or a setting the provider never sends standing away
from its default (required reviewers, an enabled dismissal restriction,
`do_not_enforce_on_create`) refuses the deploy in both modes instead of being skipped. `ruleset-guard.ts`
is its command. The deploy workflow runs it between plan and deploy and again after the
deploy. `--diff-only` prints the same field-by-field diff without failing: the read-only
pre-arming evidence (runbook, InfraGithub section). On 2026-11-14 the diff against live was
empty.

### The prod create guard

`src/ProdWriteGuard.ts` wraps every `prod` provider. Only the logical ids on
`productionCreateAllowList` (`src/Production.ts`) may take the create path, and those are
the ids whose providers converge an existing object by name. `MainRuleset` is not on it,
because the shipped ruleset create path POSTs a second ruleset: a plan that cannot find the
live one fails. The repository's create path must find the live repository. A planned
`replace` fails the plan, and `precreate` and `delete` always fail. The tests prove the
first prod plan on the seeded fake is `{"create":36,"adopted":1}` with no deletions and no
writes, and that the deploy sends no POST and no DELETE. Runbook: "The prod create guard".

## Commands

```sh
bun run test     # census snapshot + stack tests on an in-memory GitHub, no token
```

Read-only preview against the live repository. A non-`prod` stage cannot write: its GitHub
providers (`src/ReadOnlyProviders.ts`) keep read and diff and fail create, update and
delete with `PreviewStageIsReadOnly` before any request, so `alchemy deploy` on it fails
closed whatever token is present:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/github
mkdir -p ~/.local/state/beep/infra-github
gh api repos/beep-effect/beep-effect/rulesets/10240248 > ~/.local/state/beep/infra-github/ruleset-10240248.live.json
GITHUB_TOKEN="$(gh auth token)" INFRA_GITHUB_LIVE_PREVIEW=plan-only \
  INFRA_GITHUB_LIVE_RULESET=~/.local/state/beep/infra-github/ruleset-10240248.live.json \
  bunx alchemy plan --stage "preview_$USER" --env-file /dev/null
```
