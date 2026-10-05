<!--
Home of the X article "The Agentic Yoyo" (drafted 2026-08-30, revised
2026-09-11 with the S7 replay, the journal repairs, the time-to-certainty
baseline, and auditor runs 2 and 3 folded in; told from the
beep-ci-operational-ontology packet record). Repo-root all-caps file per house
tradition, beside A_LETTER_FROM_THE_OTHER_SIDE_OF_THE_LOOP.md. Body below is
composer-ready: paste into x.com/compose/articles as-is. This file is also the
single source for the illustrated page: rebuild it with
explorations/beep-ci-operational-ontology/assets/agentic-yoyo/build.mjs.
-->

# THE AGENTIC YOYO

> "Remember him, before the silver cord is severed... and the dust returns to the ground it came from, and the spirit returns to God who gave it."
> — Ecclesiastes 12:6-7

I had a dream about my build graph.

Agents fanning out from a root, each change growing a new path down the tree. Each agent trailing a silver thread back up to the source. And every time an agent decided it was done, the thread just... got cut. Nothing pulled the work back home.

Let me back up, because the dream had receipts before it had imagery.

## The puzzle that started it

A few weeks ago I opened a session with a small mystery. `bun run build` and `bun run docgen` came back FULL TURBO, fully cached. `bun run coverage` hit 47 of 98. `bun run test` hit 0 of 131.

Zero. Of 131.

