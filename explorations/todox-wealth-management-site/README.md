# Todox.ai wealth-management sales site

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Build a source-backed creative seed for a Todox.ai marketing site aimed at
wealth-management firms. Grok and Firecrawl collect the evidence; Claude Fable
uses the packet to choose the visual world and implement the site later.

## Next open question

None — the packet graduated 2026-08-27 into
[`goals/todox-marketing-site`](../../goals/todox-marketing-site/README.md).
This packet remains as provenance; a fired MAP gate would reopen it at
`decompose`. Implementation, and later PR publication (explicitly deferred by
Benjamin pending repo contention), happen in the goal packet.

## Read this first

1. [`ops/manifest.json`](./ops/manifest.json) - packet state and source ledger.
2. [`CAPTURE.md`](./CAPTURE.md) - the original request and supplied sources.
3. [`RESEARCH.md`](./RESEARCH.md) - external findings and repository truth.
4. [`DECISIONS.md`](./DECISIONS.md) - resolved product and handoff boundaries.
5. [`BRIEF.md`](./BRIEF.md) - the shaped research and Fable handoff.
6. [`research/SHAPE-BRIEF.md`](./research/SHAPE-BRIEF.md) - the confirmed
   Impeccable shape brief and locked direction.
7. [`research/FABLE-SEED.md`](./research/FABLE-SEED.md) - the downstream prompt.
8. [`research/SOURCES.md`](./research/SOURCES.md) - provenance and rerun inputs.

## Trail

- 2026-08-27: opened the packet, captured the brief, and began parallel Grok,
  Firecrawl, Notion, and repository research.
- 2026-08-27: completed five Grok and Firecrawl workstreams, source and claim ledgers,
  account and competitor synthesis, seven visual-inspiration families, the
  shape brief, a gated decomposition map, and the standalone Fable seed.
- 2026-08-27: reconciled the Fable handoff with Impeccable 4.1.2 so `init`
  captures confirmed product truth and `shape` stops after the human-locked
  direction and confirmed brief, before persistence or implementation.
- 2026-08-27: Fable ran Impeccable `init` (human confirmed
  `apps/todox/PRODUCT.md`; Todox at todox.ai; email-contact CTA) and `shape`:
  the direction roll assigned the market-data-terminal candidate, six
  challengers were fused and judged, and the human locked **Terminal of
  Record**, then confirmed the shape brief (`research/SHAPE-BRIEF.md`).
  Packet reopened at `decompose`; no `.impeccable` persistence, direction
  contract, `DESIGN.md`, or `src/**` edit was made.
- 2026-08-27: decompose completed — claim-reconciled public copy
  (`research/PUBLIC-COPY.md`), deterministic demo script
  (`research/DEMO-SCRIPT.md`, wealth-cash-request fixture with labeled
  authored extensions), asset plan (`research/ASSET-PLAN.md`), tightened
  `MAP.md` (goal `todox-marketing-site` ready to graduate). CTA email
  deferred to build with rationale. Definition-of-ready: all four points
  pass. Awaiting the human's go to graduate.
- 2026-08-27: graduated on Benjamin's go —
  [`goals/todox-marketing-site`](../../goals/todox-marketing-site/README.md)
  scaffolded from the template (SPEC seeded from the briefs, SOURCES carried,
  manifests cross-linked, `goals/INDEX.md` regenerated); status flipped to
  `graduated`. No commit or PR: publication explicitly deferred (repo
  contention) and gated in the goal's SPEC/PLAN until his green light.
