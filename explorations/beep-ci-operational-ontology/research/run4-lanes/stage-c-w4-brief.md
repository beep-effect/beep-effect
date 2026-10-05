# W4 brief — `etl_run4_proof_ledger.py` (the `run4-ledger` proof-ledger capture)

Read `brief-common.md` first, then survey note 04 in full (it is the field-by-field model of the ledger, the
join rules, the redaction plan, the census spec and the owning-clone resolver), note 02 §3 (the W4 checklist),
note 05 §3.2 (gitleaks), and R3B for the helpers you copy. Everything below is binding.

## Identity

- `OUTPUT_ROOTS = {"ledger": CORPUS_ROOT / "run4-ledger"}`; `manifest_schema("ledger") ==
  "beep-ci-ops-run4-ledger-corpus/v1"`; `stage: C`; `provenance: organic`; CLI `--refresh ledger`,
  `--dry-run-root DIR`.
- Reads the ledger as a document only: never imports repo-cli, never writes through the ledger, never edits
  `.beep/yeet/proof-ledger.ndjson` (graduation Ruling 3 boundary).

## The gate (graduation Ruling 1 as amended by P1 Ruling 1)

Before any payload is staged, compute the gate and record it as `gate:`:

- `c4_1`: cite `goals/time-to-certainty/PLAN.md` at `corpus_tree` with needle `C4.1 shadow mode — done 2026-09-21`
  (tree-pinned citation dict); the line must start with `  - [x]`; otherwise `c4_1_checked: false`.
- `cut`: `{instant: "2026-09-28T15:09:38Z", source: "committer instant of 9d52d8f587 (#1321)", predicate:
  "recordedAt >= cut"}`. At capture, if `9d52d8f587` resolves locally, assert `git show -s --format=%cI
  9d52d8f587` converts to that instant (advisory if it does not resolve).
- `post_cut_pre_push_facts`: the count across every owning-clone ledger read.
- `holds = c4_1_checked and post_cut_pre_push_facts > 0`.
- If `holds` is false: write NOTHING, print one JSON line `{"verification":"GATE","ledger":{"status":"census
  recorded; pin lane stopped", ...stage_census...}}` and exit 3. The orchestrator records that census.

## Discovery and owning-clone resolution (P1 Ruling 2; time-to-certainty ruling 71)

1. Discover checkouts exactly as W3 does (fleet-root `beep-effect*`, `*-worktrees/*`, `<clone>/.claude/worktrees/*`,
   the public-origin filter with counts by reason, no label for excluded ones). Copy that code; do not import.
2. `owning_clone(checkout)` mirrors `CLI/commands/Yeet/internal/ArtifactPaths.ts:336-372` (note 04 §9): lexical
   `abspath`/`normpath` (never `realpath`), `.git` absent → the checkout; `.git` not a file → the checkout;
   `.git` file → `gitdir:` line (missing → fail closed) → `commondir` file if present → owner is
   `common.parent` when `common.name == ".git"`, else the common dir itself (bare/separated).
3. Owner set = `{owning_clone(c) for c in discovered}` deduplicated; admit an owner only if `owner/.git` is a
   directory, or it is a bare/separated common dir (`owner.name != ".git"`, `owner/HEAD` is a file,
   `owner/objects` is a dir); assert `not (owner/.git).is_file()`.
4. For each owner read EXACTLY ONE path, `owner/.beep/yeet/proof-ledger.ndjson`: assert no symlinked component
   (`os.path.realpath(p) == str(p)`), open with `O_RDONLY | O_NOFOLLOW`, read the bytes once, record sha256 and
   byte length of the raw file (these are safe: digests of local bytes). A missing file → the owner is
   recorded with `ledger: absent` (not an error).
5. Never `glob`, `iterdir`, `scandir` or `os.walk` under any `.beep` directory, and never open any path under a
   linked worktree's `.beep/`. The lane ledgers that exist under `*-worktrees/*/.beep/` enter the manifest only as
   a count from `os.path.lexists(<lane>/.beep/yeet/proof-ledger.ndjson)` (`lane_ledgers_present_not_read`).
   Encode this as an assertion in tests (patch `os.scandir`/`Path.iterdir`/`glob` to raise when called with a
   path containing `/.beep`).

