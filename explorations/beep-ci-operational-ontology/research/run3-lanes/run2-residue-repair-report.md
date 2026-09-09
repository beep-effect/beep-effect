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
  --run2-only --finding "Ruling 23" \
  --source-ref a8a7931b21ca2f0e25f8103a854f8ab39000f7f8

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

## Reconciliation with #1037

Date: 2026-09-09. Main was fetched and pinned at
`22063e7b6dbb6e63adcf0b080b397fcb350712b7`. Merge commit `375e767e2a` has parents
`920c686b4a` and `22063e7b6d`. It resolves the three expected conflicts by retaining
both generator implementations and selecting main's run-2 manifest. The following
repair replays that committed main pin through the merged generator. This section's
receipts supersede the earlier report's generator, manifest, and whole-tree hashes.

The merged redactor drops CSF-013 process-member variants while applying the hostname
digest and UID string substitutions only with `repair=True`. The scanner retains
both sets of checks, including decoded escaped keys and properties. Explicit
attribution remains required before source replay. The CLI accepts
`--finding "Ruling 23"` only with `--run2-only`; the new receipt uses `Ruling 23`
for both `finding` and `ruling`, with no CSF identifier assigned to this repair.
The superseded-manifest digest belongs to the appended entry, preserving the first
receipt's original digest.

Main contains **two** CSF-013 updates. Both are preserved exactly. The resulting
history is the original CSF-012 receipt, the two CSF-013 updates in their original
order, and one Ruling 23 update. The new update records 29 changed raw payloads,
the two residue classes, `live_recapture: false`, and main's manifest digest as both
its source and superseded manifest. No receipt is manually reconstructed.

The independent audit reads main's complete pin from `git archive` into memory.
Every repaired payload must equal its main bytes after only the two specified
substitutions. It found 313 hostname-digest and 313 UID substitutions in exactly
29 raw files. The only corpus paths differing from main are those files and the
manifest. All 794 projections and 1,559 corpus files are unchanged. The merged
pin has 1,589 files, 6,213 events, and 13,316,312 bytes; the capture instant remains
`2026-09-03T02:27:19.384Z`.

The manifest audit compares every decoded field, allowing only the generator digest,
two appended rule descriptions, recalculated byte and integrity receipts, emitted
byte totals, and the appended security update. Capture history, custody references,
source descriptors, event counts, and ordering match main exactly. The protected-file
audit covers 2,870 files: run-3 and run-3b pins, generators, and tests equal incoming
main, and `DECISIONS.md` equals the branch's starting HEAD. The reconciliation makes
no separate changes to those protected files. The README and open-question manifest
record the reconciliation; the packet's stage and lifecycle remain unchanged.

| Check | Reconciliation result |
| --- | --- |
| Repair staged verifier | PASS; 29 raw payloads sanitized |
| Ordinary run-2 verifier | PASS; redaction, projection, host-path, and secret checks |
| Run-2 suite | 10 tests PASS; original nine plus combined CSF-013/Ruling 23 regression |
| PR #1037 suites | 38 tests PASS with the fixture-directory override below |
| Independent corpus and manifest audit | PASS; exactly 29 raw files plus manifest differ from main |
| Hostname digest, numeric UID, home paths, raw PID scans | 0 for every class |
| Schema process metadata, decoded process members, escaped process keys | 0 for every class |
| Packet validator | 0 blockers, 0 warns; 26 CQs and 25 SPARQL files |
| CQ suite | 0 failures across 25 seed tests and 20 fixtures |
| Repair rerun without source replay | PASS; verified unchanged |
| Protected-file comparison | PASS; 2,870 files unchanged after merge resolution |
| Post-commit knowledge references | PASS; exit 0 and 0 live gated observations |
| Detached committed-HEAD verifier and run-2 suite | PASS; verifier and all 10 tests, clean tracked tree |
| Commit hooks | Gitleaks, typos, Biome, and commitlint PASS |

