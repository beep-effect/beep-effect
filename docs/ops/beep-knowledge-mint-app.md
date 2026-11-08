# beep-knowledge-mint GitHub App

The App that `.github/workflows/knowledge-baseline-mint.yml` acts as when it opens the
baseline-only pull request from `automation/knowledge-baseline-mint` (design K32–K37 in
[goals/knowledge-surface-automation/research/p4-knowledge-doctor-design.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/knowledge-surface-automation/research/p4-knowledge-doctor-design.md)). The Lint
Policy seal guard admits that pull request only when its author is `<slug>[bot]` for
`KNOWLEDGE_MINT_APP_SLUG`.

## Shape

- Owner: the `beep-effect` organization; private; no webhook; no events.
- Repository permissions: Contents, Pull requests and Issues read and write; Metadata read.
  Issues write is only for the `ready-for-heavy` label, which create-pull-request applies
  through the Issues labels API.
- Installed on **Only select repositories**: `beep-effect/beep-effect`.
- Credentials: 1Password item `beep-knowledge-mint GitHub App` in vault `BEEP_SECRETS`,
  fields `app_id`, `client_id`, `installation_id`, `slug`, `private_key` (concealed).
- Repository Actions settings: variables `KNOWLEDGE_MINT_APP_CLIENT_ID` (the `client_id`,
  not the numeric `app_id`) and `KNOWLEDGE_MINT_APP_SLUG`; secret
  `KNOWLEDGE_MINT_APP_PRIVATE_KEY`.

## Registration (human only)

`packages/tooling/policy-pack/repo-configs/data/github-apps/beep-knowledge-mint.manifest.json`
holds the manifest, and `bun run beep github app mint beep-knowledge-mint` serves it on
`http://localhost:8787`, bound to loopback. `--dry-run` prints the manifest unchanged.

- The form POSTs the manifest to the organization's App registration page with a random
  `state`.
- The one-use callback exchanges the code with `POST /app-manifests/{code}/conversions`
  and pipes the item template into `op item create --vault BEEP_SECRETS -` through
  `bash -o pipefail -c "cat | ..."`. Bun's child stdin is a socket on Linux, and the
  1Password CLI only recognizes a real pipe as template input.
- The key never reaches argv, a file, the page, or the terminal. Responses disable
  caching and referrer propagation.

Agent service accounts are read-only on `BEEP_SECRETS`, so a person runs the launcher
with their own write-capable 1Password lane on `PATH` as `op`. Never use GitHub's
"Generate a private key" button: it downloads a PEM.

If conversion succeeds but storage fails, do not reload the callback; the code is
single-use. Revoke the new App's generated key, delete that uninstalled registration,
and register again.

## Provisioned 2026-10-14

App `beep-knowledge-mint`, app_id 5321422, installation 171500598 (selected:
`beep-effect/beep-effect`). An in-memory installation token confirmed the permissions
above and the single-repository scope, and was revoked after the check.
