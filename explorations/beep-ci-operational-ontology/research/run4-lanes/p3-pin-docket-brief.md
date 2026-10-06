# P3 / W7 pin lane — CQ-009 step (Commit A) and docket step (Commit B)

Issued 2026-10-06 by the orchestrator. Read the P3 common brief issued with this one (`p3-common-brief.md`, beside this file) FIRST: its packet map, Ruling 4 git laws, hygiene scans, expected
noise, owner table and Stop list bind you; this brief adds your steps. Authority: the `GD` entry "2026-10-06 — P3 opened; run-4 launch sitting" (Rulings 1–17, calls a–q); `S:n`
= line n of that entry (heading = S:1). Cites are at P2 head `37f7937f1f`; if one drifted, re-anchor on its quoted text. The engine step is a sibling lane in this checkout that
moves `ONT/work/**` and `rat-053..070`: read historical artifacts with `git show HEAD:<path>` (`P/research/run3-lanes/run3-pin-docket-brief.md:7-9`).

## Preamble — shell state does not persist: paste this at the top of EVERY Bash call

```zsh
setopt pipefail; R=<run lane path from your launch message>; cd "$R"
P=explorations/beep-ci-operational-ontology; S6=$P/ontology/extraction/s6; ONT=$P/ontology/extraction/s4/beep-ci-ops
ARCH=$P/ontology/extraction/s4/archives/beep-ci-ops; CQY=$P/ontology/docs/competency-questions.yaml; DK=$P/research/auditor-run4-intake.md
GD=goals/ciops-ontology-pipeline/research/decisions.md; SK=.claude/skills/ontology-foundational-auditor; RID3=orun-2026-09-10T02:10:52Z
OPP=$P/research/OPPORTUNITIES.md; LS=$HOME/.cache/beep/run4-p3/pin-docket; mkdir -p $LS
UVP() { env -u TMPDIR PYTHONDONTWRITEBYTECODE=1 UV_CACHE_DIR=$HOME/.cache/beep/uv-cache $HOME/.local/bin/uv run --offline --python 3.12 --with pyyaml "$@"; }
PV() { (cd $P && UVP "$@"); }; SV() { (cd $S6/scripts && UVP "$@"); }
LOG() { local n=$1; shift; "$@" >$LS/$n.log 2>&1; local e=$?; print -r -- "exit=$e $n"; tail -n ${TL:-3} $LS/$n.log; return $e; }
MV() { git status --porcelain --untracked-files=no -- $ONT/work $ONT/governance/ratifications | grep -c '^ D'; }
```
Also `XD` = `P/DECISIONS.md`, `SPEC` = `goals/ciops-ontology-pipeline/SPEC.md`, `V` = `SK/scripts/validate_artifacts.py`, `VP` = `P/research/scripts/validate_packet.py`. Every
gate runs through `LOG` (real exit code); never gate on `cmd | grep` or `| tail`.

## Laws

1. Edit only "Owned" files. Read-only git only (`show`, `log`, `diff`, `ls-files`, `cat-file`, `rev-parse`, `merge-base`, `grep`); never `add`, `mv`, `rm`, `commit`, `stash`,
   `checkout`, `switch`, `restore`, `reset`, `merge`, `rebase`, `fetch`, `tag`, `push`, `worktree`; nothing remote; leave the tree dirty, the orchestrator stages by name
   (Ruling 4, S:58-65; `DK:1072`). Never read a fleet clone, a sibling lane or a `.beep/` tree; never touch `~/YeeBois/projects/beep-effect5`; scratch only under `$LS`.
2. You are the pin lane, not a docket lane (`DK:1071` binds docket lanes; grad R9 gives the fold to "the pin lane", `XD:1532-1534`); Ruling 5 (S:67-86) fixes the scope
   (`SPEC:41-43`; stops `SPEC:188-191`).
3. Public repo: no host path (write `~`), login, uid, hostname, pid or session id in any byte you write (`SPEC:198-199`).
4. Python only via `UVP` (call a, S:189-191; never `mise trust`, never a quoted `~`); bun only via `zsh -ic`. If `--offline` cannot resolve, stop that gate, file a receipt and
   report a blocker to the orchestrator. Never drop `--offline` (call a; common brief "Packet gates").
5. Nothing here is heavy; any package-verify, multi-file vitest, docgen, build or corpus replay runs under `beep-heavy` (wait on "all 3 slots busy").
6. Receipts (call d, S:195-196): at the moment of friction append ONE heredoc (`cat >> $OPP <<'EOF'`), never an Edit (the engine lane appends to the same file), then
   `tail -n 8 $OPP` to confirm both lanes' lines survive. Heading `## 2026-10-06: P3 pin lane — CQ-009 and docket steps — <topic>` unless the last `## ` heading is yours;
   bullets Work / Evidence (command, minimal error text) / Prevention; redacted.
7. Noise (call c, S:193-195): you do not run `V`; its 138 "prior unresolved observation … has NO row in this run's index" lines (`V:2347-2356`) are not yours; invent no row.
   Packet-validator WARNs at the step-0 count are standing. `VP --s5` reads the live dirs AND the shelters (`VP:640-645`), so a delta the engine move explains is engine-owned
   (step 0, A8).