| Receipt | SHA-256 |
| --- | --- |
| Merged generator | `5f1b8ccc04aba2d52506ebcf0eeac6da9fa9242752d747af7ab54de98f522ab1` |
| Main manifest | `15776b69b2af00fe34cc9a6d06ad7523861736dc209802a9e106ac39b891b77f` |
| Reconciled manifest | `7f68bcf9a48ffa0e20b5614cd9309c397d09fbf1e82eda9be60a4fadd224c002` |
| Main whole tree | `c720365b514b3c655d884e5abc72df69f9278379b234401893317a2f3bac7fda` |
| Reconciled whole tree | `2dee0abcc0cd2b340c82b48202222bd33c81e0f1ce93c236d1e83a524342a055` |

Replay command, with the same offline Python environment used above:

```sh
uv run --offline --with pyyaml python \
  goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py \
  --run2-only --finding "Ruling 23" \
  --source-ref 22063e7b6dbb6e63adcf0b080b397fcb350712b7
```

Two environment failures were attributed before retrying. SSH fetch failed on a
local configuration ownership check; read-only HTTPS fetched the same public main
without changing remote configuration. The unmodified PR #1037 suites first passed
36 tests and failed two fixture setups because `~/.cache/beep` is read-only in this
lane. The successful rerun redirected only temporary directories requested at that
exact cache path into this worktree. No test body, assertion, generator, or home
directory setting changed. Both receipts are in `research/OPPORTUNITIES.md`.

The fixture override is reproducible from the repository root:

```sh
uv run --offline --with pyyaml python - <<'PY'
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

scratch = Path.cwd() / ".beep/run2-residue-repair/fixtures"
scratch.mkdir(parents=True, exist_ok=True)
cache = Path.home() / ".cache/beep"
original = tempfile.mkdtemp
def redirected(suffix=None, prefix=None, dir=None):
    return original(suffix=suffix, prefix=prefix, dir=scratch if dir == cache else dir)
suite = unittest.defaultTestLoader.discover(
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus",
    pattern="test_run3*generator*.py",
)
with patch.object(tempfile, "mkdtemp", redirected):
    result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())
PY
```

After committing the repaired pin, `bun run beep knowledge refs --check` passed
with zero live gated observations. A detached checkout under
`.beep/run2-residue-repair/reconcile-detached` passed the ordinary run-2 verifier
and all 10 run-2 tests without tracked changes. Its full corpus digest matched the
reconciled receipt above. The optional mise registration warnings described in the
original report recurred; every proof command exited 0. The lane repeats the
knowledge-reference and detached checks at final HEAD after this report update,
then removes the disposable checkout. No push or PR creation is part of this handoff.

## Review fixes (Greptile)

Date: 2026-09-09. Review base: `7239046a4d`. Both held findings are fixed.

G1: the repair recognizes any 12-hex hostname digest in a proof-lock directory
name, including uppercase hex and a previously redacted UID. It replaces the digest
with `<host>` and numeric UID tokens with `uid-<uid>`. The scanner rejects either
raw component in filenames and contents, regardless of the replay host. Runtime
hostname-digest checks remain an additional guard. Ordinary redaction semantics
are unchanged. Two new tests cover foreign hosts through five JSON serialization
depths, partial redaction, non-echoing rejection, and safe lookalikes.

G2: explicit source replay compares all repaired payload bytes with the destination
before staging. It verifies unchanged when the latest security receipt has the same
finding, residue classes, and source-manifest digest, and the destination already
pins the current generator. No receipt or file is rewritten. Source integrity and
generator provenance still run before this check; the complete destination verifier
runs before returning. An extra destination file fails verification.

The first #1037 regression run exposed a necessary provenance distinction: its first
explicit replay uses an older source than the preceding ordinary repair. Comparing
the source-manifest digest preserves that new receipt. The corrected implementation
passes all 38 unmodified #1037 tests. The strengthened run-2 replay test also checks
whole-tree byte equality, an unchanged receipt list, no staging, damaged payload
recovery, missing residue classes, different finding attribution, and a new generator.

G1 requires no further payload redaction. All 1,588 payloads, including the 29 files
repaired earlier and all 794 projections, are byte-identical to the review base.
No new security receipt was added. The history remains CSF-012, two CSF-013 updates,
and one Ruling 23 update, with every field unchanged.

