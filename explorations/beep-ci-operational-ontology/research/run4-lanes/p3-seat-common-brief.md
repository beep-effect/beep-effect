<!-- Seat-common brief as issued 2026-10-06 for goal phase P3 (W7, auditor run 4), under call (v). Installed as X/research/run4-lanes/p3-seat-common-brief.md. -->
# P3 seat-common brief — auditor run 4 (read first, then your seat brief, then your prompt)

You are one seat of auditor run 4 for `beep-ci-ops`: a fresh context with a closed input set. This brief holds the rules every seat shares; your seat brief holds your role, inputs, outputs and
self-check. "Ruling n" and calls (a)–(s) name the launch sitting and its recorded calls; calls (t) onward are the pin-stage and seat-stage calls of the same day. Each clause you need is restated in
the two briefs. If they contradict each other, your prompt or a contract, stop.

## Packet map
- Working directory: `LANE`, the run-lane checkout root your launch message names (branch `feat/ciops-p3-run4`). Read and write nothing outside it except your scratch directory `$LS`: no pin
  worktree, no sibling checkout or lane, no fleet clone, no `.beep/` tree.
- Abbreviations (repo-relative): `G` = `goals/ciops-ontology-pipeline`; `X` = `explorations/beep-ci-operational-ontology`; `ONT` = `X/ontology/extraction/s4/beep-ci-ops`; `ARCH` =
  `X/ontology/extraction/s4/archives/beep-ci-ops`; `SK` = `.claude/skills/ontology-foundational-auditor`; `V` = `SK/scripts/validate_artifacts.py` (v15); `VP` =
  `X/research/scripts/validate_packet.py`; `GD` = `G/research/decisions.md` (the live ruling log); `XD` = `X/DECISIONS.md` (the earlier log); `DK` = `X/research/auditor-run4-intake.md` (the
  docket); `OPP` = `X/research/OPPORTUNITIES.md`; `CT` = `X/ontology/docs/s7-projection-contract.md`; `SPEC` = `G/SPEC.md`.
- Cites such as `S:n` (line n of the launch-sitting entry in `GD`), `GD:n`, `XD:n`, `DK:n`, `OPP:n`, `CT:n`, `SPEC:n` and `VP:n` are provenance for the orchestrator. The ruling logs, the docket
  and the receipts ledger are outside every seat's input set: you never open them, and the operative clause is restated wherever one is cited. A `V:n` or `SK/…:n` cite names a file you open
  only if your input set lists it.
- Closed input set (call v). The launch message's `INPUT MANIFEST` lists every file you may open for this launch: this brief, your seat brief, your prompt, the contracts, the lookups, the run
  manifest, the CQ file and the records; your seat brief's input section says which of each your seat gets, and the manifest grants nothing beyond it. A needed file missing from it is a Stop,
  never a search. An exclusion covers every way of reading a file: opening, listing, grepping, a git command, or reconstructing it from memory.
- Launch variables are fixed (call v): `LANE`; `PREFIX` (your slug prefix); `BATCH` (always the observation list `ONT/work/denotation-batches/batch-<PREFIX>.txt`); `INPUT MANIFEST`; `ROUND` (r1
  to r3, for synthesis revision and the adversary only); `REPAIR`; for a consolidation pass, `OUT` and `SOURCES`. There is no other variable. `REPAIR` holds validator lines under your own
  directory, or orchestrator-written bare rows, one per line, each a tag, ids and at most one operative sentence (call (ab)): `landed <rule> <target id>: <sentence>` (a landed attack restated);
  `struck <ruling n> <target id> <failed digest, 12 hex> <rule>` (a landed attack a sitting struck); `withdraw <ruling n> <target id>: <sentence>`; `upstream <target id> <repaired dh-, ic- or fa-
  id> <rule>`; `ruling <ruling n> <target id>: <sentence>`. Never review text, a sitting text or its mirror, a line naming `ONT/work/alternative/`, or a FLAGGED line. Your seat brief says which
  row kinds can reach you. Stages run in order: all denotation, then foundational beside the blinded seat, then synthesis, then the mechanical gate, then the adversary.

## Evidence and digests
- The engine and suite digests are pinned in the run manifest, `ONT/work/run-manifest.yaml`. It exists before any seat launches; you read it and never write it. Make the digest comparisons
  your seat brief names; a mismatch is a Stop. This brief prints no digest and you quote none from memory. The CQ suite holds 26 CQs; no CQ or scope byte changes until the run closes.
- Observation records are the only evidence. Source observations come from the journal adapter v1.3.0 over the two run-4 pins (`run4-fleet`, `run4-ledger`) and are a SELECTED sample: one
  vocabulary record per record stanza that holds the first occurrence of a key (no record spans a whole file); every admission chain that carries a withdrawal or an eviction, plus the first
  plain chain per (kind, priority); first rows per class elsewhere. A record shows that a shape exists, never a count, a rate or an absence.
