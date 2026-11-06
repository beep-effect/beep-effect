# Live case-resource objects and table composition

Date: 2026-10-29. Private component composition proof; final callback dispatch
and document projection remain open.

## Actual source observations

The producer executes actual Resource objects and Python dictionaries under
clean eyecite 2.7.6 at commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`.
The runtime is CPython 3.11.15 with 64-bit hashes and hash seed zero; frozen
reporters/courts versions remain 3.2.53/0.10.22. Source, lock, license and
producer digests are recorded in the artifact. BSD-2-Clause attribution is
retained in the implementation and root notice.

Artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/live-case-resources.json`.
SHA-256:
`ec5e5887236e755082f1c2e56f87f6f0f4de68e815f471fda20505977597b791`.

The five histories contain thirty-eight events:

- One resource changes from page 1 to page 2 and remains reachable through its
  original table entry by pointer identity in the same initial bucket.
- One resource changes to page 20, misses its former probe path, and enters a
  second dictionary entry. Removing the reachable entry retains the earlier
  insertion rather than collapsing duplicate key objects.
- Two distinct resources share one mutable citation. They initially compare
  equal and later occupy distinct insertion entries after a hash change.
- Two distinct citations become equal after a semantic mutation. Dictionary
  lookups retain cached insertion hashes and original key objects.
- Creating a resource does not hash it. Missing reporter fails only when an
  operation hashes; adding the reporter makes the retained resource usable.

Resource equality is temporarily wrapped to record comparisons while calling
its original method. This preserves the class and actual hash implementation.
The source fixture records every result/error, ordered key-object/value entry,
and exact equality-call sequence. No process addresses are emitted.

## Target composition

CaseResourceObjects captures a semantic-reader service, Crypto and shared work
accounting. Every allocation creates a distinct resource handle, even when
multiple handles refer to the same semantic citation. Handles are owned by a
WeakMap; a copied or foreign slot does not grant access. Close revokes retained
handles. The schema-owned iteration ceiling bounds total allocations.

Each key operation reads current semantics and computes the exact source hash.
Equality recomputes both current hashes, matching Resource.__eq__. There is no
mutable-content cache. Resource objects, semantic references and dictionary
insertion entries remain distinct identities.

The test composes the real callback semantic owner read/write operations, this
registry, the exact hash helper and the general-key runtime dictionary. It
compares all thirty-eight source events, entry identities and comparison
traces. It also rejects forged and foreign handles, revokes retained handles
after close, enforces total allocation limits under concurrent creation, and
preserves allocation order after shared-work rejection. Creation does not
read or hash citation fields.

The portable checker rejects eight corruptions and fresh source replay
reproduces the entire decoded artifact.

## Remaining integration

The callback owner's dictionary and default dispatch still use the earlier
frozen resource descriptors. This new composition does not close the three
mutable-key callback engine scenes. It supplies the live object/hash/comparison
implementation needed for that integration.

All resource kinds must share the source table. Arbitrary host-key hashes,
law/journal edition hashing and missing-page identity allocation remain open;
no fabricated hashes or separate tables are introduced to approximate mixed
histories. Final per-entry group projection, callback dispatch, source-error
mapping, reentrant comparisons and exhaustive parity remain required. No
canonical, donor, divergence or safety row is promoted.

## Verification correction

The first full package run exposed a malformed nested citation in the previous
hash-helper test's last edit. That edit had landed after the preceding quality
run read the file. The test now reuses one input object while assigning a
properly branded decoded citation for the changed state. Source comparison
fixtures and the hashing implementation are unchanged. This checkpoint requires
a fresh package gate against the corrected stable test files. That run passes:
audit 34.1 seconds and docgen 10.8 seconds, including build, source/test type
checks, full package tests, lint and documentation.

The ten-component evidence audit passes; final target parity remains pending.
Goals index passes and doctor reports no new blocking findings. New evidence,
README and the added source-ledger section pass Markdown checks. Biome, Git
whitespace checks and fresh source replay pass. Existing source-ledger
line-width findings are unchanged.
