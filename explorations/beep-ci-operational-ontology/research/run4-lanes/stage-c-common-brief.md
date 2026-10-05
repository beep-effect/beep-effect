<!-- Lane brief as issued 2026-10-05 for the P1 Stage C capture; the survey notes it names live in the lane scratch, not in the repo. -->
# P1 Stage C capture — common implementation brief (W3 + W4)

Checkout: `~/YeeBois/projects/beep-effect8-s5` (branch `feat/ciops-p1-stage-c-capture`, a linked
worktree of `~/YeeBois/projects/beep-effect8`). Abbreviations:

- `PKT` = `explorations/beep-ci-operational-ontology`
- `CORPUS` = `PKT/ontology/extraction/s4/beep-ci-ops/corpus`
- `R3B` = `CORPUS/etl_run3b_fleet_corpus.py` (FROZEN, 1,591 lines) and `CORPUS/test_run3b_generator.py` (FROZEN)
- `CLI` = `packages/tooling/tool/cli/src`
- Survey notes (read them; they carry line-cited facts): `01-run3b-mechanics.md`, `02-rulings-docket.md`,
  `03-replay-snapshot.md`, `04-ledger-writer.md`, `05-repo-gates.md` in this directory.
- Binding rulings: `goals/ciops-ontology-pipeline/research/decisions.md` "2026-10-05 — P1 sitting" (Rulings 1–6 +
  orchestrator notes), the graduation sitting in `PKT/DECISIONS.md:1306-1604` (Rulings 1, 6, 7, 8, 10), run-3
  Rulings 11, 18, 22 (`PKT/DECISIONS.md:912-918`, `:989-1001`, `:1046-1064`).

## Hard rules for every lane

1. Never edit, move or delete any existing file under `PKT/ontology/extraction/**` (frozen pins and generators),
   nor any file outside the ones this brief names as yours. Never run `git add`, `git commit`, `git push`,
   `git checkout`, `git merge`, `git stash` or any other git state change; the orchestrator commits.
2. Never create the real pin roots `CORPUS/run4-fleet/` or `CORPUS/run4-ledger/`. All generator runs during
   development use `--dry-run-root <dir>` with a directory under your scratch dir
   (`<lane-scratch>/<lane>/`),
   never under the repository, never under `/tmp`. The orchestrator runs the real pin.
3. The repository is PUBLIC. Committed bytes may never contain host paths (`/home/...`, the fleet root,
   `~/...`, `-home-` markers), the login name, uids, hostnames or their sha12, pids, proc starts, session ids,
   lane-local temp paths, or credentials. Your own notes and return values must replace the home directory
   with `~` and must never quote a full `originKey`, a hostname, or a raw ledger/journal row.
