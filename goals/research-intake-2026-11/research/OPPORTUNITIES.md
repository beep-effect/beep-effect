# Research intake 2026-11 — Opportunities and friction receipts

Recorded as they happen. Paths are home-relative; no secrets, session ids or
private-archive content.

## 2026-11-07 — Graduated goal depended on a prerequisite nobody had launched

- **Doing:** starting `/goal` on this packet.
- **Evidence:** `git show origin/main:goals/research-library-routes/ops/manifest.json`
  showed `initiative.status: active` with all five phases `pending`; no
  branch, worktree, PR or session-ledger row named the routes goal. This
  packet's SPEC requires it merged before the intake runs.
- **Cost:** the intake session became the routes orchestrator and the intake
  waits on a full implementation goal.
- **Would have prevented it:** graduation (or `goals doctor`) flagging a
  goal whose `requires` capability is provided only by an unstarted packet,
  and launching packets in `requires` order.

## 2026-11-07 — Box nightly series drifted after the survey

- **Doing:** hop-0 census.
- **Evidence:** the 2026-11-06 survey counted 34 Box nightlies; the root
  folder now lists 36 nightly files (a new 2026-11-06 report and a misnamed
  byte-identical `26-11-04` alias). Local `11-05 (3)` is byte-identical to
  Box `2026-10-21`, so file names don't reliably identify dates.
- **Would have prevented it:** identity by content hash plus the report's own
  date header rather than by filename, which the snapshot now applies.

## 2026-11-07 — Fake-runner tests passed while the real runners failed

- **Doing:** smoke-testing `mine triage` and `mine read` against real models on
  a reflink copy of the library (`~/.cache/beep/library-smoke`).
- **Evidence:** T1 died with `invalid_json_schema ... got 'type: "None"'`
  because `S.toJsonSchemaDocument` emits a `$ref` root for identified
  classes; fixed with `referencePolicy: () => undefined`. T2 rejected a whole
  Opus reading over one span whose only difference was a PDF line break;
  the span check now resolves whitespace-only differences to the exact
  capture slice.
- **Would have prevented it:** a `qualify`-style bounded real probe per runner
  profile before a tier is declared ready, as the routes goal already
  requires for acquisition adapters.

## 2026-11-07 — Exploration packets were invisible as SKOS routing concepts

- **Doing:** reading the `verify` warning `library topics: skipped=116`.
- **Evidence:** `libraryTopics` decoded only `initiative-manifest/v2`; all 104
  `exploration-manifest/v1` packets were skipped, so no finding could be
  `skos:related` to an exploration. The existing test wrote a goal-shaped
  manifest into its exploration fixture, so it never caught this.
- **Would have prevented it:** fixtures copied from a real manifest of each
  schema version instead of hand-written look-alikes.

## 2026-11-07 — Box route failed as an opaque `sdk thrown` from a normal worktree

- **Doing:** `research library acquire --route box` for the hop-0 nightlies.
- **Evidence:** `Box file lookup failed: sdk thrown` with valid `DMS_BOX_*`
  references. Bun auto-loads the worktree `.env` (copied from the main checkout
  by `worktree new`), and that `.env` holds an hour-lived desktop
  `CLOUD_BOX_TOKEN` that `resolveBoxLayer` preferred over CCG. Direct SDK and
  driver probes with the same credentials succeeded; `bun --no-env-file`
  succeeded.
- **Would have prevented it:** explicit CCG settings outranking a developer
  token, and a driver diagnostic naming the auth mode that failed. Sent to the
  routes PR as a review finding.

## 2026-11-07 — First hop-0 inventory rewrote the October intakes' derivations

- **Doing:** the first November hop-0 inventory on the real library.
- **Evidence:** before the run the catalog held 0 derivations; after it, each
  of the four 2026-10-06 intake ids carried about 3k hop-1 and 87k hop-2
  edges, because `recordLibraryHops` looped over every intake in the catalog.
  `status` then ran past 14 minutes at 100% CPU (per-source linear scans over
  51k sources).
- **Recovery:** the library was restored from the reflink backup taken before
  the first write, the hop derivation was scoped to the recorded intake and
  indexed (commit `c860570375c`), and Box acquisition plus inventory were
  re-run.
- **Would have prevented it:** a replay test that runs `inventory` twice with
  different roots and asserts the earlier intake's derivations are unchanged,
  and a scale fixture at real catalog size.

## 2026-11-07 — Reference resolution only accepts GitHub proofs

- **Doing:** accounting for unresolved hop-1 shorthand citations.
- **Evidence:** two citations name Hugging Face datasets by `owner/name`
  without a host. `LibraryReferenceResolutionPayload` validates only a GitHub
  API object, so they were disposed `tool-blocked` with the canonical dataset
  URL in the reason instead of being resolved.
- **Would have prevented it:** a resolution proof per registry (Hugging Face
  dataset and model APIs return a stable JSON id), like the GitHub one.

## 2026-11-07 — Every catalog write re-decoded a 41 MB catalog

- **Doing:** hop-1 acquisition of 936 sources.
- **Evidence:** about 16 s per capture (two catalog writes per source, each
  decoding, migrating and artifact-checking the whole catalog, then writing a
  full history copy; `catalog/history` already held 23 GB in 2,929
  snapshots). The last-written-catalog reuse in `withCatalog` took it to
  about 1.2 s per capture.
- **Would have prevented it:** an append-only receipt journal folded into the
  catalog in batches, and content-addressed history deltas instead of full
  copies.
