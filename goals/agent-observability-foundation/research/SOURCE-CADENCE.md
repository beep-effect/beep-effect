# Source discovery cadence and truthful read health

The existing streaming scanner and durable incremental reader are now connected
to the actual private worker entrypoint through explicit optional launch settings.
No real source was enrolled. An omitted declaration remains `NotConfigured`, not
an empty or successfully covered population. A declaration names at most eight
private, disjoint roots, their supported transcript format and retired status,
traversal/page limits, and an independent cadence/deadline.

## Runtime ownership

Native delivery and source discovery run in separate sequential loops under one
runtime owner. Slow discovery cannot consume the native loop's deadline. Each
loop delays after its previous cycle instead of accumulating catch-up work. Both
use worker admission, and configured discovery requires at least two admission
slots. Startup remains paused; the scanner opens no source helper until admitted.
One outer shutdown path interrupts both loops, closes intake and drains admitted
work, after which the worker suspends the bound scanner. Defects terminate the
owner; expected errors and cooperative deadlines produce explicit failed/unknown
observations and allow another bounded cycle. Hard OS ceilings still apply.

This runtime starts no legacy timer, performs no source mutation and enables no
implicit expiry, retirement or historical replay. Reconstructed pages remain a
separate local stream; the native scheduler does not silently export them.

## Read progress is more than the latest directory page

An empty directory page is insufficient evidence of idle collection. A previous
page may have discovered a file whose read failed or whose final line is partial.
Likewise, accepting one bounded page does not mean the file has been drained.

Each scanner root now retains bounded counters for its current traversal:
assessed, unassessed, accepted, idle, partial, backlogged and failed file
observations. These counters require no per-file history map. The private discovery
page owns a single-use completion capability that records only its matching
read outcomes and refuses mismatched, repeated or obsolete-cycle results.
The journal's accepted byte positions remain the durable authority; these health
counters reset on a new traversal/restart and are never delivery receipts.

Accepted reader outcomes expose remaining sampled bytes and partial-tail state.
That preserves a mixed page containing both an accepted event and an unfinished
line. Root failure/partial/backlog evidence survives later directory-only pages.
A completed traversal with unassessed files remains incomplete. Idle requires
completed current root traversals with assessed files and no accepted progress,
backlog, partial tails or failures. Retired-only declarations are excluded.
Unavailable/changed/overflow roots and failed reads are degraded. Scanning,
waiting for a partial line, backlog, active, paused, stopped, stale and clock
regression remain distinct. None of them proves fleet-wide source coverage.

## Privacy and metrics

The private health response contains hashed root identity and bounded counters,
never private candidate paths or source text. Prometheus metrics use fixed names
and enumerated phase/root-state labels only. They distinguish latest-pass counts
from current-root-cycle counts. Missing counts after failure/deadline are omitted;
zero is not substituted for unknown progress. The external observer must still
combine scrape availability with cycle timestamps and independent source
expectations. Event-time lag and fleet denominators remain separate work.

## Verification

Focused runtime/discovery/sweep/worker/launch tests and actual process proof are
recorded separately in `ops/source-cadence-verification.json`. The process proof
uses synthetic files and a bounded loopback receiver, with the actual entrypoint
under 512 MiB RAM, zero extra swap, finite CPU/task/file/descriptor limits and
exclusive ownership. It proves zero source pages before resume, autonomous
metadata intake, persistent partial-tail reporting, private-canary absence,
controlled restart and reuse of durable accepted source positions. Native
accepted-but-missing read-back remains degraded with one backend POST total.
All owned worker processes are stopped. No deliberate OOM is exercised.

Production installation/frontend, reconstructed backend delivery, source/event
lag and external notification delivery, actual host/root/session/attempt identity
and denominators, backup lifecycle, CLI/desktop/live canary, review and repository
closeout remain required. Reversal before enrollment is leaving discovery absent
from launch configuration and preserving the historical recovery hold.
