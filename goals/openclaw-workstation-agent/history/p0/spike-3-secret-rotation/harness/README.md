# P0 spike 3: same-reference secret rotation/reload

## Review conflicts

None. The contract and review both require the exact isolated Spike 3 root,
`LoadCredential`, secret-free evidence, and cleanup back to pre-spike state.
The harness treats `/etc/beep` as a pre-existing operator prerequisite and
mutates only `/etc/beep/openclaw-spike` beneath it.

This disposable harness authors the Spike 3 proof from
`p0-gauntlet-contract.md`. It uses a root-owned content-addressed generation,
a root-owned active pointer, isolated state/home/workspace paths, and the exact
bootstrap credential path. No secret value is written to this checkout,
root-owned config, unit, evidence, or process argv. Runtime secrets otherwise
travel only through the systemd credential, shell environment, or 1Password
resolver stdout. The named client-config exception below is scratch-only.

## Design

The rotated secret is `gateway.auth.token`. The root-owned config contains the
unchanged `op://` reference as an exec `SecretRef`. OpenClaw resolves it into
the running snapshot. The harness establishes an authenticated cold owner with
a PID-held established loopback socket and authenticated first log frame, asks
the operator to replace the disposable field in the 1Password UI, and polls the
same reference until its eight-character SHA-256 prefix changes.
The harness never performs a plaintext-valued `op item edit`.

The reload proof then requires all of the following:

- a clean current reload with `ok=true` and `warningCount=0`;
- disconnection of the client authenticated before rotation;
- an authentication-specific rejection of the old value;
- a successful health call with the new value;
- a model completion and Telegram live probe tied by nonce and timestamp to
  that reload event.

The model leg uses local `ollama/gemma3:4b`, but authenticates to the OpenClaw
gateway with the rotated gateway token and rejects embedded fallback. The
Telegram bot token must be a second operator-created disposable `op://`
field. Neither token is passed as a CLI option.

### Named exception: ephemeral client token configs

The staged `openclaw@2026.7.1-2` commands used here have no `--token-file`
option. With a CLI `--url` override they also reject
`OPENCLAW_GATEWAY_TOKEN` and configured credentials unless the token itself is
passed in argv. To preserve C-1, `a1` and `a2` instead derive isolated client
configs under `$SPIKE_P/spike3/` with `gateway.mode=remote`,
`gateway.remote.url`, and `gateway.remote.token`, then omit `--url`.

This is the deliberate exception to “no secret values in files.” Each file is
created under `umask 077` as mode `0600`; the token reaches `jq` through stdin,
never argv. The scripts log only the path and mode, shred/remove the files in
their exit traps, and `cleanup.sh` independently removes the same exact paths.
They are outside `logs/` and are never archived as evidence. Configuration was
chosen because this CLI exposes no non-argv token option for these commands.

## Prerequisites

- Node 24 at `$HOME/.local/share/mise/installs/node/24/bin`.
- Staged `openclaw@2026.7.1-2` at
  `$HOME/.cache/beep-p0-stage/openclaw-2026.7.1-2`.
- `jq`, `npm`, `op`, `openssl`, `rg`, `sha256sum`, `systemctl`, `ss`,
  `realpath`, `stat`, and sudo.
- A pre-existing canonical `/etc/beep` directory owned by `root:root` and mode
  `0755`. The harness never creates or removes this operator-owned parent.
- Local Ollama with `gemma3:4b`.
- A disposable 1Password vault/item and read-only service account scoped only
  to that disposable item.
- A disposable Telegram bot and group if assertion 3 is to pass completely.
- `$SPIKE_P` must be an empty, canonical, absolute disposable path. The
  directory must be owned by the runner and mode `0700`; the harness preserves
  sanitized evidence under `$SPIKE_P/spike3/logs`.

## Run order

Do not pipe commands through `tee`; every script writes its own evidence. Do
not create the root credential or change a 1Password/Telegram value before
the no-secret capability preflight.

### 1. No-secret capability preflight

```bash
export SPIKE_P=/absolute/path/to/a-disposable-directory
install -d -m 0700 "$SPIKE_P"
bash .beep/p0-orchestration/spike3/preflight.sh
```

