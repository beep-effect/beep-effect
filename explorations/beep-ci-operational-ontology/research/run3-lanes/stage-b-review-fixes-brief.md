# Run-3 lane brief — Stage B review fixes (PR #1034)

Lane: Codex (`gpt-6-astra`, xhigh) implementing; Fable judged the findings, reviews the
result, fast-forwards the PR branch, and publishes. Steward: Benjamin. Rulings in force:
**11** (custody surrogate), **18** (sibling generator), **19** (synthetic producer = the
repo-cli spec), **21** (two PRs, spec first).

**Status change:** PR #1034 was merged before these findings were addressed, so this lane
produces a FOLLOW-UP PR from `origin/main`, not a fix on the PR branch. Work happens ONLY in
`~/YeeBois/projects/beep-effect8-worktrees/stage-b-review-fixes` (branch
`ontology-run3-stage-b-fixes`, reset onto `origin/main`, which already contains the Stage B
pins, the generator, and the reports). Commit there (stage by path; never `git add -A`);
**never push, never open a PR**. Fable publishes. The only file you write outside the
worktree is the report (path below). The merged Stage A pin `run3-fleet/` carries the same
`ownerProcStart` residue (52 files); its remediation is a separate steward ruling — do NOT
touch `run3-fleet/` or `etl_run3_fleet_corpus.py`, only cite the fact in the report.

## Read first

- `research/run3-lanes/stage-b-brief.md` and `stage-b-report.md` (what was built and pinned).
- `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py` — the generator you
  are fixing; `test_run3b_generator.py` — extend it. The three older generators stay byte-frozen
  (shas in the Stage B brief).
- Deployed writers of process-identity fields (cite by needle): `packages/tooling/tool/cli/src/
  internal/repo-run/RunScope.schemas.ts` (`attachedPid: S.Int` inside lease `runScope`
  attachments), `commands/Yeet/internal/AttemptJournal.ts` and `internal/repo-run/
  AttemptTerminationJournal.ts` (`ownerProcStart`, `ownerPid` on attempt rows),
  `QualityScheduler.schemas.ts` (`pid`, `procStart` on tickets, leases, claims).

## Findings and verdicts (Codex connector review on PR #1034, 2026-09-09)

### F1 — HELD, P1 residue: process-identity variants survive redaction

Live fact in the committed `run3b-fleet/` pin: `attachedPid` in 4 files (live lease
`runScope` attachments), `ownerProcStart` in 60 files (attempt journals; values like
`proc:<n>` and bare numbers), `ownerPid` in 1. `process_member()` and the scan regex
(`"(?:pid|ppid|ownerPid|parentPid|processId|procStart|procStartTime)"\s*:`) enumerate names
and miss these. Required:

1. Replace the name list with a rule: a key is a process-identity member when its normalized
   form (`_`/`-` removed, lower-cased) ends with `pid` or contains `procstart` /
   `processstart`. Keep an explicit allowlist for non-identity keys that would otherwise
   match (none are known in the captured families; if you find one, list it with a source
   cite). Apply the rule in `process_member`, in the residue scan (JSON member form AND
   `.properties` projection lines, e.g. `ownerProcStart=`), and in `eligible_property_pairs`.
2. Custody (Ruling 11): mint `ownerRef` for every object that carries a process identity,
   from its own pair — precedence `pid`/`procStart`, then `ownerPid`/`ownerProcStart`, then
   `attachedPid`/`<absent>` — before the drop; tally each variant separately
   (`owner_refs_by_variant`) and keep the weak-key tally for pairs without a start identity.
   Nested objects mint their own (already the rule for claims).
3. Tests: a lease with `runScope.attachedPid`; an attempt row with `ownerPid` +
   `ownerProcStart`; residue positives for each variant in JSON and `.properties` form;
   negatives for benign words containing "pid" inside string VALUES (values are never
   dropped, only keys).
