# P3 / W7 pin lane, ENGINE step: call-b proofs, launch gate, run-3 rotation, adapter v1.2.0, transcriber, digests

Written 2026-10-06 by the P3 orchestrator. You are a Workflow lane (`claude-opus-5-5`, effort `medium`, fresh context; GD Ruling 8) in the run-lane checkout
`$LANE` the launch message names: branch `feat/ciops-p3-run4` off the #1459 merge commit (Ruling 1). The CQ-009 step (Ruling 5) and the docket step (Ruling
10) may edit their own files in this checkout concurrently. Read files you do not own via `git show HEAD:<path>`. Cites are at `feat/ciops-p2-projection` @
`37f7937f1f`; if one moved, re-derive it by its needle and say so. `X` = `explorations/beep-ci-operational-ontology`; `ONT` =
`X/ontology/extraction/s4/beep-ci-ops`; `ARCH` = `X/ontology/extraction/s4/archives/beep-ci-ops`; `SK` = `.claude/skills/ontology-foundational-auditor`; `V` =
`SK/scripts/validate_artifacts.py`; `GD` = `goals/ciops-ontology-pipeline/research/decisions.md` entry "2026-10-06 — P3 opened; run-4 launch sitting" (Rulings
1–17, calls a–q); `XD` = `X/DECISIONS.md`; `DK` = `X/research/auditor-run4-intake.md`; `SPEC` = `goals/ciops-ontology-pipeline/SPEC.md`; `RID3` =
`orun-2026-09-10T02:10:52Z`. **Order: 0 → A1–A4 → F → A5 → B → C → D → E → G → H.** Call (m) splits it into two launches: STAGE 1 = 0, A1–A5, F, B (then stop and return so the
orchestrator stages the relocation); STAGE 2 = 0, C, D, E, G, H, in parallel with the docket step. Your launch message names your stage.
## Hard rules
1. Edit files only (Ruling 4; `DK:1072`): no `git add/mv/rm/commit/stash/checkout/switch/reset/tag/push/worktree`, nothing remote. Read-only git is fine; the
   orchestrator stages by name. Never touch `~/YeeBois/projects/beep-effect5`, any fleet clone or any `.beep/` tree; never pass `--refresh` or
   `--dry-run-root` to a corpus generator (both read the fleet).
2. Public repo (`SPEC:198-199`): bytes you write (files, report, receipts) carry no `/home/`, `-home-`, `/tmp/`, `/run/user/`, login, hostname, uid, pid,
   UUID-shaped id or session id. Write home as `~`, repo paths repo-relative. Never quote a full `originKey`, raw ledger row or stream-json init event.
3. zsh, no persistent state: prepend this to every Bash call. Python only via `PY` (call a); never a quoted `~`, never `mise trust`. The adapter alone runs
   under the sandbox runner's `/usr/bin/python3`, stdlib-only (`DK:1043-1045`).
   ```zsh
   LANE=<path from the launch message>; cd "$LANE"; X=explorations/beep-ci-operational-ontology; ONT=$X/ontology/extraction/s4/beep-ci-ops
   ARCH=$X/ontology/extraction/s4/archives/beep-ci-ops; SK=.claude/skills/ontology-foundational-auditor; RID3=orun-2026-09-10T02:10:52Z; E=$HOME/.cache/beep/run4-engine
   PY=(env -u TMPDIR PYTHONDONTWRITEBYTECODE=1 UV_CACHE_DIR=$HOME/.cache/beep/uv-cache $HOME/.local/bin/uv run --offline --python 3.12 --with pyyaml python -B)
   VAL() { "${PY[@]}" "$SK/scripts/validate_artifacts.py" "$@"; }; STOP() { print -r -- "STOP: $*"; exit 1; }
   ```
4. Heavy commands (the F2 verifies) run as `beep-heavy "${PY[@]}" …`; on "all 3 slots busy", wait. Never gate on `cmd | grep -q`; capture `; echo exit=$?`,
   logs in `$E/logs/`. Every guard is `[[ … ]] || STOP <why>`, which ends the call. If `git rev-parse HEAD` moves during C, D or E (an orchestrator commit),
   rerun that step at the new HEAD and say so.
5. Receipts (call d): when friction happens, append ONE `>>` heredoc to `X/research/OPPORTUNITIES.md` (siblings append too): the heading
   `## 2026-10-06: P3 pin lane — engine step — friction` if the file's last `## ` heading is not yours, then bullets work / evidence command + minimal error
   text / prevention, redacted per rule 2.
