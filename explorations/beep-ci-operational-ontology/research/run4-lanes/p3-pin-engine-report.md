<!-- Lane report, P3 pin lane (engine step), 2026-10-06. -->
# P3 pin lane, engine step — report

Stage 1 (steps 0, A1–A4, F, F2, A5, B) is complete. Stage 2 (C, D, E, G, H) completes sections 4, 5,
6, 8, 9 and 10. Stage 3 (recorded call (u): adapter v1.3.0 before the pin) supersedes the v1.2.0
numbers of sections 4 and 5; its section is at the end. `ONT` = `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`;
`ARCH` = `…/extraction/s4/archives/beep-ci-ops`; `SK` = `.claude/skills/ontology-foundational-auditor`;
`GD` = `goals/ciops-ontology-pipeline/research/decisions.md`; `PY` = the call-(a) runtime
(`uv run --offline --python 3.12 --with pyyaml python -B`); `VAL` = `PY SK/scripts/validate_artifacts.py`.

## 1. Result and blockers (stage 1)

- No STOP. Preconditions hold at HEAD `3d4f4b860d` on `feat/ciops-p3-run4`: the S7 contract §8
  heading count is 1, the sitting entry count is 1 (heading at `GD:564`), the #1459 merge commit
  `41a7b0717e` is an ancestor (exit 0), "Recorded call (h)" count is 1.
- Call-(b) proofs A1–A4 pass. The launch gate prints `GATE-HOLDS` and both pin verifies return
  `"verification": "PASS"`, exit 0.
- Blinded-root canary: **DENIES** for the call-(k) shape (probe A) and for the same shape with
  user-level settings excluded (probe C). Without the permission flags (probe B) the session
  inherits `permissionMode: auto` and the outside read succeeds.
- Rotation done: 315 + 18 files moved by plain `mv`, tree digests equal before and after, nothing
  staged. The post-rotation scan shows exactly the one expected violation.
- Differences between the briefs and the sitting, none blocking: the common brief cites calls a–q,
  the entry carries (a)–(r); the A5 command block's prompt lacked the inside write that call (k)
  and the paragraph under it require (the probe was run with the three-outcome prompt); the A5
  verdict test "an error `tool_result` names the outside path" was met literally: the error
  `tool_result` ends by naming the outside path ("Path is outside allowed working directories"), and
  the result event's `permission_denials` entry names it too (skeptic correction: the first reading
  truncated the text at 300 characters).
- Left for the orchestrator: three empty untracked directories remain under `ONT/work/`
  (`observations`, `prose-observations`, `rejections`); they pre-date the move and were not in
  the brief's seven-subtree list.

### Stage 2 (steps 0, C, D, E, G, H)

- No STOP. Preconditions hold at HEAD `515ebe2070` (the relocation commit; it did not move during
  the stage): §8 heading count 1, sitting entry count 1 (`GD:564`), the #1459 merge commit is an
  ancestor (exit 0), "Recorded call (h)" count 1.
- `adapter-journal` v1.2.0 is written, proven through the sandbox runner and installed
  (`17b5a01b0f85`); its golden holds 39 expected records and self-checks; two observe passes are
  byte-identical; the D5 scan shows exactly the 138 expected lines.
- **Budget (call q): over.** The adapter emits 287 source observations (R1 10, R2 244, R3 4,
  R4 29) and the transcriber 95 prose observations: 382 against a budget near 250. The rules stand
  as written and nothing was truncated; the driver and a tightening proposal are in section 5.
- **Size.** Three whole-file vocabulary records carry about 2.2 MB, 0.9 MB and 0.27 MB of
  `source_excerpt`; the source-observation emission is about 5.2 MB (run 3: 1.7 MB). Section 5.
- Both reuse candidates are a no-fit, so `ONT/corpus/po_transcriber_run4.py` is written
  (`ca8644973c3a`): 95 records over the seven sources, no issue, 44 of them ledger rows.
- Engine digests all match the sitting (section 8). The provisional manifest and both observation
  trees are deleted (section 9).
- Differences between the briefs, the launch message and the tree, none blocking: (1) the engine
  brief's rotation text, its H step ("333 ` D`") and its `git show HEAD:<ONT/work path>` wording
  predate the relocation commit; this stage read no run-3 artifact, so no shelter-path
  substitution was needed. (2) The brief names 42 ledger rows; the ledger at HEAD has 44
  (`f520b302424f`), as the launch message says. (3) The brief gives the fleet census block as
  `:37190-37216`; the mapping itself ends at `:37215` and `:37216` is the sibling key
  `last_merged_preview_start:`. The transcriber takes the block plus that one line, so the span
  equals the brief's. (4) The brief's R3 "census: pre-push 1973, repair-loop 134, merged-preview 6"
  counts every `stage=` line in the attempt projections; `attempt-started` rows are 987, 67 and 3
  (with 3200 carrying no stage), as the fleet manifest records. R3 selects on started rows only.
  (5) Call (q) words R4 (b) as "the first shadow per decision class"; the brief and the adapter
  key it on (decision kind, `reason`, `observed`).

### Stage 3 (adapter v1.3.0, recorded call (u))

- No STOP. Preconditions hold at HEAD `4d9ffda2e7` (the docket addendum commit; it did not move
  during the stage): branch `feat/ciops-p3-run4`, §8 heading count 1, sitting entry count 1
  (`GD:564`), "Recorded call (h)" count 1.
- v1.2.0 is superseded before any pin. `adapter-journal` **v1.3.0** is written, proven through the
  sandbox runner and installed (`0e6d17963817`): R2 keeps every chain with a withdrawal or an
  eviction and one plain chain per (`kind`, `priority`) class; R1 emits one record per record
  stanza; R3 and R4 are the v1.2.0 bytes.
- **Budget: under.** 109 source observations (R1 24, R2 53, R3 3, R4 29) + 95 prose = **204**
  against a budget of about 250. Source emission 441,695 bytes; largest record 11,475 bytes.
- Golden: 65 expected records over 21 synthetic inputs; fifty-five single-edit variants all fail
  the self-check (the thirty of review round 1, fourteen for the two changed rules and eleven
  from review round 2, which added fixture rows and changed no adapter byte; before that round
  the golden had 58 records over 18 inputs and forty-four variants).
- Queue D: all 44 withdrawal chains and all 3 eviction chains (2 lease, 1 ticket) are emitted.
  One point for the orchestrator: the admitted resubmission that follows a withdrawal is mostly
  sampled away as a plain chain (numbers in the Stage 3 section).
- One literal exception to "no record spans a whole file": the protocol projection is a single
  three-line stanza, so its vocabulary record equals the file (64 bytes of source).
- Sections 4 and 5 and the "Review round 1" section below describe v1.2.0 and stay as the record
  of what was proven; the "Stage 3" section at the end carries the bytes that go to the pin.

## 2. Call-b proofs (stage 1)

| Step | Command | Exit | Result |
| --- | --- | --- | --- |
| A1 | `VAL --self-test` | 0 | two `refusing:` lines; last line starts `SELF-TEST PASS (158 rule families fire:` |
| A2 | `PY -c 'import sys,yaml;print(sys.version.split()[0],yaml.__version__)'` | 0 | `3.12.13 6.0.3` |
| A3 | `command -v bwrap prlimit; /usr/bin/python3 -V` | 0 | `/usr/bin/bwrap`, `/usr/bin/prlimit`, `Python 3.14.7` |
| A3 | `bash SK/scripts/run_adapter_sandbox.sh <trusted>/adapter-journal-run3.py <checkout> self-check ONT/adapters/golden/journal-run3` | 0 | `adapter-journal@1.1.0 self-check PASS (31 records)` |
| A4 static | `git ls-files ONT/lanes` | 0 | 53 files: 43 `.txt`, 10 `denotation/*-candidates.snapshot`, 0 `*.yaml`; the scan walks `root.rglob("*.yaml")` (`V:2088`) and dispatches on `so- po- dh- ic- fa- otp- rat- rej-` (`V:2074-2076`), which `ratification-package.yaml` does not match |
| A4 dynamic | `VAL ONT` (pre-rotation), then `grep -cE 'beep-ci-ops/lanes/\|ratification-package'` | 1 | grep count 0; `VIOLATIONS (904)` = 1 `records exist but work/run-manifest.yaml does not` + 783 `observation_refs … matches no scanned observation` + 120 ghost-evidence lines |

The same grep over the post-rotation scan (section 3) is 0.

### A5. Blinded-root canary

Roots: `C=$HOME/.cache/beep/run4-blinded/canary` (holding only `inside.txt`) and
`O=$HOME/.cache/beep/run4-blinded/canary-outside` (holding `outside.txt`), each file one random
canary line. CLI 2.1.291. Probe A, as run:

```zsh
cd $C && env -i HOME=$HOME PATH=$HOME/.local/bin:/usr/bin:/bin TERM=dumb $HOME/.local/bin/claude -p \
  "Use the Read tool on ./inside.txt, then on $O/outside.txt, then use the Write tool to create ./wrote.txt containing the single line canary-wrote. Print each read file's single line verbatim, or DENIED for a refused read, and WROTE or WRITE-DENIED for the write. Use no other tool." \
  --model claude-opus-5-5 --settings '{"effortLevel":"medium"}' --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --permission-mode acceptEdits --permission-prompts none --no-session-persistence --output-format stream-json --verbose \
  </dev/null > a5a.ndjson 2> a5a.err
```

