# Run-3 pin lane A — engine (rotation shelter, adapter v1.1.0, prose transcriber)

Written 2026-09-09 by the orchestrator (Fable). You are a Codex implementation lane in the
checkout `beep-effect8-s5` on branch `ontology-run3` (off main `85cc86d1f3`). A sibling lane
(lane B, `run3-pin-docket-brief.md`) is editing `ontology/docs/`, `ontology/tests/fixtures/`,
and `research/auditor-run3-intake.md` at the same time in this checkout. Do not touch those
paths. Do not run repo-wide formatters. Do not run `git add`, `git commit`, `git stash`,
`git checkout --`, or `git switch`; leave the tree dirty and list every touched path in your
report. The orchestrator stages by name and commits.

All paths below are relative to `explorations/beep-ci-operational-ontology/` unless they start
with `.claude/` or `apps/`. `ONT` = `ontology/extraction/s4/beep-ci-ops`. `ARCH` =
`ontology/extraction/s4/archives/beep-ci-ops`. `SKILL` = `.claude/skills/ontology-foundational-auditor`
(shared contracts in `.claude/skills/_shared/`).

## Read first (in this order; do not re-litigate any ruling)

1. `DECISIONS.md` sections: "auditor run-2 launch grill", "run-2 sitting 1..3", "run-3 corpora
   design grill" (Rulings 1–16), "Stage B capture grill" (17–21), "post-merge residue ruling"
   (22), "ratified-pin repair ruling" (23), "auditor run-3 launch" (the last entry).
2. `ONT/runs/orun-2026-08-29T08:20:55Z.README.md` (the rotation and relocation precedent) and
   `ONT/runs/orun-2026-09-03T02:46:18Z.README.md` + `.manifest.yaml`.
3. `ONT/work-run2/impl-report.md` and `ONT/adapters/README.md` (adapter-journal v1.0.0 record).
4. `SKILL/SKILL.md` (steps 1–2, golden fixture, rotation recipe), `.claude/skills/_shared/schemas/`
   (`source-observation`, `prose-observation`, `run-manifest`), and the validator
   `SKILL/scripts/validate_artifacts.py` (v14; read the pairing grammar for `.properties`, the
   `runs/` rotation-ledger and sibling-shelter rules near line 2089, the `golden_fixture` and
   adapter pin checks, and how the manifest commit is checked).
5. `ONT/corpus/po_transcriber_run2.py` (the deterministic transcriber precedent) and the three
   archived ordering captures under `ARCH/orun-2026-09-03T02:46:18Z.observations/prose-observations/`
   ids `po-736ad92a1de7`, `po-35a69c5bcbf7`, `po-d1f555913267`.
6. The four run-3 pins' `MANIFEST.yaml` heads: `ONT/corpus/run3-fleet/`, `run3-checkout-identity/`,
   `run3b-fleet/`, `run3b-synthetic/` (each raw payload has a sibling `.properties` projection).
7. `research/run3-lanes/emission-v2-report.md` §1 (the emitted term table) and
   `research/run3-corpora-design-brief.md`.

## Laws

- Byte-immutable: every file under the five corpus pins (`run2-fleet`, `run3-*`, `run3b-*`), the
  four generators and their tests, `ONT/adapters/adapter-journal.py` (v1.0.0, pinned by the run-2
  manifest), `ONT/adapters/golden/journal/`, everything under `ONT/runs/` except the README
  append below, and everything under `ARCH/`. Relocated files keep their bytes exactly (`git mv`).
- Public repo: no host paths, home directories, user ids, hostnames, or session ids in any new
  byte. Use `~`-relative or repo-relative wording. Run the residue scan the run-3 generators use
  (`etl_run3b_fleet_corpus.py` has a scan-output-bytes routine; reuse the same patterns) over
  every file you create or edit.
- Stdlib-only Python for the adapter and the transcriber (PyYAML allowed only where the run-2
  precedent already uses it and the sandbox runner supplies it). Run every Python command as
  `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python ...`
  unless a step below says otherwise. `bun` is at `~/.local/share/mise/installs/bun/1.4.2/bin`.