## Owned — everything else is NEVER

A: `CQY`; `P/ontology/docs/{pre-glossary.csv,closed-world.yaml,use-cases.yaml,scope.md,orsd.md}`; regenerated `P/ontology/docs/traceability-matrix.csv`,
`P/ontology/tests/{cq-009.sparql,cq-test-manifest.yaml}`, `S6/PREDICATES.yaml`; new `P/ontology/tests/temporal/cq-009-pre929.sparql`,
`P/ontology/tests/fixtures/must-fail/cq009-{same-checkout,legacy-drain}.ttl`; `P/ontology/tests/fixtures/seed.ttl` (grant-1 only);
`P/research/scripts/{run_cq_suite.py,validate_packet.py}`. B: `DK` (append only). Either: `OPP` (append), `P/research/run4-lanes/p3-pin-docket-report.md` (new).

NEVER: `ONT/{corpus,runs,work,governance,adapters,lanes}/**`, `ONT/work-run{2,3,4}/**`, `ONT/ratification-package.yaml`, `ARCH/**` (engine lane, seats, orchestrator);
`rat-001..070` bytes; `s4/LEDGER.yaml`; `P/ontology/extraction/**` except `S6/PREDICATES.yaml` via `build_predicates.py` (never
`S6/{POLICY.yaml,ABOX.yaml,scripts/**,graphs/**}`, `extraction/s5/**`); `cq009-two-grants.ttl` bytes and every other fixture; `seed.ttl` beyond grant-1; CQ text beyond CQ-009
and the A4 lines; closed-world rows beyond the `hasOriginKey` note; `regen_cq_artifacts.py`, `build_predicates.py`, `redact_journal_snapshot.py`;
`P/ontology/docs/{literal-domains.md,s7-projection-contract.md,s5-*,s6-*}`; `P/research/{control-interventions.yaml, kpi-measurement-rules.md,evidence/**}`; other lanes'
`p3-*-report.md` and every `*-brief.md`; `goals/**` (orchestrator; `goals/time-to-certainty/**` included); `apps/**`, `packages/**` (read-only; lab lane, Ruling 15); `XD`,
BRIEF, MAP, README; `.claude/**`; `.gitleaks.toml`, `.gitleaksignore`.

## Stop

Write `## Stop` in the report quoting both sides with path:line and return, never improvising, on: any common-brief Stop (`SPEC:188-203`; `DK:1063-1072` "Not in scope"); a
failed precondition, the `s0-py` probe included (law 4); a dirty owned path at step 0; non-idempotent A1; a launch-gate re-read failure in B1 (C4.1 needle absent at
`goals/time-to-certainty/PLAN.md:171`, file digest not `e5bfe622d649`, or `run4-ledger/MANIFEST.yaml:45-59` changed: the pin lane "records the state in its report and stops",
`DK:30-32`); a `PREDICATES.yaml` diff beyond the two named records, `predicate_count` and the CQ-009 coverage row; a red gate you cannot attribute to your bytes or to the
engine move; a byte written outside "Owned"; a residue or gitleaks hit outside your own bytes; materially contradictory sources (`SPEC:202-203`).

## Step 0 — preconditions and baseline (keep every output line for the report)

```zsh
git rev-parse --abbrev-ref HEAD; S0=$(grep -n 'P3 opened; run-4 launch sitting' $GD | cut -d: -f1); echo "S0=${S0:-MISSING}"   # feat/ciops-p3-run4 (Ruling 1, S:24-29)
M=${M1459:-$(git log -F --grep='#1459' --format=%H -1 origin/main)}; git merge-base --is-ancestor "$M" HEAD; echo "base=$?"   # 0
grep -c 'Recorded call (h)' $GD; grep -c '^## 8. 2026-10-06 amendment' $P/ontology/docs/s7-projection-contract.md   # >=1; 1
git status --porcelain -- $P/ontology/docs $P/ontology/tests $P/research/scripts $S6/PREDICATES.yaml $DK; echo status-done   # nothing before the marker
LOG s0-py UVP python -B -c 'import sys,yaml;print(sys.version.split()[0],yaml.__version__)'   # exit=0, 3.12.x <ver>; else Stop (law 4)
print MOVE=$(MV) README=$([[ -e $ARCH/$RID3.work/README.md ]] && echo yes || echo no)   # 0/no before the engine move; 333/yes after
```
The orchestrator warmed the cp312 cache before launch (call m); an `s0-py` failure still blocks for the orchestrator (cache warming is not a lane step). Run `VP` only at
MOVE 0, or 333 with README yes; any other value is a move in flight: check later, never mid-move (engine brief §B).
```zsh
LOG s0-vp PV --with rdflib python -B research/scripts/validate_packet.py; LOG s0-s5 PV --with rdflib python -B research/scripts/validate_packet.py --s5
LOG s0-s6 PV --with rdflib --with pyshacl python -B research/scripts/validate_packet.py --s6; LOG s0-cq PV --with rdflib --with pyoxigraph python -B research/scripts/run_cq_suite.py   # cq: RESULT: 0 failure(s) across 25 seed tests + 20 fixtures
LOG s0-bp SV python -B build_predicates.py --check     # CHECK: ... matches; predicates: 87; CQ coverage: 2/25 ...
LOG s0-ap SV python -B apply_s6_dispositions.py --check; LOG s0-sh SV --with rdflib --with pyshacl python -B run_shacl.py   # no files changed; RESULT: PASS
```