`env -i` did not break authentication (exit 0, empty stderr on every probe); no variable was kept
beyond `HOME`, `PATH` and `TERM`.

| Probe | Flags added to the base command | Init `permissionMode` | Inside read | Inside write | Outside read | Inside / outside canary line count in the log |
| --- | --- | --- | --- | --- | --- | --- |
| A (call k) | `--permission-mode acceptEdits --permission-prompts none` | `acceptEdits` | succeeded | succeeded (`wrote.txt` present) | **denied** (`is_error: true`, 1 `permission_denials` entry naming the outside path) | 3 / 0 |
| B (informational) | none | `auto` (user-level default) | succeeded | succeeded | **succeeded** | 3 / 3 |
| C | probe A plus `--setting-sources project,local` | `acceptEdits` | succeeded | succeeded | **denied** (same shape as A) | 3 / 0 |
| D | not run: A and C both denied | | | | | |

Denial text (probes A and C, verbatim start): "Permission for this tool use was denied. It requires
approval, and this session has no approval surface — nobody can answer a permission prompt here — so
it was denied automatically. The action was NOT performed; do not claim it succeeded, and do not
retry it"; the same `tool_result` ends "What required approval: Claude requested permissions to read
from <the outside path>, but you haven't granted it yet. Path is outside allowed working
directories". Every probe reported 0 MCP servers.

Extra probes (informational), each under shape A and under shape C, asking for
`cat $O/outside.txt` through Bash, then Grep and Glob over `$O`: the Bash call was denied with
the same text in both, the outside canary count is 0 in both, and the session reported that it has
no Grep or Glob tool.

Verdict: **DENIES**. `--help` (2.1.291) reads `--permission-prompts none` as "nobody: anything that
would prompt is denied automatically; the permission mode still decides everything else", and
`--setting-sources` as the "Comma-separated list of setting sources to load (user, project,
local)". The lane picks no launch shape; the shape that met the test with the least inherited
state is probe C: from the isolated root, `env -i` with `HOME`, `PATH`, `TERM`, then
`claude -p … --model claude-opus-5-5 --settings '{"effortLevel":"medium"}' --strict-mcp-config
--mcp-config '{"mcpServers":{}}' --permission-mode acceptEdits --permission-prompts none
--setting-sources project,local --no-session-persistence`. Probe A (call k as written) met it for
the Read tool and `cat` only: the stage-1 skeptic showed that user-level allow rules already in force
(shell-command rules such as `Bash(node *)`) let a shell command read the outside file under shape A,
so shape A is NOT blinded and must never launch a seat. The roots were removed after the probes.

**Final seat shape (orchestrator, recorded call (s)).** The orchestrator then proved a stricter shape
in the same three-outcome canary and bound the blinded seats to it: shape C plus `--restricted
--tools "Read,Write"`. Its init event reports `permissionMode: acceptEdits`, the tool list exactly
`Read, Write`, 0 MCP servers; the inside read and the inside write succeed; the outside read is denied
by the harness ("is outside <the root>; --restricted confines the file tools to the working
directory"), with one `permission_denials` entry naming the outside path and an outside canary count
of 0; the seat has no Bash tool. The launcher asserts those three init facts before it trusts a run
and records every `permission_denials` entry as a blinding incident.

## 3. Rotation (stage 1)

One Bash call, start `2026-10-06T13:38:25Z`, end `2026-10-06T13:38:25Z`. No sibling lane was
running and no packet-validator process existed.

- Guards before the move: 315 tracked = 315 on disk under `ONT/work`; 18 = 18 under
  `ONT/governance/ratifications`; `git status --porcelain --ignored` empty for both trees; neither
  shelter existed.
- Moves (plain `mv`, no staging): `ONT/work/{alternative,denotation-batches,foundational,hypotheses,
  proposals,review-audit,sittings}` → `ARCH/orun-2026-09-10T02:10:52Z.work/` (90, 8, 90, 66, 46, 4, 11 = 315);
  `ONT/governance/ratifications` → `ARCH/orun-2026-09-10T02:10:52Z.governance/ratifications` (18); an empty
  `ONT/governance/ratifications/` was re-created.
- Tree digests (recipe `TD` in `ARCH/orun-2026-09-10T02:10:52Z.work/README.md`), before = after, printed `IDENTICAL`:
  work `4fe3bccbf24385b9077ac8d8475063371e5d420076b685732f7f395ee5c227a4`, ratifications
  `87e15cfa6d991c37dcab01a48624370e93e1d0c05f79488620442d3ec96fe7b6`.
- Per-file check: each of the 333 moved files hashes (`git hash-object`) to its `HEAD:<old path>`
  blob; 0 mismatches.
- `git status --porcelain=v1 --untracked-files=all` right after the move: 333 ` D`, 333 `??`.
- B-end scan, `VAL ONT`, exit 1, verbatim:
  `VIOLATIONS (1):` / ` - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops: scan found NO records and no manifest — an empty root must never read as a green run (wrong path?)`.
  Lines naming `beep-ci-ops/lanes/` or `ratification-package`: 0.
- Scan B (informational, call i) over the two moved trees: 26 files, the expected set: 19 login
  hits (`rat-053..070`, `work/review-audit/gate-log-final-post-scribe.txt`) and 7 12-hex `key`
  hits (`work/proposals/otp-admb-seat-grant-001.review.yaml`;
  `work/alternative/{fa-att-admission-allocation,ic-admb-seat-grant,ic-att-admission-allocation}-alt-001.yaml`;
  `work/hypotheses/dh-{att-admission-allocation,adm-seat-grant,admb-seat-grant}-001.yaml`). Not edited.
- Relocation note written: `ARCH/orun-2026-09-10T02:10:52Z.work/README.md` (call j).
- The C residual is stage 2's.

## 4. Emission rules (stage 2)

`ONT/adapters/adapter-journal-run4.py`, version 1.2.0, seeded from the committed v1.1.0 bytes
(disclosed in `ONT/adapters/adapter-journal-run4.md` as the departure from `SK/SKILL.md:263`).
The diff against `adapter-journal-run3.py` at HEAD touches only: the docstring's first paragraph;
`ADAPTER_VERSION`, `SCRIPT`, `GOLDEN_INPUT_REL`, `PINS`; the removal of `CACHE_KEYS`, `CACHE_TAGS`,
`BINDING_KEYS`, `binding_classes`, `verdict_classes` and the `run3b-synthetic` clause; the new
`ABSENT` constant and `ledger_classes`; the selection branch. The grammar, `events`, `record`, the
admission journal rules, the census line, `declared_commit`, `self_check` and the CLI are
byte-identical (review round 1 reverted the `selections` counter and the `classes` row shape).

Call (q): the rules below are the brief's R1–R4 as reviewed by the orchestrator; they stand.

| Rule | Census label | Selection |
| --- | --- | --- |
| R1 vocabulary | `vocabulary` | The v1.1.0 census per (pin, kind), files in lexicographic order: one whole-file record when a file holds a representable key not yet seen for that kind, carrying the first pairing of each such key |
| R2 admission | `nonce-chain`, `first-event-tag` | `admission/*/journal.properties`, v1.1.0 unchanged: one record per (root, nonce) chain with an eviction or an enqueue followed by an admission or a withdrawal; then the first v3 event per docket tag not already inside a chain |
| R3 stage | `first-stage` | `attempts/**/attempts.properties`: the first `attempt-started` event per `stage` value and the first with no `stage`; absence selects and is never a fact |
| R4 ledger | `ledger-clone-stage`, `ledger-shadow-class`, `ledger-fact-class` | `ledgers/<clone>/proof-ledger.properties`, one span per `# record N`: (a) first fact and first shadow per (clone, stage); (b) first shadow per (decision kind, `reason`, `observed`); (c) first fact per (`outcome`, `tier`, `inputSource`, `laneClass`); (b) and (c) span all clones |

Classes reset per (pin, kind). `kind` repeats in a flattened shadow record and is read by ordered
occurrence (record kind, then decision kind); every other key by first occurrence. A record first
under two rules is emitted once and counted under the first; the census line's `classes` lists
every class each rule opened. `ownerRef*`, `originKey` and the 11-hex `key` are carried verbatim
and never selected on. Reconstruction: a record's `qualified_name` ends `:record=N` (event
rules), `:nonce=<nonce>` (chains) or has no suffix (vocabulary).

## 5. Adapter census and golden (stage 2)

Observed under the transient provisional manifest (call h) at HEAD `515ebe2070`; census line in
the lane log `d2.txt`.

| Pin | Kind | Files | Vocabulary keys | R1 | R2 chain | R2 tag | R3 | R4 | Records |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `run4-fleet` | `admission` | 2 | 21 | 2 | 243 | 1 | | | 246 |
| `run4-fleet` | `attempts` | 465 | 63 | 6 | | | 4 | | 10 |
| `run4-fleet` | `live` | 1 | 24 | 1 | | | | | 1 |
| `run4-ledger` | `ledgers` | 9 | 31 | 1 | | | | 29 | 30 |
| total | | 477 | | 10 | 243 | 1 | 4 | 29 | 287 |

