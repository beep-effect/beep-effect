# W3 brief — `etl_run4_fleet_corpus.py` (the `run4-fleet` Stage C pin)

Read `brief-common.md` first, then survey notes 01 (§1–§6 are the function-by-function map of R3B), 02 (§2 is the
W3 requirements checklist), 03 (§2 and §4 are the citation layer and the Queue D reader design), 05 (gates).
Then read R3B in full. Everything below is binding.

## Identity

- `OUTPUT_ROOTS = {"fleet": CORPUS_ROOT / "run4-fleet"}`; `manifest_schema("fleet") == "beep-ci-ops-run4-fleet-corpus/v1"`;
  `stage: C`; CLI `--refresh fleet`, `--dry-run-root DIR`. No synthetic root. Keep the `SYNTHETIC_LABELS` /
  `SYNTHETIC_SOURCE_LABELS` constants, the `<synthetic-checkout:…>` alias rule, and the `provenance:
  synthetic` vocabulary so run4 never mislabels run3b-synthetic rows it cross-references (graduation Ruling 8
  item 7: "synthetic labels retained"); organic rows carry `provenance: organic`.
- Refuse to run from a `<clone>/.claude/worktrees/<name>` checkout (R3B `fleet_root` would return the wrong root);
  `fleet_root` otherwise as R3B (`*-worktrees` parent → grandparent).

## Discovery (P1 Ruling 5)

`discover_checkouts()` returns sorted `(label, path, kind, layout)`:

1. `FLEET_ROOT.glob("beep-effect*")` directories with `.git`: label `<name>`, kind `clone` if `.git` is a
   directory else `linked-worktree`, layout `fleet-root`.
2. children of `FLEET_ROOT.glob("*-worktrees")` with `.git`: label `<parent>/<name>`, kind by the same `.git`
   test (today three nested `.git` directories exist there; they are `clone`), layout `worktrees-dir`.
3. NEW: `<clone>/.claude/worktrees/<name>` for every fleet-root clone: label
   `<clone>/.claude/worktrees/<name>`, kind by the `.git` test, layout `claude-worktrees`.
4. Public-origin filter, applied to every candidate before it gets a label: resolve the git directory from the
   filesystem only (`.git` directory → itself; `.git` file → `gitdir:` target resolved against the checkout →
   `commondir` file resolved against the git dir, else the git dir), read `<commondir>/config` as UTF-8 text,
   parse the `[remote "origin"]` section's `url =` line (INI-style; be tolerant of tabs/spaces), canonicalize
   (scp `git@host:owner/repo(.git)` or a URL; lowercase host; strip a trailing `.git` and slashes) and admit
   only `github.com/beep-effect/beep-effect`. Anything else — another repository, no origin, no config,
   unreadable — excludes the checkout; it gets NO label and no receipt beyond a count by reason in
   `checkout_counts.excluded {non_public_origin, missing_origin, unreadable_git_metadata}`. Today exactly one
   fleet-root clone is a private duplicate repository and must be excluded.
5. Every label passes `safe_relative_path`; file paths use `checkout_component(label)` (percent-encoded single
   component, so `/` becomes `%2F` and `.claude` never becomes a path segment).

`checkouts[]` receipts keep the R3B shape and add `layout`.

## Admission roots and live families

- `admission_sources()` as R3B (canonical `~/.beep/runtime/beep-admit-uid-<uid>`, system-tmp, session-tmp);
  record `admission_root_basis` text naming the three roots by label only.
- `LIVE_FAMILIES = ("leases", "queue", "claims", "quarantine", "promotions")`; `LIVE_SCHEMAS` adds
  `yeet-admission-promotion/v1` (cite its literal in `CLI/internal/repo-run/QualityScheduler.schemas.ts`, the
  `AdmissionPromotionTransition` class). Promotion objects nest `ticket` and `lease`, each with process identity
  members; the R3B `redact` mints one surrogate per nested object, so no change there — but TEST it.
- `quarantine` (P1 Ruling 5(4)): one NDJSON payload per root, `live/<root>/quarantine/state.ndjson`, rows in
  sorted filename order, each row one object as read from one file (lock names and symlinks excluded and
  counted as R3B does); the source receipt is the family receipt with `ndjson: true`, `files_observed`,
  `captured_files`, descriptor `<root-admission>/quarantine/<state-ndjson>` and the prose rule "row i is the
  i-th file in sorted filename order; filenames are never persisted" in `live_state_filename_policy`. A zero-file
  quarantine produces a status `absent`/`excluded` receipt and no payload, as R3B's zero-row rule does. The other
  four families keep the R3B one-file-per-object layout (`state-NNNN.json`).
- Journal `ring_window` caps and attempt caps: cite the retention constants from the capture tree (R3B's
  `admitted_retention`, `known_history_retention`, `terminal_attempt_retention` facts) rather than hard-coding
  200/2400/50 silently; if the constants moved, cite their new lines.