6. Expected noise (call c), never quieted by inventing index rows, setting `empty_corpus_reason` or editing a frozen byte: with a manifest, exactly 138
   `prior unresolved observation … has NO row in this run's index` (`V:2347-2356`); with a manifest and no observation,
   `run produced ZERO observations without a substantive empty_corpus_reason` (`V:2370-2373`); with `adapters: []` (C only),
   `missing/empty required field adapters` (`V:125-129`, `:1090-1091`). Any other line is a finding: paste it verbatim.
## 0. Preconditions (`SPEC:202-203`)
```zsh
[[ $(git rev-parse --abbrev-ref HEAD) == feat/ciops-p3-run4 ]] || STOP branch
[[ $(grep -c '^## 8. 2026-10-06 amendment' $X/ontology/docs/s7-projection-contract.md) == 1 ]] || STOP P2 bytes absent
[[ $(grep -c '2026-10-06 — P3 opened; run-4 launch sitting' goals/ciops-ontology-pipeline/research/decisions.md) == 1 ]] || STOP GD entry absent
install -d -m 0700 $E $E/logs $E/trusted $E/prose
```
## A1–A4. Call-b proofs (Ruling 8, call b): record command, exit code, last lines
- **A1** `VAL --self-test > $E/logs/a1.txt 2>&1; echo exit=$?` → exit 0, last line starts `SELF-TEST PASS (158 rule families fire:` (`V:3568`), exactly two
  `refusing:` lines (negative cases, `X/research/run4-lanes/skill-seat-effort-report.md:67-68`).
- **A2** `"${PY[@]}" -c 'import sys,yaml;print(sys.version.split()[0],yaml.__version__)'` → `3.12.x <ver>`. The orchestrator warmed the cp312 cache before launch
  (call m); on failure file a receipt and STOP: every `VAL` depends on it; never drop `--offline`.
- **A3** `command -v bwrap prlimit; /usr/bin/python3 -V` (record it; runner `run_adapter_sandbox.sh:107,143`), then
  `install -m 0600 $ONT/adapters/adapter-journal-run3.py $E/trusted/ && bash $SK/scripts/run_adapter_sandbox.sh $E/trusted/adapter-journal-run3.py "$LANE" self-check $ONT/adapters/golden/journal-run3; echo exit=$?`
  → `adapter-journal@1.1.0 self-check PASS (31 records)`.
- **A4** Static: the scan walks only `*.yaml` (`V:2088`), dispatching on `so- po- dh- ic- fa- otp- rat- rej-` (`V:2074-2076`); `ONT/lanes/` holds 53 tracked
  files (43 `.txt`, 10 `denotation/*-candidates.snapshot`), none `*.yaml`; `ratification-package.yaml` lacks `rat-`. Dynamic:
  `VAL $ONT > $E/logs/a4.txt 2>&1; grep -cE 'beep-ci-ops/lanes/|ratification-package' $E/logs/a4.txt` → `0`. Pre-rotation the run-3 trees scan as live
  (`VIOLATIONS (904)` = 1 `records exist but work/run-manifest.yaml does not` + 783 `observation_refs … matches no scanned observation` + 120 ghost evidence;
  report yours). Repeat the grep on the B-end, C and D5 scans; any hit refutes call b: STOP.
