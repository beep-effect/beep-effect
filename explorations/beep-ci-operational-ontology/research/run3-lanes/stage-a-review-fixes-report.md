# Run-3 Stage A PR review-fix report

## Current security repair proof — PR #1032

CSF-012 changed the generators and repaired saved message values after the
Stage A review below. The historical report, hashes, byte totals, and unchanged
claims below describe the pre-CSF-012 commit `e9f5e0700a8c`; they are not current
integrity evidence. The following values supersede them for the repaired pins.

The repair was replayed from committed source `247d22465bdf5b0bb97388bc22c66c01f8eb54d2`
with `resanitize-corpora.py --source-ref <commit>`. It preserved embedded JSON,
capture instants, event counts, owner references, and the original manifest
digests. No live source was recaptured and no ontology ratification was rerun.
Both fleet pins retain the original count of 12 repaired raw files; the identity
pin required no raw-value changes. Future repairs append provenance updates
without replacing the initial record. A second ordinary repair verifies every
pin unchanged.

Whole-tree hashes use the length-framed method documented below and include
each manifest. Each generator's full pin verifier passes.

| Pin | Whole-tree SHA-256 | Files | Records | Bytes |
| --- | --- | ---: | ---: | ---: |
| run2-fleet | `dc2558688389236e5a7974bd1badc359a6772980f5a141a0905622073cfcf995` | 1589 | 6213 | 13316735 |
| run3-fleet | `3a20640a2df3da8e50760d5d511ed2d03a9dcea26c74750fbc5b23c201080d96` | 1873 | 7641 | 18263265 |
| run3-checkout-identity | `cfd02834094938cad232cd0d6400650c2c8f547ea68606ca065bb2d102dcbd8e` | 217 | 108 | 894779 |

Current generator SHA-256 pins:

- run2-fleet: `962759f2ee171b171a23f5ca0c048f43c0c0586d0446e51adb3ae3f007851229`.
- run3-fleet: `06f61533f1c0cc9e5aa8a61a1729df620a3f833950361d869724b5787ba1ac17`.
- run3-checkout-identity: `ae9db0102c4cbc4b39862872a099edc88d2874202641b6d3ffb27aef77010854`.

## Historical Stage A report — before CSF-012

Date: 2026-09-08 (America/Chicago; capture instants are UTC).
Branch: `ontology-run3-stage-a`. PR: #1027. Lane: Codex review fixes.

All four findings are confirmed and fixed. The generators, regression tests, refreshed
pins, packet mirrors, friction receipt, and original report refresh were committed in
`e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83` (`fix(explorations): verify and repin Stage A corpora`).
This follow-up report records the committed-tree proof and final report hashes. The
corpora and generators are unchanged from that fix commit. The manifests' `corpus_commit`
remains `c00126704caf8496b3633df7581e8967a164c9bd`, the HEAD whose source was cited at capture.

Work stayed in this checkout. Paths were staged explicitly. No force-add, push, PR
comment, thread resolution, or other PR mutation was performed. Fable owns publication
and can post the four reply paragraphs below verbatim.

## Finding 1 — incomplete committed identity inventory (P1)

**Verdict: confirmed.** At the starting commit, the identity manifest listed 220
payloads; Git contained 190 payloads plus the manifest. All 30 missing payloads had
nested `.claude/` or `.beep/` segments. The fleet pin had its complete 1,868-payload
inventory, but its label-to-directory rule carried the same hazard.

**Fix:** both standalone generators use an injective UTF-8 percent encoding for the
checkout label's output component. For example, `beep-effect/.claude/worktrees/name`
becomes `beep-effect%2F.claude%2Fworktrees%2Fname`. Identity bindings use that single
filename stem; fleet attempt, verdict, and ledger paths use the same single checkout
component. Original labels remain verbatim in `checkout` receipts and identity facts.
Literal percent signs are encoded, so labels containing `%2F` cannot collide with `/`.
No ignored directory was force-added. The prevention receipt is in
`research/OPPORTUNITIES.md`.

