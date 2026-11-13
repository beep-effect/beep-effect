# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-12 — run-time binding

**Question:** Stages are installed per request because install-time capture is
how the request's text budget, Scope and nested admission reach them. With the
stage tree installed once per engine, how do those values reach a stage?

**Answer:** One request-scoped `Context.Service`, `CitationInvocation`.
Installed stages keep it in their requirement channel; the public entry opens
one invocation per request and provides it, so public methods stay `R = never`.

**Rationale:** Operator answer in align round 1 (recommended option). Rejected:
an explicit parameter on every `run` and helper (same information, about 36
factory sites and every helper signature change, no compiler help in finding a
missed capture) and a memoized install tree re-bound through a mutable holder
(shared mutable state across up to two concurrent requests). Refinement made
while designing: the invocation is itself the proof of admission, so the
pass-through nested admission view (`captureCitationOperationChildren`) is
removed instead of being carried as a field.

## 2026-11-12 — detach strategy

**Question:** After install-once, the nested detach round trips run at engine
construction instead of per request. What happens to them?

**Answer:** Detach once where untrusted configuration enters the engine and
carry ownership in the type: an owned-configuration brand that only the
boundary module can mint. Child installers accept the owned value and never
copy.

**Rationale:** Operator answer in align round 1 (recommended option). Schema
has no freeze or structural sharing (RESEARCH.md, Effect v4 building blocks),
so ownership cannot be checked at run time without a copy or an identity memo;
the memo is ruled out by the capture and by the repo's laws. Rejected: leaving
every nested copy in place (engine construction, which every test shard pays,
stays slow) and deferring the choice to the goal.

## 2026-11-12 — regex worker lifetime

**Question:** Protocol v3 needs a worker that serves more than one job. How
long does one worker process live?

**Answer:** One worker per request. It is spawned lazily on the request's first
regex job, serves that request's jobs one at a time under a parent-owned timer
per job, and is retired when the invocation's Scope closes. A deadline, an
interruption during a job or a protocol violation kills it with SIGKILL through
the existing retirement path, and the request fails as it does today.

**Rationale:** Operator answer in align round 1 (recommended option). About 291
spawns per ten calls become about ten. No text from one request shares a
process with another request's, the native lease maps one to one onto the
admitted operation, and because a regex deadline already fails the request no
respawn, recycle or poisoned-job rule is needed. Rejected: an engine-lived pool
(removes the last spawn per request but needs all of those rules and a split
lease), and keeping one job per process with a slimmer entry (no isolation
change, but 291 spawns remain with a floor near 27 ms each).

## 2026-11-12 — graduation shape

**Question:** One goal or several?

**Answer:** Two goals. `citation-engine-install-once` carries the measurement
fixture, the invocation binding, the hoisted stage tree and tokenizer, and
owned configuration. `citation-regex-worker-v3` carries the protocol, the
session, the lease and retirement changes and the kill proof; it starts after
the first goal's binding slice merges.

**Rationale:** Operator answer in align round 1 (recommended option). The
isolation contract change needs its own policy version and real-process proof
and should not share a packet with a refactor. Three goals would leave a very
small detach packet.

## 2026-11-12 — per-job deadline accounting

**Question:** Protocol v2 runs one timer over spawn, startup, traffic and
matching. What does the v3 timer cover?

**Answer:** Two timers, both `regexDeadline`. The startup timer covers spawn to
the worker's `Ready`. The job timer covers the job frame write to the terminal
reply. Either expiry kills the process and fails with
`CitationSafetyLimitExceeded` (`regexDeadline`).

**Rationale:** Agent decision. `regexDeadline` is at most 1 s
(`CitationEngine.limits.ts:61`) and a spawn measured about 130 ms on a loaded
host, so charging the spawn to the first job makes that job's bound depend on
host load. Separate timers keep every job's matching bound identical. The cost
is that the first job's worst case is two deadlines instead of one; the
operation deadline still bounds the request. Reversal: fold startup back into
the first job's timer.

## 2026-11-12 — descriptor delivery

**Question:** A v2 worker is bound to one descriptor in its startup argument. A
v3 worker serves many patterns.

**Answer:** Each job carries its parent-selected descriptor. The worker
re-derives the program from the pattern bytes and checks it against that
descriptor on every job, exactly as it does once today. The startup argument
keeps only limits and engine.

**Rationale:** Agent decision. It preserves the rule that the worker validates
canonical words, width, limits and matching semantics before execution, and it
keeps pattern material out of the process argument list. Reversal: send a
descriptor table at startup and reference entries by index.

## 2026-11-12 — policy version

**Question:** Does v3 change the published engine policy?

**Answer:** Yes. The worker goal ships it as `citation-engine-policy/v2` with a
major changeset, and adds no new limit fields.

**Rationale:** Agent decision, following the predecessor's rule that the
isolation decision is "reversible only through a new policy version with
equivalent interruption proof"
(`goals/citation-extraction-engine/history/evidence/2026-10-28-limits-isolation-contract.md`).
A jobs-per-process ceiling was considered and left out: the request's own
token and deadline limits already bound a request-lived worker. Reversal:
restore v1 and protocol v2.

## 2026-11-12 — sibling workers — DEFERRED

**Question:** Do the Diff, Markup and Recognizer workers move to the session
model too?

**Answer:** DEFERRED. They stay one process per job.

**Rationale:** They run a handful of times per request; regex runs hundreds.
Reopen if the after-numbers show them in the top three costs.

## 2026-11-12 — engine-lived pool — DEFERRED

**Question:** Should warm workers outlive a request?

**Answer:** DEFERRED, gated on measurement.

**Rationale:** Reopen at `decompose` only if, after both goals land, the one
spawn per request is more than ten percent of a request on the fixture.

## 2026-11-12 — native capacity unit

**Question:** A request-lived regex worker that holds its own lease starves
the same request's Diff and Xml processes, which draw on one total ceiling
(design review finding 1). How is native capacity counted?

**Answer:** One lane per invocation. Each admitted operation holds one unit of
native capacity with at most one child alive in it. A Diff or Xml job retires
the idle regex worker first, with confirmation, and the worker restarts lazily.
The limits schema gains one cross-field check: regex processes at least equal
to operations.

**Rationale:** Operator answer in the shape review (recommended option). A
request never waits on itself or on another request, and the bound on live
children is unchanged. Rejected: release and reacquire a per-process lease
around every other native job (each reacquire can queue behind another request
for the queue deadline), and raising the native ceiling (doubles the live
child bound and changes a limit value). This supersedes the lease wording in
the "regex worker lifetime" entry: the worker lives in the request's lane, and
a plain-text request still spawns once.

## 2026-11-12 — shape confirmed

**Question:** Does the brief and the seven-slice plan match the operator's
picture?

**Answer:** Yes, graduate as shaped: both goals now, first slice A1.

**Rationale:** Operator answer in the shape review. Revision 2 of the design
resolves every BLOCKER and MAJOR from the independent review
(`research/design-review-2026-11-12.md`).
