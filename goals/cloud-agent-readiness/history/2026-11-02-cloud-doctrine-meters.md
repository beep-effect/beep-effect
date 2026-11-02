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
  read 2026-11-02 (page shows no exact update date). Key lines: credit applies
  automatically once a cloud session starts; while it remains, cloud usage
  does not count toward plan limits; usage credits are not needed; Projects,
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
| A weekly-limit banner alone is not a cloud admission blocker; only a concrete quota refusal is, and it steps down the Claude chain. | The article says the bonus is separate from weekly-limit changes and spends first. | Revert the "Weekly-limit banner" row. |
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

## Verification

Recorded in the PR body: markdown and cross-link checks, `git diff --check`,
and `yeet final-check` at the pushed head, with any skipped gate named and
reasoned there. Skipped is not passing.