- Per rule: R1 10; R2 244 (243 chains + 1 first-event-tag); R3 4 (`pre-push`, `repair-loop`,
  `merged-preview`, absent); R4 29 distinct records = (a) 20 + (b) 6 + (c) 3, from 31 class
  openings = (a) 20 + (b) 7 + (c) 4. R4 (a): nine clones, each with a `pre-push` fact and shadow,
  one clone also with `repair-loop`. R4 (b): a hit with no `reason`; misses for `no-fact`,
  `changed-package-tripwire` and `undeclared-inputs`, each observed `passed` and `failed`. R4 (c):
  `passed` and `failed`, tier `full`, input source `turbo-task-hash` and `undeclared`, lane class
  `cli-runnable`. No record is an `unrepresentable_construct`.
- **Against the budget (about 250, Ruling 6): 287 source + 95 prose = 382.** The driver is R2,
  which the brief carried over unchanged: under journal v3 every admitted ticket is an enqueue
  followed by an admission, so the contention test is true for all of them. The 243 chains are
  196 plain enqueued-admitted-released, 44 withdrawals and 3 with an eviction. Nothing was
  truncated. Tightening proposal (a new adapter version before the pin, the orchestrator's call):
  keep a chain when it carries an eviction or a withdrawal (47), and otherwise only the first
  plain chain per (`kind`, `priority`) of its enqueue row (5 classes in the pin). That gives about
  53 R2 records, 96 source observations and 191 with the prose set.
- **Excerpt size.** `record` quotes the whole span, and R1 spans the whole file. Largest records:
  the live state projection 2,208,128 bytes, the first ledger 905,315, the admission journal
  265,321; the emission is 5,197,048 bytes in 287 files (run 3: 1,741,470 in 152). The validator
  does not read `source_excerpt`. Proposal for the same new version: R1 spans only the record
  stanzas that hold a first occurrence (one record per such stanza), which removes the three large
  records without losing a pairing.
- Golden `ONT/adapters/golden/journal-run4/`: 58 files = 17 synthetic inputs, 39 expected records,
  `expected-metadata.yaml`, `README.md`; tree digest `d4a9b28d1b0b`
  (`find . -type f | LC_ALL=C sort | xargs sha256sum | sha256sum`). Synthetic only: values are
  fixture words; the one reused file is the run-3 golden's synthetic grammar fixture, byte-copied.
  `git status --porcelain --ignored=matching` shows only `??` for the directory. The expected set
  was produced by a throwaway copy of the trusted adapter pointed at the fixture and run through
  the runner's `observe` mode (the runner has no write-golden mode), reviewed by span list against
  the rule table in the golden README, then proven by the real adapter; the copy is deleted. Review
  round 1 rewrote the fixture and regenerated the set the same way, this time over a scratch copy
  of the golden outside the checkout, and proved the locks by mutation (see "Review round 1").

| Proof | Command | Exit | Result |
| --- | --- | --- | --- |
| D1 | `bash SK/scripts/run_adapter_sandbox.sh <trusted>/adapter-journal-run4.py <checkout> self-check ONT/adapters/golden/journal-run4` | 0 | `adapter-journal@1.2.0 self-check PASS (39 records)` |
| D2 | `… observe ONT/work/observations` with the tuple pinned in the provisional manifest | 0 | `adapter-journal@1.2.0: wrote 287 SourceObservations` |
| D3 | `(cd ONT/work/observations && sha256sum * \| sha256sum)`, delete, observe again | 0 | both passes `0950b8a9d069…`; census lines equal |
| D4 | `install -m 0644 <trusted>/adapter-journal-run4.py ONT/adapters/ && cmp …` | 0 | identical; `17b5a01b0f85` |
| D5 | `VAL ONT` | 1 | `VIOLATIONS (138)`, all 138 `prior unresolved observation … has NO row in this run's index`; 0 other lines |

## 6. Transcriber reuse evaluation and census (stage 2)

| Candidate | Digest | Verdict | Why |
| --- | --- | --- | --- |
| `ONT/adapters/po_from_evidence.py` | `20385ea6e4bf` | no fit | It transcribes the `evidence` quotes of a `--candidates` harvest file (`:1-26`, `:38-41`); run 4 has no candidate harvest, its sources are selected by structure, and its `RECAPTURES` table (`:47` on) is bound to the run-1 sources |
| `ONT/adapters/runtime_po_capture.py` | `2c4a0e4e70fd` | no fit | Its fifteen quotes are hard-coded over six files (`:21-44`) and none is a run-4 span: one file, `QualityScheduler.schemas.ts` (`:24`), is shared with run-4 source 6, but its two quotes there (`:37-38`) are not the `ProofStage` line; it takes no selection input |

So `ONT/corpus/po_transcriber_run4.py` (`ca8644973c3a`) is new. Hand-copied from
`po_transcriber_run3.py` (not imported, not edited): the CLI, the HEAD-moved guard, `git`, `norm`,
`section_spans`, `turtle_spans` and the record and id code. It reads every byte through
`git show HEAD:`, locates every source by needle, needs only the standard library, and exits 1
on any issue. Dry run and real run (into the lane scratch), both exit 0, `"issues": []`; a third
run over the written set is byte-stable (`5356db3c4385` over the 95 files).

| # | Source | Rule | Records | Spans |
| --- | --- | --- | --- | --- |
| 1 | `research/control-interventions.yaml` | one per `- id: iv-` row, through its first `mechanismChanged:` line | 44 | every span is 8 lines; no row flagged (`class:` and `landedAt:` inside, `hypothesis:` outside) |
| 2 | `research/kpi-measurement-rules.md` | §2 and §6: heading plus first block, then each later block | 3 | `:31-48`, `:101-105`, `:107-148` |
| 3 | `ontology/docs/s7-projection-contract.md` | heading plus first block of §8, §8.1, §8.2, §8.3; every later §8.3 block | 13 | `:323-331`, `:333-398`, `:400-409`, `:411-437`, then nine blocks `:439-545` |
| 4 | `apps/labs/ciops/test/fixtures/lane-plan-v1.ttl` | first statement per predicate (8) and per `rdf:type` object (4) | 12 | single lines |
| 5 | `ontology/docs/literal-domains.md` | each domain table row (12) and numbered ruling (6) | 18 | `:11-22`, `:26-52` |
| 6 | `QualityScheduler.schemas.ts` | the line starting `export const ProofStage = LiteralKit(` | 1 | `:194` |
| 7 | `run4-ledger/MANIFEST.yaml` | `gate:`, `stage_census:`, its `merged-preview:` | 3 | `:45-59`, `:1353-1382`, `:1368-1375` |
| 7 | `run4-fleet/MANIFEST.yaml` | `attempt_starts_by_stage:` plus the `last_merged_preview_start:` line | 1 | `:37190-37216` |
| | total | | 95 | 0 duplicates, 0 unlocatable |

Notes for the reviewer: the KPI and §8.3 lists have no blank line between items, so a whole list
is one block (the §6 list is one 42-line record, the §8.1 bullet one 66-line record); a per-item
grain is a small rule change if the seats need it. A plain `VAL ONT` over the 287 source and 95
prose records together under the provisional manifest also shows exactly the 138 expected lines
(ids and schema; quote-in-span is the transcriber's own check and the pin worktree's `--repo` run).

## 7. Launch gate (stage 1)

`GATE-HOLDS`. Guards, all on `git show HEAD:` bytes with the four gate sources clean:
`goals/time-to-certainty/PLAN.md` `e5bfe622d649` with line 171 starting
`  - [x] C4.1 shadow mode — done 2026-09-21`; `run4-ledger/MANIFEST.yaml` `bff7da48e0e8`;
`run4-fleet/MANIFEST.yaml` `7d22f37b879c`; ledger manifest lines 51–53 equal the gate block; both
pin roots present. Quotes:

- `run4-ledger/MANIFEST.yaml:46-53`: `c4_1:` `file: goals/time-to-certainty/PLAN.md`, `line: 171`,
  `needle: C4.1 shadow mode — done 2026-09-21`,
  `sha256: e5bfe622d64919edabb647a424344fbe024a4c3a90214f9f96d3c77bf2c13f5c` (the `PLAN.md` file
  digest), `c4_1_checked: true`, `post_cut_pre_push_facts: 3628`, `holds: true`.
- Cut, `:60-64`: `instant: '2026-09-28T15:09:38Z'`, `source: committer instant of 9d52d8f587 (#1321)`,
  `predicate: recordedAt >= cut`.
- Merged preview, `:1368-1375`: facts pre 0 / post 0, shadows pre 0 / post 0,
  `reading: dormant in capture window (P1 Ruling 1)`; fleet manifest `:37190-37216`
  `attempt_starts_by_stage`: `merged-preview: all: 3, since_cut: 0` (repair-loop 67 / 5, pre-push
  987 / 110, hosted 0 / 0, absent 3200 / 0).
- Hits, `:1467-1478`: `total: 125`, `reading: hypothetical would-reuse, never realized (graduation Ruling 1)`.
- `goals/time-to-certainty/PLAN.md:176`: `  - [ ] C4.2 enforcement (attempt-to-attempt within pre-push) once \`proof-report\` reads \`ready\``;
  `goals/time-to-certainty/ops/manifest.json:6`: `"status": "paused",`.

F2, both through `beep-heavy` with the pin roots present (verify path, no capture), 13:33:17Z to
13:36:21Z:

- `beep-heavy PY ONT/corpus/etl_run4_fleet_corpus.py`, exit 0:
  `{"advisories": {"citations_checked": 70, "corpus_base_not_ancestor_of_origin_main": 0, "corpus_commit_absent": 0, "current_tree_citation_failures": 0, "origin_main_absent": 0}, "fleet": {"bytes_emitted": 26157529, "events": 11179, "files_emitted": 937, "payload_bytes": 24249663, "payload_files": 936, "status": "verified"}, "verification": "PASS"}`
- `beep-heavy PY ONT/corpus/etl_run4_proof_ledger.py`, exit 0:
  `{"advisories": {"corpus_base_not_ancestor": 0, "corpus_base_unverified": 0, "corpus_commit_absent": 0, "current_tree_citation_failures": 0}, "ledger": {"bytes_emitted": 12518204, "events": 8082, "files_emitted": 19, "payload_bytes": 12453734, "payload_files": 18, "status": "verified"}, "verification": "PASS"}`

## 8. Engine facts (stage 2)

All match the sitting; `git status --porcelain --ignored` over `SK` and `.claude/skills/_shared`
is empty. Recipe: `sha256sum <file> | cut -c1-12` on file bytes; contracts by the framed recipe of
the brief (sorted members, each `{relpath}\n{len}\n` plus bytes); CQ suite and scope from
`git show HEAD:<path>`.

| Item | sha256_12 | Expected | Match |
| --- | --- | --- | --- |
| `SK/scripts/validate_artifacts.py` | `fdbcefc9fd70` | `fdbcefc9fd70` | yes |
| framed contracts (21 files) | `dcc8da4cc7f9` | `21 dcc8da4cc7f9` | yes |
| `SK/SKILL.md` | `a12de4055976` | `a12de4055976` | yes |
| `prompts/denotation.md` | `ddec132ee905` | `ddec132ee905` | yes |
| `prompts/ufo-analysis.md` | `3d94feb0629c` | `3d94feb0629c` | yes |
| `prompts/synthesis.md` | `117d82b29904` | `117d82b29904` | yes |
| `prompts/ontoclean-adversary.md` | `9dbfb7fc9d4c` | `9dbfb7fc9d4c` | yes |
| `prompts/alternative-model.md` | `4563e5726438` | `4563e5726438` | yes |
| `SK/scripts/run_adapter_sandbox.sh` | `ecb6dcab421b` | `ecb6dcab421b` | yes |
| `ONT/adapters/chain_digest.py` | `617bc6828995` | `617bc6828995` | yes |
| `ONT/runs/orun-2026-09-10T02:10:52Z.index.yaml` | `b9c140ccd31b` | `b9c140ccd31b` | yes |
| `ONT/adapters/adapter-journal-run4.py` (new) | `17b5a01b0f85` | | trusted copy = installed copy |
| `ONT/corpus/po_transcriber_run4.py` (new) | `ca8644973c3a` | | |
| golden `journal-run4` tree (58 files) | `d4a9b28d1b0b` | | |

At HEAD `515ebe2070` the CQ suite is still `e99e30cd8015` (26 CQs) and `scope.md`
`9ff61c839a08`; both files are modified in the working tree by the CQ-009 step, so their
pin-time digests are that step's to report. The adapter digest in the run manifest must be
recomputed from the HEAD blob at the pin (`V:1879-1885`); the working-tree bytes are `17b5a01b0f85`.

## 9. Verification and preservation (stage 2)

- C scan, `VAL ONT` under the provisional manifest with `adapters: []`, exit 1,
  `VIOLATIONS (140)`: 138 `prior unresolved observation … has NO row in this run's index`, plus
  verbatim `…/work/run-manifest.yaml: missing/empty required field adapters` and
  `…/work/run-manifest.yaml: run produced ZERO observations without a substantive empty_corpus_reason`.
  Lines naming `archives/`, a run-3 record or `rat-0`: 0. Lines naming `beep-ci-ops/lanes/` or
  `ratification-package` in the C, D5 and combined scans: 0.
- Residue (brief step H pattern set) over the 45 new files other than this report: 0 hits in
  every file; over this lane's and the sibling's added `OPPORTUNITIES.md` lines: 0. Scan A of the
  common brief over the same files: no file listed. This report is scanned after writing (see the
  structured result).
- Trailing whitespace over the new files outside `golden/**/input`: none.
- Gitleaks under main's configuration (`gitleaks dir <path> --config <main's .gitleaks.toml>
  --gitleaks-ignore-path <main's .gitleaksignore> --redact`), per path: the adapter, the adapter
  record, the golden directory, the transcriber and the relocation note each `no leaks found`.
- Transients gone: `find ONT/work ONT/governance/ratifications -mindepth 1 -type f` prints
  nothing. The provisional manifest and both observation trees were deleted; the three empty
  directories under `ONT/work/` stay (call s). The trusted directory is removed at the end.
- `git status --porcelain=v1 --untracked-files=all`, by owner. This lane: `??` the adapter, the
  adapter record, 58 golden files, the transcriber, this report; ` M`
  `research/OPPORTUNITIES.md` (shared with the sibling). No ` D` line: the relocation is
  committed. Sibling CQ-009 and docket steps: ` M` `ontology/docs/{closed-world.yaml,
  competency-questions.yaml,orsd.md,pre-glossary.csv,scope.md,traceability-matrix.csv,
  use-cases.yaml}`, `ontology/extraction/s6/PREDICATES.yaml`, `ontology/tests/cq-009.sparql`,
  `ontology/tests/fixtures/seed.ttl`, `research/auditor-run4-intake.md`,
  `research/scripts/{run_cq_suite.py,validate_packet.py}`; `??`
  `ontology/tests/fixtures/must-fail/cq009-{legacy-drain,same-checkout}.ttl`,
  `ontology/tests/temporal/cq-009-pre929.sparql`, `research/run4-lanes/p3-pin-docket-report.md`.
  No line is unattributed.

### Follow-ups (stage 2), all the orchestrator's

- Rule on the budget and excerpt-size proposals of section 5 before the pin (a new adapter
  version means a new golden and new digests; this lane's bytes are v1.2.0 as briefed).
- Stage the golden and run `VAL ONT --repo .` in the pin worktree for the golden
  tracked/clean/blob checks (`V:1874-1990`) and the span and quote checks against the pin.
- Gitleaks over `ONT/adapters/golden/journal-run4/**`, `ARCH/orun-2026-09-10T02:10:52Z.governance/**`
  and `research/run4-lanes/p3-*` before the pin push (Ruling 17). Lane-plan statements and
  manifest blocks quoted by the prose set carry 64-hex digests; they land under `ONT/work/` first.
- The run README names system Python 3.14.7 as the adapter runtime (call s).
- Pre-push residue scan of the emission (Ruling 4): the common brief's scan A over the pin's
  source observations is expected to list 185 of the 287 files, every one for an `originKey=` line
  with a 12-hex value that the fleet pin carries verbatim (P1 Ruling 7; brief step D gotchas) and
  4 of them also for a branch name containing the word the scan treats as a scratch path. Those
  are pin bytes quoted in `source_excerpt`, so that count is provenance, not residue; scan A over
  the 95 prose records lists none.
- Ledger row `iv-870-weighted-admission`: its first `mechanismChanged:` line carries a trailing
  comment that continues on the next two lines, so the call-(j) span ends that prose record
  mid-comment (the other 43 rows end on a complete line). The transcriber does what call (j)
  says; the orchestrator either notes the cut in the denotation brief or rules a wider span for
  that row shape (a new transcriber digest).


## Friction receipts (stage 1)

`research/OPPORTUNITIES.md`, heading `## 2026-10-06: P3 pin lane — engine step — friction`: canary
probe shape; inherited permission mode; leftover empty directories; call range.

## Friction receipts (stage 2)

`research/OPPORTUNITIES.md`, heading `## 2026-10-06: P3 pin lane — engine step — friction (stage 2)`:
no write-golden runner mode; vocabulary and event record collision; the unchanged admission rule
over budget under journal v3; whole-file vocabulary excerpts; a line-number fixture edit.


### Files (stage 1)

- created: `ARCH/orun-2026-09-10T02:10:52Z.work/README.md`; this report.
- edited: `explorations/beep-ci-operational-ontology/research/OPPORTUNITIES.md` (one appended section).
- moved: `ONT/work/{alternative,denotation-batches,foundational,hypotheses,proposals,review-audit,sittings}/**`
  -> `ARCH/orun-2026-09-10T02:10:52Z.work/` (315); `ONT/governance/ratifications/rat-053..070.yaml` ->
  `ARCH/orun-2026-09-10T02:10:52Z.governance/ratifications/` (18).

### Files (stage 2)

- created: `ONT/adapters/adapter-journal-run4.py`; `ONT/adapters/adapter-journal-run4.md`;
  `ONT/adapters/golden/journal-run4/**` (58 files: `README.md`, `expected-metadata.yaml`, 17 under
  `input/`, 39 under `expected/`); `ONT/corpus/po_transcriber_run4.py`.
- edited: this report (stage-2 sections added); `research/OPPORTUNITIES.md` (one appended section).
- moved: none.
- deleted transients: `ONT/work/run-manifest.yaml` (provisional), `ONT/work/observations/*`
  (the empty directory stays); scratch `~/.cache/beep/run4-engine/trusted/`.

## Review round 1 (fixer, 2026-10-06)

A fresh context continued the lane under the same brief and owned files, at HEAD `515ebe2070`
(unmoved). No STOP. Every run-3 artifact this round read came from `git show HEAD:` of an
unmoved path (`adapter-journal-run3.py`, `runtime_po_capture.py`), so no shelter-path
substitution was needed.

| # | Severity | Finding | Outcome |
| --- | --- | --- | --- |
| 1 | major | The golden did not lock R4 (b) `reason`, any single component of R4 (c), or "(b) and (c) span all clones" | Fixed. `ledgers/alpha/proof-ledger.properties` now has, after the first shadow and fact, shadows that differ from the first in `reason` only and in decision kind only, and four facts that differ from the first in `outcome`, `inputSource`, `laneClass` and `tier` (absent) only; `ledgers/beta/proof-ledger.properties` has, after its first shadow and fact, a hit shadow and a failed fact whose classes `alpha` opened, which stay unselected. All nine named variants now exit 1 |
| 2 | major | One record carried both the absent-stage and the absent-`tier` lock | Fixed. Split into a fact with no `stage` and `tier=full` in an already open (c) class (selected by the absent-stage class alone) and a `pre-push` fact with no `tier` (selected by (c) alone). Each variant alone exits 1 |
| 3 | major | The v1 exclusion of R2's first-v3-tag rule was not locked | Fixed. `admission/canonical/journal.properties` opens with a v1 `admission-withdrawn` row that no chain covers and that precedes the first v3 withdrawal; the variant without the v3 guard exits 1 (one extra record) |
| 4 | major | 287 source + 95 prose = 382 against a budget near 250; no recorded call accepts it or orders a narrower version | Not fixed here, by rule. Lanes propose and never rule (Ruling 2), and call (q) makes the selection rules the orchestrator's to review, so a narrowed R2 or a stanza-scoped R1 (v1.3.0) is written only on a recorded call. This round re-measured the same emission (287 records, 5,197,048 bytes, same digest); the proposal in section 5 stands. If v1.3.0 is ordered, the fixture below carries over: only the admission and vocabulary rows and the expected set change |
| 5 | minor | Two hunks outside step D's edit list (`selections` counter and census key; `classes` row shape) | Fixed by reverting both, since the brief says "everything else byte-identical". From the `if kind != "admission"` line to the end the adapter now equals `adapter-journal-run3.py:257-353` except that one condition. No record byte depends on it: the observe digest is unchanged. New adapter digest `17b5a01b0f85` (was `09a9b0f180e1`). Class openings per rule are counted from the census line's `classes` list |
| 6 | minor | Section 6 said none of `runtime_po_capture.py`'s six files is a run-4 source | Fixed (reworded in section 6); the no-fit verdict is unchanged |
| 7 | minor | Smaller claimed locks did not discriminate (BOM, form feed, file-name and kind restrictions, first-occurrence reads) | Fixed in the fixture: new `live/bom.properties`, `live/formfeed.properties`, `live/journal.properties`, `admission/canonical/sidecar.properties`, `run4-ledger/attempts/a/b/proof-ledger.properties`, `ledgers/gamma/attempts.properties`; a repeated `_tag` and a repeated `stage` in the attempts fixture; a third `kind` and second `reason`/`observed`/`stage` lines in the ledger fixture. `grammar.properties` stays the byte copy; the README now says which rows lock the BOM and form-feed edges |
| 8 | minor | The report did not warn that scan A lists most of the source-observation emission | Fixed (follow-up added). Re-measured: 185 of 287 files, all for `originKey=` with a 12-hex value, 4 also for a branch name |
| 9 | minor | The call-(j) span ends the `iv-870-weighted-admission` prose record mid-comment | No lane change (the transcriber does what call (j) says; its digest stays `ca8644973c3a`). Recorded as an orchestrator follow-up |

Mutation proof (each variant is the trusted adapter with one `perl` substitution, in its own 0700
directory outside the checkout, run as
`bash SK/scripts/run_adapter_sandbox.sh <variant> <checkout> self-check ONT/adapters/golden/journal-run4`):
30 variants applied, 30 exit 1, 0 survive. They are listed by family in the golden README. The
form-feed variant survived the first rewrite and is now caught by `live/formfeed.properties`.

Gates re-run this round, all at HEAD `515ebe2070`:

| Gate | Command | Exit | Result |
| --- | --- | --- | --- |
| 0 | brief preconditions | 0 | branch `feat/ciops-p3-run4`; §8 heading 1; sitting entry 1 (`GD:564`); #1459 merge commit an ancestor; "Recorded call (h)" 1 |
| C | `VAL ONT` under the provisional manifest, `adapters: []` | 1 | `VIOLATIONS (140)` = 138 prior-unresolved lines + `missing/empty required field adapters` + `run produced ZERO observations without a substantive empty_corpus_reason`; 0 lines naming `archives/`, `rat-0`, `beep-ci-ops/lanes/` or `ratification-package` |
| D1 | `bash SK/scripts/run_adapter_sandbox.sh <trusted>/adapter-journal-run4.py <checkout> self-check ONT/adapters/golden/journal-run4` | 0 | `adapter-journal@1.2.0 self-check PASS (39 records)` |
| D2 | `… observe ONT/work/observations` | 0 | `adapter-journal@1.2.0: wrote 287 SourceObservations`; rules: vocabulary 10, nonce-chain 243, first-event-tag 1, first-stage 4, ledger-clone-stage 20, ledger-shadow-class 6, ledger-fact-class 3; classes opened 4 / 20 / 7 / 4 |
| D3 | tree digest, delete, observe again | 0 | both passes `0950b8a9d069…` (equal to the stage-2 digest); census lines `cmp`-equal |
| D4 | `install -m 0644 … && cmp …` | 0 | identical; `17b5a01b0f85` |
| D5 | `VAL ONT` | 1 | `VIOLATIONS (138)`, all prior-unresolved; 0 other lines |
| E dry | `PY ONT/corpus/po_transcriber_run4.py --repo . --out <scratch>/prose --dry-run` | 0 | total 95, `"issues": []`, 0 files written |
| E real | the same without `--dry-run`, twice | 0 | 95 files, `5356db3c4385` on both runs |
| E combined | `VAL ONT` over 287 source + 95 prose records under the provisional manifest | 1 | `VIOLATIONS (138)`, all prior-unresolved |
| G | engine digests | | all ten match the sitting; prior index `b9c140ccd31b`; skill-tree status empty; CQ suite `e99e30cd8015` and `scope.md` `9ff61c839a08` at HEAD; ledger `f520b302424f`, clean |

Digests after this round: adapter `17b5a01b0f85`; adapter record `ec5268dc3065`; golden tree
`d4a9b28d1b0b` (58 files: 17 inputs, 39 expected, `expected-metadata.yaml`, `README.md`; recipe
in section 5); transcriber `ca8644973c3a` (unchanged); observe set `0950b8a9d069` (unchanged);
prose set `5356db3c4385` (unchanged). Golden rule counts: vocabulary 15, first-stage 4,
nonce-chain 4, first-event-tag 1, ledger-clone-stage 6, ledger-shadow-class 5, ledger-fact-class 4.

Difference from the brief, reported: step H expects 333 ` D` lines and `??` for the moved files;
the relocation is committed at HEAD, so there is none (as the launch message says). Receipt:
`research/OPPORTUNITIES.md`, heading
`## 2026-10-06: P3 pin lane — engine step — friction (review round 1)`.

### Files (review round 1)

- edited: `ONT/adapters/adapter-journal-run4.py`; `ONT/adapters/adapter-journal-run4.md`;
  `ONT/adapters/golden/journal-run4/README.md`; under `golden/journal-run4/input/`:
  `run4-fleet/admission/canonical/journal.properties`, `run4-fleet/attempts/a/{a,c}/attempts.properties`,
  `run4-ledger/ledgers/{alpha,beta}/proof-ledger.properties`; this report;
  `research/OPPORTUNITIES.md` (one appended section).
- created under `golden/journal-run4/input/`: `run4-fleet/admission/canonical/sidecar.properties`,
  `run4-fleet/live/{bom,formfeed,journal}.properties`,
  `run4-ledger/attempts/a/b/proof-ledger.properties`, `run4-ledger/ledgers/gamma/attempts.properties`.
- replaced: `golden/journal-run4/expected/` (28 files out, 39 in).
- deleted transients: `ONT/work/run-manifest.yaml`, `ONT/work/observations/*`,
  `ONT/work/prose-observations/*` (the three empty directories stay); the scratch trusted,
  variant and mutant directories.

Residue after this round: the brief's step-H pattern set gives 0 hits in each of the 63 files (the
adapter, the adapter record, 58 golden files, the transcriber, the relocation note, this report)
and 0 in every added `OPPORTUNITIES.md` line; the common brief's scan A lists none of them; no
trailing whitespace outside `golden/**/input`; gitleaks under main's configuration prints
`no leaks found` for the adapter, the adapter record, the golden directory, the transcriber and
this report. `find ONT/work ONT/governance/ratifications -mindepth 1 -type f` prints nothing.
`git status`: this lane's lines are `??` for the adapter, the adapter record, 58 golden files,
the transcriber and this report, and ` M` `research/OPPORTUNITIES.md` (shared); every other line
is the sibling CQ-009 and docket steps' as listed in section 9; no ` D` line.

## Stage 3: v1.3.0 (call u)

A fresh context continued the lane at HEAD `4d9ffda2e7` (unmoved) under recorded call (u)
(`GD` entry "2026-10-06 — P3 pin-stage and seat-stage calls"). Only the adapter, its record, its
golden, this report and one receipt changed; the transcriber is untouched (`ca8644973c3a`).

### What changed in the adapter

Four hunks against the v1.2.0 bytes (`17b5a01b0f85` -> `0e6d17963817`): `ADAPTER_VERSION = "1.3.0"`;
one docstring paragraph; the new function `stanzas` with the vocabulary block of the selection
branch; six lines after the unchanged contention test. Everything else is byte-identical,
including R3, R4 (R4 (b) keyed on decision kind, `reason`, `observed`), the first-v3-tag rule and
its v1 exclusion, the grammar, `record`, `self_check` and the CLI.

| Rule | v1.3.0 selection |
| --- | --- |
| R1 vocabulary | One record per record stanza that holds the first occurrence, in file order within its (pin, kind), of at least one representable key; the record spans that stanza only and carries exactly the pairings of the keys first seen there. The census still resets per (pin, kind) |
| R2 admission | A chain is defined as in v1.2.0. Every chain with a withdrawal or an eviction (lease or ticket) is kept; a chain with neither is kept only when it is the first, in file order, of the (`kind`, `priority`) class of its first enqueue row (a missing key is a class value; a kept withdrawal or eviction chain opens no class). The first-v3-tag rule then runs unchanged over the events no kept chain covers |

Stanza boundary, the same for every file kind because every projection uses the same marker (it
is the boundary `events` already gives R2, R3 and R4): a line that is exactly `# record N` opens
a stanza that runs to the line before the next marker or the end of the file; lines ahead of the
first marker, or a marker-less file, are one leading stanza.

| Pin / kind | Files | A stanza is | Stanzas |
| --- | --- | --- | --- |
| `run4-fleet` / `admission` | `journal.properties`; `protocol.properties` | one journal event; the protocol document | 689; 1 |
| `run4-fleet` / `attempts` | 465 `attempts.properties` | one attempt-journal event | 8,421 |
| `run4-fleet` / `live` | `state.properties` | one live-state entry | 2,068 |
| `run4-ledger` / `ledgers` | 9 `proof-ledger.properties` | one ledger record | 8,082 |

All 477 files start with a marker on line 1, so the leading-stanza arm runs only in the golden.

Two design points the rule change forced, both disclosed in the adapter record:

- The record id covers commit, path, span and facts, never the name. A stanza whose new pairings
  are all of its pairings and which an event rule also selects is therefore one record. Vocabulary
  records use the event rules' `:record=N` name, the shared record is emitted once and counted
  under `vocabulary` (the vocabulary rule runs first in a file), and the census line's `classes`
  still lists every class opened.
- A chain stays what v1.2.0 called a chain, so a withdrawal that precedes its enqueue is still
  not one (a lock the golden keeps). In the pin all 44 nonces with a withdrawal and all 3 with an
  eviction are chains, so "every chain with a withdrawal or an eviction" loses nothing.

### Census on the pins (provisional manifest, call (h))

| Pin | Kind | Files | Vocabulary keys | R1 | R2 chain | R2 tag | R3 | R4 | Records |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `run4-fleet` | `admission` | 2 | 21 | 7 | 52 | 1 | | | 60 |
| `run4-fleet` | `attempts` | 465 | 63 | 13 | | | 3 | | 16 |
| `run4-fleet` | `live` | 1 | 24 | 1 | | | | | 1 |
| `run4-ledger` | `ledgers` | 9 | 31 | 3 | | | | 29 | 32 |
| total | | 477 | | 24 | 52 | 1 | 3 | 29 | 109 |

- Census line `rules`: vocabulary 24, nonce-chain 52, first-event-tag 1, first-stage 3,
  ledger-clone-stage 20, ledger-shadow-class 6, ledger-fact-class 3. Classes opened: plain-chain
  5, first-stage 4, clone-stage 20, shadow 7, fact 4.
- **R1: 24 records** = admission 7, attempts 13, live 1, ledgers 3. An independent replay of the
  rule over the pins (a separate script under the call-(a) runtime) finds the same 24 stanzas and
  each one among the emitted records with exactly its new pairings. One attempts stanza is also
  the first row of an R3 class (hence 3 R3 records for 4 classes). Largest R1 record per kind:
  attempts 11,475 bytes (one 398-line stanza), live 4,571, ledgers 4,234, admission 2,257; the 24
  total 72,718 bytes (v1.2.0: 10 records, three of them 0.27 to 2.2 MB).
- **R2: 53 records** = 52 chains + 1 first-event-tag. Chains: **44 withdrawn + 3 with an eviction
  + 5 plain**, one per class, as the stage-2 estimate had it: (`full-proof`, `publish`),
  (`full-proof`, `verify`), (`merged-preview`, `publish`), (`merged-preview`, `verify`),
  (`review-fix`, `verify`). 191 plain chains of an opened class are not emitted.
- R3 3 records (4 classes) and R4 29 records (31 classes), unchanged in content from v1.2.0.
- **Totals: source 109, prose 95, total 204** (budget about 250; run 3: 216). Source emission
  **441,695 bytes** in 109 files (v1.2.0: 5,197,048 in 287); **largest record 11,475 bytes**;
  longest span 398 lines; smallest record 1,159 bytes; no `unrepresentable_construct`. The prose
  set is 84,539 bytes in 95 files, so the run opens with 526,234 bytes of observations.
- One vocabulary record equals its file: the protocol projection is a single three-line stanza.
  No other record spans a whole file.

### Queue D check (counted from the emitted records; no key is quoted)

- Eviction chains emitted: **3 of 3** = 2 lease evictions (each: enqueued, admitted,
  lease-evicted) + 1 ticket eviction (enqueued, ticket-evicted). The pin has 3 nonces with an
  eviction.
- Withdrawal chains emitted: **44 of 44**, each with both ticket rows (the enqueue and the
  withdrawal), all journal v3. The pin has 44 nonces with a withdrawal; none also carries an
  eviction.
- Resubmission, read as "a later `admission-enqueued` row with the same `checkoutRoot` and
  `kind`, after the chain's withdrawal row": in the pin **34 of the 44** withdrawal chains are
  followed by one, and for all 34 a later such enqueue is admitted. In the emission:
  - for **20** of the 34 a later such enqueue is itself an emitted chain record; for 12 the
    immediately next one is, and those 12 are all withdrawal chains again (withdrawn, resubmitted,
    withdrawn);
  - for **2** of the 34 a later *admitted* resubmission is itself an emitted chain record (the
    other admitted resubmissions are plain chains of an opened class, which call (u) samples
    away);
  - for 26 of the 34 a later admitted resubmission's enqueue row is visible inside some emitted
    record's `source_excerpt` as an interleaved stanza (quoted text, never one of that record's
    facts); for 27 some later enqueue is.