- Prose observations are 95 records: 44 change-event ledger rows, 3 KPI-law blocks, 13 S7 section 8 blocks, 12 lane-plan Turtle statements, 18 literal-domains rows and rulings, 1 `ProofStage`
  line, 3 `run4-ledger` manifest blocks and 1 `run4-fleet` manifest block. Your `BATCH` alone says which records are yours and how many.
- `ciops:hasCheckout` and `ciops:hasCoordinationProtocol` are `seed-only` predicates of the CQ-009 package; seed-only is not ratification. The protocol predicate carries the DECODED value (a
  persisted record without the field decodes to `legacy-origin-lock/v1`), so a missing field is never read as "no protocol".
- Quoted identifiers (call x). Prose observations quote source text. An identifier of an earlier ratification, flag or archived record inside such a quote, or inside a hypothesis description
  that quotes one, is sanctioned exposure: read it as quoted text, never as a category verdict, and never open what it names.

## Who rules (Ruling 2)
- The orchestrator rules every sitting, withdrawal, park, waiver and ratification under the operator autonomy charter. You propose, review and record. You never rule, ratify, lift a flag or
  grant a waiver, and you never word a record as if a ruling had been made.
- No operator prompt: a question that is not yours to settle goes in your Return (`openIssues`). You write no ratification or rejection file and pick no number for one, and no byte you write
  names a person as steward or carries words attributed to a person.

## Read-only and no-git laws (Ruling 4)
- Edit only the files your seat brief names. Everything else in `LANE` is read-only, and most of it is outside your input set.
- Never `add`, `mv`, `rm`, `commit`, `stash`, `checkout`, `switch`, `restore`, `reset`, `merge`, `rebase`, `fetch`, `tag`, `push` or `worktree`; never create anything remote. Leave the tree
  dirty: the orchestrator stages by name, commits, tags and pushes. You need no git command; a read-only one (`show`, `log`, `diff`, `ls-files`, `cat-file`, `rev-parse`) is lawful only where
  your seat brief asks for it and only over paths in your input set.
- Scratch lives only under `$LS`, never in the repository or `/tmp`. Never print a secret or an `OP_*` value; never `bun install`; never `mise trust`; never drop `--offline`.

## Python, VAL and where gates run (Ruling 9; call a)
A seat whose toolset has no shell runs nothing and says "no scan run" in Return. With a shell: state does not persist between calls, so paste this block at the top of EVERY call, from `LANE`.
The shell is zsh: `$VAR` does not word-split; an unmatched glob aborts the command; expand `$HOME` and never write a quoted `~` (it creates a directory named `~`); never name a variable
`path` (zsh ties it to `PATH`, and every later command fails as not found).

```sh
X=explorations/beep-ci-operational-ontology; SK=.claude/skills/ontology-foundational-auditor; ONT=$X/ontology/extraction/s4/beep-ci-ops
LS="$HOME/.cache/beep/run4-p3/<scratch name your seat brief gives>"; mkdir -p "$LS"
ENG() { env -u TMPDIR PYTHONDONTWRITEBYTECODE=1 UV_CACHE_DIR="$HOME/.cache/beep/uv-cache" "$HOME/.local/bin/uv" run --offline --python 3.12 --with pyyaml python -B "$@"; }
VAL() { ENG "$SK/scripts/validate_artifacts.py" "$@"; }
```

- `ENG` runs `V` and the one-liners your seat brief prints, nothing else: no adapter and no sandbox runner, no `ONT/adapters/chain_digest.py` (digests are handed to you; copy them verbatim),
  no packet gate, no CQ suite, no regeneration script, no bare `python3`. The single scan a seat may run is the plain scan, after writing and again after each fix:

```sh
VAL "$ONT" > "$LS/scan.txt" 2>&1; echo "exit=$?"            # exit 1 is expected until index close
grep -c 'has NO row in this run' "$LS/scan.txt"             # 138
grep -c 'dispositions.index.yaml missing' "$LS/scan.txt"    # 0 before any proposal exists, 1 after
grep -c '/work/alternative/' "$LS/scan.txt"                 # the blinded seat's lines: count only
```

- Never pass `--repo` or `--gate`. Those runs happen only in the detached pin worktree, after the orchestrator copies `ONT/work/` and `ONT/governance/ratifications/` into it; you never
  create, enter, copy into or remove that worktree. Your output goes to the lane's untracked `ONT/work/`. If `--offline` fails to resolve, stop the scan and report it. Never print `scan.txt`
  whole, and never print, open or fix a line naming `ONT/work/alternative/`: it can quote the blinded seat's values.

