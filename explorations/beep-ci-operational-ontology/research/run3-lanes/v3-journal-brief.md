# Run-3 lane brief — additive v3 admission-journal events

Lane: Codex (`gpt-6-astra`, xhigh). Orchestrator: Fable. Steward: Benjamin.
Rulings implemented: **Ruling 1** (instrument first) and **Ruling 9** (v3 event set is items
1–4) from `DECISIONS.md` § "2026-09-03 — run-3 corpora design grill". Design input:
`research/run3-corpora-design-brief.md` §2b (line refs there are STALE — main has moved
through #978, #993, #986, #994, #1005, #1011 since the brief; re-derive every anchor from
the checkout you are in).

## Outcome required

One additive, mixed-fleet-safe change to the admission transition journal so that the
grant-contention corpus can carry "contention outcome in one provenance chain" for the
LOSS population too (today an abandoned wait deletes its ticket silently and no enqueue
event exists). Everything lands on the branch `feat/ontology-v3-journal-events` in this
worktree. Commit on the branch. **Do not push. Do not open a PR.** Fable publishes.

## Exact event set (Ruling 9 — verbatim scope, nothing more)

All new rows carry `schemaVersion: "yeet-admission-journal/v3"`. Existing v1 and v2
variants stay decodable and unchanged; the union grows, it never shrinks.

1. `admission-enqueued` — emitted when a request is enqueued (ticket written / claim
   registered). Fields: `nonce`, `pid`, `procStart`, `attemptId` (Option, as today),
   `kind`, `weightTokens`, `priority`, `originKey`, `checkoutRoot`, `branch`,
   `enqueuedAtMillis`.
2. `admission-withdrawn` — emitted from the ticket finalizer when a queued request leaves
   WITHOUT admission (the finalizer that currently deletes the ticket silently). Carry the
   ticket identity (`nonce`, `pid`, `procStart`, `attemptId`, `kind`, `priority`,
   `originKey`, `checkoutRoot`, `branch`, `enqueuedAtMillis`) plus `withdrawnAtMillis`. Add
   a `reason` literal ONLY if the finalizer already knows one without new plumbing (use a
   `LiteralKit` domain); do not invent reasons.
3. `checkoutRoot` + `branch` on the released and evicted rows (`admission-released`,
   `admission-lease-evicted`, `admission-ticket-evicted`). Emit these as v3 variants of the
   existing tags (same `_tag`, new `schemaVersion`, superset fields) so old readers that
   match on v1/v2 keep working and new readers get checkout attribution without the
   Option-`attemptId` join.
4. `lastHeartbeatAtMillis` on `admission-lease-evicted` (v3) — the last heartbeat instant
   observed before the reaper evicted the lease. Today it is dropped at reap; thread it.

Rejected by ruling (do NOT add): capacity/memory stamps at admit/release; the passed-step
attempts-journal enhancement; any change to `AttemptTerminationJournal`.

## Mixed-fleet safety — a hard gate, prove it

The canonical journal (`~/.beep/runtime/beep-admit-uid-<uid>/journal.ndjson`) is shared
by ~49 checkouts on this workstation running DIFFERENT CLI versions. Older CLIs will read
v3 rows. You must prove, with a test, that:

- an older-shaped reader (v1+v2 union) treats a v3 row as an unknown row that is
  preserved byte-for-byte and never quarantined, never treated as corruption, never
  reordered — read the current preservation path in `AdmissionJournal.ts` and the reaper
  and claim-recovery paths changed by #978 / #993 / #1005 before you assume anything;
- the new reader decodes v1, v2, and v3 rows from ONE mixed journal in source order;
- `beep quality scheduler status` (or whatever consumer parses the journal for display or
  reap decisions) does not fail on a mixed journal.

If the current code would choke an older CLI on unknown `schemaVersion` values, stop and
put that finding at the top of the report — it changes the rollout shape.

## Design order (repo law)

Schema → `Context.Service` contract → implementation. Effect v4 only (validate every API
against `.repos/effect`). `Effect.fn` / `Effect.fnUntraced` for generator-returning
functions. `effect/HashMap` etc., never `Set`/`Map`. `LiteralKit` for literal domains (no
`as const`). Class schemas via `extend<X>()({})`. JSDoc on every exported symbol with
`**Example** (Title)` sections — never `@example` / `@remarks`. Tests under
`packages/tooling/tool/cli/test/**` import through `@beep/repo-cli/*` aliases. Reuse
existing test overrides (`RuntimeRootTestOverride`) — search the test tree for how the
existing admitted/released journal tests drive the scheduler and extend those.

## Files you will touch (discover the current anchors yourself)

- `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` — event schemas,
  union, guards, any version-aware decode helpers.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` — enqueue site,
  ticket finalizer (withdrawn), release site, reaper eviction sites.
- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts` only if a
  ticket/lease field is needed and absent.
- Tests: the existing journal and scheduler tests plus new ones for each variant, the mixed
  journal, and the enqueued→admitted→released chain per `nonce`, the withdrawn path, and an
  eviction carrying `checkoutRoot`/`branch`/`lastHeartbeatAtMillis`.
- Docs that describe the journal schema (grep the repo for `yeet-admission-journal/v2`) —
  update them. Do NOT edit anything under `explorations/` (packet edits belong to the
  Stage A PR).

## Verification before handoff

```sh
CI=true bun run beep quality package-verify @beep/repo-cli
bun run docgen:local
```

`CI=true` matters: a live 1Password session takes `op` off PATH inside package-verify and
fails an unrelated task. Attribute every red before touching it — introduced / inherited /
unrelated / environment-only; only introduced reds are yours to fix. If an inherited red
exists on `origin/main` for the same task, say so in the report with the command that
proves it and leave it.

## Report

Write `<s5-checkout>/explorations/beep-ci-operational-ontology/research/run3-lanes/v3-journal-report.md`
(the directory is passed as a writable `--add-dir`). Contents, in this order:

1. Mixed-fleet safety verdict with the file:line evidence and the test that proves it.
2. Event schema table (tag, schemaVersion, fields, which are new).
3. Call-site table (event → `QualityScheduler.ts` function + line on your branch).
4. Files changed, tests added (names), verification command output summaries.
5. Open questions / anything you deliberately left out and why.
6. The commit SHA(s) on `feat/ontology-v3-journal-events`.

## Hard rules

- Never `git add -A`; stage the files you changed by name.
- Never push, never open a PR, never merge, never force anything.
- Public repo: no absolute home paths, machine ids, or secrets in committed files.
- Never modify frozen packet artifacts (`explorations/**/extraction/**`,
  `etl_fleet_corpus.py`, `run2-fleet/`).
- Commit messages: conventional (`feat(repo-cli): journal admission enqueue and withdrawal (v3)`),
  body lines wrapped under 100 characters.
