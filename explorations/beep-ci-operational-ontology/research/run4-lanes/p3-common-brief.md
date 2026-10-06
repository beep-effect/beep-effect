<!-- Lane brief as issued 2026-10-06 for goal phase P3 (W7, auditor run 4). -->
# P3 common brief — auditor run 4 (read first, then your lane brief)

Every P3 lane and seat reads this first. The launch sitting is authoritative: where your lane brief differs from it, stop and report.

## Packet map and preconditions

- Checkout: the one your lane brief names, branch `feat/ciops-p3-run4` off the #1459 merge commit (Ruling 1, S:24-29: the pin tree must carry
  the rat-049 lane-plan line, CT §8 and `lane-plan-v1.ttl`). The survey read `~/YeeBois/projects/beep-effect8-s5` (`feat/ciops-p2-projection`,
  HEAD `37f7937f1f`); every count and digest is re-verified at the pin (Ruling 10). Never touch `~/YeeBois/projects/beep-effect5`; never read a
  fleet clone, a sibling lane or any `.beep/` tree.
- Abbreviations (repo-relative): `G` = `goals/ciops-ontology-pipeline`; `X` = `explorations/beep-ci-operational-ontology`; `ONT` =
  `X/ontology/extraction/s4/beep-ci-ops`; `ARCH` = `X/ontology/extraction/s4/archives/beep-ci-ops`; `GD` = `G/research/decisions.md`, the only live
  ruling log (grad R7, `XD:1473-1475`); `XD` = `X/DECISIONS.md`, provenance only ("grad Rn" = its graduation Ruling n, `XD:1306-1604`); `DK` =
  `X/research/auditor-run4-intake.md`; `SK` = `.claude/skills/ontology-foundational-auditor`; `V` = `SK/scripts/validate_artifacts.py` (v15); `VP` =
  `X/research/scripts/validate_packet.py`; `OPP` = `X/research/OPPORTUNITIES.md`; `CT` = `X/ontology/docs/s7-projection-contract.md`; `SPEC` = `G/SPEC.md`.
- `S:n` = line n of the `GD` entry headed "2026-10-06 — P3 opened; run-4 launch sitting" (heading = S:1; Rulings 1–17, calls a–q), i.e. `GD`
  line `S0+n-1`. This brief restates every operative clause it relies on. Source order (`SPEC:47-62`): grad rulings and `GD` > `AGENTS.md`/skills
  > docs contracts > SPEC > PLAN > GOAL > research/docket. No survey note is a source.
- Preconditions, from the checkout root after pasting the "Python" block; any failure is a Stop:

```sh
S0=$(grep -n 'P3 opened; run-4 launch sitting' "$GD" | cut -d: -f1); echo "S0=${S0:-MISSING}"   # MISSING: sitting not filed
M=${M1459:-$(git log -F --grep='#1459' --format=%H -1 origin/main)}; git merge-base --is-ancestor "$M" HEAD; echo "base=$?"   # non-0: Ruling 1
grep -c 'Recorded call (h)' "$GD"   # 0: the location call (below) is not filed
```

## Run facts (lanes never edit these)

- Prior chain (`DK:71-79`): `first_run: false`, `prior_index: runs/orun-2026-09-10T02:10:52Z.index.yaml`, `prior_index_sha256_12: b9c140ccd31b`;
  284 rows = 37 proposed / 77 mapped / 138 unresolved (84 live + 54 carried) / 32 irrelevant (S:6-8; `DK:82-86`).
- Engine at the P2 head (S:8-13): `V` `fdbcefc9fd70`; contracts `21 dcc8da4cc7f9`; SKILL.md `a12de4055976`; prompts denotation `ddec132ee905`,
  ufo-analysis `3d94feb0629c`, synthesis `117d82b29904`, ontoclean-adversary `9dbfb7fc9d4c`, alternative-model `4563e5726438`; runner
  `ecb6dcab421b`; `chain_digest.py` `617bc6828995`; CQ suite `e99e30cd8015` (26 CQs); `scope.md` `9ff61c839a08`. CQ and scope digests change
  in the Ruling 5 CQ-009 commit before the pin (S:67-86); cite only pin-time values. Recipes (`PIN` = pin SHA; `HEAD` before the pin):