## Public-repo hygiene
- Every record you write is a public byte. None may carry a residue class: an absolute home path or a component-leading `-home-`; the login name; a uid (a runtime-directory path,
  `claude-<uid>`); a hostname; a session id or a scratch path; a raw pid or process start; a `key` or `originKey` value of 12 or more hex (quote a key only as the observation record carries it;
  better, cite the observation id instead of the raw value). Paths in records are repo-relative. In Return prose `~` is the sanctioned home redaction.
- Scan A, over every file you created or edited. Expected output: empty. `-l` prints paths, never matches. On a hit, fix your bytes and rerun. The one-character classes only keep the command
  from matching itself.

```sh
rg -l --no-messages -e '[/]home[/]' -e '(^|[/ "'"'"'])-home-' -e '/run/use[r]/' -e 'claude-[0-9]+' -e 'scratchpa[d]' \
  -e "$(id -un)" -e "$(uname -n)" -e '\b(pid|ownerpid|attachedpid)["'"'"']?\s*[:=]\s*["'"'"']?[0-9]+' \
  -e '\b(key|originKey)["'"'"']?\s*[:=]\s*["'"'"']?[0-9a-f]{12,}' <your files…>
```

## Expected validator noise (call c, extended by call v)
By design. Never quiet a line by inventing a record, an index row, a waiver or a review edit. Report the count of each line below.
- `prior unresolved observation <id> has NO row in this run's index`: exactly 138 per plain scan, standing until index close (`V:2347-2356`). They are no seat's to fix.
- `dispositions.index.yaml missing`: 0 lines before any proposal exists, exactly 1 once one does, until index close (`V:2358-2365`).
- A line naming a file you wrote is yours: fix it and rescan until none remains. A line naming another prefix's or another seat's file (a half-written file can read `unparseable` once;
  rescan first): report the count, fix nothing. Lines naming `ONT/work/alternative/` are counted, never printed.
- `records exist but work/run-manifest.yaml does not` (`V:2196-2200`) is a Stop: the manifest must exist before you run.
- `FLAGGED - …` and `GATE:` lines in your own scan belong to the gate and the sitting: report the count and act on none (a `GATE:` error line the orchestrator quotes in your `REPAIR` block is
  yours to act on). Any other violation is a finding: report its text and count, and fix it only if it
  names your file.

## Engine laws
- Shelter and binding. Write only the record files your seat brief names, under `ONT/work/`. Never a record-prefixed or `.review.yaml` file under `ONT/runs/` (`V:2091-2111`); never a symlink
  (`V:329-349`). `V` recomputes every observation id from record content (`V:352-372`): copy each id whole from the record's `id` field and never type, shorten or derive one (a file name
  carries 12 of its 64 hex). `target_sha256` and `chain_sha256` are handed to you as the orchestrator computed them (`V:2429-2463`): copy them, never retype one.
- Reviews are append-only with contiguous `-rN`. A FAIL is sticky: only changed proposal bytes whose `revision_log` covers the failed digest and answers each landed rule retire it (`V:2465-2493`).
- Authority. A ratification counts only under `ONT/governance/ratifications/` (`V:2159-2163`), bound to the proposal's sha256, one distinct verbatim per proposal; only the orchestrator writes
  there. Proposals carry `status: proposed`, nothing else. `PREFIX` is chosen by the orchestrator, fresh against every archived id (Ruling 13): never change, extend or guess it, and never
  reuse a slug you remember.
- Independence (Ruling 8). One fresh context per batch, per pass and per adversary round, never continued from or into another ("Same-context execution voids the pass", `SK/SKILL.md:176-177`).
  If your context already holds another seat's, batch's or round's work, a sitting text (an entry of a ruling log or its mirror under `ONT/work/sittings/`) or the docket, say so and stop. The
  bare `REPAIR` rows of "Packet map" are not a sitting text (call (ab)); a row that carries more than its shape (ruling prose, reasoning, a mirror path, review text) is. You spawn no worker
  and switch no model or provider.
- Adversary rounds (Ruling 11; calls y, aa). A FAIL blocks: it is fixed or withdrawn, and rounds continue while a FAIL remains, capped at three. A round-3 FAIL is withdrawn with named
  evidence, with one sitting-ordered exception: when a sitting strikes every landed attack of that FAIL, a synthesis `r3` pass launched with `struck` rows for every rule that FAIL landed appends
  the `revision_log` entry for the failed digest (its `addressed` listing those rules) and one open-issues line per struck rule, and changes nothing else; the adversary then reviews those bytes
  once more, at the target's own next number. The bytes must change, because `V` lets unchanged FAILed bytes be judged only FAIL again (`V:1482-1497`) and refuses a FAIL with no landed attack
  (`V:1065-1068`). Non-blocking findings from round 3 on become tracked follow-ups. A struck attack stays listed in the revision log with an open-issues line naming the striking ruling, and it is
  not re-landed without a different counterexample. A revision pass adds a new proposal only in rounds 1 and 2, and only where a landed attack, a ruling or an upstream repair requires one. Where a
  revision log misses a failed digest or a landed rule, the adversary writes no review and reports the gap. The mechanical gate runs in the pin worktree before every adversary round; it is not
  yours to run.
