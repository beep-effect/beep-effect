# Harness mechanics

Inventory taken on 2026-11-09 across the fleet. The script re-detects all of
this on every run, so the table describes why each rule exists, not a fixed
install list.

## Connections

Only the main thread authenticates. It opens one ControlMaster per host
(socket `cm-harness-<host>` in the SSH directory, `ControlPersist=2h`, keepalive 15 s x 4) through
the canonical wrapper, serially, and opens it again before the T3 and admin
phases if it lapsed during the hub build. Worker threads connect with
`ControlMaster=no` to a `.invalid` host name, so without a live master they fail
instead of starting a login. A host agent that dies without records produces
`failed` rows for every harness it was asked about.

## Which install is updated

`harness_host.sh` searches, in order:

1. the `PATH` of the host's `t3code.service` (what delegated agents resolve);
2. the `PATH` the agent inherited (an SSH command gets a minimal one);
3. the home directory's `.local/bin`, `.bun/bin` and `.npm-global/bin`, the shell's `node` dir,
   `/usr/local/bin`, `/usr/bin`.

The first hit is `active`; later hits are `shadowed`. Copies found only under
another nvm or mise node version's `bin` are `stale`. Those are reported but
never updated, because nothing runs them and their node may be gone. Every
writable active or shadowed install is updated. Root-owned ones are skipped
with a note. Example: dankserver's `/usr/local/bin/codex` (npm 0.117) sits
behind the worker's nvm copy on the service PATH.

## Methods

