### sol-1-1

- file: scratchpad/effected/jsonl/Journal.ts:887
- class: bug   severity: required
- standard: D9, D11, section 14; README Port notes, Deviations 10, 12 and 13 require logical post-BOM offsets and a consistent sampled file.   evidence: A read-only `bun --eval` probe using the existing `MemoryFileSystem` fixtures seeded `"\ufeff" + line(1)`, then decorated `fs.stat` to rename a valid, BOM-less `line(7)` over the journal immediately before the query’s metadata sample. `journal.query()` failed with `{ tag: "MalformedLine", message: "JSONL malformed line at byte offset 0" }`; a stable retry returned round 7 at offset 0. This is new evidence for the earlier probe-to-sample gap; `JournalDeviations.test.ts:304` covers replacement between the metadata sample and handle acquisition.
- failure: The BOM probe reads one file, while the subsequent metadata sample and pinned handle can refer to its replacement. Their identities agree, so the replacement check passes, but the pager applies the old file’s three-byte BOM adjustment to the replacement. It skips the first three bytes of a valid record and reports corrupt history. The same path supplies cursor replay for `changes()` and `projection()`.
- fix: Obtain the BOM width, size and identity from the same pinned file handle used for paging, or verify the BOM-probe handle’s identity against the sampled identity before using its width. Add a regression that replaces a BOM-prefixed file with a BOM-less file between the probe and metadata sample, and extend the existing deviation evidence.

### sol-1-2

- file: scratchpad/effected/jsonl/Journal.ts:1179
- class: bug   severity: required
- standard: D11 and section 14’s verified-upstream-bug allowance; upstream `packages/jsonl/CLAUDE.md` specifies that a missing journal constructs cleanly; README Port notes, Deviation 20 records that guarantee for disappearance during seeding.   evidence: A read-only `bun --eval` probe seeded `line(1)`, then decorated the first seed `fs.stat` to remove the journal before delegating to the real in-memory stat. Layer construction returned `{ tag: "PlatformError", reason: "NotFound", method: "stat" }`, with the file absent. This is new evidence for an earlier seed step: `Journal.edges.test.ts:227` removes the file at the second existence check inside `refresh`, which produces the separately handled `JournalNotFound`.
- failure: Startup recovery catches only `JournalNotFound`. A file disappearing after the initial existence check can instead produce `PlatformError` with reason `NotFound` from the BOM probe, metadata sample or tail acquisition. Construction then fails for a missing journal despite the stated contract and accepted recovery deviation.
- fix: Extend seed recovery to handle specifically `PlatformError` reason `NotFound`, using the same empty-journal initialization as the existing `JournalNotFound` handler. Continue propagating permission and other platform failures. Add a regression for disappearance before the seed metadata sample and extend Deviation 20’s evidence.

REQUIRED: 2
BACKLOG: 0

