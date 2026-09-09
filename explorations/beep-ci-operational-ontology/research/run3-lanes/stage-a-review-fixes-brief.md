# Run-3 lane brief — Stage A PR review fixes (PR #1027)

Lane: Codex (`gpt-6-astra`, xhigh). Orchestrator: Fable. Checkout: this one
(`beep-effect8-s5`, branch `ontology-run3-stage-a`, head `c00126704c`). Read
`stage-a-brief.md` and `stage-a-report.md` first. Four Codex-connector findings are open on
the PR; Fable's read is that all four hold. Verify each against the code and the committed
tree (refute with evidence if wrong), fix what holds, re-pin, prove, commit. This lane MAY
commit (git common dir writable, network on). **Do not push; do not touch the PR.**
Fable pushes immediately after your commit.

Every fix below changes a generator, so both generators' sha256 pins move and BOTH corpora
must be re-captured with `--refresh` (new salt, new instants). Do that once, at the end,
after all generator changes; then run the ordinary verify twice.

## Finding 1 (P1) — the identity pin is incomplete in git

`run3-checkout-identity/MANIFEST.yaml` lists 220 payloads; only 190 are committed. The
missing 30 live under nested `.claude/…` or `.beep/…` path segments (bindings for
checkouts such as `beep-effect8/.claude/worktrees/<name>` and
`beep-effect12-pr874/.beep/yeet/merged-preview-owner-0001`) — `.gitignore` swallows those
directories, so `git add <pin dir>` silently skipped them and a fresh clone fails
`payload inventory differs from manifest`.

Fix in `etl_run3_checkout_identity.py`: emit every payload under a path-safe, single-segment
file name derived from the label (e.g. replace `/` with `__` and keep the label verbatim in
the manifest row as `checkout:`), so no emitted path contains an ignored directory segment.
Do NOT `git add -f` ignored files. Check `etl_run3_fleet_corpus.py` for the same hazard
(any checkout label containing `.claude/` or `.beep/` segments) and apply the same rule.
Prove it the strong way: after re-pinning and committing, create a detached throwaway
worktree of HEAD (`git worktree add --detach <scratch> HEAD`), run both generators there in
ordinary verify mode (they must PASS from the committed tree alone), then remove the
worktree. Also assert `git ls-files <pin> | wc -l` equals the manifest's file count for both
pins.

## Finding 2 (P1) — verification must recompute receipt bounds

`etl_run3_fleet_corpus.py` (~`:604`, `verify_census`): verification recomputes totals and
compares row/event counts, but never re-derives each receipt's `min_timestamp_observed` /
`max_timestamp_observed` (and any other per-receipt derived field) from the decoded pinned
payloads. A same-length manifest edit to those fields therefore verifies PASS. Mirror the
run-2 verifier (`etl_fleet_corpus.py` — read-only, copy the pattern): during verify,
recompute every derived receipt field from the pinned bytes and fail on any difference.
Apply the same standard to the identity generator's manifest (capture instant basis,
coverage counts, per-binding fields that are derivable from payloads). Add a synthetic
test in `test_run3_generators.py`: mutate one receipt timestamp in a pinned manifest
(same length) → verify exits non-zero; restore → PASS.

## Finding 3 (P2) — redact the runtime-directory prefix

17 committed NDJSON payloads in `run3-fleet` contain `/run/user/<uid>/beep-yeet-proof-locks-…`
inside attempt/verdict message strings (the hostname digest was rewritten to `<host>`, the
runtime prefix was not). Fix: rewrite the per-user runtime prefix (`/run/user/<uid>/`,
derived at run time from the effective uid — never a literal uid — plus `$XDG_RUNTIME_DIR`
if set) to `<runtime>/` in every string leaf of every family, and add that prefix (and the
bare `/run/user/` form) to the residue verifier's forbidden byte list in BOTH generators so a
survivor fails the run. Grep the pinned trees for any other machine-local prefix class you
can name (`/proc/`, `/dev/shm/`, systemd unit names embedding the uid) and treat them the
same way, reporting what you found.

## Finding 4 (P2) — stale whole-tree hashes in the report

`stage-a-report.md` still records the whole-tree hashes of the FIRST capture. After the final
re-pin, recompute both hashes with the documented method (sorted relative names + contents,
8-byte big-endian length framing) and replace them in the report; also refresh the
counts/instants in the report's "Refresh note" so it describes the committed pins. State in
the report which capture the manifest excerpts describe.

## Rules

Stdlib + PyYAML only; keep the generator invocation documented in the file docstring;
`etl_fleet_corpus.py`, `run2-fleet/`, `s5/`, `s6/`, `s7/` stay byte-identical (assert the
run-2 sha `2b6fb03d…7777e424` at the end). Never `git add -A` — stage the two generators,
the test file, both pin directories, and the report by path. Public repo: no absolute home
paths, hostnames, uids, or session ids in committed bytes; the residue verifier is the law.
Run the packet validator and the CQ suite once at the end. Add a friction receipt to
`research/OPPORTUNITIES.md` for the gitignore-swallowed payloads (what would have caught it:
the fresh-worktree verify you are adding).

## Report

Write `research/run3-lanes/stage-a-review-fixes-report.md`: per finding — verdict, fix,
proof; the fresh-worktree verify transcript summary; final counts per pin; residue-scan
proof; the commit SHA; and for each finding a one-paragraph reply Fable can post verbatim.