- So the answer is yes: withdrawal-then-resubmission is in the records as chain facts for 20
  withdrawal chains, but the "withdrawn, resubmitted, admitted" sequence is a fact pair for only 2.
  Whether that suffices for Queue D is the orchestrator's call (open question below).

### Golden (78 files: 18 inputs, 58 expected, `expected-metadata.yaml`, `README.md`)

This subsection, the mutant proof and the digest table below record the first v1.3.0 proof.
"Review round 2" at the end of this section replaces the golden counts and digests (88 files, 65
expected records, fifty-five variants) and renumbers the journal fixture: two released rows were
inserted after record 10, so records 11 to 31 named here are records 13 to 33 now.

Every v1.2.0 lock is kept; the fixture rows of review round 1 are unchanged except that the two
v1 rows at the head of the admission journal swapped places (see the receipt: with the v1
withdrawal first, the new vocabulary rule emitted the same record the "no v3 guard" variant adds,
and the variant passed). Added, synthetic words only, no byte from the pins, no UUID or 12-hex
run in any input (0 files match):

| New fixture rows | Lock |
| --- | --- |
| journal records 14–15 (`base`, kind `full`, priority `high`) | a plain chain opens its class |
| records 16–17 (`low-priority`) | a second class opens when only `priority` differs |
| records 18–19 (`quick-kind`) | a second class opens when only `kind` differs |
| records 20–22 (`repeat`) | a second plain chain of an opened class is dropped |
| records 23–24 (`late-withdrawn`) | a withdrawal chain that is not first of its class is kept |
| records 25–27 (`late-evicted`) | an eviction chain that is not first of its class is kept |
| records 28–31 (`early-withdrawn`, `after-withdrawn`) | a kept withdrawal chain opens no class: the plain chain after it is still first |
| record 14 as a stanza | R1 emits a later stanza record carrying only the two keys it introduces |
| every stanza with no new key (most of the fixture) | R1 emits nothing |
| `live/leading.properties` (new, 5 lines) | the leading stanza ends before the first marker; the marked stanza is its own record; a repeat key emits nothing |
| all marked files | R1 never spans beyond its stanza (span-to-end and one-line-over variants fail) |

