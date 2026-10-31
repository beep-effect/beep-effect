# beep-effect.com web app on Alchemy Spec

## Objective

Bootstrap a default TanStack Start app at `apps/beep-effect-web` and serve it at
`https://beep-effect.com` from a Cloudflare Worker. The deploy goes through
Alchemy v2 (Alchemy Effect) and follows Alchemy's own monorepo, state-store,
and custom-domain guidance. This is the repo's first Alchemy deploy, a
deliberately small trial.

## Non-Goals

- Migrating any Pulumi stack in `infra/` (oip-web, storybook, ci-runners, r2-cache, ...) to Alchemy.
- Site content beyond the TanStack Start starter: projections, `/ns/`, docs, and the other reserved slugs.
- PR preview stages (`pr-<n>`) and per-stage Cloudflare accounts.
- A repo-wide or root-level Alchemy stack.
- Cloudflare Images, KV-backed ISR, or any paid Cloudflare add-on.

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

- `apps/beep-effect-web/**`: new app (created with `bun run beep create-package`), including its `alchemy.run.ts`.
- `.gitignore`: `.alchemy/`.
- `.github/workflows/**`: one new deploy workflow (P3 CI phase).
- `bun.lock` and the root catalog, for the `alchemy` and `@alchemy.run/*` dependencies.
- Cloudflare account `CLOUD_CLOUDFLARE_ACCOUNT_ID`: the Alchemy state-store Worker
  and its Secrets Store, the `beep-effect-web` Worker, and DNS on zone
  `82866058fd8b10c4875b1ed4d97a8948` (beep-effect.com).
- This packet.

## Constraints

- Pin `alchemy` and `@alchemy.run/cloudflare` to the same exact version (`2.0.0-beta.84` at
  packet creation; the beta has no semver promise). Both must accept the repo's catalog `effect` (peer `^4.0.5`).
- The stack is per-package (`apps/beep-effect-web/alchemy.run.ts`, Stack `BeepEffectWeb`). Anchor every path with
  `import.meta.dirname`/`import.meta.url`, because the Alchemy CLI resolves relative paths from the invocation root.
- State is `Cloudflare.state()`, the default store name `alchemy-state-store`, shared account-wide. Never commit `.alchemy/`.
- Credentials come only from `op run` with `CLOUDFLARE_API_TOKEN=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`
  and `CLOUDFLARE_ACCOUNT_ID=op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID`. Never `alchemy profile` with a
  pasted token. Never print a resolved value.
- Only stage `prod` attaches a custom domain. Every other stage (`live_$USER`, `dev_$USER`) serves only from workers.dev.
- DNS edits are limited to the apex A/AAAA records, `www`, and the Worker custom domains. `_dmarc`, `_domainconnect`,
  and mail records stay untouched.
- The app serves no slug that the 2026-10-20 public-origin ruling reserves (`/ns`, `/taxonomy`, `/docs`, `/api`, ...).
  Its origin must equal `@beep/public-site`'s origin.
- `prod` deploys run only in CI, under the GitHub `concurrency` group `alchemy-beep-effect-web-prod`, because the
  Cloudflare state store documents no lock. `alchemy.run.ts` refuses the `prod` stage unless `CI=true`
  (`Config.Literal("true", "CI")`). Local runs use explicit personal stages.
- Dev servers stay portless-wrapped (`http://beep-effect-web.beep.localhost:1355`).

## Acceptance Criteria

- [x] `apps/beep-effect-web` exists, was created by `create-package --type app --app-kind vite`, and runs TanStack Start.
      Package lint, check, and test pass.
- [x] `alchemy plan --stage prod` (via `op run`) prints a plan with no error. `alchemy deploy --stage prod` converges,
      and an immediate second deploy is a no-op.
- [x] `https://beep-effect.com/` returns 200 with the starter page. `https://www.beep-effect.com/` 301s to the apex.
      Browser QA screenshot recorded in `history/`.
- [x] The parking A records are gone: they were deleted through the API right before the deploy, and the pre-change record export is saved in `history/`.
- [x] `alchemy state list --backend cloudflare` shows stack `BeepEffectWeb` stage `prod`. No `.alchemy/` is tracked.
- [ ] A GitHub Actions workflow deploys `prod` on push to `main` touching `apps/beep-effect-web/**`, with a per-stage
      concurrency group and `CI=true`, against a pre-bootstrapped state store. One green run is recorded.