```sh
sha256sum "$SK/scripts/validate_artifacts.py" "$SK/SKILL.md" "$SK"/prompts/{denotation,ufo-analysis,synthesis,ontoclean-adversary,alternative-model}.md \
  "$SK/scripts/run_adapter_sandbox.sh" "$ONT/adapters/chain_digest.py" "$ONT/runs/orun-2026-09-10T02:10:52Z.index.yaml" | awk '{print substr($1,1,12), $2}'   # plain file bytes: V:1144, :1152, :2334
( cd .claude/skills && ENG -c 'import hashlib,pathlib as P;s=P.Path("_shared");f=sorted([*(s/"schemas").glob("*.yaml"),*s.glob("*.yaml"),*s.glob("*.md"),*s.glob("*.json"),*P.Path("ontology-foundational-auditor/templates").glob("*.yaml")],key=str);h=hashlib.sha256();[h.update(f"{x}\n{len(x.read_bytes())}\n".encode()+x.read_bytes()) for x in f];print(len(f),h.hexdigest()[:12])' )   # framed contracts, V:1152-1165: sorted members, each "{relpath}\n{len}\n" + bytes
for p in "$X/ontology/docs/competency-questions.yaml" "$X/ontology/docs/scope.md"; do echo "$(git show "$PIN:$p" | sha256sum | cut -c1-12) $p"; done   # HEAD BLOB at the pin, never working-tree bytes: V:1861-1872
grep -c -- '- id: CQ-' "$X/ontology/docs/competency-questions.yaml"   # 26 before the CQ-009 commit
git show "$PIN:<adapter script>" | sha256sum | cut -c1-12   # adapter scripts also hash the HEAD BLOB: V:1879-1885
```

- The run manifest is `ONT/work/run-manifest.yaml`, written by the orchestrator AFTER the pin, `repository.commit` = the pin SHA, block style
  (Ruling 9, S:123-128; `V:1783-1786`). `ONT/runs/<RID>.manifest.yaml` exists only at rotation (`SK/SKILL.md:387-395`).
- The gate holds from pinned bytes (S:13-16): C4.1 checked at `goals/time-to-certainty/PLAN.md:171`; `ONT/corpus/run4-ledger/MANIFEST.yaml`
  `post_cut_pre_push_facts: 3628`, `holds: true`; merged preview "dormant in capture window"; C4.2 unchecked. No lane re-reads the fleet
  (`GD:168-172`, `:255-256`).

## Who rules (Ruling 2)

- The orchestrator rules every sitting, withdrawal, park, waiver and ratification under the autonomy charter (S:31-43; `GD:273-281`;
  `AGENTS.md:170` "Escalate only money"). Lanes and seats propose, review and record; they never rule, ratify, lift a flag or grant a waiver
  (`DK:1065-1066`). No lane prompts the operator; a non-money question is a blocker for the orchestrator.
- Run-4 rats carry `steward.id: orchestrator-under-autonomy-charter`, a `steward.name` naming the session and the charter date, and a
  `verbatim_decision` in the orchestrator's own words (S:35-39); no byte names the operator as steward or carries words he did not say
  (`SK/SKILL.md:460-464`); never copy the run-3 rats' login-valued `steward.id` (`ONT/governance/ratifications/rat-053.yaml`). The orchestrator
  scribes `rat-071+` / `rej-001+`, the maximum over the live dir and every shelter (Ruling 13, S:155-158); no lane picks a number.

## Read-only and no-git laws (Ruling 4)

- Edit only the files your lane brief names. Read-only git (`show`, `log`, `diff`, `ls-files`, `cat-file`, `rev-parse`, `merge-base`) is fine.
  Never `add`, `mv`, `rm`, `commit`, `stash`, `checkout`, `switch`, `restore`, `reset`, `merge`, `rebase`, `fetch`, `tag`, `push` or `worktree`;
  never create anything remote (S:58-65 "No lane stages, commits, tags or pushes"; `DK:1072`; `XD:1501-1502`). Leave the tree dirty: the
  orchestrator stages by name, commits, tags, pushes and owns the pin worktree. The run-3 relocation is a plain `mv` plus a byte-identity check
  (S:59-60). Scratch only under `$LS`, never the repo or `/tmp` (`AGENTS.md:305-306`); never print secrets or `OP_*` values; never `bun install`.

## Python, VAL and where gates run (Ruling 9; calls a, b, h)

