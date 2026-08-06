# Capture — compound engineering

Append-only. Never interrogated, never reorganized.

## 2026-08-06 — the operator's framing

> Eventually we will probably cross each ledger item off the list and this
> highly productive ride will end... But what if it didn't have to? I've made
> reflection a "relatively" standard practice for goals [...] the point of the
> reflection is less a log of what happened during a goal and more "how could
> we have made your job easier, faster, more efficient? What do you wish you'd
> have known when you started? and what would have been nice for you to have?"
> The goal being as things are done things get faster, easier, more efficient
> and pleasant. [...] A "Compound Engineering" sort of a thing.
>
> It seems that if reflection is done at the back end of a thing some of the
> valuable information, ideas & opportunities get lost in the noise which is
> why that existing mechanism never seemed to land like it has in this
> session. In this session it has been an active process. [...] I've
> frequently had to ask you about what "ideas" you have. I would imagine that
> many of our ledger items would not have been added unless I had asked. [...]
> If I have to ask or we have to remind agents to reflect I might forget or
> spend time writing the same instructions for each agent.

And, on mechanizing the relay (buzz running always-on locally, routed through
the existing Claude Code/Codex harnesses):

> What is interesting about these is less the agent to agent communication but
> more how it could be used as this place where these "points of friction"
> could be fired off to where an agent that doesn't sleep can continuously
> ingest them, add them to the ledger and work down that ledger in real time
> [...] a frictionless way to add "opportunities" to the ledger without an
> agent wasting time and tokens while also not interrupting the work they are
> doing.

## 2026-08-06 — the synthesis (from the speed-loop closeout)

**Thesis.** Every unit of work emits two outputs: the deliverable, and
information about how the work could have been better. The second output is
perishable — it decays within minutes as context compacts and attention
moves. Closeout-time reflection asks for it after decay (hence generic
retrospective prose and `reflectionRequired` opt-outs); the speed-loop
campaign's effectiveness came from capturing it at the moment of friction,
with receipts, into a ledger a decision process actually consumes.

**The loop.** CAPTURE (at friction time, receipts not summaries) →
ACCUMULATE (one durable git ledger per campaign, numbered, statused) →
SENTENCE (grills as evidence-sentencing, operator authority) → SHIP+DOGFOOD
(speed-loop decision 49's ladder) → the shipped tooling lowers the cost of
the next capture. Compounding lives in the return edge; an empty ledger
refills as long as work happens.

**Broken-station failure modes.** Capture without accumulation = chat that
scrolls away. Accumulation without sentencing = graveyard (the likely fate
of prior reflection outputs). Sentencing without the dogfood ladder =
speculation.

**The relay analysis (binding design constraint).** The operator's manual
relaying between sessions provided three functions beyond transport:
filtering (expensive channel → dense receipts), authority (operator relay =
ratification weight), timing. Mechanizing the wire must relocate — not
delete — the filter (a triage station with the admission rule "receipts,
not vibes") and the authority (sentencing stays human). The operator moves
up the stack: courier → judge.

**Mechanization sketch (workstation-local; not repo doctrine).** Block's
buzz runs always-on on the operator's workstation and routes through the
existing harnesses/subscriptions. A `#friction` channel exists with the
receipt protocol in its description. Phases, decision-49-gated: phase 0 —
capture wire only, a session harvests → dedups → batched ledger docs-PRs +
grill dockets; measure a week (capture rate vs relay-era, noise ratio)
after researching buzz's actual mechanics first. Phase 1 — an always-on
"compounder" agent, write scope docs/ledger only, system prompt carries
"drop evidence-free messages without guilt". Phase 2 — the compounder works
SENTENCED queue items under ownership claims; the collision half of that
design belongs to the fleet-coordination packet and must be relayed there
before phase 1.

**Receipts held at capture.** The speed-loop ledger reached 83 items in
three days run manually; sub-agent reflection riders produced unprompted
reflections while orchestrator-level capture required operator asks — the
asymmetry motivating the ambient AGENTS.md law shipped alongside this
capture. The idle-without-reporting amendment (same batch) is the report-
durability half of the same problem.

Operator rulings at open (grilled 2026-08-06): packet seeded directly from
the synthesis rather than an INBOX bullet; the AGENTS.md friction-capture
law ships with this capture; the /reflect reframe (three questions +
closeout-as-ledger-distillation) ships separately; buzz stays workstation
doctrine until this packet graduates; nothing else is decided.
