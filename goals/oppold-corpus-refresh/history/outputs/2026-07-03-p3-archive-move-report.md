# P3 Archive Move Report (2026-07-03)

> Privacy note: archive roots, source roots, filenames, directory names, user
> names, and client identifiers are intentionally omitted. Sources are referred
> to only as `source-a`, `source-b`, `source-c`, and `source-d`.

## Outcome

Archive movement completed after salvage and catalog verification. Coverage was
proved over all 8,336 walked files before mutation, then all four source roots
were moved as an all-or-nothing operation into the archive root. The source set
represented approximately 88 GB.

Nothing was deleted. The data-home boundary now contains only the corpus root,
the archive root, and explicitly out-of-scope directories.

## Coverage Proof

The archive-move preflight compared the refresh provenance manifest against the
resolved source inventory and found zero uncovered files. Movement proceeded
only after the coverage proof covered every walked record from `source-a`
through `source-d`.

## Move Manifest

The move manifest contains 4 records, one per redacted label. All 4 records
validated successfully.

| Metric | Count |
| --- | ---: |
| Sources moved | 4 |
| Walked files covered | 8,336 |
| Move-manifest records | 4 |
| Valid move-manifest records | 4 |
| Uncovered files | 0 |
| Deleted files | 0 |

## Post-Move Verification

A raw-artifact sample was re-hashed after the archive move. All sampled raw
artifacts still matched their manifest digests: 4/4 PASS.

The archive move hit the same valid-POSIX-filename class documented in the P1
salvage report during preflight. The path handling was fixed and regression
tested before the all-or-nothing move executed.
