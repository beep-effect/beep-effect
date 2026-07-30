# P3 Live Agent Runbook

This is the operator-sitting checklist for the live-only P3 proofs. Repository
tests prove rendering and fail-closed behavior; they do not prove a real
provider, Telegram, 1Password, or workstation mutation. Evidence goes under
`history/p3/` as `Assertion` → exact `Commands` → sanitized unedited
`Raw output` → `PASS|FAIL|BLOCKED`.

## 0. Prerequisites and hard stops

1. Confirm P1 and P2 are on `main`, then use P2's armed sudo PTY via
   [`sudo-session.sh`](./sudo-session.sh). Run the whole privileged sitting in
   that PTY.
2. Require an unlocked 1Password desktop, successful `op whoami`, the hosted
   provider account, the selected loopback OpenAI-compatible server, a
   Telegram bot, and the intended owner present.
3. Provision the root-owned Node toolchain at `/opt/beep/openclaw/node/bin`
   per the P2 runbook's "Provision the root-owned Node toolchain" section.
   Staging runs `npm install` as root and fails closed with `STAGE-FAIL`
   (exit 73) on a user-writable toolchain, so a mise/nvm path under `$HOME`
   cannot be used.
4. Hard stop if any command, Pulumi value/state, tracked file, or evidence
   would contain raw secrets or real client identities, documents, facts, or
   data. Only synthetic prompts and nonces are permitted.

## 1. 1Password bootstrap

The sole plaintext exception is the scoped service-account token at:

```text
/etc/beep/openclaw/credentials/op-service-account-token
```

Provision it out of band with interactive no-echo entry or an approved
injection mechanism. Its parent and file must be root-owned, not
user-writable, and narrowly readable by the OpenClaw service identity. Archive
only the path, owner, group, and mode. Never archive content or a content hash.

The unit delivers it as
`LoadCredential=op-service-account-token:/etc/beep/openclaw/credentials/op-service-account-token`.
`run.sh` removes inherited `OP_SESSION`, `OP_CONNECT_TOKEN`, and
`OPENCLAW_GATEWAY_TOKEN`, reads only the systemd credential into
`OP_SERVICE_ACCOUNT_TOKEN`, and runs `op whoami` in the exact service
environment before validating config.

For rotation: atomically replace the credential, restart, prove `op whoami` in
the service environment, revoke the old service account, and prove the old
owner cannot resolve. Record only timestamps, exit codes, and redacted status.

## 2. Stack configuration and deploy

Set the existing P2 identity, resolver, and path keys, then every required P3
key. Values shown as `op://` are references only:

```sh
cd infra/openclaw
pulumi config set openclaw:expectedMachineId  "$(cat /etc/machine-id)"
pulumi config set openclaw:expectedHostname   "$(hostname)"
pulumi config set openclaw:expectedUid        "$(id -u)"
pulumi config set openclaw:expectedUsername   "$(id -un)"
pulumi config set openclaw:expectedHome       "$HOME"
pulumi config set openclaw:expectedRuntimeDir "/run/user/$(id -u)"
pulumi config set openclaw:configRoot /etc/beep/openclaw
pulumi config set openclaw:stateDir /var/lib/beep/openclaw
pulumi config set openclaw:nodeBinDir /opt/beep/openclaw/node/bin
pulumi config set openclaw:resolverCommandPath /opt/beep/openclaw/op-resolver.sh
pulumi config set openclaw:resolverOpBinaryPath /opt/beep/openclaw/bin/op
pulumi config set openclaw:resolverTrustedDir /opt/beep/openclaw
pulumi config set openclaw:gatewayAuthTokenRef "op://<vault>/<item>/<field>"
pulumi config set openclaw:gatewayPort 19031

pulumi config set openclaw:telegramBotTokenRef "op://<vault>/<item>/<field>"
pulumi config set openclaw:telegramDmPolicy pairing
pulumi config set openclaw:telegramGroupPolicy disabled
# telegramDefaultTo is intentionally absent for initial pairing.

pulumi config set openclaw:hostedProviderId "<provider-id>"
pulumi config set openclaw:hostedProviderBaseUrl "<https-openai-compatible-base>"
pulumi config set openclaw:hostedProviderModelId "<model-id>"
pulumi config set openclaw:hostedProviderModelName "<model-name>"
pulumi config set openclaw:hostedProviderApiKeyRef "op://<vault>/<item>/<field>"
pulumi config set openclaw:localProviderId "<local-provider-id>"
pulumi config set openclaw:localProviderBaseUrl "http://127.0.0.1:<port>/v1"
pulumi config set openclaw:localProviderModelId "<local-model-id>"
pulumi config set openclaw:localProviderModelName "<local-model-name>"
```

