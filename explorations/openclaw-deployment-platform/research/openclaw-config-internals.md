# OpenClaw config internals

Source under study: OpenClaw `2026.7.2`, commit
`663c4fba10536a7148749f2b35fb5af6d54d3cb7`. The package declares state schema
version 5 and agent schema version 14. (`package.json:2-8`)

## 1. Config load path

### Discovery and syntax

- The canonical filename is `openclaw.json`; the remaining legacy filename is
  `clawdbot.json`. (`src/config/paths.ts:23-27`)
- Mutable state defaults to `~/.openclaw`, can be relocated with
  `OPENCLAW_STATE_DIR`, and can fall back to an existing legacy `~/.clawdbot`
  directory. (`src/config/paths.ts:60-93`)
- `OPENCLAW_CONFIG_PATH` selects an explicit file. Otherwise the canonical path
  is `$OPENCLAW_STATE_DIR/openclaw.json`, or `~/.openclaw/openclaw.json` when the
  state directory is not overridden. (`src/config/paths.ts:154-168`)
- Candidate discovery is ordered: explicit config path, files under the
  explicitly selected state directory, then the new and legacy default
  directories. Each directory is checked for `openclaw.json` and then the
  legacy filename. (`src/config/paths.ts:254-281`)
- The file is parsed with JSON5, so JSON, JSON5 syntax, and comments are accepted
  on read. (`src/config/io.load.ts:59-65`) Any OpenClaw rewrite serializes
  canonical two-space JSON and warns before stripping JSON5 comments.
  (`src/config/io.write.ts:225-230`, `src/config/io.write.ts:368-397`)

### Includes and partials

- `$include` may be a string or an array, and it is recognized at any object
  depth. (`src/config/includes.ts:165-178`, `src/config/includes.ts:213-233`)
- Object values are recursively merged, arrays concatenate, and the later
  source wins for primitive conflicts. Sibling keys in the including object
  override included content; an include array is reduced in order, so later
  files override earlier files. (`src/config/includes.ts:140-143`,
  `src/config/includes.ts:189-227`)
- Relative includes are confined to the directory containing the root config.
  Additional absolute roots can be allowlisted with the platform-delimited
  `OPENCLAW_INCLUDE_ROOTS`; lexical paths and resolved symlinks are both checked.
  (`src/config/paths.ts:112-149`, `src/config/includes.ts:248-313`)
- Circular includes and nesting beyond the configured maximum are rejected.
  (`src/config/includes.ts:330-342`)
- No separate implicit `config.d` directory loader was found. The source-visible
  partial mechanism is the explicit `$include` resolver invoked immediately
  after parsing the root file. (`src/config/io.load.ts:59-66`,
  `src/config/io.read-helpers.ts:229-293`)

### Effective precedence

There is no generic `defaults < file < env < flags` overlay of the whole config
tree. The actual sequence is:

1. `.env` is loaded, the selected root is read, JSON5 is parsed, and `$include`
   values are resolved. (`src/config/io.load.ts:33-65`,
   `src/config/io.read-helpers.ts:149-153`)
2. The file's `env` section publishes allowed values into the process
   environment, but it does not replace an already non-empty, higher-precedence
   host value; it can replace values classified as lower-precedence shell
   fallback values. (`src/config/io.read-helpers.ts:302-317`,
   `src/config/config-env-vars.ts:535-605`)
3. `${UPPER_CASE_NAME}` references are substituted throughout string values in
   the resolved tree. A missing value is retained as a visible placeholder and
   reported as a warning on the normal load path. (`src/config/env-substitution.ts:116-137`,
   `src/config/io.load.ts:71-75`)
4. The resolved object is validated, including plugin-owned config. Invalid
   input aborts the load. (`src/config/io.load.ts:103-135`)
5. Runtime defaults and path normalization are materialized only after
   validation. (`src/config/io.load.ts:165-186`,
   `src/config/materialize.ts:57-88`)
6. Shell fallback may fill environment values, a generated owner-display
   secret may be retained only in memory, and `/debug` process-local overrides
   are merged last. (`src/config/io.context.ts:65-93`,
   `src/config/runtime-overrides.ts:49-84`)

Selected command flags are command-local overrides, not a general config
mapping. For example, foreground gateway `--token` populates
`OPENCLAW_GATEWAY_TOKEN`, while `--auth`, `--password`, and `--token` are passed
as an explicit startup auth override. (`src/cli/gateway-cli/run.ts:938-1028`)

