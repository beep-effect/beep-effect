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
- `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts` and `GhOps.ts`
  (`recordInheritedRedsInPullRequestBody`, `spliceYeetInheritedRedsSection`) for the S11
  `yeet ready --inherited` flip.
- `.claude/skills/orchestrate/` (SKILL.md, HANDOFF.template.md, gate.sh).
- `AGENTS.md` Autonomy (one pointer line).

## Constraints

- Schema first; Effect v4; `LiteralKit` domains; `HashMap`/`HashSet` only.
- Tests use recorded GitHub payloads; no live calls.
- The gate fails closed on every unknown (ruleset, thread count, head commit time, unregistered
  required context).
- Non-required reds are tolerated only with a written attribution that is echoed in the merge line.

## Acceptance Criteria

- [x] `bun run beep session open` prints the orchestrator holder first; old ledger rows decode.
- [x] `session register add|list` appends and renders the register; the Markdown table is what
      `HANDOFF.md` embeds.
- [x] `yeet merge-gate <pr> <sha>` reproduces `merge.sh` (head pin, draft, required contexts,
      attributed tolerances, 20-minute window, thread re-read, squash `<title> (#n)`) and is
      proven on recorded fixtures.
- [x] The `orchestrate` skill has take-over, run and hand-off procedures with the hand-off trigger
      and smart-zone rules.
- [x] AGENTS.md Autonomy points at the skill.

## Decision Log

