---
title: "Bound file-level evidence for the observed node-gyp mismatch"
date: 2026-11-06
reversal: "Remove the bounded fileDetails addition and its fixtures; retain the repaired Python test inputs and both immutable paired-run observation receipts."
---

Both source-only runs passed under the original process and artifact limits,
but the retained cross-run comparison failed because only node-gyp content
changed. Counts, sizes, modes, links and headers agree. File-level hash/kind
evidence is required before treating generated Python bytecode as the cause
or changing installation preparation.

Retain opaque filename hashes and content hashes for at most 512 regular files
in that observed package, bounded to 128 KiB of encoded rows inside the existing
4 MiB combined report cap and existing two passes. Never retain path strings or
payloads. The canonical stream digest still hashes every original byte. Add
hosted redaction, same-size mutation and refusal-bound regressions, and declare
both consumed Python files as inputs to the CLI test, test:property and coverage
tasks while preserving inherited inputs and disabled coverage caching. This changes neither production
trust nor qualification/signing authority.
