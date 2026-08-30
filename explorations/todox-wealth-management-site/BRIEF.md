# Brief — Todox.ai wealth-management sales site

<!--
Stage 3 research brief. Drafted 2026-08-27 from the completed corpus as input
to Impeccable shape, not as the command's resulting design brief. Claude Fable
owns the visual and later implementation decisions; this packet remains active
until a human confirms that shaping pass.
-->

## Problem

Wealth advisors work across client relationships, households, entities,
documents, email, meetings, specialists, tasks, and systems of record. The
expensive failure is not simply a missing meeting summary. It is losing why a
piece of work exists, which source supports it, what changed, who reviewed it,
and what may safely happen next.

The market already has strong stories for meeting capture, CRM writeback,
planning analysis, document extraction, copilots, agentic workforces, human
review, citations, MCP, and private deployment. The researched account family
has publicly announced broad AI automation and discussed estate-document AI.
A generic “AI for advisors” page would be interchangeable and collide with
tools the buyer already knows or may already use.

Todox also cannot borrow certainty from the repository. Wealth management is a
dormant synthetic proof fixture, not an available product vertical. A useful
site must make the concept vivid without claiming deployment, integrations,
customer adoption, compliance certification, autonomous advice, or measured
outcomes.

## Appetite

One focused Fable discovery and shaping arc for the existing `apps/todox`
workspace, followed only later by a separately approved implementation goal:

- one public category site, not a named-account microsite;
- one flagship story, from living client index to reviewable meeting
  preparation;
- one synthetic product-proof sequence with visible evidence and review;
- one primary action: request a private walkthrough;
- no backend, connector, authentication, CRM, custodian, or autonomous-action
  work in the first slice.

The research appetite is complete. No more broad scraping is needed before
Fable curates candidate directions and a human locks one. Any later refresh
should answer a named gap.

## Audience

The public audience is a senior wealth-management buyer who already has a CRM,
planning tools, document systems, compliance processes, meeting technology,
and an AI roadmap.

The narrative must work across five lenses without becoming five separate
sites:

- producing advisor: current context and useful preparation;
- operations leader: continuity, ownership, and handoffs;
- compliance and privacy: evidence, review, policy, and action boundaries;
- innovation or technology: fit around the installed stack and approved
  models;
- executive: a narrow proof of differentiated operating leverage, not another
  platform transformation claim.

Account-specific briefs remain private sales preparation. The public site does
not name or imply either researched firm or either supplied individual.

## Fat-marker solution sketch

### Narrative spine

Start from a familiar professional moment: the next client meeting. The
problem is not the calendar event; it is reconstructing what is current across
sources and outstanding work.

Show a synthetic client index that makes several states legible:

1. an approved source and exact supporting span;
2. a candidate fact, task, or preparation item;
3. current versus superseded client intent;
4. advisor or compliance review with accept, edit, or reject;
5. a bounded meeting-preparation packet whose assertions open their sources;
6. an activity receipt naming source, actor, time, model or tool, policy, and
   review state.

The story ends at a reviewable packet. It does not show an autonomous
recommendation, client send, trade, money movement, or system-of-record write.

### Positioning spine

Lead with the buyer problem and the inspectable work product. The compact
positioning territory is control, evidence, and ledgers, expressed as product
intent rather than market uniqueness:

- firm-controlled data and action authority;
- bounded, policy-approved model context;
- source-linked candidate work;
- explicit supersession and review;
- existing systems remain authoritative;
- activity and authorization remain attached to the work.

Avoid leading with “local-first,” “explainable,” “agentic,” or “knowledge
graph” without showing the concrete behavior those words mean.

### Content kit

Fable receives:

- atomic claims and caveats in
  [`research/CLAIMS.jsonl`](./research/CLAIMS.jsonl);
- headline, objection, workflow, CTA, and metadata candidates in
  [`research/CONTENT-SEED.md`](./research/CONTENT-SEED.md);
- de-identified market voice in
  [`research/CUSTOMER-VOICE.md`](./research/CUSTOMER-VOICE.md);
