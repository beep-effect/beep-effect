# Run-2 fleet residue repair report

Date: 2026-09-09. Implementation lane: Codex. Branch: `fix/run2-fleet-residue-repair`.
Steward authority: Ruling 23. Fable owns review and publication after #1040.

## Result

Repaired the ratified run-2 fleet pin in place from committed source
`a8a7931b21ca2f0e25f8103a854f8ab39000f7f8`. Exactly 29 raw files and `MANIFEST.yaml`
changed. There are 313 hostname-digest replacements and 313 numeric UID replacements.
Every changed raw file equals its original bytes with only these substitutions:
`sha12(hostname)` becomes `<host>` and numeric UID tokens become `uid-<uid>`.
The hostname and its digest are computed in memory and are absent from this report.

The capture instant remains `2026-09-03T02:27:19.384Z`. The pin still has
1,589 files and 6,213 events. All 794 projections are byte-identical after regeneration;
the retained messages containing residue have line breaks and are ineligible for the
single-line property projection. In total, 1,559 corpus files are unchanged.

The manifest retains the complete first CSF-012 security receipt and appends one
`security_resanitization.updates` entry citing `Ruling 23`, `sha12(hostname)`, and
`uid-[0-9]+`. The new entry records the committed source manifest digest, 29 changed
raw payloads, and `live_recapture: false`. Capture metadata, source descriptors,
custody references, event order, event counts, and ratification artifacts are unchanged.

## Implementation

- `etl_fleet_corpus.py` applies the two extra string transformations only when
  `redact_string_values(..., repair=True)` is called by the repair script. Ordinary
  redaction retains its prior semantics. The public-output scanner rejects both
  classes in filenames and contents without echoing their values. UID prefix
  handling matches the later Stage B generator, including a numeric prefix followed
  by a suffix; structural keys and non-string scalars remain untouched.
- The existing security packet entry point,
  `goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py`,
  has a `--run2-only` selector. Its source replay, committed generator provenance,
  payload-integrity checks, staged verification, and atomic promotion remain in use.
  Superseded-manifest digests now belong to the new repair record, so a later replay
  preserves the first repair record instead of overwriting one of its fields.
- `test_run2_repair.py` contains nine regressions. They cover nested JSON through five
  serialization depths, runtime hostname changes, UID prefixes, safe lookalikes,
  scalar and key preservation, non-echoing rejection, existing PID handling,
  committed-history replay, unknown-generator rejection, corrupted-source rejection,
  projection fidelity, receipt preservation, idempotence, ordinary verification
  without capture or subprocesses, and the run-2-only CLI boundary.

No run-3 or run-3b pin, generator, or test file changed. `DECISIONS.md` is unchanged.
The packet README, open-question manifest, and OPPORTUNITIES ledger record this repair.
No workspace package changed.

## Verification

| Check | Result |
| --- | --- |
| Original generator and committed pin before edits | PASS; 1,589 files, 6,213 events, 13,316,735 bytes |
| New regressions before implementation | Reproduced missing repair rules and scanner rejection |
| Final run-2 regression suite | 9 tests PASS |
| Repair staged verifier | PASS; 29 raw payloads sanitized |
| Ordinary repaired-pin verifier | PASS; 1,589 files, 6,213 events, 13,315,781 bytes |
| Independent byte and manifest comparison against source commit | PASS; only the 29 expected raw files plus manifest changed |
| Independent hostname-digest scan | 0 files |
| Independent `uid-[0-9]+` scan | 0 files |
| Independent home-path and raw PID scans | 0 files for each class |
| Recursive decoded JSON numeric process-member scan | 0 members |
| Packet validator | 0 blockers, 0 warns; 26 CQs and 25 SPARQL tests |
| CQ suite | 0 failures across 25 seed tests and 20 fixtures |
| Protected-file hash comparison | 2,827 unchanged files, including other pins, generators, decisions, and the three pre-existing Graft wiring edits |
| Post-commit `bun run beep knowledge refs --check` | PASS; 0 live gated observations |
| Clean detached committed-HEAD verifier and regressions | PASS; ordinary verifier and all 9 tests |
| Commit hooks | Gitleaks, typos, Biome, and commitlint PASS |

