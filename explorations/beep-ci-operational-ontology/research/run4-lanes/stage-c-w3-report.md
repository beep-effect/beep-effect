# Stage C lane report — W3 `run4-fleet` pin (2026-10-05/06)

Lane brief: `stage-c-w3-brief.md` (with `stage-c-common-brief.md`). Rulings: graduation Rulings 1,
6, 7, 8, 10; run-3 Rulings 2, 5, 11, 18, 22; P1 Rulings 1–8 and recorded calls a–t in
`goals/ciops-ontology-pipeline/research/decisions.md`. Deliverables: the generator
`ontology/extraction/s4/beep-ci-ops/corpus/etl_run4_fleet_corpus.py` (its module docstring carries
the Lineage section: every helper copied byte-identical from the run3b generator and every
deviation with its ruling), its tests `test_run4_fleet_generator.py`, and the pinned root
`corpus/run4-fleet/`.

## Build protocol

One implementer lane (Opus 5.5) wrote the generator and tests from the briefs and proved them with
a dry run into a lane scratch root (never the corpus home). Three refuting lenses reviewed it
(rulings and docket compliance; public-repo safety and residue; mechanics and verifiability), a
fixer applied every finding with a regression test each, and a skeptic re-checked each disposition.
Two such rounds ran before the 2026-10-06 build sitting; a third applied Rulings 3 (as amended), 7
and 8; a fourth, the last under the charter's round cap, closed the remaining majors.

| Round | Tests | Findings in | Fixed | Deferred to the sitting | Remaining after the skeptic |
| --- | --- | --- | --- | --- | --- |
| implementer | 58 | — | — | — | — |
| review 1 | — | 33 (8 blocker, 10 major, 15 minor) | — | — | — |
| fix 1 / skeptic 1 | 82 | — | 26 | 2 | 6 |
| fix 2 / skeptic 2 | 87 | — | 2 | 0 | 3 |
| fix 3 / skeptic 3 (sitting rulings) | 89 | — | all task items | — | 1 major (prose test), 5 minor |
| fix 4 / skeptic 4 (final) | 95 | — | 5 task items | — | 0 major, 2 minor (follow-ups) |

Findings that became rulings: the 64-hex admission `originKey` that trips the hosted Secret
Scanning rule (Ruling 7); the prefix width (Ruling 3 amendment). Findings that became recorded
calls: the review bot's sight (call n), the attempt-start census basis (call r), the `-home-`
marker rule (call s).

## What the generator pins

Admission roots (canonical, system-tmp, session-tmp) with the journal, protocol marker and the
live families `leases`, `queue`, `claims`, `quarantine` (one NDJSON payload per root, filenames
never persisted, `family_semantics` and a counts-only `mtime_days` census) and `promotions`;
every admitted checkout's attempt journals under `attempts/<label>/<run>/`; the Queue D snapshot
projection by path and sha256 with a recomputed census and a cross-source reconciliation receipt;
tree-pinned citations against the fetched `origin/main` tree (`corpus_commit`, `corpus_tree`,
`corpus_base`, `corpus_ref`, `capture_head`); the attempt-start census by stage with
`last_merged_preview_start`; per-root window boundaries for the P2 replay; the join-key census
against an explicit allowlist; `origin_key_shapes` with the 11-hex prefix receipt; the ledger
existence receipt that points at the `run4-ledger` sibling.

