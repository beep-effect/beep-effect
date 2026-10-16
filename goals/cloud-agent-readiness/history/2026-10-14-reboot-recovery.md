# Reboot recovery qualification — 2026-10-14

Status: **boot/access and core services recovered after firmware correction;
repeat machine boot and guarded proxy recovery pass; GitHub headless credential retrieval repaired**.
The operator selected reboot recovery after the proxy route receipt. The
worker readiness checkout was at
`6d6cec22b5164ef9830b5171e7c7ad580b098d96` before reboot.

## Preflight and authorized reboot

- No systemd user jobs or active detached proof services were running.
- Docker, T3 and CLIProxyAPI user services were active and enabled.
- Tailscale, SSH service/socket, UFW and fail2ban were enabled.
- User lingering was enabled and the desktop seat reported idle.
- The remaining SSH-launched Claude process was identified by exact argv
  membership as an old `auth login --claudeai` process, not a development run.
- Recorded the old boot id `628bce3b-4dde-44be-a7dc-5d604f9efd89`, source,
  manifest hash and hashes of the eight existing repository changes in private
  worker `~/.cache/beep/readiness/reboot/preflight.json`.
- Used the existing ssh-beep-worker-yubi admin wrapper and a real PTY. Remote
  sudo requested a YubiKey touch; `sudo -v && sudo -n systemctl reboot`
  completed with the SSH command exiting zero and its connection closing.
  No password substitute or permission weakening was used.

## Current observation

The pre-reboot SSH control socket disappeared. Repeated bounded port/banner
probes have not found SSH at tailnet `100.91.48.48` or last LAN `192.168.1.8`.
Local Tailscale status reports the peer offline. These facts do not identify
whether firmware selected another disk, boot is stalled, Ubuntu networking is
unavailable, or the LAN address changed. Firmware boot priority was not
previously qualified; that is a candidate to inspect, not a confirmed cause.

Requested the monitor state through the structured operator prompt. No fresh
SSH authentication was launched against an unavailable service, and no
authentication wait remains pending. No disk, firmware, bootloader or network
configuration was changed in response to this uncertainty.

## Required completion

Use the physical-console observation to diagnose boot/access, then establish
fresh key-authenticated SSH. Verify a new boot id, preserved source/manifest/
existing-file hashes, Tailscale, user lingering, Docker, T3 and CLIProxyAPI,
runtime versions and ordinary model checking. Verify security service health
through the appropriate authorized privilege route. Enabled-before-reboot
does not establish automatic post-boot recovery.

The local receipt cannot yet be synchronized to the offline worker. Its last
synchronized readiness source remains 6d6cec22b5. Do not close reboot acceptance
or fleet readiness based on the successful reboot command alone.

## Firmware correction and post-boot follow-up

The operator confirmed the first reboot entered Windows. Ubuntu's Inland SSD
had been placed first in Hard Drive BBS Priorities, but the separate main Boot
Option Priorities still selected Windows Boot Manager first. The earlier
assistant approval of the submenu screenshot was mistaken. The operator then
set the main Boot Option #1 to P3: Inland SATA SSD, saved and booted Ubuntu.
Windows remains on the separate Toshiba drive; the original installer erased
only the selected Inland SSD. No drive was erased during recovery.

Fresh YubiKey SSH succeeded on the second attempt after the first missed touch.
The new boot id is `3f6b96f1-c326-4f3d-87d4-bec52b1f3acd`, different from the
preflight id. Ubuntu confirms Legacy boot. Source remains 6d6cec22b5, all eight
existing-file hashes match preflight, and the installed manifest is unchanged.

Tailscale is Running; SSH service/socket, UFW, fail2ban, rootless Docker, T3 and
CLIProxyAPI are active. User lingering remains enabled. Docker info exits zero,
T3 tailnet HTTPS returns 200, runtime versions match and ordinary model checking
exits zero with zero findings across 360 models. GitHub authentication and the
1Password service-account vault-list probe pass with output suppressed.

The YubiKey admin route also passes post-boot sudo authentication. UFW permits
SSH only through tailscale0 (IPv4 and IPv6), the fail2ban sshd jail is active,
and effective sshd policy retains root/password/keyboard-interactive login
disabled with publickey authentication required. A post-boot GPT-6.1-Sol medium
proxy inference returns HTTP 200, answer 4 and zero tool calls.

One recovery gap remains: the proxy catalog has 58 entries rather than the
prior 62, and muse-wonder-1.0 is absent. Its inference request returns HTTP 400,
model_not_found / unknown provider. The existing Meta OAuth record remains
present, mode 0600, enabled, with credential fields populated; no values were
printed. The proxy loads four auth records at startup. Startup logs show DNS
failures and failed model-catalog refreshes at boot. This supports a startup
network/catalog timing hypothesis but does not yet prove the precise cause.
The proxy has not been restarted or reconfigured in this follow-up.

Private post-boot evidence is saved under ~/.cache/beep/readiness/reboot/.
Core service/access recovery passes for this observed boot after the firmware
correction; automatic Muse proxy registration remains unqualified. No second
OS-driven reboot after the BIOS correction has been performed.

## Muse recovery and bounded startup guards after workstation reboot

