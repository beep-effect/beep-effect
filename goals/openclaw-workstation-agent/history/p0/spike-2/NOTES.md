# Spike 2 — non-interactive user-manager apply

**Verdict: Spike 2: 3/3 assertions PASS.** The gated decision *applicator
contracts + identity binding* (SPEC.md L100–110) is supported by this evidence
and does not re-open. Three findings and one residual risk are recorded below
and should be folded into the applicator contract before implementation.

- **Spike id:** `p0/spike-2`
- **Run date:** 2026-07-26 (UTC) / 2026-07-25 (local CDT)
- **Contract:** `goals/openclaw-workstation-agent/ops/handoffs/p0-gauntlet-contract.md` § Spike 2
- **Gated decision:** SPEC.md § Architecture — *Applicator contract + identity binding*

## Pinned inputs

| Input | Value |
| --- | --- |
| systemd (`systemctl --version`) | `systemd 261 (261.2-1-arch)` |
| user manager reported version | `261.2-1-arch` |
| `loginctl --version` | `systemd 261 (261.2-1-arch)` |
| Kernel (`uname -r`) | `7.1.4-1-cachyos` |
| Distro (`/etc/os-release`) | CachyOS Linux (`ID=cachyos`, `ID_LIKE=arch`) |
| User / UID | `elpresidank` / `1000` |
| Home | `/home/elpresidank` |
| Hostname | `DankStation` |
| `/etc/machine-id` | recorded as SHA-256 `90bdffbb…e60c563d` (see redaction note) |
| Session state during run | `State=active`, `Sessions=3 2` (seat0 tty2 + manager) |

**Redaction note.** `/etc/machine-id` is a stable host identifier and this repo is
public, so both the applicator and this evidence file bind on
`sha256(/etc/machine-id)` rather than the raw value. This is strictly stronger as
a contract shape (the expectation file never has to carry the secret) and is
recommended for the real applicator.

**No OpenClaw involved.** Per the damage boundary, no live OpenClaw instance
exists on this workstation and none was created. Spike 2 gates systemd
user-manager mechanics only, so the unit under test is a placeholder
(`ExecStart=/usr/bin/sleep infinity`) named `openclaw-spike.service`, installed as
a **user** unit under `~/.config/systemd/user/`. No sudo was used at any point.

**Initial state (recorded before any change):**

```
$ loginctl show-user elpresidank --property=Linger
Linger=no
```

Linger was **off** at the start. It was enabled for the spike and restored to
`no` at cleanup (proof in the Cleanup section). Because it started off, the
linger-disabled negative branch was exercised *first*, for free, against the
machine's genuine pre-spike state rather than a simulated one.

## Harness

All artifacts live in the session scratchpad; nothing was written into the repo
worktree (proven in Cleanup).

| File | SHA-256 | Role |
| --- | --- | --- |
| `applicator.sh` | `3a44bfb0<sha256-redacted>` | the applicator model: preflight (5 steps) then mutation |
| `run-lane.sh` | `f970956f<sha256-redacted>` | wraps each lane in the non-interactive context |
| `probe.sh` | `d64c58a7<sha256-redacted>` | read-only witness capture (before/after each lane) |
| `expected-identity.json` | — | correct bound identity |
| `expected-identity-mutated.json` | — | machine-id digest zeroed |
| `expected-identity-mutated-hostname.json` | — | hostname set to `SomeOtherHost` |
| `logs/` | — | full per-lane transcripts + 14 witness captures |

Preflight order is load-bearing and is the contract this spike proposes:
**1** resolve identity from the OS → **2** linger → **3** derive runtime dir + bus
address from UID → **4** live bus reachability → **5** identity binding →
*only then* mutation. Exit codes are distinct per failure class: `10`
`PREFLIGHT_FAIL_LINGER`, `20` `PREFLIGHT_FAIL_BUS`, `30`
`PREFLIGHT_FAIL_IDENTITY`, `40` `APPLY_FAIL`.

**Non-interactive context.** Every lane ran under a fresh session with no
controlling TTY and a scrubbed environment:

```
setsid -w env -i HOME=/home/elpresidank USER=elpresidank LOGNAME=elpresidank \
  PATH=/usr/bin:/bin SPIKE_TARGET_USER=elpresidank \
  SPIKE_EXPECTED_IDENTITY=<path> SPIKE_STATE_DIR=<path> \
  bash applicator.sh   </dev/null
```

