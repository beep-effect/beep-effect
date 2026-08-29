# JSDoc Worker Eval

## Status

Lifecycle: `completed-retained`

P0-P6 implementation complete; Runpod Qwen 10-packet evidence complete

On-demand reflection:
[`history/reflections/2026-08-29-codex.md`](./history/reflections/2026-08-29-codex.md).

## Overview

This initiative evaluates whether Codex SDK orchestration can route existing
JSDoc quality remediation packets to a read-only worker, including hosted Codex
models and local Qwen-style models through Ollama or LM Studio, without making
model judgment the source of truth.

The implemented local/hosted v1 command is read-only:

```sh
bun run beep docgen quality-worker-eval --input quality.json --provider codex --model <model-id>
```

It consumes `beep docgen quality --score codex` remediation packets, asks a
Codex SDK worker for advisory scoring and draft JSDoc, and emits JSON. It does
not edit source files.

The remote GPU path is also read-only:

```sh
RUNPOD_API_KEY="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_RUNPOD_API_KEY')" \
  bun run beep docgen quality-worker-eval-runpod --all --provider ollama --model qwen3-coder:30b --confirm-runpod-eval
```

It creates an ephemeral Runpod pod, boots Ollama, routes Codex SDK traffic to
the pod, emits a wrapper JSON report, and stops/deletes the pod unless
`--keep-pod` is passed for debugging.

The first live Runpod smoke completed one repo-wide packet with
`qwen3-coder:30b` on an ephemeral 48 GiB GPU pod. The packet completed as a
candidate draft with zero reported policy violations, Phoenix exported two
spans, and pod cleanup completed. The run used a saved source-quality report
as packet input. This proves the remote path can run end-to-end, but it does
not graduate auto-remediation or prove the cost/quality profile for larger
samples.

The follow-up Runpod evidence run completed a reproducible 10-packet sample
from a committed source-quality report. All ten selected packets completed as
candidate drafts with no failed or timed-out packets, cleanup completed, and
Phoenix exported eleven spans. Two packet drafts reported `missing-example`
policy codes, so the result closes the read-only evidence gap but still does
not graduate write-mode remediation.

The first local-provider run proved the plumbing but not the worker value:
Ollama 0.23.2 successfully pulled `qwen3-coder:30b`, then ran it CPU-only on
the local RTX 3070 workstation. The run caused visible workstation slowdown and
was stopped before a 10-packet report completed. Treat this model/host pairing
as unsuitable for interactive worker eval.

The hosted Codex baseline completed three repo-wide packets with
`gpt-5.4-mini` at low reasoning in about 27.3 seconds. All three worker turns
completed as candidate drafts with zero reported policy violations.

## Read This First

- [SPEC.md](./SPEC.md) - authoritative eval contract
- [PLAN.md](./PLAN.md) - current rollout plan and phase state
- [research/2026-05-12-ollama-qwen3-coder-30b-host-eval.md](./research/2026-05-12-ollama-qwen3-coder-30b-host-eval.md) - local-provider host outcome
- [research/2026-05-12-codex-gpt-5.4-mini-low-worker-eval.md](./research/2026-05-12-codex-gpt-5.4-mini-low-worker-eval.md) - hosted Codex baseline
- [research/2026-05-16-runpod-ollama-qwen3-coder-30b-worker-eval.md](./research/2026-05-16-runpod-ollama-qwen3-coder-30b-worker-eval.md) - Runpod command/runbook and smoke-proof evidence
- [research/2026-05-16-runpod-ollama-qwen3-coder-30b-worker-eval-10-packet.md](./research/2026-05-16-runpod-ollama-qwen3-coder-30b-worker-eval-10-packet.md) - reproducible 10-packet Runpod/Phoenix evidence
- [history/outputs/](./history/outputs) - raw worker-model evidence worth preserving
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing

## Operating Rules

- Keep worker runs read-only.
- Treat deterministic `beep docgen quality` findings as the source of truth.
- Treat worker output as draft evidence until a human accepts it.
- Require explicit `--provider` and `--model`; do not hide API spend or local
  hardware load behind defaults.
- Use hosted Codex as the first low-cost baseline; use Ollama or LM Studio only
  when a caller deliberately selects a local provider.
- Do not use `qwen3-coder:30b` as the default eval model on this 8 GiB VRAM
  workstation; it runs CPU-only and degrades interactivity.
- Use Runpod for `qwen3-coder:30b` proof runs; prefer 48 GiB GPUs, allow 24 GiB
  fallback only with explicit operator consent.
- Expect cold Runpod/Ollama pulls to dominate runtime unless a prebuilt image
  or persistent model cache is introduced.
- Pass `RUNPOD_API_KEY` through the environment. The CLI never reads
  1Password references directly.
- Use `--otlp --otlp-base-url "$BEEP_OTLP_BASE_URL"` when the live proof should
  appear in the Phoenix UI.
- Do not make worker findings blocking.
- Do not unblock write-mode remediation until accepted precision, cost, runtime,
  and policy-preservation evidence exists.