## Commit A — the CQ-009 package (Ruling 5, S:67-86; grad R9 `XD:1523-1538`)
- **A1.** Idempotence first (`regen_cq_artifacts.py` has no check mode and deletes stale `cq-*.sparql`, `:69-74`). Expect exit 0, last line
  `regenerated 25 tests (18 must / 7 should), manifest, traceability matrix`, `diff=0`, empty status; otherwise Stop:
```zsh
LOG a1-regen PV python -B research/scripts/regen_cq_artifacts.py; git diff --exit-code --stat -- $P/ontology/tests $P/ontology/docs/traceability-matrix.csv; echo diff=$?; git status --porcelain -- $P/ontology/tests
```
- **A2.** Before any CQ edit, write the retained pre-#929 query, outside every non-recursive `cq-*.sparql` glob (`run_cq_suite.py:146`, `validate_packet.py:302,884`,
  `regen_cq_artifacts.py:71`). Header: hand-authored `#` lines, never "GENERATED": "CQ-009 pre-#929 temporal scope: the #870 origin-keyed law for admission state before #929
  (e76c4db079, 2026-08-31); retained regression over must-fail/cq009-two-grants.ttl, oracle rows_ge_1; graduation Ruling 9, P3 Ruling 5". Body = the HEAD query minus its three
  generated header lines:
```zsh
mkdir -p $P/ontology/tests/temporal   # write the header into $P/ontology/tests/temporal/cq-009-pre929.sparql, then:
git show HEAD:$P/ontology/tests/cq-009.sparql | tail -n +4 >> $P/ontology/tests/temporal/cq-009-pre929.sparql
```
- **A3.** `CQY:217-238` CQ-009. Keep `id`, `source_use_case: UC-002`, `type: constraint`, `priority: must_have`, `sample_answer: []`, `derivation_method: inference`,
  `expected_result: zero_rows`, `required_classes: [SeatGrant, GrantState]` and the key order. Set:
  - `natural_language` (one line, `regen_cq_artifacts.py:46-47`): "Do any two active seat grants hold the same checkout, or does any active grant share a non-empty origin with an
    active legacy-origin-lock grant? (deployed post-#929 exclusion law: same-checkout plus legacy-origin drain; must be zero)".
  - `required_properties: [hasOriginKey, hasGrantState, hasCheckout, hasCoordinationProtocol]`.
  - `notes` (one double-quoted line, no inner `"`): re-scoped at the run-4 pin (grad R9, P3 R5); the #929 law by symbol (`QualityScheduler.ts` `isTicketSkippable` skips on
    `hasSameCheckoutLease` or `hasLegacySameOriginOwner`: a `scheduler-origin-concurrency/v1` ticket whose non-empty originKey a `legacy-origin-lock/v1` lease or ticket holds);
    both arms bound in `?arm`; current-version same-origin grants in distinct checkouts are capacity peers; excluded: the fresh `blockedOnOriginAtMillis` stamp, the review-fix
    class cap (CQ-021), the below-envelope fallback origin lease (`AdmissionOriginGate.tryAcquireFallback`); the pre-#929 law survives as `tests/temporal/cq-009-pre929.sparql`
    over `cq009-two-grants.ttl`; both new predicates are seed-only, `hasCheckout` closure undeclared; regression fixtures `cq009-same-checkout.ttl`, `cq009-legacy-drain.ttl`.
  - `sparql: |` as below; PREFIX lines required (`validate_packet.py:906-908`). The mechanical scan (`build_predicates.scan_cq_predicates`) yields exactly
    `ciops:hasCheckout, ciops:hasCoordinationProtocol, ciops:hasGrantState, ciops:hasOriginKey, rdf:type`; no `FILTER NOT EXISTS` (`validate_packet.py:412-421` stays idle):