Labels: an owner's label is its fleet-root directory name (`beep-effect2`) or `<parent>/<name>` for a nested
clone; payload path `ledgers/<checkout_component(label)>/proof-ledger.ndjson` plus its `.properties` sibling.
Never emit a `.beep` segment.

## Decode (fail closed; stricter than the TypeScript reader, note 04 §4c)

Per owner: split on `\n`; an unterminated tail is excluded and its byte count recorded; empty lines counted;
each terminated line must be strict UTF-8 JSON (R3B `decode_json` semantics; duplicate keys refused). A
terminated line that is not JSON is a torn row: tallied (`torn_rows`), excluded, never echoed. A line that IS
JSON but fails any rule below is schema drift and fails the capture closed (message names the owner label and
line ordinal only).

Rules: envelope object; `kind ∈ {fact, shadow}`; `schemaVersion == "proof-fact/v1"` (and `fact.schemaVersion`
for facts); EXACT key sets at every level —
fact envelope `{kind, schemaVersion, fact}`; `fact` `{schemaVersion, key, epoch, outcome, durationMs, provenance,
recordedAt, expiresAt}`; `key` `{laneId, laneClass, commandDigest, envProfile, inputDigest, inputSource,
epochDigest, key}`; `epoch` `{lockfileDigest, bunVersion, nodeVersion, rootTurboConfigDigest,
rootTsconfigDigest, policyPackVersion, digest}`; `provenance` `{runId, attemptId, originKey, tier, stage,
headSha, hostedRunId}`; shadow `{kind, schemaVersion, attemptId, laneId, branch, stage, envProfile, decision,
observed, durationMs, recordedAt}`; `decision` `{kind: hit, key, factRecordedAt}` or `{kind: miss, key, reason}` —
literals from the deployed schemas (`ProofOutcome`, `ProofStage` = repair-loop|pre-push|merged-preview|hosted,
`YeetProofTier`, `ProofEnvProfile`, `CiLaneClass`, `ProofInputSource`, `ProofMissReason`), every NonEmptyString
non-empty, `durationMs` int/float (not bool) finite ≥ 0, `hostedRunId` null or non-empty string, `recordedAt`/
`expiresAt`/`factRecordedAt` parse as UTC ISO-8601 with `Z`. Cite each vocabulary's defining line (tree-pinned)
in `source_facts`.

Pairing: the shadow row at ordinal i must be followed by its fact at i+1 with the eight equalities of note 04
§6a; a violation fails the capture closed. Row id = `(label, line ordinal)`.

## Projection rules (P1 Rulings 3 and 6; orchestrator note (d))

Applied to every row, in this order, then `redact()` (custody) and the residue scan:

1. `provenance.originKey` → `<fleet>/<label>` through the label function of note 04 §7: relative to
   `FLEET_ROOT` (outside → fail closed), kinds `clone-root` (equals the owning clone), `fleet-root-checkout`,
   `lane` (`<x>-worktrees/<name>`), `claude-worktree` (`<clone>/.claude/worktrees/<name>`), `merged-preview`
   (`.../.beep/yeet/merged-preview-<n>` → `<base-label>/.beep/yeet/merged-preview-<process>`); every component
   passes `safe_relative_path`/`validate_component`; the mapping table (raw → label) is never persisted; emit
   `origin_kinds` counts. Never emit any digest of the raw `originKey` (the path-hash oracle, note 04 Risk 1).
2. `fact.key.key` and `decision.key` → first 12 hex characters (P1 Ruling 3). Assert injectivity over the union
   of every 64-hex key seen in the capture (two distinct keys with one prefix → fail closed). Record
   `projection_rules` entries: "reuse key members `fact.key.key` and `decision.key` pinned as 12-hex prefixes
   (P1 Ruling 3); every other digest verbatim" and "originKey mapped to `<fleet>/<label>` (P1 note d)".
3. Every other member verbatim (`runId`, `branch`, `attemptId`, `headSha`, `laneId`, the 64-hex digests,
   `epoch.*`, timestamps, `durationMs`, `hostedRunId`, literals). Then run the copied `redact(row, salt, counts)`
   (custody path; `owner_refs` is expected to be 0 today, the path must still run) and `redact_string` as a
   defense layer, and ASSERT that no member other than the two projected above and `originKey` changed
   (a change means a new host-bearing member slipped in → fail closed).
4. Whole ledgers are pinned (P1 Ruling 6): every row from every owner, pre- and post-cut.

