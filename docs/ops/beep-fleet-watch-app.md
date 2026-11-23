# beep-fleet-watch GitHub App

The identity behind `.github/workflows/fleet-missed-event-check.yml`. Every ten minutes the
workflow runs `beep ci fleet-missed-event-check`, which compares the jobs the runner fleet
was asked to serve with the deliveries its `workflow_job` webhook received and with the
organization's self-hosted runners (goal `infra-alchemy-rebuild`, P5). It only reads.

## Shape

- Owner: the `beep-effect` organization. The App is private, with no webhook and no events.
- Permissions are all read-only. Each one covers an endpoint the check calls:

  | Permission | Level | Endpoint the check reads |
  | --- | --- | --- |
  | Actions (repository) | read | `repos/{repo}/actions/runs`, `actions/runs/{id}/jobs` |
  | Webhooks (repository) | read | `repos/{repo}/hooks/{id}/deliveries` and one delivery |
  | Self-hosted runners (organization) | read | `orgs/{org}/actions/runners` |
  | Metadata (repository) | read | required by GitHub |

  The workflow's token request asks for exactly the first three, so the App holds nothing
  the token never uses. In particular it has no Administration permission: listing the
  organization's runners needs only Self-hosted runners read.
- Installed on **Only select repositories**: `beep-effect/beep-effect`.
- Credentials live in 1Password, item `beep-fleet-watch GitHub App` in vault `BEEP_SECRETS`,
  with fields `app_id`, `client_id`, `installation_id`, `slug` and `private_key` (concealed).
- Actions settings sit on the `fleet-watch` environment, whose deployment branch policy is
  `main` and which `@beep/infra-github` declares:
  - variable `FLEET_WATCH_APP_CLIENT_ID`: the `client_id`, not the numeric `app_id`;
  - secret `FLEET_WATCH_APP_PRIVATE_KEY`.

## Registration (operator, two clicks and one install)

`packages/tooling/policy-pack/repo-configs/data/github-apps/beep-fleet-watch.manifest.json`
holds the manifest. `--dry-run` prints it unchanged.

1. Run `bun run beep github app mint beep-fleet-watch`. Before it listens, the launcher checks
   1Password access: it creates and then deletes a throwaway item in `BEEP_SECRETS` through
   `op-human`. Approve both prompts if 1Password asks.
2. Open `http://localhost:8787` in Chrome as `kriegcloud` and click **Create beep-fleet-watch
   in beep-effect**.
3. On GitHub's page, click **Create GitHub App for beep-effect**. GitHub redirects to the
   loopback callback. The callback converts the manifest and pipes the item into
   1Password. The terminal then prints the App's slug and `app_id`. The private key never
   reaches the page, the terminal, argv or a file.
4. Install the App. On its settings page
   (`https://github.com/organizations/beep-effect/settings/apps/<slug>`):
   1. Click **Install App** in the left sidebar.
   2. Click **Install** beside `beep-effect`.
   3. Choose **Only select repositories**, pick `beep-effect/beep-effect`, and click
      **Install**.
5. Press Ctrl-C to stop the launcher.

Never use GitHub's "Generate a private key" button: it downloads a PEM. If conversion
succeeds but storage fails, do not reload the callback, because the code is single-use.
Revoke the new App's generated key, delete the uninstalled registration, and register
again.

## Wiring the environment

- After the mint, the `client_id` is committed as the `FLEET_WATCH_APP_CLIENT_ID` variable of
  the `fleet-watch` environment in `packages/tooling/infra/github/src/Production.ts`. The
  value is not secret; `KNOWLEDGE_MINT_APP_CLIENT_ID` follows the same precedent.
- The private key is a GitHub secret. `@beep/infra-github` deploys from CI, and CI cannot
  read 1Password: the packet-gate ruling of 2026-11-13 puts no 1Password token into that
  workflow. The stack therefore lists `fleet-watch/FLEET_WATCH_APP_PRIVATE_KEY` as
  unmanaged until the secret-delivery route is ruled. The route is the one goal
  `infra-alchemy-rebuild` records for this App.
