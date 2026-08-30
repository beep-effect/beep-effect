# Decisions

## 2026-08-27 — product posture

**Question:** Is this site selling an available wealth product or a product
vision?

**Answer:** A vision-only concept.

**Rationale:** The repository keeps wealth management as a dormant synthetic
proof fixture while law remains the sole active vertical. The site may explain
the mechanism and invite a private walkthrough, but it cannot claim a paid
pilot, production availability, deployed integrations, or customer adoption.

## 2026-08-27 — account visibility

**Question:** Should the public site name either researched firm or either
user-supplied individual?

**Answer:** No. The public site is a research-informed Todox category site.

**Rationale:** Account-specific evidence belongs in sales-only briefs. This
avoids implying endorsement, permission, or a customer relationship.

## 2026-08-27 — flagship story

**Question:** Which product workflow should anchor the seed?

**Answer:** Client index to meeting preparation.

**Rationale:** The concept begins with a living, source-linked household brief
and turns it into a reviewable meeting-preparation packet. It should not be
framed as another meeting recorder or autonomous financial advisor.

## 2026-08-27 — deployment language

**Question:** What does local-first mean in public prose?

**Answer:** Firm-controlled local data and action authority with bounded,
policy-approved model calls.

**Rationale:** "Nothing leaves the device" conflicts with the current product
direction. Control, scoped context, provenance, and approved models are accurate
and more useful than an absolute offline claim.

## 2026-08-27 — site and action

**Question:** What site shape and action should the corpus support?

**Answer:** One flagship narrative in the existing `apps/todox` app, with
"Request a private walkthrough" as the primary action.

**Rationale:** The user selected a focused narrative rather than a broad site
suite and chose the existing workspace rather than creating a second workspace
for the public domain.

## 2026-08-27 — creative authority

**Question:** Who chooses the components, layout, typography, palette, theme,
branding, and final page structure?

**Answer:** Claude Fable, using Impeccable.

**Rationale:** This packet supplies evidence, content candidates, constraints,
and multiple inspiration families. It does not install a final design system or
make taste decisions on Fable's behalf.

## 2026-08-27 — packet exit

**Question:** Does this exploration graduate into an implementation goal now?

**Answer:** No. Leave it active at shape for Fable.

**Rationale:** Direction selection and implementation are deliberately outside
the research pass. Fable can resume the packet, complete Impeccable `init`, and
run `shape`, which enters `new-work` only far enough for a human-locked concept
choice. Fable then returns the shape brief for confirmation and stops before
direction-contract persistence or implementation. The packet returns to
`decompose` before any implementation goal is scaffolded.

## 2026-08-27 — account relationship

**Question:** How should the research describe the relationship between the two
target brands?

**Answer:** Treat them as one account family with distinct public voices and
more than one relevant advisory entity. AdvicePeriod is a current Mariner-
affiliated business name and brand, not a second independent present-day RIA.

**Rationale:** Current first-party disclosures and regulatory records are more
precise than the supplied “child company” shorthand. The exact entity model
stays in sales-only research and never becomes public Todox copy.

## 2026-08-27 — market position

**Question:** What can Todox use as a differentiated public position after the
competitor and account research?

**Answer:** Explore control, evidence, and ledgers through a source-linked
client-index-to-meeting-preparation story.

**Rationale:** Notetakers, copilots, AI operating systems, AI workforces, human
review, citations, audit logs, MCP, private deployment, and generic
explainability are occupied. Bounded model-call admission, versioned source
spans, supersession, scoped authorization, and an attached execution ledger are
promising only as combined hypotheses until they are implemented and proved.

## 2026-08-27 — public research custody

**Question:** What private or person-specific research may enter the tracked
packet?

**Answer:** Only opaque, sanitized decision summaries.

**Rationale:** Private Notion bodies, URLs, page identifiers, quotations,
person-specific relationship context, and profile URLs remain outside the
public repository. Public reachability does not equal copy clearance.

## 2026-08-27 — pending Fable confirmation gates

**Question:** What human decisions remain before the packet can leave shape?

**Status:** Resolved 2026-08-27 (see the three entries below).

**Answer:** The human confirmed the app-local `PRODUCT.md` during Impeccable
`init`, locked the Terminal of Record direction, and confirmed the resulting
shape brief. Shape is complete; the packet reopens at `decompose`.

## 2026-08-27 — product truth confirmed (Impeccable init)

