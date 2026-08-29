# Follow-up PR synthesis — grill agenda (2026-08-04)

Five research reports (r1–r5, this directory) answering the operator's eight
questions. Decision agenda with recommendations, ordered by leverage.

## A. Fail-fast as yeet's default (r1; Q1/Q6/Q7)

1. **Cheap-preflight wave** (r1 #1, 100–220 LOC): ordered waves with
   `fail-fast | collect-all` policy; the lane model already carries
   stage/blockedBy metadata that `githubCheckLaneSteps` discards. Replay
   estimate: up to 4 of tonight's long cycles become early failures.
   → Recommend: build in follow-up PR.
2. Per-lane proof resume — smallest slice of the evidence-loop design; kills
   the "one formatting nit forfeits 15 min" class. → Recommend: second item,
   respect evidence-loop packet ownership (implement there or joint).
3. Sanctioned "ship" mode (push early + PR + parallel local proof + hosted-red
   fix loop — what we did by hand): needs the PublishScope staged-vs-commit
   contradiction fixed regardless. → Recommend: design in this PR, land the
   contradiction fix now, full mode later.

## B. CI shared setup (r2; Q2)

~15–17 runner-minutes of repeated setup per PR (17 contexts × ~60s). Options
ranked: (1) consolidate the four smallest CLI-only gates keeping status
contexts (needs ruleset awareness), (2) trusted-base read-only turbo cache for
PR jobs, (3) lockfile-keyed installed-tree artifact/runner image, (4) prime
build once and restore into Integration/Coverage. The setup composite already
emits timing the TSV collector ignores — ingest it first (measure before
treating). → Recommend: land (2) + timing ingestion in follow-up; (1) needs a
ruleset edit decision from the operator.

## C. Package deletions (r3; Q3)

Eight zero-consumer candidates: acp, pacer, discord, tailscale, courtlistener,
dol, federal-register, protobuf — 124 tracked files, ~125s serial task work
per uncached sweep (upper-biased, pre-MimeType numbers). acp is the clean
first: 30 files, ~30s, zero consumers. False-zero mechanisms documented (check
before each deletion). → Recommend: delete all eight in the follow-up PR after
running r3's false-zero checks; note drivers may exist for planned features —
per-package keep/kill is a grill question.

## D. Gate value audit (r4; Q4/Q8)

- **dual-arity**: 79s/run to prove an EMPTY inventory. → scope to changed
  helpers + delete empty-ledger machinery. (Operator prior: chop entirely —
  r4 offers the middle path; grill decides.)
- **terse-effect**: 34.9s; r4 says keep-blocking-scoped (counts tonight's two
  flow-candidates as catches); operator prior says the catches were
  zero-correctness style at ~11 min/round-trip. Grill: delete vs
  demote-to-advisory-rewrite vs keep-scoped.
- **lint:markdown / cspell**: operator sees no benefit; r4 found sparse
  named-term catches for cspell (and tonight it caught one comment typo of
  ours, cost one 14-min verify). Grill: delete vs scope-to-changed +
  demote-to-advisory.
- effect-fn, native-runtime: real catches on record → keep, scope to changed.
- frozen-grant-set: security boundary, no catch evidence → keep scoped.
- Cross-cutting: EVERYTHING scoped-to-changed-files is the common lever.

## E. GritQL (r5; Q5)

Pilot: replace jsdoc-inventory's candidate-collection (the 230s pass) with a
grit scan; keep deterministic downstream analysis. Laws rewriters are partially
portable (syntax-level only; type-aware checks stay ts-morph).
→ Recommend: single pilot in follow-up, measure, then decide broader port.

## Standing follow-ups from the shipped PR (carry into the same grill)

Instrument-hygiene PR (timing fields, failedStepId, fallow envelope
mode-split, elapsedMs:0); lint-policy changed-scope; hosted changed-scope
docgen; CreatePackage/TsconfigSync consolidation onto repo-utils; gitleaks
image bump (unblocks [[allowlists]] + removes marker need); runner bumps
evidence-gated; Test Unit/Docgen week-watch.

## Proposed follow-up PR shape (grill confirms)

PR-A "gates diet": D decisions + dual-arity/terse-effect/markdown/cspell +
scoped-to-changed lever + preflight wave (A1). PR-B "CI pipeline": B options +
gitleaks image bump. PR-C "deletions": C's eight packages. PR-D "instruments":
hygiene + A2/A3. Grit pilot rides wherever its measurement lands.
