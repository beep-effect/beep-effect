I'll read the restoration census, capture notes, and related live artifacts first, then attack the no-loss bar against those sources.Next I’ll pull the packet decisions, prior salvage/dedupe work, and the live libpff/doc drivers so I can attack the bar against actual code rather than the census narrative.The packet is still at capture; next I’ll inspect the live libpff/doc drivers and the prior refresh packet for contradictions with this acceptance bar.There's already a live `recycle-bin` corpus command. I'll read that plus the prior salvage reports and libpff driver before judging the bar.The live recycle-bin command is the real baseline. I’ll read its schemas and the salvage/libpff paths next so I can pin contradictions to actual code.The bar already collides with live salvage and recycle-bin code. I’ll read those implementations and the census method so I can pin scale and coverage gaps.The existing hasher reads whole files into RAM, and salvage silently drops non-file types. I’ll check the live T7 mount and the remaining failure cases next.The T7 is live and formatted **exFAT**, not NTFS. I’ll take a metadata-only census (counts, sizes, pair keys, `$I` versions) and not touch file contents or original paths.**Verdict:** the bar is not implementable as written. It is pinned to a false census, silent on a collector that already lost thousands of files, and if executed through the live corpus/libpff stack it will drop mail, OOM on the largest PST, and call a filtered T7 snapshot “no-loss.”

---

## 1. The census the bar is written on is wrong

**BLOCKING — “1 orphan `$R`” does not exist.**
`2026-08-17-restoration-census.md:11` states 55 `$R` (35 files + 20 dirs) vs 54 `$I`, “1 orphan `$R`.” Live `$RECYCLE.BIN` at salvage root, pair-keyed the same way `classifyRecycleBinName` / `pairRecycleBinEntries` do (`Corpus.recyclebin.ts:23,161–171,201–214`): **54 `$I` + 54 `$R` (35 files + 19 directories), 54 matched keys, 0 unmatched, 0 duplicate keys.** All 54 `$I` are format **v2** and parse. The 35 file `$R`s match the `$I` `originalSize` field (0 mismatches). Item 2 of the bar (“re-pair the 55 `$R`… 1 orphan preserved”) sends implementers looking for a leftover the pairing function will not emit.

**BLOCKING — `f-recyclebin-C` / `f-recyclebin-E` are not “already name-recovered.”**
Census lines 12–13. Those trees still contain raw `$I`/`$R`:

| tree | `$I` | `$R` | matched | unmatched `$I` |
| --- | ---: | ---: | ---: | ---: |
| `f-recyclebin-C` | 63 | 60 | 60 | **3** |
| `f-recyclebin-E` | 23 | 13 | 13 | **10** |

The salvage-local `_meta/README.md` already says the opposite of the census: `f-recyclebin-{C,E,F}` are **raw** `$I`/`$R` and must go through corpus recycle-bin restoration. Someone following the census will skip the 73 leftover metadata records and the 73 remaining content pairs.

**BLOCKING — the three recycle surfaces are three different volumes, not one bin plus two extracts.**
`$I` original-path drive letters (path prefixes only):

- live `$RECYCLE.BIN`: **D:** and **H:** (not C/E)
- `f-recyclebin-C`: **C:**
- `f-recyclebin-E`: **E:**

No SID folders under the live bin (`S-1-5-21-…` count = 0). This is not “the workstation recycle bin at salvage root.” Treating it as the parent of the `f-recyclebin-*` trees will double-ingest some names and miss volume identity.

**MAJOR — `f-recyclebin-F` is specified and absent.**
Salvage `_meta/README.md` layout lists `f-recyclebin-{C,E,F}`. On disk: C and E only. The bar never mentions F. Either F was never staged or it was renamed; the bar has no fail-closed check.

