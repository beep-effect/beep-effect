# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-09

Operator request, verbatim (T3 Code thread "Prioritize CI and Codebase Goals"; two attachments described
after the text: a screenshot of the T3 "Run on" machine picker, and a screen recording of the Agentic Yoyo
illustrated page):

One common failure in CI is that agents ship code & then "Coverage Regression" fails because the didn't
check to see if the changed or new packages fell bellow the coverage ratchet base line. It should be a
pretty easy thing to codify or even better make a feature of `yeet` itself. We shouldn't need to run the
entire `coverage` command for the whole repo. All that would be required is seeing what packages have
changed code before we publish running coverage on those packages if the changes changed or added code then
checking that packages baseline against the new coverage for that package.

Furthermore recently we shipped CI & Yeet code which checks if changes are documentation only. In following
with the principles of time-to-certainty & the THE_AGENTIC_YOYO.md we really should consider being smarter
about what actually needs to be run to verify changes based on what can be affected. Turbo does a pretty
good job at this generally but it's not as smart as us. turbo repo is supposed to work for anybodies
repository not just ours. `yeet` is our attempt to streamline agent work from changes to merged PR's. To
that end changes that we make to reduce the time-to-certainty & reduce the time it takes for checks &
gauntlets to run by being smarter about what can be affected & then reducing scope based on that knowledge
is a great way to speed things up.

I want you to launch a comprehensive audit of coverage, yeet, ci, quality scripts, turbo config, custom
lints, law tooling & repository dependencies in order for us to find levers like this we can pull,
optimize, refactor or enhance such that these checks take less time & make the agents working in this
repository faster at shipping trust worthy code.

In addition to opus 5.5 agents I also want you to utilize gpt 6 astra high agents to perform this audit.

We first need to identify the surface of the audit. This should include but is not limited to the things
I've mentioned. Once we have the complete surface of what should be audited along this vein & we've
inventories the categories/topics/areas we should then launch agents to research, audit & explore how we
can optimize each area for speed & reduced compute consumption (efficiency).

Ideally by the end of this endeavor it takes < 10 minutes for all CI jobs, local verify & publish.

Additional areas I'm thinking about for enhancements are ways we can effectively verify changes under
heavy load from parallel agents running on this machine. One of the biggest problems is competition for
compute when running parallel agents each competing for admission, CPU & ram when running publish /
verify. There was an example recently where during the effected port in ./scratchpad which later graduated
to realy @beep/packages where the agent running the port was running check, test, lint, etc on the entire
module in scratchpad this was taking hours then I said instead of running it over the whole package why
not just run it on individual files, this ended up being orders of magnitude faster & it was during heavy
competition for resources.

In the past we had this scheduler queue that would run on the machine to make sure the computer wouldn't
get clogged up by multiple agents running yeet simultaneously ultimately slowing everyone down. Problem was
(and I forget the exact reason) it was causing things to be even slower because essentially agents would
see a CI job fail for a PR they were monitoring or some other issue & just hog the queue causing other
agents to never get in & this often resulted in stepping on toes despite warnings against it where agents
would just kill others processes. I thought the idea in principle was good but I think what we had wrong
was the unit of check the queue would accept as well as the scope each check was running (agents would
queue up a full `yeet verify` despite their changes only being for a new goal / exploration packet or a
simple documentation change). Additionally the unit was wrong instead of `yeet verify` / `yeet publish`
being the only unit accepted to the scheduler the unit should be smaller essentially as small as possible
given the surface of the affected change. in the Agentic Yoyo (claude.ai/artifact/HRrKb5gJecmLXp8vMQ3v2L)
the basic idea behind it was that given the affectable surface of a change run in order from cheapest to
most expensive only the checks which are applicable. Imagine if a scheduler or a 'checker agent' (an agent
with the only authority to queue up checks) on active environments (unsure which is the best strategy)
accepted checks one at a time into the queue from agents in order from cheapest to most expensive running
each at a concurrency cap appropriate for each machine making the cycle time between checks being completed
as fast as possible. (instead of full 'yeet / publish' instead agents queued up `bun run lint
--filter=@beep/<package-name>` or even better individual file level checks in order from cheapest to most
expensive ) this would allow each agent to receive feedback on their changes (certainty time / backpressure)
as opposed to agents being in a waiting state ( spining) blocked on either changes which simply just don't
need to be ran given the applicable surface of a change or full yeet publish.

Do you understand? Ask me any questions you have if you need clarification in any way? (although i think
if you explore some of the relevant goal & exploration packets your questions might already have answers)

Also what do you think generally? I'm not saying my ideas are correct but I think they are worth thinking
about & if you have better ideas or suggestions / push back please. please provide them.

Attachments (not copied into assets/, described): a T3 Code screenshot of the "Run on" picker listing the
fleet machines beside the workstation, illustrating the "checker on active environments" idea; a screen
recording of the Agentic Yoyo illustrated page (THE_AGENTIC_YOYO.md's animation: the yoyo thrown one node
at a time down the fan of commit 8733d894e0, loop 2, "a severed cord on sub-agent 2").

## 2026-11-09 (later, same session)

Operator answers to the phase 1 closeout prompt, after reading the surface inventory:

- Next step: launch phase 2 now (one Opus 5.5 and one GPT-6 Astra high auditor per area, adversarial
  refute pass, ranked plan).
- Target: on PR runs, p95 push to every required context green under 10 minutes, reported beside total
  runner-minutes per run; plus every main commit gets a verdict.
- Scheduler: extend the existing QualityScheduler (admission unit = lane or package, weights from measured
  peaks, admit the currently unadmitted work in small units); no new queue or checker agent.
- Audit home: a new exploration packet (this one).