4. `--refresh fleet` (new capture, new salt) and `--refresh synthetic --synthetic-root
   ~/.cache/beep/ciops-synthetic-root` (READY present; `scenario.json` producer sha
   `0ee8d157ffce4a113ab1b2acc4e1c598a098f491c67850fd6071009dd9c5f983`, produced by PR #1033 head
   `717c37bf57`). After refresh: `grep -rlE 'attachedPid|ownerProcStart|ownerPid|"pid"'` over
   both pin dirs must be empty, and the manifests' custody section must describe the rule.

### F3 — HELD, portability: host roots matched without a left boundary

`redact_string` uses `value.replace(prefix + "/", …)` and `scan_output_bytes` uses substring
`prefix in combined`. With a fleet root such as `/workspace` (Codex Cloud checks out at
`/workspace/beep-effect`), the relative text `packages/workspace/use-cases/…` is rewritten
and then flagged, so verify mode fails there although tests pass. Required: anchor every
host-root match (redaction AND scan, including the literal `b"/home/"`, `b"/tmp/"` entries —
`packages/home/` is the same trap) at a left boundary: start of string, or a preceding
character that cannot continue a path (`[^A-Za-z0-9_.~/-]`). Tests: with a monkeypatched
fleet root `/workspace`, `packages/workspace/use-cases/x.test.ts` survives redaction and
passes the scan; `/workspace/beep-effect/x` is rewritten to `<fleet>/beep-effect/x` and, if
left raw, fails the scan; same for `/home/x` versus `packages/home/x`.

### F4 — HELD, evidence completeness: synthetic import accepts missing attempt journals

The `glob("*/attempts.ndjson")` contributes nothing when a journal is absent, and the later
checks validate only admission tags and chains. Required: the synthetic import REQUIRES
exactly one `attempts.ndjson` for `dead-lease` and for `dead-ticket`; each holds exactly
one `attempt-terminated` row whose `reason` is `lease-eviction` / `queued-submitter-death`
and whose `attemptId` equals the `attemptId` on the matching `admission-lease-evicted` /
`admission-ticket-evicted` row; `contender-a` keeps its empty-receipt semantics. Record a
`termination_join` receipt (per label: journal path, attemptId match, reason) in the
synthetic manifest and recompute it in verify mode. Tests: missing journal → fail;
mismatched attemptId → fail; wrong reason → fail; happy path passes.

### F2 — NOT A DEFECT (recorded, no lane action): producer absent from this tree

Ruling 21 lands the producer spec in PR #1033, which is still open. This follow-up PR
refreshes the synthetic pin from the export produced by #1033's current head so the recorded
sha matches the spec bytes that will merge; Fable re-runs the refresh if #1033 changes again
before it lands. Cite this in the report; do not vendor the spec.

## Packet bookkeeping

- `stage-b-report.md`: append `## Review fixes (2026-09-09)` — per finding: verdict, the
  change, the test, the new pin counts and whole-tree hashes, the refreshed census, the
  producer sha, and the residue proof commands with their empty output.
- `README.md` Trail and `ops/manifest.json` run-3 line: refresh the counts if they moved.
- `research/OPPORTUNITIES.md`: one receipt — the redaction allowlist drifted behind the
  writers' field names; prevention: rule-based member detection plus a test that greps the
  deployed schemas for `Pid`/`ProcStart` names and asserts each is covered.
- Do not edit `DECISIONS.md`, `ATLAS.md`, the frozen generators, or the frozen pins.

## Verification before handoff

1. `test_run3b_generator.py` green (all existing + new tests).
2. Both pins: refresh → ordinary verify exit 0 → corrupted byte fails → restore → exit 0.
3. Residue scans zero over both pin dirs, including the new variant patterns; frozen shas
   unchanged; `git status` clean under frozen paths.
4. Detached-worktree verify at the committed HEAD (trusted-lane Python; compare `git ls-files`
   payload counts with the manifests).
5. Packet validator + CQ suite green; `bun run beep knowledge refs --check` after commit.

## Report and commit

Report: `explorations/beep-ci-operational-ontology/research/run3-lanes/stage-b-review-fixes-report.md` (in this worktree; commit it with the fix)
— the same sections as the report appendix above, plus every deviation with reasons and the
commit SHA(s). Commit message:
`fix(explorations): redact process-identity variants and harden the Stage B pins`, body
lines under 100 characters. Stage by path; never push.