Diagnosis from source: coverage is `cache: false` by design (it's a ratchet lane pinned to hosted-CI identity, and the 47 hits were its `^build` dependencies). But test is cacheable. Its cache was structurally cold because sources had changed since the last completed test run, and my agents kill runs early the moment something fails. Killing runs early keeps the cache cold, which makes the next run slower, which makes the next agent likelier to kill it early. Self-fulfilling.

My first reaction was the obvious one: turbo isn't smart enough. That reaction was wrong in an interesting way.

## Turbo is a single-player game

Turborepo is a good incremental engine. It just assumes three things that stopped being true the day I pointed a fleet of coding agents at one repository:

1. One checkout, accumulating cache warmth over time.
2. One run at a time.
3. A human at the end who reads the whole report.

An agent fleet violates all three, and the third one is the deep cut. An agent doesn't read the whole report. It acts on the first error it sees, and the moment it edits a file, every result computed after that first failure is probabilistically garbage. Turbo optimizes the makespan of one graph. A fleet needs something else entirely: time-to-first-actionable-failure, per agent, and aggregate progress per machine-second.

Here's the stat that reframed everything for me. I have not seen a single PR in the last year that passed CI on the first attempt. Not one, regardless of size. People say "do the expensive thing first" and for humans I agree. But if the prior on "something is red" is roughly 1.0, you want the cheapest check that can prove you wrong, first, every time.

## The numbers

So before touching anything I measured. Across 27 clones of the repo, 3.5 weeks of attempt journals, 2,433 finished verification attempts:

- 59% of all attempts were red.
- 17% of all attempts were lock-contention bounces. In my primary checkout, 27%. A quarter of the telemetry was agents slamming into a held lock and giving up.
- Time from a branch going red to that same branch knowing it was green again: median 41 minutes, P95 3.1 hours.
- 292 machine-hours spent inside those red-to-green episodes, on one workstation, in under a month.

I even built a scheduler to fix the contention half. A machine-wide admission queue: heavy verification takes a weighted lease (a full proof charges 3 tokens, a merged preview 5, a review-fix loop 1), contenders wait in a durable queue instead of bounce-failing, priorities age so nothing starves. It shipped and it helped.

And it still wasn't the thing. One agent would hold the expensive seat while nine others sat idle at the bottom of their branches, work finished, waiting to learn whether any of it was real. The queue moved the waiting around. It didn't answer the actual question, which is: what is the cheapest possible signal that returns this specific change to a known-good state, and how fast can it travel?

The principle, as I put it at the time: backpressure. A hose that takes a little at a time instead of being constipated.

Then I slept, and got the dream, and the dream had better vocabulary than I did.

## The silver cord

The silver cord is from Ecclesiastes. It's the thread that ties the spirit to the body, and the verse is about what happens when it's severed: the dust returns to the ground, and the spirit returns to the source that gave it. Return is the whole point of the image. Severing is death.

Now watch how hard the tooling has been trying to tell us this. In git, the remote is literally named origin. Everything must return to the source. My admission scheduler keys its exclusion law on a field called `originKey`, derived from `remote.origin.url`. I did not plan that. The machinery has been speaking the metaphor the entire time, and I still find "source code" being the pun at the bottom of this a little too on the nose.

So, the yoyo. A yoyo is a ball you throw away, plus a string. The string is the entire product. Throw it without one and you've just thrown a ball. And there's a trick every kid learns where the yoyo spins at the bottom of the string, waiting. It's called a sleeper. The whole skill of the trick is the tug that wakes it and brings it home.

That's the dream, mapped:

- The throw is an agent's change, radiating down the dependency graph.
- The string is the silver cord: the channel through which assurance flows back.
- The sleeper is an agent that finished work and sits spinning, done-but-unverified.
- The tug is feedback. How fast the tug arrives is backpressure.
- The return is reunion with main. With origin. With the source.
- And the severed cord is what my fleet actually does all day: the change that learns it was wrong three hours later, the PR that rots in the queue, work that dies where it landed and never comes home.

My CI doesn't fail because checks are slow. It fails because the string is cut. An agent yeets its change down the graph and nothing is holding the other end.

One more detail, because the universe apparently enjoys irony. When I went to measure queue-wait honestly, I found my own scheduler severs its own cord: at the moment a waiting ticket is admitted, the ticket file is deleted, and the lease that replaces it carries neither the ticket's id nor its enqueue time. The record connecting a request to its grant survives only in a filename. Even my backpressure machinery cuts the thread at the exact moment it grants the seat. Also the attempt journal is a ring buffer that keeps the newest 50 attempts per branch and silently drops the rest. My last article was about memory systems that forget. My CI telemetry, it turns out, forgets too.

## So I made it an ontology

The move I refused to make was picking three clever optimizations and shipping them. I'd be guessing, and the guesses above had already been wrong once. The principle I landed on instead: the repo already has verification rules, cache semantics, dependency topology, admission policy, tier obligations. Those rules are the physics the string has to obey. So formalize them. Build a formal model of the repo's verification and backpressure semantics, precise enough that a scheduler can be computed from it instead of hand-written, and judge the whole thing by exactly one number: the fleet-wide distribution of time from "agent writes code" to "agent knows with certainty it passes."

(The knowledge-representation crowd would call the artifact an OWL T-Box with a competency-question suite. Fine. I call it the repo's constitution, with a typechecker.)

Two rules made it real instead of astronautics. First, an admission law: no concept enters the model unless a question we concretely need answered requires it. Decision-relevance or death. Second, the acceptance suite executes. Every competency question is a query that runs against seeded data plus a battery of must-fail fixtures. Green means the model answers the questions. It doesn't mean the model is true. Which brings me to the part of this story I'm proudest of and was most humiliated by.

## The pipeline ran, and it disagreed with me

I ran the model through adversarial review. The reviewers were agents (GPT-5.6 codex lanes at max and ultra reasoning, Grok at its ceiling, a Claude orchestrating), and the rule was that a semantic claim doesn't count unless you execute a counterexample. Not "this looks wrong." Run the query. Show the rows.

Round one found about thirty defects. Round two found that four of round one's fixes were themselves wrong, proven by execution, and that five of my confident claims about my own deployed scheduler were false. Round three found 26 more blockers, including these:

- My exclusion model said "one heavy proof per checkout." The deployed law is one per origin. Two clones of the same repo contending is exactly the illegal state, and my model called it fine. The reviewer proved it by running the query against a graph of the forbidden state and watching it return zero violations.
- My model claimed the scheduler's aging window bounds how long a request can starve. A reviewer ran the actual scheduler and showed a ticket still queued after five aging windows. Aging promotes your priority. It guarantees you nothing. The starvation bound I wanted has to be declared policy, monitored, precisely because nothing enforces it.
- My model asserted a stored link between queue tickets and granted leases. There is no such record. See above: the cord is a filename.

Every one of those counterexamples became a permanent must-fail fixture. The review grew the model an immune system.

Then the extraction: seven agent lanes read the actual sources (turbo config, scheduler schemas, dependency manifests, the verification internals) under a frozen contract that forbids inventing anything, and harvested 337 candidate concepts and 1,038 facts, with a 104-entry ledger of everything that didn't fit.

Then the gate I care about most. Every candidate went through a foundational audit: what does this symbol actually denote, what's its identity, is it a kind or a role or a phase or just an implementation artifact wearing a class name. Two independent adversarial seats, one of them blinded. 235 proposals went in. 234 failed their first review. After five rounds, 31 terms survived, and I personally ratified every one of them, on the record.

31 out of 235. The model is small because the truth is small. I expected to feel deflated by that number. I feel the opposite. Those 31 terms are load-bearing in a way no hand-drawn architecture diagram I've ever made has been, because 204 pretenders died in public, with the execution logs to prove it.

## The replay found a body

Then the part I had promised myself not to write about until it existed. Two more gates ran after the audit. The 31 terms grew into a ratified 38-term taxonomy, and the taxonomy got its first real data: the scheduler's seven policy parameters and four token weights, decoded from the ratified bytes, plus 79 real admission-journal events pinned by digest so that nobody, me included, can quietly edit the evidence later.

And then the projection ran. Not the whole thing. The first layer: a deterministic function that takes the pending requests, the policy, and the reconstructed token ledger, and computes who gets admitted next, under the same law the deployed scheduler enforces, for the slice of it the journal records. Charge plus weight never above a capacity of 10. Publish ahead of verify, with a 120-second aging window. No more than three review-fix seats active at once. It carries five gating properties, and the fifth is the one I care about: replay the real journal and demand that the projection's first choice equals the recorded grant, at every one of the 41 admissions.

It failed six times. Events 66, 68, 71, 73, 75, and 78. All six traced back to a single grant: weight 5, admitted at event 20, never released anywhere in the rest of the journal. With that grant still charged, six real admissions were arithmetically impossible. The scheduler had admitted them anyway.

Here is what happened. The deployed scheduler reaps dead leases by checking whether the holding process is still alive. When it isn't, the tokens come back. What it never does is write that down. The journal has admitted events and released events and no word at all for a lease that died. A yoyo whose string got cut kept charging five tokens against everyone behind it, and the only record of its death is the arithmetic that stops working without one.

So the replay now infers the eviction, under one rule the Codex reviewer insisted on: only when exactly one never-released grant can explain the freed capacity. With two candidates it fails typed rather than guess which lease died. On the frozen journal there is exactly one, at event 66, active tokens dropping from 8 to 3. After that, 41 of 41.

I want to be precise about what this proves. It proves that the modeled admission law, allowed one uniquely attributable dead lease, reproduces all 41 grants in that frozen journal. It does not move the KPI, because admission is the string's tension and not yet its route. The layer that chooses the cheapest tug per agent, walking back up the dependency graph, is a typed seam in the service contract with a name and no body. Nobody has remeasured the number. The only baseline on record is still 41 minutes.

But I got the plot twist I was half hoping for. The cord was supposed to be a metaphor about agents. It turned out to be about the ledger too. A model of the system refused to agree with the system's own diary, and the diary was the one lying by omission.

## The diary learned its words

Both of the cords I said my scheduler cuts on itself are mended now, and it happened in the ten days after the replay. On 2026-09-03 the journal gained events for a lease dying and for a queued ticket dying with the process that filed it. On 2026-09-08 it gained events for a request arriving in the queue and for a request giving up before it was ever admitted, each carrying the checkout, the branch, and, for a dead lease, the last heartbeat it managed to send. Older workers on the same machine keep every row they do not understand byte for byte, across the ring boundary included, and a test proves it. Writing evictions at all waits on a protocol marker, so a worker that predates the words fails closed instead of guessing.

I checked the journal on my workstation this morning. 634 rows. 217 requests enqueued, 17 of them withdrawn before a seat ever came, 200 admitted, 197 released. Two leases died and were written down, heartbeat and all. One ticket died with its submitter. 199 of the 200 admissions trace back to their own enqueue by nonce. The record connecting a request to its grant is a nonce now, not a filename.

The undertaker needed a fix too. The reaper elects one adopter for a dead lock through four filesystem steps, and a property test on hosted CI caught the case where a slow directory listing let two reapers adopt the same corpse and both take the lock. That race had been in production the whole time. Nobody saw it until a test generated the ordering on purpose.

## The number got its own packet

The KPI stopped being a line in an article and became a goal packet with a measurement law, a reproducible script, and a frozen input corpus. The first thing the law did was raise the number. Over the window from 2026-08-04 to 2026-09-03, 2,742 finished attempts and 328 red-to-green episodes: median 43.3 minutes, P95 3.95 hours. Higher than the 41 and 3.1 above, on a later window, and the 24-hour censor the earlier number used is now kept beside an uncut tail so the censor can never quietly become the target. Nobody gets to call that progress. It is the baseline the rest of this has to beat.

The measurement also said where the time goes, which the ontology had not. Two thirds of local wall time is the pre-push wave, median 13.9 minutes per attempt. A fifth is waiting on hosted checks. The single most frequent local failure is the cheapest lane in the pipeline, a five-second install preflight that refused 349 times. When an attempt does fail, the first actionable failure starts about ten seconds in and finishes at a median 8.4 minutes. And 327 attempts, one in ten of every start, began and never recorded a finish. That is the closest thing the journal had to a severed cord, and now it has a count.

Some of it already shipped. The pre-push wave is ordered from the measured evidence seed, policy gates first and then by measured duration, and it stops on the first precise red while letting imprecise environment failures pass. The cheapest check that can prove you wrong, first, is no longer a sentence in this article. It is the wave order. A proof is now a schema, a ProofFact keyed by the lane's input digest, the environment profile, the stage, and the cache epoch, with a ledger service to record and look them up, so certainty can be a lookup instead of a rerun. Nothing enforces the ledger yet. Even the shadow mode that would compare a lookup against a real run is an unchecked box, and so is handing the wave order to the planner seam. Those two boxes are where the string still ends.

The cache half of the original puzzle got a packet too. Its census found 1,503 executable scripts across 142 workspaces and 2,840 configured Turbo nodes, and the rule that came out of it is that a `cache: true` proves nothing. A result earns reuse only for a named computation, on a named reuse layer, in a named environment profile, within a cache epoch, after it has been shadowed against the real run. Four goals came out of that on 2026-09-08. The first real computation in line to be qualified is a lint task on one package. Small, on purpose.

## Two more audits

Meanwhile the model got audited twice more, and the arithmetic stayed humbling. Run 2 read a fresh capture of thirty checkouts and 6,213 journal events, and put 45 proposals through three adversary rounds: 36 failures in the first round, zero by the third. A blinded Grok seat, working from the same evidence in a separate context, converged on the same survivor set as the Codex seats. 21 terms were ratified. All 149 rows carried over from the first run were adjudicated at the same sitting, and 146 of them were retired.

Run 3 is the one the projection needed. Its corpus was fleet-wide: 95 checkouts and 7,869 events, plus a second capture of 94 checkouts and 7,279 events taken after the journal learned its words, so the new events were in evidence. Twenty-one proposals converged, 17 clean and 4 indeterminate, none failed, and 18 were ratified. Among them the schedule's own vocabulary: the step, its index, the episode it belongs to, the specification that governs a projection. Every one carries a flag naming the rival reading that is still alive, because I would rather ratify a term with its doubt attached than park a whole cluster. The taxonomy went from 38 terms to 52. Seventy ratifications across three runs, each bound to the exact bytes of the proposal it accepted.

Publishing the evidence had a cost I did not budget for. Corpus pins of a real fleet carry process ids, hostnames, and user ids, and it took five pull requests of redaction repairs to scrub them from a public repo without breaking the digests that make the pins immutable. Receipts are not free. They are still worth it.

## Honesty notes

Same policy as last time: what's real, what's real since the first draft, and what's still an argument.

Real: the measured baseline, twice. The acceptance suite that executes (25 queries, 21 must-fail fixtures). Seventy ratified terms across three audits, a 52-term taxonomy. The scheduler in production. All of it is in the public repo, linked below, adversarial review logs included.

Real since the first draft: the admission projection with its replay at 41 of 41, and the finding that lease death was unjournaled. Then the repair: a journal that records deaths, arrivals, and withdrawals, and is using the words on my machine today. A KPI packet with its own measurement law and a ratified re-baseline that went up. A pre-push wave that stops on the first precise red. Two more audits. The first draft of this article said the projection was "designed and not built." That sentence is now false, and I would rather correct it in public than pretend the draft was always right.

Still an argument: the route. The function that computes the cheapest tug per agent, the actual schedule, is a seam with a signature and no implementation. The proof ledger has a schema and a service and nothing enforces it. The one KPI this entire effort answers to now reads median 43.3 minutes, P95 3.95 hours, under a law that supersedes the numbers at the top of this article, and it has no close-out measurement yet, so nobody gets to claim it moved. The packet closes by re-running the same script and comparing row by row. Measuring it first was the point. If the ontology can't beat the baseline it was born from, it dies by its own law, and I've now had 204 demonstrations of how that feels.

## Everything returns to the source

The pattern under all of this, the thing I'd tattoo on the repo if repos had skin: an agent's work does not count until it returns to the source, and the speed of that return is a property of the system, not a virtue of the agent. You don't get faster returns by telling agents to be more careful. You get them by engineering the string: cheapest-first checks walking back up the dependency graph, admission that queues instead of bounces, feedback that arrives while the agent still holds the context to act on it.

Agents are the yoyos. Backpressure is the string. Before the silver cord is severed, the work returns to the source that threw it.

## Credit

Ecclesiastes had the cord and the return three thousand years early. The AgentO chapter of The Semantic Web (Ekelhart et al.) supplied the derivation discipline the extraction lanes run on: frozen schemas, issue ledgers, no minting. And the adversarial seats that broke my model deserve the credit reviewers rarely get: they were right and I was wrong, reproducibly, and the logs are public.

If you run agent fleets against a monorepo and your PR queue feels constipated, I'd genuinely like to compare baselines. The code, the model, the review logs, and every number in this article are public.

## Sources

- The packet (full pipeline record): https://github.com/beep-effect/beep-effect/tree/main/explorations/beep-ci-operational-ontology
- The measured baseline: https://github.com/beep-effect/beep-effect/blob/main/explorations/beep-ci-operational-ontology/research/kpi-baseline-2026-08-27.md
- The executable question suite: https://github.com/beep-effect/beep-effect/blob/main/explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml
- Round-3 adversarial review, disposition map: https://github.com/beep-effect/beep-effect/blob/main/explorations/beep-ci-operational-ontology/research/reviews/pre-s4/round3-triage.md
- The decision log (every ruling, including the ones that reversed me): https://github.com/beep-effect/beep-effect/blob/main/explorations/beep-ci-operational-ontology/DECISIONS.md
- The admission scheduler: https://github.com/beep-effect/beep-effect/pull/870
- The 31 ratified terms: https://github.com/beep-effect/beep-effect/pull/889
- The admission projection lab: https://github.com/beep-effect/beep-effect/tree/main/apps/labs/ciops
- The replay evidence (41 of 41, one inferred eviction): https://github.com/beep-effect/beep-effect/blob/main/explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md
- The projection PR and its review amendments: https://github.com/beep-effect/beep-effect/pull/936 and https://github.com/beep-effect/beep-effect/pull/940
- The KPI's own packet, law and baseline: https://github.com/beep-effect/beep-effect/tree/main/goals/time-to-certainty
- The ratified re-baseline (P50 43.3 min, P95 3.95 h): https://github.com/beep-effect/beep-effect/blob/main/goals/time-to-certainty/research/baseline.md
- The journal's new words: https://github.com/beep-effect/beep-effect/pull/964 and https://github.com/beep-effect/beep-effect/pull/1025
- Fail fast on precise pre-push reds: https://github.com/beep-effect/beep-effect/pull/1006
- The proof ledger schema and service: https://github.com/beep-effect/beep-effect/pull/954
- The reaper election race: https://github.com/beep-effect/beep-effect/pull/1077
- Runs 2 and 3 projected into the 52-term taxonomy: https://github.com/beep-effect/beep-effect/pull/1089
- The cache packet: https://github.com/beep-effect/beep-effect/tree/main/explorations/turborepo-quality-cache
- Last time, on memory that forgets: https://x.com/elpresidank/status/2061768508577321257
- The silver cord: Ecclesiastes 12:6-7
<!-- - The animation: <artifact url> -->
<!-- Uncomment the line above once the illustrated page is shared; build.mjs
     --artifact-url fills it in for the page without touching this file. -->
