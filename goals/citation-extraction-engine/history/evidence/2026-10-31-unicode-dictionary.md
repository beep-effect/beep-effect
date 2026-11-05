# Combined Unicode dictionary behavior for the live cleaner registry

Status: private backend evidence; complete registry and engine proof remain open.

## Source behavior

CPython 3.11.15 `dictobject.c` distinguishes exact-string combined tables from
combined general-key tables. Exact strings use internal content comparison;
a non-exact query uses rich comparison with the stored key. Subclasses are
non-exact. Inserting a non-exact key converts and rebuilds the Unicode table
before lookup, even if comparison finds an existing key or fails. Conversion
changes the table identity, so an enclosing equality callback's lookup must
restart. Clearing resets to the empty Unicode table. These are the paths
used by the initially string-keyed eyecite cleaner registry.

The existing general-key backend now accepts an optional captured exact-string
classifier on its comparison service. The classifier reads immutable owned text
without hooks or mutation. Without it, existing general-key behavior remains.
With it, the backend performs source Unicode lookup, publishes conversion
before calling equality, shares existing key-change restart checks and resets
Unicode mode on clear. The rich-comparison adapter remains responsible for
reflected/subclass ordering; this phase does not invent a Python protocol layer.

The source and license hashes remain the pinned CPython hashes already recorded
in the root third-party notices. The new source report additionally pins its
producer, oracle commit/tree/license, interpreter, hash seed and algorithm.

## Complete captured observations

`ops/probe-unicode-dictionary.py` captures thirteen histories and forty complete
operation outcomes under Python 3.11.15 with hash seed zero. Each history keeps
all key objects alive, distinguishes fresh equal exact strings and records
all 62 custom hash/equality and mutation events plus ordered table contents.
Cases cover exact
text, host/subclass hit and miss, matched and unmatched insertion, deletion,
value replacement, clear/refill, conversion during equality, mutation followed
by an exception and clearing after general conversion.

The report SHA-256 is
`2c8625cb9c7cd72a3a3c030a8606b5d9cada4e14b45e6ffa77065a79162dc22b`.
The dedicated verifier seals all full values and rejects twelve corruptions;
optional regeneration must reproduce the exact committed bytes. The target
replays all forty outcomes, hook sequences and ordered entry lists. A separate
invariant test observes the captured rich-compare port to verify that exact
Unicode lookups bypass it and general-table lookups retain it after conversion.
The trace adapter is controlled test code, not production source hash or protocol
production. Supplied source hashes are not a substitute for the remaining
production hash implementation.

## Retained registry lifetime and work

A registry must survive independent cleaning operations. The backend's old
lifetime probe counter and iteration-limited insertion identity would exhaust
merely from repeated valid operations. The internal work guard now resets when
an outer serialized call acquires ownership. Direct same-fiber reentrancy shares
that guard, so repeated key-change restarts still terminate. The captured step
service remains responsible for the enclosing operation's aggregate work budget
across all dictionary calls. This preserves operation-wide enforcement instead
of treating a fresh local counter as additional authority.

Insertion identities now have a safe-integer lifetime ceiling; active entries
retain the existing schema-owned maximum. Deleted slots are compacted during
source rebuilds. A hundred set/remove cycles under a twelve-step local ceiling
now pass, while an exhausted captured aggregate allowance still rejects the next
lookup. Existing general-key and reentrant corruption/failure/serialization
tests remain required.

## Remaining work

This is a backend step toward the live cleaner registry. Production Python
string/byte hashes, callable/type/equality/truth protocols, live registry and
lazy cursor ownership, all 1,155 cleaner sequence cases and global admission
remain open. Split-key tables and forked callback mutation are not claimed by
this helper. No canonical source accounting or semantic waiver is promoted.
Full engine extraction, annotation, resolution, maps, Bluebook laws, service/
Layer proof and the one final PR remain the completion boundary.

## Verification record

The focused dictionary run passes seven tests across the new Unicode backend,
retained general-key histories and comparison-reentrancy tests. Source and test
typechecks pass. The new source evidence regenerates byte-identically and rejects
all twelve corruption controls. The use-cases package gate passes audit in
10.9 seconds and documentation generation in 14.2 seconds.

The first server package attempt was interrupted: audit ended after 6.3 seconds
with test exit 143 (termination signal), and documentation generation ended
after 7.4 seconds with exit 130 (interrupt signal). No assertion or type failure
was reported. The signal origin is not established. This attempt is not counted
as a pass. No lane processes remained before retrying the unchanged frozen
implementation. The retry result is recorded separately below.

The retry completed the audit with five existing real-worker deadline failures:
worker corpus, byte corpus, byte-stage composition and two basic worker tests.
Its documentation check again exited 130. The audit failure is distinct from
the first attempt's termination. The complete log, rather than its initial
signal summary, is the authoritative result. No assertion was removed.

The shared test configuration runs files and tests concurrently by default.
The server package now bounds the runner to two workers and two concurrent
tests per worker. This reduces cold module-loading fan-out; it does not change
any production limit, fixture, expected outcome, native owner concurrency or
clock-controlled deadline assertion. All tests still run. The next full gate
must verify this adjustment before the phase can be committed as green.

The full run with bounded test concurrency passed: server audit in 601.5 seconds
and documentation generation in 19.4 seconds. All implementation, test and runner
configuration bytes stayed frozen throughout that run. The native source corpora
still independently confirm all 1,448 child exits; the retained builtin invocation
test independently confirms two more. No production deadline, cleanup limit,
expected failure or corpus row was changed to obtain this result.

The eleven-component portable audit, 37 divergence corruption controls, goal
doctor and goal index pass. The incomplete full target proof stays pending.
README and this evidence note pass Markdown lint; third-party notices retain
exactly eight identical baseline diagnostics in untouched license text and
no new diagnostic. Authored spelling and whitespace checks pass. These local
phase results do not close registry, engine, hosted or one-PR delivery proof.
