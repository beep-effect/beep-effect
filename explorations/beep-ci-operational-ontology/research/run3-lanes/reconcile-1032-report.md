# Run-3 reconciliation with #1032

## Scope and merge

The lane started clean at `05a8f2ed48ca2968d399d164f2c431d740416496` on
`ontology-run3-stage-b-fixes`, in the requested `stage-b-review-fixes` worktree.
The fetched main was `6b4720f1fbe2e93799aad81ed43243e22d3e9d20`: #1035, #1033,
and #1032 had landed after the original `86990e28f9` base. SSH fetch failed on
system proxy-configuration permissions; a command-scoped HTTPS fetch succeeded.
No SSH configuration or remote setting changed.

Merge commit: `5e02f8c04b2448fe4ff49bab4e898841b481c0e5`.

```text
chore(explorations): merge main into the run-3 residue follow-up after #1032
```

Its parents are the starting branch head and the fetched main head above.
The two amended fleet generators retain #1032's exact widened `PID_IN_TEXT`
and `redact_pid_match`, together with normalized member detection, object-local
custody, bounded host roots, fleet discovery, synthetic termination joins, and
Stage A lineage. The structural property scanner retains this branch's key-aware
implementation: it already permits safe embedded redacted JSON values and passes
#1032's added property regressions. Both test suites are the union of both parents.
The repair script's history/provenance and `--source-ref` machinery remains present.

The run-2 and checkout-identity generators and complete pin trees equal main
byte-for-byte. The other three pin trees were resolved from our first parent to
complete the merge, then refreshed under the combined generators. `DECISIONS.md`
is byte-identical to the starting head. This lane has not pushed or opened a PR.

## Execution identifier preservation

The additional required Stage B correction is at
`etl_run3b_fleet_corpus.py:68`: `stepid` and `failedstepid` are the only
non-identity exceptions needed by the normalized process rule. The source-derived
regression at `test_run3b_generator.py:148` first failed because `stepId` was
classified as a process identity. It now passes for raw records, nested verdicts,
properties, normalized spellings, and the same-object failure pair.

All source paths in this table are under `packages/tooling/tool/cli/src/`.

| Execution key | Deployed schema citation | Treatment |
| --- | --- | --- |
| `failedStepId` | `commands/Yeet/internal/Verdict.ts:592` | Explicit exception; preserve with `failureKind` |
| `stepId` | `commands/Yeet/internal/ProofState.ts:51`; `internal/repo-run/RepoRun.models.ts:407` | Explicit exception; execution result/proof join |
| `attemptId` | `commands/Yeet/internal/AttemptJournal.ts:50`, `:89`, `:123`; `commands/Yeet/internal/Verdict.ts:581`; `internal/repo-run/AttemptTerminationJournal.ts:123` | Already outside process rule; preserve |
| `runId` | `commands/Yeet/internal/AttemptJournal.ts:51`; `commands/Yeet/internal/Verdict.ts:580` | Already outside process rule; preserve |
| `taskId` | `internal/repo-run/RepoRun.models.ts:185` | Already outside process rule; preserve |
| `id` | `commands/Yeet/internal/Verdict.ts:152`; `internal/repo-run/RepoRun.models.ts:309`, `:344` | Lane, wave, and step identities; preserve |

The enumerated verdict/attempt, retained-journal, proof-state, and execution
schema fields ending in normalized `id` are those six execution keys plus actual
`pid`/`ownerPid` identities. The latter remain rejected. No general `id` allowlist
or exclusion was introduced.

| Population | Previous branch raw `failedStepId` pairs | Main raw pairs | Refreshed raw pairs | Refreshed property pairs |
| --- | ---: | ---: | ---: | ---: |
| Stage A fleet | 1862 | historical capture | 1863 | 1863 |
| Stage B fleet | 0 | 1746 | 1753 | 1753 |
| Synthetic | 0 | 0 | 0 | 0 |

Every refreshed raw `failedStepId` has a nonempty `failureKind` in the same object.
Stage A's complete rider census is **1899**, comprising 1863 such pairs plus
36 other classified occurrences; its prior report's 1898 was 1862 plus 36.
The small increases reflect fresh live captures. Stage B's dropped join fields
are restored, and its source-aligned property count equals the raw count.
The cache-plan rider is still absent. Proof-ledger issuance remains re-parked to
run 4; these checks do not constitute run-3 ratification.

## Manifest decision and compatibility fixes