## 2. Env override coverage

### Generic mechanism

- Any string-valued config leaf, including strings inside arrays or objects,
  can contain `${NAME}`. Names must match `[A-Z_][A-Z0-9_]*`; `$${NAME}` emits a
  literal placeholder. (`src/config/env-substitution.ts:1-20`,
  `src/config/env-substitution.ts:23-27`, `src/config/env-substitution.ts:52-73`)
- Traversal substitutes strings recursively but passes numbers, booleans, and
  null through unchanged. Therefore this is interpolation, not a typed
  environment-to-config mapper. (`src/config/env-substitution.ts:165-206`)
- The config's `env.vars` block flows in the opposite direction: it publishes
  string values into the runtime environment, subject to safety filtering and
  the host-environment precedence rule. (`src/config/config-env-vars.ts:30-71`,
  `src/config/config-env-vars.ts:535-605`)

### Bespoke environment controls

| Environment variable | Source-visible effect and precedence |
| --- | --- |
| `OPENCLAW_CONFIG_PATH` | Selects the config file; it is not a config-key override. (`src/config/paths.ts:154-168`) |
| `OPENCLAW_STATE_DIR` | Relocates mutable state and therefore the default config path. (`src/config/paths.ts:60-72`, `src/config/paths.ts:154-168`) |
| `OPENCLAW_INCLUDE_ROOTS` | Adds allowed roots for `$include`; it does not inject config keys. (`src/config/paths.ts:112-149`) |
| `OPENCLAW_GATEWAY_PORT` | Wins over `gateway.port`, which wins over port `18789`. (`src/config/paths.ts:361-376`) |
| `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PASSWORD` | Supply startup/probe credentials when the applicable configured credential is absent; configured remote credentials remain authoritative for remote probes. (`src/gateway/auth-surface-resolution.ts:51-101`, `src/gateway/auth-surface-resolution.ts:103-148`) |
| `OPENCLAW_WORKSPACE_DIR` | Wins over profile-derived/default workspace selection. (`src/agents/workspace-default.ts:11-25`) |
| `OPENCLAW_LOG_LEVEL` | Overrides runtime log-level selection when it parses as an allowed value. (`src/logging/env-log-level.ts:6-24`) |
| `OPENCLAW_OAUTH_DIR` | Relocates the legacy OAuth credential directory under the state tree. (`src/config/paths.ts:306-330`) |
| `OPENCLAW_NIX_MODE=1` | Marks config externally managed and blocks the central config-write path. (`src/config/paths.ts:10-18`, `src/config/nix-mode-write-guard.ts:32-43`) |

Plugins add named credential alternatives rather than extending a core
key-derived naming scheme. For example, `TELEGRAM_BOT_TOKEN` is a fallback for
the default Telegram account after configured `channels.telegram.botToken` is
checked; Discord declares `DISCORD_BOT_TOKEN` for its implicit default account;
Slack's default account reads `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, and
`SLACK_USER_TOKEN` after inspecting configured values. (`extensions/telegram/src/token.ts:225-242`,
`extensions/discord/src/accounts.ts:19-34`,
`extensions/discord/src/account-inspect.ts:65-90`,
`extensions/slack/src/account-inspect.ts:82-105`) Provider plugins similarly
declare their own credential variables, for example `GEMINI_API_KEY`.
(`extensions/google/src/gemini-web-search-provider.ts:112-128`)

There is no source-visible naming convention that maps an arbitrary key such as
`agents.defaults.foo` to `OPENCLAW_AGENTS_DEFAULTS_FOO`. Numeric, boolean,
array, object, and most scalar config fields are file-only unless a particular
consumer implements a bespoke environment or CLI override; generic
substitution only reaches string leaves. (`src/config/env-substitution.ts:165-206`,
`src/config/paths.ts:361-376`)

Notable file-only surfaces therefore include the shape of `agents`, `bindings`,
`channels`, `plugins`, `hooks`, `commands`, `browser`, and typed numeric/boolean
settings except where their individual implementation supplies an explicit
override. The root schema exposes these as structured config sections rather
than an environment mapping. (`src/config/zod-schema.root-shape.ts:134-170`,
`src/config/zod-schema.root-shape.ts:282-301`,
`src/config/zod-schema.root-shape.ts:361-377`,
`src/config/zod-schema.root-shape.ts:441-458`)

