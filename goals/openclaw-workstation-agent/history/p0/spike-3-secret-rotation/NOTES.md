# Spike 3 — same-reference rotation/reload

Gated decision: *secrets bootstrap exception + rotation surface*
(`ops/handoffs/p0-gauntlet-contract.md` Spike 3).

Verdict: **PASS — 3 of 3 assertions**, demonstrated in a single uninterrupted
cycle on 2026-07-27 ([`run-final-2026-07-27/`](./run-final-2026-07-27/)):
`a1=0 a2=0`, every assertion `ASSERT-PASS`, and all 13 cleanup checks green.
The secrets bootstrap exception and the rotation surface are supported: a
scoped `OP_SERVICE_ACCOUNT_TOKEN` delivered as a root-owned systemd
credential resolves `op://` references at runtime, rotation behind an
unchanged reference evicts stale owners, degraded reloads alert, and both
tied probes succeed after reload.

## Pinned inputs

| Input | Value |
| --- | --- |
| Date / host | 2026-07-27 / `DankStation` |
| OpenClaw | `openclaw@2026.7.1-2` (staged, user-space) |
| Node | `v24.16.0` |
| Unit / port | `openclaw-spike.service` / loopback `19031` |
| Spike root | `/etc/beep/openclaw-spike/<hash>/`, root-owned; credential `op-service-account-token` `0440 root:elpresidank`, delivered via systemd `LoadCredential` |
| Rotating secret | `op://beep-p0-spike3/spike3-rotating/password` |
| Telegram secret | `op://beep-p0-spike3/spike3-telegram/password` — a COPY of the throwaway bot token inside the disposable vault, so the spike service account never holds read scope on the real secrets vault |
| Model provider | local ollama `gemma3:4b`, tools denied, `num_ctx`/`contextTokens` 32768 |
| Reload event | `957f1e5aaf3f942d3fa00dc1`; rotation `cf5bcbd0` → `6c9c6b13` |

Harness archived under [`harness/`](./harness/) at its final revision with the
one-pass runner [`harness/run-spike3-full.sh`](./harness/run-spike3-full.sh).
Empirical diagnosis behind the repairs:
[`DIAGNOSIS-2026-07-26.md`](./DIAGNOSIS-2026-07-26.md). Superseded partial
cycles are kept under [`run3-2026-07-26/`](./run3-2026-07-26/) and
[`run-attempts/`](./run-attempts/).

## Assertions