Fresh capture calls `finish_manifest` in `etl_run3_fleet_corpus.py:600`
and `etl_run3b_fleet_corpus.py:613`. It emits SHA-256 receipts, the payload-only
`integrity` scope, three PASS entries in `verification`, and fixed-point byte
`totals`. It does **not** emit `security_resanitization`: that block describes
an in-place, non-recapture repair, and is added by
`goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py:138`.
Copying it into a fresh capture would misstate provenance. Run-2 and identity
retain main's repair blocks unchanged. Stage A retains its validated Ruling 22
`generator_lineage`; both Stage B populations share the new generator self-pin.
The prior and current generator/manifest digests below retain the refresh history.

Two combined-contract regressions required narrow compatibility changes:

- A YAML census entry `pid: <count>` matched #1032's wider numeric-text rule.
  Both amended generators now name that count bucket `pid_pair`; the custody
  precedence, hash inputs, sums, and replay checks are unchanged. No scanner
  exemption or weaker PID pattern was added.
- The security repair script retained a stale amended digest and duplicated
  Stage A's leading lineage block. It now validates source lineage before repair
  (`resanitize-corpora.py:94`) and emits one block with the new amended digest
  (`:150`), preserving the frozen digest, ruling, and escaped decoded reason.
  The committed-history regression verifies one block, current digest, original
  security receipts, idempotence, and exact-source replay.

Historical repair tests create disposable fixture repositories under ignored
`.beep/corpus-test-repos/` inside this worktree. No test weakens its assertions;
no full checkout is created under `/tmp`. Friction receipts record the merge
collision and these combined-contract failures when they occurred.

## Captures and digests

Both organic captures discovered 22 clones and 72 linked worktrees (94 checkouts).
Captures are interval observations, not atomic fleet snapshots.

| Pin | Capture start UTC | Capture finish UTC |
| --- | --- | --- |
| `run3-fleet` | 2026-09-09T06:27:59.082Z | 2026-09-09T06:28:10.478Z |
| `run3b-fleet` | 2026-09-09T06:27:03.151Z | 2026-09-09T06:27:12.950Z |
| `run3b-synthetic` | 2026-09-09T06:28:00.131Z | 2026-09-09T06:28:00.282Z |

| Pin | Payloads | All files | Events | Payload bytes | All bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `run2-fleet` | 1588 | 1589 | 6213 | 12679246 | 13316735 |
| `run3-checkout-identity` | 216 | 217 | 108 | 694899 | 894779 |
| `run3-fleet` | 1914 | 1915 | 7869 | 15954039 | 18743097 |
| `run3b-fleet` | 734 | 735 | 7279 | 14434276 | 15750040 |
| `run3b-synthetic` | 8 | 9 | 10 | 6575 | 42272 |

| Pin | Whole-tree SHA-256, including manifest |
| --- | --- |
| `run2-fleet` | `559f666bd33cb20d51cd21eeb5431c969ce11b9f91b0ef1e17f4c02ebf29c77e` |
| `run3-checkout-identity` | `cfd02834094938cad232cd0d6400650c2c8f547ea68606ca065bb2d102dcbd8e` |
| `run3-fleet` | `9a5a9fbfc0d926334523f065ba0c9a28f5565bf22d08597e33c908e40a5da1c7` |
| `run3b-fleet` | `61b7876a421beee0a8a8b5b666e3639e9376b55bed1886ddce53c098e1b5598e` |
| `run3b-synthetic` | `de37d475e20490a03ed6f59f9ad549562992fb65c569c8a1987e171d4e3a8ef5` |

Tree hashing sorts relative POSIX file names. Each UTF-8 name and its file bytes
are prefixed with their lengths as unsigned 8-byte big-endian integers before
SHA-256 accumulation. The manifest is included.

| Pin | Prior branch generator SHA-256 | Current generator SHA-256 |
| --- | --- | --- |
| `run2-fleet` | `962759f2ee171b171a23f5ca0c048f43c0c0586d0446e51adb3ae3f007851229` | `962759f2ee171b171a23f5ca0c048f43c0c0586d0446e51adb3ae3f007851229` |
| `run3-checkout-identity` | `ae9db0102c4cbc4b39862872a099edc88d2874202641b6d3ffb27aef77010854` | `ae9db0102c4cbc4b39862872a099edc88d2874202641b6d3ffb27aef77010854` |
| `run3-fleet` | `a428cf71b8c385d5cba7430aa755b0d7fe579b131976587ee83475cba6e6785e` | `55caab8d26e55e00854737b476388bbb189d393a8855da3d86fa1a7eb82b0228` |
| `run3b-fleet` | `901e1e9399879bd29564f4dea79c9903bafeb67656ec8cd269fe265d8b03728f` | `fceff631402bd828f12c199543c29d90ae1c1cec78be824982d684a0579b9bcb` |
| `run3b-synthetic` | `901e1e9399879bd29564f4dea79c9903bafeb67656ec8cd269fe265d8b03728f` | `fceff631402bd828f12c199543c29d90ae1c1cec78be824982d684a0579b9bcb` |

