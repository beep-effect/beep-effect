# P2 Contradiction-Triage Verification and Closeout

Date: 2026-10-05

Verdict: **PASS**

## Context

The P1 surface shipped to `main` in PR #520 (merged 2026-08-02) together with
the codex closeout reflection, but the packet state was left at "P2 in
progress". This session re-proved every P2 exit criterion against the live
`main` head (`8b7392fe00`) in a fresh lane and lands the packet-state flip in
the closing PR, as the spec requires.

Lane: sibling worktree `epistemic-contradiction-triage-close` branched from
`origin/main`, `bun install --frozen-lockfile`, then
`bunx turbo run build --filter="@beep/epistemic-server^..."` (34 cached tasks).

## Executable evidence

Focused package lanes (`CI=true bunx vitest run` inside each package):

| Package | Files | Tests |
| --- | --- | --- |
| `@beep/epistemic-domain` | 8 passed | 94 passed |
| `@beep/epistemic-tables` | 4 passed | 50 passed |
| `@beep/epistemic-use-cases` | 8 passed | 50 passed |
| `@beep/epistemic-server` | 13 passed, 2 skipped (opt-in Postgres lanes) | 86 passed |
| `@beep/epistemic-client` | 2 passed | 18 passed |
| `@beep/db-admin` `EpistemicContradictionMigration.pglite.test.ts` | 1 passed | 2 passed |

Opt-in real-Postgres race lane, run against a disposable
`pgvector/pgvector:pg17` container on port 55434 with
`BEEP_EPISTEMIC_CONTRADICTION_PG_URL` set
(`packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts`):

- `allows exactly one reviewer and preserves the disposition across a fresh
  repository/client stack` — PASS
- `allows one competing approval to supersede a shared edge and preserves the
  winner across restart` — PASS

Packet gates: `bun run beep lint reflection-artifacts` reports
`blocking_findings=0 advisory_findings=0`; `bun run beep lint goal-packets`
reports `blocking_new=0 blocking_inherited=0 advisories=0`.

## P2 exit criteria

| Criterion | Result | Executable proof |
| --- | --- | --- |
| Two-axis queries over open and resolved candidates | PASS | `ContradictionTriage.pglite.test.ts` › "queries both axes and records a durable rejection"; "expands exact beliefs with organization- and source-scoped verification as of query transaction time"; P0 gate "visibility" assertion re-run green. |
| Approval-to-atomic-supersession race lane | PASS | Real-Postgres lane: two independent repository/client stacks, one winner, typed loser, disposition and supersession preserved through a third fresh stack (restart). |
| Restart/migration recovery | PASS | `ContradictionTriage.p0.pglite.test.ts` restart gate (full PGlite close/reopen without remigration) plus the db-admin generated-migration proof enforcing tenant-bound identities, digests, and append-only records. |
| Detection never mutates authority | PASS | "refuses a stale proposal digest without touching authority"; "refuses a proposal when a surviving overlap appears after submission"; approval path "approves only the persisted proposal and atomically supersedes one lineage". |
| Tenant-scoped idempotency (codex reflection follow-up) | PASS | "scopes receipt idempotency to the organization without cross-selecting"; "isolates the same candidate key across organizations". |
| Full proof `bun run beep yeet verify` | PASS (after inherited coverage red cleared by #1411) | See "Yeet verify" below and the closing PR's Yeet publish proof. |

## Yeet verify

The first `bun run beep yeet verify` (full tier, lane head `8b7392fe00`) went red
on one lane only: `quality:coverage`, where `@beep/repo-cli`
`Quality.osv-ignore.ts` measured 17/18 branches against a baseline of 100%.
Attribution: **inherited**. That file changed on `main` in PR #1408 (merged
2026-10-05) after the baseline was last written (2026-10-01); this lane's
`packages/tooling/tool/cli` source was byte-identical to `main`, and a scoped
lcov run reproduced the identical 17/18 branch count (`BRDA:95,1,0,0`). PR #1411
("test(repo-cli): cover rejected OSV package overrides") landed the covering
test on `main` the same day, so the lane was fast-forwarded to `ea7b0c6251` and
the inbox row acknowledged against that fix. The publish proof of the closing
PR is the authoritative full-proof record (`.beep/yeet/runs/<run>/verdict.json`
and the PR's "Local proof" footer).
