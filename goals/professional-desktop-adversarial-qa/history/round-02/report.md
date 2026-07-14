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

## The unsendable composer was a P0, and it was about time, not typing

Lane B found a draft that could not be sent: Enter and the Send button both did
nothing — no error, no toast, no log, the draft sitting there intact. Lane B
blamed the wire schema. That was wrong, and so were my first three theories.

The state **decoded** cleanly, **projected** to a correct non-empty document, and
all 32 inline-mark combinations round-tripped through the codec without dropping
anything. None of it explained a dead Send button.

The actual cause: **the composer stops sending 30 seconds after it mounts.** The
registry disposes any atom with no listeners and no dependents once its idle TTL
elapses, and the desktop sets one (30s). The composer's per-editor config — the
send handler, the attach handler, the size limit, the feature set — is seeded once
at mount and then only ever read at fire time, so nothing held it. It was swept,
came back as its defaults, and `useAtomInitialValues` seeds an atom only once per
registry, so it was never re-seeded. The default send handler returns `undefined`,
and the binding treats anything but `true` as "not dispatched".

So the composer silently stopped sending, permanently. What made this so hard to
see is that the trigger had nothing to do with what lane B was doing — the marks,
the combinations, the content were all irrelevant. It was **elapsed time**. Lane B
spent minutes toggling marks before pressing Send; the "fresh thread" control that
seemed to prove the composer was fine only worked because it sent immediately
after mounting, inside the TTL window.

Fixed by mounting the seeded config for the composer's lifetime. And because a
send that goes nowhere and says nothing is indistinguishable from a broken app, an
unbound send handler is now loud: it reports a blocked send instead of discarding
it. Both regression tests were mutation-tested — each fails when its fix is
reverted.

This is a *class*, not an instance: any writable state atom that is written and
never subscribed loses its value 30 seconds later, silently. An audit of every
atom surface in the app is underway.

## The same bug, three more times

The composer was an instance of a class, so I audited every atom surface in the app
for it: **state written into an atom that nothing subscribes to, swept back to its
default 30 seconds later.** Three more, all confirmed against the source:

- **The ontology workbench destroyed the open document.** Its atoms are subscribed
  only from inside the workbench, which the app unmounts on a surface switch. Open a
  `.ttl`, edit it, glance at Chat for half a minute, come back: *no file open*, and
  every unsaved change in the change log is gone. No error, no prompt, nothing to
  undo. That is the user's work, destroyed in silence — the worst bug of the
  campaign.
- **The chat surface lost the user's thread selection**, whose default means "follow
  the list" — so after 30 seconds away you came back to a *different* conversation,
  and the next thing you typed went into it.
- **A spinner button held past the TTL lost its own timer handle**, so releasing it
  cleared nothing and the value span forever.

The document and the selection are application state, not view state, and they are
singletons, so keeping them alive cannot leak. The graph's DOM element and WebGL
backend are deliberately left sweepable — pinning *those* to a dead view is the bug,
not the fix.

Worth recording: my own first guess in that audit (thread drafts) was **wrong** —
drafts are `Atom.kvs`-backed and re-read their persisted value. And one verifier
"refuted" the thread-selection finding because the atom *is* subscribed. It is —
inside a subtree that unmounts. Adversarial review cuts both ways, so I checked each
one against the source myself.

## What the reviewers found that I had to reject

Lane C reported that a bare YouTube URL renders as a link instead of an embed, and
recommended normalizing URLs into youtube blocks in the codec. That would have been
wrong: the assistant emits structured blocks, and its system prompt says *"Use
youtube blocks only with the bare 11-character video id, never a full URL."* Asked
for a URL, the model correctly produced a link. Asked for the video **as a block**,
it produces an embed that survives a reload — verified live.

## Verified in the browser, not just in tests

Every fix above was re-checked in Chrome against the running app:

- the persisted mermaid diagram renders after a reload (`diagrams: 1, svgs: 1,
  leftoverCode: 0`) where the probe previously found a hidden `<code>` and nothing
  beside it;
- the composer still sends after sitting idle for 60 seconds;
- the thread selection survives a 60-second trip to another surface;
- a youtube block renders an embed and stays one across a reload.

The mermaid bug is the one that most deserved this: **jsdom could not see it.** My
headless repro passed against the broken code, because the injected `<div>` only
disappears where Lexical actually reconciles. The browser is what proved it.

## State

Two rounds: 53 + 24 findings. 57 fixed and verified, 1 rejected with reasons, 4
backlogged, the rest open (see `../../ledgers/findings.md`). Every fix that could
carry a regression test has one, and each was mutation-tested — reverted, and
confirmed to fail.

The loop has **not** converged: it exits on two consecutive clean rounds, and round 2
found a P0. Lanes D (ontology), E (sync/intake) and F (cross-cutting) are still
running on the frozen tree.
