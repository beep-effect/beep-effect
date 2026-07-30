# Spike-3 harness diagnosis (2026-07-26)

Deliverable for DIAG-REQUEST-2026-07-25.md. Authored by the Claude session
after the Codex path dead-ended on sandbox limits; empirical work ran inline
using Codex's repro assets. Raw evidence: `diag-repro/findings-2026-07-26.txt`
(experiment 1) and `diag-repro/findings2-2026-07-26.txt` (experiment 2), plus
first-run archives under `~/.cache/beep-p0-spike3-run/` and
`~/.cache/beep-p0-spike3.ZHmqsT/spike3/logs/`.

## Why Codex could not run this

Two attempts. First: the task sandbox rejects all writes outside the repo
cwd ("Read-only file system" on `mkdir ~/.cache/beep-p0-diag`). Second (with
the repo-local diag-repro path): the sandbox blocks the network layer —
`ss` fails with "Cannot open netlink socket: Operation not permitted" and
the gateway aborts with "gateway bind=loopback resolved to non-loopback
host 0.0.0.0; refusing fallback to a network bind". Codex stopped cleanly
and reported both times (job task-ms1jabmk-rid8ye, completed 08:28Z); the
repro requires real loopback networking, which only the interactive session
has. Codex's contribution stands: the repro assets (`gateway.json`,
`client.json`, `fake-resolver.sh`) were used unchanged in experiment 1 and
extended (value-file-driven resolver) in experiment 2.

## Failure 1 — a1 "cold-owner lacks an established loopback gateway socket"

Root cause: **the ACP CLI holds its gateway WebSocket in a CHILD process.**
Experiment 1, six samples over 30s: process tree `3614837 3614863`; the
ESTABLISHED loopback connection to :29473 (`0100007F:E01A->0100007F:7321
state=01`) is owned by the child (3614863) and is persistent. The original
check scanned only `/proc/$cold_pid/fd` (the parent), so it could never
find the socket; the case aborted before ever emitting ROTATE-NOW. H1
confirmed; H2 (non-persistent connection) refuted; H3 n/a.

Post-rotation assumptions all validated in experiment 2 (no further a1
edits needed):
- Reload via the old snapshot exits nonzero with "gateway closed (4001):
  gateway auth changed" — a1 already tolerates this.
- Reload via the new snapshot returns `{"ok":true,"warningCount":0}`.
- The cold owner's socket inode disappears ~1s after rotation+reload
  (gateway actively drops old-token connections — the contract's
  "no cold owner remains" behavior is real).
- Old-token probe fails with "unauthorized: gateway token mismatch"
  (matches a1's rejection grep); `gateway call health --json` is a valid
  subcommand and returns `"ok": true` for the new token.

## Failure 2 — a2 "failed reload lacks a secret-resolution failure signature"

Root cause: **wrong sink.** The resolution-failure detail never reaches CLI
stdout. Experiment 1, broken reference: CLI prints only "Could not reload
secrets because the Gateway did not respond: secrets.reload failed" (rc=1);
the gateway log receives the real signatures:
`⇄ res ✗ secrets.reload … errorCode=UNAVAILABLE`,
`[SECRETS_RELOADER_DEGRADED] SecretProviderResolutionError: Exec provider …`,
`secrets.reload failed: Exec provider …`. The original grep for
`resolve|1password|field|not found|does not exist` on CLI stdout was
unpassable even in a perfect run. Restore leg verified: after removing the
broken marker, reload returns `ok:true` (a2's restore assertions hold).

Reload semantics: `secrets reload` does NOT restart the gateway (same
listener pid/fd across baseline, broken, and restored reloads). The live
run's "gateway closed (1006)" CLI error and the SIGTERM-killed provider
("exited with code null") trace to the a1-failure fallout (setup restore
churn) plus runner cleanup timing, not to reload behavior; with a1 fixed,
the flow should match the repro's clean UNAVAILABLE surface. The repaired
a2 accepts both CLI surfaces.

## CHANGES

- `a1-rotate-same-ref.sh`: socket scan now walks the cold owner's process
  tree (children + grandchildren via `/proc/*/task/*/children`) instead of
  the parent's fd table only; the hardcoded `0100007F:4A57` local-address
  literal is replaced with hex computed from `$SPIKE3_PORT`.
- `a2-broken-ref.sh`: CLI-stdout assertion now checks the reload-failure
  surface (`secrets\.reload failed|Gateway did not respond`); the
  resolution signature (`SECRETS_RELOADER_DEGRADED|SecretProviderResolutionError`)
  is asserted on the aggregated alert sink (gateway log + state log +
  journal), ahead of the existing `secrets.reload failed` alert check.
- Both pass `bash -n`. No other harness files changed.

## RERUN-READINESS

Operator must install one fresh scoped service-account token (24h,
`beep-p0-spike3` vault read/write) at
`/etc/beep/openclaw-spike/op-service-account-token` (root:elpresidank,
0440) — the previous credential was consumed by the first cycle's cleanup.
The `spike3-rotating` item exists; the one-pass runner and its rotation
watcher are unchanged. Confidence: high — every assertion surface in a1/a2
now matches empirically observed OpenClaw 2026.7.1-2 behavior; the two
fixed checks were the only points of divergence, and every downstream
check was validated live in the repro.