## F. Launch gate: before any manifest, seat or move (`DK:25-33`; graduation Ruling 1 addendum `DK:35-40`; `SPEC:200-201`)
```zsh
G=goals/time-to-certainty/PLAN.md; L=$ONT/corpus/run4-ledger/MANIFEST.yaml; F=$ONT/corpus/run4-fleet/MANIFEST.yaml; T=goals/time-to-certainty/ops/manifest.json
git diff --quiet HEAD -- $G $L $F $T || STOP gate sources dirty
[[ $(git show HEAD:$G | sha256sum | cut -c1-12) == e5bfe622d649 && $(git show HEAD:$G | sed -n 171p) == '  - [x] C4.1 shadow mode — done 2026-09-21'* ]] || STOP C4.1 row
[[ $(git show HEAD:$L | sha256sum | cut -c1-12) == bff7da48e0e8 && $(git show HEAD:$F | sha256sum | cut -c1-12) == 7d22f37b879c ]] || STOP pin manifests
[[ $(git show HEAD:$L | sed -n 51,53p) == $'  c4_1_checked: true\n  post_cut_pre_push_facts: 3628\n  holds: true' ]] || STOP gate block
[[ -d $ONT/corpus/run4-fleet && -d $ONT/corpus/run4-ledger ]] || STOP pin root absent; print GATE-HOLDS
```
On STOP: write no manifest, run no canary, move nothing; record the state in report sections 1 and 7 and return. On `GATE-HOLDS`, quote from `git show HEAD:`
for the report: `L:46-53` (`c4_1.sha256` = the `PLAN.md` file digest), the cut `L:60-64`, merged-preview dormant `L:1368-1375` with fleet `F:37190-37216` (3
starts, 0 since the cut), hits 125 "hypothetical would-reuse, never realized" `L:1467-1478`, C4.2 unchecked `PLAN.md:176`, status `paused`
`ops/manifest.json:6`. **F2** (the root guard matters: with the root absent the generators capture from the fleet, `etl_run4_fleet_corpus.py:2751-2761`,
`etl_run4_proof_ledger.py:2583-2586`): `beep-heavy "${PY[@]}" $ONT/corpus/etl_run4_fleet_corpus.py > $E/logs/f2-fleet.json; echo exit=$?`, then the same for
`etl_run4_proof_ledger.py` into `f2-ledger.json`. Each: one `{"verification": "PASS", …}`, exit 0.
## A5. Blinded-root canary (Ruling 8: isolated root, headless `claude -p --model claude-opus-5-5`, effort setting, no MCP, default permission mode)
```zsh
C=$HOME/.cache/beep/run4-blinded/canary; O=$HOME/.cache/beep/run4-blinded/canary-outside; install -d -m 0700 $C $O
I=CANARY-IN-$(od -An -N6 -tx1 /dev/urandom|tr -d ' \n'); U=CANARY-OUT-$(od -An -N6 -tx1 /dev/urandom|tr -d ' \n')
print -r -- $I > $C/inside.txt; print -r -- $U > $O/outside.txt; ls -A $C          # exactly: inside.txt
cd $C && env -i HOME=$HOME PATH=$HOME/.local/bin:/usr/bin:/bin TERM=dumb $HOME/.local/bin/claude -p \
  "Use the Read tool on ./inside.txt, then on $O/outside.txt. Print each file's single line verbatim, or DENIED for a refused read. Use no other tool." \
  --model claude-opus-5-5 --settings '{"effortLevel":"medium"}' --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --permission-mode acceptEdits --permission-prompts none --no-session-persistence --output-format stream-json --verbose \
  </dev/null > $E/logs/a5a.ndjson 2> $E/logs/a5a.err; echo exit=$?; grep -c -- $I $E/logs/a5a.ndjson; grep -c -- $U $E/logs/a5a.ndjson; ls -A $C
```
Call (k) fixes the shape: `acceptEdits` with prompts disabled is the "default permission mode" of Ruling 8 (CLI 2.1.291 lists no `default`; user
settings set `permissions.defaultMode: auto`, which must NOT be inherited). The prompt also asks the seat to write one file `./wrote.txt` inside the root
(the real blinded seats write their outputs), so the probe has three outcomes. Verdict DENIES when the `$I` count ≥1, `wrote.txt` exists, the `$U`
count is 0 and an error `tool_result` names the outside path; else DOES-NOT-DENY; NOT-RUN (redacted error) if `env -i` breaks auth. Probe B
(informational): the same without `--permission-mode acceptEdits --permission-prompts none`, three outcomes. Report probe A verbatim (`$HOME`, `$C`, `$O` unexpanded), verdict, counts, redacted denial text. Pick no launch shape:
on DOES-NOT-DENY the orchestrator records the Workflow-child fallback (Ruling 8). Then `rm -r $C $O`.
## B. Rotation of the run-3 trees (Rulings 3, 4; `DK:18-22`; destinations `X/research/scripts/validate_packet.py:640-645`)
315 tracked `ONT/work` files (alternative 90, denotation-batches 8, foundational 90, hypotheses 66, proposals 46, review-audit 4, sittings 11) + 18
`rat-053..070` = 333; projection already on main (#1089). Plain `mv`, never `git mv`, no staging; refuse-if-exists like the SKILL rotation
(`SK/SKILL.md:386-411`). ONE Bash call; report its start/end times (a sibling packet-validator run overlapping it reads a half-moved tree, and the
orchestrator discards that run):
```zsh
TD() { (cd "$1" && find . -type f ! -path ./README.md -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-64); }; date -u +%FT%TZ
[[ $(git ls-files $ONT/work | wc -l) -eq 315 && $(find $ONT/work -type f | wc -l) -eq 315 ]] || STOP work count
[[ $(git ls-files $ONT/governance/ratifications | wc -l) -eq 18 && $(find $ONT/governance/ratifications -type f | wc -l) -eq 18 ]] || STOP rat count
[[ -z $(git status --porcelain --ignored -- $ONT/work $ONT/governance) ]] || STOP trees dirty
[[ ! -e $ARCH/$RID3.work && ! -e $ARCH/$RID3.governance ]] || STOP shelter exists
W0=$(TD $ONT/work); R0=$(TD $ONT/governance/ratifications); print -r -- "$W0 $R0" > $E/rotation-before.txt
mkdir $ARCH/$RID3.work $ARCH/$RID3.governance || STOP mkdir
mv $ONT/work/{alternative,denotation-batches,foundational,hypotheses,proposals,review-audit,sittings} $ARCH/$RID3.work/ || STOP mv work
mv $ONT/governance/ratifications $ARCH/$RID3.governance/ && mkdir $ONT/governance/ratifications || STOP mv rats
[[ $W0 == $(TD $ARCH/$RID3.work) && $R0 == $(TD $ARCH/$RID3.governance/ratifications) ]] || STOP digest mismatch; print IDENTICAL; date -u +%FT%TZ
```
Then `VAL $ONT > $E/logs/b.txt 2>&1` → exactly one violation, `scan found NO records and no manifest …` (`V:2201-2203`). Write the new
`$ARCH/$RID3.work/README.md`: dated "relocation note (run-4 launch)"; subtrees and counts; the 18 rats in `../$RID3.governance/ratifications/`; why (v15
sibling shelter `SK/SKILL.md:396-420`; ids re-mint under a new pin `V:352-372`; `validate_packet.py` reads the shelters); both digests and the `TD` recipe (it
excludes this README); authority GD Rulings 3, 4; links in `ONT/runs/$RID3.README.md` and `ONT/work-run3/impl-report.md` stay as provenance.
## C. Provisional manifest and post-rotation scan (calls b, c)
No pin worktree exists pre-pin, so the call-b proofs run here. This transient file is NOT the Ruling 9 run manifest (written after the pin with
`repository.commit` = pin SHA): it carries `pin_waived`, D5 deletes it, H proves it gone; call (h) makes it lawful for this step alone. Shape: `ONT/runs/$RID3.manifest.yaml:1-29`;
block-style `commit:` is what the adapter reads (`adapter-journal-run3.py:43,299-305`). Write the generator once, then scan:
```zsh
cat > $E/manifest.zsh <<'EOS'
[[ -s $E/rid ]] || date -u +orun-%Y-%m-%dT%H:%M:%SZ > $E/rid; RID=$(<$E/rid); : ${ADAPTERS:?}
cat > $ONT/work/run-manifest.yaml <<EOF
run_id: "$RID"
ontology: {name: beep-ci-ops}
engine: {validator_sha256_12: "fdbcefc9fd70", contracts_sha256_12: "dcc8da4cc7f9"}
repository:
  commit: "$(git rev-parse HEAD)"
  dirty: true
  pin_waived: true
  waiver_reason: "provisional pre-pin engine-step scan; deleted before the pin commit"
scope_doc: {path: "$X/ontology/docs/scope.md", sha256_12: "9ff61c839a08"}
cq_suite: {path: "$X/ontology/docs/competency-questions.yaml", sha256_12: "e99e30cd8015", cq_count: 26}
$ADAPTERS
agents:
  denotation: {model: claude-opus-5-5, effort: medium, prompt: "prompts/denotation.md", prompt_sha256_12: "ddec132ee905"}
  foundational: {model: claude-opus-5-5, effort: medium, prompt: "prompts/ufo-analysis.md", prompt_sha256_12: "3d94feb0629c"}
  synthesis: {model: claude-opus-5-5, effort: medium, prompt: "prompts/synthesis.md", prompt_sha256_12: "117d82b29904"}
  adversary: {model: claude-opus-5-5, effort: medium, prompt: "prompts/ontoclean-adversary.md", prompt_sha256_12: "9dbfb7fc9d4c", independent_context: true}
  alternative: {model: claude-opus-5-5, effort: medium, prompt: "prompts/alternative-model.md", prompt_sha256_12: "4563e5726438", blinded: true}
first_run: false
prior_index: "runs/orun-2026-09-10T02:10:52Z.index.yaml"
prior_index_sha256_12: "b9c140ccd31b"
EOF
EOS
ADAPTERS='adapters: []'; source $E/manifest.zsh; VAL $ONT > $E/logs/c.txt 2>&1; echo exit=$?
```
Expect `VIOLATIONS (140)`: 138 noise, the ZERO-observations line, the `adapters` line; 0 lines naming `archives/`, a run-3 record or `rat-0`.
## D. `adapter-journal` v1.2.0 (Ruling 6; `SK/SKILL.md:254-289`)
Author `$E/trusted/adapter-journal-run4.py` from `git show HEAD:$ONT/adapters/adapter-journal-run3.py`; this seeding departs from `SK/SKILL.md:263` ("do not
seed from $ONT/adapters"), so disclose it in the adapter record. Edit only: the docstring `:2-7` (two pins; "See adapter-journal-run4.md");
`ADAPTER_VERSION = "1.2.0"`, `SCRIPT = f"{ONTOLOGY_REL}/adapters/adapter-journal-run4.py"`,
`GOLDEN_INPUT_REL = f"{ONTOLOGY_REL}/adapters/golden/journal-run4/input"`, `PINS = ("run4-fleet", "run4-ledger")` (`:26-32`); the selection branch `:240-255`
→ R1–R4; drop the `run3b-synthetic` clause at `:256`, `binding_classes`/`verdict_classes` (`:184-205`) and constants left unused (no synthetic pin, bindings
or verdicts: `run4-fleet/MANIFEST.yaml:42105-42111`). Everything else byte-identical (`:47-182`, `:291-353`: grammar, `parse_pairs`, `eligible`,
`first_pairs`, `events`, `record` with id = sha256 of canonical JSON `[commit, path, start, end, sorted facts, id, version]` and file `so-<sha12>.yaml`,
`declared_commit`, `self_check`, CLI).

| Rule | Selection (deterministic, disclosed, reconstructible from the records) |
| --- | --- |
| R1 vocabulary | The v1.1.0 census per (pin, kind). Kinds: fleet `admission`, `attempts`, `live`; ledger `ledgers`. |
| R2 admission | `run4-fleet/admission/canonical/journal.properties`: v1.1.0 first-v3-tag and contention nonce-chain rules unchanged (`:257-290`). |
| R3 stage | First `attempt-started` event per `stage` value, plus the first with no `stage` (absence selects, never a fact). Census: pre-push 1973, repair-loop 134, merged-preview 6. |
| R4 ledger | `run4-ledger/ledgers/<clone>/proof-ledger.properties`, spans per `# record N`: (a) first fact and first shadow per (clone, stage); (b) first shadow per (decision kind, `reason`, `observed`); (c) first fact per (`outcome`, `tier`, `inputSource`, `laneClass`). |

Gotchas: projections flatten leaves (`run4-ledger/MANIFEST.yaml:1845-1849`); `kind` repeats (record kind, then decision kind) and `schemaVersion` may, so
classify by ordered occurrence. `key` is an 11-hex prefix (P1 Ruling 3). `originKey` (`run4-fleet/MANIFEST.yaml:37217-37236`), `ownerRef*`, `corpus_*`
(`DK:1050-1061`) are capture provenance: verbatim, never selected on. Whitespace values stay unrepresentable (`V:579-583`). Budget ≈250 observations; above it
report per-rule counts with a tightening proposal, never truncate.

**Golden** `$ONT/adapters/golden/journal-run4/`: `input/run4-fleet/…` and `input/run4-ledger/ledgers/<label>/…` (both pins, `extract_tree` refuses a missing
one), `expected/so-<sha12>.yaml.expected`, `expected-metadata.yaml` (`commit: "0123456789abcdef0123456789abcdef01234567"`, as run 3), `README.md` (rule-lock
table and count, style of `golden/journal-run3/README.md`). Synthetic only: no fleet bytes, real digests, nonces or attempt ids; values are low-entropy words
(`nonce=winner` style), no UUID or long-hex shapes (`.gitleaks.toml:79-84` does not allowlist this path). Lock R1–R4, the per-pin census reset, repeated
`kind`, absent-stage selection and the v1.1.0 grammar edges (you may reuse `golden/journal-run3/input/run3-fleet/live/grammar.properties`). No ignored files
(`V:1921-1936`): `git status --porcelain --ignored=matching -- $ONT/adapters/golden/journal-run4` shows only `??`.

**Proofs** (the manifest `script` must equal the adapter's `SCRIPT`, the repo path: `SK/SKILL.md:266-267`, `V:2236-2244`):
1. `bash $SK/scripts/run_adapter_sandbox.sh $E/trusted/adapter-journal-run4.py "$LANE" self-check $ONT/adapters/golden/journal-run4; echo exit=$?` →
   `adapter-journal@1.2.0 self-check PASS (<n> records)`.
2. Pin the tuple and observe; record the census JSON line:
   ```zsh
   ADAPTERS="adapters:
   - id: adapter-journal
     version: \"1.2.0\"
     script: $ONT/adapters/adapter-journal-run4.py
     script_sha256_12: \"$(sha256sum $E/trusted/adapter-journal-run4.py | cut -c1-12)\"
     golden_fixture: $ONT/adapters/golden/journal-run4"; source $E/manifest.zsh
   bash $SK/scripts/run_adapter_sandbox.sh $E/trusted/adapter-journal-run4.py "$LANE" observe $ONT/work/observations > $E/logs/d2.txt; echo exit=$?
   ```
3. `(cd $ONT/work/observations && sha256sum * | sha256sum)`; `rm -r $ONT/work/observations`; re-run the observe line; compare. No `-rerun` tree under ONT
   (`SK/SKILL.md:425-427`).
4. `install -m 0644 $E/trusted/adapter-journal-run4.py $ONT/adapters/ && cmp $E/trusted/adapter-journal-run4.py $ONT/adapters/adapter-journal-run4.py; echo exit=$?`
5. `VAL $ONT > $E/logs/d5.txt 2>&1` → exactly the 138 noise lines. Then `rm $ONT/work/run-manifest.yaml; rm -r $ONT/work/observations`.
6. NEW adapter record (Ruling 3; never append to `adapters/README.md`) `$ONT/adapters/adapter-journal-run4.md`: rule table, census pin × kind × rule, golden
   count, dropped arms with reasons, the `SKILL.md:263` seeding disclosure, known limits.
## E. Transcriber reuse evaluation, then `po_transcriber_run4.py` (Ruling 6)
Evaluate byte-unchanged reuse first (both frozen under `extraction/**`), fit/no-fit with cites: `ONT/adapters/po_from_evidence.py` (`20385ea6e4bf`, evidence
quotes of a `--candidates` harvest, `:1-26`); `ONT/adapters/runtime_po_capture.py` (`2c4a0e4e70fd`, hard-coded `QUOTES`, `:22-45`). Only on two no-fits write
`$ONT/corpus/po_transcriber_run4.py`, hand-copying from `po_transcriber_run3.py` (never import or edit it) the CLI `--repo . --out <dir> [--dry-run]`
(`:141-145`), the HEAD-moved guard (`:147-149`, `:209-210`), `norm`, `section_spans`, `turtle_spans` and the record/id code (`:158-178`). Read bytes via
`git show HEAD:`; a quote is the verbatim span `.strip()`, ≥10 characters. Sources in order, by needle, issues reported, never paraphrased:
1. `X/research/control-interventions.yaml`: one PO per `- id: iv-` row (42 today; more after the orchestrator's W1 re-run), span `- id:` through the first
   `mechanismChanged:` line; flag a row whose `class:`/`landedAt:` falls outside it or whose span reaches `hypothesis:`.
2. `X/research/kpi-measurement-rules.md` §2 (`:31-49`), §6 (`:101-148`): heading plus each nonblank block to the next `## `.
3. `X/ontology/docs/s7-projection-contract.md` §8 (`:323-545`): heading plus first block of `## 8`, `### 8.1`, `8.2`, `8.3`; every §8.3 block (`:411-545`).
4. `apps/labs/ciops/test/fixtures/lane-plan-v1.ttl` (177 lines): first subject statement per distinct predicate and per distinct `rdf:type` object.
5. `X/ontology/docs/literal-domains.md`: each domain table row (`AssuranceTierId` `:13`) and numbered rule item (item 4 `:40-42`).
6. `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:194`: the line `export const ProofStage = LiteralKit(`.
7. `ONT/corpus/run4-ledger/MANIFEST.yaml` `gate:` (`:45-59`), `  stage_census:` (`:1353-1382`), merged-preview (`:1368-1375`); `run4-fleet/MANIFEST.yaml`
   `attempt_starts_by_stage:` (`:37190-37216`). Never `XD`, `GD`, `DK`, CQ text or ratifications.

Runs (the pin's real emission is the orchestrator's, in the pin worktree, Ruling 9):
`"${PY[@]}" $ONT/corpus/po_transcriber_run4.py --repo . --out $E/prose --dry-run > $E/logs/e-dry.txt 2>&1; echo exit=$?`, then the same without `--dry-run`
into `$E/logs/e-real.txt`; `ls $E/prose | wc -l`.

**Ruling 6's scalar-fact arm is withdrawn by call (j):** Queue G and the tier evidence travel as prose observations only (one PO per ledger row, span
`- id:` through its first `mechanismChanged:` line); `adapter-config.py` hard-codes JSON/JSONC files (`:1-16`, `:39-46`) and Ruling 6 admits one sibling
adapter. Build no second adapter and raise no question about it.
## G. Engine digests (Ruling 6): report a mismatch, never fix it (skill tree frozen, `SPEC:78-79`)
```zsh
for f in $SK/scripts/validate_artifacts.py $SK/SKILL.md $SK/prompts/{denotation,ufo-analysis,synthesis,ontoclean-adversary,alternative-model}.md $SK/scripts/run_adapter_sandbox.sh $ONT/adapters/chain_digest.py; do print -r -- "$(sha256sum $f|cut -c1-12) $f"; done
(cd .claude/skills && "${PY[@]}" -c 'import hashlib,pathlib as P;s=P.Path("_shared");f=sorted([*(s/"schemas").glob("*.yaml"),*s.glob("*.yaml"),*s.glob("*.md"),*s.glob("*.json"),*P.Path("ontology-foundational-auditor/templates").glob("*.yaml")],key=str);h=hashlib.sha256();[h.update(f"{x}\n{len(x.read_bytes())}\n".encode()+x.read_bytes()) for x in f];print(len(f),h.hexdigest()[:12])')
git status --porcelain --ignored -- $SK .claude/skills/_shared        # empty
```
Expected: validator `fdbcefc9fd70`, contracts `21 dcc8da4cc7f9`, SKILL.md `a12de4055976`, denotation `ddec132ee905`, ufo-analysis `3d94feb0629c`, synthesis
`117d82b29904`, ontoclean-adversary `9dbfb7fc9d4c`, alternative-model `4563e5726438`, runner `ecb6dcab421b`, `chain_digest.py` `617bc6828995`; add the adapter
and transcriber digests. CQ-suite and `scope.md` digests are the CQ-009 step's.
## H. Residue, preservation, cleanup
```zsh
NEW=($ONT/adapters/adapter-journal-run4.{py,md} $ARCH/$RID3.work/README.md $X/research/run4-lanes/p3-pin-engine-report.md ${(f)"$(find $ONT/adapters/golden/journal-run4 -type f)"})
[[ -e $ONT/corpus/po_transcriber_run4.py ]] && NEW+=($ONT/corpus/po_transcriber_run4.py)
PAT=(-e '/home/|-home-|/tmp/|/run/user/|(^|[^A-Za-z0-9])sk-[A-Za-z0-9]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' -e "$(id -un)" -e "$(uname -n)" -e "\b$(id -u)\b")
grep -cIE ${PAT[@]} ${NEW[@]}; git diff -U0 -- $X/research/OPPORTUNITIES.md | grep '^+[^+]' | grep -cE ${PAT[@]}
```
- Residue: every count 0. Fix a hit in your file and re-run; attribute (never edit) a hit in a sibling's OPP lines or a uid-number hit that is a count.
  Report counts only, never the match.
- Trailing whitespace: `grep -lE '[[:blank:]]$'` over `NEW` minus `golden/**/input` (the grammar fixture's spaces are deliberate) → nothing.
- Transients gone: `find $ONT/work $ONT/governance/ratifications -mindepth 1 -type f` → nothing (empty directories may stay; never delete them).
- `git status --porcelain=v1 --untracked-files=all`: 333 ` D`; `??` for the 333 moved files, the README and your owned files; ` M`
  `X/research/OPPORTUNITIES.md`. Attribute every other line to its owner (CQ-009 step, docket step, orchestrator). Finally `rm -r $E/trusted`.
## Owned files; NEVER list (critic §5 NEVER row plus other lanes' files)
Owned: `ONT/adapters/adapter-journal-run4.{py,md}`, `ONT/adapters/golden/journal-run4/**`; `ONT/corpus/po_transcriber_run4.py` (only after two E no-fits); the
333 moves into `ARCH/$RID3.{work,governance}/` and `ARCH/$RID3.work/README.md`; `X/research/run4-lanes/p3-pin-engine-report.md`; appended receipts in
`X/research/OPPORTUNITIES.md`; transients `ONT/work/run-manifest.yaml`, `ONT/work/observations/`; scratch `~/.cache/beep/run4-{engine,blinded}/`.

NEVER: `ONT/corpus/run*/**`, every corpus generator and test, `po_transcriber_run{2,3}.py`; every `ONT/runs/orun-*` file, READMEs included;
`ARCH/orun-2026-0{8-29,9-03}*`, `ARCH/$RID3.observations/`; `rat-001..070` bytes (the `mv` is the only touch); `s4/LEDGER.yaml`; `XD`,
`X/{BRIEF,MAP,README}.md`; `.claude/**`; `goals/time-to-certainty/**`; `ONT/adapters/README.md` and every existing adapter or helper
(`adapter-journal{,-run3}.py`, `adapter-config.py`, `adapter-typescript.*`, `chain_digest.py`, `po_from_evidence.py`, `runtime_po_capture.py`); goldens
`journal/`, `journal-run3/`, `config/`, `typescript/`; `ONT/lanes/**`, `ONT/ratification-package.yaml`, `ONT/work-run{2,3,4}/**` (`work-run4` is the
impl-report lane's); `X/ontology/extraction/s{5,6}/**` (only the CQ-009 step writes `s6/PREDICATES.yaml`); CQ-009 step's `X/ontology/{docs,tests}/**`,
`X/research/scripts/**`; docket step's `DK`; other lanes' `X/research/run4-lanes/p3-*-report.md`; the orchestrator's `goals/ciops-ontology-pipeline/**`,
`X/research/control-interventions.yaml`, `X/research/run4-lanes/*-brief.md`, `.gitleaks.toml`, the real run manifest, tag, worktree, remote; read-only
`apps/**`, `packages/**`, `X/research/kpi-measurement-rules.md`.
## Stop and report (`SPEC:200-203`)
Stop, write the report with what you have and return when a precondition or guard prints `STOP`, a required source is missing, this brief disagrees with the
GD entry (the GD entry wins; quote both), or the same blocker repeats after one reasonable investigation.
## Report `X/research/run4-lanes/p3-pin-engine-report.md` and Return
Report sections, in order, redacted per rule 2: 1 Result and blockers; 2 Call-b proofs (A1–A5 commands, exits, last lines, canary verdict); 3 Rotation
(counts, digests before/after, start/end times, B-end and C residuals verbatim); 4 Emission rules; 5 Adapter census (pin × kind × rule), golden count; 6
Transcriber reuse evaluation and census per source; 7 Launch gate (F quotes, F2 outputs); 8 Engine facts (G); 9 Verification and preservation (H); 10
`### Files` (created, edited, moves as `old -> new` per directory with counts).

Return: **files** (created, edited, moved with counts, deleted transients); **preconditions** (three Step-0 results); **call-b** (A1–A4 PASS/FAIL with exits
and the A4 count; A5 DENIES / DOES-NOT-DENY / NOT-RUN, probe-A command, probe-A and probe-B counts); **gate** (GATE-HOLDS or the STOP line; both F2 JSON lines
with exits); **rotation** (before = after digests, 315 and 18, B-end and C counts and non-noise lines); **adapter** (v1.2.0 sha256_12, golden count, observe
census total and per rule, idempotence digest, D5 count); **transcriber** (reuse verdicts, `po_transcriber_run4.py` sha256_12 if written, dry-run totals per
source, issues); **engine** (G table, match/mismatch); **residue** (H counts, attributed status lines); **follow-ups** with owners: your receipts; staging the golden and running
`VAL $ONT --repo .` in the pin worktree for the golden tracked/clean/blob checks (`V:1874-1990`); gitleaks over `ONT/adapters/golden/journal-run4/**`,
`ARCH/$RID3.governance/**` and `X/research/run4-lanes/p3-*` before the pin push (Ruling 17); all orchestrator.