**Question:** Does the human confirm the app-local `PRODUCT.md`?

**Answer:** Yes, as drafted, with two additions: the public identity is
"Todox" at site todox.ai (not "Todox.ai" as the product name), and the
walkthrough CTA resolves to email contact (address still to be named, never
invented).

**Rationale:** The record was drafted from packet evidence
(`research/PRODUCT-TRUTH.md`, `BRIEF.md`, this log) and confirmed in one
structured round. It lives at `apps/todox/PRODUCT.md`. No image generation
exists in the shaping harness, so code-first is the only build path (nothing
recorded — there was no choice to make); live-mode setup and optional
source/CSP edits were deferred per the handoff boundary.

## 2026-08-27 — visual direction locked

**Question:** Which Fable-curated direction does the human lock?

**Answer:** **Terminal of Record** — period-authentic market-data-terminal
grammar (amber phosphor on near-black CRT) alternating with fanfold-printout
passages, rebuilt to quote provenance instead of prices.

**Rationale:** The Impeccable direction roll (seed key `9ce5e740`, mode
persuade) assigned candidate 4 of Fable's seven grounded candidates drawn
from the buyer's cultural world. Six catalog challengers were fused and
judged on audience identification and product clarity: one competitive
(crank-paper automata, "The Provenance Machine"), five declined (teletext,
Massin stage typography, orizuru fold sequence, ASCII live-render, CRT
oscilloscope), each declined challenger donating one named discipline raised
into the locked direction. Fable's own top-ranked candidate (audit working
papers, "The Working Paper") rode as IMPECCABLE'S PICK; the canon exit was
offered. The decision page closed unanswered, so the round resolved through
the structured question tool; the human took the assigned card. Rejected
options remain on record in `research/SHAPE-BRIEF.md`.

## 2026-08-27 — shape brief confirmed

**Question:** Does the resulting Impeccable shape brief match the intended
site?

**Answer:** Yes — confirmed without corrections. The confirmed brief is
recorded at [`research/SHAPE-BRIEF.md`](./research/SHAPE-BRIEF.md).

**Rationale:** Per the handoff and MAP re-entry gates, the packet returns to
`decompose` with three artifacts in hand: a human-locked direction with
rationale, the confirmed brief, and approval of brief and no-gos. Remaining
open items are decompose-stage deliverables, not shape questions: final
public copy reconciled to `CLAIMS.jsonl`, the synthetic-demo script, the
asset plan, and the tightened candidate-goal boundary. No `.impeccable`
surface brief, direction contract, `DESIGN.md`, or implementation edit was
made; `apps/todox/src/**` is untouched.

## 2026-08-27 — walkthrough CTA email deferred

**Question:** What address does "Request a private walkthrough" resolve to?

**Answer:** Deferred. Email contact is confirmed as the mechanism (init
decision above); the address ships as a marked `[walkthrough-email]`
placeholder in `research/PUBLIC-COPY.md` and resolves as a build-time value.

**Rationale:** Committing to `hello@todox.ai` requires mail infrastructure
that is not proven, and publishing an unmonitored address is worse than a
placeholder. The address is a one-line swap that does not affect design,
copy structure, or the claim gate, so it does not block
definition-of-ready. Rejected for now: `hello@todox.ai` (unproven mailbox),
`boppold@oip.law` (mixes OIP identity into Todox public copy).

## 2026-08-27 — decompose deliverables complete

**Question:** What did decompose produce, and does the packet pass the
definition-of-ready check?

**Answer:** Produced: `research/PUBLIC-COPY.md` (copy draft reconciled to
`CLAIMS.jsonl`, 15 public-eligible records carrying all factual weight),
`research/DEMO-SCRIPT.md` (deterministic session over the wealth-cash-request
fixture with labeled authored extensions), `research/ASSET-PLAN.md`
(original/licensed assets only), and the tightened `MAP.md`
(`todox-marketing-site` marked ready to graduate). Definition-of-ready:
all four points pass — brief complete (BRIEF.md + SHAPE-BRIEF.md), no
unresolved blocking questions (CTA email explicitly deferred above), map
names the work with sequencing and first slice, and every capability row
cites an existing brick or is explicitly net-new.

**Rationale:** The four deliverables were the re-entry contract this map set
for decompose. Graduation (scaffolding `goals/todox-marketing-site/`)
awaits the human's go; implementation stays gated behind the graduated
goal.
