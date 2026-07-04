---
"@beep/identity": patch
"@beep/repo-configs": patch
"@beep/ui": patch
---

Corpus CLI refresh capabilities and repo-health fixes.

- `beep corpus salvage`: `--run-label` per-run raw subtrees and `--dedupe` hash-first
  provenance-only rows for already-known digests, with generic `source-a=/path` mappings.
- New `beep corpus archive-move`: all-or-nothing coverage-proven source archival with a
  move manifest; never deletes, never overwrites.
- `beep corpus catalog` and `beep corpus extract` union base plus run-label provenance
  manifests; extract gains `--out-label` for incremental output trees.
- Fix salvage manifest writer NUL-hole that corrupted the first record.
- Fix `fs.realPath` rejecting valid POSIX filenames during salvage and archive-move walks.
- `@beep/identity`: `SlugJoin` is tail-recursive so long package identifiers compile under
  classic tsc; passthrough pipe converted to `flow`.
- `@beep/repo-configs`: docgen category misparse and stale experimental field fixes.
- `@beep/ui`: chart re-exports carry required docgen metadata.