| # | Contract assertion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Rotate the value behind the SAME `op://` reference, revoke the old value, run `secrets reload`: no stale or cold owner remains on the revoked value | **PASS** | Cold owner established on the pre-rotation snapshot (`cold-owner-connected=acp socket-inode=222804303`), evicted after the tied reload (`cold-owner-disconnected=yes client-terminated=yes socket-inode-absent=222804303`); `ASSERT-PASS: current snapshot clean; cold owner disconnected; old auth rejected; new auth accepted` ([`run-final-2026-07-27/logs/a1-rotate.log`](./run-final-2026-07-27/logs/a1-rotate.log), [`.../a1-old-token-probe.log`](./run-final-2026-07-27/logs/a1-old-token-probe.log), [`.../a1-new-token-probe.log`](./run-final-2026-07-27/logs/a1-new-token-probe.log)) |
| 2 | Deliberately break the reference: the degraded-reload alert path fires | **PASS** | `ASSERT-PASS: broken reference caused causal reload failure and alert` with `[SECRETS_RELOADER_DEGRADED] SecretProviderResolutionError` in the gateway sink, then `ASSERT-PASS: exact op:// reference restored and current` ([`run-final-2026-07-27/logs/a2-broken-ref.log`](./run-final-2026-07-27/logs/a2-broken-ref.log), [`.../a2-failed-reload-alert.log`](./run-final-2026-07-27/logs/a2-failed-reload-alert.log)) |
| 3 | Tied to the rotation event (not independent of it): an authenticated model completion AND a Telegram probe both succeed after reload | **PASS** | Both tied to reload event `957f1e5aaf3f942d3fa00dc1`. Completion returned exactly `SPIKE3_MODEL_OK` (`stopReason=stop`, `aborted=false`) and was gateway-served (`gateway-served-completion runId=15a60d83-…`, matched in the gateway's own log). Telegram probe: `accountId=default probe.ok=true botUser=beep_ip_bot elapsedMs=329`, no `lastError`/`probe.error`/`probe.failure` ([`.../a3-probes.log`](./run-final-2026-07-27/logs/a3-probes.log), [`.../a3-model-selected.json`](./run-final-2026-07-27/logs/a3-model-selected.json), [`.../a3-telegram.json`](./run-final-2026-07-27/logs/a3-telegram.json)) |
| — | Cleanup returns the machine to pre-spike state | **PASS** | All 13 checks including `credential removed`, `pre-existing /etc/beep metadata preserved`, `zero Spike 3 processes`, and `real ~/.openclaw inventory byte-identical` ([`.../cleanup.log`](./run-final-2026-07-27/logs/cleanup.log)) |

Secret hygiene: every archived evidence file passes the harness scan
(`log-scan label=rotated-gateway plaintext=absent token-shapes=absent`); no
secret value ever entered argv, tracked files, or logs.

## Operational findings for the implementation phases

- **The bootstrap credential is single-use per cycle.** Cleanup consumes it
  by design, so each cycle needs its own scoped service account; creating one
  requires an interactive 1Password approval. Any automated redeploy path must
  treat credential provisioning as an operator-gated step.
- **`secrets reload` does not restart the gateway** (same listener PID across
  baseline, degraded, and restored reloads), but it DOES drop connections
  authenticated with the pre-rotation value — the desired eviction behavior,
  and a client-visible disconnect that callers must tolerate.
- **Rotation evicts stale owners within ~1s** of the reload.
- **Transient 1Password 5xx faults happen** (one aborted an otherwise-good
  cycle and consumed its credential). The resolver now retries 5xx up to three
  times with backoff while every other failure — including a deliberately
  broken reference — still fails fast on the first attempt.

## Isolation deviation (disclosed)

During an earlier session a spike-3 preflight ran while spike-1 state was
present on the shared `/etc/beep/openclaw-spike` root, violating the
mutual-exclusion rule the contract records. No assertion evidence in this
NOTES comes from that overlap — every result above is from the 2026-07-27
cycle, which ran alone with the root verified empty at preflight and restored
at cleanup. The runner now parks the spike-3 credential outside the shared
root whenever spike 1 runs, so the deviation is not reachable by the current
tooling.

## Harness defects found and repaired during live execution

All were harness-vs-reality mismatches; OpenClaw behaved correctly throughout.
Each fix was validated against captured evidence before the next cycle.

| # | Symptom | Root cause → fix |
| --- | --- | --- |
| 1 | a1 aborted before the rotation cue: "cold-owner lacks an established loopback gateway socket" | The ACP CLI holds its gateway WebSocket in a CHILD process; the scan only walked `/proc/$cold_pid/fd`. Now walks the process tree; the hardcoded `0100007F:4A57` literal is computed from `$SPIKE3_PORT`. |
| 2 | a2: "failed reload lacks a secret-resolution failure signature" | The resolution detail never reaches CLI stdout — the CLI reports only the reload-failure surface while `SECRETS_RELOADER_DEGRADED` lands in the gateway log. Assertions re-pointed at the correct sinks. |
| 3 | a1 restore, a2 preflight, and cleanup all failed: "symlink found in Spike 3 scratch" | The gateway legitimately links `state/plugin-skills/*` into the staged package. The guard now permits exactly that shape and still refuses every other symlink. |
| 4 | Model probe: "provider rejected the request schema or tool payload" | Two independent environment facts: `gemma3:4b` rejects tool payloads, and ollama's default 4096-token context left the ~9.3k-token prompt one token of headroom (`in=4095 out=1 stopReason=length`). Config now denies tools for the probe and sets `params.num_ctx` + `contextTokens` to 32768. |
| 5 | "completion failed the pinned gateway payload schema" | The check required a `transport` field this build never emits. Replaced with pinned payload text + `stopReason`/`aborted`, plus gateway-log proof of transport. A jq `//` gotcha (`false // true` → `true`) in the same check was fixed alongside. |
| 6 | "completion was not served over the authenticated gateway socket" | The `[ws] ⇄ res ✓ agent` acknowledgement is emitted nondeterministically (present run 3, absent run 6 for an identical successful completion). The check now also accepts the gateway's `[agent] run <id> ended with stopReason=` line — a `--local` turn never reaches that file at all. |
| 7 | a3 reported `ASSERT-BLOCKED: operator-created Telegram reference was absent at setup` | The one-pass runner never exported `SPIKE_TG_OP_REF`/`SPIKE_TG_GROUP_ID`, so setup rendered a Telegram-less config. Runner now exports both, pointing at the disposable-vault token copy. |
| 8 | A transient `Server: (500)` from 1Password aborted a cycle and consumed its credential | Resolver now retries 5xx (3 attempts, backoff); all other failures still fail fast on attempt one so the a2 broken-reference assertion stays honest. |
