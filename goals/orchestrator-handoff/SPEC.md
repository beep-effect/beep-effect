# Orchestrator Hand-off Spec

## Objective

The orchestrator role (AGENTS.md "Autonomy") must survive the session that holds it. A successor
takes it over from files alone: the session ledger says who holds it, the register says what is
coordinated and what to do if a unit cannot be reached, `HANDOFF.md` says what is in force and
what comes next, and the merge gate is a CLI command rather than a scratchpad script.

## Non-Goals

- Replacing the fleet desk, the session ledger, or Yeet's monitor.
- Automating the hand-off end to end (the P2 renderer and converters are follow-ups).
- Any orchestrator state inside the repository: every file the role lives in is workstation state.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Session/` (role, register schemas and service, commands).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MergeGate.ts` and the `merge-gate`
  subcommand.
- `.claude/skills/orchestrate/` (SKILL.md, HANDOFF.template.md, gate.sh).
- `AGENTS.md` Autonomy (one pointer line).

## Constraints

- Schema first; Effect v4; `LiteralKit` domains; `HashMap`/`HashSet` only.
- Tests use recorded GitHub payloads; no live calls.
- The gate fails closed on every unknown (ruleset, thread count, head commit time, unregistered
  required context).
- Non-required reds are tolerated only with a written attribution that is echoed in the merge line.

## Acceptance Criteria

- [ ] `bun run beep session open` prints the orchestrator holder first; old ledger rows decode.
- [ ] `session register add|list` appends and renders the register; the Markdown table is what
      `HANDOFF.md` embeds.
- [ ] `yeet merge-gate <pr> <sha>` reproduces `merge.sh` (head pin, draft, required contexts,
      attributed tolerances, 20-minute window, thread re-read, squash `<title> (#n)`) and is
      proven on recorded fixtures.
- [ ] The `orchestrate` skill has take-over, run and hand-off procedures with the hand-off trigger
      and smart-zone rules.
- [ ] AGENTS.md Autonomy points at the skill.

## Decision Log

| Decision | Ratified contract | Reason | Reversal |
| --- | --- | --- | --- |
| Register location | `~/.local/state/beep/orchestrator/<host>__<owner>__<repo>.jsonl` (override `BEEP_ORCHESTRATOR_STATE_ROOT`), not `~/.cache/beep/orchestrator/` and not rows inside the session ledger. | The register is the one artifact a successor cannot rebuild from chat; `~/.cache` is disposable by contract. Ledger rows are keyed by checkout and only model harness sessions; the register models non-checkout units (agents, Codex lanes, jobs, systemd units, people). Same resolver family as the ledger and the PR-session registry, so one state root governs all three. | Move the file; the service resolves its directory in one place. |
| Rendered register | Rendered on demand by `session register list --markdown`; `HANDOFF.md` embeds it. No second file of record. | One source of truth; a rendered copy that drifts is worse than none. | Add a writer that emits `REGISTER.md` next to the JSONL. |
| Role on the ledger | `role: orchestrator \| member` as an optional key on `session-ledger/v1`; schema version unchanged. | Old rows must keep decoding; `OptionFromOptionalKey` makes the key optional on the wire. The newest open orchestrator row wins, so a hand-off is two appends, never a delete. | Bump to `session-ledger/v2` with a required key when every writer is updated. |
| Skill shape | Extend the existing `orchestrate` skill (merged in #1448) rather than `closeout`. | The role already had a skill with the loop and the operator desk; `closeout` is every session's stopping-point prompt and must not carry one role's procedures. | Split the three procedures into their own skill if the file outgrows one read. |
| HANDOFF.md | A template (format), not a schema, in P1. | The data behind rulings and promises is prose the orchestrator writes at the moment of the event; a renderer needs a rulings store that does not exist yet. The register section is machine-rendered. | P2 `beep session handoff` renders from the register, ledger and a rulings JSONL. |
| Merge gate home | `yeet merge-gate <pr> <sha>` as a new subcommand, not an extension of `yeet ready` or `yeet merge`. | `ready` flips a draft and runs from the owning branch; `merge` merges the current branch and sweeps. The gate takes any PR, pins a head, never sweeps, and is the orchestrator's verb. | Fold into `yeet merge --gate` when the sweep tail is made optional. |
| Non-required reds | Tolerated only via `--tolerate "<check>=<attribution>"`; pending non-required checks hold unless tolerated the same way. The rate-limited Vercel exception is also expressed as a tolerance. | The operator's 2026-09-29 rule (Lint Policy / Coverage may be red at merge when a fix is in flight) is an attribution, not a name. `merge.sh` tolerated Coverage by name and `gate.sh` deferred pending runs; both are now explicit. | Add a `--vercel-rate-limit` convenience that pre-fills the attribution from the run description. |
| Review window | The gate reads the window through `readYeetReviewWindow` (push-first-publish D11, #1483): 20 minutes by default, `BEEP_YEET_REVIEW_WINDOW`, anchored on the later of ready-for-review (PR creation when opened ready) and the head push (earliest check suite). `--force-window` replaces `FORCE_WINDOW=1`, is printed on every use, and never overrides an unknown window. | Operator ruling 2026-10-06. One definition must govern `yeet ready`, the monitor and the gate; the first draft of this gate measured from the head commit date, which a rebase or an old local commit makes wrong. A flag is visible in the command line the hand-off log keeps, an env var is not. | Set `BEEP_YEET_REVIEW_WINDOW`; the reader is the single seam. |
| Thread count | One GraphQL page (100); more threads than one page, or any GraphQL failure, is `unknown` and holds. | `merge.sh` behaviour; a lower bound is never a count. | Page the query. |
| Hand-off trigger | Two compactions in a row, eight hours in role, or inability to name every live unit from the register without chat. | The operator named "several compactions in a row" as the signal; the other two make it checkable before it is felt. | Edit the Smart zone section. |
| Shared store | `internal/state/JsonLinesStore.ts` (`makeJsonLinesStore`, `partitionJsonLines`, `newestPerKey`) backs both the session ledger and the register. | The register's first draft copied the ledger's append/list, line decoding and newest-per-key reduce; fallow flagged three introduced clone groups. Two stores with one behaviour (private modes, corrupt-line tolerance, missing file = empty) must not drift. | Inline the helper back into each service. |
| Register row shape | `owns` is a list of strings and `state` a four-value domain (`active`, `blocked`, `unreachable`, `retired`); free text goes in `note`, the human label in `name`. | The first hand-written `REGISTER.jsonl` (2026-10-06) used an object for `owns` and prose for `state`; a successor cannot filter prose, and "retired" must be machine-readable for rows to drop out. | Widen `state` or add fields under a new `schemaVersion`. |
| Gate decision shape | `decideMergeGate` folds four checks (structural, checks, window, threads) with `O.firstSomeOf`; first hold wins. | Keeps each criterion readable on its own and under the repo's cognitive ceiling; the order is the hand-run gate's. | Reorder the list. |
| Relayed rulings | The orchestrate skill records two operator rulings relayed on 2026-10-06: Codex delegation ("Codex edits, owner commits") and REST first with GraphQL behind a budget guard, planned as `beep yeet gh` on `@effected/github`. | Relayed by the orchestrator session; no verbatim text, so the skill marks them paraphrased rather than quoting. | Replace with the verbatim wording when the operator states it. |
