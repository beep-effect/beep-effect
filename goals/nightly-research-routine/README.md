# Nightly Research Routine

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

Delivery: **P0 Docs & Governance only.** The hosted routine, nightly CLI,
handoff receiver, local verifier, publisher, and timers are planned and have
not shipped.

## Mission

Ship an unattended hybrid nightly research routine whose hosted Grok Bot
search/writer front half produces typed capability results, whose blinded local
Sol/Luna lane verifies evidence and checkout facts, and whose deterministic
local publisher lands sanitized, novelty-gated packets under top-level
`research/` as mergeable PRs with per-packet claims truth and
machine-proposes/human-admits actioning.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/nightly-research-routine/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) — normative source of truth (all grilled decisions).
3. [`PLAN.md`](./PLAN.md) — phased execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) — machine-readable routing.
5. [`research/README.md`](../../research/README.md) — the output surface's
   conventions and laws.
6. `standards/architecture/DECISIONS.md` (2026-08-08 entry) — the layout and
   governance decision this packet implements.

## Observed Primitives (not an assembled runtime)

The following 2026-08-08 experiments proved individual local mechanisms. They
do not mean a nightly command, timer, or publisher exists. The 2026-09-03
hosted research front half also produced five partial packets with 106 claims
and 101 suggested actions; those packets do not prove local verification or
publication.

- `grok -p "…" --output-format streaming-json --no-auto-update` fires
  backend-hosted XSearch on the SuperGrok subscription pool and returns
  canonical dated x.com URLs with engagement metrics. A non-empty `--tools`
  allowlist silently disables XSearch; `--disable-web-search` does not.
- CLIProxyAPI `xai.inject-x-search: true` (enabled, hot-reloads) injects
  native `x_search` into every xAI-routed request: headless
  `claude --model grok-4.5 -p` sessions — and `grok-4.5` Workflow children —
  perform server-side X search invisibly to the harness.
- Nested/headless proxy invocations require a scrubbed environment
  (`env -i … ANTHROPIC_BASE_URL=http://127.0.0.1:8317 ANTHROPIC_AUTH_TOKEN=…`);
  parent-session env leakage manifests as `401 Invalid API key`.

## Scope Boundary — read before starting

The routine **proposes**; the human **admits and merges**. Nothing in this
packet may auto-merge research PRs, let a hosted connector open a PR, place
1Password or publisher authority on the shared Bot VM, write to
`explorations/INBOX.md` or `goals/`, hand raw scraped bytes to a writer or
verifier, or weaken the verified handoff, sanitize-at-write, blinding, or
single-writer-ledger laws for convenience.
The v2 experiments (claim-tuple thymus, trend-futures contracts) are gated —
thymus behind the backfill go/no-go, contracts capped at ~20 open positions.
