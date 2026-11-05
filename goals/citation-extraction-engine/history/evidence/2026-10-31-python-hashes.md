# Frozen Python primitive hashes for cleaner registry keys

Status: private primitive implementation; live protocols and registry remain open.

## Source and attribution

CPython 3.11.15 uses SipHash13 on this pinned interpreter, with 64-bit signed
results, a zero small-string cutoff, little-endian Unicode storage and hash seed
zero. The zero seed clears the hash secret. Empty input hashes to zero, and a
signed minus-one result is replaced with minus two. Unicode hashes its canonical
one-, two- or four-byte code-point storage, not UTF-8 or JavaScript UTF-16 bytes.

The producer pins `Python/pyhash.c`, `Include/pyhash.h`,
`Python/bootstrap_hash.c`, `Objects/unicodeobject.c`, the complete CPython
license and the oracle commit/tree/license. The primitive adapts the SipHash
implementation by Marek Majkowski, Copyright 2013, with Python modifications.
The full embedded MIT notice is reproduced in the root third-party notices,
in addition to the existing full PSF license. The verifier rejects missing or
altered MIT text. Markdown indentation preserves the complete original notice
content after removing the four rendering-indent spaces; no lint suppression
or license wording change is introduced.

## Complete captured vectors

`ops/probe-python-hashes.py` captures 1,056 full vectors: 526 byte values and
530 Unicode values. They cover every single Latin-1 code point and every single
byte, Unicode storage-width boundaries, lone surrogates, supplementary scalars,
embedded zero, all SipHash tail lengths and values across cooperative scan/hash
boundaries. Each Unicode row retains its exact source code points, canonical
width, full native byte hex, hash and JSON text projection.

The report SHA-256 is
`844816162ce40d63b3e21a447bb4d1aa2c2310157a959c8c5c0f4ae8d86b0c89`.
Optional source regeneration must reproduce those exact bytes. The verifier
rejects fourteen corruptions, including changed seed/algorithm, missing vectors,
altered native width or code points, fabricated text round-trip claims and
missing/changed license text.

Two explicit cases contain adjacent surrogate code points. JSON decoding and
JavaScript text merge those pairs into supplementary scalars. Their source hash
is therefore preserved through explicit native storage, rather than inferred
from the JSON text projection. Full code-point sequences and raw storage remain
authoritative; the verifier checks the projection and the distinction. This is
not a normalization that equates the two source values. The target checks all
530 Unicode hashes through explicit storage, all 1,056 raw-storage byte hashes,
and the 528 round-trippable Unicode values through ordinary text. Both paired
surrogate controls independently assert that ordinary text gives a different
hash while explicit storage matches the source.

## Captured Effect service

`PythonHash.ts` exposes captured byte, Unicode-storage and text methods, each
with R = never. It fixes the oracle's seed/algorithm/result rules. Text preflight
selects width by code points and streams little-endian bytes into SipHash without
allocating a full encoded copy. Explicit storage validates its canonical width,
complete words, Unicode range and UTF-16 size. Inputs must be immutable throughout
evaluation; these are already-owned server adapter values, not general Python
object protocol evaluation.

Input schemas use the existing absolute intermediate-text ceiling and its
four-byte native-storage derivative. The raw source ceiling is not reapplied to
already-owned intermediate values. The service captures the Clock and earlier
of the configured clean/operation durations. Scans yield at least every 4,096
code points; hashing yields at least every 8,192 bytes. No partial hash escapes
a timeout or cancellation. The enclosing cleaner still owns its cumulative
operation timer and work budget. Hashing does not mint text-production tickets
or source-identity receipts.

Three focused tests cover all vectors, malformed/noncanonical storage, absolute
input ceilings, text rejection without coercion, captured-clock replacement,
deadline failure and cooperative byte cancellation. Source and test typechecks
pass. Full package and portable gate results are recorded below after completion.

## Remaining scope

The current cleaner value owner still needs to carry explicit source Unicode
storage where ordinary text cannot represent the source distinction. This
primitive alone does not close that ownership obligation. General object hash,
reflected equality, truth and callable protocols, live registry/cursor ownership,
all 1,155 cleaner sequence cases, global admission/quarantine and public error
translation remain open. Extraction, annotation, resolution, maps, Bluebook laws,
final service/Layer and one-PR delivery remain required. No semantic or safety
waiver, canonical target completion or extension disposition is promoted.

## Verification attempts

The first full server attempt did not pass: audit ended after 210.6 seconds
with test exit 143, and documentation generation ended after 14.0 seconds with
exit 130. No test summary or assertion failure was returned. The concurrent
use-cases attempt failed to spawn documentation generation and is also not a
pass. The signal/spawn origins are not established. No lane runtime processes
remained before retrying. Subsequent package attempts run serially, keeping
implementation, tests, fixture bytes and production limits unchanged. Final
results are recorded below after the exact owned runs complete.

The intermediate serial server run passed audit in 386.1 seconds and
documentation generation in 26.2 seconds. Review then found that the minimum
Duration still aliased caller-owned mutable policy data. A targeted regression
failed before the fix: mutating the caller's duration changed the observed timer
from the captured 1,000 milliseconds to 20,000 milliseconds. The factory now
snapshots the selected duration through milliseconds, matching the existing
literal-cleaner adapter's capture rule. The strengthened three-test focused run
and source/test typechecks pass. A new serial full server gate verifies the
final implementation and test bytes; the intermediate pass is not substituted
for it.