## 3. Runtime writers

### Write semantics shared by all writers

- `replaceConfigFile` takes a complete next config, serializes writers under a
  mutation lock, performs compare-and-swap hash checks, and routes to the
  central writer. (`src/config/mutate.ts:954-1005`)
- A caller may logically change one key, but the normal commit validates the
  complete candidate, stamps OpenClaw version metadata, produces canonical
  JSON, rotates backups, and atomically replaces the whole root file.
  (`src/config/io.write.ts:158-176`, `src/config/io.write.ts:202-241`,
  `src/config/io.write.ts:368-397`)
- The writer computes a merge patch from runtime config to the requested next
  config so untouched authored values, schema URI, includes, and selected
  authored parameters survive OpenClaw-originated edits.
  (`src/config/io.write-prepare.ts:900-938`)
- Exception: when ownership can be attributed to one top-level included file,
  the mutation layer attempts to write that include directly; otherwise it
  performs the whole-root rewrite. (`src/config/mutate.ts:1009-1046`)
- Every central write is rejected in Nix mode. The error explicitly lists
  setup, onboarding, update, plugin lifecycle, doctor repair/token generation,
  and `config set` as prohibited against the immutable file.
  (`src/config/nix-mode-write-guard.ts:19-43`)

### Core production writer inventory

The following are the direct production call paths to the central mutation API
in `src/`. “Patch” below describes the caller's logical change; absent the
single-include exception, persistence is the full-file rewrite described above.

| Trigger/path | Logical keys or effect |
| --- | --- |
| `openclaw config set/unset` and batch apply | Arbitrary parsed config paths; the CLI validates the complete result and calls `replaceConfigFile`. (`src/cli/config-cli-runner.ts:450-470`, `src/cli/config-cli.ts:244-261`) |
| Gateway RPC `config.set`, `config.patch`, `config.apply` | Arbitrary validated config supplied through the control plane; the commit uses lock-time CAS and audit origin `config-rpc`. (`src/gateway/server-methods/config.ts:730-776`, `src/gateway/server-methods/config.ts:776-818`, `src/gateway/server-methods/config.ts:955-1001`, `src/gateway/server-methods/config-write-flow.ts:233-270`) |
| `setup`, onboarding/configure wizards, non-interactive onboarding, migration promotion | `agents.defaults.workspace`, `gateway.mode`, wizard selections, auth/model/channel/plugin choices, and migrated config. (`src/commands/setup.ts:130-182`, `src/commands/onboard-non-interactive/config-write.ts:25-60`, `src/wizard/setup.shared.ts:104-143`, `src/wizard/setup.migration-finalize.ts:153-168`) |
| Gateway service install, token repair, dev reset | Service install defaults `gateway.mode=local`; token setup writes `gateway.auth.mode/token`; dev reset replaces config with a development gateway/agent shape. (`src/cli/daemon-cli/install.ts:198-208`, `src/commands/gateway-install-token.ts:63-83`, `src/cli/gateway-cli/dev.ts:98-135`) |
| Doctor and update finalization | Doctor writes accumulated safe migrations, unknown-key cleanup, health repairs, service/auth repair, and legacy config repair. Update launches a fresh `doctor --repair --non-interactive`, so update may transitively rewrite config. (`src/commands/doctor/shared/config-flow-steps.ts:10-118`, `src/flows/doctor-health-contributions.ts:1157-1175`, `src/commands/doctor-gateway-services.ts:844-862`, `src/commands/doctor/legacy-config-repair.ts:31-49`, `src/cli/update-cli/update-command-fresh-doctor.ts:93-125`) |
| Agent administration | Agent bind/unbind changes `bindings`; delete removes the agent config; identity updates `agents.entries.<id>.identity`. (`src/commands/agents.commands.bind.ts:258-264`, `src/commands/agents.commands.bind.ts:357-365`, `src/commands/agents.commands.delete.ts:154-168`, `src/commands/agents.commands.identity.ts:198-211`) |
| Model commands and system-agent model selection | Model set/alias/fallback operations mutate model config through a shared writer; an approved system-agent operation mutates the selected default inference route. (`src/commands/models/shared.ts:75-89`, `src/system-agent/operations-execution-helpers.ts:571-588`) |
| Channel add/remove/login/logout/configure and directory auto-enable | Mutates the selected `channels.<id>`/account subtree and may also install or enable its plugin. (`src/commands/channels/plugin-config-persistence.ts:7-47`, `src/commands/channels/remove.ts:215-264`, `src/cli/directory-cli.ts:98-129`) |
| Plugin and hook lifecycle | Plugin enable/disable/install/update/uninstall mutates `plugins` policy/install records and related channel state; hook install/enable/disable mutates `hooks`. (`src/cli/plugins-cli.runtime.ts:212-230`, `src/cli/plugins-cli.runtime.ts:262-280`, `src/cli/plugins-uninstall-command.ts:228-245`, `src/cli/plugins-update-command.ts:433-447`, `src/plugins/install-record-commit.ts:330-346`, `src/cli/hook-install-persistence.ts:14-31`, `src/cli/hooks-cli.ts:445-475`) |
| Managed plugin service/API | Admin-scoped managed-plugin enable/disable and uninstall also rewrite plugin policy before refreshing or removing installed code. (`src/plugins/management-service.ts:1195-1230`, `src/plugins/management-service.ts:1275-1300`) |
| MCP CLI/config helpers | Add, set, and unset mutate `mcpServers` and validate before commit. (`src/config/mcp-config.ts:161-178`, `src/config/mcp-config.ts:311-328`, `src/config/mcp-config.ts:386-403`) |
| Exec policy, secrets apply, security fix | Exec policy synchronizes `tools.exec` with the separate approvals file; secrets apply rewrites projected config references along with credential/env stores; security fix commits its generated config repairs. (`src/cli/exec-policy-cli.ts:391-419`, `src/secrets/apply.ts:940-979`, `src/security/fix.ts:400-434`) |
| Gmail hook setup and promotional auth claim | Gmail setup writes the `hooks`/Gmail subtree and generated hook material; promotion claim writes the provider auth result/config patch. (`src/hooks/gmail-ops.ts:205-246`, `src/commands/promos/claim.ts:259-277`) |
| First owner pairing approval | The first approved channel sender is persisted as `commands.ownerAllowFrom` only when no command owner is already configured. (`src/pairing/command-owner.ts:14-40`) |
| Plugin migration SDK | A migration provider can patch an arbitrary declared path through `mutateConfigFile`; the runtime wrapper forwards both mutate and replace operations. (`src/plugin-sdk/migration.ts:303-321`, `src/plugin-sdk/migration-runtime.ts:78-103`) |
| Repository live-Docker normalization | The repository automation script runs non-interactive repairing doctor config flow and rewrites config when that flow reports changes. (`scripts/live-docker-normalize-config.ts:1-16`) |