## Manifest blocks (after the common header; R3B shapes where they exist)

- `gate` (above), `cut`.
- `discovery`: `{checkouts, by_kind, by_layout, excluded (by reason, counts), owners_resolved,
  owners_bare_or_separated, owners_with_ledger, owners_without_ledger, lane_ledgers_present_not_read,
  lane_ledger_basis: "existence probe only; contents never read (P1 Ruling 2)"}`.
- `ledgers[]` per owner (absent owners included): `{checkout: <label>, ledger: present|absent, raw_bytes,
  raw_sha256, rows, facts, shadows, empty_lines, torn_rows, unterminated_tail_bytes, first_recorded_at,
  last_recorded_at, path (payload) , source: {file: "<fleet>/<label>/.beep/yeet/proof-ledger.ndjson", line: 1},
  complete_within, observed_at, world, status, history_outside_window}` — descriptor form as R3B.
- `census`: the YAML spec in note 04 §8 (`facts_by`, `shadows_by`, `stage_census` with ALL four `ProofStage`
  members and both sides, zeros kept, `merged-preview.reading: "dormant in capture window (P1 Ruling 1)"`,
  `vocabularies` with every schema literal and its count including zeros, `distinct`, `origin` kinds,
  `pairing`, `hits` {total, resolved_prior, prior_passed, cross_origin, same_attempt, disagreements, reading:
  "hypothetical would-reuse, never realized (graduation Ruling 1)"} — a hit resolves to the newest earlier fact
  in the SAME ledger with equal projected key and `recordedAt == factRecordedAt`; an unresolved hit is counted,
  not fatal), `join_coverage` {clone_origin_facts, lane_origin_facts, claude_worktree_origin_facts,
  merged_preview_origin_facts, origin_present_at_capture, origin_gone_at_capture, attempts_read_by_w4: 0,
  attempts_join_target: "run4-fleet attempts/<component>/<runId>/attempts.ndjson by attemptId"}, `time_range`,
  `residue` {owner_refs, owner_refs_by_variant, origin_keys_replaced, keys_projected, deny_list_hits: 0},
  `observation_basis` (the sentence from note 04 §8).
- `source_facts` with the citations table of note 04 §8 (tree-pinned, re-derived needles), plus
  `ProofLedger.ts` tolerant-reader cite and the `ProofStage` LiteralKit cite.
- `excluded_sources`: lane ledgers (never read), attempt journals (W3), lock files, symlinks.

`verify_census` recomputes every count from the pinned payload bytes and compares.

## Tests (beyond the common list)

Fixture fleet under a scratch temp dir: clone A (`.git` dir, ledger with pre- and post-cut rows, hit and miss
decisions, 5 repair-loop facts), clone B (no ledger → absent), a linked worktree of A with its OWN stale ledger
and attempts (must never be opened; patch `open`/`os.open` to raise on any path containing `/.beep/` under the
lane), a private-origin clone with a ledger (excluded; its label absent from every emitted byte), a
`.claude/worktrees` lane of A whose path appears as an `originKey` (label kind `claude-worktree`), a
merged-preview origin path (`merged-preview-<n>` → `<process>`), a bare common-dir case, a `.git` file without
`gitdir:` (fail). Rows built at runtime with sha256-generated hex64 keys and uuid4 ids. Cases: torn line
tallied; unterminated tail excluded; extra member → fail; unknown literal → fail; pairing violation → fail;
duplicate 12-hex prefix injected → fail; `originKey` outside the fleet → fail; gate false (no post-cut
pre-push fact) → exit 3 with the census line and nothing written; verify-only rerun; corruption → verify exit
1; the residue deny list catches a raw path smuggled into `branch`; `scan_output_bytes` catches the login
name; the exact key sets reject the TypeScript reader's "ignore unknown" behaviour.

## Return

The structured return must include: generator path and sha256, test path, test command and counts, the
dry-run command and its output line, dry-run totals (owners, present ledgers, rows, facts/shadows, post-cut
pre-push facts, stage census, hits resolved, keys projected, origin kinds), the residue commands run on the
dry-run root (empty output), a `gitleaks dir <dry-run-root> --config .gitleaks.toml --redact --no-banner`
result (0 findings expected; the binary is `/usr/bin/gitleaks`), and a "deviations from R3B" list.