Confirmed inside every lane:

```
pid=1458412 ppid=1458404 sid=1458412          # sid == pid: new session leader
tty(stdin)=not a tty
no fd is a tty: confirmed
inherited env var count=10; names: HOME LOGNAME PATH PWD SHLVL
    SPIKE_EXPECTED_IDENTITY SPIKE_STATE_DIR SPIKE_TARGET_USER USER _
XDG_RUNTIME_DIR inherited? <unset>
DBUS_SESSION_BUS_ADDRESS inherited? <unset>
```

The applicator additionally `unset`s both variables before use, so derivation
from UID is the only path by construction.

---

## Assertion 1 — positive lane — **PASS**

> Linger is verifiable for the target user; with linger active, `XDG_RUNTIME_DIR`
> and the user DBus bus are reachable and `systemctl --user` daemon-reload /
> enable / start / stop of the spike unit all succeed from the non-interactive
> context.

Setup (the one linger mutation, restored at cleanup):

```
$ loginctl show-user elpresidank --property=Linger --value    # INITIAL_LINGER=no
$ loginctl enable-linger        # rc=0, no sudo, no polkit prompt
$ loginctl show-user elpresidank --property=Linger --value    # yes
$ ls -la /var/lib/systemd/linger/
-rw-r--r-- 1 root root 0 Jul 25 23:37 elpresidank
```

Lane: `./run-lane.sh P1-positive-final "$PWD/expected-identity.json"` →
**exit 0**. Full transcript: `logs/P1-positive-final.log` (an earlier identical
run is `logs/P1-positive.log`).

Preflight:

```
=== step 2: linger ownership check ===
loginctl show-user elpresidank --property=Linger --value -> yes
linger enabled: OK

=== step 3: derive runtime dir and bus address from UID ===
derived XDG_RUNTIME_DIR=/run/user/1000
derived DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus

=== step 4: user bus reachability (read-only probes) ===
busctl --user --list (rc=0) first 3 lines of 200:
    | NAME              PID   PROCESS          USER        CONNECTION  UNIT              ...
    | :1.0             12231  gnome-keyring-d  elpresidank :1.0        user@1000.service ...
systemctl --user show --property=Version --value (rc=0) -> 261.2-1-arch
systemctl --user is-system-running -> degraded
bus reachable, user manager version=261.2-1-arch: OK

=== step 5: identity binding vs expectation ===
identity tuple matches expectation on all 7 fields: OK
```

Mutation phase — every step rc=0:

```
=== PREFLIGHT OK — entering mutation phase ===
writing unit /home/elpresidank/.config/systemd/user/openclaw-spike.service
$ systemctl --user daemon-reload (rc=0)
$ systemctl --user enable openclaw-spike.service (rc=0)
    | Created symlink '/home/elpresidank/.config/systemd/user/default.target.wants/openclaw-spike.service' → '…/openclaw-spike.service'.
$ systemctl --user start openclaw-spike.service (rc=0)
$ systemctl --user is-active openclaw-spike.service (rc=0)
    | active
post-start unit properties:
    | LoadState=loaded
    | ActiveState=active
    | SubState=running
    | FragmentPath=/home/elpresidank/.config/systemd/user/openclaw-spike.service
    | UnitFileState=enabled
    | MainPID=1491117
$ systemctl --user stop openclaw-spike.service (rc=0)
post-stop ActiveState: inactive
$ systemctl --user disable openclaw-spike.service (rc=0)
    | Removed '/home/elpresidank/.config/systemd/user/default.target.wants/openclaw-spike.service'.
post-disable UnitFileState: disabled

=== APPLY OK ===
### EXIT CODE: 0
```

Independent witness (`logs/witness-14-post-P1rerun.txt`) confirms the unit was
really installed and really landed disabled+inactive:

```
unit_file_exists=yes
list-unit-files rc=0 out=UNIT FILE STATE PRESET/openclaw-spike.service disabled enabled//1 unit files listed.
LoadState=loaded ActiveState=inactive UnitFileState=disabled
```

**Harness defect, disclosed.** The first positive attempt
(`logs/P1-positive-ATTEMPT1-harness-sigpipe.log`) exited 20 with
`busctl rc=141`. That was a bug in the probe, not a real bus failure:
`busctl … | head -3` inside a `pipefail` command substitution surfaced busctl's
SIGPIPE death (128+13) as the probe's exit code, while the parallel
`systemctl --user show` probe correctly returned rc=0. Fixed by capturing the
full output first and trimming for display only; re-run passed. Recording it
because it is a real trap for the implementation (any preflight that pipes a
long-output probe into `head` under `pipefail` will produce phantom
bus-unreachable failures) — and because the failure was itself a fail-closed,
no-mutation outcome, which is the correct direction to fail in.

