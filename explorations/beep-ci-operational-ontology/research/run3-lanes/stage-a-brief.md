# Run-3 lane brief — Stage A corpus generators (gateless capture)

Lane: Codex (`gpt-6-astra`, xhigh) implementing; Fable designed this brief, reviews, runs
the pinned capture, and publishes. Steward: Benjamin.
Rulings implemented: **2** (fleet-wide), **3** (new generators, sibling pins), **5**
(checkout identity is a timestamped binding), **6** (two promoted riders), **8** (Stage A
of the staged capture), **11** (custody surrogate), **12** (cache mounts: turbo primary,
git-common-dir secondary). Recorded non-actions: **7** (no TS adapter), **10** (fixture
evictions are Stage B — they need the v3 `admission-withdrawn` event to cover eviction and
withdrawal in one scenario). Design input: `research/run3-corpora-design-brief.md` §2a–§2c
(line refs there are stale; re-derive from this checkout).

Work happens in THIS checkout (`ontology-run3-stage-a` branch). Commit on the branch;
**do not push, do not open a PR** — Fable publishes.

## Live facts at brief time (2026-09-08, this workstation)

- Admission journals: canonical `~/.beep/runtime/beep-admit-uid-<uid>/journal.ndjson`
  (165 rows: 164 v1, 1 v2 `admission-lease-evicted`; 85 admitted / 79 released); session
  root `$TMPDIR/beep-admit-uid-<uid>/journal.ndjson` (2 rows v1); the legacy
  `/tmp/beep-admit-uid-<uid>/` root is DRAINED (absent). Ring is 200 — the canonical
  journal is at 165, so capture soon.
- `proof-ledger.ndjson` exists in NO checkout (Stage B gate, expected).
- Fleet: 49 `beep-effect*` clone roots plus 12 `*-worktrees` roots under the fleet root
  (the generator derives the fleet root as the parent of its own repo root, never a
  literal path).
- `bun run beep worktree fleet --json` is deployed (`FleetSnapshot` in
  `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts`; command in
  `.../Worktree/Fleet.command.ts`).
- The run-2 generator `ontology/extraction/s4/beep-ci-ops/corpus/etl_fleet_corpus.py`
  has sha256 `2b6fb03d818986fffcbc8951ec43b6b63dfb0d302c3a3c5a7ba45ecb7777e424` pinned in
  `run2-fleet/MANIFEST.yaml`. It is byte-frozen. Copy patterns out of it; never import it,
  never edit it.

## Deliverables

Two NEW generators beside the run-2 one, each pinning a sibling corpus:

| Generator | Pin dir | Manifest schema |
|---|---|---|
| `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3_fleet_corpus.py` | `corpus/run3-fleet/` | `beep-ci-ops-run3-fleet-corpus/v1` |
| `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3_checkout_identity.py` | `corpus/run3-checkout-identity/` | `beep-ci-ops-checkout-identity/v1` |

Shared mechanics (mirror run 2 exactly unless a ruling says otherwise): stdlib + PyYAML
only, run via `uv run --offline --with pyyaml python <generator>`; first successful run
pins, ordinary reruns verify pinned bytes and never read the live machine, `--refresh`
replaces the pin; generator sha256 self-pin in the MANIFEST; atomic staged emission;
`.properties` projections per raw payload (auditor `config_key_value` channel, same
eligibility rules as run 2); S6 conventions: `corpus_commit` (git HEAD at capture),
per-value `source: {file, line}` cites for every fact whose meaning comes from source
(e.g. the schema identifier lines, the runId derivation, the canonical runtime root
constant), and closed-world `complete_within` receipts per source; residue verifier that
FAILS the run on any surviving: fleet-root prefix, home prefix, system-tmp prefix,
session-tmp (`$TMPDIR`) prefix, `\b(pid)[ =:]?[0-9]+`, credential/token regexes (copy the
run-2 set), `op://` references with material, and `sha12(hostname)` (compute it at run
time — the proof-locks dir name embeds it; never write the hostname or its digest into the
pin). Manifest absolute-path lint as in run 2. GENERATED headers and hand-edit warnings
as in run 2.

### A. `etl_run3_fleet_corpus.py` → `run3-fleet/` (identity-provenance + granted-work contention)

Families: `admission/<root-label>/journal.ndjson`, `attempts/<checkout>/<runId>/attempts.ndjson`,
`verdicts/<checkout>/<runId>/verdict.json`, optional `ledger/<checkout>/proof-ledger.ndjson`,
optional `live/<root-label>/{leases,queue,quarantine}/…`, each with its `.properties`
sibling. Deltas vs run 2, all mandatory:

1. **Admission roots (Ruling 2).** Take every root that exists, labeled portably:
   `canonical` = `Path.home()/.beep/runtime/beep-admit-uid-<uid>` (mirror the constant in
   `internal/repo-run/RuntimeRoot.ts` and cite its line), `system-tmp` = `/tmp/…`,
   `session-tmp` = `tempfile.gettempdir()/…` when different. Absent roots get an explicit
   `absent` receipt in the MANIFEST, never silence.
