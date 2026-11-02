# beep-effect.com web app on Alchemy Plan

## Status

Status: `active`. P0–P4 done; https://beep-effect.com deploys from CI on every `main` push that touches the app (first green run 41244684210, 2026-10-31). P5 Close in progress.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Alchemy fit, zone snapshot, grill decisions. | `research/alchemy-fit-2026-10-28.md` plus the SPEC Decision Log. |
| P1 Scaffold | complete | `bun run beep create-package beep-effect-web --type app --app-kind vite`, then convert it to TanStack Start (Cloudflare-compatible starter), add `.alchemy/` to `.gitignore`, add pinned `alchemy` and `@alchemy.run/cloudflare`, and write `alchemy.run.ts` (Stack `BeepEffectWeb`, `Cloudflare.Website.Vite` with `rootDir` anchored; prod-only `domain`). | Package verify passes; the app serves locally (`alchemy dev` waits for P2 because it bootstraps the cloud state store). |
| P2 First deploy (local) | complete | Check the IaC token's permissions (Workers Scripts, Workers custom domains, DNS edit, Secrets Store edit). Export the zone DNS to `history/`. `op run -- alchemy state bootstrap --backend cloudflare`; `plan --stage prod`; `deploy --stage prod --adopt` scoped to the apex/www records; redeploy as a no-op check. | Apex 200, www 301, browser QA evidence in `history/`. |
| P3 CI deploy | complete | GitHub Actions workflow on `main` (paths `apps/beep-effect-web/**`), with `CLOUDFLARE_*` secrets, `CI=true`, and concurrency group `alchemy-beep-effect-web-prod`. | One green deploy run recorded. |
| P4 Yeet: PR to mergeable | complete | Publish through yeet and drive the PR to mergeable. | Merge gate passes. |
| P5 Close | in-progress | Closeout reflection and packet state flip. | Reflection exists and completion refresh verifies. |

## Current Blockers

None. Resolved history below.

- **RESOLVED 2026-10-28 P2: `CLOUD_CLOUDFLARE_ACCOUNT_IAC_TOKEN` lacks permissions.** Probed read-only. The token is
  active and can list Workers scripts, zone Workers routes, the zone, and DNS. Cloudflare returns
  `10000 Authentication error` for Secrets Store (`/secrets_store/stores`), `/workers/subdomain`,
  `/workers/domains`, `/workers/durable_objects/namespaces`, and zone `/rulesets` (including the
  `http_request_dynamic_redirect` entrypoint). The token cannot read its own policies (`9109`).
  The token needs these permission groups:
  - Account: Workers Scripts Edit (the Worker, the state-store Durable Object, custom domains, and the workers.dev subdomain),
    Secrets Store Edit (state-store token and encryption key), Account Settings Read.
  - Zone `beep-effect.com`: Zone Read, DNS Edit, Workers Routes Edit, Dynamic URL Redirects Edit (the www→apex rule).
  **Resolution:** the operator runs `bash goals/beep-effect-web-alchemy/ops/mint-alchemy-token.sh`. It mints the dedicated token
  with exactly these groups through `cf accounts tokens create` and stores it as `CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`.
  Nothing was mutated: no DNS deletes, no state bootstrap, no deploy. The pre-change DNS export is
  `history/2026-10-28-dns-before-deploy.json`.
- Reading the Alchemy source (beta.84 `WorkerProvider.ts`) shows that redirect hostnames are also
  attached as Worker custom domains, and the attach sends no DNS override. P2 therefore deletes the
  two apex parking A records **and** the `www` CNAME (both covered by the export) right before
  deploying, through the API with the same token. This replaces the earlier "adopt" wording.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/beep-effect-web-alchemy/GOAL.md)" -le 4000
jq . goals/beep-effect-web-alchemy/ops/manifest.json
rg -n "beep-effect-web-alchemy|GOAL.md|agentLaunchers|packetAnchorDocument" goals/beep-effect-web-alchemy
git diff --check -- goals/beep-effect-web-alchemy
```