---

## Assertion 2 — negative lane, fails before mutation — **PASS** (3 variants)

> Negative: with linger disabled (or bus unreachable), the preflight detects the
> condition and fails BEFORE any mutation.

Both halves of the contract's disjunction were exercised, plus a deeper
bus variant. All three left the machine bit-identical.

### 2a — linger disabled (genuine pre-spike state, not simulated)

`./run-lane.sh N1-linger-off "$PWD/expected-identity.json"` → **exit 10**.
Log: `logs/N1-linger-off.log`.

```
=== step 2: linger ownership check ===
loginctl show-user elpresidank --property=Linger --value -> no

FAIL(10): PREFLIGHT_FAIL_LINGER: linger='no' for elpresidank; a user manager is
not guaranteed to exist outside a login session. No mutation performed.
### EXIT CODE: 10
```

No-mutation proof — `diff` of the witness captured before
(`witness-01-pristine.txt`) and after (`witness-02-post-N1.txt`), timestamp line
excluded, was empty:

```
unit_file_exists=no
wants_symlink_exists=no
list-unit-files rc=1 out=UNIT FILE STATE PRESET//0 unit files listed.
UnitsLoadTimestampMonotonic=61906350748      # identical before and after
LoadState=not-found ActiveState=inactive UnitFileState=
→ NO_WITNESS_DRIFT
```

### 2b — runtime dir absent (`/run/user/99999`)

`./run-lane.sh N2-bus-unreachable "$PWD/expected-identity.json" 99999` →
**exit 20**. Log: `logs/N2-bus-unreachable.log`.

```
NOTE: runtime derivation overridden to uid=99999 (negative-lane injection)
derived XDG_RUNTIME_DIR=/run/user/99999
derived DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/99999/bus

FAIL(20): PREFLIGHT_FAIL_BUS: runtime dir /run/user/99999 does not exist.
No mutation performed.
### EXIT CODE: 20
```

Witness diff `witness-05-pre-N2` vs `witness-06-post-N2`: empty, including
`UnitsLoadTimestampMonotonic=62356024912` unchanged → **no daemon-reload ran**.
Baseline had been reset to `unit_file_exists=no` before this lane specifically so
that absence, not merely non-change, is what the witness asserts.

### 2c — runtime dir present, bus dead (live-probe variant)

2b short-circuits on a cheap path check, which does not prove the live bus probe
works. So a decoy runtime dir was created at `/tmp/oc-spike2-decoy` holding a
socket that accepts connections and immediately closes
(`socat UNIX-LISTEN:/tmp/oc-spike2-decoy/bus,fork,mode=600 SYSTEM:true`).

`./run-lane.sh N2b-dead-bus "$PWD/expected-identity.json" /tmp/oc-spike2-decoy` →
**exit 20**. Log: `logs/N2b-dead-bus.log`.

```
NOTE: runtime dir overridden to /tmp/oc-spike2-decoy (negative-lane injection)
derived DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/oc-spike2-decoy/bus

=== step 4: user bus reachability (read-only probes) ===
busctl --user --list (rc=1) first 3 lines of 1:
    | Failed to list names: Transport endpoint is not connected
systemctl --user show --property=Version --value (rc=1) -> Failed to connect to
    user scope bus via local transport: No such file or directory

FAIL(20): PREFLIGHT_FAIL_BUS: user manager for uid=1000 not reachable over
unix:path=/tmp/oc-spike2-decoy/bus (busctl rc=1, systemctl rc=1).
No mutation performed.
### EXIT CODE: 20
```

Witness diff `witness-07-pre-N2b` vs `witness-08-post-N2b`: empty.

---

## Assertion 3 — identity binding — **PASS** (positive + 2 mutations)

> Identity binding: preflight computes `/etc/machine-id` + hostname + UID (+
> expected home and runtime paths); a deliberately mutated expectation makes
> preflight fail before mutation.

The bound tuple has 7 fields — the 5 the contract names plus the derived bus
address and the target username:

