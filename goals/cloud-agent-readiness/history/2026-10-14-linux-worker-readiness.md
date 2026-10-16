# Linux worker setup checkpoint — 2026-10-14

## Scope and provenance

The operator expanded cloud-agent-readiness to managed Linux development and
agent readiness, authorized reusing the workstation 1Password service account,
and requested Grok, Muse, CLIProxyAPI and broad development/cloud CLI parity.
The display title changed; packet id/path and original cloud history remain.
CLI/agent/headless parity is the baseline. Subsequent explicit additions are
Chrome (default browser), 1Password Desktop, the workstation's ChatGPT/Codex
desktop application and T3 Code. Human browser/account setup follows installation.

## Completed steps and proof

1. Confirmed installed Ubuntu 26.04.1 on beep-worker's Inland SSD. Its ext4 root
   already occupies the drive; there is no LVM expansion to perform. Existing
   Windows storage was preserved. Legacy BIOS GRUB boots; default firmware boot
   priority remains a separate physical-console verification.
2. Established bootstrap SSH without printing or saving the account password.
   Installed the existing YubiKey ED25519-SK public key; fresh key auth passed.
3. Inspected dankserver's actual PAM configuration: it uses **libpam_rssh.so**,
   not the older pam_ssh_agent_auth module in its historical recipe. The latter
   rejected the FIDO key. Deployed the same trusted module with saved PAM config,
   root-owned permitted key file and preserved SSH_AUTH_SOCK. `sudo -k; sudo -v;
   sudo -n id -u` requested a YubiKey touch and returned `0`.
4. Enrolled Tailscale and verified its Running state and fresh FIDO SSH over the
   tailnet. Disabled root/password/keyboard-interactive SSH; required publickey
   and touch; removed the bootstrap LAN firewall rule. UFW permits SSH through
   tailscale0, and fail2ban's systemd-backed SSH jail is active. Security updates
   do not force reboot; AC inactivity suspend is disabled.
5. Installed the canonical 1Password PATH shim and helper scripts. Transferred
   the explicitly authorized service account directly over SSH to mode-0600
   storage. `op vault list` succeeded with output suppressed; identity reports
   SERVICE_ACCOUNT. No credential values enter this packet.
6. Installed development tools from vendor or distro sources. Bun archive
   matched the repository's pinned SHA256. Configured shell startup so fresh
   noninteractive SSH resolves the intended tools.
7. Configured rootless Docker, enabled its lingering user service and disabled
   root Docker/containerd services. A disposable hello-world image ran; a
   disposable nginx Compose service answered HTTP on loopback, then was removed.
8. Authenticated GitHub CLI and configured its HTTPS Git credential helper.
   Authenticated native Codex, Claude Code, Cursor Agent, Grok and Muse. Muse
   verified Model API access; Grok's model-catalog query succeeded.
9. Installed checksum-verified CLIProxyAPI release, a loopback user service,
   protected client key/config, and separately authenticated Claude, Codex,
   xAI and Meta providers. Its authenticated catalog contains 62 models and the
   expected native/proxy aliases. Installed claudex, claudeg, claudep and claudem.
10. Cloned a clean checkout, ran `bun install --frozen-lockfile` (2,647 packages),
    `bun run beep --help`, and `bun run beep quality package-verify @beep/types
    --quick`: lint and typecheck passed. The checkout remained clean.

## Verified tool versions

| Tool | Worker version |
| --- | --- |
| Node / nvm | 24.21.0 / 0.40.8 |
| Bun | 1.4.2 (repository pin) |
| Python / uv | 3.14.8 / 0.12.23 |
| Rust / Cargo | 1.99.0 / 1.99.0 |
| Docker / Compose / Buildx | 29.9.0 / 5.6.0 / 0.38.0 |
| 1Password CLI | 2.41.0 |
| Codex / Claude Code | 0.162.1 / 2.1.299 |
| Cursor Agent | 2026.10.14-0f9edde |
| Grok / Muse | 1.0.57 / 1.4.7-R6101.1 |
| CLIProxyAPI | 8.0.27 |
| mise / pnpm / portless | 2026.10.8 / 12.11.2 / 0.15.8 |
| Pulumi / Terraform | 3.267.0 / 1.15.9 |
| AWS CLI / aws-vault | 2.37.9 / 7.16.2 |
| Ansible core / rclone / direnv | 2.21.5 / 1.75.2 / 2.37.1 |

## Remaining work and claim boundaries

- Install/verify Azure, Vercel, Wrangler/cloudflared and explicit desktop additions;
  complete their actual authentication and workflows separately from installation.
- Perform the broader workstation scan and identify portable config versus
  desktop/host-specific paths and services. Original cloud phases remain pending.
- Proxy has one authenticated account per provider. Workstation inventory had
  five Codex, four Claude, one xAI and one Meta account; account-pool parity is
  not established. No paid inference has been used as a substitute for proof.
- AWS/Pulumi tools are installed; credential-route and actual service-operation
  verification remain separate. No infrastructure deployment has been performed.
- Launch bounded headless sessions after baseline setup, instruct them to record
  command evidence and friction, then convert findings into goal additions.
  Tests receive no forwarded administrator agent and cannot modify cloud or
  staking resources, install packages, or access credential stores.
- Neither dankserver nor the staking host is newly provisioned by this checkpoint.
  Any tbk-ubuntu development worker requires isolated compute/storage boundaries.

## Recovery

PAM and SSH originals are saved on the worker under the security-bootstrap backup
directory. Recovery sessions stayed live while changes were verified. Revoke
worker service-account access by removing its credential or rotating the shared
account. Disable the user Docker/proxy services to reverse their runtime setup.

## Desktop and cloud CLI follow-up