- Withdrawals (call y). The synthesis seat writes a withdrawal receipt (digests of the proposal and of each review) for the ids its `withdraw` rows name; the orchestrator verifies it and deletes
  the files. No seat deletes or rewrites another seat's records.
- Carried rows (Ruling 12). No seat writes an index row. A carried row is never `mapped` or `proposed` (`V:1579-1582`) and never re-parked verbatim (`V:1636-1639`). A duty that needs a CQ the
  suite lacks parks on the named missing decision "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009" (call w): you never write, edit or imagine a CQ to carry it.
- Not vocabulary. Capture provenance (`corpus_*`, `ownerRef*`, `security_resanitization`, `complete_within`, `synthetic`) is never a term, a referent or an identity criterion. Shadow hits are
  hypothetical, never realized reuse. Merged preview is "dormant in capture window", never observed-and-empty. `mechanismChanged` is ledger-field governance, never proposed vocabulary. An
  `.ndjson` file is never a config source; a config fact's object matches `^[^\s=/]+=\S+$` (`V:579-583`).
- Extra record keys the validator does not close (`referent_grain`, `evidence_refs`, `rationale`) are allowed on identity cards and analyses.

## Frozen and never-touch (Ruling 3)
Which files you may open is your seat brief's matter; this list is about writing and running.
- Frozen: `ONT/corpus/**` (pins, generators, tests); `ONT/runs/**`; `ARCH/**` (every shelter of an earlier run: observations, seat trees, governance); every ratification already scribed, live
  or sheltered; `X/ontology/extraction/s4/LEDGER.yaml`.
- Never write: `ONT/adapters/**`; this run's `ONT/work/{observations,prose-observations,denotation-batches}/**`, `ONT/work/run-manifest.yaml`, `ONT/work/dispositions.index.yaml`,
  `ONT/work/alternative/**` and `ONT/governance/**`; any `ONT/work/{sittings,review-audit}/**` file your seat brief does not name; another seat's or another prefix's records; the CQ suite, the
  scope document and every other `X/ontology/{docs,tests}/**` byte; `X/ontology/extraction/s{5,6}/**`; `.claude/skills/**`; `ONT/lanes/**` and `ONT/ratification-package.yaml`; `GD`, `XD`,
  `DK`, `OPP`, `X/{BRIEF,MAP,README}.md` and `X/research/**`; anything under `goals/`, `apps/` or `packages/`.
- Never run: a regeneration of `X/ontology/extraction/s6/POLICY.yaml`; `apply_s5_dispositions.py`; an earlier run or any S5, S6 or S7 baseline; anything that needs the network.

## Stop and report
Stop the step, do not improvise and do not rule. Write nothing further, leave what you wrote, and return the stop with both sides quoted by path:line (the two texts that disagree, or the
rule and the fact that breaks it). An ordinary failure in your own files is not a Stop: fix it. Friction is not a Stop: report it. Stop when:
- your seat brief contradicts this brief, your prompt, a contract or `V`;
- a launch variable is missing, or a required input is missing from the `INPUT MANIFEST`, unreadable or materially contradictory;
- a digest comparison your seat brief names fails, or the run manifest is missing; an excluded file's content is in your context, or your context is not fresh (an independence incident);
- a step would need a frozen or never-write byte, a CQ, seed, fixture or scope edit, an index row, a ruling, IRI-scheme design (naming a proposed IRI under the run's namespace is not scheme
  work), OWL 2 RL or rules-compilation work, a baseline re-run, new capture, a pin refresh, scheduler or lock integration, or a residue byte;
- the same blocker repeats after one reasonable investigation.

## Return
Your final message is a structured result; you write no report file and no friction receipt. Your seat brief adds its own fields to these:
- `seat`, `prefix`, `batch`, and `pass` or `round` as launched; the fresh-context statement. `files`: every path created or edited, with the operation. `counts`: as your seat brief lists them.
- `selfCheck`: the exact scan command and exit code, the count of each expected-noise line, lines naming your files (0 at return), the count of lines owned by others, or "no scan run"; each
  digest comparison; the scan A result (paths, expected none), or "checked by hand".
- `openIssues`: needed evidence, questions and findings for the orchestrator. `stops`: each with both cites, or `[]`.
- `friction`: whatever was slower, harder or riskier than it should have been, each as work, evidence (command, minimal error text, file) and prevention. Redact it: `~` for home; no secret,
  session or machine id, hostname, uid, pid or raw ledger or journal row. The orchestrator files it.
