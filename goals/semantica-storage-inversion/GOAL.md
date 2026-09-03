# GOAL: spike delete, compaction and desktop storage for the Semantica ledger

Repo root: the current working directory. All paths are repo-relative.

Outcome: the lab's append-only `ProvenanceEvent` ledger gains logical
retraction (`Invalidated`, reach derived), physical erasure (`Redacted`,
document-targeted, computed closure, atomic purge) and compaction (`Compacted`
trust-root snapshot, continuity from the checkpoint), proven by probes
P-S0..3 on the offline-regenerated C2 ledger as one S1 candidate; the verdict
lands in the exploration's `DECISIONS.md`.

Read these as the contract:

- `goals/semantica-storage-inversion/{README,SPEC,PLAN}.md`
- `goals/semantica-storage-inversion/ops/manifest.json`
- `goals/semantica-storage-inversion/research/SOURCES.md`
- `explorations/semantica-lab/MAP.md` §S (v1.1) and `DECISIONS.md` (Current
  law table, then the 2026-09-03 ratification grill R0.a, R1.a–R1.i; the
  table wins over prose)
- `goals/semantica-canary/SPEC.md` (the lab's standing constraints)

Then `AGENTS.md`, `CLAUDE.md`, `standards/architecture/15-lab-apps.md`, and
the skills `SPEC.md` names.

Scope:

- In: `apps/labs/semantica` (event bodies, `CompactedSnapshot`, three DDL
  changes, chain validator, erasure closure + provider-cache reverse index,
  witness extension, size accounting, tests); this packet's evidence; the
  storage-semantics verdict in the exploration's `DECISIONS.md`.
- Out: every `SPEC.md` non-goal — the id preimage, in-place row edits, hosted
  calls, reasoning work (R-c is the sibling spike's), persistent stores,
  Notion writes, reusable lab exports, `src-tauri`.

Execution:

1. P0 P-S0: regenerate the full-W1 C2 ledger from the workstation provider
   cache with the lab's `canary` entry at C2 `--offline`; the report digest
   must equal the archived C2 digest (`goals/semantica-canary/history/c2/`).
   No reproduction: stop and report; the spike does not start.
2. P1 P-S1: schema (extended witness) → contract (retraction reach via
   `claimQuads` + recorded premises) → Layer (`Invalidated` emission,
   rebuild honours it). First slice: one W1 paper, two claims that feed a C2
   inference. Then the full ledger. Yeet to `merge-ready: yes`.
3. P2 P-S2: `Redacted` + `Compacted` bodies, `CompactedSnapshot`, DDL
   (nullable payload, `body_digest`, `prev`), chain validator, chain-order
   read, atomic erasure with the copy-class inventory. Gate: digest
   byte-identical after compaction alone; erasure equals manifest-minus-one
   replay; continuity verifies.
4. P3 P-S3: file-backed `dataDir`, bytes before/after in the telemetry
   sidecar, SIGKILL mid-compaction and SIGKILL mid-erasure (between the
   closure commit and the out-of-DB purge; the restart completes the purge)
   via `CrashProbeChild`; redesigned candidate = copy-to-fresh-`dataDir`.
5. P4: verdict to `DECISIONS.md` (Current law "Storage" row amended),
   `/reflect`, evidence under `history/`, state flip in the final PR.

Non-negotiable:

- Tombstone ≠ erasure. `Invalidated` stays claim-targeted with derived
  reach; `Redacted` erases a computed closure including run outputs, and is
  the durable intent a restart re-runs until a purge receipt exists.
- The id preimage `(prev, body)` never changes; redacted ids are
  `(id, prev, body_digest)` commitments, never recomputed.
- Chain order via `prev` is canonical for folds and replay; `recorded_at`
  is telemetry. Digests never carry telemetry or bytes.
- Every probe is replay-offline; nothing regenerated is committed.
- `HashSet`/`HashMap`, `Effect.fn`, decode at boundaries, Effect v4 verified
  against the reference checkout; schema → service → Layer.

Acceptance: every `SPEC.md` criterion, all `ops/manifest.json`
`verificationCommands` green, no unrelated churn.

Stop on the probe breaker (one redesigned candidate per failed probe, then
park and drop the exploration to `decompose`) — never on a calendar; on a
failed P-S0; on any No-Go crossing; on an unmeasurable gate.
