# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-24

Outcome wanted: a professional, legal-focused OpenClaw agent running on the
workstation, deployed and configured through a TypeScript-native Pulumi +
Effect stack in this repo — then use what the greenfield build proves to
migrate dankserver's openclaw deployment layer off Ansible. 1Password stays
the secrets backbone (`op://` references only, never plaintext).

### dankserver today (verified by direct read of the machine-local `dankserver` checkout)

- Ansible is the control plane: 14 roles. The openclaw role is
  `ansible/roles/openclaw/tasks/main.yml` — 4790 lines, 252 named tasks.
- The role imperatively patches live `~/.openclaw/openclaw.json` via the
  OpenClaw CLI. This is the weakest seam and the thing a declarative
  Pulumi+Effect port should kill.
- Beyond config patching, ~100 tasks **binary-patch installed OpenClaw
  bundles**: Control UI service worker cache policy, xAI video/image provider
  behavior, gateway WebSocket payload caps, media-root allowlists. Most
  imperative, release-coupled part of the role (every OpenClaw update risks
  breaking them).
- Other duties: version-pinned npm launcher install/update (release
  `2026.7.1-2`), managed plugin lifecycle (local Venice media plugin is
  built+packed on the controller and shipped over), managed CLIs (QMD, Notion,
  Grok for PR review), agent auth-profile seeding (Discord chat agent, Codex
  CLI agent), voice configuration via a templated Python helper
  (`openclaw-configure-voice`), systemd `--user` drop-ins.
- Config heart: `ansible/group_vars/all.yml` (~883 lines, flat `openclaw_*`
  namespace) — maps cleanly onto a typed Effect config schema.
- Secrets already 1Password-native: central `op://` ref map, `op run` systemd
  drop-in wrapper (`openclaw-1password-op-run.conf.j2`), service-account token
  on the host. Port the pattern, don't reinvent it.
- Runtime: OpenClaw as systemd `--user` gateway via npm launcher; Discord /
  Telegram / voice channels (voice = cloudflared tunnel + Twilio + xAI
  streaming + ElevenLabs); Docker only for agent sandbox + monitoring compose;
  SSH over Tailscale.
- Terraform there (`infra/`) is bootstrap-only (GitHub / Tailscale / 1Password
  / PR-reviewer webhook), local state. Small, low-risk Pulumi port target —
  separate from this packet's scope.

### This repo already has the stack — extension, not creation

- Top-level `infra/` (`@beep/infra`) is the Effect-native Pulumi workspace:
  schema-decoded stack config, typed errors, stacks for
  AIMetrics/OipWeb/Storybook/Vercel. `infra/src/AIMetrics.ts` is the style
  oracle: `S.Class` Pulumi config decode (`internal/PulumiConfigSchema.ts`
  `optionalPulumiConfigFields` + `withPulumiConfigDecodeEffect`), `*SecretRef`
  op:// strings resolved at deploy, tagged-union deploy target
  (`AiMetricsDeployTarget`: local | dankserver), preflight→apply→health
  `command.remote.Command` chain over Tailscale SSH with agent socket,
  stdout captured as `pulumi.secret`.
- Pulumi projects are per-surface dirs (`infra/` root project +
  `infra/oip-web`, `infra/storybook`) sharing `infra/src/`; state is local
  file backend with passphrase encryption
  (`Pulumi.beep-ai-metrics-dankserver.yaml` carries its encryptionsalt;
  `PULUMI_CONFIG_PASSPHRASE` resolved from 1Password at run time).
- Doctrine (`standards/architecture/07-non-slice-families.md`): external
  SDK/service wrappers belong in `packages/drivers/<name>` (flat family) →
  `packages/drivers/openclaw` = `@beep/openclaw`. Canonical driver role files:
  `*.service.ts`, `*.errors.ts`, `*.models.ts`, `*.config.ts`, `*.layer.ts`,
  optional `*.browser.ts` / `*.test-layer.ts`. Style models:
  `packages/drivers/onepassword-cli` (ChildProcessSpawner-based CLI wrapper,
  `probeReference`/`read` returning `Redacted`, `whoami`) and
  `packages/drivers/tailscale`.
- OpenClaw already known here: ai-metrics transcript-ingestion source; planned
  adapter in `goals/agentic-professional-runtime`
  `docs/sdk-context-packet-contract.md` (OpenClaw = thin adapter over the
  runtime SDK, must not own runtime truth or bypass approval policy);
  `.gitleaks.toml` pre-allowlists a not-yet-existing `.repos/openclaw/`
  vendored subtree.

### OpenClaw source access

- Upstream clone already on disk (machine-local `openclaw` clone) — version
  `2026.7.2`, commit `663c4fba10536a7148749f2b35fb5af6d54d3cb7`
  (origin `github.com/openclaw/openclaw`). Has `src/config/` and rich
  provider/model config modules (`src/agents/models-config.*`) — the
  source-dive target for the config-ownership research question.
- Version skew to note: dankserver pins `2026.7.1-2`; clone is `2026.7.2`.
- Upstream docs: https://docs.openclaw.ai/llms.txt

### Workstation target

- CachyOS, dual R9700, ROCm; local GGUF lineup served via llama-server (real
  local-model capacity, already running — its lifecycle is out of scope for
  this packet). Specs doc (local):
  `AI_WORKSTATION_SPECS.md`, in the machine-local workstation docs outside this repo.

### Framing

- Enabling substrate for the agentic-professional-runtime direction —
  dogfooding ground and ops learning — firewalled from product work itself.
- Repo is public: packet stays technical; legal-practice strategy, firm or
  client specifics, and sensitive lab details stay out (or in gitignored
  `docs/_internal/`).
- Research convention: valuable repos (especially Effect-involved ones) get
  cloned into the machine-local dev-clones directory and cited with pinned SHA + upstream URL in
  `research/SOURCES.md`.
