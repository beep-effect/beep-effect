# Run-3 lane brief — v3 journal PR review fixes (PR #1025)

Lane: Codex (`gpt-6-astra`, xhigh). Orchestrator: Fable. Worktree:
`beep-effect8-worktrees/ontology-v3-journal`, branch `feat/ontology-v3-journal-events`, head
`dfeba80cbf` (the commit implementing `v3-journal-brief.md`; read that brief and
`v3-journal-report.md` first). Three review findings from the Codex review connector are
open on the PR. Fable's prior read: all three are plausible. Your job: verify each against
the code (refute with file:line evidence if wrong), fix the ones that hold, prove with tests,
commit on the branch, and write the report. This lane MAY commit (the sandbox has the git
common dir writable and network access on). Do not push. Do not touch the PR.

## Finding 1 (P1) — fence v3 evictions from pre-v3 recovery workers

`QualityScheduler.ts` ~`:750` (`admissionEventForReapClaim`). Claim: in a mixed fleet, a v3
eviction row is appended, then the reaper dies before persisting the claim's
`admissionJournal: "complete"` marker; a checkout on a pre-v3 CLI recovers the same durable
claim, its reader treats the v3 row as opaque, the append-once identity check cannot see
the existing lifecycle, and it appends a second (v2) eviction row — the ticket arm likewise.

Fable's fix direction: use the EXISTING protocol marker as the fence. Today "a missing,
unreadable, or undecodable marker means the rollout is not proven, so eviction rows remain
disabled" and "a disabled gate leaves the durable reap claim pending". So: bump the eviction
protocol marker to a new schema version that pre-v3 readers cannot decode, make v3 emission
require that new marker, and have `publishAdmissionProtocol` write the new version. Effect:
old workers see the gate as disabled, leave the claim pending, never duplicate; the next
v3-aware reaper completes it. Verify this reasoning against the actual marker schema,
decoder, and `appendAdmissionEvictionJournalEvent`'s idempotence scan before implementing.
If a cleaner fence exists (e.g. the claim file itself recording the emitting protocol
version so old workers skip it), argue it in the report and pick the smaller one. Add a test
that models the crash window: v3 row present, claim not complete, old-reader recovery →
no second row. Update the README section the previous lane wrote.

## Finding 2 (P2) — cap queue-only journal growth

`QualityScheduler.ts` ~`:2083` (enqueue append) and the withdrawal append. Claim:
`rewriteJournalLocked` advances its retention boundary only past the 200th-newest
`admission-admitted` row; with capacity unavailable and queued attempts repeatedly
cancelled, each attempt adds two known rows (enqueued + withdrawn) that are never trimmed,
so the journal grows without bound and every best-effort append rewrites the whole history.

Fable's fix direction: keep the admitted ring at 200 exactly as it is (the corpus
`complete_within` receipts depend on it) AND add a bound on total retained known rows —
e.g. newest N known rows overall (pick N so a full admitted ring with its enqueued/released
partners fits comfortably; document the number as a named constant with the arithmetic in
its JSDoc). Unknown (opaque) rows keep their existing preservation behaviour. Prove with a
test: many enqueued/withdrawn pairs and zero admissions → retained rows bounded; the
existing 200-admitted-retention tests still pass unchanged.

## Finding 3 (P2) — the ciops live-journal replay schema rejects v3 rows

`apps/labs/ciops/src/projection/Schemas.ts` (~`:751-756`, the lab's own journal event
union) accepts only v1 admitted/released and v2 evictions; `Replay.ts` (~`:214-218`)
rejects the whole source when any line fails to decode. After this PR a live journal
contains v3 releases/evictions plus enqueued/withdrawn rows, so the S7 differential replay
(and run 3's Stage B replay) would fail outright.

Fix: widen the ciops union to decode every v3 variant (mirror the CLI schemas — the lab
keeps its own copy deliberately; do not import `@beep/repo-cli` internals into the lab),
and make the replay fold treat `admission-enqueued` and `admission-withdrawn` as
ledger-neutral (they change no admitted charge; decide and document whether they count
in the episode event index — Fable's preference: they DO count, so `eventIndex` keeps
meaning "zero-based decoded source-event index" exactly as PR #1024 documents it). Add a
fixture with mixed v1/v2/v3 rows and a replay test. Keep `bun run evidence:s7 --check`
green (frozen evidence unchanged). NOTE: PR #1024 (`feat/ontology-s7-emission-v2`) also
edits `apps/labs/ciops/src/projection/Schemas.ts` and `Replay.ts` (episodeId, ~lines
324-420 and ~310/420); keep your edits confined to the journal-event region so the two
branches merge cleanly, and say in the report which hunks you touched.

## Design order and law

Schema → service → implementation; Effect v4 only (validate against `.repos/effect`, run
`scripts/setup-effect-ref.sh` if the symlink is missing); `Effect.fn`/`fnUntraced`;
`effect/HashMap` etc., never `Set`/`Map`; `LiteralKit` for literals; JSDoc with
`**Example** (Title)` on every export; tests import through `@beep/*` aliases. Never
`git add -A`. Never touch `explorations/` in this worktree.

## Verification

- Scheduler suites natively with the thread pool (the fork pool hangs in-sandbox):
  `bunx --bun --no-install vitest run --root packages/tooling/tool/cli --pool threads --maxWorkers 1 test/quality-scheduler.test.ts test/quality-scheduler-drift.test.ts test/quality-scheduler-degraded-inputs.test.ts test/process-identity.test.ts`
- ciops: `CI=true bun run test` from `apps/labs/ciops`, plus `bun run evidence:s7 --check`.
- Typecheck via the Bun-hosted shim: `bun tools/tsgo-shim/tsgo.js -p packages/tooling/tool/cli/tsconfig.check.json` and the ciops tsconfig.
- `bun run docgen:local`, Biome on touched files, `git diff --check`.
- `CI=true bun run beep quality package-verify @beep/repo-cli` and `... @beep/ciops` — if a
  Node `spawnSync EPERM` reproduces, attribute it environment-only exactly as the prior
  lane did and rely on the Bun-hosted checks above; say so.

## Commit and report

One commit per finding is fine, or one bundled commit; subjects like
`fix(repo-cli): fence v3 evictions behind a v3 admission protocol marker`. Do not push.
Report to `<s5>/explorations/beep-ci-operational-ontology/research/run3-lanes/v3-journal-review-fixes-report.md`
with, per finding: verdict (holds / refuted, with evidence), the fix, the test that proves
it, and a one-paragraph reply Fable can post verbatim on the thread. End with commit SHAs
and the verification table.
