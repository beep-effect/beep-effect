# Public-copy draft — Todox wealth-management homepage

Decompose deliverable, drafted 2026-08-27 against the confirmed shape brief
([`SHAPE-BRIEF.md`](./SHAPE-BRIEF.md)) and reconciled line-by-line to
[`CLAIMS.jsonl`](./CLAIMS.jsonl). Only `publicEligible: true` records carry
factual weight; everything else is marked `framing` (audience truth, no
product fact asserted), `concept` (explicit vision/proposed tense), or
`synthetic-label` (demonstration content governed by the labeling rule).

Screen-passage record microcopy (record numbers, states, receipts) lives in
[`DEMO-SCRIPT.md`](./DEMO-SCRIPT.md). This file owns the prose the visitor
reads. The em dashes inside required label and footer strings are part of the
specified strings and are kept verbatim.

## Page metadata

| Slot | Copy | Gate |
| --- | --- | --- |
| Title | `Todox — the client brief that shows its work` | framing + concept |
| Description | `A wealth-management product direction: approved source material becomes a source-linked client index and a reviewable meeting-preparation packet. Demonstrations use synthetic data.` | claim-todox-vision-controls-and-attribution, claim-meeting-prep-workflow (both vision tense); synthetic-label |
| Social-card line | `From approved source to reviewed meeting prep.` | concept |

## Passage 1 — screen: the session (hero)

Persistent status row (required, verbatim label):

> TODOX · TERMINAL OF RECORD · **Synthetic demonstration — no client data.**

Translation line (display):

> **The client brief that shows its work.**

Support line:

> Todox is a product direction for wealth-management firms. The proposed
> runtime turns approved source material into a source-linked client index
> and a meeting-preparation packet an advisor reviews before anyone uses it.
> Your CRM, planning, document, and custodial systems keep their authority.

Primary action: `[ F9 ] REQUEST PRIVATE WALKTHROUGH` →
`mailto:[walkthrough-email]` (placeholder; deferred in DECISIONS.md).
Secondary action: `[ F2 ] SEE THE SYNTHETIC WORKFLOW` → in-page anchor.

Gate: "product direction" and "proposed runtime" carry
claim-todox-vision-controls-and-attribution and claim-meeting-prep-workflow
in vision tense; "keep their authority" is
claim-systems-of-record-stay-authoritative stated as the proposed contract.

## Passage 2 — printout: the reconstruction problem

> Advisor work lives across a CRM, a planning tool, a document vault, an
> inbox, meeting notes, and the people who remember what happened. The
> expensive failure is not a missing summary. It is losing why a piece of
> work exists, which source supports it, what changed since, who reviewed
> it, and what may safely happen next.
>
> Before the next client meeting, someone rebuilds that picture by hand.
>
> Todox starts from a different unit of work: the record. A sentence in an
> approved source produces a candidate claim or task. The candidate keeps
> its exact source span. An advisor decides what it becomes. The decision
> stays attached. That is the whole mechanism, and the demonstration below
> replays it end to end on synthetic data.