Run `pulumi preview` and `pulumi up` only in the armed PTY. Archive generation,
config, SOUL, proof-skill, unit, and launcher hashes; the pinned compatibility
tuple; and `http://127.0.0.1:19031`.

## 3. Hosted authentication ceremony

The stack first renders non-secret `auth.profiles` metadata at
`<hostedProviderId>:managed`. API-key providers use only the rendered
`SecretRef`; never run `paste-api-key`.

If the selected pinned provider requires OAuth, first capture the pinned help.
Only then run:

```sh
openclaw models auth login --provider "<id>" --profile-id "<id>:managed"
```

Use no unconfirmed flags and omit `--set-default` because it may mutate config.
Capture unchanged generation/config hashes before and after, SQLite/WAL
metadata, and a read-only logical inventory of expected profile/schema and
`PRAGMA user_version` without secret columns. OAuth SQLite writes are allowed
only when the selected pinned flow and a dated SPEC decision explicitly cover
them; otherwise stop at `SecretRef`.

## 4. Telegram pairing and writer matrix

1. Deploy `pairing` / `disabled` with no `telegramDefaultTo`.
2. Send a unique synthetic nonce, list the pairing request, approve it, and
   record only persistence path/mode/logical hash/redacted count.
3. Attempt first-owner behavior. Require declarative render or graceful
   immutable refusal; active generation content must not change.
4. Set the redacted owner declaratively and redeploy:

   ```sh
   pulumi config set openclaw:telegramDefaultTo "<redacted-owner-target>"
   ```

5. Exercise reconnect, an `op://` token swap plus `secrets reload`, and
   group→supergroup migration only where triggerable.

Classify login/bootstrap, pairing/first-owner, `defaultTo` writeback,
reconnect, token swap, and group→supergroup migration as `declarative render`,
`graceful skip`, or `INCOMPATIBLE`. Finish with exactly one default Telegram
account, `probe.ok == true`, no probe error/failure, and a synthetic DM
round-trip. The pinned CLI has no generic receive-once command: correlate the
operator reply nonce and response in sanitized gateway/session evidence.

## 5. Control UI and fail-closed acceptance

Prove the UI is reachable only at the two rendered loopback origins. Confirm
that `allowInsecureAuth`, `dangerouslyDisableDeviceAuth`,
`dangerouslyAllowHostHeaderOriginFallback`, and all unneeded UI keys are absent.

Obtain the rendered `liveAcceptanceCommand` stack output. First make one
designated `op://` reference unresolvable and run its `degraded` mode. Require
nonzero reload plus the degraded-reloader journal alert. Restore the reference,
then run `restored` with synthetic-only environment values:

```sh
P3_TELEGRAM_TARGET="<redacted-target>" \
P3_SYNTHETIC_NONCE="P3-$(date -u +%Y%m%dT%H%M%SZ)-<random>" \
  <liveAcceptanceCommand> restored
```

The restored phase fails closed unless reload has zero warnings, the hosted
turn is exact `P3_MODEL_OK`, local `/models` includes the configured local
model, exactly one eligible workspace `beep-proof-ping` exists and hashes
correctly, its turn is exact `P3_SKILL_OK`, Telegram returns a receipt/message
id, and exactly one default Telegram account probes healthy. A model/channel
success from before the restored reload does not count.

## 6. Evidence

Populate:

- `history/p3/auth-bootstrap/`
- `history/p3/telegram-pairing/`
- `history/p3/acceptance/`
- `history/p3/writer-matrix/`

Every entry records `Assertion`, exact `Commands`, sanitized unedited
`Raw output`, then `PASS|FAIL|BLOCKED`. Preserve exit codes, UTC timestamps,
hashes, and versions. Redact tokens, complete Telegram IDs, non-sentinel model
responses, and secret database columns. Do not edit raw output into a pass.