**MAJOR — collector dests already vanished from `f-recyclebin-E`.**
`_meta/manifest.jsonl`: 10,871 unique dests. After remapping `H:\oppold-salvage-2026-08-10\…` onto the mounted tree: **1,021 manifest dests under `f-recyclebin-E` are missing now**, 0 size mismatches on the 9,850 dests that remain. The E tree was mutated after staging (partial restore / delete / rename). A hash-verified copy of *today’s* tree is not a copy of the staged E-bin.

---

## 2. “Full-drive / every source byte” is the wrong universe

**BLOCKING — T7 is already a filtered, failed-open subset of the old PC.**
The bar’s “100% archive manifest” can only be 100% of *what is on this exFAT volume now*. Salvage-local facts the bar never absorbs:

- Collector `_meta/manifest.jsonl`: **28,508 rows, 0 hash fields.** Status mix: `copied` 10,871, `resumed` 11,639 (size-match resume, not sha256), `error` **5,986**, `excluded-secret` 12.
- Error reasons: **5,788 WinError 123** (illegal path/syntax — the long-path / illegal-char problem already happened), 192 path-not-found, 4 OneDrive hydration timeouts (WinError 426), 2 cloud-provider-down.
- `_meta/README.md` deliberately dropped credentials, Box, installers/ISOs/media, and most AppData. It also records a mid-salvage OneDrive reorganization and says **do not wipe the old PC** until salvage verification.
- T7 filesystem is **exFAT** (`/dev/sda1` label `T7XFER`). NTFS ADS, junctions, ACLs, and 100-ns timestamps are already gone. `fs.copy({ preserveTimestamps: true })` (`ServicePrograms.ts:1633`) can only keep exFAT mtime (2-second resolution).

Copy-off first is ratified. Calling that copy-off “no-loss” of the *practice source* is false. Two implementers will either (a) hash-copy the T7 and declare the old PC wipeable, or (b) keep the PC. The bar does not say which. (a) permanently loses the 5,986 collector failures, the 12 excluded secrets, unhydrated OneDrive, Box, and anything never staged.

**BLOCKING — “full-drive” vs salvage tree is unspecified.**
Volume use is 333 G. Breakdown:

| T7 top-level | approx |
| --- | ---: |
| `oppold-salvage-2026-08-10` | 193.5 GiB / 12,156 files |
| `oppold-corpus.zip` | **137.59 GiB** |
| `.Trash-1000`, `System Volume Information`, `cognee-restic` | ~0 |

“Full-drive manifest then copy-off” includes a 138 GiB zip that `_meta/README.md` step 1 wants **unzipped onto the corpus root**. “Salvage restoration” does not. One implementer `dd`s/`rsync`s the volume (331 GiB). Another runs `beep corpus salvage` on the 14 salvage children. A third unzips the zip *over* the existing corpus and then salvage-dedupes. Those are three different archives.

**MAJOR — live salvage already disagrees with the collector dest set.**
On-disk extras not in collector dests: `$RECYCLE.BIN` 1,272 files, `LH_Documents` 923, `f-found000` 66, `_meta` 11, plus 34 files under `f-recyclebin-E`. The bar never says whether `$RECYCLE.BIN` / `LH_Documents` / `f-found000` are in-scope sources or post-staging residue.

**MINOR — empty directories.**
Live bin has 8 empty dirs. Salvage walk (`ServicePrograms.ts:1431–1436`) only records `type === "File"`; non-files are dropped. A path+size+sha256 file manifest cannot prove empty-dir restoration.

---

## 3. Recycle-bin restoration is underspecified enough to fork

**BLOCKING — “restoration tree” has no path function.**
Census line 17: restore “under its recovered name.” Live model has both `originalPath` and `originalName` (`RecycleBin.schemas.ts:67–74`). Unique original paths: 54 / 54 / 63. **Basename collisions: 2 in the live bin, 1 in `f-C`.** Implementer A flattens to `originalName` and overwrites. Implementer B rebuilds the Windows path and does not. Implementer C posixifies `C:\Users\…` to `C/Users/…`. The bar accepts all three.

