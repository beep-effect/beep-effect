# Spike 2 — non-interactive user-manager apply

Gated decision: *applicator contracts + identity binding*
(`ops/handoffs/p0-gauntlet-contract.md` Spike 2).

Verdict: **PASS** — all three assertions demonstrated 2026-07-25 on the
workstation. The gated decision stands; no SPEC Decision Log revision needed.

## Pinned inputs

| Input | Value |
| --- | --- |
| Date (UTC) | 2026-07-25T08:44:54Z |
| Host / machine-id | `DankStation` / `0bffc9bc5a6b48928f1ab4794df5244b` |
| Target user / UID | `elpresidank` / `1000` |
| OS / kernel | CachyOS (Arch), Linux 7.1.3-2-cachyos |
| systemd | 261 (261.2-1-arch) |
| bash / jq | 5.3.15(1)-release / jq-1.8.2 |
| Non-interactive context | `env -i PATH=/usr/bin:/bin HOME USER LOGNAME setsid -w bash …` (no TTY; env keys logged per run) |
| Spike unit | `openclaw-spike.service` (`ExecStart=/usr/bin/sleep 300`, `WantedBy=default.target`) |
| Pre-spike state | `Linger=no`, no `openclaw-spike*` unit files |

Harness (disposable spike code, archived under [`harness/`](./harness/)):
`preflight.sh` (identity binding + linger + bus reachability, mutates
nothing), `apply.sh` (preflight-gated unit install / daemon-reload / enable /
start / stop), declared identity expectations `expected.json` /
`expected-bad.json` (machine-id mutated to `deadbeef…`).

## Assertions

| # | Contract assertion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Linger verifiable; with linger active, `XDG_RUNTIME_DIR` + user DBus bus reachable; `systemctl --user` daemon-reload / enable / start / stop all succeed non-interactively | PASS | [`logs/a1-positive-apply.log`](./logs/a1-positive-apply.log) |
| 2 | With linger disabled, preflight detects and fails BEFORE any mutation | PASS | [`logs/a2-negative-linger.log`](./logs/a2-negative-linger.log) |
| 3 | Identity binding: mutated expectation (machine-id) makes preflight fail before mutation | PASS | [`logs/a3-identity-mismatch.log`](./logs/a3-identity-mismatch.log) |

### A2 — negative: linger disabled (run first, pre-spike `Linger=no`)

```text
== context: tty=not a tty sid=2387730 env-keys=HOME,LOGNAME,PATH,PWD,SHLVL,USER,_,
PREFLIGHT-FAIL: linger not enabled for elpresidank (Linger=no)
apply exit: 78
unit-file-present=no          # zero mutation: no unit file, list-unit-files empty (exit 1)
```

### A3 — identity mismatch (linger enabled first, so identity is the only failing check)

Linger enable itself ran from the non-interactive context and needed no
root — polkit permits self-linger for an active session (`loginctl
enable-linger` exit 0). Applicator design note: from root, `loginctl
enable-linger <user>` is the robust equivalent.

```text
== context: tty=not a tty sid=2389712 env-keys=HOME,LOGNAME,PATH,PWD,SHLVL,USER,_,
PREFLIGHT-FAIL: machine-id mismatch: expected deadbeefdeadbeefdeadbeefdeadbeef, target is 0bffc9bc5a6b48928f1ab4794df5244b
apply exit: 78
unit-file-present=no          # zero mutation
```

### A1 — positive apply

```text
PREFLIGHT-OK machine=0bffc9bc5a6b48928f1ab4794df5244b host=DankStation uid=1000
  home=/home/elpresidank runtime=/run/user/1000 linger=yes manager=degraded tty=not a tty
== unit installed: /home/elpresidank/.config/systemd/user/openclaw-spike.service
== daemon-reload OK
Created symlink '…/default.target.wants/openclaw-spike.service' → '…/openclaw-spike.service'.
== enable OK
== start OK
== is-active: active
== stop OK
== is-active after stop: inactive
APPLY-OK
apply exit: 0
```

## Cleanup (part of the evidence — [`logs/cleanup.log`](./logs/cleanup.log))

Unit disabled and removed, `daemon-reload` re-run, `Linger` restored to `no`.
Post-state matches pre-spike state exactly: `Linger=no`,
`unit-file-present=no`, `list-unit-files 'openclaw-spike*'` empty.

## Caveats recorded for the applicator design

- The user had an active desktop session throughout, so `/run/user/1000`
  existed independently of linger; the survive-logout semantic of linger is
  asserted by systemd, not exercised here (exercising it would kill this
  session). The preflight checks the `Linger` flag explicitly — the condition
  the applicator depends on — plus bus reachability in the exact constructed
  env (`XDG_RUNTIME_DIR=/run/user/<uid>`,
  `DBUS_SESSION_BUS_ADDRESS=unix:path=…/bus`).
- `systemctl --user is-system-running` reports `degraded` on this host
  (unrelated failed user unit). Preflight accepts
  `running|degraded|maintenance|starting` as "reachable"; the real applicator
  should record the manager state it saw in its apply evidence.
- Preflight identity surface proven: machine-id + hostname + UID + user +
  home + runtime dir; failure exit code 78 (EX_CONFIG-style), mutation
  provably absent after both negative runs.
