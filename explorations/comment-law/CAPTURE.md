# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-21

Operator, verbatim:

> Take a look at every code comment in beep-effect.
>
> Categorize each comment as:
> - Tautology: simply repeats what is already visible from the code
> - Excuse: many comments allow the agent to get away with a hacky implementation, which then gets propagated through the code
> - Stale: references code or implementation information that is no longer relevant
> - Decision Record: documents an important, non-obvious decision about the code
>
> For each comment, take this action:
>
> - Tautology/Stale: delete the comment
> - Excuse: delete the comment and file an issue to fix the hacky implementation
> - Decision Record: move it into an ADR
>
> Once this is done:
>
> - Create a lint rule banning comments for <my codebase | this section of the code>
> - Take a ratchet approach, assuming not all comments will be deleted this PR
> - Create a /delete-comment skill in this repository so we can repeat this process later
> - Estimate for me how many lines of code we'll shed by deleting all comments

Same session, mid-turn:

> I would put this into a new exploration packet to graduate into a goal for any changes we decide to make.

The `<my codebase | this section of the code>` placeholder in the lint bullet was left unfilled, so the
lint's scope is an open question.