Installed Google Chrome 155.0.8059.79, 1Password Desktop 8.12.40,
ChatGPT Desktop 26.1007.71326 from OpenAI's official Ubuntu package, and T3 Code
0.0.45 from its upstream amd64 release (published SHA256 verified). Google and
desktop sign-in/Chrome extensions are operator-owned follow-up. The Linux app
is the official preview; Linux native Computer Use remains unsupported per its
vendor documentation. Browser integration has a separate Chrome extension.

Installed Azure CLI 2.90.0, Vercel CLI 62.7.0, Wrangler 4.151.0 and cloudflared
2026.10.0. Version commands pass; cloud account authentication is still separate.
Follow-up: [cloud CLI authentication](2026-10-14-cloud-cli-authentication.md)
records completed Azure, Vercel and Wrangler device logins and read-only account
checks. This does not authenticate cloudflared tunnels or prove deployment rights.
Npm initially skipped esbuild/workerd install scripts. Reinstalled with a scoped
allowScripts choice for those required packages rather than enabling every script.

## Human desktop acceptance

The operator confirmed ChatGPT Desktop remote pairing, Google accounts in Chrome,
1Password Desktop and Claude in Chrome are authenticated. Chrome's default-browser
setting was verified by xdg-settings; Chrome and 1Password launched successfully.
This is human-provided desktop acceptance, distinct from CLI/proxy proof.

The Configuration UI showed an ignored session flag and a retired Guardian
thread-context setting. Both user/project TOML configurations on the worker
contain no matching stale key. A fresh bundled app-server config/read returned
no warnings. Vendor application code still emits code_mode_tool_description_first,
which neither installed Codex runtime lists as supported. The signed stable feed
matches the installed desktop version. The operator refreshed Settings → Configuration and confirmed both banners
disappeared. This closes the UI warning report without modifying the signed app.

AWS identity through the canonical op-run reference file succeeded with output
suppressed. The first Pulumi check targeted the hosted service and failed because
the workstation actually uses an S3 DIY backend. Backend-specific authentication
is still being reconciled; no infrastructure was deployed.
Follow-up: [Pulumi backend qualification](2026-10-14-pulumi-backend-qualification.md)
closes read-only backend access: selected the existing S3 backend through the
approved AWS environment and successfully listed four stacks. Deployment and
stack-secret decryption remain outside this proof.


## T3 remote backend — 2026-10-14

Installed the official T3 CLI 0.0.45 to match the desktop release. Installed and
started its user systemd service (`t3code.service`); verified enabled, active,
and user lingering enabled. The server listens on loopback port 3773.

Granted elpresidank Tailscale operator access and published only through
Tailscale Serve HTTPS: `https://beep-worker.tailc7c348.ts.net` proxies loopback
3773. Serve reports tailnet-only; no Funnel or LAN firewall port was opened.
The public environment descriptor responds successfully with label beep-worker
and server version 0.0.45. Service installation was requested without a forwarded admin SSH agent;
inspection found the user manager retained an older SSH_AUTH_SOCK. Added a
user-service drop-in with UnsetEnvironment=SSH_AUTH_SOCK and an explicit approved
development PATH, restarted before any agent turn, and verified the live main
process has the tool PATH and no SSH agent socket. Privileged Tailscale
administration used the existing YubiKey route.

A 15-minute one-time pairing link was generated into a mode-0600 private file
and passed to DankStation's clipboard without printing its credential. Native
T3 saved connections use encrypted Electron storage, so desktop acceptance is
through Settings → Connections → Add environment. The operator saved beep-worker in DankStation’s native T3 client; the server
recorded a bearer-access-token session with Electron client metadata. Initial
connection was blocked by protocol mismatch; see nightly correction below.
The operator's reference clone at `~/YeeBois/references/effect/t3code` was used
to verify service, pairing and encrypted catalog behavior. No reference-source
changes were made. Added the existing beep-effect checkout as a T3 project using
`t3 project add`; no T3 agent turn or staking-host development service launched.

Rollback: `t3 service uninstall` removes startup while retaining user data;
`tailscale serve --https=443 off` removes this mapping. Revoke the client session
in T3 Connections when removing a paired client. Never commit pairing links,
session tokens or encrypted client catalogs into this goal.


### T3 nightly channel and pairing qualification

The operator clarified that DankStation uses a nightly/source build. Both
installations initially displayed 0.0.45, but DankStation's running descriptor
reported orchestration protocol 2 and the stable worker release reported 1.
The desktop Update action failed because it required a newer semantic version.
Version-label equality alone was insufficient compatibility proof.

Ran `t3 update --channel nightly --yes` on beep-worker. The upstream updater
verified the download and installed 0.0.46-nightly.20261014.3093. The live tailnet
descriptor now reports protocol 2 with the same environment id. The existing
native Electron bearer session subsequently recorded a successful connection;
no repeat pairing was needed. Repaired service registration with `t3 service
install` after the release switch; preserved the explicit tool PATH and removed
SSH agent inheritance. The prior official stable runtime remains for rollback.

Pairing friction: an initial one-time code had been redeemed into a browser
cookie session before native Add environment, so reuse returned invalid credential.
A fresh code pasted directly into Host succeeded. All credentials were excluded
from this receipt. A browser session is not proof of a saved native environment;
qualification combines the operator's saved-environment screenshot and the
native Electron session's successful connection after protocol alignment.


Also upgraded beep-worker's desktop package to the matching nightly release,
0.0.46~nightly.20261014.3093. The downloaded Debian artifact matched GitHub's
published asset SHA256 8cc2602ba5272de2b1508299c59a26535726bf59d063b63fa7eb8666e9b44e3b.
Installation used remote YubiKey sudo and selected `/opt/T3 Code (Nightly)/t3code`.
Desktop launch/sign-in remains separate from the already-proven remote backend.