- Lease and ticket rows now carry `command`, `hotPaths`, `diffFingerprint`, `envProfile`, `proofTier`,
  `resolvedHeadSha`, `stage`, `startedAt`, `coordinationProtocol`, `blockedOnOriginAtMillis`; `hotPaths` are host
  paths and go through the host-root pass; `startedAt` is ISO with a timezone (`parse_timestamp_scalar` aborts
  otherwise). Add a test with such a row.
- Keep the heartbeat invariant hard check and the chain classifier (`classify_chain`, `CHAIN_CLASSES`,
  `loss_population`) unchanged.

## Attempts and the ledger existence receipt

- Per checkout, `.beep/yeet/runs/*/attempts.ndjson` as R3B (`validate_component(run.name)`, descriptor
  `<fleet>/<label>/.beep/yeet/runs/<run>/attempts.ndjson`, payload `attempts/<component>/<run>/attempts.ndjson`,
  writer-cap ring receipt). Expect roughly 460 attempt files and 7,900 rows today.
- `row["proof_ledger"]` per checkout stays an existence receipt (`present|absent`), reading no contents.
- Replace the R3B top-level `proof_ledger` block with:
  `{status: "captured by the run4-ledger sibling pin", sibling_root: run4-ledger, sibling_generator:
  etl_run4_proof_ledger.py, rulings: "graduation Ruling 1; P1 Rulings 1, 2, 3, 6", checkouts_with_ledger: <n>,
  observation_basis: "file existence only in this pin; contents are pinned by the sibling"}`. The
  `excluded_sources` list keeps "ledger family (contents pinned by run4-ledger)". `verify_census` checks this
  block's constant members.

## Join keys and facts

- `join_keys()` adds `parentLaneId` (graduation Ruling 8 item 5) and keeps `nonce`, `attemptId`, `claim`,
  `claim_filename`, `runId` (needle `export const repoRunArtifactId = Effect.fn(`), `originKey` (repo-grain 12-hex,
  kept verbatim: run-3 Ruling 5 and the snapshot addendum), `stepId`, `failedStepId`, `taskId`, `id` as the
  deployed set reads at the capture tree. The exact-set test must read the deployed set from the blob at
  `corpus_tree` and compare with an explicit allowlist constant, so a new writer field is a loud, named
  failure.
- `source_facts()` re-derived at the capture tree; add facts for `yeet-admission-journal/v3` (cite the class
  literals with `occurrence` where needed), the v3 `admission-lease-evicted` shape with `lastHeartbeatAtMillis`,
  and the promotion schema. Keep `known_losses()` with keyed receipts.
