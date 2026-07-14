# Ingestion Security + Secret/PII Governance

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Every counterparty document, scraped opinion, and user-supplied URL crossing
into beep is adversarial input, and every provider key plus privileged span is
a leak waiting to happen — this wedge gathers the defensive ingestion gate
(prompt-injection detection, SSRF hardening, secret/PII scrub-before-LLM,
failed-redaction x-ray) and the secret-governance spine (ordered resolution
chain + per-user vault) that today have no home.

## Next Open Question

Five candidates remain gated: `ingestion-injection-findings` behind the scrub;
`safe-html-sanitization` behind the browser-carrier spike;
`guarded-remote-fetch` behind the rebinding harness;
`secret-resolution-contract` behind multi-consumer incubation; and
`per-user-credential-vault` behind the threat-model spike (with its ownership
model now ratified).

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — full provenance ledger joining
every decision to its mined gold nugget (upstream repo + `file:line`), upstream
license + port discipline, the external research citation, and the composed
`@beep/*` capability. Derived from the gold-intake cluster
"Ingestion security + secret/PII governance" (10 nuggets).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-14: graduate — shape ratified the appetite and all nine policy blocks
  as drafted after all eight align decisions locked;
  [`ingestion-secret-scrub`](../../goals/ingestion-secret-scrub/README.md)
  graduated while five gated candidates remain queued.
- 2026-07-14: align closed — all eight decisions locked; first slice reordered to pre-LLM secret scrub; BRIEF.md and MAP.md drafted for shape sign-off with five explicit spike/ownership deferrals.
- 2026-07-11: cross-reference — `goals/llm-provider-subscription-auth` (partial graduation from sibling `multi-provider-llm-dispatch-fallback`) ships subscription auth via vendor-CLI delegation and stores no tokens, so this packet's per-user vault question (Q1) is unaffected and stays parked here.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Ingestion security + secret/PII governance' (10 nuggets).
