# Secure Document Delivery

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver an incubated, provider-neutral secure-document-delivery capability and
authenticated desktop route, proven end to end by one authorized,
fixture-backed USPTO office-action PDF.

## Launch

```text
/goal follow the instructions in goals/secure-document-delivery/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative contract.
3. [`PLAN.md`](./PLAN.md) - active execution plan and spikes.
4. [`ops/manifest.json`](./ops/manifest.json) - routing and live-fetch blocker.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance.
6. [`secure-document-download-proxy`](../../explorations/secure-document-download-proxy/README.md) - source exploration.

## Current Phase

P0 Threat model and packaged-keyring proof: settle envelope tamper,
known-answer, AAD/version, rotation, packaged custody, webview HTTP, and
Range/HEAD behavior before P1 freezes public contracts.

## Latest Evidence

Not started.

## Notes

Fixture-backed delivery may proceed. Live provider fetch is blocked by the
ingestion-security guarded-fetch DNS-rebinding harness. The capability remains
incubated until two real importers prove its promotion seam.
