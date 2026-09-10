# Instance

- id: `r3-tooling-registration-deletion-note-phase`
- file:line: `packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/RegistrationGeometry.probes.ts:189`
- symbol: `pending-changeset.deletionNote`
- members: `hasDeletionNoteBasename`, `isCanonicalDeletionNote`
- evidence: E4 at `RegistrationGeometry.probes.ts:189-199` — canonical is
  computed only behind the matching-basename fact. The reader first skips the
  canonical case and then treats the remaining matching-basename case as
  residue, so canonical without the basename is impossible.

# Current shape

The pending-changeset probe derives two local booleans for each Markdown file.
One compares the basename with the package's dedicated deletion-note name; the
second combines that result with the canonical-content decoder. Two ordered
guards then distinguish an intentional note, a tampered/named residue file,
and every other file.

# Cardinality gap

Four pairs are representable and three are legal: `other`, `named-residue`,
and `canonical`. `!hasDeletionNoteBasename && isCanonicalDeletionNote` is
unreachable because canonical decoding is short-circuited behind the basename.

# Target schema

Define a private annotated `PendingChangesetFileDisposition` LiteralKit with
`other`, `named-residue`, and `canonical`. Classify one file at a time while
preserving the current short circuit: nonmatching basenames are `other`
without invoking the deletion-note decoder; matching basenames decode to
`canonical` or `named-residue`. Match the literal to skip canonical notes and
record named residue; the `other` arm retains the independent package-name
content search.

# Migration inventory

- `RegistrationGeometry.probes.ts` imports — add the narrow LiteralKit and the
  repo-CLI identity composer required for one private annotated owner; reuse
  existing `Str`, `Effect`, and `isCanonicalDeletionChangeset` helpers.
- `RegistrationGeometry.probes.ts:179-200` — add one local effectful classifier
  and replace both booleans and ordered guards with its literal result.
- `packages/tooling/tool/cli/test/delete-package.test.ts:70-147` — retain the
  canonical-note exclusion and tampered/mismatched residue cases; add an
  ordinary nonmatching file that both does and does not name the package.
- `RegistrationGeometry.service.ts` and DeletePackage command callers consume
  only `RegistrationObservation`; no decoded API or barrel migration is needed.

# Guard-deletion accounting

Delete `hasDeletionNoteBasename`, `isCanonicalDeletionNote`, their implication
expression, `if (isCanonicalDeletionNote)`, and the basename half of the
following boolean `||`. One disposition match owns the three legal cases.

# Encoded-side impact

None. The literal is private loop-local state. Changeset filenames and bytes,
canonical decoder behavior, registration observations, deletion plans,
console output, and filesystem mutation behavior remain unchanged.

# Test impact

Cover canonical name/canonical body, canonical name with tampered body,
canonical name for another package, canonical name with a real release entry,
other filename naming the package, and unrelated filename/content. Prove that
only the first case is skipped and every residue path reports the same normalized
relative filename. Run focused delete-package/registration-geometry tests and
full `@beep/repo-cli` verification with its changeset policy.

# Risk and sequencing

Land in Tier 1E. Preserve the basename short circuit so unrelated changesets
are not parsed as deletion notes, and preserve the independent content search
for noncanonical filenames. This migration must not change empty-deletion-note
generation or labs exemption policy.
