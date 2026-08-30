# Solo-Firm IP Docketing

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Tom's solo IP practice cannot miss a deadline — office-action response periods,
filing windows, patent maintenance/annuity fees, and court orders, some of them
*years* out, where a miss is malpractice. The product promises "it never misses
the deadline" yet its doctrine says it does not *replace* docketing. This packet
lands on how we deal with docketing: handroll, integrate a paid solution with a
good API/MCP/SDK, or hybrid — reliable, agent-integratable, and developer-sane.

## Next Open Question

None while graduated. The four queued candidates remain MAP re-entry points; a
fired gate reopens this packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - cited prior art + capability inventory (stage 1).
4. [`IP_LAW_FIRM_DOCKETING_RESEARCH.md`](./IP_LAW_FIRM_DOCKETING_RESEARCH.md) - supplemental Claude Web research to reconcile with the packet verdict.
5. [`../ip-practice-rundown.html`](../ip-practice-rundown.html) - shared standalone two-tab lawyer-facing handout for docketing + time tracking.
6. [`rundown.html`](./rundown.html) - pure HTML/CSS/JS high-level visualization folding in the supplemental findings.
7. [`research/`](./research/) - the three full deep-research reports cited by RESEARCH.md.
8. [`DECISIONS.md`](./DECISIONS.md) - grilling log + recommendation (stage 2).
9. [`BRIEF.md`](./BRIEF.md) - ratified six-week shaped pitch (stage 3).
10. [`MAP.md`](./MAP.md) - graduated and gate-queued decomposition (stage 4 surface).

## Related Packets

- [`microsoft-365-integration`](../microsoft-365-integration/README.md) —
  graduated into [`goals/m365-driver`](../../goals/m365-driver/README.md) and
  [`goals/m365-mcp`](../../goals/m365-mcp/README.md). Docketing's L4 Outlook push
  depends on `m365-driver` and is the concrete driver for its future
  `Calendars.ReadWrite` write scope.
- [`EXAMPLE.md`](../EXAMPLE.md) — the *fictional* `matter-deadline-radar` prior:
  it killed escalating reminders ("different product, wouldn't be trusted") and
  did zero deadline math. This packet consciously revisits that kill with a
  *trustworthy* (approval-gated, redundant, dead-man's-switch) reminder design.

## Trail

- 2026-08-13: holding-pen convention ratified; the packet flipped to
  `graduated`. Its four queued MAP candidates remain re-entry points, and a
  fired gate reopens this packet at `decompose`.
- 2026-07-14: shape signed off with the six-week appetite and paired
  acceptance; graduated [`law-docketing-patent-spine`](../../goals/law-docketing-patent-spine/README.md)
  plus [`law-docketing-reliability`](../../goals/law-docketing-reliability/README.md)
  and published [`docs/product/solo-firm-docketing.md`](../../docs/product/solo-firm-docketing.md).
- 2026-07-14: review gate ratified the pending branches; drafted `BRIEF.md`, `MAP.md`,
  and the `research/SOURCES.md` provenance ledger. Stopped at shape sign-off.
- 2026-06-18: added this packet to the shared standalone
  [`ip-practice-rundown.html`](../ip-practice-rundown.html) handout for
  nontechnical lawyer review. Still stopped at `align`.
- 2026-06-18: added a pricing column to [`rundown.html`](./rundown.html),
  distinguishing published prices, free official data sources, quote-required
  vendors, and pass-through costs. Still stopped at `align`.
- 2026-06-18: flattened [`rundown.html`](./rundown.html) into a standalone
  one-page table with only external links, so the tailnet-served handout no
  longer depends on local Markdown links or tabbed JavaScript. Still stopped at
  `align`.
- 2026-06-18: recovered/recreated [`rundown.html`](./rundown.html) after another
  agent's checkout no longer had it, and folded in
  [`IP_LAW_FIRM_DOCKETING_RESEARCH.md`](./IP_LAW_FIRM_DOCKETING_RESEARCH.md):
  AppColl as docket-of-record anchor, malpractice/reliability framing, ODP/Graph
  operational constraints, maintenance-fee edge cases, and vendor action links.
  Still stopped at `align`.
- 2026-06-18: served [`rundown.html`](./rundown.html) on a private tailnet URL
  for review/sharing. Still stopped at `align`.
- 2026-06-18: added official vendor action links to the buy-option cards in
  [`rundown.html`](./rundown.html): CPI demo/contact, LawToolBox demo, Alt Legal
  demo/trial, and AppColl pricing. Still stopped at `align`.
- 2026-06-18: added [`rundown.html`](./rundown.html), a standalone pure
  HTML/CSS/JS visualization of the four-layer verdict, first slice, buy options,
  operating constraints, and review-gate questions. Still stopped at `align`.
- 2026-06-18: integrated the verified sequential deep-research reruns into
  `research/01`, `research/03`, `RESEARCH.md`, and `DECISIONS.md`; left
  `research/02` on the original successful court synthesis because the rerun
  output was empty; updated M365 cross-links to `goals/m365-driver` /
  `goals/m365-mcp`. Still stopped at `align` review gate.
- 2026-06-18: packet opened straight at `research` (capture = the user's written
  brief + four locked planning-grill decisions). Ran three deep-research tracks
  (IP-prosecution docketing; court/litigation deadline engines; official-data /
  handroll route), wrote `RESEARCH.md` + `research/0{1,2,3}-*.md`, logged align in
  `DECISIONS.md` (doctrine = vigilance overlay, not system of record) and a
  per-layer recommendation. Stopped at the review gate before shape.