The manifest changes because ordinary verification binds the exact generator bytes.
After checking the prior generator's committed provenance and every payload receipt,
the lane verified that repair-mode redaction would change no decoded payload. It
then used `dump_manifest_with_totals` to regenerate only the generator digest, the
hostname rule description, and the emitted-byte total. A disposable copy of the full
pin passed `verify_output_tree` with that manifest before promotion. An independent
comparison against the review base confirms those are the only three changed manifest
fields. This updates the generator binding without replaying a repair or recapturing.

The pin still has 1,589 files and 6,213 events. Its capture instant remains
`2026-09-03T02:27:19.384Z`. The manifest grew by 143 bytes, bringing the complete pin
to 13,316,455 bytes. The earlier main-to-pin audit still finds exactly 313 hostname
and 313 UID replacements in the original 29 raw files; all custody and capture
metadata remain intact.

| Check | Review-fix result |
| --- | --- |
| Run-2 tests | 12 PASS, including the original 10 with stronger replay assertions |
| PR #1037 tests | 38 PASS with the unchanged fixture-directory override above |
| Staged manifest and ordinary run-2 verification | PASS |
| Documented explicit source replay | `verified unchanged`; all 1,589 files byte-identical |
| Independent corpus and manifest audit | PASS; manifest alone differs from the review base |
| Structural proof-lock, hostname digest, UID, home path, raw PID scans | 0 for every class |
| Schema process metadata, decoded process members, escaped process keys | 0 for every class |
| Packet validator | 0 blockers, 0 warns; 26 CQs and 25 SPARQL files |
| CQ suite | 0 failures across 25 seed tests and 20 fixtures |
| Protected-file audit | 2,870 files unchanged, including decisions and run-3/run-3b artifacts |
| Whitespace check | `git diff --check` PASS |
| Post-commit knowledge references | PASS; exit 0 and 0 live gated observations |
| Detached committed-HEAD verifier and run-2 tests | PASS; verifier and 12 tests, clean tracked tree |
| Commit hooks | Gitleaks, typos, and commitlint PASS; Biome and JSDoc have no applicable files |

| Receipt | SHA-256 |
| --- | --- |
| Review-fixed generator | `42666faada44d5d67ddf232473f5f4ed011623ec59152b83721489f8151be625` |
| Review-base manifest | `7f68bcf9a48ffa0e20b5614cd9309c397d09fbf1e82eda9be60a4fadd224c002` |
| Review-fixed manifest | `8ef17f3b15c6ccbfaf5a3642ebebb6192d302c5de4f3e14d77c6748d93a47318` |
| Review-fixed whole tree | `6af82056021a52dacc200a269ef973f10c89b7eae04c3563cfa69d8e6b5ef8b8` |

The ordinary verifier, run-2 tests, packet validator, CQ suite, and source replay use
the commands already recorded above. The explicit replay check captures every file
before and after the documented command and asserts exact byte equality, including
the manifest. After the implementation commit, `bun run beep knowledge refs --check`
passed with zero live gated observations. A detached worktree at that commit passed
the ordinary verifier and all 12 run-2 tests with no tracked changes. The optional
mise registration warnings described earlier recurred; the proof commands exited 0.
The lane repeats these commit-dependent checks at the final amended HEAD after this
report update, then removes its disposable checkout. No push or PR operation is part
of this handoff.

### Additional findings (Codex)

Date: 2026-09-09. Additional-findings base: `f2e9cf9bd1`. The worktree was clean
at handoff; the prior G1/G2 implementation was committed in `81b504ed73`. The
following completes X1–X4 and supersedes the preceding generator and pin hashes.

- **X1:** covered by G1's structural proof-lock matching. Foreign-host and partial
  redaction regressions remain green.
- **X2:** run-2 replay selects `repair=True` and adds the Ruling 23 redaction rule
  descriptions only when the finding is `Ruling 23`. A CSF-012 or CSF-013 replay
  retains the ordinary process-member and PID transformations. If its source also
  contains hostname or UID residue requiring Ruling 23, staged verification rejects
  it without changing the destination. Both CSF findings still repair sources with
  only CSF residue, preserve their original receipt history, record their own finding
  without `ruling` or `residue_classes`, and verify unchanged on repeated replay.