**Proof:** synthetic nested-label and collision tests pass. After explicit-path staging
and commit, both exact tracked inventories match the manifest paths and counts. Both
generators also pass ordinary verification in a newly created detached worktree of the
fix commit; all its pinned bytes equal the main lane's final capture bytes. See the
transcript summary below.

**Reply Fable can post:** Confirmed and fixed in `e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83`.
Both generators now encode checkout labels into a single path component while retaining
verbatim labels in the manifest. This removes the ignored `.claude/` and `.beep/`
directory segments without force-adding ignored files. After refreshing both pins, the
committed inventories match the manifests exactly: 1,873 fleet files and 217 identity
files, including their manifests. Both ordinary verifiers pass from a fresh detached
worktree containing only committed files.

## Finding 2 — receipt bounds and derived metadata were trusted (P1)

**Verdict: confirmed.** The old file loop checked hashes, byte sizes, event counts, and
projection bytes but never compared per-receipt minimum/maximum timestamps with newly
collected timestamps. The old identity census also omitted the snapshot coverage copy
and several binding receipt fields.

**Fix:** both generators derive event counts and minimum/maximum timestamps from decoded
raw records during verification. Each projection receipt must equal its raw receipt with
only the projection-specific path, kind, linkage, byte size, and digest substituted.
The fleet census additionally checks source linkage and exact payload coverage, retained
rows and event classes, exclusion accounting, source-line accounting, owner-reference
counts, ring counts, live-file counts, checkout counts, run membership, encoded paths,
and ledger counts. Identity verification checks the `FleetSnapshot.scannedAt` capture
basis, the complete snapshot receipt (including coverage), unique snapshot-to-binding
coverage, checkout counts, binding kind/branch/head, branch digest, identity key/path,
probe status and snapshot agreement, observation instant, and process environment-presence
consistency. These are pinned-byte checks; ordinary verification does not invoke Git,
rescan the fleet, reread source citations, or mint a new salt.

Discarded source bytes cannot reconstruct exclusion reasons, original line positions,
missing-process-member tallies, or the unrecorded salt. Those remain capture observations;
the verifier checks their internal accounting rather than claiming independent recovery.

**Proof:** new synthetic pins exercise actual CLI subprocesses. Same-length one-millisecond
edits to both minimum and maximum timestamps fail with exit 1, independently in raw and
projection receipts, for both generators. Restoring the exact original manifest returns
exit 0 each time. Same-length edits to identity capture basis, snapshot coverage, binding
kind, and binding probe status also fail and recover after restoration. All 15 regression
tests pass, including the existing corrupt-payload and no-live-read tests.

**Reply Fable can post:** Confirmed and fixed in `e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83`.
Verification now recomputes each raw receipt's event count and timestamp bounds from the
pinned bytes and checks the entire derived projection receipt against it. The identity
verifier also checks the capture basis, snapshot coverage, and binding receipt fields
against its pinned snapshot and bindings; fleet source, ring, live, and checkout counts
are checked as well. Synthetic CLI tests change receipt timestamps without changing
manifest length: verification exits 1 for the edit and 0 after restoration. The complete
15-test generator suite passes.

## Finding 3 — runtime directory prefix survives redaction (P2)

**Verdict: confirmed.** The starting committed fleet pin contained the runtime prefix in
17 NDJSON payloads and three JSON payloads: 20 files total. The identity pin had zero.
Additional scans found zero proc paths, shared-memory paths, or numeric user systemd
units in either starting pin.

**Fix:** every string leaf passes through longest-prefix rewriting for the effective
user's runtime directory (derived with `os.geteuid()`) and `XDG_RUNTIME_DIR` when set;
both become `<runtime>`. Both residue verifiers reject those runtime prefixes and the
bare `/run/user/` class. Proc and shared-memory paths become `<proc>` and `<shm>`;
proc process-number segments become `<process>`. User service/slice identifiers become
`<uid>`. Corresponding survivor classes fail residue verification without echoing
matched private bytes. These additions apply to both standalone generators.