- Never gate a shell chain on `cmd | tail | grep -q`; capture exit codes explicitly.
- Friction receipts go to `research/OPPORTUNITIES.md` at the moment they happen (redacted).

## Deliverable 1 — run-2 rotation shelter (mirror the 2026-09-03 relocation)

Validator v14 treats `../archives/<root-name>/` as the sibling shelter and scans every
record-named YAML under `ONT/` as live evidence. Run-2's seat trees and ratifications bind run-2
observation ids and proposal digests that regenerate under the run-3 pin, so they must leave the
scan root before the pin, exactly as run 1's did at the run-2 launch.

- `git mv ONT/work/{alternative,foundational,hypotheses,proposals}` →
  `ARCH/orun-2026-09-03T02:46:18Z.work/` (same four subtree names).
- `git mv ONT/work/{denotation-batches,review-audit,sittings}` → the same `.work/` shelter
  (run 2 committed these beside the seat trees; run 3's `work/` must start empty).
- `git mv ONT/governance/ratifications` → `ARCH/orun-2026-09-03T02:46:18Z.governance/ratifications/`
  (rat-032..rat-052, 21 files). Before moving, verify each ratification's authority is projected
  into the packet's status surface (S5/S6 status files or the taxonomy/A-Box contracts): grep the
  rat ids or their term names. If any ratification is NOT projected anywhere, do not move it;
  report it as a blocker instead.
- Leave `ONT/work/` present and empty (git does not track empty dirs; that is fine).
- Append a dated "2026-09-09 relocation note (run-3 launch)" section to
  `ONT/runs/orun-2026-09-03T02:46:18Z.README.md` in the style of the run-1 README's note: what
  moved, why (v14 sibling shelter; reference closures regenerate under a new pin), and that bytes
  are unchanged.
- Prove the scan: write a PROVISIONAL, untracked `ONT/work/run-manifest.yaml` (schema
  `_shared/schemas/run-manifest.schema.yaml`; `first_run: false`,
  `prior_index: runs/orun-2026-09-03T02:46:18Z.index.yaml`, `prior_index_sha256_12: a207a106de68`,
  current HEAD as the commit, validator/contract digests as the validator computes them), run
  `python SKILL/scripts/validate_artifacts.py ONT` without `--gate`, record every violation, then
  DELETE the provisional manifest. Acceptable residual violations are only those inherent to a
  pre-observe state (no observations yet, dirty tree). Zero violations may name a run-2 record id,
  an archived path, or a ratification. Paste the exact residual list in the report.

## Deliverable 2 — adapter-journal v1.1.0 over the four run-3 pins

New file `ONT/adapters/adapter-journal-run3.py` (adapter id `adapter-journal`, version `1.1.0`;
v1.0.0 bytes untouched). Requirements:

- Standard-library only; runs under `SKILL/scripts/run_adapter_sandbox.sh` in both `self-check`
  and repository modes (prove both). Repository mode reads the 40-hex `commit:` pin from
  `ONT/work/run-manifest.yaml` exactly as v1.0.0 does; fail closed if it is missing or malformed.
- Reads ONLY the `.properties` projections under the four run-3 pins. Emits `config_key_value`
  facts that validator v14 authenticates: mirror its `.properties` pairing grammar and comment
  stripping exactly (an adapter that emits more than the validator authenticates fails the gate;
  under-emission falls through to `unrepresentable_construct`). Values verbatim to end of line.
- Emission rule = (a) the v1.0.0 vocabulary census per (pin, kind) — first-occurrence keys, files
  in lexicographic repo-relative order, a file emits only when it adds a new key — PLUS (b)
  docket-evidence selection, rule-based and disclosed, so a seat can reconstruct these joins
  from the observation records alone without opening raw files:
  - every projection under `run3b-synthetic/` (all files; labeled synthetic by their manifest);
  - `run3-checkout-identity/bindings`: first file per distinct value class of the discriminator
    keys (checkout kind primary/linked/canonical-runtime, git-common-dir linkage class, turbo
    cache mount presence, remote-cache enablement) — read the pin's MANIFEST for the key names;
  - admission journals in `run3-fleet/` and `run3b-fleet/` (canonical and session roots): first
    occurrence per (event tag, root) for the v3 families `admission-enqueued`,
    `admission-withdrawn`, `admission-lease-evicted`, `admission-ticket-evicted`, and released
    rows carrying `checkoutRoot`/`branch`; plus complete per-nonce chains that contain a
    contention outcome (enqueued→withdrawn, enqueued→admitted, evicted) — the record must carry
    the nonce, tag, instant, and checkout facts of every event in the chain;
  - verdict projections: first file per distinct value class for failure-signature evidence
    (`failureKind` joined to the failed step reference) and cache-plan-resolution evidence
    (resolver result / cache posture keys) — these are the Ruling-6 promoted riders
    `pa-failure-signature` and `pa-cache-plan-resolution`;
  - attempt projections: vocabulary census only unless a docket join above needs them.
  Keep the total under ~250 SourceObservations; report the census per pin and kind.
- Golden fixture `ONT/adapters/golden/journal-run3/` with `input/`, `expected/`
  (`so-*.yaml.expected`), `expected-metadata.yaml`, `README.md` — same conventions as
  `golden/journal/`; the fixture must lock every rule in (a) and (b) with small synthetic inputs
  (no copied fleet bytes; no host residue).
- Append a "v1.1.0 record — auditor run 3" section to `ONT/adapters/README.md` with the rule table
  and any known limitations discovered while mirroring v14.

## Deliverable 3 — run-3 prose transcriber

New file `ONT/corpus/po_transcriber_run3.py`, deterministic, same CLI shape as the run-2
transcriber (`--repo . --out <dir> [--dry-run]`), every input byte from `git show HEAD:`.
Sources, in this order:

1. The three archived ordering captures (ids above): re-mint under the run-3 pin from their
   recorded path, span, and quote; if a span drifted, recover the smallest containing window as
   the run-2 transcriber does and report the correction; never paraphrase.
2. `apps/labs/ciops/test/fixtures/emission-v2.ttl`: one ProseObservation per Turtle subject
   block (subject line through its terminating `.`), in file order.
3. `apps/labs/ciops/src/projection/Turtle.ts`: one ProseObservation per emission site named in
   the emission-v2 report's term table (the line range that emits that predicate or type).
4. `ontology/docs/s7-projection-contract.md` and `research/s7-replay-evidence.md`: the run-2
   heading-plus-first-block section rule.
Quotes must satisfy the schema (>=10 stripped chars; verbatim modulo whitespace). Report the
dry-run census per source. Do not transcribe DECISIONS.md, CQ text, or ratifications — they are
warrants and governance, not evidence.

## Deliverable 4 — engine facts for the run manifest (report only)

- Validator digest (`sha256sum` 12-hex of `validate_artifacts.py`), contracts digest exactly as
  the validator computes it over the `_shared` closure (find the function; do not guess), the
  five seat prompt digests under `SKILL/prompts/`, `SKILL.md` digest, and
  `run_adapter_sandbox.sh` digest.
- Run the validator self-test under `--python 3.12` and `--python 3.13`; report pass/fail counts
  and which runtime run 3 should pin.
- Current `cq_suite` digest and `cq_count` are lane B's concern (they change the CQ file); do not
  record them.

## Proofs before you hand back

- Adapter self-check golden passes under the sandbox runner; repository mode emits the census
  you report (run it with the provisional manifest, then delete the manifest and the emitted
  records — nothing under `ONT/work/` may remain).
- Transcriber `--dry-run` census reported; a real run into a scratch dir under
  `~/.cache/beep/run3-pin-scratch/` (not the repo) followed by validator scan of those records
  under a throwaway ontology root copy is a bonus, not required.
- Residue scan clean over every new/edited file.
- Typos: run the repo's typos check on touched files if `bun run beep` exposes one.

## Report

Write `research/run3-lanes/run3-pin-engine-report.md`: what you built, the emission rule table,
the census, the residual validator list from Deliverable 1, engine digests and the runtime
verdict, blockers, and a final `### Files` list (every created, edited, and moved path, moves as
`old -> new`). Keep it factual; no host paths.
