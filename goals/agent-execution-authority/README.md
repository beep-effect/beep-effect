# Agent Execution Authority

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give the MCP agent surface a default-deny authority boundary and a hash-chained,
append-only record of every decision and outcome — so the repo can say what an
agent was permitted to do, and show what it did.

Graduated 2026-07-25 from
[`explorations/agent-execution-sandbox`](../../explorations/agent-execution-sandbox/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agent-execution-authority/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan, PRs 1-7.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger inherited
   from the exploration.
6. [`history/`](./history/) - evidence and closeouts.

## Current Phase

**P0 Research.** Next concrete action: re-verify the two 2026-07-25 spike
findings against current `main` — that `Layer.succeed(FetchHttpClient.Fetch)`
reaches through drivers sealing their own transport, and that plpgsql
`BEFORE UPDATE`/`BEFORE DELETE` triggers work in PGlite. Then start PR 1.

## Latest Evidence

Not started. The spike that de-risked this packet was run and deleted on
2026-07-25; its findings are recorded in
[`explorations/agent-execution-sandbox/README.md`](../../explorations/agent-execution-sandbox/README.md)
under "Proven Mechanisms."

## Notes

High-signal constraints that do not belong in the normative spec:

- **This is not a sandbox.** It buys the policy plane and its records. Host
  isolation is a separate candidate packet, and a green suite here must never be
  described as "the sandbox exists."
- **Two spike findings are load-bearing and one is only half-proven.** The
  `Fetch` override was verified for a *directly-provided* effect, not through a
  server whose handler context is captured at layer build
  (`SanitizedSpan.ts:226`). PR 6 carries a blocking check for this.
- **PR 6 ships an exfiltration primitive to justify its own control.**
  `ontology_publish_provenance` is default-off and allowlist-gated, which is what
  makes it defensible — but re-read that scope deliberately rather than
  inheriting it.
- **The `audience` axis is half-degenerate in v1.** Only `external-network` is
  genuinely exercised; every governed MCP write is a local workspace file. Do not
  claim the axis is validated.
- **Known drift, recorded and not fixed here:**
  `apps/professional-desktop/src/chat/UsageRecordSink.ts` puts an epistemic
  product repository in app code, against `03-driver-boundaries.md:151-153`. The
  ledger must not copy it.