This archives every help surface and separately proves every required flag:
`logs --follow/--url`, reload `--url/--json`, gateway-call `--url/--json`,
all agent arguments, and all channel-probe arguments. It also requires
source evidence that the staged CLI supports `OPENCLAW_GATEWAY_TOKEN`
environment authentication. The live commands do not rely on that general
support because a CLI `--url` override suppresses it. Missing capability is
`PREFLIGHT-BLOCKED` before sudo, credential, unit, 1Password rotation, or
Telegram mutation.

The preflight records exact Node/OpenClaw/op versions, registry
`dist.shasum`/`dist.integrity`, a deterministic full staged-package tree hash,
real `~/.openclaw`, unit fragment/cgroup, listeners, matching processes, and
manager secret-variable names. It requires pre-existing canonical root-owned
mode-`0755` `/etc/beep` and absent `/etc/beep/openclaw-spike`. It also creates
a mode-`0600` per-run scratch nonce marker, archives the same nonce, and starts
the empty mode-`0600` privileged-path manifest.

### 2. Prepare only disposable 1Password fields

In the 1Password UI, create:

- the gateway-token field named by `SPIKE_OP_REF`;
- optionally, the Telegram bot-token field named by `SPIKE_TG_OP_REF`.

Do not use an `op item edit ... field=plaintext` command. Export references and
the non-secret disposable group id only:

```bash
export SPIKE_OP_REF='op://disposable-vault/spike3-item/gateway_token'
export SPIKE_TG_OP_REF='op://disposable-vault/spike3-item/telegram_bot_token'
export SPIKE_TG_GROUP_ID='-1001234567890'
```

Omit both Telegram variables for a partial run; `a3` will emit
`ASSERT-BLOCKED`.

### 3. Install the exact bootstrap credential

The path is not configurable:
`/etc/beep/openclaw-spike/op-service-account-token`. The directory chain is
root-owned `0755`; `/etc/beep` must already exist. The credential is root-owned,
group-readable only by the operator's private primary group, and `0440`.
Record both exact paths in the preflight-created manifest before creating
either path:

```bash
manifest="$SPIKE_P/spike3/logs/privileged-paths.manifest"
grep -Fxq /etc/beep/openclaw-spike "$manifest" ||
  printf '%s\n' /etc/beep/openclaw-spike >>"$manifest"
grep -Fxq /etc/beep/openclaw-spike/op-service-account-token "$manifest" ||
  printf '%s\n' /etc/beep/openclaw-spike/op-service-account-token >>"$manifest"
sudo install -d -o root -g root -m 0755 /etc/beep/openclaw-spike
printf '%s' "$OP_SERVICE_ACCOUNT_TOKEN" |
  sudo install -o root -g "$(id -gn)" -m 0440 /dev/stdin \
    /etc/beep/openclaw-spike/op-service-account-token
unset OP_SERVICE_ACCOUNT_TOKEN
```

The setup rejects `..`, symlinks, a non-canonical realpath, wrong
owner/group/mode/type, writable parents, supplementary members of the private
group, or a source the user manager cannot read. It records metadata only,
never credential content.

### 4. Setup, rotate, break, and clean

```bash
bash .beep/p0-orchestration/spike3/setup.sh
bash .beep/p0-orchestration/spike3/a1-rotate-same-ref.sh
bash .beep/p0-orchestration/spike3/a2-broken-ref.sh
bash .beep/p0-orchestration/spike3/cleanup.sh
```

`a1` establishes the old cold owner and then prints `ROTATE-NOW`. Replace the
gateway field in the 1Password UI at that point. It polls the unchanged
reference for up to 300 seconds; override only with a positive
`SPIKE_ROTATION_TIMEOUT_SECONDS`.

`a1` invokes `a3-rotation-tied-probes.sh` itself. Direct invocation is refused.
Run cleanup after any blocked or failed assertion. Setup also installs an
EXIT/INT/TERM failure trap that calls cleanup.

## Root and credential safety

Setup first requires the runner-owned mode-`0700` scratch root, matching
mode-`0600` nonce marker/archive, and the exact creation-time privileged-path
manifest. It rejects any symlink, hard-linked regular file, or foreign-owned
entry. It recomputes the staged package tree immediately before each validation
and before service start.

Setup renders and validates under `$SPIKE_P`, installs
`/etc/beep/openclaw-spike/<full-config-sha256>/openclaw.json` as
`0644 root:root`, installs all config directories as `0755 root:root`, and
atomically installs the root-owned `current` pointer. The unit's
`OPENCLAW_CONFIG_PATH` uses that pointer.