### Authentication and credentials

- Normal provider login writes credential material and ordering state into the
  locked per-agent SQLite auth store. It deliberately leaves `openclaw.json`
  untouched unless the provider returns a config patch or the user opts to set
  the default model. (`src/commands/models/auth.ts:441-485`,
  `src/agents/auth-profiles/upsert-with-lock.ts:1-29`)
- Manual pasted token/API-key commands write the secret to SQLite and then
  rewrite config metadata at `auth.profiles.<profileId>`; `auth.order.<provider>`
  is also maintained when needed. (`src/commands/models/auth.ts:700-724`,
  `src/commands/models/auth.ts:736-783`,
  `src/plugins/provider-auth-helpers.ts:151-239`)
- `auth.profiles` contains provider, mode, and optional display metadata, not the
  credential secret. (`src/config/zod-schema.root-shape.ts:234-254`)
- SQLite persistence separately writes credential and auth-state payloads.
  (`src/agents/auth-profiles/store.ts:1207-1251`)

### Bundled extension writers, including event-driven paths

Bundled plugins receive the same central config mutation API, so they are also
blocked by Nix mode and otherwise have the same whole-file persistence
semantics. (`src/plugin-sdk/config-runtime.ts:28-45`,
`src/plugins/registry-runtime.ts:568-576`)

