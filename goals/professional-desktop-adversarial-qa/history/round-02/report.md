# Round 02 — reviewing the fixes (2026-07-12)

Round 2 pointed the reviewers at round 1's own changes. That was the right call:
**they found a P0 inside them.**

## What the reviewers caught in my work

- **P0 — the ontology seed could destroy a user's document.** It decided to write
  the starter fixture from a *read failure*, and every read failure looked like
  absence, so a permissions error or a transient fault would overwrite a document
  it simply could not read. The file store now distinguishes `notFound` from
  `readFailed` and the seed recovers only from genuine absence. The regression
  test writes nothing when the read fails for any other reason.
- **P1 — the two-tab bug was still live, and worse than round 1 reported.** Two
  windows sending at once produced two copies of the reply to the *first* message
  and none to the second, persisted. Serializing the row writes (round 1) was not
  enough: the *turns* interleave. A turn appends the prompt, reads the whole
  conversation back, and asks the kernel to continue it — so two in flight hand
  the kernel a history ending in two unanswered prompts, and both answer the
  first. The whole turn is now serialized per thread. The test asserts on the
  history the kernel receives and fails with `['user','user']` without the fix.
- **P1 — Enter-to-send consulted a document-wide DOM query**, so a typeahead open
  in another composer suppressed Enter here — the very dead-Enter that check
  exists to prevent.
- **P1 — a stopped turn was invisible until the next interaction.** The server
  records it as the stream unwinds, which happens after the client stops
  listening, so a single refetch raced it and usually won.

## Also fixed

A 50,000-character message was accepted, persisted, rendered, and sent verbatim
to the model — no bound anywhere. A usage-accounting failure *after* the answer
committed failed the turn behind it, so a delivered answer was reported as a
rejected send and a retry produced it twice. A failed Box probe was cached as
long as a successful one, so one hiccup disabled sync for the whole window. The
intake bound lived only in the UI, not at the RPC. Corrupt parent links in the
branch projection are ignored rather than trusted, so they can never truncate a
transcript.

## Open: the unsendable composer (lane B)

Lane B found a draft that could not be sent: Enter and the Send button both did
nothing — no error, no toast, no log, the draft sitting there intact. This is
**not yet root-caused**, and I have not pretended otherwise:

- The captured editor state **decodes** against the wire schema, and **projects**
  to a correct non-empty document — I ran both against the real schema and codec.
  All 32 inline-mark combinations round-trip cleanly.
- At the point of failure the button reads *Send*, not *Stop*, so nothing is
  streaming.
- What I have done is make every refusal path explain itself: a schema-reject, a
  send during streaming, an oversized message, and an empty projection from a
  non-empty editor now each report themselves and keep the draft. A composer that
  declines to send is no longer allowed to look broken.
- A live re-diagnosis is running against the instrumented build to name the
  branch that fires. Until it does, this stays open.

## State

Two rounds: 53 + 20 findings, 51 fixed and verified, 4 backlogged with rationale,
the rest open (see `../../ledgers/findings.md`). The loop has **not** converged —
it exits on two consecutive clean rounds, and round 2 was not clean.
