# Spike 3 — same-reference rotation/reload

Gated decision: *secrets bootstrap exception + rotation surface*
(`ops/handoffs/p0-gauntlet-contract.md` Spike 3).

Verdict: **INTERIM — assertions 1 and 2 PASS; assertion 3 PARTIAL.** The
rotation, degradation, and reload surfaces are demonstrated on live evidence
from the 2026-07-26 cycle ([`run3-2026-07-26/`](./run3-2026-07-26/)). The
model-completion half of assertion 3 succeeded at runtime but was rejected by
a harness check that pinned a response field this OpenClaw build does not
emit; that check has been repaired and validated against the captured
response, and the Telegram probe half has not yet executed. One more
uninterrupted cycle — blocked only on a fresh bootstrap credential — closes
the spike.

## Pinned inputs

| Input | Value |
| --- | --- |
| Date / host | 2026-07-26 / `DankStation` |
| OpenClaw | `openclaw@2026.7.1-2`; staged package SHA-256 `4034a491f5fb31b20b8f16fe29a88e1782be4b70f4aeed0df43c09ce24b147a5` ([`run3-2026-07-26/logs/setup.log`](./run3-2026-07-26/logs/setup.log)) |
| Node | `v24.16.0` |
| Unit / port | `openclaw-spike.service` / loopback `19031` |
| Spike root | `/etc/beep/openclaw-spike/<hash>/`, root-owned; credential `op-service-account-token` `0440 root:elpresidank` |
| Rotating secret | `op://beep-p0-spike3/spike3-rotating/password` (disposable vault + item) |
| Model provider | local ollama `gemma3:4b` at `127.0.0.1:11434` |

Harness archived under [`harness/`](./harness/) at its final revision, with
the one-pass runner [`harness/run-spike3-full.sh`](./harness/run-spike3-full.sh).
Empirical diagnosis of the harness defects is in
[`DIAGNOSIS-2026-07-26.md`](./DIAGNOSIS-2026-07-26.md).

## Assertions

| # | Contract assertion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Rotate the value behind the SAME `op://` reference, revoke the old value, reload: no stale or cold owner remains on the revoked value | **PASS** | Cold owner established on the pre-rotation snapshot (`cold-owner-connected=acp socket-inode=158350763`), then dropped after the tied reload (`cold-owner-disconnected=yes client-terminated=yes socket-inode-absent=158350763`); current-snapshot reload clean, old auth rejected, new auth accepted ([`run3-2026-07-26/logs/a1-rotate.log`](./run3-2026-07-26/logs/a1-rotate.log), [`.../a1-old-token-probe.log`](./run3-2026-07-26/logs/a1-old-token-probe.log), [`.../a1-new-token-probe.log`](./run3-2026-07-26/logs/a1-new-token-probe.log)) |
| 2 | Deliberately break the reference: the degraded-reload alert path fires | **PASS** | `ASSERT-PASS: broken reference caused causal reload failure and alert`; degraded alert `[SECRETS_RELOADER_DEGRADED] SecretProviderResolutionError` in the gateway sink, then `ASSERT-PASS: exact op:// reference restored and current` ([`run3-2026-07-26/logs/a2-broken-ref.log`](./run3-2026-07-26/logs/a2-broken-ref.log), [`.../a2-failed-reload-alert.log`](./run3-2026-07-26/logs/a2-failed-reload-alert.log)) |
| 3 | Tied to the rotation event: an authenticated model completion AND a Telegram probe both succeed after reload | **PARTIAL** | Completion succeeded and is tied to the rotation event (`tied-event old-sha256-prefix=59df7cc1 …`): the response carries exactly `SPIKE3_MODEL_OK` with `stopReason=stop`, and the gateway's own WS line proves it was gateway-served (`⇄ res ✓ agent runId=c3137700-…`) ([`run3-2026-07-26/logs/a3-model.json`](./run3-2026-07-26/logs/a3-model.json), [`.../gateway.log`](./run3-2026-07-26/logs/gateway.log)). The harness rejected it on a phantom field (below) and therefore never reached the Telegram probe. |
| — | Cleanup returns the machine to pre-spike state | **PASS** | All 12 cleanup checks pass including `credential removed`, `pre-existing /etc/beep metadata preserved`, and `real ~/.openclaw inventory byte-identical` ([`run3-2026-07-26/logs/cleanup.log`](./run3-2026-07-26/logs/cleanup.log)) |

## Isolation deviation (disclosed)

During an earlier session a spike-3 preflight ran while spike-1 state was
present on the shared `/etc/beep/openclaw-spike` root, violating the
mutual-exclusion rule the contract records. No spike-1 assertion evidence was
produced from that overlap, and every assertion above comes from the
2026-07-26 cycle, which ran alone with the root verified empty at preflight
and restored at cleanup. Subsequent cycles serialize the two spikes and park
the spike-3 credential outside the shared root whenever spike 1 runs, so the
deviation is not reachable by the current runner.

## Harness defects found and repaired (all validated against captured evidence)

| # | Symptom | Root cause → fix |
| --- | --- | --- |
| 1 | a1 aborted before the rotation cue: "cold-owner lacks an established loopback gateway socket" | The ACP CLI holds its gateway WebSocket in a CHILD process; the scan only walked `/proc/$cold_pid/fd`. Now walks the process tree, and the hardcoded `0100007F:4A57` literal is computed from `$SPIKE3_PORT`. |
| 2 | a2: "failed reload lacks a secret-resolution failure signature" | The resolution detail never reaches CLI stdout — the CLI reports only the reload-failure surface while `SECRETS_RELOADER_DEGRADED` lands in the gateway log. Assertions re-pointed at the correct sinks. `secrets reload` was also confirmed NOT to restart the gateway. |
| 3 | a1 restore, a2 preflight, and cleanup all failed with "symlink found in Spike 3 scratch" | The gateway legitimately links `state/plugin-skills/*` into the staged package. The guard now permits exactly that shape and still refuses every other symlink. |
| 4 | Model completion command failed: "provider rejected the request schema or tool payload" | Two independent environment facts: `gemma3:4b` rejects tool payloads, and ollama's default 4096-token context left the ~9.3k-token prompt one token of headroom (`in=4095 out=1 stopReason=length`). Config now denies tools for the probe and sets `params.num_ctx` + `contextTokens` to 32768. |
| 5 | "completion failed the pinned gateway payload schema" | The check required a `transport` string field this build never emits (its `executionTrace.runner` is always `embedded` — the agent runs inside the gateway). Replaced with a stronger binding: pinned payload text plus `stopReason`/`aborted`, then the gateway's own `res ✓ agent runId=<id>` line as proof of authenticated gateway transport. A jq `//` gotcha (`false // true` → `true`) in the same check was fixed alongside. |

## Remaining work

One uninterrupted cycle with a fresh scoped bootstrap credential installed at
`/etc/beep/openclaw-spike/op-service-account-token` (24h, `beep-p0-spike3`
read/write) — cleanup consumes the credential by design, so each cycle needs
its own. Creating one requires an interactive 1Password desktop approval.
With that in place the repaired a3 leg should complete both halves of
assertion 3 and the spike closes; the Telegram probe is the only contract
surface with no archived result yet.
