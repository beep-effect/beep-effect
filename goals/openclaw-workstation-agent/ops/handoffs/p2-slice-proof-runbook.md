# P2 Slice-Proof Runbook (operator-gated legs)

The P2 code surface is landed and verified (`infra/src/OpenClaw.ts`,
`infra/openclaw`, branch `goals/openclaw-p2-generation`). This runbook is the
executable checklist for the remaining P2 exit criteria, which need an
operator present (YubiKey-FIDO sudo, 1Password, Tailscale). Evidence lands
under `history/p2/` in the spike NOTES format (assertion → commands →
raw output).

## 0. Prerequisites (operator)

1. Merge PR #482 (`@beep/openclaw` driver), then rebase
   `goals/openclaw-p2-generation` onto `origin/main` and drive its PR to
   mergeable via `/yeet` (verify already green on the stacked branch).
2. Armed sudo pty for every privileged step — same mechanics as the
   gauntlet: run the WHOLE session inside one pty via
   [`sudo-session.sh`](./sudo-session.sh) (per-tty tickets; `sudo -n`
   refreshed every ~45 s). `pulumi up` must run inside this pty so
   `command.local.Command` children inherit the armed tty.
3. `PULUMI_CONFIG_PASSPHRASE` resolved from 1Password out-of-band
   (never in files or state).
4. For the backup leg: Tailscale up, `dankserver` reachable over SSH with
   the local agent (`SSH_AUTH_SOCK`), and an `op://` ref for the backup
   passphrase resolvable via `op read`.
5. A root-owned Node toolchain provisioned at `nodeBinDir` — see below.

### Provision the root-owned Node toolchain

Staging runs `npm install` as **root**. If the Node toolchain were writable by
the workstation user, any user-level compromise could replace `npm` or `node`
and execute arbitrary code as root during `pulumi up`. The stage script
therefore resolves `nodeBinDir`, `node`, and `npm` with `readlink -f` and
requires every path component up to `/` to be uid 0 and not group- or
world-writable, failing closed with `STAGE-FAIL` (exit 73) otherwise.

A per-user mise/nvm install can never satisfy this. Install the pinned Node
tarball into the root-owned trusted tree instead (copy, never symlink — the
guard resolves symlinks physically, so a link into `$HOME` still fails):

```sh
node_version=24.16.0   # must equal OPENCLAW_COMPATIBILITY_SET.nodeVersion
tmp="$(mktemp -d)"
curl -fsSL "https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-x64.tar.xz" \
  -o "${tmp}/node.tar.xz"
# Verify against the published SHASUMS256.txt before installing.
sudo -n install -d -o root -g root -m 0755 /opt/beep /opt/beep/openclaw
sudo -n tar -xJf "${tmp}/node.tar.xz" -C /opt/beep/openclaw
sudo -n mv /opt/beep/openclaw/"node-v${node_version}-linux-x64" /opt/beep/openclaw/node
sudo -n chown -R root:root /opt/beep/openclaw/node
sudo -n chmod -R go-w /opt/beep/openclaw/node
rm -rf "${tmp}"
```

Confirm the guard's own predicate before running `pulumi up`; every line must
print `0` for owner and a mode with no group/other write bit:

```sh
for p in /opt /opt/beep /opt/beep/openclaw /opt/beep/openclaw/node \
         /opt/beep/openclaw/node/bin /opt/beep/openclaw/node/bin/node \
         /opt/beep/openclaw/node/bin/npm; do
  stat -c '%n uid=%u mode=%a' "$p"
done
/opt/beep/openclaw/node/bin/node --version   # must equal the pinned version
```

## 1. Stack init + config (one-time)