Shell state does not persist between Bash calls: paste this block at the top of EVERY call. zsh; `$VAR` does not word-split; expand `$HOME`,
never a quoted `~` (`OPP:785-787`); bun only as `zsh -ic '...'`; never `mise trust`.

```sh
X=explorations/beep-ci-operational-ontology; SK=.claude/skills/ontology-foundational-auditor
ONT=$X/ontology/extraction/s4/beep-ci-ops; GD=goals/ciops-ontology-pipeline/research/decisions.md
LS="$HOME/.cache/beep/run4-p3/<lane>"; mkdir -p "$LS"
ENG() { env -u TMPDIR PYTHONDONTWRITEBYTECODE=1 UV_CACHE_DIR="$HOME/.cache/beep/uv-cache" "$HOME/.local/bin/uv" run --offline --python 3.12 --with pyyaml python -B "$@"; }
VAL() { ENG "$SK/scripts/validate_artifacts.py" "$@"; }
PKV() { env -u TMPDIR PYTHONDONTWRITEBYTECODE=1 UV_CACHE_DIR="$HOME/.cache/beep/uv-cache" "$HOME/.local/bin/uv" run --offline --python 3.12 --with pyyaml --with rdflib "$@"; }
```

- `ENG` runs every Python script (call a, S:189-191): `V`, `ONT/adapters/chain_digest.py`, the run-4 transcriber, `build_predicates.py`,
  `regen_cq_artifacts.py`, digest one-liners. The one exception is the adapter: it runs ONLY as the trusted 0700 copy outside the repo through
  `SK/scripts/run_adapter_sandbox.sh`, which runs system `/usr/bin/python3` inside bwrap (`run_adapter_sandbox.sh:107`, `:143`); adapters are
  stdlib-only and repository copies are never executed (`SK/SKILL.md:254-289`). Never run an adapter via `ENG` or a bare `python3`.
- `VAL --self-test` (flag as argv[0], `V:3604-3607`) reads no repo state; expect two `refusing:` lines, then
  `SELF-TEST PASS (158 rule families fire: …)`, exit 0 (`X/research/run4-lanes/skill-seat-effort-report.md:47-70`).
- `VAL "$ONT" --repo .` and `VAL "$ONT" --gate --repo .` run ONLY at the root of the detached pin worktree (sibling `-worktrees` root; path in
  your lane brief) after the orchestrator rsyncs `ONT/work/` and `ONT/governance/ratifications/` in (S:123-128). Lanes never create, rsync, reset
  or remove it. Seat output goes to the run lane's untracked `ONT/work/` (S:123-125).
- Call (h) (precondition): no pin worktree exists before the pin, so the call-(b) proofs (S:191-193: self-test, offline cache, sandbox runner,
  "v15 ignores `ONT/lanes/` and `ONT/ratification-package.yaml`", blinded-root denial), the pre-pin CQ-009 packet gates and the final-tree packet
  gates (`SPEC:155-156` "on the final tree") run in the lane checkout, with call (a)'s runtime.
- Packet gates (`SPEC:181-184`), from `X`: `PKV python -B research/scripts/validate_packet.py` (then `--s5`);
  `PKV --with pyshacl python -B research/scripts/validate_packet.py --s6`; `PKV --with pyoxigraph python -B research/scripts/run_cq_suite.py`.
  The orchestrator warmed the CPython 3.12 cache (PyYAML, rdflib, pyshacl, pyoxigraph, owlrl) and verified every offline with-set before launch
  (call m). If `--offline` still fails to resolve, stop that gate and report it; never drop `--offline` (call a).

## Heavy work

Prefix heavy commands with `beep-heavy` (`~/.local/bin/beep-heavy:2-9`; `OPP:842-852`): package-verify, multi-file vitest, docgen, builds,
corpus replays (pin verify reruns, `verify_run3_citations.py`). It execs argv through `systemd-run` (`beep-heavy:25`, `:43-45`), so shell
functions do not exist there; spell the command out (bun: `zsh -ic 'cd <checkout> && beep-heavy bun run beep quality package-verify @beep/ciops'`).
On `beep-heavy: all 3 slots busy, waiting`, wait; never bypass the queue or kill a job.

