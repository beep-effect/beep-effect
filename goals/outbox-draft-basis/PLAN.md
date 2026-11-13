# Outbox Draft Basis Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | done | Freeze the pin, status and report schemas and the zone rule. Run the tenant proof for the draft category. Decide the message pin. Check the state of `m365-agent-outbox` slice 3. | One decision file each for the schemas, the category proof and the message pin; the sequencing with slice 3 is recorded. |
| P1 Implement | done | Two pull requests. First: schemas, the pure comparison, the audit field, `create_draft` and `get_draft`. Second: the check-drafts tool, the category mark, the README and the runbook. | `SPEC.md` acceptance criteria are met. |
| P2 Verify | done | Run the package handoff and the final gates on each head. | `bun run beep quality package-verify @beep/m365-mcp` and `bun run beep yeet final-check` pass. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | in-progress | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

P1 order inside the first pull request: schema, then the service contract,
then handlers. The second pull request writes no category until the P0
category proof is recorded. If a third pull request would be needed, cut the
message pin by decision file.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status outbox-draft-basis completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug outbox-draft-basis` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add outbox-draft-basis --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/outbox-draft-basis/GOAL.md)" -le 4000
jq . goals/outbox-draft-basis/ops/manifest.json
rg -n "outbox-draft-basis|GOAL.md|agentLaunchers|packetAnchorDocument" goals/outbox-draft-basis
git diff --check -- goals/outbox-draft-basis
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug outbox-draft-basis`; add a `kind: checkpoint` file there, never edit this block._

### m365-agent-outbox slice 3 has not started; this goal opens its pull request first, 2026-11-10

Checked 2026-11-10 before P1: origin has no branch and GitHub has no open pull request for m365-agent-outbox slice 3, its packet still names slice 3 as the next pull request, and the last commit that touched packages/drivers/m365-mcp on main is unrelated tooling work. This goal therefore opens first. The rule in SPEC.md stands: whichever packet opens second merges main first.

Lane feat/outbox-draft-basis

Reverse: If a slice 3 pull request opens before this goal's first one merges, merge main into this lane after it lands.

### Tenant proof route chosen; first attempt blocked by Graph gateway errors, 2026-11-13

Operator ruling, 2026-11-13 (grill session): the proof is one test draft in the attorney's mailbox, written through the outbox's own Graph path with the category set by updateMessageCategories, addressed to one firm mailbox and one outside address the operator owns, and sent by a person from Outlook. On the same day every authenticated read of that mailbox answered HTTP 502 or 504 (messages and events, four attempts over about ten minutes), while Graph's public metadata and the sign-in metadata answered 200 and the configured mailbox and credentials checked out by length and hash. The draft was not created. The second pull request is built in the meantime and writes no category until the proof is recorded.

Lane feat/outbox-draft-basis-check

Reverse: Run the proof by hand in Outlook instead, or drop the mark by decision file if it cannot be run.

<!-- beep:decisions:end -->