2. **Version-aware redaction.** Accept `yeet-admission-journal/v1`, `/v2`, and `/v3`
   (v3 is landing in a parallel PR — design for it: same member rules). For every decoded
   row: mint `ownerRef` THEN drop `pid` and `procStart` (Ruling 11, below). Rows whose
   `schemaVersion` is unknown or that fail to parse as JSON objects are EXCLUDED from the
   pin and tallied in the MANIFEST (`excluded_undecodable: n` with the reason class) —
   never emit unredacted bytes. Keep source order for retained rows.
3. **Custody surrogate (Ruling 11).** `ownerRef = sha12(f"{pid}:{procStart}:{captureSalt}")`
   where `captureSalt` is 32 random bytes minted once per capture and NEVER written
   anywhere (not the manifest, not a sidecar). Record only the rule text and
   `salt_policy: per-capture, unrecorded, unlinkable across captures`. `--refresh` mints a
   new salt. If a row has `pid` but no `procStart`, mint from `pid:<absent>:salt` and
   tally it separately so the auditor sees the weaker key.
4. **String rewrite on every family** (run 2 rewrote attempts/verdicts only):
   fleet-root prefix → `<fleet>/`, home → `<home>`, system tmp → `<tmp>/`, session tmp
   → `<session-tmp>/`. Admission rows carry absolute `checkoutRoot` and `command` values;
   live lease/ticket files carry `hotPaths[]`, `runScope.unitName` — all go through the
   same rewrite. Structural keys, numbers, booleans, nulls are never transformed.
5. **Worktree glob (Ruling 2).** Beyond `<fleet>/beep-effect*/.beep/yeet/runs/*/`, also
   `<fleet>/*-worktrees/*/.beep/yeet/runs/*/`; label those checkouts
   `<parent>-worktrees/<name>` (one path segment `/` inside the label is fine — it maps to
   nested output dirs). Record for every checkout `kind: clone | linked-worktree`.
6. **Ruling 6 riders.** Confirm the fields needed for the `pa-failure-signature` occurrence
   join and the `pa-cache-plan-resolution` execution join actually reach attempts/verdict
   payloads on disk (grep the CLI for where failure signatures and cache-plan resolution
   are serialized — start from `RepoRun.proofs.ts`, `RepoRunArtifacts.ts`,
   `commands/Yeet/internal/ProofFact.ts`, the verdict schema). Keep them intact through
   redaction and projection. If a rider's field is not on disk anywhere in the fleet, say so
   in the MANIFEST (`rider_evidence: absent`) and the report — do not fabricate.
7. **Proof ledger.** Capture `<checkout>/.beep/yeet/proof-ledger.ndjson` when present (same
   rewrite); today none exist — the MANIFEST records `proof_ledger: {checkouts_with_ledger: 0}`
   and names Stage B as the owner.
8. **Live admission state.** Opportunistically capture `leases/`, `queue/`, `quarantine/`
   under each root (full redaction; lock files and the proof-locks directory are NEVER
   captured). Empty is a receipt, not an error.
9. **Known-loss classes** declared verbatim in the MANIFEST: best-effort journal appends
   (lock-busy drops), claim-race loser edge, quarantined malformed state is
   journal-invisible, `evictedAtMillis` is reap time not death time, heartbeat instant
   dropped at reap until v3 lands, ring windows (admission 200 rows per root; attempts 50
   rows per branch) with the observed row counts beside each cap so the reader can see
   whether a window wrapped. Cite the source line for each class.
10. **Join-key notes** in the MANIFEST: `nonce` threads ticket → lease → admitted →
    released/evicted → `agent-run-<nonce>.scope`; `attemptId` bridges admission rows ⋈
    attempts ⋈ embedded verdict ⋈ ledger; `runId = <safe-branch>-<sha12(branch)>` (cite
    `RepoRunArtifacts.ts`); `originKey` is repo-grain (one value fleet-wide) and empty is a
    real value; epoch-millis (journal/ticket/lease) vs ISO (attempts/verdict/ledger).

### B. `etl_run3_checkout_identity.py` → `run3-checkout-identity/` (C1 / CQ-015 bearer)

1. **Snapshot.** Run `bun run beep worktree fleet --json` from the repo root as a
   subprocess (fail loud if `bun` is not on PATH). Persist the redacted snapshot as
   `fleet-snapshot.json` + `.properties`. Pin the output SHAPE: record the `FleetSnapshot`
   schema identifier and its source line in the MANIFEST as `snapshot_shape` (the `--json`
   shape is not otherwise versioned).