| Trigger/path | Logical keys or effect |
| --- | --- |
| Live Telegram/Slack migration and Telegram target resolution | Telegram group-ID migration, Slack channel-ID migration, and resolved Telegram `defaultTo` targets are written back from live channel handling. (`extensions/telegram/src/bot-handlers.migration.runtime.ts:42-56`, `extensions/slack/src/monitor/events/channels.ts:141-160`, `extensions/telegram/src/target-writeback.ts:176-193`) |
| Matrix startup/profile and CLI | Account setup/encryption and profile/avatar normalization rewrite Matrix account config; startup can persist a converted avatar URL. (`extensions/matrix/src/cli.ts:332-389`, `extensions/matrix/src/cli.ts:742-753`, `extensions/matrix/src/matrix/monitor/startup.ts:80-93`, `extensions/matrix/src/profile-update.ts:46-57`) |
| QQBot live interactions and chat commands | Interaction payloads may change group `require_mention`; bot commands change streaming, mention behavior, and `tools.exec` approval settings. (`extensions/qqbot/src/engine/gateway/interaction-handler.ts:114-129`, `extensions/qqbot/src/engine/commands/builtin/register-streaming.ts:114-130`, `extensions/qqbot/src/engine/commands/builtin/register-group-allways.ts:106-124`, `extensions/qqbot/src/engine/commands/builtin/register-approve.ts:59-80`) |
| Runtime chat commands | Active Memory and Dreaming owner/admin commands toggle their global plugin config; Talk Voice selection persists provider/voice. (`extensions/active-memory/index.ts:157-184`, `extensions/memory-core/src/dreaming-command.ts:110-129`, `extensions/talk-voice/index.ts:217-236`) |
| Browser/file-transfer/phone-control actions | Browser credential generation and profile operations write `gateway.auth`/`browser`; “allow always” writes node file policy; phone-control leases temporarily alter tool allow/deny config and later restore it. (`extensions/browser/src/browser/config-mutations.ts:59-74`, `extensions/browser/src/browser/config-mutations.ts:165-206`, `extensions/file-transfer/src/shared/policy.ts:348-368`, `extensions/phone-control/index.ts:312-332`, `extensions/phone-control/index.ts:689-709`) |
| Channel/provider setup and logout | Feishu login, Matrix setup, and Telegram/Line/Nextcloud Talk logout paths persist their account subtrees. (`extensions/feishu/src/channel.ts:1636-1648`, `extensions/telegram/src/channel.ts:1202-1218`, `extensions/line/src/gateway.ts:108-126`, `extensions/nextcloud-talk/src/gateway.ts:95-113`) |
| Nostr profile, Reef CLI, and plugin-specific migration | Nostr profile updates write `channels.nostr.profile`; Reef registration/migration writes `channels.reef`; Codex/Hermes migrations write plugin, auth metadata, and model config. (`extensions/nostr/index.ts:49-69`, `extensions/reef/src/cli.ts:162-185`, `extensions/codex/src/migration/apply.ts:468-485`, `extensions/codex/src/migration/auth.ts:417-436`, `extensions/migrate-hermes/auth-config.ts:66-86`, `extensions/migrate-hermes/model.ts:377-397`) |
| Codex plugin commands | Codex-managed plugin commands mutate `plugins.entries.codex.config.codexPlugins.plugins`. (`extensions/codex/index.ts:220-252`) |

Device-pairing requests, paired devices, identities, bootstrap tokens, and
device-auth tokens do **not** use `openclaw.json`; they have dedicated shared
SQLite tables. (`src/state/openclaw-state-schema.generated.ts:393-482`) Channel
pairing requests and allow entries likewise have shared SQLite tables.
(`src/state/openclaw-state-schema.generated.ts:632-659`) The separate first-owner
bootstrap above is the pairing-related config exception.

## 4. Config-vs-state separation

- The shared database is `$OPENCLAW_STATE_DIR/state/openclaw.sqlite`.
  (`src/state/openclaw-state-db.paths.ts:33-41`) Its code-level schema version is
  5. (`src/state/openclaw-state-db-contract.ts:4-8`)
- Each agent has an `openclaw-agent.sqlite`; auth-profile resolution locates it
  in the agent directory, and the agent schema version is 14.
  (`src/agents/auth-profiles/sqlite.ts:54-76`,
  `src/state/openclaw-agent-db-contract.ts:5-18`)
- Per-agent SQLite contains separate auth credential and auth operational-state
  records. (`src/state/openclaw-agent-schema.generated.ts:393-403`)
- Shared SQLite contains device pairing/auth/identity state and channel pairing
  state, rather than embedding those records in declared config.
  (`src/state/openclaw-state-schema.generated.ts:393-482`,
  `src/state/openclaw-state-schema.generated.ts:632-659`)
