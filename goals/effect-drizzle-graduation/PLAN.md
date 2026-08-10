# Effect-Drizzle Graduation Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Doctrine: ecosystem family docs PR | active | Charter the `ecosystem` family in the standards (doc 14, grammar row in 07, ARCHITECTURE.md summary + routing row, GLOSSARY term, DECISIONS entry, packet index row, shared-tables projection line) and register this packet. Docs-only. | PR merged via yeet: checks green, zero unresolved threads. |
| P1 Package creation: move, harness, gates PR | pending | git-mv `scratchpad/bsl` → `packages/ecosystem/effect-drizzle`; manifest per SPEC constraint 6-7; `@effect/vitest` harness migration; inverted-import gate in repo lint; governance registrations; suppression removals; retire `scratchpad/bsl`. | Package green through standard lanes; gate provably fails on a planted `@beep/*` src import; PR merged via yeet. |
| P2 Quality integration + closeout PR | pending | Wire family lanes (member-scoped tstyche, bundle probe in CI); docgen surface; then closeout — reflection + status flips land in this same PR (repo law). | Lanes run in CI; `bun run beep lint reflection-artifacts` passes; manifest/README/INDEX flipped; PR merged via yeet. |

Phase ids match `ops/manifest.json` `phases[]` exactly. Each phase is its own
PR driven to mergeable via yeet; the completion gate binds every phase.

## P2 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo tooling,
   the implementation, and the goal/prompt. Its YAML frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks
   closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` — in the same PR as the final P2 work.

## Execution Notes

- The locked grill decisions
  (`scratchpad/bsl/research/graduation-decisions.md`) are constraints, not
  suggestions; SPEC.md Constraints reproduces them normatively.
- P1 moves `scratchpad/bsl/research/` with the package or into this packet's
  `research/` — decide at P1 grounding; `research/SOURCES.md` records the
  outcome so provenance links never dangle.
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/effect-drizzle-graduation/GOAL.md)" -le 4000
jq . goals/effect-drizzle-graduation/ops/manifest.json
rg -n "effect-drizzle-graduation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-drizzle-graduation
git diff --check -- goals/effect-drizzle-graduation
bun run beep goals index --check
```
