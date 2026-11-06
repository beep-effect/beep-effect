# Frozen runtime dictionary backend

Date: 2026-10-29. Isolated private backend proof; live key production and
callback/document integration remain open.

## Source pins and attribution

The canonical model source remains clean eyecite 2.7.6 at the recorded
commit/tree. The producer enforces Python 3.11.15, CPython, 64-bit hash width,
hash seed zero and the frozen reporters/courts versions. It computes actual
Resource hashes for pages 1, 2 and 20 through the pinned models.

Those hashes are 1986750081022884797, 1465210507262904853 and
1226098292844416122. The first two start at bucket 5 in a size-eight table;
the third starts at bucket 2. This explains the two observed post-mutation
lookup paths without pretending that current equality alone defines entries.

The implementation adapts CPython 3.11.15 Objects/dictobject.c, specifically
its combined/general-key lookup, insertion, deletion and stored-hash growth.
Source URL:
<https://github.com/python/cpython/blob/v3.11.15/Objects/dictobject.c>.
SHA-256:
`474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8`.

The complete upstream license is reproduced in THIRD_PARTY_NOTICES.md,
including the PSF Version 2 terms and historical notices. Its SHA-256 is
`3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf`.
The TypeScript/Effect adaptation and changes are described there and in the
module header. No Python runtime or C implementation file is a dependency.

Artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/runtime-dictionary-observations.json`.
SHA-256:
`1b66065c5ec4abd4564e01d24dda81d20f2f2358dac4911c5c13f12786275d4c`.

## Implemented backend

The server-private table accepts operation-local resource-object handles and
current normalized signed 64-bit hashes. Hashes encode as decimal strings and
remain bigint values during probing. Values are member-list handles; neither
key nor entry IDs attest legal semantics, source evidence or persisted identity.

Lookup checks object identity before cached-hash comparison/equality. Different
objects invoke the captured equality service only when the insertion hash
matches. Probing uses the frozen unsigned perturbation sequence. Deleted
buckets keep a marker; they do not become empty. Insertions preserve first-key
identity and insertion order. Growth compacts live entries using their stored
hashes rather than recomputing mutated key hashes. Separate insertion entries
may therefore reference the same current key object.

Every method captures its comparison/work dependencies with R = never. Public
engine ceilings are reused through a private projection. Probes and rebuilds
consume bounded work, entry count is capped, and methods serialize concurrent
operations. Invalid keys, exhausted limits and comparison failures remain
sanitized typed errors. Snapshot data cannot mutate stored entries.

The first implementation uses the existing server-specific home; it creates
no shared-kernel/foundation package, public client API or standalone driver.
The captured comparator can read current key state. Reentrant table mutation
through comparison is not implemented by this backend and remains explicit
future work; this is not a complete Python mapping implementation.

## Proof

Eight histories cover 62 operations, external key edits and snapshots:

- Same initial bucket with key-object identity after a hash change.
- Different initial bucket producing two entries for one key object.
- Cached hash matching while current equality rejects a different object.
- Collision/perturbation sequences through deletion and growth.
- Growth retaining an earlier cached hash after the key changes.
- Deleted-bucket probing, reinsertion order and clear.
- Equality exceptions leaving table entries unchanged.
- Negative hashes and both signed 64-bit extremes, without precision loss.

The target compares every result, exception decision, ordered entry and exact
equality-call sequence, including 45 comparisons in the collision history and
26 in the signed-hash history. Independent controls enforce active-entry/work
ceilings, preserve state on rejected writes, isolate snapshots and serialize
concurrent inserts. Existing engine/session suites retain their prior scope.

Portable checks include eight corruption controls and verify the exact license
bytes reproduced in the repository. Fresh source replay reproduces all decoded
artifact values. No canonical/donor/divergence/safety row is promoted.

## Remaining integration

This table is not yet used by the callback owner. Exact default-resource hash
production, host-key normalization, object alias registration, per-entry group
projection and full comparison/lookup behavior must be connected and proved.
The three model-mutation default-key engine scenes remain open. Do not count
these isolated backend histories as those engine cases passing.

Split/Unicode-specialized tables and comparison mutation/reentrancy are outside
this proof. General host/model behavior, source integration, final diagnostics,
public ports, parser safety, Bluebook and exhaustive delivery remain open.

## Verification

The server package gate passes: audit 34.5 seconds, docgen 11.1 seconds,
including build, source/test type checks, tests, lint and documentation.
The source producer/replay and eight corruption controls pass. Logs use the
runtime-dictionary prefix in the citation engine cache. The ten-component
source audit passes and goals doctor reports no new blocking findings. Goals
index, new-note/README Markdown checks, new source-ledger section checks and
Git whitespace checks pass.

The new notice section passes Markdown checking in context and its legal names
pass spellcheck. The full root notice retains the same eight pre-existing
Markdown findings as HEAD; the source ledger likewise retains twelve existing
line-length findings. No blanket full-file lint success is claimed.
Scoped allowances retain the upstream license bytes rather than rewriting
legal text. The final target comparator remains pending and the goal active.