- The generated agent-local `models.json` is a derived sidecar based on runtime
  config, provider discovery, auth SQLite/WAL state, and plugin catalogs; its
  writer is separate from `openclaw.json`. (`src/agents/models-config.ts:1-14`,
  `src/agents/models-config.ts:85-111`, `src/agents/models-config.ts:144-157`)
- The default workspace is `~/.openclaw/workspace`, or
  `~/.openclaw/workspace-<profile>` for a named profile, and can be relocated
  with `OPENCLAW_WORKSPACE_DIR`. (`src/agents/workspace-default.ts:11-25`)
- A legacy OAuth sidecar location remains addressable as
  `$OPENCLAW_STATE_DIR/credentials/oauth.json`, with
  `OPENCLAW_OAUTH_DIR` relocation. (`src/config/paths.ts:306-330`)

The source shows a clear migration toward SQLite separation: doctor enumerates
legacy delivery queues, voice wake settings, update/config health, approvals,
conversation bindings, audit logs, device auth/identity, MCP OAuth, restart
sentinels, workspace attestations, web push, node-host state, and channel
pairing as JSON/JSONL-to-shared-SQLite migrations.
(`src/infra/state-migrations.doctor.ts:621-691`) Legacy auth JSON is likewise
imported into per-agent SQLite and removed only after backup.
(`src/commands/doctor-auth-flat-profiles.ts:746-815`)

The remaining mutable/config overlap is intentional operator-visible
configuration: auth profile metadata/order, channel/account declarations,
first-owner authorization, plugin/hook policy, model selection, and settings
changed through commands or control-plane RPC. Those writes are evidenced in
the inventories in section 3. Credential secrets and pairing records themselves
are already outside the file. (`src/commands/models/auth.ts:712-724`,
`src/pairing/command-owner.ts:24-40`,
`src/state/openclaw-state-schema.generated.ts:393-482`)

## 5. Validation and unknown keys

- Validation is Zod 4. The root is `z.strictObject(...)`, and nested config
  sections commonly use `strictObject`/`.strict()`. (`src/config/zod-schema.ts:1-15`,
  `src/config/zod-schema.root-shape.ts:35-58`)
- Raw validation uses `safeParse`, maps Zod issues into config issues, and then
  applies additional duplicate-agent, avatar, gateway, model-policy, channel,
  SecretRef, and plugin validations. (`src/config/validation.ts:1110-1183`,
  `src/config/validation.ts:1245-1272`)
- A normal load records validation issues and throws for invalid config rather
  than silently stripping it. (`src/config/io.load.ts:107-135`)
- Consequently, unknown keys at strict schema boundaries are fatal during
  normal load. Doctor has an explicit analysis step that removes unknown keys
  from its repair candidate; it only adopts the repaired candidate for writing
  when repair is enabled, while preserving active auth-profile settings.
  (`src/commands/doctor/shared/config-flow-steps.ts:86-118`)
- Legacy schema migration is also doctor-owned. Preview uses the migrated shape
  in memory, but confirmation/repair controls whether it is written; safe
  migrations may still be committed when unrelated validation issues remain.
  (`src/commands/doctor/shared/config-flow-steps.ts:10-83`)
- An OpenClaw write stamps `meta.lastTouchedVersion` and canonicalizes the
  complete output. (`src/config/io.write-safety.ts:191-197`,
  `src/config/io.write.ts:225-230`) An older binary refuses destructive actions
  against a file marked as written by a newer OpenClaw unless the explicit
  downgrade/recovery environment override is set.
  (`src/config/future-version-guard.ts:52-76`)

Conditions for an external renderer follow directly from these checks: it must
emit a schema-valid shape for the deployed OpenClaw version, must not rely on
unknown-key preservation, and must either preserve compatible `meta` fields or
accept that OpenClaw will add/update them if writes are allowed.
(`src/config/zod-schema.root-shape.ts:35-46`,
`src/config/io.write.ts:225-230`) Schema migration is not a transparent load-time
rewrite that makes an externally rendered stale schema current; doctor owns the
repair/write path. (`src/commands/doctor/shared/config-flow-steps.ts:10-83`)

## 6. Service surface facts

### Probes and port

