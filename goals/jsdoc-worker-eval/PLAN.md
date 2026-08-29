# JSDoc Worker Eval Plan

## Current Plan

The structural worker eval lane is implemented as `beep docgen
quality-worker-eval`. The remote GPU lane is implemented as `beep docgen
quality-worker-eval-runpod`, and a one-packet live Runpod smoke has completed
successfully. The follow-up 10-packet Runpod/Phoenix evidence run is also
recorded.

The first local-provider run is complete as a negative host-suitability result:
`qwen3-coder:30b` runs CPU-only on this RTX 3070 8 GiB workstation and is not a
practical interactive worker target.

The hosted proof completed a three-packet Codex baseline using
`gpt-5.4-mini` with low reasoning.

## Phase Posture

| Phase | Status | Purpose | Output |
|---|---|---|---|
| P0 | Complete | Bootstrap initiative packet. | `README.md`, `SPEC.md`, `PLAN.md`, `research/`, `history/outputs/`, `ops/manifest.json` |
| P1 | Complete | Verify Codex SDK and provider command feasibility. | `quality-worker-eval` supports `codex`, `ollama`, and `lmstudio` provider selection |
| P2 | Complete | Define and implement read-only eval report shape and command plan. | Schema-versioned JSON eval report |
| P3 | Complete | Run provider-backed worker sample. | `qwen3-coder:30b` host evidence and aborted eval notes |
| P4 | Complete | Decide graduation posture. | Keep workers read-only and experimental |
| P5 | Complete | Run hosted Codex low-reasoning baseline. | Three-packet `gpt-5.4-mini` JSON report and research note |
| P6 | Evidence complete | Run `qwen3-coder:30b` on an ephemeral Runpod Ollama pod and optionally export sanitized spans to Phoenix. | `quality-worker-eval-runpod`, Runpod/Phoenix runbook, one-packet smoke JSON, 10-packet live JSON evidence |

## Implementation Direction

- Keep implementation in `@beep/repo-cli` under `beep docgen`.
- Keep deterministic `beep docgen quality` as the authoritative queue.
- Use `@openai/codex-sdk`; do not add direct provider HTTP clients.
- Require explicit `--provider` and `--model`.
- Require explicit `--confirm-runpod-eval` before creating a billable Runpod
  pod.
- Default hosted Codex reasoning effort to `low`; do not default the provider.
- Emit JSON artifacts only.
- Run packet turns sequentially and keep them read-only.
- Do not use `qwen3-coder:30b` as the default local eval model on this host.
- For remote Qwen proof, require `--model qwen3-coder:30b`, use Ollama, prefer
  48 GiB Runpod GPUs, and delete the pod by default.
- Bootstrap fallback-image pods with deterministic DNS setup, `zstd`, Ollama,
  and HTTP `/api/pull` model loading before readiness checks.
- Route Ollama Codex SDK calls to the pod's OpenAI-compatible `/v1` URL.
- Phoenix export is opt-in with `--otlp` and emits summary plus hashed packet
  spans only.

## Provider-Backed Evidence Commands

The source report used for the attempted run:

```sh
bun run beep docgen quality --all --json --score codex --packet-limit 50 --output <scratch-dir>/beep-jsdoc-quality-all-2026-05-12.json
```

The attempted local-provider eval used the pre-genericized command name:

```sh
bun run beep docgen quality-local-eval --input <scratch-dir>/beep-jsdoc-quality-all-2026-05-12.json --provider ollama --model qwen3-coder:30b --packet-limit 10 --output goals/jsdoc-local-worker-eval/history/outputs/2026-05-12-ollama-qwen3-coder-30b-local-eval.json
```

The eval was stopped after the local model caused interactive slowdown. No
`quality-worker-eval` JSON report was produced. The retained evidence is the
curated research note plus host evidence JSON.

The hosted baseline command:

```sh
bun run beep docgen quality-worker-eval --all --provider codex --model gpt-5.4-mini --reasoning-effort low --packet-limit 3 --output goals/jsdoc-worker-eval/history/outputs/2026-05-12-codex-gpt-5.4-mini-low-worker-eval.json
```

The hosted baseline completed three selected packets as candidate drafts with
zero reported policy violations in about 27.3 seconds.

The successful Runpod smoke command, with the OTLP endpoint provided by
`BEEP_OTLP_BASE_URL`:

```sh
RUNPOD_API_KEY="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_RUNPOD_API_KEY')" \
BEEP_OTLP_BASE_URL="${BEEP_OTLP_BASE_URL:?set BEEP_OTLP_BASE_URL}" \
  bun run beep docgen quality-worker-eval-runpod --input <saved-source-quality-report.json> --provider ollama --model qwen3-coder:30b --packet-limit 1 --otlp --otlp-base-url "$BEEP_OTLP_BASE_URL" --otlp-project beep-jsdoc-worker-eval --confirm-runpod-eval --skip-template-search --readiness-timeout-ms 2700000 --output goals/jsdoc-worker-eval/history/outputs/2026-05-16-runpod-ollama-qwen3-coder-30b-worker-eval-smoke-v2.json
```

The Runpod smoke completed one selected packet as a candidate draft with zero
reported policy violations. Cleanup completed, Phoenix exported two spans, and
no eval pods remained afterward. Runtime was about 16.6 minutes because the
ephemeral pod cold-pulled the 18.6 GB model.

The reproducible 10-packet Runpod evidence command:

```sh
bun run beep docgen quality --all --json --score codex --packet-limit 25 --output goals/jsdoc-worker-eval/history/outputs/2026-05-16-source-quality-codex-packets-10-packet.json
```

```sh
RUNPOD_API_KEY="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_RUNPOD_API_KEY')" \
BEEP_OTLP_BASE_URL="${BEEP_OTLP_BASE_URL:?set BEEP_OTLP_BASE_URL}" \
  bun run beep docgen quality-worker-eval-runpod \
    --input goals/jsdoc-worker-eval/history/outputs/2026-05-16-source-quality-codex-packets-10-packet.json \
    --provider ollama \
    --model qwen3-coder:30b \
    --packet-limit 10 \
    --otlp \
    --otlp-base-url "$BEEP_OTLP_BASE_URL" \
    --otlp-project beep-jsdoc-worker-eval \
    --confirm-runpod-eval \
    --skip-template-search \
    --readiness-timeout-ms 2700000 \
    --output goals/jsdoc-worker-eval/history/outputs/2026-05-16-runpod-ollama-qwen3-coder-30b-worker-eval-10-packet.json
```

The source report covered 79 packages, 6776 quality subjects, and 25 capped
remediation packets. The Runpod eval selected 10 packets; all 10 completed as
candidate drafts, with no failures, no timeouts, cleanup stop/delete completed,
and Phoenix exporting 11 spans. The wrapper runtime was about 7.7 minutes. The
nested worker report included `missing-example` policy violations, so the
result remains read-only evidence rather than remediation approval.

## Follow-Up Recommendation

Keep worker eval read-only. This packet now has enough Runpod evidence to close
the read-only worker-eval question as a reference packet. Future work should
move to separate planning for cache/template cost reduction, human draft
review, or write-mode auto-remediation. Auto-remediation remains out of scope
until accepted precision, cost, runtime, and policy-preservation thresholds are
defined and met.

## Verification Commands

- `bun run --filter @beep/repo-cli test`
- `bun run --filter @beep/repo-cli check`
- `bun run --filter @beep/repo-cli lint`
- `git diff --check`

Provider installation itself is not required for ordinary repo quality checks.
