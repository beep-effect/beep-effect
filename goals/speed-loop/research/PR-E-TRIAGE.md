# PR-E integration triage checklist

Durable checklist for the post-workflow triage pass on `feat/merge-loop`
(power outages have eaten this session twice; the list lives on disk).
Work through after the PR-E workflow (`wf_da334d69-0b9`) completes and
before `yeet publish`.

## Must-fix (block publish)

- [x] **#551 monitor regression (GRILL-DECISIONS #39).** FIXED +
      mutation-proven (re-verify: neutering the guard fails both tests in
      `test/yeet-monitor-phase-empty.test.ts` with the literal production
      error). #61's first matrix row exists.
- [x] **Sweep-engine audit against decision 42.** Verified by adversarial
      review + orchestrator read: (1) no find-based `.git` probes exist —
      detection is `git worktree list --porcelain` (claim 2 HOLDS);
      (2) `FETCH_HEAD` is never read — sweep uses `fetch --prune` +
      `merge --ff-only refs/remotes/...`; (3) sweep's `status --porcelain`
      is a clean/dirty BOOLEAN (any output = dirty), not a change-surface
      count, so `-uall` is not load-bearing there — 42(c) applies to
      future change-surface consumers.
- [x] **Adversarial verify findings.** ALL FIXED — re-verify verdict 7/7
      mutation-proven, full battery green (69 files / 1036 tests, tsgo
      clean, biome clean, schema-first 0, effect-fn 0, previously-HOLDING
      contracts intact). Re-verify's three follow-ups closed by the
      orchestrator in-session: reply preflight now writes the report AND
      exits nonzero (decision 48a, test flipped); rerun teaching pinned
      at the producer (`yeetRerunJobListingCommand`/`yeetRerunDecisionText`
      exported + tested; banned `--failed` literals purged from fixtures).
      Known-unpinned fast-follow: `mergeReady` Ref-update wiring
      (decision 48d, ledger #66/#71). Inherited-only:
      `tooling-schema-first` lane (11 findings pre-existing on main).
      renderJson stragglers deferred to fast-follow (ledger #66).

## Riders (in-scope for PR-E, do before publish if cheap)

- [~] **#61 flag-path matrix**: decision-39 row in fix wave; fuller matrix
      (`--fast --monitor`, `--start-pr-early`, `--staged-only`) only if
      the wave's writer-test helper makes it cheap — else fast-follow.
- [x] **#54 reflection harvest.** Done — ledger #63–70 + evidence block
      (OPPORTUNITIES.md), ratifications as GRILL-DECISIONS #45–47.

## Publish notes

- Publish WITH `--monitor` (the regression-free path) regardless of the
  decision-39 fix landing — belt and suspenders.
- Docs riding this branch: GRILL-DECISIONS.md #39–44, OPPORTUNITIES.md
  #61–62 + handoff-2 disposition block, this file. Decide at publish time
  whether they ride PR-E (packet-state-flip norm) or split docs-only.
- Fleet relay-back owed to beep-effect5 (via operator): decisions 39–44
  ack + the earlyPushStep ruling (marker rides it; grill #5 takes
  blocking-vs-advisory + emergency-push carve-out).