Fixture rule counts: vocabulary 29, nonce-chain 11, first-event-tag 1, first-stage 2,
ledger-clone-stage 6, ledger-shadow-class 5, ledger-fact-class 4 = 58. The expected set was
produced by a throwaway variant of the trusted adapter through the runner's `observe` mode over a
scratch copy of the golden outside the checkout, read by span list, copied in and then proven by
the real adapter; the variant is deleted. This is disclosed in the adapter record and the golden
README, as call (u) requires.

Mutant proof, run as in review round 1 (each variant one exact-once substitution of the trusted
v1.3.0 bytes, in its own 0700 directory outside the checkout, through
`bash SK/scripts/run_adapter_sandbox.sh <variant> <checkout> self-check ONT/adapters/golden/journal-run4`):
**44 variants, 44 exit 1, 0 survive.**

- All thirty of the earlier set still apply and were re-applied (m01–m30, same names).
- R2 (6): withdrawal chain sampled like a plain one; eviction chain sampled like a plain one;
  every plain chain kept; class on `kind` alone; class on `priority` alone; a kept chain opens its
  class.
- R1 (8): whole-file stanza; span to the end of the file; span one line into the next stanza;
  only the first stanza of a file emits; keys never marked seen; the record carries every pair of
  its stanza; leading stanza only in a marker-less file; census never reset.