```sh
beep-heavy env -u TMPDIR PYTHONDONTWRITEBYTECODE=1 UV_CACHE_DIR="$HOME/.cache/beep/uv-cache" "$HOME/.local/bin/uv" run --offline --python 3.12 --with pyyaml python -B <script> <args>
```

## Public-repo hygiene (SPEC residue stop; run-3 Rulings 11, 22; Ruling 17)

- No new byte carries a residue class (`SPEC:139`, `:198-199`): host paths (`/home/…`, component-leading `-home-`, `GD:333-335`; bare `~/`
  inside captured or generated records: observations, adapter/transcriber output, goldens, manifests), the login name, uids (`/run/user/<n>`,
  `claude-<uid>`), hostnames, session ids or scratch paths, raw pids or process starts, a 12+-hex `key`/`originKey` (quote keys only as the pins
  carry them, 11-hex prefixes, `GD:289-306`). In prose reports and receipts `~` is the sanctioned home redaction (`AGENTS.md:368-369`).
- Scan A, every file you created or edited (expected empty; fix your bytes; `-l` prints paths, never matches):

```sh
rg -l --no-messages -e '/home/' -e '(^|[/ "'"'"'])-home-' -e '/run/user/' -e 'claude-[0-9]+' -e 'scratchpad' \
  -e "$(id -un)" -e "$(uname -n)" -e '\b(pid|ownerpid|attachedpid)["'"'"']?\s*[:=]\s*["'"'"']?[0-9]+' \
  -e '\b(key|originKey)["'"'"']?\s*[:=]\s*["'"'"']?[0-9a-f]{12,}' <your files…>
```

- Scan B, engine lane only: the same command over the moved trees `ARCH/orun-2026-09-10T02:10:52Z.{work,governance}/`. These are frozen run-3
  bytes: NEVER edit them (Ruling 3, S:45-50; byte-identity, S:59-60). Expect exactly 26 pre-existing files: 19 login hits (18 `rat-053..070`
  `steward.id`; `work/review-audit/gate-log-final-post-scribe.txt`) and 7 `key` hits (`work/proposals/otp-admb-seat-grant-001.review.yaml`;
  `work/alternative/{fa-att-admission-allocation,ic-admb-seat-grant,ic-att-admission-allocation}-alt-001.yaml`;
  `work/hypotheses/dh-{att-admission-allocation,adm-seat-grant,admb-seat-grant}-001.yaml`). Call (i) rules it: these bytes are already public on `main` and move
  byte-identically, so they are provenance, not a placement (`SPEC:198-199` binds new bytes); scan B is informational, report count and paths, and
  any other count is a Stop.
- Gitleaks under MAIN's config, as the hosted check does (S:181-183; `.github/workflows/check.yml:1011-1031`), from the checkout root with
  repo-relative paths so the allowlist regexes at `.gitleaks.toml:79-84` match:

```sh
git show origin/main:.gitleaks.toml > "$LS/gitleaks-main.toml"; git show origin/main:.gitleaksignore > "$LS/gitleaksignore-main"
for p in <your files…>; do gitleaks dir "$p" --config "$LS/gitleaks-main.toml" --gitleaks-ignore-path "$LS/gitleaksignore-main" --redact --no-banner; done
```

  Expect `no leaks found`; main allows only `ONT/work/{hypotheses,foundational,alternative,proposals,sittings,review-audit,denotation-batches}/`,
  `ONT/work-run3/impl-report.md`, `ONT/runs/orun-*.{index,manifest}.yaml`, `ARCH/orun-*.{observations,work}/`. A hit blocks for the orchestrator:
  never add an allowlist entry or reword a digest-bound record; a main-first allowlist PR opens only on a hit, never on the run PR (`GD:188-190`, `:296`).

## Friction receipts (call d)