- **X3:** numeric UID scanning examines decoded string values in JSON/NDJSON,
  recursively through objects and arrays. Structural keys such as `uid-123` stay
  unchanged and pass the full staged verifier. Embedded JSON remains string content,
  so numeric UID tokens inside it still require redaction. The regression also checks
  Unicode-escaped keys and values. Filename, properties, manifest, other text,
  hostname, process-member, PID, path, and secret checks remain in force.
- **X4:** the primary historical reproduction command now includes
  `--finding "Ruling 23"`. The reconciled-source replay command above retains the
  same required attribution and returns `verified unchanged` on the current pin.

The tests first reproduced the preserved-key contradiction at the complete scanner
and staged-verifier boundaries. During verification, the existing CLI smoke test
also tried ordinary repair against the working pin after the generator changed.
That appended a zero-change receipt and reordered rule descriptions. This test now
forbids staging and requires `verified unchanged`, preventing that mutation when the
generator binding is stale. The OPPORTUNITIES ledger records the evidence.

To preserve the ratified history, the final manifest was regenerated from committed
HEAD's manifest after checking its generator provenance, every payload digest, and
exact equality of all 1,588 payloads with committed HEAD. Repair-mode redaction also
left every decoded payload unchanged. `dump_manifest_with_totals` changed only
`generator_sha256`; a disposable full-pin copy passed `verify_output_tree` before
promotion. No rule description, byte total, or security receipt differs from
`f2e9cf9bd1`, and no live capture ran.

The independent audit still finds exactly 313 hostname substitutions and 313 UID
substitutions in the original 29 raw files relative to reconciled main. All 794
projections are unchanged. The security history remains CSF-012, two CSF-013 updates,
and one Ruling 23 update, with every field unchanged from the additional-findings
base. The pin has 1,589 files, 6,213 events, and 13,316,455 bytes; capture instant
`2026-09-03T02:27:19.384Z` is unchanged.

| Check | Additional-findings result |
| --- | --- |
| Run-2 tests | 14 PASS, including preserved-key staged replay and both CSF authorities |
| PR #1037 tests | 38 PASS with the unchanged fixture-directory override above |
| Staged manifest and ordinary run-2 verification | PASS |
| Explicit reconciled-source replay and ordinary repair | `verified unchanged`; all 1,589 files byte-identical |
| Independent corpus and manifest audit | PASS; only `generator_sha256` differs from the additional-findings base |
| Structural proof-lock, hostname digest, UID, home path, raw PID scans | 0 for every class |
| Schema process metadata, decoded process members, escaped process keys | 0 for every class |
| Packet validator | 0 blockers, 0 warns; 26 CQs and 25 SPARQL files |
| CQ suite | 0 failures across 25 seed tests and 20 fixtures |
| Protected-file audit | 2,870 files unchanged, including decisions and run-3/run-3b artifacts |
| Whitespace check | `git diff --check` PASS |
| Post-commit knowledge references | PASS; exit 0 and 0 live gated observations |
| Detached committed-HEAD verifier and run-2 tests | PASS; verifier and 14 tests, matching corpus hash, clean tracked tree |
| Commit hooks | Gitleaks, typos, Biome, and commitlint PASS |

| Receipt | SHA-256 |
| --- | --- |
| Final generator | `3cd7af71dda7ea6fed6b9b4d2399dbfa55be572746420000168a7cda23e09206` |
| Additional-findings base manifest | `8ef17f3b15c6ccbfaf5a3642ebebb6192d302c5de4f3e14d77c6748d93a47318` |
| Final manifest | `2002198a991778ebf75d0aa79c034bd16c820bbfa5de6e3d96f12f66b946eb10` |
| Final whole tree | `f37916859376db8c022ef68186cb6173dee667c504e10223a91c33c1ab7da84e` |

No workspace package changed. The packet README, open-question manifest, and
OPPORTUNITIES ledger record this completion without changing stage or lifecycle.
After the implementation commit, `bun run beep knowledge refs --check` passed with
zero live gated observations. A detached checkout under
`.beep/run2-residue-repair/additional-detached` passed the ordinary verifier and all
14 run-2 tests. Its corpus hash matched the final whole-tree receipt, and its tracked
tree stayed clean. Optional mise registration warnings recurred because global mise
state is read-only; every proof command exited 0. The lane repeats both checks at the
final amended HEAD after this report update, then removes the disposable checkout.
Publication and PR operations remain with Fable.