On resuming after DankStation reboot, fresh canonical YubiKey SSH reached the
same worker boot id 3f6b96f1-c326-4f3d-87d4-bec52b1f3acd. The worker proxy was
still active with 58 models and no Wonder route. No proxy TCP connections were
established. Restarting only the user proxy restored 62 models, including all
four Wonder variants, using the existing four auth records. Auth/configuration
values were not printed or changed. A bounded Muse Wonder medium arithmetic
inference returned HTTP 200, model muse-wonder-1.0, answer 4, zero tool calls,
in 3.43 seconds. Private receipt: worker
~/.cache/beep/readiness/reboot/muse-warm-restart.json.

Source inspection at installed commit bf934162 establishes an immediate
catalog fetch followed by a three-hour refresh interval; failed fetches retain
the previous catalog. Together with boot DNS failures and the warm restart,
this supports the startup network/catalog race diagnosis. Sources:
https://github.com/router-for-me/CLIProxyAPI/blob/bf934162/internal/registry/catalog_sources.go
and
https://github.com/router-for-me/CLIProxyAPI/blob/bf934162/internal/registry/model_updater.go.

Installed the tracked ops/cli-proxy-startup-check.py at
~/.local/lib/beep/cli-proxy-startup-check.py and ops/cli-proxy-startup.conf at
~/.config/systemd/user/cli-proxy-api.service.d/startup.conf. ExecStartPre checks
both official catalog sources and requires Wonder in the Meta catalog.
ExecStartPost checks authenticated local model discovery for GPT-6.1-Sol,
Grok 4.7, Claude Fable 5.1 and Muse Wonder 1.0. Neither check runs inference or
refreshes credentials. Each check retries for a 45-second window with bounded
HTTP timeouts; systemd TimeoutStartSec=120 provides the outer bound. Existing
Restart=on-failure and RestartSec=5 retry failed startup. An unavailable remote
catalog deliberately holds the service unavailable rather than accepting an
incomplete startup as ready. Existing config, credentials and binary unchanged.

Validation: Python compilation, simulated offline source and finite failure
path checks pass. Live network and registered checks pass. After daemon-reload
and a guarded restart, both ExecStartPre and ExecStartPost exit zero; service
ActiveState=active, SubState=running, Result=success. The checks are startup
checks, not ongoing provider health monitors. Rollback removes the startup.conf
drop-in, daemon-reloads and restarts the service; the unused helper may then be
removed. No full worker reboot was performed in this continuation. Repeat boot
acceptance remains open to qualify the corrected firmware priority and guarded
service startup together. The worker's eight pre-existing edits remain intact.

## Repeat machine reboot qualification

The operator selected a repeat beep-worker reboot. Preflight found no active
user-systemd jobs, detached proof services, headless agent runs or proxy TCP
connections. Recorded source 2137396c2667b5dcfb1c5ed21e6fe4f383b71a30,
eight existing-edit hashes and manifest/startup-guard hashes in private worker
~/.cache/beep/readiness/reboot/repeat-preflight.json. Reboot used the canonical
YubiKey SSH admin wrapper and touch-authenticated sudo; the command exited
zero and closed SSH.

Ubuntu returned without physical boot selection or service intervention.
Fresh YubiKey SSH passes. Boot id changed from
3f6b96f1-c326-4f3d-87d4-bec52b1f3acd to
e1bae645-1ac1-488b-b73d-78fc2c3681ee. Source, all eight edits, manifest and
startup checks match preflight. Linger=yes; Tailscale, SSH, UFW and fail2ban
are active; user Docker, T3 and CLIProxyAPI are active. T3 tailnet HTTPS is
200. The proxy network precheck ran 13:29:18–13:29:22 CDT and registration
postcheck ran 13:29:22–13:29:24, both exit zero, Result=success. Catalog has
62 models with all four configured routes present. No warm restart was needed.

Post-boot medium inference returns HTTP 200, answer 4, zero tool calls for
GPT-6.1-Sol (2.58 seconds) and Muse Wonder 1.0 (2.78 seconds). Ordinary model
checking has zero findings across 360 models and zero catalog diff. Docker info
passes, with the previously observed unsupported cpuset/io controller warnings.
The 1Password service-account vault-list probe passes with output suppressed.
Private receipts: repeat-postboot.json and repeat-inference.json alongside the
preflight receipt. This completes observed boot selection and proxy startup
recovery acceptance, not every provider's inference or full fleet readiness.

A separate credential recovery gap appeared: gh auth status exits 1 and reports
the active kriegcloud saved token in default invalid. Authenticated user lookup
also exits 1. Public repository lookup exits zero and is not authentication
proof. The prior pre-reboot GitHub receipt remains historical. No raw token was
printed, no credential was deleted, and no new login was started. Investigate
credential storage/retrieval and validate authenticated GitHub access before
closing unattended developer authentication across reboot.

## GitHub gap resolved

The follow-up [GitHub credential recovery receipt](2026-10-14-github-credential-recovery.md)
confirms the login keyring was locked, not a revoked token. Existing-token
migration to mode-0600 CLI file storage passes authenticated SSH and detached
user-systemd checks with Secret Service inaccessible. That storage tradeoff and
limits are recorded separately; no third full machine reboot was performed.
