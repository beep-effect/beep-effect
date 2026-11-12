# Canonical Digest Owner Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

P1 Implement and P3 Yeet run once per slice; a slice is a pull request. The
exploration's `MAP.md` calls these P0 to P3.

| Slice | Status | First step | Done when |
| --- | --- | --- | --- |
| A, census and proof | done | The first vertical slice: property test of the epistemics encoder against the owner, plus the execution-record seal replay. | Census table tracked; property test covers every candidate; PacketCore and seal replays pass or name their legacy rows. No production code changed. |
| B, owner surface | pending | Schema for the prefixed digest in `@beep/schema`, then the `undefined`-member pre-pass in `@beep/jsonc`. | Grammar exported; `ContentDigest` and `SourceTextDigest` derive from it with encoded forms unchanged; refusal table fixed by test. |
| C, swaps | pending | Epistemics first (most seal consumers), then PacketCore, then semantica, one commit each. | Each body delegates to the owner; exports unchanged; slice A's tests still green; PartyKey v1 has a parity proof or a pinned row. |
| D, guard | pending | Write the rule against the tree as it stands after C. | Rule active in the lint pass with no exceptions beyond census rows. |

P0 Research settled, before slice A: how many stored PacketCore events the
archive repository holds and whether the replay must cover them; and before
slice C: whether the `@beep/epistemics` to `@beep/jsonc` edge is allowed as
drawn, and whether any caller relies on a coerced value. The answers are the
three decision files dated 2026-11-12.

### Slice A evidence

Done 2026-11-12. No production code changed.

- Census: [`research/encoder-census.md`](./research/encoder-census.md), 157
  rows in three partition files. Four replace-class encoders (the three known
  and the `@beep/md` frontmatter encoder), no legacy row.
- Differential and off-domain tests:
  `packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts`
  and `apps/labs/semantica/test/CanonicalDifferential.test.ts`.
- Replay: `packages/tooling/tool/cli/test/canonical-digest-owner-replay.test.ts`
  (76 of 76 stored packet events) and the new block in
  `packages/execution-authority/domain/test/ExecutionAuthority.test.ts` (four
  golden seals and a property). Zero mismatches.
- Method and counts: [`research/slice-a-evidence.md`](./research/slice-a-evidence.md).

Carried into later slices, from the census:

- Slice B must land the `undefined`-member pre-pass before slice C swaps
  PacketCore: `Goals/Completion.ts` relies on dropped members.
- Slice C adds `@beep/md` frontmatter to its swap list (a `@beep/md` to
  `@beep/jsonc` edge, modeling to modeling) and lists two behaviour changes:
  an unpaired surrogate in a digested string, and nesting past 256 levels,
  both become typed refusals.
- Slice C refreshes the packet event snapshot first if the tree or the
  archive has gained an event.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add canonical-digest-owner --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/canonical-digest-owner/GOAL.md)" -le 4000
jq . goals/canonical-digest-owner/ops/manifest.json
rg -n "canonical-digest-owner|GOAL.md|agentLaunchers|packetAnchorDocument" goals/canonical-digest-owner
git diff --check -- goals/canonical-digest-owner
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug canonical-digest-owner`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