- private account discovery context in
  [`research/ACCOUNT-BRIEFS.md`](./research/ACCOUNT-BRIEFS.md);
- competitive collisions and hypotheses in
  [`research/COMPETITIVE-POSITIONING.md`](./research/COMPETITIVE-POSITIONING.md);
- seven nonbinding visual families and anti-references in
  [`research/VISUAL-INSPIRATION.md`](./research/VISUAL-INSPIRATION.md).

These are ingredients. Fable decides the information architecture, hierarchy,
components, theme, typography, palette, imagery, motion, brand system, and
final prose.

### Process boundary

Fable first runs Impeccable `init` with `apps/todox` active and completes the
human product-truth confirmation. It may write the required
`apps/todox/PRODUCT.md` and workflow-generated `apps/todox/.impeccable/**`
artifacts, but it defers optional source and CSP changes.

Fable then runs `shape` for the Todox wealth-management marketing homepage in
`apps/todox`, using this packet as evidence and constraints. Within `shape`, it
follows `new-work` only through visual-authority inspection, candidate
direction exploration, and a human-locked concept choice. It returns before a
direction contract, durable design or surface-brief persistence, and
implementation.

Fable authors and curates the candidates; the human locks one and confirms the
resulting Impeccable shape brief. The research packet does not secretly select
one of the seven inspiration families. This handoff makes no edits to
`apps/todox/src/**`, tests, runtime or package configuration, or other
implementation files.

## Rabbit holes

- **Named-account personalization:** keep it in sales briefs. A public page
  tailored so closely that it identifies the researched account creates an
  endorsement implication.
- **Full product simulation:** one high-fidelity synthetic proof sequence is
  enough. Do not build a dashboard suite or fake live integrations.
- **Graph spectacle:** a network diagram is not evidence. Prefer inspectable
  source, change, review, and timeline objects if the chosen direction calls
  for product proof.
- **Compliance theater:** policy and review must appear as behavior. Do not add
  unearned regulator, certification, award, analyst, or customer-logo bands.
- **Feature parity tables:** the market corpus is for collision avoidance and
  sales discovery, not a public competitor attack page.
- **Pricing and ROI:** no public paid-pilot or savings claim is authorized.
- **Asset harvesting:** captured fonts, screenshots, photos, illustrations,
  logos, and exact compositions are references only.
- **More research for its own sake:** refresh only a source needed for a
  specific claim or live account conversation.

## No-gos

- No app design or implementation by this research pass. The later Fable shape
  handoff may create only confirmed product context and required Impeccable
  working artifacts before it stops.
- No new `apps/todox.ai`; use the existing `apps/todox` workspace later.
- No claim that Todox is deployed, generally available, pilot-ready, or used
  by a named wealth firm.
- No named firms, individuals, testimonials, AUM figures, rankings, customer
  logos, or implied endorsement in public site content.
- No autonomous financial advice, tax conclusions, trades, money movement,
  unsupervised client communication, or silent system-of-record writes.
- No fabricated integrations, certifications, retention policies, security
  guarantees, time savings, ROI, or customer outcomes.
- No absolute “nothing leaves the device,” “no hallucinations,” “every fact is
  true,” or “fully explainable” language.
- No claim that citations, MCP, human review, local deployment, privacy, or
  audit logs are unique.
- No generic dark-neon AI, glowing graphs, AI brains, orbit imagery, glass
  command centers, dominant chat UI, or wealth-management lifestyle clichés.
- No cloned Mariner, AdvicePeriod, or other reference trade dress.

## Shape exit

This research brief is ready as input to Fable's Impeccable shaping pass, not
for automatic graduation. Shape is complete only when the human confirms the
resulting Impeccable brief and its selected direction, which must:

- remain visibly a concept built from synthetic data;
- make the source-to-review mechanism understandable without a feature dump;
- survive the claim ledger and no-go list;
- be original rather than a collage of the reference sites;
- be approved for decomposition into an implementation goal.