The byte audit loaded the original pin with `git archive` into memory and compared
its complete file inventory with the repaired tree. For each of the 29 affected raw
files it asserted exact byte equality after only the two replacements. Every other
payload had to match exactly. The manifest comparison allowed only the generator
digest, appended redaction descriptions, per-file byte counts and digests, emitted-byte
totals, and the appended security update; every other decoded field matched. The
first repair receipt matched independently. A second ordinary repair invocation
verified without rewriting the pin.

The residue audit used independent byte regexes over filenames and contents, then
recursively decoded raw JSON/NDJSON and JSON embedded in string leaves to check for
remaining numeric process members. It did not emit the sensitive values.

## Integrity receipts

Whole-tree SHA-256 uses UTF-8 path order and hashes the concatenation of
`relative_path + NUL + sha256(file_bytes) + LF` for every file, including the manifest.

| Receipt | SHA-256 |
| --- | --- |
| Source generator | `962759f2ee171b171a23f5ca0c048f43c0c0586d0446e51adb3ae3f007851229` |
| Repaired generator | `7f67af18e06fa3ad043aecf494e643560e6d22f6a5c16f4c7398cb116cbb0608` |
| Source manifest | `ad14e0ee438e4863be14809185be474e59f478d072c42e2bf5b3b1730de20433` |
| Repaired manifest | `535970a9fad200f20b2a30700e00273c3b0b5c64037f344285a1dbe5a49370d7` |
| Source whole tree | `05c23d445dce92c719e7e520474c3dc68cdc01a896b49c420aedd4cbd9300a4d` |
| Repaired whole tree | `e75c8e1c1cc36858cb5fd68fbdcc308bb55cb19591f29371b2701341bfff10bd` |

The original CSF-012 source-manifest digest remains
`be2144da427e7f9671d386713fb4a34e52246bb8702b586e9de4eb3b74880dc3`, and its original
superseded-manifest digest remains
`3683a1657a44e0c2e018a68daef57d18fdd2c73d2b86b09bdf57d4b510c5b3b3`.

## Commands

Run from the repository root with `UV_CACHE_DIR=~/.cache/beep/uv-cache` and
`PYTHONDONTWRITEBYTECODE=1`. The explicit source replay is the repair operation;
ordinary verification and a repair invocation without `--source-ref` are read-only
for the completed pin.

```sh
uv run --offline --with pyyaml python \
  goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py \
  --run2-only --source-ref a8a7931b21ca2f0e25f8103a854f8ab39000f7f8

uv run --offline --with pyyaml python \
  explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/etl_fleet_corpus.py

uv run --offline --with pyyaml python -m unittest discover \
  -s explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus \
  -p test_run2_repair.py

uv run --offline --with pyyaml,rdflib python \
  explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py

uv run --offline --with pyoxigraph python \
  explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py

bun run beep knowledge refs --check
```

## Post-commit proof

After committing the repair, `bun run beep knowledge refs --check` returned exit 0
with `check: 0 live gated observation(s)`. Its output identifies the evaluated HEAD.
A detached worktree was created inside this lane with:

```sh
git worktree add --quiet --detach .beep/run2-residue-repair/detached-verify HEAD
```

The ordinary run-2 verifier and all nine regression tests passed from that committed
checkout. Its tracked tree remained clean. The full corpus hash matched the repaired
whole-tree receipt above, which includes every file and its relative path. These checks
are repeated at final HEAD after the report update; they do not depend on untracked
payloads or an uncommitted generator. The disposable proof worktree is removed after
verification. No push or PR creation is part of this lane.

The detached shell emitted optional mise checkout-registration warnings because the
managed sandbox cannot write global mise state. Both proof commands still exited 0;
the OPPORTUNITIES receipt records that environment friction.

## Handoff notes

The lane's starting tree contains Ruling 23 but not the named Ruling 22 section.
The amended Ruling 22 was read from local Git commit `05a8f2ed48`, where it permits
refresh only before ratification and records the earlier CSF-012 repair. Ruling 23
therefore governs this run-2 correction. PR #1032's generator diff was read from
`6b4720f1fb`; its history-aware repair implementation lives in the security packet
script, rather than in the generator CLI as the brief's wording suggested.

The branch is local only. Publication remains with Fable after #1040.