- [x] A test pins the app origin to `@beep/public-site` and asserts that no route collides with a reserved slug.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/beep-effect-web-alchemy/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/beep-effect-web-alchemy/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/beep-effect-web-alchemy` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-28 | Framework: TanStack Start on `Cloudflare.Website.Vite` | `Website.Vite` is Alchemy's core frontend path. Next.js needs OpenNext, which has no edge routes, no PPR/`use cache`, and needs Images for `next/image`. TanStack Start lines up with Effect RPC and atoms. Operator chose it after allowing Vite/TanStack | Recreate the app with `--app-kind nextjs` and swap to `Website.Nextjs`; no infra beyond the Worker changes |
| 2026-10-28 | Per-package stack in `apps/beep-effect-web/alchemy.run.ts` (Alchemy "Option B") | Alchemy's own rule for multi-stack is different deploy cadences and independent destroy, and this repo has 15 apps on separate cadences. A root stack would grow into a whole-repo stack | Move the Stack body into a root `alchemy.run.ts`; state keys are per stack name, so keep the name `BeepEffectWeb` |
| 2026-10-28 | State: `Cloudflare.state()` (Durable Object + SQLite, encrypted, keys in Secrets Store) | This is Alchemy's recommendation on Cloudflare and stands in for S3 + DynamoDB. It documents no lock, so concurrency is serialized per stage | Export with `alchemy state` and import into another backend; `alchemy destroy` then redeploy as a last resort |
| 2026-10-28 | Canonical host is the apex `beep-effect.com`; `www` 301s to it; prod `workersDev: false` | Follows the 2026-10-20 single-origin ruling (apex hosts projections) | Swap `domain.name` and `redirects` |
| 2026-10-28 | Delete the parking apex A records and the `www` CNAME through the Cloudflare API right before the first deploy (amended: Alchemy beta.84 attaches redirect hosts as custom domains and sends no DNS override, so adopting does not apply) | A Worker custom domain needs the hostname free. The records point at registrar parking. Reversal path: export them before the change | Recreate from the `history/` export |
| 2026-10-28 | Credentials via `op run` env, not Alchemy profiles | Follows the repo's 1Password doctrine: no plaintext token in `~/.alchemy/profiles.json` | Run `alchemy profile edit --add Cloudflare` |
| 2026-10-28 | First prod deploy is local. CI deploy on `main` lands in the same goal | Prove the stack before wiring CI secrets and the bootstrap | Delete the workflow |
| 2026-10-28 | Stages: `prod` plus personal defaults. No PR previews in v1 | Keeps the account small. Previews need the CI phase first | Add `pr-<n>` deploy/destroy jobs |
| 2026-10-28 | Dedicated account-owned token `alchemy-beep-effect-web` in `CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`, minted by the operator with `ops/mint-alchemy-token.sh` (the `cf` CLI) | The shared IaC token lacked Secrets Store, Workers domains, and rulesets access, and `.env.example` lists it for other uses. A separate least-privilege token leaves those unchanged | Delete the token in the dashboard and point the env refs back |
| 2026-10-28 | Registered the account workers.dev subdomain `beep-effect` | The account had none (`10007`), and Alchemy's state-store Worker is only reachable on workers.dev. No Workers existed before, so nothing else changed URL | `PUT /workers/subdomain` with another name, or manage it with `Cloudflare.Workers.Subdomain` |
| 2026-10-31 | CI deploy: `.github/workflows/deploy-beep-effect-web.yml` runs on push to `main` (app, `public-site`, `identity`, lockfile, and the workflow itself) plus `workflow_dispatch`. It uses GitHub environment `beep-effect-web-prod` (branch policy `main` only) holding `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, piped from 1Password and never printed. Concurrency group `alchemy-beep-effect-web-prod` with no cancel. Steps: app tests, deploy, then an apex 200 / www 301 smoke check | The state store has no lock. Branch policy keeps prod credentials off PR refs. Workspace deps export source, so no Turbo build is needed. The workflow was first staged for the operator because the repo denied agent edits under `.github/workflows` (see the next row) | Delete the workflow and the environment |
| 2026-10-31 | Removed the `Edit(**/.github/workflows/**)` deny rule from `.claude/settings.json` (operator: "You should have autonomy"). The operator applied it with a one-off script, because `Edit(**/.claude/settings.json)` still blocks agent edits to that file | Agents author CI workflows; the settings self-edit guard stays. Hosted Heavy / Check then showed `@beep/ai-sync` hard-requires the rule (`RequiredClaudeRepoDenyPermission`). The orchestrator asked to restore it; the operator chose (2026-10-31) to drop it from that 22-rule policy domain instead | Re-add the line to `permissions.deny` and to `RequiredClaudeRepoDenyPermission` |
| 2026-10-31 | After the first local deploy, `prod` deploys are CI-only: the stack fails with a ConfigError on `CI` for a non-CI `prod` stage | CodeRabbit (#2391): a local `prod` deploy could interleave with a CI deploy against the lock-free state store | Remove the guard in `alchemy.run.ts` |
| 2026-10-31 | The leftover GitHub environments `Production – beep-effect-web` / `Preview – beep-effect-web` come from a Vercel project last deployed 2026-01-16 that no longer exists; there is no overlap. They are left untouched | Not created by this goal | Delete them in the repo settings |
| 2026-10-28 | No `@cloudflare/workers-types` / `src/env.ts` binding proxy in v1 | The starter binds nothing; add both with the first binding (per the Alchemy TanStack guide) | Add when a binding lands |
| 2026-10-28 | Hosts derive from `@beep/public-site` `PublicOrigin` in `src/PublicHosts.ts`, and the guard test reads `getRouter().routesByPath` | Origin drift is impossible by construction. The test pins the derived host and checks route first segments against `SiteRoute` | Inline literals in `alchemy.run.ts` |
| 2026-10-28 | v1 content is the starter page plus a public-site origin and reserved-slug guard test | Keeps the 2026-10-20 route-map ruling enforceable from day one | Drop the test |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