**MAJOR — `$R` directories are trees, not entries.**
Live bin: 19 `$R` directories holding most of the **1,272 files / 6.18 GiB**. Census line 16 (“only the folder name itself needs `$I` re-pairing”) says nothing about:

- colliding folder names from different original parents
- empty subdirs
- files inside `$R` that themselves match `^\$[IR]` (classifier is basename-only, `Corpus.recyclebin.ts:23`)
- whether interior mtimes/sizes must match a child ledger

**MAJOR — no collision / illegal-char policy on restore.**
July salvage already broke on POSIX names containing `;` and `\` (`goals/oppold-corpus-refresh/history/outputs/2026-07-03-p1-salvage-report.md:64–70`). Collector already lost 5,788 paths to WinError 123. Live bin still has at least one semicolon name. Bar never specifies: colon drive letters, reserved Win32 names, trailing dots/spaces, NFC/NFD, or case. Destination is case-sensitive btrfs; source is case-insensitive exFAT.

**MAJOR — overlap between live bin and `f-recyclebin-*` is unaddressed.**
Same logical documents appear as C: deletions, E: deletions, and later D:/H: deletions (same stems across the three `$I` sets: letterhead, docket, website PDFs, IOLTA-class folders). Hash-copy of all three plus a name-restored tree will triplicate bytes. Later “dedupe and prune” (`CAPTURE.md:32`) then *drops* two of the three without a mapping ledger tying `$I` originalPath → digest → surviving copy.

**MINOR — `$I` versions.**
This disk is 100% v2. Live parser supports only v1/v2 and fail-closes on anything else (`Corpus.recyclebin.ts:115–118`). Fine for *this* T7. The bar’s “parse all 54 `$I`” has no unknown-version / short-header / empty-path policy; one bad `$I` currently aborts catalog (`ServicePrograms.ts:526–529`).

**no material findings** on “does the live parser understand these 54 `$I` files?” — it does (all v2, all pair).

---

## 4. Mail: the 53/112 GB estate will not survive the naive path

**BLOCKING — 46 of 53 PSTs live inside `f-recyclebin-C`, not a clean mail folder.**
Location × size:

- `a-OppoldIPLaw`: 4 PSTs, **66.86 GiB**, max **47.58 GiB**
- `f-oip-law`: 3 PSTs, 24.07 GiB, max 22.86 GiB
- `f-recyclebin-C`: **46 PSTs, 21.18 GiB**, max 3.17 GiB

Item 3 (“the 53-pst / 112 GB mail estate”) is mostly recycle-bin content. Extract-before-restore and restore-before-extract produce different attachment paths and different “originals retained” graphs. The bar does not pick.

**BLOCKING — live hasher cannot do this scale.**
`hashFileSha256` **reads the whole file into memory** (`FsGuards.ts:200–237`; corpus wrapper `ServicePrograms.ts:869–874`). Largest file is a **47.58 GiB PST**. Host has ~125 GiB RAM / ~76 GiB available; Bun/V8 will not reliably allocate a 47 GiB `Uint8Array`. A “full-drive sha256 manifest then hash-verified copy” implemented with the existing helper dies on the first large PST. 11 files are ≥2 GiB (115 GiB combined); 3 are ≥8 GiB.

Salvage copy is `concurrency: 1` (`ServicePrograms.ts:1655`) and **refuses dest-exists** (`1624–1628`). A mid-USB failure on the 47 GiB file cannot resume; it errors. Collector resume was size-match, which this bar just invalidated.

**BLOCKING — driver defaults silently drop mail the bar thinks it is keeping.**
`PffexportEngineConfig` defaults (`Libpff.pffexport.ts:215–223`):

- `exportMode: "items"` — **not** `all`. Deleted/orphaned items are not exported.
- `exportFormat: "text"` — HTML/RTF bodies are not written.
- `existingExportPolicy: "fail"` — a crash leaves a tree that the next run will not replace.
- EML assembly budget default **64 MiB** (`Libpff.pffexport.ts:425,904`). After that, EMLs are skipped as warnings; JSONL remains. For a 47 GiB store that is most of the mailbox.

Bar text is only “libpff extraction with magic-byte attachment-type repair.” Implementer using `@beep/libpff` as shipped does **not** extract recovered items, does **not** keep HTML, and does **not** repair `.p`/`.d`/`.j` (no such code in the driver; attachments are walked as opaque files, `Libpff.pffexport.ts:84,310–323,367`). Magic-byte repair is an unwritten new subsystem.

**MAJOR — corrupt / tiny / password / ANSI cases have no acceptance clause.**
Driver comment: “libpff segfaults on corrupt PSTs” and that is a `process` failure, not a skip (`Libpff.pffexport.ts:560–562`). 25 PSTs are &lt;1 MiB (rounded to 0.0 GiB in a naive GiB table — they are not empty, they are stubs). `_meta` names a crashed 2015 inbox PST. `pffexport -c codepage` is never passed. No password-PST path. A single segfault fails the operation; the bar still claims “originals never deleted,” but it does not define a per-PST loss ledger or a partial-export keep.

**MAJOR — expansion and disk.**
` -m all -f all` materializes `.export` + `.orphans` + `.recovered` and every body variant. 112 GiB of PST commonly becomes several hundred GiB. Dest has ~2.3 T free, so it fits *if* they do not also unzip `oppold-corpus.zip` (138 GiB) and keep raw + export + EML. The bar has no export-root quota and no “raw engine output is the artifact; EML is derived.”

**MAJOR — non-PST mail is out of the bar and on the disk.**
2 `.ost` (1.00 GiB) in `f-outlook-cache` (`_meta` also mentions NST for two mailboxes). 11 `.msg`, 6 `.eml`. 10 bare `.p`/`.d` plus **2 `.j`** the census did not count (census line 26: “10”). Live bin holds 2 `.p` + 1 `.j` already — residue from a prior pffexport, not something that appears “only after” extraction.

**MINOR — 0-byte / tiny PST counting.**
A GiB-rounded inventory will report “0.0 GiB” for 25 stores and an implementer will skip them as empty. They are not empty.

---

## 5. 564 `.doc`: “fidelity-verified” names a tool that does not exist

**BLOCKING — no converter in the cited bricks.**
`CAPTURE.md:51–53` points at `@beep/doc-text` and `@beep/tika`. `DocTextFileProcessingEngineDescriptor.supportedFormats` is `["pdf-text-layer","docx"]` only (`DocText.service.ts:65–70`). Tika’s `doc` path is **text extraction**, not Word→OOXML (`Tika.service.ts:44–61`). Nothing in-repo produces a `.docx` you can fidelity-diff. Item 4 is an unscoped product.

**MAJOR — fidelity metric is absent.**
Capture already admitted binary Word→OOXML is not lossless (`CAPTURE.md:36–38`; `DECISIONS.md:16–18`). The bar repeats “fidelity-verified conversion with a loss ledger” with no metric: text-only? layout? styles? tracked changes? fields? VBA/macros? embedded OLE? printer metrics? Two implementers will log different “loss.”

**MAJOR — 273 + 273 split looks like a duplicated tree.**
`.doc` locations: `LH_Documents` 273, `f-oip-law` 273, plus 18 elsewhere = 564. Convert-both without a digest join doubles the loss ledger and the “original retained” store. The bar does not say “convert distinct digests, not paths.”

**MINOR — `.dotx` / password / OLE-not-Word.**
No policy for passworded compounds, RTF/HTML masquerading as `.doc`, or templates. 564 is an extension count, not a format census.

---

## 6. Dedupe × no-loss will delete the copies the bar just required

**BLOCKING — `beep corpus salvage --dedupe` is the on-disk recommended next step and violates item 1/5.**
`_meta/README.md` step 2: map folders and run `beep corpus salvage --run-label 2026-08-old-pc --dedupe`. Live salvage, when `dedupe === true`, writes **provenance-only and does not copy bytes** (`ServicePrograms.ts:1598–1612`). July refresh already copied 12 artifacts / ~55.6 GiB, including the large year-gap PSTs (`2026-07-03-p1-salvage-report.md:14–15,19–20`), and cataloged 8,324 provenance-only rows. `_meta` itself says `a-OppoldIPLaw` will mostly collapse to provenance-only.

If copy-off *is* corpus salvage+dedupe, the 47.58 GiB and 11.5 GiB stores may never land in the “durable corpus archive.” If copy-off is a separate bit-archive, the bar never names that archive, its filesystem, or a verify tool other than “manifest verifies 100%.”

**MAJOR — “100%” is undefined.**
100% of file count? dest bytes == source bytes? every sha256 re-read? include dest-side compression (btrfs zstd:1 on `/home`)? include provenance-only rows? A zip of the corpus is already 137.59 GiB on the same disk; unzip+dedupe can “verify 100%” against a different object graph than a file-for-file copy.

This is **not** a RATIFIED-CONFLICT if sequenced (copy-off with dedupe off, then prune the working set). It **is** a ship-blocker because the only written procedure on the drive does the opposite.

---

## 7. Mid-copy / USB / scale

**MAJOR — no checkpoint, no atomic dest, remount-ro.**
T7 mount options include `errors=remount-ro`. A write of the manifest *onto the T7* plus a USB glitch freezes the source. Bar does not require dest-side write-ahead (manifest on durable disk first, then copy, then dest rehash).

Three full USB reads of 193–331 GiB (hash, copy, verify) at real-world ~200–300 MB/s is 20–45 minutes *if sequential and large-file*. Mixed with 12,156 files it is dominated by the 47 GiB PST plus 3×15.6 GiB of `.iso` in `b-profile` that `_meta` claimed were excluded.

**MAJOR — dest-exists fail-closed makes retry unsafe** (`ServicePrograms.ts:1624–1628`). Partial 47 GiB dest must be deleted by hand and restarted. Bar has no “truncate leftover dest and resume by hash.”

**MINOR — space math is OK for copy-off only.**
2.3 T free holds 331 GiB + a pessimistic PST expansion. It does not stay OK if someone also unzips the 138 GiB zip, keeps `pffexport -f all -m all` trees, and writes converted `.docx` next to every `.doc`.

---

## 8. RATIFIED-CONFLICT

No fatal contradiction with the ratified *sequencing* (copy-off first, then process). Do not reopen that.

The collision is operational, not political: the only concrete runbook on the T7 (`_meta/README.md` steps 1–2) is unzip-zip + `salvage --dedupe`, which cannot satisfy items 1 and 5. That needs an explicit override in the bar (“do not use `--dedupe` for the retirement copy; do not treat unzip of `oppold-corpus.zip` as that copy”), or implementers will follow the file on the drive.

---

## What two implementers would actually build

| decision the bar leaves open | implementation A | implementation B |
| --- | --- | --- |
| Universe | entire T7 including 138 GiB zip | `oppold-salvage-2026-08-10/` only |
| Tool | `rsync`/`cp` + `sha256sum` | `beep corpus salvage --dedupe` |
| Recycle | 54 live pairs + flag a ghost orphan | restore C/E leftover `$I`/`$R` (73+73) and ignore live D/H bin |
| Restore path | basename | full Windows path posixified |
| PST set | 53 files via driver defaults (`items`/`text`) | `pffexport -m all -f all` then invent magic-byte rename |
| `.doc` | Tika text sidecar | LibreOffice `.docx` + visual sampling |
| Done when | dest file count matches | dest digest set matches existing corpus catalog |

Those are not the same archive and not the same loss ledger.

Until the bar replaces the false 55/54/orphan counts, names the universe (T7-as-sits vs old-PC), forbids `--dedupe` on the retirement copy, requires streaming hashes, pins pffexport `-m`/`-f`/corrupt policy, and defines the restore path function plus a fidelity predicate, it will not survive contact with this disk.