The moment friction happens (slower, harder or riskier than it should be), append a receipt to `OPP` (S:195-196; `AGENTS.md:364-370`;
`G/PLAN.md:155-156`); never save it for the report. Shape as at `OPP:842-866`: heading `## <date>: P3 <lane> — <topic>` (or a bullet under that
day's P3 heading); Work, Evidence (command, minimal error text, file), Prevention. Redact: `~` for home; no secrets, session or machine ids,
hostnames, uids, pids, raw ledger/journal rows. Append-only.

## Expected validator noise (call c)

By design; never "fixed" by inventing records, index rows, waivers or review edits (S:193-195). Survey counts at `37f7937f1f`; re-measure with
`VAL` and report yours, and the count of each line below. Any other violation is a finding, cited by its `V:` line.

- Call-(b) scan before the relocation (`VAL "$ONT"`, lane checkout): exit 1, `VIOLATIONS (904)` = 1 `records exist but work/run-manifest.yaml
  does not` + 783 `observation_refs '…' matches no scanned observation` (run-3 `work/hypotheses/`, `V:1213`) + 120 `evidence … matches no scanned
  observation — ghost evidence…` (run-3 `.review.yaml`, `V:2276-2277`): v15 scanning the run-3 trees as live (Ruling 3, S:54-55). Not findings.
- Call-(b) scan after the relocation, before any run-4 record: exactly one violation, `scan found NO records and no manifest — an empty root must
  never read as a green run (wrong path?)` (`V:2201-2203`). A line naming `ONT/lanes/` or `ONT/ratification-package.yaml` refutes call (b): Stop.
- `records exist but work/run-manifest.yaml does not` (`V:2196-2200`): only while a record or an index exists and no manifest.
  `run produced ZERO observations without a substantive empty_corpus_reason`: manifest present, no observation and no index (`V:2370-2373`).
- `prior unresolved observation <id> has NO row in this run's index`: exactly 138 per scan once the manifest sets `prior_index`, until index
  close (run 3 saw 68) (`V:2347-2356`). `dispositions.index.yaml missing`: on `--gate`, or once proposals exist, before index close (`V:2360-2365`).
- `--gate` with an index prints `GATE: unresolved fraction U/N = P% (carried rows excluded from arithmetic)` (`V:2597-2599`); above 50% it errors
  `GATE: P% of non-irrelevant observations are unresolved — a parked run` (`V:2604-2606`), expected until a sitting rules (Ruling 16, S:177-179:
  a waiver is only a sitting ruling, never pre-declared). `FLAGGED - …` lines (`V:3621`; INDETERMINATE or `explicitly_deferred` submits,
  DISPUTED rivals, carried re-park notes: `V:2495`, `:2502`, `:2533`, `:2582`, `:1587-1591`) and `GATE: RATIFICATION SUMMARY` are for the sitting.
- `VP --s5` red on each digest-fresh run-4 accept until the Ruling 14 projection lands (`VP:741-752`; S:160-166).

## Frozen and never-touch (Ruling 3; other lanes' files)

- Frozen (S:45-50; `SPEC:27-28`, `:188-190`; `DK:1069-1070`): `ONT/corpus/run*/**` and the corpus generators and tests;
  `ONT/runs/orun-{2026-08-29,2026-09-03,2026-09-10}*`; `ARCH/orun-2026-0{8-29,9-03}*/**`; `ARCH/orun-2026-09-10T02:10:52Z.observations/**`; every
  `rat-001..070` byte; `X/ontology/extraction/s4/LEDGER.yaml`.
- Never touch: every existing byte under `ONT/adapters/` and `ONT/corpus/` (reuse means invoking unmodified, else a new file; S:50-53, S:95-97);
  `XD`, `X/{BRIEF,MAP,README}.md` (call e); `.claude/skills/**` (`G/PLAN.md:41-44`); `goals/time-to-certainty/**`;
  `X/ontology/tests/fixtures/must-fail/cq009-two-grants.ttl` bytes (`XD:1535-1536`); `ONT/lanes/**`, `ONT/ratification-package.yaml` (run-1;
  batch lists go to `ONT/work/denotation-batches/`); `X/research/s7-replay-evidence.md`; `ONT/runs/orun-2026-09-10T02:10:52Z.README.md`,
  `ONT/work-run3/impl-report.md` (no appends; broken links stay, S:50-54).
- Never run: a `X/ontology/extraction/s6/POLICY.yaml` regeneration (Ruling 7, S:102-105); `apply_s5_dispositions.py` over `s4/LEDGER.yaml`
  (S:161-163); runs 1–3, §4b, or the S5/S6/S7 baselines (`SPEC:191`).
- Only lawful moves (S:47-49), byte-identical, plain `mv`: `ONT/work/**` (315 tracked run-3 files) → `ARCH/orun-2026-09-10T02:10:52Z.work/**`;
  `ONT/governance/ratifications/rat-053..070.yaml` (18) → `ARCH/orun-2026-09-10T02:10:52Z.governance/ratifications/` (the `--s5` joins glob
  exactly these, `VP:640-641`, `:644-645`).
- Owners (another lane's file is read-only for you):

| Owner | Files | Ruling |
| --- | --- | --- |
| pin lane, CQ-009 step (pre-pin) | CQ-009 entry + errata fold in `X/ontology/docs/{competency-questions.yaml,pre-glossary.csv,closed-world.yaml,use-cases.yaml}`, dated lines in `scope.md`/`orsd.md`; `fixtures/must-fail/cq009-{same-checkout,legacy-drain}.ttl`; `seed.ttl` `grant-1`; `tests/temporal/cq-009-pre929.sparql`; regenerated `cq-009.sparql`, `cq-test-manifest.yaml`, `traceability-matrix.csv`; `run_cq_suite.py` + `VP` antecedent/rows; `s6/PREDICATES.yaml` `seed-only` rows for the two CQ-009 predicates via `build_predicates.py` only (not ratification, S:80-83) | 5 |
| pin lane, engine step (pre-pin) | `ONT/adapters/adapter-journal-run4.py`, `golden/journal-run4/**`, a new adapter-record file, `ONT/corpus/po_transcriber_run4.py` (only if reuse fails), the relocation `mv` + `ARCH/orun-2026-09-10T02:10:52Z.work/README.md`, the blinded canary | 3, 4, 6, 8 |
| pin lane, docket step | one dated at-pin addendum appended to `DK` | 10 |
| seats | `ONT/work/{hypotheses,foundational,proposals}/**`, review files (append-only), `sittings/withdrawals-*.yaml`; the blinded seat only inside its isolated root | 8, 11 |
| validity-audit / carried-rows / ratification-docket | `review-audit/validity-report-rN.md`, `sittings/sitting-N-docket.yaml` / `sittings/carried-rows-docket.md`, `carried-clusters.yaml` / `sittings/ratification-docket.{md,yaml}` | 11, 12 |
| index-close / impl-report | `ONT/work/dispositions.index.yaml` / `ONT/work-run4/impl-report.md` | 12 |
| projection (post-sitting, accepts only) | #1089 footprint: `s5/{DISPOSITIONS,TAXONOMY}.yaml`, `s6/PREDICATES.yaml` accept rows, `ABOX.yaml` only for a new class, dated S5/S6 contract notes; `X/ontology/docs/literal-domains.md` and `X/research/kpi-measurement-rules.md` never before a ratified accept (`SPEC:41`; Ruling 14, S:160-164) | 14 |
| lab (own PR after the run PR merges) | `apps/labs/ciops/**`, regenerated `G/research/s7-live-replay-evidence.md`, CT §8 dated note | 15 |
| orchestrator | `GD` (sittings, calls, the ruling superseding P2 Ruling 9's CQ-009 sentence), `ONT/work/run-manifest.yaml`, batches, observations, gate logs, `alternative/` copies, rats/rejections, `sittings/sitting-N-decisions-entry.md` mirrors (call f), rotation into `ONT/runs/<RID>.*` and `ARCH/<RID>.observations/` (call g; `SK/SKILL.md:387-411`), the pin worktree, `X/research/control-interventions.yaml`, `G/research/w1-lever-query.md`, `G/{PLAN,README}.md`, `G/ops/manifest.json`, the P3 briefs | 2, 4, 9, 10, 13, 15 |

## Engine laws (all lanes; seat-only laws — null and grain, warrants, rivals, blinding — are in each seat brief)

- Shelter and binding: no record-prefixed or `.review.yaml` file under `ONT/runs/`; trees rotate to `ARCH/` (`V:2091-2111`; `SK/SKILL.md:396-411`);
  no symlink under ONT or in any output, lexical-lstat first (`V:329-349`, `:1652-1677`); SO/PO ids recomputed, never hand-typed (`V:352-372`);
  spans and quotes equal HEAD blobs (`V:1801-1858`); `chain_sha256` from `ONT/adapters/chain_digest.py` (`V:2429-2463`); reviews append-only with
  contiguous `-rN`, a FAIL sticky, a post-FAIL PASS needs a `revision_log` (`V:2465-2493`).
- Authority: a rat counts only under `governance/ratifications/` (`V:2159-2163`), bound to `proposal_sha256`, one distinct verbatim per proposal
  (`V:1291-1323`); proposals `status: proposed` only; OTP slugs fresh, never an archived id (`VP:653-660`). Independence: a fresh context per
  batch and per adversary round, never continued via SendMessage (`SK/SKILL.md:176-177`; S:107-113).
- Adversary rounds (Ruling 11, S:142-146): a FAIL blocks; rounds continue while a FAIL remains, capped at 3; a FAIL surviving round 3 is
  withdrawn with named evidence; non-blocking findings from round 3 on become tracked follow-ups.
- Carried rows: never `mapped`/`proposed` (`V:1579-1582`); never a verbatim re-park (`V:1636-1639`); CQ-requiring duties re-park on "a
  Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009" (Ruling 12, S:148-153).
- Not vocabulary: capture provenance (`corpus_*`, `ownerRef*`, `security_resanitization`, `complete_within`, `synthetic`, `DK:1050-1061`); shadow
  hits are hypothetical (`SPEC:100-101`); merged preview is "dormant in capture window" (`ONT/corpus/run4-ledger/MANIFEST.yaml:1375`);
  `mechanismChanged` is ledger-field governance (`GD:58-67`). `.ndjson` is never a config source (`DK:1043-1045`); object grammar
  `^[^\s=/]+=\S+$` (`V:579-583`).

## Known traps (never act on them)

- Refuted: an allowlist inside the pin commit (`GD:179-189`, `:296`); a manifest written before the pin or by the pin lane (`V:1783-1786`);
  `s4/LEDGER.yaml` as #1089 precedent (`662823dd96` never touched it; `apply_s5_dispositions.py:1-3`); `XD` as the sitting log (`XD:1473-1475`);
  P2 rulings or `DK:66-69` on a base without #1459.
- Stale `DK` text until the Ruling 10 addendum: `:976-977` ("no CQ, seed or fixture edit is owed"), `:1046-1048` ("none is scheduled"),
  `:30-33` (gate amendments in `DECISIONS.md`; now `GD`, grad R7), `:984-986` (POLICY regeneration; Ruling 7).

## Stop and report

Stop the step, do not improvise or rule, write a `## Stop` section quoting both sides with path:line, and return, when: a precondition fails;
your lane brief contradicts the sitting, a `GD`/grad ruling, SPEC or a source file; a required source is missing or materially contradictory
(`SPEC:202-203`); a step would trip a SPEC stop or the docket's "Not in scope": frozen byte (`:188-190`), baseline re-run (`:191`),
scheduler/lock/repo-cli integration (`:192-193`), a `goals/time-to-certainty` edit or turning on proof reuse (`:194-195`), S8 IRI-scheme, OWL 2
RL or rules-compilation work (`:196-197`), residue (`:198-199`), launch without the gate or against grad R4 (`:200-201`), new corpus capture,
pin refresh, proof-ledger writer integration, S8 IRI design or scheduler changes (`DK:1067-1068`); or the same blocker repeats after reasonable
investigation. Lanes never switch model or provider and never spawn workers (`AGENTS.md` "Volume pools"). Fix ordinary failures in your files.

## Report: `X/research/run4-lanes/p3-<lane>-report.md`

Public bytes, residue rules apply; no nonce/key/originKey values. First line `<!-- Lane report, P3 <lane>, <date>. -->`; then: 1 Summary; 2 Rulings
implemented (Ruling n → what, `GD` line); 3 Work and evidence (counts, digests with recipe); 4 Gates (exact command, exit code, last lines); 5
Expected noise; 6 Residue and gitleaks (counts; scan B separately); 7 Friction receipts (`OPP` headings); 8 Stop/blockers; 9 Follow-ups; 10
`### Files` (`created` / `edited` / `moved old -> new`). Also return the report body in your structured result (`OPP:781-784`).

## Return

`lane`; `report` path; `preconditions` (`S0`, base check, call (h) line); `files` (path + op: created, edited, moved src → dst); `counts` (per
your brief, expected-noise lines, moved files with byte-identity result); `digests` (12-hex + recipe + commit/tree); `gates` (exact command,
exit code, last 3 lines); `residue` (scan A paths, expected none; scan B count + paths; gitleaks per path); `receipts` (`OPP` headings);
`stops` (each with both cites, or `[]`); `followUps`; `openQuestions` for the orchestrator.