- Record docs cites for the rulings this pin applies: the graduation sitting heading in `PKT/DECISIONS.md`
  (`## 2026-10-01 — graduation sitting`), and the snapshot addendum lines. Do NOT cite the goal's
  `research/decisions.md` P1 sitting by `{file,line}` (it is not in `origin/main`'s tree yet); name it in prose
  (`rulings:` strings).

## Queue D input: the committed journal projection (graduation Ruling 1's docket clause, P1 note (c))

Constants: `SNAPSHOT_DIR = PACKET + "research/evidence/journal-snapshot-2026-10-01"`,
`SNAPSHOT_PROJECTION = "journal.redacted.ndjson"`, `SNAPSHOT_SUMS = "SHA256SUMS.txt"`,
`SNAPSHOT_SHA256 = "8cceaf17163669f5ec031624ebcffeeb8ea0c56281f2f1a29180ea7c04134762"`, `SNAPSHOT_ROWS = 695`,
`SNAPSHOT_CHECK = PACKET + "research/scripts/redact_journal_snapshot.py"`.

Capture (`read_queue_d_snapshot()`):

1. The projection must be a regular file (no symlink); parse SUMS with the `^([0-9a-f]{64})  (.+)$` rule.
2. `sha256(working-tree bytes) == SUMS entry == SNAPSHOT_SHA256`, and the blob at `corpus_tree` must be
   byte-equal to the working-tree bytes.
3. Run `[sys.executable, SNAPSHOT_CHECK, "--check"]` with `cwd = REPO_ROOT / PACKET`, timeout 120; rc must be 0;
   record `check: {command: "python research/scripts/redact_journal_snapshot.py --check", exit: 0,
   script_sha256: <sha256 of the script blob at corpus_tree>}`. Never print its stdout (it names local paths).
4. `decode_ndjson` + `validate_envelope(row, "admission")` on every row (all 695 pass today); run
   `scan_output_bytes` over the bytes; `classify_chain` per nonce in file order.
5. Any miss fails with a message containing "Queue D fails closed; no run3b-fleet fallback". There is no
   fallback code path at all (no reference to `run3b-fleet` as an input anywhere).

Manifest section `queue_d_inputs.journal_snapshot_2026_10_01`: `{path, sha256, sums_path, rows, events,
window: {min, max}, chain_counts, chains: [{nonce, classification, tags}], check, custody: "snapshot-salted
ownerRef/checkoutRef; not joinable to this capture's surrogates (per-capture salts)", joins: "nonce and
attemptId only"}`. The projection is NOT copied into the pin and is NOT an `admission_roots` entry.

Verify mode re-reads the projection from the `corpus_tree` blob by path, re-checks the sha256 against the
constant, recomputes `events`, `chain_counts` and `chains`, and compares with the manifest; it does NOT run
`--check` (that reads host state).

## Live re-census and cross-source reconciliation

Classify chains per source (the canonical live root; the snapshot), scoped by root and nonce as R3B does, and
emit `loss_population.reconciliation`: `{sources: [canonical, snapshot-2026-10-01], nonces_in_both, rows_identical_on_non_surrogate_members,
class_transitions: {"<snapshot class>->"<live class>": n}, conflicts: 0}`, where a conflict is the same
`(nonce, _tag)` row present in both with different non-surrogate members; `conflicts > 0` fails the capture
closed. Never classify a chain across sources, never join on `ownerRef`/`checkoutRef`.

## Tests (beyond the common list)

- discovery: fleet-root clone, `*-worktrees` lane, nested clone under `*-worktrees`, `.claude/worktrees` lane,
  a private-origin clone with runs (excluded, counted, no label in any emitted byte), a checkout with no origin,
  an unreadable config (permission denied) → excluded + counted; running from a `.claude/worktrees` checkout
  refuses.
- live families: promotions object with nested ticket and lease (two surrogates, no pid bytes), quarantine
  with three files + a lock decoy + a symlink → one ndjson payload, counts right, filenames absent from every
  emitted byte, ordinals recorded.
- Queue D: missing projection; sha mismatch against SUMS; sha mismatch against the constant; `--check` rc 1;
  wrong row count; a row with an unknown schema → each fails closed with the sentinel message; no fallback.
- reconciliation: overlap with identical rows passes; an overlap with a conflicting member fails.
- join keys: the deployed set at the fixture tree vs the allowlist; a new field is a named failure.

## Return

The structured return must include: generator path and sha256, test file path, the test command and counts,
the dry-run command and output line, dry-run totals (payload files, bytes, events, checkouts by kind and
layout, excluded counts by reason, chain counts live and snapshot, reconciliation counts), the residue
commands run on the dry-run root with empty output, and a "deviations from R3B" list.

## Addenda (critic pass, 2026-10-05 ~23:40Z) — binding

W3-A1. **Attribution fix.** "Synthetic labels retained" comes from the intake docket's Stage C clause and
       `PLAN.md` W3, not from graduation Ruling 8 item 7 (which is tree-pinned replay). Keep the behaviour.
W3-A2. **Origin filter, named tests.** (a) A linked worktree's git dir (`<clone>/.git/worktrees/<name>`) has NO
       `config`; read `<commondir>/config` and prove with a fixture that a linked worktree without a gitdir
       config is admitted. (b) 21 of 23 fleet origins are scp form `git@github.com:beep-effect/beep-effect.git`,
       one is https; canonicalize both and prove each is admitted. (c) The private clone's own `*-worktrees`
       lanes resolve to the private origin and are excluded; prove it. (d) A literal substring match on
       `github.com/beep-effect/beep-effect` without canonicalization is a bug: a test must fail it.
W3-A3. **Admission kind is not the proof stage.** `AdmissionWorkKind` `merged-preview` is written both by real
       `yeet verify --merged` admissions (`Handler.ts` `runWithMergedPreviewAdmission`) and by any full proof whose
       steps include the CI-parity step (`Handler.ts` `const kind = A.some(proofSteps, (step) => step.id === CI_PARITY_STEP_ID)`);
       the merged-preview STAGE is `attempt-started.stage` (`attemptStageFor`). Add a manifest prose member
       `admission_kind_note` saying exactly that with both citations, and a census block
       `attempt_starts_by_stage` `{repair-loop, pre-push, merged-preview, hosted}` × `{all, since_cut}` over the
       pinned attempt rows (cut = 2026-09-28T15:09:38Z on `startedAt`), plus `last_merged_preview_start` (the
       instant or null). This reproduces the P1 sitting's "three merged-preview starts, the last on 2026-09-09".
W3-A4. **Quarantine semantics.** The quarantine family receipt carries `family_semantics: "reaper-quarantined
       dead leases moved aside by the admission reaper; not live queue or lease state"` and a counts-only
       `mtime_days: {<YYYY-MM-DD>: n}` census (no names, no times finer than a day).
W3-A5. **hotPaths.** The sentence "hotPaths are host paths" is volatile: the live root currently has none
       absolute. The host-root pass still covers them; keep the test with an absolute fixture value. The members
       that DO carry host paths in live state are `checkoutRoot` and `command`.
W3-A6. **Window boundaries for W5.** For each admission root record `window: {first_retained_row_instant,
       last_retained_row_instant, released_only_chains (pre-v3 count), note: "ring-trimmed; released-only chains
       have no admitted pair in the retained window"}` so the P2 replay can skip them instead of failing.