- HTTP liveness endpoints are `GET|HEAD /health` and `/healthz`; readiness
  endpoints are `GET|HEAD /ready` and `/readyz`.
  (`src/gateway/server-http.ts:140-145`, `src/gateway/server-http.ts:270-291`)
- Liveness returns HTTP 200 with an `{ok:true}` payload. Readiness returns 200
  or 503; detailed failure data is disclosed only when the request is
  authorized for details. (`src/gateway/server-http.ts:294-321`)
- Readiness is false during startup-sidecar work or gateway draining and then
  evaluates channel runtime health. (`src/gateway/server/readiness.ts:44-77`,
  `src/gateway/server/readiness.ts:83-128`)
- The default gateway port is `18789`; `OPENCLAW_GATEWAY_PORT` overrides
  `gateway.port`, which overrides that default. (`src/config/paths.ts:284`,
  `src/config/paths.ts:361-376`)

### Launcher and version pinning

- The npm package exposes `openclaw.mjs` as the `openclaw` executable.
  (`package.json:22-24`) The launcher requires supported Node releases
  (`>=22.22.3 <23`, `>=24.15.0 <25`, or `>=25.9.0`) and rejects Bun because the
  runtime requires `node:sqlite`. (`openclaw.mjs:11-16`, `openclaw.mjs:50-72`)
- The launcher imports the adjacent packaged `dist/entry.js` or
  `dist/entry.mjs`; it does not fetch a runtime version on each launch.
  (`openclaw.mjs:793-806`)
- The source's install guidance distinguishes pinned GitHub installs
  (`npm install -g github:openclaw/openclaw#<ref>`) from release installs
  (`npm install -g openclaw@latest`). (`openclaw.mjs:382-396`)
- Package-target checks build `openclaw@<target>` unless given an explicit spec
  and query npm for version, Node engines, and `openclaw.schemaVersions`.
  (`src/infra/update-check-package-target.ts:69-77`,
  `src/infra/update-check-package-target.ts:145-185`)
- Service installation prefers a stable package symlink path instead of a
  versioned package-manager realpath so package updates can retarget the
  symlink without leaving the service pointed at an obsolete version directory.
  (`src/daemon/program-args.ts:24-64`)

### Operations

- `openclaw gateway run` is the foreground service command; `gateway status`,
  `install`, `uninstall`, `start`, `stop`, and `restart` manage installed
  launchd/systemd/schtasks services. (`src/cli/gateway-cli/register.ts:560-585`,
  `src/cli/daemon-cli/register-service-commands.ts:65-155`)
- `openclaw gateway health` calls the gateway health RPC, while HTTP
  orchestrators should use the liveness/readiness endpoints above.
  (`src/cli/gateway-cli/register.ts:654-675`,
  `src/gateway/server-http.ts:140-145`)
- `openclaw doctor` supports read-only lint, interactive checks, `--repair` /
  `--fix`, non-interactive safe migrations, deep service scanning, and gateway
  token generation. (`src/cli/program/register.maintenance.ts:32-60`)
- Default durable paths relevant to deployment are the config/state root
  `~/.openclaw`, config `~/.openclaw/openclaw.json`, shared state DB
  `~/.openclaw/state/openclaw.sqlite`, default workspace
  `~/.openclaw/workspace`, and per-agent `openclaw-agent.sqlite`; all applicable
  relocation rules are cited above. (`src/config/paths.ts:60-72`,
  `src/config/paths.ts:154-168`, `src/state/openclaw-state-db.paths.ts:33-41`,
  `src/agents/workspace-default.ts:11-25`,
  `src/agents/auth-profiles/sqlite.ts:54-76`)

## VERDICT: HOLDS-WITH-CONDITIONS

Full-file ownership of `openclaw.json` can hold, but only as an explicitly
immutable declarative operating mode:

1. Run the service and every OpenClaw CLI/plugin process that can reach the file
   with `OPENCLAW_NIX_MODE=1`, or provide an equivalently enforced prohibition
   on the central mutation API. Nix mode is the source-provided mechanism that
   declares config externally managed and rejects every central write.
   (`src/config/paths.ts:10-18`, `src/config/nix-mode-write-guard.ts:19-43`,
   `src/config/io.write.ts:75-84`)
