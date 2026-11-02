# Cloud doctrine: credit meter and MCP table (P4 D6/D7) — 2026-11-02

Scope: the two P4 doc obligations still missing on `main` at `14a4596d`. D6
asks for a fourth (cloud) meter in `docs/runbooks/agent-pools.md`; D7 asks for
a runbook table of MCP expectations in `docs/runbooks/cloud-environments.md`.
This lane owns those two runbooks and this note only. No `AGENTS.md`,
settings, `.mcp.json`, bootstrap, source, manifest, baseline, network or
secret change. **P4 stays `pending`**: the `AGENTS.md` host variable, can/cannot
rubric and D4 end state, and the `docs/ROADMAP.md` accelerator row are still
open. P2, P5 and P6 are unchanged. No phase or lifecycle flip.

Run: one Claude cloud session (single repository, outside a project thread),
`claude-opus-5-5` medium, no child agents or fallbacks, spending only the
account's automatic cloud-session bonus credit. Branch
`codex/cloud-doctrine-meters` cut from fresh `origin/main` before any edit.

## What landed

- `agent-pools.md` gains `### Cloud (Claude cloud session credit)` under
  Meters: eligibility, eligible and excluded surfaces, order of spend, the
  weekly-banner rule, paid usage off, expiry, how to read it, admission. It
  links the cloud runbook, which satisfies the SPEC Verification Matrix
  cross-link row for this file. The Opus meter's credit mention now points to
  it.
- `cloud-environments.md` replaces the MCP prose bullet with an evidence-bound
  table, names vendor-provided, retired and historical servers separately,
  links the meter, and adds a per-vendor qualification table.

## Evidence

- Credit doctrine: the public article
  [Cloud sessions bonus credit promotion](https://support.claude.com/en/articles/17152539-cloud-sessions-bonus-credit-promotion),
  read 2026-11-02 (page shows no exact update date). Key lines: the credit
  had to be claimed by October 7 at 11:59 PM PT unless the account was
  auto-granted it; once held, it applies automatically when a cloud session
  starts; while credit remains, cloud usage is paid for by the credit and does
  not count toward plan limits; usage credits are not needed; Projects,
  Routines, Remote Control, chat and Cowork are excluded; expires November 4
  at 11:59 PM PT. Daylight time ended 2026-11-01, so that is PST (UTC−8):
  `2026-11-05T07:59Z`. No account balance, email or session id is recorded.
- MCP table: server names and transports from `.mcp.json`; approvals from
  `.claude/settings.json`, both at `14a4596d`. Observations are vendor start
  reports only: the startup and cold resume recorded in
  [`2026-11-02-mcp-scoping-hook-evidence`](./2026-11-02-mcp-scoping-hook-evidence.md)
  (#2510), plus this session's start, which reinstalled a few packages and
  reported `nlp` and `fallow` connected, `shadcn` and `next-devtools`
  connect-timeout (30 s), `beep-m365-outbox` `op` not found, and `stately` and
  `phoenix-docs` proxy-refused (403). The hermetic hook harness in #2510 is a
  simulation and is not counted as MCP evidence.
- Host scoping: no new research. The table reuses #2510's bounded negative
  (no documented host-conditional MCP syntax in the reviewed sources) and
  invents no mechanism.
- Vendor status: Claude smokes on two accounts have public receipts
  (#2486 and the fleet note); two more were reported privately and are not
  counted. Codex publication failed twice without diagnostics and is not
  runnable. Cursor has a bootstrap snapshot and no agent proof. Nothing here
  upgrades any of those.

## Decisions

| Decision | Reason | Reversal |
| --- | --- | --- |
| A weekly-limit banner alone does not hold a cloud lane for quota; only an actual, attributed quota or rate-limit refusal does, and it steps down the Claude chain. A refusal does not prove the bonus is spent. Ownership, setup, secret and data boundaries and required capabilities still gate admission. | Grounded on the article's line that while credit remains, cloud usage is paid for by the credit and does not count toward plan limits. The first draft cited the article's unrelated "separate from weekly-limit changes" sentence and said a lane was blocked *only* by quota; both were corrected after review on PR #2536. | Revert the "Weekly-limit banner" row and the Admission paragraph. |
| Eligibility requires a claim by 2026-10-07 23:59 PT or an automatic grant; the credit is spent automatically only once held. | The first draft omitted the claim step (independent review on PR #2536). | Revert the "Eligible accounts" and "Order of spend" rows. |
| The `nlp` and `fallow` rows say "expected to connect", with a connection-only limit, not "qualified". | Start reports show connection, not tool execution; D42 reserves "qualification" for receipt-backed verdicts. The first draft said "qualified" (review on PR #2536). | Edit the two rows and the scope paragraph. |
| The meter carries the article's rules, not per-account balances. | Public repo; balances are account state. | Revert the section. |
| `webstorm` and `phoenix` rows describe the endpoint kind (loopback IDE, private tailnet) without repeating the tailnet hostname. | Keep host detail out of new prose; `.mcp.json` remains the source. | Edit the rows. |
| The table states its scope and evidence date instead of claiming general availability. | Two sessions, three starts; timeouts have no established cause. | Edit the scope paragraph. |

## Friction

- The session launcher checkout was stale; fetching `origin/main` before
  branching moved it from `352bac46` to `14a4596d`. Prevention: the launcher
  should branch from a fresh fetch.
- `shadcn` and `next-devtools` timed out again on a start that reinstalled
  dependencies. The cause is still unmeasured; the P2 owner holds it.
- The older 2026-11-01 admission capture under this packet is retained
  unchanged as history.
- The first `yeet final-check`, run at the first head (`2d42a18b`), wrote no
  receipt. Its `cheap-gates` went red on `observability:catalog-check`
  (`standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc: stale`)
  and was then stopped by a 25-minute session ceiling (exit 124). The later
  gates (`lint-policy`, `lint`, `repo-sanity`, `check`, `docgen`, `fallow`,
  `coverage`) never ran. That red is kept on record.
- Attribution correction. The first PR comment and the first version of this
  note called the red VM-local because the diff touches only Markdown and
  hosted `Repo Sanity` and `Codegen Drift` were green. That inference was
  wrong: green checks that may not run the catalog check say nothing about its
  cause. The actual base comparison: on a detached checkout of the merge base
  `14a4596d`, `beep observability catalog --check` exits 1 with the same
  stale shard. `--write` there adds exactly one entry,
  `QualityTasks.runRootAuditPackagesTask` (`@beep/repo-cli`), the span
  source-verified missing in #2490. The red is therefore **inherited from
  `main`**, not introduced here and not shown to be VM-specific. The
  regenerated file was discarded. Its fix belongs to the open #2537; this PR
  neither regenerates nor copies it, and changes no baseline.
- A second `final-check` at `fbfa78a5` (with `cheap-gates` parked for the
  inherited red) was stopped by its owner during `lint-policy`, because this
  correction makes that head stale. It wrote no receipt.

## Verification

Results live on the PR, per head, not in this note: markdown and cross-link
checks, `git diff --check`, and `yeet final-check` at the content-final head.
Any skipped gate is named and reasoned there. Skipped is not passing, and a
receipt for an earlier head does not cover a later one.