| Refreshed pin | Prior branch manifest SHA-256 | Current manifest SHA-256 |
| --- | --- | --- |
| `run3-fleet` | `1099e85abdc80e4fef79a629f7ab06fe79d5156af7af43d7aa3e392941967294` | `a65c98132953332626c6c83712ab209100c0be1efa0f199c4f6baf333b7fcae6` |
| `run3b-fleet` | `b7c34a4d489a11c756664a4707b8f6204670840aaa91b953e13961f0533c4ca1` | `d7c32aa40228ab6d50e3f86d1436e6673289f47731391f63bbab9c7141333d53` |
| `run3b-synthetic` | `0781a68564aca32ed71432a25be62466b9742f9160a24635567205f204dffffb` | `b9cf5547608228ca41aa32bbdba69b3ec7e600763bf650f93180a394e18b293e` |

| Pin | Raw family | Files | Events |
| --- | --- | ---: | ---: |
| `run3-fleet` | admission | 2 | 289 |
| `run3-fleet` | attempts | 360 | 6985 |
| `run3-fleet` | live | 4 | 4 |
| `run3-fleet` | verdict | 591 | 591 |
| `run3b-fleet` | admission | 2 | 289 |
| `run3b-fleet` | protocol | 1 | 1 |
| `run3b-fleet` | attempts | 360 | 6985 |
| `run3b-fleet` | live | 4 | 4 |
| `run3b-synthetic` | admission | 1 | 7 |
| `run3b-synthetic` | protocol | 1 | 1 |
| `run3b-synthetic` | attempts | 2 | 2 |

| Pin | pid pair | owner pair | attached identity | Other identities |
| --- | ---: | ---: | ---: | ---: |
| `run3-fleet` | 293 | 237 | 2 | 0 |
| `run3b-fleet` | 293 | 237 | 2 | 0 |
| `run3b-synthetic` | 7 | 0 | 0 | 0 |

The synthetic export was read without mutation. READY was present, and its producer
SHA-256 `0ee8d157ffce4a113ab1b2acc4e1c598a098f491c67850fd6071009dd9c5f983`
matches the tree-resident spec merged by #1033. Its termination joins are:

```json
{
  "dead-lease": {
    "journal_path": "attempts/dead-lease/feat_synthetic-dead-lease-f004a5320ab9/attempts.ndjson",
    "attemptId": "b4e72342-45a5-4a1b-95db-5ab4ef30a93f",
    "attemptId_match": true,
    "reason": "lease-eviction"
  },
  "dead-ticket": {
    "journal_path": "attempts/dead-ticket/feat_synthetic-dead-ticket-7e2dab5a5a8b/attempts.ndjson",
    "attemptId": "a2fdba81-945f-4f44-8d93-6f71f706d5cd",
    "attemptId_match": true,
    "reason": "queued-submitter-death"
  }
}
```

## Verification

- **58 tests pass:** Stage A/shared suite 30, Stage B suite 28. An AST name-set
  comparison confirms all 30 and 27 parent-union tests remain, plus the new
  execution-join regression. Repair-history tests cover both Stage B populations.
- All five pins pass ordinary CLI verification with their own generators.
- Each refreshed pin passes **0 → 1 → 0** for ordinary, corrupted-byte, and
  restored verification. The changed property bytes were restored in `finally`;
  every final whole-tree hash equals its pre-corruption value.
- The three refreshed pins have zero literal variant matches, zero normalized
  process-member residue, zero quoted/escaped numeric PID matches, and zero
  bounded host-path, UID, hostname, or SHA-12 hostname matches in names/contents.
  The literal pattern is `attachedPid|ownerProcStart|ownerPid|"pid"`.