Gate: paragraphs 1–2 are framing (no product fact). Paragraph 3 is concept
mechanism language backed by claim-todox-vision-controls-and-attribution and
claim-proof-is-deterministic-synthetic ("replays it end to end on synthetic
data" also discharges the synthetic label for the passage that follows).

## Passage 3 — screen: supersession

Translation line:

> **Context changes. The record remembers how.**

Support line:

> When a client's intent changes, the proposed model keeps the earlier
> version, its interpretation history, and its source. The old record is
> marked superseded and dated. Nothing is overwritten to look tidy.

Gate: claim-supersession-preserves-changed-intent, stated as model intent
("proposed model"). Demonstration records: synthetic-label via status row.

## Passage 4 — screen: review

Translation line:

> **Let agents propose. Let professionals decide.**

Support lines:

> The proposed v1 policy requires advisor or compliance review for financial
> advice, recommendations, account actions, and client-facing communication.
>
> Review records a professional decision, scoped to a purpose. It does not
> turn an assertion into a universal fact, and it does not write to your
> systems of record.
>
> Rejected work is designed to stay on the record too. A wrong candidate is
> evidence of what was proposed and declined, not something to erase.

Gate: line 1 is claim-wealth-review-required (policy boundary, "proposed v1
policy"). Line 2 is claim-acceptance-is-not-truth plus
claim-systems-of-record-stay-authoritative. Line 3 is
claim-rejected-work-preserved-by-policy in design-intent tense ("designed
to").

## Passage 5 — printout: objections, five lenses

Header: `Questions we expect, answered plainly.`

**"Is this another meeting recorder?"**

> No. The concept begins with source-linked client context before the
> meeting and preserves reviewable work after it. Recording could be one
> future source. It is not the product category.

**"Are you replacing our CRM or custodian?"**

> No. Those systems remain authoritative for the records they own. Todox is
> being shaped to coordinate context, proposed work, review, and provenance
> around them.

**"Does firm-controlled mean nothing leaves the machine?"**

> We make no absolute claim. The design goal is firm-controlled data and
> action authority, with bounded context sent only to approved models under
> policy, and the model, tool, actor, and review recorded with the work.

**"Does the advisor have to trust a black-box answer?"**

> The target experience keeps the source span, candidate state, actor, tool
> or model, time, and review disposition inspectable. It does not promise
> hidden model reasoning, and a citation does not make the underlying claim
> true.

**"Can it act for the advisor?"**

> Only within a firm-defined policy and authorization boundary, and not in
> the demonstrated workflow. Advice, recommendations, money movement,
> trades, tax conclusions, and unsupervised client communication stay
> outside it.

**"Which integrations work today?"**

> None are claimed. The current wealth demonstration is a deterministic
> synthetic fixture, not a deployed connector suite. Bring the systems you
> care about to a private walkthrough.

Gate: adapted from the vetted objection bank in
[`CONTENT-SEED.md`](./CONTENT-SEED.md); mechanism tenses carried by
claim-todox-vision-controls-and-attribution,
claim-systems-of-record-stay-authoritative, claim-wealth-review-required,
claim-acceptance-is-not-truth, and claim-proof-is-deterministic-synthetic
(integrations answer). No named vendor, firm, or uniqueness claim appears.

## Passage 6 — screen: the packet and the receipt

Translation line:

> **The meeting starts with the evidence.**

Support lines:

> The packet holds what changed, current goals and constraints, open
> decisions, work in the advisor's court, and source-backed questions to
> ask. Anything without evidence or authorization is listed as excluded,
> not silently included.
>
> Every entry carries its receipt: requested action, reviewer, candidate
> references, evidence, policy basis, decision state, and time. In this
> demonstration the producer is a deterministic fixture, and the receipt
> says so. No live model ran.

Gate: packet fields follow claim-meeting-prep-workflow (proposed workflow)
and claim-fixture-context-excludes-actions-and-recommendation
(synthetic-label). Receipt fields are claim-approval-gate-fields (schema
contract). "No live model ran" is claim-proof-is-deterministic-synthetic
honesty, kept deliberately.

## Passage 7 — printout: where this stands, and the sign-off

`Where this stands` block:

> Todox is a concept built on a proposed runtime contract. What you watched
> above replays a deterministic synthetic fixture: one email with stable
> source spans, candidate claims and tasks, one draft, one pending approval
> gate, and a bounded context packet. We claim no deployed wealth product,
> no live integrations, and no customer results. What we can show is the
> mechanism, working, on data built to be inspected.

Sign-off (printed form styling):

> `PREPARED FOR:` the firm evaluating its AI roadmap
> `NEXT ACTION:` Request a private walkthrough
> `[ F9 ] REQUEST PRIVATE WALKTHROUGH` → `mailto:[walkthrough-email]`

Required qualification footer (kept whole):

> Todox.ai is a product concept in development. Demonstrations use synthetic
> data and do not provide financial, investment, tax, or legal advice.
> Product capabilities, integrations, controls, and availability remain
> subject to validation.

Gate: "Where this stands" is claim-product-runtime-spine +
claim-proof-is-deterministic-synthetic + claim-fixture-approval-remains-pending
+ claim-fixture-context-excludes-actions-and-recommendation, with the
forbidden-claims list applied as negative space. Footer is the required
qualification language from CONTENT-SEED, truth intact.

## Copy exclusions honored

No named firm or individual; no customer, testimonial, adoption, AUM,
time-saved, ROI, accuracy, or production metric; no compliance-standard or
certification language; no live-integration, zero-hallucination, or
universal-explainability claim; no autonomous advice, trading, money
movement, or unsupervised client communication; no "nothing leaves the
device"; no "only," "first," or "the AI OS for wealth"; no competitor
comparison on the page.

## Open items

- `[walkthrough-email]` placeholder resolves at build (deferred decision,
  see DECISIONS.md 2026-08-27).
- Final typesetting of translation lines happens in the build; wording here
  is the confirmed draft and any build-time edit re-runs this
  reconciliation.
