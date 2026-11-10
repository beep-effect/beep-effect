# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-09

Operator, after the fleet PAT permission fix for issue #3023:

> Do github apps have the same issue? what can we do to make it so that we use less calls in this repo?

Then, after the quick-win PR: "Explore the redesign": open an exploration packet for the structural
quota work, seeded with the verified plan and both reviewers' corrections, then grill it before building.

Raw context from the session that opened this packet:

- 21:31Z: the shared `kriegcloud` REST core bucket hit 5000/5000. Every `gh` call on every fleet host
  (DankStation, beep-worker, dankserver, tbk-worker, tom-pc-1-wsl, grok-bot) returned 403 "API rate limit
  exceeded" until the 21:42Z reset. This happened in the middle of verifying the fleet token fix: those 403s
  looked like permission failures until `x-ratelimit-remaining: 0` showed up.
- After the reset, a 10-minute sample of `gh api rate_limit` with 2–3 detached monitors running showed about
  1,540 REST and 430 GraphQL per hour. The first 5 minutes after the reset ran at about 50/min.
- The beep-fleet-orchestrator App installation token showed its own bucket at core 29/5000. It also gets 403 on
  ruleset history (needs administration=write), like the PATs did.
- #3032 merged (fda98a2c4bd), the quick win: the monitor's default poll went from 30 s to 90 s, and a rate-limited
  poll now sleeps until the reset instead of spending the 5-error budget.
- Done outside the repo: the orchestrator App token is cached for its 1 h life (it used to be minted, with a
  1Password read, on every `ghapp.sh` call), and gh-finals-watch / gh-health-watch moved to the App bucket.
- Still on the table (from the reduction plan, see research/):
  - one GraphQL query per monitor poll instead of `gh pr view` + `gh pr checks` x2 + threads
  - an ETag / conditional-request layer in `makeOctokit` (304 is free)
  - one poller per PR, with a shared status snapshot that the monitor writes and ready / merge-gate / watch read
  - an early return in merge-gate
  - a REST budget ledger shared across the workstation (and the fleet?)
  - webhooks into the inbox instead of polling
  - nobody has measured what T3 Code's PR sweeps cost on 6 hosts
- Agent note (not the operator's words): the real fix is probably "one reader per fact, many consumers", not just tuning intervals. 15 lanes each
  polling the same PR state is the waste.
