# HTML worker corpus and boundary qualification

Date: 2026-10-31. Scope: the private raw-text HTML supervisor and bundled Bun
entrypoint, before global engine composition or source maps.

The committed native corpus retains 1,097 complete source outcomes and 1,224
immutable strings. The worker qualification test checks the complete fixture
SHA-256 before decoding its case data. It calls the production supervisor for
every case, using the actual process spawner, captured live Clock and bundled
entrypoint. Two bounded calls may run concurrently. No expected result is
regenerated from the target implementation, shortened or replaced by a digest.

## Source outcomes and process accounting

The frozen source prescribes 840 exact successful strings, 238 Unicode
encoding-declaration rejections and 16 parser-error categories. Three depth
resource outcomes require the separately approved safety failure, preserving
the original source observations. The test checks each case against its full
expected string or closed reason, then checks all four aggregate counts.

The declaration rejections must not launch a child: aggregate process launches
must be exactly 859. For each launched handle, the test wraps the platform's
running-state observation with an independent signal zero process probe after
it reports exit. Each lease must have an acknowledged exit; duplicate checks
of the same handle count only once. The final snapshot must have no active,
queued, owned or quarantined work. These checks supplement the existing
cancellation and delayed-acknowledgement tests rather than simulating them.

## Native input and exact output boundaries

The boundary test sends one million ASCII UTF-16 units through the real worker,
then sends 999,998 ASCII units plus one astral character. The latter still has
one million UTF-16 units but forces the pinned four-byte representation for
999,999 code points: a 3,999,996-byte native input buffer. Both full results must
be preserved. A following small call checks recovery after native memory growth.
A tightened ten-unit source allowance rejects eleven units explicitly.

A 4,096-character ASCII request has a complete 5,586-byte frame. A cleaned
4,096-quote result has a complete 8,257-byte reply. The fixed expected counts
include their JSON envelopes, escaping, base64 padding and terminal newline.
The tests accept the exact ceilings and reject one byte less. An oversized
request must fail before any process is launched. An oversized reply must
return a closed processMessageBytes safety failure without a partial value;
a later small operation must still succeed.

The native output ceiling is also checked at the exact UTF-16 boundary:
emoji plus AB requires four units, succeeds with four and fails with three.
Every supervisor ends with no live admission or process ownership. These tests
use the existing versioned policy and add no limit fields or safety exception.

## Observed runs

The initial focused corpus and boundary run passed both tests in 434.39 s.
The separate expanded boundary run passed in 16.29 s, including the wide
one-million-unit input. The initial corpus run predates the additional per-handle
signal zero acknowledgement assertions. The final server package gate passed
with those assertions: all 859 launched handles had independently confirmed
exits. Audit took 600.4 s and documentation generation took 24.5 s. The use-cases
package gate also passed (audit 36.3 s, documentation generation 34.8 s). Server
type checks and the new test's lint passed. Goal doctor reported no new blocking
findings and the goal index projection passed. Authored spelling, Markdown and
Git whitespace checks passed. These are local phase checks, not final Yeet or
hosted PR proof. No production implementation changed in this qualification
phase.

## Scope retained

This qualifies frozen raw-text HTML outcomes and selected absolute boundaries.
It does not complete global admission or multi-stage work accounting. In
particular, a composed cleaner must distinguish the original source allowance
from intermediate produced text; it cannot silently apply a smaller original
source allowance to an otherwise permitted intermediate value. Internal
transport and primitive input bounds must be reconciled with that contract.
Named/custom cleaner execution, source maps, public failure translation, live
Layer integration and exhaustive engine parity remain open. No canonical
completion row, normalization law or semantic waiver advances here.
