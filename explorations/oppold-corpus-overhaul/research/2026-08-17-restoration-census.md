# Restoration census — machine-local T7 salvage drive (2026-08-17, corrected)

> **Correction note (2026-08-17, same day):** the first edition of this census
> was produced by raw `find` scans and contained factual errors caught by the
> adversarial review (`2026-08-17-adversarial/`): the "1 orphan `$R`" did not
> exist (the repo's own pairing code yields 54/54 matched, 0 unmatched), the
> `f-recyclebin-*` trees were wrongly described as already name-recovered
> (they hold raw `$I`/`$R` from *different volumes*), and the salvage-local
> `_meta/` collector ledger was never consulted. This edition records the
> verified facts. Method: the live `beep corpus recycle-bin` pairing
> semantics, the salvage's own `_meta/manifest.jsonl`, and metadata-only
> scans. No filenames, no content.

## The three recycle surfaces are three volumes

| Surface | `$I` | `$R` | Matched | Unmatched `$I` | Origin volumes |
| --- | ---: | ---: | ---: | ---: | --- |
| Live `$RECYCLE.BIN` at salvage root | 54 | 54 (35 files + 19 dirs) | **54** | 0 | **D:, H:** |
| `f-recyclebin-C` (raw, NOT recovered) | 63 | 60 | 60 | **3** | C: |
| `f-recyclebin-E` (raw, NOT recovered) | 23 | 13 | 13 | **10** | E: |

All `$I` records are format v2 and parse under the live parser. 13 unmatched
`$I` (missing `$R` content) are inherited losses to ledger, not restorables.
`f-recyclebin-F` is specified in the salvage's `_meta/README.md` layout and
**absent on disk** — a fail-closed check, not an assumption.

## The collector ledger (salvage `_meta/manifest.jsonl`)

28,508 rows, **zero hash fields**. Status mix: 10,871 copied · 11,639
size-match resumes (not hash-verified) · **5,986 errors** (5,788 illegal-path
WinError 123, 192 not-found, 6 cloud) · 12 excluded-secret. The collector
deliberately dropped credentials, Box, installers/media, most AppData; it
records a mid-salvage OneDrive reorganization and instructs **do not wipe the
old PC until salvage verification**. Post-staging mutation detected: **1,021
manifest dests under `f-recyclebin-E` are missing today** (0 size mismatches
on the 9,850 that remain).

## Filesystem and drive facts

- T7 volume is **exFAT** — NTFS ADS, ACLs, junctions, and 100-ns timestamps
  are already gone; the preservation unit is exFAT reality, recorded as such.
- Volume holds the salvage tree (~193.5 GiB / 12,156 files) **plus a
  137.6 GiB `oppold-corpus.zip`** at drive root (scoped separately) and
  minor residue.
- Largest single file: a **47.58 GiB PST**; 11 files ≥ 2 GiB.

## Mail estate

| Surface | Measure |
| --- | --- |
| `.pst` stores | 53 files, 112.1 GB — **46 of them inside `f-recyclebin-C`** (21.2 GiB); 4 in the practice folder (66.9 GiB incl. the 47.58 GiB store); 3 elsewhere (24.1 GiB) |
| 25 stores | < 1 MiB (stubs, not empty) |
| Other mail | 2 `.ost` (1 GiB), 11 `.msg`, 6 `.eml`, 10 bare `.p`/`.d` + 2 `.j` (prior-extraction residue) |

## Conversion targets

564 extension-`.doc` files — **273 in `LH_Documents` + 273 in `f-oip-law`**
(a likely duplicated tree; convert distinct digests, not paths) + 18
elsewhere. Format-validate before counting them as binary Word.

## Predecessors (both bind)

- `goals/oppold-corpus-refresh` — July consolidation (salvage/catalog/dedupe;
  stops before extraction).
- `goals/oppold-corpus-pipeline` — June: full extract ran (663,272 PST
  children, `-m items` only — recovered items deferred), 285 extract
  failures, 3,055 artifacts left `_unsorted`. The overhaul inherits this debt
  ledger.
