# Run-3 lane brief — synthetic admission scenario spec (Ruling 10 producer)

Lane: Codex (`gpt-6-astra`, xhigh) implementing; Fable designed this brief, reviews, and
publishes. Steward: Benjamin. Rulings implemented: **10** (fixture-induced eviction and
withdrawal, labeled synthetic), **19** (the producer is a repo-cli spec with an export
switch), **21** (this spec is PR-1, alone on its branch). Read `DECISIONS.md` sections
"run-3 corpora design grill" (Rulings 1–16) and "Stage B capture grill" (Rulings 17–21)
in the s5 checkout before writing code.

Work happens ONLY in the worktree `~/YeeBois/projects/beep-effect8-worktrees/ciops-synthetic-fixture`
(branch `feat/ciops-synthetic-admission-fixture`, based on origin/main `d1b4d769fb`).
Commit on the branch (stage by path); **do not push, do not open a PR**. Never touch
`explorations/` in that worktree. The only file you write outside the worktree is the report
(path below) and the exported synthetic root (path below).

## Read first

- `AGENTS.md` (repo laws; note the test-import rule: `@beep/*` aliases into package source,
  relative imports only for local helpers).
- `packages/tooling/tool/cli/test/quality-scheduler.test.ts` — the three scenarios you build on:
  "journals an enqueued-withdrawn chain when a waiting contender is interrupted",
  "keeps a protocol-disabled eviction sink pending until one enabled pass acknowledges it",
  "requires protocol v2 before emitting v3 evictions"; and the module-local helpers
  `withAdmissionTempRoot`, `writeProtocolDeferredLeaseFixture`, `withPrependedPath`,
  `readJournalEvents`, `readAttemptJournalEvents`, `request`, `fastConfig`, `listDirectory`.
- `packages/tooling/tool/cli/src/test/RepoRun.test-kit.ts` (what the kit already exports:
  `AdmissionJournalEvent` guards, `setAdmissionEvictionProtocol`, `writeAdmissionProtocol`,
  `reapAdmissionState`, `AdmissionEvictionJournal`, `withQualityAdmission`, …).
- `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` (v3 event classes:
  `admission-enqueued`, `admission-withdrawn`, v3 released/lease-evicted/ticket-evicted,
  `AdmissionProtocol`), `QualityScheduler.ts` (reap claims, `pending-protocol-off`,
  `admissionEventForReapClaim`, `processReapClaim`), `RuntimeRoot.ts`
  (`provideRuntimeRootForTesting`, `RuntimeRootTestOverride`).

## Deliverable

One new spec: `packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts`.
It is a real regression test first and a fixture producer second.

### Scenario (one `it`, deterministic apart from instants and uuids)

Under a temp admission root provided through the runtime-root override (reuse the temp-root
pattern of the existing spec; lift shared helpers into a local `test/helpers/` module ONLY if
the change to `quality-scheduler.test.ts` is import-only and its behaviour is untouched —
otherwise duplicate the minimal helpers in the new spec):

1. Publish protocol v2 with eviction **on** in the temp root before any admission.
2. Capacity fits exactly one contender. Contender A (attemptId set, checkout root + branch
   set on the request) is admitted and holds its lease.
3. Contender B enqueues behind A and is interrupted while waiting → `admission-enqueued`
   then `admission-withdrawn` for B's nonce (mirror fields as the existing chain test).
4. A dead-owner **lease** fixture and a dead-owner **ticket** fixture exist in the root
   (reuse the deferred-lease fixture pattern; add the ticket twin: a queued submitter whose
   pid/start identity is dead), each bound to its own fixture checkout root under the temp
   dir so attempt journals get written per checkout.
5. `reapAdmissionState({ apply: true })` with the eviction journal service provided →
   exactly one `admission-lease-evicted` v3 row (with `checkoutRoot`, `branch`,
   `lastHeartbeatAtMillis`, `reason: owner-dead-or-reused`) and one
   `admission-ticket-evicted` v3 row (`reason: queued-submitter-death`), claims dir empty
   afterwards, one `attempt-terminated` row in each fixture checkout's attempt journal.
