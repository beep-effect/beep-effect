# grok-bot host: provisioning and link receipt (2026-11-07/08)

Decision: [`grok-bot-vm-in-scope`](../decisions/2026-11-08-grok-bot-vm-in-scope.md).
Runbook section: `docs/runbooks/t3code-fleet.md`, "grok-bot host". Private values
(tailnet name, environment id, recovery password location) stay in the operator's
state and the orchestrator handoff.

## Host facts (probed over Tailscale SSH)

| Fact | Value |
| --- | --- |
| Platform | Cursor-hosted Firecracker microVM for the Grok Bot computer; Debian 13 (trixie), kernel 6.12, x86_64 |
| Resources | 8 vCPU, 15 GiB RAM, one 128 GB ext4 volume (46 GB used by earlier Bot work under `/workspace`), no cgroup limits on the `agent` group |
| Init | `tini` + Cursor `pod-daemon`; **no systemd, no cron**; Xvfb `:1` + x11vnc/noVNC desktop supervised by Cursor |
| Network | tailnet via DERP only (no direct path); egress through a Cursor proxy that refuses `deb.debian.org` pool downloads; Anthropic, OpenAI, 1Password, GitHub, x.ai and the hub mirror reachable |
| Sleep | the host hibernates the VM minutes after the Grok Bot app's computer view closes (observed twice: 03:50Z, 04:17Z); uptime continues, the node goes Offline |
| Durability | Grok Bot docs: `/workspace` and logins durable, installed packages not; the Oct 9 node `grok-bot-box-1` vanished at the Nov 5 rebuild |

## Steps and proof

1. Access: operator enabled Tailscale SSH on the box (`tailscale set --ssh`); login as `box` succeeded from
   DankStation with no key; `ssh-grok-bot` wrapper created (`--admin` forwards the dedicated YubiKey agent;
   `-F /dev/null -o IdentityAgent=<sock>` is required or the workstation's default agent wins).
2. Sudo: replaced the image's `box ALL=(ALL:ALL) NOPASSWD:ALL` with `pam_rssh` 1.2.2-1 (upstream
   `debian-trixie-amd64` asset, SHA-256 verified), root-owned `/etc/security/authorized_keys/box`
   (primary + backup keys), `Defaults:box env_keep += "SSH_AUTH_SOCK"`, `box ALL=(ALL:ALL) ALL`, and an account
   password as the documented fallback (generated on DankStation, never printed). `sudo -k; sudo -v` over the
   forwarded agent asked for a touch and passed; `sudo -n true` without the agent now fails. Backups under
   `/root/yubikey-sudo-backup-*`. Friction: the first dead-man rollback (`sh -c 'sleep 900; restore'`) fired
   when its `sleep` was killed before the shell; the PAM line was re-applied with the fallback password.
3. CLIs (user level, re-runnable): Claude Code 2.1.319 (native installer; operator authenticated it from the
   box), Codex 0.167.0 (`NPM_CONFIG_PREFIX=$HOME/.local npm i -g @openai/codex`; the image's global npm prefix
   is root-owned), cursor-agent 2026.11.05, Grok 1.0.77 (`x.ai/cli/install.sh`), Muse launcher (copy of the
   workstation script), 1Password agent shim + read-only service-account credential (`op vault list` passed
   with output suppressed) on top of `1password-cli` 2.42.0 from the vendor apt repo. Pre-existing: node
   24.22.1, bun 1.4.2, gh 2.103 (its stored token is invalid; GitHub login is operator follow-up), Chrome 156.
4. Desktop apps: Claude Desktop 4.23118.0 from Anthropic's apt repo (signing key fingerprint
   `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE` checked) and ChatGPT desktop 26.1103 from OpenAI's `.deb`
   (installer registered `chatgpt.sources`). Their Debian dependencies (124 + 12 packages) could not be fetched
   on the box; they were listed with `apt-get install --print-uris`, fetched on DankStation and pushed over the
   tailnet. Sign-in on the virtual display is the operator's step; Linux builds have no Computer Use.
5. T3: `t3 pair`-free install of the fork build `0.1.7-fork.20261107.2127` from the hub archive (pushed over
   SSH and served from loopback, because the HTTPS mirror download through DERP kept resetting), mirror pinned in
   `~/.t3/service.env`, Labs flag set, `/workspace/bootstrap/{ensure-services,boot,t3-pull,keepalive}.sh`
   installed; DankStation `grok-bot-ensure.timer` (5 min) reconciles while the node is online.
6. Link and pairing: below.

## Link receipt

| Check | Result |
| --- | --- |
| Fork version on the box | `t3 v0.1.7-fork.20261107.2127` (same as the hub's `latest.json`) |
| Loopback server | `http://127.0.0.1:3773/` 200 after `ensure-services.sh` |
| Tailnet HTTPS | hub `curl` of the box's `.ts.net` name: 200 (tailnet-only Serve, no Funnel) |
| Agent-plane link | `t3 environment link <box .ts.net> --pairing-code … --access auto` from the hub: linked, renew by 2026-12-08; `t3_environment_links` lists it `reachable` |
| Project on the box | `t3 project add /workspace/beep-effect` (the Bot's earlier clone, at 2026-09-22 `28999867f2`; nine `.mcp.json` servers pre-disabled in the box's Claude user config so headless turns do not stall) |
| Receipt turn | `delegate_task` to the box, Claude Opus 5.5 medium, read-only: returned kernel, 8 cores, the checkout commit and the paths of `claude`, `codex`, `grok`, `t3`, `op` |
| Desktop pairing | `t3 pair --label dankstation-desktop` minted; `t3code://pair?…` handed to the T3 desktop app with the `.ts.net` https address (operator confirms the Add environment dialog) |
| Hub reconcile | `grok-bot-ensure.timer` (5 min) enabled on DankStation; skips while the node is asleep and notifies on each transition |

Environment and project ids are in the private handoff, not here.