| Decision | Ratified contract | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-11-02: the `orchestrate` and `operator-handoff` messaging, route and broadcast mechanics are T3 Code MCP tools (`t3_thread_send`/`wait`/`read`, `delegate_task`, `t3_thread_launch`, `schedule_task`, `environmentId`); the take-over, run and hand-off procedures this packet owns are unchanged. | `goals/t3-native-orchestration` SPEC.md (Target Surfaces, Constraints) | The beep agent-message stack those skills routed through was deleted; T3 is the only cross-session route. | Revert the t3-native-orchestration retirement PR; the procedures need no change either way. |
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
| Relayed rulings | The orchestrate skill quotes two operator rulings of 2026-10-06 verbatim: Codex delegation ("delegate work to codex using GPT 6 Sol", recorded as `gpt-6.1-sol` medium with "Codex edits, owner commits") and REST first ("Use rest api & gh secret." / "in op."), with GraphQL behind a budget guard and `beep yeet gh` on `@effected/github` as the planned home. | Quoting avoids paraphrase drift; the model id and the commit rule are the skill's gloss, marked as such. | Edit the quotes if the operator restates them. |
| S11 relaxed gate | `yeet merge-gate <pr> <sha> --relaxed` replaces `merge-gate-relaxed4.sh` in the CLI: the head, draft and conflict holds, the ruleset failing closed, the review window and the thread re-read all stay, and a head on which not one required context has run still holds (no CI evidence, the #1502 mode); otherwise red and pending checks, required ones included, never hold and are recorded with their attribution (the `--tolerate` text, else the S11 default) in the merge line and one PR comment; after the merge the head's active workflow runs are cancelled across all pages. The comment and the cancels are best effort and only warn; only runs whose `head_sha` is the merged head are cancelled. Deliberate differences from the script: GitHub's PUT decides an unknown mergeability (the script waited for it), the squash commit message is not set from the PR body, and outstanding threads use the stricter AGENTS.md count. | Operator ruling S11 (2026-10-09), standing repo-wide since 2026-10-13 (AGENTS.md "Mergeable"); S11 merges ran through an out-of-repo script the successor could not see or test. | Drop the flag; the strict gate is unchanged. |
| S11 ready flip | `yeet ready --inherited "<check>=<attribution>"` (repeatable): a failing required check that is attributed this way does not hold the flip; the applied attributions are written to a marked "Inherited reds (S11)" section of the PR body before the flip, a failed write refuses the flip, and a census that counts more failing required checks than it names still refuses. Round-one body-race repair uses the approved bounded REST fallback (three fresh-read/re-splice rounds, then refusal) rather than generalizing the subprocess-based provenance writer; readback and a post-record ready confirmation fail closed. Every flip reconciles the section, pinning the heading to the head and rewriting an older record to explicit "None: no required check is red on this head." when no inherited reds apply; an empty set without an existing section adds nothing. Empty-set cleanup is best effort: body read/write failures warn and the flip proceeds after gate confirmation; non-empty applied attributions remain fail-closed. | S11 requires each inherited red to be recorded; PRs were leaving draft through a bare `gh pr ready` with the record written by hand. | Revert the inherited-red flag and marked-section recorder together; the default flip currently attempts best-effort stale-section cleanup, so dropping only the flag does not remove that body reconciliation. |
| Ownership (2026-10-14) | The two S11 flags were built by the stacked-pr-adoption follow-up session under operator ruling S23 ("I want things done"), routed by the orchestrator while this packet's owner was not live. They stay in this packet's surface: `MergeGate.ts` is a Target Surface. | Keeps the merge gate's contract in one packet. | Move the rows to the packet that takes the gate over. |
| Private CLI release notes (2026-10-14) | Keep the S11 change in this packet without a Changesets release note while `@beep/repo-cli` is private. | The worker brief requested a patch note, but hosted Repo Sanity on #1678 rejected it: private workspaces must not accumulate release notes. The package's release policy governs the ceremony; all seven locked design decisions remain intact. | Add the patch note when a separate publication-activation change makes the workspace publish-enabled. |

| S11 own-red hold (2026-11-02) | `yeet merge-gate --relaxed` now tells a red required check the PR introduced from one it inherited and holds on the former: a red is inherited when the same check is not a completed success on the PR's merge-base commit nor on the base tip (`compare/<base>...<head>` names both; each commit's latest check run per name: red, pending or absent all count, and green on either commit makes the red the PR's own, because hosted CI tests the head on the base tip, so a `main` red fixed after the merge-base never excuses a PR red and a base tip still running opens no window), when `--tolerate` or the PR body's "Inherited reds (S11)" section attributes it (the body record counts only when its `at <head>` stamp matches the head under the gate; a push after the flip falls back to the base evidence), or when the PR carries the `unblocks-main` label (such PRs stay force-mergeable as before); every other required red is the PR's own and the gate prints `HOLD own-red: <check> (base run <id> green at <merge-base|base tip> <sha10>)` and exits 1, a line with no pending word so the orchestrator's loop stops instead of merging. An unattributed red with an unreadable merge base holds as `base-runs-unknown`: an unknown base never proves a red inherited. Merged-over reds record the evidence as their attribution (the `--tolerate` text, else the label, the body record or the base run) in place of the S11 default. `--force-window`, the strict gate, pending checks and every other hold are unchanged. | On 2026-11-02 the orchestrator ran about thirty S11 merges and the relaxed gate merged two PRs over reds those PRs themselves introduced: #2522 (a stale `@beep/git` schema-catalog shard, Repo Sanity) and #2526 (`repo-cli-3` package-scripts test expectations after the audit-script drop); each turned `main` red and cost a separate unblocker (#2530 for the shard, the create-package expectations fix for the tests). The orchestrator had been stopping gate units by hand once it attributed a red as the PR's own; the gate should make that distinction itself. | Drop `ownRedHold` from the relaxed step in `MergeGate.ts` and the `labels`, `attributedChecks` and `baseRuns` fields of `MergeGateRead`; the compare and base check-run reads go with them. |

### S11 round-one review guards (2026-10-14)

The merged head cancellation census uses one paginated REST listing with
`head_sha` and `per_page=100`. Only decoded runs on the merged head whose status
is not `completed` are cancelled, including future non-terminal statuses.
Listing and each cancellation remain independently best effort.

The inherited-red record uses the amendment's bounded REST fallback: re-read
immediately before writing, re-splice changed text for up to three rounds, then
refuse without writing if it never stabilizes. A matching REST readback is
required after the write. Generalizing the provenance protocol would also
change its subprocess capture, artifact files and GraphQL history transport
into the selected `GithubRest` service, broadening this review wave beyond its
body update. Leave that extraction to a separate transport change.

After recording, a full ready-gate confirmation requires an unchanged head and
unchanged applied attributions. The remaining interval between the last body
read and PATCH is not atomic: an overtaken concurrent edit cannot be recovered
by readback alone. This limitation is documented on both recording exports.
Reversal: restore the previous cancellation listing and remove the bounded body
reconciliation, readback and post-record ready confirmation.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug orchestrator-handoff`; add a `kind: decision` file there, never edit this block._

### Codex-lane PR-comment helper dropped, 2026-11-06

PLAN P2 listed a helper that posts `orchestrator:`-prefixed PR comments to Codex lanes. Since 2026-11-02 (goals/t3-native-orchestration) T3 Code is the only cross-session route and the orchestrate skill forbids PR comments as a broadcast route; a Codex lane T3 launched is reached by its thread link, and one T3 did not launch is not messageable and is read through its PR, brief or job receipt. A helper would add a side channel the doctrine retired. The register's codex-lane docs now say so.

Lane `feat/orchestrator-handoff-p2`

Reverse: Add a yeet helper that posts orchestrator:-prefixed PR comments and list PR comments as a codex-lane route again.

### Pending commit statuses hold the gate table; failing ones do not, 2026-11-06

PLAN P2 asked for pending commit statuses as blocking. The table reads the combined status of each head (new `GithubRest.commitStatuses`, fails closed past one page) and a pending context holds GATE-MET. A failing context is printed in its own `STATUS-RED:` column and does not hold: on 2026-11-06 every open PR carried failing Vercel previews, and `yeet merge-gate` reads check runs only, so treating them as reds would make the table stricter than the gate it previews and no row would ever be a candidate. Whether a Vercel failure is the AGENTS.md rate-limit exception stays the orchestrator's judgment after reading the deployment.

Lane `feat/orchestrator-handoff-p2`

Reverse: Treat failing commit statuses as reds in decideGateTableRow, or drop the combined-status read.

### Gate table is yeet gate-table, not merge-gate --table, 2026-11-06

PLAN P2 named `yeet merge-gate --table`. The gate takes two required positional arguments (the PR and the pinned head) and the pin is its safety contract; making them optional to host a read-only table would weaken it. The port is a sibling subcommand, `yeet gate-table [--json]`, that only reads and never merges. `gate.sh` stays as a one-line wrapper so pollers armed before the port keep working.

Lane `feat/orchestrator-handoff-p2`

Reverse: Fold the table into merge-gate behind optional pr/sha arguments and delete the gate-table subcommand.

### Gate table reads threads per ready PR with the merge gate's rule, 2026-11-06

gate.sh ran one GraphQL query over the first 60 open PRs with 100 threads each and reimplemented the outstanding rule in jq. The table instead reads every page of open PRs over REST and calls the `@beep/github` ReviewThread service once per PR out of draft, every page, with the same `outstanding` rule `yeet merge-gate` uses. Drafts read no threads (`threads=-`): the gate never meets a draft. A failed read is `threads=?` and never zero. Each base branch's ruleset is read once over REST (`requiredStatusContexts`), the reader the authenticated merge-gate path already uses, so the table spawns no `gh`. Cost: one GraphQL query per ready PR per poll, about ten at the 2026-11-06 queue size, within the REST-first ruling's budget for a four-minute poll.

Lane `feat/orchestrator-handoff-p2`

Reverse: Restore one batched GraphQL query over all open PRs and compute outstanding threads from it.

### HANDOFF render never drops hand-typed register or ruling rows, 2026-11-06

The P3 drill rendered the live HANDOFF.md and the first render would have replaced its hand-typed Register table (claude-session and systemd timer rows the register file never held) and, once the rulings store had one ruling, the whole hand-typed rulings table. A regenerated Register or Rulings section now appends any prior body that did not come from its store, or the block an earlier render carried, under a 'Carried over' heading; it persists until the holder records each item and deletes it. The preamble also keeps a `Holder thread:` line (the drill found no route to ask the live holder for release) and one 'Rendered by `session handoff`' line naming when the carried-over prose was last written, because a successor could not tell fresh prose from three-day-old prose.

Lane `feat/orchestrator-handoff-p2`

Reverse: Remove carriedOver/withCarry from Handoff.ts; regenerated sections then replace the prior body wholesale.

### HANDOFF.md renderer regenerates data sections and keeps prose, 2026-11-06

`session handoff [--file] [--gate-snapshot <file>] [--write]` regenerates the sections whose truth is a file: the holder line (newest open orchestrator row in the ledger), Rulings in force (when the rulings store has one in force), Gate snapshot (when given), Register (always) and Journal pointer (last STATE.md line). Promises, pending decisions, operator-hands items, next actions, recipes, routes and the broadcast are prose written at the moment of the event; they are carried over verbatim, the template placeholder is written only when a section is missing, and sections the template does not know are kept before the journal pointer. `--write` backs the old file up as `HANDOFF.<instant>.bak.md`. Rulings are a new append-only store, `orchestrator-ruling/v1` rows in `<repo>.rulings.jsonl` next to the register, keyed by a kebab-case id with `--supersedes` retiring the replaced ruling. This supersedes the 2026-10-06 'HANDOFF.md is a template, not a schema' row for the data-backed sections only.

Lane `feat/orchestrator-handoff-p2`

Reverse: Delete session handoff and session ruling and go back to hand-writing HANDOFF.md from the template.

### yeet merge-gate holds an owner-merge-hold PR, 2026-11-06

The repository's GitHub labels include `owner-merge-hold`, which an owner puts on a PR it merges itself (2026-11-06: #2797, titled OWNER HOLD), but nothing in the CLI read it: `yeet merge-gate` would have merged it at the gate. The gate now holds such a PR as `owner-hold` (a structural hold, after draft and before conflicting, in strict and relaxed mode), and `yeet gate-table` names it in a `HOLD:` column and never offers it as GATE-MET. Found by the P3 take-over drill.

Lane `feat/orchestrator-handoff-p2`

Reverse: Drop the owner-hold step from structuralHold and the HOLD column from the gate table.

### register convert moves a unit in two appends; scheduled-task is a unit kind, 2026-11-06

`session register convert --kind --address --to-kind --to-address [--brief]` retires the source row (note: converted to the target) and registers the target active with the source's name, owns, waiting ask and orphan plan, last contact now and a note naming the source and brief. It refuses an unregistered or retired source, an in-process-agent target (it would still die with the session), the same unit, and a target with a live row. The orchestrate skill already told successors to re-arm `scheduled-task` rows (T3 `schedule_task`), but the kind did not exist, so such tasks had been registered under other kinds; `scheduled-task` is added. A T3 thread stays a `desktop-session` or `codex-lane` row addressed by its thread link.

Lane `feat/orchestrator-handoff-p2`

Reverse: Delete session register convert and the scheduled-task kind; units are retired and re-added by hand.

<!-- beep:decisions:end -->