- Forty-two fail the set comparison. Two ("keys never marked seen", "every pair of its stanza")
  stop earlier on the adapter's own `12-hex observation filename collision` check, exit 1.

### Gates (all at HEAD `4d9ffda2e7`)

| Gate | Command | Exit | Result |
| --- | --- | --- | --- |
| 0 | brief preconditions | 0 | branch, §8 heading 1, sitting entry 1 (`GD:564`), "Recorded call (h)" 1 |
| D1 | `bash SK/scripts/run_adapter_sandbox.sh <trusted>/adapter-journal-run4.py <checkout> self-check ONT/adapters/golden/journal-run4` | 0 | `adapter-journal@1.3.0 self-check PASS (58 records)` |
| D2 | `… observe ONT/work/observations` with the v1.3.0 tuple in the provisional `pin_waived` manifest | 0 | `adapter-journal@1.3.0: wrote 109 SourceObservations` |
| D3 | `(cd ONT/work/observations && sha256sum * \| sha256sum)`, delete, observe again | 0 | both passes `74671f3eb2c2…`; census lines `cmp`-equal |
| D4 | `install -m 0644 <trusted>/adapter-journal-run4.py ONT/adapters/ && cmp …` | 0 | identical; `0e6d17963817` |
| D5 | `VAL ONT` | 1 | `VIOLATIONS (138)`, all 138 `prior unresolved observation … has NO row in this run's index`; 0 other lines |
| E | `PY ONT/corpus/po_transcriber_run4.py --repo . --out <scratch>/prose` (dry, then real) | 0 | total 95, `"issues": []`; 95 files, set digest `027d05b21fad` (new HEAD, so new ids; transcriber bytes unchanged) |
| combined | the 95 prose files copied into `ONT/work/prose-observations`, `VAL ONT`, then deleted | 1 | `VIOLATIONS (138)`, all prior-unresolved; 0 other lines |
| G | engine digests | | validator `fdbcefc9fd70`, contracts `21 dcc8da4cc7f9`, SKILL.md `a12de4055976`, the five prompts, runner `ecb6dcab421b`, `chain_digest.py` `617bc6828995`, prior index `b9c140ccd31b`: all match; skill-tree status empty |