- All five pins have zero quoted/escaped numeric PID matches. Run-2 and identity
  pass their main-owned scanners unchanged. Applying the newer broader host/UID
  and hostname diagnostics to frozen run-2 also produced 612 and 313 inherited
  matches respectively. These are outside run-2's older scanner contract; this
  lane preserves that tree exactly as instructed and does not claim those broader
  run-2 diagnostics are empty. Identity passes the broader diagnostics too.
- Packet validator: **0 blockers, 0 warnings**, 26 CQs and 25 SPARQL files parsed.
- CQ suite: **0 failures across 25 seed tests and 20 fixtures**. Existing golden
  coverage remains 1/25 status-covered, with no populated golden antecedent.
- No workspace package source was edited by reconciliation; package verification
  is not applicable. This is the requested corpus/packet proof, not a full Yeet
  or hosted PR acceptance claim.

Commands executed from the trusted lane:

```sh
packet=explorations/beep-ci-operational-ontology
corpus="$packet/ontology/extraction/s4/beep-ci-ops/corpus"
export UV_CACHE_DIR=~/.cache/beep/uv-cache
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" --refresh fleet
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py" \
  --refresh synthetic --synthetic-root ~/.cache/beep/ciops-synthetic-root
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py" --refresh
uv run --offline --with pyyaml python -m unittest discover -s "$corpus" -p 'test_run3*.py'
uv run --offline --with pyyaml python "$corpus/etl_fleet_corpus.py"
uv run --offline --with pyyaml python "$corpus/etl_run3_checkout_identity.py"
uv run --offline --with pyyaml python "$corpus/etl_run3_fleet_corpus.py"
uv run --offline --with pyyaml python "$corpus/etl_run3b_fleet_corpus.py"
uv run --offline --with pyyaml,rdflib python "$packet/research/scripts/validate_packet.py"
uv run --offline --with pyoxigraph python "$packet/research/scripts/run_cq_suite.py"
```

The first Stage B fleet-refresh command promoted its verified fleet tree, then
exited 1 while checking the still-old synthetic manifest's `pid` census label.
The subsequent synthetic refresh completed successfully, verified the new fleet,
and pinned synthetic. Final ordinary verification and corruption proofs were
serial and ran after all captures finished. No mixed-generation result is counted
as final proof. Source/citation commit for the captures is `5e02f8c04b2448fe4ff49bab4e898841b481c0e5`.

The committed-head proof and knowledge reference check are recorded in the
post-commit appendix below. Fable owns review and publication; no remote mutation
is authorized for this lane.

## Committed-head verification

Refresh/implementation commit: `c61b4aed9ce89738b0d43d29c5554d38681fa955`.

```text
fix(explorations): re-pin the refreshed corpora under the merged generators
```

Explicit-path staging committed 736 reviewed paths. Gitleaks, typos, Biome, and
commitlint hooks passed. Biome normalized only `ops/manifest.json` formatting;
it did not change the generators or pins. Commit body lines are under 100 characters.

A detached worktree at this exact commit was created under the lane's ignored
`.beep/reconcile-1032/` directory. The trusted lane's offline PyYAML interpreter
ran all four ordinary generator CLIs there, covering all five pins. Every exit
was zero. No refresh, synthetic-root input, live recapture, or mise trust change
was used. The test disabled Python bytecode writes.

| Pin | Manifest payloads | All tracked files | Missing | Extra |
| --- | ---: | ---: | ---: | ---: |
| `run2-fleet` | 1588 | 1589 | 0 | 0 |
| `run3-checkout-identity` | 216 | 217 | 0 | 0 |
| `run3-fleet` | 1914 | 1915 | 0 | 0 |
| `run3b-fleet` | 734 | 735 | 0 | 0 |
| `run3b-synthetic` | 8 | 9 | 0 | 0 |

All detached whole-tree hashes match the capture table above. The repair script's
`verify_generator_provenance` independently found each of the five pinned
generator digests in reachable committed history. The detached worktree was
clean and was removed without force.

After the implementation commit, `bun run beep knowledge refs --check` exited
**0**, with **0 live gated observations**. Packet validation was repeated after
bookkeeping and passed with zero blockers and warnings. The source/test bytes
are the same bytes that passed the complete 58-test suite.

This documentation follow-up records the actual implementation SHA and its
post-commit proof. It changes no generator or pin. Final HEAD receives the same
detached verification, tracked-inventory/hash checks, committed-provenance
checks, and post-commit knowledge reference check before handoff. The final
handoff identifies that documentation commit separately. No push or PR creation
occurred; Fable retains review and publication ownership.