Cleanup resolves the loaded unit's `FragmentPath` before any unit mutation and
requires the exact harness-owned file and marker. Every privileged path is
recorded before creation. Cleanup compares a complete `find -P -xdev` traversal
with the existing entries in that manifest, verifies realpath containment,
metadata, markers, and each generation's full config hash, then removes exact
files and empty directories only. It never derives a recursive removal target
from a marker/prefix and never recursively removes a privileged path.
Unexpected entries fail closed.

## Evidence

Evidence is under `$SPIKE_P/spike3/logs/`:

- capability help files, `preflight.log`, preflight inventories,
  `preflight-versions.json`, and the setup-completed `versions.json`;
- `setup.log`, `service-preflight.log`, `gateway.log`, the creation-time
  privileged-path manifest, and the deterministic complete installed-root
  traversal/hash whose bootstrap credential digest is explicitly redacted;
- `a1-rotate.log`, cold-owner socket/first-frame/reload/old-auth/new-auth logs,
  and tied `a3` model/Telegram raw and selected-object evidence;
- `a2-broken-ref.log`, causal failed-reload output, alert excerpt, and clean
  restored-reload output;
- `cleanup.log` and the postflight real-state inventory.

Secret evidence is limited to eight-character SHA-256 prefixes and lengths.
Every assertion script scans produced logs for the exact in-memory secrets and
token-shaped values before PASS. Cleanup repeats the token-shape scan before
evidence is eligible for archival. A contaminated log is destroyed in place
and the run fails; it is never retained as evidence.

## Runner notes

- Isolation audit of all seven scripts found ambient OpenClaw launches in the
  `a1`, `a2`, and `a3` wrappers plus the direct `a1` cold-owner launch.
  Preflight and both setup validations were already `env -i`; cleanup and
  `lib.sh` launch no OpenClaw process. All live OpenClaw launches now use
  `env -i` with an isolated `PATH`, `HOME`, `OPENCLAW_CONFIG_PATH`, and
  `OPENCLAW_STATE_DIR`; the generated service entry does the same. A shared
  guard resolves every supplied config path and fails unless it is beneath the
  spike scratch or `/etc/beep/openclaw-spike`.
- All capability checks finish before the operator rotates a secret. Later
  scripts consume the archived preflight decision and do not discover flags
  after mutation.
- Setup and cleanup validate the scratch marker, archived nonce, ownership,
  mode, symlink absence, and regular-file link counts before deleting scratch
  content. Cleanup preserves only the marker and sanitized `logs/`, so
  teardown-first and repeated cleanup remain provenance-bound.
- Secret-bearing commands export values inside the executing shell and invoke
  `op`/OpenClaw directly. They do not use `env VAR=secret command`, because
  that wrapper would expose the assignment in its argv.
- A reload authorized by the old snapshot may disconnect before returning.
  Its exit code is captured explicitly; PASS still requires the clean
  new-snapshot reload, stale-owner disconnection, old-auth rejection
  signature, and new-auth health signature.
- The broken-reference marker changes only resolver behavior for one reload.
  PASS requires a nonzero reload, a secret-resolution failure signature, the
  exact `secrets.reload failed` alert, and a clean reload after marker removal.
- Cleanup proves zero matching unit files, loaded fragment, cgroup members,
  processes, listener, credential, root generations, state, home, workspace,
  and manager secret variables. It requires byte-identical pre/post inventory
  for real `~/.openclaw`. Process observers exclude the current PID and its
  complete ancestor chain; residue requires the verified unit cgroup, exact
  `OPENCLAW_STATE_DIR`, port ownership, or the staged OpenClaw argv plus its
  exact Node executable.

## Syntax verification

No harness step was executed. This is the complete 2026-07-25 syntax-only
verification command and output transcript:

```text
$ bash -n .beep/p0-orchestration/spike3/a1-rotate-same-ref.sh
[exit 0]
$ bash -n .beep/p0-orchestration/spike3/a2-broken-ref.sh
[exit 0]
$ bash -n .beep/p0-orchestration/spike3/a3-rotation-tied-probes.sh
[exit 0]
$ bash -n .beep/p0-orchestration/spike3/cleanup.sh
[exit 0]
$ bash -n .beep/p0-orchestration/spike3/lib.sh
[exit 0]
$ bash -n .beep/p0-orchestration/spike3/preflight.sh
[exit 0]
$ bash -n .beep/p0-orchestration/spike3/setup.sh
[exit 0]
```

All seven `bash -n` checks passed.
