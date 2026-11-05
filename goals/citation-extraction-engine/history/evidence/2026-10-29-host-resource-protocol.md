# Captured host resources in the callback dictionary

Date: 2026-10-29. Internal custom-resource protocol and controlled adapter proof.
Automatic Python primitive normalization, source set behavior, reentrant table
mutation, production Layer cutover and final document projection remain open.

## Source observations

The pinned eyecite 2.7.6 producer `ops/probe-host-resources.py` records eight
custom-key dictionary histories, forty-eight operations and three actual
`resolve_citations` full/default-Id callback scenes. It runs CPython 3.11.15,
64-bit hashes and seed zero with reporters-db 3.2.53 and courts-db 0.10.22.
The source commit/tree, exact source/license/lock digests and producer digest
are embedded in `host-resources.json`. Its formatted SHA-256 is
`2eaf20a0492da410f793712cb7f3b5728bb6e912b9fc7659a07764fd24bdf43f`.
Attribution remains eyecite BSD-2-Clause and the existing CPython dictionary
implementation notice; no donor runtime dependency is introduced.

The histories use real canonical Resource objects alongside controlled custom
Python objects. They cover canonical-first and host-first reflection, raw hashes
wider than signed 64 bits, false equality with pointer-identity lookup, aliases,
live hash/truth changes, current canonical citation access, current host
presentation in retained prior-full pairs, removal/clear with retained lists,
and hash/equality/truth exceptions. Every event includes the exact hook trace,
ordered entries, list slots, all allocated list contents and prior presentation.

Python Resource equality calls the other object's raw `__hash__` directly.
Consequently canonical-first comparison can retain two entries where the reverse
host-first comparison retains one, even though normalized hashes collide. A
custom object's hash can also change its truth value. The actual full/Id scenes
observe these hook orders and memberships:

- Truthy resource: bool/hash/hash/bool/hash/bool/hash; one group [0, 1].
- Falsy resource: bool/bool; no hashes and no groups.
- Hash makes resource falsy: bool/hash/hash/bool; one group [0].

The source verifier checks metadata and these distinctions, rejects eight
corruptions and reproduces the entire parsed artifact through fresh oracle
execution. Source evidence and target execution remain separate checks.

## Captured protocol and ownership

HostResources declares an internal Context factory. It captures canonical hash
and citation readers, then returns R = never operations for stable host capture,
pure presentation, current truthiness, normalized hash, ordered comparison and
close. The adapter owns native identity, raw hash behavior and reflected
comparison semantics. Capture/presentation must not invoke bool/hash/equality.
The request schema gains no functions or mode flags.

CallbackRuntimeIndex assigns one unified resource slot namespace to canonical
and host objects and uses one runtime dictionary. Adapter-local handle slots
remain distinct from those unified slots. Adapter-owned handles are validated
without structural decoding or reconstruction; copying a handle would destroy
issuer ownership. Registered views carry scope, slot and presentation. Truth is
read effectfully from the issuer each time the algorithm requires it.

Presentation is a fresh view of the owned object, not the object's identity.
Prior-full pair validation compares the retained pair and resource identities;
reading/writing a pair after host presentation changes preserves the same node.
Group, last-resolution and prior-full snapshots refresh presentations without
extra native hooks. Canonical presentation forgery remains rejected. Owner close
revokes both adapter and canonical objects.

Explicit dictionary set performs one lookup. Its list-membership budget guard
runs after lookup but before mutation, using the located insertion entry and
owned list slots. The previous extra get would have repeated hash/equality
hooks. Dictionary observers expose all owned list-node contents in slot order,
including nodes retained after remove/clear, without hashing any keys.

## Target proof and boundary

CitationHostResources.test.ts supplies a controlled adapter for the exact source
objects. Normalized numeric hashes are read from Python observations; this is
not an implementation claim for arbitrary native Python values. The test checks
every event's hook trace, entry identity/list slot, current presentation, all
allocated list contents, prior-full read/write and closed error category. It
also executes the three full/default-Id callback scenes through the real owner.
The existing registered canonical callback tests remain green. The complete
server package gate passes: audit 41.1 seconds and documentation generation
11.2 seconds, including build, source/test type checks, tests and lint. The
new evidence note and README pass Markdown lint. Goal doctor reports zero
blocking findings and the generated goal index check passes. All ten evidence
audit components pass, and all thirty-seven divergence corruption controls
are rejected. Strict parity still fails on unfinished proof and the missing
final target checker; this checkpoint makes no completion claim.

Host uniqueness through Python sets is deliberately unsupported by this port's
equality-key operation. Dict-based or hash-only deduplication would not prove
source set semantics. Automatic built-in/custom Python normalization, null-page
identity allocation, reentrant comparison, general host model mutation, legacy
adapter removal and public per-entry document projection still require proof.
This private conditional integration is not the unconditional production Layer.

No canonical, donor, normalization, fidelity-question or safety row is promoted.
The complete parser/cleaner/tokenizer/extractor/annotator, regex safety, Bluebook
laws, exhaustive source/donor target accounting, reflection, hosted proof and
one-PR lifecycle closeout remain required.