Discovery applies the public-origin filter (only `github.com/beep-effect/beep-effect`, read from
the common dir's config as text), adds `<clone>/.claude/worktrees/<name>` checkouts and nested
clones under a `*-worktrees` directory, and refuses to run from a Claude-app worktree.

## Pin census (capture 2026-10-06T03:19:28Z to 03:19:45Z, corpus_commit `26269bb0ec`, tree `edc79dd7b6`, capture head `28d962ec6b`)

- 937 files (936 payloads: 465 attempt journals, 468 `.properties` projections, 1 admission journal, 1
  protocol marker, 1 live payload), 11,179 events, 24,249,663 payload bytes, manifest 1,907,866 bytes.
- Checkouts admitted: 260 (25 clones, 235 linked worktrees; layouts fleet-root 34, worktrees-dir 206,
  claude-worktrees 20); excluded 4 as non-public origin (the duplicate clone and its three lanes); 718
  attempt-source receipts, 465 present (8,421 attempt rows); 22 checkouts carry a ledger file
  (existence only; contents in `run4-ledger`).
- Admission roots: canonical present (689 journal rows: v1 `admission-admitted` 200; v3 enqueued 243,
  released 199, withdrawn 44, lease-evicted 2, ticket-evicted 1; protocol v2), system-tmp absent (the
  capturing shell's temp dir was the system one, so the session-tmp root coincides with it). Live
  families: leases 0, queue 0, claims 0, promotions 0, quarantine 2,068 dead leases as one NDJSON
  payload (mtime days 2026-09-16: 1,829; 2026-09-22: 239; custody 4,136 surrogates, 2,068 without a
  start).
- Custody variants over the pin: pid_pair 2,757, ownerpid 975, attachedpid 2,068, weak 0; owner
  census bound to the pinned bytes.
- Chains (canonical): win 196, withdrawn 44, lease-evicted 2, ticket-evicted 1, in-flight 0, pre-v3 3
  (`released_only_chains` 3; window 2026-10-01T09:32:09Z to 2026-10-06T01:51:50Z). Queue D snapshot
  projection: 695 rows, sha256 `8cceaf171636…`, `--check` exit 0; chains win 197, withdrawn 46,
  ticket-evicted 1, in-flight 5, pre-v3 2. Reconciliation: 22 nonces in both, 53 rows identical on
  non-surrogate members, 0 conflicts; transitions in-flight→win 5, win→pre-v3 3, win→win 13,
  withdrawn→withdrawn 1.
- Attempt starts by stage (capture-time census over ring buffers, cut 2026-09-28T15:09:38Z): pre-push
  987 (110 since the cut), repair-loop 67 (5), merged-preview 3 (0; last start
  2026-09-09T03:41:38Z), hosted 0,
  stage member absent 3,200 (rows written before the stage field shipped).
- `origin_key_shapes`: hex12 2,433, hex11_prefix 12 (one distinct 64-hex value, P1 Ruling 7),
  hex64 0, empty 110, journal rows without the member 202. Citations: 70 tree-pinned, 0 current-tree
  advisories. Join keys at the capture tree: attemptId, failedStepId, id, parentLaneId, runId,
  stepId, taskId (process identities pid, ownerPid as custody members).

## Gates run on the pinned tree

- Ordinary verify of the pinned root: PASS (`status: verified`), twice (before and after the commit).
- Serial corruption proof: a flipped payload byte and a same-length `payload_files` mutation each
  fail verify; restored tree verifies; whole-tree hash equal before and after.
- Residue: the generator's own scan at capture and verify; a count-only scan over all 956 pinned
  files of both roots (home path, fleet root, temp dir, hostname and its sha12, login name and its
  sanitized forms, uid and unit names, `/home/`, `/tmp/`, `/run/user`, `/proc/`, `/dev/shm`, `~/`,
  the component-leading `-home-` marker, process members, `merged-preview-N`, lease/ticket pid
  filenames): 0 in every class; the Stage B grep and rg lines: empty.
- gitleaks `dir` over the root with the PR's `.gitleaks.toml` and with `origin/main`'s (byte-equal):
  0 findings each.
- Discovery parity with `run4-ledger` (recorded call q): 40 ledger origin labels, 9 match a pinned
  checkout, 31 are retired lanes gone at capture, 0 present under the fleet root but missing.
- Committed bytes equal the verified working tree; `git ls-files` inventory equals the manifest
  (937 files, 0 missing, 0 extra); no path is matched by `.gitignore`; no symlink, CR byte or
  swallowed segment.
- Packet validators (base, `--s5`, `--s6`): 0 blockers, 0 warns; CQ suite 0 failures (25 seed tests,
  20 fixtures); `verify_run3_citations.py` 0/0/0; `redact_journal_snapshot.py --check` PASS;
  `goals doctor` no findings for this packet; `goals index --check`, `explore atlas --check`,
  `laws effect-imports --mode markdown --check`, `knowledge semantic-delta` green; `knowledge refs
  --check` reports 21 live observations, all in other packets' files (inherited from main), 0 in the
  P1 files.

## Follow-ups (tracked, not blocking the pin)

- `window.released_only_chains` counts the whole pre-v3 class; the note states that exactly, but a
  rename (for example `pre_v3_chains`) changes the manifest shape and the P2 replay contract, so it
  waits for a ruling.
- The `-home-` scan matches only a component-leading marker, so a percent-encoded payload path with
  `%2F-home-x` passes on its own; the same label is emitted verbatim in `checkouts[]` and fails
  closed there (tested). A later change that stopped emitting the verbatim label would need the
  scan to decode `%2F` first.