```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX ciops: <https://oip.law/ontology/ci-ops#>
SELECT ?g1 ?g2 ?arm WHERE {
  ?g1 rdf:type ciops:SeatGrant ; ciops:hasGrantState ciops:ActiveGrant .
  ?g2 rdf:type ciops:SeatGrant ; ciops:hasGrantState ciops:ActiveGrant .
  FILTER (?g1 != ?g2)
  { ?g1 ciops:hasCheckout ?c . ?g2 ciops:hasCheckout ?c . BIND("same-checkout" AS ?arm) }
  UNION
  { ?g1 ciops:hasOriginKey ?o ; ciops:hasCoordinationProtocol "legacy-origin-lock/v1" .
    ?g2 ciops:hasOriginKey ?o . FILTER (?o != "") BIND("legacy-origin-drain" AS ?arm) }
}
```
- **A4.** Errata fold (grad R9's four files + `P/ontology/docs/orsd.md:105-126` §9; Ruling 5), each marked "folded at the run-4 pin":
  - `CQY:215` CQ-008 notes: append that the sample's `ciops:MachineProofLock` (`:199-201`, bytes kept) now denotes the legacy per-origin lock (drain only) and the below-envelope
    fallback origin lease. `CQY:247` CQ-010: `QualityScheduler.ts:661-663` →
    `QualityScheduler.ts self-admission charge check activeTokenTotal(state) + ticket.weightTokens <= capacityTokens`. `CQY:574` CQ-021 notes: append that since #878
    (`a9497e66ca`) the lease carries nonce and enqueuedAtMillis (legacy files decode an empty nonce and 0) and admission-admitted carries enqueuedAtMillis and admittedAtMillis;
    the no-stored-edge text is pre-#878 state. `CQY:622` CQ-023: `effectivePriorityRank, QualityScheduler.ts:600-601` → `effectivePriorityRank in QualityScheduler.ts`.
  - `pre-glossary.csv` notes: `SeatGrant` `:19` (#878 edge), `Checkout` `:23` (an exclusion unit since #929), `hasOriginKey` `:68` (exclusion identity only in the legacy drain,
    the fresh stamp and the fallback lease), `enqueuedAt` `:101` (the lease carries it since #878), `MachineProofLock` `:114` (legacy lock and fallback lease). Insert after `:68`
    (census 42 / 70 / 4 = 116 → 42 / 72 / 4 = 118 rows):
    ```csv
    hasCheckout,property,CQ-009,"object property SeatGrant -> Checkout; deployed carrier = lease checkoutRoot; CQ-009 same-checkout arm (#929 hasSameCheckoutLease); seed-only until ratified"
    hasCoordinationProtocol,property,CQ-009,"data property xsd:string; verbatim deployed coordinationProtocol (legacy-origin-lock/v1 marks the drain; scheduler-origin-concurrency/v1 is current); CQ-009 legacy-origin-drain arm (#929 hasLegacySameOriginOwner); no literal domain; seed-only until ratified"
    ```
  - `closed-world.yaml:84-90`: rewrite only the `hasOriginKey` `note` (closure binds the legacy-drain arm; the same-checkout arm joins on `hasCheckout`, closure undeclared). Add
    no row: `S6/scripts/build_predicates.py:137-138` exits unless there are exactly 14. File a receipt.
  - `use-cases.yaml:28`: `origin exclusion on originKey — CQ-009` → `same-checkout exclusion plus the legacy-origin drain since #929 — CQ-009`.
  - `scope.md` after `:110`, `orsd.md` after `:126`: one paragraph each, "Folded at the run-4 pin (<date>)", what moved where (relative paths to existing files only) under goal
    P3 Ruling 5; orsd's states the 42/72/4 census. Delete no amendment text.
- **A5.** Fixtures follow `cq009-two-grants.ttl:1-4` and `cq012-incomplete-episode.ttl:1-3`: a `#` header naming the attack and the oracle, `@prefix ciops:` only, minimal
  individuals. `cq009-same-checkout.ttl`: `ciops:co-1 a ciops:Checkout`; g1, g2 active SeatGrants, origins `"origin-a"`/`"origin-b"`, both on co-1, both
  `"scheduler-origin-concurrency/v1"`. `cq009-legacy-drain.ttl`: co-1, co-2; g1, g2 active, both `"same-origin"`, on co-1/co-2, protocols
  `"legacy-origin-lock/v1"`/`"scheduler-origin-concurrency/v1"`. Seed grant-1 (`seed.ttl:94-101`), after `ciops:hasOriginKey "origin-beep-effect" ;`, gains
  `ciops:hasCheckout ciops:checkout-example ;` and `ciops:hasCoordinationProtocol "scheduler-origin-concurrency/v1" ;` (the constructor default for new admissions,
  `QualityScheduler.schemas.ts:271`; records without the field decode as `legacy-origin-lock/v1`, `:272`).
- **A6.** Antecedent body at `run_cq_suite.py:39-41` and its copy under `"CQ-009"` at `validate_packet.py:381-383` (same PREFIX and layout) →
  `ASK { ?g a ciops:SeatGrant ; ciops:hasGrantState ciops:ActiveGrant ; ciops:hasCheckout ?c . }`. Row `run_cq_suite.py:66` →
  `("must-fail/cq009-two-grants.ttl", "temporal/cq-009-pre929", "rows_ge_1"),`, then `("must-fail/cq009-same-checkout.ttl", "cq-009", "rows_ge_1_all_bound"),` and
  `("must-fail/cq009-legacy-drain.ttl", "cq-009", "rows_ge_1_all_bound"),`. No other row: 22 fixtures.
- **A7.** Regenerate and prove the footprint: `predicate_count` 87 → 89; `ciops:hasCheckout`, `ciops:hasCoordinationProtocol` enter `seed-only` (term_ref null, domain/range
  unknown, closure open, used_by CQ-009 and `tests/fixtures/seed.ttl`), not ratification (the `landedAt` precedent, `S6/PREDICATES.yaml:474-482`); the CQ-009 coverage row
  (`:993-1003`) goes 3 → 5 predicates, 2 ratified.
```zsh
LOG a7-regen PV python -B research/scripts/regen_cq_artifacts.py   # regenerated 25 tests (18 must / 7 should), ...
git diff --stat -- $P/ontology/tests $P/ontology/docs/traceability-matrix.csv   # cq-009.sparql, fixtures/seed.ttl, traceability-matrix.csv (CQ-009 row); manifest unchanged
LOG a7-check SV python -B build_predicates.py --check; LOG a7-build SV python -B build_predicates.py   # non-zero (differs, expected); predicates: 89; CQ coverage: 2/25 fully ratified
git diff --stat -- $S6; git diff -U0 -- $S6/PREDICATES.yaml | grep -E '^[-+]- predicate:'   # PREDICATES.yaml only; exactly the two `+- predicate:` lines
```
- **A8.** Gates; WARN counts equal step 0. Record `MV` again (step-0 move rule; a MOVE change since step 0 explains an `--s5` delta, engine-owned). Then rerun regen once and
  show its outputs' `git diff --stat` identical before and after.
```zsh
print MOVE=$(MV); LOG a8-vp PV --with rdflib python -B research/scripts/validate_packet.py
#  Suite: 26 CQs (18 must / 7 should), 25 tests, 42 classes / 72 properties / 4 individuals  /  RESULT: 0 blockers, <step-0> warns
LOG a8-s5 PV --with rdflib python -B research/scripts/validate_packet.py --s5; LOG a8-s6 PV --with rdflib --with pyshacl python -B research/scripts/validate_packet.py --s6
LOG a8-cq PV --with rdflib --with pyoxigraph python -B research/scripts/run_cq_suite.py; grep -E 'cq-009|cq009|^GOLDEN|^RESULT' $LS/a8-cq.log
#  PASS: cq-009 seed zero rows (antecedent populated — non-vacuous) / must-fail/cq009-two-grants.ttl -> temporal/cq-009-pre929 2 row(s) / must-fail/
#  cq009-same-checkout.ttl -> cq-009 2 row(s) / cq009-legacy-drain.ttl -> cq-009 1 row(s); COVERAGE: cq-009 2/5 ratified; GOLDEN: <step-0>; RESULT: 0 failure(s) across 25 seed tests + 22 fixtures
LOG a8-bp SV python -B build_predicates.py --check; LOG a8-ap SV python -B apply_s6_dispositions.py --check; LOG a8-sh SV --with rdflib --with pyshacl python -B run_shacl.py
(cd $P/ontology/tests && UVP --with pyoxigraph python -B -c 'from pyoxigraph import Store,RdfFormat
q=open("cq-009.sparql").read()
for f in ("cq009-same-checkout","cq009-legacy-drain","cq009-two-grants"):
    s=Store(); s.load(open("fixtures/must-fail/"+f+".ttl","rb").read(),RdfFormat.TURTLE); print(f,sorted({r["arm"].value for r in s.query(q)}))'); echo exit=$?
#  cq009-same-checkout ['same-checkout']  /  cq009-legacy-drain ['legacy-origin-drain']  /  cq009-two-grants []
```
- **A9.** Digests after the LAST CQ/scope byte: pre-commit working-tree values. The validator reads the committed blob (`validate_artifacts.py:1859-1873`); the orchestrator
  re-verifies them on the Commit A blob (`git show <A>:<path> | sha256sum`) before the manifest. Once reported, A is frozen: a later CQ or scope byte stales every review chain
  (`validate_artifacts.py:2456-2462`).
```zsh
sha256sum $CQY $P/ontology/docs/scope.md $S6/PREDICATES.yaml | awk '{print substr($1,1,12),$2}'; grep -c '^- id: CQ-' $CQY   # cq_suite (was e99e30cd8015), scope_doc (was 9ff61c839a08), PREDICATES; 26
```

## Commit B — one dated at-pin addendum appended to `DK` (Ruling 10, S:130-140; Rulings 7, 13)

Append-only: every existing `DK` byte stays, line 1 included (`DK:1` "pre-pin draft" and `DK:3` stay as provenance). Append ONE section at EOF, after `## Not in scope` (Ruling
10 "appends"; it records the pin lane's work, so the docket-lane scope above it is unchanged), headed
`## At-pin addendum (<date>; re-verified at the pin; goal P3 launch sitting Rulings 5, 7, 10, 13)`, sub-headings `####` only, citing post-Commit-A lines by fresh `grep -n`,
holding B1–B8 in order. Then prove the prefix: `N=$(git show HEAD:$DK | wc -l); head -n $N $DK | cmp - <(git show HEAD:$DK) && echo PREFIX-IDENTICAL`.
- **B1.** Re-verification table (at the pin | P2 head | source | match); a mismatch records both values and its cause, never fixed at the source; a gate mismatch is a Stop. One
  command per row (Queue D fails closed on a missing or mismatched projection, `DK:963-966`; `DK:954-958`'s 692 is the 10-01 live count, not the pin census; CQ suite and scope
  rows = A9, provisional until the orchestrator's blob check):
```zsh
I=$ONT/runs/$RID3.index.yaml; L=$ONT/corpus/run4-ledger/MANIFEST.yaml; F=$ONT/corpus/run4-fleet/MANIFEST.yaml; T=goals/time-to-certainty/PLAN.md
sha256sum $I $SK/scripts/validate_artifacts.py $SK/SKILL.md $SK/prompts/{denotation,ufo-analysis,synthesis,ontoclean-adversary,alternative-model}.md $SK/scripts/run_adapter_sandbox.sh $F $L $S6/POLICY.yaml | awk '{print substr($1,1,12),$2}'
#   b9c140ccd31b; fdbcefc9fd70, a12de4055976, ddec132ee905, 3d94feb0629c, 117d82b29904, 9dbfb7fc9d4c, 4563e5726438, ecb6dcab421b; 7d22f37b879c, bff7da48e0e8; POLICY a6cac3b03944 (unchanged)
awk '/^- observation: /{if(o)print o,c,p;p=substr($3,1,2);o="";c="live"} /^  outcome: /{o=$2} /^  carried_from_prior: true/{c="carried"} END{print o,c,p}' $I | sort | uniq -c   # 284 = proposed 37 / mapped 77 / irrelevant 32 / unresolved 138 (live 84 + carried 54 = so 91 + po 47)
a=$(sed -n '/^### Queue C/,/^### Queue D/p' $DK | grep -oE '(so|po):sha256:[0-9a-f]{64}' | sort -u); b=$(awk '/^- observation: /{if(o=="unresolved")print id;id=$3;o=""} /^  outcome: /{o=$2} END{if(o=="unresolved")print id}' $I | sort -u)
print ${#${(f)a}} ${#${(f)b}} $(comm -3 <(print -r -- $a) <(print -r -- $b) | wc -l)   # 138 138 0: Queue C set-equal (buckets 14/2/68/54, DK:248-254)
grep -c '^- term: ' $P/ontology/extraction/s5/TAXONOMY.yaml; grep -c '^  flags:' $P/ontology/extraction/s5/TAXONOMY.yaml; git grep -h '^decision:' HEAD -- $ONT/governance/ratifications | sort | uniq -c   # Queue A: 52; 15; 18 accept
(cd .claude/skills && UVP python -B -c 'import hashlib,pathlib as P;s=P.Path("_shared");f=sorted([*(s/"schemas").glob("*.yaml"),*s.glob("*.yaml"),*s.glob("*.md"),*s.glob("*.json"),*P.Path("ontology-foundational-auditor/templates").glob("*.yaml")],key=str);h=hashlib.sha256();[h.update(f"{x}\n{len(x.read_bytes())}\n".encode()+x.read_bytes()) for x in f];print(len(f),h.hexdigest()[:12])')   # 21 dcc8da4cc7f9
for d in run4-fleet run4-ledger; do print -rn -- "$d: "; git ls-files $ONT/corpus/$d | awk -F. '{print $NF}' | sort | uniq -c | tr -s ' \n' ' '; git ls-files $ONT/corpus/$d | wc -l; done   # fleet 1 json 467 ndjson 468 properties 1 yaml 937; ledger 9 ndjson 9 properties 1 yaml 19
grep -A3 '^totals:' $F $L | grep events; sed -n '1461p;1467,1475p' $L   # 11179, 8082; pairs: 4041; hits total 125, cross_origin 15, disagreements 0, "hypothetical would-reuse"
git diff --quiet HEAD -- $T $L; echo dirty=$?; sed -n '45,59p;1368,1375p' $L   # dirty=0; gate.c4_1 file/line/needle/sha256, 3628, holds: true; merged-preview 0/0 facts, 0/0 shadows, "dormant in capture window (P1 Ruling 1)"
git show HEAD:$T | sha256sum | cut -c1-12; git show HEAD:$T | sed -n 171p | grep -cF 'C4.1 shadow mode — done 2026-09-21'   # e5bfe622d649 (WHOLE-FILE digest, = gate.c4_1.sha256); 1. C4.2 unchecked at :176
J=$P/research/evidence/journal-snapshot-2026-10-01; sed -n '61,62p;40365,40372p;40400,40405p' $F   # Queue D: 689 rows; chains; projection sha 8cceaf171636…, 695 rows
(cd $J && grep ' journal.redacted.ndjson$' SHA256SUMS.txt | sha256sum -c -); wc -l < $J/journal.redacted.ndjson   # journal.redacted.ndjson: OK; 695
LOG b1-qd PV python -B research/scripts/redact_journal_snapshot.py --check   # exit=0; payload absent → committed projection verified only (:51-56); the Queue D reading
```
- **B2.** Prior chain: the three YAML lines of `DK:73-79`, verbatim (`first_run: false`, `prior_index: runs/orun-2026-09-10T02:10:52Z.index.yaml`,
  `prior_index_sha256_12: b9c140ccd31b`).
- **B3.** `#### Queue G` (grad R6(2), `XD:1451-1453`), the pair only: `OperationalChangeEvent` (class, `pre-glossary.csv`, CQ-016) and `ciops:landedAt` (`xsd:dateTime`;
  `S6/PREDICATES.yaml` record `ciops:landedAt`, `seed-only`); warrant CQ-016 (`should_have`, `direct_lookup`); in no S5/S6 artifact. The ledger
  `P/research/control-interventions.yaml` at the pin (sha256_12, rows, W1 census HEAD) is SUPPLIED BY THE ORCHESTRATOR after its W1 re-run over `8b7392fe00..<run base>` (Ruling
  10; today `ef6b4391f9c7`, 42 rows; candidates #1422, #1450, #1427, #1460). If supplied, confirm it and add the census below; if not, write `LEDGER-AT-PIN-PENDING` for every
  ledger value and Return it (no census from the pre-re-run file):
```zsh
C=$P/research/control-interventions.yaml; sha256sum $C | cut -c1-12; grep -c '^- id: iv-' $C
grep -E '^  mechanismChanged:' $C | awk '{print $2}' | sort | uniq -c; grep -E '^  landedAt:' $C | tr -d '"' | awk '{print $2}' | sort | sed -n '1p;$p'
```
Criterion: grad R6(1) as amended by P0 Ruling 2 (`GD:39-48`); `mechanismChanged` is ledger-field governance (P0 Ruling 4, `GD:58-67`), never ratified vocabulary; out-of-repo
`landedAt` (P0 Ruling 6, `GD:80-88`); `causalStatus` observational (ledger `:19-22`). Seats read rows as seed data, claim no cause, and need distinct observations for class and
property (one `ref` per index row, `DK:1019-1020`). No row gains a `tier` member; W8 tier derivation is a P4 hand-off (Ruling 10).
- **B4.** `#### Queue H` (grad R10, `XD:1540-1550`), the fourth `AssuranceTier` member. Deployed `ProofStage` `repair-loop | pre-push | merged-preview | hosted`
  (`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:194`); KPI sub-partition `P/research/kpi-measurement-rules.md:142-148`. Blocker:
  `AssuranceTierId` parked (`s5/TAXONOMY.yaml:20-24`; `s5/scripts/build_dispositions.py:82-84`), three members (`literal-domains.md:13`); a member needs a Must/Should CQ or a
  named support license (`:40-42`), and run 4 admits no CQ edit beyond CQ-009: warrant = CQ-002/006/017 or `semantic_support_for` a same-run `AssuranceTier` class proposal.
  Evidence: dormant in the capture window, never observed-and-empty (`run4-ledger/MANIFEST.yaml:1368-1375`; `run4-fleet/MANIFEST.yaml:37190-37216`: merged-preview starts 3 / 0
  since the cut, last 2026-09-09T03:41:38Z; kind is not stage, `:37169-37174`; P1 Ruling 1 `GD:149-166`). Seat question: tier or stage? Prior refutation:
  `ARCH/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-yeet-proof-tier-001.yaml`.
- **B5.** `#### Queue E addendum` (CT §8.3, `P/ontology/docs/s7-projection-contract.md:463-479`; IRI base `https://oip.law/ontology/ci-ops-prov#`): classes `LanePlan`,
  `LaneStep`, `LanePlanSpecification`; object properties `hasLanePlan` (VerificationEpisode → LanePlan), `hasLaneStep`, `hasLanePlanSpecification`, `precedesLaneStep` (derived,
  never independent evidence, `:497-501`); data properties `laneStepIndex` (`xsd:integer`, 0-based), `laneIdRef`, `handoffDigest`, `laneOrderRule` (`xsd:string`). Evidence:
  `apps/labs/ciops/test/fixtures/lane-plan-v1.ttl` (`58e9061ebbaa`, 33 steps); P2 Ruling 3 (`GD:400-418`); never-used list `:481-485`; `LanePlan` beside
  `VerificationPlanSpecification` under rat-049 (`:520-521`, `DK:66-69`), no `subClassOf`/`rdf:type`/equivalence.
- **B6.** Queue F carry (Ruling 7, S:102-105): `S6/POLICY.yaml` stays (regenerating re-extracts the S6 policy, `SPEC:191`); both run-4 pin manifests carry the tree-pinned
  convention; carried to the next S6 refresh, superseding the `DK:979-986` schedule.
- **B7.** Numbering (Ruling 13, S:155-158): live 18 (`rat-053..070`, moving to the shelter); shelters 31 (`rat-001..031`) and 21 (`rat-032..052`); rejections 0 → next
  `rat-071`, `rej-001`, the maximum over live and every shelter (the SKILL `LAST` probe reads only the live dir); proposal slugs fresh, never an archived id.
  `git ls-files $ONT $ARCH | grep -oE 'rat-[0-9]{3}' | sort -u | tail -1` (rat-070); `… | grep -cE 'rej-[0-9]{3}'` (0).
- **B8.** Dated corrections, prior text kept: `DK:976-977` ("no CQ, seed or fixture edit is owed to run 4") and `DK:1046-1048` ("none is scheduled") are superseded by grad R9
  and Ruling 5 (name Commit A's contents and the A9 digests); `DK:30-33`'s "steward ruling scribed in `DECISIONS.md`" now reads `GD` (grad R7, `XD:1470-1475`). Shelter remap
  (Ruling 3): every `ONT/work/**` path in the docket (`DK:18-22`, `:488`, `:847-848`, `:863-929`, `:974`, `:997`) resolves under `ARCH/orun-2026-09-10T02:10:52Z.work/`,
  `rat-053..070` under `ARCH/orun-2026-09-10T02:10:52Z.governance/ratifications/`; the relocation note is `ARCH/orun-2026-09-10T02:10:52Z.work/README.md` (engine lane). Table
  the five sittings files (`carried-clusters.yaml`, `ratification-docket.md`, `withdrawals-{bind-ver-r1,ver-r2,sitting-3}.yaml`).

## Final gates (common brief "Public-repo hygiene"; Ruling 17, S:181-183)

`FILES` = every file you created or edited, report included; `NEW` = the two fixtures, the temporal query, the report.
```zsh
FILES=(<each owned path you touched>); NEW=(<each created path>); LOG fg-typos typos $FILES   # explicit paths bypass _typos.toml's explorations/** exclude; a digest-token hit is a false positive to report (OPP 2026-09-09)
LOG fg-yaml UVP python -B -c 'import sys,yaml;[yaml.safe_load(open(f)) for f in sys.argv[1:]];print("YAML OK",len(sys.argv)-1)' $P/ontology/docs/{competency-questions,closed-world,use-cases}.yaml $P/ontology/tests/cq-test-manifest.yaml $S6/PREDICATES.yaml   # YAML OK 5
git diff --check -- $FILES; echo diffcheck=$?; grep -lE '[[:blank:]]$' $NEW; echo ws-done   # diffcheck=0; no path before ws-done
rg -l --no-messages -e '/home/' -e '(^|[/ "'"'"'])-home-' -e '/run/user/' -e 'claude-[0-9]+' -e 'scratchpad' \
  -e "$(id -un)" -e "$(uname -n)" -e '\b(pid|ownerpid|attachedpid)["'"'"']?\s*[:=]\s*["'"'"']?[0-9]+' \
  -e '\b(key|originKey)["'"'"']?\s*[:=]\s*["'"'"']?[0-9a-f]{12,}' $FILES; echo scanA-done   # no path before scanA-done; a hit in a sibling's OPP lines is attributed, not edited
git show origin/main:.gitleaks.toml > $LS/gitleaks-main.toml; git show origin/main:.gitleaksignore > $LS/gitleaksignore-main
for p in $FILES; do gitleaks dir "$p" --config $LS/gitleaks-main.toml --gitleaks-ignore-path $LS/gitleaksignore-main --redact --no-banner; echo "exit=$? $p"; done   # no leaks found, each
LOG fg-refs zsh -ic "cd $R && bun run beep knowledge refs --check"   # passes, or name the pre-existing finding
```
A gitleaks hit blocks for the orchestrator: never add an allowlist entry or reword a digest-bound record (`GD:188-190`, `:296`).

## Report — `P/research/run4-lanes/p3-pin-docket-report.md`

Public bytes, residue rules apply. First line `<!-- Lane report, P3 pin-docket, <date>. -->`; then the common sections: 1 Summary; 2 Rulings implemented (Ruling n → what, `GD`
line); 3 Work and evidence (A: idempotence proof, per-file before/after, PREDICATES delta, arm proof, A9 digests marked provisional; B: outline, PREFIX-IDENTICAL, the B1 table
with mismatches, open tokens); 4 Gates (command, exit, last lines, beside step 0; MOVE at step 0 and A8); 5 Expected noise; 6 Residue and gitleaks; 7 Friction receipts; 8
Stop/blockers; 9 Follow-ups; 10 `### Files`.

## Return

`lane` (pin-docket); `report`; `preconditions` (branch, `S0`, `base=`, call (h) count, `s0-py` line, MOVE/README); `files` (A / B / either, created vs edited, disjoint);
`counts` (seed tests 25, fixtures 22, CQs 26, glossary 42/72/4 = 118, predicates 89, CQ coverage n/25, WARNs step 0 vs A8, noise lines); `digests` (cq_suite, scope_doc,
PREDICATES marked provisional; B1 values; B3 ledger values or `LEDGER-AT-PIN-PENDING`); `gates` (every `LOG` name, command, exit, last lines, beside step 0) and the arm proof;
B1 mismatches with cause; `residue` (scan A, gitleaks per path, whitespace); `receipts` (`OPP` headings); `stops` (both cites, or `[]`); `followUps`, at least: a 15th
closed-world declaration for `hasCheckout` (blocked by `build_predicates.py:137-138`); no check mode in `regen_cq_artifacts.py`; `hasCheckout` (seed-only) vs the parked S5
candidate `checkoutRoot` (`s5/DISPOSITIONS.yaml` seq 37, property, `parked-run-2`): run-4 intake decides the relation; the orchestrator's blob check of the A9 digests;
`openQuestions`.
