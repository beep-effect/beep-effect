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
| Relayed rulings | The orchestrate skill quotes two operator rulings of 2026-10-06 verbatim: Codex delegation ("delegate work to codex using GPT 6 Sol", recorded as `gpt-6.1-sol` medium with "Codex edits, owner commits") and REST first ("Use rest api & gh secret." / "in op."), with GraphQL behind a budget guard and `beep yeet gh` on `@effected/github` as the planned home. | Quoting avoids paraphrase drift; the model id and the commit rule are the skill's gloss, marked as such. | Edit the quotes if the operator restates them. |
| S11 relaxed gate | `yeet merge-gate <pr> <sha> --relaxed` replaces `merge-gate-relaxed4.sh` in the CLI: the head, draft and conflict holds, the ruleset failing closed, the review window and the thread re-read all stay, and a head on which not one required context has run still holds (no CI evidence, the #1502 mode); otherwise red and pending checks, required ones included, never hold and are recorded with their attribution (the `--tolerate` text, else the S11 default) in the merge line and one PR comment; after the merge the head's active workflow runs are cancelled across all pages. The comment and the cancels are best effort and only warn; only runs whose `head_sha` is the merged head are cancelled. Deliberate differences from the script: GitHub's PUT decides an unknown mergeability (the script waited for it), the squash commit message is not set from the PR body, and outstanding threads use the stricter AGENTS.md count. | Operator ruling S11 (2026-10-09), standing repo-wide since 2026-10-13 (AGENTS.md "Mergeable"); S11 merges ran through an out-of-repo script the successor could not see or test. | Drop the flag; the strict gate is unchanged. |
| S11 ready flip | `yeet ready --inherited "<check>=<attribution>"` (repeatable): a failing required check that is attributed this way does not hold the flip; the applied attributions are written to a marked "Inherited reds (S11)" section of the PR body before the flip, a failed write refuses the flip, and a census that counts more failing required checks than it names still refuses. Round-one body-race repair uses the approved bounded REST fallback (three fresh-read/re-splice rounds, then refusal) rather than generalizing the subprocess-based provenance writer; readback and a post-record ready confirmation fail closed. Every flip reconciles the section, pinning the heading to the head and rewriting an older record to explicit "None: no required check is red on this head." when no inherited reds apply; an empty set without an existing section adds nothing. Empty-set cleanup is best effort: body read/write failures warn and the flip proceeds after gate confirmation; non-empty applied attributions remain fail-closed. | S11 requires each inherited red to be recorded; PRs were leaving draft through a bare `gh pr ready` with the record written by hand. | Revert the inherited-red flag and marked-section recorder together; the default flip currently attempts best-effort stale-section cleanup, so dropping only the flag does not remove that body reconciliation. |
| Ownership (2026-10-14) | The two S11 flags were built by the stacked-pr-adoption follow-up session under operator ruling S23 ("I want things done"), routed by the orchestrator while this packet's owner was not live. They stay in this packet's surface: `MergeGate.ts` is a Target Surface. | Keeps the merge gate's contract in one packet. | Move the rows to the packet that takes the gate over. |
| Private CLI release notes (2026-10-14) | Keep the S11 change in this packet without a Changesets release note while `@beep/repo-cli` is private. | The worker brief requested a patch note, but hosted Repo Sanity on #1678 rejected it: private workspaces must not accumulate release notes. The package's release policy governs the ceremony; all seven locked design decisions remain intact. | Add the patch note when a separate publication-activation change makes the workspace publish-enabled. |

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
