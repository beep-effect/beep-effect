# Agent Output Census Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Read the transcript modules of `@beep/repo-ai-metrics` and the audit's method; pin the 2026-11-18 window bounds and the repository match rule; settle the module name, the command name inside the `ai-metrics` group, the baseline location and the class rules the audit names by example only. | One decision file per choice; the spec's Target Surfaces still match the library. |
| P1 Schema | complete | The `agent-output-census/v1` report: corpus row, totals, the closed class domains, every table of `transcript-audit.md`, the headline rows, and the baseline file schema. | AC1 holds; schemas decode synthetic reports. |
| P2 Census service | complete | A `Context.Service` contract in `@beep/repo-ai-metrics` (enumerate sources for a window, project records, reduce to the report), then its implementation reusing `@beep/jsonl` `Line`, `parseSourceEventTime`, the source literal and the usage projection. | AC2 and AC7 hold over a synthetic Claude and Codex corpus with compaction boundaries, subagents, oversized lines and planted canaries. |
| P3 Command | complete | The planned `census` subcommand of the repo CLI's `ai-metrics` group: window and root flags, the text tables, `--json`, and writing one baseline file per run. | AC3 and AC6 hold in a render test. |
| P4 Reproduce | complete | Run the census on the pinned window, compare each row with `transcript-audit.md`, attribute every miss, and commit the baseline file. | AC4 and AC5 hold; the comparison is under `history/`. |
| P5 Yeet: PR to mergeable | complete | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Work Breakdown

One pull request carries P1 to P4 and the closeout (decision `one-pull-request`; the plan first
named two). P4 runs on a workstation that holds the
window's transcripts; the run reads them in place and writes only the baseline file.

1. P0. Fix the window as two timestamps from the audit's "seven days ending that morning" and the
   transcript record times; fix the repository match the audit used (Claude project directories
   whose name contains the repository name; Codex sessions whose working directory is under such a
   checkout). Record both.
2. P1. Name each class rule as a literal member with its matching rule beside it; the rule version
   goes into the report.
3. P2. Project one record at a time: a Claude message yields its `tool_use` and `tool_result`
   blocks; a Codex record yields its call or output. Join by call identifier inside one context,
   classify, measure, drop the text. Reduce per context so carried cost can honour compaction.
4. P3. Render through `@beep/cli-kit` `Doc` (`packages/foundation/capability/cli-kit/src/Doc.ts`);
   print the corpus row first and the headline rows last.
5. P4. Compare with tolerance; record any knowing rule difference as a decision file.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status agent-output-census completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug agent-output-census` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Nothing read from a transcript is pasted into a tracked file, a commit message, a PR body or a
  friction receipt; quote counts only.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add agent-output-census --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/agent-output-census/GOAL.md)" -le 4000
jq . goals/agent-output-census/ops/manifest.json
rg -n "agent-output-census|GOAL.md|agentLaunchers|packetAnchorDocument" goals/agent-output-census
git diff --check -- goals/agent-output-census
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug agent-output-census`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