The next direct final-byte attempt was forcibly killed: audit ended after
403.2 seconds with SIGKILL/exit 137, and documentation generation ended after
7.9 seconds with exit 130. It returned no test summary and is not a pass.
Resource counters did not establish the signal origin. No exact-entry native
worker processes remained before the next attempt.

The next final-byte server attempt ran in the existing local agent-work slice
as a tracked private user-service identity. It had an eight-core CPU
quota, 4 GiB memory-high and 8 GiB memory-max bounds, 1,024 tasks, a twenty-minute
runtime maximum and a thirty-second stop window. It preserves the package's
existing two-worker/two-test runner settings and all production limits. Five
source/fixture/configuration/lock hashes are recorded in the private operational
receipt, and the exact service identity is observed before accepting a result.
This is local managed proof, not hosted CI or production deployment.

The first managed final-byte attempt did not pass audit: the test process exited
143 after 105.0 seconds without a test summary. Documentation generation passed
in 97.5 seconds. The user service reported an ordinary exit-code failure, not
an out-of-memory or runtime-limit event; memory peaked at 4,318,973,952 bytes.
Its receipt verifies that all five recorded source bindings stayed unchanged.

A signal-only diagnostic retry ran as a separately tracked private user-service
identity, under the same bounds. The task-local tracer
is strace 7.3-1 from the configured package repository, package SHA-256
`b3c67815289238f99ab6422d0cd562dbbb5becca8b49179fffad72be9f23e1a0`.
It was extracted only into the task cache after checksum validation; no system
package was installed. It observes only the owned command and descendants,
process-signal system calls and termination-signal metadata. Source text,
environments and unrelated processes are not traced. The diagnostic result is
not inferred from the service's provisional running state.

The signal trace identifies the workstation's earlyoom memory guard as the
sender of SIGTERM to the owned test runner and documentation process. That
traced attempt failed audit after 551.1 seconds and documentation after
43.3 seconds. Its exact source bindings are unchanged. Local heavy retries stop;
no memory reserve, guard configuration or process priority is weakened.

The existing beep-worker has another active proof and is left untouched. The
existing dankserver worker is idle, has the expected 7 GiB shared job ceiling,
200 percent CPU quota and no worker swap, and has Bun 1.4.4 like the workstation.
Ordinary access has no forwarded SSH agent. A separate detached worktree receives
the exact source commit plus the fifteen-file uncommitted overlay through a
checksum-verified bundle. Its current checkout and other worktrees are preserved.
The private source receipt binds the bundle, overlay and five critical files.
Only a bounded, serial qualification job may run there. This is remote source
qualification, not hosted CI, a public push or final delivery proof.

## Subsequent managed qualification attempts

The first dankserver job passed its frozen installation and all 53 prerequisite
builds, then reached the one-hour service limit during server package
verification. Its retained application receipt still said running after the
service terminated; the authoritative service timeout takes precedence. That
attempt is not a package pass.

The next attempt used the same full checks and 5/6 GiB task memory thresholds,
with the Go compiler's memory target set to 1,536 MiB, GC percentage 50 and two
Go execution processors. The live compiler inherited those settings. Its
approximately 3.2 GiB resident footprint, documentation parent's approximately
1.4 GiB and verifier parent's approximately 0.4 GiB still caused sustained
task memory-high reclaim. The owned run was deliberately stopped to test a
different resource setting; this is a controlled experiment stop, not an
assertion failure or accepted proof.

A third attempt added Bun's documented lower-memory mode through
`BUN_OPTIONS=--smol`. The actual Bun processes inherited that setting. The
combined documentation footprint still reached the task's 5 GiB threshold,
and the worker account also reached its existing parent memory-high threshold.
Neither task had a recorded out-of-memory kill at the observed pressure point.
The run was stopped for host migration. Both controlled stops exhausted their
thirty-second cleanup windows and were fully reaped by their owned service
groups. The resulting service timeout status does not turn either stop into a
test result. Private receipts retain the requested stop, counters and terminal
group state.

Live reinspection found the previously busy beep-worker's proof jobs finished,
with no remaining proof process groups. Its separate background daemon and
application remain untouched. An isolated detached worktree receives the same
checksum-verified bundle and fifteen-file overlay; all source and critical
bindings match. The worker's existing Bun 1.4.4 and Node 24.22.1 installations
are selected through task-owned executable links. The dirty main checkout and
all unrelated worktrees are preserved. No SSH agent or secret-service
environment variable is inherited by the proof.

The new task fits the worker's unchanged 7 GiB memory-high and 8 GiB shared
maximum: 5.5 GiB task memory-high, the same 6 GiB hard maximum, zero swap,
200 percent CPU, 448 tasks and one hour. Go's memory target is 3 GiB, GC
percentage 50 and processor count two; Bun retains lower-memory mode. These
settings change execution resources, not production policy or check scope.
Frozen installation and all 53 prerequisite builds passed. On 2026-11-02 the
operator directed publication without waiting for verification or local compute.
The owned remote proof was stopped, its receipts retained, and its process
group confirmed empty. The full server package gate did not finish; use-cases
verification and final portable controls in that driver did not run. No final
success is inferred from the completed installation and builds.

The existing branch is published as one draft PR under the repository's
constrained-compute push-first route. The three focused hash tests, source/test
type checks, 1,056 source vectors and fourteen corruption controls passed as
recorded above. Full package verification and hosted CI remain unverified at
publication. This handoff changes proof scheduling and publication timing;
it does not accept incomplete engine parity or waive any final quality gate.
