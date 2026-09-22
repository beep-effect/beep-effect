# Deep-research wrapper (web lanes)

Headless `grok -p` ends the process when the turn ends, which interrupts a background workflow
run. Proven 2026-09-16: instructing the agent to poll keeps the run alive to completion.

Prompt shape (the lane brief supplies `${QUERY}` and the post-run instructions):

> Launch the built-in deep-research workflow with your workflow tool for this query:
> `${QUERY}`
> The workflow runs in the background, and this headless process exits the moment your turn
> ends, which would kill the run. So DO NOT end your turn until the run has finished: loop by
> running `sleep 60` with your shell tool, then checking the run's status with your workflow tool,
> and repeat. When the run completes, write its final report verbatim to
> `${PKT}/research/${LANE_ID}.deep-research.md`, then follow the post-run instructions.
