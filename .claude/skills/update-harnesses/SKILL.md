---
name: update-harnesses
description: >
  Update every agent harness on every fleet host: T3 Code, Codex, Claude Code,
  Grok Build, Kimi Code, Junie, Cursor Agent and Muse on DankStation,
  beep-worker, dankserver, tbk-worker, tom-pc-1-wsl and the grok-bot VM, plus the desktop
  apps (ChatGPT and Claude Desktop on DankStation and grok-bot; Cursor and Kimi
  Desktop on DankStation). Use on `/update-harnesses`, when a harness is out of
  date somewhere, or to audit which versions and install methods each host runs.
compatibility: DankStation hub with Python 3, the canonical fleet SSH wrappers and yubi-sudo on its PATH; hosts need bash 4+ and coreutils.
metadata:
  status: active
---

# Update harnesses

One script does the work. It finds every install of each harness on each host,
updates it with the method that owns it, and reports before and after
versions. You choose the scope, announce the YubiKey touches and act on the
summary.

```sh
s=.claude/skills/update-harnesses/scripts/update_harnesses.py
python3 $s plan                  # host x harness matrix, connects nowhere
python3 $s status                # read-only: versions, methods, pending, drift
python3 $s update                # everything, everywhere
python3 $s update --host dankserver --harness codex --harness junie
```

`--host` and `--harness` repeat and accept aliases (`chatgpt`, `cursor`,
`claude-code`, `grok-bot-vm`, `tom-pc-1`, `hub`...). Each run writes a JSON receipt and a
full log under `~/.local/state/beep/update-harnesses/`.

## 1. Before an update

1. Run `status` first unless the operator asked for a blind update. It shows
   each install's version, method and standing (active, shadowed, root-owned,
   stale). It marks rows `current` or `pending` where it can see upstream:
   Claude Code and Codex (npm `latest`), T3 Code (the build the hub last
   published), and the hub's desktop apps (pacman and the Kimi feed). Every other
   row reads `installed`. That covers the other CLIs, whose self-updaters decide
   during `update`, and grok-bot's ChatGPT and Claude Desktop, whose apt
   candidates are only known after the root `apt-get update` that `update` runs.
2. grok-bot sleeps. If its rows come back `unreachable`, ask the operator to
   open the Grok Bot app's computer view, then rerun with `--host grok-bot`.
   tom-pc-1-wsl is a WSL distro on an in-use Windows PC: it is reachable only
   while the PC is on and its Windows user is signed in, because the `T3AgentWSL`
   logon task is what keeps the distro running. If its rows come back
   `unreachable` after a good touch, ask the operator to check the PC, then rerun
   with `--host tom-pc-1`.
3. Announce the touches before starting. Expect one YubiKey touch per SSH host
   (beep-worker, dankserver, tbk-worker, tom-pc-1-wsl), again only if its 2-hour
   master expired during the hub's T3 build. With `--system-upgrade`, add one for
   the hub's `pacman -Syu`. Each admin step takes two, one for its SSH login and
   one for sudo: a Cursor sandbox repin on a host with the pinned AppArmor profile
   (beep-worker today), and grok-bot apt (twice more if Debian pool files have to
   be pushed). Only the main thread authenticates, one touch
   at a time, retrying a missed touch up to three times; worker threads reuse
   the open masters and never start a login.
4. Updating `t3code` restarts the T3 server on any worker whose version
   changes, which ends the turns running there. The 30-minute pull timer would
   do the same; check with the orchestrator before forcing it mid-merge-wave,
   or leave it out with explicit `--harness` flags.

5. Hub desktop packages (ChatGPT, Claude, Cursor) update only through a full
   `pacman -Syu`, because Arch supports no partial upgrades. Without
   `--system-upgrade` they stay `pending`. Pass the flag when the operator
   agrees to a whole-system upgrade.

Run `update` in the foreground with a long timeout (about 100 minutes when
`t3code` is in scope: the hub's fork sync can build for up to 90).

## 2. What it does

| Harness | Hub (DankStation) | Workers / grok-bot |
| --- | --- | --- |
| t3code | `t3code-source-update.service`: fork sync, build, publish | after the hub: `t3code-fork-pull.service` (grok-bot: `ensure-services.sh`) |
| claude, codex, grok, kimi, junie, cursor-agent, muse | per install: native self-updater, `npm i -g <pkg>@latest` in the owning prefix, or `bun add -g` | same |
| chatgpt / claude / cursor desktop | `pacman -Syu`, only with `--system-upgrade` | grok-bot: apt `--only-upgrade` over the admin route; Debian pool files fetched on the hub, hash-checked and pushed |
| kimi desktop | AppImage from the vendor's electron feed, sha512-checked, previous kept as `.prev` | — |

Per-harness mechanics, install-method detection and the reasons behind each rule
are in [references/harnesses.md](references/harnesses.md). Read it before
changing a method or adding a host.

## 3. Read the summary

| Status | Meaning | Your move |
| --- | --- | --- |
| `updated` / `current` | done | nothing |
| `installed` / `absent` | status only: no upstream check for this row / not installed on that host | nothing; `absent` is never auto-installed |
| `skipped` | not writable, unknown method, stale node version, or migration declined | read the note; root-owned copies need the host's admin route, not this account |
| `failed` | updater or auth failed | read the log; rerun that host/harness once the cause is fixed. Never rerun an uncertain privileged step blindly |
| `unreachable` | SSH master did not open | missed touch, asleep (grok-bot), or the PC off or signed out (tom-pc-1-wsl) |
| `pending` | a newer version exists: status rows behind upstream (see step 1), hub desktop apps left without `--system-upgrade`, or a T3 pull still running | run `update`, with the flag if needed |

Also:

- A `cursor-sandbox` row on beep-worker means the AppArmor profile was
  repinned to the current Cursor CLI and T3 SDK helpers. Restart T3 there once
  idle if Cursor turns still fail preflight.
- Junie on the workers moves from the frozen npm package (1468.x) to the managed
  launcher the first time, only when the account's `.local/bin/junie` entry is the active one.
  The previous entry is kept under `~/.local/state/beep/update-harnesses/`.
  `--no-junie-migrate` keeps the old install.
- Desktop apps that are open keep running the old version until restarted.
- A `muse` note about `schema_version` means that host's Muse settings file
  (`~/.config/muse/settings.json`) lacks it, so `muse serve` exits 3 and T3's
  Muse provider shows "could not read the model catalog". The script only
  reports it; fix it on that host as the T3 fleet runbook's Gotchas describe
  (`docs/runbooks/t3code-fleet.md`).

## 4. After

Report the summary table and receipt path. For a host still behind, say why
(skipped note, failure, asleep). Add a newly linked host to `HOSTS` in the
script with its canonical wrapper only. Never put IPs, tailnet names or
environment ids there: the repository is public. Routes live in
[remote-development-agents](../remote-development-agents/references/hosts.md).

## Verification

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s .claude/skills/update-harnesses/scripts -p 'test_*.py'
```