2. **Redaction.** `fleetRoot` → `<fleet>`; every `checkouts[].path`, every path inside
   `contestedPaths[]` and any other string leaf → `<fleet>/<name>` / `<home>` / tmp
   rewrites; `originUrl` stays verbatim (it is the identity-derivation input) but a
   credential guard (`://[^/@]+@` or token-looking userinfo) fails the run. Prefer the
   derived `FleetCheckout` rows over raw liveness probe data; if the snapshot embeds any
   pid/procStart-class member, drop it and tally.
3. **Per-checkout binding (Ruling 5)** in `bindings/<name>.json` (+ `.properties`) with
   the corpus-local identity key = the `<fleet>/<name>` token, and the binding at
   `scannedAt`: `origin_url` (`git remote get-url origin`), `kind` (clone |
   linked-worktree), `branch`, `branch_sha12` (mirror the runId digest rule, cite the
   line), `head`, `git_dir` and `git_common_dir` (rewritten; a worktree's common dir points
   into its parent clone — that IS the linkage fact), `runs_dir_listing` (run-dir names
   under `.beep/yeet/runs/`, which double as the cross-corpus join into `run3-fleet`).
4. **Cache mounts (Ruling 12).** Primary bearer = turbo proof-cache topology per checkout:
   `turbo_local_cache_present` (confirm the real local cache path from the repo's turbo
   configuration — `.turbo/cache` is the default, verify), `turbo_local_cache_entries`,
   `turbo_remote_cache_configured` (from `turbo.json` `remoteCache`, boolean only),
   `turbo_remote_cache_env_present` (booleans for the presence of `TURBO_TOKEN` /
   `TURBO_TEAM` / `TURBO_API` in the generator's environment — NEVER their values; note
   that env presence is process-scoped, not per-checkout, and label it so),
   `turbo_remote_cache_signature_configured` (boolean). Secondary = the git-common-dir
   linkage above, labeled a checkout-binding fact, not a proof cache. Install roots are
   skipped (Ruling 12). Record the necessary-not-sufficient caveat (task-hash granularity)
   in the MANIFEST.
5. **Single instant.** One capture; `capture_instant = scannedAt`. N-instant change
   evidence is deferred (say so in the MANIFEST).

## Packet bookkeeping in this PR (do these; Fable reviews)

- Run `research/scripts/validate_packet.py` and the CQ suite
  (`uv run --with pyoxigraph python research/scripts/run_cq_suite.py`); both must stay
  green.
- `ops/manifest.json` → the run-3 open question gains a Stage A line: "Stage A PINNED
  <date> (`run3-fleet/`, `run3-checkout-identity/`); Stage B gated on the v3 journal PR,
  organic traffic, and proof-ledger materialization". Do not touch the S8 question.
- `README.md` Trail: one dated entry for Stage A (what was pinned, counts, what is gated).
- Do NOT edit `DECISIONS.md` (no new rulings here), `ATLAS.md` (generated), or anything
  under `extraction/s5|s6|s7` or `run2-fleet/`.
- `research/OPPORTUNITIES.md` already carries an uncommitted friction receipt from Fable —
  leave it in place; add your own receipts there if the work is slower or riskier than it
  should be (redacted, `~` for home, no session ids).

## Verification before handoff

1. Each generator: first run pins (exit 0), second run verifies byte-identical (exit 0),
   a deliberately corrupted pinned byte makes verify fail (exit ≠ 0), then restore.
2. Residue scans zero on both pins; the home-prefix scan over both pin dirs is empty;
   `grep -rn "$(hostname)"` empty.
3. `sha256sum etl_fleet_corpus.py` still `2b6fb03d…7777e424`; `git status` shows nothing
   under `run2-fleet/`, `s5/`, `s6/`, `s7/`.
4. Packet validator + CQ suite green.
5. `bun run beep quality package-verify` is NOT needed (no workspace package touched), but
   run the repo's markdown/knowledge lint that gates `explorations/` if one exists
   (`bun run beep lint --help` lists them) and attribute any red.

## Report

Write `research/run3-lanes/stage-a-report.md` with: the two MANIFEST heads pasted
(first ~40 lines each), per-family counts (checkouts incl. worktrees, journal rows by
root × schemaVersion × `_tag`, attempts/verdict files, excluded rows and why), the
Ruling-6 rider evidence verdict, the residue-scan proof, the frozen-bytes proof, any
deviation from this brief with reasons, open questions, and the commit SHA(s).

## Hard rules

- Never `git add -A`; stage by name (the pins are large — stage the pin directories by
  path). Never push / PR / merge / force.
- Public repo: no absolute home paths, hostnames, machine ids, pids, or secrets in
  committed bytes — the residue verifier is the law, the scans are the proof.
- Frozen artifacts stay byte-identical; `etl_fleet_corpus.py` is never imported or edited.
- Commit message: `feat(explorations): pin the run-3 Stage A corpora (fleet + checkout identity)`,
  body lines wrapped under 100 characters.