**Proof:** synthetic fixtures exercise nested strings across admission, attempts,
verdict, ledger, live state, and binding data, including a custom runtime root. Rewritten
values pass; each original sensitive value fails. After the single refresh per corpus,
both built-in scanners pass. Independent scans over payload names and contents report
zero home, runtime, proc, shared-memory, hostname, hostname-digest, numeric user-unit,
admission-UID, and preview-process residues in either pin.

**Reply Fable can post:** Confirmed and fixed in `e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83`.
Both generators now rewrite the effective user's runtime prefix and `XDG_RUNTIME_DIR` to
`<runtime>` in every string leaf, and both residue scanners reject surviving runtime
prefixes, including the generic `/run/user/` class. I confirmed 17 affected NDJSON files
plus three JSON files before the fix. Both refreshed pins now scan clean. I also checked
proc paths, shared-memory paths, and user systemd units; none were present, and synthetic
regressions now cover their rewriting and rejection as well.

## Finding 4 — report hashes describe the first capture (P2)

**Verdict: confirmed.** The old report retained first-capture whole-tree hashes despite
an intervening refresh. Its manifest excerpts and count tables also needed an explicit
historical label.

**Fix:** `stage-a-report.md` now has the final instants and counts in its Refresh note,
and explicitly labels its pasted manifest heads, original count tables, and original
lane narrative as the first implementation capture. Both reports contain the final
whole-tree hashes below. They cover every payload and `MANIFEST.yaml` using sorted
complete relative POSIX names plus contents, each framed by an 8-byte big-endian length.

**Proof:** independent recomputation over the final pins gives:

- `run3-fleet`: `c9b8a20bf095bf1e47a5629ae8b02c34ef6c6138650fdda63120c9e17438385b`.
- `run3-checkout-identity`: `aa7c3ced17667a01c7ebc34f708e092e6288aa341f081abf7a98a9f6f7e8f477`.

The precise reproducible method is:

```python
import hashlib
from pathlib import Path

root = Path("<pin-directory>")
digest = hashlib.sha256()
names = sorted(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file())
for name in names:
    for value in (name.encode("utf-8"), (root / name).read_bytes()):
        digest.update(len(value).to_bytes(8, "big"))
        digest.update(value)
print(digest.hexdigest())
```

**Reply Fable can post:** Confirmed and fixed. The report's Refresh note now identifies
the final capture instants and counts, and the pasted manifest excerpts are explicitly
marked as historical first-capture evidence. I recomputed both whole-tree digests using
sorted relative POSIX names and contents with 8-byte big-endian length framing, including
each manifest. The current hashes are `c9b8a20bf095bf1e47a5629ae8b02c34ef6c6138650fdda63120c9e17438385b`
for fleet and `aa7c3ced17667a01c7ebc34f708e092e6288aa341f081abf7a98a9f6f7e8f477` for identity;
both reports now contain those values.

## Final captures and counts

Both generators were changed before capture. Each corpus was refreshed exactly once in
this lane, followed by two successful ordinary verify runs. Fleet custody references use
a new per-capture unrecorded salt. Live activity continued during capture; the population
changes from the prior pin are observations, not intentional checkout exclusions.

| Pin | Capture instant (UTC) | Probe/read finish (UTC) | Clones | Worktrees | Raw files | Properties | All files | Records | Bytes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| run3-fleet | 2026-09-09T03:13:20.428Z | 2026-09-09T03:13:27.254Z | 22 | 67 | 936 | 936 | 1873 | 7641 | 18263016 |
| run3-checkout-identity | 2026-09-09T03:13:49.440Z | 2026-09-09T03:13:53.495Z | 22 | 85 | 108 | 108 | 217 | 108 | 894499 |

All-file totals include the manifest. Identity raw files comprise 107 bindings and one
fleet snapshot. Fleet raw families are 2 admission journals / 189 rows, 350 attempt
files / 6,868 rows, and 584 verdict files / 584 records. Live and ledger payload counts
are both zero at this capture. Empty live families retain explicit receipts.