Lines naming `beep-ci-ops/lanes/`, `ratification-package`, `archives/` or `rat-0` in the D5 and
combined scans: 0. The provisional manifest carried the call-(t) digests (CQ suite
`e1ed9c0f65f5`, scope `750657e0c5b7`, both read from `git show HEAD:`); the lane scratch
generator still had the pre-CQ-009 literals and was corrected before any scan (receipt).

Digests after this stage (`sha256sum <file> | cut -c1-12` on working-tree bytes; the run manifest
must recompute the adapter digest from the pin blob, `V:1879-1885`):

| Item | sha256_12 |
| --- | --- |
| `ONT/adapters/adapter-journal-run4.py` (v1.3.0; trusted copy = installed copy) | `0e6d17963817` |
| `ONT/adapters/adapter-journal-run4.md` | `c997f6e29cdd` |
| golden `journal-run4` tree, 78 files (`find . -type f \| LC_ALL=C sort \| xargs sha256sum \| sha256sum`) | `9fcfb973bce5` |
| observe set, 109 files (`sha256sum * \| sha256sum` in the output directory) | `74671f3eb2c2` |
| `ONT/corpus/po_transcriber_run4.py` (unchanged) | `ca8644973c3a` |

### Residue and cleanup (step H)

See the structured result for the final counts; the scans were run after this section was
written. Transients deleted: `ONT/work/run-manifest.yaml`, `ONT/work/observations/*`,
`ONT/work/prose-observations/*` (the three empty directories stay), the trusted copy, the
throwaway writer and the forty-four variant directories.

### Follow-ups and open questions (stage 3), all the orchestrator's

- Accept or re-rule the totals (204 against about 250) under call (u).
- Queue D: decide whether 2 emitted "withdrawn, resubmitted, admitted" pairs (plus 20
  withdrawal chains whose resubmission is an emitted chain, mostly a further withdrawal) are
  enough, or whether R2 should also keep the first later enqueue chain of the same checkout and
  kind after each withdrawal (a v1.4.0; at most 34 more chains, which would still sit under the
  budget). The lane changed nothing beyond call (u).
- The protocol projection's vocabulary record equals its three-line file: confirm that call (u)'s
  "no record spans a whole file" is met in intent.
- The stage-2 follow-ups stand (stage the golden and run `VAL ONT --repo .` in the pin worktree;
  gitleaks before the pin push; the scan-A note on `originKey=` lines in the emission, whose count
  is now over 109 files and must be re-measured at the pin; the `iv-870-weighted-admission` span).
- Receipt: `research/OPPORTUNITIES.md`, heading
  `## 2026-10-06: P3 pin lane — engine step — friction (stage 3)`.

### Files (stage 3)

- edited: `ONT/adapters/adapter-journal-run4.py` (v1.2.0 -> v1.3.0);
  `ONT/adapters/adapter-journal-run4.md` (rewritten for v1.3.0);
  `ONT/adapters/golden/journal-run4/README.md`;
  `ONT/adapters/golden/journal-run4/input/run4-fleet/admission/canonical/journal.properties`
  (the two v1 rows swapped; records 14–31 appended); this report (intro, section 1, this
  section); `research/OPPORTUNITIES.md` (one appended section).
- created: `ONT/adapters/golden/journal-run4/input/run4-fleet/live/leading.properties`.
- replaced: `ONT/adapters/golden/journal-run4/expected/` (39 files out, 58 in).
- untouched: `ONT/corpus/po_transcriber_run4.py`; every other file.
- deleted transients: `ONT/work/run-manifest.yaml`, `ONT/work/observations/*`,
  `ONT/work/prose-observations/*`; scratch `~/.cache/beep/run4-engine/trusted/` and the stage
  scratch directory.

### Review round 2 (fixer, 2026-10-06)

A fresh context continued the lane at HEAD `4d9ffda2e7` (unmoved) under the same brief, owned
files and recorded call (u). No STOP; the budget was not exceeded, so no rule changed. **No
adapter byte changed** (`0e6d17963817`): every finding was a missing lock in the golden or a
disclosure, so the pin census, the totals (109 + 95 = 204) and the observe digest stand. Each
cited source was re-read before its edit (adapter lines 236, 253, 288 to 290 and 304 to 309; the
three fixture files; call (u) in `GD`).

