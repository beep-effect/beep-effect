# Semantica Storage Inversion Plan

## Status

Status: `pending`

Not started. The spike opens with P-S0, the fixture gate; nothing else runs
until the C2 digest reproduces with the network off.

## Phases

Each phase ships as one or more PRs driven to mergeable via `/yeet`; the
completion gate binds per phase, not only at close. Phase ids match
`ops/manifest.json` `phases[]`. The four probes are one stage of one S1
candidate (R1.e): a failed probe buys exactly one redesigned candidate for that
probe (R0.a); a second failure parks the family.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 P-S0 entry check | pending | Regenerate the full-W1 C2 ledger from the workstation provider cache, network off. | Report digest equals the archived C2 digest; cache hash and event count recorded under `history/`. |
| P1 P-S1 retraction | pending | Emit `Invalidated`, derive its reach, rebuild, and witness the delta. First slice first (one W1 paper, two claims). | Three projection digests equal incremental-apply; dependent `InferenceEvent`s absent; `QuadDelta`-shaped witness exact; over the full C2 ledger. |
| P2 P-S2 compaction + erasure | pending | `Compacted` over the prefix up to the last `Chunked` event; `Redacted` over one W1 document with the atomic protocol. | Digest byte-identical after compaction alone; erasure equals manifest-minus-one replay; continuity verifies; copy-class inventory proven. |
| P3 P-S3 desktop storage | pending | File-backed `dataDir` under an app-data-shaped root; SIGKILL mid-compaction via `CrashProbeChild`. | Bytes decrease (sidecar); restart verifies as exactly the pre- or post-compaction chain. |
| P4 Close | pending | Verdict (or park) to the exploration's `DECISIONS.md`; reflection; packet state flip in the same PR. | Dated entry + Current law "Storage" row amended; closeout reflection validates; packet `completed-retained`. |

## P0 P-S0 entry check

1. Confirm the workstation provider cache (`SEMANTICA_PROVIDER_CACHE_DIR`,
   untracked, about 152 MB on 2026-09-03) is present; record its content hash
   under `history/`.
2. Run the lab's `canary` entry at C2 with `--offline` over the full W1
   manifest + F1; compare the report digest with the archived C2 digest in
   [`goals/semantica-canary/history/c2/`](../semantica-canary/history/c2/)
   (`SHA256SUMS`, `full-w1.replay.eval-report.json`).
3. Record the ledger's event count and table row counts; this is the fixture
   every later probe replays. No reproduction: stop and report (R1.f); the
   spike does not start.

## P1 P-S1 retraction

Schema first, then contracts, then Layers (repo law):

1. Schema: no new event body; the extended rebuild witness (removed quads,
   removed statements, removed `InferenceEvent` ids) beside `QuadDelta` in
   `src/schema/Projection.ts` / `src/schema/Reasoning.ts`.
2. Contract: a `Context.Service` for retraction reach (claim → `claimQuads` →
   `StatementId`s → transitive `InferenceEvent` premises); the bridge in
   `src/layers/RdfProjectionLive.ts` becomes reachable without duplication.
3. Layer: `Invalidated` emission through `LedgerLive.appendBatch` (today no
   Layer emits it); rebuild honours retraction; nothing is updated in place.
4. First slice: one W1 paper, invalidate two claims that feed a C2 inference,
   rebuild, assert the witness. Then the full C2 ledger with a committed claim
   subset that feeds C2 inferences.
5. Publish; `merge-ready: yes`. Record the witness and digests under
   `history/p1-*.md`. This lands before the reasoning spike's R-c (R1.g).

## P2 P-S2 compaction + erasure

1. Schema: `Redacted` (`DocumentId`) and `Compacted` event bodies;
   `CompactedSnapshot` (event range, fold digest, projection digests); the
   `EventKind` domain widened; DDL: nullable `payload`, `body_digest` for every
   event, `prev` column (R1.c).
2. Contracts: erasure-closure computation (rows by document, conflicts via
   claim ids, run outputs, provider-cache entries via the new reverse index,
   events naming the document); the chain validator (prev exists, unique head,
   ids recompute where bodies remain, fold digest matches, redacted events as
   commitments only); chain-order `Ledger.read` from the checkpoint (R1.i).
3. Layers: compaction (fold the prefix up to the last `Chunked` event);
   erasure (closure rows deleted in one transaction, then copy-to-fresh-
   `dataDir` or `VACUUM FULL`); the copy-class inventory (WAL and TOAST inside
   `dataDir`, report and telemetry files, provider-cache entries) with a proof
   or an out-of-scope ruling per class (R1.h).
4. Gate: compaction alone reproduces the C2 digest byte-for-byte; erasure of
   one W1 document equals a cache-only run over the manifest minus that
   document; continuity verifies.
5. Publish; record under `history/p2-*.md`.

## P3 P-S3 desktop storage

1. `@beep/pglite` `makeLayer({ dataDir })` under an app-data-shaped root;
   size accounting (bytes before and after) in the `EvalRunTelemetry` sidecar.
2. SIGKILL mid-compaction via the existing `CrashProbeChild` pattern; the
   restarted ledger must verify as exactly the pre- or post-compaction chain.
3. If `VACUUM FULL` cannot reclaim bytes under PGlite WASM, the redesigned
   candidate is copy-to-fresh-`dataDir` compaction (R1.e); a second failure
   parks the family.
4. Tier-L bars re-measured after compaction as a regression check.
5. Publish; record under `history/p3-*.md`.

## P4 Closeout Checklist

1. Write the storage-semantics verdict (or park) as a dated entry in the
   exploration's `DECISIONS.md` and amend the Current law "Storage" row and
   D16's binding status in the same PR.
2. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its frontmatter must
   validate against `ReflectionFrontmatter`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` (`bun run beep goals set-status`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive probe outputs under `history/`.
- The regenerated ledger and the provider cache never enter the repo.

## Verification Commands

```sh
test "$(wc -m < goals/semantica-storage-inversion/GOAL.md)" -le 4000
jq . goals/semantica-storage-inversion/ops/manifest.json
rg -n "semantica-storage-inversion|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantica-storage-inversion
git diff --check -- goals/semantica-storage-inversion explorations/semantica-lab
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