The canonical journal has 187 rows: 96 v1 admissions, 90 v1 releases, one v2 eviction.
The session-temp journal has two v1 rows (one admission, one release); the system-temp
root is absent. No v3 rows were observed. The failure-signature rider has 1,869 structured
occurrences; the cache-plan execution rider is absent. All 89 captured checkouts lack a
proof ledger. Stage B's existing gates are unchanged.

Generator SHA-256 pins:

- Fleet: `7d711673d80791ce2aa1c9a1d1d8da6e1ff1867a55962806355fdf44ffd378e3`.
- Identity: `bc3dbfb84ab802f8a25b8e3b7532856b00729ec76671c001934f4265c1705d39`.

## Detached-worktree transcript summary

The scratch worktree was created with:

```sh
git worktree add --quiet --detach .beep/review-fixes-worktrees/committed-head HEAD
```

Its HEAD was `e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83`. Its location under this checkout's
ignored `.beep/` directory respects the lane's writable-checkout boundary; no full Git
checkout was put on system-temp storage and no sibling checkout was edited.

The initial `uv` shim calls in that new directory exited 1 before Python because mise
had not trusted the new `mise.toml`. A standalone attempt to reuse `sys.executable`
after its parent `uv` invocation exited also failed because that temporary environment
was already removed. The successful invocation kept the trusted lane's offline `uv`
process alive and used its `sys.executable` to run both committed scripts with the
scratch directory as `cwd`. No trust setting was changed. The sanitized friction
receipt records this invocation requirement.

Actual successful ordinary-mode stdout (both process exits were 0):

```json
{"bytes_emitted":18263016,"events":7641,"files_emitted":1873,"payload_bytes":15623070,"payload_files":1872,"verification":"PASS"}
{"bytes_emitted":894499,"events":108,"files_emitted":217,"payload_bytes":694899,"payload_files":216,"verification":"PASS"}
```

`git ls-files <pin> | wc -l`-equivalent assertions additionally compared the exact path
sets, not only their sizes, against each manifest in the detached worktree:

- Fleet: 1,873 tracked files = 1,873 manifest `files_emitted`.
- Identity: 217 tracked files = 217 manifest `files_emitted`.
- Zero missing or extra paths, zero nested ignored checkout-directory segments.
- Every committed pin file equals the lane's final-capture bytes; scratch status is clean.

The scratch worktree is removed after the final report commit and committed-tree recheck.
No capture is run in the scratch worktree.

## Additional validation and handoff

- Generator regression suite: **15 tests PASS**, including actual CLI mutation failures
  and restored success for both manifests, raw-payload corruption, and no-live-read replay.
- Packet validator, run once after the fixes: **0 blockers, 0 warns**; 26 CQs and 25
  SPARQL files parsed.
- CQ suite, run once after the fixes: **0 failures across 25 seed tests and 20 fixtures**.
  Existing golden coverage remains 1/25 status-covered with no populated golden
  antecedent; this is existing CQ proof, not run-3 ontology ratification.
- Commit hooks: Biome, gitleaks, typos, and commitlint **PASS**. Biome made no changes.
- No workspace package was edited; package verification is not applicable.
- `etl_fleet_corpus.py` remains SHA-256
  `2b6fb03d818986fffcbc8951ec43b6b63dfb0d302c3a3c5a7ba45ecb7777e424`.
  Git's byte comparison against the starting commit is empty for that generator,
  `run2-fleet/`, `extraction/s5/`, `extraction/s6/`, and `extraction/s7/`.
  `DECISIONS.md` and `ATLAS.md` are untouched.
- The incoming review brief and `graft/` remain unrelated untracked work.
- Four local Yeet inbox rows were acknowledged with the `--fix-sha` form against
  `e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83`: `review-thread-5eab6efa2975`,
  `review-thread-88407a4b6e35`, `review-thread-ac7313b56d97`, and
  `review-thread-acab388cbb24`. This local acknowledgment does not post to or resolve
  any GitHub review thread.

The fix commit is `e9f5e0700a8c2d08ed8fb6ea31e3e4ca05b30d83`. This report and its final digest
wording are a separate documentation follow-up; neither commit has been pushed by this
lane. Fable can publish the branch and post the replies above.
