# ci-fleet-endgame — secret references (references only, never values)

GitHub App `beep-ci-fleet-controller` (created 2026-08-08, org-owned,
repo-scoped install on beep-effect/beep-effect; webhook inactive until
post-deploy activation):

- App ID: `op://BEEP_CI/BEEP_CI_FLEET_CONTROLLER_APP_ID/password`
- Client ID: `op://BEEP_CI/BEEP_CI_FLEET_CONTROLLER_CLIENT_ID/password`
- Private key (PEM):
  `op://BEEP_CI/beep-ci-fleet-controller.2026-08-08.private-key/beep-ci-fleet-controller.2026-08-08.private-key.pem`
- Webhook secret: `op://BEEP_CI/BEEP_CI_FLEET_CONTROLLER_WEBHOOK_SECRET/password`

Pulumi state passphrase (existing):
`op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE`

Deploy-time flow (decision 60): resolve via `op read` at execution only →
SSM SecureString under KMS → module reads SSM. Values never enter the repo,
transcripts, or Pulumi config plaintext.

Webhook activation (post-deploy, operator browser step): paste the module's
API Gateway URL + the webhook secret into the App's Webhook section, check
Active, subscribe `workflow_job`.