```sh
cd infra/openclaw
PULUMI_CONFIG_PASSPHRASE=… pulumi stack init workstation
# Identity binding (fail-closed preflight): every value read from the REAL host
pulumi config set openclaw:expectedMachineId  "$(cat /etc/machine-id)"
pulumi config set openclaw:expectedHostname   "$(hostname)"
pulumi config set openclaw:expectedUid        "$(id -u)"
pulumi config set openclaw:expectedUsername   "$(id -un)"
pulumi config set openclaw:expectedHome       "$HOME"
pulumi config set openclaw:expectedRuntimeDir "/run/user/$(id -u)"
# Deployment intent (defaults exist; set what differs)
pulumi config set openclaw:gatewayPort 19031
pulumi config set openclaw:gatewayAuthTokenRef "op://<vault>/<item>/<field>"
pulumi config set openclaw:resolverCommandPath  "<abs op-resolver script>"
pulumi config set openclaw:resolverOpBinaryPath "$(command -v op)"
pulumi config set openclaw:resolverTrustedDir   "<abs trusted dir>"
# nodeBinDir defaults to /opt/beep/openclaw/node/bin and must stay root-owned; see
# "Provision the root-owned Node toolchain" below. Never point it at a mise/nvm path
# under $HOME — staging runs npm as root and fails closed on a user-writable toolchain.
# Paths (defaults: configRoot /etc/beep/openclaw, unitName openclaw.service)
# Backup leg (optional now, required for the drill):
pulumi config set openclaw:backupSshHost dankserver
pulumi config set openclaw:backupSshUser elpresidank
pulumi config set openclaw:backupRemoteDir "/srv/data/openclaw-backups"
pulumi config set openclaw:backupPassphraseSecretRef "op://<vault>/<item>/<field>"
```

Key names above are exactly what `loadOpenClawStackArgs` reads
(`infra/src/OpenClaw.ts`); unset keys fall back to schema defaults.

## 2. First vertical slice (P2 exit: deployed healthy)

Inside the armed pty:

```sh
cd infra/openclaw
PULUMI_CONFIG_PASSPHRASE=… pulumi preview -s workstation --non-interactive --diff
PULUMI_CONFIG_PASSPHRASE=… pulumi up      -s workstation --yes --non-interactive
```

Pass = preflight proof anchors in `preflightStdout`, stage validate OK with
the candidate binary, apply commit marker, probe healthy
(`curl 127.0.0.1:<port>/health` → 2xx; `openclaw gateway call health --json`
authenticated). Archive stdouts (they are pulumi secrets — `pulumi stack
output --show-secrets`) under `history/p2/slice-1/`.

## 3. Second generation + forced failed-health rollback (P2 exit)

1. Change intent (e.g. `pulumi config set openclaw:gatewayPort 19032`),
   `pulumi up` → generation switch proof (new hash dir, pointer moved,
   old generation retained).
2. Forced rollback: set a port whose probe MUST fail (probe expects the
   new port while the unit is pinned to the old — or temporarily block the
   port), run `pulumi up`, assert the apply script's failure path restored
   the snapshot and the prior pointer (`APPLY-FAIL` + restore lines), and
   the prior generation serves `/health` again. Alternatively run the
   rendered rollback script directly (exported
   `renderOpenClawRollbackScript`) and record `ROLLBACK-OK`.

## 4. Drift-audit demo (P2 exit; alert-only)

Root-assisted deliberate drift, one dimension at a time: edit the config
copy, retarget the pointer, disable the unit, swap node/openclaw versions.
Run the rendered drift script (exported `renderOpenClawDriftAuditScript`)
after each and record the `ALERT: OPENCLAW_CONFIG_DRIFT` lines + wrong
identity preflight failure (`pulumi up` against a mutated expectation must
fail BEFORE mutation). Repair by redeploy (`pulumi up`), never in place.

## 5. Backups + restore drill (P2 exit)

`pulumi up` with backup config present ships the encrypted archive
(`BACKUP-OK archive=… sha256=…` receipt). Also ship encrypted Pulumi state
(`pulumi stack export` → gpg → scp, same receipt pattern). Restore drill:
pull the archive back from dankserver, decrypt, restore into a scratch
state dir, start the generation against it, record health. dankserver is
never modified beyond receiving files.

## 6. Evidence + status flip

Write `history/p2/NOTES.md` (assertions 2-5 with raw logs), flip the
manifest P2 phase to `complete`, update README/PLAN, and land it all in
the same PR as any runbook corrections discovered during the drill.
