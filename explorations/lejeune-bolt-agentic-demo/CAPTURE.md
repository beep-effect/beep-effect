# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-25

Conversation with my friend **Jackson LeJeune** — son of an executive at, and
employee (sales / marketing / logistics) of, a company that sells bolts, acting
as the middle between buyers and manufacturers. Site: https://lejeunebolt.com/

Photos (Rufus Du Sol at Mystic Lake Amphitheater — they sold the bolts for the
structure around the stage):

- [`assets/2026-08-25-mystic-lake-rufus-du-sol.jpg`](./assets/2026-08-25-mystic-lake-rufus-du-sol.jpg)
- [`assets/mystic-lake-amphitheater-aerial-render.jpg`](./assets/mystic-lake-amphitheater-aerial-render.jpg)
  (preview article: https://discovershakopee.org/mystic-lake-amphitheater-preview/)

Other jobs they've sold/fulfilled: **U.S. Bank Stadium** (Vikings stadium),
**NASA** (proprietary, patented fasteners).

Many employees at the business are retiring → lost pros / experience / domain
knowledge soon. I told him about knowledge graphs and what I'm doing for
Oppold IP Law. He wants me to come to lunch with him and a high-up **next
week** to discuss AI.

Given beep-effect was architected to be a domain-agnostic agentic professional
runtime (although early), I want a demonstration that knocks their socks off by
next week. Not beep-effect directly (too early) — maybe a script / pipeline +
knowledge-graph retrieval demo using data relevant to their domain, deployed to
my tailnet, and a new `apps/labs` application using a white-labeled /
beep-graph-branded workbench UI (branding from my TrustGraph TypeScript port checkout, kept outside this repo)
or the semantica app + infra, to demonstrate what is possible.

I've been leaning more **service-as-software** (not SaaS) lately — this is a
perfect example of how I could leverage beep-effect for such business
ambitions. beep's vision isn't built yet but we have the foundations of
ingestion & experience to show something incredible.

Asks for this packet:

- a workflow to mine https://lejeunebolt.com/ for domain-relevant information
- explore options for an amazing demo application directly relevant to their
  business (use grok): find social media accounts, clients, specific bolts,
  research the nitty-gritty of their process from whatever is findable
- explore the best options using the explored open-source references
  (trustgraph, cogni, semantica) to create a custom beep-branded demo
  (branding in the trustgraph port I shared)
- evaluate the **top three highest-value use cases** to show how I could
  provide immense value with agentic AI, knowledge graphs, context graphs,
  agent memory, automations, etc.

They use **Microsoft Office as their system of record** (`@beep/m365` —
fantastic).

Jackson's day, in his words (paraphrased):

1. Take emails, calls, and other contacts where buyers list various bolts and
   the tools required to install them; then check manufacturers & sellers for
   availability, price, delivery windows, supply, and likely other data points;
   then log into those sellers' systems and place orders for the buyers.
2. Clarify, explain, and specify what buyers need based on parts already
   purchased or in transit to various projects for installation — "xyz is why
   you need these fasteners in addition to the bolts to install the beams to
   join together" + other domain-specific jargon.

What I want mined/shown: domain-relevant data demonstrating how existing and
new emails and other pros' material can be ingested, parsed, normalized,
enriched, persisted — making agents informed and trustworthy enough to take a
given action on behalf of someone like Jackson given his approval; how the
knowledge is valuable and what can be automated; stored locally on machine to
enable agents; and capturing the years of experience of the veterans leaving
by ingesting their office data and structuring it.

Deliverable mechanics: `/yeet` the exploration packet as a PR.

## 2026-08-25 (later)

- Reaffirmed: **the demo application would be deployed to my tailnet** — not a
  public SaaS surface; local-first, reachable by the people I invite.
- Reiterated the mining target: https://lejeunebolt.com/
