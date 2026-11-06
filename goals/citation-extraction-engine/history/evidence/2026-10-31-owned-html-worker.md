# Owned HTML worker and bounded transport

Date: 2026-10-31. Scope: private Bun process supervisor and HTML kernel entrypoint.

The private HTML preparation and authenticated native kernel now execute through
an owned child process. One operation owns one child; there is no idle process
pool. The public engine, live Layer, source maps and complete cleaner pipeline
remain unfinished. The original source corpus, approved native-resource safety
exception and canonical completion accounting are unchanged.

## Transport and process capability

Versioned schema messages carry one job and three ordered replies: Ready,
Started and either Success or Failure. The job carries prepared bytes, encoding,
HTML mode and the output ceiling. It contains no callbacks. The error reply
contains only the closed kernel, completion or safety failure union. Parent and
child reject excess fields, malformed UTF-8, arrays, excess object depth,
incorrect ordering, extra frames and incomplete final frames.

The message ceiling includes all UTF-8 JSON bytes and the final newline. Job
encoding charges the full header and exact base64 expansion before allocating
the encoded frame. Success encoding scans exact JSON string escaping before
serialization, including lone surrogates and astral characters. The reader
checks capacity before growing a geometric buffer; it does not accumulate one
allocation per fragment. Scans yield cooperatively. Minimum control replies are
charged before spawning. A result that exceeds the message budget is converted
to a bounded safety failure rather than partial text.

The injected runtime specifies the executable, script and working directory.
The child receives an empty environment, disables environment-file loading and
automatic dependency installation, runs without a shell, and discards stderr.
Only the message ceiling appears in its arguments; source text travels through
bounded standard input. The entrypoint authenticates a bounded snapshot of the
packaged kernel before sending Ready. Bun platform services are an explicit
production dependency, moved from the existing development dependency without
changing the catalog version.

## Ownership, timing and admission

The factory captures Clock, process spawner and owner Scope. Every returned
method has R = never. Admission bounds active operations and queued operations;
queue waiting has its own deadline. Preparation, startup, traffic and native
execution share the clean deadline. An independent total operation timer also
covers queueing, so entering execution cannot reset the total allowance.
Caller clock replacement cannot change these captured timers. No child progress
message extends a timer.

A masked ownership transfer registers the child lease before spawning and
records its handle before request transmission. Cancellation cannot fall between
launch and parent ownership. The fixed child program creates no descendants.
The parent sends SIGKILL to the exact child on retirement and verifies it is no
longer running before closing its child Scope and releasing admission capacity.
A reply alone never releases capacity or authorizes publication.

Retirement has its own bounded cleanup window. If acknowledgement does not
arrive, the lease and permit remain held in quarantine and all replacement
admission stops. One explicitly detached retirement task retains the exact
process and Scope beyond caller cancellation or owner-Scope closure. No work
fiber is detached. Late acknowledgement removes the lease and releases its
permit once. The explicit reap method retries completed failed retirement
without duplicating a live retirement task. Scope closure stops new admission
and retires owned work; an unresolved cleanup logs only a fixed source-free
message. Native operating-system launch itself uses a masked ownership transfer;
this is not a claim that a stalled operating-system spawn syscall is preemptible.

## Focused execution evidence

The focused tests run on Bun 1.4.4 with the actual process spawner. Most
checks capture the live Clock. The busy-loop stage timer, queue timer and total
queueing timer use an explicitly controlled captured Clock: the test first
observes the actual process/queue state, then releases the selected sleep.
This avoids treating short startup timing under package-wide contention as
proof of native execution. Separate live-clock tests exercise stage expiry and
total expiry during cleanup. The real entrypoint preserves star-pagination child selection,
astral/BOM text and the approved depth-limit failure. Independent post-return
process probes confirm the three real child PIDs no longer exist.

A fixture executes an infinite WebAssembly loop in the child while a parent
heartbeat continues. Stage expiry and caller cancellation stop that child.
Other fixtures exercise bounded queueing, total expiry across queueing, delayed
termination acknowledgement, total expiry during cleanup, late acknowledgement,
owner-Scope closure, launch failure, environment-file isolation and malformed,
partial, trailing or oversized traffic. Delayed acknowledgement is deliberately
injected around a real SIGKILL; it proves conservative ownership accounting,
not a simulated claim that an unkillable native process was observed.

The protocol tests round-trip 1,071 immutable input strings, check exact frame
ceilings and base64 residues, exercise every split and one-byte fragmentation,
and reject malformed structure and UTF-8. These supplement the existing 1,097
native outcome cases; they do not replace exhaustive whole-engine qualification.

## Phase checks

Both package-verification commands passed: law-practice-server audit (73.6 s)
and documentation generation (23.3 s), and law-practice-use-cases audit (62.2 s)
and documentation generation (20.4 s). The final focused run passed all thirteen
tests in 4.37 s. Server type checks passed. The ten-component evidence audit
passed while correctly retaining pending target parity. All 37 divergence
corruption controls rejected their altered inputs; the default completion mode
continues to reject unfinished proof. Goal doctor reported no new blocking
findings and the goal index projection passed. Authored worker code/evidence
passed spelling checks; the README and this note passed Markdown lint. Git
whitespace checks passed. These are phase-local checks, not final Yeet or hosted
PR evidence, and do not close the overall goal.

## Remaining integration obligations

The private supervisor has local admission counters. The complete engine must
compose global admission, shared operation budgets across multiple cleaner
stages and the final public failure translator. Source maps, named cleaner
composition, production Layer wiring, extreme native-memory qualification and
exhaustive end-to-end parity remain open. No canonical row, normalization law,
semantic waiver or public completion claim advances in this phase.