4. Stdlib + PyYAML only. Copy helpers from R3B by hand (the docstring law: "Stage A and run-2 mechanics are
   copied, never imported or modified; each run-3 generator is standalone so its self-pin covers its full
   implementation"). Never `import` from any sibling generator. Where this brief says "copy unchanged", keep the
   function body byte-identical to R3B and say so in a module-level "Lineage" section; list every deviation
   there with its reason and ruling.
5. Python: run everything through `UV_CACHE_DIR=$HOME/.cache/beep/uv-cache ~/.local/bin/uv run --offline --with pyyaml python ...`
   or plain `python3` (pyyaml 6.0.3 with CSafeLoader is importable in this shell). Never write `~` inside a
   quoted `UV_CACHE_DIR`. Run unittest with `-p <your test file>` only; never discover without `-p` (the frozen
   suites are red by ruling).
6. Never print secrets or `OP_*` values. Never run `bun install`, builds, or the TypeScript test suites.
7. The capturing shell's `TMPDIR` is a home-nested directory; the generators must not persist that path. Record
   the temp basis as a label (`<session-tmp>`), as R3B does.
8. Shell is zsh. `$VAR` does not word-split; use arrays or `${=VAR}`.

## Shared design (both generators)

### Files and roots

| | W3 | W4 |
| --- | --- | --- |
| generator | `CORPUS/etl_run4_fleet_corpus.py` | `CORPUS/etl_run4_proof_ledger.py` |
| tests | `CORPUS/test_run4_fleet_generator.py` | `CORPUS/test_run4_proof_ledger.py` |
| root | `CORPUS/run4-fleet/` | `CORPUS/run4-ledger/` |
| manifest schema | `beep-ci-ops-run4-fleet-corpus/v1` | `beep-ci-ops-run4-ledger-corpus/v1` |

`biome.jsonc` already excludes both roots (committed). The roots are not git-ignored; no emitted path may contain
a `.beep`, `.claude`, `docs`, `tmp`, `dist`, `build`, `coverage` segment or a `*.key/*.pem/...` name
(`.gitignore` swallows them silently; see note 05 §3.7). Flatten paths and percent-encode labels with the R3B
`checkout_component` rule.

### Lifecycle (copy the R3B shape)

- First successful run pins (capture → finish_manifest → residue scan → `write_staged_capture` with the
  `.<root>-stage-*` temp dir inside `CORPUS/`, full `verify_output_tree` on the staged bytes, atomic swap,
  `.<root>-previous` backup refused if present).
- An ordinary rerun with the root present verifies only (no fleet reads, no salt, no `os.urandom`; git is
  allowed ONLY for `cat-file`/`rev-parse`/`merge-base --is-ancestor` against recorded object ids — see
  citations). Exit 0 on PASS, 1 on any failure, with one actionable message that never echoes residue bytes.
- `--refresh fleet` (W3) / `--refresh ledger` (W4) recaptures deliberately.
- NEW `--dry-run-root DIR`: capture and fully verify into `DIR/<root-name>/` (DIR must be an absolute path
  outside `REPO_ROOT`; refuse otherwise), never touching `CORPUS/`. The manifest written in a dry run must be
  byte-identical in shape to a real pin (no "dry-run" marker inside the manifest; the location differs only).
- Self-pin: `generator_sha256 = sha256(SCRIPT bytes)` written at capture and checked at verify
  ("generator digest differs from pin; use --refresh deliberately").
- Output: one JSON line `{"verification":"PASS", "<population>": {status, payload_files, files_emitted, events,
  payload_bytes, bytes_emitted}}` plus, on verify, `advisories: {...}` counts.

### Manifest (R3B key order, then additions)

Header comments: `# GENERATED by <script>; do not hand-edit.` and
`# Public run-4 Stage C capture; source descriptors are portable.`; dump with
`yaml.safe_dump(sort_keys=False, allow_unicode=True, width=100)`.

Keys in order: `schema_version`, `generated_by`, `generator_sha256`, `generator_lineage` (list of
`{generator: etl_run3b_fleet_corpus.py, sha256: <its sha256 at corpus_tree, computed from the blob>, relation:
"patterns copied, nothing imported (Stage B Ruling 18)"}`), `corpus_commit`, `corpus_tree`, `corpus_base`,
`corpus_ref: origin/main`, `capture_head` (full sha of the capturing checkout's HEAD), `citation_replay`
(the sentence: "tree-pinned against corpus_tree (graduation Ruling 8, P1 Ruling 4); current-tree resolution
advisory"), `capture_instant`, `capture_finished_at`, `stage: C`, `provenance: organic`,
`capture_instant_basis`, `custody` (R3B block verbatim with this capture's counts), then the
population-specific blocks (see each brief), then `projection_rules`, `redaction_rules`, `files`, `integrity`,
`verification`, `totals`.

Manifest prose rules: no `/home`, `~/`, `-home-`, hostname, login name; no space followed by `/` (R3B verify
refuses it: `(?:^|[ \t:'"])/(?!/)`); keep every repository citation as a `{file, line, needle, sha256}` dict
and every fleet descriptor as a `{file: "<...>", line: 1}` dict (angle-bracket first char), because
`PKT/research/scripts/verify_run3_citations.py` treats any other `{file, line}` dict as a repository citation.

### Tree-pinned citations (graduation Ruling 8, P1 Ruling 4)

Capture:

1. `git()` wrapper: `["git", "--no-optional-locks", "--no-replace-objects", "--no-lazy-fetch", "-C", REPO_ROOT, *args]`
   with a scrubbed env (drop `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_OBJECT_DIRECTORY`,
   `GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_NAMESPACE`, `GIT_REPLACE_REF_BASE`), `capture_output=True`,
   timeout 60, stderr withheld from messages. Never `git fetch`.
2. `corpus_commit = rev-parse --verify refs/remotes/origin/main^{commit}`, `corpus_tree = rev-parse --verify
   refs/remotes/origin/main^{tree}`, `corpus_base = merge-base HEAD refs/remotes/origin/main`, `capture_head =
   rev-parse --verify HEAD^{commit}`; fail closed if `refs/remotes/origin/main` is absent. Probe these ONCE at
   the start of capture, before any observation read; reuse in `finish_manifest`.
3. `cite(file, needle, occurrence=None)`: read the blob with `git cat-file blob <corpus_tree>:<file>` (batch
   through one `git cat-file --batch` process if you like), decode UTF-8, find every line containing `needle`;
   zero matches fails ("source citation anchor missing"); more than one match fails ("source citation anchor
   ambiguous") unless `occurrence` (1-based) is given, in which case that match is used and `occurrence` is
   recorded in the citation dict; the working-tree file bytes must equal the blob bytes, else fail closed with
   "cited file differs from corpus_tree; merge origin/main into the capturing checkout". Emit
   `{file, line, needle, sha256: sha256(blob)}` (+ `occurrence`).
4. Every needle is re-derived against the capture tree. Do not copy R3B's `source_facts()`/`known_losses()`/
   `join_keys()` needles blindly: at least `pipe(branch, repoRunSafeArtifactName` is gone (use
   `export const repoRunArtifactId = Effect.fn(` in `CLI/internal/repo-run/RepoRunArtifacts.ts`), six R3B needles
   are ambiguous at HEAD (journal v1/v2 literals, the attempt-journal literal, `stayed busy; dropping one`,
   `evictedAtMillis: claimedAtMillis`, `recordedAt:`), so pick unambiguous needles or pass `occurrence`.
   Replace the positional `receipts[5]` lookup in R3B `known_losses()` with keyed access.

Verify (gating unless marked advisory):

- `cat-file -t <corpus_tree>` must print `tree`; otherwise fail and print the hint `git fetch origin
  <corpus_commit>`.
- If `corpus_commit` resolves locally, `rev-parse <corpus_commit>^{tree}` must equal `corpus_tree`; if it does not
  resolve, record an advisory.
- Every citation: blob present, line in range, needle on exactly that line, sha256 equals the blob digest.
- Advisory only (counts in the output JSON, never the exit code): citations resolved against the working tree
  (`REPO_ROOT / file`, `hashes=False`); `corpus_base` is an ancestor of `refs/remotes/origin/main`.
- Verify spawns no other subprocess and reads no fleet, export, snapshot raw payload or salt.

### Redaction, custody, residue (run-3 Rulings 11 and 22)

Copy from R3B unchanged: `host_prefixes`, `uri_host_root_pattern`, `redact_host_root`, `redact_pid_match`,
`redact_process_text`, `redact_string`, `normalized_member`, `process_member`, `owner_ref_census`,
`verify_owner_census`, `guard_origin`, `redact`, `scan_output_bytes` (then EXTEND it as below), `locked_name`,
`validate_component`, `checkout_component`, `safe_relative_path`, strict JSON helpers (`reject_json_constant`,
`unique_object`, `decode_json`, `decode_ndjson`, `same_json`, `encode_ndjson`, `encode_json`, `strict_object`),
the property projection (`render_property_scalar`, `eligible_property_pairs`, `encode_properties_projection`,
`projected_bytes`, `projection_path`), timestamps (`parse_timestamp_scalar`, `collect_timestamps`,
`format_timestamp`, `timestamp_bounds`), `instant`, `complete`, `Payload`, `record_observations`,
`verify_fields`, `payload_pair`, `event_census`, `write_staged_capture` (renamed roots), and the verify skeleton
(`verify_output_tree`: symlink refusal, inventory equality, per-file sha256/bytes, projection recompute,
redact idempotence with `preserve_origins=True`, owner census, residue scan, generator digest, schema/stage
identity).

Extend `scan_output_bytes` (document each addition in the Lineage section):

- the `-home-` marker and a bare `~/` (knowledge-refs gate classes; note 05 §3.4);
- the login name (`pwd.getpwuid(os.getuid()).pw_name`), and its sanitized forms `home_<user>` and `<user>_`
  (branch names reach `runId` sanitized);
- an exact-bytes deny list built at capture from every raw host path the capture saw (`FLEET_ROOT`, every
  checkout root, every raw `originKey`/`checkoutRoot`, `Path.home()`, `tempfile.gettempdir()`); the deny list
  is never persisted;
- fix the R3B `sk-` credential regex so it needs a boundary before `sk-` (it matched `task` inside long
  filenames; `PKT/research/OPPORTUNITIES.md:614-623`).

The per-capture salt is `os.urandom(32)`, never persisted; `custody.salt_policy` stays "per-capture,
unrecorded, unlinkable across captures".

### Tests

One `unittest` file per generator, loaded by `importlib.util.spec_from_file_location` as R3B's tests do. Build
every fixture at runtime (no committed fixtures; no literal credential-looking strings in the test source —
construct them with concatenation at runtime, see `PKT/research/OPPORTUNITIES.md:319-326`). Fixtures live under
a `tempfile.TemporaryDirectory(dir=<your scratch dir>)`, never `/tmp`, never inside the repo. Patch
`OUTPUT_ROOTS`, discovery, admission roots, `git`/citation functions and `os.urandom` exactly the way
`test_run3b_generator.py` `PinContractTests.setUp` does, so no test touches the live fleet or the real roots.

Re-prove every `RedactionTests` behaviour from the run3b suite that your copied helpers carry (retarget at your
module), the residue classes without echo, the pin contract (first pin, verify-only rerun, refresh replaces only
its root, corruption and same-length census mutation fail the verify CLI, unlisted file fails inventory,
coherent variant rewrite rejected, verify spawns nothing but the allowed git plumbing), plus the tree-pinned
citation tests in a fixture git repo (cite; edit and commit the cited file; verify passes with an advisory
count; tamper with line/needle/sha in the manifest → fail; missing tree object → fail with the fetch hint;
`corpus_commit` root tree mismatch → fail), plus the lane-specific tests in each brief.

Report in your structured return: the exact test command, counts (tests run / failures / errors), the dry-run
command and its output JSON line, the dry-run root's file count and manifest byte size, and the residue
commands you ran on the dry-run root with their (empty) output.