```json
{
  "machine_id_sha256": "90bdffbb<sha256-redacted>",
  "hostname": "DankStation",
  "uid": 1000,
  "user": "elpresidank",
  "home": "/home/elpresidank",
  "runtime_dir": "/run/user/1000",
  "bus_address": "unix:path=/run/user/1000/bus"
}
```

### 3a — correct expectations → proceeds

The Assertion 1 lane *is* this run: it consumed `expected-identity.json`, logged
`identity tuple matches expectation on all 7 fields: OK`, crossed
`PREFLIGHT OK — entering mutation phase`, and applied successfully (exit 0).

### 3b — mutated `machine_id_sha256` → fails before mutation

`./run-lane.sh N3-identity-mismatch "$PWD/expected-identity-mutated.json"` →
**exit 30**. Log: `logs/N3-identity-mismatch.log`. Note step 4 passed first
(`bus reachable … OK`), so this lane isolates the identity check rather than
piggybacking on a bus failure:

```
identity mismatches:
    ! machine_id_sha256: expected=0000…0000 actual=90bdffbb…e60c563d

FAIL(30): PREFLIGHT_FAIL_IDENTITY: identity tuple does not match the bound
expectation. No mutation performed.
### EXIT CODE: 30
```

Witness diff `witness-09-pre-N3` vs `witness-10-post-N3`: empty
(`unit_file_exists=no`, `UnitsLoadTimestampMonotonic` unchanged).

### 3c — mutated `hostname` → fails before mutation

Added to show the check is field-general, not special-cased on machine-id.
`./run-lane.sh N3b-identity-hostname "$PWD/expected-identity-mutated-hostname.json"`
→ **exit 30**. Log: `logs/N3b-identity-hostname.log`.

```
identity mismatches:
    ! hostname: expected=SomeOtherHost actual=DankStation
FAIL(30): PREFLIGHT_FAIL_IDENTITY: … No mutation performed.
### EXIT CODE: 30
```

Witness diff `witness-11-pre-N3b` vs `witness-12-post-N3b`: empty.

---

## Findings for the applicator contract

1. **`systemctl --user is-system-running` must not gate the preflight.** It
   returned `degraded` throughout on a perfectly healthy user manager (some
   unrelated user unit has failed at some point). A preflight gating on it would
   refuse to apply on most real desktops. The reliable gate is a bus round-trip
   that returns rc=0 — this spike used
   `systemctl --user show --property=Version --value` plus `busctl --user --list`.
   Keep `is-system-running` as recorded diagnostic context only.
2. **`UnitsLoadTimestampMonotonic` is a cheap, exact daemon-reload witness.**
   `systemctl --user show --property=UnitsLoadTimestampMonotonic --value` moves on
   every `daemon-reload` and nothing else. The SPEC's drift-audit inventory should
   carry it: it distinguishes "unit content unchanged" from "manager never
   reloaded", which unit-file state alone cannot.
3. **UNIX socket paths cap at 108 bytes (`sun_path`).** The decoy had to move out
   of the 138-character scratchpad path to `/tmp/oc-spike2-decoy` because socat
   truncated it. If the OpenClaw gateway or any applicator-managed component opens
   a UNIX socket beneath a state/config directory, deep content-hashed roots
   (`/etc/beep/openclaw-spike/<content-hash>/…`) can silently exceed the limit.
   Worth a length assertion in the renderer or applicator preflight.
4. **`loginctl enable-linger` for one's own user needed no sudo and raised no
   polkit prompt here** (allowed while a session is active). The applicator should
   still treat linger as a *declared prerequisite it verifies*, not something it
   silently enables: from a genuinely session-less context the polkit
   `allow_active` path is unavailable, so self-enabling would work interactively
   and fail exactly where it matters.
