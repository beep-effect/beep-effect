# Microsoft 365 Integration

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Most lawyers — including Tom's OIP practice — live in Microsoft 365 (Outlook
mail/calendar, OneDrive/SharePoint documents, Word/Excel, Teams). The agents we
build (librarian, researchers, patent drafters) need to read from and
eventually write to M365. This packet resolved the build-vs-buy question: a
hybrid — a thin native `@beep/m365` Effect driver exposed as the repo's own MCP
server.

## Next Open Question

None — graduated 2026-06-18 into two goal packets:
[`m365-driver`](../../goals/m365-driver/README.md) and
[`m365-mcp`](../../goals/m365-mcp/README.md). Execution lives there. The
`m365-document-ingest` follow-on is named in [`MAP.md`](./MAP.md), gated on the
document-portal MVP.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - cited prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4).

## Trail

- 2026-06-18: Completed align (D6–D13), shaped the brief, decomposed the map, and
  graduated two goal packets ([`m365-driver`](../../goals/m365-driver/README.md),
  [`m365-mcp`](../../goals/m365-mcp/README.md)); named `m365-document-ingest` as a
  follow-on. Status → `graduated`.
- 2026-06-18: Packet opened. Ran deep web research (6 dimensions, adversarially
  verified) plus an align round; seeded `RESEARCH.md` and recorded decisions
  D1–D5. Landed at `align` with 8 open questions queued.
