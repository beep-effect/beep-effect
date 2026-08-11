# Effect-Drizzle Graduation Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Doctrine: ecosystem family docs PR | complete (PR #658, `4857be45cb`) | Charter the `ecosystem` family in the standards (doc 14, grammar row in 07, ARCHITECTURE.md summary + routing row, GLOSSARY term, DECISIONS entry, packet index row, shared-tables projection line) and register this packet. Docs-only. | PR merged via yeet: checks green, zero unresolved threads. |
| P1 Package creation: move, harness, gates PR | in-progress | git-mv `scratchpad/bsl` → the new member root `packages/ecosystem/effect-drizzle/**`; manifest per SPEC constraint 6-7; `@effect/vitest` harness migration; member tstyche lane created with the package (SPEC constraint 8: matrix + `.toRaiseError` literal pinning + multi-TS peer targets); inverted-import gate in repo lint; extend the family-encoding surfaces inventoried in SPEC Target Surfaces (PackageJson schema, create-package, workspaces globs, syncpack, law-scan scoping, lint shards); governance registrations; suppression removals; retire `scratchpad/bsl`. | Package green through standard lanes; member tstyche lane passes; gate provably fails on a planted `@beep/*` src import; PR merged via yeet. |
| P2 Quality integration + closeout PR | pending | Wire family CI integration (bundle probe; CI wiring for the member lanes); docgen surface; then closeout — reflection + status flips land in this same PR (repo law). | Lanes run in CI; `bun run beep lint reflection-artifacts` passes; manifest/README/INDEX flipped; PR merged via yeet. |

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
3. Flip packet state through the single writer — `bun run beep goals
   set-status` — which updates the manifest lifecycle, `initiative.status`,
   README status line, timestamp, and generated index together (hand-editing
   only `initiative.status`/phases leaves `lifecycle: active` and
   `goals doctor` blocks on the mismatch). Update phase statuses and the
   README "Latest Evidence" alongside — in the same PR as the final P2 work.

## Execution Notes

- The locked grill decisions
  (`goals/effect-drizzle-graduation/research/bsl/graduation-decisions.md`) are
  constraints, not suggestions; SPEC.md Constraints reproduces them
  normatively.
- P1 grounding selected research disposition option (a): the corpus moved from
  `scratchpad/bsl/research/` to this packet's `research/bsl/` in P1;
  `research/SOURCES.md` records the outcome so provenance links resolve
  in-packet.
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