| Method | Detected by (real path) | Update |
| --- | --- | --- |
| `npm` | `*/lib/node_modules/<pkg>/*` | `<prefix>/bin/npm install -g --prefix <prefix> <pkg>@latest` |
| `bun` | `*/.bun/install/global/node_modules/<pkg>/*` | `bun add -g <pkg>@latest` |
| `native` (claude) | `~/.local/share/claude/versions/*` | `claude update` |
| `native` (codex) | `~/.codex/packages/standalone/*` | `codex update` |
| `native` (grok) | ELF under `$HOME` | `grok update` (keeps the host's stable/alpha channel) |
| `kimi` | `~/.kimi-code/*` | `kimi upgrade --yes` |
| `cursor-agent` | `~/.local/share/cursor-agent/versions/*` | `cursor-agent update` |
| `muse` | launcher script naming `muse-code/channels` | `MUSE_SYNC_UPDATE=1 muse --version` (the launcher's synchronous update path) |
| `junie-managed` | script marked `JUNIE_MANAGED_SHIM` | `junie update` |
| `junie-legacy` / npm Junie | anything else under `$HOME` | migrate (below) |

`status` sets `MUSE_NO_AUTO_UPDATE=1` so reading Muse's version does not start
its background self-update. In both modes the host agent also reads the Muse
settings file (`~/.config/muse/settings.json`) and adds a note to the `muse`
row when it has no `schema_version`: `muse serve` then exits 3 and T3's Muse
provider cannot read its model catalog. The script never rewrites the file.

### tom-pc-1-wsl

Inventory of the WSL distro's `agent` account, 2026-11-09 (`status` over
`ssh-tom-pc-1-wsl`). The active entry of every harness is in the home
directory's `.local/bin`:

| Harness | Installed by | Real path | Method |
| --- | --- | --- | --- |
| node, npm | Node tarball at `~/.local/opt/node`, linked from `.local/bin`; mise holds the global bun and node and the checkout pins | `~/.local/opt/node/bin/node` | not a harness |
| claude | native installer | `~/.local/share/claude/versions/<v>` | `native` |
| codex | npm, prefix `~/.local` | `~/.local/lib/node_modules/@openai/codex` | `npm` |
| junie | npm, prefix `~/.local` (frozen 1468.30) | `~/.local/lib/node_modules/@jetbrains/junie-cli` | `npm`; the first `update` migrates it to the managed launcher |
| cursor-agent | `cursor.com/install` | `~/.local/share/cursor-agent/versions/<v>` | `cursor-agent` |
| grok | x.ai installer | `~/.grok/downloads/grok-linux-x86_64` | `native` |
| muse | Meta's Muse launcher | `.local/bin/muse` (launcher script) | `muse` |
| kimi | `code.kimi.ai` installer | `~/.kimi-code/bin/kimi` | `kimi` |
| t3code | fork pull | `~/.t3/runtime/versions/<v>/t3` | `fork-pull-unit` |

The wrapper keeps its own dedicated agent for the login and for `--admin`
forwarding, so the script never starts the dankserver agent for this host.
No Cursor sandbox profile is installed there, so no repin runs.

### Junie migration

`@jetbrains/junie-cli` on npm stopped at 1468.30, and the workers' pre-launcher
shim lacks `update`. JetBrains' supported channel is the managed launcher from
`https://junie.jetbrains.com/install.sh`, which writes the home directory's `.local/bin/junie`, so
migration runs only when that entry is the active one. Otherwise the row is
skipped ("migrate by hand"). The host agent downloads the installer first, then
moves the old entry, which may be an npm symlink that must not be written
through, to `~/.local/state/beep/update-harnesses/junie.prev.<stamp>`. Then it
runs the installer. On failure, a missing managed marker, or a signal before
confirmation (SIGPIPE is ignored meanwhile, so a dropped SSH channel cannot cut
the restore short), the old entry goes back. The backup is kept after success,
and the npm package stays installed (inactive). Opt out with
`--no-junie-migrate`. To reverse, move the kept backup back to
the home directory's `.local/bin/junie`.
The JetBrains login is unaffected; workers were not signed in before either.

## T3 Code

- Hub: `systemctl --user start t3code-source-update.service` runs
  `update-t3code-source` (merge upstream, build, publish the fleet archive,
  install the AppImage, post the restart prompt). It never sets
  `T3CODE_SYNC_FORCE`. A new published version restarts every worker's T3
  service at its next pull.
- Workers: `systemctl --user start t3code-fork-pull.service` after the hub
  finishes, so they pick up a build published by this run. The pull pins
  `T3CODE_RELEASE_BASE_URL` to the hub mirror; never run a bare `t3 update`.
- grok-bot (no systemd): `/workspace/bootstrap/ensure-services.sh`, the same
  reconcile `grok-bot-ensure.timer` runs from the hub.
- Fleet runbook: `docs/runbooks/t3code-fleet.md`.

## Desktop apps

### Hub (CachyOS)

`chatgpt-bin` (OpenAI's own pacman repo), `claude-desktop` and `cursor-bin`
(cachyos repo). `checkupdates` with a private database
(`CHECKUPDATES_DB=~/.cache/beep/update-harnesses/checkup-db`) finds pending
versions without root. Arch supports only whole-system upgrades: a targeted
`pacman -Sy <pkg>` leaves the system in a partial-upgrade state. So a pending
desktop package is installed only through `pacman -Syu`, and only with
`--system-upgrade`; without the flag it stays `pending`. Authentication and
upgrade run inside one `script` PTY because sudo tickets are tty-scoped.
`yubi-sudo -v` gets three attempts of 60 s each (PAM's own pam_u2f cues
happen inside each one), and a fall-through to a password prompt dies with its
attempt. Then `sudo -n pacman -Syu --noconfirm` runs with no kill timeout,
because killing pacman mid-transaction is worse than waiting.

Kimi Code Desktop is an AppImage in the home directory's `.local/opt/kimi-code/`. Its built-in
updater feed (`app-update.yml`, provider `generic`) is
`https://code.kimi.com/kimi-code/desktop/latest-linux.yml`. The script
downloads the AppImage named there, checks size and base64 sha512, keeps the
previous binary as `KimiCode-linux-x86_64.AppImage.prev`, swaps atomically and
records the feed in `latest-linux-installed.yml`.

### grok-bot (Debian 13 microVM)

ChatGPT and Claude Desktop are Debian packages from the vendors' apt repos.
`sudo` there is `pam_rssh` over the forwarded YubiKey agent (`ssh-grok-bot
--admin`). The admin prelude runs `sudo -A -v` with `SUDO_ASKPASS=/bin/false`,
so a missed touch fails instead of falling through to the account password.
Only vendor source lists are refreshed. The box's egress proxy refuses
`deb.debian.org` pool files, so when `--only-upgrade` needs one, the admin
script prints the `--print-uris` records (URL, file name, SHA-256). The hub
accepts only records the script printed after `@@ADMIN start`, served over
http(s) from a Debian mirror, with a plain `.deb` name and a 64-hex hash. It
downloads them, checks each SHA-256, and pushes them to
`~/.cache/beep-debs/<stamp>/` on the box. A second admin run copies exactly
those names into root-owned `/var/cache/beep-debs/<stamp>/`, re-checks every
hash as root, installs those paths, and retries the upgrade. Nothing is ever
installed from a glob of a user-writable directory.

## beep-worker Cursor sandbox pins

`/etc/apparmor.d/beep-cursor-sandbox` grants `userns` to two helpers by exact
path: the T3 runtime's `@cursor/sdk-linux-x64/bin/cursorsandbox` and the Cursor
CLI's `cursorsandbox`. Both paths contain a version, so every T3 or Cursor CLI
update breaks the sandbox (`SandboxUnsupportedError`). The host agent compares
the pins with the current helpers. On drift, the orchestrator rewrites only the
two path tokens and runs the result through the admin route:

1. back up to `/var/backups/beep-apparmor/` (never inside `/etc/apparmor.d`,
   which would load the backup);
2. parse-check with `apparmor_parser -Q -K`;
3. install, then `apparmor_parser -r`, restoring the backup if the reload fails;
4. verify with `cursor-agent sandbox run echo ok`.

The pins stay exact. Restart T3 on the host when idle to clear a cached
preflight failure; the script does not, because that would end running turns.

## Not in scope

- Installing a harness that a host lacks. `absent` rows are reported, not fixed.
- Root-owned or system-package CLI installs on workers (no sudo there).
- Stale beep-worker leftovers outside the scope, such as the October nightly
  `t3code` desktop deb and the `chatgpt` deb. They are visible in `status` probes
  only.