2. Render the complete, current, strictly validated schema, including declared
   auth metadata (`auth.profiles`/`auth.order`), channels, plugins, bindings,
   owner allowlists, and all other operator choices. Unknown keys are fatal, not
   preserved. (`src/config/zod-schema.ts:15-29`,
   `src/config/zod-schema.root-shape.ts:234-254`,
   `src/config/io.load.ts:107-135`)
3. Treat config-mutating OpenClaw workflows as unavailable in production:
   wizard/onboarding, `config set`, gateway config RPC, doctor repair,
   update-finalization doctor, plugin/channel lifecycle, first-owner bootstrap,
   and bundled extension/chat-command writes must instead change the Pulumi
   input and redeploy. (`src/config/nix-mode-write-guard.ts:19-43`,
   `src/gateway/server-methods/config-write-flow.ts:233-270`,
   `src/cli/update-cli/update-command-fresh-doctor.ts:93-125`)
4. Keep mutable state directories writable and persistent. Credentials belong
   in per-agent SQLite, and device/channel pairing state belongs in shared
   SQLite; those stores must not be regenerated with the config file.
   (`src/agents/auth-profiles/sqlite.ts:54-76`,
   `src/state/openclaw-state-schema.generated.ts:393-482`,
   `src/state/openclaw-state-schema.generated.ts:632-659`)
5. Provision auth outside config-mutating manual paste flows, or declaratively
   render the matching non-secret profile metadata after credential
   provisioning. Manual pasted auth otherwise writes both SQLite secrets and
   `auth.profiles` metadata. (`src/commands/models/auth.ts:700-724`,
   `src/commands/models/auth.ts:736-783`)
6. Pin the OpenClaw package version together with the renderer's schema and
   state/agent migration expectations; update runs can invoke doctor repair,
   and older binaries guard destructive actions using config write metadata.
   (`package.json:3-8`,
   `src/cli/update-cli/update-command-fresh-doctor.ts:93-125`,
   `src/config/future-version-guard.ts:52-76`)

The load-bearing favorable evidence is that credentials, pairing, device
identity/auth, and increasing amounts of operational state are already in
SQLite, while the generated owner-display secret is explicitly memory-only.
(`src/state/openclaw-agent-schema.generated.ts:393-403`,
`src/state/openclaw-state-schema.generated.ts:393-482`,
`src/config/io.owner-display-secret.ts:1-29`,
`src/infra/state-migrations.doctor.ts:621-691`)

The load-bearing adverse evidence is that normal operation exposes arbitrary
config mutation over CLI and gateway RPC, auth paste writes config metadata,
pairing can bootstrap a command owner, updates run repairing doctor, and bundled
extensions perform event/chat-command writebacks. (`src/cli/config-cli-runner.ts:450-470`,
`src/gateway/server-methods/config.ts:730-776`,
`src/commands/models/auth.ts:712-724`,
`src/pairing/command-owner.ts:14-40`,
`extensions/telegram/src/target-writeback.ts:176-193`)

There is no defensible finite count of “runtime-written keys”: `config set`,
gateway config RPC, and migration providers can target arbitrary schema-valid
paths. The bounded list is therefore the writer surfaces in section 3, not a
fixed key count. (`src/cli/config-cli-runner.ts:450-470`,
`src/gateway/server-methods/config.ts:730-818`,
`src/plugin-sdk/migration.ts:303-321`)

If immutable full-file ownership cannot be enforced, the minimal managed-subset
fallback should own only deployment invariants that OpenClaw is not expected to
mutate: gateway mode/bind/port and auth references, agent/workspace topology,
required model/provider declarations, fixed plugin/channel policy, and service
settings. It must preserve, rather than overwrite, at least these
OpenClaw-written subtrees: `meta`, `auth.profiles`, `auth.order`,
`commands.ownerAllowFrom`, user/CLI-managed `agents`/`bindings`/model choices,
channel account/writeback data, `plugins`/`hooks`, browser profiles/credentials,
and plugin-owned config. The writer inventory above demonstrates each mutable
family. (`src/config/io.write-safety.ts:191-197`,
`src/plugins/provider-auth-helpers.ts:151-239`,
`src/pairing/command-owner.ts:24-40`,
`src/commands/agents.commands.bind.ts:258-264`,
`src/cli/plugins-cli.runtime.ts:212-230`,
`extensions/browser/src/browser/config-mutations.ts:59-74`,
`extensions/slack/src/monitor/events/channels.ts:141-160`)
