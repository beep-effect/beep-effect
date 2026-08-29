# Ingestion Secret Scrub

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver the pre-LLM secret scrub: a narrow `@beep/file-processing` transform
that turns authorized extracted text into sanitized, prompt-gated output with
non-secret proof and honest coverage/residue status.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ingestion-secret-scrub/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited implementation provenance.
6. [`history/`](./history/) - evidence and closeouts, when present.
7. [`ingestion-security-secret-governance`](../../explorations/ingestion-security-secret-governance/README.md) - source exploration.

## Current Phase

P0 Pattern-bank consolidation audit: inventory and deduplicate both live
redaction banks, choose and version one canonical bank, and establish the
fixture corpus before implementation.

## Latest Evidence

Not started.

## Notes

Injection findings are the next gated increment. PII/OOXML, sanitizer, guarded
fetch, resolver, and credential vault work remain outside this packet.