6. A finishes → `admission-released` v3 carrying `checkoutRoot` + `branch`.

Assert: the journal `_tag` multiset and the per-nonce chains (A: enqueued→admitted→released;
B: enqueued→withdrawn; the two evictions), every row decodes through the `AdmissionJournalEvent`
guards with `schemaVersion: yeet-admission-journal/v3` where the class is v3, the withdrawn row
has no `weightTokens`/`reason`, a second reap is idempotent (no duplicate eviction rows), and
no lock files remain.

### Export switch

When `process.env.BEEP_CIOPS_SYNTHETIC_ROOT` is set and non-empty, after the assertions pass
copy into it:

- `admission/` — the temp admission root's `journal.ndjson`, `protocol.json`, and the
  `leases/`, `queue/`, `claims/`, `quarantine/` directories (empty directories included as
  receipts). NEVER copy `*.lock` files or lock sidecars.
- `checkouts/<label>/.beep/yeet/runs/**` — for A's checkout and both fixture checkouts,
  with `<label>` = `contender-a`, `dead-lease`, `dead-ticket`.
- `scenario.json` — `{ producer: { path, sha256 }, steps: [...], capturedAt, expected: { tags:
  {...counts}, chains: [...] } }` where `sha256` is computed at run time over the spec's own
  source bytes (`import.meta.url` → read file → sha256), and `path` is repo-relative.
- `READY` — an empty marker written LAST, after every copy completed.

Refuse (fail the test with a clear message) if the target directory exists and is non-empty.
Never write outside the temp dir when the variable is unset. Raw `pid`/`procStart` values and
absolute temp paths in the export are expected — the Stage B generator redacts; this spec does
not.

### Proof before handoff

1. `bunx vitest run packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts`
   green (also run the existing `quality-scheduler.test.ts` if you touched it).
2. Export once: `BEEP_CIOPS_SYNTHETIC_ROOT=~/.cache/beep/ciops-synthetic-root bunx vitest run <spec>`,
   then list the exported tree in the report (paths under `~`, never the full home prefix)
   and paste `scenario.json`. That directory is the hand-off to the Stage B lane; leave it.
3. `bun run beep quality package-verify @beep/repo-cli --quick`, then the full
   `bun run beep quality package-verify @beep/repo-cli`. Attribute any red as introduced /
   inherited / environment-only (known environment-only classes on this station: Node
   `spawnSync EPERM` inside the sandbox, `op` absent from PATH with a live 1Password session,
   read-only uv cache). Hosted CI is the proof of record; local reds are reported, not fought.
4. `bunx oxlint --quiet --disable-nested-config <spec>` clean (Lint Policy's "hoist
   `Schema.is`/`decodeEffect` to module scope" is an Oxlint rule).

## Commit

`feat(repo-cli): add the synthetic admission eviction scenario spec` — body lines wrapped
under 100 characters, stating the export switch and that the scenario is Ruling 10's
producer. Stage by path; never `git add -A`; never push.

## Report

Write `~/YeeBois/projects/beep-effect8-s5/explorations/beep-ci-operational-ontology/research/run3-lanes/synthetic-fixture-report.md`:
the spec path and sha256, the asserted tag multiset and chains, the exported tree listing and
`scenario.json`, every verification command with its verdict and attribution, any deviation
from this brief with reasons, open questions, and the commit SHA.

## Hard rules

- Public repo: no absolute home paths, hostnames, uids, pids, or session ids in committed bytes
  (the export directory is outside the repo and exempt).
- Do not change scheduler behaviour. If the scenario cannot be produced without a source
  change, stop, write the report with the exact blocker, and do not commit a source edit.
- No `Set`/`Map`: `effect/HashSet`, `effect/HashMap` (and Mutable variants) only; Effect v4
  APIs only (`.repos/effect` is the reference); generator functions via `Effect.fn` /
  `Effect.fnUntraced`.
