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
   `LiteralKit` domains for every literal set (`ReviewerCheck`, `MergeMethod`,
   `BypassActorType`, `BypassMode`, `RulesetEnforcement`, `ObjectClass`).
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

A CI deploy cannot read 1Password without a new long-lived credential in the workflow
(a service-account token as an environment secret). That is the smallest option, and it
waits for a ruling; nothing here builds it.

### Credential

The workflow's own `GITHUB_TOKEN` cannot administer rulesets, environments or variables, and
no installed App has those permissions (`beep-ci-fleet-controller` has administration but is
the runner fleet's identity). Proposed: a new App `beep-infra-github`, minted by
`bun run beep github app mint` from a checked-in manifest (D10), installed on
`beep-effect/beep-effect` only, with repository permissions `administration: write`
(settings, rulesets), `environments: write`, `variables: write`, `issues: write` (labels),
`metadata: read`; `secrets: write` only once a secret is managed. Its id is the
`infra-github-prod` environment variable `INFRA_GITHUB_APP_ID` and its key the environment
secret `INFRA_GITHUB_APP_PRIVATE_KEY`; the workflow mints a one-hour installation token with
`actions/create-github-app-token`. `@alchemy.run/github` beta.86 also ships `GitHub.fromApp`,
which could mint in-process instead.

### The beep-reviewer switch

`mainRuleset.reviewerCheck` (`required` | `advisory`) decides whether the ruleset lists
`beep-reviewer` bound to App 5321138; every other check, the bypass actors and the rest of
the ruleset are unaffected (tests prove both flips). The committed value is `advisory`, the
live position. Once the stack owns the ruleset, `beep reviewer ruleset release|require`
must stop PUTting the ruleset and instead rewrite `reviewerCheck` in `src/Production.ts`
(the switch then lands through a PR and this workflow); until then the next stack deploy
would revert a CLI flip. The CLI change is not needed for the plan and is not in this head.

## Commands

```sh
bun run test     # census snapshot + stack tests on an in-memory GitHub, no token
```

Read-only preview against the live repository (never `deploy` a non-`prod` stage):

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/github
GITHUB_TOKEN="$(gh auth token)" INFRA_GITHUB_LIVE_PREVIEW=plan-only \
  bunx alchemy plan --stage "preview_$USER" --env-file /dev/null
```