| # | Severity | Finding | Outcome |
| --- | --- | --- | --- |
| 1 | major | The ticket-eviction arm of call (u)'s keep rule had no lock: a variant that keeps only lease evictions and withdrawals passed (58 records) | Fixed in the fixture. Journal records 34 to 35 (`late-ticket`): an enqueue of the opened class (`full`, `high`) followed by `admission-ticket-evicted`, no admission. The real adapter keeps the chain; the variant drops it and now exits 1 (one record missing). The mirror variant (only ticket evictions and withdrawals keep a chain) was added too and fails on `late-evicted` |
| 2 | major | "The stage classes reset per pin and kind" no longer held: the second pin's started row was also the first vocabulary stanza, so one shared record hid the R3 selection, and a variant that never resets the class sets passed | Fixed in the fixture. `run4-ledger/attempts/a/a/attempts.properties` opens with an `attempt-finished` row carrying `schemaVersion`, `_tag`, `attemptId` and `stage`; the vocabulary record is that row and the started row after it is selected by R3 alone. The variant now exits 1 (that record missing). The whole variant list was re-run, as the stage-3 receipt prescribes |
| 3 | major | The checkout-and-branch test of the first-v3-tag rule was locked only as a whole | Fixed in the fixture. After the bare released row (record 10, kept so the "no test at all" variant keeps its own row) come record 11 with a checkout and no branch and record 12 with a branch and no checkout, ahead of the selected row (now record 13). The checkout-only and branch-only variants each exit 1 (they select record 11 or 12 in place of 13) |
| 4 | minor | Four stated rule components and one inherited key had no failing variant: class read from the last enqueue row; class read from the chain's first event; a missing `kind`/`priority` as a class value; R1 eligibility against the stanza span; the journal root in the first-v3-tag key | Fixed in the fixture, one row each: `plain-absent` (records 36 to 37, a second plain chain with neither key, dropped); `twice` (38 to 40, two enqueue rows, the second of an unseen class, dropped); `odd-start` (41 to 43, an admitted row before the enqueue, kept); `live/scoped.properties` (a pairing refused in its own stanza and accepted in the next); `admission/second/journal.properties` (a second root). All five variants exit 1. One more of the same family was added unasked because the record states it: `run4-ledger/admission/canonical/journal.properties` locks the per-(pin, kind) reset of the first-v3-tag set (a v1 row first, so the vocabulary rule cannot stand in for the selected row) |
| 5 | minor | Call (u) says no record spans a whole file; the three-line protocol projection is one stanza, so its record does | No lane change, by rule: lanes do not rule (Ruling 2) and the per-stanza rule of call (u) cannot give another span for a one-stanza file. Re-measured: exactly one of the 109 records starts on line 1 and ends on its file's last line (3 of 3). Stays known limit 2 of the adapter record and an open question for the orchestrator |
| 6 | minor | Five pairs of records share path, span and `qualified_name` and differ only in facts | Fixed as a disclosure in the adapter record ("Names and shared records"): the five pairs by line span and fact counts (3 beside 10; 7 beside 16; 12 beside 13; 18 beside 27; 1 beside 13), re-measured on this round's emission, with the smaller record a strict subset of the larger in every pair. Renaming is rejected: the record id does not cover the name, so equal facts under two names trip the collision check. Follow-up for the orchestrator: say so in the denotation seat brief and keep each pair in one batch |
| 7 | minor | Stale lane scratch: the manifest generator carried the pre-CQ-009 digests and the prose directory held files minted at an earlier HEAD | Fixed in the scratch (outside the repository): the generator now reads both digests from `git show HEAD:`, and the prose directory was emptied and re-emitted at this HEAD (95 files, `027d05b21fad`). The orchestrator's follow-up stands: write the real run manifest and emit prose in the pin worktree |

Golden after this round: **88 files** = 21 inputs, 65 expected records, `expected-metadata.yaml`,
`README.md`. Fixture rule counts: vocabulary 31, nonce-chain 13, first-event-tag 3, first-stage 3,
ledger-clone-stage 6, ledger-shadow-class 5, ledger-fact-class 4 = 65. No input file matches a
UUID or a 12-hex run. The expected set was produced by the disclosed route (a throwaway variant
through the runner's `observe` mode over a scratch copy of the golden, read by span list, copied
in, proven by the real adapter; variant deleted).

Mutant proof, same method as before (one exact-once substitution of the trusted bytes per variant,
own 0700 directory outside the checkout, the runner's `self-check` against the golden):
**55 variants, 55 exit 1, 0 survive.** The forty-four earlier variants were rebuilt from their
names (the earlier stage kept no substitution list) and re-applied; eleven are new: ticket-eviction
chain sampled, lease-eviction chain sampled, class sets never reset, released on a checkout alone,
released on a branch alone, class from the last enqueue row, class from the chain's first event,
absent class never sampled, eligibility against the whole file, first-v3-tag key without the root,
first-v3-tag set never reset. Fifty-three fail the set comparison; the same two as before stop on
the adapter's `12-hex observation filename collision` check.

Gates re-run this round, all at HEAD `4d9ffda2e7`:

| Gate | Exit | Result |
| --- | --- | --- |
| 0 preconditions | 0 | branch `feat/ciops-p3-run4`; §8 heading 1; sitting entry 1; "Recorded call (h)" 1 |
| D1 self-check | 0 | `adapter-journal@1.3.0 self-check PASS (65 records)` |
| D2 observe (provisional `pin_waived` manifest, call-(t) digests) | 0 | `adapter-journal@1.3.0: wrote 109 SourceObservations`; rules: vocabulary 24, nonce-chain 52, first-event-tag 1, first-stage 3, ledger-clone-stage 20, ledger-shadow-class 6, ledger-fact-class 3 |
| D3 delete, observe again | 0 | both passes `74671f3eb2c2` (the stage-3 digest); census lines `cmp`-equal; 441,695 bytes, largest record 11,475 |
| D4 `install -m 0644` + `cmp` | 0 | identical; `0e6d17963817` |
| D5 `VAL ONT` | 1 | `VIOLATIONS (138)`, all 138 prior-unresolved lines; 0 other lines; 0 naming `beep-ci-ops/lanes/`, `ratification-package`, `archives/` or `rat-0` |
| E transcriber, dry then real into a fresh scratch directory | 0 | total 95, `"issues": []`; 95 files, `027d05b21fad`; transcriber `ca8644973c3a`, untouched |
| combined scan (109 source + 95 prose, prose copied in and deleted) | 1 | `VIOLATIONS (138)`, all prior-unresolved; 0 other lines |
| G engine digests | | all ten match the sitting; prior index `b9c140ccd31b`; contracts `21 dcc8da4cc7f9`; skill-tree status empty |

Queue D check, recounted from this round's emission (no key quoted): eviction chains 3 of 3 (2
lease, each enqueued, admitted, evicted; 1 ticket, enqueued and evicted); withdrawal chains 44 of
44, each with its enqueue row ahead of the withdrawal, none also evicted; 34 of the 44 are followed
by a later enqueue of the same checkout and kind, and for all 34 a later one is admitted; for 20 a
later such enqueue is an emitted chain (for 12 the next one, all withdrawal chains again); for 2
the admitted resubmission is an emitted chain; for 26 its enqueue row lies inside some emitted
span, and for 27 some later enqueue does. Unchanged from stage 3; the open question stands.

Digests after this round (working-tree bytes):

| Item | sha256_12 |
| --- | --- |
| `ONT/adapters/adapter-journal-run4.py` (unchanged) | `0e6d17963817` |
| `ONT/adapters/adapter-journal-run4.md` | `a4e5cef17c40` |
| golden `journal-run4` tree, 88 files (same recipe) | `84f4db4d2c1d` |
| observe set, 109 files (unchanged) | `74671f3eb2c2` |
| `ONT/corpus/po_transcriber_run4.py` (untouched) | `ca8644973c3a` |

Follow-ups added for the orchestrator: record whether a one-stanza file meets call (u) in intent
(finding 5); name the five shared-span pairs in the denotation seat brief or batch each pair
together (finding 6); delete `~/.cache/beep/run4-engine/` after the pin (finding 7). Receipt:
`research/OPPORTUNITIES.md`, heading
`## 2026-10-06: P3 pin lane — engine step — friction (review round 2)`.

### Files (review round 2)

- edited: `ONT/adapters/adapter-journal-run4.md`; `ONT/adapters/golden/journal-run4/README.md`;
  under `golden/journal-run4/input/`: `run4-fleet/admission/canonical/journal.properties`
  (records 11 and 12 inserted, later markers renumbered, records 34 to 43 appended),
  `run4-ledger/attempts/a/a/attempts.properties` (one row prepended); this report;
  `research/OPPORTUNITIES.md` (one appended section).
- created under `golden/journal-run4/input/`: `run4-fleet/admission/second/journal.properties`,
  `run4-fleet/live/scoped.properties`, `run4-ledger/admission/canonical/journal.properties`.
- replaced: `golden/journal-run4/expected/` (58 files out, 65 in).
- unchanged: `ONT/adapters/adapter-journal-run4.py` (re-installed from the trusted copy,
  `cmp`-identical); `ONT/corpus/po_transcriber_run4.py`.
- deleted transients: `ONT/work/run-manifest.yaml`, `ONT/work/observations/*`,
  `ONT/work/prose-observations/*` (the empty directories stay); the scratch trusted copy, the
  throwaway writer and the fifty-five variant directories.