5. **Environment scrubbing confirms the derivation requirement.** Under `env -i`
   only 10 variables survive (`HOME LOGNAME PATH PWD SHLVL USER _` plus the
   applicator's own inputs); `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` are
   simply absent. An applicator that reads them from the environment gets nothing
   and fails opaquely, which is exactly why the contract's "derive from UID"
   clause is load-bearing.

## Residual risk / scope limit (honest caveat)

Assertion 1 was demonstrated with linger enabled **and an active graphical
session present** for uid 1000 (`Sessions=3 2`, seat0/tty2). `/run/user/1000` and
its bus therefore existed because of the session, not because of linger. The case
linger actually exists for — **no session at all**, user manager started at boot
by linger — was **not** exercised, because proving it requires terminating the
user's session, which is outside this spike's damage boundary.

This does not weaken assertions 2 or 3, and it does not change the preflight
contract (the applicator verifies bus reachability rather than assuming it). But
"non-interactive" here means *no TTY and no inherited session env*; it does not
yet mean *no session in existence*. Recommended follow-up during P1 build-out,
not a gauntlet blocker: run the same `P1` lane once over
`ssh localhost` immediately after `loginctl terminate-user`, or on a headless
target, and confirm the linger-started user manager answers the same probes.

Also out of scope by design, per the contract's Spike 2 section: no privileged
applicator path (spikes 1 and 4 own that), no remote-SSH applicator, and no real
OpenClaw unit content — the unit here is a `sleep infinity` placeholder.

## Cleanup

Executed (`logs/cleanup.txt`):

```
$ systemctl --user stop openclaw-spike.service          # rc=0
$ systemctl --user disable openclaw-spike.service       # rc=0
$ rm -vf ~/.config/systemd/user/openclaw-spike.service
removed '/home/elpresidank/.config/systemd/user/openclaw-spike.service'
$ rm -vf ~/.config/systemd/user/default.target.wants/openclaw-spike.service
$ systemctl --user daemon-reload                        # rc=0
$ systemctl --user reset-failed openclaw-spike.service
$ rm -rvf ./throwaway-state /tmp/oc-spike2-decoy
removed directory './throwaway-state'
removed '/tmp/oc-spike2-decoy/bus'
removed directory '/tmp/oc-spike2-decoy'
killed socat 1484725 ; no socat processes remain
$ loginctl disable-linger                               # rc=0, restores INITIAL_LINGER=no
```

Proof (`logs/cleanup-proof.txt`):

```
### WITNESS final-cleanup-proof (2026-07-26T04:40:08Z)
unit_file_exists=no
wants_symlink_exists=no
list-unit-files rc=1 out=UNIT FILE STATE PRESET//0 unit files listed.
LoadState=not-found ActiveState=inactive UnitFileState=
Linger=no                        ← restored to recorded initial state

$ ls -la /var/lib/systemd/linger/
total 0                          ← linger stamp file removed

$ systemctl --user list-unit-files 'openclaw*'
UNIT FILE STATE PRESET
0 unit files listed.             ← empty, as required

$ systemctl --user list-units --state=failed 'openclaw*'
                                 ← no failed leftovers

$ find $HOME /tmp -maxdepth 6 -name '*openclaw-spike*' -not -path '*/claude-1000/*'
(no results)                     ← no spike files outside the scratchpad

$ find <repo> -maxdepth 4 \( -name '*openclaw-spike*' -o -name 'applicator.sh' \)
(no results)                     ← repo worktree never touched
```

No sudo was used; the only privileged-adjacent state touched was the linger stamp
(created and removed via `loginctl`, which manages it as root on the user's
behalf).

## Verdict

**Spike 2: 3/3 assertions PASS.**

| Assertion | Lanes | Exit | Verdict |
| --- | --- | --- | --- |
| 1 — positive apply from non-interactive context | `P1-positive-final` | 0 | PASS |
| 2 — negative fails before mutation | `N1-linger-off` / `N2-bus-unreachable` / `N2b-dead-bus` | 10 / 20 / 20 | PASS |
| 3 — identity binding | `P1-positive-final` / `N3-identity-mismatch` / `N3b-identity-hostname` | 0 / 30 / 30 | PASS |

Fail-before-mutation ordering held in **6 of 6** non-applying runs (the five
negative lanes plus the accidental attempt-1 harness failure), each verified by an
independent before/after witness rather than by the applicator's own claim. The
SPEC decision *applicator contracts + identity binding* stands as written; no
Decision Log entry re-opens. Findings 1–3 above are contract refinements to carry
into implementation, and the session-less linger case is logged as a P1 follow-up
verification rather than a gauntlet gap.

## Redaction note (added at commit time)

Committed copies replace this workstation's `sha256(/etc/machine-id)` digests
with an 8-hex-character prefix plus `<sha256-redacted>`: the repo is public and
a stable machine-identity digest is both a fingerprinting surface and a
secret-scanner entropy trigger. The deliberately zeroed digest used by the
negative identity lane is retained verbatim. Unredacted evidence remains in the
operator-local backup (`~/.local/share/beep-spike-evidence/spike-2/`).
