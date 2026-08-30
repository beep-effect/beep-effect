# Map — Todox.ai wealth-management sales site

<!--
Tightened 2026-08-27 at decompose, after Impeccable init + shape completed:
PRODUCT.md confirmed, direction Terminal of Record human-locked (seed key
9ce5e740), shape brief confirmed (research/SHAPE-BRIEF.md), and the four
decompose deliverables produced. Earlier pre-seeded version is in git
history.
-->

## Candidate goal

### `todox-marketing-site`

**Mission:** Implement an original, source-gated Todox.ai category site in the
existing `apps/todox` workspace, centered on a synthetic client-index-to-
meeting-preparation narrative and a private-walkthrough action.

**Status:** ready to graduate. The former gates have all fired: Impeccable
`init` is complete (`apps/todox/PRODUCT.md` confirmed 2026-08-27), the human
locked the **Terminal of Record** direction, the shape brief is confirmed,
and the decompose deliverables below exist. Scaffolding the goal awaits the
definition-of-ready check and the human's go.

**Confirmed direction:** Terminal of Record — amber-phosphor terminal
passages for the live mechanism, fanfold-printout passages for prose and
disclosure, with five binding raises (numbered record addressing, one
typographic voice per actor, ghosted supersession, single-ink density
hierarchy, measured grid + instrument state words, no performance-readable
traces). Full contract input: [`research/SHAPE-BRIEF.md`](./research/SHAPE-BRIEF.md).

**Decompose deliverables (inputs to the goal's SPEC):**

- [`research/PUBLIC-COPY.md`](./research/PUBLIC-COPY.md) — final public-copy
  draft, reconciled line-by-line to
  [`research/CLAIMS.jsonl`](./research/CLAIMS.jsonl).
- [`research/DEMO-SCRIPT.md`](./research/DEMO-SCRIPT.md) — deterministic
  synthetic-demo screenplay (fixture-faithful, authored extensions labeled).
- [`research/ASSET-PLAN.md`](./research/ASSET-PLAN.md) — original/licensed
  asset inventory with license-verification rules.

## Capability map

| Component | Existing capability | Status for the candidate goal |
| --- | --- | --- |
| Next.js application shell | `apps/todox` (wired workspace, portless dev script) | Existing; implementation target. |
| Product truth and claim gate | `apps/todox/PRODUCT.md` (confirmed), [`research/PRODUCT-TRUTH.md`](./research/PRODUCT-TRUTH.md), [`research/CLAIMS.jsonl`](./research/CLAIMS.jsonl) | Existing authority; gates all prose and synthetic states. |
| Locked direction + brief | [`research/SHAPE-BRIEF.md`](./research/SHAPE-BRIEF.md) | Existing (confirmed 2026-08-27); the build writes its direction contract from it. |
| Public copy | [`research/PUBLIC-COPY.md`](./research/PUBLIC-COPY.md) | Existing draft; build-time edits re-run reconciliation. |
| Synthetic demo content | [`research/DEMO-SCRIPT.md`](./research/DEMO-SCRIPT.md) + fixture `goals/agentic-professional-runtime/fixtures/runtime-data-loop/wealth-cash-request` | Existing script over an existing fixture; **net-new** rendering only. |
| Asset inventory | [`research/ASSET-PLAN.md`](./research/ASSET-PLAN.md) | Existing plan; **net-new** original SVG/CSS production inside the goal. |
| Visual system implementation (tokens, components, motion) | None (no DESIGN.md; placeholder route only) | **Net-new**, the heart of the goal; DESIGN.md is written at finish per Impeccable. |
| Responsive/accessibility verification | `browser-qa-loop` skill, `bun run beep qa` | Existing capability; mandatory for the gesture-bearing record inspector. |
| Quality path | `bun run beep yeet` (repair/verify/publish/monitor) | Existing; canonical publication path. |
| Backend and external connectors | None | Out of scope by design; the CTA is a mailto. |

## Sequencing

1. ~~Fable reads the seed and packet files.~~ done 2026-08-27
2. ~~Impeccable `init` with human product-truth confirmation.~~ done
3. ~~Impeccable `shape` through a human-locked direction.~~ done (Terminal of
   Record)
4. ~~Shape brief presented and confirmed.~~ done
5. ~~Decompose deliverables produced; candidate goal tightened.~~ done
6. Definition-of-ready check; on pass and the human's go, advance to
   `graduate` and scaffold `goals/todox-marketing-site/` from the template
   (SPEC seeded from BRIEF + SHAPE-BRIEF; no-gos → non-goals, rabbit holes →
   constraints, DECISIONS → decision log; SOURCES carried per the graduation
   contract).
7. Implement the first vertical slice in `apps/todox` inside the graduated
   goal: Impeccable new-work build (direction contract, code-led), recorded
   browser QA loop, claim-gate re-check, yeet publication.

## First vertical slice

One responsive public homepage rendering the seven-passage sequence from the
shape brief with the exact session in `DEMO-SCRIPT.md`:

1. screen: hero session (source lands, candidate posts, CTA);
2. printout: the reconstruction problem;
3. screen: supersession with ghosted prior intent;
4. screen: review at the gate, including the rejected wrong output;
5. printout: five-lens objections;
6. screen: meeting-prep packet + record-inspector receipt (focal moment);
7. printout: where-this-stands, sign-off, qualification footer.

The slice ends before any live connector, account login, client send,
advice, trade, money movement, or CRM write, and ships no additional routes.

## Acceptance criteria (seed for the goal's SPEC)

- Every factual public assertion resolves to a `publicEligible` claim record
  or explicit concept language, per the PUBLIC-COPY reconciliation; any copy
  edit re-runs the reconciliation.
- Every screen passage renders under the synthetic-demonstration label; the
  receipt names the deterministic fixture producer.
- The five binding raises are implemented and auditable in the page.
- No researched account, supplied individual, third-party asset, chart-like
  trace, or unearned proof element appears.
- Original visual system recorded through Impeccable at finish (direction
  contract in the layout, DESIGN.md from the built world).
- Responsive (360px+), keyboard-driven record inspector, WCAG AA contrast on
  the amber/near-black pairs actually shipped, reduced-motion and no-JS
  fallbacks per DEMO-SCRIPT.
- Real-browser evidence via the recorded QA loop for the record inspector
  and passage transitions; portless dev server only; yeet green.
- Typeface licenses verified and recorded before publication.

## Re-entry gates

All three former shape-exit gates are satisfied and on record in
[`DECISIONS.md`](./DECISIONS.md): human-locked direction with rationale,
explicitly confirmed shape brief, and approval of brief and no-gos.

If product implementation later proves a presently vision-only mechanism,
update repository authority and the claim ledger before changing marketing
tense. Never let the site become the source of product truth.
